from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, NotFoundError, ValidationDomainError
from app.core.pagination import PageMeta
from app.core.permissions import PORTAL_END_USER
from app.core.tenant import AuthenticatedPrincipal
from app.db.models.cmdb import (
    Asset,
    CmdbRelation,
    DomainRecord,
    InventoryItem,
    SoftwareLicense,
    VendorContract,
)
from app.db.models.identity import OrganizationMembership
from app.db.session import set_transaction_tenant_context
from app.modules.audit.service import AuditService
from app.modules.cmdb.repository import CmdbRepository
from app.modules.cmdb.schemas import (
    AssetAssignRequest,
    AssetCreateRequest,
    AssetUpdateRequest,
    CmdbRelationCreateRequest,
    ContractCreateRequest,
    DomainRecordCreateRequest,
    InventoryAdjustRequest,
    InventoryItemCreateRequest,
    SoftwareLicenseCreateRequest,
    SoftwareSeatsAdjustRequest,
)


def _compute_license_compliance(total_seats: int, used_seats: int, license_type: str) -> str:
    if license_type in {"site", "open_source"}:
        return "compliant"
    if used_seats > total_seats:
        return "over_allocated"
    return "compliant"


class CmdbService:
    """Tenant-scoped Asset, CMDB, Inventory, SAM, Contracts, and Domains service."""

    @staticmethod
    async def _resolve_assignee(
        db: AsyncSession,
        *,
        organization_id: uuid.UUID,
        user_id: uuid.UUID | None,
        fallback_name: str | None,
    ) -> tuple[uuid.UUID | None, str | None]:
        if user_id is None:
            return None, (fallback_name.strip() if fallback_name else None)
        mem = (
            await db.execute(
                select(OrganizationMembership)
                .options(selectinload(OrganizationMembership.user))
                .where(
                    OrganizationMembership.organization_id == organization_id,
                    OrganizationMembership.user_id == user_id,
                    OrganizationMembership.status == "active",
                    OrganizationMembership.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if mem is None or mem.user is None:
            raise NotFoundError("Assignee does not hold an active membership in this organization.")
        return mem.user.id, mem.user.full_name

    @staticmethod
    async def list_assets(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        status: str | None = None,
        asset_type: str | None = None,
        search: str | None = None,
        sort_by: str | None = None,
        sort_dir: Literal["asc", "desc"] = "desc",
        page: int = 1,
        page_size: int = 25,
    ) -> tuple[list[Asset], PageMeta]:
        await set_transaction_tenant_context(db, principal.organization_id)
        assignee_only = principal.user_id if principal.portal_type == PORTAL_END_USER else None
        return await CmdbRepository.list_assets(
            db,
            organization_id=principal.organization_id,
            assignee_only_user_id=assignee_only,
            status=status,
            asset_type=asset_type,
            search=search,
            sort_by=sort_by,
            sort_dir=sort_dir,
            page=page,
            page_size=page_size,
        )

    @staticmethod
    async def create_asset(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: AssetCreateRequest,
        request: Request | None = None,
    ) -> Asset:
        await set_transaction_tenant_context(db, principal.organization_id)
        tag = payload.asset_tag.upper().strip()
        dup = (
            await db.execute(
                select(Asset).where(
                    Asset.organization_id == principal.organization_id,
                    Asset.asset_tag == tag,
                    Asset.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if dup is not None:
            raise ConflictError(f"Asset tag '{tag}' already exists in this organization.")

        assignee_id, assignee_name = await CmdbService._resolve_assignee(
            db,
            organization_id=principal.organization_id,
            user_id=payload.assigned_to_user_id,
            fallback_name=payload.assigned_to_name,
        )
        asset = Asset(
            organization_id=principal.organization_id,
            asset_tag=tag,
            name=payload.name.strip(),
            asset_type=payload.asset_type.strip(),
            serial_number=payload.serial_number.strip(),
            mac_address=payload.mac_address,
            ip_address=payload.ip_address,
            sync_source=payload.sync_source,
            model=payload.model.strip(),
            manufacturer=payload.manufacturer.strip(),
            status=payload.status,
            assigned_to_user_id=assignee_id,
            assigned_to_name=assignee_name,
            department=payload.department,
            location=payload.location.strip(),
            purchase_date=payload.purchase_date,
            warranty_expiry=payload.warranty_expiry,
            purchase_cost=payload.purchase_cost,
            current_book_value=payload.current_book_value,
            qr_code_data=f"SCRIBBLE-IT:ASSET:{tag}:{payload.serial_number.strip()}",
        )
        db.add(asset)
        await db.flush()

        await AuditService.record(
            db,
            action="ASSET_CREATED",
            module="cmdb",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="asset",
            target_id=str(asset.id),
            outcome="success",
            detail=f"Registered asset {asset.asset_tag} ({asset.name}).",
            request=request,
        )
        return asset

    @staticmethod
    async def update_asset(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        asset_id: uuid.UUID,
        payload: AssetUpdateRequest,
        request: Request | None = None,
    ) -> Asset:
        await set_transaction_tenant_context(db, principal.organization_id)
        asset = await CmdbRepository.get_asset(
            db, organization_id=principal.organization_id, asset_id=asset_id, for_update=True
        )
        if asset is None:
            raise NotFoundError("Asset not found.")

        updates = payload.model_dump(exclude_unset=True)
        if "assigned_to_user_id" in updates:
            uid = updates.pop("assigned_to_user_id")
            uname = updates.pop("assigned_to_name", None)
            resolved_id, resolved_name = await CmdbService._resolve_assignee(
                db,
                organization_id=principal.organization_id,
                user_id=uid,
                fallback_name=uname,
            )
            asset.assigned_to_user_id = resolved_id
            asset.assigned_to_name = resolved_name

        for field, val in updates.items():
            setattr(asset, field, val)

        await AuditService.record(
            db,
            action="ASSET_UPDATED",
            module="cmdb",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="asset",
            target_id=str(asset.id),
            outcome="success",
            detail=f"Updated asset {asset.asset_tag}.",
            request=request,
        )
        await db.flush()
        return asset

    @staticmethod
    async def assign_asset(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        asset_id: uuid.UUID,
        payload: AssetAssignRequest,
        request: Request | None = None,
    ) -> Asset:
        await set_transaction_tenant_context(db, principal.organization_id)
        asset = await CmdbRepository.get_asset(
            db, organization_id=principal.organization_id, asset_id=asset_id, for_update=True
        )
        if asset is None:
            raise NotFoundError("Asset not found.")

        resolved_id, resolved_name = await CmdbService._resolve_assignee(
            db,
            organization_id=principal.organization_id,
            user_id=payload.assigned_to_user_id,
            fallback_name=payload.assigned_to_name,
        )
        asset.assigned_to_user_id = resolved_id
        asset.assigned_to_name = resolved_name
        if payload.department is not None:
            asset.department = payload.department
        asset.status = payload.status if resolved_name else "in_stock"

        await AuditService.record(
            db,
            action="ASSET_ASSIGNED",
            module="cmdb",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="asset",
            target_id=str(asset.id),
            outcome="success",
            detail=f"Assigned asset {asset.asset_tag} to {resolved_name or 'Stockroom'} (status={asset.status}).",
            request=request,
        )
        await db.flush()
        return asset

    @staticmethod
    async def create_cmdb_relation(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: CmdbRelationCreateRequest,
        request: Request | None = None,
    ) -> CmdbRelation:
        await set_transaction_tenant_context(db, principal.organization_id)
        if payload.source_asset_id == payload.target_asset_id:
            raise ValidationDomainError("A CMDB configuration item cannot depend on itself.")

        src = await CmdbRepository.get_asset(
            db, organization_id=principal.organization_id, asset_id=payload.source_asset_id
        )
        dst = await CmdbRepository.get_asset(
            db, organization_id=principal.organization_id, asset_id=payload.target_asset_id
        )
        if src is None or dst is None:
            raise NotFoundError("Both source and target assets must exist in this organization.")

        rel = CmdbRelation(
            organization_id=principal.organization_id,
            source_asset_id=src.id,
            target_asset_id=dst.id,
            relation_type=payload.relation_type,
            criticality=payload.criticality,
        )
        db.add(rel)
        await db.flush()
        await AuditService.record(
            db,
            action="CMDB_RELATION_CREATED",
            module="cmdb",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="cmdb_relation",
            target_id=str(rel.id),
            outcome="success",
            detail=f"Linked {src.asset_tag} -[{rel.relation_type}]-> {dst.asset_tag}.",
            request=request,
        )
        return rel

    @staticmethod
    async def delete_cmdb_relation(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        relation_id: uuid.UUID,
    ) -> None:
        await set_transaction_tenant_context(db, principal.organization_id)
        rel = (
            await db.execute(
                select(CmdbRelation).where(
                    CmdbRelation.id == relation_id,
                    CmdbRelation.organization_id == principal.organization_id,
                )
            )
        ).scalar_one_or_none()
        if rel is None:
            raise NotFoundError("CMDB relation not found.")
        await db.delete(rel)
        await db.flush()

    @staticmethod
    async def create_inventory_item(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: InventoryItemCreateRequest,
        request: Request | None = None,
    ) -> InventoryItem:
        await set_transaction_tenant_context(db, principal.organization_id)
        sku = payload.sku.upper().strip()
        dup = (
            await db.execute(
                select(InventoryItem).where(
                    InventoryItem.organization_id == principal.organization_id,
                    InventoryItem.sku == sku,
                    InventoryItem.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if dup is not None:
            raise ConflictError(f"Inventory SKU '{sku}' already exists.")

        item = InventoryItem(
            organization_id=principal.organization_id,
            sku=sku,
            name=payload.name.strip(),
            category=payload.category.strip(),
            quantity=payload.quantity,
            min_threshold=payload.min_threshold,
            unit_cost=payload.unit_cost,
            location=payload.location.strip(),
            last_restocked_at=datetime.now(timezone.utc) if payload.quantity > 0 else None,
        )
        db.add(item)
        await db.flush()
        await AuditService.record(
            db,
            action="INVENTORY_ITEM_CREATED",
            module="cmdb",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="inventory_item",
            target_id=str(item.id),
            outcome="success",
            detail=f"Added inventory SKU {item.sku} ({item.name}, qty={item.quantity}).",
            request=request,
        )
        return item

    @staticmethod
    async def adjust_inventory(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        item_id: uuid.UUID,
        payload: InventoryAdjustRequest,
        request: Request | None = None,
    ) -> InventoryItem:
        await set_transaction_tenant_context(db, principal.organization_id)
        item = (
            await db.execute(
                select(InventoryItem)
                .where(
                    InventoryItem.id == item_id,
                    InventoryItem.organization_id == principal.organization_id,
                    InventoryItem.deleted_at.is_(None),
                )
                .with_for_update()
            )
        ).scalar_one_or_none()
        if item is None:
            raise NotFoundError("Inventory item not found.")

        next_qty = item.quantity + payload.delta
        if next_qty < 0:
            raise ValidationDomainError(
                f"Insufficient stock: current quantity is {item.quantity}, cannot subtract {abs(payload.delta)}."
            )
        item.quantity = next_qty
        if payload.delta > 0:
            item.last_restocked_at = datetime.now(timezone.utc)
        await db.flush()
        await AuditService.record(
            db,
            action="INVENTORY_ADJUSTED",
            module="cmdb",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="inventory_item",
            target_id=str(item.id),
            outcome="success",
            detail=f"Adjusted {item.sku} by {payload.delta:+d} -> {item.quantity} ({payload.reason}).",
            request=request,
        )
        return item

    @staticmethod
    async def create_software_license(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: SoftwareLicenseCreateRequest,
        request: Request | None = None,
    ) -> SoftwareLicense:
        await set_transaction_tenant_context(db, principal.organization_id)
        compliance = _compute_license_compliance(
            payload.total_seats, payload.used_seats, payload.license_type
        )
        lic = SoftwareLicense(
            organization_id=principal.organization_id,
            name=payload.name.strip(),
            vendor=payload.vendor.strip(),
            version=payload.version.strip(),
            license_type=payload.license_type,
            total_seats=payload.total_seats,
            used_seats=payload.used_seats,
            annual_cost=payload.annual_cost,
            renewal_date=payload.renewal_date,
            source=payload.source,
            compliance_status=compliance,
        )
        db.add(lic)
        await db.flush()
        await AuditService.record(
            db,
            action="SOFTWARE_LICENSE_CREATED",
            module="cmdb",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="software_license",
            target_id=str(lic.id),
            outcome="success",
            detail=f"Registered software license '{lic.name}' ({lic.used_seats}/{lic.total_seats}).",
            request=request,
        )
        return lic

    @staticmethod
    async def adjust_software_seats(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        license_id: uuid.UUID,
        payload: SoftwareSeatsAdjustRequest,
    ) -> SoftwareLicense:
        await set_transaction_tenant_context(db, principal.organization_id)
        lic = (
            await db.execute(
                select(SoftwareLicense)
                .where(
                    SoftwareLicense.id == license_id,
                    SoftwareLicense.organization_id == principal.organization_id,
                    SoftwareLicense.deleted_at.is_(None),
                )
                .with_for_update()
            )
        ).scalar_one_or_none()
        if lic is None:
            raise NotFoundError("Software license not found.")
        next_used = max(0, lic.used_seats + payload.delta)
        lic.used_seats = next_used
        lic.compliance_status = _compute_license_compliance(
            lic.total_seats, lic.used_seats, lic.license_type
        )
        await db.flush()
        return lic

    @staticmethod
    async def create_contract(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: ContractCreateRequest,
    ) -> VendorContract:
        await set_transaction_tenant_context(db, principal.organization_id)
        row = VendorContract(
            organization_id=principal.organization_id,
            title=payload.title.strip(),
            vendor=payload.vendor.strip(),
            contract_type=payload.contract_type,
            annual_value=payload.annual_value,
            start_date=payload.start_date,
            renewal_date=payload.renewal_date,
            notice_days=payload.notice_days,
            auto_renew=payload.auto_renew,
            linked_asset_ids=payload.linked_asset_ids,
            status=payload.status,
            rfp_notes=payload.rfp_notes,
        )
        db.add(row)
        await db.flush()
        return row

    @staticmethod
    async def create_domain(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: DomainRecordCreateRequest,
    ) -> DomainRecord:
        await set_transaction_tenant_context(db, principal.organization_id)
        dom = payload.domain.lower().strip()
        dup = (
            await db.execute(
                select(DomainRecord).where(
                    DomainRecord.organization_id == principal.organization_id,
                    DomainRecord.domain == dom,
                    DomainRecord.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if dup is not None:
            raise ConflictError(f"Domain '{dom}' already exists in this organization.")
        row = DomainRecord(
            organization_id=principal.organization_id,
            domain=dom,
            registrar=payload.registrar.strip(),
            domain_expiry=payload.domain_expiry,
            ssl_expiry=payload.ssl_expiry,
            security_grade=payload.security_grade,
            dnssec_enabled=payload.dnssec_enabled,
            spf_valid=payload.spf_valid,
            dkim_valid=payload.dkim_valid,
            dmarc_policy=payload.dmarc_policy,
            registrar_locked=payload.registrar_locked,
            lookalike_alerts=payload.lookalike_alerts,
        )
        db.add(row)
        await db.flush()
        return row
