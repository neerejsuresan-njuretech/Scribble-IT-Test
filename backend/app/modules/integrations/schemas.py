from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

IntegrationProvider = Literal[
    "google_workspace",
    "google_drive",
    "google_sheets",
    "google_forms",
    "google_chat",
    "twilio",
    "telephony_sip",
    "webhook_outbound",
    "webhook_inbound",
    "email_smtp",
    "slack",
    "pagerduty",
    "fcm",
    "apns",
]


class StrictIntegrationModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class IntegrationCreateRequest(StrictIntegrationModel):
    provider: IntegrationProvider
    display_name: str = Field(min_length=2, max_length=160)
    config_json: dict[str, Any] = Field(default_factory=dict)
    credentials: dict[str, str] | None = None
    oauth_scopes: list[str] = Field(default_factory=list, max_length=30)
    allowed_roles: list[str] = Field(default_factory=list, max_length=20)


class IntegrationUpdateRequest(StrictIntegrationModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=160)
    status: Literal["active", "paused", "revoked"] | None = None
    config_json: dict[str, Any] | None = None
    credentials: dict[str, str] | None = None
    allowed_roles: list[str] | None = None


class OAuthTokenUpdateRequest(StrictIntegrationModel):
    access_token: str = Field(min_length=8, max_length=4096)
    refresh_token: str | None = Field(default=None, max_length=4096)
    expires_in_seconds: int = Field(default=3600, ge=60, le=86400 * 30)
    scopes: list[str] = Field(default_factory=list, max_length=30)


class IntegrationConnectionOut(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    provider: str
    display_name: str
    status: str
    config_json: dict[str, Any]
    has_credentials: bool
    has_oauth_token: bool
    oauth_token_expires_at: datetime | None
    oauth_scopes: list[str]
    allowed_roles: list[str]
    last_synced_at: datetime | None
    last_error: str | None
    created_at: datetime
    updated_at: datetime


class WebhookCreateRequest(StrictIntegrationModel):
    name: str = Field(min_length=2, max_length=160)
    target_url: str = Field(min_length=8, max_length=2048)
    signing_secret: str = Field(min_length=16, max_length=256)
    subscribed_events: list[str] = Field(min_length=1, max_length=30)
    max_retries: int = Field(default=3, ge=0, le=10)


class WebhookEndpointOut(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    target_url: str
    subscribed_events: list[str]
    is_active: bool
    max_retries: int
    last_delivery_status: str | None
    last_delivered_at: datetime | None
    created_at: datetime


class GoogleWorkspaceActionRequest(StrictIntegrationModel):
    connection_id: uuid.UUID
    action: Literal[
        "drive_list_files",
        "drive_upload_text",
        "sheets_create",
        "sheets_append",
        "forms_list",
        "forms_create",
        "chat_list_spaces",
        "chat_send_message",
    ]
    params: dict[str, Any] = Field(default_factory=dict)


class OutboundCallRequest(StrictIntegrationModel):
    to_number: str = Field(min_length=4, max_length=32)
    caller_name: str = Field(default="", max_length=160)
    linked_incident_id: uuid.UUID | None = None
    notes: str = Field(default="", max_length=2000)


class TelephonyCallOut(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    provider: str
    provider_call_sid: str | None
    direction: str
    status: str
    from_number: str
    to_number: str
    caller_name: str
    linked_incident_id: uuid.UUID | None
    duration_seconds: int
    notes: str
    created_at: datetime


class NotificationDispatchRequest(StrictIntegrationModel):
    connection_id: uuid.UUID
    channel: str = Field(default="", max_length=160)
    subject: str = Field(min_length=1, max_length=240)
    message: str = Field(min_length=1, max_length=4000)
    severity: Literal["info", "warning", "critical"] = "info"


class BackgroundJobOut(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    job_type: str
    status: str
    attempts: int
    max_attempts: int
    next_run_at: datetime
    last_error: str | None
    completed_at: datetime | None
    created_at: datetime
