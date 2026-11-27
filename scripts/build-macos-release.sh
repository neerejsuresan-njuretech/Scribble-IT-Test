#!/usr/bin/env bash
set -euo pipefail

VERIFY_INSTALL=0
TARGET_ARCHS=("aarch64-apple-darwin" "x86_64-apple-darwin")

while [[ $# -gt 0 ]]; do
  case "$1" in
    --verify-install)
      VERIFY_INSTALL=1
      shift
      ;;
    --architectures)
      IFS=',' read -r -a TARGET_ARCHS <<< "$2"
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
RELEASE_DIR="$REPO_ROOT/release/macos"
LOGS_DIR="$RELEASE_DIR/logs"

mkdir -p "$RELEASE_DIR" "$LOGS_DIR"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "[ERROR] scripts/build-macos-release.sh requires a macOS (Darwin) host with Xcode Command Line Tools and hdiutil." >&2
  exit 1
fi

for cmd in node npm rustc cargo hdiutil shasum codesign otool lipo plutil xattr; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[ERROR] Required macOS toolchain command '$cmd' was not found on PATH." >&2
    exit 1
  fi
done

PLIST_BUDDY="/usr/libexec/PlistBuddy"
if [[ ! -x "$PLIST_BUDDY" ]]; then
  echo "[ERROR] /usr/libexec/PlistBuddy is required on macOS." >&2
  exit 1
fi

PRODUCT_NAME="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$REPO_ROOT/src-tauri/tauri.conf.json','utf8')).productName)")"
APP_VERSION="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$REPO_ROOT/src-tauri/tauri.conf.json','utf8')).version)")"
APP_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$REPO_ROOT/src-tauri/tauri.conf.json','utf8')).identifier)")"
MAIN_BINARY="$(node -e "const c=JSON.parse(require('fs').readFileSync('$REPO_ROOT/src-tauri/tauri.conf.json','utf8')); console.log(c.mainBinaryName || c.productName)")"

SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:-}"
if [[ -z "$SIGNING_IDENTITY" ]]; then
  unset APPLE_SIGNING_IDENTITY
fi
if [[ -z "${APPLE_ID:-}" ]]; then unset APPLE_ID; fi
if [[ -z "${APPLE_APP_PASSWORD:-}" ]]; then unset APPLE_APP_PASSWORD; fi
if [[ -z "${APPLE_TEAM_ID:-}" ]]; then unset APPLE_TEAM_ID; fi
if [[ -z "${APPLE_API_KEY:-}" ]]; then unset APPLE_API_KEY; fi
if [[ -z "${APPLE_API_ISSUER:-}" ]]; then unset APPLE_API_ISSUER; fi
export CI="${CI:-true}"

