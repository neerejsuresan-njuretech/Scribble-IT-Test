from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=160)
    phone: str | None = Field(default=None, max_length=32)
    job_title: str | None = Field(default=None, max_length=128)
    organization_id: uuid.UUID | None = None
    company_name: str | None = Field(default=None, max_length=160)
    company_slug: str | None = Field(default=None, max_length=96)
    company_code: str | None = Field(default=None, max_length=48)


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    portal_type: str = Field(default="employee", max_length=24)
    organization_id: uuid.UUID | None = None
    totp_code: str | None = Field(default=None, max_length=16)
    backup_code: str | None = Field(default=None, max_length=16)


class RefreshTokenRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    refresh_token: str = Field(min_length=16)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: uuid.UUID
    email: str
    full_name: str
    organization_id: uuid.UUID
    organization_slug: str
    portal_type: str
    clearance_tier: str
    is_platform_super_admin: bool
    permissions: list[str]
    mfa_required: bool
    requires_mfa_verification: bool = False


class ForgotPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=16)
    new_password: str = Field(min_length=8, max_length=128)


class MfaEnrollResponse(BaseModel):
    secret: str
    otpauth_url: str
    backup_codes: list[str]


class MfaVerifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=6, max_length=16)


class DeviceEnrollRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enrollment_code: str = Field(min_length=8, max_length=32)
    hostname: str = Field(min_length=2, max_length=128)
    os_platform: str = Field(default="Enterprise OS", max_length=64)
    device_fingerprint: str = Field(min_length=16, max_length=128)


class DeviceSsoLoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    device_fingerprint: str = Field(min_length=16, max_length=128)
    certificate_thumbprint: str = Field(min_length=16, max_length=128)
    organization_id: uuid.UUID
    email: EmailStr


class UserSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    portal_type: str
    auth_method: str
    ip_address: str | None
    user_agent: str | None
    device_id: uuid.UUID | None
    created_at: datetime
    expires_at: datetime
    last_used_at: datetime | None
    revoked_at: datetime | None
