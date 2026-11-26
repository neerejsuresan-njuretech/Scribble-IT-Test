# SCRIBBLE-IT for Windows — v1.0.0 Pre-Release Notes

**Product:** SCRIBBLE-IT  
**Tagline:** Enterprise IT Management. Open to Everyone.  
**Organization:** Njure Tech (formally Njure Group)  
**Target Platform:** Windows 10 (1809+) & Windows 11 (`x86_64`)  
**Release Status:** In Development (Source Complete · Signed Public Installer Pending)

---

## Summary

Task 5.4.1 introduces the Tauri 2 Windows Desktop client for SCRIBBLE-IT and integrates Windows desktop documentation and availability status into the official product website.

## Highlights

- **Shared React 19 + `@scribble-it/*` Core:** Reuses the complete web application portals (Employee Operations, Super Admin, IAM, End-User Self-Service) and shared TypeScript packages (`@scribble-it/types`, `@scribble-it/api-client`, `@scribble-it/rbac`, `@scribble-it/design-tokens`).
- **Windows Credential Manager Vault:** Stores JWT access tokens, rotating refresh tokens, and organization context inside native Windows DPAPI Credential Manager (`keyring` with `windows-native` + `zeroize`).
- **Task 5.3 Backend Integration:** Sends native `X-Scribble-Client-*` headers, discovers `/api/v1/client/config`, supports cloud & self-hosted HTTPS server switching, lists and revokes live sessions (`/api/v1/auth/sessions`), and handles single-flight token rotation and expiration recovery.
- **Native Windows OS Features:**
  - Native Windows toast alerts for unread backend incident/system notifications.
  - Bounded 10 MiB native file picker with path sanitization and SHA-256 verification for incident attachments.
  - Safe `scribbleit://` deep-link handler with strict route allowlist and anti-auth-bypass validation.
  - Optional Launch on Windows Sign-In (`tauri-plugin-autostart`).
- **NSIS & WiX Bundling + CI:** Configured `.exe` and `.msi` installers with verified Task 5.2 icon and wizard BMP assets and a dedicated GitHub Actions workflow (`.github/workflows/windows-desktop-ci.yml`).

## Known Limitations / Pending Verification

- Installers are currently **unsigned** (`certificateThumbprint: null`) pending an organization Windows Authenticode certificate.
- Rust compilation (`cargo test`) and `.exe` / `.msi` bundling (`tauri build`) require a Windows host or the GitHub Actions `windows-latest` runner and have not yet been executed inside the Linux build sandbox.
