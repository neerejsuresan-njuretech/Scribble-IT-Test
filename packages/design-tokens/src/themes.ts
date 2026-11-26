import { BRAND_COLORS, NEUTRAL_SCALE, SEMANTIC_PALETTE } from './colors';

export type BrandThemeMode = 'light' | 'dark';

export interface ThemeTokens {
  mode: BrandThemeMode;
  background: {
    canvas: string;
    surface: string;
    surfaceElevated: string;
    surfaceSubtle: string;
    brandHeader: string;
    overlay: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
    accent: string;
    link: string;
  };
  border: {
    subtle: string;
    default: string;
    strong: string;
    focus: string;
  };
  brand: {
    primary: string;
    primaryHover: string;
    accent: string;
    navy: string;
    surface: string;
    onPrimary: string;
  };
  semantic: {
    success: string;
    successSurface: string;
    warning: string;
    warningSurface: string;
    danger: string;
    dangerSurface: string;
    info: string;
    infoSurface: string;
  };
}

export const LIGHT_THEME: ThemeTokens = {
  mode: 'light',
  background: {
    canvas: BRAND_COLORS.surface,
    surface: NEUTRAL_SCALE[0],
    surfaceElevated: NEUTRAL_SCALE[0],
    surfaceSubtle: NEUTRAL_SCALE[100],
    brandHeader: BRAND_COLORS.deepNavy,
    overlay: 'rgba(11, 31, 59, 0.45)',
  },
  text: {
    primary: BRAND_COLORS.deepNavy,
    secondary: NEUTRAL_SCALE[600],
    muted: NEUTRAL_SCALE[500],
    inverse: NEUTRAL_SCALE[0],
    accent: BRAND_COLORS.njureBlue,
    link: '#006BE0',
  },
  border: {
    subtle: NEUTRAL_SCALE[100],
    default: NEUTRAL_SCALE[200],
    strong: NEUTRAL_SCALE[300],
    focus: BRAND_COLORS.njureBlue,
  },
  brand: {
    primary: BRAND_COLORS.njureBlue,
    primaryHover: '#006BE0',
    accent: BRAND_COLORS.accentCyan,
    navy: BRAND_COLORS.deepNavy,
    surface: BRAND_COLORS.surface,
    onPrimary: NEUTRAL_SCALE[0],
  },
  semantic: {
    success: SEMANTIC_PALETTE.success[600],
    successSurface: SEMANTIC_PALETTE.success[50],
    warning: SEMANTIC_PALETTE.warning[600],
    warningSurface: SEMANTIC_PALETTE.warning[50],
    danger: SEMANTIC_PALETTE.danger[600],
    dangerSurface: SEMANTIC_PALETTE.danger[50],
    info: BRAND_COLORS.njureBlue,
    infoSurface: SEMANTIC_PALETTE.info[50],
  },
};

export const DARK_THEME: ThemeTokens = {
  mode: 'dark',
  background: {
    canvas: NEUTRAL_SCALE[950],
    surface: BRAND_COLORS.deepNavy,
    surfaceElevated: NEUTRAL_SCALE[800],
    surfaceSubtle: '#0E2445',
    brandHeader: NEUTRAL_SCALE[950],
    overlay: 'rgba(7, 20, 38, 0.72)',
  },
  text: {
    primary: BRAND_COLORS.surface,
    secondary: NEUTRAL_SCALE[300],
    muted: NEUTRAL_SCALE[400],
    inverse: BRAND_COLORS.deepNavy,
    accent: BRAND_COLORS.accentCyan,
    link: '#45A6FF',
  },
  border: {
    subtle: '#152C4E',
    default: NEUTRAL_SCALE[700],
    strong: NEUTRAL_SCALE[600],
    focus: BRAND_COLORS.accentCyan,
  },
  brand: {
    primary: BRAND_COLORS.njureBlue,
    primaryHover: '#45A6FF',
    accent: BRAND_COLORS.accentCyan,
    navy: BRAND_COLORS.deepNavy,
    surface: BRAND_COLORS.surface,
    onPrimary: NEUTRAL_SCALE[0],
  },
  semantic: {
    success: '#34D399',
    successSurface: SEMANTIC_PALETTE.success[950],
    warning: '#FBBF24',
    warningSurface: SEMANTIC_PALETTE.warning[950],
    danger: '#F87171',
    dangerSurface: SEMANTIC_PALETTE.danger[950],
    info: BRAND_COLORS.accentCyan,
    infoSurface: SEMANTIC_PALETTE.info[950],
  },
};

export const THEMES: Record<BrandThemeMode, ThemeTokens> = {
  light: LIGHT_THEME,
  dark: DARK_THEME,
};

export function getThemeTokens(mode: BrandThemeMode): ThemeTokens {
  return THEMES[mode];
}
