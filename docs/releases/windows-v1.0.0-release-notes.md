# SCRIBBLE-IT for Windows — v1.0.0 Release Notes

**Product:** SCRIBBLE-IT  
**Tagline:** Enterprise IT Management. Open to Everyone.  
**Organization:** Njure Tech (formally Njure Group)  
**Target Platform:** Windows 10 (1809+) & Windows 11 (`x86_64`)  
**Distribution:** GitHub Releases (`SCRIBBLE-IT_1.0.0_x64-setup.exe`, optional `SCRIBBLE-IT_1.0.0_x64_en-US.msi`, and `SHA256SUMS.txt`)

---

## Summary

v1.0.0 delivers the native Tauri 2 Windows Desktop client for SCRIBBLE-IT alongside automated Windows CI NSIS (`.exe`) and WiX (`.msi`) installer build, silent install/launch/uninstall verification, and direct website integration on `https://scribbleit.njuregroup.in`.

## Highlights

- **Shared React 19 + `@scribble-it/*` Core:** Reuses the complete web application portals (Employee Operations, Super Admin, IAM, End-User Self-Service) and shared TypeScript packages (`@scribble-it/types`, `@scribble-it/api-client`, `@scribble-it/rbac`, `@scribble-it/design-tokens`).
- **Windows Credential Manager Vault:** Stores JWT access tokens, rotating refresh tokens, and organization context inside native Windows DPAPI Credential Manager (`keyring` with `windows-native` + `zeroize`).
- **Task 5.3 Backend Integration:** Sends native `X-Scribble-Client-*` headers, discovers `/api/v1/client/config`, supports cloud & self-hosted HTTPS server switching, lists and revokes live sessions (`/api/v1/auth/sessions`), and handles single-flight token rotation and expiration recovery.
- **Native Windows OS Features:**
  - Native Windows toast alerts for unread backend incident/system notifications.
  - Bounded 10 MiB native file picker with path sanitization and SHA-256 verification for incident attachments.
  - Safe `scribbleit://` deep-link handler with strict route allowlist and anti-auth-bypass validation.
  - Optional Launch on Windows Sign-In (`tauri-plugin-autostart`).
- **Verified NSIS & WiX Bundling + CI:** Generates and smoke-tests `SCRIBBLE-IT_1.0.0_x64-setup.exe` and `SCRIBBLE-IT_1.0.0_x64_en-US.msi` on `windows-latest` with `SHA256SUMS.txt` and `installation-verification.txt`.

## Checksum Verification & Signing Notice

- Installers are currently **unsigned** (`certificateThumbprint: null`) pending an organization Windows Authenticode certificate.
- Before executing a downloaded installer, verify its SHA-256 hash against the `SHA256SUMS.txt` asset attached to the GitHub Release:
  ```powershell
  Get-FileHash .\SCRIBBLE-IT_1.0.0_x64-setup.exe -Algorithm SHA256
  ```
