from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenant import AuthenticatedPrincipal, require_super_admin
from app.db.session import get_db_session
from app.modules.governance.schemas import (
    DatabaseGovernanceOperationRequest,
    DatabaseGovernanceOperationResponse,
    OrganizationBrandingUpdateRequest,
    OrganizationModulesUpdateRequest,
    OrganizationSlaUpdateRequest,
    PlatformSettingOut,
    PlatformSettingUpsertRequest,
)
from app.modules.governance.service import GovernanceService
from app.modules.organizations.schemas import OrganizationOut

router = APIRouter(prefix="/governance", tags=["Super Admin Governance"])


@router.get("/settings", response_model=list[PlatformSettingOut])
async def list_platform_settings(
    principal: AuthenticatedPrincipal = Depends(require_super_admin()),
    db: AsyncSession = Depends(get_db_session),
) -> list[PlatformSettingOut]:
    rows = await GovernanceService.list_platform_settings(db, principal=principal)
    return [PlatformSettingOut.model_validate(r) for r in rows]


@router.put("/settings/{key}", response_model=PlatformSettingOut)
async def upsert_platform_setting(
    key: str,
    payload: PlatformSettingUpsertRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_super_admin()),
    db: AsyncSession = Depends(get_db_session),
) -> PlatformSettingOut:
    setting = await GovernanceService.upsert_platform_setting(
        db, principal=principal, key=key, payload=payload, request=request
    )
    return PlatformSettingOut.model_validate(setting)


@router.patch("/organizations/{organization_id}/branding", response_model=OrganizationOut)
async def update_organization_branding(
    organization_id: uuid.UUID,
    payload: OrganizationBrandingUpdateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_super_admin()),
    db: AsyncSession = Depends(get_db_session),
) -> OrganizationOut:
    org = await GovernanceService.update_organization_branding(
        db,
        principal=principal,
        organization_id=organization_id,
        payload=payload,
        request=request,
    )
    return OrganizationOut.model_validate(org)


@router.patch("/organizations/{organization_id}/sla", response_model=OrganizationOut)
async def update_organization_sla(
    organization_id: uuid.UUID,
    payload: OrganizationSlaUpdateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_super_admin()),
    db: AsyncSession = Depends(get_db_session),
) -> OrganizationOut:
    org = await GovernanceService.update_organization_sla(
        db,
        principal=principal,
        organization_id=organization_id,
        payload=payload,
        request=request,
    )
    return OrganizationOut.model_validate(org)


@router.patch("/organizations/{organization_id}/modules", response_model=OrganizationOut)
async def update_organization_modules(
    organization_id: uuid.UUID,
    payload: OrganizationModulesUpdateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_super_admin()),
    db: AsyncSession = Depends(get_db_session),
) -> OrganizationOut:
    org = await GovernanceService.update_organization_modules(
        db,
        principal=principal,
        organization_id=organization_id,
        payload=payload,
        request=request,
    )
    return OrganizationOut.model_validate(org)


@router.post("/database/operations", response_model=DatabaseGovernanceOperationResponse)
async def authorize_database_operation(
    payload: DatabaseGovernanceOperationRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_super_admin()),
    db: AsyncSession = Depends(get_db_session),
) -> DatabaseGovernanceOperationResponse:
    return await GovernanceService.authorize_database_operation(
        db, principal=principal, payload=payload, request=request
    )
