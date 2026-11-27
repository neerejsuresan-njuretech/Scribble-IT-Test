# SCRIBBLE-IT — Task 5.4.2 Verification & Release Audit Report

**Scope:** macOS Desktop Download Availability Root-Cause Fix, CI Workflow Repair, Apple Keychain Integration, and Website Integration (`#macos-desktop` + Hero CTA)  
**Environment:** Linux x86_64 sandbox (`Node.js v22.23.5`, `npm 10.9.9`, `Python 3.11.2`, `curl 7.88.1`; no `.git` remote/history, no `gh` CLI, and no `cargo`/`rustc`/`pytest`/macOS `Darwin` toolchain installed locally)

---

## 1. Root Cause Analysis — Missing macOS `.dmg` Download

1. **Failed GitHub Actions Workflow Parse (`run 45974143836`):**
   - Commit `acea924ef28090879856eb87442a62b13398bef1` introduced `.github/workflows/macos-desktop-ci.yml` with `if: ${{ secrets.APPLE_CERTIFICATE != '' && secrets.APPLE_CERTIFICATE_PASSWORD != '' }}` on the step `"Import Apple Developer ID certificate if configured"`.
   - GitHub Actions forbids referencing the `secrets` context directly inside step or job `if:` conditionals. As a result, workflow run `45974143836` failed immediately at parse time (`conclusion=failure`, `jobs=0`, `check_runs=0`) without executing on `macos-latest`.
2. **Additional Headless CI Safeguards Added:**
   - Added `CI: "true"` to the build step in `.github/workflows/macos-desktop-ci.yml` and `export CI="${CI:-true}"` in `scripts/build-macos-release.sh` so Tauri's DMG bundler skips interactive Finder/AppleScript operations cleanly in headless runners.
   - Explicitly `unset` empty `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_APP_PASSWORD`, `APPLE_TEAM_ID`, `APPLE_API_KEY`, and `APPLE_API_ISSUER` environment variables in `scripts/build-macos-release.sh` so unsigned CI builds do not fail on empty-string secret expansion.
3. **Why Website Showed `In Development` Initially:**
   - Before `macos-v1.0.0` was published, `deploy-pages.yml` and `parseGitHubMacosRelease()` faithfully kept **Scribble-IT for macOS** in `In Development` instead of rendering broken or fabricated download links. Once `run 45985744954` succeeded and published `macos-v1.0.0`, `https://scribbleit.njuregroup.in/` activated both macOS download buttons.
4. **Exact Root Cause of `hdiutil: attach canceled` (`runs 45992303240` & `45995066552`):**
   - Comparing passing commit `0f94fc71` (`run 45985744954`) with failing commit `737b133c` (`run 45992303240`) proved that `src-tauri/tauri.conf.json` gained `"licenseFile": "../LICENSE"` under `"bundle"`.
   - `tauri-bundler` on macOS passes `bundle.licenseFile` (`../LICENSE`) as `--eula` to `bundle_dmg.sh`, embedding an interactive Software License Agreement (`SLA`) resource fork into `SCRIBBLE-IT_1.0.0_aarch64.dmg` / `SCRIBBLE-IT_1.0.0_arm64.dmg` and `SCRIBBLE-IT_1.0.0_x64.dmg`.
   - Mounting an SLA-enabled `.dmg` via `hdiutil attach` enters an interactive license prompt (`Agree? Y/N`) on `stdin`; in a non-interactive CI environment (`< /dev/null` or closed TTY), `hdiutil` receives EOF and aborts immediately with **`hdiutil: attach canceled`** (even when `hdiutil verify` passes!).
   - **Implemented Resolution:**
     1. Removed `"licenseFile": "../LICENSE"` from `src-tauri/tauri.conf.json` while keeping `"license": "AGPL-3.0-only"` intact (zero impact on Windows/Linux CI or license metadata; macOS DMGs mount cleanly without blocking SLA prompts).
     2. Hardened `scripts/build-macos-release.sh` with `file -b`, `hdiutil imageinfo` (format/partition & `SLA` detection), `hdiutil verify`, separate stdout/stderr/exit capture, `xattr -d com.apple.quarantine`, unique writable `/tmp` mount directories per architecture, stale mount cleanup (`hdiutil info`), PTY (`expect`) fallback if an SLA is ever present, independent bundle/plist/executable/`lipo -archs` checks (`arm64` & `x86_64`), and guaranteed `trap cleanup_verify EXIT` detach on failure.
     3. Gated `.github/workflows/macos-desktop-ci.yml` publication strictly on `success()` and dual-arch `[PASS] DMG verified & mounted cleanly` entries.

---

## 2. Executed & Passed Checks (Post-Final-Edit)

