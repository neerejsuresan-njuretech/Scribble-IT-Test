/**
 * Official SCRIBBLE-IT Brand Identity & Color System.
 * Strictly excludes version numbers from all visual brand metadata.
 */
export const SCRIBBLE_IT_BRAND = {
  productName: 'SCRIBBLE-IT',
  wordmark: 'Scribble IT',
  tagline: 'Enterprise IT Management. Open to Everyone.',
  organization: 'Njure Tech',
  formerOrganization: 'Njure Group',
  organizationFull: 'Njure Tech (formerly Njure Group)',
  productAttribution: 'A Njure Tech product.',
  developer: 'NEEREJ S SURESAN',
  designation: 'Founder & CEO — Njure Tech (formerly Njure Group).',
  officialWebsiteUrl: 'https://scribbleit.njuregroup.in',
  njureTechWebsiteUrl: 'https://tech.njuregroup.in',
  njureGroupWebsiteUrl: 'https://njuregroup.in',
} as const;

export const BRAND_COLORS = {
  deepNavy: '#0B1F3B',
  njureBlue: '#0A84FF',
  accentCyan: '#22D3EE',
  surface: '#F5F8FF',
} as const;

export const NEUTRAL_SCALE = {
  0: '#FFFFFF',
  50: '#F5F8FF',
  100: '#EAF0FA',
  200: '#D4DFEE',
  300: '#B0C2DC',
  400: '#7D95B8',
  500: '#556E94',
  600: '#374E70',
  700: '#213554',
  800: '#132744',
  900: '#0B1F3B',
  950: '#071426',
} as const;

export const BLUE_SCALE = {
  50: '#EEF6FF',
  100: '#D9ECFF',
  200: '#B5DCFF',
  300: '#82C5FF',
  400: '#45A6FF',
  500: '#0A84FF',
  600: '#006BE0',
  700: '#0054B8',
  800: '#054491',
  900: '#09356E',
} as const;

export const CYAN_SCALE = {
  50: '#ECFEFF',
  100: '#CFFAFE',
  200: '#A5F3FC',
  300: '#67E8F9',
  400: '#22D3EE',
  500: '#06B6D4',
  600: '#0891B2',
  700: '#0E7490',
  800: '#155E75',
  900: '#164E63',
} as const;

export const SEMANTIC_PALETTE = {
  success: {
    50: '#ECFDF5',
    500: '#10B981',
    600: '#059669',
    700: '#047857',
    950: '#052E1E',
  },
  warning: {
    50: '#FFFBEB',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
    950: '#3B2305',
  },
  danger: {
    50: '#FFF1F2',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
    950: '#3B0A11',
  },
  info: {
    50: '#EEF6FF',
    500: '#0A84FF',
    600: '#006BE0',
    700: '#0054B8',
    950: '#082247',
  },
} as const;

export type BrandColorKey = keyof typeof BRAND_COLORS;
