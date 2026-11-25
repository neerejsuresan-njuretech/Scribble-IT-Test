from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
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
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import (
    Base,
    SoftDeleteMixin,
    TenantOwnedMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)


class Incident(
    UUIDPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin, SoftDeleteMixin, Base
):
    """Tenant-scoped ITIL Incident Management record."""

    __tablename__ = "incidents"
    __table_args__ = (
        UniqueConstraint("organization_id", "number", name="uq_incidents_org_number"),
        CheckConstraint(
            "priority IN ('P1', 'P2', 'P3', 'P4')",
            name="incidents_priority_valid",
        ),
        CheckConstraint(
            "status IN ('new', 'assigned', 'in_progress', 'pending', 'resolved', 'closed')",
            name="incidents_status_valid",
        ),
        CheckConstraint(
            "urgency IN ('high', 'medium', 'low') AND impact IN ('high', 'medium', 'low')",
            name="incidents_urgency_impact_valid",
        ),
        CheckConstraint(
            "csat_score IS NULL OR (csat_score >= 1 AND csat_score <= 5)",
            name="incidents_csat_range",
        ),
        CheckConstraint("time_logged_mins >= 0", name="incidents_time_non_negative"),
        Index("ix_incidents_org_status", "organization_id", "status"),
        Index("ix_incidents_org_priority", "organization_id", "priority"),
        Index("ix_incidents_org_requester", "organization_id", "requester_user_id"),
        Index("ix_incidents_org_assignee", "organization_id", "assignee_user_id"),
        Index("ix_incidents_org_sla_deadline", "organization_id", "sla_deadline"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    number: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(
        String(24), nullable=False, default="new", server_default="new"
    )
    priority: Mapped[str] = mapped_column(
        String(4), nullable=False, default="P3", server_default="P3"
    )
    urgency: Mapped[str] = mapped_column(
        String(16), nullable=False, default="medium", server_default="medium"
    )
    impact: Mapped[str] = mapped_column(
        String(16), nullable=False, default="medium", server_default="medium"
    )
    category: Mapped[str] = mapped_column(
        String(32), nullable=False, default="software", server_default="software"
    )

    requester_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    requester_name: Mapped[str] = mapped_column(String(160), nullable=False)
    requester_email: Mapped[str] = mapped_column(String(160), nullable=False)

    assignee_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    assignee_name: Mapped[str] = mapped_column(
        String(160), nullable=False, default="Unassigned", server_default="Unassigned"
    )
    assignment_group: Mapped[str | None] = mapped_column(String(120), nullable=True)

    affected_ci_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    affected_ci_label: Mapped[str | None] = mapped_column(String(160), nullable=True)

    sla_policy_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sla_policies.id", ondelete="SET NULL"),
        nullable=True,
    )
    sla_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    sla_breached: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    sla_paused_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    time_logged_mins: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    csat_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_channel: Mapped[str] = mapped_column(
        String(24), nullable=False, default="portal", server_default="portal"
    )
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    activities: Mapped[list[IncidentActivity]] = relationship(
        back_populates="incident",
        cascade="all, delete-orphan",
        order_by="IncidentActivity.created_at.asc()",
    )
    attachments: Mapped[list[IncidentAttachment]] = relationship(
        back_populates="incident",
        cascade="all, delete-orphan",
        order_by="IncidentAttachment.created_at.asc()",
    )
    relations: Mapped[list[IncidentRelation]] = relationship(
        back_populates="incident",
        cascade="all, delete-orphan",
        order_by="IncidentRelation.created_at.asc()",
    )


class IncidentActivity(UUIDPrimaryKeyMixin, TenantOwnedMixin, Base):
    """Immutable activity / work note / field-change entry on an incident."""

    __tablename__ = "incident_activities"
    __table_args__ = (
        Index("ix_incident_activities_incident", "incident_id", "created_at"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    incident_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("incidents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    author_name: Mapped[str] = mapped_column(String(160), nullable=False)
    activity_type: Mapped[str] = mapped_column(
        String(32), nullable=False, default="work_note", server_default="work_note"
    )  # work_note | comment | field_change | system_alert | audit
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    field_changes: Mapped[list[dict[str, str]]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    incident: Mapped[Incident] = relationship(back_populates="activities")


class IncidentAttachment(UUIDPrimaryKeyMixin, TenantOwnedMixin, Base):
    """Metadata record for an incident file attachment stored in object storage."""

    __tablename__ = "incident_attachments"
    __table_args__ = (
        CheckConstraint("size_bytes >= 0", name="incident_attachments_size_non_negative"),
        Index("ix_incident_attachments_incident", "incident_id", "created_at"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    incident_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("incidents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    checksum_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    uploaded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    uploaded_by_email: Mapped[str] = mapped_column(String(160), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    incident: Mapped[Incident] = relationship(back_populates="attachments")


class IncidentRelation(UUIDPrimaryKeyMixin, TenantOwnedMixin, Base):
    """Explicit relationship linking an incident to another incident, problem, change, or asset."""

    __tablename__ = "incident_relations"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "incident_id",
            "target_type",
            "target_id",
            "relation_type",
            name="uq_incident_relations_unique",
        ),
        CheckConstraint(
            "target_type IN ('incident', 'problem', 'change', 'asset', 'request')",
            name="incident_relations_target_type_valid",
        ),
        Index("ix_incident_relations_incident", "incident_id"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    incident_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("incidents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_type: Mapped[str] = mapped_column(String(32), nullable=False)
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    target_ref: Mapped[str] = mapped_column(String(64), nullable=False)
    relation_type: Mapped[str] = mapped_column(
        String(32), nullable=False, default="related_to", server_default="related_to"
    )  # caused_by | parent_of | child_of | duplicate_of | related_to | resolved_by
    created_by_email: Mapped[str] = mapped_column(String(160), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    incident: Mapped[Incident] = relationship(back_populates="relations")


class ServiceCatalogItem(
    UUIDPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin, SoftDeleteMixin, Base
):
    """Tenant-scoped Service Request Catalog item."""

    __tablename__ = "service_catalog_items"
    __table_args__ = (
        UniqueConstraint("organization_id", "slug", name="uq_catalog_org_slug"),
        CheckConstraint("price >= 0", name="catalog_price_non_negative"),
        CheckConstraint("estimated_hours >= 0", name="catalog_est_hours_non_negative"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    slug: Mapped[str] = mapped_column(String(80), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    category: Mapped[str] = mapped_column(String(40), nullable=False, default="hardware")
    price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00"), server_default="0.00"
    )
    estimated_hours: Mapped[int] = mapped_column(
        Integer, nullable=False, default=24, server_default="24"
    )
    requires_approval: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    default_approval_stages: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    tags: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )


class ServiceRequest(
    UUIDPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin, SoftDeleteMixin, Base
):
    """Tenant-scoped Service Request linked to designated ApprovalWorkflowItem stages."""

    __tablename__ = "service_requests"
    __table_args__ = (
        UniqueConstraint("organization_id", "number", name="uq_requests_org_number"),
        CheckConstraint(
            "status IN ('submitted', 'manager_approved', 'security_review', 'fulfillment', 'completed', 'rejected')",
            name="requests_status_valid",
        ),
        CheckConstraint("cost >= 0", name="requests_cost_non_negative"),
        CheckConstraint("current_stage >= 1 AND current_stage <= 6", name="requests_stage_range"),
        Index("ix_requests_org_status", "organization_id", "status"),
        Index("ix_requests_org_requester", "organization_id", "requester_user_id"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    number: Mapped[str] = mapped_column(String(32), nullable=False)
    catalog_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("service_catalog_items.id", ondelete="SET NULL"),
        nullable=True,
    )
    catalog_item_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")

    requester_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    requester_name: Mapped[str] = mapped_column(String(160), nullable=False)
    requester_email: Mapped[str] = mapped_column(String(160), nullable=False)

    assignee_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    assignee_name: Mapped[str | None] = mapped_column(String(160), nullable=True)

    department: Mapped[str] = mapped_column(
        String(120), nullable=False, default="General", server_default="General"
    )
    cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00"), server_default="0.00"
    )
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="submitted", server_default="submitted"
    )
    current_stage: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )
    delivery_estimate_days: Mapped[int] = mapped_column(
        Integer, nullable=False, default=3, server_default="3"
    )
    delivery_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    fulfillment_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    custom_form_values: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )

    activities: Mapped[list[ServiceRequestActivity]] = relationship(
        back_populates="service_request",
        cascade="all, delete-orphan",
        order_by="ServiceRequestActivity.created_at.asc()",
    )


class ServiceRequestActivity(UUIDPrimaryKeyMixin, TenantOwnedMixin, Base):
    """Immutable timeline / audit history on a service request."""

    __tablename__ = "service_request_activities"
    __table_args__ = (
        Index("ix_request_activities_request", "service_request_id", "created_at"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    service_request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("service_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    actor_email: Mapped[str] = mapped_column(String(160), nullable=False)
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    service_request: Mapped[ServiceRequest] = relationship(back_populates="activities")


class Problem(
    UUIDPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin, SoftDeleteMixin, Base
):
    """Tenant-scoped ITIL Problem Management & Known Error Database (KEDB) record."""

    __tablename__ = "problems"
    __table_args__ = (
        UniqueConstraint("organization_id", "number", name="uq_problems_org_number"),
        CheckConstraint(
            "status IN ('investigating', 'root_cause_identified', 'workaround_published', 'change_requested', 'closed')",
            name="problems_status_valid",
        ),
        CheckConstraint(
            "severity IN ('critical', 'high', 'moderate', 'minor')",
            name="problems_severity_valid",
        ),
        Index("ix_problems_org_status", "organization_id", "status"),
        Index("ix_problems_org_kedb", "organization_id", "is_known_error"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    number: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="investigating", server_default="investigating"
    )
    severity: Mapped[str] = mapped_column(
        String(16), nullable=False, default="high", server_default="high"
    )
    root_cause_analysis: Mapped[str] = mapped_column(Text, nullable=False, default="")
    workaround: Mapped[str] = mapped_column(Text, nullable=False, default="")
    permanent_solution: Mapped[str] = mapped_column(Text, nullable=False, default="")
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    owner_name: Mapped[str] = mapped_column(String(160), nullable=False)
    is_known_error: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    known_error_published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    linked_change_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("change_requests.id", ondelete="SET NULL"),
        nullable=True,
    )

    incident_links: Mapped[list[ProblemIncidentLink]] = relationship(
        back_populates="problem",
        cascade="all, delete-orphan",
    )


class ProblemIncidentLink(UUIDPrimaryKeyMixin, TenantOwnedMixin, Base):
    """Relational M:N table linking Problems to related Incidents."""

    __tablename__ = "problem_incident_links"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "problem_id",
            "incident_id",
            name="uq_problem_incident_unique",
        ),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    problem_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("problems.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    incident_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("incidents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    linked_by_email: Mapped[str] = mapped_column(String(160), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    problem: Mapped[Problem] = relationship(back_populates="incident_links")


class ChangeRequest(
    UUIDPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin, SoftDeleteMixin, Base
):
    """Tenant-scoped ITIL Change Management record coordinated with CAB voting seats."""

    __tablename__ = "change_requests"
    __table_args__ = (
        UniqueConstraint("organization_id", "number", name="uq_changes_org_number"),
        CheckConstraint(
            "change_type IN ('standard', 'normal', 'emergency')",
            name="changes_type_valid",
        ),
        CheckConstraint(
            "status IN ('draft', 'cab_review', 'scheduled', 'implementation', 'verification', 'completed', 'cancelled')",
            name="changes_status_valid",
        ),
        CheckConstraint(
            "risk_score IN ('low', 'medium', 'high', 'critical')",
            name="changes_risk_valid",
        ),
        Index("ix_changes_org_status", "organization_id", "status"),
        Index("ix_changes_org_schedule", "organization_id", "scheduled_start"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    number: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    change_type: Mapped[str] = mapped_column(
        String(16), nullable=False, default="normal", server_default="normal"
    )
    status: Mapped[str] = mapped_column(
        String(24), nullable=False, default="draft", server_default="draft"
    )
    risk_score: Mapped[str] = mapped_column(
        String(16), nullable=False, default="medium", server_default="medium"
    )
    risk_assessment: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    implementation_plan: Mapped[str] = mapped_column(Text, nullable=False, default="")
    rollback_plan: Mapped[str] = mapped_column(Text, nullable=False, default="")
    test_plan: Mapped[str] = mapped_column(Text, nullable=False, default="")
    scheduled_start: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    scheduled_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    requester_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    requester_name: Mapped[str] = mapped_column(String(160), nullable=False)
    requester_email: Mapped[str] = mapped_column(String(160), nullable=False)

    assigned_engineer_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    assigned_engineer_name: Mapped[str] = mapped_column(
        String(160), nullable=False, default="Unassigned", server_default="Unassigned"
    )

    activities: Mapped[list[ChangeActivity]] = relationship(
        back_populates="change_request",
        cascade="all, delete-orphan",
        order_by="ChangeActivity.created_at.asc()",
    )


class ChangeActivity(UUIDPrimaryKeyMixin, TenantOwnedMixin, Base):
    """Immutable change history and lifecycle transition log."""

    __tablename__ = "change_activities"
    __table_args__ = (
        Index("ix_change_activities_change", "change_request_id", "created_at"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    change_request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("change_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    actor_email: Mapped[str] = mapped_column(String(160), nullable=False)
    activity_type: Mapped[str] = mapped_column(
        String(32), nullable=False, default="audit", server_default="audit"
    )
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    field_changes: Mapped[list[dict[str, str]]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    change_request: Mapped[ChangeRequest] = relationship(back_populates="activities")
