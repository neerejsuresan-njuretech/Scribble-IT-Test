from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.tenant import AuthenticatedPrincipal, get_current_principal
from app.db.session import get_db_session
from app.modules.auth.schemas import (
    DeviceEnrollRequest,
    DeviceSsoLoginRequest,
    LoginRequest,
    MfaEnrollResponse,
    MfaVerifyRequest,
    RefreshTokenRequest,
    RegisterRequest,
    TokenResponse,
)
from app.modules.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _build_token_response(
    access_token: str,
    refresh_token: str,
    session_row,
    org,
    membership,
    user,
) -> TokenResponse:
    role_scopes = {
        perm.scope
        for role in membership.roles
        if role.deleted_at is None
        for perm in role.permissions
    }
    from app.core.permissions import compute_effective_permissions, derive_clearance_tier

    effective_perms = compute_effective_permissions(
        is_platform_super_admin=user.is_platform_super_admin,
        portal_type=membership.portal_type,
        role_scopes=role_scopes,
    )
    clearance = derive_clearance_tier(
        is_platform_super_admin=user.is_platform_super_admin,
        portal_type=membership.portal_type,
        permissions=effective_perms,
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=15 * 60,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        organization_id=org.id,
        organization_slug=org.slug,
        portal_type=membership.portal_type,
        clearance_tier=clearance,
        is_platform_super_admin=user.is_platform_super_admin,
        permissions=sorted(effective_perms),
        mfa_required=membership.mfa_required,
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    user, membership = await AuthService.register(db, payload=payload, settings=settings, request=request)
    # Automatically log in the newly registered user
    class DummyLogin:
        email = payload.email
        password = payload.password
        portal_type = membership.portal_type
        organization_id = membership.organization_id
        totp_code = None
        backup_code = None

    access_token, refresh_token, session_row, org, mem = await AuthService.login(
        db, payload=DummyLogin(), settings=settings, request=request
    )
    return _build_token_response(access_token, refresh_token, session_row, org, mem, user)


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    access_token, refresh_token, session_row, org, membership = await AuthService.login(
        db, payload=payload, settings=settings, request=request
    )
    user = session_row.user
    return _build_token_response(access_token, refresh_token, session_row, org, membership, user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    payload: RefreshTokenRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    access_token, refresh_token, session_row, org, membership = await AuthService.refresh_tokens(
        db, raw_refresh_token=payload.refresh_token, settings=settings, request=request
    )
    user = session_row.user
    return _build_token_response(access_token, refresh_token, session_row, org, membership, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    await AuthService.logout(db, principal=principal, request=request)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/mfa/enroll", response_model=MfaEnrollResponse)
async def enroll_mfa(
    request: Request,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> MfaEnrollResponse:
    result = await AuthService.enroll_mfa(db, principal=principal, settings=settings, request=request)
    return MfaEnrollResponse(**result)


@router.post("/mfa/verify", status_code=status.HTTP_204_NO_CONTENT)
async def verify_mfa(
    payload: MfaVerifyRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> Response:
    await AuthService.verify_mfa_enrollment(
        db, principal=principal, code=payload.code, settings=settings, request=request
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/device/enroll", status_code=status.HTTP_201_CREATED)
async def enroll_device(
    payload: DeviceEnrollRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
):
    device = await AuthService.enroll_device(db, principal=principal, payload=payload, request=request)
    return {
        "device_id": device.id,
        "hostname": device.hostname,
        "certificate_thumbprint": device.certificate_thumbprint,
        "status": device.status,
    }


@router.post("/device/sso-login", response_model=TokenResponse)
async def device_sso_login(
    payload: DeviceSsoLoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    access_token, refresh_token, session_row, org, membership = await AuthService.device_sso_login(
        db, payload=payload, settings=settings, request=request
    )
    user = session_row.user
    return _build_token_response(access_token, refresh_token, session_row, org, membership, user)


@router.get("/me")
async def get_me(
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
):
    return {
        "user_id": principal.user_id,
        "email": principal.email,
        "full_name": principal.full_name,
        "organization_id": principal.organization_id,
        "organization_slug": principal.organization_slug,
        "membership_id": principal.membership_id,
        "portal_type": principal.portal_type,
        "clearance_tier": principal.clearance_tier,
        "is_platform_super_admin": principal.is_platform_super_admin,
        "permissions": sorted(principal.permissions),
        "sso_only": principal.sso_only,
        "mfa_required": principal.mfa_required,
        "device_managed": principal.device_managed,
        "device_id": principal.device_id,
    }
