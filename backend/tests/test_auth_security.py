from __future__ import annotations

import os
import re
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import jwt
import pytest
from pydantic import ValidationError
from sqlalchemy import select, update

from app.core.config import Settings
from app.core.exceptions import AuthenticationError, RateLimitError
from app.core.permissions import (
    PORTAL_EMPLOYEE,
    PORTAL_END_USER,
    PORTAL_IAM,
    PORTAL_SUPER_ADMIN,
    compute_effective_permissions,
)
from app.core.security import (
    create_access_token,
    decode_access_token,
    decrypt_mfa_secret,
    encrypt_mfa_secret,
    enforce_rate_limit,
    generate_backup_codes,
    generate_device_enrollment_code,
    generate_totp_code,
    generate_totp_secret,
    hash_password,
    hash_token,
    reset_local_rate_limits,
    verify_password,
    verify_totp_code,
)
from app.db.models.audit import AuditLog
from app.db.models.device_trust import DeviceEnrollmentCode
from app.db.models.identity import UserSession
from app.db.session import DatabaseManager, enable_transaction_platform_lookup
from app.main import create_app
from app.modules.auth.schemas import LoginRequest, RegisterRequest

LIVE_INTEGRATION = os.getenv("RUN_LIVE_INTEGRATION_TESTS", "").lower() in {"1", "true", "yes"}


# ---------------------------------------------------------------------------
# Unit Tests: Cryptography, Tokens, MFA, Rate Limiting & Mass Assignment
# ---------------------------------------------------------------------------


def test_argon2id_password_hashing_and_verification() -> None:
    raw = "Enterprise!Passphrase#2026"
    digest = hash_password(raw)
    assert digest.startswith("$argon2id$")
    assert raw not in digest
    assert verify_password(raw, digest) is True
    assert verify_password("WrongPassword!123", digest) is False


def test_jwt_access_token_issuance_tampering_and_expiry(test_settings: Settings) -> None:
    uid, sid, oid, mid = uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    token, ttl = create_access_token(
        settings=test_settings,
        user_id=uid,
        session_id=sid,
        organization_id=oid,
        membership_id=mid,
        portal_type=PORTAL_EMPLOYEE,
    )
    assert ttl == test_settings.access_token_ttl_minutes * 60
    claims = decode_access_token(token, test_settings)
    assert claims["sub"] == str(uid)
    assert claims["org_id"] == str(oid)
    assert "roles" not in claims
    assert "permissions" not in claims

    # Tampered signature must fail
    tampered = token[:-4] + ("AAAA" if not token.endswith("AAAA") else "BBBB")
    with pytest.raises(AuthenticationError):
        decode_access_token(tampered, test_settings)

    # Expired token must fail
    expired_payload = dict(claims)
    expired_payload["exp"] = int((datetime.now(timezone.utc) - timedelta(minutes=5)).timestamp())
    expired_token = jwt.encode(
        expired_payload,
        test_settings.jwt_secret_key.get_secret_value(),
        algorithm=test_settings.jwt_algorithm,
    )
    with pytest.raises(AuthenticationError):
        decode_access_token(expired_token, test_settings)


def test_mfa_totp_encryption_and_backup_codes(test_settings: Settings) -> None:
    secret = generate_totp_secret()
    ciphertext = encrypt_mfa_secret(secret, test_settings)
    assert secret not in ciphertext
    assert decrypt_mfa_secret(ciphertext, test_settings) == secret

    code = generate_totp_code(secret)
    assert len(code) == 6 and code.isdigit()
    assert verify_totp_code(secret, code) is True
    assert verify_totp_code(secret, "000000") is False or code == "000000"

    plain_codes, hashed_codes = generate_backup_codes(8)
    assert len(plain_codes) == 8
    assert len(hashed_codes) == 8
    for raw, digest in zip(plain_codes, hashed_codes):
        assert hash_token(raw) == digest


def test_device_enrollment_code_format_and_hashing() -> None:
    code = generate_device_enrollment_code()
    assert re.fullmatch(r"IAM-[A-Z2-9]{4}-[A-Z2-9]{4}", code)
    assert hash_token(code) != code


