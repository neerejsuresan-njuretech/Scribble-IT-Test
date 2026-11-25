from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import (
    Base,
    SoftDeleteMixin,
    TenantOwnedMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)


class Asset(
    UUIDPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin, SoftDeleteMixin, Base
):
    """Tenant-scoped CMDB Configuration Item / Hardware Asset."""

    __tablename__ = "assets"
    __table_args__ = (
        UniqueConstraint("organization_id", "asset_tag", name="uq_assets_org_tag"),
        CheckConstraint(
            "status IN ('in_use', 'in_stock', 'maintenance', 'retired')",
            name="assets_status_valid",
        ),
        CheckConstraint("purchase_cost >= 0 AND current_book_value >= 0", name="assets_cost_non_negative"),
        Index("ix_assets_org_status", "organization_id", "status"),
        Index("ix_assets_org_type", "organization_id", "asset_type"),
        Index("ix_assets_org_assignee", "organization_id", "assigned_to_user_id"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    asset_tag: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(32), nullable=False, default="laptop")
    serial_number: Mapped[str] = mapped_column(String(128), nullable=False)
    mac_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    sync_source: Mapped[str] = mapped_column(
        String(32), nullable=False, default="manual", server_default="manual"
    )
    model: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    manufacturer: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    status: Mapped[str] = mapped_column(
        String(24), nullable=False, default="in_stock", server_default="in_stock"
    )
    assigned_to_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    assigned_to_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    department: Mapped[str | None] = mapped_column(String(120), nullable=True)
    location: Mapped[str] = mapped_column(String(160), nullable=False, default="HQ")
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    warranty_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)
    purchase_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00"), server_default="0.00"
    )
    current_book_value: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00"), server_default="0.00"
    )
    qr_code_data: Mapped[str] = mapped_column(String(512), nullable=False, default="")


class CmdbRelation(UUIDPrimaryKeyMixin, TenantOwnedMixin, Base):
    """Directed CMDB dependency / topology edge between two tenant assets."""

    __tablename__ = "cmdb_relations"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "source_asset_id",
            "target_asset_id",
            "relation_type",
            name="uq_cmdb_relations_unique",
        ),
        CheckConstraint(
            "source_asset_id <> target_asset_id",
            name="cmdb_relations_no_self_loop",
        ),
        CheckConstraint(
            "relation_type IN ('depends_on', 'hosts', 'connects_to', 'backed_up_by', 'secured_by')",
            name="cmdb_relations_type_valid",
        ),
        CheckConstraint(
            "criticality IN ('critical', 'high', 'standard')",
            name="cmdb_relations_criticality_valid",
        ),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("assets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("assets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    relation_type: Mapped[str] = mapped_column(String(32), nullable=False)
    criticality: Mapped[str] = mapped_column(
        String(16), nullable=False, default="standard", server_default="standard"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )


class InventoryItem(
    UUIDPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin, SoftDeleteMixin, Base
):
    """Tenant-scoped IT consumables & stockroom hardware inventory."""

    __tablename__ = "inventory_items"
    __table_args__ = (
        UniqueConstraint("organization_id", "sku", name="uq_inventory_org_sku"),
        CheckConstraint("quantity >= 0", name="inventory_quantity_non_negative"),
        CheckConstraint("min_threshold >= 0", name="inventory_threshold_non_negative"),
        CheckConstraint("unit_cost >= 0", name="inventory_unit_cost_non_negative"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sku: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(
        String(32), nullable=False, default="peripherals", server_default="peripherals"
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    min_threshold: Mapped[int] = mapped_column(
        Integer, nullable=False, default=5, server_default="5"
    )
    unit_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00"), server_default="0.00"
    )
    location: Mapped[str] = mapped_column(String(160), nullable=False, default="Main Stockroom")
    last_restocked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class SoftwareLicense(
    UUIDPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin, SoftDeleteMixin, Base
):
    """Tenant-scoped Software Asset Management (SAM) & license compliance record."""

    __tablename__ = "software_licenses"
    __table_args__ = (
        CheckConstraint("total_seats >= 0 AND used_seats >= 0", name="software_seats_non_negative"),
        CheckConstraint("annual_cost >= 0", name="software_cost_non_negative"),
        CheckConstraint(
            "license_type IN ('per_seat', 'site', 'floating', 'open_source')",
            name="software_license_type_valid",
        ),
        CheckConstraint(
            "compliance_status IN ('compliant', 'over_allocated', 'expiring_soon')",
            name="software_compliance_valid",
        ),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    vendor: Mapped[str] = mapped_column(String(160), nullable=False)
    version: Mapped[str] = mapped_column(String(64), nullable=False, default="1.0")
    license_type: Mapped[str] = mapped_column(
        String(24), nullable=False, default="per_seat", server_default="per_seat"
    )
    total_seats: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    used_seats: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    annual_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00"), server_default="0.00"
    )
    renewal_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    source: Mapped[str] = mapped_column(
        String(32), nullable=False, default="Manual", server_default="Manual"
    )
    compliance_status: Mapped[str] = mapped_column(
        String(24), nullable=False, default="compliant", server_default="compliant"
    )


class VendorContract(
    UUIDPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin, SoftDeleteMixin, Base
):
    """Tenant-scoped Vendor Contract & RFP register."""

    __tablename__ = "vendor_contracts"
    __table_args__ = (
        CheckConstraint("annual_value >= 0", name="contracts_value_non_negative"),
        CheckConstraint(
            "status IN ('active', 'expiring_soon', 'rfp_open', 'expired')",
            name="contracts_status_valid",
        ),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    vendor: Mapped[str] = mapped_column(String(160), nullable=False)
    contract_type: Mapped[str] = mapped_column(String(32), nullable=False, default="support")
    annual_value: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00"), server_default="0.00"
    )
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    renewal_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notice_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    auto_renew: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    linked_asset_ids: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    status: Mapped[str] = mapped_column(
        String(24), nullable=False, default="active", server_default="active"
    )
    rfp_notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class DomainRecord(
    UUIDPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin, SoftDeleteMixin, Base
):
    """Tenant-scoped Domain & SSL Certificate Security Register."""

    __tablename__ = "domain_records"
    __table_args__ = (
        UniqueConstraint("organization_id", "domain", name="uq_domains_org_domain"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    domain: Mapped[str] = mapped_column(String(255), nullable=False)
    registrar: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    domain_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)
    ssl_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)
    security_grade: Mapped[str] = mapped_column(
        String(4), nullable=False, default="A", server_default="A"
    )
    dnssec_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    spf_valid: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    dkim_valid: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    dmarc_policy: Mapped[str] = mapped_column(
        String(16), nullable=False, default="reject", server_default="reject"
    )
    registrar_locked: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    lookalike_alerts: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
