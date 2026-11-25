from __future__ import annotations

import uuid
from typing import Literal

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.pagination import PageMeta, apply_sorting, paginate_scalars
from app.db.models.itsm import Incident, IncidentActivity, IncidentAttachment, IncidentRelation

INCIDENT_SORT_COLUMNS = {
    "created_at": Incident.created_at,
    "updated_at": Incident.updated_at,
    "priority": Incident.priority,
    "status": Incident.status,
    "sla_deadline": Incident.sla_deadline,
    "number": Incident.number,
}


class IncidentRepository:
    """Tenant-scoped SQLAlchemy repository for Incidents and sub-resources."""

    @staticmethod
    async def next_number(db: AsyncSession, organization_id: uuid.UUID) -> str:
        count = int(
            (
                await db.execute(
                    select(func.count(Incident.id)).where(
                        Incident.organization_id == organization_id
                    )
                )
            ).scalar_one()
        )
        return f"INC-{1001 + count}"

    @staticmethod
    async def list_paginated(
        db: AsyncSession,
        *,
        organization_id: uuid.UUID,
        requester_only_user_id: uuid.UUID | None = None,
        status: str | None = None,
        priority: str | None = None,
        category: str | None = None,
        assignee_user_id: uuid.UUID | None = None,
        sla_breached: bool | None = None,
        search: str | None = None,
        sort_by: str | None = None,
        sort_dir: Literal["asc", "desc"] = "desc",
        page: int = 1,
        page_size: int = 25,
    ) -> tuple[list[Incident], PageMeta]:
        stmt = (
            select(Incident)
            .options(
                selectinload(Incident.activities),
                selectinload(Incident.attachments),
                selectinload(Incident.relations),
            )
            .where(
                Incident.organization_id == organization_id,
                Incident.deleted_at.is_(None),
            )
        )

        if requester_only_user_id is not None:
            stmt = stmt.where(Incident.requester_user_id == requester_only_user_id)
        if status:
            stmt = stmt.where(Incident.status == status)
        if priority:
            stmt = stmt.where(Incident.priority == priority)
        if category:
            stmt = stmt.where(Incident.category == category)
        if assignee_user_id:
            stmt = stmt.where(Incident.assignee_user_id == assignee_user_id)
        if sla_breached is not None:
            stmt = stmt.where(Incident.sla_breached == sla_breached)
        if search and search.strip():
            term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Incident.number.ilike(term),
                    Incident.title.ilike(term),
                    Incident.description.ilike(term),
                    Incident.assignee_name.ilike(term),
                    Incident.requester_email.ilike(term),
                )
            )

        stmt = apply_sorting(
            stmt,
            sort_by=sort_by,
            sort_dir=sort_dir,
            allowed_columns=INCIDENT_SORT_COLUMNS,
            default_sort="created_at",
        )
        return await paginate_scalars(db, stmt, page=page, page_size=page_size)

    @staticmethod
    async def get_by_id(
        db: AsyncSession,
        *,
        organization_id: uuid.UUID,
        incident_id: uuid.UUID,
        for_update: bool = False,
    ) -> Incident | None:
        stmt = (
            select(Incident)
            .options(
                selectinload(Incident.activities),
                selectinload(Incident.attachments),
                selectinload(Incident.relations),
            )
            .where(
                Incident.id == incident_id,
                Incident.organization_id == organization_id,
                Incident.deleted_at.is_(None),
            )
        )
        if for_update:
            stmt = stmt.with_for_update()
        return (await db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    async def list_activities(
        db: AsyncSession,
        *,
        organization_id: uuid.UUID,
        incident_id: uuid.UUID,
    ) -> list[IncidentActivity]:
        rows = (
            await db.execute(
                select(IncidentActivity)
                .where(
                    IncidentActivity.organization_id == organization_id,
                    IncidentActivity.incident_id == incident_id,
                )
                .order_by(IncidentActivity.created_at.asc())
            )
        ).scalars().all()
        return list(rows)

    @staticmethod
    async def get_relation(
        db: AsyncSession,
        *,
        organization_id: uuid.UUID,
        incident_id: uuid.UUID,
        relation_id: uuid.UUID,
    ) -> IncidentRelation | None:
        return (
            await db.execute(
                select(IncidentRelation).where(
                    IncidentRelation.id == relation_id,
                    IncidentRelation.incident_id == incident_id,
                    IncidentRelation.organization_id == organization_id,
                )
            )
        ).scalar_one_or_none()

    @staticmethod
    async def list_attachments(
        db: AsyncSession,
        *,
        organization_id: uuid.UUID,
        incident_id: uuid.UUID,
    ) -> list[IncidentAttachment]:
        rows = (
            await db.execute(
                select(IncidentAttachment)
                .where(
                    IncidentAttachment.organization_id == organization_id,
                    IncidentAttachment.incident_id == incident_id,
                )
                .order_by(IncidentAttachment.created_at.asc())
            )
        ).scalars().all()
        return list(rows)
