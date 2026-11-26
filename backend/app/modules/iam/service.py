from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

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
from app.core.permissions import compute_effective_permissions, derive_clearance_tier
from app.core.security import generate_device_enrollment_code, hash_token
from app.core.tenant import AuthenticatedPrincipal
from app.db.models.device_trust import (
    DeviceEnrollmentCode,
    DeviceTrustEvent,
    ManagedDevice,
)
from app.db.models.identity import (
    OrganizationMembership,
    Permission,
    Role,
    UserSession,
)
from app.db.models.push_notifications import DevicePushToken
from app.db.session import set_transaction_tenant_context
from app.modules.audit.service import AuditService
from app.modules.iam.schemas import IamMemberOut
from app.modules.organizations.service import ensure_canonical_permissions


class IAMService:
    """
    IAM directory, RBAC policy governance, suspension, and device trust service.
    All tenant operations execute under verified tenant RLS context.
    """

    @staticmethod
    async def list_roles(db: AsyncSession, *, principal: AuthenticatedPrincipal) -> list[Role]:
        await set_transaction_tenant_context(db, principal.organization_id)
        roles = (
            await db.execute(
                select(Role)
                .options(selectinload(Role.permissions))
                .where(
                    (Role.organization_id == principal.organization_id)
                    | (Role.organization_id.is_(None)),
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

        await set_transaction_tenant_context(db, principal.organization_id)
        perm_map = await ensure_canonical_permissions(db)
        resolved_perms: list[Permission] = []
        for scope in payload.permission_scopes:
            if scope == "tenants:admin" and not principal.is_super_admin:
                raise AuthorizationError(
                    "Privilege escalation blocked: only Super Admin can grant 'tenants:admin'."
                )
            if scope == "devices:enroll_code" and not principal.is_iam_portal and not principal.is_super_admin:
                raise AuthorizationError(
                    "Privilege escalation blocked: only IAM officers may assign 'devices:enroll_code'."
                )
            perm = perm_map.get(scope)
            if perm is None:
                raise NotFoundError(f"Permission scope '{scope}' is invalid.")
            resolved_perms.append(perm)

        existing = (
            await db.execute(
                select(Role).where(
                    Role.organization_id == principal.organization_id,
                    Role.slug == payload.slug.lower(),
                    Role.deleted_at.is_(None),
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
            metadata={"scopes": [p.scope for p in resolved_perms]},
            request=request,
        )
        return role

    @staticmethod
    async def delete_role(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        role_id: uuid.UUID,
        request: Request | None = None,
    ) -> None:
        if not principal.has_permission("iam:manage"):
            raise AuthorizationError("Missing permission 'iam:manage'.")

        await set_transaction_tenant_context(db, principal.organization_id)
        role = (
            await db.execute(
                select(Role).where(
                    Role.id == role_id,
                    Role.organization_id == principal.organization_id,
                    Role.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if role is None:
            raise NotFoundError("Role not found.")
        if role.is_system:
            raise ValidationDomainError("Built-in system IAM policy roles cannot be deleted.")

        role.deleted_at = datetime.now(timezone.utc)
        await db.flush()

        await AuditService.record(
            db,
            action="ROLE_DELETED",
            module="iam",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="role",
            target_id=str(role.id),
            outcome="success",
            detail=f"Soft-deleted custom IAM role '{role.slug}'.",
            request=request,
        )

    @staticmethod
    async def list_members(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
    ) -> list[IamMemberOut]:
        if not principal.has_permission("iam:manage"):
            raise AuthorizationError("Missing permission 'iam:manage'.")

        await set_transaction_tenant_context(db, principal.organization_id)
        memberships = (
            await db.execute(
                select(OrganizationMembership)
                .options(
                    selectinload(OrganizationMembership.user),
                    selectinload(OrganizationMembership.roles).selectinload(Role.permissions),
                )
                .where(
                    OrganizationMembership.organization_id == principal.organization_id,
                    OrganizationMembership.deleted_at.is_(None),
                )
                .order_by(OrganizationMembership.created_at.asc())
            )
        ).scalars().all()

        results: list[IamMemberOut] = []
        for m in memberships:
            role_scopes = {
                p.scope
                for r in m.roles
                if r.deleted_at is None
                for p in r.permissions
            }
            eff = compute_effective_permissions(
                is_platform_super_admin=m.user.is_platform_super_admin,
                portal_type=m.portal_type,
                role_scopes=role_scopes,
            )
            results.append(
                IamMemberOut(
                    membership_id=m.id,
                    organization_id=m.organization_id,
                    user_id=m.user_id,
                    email=m.user.email,
                    full_name=m.user.full_name,
                    user_status=m.user.status,
                    membership_status=m.status,
                    portal_type=m.portal_type,
                    clearance_tier=m.clearance_tier,
                    sso_only=m.sso_only,
                    mfa_required=m.mfa_required,
                    roles=[r.slug for r in m.roles if r.deleted_at is None],
                    effective_permissions=sorted(eff),
                    created_at=m.created_at,
                )
            )
        return results

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
            raise ValidationDomainError("You cannot suspend your own active account.")

        await set_transaction_tenant_context(db, principal.organization_id)
        membership = (
            await db.execute(
                select(OrganizationMembership)
                .options(selectinload(OrganizationMembership.user))
                .where(
                    OrganizationMembership.organization_id == principal.organization_id,
                    OrganizationMembership.user_id == user_id,
                    OrganizationMembership.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()

        if membership is None:
            raise NotFoundError("Organization membership not found.")
        if membership.user.is_platform_super_admin and not principal.is_super_admin:
            raise AuthorizationError("Cannot suspend a platform Super Admin account.")

        membership.status = "suspended"
        now = datetime.now(timezone.utc)

        await db.execute(
            update(UserSession)
            .where(
                UserSession.organization_id == principal.organization_id,
                UserSession.user_id == user_id,
                UserSession.revoked_at.is_(None),
            )
            .values(revoked_at=now, revocation_reason="user_suspended")
        )
        await db.execute(
            update(DevicePushToken)
            .where(
                DevicePushToken.organization_id == principal.organization_id,
                DevicePushToken.user_id == user_id,
                DevicePushToken.status == "active",
            )
            .values(status="revoked", revoked_at=now, revocation_reason="user_suspended")
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
            detail=f"Suspended '{membership.user.email}' and revoked active sessions.",
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

        await set_transaction_tenant_context(db, principal.organization_id)
        membership = (
            await db.execute(
                select(OrganizationMembership)
                .options(selectinload(OrganizationMembership.user))
                .where(
                    OrganizationMembership.organization_id == principal.organization_id,
                    OrganizationMembership.user_id == user_id,
                    OrganizationMembership.deleted_at.is_(None),
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
            detail=f"Restored active membership for '{membership.user.email}'.",
            request=request,
        )

    @staticmethod
    async def update_member_roles(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        user_id: uuid.UUID,
        role_slugs: list[str],
        sso_only: bool | None = None,
        mfa_required: bool | None = None,
        request: Request | None = None,
    ) -> None:
        if not principal.has_permission("iam:manage"):
            raise AuthorizationError("Missing permission 'iam:manage'.")

        await set_transaction_tenant_context(db, principal.organization_id)
        membership = (
            await db.execute(
                select(OrganizationMembership)
                .options(
                    selectinload(OrganizationMembership.user),
                    selectinload(OrganizationMembership.roles).selectinload(Role.permissions),
                )
                .where(
                    OrganizationMembership.organization_id == principal.organization_id,
                    OrganizationMembership.user_id == user_id,
                    OrganizationMembership.status == "active",
                    OrganizationMembership.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if membership is None:
            raise NotFoundError("Active membership not found.")

        if membership.user.is_platform_super_admin and not principal.is_super_admin:
            raise AuthorizationError("Only Super Admin may modify a Super Admin's role bindings.")

        all_roles = (
            await db.execute(
                select(Role)
                .options(selectinload(Role.permissions))
                .where(
                    (Role.organization_id == principal.organization_id)
                    | (Role.organization_id.is_(None)),
                    Role.deleted_at.is_(None),
                )
            )
        ).scalars().all()
        role_map = {r.slug: r for r in all_roles}

        previous_scopes = {
            p.scope for r in membership.roles if r.deleted_at is None for p in r.permissions
        }

        assigned: list[Role] = []
        new_scopes: set[str] = set()
        for slug in role_slugs:
            role = role_map.get(slug)
            if role is None:
                raise NotFoundError(f"Role '{slug}' not found.")
            for perm in role.permissions:
                if perm.scope == "tenants:admin" and not principal.is_super_admin:
                    raise AuthorizationError(
                        "Privilege escalation blocked: non-Super-Admin cannot assign 'tenants:admin'."
                    )
                new_scopes.add(perm.scope)
            assigned.append(role)

        membership.roles = assigned
        if sso_only is not None:
            membership.sso_only = sso_only
        if mfa_required is not None:
            membership.mfa_required = mfa_required

        effective_perms = compute_effective_permissions(
            is_platform_super_admin=membership.user.is_platform_super_admin,
            portal_type=membership.portal_type,
            role_scopes=new_scopes,
        )
        membership.clearance_tier = derive_clearance_tier(
            is_platform_super_admin=membership.user.is_platform_super_admin,
            portal_type=membership.portal_type,
            permissions=effective_perms,
        )

        # Invalidate active sessions whenever permissions are revoked or SSO-only is newly enabled
        permissions_revoked = bool(previous_scopes - new_scopes)
        if permissions_revoked or (sso_only is True):
            now = datetime.now(timezone.utc)
            await db.execute(
                update(UserSession)
                .where(
                    UserSession.organization_id == principal.organization_id,
                    UserSession.user_id == user_id,
                    UserSession.revoked_at.is_(None),
                )
                .values(revoked_at=now, revocation_reason="permissions_or_policy_updated")
            )
            await db.execute(
                update(DevicePushToken)
                .where(
                    DevicePushToken.organization_id == principal.organization_id,
                    DevicePushToken.user_id == user_id,
                    DevicePushToken.status == "active",
                )
                .values(status="revoked", revoked_at=now, revocation_reason="permissions_or_policy_updated")
            )

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
            detail=f"Updated roles for '{membership.user.email}' to {role_slugs}.",
            metadata={
                "role_slugs": role_slugs,
                "sessions_invalidated": permissions_revoked or (sso_only is True),
            },
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

        await set_transaction_tenant_context(db, principal.organization_id)
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

        db.add(
            DeviceTrustEvent(
                organization_id=principal.organization_id,
                enrollment_code_id=code_row.id,
                event_type="enrollment_code_issued",
                actor_user_id=principal.user_id,
                actor_email=principal.email,
                detail=f"Issued single-use IAM enrollment code prefix '{prefix}'.",
                metadata_json={
                    "assigned_email": code_row.assigned_email,
                    "mdm_provider": code_row.mdm_provider,
                    "ttl_hours": payload.ttl_hours,
                },
            )
        )
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
            metadata={
                "assigned_email": code_row.assigned_email,
                "mdm_provider": code_row.mdm_provider,
                "ttl_hours": payload.ttl_hours,
            },
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
    async def revoke_device_enrollment_code(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        code_id: uuid.UUID,
        request: Request | None = None,
    ) -> None:
        if not principal.is_iam_portal or not principal.has_permission("devices:enroll_code"):
            raise AuthorizationError("Revoking device enrollment codes is restricted to IAM Portal sessions.")

        await set_transaction_tenant_context(db, principal.organization_id)
        code_row = (
            await db.execute(
                select(DeviceEnrollmentCode).where(
                    DeviceEnrollmentCode.id == code_id,
                    DeviceEnrollmentCode.organization_id == principal.organization_id,
                )
            )
        ).scalar_one_or_none()
        if code_row is None:
            raise NotFoundError("Device enrollment code not found.")
        if code_row.status == "used":
            raise ConflictError("Cannot revoke an enrollment code that has already been redeemed.")

        now = datetime.now(timezone.utc)
        code_row.status = "revoked"
        code_row.revoked_at = now
        code_row.revoked_by_user_id = principal.user_id

        db.add(
            DeviceTrustEvent(
                organization_id=principal.organization_id,
                enrollment_code_id=code_row.id,
                event_type="enrollment_code_revoked",
                actor_user_id=principal.user_id,
                actor_email=principal.email,
                detail=f"Revoked IAM enrollment code prefix '{code_row.code_prefix}'.",
            )
        )
        await db.flush()

        await AuditService.record(
            db,
            action="DEVICE_ENROLLMENT_CODE_REVOKED",
            module="iam",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="device_enrollment_code",
            target_id=str(code_row.id),
            outcome="success",
            detail=f"Revoked IAM device enrollment code prefix '{code_row.code_prefix}'.",
            request=request,
        )

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
    async def attest_device_mdm(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        device_id: uuid.UUID,
        mdm_provider: str,
        mdm_authority_ref: str,
        request: Request | None = None,
    ) -> ManagedDevice:
        """
        Records independent MDM authority verification (e.g. Microsoft Intune / Jamf compliance
        attestation), upgrading a device from `registered_iam_code` to `mdm_verified`.
        """
        if not principal.is_iam_portal and not principal.has_permission("iam:manage"):
            raise AuthorizationError("MDM attestation requires IAM clearance.")

        await set_transaction_tenant_context(db, principal.organization_id)
        device = (
            await db.execute(
                select(ManagedDevice).where(
                    ManagedDevice.id == device_id,
                    ManagedDevice.organization_id == principal.organization_id,
                )
            )
        ).scalar_one_or_none()
        if device is None:
            raise NotFoundError("Device not found.")
        if device.status != "active":
            raise ValidationDomainError("Cannot attest a revoked device.")

        now = datetime.now(timezone.utc)
        device.mdm_provider = mdm_provider.strip()
        device.mdm_authority_ref = mdm_authority_ref.strip()
        device.mdm_verified = True
        device.mdm_verified_at = now
        device.trust_level = "mdm_verified"

        db.add(
            DeviceTrustEvent(
                organization_id=principal.organization_id,
                device_id=device.id,
                event_type="device_mdm_attested",
                actor_user_id=principal.user_id,
                actor_email=principal.email,
                detail=f"Attested device '{device.hostname}' against MDM authority '{device.mdm_provider}'.",
                metadata_json={"mdm_provider": device.mdm_provider, "mdm_authority_ref": device.mdm_authority_ref},
            )
        )
        await db.flush()

        await AuditService.record(
            db,
            action="DEVICE_MDM_ATTESTED",
            module="iam",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="managed_device",
            target_id=str(device.id),
            outcome="success",
            detail=f"Upgraded device '{device.hostname}' to mdm_verified via {device.mdm_provider}.",
            request=request,
        )
        return device

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

        await set_transaction_tenant_context(db, principal.organization_id)
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
        device.trust_level = "revoked"
        device.mdm_verified = False
        device.revoked_at = now
        device.revoked_by_user_id = principal.user_id

        # Immediately revoke all active sessions & push tokens tied to this device
        await db.execute(
            update(UserSession)
            .where(
                UserSession.device_id == device.id,
                UserSession.revoked_at.is_(None),
            )
            .values(revoked_at=now, revocation_reason="device_revoked")
        )
        await db.execute(
            update(DevicePushToken)
            .where(
                DevicePushToken.device_id == device.id,
                DevicePushToken.status == "active",
            )
            .values(status="revoked", revoked_at=now, revocation_reason="device_revoked")
        )

        db.add(
            DeviceTrustEvent(
                organization_id=principal.organization_id,
                device_id=device.id,
                event_type="device_revoked",
                actor_user_id=principal.user_id,
                actor_email=principal.email,
                detail=f"Revoked device '{device.hostname}' and invalidated bound SSO sessions.",
            )
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

    @staticmethod
    async def list_device_trust_history(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        device_id: uuid.UUID,
    ) -> list[DeviceTrustEvent]:
        if not principal.has_permission("iam:manage") and not principal.is_iam_portal:
            raise AuthorizationError("Missing permission to view device trust history.")
        await set_transaction_tenant_context(db, principal.organization_id)
        rows = (
            await db.execute(
                select(DeviceTrustEvent)
                .where(
                    DeviceTrustEvent.organization_id == principal.organization_id,
                    DeviceTrustEvent.device_id == device_id,
                )
                .order_by(DeviceTrustEvent.created_at.desc())
            )
        ).scalars().all()
        return list(rows)
