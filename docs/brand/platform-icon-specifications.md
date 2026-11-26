# SCRIBBLE-IT Five-Platform Icon & Packaging Specifications

Every native platform uses the unified **SCRIBBLE-IT** document-S-pencil symbol on the official Deep Navy (`#0B1F3B`), Njure Blue (`#0A84FF`), and Accent Cyan (`#22D3EE`) palette. Operating-system logos are never used as application icons, and zero version numbers appear on any visual asset.

---

## 1. Web & Progressive Web Assets (`assets/brand/icons/web/` & `public/`)

| File | Dimensions | Format / Color | Purpose |
| :--- | :--- | :--- | :--- |
| `app-icon-1024.png` | `1024x1024` | 32-bit RGBA PNG | High-resolution master web/store app icon |
| `app-icon-512.png` / `icon-512.png` | `512x512` | 32-bit RGBA PNG | Standard web app / manifest icon |
| `icon-192.png` | `192x192` | 32-bit RGBA PNG | Compact PWA manifest icon |
| `favicon.ico` | `16, 32, 48` | Multi-frame ICO | Classic browser favicon (synced to `public/favicon.ico`) |
| `favicon.svg` | Vector | SVG | Modern scalable browser favicon (synced to `public/favicon.svg`) |
| `favicon-{16,32,48}x*.png` | `16/32/48` | 32-bit RGBA PNG | Explicit PNG favicons (synced to `public/`) |
| `apple-touch-icon.png` | `180x180` | **24-bit Opaque RGB PNG** | iOS Safari home-screen bookmark icon (zero alpha) |

---

## 2. Windows (`assets/brand/icons/windows/`)

Ready for future Tauri Windows builds (`tauri.conf.json` -> `bundle.icon` and MSI/NSIS installers):

- **Multi-frame Windows Icon**: `icon.ico` containing 7 embedded frames (`16, 24, 32, 48, 64, 128, 256` px).
- **Tauri / Windows AppX PNG Resources**: `icon.png` (512px), `32x32.png`, `128x128.png`, `128x128@2x.png` (256px), `Square30x30Logo.png`, `Square44x44Logo.png`, `Square71x71Logo.png`, `Square89x89Logo.png`, `Square107x107Logo.png`, `Square142x142Logo.png`, `Square150x150Logo.png`, `Square284x284Logo.png`, `Square310x310Logo.png`, `StoreLogo.png` (50px).
- **Installer Branding (`installer/`)** (24-bit BMP3 + PNG + SVG sources):
  - `msi-banner.bmp` (`493x58`) — WiX MSI top banner
  - `msi-dialog.bmp` (`493x312`) — WiX MSI welcome dialog sidebar
  - `nsis-header.bmp` (`150x57`) — NSIS header bitmap
  - `nsis-sidebar.bmp` (`164x314`) — NSIS wizard sidebar bitmap

---

## 3. macOS (`assets/brand/icons/macos/`)

Ready for future Tauri macOS `.app` and `.dmg` bundles:

- **macOS Bundle Icon**: `icon.icns` (`icns` magic header with `icp4`, `icp5`, `icp6`, `ic07`, `ic08`, `ic09`, `ic10`, `ic11`, `ic12`, `ic13`, `ic14` chunks spanning 16px through 1024px Retina).
- **Iconset Source (`icon.iconset/`)**: All 10 Apple `.iconset` PNG sizes (`icon_16x16.png` through `icon_512x512@2x.png`).
- **DMG Installer Branding (`dmg/`)**:
  - `volume-icon.icns` — Mounted DMG volume icon
  - `dmg-background.png` (`540x380`) and `dmg-background@2x.png` (`1080x760`) — Retina drag-to-Applications canvas with SCRIBBLE-IT branding.

---

## 4. Linux (`assets/brand/icons/linux/`)

Conforms to the Freedesktop.org Icon Theme Specification and AppStream metadata standard:

- **Freedesktop `hicolor` Hierarchy (`hicolor/<size>x<size>/apps/scribble-it.png`)**: `16x16`, `24x24`, `32x32`, `48x48`, `64x64`, `128x128`, `256x256`, `512x512`.
- **Scalable Vector**: `hicolor/scalable/apps/scribble-it.svg`.
- **Desktop Entry**: `scribble-it.desktop` (`Name=SCRIBBLE-IT`, `Icon=scribble-it`, `Categories=Office;Network;System;`).
- **Packaging Assets (`packaging/`)**:
  - `appimage-diricon.png` (`256x256` `.DirIcon` for AppImage)
  - `deb-rpm-icon-512.png` (`512x512` for DEB/RPM packages)
  - `in.njuregroup.scribbleit.metainfo.xml` (AppStream metadata with `AGPL-3.0-only` license and official URLs).

---

## 5. Android (`assets/brand/icons/android/`)

Conforms to Android 8.0+ Adaptive Icons (`108dp` canvas with `72dp` safe zone) and Android 13+ Themed Monochrome Icons:

- **Adaptive & Legacy Resource Tree (`res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/`)**:
  - `ic_launcher.png` & `ic_launcher_round.png`: `48, 72, 96, 144, 192` px
  - `ic_launcher_foreground.png` (RGBA, safe-zone centered): `108, 162, 216, 324, 432` px
  - `ic_launcher_background.png` (24-bit opaque `#0B1F3B` Deep Navy): `108, 162, 216, 324, 432` px
  - `ic_launcher_monochrome.png` (RGBA themed icon layer): `108, 162, 216, 324, 432` px
- **Adaptive XML Manifests**:
  - `res/mipmap-anydpi-v26/ic_launcher.xml`
  - `res/mipmap-anydpi-v26/ic_launcher_round.xml`
  - `res/values/ic_launcher_background.xml` (`#0B1F3B`)
- **Google Play Store Listing Icon**: `play-store-icon-512.png` (`512x512`, 24-bit opaque RGB PNG).

---

## 6. iOS (`assets/brand/icons/ios/`)

Conforms strictly to Apple Xcode `Assets.xcassets` and App Store Connect requirements (**every AppIcon PNG is verified 24-bit opaque RGB with zero alpha channel**):

- **App Icon Catalog (`Assets.xcassets/AppIcon.appiconset/`)**:
  - `Contents.json` referencing all required iPhone, iPad, Settings, Spotlight, Notification, and App Store Marketing (`1024x1024`) icon slots (`icon-20@2x.png` through `icon-1024.png`).
- **Launch Screen Assets**:
  - `Assets.xcassets/LaunchBackground.colorset/Contents.json` (light `#F5F8FF` / dark `#0B1F3B` adaptive color set).
  - `Assets.xcassets/LaunchLogo.imageset/` (`launch-logo@1x.png` 240px, `@2x` 480px, `@3x` 720px + `Contents.json`).
  - `LaunchScreen/launch-screen-dark-1290x2796.png` & `launch-screen-light-1290x2796.png` (opaque portrait splash references).

---

## 7. Automated Verification

Run `npm run verify:brand` to verify every file's existence, exact pixel dimensions, PNG color-type (alpha vs. opaque RGB), ICO/ICNS/BMP binary headers, SVG XML integrity, palette hex presence, and zero-version compliance.