@pytest.mark.asyncio
async def test_brute_force_rate_limit_enforcement() -> None:
    reset_local_rate_limits()
    for _ in range(3):
        await enforce_rate_limit(
            bucket="unit_login",
            identifier="user@example.com",
            max_requests=3,
            window_seconds=60,
        )
    with pytest.raises(RateLimitError):
        await enforce_rate_limit(
            bucket="unit_login",
            identifier="user@example.com",
            max_requests=3,
            window_seconds=60,
        )
    reset_local_rate_limits()


def test_mass_assignment_rejected_on_auth_schemas() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(
            email="attacker@example.com",
            password="StrongPassword!2026",
            full_name="Attacker",
            is_platform_super_admin=True,  # type: ignore[call-arg]
        )

    with pytest.raises(ValidationError):
        LoginRequest(
            email="attacker@example.com",
            password="StrongPassword!2026",
            permissions=["tenants:admin"],  # type: ignore[call-arg]
        )


def test_portal_permission_invariants() -> None:
    # Employee portal can NEVER gain devices:enroll_code or tenants:admin even if injected into role_scopes
    emp_perms = compute_effective_permissions(
        is_platform_super_admin=False,
        portal_type=PORTAL_EMPLOYEE,
        role_scopes={"incidents:read", "devices:enroll_code", "tenants:admin"},
    )
    assert "devices:enroll_code" not in emp_perms
    assert "tenants:admin" not in emp_perms

    # Super Admin portal retains tenants:admin but devices:enroll_code stays IAM Portal exclusive
    super_perms = compute_effective_permissions(
        is_platform_super_admin=True,
        portal_type=PORTAL_SUPER_ADMIN,
        role_scopes=set(),
    )
    assert "tenants:admin" in super_perms
    assert "devices:enroll_code" not in super_perms

    # IAM portal with scope receives devices:enroll_code, never tenants:admin
    iam_perms = compute_effective_permissions(
        is_platform_super_admin=False,
        portal_type=PORTAL_IAM,
        role_scopes={"iam:manage", "devices:enroll_code", "tenants:admin"},
    )
    assert "devices:enroll_code" in iam_perms
    assert "tenants:admin" not in iam_perms

    # End user portal stays strictly scoped
    end_perms = compute_effective_permissions(
        is_platform_super_admin=False,
        portal_type=PORTAL_END_USER,
        role_scopes={"incidents:read", "devices:enroll_code", "tenants:admin"},
    )
    assert end_perms == frozenset({"incidents:read"})


