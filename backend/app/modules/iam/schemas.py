from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID | None
    slug: str
    name: str
    description: str
    is_system: bool
    sso_only: bool
    mfa_required: bool
    permissions: list[str]


class RoleCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slug: str = Field(min_length=2, max_length=64, pattern=r"^[a-z0-9-]+$")
    name: str = Field(min_length=2, max_length=128)
    description: str = Field(default="", max_length=512)
    sso_only: bool = False
    mfa_required: bool = False
    permission_scopes: list[str] = Field(default_factory=list)


class UpdateMemberRolesRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role_slugs: list[str]
    sso_only: bool | None = None
    mfa_required: bool | None = None


class IamMemberOut(BaseModel):
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
    effective_permissions: list[str]
    created_at: datetime


class DeviceEnrollmentCodeCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assigned_email: EmailStr | None = None
    target_hostname: str | None = Field(default=None, max_length=128)
    mdm_provider: str = Field(default="Microsoft Intune", max_length=96)
    ttl_hours: int = Field(default=24, ge=1, le=168)


class DeviceEnrollmentCodeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    code_prefix: str
    assigned_email: str | None
    target_hostname: str | None
    mdm_provider: str
    status: str
    expires_at: datetime
    used_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime


class ManagedDeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    hostname: str
    os_platform: str
    client_type: str = "web"
    device_platform: str = "web"
    app_version: str | None = None
    os_version: str | None = None
    device_model: str | None = None
    mdm_provider: str
    certificate_thumbprint: str
    bound_user_id: uuid.UUID | None
    enrolled_by_email: str | None
    trust_level: str
    verified_by_iam: bool
    mdm_verified: bool
    mdm_authority_ref: str | None
    mdm_verified_at: datetime | None
    status: str
    revoked_at: datetime | None
    last_seen_at: datetime | None
    created_at: datetime


class DeviceMdmAttestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mdm_provider: str = Field(min_length=2, max_length=96)
    mdm_authority_ref: str = Field(min_length=4, max_length=160)


class DeviceTrustEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    device_id: uuid.UUID | None
    enrollment_code_id: uuid.UUID | None
    event_type: str
    actor_user_id: uuid.UUID | None
    actor_email: str
    detail: str
    metadata_json: dict[str, Any]
    created_at: datetime
