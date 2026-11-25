from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.approvals.schemas import CabSeatOut

ChangeType = Literal["standard", "normal", "emergency"]
ChangeStatus = Literal[
    "draft",
    "cab_review",
    "scheduled",
    "implementation",
    "verification",
    "completed",
    "cancelled",
]
RiskLevel = Literal["low", "medium", "high", "critical"]


class CabMemberSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    seat_name: str = Field(min_length=2, max_length=128)
    assigned_member_user_id: uuid.UUID


class ChangeCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=3, max_length=240)
    change_type: ChangeType = "normal"
    risk_score: RiskLevel = "medium"
    risk_assessment: dict[str, Any] = Field(default_factory=dict)
    reason: str = Field(default="", max_length=6000)
    implementation_plan: str = Field(default="", max_length=10000)
    rollback_plan: str = Field(default="", max_length=10000)
    test_plan: str = Field(default="", max_length=8000)
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    assigned_engineer_user_id: uuid.UUID | None = None
    cab_seats: list[CabMemberSpec] = Field(default_factory=list)


class ChangeUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=3, max_length=240)
    change_type: ChangeType | None = None
    risk_score: RiskLevel | None = None
    risk_assessment: dict[str, Any] | None = None
    reason: str | None = Field(default=None, max_length=6000)
    implementation_plan: str | None = Field(default=None, max_length=10000)
    rollback_plan: str | None = Field(default=None, max_length=10000)
    test_plan: str | None = Field(default=None, max_length=8000)
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    assigned_engineer_user_id: uuid.UUID | None = None
    note: str | None = Field(default=None, max_length=2000)


class ChangeStatusTransitionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ChangeStatus
    note: str = Field(default="", max_length=4000)


class ChangeActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    change_request_id: uuid.UUID
    actor_user_id: uuid.UUID | None
    actor_email: str
    activity_type: str
    action: str
    note: str
    field_changes: list[dict[str, str]]
    created_at: datetime


class ChangeRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    number: str
    title: str
    change_type: str
    status: str
    risk_score: str
    risk_assessment: dict[str, Any]
    reason: str
    implementation_plan: str
    rollback_plan: str
    test_plan: str
    scheduled_start: datetime | None
    scheduled_end: datetime | None
    requester_user_id: uuid.UUID
    requester_name: str
    requester_email: str
    assigned_engineer_user_id: uuid.UUID | None
    assigned_engineer_name: str
    created_at: datetime
    updated_at: datetime
    cab_seats: list[CabSeatOut] = Field(default_factory=list)
    activities: list[ChangeActivityOut] = Field(default_factory=list)
