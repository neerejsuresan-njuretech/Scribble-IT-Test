#!/usr/bin/env node
/**
 * SCRIBBLE-IT Official Brand Asset & Five-Platform Icon Generator.
 *
 * Strictly enforces the SCRIBBLE-IT visual brand identity:
 * - Official product name: SCRIBBLE-IT (wordmark: Scribble IT)
 * - Supporting attribution: A Njure Tech product.
 * - Palette: Deep Navy #0B1F3B, Njure Blue #0A84FF, Accent Cyan #22D3EE, Surface #F5F8FF
 * - Zero version numbers anywhere in visual assets.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const BRAND_ROOT = path.join(ROOT, 'assets', 'brand');
const PUBLIC_ROOT = path.join(ROOT, 'public');

const COLORS = {
  deepNavy: '#0B1F3B',
  deepNavyDark: '#071426',
  deepNavyMid: '#112B52',
  njureBlue: '#0A84FF',
  njureBlueDeep: '#005FCC',
  accentCyan: '#22D3EE',
  surface: '#F5F8FF',
  white: '#FFFFFF',
  mutedDark: '#94B2D8',
  mutedLight: '#476285',
};

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

/**
 * Collect all locally bundled TTF/OTF font files inside assets/brand/fonts/
 * so @resvg/resvg-js renders typography deterministically offline.
 */
function collectLocalFontFiles() {
  const fontsRoot = path.join(BRAND_ROOT, 'fonts');
  const fontFiles = [];
  if (!fs.existsSync(fontsRoot)) return fontFiles;
  for (const familyDir of fs.readdirSync(fontsRoot)) {
    const fullDir = path.join(fontsRoot, familyDir);
    if (!fs.statSync(fullDir).isDirectory()) continue;
    for (const file of fs.readdirSync(fullDir)) {
      if ((file.endsWith('.ttf') || file.endsWith('.otf')) && !file.includes('Variable')) {
        fontFiles.push(path.join(fullDir, file));
      }
    }
  }
  return fontFiles;
}

const LOCAL_FONT_FILES = collectLocalFontFiles();

/**
 * Rasterizes an SVG file into an exact-dimension PNG via @resvg/resvg-js.
 * Preserves RGBA transparency by default, or flattens to strict 24-bit opaque RGB
 * (PNG color-type 2, zero alpha channel) when opaqueBg is supplied (e.g., iOS App Icons).
 */
function renderSvgToPng(svgPath, pngPath, width, height, { opaqueBg = null } = {}) {
  ensureDir(path.dirname(pngPath));
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  const resvg = new Resvg(svgContent, {
    fitTo: {
      mode: 'width',
      value: width,
    },
    ...(opaqueBg ? { background: opaqueBg } : {}),
    font: {
      fontFiles: LOCAL_FONT_FILES,
      loadSystemFonts: true,
      defaultFontFamily: 'Inter',
    },
  });
  const rendered = resvg.render();
  const pngBuffer = rendered.asPng();

  // If dimensions match exactly and transparency is desired, write directly
  if (!opaqueBg && rendered.width === width && rendered.height === height) {
    fs.writeFileSync(pngPath, pngBuffer);
    return;
  }

  // Write intermediate PNG, then normalize exact dimensions & color type via ImageMagick
  const tmpPng = `${pngPath}.tmp.png`;
  fs.writeFileSync(tmpPng, pngBuffer);
  try {
    const args = [tmpPng];
    if (rendered.width !== width || rendered.height !== height) {
      args.push('-resize', `${width}x${height}!`);
    }
    if (opaqueBg) {
      args.push('-background', opaqueBg, '-alpha', 'remove', '-alpha', 'off', `PNG24:${pngPath}`);
    } else {
      args.push('-define', 'png:color-type=6', `PNG32:${pngPath}`);
    }
    execFileSync('convert', args, { stdio: 'pipe' });
  } finally {
    if (fs.existsSync(tmpPng)) fs.unlinkSync(tmpPng);
  }
}

function renderPngToBmp(pngPath, bmpPath) {
  ensureDir(path.dirname(bmpPath));
  execFileSync('convert', [pngPath, '-alpha', 'off', `BMP3:${bmpPath}`], {
    stdio: 'pipe',
  });
}

/**
 * Core SCRIBBLE-IT Symbol vector markup inside a 1024x1024 coordinate space:
 * - Precision rounded enterprise document outline with folded top-right corner
 * - Stylized geometric "S" sweeping seamlessly into a precision diagonal pencil
 * - Subtle cyan/blue scribble baseline flourish
 *
 * Variants:
 * - 'color-dark'   : luminous blue/cyan symbol designed for dark (#0B1F3B) surfaces
 * - 'color-light'  : high-contrast deep navy + blue/cyan symbol for light (#F5F8FF) surfaces
 * - 'mono-dark'    : pure single-color #0B1F3B monochrome
 * - 'mono-light'   : pure single-color #F5F8FF monochrome
 */
