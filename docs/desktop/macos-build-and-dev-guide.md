# SCRIBBLE-IT for macOS — Build & Developer Guide

**Product:** SCRIBBLE-IT (`Enterprise IT Management. Open to Everyone.`)  
**Organization:** Njure Tech (formally Njure Group)  
**Bundle Identifier:** `in.njuretech.scribbleit`

---

## 1. Prerequisites (macOS Host Required for Native `.app`/`.dmg` Bundling)

- **macOS 12+** with **Xcode Command Line Tools** (`xcode-select --install`)
- **Node.js 24+** (`>=24.12.0 <25`) and `npm`
- **Rust Stable Toolchain** (`rustup.rs`) with targets:
  ```bash
  rustup target add aarch64-apple-darwin x86_64-apple-darwin
  ```

---

## 2. Local Development Mode

Run the Tauri 2 desktop shell connected to the local Vite dev server (`http://localhost:3000`):

```bash
npm ci
npm run typecheck:packages
npm run tauri:dev
```

Ensure macOS notification prompts and `scribbleit://` URL handler behavior are tested against a signed-in FastAPI (`/api/v1`) server if testing session management end-to-end.

---

## 3. Running Automated Checks

```bash
npm run typecheck:packages
npm run lint
npm run test:frontend
npm run verify:brand
cargo test --manifest-path src-tauri/Cargo.toml
```

---

## 4. Production `.app` & `.dmg` Packaging

Use the automated production release script on macOS:

```bash
bash scripts/build-macos-release.sh --verify-install
```

This script:
1. Executes TypeScript, ESLint/tsc, frontend tests, brand verification, and `cargo test`.
2. Builds Tauri 2 `.app` and `.dmg` bundles for `aarch64-apple-darwin` (Apple Silicon) and `x86_64-apple-darwin` (Intel).
3. Verifies `Info.plist` (`CFBundleIdentifier == in.njuretech.scribbleit`), Mach-O `lipo` architecture, and `Security.framework` linkage (`otool -L`).
4. Signs & notarizes via `xcrun notarytool` + `xcrun stapler` **only** if `APPLE_SIGNING_IDENTITY` and notarization credentials are configured (otherwise truthfully marks output as unsigned).
5. Stages artifacts, `SHA256SUMS-macos.txt`, `BUILD_INFO.txt`, and `installation-verification.txt` in `release/macos/`.

To build a single architecture directly via Tauri CLI:

```bash
VITE_BASE_PATH=./ npx tauri build --target aarch64-apple-darwin --bundles app,dmg
# or for Intel:
VITE_BASE_PATH=./ npx tauri build --target x86_64-apple-darwin --bundles app,dmg
```

---

## 5. GitHub Actions CI & Release Workflow

- **Workflow:** `.github/workflows/macos-desktop-ci.yml` (`runs-on: macos-latest`)
- Builds both Apple Silicon (`arm64`) and Intel (`x64`) `.dmg` bundles, verifies `.dmg` mounting + launch, and publishes assets to GitHub Releases tag `macos-v<version>` (keeping Windows release `v<version>` separate and untouched).
- `.github/workflows/deploy-pages.yml` automatically detects published `.dmg` assets and SHA-256 digests and activates direct download links on `https://scribbleit.njuregroup.in/#macos-desktop`.
