from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Any

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from pydantic import SecretStr, ValidationError
from sqlalchemy import select

from app.core.client_meta import resolve_client_metadata
from app.core.config import Settings
from app.core.exceptions import AppError, ValidationDomainError
from app.core.security import generate_totp_code, reset_local_rate_limits
from app.core.ssrf import (
    APNS_ALLOWED_HOSTS,
    FCM_ALLOWED_HOSTS,
    SsrfBlockedError,
    validate_outbound_url,
)
from app.db.models.audit import AuditLog
from app.db.models.integrations import BackgroundJob
from app.db.models.push_notifications import DevicePushToken, PushDeliveryLog
from app.db.session import DatabaseManager, enable_transaction_platform_lookup
from app.main import create_app
from app.modules.auth.schemas import DeviceEnrollRequest, LoginRequest, RefreshTokenRequest
from app.modules.notifications.adapters import ApnsPushAdapter, FcmPushAdapter
from app.modules.notifications.schemas import PushDispatchRequest, PushTokenRegisterRequest
from app.workers.runner import process_single_job

BACKEND_ROOT = Path(__file__).resolve().parents[1]
LIVE_INTEGRATION = os.getenv("RUN_LIVE_INTEGRATION_TESTS", "").lower() in {"1", "true", "yes"}


def _generate_rsa_pem() -> tuple[str, str]:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    priv = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("ascii")
    pub = key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("ascii")
    return priv, pub


def _generate_ec_p256_pem() -> tuple[str, str]:
    key = ec.generate_private_key(ec.SECP256R1())
    priv = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("ascii")
    pub = key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("ascii")
    return priv, pub


# ---------------------------------------------------------------------------
# Unit & Offline Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_native_client_config_endpoint_cloud_and_self_hosted(test_settings: Settings) -> None:
    custom_settings = test_settings.model_copy(
        update={
            "deployment_mode": "self_hosted",
            "instance_name": "Acme Internal ITSM",
            "public_api_url": "https://itsm.acme.example.com",
            "min_desktop_app_version": "1.2.0",
            "min_mobile_app_version": "1.3.0",
            "allowed_native_app_ids": ["com.njuretech.scribbleit.desktop", "com.njuretech.scribbleit.mobile"],
            "fcm_project_id": "scribble-push-prod",
            "fcm_client_email": "push@scribble-push-prod.iam.gserviceaccount.com",
            "fcm_private_key": SecretStr("TOP-SECRET-FCM-PRIVATE-KEY"),
            "apns_private_key": SecretStr("TOP-SECRET-APNS-PRIVATE-KEY"),
        }
    )
    app = create_app(settings_override=custom_settings)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.get("/api/v1/client/config")
        assert resp.status_code == 200, resp.text
        assert resp.headers.get("X-Scribble-API-Version") == "v1"
        body = resp.json()
        assert body["deployment_mode"] == "self_hosted"
        assert body["instance_name"] == "Acme Internal ITSM"
        assert body["public_api_url"] == "https://itsm.acme.example.com"
        assert body["api_version"] == "v1"
        assert body["api_prefix"] == "/api/v1"
        assert body["minimum_client_versions"] == {"desktop": "1.2.0", "mobile": "1.3.0"}
        assert body["features"]["fcm_configured"] is True
        assert body["features"]["apns_configured"] is False
        # Provider secrets must NEVER leak into client config responses
        raw_text = resp.text
        assert "TOP-SECRET-FCM-PRIVATE-KEY" not in raw_text
        assert "TOP-SECRET-APNS-PRIVATE-KEY" not in raw_text
        assert custom_settings.jwt_secret_key.get_secret_value() not in raw_text


def test_native_cors_configuration_and_tauri_opt_in() -> None:
    base_kwargs = {
        "app_env": "production",
        "debug": False,
        "database_url": "postgresql+asyncpg://scribble_app:strong@db.internal:5432/scribble_it",
        "migration_database_url": "postgresql+psycopg://scribble_migrator:strong@db.internal:5432/scribble_it",
        "jwt_secret_key": SecretStr("prod-high-entropy-jwt-secret-key-9876543210abcdef"),
        "integration_encryption_key": SecretStr("prod-high-entropy-integration-key-1234567890abcdef"),
        "cors_allowed_origins": ["https://app.njuregroup.in"],
        "public_api_url": "https://api.njuregroup.in",
    }
    strict_web = Settings(**base_kwargs, allow_tauri_webview_origins=False)
    assert strict_web.effective_cors_allowed_origins == ["https://app.njuregroup.in"]

    with_tauri = Settings(**base_kwargs, allow_tauri_webview_origins=True)
    assert "https://app.njuregroup.in" in with_tauri.effective_cors_allowed_origins
    assert "tauri://localhost" in with_tauri.effective_cors_allowed_origins
    assert "*" not in with_tauri.effective_cors_allowed_origins

    # Production must reject wildcard, null origin, and insecure HTTP public_api_url
    with pytest.raises(ValidationError):
        Settings(**{**base_kwargs, "cors_allowed_origins": ["*"]})
    with pytest.raises(ValidationError):
        Settings(**{**base_kwargs, "cors_allowed_origins": ["null"]})
    with pytest.raises(ValidationError):
        Settings(**{**base_kwargs, "public_api_url": "http://api.njuregroup.in"})


