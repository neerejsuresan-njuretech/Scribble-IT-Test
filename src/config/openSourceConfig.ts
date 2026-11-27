/**
 * Centralized Open-Source Project Identity & Configurable External URLs
 * for SCRIBBLE-IT (Njure Tech, formally Njure Group).
 *
 * Unconfigured third-party URLs intentionally default to empty strings ('')
 * so unverified destinations are never fabricated or rendered as broken links.
 * Configure via Vite environment variables (VITE_*) or edit this file before release.
 */

function readEnv(key: string): string {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const fromVite = metaEnv?.[key];
  if (typeof fromVite === 'string' && fromVite.trim()) {
    return fromVite.trim();
  }
  if (typeof process !== 'undefined' && process.env && typeof process.env[key] === 'string') {
    const fromNode = process.env[key]?.trim();
    if (fromNode) return fromNode;
  }
  return '';
}

export function isConfiguredUrl(url?: string | null): url is string {
  if (!url) return false;
  const trimmed = url.trim();
  return /^https?:\/\/[^\s]+$/i.test(trimmed);
}

// ============================================================================
// Official Project Identity Constants
// ============================================================================
export const PROJECT_IDENTITY = {
  productName: 'SCRIBBLE-IT',
  wordmark: 'Scribble IT',
  shortName: 'Scribble-IT',
  productAttribution: 'A Njure Tech product.',
  tagline: 'Enterprise IT Management. Open to Everyone.',
  organization: 'Njure Tech',
  formerOrganization: 'Njure Group',
  organizationFull: 'Njure Tech (formally Njure Group)',
  founderName: 'NEEREJ S SURESAN',
  founderRole: 'Founder & CEO',
  founderAttribution: 'Developed by NEEREJ S SURESAN',
  founderAttributionSubline: 'Founder & CEO — Njure Tech (formally Njure Group).',
  officialWebsiteUrl: 'https://scribbleit.njuregroup.in',
  njureTechWebsiteUrl: 'https://tech.njuregroup.in',
  njureGroupWebsiteUrl: 'https://njuregroup.in',
  licenseSpdx: 'AGPL-3.0-only WITH Appstore-exception',
  licenseName: 'GNU Affero General Public License v3.0 (AGPL-3.0-only) + Section 7 App Store Distribution Exception',
  licenseUrl: 'https://www.gnu.org/licenses/agpl-3.0.en.html',
  finalBrandStatement:
    'A community-driven enterprise ITSM platform. Built for everyone. Improved together.',
} as const;

export const NJURE_TECH_URL = PROJECT_IDENTITY.njureTechWebsiteUrl;
export const NJURE_GROUP_URL = PROJECT_IDENTITY.njureGroupWebsiteUrl;

// ============================================================================
// Centralized Configurable External URLs (Explicit Placeholders for Unconfigured Targets)
// ============================================================================
export const GITHUB_REPOSITORY_URL =
  readEnv('VITE_GITHUB_REPOSITORY_URL') ||
  'https://github.com/neerejsuresan-njuretech/Scribble-IT-Test';

export const ISSUES_URL =
  readEnv('VITE_ISSUES_URL') || `${GITHUB_REPOSITORY_URL}/issues`;

export const DOCUMENTATION_URL =
  readEnv('VITE_DOCUMENTATION_URL') || `${GITHUB_REPOSITORY_URL}#readme`;

/** Verified Njure Tech direct support payment link (voluntary). */
export const NJURE_SUPPORT_PAYMENT_URL =
  readEnv('VITE_SUPPORT_PAYMENT_URL') || 'https://rzp.io/rzp/Njuretech';

/** Unconfigured placeholders — leave empty until official accounts/pages are published. */
export const BUY_ME_A_COFFEE_URL = readEnv('VITE_BUY_ME_A_COFFEE_URL');
export const GITHUB_SPONSORS_URL = readEnv('VITE_GITHUB_SPONSORS_URL');
export const COMMUNITY_URL = readEnv('VITE_COMMUNITY_URL');
export const ROADMAP_URL = readEnv('VITE_ROADMAP_URL');
export const CHANGELOG_URL = readEnv('VITE_CHANGELOG_URL');

export interface SponsorConfig {
  githubSponsorsUrl: string;
  buyMeACoffeeUrl: string;
  supportPaymentUrl: string;
  githubRepoUrl: string;
  documentationUrl: string;
  issueTrackerUrl: string;
  communityUrl: string;
  roadmapUrl: string;
  changelogUrl: string;
  officialWebsiteUrl: string;
  njureTechWebsiteUrl: string;
  njureGroupWebsiteUrl: string;
  licenseName: string;
  licenseSpdx: string;
  licenseUrl: string;
}

