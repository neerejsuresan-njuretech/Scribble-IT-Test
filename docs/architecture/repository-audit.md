# Scribble-IT 2.0 — Complete Repository Audit & Migration Risk Report

> **Audit Scope**: Complete inspection of Scribble-IT 1.x (`src/`, `server.ts`, `server/gemini.ts`, `firestore.rules`, `security_spec.md`, `package.json`, `vite.config.ts`, `.env.example`) prior to Phase 1 backend foundation construction.
> **Preservation Policy**: Existing React 19 UI, Express proxy (`server.ts`), Firebase/Firestore synchronization, and all 30+ ITSM modules remain intact and runnable during Phases 1–4 until equivalent verified FastAPI + PostgreSQL endpoints replace them in Phase 5.

---

## 1. Executive Repository Audit

### 1.1 Existing Architecture Summary
| Layer | Current Implementation | Key Findings |
| --- | --- | --- |
| **Frontend SPA** | React 19 + TypeScript + Vite 8 + Tailwind CSS v4 (`src/App.tsx`, `src/pages/`, `src/components/`) | Well-structured modular UI with 30+ ITSM pages, dual light/dark theme, responsive mobile drawer/bottom-nav, and centralized `src/config/navigationAccess.ts` RBAC registry. |
| **Client State & Business Logic** | Monolithic `src/context/ITSMContext.tsx` (~3,669 lines) + `localStorage` | Holds all domain entities, authentication accounts (with plaintext passwords in state/seed), approval checks, CAB voting, IAM policies, MDM enrollment codes, and audit logs directly in browser memory. |
| **Backend Server** | Node.js Express (`server.ts`, 572 lines) + `server/gemini.ts` (749 lines) | Serves Vite middleware / static `dist/` plus 10 stateless `/api/*` endpoints for Gemini AI (`gemini-4-hydrogen`), telephony status/probes/bridging, and database metadata. Contains **no authentication middleware, no rate limiting, no SSRF validation, and no relational database**. |
| **Persistence & Sync** | Firebase Auth (Google popup) + Firestore (`src/lib/firebase.ts`, `src/services/firestoreSync.ts`) + `localStorage` | Workspaces are keyed by a single Google user's `ownerUid` (`/workspaces/{ownerUid}/...`), not true multi-user organization tenancy. Most ITSM modules (Problems, Changes, Assets, Inventory, Workflows, IAM, Billing, Telephony, Device Trust) are serialized into generic `module_state/{bucketId}` JSON arrays capped at 500 items. |
| **Security Rules** | `firestore.rules` (421 lines) & `security_spec.md` | Strong Firestore field-size/schema guards, but contains a hardcoded super-admin email (`neerej.suresan.s@gmail.com`) and operates per-workspace-owner rather than true organization RBAC. |

### 1.2 Existing Express API Endpoints (`server.ts`)
1. `GET /api/health` — Basic liveness JSON response.
2. `GET /api/system/database-info` — Reads `firebase-applet-config.json` metadata.
3. `POST /api/wiki/grounding` — Gemini Google Search grounded wiki updates (`server/gemini.ts`).
4. `POST /api/ai/triage-incident` — Gemini structured incident triage.
5. `POST /api/ai/assess-change` — Gemini CAB change risk assessment.
6. `POST /api/ai/draft-kb` — Gemini Knowledge Base article drafting.
7. `POST /api/ai/copilot` — Multi-turn ITSM AI Copilot.
8. `POST /api/ai/triage-assistant` — Deep incident triage + KB matching.
9. `GET /api/telephony/status` — Reports whether server Twilio credentials/webhook secret exist.
10. `POST /api/telephony/test-connection` — Probes Twilio or user-supplied HTTPS/WSS endpoint (**unauthenticated + SSRF risk**).
11. `POST /api/telephony/bridge-call` — Triggers Twilio two-leg call or posts to user-supplied `outboundWebhookUrl` (**unauthenticated + SSRF risk + unvalidated webhook destination**).

---

## 2. Feature-Preservation Matrix

