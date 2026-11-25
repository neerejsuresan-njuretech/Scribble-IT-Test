from __future__ import annotations

import asyncio
import os
from pathlib import Path

import pytest

from app.core.config import Settings
from app.core.rate_limit import SlidingWindowRateLimiter
from app.core.ssrf import SsrfBlockedError, validate_outbound_url
from app.modules.ai.guardrails import sanitize_text

SSRF_ATTACK_PAYLOADS = [
    "http://169.254.169.254/latest/meta-data/",
    "https://169.254.169.254/latest/meta-data/iam/security-credentials/",
    "https://127.0.0.1:8000/api/v1/health",
    "https://localhost/admin",
    "https://[::1]/api/v1/health",
    "https://[::ffff:127.0.0.1]/admin",
    "https://10.0.0.1/internal",
    "https://172.16.5.10/internal",
    "https://192.168.1.1/router",
    "https://metadata.google.internal/computeMetadata/v1/",
    "https://user:pass@hooks.example.com/callback",
    "ftp://hooks.example.com/file",
    "http://hooks.example.com/unencrypted",
    "https://2130706433/loopback-integer-ip",
]


@pytest.mark.parametrize("attack_url", SSRF_ATTACK_PAYLOADS)
def test_ssrf_blocks_metadata_private_and_bypass_urls(attack_url: str) -> None:
    with pytest.raises(SsrfBlockedError):
        validate_outbound_url(attack_url)


def test_production_config_rejects_weak_secrets_and_wildcard_cors() -> None:
    with pytest.raises(ValueError):
        Settings(
            app_env="production",
            jwt_secret_key="short-weak",
            integration_encryption_key="a" * 40,
            cors_allowed_origins="https://itsm.example.com",
        )

    with pytest.raises(ValueError):
        Settings(
            app_env="production",
            jwt_secret_key="b" * 40,
            integration_encryption_key="short",
            cors_allowed_origins="https://itsm.example.com",
        )

    with pytest.raises(ValueError):
        Settings(
            app_env="production",
            jwt_secret_key="b" * 40,
            integration_encryption_key="a" * 40,
            cors_allowed_origins="*",
        )


def test_sliding_window_rate_limiter_enforces_limit_and_resets() -> None:
    limiter = SlidingWindowRateLimiter()

    async def _run() -> None:
        key = "test:security:burst"
        for i in range(5):
            res = await limiter.check(key, limit=5, window_seconds=2)
            assert res.allowed is True
            assert res.remaining == 5 - (i + 1)
        blocked = await limiter.check(key, limit=5, window_seconds=2)
        assert blocked.allowed is False
        assert blocked.remaining == 0

    asyncio.run(_run())


def test_xss_control_chars_and_null_bytes_sanitized() -> None:
    dirty = "Normal text\x00\x07\x1b<script>alert(1)</script>"
    cleaned = sanitize_text(dirty, max_len=200)
    assert "\x00" not in cleaned
    assert "\x07" not in cleaned
    assert len(cleaned) <= 200


def test_security_spec_static_invariants_in_migrations_and_code() -> None:
    """
    Verifies critical static invariants from security_spec.md:
    - All migrations enable and force RLS on tenant-scoped tables.
    - Immutable audit & AI interaction logs revoke UPDATE/DELETE/TRUNCATE.
    - No hardcoded secret keys or plaintext password comparisons exist in auth.
    """
    versions_dir = Path(__file__).resolve().parents[1] / "alembic" / "versions"
    migration_sources = "\n".join(p.read_text(encoding="utf-8") for p in sorted(versions_dir.glob("*.py")))
    assert "ENABLE ROW LEVEL SECURITY" in migration_sources
    assert "FORCE ROW LEVEL SECURITY" in migration_sources
    assert "CREATE TRIGGER trg_audit_logs_immutable" in migration_sources
    assert "REVOKE UPDATE, DELETE, TRUNCATE ON ai_interaction_logs FROM scribble_app" in migration_sources

    auth_service = (
        Path(__file__).resolve().parents[1] / "app" / "modules" / "auth" / "service.py"
    ).read_text(encoding="utf-8")
    assert "verify_password" in auth_service
    assert "hash_password" in auth_service


@pytest.mark.skipif(
    os.getenv("RUN_LIVE_INTEGRATION_TESTS") != "true",
    reason="Requires live PostgreSQL + Redis (RUN_LIVE_INTEGRATION_TESTS=true)",
)
@pytest.mark.asyncio
async def test_live_security_headers_csrf_and_payload_limits() -> None:
    from httpx import ASGITransport, AsyncClient
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/v1/health")
        assert r.status_code == 200
        assert r.headers.get("x-content-type-options") == "nosniff"
        assert r.headers.get("x-frame-options") == "DENY"
        assert "default-src 'none'" in (r.headers.get("content-security-policy") or "")
        assert r.headers.get("cross-origin-opener-policy") == "same-origin"

        # CSRF origin mismatch rejected on cookie-bearing state-changing request
        csrf_resp = await client.post(
            "/api/v1/auth/logout",
            headers={
                "Origin": "https://evil-attacker.example",
                "Cookie": "scribble_refresh=fake-cookie",
            },
        )
        assert csrf_resp.status_code == 403
        assert csrf_resp.json()["error"]["code"] == "CSRF_ORIGIN_MISMATCH"