export const OPEN_SOURCE_CONFIG: SponsorConfig = {
  githubRepoUrl: GITHUB_REPOSITORY_URL,
  documentationUrl: DOCUMENTATION_URL,
  issueTrackerUrl: ISSUES_URL,
  githubSponsorsUrl: GITHUB_SPONSORS_URL,
  buyMeACoffeeUrl: BUY_ME_A_COFFEE_URL,
  supportPaymentUrl: NJURE_SUPPORT_PAYMENT_URL,
  communityUrl: COMMUNITY_URL,
  roadmapUrl: ROADMAP_URL,
  changelogUrl: CHANGELOG_URL,
  officialWebsiteUrl: PROJECT_IDENTITY.officialWebsiteUrl,
  njureTechWebsiteUrl: PROJECT_IDENTITY.njureTechWebsiteUrl,
  njureGroupWebsiteUrl: PROJECT_IDENTITY.njureGroupWebsiteUrl,
  licenseName: PROJECT_IDENTITY.licenseName,
  licenseSpdx: PROJECT_IDENTITY.licenseSpdx,
  licenseUrl: PROJECT_IDENTITY.licenseUrl,
};

export interface WindowsDesktopReleaseConfig {
  version: string;
  availabilityStatus: 'Available' | 'In Development';
  installerUrl: string;
  installerName: string;
  installerSizeBytes: number | null;
  installerSizeLabel: string;
  msiInstallerUrl: string;
  msiInstallerName: string;
  msiSizeBytes: number | null;
  msiSizeLabel: string;
  installerSha256: string;
  sha256SumsUrl: string;
  releasePageUrl: string;
  architecture: string;
  minimumOs: string;
  runtimeRequirement: string;
  codeSigningStatus: string;
  installGuideUrl: string;
  buildGuideUrl: string;
  securityGuideUrl: string;
  releaseNotesUrl: string;
}

export function formatInstallerSize(bytes?: number | null): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) {
    return '';
  }
  const mib = bytes / (1024 * 1024);
  if (mib >= 1) {
    return `${mib.toFixed(2)} MiB`;
  }
  const kib = bytes / 1024;
  return `${kib.toFixed(1)} KiB`;
}

export function isDirectGitHubReleaseAssetUrl(
  url: string | undefined | null,
  repoUrl: string,
  expectedExtension: '.exe' | '.msi' | '.dmg' | '.deb' | '.rpm' | '.appimage' | '.txt'
): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  const base = repoUrl.replace(/\/+$/, '');
  const lower = trimmed.toLowerCase();
  if (!lower.startsWith(`${base.toLowerCase()}/releases/download/`)) {
    return false;
  }
  if (lower.includes('/archive/') || lower.includes('/actions/')) {
    return false;
  }
  return lower.endsWith(expectedExtension);
}

interface GitHubReleaseAssetLike {
  name?: unknown;
  size?: unknown;
  browser_download_url?: unknown;
  digest?: unknown;
}

interface GitHubReleaseLike {
  tag_name?: unknown;
  html_url?: unknown;
  draft?: unknown;
  assets?: unknown;
}

