"""Phase 5.3: Native client session/device metadata and encrypted push notifications with RLS.

Revision ID: 20261126_0005
Revises: 20261125_0004
Create Date: 2026-11-26 02:00:00+00:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20261126_0005"
down_revision = "20261125_0004"
branch_labels = None
depends_on = None

NEW_TENANT_TABLES = (
    "device_push_tokens",
    "push_delivery_logs",
)


def upgrade() -> None:
    # 1. Extend sessions with native client metadata
    op.add_column(
        "sessions",
        sa.Column("client_type", sa.String(24), nullable=False, server_default=sa.text("'web'")),
    )
    op.add_column(
        "sessions",
        sa.Column("client_platform", sa.String(32), nullable=False, server_default=sa.text("'web'")),
    )
    op.add_column("sessions", sa.Column("app_version", sa.String(48), nullable=True))
    op.add_column("sessions", sa.Column("app_id", sa.String(160), nullable=True))
    op.add_column("sessions", sa.Column("device_name", sa.String(160), nullable=True))

    # 2. Extend managed_devices with native platform/version attributes (preserving trust_level/mdm_verified)
    op.add_column(
        "managed_devices",
        sa.Column("client_type", sa.String(24), nullable=False, server_default=sa.text("'web'")),
    )
    op.add_column(
        "managed_devices",
        sa.Column("device_platform", sa.String(32), nullable=False, server_default=sa.text("'web'")),
    )
    op.add_column("managed_devices", sa.Column("app_version", sa.String(48), nullable=True))
    op.add_column("managed_devices", sa.Column("os_version", sa.String(64), nullable=True))
    op.add_column("managed_devices", sa.Column("device_model", sa.String(128), nullable=True))

    # 3. Expand integration providers and background_jobs statuses
    op.drop_constraint("ck_integrations_provider", "integration_connections", type_="check")
    op.create_check_constraint(
        "ck_integrations_provider",
        "integration_connections",
        "provider IN ("
        "'google_workspace','google_drive','google_sheets','google_forms','google_chat',"
        "'twilio','telephony_sip','webhook_outbound','webhook_inbound',"
        "'email_smtp','slack','pagerduty','fcm','apns')",
    )

    op.drop_constraint("ck_bg_jobs_status", "background_jobs", type_="check")
    op.create_check_constraint(
        "ck_bg_jobs_status",
        "background_jobs",
        "status IN ('queued','running','retrying','succeeded','completed','failed','dead_letter')",
    )

    # 4. Create device_push_tokens
    op.create_table(
        "device_push_tokens",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sessions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "device_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("managed_devices.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("provider", sa.String(24), nullable=False),
        sa.Column("platform", sa.String(24), nullable=False),
        sa.Column("app_id", sa.String(160), nullable=True),
        sa.Column("app_version", sa.String(48), nullable=True),
        sa.Column("device_name", sa.String(160), nullable=True),
        sa.Column("push_token_hash", sa.String(128), nullable=False),
        sa.Column("push_token_encrypted", sa.Text(), nullable=False),
        sa.Column("token_preview", sa.String(32), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default=sa.text("'active'")),
        sa.Column(
            "last_registered_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("last_delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revocation_reason", sa.String(128), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint("provider IN ('fcm','apns')", name="ck_push_tokens_provider"),
        sa.CheckConstraint("platform IN ('android','ios')", name="ck_push_tokens_platform"),
        sa.CheckConstraint(
            "status IN ('active','revoked','invalid_token')",
            name="ck_push_tokens_status",
        ),
        sa.UniqueConstraint("organization_id", "push_token_hash", name="uq_push_tokens_org_hash"),
    )
    op.create_index("ix_device_push_tokens_organization_id", "device_push_tokens", ["organization_id"])
    op.create_index("ix_device_push_tokens_user_id", "device_push_tokens", ["user_id"])
    op.create_index("ix_device_push_tokens_session_id", "device_push_tokens", ["session_id"])
    op.create_index("ix_device_push_tokens_device_id", "device_push_tokens", ["device_id"])
    op.create_index("ix_device_push_tokens_push_token_hash", "device_push_tokens", ["push_token_hash"])
    op.create_index(
        "ix_push_tokens_org_user_status",
        "device_push_tokens",
        ["organization_id", "user_id", "status"],
    )
    op.create_index("ix_push_tokens_session_status", "device_push_tokens", ["session_id", "status"])

    # 5. Create push_delivery_logs
    op.create_table(
        "push_delivery_logs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "push_token_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("device_push_tokens.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "target_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "background_job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("background_jobs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("provider", sa.String(24), nullable=False),
        sa.Column("platform", sa.String(24), nullable=False),
        sa.Column("title", sa.String(240), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "data_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("status", sa.String(24), nullable=False, server_default=sa.text("'queued'")),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("provider_message_id", sa.String(256), nullable=True),
        sa.Column("http_status", sa.Integer(), nullable=True),
        sa.Column("error_code", sa.String(96), nullable=True),
        sa.Column("error_message", sa.String(512), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_retry_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint("provider IN ('fcm','apns')", name="ck_push_delivery_provider"),
        sa.CheckConstraint("platform IN ('android','ios')", name="ck_push_delivery_platform"),
        sa.CheckConstraint(
            "status IN ('queued','retrying','delivered','failed','revoked_token','skipped')",
            name="ck_push_delivery_status",
        ),
    )
    op.create_index("ix_push_delivery_logs_organization_id", "push_delivery_logs", ["organization_id"])
    op.create_index("ix_push_delivery_logs_push_token_id", "push_delivery_logs", ["push_token_id"])
    op.create_index("ix_push_delivery_logs_target_user_id", "push_delivery_logs", ["target_user_id"])
    op.create_index("ix_push_delivery_logs_background_job_id", "push_delivery_logs", ["background_job_id"])
    op.create_index("ix_push_delivery_org_created", "push_delivery_logs", ["organization_id", "created_at"])
    op.create_index(
        "ix_push_delivery_user_status",
        "push_delivery_logs",
        ["organization_id", "target_user_id", "status"],
    )

    # 6. Attach updated_at triggers, FORCE ROW LEVEL SECURITY, and runtime role grants
    for table in NEW_TENANT_TABLES:
        op.execute(
            f"""
            CREATE TRIGGER trg_{table}_updated_at
            BEFORE UPDATE ON {table}
            FOR EACH ROW
            EXECUTE FUNCTION app.set_updated_at();
            """
        )
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")
        op.execute(
            f"""
            CREATE POLICY {table}_tenant_isolation ON {table}
            USING (
                app.is_rls_bypassed()
                OR organization_id = app.current_organization_id()
            )
            WITH CHECK (
                app.is_rls_bypassed()
                OR organization_id = app.current_organization_id()
            );
            """
        )

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scribble_app') THEN
                GRANT SELECT, INSERT, UPDATE, DELETE ON
                    device_push_tokens,
                    push_delivery_logs
                TO scribble_app;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    for table in reversed(NEW_TENANT_TABLES):
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table};")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
        op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_updated_at ON {table};")
        op.drop_table(table)

    op.drop_constraint("ck_bg_jobs_status", "background_jobs", type_="check")
    op.create_check_constraint(
        "ck_bg_jobs_status",
        "background_jobs",
        "status IN ('queued','running','completed','failed','dead_letter')",
    )

    op.drop_constraint("ck_integrations_provider", "integration_connections", type_="check")
    op.create_check_constraint(
        "ck_integrations_provider",
        "integration_connections",
        "provider IN ("
        "'google_workspace','google_drive','google_sheets','google_forms','google_chat',"
        "'twilio','telephony_sip','webhook_outbound','webhook_inbound',"
        "'email_smtp','slack','pagerduty')",
    )

    for col in ("device_model", "os_version", "app_version", "device_platform", "client_type"):
        op.drop_column("managed_devices", col)

    for col in ("device_name", "app_id", "app_version", "client_platform", "client_type"):
        op.drop_column("sessions", col)
