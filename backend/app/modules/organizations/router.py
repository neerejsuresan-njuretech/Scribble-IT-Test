from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.tenant import (
    AuthenticatedPrincipal,
    get_current_principal,
    require_any_permission,
    require_super_admin,
)
from app.db.session import get_db_session
from app.modules.organizations.schemas import (
    OrganizationCreateRequest,
    OrganizationListResponse,
    OrganizationMemberCreateRequest,
    OrganizationMemberOut,
    OrganizationOut,
    OrganizationSwitchRequest,
    OrganizationSwitchResponse,
    OrganizationUpdateRequest,
)
from app.modules.organizations.service import OrganizationService

router = APIRouter(prefix="/organizations", tags=["Organizations"])


@router.get("", response_model=OrganizationListResponse)
async def list_organizations(
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> OrganizationListResponse:
    orgs = await OrganizationService.list_organizations(db, principal=principal)
    return OrganizationListResponse(
        items=[OrganizationOut.model_validate(org) for org in orgs],
        total=len(orgs),
    )


@router.post("", response_model=OrganizationOut, status_code=status.HTTP_201_CREATED)
async def create_organization(
    payload: OrganizationCreateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_super_admin()),
    db: AsyncSession = Depends(get_db_session),
) -> OrganizationOut:
    org = await OrganizationService.create_organization(
        db,
        principal=principal,
        payload=payload,
        request=request,
    )
    return OrganizationOut.model_validate(org)


@router.post("/switch", response_model=OrganizationSwitchResponse)
async def switch_organization(
    payload: OrganizationSwitchRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> OrganizationSwitchResponse:
    return await OrganizationService.switch_organization(
        db,
        principal=principal,
        target_organization_id=payload.organization_id,
        settings=settings,
        request=request,
    )


@router.get("/{organization_id}", response_model=OrganizationOut)
async def get_organization(
    organization_id: uuid.UUID,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> OrganizationOut:
    org = await OrganizationService.get_organization(
        db,
        principal=principal,
        organization_id=organization_id,
    )
    return OrganizationOut.model_validate(org)


@router.patch("/{organization_id}", response_model=OrganizationOut)
async def update_organization(
    organization_id: uuid.UUID,
    payload: OrganizationUpdateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_super_admin()),
    db: AsyncSession = Depends(get_db_session),
) -> OrganizationOut:
    org = await OrganizationService.update_organization(
        db,
        principal=principal,
        organization_id=organization_id,
        payload=payload,
        request=request,
    )
    return OrganizationOut.model_validate(org)


@router.post(
    "/{organization_id}/members",
    response_model=OrganizationMemberOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_organization_member(
    organization_id: uuid.UUID,
    payload: OrganizationMemberCreateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(
        require_any_permission("iam:manage", "tenants:admin")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> OrganizationMemberOut:
    return await OrganizationService.add_member(
        db,
        principal=principal,
        organization_id=organization_id,
        payload=payload,
        request=request,
    )


@router.delete(
    "/{organization_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_organization_member(
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(
        require_any_permission("iam:manage", "tenants:admin")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    await OrganizationService.remove_member(
        db,
        principal=principal,
        organization_id=organization_id,
        user_id=user_id,
        request=request,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
