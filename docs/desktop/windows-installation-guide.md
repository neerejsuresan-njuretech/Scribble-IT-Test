# SCRIBBLE-IT for Windows — Installation Guide

**Product:** SCRIBBLE-IT (`Enterprise IT Management. Open to Everyone.`)  
**Organization:** Njure Tech (formally Njure Group)  
**App Identifier:** `in.njuretech.scribbleit`  
**Build Architecture:** Windows 10 (1809+) & Windows 11 (`x86_64` 64-bit)  
**Signing Status:** Unsigned CI Release (`certificateThumbprint: null`; Authenticode signing certificate pending)

---

## 1. System Requirements

- **Operating System:** Windows 10 (Version 1809 or newer) or Windows 11 (`x86_64` 64-bit)
- **WebView Runtime:** Microsoft Edge WebView2 Runtime (automatically checked and installed by the NSIS/WiX bootstrapper if missing)
- **RAM:** 4 GB minimum (8 GB recommended for multi-queue CMDB and workflow views)
- **Disk Space:** ~150 MB free disk space for application binaries and WebView2 cache
- **Backend Server (Optional for full multi-tenant/IAM features):**
  - Self-hosted or cloud **SCRIBBLE-IT FastAPI (`/api/v1`)** instance reachable over **HTTPS** (`http://localhost:8000` permitted for local developer setups only).

---

## 2. Downloading Official Installers

Official Windows installers are published via GitHub Releases (`neerejsuresan-njuretech/Scribble-IT-Test/releases`) and linked directly from [scribbleit.njuregroup.in/#windows-desktop](https://scribbleit.njuregroup.in):

1. **NSIS Setup Executable (`SCRIBBLE-IT_1.0.0_x64-setup.exe`)** — Recommended primary interactive per-user Windows installer (`installMode: "currentUser"`, no administrator privileges required).
2. **WiX Windows Installer (`SCRIBBLE-IT_1.0.0_x64_en-US.msi`)** — Optional enterprise deployment package compatible with Microsoft Intune, Group Policy (GPO), SCCM, and silent unattended rollouts.

> **Honest Availability Note:** If no published GitHub Release asset is present yet, the product page automatically remains in **In Development** without placeholder downloads until `.github/workflows/windows-desktop-ci.yml` publishes verified release assets.

---

## 3. Verifying Installer Integrity (SHA-256)

Always verify the downloaded installer checksum against the published `SHA256SUMS.txt` asset attached to the GitHub Release before running setup:

```powershell
Get-FileHash .\SCRIBBLE-IT_1.0.0_x64-setup.exe -Algorithm SHA256
```

Compare the 64-character SHA-256 output against the published `SHA256SUMS.txt` value shown on the product page and in the GitHub Release notes.

### Windows SmartScreen Note (Unsigned Builds)

Because `src-tauri/tauri.conf.json` specifies `"certificateThumbprint": null`, current installers are unsigned until an organization Authenticode certificate is provisioned. Windows Defender SmartScreen may display *"Windows protected your PC"*. Only click **More info -> Run anyway** after verifying that the file's `Get-FileHash` SHA-256 digest matches the official GitHub Release `SHA256SUMS.txt`.

---

## 4. Installation & Uninstallation

### Interactive Installation
1. Run `SCRIBBLE-IT_1.0.0_x64-setup.exe` (or `SCRIBBLE-IT_1.0.0_x64_en-US.msi`).
2. Follow the branded SCRIBBLE-IT setup wizard.
3. Launch **SCRIBBLE-IT** from the Start Menu or Desktop shortcut.

### Silent Enterprise MSI Installation
```powershell
msiexec /i SCRIBBLE-IT_1.0.0_x64_en-US.msi /qn /norestart
```

### Clean Uninstallation
- Open **Windows Settings -> Apps -> Installed apps -> SCRIBBLE-IT -> Uninstall**.
- Before uninstalling, click **Sign Out** inside SCRIBBLE-IT (or clear sessions in the **Desktop** control panel) to revoke refresh tokens on the server and wipe entries from Windows Credential Manager (`in.njuretech.scribbleit`).

---

## 5. Connecting to a Cloud or Self-Hosted Backend

1. Open the **DESKTOP** control panel button in the top bar (or navigate via `scribbleit://watchtower` after authentication).
2. Enter your backend URL (e.g., `https://itsm.yourcompany.com` or `http://localhost:8000` for local dev).
3. Click **Save & Verify** — SCRIBBLE-IT validates HTTPS enforcement and queries `GET /api/v1/client/config`.
4. Sign in using your organization portal credentials (`Employee`, `IAM`, `Super Admin`, or `End-User`).