export function parseGitHubWindowsRelease(
  releasesPayload: unknown,
  repoUrl: string = GITHUB_REPOSITORY_URL
): WindowsDesktopReleaseConfig | null {
  if (!Array.isArray(releasesPayload)) return null;

  for (const rawRel of releasesPayload as GitHubReleaseLike[]) {
    if (!rawRel || rawRel.draft === true || !Array.isArray(rawRel.assets)) continue;
    const assets = rawRel.assets as GitHubReleaseAssetLike[];

    const exeAsset = assets.find(
      a =>
        typeof a?.name === 'string' &&
        typeof a?.browser_download_url === 'string' &&
        typeof a?.size === 'number' &&
        a.size > 0 &&
        isDirectGitHubReleaseAssetUrl(a.browser_download_url, repoUrl, '.exe')
    );
    if (!exeAsset) continue;

    const digestRaw = typeof exeAsset.digest === 'string' ? exeAsset.digest.trim() : '';
    const digestMatch = /^sha256:([a-f0-9]{64})$/i.exec(digestRaw);
    const sha256 = digestMatch ? digestMatch[1].toLowerCase() : '';

    const msiAsset = assets.find(
      a =>
        typeof a?.name === 'string' &&
        typeof a?.browser_download_url === 'string' &&
        typeof a?.size === 'number' &&
        a.size > 0 &&
        isDirectGitHubReleaseAssetUrl(a.browser_download_url, repoUrl, '.msi')
    );

    const sumsAsset = assets.find(
      a =>
        typeof a?.name === 'string' &&
        a.name === 'SHA256SUMS.txt' &&
        typeof a?.browser_download_url === 'string' &&
        isDirectGitHubReleaseAssetUrl(a.browser_download_url, repoUrl, '.txt')
    );

    const rawTag = typeof rawRel.tag_name === 'string' ? rawRel.tag_name.trim() : '';
    const version = rawTag.replace(/^v/i, '') || WINDOWS_DESKTOP_CONFIG.version;
    const exeSize = exeAsset.size as number;
    const msiSize = msiAsset && typeof msiAsset.size === 'number' ? msiAsset.size : null;

    if (!sha256) {
      // Checksum must be present (either via GitHub asset digest or resolved SHA256SUMS.txt before marking verified)
      return {
        ...WINDOWS_DESKTOP_CONFIG,
        version,
        availabilityStatus: 'In Development',
        installerUrl: exeAsset.browser_download_url as string,
        installerName: exeAsset.name as string,
        installerSizeBytes: exeSize,
        installerSizeLabel: formatInstallerSize(exeSize),
        msiInstallerUrl: msiAsset ? (msiAsset.browser_download_url as string) : '',
        msiInstallerName: msiAsset ? (msiAsset.name as string) : '',
        msiSizeBytes: msiSize,
        msiSizeLabel: formatInstallerSize(msiSize),
        installerSha256: '',
        sha256SumsUrl: sumsAsset ? (sumsAsset.browser_download_url as string) : '',
        releasePageUrl: typeof rawRel.html_url === 'string' ? rawRel.html_url : '',
      };
    }

    return {
      ...WINDOWS_DESKTOP_CONFIG,
      version,
      availabilityStatus: 'Available',
      installerUrl: exeAsset.browser_download_url as string,
      installerName: exeAsset.name as string,
      installerSizeBytes: exeSize,
      installerSizeLabel: formatInstallerSize(exeSize),
      msiInstallerUrl: msiAsset ? (msiAsset.browser_download_url as string) : '',
      msiInstallerName: msiAsset ? (msiAsset.name as string) : '',
      msiSizeBytes: msiSize,
      msiSizeLabel: formatInstallerSize(msiSize),
      installerSha256: sha256,
      sha256SumsUrl: sumsAsset ? (sumsAsset.browser_download_url as string) : '',
      releasePageUrl: typeof rawRel.html_url === 'string' ? rawRel.html_url : '',
    };
  }

  return null;
}

const configuredVersion = readEnv('VITE_WINDOWS_RELEASE_VERSION') || '1.0.0';
const configuredExeUrl = readEnv('VITE_WINDOWS_INSTALLER_URL');
const configuredMsiUrl = readEnv('VITE_WINDOWS_MSI_URL');
const configuredSha256 = readEnv('VITE_WINDOWS_INSTALLER_SHA256');
const configuredSumsUrl = readEnv('VITE_WINDOWS_SHA256SUMS_URL');
const configuredReleaseUrl = readEnv('VITE_WINDOWS_RELEASE_URL');
const parsedExeSize = Number.parseInt(readEnv('VITE_WINDOWS_INSTALLER_SIZE_BYTES'), 10);
const parsedMsiSize = Number.parseInt(readEnv('VITE_WINDOWS_MSI_SIZE_BYTES'), 10);
const configuredExeSizeBytes = Number.isFinite(parsedExeSize) && parsedExeSize > 0 ? parsedExeSize : null;
const configuredMsiSizeBytes = Number.isFinite(parsedMsiSize) && parsedMsiSize > 0 ? parsedMsiSize : null;

const hasVerifiedWindowsBinary =
  isConfiguredUrl(configuredExeUrl) && /^[a-f0-9]{64}$/i.test(configuredSha256);

