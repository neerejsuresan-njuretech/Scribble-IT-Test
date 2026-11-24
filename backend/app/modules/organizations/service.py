from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import Settings
from app.core.exceptions import (
    AuthorizationError,
    ConflictError,
    NotFoundError,
    TenantIsolationError,
    ValidationDomainError,
)
from app.core.permissions import (
    CANONICAL_PERMISSIONS,
    DEFAULT_ROLE_BY_PORTAL,
    DEFAULT_ROLE_TEMPLATES,
    PORTAL_SUPER_ADMIN,
    compute_effective_permissions,
    derive_clearance_tier,
)
from app.core.security import create_access_token, hash_password
from app.core.tenant import AuthenticatedPrincipal
from app.db.models.identity import (
    OrganizationMembership,
    Permission,
    Role,
    User,
    UserSession,
)
from app.db.models.organizations import Organization
from app.db.session import (
    enable_transaction_platform_lookup,
    set_transaction_tenant_context,
)
from app.modules.audit.service import AuditService
from app.modules.organizations.schemas import (
    OrganizationCreateRequest,
    OrganizationMemberCreateRequest,
    OrganizationMemberOut,
    OrganizationSwitchResponse,
    OrganizationUpdateRequest,
)


async def ensure_canonical_permissions(db: AsyncSession) -> dict[str, Permission]:
    """Ensure all canonical RBAC permission scopes exist in the database."""
    existing_rows = list((await db.execute(select(Permission))).scalars().all())
    by_scope = {row.scope: row for row in existing_rows}

    created_any = False
    for scope, category, description in CANONICAL_PERMISSIONS:
        if scope not in by_scope:
            perm = Permission(scope=scope, category=category, description=description)
            db.add(perm)
            by_scope[scope] = perm
            created_any = True

    if created_any:
        await db.flush()
    return by_scope


async def seed_organization_default_roles(
    db: AsyncSession,
    organization_id: uuid.UUID,
) -> dict[str, Role]:
    """
    Create the 5 preserved Scribble-IT IAM policy templates for a newly provisioned
    organization and bind them to canonical permission scopes.
    """
    perm_map = await ensure_canonical_permissions(db)
    existing_roles = list(
        (
            await db.execute(
                select(Role)
                .options(selectinload(Role.permissions))
                .where(Role.organization_id == organization_id, Role.deleted_at.is_(None))
            )
        ).scalars().all()
    )
    by_slug = {role.slug: role for role in existing_roles}

    created_any = False
    for template in DEFAULT_ROLE_TEMPLATES:
        if template.slug in by_slug:
            continue
        role = Role(
            organization_id=organization_id,
            slug=template.slug,
            name=template.name,
            description=template.description,
            is_system=True,
            sso_only=template.sso_only,
            mfa_required=template.mfa_required,
            permissions=[perm_map[scope] for scope in template.permissions if scope in perm_map],
        )
        db.add(role)
        by_slug[template.slug] = role
        created_any = True

    if created_any:
        await db.flush()
    return by_slug


def _serialize_member(membership: OrganizationMembership, user: User) -> OrganizationMemberOut:
    return OrganizationMemberOut(
        membership_id=membership.id,
        organization_id=membership.organization_id,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        user_status=user.status,
        membership_status=membership.status,
        portal_type=membership.portal_type,
        clearance_tier=membership.clearance_tier,
        sso_only=membership.sso_only,
        mfa_required=membership.mfa_required,
        roles=[role.slug for role in membership.roles if role.deleted_at is None],
        created_at=membership.created_at,
    )


