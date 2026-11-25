from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ProblemStatus = Literal[
    "investigating",
    "root_cause_identified",
    "workaround_published",
    "change_requested",
    "closed",
]
ProblemSeverity = Literal["critical", "high", "moderate", "minor"]


class ProblemCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=3, max_length=240)
    description: str = Field(default="", max_length=10000)
    severity: ProblemSeverity = "high"
    root_cause_analysis: str = Field(default="", max_length=10000)
    workaround: str = Field(default="", max_length=8000)
    permanent_solution: str = Field(default="", max_length=8000)
    linked_incident_ids: list[uuid.UUID] = Field(default_factory=list)
    linked_change_id: uuid.UUID | None = None


class ProblemUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=3, max_length=240)
    description: str | None = Field(default=None, max_length=10000)
    status: ProblemStatus | None = None
    severity: ProblemSeverity | None = None
    root_cause_analysis: str | None = Field(default=None, max_length=10000)
    workaround: str | None = Field(default=None, max_length=8000)
    permanent_solution: str | None = Field(default=None, max_length=8000)
    linked_change_id: uuid.UUID | None = None
    is_known_error: bool | None = None


class KnownErrorPublishRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    root_cause_analysis: str = Field(min_length=5, max_length=10000)
    workaround: str = Field(min_length=5, max_length=8000)


class ProblemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    number: str
    title: str
    description: str
    status: str
    severity: str
    root_cause_analysis: str
    workaround: str
    permanent_solution: str
    owner_user_id: uuid.UUID | None
    owner_name: str
    is_known_error: bool
    known_error_published_at: datetime | None
    linked_change_id: uuid.UUID | None
    linked_incident_ids: list[uuid.UUID] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
