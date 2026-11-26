#!/usr/bin/env node
/**
 * SCRIBBLE-IT Automated Brand & Five-Platform Asset Verification Suite.
 *
 * Validates:
 * 1. SVG XML well-formedness & presence of official brand palette hex codes (#0B1F3B, #0A84FF, #22D3EE, #F5F8FF).
 * 2. Strict zero-version-number rule (no 2.0 / V2 / v2 / version badges) across all SVG & desktop/metadata assets.
 * 3. PNG exact dimensions, signatures, and alpha/opacity rules via PNG IHDR binary inspection:
 *    - Master dark/light/transparent/horizontal/compact/monochrome logo lockups & brand identity board.
 *    - Web app icons (1024x1024 RGBA, 512x512 RGBA, 192x192 RGBA), favicons (16/32/48), apple-touch-icon (180x180 opaque RGB).
 *    - iOS AppIcon.appiconset PNGs match Contents.json AND are strictly opaque (color-type 2, zero alpha channel).
 *    - Android res/mipmap-{mdpi..xxxhdpi} legacy square, round, adaptive foreground/background/monochrome + XMLs + Play Store 512x512.
 *    - Windows Tauri PNG resources, installer BMPs (valid 'BM' magic + exact sizes), and valid ICO header/frames.
 *    - macOS icon.iconset PNGs, DMG backgrounds (540x380 & 1080x760), and valid ICNS ('icns' magic + byte size + chunks).
 *    - Linux Freedesktop hicolor PNGs (16..512), scalable SVG, .desktop entry, AppImage/DEB/RPM icons, and AppStream metadata XML.
 * 4. Public web favicons synced into public/ and locally bundled SIL OFL 1.1 Inter & Manrope fonts + OFL.txt.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const BRAND_ROOT = path.join(ROOT, 'assets', 'brand');

const failures = [];
let checksPassed = 0;

function pass() {
  checksPassed += 1;
}

function fail(message) {
  failures.push(message);
}

function assertExists(relPath, base = ROOT) {
  const full = path.join(base, relPath);
  if (!fs.existsSync(full)) {
    fail(`Missing required asset: ${relPath}`);
    return null;
  }
  const stat = fs.statSync(full);
  if (stat.size === 0) {
    fail(`Asset is empty (0 bytes): ${relPath}`);
    return null;
  }
  pass();
  return full;
}

/**
 * Parses PNG IHDR chunk directly from raw bytes (zero external dependencies).
 * PNG color types:
 *   0 = Grayscale
 *   2 = RGB (opaque, NO alpha)
 *   3 = Indexed palette
 *   4 = Grayscale + Alpha
 *   6 = RGBA (alpha channel present)
 */
function inspectPng(fullPath, relLabel) {
  const buf = fs.readFileSync(fullPath);
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 33 || !buf.subarray(0, 8).equals(PNG_SIG)) {
    fail(`Invalid PNG signature: ${relLabel}`);
    return null;
  }
  const chunkType = buf.subarray(12, 16).toString('ascii');
  if (chunkType !== 'IHDR') {
    fail(`PNG missing IHDR header: ${relLabel}`);
    return null;
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf.readUInt8(24);
  const colorType = buf.readUInt8(25);
  return { width, height, bitDepth, colorType, hasAlpha: colorType === 4 || colorType === 6 };
}

function assertPng(relPath, expectedWidth, expectedHeight, { requireOpaque = false, requireAlpha = false } = {}) {
  const full = assertExists(relPath);
  if (!full) return;
  const info = inspectPng(full, relPath);
  if (!info) return;
  if (info.width !== expectedWidth || info.height !== expectedHeight) {
    fail(
      `PNG dimension mismatch for ${relPath}: expected ${expectedWidth}x${expectedHeight}, got ${info.width}x${info.height}`
    );
  } else {
    pass();
  }
  if (requireOpaque && info.hasAlpha) {
    fail(`PNG must be strictly opaque (no alpha channel) for ${relPath}, got colorType=${info.colorType}`);
  } else if (requireOpaque) {
    pass();
  }
  if (requireAlpha && !info.hasAlpha) {
    fail(`PNG must preserve RGBA alpha channel for ${relPath}, got colorType=${info.colorType}`);
  } else if (requireAlpha) {
    pass();
  }
}

