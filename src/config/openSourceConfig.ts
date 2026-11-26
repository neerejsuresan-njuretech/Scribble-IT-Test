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
  expectedExtension: '.exe' | '.msi' | '.txt'
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

