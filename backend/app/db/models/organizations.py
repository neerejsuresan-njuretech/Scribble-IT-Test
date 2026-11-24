from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin, TenantOwnedMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Organization(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Multi-tenant enterprise organization / company profile."""

    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    slug: Mapped[str] = mapped_column(String(96), nullable=False, unique=True, index=True)
    company_code: Mapped[str] = mapped_column(String(48), nullable=False, unique=True, index=True)
    domain: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    plan: Mapped[str] = mapped_column(String(32), nullable=False, default="Enterprise", server_default="Enterprise")
    region: Mapped[str] = mapped_column(String(64), nullable=False, default="us-east1", server_default="us-east1")
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC", server_default="UTC")
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="USD", server_default="USD")
    primary_contact_email: Mapped[str] = mapped_column(String(160), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="active", server_default="active", index=True)
    logo_storage_key: Mapped[str | None] = mapped_column(String(512), nullable=True)

    sla_targets: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=lambda: {"P1": 1, "P2": 4, "P3": 24, "P4": 72},
    )
    enabled_modules: Mapped[dict[str, bool]] = mapped_column(JSONB, nullable=False, default=dict)
    portal_branding: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    preference_template: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    departments: Mapped[list[Department]] = relationship(
        back_populates="organization",
        cascade="all, delete-orphan",
    )


class Department(UUIDPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Tenant-scoped organizational unit / department."""

    __tablename__ = "departments"
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_departments_org_name"),
        Index("ix_departments_org_active", "organization_id", "deleted_at"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    code: Mapped[str | None] = mapped_column(String(32), nullable=True)

    organization: Mapped[Organization] = relationship(back_populates="departments")
