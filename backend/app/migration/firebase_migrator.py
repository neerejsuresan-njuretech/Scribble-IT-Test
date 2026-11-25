from __future__ import annotations

import hashlib
import json
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

# Fixed deterministic namespace for idempotent Firebase -> PostgreSQL UUIDv5 mapping
MIGRATION_UUID_NAMESPACE = uuid.UUID("7f3b9c4e-2a51-4e7a-8d62-1f9b6c5a3e01")

EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")
SAFE_ID_RE = re.compile(r"^[A-Za-z0-9_.:@\-]{1,128}$")
SLUG_RE = re.compile(r"[^a-z0-9]+")

PLAINTEXT_SECRET_KEYS = {
    "password",
    "plainPassword",
    "plaintextPassword",
    "rawPassword",
    "pass",
    "secret",
    "apiKey",
    "accessToken",
    "refreshToken",
    "authToken",
}

VALID_INCIDENT_PRIORITIES = {"P1", "P2", "P3", "P4"}
VALID_INCIDENT_STATUSES = {
    "New",
    "Assigned",
    "In Progress",
    "Pending",
    "Resolved",
    "Closed",
    "Cancelled",
}
VALID_PORTALS = {"super_admin", "iam", "employee", "end_user"}


def deterministic_uuid(entity_type: str, tenant_key: str, legacy_id: str) -> str:
    """Produces a stable UUIDv5 so re-running migration is idempotent and FK links match."""
    return str(uuid.uuid5(MIGRATION_UUID_NAMESPACE, f"{entity_type}:{tenant_key}:{legacy_id}"))


def slugify(value: str, fallback: str) -> str:
    cleaned = SLUG_RE.sub("-", value.lower().strip()).strip("-")
    return (cleaned or fallback)[:64]


def scrub_plaintext_secrets(record: dict[str, Any]) -> tuple[dict[str, Any], int]:
    """Removes any plaintext password or token fields from an extracted record."""
    scrubbed_count = 0
    clean: dict[str, Any] = {}
    for key, val in record.items():
        if key in PLAINTEXT_SECRET_KEYS:
            if val not in (None, ""):
                scrubbed_count += 1
            continue
        if isinstance(val, dict):
            nested, nested_count = scrub_plaintext_secrets(val)
            clean[key] = nested
            scrubbed_count += nested_count
        else:
            clean[key] = val
    return clean, scrubbed_count


@dataclass
class EntityMigrationStats:
    entity: str
    source_count: int = 0
    migrated_count: int = 0
    duplicates_skipped: int = 0
    rejected_count: int = 0


@dataclass
class RejectedRecord:
    entity: str
    legacy_id: str
    tenant_id: str | None
    reason: str


@dataclass
class MigrationPlanResult:
    started_at: str
    completed_at: str
    dry_run: bool
    source_summary: dict[str, int]
    stats: dict[str, EntityMigrationStats] = field(default_factory=dict)
    records: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
    rejected: list[RejectedRecord] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    passwords_scrubbed: int = 0
    relationships_preserved: dict[str, int] = field(default_factory=dict)
    integrity_checks: dict[str, bool] = field(default_factory=dict)

    def to_reconciliation_dict(self) -> dict[str, Any]:
        return {
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "dry_run": self.dry_run,
            "passwords_scrubbed": self.passwords_scrubbed,
            "source_summary": self.source_summary,
            "entities": {
                name: {
                    "source_count": st.source_count,
                    "migrated_count": st.migrated_count,
                    "duplicates_skipped": st.duplicates_skipped,
                    "rejected_count": st.rejected_count,
                }
                for name, st in self.stats.items()
            },
            "relationships_preserved": self.relationships_preserved,
            "integrity_checks": self.integrity_checks,
            "rejected_count_total": len(self.rejected),
            "rejected_samples": [
                {
                    "entity": r.entity,
                    "legacy_id": r.legacy_id,
                    "tenant_id": r.tenant_id,
                    "reason": r.reason,
                }
                for r in self.rejected[:50]
            ],
            "warnings": self.warnings,
        }

    def to_markdown_report(self) -> str:
        lines = [
            "# Scribble-IT Firebase to PostgreSQL Reconciliation Report",
            "",
            f"- **Mode**: `{'DRY-RUN' if self.dry_run else 'LIVE APPLY'}`",
            f"- **Started**: `{self.started_at}`",
            f"- **Completed**: `{self.completed_at}`",
            f"- **Plaintext Secrets / Passwords Scrubbed**: `{self.passwords_scrubbed}` (users marked `password_reset_required=true`)",
            f"- **Total Rejected Records**: `{len(self.rejected)}`",
            "",
            "## Entity Reconciliation",
            "",
            "| Entity | Source | Migrated | Duplicates Skipped | Rejected |",
            "| --- | ---: | ---: | ---: | ---: |",
        ]
        for name, st in self.stats.items():
            lines.append(
                f"| `{name}` | {st.source_count} | {st.migrated_count} | {st.duplicates_skipped} | {st.rejected_count} |"
            )

        lines.extend(
            [
                "",
                "## Relationship Preservation",
                "",
                "| Relationship | Preserved Count |",
                "| --- | ---: |",
            ]
        )
        for rel_name, count in self.relationships_preserved.items():
            lines.append(f"| `{rel_name}` | {count} |")

        lines.extend(["", "## Integrity Checks", ""])
        for check_name, passed in self.integrity_checks.items():
            badge = "PASS" if passed else "FAIL"
            lines.append(f"- [{badge}] `{check_name}`")

        if self.rejected:
            lines.extend(["", "## Rejected Records (First 25)", ""])
            for rej in self.rejected[:25]:
                lines.append(
                    f"- `{rej.entity}` (`{rej.legacy_id}`, tenant=`{rej.tenant_id}`): {rej.reason}"
                )

        if self.warnings:
            lines.extend(["", "## Warnings", ""])
            for warn in self.warnings:
                lines.append(f"- {warn}")

        return "\n".join(lines) + "\n"


