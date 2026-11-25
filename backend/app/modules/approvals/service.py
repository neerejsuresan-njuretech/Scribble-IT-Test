from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    AuthorizationError,
    ConflictError,
    NotFoundError,
    ValidationDomainError,
)
from app.core.tenant import AuthenticatedPrincipal
from app.db.models.approvals import (
    ApprovalAssignmentHistory,
    ApprovalWorkflowItem,
    CabSeatAssignmentHistory,
    CabVotingSeat,
)
from app.db.models.identity import OrganizationMembership, User
from app.db.session import set_transaction_tenant_context
from app.modules.approvals.schemas import (
    ApprovalDecisionRequest,
    ApprovalItemCreateRequest,
    ApprovalReassignRequest,
    CabSeatCreateRequest,
    CabSeatReassignRequest,
    CabVoteRequest,
)
from app.modules.audit.service import AuditService


async def _resolve_org_member_user(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
) -> User:
    membership = (
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
    if membership is None or membership.user is None or membership.user.status != "active":
        raise NotFoundError("Target user does not hold an active membership in this organization.")
    return membership.user


class ApprovalsService:
    """
    Transactional designated approval and Change Advisory Board (CAB) voting service.
    Uses row-level locking (`SELECT ... FOR UPDATE`) to prevent duplicate or conflicting decisions.
    """

    # ------------------------------------------------------------------
    # Service Request Designated Approvals
    # ------------------------------------------------------------------

    @staticmethod
    async def create_approval_item(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: ApprovalItemCreateRequest,
        request: Request | None = None,
    ) -> ApprovalWorkflowItem:
        await set_transaction_tenant_context(db, principal.organization_id)

        requester_id = payload.requester_user_id or principal.user_id
        requester = await _resolve_org_member_user(
            db, organization_id=principal.organization_id, user_id=requester_id
        )
        approver = await _resolve_org_member_user(
            db,
            organization_id=principal.organization_id,
            user_id=payload.assigned_approver_user_id,
        )

        item = ApprovalWorkflowItem(
            organization_id=principal.organization_id,
            subject_type="service_request",
            subject_ref=payload.subject_ref.strip(),
            title=payload.title.strip(),
            stage_order=payload.stage_order,
            requester_user_id=requester.id,
            requester_email=requester.email,
            assigned_approver_user_id=approver.id,
            assigned_approver_email=approver.email,
            status="pending",
            version=1,
        )
        db.add(item)
        await db.flush()

        db.add(
            ApprovalAssignmentHistory(
                organization_id=principal.organization_id,
                approval_item_id=item.id,
                previous_approver_user_id=None,
                previous_approver_email=None,
                new_approver_user_id=approver.id,
                new_approver_email=approver.email,
                reassigned_by_user_id=principal.user_id,
                reassigned_by_email=principal.email,
                reason="Initial approver designation",
            )
        )
        await db.flush()

        await AuditService.record(
            db,
            action="APPROVAL_STAGE_CREATED",
            module="approvals",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="approval_item",
            target_id=str(item.id),
            outcome="success",
            detail=f"Created approval stage for '{item.subject_ref}' assigned to {approver.email}.",
            metadata={"subject_ref": item.subject_ref, "assigned_approver": approver.email},
            request=request,
        )
        return item

    @staticmethod
    async def list_approval_items(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
    ) -> list[ApprovalWorkflowItem]:
        await set_transaction_tenant_context(db, principal.organization_id)
        rows = (
            await db.execute(
                select(ApprovalWorkflowItem)
                .where(ApprovalWorkflowItem.organization_id == principal.organization_id)
                .order_by(ApprovalWorkflowItem.created_at.desc())
            )
        ).scalars().all()
        return list(rows)

    @staticmethod
    async def decide_approval_item(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        approval_id: uuid.UUID,
        payload: ApprovalDecisionRequest,
        request: Request | None = None,
    ) -> ApprovalWorkflowItem:
        await set_transaction_tenant_context(db, principal.organization_id)

        # Acquire row-level lock to prevent race-condition duplicate or conflicting decisions
        item = (
            await db.execute(
                select(ApprovalWorkflowItem)
                .where(
                    ApprovalWorkflowItem.id == approval_id,
                    ApprovalWorkflowItem.organization_id == principal.organization_id,
                )
                .with_for_update()
            )
        ).scalar_one_or_none()
        if item is None:
            raise NotFoundError("Approval item not found.")

        if item.status != "pending":
            raise ConflictError(
                f"Approval item '{item.subject_ref}' has already been decided ({item.status})."
            )

        override_used = False
        if payload.override:
            if not principal.is_super_admin:
                await AuditService.record(
                    db,
                    action="APPROVAL_OVERRIDE_DENIED",
                    module="approvals",
                    actor_email=principal.email,
                    actor_user_id=principal.user_id,
                    organization_id=principal.organization_id,
                    portal_type=principal.portal_type,
                    target_type="approval_item",
                    target_id=str(item.id),
                    outcome="denied",
                    detail="Non-Super-Admin attempted an approval override.",
                    request=request,
                )
                raise AuthorizationError(
                    "Approval overrides are exclusively restricted to Super Admin Portal sessions."
                )
            if not payload.override_reason or len(payload.override_reason.strip()) < 5:
                raise ValidationDomainError(
                    "Super Admin approval overrides require an explicit audit justification (min 5 chars)."
                )
            override_used = True
        else:
            # Rule 1: Requesters cannot approve their own requests under ordinary permissions
            if item.requester_user_id == principal.user_id:
                await AuditService.record(
                    db,
                    action="APPROVAL_SELF_APPROVAL_BLOCKED",
                    module="approvals",
                    actor_email=principal.email,
                    actor_user_id=principal.user_id,
                    organization_id=principal.organization_id,
                    portal_type=principal.portal_type,
                    target_type="approval_item",
                    target_id=str(item.id),
                    outcome="denied",
                    detail=f"Blocked requester self-approval attempt on '{item.subject_ref}'.",
                    request=request,
                )
                raise AuthorizationError(
                    "Segregation of duties violation: requesters cannot approve or reject their own request."
                )

            # Rule 2: Only the designated assigned approver (with requests:approve scope) can decide
            if (
                not principal.has_permission("requests:approve")
                or item.assigned_approver_user_id != principal.user_id
            ):
                await AuditService.record(
                    db,
                    action="APPROVAL_UNAUTHORIZED_ATTEMPT",
                    module="approvals",
                    actor_email=principal.email,
                    actor_user_id=principal.user_id,
                    organization_id=principal.organization_id,
                    portal_type=principal.portal_type,
                    target_type="approval_item",
                    target_id=str(item.id),
                    outcome="denied",
                    detail=(
                        f"Blocked unauthorized approval attempt on '{item.subject_ref}'. "
                        f"Assigned approver is {item.assigned_approver_email}."
                    ),
                    request=request,
                )
                raise AuthorizationError(
                    "Only the designated assigned approver with 'requests:approve' scope can decide this stage."
                )

        now = datetime.now(timezone.utc)
        item.status = payload.decision
        item.decision_by_user_id = principal.user_id
        item.decision_by_email = principal.email
        item.decision_note = payload.note.strip() if payload.note else None
        item.decided_at = now
        item.override_used = override_used
        item.override_reason = payload.override_reason.strip() if override_used and payload.override_reason else None
        item.version += 1
        await db.flush()

        await AuditService.record(
            db,
            action="APPROVAL_SUPER_ADMIN_OVERRIDE" if override_used else "APPROVAL_DECISION_RECORDED",
            module="approvals",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="approval_item",
            target_id=str(item.id),
            outcome="success",
            detail=(
                f"Recorded '{item.status}' decision on '{item.subject_ref}'"
                + (" via audited Super Admin override." if override_used else ".")
            ),
            metadata={
                "subject_ref": item.subject_ref,
                "decision": item.status,
                "override_used": override_used,
                "override_reason": item.override_reason,
                "assigned_approver": item.assigned_approver_email,
            },
            request=request,
        )
        return item

    @staticmethod
    async def reassign_approval_item(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        approval_id: uuid.UUID,
        payload: ApprovalReassignRequest,
        request: Request | None = None,
    ) -> ApprovalWorkflowItem:
        if not principal.has_permission("iam:manage") and not principal.is_super_admin:
            raise AuthorizationError(
                "Only authorized administrators ('iam:manage' or Super Admin) may reassign pending approvers."
            )

        await set_transaction_tenant_context(db, principal.organization_id)
        item = (
            await db.execute(
                select(ApprovalWorkflowItem)
                .where(
                    ApprovalWorkflowItem.id == approval_id,
                    ApprovalWorkflowItem.organization_id == principal.organization_id,
                )
                .with_for_update()
            )
        ).scalar_one_or_none()
        if item is None:
            raise NotFoundError("Approval item not found.")
        if item.status != "pending":
            raise ConflictError("Cannot reassign an approval stage that has already been decided.")

        new_approver = await _resolve_org_member_user(
            db,
            organization_id=principal.organization_id,
            user_id=payload.new_approver_user_id,
        )
        if new_approver.id == item.requester_user_id:
            raise ValidationDomainError(
                "Cannot assign the original requester as the approver for their own request."
            )

        prev_id = item.assigned_approver_user_id
        prev_email = item.assigned_approver_email
        item.assigned_approver_user_id = new_approver.id
        item.assigned_approver_email = new_approver.email
        item.version += 1

        db.add(
            ApprovalAssignmentHistory(
                organization_id=principal.organization_id,
                approval_item_id=item.id,
                previous_approver_user_id=prev_id,
                previous_approver_email=prev_email,
                new_approver_user_id=new_approver.id,
                new_approver_email=new_approver.email,
                reassigned_by_user_id=principal.user_id,
                reassigned_by_email=principal.email,
                reason=payload.reason.strip(),
            )
        )
        await db.flush()

        await AuditService.record(
            db,
            action="APPROVAL_REASSIGNED",
            module="approvals",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="approval_item",
            target_id=str(item.id),
            outcome="success",
            detail=f"Reassigned approval '{item.subject_ref}' from {prev_email} to {new_approver.email}.",
            metadata={"previous_approver": prev_email, "new_approver": new_approver.email, "reason": payload.reason},
            request=request,
        )
        return item

    @staticmethod
    async def list_approval_history(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        approval_id: uuid.UUID,
    ) -> list[ApprovalAssignmentHistory]:
        await set_transaction_tenant_context(db, principal.organization_id)
        rows = (
            await db.execute(
                select(ApprovalAssignmentHistory)
                .where(
                    ApprovalAssignmentHistory.organization_id == principal.organization_id,
                    ApprovalAssignmentHistory.approval_item_id == approval_id,
                )
                .order_by(ApprovalAssignmentHistory.created_at.asc())
            )
        ).scalars().all()
        return list(rows)

    # ------------------------------------------------------------------
    # Change Advisory Board (CAB) Designated Voting
    # ------------------------------------------------------------------

    @staticmethod
    async def create_cab_seat(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: CabSeatCreateRequest,
        request: Request | None = None,
    ) -> CabVotingSeat:
        await set_transaction_tenant_context(db, principal.organization_id)

        requester_id = payload.requester_user_id or principal.user_id
        requester = await _resolve_org_member_user(
            db, organization_id=principal.organization_id, user_id=requester_id
        )
        member = await _resolve_org_member_user(
            db,
            organization_id=principal.organization_id,
            user_id=payload.assigned_member_user_id,
        )

        seat = CabVotingSeat(
            organization_id=principal.organization_id,
            change_ref=payload.change_ref.strip(),
            change_title=payload.change_title.strip(),
            seat_name=payload.seat_name.strip(),
            requester_user_id=requester.id,
            original_member_user_id=member.id,
            original_member_email=member.email,
            assigned_member_user_id=member.id,
            assigned_member_email=member.email,
            vote="pending",
            version=1,
        )
        db.add(seat)
        await db.flush()

        db.add(
            CabSeatAssignmentHistory(
                organization_id=principal.organization_id,
                cab_seat_id=seat.id,
                previous_member_user_id=None,
                previous_member_email=None,
                new_member_user_id=member.id,
                new_member_email=member.email,
                reassigned_by_user_id=principal.user_id,
                reassigned_by_email=principal.email,
                reason="Initial CAB seat assignment",
            )
        )
        await db.flush()

        await AuditService.record(
            db,
            action="CAB_SEAT_CREATED",
            module="approvals",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="cab_seat",
            target_id=str(seat.id),
            outcome="success",
            detail=f"Assigned CAB seat '{seat.seat_name}' on '{seat.change_ref}' to {member.email}.",
            metadata={"change_ref": seat.change_ref, "seat_name": seat.seat_name, "member": member.email},
            request=request,
        )
        return seat

    @staticmethod
    async def list_cab_seats(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        change_ref: str | None = None,
    ) -> list[CabVotingSeat]:
        await set_transaction_tenant_context(db, principal.organization_id)
        stmt = select(CabVotingSeat).where(
            CabVotingSeat.organization_id == principal.organization_id
        )
        if change_ref:
            stmt = stmt.where(CabVotingSeat.change_ref == change_ref.strip())
        rows = (await db.execute(stmt.order_by(CabVotingSeat.created_at.asc()))).scalars().all()
        return list(rows)

    @staticmethod
    async def cast_cab_vote(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        seat_id: uuid.UUID,
        payload: CabVoteRequest,
        request: Request | None = None,
    ) -> CabVotingSeat:
        await set_transaction_tenant_context(db, principal.organization_id)

        seat = (
            await db.execute(
                select(CabVotingSeat)
                .where(
                    CabVotingSeat.id == seat_id,
                    CabVotingSeat.organization_id == principal.organization_id,
                )
                .with_for_update()
            )
        ).scalar_one_or_none()
        if seat is None:
            raise NotFoundError("CAB voting seat not found.")

        if seat.vote != "pending":
            raise ConflictError(
                f"CAB seat '{seat.seat_name}' on '{seat.change_ref}' has already voted ({seat.vote})."
            )

        override_used = False
        if payload.override:
            if not principal.is_super_admin:
                await AuditService.record(
                    db,
                    action="CAB_OVERRIDE_DENIED",
                    module="approvals",
                    actor_email=principal.email,
                    actor_user_id=principal.user_id,
                    organization_id=principal.organization_id,
                    portal_type=principal.portal_type,
                    target_type="cab_seat",
                    target_id=str(seat.id),
                    outcome="denied",
                    detail="Non-Super-Admin attempted a CAB voting override.",
                    request=request,
                )
                raise AuthorizationError(
                    "CAB voting overrides are exclusively restricted to Super Admin Portal sessions."
                )
            if not payload.override_reason or len(payload.override_reason.strip()) < 5:
                raise ValidationDomainError(
                    "Super Admin CAB overrides require an explicit audit justification (min 5 chars)."
                )
            override_used = True
        else:
            # Only the designated assigned CAB member (holding changes:cab_vote) can vote on this seat
            if (
                not principal.has_permission("changes:cab_vote")
                or seat.assigned_member_user_id != principal.user_id
            ):
                await AuditService.record(
                    db,
                    action="CAB_VOTE_UNAUTHORIZED_ATTEMPT",
                    module="approvals",
                    actor_email=principal.email,
                    actor_user_id=principal.user_id,
                    organization_id=principal.organization_id,
                    portal_type=principal.portal_type,
                    target_type="cab_seat",
                    target_id=str(seat.id),
                    outcome="denied",
                    detail=(
                        f"Blocked unauthorized CAB vote attempt on seat '{seat.seat_name}'. "
                        f"Designated member is {seat.assigned_member_email}."
                    ),
                    request=request,
                )
                raise AuthorizationError(
                    "Only the designated CAB seat member with 'changes:cab_vote' scope can cast this vote."
                )

            if seat.requester_user_id == principal.user_id:
                await AuditService.record(
                    db,
                    action="CAB_SELF_VOTE_BLOCKED",
                    module="approvals",
                    actor_email=principal.email,
                    actor_user_id=principal.user_id,
                    organization_id=principal.organization_id,
                    portal_type=principal.portal_type,
                    target_type="cab_seat",
                    target_id=str(seat.id),
                    outcome="denied",
                    detail=f"Blocked change requester self-vote on '{seat.change_ref}'.",
                    request=request,
                )
                raise AuthorizationError("Change requesters cannot cast an ordinary CAB vote on their own change.")

        now = datetime.now(timezone.utc)
        seat.vote = payload.vote
        seat.voted_by_user_id = principal.user_id
        seat.voted_by_email = principal.email
        seat.vote_comment = payload.comment.strip() if payload.comment else None
        seat.voted_at = now
        seat.override_used = override_used
        seat.override_reason = payload.override_reason.strip() if override_used and payload.override_reason else None
        seat.version += 1
        await db.flush()

        await AuditService.record(
            db,
            action="CAB_VOTE_SUPER_ADMIN_OVERRIDE" if override_used else "CAB_VOTE_CAST",
            module="approvals",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="cab_seat",
            target_id=str(seat.id),
            outcome="success",
            detail=(
                f"Cast CAB vote '{seat.vote}' for seat '{seat.seat_name}' on '{seat.change_ref}'"
                + (" via audited Super Admin override." if override_used else ".")
            ),
            metadata={
                "change_ref": seat.change_ref,
                "seat_name": seat.seat_name,
                "vote": seat.vote,
                "override_used": override_used,
                "override_reason": seat.override_reason,
                "designated_member": seat.assigned_member_email,
            },
            request=request,
        )
        return seat

    @staticmethod
    async def reassign_cab_seat(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        seat_id: uuid.UUID,
        payload: CabSeatReassignRequest,
        request: Request | None = None,
    ) -> CabVotingSeat:
        if not principal.has_permission("iam:manage") and not principal.is_super_admin:
            raise AuthorizationError(
                "Only authorized administrators ('iam:manage' or Super Admin) may reassign CAB seats."
            )

        await set_transaction_tenant_context(db, principal.organization_id)
        seat = (
            await db.execute(
                select(CabVotingSeat)
                .where(
                    CabVotingSeat.id == seat_id,
                    CabVotingSeat.organization_id == principal.organization_id,
                )
                .with_for_update()
            )
        ).scalar_one_or_none()
        if seat is None:
            raise NotFoundError("CAB voting seat not found.")
        if seat.vote != "pending":
            raise ConflictError("Cannot reassign a CAB seat after its vote has been cast.")

        new_member = await _resolve_org_member_user(
            db,
            organization_id=principal.organization_id,
            user_id=payload.new_member_user_id,
        )

        prev_id = seat.assigned_member_user_id
        prev_email = seat.assigned_member_email
        # Original assignment (original_member_user_id / original_member_email) is NEVER overwritten
        seat.assigned_member_user_id = new_member.id
        seat.assigned_member_email = new_member.email
        seat.version += 1

        db.add(
            CabSeatAssignmentHistory(
                organization_id=principal.organization_id,
                cab_seat_id=seat.id,
                previous_member_user_id=prev_id,
                previous_member_email=prev_email,
                new_member_user_id=new_member.id,
                new_member_email=new_member.email,
                reassigned_by_user_id=principal.user_id,
                reassigned_by_email=principal.email,
                reason=payload.reason.strip(),
            )
        )
        await db.flush()

        await AuditService.record(
            db,
            action="CAB_SEAT_REASSIGNED",
            module="approvals",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="cab_seat",
            target_id=str(seat.id),
            outcome="success",
            detail=f"Reassigned CAB seat '{seat.seat_name}' from {prev_email} to {new_member.email}.",
            metadata={
                "original_member": seat.original_member_email,
                "previous_member": prev_email,
                "new_member": new_member.email,
                "reason": payload.reason,
            },
            request=request,
        )
        return seat

    @staticmethod
    async def list_cab_seat_history(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        seat_id: uuid.UUID,
    ) -> list[CabSeatAssignmentHistory]:
        await set_transaction_tenant_context(db, principal.organization_id)
        rows = (
            await db.execute(
                select(CabSeatAssignmentHistory)
                .where(
                    CabSeatAssignmentHistory.organization_id == principal.organization_id,
                    CabSeatAssignmentHistory.cab_seat_id == seat_id,
                )
                .order_by(CabSeatAssignmentHistory.created_at.asc())
            )
        ).scalars().all()
        return list(rows)
