from __future__ import annotations

import uuid
from typing import Literal

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PageMeta, apply_sorting, paginate_scalars
from app.db.models.cmdb import (
    Asset,
    CmdbRelation,
    DomainRecord,
    InventoryItem,
    SoftwareLicense,
    VendorContract,
)

ASSET_SORT_COLUMNS = {
    "created_at": Asset.created_at,
    "name": Asset.name,
    "asset_tag": Asset.asset_tag,
    "status": Asset.status,
    "asset_type": Asset.asset_type,
}


class CmdbRepository:
    """Tenant-scoped repository for Assets, CMDB Topology, Inventory, Software, Contracts & Domains."""

    @staticmethod
    async def list_assets(
        db: AsyncSession,
        *,
        organization_id: uuid.UUID,
        assignee_only_user_id: uuid.UUID | None = None,
        status: str | None = None,
        asset_type: str | None = None,
        search: str | None = None,
        sort_by: str | None = None,
        sort_dir: Literal["asc", "desc"] = "desc",
        page: int = 1,
        page_size: int = 25,
    ) -> tuple[list[Asset], PageMeta]:
        stmt = select(Asset).where(
            Asset.organization_id == organization_id,
            Asset.deleted_at.is_(None),
        )
        if assignee_only_user_id is not None:
            stmt = stmt.where(Asset.assigned_to_user_id == assignee_only_user_id)
        if status:
            stmt = stmt.where(Asset.status == status)
        if asset_type:
            stmt = stmt.where(Asset.asset_type == asset_type)
        if search and search.strip():
            term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Asset.asset_tag.ilike(term),
                    Asset.name.ilike(term),
                    Asset.serial_number.ilike(term),
                    Asset.ip_address.ilike(term),
                    Asset.assigned_to_name.ilike(term),
                )
            )
        stmt = apply_sorting(
            stmt,
            sort_by=sort_by,
            sort_dir=sort_dir,
            allowed_columns=ASSET_SORT_COLUMNS,
            default_sort="created_at",
        )
        return await paginate_scalars(db, stmt, page=page, page_size=page_size)

    @staticmethod
    async def get_asset(
        db: AsyncSession,
        *,
        organization_id: uuid.UUID,
        asset_id: uuid.UUID,
        for_update: bool = False,
    ) -> Asset | None:
        stmt = select(Asset).where(
            Asset.id == asset_id,
            Asset.organization_id == organization_id,
            Asset.deleted_at.is_(None),
        )
        if for_update:
            stmt = stmt.with_for_update()
        return (await db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    async def list_relations(
        db: AsyncSession, *, organization_id: uuid.UUID
    ) -> list[CmdbRelation]:
        rows = (
            await db.execute(
                select(CmdbRelation)
                .where(CmdbRelation.organization_id == organization_id)
                .order_by(CmdbRelation.created_at.desc())
            )
        ).scalars().all()
        return list(rows)

    @staticmethod
    async def list_inventory(
        db: AsyncSession, *, organization_id: uuid.UUID, low_stock_only: bool = False
    ) -> list[InventoryItem]:
        stmt = select(InventoryItem).where(
            InventoryItem.organization_id == organization_id,
            InventoryItem.deleted_at.is_(None),
        )
        if low_stock_only:
            stmt = stmt.where(InventoryItem.quantity <= InventoryItem.min_threshold)
        stmt = stmt.order_by(InventoryItem.name.asc())
        return list((await db.execute(stmt)).scalars().all())

    @staticmethod
    async def list_software(
        db: AsyncSession, *, organization_id: uuid.UUID
    ) -> list[SoftwareLicense]:
        rows = (
            await db.execute(
                select(SoftwareLicense)
                .where(
                    SoftwareLicense.organization_id == organization_id,
                    SoftwareLicense.deleted_at.is_(None),
                )
                .order_by(SoftwareLicense.name.asc())
            )
        ).scalars().all()
        return list(rows)

    @staticmethod
    async def list_contracts(
        db: AsyncSession, *, organization_id: uuid.UUID
    ) -> list[VendorContract]:
        rows = (
            await db.execute(
                select(VendorContract)
                .where(
                    VendorContract.organization_id == organization_id,
                    VendorContract.deleted_at.is_(None),
                )
                .order_by(VendorContract.created_at.desc())
            )
        ).scalars().all()
        return list(rows)

    @staticmethod
    async def list_domains(
        db: AsyncSession, *, organization_id: uuid.UUID
    ) -> list[DomainRecord]:
        rows = (
            await db.execute(
                select(DomainRecord)
                .where(
                    DomainRecord.organization_id == organization_id,
                    DomainRecord.deleted_at.is_(None),
                )
                .order_by(DomainRecord.domain.asc())
            )
        ).scalars().all()
        return list(rows)