@pytest.mark.asyncio
async def test_native_client_metadata_validation_and_min_version_upgrade(test_settings: Settings) -> None:
    strict_settings = test_settings.model_copy(
        update={
            "min_desktop_app_version": "2.0.0",
            "min_mobile_app_version": "2.0.0",
            "allowed_native_app_ids": ["com.njuretech.scribbleit.desktop", "com.njuretech.scribbleit.mobile"],
        }
    )

    # Valid desktop metadata
    meta = resolve_client_metadata(
        settings=strict_settings,
        body_client_type="desktop",
        body_client_platform="macos",
        body_app_version="2.1.3",
        body_app_id="com.njuretech.scribbleit.desktop",
    )
    assert meta.client_type == "desktop"
    assert meta.client_platform == "macos"
    assert meta.app_version == "2.1.3"

    # Platform incompatible with client_type
    with pytest.raises(ValidationDomainError):
        resolve_client_metadata(
            settings=strict_settings,
            body_client_type="desktop",
            body_client_platform="ios",
            body_app_version="2.1.0",
        )

    # Missing semantic app_version for native client
    with pytest.raises(ValidationDomainError):
        resolve_client_metadata(
            settings=strict_settings,
            body_client_type="mobile",
            body_client_platform="android",
        )

    # Disallowed app_id
    with pytest.raises(ValidationDomainError):
        resolve_client_metadata(
            settings=strict_settings,
            body_client_type="mobile",
            body_client_platform="android",
            body_app_version="2.1.0",
            body_app_id="com.untrusted.clone",
        )

    # Outdated version triggers HTTP 426 CLIENT_UPGRADE_REQUIRED
    with pytest.raises(AppError) as exc_info:
        resolve_client_metadata(
            settings=strict_settings,
            body_client_type="desktop",
            body_client_platform="windows",
            body_app_version="1.9.9",
        )
    assert exc_info.value.status_code == 426
    assert exc_info.value.error_code == "CLIENT_UPGRADE_REQUIRED"

    # Middleware also enforces header validation on /api/v1/* endpoints
    app = create_app(settings_override=strict_settings)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        r_upgrade = await client.get(
            "/api/v1/client/config",
            headers={
                "X-Scribble-Client-Type": "mobile",
                "X-Scribble-Client-Platform": "ios",
                "X-Scribble-App-Version": "1.0.0",
            },
        )
        assert r_upgrade.status_code == 426
        assert r_upgrade.json()["error"]["code"] == "CLIENT_UPGRADE_REQUIRED"

        r_bad_platform = await client.get(
            "/api/v1/client/config",
            headers={
                "X-Scribble-Client-Type": "desktop",
                "X-Scribble-Client-Platform": "android",
                "X-Scribble-App-Version": "2.1.0",
            },
        )
        assert r_bad_platform.status_code == 422


def test_native_schemas_reject_client_supplied_roles_and_mdm_flags() -> None:
    with pytest.raises(ValidationError):
        LoginRequest(
            email="ops@example.com",
            password="StrongPassword!2026",
            roles=["pol-super-admin"],  # type: ignore[call-arg]
        )

    with pytest.raises(ValidationError):
        RefreshTokenRequest(
            refresh_token="x" * 32,
            organization_id=str(uuid.uuid4()),  # type: ignore[call-arg]
        )

    with pytest.raises(ValidationError):
        DeviceEnrollRequest(
            enrollment_code="IAM-ABCD-EFGH",
            hostname="corp-mac-01",
            device_fingerprint="fp-1234567890abcdef",
            mdm_verified=True,  # type: ignore[call-arg]
        )

    with pytest.raises(ValidationError):
        PushTokenRegisterRequest(
            provider="fcm",
            platform="android",
            push_token="fcm_token_abcdefghijklmnopqrstuvwxyz",
            organization_id=str(uuid.uuid4()),  # type: ignore[call-arg]
        )

    # Provider / platform mismatch & whitespace in push tokens rejected
    with pytest.raises(ValidationError):
        PushTokenRegisterRequest(
            provider="apns",
            platform="android",
            push_token="token_abcdefghijklmnopqrstuvwxyz",
        )
    with pytest.raises(ValidationError):
        PushTokenRegisterRequest(
            provider="fcm",
            platform="ios",
            push_token="token_abcdefghijklmnopqrstuvwxyz",
        )
    with pytest.raises(ValidationError):
        PushTokenRegisterRequest(
            provider="fcm",
            platform="android",
            push_token="bad token with spaces 1234567890",
        )

    with pytest.raises(ValidationError):
        PushDispatchRequest(
            target_user_ids=[uuid.uuid4()],
            title="Alert",
            body="Body",
            organization_id=str(uuid.uuid4()),  # type: ignore[call-arg]
        )


