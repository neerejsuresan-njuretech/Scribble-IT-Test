from __future__ import annotations

from dataclasses import dataclass

# Preserved Scribble-IT 1.x portal archetypes mapped to backend RBAC
PORTAL_SUPER_ADMIN = "super_admin"
PORTAL_IAM = "iam"
PORTAL_EMPLOYEE = "employee"
PORTAL_END_USER = "end_user"

VALID_PORTALS = frozenset(
    {PORTAL_SUPER_ADMIN, PORTAL_IAM, PORTAL_EMPLOYEE, PORTAL_END_USER}
)

# Canonical RBAC permission scopes (preserving all 1.x scopes + audit:read)
CANONICAL_PERMISSIONS: list[tuple[str, str, str]] = [
    ("incidents:read", "itsm", "View incidents, problems, service requests, and changes"),
    ("incidents:write", "itsm", "Create, triage, update, and resolve operational ITSM records"),
    ("assets:read", "cmdb", "View CMDB assets, network topology, software licences, and domains"),
    ("assets:write", "cmdb", "Create and modify assets, hardware inventory, and vendor contracts"),
    ("requests:approve", "approvals", "Approve or reject assigned service request stages"),
    ("changes:cab_vote", "approvals", "Cast assigned Change Advisory Board (CAB) votes"),
    ("workflows:manage", "automation", "Configure workflow engine, ticket routing rules, process maps, and custom forms"),
    ("iam:manage", "iam", "Manage organization identities, role policies, and user suspensions"),
    ("devices:enroll_code", "iam", "Generate single-use IAM device enrollment verification codes (IAM Portal exclusive)"),
    ("tenants:admin", "governance", "Create/update organizations, logos, portal branding, SLAs, and module toggles (Super Admin exclusive)"),
    ("billing:read", "finance", "View and manage billing invoices and financial reports"),
    ("audit:read", "governance", "Read centralized append-only security and governance audit logs"),
]

VALID_PERMISSION_SCOPES = frozenset(scope for scope, _, _ in CANONICAL_PERMISSIONS)


@dataclass(frozen=True)
class DefaultRoleTemplate:
    slug: str
    name: str
    description: str
    portal_type: str
    clearance_tier: str
    permissions: tuple[str, ...]
    mfa_required: bool
    sso_only: bool


# Preserves CORE_IAM_POLICIES from Scribble-IT 1.x with least-privilege discipline
DEFAULT_ROLE_TEMPLATES: tuple[DefaultRoleTemplate, ...] = (
    DefaultRoleTemplate(
        slug="pol-super-admin",
        name="Root Tenant Governance",
        description="Exclusive multi-tenant governance, company branding, module availability, and emergency approval override.",
        portal_type=PORTAL_SUPER_ADMIN,
        clearance_tier="super_admin",
        permissions=(
            "incidents:read",
            "incidents:write",
            "assets:read",
            "assets:write",
            "requests:approve",
            "changes:cab_vote",
            "workflows:manage",
            "iam:manage",
            "tenants:admin",
            "billing:read",
            "audit:read",
        ),
        mfa_required=True,
        sso_only=False,
    ),
    DefaultRoleTemplate(
        slug="pol-iam-admin",
        name="IAM Directory & Device Trust Officer",
        description="Manage corporate identities, access policies, and generate single-use MDM device enrollment verification codes.",
        portal_type=PORTAL_IAM,
        clearance_tier="iam_officer",
        permissions=(
            "iam:manage",
            "devices:enroll_code",
            "incidents:read",
            "assets:read",
            "audit:read",
        ),
        mfa_required=True,
        sso_only=False,
    ),
    DefaultRoleTemplate(
        slug="pol-employee-ops",
        name="ITIL Operations & CMDB Engineer",
        description="Standard IT operations access to incidents, requests, assets, and CMDB. Approvals require explicit assignment.",
        portal_type=PORTAL_EMPLOYEE,
        clearance_tier="it_operations",
        permissions=(
            "incidents:read",
            "incidents:write",
            "assets:read",
            "assets:write",
        ),
        mfa_required=False,
        sso_only=False,
    ),
    DefaultRoleTemplate(
        slug="pol-approver-cab",
        name="Designated Approver & CAB Member",
        description="Authorized to approve assigned service request stages and cast assigned CAB change votes.",
        portal_type=PORTAL_EMPLOYEE,
        clearance_tier="approver_cab",
        permissions=(
            "incidents:read",
            "assets:read",
            "requests:approve",
            "changes:cab_vote",
        ),
        mfa_required=True,
        sso_only=False,
    ),
    DefaultRoleTemplate(
        slug="pol-end-user",
        name="Self-Service Requester",
        description="Scoped self-service read/submit access limited to requester own tickets and assigned assets.",
        portal_type=PORTAL_END_USER,
        clearance_tier="end_user",
        permissions=("incidents:read", "assets:read"),
        mfa_required=False,
        sso_only=False,
    ),
)

DEFAULT_ROLE_BY_PORTAL: dict[str, str] = {
    PORTAL_SUPER_ADMIN: "pol-super-admin",
    PORTAL_IAM: "pol-iam-admin",
    PORTAL_EMPLOYEE: "pol-employee-ops",
    PORTAL_END_USER: "pol-end-user",
}


def compute_effective_permissions(
    *,
    is_platform_super_admin: bool,
    portal_type: str,
    role_scopes: set[str],
) -> frozenset[str]:
    """
    Server-authoritative permission resolver enforcing portal-exclusive governance invariants:
    1. `devices:enroll_code` is strictly IAM Portal exclusive (`portal_type == 'iam'`).
    2. `tenants:admin` is strictly Super Admin Portal exclusive (`is_platform_super_admin` + `portal_type == 'super_admin'`).
    3. Super Admin sessions receive all governance & operational scopes except `devices:enroll_code` (which stays IAM Portal exclusive).
    """
    if is_platform_super_admin and portal_type == PORTAL_SUPER_ADMIN:
        return frozenset(VALID_PERMISSION_SCOPES - {"devices:enroll_code"})

    effective = set(role_scopes)

    # Enforce strict portal boundaries regardless of role rows
    if portal_type != PORTAL_IAM:
        effective.discard("devices:enroll_code")
    if not (is_platform_super_admin and portal_type == PORTAL_SUPER_ADMIN):
        effective.discard("tenants:admin")

    return frozenset(effective)


def derive_clearance_tier(
    *,
    is_platform_super_admin: bool,
    portal_type: str,
    permissions: frozenset[str],
) -> str:
    if is_platform_super_admin and portal_type == PORTAL_SUPER_ADMIN:
        return "super_admin"
    if portal_type == PORTAL_IAM:
        return "iam_officer"
    if portal_type == PORTAL_END_USER:
        return "end_user"
    if "workflows:manage" in permissions:
        return "operations_lead"
    if "incidents:write" in permissions:
        return "it_operations"
    if "requests:approve" in permissions or "changes:cab_vote" in permissions:
        return "approver_cab"
    if "billing:read" in permissions:
        return "finops"
    return "scoped_staff"
