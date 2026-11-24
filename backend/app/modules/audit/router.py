from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenant import AuthenticatedPrincipal, require_any_permission
from app.db.session import get_db_session
from app.modules.audit.schemas import AuditLogListResponse, AuditLogOut
from app.modules.audit.service import AuditService

router = APIRouter(prefix="/audit-logs", tags=["Audit"])


@router.get("", response_model=AuditLogListResponse)
async def list_audit_logs(
    organization_id: uuid.UUID | None = Query(default=None),
    module: str | None = Query(default=None, max_length=64),
    action: str | None = Query(default=None, max_length=64),
    outcome: str | None = Query(default=None, max_length=24),
    actor_email: str | None = Query(default=None, max_length=160),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    principal: AuthenticatedPrincipal = Depends(
        require_any_permission("audit:read", "iam:manage")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> AuditLogListResponse:
    items, total = await AuditService.list_logs(
        db,
        principal=principal,
        organization_id=organization_id,
        module=module,
        action=action,
        outcome=outcome,
        actor_email=actor_email,
        limit=limit,
        offset=offset,
    )
    return AuditLogListResponse(
        items=[AuditLogOut.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )
