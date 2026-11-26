# SCRIBBLE-IT Shared TypeScript Workspace Packages

This document defines the shared cross-platform TypeScript architecture introduced in Task 5.2 to support the existing React web application as well as future native desktop (**Tauri** for Windows, macOS, Linux) and mobile (**React Native** for Android, iOS) clients without code duplication.

---

## 1. Workspace Dependency Architecture (Acyclic DAG)

All four shared packages live under `packages/*` and are registered via npm workspaces in the root `package.json`. They contain **zero React dependencies**, **zero DOM dependencies**, and **zero Express server routes**.

```text
@scribble-it/types            (Zero internal dependencies)
@scribble-it/design-tokens    (Zero internal dependencies)
       ▲
       │
@scribble-it/rbac             (Depends on: @scribble-it/types)
@scribble-it/api-client       (Depends on: @scribble-it/types)
       ▲
       │
SCRIBBLE-IT Web App (root)    (Consumes all four via backward-compatible shims)
Future apps/desktop (Tauri)   (Planned — not scaffolded yet)
Future apps/mobile (RN)       (Planned — not scaffolded yet)
```

---

## 2. Package Reference & Export Catalog

### 2.1 `@scribble-it/types` (`packages/types`)
Canonical TypeScript domain models and FastAPI `/api/v1` Data Transfer Objects (DTOs).

- **Source files**: `src/itsm.ts`, `src/api.ts`, `src/index.ts`
- **Key exports**:
  - Core ITSM domain models: `Incident`, `ServiceRequest`, `Problem`, `ChangeRequest`, `Asset`, `ConfigurationItem`, `KnowledgeArticle`, `User`, `Role`, `Tenant`, `SLAPolicy`, `WorkflowRule`, `AuditLog`, `PortalClearanceTier`, `PageId`, `IncidentPriority`, `IncidentStatus`, `ChangeRisk`, etc.
  - FastAPI v1 DTO interfaces: `AuthTokenResponseDto`, `AuthMeDto`, `IncidentDto`, `ServiceRequestDto`, `ProblemDto`, `ChangeRequestDto`, `AssetDto`, `CmdbCiDto`, `KnowledgeArticleDto`, `NotificationDto`, `AuditEventDto`, `ReportSummaryDto`, `GlobalSearchResultDto`, `IntegrationConfigDto`, `AiTriageRequestDto`, `AiTriageResponseDto`, `AiChangeAssessmentRequestDto`, `AiChangeAssessmentResponseDto`, `AiKbDraftRequestDto`, `AiKbDraftResponseDto`, `AiCopilotRequestDto`, `AiCopilotResponseDto`.

### 2.2 `@scribble-it/api-client` (`packages/api-client`)
Platform-agnostic FastAPI `/api/v1` HTTP client with injectable token storage and base URL resolution.

- **Source files**: `src/storage.ts`, `src/httpClient.ts`, `src/authApi.ts`, `src/itsmApi.ts`, `src/cmdbApi.ts`, `src/operationsApi.ts`, `src/integrationsApi.ts`, `src/aiApi.ts`, `src/index.ts`
- **Core abstractions**:
  - `TokenStorageAdapter`: Sync or async (`string | null | Promise<string | null>`) storage interface so Web can use `localStorage`/`sessionStorage`, Tauri desktop can use OS keychains (Windows Credential Manager / macOS Keychain / Linux Secret Service), and React Native can use iOS Keychain / Android Keystore.
  - `BaseUrlProvider`: Sync or async base URL provider normalized automatically to `/api/v1` via `normalizeFastApiBaseUrl`.
  - `ScribbleHttpClient` & `createScribbleApiClient(options)`: Factory returning isolated `{ http, auth, itsm, cmdb, operations, integrations, ai, mappers }` instances.