export const WINDOWS_DESKTOP_CONFIG: WindowsDesktopReleaseConfig = {
  version: configuredVersion,
  availabilityStatus: hasVerifiedWindowsBinary ? 'Available' : 'In Development',
  installerUrl: hasVerifiedWindowsBinary ? configuredExeUrl : '',
  installerName: hasVerifiedWindowsBinary
    ? configuredExeUrl.split('/').pop() || `SCRIBBLE-IT_${configuredVersion}_x64-setup.exe`
    : '',
  installerSizeBytes: hasVerifiedWindowsBinary ? configuredExeSizeBytes : null,
  installerSizeLabel: hasVerifiedWindowsBinary ? formatInstallerSize(configuredExeSizeBytes) : '',
  msiInstallerUrl:
    hasVerifiedWindowsBinary && isConfiguredUrl(configuredMsiUrl) ? configuredMsiUrl : '',
  msiInstallerName:
    hasVerifiedWindowsBinary && isConfiguredUrl(configuredMsiUrl)
      ? configuredMsiUrl.split('/').pop() || `SCRIBBLE-IT_${configuredVersion}_x64_en-US.msi`
      : '',
  msiSizeBytes:
    hasVerifiedWindowsBinary && isConfiguredUrl(configuredMsiUrl) ? configuredMsiSizeBytes : null,
  msiSizeLabel:
    hasVerifiedWindowsBinary && isConfiguredUrl(configuredMsiUrl)
      ? formatInstallerSize(configuredMsiSizeBytes)
      : '',
  installerSha256: hasVerifiedWindowsBinary ? configuredSha256.toLowerCase() : '',
  sha256SumsUrl:
    hasVerifiedWindowsBinary && isConfiguredUrl(configuredSumsUrl) ? configuredSumsUrl : '',
  releasePageUrl:
    hasVerifiedWindowsBinary && isConfiguredUrl(configuredReleaseUrl) ? configuredReleaseUrl : '',
  architecture: 'Windows x86_64 (64-bit)',
  minimumOs: 'Windows 10 (Version 1809+) or Windows 11 (64-bit)',
  runtimeRequirement: 'Microsoft Edge WebView2 Runtime (auto-bootstrapped)',
  codeSigningStatus: 'Unsigned build (Windows Authenticode signing certificate pending)',
  installGuideUrl: `${GITHUB_REPOSITORY_URL}/blob/main/docs/desktop/windows-installation-guide.md`,
  buildGuideUrl: `${GITHUB_REPOSITORY_URL}/blob/main/docs/desktop/windows-build-and-dev-guide.md`,
  securityGuideUrl: `${GITHUB_REPOSITORY_URL}/blob/main/docs/desktop/windows-security.md`,
  releaseNotesUrl: `${GITHUB_REPOSITORY_URL}/blob/main/docs/releases/windows-v1.0.0-release-notes.md`,
};

export interface MacosDesktopReleaseConfig {
  version: string;
  availabilityStatus: 'Available' | 'In Development';
  arm64InstallerUrl: string;
  arm64InstallerName: string;
  arm64SizeBytes: number | null;
  arm64SizeLabel: string;
  arm64Sha256: string;
  x64InstallerUrl: string;
  x64InstallerName: string;
  x64SizeBytes: number | null;
  x64SizeLabel: string;
  x64Sha256: string;
  sha256SumsUrl: string;
  releasePageUrl: string;
  supportedArchitectures: string;
  minimumOs: string;
  runtimeRequirement: string;
  codeSigningStatus: string;
  installGuideUrl: string;
  buildGuideUrl: string;
  securityGuideUrl: string;
  releaseNotesUrl: string;
}

function extractAssetSha256Digest(asset: GitHubReleaseAssetLike | undefined): string {
  if (!asset || typeof asset.digest !== 'string') return '';
  const match = /^sha256:([a-f0-9]{64})$/i.exec(asset.digest.trim());
  return match ? match[1].toLowerCase() : '';
}

export function parseGitHubMacosRelease(
  releasesPayload: unknown,
  repoUrl: string = GITHUB_REPOSITORY_URL
): MacosDesktopReleaseConfig | null {
  if (!Array.isArray(releasesPayload)) return null;

  for (const rawRel of releasesPayload as GitHubReleaseLike[]) {
    if (!rawRel || rawRel.draft === true || !Array.isArray(rawRel.assets)) continue;
    const assets = rawRel.assets as GitHubReleaseAssetLike[];

    const dmgAssets = assets.filter(
      a =>
        typeof a?.name === 'string' &&
        typeof a?.browser_download_url === 'string' &&
        typeof a?.size === 'number' &&
        a.size > 0 &&
        isDirectGitHubReleaseAssetUrl(a.browser_download_url, repoUrl, '.dmg')
    );
    if (dmgAssets.length === 0) continue;

    const armAsset = dmgAssets.find(a =>
      /(arm64|aarch64|silicon)/i.test(String(a.name))
    );
    const x64Asset = dmgAssets.find(a =>
      /(x64|x86_64|intel)/i.test(String(a.name))
    );
    if (!armAsset && !x64Asset) continue;

    const armSha = extractAssetSha256Digest(armAsset);
    const x64Sha = extractAssetSha256Digest(x64Asset);

    const sumsAsset = assets.find(
      a =>
        typeof a?.name === 'string' &&
        (a.name === 'SHA256SUMS-macos.txt' || a.name === 'SHA256SUMS.txt') &&
        typeof a?.browser_download_url === 'string' &&
        isDirectGitHubReleaseAssetUrl(a.browser_download_url, repoUrl, '.txt')
    );

    const rawTag = typeof rawRel.tag_name === 'string' ? rawRel.tag_name.trim() : '';
    const version = rawTag.replace(/^(macos-)?v/i, '') || MACOS_DESKTOP_CONFIG.version;

    const armSize = armAsset && typeof armAsset.size === 'number' ? armAsset.size : null;
    const x64Size = x64Asset && typeof x64Asset.size === 'number' ? x64Asset.size : null;

    const armVerified = Boolean(armAsset && armSha);
    const x64Verified = Boolean(x64Asset && x64Sha);

    const supportedArchitectures =
      armAsset && x64Asset
        ? 'Apple Silicon (arm64) & Intel (x86_64)'
        : armAsset
        ? 'Apple Silicon (arm64)'
        : 'Intel (x86_64)';

    return {
      ...MACOS_DESKTOP_CONFIG,
      version,
      availabilityStatus: armVerified || x64Verified ? 'Available' : 'In Development',
      arm64InstallerUrl: armAsset ? (armAsset.browser_download_url as string) : '',
      arm64InstallerName: armAsset ? (armAsset.name as string) : '',
      arm64SizeBytes: armSize,
      arm64SizeLabel: formatInstallerSize(armSize),
      arm64Sha256: armSha,
      x64InstallerUrl: x64Asset ? (x64Asset.browser_download_url as string) : '',
      x64InstallerName: x64Asset ? (x64Asset.name as string) : '',
      x64SizeBytes: x64Size,
      x64SizeLabel: formatInstallerSize(x64Size),
      x64Sha256: x64Sha,
      sha256SumsUrl: sumsAsset ? (sumsAsset.browser_download_url as string) : '',
      releasePageUrl: typeof rawRel.html_url === 'string' ? rawRel.html_url : '',
      supportedArchitectures,
    };
  }

  return null;
}