function buildSymbolInnerSvg(variant = 'color-dark', idPrefix = 'sym') {
  const isMonoDark = variant === 'mono-dark';
  const isMonoLight = variant === 'mono-light';
  const isLightSurface = variant === 'color-light';

  const defs =
    isMonoDark || isMonoLight
      ? ''
      : `
    <linearGradient id="${idPrefix}-doc-stroke" x1="210" y1="128" x2="814" y2="896" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${isLightSurface ? COLORS.deepNavy : COLORS.accentCyan}" />
      <stop offset="48%" stop-color="${COLORS.njureBlue}" />
      <stop offset="100%" stop-color="${isLightSurface ? COLORS.njureBlueDeep : '#38BDF8'}" />
    </linearGradient>
    <linearGradient id="${idPrefix}-s-grad" x1="330" y1="300" x2="690" y2="755" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${COLORS.accentCyan}" />
      <stop offset="55%" stop-color="${COLORS.njureBlue}" />
      <stop offset="100%" stop-color="${isLightSurface ? COLORS.deepNavy : '#60B5FF'}" />
    </linearGradient>
    <linearGradient id="${idPrefix}-pencil-body" x1="590" y1="260" x2="770" y2="560" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${COLORS.accentCyan}" />
      <stop offset="100%" stop-color="${COLORS.njureBlue}" />
    </linearGradient>
    <linearGradient id="${idPrefix}-doc-fill" x1="216" y1="132" x2="808" y2="892" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${isLightSurface ? COLORS.surface : '#14335E'}" stop-opacity="${isLightSurface ? '0.96' : '0.68'}" />
      <stop offset="100%" stop-color="${isLightSurface ? '#E6F0FF' : '#0B1F3B'}" stop-opacity="${isLightSurface ? '0.92' : '0.88'}" />
    </linearGradient>`;

  const docStroke = isMonoDark
    ? COLORS.deepNavy
    : isMonoLight
      ? COLORS.surface
      : `url(#${idPrefix}-doc-stroke)`;
  const docFill = isMonoDark || isMonoLight ? 'none' : `url(#${idPrefix}-doc-fill)`;
  const sStroke = isMonoDark
    ? COLORS.deepNavy
    : isMonoLight
      ? COLORS.surface
      : `url(#${idPrefix}-s-grad)`;
  const pencilFill = isMonoDark
    ? COLORS.deepNavy
    : isMonoLight
      ? COLORS.surface
      : `url(#${idPrefix}-pencil-body)`;
  const ferruleFill = isMonoDark
    ? COLORS.deepNavy
    : isMonoLight
      ? COLORS.surface
      : isLightSurface
        ? COLORS.deepNavy
        : COLORS.surface;
  const accentLine = isMonoDark
    ? COLORS.deepNavy
    : isMonoLight
      ? COLORS.surface
      : COLORS.accentCyan;
  const foldFill = isMonoDark
    ? COLORS.deepNavy
    : isMonoLight
      ? COLORS.surface
      : isLightSurface
        ? '#D9ECFF'
        : '#183C6E';

  return {
    defs,
    body: `
    <g id="${idPrefix}-layer-document">
      <!-- Enterprise Document / Page Outline with Folded Top-Right Corner -->
      <path
        d="M 284 140
           H 606
           L 796 330
           V 816
           A 68 68 0 0 1 728 884
           H 284
           A 68 68 0 0 1 216 816
           V 208
           A 68 68 0 0 1 284 140 Z"
        fill="${docFill}"
        stroke="${docStroke}"
        stroke-width="42"
        stroke-linejoin="round"
      />
      <!-- Crisp Folded Corner Crease -->
      <path
        d="M 606 140 V 286 A 44 44 0 0 0 650 330 H 796"
        fill="${isMonoDark || isMonoLight ? 'none' : foldFill}"
        fill-opacity="${isMonoDark || isMonoLight ? '0' : '0.45'}"
        stroke="${docStroke}"
        stroke-width="38"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <!-- Minimal Document Reference Lines (top-left) -->
      <line x1="304" y1="248" x2="496" y2="248" stroke="${docStroke}" stroke-width="26" stroke-linecap="round" opacity="${isMonoDark || isMonoLight ? '0.85' : '0.55'}" />
      <line x1="304" y1="308" x2="432" y2="308" stroke="${docStroke}" stroke-width="22" stroke-linecap="round" opacity="${isMonoDark || isMonoLight ? '0.65' : '0.4'}" />
    </g>

    <g id="${idPrefix}-layer-s-pencil">
      <!-- Stylized Geometric 'S' Monogram Sweeping Through the Document -->
      <path
        d="M 594 416
           C 562 366, 488 352, 424 374
           C 356 398, 338 468, 384 514
           C 424 554, 520 554, 570 594
           C 626 640, 610 730, 534 762
           C 462 792, 376 774, 336 724"
        fill="none"
        stroke="${sStroke}"
        stroke-width="64"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- Integrated Precision Diagonal Pencil Writing Into the S Curve -->
      <g transform="translate(650 470) rotate(38)">
        <!-- Pencil Eraser Cap -->
        <rect x="-32" y="-176" width="64" height="44" rx="18" fill="${accentLine}" />
        <!-- Metallic Ferrule Band -->
        <rect x="-32" y="-124" width="64" height="24" rx="6" fill="${ferruleFill}" />
        <!-- Pencil Shaft Body -->
        <rect x="-32" y="-92" width="64" height="196" rx="10" fill="${pencilFill}" />
        <!-- Facet Highlight Along Shaft -->
        <rect x="-10" y="-86" width="16" height="184" rx="6" fill="${isMonoDark ? COLORS.surface : COLORS.white}" opacity="${isMonoDark || isMonoLight ? '0.28' : '0.26'}" />
        <!-- Tapered Wooden/Metallic Tip Cone -->
        <polygon points="-32,110 32,110 0,188" fill="${ferruleFill}" />
        <!-- Precision Graphite/Cyan Nib -->
        <polygon points="-13,156 13,156 0,188" fill="${accentLine}" />
      </g>

      <!-- Precision Ink/Scribble Baseline Stroke -->
      <path
        d="M 526 776 C 584 776, 636 764, 694 742"
        fill="none"
        stroke="${accentLine}"
        stroke-width="28"
        stroke-linecap="round"
      />
    </g>`,
  };
}

/**
 * Standalone App Symbol SVG (transparent canvas, no rounded tile background).
 */
