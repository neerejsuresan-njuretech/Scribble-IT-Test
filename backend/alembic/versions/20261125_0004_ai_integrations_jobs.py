"""Phase 4: AI audit logs, encrypted external integrations, webhooks, background jobs, and telephony call logs.

Revision ID: 20261125_0004
Revises: 20261125_0003
Create Date: 2026-11-25 05:00:00+00:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20261125_0004"
down_revision = "20261125_0003"
branch_labels = None
depends_on = None

TENANT_TABLES = (
    "ai_interaction_logs",
    "integration_connections",
    "webhook_endpoints",
    "background_jobs",
    "telephony_call_logs",
)

MUTABLE_TABLES = (
    "integration_connections",
    "webhook_endpoints",
    "background_jobs",
    "telephony_call_logs",
)


def upgrade() -> None:
    op.create_table(
        "ai_interaction_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("actor_email", sa.String(255), nullable=False, server_default=""),
        sa.Column("action_type", sa.String(48), nullable=False),
        sa.Column("model_name", sa.String(96), nullable=False),
        sa.Column("target_entity_type", sa.String(48), nullable=True),
        sa.Column("target_entity_id", sa.String(128), nullable=True),
        sa.Column("prompt_hash", sa.String(64), nullable=False),
        sa.Column("prompt_chars", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("response_chars", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("latency_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(32), nullable=False, server_default="succeeded"),
        sa.Column("requires_human_approval", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("advisory_summary", sa.String(512), nullable=False, server_default=""),
        sa.Column("error_code", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "action_type IN ('triage_incident','triage_assistant','assess_change','draft_kb','wiki_assist','copilot')",
            name="ck_ai_logs_action_type",
        ),
        sa.CheckConstraint(
            "status IN ('succeeded','failed','rate_limited','quota_exceeded','blocked')",
            name="ck_ai_logs_status",
        ),
    )
    op.create_index("ix_ai_logs_org_created", "ai_interaction_logs", ["organization_id", "created_at"])
    op.create_index("ix_ai_logs_org_actor", "ai_interaction_logs", ["organization_id", "actor_user_id"])

    op.create_table(
        "integration_connections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(48), nullable=False),
        sa.Column("display_name", sa.String(160), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="active"),
        sa.Column("config_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("encrypted_credentials", sa.Text(), nullable=True),
        sa.Column("encrypted_oauth_access_token", sa.Text(), nullable=True),
        sa.Column("encrypted_oauth_refresh_token", sa.Text(), nullable=True),
        sa.Column("oauth_token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("oauth_scopes", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("allowed_roles", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.String(512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "provider IN ('google_workspace','google_drive','google_sheets','google_forms','google_chat',"
            "'twilio','telephony_sip','webhook_outbound','webhook_inbound','email_smtp','slack','pagerduty')",
            name="ck_integrations_provider",
        ),
        sa.CheckConstraint("status IN ('active','paused','error','revoked')", name="ck_integrations_status"),
        sa.UniqueConstraint("organization_id", "provider", "display_name", name="uq_integrations_org_provider_name"),
    )
    op.create_index("ix_integrations_org_provider", "integration_connections", ["organization_id", "provider"])

    op.create_table(
        "webhook_endpoints",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("target_url", sa.String(2048), nullable=False),
        sa.Column("encrypted_signing_secret", sa.Text(), nullable=False),
        sa.Column("subscribed_events", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("max_retries", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("last_delivery_status", sa.String(64), nullable=True),
        sa.Column("last_delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("max_retries BETWEEN 0 AND 10", name="ck_webhooks_max_retries"),
    )
    op.create_index("ix_webhooks_org_active", "webhook_endpoints", ["organization_id", "is_active"])

    op.create_table(
        "background_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_type", sa.String(64), nullable=False),
        sa.Column("payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("status", sa.String(24), nullable=False, server_default="queued"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("idempotency_key", sa.String(128), nullable=True),
        sa.Column("result_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "status IN ('queued','running','completed','failed','dead_letter')",
            name="ck_bg_jobs_status",
        ),
        sa.CheckConstraint("attempts >= 0 AND max_attempts BETWEEN 1 AND 15", name="ck_bg_jobs_attempts"),
    )
    op.create_index("ix_bg_jobs_status_next_run", "background_jobs", ["status", "next_run_at"])
    op.create_index("ix_bg_jobs_org_status", "background_jobs", ["organization_id", "status"])

    op.create_table(
        "telephony_call_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False, server_default="twilio"),
        sa.Column("provider_call_sid", sa.String(128), nullable=True),
        sa.Column("direction", sa.String(16), nullable=False, server_default="outbound"),
        sa.Column("status", sa.String(24), nullable=False, server_default="queued"),
        sa.Column("from_number", sa.String(64), nullable=False, server_default=""),
        sa.Column("to_number", sa.String(64), nullable=False, server_default=""),
        sa.Column("caller_name", sa.String(160), nullable=False, server_default=""),
        sa.Column("agent_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("linked_incident_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("incidents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("direction IN ('inbound','outbound')", name="ck_telephony_direction"),
        sa.CheckConstraint(
            "status IN ('queued','ringing','active','on_hold','completed','failed','missed')",
            name="ck_telephony_status",
        ),
    )
    op.create_index("ix_telephony_org_created", "telephony_call_logs", ["organization_id", "created_at"])

    # Attach updated_at triggers on mutable tables (schema-qualified app.set_updated_at from 0001)
    for table in MUTABLE_TABLES:
        op.execute(
            f"""
            CREATE TRIGGER trg_{table}_updated_at
            BEFORE UPDATE ON {table}
            FOR EACH ROW
            EXECUTE FUNCTION app.set_updated_at();
            """
        )

    # Enforce PostgreSQL Row-Level Security on all 5 tenant tables using canonical fail-closed helpers
    for table in TENANT_TABLES:
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

    # Grants to restricted runtime role (scribble_app) + append-only lock on ai_interaction_logs
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scribble_app') THEN
                GRANT SELECT, INSERT, UPDATE, DELETE ON
                    integration_connections,
                    webhook_endpoints,
                    background_jobs,
                    telephony_call_logs
                TO scribble_app;

                GRANT SELECT, INSERT ON ai_interaction_logs TO scribble_app;
                REVOKE UPDATE, DELETE, TRUNCATE ON ai_interaction_logs FROM scribble_app;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    for table in reversed(TENANT_TABLES):
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table};")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
    for table in reversed(MUTABLE_TABLES):
        op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_updated_at ON {table};")
    for table in reversed(TENANT_TABLES):
        op.drop_table(table)