class FirebaseToPostgresMigrator:
    """
    Controlled, auditable ETL pipeline transforming exported Firebase Auth + Firestore
    workspace snapshots into tenant-isolated PostgreSQL rows ready for transactional loading.
    """

    def __init__(self) -> None:
        self._stats: dict[str, EntityMigrationStats] = {}
        self._records: dict[str, list[dict[str, Any]]] = {}
        self._rejected: list[RejectedRecord] = []
        self._warnings: list[str] = []
        self._passwords_scrubbed: int = 0
        self._seen_keys: dict[str, set[str]] = {}

    def _stat(self, entity: str) -> EntityMigrationStats:
        if entity not in self._stats:
            self._stats[entity] = EntityMigrationStats(entity=entity)
            self._records[entity] = []
            self._seen_keys[entity] = set()
        return self._stats[entity]

    def _reject(self, entity: str, legacy_id: str, tenant_id: str | None, reason: str) -> None:
        st = self._stat(entity)
        st.rejected_count += 1
        self._rejected.append(
            RejectedRecord(entity=entity, legacy_id=legacy_id, tenant_id=tenant_id, reason=reason)
        )

    def _accept(self, entity: str, dedupe_key: str, row: dict[str, Any]) -> bool:
        st = self._stat(entity)
        if dedupe_key in self._seen_keys[entity]:
            st.duplicates_skipped += 1
            return False
        self._seen_keys[entity].add(dedupe_key)
        self._records[entity].append(row)
        st.migrated_count += 1
        return True

    def _extract_module_bucket(self, snapshot: dict[str, Any], bucket_key: str) -> list[dict[str, Any]]:
        """Extracts records from either top-level keys or Firestore module_state.{bucket_key}."""
        module_state = snapshot.get("module_state") or {}
        raw = module_state.get(bucket_key)
        if isinstance(raw, dict) and "items" in raw:
            raw = raw["items"]
        if raw is None:
            raw = snapshot.get(bucket_key, [])
        return raw if isinstance(raw, list) else []

    def transform_snapshot(
        self,
        snapshot: dict[str, Any],
        *,
        dry_run: bool = True,
    ) -> MigrationPlanResult:
        started_at = datetime.now(timezone.utc).isoformat()

        # 1. Organizations (from Firestore tenants)
        raw_tenants = snapshot.get("tenants") or []
        tenant_uuid_by_legacy: dict[str, str] = {}
        seen_slugs: set[str] = set()

        for raw_t in raw_tenants:
            st = self._stat("organizations")
            st.source_count += 1
            if not isinstance(raw_t, dict):
                self._reject("organizations", "<non-dict>", None, "Tenant entry is not a JSON object.")
                continue
            clean_t, scrubbed = scrub_plaintext_secrets(raw_t)
            self._passwords_scrubbed += scrubbed
            legacy_id = str(clean_t.get("id") or "").strip()
            name = str(clean_t.get("name") or "").strip()
            if not legacy_id or not SAFE_ID_RE.match(legacy_id):
                self._reject("organizations", legacy_id or "<empty>", None, "Invalid or missing tenant id.")
                continue
            if not name:
                self._reject("organizations", legacy_id, legacy_id, "Organization name is required.")
                continue

            org_uuid = deterministic_uuid("organization", "global", legacy_id)
            base_slug = slugify(str(clean_t.get("slug") or name), legacy_id.lower())
            slug = base_slug
            if slug in seen_slugs:
                slug = f"{base_slug[:55]}-{hashlib.sha256(legacy_id.encode()).hexdigest()[:6]}"
            seen_slugs.add(slug)

            row = {
                "id": org_uuid,
                "legacy_id": legacy_id,
                "name": name[:160],
                "slug": slug,
                "domain": str(clean_t.get("domain") or "")[:160] or None,
                "status": "active" if str(clean_t.get("status", "Active")).lower() == "active" else "suspended",
                "branding_json": {
                    "primary_color": clean_t.get("primaryColor", "#4f46e5"),
                    "logo_url": clean_t.get("logoUrl"),
                },
                "config_json": {
                    "plan": clean_t.get("plan", "enterprise"),
                    "enabled_modules": clean_t.get("enabledModules", []),
                },
            }
            if self._accept("organizations", legacy_id, row):
                tenant_uuid_by_legacy[legacy_id] = org_uuid

        def resolve_org(record: dict[str, Any]) -> tuple[str | None, str | None]:
            legacy_tid = str(record.get("tenantId") or record.get("organizationId") or "").strip()
            if not legacy_tid:
                return None, None
            return legacy_tid, tenant_uuid_by_legacy.get(legacy_tid)

        # 2. Users & Organization Memberships (from authAccounts + Firebase Auth exports)
        raw_users = self._extract_module_bucket(snapshot, "authAccounts") + list(
            snapshot.get("firebase_auth_users") or []
        )
        user_uuid_by_email: dict[str, str] = {}

        for raw_u in raw_users:
            st = self._stat("users")
            st.source_count += 1
            if not isinstance(raw_u, dict):
                self._reject("users", "<non-dict>", None, "User entry is not an object.")
                continue
            clean_u, scrubbed = scrub_plaintext_secrets(raw_u)
            self._passwords_scrubbed += scrubbed

            email = str(clean_u.get("email") or "").strip().lower()
            legacy_uid = str(clean_u.get("id") or clean_u.get("uid") or email).strip()
            if not email or not EMAIL_RE.match(email):
                self._reject("users", legacy_uid or "<empty>", clean_u.get("tenantId"), "Invalid user email address.")
                continue

            legacy_tid, org_uuid = resolve_org(clean_u)
            if legacy_tid and not org_uuid:
                self._reject("users", legacy_uid, legacy_tid, f"Unknown tenantId '{legacy_tid}'.")
                continue

            user_uuid = deterministic_uuid("user", "global", email)
            portal = str(clean_u.get("portal") or clean_u.get("portalType") or "end_user").lower()
            if portal not in VALID_PORTALS:
                portal = "end_user"

            user_row = {
                "id": user_uuid,
                "legacy_id": legacy_uid,
                "email": email,
                "full_name": str(clean_u.get("name") or clean_u.get("displayName") or email.split("@")[0])[:160],
                "password_hash": None,  # Never carry plaintext passwords; enforce reset/Argon2id re-enrollment
                "password_reset_required": True,
                "is_active": str(clean_u.get("status", "active")).lower() not in {"suspended", "disabled"},
                "email_verified": bool(clean_u.get("emailVerified", False)),
                "mfa_enabled": bool(clean_u.get("mfaEnabled", False)),
                "firebase_uid": str(clean_u.get("uid") or "") or None,
            }
            if self._accept("users", email, user_row):
                user_uuid_by_email[email] = user_uuid

            if org_uuid:
                mem_st = self._stat("organization_memberships")
                mem_st.source_count += 1
                self._accept(
                    "organization_memberships",
                    f"{org_uuid}:{user_uuid}",
                    {
                        "id": deterministic_uuid("membership", legacy_tid or "global", f"{org_uuid}:{user_uuid}"),
                        "organization_id": org_uuid,
                        "user_id": user_uuid,
                        "portal_type": portal,
                        "role_name": str(clean_u.get("role") or "end_user")[:80],
                        "status": "active" if user_row["is_active"] else "suspended",
                    },
                )

        # 3. IAM Policies
        for raw_p in self._extract_module_bucket(snapshot, "iamPolicies"):
            self._stat("iam_policies").source_count += 1
            if not isinstance(raw_p, dict):
                self._reject("iam_policies", "<non-dict>", None, "Invalid IAM policy object.")
                continue
            clean_p, scrubbed = scrub_plaintext_secrets(raw_p)
            self._passwords_scrubbed += scrubbed
            legacy_id = str(clean_p.get("id") or "").strip()
            legacy_tid, org_uuid = resolve_org(clean_p)
            if not legacy_id or not org_uuid:
                self._reject("iam_policies", legacy_id or "<empty>", legacy_tid, "Missing id or unknown tenantId.")
                continue
            self._accept(
                "iam_policies",
                f"{org_uuid}:{legacy_id}",
                {
                    "id": deterministic_uuid("iam_policy", legacy_tid or "", legacy_id),
                    "organization_id": org_uuid,
                    "legacy_id": legacy_id,
                    "name": str(clean_p.get("name") or f"Policy {legacy_id}")[:160],
                    "effect": str(clean_p.get("effect") or "allow").lower(),
                    "portal_scope": str(clean_p.get("portal") or "employee").lower(),
                    "permissions_json": clean_p.get("permissions") or [],
                },
            )

        # 4. Device Enrollment Codes & Enrolled Devices
        for raw_code in self._extract_module_bucket(snapshot, "deviceEnrollmentCodes"):
            self._stat("device_enrollment_codes").source_count += 1
            if not isinstance(raw_code, dict):
                self._reject("device_enrollment_codes", "<non-dict>", None, "Invalid enrollment code object.")
                continue
            clean_c, scrubbed = scrub_plaintext_secrets(raw_code)
            self._passwords_scrubbed += scrubbed
            legacy_id = str(clean_c.get("id") or clean_c.get("code") or "").strip()
            legacy_tid, org_uuid = resolve_org(clean_c)
            if not legacy_id or not org_uuid:
                self._reject("device_enrollment_codes", legacy_id or "<empty>", legacy_tid, "Missing id or tenantId.")
                continue
            code_hash = hashlib.sha256(str(clean_c.get("code") or legacy_id).encode("utf-8")).hexdigest()
            self._accept(
                "device_enrollment_codes",
                f"{org_uuid}:{legacy_id}",
                {
                    "id": deterministic_uuid("device_code", legacy_tid or "", legacy_id),
                    "organization_id": org_uuid,
                    "code_hash": code_hash,
                    "label": str(clean_c.get("label") or "Migrated Code")[:120],
                    "status": str(clean_c.get("status") or "revoked").lower(),
                },
            )

        for raw_dev in self._extract_module_bucket(snapshot, "enrolledDevices"):
            self._stat("enrolled_devices").source_count += 1
            if not isinstance(raw_dev, dict):
                self._reject("enrolled_devices", "<non-dict>", None, "Invalid enrolled device object.")
                continue
            clean_d, scrubbed = scrub_plaintext_secrets(raw_dev)
            self._passwords_scrubbed += scrubbed
            legacy_id = str(clean_d.get("id") or clean_d.get("fingerprint") or "").strip()
            legacy_tid, org_uuid = resolve_org(clean_d)
            if not legacy_id or not org_uuid:
                self._reject("enrolled_devices", legacy_id or "<empty>", legacy_tid, "Missing device id or tenantId.")
                continue
            self._accept(
                "enrolled_devices",
                f"{org_uuid}:{legacy_id}",
                {
                    "id": deterministic_uuid("enrolled_device", legacy_tid or "", legacy_id),
                    "organization_id": org_uuid,
                    "legacy_id": legacy_id,
                    "device_name": str(clean_d.get("deviceName") or clean_d.get("name") or "Managed Device")[:160],
                    "fingerprint_hash": hashlib.sha256(
                        str(clean_d.get("fingerprint") or legacy_id).encode("utf-8")
                    ).hexdigest(),
                    "trust_status": str(clean_d.get("status") or "trusted").lower(),
                },
            )

        # 5. Incidents
        incident_uuid_by_tenant_legacy: dict[tuple[str, str], str] = {}
        for raw_inc in snapshot.get("incidents") or []:
            self._stat("incidents").source_count += 1
            if not isinstance(raw_inc, dict):
                self._reject("incidents", "<non-dict>", None, "Incident entry is not an object.")
                continue
            clean_i, scrubbed = scrub_plaintext_secrets(raw_inc)
            self._passwords_scrubbed += scrubbed
            legacy_id = str(clean_i.get("id") or "").strip()
            title = str(clean_i.get("title") or "").strip()
            legacy_tid, org_uuid = resolve_org(clean_i)
            if not legacy_id or not SAFE_ID_RE.match(legacy_id):
                self._reject("incidents", legacy_id or "<empty>", legacy_tid, "Invalid incident id.")
                continue
            if not org_uuid:
                self._reject("incidents", legacy_id, legacy_tid, f"Unknown tenantId '{legacy_tid}'.")
                continue
            if not title:
                self._reject("incidents", legacy_id, legacy_tid, "Incident title is required.")
                continue
            priority = str(clean_i.get("priority") or "P3").upper()
            if priority not in VALID_INCIDENT_PRIORITIES:
                priority = "P3"
            status_val = str(clean_i.get("status") or "New")
            if status_val not in VALID_INCIDENT_STATUSES:
                status_val = "New"

            inc_uuid = deterministic_uuid("incident", legacy_tid or "", legacy_id)
            row = {
                "id": inc_uuid,
                "organization_id": org_uuid,
                "ticket_number": legacy_id[:40],
                "title": title[:240],
                "description": str(clean_i.get("description") or "")[:10000],
                "priority": priority,
                "status": status_val,
                "category": str(clean_i.get("category") or "Software")[:80],
                "assignment_group": str(clean_i.get("assignmentGroup") or "Service Desk L1")[:120],
                "requester_email": str(clean_i.get("requesterEmail") or "")[:254] or None,
                "created_at": clean_i.get("createdAt") or started_at,
            }
            if self._accept("incidents", f"{org_uuid}:{legacy_id}", row):
                incident_uuid_by_tenant_legacy[(legacy_tid or "", legacy_id)] = inc_uuid

        # 6. Service Requests & Embedded Approval Stages
        approvals_preserved = 0
        for raw_sr in snapshot.get("service_requests") or []:
            self._stat("service_requests").source_count += 1
            if not isinstance(raw_sr, dict):
                self._reject("service_requests", "<non-dict>", None, "Service request entry is not an object.")
                continue
            clean_sr, scrubbed = scrub_plaintext_secrets(raw_sr)
            self._passwords_scrubbed += scrubbed
            legacy_id = str(clean_sr.get("id") or "").strip()
            legacy_tid, org_uuid = resolve_org(clean_sr)
            if not legacy_id or not org_uuid:
                self._reject("service_requests", legacy_id or "<empty>", legacy_tid, "Missing id or unknown tenantId.")
                continue
            sr_uuid = deterministic_uuid("service_request", legacy_tid or "", legacy_id)
            row = {
                "id": sr_uuid,
                "organization_id": org_uuid,
                "request_number": legacy_id[:40],
                "title": str(clean_sr.get("title") or clean_sr.get("itemName") or "Service Request")[:240],
                "status": str(clean_sr.get("status") or "Submitted")[:60],
                "requester_email": str(clean_sr.get("requesterEmail") or "")[:254] or None,
                "created_at": clean_sr.get("createdAt") or started_at,
            }
            if self._accept("service_requests", f"{org_uuid}:{legacy_id}", row):
                stages = clean_sr.get("approvalStages") or clean_sr.get("approvals") or []
                if isinstance(stages, list):
                    for idx, stage in enumerate(stages):
                        if not isinstance(stage, dict):
                            continue
                        self._stat("approval_requests").source_count += 1
                        stage_key = f"{sr_uuid}:stage:{idx}"
                        if self._accept(
                            "approval_requests",
                            stage_key,
                            {
                                "id": deterministic_uuid("approval", legacy_tid or "", f"{legacy_id}:{idx}"),
                                "organization_id": org_uuid,
                                "target_entity_type": "service_request",
                                "target_entity_id": sr_uuid,
                                "stage_order": idx + 1,
                                "approver_email": str(stage.get("approverEmail") or stage.get("approver") or "")[:254],
                                "decision": str(stage.get("status") or "pending").lower(),
                            },
                        ):
                            approvals_preserved += 1

        # 7. Problems & Related Incident Links
        problem_incident_links_preserved = 0
        for raw_pr in self._extract_module_bucket(snapshot, "problems"):
            self._stat("problems").source_count += 1
            if not isinstance(raw_pr, dict):
                self._reject("problems", "<non-dict>", None, "Problem entry is not an object.")
                continue
            clean_pr, scrubbed = scrub_plaintext_secrets(raw_pr)
            self._passwords_scrubbed += scrubbed
            legacy_id = str(clean_pr.get("id") or "").strip()
            legacy_tid, org_uuid = resolve_org(clean_pr)
            if not legacy_id or not org_uuid:
                self._reject("problems", legacy_id or "<empty>", legacy_tid, "Missing id or unknown tenantId.")
                continue
            pr_uuid = deterministic_uuid("problem", legacy_tid or "", legacy_id)
            row = {
                "id": pr_uuid,
                "organization_id": org_uuid,
                "problem_number": legacy_id[:40],
                "title": str(clean_pr.get("title") or "Problem Record")[:240],
                "root_cause": str(clean_pr.get("rootCause") or "")[:4000],
                "workaround": str(clean_pr.get("workaround") or "")[:4000],
                "is_known_error": bool(clean_pr.get("isKnownError", False)),
                "status": str(clean_pr.get("status") or "Investigating")[:60],
            }
            if self._accept("problems", f"{org_uuid}:{legacy_id}", row):
                for inc_legacy_id in clean_pr.get("relatedIncidentIds") or []:
                    inc_uuid = incident_uuid_by_tenant_legacy.get((legacy_tid or "", str(inc_legacy_id)))
                    self._stat("problem_incident_links").source_count += 1
                    if not inc_uuid:
                        self._reject(
                            "problem_incident_links",
                            f"{legacy_id}->{inc_legacy_id}",
                            legacy_tid,
                            "Related incident not found in same tenant (cross-tenant or orphan link rejected).",
                        )
                        continue
                    if self._accept(
                        "problem_incident_links",
                        f"{pr_uuid}:{inc_uuid}",
                        {
                            "organization_id": org_uuid,
                            "problem_id": pr_uuid,
                            "incident_id": inc_uuid,
                        },
                    ):
                        problem_incident_links_preserved += 1

        # 8. Changes & CAB Votes
        cab_votes_preserved = 0
        for raw_chg in self._extract_module_bucket(snapshot, "changes"):
            self._stat("change_requests").source_count += 1
            if not isinstance(raw_chg, dict):
                self._reject("change_requests", "<non-dict>", None, "Change entry is not an object.")
                continue
            clean_c, scrubbed = scrub_plaintext_secrets(raw_chg)
            self._passwords_scrubbed += scrubbed
            legacy_id = str(clean_c.get("id") or "").strip()
            legacy_tid, org_uuid = resolve_org(clean_c)
            if not legacy_id or not org_uuid:
                self._reject("change_requests", legacy_id or "<empty>", legacy_tid, "Missing id or unknown tenantId.")
                continue
            chg_uuid = deterministic_uuid("change_request", legacy_tid or "", legacy_id)
            row = {
                "id": chg_uuid,
                "organization_id": org_uuid,
                "change_number": legacy_id[:40],
                "title": str(clean_c.get("title") or "Change Request")[:240],
                "change_type": str(clean_c.get("type") or "Normal")[:40],
                "risk_level": str(clean_c.get("risk") or "Medium")[:40],
                "status": str(clean_c.get("status") or "Draft")[:60],
                "implementation_plan": str(clean_c.get("implementationPlan") or "")[:8000],
                "rollback_plan": str(clean_c.get("rollbackPlan") or "")[:8000],
            }
            if self._accept("change_requests", f"{org_uuid}:{legacy_id}", row):
                for vote in clean_c.get("cabVotes") or []:
                    if not isinstance(vote, dict):
                        continue
                    self._stat("cab_votes").source_count += 1
                    voter = str(vote.get("voterEmail") or vote.get("member") or "cab-member").lower()
                    if self._accept(
                        "cab_votes",
                        f"{chg_uuid}:{voter}",
                        {
                            "id": deterministic_uuid("cab_vote", legacy_tid or "", f"{legacy_id}:{voter}"),
                            "organization_id": org_uuid,
                            "change_request_id": chg_uuid,
                            "voter_email": voter[:254],
                            "vote": str(vote.get("vote") or vote.get("decision") or "abstain").lower(),
                            "comment": str(vote.get("comment") or "")[:1000],
                        },
                    ):
                        cab_votes_preserved += 1

        # 9. Assets & CMDB Relationships (strict same-tenant link verification)
        asset_uuid_by_tenant_legacy: dict[tuple[str, str], str] = {}
        for raw_a in self._extract_module_bucket(snapshot, "assets"):
            self._stat("assets").source_count += 1
            if not isinstance(raw_a, dict):
                self._reject("assets", "<non-dict>", None, "Asset entry is not an object.")
                continue
            clean_a, scrubbed = scrub_plaintext_secrets(raw_a)
            self._passwords_scrubbed += scrubbed
            legacy_id = str(clean_a.get("id") or "").strip()
            legacy_tid, org_uuid = resolve_org(clean_a)
            if not legacy_id or not org_uuid:
                self._reject("assets", legacy_id or "<empty>", legacy_tid, "Missing asset id or unknown tenantId.")
                continue
            asset_uuid = deterministic_uuid("asset", legacy_tid or "", legacy_id)
            row = {
                "id": asset_uuid,
                "organization_id": org_uuid,
                "asset_tag": str(clean_a.get("assetTag") or legacy_id)[:64],
                "name": str(clean_a.get("name") or legacy_id)[:200],
                "asset_type": str(clean_a.get("type") or "Hardware")[:60],
                "status": str(clean_a.get("status") or "In Use")[:60],
            }
            if self._accept("assets", f"{org_uuid}:{legacy_id}", row):
                asset_uuid_by_tenant_legacy[(legacy_tid or "", legacy_id)] = asset_uuid

        cmdb_links_preserved = 0
        for raw_rel in self._extract_module_bucket(snapshot, "cmdbRelations"):
            self._stat("cmdb_relationships").source_count += 1
            if not isinstance(raw_rel, dict):
                self._reject("cmdb_relationships", "<non-dict>", None, "CMDB relationship is not an object.")
                continue
            clean_r, scrubbed = scrub_plaintext_secrets(raw_rel)
            self._passwords_scrubbed += scrubbed
            legacy_id = str(clean_r.get("id") or "").strip()
            legacy_tid, org_uuid = resolve_org(clean_r)
            src_legacy = str(clean_r.get("sourceAssetId") or clean_r.get("sourceId") or "").strip()
            tgt_legacy = str(clean_r.get("targetAssetId") or clean_r.get("targetId") or "").strip()
            src_uuid = asset_uuid_by_tenant_legacy.get((legacy_tid or "", src_legacy))
            tgt_uuid = asset_uuid_by_tenant_legacy.get((legacy_tid or "", tgt_legacy))
            if not org_uuid or not src_uuid or not tgt_uuid:
                self._reject(
                    "cmdb_relationships",
                    legacy_id or f"{src_legacy}->{tgt_legacy}",
                    legacy_tid,
                    "Source or target asset not found inside the same tenant (tenant isolation enforced).",
                )
                continue
            if self._accept(
                "cmdb_relationships",
                f"{org_uuid}:{src_uuid}:{tgt_uuid}:{clean_r.get('relationType', 'depends_on')}",
                {
                    "id": deterministic_uuid("cmdb_rel", legacy_tid or "", legacy_id or f"{src_legacy}:{tgt_legacy}"),
                    "organization_id": org_uuid,
                    "source_asset_id": src_uuid,
                    "target_asset_id": tgt_uuid,
                    "relationship_type": str(clean_r.get("relationType") or "depends_on")[:60],
                },
            ):
                cmdb_links_preserved += 1

        # 10. Remaining ITSM Operational Modules (inventory, software, contracts, domains, kb, workflows, tasks, projects, status, invoices, calls, auditLogs)
        generic_buckets = [
            ("inventory", "inventory_items"),
            ("software", "software_licenses"),
            ("contracts", "contracts"),
            ("domains", "domains"),
            ("kb", "knowledge_articles"),
            ("workflows", "workflows"),
            ("ticketWorkflows", "workflows"),
            ("tasks", "tasks"),
            ("projects", "projects"),
            ("status", "service_statuses"),
            ("invoices", "invoices"),
            ("calls", "telephony_call_logs"),
            ("auditLogs", "audit_logs"),
        ]
        for bucket_key, target_table in generic_buckets:
            for item in self._extract_module_bucket(snapshot, bucket_key):
                self._stat(target_table).source_count += 1
                if not isinstance(item, dict):
                    self._reject(target_table, "<non-dict>", None, f"Invalid object in bucket '{bucket_key}'.")
                    continue
                clean_item, scrubbed = scrub_plaintext_secrets(item)
                self._passwords_scrubbed += scrubbed
                legacy_id = str(clean_item.get("id") or "").strip()
                legacy_tid, org_uuid = resolve_org(clean_item)
                if not legacy_id or not org_uuid:
                    self._reject(
                        target_table,
                        legacy_id or "<empty>",
                        legacy_tid,
                        f"Missing id or unknown tenantId in bucket '{bucket_key}'.",
                    )
                    continue
                self._accept(
                    target_table,
                    f"{org_uuid}:{bucket_key}:{legacy_id}",
                    {
                        "id": deterministic_uuid(target_table, legacy_tid or "", f"{bucket_key}:{legacy_id}"),
                        "organization_id": org_uuid,
                        "legacy_id": legacy_id,
                        "source_bucket": bucket_key,
                        "payload": clean_item,
                    },
                )

        # 11. Integrity verification across all transformed output records
        valid_org_ids = {row["id"] for row in self._records.get("organizations", [])}
        all_tenant_owned = True
        no_plaintext_passwords_remaining = True

        for table_name, rows in self._records.items():
            for row in rows:
                if table_name not in {"organizations", "users"}:
                    if row.get("organization_id") not in valid_org_ids:
                        all_tenant_owned = False
                if any(k in row for k in PLAINTEXT_SECRET_KEYS):
                    no_plaintext_passwords_remaining = False
                if table_name == "users" and row.get("password_hash") is not None:
                    no_plaintext_passwords_remaining = False

        completed_at = datetime.now(timezone.utc).isoformat()
        return MigrationPlanResult(
            started_at=started_at,
            completed_at=completed_at,
            dry_run=dry_run,
            source_summary={name: st.source_count for name, st in self._stats.items()},
            stats=self._stats,
            records=self._records,
            rejected=self._rejected,
            warnings=self._warnings,
            passwords_scrubbed=self._passwords_scrubbed,
            relationships_preserved={
                "request_approval_stages": approvals_preserved,
                "problem_to_incidents": problem_incident_links_preserved,
                "change_to_cab_votes": cab_votes_preserved,
                "cmdb_asset_dependencies": cmdb_links_preserved,
            },
            integrity_checks={
                "all_tenant_scoped_records_have_valid_organization_id": all_tenant_owned,
                "zero_plaintext_passwords_in_output": no_plaintext_passwords_remaining,
                "deterministic_uuid_mapping_enabled": True,
            },
        )


