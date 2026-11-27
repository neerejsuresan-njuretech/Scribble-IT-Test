# SCRIBBLE-IT for macOS — Release Staging Directory

**Product:** SCRIBBLE-IT (`Enterprise IT Management. Open to Everyone.`)  
**Organization:** Njure Tech (formally Njure Group)  
**App Bundle Identifier:** `in.njuretech.scribbleit`

This directory is the release staging target used by `scripts/build-macos-release.sh` and `.github/workflows/macos-desktop-ci.yml`.

## Expected Release Outputs (Generated on macOS `macos-latest` Runners)

- `SCRIBBLE-IT_<version>_arm64.dmg` — Apple Silicon (`aarch64-apple-darwin`) signed/unsigned DMG disk image
- `SCRIBBLE-IT_<version>_x64.dmg` — Intel (`x86_64-apple-darwin`) signed/unsigned DMG disk image
- `SHA256SUMS-macos.txt` — SHA-256 digests for all generated `.dmg` files
- `<dmg-filename>.sha256` — Per-artifact checksum file
- `BUILD_INFO.txt` — macOS SDK, Xcode/Clang, Rust, Node.js, architecture, and signing/notarization metadata
- `installation-verification.txt` — Automated `hdiutil attach`, `.app` bundle inspection (`CFBundleIdentifier`, `Security.framework`, Mach-O `lipo`), launch test, and clean unmount log

> **Note:** Binary `.dmg`/`.app` outputs are excluded from git tracking via `.gitignore` and published directly to GitHub Releases.
