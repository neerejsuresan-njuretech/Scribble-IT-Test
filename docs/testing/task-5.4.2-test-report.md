# SCRIBBLE-IT — Task 5.4.2 Verification & Test Report

**Scope:** macOS Desktop Application (Tauri 2, Apple Keychain, Hardened Runtime, `.dmg` Packaging) + Website Integration (`#macos-desktop`)  
**Environment:** Linux x86_64 sandbox (`Node.js v22.23.5`, `npm 10.9.9`, `Python 3.11.2`, `curl 7.88.1`; `cargo`, `rustc`, `gh`, `pytest`, and macOS `Darwin`/`hdiutil`/`codesign`/`Security.framework` are not installed in this container)

---

## 1. Executed & Passed Checks

| Check | Command / Verification | Result | Details |
| :--- | :--- | :--- | :--- |
| **Root TypeScript Check** | `npm run lint` (`tsc --noEmit`) | **PASS** | Zero TypeScript errors across web app, `src/desktop/`, `ServiceNowHeader.tsx`, `ITSMContext.tsx`, `LandingWebsitePage.tsx`, and tests. |
| **Shared Workspace Type Checks** | `npm run typecheck:packages` | **PASS** | `@scribble-it/types`, `@scribble-it/design-tokens`, `@scribble-it/rbac`, and `@scribble-it/api-client` compiled cleanly. |
| **Frontend & Desktop Unit Tests** | `npm run test:frontend` | **PASS (28/28)** | Passed all 28 tests across `navigation_rbac.test.ts`, `api_client.test.ts`, `shared_packages.test.ts`, `windows_desktop.test.ts`, and `macos_desktop.test.ts`. |
| **Brand & Five-Platform Asset Check** | `npm run verify:brand` | **PASS (517/517)** | Verified all SVG/PNG/ICO/ICNS/BMP assets including macOS `icon.icns`, `volume-icon.icns`, `icon.iconset/*`, `dmg-background.png` (`540x380`), `dmg-background@2x.png` (`1080x760`), Windows assets, and zero-version brand rules. |
| **Production Web & Pages Build** | `npm run build` & `npm run build:pages` | **PASS** | `vite build` (`VITE_BASE_PATH=./`) compiled `dist/` cleanly in ~2.44s. |
| **macOS Release Script Syntax** | `bash -n scripts/build-macos-release.sh` | **PASS** | Zero shell syntax errors; enforces `Darwin` host, `Info.plist`, `lipo`, `Security.framework`, `hdiutil attach` DMG mount, and `SHA256SUMS-macos.txt`. |
| **Terminology Integrity Check** | `grep -rni "Formerly Njure Group" ...` | **PASS** | Zero unintended occurrences (`NO_FORMERLY_FOUND`). |
| **Live Windows EXE Download & SHA-256** | `curl` download of `v1.0.0` `SCRIBBLE-IT_1.0.0_x64-setup.exe` + `SHA256SUMS.txt` | **PASS** | Downloaded `6,455,694` bytes (`6.16 MiB`) from GitHub Releases; `sha256sum` (`6388b4f4a3878f52afdc9d886739ca7f86b8fde17866e595ed6458e1eb660329`) matches `SHA256SUMS.txt` and `parseGitHubWindowsRelease()` resolves it cleanly while `MACOS_DESKTOP_CONFIG` truthfully remains `'In Development'` until `macos-v1.0.0` `.dmg` assets are published. |

---

## 2. Key macOS & Cross-Platform Implementation Details Audited

- **Apple Keychain Token Storage (`src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src/desktop/windowsTokenStorage.ts`):**
  - Target-specific `[target.'cfg(target_os = "macos")'.dependencies]` enables `keyring` with `features = ["apple-native"]`, while preserving `windows-native` for Windows.
  - Uses service `in.njuretech.scribbleit.macos`, allowlisted keys (`access_token`, `refresh_token`, `organization_id`, `api_base_url`), `zeroize::Zeroizing<String>` memory scrubbing, and `NativeVaultTokenStorage` (`WindowsCredentialTokenStorage` alias preserved).
- **Platform-Specific Rust & TypeScript Parity (`src-tauri/src/lib.rs`, `src/desktop/runtime.ts`, `src/desktop/desktopBridge.ts`, `src/desktop/DesktopControlPanel.tsx`, `src/components/common/ServiceNowHeader.tsx`, `src/context/ITSMContext.tsx`):**
  - Reports `client_platform: "macos"` on macOS hosts, detects macOS version via `/usr/bin/sw_vers -productVersion` with `std::env::consts::ARCH`, keeps `mdm_claimed: false`, and adapts Desktop Control Panel, header button labels, and notification bridge (`sendDesktopNotification`) cleanly for both macOS and Windows.
- **Hardened Runtime, Entitlements & Capabilities (`src-tauri/Entitlements.plist`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`):**
  - `Entitlements.plist` grants only `com.apple.security.network.client` (no JIT/unsigned-executable-memory/library-validation exemptions).
  - `tauri.conf.json` configures `minimumSystemVersion: "12.0"`, `hardenedRuntime: true`, `withGlobalTauri: false`, strict CSP, `icon.icns`, and `dmg` window/background geometry (`540x380`).
  - `capabilities/default.json` scopes permissions strictly to `main` with zero `fs:*` or `shell:*` grants.

---

## 3. Not Executed (Environment-Blocked in Linux Container)

The following steps require a native macOS (`Darwin`) host / GitHub Actions `macos-latest` runner, Rust toolchain (`cargo`/`rustc`), `git` remote push + `gh` CLI authentication, or Python `pytest`:

| Check / Step | Command / Workflow | Status | Blocker / Next Action |
| :--- | :--- | :--- | :--- |
| **Rust Unit Tests** | `cargo test --manifest-path src-tauri/Cargo.toml` | **NOT EXECUTED** | `cargo`/`rustc` not installed in Linux container; executes on `macos-latest` and `windows-latest` CI. |
| **Native macOS `.app` & `.dmg` Build + Mount/Launch Verification** | `bash scripts/build-macos-release.sh --verify-install` (`.github/workflows/macos-desktop-ci.yml`) | **NOT EXECUTED** | Requires macOS (`Darwin`) host with Xcode CLT, Rust `aarch64-apple-darwin` & `x86_64-apple-darwin` targets, `hdiutil`, and `Security.framework`. |
| **GitHub Actions Trigger & GitHub Release Publication (`macos-v1.0.0`)** | `.github/workflows/macos-desktop-ci.yml` + `.github/workflows/deploy-pages.yml` | **NOT EXECUTED** | Workspace has no `.git` remote/history, no `gh` CLI, and no GitHub credentials in this sandbox. Push changes to GitHub (`main`) to run `macos-desktop-ci.yml`, publish `SCRIBBLE-IT_1.0.0_arm64.dmg` & `SCRIBBLE-IT_1.0.0_x64.dmg` + `SHA256SUMS-macos.txt`, and deploy `deploy-pages.yml`. |
| **Interactive macOS GUI, Apple Keychain Prompt & Gatekeeper Check** | Interactive macOS desktop session | **NOT EXECUTED** | Requires interactive macOS Desktop session (and Apple Developer ID certificate/notarization secrets if signed distribution is desired). |
| **FastAPI Backend Test Suite** | `pytest -v` (in `backend/`) | **NOT EXECUTED** | `pytest` and backend dependencies not installed in this container. |
