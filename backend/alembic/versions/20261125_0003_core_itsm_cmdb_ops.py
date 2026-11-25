"""Phase 3 Core ITSM, CMDB, SLA, Knowledge, Workflows, Notifications, and Operational tables with PostgreSQL RLS.

Revision ID: 20261125_0003
Revises: 20261124_0002
Create Date: 2026-11-25 04:20:00.000000+00:00
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261125_0003"
down_revision: str | None = "20261124_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ALL_TENANT_RLS_TABLES: tuple[str, ...] = (
    "sla_policies",
    "assets",
    "cmdb_relations",
    "inventory_items",
    "software_licenses",
    "vendor_contracts",
    "domain_records",
    "change_requests",
    "change_activities",
    "incidents",
    "incident_activities",
    "incident_attachments",
    "incident_relations",
    "service_catalog_items",
    "service_requests",
    "service_request_activities",
    "problems",
    "problem_incident_links",
    "knowledge_articles",
    "workflow_definitions",
    "ticket_workflow_rules",
    "notifications",
    "projects",
    "tasks",
    "service_status_components",
    "invoices",
)

UPDATED_AT_TABLES: tuple[str, ...] = (
    "sla_policies",
    "assets",
    "inventory_items",
    "software_licenses",
    "vendor_contracts",
    "domain_records",
    "change_requests",
    "incidents",
    "service_catalog_items",
    "service_requests",
    "problems",
    "knowledge_articles",
    "workflow_definitions",
    "ticket_workflow_rules",
    "projects",
    "tasks",
    "service_status_components",
    "invoices",
)

IMMUTABLE_HISTORY_TABLES: tuple[str, ...] = (
    "incident_activities",
    "service_request_activities",
    "change_activities",
)


def upgrade() -> None:
    # 1. SLA Policies
    op.create_table(
        "sla_policies",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("priority", sa.String(4), nullable=False),
        sa.Column("response_target_mins", sa.Integer(), nullable=False),
        sa.Column("resolution_target_mins", sa.Integer(), nullable=False),
        sa.Column("escalation_minutes", sa.Integer(), server_default="60", nullable=False),
        sa.Column("business_hours_only", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "priority", name="uq_sla_policies_org_priority"),
        sa.CheckConstraint("priority IN ('P1', 'P2', 'P3', 'P4')", name="ck_sla_policies_priority_valid"),
        sa.CheckConstraint("response_target_mins > 0 AND resolution_target_mins > 0", name="ck_sla_policies_targets_positive"),
    )
    op.create_index("ix_sla_policies_organization_id", "sla_policies", ["organization_id"])

    # 2. Assets & CMDB
    op.create_table(
        "assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("asset_tag", sa.String(64), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("asset_type", sa.String(32), server_default="laptop", nullable=False),
        sa.Column("serial_number", sa.String(128), nullable=False),
        sa.Column("mac_address", sa.String(64), nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("sync_source", sa.String(32), server_default="manual", nullable=False),
        sa.Column("model", sa.String(160), server_default="", nullable=False),
        sa.Column("manufacturer", sa.String(160), server_default="", nullable=False),
        sa.Column("status", sa.String(24), server_default="in_stock", nullable=False),
        sa.Column("assigned_to_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("assigned_to_name", sa.String(160), nullable=True),
        sa.Column("department", sa.String(120), nullable=True),
        sa.Column("location", sa.String(160), server_default="HQ", nullable=False),
        sa.Column("purchase_date", sa.Date(), nullable=True),
        sa.Column("warranty_expiry", sa.Date(), nullable=True),
        sa.Column("purchase_cost", sa.Numeric(12, 2), server_default="0.00", nullable=False),
        sa.Column("current_book_value", sa.Numeric(12, 2), server_default="0.00", nullable=False),
        sa.Column("qr_code_data", sa.String(512), server_default="", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assigned_to_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "asset_tag", name="uq_assets_org_tag"),
        sa.CheckConstraint("status IN ('in_use', 'in_stock', 'maintenance', 'retired')", name="ck_assets_status_valid"),
        sa.CheckConstraint("purchase_cost >= 0 AND current_book_value >= 0", name="ck_assets_cost_non_negative"),
    )
    op.create_index("ix_assets_org_status", "assets", ["organization_id", "status"])
    op.create_index("ix_assets_org_type", "assets", ["organization_id", "asset_type"])
    op.create_index("ix_assets_org_assignee", "assets", ["organization_id", "assigned_to_user_id"])

    op.create_table(
        "cmdb_relations",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_asset_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_asset_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("relation_type", sa.String(32), nullable=False),
        sa.Column("criticality", sa.String(16), server_default="standard", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_asset_id"], ["assets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_asset_id"], ["assets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "source_asset_id", "target_asset_id", "relation_type", name="uq_cmdb_relations_unique"),
        sa.CheckConstraint("source_asset_id <> target_asset_id", name="ck_cmdb_relations_no_self_loop"),
        sa.CheckConstraint("relation_type IN ('depends_on', 'hosts', 'connects_to', 'backed_up_by', 'secured_by')", name="ck_cmdb_relations_type_valid"),
        sa.CheckConstraint("criticality IN ('critical', 'high', 'standard')", name="ck_cmdb_relations_criticality_valid"),
    )
    op.create_index("ix_cmdb_relations_org", "cmdb_relations", ["organization_id"])

    op.create_table(
        "inventory_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sku", sa.String(64), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("category", sa.String(32), server_default="peripherals", nullable=False),
        sa.Column("quantity", sa.Integer(), server_default="0", nullable=False),
        sa.Column("min_threshold", sa.Integer(), server_default="5", nullable=False),
        sa.Column("unit_cost", sa.Numeric(12, 2), server_default="0.00", nullable=False),
        sa.Column("location", sa.String(160), server_default="Main Stockroom", nullable=False),
        sa.Column("last_restocked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "sku", name="uq_inventory_org_sku"),
        sa.CheckConstraint("quantity >= 0 AND min_threshold >= 0 AND unit_cost >= 0", name="ck_inventory_non_negative"),
    )
    op.create_index("ix_inventory_items_org", "inventory_items", ["organization_id"])

    op.create_table(
        "software_licenses",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("vendor", sa.String(160), nullable=False),
        sa.Column("version", sa.String(64), server_default="1.0", nullable=False),
        sa.Column("license_type", sa.String(24), server_default="per_seat", nullable=False),
        sa.Column("total_seats", sa.Integer(), server_default="0", nullable=False),
        sa.Column("used_seats", sa.Integer(), server_default="0", nullable=False),
        sa.Column("annual_cost", sa.Numeric(12, 2), server_default="0.00", nullable=False),
        sa.Column("renewal_date", sa.Date(), nullable=True),
        sa.Column("source", sa.String(32), server_default="Manual", nullable=False),
        sa.Column("compliance_status", sa.String(24), server_default="compliant", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("total_seats >= 0 AND used_seats >= 0 AND annual_cost >= 0", name="ck_software_non_negative"),
        sa.CheckConstraint("license_type IN ('per_seat', 'site', 'floating', 'open_source')", name="ck_software_license_type_valid"),
        sa.CheckConstraint("compliance_status IN ('compliant', 'over_allocated', 'expiring_soon')", name="ck_software_compliance_valid"),
    )
    op.create_index("ix_software_licenses_org", "software_licenses", ["organization_id"])

    op.create_table(
        "vendor_contracts",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("vendor", sa.String(160), nullable=False),
        sa.Column("contract_type", sa.String(32), server_default="support", nullable=False),
        sa.Column("annual_value", sa.Numeric(12, 2), server_default="0.00", nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("renewal_date", sa.Date(), nullable=True),
        sa.Column("notice_days", sa.Integer(), server_default="30", nullable=False),
        sa.Column("auto_renew", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("linked_asset_ids", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("status", sa.String(24), server_default="active", nullable=False),
        sa.Column("rfp_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("annual_value >= 0", name="ck_contracts_value_non_negative"),
        sa.CheckConstraint("status IN ('active', 'expiring_soon', 'rfp_open', 'expired')", name="ck_contracts_status_valid"),
    )
    op.create_index("ix_vendor_contracts_org", "vendor_contracts", ["organization_id"])

    op.create_table(
        "domain_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("domain", sa.String(255), nullable=False),
        sa.Column("registrar", sa.String(160), server_default="", nullable=False),
        sa.Column("domain_expiry", sa.Date(), nullable=True),
        sa.Column("ssl_expiry", sa.Date(), nullable=True),
        sa.Column("security_grade", sa.String(4), server_default="A", nullable=False),
        sa.Column("dnssec_enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("spf_valid", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("dkim_valid", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("dmarc_policy", sa.String(16), server_default="reject", nullable=False),
        sa.Column("registrar_locked", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("lookalike_alerts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "domain", name="uq_domains_org_domain"),
    )
    op.create_index("ix_domain_records_org", "domain_records", ["organization_id"])

    # 3. Change Management
    op.create_table(
        "change_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("number", sa.String(32), nullable=False),
        sa.Column("title", sa.String(240), nullable=False),
        sa.Column("change_type", sa.String(16), server_default="normal", nullable=False),
        sa.Column("status", sa.String(24), server_default="draft", nullable=False),
        sa.Column("risk_score", sa.String(16), server_default="medium", nullable=False),
        sa.Column("risk_assessment", postgresql.JSONB(), server_default="{}", nullable=False),
        sa.Column("reason", sa.Text(), server_default="", nullable=False),
        sa.Column("implementation_plan", sa.Text(), server_default="", nullable=False),
        sa.Column("rollback_plan", sa.Text(), server_default="", nullable=False),
        sa.Column("test_plan", sa.Text(), server_default="", nullable=False),
        sa.Column("scheduled_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scheduled_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("requester_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requester_name", sa.String(160), nullable=False),
        sa.Column("requester_email", sa.String(160), nullable=False),
        sa.Column("assigned_engineer_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("assigned_engineer_name", sa.String(160), server_default="Unassigned", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requester_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["assigned_engineer_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "number", name="uq_changes_org_number"),
        sa.CheckConstraint("change_type IN ('standard', 'normal', 'emergency')", name="ck_changes_type_valid"),
        sa.CheckConstraint("status IN ('draft', 'cab_review', 'scheduled', 'implementation', 'verification', 'completed', 'cancelled')", name="ck_changes_status_valid"),
        sa.CheckConstraint("risk_score IN ('low', 'medium', 'high', 'critical')", name="ck_changes_risk_valid"),
    )
    op.create_index("ix_changes_org_status", "change_requests", ["organization_id", "status"])
    op.create_index("ix_changes_org_schedule", "change_requests", ["organization_id", "scheduled_start"])

    op.create_table(
        "change_activities",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("change_request_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_email", sa.String(160), nullable=False),
        sa.Column("activity_type", sa.String(32), server_default="audit", nullable=False),
        sa.Column("action", sa.String(120), nullable=False),
        sa.Column("note", sa.Text(), server_default="", nullable=False),
        sa.Column("field_changes", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["change_request_id"], ["change_requests.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_change_activities_change", "change_activities", ["change_request_id", "created_at"])

    # 4. Incident Management
    op.create_table(
        "incidents",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("number", sa.String(32), nullable=False),
        sa.Column("title", sa.String(240), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("status", sa.String(24), server_default="new", nullable=False),
        sa.Column("priority", sa.String(4), server_default="P3", nullable=False),
        sa.Column("urgency", sa.String(16), server_default="medium", nullable=False),
        sa.Column("impact", sa.String(16), server_default="medium", nullable=False),
        sa.Column("category", sa.String(32), server_default="software", nullable=False),
        sa.Column("requester_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("requester_name", sa.String(160), nullable=False),
        sa.Column("requester_email", sa.String(160), nullable=False),
        sa.Column("assignee_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("assignee_name", sa.String(160), server_default="Unassigned", nullable=False),
        sa.Column("assignment_group", sa.String(120), nullable=True),
        sa.Column("affected_ci_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("affected_ci_label", sa.String(160), nullable=True),
        sa.Column("sla_policy_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("sla_deadline", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sla_breached", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("sla_paused_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("time_logged_mins", sa.Integer(), server_default="0", nullable=False),
        sa.Column("csat_score", sa.Integer(), nullable=True),
        sa.Column("source_channel", sa.String(24), server_default="portal", nullable=False),
        sa.Column("resolution_notes", sa.Text(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requester_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["assignee_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["affected_ci_id"], ["assets.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["sla_policy_id"], ["sla_policies.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "number", name="uq_incidents_org_number"),
        sa.CheckConstraint("priority IN ('P1', 'P2', 'P3', 'P4')", name="ck_incidents_priority_valid"),
        sa.CheckConstraint("status IN ('new', 'assigned', 'in_progress', 'pending', 'resolved', 'closed')", name="ck_incidents_status_valid"),
        sa.CheckConstraint("urgency IN ('high', 'medium', 'low') AND impact IN ('high', 'medium', 'low')", name="ck_incidents_urgency_impact_valid"),
        sa.CheckConstraint("csat_score IS NULL OR (csat_score >= 1 AND csat_score <= 5)", name="ck_incidents_csat_range"),
        sa.CheckConstraint("time_logged_mins >= 0", name="ck_incidents_time_non_negative"),
    )
    op.create_index("ix_incidents_org_status", "incidents", ["organization_id", "status"])
    op.create_index("ix_incidents_org_priority", "incidents", ["organization_id", "priority"])
    op.create_index("ix_incidents_org_requester", "incidents", ["organization_id", "requester_user_id"])
    op.create_index("ix_incidents_org_assignee", "incidents", ["organization_id", "assignee_user_id"])
    op.create_index("ix_incidents_org_sla_deadline", "incidents", ["organization_id", "sla_deadline"])

    op.create_table(
        "incident_activities",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("incident_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("author_name", sa.String(160), nullable=False),
        sa.Column("activity_type", sa.String(32), server_default="work_note", nullable=False),
        sa.Column("action", sa.String(120), nullable=False),
        sa.Column("note", sa.Text(), server_default="", nullable=False),
        sa.Column("field_changes", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["incident_id"], ["incidents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_incident_activities_incident", "incident_activities", ["incident_id", "created_at"])

    op.create_table(
        "incident_attachments",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("incident_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(128), nullable=False),
        sa.Column("size_bytes", sa.Integer(), server_default="0", nullable=False),
        sa.Column("storage_key", sa.String(512), nullable=False),
        sa.Column("checksum_sha256", sa.String(64), nullable=True),
        sa.Column("uploaded_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("uploaded_by_email", sa.String(160), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["incident_id"], ["incidents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("size_bytes >= 0", name="ck_incident_attachments_size_non_negative"),
    )
    op.create_index("ix_incident_attachments_incident", "incident_attachments", ["incident_id", "created_at"])

    op.create_table(
        "incident_relations",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("incident_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_type", sa.String(32), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_ref", sa.String(64), nullable=False),
        sa.Column("relation_type", sa.String(32), server_default="related_to", nullable=False),
        sa.Column("created_by_email", sa.String(160), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["incident_id"], ["incidents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "incident_id", "target_type", "target_id", "relation_type", name="uq_incident_relations_unique"),
        sa.CheckConstraint("target_type IN ('incident', 'problem', 'change', 'asset', 'request')", name="ck_incident_relations_target_type_valid"),
    )
    op.create_index("ix_incident_relations_incident", "incident_relations", ["incident_id"])

    # 5. Service Catalog & Service Requests
    op.create_table(
        "service_catalog_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("slug", sa.String(80), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("category", sa.String(40), server_default="hardware", nullable=False),
        sa.Column("price", sa.Numeric(12, 2), server_default="0.00", nullable=False),
        sa.Column("estimated_hours", sa.Integer(), server_default="24", nullable=False),
        sa.Column("requires_approval", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("default_approval_stages", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("tags", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "slug", name="uq_catalog_org_slug"),
        sa.CheckConstraint("price >= 0 AND estimated_hours >= 0", name="ck_catalog_non_negative"),
    )
    op.create_index("ix_service_catalog_items_org", "service_catalog_items", ["organization_id"])

    op.create_table(
        "service_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("number", sa.String(32), nullable=False),
        sa.Column("catalog_item_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("catalog_item_name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("requester_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requester_name", sa.String(160), nullable=False),
        sa.Column("requester_email", sa.String(160), nullable=False),
        sa.Column("assignee_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("assignee_name", sa.String(160), nullable=True),
        sa.Column("department", sa.String(120), server_default="General", nullable=False),
        sa.Column("cost", sa.Numeric(12, 2), server_default="0.00", nullable=False),
        sa.Column("status", sa.String(32), server_default="submitted", nullable=False),
        sa.Column("current_stage", sa.Integer(), server_default="1", nullable=False),
        sa.Column("delivery_estimate_days", sa.Integer(), server_default="3", nullable=False),
        sa.Column("delivery_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fulfillment_notes", sa.Text(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("custom_form_values", postgresql.JSONB(), server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["catalog_item_id"], ["service_catalog_items.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["requester_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["assignee_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "number", name="uq_requests_org_number"),
        sa.CheckConstraint("status IN ('submitted', 'manager_approved', 'security_review', 'fulfillment', 'completed', 'rejected')", name="ck_requests_status_valid"),
        sa.CheckConstraint("cost >= 0", name="ck_requests_cost_non_negative"),
        sa.CheckConstraint("current_stage >= 1 AND current_stage <= 6", name="ck_requests_stage_range"),
    )
    op.create_index("ix_requests_org_status", "service_requests", ["organization_id", "status"])
    op.create_index("ix_requests_org_requester", "service_requests", ["organization_id", "requester_user_id"])

    op.create_table(
        "service_request_activities",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("service_request_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_email", sa.String(160), nullable=False),
        sa.Column("action", sa.String(120), nullable=False),
        sa.Column("detail", sa.Text(), server_default="", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["service_request_id"], ["service_requests.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_request_activities_request", "service_request_activities", ["service_request_id", "created_at"])

    # 6. Problem Management
    op.create_table(
        "problems",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("number", sa.String(32), nullable=False),
        sa.Column("title", sa.String(240), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("status", sa.String(32), server_default="investigating", nullable=False),
        sa.Column("severity", sa.String(16), server_default="high", nullable=False),
        sa.Column("root_cause_analysis", sa.Text(), server_default="", nullable=False),
        sa.Column("workaround", sa.Text(), server_default="", nullable=False),
        sa.Column("permanent_solution", sa.Text(), server_default="", nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("owner_name", sa.String(160), nullable=False),
        sa.Column("is_known_error", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("known_error_published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("linked_change_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["linked_change_id"], ["change_requests.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "number", name="uq_problems_org_number"),
        sa.CheckConstraint("status IN ('investigating', 'root_cause_identified', 'workaround_published', 'change_requested', 'closed')", name="ck_problems_status_valid"),
        sa.CheckConstraint("severity IN ('critical', 'high', 'moderate', 'minor')", name="ck_problems_severity_valid"),
    )
    op.create_index("ix_problems_org_status", "problems", ["organization_id", "status"])
    op.create_index("ix_problems_org_kedb", "problems", ["organization_id", "is_known_error"])

    op.create_table(
        "problem_incident_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("incident_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("linked_by_email", sa.String(160), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["problem_id"], ["problems.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["incident_id"], ["incidents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "problem_id", "incident_id", name="uq_problem_incident_unique"),
    )

    # 7. Knowledge, Workflows, Notifications, Operational Suites
    op.create_table(
        "knowledge_articles",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(240), nullable=False),
        sa.Column("category", sa.String(80), server_default="General", nullable=False),
        sa.Column("visibility", sa.String(16), server_default="internal", nullable=False),
        sa.Column("author_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("author_name", sa.String(160), nullable=False),
        sa.Column("views", sa.Integer(), server_default="0", nullable=False),
        sa.Column("helpful_votes", sa.Integer(), server_default="0", nullable=False),
        sa.Column("tags", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("content", sa.Text(), server_default="", nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("visibility IN ('public', 'internal')", name="ck_knowledge_visibility_valid"),
        sa.CheckConstraint("views >= 0 AND helpful_votes >= 0", name="ck_knowledge_counters_non_negative"),
    )
    op.create_index("ix_knowledge_org_visibility", "knowledge_articles", ["organization_id", "visibility"])

    op.create_table(
        "workflow_definitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("target_module_id", sa.String(64), server_default="all", nullable=False),
        sa.Column("trigger", sa.String(48), server_default="manual", nullable=False),
        sa.Column("trigger_config", postgresql.JSONB(), server_default="{}", nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("status", sa.String(16), server_default="draft", nullable=False),
        sa.Column("stages", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("execution_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_executed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_run_trace", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("status IN ('active', 'draft', 'paused')", name="ck_workflows_status_valid"),
        sa.CheckConstraint("execution_count >= 0", name="ck_workflows_exec_non_negative"),
    )
    op.create_index("ix_workflow_definitions_org", "workflow_definitions", ["organization_id"])

    op.create_table(
        "ticket_workflow_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("source_channel", sa.String(24), server_default="all", nullable=False),
        sa.Column("match_category", sa.String(32), server_default="all", nullable=False),
        sa.Column("match_priority", sa.String(8), server_default="all", nullable=False),
        sa.Column("assign_to_queue", sa.String(120), nullable=False),
        sa.Column("override_sla_hours", sa.Integer(), nullable=True),
        sa.Column("auto_escalate_after_mins", sa.Integer(), nullable=True),
        sa.Column("allowed_transitions", postgresql.JSONB(), server_default="{}", nullable=False),
        sa.Column("notify_roles", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("execution_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("execution_count >= 0", name="ck_ticket_rules_exec_non_negative"),
    )
    op.create_index("ix_ticket_workflow_rules_org", "ticket_workflow_rules", ["organization_id"])

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("recipient_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category", sa.String(40), server_default="itsm", nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("message", sa.Text(), server_default="", nullable=False),
        sa.Column("record_type", sa.String(40), nullable=True),
        sa.Column("record_id", sa.String(64), nullable=True),
        sa.Column("is_read", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recipient_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notifications_org_recipient", "notifications", ["organization_id", "recipient_user_id", "is_read"])

    op.create_table(
        "projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(32), nullable=False),
        sa.Column("title", sa.String(220), nullable=False),
        sa.Column("owner_name", sa.String(160), nullable=False),
        sa.Column("stage", sa.String(24), server_default="initiation", nullable=False),
        sa.Column("health", sa.String(16), server_default="on_track", nullable=False),
        sa.Column("progress_pct", sa.Integer(), server_default="0", nullable=False),
        sa.Column("budget_total", sa.Numeric(12, 2), server_default="0.00", nullable=False),
        sa.Column("budget_spent", sa.Numeric(12, 2), server_default="0.00", nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("target_end_date", sa.Date(), nullable=True),
        sa.Column("summary", sa.Text(), server_default="", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "code", name="uq_projects_org_code"),
        sa.CheckConstraint("stage IN ('initiation', 'planning', 'execution', 'uat', 'closed')", name="ck_projects_stage_valid"),
        sa.CheckConstraint("progress_pct >= 0 AND progress_pct <= 100", name="ck_projects_progress_range"),
    )
    op.create_index("ix_projects_org", "projects", ["organization_id"])

    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(220), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("column_name", sa.String(24), server_default="todo", nullable=False),
        sa.Column("priority", sa.String(16), server_default="medium", nullable=False),
        sa.Column("assignee_name", sa.String(160), server_default="Unassigned", nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("time_logged_mins", sa.Integer(), server_default="0", nullable=False),
        sa.Column("linked_record_id", sa.String(64), nullable=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("subtasks", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("column_name IN ('backlog', 'todo', 'in_progress', 'review', 'done')", name="ck_tasks_column_valid"),
        sa.CheckConstraint("time_logged_mins >= 0", name="ck_tasks_time_non_negative"),
    )
    op.create_index("ix_tasks_org", "tasks", ["organization_id"])

    op.create_table(
        "service_status_components",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("component_group", sa.String(64), server_default="Core Platform", nullable=False),
        sa.Column("status", sa.String(24), server_default="operational", nullable=False),
        sa.Column("uptime_pct", sa.Numeric(5, 2), server_default="99.95", nullable=False),
        sa.Column("latency_ms", sa.Integer(), server_default="25", nullable=False),
        sa.Column("linked_incident_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["linked_incident_id"], ["incidents.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("status IN ('operational', 'degraded', 'partial_outage', 'major_outage')", name="ck_status_components_status_valid"),
    )
    op.create_index("ix_service_status_components_org", "service_status_components", ["organization_id"])

    op.create_table(
        "invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("number", sa.String(32), nullable=False),
        sa.Column("customer_name", sa.String(160), nullable=False),
        sa.Column("customer_email", sa.String(160), nullable=False),
        sa.Column("customer_organization", sa.String(160), server_default="", nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(8), server_default="USD", nullable=False),
        sa.Column("status", sa.String(16), server_default="pending", nullable=False),
        sa.Column("issue_date", sa.Date(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("payment_method", sa.String(32), nullable=True),
        sa.Column("line_items", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "number", name="uq_invoices_org_number"),
        sa.CheckConstraint("amount >= 0", name="ck_invoices_amount_non_negative"),
        sa.CheckConstraint("status IN ('paid', 'pending', 'overdue')", name="ck_invoices_status_valid"),
    )
    op.create_index("ix_invoices_org", "invoices", ["organization_id"])

    # Attach updated_at triggers
    for tbl in UPDATED_AT_TABLES:
        op.execute(
            f"""
            CREATE TRIGGER trg_{tbl}_set_updated_at
            BEFORE UPDATE ON {tbl}
            FOR EACH ROW
            EXECUTE FUNCTION app.set_updated_at();
            """
        )

    # Enable & Force Row-Level Security on ALL 26 Phase 3 tenant-scoped tables
    for tbl in ALL_TENANT_RLS_TABLES:
        op.execute(f"ALTER TABLE {tbl} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {tbl} FORCE ROW LEVEL SECURITY;")
        op.execute(
            f"""
            CREATE POLICY {tbl}_tenant_isolation ON {tbl}
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

    # Least-privilege grants to runtime scribble_app role
    for tbl in ALL_TENANT_RLS_TABLES:
        op.execute(
            f"""
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scribble_app') THEN
                    GRANT SELECT, INSERT, UPDATE, DELETE ON {tbl} TO scribble_app;
                END IF;
            END
            $$;
            """
        )

    # Immutable activity tables: revoke UPDATE/DELETE/TRUNCATE from runtime role
    for tbl in IMMUTABLE_HISTORY_TABLES:
        op.execute(
            f"""
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scribble_app') THEN
                    REVOKE UPDATE, DELETE, TRUNCATE ON {tbl} FROM scribble_app;
                END IF;
            END
            $$;
            """
        )


def downgrade() -> None:
    for tbl in reversed(ALL_TENANT_RLS_TABLES):
        op.execute(f"DROP POLICY IF EXISTS {tbl}_tenant_isolation ON {tbl};")
        op.execute(f"ALTER TABLE {tbl} NO FORCE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {tbl} DISABLE ROW LEVEL SECURITY;")

    for tbl in reversed(UPDATED_AT_TABLES):
        op.execute(f"DROP TRIGGER IF EXISTS trg_{tbl}_set_updated_at ON {tbl};")

    for tbl in (
        "invoices",
        "service_status_components",
        "tasks",
        "projects",
        "notifications",
        "ticket_workflow_rules",
        "workflow_definitions",
        "knowledge_articles",
        "problem_incident_links",
        "problems",
        "service_request_activities",
        "service_requests",
        "service_catalog_items",
        "incident_relations",
        "incident_attachments",
        "incident_activities",
        "incidents",
        "change_activities",
        "change_requests",
        "domain_records",
        "vendor_contracts",
        "software_licenses",
        "inventory_items",
        "cmdb_relations",
        "assets",
        "sla_policies",
    ):
        op.drop_table(tbl)