function assertBmp(relPath, expectedWidth, expectedHeight) {
  const full = assertExists(relPath);
  if (!full) return;
  const buf = fs.readFileSync(full);
  if (buf.length < 26 || buf.subarray(0, 2).toString('ascii') !== 'BM') {
    fail(`Invalid BMP header (expected 'BM') for ${relPath}`);
    return;
  }
  const width = buf.readInt32LE(18);
  const height = Math.abs(buf.readInt32LE(22));
  if (width !== expectedWidth || height !== expectedHeight) {
    fail(`BMP dimension mismatch for ${relPath}: expected ${expectedWidth}x${expectedHeight}, got ${width}x${height}`);
  } else {
    pass();
  }
}

function assertIco(relPath, expectedMinFrames, expectedSizes) {
  const full = assertExists(relPath);
  if (!full) return;
  const buf = fs.readFileSync(full);
  if (buf.length < 22) {
    fail(`ICO file too small: ${relPath}`);
    return;
  }
  const reserved = buf.readUInt16LE(0);
  const type = buf.readUInt16LE(2);
  const count = buf.readUInt16LE(4);
  if (reserved !== 0 || type !== 1 || count < expectedMinFrames) {
    fail(`Invalid ICO header for ${relPath}: reserved=${reserved}, type=${type}, frames=${count}`);
    return;
  }
  const foundSizes = new Set();
  for (let i = 0; i < count; i++) {
    const entryOffset = 6 + i * 16;
    const w = buf.readUInt8(entryOffset) === 0 ? 256 : buf.readUInt8(entryOffset);
    const h = buf.readUInt8(entryOffset + 1) === 0 ? 256 : buf.readUInt8(entryOffset + 1);
    const size = buf.readUInt32LE(entryOffset + 8);
    const imgOffset = buf.readUInt32LE(entryOffset + 12);
    if (imgOffset + size > buf.length) {
      fail(`ICO frame ${i} out of bounds in ${relPath}`);
      return;
    }
    if (w === h) foundSizes.add(w);
  }
  for (const sz of expectedSizes) {
    if (!foundSizes.has(sz)) {
      fail(`ICO ${relPath} missing expected frame size ${sz}x${sz} (found: ${[...foundSizes].join(', ')})`);
    } else {
      pass();
    }
  }
}

function assertIcns(relPath, expectedOsTypes) {
  const full = assertExists(relPath);
  if (!full) return;
  const buf = fs.readFileSync(full);
  if (buf.length < 16 || buf.subarray(0, 4).toString('ascii') !== 'icns') {
    fail(`Invalid ICNS magic header for ${relPath}`);
    return;
  }
  const declaredLen = buf.readUInt32BE(4);
  if (declaredLen !== buf.length) {
    fail(`ICNS declared length ${declaredLen} != file size ${buf.length} for ${relPath}`);
    return;
  }
  const foundTypes = new Set();
  let offset = 8;
  while (offset + 8 <= buf.length) {
    const osType = buf.subarray(offset, offset + 4).toString('ascii');
    const chunkLen = buf.readUInt32BE(offset + 4);
    if (chunkLen < 8 || offset + chunkLen > buf.length) {
      fail(`Corrupt ICNS chunk '${osType}' at offset ${offset} in ${relPath}`);
      return;
    }
    foundTypes.add(osType);
    offset += chunkLen;
  }
  for (const t of expectedOsTypes) {
    if (!foundTypes.has(t)) {
      fail(`ICNS ${relPath} missing expected icon chunk '${t}' (found: ${[...foundTypes].join(', ')})`);
    } else {
      pass();
    }
  }
}

