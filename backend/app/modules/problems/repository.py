from __future__ import annotations

import uuid
from typing import Literal

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.pagination import PageMeta, apply_sorting, paginate_scalars
from app.db.models.itsm import Problem, ProblemIncidentLink

PROBLEM_SORT_COLUMNS = {
    "created_at": Problem.created_at,
    "updated_at": Problem.updated_at,
    "severity": Problem.severity,
    "status": Problem.status,
    "number": Problem.number,
}


class ProblemRepository:
    """Tenant-scoped SQLAlchemy repository for Problems & KEDB links."""

    @staticmethod
    async def next_number(db: AsyncSession, organization_id: uuid.UUID) -> str:
        count = int(
            (
                await db.execute(
                    select(func.count(Problem.id)).where(
                        Problem.organization_id == organization_id
                    )
                )
            ).scalar_one()
        )
        return f"PRB-{3001 + count}"

    @staticmethod
    async def list_paginated(
        db: AsyncSession,
        *,
        organization_id: uuid.UUID,
        status: str | None = None,
        severity: str | None = None,
        is_known_error: bool | None = None,
        search: str | None = None,
        sort_by: str | None = None,
        sort_dir: Literal["asc", "desc"] = "desc",
        page: int = 1,
        page_size: int = 25,
    ) -> tuple[list[Problem], PageMeta]:
        stmt = (
            select(Problem)
            .options(selectinload(Problem.incident_links))
            .where(
                Problem.organization_id == organization_id,
                Problem.deleted_at.is_(None),
            )
        )
        if status:
            stmt = stmt.where(Problem.status == status)
        if severity:
            stmt = stmt.where(Problem.severity == severity)
        if is_known_error is not None:
            stmt = stmt.where(Problem.is_known_error == is_known_error)
        if search and search.strip():
            term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Problem.number.ilike(term),
                    Problem.title.ilike(term),
                    Problem.root_cause_analysis.ilike(term),
                    Problem.workaround.ilike(term),
                )
            )
        stmt = apply_sorting(
            stmt,
            sort_by=sort_by,
            sort_dir=sort_dir,
            allowed_columns=PROBLEM_SORT_COLUMNS,
            default_sort="created_at",
        )
        return await paginate_scalars(db, stmt, page=page, page_size=page_size)

    @staticmethod
    async def get_by_id(
        db: AsyncSession,
        *,
        organization_id: uuid.UUID,
        problem_id: uuid.UUID,
        for_update: bool = False,
    ) -> Problem | None:
        stmt = (
            select(Problem)
            .options(selectinload(Problem.incident_links))
            .where(
                Problem.id == problem_id,
                Problem.organization_id == organization_id,
                Problem.deleted_at.is_(None),
            )
        )
        if for_update:
            stmt = stmt.with_for_update()
        return (await db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    async def get_incident_link(
        db: AsyncSession,
        *,
        organization_id: uuid.UUID,
        problem_id: uuid.UUID,
        incident_id: uuid.UUID,
    ) -> ProblemIncidentLink | None:
        return (
            await db.execute(
                select(ProblemIncidentLink).where(
                    ProblemIncidentLink.organization_id == organization_id,
                    ProblemIncidentLink.problem_id == problem_id,
                    ProblemIncidentLink.incident_id == incident_id,
                )
            )
        ).scalar_one_or_none()
