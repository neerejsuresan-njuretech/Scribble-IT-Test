from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, MetaData, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Deterministic constraint naming convention required for reliable Alembic autogenerate & rollbacks
NAMING_CONVENTION: dict[str, str] = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Root declarative base for all Scribble-IT 2.0 relational models."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class UUIDPrimaryKeyMixin:
    """Provides a PostgreSQL-native UUIDv4 primary key with database-side gen_random_uuid() default."""

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )


class TimestampMixin:
    """Provides immutable UTC created_at and auto-updating UTC updated_at columns."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )


class SoftDeleteMixin:
    """Provides nullable UTC soft-delete tracking for recoverable enterprise records."""

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
        index=True,
    )

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None


class TenantOwnedMixin:
    """
    Mixin for tenant-scoped tables.
    Every tenant-owned model MUST attach an explicit organization_id FK (wired to organizations.id in Phase 2)
    and PostgreSQL Row-Level Security policies matching app.current_organization_id.
    """

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )


# Canonical alias so both TenantOwnedMixin and TenantScopedMixin resolve to the single shared mixin
TenantScopedMixin = TenantOwnedMixin

__all__ = [
    "Base",
    "NAMING_CONVENTION",
    "SoftDeleteMixin",
    "TenantOwnedMixin",
    "TenantScopedMixin",
    "TimestampMixin",
    "UUIDPrimaryKeyMixin",
]
