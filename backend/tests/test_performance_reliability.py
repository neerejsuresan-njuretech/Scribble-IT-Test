from __future__ import annotations

import asyncio
import os
import time

import pytest

from app.core.rate_limit import SlidingWindowRateLimiter
from app.migration.firebase_migrator import FirebaseToPostgresMigrator


def test_concurrent_rate_limiter_under_load() -> None:
    limiter = SlidingWindowRateLimiter()

    async def _hammer() -> tuple[int, int]:
        results = await asyncio.gather(
            *[limiter.check("perf:tenant:burst", limit=50, window_seconds=10) for _ in range(120)]
        )
        allowed = sum(1 for r in results if r.allowed)
        blocked = sum(1 for r in results if not r.allowed)
        return allowed, blocked

    started = time.perf_counter()
    allowed, blocked = asyncio.run(_hammer())
    elapsed_ms = (time.perf_counter() - started) * 1000

    assert allowed == 50
    assert blocked == 70
    assert elapsed_ms < 1000


def test_migration_throughput_on_1000_records() -> None:
    snapshot = {
        "tenants": [{"id": f"t-{i}", "name": f"Org {i}"} for i in range(5)],
        "incidents": [
            {
                "id": f"INC-{i}",
                "tenantId": f"t-{i % 5}",
                "title": f"Synthetic Incident {i}",
                "priority": "P2",
                "status": "New",
            }
            for i in range(1000)
        ],
        "module_state": {
            "assets": [
                {"id": f"AST-{i}", "tenantId": f"t-{i % 5}", "name": f"Server-{i}"}
                for i in range(200)
            ]
        },
    }
    started = time.perf_counter()
    result = FirebaseToPostgresMigrator().transform_snapshot(snapshot, dry_run=True)
    elapsed_ms = (time.perf_counter() - started) * 1000

    assert result.stats["incidents"].migrated_count == 1000
    assert result.stats["assets"].migrated_count == 200
    assert all(result.integrity_checks.values())
    assert elapsed_ms < 2000


@pytest.mark.skipif(
    os.getenv("RUN_LIVE_INTEGRATION_TESTS") != "true",
    reason="Requires live PostgreSQL + Redis (RUN_LIVE_INTEGRATION_TESTS=true)",
)
@pytest.mark.asyncio
async def test_live_health_readiness_and_prometheus_metrics() -> None:
    from httpx import ASGITransport, AsyncClient
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r_health = await client.get("/api/v1/health")
        assert r_health.status_code == 200

        r_metrics = await client.get("/api/v1/metrics")
        assert r_metrics.status_code == 200
        assert "scribble_process_uptime_seconds" in r_metrics.text
        assert "scribble_dependency_up" in r_metrics.text
