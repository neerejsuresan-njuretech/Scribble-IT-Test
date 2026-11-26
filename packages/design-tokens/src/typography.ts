/**
 * Cross-platform typography tokens compatible with Tailwind CSS (web/desktop)
 * and React Native StyleSheet (iOS/Android).
 */
export const FONT_FAMILIES = {
  /** CSS stacks for Web / Tauri */
  css: {
    sans: "'Inter', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    display: "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Space Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  /** Single primary font names for React Native */
  native: {
    sansRegular: 'Inter-Regular',
    sansMedium: 'Inter-Medium',
    sansSemiBold: 'Inter-SemiBold',
    sansBold: 'Inter-Bold',
    displaySemiBold: 'Manrope-SemiBold',
    displayBold: 'Manrope-Bold',
    displayExtraBold: 'Manrope-ExtraBold',
    monoRegular: 'SpaceMono-Regular',
  },
} as const;

export const FONT_WEIGHTS = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

export interface TypeScaleToken {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontWeight: '400' | '500' | '600' | '700' | '800';
}

export const TYPOGRAPHY_SCALE: Record<
  'display' | 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'bodySm' | 'label' | 'caption' | 'mono',
  TypeScaleToken
> = {
  display: { fontSize: 40, lineHeight: 48, letterSpacing: -0.8, fontWeight: '800' },
  h1: { fontSize: 32, lineHeight: 40, letterSpacing: -0.64, fontWeight: '700' },
  h2: { fontSize: 24, lineHeight: 32, letterSpacing: -0.48, fontWeight: '700' },
  h3: { fontSize: 18, lineHeight: 26, letterSpacing: -0.24, fontWeight: '600' },
  h4: { fontSize: 15, lineHeight: 22, letterSpacing: -0.15, fontWeight: '600' },
  body: { fontSize: 14, lineHeight: 22, letterSpacing: 0, fontWeight: '400' },
  bodySm: { fontSize: 13, lineHeight: 20, letterSpacing: 0, fontWeight: '400' },
  label: { fontSize: 12, lineHeight: 16, letterSpacing: 0.2, fontWeight: '600' },
  caption: { fontSize: 11, lineHeight: 16, letterSpacing: 0.3, fontWeight: '500' },
  mono: { fontSize: 12, lineHeight: 18, letterSpacing: 0, fontWeight: '500' },
};