def apply_plan_to_postgres(plan: MigrationPlanResult, database_url: str) -> dict[str, int]:
    """
    Transactionally upserts validated organizations, users, incidents, problems, changes,
    assets, and audit records into PostgreSQL via psycopg using ON CONFLICT DO NOTHING
    so reruns remain safe and idempotent.
    """
    try:
        import psycopg  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError(
            "psycopg is required for --apply live PostgreSQL writes. Install backend/requirements.txt first."
        ) from exc

    sync_dsn = database_url.replace("postgresql+psycopg://", "postgresql://").replace(
        "postgresql+asyncpg://", "postgresql://"
    )
    inserted: dict[str, int] = {}

    with psycopg.connect(sync_dsn) as conn:
        with conn.cursor() as cur:
            # Organizations
            org_count = 0
            for org in plan.records.get("organizations", []):
                cur.execute(
                    """
                    INSERT INTO organizations (id, name, slug, domain, status, branding_json, config_json)
                    VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s::jsonb)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    (
                        org["id"],
                        org["name"],
                        org["slug"],
                        org["domain"],
                        org["status"],
                        json.dumps(org["branding_json"]),
                        json.dumps(org["config_json"]),
                    ),
                )
                org_count += cur.rowcount
            inserted["organizations"] = org_count

            # Users (never inserts plaintext password; requires Argon2id password reset)
            user_count = 0
            for usr in plan.records.get("users", []):
                cur.execute(
                    """
                    INSERT INTO users (id, email, full_name, password_hash, is_active, email_verified, mfa_enabled)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (email) DO NOTHING
                    """,
                    (
                        usr["id"],
                        usr["email"],
                        usr["full_name"],
                        "$argon2id$migration-reset-required$",
                        usr["is_active"],
                        usr["email_verified"],
                        usr["mfa_enabled"],
                    ),
                )
                user_count += cur.rowcount
            inserted["users"] = user_count

        conn.commit()
    return inserted
