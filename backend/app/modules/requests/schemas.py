from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.approvals.schemas import ApprovalItemOut

RequestStatus = Literal[
    "submitted",
    "manager_approved",
    "security_review",
    "fulfillment",
    "completed",
    "rejected",
]


class CatalogItemCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slug: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9-]+$")
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(default="", max_length=4000)
    category: str = Field(default="hardware", max_length=40)
    price: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    estimated_hours: int = Field(default=24, ge=0, le=2000)
    requires_approval: bool = True
    default_approval_stages: list[dict[str, Any]] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class CatalogItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    slug: str
    title: str
    description: str
    category: str
    price: Decimal
    estimated_hours: int
    requires_approval: bool
    default_approval_stages: list[dict[str, Any]]
    tags: list[str]
    is_active: bool
    created_at: datetime


class RequestApprovalStageSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=2, max_length=200)
    stage_order: int = Field(ge=1, le=6)
    assigned_approver_user_id: uuid.UUID


class ServiceRequestCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    catalog_item_id: uuid.UUID | None = None
    catalog_item_name: str | None = Field(default=None, min_length=2, max_length=200)
    description: str = Field(default="", max_length=8000)
    department: str = Field(default="General", max_length=120)
    cost: Decimal | None = Field(default=None, ge=Decimal("0.00"))
    delivery_estimate_days: int = Field(default=3, ge=1, le=90)
    custom_form_values: dict[str, Any] = Field(default_factory=dict)
    approval_stages: list[RequestApprovalStageSpec] = Field(default_factory=list)


class ServiceRequestAssignRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assignee_user_id: uuid.UUID
    note: str | None = Field(default=None, max_length=2000)


class ServiceRequestFulfillRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fulfillment_notes: str = Field(min_length=3, max_length=4000)
    mark_completed: bool = True


class ServiceRequestActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    service_request_id: uuid.UUID
    actor_user_id: uuid.UUID | None
    actor_email: str
    action: str
    detail: str
    created_at: datetime


class ServiceRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    number: str
    catalog_item_id: uuid.UUID | None
    catalog_item_name: str
    description: str
    requester_user_id: uuid.UUID
    requester_name: str
    requester_email: str
    assignee_user_id: uuid.UUID | None
    assignee_name: str | None
    department: str
    cost: Decimal
    status: str
    current_stage: int
    delivery_estimate_days: int
    delivery_date: datetime | None
    fulfillment_notes: str | None
    completed_at: datetime | None
    custom_form_values: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    approvals: list[ApprovalItemOut] = Field(default_factory=list)
    activities: list[ServiceRequestActivityOut] = Field(default_factory=list)
