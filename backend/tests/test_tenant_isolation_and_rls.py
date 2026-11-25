from __future__ import annotations

import os
import subprocess
import sys
import uuid
from pathlib import Path

import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.core.config import Settings
from app.core.security import reset_local_rate_limits
from app.db.session import DatabaseManager, set_transaction_tenant_context
from app.main import create_app

BACKEND_ROOT = Path(__file__).resolve().parents[1]
LIVE_INTEGRATION = os.getenv("RUN_LIVE_INTEGRATION_TESTS", "").lower() in {"1", "true", "yes"}


def test_alembic_phase2_ddl_includes_rls_and_immutable_audit_guards() -> None:
    """Offline DDL check verifying Phase 2 tables, FORCE ROW LEVEL SECURITY, and audit immutability."""
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
        "CREATE TABLE organizations",
        "CREATE TABLE organization_memberships",
        "CREATE TABLE device_enrollment_codes",
        "CREATE TABLE managed_devices",
        "CREATE TABLE device_trust_events",
        "CREATE TABLE approval_workflow_items",
        "CREATE TABLE cab_voting_seats",
        "CREATE TABLE audit_logs",
        "app.is_rls_bypassed",
        "ENABLE ROW LEVEL SECURITY",
        "FORCE ROW LEVEL SECURITY",
        "trg_audit_logs_immutable",
        "REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_logs FROM scribble_app",
    ):
        assert expected in ddl, f"Expected DDL clause missing: {expected}"


