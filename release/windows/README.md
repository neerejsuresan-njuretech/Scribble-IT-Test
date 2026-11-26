# SCRIBBLE-IT — Windows Release Staging Directory

This directory receives the staged production Windows deliverables built by `scripts/build-windows-release.ps1` (run on Windows 10/11 or via `.github/workflows/windows-desktop-ci.yml` on `windows-latest`).

## Expected Staged Files (Generated on Windows Build Host)

- `SCRIBBLE-IT_1.0.0_x64-setup.exe` — Primary NSIS per-user Windows installer (`installMode: "currentUser"`)
- `SCRIBBLE-IT_1.0.0_x64_en-US.msi` — Optional secondary WiX Windows Installer package (when WiX builds cleanly)
- `SHA256SUMS.txt` & `SCRIBBLE-IT_1.0.0_x64-setup.exe.sha256` — SHA-256 checksums computed from the final installer binary
- `BUILD_INFO.txt` — Release version (`1.0.0`), UTC build date, Rust/Node toolchain versions, and signing status
- `windows-v1.0.0-release-notes.md` — Copied release notes
- `windows-installation-guide.md` — Copied installation guide
- `installation-verification.txt` — Results from automated silent NSIS (`.exe`) and WiX (`.msi`) install, launch, registry/Start Menu checks, and uninstall verification
- `logs/` — Preserved TypeScript, frontend test, brand verification, Cargo test, Tauri build, and MSI install/uninstall logs

## SmartScreen & Code Signing Notice

Because `src-tauri/tauri.conf.json` specifies `"certificateThumbprint": null`, generated installers are **unsigned** until a Windows Authenticode certificate is provisioned. Windows Defender SmartScreen may display a publisher warning on unsigned `.exe` downloads; verify the exact SHA-256 hash against `SHA256SUMS.txt` before execution.

## Current Status in This Repository

No `.exe` or `.msi` binary is committed to this directory because this workspace was audited and verified inside a Linux environment where Rust/MSVC/NSIS/WiX are unavailable. Run `.github/workflows/windows-desktop-ci.yml` on GitHub Actions (`windows-latest`) or execute `pwsh -File scripts/build-windows-release.ps1 -VerifyInstall` on Windows 10/11 to generate and test the real installer.