function createStandaloneSymbolSvg(variant = 'color-dark') {
  const sym = buildSymbolInnerSvg(variant, `standalone-${variant}`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" role="img" aria-label="SCRIBBLE-IT Symbol">
  <title>SCRIBBLE-IT Symbol</title>
  <defs>${sym.defs}
  </defs>
  ${sym.body}
</svg>
`;
}

/**
 * Full App Icon SVG (rounded enterprise badge on transparent background, OR full-bleed opaque square for iOS/Android background).
 */
function createAppIconSvg({ fullBleed = false, roundedRadius = 224, safeScale = 0.78 } = {}) {
  const sym = buildSymbolInnerSvg('color-dark', fullBleed ? 'ios-icon' : 'app-icon');
  const offset = (1024 * (1 - safeScale)) / 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" role="img" aria-label="SCRIBBLE-IT Application Icon">
  <title>SCRIBBLE-IT Application Icon</title>
  <defs>
    <linearGradient id="tile-bg" x1="96" y1="64" x2="928" y2="960" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#132D56" />
      <stop offset="45%" stop-color="${COLORS.deepNavy}" />
      <stop offset="100%" stop-color="${COLORS.deepNavyDark}" />
    </linearGradient>
    <radialGradient id="tile-glow" cx="76%" cy="22%" r="60%">
      <stop offset="0%" stop-color="${COLORS.accentCyan}" stop-opacity="0.22" />
      <stop offset="48%" stop-color="${COLORS.njureBlue}" stop-opacity="0.10" />
      <stop offset="100%" stop-color="${COLORS.deepNavy}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="tile-rim" x1="128" y1="96" x2="896" y2="928" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${COLORS.accentCyan}" stop-opacity="0.55" />
      <stop offset="50%" stop-color="${COLORS.njureBlue}" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.08" />
    </linearGradient>
    ${sym.defs}
  </defs>
  ${
    fullBleed
      ? `<rect x="0" y="0" width="1024" height="1024" fill="url(#tile-bg)" />
         <rect x="0" y="0" width="1024" height="1024" fill="url(#tile-glow)" />`
      : `<rect x="24" y="24" width="976" height="976" rx="${roundedRadius}" fill="url(#tile-bg)" />
         <rect x="24" y="24" width="976" height="976" rx="${roundedRadius}" fill="url(#tile-glow)" />
         <rect x="30" y="30" width="964" height="964" rx="${roundedRadius - 6}" fill="none" stroke="url(#tile-rim)" stroke-width="12" />`
  }
  <g transform="translate(${offset.toFixed(1)} ${offset.toFixed(1)}) scale(${safeScale})">
    ${sym.body}
  </g>
</svg>
`;
}

/**
 * Android Adaptive Icon Foreground / Background / Monochrome layers (1024x1024 -> scaled to 108dp densities).
 * Symbol stays strictly inside the central 61% safe zone (66dp / 108dp).
 */
function createAndroidAdaptiveBackgroundSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="and-bg" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#132D56" />
      <stop offset="50%" stop-color="${COLORS.deepNavy}" />
      <stop offset="100%" stop-color="${COLORS.deepNavyDark}" />
    </linearGradient>
    <radialGradient id="and-glow" cx="72%" cy="24%" r="58%">
      <stop offset="0%" stop-color="${COLORS.accentCyan}" stop-opacity="0.22" />
      <stop offset="55%" stop-color="${COLORS.njureBlue}" stop-opacity="0.10" />
      <stop offset="100%" stop-color="${COLORS.deepNavy}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="1024" height="1024" fill="url(#and-bg)" />
  <rect x="0" y="0" width="1024" height="1024" fill="url(#and-glow)" />
</svg>
`;
}

function createAndroidAdaptiveForegroundSvg(monochrome = false) {
  const sym = buildSymbolInnerSvg(monochrome ? 'mono-light' : 'color-dark', monochrome ? 'and-mono' : 'and-fg');
  // 58% scale keeps entire symbol well inside Android's 66/108 (61.1%) circular safe zone
  const safeScale = 0.58;
  const offset = (1024 * (1 - safeScale)) / 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>${sym.defs}
  </defs>
  <g transform="translate(${offset.toFixed(1)} ${offset.toFixed(1)}) scale(${safeScale})">
    ${sym.body}
  </g>
</svg>
`;
}

/**
 * Primary Brand Logo Lockups (Master Editable, Dark, Light, Transparent, Horizontal, Compact, Monochrome).
 */
function createLogoLockupSvg({
  layout = 'primary', // 'primary' | 'horizontal' | 'compact'
  theme = 'dark', // 'dark' | 'light' | 'transparent-dark-text' | 'transparent-light-text' | 'mono-dark' | 'mono-light'
  width,
  height,
}) {
  const isDarkBg = theme === 'dark';
  const isLightBg = theme === 'light';
  const isLightText = theme === 'dark' || theme === 'transparent-light-text' || theme === 'mono-light';
  const isMonoDark = theme === 'mono-dark';
  const isMonoLight = theme === 'mono-light';

  const symbolVariant = isMonoDark
    ? 'mono-dark'
    : isMonoLight
      ? 'mono-light'
      : isLightText
        ? 'color-dark'
        : 'color-light';

  const sym = buildSymbolInnerSvg(symbolVariant, `logo-${layout}-${theme}`);

  const wordPrimaryColor = isMonoDark
    ? COLORS.deepNavy
    : isMonoLight
      ? COLORS.surface
      : isLightText
        ? COLORS.surface
        : COLORS.deepNavy;

  const wordAccentColor = isMonoDark
    ? COLORS.deepNavy
    : isMonoLight
      ? COLORS.surface
      : isLightText
        ? COLORS.accentCyan
        : COLORS.njureBlue;

  const subColor = isMonoDark
    ? COLORS.deepNavy
    : isMonoLight
      ? COLORS.surface
      : isLightText
        ? COLORS.mutedDark
        : COLORS.mutedLight;

  const bgRect = isDarkBg
    ? `<g id="layer-background"><rect x="0" y="0" width="${width}" height="${height}" rx="28" fill="${COLORS.deepNavy}" /></g>`
    : isLightBg
      ? `<g id="layer-background"><rect x="0" y="0" width="${width}" height="${height}" rx="28" fill="${COLORS.surface}" /></g>`
      : '';

  if (layout === 'compact') {
    const symScale = 0.21;
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="SCRIBBLE-IT Compact Logo">
  <title>SCRIBBLE-IT Compact Logo</title>
  <defs>${sym.defs}
  </defs>
  ${bgRect}
  <g id="layer-symbol" transform="translate(40 22) scale(${symScale})">
    ${sym.body}
  </g>
  <g id="layer-wordmark">
    <text x="292" y="158" font-family="Manrope, Inter, sans-serif" font-size="86" font-weight="800" letter-spacing="-2.2" fill="${wordPrimaryColor}">Scribble <tspan fill="${wordAccentColor}">IT</tspan></text>
  </g>
</svg>
`;
  }

  if (layout === 'horizontal') {
    const symScale = 0.34;
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="SCRIBBLE-IT Horizontal Wordmark">
  <title>SCRIBBLE-IT Horizontal Wordmark</title>
  <defs>${sym.defs}
  </defs>
  ${bgRect}
  <g id="layer-symbol" transform="translate(64 46) scale(${symScale})">
    ${sym.body}
  </g>
  <g id="layer-wordmark">
    <text x="454" y="236" font-family="Manrope, Inter, sans-serif" font-size="132" font-weight="800" letter-spacing="-3.4" fill="${wordPrimaryColor}">Scribble <tspan fill="${wordAccentColor}">IT</tspan></text>
  </g>
  <g id="layer-attribution">
    <text x="460" y="306" font-family="Inter, Manrope, sans-serif" font-size="38" font-weight="500" letter-spacing="0.4" fill="${subColor}" opacity="${isMonoDark || isMonoLight ? '0.82' : '1'}">A Njure Tech product.</text>
  </g>
</svg>
`;
  }

  // Primary stacked / master logo
  const symScale = 0.42;
  const symX = (width - 1024 * symScale) / 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="SCRIBBLE-IT Primary Logo">
  <title>SCRIBBLE-IT Primary Logo</title>
  <defs>${sym.defs}
  </defs>
  ${bgRect}
  <g id="layer-symbol" transform="translate(${symX.toFixed(1)} 56) scale(${symScale})">
    ${sym.body}
  </g>
  <g id="layer-wordmark">
    <text x="${width / 2}" y="612" text-anchor="middle" font-family="Manrope, Inter, sans-serif" font-size="122" font-weight="800" letter-spacing="-3.2" fill="${wordPrimaryColor}">Scribble <tspan fill="${wordAccentColor}">IT</tspan></text>
  </g>
  <g id="layer-attribution">
    <text x="${width / 2}" y="676" text-anchor="middle" font-family="Inter, Manrope, sans-serif" font-size="36" font-weight="500" letter-spacing="0.6" fill="${subColor}" opacity="${isMonoDark || isMonoLight ? '0.82' : '1'}">A Njure Tech product.</text>
  </g>
</svg>
`;
}

/**
 * Creates installer & DMG branding graphics (Windows MSI/NSIS, macOS DMG, iOS Launch Screens).
 */
function createWindowsBannerSvg(width, height, variant = 'msi-banner') {
  const sym = buildSymbolInnerSvg('color-dark', `win-${variant}`);
  if (variant === 'msi-banner') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>${sym.defs}</defs>
  <rect width="${width}" height="${height}" fill="${COLORS.deepNavy}" />
  <rect x="0" y="${height - 3}" width="${width}" height="3" fill="${COLORS.njureBlue}" />
  <g transform="translate(${width - 54} 5) scale(0.046)">${sym.body}</g>
  <text x="18" y="34" font-family="Manrope, Inter, sans-serif" font-size="20" font-weight="800" fill="${COLORS.surface}">Scribble <tspan fill="${COLORS.accentCyan}">IT</tspan></text>
  <text x="18" y="49" font-family="Inter, sans-serif" font-size="10" font-weight="500" fill="${COLORS.mutedDark}">A Njure Tech product.</text>
</svg>`;
  }
  if (variant === 'msi-dialog') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>${sym.defs}</defs>
  <rect width="${width}" height="${height}" fill="${COLORS.surface}" />
  <rect width="164" height="${height}" fill="${COLORS.deepNavy}" />
  <rect x="162" y="0" width="2" height="${height}" fill="${COLORS.njureBlue}" />
  <g transform="translate(26 42) scale(0.11)">${sym.body}</g>
  <text x="82" y="182" text-anchor="middle" font-family="Manrope, Inter, sans-serif" font-size="20" font-weight="800" fill="${COLORS.surface}">Scribble <tspan fill="${COLORS.accentCyan}">IT</tspan></text>
  <text x="82" y="204" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" font-weight="500" fill="${COLORS.mutedDark}">A Njure Tech product.</text>
  <text x="82" y="284" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" font-weight="500" fill="${COLORS.mutedDark}">Enterprise IT Management</text>
</svg>`;
  }
  if (variant === 'nsis-header') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>${sym.defs}</defs>
  <rect width="${width}" height="${height}" fill="${COLORS.deepNavy}" />
  <g transform="translate(8 6) scale(0.044)">${sym.body}</g>
  <text x="56" y="34" font-family="Manrope, Inter, sans-serif" font-size="15" font-weight="800" fill="${COLORS.surface}">Scribble <tspan fill="${COLORS.accentCyan}">IT</tspan></text>
</svg>`;
  }
  // nsis-sidebar (164x314)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>${sym.defs}</defs>
  <rect width="${width}" height="${height}" fill="${COLORS.deepNavy}" />
  <rect x="0" y="0" width="${width}" height="4" fill="${COLORS.accentCyan}" />
  <g transform="translate(26 46) scale(0.11)">${sym.body}</g>
  <text x="82" y="188" text-anchor="middle" font-family="Manrope, Inter, sans-serif" font-size="20" font-weight="800" fill="${COLORS.surface}">Scribble <tspan fill="${COLORS.accentCyan}">IT</tspan></text>
  <text x="82" y="210" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" font-weight="500" fill="${COLORS.mutedDark}">A Njure Tech product.</text>
  <text x="82" y="286" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" font-weight="500" fill="${COLORS.mutedDark}">Open to Everyone.</text>