@pytest.mark.integration
@pytest.mark.skipif(not LIVE_INTEGRATION, reason="Requires live PostgreSQL & Redis")
@pytest.mark.asyncio
async def test_live_cross_tenant_isolation_rls_role_escalation_and_audit_immutability(
    test_settings: Settings,
) -> None:
    reset_local_rate_limits()
    app = create_app(settings_override=test_settings)
    db_mgr = DatabaseManager()
    db_mgr.init(test_settings)

    suffix = uuid.uuid4().hex[:8]
    password = "Enterprise#Password2026!"

    try:
        async with app.router.lifespan_context(app):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                # Bootstrap Super Admin + Org A
                reg = await client.post(
                    "/api/v1/auth/register",
                    json={
                        "email": f"root_{suffix}@platform.test",
                        "password": password,
                        "full_name": "Platform Super Admin",
                        "company_name": f"Tenant Alpha {suffix}",
                        "company_slug": f"alpha-{suffix}",
                        "company_code": f"ALP{suffix[:4].upper()}",
                    },
                )
                assert reg.status_code == 201, reg.text
                super_token = reg.json()["access_token"]
                org_a_id = reg.json()["organization_id"]
                super_headers = {"Authorization": f"Bearer {super_token}"}

                # Super Admin creates Org B
                org_b_resp = await client.post(
                    "/api/v1/organizations",
                    headers=super_headers,
                    json={
                        "name": f"Tenant Beta {suffix}",
                        "slug": f"beta-{suffix}",
                        "company_code": f"BET{suffix[:4].upper()}",
                        "domain": f"beta-{suffix}.test",
                        "primary_contact_email": f"ops@beta-{suffix}.test",
                    },
                )
                assert org_b_resp.status_code == 201, org_b_resp.text
                org_b_id = org_b_resp.json()["id"]

                # Create IAM Officer in Org A and Employee in Org A
                iam_a_email = f"iam_a_{suffix}@alpha.test"
                emp_a_email = f"emp_a_{suffix}@alpha.test"
                assert (
                    await client.post(
                        f"/api/v1/organizations/{org_a_id}/members",
                        headers=super_headers,
                        json={
                            "email": iam_a_email,
                            "full_name": "Alpha IAM",
                            "temporary_password": password,
                            "portal_type": "iam",
                            "role_slugs": ["pol-iam-admin"],
                        },
                    )
                ).status_code == 201

                assert (
                    await client.post(
                        f"/api/v1/organizations/{org_a_id}/members",
                        headers=super_headers,
                        json={
                            "email": emp_a_email,
                            "full_name": "Alpha Employee",
                            "temporary_password": password,
                            "portal_type": "employee",
                            "role_slugs": ["pol-employee-ops"],
                        },
                    )
                ).status_code == 201

                emp_login = await client.post(
                    "/api/v1/auth/login",
                    json={"email": emp_a_email, "password": password, "portal_type": "employee"},
                )
                emp_headers = {"Authorization": f"Bearer {emp_login.json()['access_token']}"}

                iam_login = await client.post(
                    "/api/v1/auth/login",
                    json={"email": iam_a_email, "password": password, "portal_type": "iam"},
                )
                iam_headers = {"Authorization": f"Bearer {iam_login.json()['access_token']}"}

                # 1. Cross-tenant header manipulation MUST fail with 403
                forged_header = dict(emp_headers)
                forged_header["X-Organization-ID"] = org_b_id
                assert (await client.get("/api/v1/auth/me", headers=forged_header)).status_code == 403

                # 2. Cross-tenant direct organization read MUST fail with 403
                assert (
                    await client.get(f"/api/v1/organizations/{org_b_id}", headers=emp_headers)
                ).status_code == 403

                # 3. Unauthorized tenant switching MUST fail with 403
                assert (
                    await client.post(
                        "/api/v1/organizations/switch",
                        headers=emp_headers,
                        json={"organization_id": org_b_id},
                    )
                ).status_code == 403

                # 4. Role escalation: IAM Officer CANNOT create a role containing tenants:admin
                esc_role = await client.post(
                    "/api/v1/iam/roles",
                    headers=iam_headers,
                    json={
                        "slug": f"sneaky-admin-{suffix}",
                        "name": "Sneaky Admin",
                        "permission_scopes": ["iam:manage", "tenants:admin"],
                    },
                )
                assert esc_role.status_code == 403

                # 5. Unauthorized Super Admin operations MUST fail with 403 for Employee & IAM
                for non_super in (emp_headers, iam_headers):
                    assert (
                        await client.patch(
                            f"/api/v1/organizations/{org_a_id}",
                            headers=non_super,
                            json={"name": "Hijacked Corp"},
                        )
                    ).status_code == 403
                    assert (
                        await client.patch(
                            f"/api/v1/governance/organizations/{org_a_id}/branding",
                            headers=non_super,
                            json={"logo_storage_key": "logos/hijacked.png"},
                        )
                    ).status_code == 403
                    assert (
                        await client.post(
                            "/api/v1/governance/database/operations",
                            headers=non_super,
                            json={
                                "operation": "export_snapshot",
                                "confirmation_phrase": "CONFIRM_SNAPSHOT_EXPORT",
                                "reason": "Unauthorized dump",
                            },
                        )
                    ).status_code == 403

                # 6. Direct PostgreSQL RLS verification under restricted scribble_app role
                async with db_mgr.session_factory() as db:
                    await set_transaction_tenant_context(db, uuid.UUID(org_b_id))
                    leaked_memberships = (
                        await db.execute(
                            text(
                                "SELECT count(*) FROM organization_memberships WHERE organization_id = :org_a"
                            ),
                            {"org_a": org_a_id},
                        )
                    ).scalar_one()
                    assert leaked_memberships == 0, "PostgreSQL RLS failed to isolate Org A rows from Org B context!"

                # 7. Immutable audit_logs verification (UPDATE & DELETE must fail at PostgreSQL layer)
                async with db_mgr.session_factory() as db:
                    with pytest.raises(DBAPIError):
                        await db.execute(text("DELETE FROM audit_logs"))
                    await db.rollback()

                    with pytest.raises(DBAPIError):
                        await db.execute(text("UPDATE audit_logs SET detail = 'tampered'"))
                    await db.rollback()
    finally:
        await db_mgr.close()
