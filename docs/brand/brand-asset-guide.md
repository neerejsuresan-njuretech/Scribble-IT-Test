# SCRIBBLE-IT Official Brand Identity & Asset Guide

## 1. Official Project Identity

| Attribute | Official Value |
| :--- | :--- |
| **Official Product Name** | `SCRIBBLE-IT` |
| **Logo Wordmark** | `Scribble IT` |
| **Product Attribution** | `A Njure Tech product.` |
| **Tagline** | `Enterprise IT Management. Open to Everyone.` |
| **Organization** | `Njure Tech (formally Njure Group)` |
| **Developer** | `NEEREJ S SURESAN` |
| **Designation** | `Founder & CEO — Njure Tech (formally Njure Group).` |
| **Official Product Website** | `https://scribbleit.njuregroup.in` |
| **Organization Website** | `https://tech.njuregroup.in` |
| **Former Group Website** | `https://njuregroup.in` |

---

## 2. Strict Zero-Version Visual Branding Rule

Visual brand assets **MUST NEVER** contain version numbers, release tags, or badges (`2.0`, `V2`, `v2`, `Beta`, release numbers). This rule applies unconditionally across:

- Master and variant logos (dark, light, transparent, horizontal, compact, monochrome)
- Standalone symbols and wordmarks
- Web favicons and Apple touch icons
- Windows, macOS, Linux, Android, and iOS application icons
- Splash screens, launch screens, installer banners, DMG backgrounds, and brand previews
- In-app and public-facing product branding

Software package versions and release tags remain strictly separate in `package.json`, git tags, and API metadata.

---

## 3. Core Visual Concept

The SCRIBBLE-IT mark combines three unified visual elements:
1. **Enterprise Document Outline**: A crisp rounded page silhouette with a folded top-right corner representing structured IT service records, runbooks, and governance.
2. **Integrated Geometric "S" & Diagonal Pencil**: A bold stylized `S` sweeping directly into an angled precision pencil nib with a subtle cyan baseline scribble flourish.
3. **Typography Lockup**: Clean geometric `Scribble IT` wordmark (`Manrope` 700/800) paired with `A Njure Tech product.` (`Inter` 500).

---

## 4. Official Brand Color Palette

| Token | Name | Hex | Role |
| :--- | :--- | :--- | :--- |
| `deepNavy` | Deep Navy | `#0B1F3B` | Primary dark surface, app icon container, light-mode wordmark |
| `njureBlue` | Njure Blue | `#0A84FF` | Primary interactive brand accent, "IT" accent on light backgrounds |
| `accentCyan` | Accent Cyan | `#22D3EE` | Secondary luminous highlight, pencil & gradient accent, "IT" accent on dark backgrounds |
| `surface` | Surface | `#F5F8FF` | Primary light background canvas and dark-mode contrast foreground |

All colors are exported programmatically in `@scribble-it/design-tokens` (`BRAND_COLORS`, `DARK_THEME`, `LIGHT_THEME`, and `packages/design-tokens/css/tokens.css`).

---

## 5. Typography & Local Font Licensing

SCRIBBLE-IT bundles open-source **SIL Open Font License 1.1** fonts locally under `assets/brand/fonts/` for deterministic offline rendering across Web, Desktop, Mobile, and SVG asset generation:

- **Display / Wordmark**: **Manrope** (`Manrope-Variable.ttf`, static `SemiBold` 600, `Bold` 700, `ExtraBold` 800, plus `woff2`)
- **UI / Body**: **Inter** (`Inter-Variable.ttf`, static `Regular` 400, `Medium` 500, `SemiBold` 600, `Bold` 700, plus `woff2`)
- **Licenses**: Full verbatim `OFL.txt` files are included in `assets/brand/fonts/Inter/OFL.txt` and `assets/brand/fonts/Manrope/OFL.txt`, summarized in `assets/brand/fonts/LICENSING.md`.

---

## 6. Asset Directory Index

| Directory | Contents |
| :--- | :--- |
| `assets/brand/master/` | Editable master SVGs (`scribble-it-master.svg`, `scribble-it-symbol.svg`, `scribble-it-app-icon.svg`, `scribble-it-app-icon-opaque.svg`) |
| `assets/brand/logos/dark/` | Stacked, horizontal, and compact dark-theme logos (SVG + PNG) |
| `assets/brand/logos/light/` | Stacked, horizontal, and compact light-theme logos (SVG + PNG) |
| `assets/brand/logos/transparent/` | Transparent-background logos for dark and light surfaces (SVG + PNG) |
| `assets/brand/logos/monochrome/` | Single-color Deep Navy (`#0B1F3B`) and Surface (`#F5F8FF`) logos and symbols |
| `assets/brand/previews/` | Brand identity board (`brand-identity-board.svg` and `.png`) |
| `assets/brand/icons/web/` | 1024px & 512px PNG app icons, 192/512 PWA icons, `favicon.ico`, `favicon.svg`, 16/32/48 PNG favicons, 180px opaque `apple-touch-icon.png` |
| `assets/brand/icons/{windows,macos,linux,android,ios}/` | Five-platform native packaging assets (see `docs/brand/platform-icon-specifications.md`) |
| `public/` | Web favicons and `apple-touch-icon.png` synced for root web app & GitHub Pages |

---

## 7. Regenerating & Validating Assets

```bash
# Regenerate every SVG, PNG, ICO, ICNS, BMP, XML, and xcassets bundle deterministically
node scripts/generate-brand-assets.mjs

# Run automated verification (XML, zero-version check, PNG dimensions, alpha/opacity, ICO/ICNS/BMP binary headers)
npm run verify:brand
```
