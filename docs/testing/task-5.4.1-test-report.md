# SCRIBBLE-IT — Task 5.4.1 Verification & Test Report

**Scope:** Windows Desktop Application (Tauri 2) + Official Website Integration (`In Development`)  
**Environment:** Linux x86_64 sandbox (`Node.js` workspace toolchain available; Windows/Rust/WiX/NSIS/pytest toolchains not installed)

---

## 1. Executed & Passed Checks

| Check | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **Root TypeScript Check** | `npm run lint` (`tsc --noEmit`) | **PASS** | Zero TypeScript errors across web app, `src/desktop/`, and tests. |
| **Shared Workspace Type Checks** | `npm run typecheck:packages` | **PASS** | `@scribble-it/types`, `@scribble-it/design-tokens`, `@scribble-it/rbac`, and `@scribble-it/api-client` compiled cleanly. |
| **Frontend & Desktop Unit Tests** | `npm run test:frontend` | **PASS (21/21)** | Passed all 21 tests across `navigation_rbac.test.ts`, `api_client.test.ts`, `shared_packages.test.ts`, and `windows_desktop.test.ts` (~2.02s). |
| **Brand & Platform Asset Check** | `npm run verify:brand` | **PASS (517/517)** | Passed all 517 checks including Windows `.ico`, PNGs, NSIS/WiX installer `.bmp` headers/dimensions, and zero-version brand rules. |
| **GitHub Pages / Static Build** | `npm run build:pages` (`VITE_BASE_PATH=./ vite build`) | **PASS** | Built `dist/index.html`, JS, CSS, and visual assets in `3.55s` without breaking GitHub Pages compatibility. |

### Key Scenarios Verified in `tests/frontend/windows_desktop.test.ts` & `api_client.test.ts`
- **Desktop URL Hardening:** Enforces HTTPS on remote FastAPI endpoints, allows `http://localhost` / `http://127.0.0.1` strictly for local development, and rejects embedded credentials, query params, fragments, `file://`, and `javascript:`.
- **Deep-Link Auth-Bypass Guard:** Allows curated `scribbleit://` routes while strictly rejecting `token`, `access_token`, `refresh_token`, `session`, `session_id`, `role`, `portal_type`, `admin`, and `sso_token` query parameters.
- **Windows Credential Manager Bridge:** Verifies `WindowsCredentialTokenStorage` hydration, rotated refresh token persistence, and full token clearance on logout.
- **Task 5.3 Native API Contract:** Verifies `X-Scribble-Client-*` metadata headers, `/api/v1/client/config`, authenticated `POST /api/v1/auth/device/enroll` (carrying Bearer + `X-Organization-ID`), `GET /api/v1/auth/sessions`, `DELETE /api/v1/auth/sessions/{id}`, `POST /api/v1/incidents/{id}/attachments`, and `onSessionExpired` callback invocation on failed refresh.
- **Tauri Config & Security Audit:** Confirms `withGlobalTauri: false`, `certificateThumbprint: null` (honest unsigned posture), least-privilege capabilities (`main` window only, no `fs:*` / `shell:*`), and verifies all referenced Task 5.2 Windows icons and NSIS/WiX BMPs exist on disk.
- **Truthful Website Release State:** Confirms `WINDOWS_DESKTOP_CONFIG` remains `'In Development'` with empty installer URLs/SHA-256 when unconfigured.

---

## 2. Not Executed (Environment-Blocked in Linux Sandbox)

The following checks could **not** run in this Linux container because `cargo`, `rustc`, `rustup`, `makensis`, `wix`, `pytest`, and Windows 10/11 WebView2 are not installed (`command -v` confirmed `NOT INSTALLED`):

| Check | Command | Status | Blocker / Next Action |
| :--- | :--- | :--- | :--- |
| **Rust Unit Tests** | `cargo test --manifest-path src-tauri/Cargo.toml` | **NOT EXECUTED** | Requires Rust toolchain; configured in `.github/workflows/windows-desktop-ci.yml` (`windows-latest`). |
| **Windows Bundle Build (.exe & .msi)** | `npm run tauri:build:windows` | **NOT EXECUTED** | Requires Windows host + Rust + MSVC C++ Build Tools + NSIS + WiX (`windows-desktop-ci.yml`). |
| **Windows GUI / Credential Manager Runtime Test** | `npm run tauri:dev` + installer install/uninstall | **NOT EXECUTED** | Requires interactive Windows 10/11 session with WebView2 and Windows Credential Manager (`DPAPI`). |
| **FastAPI Backend Test Suite** | `pytest -v` (in `backend/`) | **NOT EXECUTED** | `pytest` and backend dependencies not installed in this container. |
