from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    AuthorizationError,
    ConflictError,
    NotFoundError,
    ValidationDomainError,
)
from app.core.security import generate_device_enrollment_code, hash_token
from app.core.tenant import AuthenticatedPrincipal
from app.db.models.device_trust import DeviceEnrollmentCode, ManagedDevice
from app.db.models.identity import (
    OrganizationMembership,
    Permission,
    Role,
    User,
    UserSession,
)
from app.db.session import (
    enable_transaction_platform_lookup,
    set_transaction_tenant_context,
)
from app.modules.audit.service import AuditService
from app.modules.organizations.service import ensure_canonical_permissions


class IAMService:
    """IAM officer service governing roles, member suspension, and device trust."""

    @staticmethod
    async def list_roles(db: AsyncSession, *, principal: AuthenticatedPrincipal) -> list[Role]:
        await enable_transaction_platform_lookup() if principal.is_super_admin else await set_transaction_tenant_context(db, principal.organization_id)
        roles = (
            await db.execute(
                select(Role)
                .options(selectinload(Role.permissions))
                .where(
                    (Role.organization_id == principal.organization_id) | (Role.organization_id.is_(None)),
                    Role.deleted_at.is_(None),
                )
                .order_by(Role.name.asc())
            )
        ).scalars().all()
        return list(roles)

    @staticmethod
    async def create_role(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: Any,
        request: Request | None = None,
    ) -> Role:
        if not principal.has_permission("iam:manage"):
            raise AuthorizationError("Missing permission 'iam:manage'.")

        perm_map = await ensure_canonical_permissions(db)
        resolved_perms: list[Permission] = []
        for scope in payload.permission_scopes:
            if scope == "tenants:admin" and not principal.is_super_admin:
                raise AuthorizationError("Only Super Admin can grant tenants:admin scope.")
            perm = perm_map.get(scope)
            if perm is None:
                raise NotFoundError(f"Permission scope '{scope}' is invalid.")
            resolved_perms.append(perm)

        existing = (
            await db.execute(
                select(Role).where(
                    Role.organization_id == principal.organization_id,
                    Role.slug == payload.slug.lower(),
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            raise ConflictError("A role with this slug already exists in the organization.")

        role = Role(
            organization_id=principal.organization_id,
            slug=payload.slug.lower().strip(),
            name=payload.name.strip(),
            description=payload.description.strip(),
            is_system=False,
            sso_only=payload.sso_only,
            mfa_required=payload.mfa_required,
            permissions=resolved_perms,
        )
        db.add(role)
        await db.flush()

        await AuditService.record(
            db,
            action="ROLE_CREATED",
            module="iam",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="role",
            target_id=str(role.id),
            outcome="success",
            detail=f"Created IAM role '{role.name}' ({role.slug}).",
            request=request,
        )
        return role

    @staticmethod
    async def suspend_member(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        user_id: uuid.UUID,
        request: Request | None = None,
    ) -> None:
        if not principal.has_permission("iam:manage"):
            raise AuthorizationError("Missing permission 'iam:manage'.")

        if user_id == principal.user_id:
            raise ValidationDomainError("You cannot suspend your own account.")

        membership = (
            await db.execute(
                select(OrganizationMembership)
                .options(selectinload(OrganizationMembership.user))
                .where(
                    OrganizationMembership.organization_id == principal.organization_id,
                    OrganizationMembership.user_id == user_id,
                    OrganizationMembership.status == "active",
                )
            )
        ).scalar_one_or_none()

        if membership is None:
            raise NotFoundError("Active organization membership not found.")

        if membership.user.is_platform_super_admin and not principal.is_super_admin:
            raise AuthorizationError("Cannot suspend a platform Super Admin account.")

        membership.status = "suspended"
        now = datetime.now(timezone.utc)

        # Immediately revoke all active sessions for this user in this tenant
        await db.execute(
            update(UserSession)
            .where(
                UserSession.organization_id == principal.organization_id,
                UserSession.user_id == user_id,
                UserSession.revoked_at.is_(None),
            )
            .values(revoked_at=now, revocation_reason="user_suspended")
        )
        await db.flush()

        await AuditService.record(
            db,
            action="USER_SUSPENDED",
            module="iam",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="user",
            target_id=str(user_id),
            outcome="success",
            detail=f"Suspended user '{membership.user.email}' and revoked active sessions.",
            request=request,
        )

    @staticmethod
    async def restore_member(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        user_id: uuid.UUID,
        request: Request | None = None,
    ) -> None:
        if not principal.has_permission("iam:manage"):
            raise AuthorizationError("Missing permission 'iam:manage'.")

        membership = (
            await db.execute(
                select(OrganizationMembership)
                .options(selectinload(OrganizationMembership.user))
                .where(
                    OrganizationMembership.organization_id == principal.organization_id,
                    OrganizationMembership.user_id == user_id,
                )
            )
        ).scalar_one_or_none()

        if membership is None:
            raise NotFoundError("Organization membership not found.")

        membership.status = "active"
        await db.flush()

        await AuditService.record(
            db,
            action="USER_RESTORED",
            module="iam",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="user",
            target_id=str(user_id),
            outcome="success",
            detail=f"Restored user '{membership.user.email}' membership.",
            request=request,
        )

    @staticmethod
    async def update_member_roles(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        user_id: uuid.UUID,
        role_slugs: list[str],
        request: Request | None = None,
    ) -> None:
        if not principal.has_permission("iam:manage"):
            raise AuthorizationError("Missing permission 'iam:manage'.")

        membership = (
            await db.execute(
                select(OrganizationMembership).where(
                    OrganizationMembership.organization_id == principal.organization_id,
                    OrganizationMembership.user_id == user_id,
                    OrganizationMembership.status == "active",
                )
            )
        ).scalar_one_or_none()

        if membership is None:
            raise NotFoundError("Active membership not found.")

        all_roles = (
            await db.execute(
                select(Role).where(
                    (Role.organization_id == principal.organization_id) | (Role.organization_id.is_(None)),
                    Role.deleted_at.is_(None),
                )
            )
        ).scalars().all()
        role_map = {r.slug: r for r in all_roles}

        assigned: list[Role] = []
        for slug in role_slugs:
            role = role_map.get(slug)
            if role is None:
                raise NotFoundError(f"Role '{slug}' not found.")
            for perm in role.permissions:
                if perm.scope == "tenants:admin" and not principal.is_super_admin:
                    raise AuthorizationError("Non-super-admins cannot assign roles with tenants:admin.")
            assigned.append(role)

        membership.roles = assigned
        await db.flush()

        await AuditService.record(
            db,
            action="MEMBER_ROLES_UPDATED",
            module="iam",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="membership",
            target_id=str(membership.id),
            outcome="success",
            detail=f"Updated roles for membership to {role_slugs}.",
            request=request,
        )

    @staticmethod
    async def generate_device_enrollment_code(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: Any,
        request: Request | None = None,
    ) -> tuple[DeviceEnrollmentCode, str]:
        """
        Generates a single-use IAM verification code (IAM-XXXX-XXXX).
        Strictly restricted to authenticated IAM Portal sessions with `devices:enroll_code`.
        """
        if not principal.is_iam_portal or not principal.has_permission("devices:enroll_code"):
            raise AuthorizationError(
                "Device enrollment codes can only be generated through an authenticated IAM Portal session."
            )

        raw_code = generate_device_enrollment_code()
        code_hash = hash_token(raw_code)
        prefix = raw_code[:8]
        now = datetime.now(timezone.utc)
        expires = now + timedelta(hours=payload.ttl_hours)

        code_row = DeviceEnrollmentCode(
            organization_id=principal.organization_id,
            code_hash=code_hash,
            code_prefix=prefix,
            assigned_email=str(payload.assigned_email).lower() if payload.assigned_email else None,
            target_hostname=payload.target_hostname,
            mdm_provider=payload.mdm_provider,
            status="active",
            issued_by_user_id=principal.user_id,
            expires_at=expires,
        )
        db.add(code_row)
        await db.flush()

        await AuditService.record(
            db,
            action="DEVICE_ENROLLMENT_CODE_GENERATED",
            module="iam",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="device_enrollment_code",
            target_id=str(code_row.id),
            outcome="success",
            detail=f"Generated IAM device enrollment verification code prefix '{prefix}'.",
            metadata={"assigned_email": payload.assigned_email, "ttl_hours": payload.ttl_hours},
            request=request,
        )
        return code_row, raw_code

    @staticmethod
    async def list_device_enrollment_codes(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
    ) -> list[DeviceEnrollmentCode]:
        if not principal.is_iam_portal or not principal.has_permission("devices:enroll_code"):
            raise AuthorizationError("Restricted to IAM Portal sessions.")
        await set_transaction_tenant_context(db, principal.organization_id)
        rows = (
            await db.execute(
                select(DeviceEnrollmentCode)
                .where(DeviceEnrollmentCode.organization_id == principal.organization_id)
                .order_by(DeviceEnrollmentCode.created_at.desc())
            )
        ).scalars().all()
        return list(rows)

    @staticmethod
    async def list_managed_devices(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
    ) -> list[ManagedDevice]:
        if not principal.has_permission("iam:manage") and not principal.is_iam_portal:
            raise AuthorizationError("Missing permission to view managed devices.")
        await set_transaction_tenant_context(db, principal.organization_id)
        rows = (
            await db.execute(
                select(ManagedDevice)
                .where(ManagedDevice.organization_id == principal.organization_id)
                .order_by(ManagedDevice.created_at.desc())
            )
        ).scalars().all()
        return list(rows)

    @staticmethod
    async def revoke_managed_device(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        device_id: uuid.UUID,
        request: Request | None = None,
    ) -> None:
        if not principal.has_permission("iam:manage") and not principal.is_iam_portal:
            raise AuthorizationError("Missing permission to revoke managed devices.")

        device = (
            await db.execute(
                select(ManagedDevice).where(
                    ManagedDevice.id == device_id,
                    ManagedDevice.organization_id == principal.organization_id,
                )
            )
        ).scalar_one_or_none()

        if device is None:
            raise NotFoundError("Managed device not found.")

        now = datetime.now(timezone.utc)
        device.status = "revoked"
        device.revoked_at = now
        device.revoked_by_user_id = principal.user_id

        # Immediately revoke all active sessions tied to this device
        await db.execute(
            update(UserSession)
            .where(
                UserSession.device_id == device.id,
                UserSession.revoked_at.is_(None),
            )
            .values(revoked_at=now, revocation_reason="device_revoked")
        )
        await db.flush()

        await AuditService.record(
            db,
            action="DEVICE_REVOKED",
            module="iam",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="managed_device",
            target_id=str(device.id),
            outcome="success",
            detail=f"Revoked managed device '{device.hostname}' and invalidated associated sessions.",
            request=request,
        )