</svg>`;
}

function createMacOsDmgBackgroundSvg(width, height) {
  const sym = buildSymbolInnerSvg('color-dark', 'dmg-sym');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="dmg-bg" x1="0" y1="0" x2="${width}" y2="${height}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#112A4F" />
      <stop offset="55%" stop-color="${COLORS.deepNavy}" />
      <stop offset="100%" stop-color="${COLORS.deepNavyDark}" />
    </linearGradient>
    ${sym.defs}
  </defs>
  <rect width="${width}" height="${height}" fill="url(#dmg-bg)" />
  <g transform="translate(36 28) scale(0.056)">${sym.body}</g>
  <text x="108" y="64" font-family="Manrope, Inter, sans-serif" font-size="26" font-weight="800" fill="${COLORS.surface}">Scribble <tspan fill="${COLORS.accentCyan}">IT</tspan></text>
  <text x="108" y="84" font-family="Inter, sans-serif" font-size="11" font-weight="500" fill="${COLORS.mutedDark}">Enterprise IT Management. Open to Everyone.  ·  A Njure Tech product.</text>
  <!-- Drag-to-Applications guide arrow -->
  <line x1="226" y1="218" x2="306" y2="218" stroke="${COLORS.accentCyan}" stroke-width="4" stroke-linecap="round" stroke-dasharray="8 8" />
  <polyline points="294,206 312,218 294,230" fill="none" stroke="${COLORS.accentCyan}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
  <text x="${width / 2}" y="344" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" font-weight="500" fill="${COLORS.mutedDark}">Drag SCRIBBLE-IT into Applications to install</text>
</svg>`;
}

function createIosLaunchScreenSvg(theme = 'dark') {
  const isDark = theme === 'dark';
  const sym = buildSymbolInnerSvg(isDark ? 'color-dark' : 'color-light', `ios-launch-${theme}`);
  const bg = isDark ? COLORS.deepNavy : COLORS.surface;
  const primary = isDark ? COLORS.surface : COLORS.deepNavy;
  const accent = isDark ? COLORS.accentCyan : COLORS.njureBlue;
  const sub = isDark ? COLORS.mutedDark : COLORS.mutedLight;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1290 2796" width="1290" height="2796">
  <defs>${sym.defs}</defs>
  <rect width="1290" height="2796" fill="${bg}" />
  <g transform="translate(415 1030) scale(0.45)">${sym.body}</g>
  <text x="645" y="1605" text-anchor="middle" font-family="Manrope, Inter, sans-serif" font-size="108" font-weight="800" letter-spacing="-2.5" fill="${primary}">Scribble <tspan fill="${accent}">IT</tspan></text>
  <text x="645" y="1675" text-anchor="middle" font-family="Inter, sans-serif" font-size="34" font-weight="500" fill="${sub}">Enterprise IT Management. Open to Everyone.</text>
  <text x="645" y="2610" text-anchor="middle" font-family="Inter, sans-serif" font-size="32" font-weight="600" fill="${sub}">A Njure Tech product.</text>
</svg>`;
}

/**
 * Recreated SCRIBBLE-IT Brand Identity Board SVG (zero version numbers).
 */
function createBrandIdentityBoardSvg() {
  const symDark = buildSymbolInnerSvg('color-dark', 'board-dark');
  const symLight = buildSymbolInnerSvg('color-light', 'board-light');
  const symMonoDark = buildSymbolInnerSvg('mono-dark', 'board-monod');
  const symMonoLight = buildSymbolInnerSvg('mono-light', 'board-monol');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1080" width="1600" height="1080" role="img" aria-label="SCRIBBLE-IT Official Brand Identity Board">
  <title>SCRIBBLE-IT Official Brand Identity Board</title>
  <defs>
    ${symDark.defs}
    ${symLight.defs}
    <linearGradient id="board-hero-bg" x1="0" y1="0" x2="1600" y2="380" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0E274A" />
      <stop offset="100%" stop-color="${COLORS.deepNavy}" />
    </linearGradient>
  </defs>

  <!-- Canvas -->
  <rect width="1600" height="1080" fill="${COLORS.surface}" />

  <!-- Top Header Bar -->
  <rect x="0" y="0" width="1600" height="104" fill="${COLORS.deepNavy}" />
  <rect x="0" y="100" width="1600" height="4" fill="${COLORS.njureBlue}" />
  <text x="56" y="64" font-family="Manrope, Inter, sans-serif" font-size="28" font-weight="800" letter-spacing="1.2" fill="${COLORS.surface}">SCRIBBLE-IT <tspan font-weight="500" fill="${COLORS.accentCyan}">BRAND IDENTITY BOARD</tspan></text>
  <text x="1544" y="64" text-anchor="end" font-family="Inter, sans-serif" font-size="18" font-weight="500" fill="${COLORS.mutedDark}">A Njure Tech product.  ·  Enterprise IT Management. Open to Everyone.</text>

  <!-- Panel 1: Primary Dark Logo -->
  <rect x="56" y="144" width="724" height="360" rx="24" fill="url(#board-hero-bg)" />
  <g transform="translate(106 208) scale(0.22)">${symDark.body}</g>
  <text x="364" y="330" font-family="Manrope, Inter, sans-serif" font-size="84" font-weight="800" letter-spacing="-2.4" fill="${COLORS.surface}">Scribble <tspan fill="${COLORS.accentCyan}">IT</tspan></text>
  <text x="368" y="378" font-family="Inter, sans-serif" font-size="26" font-weight="500" fill="${COLORS.mutedDark}">A Njure Tech product.</text>
  <text x="86" y="476" font-family="Inter, sans-serif" font-size="14" font-weight="600" letter-spacing="1.2" fill="${COLORS.accentCyan}">PRIMARY DARK LOCKUP (#0B1F3B)</text>

  <!-- Panel 2: Primary Light Logo -->
  <rect x="820" y="144" width="724" height="360" rx="24" fill="${COLORS.white}" stroke="#D4DFEE" stroke-width="2" />
  <g transform="translate(870 208) scale(0.22)">${symLight.body}</g>
  <text x="1128" y="330" font-family="Manrope, Inter, sans-serif" font-size="84" font-weight="800" letter-spacing="-2.4" fill="${COLORS.deepNavy}">Scribble <tspan fill="${COLORS.njureBlue}">IT</tspan></text>
  <text x="1132" y="378" font-family="Inter, sans-serif" font-size="26" font-weight="500" fill="${COLORS.mutedLight}">A Njure Tech product.</text>
  <text x="850" y="476" font-family="Inter, sans-serif" font-size="14" font-weight="600" letter-spacing="1.2" fill="${COLORS.njureBlue}">PRIMARY LIGHT LOCKUP (#F5F8FF / #FFFFFF)</text>

  <!-- Panel 3: Official Brand Palette -->
  <rect x="56" y="540" width="724" height="232" rx="20" fill="${COLORS.white}" stroke="#D4DFEE" stroke-width="2" />
  <text x="86" y="582" font-family="Manrope, Inter, sans-serif" font-size="16" font-weight="700" letter-spacing="1" fill="${COLORS.deepNavy}">OFFICIAL COLOR PALETTE</text>

  <!-- Swatch 1: Deep Navy -->
  <rect x="86" y="604" width="152" height="96" rx="14" fill="${COLORS.deepNavy}" />
  <text x="86" y="726" font-family="Inter, sans-serif" font-size="15" font-weight="700" fill="${COLORS.deepNavy}">Deep Navy</text>
  <text x="86" y="748" font-family="Inter, sans-serif" font-size="14" font-weight="500" fill="${COLORS.mutedLight}">#0B1F3B</text>

  <!-- Swatch 2: Njure Blue -->
  <rect x="256" y="604" width="152" height="96" rx="14" fill="${COLORS.njureBlue}" />
  <text x="256" y="726" font-family="Inter, sans-serif" font-size="15" font-weight="700" fill="${COLORS.deepNavy}">Njure Blue</text>
  <text x="256" y="748" font-family="Inter, sans-serif" font-size="14" font-weight="500" fill="${COLORS.mutedLight}">#0A84FF</text>

  <!-- Swatch 3: Accent Cyan -->
  <rect x="426" y="604" width="152" height="96" rx="14" fill="${COLORS.accentCyan}" />
  <text x="426" y="726" font-family="Inter, sans-serif" font-size="15" font-weight="700" fill="${COLORS.deepNavy}">Accent Cyan</text>
  <text x="426" y="748" font-family="Inter, sans-serif" font-size="14" font-weight="500" fill="${COLORS.mutedLight}">#22D3EE</text>

  <!-- Swatch 4: Surface -->
  <rect x="596" y="604" width="152" height="96" rx="14" fill="${COLORS.surface}" stroke="#CBD8EC" stroke-width="2" />
  <text x="596" y="726" font-family="Inter, sans-serif" font-size="15" font-weight="700" fill="${COLORS.deepNavy}">Surface</text>
  <text x="596" y="748" font-family="Inter, sans-serif" font-size="14" font-weight="500" fill="${COLORS.mutedLight}">#F5F8FF</text>

  <!-- Panel 4: Monochrome & Compact Variants + Unified App Icons -->
  <rect x="820" y="540" width="724" height="232" rx="20" fill="${COLORS.white}" stroke="#D4DFEE" stroke-width="2" />
  <text x="850" y="582" font-family="Manrope, Inter, sans-serif" font-size="16" font-weight="700" letter-spacing="1" fill="${COLORS.deepNavy}">APP ICON &amp; MONOCHROME SYSTEM</text>

  <!-- Rounded App Tile Preview -->
  <rect x="850" y="604" width="128" height="128" rx="30" fill="${COLORS.deepNavy}" />
  <g transform="translate(864 618) scale(0.098)">${symDark.body}</g>
  <text x="914" y="754" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" font-weight="600" fill="${COLORS.mutedLight}">App Icon</text>

  <!-- Circle Adaptive Preview -->
  <circle cx="1078" cy="668" r="64" fill="${COLORS.deepNavy}" />
  <g transform="translate(1033 623) scale(0.088)">${symDark.body}</g>
  <text x="1078" y="754" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" font-weight="600" fill="${COLORS.mutedLight}">Adaptive Circle</text>

  <!-- Monochrome Dark Preview -->
  <rect x="1186" y="604" width="128" height="128" rx="20" fill="${COLORS.surface}" stroke="#CBD8EC" stroke-width="2" />
  <g transform="translate(1200 618) scale(0.098)">${symMonoDark.body}</g>
  <text x="1250" y="754" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" font-weight="600" fill="${COLORS.mutedLight}">Mono Navy</text>

  <!-- Monochrome Light Preview -->
  <rect x="1354" y="604" width="128" height="128" rx="20" fill="${COLORS.deepNavy}" />
  <g transform="translate(1368 618) scale(0.098)">${symMonoLight.body}</g>
  <text x="1418" y="754" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" font-weight="600" fill="${COLORS.mutedLight}">Mono Light</text>

  <!-- Panel 5: Typography & Attribution Bar -->
  <rect x="56" y="806" width="1488" height="218" rx="20" fill="${COLORS.white}" stroke="#D4DFEE" stroke-width="2" />
  <text x="86" y="848" font-family="Manrope, Inter, sans-serif" font-size="16" font-weight="700" letter-spacing="1" fill="${COLORS.deepNavy}">TYPOGRAPHY &amp; OFFICIAL ATTRIBUTION</text>
  <text x="86" y="904" font-family="Manrope, Inter, sans-serif" font-size="38" font-weight="800" fill="${COLORS.deepNavy}">Manrope &amp; Inter — Enterprise IT Management. Open to Everyone.</text>
  <text x="86" y="948" font-family="Inter, sans-serif" font-size="20" font-weight="500" fill="${COLORS.mutedLight}">Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn Oo Pp Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz  ·  0123456789</text>
  <text x="86" y="996" font-family="Inter, sans-serif" font-size="16" font-weight="600" fill="${COLORS.deepNavy}">SCRIBBLE-IT  ·  A Njure Tech product.  ·  Developed by NEEREJ S SURESAN — Founder &amp; CEO — Njure Tech (formally Njure Group).</text>
</svg>`;
}