const configuredMacVersion = readEnv('VITE_MACOS_RELEASE_VERSION') || '1.0.0';
const configuredMacArm64Url = readEnv('VITE_MACOS_ARM64_DMG_URL');
const configuredMacArm64Sha = readEnv('VITE_MACOS_ARM64_DMG_SHA256');
const parsedMacArm64Size = Number.parseInt(readEnv('VITE_MACOS_ARM64_DMG_SIZE_BYTES'), 10);
const configuredMacArm64SizeBytes =
  Number.isFinite(parsedMacArm64Size) && parsedMacArm64Size > 0 ? parsedMacArm64Size : null;

const configuredMacX64Url = readEnv('VITE_MACOS_X64_DMG_URL');
const configuredMacX64Sha = readEnv('VITE_MACOS_X64_DMG_SHA256');
const parsedMacX64Size = Number.parseInt(readEnv('VITE_MACOS_X64_DMG_SIZE_BYTES'), 10);
const configuredMacX64SizeBytes =
  Number.isFinite(parsedMacX64Size) && parsedMacX64Size > 0 ? parsedMacX64Size : null;

const configuredMacSumsUrl = readEnv('VITE_MACOS_SHA256SUMS_URL');
const configuredMacReleaseUrl = readEnv('VITE_MACOS_RELEASE_URL');

const hasVerifiedMacArm64 =
  isDirectGitHubReleaseAssetUrl(configuredMacArm64Url, GITHUB_REPOSITORY_URL, '.dmg') &&
  /^[a-f0-9]{64}$/i.test(configuredMacArm64Sha);
const hasVerifiedMacX64 =
  isDirectGitHubReleaseAssetUrl(configuredMacX64Url, GITHUB_REPOSITORY_URL, '.dmg') &&
  /^[a-f0-9]{64}$/i.test(configuredMacX64Sha);
const hasVerifiedMacBinary = hasVerifiedMacArm64 || hasVerifiedMacX64;

