from __future__ import annotations

import os
from collections.abc import AsyncIterator

import httpx
import pytest

from app.core.config import Settings
from app.main import create_app


@pytest.fixture
def test_settings() -> Settings:
    return Settings(
        app_env="test",
        debug=False,
        log_json=True,
        database_url=os.getenv(
            "DATABASE_URL",
            "postgresql+asyncpg://scribble_app:test_app_pass@localhost:5432/scribble_it",
        ),
        migration_database_url=os.getenv(
            "MIGRATION_DATABASE_URL",
            "postgresql+psycopg://scribble_migrator:test_migrator_pass@localhost:5432/scribble_it",
        ),
        redis_url=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
        cors_allowed_origins=["http://localhost:3000"],
        max_request_body_bytes=4096,
    )


@pytest.fixture
async def async_client(test_settings: Settings) -> AsyncIterator[httpx.AsyncClient]:
    app = create_app(settings_override=test_settings)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
