from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

PriorityLevel = Literal["P1", "P2", "P3", "P4"]
KbVisibility = Literal["public", "internal"]
WorkflowStatus = Literal["active", "draft", "paused"]
TaskColumn = Literal["backlog", "todo", "in_progress", "review", "done"]
ProjectStage = Literal["initiation", "planning", "execution", "uat", "closed"]
ComponentHealth = Literal["operational", "degraded", "partial_outage", "major_outage"]
InvoiceStatus = Literal["paid", "pending", "overdue"]


class SlaPolicyUpsertRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=160)
    priority: PriorityLevel
    response_target_mins: int = Field(gt=0, le=10080)
    resolution_target_mins: int = Field(gt=0, le=43200)
    escalation_minutes: int = Field(default=60, gt=0, le=10080)
    business_hours_only: bool = False
    is_active: bool = True


class SlaPolicyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    priority: str
    response_target_mins: int
    resolution_target_mins: int
    escalation_minutes: int
    business_hours_only: bool
    is_active: bool
    updated_at: datetime


class KnowledgeCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=3, max_length=240)
    category: str = Field(default="General", max_length=80)
    visibility: KbVisibility = "internal"
    tags: list[str] = Field(default_factory=list)
    content: str = Field(default="", max_length=50000)


class KnowledgeUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=3, max_length=240)
    category: str | None = Field(default=None, max_length=80)
    visibility: KbVisibility | None = None
    tags: list[str] | None = None
    content: str | None = Field(default=None, max_length=50000)
    is_published: bool | None = None


class KnowledgeArticleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    title: str
    category: str
    visibility: str
    author_user_id: uuid.UUID | None
    author_name: str
    views: int
    helpful_votes: int
    tags: list[str]
    content: str
    is_published: bool
    created_at: datetime
    updated_at: datetime


class WorkflowCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=200)
    target_module_id: str = Field(default="all", max_length=64)
    trigger: str = Field(default="manual", max_length=48)
    trigger_config: dict[str, Any] = Field(default_factory=dict)
    description: str = Field(default="", max_length=4000)
    status: WorkflowStatus = "draft"
    stages: list[dict[str, Any]] = Field(default_factory=list)


class WorkflowUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=2, max_length=200)
    status: WorkflowStatus | None = None
    description: str | None = Field(default=None, max_length=4000)
    stages: list[dict[str, Any]] | None = None
    trigger_config: dict[str, Any] | None = None


class WorkflowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    target_module_id: str
    trigger: str
    trigger_config: dict[str, Any]
    description: str
    status: str
    stages: list[dict[str, Any]]
    execution_count: int
    last_executed_at: datetime | None
    last_run_trace: list[dict[str, Any]]
    updated_at: datetime


class TicketWorkflowRuleCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=200)
    active: bool = True
    source_channel: str = Field(default="all", max_length=24)
    match_category: str = Field(default="all", max_length=32)
    match_priority: str = Field(default="all", max_length=8)
    assign_to_queue: str = Field(min_length=2, max_length=120)
    override_sla_hours: int | None = Field(default=None, gt=0, le=720)
    auto_escalate_after_mins: int | None = Field(default=None, gt=0, le=10080)
    allowed_transitions: dict[str, list[str]] = Field(default_factory=dict)
    notify_roles: list[str] = Field(default_factory=list)


class TicketWorkflowRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    active: bool
    source_channel: str
    match_category: str
    match_priority: str
    assign_to_queue: str
    override_sla_hours: int | None
    auto_escalate_after_mins: int | None
    allowed_transitions: dict[str, list[str]]
    notify_roles: list[str]
    execution_count: int
    updated_at: datetime


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    category: str
    title: str
    message: str
    record_type: str | None
    record_id: str | None
    is_read: bool
    read_at: datetime | None
    created_at: datetime


class TaskCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=2, max_length=220)
    description: str = Field(default="", max_length=4000)
    column_name: TaskColumn = "todo"
    priority: Literal["high", "medium", "low"] = "medium"
    assignee_name: str = Field(default="Unassigned", max_length=160)
    due_date: date | None = None
    linked_record_id: str | None = Field(default=None, max_length=64)
    project_id: uuid.UUID | None = None
    subtasks: list[dict[str, Any]] = Field(default_factory=list)


class TaskMoveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    column_name: TaskColumn


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    title: str
    description: str
    column_name: str
    priority: str
    assignee_name: str
    due_date: date | None
    time_logged_mins: int
    linked_record_id: str | None
    project_id: uuid.UUID | None
    subtasks: list[dict[str, Any]]
    created_at: datetime


class ProjectCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=2, max_length=32)
    title: str = Field(min_length=2, max_length=220)
    owner_name: str = Field(min_length=2, max_length=160)
    stage: ProjectStage = "initiation"
    health: Literal["on_track", "at_risk", "delayed"] = "on_track"
    progress_pct: int = Field(default=0, ge=0, le=100)
    budget_total: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    start_date: date | None = None
    target_end_date: date | None = None
    summary: str = Field(default="", max_length=4000)


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    code: str
    title: str
    owner_name: str
    stage: str
    health: str
    progress_pct: int
    budget_total: Decimal
    budget_spent: Decimal
    start_date: date | None
    target_end_date: date | None
    summary: str
    created_at: datetime


class StatusComponentUpsertRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=160)
    component_group: str = Field(default="Core Platform", max_length=64)
    status: ComponentHealth = "operational"
    uptime_pct: Decimal = Field(default=Decimal("99.95"), ge=Decimal("0.00"), le=Decimal("100.00"))
    latency_ms: int = Field(default=25, ge=0)
    linked_incident_id: uuid.UUID | None = None


class StatusComponentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    component_group: str
    status: str
    uptime_pct: Decimal
    latency_ms: int
    linked_incident_id: uuid.UUID | None
    updated_at: datetime


class InvoiceCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    customer_name: str = Field(min_length=2, max_length=160)
    customer_email: EmailStr
    customer_organization: str = Field(default="", max_length=160)
    amount: Decimal = Field(ge=Decimal("0.00"))
    currency: str = Field(default="USD", min_length=3, max_length=8)
    issue_date: date | None = None
    due_date: date | None = None
    line_items: list[dict[str, Any]] = Field(default_factory=list)
    notes: str | None = Field(default=None, max_length=2000)


class InvoicePayRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    payment_method: Literal["credit_card", "wire_ach", "purchase_order", "stripe"]


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    number: str
    customer_name: str
    customer_email: str
    customer_organization: str
    amount: Decimal
    currency: str
    status: str
    issue_date: date | None
    due_date: date | None
    paid_at: datetime | None
    payment_method: str | None
    line_items: list[dict[str, Any]]
    notes: str | None
    created_at: datetime


class OperationsReportSummary(BaseModel):
    organization_id: uuid.UUID
    generated_at: datetime
    incidents_total: int
    incidents_open: int
    incidents_breached_sla: int
    incidents_by_priority: dict[str, int]
    requests_total: int
    requests_pending_approval: int
    problems_total: int
    known_errors_total: int
    changes_total: int
    changes_in_cab_review: int
    assets_total: int
    assets_in_use: int
    inventory_low_stock: int
    software_over_allocated: int
    audit_events_count: int


class GlobalSearchHit(BaseModel):
    id: str
    ref: str
    group: Literal["Incidents", "Tickets & Requests", "Assets (CMDB)", "Problems & Changes", "Knowledge Base"]
    title: str
    subtitle: str
    status: str
    path: str


class GlobalSearchResponse(BaseModel):
    query: str
    organization_id: uuid.UUID
    total: int
    hits: list[GlobalSearchHit]
