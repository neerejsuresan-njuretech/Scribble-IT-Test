from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

IncidentPriority = Literal["P1", "P2", "P3", "P4"]
IncidentStatus = Literal["new", "assigned", "in_progress", "pending", "resolved", "closed"]
IncidentCategory = Literal["hardware", "software", "network", "security", "access", "telephony"]
ImpactUrgency = Literal["high", "medium", "low"]
SourceChannel = Literal["portal", "email", "phone", "monitor"]
ActivityType = Literal["work_note", "comment", "field_change", "system_alert", "audit"]
RelationTargetType = Literal["incident", "problem", "change", "asset", "request"]
RelationType = Literal[
    "caused_by", "parent_of", "child_of", "duplicate_of", "related_to", "resolved_by"
]


class IncidentCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=3, max_length=240)
    description: str = Field(default="", max_length=10000)
    priority: IncidentPriority | None = None
    urgency: ImpactUrgency = "medium"
    impact: ImpactUrgency = "medium"
    category: IncidentCategory = "software"
    assignment_group: str | None = Field(default=None, max_length=120)
    assignee_user_id: uuid.UUID | None = None
    affected_ci_id: uuid.UUID | None = None
    affected_ci_label: str | None = Field(default=None, max_length=160)
    source_channel: SourceChannel = "portal"


class IncidentUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=3, max_length=240)
    description: str | None = Field(default=None, max_length=10000)
    status: IncidentStatus | None = None
    priority: IncidentPriority | None = None
    urgency: ImpactUrgency | None = None
    impact: ImpactUrgency | None = None
    category: IncidentCategory | None = None
    assignment_group: str | None = Field(default=None, max_length=120)
    affected_ci_id: uuid.UUID | None = None
    affected_ci_label: str | None = Field(default=None, max_length=160)
    time_logged_mins: int | None = Field(default=None, ge=0, le=100000)
    csat_score: int | None = Field(default=None, ge=1, le=5)
    note: str | None = Field(default=None, max_length=4000)


class IncidentAssignRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assignee_user_id: uuid.UUID | None = None
    assignee_name: str | None = Field(default=None, max_length=160)
    assignment_group: str | None = Field(default=None, max_length=120)
    note: str | None = Field(default=None, max_length=2000)


class IncidentResolveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    resolution_notes: str = Field(min_length=5, max_length=8000)
    time_logged_mins: int | None = Field(default=None, ge=0, le=100000)


class IncidentCloseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    closure_note: str = Field(default="Incident verified and closed.", max_length=4000)
    csat_score: int | None = Field(default=None, ge=1, le=5)


class IncidentActivityCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    activity_type: ActivityType = "work_note"
    action: str = Field(default="Work note added", min_length=2, max_length=120)
    note: str = Field(min_length=1, max_length=8000)


class IncidentAttachmentCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=3, max_length=128)
    size_bytes: int = Field(ge=1, le=52428800)  # 50MB max
    storage_key: str = Field(min_length=3, max_length=512)
    checksum_sha256: str | None = Field(default=None, min_length=64, max_length=64)

    @field_validator("storage_key")
    @classmethod
    def validate_storage_key(cls, value: str) -> str:
        cleaned = value.strip()
        lower = cleaned.lower()
        if ".." in cleaned or cleaned.startswith("/") or lower.startswith(("javascript:", "data:", "http://", "https://")):
            raise ValueError("storage_key must be a safe relative object storage key.")
        return cleaned


class IncidentRelationCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_type: RelationTargetType
    target_id: uuid.UUID
    target_ref: str = Field(min_length=2, max_length=64)
    relation_type: RelationType = "related_to"


class IncidentActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    incident_id: uuid.UUID
    author_user_id: uuid.UUID | None
    author_name: str
    activity_type: str
    action: str
    note: str
    field_changes: list[dict[str, str]]
    created_at: datetime


class IncidentAttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    incident_id: uuid.UUID
    filename: str
    content_type: str
    size_bytes: int
    storage_key: str
    checksum_sha256: str | None
    uploaded_by_email: str
    created_at: datetime


class IncidentRelationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    incident_id: uuid.UUID
    target_type: str
    target_id: uuid.UUID
    target_ref: str
    relation_type: str
    created_by_email: str
    created_at: datetime


class IncidentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    number: str
    title: str
    description: str
    status: str
    priority: str
    urgency: str
    impact: str
    category: str
    requester_user_id: uuid.UUID | None
    requester_name: str
    requester_email: str
    assignee_user_id: uuid.UUID | None
    assignee_name: str
    assignment_group: str | None
    affected_ci_id: uuid.UUID | None
    affected_ci_label: str | None
    sla_deadline: datetime
    sla_breached: bool
    sla_paused_at: datetime | None
    time_logged_mins: int
    csat_score: int | None
    source_channel: str
    resolution_notes: str | None
    resolved_at: datetime | None
    closed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    activities: list[IncidentActivityOut] = Field(default_factory=list)
    attachments: list[IncidentAttachmentOut] = Field(default_factory=list)
    relations: list[IncidentRelationOut] = Field(default_factory=list)
