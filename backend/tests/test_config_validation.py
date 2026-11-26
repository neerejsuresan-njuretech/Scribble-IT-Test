from __future__ import annotations

import pytest
from pydantic import SecretStr, ValidationError

from app.core.config import Settings


def test_valid_development_settings() -> None:
    settings = Settings(
        app_env="development",
        database_url="postgresql+asyncpg://scribble_app:dev_pass@localhost:5432/scribble_it",
        migration_database_url="postgresql+psycopg://scribble_migrator:mig_pass@localhost:5432/scribble_it",
        redis_url="redis://localhost:6379/0",
        cors_allowed_origins="http://localhost:3000,http://localhost:5173",
    )
    assert settings.runtime_db_username == "scribble_app"
    assert settings.migration_db_username == "scribble_migrator"
    assert settings.cors_allowed_origins == ["http://localhost:3000", "http://localhost:5173"]


def test_rejects_non_postgresql_database_url() -> None:
    with pytest.raises(ValidationError, match="PostgreSQL dialect"):
        Settings(
            app_env="development",
            database_url="sqlite+aiosqlite:///./local.db",
        )


def test_rejects_invalid_redis_scheme() -> None:
    with pytest.raises(ValidationError, match="REDIS_URL"):
        Settings(
            app_env="development",
            redis_url="http://localhost:6379",
        )


def test_production_rejects_postgres_superuser_runtime_role() -> None:
    with pytest.raises(ValidationError, match="PostgreSQL superuser role"):
        Settings(
            app_env="production",
            debug=False,
            database_url="postgresql+asyncpg://postgres:strong_pw@db.internal:5432/scribble_it",
            migration_database_url="postgresql+psycopg://scribble_migrator:strong_pw@db.internal:5432/scribble_it",
            cors_allowed_origins=["https://app.scribbleit.example"],
            jwt_secret_key=SecretStr("A9x!kP2mQ7vR4zL8wN1cF6tB3yH5jD0sE9uG2qK4"),
        )


def test_production_requires_separate_runtime_and_migration_roles() -> None:
    with pytest.raises(ValidationError, match="must use separate database roles"):
        Settings(
            app_env="production",
            debug=False,
            database_url="postgresql+asyncpg://scribble_app:strong_pw@db.internal:5432/scribble_it",
            migration_database_url="postgresql+psycopg://scribble_app:strong_pw@db.internal:5432/scribble_it",
            cors_allowed_origins=["https://app.scribbleit.example"],
            jwt_secret_key=SecretStr("A9x!kP2mQ7vR4zL8wN1cF6tB3yH5jD0sE9uG2qK4"),
        )


def test_production_rejects_wildcard_cors() -> None:
    expected_msg = r"Wildcard '\*' and 'null' are forbidden in CORS_ALLOWED_ORIGINS for staging/production\."
    with pytest.raises(ValidationError, match=expected_msg):
        Settings(
            app_env="production",
            debug=False,
            database_url="postgresql+asyncpg://scribble_app:strong_pw@db.internal:5432/scribble_it",
            migration_database_url="postgresql+psycopg://scribble_migrator:strong_pw@db.internal:5432/scribble_it",
            cors_allowed_origins=["*"],
            jwt_secret_key=SecretStr("A9x!kP2mQ7vR4zL8wN1cF6tB3yH5jD0sE9uG2qK4"),
        )

    with pytest.raises(ValidationError, match=expected_msg):
        Settings(
            app_env="production",
            debug=False,
            database_url="postgresql+asyncpg://scribble_app:strong_pw@db.internal:5432/scribble_it",
            migration_database_url="postgresql+psycopg://scribble_migrator:strong_pw@db.internal:5432/scribble_it",
            cors_allowed_origins=["null"],
            jwt_secret_key=SecretStr("A9x!kP2mQ7vR4zL8wN1cF6tB3yH5jD0sE9uG2qK4"),
        )

    with pytest.raises(ValidationError, match=expected_msg):
        Settings(
            app_env="staging",
            debug=False,
            database_url="postgresql+asyncpg://scribble_app:strong_pw@db.internal:5432/scribble_it",
            migration_database_url="postgresql+psycopg://scribble_migrator:strong_pw@db.internal:5432/scribble_it",
            cors_allowed_origins=["*"],
            jwt_secret_key=SecretStr("A9x!kP2mQ7vR4zL8wN1cF6tB3yH5jD0sE9uG2qK4"),
        )


def test_production_rejects_weak_jwt_secret() -> None:
    with pytest.raises(ValidationError, match="JWT_SECRET_KEY"):
        Settings(
            app_env="production",
            debug=False,
            database_url="postgresql+asyncpg://scribble_app:strong_pw@db.internal:5432/scribble_it",
            migration_database_url="postgresql+psycopg://scribble_migrator:strong_pw@db.internal:5432/scribble_it",
            cors_allowed_origins=["https://app.scribbleit.example"],
            jwt_secret_key=SecretStr("short-secret"),
        )


def test_production_accepts_hardened_configuration() -> None:
    settings = Settings(
        app_env="production",
        debug=False,
        database_url="postgresql+asyncpg://scribble_app:strong_pw@db.internal:5432/scribble_it",
        migration_database_url="postgresql+psycopg://scribble_migrator:mig_pw@db.internal:5432/scribble_it",
        redis_url="rediss://redis.internal:6379/0",
        cors_allowed_origins=["https://app.scribbleit.example"],
        jwt_secret_key=SecretStr("A9x!kP2mQ7vR4zL8wN1cF6tB3yH5jD0sE9uG2qK4"),
    )
    assert settings.app_env == "production"
    assert settings.runtime_db_username == "scribble_app"
    assert settings.migration_db_username == "scribble_migrator"
