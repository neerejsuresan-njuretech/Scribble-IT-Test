# SCRIBBLE-IT for macOS — v1.0.0 Release Notes

**Product:** SCRIBBLE-IT  
**Tagline:** Enterprise IT Management. Open to Everyone.  
**Organization:** Njure Tech (formally Njure Group)  
**Target Platform:** macOS 12 Monterey or newer (`Apple Silicon arm64` & `Intel x86_64`)  
**Distribution:** GitHub Releases (`SCRIBBLE-IT_1.0.0_arm64.dmg`, `SCRIBBLE-IT_1.0.0_x64.dmg`, and `SHA256SUMS-macos.txt`)

---

## Summary

v1.0.0 extends the production SCRIBBLE-IT Tauri 2 desktop client to macOS alongside the published Windows desktop client—reusing the React 19 + TypeScript workspace, `@scribble-it/*` shared packages, and Task 5.3 FastAPI `/api/v1` backend while integrating native Apple Keychain, Notification Center, Login Items autostart, hardened runtime configuration, and Finder-branded `.dmg` installers.

## Highlights

- **Shared React 19 + `@scribble-it/*` Core:** Full portal parity (Super Admin Watchtower, Employee Operations, IAM Portal, End-User Self-Service) with zero duplicated business logic.
- **Apple Keychain Token Vault:** Stores JWT access tokens, rotating refresh tokens, and active organization ID natively in Apple Keychain (`keyring` with `apple-native` / `Security.framework` + `zeroize` memory scrubbing under service `in.njuretech.scribbleit.macos`).
- **Task 5.3 Backend Integration:** Emits accurate macOS `X-Scribble-Client-*` metadata, supports cloud & self-hosted HTTPS backend URL configuration with `/api/v1/client/config` verification, session inventory & revocation, and single-flight refresh rotation.
- **Native macOS Integrations:**
  - macOS Notification Center alerts for unread backend incident and SLA notifications.
  - Native file picker (`10 MiB` cap, path sanitization, SHA-256 checksum) for incident attachments.
  - Safe `scribbleit://` Apple Event / deep-link handling with strict route allowlist and anti-auth-bypass filtering.
  - Optional Launch at macOS Login (`LaunchAgent` via `tauri-plugin-autostart`).
- **Dual-Architecture `.dmg` Packaging & CI:** Configures `aarch64-apple-darwin` (Apple Silicon) and `x86_64-apple-darwin` (Intel) `.app`/`.dmg` packaging with branded `dmg-background.png`, Hardened Runtime (`Entitlements.plist`), `SHA256SUMS-macos.txt`, and automated `.dmg` mount/launch verification via `.github/workflows/macos-desktop-ci.yml`.

## Checksum Verification & Signing Notice

- Developer ID code signing and Apple notarization require repository signing/notarization secrets (`APPLE_SIGNING_IDENTITY`, `APPLE_CERTIFICATE`, `APPLE_ID` / App Store Connect API credentials). Without those secrets configured, CI artifacts are honestly labeled **Unsigned / Not Notarized**.
- Verify downloaded `.dmg` files against `SHA256SUMS-macos.txt` before opening:
  ```bash
  shasum -a 256 ~/Downloads/SCRIBBLE-IT_1.0.0_arm64.dmg
  ```
