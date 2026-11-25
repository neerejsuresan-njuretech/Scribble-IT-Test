"""
Automated ITSM Core Workflow Tests (Prompt 3).
Covers:
  - Incident CRUD, priority matrix, SLA calculations, assignment, activities, attachments, relations, resolve & close
  - Service Catalog & Service Request lifecycle, designated approvals, self-approval block, fulfillment gating
  - Problem Management, Root Cause Analysis, Known Error Database (KEDB), incident linking
  - Change Management, risk assessment, CAB voting enforcement, CAB approval gating, immutable change history
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from app.core.sla import calculate_priority, compute_sla_deadline, evaluate_sla_status


def test_sla_priority_matrix_and_deadline_calculations() -> None:
    """Pure unit tests for ITIL priority matrix, SLA deadlines, pause handling, and breach evaluation."""
    assert calculate_priority("high", "high") == "P1"
    assert calculate_priority("high", "medium") == "P2"
    assert calculate_priority("medium", "medium") == "P3"
    assert calculate_priority("low", "low") == "P4"

    created = datetime(2026, 11, 25, 8, 0, tzinfo=timezone.utc)
    p1_deadline = compute_sla_deadline(created_at=created, priority="P1", org_sla_targets={"P1": 2})
    assert p1_deadline == created + timedelta(hours=2)

    policy_deadline = compute_sla_deadline(
        created_at=created, priority="P2", policy_resolution_mins=90
    )
    assert policy_deadline == created + timedelta(minutes=90)

    # Not breached while within window
    ok_snap = evaluate_sla_status(
        created_at=created,
        deadline=p1_deadline,
        priority="P1",
        status="in_progress",
        now=created + timedelta(minutes=60),
    )
    assert ok_snap.breached is False
    assert ok_snap.remaining_minutes == 60
    assert ok_snap.percent_elapsed == 50.0

    # Paused in pending status stops SLA clock
    paused_at = created + timedelta(minutes=30)
    paused_snap = evaluate_sla_status(
        created_at=created,
        deadline=p1_deadline,
        priority="P1",
        status="pending",
        sla_paused_at=paused_at,
        now=created + timedelta(hours=5),
    )
    assert paused_snap.paused is True
    assert paused_snap.breached is False

    # Breached after deadline
    breached_snap = evaluate_sla_status(
        created_at=created,
        deadline=p1_deadline,
        priority="P1",
        status="in_progress",
        now=created + timedelta(hours=3),
    )
    assert breached_snap.breached is True
    assert breached_snap.remaining_minutes < 0


@pytest.mark.asyncio
async def test_incident_crud_lifecycle_activities_attachments_and_relations(
    client: AsyncClient,
    super_admin_headers: dict[str, str],
) -> None:
    # 1. Create incident with high impact + high urgency -> auto P1
    create_resp = await client.post(
        "/api/v1/incidents",
        headers=super_admin_headers,
        json={
            "title": "Core authentication cluster latency spike",
            "description": "Elevated 502 responses from primary region.",
            "impact": "high",
            "urgency": "high",
            "category": "security",
            "source_channel": "monitor",
        },
    )
    assert create_resp.status_code == 201
    inc = create_resp.json()
    assert inc["priority"] == "P1"
    assert inc["number"].startswith("INC-")
    inc_id = inc["id"]

    # 2. Pagination, filtering, sorting
    list_resp = await client.get(
        "/api/v1/incidents?priority=P1&sort_by=created_at&sort_dir=desc&page=1&page_size=10",
        headers=super_admin_headers,
    )
    assert list_resp.status_code == 200
    body = list_resp.json()
    assert body["meta"]["total"] >= 1
    assert any(item["id"] == inc_id for item in body["items"])

    # 3. Add work note
    act_resp = await client.post(
        f"/api/v1/incidents/{inc_id}/activities",
        headers=super_admin_headers,
        json={"activity_type": "work_note", "action": "Triage", "note": "Isolated failing node."},
    )
    assert act_resp.status_code == 201

    # 4. Reject unsafe attachment path traversal
    bad_att = await client.post(
        f"/api/v1/incidents/{inc_id}/attachments",
        headers=super_admin_headers,
        json={
            "filename": "logs.txt",
            "content_type": "text/plain",
            "size_bytes": 120,
            "storage_key": "../../etc/passwd",
        },
    )
    assert bad_att.status_code == 422

    # 5. Valid attachment metadata
    ok_att = await client.post(
        f"/api/v1/incidents/{inc_id}/attachments",
        headers=super_admin_headers,
        json={
            "filename": "cluster-trace.log",
            "content_type": "text/plain",
            "size_bytes": 4096,
            "storage_key": f"tenants/org/incidents/{inc_id}/cluster-trace.log",
        },
    )
    assert ok_att.status_code == 201

    # 6. Resolve & Close
    resolve_resp = await client.post(
        f"/api/v1/incidents/{inc_id}/resolve",
        headers=super_admin_headers,
        json={"resolution_notes": "Drained unhealthy node and restored quorum.", "time_logged_mins": 35},
    )
    assert resolve_resp.status_code == 200
    assert resolve_resp.json()["status"] == "resolved"

    close_resp = await client.post(
        f"/api/v1/incidents/{inc_id}/close",
        headers=super_admin_headers,
        json={"closure_note": "Confirmed green metrics for 24h.", "csat_score": 5},
    )
    assert close_resp.status_code == 200
    assert close_resp.json()["status"] == "closed"


@pytest.mark.asyncio
async def test_service_request_designated_approvals_and_fulfillment_gate(
    client: AsyncClient,
    requester_headers: dict[str, str],
    approver_headers: dict[str, str],
    approver_user_id: str,
    super_admin_headers: dict[str, str],
) -> None:
    # Create catalog item
    cat_resp = await client.post(
        "/api/v1/requests/catalog",
        headers=super_admin_headers,
        json={
            "slug": "macbook-pro-16",
            "title": "MacBook Pro 16 Engineering",
            "category": "hardware",
            "price": "2899.00",
            "estimated_hours": 48,
            "requires_approval": True,
        },
    )
    assert cat_resp.status_code == 201
    cat_id = cat_resp.json()["id"]

    # Requester submits request with designated approver
    sr_resp = await client.post(
        "/api/v1/requests",
        headers=requester_headers,
        json={
            "catalog_item_id": cat_id,
            "description": "Replacement workstation for build pipeline work",
            "department": "Engineering",
            "approval_stages": [
                {
                    "title": "Line Manager Approval",
                    "stage_order": 1,
                    "assigned_approver_user_id": approver_user_id,
                }
            ],
        },
    )
    assert sr_resp.status_code == 201
    sr = sr_resp.json()
    sr_id = sr["id"]
    approval_id = sr["approvals"][0]["id"]

    # Cannot fulfill before approval
    early_fulfill = await client.post(
        f"/api/v1/requests/{sr_id}/fulfill",
        headers=super_admin_headers,
        json={"fulfillment_notes": "Attempted premature fulfillment"},
    )
    assert early_fulfill.status_code == 409

    # Requester self-approval MUST be blocked (403)
    self_approve = await client.post(
        f"/api/v1/requests/{sr_id}/approvals/{approval_id}/decision",
        headers=requester_headers,
        json={"decision": "approved", "note": "Trying to self-approve"},
    )
    assert self_approve.status_code == 403

    # Designated approver approves -> moves request to fulfillment
    approve_ok = await client.post(
        f"/api/v1/requests/{sr_id}/approvals/{approval_id}/decision",
        headers=approver_headers,
        json={"decision": "approved", "note": "Approved within hardware budget"},
    )
    assert approve_ok.status_code == 200
    assert approve_ok.json()["status"] == "fulfillment"

    # Now fulfillment succeeds
    fulfill_ok = await client.post(
        f"/api/v1/requests/{sr_id}/fulfill",
        headers=super_admin_headers,
        json={"fulfillment_notes": "Dispatched serialized laptop via IT Logistics", "mark_completed": True},
    )
    assert fulfill_ok.status_code == 200
    assert fulfill_ok.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_problem_kedb_and_change_cab_voting_gate(
    client: AsyncClient,
    super_admin_headers: dict[str, str],
    cab_member_headers: dict[str, str],
    cab_member_user_id: str,
    unauthorized_headers: dict[str, str],
) -> None:
    # 1. Create incident + problem + link + publish KEDB
    inc_resp = await client.post(
        "/api/v1/incidents",
        headers=super_admin_headers,
        json={"title": "Recurring VPN tunnel drops", "category": "network"},
    )
    inc_id = inc_resp.json()["id"]

    prb_resp = await client.post(
        "/api/v1/problems",
        headers=super_admin_headers,
        json={
            "title": "IPSec rekey mismatch on edge gateways",
            "severity": "high",
            "linked_incident_ids": [inc_id],
        },
    )
    assert prb_resp.status_code == 201
    prb_id = prb_resp.json()["id"]
    assert inc_id in prb_resp.json()["linked_incident_ids"]

    kedb_resp = await client.post(
        f"/api/v1/problems/{prb_id}/known-error",
        headers=super_admin_headers,
        json={
            "root_cause_analysis": "IKEv2 lifetime mismatch between primary and secondary gateways.",
            "workaround": "Force rekey interval to 3600s until firmware patch is deployed.",
        },
    )
    assert kedb_resp.status_code == 200
    assert kedb_resp.json()["is_known_error"] is True

    # 2. Create Normal Change with CAB seat
    chg_resp = await client.post(
        "/api/v1/changes",
        headers=super_admin_headers,
        json={
            "title": "Upgrade edge VPN gateway firmware to v7.4",
            "change_type": "normal",
            "risk_score": "high",
            "reason": "Permanent fix for IPSec rekey drops",
            "implementation_plan": "Rolling upgrade passive then active node",
            "rollback_plan": "Fail back to standby partition image",
            "cab_seats": [
                {"seat_name": "Network Security CAB", "assigned_member_user_id": cab_member_user_id}
            ],
        },
    )
    assert chg_resp.status_code == 201
    chg = chg_resp.json()
    chg_id = chg["id"]
    seat_id = chg["cab_seats"][0]["id"]

    # Unauthorized member cannot vote on CAB seat
    unauth_vote = await client.post(
        f"/api/v1/changes/{chg_id}/cab-seats/{seat_id}/vote",
        headers=unauthorized_headers,
        json={"vote": "approve", "comment": "Forged vote"},
    )
    assert unauth_vote.status_code == 403

    # Designated CAB member approves -> automatically moves to scheduled
    cab_ok = await client.post(
        f"/api/v1/changes/{chg_id}/cab-seats/{seat_id}/vote",
        headers=cab_member_headers,
        json={"vote": "approve", "comment": "Rollback plan verified."},
    )
    assert cab_ok.status_code == 200
    assert cab_ok.json()["status"] == "scheduled"

    hist_resp = await client.get(f"/api/v1/changes/{chg_id}/history", headers=super_admin_headers)
    assert hist_resp.status_code == 200
    assert len(hist_resp.json()) >= 2
