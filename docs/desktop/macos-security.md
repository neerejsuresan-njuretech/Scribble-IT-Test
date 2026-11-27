# SCRIBBLE-IT for macOS — Security Architecture

This document summarizes the threat model and implemented security controls for the SCRIBBLE-IT macOS Desktop client (`src-tauri/` and `src/desktop/`).

---

## 1. Credential Storage (Apple Keychain)

- **Mechanism:** Access tokens, rotating refresh tokens, and the active organization ID are stored natively via the Rust `keyring` crate compiled on macOS with `features = ["apple-native"]` (`Security.framework` Apple Keychain under service `in.njuretech.scribbleit.macos`).
- **No Plaintext LocalStorage:** Native desktop refresh tokens are never persisted in unencrypted `.json` configuration files or browser `localStorage`.
- **Allowlisted Vault Keys:** Only `access_token`, `refresh_token`, and `organization_id` (plus `api_base_url` validation) are accepted by Rust vault commands.
- **Memory Scrubbing:** Secret buffers passed through Rust vault commands are wrapped in `zeroize::Zeroizing<String>`.
- **Automatic Rotation & Revocation:** On backend `401`, `@scribble-it/api-client` performs a single-flight `POST /api/v1/auth/refresh`, updates Apple Keychain with the rotated token pair, or wipes Keychain session entries and triggers `onSessionExpired` if refresh fails or reuse is detected.

---

## 2. Backend Transport & Endpoint Hardening

- **HTTPS Mandatory:** `validate_api_base_url` (Rust & TypeScript) rejects plain `http://` for remote servers, rejects embedded credentials (`user:pass@`), and rejects query strings or fragments on the base URL.
- **Dev Loopback Exception:** `http://localhost` / `http://127.0.0.1` is permitted strictly for local developer testing.
- **Zero Bundled Secrets:** Gemini AI keys (`GEMINI_API_KEY`), PostgreSQL credentials, and push provider credentials remain exclusively on the FastAPI backend—never embedded inside the `.app` or `.dmg`.

---

## 3. Hardened Runtime, Entitlements & Capability Isolation

- **Hardened Runtime (`src-tauri/tauri.conf.json`):** `bundle.macOS.hardenedRuntime: true` with `minimumSystemVersion: "12.0"` and minimal `src-tauri/Entitlements.plist` (`com.apple.security.network.client: true`, zero JIT or unsigned-executable-memory exemptions).
- **`withGlobalTauri: false` & Strict CSP:** Global JS bridge injection is disabled; CSP enforces `script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, and `base-uri 'self'`.
- **Least-Privilege ACL (`src-tauri/capabilities/default.json`):** Zero `fs:*` and zero `shell:*` permissions; external links route through Rust `open_external_url` HTTPS validation.

---

## 4. Deep-Link (`scribbleit://`) & Single-Instance Protection

- Custom protocol `scribbleit://` (`CFBundleURLTypes` + `tauri-plugin-deep-link` `on_open_url` + `tauri-plugin-single-instance`) passes through Rust `sanitize_deep_link` and TypeScript `validateDesktopDeepLink`.
- **Auth-Bypass Prevention:** Deep links carrying `token`, `access_token`, `refresh_token`, `session`, `session_id`, `role`, `portal_type`, `admin`, or `sso_token` query parameters are strictly rejected.
- **Session Gate:** Deep links navigate only to allowlisted ITSM routes after authentication is verified; unauthenticated launches land at login.

---

## 5. Honest Device Trust Boundary

- `get_desktop_runtime_info` reports `client_platform: "macos"`, `os_version`, a deterministic host identifier (`device_fingerprint`), and `mdm_claimed: false`.
- Host fingerprints identify the local Mac client for session visibility and **are never treated as independent MDM attestation or permitted to bypass IAM enrollment**.
