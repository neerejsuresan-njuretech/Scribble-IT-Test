from __future__ import annotations

import uuid
from typing import Literal

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, NotFoundError, ValidationDomainError
from app.core.pagination import PageMeta
from app.core.tenant import AuthenticatedPrincipal
from app.db.models.identity import OrganizationMembership
from app.db.models.itsm import ChangeActivity, ChangeRequest
from app.db.models.operations import Notification
from app.db.session import set_transaction_tenant_context
from app.modules.approvals.schemas import (
    CabSeatCreateRequest,
    CabSeatOut,
    CabSeatReassignRequest,
    CabVoteRequest,
)
from app.modules.approvals.service import ApprovalsService
from app.modules.audit.service import AuditService
from app.modules.changes.repository import ChangeRepository
from app.modules.changes.schemas import (
    CabMemberSpec,
    ChangeActivityOut,
    ChangeCreateRequest,
    ChangeRequestOut,
    ChangeStatusTransitionRequest,
    ChangeUpdateRequest,
)


class ChangeService:
    """Change Management service coordinated with CAB voting seats and immutable change history."""

    @staticmethod
    async def _serialize(db: AsyncSession, chg: ChangeRequest) -> ChangeRequestOut:
        seats = await ChangeRepository.list_cab_seats(
            db, organization_id=chg.organization_id, change_number=chg.number
        )
        return ChangeRequestOut(
            id=chg.id,
            organization_id=chg.organization_id,
            number=chg.number,
            title=chg.title,
            change_type=chg.change_type,
            status=chg.status,
            risk_score=chg.risk_score,
            risk_assessment=chg.risk_assessment,
            reason=chg.reason,
            implementation_plan=chg.implementation_plan,
            rollback_plan=chg.rollback_plan,
            test_plan=chg.test_plan,
            scheduled_start=chg.scheduled_start,
            scheduled_end=chg.scheduled_end,
            requester_user_id=chg.requester_user_id,
            requester_name=chg.requester_name,
            requester_email=chg.requester_email,
            assigned_engineer_user_id=chg.assigned_engineer_user_id,
            assigned_engineer_name=chg.assigned_engineer_name,
            created_at=chg.created_at,
            updated_at=chg.updated_at,
            cab_seats=[CabSeatOut.model_validate(s) for s in seats],
            activities=[ChangeActivityOut.model_validate(a) for a in chg.activities],
        )

    @staticmethod
    async def list_changes(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        status: str | None = None,
        change_type: str | None = None,
        risk_score: str | None = None,
        search: str | None = None,
        sort_by: str | None = None,
        sort_dir: Literal["asc", "desc"] = "desc",
        page: int = 1,
        page_size: int = 25,
    ) -> tuple[list[ChangeRequestOut], PageMeta]:
        await set_transaction_tenant_context(db, principal.organization_id)
        rows, meta = await ChangeRepository.list_paginated(
            db,
            organization_id=principal.organization_id,
            status=status,
            change_type=change_type,
            risk_score=risk_score,
            search=search,
            sort_by=sort_by,
            sort_dir=sort_dir,
            page=page,
            page_size=page_size,
        )
        return [await ChangeService._serialize(db, r) for r in rows], meta

    @staticmethod
    async def get_change(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        change_id: uuid.UUID,
    ) -> ChangeRequestOut:
        await set_transaction_tenant_context(db, principal.organization_id)
        chg = await ChangeRepository.get_by_id(
            db, organization_id=principal.organization_id, change_id=change_id
        )
        if chg is None:
            raise NotFoundError("Change request not found.")
        return await ChangeService._serialize(db, chg)

    @staticmethod
    async def create_change(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: ChangeCreateRequest,
        request: Request | None = None,
    ) -> ChangeRequestOut:
        await set_transaction_tenant_context(db, principal.organization_id)
        if (
            payload.scheduled_start
            and payload.scheduled_end
            and payload.scheduled_end <= payload.scheduled_start
        ):
            raise ValidationDomainError("scheduled_end must be after scheduled_start.")

        engineer_id = payload.assigned_engineer_user_id
        engineer_name = "Unassigned"
        if engineer_id is not None:
            mem = (
                await db.execute(
                    select(OrganizationMembership)
                    .options(selectinload(OrganizationMembership.user))
                    .where(
                        OrganizationMembership.organization_id == principal.organization_id,
                        OrganizationMembership.user_id == engineer_id,
                        OrganizationMembership.status == "active",
                        OrganizationMembership.deleted_at.is_(None),
                    )
                )
            ).scalar_one_or_none()
            if mem is None or mem.user is None:
                raise NotFoundError("Assigned engineer does not belong to this organization.")
            engineer_name = mem.user.full_name

        number = await ChangeRepository.next_number(db, principal.organization_id)
        initial_status = (
            "scheduled"
            if payload.change_type == "standard"
            else ("cab_review" if payload.cab_seats else "draft")
        )
        chg = ChangeRequest(
            organization_id=principal.organization_id,
            number=number,
            title=payload.title.strip(),
            change_type=payload.change_type,
            status=initial_status,
            risk_score=payload.risk_score,
            risk_assessment=payload.risk_assessment,
            reason=payload.reason.strip(),
            implementation_plan=payload.implementation_plan.strip(),
            rollback_plan=payload.rollback_plan.strip(),
            test_plan=payload.test_plan.strip(),
            scheduled_start=payload.scheduled_start,
            scheduled_end=payload.scheduled_end,
            requester_user_id=principal.user_id,
            requester_name=principal.full_name,
            requester_email=principal.email,
            assigned_engineer_user_id=engineer_id,
            assigned_engineer_name=engineer_name,
        )
        db.add(chg)
        await db.flush()

        for spec in payload.cab_seats:
            seat = await ApprovalsService.create_cab_seat(
                db,
                principal=principal,
                payload=CabSeatCreateRequest(
                    change_ref=chg.number,
                    change_title=chg.title,
                    seat_name=spec.seat_name,
                    requester_user_id=principal.user_id,
                    assigned_member_user_id=spec.assigned_member_user_id,
                ),
                request=request,
            )
            db.add(
                Notification(
                    organization_id=principal.organization_id,
                    recipient_user_id=seat.assigned_member_user_id,
                    category="cab",
                    title=f"CAB Vote Requested: {chg.number}",
                    message=f"{chg.title} ({spec.seat_name})",
                    record_type="change_request",
                    record_id=str(chg.id),
                )
            )

        db.add(
            ChangeActivity(
                organization_id=principal.organization_id,
                change_request_id=chg.id,
                actor_user_id=principal.user_id,
                actor_email=principal.email,
                activity_type="audit",
                action="CHANGE_CREATED",
                note=(
                    f"Created {chg.change_type} change {chg.number} (risk={chg.risk_score}) "
                    f"with {len(payload.cab_seats)} CAB voting seat(s)."
                ),
                field_changes=[{"field": "status", "from": "none", "to": initial_status}],
            )
        )
        await AuditService.record(
            db,
            action="CHANGE_REQUEST_CREATED",
            module="changes",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="change_request",
            target_id=str(chg.id),
            outcome="success",
            detail=f"Created change {chg.number}: {chg.title}.",
            request=request,
        )
        await db.flush()
        fresh = await ChangeRepository.get_by_id(
            db, organization_id=principal.organization_id, change_id=chg.id
        )
        return await ChangeService._serialize(db, fresh)  # type: ignore[arg-type]

    @staticmethod
    async def update_change(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        change_id: uuid.UUID,
        payload: ChangeUpdateRequest,
        request: Request | None = None,
    ) -> ChangeRequestOut:
        await set_transaction_tenant_context(db, principal.organization_id)
        chg = await ChangeRepository.get_by_id(
            db, organization_id=principal.organization_id, change_id=change_id, for_update=True
        )
        if chg is None:
            raise NotFoundError("Change request not found.")
        if chg.status in {"completed", "cancelled"}:
            raise ConflictError(f"Change {chg.number} is '{chg.status}' and cannot be edited.")

        updates = payload.model_dump(exclude_unset=True)
        note = updates.pop("note", None)
        changes: list[dict[str, str]] = []

        if "assigned_engineer_user_id" in updates:
            eng_id = updates.pop("assigned_engineer_user_id")
            if eng_id is None:
                chg.assigned_engineer_user_id = None
                chg.assigned_engineer_name = "Unassigned"
            else:
                mem = (
                    await db.execute(
                        select(OrganizationMembership)
                        .options(selectinload(OrganizationMembership.user))
                        .where(
                            OrganizationMembership.organization_id == principal.organization_id,
                            OrganizationMembership.user_id == eng_id,
                            OrganizationMembership.status == "active",
                            OrganizationMembership.deleted_at.is_(None),
                        )
                    )
                ).scalar_one_or_none()
                if mem is None or mem.user is None:
                    raise NotFoundError("Assigned engineer not found in this organization.")
                changes.append(
                    {
                        "field": "assigned_engineer",
                        "from": chg.assigned_engineer_name,
                        "to": mem.user.full_name,
                    }
                )
                chg.assigned_engineer_user_id = mem.user.id
                chg.assigned_engineer_name = mem.user.full_name

        for field, value in updates.items():
            old_val = getattr(chg, field)
            if old_val != value:
                changes.append({"field": field, "from": str(old_val), "to": str(value)})
                setattr(chg, field, value)

        if chg.scheduled_start and chg.scheduled_end and chg.scheduled_end <= chg.scheduled_start:
            raise ValidationDomainError("scheduled_end must be after scheduled_start.")

        if changes or note:
            db.add(
                ChangeActivity(
                    organization_id=principal.organization_id,
                    change_request_id=chg.id,
                    actor_user_id=principal.user_id,
                    actor_email=principal.email,
                    activity_type="field_change" if changes else "work_note",
                    action="CHANGE_UPDATED",
                    note=note or f"Updated {', '.join(c['field'] for c in changes)}.",
                    field_changes=changes,
                )
            )
            await AuditService.record(
                db,
                action="CHANGE_REQUEST_UPDATED",
                module="changes",
                actor_email=principal.email,
                actor_user_id=principal.user_id,
                organization_id=principal.organization_id,
                portal_type=principal.portal_type,
                target_type="change_request",
                target_id=str(chg.id),
                outcome="success",
                detail=f"Updated change {chg.number}.",
                request=request,
            )

        await db.flush()
        fresh = await ChangeRepository.get_by_id(
            db, organization_id=principal.organization_id, change_id=chg.id
        )
        return await ChangeService._serialize(db, fresh)  # type: ignore[arg-type]

    @staticmethod
    async def add_cab_seat(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        change_id: uuid.UUID,
        payload: CabMemberSpec,
        request: Request | None = None,
    ) -> ChangeRequestOut:
        await set_transaction_tenant_context(db, principal.organization_id)
        chg = await ChangeRepository.get_by_id(
            db, organization_id=principal.organization_id, change_id=change_id, for_update=True
        )
        if chg is None:
            raise NotFoundError("Change request not found.")
        seat = await ApprovalsService.create_cab_seat(
            db,
            principal=principal,
            payload=CabSeatCreateRequest(
                change_ref=chg.number,
                change_title=chg.title,
                seat_name=payload.seat_name,
                requester_user_id=chg.requester_user_id,
                assigned_member_user_id=payload.assigned_member_user_id,
            ),
            request=request,
        )
        if chg.status == "draft":
            chg.status = "cab_review"
        db.add(
            ChangeActivity(
                organization_id=principal.organization_id,
                change_request_id=chg.id,
                actor_user_id=principal.user_id,
                actor_email=principal.email,
                activity_type="audit",
                action="CAB_SEAT_ADDED",
                note=f"Added CAB seat '{seat.seat_name}' assigned to {seat.assigned_member_email}.",
            )
        )
        await db.flush()
        fresh = await ChangeRepository.get_by_id(
            db, organization_id=principal.organization_id, change_id=chg.id
        )
        return await ChangeService._serialize(db, fresh)  # type: ignore[arg-type]

    @staticmethod
    async def cast_cab_vote(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        change_id: uuid.UUID,
        seat_id: uuid.UUID,
        payload: CabVoteRequest,
        request: Request | None = None,
    ) -> ChangeRequestOut:
        await set_transaction_tenant_context(db, principal.organization_id)
        chg = await ChangeRepository.get_by_id(
            db, organization_id=principal.organization_id, change_id=change_id, for_update=True
        )
        if chg is None:
            raise NotFoundError("Change request not found.")

        seat = await ApprovalsService.cast_cab_vote(
            db,
            principal=principal,
            seat_id=seat_id,
            payload=payload,
            request=request,
        )
        if seat.change_ref != chg.number:
            raise ValidationDomainError("CAB voting seat does not belong to this change request.")

        all_seats = await ChangeRepository.list_cab_seats(
            db, organization_id=principal.organization_id, change_number=chg.number
        )
        prev_status = chg.status
        if any(s.vote == "reject" for s in all_seats):
            chg.status = "cancelled"
        elif all_seats and all(s.vote in {"approve", "abstain"} for s in all_seats) and any(
            s.vote == "approve" for s in all_seats
        ):
            chg.status = "scheduled"

        field_changes = (
            [{"field": "status", "from": prev_status, "to": chg.status}]
            if prev_status != chg.status
            else []
        )
        db.add(
            ChangeActivity(
                organization_id=principal.organization_id,
                change_request_id=chg.id,
                actor_user_id=principal.user_id,
                actor_email=principal.email,
                activity_type="audit",
                action=f"CAB_VOTE_{seat.vote.upper()}",
                note=(
                    f"Seat '{seat.seat_name}' voted '{seat.vote}' by {principal.email}"
                    + (" (Super Admin override)" if seat.override_used else "")
                    + "."
                ),
                field_changes=field_changes,
            )
        )
        await db.flush()
        fresh = await ChangeRepository.get_by_id(
            db, organization_id=principal.organization_id, change_id=chg.id
        )
        return await ChangeService._serialize(db, fresh)  # type: ignore[arg-type]

    @staticmethod
    async def reassign_cab_seat(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        change_id: uuid.UUID,
        seat_id: uuid.UUID,
        payload: CabSeatReassignRequest,
        request: Request | None = None,
    ) -> ChangeRequestOut:
        await set_transaction_tenant_context(db, principal.organization_id)
        chg = await ChangeRepository.get_by_id(
            db, organization_id=principal.organization_id, change_id=change_id, for_update=True
        )
        if chg is None:
            raise NotFoundError("Change request not found.")
        seat = await ApprovalsService.reassign_cab_seat(
            db,
            principal=principal,
            seat_id=seat_id,
            payload=payload,
            request=request,
        )
        db.add(
            ChangeActivity(
                organization_id=principal.organization_id,
                change_request_id=chg.id,
                actor_user_id=principal.user_id,
                actor_email=principal.email,
                activity_type="audit",
                action="CAB_SEAT_REASSIGNED",
                note=f"Seat '{seat.seat_name}' reassigned to {seat.assigned_member_email}.",
            )
        )
        await db.flush()
        fresh = await ChangeRepository.get_by_id(
            db, organization_id=principal.organization_id, change_id=chg.id
        )
        return await ChangeService._serialize(db, fresh)  # type: ignore[arg-type]

    @staticmethod
    async def transition_status(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        change_id: uuid.UUID,
        payload: ChangeStatusTransitionRequest,
        request: Request | None = None,
    ) -> ChangeRequestOut:
        await set_transaction_tenant_context(db, principal.organization_id)
        chg = await ChangeRepository.get_by_id(
            db, organization_id=principal.organization_id, change_id=change_id, for_update=True
        )
        if chg is None:
            raise NotFoundError("Change request not found.")

        # Enforce CAB approval gate before normal changes enter scheduled/implementation
        if (
            chg.change_type == "normal"
            and payload.status in {"scheduled", "implementation", "verification", "completed"}
            and not principal.is_super_admin
        ):
            seats = await ChangeRepository.list_cab_seats(
                db, organization_id=principal.organization_id, change_number=chg.number
            )
            if not seats or any(s.vote == "reject" for s in seats) or not all(
                s.vote in {"approve", "abstain"} for s in seats
            ):
                raise ConflictError(
                    "Normal changes require CAB approval across all assigned seats before scheduling or implementation."
                )

        prev = chg.status
        chg.status = payload.status
        db.add(
            ChangeActivity(
                organization_id=principal.organization_id,
                change_request_id=chg.id,
                actor_user_id=principal.user_id,
                actor_email=principal.email,
                activity_type="field_change",
                action="CHANGE_STATUS_TRANSITION",
                note=payload.note.strip() or f"Transitioned change from {prev} to {payload.status}.",
                field_changes=[{"field": "status", "from": prev, "to": payload.status}],
            )
        )
        await AuditService.record(
            db,
            action="CHANGE_STATUS_UPDATED",
            module="changes",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="change_request",
            target_id=str(chg.id),
            outcome="success",
            detail=f"Change {chg.number} status: {prev} -> {payload.status}.",
            request=request,
        )
        await db.flush()
        fresh = await ChangeRepository.get_by_id(
            db, organization_id=principal.organization_id, change_id=chg.id
        )
        return await ChangeService._serialize(db, fresh)  # type: ignore[arg-type]
