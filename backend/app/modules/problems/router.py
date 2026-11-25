from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PaginatedResponse
from app.core.tenant import AuthenticatedPrincipal, require_permissions
from app.db.session import get_db_session
from app.modules.problems.schemas import (
    KnownErrorPublishRequest,
    ProblemCreateRequest,
    ProblemOut,
    ProblemUpdateRequest,
)
from app.modules.problems.service import ProblemService

router = APIRouter(prefix="/problems", tags=["Problems"])


@router.get("", response_model=PaginatedResponse[ProblemOut])
async def list_problems(
    status_filter: str | None = Query(default=None, alias="status"),
    severity: str | None = Query(default=None),
    is_known_error: bool | None = Query(default=None),
    search: str | None = Query(default=None, max_length=200),
    sort_by: str | None = Query(default="created_at"),
    sort_dir: Literal["asc", "desc"] = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:read")),
    db: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[ProblemOut]:
    items, meta = await ProblemService.list_problems(
        db,
        principal=principal,
        status=status_filter,
        severity=severity,
        is_known_error=is_known_error,
        search=search,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse[ProblemOut](items=items, meta=meta)


@router.post("", response_model=ProblemOut, status_code=status.HTTP_201_CREATED)
async def create_problem(
    payload: ProblemCreateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> ProblemOut:
    return await ProblemService.create_problem(
        db, principal=principal, payload=payload, request=request
    )


@router.get("/{problem_id}", response_model=ProblemOut)
async def get_problem(
    problem_id: uuid.UUID,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:read")),
    db: AsyncSession = Depends(get_db_session),
) -> ProblemOut:
    return await ProblemService.get_problem(
        db, principal=principal, problem_id=problem_id
    )


@router.patch("/{problem_id}", response_model=ProblemOut)
async def update_problem(
    problem_id: uuid.UUID,
    payload: ProblemUpdateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> ProblemOut:
    return await ProblemService.update_problem(
        db, principal=principal, problem_id=problem_id, payload=payload, request=request
    )


@router.post("/{problem_id}/known-error", response_model=ProblemOut)
async def publish_known_error(
    problem_id: uuid.UUID,
    payload: KnownErrorPublishRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> ProblemOut:
    return await ProblemService.publish_known_error(
        db, principal=principal, problem_id=problem_id, payload=payload, request=request
    )


@router.post("/{problem_id}/incidents/{incident_id}", response_model=ProblemOut)
async def link_problem_incident(
    problem_id: uuid.UUID,
    incident_id: uuid.UUID,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> ProblemOut:
    return await ProblemService.link_incident(
        db, principal=principal, problem_id=problem_id, incident_id=incident_id
    )


@router.delete(
    "/{problem_id}/incidents/{incident_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def unlink_problem_incident(
    problem_id: uuid.UUID,
    incident_id: uuid.UUID,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    await ProblemService.unlink_incident(
        db, principal=principal, problem_id=problem_id, incident_id=incident_id
    )