/**
 * Pure Node.js multi-resolution Windows ICO binary builder (PNG-compressed frames).
 * Fully compliant with Microsoft ICONDIR + ICONDIRENTRY specification.
 */
function buildIcoFromPngs(pngBuffersWithSizes) {
  const count = pngBuffersWithSizes.length;
  const headerSize = 6 + count * 16;
  const entries = [];
  let offset = headerSize;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type: 1 = ICO
  header.writeUInt16LE(count, 4);

  for (const { size, buffer } of pngBuffersWithSizes) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // Width (0 encodes 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // Height (0 encodes 256)
    entry.writeUInt8(0, 2); // Color palette count
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(buffer.length, 8); // Image payload size
    entry.writeUInt32LE(offset, 12); // Offset in file
    entries.push(entry);
    offset += buffer.length;
  }

  return Buffer.concat([header, ...entries, ...pngBuffersWithSizes.map((p) => p.buffer)]);
}

/**
 * Pure Node.js Apple ICNS binary builder using standard PNG OSType chunks.
 */
function buildIcnsFromChunks(chunks) {
  const bodyParts = chunks.map(({ osType, buffer }) => {
    const chunkHeader = Buffer.alloc(8);
    chunkHeader.write(osType, 0, 4, 'ascii');
    chunkHeader.writeUInt32BE(8 + buffer.length, 4);
    return Buffer.concat([chunkHeader, buffer]);
  });

  const totalSize = 8 + bodyParts.reduce((sum, part) => sum + part.length, 0);
  const fileHeader = Buffer.alloc(8);
  fileHeader.write('icns', 0, 4, 'ascii');
  fileHeader.writeUInt32BE(totalSize, 4);

  return Buffer.concat([fileHeader, ...bodyParts]);
}

