from __future__ import annotations

import hashlib
import re
from typing import Any

# Hard governance boundary: AI is strictly advisory and may NEVER execute these actions autonomously
FORBIDDEN_AI_AUTONOMOUS_ACTIONS = frozenset(
    {
        "approve_service_request",
        "reject_service_request",
        "cast_cab_vote",
        "reassign_approver",
        "reassign_cab_voter",
        "modify_iam_permissions",
        "assign_role",
        "revoke_role",
        "suspend_user",
        "suspend_organization",
        "modify_tenant_branding",
        "toggle_tenant_module",
        "generate_device_enrollment_code",
    }
)

VALID_PRIORITIES = frozenset({"P1", "P2", "P3", "P4"})
VALID_CATEGORIES = frozenset({"hardware", "software", "network", "access", "security", "telephony"})
VALID_RISKS = frozenset({"low", "medium", "high", "critical"})
VALID_URGENCIES = frozenset({"critical", "elevated", "normal"})
VALID_CONFIDENCES = frozenset({"high", "medium", "low"})

_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


class AiGovernanceViolationError(ValueError):
    """Raised if an AI request attempts to trigger a restricted human-approval governance action."""


def assert_human_governance_boundary(requested_action: str | None) -> None:
    """
    Guarantee that no AI workflow can autonomously approve requests, cast CAB votes,
    change IAM permissions, or execute Super Admin governance mutations.
    """
    if not requested_action:
        return
    normalized = requested_action.strip().lower()
    if normalized in FORBIDDEN_AI_AUTONOMOUS_ACTIONS:
        raise AiGovernanceViolationError(
            f"AI cannot autonomously perform '{requested_action}'. "
            "Human authorization via designated approvers, CAB voters, IAM officers, or Super Admin is mandatory."
        )


def sanitize_text(value: Any, *, max_len: int = 4000, default: str = "") -> str:
    if value is None:
        return default
    cleaned = _CONTROL_CHAR_RE.sub("", str(value)).strip()
    if not cleaned:
        return default
    return cleaned[:max_len]


def sanitize_string_list(value: Any, *, max_items: int = 10, max_item_len: int = 400) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value[:max_items]:
        text = sanitize_text(item, max_len=max_item_len)
        if text:
            out.append(text)
    return out


def hash_prompt(prompt: str) -> str:
    """Store SHA-256 prompt digest in AI audit records instead of raw potentially sensitive ticket PII."""
    return hashlib.sha256(prompt.encode("utf-8")).hexdigest()


def validate_incident_triage_output(raw: dict[str, Any]) -> dict[str, Any]:
    priority = str(raw.get("recommendedPriority", "P3")).upper()
    if priority not in VALID_PRIORITIES:
        priority = "P3"

    category = str(raw.get("recommendedCategory", "software")).lower()
    if category not in VALID_CATEGORIES:
        category = "software"

    return {
        "recommendedPriority": priority,
        "recommendedCategory": category,
        "suggestedQueue": sanitize_text(raw.get("suggestedQueue"), max_len=128, default="Service Desk L2"),
        "rootCauseHypothesis": sanitize_text(raw.get("rootCauseHypothesis"), max_len=1000),
        "diagnosticSteps": sanitize_string_list(raw.get("diagnosticSteps"), max_items=8, max_item_len=300),
        "draftResolutionNote": sanitize_text(raw.get("draftResolutionNote"), max_len=2000),
        "draftCustomerReply": sanitize_text(raw.get("draftCustomerReply"), max_len=2000),
        "advisoryOnly": True,
        "requiresHumanApproval": True,
    }


def validate_change_assess_output(raw: dict[str, Any]) -> dict[str, Any]:
    risk = str(raw.get("assessedRisk", "medium")).lower()
    if risk not in VALID_RISKS:
        risk = "medium"

    try:
        score = int(round(float(raw.get("readinessScore", 70))))
    except (TypeError, ValueError):
        score = 70
    score = max(0, min(100, score))

    return {
        "assessedRisk": risk,
        "readinessScore": score,
        "riskFindings": sanitize_string_list(raw.get("riskFindings"), max_items=8, max_item_len=350),
        "missingControls": sanitize_string_list(raw.get("missingControls"), max_items=8, max_item_len=350),
        "recommendedCabGuidance": sanitize_text(raw.get("recommendedCabGuidance"), max_len=1200),
        "advisoryOnly": True,
        "requiresHumanApproval": True,
    }