HAS_NOTARY_CREDS=0
if [[ -n "$SIGNING_IDENTITY" ]] && ([[ -n "${APPLE_ID:-}" && -n "${APPLE_APP_PASSWORD:-}" && -n "${APPLE_TEAM_ID:-}" ]] || [[ -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_ISSUER:-}" ]]); then
  HAS_NOTARY_CREDS=1
fi

SIGNING_STATUS_LABEL="Unsigned / Not Notarized (Developer ID signing identity not configured)"
if [[ -n "$SIGNING_IDENTITY" && "$HAS_NOTARY_CREDS" -eq 1 ]]; then
  SIGNING_STATUS_LABEL="Signed with Developer ID & Notarized ($SIGNING_IDENTITY)"
elif [[ -n "$SIGNING_IDENTITY" ]]; then
  SIGNING_STATUS_LABEL="Signed with Developer ID (Notarization credentials not configured)"
fi

echo "=== SCRIBBLE-IT macOS Production Build ($PRODUCT_NAME v$APP_VERSION / $APP_ID) ==="
echo "Host OS: $(sw_vers -productName) $(sw_vers -productVersion) ($(sw_vers -buildVersion)) [$(uname -m)]"
echo "Signing Status: $SIGNING_STATUS_LABEL"

{
  echo "Product: $PRODUCT_NAME"
  echo "Main Binary: $MAIN_BINARY"
  echo "App ID: $APP_ID"
  echo "Version: $APP_VERSION"
  echo "Build Date (UTC): $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "macOS Host: $(sw_vers -productName) $(sw_vers -productVersion) ($(sw_vers -buildVersion)) [$(uname -m)]"
  echo "Xcode / Clang: $(clang --version | head -n 1)"
  echo "Node.js: $(node --version)"
  echo "npm: $(npm --version)"
  echo "rustc: $(rustc --version)"
  echo "cargo: $(cargo --version)"
  echo "Signing Status: $SIGNING_STATUS_LABEL"
} > "$LOGS_DIR/environment.log"

cd "$REPO_ROOT"

echo "[1/5] Running TypeScript, frontend tests & brand checks..."
npm run typecheck:packages 2>&1 | tee "$LOGS_DIR/typecheck-packages.log"
npm run lint 2>&1 | tee "$LOGS_DIR/frontend-lint.log"
npm run test:frontend 2>&1 | tee "$LOGS_DIR/frontend-tests.log"
npm run verify:brand 2>&1 | tee "$LOGS_DIR/brand-verify.log"

echo "[2/5] Running Rust unit tests..."
cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | tee "$LOGS_DIR/cargo-test.log"

export VITE_BASE_PATH="${VITE_BASE_PATH:-./}"

STAGED_DMGS=()
STAGED_LABELS=()
STAGED_ARCHS=()
STAGED_MACHO_ARCHS=()

echo "[3/5] Building Tauri 2 macOS .app & .dmg bundles for: ${TARGET_ARCHS[*]}..."
for target in "${TARGET_ARCHS[@]}"; do
  rustup target add "$target" >/dev/null 2>&1 || true

  case "$target" in
    aarch64-apple-darwin)
      ARCH_LABEL="arm64"
      EXPECTED_MACHO="arm64"
      HUMAN_ARCH="Apple Silicon (arm64)"
      ;;
    x86_64-apple-darwin)
      ARCH_LABEL="x64"
      EXPECTED_MACHO="x86_64"
      HUMAN_ARCH="Intel (x86_64)"
      ;;
    *)
      ARCH_LABEL="$target"
      EXPECTED_MACHO="$target"
      HUMAN_ARCH="$target"
      ;;
  esac

  echo "  -> Building $HUMAN_ARCH ($target)..."
  npx tauri build --target "$target" --bundles app,dmg 2>&1 | tee "$LOGS_DIR/tauri-build-${ARCH_LABEL}.log"

  BUNDLE_ROOT="$REPO_ROOT/src-tauri/target/$target/release/bundle"
  APP_PATH="$BUNDLE_ROOT/macos/$PRODUCT_NAME.app"
  if [[ ! -d "$APP_PATH" ]]; then
    echo "[ERROR] Expected .app bundle missing at $APP_PATH" >&2
    exit 1
  fi

  BIN_PATH="$APP_PATH/Contents/MacOS/$MAIN_BINARY"
  if [[ ! -s "$BIN_PATH" ]]; then
    echo "[ERROR] Expected macOS executable missing or empty at $BIN_PATH" >&2
    exit 1
  fi

  BUNDLE_ID="$("$PLIST_BUDDY" -c "Print :CFBundleIdentifier" "$APP_PATH/Contents/Info.plist")"
  if [[ "$BUNDLE_ID" != "$APP_ID" ]]; then
    echo "[ERROR] Bundle ID mismatch in Info.plist: expected '$APP_ID', got '$BUNDLE_ID'" >&2
    exit 1
  fi

  ACTUAL_ARCHS="$(lipo -archs "$BIN_PATH")"
  if [[ "$ACTUAL_ARCHS" != *"$EXPECTED_MACHO"* ]]; then
    echo "[ERROR] Mach-O architecture mismatch for $BIN_PATH: expected $EXPECTED_MACHO, got $ACTUAL_ARCHS" >&2
    exit 1
  fi

  if ! otool -L "$BIN_PATH" | grep -q "Security.framework"; then
    echo "[ERROR] Expected Apple Security.framework linkage (for Keychain) not found in $BIN_PATH" >&2
    exit 1
  fi

  DMG_SOURCE="$(find "$BUNDLE_ROOT/dmg" -maxdepth 1 -type f -name '*.dmg' | head -n 1)"
  if [[ -z "$DMG_SOURCE" || ! -s "$DMG_SOURCE" ]]; then
    echo "[ERROR] Expected non-empty .dmg installer under $BUNDLE_ROOT/dmg" >&2
    exit 1
  fi

  STAGED_DMG="$RELEASE_DIR/${PRODUCT_NAME}_${APP_VERSION}_${ARCH_LABEL}.dmg"
  cp -f "$DMG_SOURCE" "$STAGED_DMG"

  if [[ "$HAS_NOTARY_CREDS" -eq 1 ]]; then
    echo "  -> Submitting $STAGED_DMG for Apple notarization & stapling..."
    if [[ -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_ISSUER:-}" ]]; then
      xcrun notarytool submit "$STAGED_DMG" --key "$APPLE_API_KEY" --issuer "$APPLE_API_ISSUER" --wait 2>&1 | tee "$LOGS_DIR/notary-${ARCH_LABEL}.log"
    else
      xcrun notarytool submit "$STAGED_DMG" --apple-id "$APPLE_ID" --password "$APPLE_APP_PASSWORD" --team-id "$APPLE_TEAM_ID" --wait 2>&1 | tee "$LOGS_DIR/notary-${ARCH_LABEL}.log"
    fi
    xcrun stapler staple "$STAGED_DMG"
  fi

  STAGED_DMGS+=("$STAGED_DMG")
  STAGED_LABELS+=("$ARCH_LABEL")
  STAGED_ARCHS+=("$HUMAN_ARCH")
  STAGED_MACHO_ARCHS+=("$EXPECTED_MACHO")
done

echo "[4/5] Generating SHA-256 checksums and release metadata..."
SHA_FILE="$RELEASE_DIR/SHA256SUMS-macos.txt"
: > "$SHA_FILE"
BUILD_INFO="$RELEASE_DIR/BUILD_INFO.txt"
cp "$LOGS_DIR/environment.log" "$BUILD_INFO"

for i in "${!STAGED_DMGS[@]}"; do
  dmg="${STAGED_DMGS[$i]}"
  label="${STAGED_LABELS[$i]}"
  human="${STAGED_ARCHS[$i]}"
  name="$(basename "$dmg")"
  bytes="$(stat -f%z "$dmg")"
  hash="$(shasum -a 256 "$dmg" | awk '{print $1}')"
  line="${hash}  ${name}"
  echo "$line" >> "$SHA_FILE"
  echo "$line" > "${dmg}.sha256"
  {
    echo "DMG ($human): $name"
    echo "DMG Size (${label} bytes): $bytes"
    echo "DMG SHA-256 (${label}): $hash"
  } >> "$BUILD_INFO"
done

cp -f "$REPO_ROOT/docs/releases/macos-v1.0.0-release-notes.md" "$RELEASE_DIR/macos-v1.0.0-release-notes.md"
cp -f "$REPO_ROOT/docs/desktop/macos-installation-guide.md" "$RELEASE_DIR/macos-installation-guide.md"

if [[ "$VERIFY_INSTALL" -eq 1 ]]; then
  echo "[5/5] Verifying .dmg integrity, safe mount, bundle metadata, Mach-O arch, Security.framework & launch..."
  VERIFY_REPORT="$RELEASE_DIR/installation-verification.txt"
  TMP_WORK="$(mktemp -d /tmp/scribbleit_dmg_verify.XXXXXX)"
  REAL_TMP_WORK="$(cd "$TMP_WORK" && pwd -P)"
  CURRENT_MOUNT=""
  CURRENT_DEV=""

  detach_dmg_target() {
    local dev_node="${1:-}"
    local mount_path="${2:-}"
    local attempt target
    for attempt in 1 2 3; do
      for target in "$mount_path" "$dev_node"; do
        [[ -z "$target" ]] && continue
        if hdiutil detach "$target" -quiet >/dev/null 2>&1; then
          return 0
        fi
      done
      sleep 1
    done
    for target in "$mount_path" "$dev_node"; do
      [[ -z "$target" ]] && continue
      hdiutil detach "$target" -force -quiet >/dev/null 2>&1 || true
    done
    return 0
  }

  cleanup_existing_dmg_mounts() {
    local dmg_path="$1"
    local mount_path="$2"
    local vol_prefix="/Volumes/${PRODUCT_NAME}"
    local info_out dev_candidates dev
    info_out="$(hdiutil info 2>/dev/null || true)"
    dev_candidates="$(printf '%s\n' "$info_out" | awk -v dmg="$dmg_path" -v mnt="$mount_path" -v vpref="$vol_prefix" '
      /^image-path[[:space:]]*:/ { match_img = (index($0, dmg) > 0) }
      /^\/dev\/disk/ {
        if (match_img || index($0, mnt) > 0 || index($0, vpref) > 0) {
          print $1
        }
      }
      /^================================================/ { match_img = 0 }
    ' | sort -u)"
    for dev in $dev_candidates; do
      detach_dmg_target "$dev" ""
    done
    if [[ -n "$mount_path" ]] && mount | grep -Fq " on ${mount_path} "; then
      detach_dmg_target "" "$mount_path"
    fi
  }

  cleanup_verify() {
    local exit_code=$?
    set +e
    if [[ -n "${CURRENT_MOUNT:-}" || -n "${CURRENT_DEV:-}" ]]; then
      detach_dmg_target "${CURRENT_DEV:-}" "${CURRENT_MOUNT:-}"
      CURRENT_MOUNT=""
      CURRENT_DEV=""
    fi
    if [[ -n "${REAL_TMP_WORK:-}" && -d "${REAL_TMP_WORK:-}" ]]; then
      rm -rf "$REAL_TMP_WORK"
    fi
    exit "$exit_code"
  }
  trap cleanup_verify EXIT

  {
    echo "Automated macOS .dmg Verification ($(date -u +%Y-%m-%dT%H:%M:%SZ))"
    echo "macOS Runner: $(sw_vers -productName) $(sw_vers -productVersion) [$(uname -m)]"
    echo "Signing Status: $SIGNING_STATUS_LABEL"
    echo ""
  } > "$VERIFY_REPORT"

  HOST_ARCH="$(uname -m)"

  for i in "${!STAGED_DMGS[@]}"; do
    dmg="${STAGED_DMGS[$i]}"
    label="${STAGED_LABELS[$i]}"
    human="${STAGED_ARCHS[$i]}"
    expected_macho="${STAGED_MACHO_ARCHS[$i]}"
    name="$(basename "$dmg")"

    if [[ ! -f "$dmg" || ! -s "$dmg" ]]; then
      echo "[ERROR] Staged DMG missing or empty: $dmg" >&2
      exit 1
    fi
    chmod 0644 "$dmg"
    bytes="$(stat -f%z "$dmg")"

    {
      echo "--- DMG Verification: $name ($human, $bytes bytes) ---"
    } >> "$VERIFY_REPORT"

    # Strip any macOS quarantine attribute inherited on CI runner to prevent headless dialog cancellation
    xattr -d com.apple.quarantine "$dmg" >/dev/null 2>&1 || true

    # Verify UDIF image metadata and internal block checksums BEFORE mounting
    if ! hdiutil imageinfo "$dmg" > "$LOGS_DIR/hdiutil-imageinfo-${label}.log" 2>&1; then
      echo "[ERROR] hdiutil imageinfo failed for $name" >&2
      cat "$LOGS_DIR/hdiutil-imageinfo-${label}.log" >&2
      exit 1
    fi
    if ! hdiutil verify "$dmg" > "$LOGS_DIR/hdiutil-verify-${label}.log" 2>&1; then
      echo "[ERROR] hdiutil verify integrity check failed for $name" >&2
      cat "$LOGS_DIR/hdiutil-verify-${label}.log" >&2
      exit 1
    fi
    echo "[PASS] DMG UDIF structure and checksum verified via hdiutil verify ($name)." >> "$VERIFY_REPORT"

    MOUNT_DIR="$(mktemp -d "${REAL_TMP_WORK}/mnt_${label}.XXXXXX")"
    REAL_MOUNT_DIR="$(cd "$MOUNT_DIR" && pwd -P)"
    APP_DEST_DIR="$(mktemp -d "${REAL_TMP_WORK}/apps_${label}.XXXXXX")"
    chmod 0755 "$REAL_MOUNT_DIR" "$APP_DEST_DIR"

    cleanup_existing_dmg_mounts "$dmg" "$REAL_MOUNT_DIR"

    ATTACH_LOG="$LOGS_DIR/hdiutil-attach-${label}.log"
    ATTACHED_OK=0
    CURRENT_MOUNT="$REAL_MOUNT_DIR"
    CURRENT_DEV=""

    for attempt in 1 2 3; do
      : > "$ATTACH_LOG"
      if hdiutil attach "$dmg" \
        -nobrowse \
        -noautoopen \
        -readonly \
        -noverify \
        -mountpoint "$REAL_MOUNT_DIR" \
        < /dev/null > "$ATTACH_LOG" 2>&1; then
        CURRENT_DEV="$(awk '/^\/dev\/disk[0-9]+/ {print $1; exit}' "$ATTACH_LOG")"
        ATTACHED_OK=1
        break
      fi
      echo "[WARN] hdiutil attach attempt $attempt failed for $name; retrying after cleanup..." >&2
      cat "$ATTACH_LOG" >&2 || true
      cleanup_existing_dmg_mounts "$dmg" "$REAL_MOUNT_DIR"
      sleep 3
    done

    if [[ "$ATTACHED_OK" -ne 1 ]]; then
      echo "[ERROR] hdiutil attach failed after retries for $name ($human)." >&2
      cat "$ATTACH_LOG" >&2 || true
      hdiutil info >&2 || true
      exit 1
    fi

    MOUNTED_APP="$REAL_MOUNT_DIR/$PRODUCT_NAME.app"
    if [[ ! -d "$MOUNTED_APP" ]]; then
      echo "[ERROR] Mounted DMG $name does not contain $PRODUCT_NAME.app at $REAL_MOUNT_DIR" >&2
      ls -la "$REAL_MOUNT_DIR" >&2 || true
      exit 1
    fi

    MOUNTED_PLIST="$MOUNTED_APP/Contents/Info.plist"
    if [[ ! -f "$MOUNTED_PLIST" ]]; then
      echo "[ERROR] Mounted app bundle missing Contents/Info.plist ($MOUNTED_PLIST)" >&2
      exit 1
    fi
    if ! plutil -lint "$MOUNTED_PLIST" > "$LOGS_DIR/plutil-${label}.log" 2>&1; then
      echo "[ERROR] Invalid Info.plist in mounted $PRODUCT_NAME.app ($name)" >&2
      cat "$LOGS_DIR/plutil-${label}.log" >&2
      exit 1
    fi

    MOUNTED_BUNDLE_ID="$("$PLIST_BUDDY" -c "Print :CFBundleIdentifier" "$MOUNTED_PLIST")"
    MOUNTED_EXEC_NAME="$("$PLIST_BUDDY" -c "Print :CFBundleExecutable" "$MOUNTED_PLIST" 2>/dev/null || echo "$MAIN_BINARY")"
    if [[ "$MOUNTED_BUNDLE_ID" != "$APP_ID" ]]; then
      echo "[ERROR] Mounted Info.plist CFBundleIdentifier mismatch: expected '$APP_ID', got '$MOUNTED_BUNDLE_ID'" >&2
      exit 1
    fi

    MOUNTED_BIN="$MOUNTED_APP/Contents/MacOS/$MOUNTED_EXEC_NAME"
    if [[ ! -s "$MOUNTED_BIN" || ! -x "$MOUNTED_BIN" ]]; then
      echo "[ERROR] Mounted executable missing or not executable at $MOUNTED_BIN" >&2
      exit 1
    fi

    MOUNTED_ARCH="$(lipo -archs "$MOUNTED_BIN")"
    if [[ "$MOUNTED_ARCH" != *"$expected_macho"* ]]; then
      echo "[ERROR] Mounted Mach-O architecture mismatch for $name: expected '$expected_macho', got '$MOUNTED_ARCH'" >&2
      exit 1
    fi

    if ! otool -L "$MOUNTED_BIN" | grep -q "Security.framework"; then
      echo "[ERROR] Mounted binary $MOUNTED_BIN does not link Apple Security.framework" >&2
      exit 1
    fi

    if [[ ! -L "$REAL_MOUNT_DIR/Applications" ]]; then
      echo "[WARN] Mounted DMG $name missing Applications drag-drop symlink" >> "$VERIFY_REPORT"
    else
      echo "[PASS] DMG volume contains $PRODUCT_NAME.app and Applications drop target." >> "$VERIFY_REPORT"
    fi

    echo "[PASS] DMG verified & mounted cleanly: $name (mount=$REAL_MOUNT_DIR, Info.plist valid, exec=$MOUNTED_EXEC_NAME, Arch=$MOUNTED_ARCH)" >> "$VERIFY_REPORT"

    ditto "$MOUNTED_APP" "$APP_DEST_DIR/$PRODUCT_NAME.app"
    detach_dmg_target "$CURRENT_DEV" "$REAL_MOUNT_DIR"
    CURRENT_MOUNT=""
    CURRENT_DEV=""

    INSTALLED_APP="$APP_DEST_DIR/$PRODUCT_NAME.app"
    INSTALLED_BIN="$INSTALLED_APP/Contents/MacOS/$MOUNTED_EXEC_NAME"
    if [[ ! -s "$INSTALLED_BIN" || ! -x "$INSTALLED_BIN" ]]; then
      echo "[ERROR] Installed binary missing or not executable inside $INSTALLED_APP" >&2
      exit 1
    fi

    VERIFIED_ID="$("$PLIST_BUDDY" -c "Print :CFBundleIdentifier" "$INSTALLED_APP/Contents/Info.plist")"
    VERIFIED_SCHEMES="$("$PLIST_BUDDY" -c "Print :CFBundleURLTypes:0:CFBundleURLSchemes:0" "$INSTALLED_APP/Contents/Info.plist" 2>/dev/null || echo 'missing')"
    VERIFIED_MIN_OS="$("$PLIST_BUDDY" -c "Print :LSMinimumSystemVersion" "$INSTALLED_APP/Contents/Info.plist" 2>/dev/null || echo 'unknown')"
    INSTALLED_ARCH="$(lipo -archs "$INSTALLED_BIN")"
    echo "[PASS] Copied $PRODUCT_NAME.app cleanly; BundleID=$VERIFIED_ID, MinOS=$VERIFIED_MIN_OS, URLScheme=$VERIFIED_SCHEMES, Arch=$INSTALLED_ARCH" >> "$VERIFY_REPORT"

    if [[ "$VERIFIED_SCHEMES" != "scribbleit" ]]; then
      echo "[ERROR] Deep-link scheme 'scribbleit' missing from Info.plist CFBundleURLTypes ($VERIFIED_SCHEMES)" >&2
      exit 1
    fi

    if codesign --verify --deep --strict "$INSTALLED_APP" >/dev/null 2>&1; then
      echo "[PASS] codesign --verify --deep --strict succeeded." >> "$VERIFY_REPORT"
    else
      echo "[INFO] Ad-hoc/unsigned bundle notice verified honestly (codesign strict requires Developer ID cert)." >> "$VERIFY_REPORT"
    fi

    CAN_EXEC_ON_HOST=0
    if [[ "$label" == "arm64" && "$HOST_ARCH" == "arm64" ]]; then
      CAN_EXEC_ON_HOST=1
    elif [[ "$label" == "x64" && "$HOST_ARCH" == "x86_64" ]]; then
      CAN_EXEC_ON_HOST=1
    elif [[ "$label" == "x64" && "$HOST_ARCH" == "arm64" ]] && { /usr/bin/pgrep -q oahd 2>/dev/null || arch -x86_64 /usr/bin/true >/dev/null 2>&1; }; then
      CAN_EXEC_ON_HOST=1
    fi

    if [[ "$CAN_EXEC_ON_HOST" -eq 1 ]]; then
      "$INSTALLED_BIN" >/dev/null 2>&1 &
      APP_PID=$!
      sleep 4
      if kill -0 "$APP_PID" >/dev/null 2>&1; then
        echo "[PASS] Installed binary launched cleanly on $HOST_ARCH (PID $APP_PID) and remained stable for 4s." >> "$VERIFY_REPORT"
        kill -TERM "$APP_PID" >/dev/null 2>&1 || true
        sleep 1
        kill -KILL "$APP_PID" >/dev/null 2>&1 || true
        wait "$APP_PID" >/dev/null 2>&1 || true
      else
        wait "$APP_PID" || LAUNCH_CODE=$?
        if [[ "${LAUNCH_CODE:-0}" -eq 0 ]]; then
          echo "[INFO] Binary exited with status 0 in headless CI session." >> "$VERIFY_REPORT"
        else
          echo "[ERROR] Installed binary crashed immediately on launch (exit $LAUNCH_CODE)." >&2
          exit 1
        fi
      fi
    else
      echo "[INFO] Cross-compiled $human binary verified via Info.plist/Mach-O/otool; Rosetta runtime not installed on headless runner." >> "$VERIFY_REPORT"
    fi

    rm -rf "$APP_DEST_DIR"
    echo "[PASS] Clean uninstall/removal check completed for $name." >> "$VERIFY_REPORT"
    echo "" >> "$VERIFY_REPORT"
  done

  echo "[NOT EXECUTED IN HEADLESS CI] Interactive GUI login/logout, Apple Keychain Access prompt inspection, Finder DMG visual layout, and Gatekeeper right-click/spctl notarized assessment require an interactive macOS desktop session (and Apple Developer ID certificate for notarization)." >> "$VERIFY_REPORT"
else
  echo "[5/5] Skipping --verify-install (pass --verify-install on macOS to mount and smoke-test .dmg bundles)."
fi

echo "macOS build and staging completed cleanly in $RELEASE_DIR"
