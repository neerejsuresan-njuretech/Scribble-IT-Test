from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PlatformSettingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    key: str
    value_json: dict[str, Any]
    description: str | None
    is_public: bool
    updated_at: datetime


class PlatformSettingUpsertRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    value_json: dict[str, Any]
    description: str | None = Field(default=None, max_length=512)
    is_public: bool = False


class OrganizationBrandingUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    logo_storage_key: str | None = Field(default=None, max_length=512)
    portal_branding: dict[str, Any] | None = None

    @field_validator("logo_storage_key")
    @classmethod
    def validate_safe_storage_key(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            return None
        lower = cleaned.lower()
        if ".." in cleaned or lower.startswith(("javascript:", "data:", "file:")):
            raise ValueError("Invalid logo storage key format.")
        return cleaned


class OrganizationSlaUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sla_targets: dict[str, int | float]


class OrganizationModulesUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled_modules: dict[str, bool]


class DatabaseGovernanceOperationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    operation: Literal["export_snapshot", "import_validated_backup", "tenant_sandbox_reset"]
    target_organization_id: uuid.UUID | None = None
    confirmation_phrase: str = Field(min_length=8, max_length=128)
    reason: str = Field(min_length=5, max_length=512)


class DatabaseGovernanceOperationResponse(BaseModel):
    operation_id: uuid.UUID
    operation: str
    status: str
    executed_by: str
    executed_at: datetime
    audit_log_id: uuid.UUID