export const MACOS_DESKTOP_CONFIG: MacosDesktopReleaseConfig = {
  version: configuredMacVersion,
  availabilityStatus: hasVerifiedMacBinary ? 'Available' : 'In Development',
  arm64InstallerUrl: hasVerifiedMacArm64 ? configuredMacArm64Url : '',
  arm64InstallerName: hasVerifiedMacArm64
    ? configuredMacArm64Url.split('/').pop() || `SCRIBBLE-IT_${configuredMacVersion}_arm64.dmg`
    : '',
  arm64SizeBytes: hasVerifiedMacArm64 ? configuredMacArm64SizeBytes : null,
  arm64SizeLabel: hasVerifiedMacArm64 ? formatInstallerSize(configuredMacArm64SizeBytes) : '',
  arm64Sha256: hasVerifiedMacArm64 ? configuredMacArm64Sha.toLowerCase() : '',
  x64InstallerUrl: hasVerifiedMacX64 ? configuredMacX64Url : '',
  x64InstallerName: hasVerifiedMacX64
    ? configuredMacX64Url.split('/').pop() || `SCRIBBLE-IT_${configuredMacVersion}_x64.dmg`
    : '',
  x64SizeBytes: hasVerifiedMacX64 ? configuredMacX64SizeBytes : null,
  x64SizeLabel: hasVerifiedMacX64 ? formatInstallerSize(configuredMacX64SizeBytes) : '',
  x64Sha256: hasVerifiedMacX64 ? configuredMacX64Sha.toLowerCase() : '',
  sha256SumsUrl:
    hasVerifiedMacBinary && isConfiguredUrl(configuredMacSumsUrl) ? configuredMacSumsUrl : '',
  releasePageUrl:
    hasVerifiedMacBinary && isConfiguredUrl(configuredMacReleaseUrl) ? configuredMacReleaseUrl : '',
  supportedArchitectures:
    hasVerifiedMacArm64 && !hasVerifiedMacX64
      ? 'Apple Silicon (arm64)'
      : !hasVerifiedMacArm64 && hasVerifiedMacX64
      ? 'Intel (x86_64)'
      : 'Apple Silicon (arm64) & Intel (x86_64)',
  minimumOs: 'macOS 12 Monterey or newer',
  runtimeRequirement: 'Native Apple WebKit (WKWebView — included with macOS)',
  codeSigningStatus:
    'Unsigned / Not Notarized build (Apple Developer ID signing & notarization pending)',
  installGuideUrl: `${GITHUB_REPOSITORY_URL}/blob/main/docs/desktop/macos-installation-guide.md`,
  buildGuideUrl: `${GITHUB_REPOSITORY_URL}/blob/main/docs/desktop/macos-build-and-dev-guide.md`,
  securityGuideUrl: `${GITHUB_REPOSITORY_URL}/blob/main/docs/desktop/macos-security.md`,
  releaseNotesUrl: `${GITHUB_REPOSITORY_URL}/blob/main/docs/releases/macos-v1.0.0-release-notes.md`,
};

export interface LinuxDesktopReleaseConfig {
  version: string;
  availabilityStatus: 'Available' | 'In Development';
  debInstallerUrl: string;
  debInstallerName: string;
  debSizeBytes: number | null;
  debSizeLabel: string;
  debSha256: string;
  rpmInstallerUrl: string;
  rpmInstallerName: string;
  rpmSizeBytes: number | null;
  rpmSizeLabel: string;
  rpmSha256: string;
  appImageInstallerUrl: string;
  appImageInstallerName: string;
  appImageSizeBytes: number | null;
  appImageSizeLabel: string;
  appImageSha256: string;
  sha256SumsUrl: string;
  releasePageUrl: string;
  supportedArchitectures: string;
  supportedDistributions: string;
  minimumOs: string;
  runtimeRequirement: string;
  codeSigningStatus: string;
  installGuideUrl: string;
  buildGuideUrl: string;
  securityGuideUrl: string;
  releaseNotesUrl: string;
}

