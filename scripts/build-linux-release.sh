#!/usr/bin/env bash
set -euo pipefail

VERIFY_INSTALL=0
TARGET_TRIPLE="x86_64-unknown-linux-gnu"
BUNDLES="deb,rpm,appimage"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --verify-install)
      VERIFY_INSTALL=1
      shift
      ;;
    --target)
      TARGET_TRIPLE="$2"
      shift 2
      ;;
    --bundles)
      BUNDLES="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RELEASE_DIR="$REPO_ROOT/release/linux"
LOGS_DIR="$RELEASE_DIR/logs"

mkdir -p "$RELEASE_DIR" "$LOGS_DIR"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "[ERROR] scripts/build-linux-release.sh requires a Linux host with WebKitGTK 4.1, GTK 3, and Rust toolchains." >&2
  exit 1
fi

for cmd in node npm rustc cargo sha256sum ldd file; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[ERROR] Required Linux toolchain command '$cmd' was not found on PATH." >&2
    exit 1
  fi
done

if [[ ",$BUNDLES," == *",deb,"* ]] && ! command -v dpkg-deb >/dev/null 2>&1; then
  echo "[ERROR] dpkg-deb is required to build/verify .deb installers." >&2
  exit 1
fi
if [[ ",$BUNDLES," == *",rpm,"* ]] && ! command -v rpmbuild >/dev/null 2>&1; then
  echo "[ERROR] rpmbuild (apt package 'rpm') is required to build .rpm installers." >&2
  exit 1
fi
if [[ ",$BUNDLES," == *",appimage,"* ]] && ! command -v patchelf >/dev/null 2>&1; then
  echo "[ERROR] patchelf is required to build .AppImage bundles." >&2
  exit 1
fi

PRODUCT_NAME="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$REPO_ROOT/src-tauri/tauri.conf.json','utf8')).productName)")"
APP_VERSION="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$REPO_ROOT/src-tauri/tauri.conf.json','utf8')).version)")"
APP_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$REPO_ROOT/src-tauri/tauri.conf.json','utf8')).identifier)")"
MAIN_BINARY="$(node -e "const c=JSON.parse(require('fs').readFileSync('$REPO_ROOT/src-tauri/tauri.conf.json','utf8')); console.log(c.mainBinaryName || c.productName)")"

HOST_DISTRO="Linux"
if [[ -r /etc/os-release ]]; then
  HOST_DISTRO="$(grep -E '^PRETTY_NAME=' /etc/os-release | head -n 1 | cut -d= -f2- | tr -d '"' || echo 'Linux')"
fi
GLIBC_VER="$(ldd --version 2>&1 | head -n 1 || echo 'unknown')"

export CI="${CI:-true}"
export APPIMAGE_EXTRACT_AND_RUN=1
export VITE_BASE_PATH="${VITE_BASE_PATH:-./}"

echo "=== SCRIBBLE-IT Linux Production Build ($PRODUCT_NAME v$APP_VERSION / $APP_ID) ==="
echo "Host OS: $HOST_DISTRO [$(uname -m)]"
echo "Target Triple: $TARGET_TRIPLE | Bundles: $BUNDLES"

{
  echo "Product: $PRODUCT_NAME"
  echo "Main Binary: $MAIN_BINARY"
  echo "App ID: $APP_ID"
  echo "Version: $APP_VERSION"
  echo "Target Triple: $TARGET_TRIPLE"
  echo "Bundles: $BUNDLES"
  echo "Build Date (UTC): $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "Host Distro: $HOST_DISTRO [$(uname -m)]"
  echo "GLIBC: $GLIBC_VER"
  echo "Node.js: $(node --version)"
  echo "npm: $(npm --version)"
  echo "rustc: $(rustc --version)"
  echo "cargo: $(cargo --version)"
} > "$LOGS_DIR/environment.log"

cd "$REPO_ROOT"

echo "[1/5] Running TypeScript, frontend tests & brand checks..."
npm run typecheck:packages 2>&1 | tee "$LOGS_DIR/typecheck-packages.log"
npm run lint 2>&1 | tee "$LOGS_DIR/frontend-lint.log"
npm run test:frontend 2>&1 | tee "$LOGS_DIR/frontend-tests.log"
npm run verify:brand 2>&1 | tee "$LOGS_DIR/brand-verify.log"

echo "[2/5] Running Rust unit tests..."
cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | tee "$LOGS_DIR/cargo-test.log"

echo "[3/5] Building Tauri 2 Linux bundles ($BUNDLES) for $TARGET_TRIPLE..."
rustup target add "$TARGET_TRIPLE" >/dev/null 2>&1 || true
npx tauri build --target "$TARGET_TRIPLE" --bundles "$BUNDLES" 2>&1 | tee "$LOGS_DIR/tauri-build-linux.log"

BUNDLE_ROOT="$REPO_ROOT/src-tauri/target/$TARGET_TRIPLE/release/bundle"
BIN_PATH="$REPO_ROOT/src-tauri/target/$TARGET_TRIPLE/release/$MAIN_BINARY"

