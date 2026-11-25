from __future__ import annotations

import asyncio
import json
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.exceptions import (
    AppError,
    ValidationDomainError,
)
from app.core.rate_limit import rate_limiter
from app.core.redis import redis_manager
from app.core.tenant import AuthenticatedPrincipal
from app.db.models.integrations import AiInteractionLog
from app.db.session import set_transaction_tenant_context
from app.modules.ai.guardrails import (
    hash_prompt,
    sanitize_text,
    validate_change_assess_output,
    validate_draft_kb_output,
    validate_incident_triage_output,
    validate_triage_assistant_output,
)
from app.modules.ai.schemas import (
    AiInteractionLogOut,
    AiUsageSummaryOut,
    ChangeAssessRequest,
    ChangeAssessResponse,
    CopilotRequest,
    CopilotResponse,
    DraftKbRequest,
    DraftKbResponse,
    IncidentTriageRequest,
    IncidentTriageResponse,
    TriageAssistantRequest,
    TriageAssistantResponse,
    WikiAssistRequest,
    WikiAssistResponse,
)
from app.modules.audit.service import AuditService

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


class AiService:
    """
    Secured, audited, quota-enforced FastAPI Gemini service.
    - Reads GEMINI_API_KEY exclusively on the backend.
    - Enforces authenticated access, per-user rate limits, and per-organization daily quotas.
    - Strictly advisory: never mutates approvals, CAB votes, IAM policies, or governance settings.
    - Persists immutable AiInteractionLog + centralized AuditLog entries for every call.
    """

    @staticmethod
    async def _enforce_limits(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        settings: Settings,
        action_type: str,
    ) -> None:
        # 1. Per-user sliding window rate limit
        redis_client = getattr(redis_manager, "client", None)
        rl = await rate_limiter.check(
            f"rl:ai:{principal.organization_id}:{principal.user_id}",
            limit=settings.ai_rate_limit_per_minute,
            window_seconds=60,
            redis_client=redis_client,
        )
        if not rl.allowed:
            await AiService._record_log(
                db,
                principal=principal,
                action_type=action_type,
                model_name=settings.gemini_model,
                prompt_hash=hash_prompt(f"rate_limited:{action_type}"),
                status="rate_limited",
                error_code="AI_RATE_LIMITED",
            )
            await db.commit()
            raise AppError(
                status_code=429,
                error_code="AI_RATE_LIMITED",
                message=f"AI rate limit reached. Retry after {rl.reset_after_seconds} seconds.",
            )

        # 2. Organization-level daily quota
        since = datetime.now(timezone.utc) - timedelta(hours=24)
        used_today = int(
            (
                await db.execute(
                    select(func.count(AiInteractionLog.id)).where(
                        AiInteractionLog.organization_id == principal.organization_id,
                        AiInteractionLog.status == "succeeded",
                        AiInteractionLog.created_at >= since,
                    )
                )
            ).scalar_one()
        )
        if used_today >= settings.ai_daily_org_limit:
            await AiService._record_log(
                db,
                principal=principal,
                action_type=action_type,
                model_name=settings.gemini_model,
                prompt_hash=hash_prompt(f"quota_exceeded:{action_type}"),
                status="quota_exceeded",
                error_code="AI_QUOTA_EXCEEDED",
            )
            await db.commit()
            raise AppError(
                status_code=429,
                error_code="AI_QUOTA_EXCEEDED",
                message=f"Organization daily AI quota ({settings.ai_daily_org_limit} calls) has been reached.",
            )

    @staticmethod
    async def _record_log(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        action_type: str,
        model_name: str,
        prompt_hash: str,
        prompt_chars: int = 0,
        response_chars: int = 0,
        latency_ms: int = 0,
        status: str = "succeeded",
        target_entity_type: str | None = None,
        target_entity_id: str | None = None,
        advisory_summary: str = "",
        error_code: str | None = None,
    ) -> AiInteractionLog:
        entry = AiInteractionLog(
            organization_id=principal.organization_id,
            actor_user_id=principal.user_id,
            actor_email=principal.email,
            action_type=action_type,
            model_name=model_name,
            target_entity_type=target_entity_type,
            target_entity_id=target_entity_id,
            prompt_hash=prompt_hash,
            prompt_chars=prompt_chars,
            response_chars=response_chars,
            latency_ms=latency_ms,
            status=status,
            requires_human_approval=True,
            advisory_summary=advisory_summary[:512],
            error_code=error_code,
        )
        db.add(entry)
        return entry

    @staticmethod
    async def _call_gemini(
        *,
        settings: Settings,
        system_instruction: str,
        contents: list[dict[str, Any]],
        json_schema: dict[str, Any] | None = None,
        enable_google_search: bool = False,
    ) -> dict[str, Any]:
        api_key = settings.gemini_api_key.get_secret_value().strip()
        if not api_key:
            raise AppError(
                status_code=503,
                error_code="AI_NOT_CONFIGURED",
                message="GEMINI_API_KEY is not configured on the backend server.",
            )

        model = settings.gemini_model.strip() or "gemini-4-hydrogen"
        url = f"{GEMINI_API_BASE}/{model}:generateContent"

        body: dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "contents": contents,
        }
        if json_schema is not None:
            body["generationConfig"] = {
                "responseMimeType": "application/json",
                "responseSchema": json_schema,
            }
        if enable_google_search:
            body["tools"] = [{"google_search": {}}]

        last_error: Exception | None = None
        async with httpx.AsyncClient(timeout=30.0) as client:
            for attempt in range(1, 4):
                try:
                    resp = await client.post(
                        url,
                        params={"key": api_key},
                        headers={"User-Agent": "aistudio-build", "Content-Type": "application/json"},
                        json=body,
                    )
                    if resp.status_code in {429, 500, 502, 503, 504} and attempt < 3:
                        await asyncio.sleep(0.5 * (2 ** (attempt - 1)))
                        continue
                    if resp.status_code >= 400:
                        raise AppError(
                            status_code=502,
                            error_code="AI_UPSTREAM_ERROR",
                            message=f"Gemini API returned HTTP {resp.status_code}.",
                        )
                    return resp.json()
                except httpx.HTTPError as exc:
                    last_error = exc
                    if attempt < 3:
                        await asyncio.sleep(0.5 * (2 ** (attempt - 1)))
                        continue
                    raise AppError(
                        status_code=502,
                        error_code="AI_UPSTREAM_UNAVAILABLE",
                        message="Unable to reach Gemini API upstream service.",
                    ) from exc

        raise AppError(
            status_code=502,
            error_code="AI_UPSTREAM_UNAVAILABLE",
            message=f"Gemini API call failed: {last_error}",
        )

    @staticmethod
    def _extract_text(raw_response: dict[str, Any]) -> str:
        candidates = raw_response.get("candidates") or []
        if not candidates:
            return ""
        parts = candidates[0].get("content", {}).get("parts", [])
        return "".join(str(p.get("text", "")) for p in parts if isinstance(p, dict)).strip()

    @staticmethod
    async def triage_incident(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: IncidentTriageRequest,
        request: Request | None = None,
    ) -> IncidentTriageResponse:
        settings = get_settings()
        await set_transaction_tenant_context(db, organization_id=principal.organization_id)
        await AiService._enforce_limits(db, principal=principal, settings=settings, action_type="triage_incident")

        queues = ", ".join(payload.availableQueues) if payload.availableQueues else (
            "Service Desk L1, Service Desk L2, Network & Firewall Ops, Cloud SRE & Platform, "
            "IAM & Identity Operations, Endpoint & Hardware Support, SecOps & Threat Response"
        )
        prompt = (
            "Analyze this IT incident and provide structured ITIL v4 routing and triage guidance. "
            "Your output is strictly advisory; human operators apply changes.\n\n"
            f"Ticket ID: {payload.id or 'NEW'}\n"
            f"Title: {payload.title}\n"
            f"Description: {payload.description or 'None'}\n"
            f"Current Category: {payload.category or 'unspecified'}\n"
            f"Current Priority: {payload.priority or 'unspecified'}\n"
            f"Affected CI: {payload.affectedCI or 'None'}\n"
            f"Available Assignment Groups: {queues}\n"
        )
        if payload.recentActivity:
            prompt += "Recent Activity:\n" + "\n".join(payload.recentActivity[-5:])

        schema = {
            "type": "OBJECT",
            "properties": {
                "recommendedPriority": {"type": "STRING"},
                "recommendedCategory": {"type": "STRING"},
                "suggestedQueue": {"type": "STRING"},
                "rootCauseHypothesis": {"type": "STRING"},
                "diagnosticSteps": {"type": "ARRAY", "items": {"type": "STRING"}},
                "draftResolutionNote": {"type": "STRING"},
                "draftCustomerReply": {"type": "STRING"},
            },
            "required": [
                "recommendedPriority",
                "recommendedCategory",
                "suggestedQueue",
                "rootCauseHypothesis",
                "diagnosticSteps",
                "draftResolutionNote",
                "draftCustomerReply",
            ],
        }

        started = time.perf_counter()
        raw = await AiService._call_gemini(
            settings=settings,
            system_instruction=(
                "You are an experienced L3 SRE and ITIL Incident Manager for Scribble-IT. "
                "Provide crisp, technical, actionable advisory triage analysis."
            ),
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            json_schema=schema,
        )
        text = AiService._extract_text(raw)
        try:
            parsed = json.loads(text or "{}")
        except json.JSONDecodeError as exc:
            raise ValidationDomainError("AI returned malformed JSON triage output.") from exc

        validated = validate_incident_triage_output(parsed)
        latency_ms = int((time.perf_counter() - started) * 1000)

        await AiService._record_log(
            db,
            principal=principal,
            action_type="triage_incident",
            model_name=settings.gemini_model,
            prompt_hash=hash_prompt(prompt),
            prompt_chars=len(prompt),
            response_chars=len(text),
            latency_ms=latency_ms,
            target_entity_type="incident",
            target_entity_id=payload.id,
            advisory_summary=f"Recommended {validated['recommendedPriority']} / {validated['suggestedQueue']}",
        )
        await AuditService.log_event(
            db,
            organization_id=principal.organization_id,
            actor_user_id=principal.user_id,
            actor_email=principal.email,
            actor_portal=principal.portal_type,
            module="ai_service",
            action="ai.triage_incident",
            entity_type="incident",
            entity_id=payload.id or "new",
            summary=f"AI advisory incident triage generated ({validated['recommendedPriority']})",
            request=request,
        )
        await db.commit()

        return IncidentTriageResponse(
            **validated,
            model=settings.gemini_model,
            generatedAt=datetime.now(timezone.utc).isoformat(),
        )

    @staticmethod
    async def run_triage_assistant(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: TriageAssistantRequest,
        request: Request | None = None,
    ) -> TriageAssistantResponse:
        settings = get_settings()
        await set_transaction_tenant_context(db, organization_id=principal.organization_id)
        await AiService._enforce_limits(db, principal=principal, settings=settings, action_type="triage_assistant")

        kb_pool = payload.kbArticles[:20]
        kb_catalog = (
            "\n".join(
                f"- [{kb.id}] ({kb.category}) \"{kb.title}\" | Tags: {', '.join(kb.tags) or 'none'} | {kb.excerpt[:240]}"
                for kb in kb_pool
            )
            if kb_pool
            else "No published KB articles provided."
        )
        prompt = (
            "Provide a real-time Incident Triage Assistant advisory briefing and match ONLY KB IDs present in the catalog.\n\n"
            f"Ticket ID: {payload.id}\nTitle: {payload.title}\nStatus: {payload.status}\n"
            f"Priority: {payload.priority}\nCategory: {payload.category}\n"
            f"Assignment Group: {payload.assignmentGroup or 'Unassigned'}\n"
            f"Affected CI: {payload.affectedCI or 'None'}\n"
            f"SLA Deadline: {payload.slaDeadline or 'Unspecified'}\n"
            f"Description: {payload.description}\n\n"
            f"=== TENANT KB CATALOG ===\n{kb_catalog}"
        )

        schema = {
            "type": "OBJECT",
            "properties": {
                "realTimeSummary": {"type": "STRING"},
                "urgencySignal": {"type": "STRING"},
                "slaAssessment": {"type": "STRING"},
                "recommendedPriority": {"type": "STRING"},
                "recommendedCategory": {"type": "STRING"},
                "suggestedQueue": {"type": "STRING"},
                "rootCauseHypothesis": {"type": "STRING"},
                "nextSteps": {"type": "ARRAY", "items": {"type": "STRING"}},
                "matchedKbArticles": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "kbId": {"type": "STRING"},
                            "title": {"type": "STRING"},
                            "relevanceReason": {"type": "STRING"},
                            "matchConfidence": {"type": "STRING"},
                        },
                        "required": ["kbId", "title", "relevanceReason", "matchConfidence"],
                    },
                },
                "suggestedNewKbTopics": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "title": {"type": "STRING"},
                            "category": {"type": "STRING"},
                            "summary": {"type": "STRING"},
                            "draftBody": {"type": "STRING"},
                        },
                        "required": ["title", "category", "summary", "draftBody"],
                    },
                },
                "draftResolutionNote": {"type": "STRING"},
                "draftCustomerReply": {"type": "STRING"},
            },
            "required": [
                "realTimeSummary",
                "urgencySignal",
                "slaAssessment",
                "recommendedPriority",
                "recommendedCategory",
                "suggestedQueue",
                "rootCauseHypothesis",
                "nextSteps",
                "matchedKbArticles",
                "suggestedNewKbTopics",
                "draftResolutionNote",
                "draftCustomerReply",
            ],
        }

        started = time.perf_counter()
        raw = await AiService._call_gemini(
            settings=settings,
            system_instruction=(
                "You are the Scribble-IT Real-Time Triage Assistant. Be technical and concise. "
                "Never fabricate KB IDs outside the catalog and never claim to approve or execute governance changes."
            ),
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            json_schema=schema,
        )
        text = AiService._extract_text(raw)
        try:
            parsed = json.loads(text or "{}")
        except json.JSONDecodeError as exc:
            raise ValidationDomainError("AI returned malformed JSON triage assistant output.") from exc

        validated = validate_triage_assistant_output(
            parsed,
            allowed_kb_ids={kb.id for kb in kb_pool},
            kb_titles_by_id={kb.id: kb.title for kb in kb_pool},
            fallback_title=payload.title,
            fallback_category=payload.category,
        )
        latency_ms = int((time.perf_counter() - started) * 1000)

        await AiService._record_log(
            db,
            principal=principal,
            action_type="triage_assistant",
            model_name=settings.gemini_model,
            prompt_hash=hash_prompt(prompt),
            prompt_chars=len(prompt),
            response_chars=len(text),
            latency_ms=latency_ms,
            target_entity_type="incident",
            target_entity_id=payload.id,
            advisory_summary=f"Urgency {validated['urgencySignal']} · {len(validated['matchedKbArticles'])} KB matched",
        )
        await db.commit()

        return TriageAssistantResponse(
            **validated,
            model=settings.gemini_model,
            generatedAt=datetime.now(timezone.utc).isoformat(),
        )

    @staticmethod
    async def assess_change(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: ChangeAssessRequest,
        request: Request | None = None,
    ) -> ChangeAssessResponse:
        settings = get_settings()
        await set_transaction_tenant_context(db, organization_id=principal.organization_id)
        await AiService._enforce_limits(db, principal=principal, settings=settings, action_type="assess_change")

        prompt = (
            "Evaluate this ITIL Change Request for CAB readiness and operational risk. "
            "IMPORTANT: Your guidance is strictly advisory; human CAB members cast all formal votes.\n\n"
            f"RFC ID: {payload.id or 'NEW'}\nTitle: {payload.title}\nType: {payload.type}\n"
            f"Reason: {payload.reason}\nImplementation Plan: {payload.implementationPlan}\n"
            f"Rollback Plan: {payload.rollbackPlan}\nTest Plan: {payload.testPlan}"
        )
        schema = {
            "type": "OBJECT",
            "properties": {
                "assessedRisk": {"type": "STRING"},
                "readinessScore": {"type": "INTEGER"},
                "riskFindings": {"type": "ARRAY", "items": {"type": "STRING"}},
                "missingControls": {"type": "ARRAY", "items": {"type": "STRING"}},
                "recommendedCabGuidance": {"type": "STRING"},
            },
            "required": [
                "assessedRisk",
                "readinessScore",
                "riskFindings",
                "missingControls",
                "recommendedCabGuidance",
            ],
        }

        started = time.perf_counter()
        raw = await AiService._call_gemini(
            settings=settings,
            system_instruction=(
                "You are a Principal Change Advisory Board (CAB) Risk Advisor. "
                "Critically review implementation, rollback, and test plans. Never approve or cast CAB votes."
            ),
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            json_schema=schema,
        )
        text = AiService._extract_text(raw)
        try:
            parsed = json.loads(text or "{}")
        except json.JSONDecodeError as exc:
            raise ValidationDomainError("AI returned malformed JSON change assessment.") from exc

        validated = validate_change_assess_output(parsed)
        latency_ms = int((time.perf_counter() - started) * 1000)

        await AiService._record_log(
            db,
            principal=principal,
            action_type="assess_change",
            model_name=settings.gemini_model,
            prompt_hash=hash_prompt(prompt),
            prompt_chars=len(prompt),
            response_chars=len(text),
            latency_ms=latency_ms,
            target_entity_type="change_request",
            target_entity_id=payload.id,
            advisory_summary=f"Assessed risk {validated['assessedRisk']} (readiness {validated['readinessScore']}/100)",
        )
        await AuditService.log_event(
            db,
            organization_id=principal.organization_id,
            actor_user_id=principal.user_id,
            actor_email=principal.email,
            actor_portal=principal.portal_type,
            module="ai_service",
            action="ai.assess_change",
            entity_type="change_request",
            entity_id=payload.id or "new",
            summary=f"AI advisory CAB risk assessment ({validated['assessedRisk']}, score {validated['readinessScore']})",
            request=request,
        )
        await db.commit()

        return ChangeAssessResponse(
            **validated,
            model=settings.gemini_model,
            generatedAt=datetime.now(timezone.utc).isoformat(),
        )

    @staticmethod
    async def draft_kb(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: DraftKbRequest,
        request: Request | None = None,
    ) -> DraftKbResponse:
        settings = get_settings()
        await set_transaction_tenant_context(db, organization_id=principal.organization_id)
        await AiService._enforce_limits(db, principal=principal, settings=settings, action_type="draft_kb")

        prompt = (
            "Draft a structured IT Knowledge Base article / SOP runbook for human review prior to publication.\n\n"
            f"Topic: {payload.topic}\nCategory: {payload.category or 'Operations'}\n"
            f"Source Incident: {payload.sourceIncidentTitle or 'None'}\n"
            f"Symptoms: {payload.sourceIncidentDescription or 'None'}\n"
            f"Resolution: {payload.sourceResolution or 'None'}"
        )
        schema = {
            "type": "OBJECT",
            "properties": {
                "title": {"type": "STRING"},
                "category": {"type": "STRING"},
                "tags": {"type": "ARRAY", "items": {"type": "STRING"}},
                "content": {"type": "STRING"},
            },
            "required": ["title", "category", "tags", "content"],
        }

        started = time.perf_counter()
        raw = await AiService._call_gemini(
            settings=settings,
            system_instruction=(
                "Write clean, concise ITIL knowledge articles and operational runbooks with Overview, "
                "Symptoms/Prerequisites, Step-by-Step Procedure, and Verification sections."
            ),
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            json_schema=schema,
        )
        text = AiService._extract_text(raw)
        try:
            parsed = json.loads(text or "{}")
        except json.JSONDecodeError as exc:
            raise ValidationDomainError("AI returned malformed JSON KB draft.") from exc

        validated = validate_draft_kb_output(
            parsed,
            fallback_topic=payload.topic,
            fallback_category=payload.category or "Operations",
        )
        latency_ms = int((time.perf_counter() - started) * 1000)

        await AiService._record_log(
            db,
            principal=principal,
            action_type="draft_kb",
            model_name=settings.gemini_model,
            prompt_hash=hash_prompt(prompt),
            prompt_chars=len(prompt),
            response_chars=len(text),
            latency_ms=latency_ms,
            target_entity_type="knowledge_article",
            advisory_summary=f"Drafted KB article: {validated['title'][:120]}",
        )
        await db.commit()

        return DraftKbResponse(
            **validated,
            model=settings.gemini_model,
            generatedAt=datetime.now(timezone.utc).isoformat(),
        )

    @staticmethod
    async def wiki_assist(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: WikiAssistRequest,
        request: Request | None = None,
    ) -> WikiAssistResponse:
        settings = get_settings()
        await set_transaction_tenant_context(db, organization_id=principal.organization_id)
        await AiService._enforce_limits(db, principal=principal, settings=settings, action_type="wiki_assist")

        today = datetime.now(timezone.utc).date().isoformat()
        system_instruction = (
            f"You are an enterprise IT engineering documentation specialist for Scribble-IT System Wiki. "
            f"Today's date is {today}. Use Google Search grounding to retrieve verified facts, versions, and advisories. "
            "Never invent URLs or CVE numbers."
        )
        prompt = (
            f"Mode: {payload.mode}\nQuery: {payload.query}\n"
            f"Existing Title: {payload.existingTitle or 'N/A'}\n"
            f"Existing Section: {payload.existingSection or 'General'}\n"
            f"Existing Content:\n{(payload.existingContent or '')[:6000]}"
        )

        started = time.perf_counter()
        raw = await AiService._call_gemini(
            settings=settings,
            system_instruction=system_instruction,
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            enable_google_search=True,
        )
        summary = sanitize_text(AiService._extract_text(raw), max_len=12000)
        candidates = raw.get("candidates") or []
        grounding = candidates[0].get("groundingMetadata", {}) if candidates else {}
        raw_chunks = grounding.get("groundingChunks") or []

        sources: list[dict[str, str]] = []
        seen_uris: set[str] = set()
        for chunk in raw_chunks:
            web = chunk.get("web") if isinstance(chunk, dict) else None
            if not isinstance(web, dict):
                continue
            uri = sanitize_text(web.get("uri"), max_len=500)
            if uri.startswith(("https://", "http://")) and uri not in seen_uris:
                seen_uris.add(uri)
                sources.append(
                    {
                        "title": sanitize_text(web.get("title"), max_len=200, default=uri),
                        "uri": uri,
                    }
                )

        search_queries = [
            sanitize_text(q, max_len=200)
            for q in (grounding.get("webSearchQueries") or [])
            if sanitize_text(q, max_len=200)
        ]

        latency_ms = int((time.perf_counter() - started) * 1000)
        await AiService._record_log(
            db,
            principal=principal,
            action_type="wiki_assist",
            model_name=settings.gemini_model,
            prompt_hash=hash_prompt(prompt),
            prompt_chars=len(prompt),
            response_chars=len(summary),
            latency_ms=latency_ms,
            target_entity_type="wiki",
            advisory_summary=f"Wiki {payload.mode} ({len(sources)} grounded sources)",
        )
        await db.commit()

        return WikiAssistResponse(
            summary=summary,
            sources=sources,
            searchQueries=search_queries,
            model=settings.gemini_model,
            generatedAt=datetime.now(timezone.utc).isoformat(),
        )

    @staticmethod
    async def copilot(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: CopilotRequest,
        request: Request | None = None,
    ) -> CopilotResponse:
        settings = get_settings()
        await set_transaction_tenant_context(db, organization_id=principal.organization_id)
        await AiService._enforce_limits(db, principal=principal, settings=settings, action_type="copilot")

        system_instruction = (
            "You are the Scribble-IT Operations Copilot embedded in a multi-tenant Enterprise ITSM suite. "
            "You provide strictly advisory incident triage, CAB risk analysis, workflow guidance, and status summaries. "
            "You CANNOT independently approve service requests, cast CAB votes, modify IAM roles/permissions, "
            "or perform Super Admin governance actions—always direct users to perform those actions explicitly. "
            "Base workspace answers strictly on the provided Tenant Operational Snapshot.\n\n"
            f"=== TENANT SNAPSHOT ===\n{payload.tenantContext[:8000]}"
        )
        contents = [
            {"role": turn.role, "parts": [{"text": turn.text}]}
            for turn in payload.history[-10:]
        ]
        contents.append({"role": "user", "parts": [{"text": payload.message}]})

        started = time.perf_counter()
        raw = await AiService._call_gemini(
            settings=settings,
            system_instruction=system_instruction,
            contents=contents,
        )
        reply = sanitize_text(AiService._extract_text(raw), max_len=8000)
        latency_ms = int((time.perf_counter() - started) * 1000)

        await AiService._record_log(
            db,
            principal=principal,
            action_type="copilot",
            model_name=settings.gemini_model,
            prompt_hash=hash_prompt(payload.message),
            prompt_chars=len(payload.message) + len(payload.tenantContext),
            response_chars=len(reply),
            latency_ms=latency_ms,
            target_entity_type="copilot",
            advisory_summary=reply[:180],
        )
        await db.commit()

        return CopilotResponse(
            reply=reply,
            model=settings.gemini_model,
            generatedAt=datetime.now(timezone.utc).isoformat(),
        )

    @staticmethod
    async def get_usage_summary(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
    ) -> AiUsageSummaryOut:
        settings = get_settings()
        await set_transaction_tenant_context(db, organization_id=principal.organization_id)

        since = datetime.now(timezone.utc) - timedelta(hours=24)
        used_today = int(
            (
                await db.execute(
                    select(func.count(AiInteractionLog.id)).where(
                        AiInteractionLog.organization_id == principal.organization_id,
                        AiInteractionLog.status == "succeeded",
                        AiInteractionLog.created_at >= since,
                    )
                )
            ).scalar_one()
        )
        rows = (
            await db.execute(
                select(AiInteractionLog)
                .where(AiInteractionLog.organization_id == principal.organization_id)
                .order_by(AiInteractionLog.created_at.desc())
                .limit(50)
            )
        ).scalars().all()

        return AiUsageSummaryOut(
            organization_id=principal.organization_id,
            daily_limit=settings.ai_daily_org_limit,
            used_today=used_today,
            remaining_today=max(0, settings.ai_daily_org_limit - used_today),
            rate_limit_per_minute=settings.ai_rate_limit_per_minute,
            model=settings.gemini_model,
            recent_logs=[
                AiInteractionLogOut(
                    id=r.id,
                    actor_email=r.actor_email,
                    action_type=r.action_type,
                    model_name=r.model_name,
                    target_entity_type=r.target_entity_type,
                    target_entity_id=r.target_entity_id,
                    prompt_chars=r.prompt_chars,
                    response_chars=r.response_chars,
                    latency_ms=r.latency_ms,
                    status=r.status,
                    requires_human_approval=r.requires_human_approval,
                    advisory_summary=r.advisory_summary,
                    created_at=r.created_at,
                )
                for r in rows
            ],
        )
