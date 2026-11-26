from __future__ import annotations

import os
import uuid
from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest

import psycopg
import redis

from app.core.config import Settings
from app.core.rate_limit import rate_limiter
from app.core.security import reset_local_rate_limits
from app.main import create_app

LIVE_INTEGRATION = os.getenv("RUN_LIVE_INTEGRATION_TESTS", "").lower() in {"1", "true", "yes"}


def _truncate_live_test_tables(migration_url: str) -> None:
    """Truncate application tables between live integration tests using the test migrator role."""
    dsn = migration_url.replace("postgresql+psycopg://", "postgresql://", 1)
    with psycopg.connect(dsn, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT tablename
                FROM pg_tables
                WHERE schemaname = 'public' AND tablename <> 'alembic_version'
                ORDER BY tablename
                """
            )
            tables = [row[0] for row in cur.fetchall()]
            if tables:
                quoted = ", ".join(f'public."{tbl}"' for tbl in tables)
                cur.execute(f"TRUNCATE TABLE {quoted} RESTART IDENTITY CASCADE")


def _reset_live_redis_rate_limits(redis_url: str, *, app_env: str) -> None:
    """Clear rate-limit keys (rl:*) between integration tests only when running in test mode."""
    if app_env != "test":
        return
    client = redis.Redis.from_url(redis_url, decode_responses=True)
    try:
        keys = list(client.scan_iter(match="rl:*", count=500))
        if keys:
            client.delete(*keys)
    finally:
        client.close()


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


@pytest.fixture(autouse=True)
def _isolate_live_integration_database(
    request: pytest.FixtureRequest,
    test_settings: Settings,
) -> Any:
    """Ensure every live PostgreSQL + Redis integration test starts and ends with clean state."""
    is_live_integration = (
        LIVE_INTEGRATION and request.node.get_closest_marker("integration") is not None
    )
    if is_live_integration:
        reset_local_rate_limits()
        rate_limiter.reset_local()
        _reset_live_redis_rate_limits(test_settings.redis_url, app_env=test_settings.app_env)
        _truncate_live_test_tables(test_settings.migration_database_url)
    yield
    if is_live_integration:
        reset_local_rate_limits()
        rate_limiter.reset_local()
        _reset_live_redis_rate_limits(test_settings.redis_url, app_env=test_settings.app_env)


@pytest.fixture
async def async_client(test_settings: Settings) -> AsyncIterator[httpx.AsyncClient]:
    app = create_app(settings_override=test_settings)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.fixture
async def client(test_settings: Settings) -> AsyncIterator[httpx.AsyncClient]:
    """Lifespan-managed ASGI client backed by live PostgreSQL & Redis for integration workflows."""
    reset_local_rate_limits()
    rate_limiter.reset_local()
    if LIVE_INTEGRATION:
        _reset_live_redis_rate_limits(test_settings.redis_url, app_env=test_settings.app_env)
    integration_settings = test_settings.model_copy(
        update={"max_request_body_bytes": 10 * 1024 * 1024}
    )
    app = create_app(settings_override=integration_settings)
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as http_client:
            yield http_client


@pytest.fixture
async def _live_org_actors(client: httpx.AsyncClient) -> dict[str, Any]:
    """Provisions isolated multi-tenant actors (Org A & Org B) for live ITSM/CMDB/RBAC integration tests."""
    suffix = uuid.uuid4().hex[:8]
    password = "Enterprise#Password2026!"

    # Bootstrap Org A Super Admin
    reg_a = await client.post(
        "/api/v1/auth/register",
        json={
            "email": f"super_a_{suffix}@orga.example.com",
            "password": password,
            "full_name": "Org A Super Admin",
            "company_name": f"Org A Corp {suffix}",
            "company_slug": f"orga-{suffix}",
            "company_code": f"ORGA{suffix[:4].upper()}",
        },
    )
    assert reg_a.status_code == 201, reg_a.text
    org_a_id = reg_a.json()["organization_id"]
    super_a_headers = {"Authorization": f"Bearer {reg_a.json()['access_token']}"}

    async def create_member(
        org_id: str,
        admin_headers: dict[str, str],
        prefix: str,
        domain: str,
        role_slugs: list[str],
        portal: str = "employee",
    ) -> tuple[str, dict[str, str]]:
        email = f"{prefix}_{suffix}@{domain}"
        created = await client.post(
            f"/api/v1/organizations/{org_id}/members",
            headers=admin_headers,
            json={
                "email": email,
                "full_name": f"Test {prefix}",
                "temporary_password": password,
                "portal_type": portal,
                "role_slugs": role_slugs,
            },
        )
        assert created.status_code == 201, created.text
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password, "portal_type": portal},
        )
        assert login.status_code == 200, login.text
        return created.json()["user_id"], {"Authorization": f"Bearer {login.json()['access_token']}"}

    employee_id, requester_headers = await create_member(
        org_a_id, super_a_headers, "employee", "orga.example.com", ["pol-employee-ops", "pol-approver-cab"]
    )
    approver_id, approver_headers = await create_member(
        org_a_id, super_a_headers, "approver", "orga.example.com", ["pol-approver-cab"]
    )
    cab_id, cab_headers = await create_member(
        org_a_id, super_a_headers, "cabmember", "orga.example.com", ["pol-approver-cab"]
    )
    _unauth_id, unauthorized_headers = await create_member(
        org_a_id, super_a_headers, "bystander", "orga.example.com", ["pol-approver-cab"]
    )
    _end_user_id, end_user_headers = await create_member(
        org_a_id, super_a_headers, "enduser", "orga.example.com", ["pol-end-user"], portal="end_user"
    )

    # Create Org B via Super Admin governance API & provision an Org B operator for cross-tenant isolation tests
    org_b_resp = await client.post(
        "/api/v1/organizations",
        headers=super_a_headers,
        json={
            "name": f"Org B Corp {suffix}",
            "slug": f"orgb-{suffix}",
            "company_code": f"ORGB{suffix[:4].upper()}",
            "domain": f"orgb-{suffix}.example.com",
            "primary_contact_email": f"ops@orgb-{suffix}.example.com",
        },
    )
    assert org_b_resp.status_code == 201, org_b_resp.text
    org_b_id = org_b_resp.json()["id"]
    _org_b_user_id, org_b_headers = await create_member(
        org_b_id, super_a_headers, "ops_b", "orgb.example.com", ["pol-employee-ops", "pol-approver-cab"]
    )

    return {
        "super_admin_headers": super_a_headers,
        "employee_user_id": employee_id,
        "requester_headers": requester_headers,
        "approver_user_id": approver_id,
        "approver_headers": approver_headers,
        "cab_member_user_id": cab_id,
        "cab_member_headers": cab_headers,
        "unauthorized_headers": unauthorized_headers,
        "org_a_headers": super_a_headers,
        "org_b_headers": org_b_headers,
        "org_a_end_user_headers": end_user_headers,
    }


@pytest.fixture
def super_admin_headers(_live_org_actors: dict[str, Any]) -> dict[str, str]:
    return _live_org_actors["super_admin_headers"]


@pytest.fixture
def employee_user_id(_live_org_actors: dict[str, Any]) -> str:
    return _live_org_actors["employee_user_id"]


@pytest.fixture
def requester_headers(_live_org_actors: dict[str, Any]) -> dict[str, str]:
    return _live_org_actors["requester_headers"]


@pytest.fixture
def approver_user_id(_live_org_actors: dict[str, Any]) -> str:
    return _live_org_actors["approver_user_id"]


@pytest.fixture
def approver_headers(_live_org_actors: dict[str, Any]) -> dict[str, str]:
    return _live_org_actors["approver_headers"]


@pytest.fixture
def cab_member_user_id(_live_org_actors: dict[str, Any]) -> str:
    return _live_org_actors["cab_member_user_id"]


@pytest.fixture
def cab_member_headers(_live_org_actors: dict[str, Any]) -> dict[str, str]:
    return _live_org_actors["cab_member_headers"]


@pytest.fixture
def unauthorized_headers(_live_org_actors: dict[str, Any]) -> dict[str, str]:
    return _live_org_actors["unauthorized_headers"]


@pytest.fixture
def org_a_headers(_live_org_actors: dict[str, Any]) -> dict[str, str]:
    return _live_org_actors["org_a_headers"]


@pytest.fixture
def org_b_headers(_live_org_actors: dict[str, Any]) -> dict[str, str]:
    return _live_org_actors["org_b_headers"]


@pytest.fixture
def org_a_end_user_headers(_live_org_actors: dict[str, Any]) -> dict[str, str]:
    return _live_org_actors["org_a_end_user_headers"]
