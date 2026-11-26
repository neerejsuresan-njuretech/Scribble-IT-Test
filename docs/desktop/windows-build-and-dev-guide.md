# SCRIBBLE-IT for Windows — Build & Developer Guide

This guide describes how to develop, test, and package the Tauri 2 Windows desktop application (`src-tauri/`) using the shared React 19 + TypeScript codebase and `@scribble-it/*` workspaces.

---

## 1. Prerequisites (Windows 10 / 11 Host)

1. **Node.js 24.12.0+** and `npm`
2. **Rust Stable Toolchain** (`rustup`, `cargo`, `rustc` `>= 1.77.2`) with `x86_64-pc-windows-msvc` target:
   ```powershell
   winget install Rustlang.Rustup
   rustup toolchain install stable-x86_64-pc-windows-msvc
   ```
3. **Microsoft C++ Build Tools** ("Desktop development with C++" workload via Visual Studio Build Tools 2022)
4. **Microsoft Edge WebView2 Runtime** (pre-installed on Windows 11; available from Microsoft for Windows 10)
5. **NSIS & WiX Toolset** (downloaded automatically by `tauri build` on Windows or installable via Cargo/WiX)

---

## 2. Project Layout

- `src-tauri/Cargo.toml` — Rust dependencies (`tauri` 2, `keyring` with `windows-native`, notification, dialog, deep-link, opener, autostart, single-instance, `zeroize`, `sha2`, `url`).
- `src-tauri/tauri.conf.json` — Product metadata (`in.njuretech.scribbleit`), CSP, Task 5.2 Windows icons/BMPs, NSIS & WiX bundler targets, `scribbleit` deep-link scheme.
- `src-tauri/capabilities/default.json` — Least-privilege Tauri 2 ACL permissions bound to `"windows": ["main"]`.
- `src-tauri/src/lib.rs` — Credential Manager vault commands, URL/deep-link validators, host fingerprint collector (`mdm_claimed: false`), native file picker (10 MiB max, SHA-256), and Rust unit tests.
- `src/desktop/` — TypeScript runtime helpers, `WindowsCredentialTokenStorage` (`TokenStorageAdapter`), `desktopBridge.ts`, and `DesktopControlPanel.tsx`.

---

## 3. Running in Development Mode

```powershell
npm ci
npm run tauri:dev
```

`npm run tauri:dev` automatically starts the Vite + Express dev server on `http://localhost:3000` (`beforeDevCommand`) and opens the native Tauri WebView2 window connected to it.

---

## 4. Running Tests & Verification

```powershell
# Shared packages & TypeScript checks
npm run typecheck:packages
npm run lint

# Node/tsx unit tests (includes tests/frontend/windows_desktop.test.ts)
npm run test:frontend

# Brand SVG/PNG/ICO/BMP asset validation
npm run verify:brand

# Rust unit tests (vault key validation, URL/deep-link sanitization, path traversal guard)
cargo test --manifest-path src-tauri/Cargo.toml
```

---

## 5. Building Windows Installers (.exe & .msi)

```powershell
npm run tauri:build:windows
```

Outputs are generated under `src-tauri/target/release/bundle/`:
- `nsis/SCRIBBLE-IT_1.0.0_x64-setup.exe`
- `msi/SCRIBBLE-IT_1.0.0_x64_en-US.msi`

To point the desktop app at a fixed production FastAPI backend during build time:

```powershell
$env:VITE_API_BASE_URL = "https://api.your-company.com"
$env:VITE_USE_BACKEND_API = "true"
npm run tauri:build:windows
```

---

## 6. Code Signing Notes (Authenticode)

`src-tauri/tauri.conf.json` ships intentionally with `"certificateThumbprint": null` so contributor builds and CI dry-runs succeed without secrets. Before distributing public installers to end users:
1. Provision an EV or Organization Validation Windows Authenticode certificate.
2. Configure `TAURI_SIGNING_*` / Windows `signtool.exe` thumbprint in release secrets.
3. Publish SHA-256 digests (`SHA256SUMS.txt`) alongside `.exe` and `.msi` assets, and set `VITE_WINDOWS_INSTALLER_URL` + `VITE_WINDOWS_INSTALLER_SHA256` when updating the website.
