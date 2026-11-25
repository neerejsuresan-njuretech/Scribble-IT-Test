"""Phase 2 Enterprise IAM, Multi-Tenant RLS, Device Trust, Approvals/CAB, and Immutable Audit Log schema.

Revision ID: 20261124_0002
Revises: 20261124_0001
Create Date: 2026-11-24 12:00:00.000000+00:00
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261124_0002"
down_revision: str | None = "20261124_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CANONICAL_PERMISSIONS: list[tuple[str, str, str]] = [
    ("incidents:read", "itsm", "View incidents, problems, service requests, and changes"),
    ("incidents:write", "itsm", "Create, triage, update, and resolve operational ITSM records"),
    ("assets:read", "cmdb", "View CMDB assets, network topology, software licences, and domains"),
    ("assets:write", "cmdb", "Create and modify assets, hardware inventory, and vendor contracts"),
    ("requests:approve", "approvals", "Approve or reject assigned service request stages"),
    ("changes:cab_vote", "approvals", "Cast assigned Change Advisory Board (CAB) votes"),
    ("workflows:manage", "automation", "Configure workflow engine, ticket routing rules, process maps, and custom forms"),
    ("iam:manage", "iam", "Manage organization identities, role policies, and user suspensions"),
    ("devices:enroll_code", "iam", "Generate single-use IAM device enrollment verification codes (IAM Portal exclusive)"),
    ("tenants:admin", "governance", "Create/update organizations, logos, portal branding, SLAs, and module toggles (Super Admin exclusive)"),
    ("billing:read", "finance", "View and manage billing invoices and financial reports"),
    ("audit:read", "governance", "Read centralized append-only security and governance audit logs"),
]

# Tables strictly protected by PostgreSQL Row-Level Security on organization_id
STRICT_TENANT_RLS_TABLES: tuple[str, ...] = (
    "departments",
    "organization_memberships",
    "device_enrollment_codes",
    "managed_devices",
    "device_trust_events",
    "approval_workflow_items",
    "approval_assignment_history",
    "cab_voting_seats",
    "cab_seat_assignment_history",
)

# Tables allowing NULL organization_id for global system records while isolating tenant rows
HYBRID_TENANT_RLS_TABLES: tuple[str, ...] = (
    "roles",
    "audit_logs",
)

UPDATED_AT_TABLES: tuple[str, ...] = (
    "organizations",
    "departments",
    "users",
    "permissions",
    "roles",
    "organization_memberships",
    "device_enrollment_codes",
    "managed_devices",
    "sessions",
    "mfa_methods",
    "password_reset_tokens",
    "approval_workflow_items",
    "cab_voting_seats",
)

OPERATIONAL_DML_TABLES: tuple[str, ...] = (
    "organizations",
    "departments",
    "users",
    "permissions",
    "roles",
    "role_permissions",
    "organization_memberships",
    "membership_roles",
    "device_enrollment_codes",
    "managed_devices",
    "sessions",
    "mfa_methods",
    "password_reset_tokens",
    "approval_workflow_items",
    "approval_assignment_history",
    "cab_voting_seats",
    "cab_seat_assignment_history",
)

APPEND_ONLY_TABLES: tuple[str, ...] = (
    "audit_logs",
    "device_trust_events",
)


def _uuid_pk() -> sa.Column:
    return sa.Column(
        "id",
        postgresql.UUID(as_uuid=True),
        server_default=sa.text("gen_random_uuid()"),
        nullable=False,
    )


def _ts_columns(*, include_updated: bool = True, include_deleted: bool = False) -> list[sa.Column]:
    cols = [
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        )
    ]
    if include_updated:
        cols.append(
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            )
        )
    if include_deleted:
        cols.append(sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    return cols


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. PostgreSQL RLS bypass helper & append-only audit guard trigger
    # ------------------------------------------------------------------
    op.execute(
        """
        CREATE OR REPLACE FUNCTION app.is_rls_bypassed()
        RETURNS boolean
        LANGUAGE sql
        STABLE
        AS $$
            SELECT COALESCE(current_setting('app.rls_bypass', true), 'off') = 'on';
        $$;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION app.prevent_audit_log_mutation()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            RAISE EXCEPTION 'audit_logs is append-only; UPDATE and DELETE operations are forbidden.';
        END;
        $$;
        """
    )

    # ------------------------------------------------------------------
    # 2. Organizations & Departments
    # ------------------------------------------------------------------
    op.create_table(
        "organizations",
        _uuid_pk(),
        *_ts_columns(include_updated=True, include_deleted=True),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("slug", sa.String(length=96), nullable=False),
        sa.Column("company_code", sa.String(length=48), nullable=False),
        sa.Column("domain", sa.String(length=160), nullable=False),
        sa.Column("plan", sa.String(length=32), server_default=sa.text("'Enterprise'"), nullable=False),
        sa.Column("region", sa.String(length=64), server_default=sa.text("'us-east1'"), nullable=False),
        sa.Column("timezone", sa.String(length=64), server_default=sa.text("'UTC'"), nullable=False),
        sa.Column("currency", sa.String(length=8), server_default=sa.text("'USD'"), nullable=False),
        sa.Column("primary_contact_email", sa.String(length=160), nullable=False),
        sa.Column("status", sa.String(length=24), server_default=sa.text("'active'"), nullable=False),
        sa.Column("logo_storage_key", sa.String(length=512), nullable=True),
        sa.Column(
            "sla_targets",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{\"P1\": 1, \"P2\": 4, \"P3\": 24, \"P4\": 72}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "enabled_modules",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "portal_branding",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "preference_template",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_organizations"),
        sa.UniqueConstraint("slug", name="uq_organizations_slug"),
        sa.UniqueConstraint("company_code", name="uq_organizations_company_code"),
    )
    op.create_index("ix_organizations_slug", "organizations", ["slug"])
    op.create_index("ix_organizations_company_code", "organizations", ["company_code"])
    op.create_index("ix_organizations_domain", "organizations", ["domain"])
    op.create_index("ix_organizations_status", "organizations", ["status"])
    op.create_index("ix_organizations_deleted_at", "organizations", ["deleted_at"])

    op.create_table(
        "departments",
        _uuid_pk(),
        *_ts_columns(include_updated=True, include_deleted=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("code", sa.String(length=32), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_departments_org", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_departments"),
        sa.UniqueConstraint("organization_id", "name", name="uq_departments_org_name"),
    )
    op.create_index("ix_departments_organization_id", "departments", ["organization_id"])
    op.create_index("ix_departments_org_active", "departments", ["organization_id", "deleted_at"])

    # ------------------------------------------------------------------
    # 3. Users, Permissions, Roles, Memberships
    # ------------------------------------------------------------------
    op.create_table(
        "users",
        _uuid_pk(),
        *_ts_columns(include_updated=True, include_deleted=True),
        sa.Column("email", sa.String(length=160), nullable=False),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("full_name", sa.String(length=160), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("job_title", sa.String(length=128), nullable=True),
        sa.Column("status", sa.String(length=32), server_default=sa.text("'active'"), nullable=False),
        sa.Column("email_verified", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_platform_super_admin", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("failed_login_attempts", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_status", "users", ["status"])
    op.create_index("ix_users_deleted_at", "users", ["deleted_at"])

    op.create_table(
        "permissions",
        _uuid_pk(),
        *_ts_columns(include_updated=True, include_deleted=False),
        sa.Column("scope", sa.String(length=64), nullable=False),
        sa.Column("category", sa.String(length=48), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_permissions"),
        sa.UniqueConstraint("scope", name="uq_permissions_scope"),
    )
    op.create_index("ix_permissions_scope", "permissions", ["scope"])
    op.create_index("ix_permissions_category", "permissions", ["category"])

    # Seed canonical permission scopes idempotently
    permissions_table = sa.table(
        "permissions",
        sa.column("scope", sa.String),
        sa.column("category", sa.String),
        sa.column("description", sa.Text),
    )
    op.bulk_insert(
        permissions_table,
        [
            {"scope": scope, "category": category, "description": desc}
            for scope, category, desc in CANONICAL_PERMISSIONS
        ],
    )

    op.create_table(
        "roles",
        _uuid_pk(),
        *_ts_columns(include_updated=True, include_deleted=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), server_default=sa.text("''"), nullable=False),
        sa.Column("is_system", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("sso_only", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("mfa_required", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_roles_org", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_roles"),
        sa.UniqueConstraint("organization_id", "slug", name="uq_roles_org_slug"),
    )
    op.create_index("ix_roles_organization_id", "roles", ["organization_id"])
    op.create_index("ix_roles_org_active", "roles", ["organization_id", "deleted_at"])

    op.create_table(
        "role_permissions",
        sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("permission_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], name="fk_role_permissions_role", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["permission_id"], ["permissions.id"], name="fk_role_permissions_perm", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("role_id", "permission_id", name="pk_role_permissions"),
    )

    op.create_table(
        "organization_memberships",
        _uuid_pk(),
        *_ts_columns(include_updated=True, include_deleted=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("department_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("portal_type", sa.String(length=24), server_default=sa.text("'employee'"), nullable=False),
        sa.Column("clearance_tier", sa.String(length=32), server_default=sa.text("'it_operations'"), nullable=False),
        sa.Column("status", sa.String(length=24), server_default=sa.text("'active'"), nullable=False),
        sa.Column("sso_only", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("mfa_required", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_default", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_org_memberships_org", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_org_memberships_user", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], name="fk_org_memberships_dept", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_organization_memberships"),
        sa.UniqueConstraint("organization_id", "user_id", name="uq_org_memberships_org_user"),
    )
    op.create_index("ix_org_memberships_organization_id", "organization_memberships", ["organization_id"])
    op.create_index("ix_org_memberships_user_id", "organization_memberships", ["user_id"])
    op.create_index("ix_org_memberships_portal_type", "organization_memberships", ["portal_type"])
    op.create_index("ix_org_memberships_user_status", "organization_memberships", ["user_id", "status"])

    op.create_table(
        "membership_roles",
        sa.Column("membership_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["membership_id"], ["organization_memberships.id"], name="fk_membership_roles_mem", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], name="fk_membership_roles_role", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("membership_id", "role_id", name="pk_membership_roles"),
    )

    # ------------------------------------------------------------------
    # 4. Device Trust, Managed Devices & Trust History
    # ------------------------------------------------------------------
    op.create_table(
        "device_enrollment_codes",
        _uuid_pk(),
        *_ts_columns(include_updated=True, include_deleted=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code_hash", sa.String(length=128), nullable=False),
        sa.Column("code_prefix", sa.String(length=16), nullable=False),
        sa.Column("assigned_email", sa.String(length=160), nullable=True),
        sa.Column("target_hostname", sa.String(length=128), nullable=True),
        sa.Column("mdm_provider", sa.String(length=96), server_default=sa.text("'Microsoft Intune'"), nullable=False),
        sa.Column("status", sa.String(length=24), server_default=sa.text("'active'"), nullable=False),
        sa.Column("issued_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("used_by_device_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_device_codes_org", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["issued_by_user_id"], ["users.id"], name="fk_device_codes_issuer", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["revoked_by_user_id"], ["users.id"], name="fk_device_codes_revoker", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_device_enrollment_codes"),
        sa.UniqueConstraint("code_hash", name="uq_device_enrollment_codes_hash"),
    )
    op.create_index("ix_device_codes_organization_id", "device_enrollment_codes", ["organization_id"])
    op.create_index("ix_device_codes_code_hash", "device_enrollment_codes", ["code_hash"])
    op.create_index("ix_device_codes_org_status", "device_enrollment_codes", ["organization_id", "status"])

    op.create_table(
        "managed_devices",
        _uuid_pk(),
        *_ts_columns(include_updated=True, include_deleted=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("device_fingerprint_hash", sa.String(length=128), nullable=False),
        sa.Column("hostname", sa.String(length=128), nullable=False),
        sa.Column("os_platform", sa.String(length=64), server_default=sa.text("'Enterprise OS'"), nullable=False),
        sa.Column("mdm_provider", sa.String(length=96), server_default=sa.text("'Microsoft Intune'"), nullable=False),
        sa.Column("certificate_thumbprint", sa.String(length=128), nullable=False),
        sa.Column("bound_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("enrolled_by_email", sa.String(length=160), nullable=True),
        sa.Column("enrollment_code_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("trust_level", sa.String(length=32), server_default=sa.text("'registered_iam_code'"), nullable=False),
        sa.Column("verified_by_iam", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("mdm_verified", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("mdm_authority_ref", sa.String(length=160), nullable=True),
        sa.Column("mdm_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=24), server_default=sa.text("'active'"), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_managed_devices_org", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["bound_user_id"], ["users.id"], name="fk_managed_devices_user", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["enrollment_code_id"], ["device_enrollment_codes.id"], name="fk_managed_devices_code", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["revoked_by_user_id"], ["users.id"], name="fk_managed_devices_revoker", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_managed_devices"),
        sa.UniqueConstraint("organization_id", "device_fingerprint_hash", name="uq_managed_devices_org_fp"),
        sa.UniqueConstraint("certificate_thumbprint", name="uq_managed_devices_cert"),
    )
    op.create_index("ix_managed_devices_organization_id", "managed_devices", ["organization_id"])
    op.create_index("ix_managed_devices_fp", "managed_devices", ["device_fingerprint_hash"])
    op.create_index("ix_managed_devices_org_status", "managed_devices", ["organization_id", "status"])

    op.create_table(
        "device_trust_events",
        _uuid_pk(),
        *_ts_columns(include_updated=False, include_deleted=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("device_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("enrollment_code_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(length=48), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_email", sa.String(length=160), server_default=sa.text("'system'"), nullable=False),
        sa.Column("detail", sa.Text(), server_default=sa.text("''"), nullable=False),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_device_events_org", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["device_id"], ["managed_devices.id"], name="fk_device_events_device", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["enrollment_code_id"], ["device_enrollment_codes.id"], name="fk_device_events_code", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], name="fk_device_events_actor", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_device_trust_events"),
    )
    op.create_index("ix_device_trust_events_org_device", "device_trust_events", ["organization_id", "device_id", "created_at"])

    # ------------------------------------------------------------------
    # 5. Sessions, MFA & Password Reset / Email Verification Tokens
    # ------------------------------------------------------------------
    op.create_table(
        "sessions",
        _uuid_pk(),
        *_ts_columns(include_updated=True, include_deleted=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("membership_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("portal_type", sa.String(length=24), nullable=False),
        sa.Column("auth_method", sa.String(length=32), nullable=False),
        sa.Column("token_family_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("refresh_token_hash", sa.String(length=128), nullable=False),
        sa.Column("previous_refresh_token_hash", sa.String(length=128), nullable=True),
        sa.Column("device_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revocation_reason", sa.String(length=128), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_sessions_user", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_sessions_org", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["membership_id"], ["organization_memberships.id"], name="fk_sessions_mem", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["device_id"], ["managed_devices.id"], name="fk_sessions_device", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_sessions"),
        sa.UniqueConstraint("refresh_token_hash", name="uq_sessions_refresh_hash"),
    )
    op.create_index("ix_sessions_user_active", "sessions", ["user_id", "revoked_at"])
    op.create_index("ix_sessions_family", "sessions", ["token_family_id"])
    op.create_index("ix_sessions_prev_refresh_hash", "sessions", ["previous_refresh_token_hash"])

    op.create_table(
        "mfa_methods",
        _uuid_pk(),
        *_ts_columns(include_updated=True, include_deleted=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("method_type", sa.String(length=24), server_default=sa.text("'totp'"), nullable=False),
        sa.Column("label", sa.String(length=96), server_default=sa.text("'Authenticator App'"), nullable=False),
        sa.Column("secret_encrypted", sa.Text(), nullable=False),
        sa.Column("backup_code_hashes", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("is_verified", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_primary", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_mfa_methods_user", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_mfa_methods"),
    )
    op.create_index("ix_mfa_methods_user_verified", "mfa_methods", ["user_id", "is_verified"])

    op.create_table(
        "password_reset_tokens",
        _uuid_pk(),
        *_ts_columns(include_updated=True, include_deleted=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("purpose", sa.String(length=32), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_password_reset_user", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_password_reset_tokens"),
        sa.UniqueConstraint("token_hash", name="uq_password_reset_tokens_hash"),
    )
    op.create_index("ix_password_reset_tokens_user_purpose", "password_reset_tokens", ["user_id", "purpose"])

    # ------------------------------------------------------------------
    # 6. Designated Approvals & Change Advisory Board (CAB) Voting
    # ------------------------------------------------------------------
    op.create_table(
        "approval_workflow_items",
        _uuid_pk(),
        *_ts_columns(include_updated=True, include_deleted=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject_type", sa.String(length=32), server_default=sa.text("'service_request'"), nullable=False),
        sa.Column("subject_ref", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("stage_order", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("requester_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requester_email", sa.String(length=160), nullable=False),
        sa.Column("assigned_approver_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assigned_approver_email", sa.String(length=160), nullable=False),
        sa.Column("status", sa.String(length=24), server_default=sa.text("'pending'"), nullable=False),
        sa.Column("decision_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("decision_by_email", sa.String(length=160), nullable=True),
        sa.Column("decision_note", sa.Text(), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("override_used", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("override_reason", sa.Text(), nullable=True),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_approvals_org", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requester_user_id"], ["users.id"], name="fk_approvals_requester", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["assigned_approver_user_id"], ["users.id"], name="fk_approvals_assignee", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["decision_by_user_id"], ["users.id"], name="fk_approvals_decider", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_approval_workflow_items"),
    )
    op.create_index("ix_approvals_org_status", "approval_workflow_items", ["organization_id", "status"])
    op.create_index("ix_approvals_org_assigned", "approval_workflow_items", ["organization_id", "assigned_approver_user_id"])

    op.create_table(
        "approval_assignment_history",
        _uuid_pk(),
        *_ts_columns(include_updated=False, include_deleted=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("approval_item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("previous_approver_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("previous_approver_email", sa.String(length=160), nullable=True),
        sa.Column("new_approver_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("new_approver_email", sa.String(length=160), nullable=False),
        sa.Column("reassigned_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reassigned_by_email", sa.String(length=160), nullable=False),
        sa.Column("reason", sa.Text(), server_default=sa.text("''"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_approval_hist_org", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["approval_item_id"], ["approval_workflow_items.id"], name="fk_approval_hist_item", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["previous_approver_user_id"], ["users.id"], name="fk_approval_hist_prev", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["new_approver_user_id"], ["users.id"], name="fk_approval_hist_new", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["reassigned_by_user_id"], ["users.id"], name="fk_approval_hist_actor", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_approval_assignment_history"),
    )
    op.create_index("ix_approval_history_item", "approval_assignment_history", ["approval_item_id", "created_at"])

    op.create_table(
        "cab_voting_seats",
        _uuid_pk(),
        *_ts_columns(include_updated=True, include_deleted=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("change_ref", sa.String(length=64), nullable=False),
        sa.Column("change_title", sa.String(length=200), nullable=False),
        sa.Column("seat_name", sa.String(length=128), nullable=False),
        sa.Column("requester_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("original_member_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("original_member_email", sa.String(length=160), nullable=False),
        sa.Column("assigned_member_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assigned_member_email", sa.String(length=160), nullable=False),
        sa.Column("vote", sa.String(length=24), server_default=sa.text("'pending'"), nullable=False),
        sa.Column("voted_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("voted_by_email", sa.String(length=160), nullable=True),
        sa.Column("vote_comment", sa.Text(), nullable=True),
        sa.Column("voted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("override_used", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("override_reason", sa.Text(), nullable=True),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_cab_seats_org", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requester_user_id"], ["users.id"], name="fk_cab_seats_requester", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["original_member_user_id"], ["users.id"], name="fk_cab_seats_orig", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["assigned_member_user_id"], ["users.id"], name="fk_cab_seats_assignee", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["voted_by_user_id"], ["users.id"], name="fk_cab_seats_voter", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_cab_voting_seats"),
    )
    op.create_index("ix_cab_seats_org_change", "cab_voting_seats", ["organization_id", "change_ref"])
    op.create_index("ix_cab_seats_org_member", "cab_voting_seats", ["organization_id", "assigned_member_user_id"])

    op.create_table(
        "cab_seat_assignment_history",
        _uuid_pk(),
        *_ts_columns(include_updated=False, include_deleted=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cab_seat_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("previous_member_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("previous_member_email", sa.String(length=160), nullable=True),
        sa.Column("new_member_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("new_member_email", sa.String(length=160), nullable=False),
        sa.Column("reassigned_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reassigned_by_email", sa.String(length=160), nullable=False),
        sa.Column("reason", sa.Text(), server_default=sa.text("''"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_cab_hist_org", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["cab_seat_id"], ["cab_voting_seats.id"], name="fk_cab_hist_seat", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["previous_member_user_id"], ["users.id"], name="fk_cab_hist_prev", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["new_member_user_id"], ["users.id"], name="fk_cab_hist_new", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["reassigned_by_user_id"], ["users.id"], name="fk_cab_hist_actor", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_cab_seat_assignment_history"),
    )
    op.create_index("ix_cab_seat_history_seat", "cab_seat_assignment_history", ["cab_seat_id", "created_at"])

    # ------------------------------------------------------------------
    # 7. Centralized Append-Only Audit Logs
    # ------------------------------------------------------------------
    op.create_table(
        "audit_logs",
        _uuid_pk(),
        *_ts_columns(include_updated=False, include_deleted=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_email", sa.String(length=160), server_default=sa.text("'anonymous'"), nullable=False),
        sa.Column("portal_type", sa.String(length=24), nullable=True),
        sa.Column("module", sa.String(length=64), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("target_type", sa.String(length=64), nullable=True),
        sa.Column("target_id", sa.String(length=128), nullable=True),
        sa.Column("outcome", sa.String(length=24), server_default=sa.text("'success'"), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("request_id", sa.String(length=64), nullable=True),
        sa.Column("detail", sa.Text(), server_default=sa.text("''"), nullable=False),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_audit_logs_org", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], name="fk_audit_logs_actor", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_audit_logs"),
    )
    op.create_index("ix_audit_logs_org_created", "audit_logs", ["organization_id", "created_at"])
    op.create_index("ix_audit_logs_action_created", "audit_logs", ["action", "created_at"])
    op.create_index("ix_audit_logs_module", "audit_logs", ["module"])
    op.create_index("ix_audit_logs_request_id", "audit_logs", ["request_id"])

    # Enforce immutability at the PostgreSQL trigger layer (even for privileged sessions)
    op.execute(
        """
        CREATE TRIGGER trg_audit_logs_immutable
        BEFORE UPDATE OR DELETE ON audit_logs
        FOR EACH ROW
        EXECUTE FUNCTION app.prevent_audit_log_mutation();
        """
    )

    # ------------------------------------------------------------------
    # 8. Attach updated_at triggers
    # ------------------------------------------------------------------
    for table_name in UPDATED_AT_TABLES:
        op.execute(
            f"""
            CREATE TRIGGER trg_{table_name}_updated_at
            BEFORE UPDATE ON {table_name}
            FOR EACH ROW
            EXECUTE FUNCTION app.set_updated_at();
            """
        )

    # ------------------------------------------------------------------
    # 9. Enable & Force PostgreSQL Row-Level Security (Fail-Closed)
    # ------------------------------------------------------------------
    for table_name in STRICT_TENANT_RLS_TABLES:
        op.execute(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table_name} FORCE ROW LEVEL SECURITY;")
        op.execute(
            f"""
            CREATE POLICY {table_name}_tenant_isolation
            ON {table_name}
            USING (app.is_rls_bypassed() OR organization_id = app.current_organization_id())
            WITH CHECK (app.is_rls_bypassed() OR organization_id = app.current_organization_id());
            """
        )

    for table_name in HYBRID_TENANT_RLS_TABLES:
        op.execute(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table_name} FORCE ROW LEVEL SECURITY;")
        op.execute(
            f"""
            CREATE POLICY {table_name}_tenant_isolation
            ON {table_name}
            USING (
                app.is_rls_bypassed()
                OR organization_id IS NULL
                OR organization_id = app.current_organization_id()
            )
            WITH CHECK (
                app.is_rls_bypassed()
                OR organization_id IS NULL
                OR organization_id = app.current_organization_id()
            );
            """
        )

    # ------------------------------------------------------------------
    # 10. Least-privilege runtime role grants (scribble_app)
    # ------------------------------------------------------------------
    op_grants = "\n".join(
        f"GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {tbl} TO scribble_app;"
        for tbl in OPERATIONAL_DML_TABLES
    )
    append_grants = "\n".join(
        f"GRANT SELECT, INSERT ON TABLE {tbl} TO scribble_app;\n"
        f"REVOKE UPDATE, DELETE, TRUNCATE ON TABLE {tbl} FROM scribble_app;"
        for tbl in APPEND_ONLY_TABLES
    )
    op.execute(
        f"""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scribble_app') THEN
                GRANT EXECUTE ON FUNCTION app.is_rls_bypassed() TO scribble_app;
                {op_grants}
                {append_grants}
            END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    for table_name in (*STRICT_TENANT_RLS_TABLES, *HYBRID_TENANT_RLS_TABLES):
        op.execute(f"DROP POLICY IF EXISTS {table_name}_tenant_isolation ON {table_name};")
        op.execute(f"ALTER TABLE {table_name} DISABLE ROW LEVEL SECURITY;")

    op.execute("DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;")

    for table_name in UPDATED_AT_TABLES:
        op.execute(f"DROP TRIGGER IF EXISTS trg_{table_name}_updated_at ON {table_name};")

    for table_name in (
        "audit_logs",
        "cab_seat_assignment_history",
        "cab_voting_seats",
        "approval_assignment_history",
        "approval_workflow_items",
        "password_reset_tokens",
        "mfa_methods",
        "sessions",
        "device_trust_events",
        "managed_devices",
        "device_enrollment_codes",
        "membership_roles",
        "organization_memberships",
        "role_permissions",
        "roles",
        "permissions",
        "users",
        "departments",
        "organizations",
    ):
        op.drop_table(table_name)

    op.execute("DROP FUNCTION IF EXISTS app.prevent_audit_log_mutation();")
    op.execute("DROP FUNCTION IF EXISTS app.is_rls_bypassed();")
