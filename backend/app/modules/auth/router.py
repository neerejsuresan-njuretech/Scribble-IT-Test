from __future__ import annotations

import uuid
from types import SimpleNamespace

from fastapi import APIRouter, Body, Depends, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.permissions import compute_effective_permissions, derive_clearance_tier
from app.core.tenant import AuthenticatedPrincipal, get_current_principal
from app.db.session import get_db_session
from app.modules.auth.schemas import (
    DeviceEnrollRequest,
    DeviceEnrollResponse,
    DeviceListResponse,
    DeviceSsoLoginRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LogoutRequest,
    MfaEnrollResponse,
    MfaVerifyRequest,
    RefreshTokenRequest,
    RegisterRequest,
    ResetPasswordRequest,
    SessionListResponse,
    TokenResponse,
    UserSessionOut,
    VerifyEmailRequest,
)
from app.modules.auth.service import AuthService
from app.modules.iam.schemas import ManagedDeviceOut

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _build_token_response(
    *,
    access_token: str,
    refresh_token: str,
    expires_in: int,
    session_row,
    org,
    membership,
    user,
    mfa_enrolled: bool,
) -> TokenResponse:
    role_scopes = {
        perm.scope
        for role in membership.roles
        if role.deleted_at is None
        for perm in role.permissions
    }
    effective_perms = compute_effective_permissions(
        is_platform_super_admin=user.is_platform_super_admin,
        portal_type=session_row.portal_type,
        role_scopes=role_scopes,
    )
    clearance = derive_clearance_tier(
        is_platform_super_admin=user.is_platform_super_admin,
        portal_type=session_row.portal_type,
        permissions=effective_perms,
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
        session_id=session_row.id,
        client_type=getattr(session_row, "client_type", "web"),
        client_platform=getattr(session_row, "client_platform", "web"),
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        organization_id=org.id,
        organization_slug=org.slug,
        portal_type=session_row.portal_type,
        clearance_tier=clearance,
        is_platform_super_admin=user.is_platform_super_admin,
        permissions=sorted(effective_perms),
        mfa_required=membership.mfa_required,
        mfa_enrolled=mfa_enrolled,
        device_managed=session_row.device_id is not None,
        email_verified=user.email_verified,
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    user, _org, membership, _verify_token = await AuthService.register(
        db, payload=payload, settings=settings, request=request
    )
    login_req = SimpleNamespace(
        email=payload.email,
        password=payload.password,
        portal_type=membership.portal_type,
        organization_id=membership.organization_id,
        totp_code=None,
        backup_code=None,
    )
    access_token, refresh_token, ttl, session_row, org, mem, logged_user, mfa_enrolled = (
        await AuthService.login(db, payload=login_req, settings=settings, request=request)
    )
    return _build_token_response(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ttl,
        session_row=session_row,
        org=org,
        membership=mem,
        user=logged_user,
        mfa_enrolled=mfa_enrolled,
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    access_token, refresh_token, ttl, session_row, org, membership, user, mfa_enrolled = (
        await AuthService.login(db, payload=payload, settings=settings, request=request)
    )
    return _build_token_response(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ttl,
        session_row=session_row,
        org=org,
        membership=membership,
        user=user,
        mfa_enrolled=mfa_enrolled,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    payload: RefreshTokenRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    access_token, refresh_token, ttl, session_row, org, membership, user, mfa_enrolled = (
        await AuthService.refresh_tokens(
            db,
            raw_refresh_token=payload.refresh_token,
            settings=settings,
            payload=payload,
            request=request,
        )
    )
    return _build_token_response(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ttl,
        session_row=session_row,
        org=org,
        membership=membership,
        user=user,
        mfa_enrolled=mfa_enrolled,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    payload: LogoutRequest | None = Body(default=None),
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    await AuthService.logout(
        db,
        principal=principal,
        revoke_push_tokens=payload.revoke_push_tokens if payload is not None else True,
        request=request,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> ForgotPasswordResponse:
    token = await AuthService.request_password_reset(
        db, email=str(payload.email), settings=settings, request=request
    )
    return ForgotPasswordResponse(
        message="If an active account matches that email, password reset instructions have been issued.",
        reset_token=token,
    )


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    await AuthService.reset_password(
        db, raw_token=payload.token, new_password=payload.new_password, request=request
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/verify-email")
async def verify_email(
    payload: VerifyEmailRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    user = await AuthService.verify_email(db, raw_token=payload.token, request=request)
    return {"user_id": str(user.id), "email": user.email, "email_verified": user.email_verified}


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> SessionListResponse:
    sessions = await AuthService.list_sessions(db, principal=principal)
    items = [
        UserSessionOut(
            id=s.id,
            organization_id=s.organization_id,
            portal_type=s.portal_type,
            auth_method=s.auth_method,
            client_type=getattr(s, "client_type", "web"),
            client_platform=getattr(s, "client_platform", "web"),
            app_version=getattr(s, "app_version", None),
            app_id=getattr(s, "app_id", None),
            device_name=getattr(s, "device_name", None),
            ip_address=s.ip_address,
            user_agent=s.user_agent,
            device_id=s.device_id,
            created_at=s.created_at,
            expires_at=s.expires_at,
            last_used_at=s.last_used_at,
            revoked_at=s.revoked_at,
            revocation_reason=s.revocation_reason,
            is_current=(s.id == principal.session_id),
        )
        for s in sessions
    ]
    return SessionListResponse(items=items, total=len(items))


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_session(
    session_id: uuid.UUID,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    await AuthService.revoke_session(
        db, principal=principal, session_id=session_id, request=request
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/sessions/revoke-all")
async def revoke_all_sessions(
    request: Request,
    keep_current: bool = Query(default=False),
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, int]:
    revoked = await AuthService.revoke_all_sessions(
        db, principal=principal, keep_current=keep_current, request=request
    )
    return {"revoked_count": revoked}


@router.post("/mfa/enroll", response_model=MfaEnrollResponse)
async def enroll_mfa(
    request: Request,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> MfaEnrollResponse:
    result = await AuthService.enroll_mfa(
        db, principal=principal, settings=settings, request=request
    )
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


@router.post("/device/enroll", response_model=DeviceEnrollResponse, status_code=status.HTTP_201_CREATED)
async def enroll_device(
    payload: DeviceEnrollRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> DeviceEnrollResponse:
    device = await AuthService.enroll_device(
        db, principal=principal, payload=payload, settings=settings, request=request
    )
    return DeviceEnrollResponse(
        device_id=device.id,
        hostname=device.hostname,
        os_platform=device.os_platform,
        client_type=device.client_type,
        device_platform=device.device_platform,
        app_version=device.app_version,
        os_version=device.os_version,
        device_model=device.device_model,
        mdm_provider=device.mdm_provider,
        certificate_thumbprint=device.certificate_thumbprint,
        trust_level=device.trust_level,
        mdm_verified=device.mdm_verified,
        status=device.status,
    )


@router.get("/devices", response_model=DeviceListResponse)
async def list_my_devices(
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> DeviceListResponse:
    devices = await AuthService.list_user_devices(db, principal=principal)
    items = [ManagedDeviceOut.model_validate(d) for d in devices]
    return DeviceListResponse(items=items, total=len(items))


@router.post("/device/sso-login", response_model=TokenResponse)
async def device_sso_login(
    payload: DeviceSsoLoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    access_token, refresh_token, ttl, session_row, org, membership, user, mfa_enrolled = (
        await AuthService.device_sso_login(
            db, payload=payload, settings=settings, request=request
        )
    )
    return _build_token_response(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ttl,
        session_row=session_row,
        org=org,
        membership=membership,
        user=user,
        mfa_enrolled=mfa_enrolled,
    )


@router.get("/me")
async def get_me(
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
) -> dict[str, object]:
    return {
        "user_id": str(principal.user_id),
        "email": principal.email,
        "full_name": principal.full_name,
        "session_id": str(principal.session_id),
        "organization_id": str(principal.organization_id),
        "organization_slug": principal.organization_slug,
        "membership_id": str(principal.membership_id),
        "portal_type": principal.portal_type,
        "clearance_tier": principal.clearance_tier,
        "is_platform_super_admin": principal.is_platform_super_admin,
        "permissions": sorted(principal.permissions),
        "sso_only": principal.sso_only,
        "mfa_required": principal.mfa_required,
        "device_managed": principal.device_managed,
        "device_id": str(principal.device_id) if principal.device_id else None,
    }