| Existing Feature | Existing Implementation | Target Scribble-IT 2.0 Architecture | Migration Status |
| --- | --- | --- | --- |
| **Multi-Portal Authentication** (Super Admin, Employee, IAM, End-User) | Client-side credential comparison against `authAccounts` in `ITSMContext.tsx` + `localStorage` | FastAPI `/api/v1/auth/*`, Argon2id password hashes, short-lived JWT access tokens, hashed rotating refresh tokens, server-side sessions & MFA | Planned (Phase 2) |
| **Multi-Tenant Organizations & Branding** | `Tenant` records in `ITSMContext.tsx` + Firestore `/tenants/{id}` with base64 logos | PostgreSQL `organizations`, `organization_memberships`, `organization_branding`, S3/object storage logos, PostgreSQL RLS (`organization_id`) | Planned (Phase 2) |
| **Super Admin Governance** (Company updates, module toggles, DB controls) | Client-side `isSuperAdmin` checks in `ITSMContext.tsx` & `SuperAdminOnlyGate` | Server-enforced `platform_super_admin` role in PostgreSQL RBAC tables + middleware + append-only audit logs | Planned (Phase 2) |
| **IAM Policies & Granular Scopes** (`incidents:read/write`, `assets:read/write`, `workflows:manage`, `billing:read`, `iam:manage`, `devices:enroll_code`, `tenants:admin`) | `IamPolicy` arrays in `ITSMContext.tsx` + `hasPermission()` client helper | Normalized PostgreSQL `roles`, `permissions`, `role_permissions`, `membership_roles` + FastAPI dependency guards | Planned (Phase 2) |
| **Device Trust & IAM Enrollment Codes (`IAM-XXXX-XXXX`)** | Client-side code generation/redemption & `localStorage` `managedDevice` certificate | PostgreSQL `device_enrollment_codes` (hashed single-use TTL tokens) + `managed_devices` + cryptographic device attestation & server revocation | Planned (Phase 2) |
| **Navigation RBAC Registry & Global Search** | `src/config/navigationAccess.ts`, `ServiceNowNavigator.tsx`, `GlobalSearchBar.tsx` | Server-computed capability manifest (`/api/v1/auth/me`) + backend full-text search (`/api/v1/search`) respecting RLS & scopes | Preserved (Phase 5 wiring) |
| **Incidents & Activity Stream** | `IncidentModule.tsx`, `NewIncidentPage.tsx`, `ITSMContext.tsx` + Firestore `/incidents` | PostgreSQL `incidents`, `incident_activities`, `incident_links`, `incident_attachments` + `/api/v1/incidents/*` | Planned (Phase 3) |
| **Service Requests & Designated Approvers + Separation of Duties** | `RequestModule.tsx`, `canApproveRequestStage()`, `approveRequestStage()` in `ITSMContext.tsx` | PostgreSQL `service_catalog_items`, `service_requests`, `request_approvals` + server-enforced approver binding & SoD transaction checks | Planned (Phase 3) |
| **Problem Management & Known Errors** | `ProblemModule.tsx`, `NewProblemPage.tsx` in `ITSMContext.tsx` + Firestore bucket | PostgreSQL `problems`, `problem_incidents` + `/api/v1/problems/*` | Planned (Phase 3) |
| **Change Advisory Board (CAB) Voting** | `ChangeModule.tsx`, `canVoteCab()`, `voteCab()` in `ITSMContext.tsx` + Firestore bucket | PostgreSQL `change_requests`, `change_approvals`, `change_incidents` + server-enforced designated voter verification | Planned (Phase 3) |
| **SLA Engine & Business Calendars** | Client-side deadline math in `ITSMContext.tsx` + `SlaTimer.tsx` | PostgreSQL `sla_policies`, `sla_instances`, `business_calendars`, `holidays` + Celery/Redis SLA breach worker | Planned (Phase 3) |
| **CMDB, Assets, Network Map, Hardware Inventory, Software Licences, Contracts, Domains** | `AssetModule.tsx`, `CmdbNetworkMapPage.tsx`, `InventoryModule.tsx`, `SoftwareInventoryPage.tsx`, `ContractsRfpPage.tsx`, `DomainsRegisterPage.tsx` | Normalized PostgreSQL `configuration_items`, `ci_relationships`, `assets`, `asset_assignments`, `inventory_items`, `software_licenses`, `contracts`, `domains` | Planned (Phase 3) |
| **Watchtower, War Room, Morning Checks, Service Status, Calendar & Rota, Tasks Kanban, Projects** | `src/pages/freeitsm/*` backed by `ITSMContext.tsx` arrays + Firestore buckets | Dedicated PostgreSQL domain tables + FastAPI routers under `/api/v1/` | Planned (Phase 3–4) |
| **Knowledge Base, System Wiki, LMS Training** | `KnowledgeBasePage.tsx`, `SystemWikiPage.tsx`, `LmsPage.tsx` | PostgreSQL `knowledge_articles`, `knowledge_versions`, `wiki_pages`, `lms_courses` + versioned publishing | Planned (Phase 3–4) |
| **Visual Workflows, Ticket Routing Rules, Process Mapper, Custom Forms Builder** | `WorkflowManagementPage.tsx`, `TicketWorkflowPage.tsx`, `ProcessMapperPage.tsx`, `CustomFormsBuilderPage.tsx` | PostgreSQL `workflow_definitions`, `workflow_executions`, `workflow_execution_steps`, `custom_forms` + async Redis worker | Planned (Phase 4) |
| **Reporting & Append-Only Audit Logs** | `ReportsAuditPage.tsx` + `auditLogs` array in `ITSMContext.tsx` | PostgreSQL append-only `audit_logs` (REVOKE UPDATE/DELETE for runtime role) + server-side reporting aggregations | Foundation in Phase 1 / Full in Phase 2 & 4 |
| **Invoices & Billing** | `BillingModule.tsx`, `NewInvoicePage.tsx` | PostgreSQL `invoices`, `invoice_line_items` + `/api/v1/billing/*` gated by `billing:read/write` | Planned (Phase 4) |
| **Gemini AI Capabilities** (Triage, CAB Assessment, KB Drafting, Wiki Grounding, Copilot) | `server/gemini.ts` + `src/services/aiService.ts` via unauthenticated Express routes | Authenticated FastAPI `/api/v1/ai/*` services with per-tenant rate limits, strict output validation, and AI audit logging | Preserved in Express; migrating in Phase 4 |
| **Telephony Softphone & Personal Mobile Bridge** | `TelephonyModule.tsx` + `server.ts` (`/api/telephony/*`) | FastAPI `/api/v1/telephony/*` with encrypted tenant provider secrets, HMAC webhook verification, and strict SSRF protection | Preserved in Express; migrating in Phase 4 |
| **Google Workspace Integrations** (Drive, Forms, Chat, Sheets) | Client-side OAuth access token in `src/lib/firebase.ts` + `src/services/workspaceService.ts` | Backend OAuth adapter (`backend/app/integrations/google/`) with encrypted token vault & tenant-scoped audit trail | Preserved in React; migrating in Phase 4 |
| **Self-Service Customer Portal & Pre-Login Marketing Site** | `CustomerPortal.tsx`, `NewPortalTicketPage.tsx`, `LandingWebsitePage.tsx` | Preserved UI backed by scoped end-user FastAPI endpoints (`/api/v1/portal/*`) | Preserved (Phase 5 wiring) |

