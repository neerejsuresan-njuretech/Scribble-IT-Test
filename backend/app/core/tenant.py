from __future__ import annotations

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import Depends, Header, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import Settings, get_settings
from app.core.exceptions import (
    AuthenticationError,
    AuthorizationError,
    TenantIsolationError,
)
from app.core.logging import tenant_id_ctx
from app.core.permissions import (
    PORTAL_IAM,
    PORTAL_SUPER_ADMIN,
    compute_effective_permissions,
    derive_clearance_tier,
)
from app.core.security import decode_access_token
from app.db.models.identity import OrganizationMembership, Role, User, UserSession
from app.db.models.organizations import Organization
from app.db.session import (
    enable_transaction_platform_lookup,
    get_db_session,
    set_transaction_tenant_context,
)

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthenticatedPrincipal:
    """
    Server-verified identity, tenant context, portal type, and effective RBAC scopes.
    Constructed strictly from verified JWT + live PostgreSQL records — never frontend headers/payloads.
    """

    user_id: uuid.UUID
    email: str
    full_name: str
    session_id: uuid.UUID
    organization_id: uuid.UUID
    organization_slug: str
    membership_id: uuid.UUID
    portal_type: str
    clearance_tier: str
    is_platform_super_admin: bool
    permissions: frozenset[str]
    sso_only: bool
    mfa_required: bool
    device_managed: bool
    device_id: uuid.UUID | None

    @property
    def is_super_admin(self) -> bool:
        return self.is_platform_super_admin and self.portal_type == PORTAL_SUPER_ADMIN

    @property
    def is_iam_portal(self) -> bool:
        return self.portal_type == PORTAL_IAM

    def has_permission(self, scope: str) -> bool:
        return scope in self.permissions


