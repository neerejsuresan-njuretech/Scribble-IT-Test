"""Foundation baseline: pgcrypto UUIDs, tenant RLS helper function, updated_at trigger, and platform_settings table.

Revision ID: 20261124_0001
Revises:
Create Date: 2026-11-24 00:00:00.000000+00:00
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261124_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Ensure gen_random_uuid() is available across PostgreSQL installations
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")

    # Dedicated schema for RLS session context helpers
    op.execute("CREATE SCHEMA IF NOT EXISTS app;")

    # Helper function used by Phase 2+ Row-Level Security policies:
    # Returns NULL if no transaction-local tenant context is set (fail-closed default deny).
    op.execute(
        """
        CREATE OR REPLACE FUNCTION app.current_organization_id()
        RETURNS uuid
        LANGUAGE plpgsql
        STABLE
        AS $$
        DECLARE
            raw_org text;
        BEGIN
            raw_org := current_setting('app.current_organization_id', true);
            IF raw_org IS NULL OR raw_org = '' THEN
                RETURN NULL;
            END IF;
            RETURN raw_org::uuid;
        EXCEPTION
            WHEN invalid_text_representation THEN
                RETURN NULL;
        END;
        $$;
        """
    )

    # Reusable UTC updated_at trigger function for relational tables
    op.execute(
        """
        CREATE OR REPLACE FUNCTION app.set_updated_at()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            NEW.updated_at = timezone('utc', now());
            RETURN NEW;
        END;
        $$;
        """
    )

    op.create_table(
        "platform_settings",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("key", sa.String(length=128), nullable=False),
        sa.Column(
            "value_json",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "is_public",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_platform_settings"),
        sa.UniqueConstraint("key", name="uq_platform_settings_key"),
    )
    op.create_index(
        "ix_platform_settings_deleted_at",
        "platform_settings",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        "ix_platform_settings_key",
        "platform_settings",
        ["key"],
        unique=False,
    )

    op.execute(
        """
        CREATE TRIGGER trg_platform_settings_updated_at
        BEFORE UPDATE ON platform_settings
        FOR EACH ROW
        EXECUTE FUNCTION app.set_updated_at();
        """
    )

    # Grant least-privilege runtime access if the restricted scribble_app role exists
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scribble_app') THEN
                GRANT USAGE ON SCHEMA app TO scribble_app;
                GRANT EXECUTE ON FUNCTION app.current_organization_id() TO scribble_app;
                GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE platform_settings TO scribble_app;
            END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_platform_settings_updated_at ON platform_settings;")
    op.drop_index("ix_platform_settings_key", table_name="platform_settings")
    op.drop_index("ix_platform_settings_deleted_at", table_name="platform_settings")
    op.drop_table("platform_settings")
    op.execute("DROP FUNCTION IF EXISTS app.set_updated_at();")
    op.execute("DROP FUNCTION IF EXISTS app.current_organization_id();")
    op.execute("DROP SCHEMA IF EXISTS app;")
