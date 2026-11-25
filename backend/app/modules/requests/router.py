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
from app.modules.approvals.schemas import ApprovalDecisionRequest, ApprovalReassignRequest
from app.modules.requests.repository import ServiceRequestRepository
from app.modules.requests.schemas import (
    CatalogItemCreateRequest,
    CatalogItemOut,
    ServiceRequestActivityOut,
    ServiceRequestAssignRequest,
    ServiceRequestCreateRequest,
    ServiceRequestFulfillRequest,
    ServiceRequestOut,
)
from app.modules.requests.service import ServiceRequestService

router = APIRouter(prefix="/requests", tags=["Service Requests"])


@router.get("/catalog", response_model=list[CatalogItemOut])
async def list_catalog_items(
    category: str | None = Query(default=None),
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> list[CatalogItemOut]:
    rows = await ServiceRequestRepository.list_catalog(
        db, organization_id=principal.organization_id, category=category
    )
    return [CatalogItemOut.model_validate(r) for r in rows]


@router.post("/catalog", response_model=CatalogItemOut, status_code=status.HTTP_201_CREATED)
async def create_catalog_item(
    payload: CatalogItemCreateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> CatalogItemOut:
    row = await ServiceRequestService.create_catalog_item(
        db, principal=principal, payload=payload, request=request
    )
    return CatalogItemOut.model_validate(row)


@router.get("", response_model=PaginatedResponse[ServiceRequestOut])
async def list_service_requests(
    status_filter: str | None = Query(default=None, alias="status"),
    department: str | None = Query(default=None),
    search: str | None = Query(default=None, max_length=200),
    sort_by: str | None = Query(default="created_at"),
    sort_dir: Literal["asc", "desc"] = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    principal: AuthenticatedPrincipal = Depends(
        require_any_permission("incidents:read", "requests:approve")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[ServiceRequestOut]:
    items, meta = await ServiceRequestService.list_requests(
        db,
        principal=principal,
        status=status_filter,
        department=department,
        search=search,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse[ServiceRequestOut](items=items, meta=meta)


@router.post("", response_model=ServiceRequestOut, status_code=status.HTTP_201_CREATED)
async def create_service_request(
    payload: ServiceRequestCreateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> ServiceRequestOut:
    return await ServiceRequestService.create_request(
        db, principal=principal, payload=payload, request=request
    )


@router.get("/{request_id}", response_model=ServiceRequestOut)
async def get_service_request(
    request_id: uuid.UUID,
    principal: AuthenticatedPrincipal = Depends(
        require_any_permission("incidents:read", "requests:approve")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> ServiceRequestOut:
    return await ServiceRequestService.get_request(
        db, principal=principal, request_id=request_id
    )


@router.post("/{request_id}/assign", response_model=ServiceRequestOut)
async def assign_service_request(
    request_id: uuid.UUID,
    payload: ServiceRequestAssignRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> ServiceRequestOut:
    return await ServiceRequestService.assign_request(
        db, principal=principal, request_id=request_id, payload=payload, request=request
    )


@router.post("/{request_id}/fulfill", response_model=ServiceRequestOut)
async def fulfill_service_request(
    request_id: uuid.UUID,
    payload: ServiceRequestFulfillRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> ServiceRequestOut:
    return await ServiceRequestService.fulfill_request(
        db, principal=principal, request_id=request_id, payload=payload, request=request
    )


@router.post("/{request_id}/approvals/{approval_id}/decision", response_model=ServiceRequestOut)
async def decide_service_request_stage(
    request_id: uuid.UUID,
    approval_id: uuid.UUID,
    payload: ApprovalDecisionRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> ServiceRequestOut:
    return await ServiceRequestService.decide_stage(
        db,
        principal=principal,
        request_id=request_id,
        approval_id=approval_id,
        payload=payload,
        request=request,
    )


@router.post("/{request_id}/approvals/{approval_id}/reassign", response_model=ServiceRequestOut)
async def reassign_service_request_stage(
    request_id: uuid.UUID,
    approval_id: uuid.UUID,
    payload: ApprovalReassignRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> ServiceRequestOut:
    return await ServiceRequestService.reassign_stage(
        db,
        principal=principal,
        request_id=request_id,
        approval_id=approval_id,
        payload=payload,
        request=request,
    )


@router.get("/{request_id}/history", response_model=list[ServiceRequestActivityOut])
async def get_service_request_history(
    request_id: uuid.UUID,
    principal: AuthenticatedPrincipal = Depends(
        require_any_permission("incidents:read", "requests:approve")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> list[ServiceRequestActivityOut]:
    await ServiceRequestService.get_request(db, principal=principal, request_id=request_id)
    rows = await ServiceRequestRepository.list_activities(
        db, organization_id=principal.organization_id, request_id=request_id
    )
    return [ServiceRequestActivityOut.model_validate(r) for r in rows]
