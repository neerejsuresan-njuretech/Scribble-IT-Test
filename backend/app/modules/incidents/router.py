from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PaginatedResponse
from app.core.tenant import (
    AuthenticatedPrincipal,
    get_current_principal,
    require_permissions,
)
from app.db.session import get_db_session
from app.modules.incidents.repository import IncidentRepository
from app.modules.incidents.schemas import (
    IncidentActivityCreateRequest,
    IncidentActivityOut,
    IncidentAssignRequest,
    IncidentAttachmentCreateRequest,
    IncidentAttachmentOut,
    IncidentCloseRequest,
    IncidentCreateRequest,
    IncidentOut,
    IncidentRelationCreateRequest,
    IncidentRelationOut,
    IncidentResolveRequest,
    IncidentUpdateRequest,
)
from app.modules.incidents.service import IncidentService

router = APIRouter(prefix="/incidents", tags=["Incidents"])


@router.get("", response_model=PaginatedResponse[IncidentOut])
async def list_incidents(
    status_filter: str | None = Query(default=None, alias="status"),
    priority: str | None = Query(default=None),
    category: str | None = Query(default=None),
    assignee_user_id: uuid.UUID | None = Query(default=None),
    sla_breached: bool | None = Query(default=None),
    search: str | None = Query(default=None, max_length=200),
    sort_by: str | None = Query(default="created_at"),
    sort_dir: Literal["asc", "desc"] = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:read")),
    db: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[IncidentOut]:
    rows, meta = await IncidentService.list_incidents(
        db,
        principal=principal,
        status=status_filter,
        priority=priority,
        category=category,
        assignee_user_id=assignee_user_id,
        sla_breached=sla_breached,
        search=search,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse[IncidentOut](
        items=[IncidentOut.model_validate(r) for r in rows],
        meta=meta,
    )


@router.post("", response_model=IncidentOut, status_code=status.HTTP_201_CREATED)
async def create_incident(
    payload: IncidentCreateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> IncidentOut:
    # End users can open self-service tickets; corporate staff need incidents:read/write
    row = await IncidentService.create_incident(
        db, principal=principal, payload=payload, request=request
    )
    return IncidentOut.model_validate(row)


@router.get("/{incident_id}", response_model=IncidentOut)
async def get_incident(
    incident_id: uuid.UUID,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:read")),
    db: AsyncSession = Depends(get_db_session),
) -> IncidentOut:
    row = await IncidentService.get_incident(
        db, principal=principal, incident_id=incident_id
    )
    return IncidentOut.model_validate(row)


@router.patch("/{incident_id}", response_model=IncidentOut)
async def update_incident(
    incident_id: uuid.UUID,
    payload: IncidentUpdateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> IncidentOut:
    row = await IncidentService.update_incident(
        db, principal=principal, incident_id=incident_id, payload=payload, request=request
    )
    return IncidentOut.model_validate(row)


@router.post("/{incident_id}/assign", response_model=IncidentOut)
async def assign_incident(
    incident_id: uuid.UUID,
    payload: IncidentAssignRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> IncidentOut:
    row = await IncidentService.assign_incident(
        db, principal=principal, incident_id=incident_id, payload=payload, request=request
    )
    return IncidentOut.model_validate(row)


@router.post("/{incident_id}/resolve", response_model=IncidentOut)
async def resolve_incident(
    incident_id: uuid.UUID,
    payload: IncidentResolveRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> IncidentOut:
    row = await IncidentService.resolve_incident(
        db, principal=principal, incident_id=incident_id, payload=payload, request=request
    )
    return IncidentOut.model_validate(row)


@router.post("/{incident_id}/close", response_model=IncidentOut)
async def close_incident(
    incident_id: uuid.UUID,
    payload: IncidentCloseRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> IncidentOut:
    row = await IncidentService.close_incident(
        db, principal=principal, incident_id=incident_id, payload=payload, request=request
    )
    return IncidentOut.model_validate(row)


@router.get("/{incident_id}/activities", response_model=list[IncidentActivityOut])
async def list_incident_activities(
    incident_id: uuid.UUID,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:read")),
    db: AsyncSession = Depends(get_db_session),
) -> list[IncidentActivityOut]:
    await IncidentService.get_incident(db, principal=principal, incident_id=incident_id)
    rows = await IncidentRepository.list_activities(
        db, organization_id=principal.organization_id, incident_id=incident_id
    )
    return [IncidentActivityOut.model_validate(r) for r in rows]


@router.post(
    "/{incident_id}/activities",
    response_model=IncidentActivityOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_incident_activity(
    incident_id: uuid.UUID,
    payload: IncidentActivityCreateRequest,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:read")),
    db: AsyncSession = Depends(get_db_session),
) -> IncidentActivityOut:
    row = await IncidentService.add_activity(
        db, principal=principal, incident_id=incident_id, payload=payload
    )
    return IncidentActivityOut.model_validate(row)


@router.post(
    "/{incident_id}/attachments",
    response_model=IncidentAttachmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_incident_attachment(
    incident_id: uuid.UUID,
    payload: IncidentAttachmentCreateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:read")),
    db: AsyncSession = Depends(get_db_session),
) -> IncidentAttachmentOut:
    row = await IncidentService.add_attachment(
        db, principal=principal, incident_id=incident_id, payload=payload, request=request
    )
    return IncidentAttachmentOut.model_validate(row)


@router.post(
    "/{incident_id}/relations",
    response_model=IncidentRelationOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_incident_relation(
    incident_id: uuid.UUID,
    payload: IncidentRelationCreateRequest,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> IncidentRelationOut:
    row = await IncidentService.add_relation(
        db, principal=principal, incident_id=incident_id, payload=payload
    )
    return IncidentRelationOut.model_validate(row)


@router.delete(
    "/{incident_id}/relations/{relation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_incident_relation(
    incident_id: uuid.UUID,
    relation_id: uuid.UUID,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    await IncidentService.delete_relation(
        db, principal=principal, incident_id=incident_id, relation_id=relation_id
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
