from __future__ import annotations

import uuid
from typing import Literal

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.pagination import PageMeta, apply_sorting, paginate_scalars
from app.db.models.approvals import CabVotingSeat
from app.db.models.itsm import ChangeActivity, ChangeRequest

CHANGE_SORT_COLUMNS = {
    "created_at": ChangeRequest.created_at,
    "updated_at": ChangeRequest.updated_at,
    "scheduled_start": ChangeRequest.scheduled_start,
    "risk_score": ChangeRequest.risk_score,
    "status": ChangeRequest.status,
    "number": ChangeRequest.number,
}


class ChangeRepository:
    """Tenant-scoped SQLAlchemy repository for Change Requests & CAB seats."""

    @staticmethod
    async def next_number(db: AsyncSession, organization_id: uuid.UUID) -> str:
        count = int(
            (
                await db.execute(
                    select(func.count(ChangeRequest.id)).where(
                        ChangeRequest.organization_id == organization_id
                    )
                )
            ).scalar_one()
        )
        return f"CHG-{4001 + count}"

    @staticmethod
    async def list_paginated(
        db: AsyncSession,
        *,
        organization_id: uuid.UUID,
        status: str | None = None,
        change_type: str | None = None,
        risk_score: str | None = None,
        search: str | None = None,
        sort_by: str | None = None,
        sort_dir: Literal["asc", "desc"] = "desc",
        page: int = 1,
        page_size: int = 25,
    ) -> tuple[list[ChangeRequest], PageMeta]:
        stmt = (
            select(ChangeRequest)
            .options(selectinload(ChangeRequest.activities))
            .where(
                ChangeRequest.organization_id == organization_id,
                ChangeRequest.deleted_at.is_(None),
            )
        )
        if status:
            stmt = stmt.where(ChangeRequest.status == status)
        if change_type:
            stmt = stmt.where(ChangeRequest.change_type == change_type)
        if risk_score:
            stmt = stmt.where(ChangeRequest.risk_score == risk_score)
        if search and search.strip():
            term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    ChangeRequest.number.ilike(term),
                    ChangeRequest.title.ilike(term),
                    ChangeRequest.reason.ilike(term),
                    ChangeRequest.assigned_engineer_name.ilike(term),
                )
            )
        stmt = apply_sorting(
            stmt,
            sort_by=sort_by,
            sort_dir=sort_dir,
            allowed_columns=CHANGE_SORT_COLUMNS,
            default_sort="created_at",
        )
        return await paginate_scalars(db, stmt, page=page, page_size=page_size)

    @staticmethod
    async def get_by_id(
        db: AsyncSession,
        *,
        organization_id: uuid.UUID,
        change_id: uuid.UUID,
        for_update: bool = False,
    ) -> ChangeRequest | None:
        stmt = (
            select(ChangeRequest)
            .options(selectinload(ChangeRequest.activities))
            .where(
                ChangeRequest.id == change_id,
                ChangeRequest.organization_id == organization_id,
                ChangeRequest.deleted_at.is_(None),
            )
        )
        if for_update:
            stmt = stmt.with_for_update()
        return (await db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    async def list_cab_seats(
        db: AsyncSession,
        *,
        organization_id: uuid.UUID,
        change_number: str,
    ) -> list[CabVotingSeat]:
        rows = (
            await db.execute(
                select(CabVotingSeat)
                .where(
                    CabVotingSeat.organization_id == organization_id,
                    CabVotingSeat.change_ref == change_number,
                )
                .order_by(CabVotingSeat.created_at.asc())
            )
        ).scalars().all()
        return list(rows)

    @staticmethod
    async def list_activities(
        db: AsyncSession,
        *,
        organization_id: uuid.UUID,
        change_id: uuid.UUID,
    ) -> list[ChangeActivity]:
        rows = (
            await db.execute(
                select(ChangeActivity)
                .where(
                    ChangeActivity.organization_id == organization_id,
                    ChangeActivity.change_request_id == change_id,
                )
                .order_by(ChangeActivity.created_at.asc())
            )
        ).scalars().all()
        return list(rows)