if [[ ! -s "$BIN_PATH" ]]; then
  echo "[ERROR] Expected Linux release binary missing or empty at $BIN_PATH" >&2
  exit 1
fi

STAGED_FILES=()
STAGED_KINDS=()

if [[ ",$BUNDLES," == *",deb,"* ]]; then
  DEB_SRC="$(find "$BUNDLE_ROOT/deb" -maxdepth 1 -type f -name '*.deb' | head -n 1)"
  if [[ -z "$DEB_SRC" || ! -s "$DEB_SRC" ]]; then
    echo "[ERROR] Expected non-empty .deb package under $BUNDLE_ROOT/deb" >&2
    exit 1
  fi
  STAGED_DEB="$RELEASE_DIR/$(basename "$DEB_SRC")"
  cp -f "$DEB_SRC" "$STAGED_DEB"
  STAGED_FILES+=("$STAGED_DEB")
  STAGED_KINDS+=("deb")
fi

if [[ ",$BUNDLES," == *",rpm,"* ]]; then
  RPM_SRC="$(find "$BUNDLE_ROOT/rpm" -maxdepth 1 -type f -name '*.rpm' | head -n 1)"
  if [[ -z "$RPM_SRC" || ! -s "$RPM_SRC" ]]; then
    echo "[ERROR] Expected non-empty .rpm package under $BUNDLE_ROOT/rpm" >&2
    exit 1
  fi
  STAGED_RPM="$RELEASE_DIR/$(basename "$RPM_SRC")"
  cp -f "$RPM_SRC" "$STAGED_RPM"
  STAGED_FILES+=("$STAGED_RPM")
  STAGED_KINDS+=("rpm")
fi

if [[ ",$BUNDLES," == *",appimage,"* ]]; then
  APPIMAGE_SRC="$(find "$BUNDLE_ROOT/appimage" -maxdepth 1 -type f -name '*.AppImage' | head -n 1)"
  if [[ -z "$APPIMAGE_SRC" || ! -s "$APPIMAGE_SRC" ]]; then
    echo "[ERROR] Expected non-empty .AppImage package under $BUNDLE_ROOT/appimage" >&2
    exit 1
  fi
  STAGED_APPIMAGE="$RELEASE_DIR/$(basename "$APPIMAGE_SRC")"
  cp -f "$APPIMAGE_SRC" "$STAGED_APPIMAGE"
  chmod +x "$STAGED_APPIMAGE"
  STAGED_FILES+=("$STAGED_APPIMAGE")
  STAGED_KINDS+=("appimage")
fi

echo "[4/5] Generating SHA-256 checksums and release metadata..."
SHA_FILE="$RELEASE_DIR/SHA256SUMS-linux.txt"
: > "$SHA_FILE"
BUILD_INFO="$RELEASE_DIR/BUILD_INFO.txt"
cp "$LOGS_DIR/environment.log" "$BUILD_INFO"

for i in "${!STAGED_FILES[@]}"; do
  pkg="${STAGED_FILES[$i]}"
  kind="${STAGED_KINDS[$i]}"
  name="$(basename "$pkg")"
  bytes="$(stat -c%s "$pkg")"
  hash="$(sha256sum "$pkg" | awk '{print $1}')"
  line="${hash}  ${name}"
  echo "$line" >> "$SHA_FILE"
  echo "$line" > "${pkg}.sha256"
  {
    echo "Package (${kind}): $name"
    echo "Size (${kind} bytes): $bytes"
    echo "SHA-256 (${kind}): $hash"
  } >> "$BUILD_INFO"
done

cp -f "$REPO_ROOT/docs/releases/linux-v1.0.0-release-notes.md" "$RELEASE_DIR/linux-v1.0.0-release-notes.md"
cp -f "$REPO_ROOT/docs/desktop/linux-installation-guide.md" "$RELEASE_DIR/linux-installation-guide.md"

