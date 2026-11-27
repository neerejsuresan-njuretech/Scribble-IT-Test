# SCRIBBLE-IT for Linux — v1.0.0 Release Notes

**Product:** SCRIBBLE-IT  
**Tagline:** Enterprise IT Management. Open to Everyone.  
**Organization:** Njure Tech (formally Njure Group)  
**Target Platform:** Linux `x86_64` (`Ubuntu 22.04+`, `Debian 12+`, `Fedora`, `RHEL 9+`, GLIBC `2.35+`)  
**Distribution:** GitHub Releases (`.deb`, `.rpm`, `.AppImage`, and `SHA256SUMS-linux.txt`)

---

## Summary

v1.0.0 extends the production SCRIBBLE-IT Tauri 2 desktop client to Linux alongside the Windows and macOS desktop clients—reusing the React 19 + TypeScript workspace, `@scribble-it/*` shared packages, and Task 5.3 FastAPI `/api/v1` backend while integrating Freedesktop Secret Service keyring storage, native desktop notifications, XDG autostart, and `.deb` / `.rpm` / `.AppImage` packaging.

## Highlights

- **Shared React 19 + `@scribble-it/*` Core:** Full portal parity (Super Admin Watchtower, Employee Operations, IAM Portal, End-User Self-Service) with zero duplicated UI or business logic.
- **Freedesktop Secret Service Keyring:** Stores JWT access tokens, rotating refresh tokens, and active organization ID natively via `keyring` (`sync-secret-service` supporting GNOME Keyring & KWallet + `zeroize` memory scrubbing under service `in.njuretech.scribbleit.linux`).
- **Task 5.3 Backend Integration:** Emits accurate Linux `client_platform: "linux"` and `/etc/os-release` distribution metadata via `X-Scribble-Client-*` headers, supports cloud & self-hosted HTTPS backend URL verification (`/api/v1/client/config`), session inventory & revocation, and single-flight refresh rotation.
- **Native Linux Integrations:**
  - Freedesktop desktop notifications for unread backend incident and SLA alerts.
  - Native file picker (`10 MiB` cap, path sanitization, SHA-256 checksum) for incident attachments.
  - Safe `scribbleit://` XDG deep-link & single-instance handling with strict route allowlist and anti-auth-bypass filtering.
  - Optional Launch on Linux Login (`~/.config/autostart/` via `tauri-plugin-autostart`).
- **Multi-Format Linux Packaging & Ubuntu LTS CI:** Configures `.deb` (`libwebkit2gtk-4.1-0`, `libgtk-3-0`), `.rpm` (`webkit2gtk4.1`, `gtk3`), and portable `.AppImage` builds with AppStream `metainfo.xml`, `SHA256SUMS-linux.txt`, and automated extraction + launch smoke checks on `ubuntu-22.04` via `.github/workflows/linux-desktop-ci.yml`.

## Checksum Verification & Limitations

- Always verify downloaded packages against `SHA256SUMS-linux.txt` before installing:
  ```bash
  sha256sum -c SHA256SUMS-linux.txt --ignore-missing
  ```
- **Current Architecture Scope:** Official Linux release packages target `x86_64` (`amd64`). ARM64 (`aarch64`) Linux packages are not yet published.
- **Package Signing:** Packages include SHA-256 checksum verification; GPG `apt`/`dnf` repository signing is pending.
