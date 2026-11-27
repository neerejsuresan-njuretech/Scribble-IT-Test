# SCRIBBLE-IT — Task 5.4.3 Linux Desktop Verification & Release Audit Report

**Scope:** Linux Desktop Application (`x86_64` `.deb`, `.rpm`, `.AppImage`), Freedesktop Secret Service Integration, Ubuntu 22.04 LTS CI & Release Workflow, Website Integration (`#linux-desktop` + Hero CTA), and Windows/macOS Regression Checks  
**Status:** **Local Implementation & Frontend/Config Verification Passed — Native Rust Build, CI Execution & Live GitHub Release Publishing Pending GitHub Push**  
**Sandbox Environment:** Linux `x86_64` container (`Node.js v22.23.5`, `npm 10.9.9`, `Python 3.11.2`, `curl 7.88.1`, `dpkg-deb`; no `.git` remote/credentials, no `gh` CLI, and no `rustc`, `cargo`, `rpmbuild`, `patchelf`, or `libwebkit2gtk-4.1-dev` installed locally)

---

## 1. Executed & Passed Local Checks (Post-Final-Edit)

| Check | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **Root TypeScript Check** | `npm run lint` (`tsc --noEmit`) | **PASS** | Zero TypeScript errors across `src/`, `src/desktop/`, `LandingWebsitePage.tsx`, `openSourceConfig.ts`, and `tests/frontend/linux_desktop.test.ts`. |
| **Workspace Package Type Checks** | `npm run typecheck:packages` | **PASS** | `@scribble-it/types`, `@scribble-it/design-tokens`, `@scribble-it/rbac`, and `@scribble-it/api-client` compiled cleanly. |
| **ESLint Check** | `npx eslint .` | **PASS** | Passed against `eslint.config.js` with zero errors. |
| **Frontend & Desktop Test Suite** | `npm run test:frontend` | **PASS (35/35)** | All 35 unit and configuration assertions passed across `navigation_rbac.test.ts`, `api_client.test.ts`, `shared_packages.test.ts`, `windows_desktop.test.ts`, `macos_desktop.test.ts`, and `linux_desktop.test.ts`. |
| **Production Build & Pages Bundle** | `compile_applet` + `npm run build:pages` | **PASS** | `vite build` (`VITE_BASE_PATH=./`) compiled production `dist/` (`1824` modules, `dist/index.html` + hashed JS/CSS chunks) with zero errors. |
| **Brand & Five-Platform Asset Check** | `npm run verify:brand` | **PASS** | All 517 brand, typography, Linux hicolor/SVG/AppStream/desktop entry, macOS, Windows, terminology (`Formally Njure Group`), and zero-version checks passed. |
| **Linux Release Script Syntax** | `bash -n scripts/build-linux-release.sh` | **PASS** | Zero shell syntax errors. |
| **Terminology Regression Check** | `grep -rn "Formerly Njure Group"` | **PASS (0 matches)** | Zero instances of `Formerly Njure Group` found across source, docs, workflows, scripts, assets, or configs. |

---

## 2. Live Windows & macOS Regression Verification

Verified live against `https://github.com/neerejsuresan-njuretech/Scribble-IT-Test/releases` and `https://scribbleit.njuregroup.in/`:

| Target | Release Tag | Status | Verified URLs & Integrity |
| :--- | :--- | :--- | :--- |
| **Website Root** | GitHub Pages (`sha=0f94fc71`) | **HTTP 200** | `https://scribbleit.njuregroup.in/` (`5,748` bytes). |
| **Windows x64 (.exe)** | `v1.0.0` (`draft=False`) | **HTTP 200** | `SCRIBBLE-IT_1.0.0_x64-setup.exe` (`6,458,491` bytes, SHA-256 `1311b11e675e5b674c45bf232a3d70293a0e21c18fe4c62ac0056711230b9bd1`). |
| **Windows x64 (.msi)** | `v1.0.0` (`draft=False`) | **HTTP 200** | `SCRIBBLE-IT_1.0.0_x64_en-US.msi` (`8,105,984` bytes, SHA-256 `e176404c8cd1e476204ea886b1ef51ca2a902d621ac7cbc10b4e2fc43d7b0bb5`). |
| **macOS Apple Silicon (.dmg)** | `macos-v1.0.0` (`draft=False`) | **HTTP 200** | `SCRIBBLE-IT_1.0.0_arm64.dmg` (`8,571,924` bytes, SHA-256 `e0433a248843028a4e5711246b65d267a70f1ac0e3cc9c3aafc795bdaf39652d`). |
| **macOS Intel (.dmg)** | `macos-v1.0.0` (`draft=False`) | **HTTP 200** | `SCRIBBLE-IT_1.0.0_x64.dmg` (`8,643,148` bytes, SHA-256 `f9fcc6f6cfad89463a037b1871ef632a8303bc978bdeea4c34cdf7c1f82b630e`). |

---

## 3. Not Yet Executed / Blocked in Container Sandbox

| Step | Current Status | Exact Blocker & Required Action |
| :--- | :--- | :--- |
| **`cargo test --manifest-path src-tauri/Cargo.toml`** | **NOT EXECUTED** | `rustc` and `cargo` are not installed in this container. |
| **Tauri Linux Build (`.deb`, `.rpm`, `.AppImage`)** | **NOT EXECUTED** | `rustc`, `cargo`, `rpmbuild`, `patchelf`, and `libwebkit2gtk-4.1-dev` are absent in the container. |
| **GitHub Actions Workflow Run (`linux-desktop-ci.yml`) & `linux-v1.0.0` Release Publish** | **PENDING GIT PUSH** | Container workspace has no `.git` remote/credentials or `gh` CLI. Pushing changes to `main` triggers `.github/workflows/linux-desktop-ci.yml` on `ubuntu-22.04`, publishes `.deb`/`.rpm`/`.AppImage` + `SHA256SUMS-linux.txt` to `linux-v1.0.0`, and triggers `.github/workflows/deploy-pages.yml` to activate live Linux download buttons on `https://scribbleit.njuregroup.in/`. |
| **Interactive GUI Launch & Keyring E2E** | **PENDING NATIVE DESKTOP** | GNOME Keyring / KWallet Secret Service unlock prompts, system notification display, and `apt`/`dnf`/AppImage launch require a desktop Linux session or `ubuntu-22.04` CI `xvfb-run` execution. |
