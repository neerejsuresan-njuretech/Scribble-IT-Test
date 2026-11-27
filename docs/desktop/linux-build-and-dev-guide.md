# SCRIBBLE-IT for Linux — Build & Developer Guide

**Product:** SCRIBBLE-IT (`Enterprise IT Management. Open to Everyone.`)  
**Organization:** Njure Tech (formally Njure Group)  
**Bundle Identifier:** `in.njuretech.scribbleit`

---

## 1. Prerequisites (Ubuntu 22.04 LTS Recommended for Broad GLIBC Compatibility)

Building on **Ubuntu 22.04 LTS** produces binaries linked against **GLIBC 2.35** and `libwebkit2gtk-4.1`, maximizing compatibility across Ubuntu 22.04/24.04, Debian 12+, Fedora, and RHEL 9+.

Install required system packages on Ubuntu/Debian:

```bash
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  curl \
  wget \
  file \
  patchelf \
  rpm \
  xvfb \
  libfuse2 \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libssl-dev \
  libsecret-1-dev \
  pkg-config
```

Install **Node.js 24+** (`>=24.12.0 <25`) and the **Rust Stable Toolchain** (`x86_64-unknown-linux-gnu`):

```bash
rustup target add x86_64-unknown-linux-gnu
```

---

## 2. Local Development Mode

Run the Tauri 2 desktop shell connected to the local Vite dev server (`http://localhost:3000`):

```bash
npm ci
npm run typecheck:packages
npm run tauri:dev
```

Ensure a Freedesktop Secret Service provider (`gnome-keyring-daemon` or `kwalletd`) and desktop notification daemon are active when testing native keyring storage and notifications end-to-end against a FastAPI (`/api/v1`) server.

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

## 4. Production `.deb`, `.rpm` & `.AppImage` Packaging

Run the automated release build & verification script:

```bash
bash scripts/build-linux-release.sh --verify-install
```

This script:
1. Executes workspace type checks, TypeScript (`npm run lint`), frontend production build (`npm run build:pages`), frontend desktop tests, brand verification, and `cargo test`.
2. Builds Tauri 2 bundles via `VITE_BASE_PATH=./ APPIMAGE_EXTRACT_AND_RUN=1 npx tauri build --target x86_64-unknown-linux-gnu --bundles deb,rpm,appimage`.
3. Stages the exact Tauri-generated `.deb`, `.rpm`, and `.AppImage` filenames into `release/linux/` alongside `SHA256SUMS-linux.txt` and per-artifact `.sha256` files.
4. When `--verify-install` is passed, verifies `.deb` metadata & contents (`dpkg-deb -I`, `-c`, `-x`), `.rpm` metadata (`rpm -qip`, `-qlp`), `.AppImage` extraction (`--appimage-extract`), `ldd` shared library linkage, and headless launch (`xvfb-run`).

To run a direct bundle build manually:

```bash
VITE_BASE_PATH=./ APPIMAGE_EXTRACT_AND_RUN=1 npx tauri build --target x86_64-unknown-linux-gnu --bundles deb,rpm,appimage
```

---

## 5. GitHub Actions CI & Release Workflow

- **Workflow:** `.github/workflows/linux-desktop-ci.yml` (`runs-on: ubuntu-22.04`)
- Installs all WebKitGTK 4.1, GTK 3, Secret Service, RPM, and AppImage dependencies, builds `.deb`, `.rpm`, and `.AppImage`, verifies extracted package trees & launch smoke test under `xvfb-run`, generates `SHA256SUMS-linux.txt`, and publishes assets to isolated tag `linux-v<version>` (keeping Windows `v<version>` and macOS `macos-v<version>` releases untouched).
- `.github/workflows/deploy-pages.yml` detects published Linux release assets and SHA-256 digests and activates direct download buttons on `https://scribbleit.njuregroup.in/#linux-desktop`.