function main() {
  console.log('Generating SCRIBBLE-IT Master Brand Assets & Five-Platform Icon System...');

  // -------------------------------------------------------------------------
  // 1. Master Editable SVGs
  // -------------------------------------------------------------------------
  const masterLogoSvg = path.join(BRAND_ROOT, 'master', 'scribble-it-master.svg');
  const masterSymbolSvg = path.join(BRAND_ROOT, 'master', 'scribble-it-symbol.svg');
  const appIconMasterSvg = path.join(BRAND_ROOT, 'master', 'scribble-it-app-icon.svg');
  const appIconOpaqueSvg = path.join(BRAND_ROOT, 'master', 'scribble-it-app-icon-opaque.svg');

  writeFile(masterLogoSvg, createLogoLockupSvg({ layout: 'primary', theme: 'transparent-dark-text', width: 1200, height: 740 }));
  writeFile(masterSymbolSvg, createStandaloneSymbolSvg('color-dark'));
  writeFile(appIconMasterSvg, createAppIconSvg({ fullBleed: false, roundedRadius: 224, safeScale: 0.78 }));
  writeFile(appIconOpaqueSvg, createAppIconSvg({ fullBleed: true, safeScale: 0.78 }));

  // -------------------------------------------------------------------------
  // 2. Logo Variants (Dark, Light, Transparent, Horizontal, Compact, Monochrome)
  // -------------------------------------------------------------------------
  const logoSpecs = [
    // Dark background variants
    { file: 'logos/dark/scribble-it-logo-dark.svg', layout: 'primary', theme: 'dark', w: 1200, h: 740 },
    { file: 'logos/dark/scribble-it-horizontal-dark.svg', layout: 'horizontal', theme: 'dark', w: 1600, h: 440 },
    { file: 'logos/dark/scribble-it-compact-dark.svg', layout: 'compact', theme: 'dark', w: 880, h: 260 },
    // Light background variants
    { file: 'logos/light/scribble-it-logo-light.svg', layout: 'primary', theme: 'light', w: 1200, h: 740 },
    { file: 'logos/light/scribble-it-horizontal-light.svg', layout: 'horizontal', theme: 'light', w: 1600, h: 440 },
    { file: 'logos/light/scribble-it-compact-light.svg', layout: 'compact', theme: 'light', w: 880, h: 260 },
    // Transparent background variants
    { file: 'logos/transparent/scribble-it-logo-transparent-dark-text.svg', layout: 'primary', theme: 'transparent-dark-text', w: 1200, h: 740 },
    { file: 'logos/transparent/scribble-it-logo-transparent-light-text.svg', layout: 'primary', theme: 'transparent-light-text', w: 1200, h: 740 },
    { file: 'logos/transparent/scribble-it-horizontal-transparent-dark-text.svg', layout: 'horizontal', theme: 'transparent-dark-text', w: 1600, h: 440 },
    { file: 'logos/transparent/scribble-it-horizontal-transparent-light-text.svg', layout: 'horizontal', theme: 'transparent-light-text', w: 1600, h: 440 },
    // Monochrome variants
    { file: 'logos/monochrome/scribble-it-logo-mono-dark.svg', layout: 'primary', theme: 'mono-dark', w: 1200, h: 740 },
    { file: 'logos/monochrome/scribble-it-logo-mono-light.svg', layout: 'primary', theme: 'mono-light', w: 1200, h: 740 },
    { file: 'logos/monochrome/scribble-it-horizontal-mono-dark.svg', layout: 'horizontal', theme: 'mono-dark', w: 1600, h: 440 },
    { file: 'logos/monochrome/scribble-it-horizontal-mono-light.svg', layout: 'horizontal', theme: 'mono-light', w: 1600, h: 440 },
  ];

  for (const spec of logoSpecs) {
    const svgPath = path.join(BRAND_ROOT, spec.file);
    const pngPath = svgPath.replace(/\.svg$/, '.png');
    writeFile(svgPath, createLogoLockupSvg({ layout: spec.layout, theme: spec.theme, width: spec.w, height: spec.h }));
    renderSvgToPng(svgPath, pngPath, spec.w, spec.h);
  }

  // Monochrome standalone symbols (1024x1024)
  const monoSymDarkSvg = path.join(BRAND_ROOT, 'logos', 'monochrome', 'scribble-it-symbol-mono-dark.svg');
  const monoSymLightSvg = path.join(BRAND_ROOT, 'logos', 'monochrome', 'scribble-it-symbol-mono-light.svg');
  writeFile(monoSymDarkSvg, createStandaloneSymbolSvg('mono-dark'));
  writeFile(monoSymLightSvg, createStandaloneSymbolSvg('mono-light'));
  renderSvgToPng(monoSymDarkSvg, monoSymDarkSvg.replace(/\.svg$/, '.png'), 1024, 1024);
  renderSvgToPng(monoSymLightSvg, monoSymLightSvg.replace(/\.svg$/, '.png'), 1024, 1024);

  // -------------------------------------------------------------------------
  // 3. Web Icons & Favicons (Part B)
  // -------------------------------------------------------------------------
  const webDir = path.join(BRAND_ROOT, 'icons', 'web');
  ensureDir(webDir);

  renderSvgToPng(appIconMasterSvg, path.join(webDir, 'app-icon-1024.png'), 1024, 1024);
  renderSvgToPng(appIconMasterSvg, path.join(webDir, 'app-icon-512.png'), 512, 512);
  renderSvgToPng(appIconMasterSvg, path.join(webDir, 'icon-192.png'), 192, 192);
  renderSvgToPng(appIconMasterSvg, path.join(webDir, 'icon-512.png'), 512, 512);
  renderSvgToPng(appIconMasterSvg, path.join(webDir, 'favicon-16x16.png'), 16, 16);
  renderSvgToPng(appIconMasterSvg, path.join(webDir, 'favicon-32x32.png'), 32, 32);
  renderSvgToPng(appIconMasterSvg, path.join(webDir, 'favicon-48x48.png'), 48, 48);
  renderSvgToPng(appIconOpaqueSvg, path.join(webDir, 'apple-touch-icon.png'), 180, 180, { opaqueBg: COLORS.deepNavy });
  fs.copyFileSync(appIconMasterSvg, path.join(webDir, 'favicon.svg'));

  const webFaviconIco = buildIcoFromPngs([
    { size: 16, buffer: fs.readFileSync(path.join(webDir, 'favicon-16x16.png')) },
    { size: 32, buffer: fs.readFileSync(path.join(webDir, 'favicon-32x32.png')) },
    { size: 48, buffer: fs.readFileSync(path.join(webDir, 'favicon-48x48.png')) },
  ]);
  writeFile(path.join(webDir, 'favicon.ico'), webFaviconIco);

  // Copy web favicons into public/ for live web app + GitHub Pages deployment
  for (const webAsset of [
    'favicon.ico',
    'favicon.svg',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'favicon-48x48.png',
    'apple-touch-icon.png',
  ]) {
    fs.copyFileSync(path.join(webDir, webAsset), path.join(PUBLIC_ROOT, webAsset));
  }

  // -------------------------------------------------------------------------
  // 4. Windows Icons & Installer Branding (Part C — Tauri, Store, MSI, NSIS)
  // -------------------------------------------------------------------------
  const winDir = path.join(BRAND_ROOT, 'icons', 'windows');
  const winInstallerDir = path.join(winDir, 'installer');
  ensureDir(winInstallerDir);

  const winTauriPngs = [
    ['32x32.png', 32],
    ['128x128.png', 128],
    ['128x128@2x.png', 256],
    ['icon.png', 512],
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
  ];
  for (const [name, size] of winTauriPngs) {
    renderSvgToPng(appIconMasterSvg, path.join(winDir, name), size, size);
  }

  // Full multi-resolution Windows ICO (16, 24, 32, 48, 64, 128, 256)
  const winIcoSizes = [16, 24, 32, 48, 64, 128, 256];
  const winIcoFrames = winIcoSizes.map((size) => {
    const tmp = `/tmp/scribble-win-${size}.png`;
    renderSvgToPng(appIconMasterSvg, tmp, size, size);
    const buffer = fs.readFileSync(tmp);
    fs.unlinkSync(tmp);
    return { size, buffer };
  });
  writeFile(path.join(winDir, 'icon.ico'), buildIcoFromPngs(winIcoFrames));

  // Windows MSI & NSIS installer banners (BMP + PNG)
  const winBanners = [
    { name: 'msi-banner', w: 493, h: 58 },
    { name: 'msi-dialog', w: 493, h: 312 },
    { name: 'nsis-header', w: 150, h: 57 },
    { name: 'nsis-sidebar', w: 164, h: 314 },
  ];
  for (const b of winBanners) {
    const svgPath = path.join(winInstallerDir, `${b.name}.svg`);
    const pngPath = path.join(winInstallerDir, `${b.name}.png`);
    const bmpPath = path.join(winInstallerDir, `${b.name}.bmp`);
    writeFile(svgPath, createWindowsBannerSvg(b.w, b.h, b.name));
    renderSvgToPng(svgPath, pngPath, b.w, b.h, { opaqueBg: COLORS.deepNavy });
    renderPngToBmp(pngPath, bmpPath);
  }

  // -------------------------------------------------------------------------
  // 5. macOS ICNS, .iconset & DMG Branding (Part C)
  // -------------------------------------------------------------------------
  const macDir = path.join(BRAND_ROOT, 'icons', 'macos');
  const macIconsetDir = path.join(macDir, 'icon.iconset');
  const macDmgDir = path.join(macDir, 'dmg');
  ensureDir(macIconsetDir);
  ensureDir(macDmgDir);

  const macIconsetSpecs = [
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
  ];
  for (const [name, size] of macIconsetSpecs) {
    renderSvgToPng(appIconMasterSvg, path.join(macIconsetDir, name), size, size);
  }

  const macIcnsBuffer = buildIcnsFromChunks([
    { osType: 'icp4', buffer: fs.readFileSync(path.join(macIconsetDir, 'icon_16x16.png')) },
    { osType: 'icp5', buffer: fs.readFileSync(path.join(macIconsetDir, 'icon_32x32.png')) },
    { osType: 'icp6', buffer: fs.readFileSync(path.join(macIconsetDir, 'icon_32x32@2x.png')) },
    { osType: 'ic07', buffer: fs.readFileSync(path.join(macIconsetDir, 'icon_128x128.png')) },
    { osType: 'ic08', buffer: fs.readFileSync(path.join(macIconsetDir, 'icon_256x256.png')) },
    { osType: 'ic09', buffer: fs.readFileSync(path.join(macIconsetDir, 'icon_512x512.png')) },
    { osType: 'ic10', buffer: fs.readFileSync(path.join(macIconsetDir, 'icon_512x512@2x.png')) },
    { osType: 'ic11', buffer: fs.readFileSync(path.join(macIconsetDir, 'icon_16x16@2x.png')) },
    { osType: 'ic12', buffer: fs.readFileSync(path.join(macIconsetDir, 'icon_32x32@2x.png')) },
    { osType: 'ic13', buffer: fs.readFileSync(path.join(macIconsetDir, 'icon_128x128@2x.png')) },
    { osType: 'ic14', buffer: fs.readFileSync(path.join(macIconsetDir, 'icon_256x256@2x.png')) },
  ]);
  writeFile(path.join(macDir, 'icon.icns'), macIcnsBuffer);
  writeFile(path.join(macDmgDir, 'volume-icon.icns'), macIcnsBuffer);

  const dmgBgSvg = path.join(macDmgDir, 'dmg-background.svg');
  writeFile(dmgBgSvg, createMacOsDmgBackgroundSvg(540, 380));
  renderSvgToPng(dmgBgSvg, path.join(macDmgDir, 'dmg-background.png'), 540, 380, { opaqueBg: COLORS.deepNavy });
  renderSvgToPng(dmgBgSvg, path.join(macDmgDir, 'dmg-background@2x.png'), 1080, 760, { opaqueBg: COLORS.deepNavy });

  // -------------------------------------------------------------------------
  // 6. Linux Freedesktop Hicolor Icons, .desktop, AppImage/DEB/RPM (Part C)
  // -------------------------------------------------------------------------
  const linuxDir = path.join(BRAND_ROOT, 'icons', 'linux');
  const hicolorDir = path.join(linuxDir, 'hicolor');
  const linuxPkgDir = path.join(linuxDir, 'packaging');
  ensureDir(linuxPkgDir);

  for (const size of [16, 24, 32, 48, 64, 128, 256, 512]) {
    renderSvgToPng(
      appIconMasterSvg,
      path.join(hicolorDir, `${size}x${size}`, 'apps', 'scribble-it.png'),
      size,
      size,
    );
  }
  const scalablePath = path.join(hicolorDir, 'scalable', 'apps', 'scribble-it.svg');
  ensureDir(path.dirname(scalablePath));
  fs.copyFileSync(appIconMasterSvg, scalablePath);

  fs.copyFileSync(
    path.join(hicolorDir, '256x256', 'apps', 'scribble-it.png'),
    path.join(linuxPkgDir, 'appimage-diricon.png'),
  );
  fs.copyFileSync(
    path.join(hicolorDir, '512x512', 'apps', 'scribble-it.png'),
    path.join(linuxPkgDir, 'deb-rpm-icon-512.png'),
  );

  writeFile(
    path.join(linuxDir, 'scribble-it.desktop'),
    `[Desktop Entry]
Type=Application
Name=SCRIBBLE-IT
GenericName=Enterprise IT Service Management
Comment=Enterprise IT Management. Open to Everyone. A Njure Tech product.
Exec=scribble-it %U
Icon=scribble-it
Terminal=false
Categories=Office;Network;System;Utility;
StartupWMClass=scribble-it
Keywords=ITSM;ServiceDesk;CMDB;IAM;Incidents;Changes;
`,
  );

  writeFile(
    path.join(linuxPkgDir, 'in.njuregroup.scribbleit.metainfo.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>in.njuregroup.scribbleit</id>
  <name>SCRIBBLE-IT</name>
  <summary>Enterprise IT Management. Open to Everyone.</summary>
  <metadata_license>CC0-1.0</metadata_license>
  <project_license>AGPL-3.0-only</project_license>
  <developer id="in.njuregroup.tech">
    <name>Njure Tech</name>
  </developer>
  <description>
    <p>SCRIBBLE-IT is an open-source Enterprise IT Service Management (ITSM) platform by Njure Tech (formally Njure Group), uniting incidents, service requests, problem investigation, CAB change governance, CMDB, asset management, and centralized IAM.</p>
  </description>
  <launchable type="desktop-id">scribble-it.desktop</launchable>
  <url type="homepage">https://scribbleit.njuregroup.in</url>
  <icon type="stock">scribble-it</icon>
</component>
`,
  );

  // -------------------------------------------------------------------------
  // 7. Android Adaptive Icons & Density Exports (Part C)
  // -------------------------------------------------------------------------
  const androidDir = path.join(BRAND_ROOT, 'icons', 'android');
  const androidResDir = path.join(androidDir, 'res');
  ensureDir(path.join(androidResDir, 'mipmap-anydpi-v26'));
  ensureDir(path.join(androidResDir, 'values'));

  const androidBgSvg = path.join(androidDir, 'adaptive-background.svg');
  const androidFgSvg = path.join(androidDir, 'adaptive-foreground.svg');
  const androidMonoSvg = path.join(androidDir, 'adaptive-monochrome.svg');

  writeFile(androidBgSvg, createAndroidAdaptiveBackgroundSvg());
  writeFile(androidFgSvg, createAndroidAdaptiveForegroundSvg(false));
  writeFile(androidMonoSvg, createAndroidAdaptiveForegroundSvg(true));

  // Circular legacy icon SVG
  const androidRoundSvg = path.join(androidDir, 'legacy-round.svg');
  writeFile(
    androidRoundSvg,
    createAppIconSvg({ fullBleed: false, roundedRadius: 488, safeScale: 0.72 }),
  );

  const androidDensities = [
    { name: 'mipmap-mdpi', legacy: 48, adaptive: 108 },
    { name: 'mipmap-hdpi', legacy: 72, adaptive: 162 },
    { name: 'mipmap-xhdpi', legacy: 96, adaptive: 216 },
    { name: 'mipmap-xxhdpi', legacy: 144, adaptive: 324 },
    { name: 'mipmap-xxxhdpi', legacy: 192, adaptive: 432 },
  ];

  for (const d of androidDensities) {
    const dir = path.join(androidResDir, d.name);
    ensureDir(dir);
    renderSvgToPng(appIconMasterSvg, path.join(dir, 'ic_launcher.png'), d.legacy, d.legacy);
    renderSvgToPng(androidRoundSvg, path.join(dir, 'ic_launcher_round.png'), d.legacy, d.legacy);
    renderSvgToPng(androidBgSvg, path.join(dir, 'ic_launcher_background.png'), d.adaptive, d.adaptive, { opaqueBg: COLORS.deepNavy });
    renderSvgToPng(androidFgSvg, path.join(dir, 'ic_launcher_foreground.png'), d.adaptive, d.adaptive);
    renderSvgToPng(androidMonoSvg, path.join(dir, 'ic_launcher_monochrome.png'), d.adaptive, d.adaptive);
  }

  // Google Play Store 512x512 icon (strictly opaque 24-bit RGB without alpha channel)
  renderSvgToPng(appIconOpaqueSvg, path.join(androidDir, 'play-store-icon-512.png'), 512, 512, {
    opaqueBg: COLORS.deepNavy,
  });

  // Adaptive icon XML manifests (API 26+ with Android 13+ monochrome support)
  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />
</adaptive-icon>
`;
  writeFile(path.join(androidResDir, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptiveXml);
  writeFile(path.join(androidResDir, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptiveXml);
  writeFile(
    path.join(androidResDir, 'values', 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0B1F3B</color>
</resources>
`,
  );

  // -------------------------------------------------------------------------
  // 8. iOS Assets.xcassets AppIcon Catalog & Launch Screen Assets (Part C)
  // -------------------------------------------------------------------------
  const iosDir = path.join(BRAND_ROOT, 'icons', 'ios');
  const xcassetsDir = path.join(iosDir, 'Assets.xcassets');
  const appIconSetDir = path.join(xcassetsDir, 'AppIcon.appiconset');
  const launchLogoSetDir = path.join(xcassetsDir, 'LaunchLogo.imageset');
  const launchBgColorDir = path.join(xcassetsDir, 'LaunchBackground.colorset');
  const launchScreenDir = path.join(iosDir, 'LaunchScreen');

  ensureDir(appIconSetDir);
  ensureDir(launchLogoSetDir);
  ensureDir(launchBgColorDir);
  ensureDir(launchScreenDir);

  writeFile(
    path.join(xcassetsDir, 'Contents.json'),
    JSON.stringify({ info: { author: 'xcode', version: 1 } }, null, 2) + '\n',
  );

  // All iOS AppIcon PNGs MUST be opaque (no alpha channel) per Apple App Store rules
  const iosAppIcons = [
    { filename: 'icon-20@2x.png', size: '20x20', scale: '2x', idiom: 'iphone', px: 40 },
    { filename: 'icon-20@3x.png', size: '20x20', scale: '3x', idiom: 'iphone', px: 60 },
    { filename: 'icon-29@2x.png', size: '29x29', scale: '2x', idiom: 'iphone', px: 58 },
    { filename: 'icon-29@3x.png', size: '29x29', scale: '3x', idiom: 'iphone', px: 87 },
    { filename: 'icon-40@2x.png', size: '40x40', scale: '2x', idiom: 'iphone', px: 80 },
    { filename: 'icon-40@3x.png', size: '40x40', scale: '3x', idiom: 'iphone', px: 120 },
    { filename: 'icon-60@2x.png', size: '60x60', scale: '2x', idiom: 'iphone', px: 120 },
    { filename: 'icon-60@3x.png', size: '60x60', scale: '3x', idiom: 'iphone', px: 180 },
    { filename: 'icon-20-ipad@1x.png', size: '20x20', scale: '1x', idiom: 'ipad', px: 20 },
    { filename: 'icon-20-ipad@2x.png', size: '20x20', scale: '2x', idiom: 'ipad', px: 40 },
    { filename: 'icon-29-ipad@1x.png', size: '29x29', scale: '1x', idiom: 'ipad', px: 29 },
    { filename: 'icon-29-ipad@2x.png', size: '29x29', scale: '2x', idiom: 'ipad', px: 58 },
    { filename: 'icon-40-ipad@1x.png', size: '40x40', scale: '1x', idiom: 'ipad', px: 40 },
    { filename: 'icon-40-ipad@2x.png', size: '40x40', scale: '2x', idiom: 'ipad', px: 80 },
    { filename: 'icon-76@1x.png', size: '76x76', scale: '1x', idiom: 'ipad', px: 76 },
    { filename: 'icon-76@2x.png', size: '76x76', scale: '2x', idiom: 'ipad', px: 152 },
    { filename: 'icon-83.5@2x.png', size: '83.5x83.5', scale: '2x', idiom: 'ipad', px: 167 },
    { filename: 'icon-1024.png', size: '1024x1024', scale: '1x', idiom: 'ios-marketing', px: 1024 },
  ];

  for (const icon of iosAppIcons) {
    renderSvgToPng(appIconOpaqueSvg, path.join(appIconSetDir, icon.filename), icon.px, icon.px, {
      opaqueBg: COLORS.deepNavy,
    });
  }

  writeFile(
    path.join(appIconSetDir, 'Contents.json'),
    JSON.stringify(
      {
        images: iosAppIcons.map(({ filename, size, scale, idiom }) => ({
          filename,
          idiom,
          scale,
          size,
        })),
        info: { author: 'xcode', version: 1 },
      },
      null,
      2,
    ) + '\n',
  );

  // LaunchLogo imageset (@1x, @2x, @3x)
  renderSvgToPng(masterSymbolSvg, path.join(launchLogoSetDir, 'launch-logo@1x.png'), 240, 240);
  renderSvgToPng(masterSymbolSvg, path.join(launchLogoSetDir, 'launch-logo@2x.png'), 480, 480);
  renderSvgToPng(masterSymbolSvg, path.join(launchLogoSetDir, 'launch-logo@3x.png'), 720, 720);
  writeFile(
    path.join(launchLogoSetDir, 'Contents.json'),
    JSON.stringify(
      {
        images: [
          { filename: 'launch-logo@1x.png', idiom: 'universal', scale: '1x' },
          { filename: 'launch-logo@2x.png', idiom: 'universal', scale: '2x' },
          { filename: 'launch-logo@3x.png', idiom: 'universal', scale: '3x' },
        ],
        info: { author: 'xcode', version: 1 },
      },
      null,
      2,
    ) + '\n',
  );

  // LaunchBackground colorset (light #F5F8FF / dark #0B1F3B)
  writeFile(
    path.join(launchBgColorDir, 'Contents.json'),
    JSON.stringify(
      {
        colors: [
          {
            color: {
              'color-space': 'srgb',
              components: { alpha: '1.000', blue: '1.000', green: '0.973', red: '0.961' },
            },
            idiom: 'universal',
          },
          {
            appearances: [{ appearance: 'luminosity', value: 'dark' }],
            color: {
              'color-space': 'srgb',
              components: { alpha: '1.000', blue: '0.231', green: '0.122', red: '0.043' },
            },
            idiom: 'universal',
          },
        ],
        info: { author: 'xcode', version: 1 },
      },
      null,
      2,
    ) + '\n',
  );

  // Launch Screen reference PNGs (dark & light)
  const launchDarkSvg = path.join(launchScreenDir, 'launch-screen-dark.svg');
  const launchLightSvg = path.join(launchScreenDir, 'launch-screen-light.svg');
  writeFile(launchDarkSvg, createIosLaunchScreenSvg('dark'));
  writeFile(launchLightSvg, createIosLaunchScreenSvg('light'));
  renderSvgToPng(launchDarkSvg, path.join(launchScreenDir, 'launch-screen-dark-1290x2796.png'), 1290, 2796, { opaqueBg: COLORS.deepNavy });
  renderSvgToPng(launchLightSvg, path.join(launchScreenDir, 'launch-screen-light-1290x2796.png'), 1290, 2796, { opaqueBg: COLORS.surface });

  // -------------------------------------------------------------------------
  // 9. Brand Identity Board Preview (Part A.2)
  // -------------------------------------------------------------------------
  const previewDir = path.join(BRAND_ROOT, 'previews');
  const boardSvgPath = path.join(previewDir, 'brand-identity-board.svg');
  const boardPngPath = path.join(previewDir, 'brand-identity-board.png');
  writeFile(boardSvgPath, createBrandIdentityBoardSvg());
  renderSvgToPng(boardSvgPath, boardPngPath, 1600, 1080, { opaqueBg: COLORS.surface });

  console.log('Done! All SCRIBBLE-IT brand assets and 5-platform icons generated.');
}

main();