@pytest.mark.asyncio
async def test_fcm_adapter_oauth_rs256_send_invalid_token_and_retryable() -> None:
    priv_pem, pub_pem = _generate_rsa_pem()
    assertion = FcmPushAdapter.build_service_account_assertion(
        client_email="push-sa@scribble-test.iam.gserviceaccount.com",
        private_key_pem=priv_pem,
    )
    decoded = jwt.decode(assertion, pub_pem, algorithms=["RS256"], audience="https://oauth2.googleapis.com/token")
    assert decoded["iss"] == "push-sa@scribble-test.iam.gserviceaccount.com"
    assert decoded["scope"] == "https://www.googleapis.com/auth/firebase.messaging"

    # 1. Successful delivery via MockTransport
    def ok_handler(request: httpx.Request) -> httpx.Response:
        if str(request.url) == "https://oauth2.googleapis.com/token":
            return httpx.Response(200, json={"access_token": "ya29.mock-fcm-access"})
        if str(request.url) == "https://fcm.googleapis.com/v1/projects/scribble-test/messages:send":
            assert request.headers["authorization"] == "Bearer ya29.mock-fcm-access"
            payload = json.loads(request.content.decode("utf-8"))
            assert payload["message"]["token"] == "fcm-device-token-1234567890"
            return httpx.Response(200, json={"name": "projects/scribble-test/messages/msg-101"})
        raise AssertionError(f"Unexpected URL: {request.url}")

    res_ok = await FcmPushAdapter.send(
        project_id="scribble-test",
        client_email="push-sa@scribble-test.iam.gserviceaccount.com",
        private_key_pem=priv_pem,
        device_token="fcm-device-token-1234567890",
        title="P1 Incident",
        body="Core database latency spike",
        data={"incident_id": "INC-1001"},
        priority="high",
        transport=httpx.MockTransport(ok_handler),
    )
    assert res_ok.delivered is True
    assert res_ok.http_status == 200
    assert res_ok.provider_message_id == "projects/scribble-test/messages/msg-101"

    # 2. Permanent UNREGISTERED token
    def unregistered_handler(request: httpx.Request) -> httpx.Response:
        if "oauth2.googleapis.com" in str(request.url):
            return httpx.Response(200, json={"access_token": "ya29.mock"})
        return httpx.Response(
            404,
            json={
                "error": {
                    "code": 404,
                    "message": "Requested entity was not found.",
                    "status": "NOT_FOUND",
                    "details": [{"errorCode": "UNREGISTERED"}],
                }
            },
        )

    res_unreg = await FcmPushAdapter.send(
        project_id="scribble-test",
        client_email="push-sa@scribble-test.iam.gserviceaccount.com",
        private_key_pem=priv_pem,
        device_token="stale-fcm-token-1234567890",
        title="Alert",
        body="Body",
        transport=httpx.MockTransport(unregistered_handler),
    )
    assert res_unreg.delivered is False
    assert res_unreg.permanent_token_invalid is True
    assert res_unreg.retryable is False
    assert res_unreg.error_code == "UNREGISTERED"

    # 3. Transient 503 error marked retryable
    def retryable_handler(request: httpx.Request) -> httpx.Response:
        if "oauth2.googleapis.com" in str(request.url):
            return httpx.Response(200, json={"access_token": "ya29.mock"})
        return httpx.Response(503, json={"error": {"status": "UNAVAILABLE", "message": "Try again"}})

    res_503 = await FcmPushAdapter.send(
        project_id="scribble-test",
        client_email="push-sa@scribble-test.iam.gserviceaccount.com",
        private_key_pem=priv_pem,
        device_token="valid-fcm-token-1234567890",
        title="Alert",
        body="Body",
        transport=httpx.MockTransport(retryable_handler),
    )
    assert res_503.delivered is False
    assert res_503.permanent_token_invalid is False
    assert res_503.retryable is True


