from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TenantOwnedMixin, TimestampMixin, UUIDPrimaryKeyMixin


class DeviceEnrollmentCode(UUIDPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin, Base):
    """
    Single-use, time-limited verification code (IAM-XXXX-XXXX) issued exclusively
    through an authenticated IAM Portal session to onboard a corporate managed device.
    Stored strictly as a SHA-256 hash so raw codes are never persisted in plaintext.
    """

    __tablename__ = "device_enrollment_codes"
    __table_args__ = (
        Index("ix_device_codes_org_status", "organization_id", "status"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    code_prefix: Mapped[str] = mapped_column(String(16), nullable=False)
    assigned_email: Mapped[str | None] = mapped_column(String(160), nullable=True, index=True)
    target_hostname: Mapped[str | None] = mapped_column(String(128), nullable=True)
    mdm_provider: Mapped[str] = mapped_column(String(96), nullable=False, default="Microsoft Intune")
    status: Mapped[str] = mapped_column(
        String(24),
        nullable=False,
        default="active",
        server_default="active",
    )  # active | used | revoked | expired
    issued_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    used_by_device_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


class ManagedDevice(UUIDPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin, Base):
    """
    IAM-verified corporate managed device record required for Company Device SSO.
    Revoking a device immediately invalidates all SSO sessions linked to it.
    """

    __tablename__ = "managed_devices"
    __table_args__ = (
        UniqueConstraint("organization_id", "device_fingerprint_hash", name="uq_managed_devices_org_fp"),
        Index("ix_managed_devices_org_status", "organization_id", "status"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    device_fingerprint_hash: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    hostname: Mapped[str] = mapped_column(String(128), nullable=False)
    os_platform: Mapped[str] = mapped_column(String(64), nullable=False, default="Enterprise OS")
    mdm_provider: Mapped[str] = mapped_column(String(96), nullable=False, default="Microsoft Intune")
    certificate_thumbprint: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    bound_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    enrolled_by_email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    enrollment_code_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("device_enrollment_codes.id", ondelete="SET NULL"),
        nullable=True,
    )
    verified_by_iam: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    status: Mapped[str] = mapped_column(
        String(24),
        nullable=False,
        default="active",
        server_default="active",
    )  # active | revoked
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