- **Security guarantees preserved**:
  - Automatic `Authorization: Bearer <token>` and `X-Organization-ID` tenant scoping headers.
  - Single-flight 401 refresh-token rotation (`refreshPromise` mutex) so concurrent requests never race or trigger refresh-token reuse revocation.
  - Structured `ApiError(message, status, detail)` propagation.
  - Shared `aiApi` exclusively calls FastAPI `/api/v1/ai/*` endpoints (zero Express `/api/ai/*` dependencies; Gemini API keys remain backend-only).

### 2.3 `@scribble-it/rbac` (`packages/rbac`)
Pure enterprise RBAC, portal clearance, and navigation visibility engine.

- **Source files**: `src/navigationAccess.ts`, `src/permissions.ts`, `src/index.ts`
- **Key exports**:
  - Navigation policies: `SIDEBAR_NAV_POLICY`, `PAGE_ACCESS_POLICY`, `canAccessPage`, `getVisibleSidebarItems`, `getDefaultLandingPageForRole`.
  - Permission evaluators: `evaluateEffectivePermissions`, `resolveEffectiveHasPermission`, `hasAnyPermission`, `hasAllPermissions`, `isPortalSuperAdmin`, `isPortalIamOfficer`, `formatClearanceLabel`, `CANONICAL_PERMISSION_SCOPES`, `CLEARANCE_TIER_LABELS`.
- **Security model**: Frontend RBAC mirrors server-computed effective permissions from `/api/v1/auth/me` strictly for UX visibility; backend FastAPI middleware and PostgreSQL RLS remain the authoritative enforcement boundary.

### 2.4 `@scribble-it/design-tokens` (`packages/design-tokens`)
Single source of truth for SCRIBBLE-IT brand identity, light/dark themes, typography, spacing, radii, and ITSM operational semantics across Tailwind CSS (Web/Desktop) and React Native `StyleSheet`.

- **Source files**: `src/colors.ts`, `src/themes.ts`, `src/typography.ts`, `src/layout.ts`, `src/status.ts`, `src/index.ts`, `css/tokens.css`
- **Key exports**:
  - `SCRIBBLE_IT_BRAND` (official version-free product metadata & attribution).
  - `BRAND_PALETTE` (`#0B1F3B`, `#0A84FF`, `#22D3EE`, `#F5F8FF`) & `NEUTRAL_SCALE`.
  - `DARK_THEME` & `LIGHT_THEME` semantic token maps.
  - `TYPOGRAPHY`, `SPACING`, `RADII`, `BORDER_WIDTH`, `ELEVATION`.
  - `INCIDENT_PRIORITY_TOKENS` (`P1`–`P4`), `SLA_STATUS_TOKENS`, `ENTERPRISE_STATUS_TOKENS`.
  - `css/tokens.css` for CSS Custom Properties / Tailwind CSS v4 integration.

---

## 3. Backward-Compatible Web Integration

Existing web imports continue to work unchanged via zero-duplication re-export shims:

- `src/types/itsm.ts` -> re-exports `@scribble-it/types`
- `src/config/navigationAccess.ts` -> re-exports `@scribble-it/rbac`
- `src/hooks/usePermissions.ts` -> delegates evaluation to `@scribble-it/rbac`
- `src/services/api/*` -> re-exports `@scribble-it/api-client`
- `src/services/aiService.ts` -> delegates authenticated requests to `@scribble-it/api-client` `aiApi` while preserving web-only Express dev fallback when unauthenticated.

---

## 4. Workspace Development Commands

```bash
# Clean reproducible install of root app + all 4 shared workspaces
npm ci

# Typecheck all 4 shared packages individually
npm run typecheck:packages

# Typecheck root web application (including workspace imports)
npm run lint

# Run all frontend & shared package unit/architecture tests
npm run test:frontend

# Validate all brand assets, icons, binary headers, and zero-version rules
npm run verify:brand

# Build production web bundle and GitHub Pages bundle
npm run build
npm run build:pages
```
