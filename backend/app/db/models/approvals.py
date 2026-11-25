from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TenantOwnedMixin, TimestampMixin, UUIDPrimaryKeyMixin


class ApprovalWorkflowItem(UUIDPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin, Base):
    """
    Designated service request approval record enforcing:
      - Only the assigned approver can approve or reject.
      - Requesters cannot approve their own requests under ordinary permissions.
      - Super Admin overrides require explicit reason and are audited.
      - Transactional locking prevents duplicate or conflicting decisions.
    """

    __tablename__ = "approval_workflow_items"
    __table_args__ = (
        Index("ix_approvals_org_status", "organization_id", "status"),
        Index("ix_approvals_org_assigned", "organization_id", "assigned_approver_user_id"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    subject_type: Mapped[str] = mapped_column(
        String(32), nullable=False, default="service_request", server_default="service_request"
    )
    subject_ref: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    stage_order: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")

    requester_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    requester_email: Mapped[str] = mapped_column(String(160), nullable=False)

    assigned_approver_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    assigned_approver_email: Mapped[str] = mapped_column(String(160), nullable=False)

    status: Mapped[str] = mapped_column(
        String(24), nullable=False, default="pending", server_default="pending"
    )  # pending | approved | rejected
    decision_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    decision_by_email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    decision_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    override_used: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    override_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")

    assignment_history: Mapped[list[ApprovalAssignmentHistory]] = relationship(
        back_populates="approval_item",
        cascade="all, delete-orphan",
        order_by="ApprovalAssignmentHistory.created_at.asc()",
    )


class ApprovalAssignmentHistory(UUIDPrimaryKeyMixin, TenantOwnedMixin, Base):
    """Immutable reassignment history for service request approval items."""

    __tablename__ = "approval_assignment_history"
    __table_args__ = (
        Index("ix_approval_history_item", "approval_item_id", "created_at"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    approval_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("approval_workflow_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    previous_approver_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    previous_approver_email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    new_approver_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    new_approver_email: Mapped[str] = mapped_column(String(160), nullable=False)
    reassigned_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    reassigned_by_email: Mapped[str] = mapped_column(String(160), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    approval_item: Mapped[ApprovalWorkflowItem] = relationship(back_populates="assignment_history")


class CabVotingSeat(UUIDPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin, Base):
    """
    Designated Change Advisory Board (CAB) seat enforcing:
      - Each seat has one designated member.
      - Only the assigned member can cast that seat's vote.
      - Unauthorized members cannot vote on another member's behalf.
      - Super Admin overrides require an explicit reason and are audited.
      - Reassignment retains the original assignment history.
    """

    __tablename__ = "cab_voting_seats"
    __table_args__ = (
        Index("ix_cab_seats_org_change", "organization_id", "change_ref"),
        Index("ix_cab_seats_org_member", "organization_id", "assigned_member_user_id"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    change_ref: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    change_title: Mapped[str] = mapped_column(String(200), nullable=False)
    seat_name: Mapped[str] = mapped_column(String(128), nullable=False)

    requester_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    original_member_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    original_member_email: Mapped[str] = mapped_column(String(160), nullable=False)

    assigned_member_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    assigned_member_email: Mapped[str] = mapped_column(String(160), nullable=False)

    vote: Mapped[str] = mapped_column(
        String(24), nullable=False, default="pending", server_default="pending"
    )  # pending | approve | reject | abstain
    voted_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    voted_by_email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    vote_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    voted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    override_used: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    override_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")

    assignment_history: Mapped[list[CabSeatAssignmentHistory]] = relationship(
        back_populates="cab_seat",
        cascade="all, delete-orphan",
        order_by="CabSeatAssignmentHistory.created_at.asc()",
    )


class CabSeatAssignmentHistory(UUIDPrimaryKeyMixin, TenantOwnedMixin, Base):
    """Immutable reassignment history for CAB voting seats, retaining original assignments."""

    __tablename__ = "cab_seat_assignment_history"
    __table_args__ = (
        Index("ix_cab_seat_history_seat", "cab_seat_id", "created_at"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    cab_seat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cab_voting_seats.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    previous_member_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    previous_member_email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    new_member_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    new_member_email: Mapped[str] = mapped_column(String(160), nullable=False)
    reassigned_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    reassigned_by_email: Mapped[str] = mapped_column(String(160), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    cab_seat: Mapped[CabVotingSeat] = relationship(back_populates="assignment_history")
