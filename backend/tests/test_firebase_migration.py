from __future__ import annotations

from app.migration.firebase_migrator import FirebaseToPostgresMigrator


def _sample_firebase_snapshot() -> dict:
    return {
        "tenants": [
            {"id": "tenant-acme", "name": "Acme Corp", "domain": "acme.com", "status": "Active"},
            {"id": "tenant-beta", "name": "Beta Health", "domain": "beta.org", "status": "Active"},
            {"id": "tenant-acme", "name": "Acme Corp Duplicate", "domain": "acme.com"},  # duplicate
            {"id": "", "name": "Invalid Missing ID"},  # rejected
        ],
        "incidents": [
            {
                "id": "INC-1001",
                "tenantId": "tenant-acme",
                "title": "Core VPN Tunnel Down",
                "priority": "P1",
                "status": "In Progress",
                "category": "Network",
                "requesterEmail": "alice@acme.com",
            },
            {
                "id": "INC-1001",
                "tenantId": "tenant-acme",
                "title": "Duplicate Incident",
                "priority": "P2",
            },
            {
                "id": "INC-2001",
                "tenantId": "tenant-beta",
                "title": "Beta EHR Slowness",
                "priority": "P2",
            },
            {
                "id": "INC-ORPHAN",
                "tenantId": "tenant-nonexistent",
                "title": "Orphaned Ticket",
            },
        ],
        "service_requests": [
            {
                "id": "REQ-501",
                "tenantId": "tenant-acme",
                "title": "MacBook Pro M4 Provisioning",
                "approvalStages": [
                    {"approverEmail": "manager@acme.com", "status": "approved"},
                    {"approverEmail": "itops@acme.com", "status": "pending"},
                ],
            }
        ],
        "module_state": {
            "authAccounts": [
                {
                    "id": "usr-1",
                    "tenantId": "tenant-acme",
                    "email": "alice@acme.com",
                    "name": "Alice Admin",
                    "role": "tenant_admin",
                    "portal": "employee",
                    "password": "InsecurePlaintextPassword123!",
                },
                {
                    "id": "usr-bad-email",
                    "tenantId": "tenant-acme",
                    "email": "not-an-email",
                    "password": "also-scrubbed-secret",
                },
            ],
            "iamPolicies": [
                {"id": "pol-1", "tenantId": "tenant-acme", "name": "L2 Technician", "permissions": ["incidents.write"]}
            ],
            "deviceEnrollmentCodes": [
                {"id": "code-1", "tenantId": "tenant-acme", "code": "SCRIB-9999", "status": "active"}
            ],
            "enrolledDevices": [
                {"id": "dev-1", "tenantId": "tenant-acme", "deviceName": "Alice-MBP", "fingerprint": "fp-abc"}
            ],
            "problems": [
                {
                    "id": "PRB-10",
                    "tenantId": "tenant-acme",
                    "title": "Recurring VPN Handshake Timeout",
                    "relatedIncidentIds": ["INC-1001", "INC-2001"],  # INC-2001 belongs to tenant-beta -> must reject!
                }
            ],
            "changes": [
                {
                    "id": "CHG-77",
                    "tenantId": "tenant-acme",
                    "title": "Upgrade Firewall Firmware",
                    "cabVotes": [
                        {"voterEmail": "cab1@acme.com", "vote": "approve"},
                        {"voterEmail": "cab2@acme.com", "vote": "approve"},
                    ],
                }
            ],
            "assets": [
                {"id": "AST-1", "tenantId": "tenant-acme", "name": "Edge Firewall 01"},
                {"id": "AST-2", "tenantId": "tenant-acme", "name": "Core Switch 01"},
                {"id": "AST-BETA-1", "tenantId": "tenant-beta", "name": "Beta DB 01"},
            ],
            "cmdbRelations": [
                {"id": "REL-1", "tenantId": "tenant-acme", "sourceAssetId": "AST-1", "targetAssetId": "AST-2"},
                {
                    "id": "REL-CROSS-TENANT",
                    "tenantId": "tenant-acme",
                    "sourceAssetId": "AST-1",
                    "targetAssetId": "AST-BETA-1",
                },
            ],
            "kb": [{"id": "KB-1", "tenantId": "tenant-acme", "title": "VPN Troubleshooting"}],
            "auditLogs": [{"id": "AUD-1", "tenantId": "tenant-acme", "action": "incident.created"}],
        },
    }


def test_firebase_migration_validates_scrubs_deduplicates_and_preserves_relationships() -> None:
    migrator = FirebaseToPostgresMigrator()
    result = migrator.transform_snapshot(_sample_firebase_snapshot(), dry_run=True)

    # All integrity checks pass
    assert all(result.integrity_checks.values())

    # Organizations: 2 migrated, 1 duplicate skipped, 1 invalid rejected
    assert result.stats["organizations"].migrated_count == 2
    assert result.stats["organizations"].duplicates_skipped == 1
    assert result.stats["organizations"].rejected_count == 1

    # Users: 1 valid migrated, 1 bad email rejected, plaintext passwords scrubbed!
    assert result.stats["users"].migrated_count == 1
    assert result.stats["users"].rejected_count == 1
    assert result.passwords_scrubbed == 2
    migrated_user = result.records["users"][0]
    assert migrated_user["password_hash"] is None
    assert migrated_user["password_reset_required"] is True
    assert "password" not in migrated_user

    # Incidents: 2 valid across 2 tenants, 1 duplicate skipped, 1 unknown tenant rejected
    assert result.stats["incidents"].migrated_count == 2
    assert result.stats["incidents"].duplicates_skipped == 1
    assert result.stats["incidents"].rejected_count == 1

    # Relationships preserved & cross-tenant links blocked
    assert result.relationships_preserved["request_approval_stages"] == 2
    assert result.relationships_preserved["change_to_cab_votes"] == 2
    assert result.relationships_preserved["problem_to_incidents"] == 1
    assert result.stats["problem_incident_links"].rejected_count == 1  # cross-tenant INC-2001 blocked
    assert result.relationships_preserved["cmdb_asset_dependencies"] == 1
    assert result.stats["cmdb_relationships"].rejected_count == 1  # cross-tenant AST-BETA-1 blocked

    # Deterministic UUID idempotency across two runs
    second_run = FirebaseToPostgresMigrator().transform_snapshot(_sample_firebase_snapshot(), dry_run=True)
    assert second_run.records["organizations"][0]["id"] == result.records["organizations"][0]["id"]
    assert second_run.records["incidents"][0]["id"] == result.records["incidents"][0]["id"]

    # Markdown reconciliation report contains expected sections
    md = result.to_markdown_report()
    assert "Reconciliation Report" in md
    assert "Plaintext Secrets / Passwords Scrubbed" in md
    assert "[PASS] `zero_plaintext_passwords_in_output`" in md