@pytest.mark.asyncio
async def test_apns_adapter_es256_send_sandbox_invalid_token_and_retryable() -> None:
    priv_pem, pub_pem = _generate_ec_p256_pem()
    provider_jwt = ApnsPushAdapter.build_provider_jwt(
        team_id="TEAM123456",
        key_id="KEY9876543",
        private_key_pem=priv_pem,
    )
    hdr = jwt.get_unverified_header(provider_jwt)
    assert hdr["alg"] == "ES256"
    assert hdr["kid"] == "KEY9876543"
    decoded = jwt.decode(provider_jwt, pub_pem, algorithms=["ES256"])
    assert decoded["iss"] == "TEAM123456"

    seen_urls: list[str] = []

    def ok_handler(request: httpx.Request) -> httpx.Response:
        seen_urls.append(str(request.url))
        assert request.headers["apns-topic"] == "com.njuretech.scribbleit.mobile"
        assert request.headers["apns-priority"] == "10"
        return httpx.Response(200, headers={"apns-id": "apns-uuid-001"})

    res_ok = await ApnsPushAdapter.send(
        team_id="TEAM123456",
        key_id="KEY9876543",
        bundle_id="com.njuretech.scribbleit.mobile",
        private_key_pem=priv_pem,
        device_token="abcdef0123456789abcdef0123456789",
        title="CAB Approval",
        body="Change CHG-404 awaits your vote",
        data={"change_id": "CHG-404"},
        priority="high",
        use_sandbox=True,
        transport=httpx.MockTransport(ok_handler),
    )
    assert res_ok.delivered is True
    assert res_ok.provider_message_id == "apns-uuid-001"
    assert seen_urls == ["https://api.sandbox.push.apple.com/3/device/abcdef0123456789abcdef0123456789"]

    def invalid_handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(410, json={"reason": "Unregistered"})

    res_410 = await ApnsPushAdapter.send(
        team_id="TEAM123456",
        key_id="KEY9876543",
        bundle_id="com.njuretech.scribbleit.mobile",
        private_key_pem=priv_pem,
        device_token="abcdef0123456789abcdef0123456789",
        title="Alert",
        body="Body",
        transport=httpx.MockTransport(invalid_handler),
    )
    assert res_410.permanent_token_invalid is True
    assert res_410.retryable is False
    assert res_410.error_code == "Unregistered"

    def retry_handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"reason": "InternalServerError"})

    res_500 = await ApnsPushAdapter.send(
        team_id="TEAM123456",
        key_id="KEY9876543",
        bundle_id="com.njuretech.scribbleit.mobile",
        private_key_pem=priv_pem,
        device_token="abcdef0123456789abcdef0123456789",
        title="Alert",
        body="Body",
        transport=httpx.MockTransport(retry_handler),
    )
    assert res_500.delivered is False
    assert res_500.retryable is True


def test_push_ssrf_allowlist_enforcement() -> None:
    assert (
        validate_outbound_url(
            "https://fcm.googleapis.com/v1/projects/p/messages:send",
            allowed_hosts=FCM_ALLOWED_HOSTS,
        )
        == "https://fcm.googleapis.com/v1/projects/p/messages:send"
    )
    assert (
        validate_outbound_url(
            "https://api.push.apple.com/3/device/abc123",
            allowed_hosts=APNS_ALLOWED_HOSTS,
        )
        == "https://api.push.apple.com/3/device/abc123"
    )
    with pytest.raises(SsrfBlockedError):
        validate_outbound_url("https://evil.example.com/push", allowed_hosts=FCM_ALLOWED_HOSTS)
    with pytest.raises(SsrfBlockedError):
        validate_outbound_url("http://169.254.169.254/latest/meta-data", allowed_hosts=APNS_ALLOWED_HOSTS)


def test_alembic_migration_0005_ddl_rls_and_constraints() -> None:
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
    ddl = result.stdout

    for expected in (
        "CREATE TABLE device_push_tokens",
        "CREATE TABLE push_delivery_logs",
        "ALTER TABLE sessions ADD COLUMN client_type",
        "ALTER TABLE managed_devices ADD COLUMN device_platform",
        "ALTER TABLE device_push_tokens ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE device_push_tokens FORCE ROW LEVEL SECURITY",
        "ALTER TABLE push_delivery_logs ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE push_delivery_logs FORCE ROW LEVEL SECURITY",
        "device_push_tokens_tenant_isolation",
        "push_delivery_logs_tenant_isolation",
    ):
        assert expected in ddl, f"Expected migration 0005 DDL clause missing: {expected}"


