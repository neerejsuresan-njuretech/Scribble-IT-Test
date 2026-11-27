# SCRIBBLE-IT for Linux — Installation Guide

**Product:** SCRIBBLE-IT (`Enterprise IT Management. Open to Everyone.`)  
**Organization:** Njure Tech (formally Njure Group)  
**App Bundle Identifier:** `in.njuretech.scribbleit`  
**Supported Architecture:** `x86_64` (`amd64` / 64-bit)  
**Supported Distributions:** Ubuntu `22.04+`, Debian `12+`, Fedora, RHEL `9+`, openSUSE, and other GLIBC `2.35+` distributions (via `.AppImage`)

---

## 1. Downloading Official Linux Installers

Official Linux packages are built from `src-tauri/` via Tauri 2 on GitHub Actions `ubuntu-22.04` runners, published to GitHub Releases (`neerejsuresan-njuretech/Scribble-IT-Test/releases`), and linked directly from [scribbleit.njuregroup.in/#linux-desktop](https://scribbleit.njuregroup.in/#linux-desktop):

1. **Debian / Ubuntu (`.deb`):** `SCRIBBLE-IT_1.0.0_amd64.deb`
2. **Fedora / RHEL / openSUSE (`.rpm`):** `SCRIBBLE-IT-1.0.0-1.x86_64.rpm`
3. **Universal Portable Linux (`.AppImage`):** `SCRIBBLE-IT_1.0.0_amd64.AppImage`

> **Honest Availability Note:** If published Linux release assets have not yet been uploaded to GitHub Releases, the website keeps **Scribble-IT for Linux** in **In Development** with zero placeholder download links.
>
> **ARM64 (`aarch64`) Note:** Currently built and verified for Linux `x86_64` (`amd64`). ARM64 packages are not yet published.

---

## 2. Verifying Installer Integrity (`sha256sum`)

Before installing or running any package, verify its SHA-256 digest against the published `SHA256SUMS-linux.txt` asset on the GitHub Release page:

```bash
sha256sum ~/Downloads/SCRIBBLE-IT_1.0.0_amd64.deb
sha256sum ~/Downloads/SCRIBBLE-IT-1.0.0-1.x86_64.rpm
sha256sum ~/Downloads/SCRIBBLE-IT_1.0.0_amd64.AppImage
```

Confirm the 64-character hex checksum matches the value displayed on `https://scribbleit.njuregroup.in/#linux-desktop` and inside `SHA256SUMS-linux.txt`.

---

## 3. Installing on Linux

### Debian / Ubuntu (`.deb`)

```bash
sudo apt update
sudo apt install ./SCRIBBLE-IT_1.0.0_amd64.deb
```

Required shared dependencies (`libwebkit2gtk-4.1-0`, `libgtk-3-0`) are resolved automatically by `apt`. Launch **SCRIBBLE-IT** from your desktop application launcher or run `scribble-it`.

### Fedora / RHEL 9+ / Rocky / AlmaLinux (`.rpm`)

```bash
sudo dnf install ./SCRIBBLE-IT-1.0.0-1.x86_64.rpm
```

Required shared dependencies (`webkit2gtk4.1`, `gtk3`) are installed automatically by `dnf`.

### Universal Portable Linux (`.AppImage`)

```bash
chmod +x ./SCRIBBLE-IT_1.0.0_amd64.AppImage
./SCRIBBLE-IT_1.0.0_amd64.AppImage
```

> **Note on Ubuntu 24.04+ / FUSE:** If your distribution lacks `libfuse2`, install `libfuse2t64` (Ubuntu 24.04+) or `fuse` / `libfuse2`, or run `./SCRIBBLE-IT_1.0.0_amd64.AppImage --appimage-extract-and-run`.

---

## 4. Connecting to a Backend & Native Secret Service Keyring

1. Launch **SCRIBBLE-IT** and click **DESKTOP** in the top navigation bar.
2. Enter your organization's HTTPS FastAPI endpoint (e.g., `https://itsm.yourcompany.com` or `http://localhost:8000` for local development) and click **Save & Verify**.
3. Sign in via your organization portal (`Employee`, `IAM`, `Super Admin`, or `End-User`).
4. Session tokens are stored automatically in your desktop's **Freedesktop Secret Service** keyring (`GNOME Keyring` or `KWallet`) under service `in.njuretech.scribbleit.linux`.
5. Optional: Enable **Launch on Linux Login** (`~/.config/autostart/` via XDG autostart), approve Freedesktop desktop notifications, or open `scribbleit://watchtower` / `scribbleit://incidents` links after authenticating.

---

## 5. Clean Uninstallation

1. Open SCRIBBLE-IT -> click **Sign Out** (or revoke your session in **Desktop Controls -> Active Authenticated Sessions**) to revoke backend refresh tokens and wipe **Secret Service** entries.
2. Remove the installed package:
   - **Debian / Ubuntu:** `sudo apt remove scribble-it`
   - **Fedora / RHEL:** `sudo dnf remove scribble-it`
   - **AppImage:** Delete the `.AppImage` file.
3. Optionally remove non-secret local preferences at `~/.config/in.njuretech.scribbleit/desktop-settings.json`.
