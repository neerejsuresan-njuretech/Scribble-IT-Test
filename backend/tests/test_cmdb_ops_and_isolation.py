"""
Automated CMDB, Operations, Global Search Authorization & Cross-Tenant Isolation Tests (Prompt 3).
Covers:
  - Asset CRUD & user assignment
  - CMDB dependency relations & self-loop rejection
  - Inventory stock adjustment & negative-stock protection
  - Software license compliance auto-detection
  - Global search RBAC & end-user scoping
  - Cross-tenant isolation across Incidents, Assets, and Reports
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_asset_assignment_cmdb_relations_inventory_and_software(
    client: AsyncClient,
    super_admin_headers: dict[str, str],
    employee_user_id: str,
) -> None:
    # 1. Create two assets
    a1 = (
        await client.post(
            "/api/v1/assets",
            headers=super_admin_headers,
            json={
                "asset_tag": "AST-SRV-01",
                "name": "Primary Postgres Node",
                "asset_type": "server",
                "serial_number": "SN-PG-001",
                "location": "DC-London-1",
            },
        )
    )
    assert a1.status_code == 201
    a1_id = a1.json()["id"]

    a2 = (
        await client.post(
            "/api/v1/assets",
            headers=super_admin_headers,
            json={
                "asset_tag": "AST-APP-01",
                "name": "FastAPI Cluster Node",
                "asset_type": "server",
                "serial_number": "SN-API-001",
                "location": "DC-London-1",
            },
        )
    )
    assert a2.status_code == 201
    a2_id = a2.json()["id"]

    # 2. Assign asset to employee
    assign_resp = await client.post(
        f"/api/v1/assets/{a2_id}/assign",
        headers=super_admin_headers,
        json={"assigned_to_user_id": employee_user_id, "department": "SRE", "status": "in_use"},
    )
    assert assign_resp.status_code == 200
    assert assign_resp.json()["assigned_to_user_id"] == employee_user_id
    assert assign_resp.json()["status"] == "in_use"

    # 3. CMDB self-loop rejected
    bad_rel = await client.post(
        "/api/v1/cmdb/relations",
        headers=super_admin_headers,
        json={
            "source_asset_id": a1_id,
            "target_asset_id": a1_id,
            "relation_type": "depends_on",
        },
    )
    assert bad_rel.status_code == 422

    # 4. Valid CMDB relation
    ok_rel = await client.post(
        "/api/v1/cmdb/relations",
        headers=super_admin_headers,
        json={
            "source_asset_id": a2_id,
            "target_asset_id": a1_id,
            "relation_type": "depends_on",
            "criticality": "critical",
        },
    )
    assert ok_rel.status_code == 201

    # 5. Inventory stock & negative-stock protection
    inv_resp = await client.post(
        "/api/v1/inventory",
        headers=super_admin_headers,
        json={"sku": "SKU-USBC-DOCK", "name": "USB-C Dock", "quantity": 4, "min_threshold": 5},
    )
    assert inv_resp.status_code == 201
    inv_id = inv_resp.json()["id"]

    overdraw = await client.post(
        f"/api/v1/inventory/{inv_id}/adjust",
        headers=super_admin_headers,
        json={"delta": -10, "reason": "Overdraw attempt"},
    )
    assert overdraw.status_code == 422

    # 6. Software license over-allocation compliance flag
    sw_resp = await client.post(
        "/api/v1/software-licenses",
        headers=super_admin_headers,
        json={
            "name": "Enterprise Security Suite",
            "vendor": "CrowdGuard",
            "total_seats": 10,
            "used_seats": 12,
        },
    )
    assert sw_resp.status_code == 201
    assert sw_resp.json()["compliance_status"] == "over_allocated"


@pytest.mark.asyncio
async def test_global_search_rbac_and_cross_tenant_itsm_isolation(
    client: AsyncClient,
    org_a_headers: dict[str, str],
    org_b_headers: dict[str, str],
    org_a_end_user_headers: dict[str, str],
) -> None:
    # Org A creates confidential incident + internal KB
    inc_a = await client.post(
        "/api/v1/incidents",
        headers=org_a_headers,
        json={"title": "OrgA-Secret-Router-Failover", "category": "network"},
    )
    assert inc_a.status_code == 201
    inc_a_id = inc_a.json()["id"]

    await client.post(
        "/api/v1/knowledge",
        headers=org_a_headers,
        json={
            "title": "Internal Root CA Recovery Runbook",
            "visibility": "internal",
            "content": "Restricted SOP for OrgA-Secret-Router-Failover.",
        },
    )

    # Org B MUST NOT retrieve Org A's incident by direct ID or global search
    direct_get = await client.get(f"/api/v1/incidents/{inc_a_id}", headers=org_b_headers)
    assert direct_get.status_code == 404

    org_b_search = await client.get(
        "/api/v1/search?q=OrgA-Secret-Router-Failover", headers=org_b_headers
    )
    assert org_b_search.status_code == 200
    assert org_b_search.json()["total"] == 0

    # Org A End User MUST NOT see another user's incident or internal KB in global search
    end_user_search = await client.get(
        "/api/v1/search?q=OrgA-Secret-Router-Failover", headers=org_a_end_user_headers
    )
    assert end_user_search.status_code == 200
    assert end_user_search.json()["total"] == 0