# ---------------------------------------------------------------------------
# Live PostgreSQL + Redis Integration Tests
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.skipif(not LIVE_INTEGRATION, reason="Requires live PostgreSQL & Redis")
@pytest.mark.asyncio
async def test_live_desktop_mobile_auth_mfa_sso_policy_and_web_compat(
    client: httpx.AsyncClient,
) -> None:
    suffix = uuid.uuid4().hex[:8]
    password = "Enterprise#Password2026!"

    # Bootstrap Org + Super Admin (legacy web call without native headers — verifies API compatibility)
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": f"admin_{suffix}@native.example.com",
            "password": password,
            "full_name": "Native Test Admin",
            "company_name": f"Native Corp {suffix}",
            "company_slug": f"native-{suffix}",
            "company_code": f"NAT{suffix[:4].upper()}",
        },
    )
    assert reg.status_code == 201, reg.text
    org_id = reg.json()["organization_id"]
    admin_headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
    assert reg.json()["client_type"] == "web"
    assert reg.json()["client_platform"] == "web"

    # Provision employee account
    emp_email = f"eng_{suffix}@native.example.com"
    created = await client.post(
        f"/api/v1/organizations/{org_id}/members",
        headers=admin_headers,
        json={
            "email": emp_email,
            "full_name": "Field Engineer",
            "temporary_password": password,
            "portal_type": "employee",
            "role_slugs": ["pol-employee-ops"],
        },
    )
    assert created.status_code == 201, created.text
    emp_user_id = created.json()["user_id"]

    # 1. Desktop (Tauri / Windows) login
    desktop_headers = {
        "X-Scribble-Client-Type": "desktop",
        "X-Scribble-Client-Platform": "windows",
        "X-Scribble-App-Version": "2.1.0",
        "X-Scribble-App-Id": "com.njuretech.scribbleit.desktop",
        "X-Scribble-Device-Name": "CORP-WIN11-04",
    }
    desk_login = await client.post(
        "/api/v1/auth/login",
        headers=desktop_headers,
        json={"email": emp_email, "password": password, "portal_type": "employee"},
    )
    assert desk_login.status_code == 200, desk_login.text
    desk_data = desk_login.json()
    assert desk_data["client_type"] == "desktop"
    assert desk_data["client_platform"] == "windows"
    assert desk_data["session_id"]

    # 2. Mobile (React Native / iOS) login
    mobile_headers = {
        "X-Scribble-Client-Type": "mobile",
        "X-Scribble-Client-Platform": "ios",
        "X-Scribble-App-Version": "2.1.0",
        "X-Scribble-App-Id": "com.njuretech.scribbleit.mobile",
        "X-Scribble-Device-Name": "iPhone 16 Pro",
    }
    mob_login = await client.post(
        "/api/v1/auth/login",
        headers=mobile_headers,
        json={"email": emp_email, "password": password, "portal_type": "employee"},
    )
    assert mob_login.status_code == 200, mob_login.text
    mob_data = mob_login.json()
    assert mob_data["client_type"] == "mobile"
    assert mob_data["client_platform"] == "ios"

    # Sessions list reflects desktop and mobile metadata accurately
    sess_resp = await client.get(
        "/api/v1/auth/sessions",
        headers={"Authorization": f"Bearer {mob_data['access_token']}", **mobile_headers},
    )
    assert sess_resp.status_code == 200, sess_resp.text
    sessions = sess_resp.json()["items"]
    platforms = {(s["client_type"], s["client_platform"], s["app_version"]) for s in sessions}
    assert ("desktop", "windows", "2.1.0") in platforms
    assert ("mobile", "ios", "2.1.0") in platforms

    # 3. Enroll MFA TOTP and verify mobile login enforces MFA
    mfa_enroll = await client.post(
        "/api/v1/auth/mfa/enroll",
        headers={"Authorization": f"Bearer {mob_data['access_token']}"},
    )
    assert mfa_enroll.status_code == 200, mfa_enroll.text
    totp_secret = mfa_enroll.json()["secret"]
    mfa_verify = await client.post(
        "/api/v1/auth/mfa/verify",
        headers={"Authorization": f"Bearer {mob_data['access_token']}"},
        json={"code": generate_totp_code(totp_secret)},
    )
    assert mfa_verify.status_code == 204, mfa_verify.text

    mob_no_mfa = await client.post(
        "/api/v1/auth/login",
        headers=mobile_headers,
        json={"email": emp_email, "password": password, "portal_type": "employee"},
    )
    assert mob_no_mfa.status_code == 401

    mob_with_mfa = await client.post(
        "/api/v1/auth/login",
        headers=mobile_headers,
        json={
            "email": emp_email,
            "password": password,
            "portal_type": "employee",
            "totp_code": generate_totp_code(totp_secret),
        },
    )
    assert mob_with_mfa.status_code == 200, mob_with_mfa.text

    # 4. Enforce org sso_only policy and verify password login is blocked on native desktop client
    policy_upd = await client.patch(
        f"/api/v1/iam/members/{emp_user_id}/roles",
        headers=admin_headers,
        json={"role_slugs": ["pol-employee-ops"], "sso_only": True},
    )
    assert policy_upd.status_code == 204, policy_upd.text

    blocked_desk = await client.post(
        "/api/v1/auth/login",
        headers=desktop_headers,
        json={
            "email": emp_email,
            "password": password,
            "portal_type": "employee",
            "totp_code": generate_totp_code(totp_secret),
        },
    )
    assert blocked_desk.status_code == 401


