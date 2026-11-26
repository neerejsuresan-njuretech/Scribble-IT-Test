from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenant import (
    AuthenticatedPrincipal,
    require_iam_portal,
    require_permissions,
)
from app.db.session import get_db_session
from app.modules.iam.schemas import (
    DeviceEnrollmentCodeCreateRequest,
    DeviceEnrollmentCodeOut,
    DeviceMdmAttestRequest,
    DeviceTrustEventOut,
    IamMemberOut,
    ManagedDeviceOut,
    RoleCreateRequest,
    RoleOut,
    UpdateMemberRolesRequest,
)
from app.modules.iam.service import IAMService

router = APIRouter(prefix="/iam", tags=["IAM & Device Trust"])


@router.get("/roles", response_model=list[RoleOut])
async def list_roles(
    principal: AuthenticatedPrincipal = Depends(require_permissions("iam:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> list[RoleOut]:
    roles = await IAMService.list_roles(db, principal=principal)
    return [
        RoleOut(
            id=r.id,
            organization_id=r.organization_id,
            slug=r.slug,
            name=r.name,
            description=r.description,
            is_system=r.is_system,
            sso_only=r.sso_only,
            mfa_required=r.mfa_required,
            permissions=[p.scope for p in r.permissions],
        )
        for r in roles
    ]


@router.post("/roles", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
async def create_role(
    payload: RoleCreateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("iam:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> RoleOut:
    role = await IAMService.create_role(db, principal=principal, payload=payload, request=request)
    return RoleOut(
        id=role.id,
        organization_id=role.organization_id,
        slug=role.slug,
        name=role.name,
        description=role.description,
        is_system=role.is_system,
        sso_only=role.sso_only,
        mfa_required=role.mfa_required,
        permissions=[p.scope for p in role.permissions],
    )


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: uuid.UUID,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("iam:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    await IAMService.delete_role(db, principal=principal, role_id=role_id, request=request)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/members", response_model=list[IamMemberOut])
async def list_members(
    principal: AuthenticatedPrincipal = Depends(require_permissions("iam:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> list[IamMemberOut]:
    return await IAMService.list_members(db, principal=principal)


@router.patch("/members/{user_id}/suspend", status_code=status.HTTP_204_NO_CONTENT)
async def suspend_member(
    user_id: uuid.UUID,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("iam:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    await IAMService.suspend_member(db, principal=principal, user_id=user_id, request=request)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/members/{user_id}/restore", status_code=status.HTTP_204_NO_CONTENT)
async def restore_member(
    user_id: uuid.UUID,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("iam:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    await IAMService.restore_member(db, principal=principal, user_id=user_id, request=request)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/members/{user_id}/roles", status_code=status.HTTP_204_NO_CONTENT)
@router.put("/members/{user_id}/roles", status_code=status.HTTP_204_NO_CONTENT)
async def update_member_roles(
    user_id: uuid.UUID,
    payload: UpdateMemberRolesRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("iam:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    await IAMService.update_member_roles(
        db,
        principal=principal,
        user_id=user_id,
        role_slugs=payload.role_slugs,
        sso_only=payload.sso_only,
        mfa_required=payload.mfa_required,
        request=request,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/device-codes", status_code=status.HTTP_201_CREATED)
async def generate_device_enrollment_code(
    payload: DeviceEnrollmentCodeCreateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_iam_portal()),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    code_row, raw_code = await IAMService.generate_device_enrollment_code(
        db, principal=principal, payload=payload, request=request
    )
    return {
        "id": str(code_row.id),
        "enrollment_code": raw_code,  # Shown ONLY once upon generation
        "code_prefix": code_row.code_prefix,
        "assigned_email": code_row.assigned_email,
        "mdm_provider": code_row.mdm_provider,
        "expires_at": code_row.expires_at,
    }


@router.get("/device-codes", response_model=list[DeviceEnrollmentCodeOut])
async def list_device_enrollment_codes(
    principal: AuthenticatedPrincipal = Depends(require_iam_portal()),
    db: AsyncSession = Depends(get_db_session),
) -> list[DeviceEnrollmentCodeOut]:
    codes = await IAMService.list_device_enrollment_codes(db, principal=principal)
    return [DeviceEnrollmentCodeOut.model_validate(c) for c in codes]


@router.delete("/device-codes/{code_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_device_enrollment_code(
    code_id: uuid.UUID,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_iam_portal()),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    await IAMService.revoke_device_enrollment_code(
        db, principal=principal, code_id=code_id, request=request
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/devices", response_model=list[ManagedDeviceOut])
async def list_managed_devices(
    principal: AuthenticatedPrincipal = Depends(require_permissions("iam:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> list[ManagedDeviceOut]:
    devices = await IAMService.list_managed_devices(db, principal=principal)
    return [ManagedDeviceOut.model_validate(d) for d in devices]


@router.post("/devices/{device_id}/verify-mdm", response_model=ManagedDeviceOut)
async def attest_device_mdm(
    device_id: uuid.UUID,
    payload: DeviceMdmAttestRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("iam:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> ManagedDeviceOut:
    device = await IAMService.attest_device_mdm(
        db,
        principal=principal,
        device_id=device_id,
        mdm_provider=payload.mdm_provider,
        mdm_authority_ref=payload.mdm_authority_ref,
        request=request,
    )
    return ManagedDeviceOut.model_validate(device)


@router.post("/devices/{device_id}/revoke", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_managed_device(
    device_id: uuid.UUID,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("iam:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    await IAMService.revoke_managed_device(
        db, principal=principal, device_id=device_id, request=request
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/devices/{device_id}/history", response_model=list[DeviceTrustEventOut])
async def list_device_trust_history(
    device_id: uuid.UUID,
    principal: AuthenticatedPrincipal = Depends(require_permissions("iam:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> list[DeviceTrustEventOut]:
    events = await IAMService.list_device_trust_history(
        db, principal=principal, device_id=device_id
    )
    return [DeviceTrustEventOut.model_validate(e) for e in events]
