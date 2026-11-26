from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TenantScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin


class DevicePushToken(UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin, Base):
    """
    Tenant-scoped mobile device push token registration for Android (FCM) and iOS (APNs).
    Raw device tokens are encrypted at rest using Fernet and indexed by SHA-256 hash so
    they are never exposed in plaintext in responses, logs, or audit metadata.
    """

    __tablename__ = "device_push_tokens"
    __table_args__ = (
        CheckConstraint("provider IN ('fcm','apns')", name="ck_push_tokens_provider"),
        CheckConstraint("platform IN ('android','ios')", name="ck_push_tokens_platform"),
        CheckConstraint(
            "status IN ('active','revoked','invalid_token')",
            name="ck_push_tokens_status",
        ),
        UniqueConstraint("organization_id", "push_token_hash", name="uq_push_tokens_org_hash"),
        Index("ix_push_tokens_org_user_status", "organization_id", "user_id", "status"),
        Index("ix_push_tokens_session_status", "session_id", "status"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    device_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("managed_devices.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(24), nullable=False)
    platform: Mapped[str] = mapped_column(String(24), nullable=False)
    app_id: Mapped[str | None] = mapped_column(String(160), nullable=True)
    app_version: Mapped[str | None] = mapped_column(String(48), nullable=True)
    device_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    push_token_hash: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    push_token_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    token_preview: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(
        String(24), nullable=False, default="active", server_default="active"
    )
    last_registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    last_delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revocation_reason: Mapped[str | None] = mapped_column(String(128), nullable=True)


class PushDeliveryLog(UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin, Base):
    """Tenant-scoped delivery log for outbound FCM / APNs push notifications and retries."""

    __tablename__ = "push_delivery_logs"
    __table_args__ = (
        CheckConstraint("provider IN ('fcm','apns')", name="ck_push_delivery_provider"),
        CheckConstraint("platform IN ('android','ios')", name="ck_push_delivery_platform"),
        CheckConstraint(
            "status IN ('queued','retrying','delivered','failed','revoked_token','skipped')",
            name="ck_push_delivery_status",
        ),
        Index("ix_push_delivery_org_created", "organization_id", "created_at"),
        Index("ix_push_delivery_user_status", "organization_id", "target_user_id", "status"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    push_token_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("device_push_tokens.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    target_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    background_job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("background_jobs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(24), nullable=False)
    platform: Mapped[str] = mapped_column(String(24), nullable=False)
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    data_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(
        String(24), nullable=False, default="queued", server_default="queued"
    )
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    provider_message_id: Mapped[str | None] = mapped_column(String(256), nullable=True)
    http_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(96), nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(512), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