@pytest.mark.integration
@pytest.mark.skipif(not LIVE_INTEGRATION, reason="Requires live PostgreSQL & Redis")
@pytest.mark.asyncio
async def test_live_concurrent_refresh_requests_and_token_reuse_detection(
    client: httpx.AsyncClient,
    test_settings: Settings,
) -> None:
    suffix = uuid.uuid4().hex[:8]
    password = "Enterprise#Password2026!"

    reg = await client.post(
        "/api/v1/auth/register",
        headers={
            "X-Scribble-Client-Type": "desktop",
            "X-Scribble-Client-Platform": "linux",
            "X-Scribble-App-Version": "2.1.0",
        },
        json={
            "email": f"conc_{suffix}@native.example.com",
            "password": password,
            "full_name": "Concurrency Tester",
            "company_name": f"Conc Corp {suffix}",
            "company_slug": f"conc-{suffix}",
            "company_code": f"CNC{suffix[:4].upper()}",
        },
    )
    assert reg.status_code == 201, reg.text
    refresh_token = reg.json()["refresh_token"]

    desktop_headers = {
        "X-Scribble-Client-Type": "desktop",
        "X-Scribble-Client-Platform": "linux",
        "X-Scribble-App-Version": "2.1.0",
    }

    # Cross-platform refresh mismatch must be denied
    mismatch = await client.post(
        "/api/v1/auth/refresh",
        headers={
            "X-Scribble-Client-Type": "mobile",
            "X-Scribble-Client-Platform": "android",
            "X-Scribble-App-Version": "2.1.0",
        },
        json={"refresh_token": refresh_token},
    )
    assert mismatch.status_code == 401

    # Fire 2 concurrent refresh requests with the exact same refresh token.
    # SELECT ... FOR UPDATE serializes them so strictly 1 rotates & succeeds while the 2nd detects reuse.
    resp1, resp2 = await asyncio.gather(
        client.post(
            "/api/v1/auth/refresh",
            headers=desktop_headers,
            json={"refresh_token": refresh_token},
        ),
        client.post(
            "/api/v1/auth/refresh",
            headers=desktop_headers,
            json={"refresh_token": refresh_token},
        ),
    )
    statuses = sorted([resp1.status_code, resp2.status_code])
    assert statuses == [200, 401], f"Expected [200, 401] under concurrent refresh, got {statuses}"

    winner = resp1 if resp1.status_code == 200 else resp2
    rotated_refresh = winner.json()["refresh_token"]
    rotated_access = winner.json()["access_token"]

    # Because reuse was detected on the concurrent replay, the entire token family must now be revoked.
    after_me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {rotated_access}"},
    )
    assert after_me.status_code == 401

    after_refresh = await client.post(
        "/api/v1/auth/refresh",
        headers=desktop_headers,
        json={"refresh_token": rotated_refresh},
    )
    assert after_refresh.status_code == 401

    # Verify audit event persisted
    db_mgr = DatabaseManager()
    db_mgr.init(test_settings)
    try:
        async with db_mgr.session_factory() as db:
            await enable_transaction_platform_lookup(db)
            audit_rows = (
                await db.execute(
                    select(AuditLog).where(AuditLog.action == "REFRESH_TOKEN_REUSE_DETECTED")
                )
            ).scalars().all()
            assert len(audit_rows) >= 1
    finally:
        await db_mgr.close()


