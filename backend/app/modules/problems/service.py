from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.core.pagination import PageMeta
from app.core.tenant import AuthenticatedPrincipal
from app.db.models.itsm import Incident, Problem, ProblemIncidentLink
from app.db.session import set_transaction_tenant_context
from app.modules.audit.service import AuditService
from app.modules.problems.repository import ProblemRepository
from app.modules.problems.schemas import (
    KnownErrorPublishRequest,
    ProblemCreateRequest,
    ProblemOut,
    ProblemUpdateRequest,
)


def _to_out(p: Problem) -> ProblemOut:
    return ProblemOut(
        id=p.id,
        organization_id=p.organization_id,
        number=p.number,
        title=p.title,
        description=p.description,
        status=p.status,
        severity=p.severity,
        root_cause_analysis=p.root_cause_analysis,
        workaround=p.workaround,
        permanent_solution=p.permanent_solution,
        owner_user_id=p.owner_user_id,
        owner_name=p.owner_name,
        is_known_error=p.is_known_error,
        known_error_published_at=p.known_error_published_at,
        linked_change_id=p.linked_change_id,
        linked_incident_ids=[link.incident_id for link in p.incident_links],
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


class ProblemService:
    """Tenant-scoped Problem Management, RCA, Workarounds, and KEDB service."""

    @staticmethod
    async def list_problems(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        status: str | None = None,
        severity: str | None = None,
        is_known_error: bool | None = None,
        search: str | None = None,
        sort_by: str | None = None,
        sort_dir: Literal["asc", "desc"] = "desc",
        page: int = 1,
        page_size: int = 25,
    ) -> tuple[list[ProblemOut], PageMeta]:
        await set_transaction_tenant_context(db, principal.organization_id)
        rows, meta = await ProblemRepository.list_paginated(
            db,
            organization_id=principal.organization_id,
            status=status,
            severity=severity,
            is_known_error=is_known_error,
            search=search,
            sort_by=sort_by,
            sort_dir=sort_dir,
            page=page,
            page_size=page_size,
        )
        return [_to_out(r) for r in rows], meta

    @staticmethod
    async def get_problem(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        problem_id: uuid.UUID,
    ) -> ProblemOut:
        await set_transaction_tenant_context(db, principal.organization_id)
        problem = await ProblemRepository.get_by_id(
            db, organization_id=principal.organization_id, problem_id=problem_id
        )
        if problem is None:
            raise NotFoundError("Problem record not found.")
        return _to_out(problem)

    @staticmethod
    async def create_problem(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: ProblemCreateRequest,
        request: Request | None = None,
    ) -> ProblemOut:
        await set_transaction_tenant_context(db, principal.organization_id)
        number = await ProblemRepository.next_number(db, principal.organization_id)
        problem = Problem(
            organization_id=principal.organization_id,
            number=number,
            title=payload.title.strip(),
            description=payload.description.strip(),
            status="investigating",
            severity=payload.severity,
            root_cause_analysis=payload.root_cause_analysis.strip(),
            workaround=payload.workaround.strip(),
            permanent_solution=payload.permanent_solution.strip(),
            owner_user_id=principal.user_id,
            owner_name=principal.full_name,
            linked_change_id=payload.linked_change_id,
        )
        db.add(problem)
        await db.flush()

        for inc_id in dict.fromkeys(payload.linked_incident_ids):
            inc = (
                await db.execute(
                    select(Incident).where(
                        Incident.id == inc_id,
                        Incident.organization_id == principal.organization_id,
                        Incident.deleted_at.is_(None),
                    )
                )
            ).scalar_one_or_none()
            if inc is not None:
                db.add(
                    ProblemIncidentLink(
                        organization_id=principal.organization_id,
                        problem_id=problem.id,
                        incident_id=inc.id,
                        linked_by_email=principal.email,
                    )
                )

        await AuditService.record(
            db,
            action="PROBLEM_CREATED",
            module="problems",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="problem",
            target_id=str(problem.id),
            outcome="success",
            detail=f"Created problem {problem.number}: {problem.title}.",
            request=request,
        )
        await db.flush()
        fresh = await ProblemRepository.get_by_id(
            db, organization_id=principal.organization_id, problem_id=problem.id
        )
        return _to_out(fresh)  # type: ignore[arg-type]

    @staticmethod
    async def update_problem(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        problem_id: uuid.UUID,
        payload: ProblemUpdateRequest,
        request: Request | None = None,
    ) -> ProblemOut:
        await set_transaction_tenant_context(db, principal.organization_id)
        problem = await ProblemRepository.get_by_id(
            db, organization_id=principal.organization_id, problem_id=problem_id, for_update=True
        )
        if problem is None:
            raise NotFoundError("Problem record not found.")

        updates = payload.model_dump(exclude_unset=True)
        for field, val in updates.items():
            setattr(problem, field, val)
        if updates.get("is_known_error") and problem.known_error_published_at is None:
            problem.known_error_published_at = datetime.now(timezone.utc)

        await AuditService.record(
            db,
            action="PROBLEM_UPDATED",
            module="problems",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="problem",
            target_id=str(problem.id),
            outcome="success",
            detail=f"Updated problem {problem.number}.",
            metadata={"fields": list(updates.keys())},
            request=request,
        )
        await db.flush()
        fresh = await ProblemRepository.get_by_id(
            db, organization_id=principal.organization_id, problem_id=problem.id
        )
        return _to_out(fresh)  # type: ignore[arg-type]

    @staticmethod
    async def publish_known_error(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        problem_id: uuid.UUID,
        payload: KnownErrorPublishRequest,
        request: Request | None = None,
    ) -> ProblemOut:
        await set_transaction_tenant_context(db, principal.organization_id)
        problem = await ProblemRepository.get_by_id(
            db, organization_id=principal.organization_id, problem_id=problem_id, for_update=True
        )
        if problem is None:
            raise NotFoundError("Problem record not found.")

        problem.root_cause_analysis = payload.root_cause_analysis.strip()
        problem.workaround = payload.workaround.strip()
        problem.is_known_error = True
        problem.known_error_published_at = datetime.now(timezone.utc)
        if problem.status in {"investigating", "root_cause_identified"}:
            problem.status = "workaround_published"

        await AuditService.record(
            db,
            action="KNOWN_ERROR_PUBLISHED",
            module="problems",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="problem",
            target_id=str(problem.id),
            outcome="success",
            detail=f"Published {problem.number} to Known Error Database (KEDB).",
            request=request,
        )
        await db.flush()
        return _to_out(problem)

    @staticmethod
    async def link_incident(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        problem_id: uuid.UUID,
        incident_id: uuid.UUID,
    ) -> ProblemOut:
        await set_transaction_tenant_context(db, principal.organization_id)
        problem = await ProblemRepository.get_by_id(
            db, organization_id=principal.organization_id, problem_id=problem_id
        )
        if problem is None:
            raise NotFoundError("Problem record not found.")
        inc = (
            await db.execute(
                select(Incident).where(
                    Incident.id == incident_id,
                    Incident.organization_id == principal.organization_id,
                    Incident.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if inc is None:
            raise NotFoundError("Incident not found in this organization.")

        existing = await ProblemRepository.get_incident_link(
            db,
            organization_id=principal.organization_id,
            problem_id=problem_id,
            incident_id=incident_id,
        )
        if existing is not None:
            raise ConflictError("Incident is already linked to this problem.")

        db.add(
            ProblemIncidentLink(
                organization_id=principal.organization_id,
                problem_id=problem.id,
                incident_id=inc.id,
                linked_by_email=principal.email,
            )
        )
        await db.flush()
        fresh = await ProblemRepository.get_by_id(
            db, organization_id=principal.organization_id, problem_id=problem.id
        )
        return _to_out(fresh)  # type: ignore[arg-type]

    @staticmethod
    async def unlink_incident(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        problem_id: uuid.UUID,
        incident_id: uuid.UUID,
    ) -> None:
        await set_transaction_tenant_context(db, principal.organization_id)
        existing = await ProblemRepository.get_incident_link(
            db,
            organization_id=principal.organization_id,
            problem_id=problem_id,
            incident_id=incident_id,
        )
        if existing is None:
            raise NotFoundError("Problem-incident link not found.")
        await db.delete(existing)
        await db.flush()
