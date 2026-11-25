/**
 * Centralized Open-Source Project Identity & Configurable External URLs
 * for SCRIBBLE-IT 2.0 (Njure Tech, formerly Njure Group).
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
  productName: 'SCRIBBLE-IT 2.0',
  shortName: 'Scribble-IT',
  tagline: 'Enterprise IT Management. Open to Everyone.',
  organization: 'Njure Tech',
  formerOrganization: 'Njure Group',
  organizationFull: 'Njure Tech (formerly Njure Group)',
  founderName: 'NEEREJ S SURESAN',
  founderRole: 'Founder & CEO',
  founderAttribution: 'Developed by NEEREJ S SURESAN',
  founderAttributionSubline: 'Founder & CEO — Njure Tech (formerly Njure Group).',
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