@pytest.mark.integration
@pytest.mark.skipif(not LIVE_INTEGRATION, reason="Requires live PostgreSQL & Redis")
@pytest.mark.asyncio
async def test_live_native_device_trust_iam_enrollment_and_mdm_separation(
    client: httpx.AsyncClient,
) -> None:
    suffix = uuid.uuid4().hex[:8]
    password = "Enterprise#Password2026!"

    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": f"root_{suffix}@devtrust.example.com",
            "password": password,
            "full_name": "Root Admin",
            "company_name": f"DevTrust Corp {suffix}",
            "company_slug": f"devtrust-{suffix}",
            "company_code": f"DVT{suffix[:4].upper()}",
        },
    )
    assert reg.status_code == 201, reg.text
    org_id = reg.json()["organization_id"]
    admin_headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    # Provision IAM Officer and Employee
    iam_email = f"iam_{suffix}@devtrust.example.com"
    emp_email = f"emp_{suffix}@devtrust.example.com"
    for email, portal, roles in (
        (iam_email, "iam", ["pol-iam-admin"]),
        (emp_email, "employee", ["pol-employee-ops"]),
    ):
        r = await client.post(
            f"/api/v1/organizations/{org_id}/members",
            headers=admin_headers,
            json={
                "email": email,
                "full_name": f"User {portal}",
                "temporary_password": password,
                "portal_type": portal,
                "role_slugs": roles,
            },
        )
        assert r.status_code == 201, r.text

    iam_login = await client.post(
        "/api/v1/auth/login",
        json={"email": iam_email, "password": password, "portal_type": "iam"},
    )
    assert iam_login.status_code == 200, iam_login.text
    iam_headers = {"Authorization": f"Bearer {iam_login.json()['access_token']}"}

    macos_headers = {
        "X-Scribble-Client-Type": "desktop",
        "X-Scribble-Client-Platform": "macos",
        "X-Scribble-App-Version": "2.1.0",
        "X-Scribble-App-Id": "com.njuretech.scribbleit.desktop",
    }
    emp_login = await client.post(
        "/api/v1/auth/login",
        headers=macos_headers,
        json={"email": emp_email, "password": password, "portal_type": "employee"},
    )
    assert emp_login.status_code == 200, emp_login.text
    emp_headers = {"Authorization": f"Bearer {emp_login.json()['access_token']}", **macos_headers}

    # 1. Employee cannot self-enroll without a valid IAM-issued code
    bad_enroll = await client.post(
        "/api/v1/auth/device/enroll",
        headers=emp_headers,
        json={
            "enrollment_code": "IAM-FAKE-9999",
            "hostname": "macbook-eng-01",
            "os_platform": "macOS 15.1",
            "device_fingerprint": "fp-native-macos-0123456789abcdef",
            "client_type": "desktop",
            "device_platform": "macos",
            "app_version": "2.1.0",
            "os_version": "15.1",
            "device_model": "MacBookPro18,3",
        },
    )
    assert bad_enroll.status_code == 422

    # 2. IAM officer issues single-use enrollment code
    code_resp = await client.post(
        "/api/v1/iam/device-codes",
        headers=iam_headers,
        json={"assigned_email": emp_email, "target_hostname": "macbook-eng-01", "mdm_provider": "Jamf Pro"},
    )
    assert code_resp.status_code == 201, code_resp.text
    raw_code = code_resp.json()["enrollment_code"]

    # 3. Employee enrolls native macOS desktop device using IAM code
    enroll = await client.post(
        "/api/v1/auth/device/enroll",
        headers=emp_headers,
        json={
            "enrollment_code": raw_code,
            "hostname": "macbook-eng-01",
            "os_platform": "macOS 15.1",
            "device_fingerprint": "fp-native-macos-0123456789abcdef",
            "client_type": "desktop",
            "device_platform": "macos",
            "app_version": "2.1.0",
            "os_version": "15.1",
            "device_model": "MacBookPro18,3",
        },
    )
    assert enroll.status_code == 201, enroll.text
    dev = enroll.json()
    assert dev["client_type"] == "desktop"
    assert dev["device_platform"] == "macos"
    assert dev["app_version"] == "2.1.0"
    assert dev["os_version"] == "15.1"
    assert dev["device_model"] == "MacBookPro18,3"
    # Fingerprint enrollment NEVER equals independent MDM attestation
    assert dev["trust_level"] == "registered_iam_code"
    assert dev["mdm_verified"] is False
    device_id = dev["device_id"]

    # Visible in user's own devices endpoint
    my_devs = await client.get("/api/v1/auth/devices", headers=emp_headers)
    assert my_devs.status_code == 200, my_devs.text
    assert my_devs.json()["total"] == 1
    assert my_devs.json()["items"][0]["id"] == device_id
    assert my_devs.json()["items"][0]["mdm_verified"] is False

    # 4. Employee cannot self-attest MDM
    unauth_attest = await client.post(
        f"/api/v1/iam/devices/{device_id}/verify-mdm",
        headers=emp_headers,
        json={"mdm_provider": "Jamf Pro", "mdm_authority_ref": "JAMF-SERIAL-999"},
    )
    assert unauth_attest.status_code == 403

    # 5. IAM Officer independently attests device against MDM authority
    attested = await client.post(
        f"/api/v1/iam/devices/{device_id}/verify-mdm",
        headers=iam_headers,
        json={"mdm_provider": "Jamf Pro", "mdm_authority_ref": "JAMF-SERIAL-999"},
    )
    assert attested.status_code == 200, attested.text
    assert attested.json()["trust_level"] == "mdm_verified"
    assert attested.json()["mdm_verified"] is True


