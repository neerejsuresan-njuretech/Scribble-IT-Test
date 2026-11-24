from __future__ import annotations

import uuid
from datetime import datetime

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
    created_at: datetime


class ManagedDeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    hostname: str
    os_platform: str
    mdm_provider: str
    certificate_thumbprint: str
    bound_user_id: uuid.UUID | None
    enrolled_by_email: str | None
    status: str
    verified_by_iam: bool
    last_seen_at: datetime | None
    created_at: datetime
