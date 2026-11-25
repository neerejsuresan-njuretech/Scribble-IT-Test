from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

AssetStatus = Literal["in_use", "in_stock", "maintenance", "retired"]
CmdbRelationType = Literal["depends_on", "hosts", "connects_to", "backed_up_by", "secured_by"]
CmdbCriticality = Literal["critical", "high", "standard"]
LicenseType = Literal["per_seat", "site", "floating", "open_source"]
ContractStatus = Literal["active", "expiring_soon", "rfp_open", "expired"]


class AssetCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asset_tag: str = Field(min_length=2, max_length=64)
    name: str = Field(min_length=2, max_length=200)
    asset_type: str = Field(default="laptop", max_length=32)
    serial_number: str = Field(min_length=2, max_length=128)
    mac_address: str | None = Field(default=None, max_length=64)
    ip_address: str | None = Field(default=None, max_length=64)
    sync_source: str = Field(default="manual", max_length=32)
    model: str = Field(default="", max_length=160)
    manufacturer: str = Field(default="", max_length=160)
    status: AssetStatus = "in_stock"
    assigned_to_user_id: uuid.UUID | None = None
    assigned_to_name: str | None = Field(default=None, max_length=160)
    department: str | None = Field(default=None, max_length=120)
    location: str = Field(default="HQ", max_length=160)
    purchase_date: date | None = None
    warranty_expiry: date | None = None
    purchase_cost: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    current_book_value: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))


class AssetUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=2, max_length=200)
    status: AssetStatus | None = None
    assigned_to_user_id: uuid.UUID | None = None
    assigned_to_name: str | None = Field(default=None, max_length=160)
    department: str | None = Field(default=None, max_length=120)
    location: str | None = Field(default=None, max_length=160)
    ip_address: str | None = Field(default=None, max_length=64)
    warranty_expiry: date | None = None
    current_book_value: Decimal | None = Field(default=None, ge=Decimal("0.00"))


class AssetAssignRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assigned_to_user_id: uuid.UUID | None = None
    assigned_to_name: str | None = Field(default=None, max_length=160)
    department: str | None = Field(default=None, max_length=120)
    status: AssetStatus = "in_use"


class AssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    asset_tag: str
    name: str
    asset_type: str
    serial_number: str
    mac_address: str | None
    ip_address: str | None
    sync_source: str
    model: str
    manufacturer: str
    status: str
    assigned_to_user_id: uuid.UUID | None
    assigned_to_name: str | None
    department: str | None
    location: str
    purchase_date: date | None
    warranty_expiry: date | None
    purchase_cost: Decimal
    current_book_value: Decimal
    qr_code_data: str
    created_at: datetime
    updated_at: datetime


class CmdbRelationCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_asset_id: uuid.UUID
    target_asset_id: uuid.UUID
    relation_type: CmdbRelationType
    criticality: CmdbCriticality = "standard"


class CmdbRelationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    source_asset_id: uuid.UUID
    target_asset_id: uuid.UUID
    relation_type: str
    criticality: str
    created_at: datetime


class InventoryItemCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sku: str = Field(min_length=2, max_length=64)
    name: str = Field(min_length=2, max_length=200)
    category: str = Field(default="peripherals", max_length=32)
    quantity: int = Field(default=0, ge=0)
    min_threshold: int = Field(default=5, ge=0)
    unit_cost: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    location: str = Field(default="Main Stockroom", max_length=160)


class InventoryAdjustRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    delta: int = Field(ge=-100000, le=100000)
    reason: str = Field(default="Stock adjustment", max_length=500)


class InventoryItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    sku: str
    name: str
    category: str
    quantity: int
    min_threshold: int
    unit_cost: Decimal
    location: str
    last_restocked_at: datetime | None
    created_at: datetime
    updated_at: datetime


class SoftwareLicenseCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=200)
    vendor: str = Field(min_length=2, max_length=160)
    version: str = Field(default="1.0", max_length=64)
    license_type: LicenseType = "per_seat"
    total_seats: int = Field(ge=0)
    used_seats: int = Field(default=0, ge=0)
    annual_cost: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    renewal_date: date | None = None
    source: str = Field(default="Manual", max_length=32)


class SoftwareSeatsAdjustRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    delta: int = Field(ge=-100000, le=100000)


class SoftwareLicenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    vendor: str
    version: str
    license_type: str
    total_seats: int
    used_seats: int
    annual_cost: Decimal
    renewal_date: date | None
    source: str
    compliance_status: str
    created_at: datetime
    updated_at: datetime


class ContractCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=2, max_length=200)
    vendor: str = Field(min_length=2, max_length=160)
    contract_type: str = Field(default="support", max_length=32)
    annual_value: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    start_date: date | None = None
    renewal_date: date | None = None
    notice_days: int = Field(default=30, ge=0, le=365)
    auto_renew: bool = False
    linked_asset_ids: list[str] = Field(default_factory=list)
    status: ContractStatus = "active"
    rfp_notes: str | None = Field(default=None, max_length=4000)


class ContractOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    title: str
    vendor: str
    contract_type: str
    annual_value: Decimal
    start_date: date | None
    renewal_date: date | None
    notice_days: int
    auto_renew: bool
    linked_asset_ids: list[str]
    status: str
    rfp_notes: str | None
    created_at: datetime


class DomainRecordCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    domain: str = Field(min_length=3, max_length=255)
    registrar: str = Field(default="", max_length=160)
    domain_expiry: date | None = None
    ssl_expiry: date | None = None
    security_grade: str = Field(default="A", max_length=4)
    dnssec_enabled: bool = True
    spf_valid: bool = True
    dkim_valid: bool = True
    dmarc_policy: str = Field(default="reject", max_length=16)
    registrar_locked: bool = True
    lookalike_alerts: int = Field(default=0, ge=0)


class DomainRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    domain: str
    registrar: str
    domain_expiry: date | None
    ssl_expiry: date | None
    security_grade: str
    dnssec_enabled: bool
    spf_valid: bool
    dkim_valid: bool
    dmarc_policy: str
    registrar_locked: bool
    lookalike_alerts: int
    created_at: datetime
