from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

PushProvider = Literal["fcm", "apns"]
PushPlatform = Literal["android", "ios"]
PushPriority = Literal["normal", "high"]


class StrictNotificationModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PushTokenRegisterRequest(StrictNotificationModel):
    """Registers or refreshes an authenticated mobile device push token."""

    provider: PushProvider
    platform: PushPlatform
    push_token: str = Field(min_length=16, max_length=4096)
    device_id: uuid.UUID | None = None
    app_id: str | None = Field(default=None, max_length=160)
    app_version: str | None = Field(default=None, max_length=48)
    device_name: str | None = Field(default=None, max_length=160)

    @model_validator(mode="after")
    def validate_provider_platform_match(self) -> PushTokenRegisterRequest:
        if self.platform == "android" and self.provider != "fcm":
            raise ValueError("Android devices must register using the 'fcm' push provider.")
        if self.platform == "ios" and self.provider != "apns":
            raise ValueError("iOS devices must register using the 'apns' push provider.")
        cleaned = self.push_token.strip()
        if any(ch.isspace() for ch in cleaned):
            raise ValueError("Push token must not contain whitespace characters.")
        self.push_token = cleaned
        return self


class PushTokenRevokeByValueRequest(StrictNotificationModel):
    push_token: str = Field(min_length=16, max_length=4096)
    reason: str = Field(default="user_unregistered", max_length=128)


class PushTokenOut(BaseModel):
    """Public push registration metadata — NEVER returns the raw device push token."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    user_id: uuid.UUID
    session_id: uuid.UUID | None
    device_id: uuid.UUID | None
    provider: str
    platform: str
    app_id: str | None
    app_version: str | None
    device_name: str | None
    token_preview: str
    status: str
    last_registered_at: datetime
    last_delivered_at: datetime | None
    revoked_at: datetime | None
    revocation_reason: str | None
    created_at: datetime


class PushTokenListResponse(BaseModel):
    items: list[PushTokenOut]
    total: int


class PushDispatchRequest(StrictNotificationModel):
    """Enqueues push notifications for one or more users within the active organization."""

    target_user_ids: list[uuid.UUID] = Field(min_length=1, max_length=50)
    title: str = Field(min_length=1, max_length=240)
    body: str = Field(min_length=1, max_length=2000)
    data: dict[str, Any] = Field(default_factory=dict)
    priority: PushPriority = "normal"
    max_attempts: int = Field(default=4, ge=1, le=10)


class PushDeliveryLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    push_token_id: uuid.UUID | None
    target_user_id: uuid.UUID | None
    background_job_id: uuid.UUID | None
    provider: str
    platform: str
    title: str
    body: str
    data_json: dict[str, Any]
    status: str
    attempts: int
    provider_message_id: str | None
    http_status: int | None
    error_code: str | None
    error_message: str | None
    sent_at: datetime | None
    next_retry_at: datetime | None
    created_at: datetime
    updated_at: datetime


class PushDispatchResponse(BaseModel):
    queued_count: int
    delivery_ids: list[uuid.UUID]
    job_ids: list[uuid.UUID]


class PushDeliveryLogListResponse(BaseModel):
    items: list[PushDeliveryLogOut]
    total: int
