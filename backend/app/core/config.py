from __future__ import annotations

from functools import lru_cache
from typing import Literal
from urllib.parse import urlparse

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DISALLOWED_PRODUCTION_DB_USERS = frozenset(
    {"postgres", "superuser", "rdsadmin", "cloudsqlsuperuser", "azure_pg_admin", "root"}
)


class Settings(BaseSettings):
    """Strictly validated runtime configuration for Scribble-IT 2.0 backend."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Service identity
    app_name: str = Field(default="Scribble-IT Enterprise ITSM API")
    app_version: str = Field(default="2.0.0-alpha.1")
    app_env: Literal["development", "staging", "production", "test"] = Field(
        default="development"
    )
    debug: bool = Field(default=False)
    api_v1_prefix: str = Field(default="/api/v1")
    enable_openapi_docs: bool = Field(default=True)

    # Logging
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = Field(
        default="INFO"
    )
    log_json: bool = Field(default=True)

    # PostgreSQL connections (strictly separated runtime vs. migration roles)
    database_url: str = Field(
        default="postgresql+asyncpg://scribble_app:change_me_app_dev@localhost:5432/scribble_it",
        description="Restricted runtime PostgreSQL DSN (NOSUPERUSER, NOBYPASSRLS).",
    )
    migration_database_url: str = Field(
        default="postgresql+psycopg://scribble_migrator:change_me_migrator_dev@localhost:5432/scribble_it",
        description="Migration-only PostgreSQL DSN used exclusively by Alembic.",
    )
    db_pool_size: int = Field(default=10, ge=1, le=100)
    db_max_overflow: int = Field(default=20, ge=0, le=200)
    db_pool_timeout_seconds: int = Field(default=15, ge=1, le=120)
    db_pool_recycle_seconds: int = Field(default=1800, ge=60, le=86400)
    db_echo_sql: bool = Field(default=False)

    # Redis cache & worker broker
    redis_url: str = Field(default="redis://localhost:6379/0")
    redis_socket_timeout_seconds: float = Field(default=3.0, gt=0.0, le=30.0)
    redis_max_connections: int = Field(default=25, ge=1, le=500)

    # Security & HTTP controls
    cors_allowed_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://localhost:5173"]
    )
    allow_tauri_webview_origins: bool = Field(
        default=False,
        description="Explicit opt-in allowing Tauri desktop webview origins without loosening web CORS.",
    )
    max_request_body_bytes: int = Field(default=2 * 1024 * 1024, ge=1024, le=50 * 1024 * 1024)

    # Phase 5.3: Native client & deployment configuration
    deployment_mode: Literal["cloud", "self_hosted"] = Field(default="cloud")
    instance_name: str = Field(default="Scribble-IT Enterprise")
    public_api_url: str | None = Field(default=None)
    allowed_native_app_ids: list[str] = Field(default_factory=list)
    min_desktop_app_version: str = Field(default="1.0.0")
    min_mobile_app_version: str = Field(default="1.0.0")

    # Authentication cryptography foundations
    jwt_secret_key: SecretStr = Field(
        default=SecretStr("dev-only-change-before-staging-or-production-32chars"),
    )
    jwt_algorithm: Literal["HS256", "RS256", "EdDSA"] = Field(default="HS256")
    access_token_ttl_minutes: int = Field(default=15, ge=1, le=60)
    refresh_token_ttl_days: int = Field(default=14, ge=1, le=90)

    # Phase 4: AI Integration (Gemini API — strictly backend-only)
    gemini_api_key: SecretStr = Field(default=SecretStr(""))
    gemini_model: str = Field(default="gemini-4-hydrogen")
    ai_rate_limit_per_minute: int = Field(default=20, ge=1, le=600)
    ai_daily_org_limit: int = Field(default=500, ge=1, le=100000)

    # Phase 4: Integration Secrets, Rate Limiting, Uploads & Telephony
    integration_encryption_key: SecretStr = Field(
        default=SecretStr("dev-only-integration-encryption-key-change-prod-32"),
    )
    api_rate_limit_per_minute: int = Field(default=240, ge=10, le=10000)
    upload_storage_dir: str = Field(default="/var/lib/scribble-it/uploads")
    max_upload_bytes: int = Field(default=10 * 1024 * 1024, ge=1024, le=100 * 1024 * 1024)
    twilio_account_sid: str = Field(default="")
    twilio_auth_token: SecretStr = Field(default=SecretStr(""))
    twilio_from_number: str = Field(default="")
    telephony_webhook_secret: SecretStr = Field(default=SecretStr(""))
    webhook_replay_window_seconds: int = Field(default=300, ge=30, le=3600)

    # Phase 5.3: Push Notification Providers (strictly backend-only — NEVER expose to clients)
    fcm_project_id: str = Field(default="")
    fcm_client_email: str = Field(default="")
    fcm_private_key: SecretStr = Field(default=SecretStr(""))
    apns_team_id: str = Field(default="")
    apns_key_id: str = Field(default="")
    apns_bundle_id: str = Field(default="")
    apns_private_key: SecretStr = Field(default=SecretStr(""))
    apns_use_sandbox: bool = Field(default=False)

    @field_validator("cors_allowed_origins", "allowed_native_app_ids", mode="before")
    @classmethod
    def parse_string_list_setting(cls, value: object) -> list[str]:
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []
            if raw.startswith("["):
                import json

                parsed = json.loads(raw)
                if not isinstance(parsed, list):
                    raise ValueError("List setting JSON value must be a list.")
                return [str(item).strip() for item in parsed if str(item).strip()]
            return [origin.strip() for origin in raw.split(",") if origin.strip()]
        if isinstance(value, list):
            return [str(origin).strip() for origin in value if str(origin).strip()]
        raise ValueError("Setting must be a comma-separated string or list.")

    @field_validator("public_api_url")
    @classmethod
    def validate_public_api_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip().rstrip("/")
        if not cleaned:
            return None
        parsed = urlparse(cleaned)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("PUBLIC_API_URL must be a valid http:// or https:// URL.")
        return cleaned

    @field_validator("database_url")
    @classmethod
    def validate_runtime_database_url(cls, value: str) -> str:
        parsed = urlparse(value)
        if not parsed.scheme.startswith("postgresql"):
            raise ValueError("DATABASE_URL must use a PostgreSQL dialect (e.g., postgresql+asyncpg://).")
        if not parsed.hostname:
            raise ValueError("DATABASE_URL must include a database host.")
        return value

    @field_validator("migration_database_url")
    @classmethod
    def validate_migration_database_url(cls, value: str) -> str:
        parsed = urlparse(value)
        if not parsed.scheme.startswith("postgresql"):
            raise ValueError(
                "MIGRATION_DATABASE_URL must use a PostgreSQL dialect (e.g., postgresql+psycopg://)."
            )
        if not parsed.hostname:
            raise ValueError("MIGRATION_DATABASE_URL must include a database host.")
        return value

    @field_validator("redis_url")
    @classmethod
    def validate_redis_url(cls, value: str) -> str:
        parsed = urlparse(value)
        if parsed.scheme not in {"redis", "rediss", "unix"}:
            raise ValueError("REDIS_URL must use redis://, rediss://, or unix:// scheme.")
        return value

    @model_validator(mode="after")
    def validate_production_security_invariants(self) -> Settings:
        runtime_user = (urlparse(self.database_url).username or "").strip().lower()
        migration_user = (urlparse(self.migration_database_url).username or "").strip().lower()

        if self.app_env in {"staging", "production"}:
            if self.debug:
                raise ValueError("DEBUG must be false in staging and production environments.")

            if runtime_user in DISALLOWED_PRODUCTION_DB_USERS:
                raise ValueError(
                    f"DATABASE_URL cannot use PostgreSQL superuser role '{runtime_user}' in {self.app_env}. "
                    "Use a restricted non-superuser runtime role (e.g. scribble_app)."
                )

            if runtime_user and migration_user and runtime_user == migration_user:
                raise ValueError(
                    "DATABASE_URL and MIGRATION_DATABASE_URL must use separate database roles in "
                    f"{self.app_env} to enforce least privilege between runtime DML and schema DDL."
                )

            if any(origin == "*" or origin.lower() == "null" for origin in self.cors_allowed_origins):
                raise ValueError(
                    "Wildcard '*' and 'null' are forbidden in CORS_ALLOWED_ORIGINS for staging/production."
                )

            if self.public_api_url and not self.public_api_url.startswith("https://"):
                raise ValueError("PUBLIC_API_URL must use HTTPS in staging and production.")

            secret = self.jwt_secret_key.get_secret_value()
            if len(secret) < 32 or "change-before" in secret.lower() or "dev-only" in secret.lower():
                raise ValueError(
                    "JWT_SECRET_KEY must be a high-entropy secret of at least 32 characters in "
                    f"{self.app_env}."
                )

            enc_secret = self.integration_encryption_key.get_secret_value()
            if len(enc_secret) < 32 or "dev-only" in enc_secret.lower():
                raise ValueError(
                    "INTEGRATION_ENCRYPTION_KEY must be a high-entropy secret of at least 32 characters in "
                    f"{self.app_env}."
                )

        return self

    @property
    def effective_cors_allowed_origins(self) -> list[str]:
        origins = list(self.cors_allowed_origins)
        if self.allow_tauri_webview_origins:
            for tauri_origin in ("tauri://localhost", "http://tauri.localhost", "https://tauri.localhost"):
                if tauri_origin not in origins:
                    origins.append(tauri_origin)
        return origins

    @property
    def runtime_db_username(self) -> str:
        return (urlparse(self.database_url).username or "").strip()

    @property
    def migration_db_username(self) -> str:
        return (urlparse(self.migration_database_url).username or "").strip()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached validated application settings."""
    return Settings()
