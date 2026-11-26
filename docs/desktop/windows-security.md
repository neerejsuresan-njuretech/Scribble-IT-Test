# SCRIBBLE-IT for Windows — Security Architecture

This document summarizes the threat model and implemented security controls for the SCRIBBLE-IT Windows Desktop client (`src-tauri/` and `src/desktop/`).

---

## 1. Credential Storage (Windows Credential Manager)

- **Mechanism:** Access tokens, rotating refresh tokens, and the active organization ID are stored exclusively via the Rust `keyring` crate compiled with `features = ["windows-native"]` (Windows DPAPI-backed Credential Manager under service `in.njuretech.scribbleit`).
- **No Plaintext LocalStorage:** Unlike browser ephemeral sessions, native desktop refresh tokens are never persisted in unencrypted `.json` files or `localStorage`.
- **Allowlisted Vault Keys:** Only `access_token`, `refresh_token`, and `organization_id` keys are accepted by `vault_set_secret`, `vault_get_secret`, and `vault_delete_secret`.
- **Memory Scrubbing:** Secret buffers retrieved or written in Rust are wrapped in `zeroize::Zeroizing<String>`.
- **Automatic Rotation & Revocation:** When FastAPI returns `401`, `@scribble-it/api-client` triggers a single-flight `POST /api/v1/auth/refresh`, updates Credential Manager with the rotated tokens, or clears Credential Manager + invokes `onSessionExpired` if refresh fails or reuse is detected.

---

## 2. Backend Transport & Endpoint Hardening

- **HTTPS Mandatory:** `validate_api_base_url` (Rust & TypeScript) rejects plain `http://` URLs for remote servers, rejects embedded credentials (`user:pass@`), and forbids query strings/fragments in the configured base URL.
- **Dev Loopback Exception:** `http://localhost` / `http://127.0.0.1` is allowed strictly for local development testing.
- **No Secret Leakage:** AI (`GEMINI_API_KEY`), PostgreSQL credentials, and push provider secrets stay exclusively on the FastAPI backend—never bundled inside the Windows binary.

---

## 3. Tauri 2 Privilege & Capability Isolation

- **`withGlobalTauri: false`:** Global `window.__TAURI__` object injection is disabled in `src-tauri/tauri.conf.json`.
- **Strict Content Security Policy (CSP):** Restricts `script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, and allows connections only to self, localhost dev ports, and `https:`.
- **Least-Privilege ACL (`src-tauri/capabilities/default.json`):**
  - Bound explicitly to `"windows": ["main"]`.
  - Zero `fs:*` permissions and zero `shell:*` permissions.
  - External links cannot use unvalidated frontend `opener:allow-open-url`; instead, links go through Rust `open_external_url`, which verifies `https://` (or loopback HTTP) before opening the system browser.

---

## 4. Deep-Link & Single-Instance Protection

- Custom protocol `scribbleit://` routes through `tauri-plugin-single-instance` + Rust `sanitize_deep_link` and TypeScript `validateDesktopDeepLink`.
- **No Authentication Bypass:** Deep links containing query parameters such as `token`, `access_token`, `refresh_token`, `session`, `session_id`, `role`, `portal_type`, `admin`, or `sso_token` are strictly rejected.
- **Protected Navigation:** Valid deep links only redirect to an allowlisted set of ITSM routes **after** checking `authSession.isAuthenticated`; unauthenticated launches always land at login.

---

## 5. Honest Device Trust Boundary

- `get_desktop_runtime_info` derives a deterministic SHA-256 host hardware fingerprint (`device_fingerprint`) and explicitly returns `mdm_claimed: false`.
- As required by Task 5.3/5.4 architecture, client fingerprints identify the host for user inspection and **never claim MDM attestation or bypass IAM enrollment** (`POST /api/v1/auth/device/enroll` requires an authenticated session and valid IAM enrollment code).

---

## 6. Bounded Native Attachment Handling

- `pick_incident_attachment` enforces a 10 MiB (`10,485,760` bytes) file limit matching `MAX_UPLOAD_BYTES`, sanitizes filenames against `..`/path-traversal characters, and computes a local SHA-256 integrity digest before passing metadata to the UI.