function collectFilesRecursive(dirPath) {
  const results = [];
  if (!fs.existsSync(dirPath)) return results;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFilesRecursive(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

function validateSvgFiles() {
  const allBrandFiles = collectFilesRecursive(BRAND_ROOT);
  const svgFiles = allBrandFiles.filter((f) => f.endsWith('.svg'));
  if (svgFiles.length < 20) {
    fail(`Expected at least 20 SVG brand assets, found ${svgFiles.length}`);
  } else {
    pass();
  }

  const FORBIDDEN_VERSION_REGEX = /\b(2\.0|v2(\.\d+)?|V2(\.\d+)?|release\s+\d)\b/i;

  for (const svgPath of svgFiles) {
    const rel = path.relative(ROOT, svgPath);
    const content = fs.readFileSync(svgPath, 'utf8');
    if (!content.includes('<svg') || !content.includes('</svg>') || !content.includes('xmlns="http://www.w3.org/2000/svg"')) {
      fail(`Malformed SVG XML in ${rel}`);
    } else {
      pass();
    }
    const textMatches = content.match(/<text[^>]*>[\s\S]*?<\/text>/gi) || [];
    for (const textBlock of textMatches) {
      if (FORBIDDEN_VERSION_REGEX.test(textBlock)) {
        fail(`STRICT BRAND VIOLATION: version number detected in SVG text inside ${rel}: ${textBlock}`);
      } else {
        pass();
      }
    }
    if (/SCRIBBLE-IT\s*2\.0|Scribble[\s-]IT\s*2\.0|SCRIBBLE-IT\s*V2/i.test(content)) {
      fail(`STRICT BRAND VIOLATION: versioned product name found in ${rel}`);
    } else {
      pass();
    }
  }

  const masterSvgPath = path.join(BRAND_ROOT, 'master', 'scribble-it-master.svg');
  if (fs.existsSync(masterSvgPath)) {
    const masterSvg = fs.readFileSync(masterSvgPath, 'utf8').toUpperCase();
    for (const hex of ['#0B1F3B', '#0A84FF', '#22D3EE', '#F5F8FF']) {
      if (!masterSvg.includes(hex)) {
        fail(`Master brand SVG missing official palette color ${hex}`);
      } else {
        pass();
      }
    }
  } else {
    fail('Missing master brand SVG: assets/brand/master/scribble-it-master.svg');
  }
}

function validateMasterAndWebAssets() {
  // Master SVGs
  assertExists('assets/brand/master/scribble-it-master.svg');
  assertExists('assets/brand/master/scribble-it-symbol.svg');
  assertExists('assets/brand/master/scribble-it-app-icon.svg');
  assertExists('assets/brand/master/scribble-it-app-icon-opaque.svg');

  // Dark / Light / Transparent / Horizontal / Compact / Monochrome lockups
  assertPng('assets/brand/logos/dark/scribble-it-logo-dark.png', 1200, 740);
  assertPng('assets/brand/logos/dark/scribble-it-horizontal-dark.png', 1600, 440);
  assertPng('assets/brand/logos/dark/scribble-it-compact-dark.png', 880, 260);

  assertPng('assets/brand/logos/light/scribble-it-logo-light.png', 1200, 740);
  assertPng('assets/brand/logos/light/scribble-it-horizontal-light.png', 1600, 440);
  assertPng('assets/brand/logos/light/scribble-it-compact-light.png', 880, 260);

  assertPng('assets/brand/logos/transparent/scribble-it-logo-transparent-light-text.png', 1200, 740, { requireAlpha: true });
  assertPng('assets/brand/logos/transparent/scribble-it-logo-transparent-dark-text.png', 1200, 740, { requireAlpha: true });
  assertPng('assets/brand/logos/transparent/scribble-it-horizontal-transparent-light-text.png', 1600, 440, { requireAlpha: true });
  assertPng('assets/brand/logos/transparent/scribble-it-horizontal-transparent-dark-text.png', 1600, 440, { requireAlpha: true });

  assertPng('assets/brand/logos/monochrome/scribble-it-logo-mono-dark.png', 1200, 740, { requireAlpha: true });
  assertPng('assets/brand/logos/monochrome/scribble-it-logo-mono-light.png', 1200, 740, { requireAlpha: true });
  assertPng('assets/brand/logos/monochrome/scribble-it-horizontal-mono-dark.png', 1600, 440, { requireAlpha: true });
  assertPng('assets/brand/logos/monochrome/scribble-it-horizontal-mono-light.png', 1600, 440, { requireAlpha: true });
  assertPng('assets/brand/logos/monochrome/scribble-it-symbol-mono-dark.png', 1024, 1024, { requireAlpha: true });
  assertPng('assets/brand/logos/monochrome/scribble-it-symbol-mono-light.png', 1024, 1024, { requireAlpha: true });

  // Web & PWA icons
  assertPng('assets/brand/icons/web/app-icon-1024.png', 1024, 1024, { requireAlpha: true });
  assertPng('assets/brand/icons/web/app-icon-512.png', 512, 512, { requireAlpha: true });
  assertPng('assets/brand/icons/web/icon-192.png', 192, 192, { requireAlpha: true });
  assertPng('assets/brand/icons/web/icon-512.png', 512, 512, { requireAlpha: true });
  assertPng('assets/brand/icons/web/favicon-16x16.png', 16, 16, { requireAlpha: true });
  assertPng('assets/brand/icons/web/favicon-32x32.png', 32, 32, { requireAlpha: true });
  assertPng('assets/brand/icons/web/favicon-48x48.png', 48, 48, { requireAlpha: true });
  assertPng('assets/brand/icons/web/apple-touch-icon.png', 180, 180, { requireOpaque: true });
  assertIco('assets/brand/icons/web/favicon.ico', 3, [16, 32, 48]);
  assertExists('assets/brand/icons/web/favicon.svg');

  // Public web copies synced into public/
  assertIco('public/favicon.ico', 3, [16, 32, 48]);
  assertExists('public/favicon.svg');
  assertPng('public/favicon-16x16.png', 16, 16, { requireAlpha: true });
  assertPng('public/favicon-32x32.png', 32, 32, { requireAlpha: true });
  assertPng('public/favicon-48x48.png', 48, 48, { requireAlpha: true });
  assertPng('public/apple-touch-icon.png', 180, 180, { requireOpaque: true });

  // Preview board
  assertExists('assets/brand/previews/brand-identity-board.svg');
  assertPng('assets/brand/previews/brand-identity-board.png', 1600, 1080);
}

function validateWindowsAssets() {
  assertIco('assets/brand/icons/windows/icon.ico', 7, [16, 24, 32, 48, 64, 128, 256]);
  for (const [file, size] of [
    ['icon.png', 512],
    ['32x32.png', 32],
    ['128x128.png', 128],
    ['128x128@2x.png', 256],
    ['Square30x30Logo.png', 30],
    ['Square44x44Logo.png', 44],
    ['Square71x71Logo.png', 71],
    ['Square89x89Logo.png', 89],
    ['Square107x107Logo.png', 107],
    ['Square142x142Logo.png', 142],
    ['Square150x150Logo.png', 150],
    ['Square284x284Logo.png', 284],
    ['Square310x310Logo.png', 310],
    ['StoreLogo.png', 50],
  ]) {
    assertPng(`assets/brand/icons/windows/${file}`, size, size);
  }
  assertBmp('assets/brand/icons/windows/installer/msi-banner.bmp', 493, 58);
  assertBmp('assets/brand/icons/windows/installer/msi-dialog.bmp', 493, 312);
  assertBmp('assets/brand/icons/windows/installer/nsis-header.bmp', 150, 57);
  assertBmp('assets/brand/icons/windows/installer/nsis-sidebar.bmp', 164, 314);
}

function validateMacosAssets() {
  assertIcns('assets/brand/icons/macos/icon.icns', ['icp4', 'icp5', 'icp6', 'ic07', 'ic08', 'ic09', 'ic10', 'ic11', 'ic12', 'ic13', 'ic14']);
  assertIcns('assets/brand/icons/macos/dmg/volume-icon.icns', ['icp4', 'icp5', 'icp6', 'ic07', 'ic08', 'ic09', 'ic10']);
  for (const [file, size] of [
    ['icon_16x16.png', 16],
    ['icon_16x16@2x.png', 32],
    ['icon_32x32.png', 32],
    ['icon_32x32@2x.png', 64],
    ['icon_128x128.png', 128],
    ['icon_128x128@2x.png', 256],
    ['icon_256x256.png', 256],
    ['icon_256x256@2x.png', 512],
    ['icon_512x512.png', 512],
    ['icon_512x512@2x.png', 1024],
  ]) {
    assertPng(`assets/brand/icons/macos/icon.iconset/${file}`, size, size);
  }
  assertPng('assets/brand/icons/macos/dmg/dmg-background.png', 540, 380);
  assertPng('assets/brand/icons/macos/dmg/dmg-background@2x.png', 1080, 760);
}

function validateLinuxAssets() {
  for (const size of [16, 24, 32, 48, 64, 128, 256, 512]) {
    assertPng(`assets/brand/icons/linux/hicolor/${size}x${size}/apps/scribble-it.png`, size, size);
  }
  assertExists('assets/brand/icons/linux/hicolor/scalable/apps/scribble-it.svg');
  assertPng('assets/brand/icons/linux/packaging/appimage-diricon.png', 256, 256);
  assertPng('assets/brand/icons/linux/packaging/deb-rpm-icon-512.png', 512, 512);
  const desktopFile = assertExists('assets/brand/icons/linux/scribble-it.desktop');
  if (desktopFile) {
    const content = fs.readFileSync(desktopFile, 'utf8');
    if (!content.includes('Name=SCRIBBLE-IT') || !content.includes('Icon=scribble-it')) {
      fail('Linux .desktop entry missing Name=SCRIBBLE-IT or Icon=scribble-it');
    } else if (/2\.0|V2/i.test(content)) {
      fail('Linux .desktop entry contains forbidden version number');
    } else {
      pass();
    }
  }
  const appstreamFile = assertExists('assets/brand/icons/linux/packaging/in.njuregroup.scribbleit.metainfo.xml');
  if (appstreamFile) {
    const xml = fs.readFileSync(appstreamFile, 'utf8');
    if (!xml.includes('<name>SCRIBBLE-IT</name>') || !xml.includes('AGPL-3.0-only')) {
      fail('Linux AppStream metainfo XML missing required metadata');
    } else {
      pass();
    }
  }
}

function validateAndroidAssets() {
  const densities = [
    ['mdpi', 48, 108],
    ['hdpi', 72, 162],
    ['xhdpi', 96, 216],
    ['xxhdpi', 144, 324],
    ['xxxhdpi', 192, 432],
  ];
  for (const [density, legacy, adaptive] of densities) {
    assertPng(`assets/brand/icons/android/res/mipmap-${density}/ic_launcher.png`, legacy, legacy);
    assertPng(`assets/brand/icons/android/res/mipmap-${density}/ic_launcher_round.png`, legacy, legacy);
    assertPng(`assets/brand/icons/android/res/mipmap-${density}/ic_launcher_foreground.png`, adaptive, adaptive, { requireAlpha: true });
    assertPng(`assets/brand/icons/android/res/mipmap-${density}/ic_launcher_background.png`, adaptive, adaptive, { requireOpaque: true });
    assertPng(`assets/brand/icons/android/res/mipmap-${density}/ic_launcher_monochrome.png`, adaptive, adaptive, { requireAlpha: true });
  }
  assertExists('assets/brand/icons/android/res/mipmap-anydpi-v26/ic_launcher.xml');
  assertExists('assets/brand/icons/android/res/mipmap-anydpi-v26/ic_launcher_round.xml');
  assertExists('assets/brand/icons/android/res/values/ic_launcher_background.xml');
  assertPng('assets/brand/icons/android/play-store-icon-512.png', 512, 512, { requireOpaque: true });
}

function validateIosAssets() {
  const appIconContentsPath = assertExists('assets/brand/icons/ios/Assets.xcassets/AppIcon.appiconset/Contents.json');
  if (appIconContentsPath) {
    const catalog = JSON.parse(fs.readFileSync(appIconContentsPath, 'utf8'));
    if (!Array.isArray(catalog.images) || catalog.images.length < 15) {
      fail('iOS AppIcon.appiconset/Contents.json has insufficient icon definitions');
    } else {
      pass();
      for (const entry of catalog.images) {
        const [wPts] = entry.size.split('x').map(Number);
        const scale = Number(entry.scale.replace('x', ''));
        const expectedPx = Math.round(wPts * scale);
        // Apple requires ALL iOS AppIcon PNGs to have NO alpha channel (strictly opaque)
        assertPng(
          `assets/brand/icons/ios/Assets.xcassets/AppIcon.appiconset/${entry.filename}`,
          expectedPx,
          expectedPx,
          { requireOpaque: true }
        );
      }
    }
  }
  assertExists('assets/brand/icons/ios/Assets.xcassets/Contents.json');
  assertExists('assets/brand/icons/ios/Assets.xcassets/LaunchBackground.colorset/Contents.json');
  assertExists('assets/brand/icons/ios/Assets.xcassets/LaunchLogo.imageset/Contents.json');
  assertPng('assets/brand/icons/ios/Assets.xcassets/LaunchLogo.imageset/launch-logo@1x.png', 240, 240, { requireAlpha: true });
  assertPng('assets/brand/icons/ios/Assets.xcassets/LaunchLogo.imageset/launch-logo@2x.png', 480, 480, { requireAlpha: true });
  assertPng('assets/brand/icons/ios/Assets.xcassets/LaunchLogo.imageset/launch-logo@3x.png', 720, 720, { requireAlpha: true });
  assertPng('assets/brand/icons/ios/LaunchScreen/launch-screen-dark-1290x2796.png', 1290, 2796, { requireOpaque: true });
  assertPng('assets/brand/icons/ios/LaunchScreen/launch-screen-light-1290x2796.png', 1290, 2796, { requireOpaque: true });
}

function validateFonts() {
  assertExists('assets/brand/fonts/fonts.css');
  assertExists('assets/brand/fonts/LICENSING.md');
  assertExists('assets/brand/fonts/Inter/OFL.txt');
  assertExists('assets/brand/fonts/Inter/Inter-Variable.ttf');
  assertExists('assets/brand/fonts/Inter/Inter-Regular.ttf');
  assertExists('assets/brand/fonts/Inter/Inter-Medium.ttf');
  assertExists('assets/brand/fonts/Inter/Inter-SemiBold.ttf');
  assertExists('assets/brand/fonts/Inter/Inter-Bold.ttf');
  assertExists('assets/brand/fonts/Inter/inter-latin-400-normal.woff2');
  assertExists('assets/brand/fonts/Inter/inter-latin-600-normal.woff2');
  assertExists('assets/brand/fonts/Inter/inter-latin-700-normal.woff2');
  assertExists('assets/brand/fonts/Manrope/OFL.txt');
  assertExists('assets/brand/fonts/Manrope/Manrope-Variable.ttf');
  assertExists('assets/brand/fonts/Manrope/Manrope-SemiBold.ttf');
  assertExists('assets/brand/fonts/Manrope/Manrope-Bold.ttf');
  assertExists('assets/brand/fonts/Manrope/Manrope-ExtraBold.ttf');
  assertExists('assets/brand/fonts/Manrope/manrope-latin-600-normal.woff2');
  assertExists('assets/brand/fonts/Manrope/manrope-latin-700-normal.woff2');
  assertExists('assets/brand/fonts/Manrope/manrope-latin-800-normal.woff2');
}

function main() {
  console.log('Running SCRIBBLE-IT Brand & Five-Platform Asset Verification...');
  validateSvgFiles();
  validateMasterAndWebAssets();
  validateWindowsAssets();
  validateMacosAssets();
  validateLinuxAssets();
  validateAndroidAssets();
  validateIosAssets();
  validateFonts();

  if (failures.length > 0) {
    console.error(`\n[FAILED] ${failures.length} verification error(s) (${checksPassed} checks passed):`);
    for (const msg of failures) {
      console.error(`  - ${msg}`);
    }
    process.exit(1);
  }

  console.log(`[PASS] All ${checksPassed} brand, typography, binary header, dimension, alpha, and zero-version checks passed!`);
}

main();
