from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TenantScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin


class AiInteractionLog(Base, UUIDPrimaryKeyMixin):
    """
    Append-only tenant-scoped audit record of every AI invocation.
    PostgreSQL grants REVOKE UPDATE, DELETE, TRUNCATE for scribble_app.
    """

    __tablename__ = "ai_interaction_logs"
    __table_args__ = (
        CheckConstraint(
            "action_type IN ('triage_incident','triage_assistant','assess_change','draft_kb','wiki_assist','copilot')",
            name="ck_ai_logs_action_type",
        ),
        CheckConstraint("status IN ('succeeded','failed','rate_limited','quota_exceeded','blocked')", name="ck_ai_logs_status"),
        Index("ix_ai_logs_org_created", "organization_id", "created_at"),
        Index("ix_ai_logs_org_actor", "organization_id", "actor_user_id"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    actor_email: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    action_type: Mapped[str] = mapped_column(String(48), nullable=False)
    model_name: Mapped[str] = mapped_column(String(96), nullable=False)
    target_entity_type: Mapped[str | None] = mapped_column(String(48), nullable=True)
    target_entity_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    prompt_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    prompt_chars: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    response_chars: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="succeeded")
    requires_human_approval: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    advisory_summary: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class IntegrationConnection(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """
    Tenant-scoped external integration configuration with encrypted credentials
    and OAuth token lifecycle tracking (Google Workspace, Twilio, Webhooks, Notifications).
    """

    __tablename__ = "integration_connections"
    __table_args__ = (
        CheckConstraint(
            "provider IN ("
            "'google_workspace','google_drive','google_sheets','google_forms','google_chat',"
            "'twilio','telephony_sip','webhook_outbound','webhook_inbound',"
            "'email_smtp','slack','pagerduty')",
            name="ck_integrations_provider",
        ),
        CheckConstraint("status IN ('active','paused','error','revoked')", name="ck_integrations_status"),
        UniqueConstraint("organization_id", "provider", "display_name", name="uq_integrations_org_provider_name"),
        Index("ix_integrations_org_provider", "organization_id", "provider"),
    )

    provider: Mapped[str] = mapped_column(String(48), nullable=False)
    display_name: Mapped[str] = mapped_column(String(160), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="active")
    config_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    encrypted_credentials: Mapped[str | None] = mapped_column(Text, nullable=True)
    encrypted_oauth_access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    encrypted_oauth_refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    oauth_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    oauth_scopes: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    allowed_roles: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(String(512), nullable=True)


class WebhookEndpoint(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """SSRF-validated tenant outbound webhook subscription with encrypted HMAC signing secret."""

    __tablename__ = "webhook_endpoints"
    __table_args__ = (
        CheckConstraint("max_retries BETWEEN 0 AND 10", name="ck_webhooks_max_retries"),
        Index("ix_webhooks_org_active", "organization_id", "is_active"),
    )

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    target_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    encrypted_signing_secret: Mapped[str] = mapped_column(Text, nullable=False)
    subscribed_events: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    max_retries: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    last_delivery_status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )


class BackgroundJob(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Durable tenant-scoped async job queue for webhooks, notifications, telephony sync, and retries."""

    __tablename__ = "background_jobs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('queued','running','completed','failed','dead_letter')",
            name="ck_bg_jobs_status",
        ),
        CheckConstraint("attempts >= 0 AND max_attempts BETWEEN 1 AND 15", name="ck_bg_jobs_attempts"),
        Index("ix_bg_jobs_status_next_run", "status", "next_run_at"),
        Index("ix_bg_jobs_org_status", "organization_id", "status"),
    )

    job_type: Mapped[str] = mapped_column(String(64), nullable=False)
    payload_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="queued")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    next_run_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    result_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class TelephonyCallLog(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Persisted CTI/Twilio call record linked to organization incidents."""

    __tablename__ = "telephony_call_logs"
    __table_args__ = (
        CheckConstraint("direction IN ('inbound','outbound')", name="ck_telephony_direction"),
        CheckConstraint(
            "status IN ('queued','ringing','active','on_hold','completed','failed','missed')",
            name="ck_telephony_status",
        ),
        Index("ix_telephony_org_created", "organization_id", "created_at"),
    )

    provider: Mapped[str] = mapped_column(String(32), nullable=False, default="twilio")
    provider_call_sid: Mapped[str | None] = mapped_column(String(128), nullable=True)
    direction: Mapped[str] = mapped_column(String(16), nullable=False, default="outbound")
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="queued")
    from_number: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    to_number: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    caller_name: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    agent_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    linked_incident_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("incidents.id", ondelete="SET NULL"),
        nullable=True,
    )
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
