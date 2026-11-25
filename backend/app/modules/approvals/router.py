from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenant import (
    AuthenticatedPrincipal,
    get_current_principal,
    require_any_permission,
)
from app.db.session import get_db_session
from app.modules.approvals.schemas import (
    ApprovalAssignmentHistoryOut,
    ApprovalDecisionRequest,
    ApprovalItemCreateRequest,
    ApprovalItemOut,
    ApprovalReassignRequest,
    CabSeatAssignmentHistoryOut,
    CabSeatCreateRequest,
    CabSeatOut,
    CabSeatReassignRequest,
    CabVoteRequest,
)
from app.modules.approvals.service import ApprovalsService

router = APIRouter(prefix="/approvals", tags=["Approvals & CAB"])


@router.post("/requests", response_model=ApprovalItemOut, status_code=status.HTTP_201_CREATED)
async def create_approval_item(
    payload: ApprovalItemCreateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(
        require_any_permission("incidents:write", "workflows:manage", "iam:manage")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> ApprovalItemOut:
    item = await ApprovalsService.create_approval_item(
        db, principal=principal, payload=payload, request=request
    )
    return ApprovalItemOut.model_validate(item)


@router.get("/requests", response_model=list[ApprovalItemOut])
async def list_approval_items(
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> list[ApprovalItemOut]:
    items = await ApprovalsService.list_approval_items(db, principal=principal)
    return [ApprovalItemOut.model_validate(item) for item in items]


@router.post("/requests/{approval_id}/decision", response_model=ApprovalItemOut)
async def decide_approval_item(
    approval_id: uuid.UUID,
    payload: ApprovalDecisionRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> ApprovalItemOut:
    item = await ApprovalsService.decide_approval_item(
        db,
        principal=principal,
        approval_id=approval_id,
        payload=payload,
        request=request,
    )
    return ApprovalItemOut.model_validate(item)


@router.post("/requests/{approval_id}/reassign", response_model=ApprovalItemOut)
async def reassign_approval_item(
    approval_id: uuid.UUID,
    payload: ApprovalReassignRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(
        require_any_permission("iam:manage", "tenants:admin")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> ApprovalItemOut:
    item = await ApprovalsService.reassign_approval_item(
        db,
        principal=principal,
        approval_id=approval_id,
        payload=payload,
        request=request,
    )
    return ApprovalItemOut.model_validate(item)


@router.get("/requests/{approval_id}/history", response_model=list[ApprovalAssignmentHistoryOut])
async def list_approval_history(
    approval_id: uuid.UUID,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> list[ApprovalAssignmentHistoryOut]:
    rows = await ApprovalsService.list_approval_history(
        db, principal=principal, approval_id=approval_id
    )
    return [ApprovalAssignmentHistoryOut.model_validate(r) for r in rows]


@router.post("/cab-seats", response_model=CabSeatOut, status_code=status.HTTP_201_CREATED)
async def create_cab_seat(
    payload: CabSeatCreateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(
        require_any_permission("incidents:write", "workflows:manage", "iam:manage")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> CabSeatOut:
    seat = await ApprovalsService.create_cab_seat(
        db, principal=principal, payload=payload, request=request
    )
    return CabSeatOut.model_validate(seat)


@router.get("/cab-seats", response_model=list[CabSeatOut])
async def list_cab_seats(
    change_ref: str | None = Query(default=None, max_length=64),
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> list[CabSeatOut]:
    seats = await ApprovalsService.list_cab_seats(
        db, principal=principal, change_ref=change_ref
    )
    return [CabSeatOut.model_validate(s) for s in seats]


@router.post("/cab-seats/{seat_id}/vote", response_model=CabSeatOut)
async def cast_cab_vote(
    seat_id: uuid.UUID,
    payload: CabVoteRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> CabSeatOut:
    seat = await ApprovalsService.cast_cab_vote(
        db,
        principal=principal,
        seat_id=seat_id,
        payload=payload,
        request=request,
    )
    return CabSeatOut.model_validate(seat)


@router.post("/cab-seats/{seat_id}/reassign", response_model=CabSeatOut)
async def reassign_cab_seat(
    seat_id: uuid.UUID,
    payload: CabSeatReassignRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(
        require_any_permission("iam:manage", "tenants:admin")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> CabSeatOut:
    seat = await ApprovalsService.reassign_cab_seat(
        db,
        principal=principal,
        seat_id=seat_id,
        payload=payload,
        request=request,
    )
    return CabSeatOut.model_validate(seat)


@router.get("/cab-seats/{seat_id}/history", response_model=list[CabSeatAssignmentHistoryOut])
async def list_cab_seat_history(
    seat_id: uuid.UUID,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> list[CabSeatAssignmentHistoryOut]:
    rows = await ApprovalsService.list_cab_seat_history(
        db, principal=principal, seat_id=seat_id
    )
    return [CabSeatAssignmentHistoryOut.model_validate(r) for r in rows]
