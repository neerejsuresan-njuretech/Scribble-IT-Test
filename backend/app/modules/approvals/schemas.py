from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ApprovalItemCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    subject_ref: str = Field(min_length=2, max_length=64)
    title: str = Field(min_length=3, max_length=200)
    stage_order: int = Field(default=1, ge=1, le=20)
    requester_user_id: uuid.UUID | None = None
    assigned_approver_user_id: uuid.UUID


class ApprovalDecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: Literal["approved", "rejected"]
    note: str = Field(default="", max_length=1000)
    override: bool = False
    override_reason: str | None = Field(default=None, max_length=512)


class ApprovalReassignRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    new_approver_user_id: uuid.UUID
    reason: str = Field(min_length=3, max_length=512)


class ApprovalAssignmentHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    approval_item_id: uuid.UUID
    previous_approver_user_id: uuid.UUID | None
    previous_approver_email: str | None
    new_approver_user_id: uuid.UUID
    new_approver_email: str
    reassigned_by_user_id: uuid.UUID
    reassigned_by_email: str
    reason: str
    created_at: datetime


class ApprovalItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    subject_type: str
    subject_ref: str
    title: str
    stage_order: int
    requester_user_id: uuid.UUID
    requester_email: str
    assigned_approver_user_id: uuid.UUID
    assigned_approver_email: str
    status: str
    decision_by_user_id: uuid.UUID | None
    decision_by_email: str | None
    decision_note: str | None
    decided_at: datetime | None
    override_used: bool
    override_reason: str | None
    version: int
    created_at: datetime


class CabSeatCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    change_ref: str = Field(min_length=2, max_length=64)
    change_title: str = Field(min_length=3, max_length=200)
    seat_name: str = Field(min_length=2, max_length=128)
    requester_user_id: uuid.UUID | None = None
    assigned_member_user_id: uuid.UUID


class CabVoteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vote: Literal["approve", "reject", "abstain"]
    comment: str = Field(default="", max_length=1000)
    override: bool = False
    override_reason: str | None = Field(default=None, max_length=512)


class CabSeatReassignRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    new_member_user_id: uuid.UUID
    reason: str = Field(min_length=3, max_length=512)


class CabSeatAssignmentHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    cab_seat_id: uuid.UUID
    previous_member_user_id: uuid.UUID | None
    previous_member_email: str | None
    new_member_user_id: uuid.UUID
    new_member_email: str
    reassigned_by_user_id: uuid.UUID
    reassigned_by_email: str
    reason: str
    created_at: datetime


class CabSeatOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    change_ref: str
    change_title: str
    seat_name: str
    requester_user_id: uuid.UUID
    original_member_user_id: uuid.UUID
    original_member_email: str
    assigned_member_user_id: uuid.UUID
    assigned_member_email: str
    vote: str
    voted_by_user_id: uuid.UUID | None
    voted_by_email: str | None
    vote_comment: str | None
    voted_at: datetime | None
    override_used: bool
    override_reason: str | None
    version: int
    created_at: datetime