# ---------------------------------------------------------------------------
# Live PostgreSQL Integration Tests: Auth, Reuse Detection, Suspension, Device Trust
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.skipif(not LIVE_INTEGRATION, reason="Requires live PostgreSQL & Redis")
@pytest.mark.asyncio
async def test_live_auth_lifecycle_reuse_detection_suspension_and_device_trust(
    test_settings: Settings,
) -> None:
    reset_local_rate_limits()
    app = create_app(settings_override=test_settings)
    db_mgr = DatabaseManager()
    db_mgr.init(test_settings)

    suffix = uuid.uuid4().hex[:8]
    admin_email = f"super_{suffix}@acme-sec.example.com"
    iam_email = f"iam_{suffix}@acme-sec.example.com"
    emp_email = f"emp_{suffix}@acme-sec.example.com"
    password = "Enterprise#Password2026!"

    try:
        async with app.router.lifespan_context(app):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                # 1. Register bootstrap Super Admin or first tenant user
                reg = await client.post(
                    "/api/v1/auth/register",
                    json={
                        "email": admin_email,
                        "password": password,
                        "full_name": "Bootstrap Admin",
                        "company_name": f"Acme Sec {suffix}",
                        "company_slug": f"acme-{suffix}",
                        "company_code": f"ACM{suffix[:4].upper()}",
                    },
                )
                assert reg.status_code == 201, reg.text
                admin_data = reg.json()
                admin_headers = {"Authorization": f"Bearer {admin_data['access_token']}"}
                org_id = admin_data["organization_id"]

                # 2. Unauthorized login (bad password) -> 401 + audit event
                bad_login = await client.post(
                    "/api/v1/auth/login",
                    json={
                        "email": admin_email,
                        "password": "WrongPassword!999",
                        "portal_type": admin_data["portal_type"],
                    },
                )
                assert bad_login.status_code == 401

                # 3. Refresh-token rotation & reuse detection revokes entire token family
                ref1 = await client.post(
                    "/api/v1/auth/refresh",
                    json={"refresh_token": admin_data["refresh_token"]},
                )
                assert ref1.status_code == 200
                new_refresh = ref1.json()["refresh_token"]
                assert new_refresh != admin_data["refresh_token"]

                # Replay OLD refresh token -> must trigger family revocation (401)
                replay = await client.post(
                    "/api/v1/auth/refresh",
                    json={"refresh_token": admin_data["refresh_token"]},
                )
                assert replay.status_code == 401

                # Even the newer refresh token from the compromised family must now be revoked!
                post_replay = await client.post(
                    "/api/v1/auth/refresh",
                    json={"refresh_token": new_refresh},
                )
                assert post_replay.status_code == 401

                # Re-login cleanly
                relogin = await client.post(
                    "/api/v1/auth/login",
                    json={
                        "email": admin_email,
                        "password": password,
                        "portal_type": admin_data["portal_type"],
                    },
                )
                assert relogin.status_code == 200
                admin_headers = {"Authorization": f"Bearer {relogin.json()['access_token']}"}

                # 4. Provision IAM Officer & Employee via organization members API
                iam_create = await client.post(
                    f"/api/v1/organizations/{org_id}/members",
                    headers=admin_headers,
                    json={
                        "email": iam_email,
                        "full_name": "IAM Officer",
                        "temporary_password": password,
                        "portal_type": "iam",
                        "role_slugs": ["pol-iam-admin"],
                    },
                )
                assert iam_create.status_code == 201, iam_create.text

                emp_create = await client.post(
                    f"/api/v1/organizations/{org_id}/members",
                    headers=admin_headers,
                    json={
                        "email": emp_email,
                        "full_name": "Ops Engineer",
                        "temporary_password": password,
                        "portal_type": "employee",
                        "role_slugs": ["pol-employee-ops"],
                    },
                )
                assert emp_create.status_code == 201, emp_create.text
                emp_user_id = emp_create.json()["user_id"]

                # 5. Portal escalation blocked: Employee cannot login into IAM or Super Admin portal
                esc_login = await client.post(
                    "/api/v1/auth/login",
                    json={"email": emp_email, "password": password, "portal_type": "super_admin"},
                )
                assert esc_login.status_code == 403

                # Employee logs into Employee portal
                emp_login = await client.post(
                    "/api/v1/auth/login",
                    json={"email": emp_email, "password": password, "portal_type": "employee"},
                )
                assert emp_login.status_code == 200
                emp_headers = {"Authorization": f"Bearer {emp_login.json()['access_token']}"}

                # IAM officer logs into IAM portal
                iam_login = await client.post(
                    "/api/v1/auth/login",
                    json={"email": iam_email, "password": password, "portal_type": "iam"},
                )
                assert iam_login.status_code == 200
                iam_headers = {"Authorization": f"Bearer {iam_login.json()['access_token']}"}

                # 6. Device Trust: Non-IAM (employee & super admin) CANNOT mint enrollment codes
                assert (
                    await client.post("/api/v1/iam/device-codes", headers=emp_headers, json={})
                ).status_code == 403
                assert (
                    await client.post("/api/v1/iam/device-codes", headers=admin_headers, json={})
                ).status_code == 403

                # Unmanaged device cannot self-enroll with fake code
                fake_enroll = await client.post(
                    "/api/v1/auth/device/enroll",
                    headers=emp_headers,
                    json={
                        "enrollment_code": "IAM-FAKE-0000",
                        "hostname": "rogue-laptop",
                        "device_fingerprint": "fp-rogue-1234567890abcdef",
                    },
                )
                assert fake_enroll.status_code == 422

                # IAM officer generates single-use bound code
                code_resp = await client.post(
                    "/api/v1/iam/device-codes",
                    headers=iam_headers,
                    json={
                        "assigned_email": emp_email,
                        "mdm_provider": "Microsoft Intune",
                        "ttl_hours": 12,
                    },
                )
                assert code_resp.status_code == 201
                raw_code = code_resp.json()["enrollment_code"]
                assert re.fullmatch(r"IAM-[A-Z2-9]{4}-[A-Z2-9]{4}", raw_code)

                # Employee enrolls with valid code -> registered_iam_code (NOT yet mdm_verified!)
                enroll_resp = await client.post(
                    "/api/v1/auth/device/enroll",
                    headers=emp_headers,
                    json={
                        "enrollment_code": raw_code,
                        "hostname": "corp-macbook-01",
                        "device_fingerprint": "fp-corp-1234567890abcdef",
                    },
                )
                assert enroll_resp.status_code == 201
                enrolled = enroll_resp.json()
                assert enrolled["trust_level"] == "registered_iam_code"
                assert enrolled["mdm_verified"] is False

                # Reusing the same enrollment code MUST be rejected!
                reuse_enroll = await client.post(
                    "/api/v1/auth/device/enroll",
                    headers=emp_headers,
                    json={
                        "enrollment_code": raw_code,
                        "hostname": "corp-macbook-02",
                        "device_fingerprint": "fp-corp-second1234567890",
                    },
                )
                assert reuse_enroll.status_code == 422

                # Expired code MUST be rejected!
                exp_code_resp = await client.post(
                    "/api/v1/iam/device-codes",
                    headers=iam_headers,
                    json={"assigned_email": emp_email, "ttl_hours": 1},
                )
                exp_code_id = uuid.UUID(exp_code_resp.json()["id"])
                exp_raw_code = exp_code_resp.json()["enrollment_code"]
                async with db_mgr.session_factory() as db:
                    await enable_transaction_platform_lookup(db)
                    await db.execute(
                        update(DeviceEnrollmentCode)
                        .where(DeviceEnrollmentCode.id == exp_code_id)
                        .values(expires_at=datetime.now(timezone.utc) - timedelta(hours=1))
                    )
                    await db.commit()

                expired_enroll = await client.post(
                    "/api/v1/auth/device/enroll",
                    headers=emp_headers,
                    json={
                        "enrollment_code": exp_raw_code,
                        "hostname": "corp-macbook-03",
                        "device_fingerprint": "fp-corp-third12345678901",
                    },
                )
                assert expired_enroll.status_code == 422

                # 7. Suspend employee -> active session immediately rejected + login blocked
                susp = await client.patch(
                    f"/api/v1/iam/members/{emp_user_id}/suspend",
                    headers=iam_headers,
                )
                assert susp.status_code == 204
                assert (await client.get("/api/v1/auth/me", headers=emp_headers)).status_code == 401
                assert (
                    await client.post(
                        "/api/v1/auth/login",
                        json={"email": emp_email, "password": password, "portal_type": "employee"},
                    )
                ).status_code == 401

                # 8. Verify critical audit events were recorded (no missing audit events)
                async with db_mgr.session_factory() as db:
                    await enable_transaction_platform_lookup(db)
                    actions = set(
                        (
                            await db.execute(
                                select(AuditLog.action).where(AuditLog.organization_id == uuid.UUID(org_id))
                            )
                        ).scalars().all()
                    )
                    for expected_action in {
                        "USER_REGISTERED",
                        "REFRESH_TOKEN_REUSE_DETECTED",
                        "DEVICE_ENROLLMENT_CODE_GENERATED",
                        "DEVICE_ENROLLED",
                        "DEVICE_ENROLLMENT_CODE_REUSE_BLOCKED",
                        "DEVICE_ENROLLMENT_CODE_EXPIRED",
                        "USER_SUSPENDED",
                    }:
                        assert expected_action in actions, f"Missing audit event: {expected_action}"
    finally:
        await db_mgr.close()
