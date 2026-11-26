/**
 * Numeric spacing, border widths, and corner radii tokens.
 * Numeric values work directly in React Native StyleSheet and map 1:1 to px in CSS/Tailwind.
 */
export const SPACING = {
  0: 0,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

export const BORDER_WIDTHS = {
  none: 0,
  hairline: 1,
  medium: 1.5,
  thick: 2,
} as const;

export const BORDER_RADII = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
} as const;

export const ELEVATION = {
  none: {
    css: 'none',
    native: { shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  },
  sm: {
    css: '0 1px 2px rgba(11, 31, 59, 0.08)',
    native: { shadowColor: '#0B1F3B', shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  },
  md: {
    css: '0 4px 12px rgba(11, 31, 59, 0.12)',
    native: { shadowColor: '#0B1F3B', shadowOpacity: 0.12, shadowRadius: 8, elevation: 3 },
  },
  lg: {
    css: '0 12px 32px rgba(11, 31, 59, 0.18)',
    native: { shadowColor: '#0B1F3B', shadowOpacity: 0.18, shadowRadius: 16, elevation: 6 },
  },
} as const;