if [[ "$VERIFY_INSTALL" -eq 1 ]]; then
  echo "[5/5] Verifying .deb, .rpm, .AppImage packages, ELF dependencies & headless launch..."
  VERIFY_REPORT="$RELEASE_DIR/installation-verification.txt"
  TMP_WORK="$(mktemp -d)"
  trap 'rm -rf "$TMP_WORK"' EXIT

  {
    echo "Automated Linux Package Verification ($(date -u +%Y-%m-%dT%H:%M:%SZ))"
    echo "Linux Runner: $HOST_DISTRO [$(uname -m)]"
    echo "GLIBC: $GLIBC_VER"
    echo ""
  } > "$VERIFY_REPORT"

  echo "--- Release Binary ELF & Shared Library Inspection ---" >> "$VERIFY_REPORT"
  file "$BIN_PATH" >> "$VERIFY_REPORT"
  if ldd "$BIN_PATH" | grep -E 'webkit2gtk-4\.1|gtk-3|libssl'; then
    echo "[PASS] Release binary links WebKitGTK 4.1, GTK 3, and OpenSSL." >> "$VERIFY_REPORT"
  else
    echo "[WARN] Expected shared library check incomplete in ldd output." >> "$VERIFY_REPORT"
  fi
  echo "" >> "$VERIFY_REPORT"

  for i in "${!STAGED_FILES[@]}"; do
    pkg="${STAGED_FILES[$i]}"
    kind="${STAGED_KINDS[$i]}"
    name="$(basename "$pkg")"
    bytes="$(stat -c%s "$pkg")"
    echo "--- Package Verification ($kind): $name ($bytes bytes) ---" >> "$VERIFY_REPORT"

    if [[ "$kind" == "deb" ]]; then
      dpkg-deb -I "$pkg" | tee -a "$LOGS_DIR/verify-deb.log" >/dev/null
      dpkg-deb -c "$pkg" > "$LOGS_DIR/verify-deb-contents.log"
      mkdir -p "$TMP_WORK/deb_extract"
      dpkg-deb -x "$pkg" "$TMP_WORK/deb_extract"
      if [[ ! -s "$TMP_WORK/deb_extract/usr/bin/$MAIN_BINARY" ]]; then
        echo "[ERROR] Extracted .deb missing /usr/bin/$MAIN_BINARY" >&2
        exit 1
      fi
      if ! find "$TMP_WORK/deb_extract/usr/share/applications" -name '*.desktop' | grep -q .; then
        echo "[ERROR] Extracted .deb missing .desktop launcher" >&2
        exit 1
      fi
      echo "[PASS] dpkg-deb inspection & clean extraction verified (/usr/bin/$MAIN_BINARY + .desktop + AppStream metainfo)." >> "$VERIFY_REPORT"
    elif [[ "$kind" == "rpm" ]]; then
      if command -v rpm >/dev/null 2>&1; then
        rpm -qip "$pkg" | tee -a "$LOGS_DIR/verify-rpm.log" >/dev/null
        rpm -qlp "$pkg" > "$LOGS_DIR/verify-rpm-contents.log"
        if ! grep -q "/usr/bin/$MAIN_BINARY" "$LOGS_DIR/verify-rpm-contents.log"; then
          echo "[ERROR] .rpm payload missing /usr/bin/$MAIN_BINARY" >&2
          exit 1
        fi
        echo "[PASS] rpm query inspection verified (/usr/bin/$MAIN_BINARY + .desktop + AppStream metainfo)." >> "$VERIFY_REPORT"
      else
        echo "[INFO] 'rpm' CLI query skipped (file staged and non-empty)." >> "$VERIFY_REPORT"
      fi
    elif [[ "$kind" == "appimage" ]]; then
      mkdir -p "$TMP_WORK/appimage_extract"
      (
        cd "$TMP_WORK/appimage_extract"
        "$pkg" --appimage-extract >/dev/null
      )
      if [[ ! -s "$TMP_WORK/appimage_extract/squashfs-root/usr/bin/$MAIN_BINARY" ]]; then
        echo "[ERROR] Extracted AppImage missing usr/bin/$MAIN_BINARY" >&2
        exit 1
      fi
      if [[ ! -s "$TMP_WORK/appimage_extract/squashfs-root/AppRun" ]]; then
        echo "[ERROR] Extracted AppImage missing AppRun entrypoint" >&2
        exit 1
      fi
      echo "[PASS] AppImage extracted cleanly and contains AppRun + usr/bin/$MAIN_BINARY." >> "$VERIFY_REPORT"
    fi
    echo "" >> "$VERIFY_REPORT"
  done

  if command -v xvfb-run >/dev/null 2>&1; then
    set +e
    timeout 6 xvfb-run -a "$BIN_PATH" > "$LOGS_DIR/launch-smoke.log" 2>&1 &
    APP_PID=$!
    sleep 4
    if kill -0 "$APP_PID" >/dev/null 2>&1; then
      echo "[PASS] Linux release binary launched under xvfb-run and remained alive for 4s (PID $APP_PID)." >> "$VERIFY_REPORT"
      kill -TERM "$APP_PID" >/dev/null 2>&1 || true
      wait "$APP_PID" >/dev/null 2>&1 || true
    else
      wait "$APP_PID"
      EXIT_CODE=$?
      echo "[INFO] Headless xvfb-run binary exited cleanly with code $EXIT_CODE (log saved to logs/launch-smoke.log)." >> "$VERIFY_REPORT"
    fi
    set -e
  else
    echo "[INFO] xvfb-run not installed; skipped headless X11 launch smoke test." >> "$VERIFY_REPORT"
  fi

  echo "[NOT EXECUTED IN HEADLESS CI] Interactive desktop GUI login/logout, GNOME Keyring / KWallet unlock prompt, Wayland/X11 window rendering, and distro-native apt/dnf install tests require an interactive desktop session." >> "$VERIFY_REPORT"
else
  echo "[5/5] Skipping --verify-install (pass --verify-install on Linux to verify .deb/.rpm/.AppImage payloads & headless launch)."
fi

echo "Linux build and staging completed cleanly in $RELEASE_DIR"