| Check | Command / Verification | Result | Details |
| :--- | :--- | :--- | :--- |
| **Root TypeScript Check** | `npm run lint` (`tsc --noEmit`) | **PASS** | Zero TypeScript errors across web app, desktop modules, `LandingWebsitePage.tsx`, `ServiceNowHeader.tsx`, `ITSMContext.tsx`, and tests. |
| **Production Build Verification** | Vite / Applet Compile (`compile_applet` + `npm run build:pages`) | **PASS** | `vite build` (`VITE_BASE_PATH=./`) compiled production `dist/` cleanly with zero bundle errors. |
| **Shared Workspace Type Checks** | `npm run typecheck:packages` | **PASS** | `@scribble-it/types`, `@scribble-it/design-tokens`, `@scribble-it/rbac`, and `@scribble-it/api-client` compiled cleanly. |
| **Frontend & Desktop Unit Tests** | `npm run test:frontend` | **PASS** | Passed all assertions across `navigation_rbac.test.ts`, `api_client.test.ts`, `shared_packages.test.ts`, `windows_desktop.test.ts`, and `macos_desktop.test.ts` (including regression guard banning `secrets.` inside `if:` expressions and verifying gated macOS download CTAs). |
| **Brand & Five-Platform Asset Check** | `npm run verify:brand` | **PASS** | Verified SVG/PNG/ICO/ICNS/BMP assets, macOS DMG background graphics, Windows assets, `Formally Njure Group` terminology, and zero-version brand rules. |
| **macOS Release Script Syntax** | `bash -n scripts/build-macos-release.sh` | **PASS** | Zero shell syntax errors. |
| **Live Windows Release Preservation Check** | HTTP download of live `v1.0.0` `SCRIBBLE-IT_1.0.0_x64-setup.exe` & `SHA256SUMS.txt` | **PASS** | Verified live release at `https://github.com/neerejsuresan-njuretech/Scribble-IT-Test/releases/tag/v1.0.0` (`draft=False`): `SCRIBBLE-IT_1.0.0_x64-setup.exe` downloaded `6,458,687` bytes (`6.16 MiB`) with matching SHA-256 `4535714680f64a029928c2942c441781c1d3cc3d56f158db38a7a20eb4bc279c`; `SCRIBBLE-IT_1.0.0_x64_en-US.msi` verified at `8,105,984` bytes (`SHA-256: 87157a42346c4a3b9d506d36074a938774dcb10a17dc097c02ebdcab010cea2c`). `https://scribbleit.njuregroup.in/` returned HTTP `200`. |

---

## 3. Website & Desktop Changes Made

- **`.github/workflows/macos-desktop-ci.yml`:** Removed invalid `if: ${{ secrets.* }}` condition on certificate import step and moved empty-secret guard into bash `run:`; added `CI: "true"` for headless DMG bundling. Publishes to isolated tag `macos-v1.0.0` without modifying Windows `v1.0.0`.
- **`scripts/build-macos-release.sh`:** Exported `CI="${CI:-true}"` and `unset` empty `APPLE_*` signing/notary environment variables before `npx tauri build`.
- **`src/pages/public/LandingWebsitePage.tsx`:** Added conditional Hero CTA `"Download for macOS (.dmg)"` jumping to `#macos-desktop`, gated strictly on `macosRelease.availabilityStatus === 'Available'` alongside verified `.dmg` + SHA-256 digests (`Download for Mac — Apple Silicon (.dmg)` & `Download for Mac — Intel x86_64 (.dmg)` in `#macos-desktop`). Preserved Windows Hero CTA (`#0A84FF`) and `#windows-desktop` section unchanged.
- **`src/components/common/ServiceNowHeader.tsx` & `src/context/ITSMContext.tsx`:** Updated desktop header labels and notification bridge (`sendDesktopNotification`) to support macOS and Windows accurately.
- **`tests/frontend/macos_desktop.test.ts`:** Added regression assertions against invalid `secrets.` conditionals in `.github/workflows/macos-desktop-ci.yml`, `CI: "true"`, empty secret unset, and gated macOS download CTAs in `LandingWebsitePage.tsx`.

---

## 4. Remaining Release Action (Requires GitHub Push / macOS Runner)

| Check / Step | Status | Reason & Required Action |
| :--- | :--- | :--- |
| **Push Fixed CI Workflow & Trigger `macos-latest`** | **BLOCKED IN SANDBOX** | This container has no `.git` remote/credentials or `gh` CLI. Push the updated repository files to `main` on `neerejsuresan-njuretech/Scribble-IT-Test` so `Build & Verify macOS Desktop Application` executes cleanly on `macos-latest`. |
| **Native `.dmg` Build, Upload (`macos-v1.0.0`) & Live Site Redeploy** | **PENDING CI RUN** | Once pushed, `macos-desktop-ci.yml` builds `SCRIBBLE-IT_1.0.0_arm64.dmg` + `SCRIBBLE-IT_1.0.0_x64.dmg`, uploads them to tag `macos-v1.0.0`, and triggers `deploy-pages.yml` to publish live macOS download buttons on `https://scribbleit.njuregroup.in/`. |
| **Rust Unit Tests & FastAPI `pytest`** | **NOT EXECUTED LOCALLY** | `cargo`/`rustc` and `pytest` are not installed in this container; execute via GitHub Actions CI. |
