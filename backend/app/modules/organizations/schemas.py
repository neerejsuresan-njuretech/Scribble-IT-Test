from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    company_code: str
    domain: str
    plan: str
    region: str
    timezone: str
    currency: str
    primary_contact_email: str
    status: str
    logo_storage_key: str | None
    sla_targets: dict[str, Any]
    enabled_modules: dict[str, bool]
    portal_branding: dict[str, Any]
    preference_template: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class OrganizationListResponse(BaseModel):
    items: list[OrganizationOut]
    total: int


class OrganizationCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=160)
    slug: str = Field(min_length=2, max_length=96, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    company_code: str = Field(min_length=2, max_length=48, pattern=r"^[A-Z0-9_-]+$")
    domain: str = Field(min_length=3, max_length=160)
    plan: str = Field(default="Enterprise", max_length=32)
    region: str = Field(default="us-east1", max_length=64)
    timezone: str = Field(default="UTC", max_length=64)
    currency: str = Field(default="USD", min_length=3, max_length=8)
    primary_contact_email: EmailStr
    sla_targets: dict[str, Any] = Field(
        default_factory=lambda: {"P1": 1, "P2": 4, "P3": 24, "P4": 72}
    )
    enabled_modules: dict[str, bool] = Field(default_factory=dict)
    portal_branding: dict[str, Any] = Field(default_factory=dict)
    preference_template: dict[str, Any] = Field(default_factory=dict)


class OrganizationUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=2, max_length=160)
    domain: str | None = Field(default=None, min_length=3, max_length=160)
    plan: str | None = Field(default=None, max_length=32)
    region: str | None = Field(default=None, max_length=64)
    timezone: str | None = Field(default=None, max_length=64)
    currency: str | None = Field(default=None, min_length=3, max_length=8)
    primary_contact_email: EmailStr | None = None
    status: Literal["active", "suspended"] | None = None
    logo_storage_key: str | None = Field(default=None, max_length=512)
    sla_targets: dict[str, Any] | None = None
    enabled_modules: dict[str, bool] | None = None
    portal_branding: dict[str, Any] | None = None
    preference_template: dict[str, Any] | None = None


class OrganizationMemberCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    full_name: str | None = Field(default=None, min_length=2, max_length=160)
    temporary_password: str | None = Field(default=None, min_length=12, max_length=128)
    portal_type: Literal["super_admin", "iam", "employee", "end_user"] = "employee"
    role_slugs: list[str] | None = None
    department_id: uuid.UUID | None = None
    sso_only: bool = False
    mfa_required: bool = False


class OrganizationMemberOut(BaseModel):
    membership_id: uuid.UUID
    organization_id: uuid.UUID
    user_id: uuid.UUID
    email: str
    full_name: str
    user_status: str
    membership_status: str
    portal_type: str
    clearance_tier: str
    sso_only: bool
    mfa_required: bool
    roles: list[str]
    created_at: datetime


class OrganizationSwitchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    organization_id: uuid.UUID


class OrganizationSwitchResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    organization_id: uuid.UUID
    organization_slug: str
    portal_type: str
    clearance_tier: str
    permissions: list[str]
