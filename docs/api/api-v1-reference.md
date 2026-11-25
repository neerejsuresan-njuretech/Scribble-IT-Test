# Scribble-IT 2.0 — REST API v1 Reference

Base prefix: `/api/v1`  
Authentication: `Authorization: Bearer <access_token>` (15-minute JWT access token + rotating refresh token).  
Tenant Scoping: Derived server-side from JWT membership + optional `X-Organization-ID` header validated against active organization memberships and PostgreSQL RLS (`app.current_organization_id`).

## Platform & Observability
| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Liveness probe |
| `GET` | `/api/v1/health/ready` | Readiness probe (verifies PostgreSQL non-superuser role + Redis) |
| `GET` | `/api/v1/version` | Build version & runtime environment |
| `GET` | `/api/v1/metrics` | Prometheus text exposition metrics (uptime, DB pool, Redis, worker heartbeat) |

## Authentication & Sessions (`/api/v1/auth`)
- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
- `GET /auth/me`, `GET /auth/sessions`, `DELETE /auth/sessions/{session_id}`
- `POST /auth/password-reset/request`, `POST /auth/password-reset/confirm`
- `POST /auth/email-verification/request`, `POST /auth/email-verification/confirm`
- `POST /auth/mfa/enroll`, `POST /auth/mfa/verify`, `POST /auth/users/{user_id}/suspend`

## Organizations, IAM, Device Trust, Approvals & Governance
- **Organizations**: `GET/POST /organizations`, `POST /organizations/switch`, `PATCH /organizations/{id}/config`
- **IAM & RBAC**: `GET /iam/roles`, `GET/POST /iam/policies`, `POST /iam/memberships/{id}/roles`, `GET /iam/effective-permissions`
- **Device Trust**: `GET/POST /iam/devices/enrollment-codes`, `POST /iam/devices/enroll`, `GET /iam/devices`, `POST /iam/devices/{id}/revoke`
- **Approvals**: `GET/POST /approvals`, `POST /approvals/{id}/decide` (server-side human authorization & maker-checker)
- **Governance & Audit**: `GET/PATCH /governance/config`, `GET /audit/logs` (append-only immutable audit trail)

## Core ITSM Modules
- **Incidents**: `GET/POST /incidents`, `GET/PATCH /incidents/{id}`, `POST /incidents/{id}/activities`, `POST /incidents/{id}/attachments`, `POST /incidents/{id}/resolve`, `POST /incidents/{id}/close`
- **Service Requests**: `GET/POST /requests/catalog`, `GET/POST /requests`, `PATCH /requests/{id}`, `POST /requests/{id}/approvals/{stage_id}/decide`
- **Problems**: `GET/POST /problems`, `PATCH /problems/{id}`, `POST /problems/{id}/incidents/{incident_id}`
- **Changes & CAB**: `GET/POST /changes`, `PATCH /changes/{id}`, `GET/POST /changes/cab-members`, `POST /changes/{id}/cab-votes`
- **Assets, CMDB & Inventory**: `GET/POST/PATCH /cmdb/assets`, `GET/POST/DELETE /cmdb/relationships`, `GET/POST/PATCH /cmdb/inventory`, `GET/POST/PATCH /cmdb/software-licenses`
- **Operations**: `/operations/sla-policies`, `/operations/knowledge`, `/operations/workflows`, `/operations/notifications`, `/operations/reports/summary`, `/operations/tasks`, `/operations/projects`, `/operations/service-status`, `/operations/invoices`, `/operations/contracts`, `/operations/domains`

## Secured AI Assistant (`/api/v1/ai`)
All endpoints require authenticated JWT + org-level daily quota + per-user sliding-window rate limit, use backend-only `GEMINI_API_KEY`, log to append-only `ai_interaction_logs`, and return `requiresHumanApproval: true`. AI can **never** independently approve requests, cast CAB votes, modify IAM permissions, or execute Super Admin governance actions.
- `POST /api/v1/ai/triage-incident`
- `POST /api/v1/ai/triage-assistant`
- `POST /api/v1/ai/assess-change`
- `POST /api/v1/ai/draft-kb`
- `POST /api/v1/ai/wiki-assist`
- `POST /api/v1/ai/copilot`
- `GET /api/v1/ai/usage`

## External Integrations, Webhooks & Telephony (`/api/v1/integrations`)
All stored API credentials and OAuth tokens are encrypted at rest via `INTEGRATION_ENCRYPTION_KEY`; all outbound URLs pass strict SSRF validation; all inbound webhooks enforce HMAC signatures and replay windows.
- `GET/POST /integrations/connections`, `PATCH /integrations/connections/{id}`, `POST /integrations/connections/{id}/oauth-tokens`
- `POST /integrations/google/execute` (Drive, Sheets, Forms, Chat via host-allowlisted backend adapter)
- `GET/POST /integrations/webhooks`, `POST /integrations/webhooks/{id}/test`
- `POST /integrations/webhooks/inbound/{org_slug}` (HMAC-SHA256 + timestamp replay window)
- `GET /integrations/telephony/calls`, `POST /integrations/telephony/calls/outbound`
- `POST /integrations/telephony/webhooks/twilio/{org_slug}` (Twilio HMAC-SHA1 verification)
- `POST /integrations/notifications/dispatch`, `GET /integrations/jobs`