export function parseGitHubLinuxRelease(
  releasesPayload: unknown,
  repoUrl: string = GITHUB_REPOSITORY_URL
): LinuxDesktopReleaseConfig | null {
  if (!Array.isArray(releasesPayload)) return null;

  for (const rawRel of releasesPayload as GitHubReleaseLike[]) {
    if (!rawRel || rawRel.draft === true || !Array.isArray(rawRel.assets)) continue;
    const assets = rawRel.assets as GitHubReleaseAssetLike[];

    const debAsset = assets.find(
      a =>
        typeof a?.name === 'string' &&
        typeof a?.browser_download_url === 'string' &&
        typeof a?.size === 'number' &&
        a.size > 0 &&
        isDirectGitHubReleaseAssetUrl(a.browser_download_url, repoUrl, '.deb')
    );
    const rpmAsset = assets.find(
      a =>
        typeof a?.name === 'string' &&
        typeof a?.browser_download_url === 'string' &&
        typeof a?.size === 'number' &&
        a.size > 0 &&
        isDirectGitHubReleaseAssetUrl(a.browser_download_url, repoUrl, '.rpm')
    );
    const appImageAsset = assets.find(
      a =>
        typeof a?.name === 'string' &&
        typeof a?.browser_download_url === 'string' &&
        typeof a?.size === 'number' &&
        a.size > 0 &&
        isDirectGitHubReleaseAssetUrl(a.browser_download_url, repoUrl, '.appimage')
    );

    if (!debAsset && !rpmAsset && !appImageAsset) continue;

    const debSha = extractAssetSha256Digest(debAsset);
    const rpmSha = extractAssetSha256Digest(rpmAsset);
    const appImageSha = extractAssetSha256Digest(appImageAsset);

    const sumsAsset = assets.find(
      a =>
        typeof a?.name === 'string' &&
        (a.name === 'SHA256SUMS-linux.txt' || a.name === 'SHA256SUMS.txt') &&
        typeof a?.browser_download_url === 'string' &&
        isDirectGitHubReleaseAssetUrl(a.browser_download_url, repoUrl, '.txt')
    );

    const rawTag = typeof rawRel.tag_name === 'string' ? rawRel.tag_name.trim() : '';
    const version = rawTag.replace(/^(linux-)?v/i, '') || LINUX_DESKTOP_CONFIG.version;

    const debSize = debAsset && typeof debAsset.size === 'number' ? debAsset.size : null;
    const rpmSize = rpmAsset && typeof rpmAsset.size === 'number' ? rpmAsset.size : null;
    const appImageSize =
      appImageAsset && typeof appImageAsset.size === 'number' ? appImageAsset.size : null;

    const debVerified = Boolean(debAsset && debSha);
    const rpmVerified = Boolean(rpmAsset && rpmSha);
    const appImageVerified = Boolean(appImageAsset && appImageSha);

    const hasArm64 = [debAsset, rpmAsset, appImageAsset].some(
      a => typeof a?.name === 'string' && /(arm64|aarch64)/i.test(a.name)
    );
    const hasX64 = [debAsset, rpmAsset, appImageAsset].some(
      a => typeof a?.name === 'string' && /(amd64|x86_64|x64)/i.test(a.name)
    );

    const supportedArchitectures =
      hasArm64 && hasX64
        ? 'Linux x86_64 (amd64) & ARM64 (aarch64)'
        : hasArm64
        ? 'Linux ARM64 (aarch64)'
        : 'Linux x86_64 (64-bit amd64)';

    return {
      ...LINUX_DESKTOP_CONFIG,
      version,
      availabilityStatus:
        debVerified || rpmVerified || appImageVerified ? 'Available' : 'In Development',
      debInstallerUrl: debAsset ? (debAsset.browser_download_url as string) : '',
      debInstallerName: debAsset ? (debAsset.name as string) : '',
      debSizeBytes: debSize,
      debSizeLabel: formatInstallerSize(debSize),
      debSha256: debSha,
      rpmInstallerUrl: rpmAsset ? (rpmAsset.browser_download_url as string) : '',
      rpmInstallerName: rpmAsset ? (rpmAsset.name as string) : '',
      rpmSizeBytes: rpmSize,
      rpmSizeLabel: formatInstallerSize(rpmSize),
      rpmSha256: rpmSha,
      appImageInstallerUrl: appImageAsset ? (appImageAsset.browser_download_url as string) : '',
      appImageInstallerName: appImageAsset ? (appImageAsset.name as string) : '',
      appImageSizeBytes: appImageSize,
      appImageSizeLabel: formatInstallerSize(appImageSize),
      appImageSha256: appImageSha,
      sha256SumsUrl: sumsAsset ? (sumsAsset.browser_download_url as string) : '',
      releasePageUrl: typeof rawRel.html_url === 'string' ? rawRel.html_url : '',
      supportedArchitectures,
    };
  }

  return null;
}

const configuredLinuxVersion = readEnv('VITE_LINUX_RELEASE_VERSION') || '1.0.0';
const configuredLinuxDebUrl = readEnv('VITE_LINUX_DEB_URL');
const configuredLinuxDebSha = readEnv('VITE_LINUX_DEB_SHA256');
const parsedLinuxDebSize = Number.parseInt(readEnv('VITE_LINUX_DEB_SIZE_BYTES'), 10);
const configuredLinuxDebSizeBytes =
  Number.isFinite(parsedLinuxDebSize) && parsedLinuxDebSize > 0 ? parsedLinuxDebSize : null;

const configuredLinuxRpmUrl = readEnv('VITE_LINUX_RPM_URL');
const configuredLinuxRpmSha = readEnv('VITE_LINUX_RPM_SHA256');
const parsedLinuxRpmSize = Number.parseInt(readEnv('VITE_LINUX_RPM_SIZE_BYTES'), 10);
const configuredLinuxRpmSizeBytes =
  Number.isFinite(parsedLinuxRpmSize) && parsedLinuxRpmSize > 0 ? parsedLinuxRpmSize : null;

const configuredLinuxAppImageUrl = readEnv('VITE_LINUX_APPIMAGE_URL');
const configuredLinuxAppImageSha = readEnv('VITE_LINUX_APPIMAGE_SHA256');
const parsedLinuxAppImageSize = Number.parseInt(readEnv('VITE_LINUX_APPIMAGE_SIZE_BYTES'), 10);
const configuredLinuxAppImageSizeBytes =
  Number.isFinite(parsedLinuxAppImageSize) && parsedLinuxAppImageSize > 0
    ? parsedLinuxAppImageSize
    : null;

const configuredLinuxSumsUrl = readEnv('VITE_LINUX_SHA256SUMS_URL');
const configuredLinuxReleaseUrl = readEnv('VITE_LINUX_RELEASE_URL');

const hasVerifiedLinuxDeb =
  isDirectGitHubReleaseAssetUrl(configuredLinuxDebUrl, GITHUB_REPOSITORY_URL, '.deb') &&
  /^[a-f0-9]{64}$/i.test(configuredLinuxDebSha);
