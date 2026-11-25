from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import (
    Base,
    SoftDeleteMixin,
    TenantOwnedMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)


class SlaPolicy(
    UUIDPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin, SoftDeleteMixin, Base
):
    """Tenant-scoped SLA Policy definitions per priority level."""

    __tablename__ = "sla_policies"
    __table_args__ = (
        UniqueConstraint("organization_id", "priority", name="uq_sla_policies_org_priority"),
        CheckConstraint(
            "priority IN ('P1', 'P2', 'P3', 'P4')",
            name="sla_policies_priority_valid",
        ),
        CheckConstraint(
            "response_target_mins > 0 AND resolution_target_mins > 0",
            name="sla_policies_targets_positive",
        ),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    priority: Mapped[str] = mapped_column(String(4), nullable=False)
    response_target_mins: Mapped[int] = mapped_column(Integer, nullable=False)
    resolution_target_mins: Mapped[int] = mapped_column(Integer, nullable=False)
    escalation_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, default=60, server_default="60"
    )
    business_hours_only: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )


class KnowledgeArticle(
    UUIDPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin, SoftDeleteMixin, Base
):
    """Tenant-scoped Knowledge Management article (public self-service or internal SOP)."""

    __tablename__ = "knowledge_articles"
    __table_args__ = (
        CheckConstraint(
            "visibility IN ('public', 'internal')",
            name="knowledge_visibility_valid",
        ),
        CheckConstraint("views >= 0 AND helpful_votes >= 0", name="knowledge_counters_non_negative"),
        Index("ix_knowledge_org_visibility", "organization_id", "visibility"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False, default="General")
    visibility: Mapped[str] = mapped_column(
        String(16), nullable=False, default="internal", server_default="internal"
    )
    author_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    author_name: Mapped[str] = mapped_column(String(160), nullable=False)
    views: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    helpful_votes: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    tags: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    is_published: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )


class WorkflowDefinition(
    UUIDPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin, SoftDeleteMixin, Base
):
    """Tenant-scoped Workflow Automation engine definition."""

    __tablename__ = "workflow_definitions"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'draft', 'paused')",
            name="workflows_status_valid",
        ),
        CheckConstraint("execution_count >= 0", name="workflows_exec_count_non_negative"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    target_module_id: Mapped[str] = mapped_column(
        String(64), nullable=False, default="all", server_default="all"
    )
    trigger: Mapped[str] = mapped_column(String(48), nullable=False, default="manual")
    trigger_config: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="draft", server_default="draft"
    )
    stages: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    execution_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    last_executed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_run_trace: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )


class TicketWorkflowRule(
    UUIDPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin, SoftDeleteMixin, Base
):
    """Tenant-scoped Ticket Routing & SLA Override rule."""

    __tablename__ = "ticket_workflow_rules"
    __table_args__ = (
        CheckConstraint("execution_count >= 0", name="ticket_rules_exec_non_negative"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    source_channel: Mapped[str] = mapped_column(
        String(24), nullable=False, default="all", server_default="all"
    )
    match_category: Mapped[str] = mapped_column(
        String(32), nullable=False, default="all", server_default="all"
    )
    match_priority: Mapped[str] = mapped_column(
        String(8), nullable=False, default="all", server_default="all"
    )
    assign_to_queue: Mapped[str] = mapped_column(String(120), nullable=False)
    override_sla_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    auto_escalate_after_mins: Mapped[int | None] = mapped_column(Integer, nullable=True)
    allowed_transitions: Mapped[dict[str, list[str]]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )
    notify_roles: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    execution_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )


class Notification(UUIDPrimaryKeyMixin, TenantOwnedMixin, Base):
    """Tenant-scoped in-app notification for approvals, SLA alerts, assignments, and CAB."""

    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_org_recipient", "organization_id", "recipient_user_id", "is_read"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recipient_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category: Mapped[str] = mapped_column(String(40), nullable=False, default="itsm")
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    record_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    record_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_read: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )


class TaskItem(
    UUIDPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin, SoftDeleteMixin, Base
):
    """Tenant-scoped Kanban operational task preserved from Scribble-IT 1.x."""

    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint(
            "column_name IN ('backlog', 'todo', 'in_progress', 'review', 'done')",
            name="tasks_column_valid",
        ),
        CheckConstraint("time_logged_mins >= 0", name="tasks_time_non_negative"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(220), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    column_name: Mapped[str] = mapped_column(
        String(24), nullable=False, default="todo", server_default="todo"
    )
    priority: Mapped[str] = mapped_column(
        String(16), nullable=False, default="medium", server_default="medium"
    )
    assignee_name: Mapped[str] = mapped_column(String(160), nullable=False, default="Unassigned")
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    time_logged_mins: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    linked_record_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="SET NULL"),
        nullable=True,
    )
    subtasks: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )


class ProjectItem(
    UUIDPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin, SoftDeleteMixin, Base
):
    """Tenant-scoped IT Project Portfolio record."""

    __tablename__ = "projects"
    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_projects_org_code"),
        CheckConstraint(
            "stage IN ('initiation', 'planning', 'execution', 'uat', 'closed')",
            name="projects_stage_valid",
        ),
        CheckConstraint("progress_pct >= 0 AND progress_pct <= 100", name="projects_progress_range"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(220), nullable=False)
    owner_name: Mapped[str] = mapped_column(String(160), nullable=False)
    stage: Mapped[str] = mapped_column(
        String(24), nullable=False, default="initiation", server_default="initiation"
    )
    health: Mapped[str] = mapped_column(
        String(16), nullable=False, default="on_track", server_default="on_track"
    )
    progress_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    budget_total: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00"), server_default="0.00"
    )
    budget_spent: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00"), server_default="0.00"
    )
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    target_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")


class ServiceStatusComponent(
    UUIDPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin, Base
):
    """Tenant-scoped Service Status Page component health record."""

    __tablename__ = "service_status_components"
    __table_args__ = (
        CheckConstraint(
            "status IN ('operational', 'degraded', 'partial_outage', 'major_outage')",
            name="status_components_status_valid",
        ),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    component_group: Mapped[str] = mapped_column(
        String(64), nullable=False, default="Core Platform", server_default="Core Platform"
    )
    status: Mapped[str] = mapped_column(
        String(24), nullable=False, default="operational", server_default="operational"
    )
    uptime_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("99.95"), server_default="99.95"
    )
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=25)
    linked_incident_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("incidents.id", ondelete="SET NULL"),
        nullable=True,
    )


class Invoice(
    UUIDPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin, SoftDeleteMixin, Base
):
    """Tenant-scoped Finance / Billing Invoice preserved from Scribble-IT 1.x."""

    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("organization_id", "number", name="uq_invoices_org_number"),
        CheckConstraint("amount >= 0", name="invoices_amount_non_negative"),
        CheckConstraint(
            "status IN ('paid', 'pending', 'overdue')",
            name="invoices_status_valid",
        ),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    number: Mapped[str] = mapped_column(String(32), nullable=False)
    customer_name: Mapped[str] = mapped_column(String(160), nullable=False)
    customer_email: Mapped[str] = mapped_column(String(160), nullable=False)
    customer_organization: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="USD")
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="pending", server_default="pending"
    )
    issue_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payment_method: Mapped[str | None] = mapped_column(String(32), nullable=True)
    line_items: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
