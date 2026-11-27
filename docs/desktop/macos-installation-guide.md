# SCRIBBLE-IT for macOS — Installation Guide

**Product:** SCRIBBLE-IT (`Enterprise IT Management. Open to Everyone.`)  
**Organization:** Njure Tech (formally Njure Group)  
**App Bundle Identifier:** `in.njuretech.scribbleit`  
**Supported Architectures:** Apple Silicon (`arm64` / M1–M4) & Intel (`x86_64`)  
**Minimum macOS Version:** macOS 12 Monterey or newer

---

## 1. Downloading Official `.dmg` Installers

Official macOS disk images (`.dmg`) are built from `src-tauri/` via Tauri 2 on GitHub Actions `macos-latest` runners, published on GitHub Releases (`neerejsuresan-njuretech/Scribble-IT-Test/releases`), and linked directly from [scribbleit.njuregroup.in/#macos-desktop](https://scribbleit.njuregroup.in):

1. **Apple Silicon Macs (M1 / M2 / M3 / M4):** `SCRIBBLE-IT_1.0.0_arm64.dmg` (`aarch64-apple-darwin`)
2. **Intel Macs (`x86_64`):** `SCRIBBLE-IT_1.0.0_x64.dmg` (`x86_64-apple-darwin`)

> **Honest Availability Note:** If published `.dmg` release assets have not yet been uploaded to GitHub Releases, the website keeps **Scribble-IT for macOS** in **In Development** with zero placeholder download links.

---

## 2. Verifying Installer Integrity (`shasum`)

Before opening a downloaded `.dmg`, verify its SHA-256 digest against the published `SHA256SUMS-macos.txt` asset on the GitHub Release page:

```bash
shasum -a 256 ~/Downloads/SCRIBBLE-IT_1.0.0_arm64.dmg
# or for Intel:
shasum -a 256 ~/Downloads/SCRIBBLE-IT_1.0.0_x64.dmg
```

Confirm the 64-character hex checksum matches the value displayed on `https://scribbleit.njuregroup.in` and inside `SHA256SUMS-macos.txt`.

---

## 3. Installing on macOS

1. Double-click the downloaded `.dmg` file to mount the disk image in Finder.
2. Drag **SCRIBBLE-IT.app** into the **Applications** folder alias inside the mounted window.
3. Eject the mounted **SCRIBBLE-IT** volume in Finder.
4. Launch **SCRIBBLE-IT** from **Applications** or Spotlight (`Cmd + Space`).

### Gatekeeper Notice for Unsigned / Non-Notarized Builds

If a CI release was built without Apple Developer ID signing and notarization (`APPLE_SIGNING_IDENTITY` / `notarytool` secrets not configured), macOS Gatekeeper may display an *"unidentified developer"* warning on first launch:

1. Verify the downloaded `.dmg` SHA-256 checksum via `shasum -a 256` first.
2. Control-click (right-click) **SCRIBBLE-IT.app** in **Applications** and choose **Open** (or open **System Settings -> Privacy & Security** and click **Open Anyway**).

---

## 4. Connecting to a Backend & Using Native macOS Features

1. Open the **DESKTOP** control panel button in the SCRIBBLE-IT top bar.
2. Enter your organization's HTTPS FastAPI endpoint (e.g., `https://itsm.yourcompany.com` or `http://localhost:8000` for local development) and click **Save & Verify**.
3. Sign in via your organization portal (`Employee`, `IAM`, `Super Admin`, or `End-User`).
4. Session tokens are stored automatically in **Apple Keychain** (`in.njuretech.scribbleit.macos`).
5. Optional: Enable **Launch at macOS Login** inside the Desktop Control Panel, approve **macOS Notification Center** alerts, or open `scribbleit://watchtower` / `scribbleit://incidents` links after authenticating.

---

## 5. Clean Uninstallation

1. Open SCRIBBLE-IT -> click **Sign Out** (or clear your session in **Desktop Controls -> Active Authenticated Sessions**) to revoke backend refresh tokens and wipe entries from **Apple Keychain**.
2. Quit SCRIBBLE-IT (`Cmd + Q`).
3. Move `/Applications/SCRIBBLE-IT.app` to Trash.
4. Optionally remove non-secret client preferences at `~/Library/Application Support/in.njuretech.scribbleit/desktop-settings.json`.
