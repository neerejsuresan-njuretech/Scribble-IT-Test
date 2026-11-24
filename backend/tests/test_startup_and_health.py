from __future__ import annotations

from unittest.mock import AsyncMock

import httpx
import pytest

from app.core.exceptions import AuthorizationError
from app.core.redis import redis_manager
from app.db.session import db_manager
from app.main import create_app


@pytest.mark.asyncio
async def test_liveness_endpoint_and_security_headers(async_client: httpx.AsyncClient) -> None:
    resp = await async_client.get("/api/v1/health", headers={"X-Request-ID": "req-smoke-001"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "timestamp" in body

    assert resp.headers["X-Request-ID"] == "req-smoke-001"
    assert resp.headers["X-Content-Type-Options"] == "nosniff"
    assert resp.headers["X-Frame-Options"] == "DENY"
    assert resp.headers["Cache-Control"] == "no-store"


@pytest.mark.asyncio
async def test_version_endpoint(async_client: httpx.AsyncClient) -> None:
    resp = await async_client.get("/api/v1/version")
    assert resp.status_code == 200
    data = resp.json()
    assert data["api_version"] == "v1"
    assert data["environment"] == "test"
    assert data["version"]


@pytest.mark.asyncio
async def test_openapi_schema_generated(async_client: httpx.AsyncClient) -> None:
    resp = await async_client.get("/api/openapi.json")
    assert resp.status_code == 200
    schema = resp.json()
    assert "/api/v1/health" in schema["paths"]
    assert "/api/v1/health/ready" in schema["paths"]
    assert "/api/v1/version" in schema["paths"]


@pytest.mark.asyncio
async def test_readiness_returns_200_when_postgres_and_redis_healthy(
    async_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        db_manager,
        "check_health",
        AsyncMock(return_value={"status": "ok", "latency_ms": 1.2, "role_verified_non_superuser": True}),
    )
    monkeypatch.setattr(
        redis_manager,
        "check_health",
        AsyncMock(return_value={"status": "ok", "latency_ms": 0.4}),
    )

    resp = await async_client.get("/api/v1/health/ready")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ready"
    assert body["checks"]["database"]["status"] == "ok"
    assert body["checks"]["database"]["role_verified_non_superuser"] is True
    assert body["checks"]["redis"]["status"] == "ok"


@pytest.mark.asyncio
async def test_readiness_returns_503_when_dependency_unavailable(
    async_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        db_manager,
        "check_health",
        AsyncMock(return_value={"status": "error", "latency_ms": 2.0, "detail": "Database unavailable"}),
    )
    monkeypatch.setattr(
        redis_manager,
        "check_health",
        AsyncMock(return_value={"status": "ok", "latency_ms": 0.5}),
    )

    resp = await async_client.get("/api/v1/health/ready")
    assert resp.status_code == 503
    body = resp.json()
    assert body["status"] == "degraded"
    assert body["checks"]["database"]["status"] == "error"


@pytest.mark.asyncio
async def test_centralized_exception_and_payload_size_guard(test_settings) -> None:
    app = create_app(settings_override=test_settings)

    @app.get("/api/v1/_test-forbidden")
    async def _raise_forbidden():
        raise AuthorizationError("Insufficient tenant scope.")

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.get("/api/v1/_test-forbidden")
        assert resp.status_code == 403
        err = resp.json()["error"]
        assert err["code"] == "PERMISSION_DENIED"
        assert err["message"] == "Insufficient tenant scope."
        assert err["request_id"]

        oversized = "x" * (test_settings.max_request_body_bytes + 512)
        big_resp = await client.post(
            "/api/v1/health",
            content=oversized,
            headers={"Content-Type": "text/plain"},
        )
        assert big_resp.status_code == 413
        assert big_resp.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"
