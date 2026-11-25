from __future__ import annotations

import os
import uuid

import httpx
import pytest
from sqlalchemy import select

from app.core.config import Settings
from app.core.security import reset_local_rate_limits
from app.db.models.audit import AuditLog
from app.db.session import DatabaseManager, enable_transaction_platform_lookup
from app.main import create_app

LIVE_INTEGRATION = os.getenv("RUN_LIVE_INTEGRATION_TESTS", "").lower() in {"1", "true", "yes"}


@pytest.mark.integration
@pytest.mark.skipif(not LIVE_INTEGRATION, reason="Requires live PostgreSQL & Redis")
@pytest.mark.asyncio
async def test_live_designated_approvals_cab_voting_and_governance_auditing(
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
                # Bootstrap Super Admin
                reg = await client.post(
                    "/api/v1/auth/register",
                    json={
                        "email": f"super_apv_{suffix}@corp.test",
                        "password": password,
                        "full_name": "Super Governance Admin",
                        "company_name": f"Governance Corp {suffix}",
                        "company_slug": f"gov-{suffix}",
                        "company_code": f"GOV{suffix[:4].upper()}",
                    },
                )
                assert reg.status_code == 201, reg.text
                super_headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
                org_id = reg.json()["organization_id"]

                # Provision Requester, Approver 1, Approver 2 (CAB), and Bystander
                async def add_user(prefix: str, role_slugs: list[str], portal: str = "employee") -> tuple[str, dict[str, str]]:
                    email = f"{prefix}_{suffix}@corp.test"
                    created = await client.post(
                        f"/api/v1/organizations/{org_id}/members",
                        headers=super_headers,
                        json={
                            "email": email,
                            "full_name": f"User {prefix}",
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

                req_id, req_headers = await add_user("requester", ["pol-employee-ops", "pol-approver-cab"])
                apv1_id, apv1_headers = await add_user("approver1", ["pol-approver-cab"])
                apv2_id, apv2_headers = await add_user("approver2", ["pol-approver-cab"])
                _bystander_id, bystander_headers = await add_user("bystander", ["pol-approver-cab"])

                # 1. Create Service Request approval item (Requester -> Approver 1)
                apv_item = await client.post(
                    "/api/v1/approvals/requests",
                    headers=req_headers,
                    json={
                        "subject_ref": f"REQ-{suffix}",
                        "title": "Production Kubernetes Admin Access",
                        "requester_user_id": req_id,
                        "assigned_approver_user_id": apv1_id,
                    },
                )
                assert apv_item.status_code == 201, apv_item.text
                approval_id = apv_item.json()["id"]

                # 2. Requester self-approval MUST be blocked (403) even though requester holds pol-approver-cab!
                self_apv = await client.post(
                    f"/api/v1/approvals/requests/{approval_id}/decision",
                    headers=req_headers,
                    json={"decision": "approved", "note": "Self approving"},
                )
                assert self_apv.status_code == 403

                # 3. Unauthorized bystander (even with requests:approve scope) CANNOT approve another's stage
                unauth_apv = await client.post(
                    f"/api/v1/approvals/requests/{approval_id}/decision",
                    headers=bystander_headers,
                    json={"decision": "approved", "note": "Unauthorized attempt"},
                )
                assert unauth_apv.status_code == 403

                # 4. Non-admin CANNOT reassign pending approver (403)
                bad_reassign = await client.post(
                    f"/api/v1/approvals/requests/{approval_id}/reassign",
                    headers=bystander_headers,
                    json={"new_approver_user_id": apv2_id, "reason": "Unauthorized reassign"},
                )
                assert bad_reassign.status_code == 403

                # 5. Super Admin reassigns pending approver from Approver 1 -> Approver 2 (retaining history)
                good_reassign = await client.post(
                    f"/api/v1/approvals/requests/{approval_id}/reassign",
                    headers=super_headers,
                    json={"new_approver_user_id": apv2_id, "reason": "Approver 1 out of office"},
                )
                assert good_reassign.status_code == 200
                hist = await client.get(
                    f"/api/v1/approvals/requests/{approval_id}/history",
                    headers=super_headers,
                )
                assert hist.status_code == 200
                assert len(hist.json()) == 2

                # 6. Designated Approver 2 approves -> 200; duplicate/conflicting vote -> 409
                ok_dec = await client.post(
                    f"/api/v1/approvals/requests/{approval_id}/decision",
                    headers=apv2_headers,
                    json={"decision": "approved", "note": "Verified business justification"},
                )
                assert ok_dec.status_code == 200
                assert ok_dec.json()["status"] == "approved"

                dup_dec = await client.post(
                    f"/api/v1/approvals/requests/{approval_id}/decision",
                    headers=apv2_headers,
                    json={"decision": "rejected", "note": "Conflicting second decision"},
                )
                assert dup_dec.status_code == 409

                # 7. CAB Voting Seat enforcement
                seat_resp = await client.post(
                    "/api/v1/approvals/cab-seats",
                    headers=req_headers,
                    json={
                        "change_ref": f"CHG-{suffix}",
                        "change_title": "Core Firewall Firmware Upgrade",
                        "seat_name": "Security Architecture Lead",
                        "requester_user_id": req_id,
                        "assigned_member_user_id": apv1_id,
                    },
                )
                assert seat_resp.status_code == 201, seat_resp.text
                seat_id = seat_resp.json()["id"]

                # Unauthorized member CANNOT vote on Approver 1's CAB seat (403)
                bad_vote = await client.post(
                    f"/api/v1/approvals/cab-seats/{seat_id}/vote",
                    headers=bystander_headers,
                    json={"vote": "approve", "comment": "Voting on behalf"},
                )
                assert bad_vote.status_code == 403

                # Reassign CAB seat retaining original_member_user_id & full history
                seat_reassign = await client.post(
                    f"/api/v1/approvals/cab-seats/{seat_id}/reassign",
                    headers=super_headers,
                    json={"new_member_user_id": apv2_id, "reason": "CAB delegate coverage"},
                )
                assert seat_reassign.status_code == 200
                assert seat_reassign.json()["original_member_user_id"] == apv1_id
                assert seat_reassign.json()["assigned_member_user_id"] == apv2_id

                cab_hist = await client.get(
                    f"/api/v1/approvals/cab-seats/{seat_id}/history",
                    headers=super_headers,
                )
                assert len(cab_hist.json()) == 2

                # Super Admin override requires explicit reason & emits CAB_VOTE_SUPER_ADMIN_OVERRIDE audit
                override_no_reason = await client.post(
                    f"/api/v1/approvals/cab-seats/{seat_id}/vote",
                    headers=super_headers,
                    json={"vote": "approve", "override": True},
                )
                assert override_no_reason.status_code == 422

                override_ok = await client.post(
                    f"/api/v1/approvals/cab-seats/{seat_id}/vote",
                    headers=super_headers,
                    json={
                        "vote": "approve",
                        "override": True,
                        "override_reason": "Emergency P1 security patch executive approval",
                    },
                )
                assert override_ok.status_code == 200
                assert override_ok.json()["override_used"] is True

                # 8. Super Admin Governance operations succeed & emit audit events
                brand_resp = await client.patch(
                    f"/api/v1/governance/organizations/{org_id}/branding",
                    headers=super_headers,
                    json={
                        "logo_storage_key": f"tenants/{org_id}/logo.png",
                        "portal_branding": {"employees": {"portalName": "Gov Ops"}},
                    },
                )
                assert brand_resp.status_code == 200

                db_op = await client.post(
                    "/api/v1/governance/database/operations",
                    headers=super_headers,
                    json={
                        "operation": "export_snapshot",
                        "confirmation_phrase": "CONFIRM_SNAPSHOT_EXPORT",
                        "reason": "Quarterly compliance archive",
                    },
                )
                assert db_op.status_code == 200

                # 9. Verify all governance & approval audit events are persisted
                async with db_mgr.session_factory() as db:
                    await enable_transaction_platform_lookup(db)
                    actions = set(
                        (
                            await db.execute(
                                select(AuditLog.action).where(AuditLog.organization_id == uuid.UUID(org_id))
                            )
                        ).scalars().all()
                    )
                    for expected in {
                        "APPROVAL_SELF_APPROVAL_BLOCKED",
                        "APPROVAL_UNAUTHORIZED_ATTEMPT",
                        "APPROVAL_REASSIGNED",
                        "APPROVAL_DECISION_RECORDED",
                        "CAB_VOTE_UNAUTHORIZED_ATTEMPT",
                        "CAB_SEAT_REASSIGNED",
                        "CAB_VOTE_SUPER_ADMIN_OVERRIDE",
                        "ORGANIZATION_BRANDING_UPDATED",
                        "PLATFORM_DB_OPERATION_AUTHORIZED",
                    }:
                        assert expected in actions, f"Missing audit event: {expected}"
    finally:
        await db_mgr.close()
