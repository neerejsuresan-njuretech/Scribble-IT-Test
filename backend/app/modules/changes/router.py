from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PaginatedResponse
from app.core.tenant import (
    AuthenticatedPrincipal,
    get_current_principal,
    require_any_permission,
    require_permissions,
)
from app.db.session import get_db_session
from app.modules.approvals.schemas import CabSeatReassignRequest, CabVoteRequest
from app.modules.changes.repository import ChangeRepository
from app.modules.changes.schemas import (
    CabMemberSpec,
    ChangeActivityOut,
    ChangeCreateRequest,
    ChangeRequestOut,
    ChangeStatusTransitionRequest,
    ChangeUpdateRequest,
)
from app.modules.changes.service import ChangeService

router = APIRouter(prefix="/changes", tags=["Change Management"])


@router.get("", response_model=PaginatedResponse[ChangeRequestOut])
async def list_changes(
    status_filter: str | None = Query(default=None, alias="status"),
    change_type: str | None = Query(default=None),
    risk_score: str | None = Query(default=None),
    search: str | None = Query(default=None, max_length=200),
    sort_by: str | None = Query(default="created_at"),
    sort_dir: Literal["asc", "desc"] = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    principal: AuthenticatedPrincipal = Depends(
        require_any_permission("incidents:read", "changes:cab_vote")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[ChangeRequestOut]:
    items, meta = await ChangeService.list_changes(
        db,
        principal=principal,
        status=status_filter,
        change_type=change_type,
        risk_score=risk_score,
        search=search,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse[ChangeRequestOut](items=items, meta=meta)


@router.post("", response_model=ChangeRequestOut, status_code=status.HTTP_201_CREATED)
async def create_change(
    payload: ChangeCreateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> ChangeRequestOut:
    return await ChangeService.create_change(
        db, principal=principal, payload=payload, request=request
    )


@router.get("/{change_id}", response_model=ChangeRequestOut)
async def get_change(
    change_id: uuid.UUID,
    principal: AuthenticatedPrincipal = Depends(
        require_any_permission("incidents:read", "changes:cab_vote")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> ChangeRequestOut:
    return await ChangeService.get_change(db, principal=principal, change_id=change_id)


@router.patch("/{change_id}", response_model=ChangeRequestOut)
async def update_change(
    change_id: uuid.UUID,
    payload: ChangeUpdateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> ChangeRequestOut:
    return await ChangeService.update_change(
        db, principal=principal, change_id=change_id, payload=payload, request=request
    )


@router.post("/{change_id}/status", response_model=ChangeRequestOut)
async def transition_change_status(
    change_id: uuid.UUID,
    payload: ChangeStatusTransitionRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> ChangeRequestOut:
    return await ChangeService.transition_status(
        db, principal=principal, change_id=change_id, payload=payload, request=request
    )


@router.post("/{change_id}/cab-seats", response_model=ChangeRequestOut, status_code=status.HTTP_201_CREATED)
async def add_cab_seat(
    change_id: uuid.UUID,
    payload: CabMemberSpec,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> ChangeRequestOut:
    return await ChangeService.add_cab_seat(
        db, principal=principal, change_id=change_id, payload=payload, request=request
    )


@router.post("/{change_id}/cab-seats/{seat_id}/vote", response_model=ChangeRequestOut)
async def cast_change_cab_vote(
    change_id: uuid.UUID,
    seat_id: uuid.UUID,
    payload: CabVoteRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> ChangeRequestOut:
    return await ChangeService.cast_cab_vote(
        db,
        principal=principal,
        change_id=change_id,
        seat_id=seat_id,
        payload=payload,
        request=request,
    )


@router.post("/{change_id}/cab-seats/{seat_id}/reassign", response_model=ChangeRequestOut)
async def reassign_change_cab_seat(
    change_id: uuid.UUID,
    seat_id: uuid.UUID,
    payload: CabSeatReassignRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> ChangeRequestOut:
    return await ChangeService.reassign_cab_seat(
        db,
        principal=principal,
        change_id=change_id,
        seat_id=seat_id,
        payload=payload,
        request=request,
    )


@router.get("/{change_id}/history", response_model=list[ChangeActivityOut])
async def get_change_history(
    change_id: uuid.UUID,
    principal: AuthenticatedPrincipal = Depends(
        require_any_permission("incidents:read", "changes:cab_vote")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> list[ChangeActivityOut]:
    await ChangeService.get_change(db, principal=principal, change_id=change_id)
    rows = await ChangeRepository.list_activities(
        db, organization_id=principal.organization_id, change_id=change_id
    )
    return [ChangeActivityOut.model_validate(r) for r in rows]