async def get_current_principal(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    x_organization_id: str | None = Header(default=None, alias="X-Organization-ID"),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedPrincipal:
    """
    Validates Bearer JWT, verifies active session/user/membership/org state in PostgreSQL,
    enforces strict tenant membership on any X-Organization-ID header, and binds
    transaction-local PostgreSQL Row-Level Security (`app.current_organization_id`).
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AuthenticationError("Missing Bearer authentication token.")

    payload = decode_access_token(credentials.credentials, settings)

    try:
        user_id = uuid.UUID(str(payload["sub"]))
        session_id = uuid.UUID(str(payload["sid"]))
        token_org_id = uuid.UUID(str(payload["org_id"]))
        membership_id = uuid.UUID(str(payload["mem_id"]))
    except (ValueError, KeyError) as exc:
        raise AuthenticationError("Malformed authentication token claims.") from exc

    # Temporarily enable pre-auth lookup to read session/membership rows before binding tenant RLS
    await enable_transaction_platform_lookup(db)

    now = datetime.now(timezone.utc)
    session_row = (
        await db.execute(
            select(UserSession).where(
                UserSession.id == session_id,
                UserSession.user_id == user_id,
            )
        )
    ).scalar_one_or_none()

    if (
        session_row is None
        or session_row.revoked_at is not None
        or session_row.expires_at <= now
    ):
        raise AuthenticationError("Session is invalid, expired, or has been revoked.")

    user = (
        await db.execute(
            select(User).where(User.id == user_id, User.deleted_at.is_(None))
        )
    ).scalar_one_or_none()

    if user is None or user.status != "active":
        raise AuthenticationError("User account is suspended or inactive.")

    # Never trust X-Organization-ID blindly: verify membership or platform super-admin clearance
    target_org_id = session_row.organization_id
    if x_organization_id:
        try:
            requested_org_id = uuid.UUID(x_organization_id.strip())
        except ValueError as exc:
            raise TenantIsolationError("Invalid X-Organization-ID header format.") from exc
        if requested_org_id != session_row.organization_id:
            if not (user.is_platform_super_admin and session_row.portal_type == PORTAL_SUPER_ADMIN):
                raise TenantIsolationError(
                    "Cross-tenant header override denied. Switch organization through /api/v1/organizations/switch."
                )
            target_org_id = requested_org_id
    elif token_org_id != session_row.organization_id:
        raise TenantIsolationError("Token organization context does not match active session.")

    organization = (
        await db.execute(
            select(Organization).where(
                Organization.id == target_org_id,
                Organization.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()

    if organization is None:
        raise TenantIsolationError("Organization does not exist.")
    if organization.status != "active" and not (
        user.is_platform_super_admin and session_row.portal_type == PORTAL_SUPER_ADMIN
    ):
        raise AuthorizationError("Organization workspace is currently suspended.")

    membership = (
        await db.execute(
            select(OrganizationMembership)
            .options(selectinload(OrganizationMembership.roles).selectinload(Role.permissions))
            .where(
                OrganizationMembership.id == membership_id,
                OrganizationMembership.user_id == user_id,
                OrganizationMembership.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()

    if membership is None or membership.status != "active":
        raise AuthorizationError("Organization membership is suspended or revoked.")

    if membership.organization_id != target_org_id and not (
        user.is_platform_super_admin and session_row.portal_type == PORTAL_SUPER_ADMIN
    ):
        raise TenantIsolationError("Authenticated user does not belong to the requested organization.")

    role_scopes: set[str] = set()
    role_sso_only = False
    role_mfa_required = False
    for role in membership.roles:
        if role.deleted_at is not None:
            continue
        role_sso_only = role_sso_only or role.sso_only
        role_mfa_required = role_mfa_required or role.mfa_required
        for perm in role.permissions:
            role_scopes.add(perm.scope)

    effective_permissions = compute_effective_permissions(
        is_platform_super_admin=user.is_platform_super_admin,
        portal_type=session_row.portal_type,
        role_scopes=role_scopes,
    )
    clearance_tier = derive_clearance_tier(
        is_platform_super_admin=user.is_platform_super_admin,
        portal_type=session_row.portal_type,
        permissions=effective_permissions,
    )

    # Lock transaction-local PostgreSQL Row-Level Security to the verified organization
    await set_transaction_tenant_context(db, organization.id)
    tenant_id_ctx.set(str(organization.id))

    principal = AuthenticatedPrincipal(
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        session_id=session_row.id,
        organization_id=organization.id,
        organization_slug=organization.slug,
        membership_id=membership.id,
        portal_type=session_row.portal_type,
        clearance_tier=clearance_tier,
        is_platform_super_admin=user.is_platform_super_admin,
        permissions=effective_permissions,
        sso_only=membership.sso_only or role_sso_only,
        mfa_required=membership.mfa_required or role_mfa_required,
        device_managed=session_row.device_id is not None,
        device_id=session_row.device_id,
    )
    request.state.principal = principal
    return principal


def require_permissions(*required_scopes: str) -> Callable[..., AuthenticatedPrincipal]:
    """Dependency requiring ALL specified permission scopes."""

    async def _dependency(
        principal: AuthenticatedPrincipal = Depends(get_current_principal),
    ) -> AuthenticatedPrincipal:
        missing = [scope for scope in required_scopes if not principal.has_permission(scope)]
        if missing:
            raise AuthorizationError(
                f"Missing required RBAC permission scope(s): {', '.join(missing)}."
            )
        return principal

    return _dependency


def require_any_permission(*allowed_scopes: str) -> Callable[..., AuthenticatedPrincipal]:
    """Dependency requiring AT LEAST ONE of the specified permission scopes."""

    async def _dependency(
        principal: AuthenticatedPrincipal = Depends(get_current_principal),
    ) -> AuthenticatedPrincipal:
        if not any(principal.has_permission(scope) for scope in allowed_scopes):
            raise AuthorizationError(
                f"Requires at least one of the following scopes: {', '.join(allowed_scopes)}."
            )
        return principal

    return _dependency


def require_super_admin() -> Callable[..., AuthenticatedPrincipal]:
    """Dependency enforcing Super Admin Portal exclusivity."""

    async def _dependency(
        principal: AuthenticatedPrincipal = Depends(get_current_principal),
    ) -> AuthenticatedPrincipal:
        if not principal.is_super_admin:
            raise AuthorizationError(
                "Super Admin Portal clearance is required for this operation."
            )
        return principal

    return _dependency


def require_iam_portal() -> Callable[..., AuthenticatedPrincipal]:
    """Dependency enforcing IAM Portal exclusivity (e.g. device enrollment code issuance)."""

    async def _dependency(
        principal: AuthenticatedPrincipal = Depends(get_current_principal),
    ) -> AuthenticatedPrincipal:
        if not principal.is_iam_portal or not principal.has_permission("devices:enroll_code"):
            raise AuthorizationError(
                "This operation is exclusively restricted to authenticated IAM Portal sessions."
            )
        return principal

    return _dependency
