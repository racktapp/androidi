// Midnight Blue Theme for Rackt
export const Colors = {
  // Background
  background: '#070B16',
  surface: '#0E1730',
  surfaceElevated: '#141F3D',
  border: '#22304F',
  
  // Accent
  primary: '#1D4ED8',
  secondary: '#06B6D4',
  accentSoft: '#60A5FA',
  accentGold: '#C9AA6A',
  accentGoldDark: '#C5A460',
  accentGoldLight: '#E1C9A1',
  
  // Text
  textPrimary: '#EAF0F7',
  textMuted: '#9AA7B5',
  textDisabled: '#6B7A8C',
  
  // Status
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Typography = {
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  weights: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};
