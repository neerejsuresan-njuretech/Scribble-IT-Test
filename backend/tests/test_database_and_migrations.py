from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import text

from app.core.config import Settings
from app.core.redis import RedisManager
from app.db.base import Base
from app.db.models.platform import PlatformSetting
from app.db.session import DatabaseManager

BACKEND_ROOT = Path(__file__).resolve().parents[1]
LIVE_INTEGRATION = os.getenv("RUN_LIVE_INTEGRATION_TESTS", "").lower() in {"1", "true", "yes"}


def test_sqlalchemy_base_conventions_and_platform_model() -> None:
    table = Base.metadata.tables["platform_settings"]
    assert table.primary_key.name == "pk_platform_settings"
    assert "id" in table.columns
    assert "created_at" in table.columns
    assert "updated_at" in table.columns
    assert "deleted_at" in table.columns
    assert PlatformSetting.__tablename__ == "platform_settings"


def test_alembic_offline_sql_generation() -> None:
    """Verifies migration script compiles cleanly into PostgreSQL DDL without requiring a live DB."""
    env = os.environ.copy()
    env.setdefault(
        "MIGRATION_DATABASE_URL",
        "postgresql+psycopg://scribble_migrator:test_pw@localhost:5432/scribble_it",
    )
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=str(BACKEND_ROOT),
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, f"Alembic offline SQL failed: {result.stderr}"
    assert "CREATE TABLE platform_settings" in result.stdout
    assert "app.current_organization_id" in result.stdout


@pytest.mark.integration
@pytest.mark.skipif(not LIVE_INTEGRATION, reason="Set RUN_LIVE_INTEGRATION_TESTS=true with live Postgres & Redis")
@pytest.mark.asyncio
async def test_live_postgres_connectivity_and_non_superuser_role(test_settings: Settings) -> None:
    manager = DatabaseManager()
    manager.init(test_settings)
    try:
        health = await manager.check_health()
        assert health["status"] == "ok"
        assert health["role_verified_non_superuser"] is True

        async with manager.engine.connect() as conn:
            row = (
                await conn.execute(
                    text(
                        "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user"
                    )
                )
            ).mappings().one()
            assert row["rolsuper"] is False
            assert row["rolbypassrls"] is False
    finally:
        await manager.close()


@pytest.mark.integration
@pytest.mark.skipif(not LIVE_INTEGRATION, reason="Set RUN_LIVE_INTEGRATION_TESTS=true with live Postgres & Redis")
@pytest.mark.asyncio
async def test_live_redis_connectivity_and_roundtrip(test_settings: Settings) -> None:
    manager = RedisManager()
    manager.init(test_settings)
    try:
        health = await manager.check_health()
        assert health["status"] == "ok"

        await manager.client.set("scribble:test:ping", "pong", ex=30)
        assert await manager.client.get("scribble:test:ping") == "pong"
        await manager.client.delete("scribble:test:ping")
    finally:
        await manager.close()


@pytest.mark.integration
@pytest.mark.skipif(not LIVE_INTEGRATION, reason="Set RUN_LIVE_INTEGRATION_TESTS=true with live Postgres & Redis")
def test_live_alembic_upgrade_downgrade_upgrade() -> None:
    """Executes full Alembic migration lifecycle against PostgreSQL using MIGRATION_DATABASE_URL."""
    for args in (
        ["upgrade", "head"],
        ["downgrade", "base"],
        ["upgrade", "head"],
    ):
        result = subprocess.run(
            [sys.executable, "-m", "alembic", *args],
            cwd=str(BACKEND_ROOT),
            env=os.environ.copy(),
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 0, f"alembic {' '.join(args)} failed: {result.stderr}"