def validate_draft_kb_output(raw: dict[str, Any], *, fallback_topic: str, fallback_category: str) -> dict[str, Any]:
    tags = sanitize_string_list(raw.get("tags"), max_items=8, max_item_len=48) or ["ITSM"]
    return {
        "title": sanitize_text(raw.get("title"), max_len=240, default=fallback_topic[:240]),
        "category": sanitize_text(raw.get("category"), max_len=80, default=fallback_category[:80]),
        "tags": tags,
        "content": sanitize_text(raw.get("content"), max_len=12000),
        "advisoryOnly": True,
        "requiresHumanApproval": True,
    }


def validate_triage_assistant_output(
    raw: dict[str, Any],
    *,
    allowed_kb_ids: set[str],
    kb_titles_by_id: dict[str, str],
    fallback_title: str,
    fallback_category: str,
) -> dict[str, Any]:
    urgency = str(raw.get("urgencySignal", "normal")).lower()
    if urgency not in VALID_URGENCIES:
        urgency = "normal"

    priority = str(raw.get("recommendedPriority", "P3")).upper()
    if priority not in VALID_PRIORITIES:
        priority = "P3"

    category = str(raw.get("recommendedCategory", "software")).lower()
    if category not in VALID_CATEGORIES:
        category = "software"

    matched_kb: list[dict[str, str]] = []
    raw_matches = raw.get("matchedKbArticles")
    if isinstance(raw_matches, list):
        for item in raw_matches:
            if not isinstance(item, dict):
                continue
            kb_id = str(item.get("kbId", "")).strip()
            if kb_id not in allowed_kb_ids:
                continue
            conf = str(item.get("matchConfidence", "medium")).lower()
            if conf not in VALID_CONFIDENCES:
                conf = "medium"
            matched_kb.append(
                {
                    "kbId": kb_id,
                    "title": kb_titles_by_id.get(kb_id) or sanitize_text(item.get("title"), max_len=200, default="Knowledge Article"),
                    "relevanceReason": sanitize_text(
                        item.get("relevanceReason"),
                        max_len=300,
                        default="Matches incident symptoms and operational category.",
                    ),
                    "matchConfidence": conf,
                }
            )
            if len(matched_kb) >= 3:
                break

    suggested_topics: list[dict[str, str]] = []
    raw_topics = raw.get("suggestedNewKbTopics")
    if isinstance(raw_topics, list):
        for item in raw_topics[:2]:
            if not isinstance(item, dict):
                continue
            suggested_topics.append(
                {
                    "title": sanitize_text(item.get("title"), max_len=200, default=f"Runbook: {fallback_title[:160]}"),
                    "category": sanitize_text(item.get("category"), max_len=80, default=fallback_category[:80]),
                    "summary": sanitize_text(
                        item.get("summary"),
                        max_len=400,
                        default="Recommended operational runbook for this incident class.",
                    ),
                    "draftBody": sanitize_text(item.get("draftBody"), max_len=4000),
                }
            )

    return {
        "realTimeSummary": sanitize_text(raw.get("realTimeSummary"), max_len=1200),
        "urgencySignal": urgency,
        "slaAssessment": sanitize_text(raw.get("slaAssessment"), max_len=400, default="Monitor SLA target."),
        "recommendedPriority": priority,
        "recommendedCategory": category,
        "suggestedQueue": sanitize_text(raw.get("suggestedQueue"), max_len=128, default="Service Desk L2"),
        "rootCauseHypothesis": sanitize_text(raw.get("rootCauseHypothesis"), max_len=1000),
        "nextSteps": sanitize_string_list(raw.get("nextSteps"), max_items=8, max_item_len=300),
        "matchedKbArticles": matched_kb,
        "suggestedNewKbTopics": suggested_topics,
        "draftResolutionNote": sanitize_text(raw.get("draftResolutionNote"), max_len=2000),
        "draftCustomerReply": sanitize_text(raw.get("draftCustomerReply"), max_len=2000),
        "advisoryOnly": True,
        "requiresHumanApproval": True,
    }