const hasVerifiedLinuxRpm =
  isDirectGitHubReleaseAssetUrl(configuredLinuxRpmUrl, GITHUB_REPOSITORY_URL, '.rpm') &&
  /^[a-f0-9]{64}$/i.test(configuredLinuxRpmSha);
const hasVerifiedLinuxAppImage =
  isDirectGitHubReleaseAssetUrl(configuredLinuxAppImageUrl, GITHUB_REPOSITORY_URL, '.appimage') &&
  /^[a-f0-9]{64}$/i.test(configuredLinuxAppImageSha);
const hasVerifiedLinuxBinary =
  hasVerifiedLinuxDeb || hasVerifiedLinuxRpm || hasVerifiedLinuxAppImage;

export const LINUX_DESKTOP_CONFIG: LinuxDesktopReleaseConfig = {
  version: configuredLinuxVersion,
  availabilityStatus: hasVerifiedLinuxBinary ? 'Available' : 'In Development',
  debInstallerUrl: hasVerifiedLinuxDeb ? configuredLinuxDebUrl : '',
  debInstallerName: hasVerifiedLinuxDeb
    ? configuredLinuxDebUrl.split('/').pop() || `SCRIBBLE-IT_${configuredLinuxVersion}_amd64.deb`
    : '',
  debSizeBytes: hasVerifiedLinuxDeb ? configuredLinuxDebSizeBytes : null,
  debSizeLabel: hasVerifiedLinuxDeb ? formatInstallerSize(configuredLinuxDebSizeBytes) : '',
  debSha256: hasVerifiedLinuxDeb ? configuredLinuxDebSha.toLowerCase() : '',
  rpmInstallerUrl: hasVerifiedLinuxRpm ? configuredLinuxRpmUrl : '',
  rpmInstallerName: hasVerifiedLinuxRpm
    ? configuredLinuxRpmUrl.split('/').pop() || `SCRIBBLE-IT-${configuredLinuxVersion}-1.x86_64.rpm`
    : '',
  rpmSizeBytes: hasVerifiedLinuxRpm ? configuredLinuxRpmSizeBytes : null,
  rpmSizeLabel: hasVerifiedLinuxRpm ? formatInstallerSize(configuredLinuxRpmSizeBytes) : '',
  rpmSha256: hasVerifiedLinuxRpm ? configuredLinuxRpmSha.toLowerCase() : '',
  appImageInstallerUrl: hasVerifiedLinuxAppImage ? configuredLinuxAppImageUrl : '',
  appImageInstallerName: hasVerifiedLinuxAppImage
    ? configuredLinuxAppImageUrl.split('/').pop() || `SCRIBBLE-IT_${configuredLinuxVersion}_amd64.AppImage`
    : '',
  appImageSizeBytes: hasVerifiedLinuxAppImage ? configuredLinuxAppImageSizeBytes : null,
  appImageSizeLabel: hasVerifiedLinuxAppImage
    ? formatInstallerSize(configuredLinuxAppImageSizeBytes)
    : '',
  appImageSha256: hasVerifiedLinuxAppImage ? configuredLinuxAppImageSha.toLowerCase() : '',
  sha256SumsUrl:
    hasVerifiedLinuxBinary && isConfiguredUrl(configuredLinuxSumsUrl)
      ? configuredLinuxSumsUrl
      : '',
  releasePageUrl:
    hasVerifiedLinuxBinary && isConfiguredUrl(configuredLinuxReleaseUrl)
      ? configuredLinuxReleaseUrl
      : '',
  supportedArchitectures: 'Linux x86_64 (64-bit amd64)',
  supportedDistributions: 'Ubuntu 22.04+ · Debian 12+ · Fedora · RHEL 9+ · AppImage',
  minimumOs: 'Ubuntu 22.04 LTS+ / Debian 12+ / Fedora / RHEL 9+ (x86_64, glibc 2.35+)',
  runtimeRequirement: 'WebKitGTK 4.1 (libwebkit2gtk-4.1-0) & GTK 3 (or Universal AppImage)',
  codeSigningStatus: 'SHA-256 checksum verified packages (GPG repository signing pending)',
  installGuideUrl: `${GITHUB_REPOSITORY_URL}/blob/main/docs/desktop/linux-installation-guide.md`,
  buildGuideUrl: `${GITHUB_REPOSITORY_URL}/blob/main/docs/desktop/linux-build-and-dev-guide.md`,
  securityGuideUrl: `${GITHUB_REPOSITORY_URL}/blob/main/docs/desktop/linux-security.md`,
  releaseNotesUrl: `${GITHUB_REPOSITORY_URL}/blob/main/docs/releases/linux-v1.0.0-release-notes.md`,
};



