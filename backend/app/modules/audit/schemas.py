from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID | None
    actor_user_id: uuid.UUID | None
    actor_email: str
    portal_type: str | None
    module: str
    action: str
    target_type: str | None
    target_id: str | None
    outcome: str
    ip_address: str | None
    user_agent: str | None
    request_id: str | None
    detail: str
    metadata_json: dict[str, Any]
    created_at: datetime


class AuditLogListResponse(BaseModel):
    items: list[AuditLogOut]
    total: int
    limit: int
    offset: int