---

## 3. Security Weaknesses & Simulated Functionality Identified

### 3.1 Critical Security Weaknesses in 1.x
1. **Client-Side Authentication & Plaintext Passwords**: `ITSMContext.tsx` and `enterpriseSeedGenerator.ts` store plaintext passwords (`Admin@Scribble2025`, etc.) in browser memory/`localStorage` and validate credentials client-side.
2. **Client-Enforced Authorization & Tenant Isolation**: `isSuperAdmin`, `isIamPortal`, `hasPermission()`, `canApproveRequestStage()`, and `canVoteCab()` execute purely in the browser; any user with DevTools can mutate state or bypass checks.
3. **Hardcoded Super-Admin Email in `firestore.rules`**: Line 35 of `firestore.rules` hardcodes `request.auth.token.email == 'neerej.suresan.s@gmail.com'`.
4. **Unauthenticated Express API Endpoints**: All `/api/ai/*`, `/api/wiki/grounding`, and `/api/telephony/*` routes in `server.ts` accept anonymous requests without JWT/session verification or rate limiting.
5. **SSRF & Arbitrary Outbound Webhook Exposure**: `POST /api/telephony/test-connection` and `POST /api/telephony/bridge-call` fetch arbitrary user-supplied URLs (`endpointUrl`, `outboundWebhookUrl`) without blocking loopback (`127.0.0.1`), RFC1918 private networks, or cloud metadata (`169.254.169.254`) or revalidating redirects.
6. **Single-Owner Firestore Data Model**: Storing multi-tenant enterprise records under `/workspaces/{ownerUid}` prevents real multi-user concurrent RBAC collaboration across organizations.
7. **Simulated / Local-Only Capabilities**:
   - MDM device certificates (`certificateThumbprint`) and device enrollment codes are generated and verified in browser `localStorage`.
   - Workflow execution engine traces, SLA countdown breaches, LMS completion scores, and morning check notifications run only in browser state without server-side scheduling or persistence guarantees.
   - Telephony softphone call timer and live transcript simulation run in browser React state unless Twilio/personal dialer bridge is invoked.

### 3.2 Architecture & Migration Risks
| Risk | Severity | Mitigation Strategy |
| --- | --- | --- |
| **Big-Bang Rewrite Regression** (breaking 30+ working screens) | High | Strangler-fig phased migration: keep `src/` + `server.ts` live while building and testing `backend/` in Phases 1–4, then swap `ITSMContext.tsx` domain-by-domain in Phase 5. |
| **Monolithic `ITSMContext.tsx` Coupling** (3,669 lines imported across ~50 components) | High | Introduce typed domain service clients (`apps/web` or `src/api/v2/*`) and domain hooks incrementally before removing `ITSMContext.tsx` backing arrays. |
| **Cross-Tenant Data Leakage** | Critical | Enforce dual-layer isolation: explicit `organization_id` membership validation in FastAPI dependencies + PostgreSQL Row-Level Security (`FORCE ROW LEVEL SECURITY`) with a `NOBYPASSRLS` runtime role (`scribble_app`). |
| **Database Privilege Confusion** | High | Enforce strict role separation from Phase 1: `MIGRATION_DATABASE_URL` (`scribble_migrator`) exclusively for Alembic DDL; `DATABASE_URL` (`scribble_app`) exclusively for runtime DML. Production config validator blocks superuser DB usernames. |
| **Migration of Legacy Plaintext Passwords** | Critical | Non-negotiable rule: **never migrate 1.x plaintext demo passwords**. Require fresh user registration or secure password-reset onboarding hashed with Argon2id. |
| **No Git Repository Initialized in Current Sandbox** | Medium | Repository root has no `.git` directory; preserve all existing 1.x source files unmodified in place during Phase 1 so rollback is zero-risk. |