class OrganizationService:
    """Multi-tenant organization governance and membership service."""

    @staticmethod
    async def list_organizations(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
    ) -> list[Organization]:
        if principal.is_super_admin:
            await enable_transaction_platform_lookup(db)
            rows = (
                await db.execute(
                    select(Organization)
                    .where(Organization.deleted_at.is_(None))
                    .order_by(Organization.name.asc())
                )
            ).scalars().all()
            return list(rows)

        await enable_transaction_platform_lookup(db)
        rows = (
            await db.execute(
                select(Organization)
                .join(
                    OrganizationMembership,
                    OrganizationMembership.organization_id == Organization.id,
                )
                .where(
                    OrganizationMembership.user_id == principal.user_id,
                    OrganizationMembership.status == "active",
                    OrganizationMembership.deleted_at.is_(None),
                    Organization.deleted_at.is_(None),
                )
                .order_by(Organization.name.asc())
            )
        ).scalars().all()
        await set_transaction_tenant_context(db, principal.organization_id)
        return list(rows)

    @staticmethod
    async def get_organization(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        organization_id: uuid.UUID,
    ) -> Organization:
        await enable_transaction_platform_lookup(db)
        org = (
            await db.execute(
                select(Organization).where(
                    Organization.id == organization_id,
                    Organization.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if org is None:
            raise NotFoundError("Organization not found.")

        if not principal.is_super_admin:
            membership = (
                await db.execute(
                    select(OrganizationMembership).where(
                        OrganizationMembership.organization_id == organization_id,
                        OrganizationMembership.user_id == principal.user_id,
                        OrganizationMembership.status == "active",
                        OrganizationMembership.deleted_at.is_(None),
                    )
                )
            ).scalar_one_or_none()
            await set_transaction_tenant_context(db, principal.organization_id)
            if membership is None:
                raise TenantIsolationError("You do not belong to the requested organization.")

        return org

    @staticmethod
    async def create_organization(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: OrganizationCreateRequest,
        request: Request | None = None,
    ) -> Organization:
        if not principal.is_super_admin:
            raise AuthorizationError("Only Super Admin Portal sessions may create organizations.")

        await enable_transaction_platform_lookup(db)

        dup = (
            await db.execute(
                select(Organization).where(
                    (Organization.slug == payload.slug.lower())
                    | (Organization.company_code == payload.company_code.upper())
                )
            )
        ).scalar_one_or_none()
        if dup is not None:
            raise ConflictError("An organization with that slug or company code already exists.")

        org = Organization(
            name=payload.name.strip(),
            slug=payload.slug.lower().strip(),
            company_code=payload.company_code.upper().strip(),
            domain=payload.domain.lower().strip(),
            plan=payload.plan.strip(),
            region=payload.region.strip(),
            timezone=payload.timezone.strip(),
            currency=payload.currency.upper().strip(),
            primary_contact_email=str(payload.primary_contact_email).lower(),
            status="active",
            sla_targets=payload.sla_targets,
            enabled_modules=payload.enabled_modules,
            portal_branding=payload.portal_branding,
            preference_template=payload.preference_template,
        )
        db.add(org)
        await db.flush()

        roles = await seed_organization_default_roles(db, org.id)
        super_role = roles.get("pol-super-admin")

        # Grant the provisioning Super Admin an active membership in the new tenant
        membership = OrganizationMembership(
            organization_id=org.id,
            user_id=principal.user_id,
            portal_type=PORTAL_SUPER_ADMIN,
            clearance_tier="super_admin",
            status="active",
            sso_only=False,
            mfa_required=True,
            is_default=False,
            roles=[super_role] if super_role is not None else [],
        )
        db.add(membership)
        await db.flush()

        await AuditService.record(
            db,
            action="ORGANIZATION_CREATED",
            module="organizations",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=org.id,
            portal_type=principal.portal_type,
            target_type="organization",
            target_id=str(org.id),
            outcome="success",
            detail=f"Provisioned organization '{org.name}' ({org.company_code}).",
            metadata={"slug": org.slug, "company_code": org.company_code, "plan": org.plan},
            request=request,
        )
        return org

    @staticmethod
    async def update_organization(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        organization_id: uuid.UUID,
        payload: OrganizationUpdateRequest,
        request: Request | None = None,
    ) -> Organization:
        if not principal.is_super_admin:
            raise AuthorizationError(
                "Only Super Admin Portal sessions may modify company details, branding, or tenant status."
            )

        await enable_transaction_platform_lookup(db)
        org = (
            await db.execute(
                select(Organization).where(
                    Organization.id == organization_id,
                    Organization.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if org is None:
            raise NotFoundError("Organization not found.")

        updates = payload.model_dump(exclude_unset=True)
        changed_fields: list[str] = []
        previous_status = org.status

        for field, value in updates.items():
            if field == "primary_contact_email" and value is not None:
                value = str(value).lower()
            elif field == "currency" and value is not None:
                value = str(value).upper()
            elif field == "domain" and value is not None:
                value = str(value).lower().strip()
            setattr(org, field, value)
            changed_fields.append(field)

        await db.flush()

        # If tenant was suspended, immediately revoke non-super-admin sessions in this org
        if previous_status != "suspended" and org.status == "suspended":
            now = datetime.now(timezone.utc)
            await db.execute(
                update(UserSession)
                .where(
                    UserSession.organization_id == org.id,
                    UserSession.portal_type != PORTAL_SUPER_ADMIN,
                    UserSession.revoked_at.is_(None),
                )
                .values(revoked_at=now, revocation_reason="organization_suspended")
            )

        action = "ORGANIZATION_UPDATED"
        if previous_status != org.status:
            action = "ORGANIZATION_SUSPENDED" if org.status == "suspended" else "ORGANIZATION_RESTORED"

        await AuditService.record(
            db,
            action=action,
            module="organizations",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=org.id,
            portal_type=principal.portal_type,
            target_type="organization",
            target_id=str(org.id),
            outcome="success",
            detail=f"Updated organization '{org.name}' fields: {', '.join(changed_fields) or 'none'}.",
            metadata={"changed_fields": changed_fields, "status": org.status},
            request=request,
        )
        return org

    @staticmethod
    async def add_member(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        organization_id: uuid.UUID,
        payload: OrganizationMemberCreateRequest,
        request: Request | None = None,
    ) -> OrganizationMemberOut:
        if not principal.is_super_admin and organization_id != principal.organization_id:
            raise TenantIsolationError("Cannot manage members outside your active organization.")

        if payload.portal_type == PORTAL_SUPER_ADMIN and not principal.is_super_admin:
            raise AuthorizationError(
                "Only a platform Super Admin may assign Super Admin Portal memberships."
            )

        await enable_transaction_platform_lookup(db)
        org = (
            await db.execute(
                select(Organization).where(
                    Organization.id == organization_id,
                    Organization.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if org is None:
            raise NotFoundError("Organization not found.")

        email_norm = str(payload.email).lower().strip()
        user = (
            await db.execute(select(User).where(User.email == email_norm, User.deleted_at.is_(None)))
        ).scalar_one_or_none()

        if user is None:
            if not payload.temporary_password or not payload.full_name:
                raise ValidationDomainError(
                    "New users require full_name and temporary_password (min 12 chars)."
                )
            user = User(
                email=email_norm,
                full_name=payload.full_name.strip(),
                password_hash=hash_password(payload.temporary_password),
                status="active",
                email_verified=False,
                is_platform_super_admin=(payload.portal_type == PORTAL_SUPER_ADMIN and principal.is_super_admin),
            )
            db.add(user)
            await db.flush()
        elif payload.portal_type == PORTAL_SUPER_ADMIN and principal.is_super_admin:
            user.is_platform_super_admin = True

        existing = (
            await db.execute(
                select(OrganizationMembership).where(
                    OrganizationMembership.organization_id == org.id,
                    OrganizationMembership.user_id == user.id,
                    OrganizationMembership.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            raise ConflictError("User is already a member of this organization.")

        roles_by_slug = await seed_organization_default_roles(db, org.id)
        requested_slugs = payload.role_slugs or [DEFAULT_ROLE_BY_PORTAL[payload.portal_type]]

        assigned_roles: list[Role] = []
        role_scopes: set[str] = set()
        for slug in requested_slugs:
            role = roles_by_slug.get(slug)
            if role is None:
                raise NotFoundError(f"Role '{slug}' does not exist in this organization.")
            scopes = {perm.scope for perm in role.permissions}
            if "tenants:admin" in scopes and not principal.is_super_admin:
                raise AuthorizationError(
                    "Non-Super-Admin operators cannot assign roles containing tenants:admin."
                )
            assigned_roles.append(role)
            role_scopes.update(scopes)

        effective_perms = compute_effective_permissions(
            is_platform_super_admin=user.is_platform_super_admin,
            portal_type=payload.portal_type,
            role_scopes=role_scopes,
        )
        clearance = derive_clearance_tier(
            is_platform_super_admin=user.is_platform_super_admin,
            portal_type=payload.portal_type,
            permissions=effective_perms,
        )

        membership = OrganizationMembership(
            organization_id=org.id,
            user_id=user.id,
            department_id=payload.department_id,
            portal_type=payload.portal_type,
            clearance_tier=clearance,
            status="active",
            sso_only=payload.sso_only,
            mfa_required=payload.mfa_required,
            is_default=False,
            roles=assigned_roles,
        )
        db.add(membership)
        await db.flush()

        await AuditService.record(
            db,
            action="ORGANIZATION_MEMBER_ADDED",
            module="organizations",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=org.id,
            portal_type=principal.portal_type,
            target_type="membership",
            target_id=str(membership.id),
            outcome="success",
            detail=f"Added {user.email} to organization '{org.name}' ({payload.portal_type}).",
            metadata={
                "member_email": user.email,
                "portal_type": payload.portal_type,
                "roles": [r.slug for r in assigned_roles],
                "sso_only": payload.sso_only,
            },
            request=request,
        )
        await set_transaction_tenant_context(db, principal.organization_id)
        return _serialize_member(membership, user)

    @staticmethod
    async def remove_member(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        request: Request | None = None,
    ) -> None:
        if not principal.is_super_admin and organization_id != principal.organization_id:
            raise TenantIsolationError("Cannot remove members outside your active organization.")

        if user_id == principal.user_id:
            raise ValidationDomainError("You cannot remove your own active organization membership.")

        await enable_transaction_platform_lookup(db)
        membership = (
            await db.execute(
                select(OrganizationMembership)
                .options(selectinload(OrganizationMembership.user))
                .where(
                    OrganizationMembership.organization_id == organization_id,
                    OrganizationMembership.user_id == user_id,
                    OrganizationMembership.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if membership is None:
            raise NotFoundError("Organization membership not found.")

        if membership.user.is_platform_super_admin and not principal.is_super_admin:
            raise AuthorizationError("Cannot remove a platform Super Admin membership.")

        now = datetime.now(timezone.utc)
        membership.status = "suspended"
        membership.deleted_at = now

        # Immediately revoke all active sessions for this user in this organization
        await db.execute(
            update(UserSession)
            .where(
                UserSession.organization_id == organization_id,
                UserSession.user_id == user_id,
                UserSession.revoked_at.is_(None),
            )
            .values(revoked_at=now, revocation_reason="membership_removed")
        )
        await db.flush()

        await AuditService.record(
            db,
            action="ORGANIZATION_MEMBER_REMOVED",
            module="organizations",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=organization_id,
            portal_type=principal.portal_type,
            target_type="user",
            target_id=str(user_id),
            outcome="success",
            detail=f"Removed {membership.user.email} from organization and revoked sessions.",
            metadata={"member_email": membership.user.email},
            request=request,
        )
        await set_transaction_tenant_context(db, principal.organization_id)

    @staticmethod
    async def switch_organization(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        target_organization_id: uuid.UUID,
        settings: Settings,
        request: Request | None = None,
    ) -> OrganizationSwitchResponse:
        await enable_transaction_platform_lookup(db)

        target_org = (
            await db.execute(
                select(Organization).where(
                    Organization.id == target_organization_id,
                    Organization.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if target_org is None:
            raise NotFoundError("Target organization not found.")

        if target_org.status != "active" and not principal.is_super_admin:
            raise AuthorizationError("Target organization workspace is currently suspended.")

        membership = (
            await db.execute(
                select(OrganizationMembership)
                .options(selectinload(OrganizationMembership.roles).selectinload(Role.permissions))
                .where(
                    OrganizationMembership.organization_id == target_organization_id,
                    OrganizationMembership.user_id == principal.user_id,
                    OrganizationMembership.status == "active",
                    OrganizationMembership.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()

        if membership is None:
            raise TenantIsolationError(
                "You do not hold an active membership in the requested organization."
            )

        session_row = (
            await db.execute(
                select(UserSession).where(
                    UserSession.id == principal.session_id,
                    UserSession.user_id == principal.user_id,
                    UserSession.revoked_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if session_row is None:
            raise AuthorizationError("Active session not found.")

        new_portal = membership.portal_type
        if new_portal == PORTAL_SUPER_ADMIN and not principal.is_platform_super_admin:
            raise AuthorizationError("Super Admin Portal switch denied.")

        role_scopes = {
            perm.scope
            for role in membership.roles
            if role.deleted_at is None
            for perm in role.permissions
        }
        effective_perms = compute_effective_permissions(
            is_platform_super_admin=principal.is_platform_super_admin,
            portal_type=new_portal,
            role_scopes=role_scopes,
        )
        clearance = derive_clearance_tier(
            is_platform_super_admin=principal.is_platform_super_admin,
            portal_type=new_portal,
            permissions=effective_perms,
        )

        session_row.organization_id = target_org.id
        session_row.membership_id = membership.id
        session_row.portal_type = new_portal
        session_row.last_used_at = datetime.now(timezone.utc)
        await db.flush()

        access_token, expires_in = create_access_token(
            settings=settings,
            user_id=principal.user_id,
            session_id=session_row.id,
            organization_id=target_org.id,
            membership_id=membership.id,
            portal_type=new_portal,
        )

        await set_transaction_tenant_context(db, target_org.id)

        await AuditService.record(
            db,
            action="ORGANIZATION_SWITCHED",
            module="organizations",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=target_org.id,
            portal_type=new_portal,
            target_type="organization",
            target_id=str(target_org.id),
            outcome="success",
            detail=f"Switched active tenant context to '{target_org.name}'.",
            metadata={"from_organization_id": str(principal.organization_id)},
            request=request,
        )

        return OrganizationSwitchResponse(
            access_token=access_token,
            expires_in=expires_in,
            organization_id=target_org.id,
            organization_slug=target_org.slug,
            portal_type=new_portal,
            clearance_tier=clearance,
            permissions=sorted(effective_perms),
        )
