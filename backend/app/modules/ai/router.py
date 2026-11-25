from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenant import AuthenticatedPrincipal, require_permissions
from app.db.session import get_db_session
from app.modules.ai.schemas import (
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
from app.modules.ai.service import AiService

router = APIRouter(prefix="/ai", tags=["AI Operations"])


@router.post("/triage-incident", response_model=IncidentTriageResponse)
async def triage_incident(
    payload: IncidentTriageRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:read")),
    db: AsyncSession = Depends(get_db_session),
) -> IncidentTriageResponse:
    return await AiService.triage_incident(db, principal=principal, payload=payload, request=request)


@router.post("/triage-assistant", response_model=TriageAssistantResponse)
async def triage_assistant(
    payload: TriageAssistantRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:read")),
    db: AsyncSession = Depends(get_db_session),
) -> TriageAssistantResponse:
    return await AiService.run_triage_assistant(db, principal=principal, payload=payload, request=request)


@router.post("/assess-change", response_model=ChangeAssessResponse)
async def assess_change(
    payload: ChangeAssessRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:read")),
    db: AsyncSession = Depends(get_db_session),
) -> ChangeAssessResponse:
    return await AiService.assess_change(db, principal=principal, payload=payload, request=request)


@router.post("/draft-kb", response_model=DraftKbResponse)
async def draft_kb(
    payload: DraftKbRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> DraftKbResponse:
    return await AiService.draft_kb(db, principal=principal, payload=payload, request=request)


@router.post("/wiki-assist", response_model=WikiAssistResponse)
async def wiki_assist(
    payload: WikiAssistRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:read")),
    db: AsyncSession = Depends(get_db_session),
) -> WikiAssistResponse:
    return await AiService.wiki_assist(db, principal=principal, payload=payload, request=request)


@router.post("/copilot", response_model=CopilotResponse)
async def copilot(
    payload: CopilotRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:read")),
    db: AsyncSession = Depends(get_db_session),
) -> CopilotResponse:
    return await AiService.copilot(db, principal=principal, payload=payload, request=request)


@router.get("/usage", response_model=AiUsageSummaryOut)
async def get_ai_usage(
    principal: AuthenticatedPrincipal = Depends(require_permissions("audit:read")),
    db: AsyncSession = Depends(get_db_session),
) -> AiUsageSummaryOut:
    return await AiService.get_usage_summary(db, principal=principal)
