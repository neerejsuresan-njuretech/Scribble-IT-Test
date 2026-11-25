from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthorizationError, NotFoundError, ValidationDomainError
from app.core.tenant import AuthenticatedPrincipal
from app.db.models.organizations import Organization
from app.db.models.platform import PlatformSetting
from app.db.session import enable_transaction_platform_lookup
from app.modules.audit.service import AuditService
from app.modules.governance.schemas import (
    DatabaseGovernanceOperationRequest,
    DatabaseGovernanceOperationResponse,
    OrganizationBrandingUpdateRequest,
    OrganizationModulesUpdateRequest,
    OrganizationSlaUpdateRequest,
    PlatformSettingUpsertRequest,
)

_EXPECTED_CONFIRMATIONS = {
    "export_snapshot": "CONFIRM_SNAPSHOT_EXPORT",
    "import_validated_backup": "CONFIRM_BACKUP_IMPORT",
    "tenant_sandbox_reset": "CONFIRM_TENANT_RESET",
}


class GovernanceService:
    """
    Platform Super Admin exclusive governance operations:
      - Global platform branding & configuration (`platform_settings`)
      - Per-organization logo & portal branding updates
      - Platform-level SLA configuration
      - Per-organization module availability matrix
      - Authorized database snapshot/import/reset operations
    Every privileged operation verifies Super Admin Portal clearance and writes an immutable audit log.
    """

    @staticmethod
    def _assert_super_admin(principal: AuthenticatedPrincipal) -> None:
        if not principal.is_super_admin:
            raise AuthorizationError(
                "Super Admin Portal clearance is strictly required for platform governance operations."
            )

    @staticmethod
    async def list_platform_settings(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
    ) -> list[PlatformSetting]:
        GovernanceService._assert_super_admin(principal)
        rows = (
            await db.execute(
                select(PlatformSetting)
                .where(PlatformSetting.deleted_at.is_(None))
                .order_by(PlatformSetting.key.asc())
            )
        ).scalars().all()
        return list(rows)

    @staticmethod
    async def upsert_platform_setting(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        key: str,
        payload: PlatformSettingUpsertRequest,
        request: Request | None = None,
    ) -> PlatformSetting:
        GovernanceService._assert_super_admin(principal)
        clean_key = key.strip().lower()
        if not clean_key or len(clean_key) > 128:
            raise ValidationDomainError("Invalid platform setting key.")

        setting = (
            await db.execute(
                select(PlatformSetting).where(PlatformSetting.key == clean_key)
            )
        ).scalar_one_or_none()
        if setting is None:
            setting = PlatformSetting(
                key=clean_key,
                value_json=payload.value_json,
                description=payload.description,
                is_public=payload.is_public,
            )
            db.add(setting)
        else:
            setting.value_json = payload.value_json
            if payload.description is not None:
                setting.description = payload.description
            setting.is_public = payload.is_public
            setting.deleted_at = None

        await db.flush()
        await AuditService.record(
            db,
            action="PLATFORM_SETTING_UPDATED",
            module="governance",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="platform_setting",
            target_id=clean_key,
            outcome="success",
            detail=f"Updated global platform setting '{clean_key}'.",
            metadata={"key": clean_key, "is_public": setting.is_public},
            request=request,
        )
        return setting

    @staticmethod
    async def update_organization_branding(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        organization_id: uuid.UUID,
        payload: OrganizationBrandingUpdateRequest,
        request: Request | None = None,
    ) -> Organization:
        GovernanceService._assert_super_admin(principal)
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

        if payload.logo_storage_key is not None:
            org.logo_storage_key = payload.logo_storage_key
        if payload.portal_branding is not None:
            org.portal_branding = payload.portal_branding
        await db.flush()

        await AuditService.record(
            db,
            action="ORGANIZATION_BRANDING_UPDATED",
            module="governance",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=org.id,
            portal_type=principal.portal_type,
            target_type="organization",
            target_id=str(org.id),
            outcome="success",
            detail=f"Updated logo and portal branding for organization '{org.name}'.",
            metadata={"logo_storage_key": org.logo_storage_key},
            request=request,
        )
        return org

    @staticmethod
    async def update_organization_sla(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        organization_id: uuid.UUID,
        payload: OrganizationSlaUpdateRequest,
        request: Request | None = None,
    ) -> Organization:
        GovernanceService._assert_super_admin(principal)
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

        for tier, hours in payload.sla_targets.items():
            if hours <= 0 or hours > 8760:
                raise ValidationDomainError(f"Invalid SLA target hours for tier '{tier}'.")

        org.sla_targets = dict(payload.sla_targets)
        await db.flush()

        await AuditService.record(
            db,
            action="ORGANIZATION_SLA_UPDATED",
            module="governance",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=org.id,
            portal_type=principal.portal_type,
            target_type="organization",
            target_id=str(org.id),
            outcome="success",
            detail=f"Configured SLA targets for organization '{org.name}'.",
            metadata={"sla_targets": org.sla_targets},
            request=request,
        )
        return org

    @staticmethod
    async def update_organization_modules(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        organization_id: uuid.UUID,
        payload: OrganizationModulesUpdateRequest,
        request: Request | None = None,
    ) -> Organization:
        GovernanceService._assert_super_admin(principal)
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

        org.enabled_modules = dict(payload.enabled_modules)
        await db.flush()

        await AuditService.record(
            db,
            action="ORGANIZATION_MODULES_UPDATED",
            module="governance",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=org.id,
            portal_type=principal.portal_type,
            target_type="organization",
            target_id=str(org.id),
            outcome="success",
            detail=f"Updated module availability controls for '{org.name}'.",
            metadata={"enabled_modules": org.enabled_modules},
            request=request,
        )
        return org

    @staticmethod
    async def authorize_database_operation(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: DatabaseGovernanceOperationRequest,
        request: Request | None = None,
    ) -> DatabaseGovernanceOperationResponse:
        GovernanceService._assert_super_admin(principal)
        expected = _EXPECTED_CONFIRMATIONS[payload.operation]
        if payload.confirmation_phrase.strip() != expected:
            raise ValidationDomainError(
                f"Confirmation phrase mismatch. Required phrase for '{payload.operation}' is '{expected}'."
            )

        target_org_id = payload.target_organization_id or principal.organization_id
        op_id = uuid.uuid4()
        now = datetime.now(timezone.utc)

        audit_entry = await AuditService.record(
            db,
            action="PLATFORM_DB_OPERATION_AUTHORIZED",
            module="governance",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=target_org_id,
            portal_type=principal.portal_type,
            target_type="database_operation",
            target_id=str(op_id),
            outcome="success",
            detail=f"Authorized privileged database operation '{payload.operation}': {payload.reason}",
            metadata={
                "operation": payload.operation,
                "target_organization_id": str(target_org_id),
                "reason": payload.reason,
            },
            request=request,
        )

        return DatabaseGovernanceOperationResponse(
            operation_id=op_id,
            operation=payload.operation,
            status="authorized_and_audited",
            executed_by=principal.email,
            executed_at=now,
            audit_log_id=audit_entry.id,
        )
