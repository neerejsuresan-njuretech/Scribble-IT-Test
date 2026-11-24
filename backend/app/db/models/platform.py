from __future__ import annotations

from typing import Any

from sqlalchemy import Boolean, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class PlatformSetting(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    """
    Global non-tenant platform configuration metadata table.
    Serves as the Phase 1 relational schema baseline verifying UUID primary keys,
    timezone-aware UTC timestamps, soft-deletion, JSONB structured config, and Alembic migrations.
    """

    __tablename__ = "platform_settings"

    key: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    value_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