@pytest.mark.integration
@pytest.mark.skipif(not LIVE_INTEGRATION, reason="Requires live PostgreSQL & Redis")
@pytest.mark.asyncio
async def test_live_push_tokens_tenant_isolation_logout_and_worker_retries(
    client: httpx.AsyncClient,
    test_settings: Settings,
    org_a_headers: dict[str, str],
    org_b_headers: dict[str, str],
    requester_headers: dict[str, str],
    unauthorized_headers: dict[str, str],
    employee_user_id: str,
) -> None:
    raw_fcm_token = f"fcm_live_secret_token_{uuid.uuid4().hex}_abcdef012345"
    android_headers = {
        **requester_headers,
        "X-Scribble-Client-Type": "mobile",
        "X-Scribble-Client-Platform": "android",
        "X-Scribble-App-Version": "2.1.0",
        "X-Scribble-App-Id": "com.njuretech.scribbleit.mobile",
    }

    # 1. Register Android FCM push token for Employee in Org A
    reg = await client.post(
        "/api/v1/notifications/push-tokens",
        headers=android_headers,
        json={
            "provider": "fcm",
            "platform": "android",
            "push_token": raw_fcm_token,
            "app_id": "com.njuretech.scribbleit.mobile",
            "app_version": "2.1.0",
            "device_name": "Pixel 9 Pro",
        },
    )
    assert reg.status_code == 201, reg.text
    token_data = reg.json()
    token_id = token_data["id"]
    assert token_data["provider"] == "fcm"
    assert token_data["platform"] == "android"
    assert token_data["status"] == "active"
    # Raw push token must NEVER appear in response body
    assert raw_fcm_token not in reg.text
    assert token_data["token_preview"].endswith(raw_fcm_token[-4:])

    # 2. Authorization failure: Another user in Org A (without iam:manage) cannot revoke Employee's token
    idor_del = await client.delete(
        f"/api/v1/notifications/push-tokens/{token_id}",
        headers=unauthorized_headers,
    )
    assert idor_del.status_code == 403

    # 3. Cross-tenant isolation: Org B user cannot list or revoke Org A's push token
    org_b_list = await client.get("/api/v1/notifications/push-tokens", headers=org_b_headers)
    assert org_b_list.status_code == 200
    assert org_b_list.json()["total"] == 0

    org_b_del = await client.delete(
        f"/api/v1/notifications/push-tokens/{token_id}",
        headers=org_b_headers,
    )
    assert org_b_del.status_code == 404

    # 4. Dispatch push notification to Employee in Org A -> creates PushDeliveryLog + BackgroundJob
    dispatch = await client.post(
        "/api/v1/notifications/push/dispatch",
        headers=org_a_headers,
        json={
            "target_user_ids": [employee_user_id],
            "title": "Critical Incident Assigned",
            "body": "INC-9001 requires immediate triage",
            "data": {"incident_code": "INC-9001"},
            "priority": "high",
            "max_attempts": 3,
        },
    )
    assert dispatch.status_code == 202, dispatch.text
    disp_body = dispatch.json()
    assert disp_body["queued_count"] == 1
    delivery_id = uuid.UUID(disp_body["delivery_ids"][0])
    job_id = uuid.UUID(disp_body["job_ids"][0])

    # Org B cannot see Org A's delivery logs (RLS isolation)
    org_b_logs = await client.get("/api/v1/notifications/push/deliveries", headers=org_b_headers)
    assert org_b_logs.status_code == 200
    assert org_b_logs.json()["total"] == 0

    # 5. Execute background worker with MockTransport: attempt 1 -> 503 (retrying), attempt 2 -> 200 (delivered)
    priv_pem, _pub_pem = _generate_rsa_pem()
    worker_settings = test_settings.model_copy(
        update={
            "fcm_project_id": "scribble-ci",
            "fcm_client_email": "push@scribble-ci.iam.gserviceaccount.com",
            "fcm_private_key": SecretStr(priv_pem),
        }
    )

    calls = {"count": 0}

    def flaky_then_ok(request: httpx.Request) -> httpx.Response:
        if "oauth2.googleapis.com" in str(request.url):
            return httpx.Response(200, json={"access_token": "ya29.worker-mock"})
        calls["count"] += 1
        if calls["count"] == 1:
            return httpx.Response(503, json={"error": {"status": "UNAVAILABLE", "message": "Transient"}})
        return httpx.Response(200, json={"name": "projects/scribble-ci/messages/m-200"})

    transport = httpx.MockTransport(flaky_then_ok)
    db_mgr = DatabaseManager()
    db_mgr.init(worker_settings)
    try:
        async with db_mgr.session_factory() as db:
            await enable_transaction_platform_lookup(db)
            job = (await db.execute(select(BackgroundJob).where(BackgroundJob.id == job_id))).scalar_one()
            outcome1 = await process_single_job(db, job, worker_settings, push_transport=transport)
            assert outcome1 == "retrying"
            delivery = (
                await db.execute(select(PushDeliveryLog).where(PushDeliveryLog.id == delivery_id))
            ).scalar_one()
            assert delivery.status == "retrying"
            assert delivery.next_retry_at is not None

            outcome2 = await process_single_job(db, job, worker_settings, push_transport=transport)
            assert outcome2 == "succeeded"
            await db.commit()
    finally:
        await db_mgr.close()

    # Confirm delivery log shows delivered via Org A API
    org_a_logs = await client.get("/api/v1/notifications/push/deliveries", headers=org_a_headers)
    assert org_a_logs.status_code == 200
    assert org_a_logs.json()["items"][0]["status"] == "delivered"
    assert org_a_logs.json()["items"][0]["provider_message_id"] == "projects/scribble-ci/messages/m-200"

    # 6. Logout revokes session AND session-bound push token automatically
    logout_resp = await client.post("/api/v1/auth/logout", headers=android_headers)
    assert logout_resp.status_code == 204

    # Revoked access token is immediately rejected
    post_logout_me = await client.get("/api/v1/auth/me", headers=android_headers)
    assert post_logout_me.status_code == 401

    # Verify push token row is marked revoked in DB
    db_mgr2 = DatabaseManager()
    db_mgr2.init(test_settings)
    try:
        async with db_mgr2.session_factory() as db:
            await enable_transaction_platform_lookup(db)
            tok_row = (
                await db.execute(select(DevicePushToken).where(DevicePushToken.id == uuid.UUID(token_id)))
            ).scalar_one()
            assert tok_row.status == "revoked"
            assert tok_row.revocation_reason == "user_logout"
    finally:
        await db_mgr2.close()
