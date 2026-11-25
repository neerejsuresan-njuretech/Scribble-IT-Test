from __future__ import annotations

import uuid
from typing import Literal

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.pagination import PageMeta, apply_sorting, paginate_scalars
from app.db.models.approvals import ApprovalWorkflowItem
from app.db.models.itsm import ServiceCatalogItem, ServiceRequest, ServiceRequestActivity

REQUEST_SORT_COLUMNS = {
    "created_at": ServiceRequest.created_at,
    "updated_at": ServiceRequest.updated_at,
    "status": ServiceRequest.status,
    "cost": ServiceRequest.cost,
    "number": ServiceRequest.number,
}


class ServiceRequestRepository:
    """Tenant-scoped repository for Service Catalog & Service Requests."""

    @staticmethod
    async def next_number(db: AsyncSession, organization_id: uuid.UUID) -> str:
        count = int(
            (
                await db.execute(
                    select(func.count(ServiceRequest.id)).where(
                        ServiceRequest.organization_id == organization_id
                    )
                )
            ).scalar_one()
        )
        return f"REQ-{2001 + count}"

    @staticmethod
    async def list_catalog(
        db: AsyncSession,
        *,
        organization_id: uuid.UUID,
        category: str | None = None,
        active_only: bool = True,
    ) -> list[ServiceCatalogItem]:
        stmt = select(ServiceCatalogItem).where(
            ServiceCatalogItem.organization_id == organization_id,
            ServiceCatalogItem.deleted_at.is_(None),
        )
        if active_only:
            stmt = stmt.where(ServiceCatalogItem.is_active.is_(True))
        if category:
            stmt = stmt.where(ServiceCatalogItem.category == category)
        stmt = stmt.order_by(ServiceCatalogItem.title.asc())
        return list((await db.execute(stmt)).scalars().all())

    @staticmethod
    async def get_catalog_item(
        db: AsyncSession,
        *,
        organization_id: uuid.UUID,
        catalog_item_id: uuid.UUID,
    ) -> ServiceCatalogItem | None:
        return (
            await db.execute(
                select(ServiceCatalogItem).where(
                    ServiceCatalogItem.id == catalog_item_id,
                    ServiceCatalogItem.organization_id == organization_id,
                    ServiceCatalogItem.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()

    @staticmethod
    async def list_paginated(
        db: AsyncSession,
        *,
        organization_id: uuid.UUID,
        requester_only_user_id: uuid.UUID | None = None,
        status: str | None = None,
        department: str | None = None,
        search: str | None = None,
        sort_by: str | None = None,
        sort_dir: Literal["asc", "desc"] = "desc",
        page: int = 1,
        page_size: int = 25,
    ) -> tuple[list[ServiceRequest], PageMeta]:
        stmt = (
            select(ServiceRequest)
            .options(selectinload(ServiceRequest.activities))
            .where(
                ServiceRequest.organization_id == organization_id,
                ServiceRequest.deleted_at.is_(None),
            )
        )
        if requester_only_user_id is not None:
            stmt = stmt.where(ServiceRequest.requester_user_id == requester_only_user_id)
        if status:
            stmt = stmt.where(ServiceRequest.status == status)
        if department:
            stmt = stmt.where(ServiceRequest.department == department)
        if search and search.strip():
            term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    ServiceRequest.number.ilike(term),
                    ServiceRequest.catalog_item_name.ilike(term),
                    ServiceRequest.description.ilike(term),
                    ServiceRequest.requester_email.ilike(term),
                )
            )
        stmt = apply_sorting(
            stmt,
            sort_by=sort_by,
            sort_dir=sort_dir,
            allowed_columns=REQUEST_SORT_COLUMNS,
            default_sort="created_at",
        )
        return await paginate_scalars(db, stmt, page=page, page_size=page_size)

    @staticmethod
    async def get_by_id(
        db: AsyncSession,
        *,
        organization_id: uuid.UUID,
        request_id: uuid.UUID,
        for_update: bool = False,
    ) -> ServiceRequest | None:
        stmt = (
            select(ServiceRequest)
            .options(selectinload(ServiceRequest.activities))
            .where(
                ServiceRequest.id == request_id,
                ServiceRequest.organization_id == organization_id,
                ServiceRequest.deleted_at.is_(None),
            )
        )
        if for_update:
            stmt = stmt.with_for_update()
        return (await db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    async def list_approvals_for_request(
        db: AsyncSession,
        *,
        organization_id: uuid.UUID,
        request_number: str,
    ) -> list[ApprovalWorkflowItem]:
        rows = (
            await db.execute(
                select(ApprovalWorkflowItem)
                .where(
                    ApprovalWorkflowItem.organization_id == organization_id,
                    ApprovalWorkflowItem.subject_type == "service_request",
                    ApprovalWorkflowItem.subject_ref == request_number,
                )
                .order_by(ApprovalWorkflowItem.stage_order.asc(), ApprovalWorkflowItem.created_at.asc())
            )
        ).scalars().all()
        return list(rows)

    @staticmethod
    async def list_activities(
        db: AsyncSession,
        *,
        organization_id: uuid.UUID,
        request_id: uuid.UUID,
    ) -> list[ServiceRequestActivity]:
        rows = (
            await db.execute(
                select(ServiceRequestActivity)
                .where(
                    ServiceRequestActivity.organization_id == organization_id,
                    ServiceRequestActivity.service_request_id == request_id,
                )
                .order_by(ServiceRequestActivity.created_at.asc())
            )
        ).scalars().all()
        return list(rows)
