import type { RarityTier, Severity } from './toxicity.ts';

export type Scheme = 'light' | 'dark';

export interface ColorTokens {
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  primary: string;
  onPrimary: string;
  primaryTint: string;
  streak: string;
  /** Severe's colour, doubling as the danger colour for destructive buttons. */
  danger: string;
  /** Text on verdict chips and rarity badges. */
  onChip: string;
  hairline: string;
  divider: string;
  scrim: string;
  photoButton: string;
  pressedOverlay: string;
}

export const colors: Record<Scheme, ColorTokens> = {
  light: {
    background: '#FBFAF6',
    surface: '#FFFFFF',
    textPrimary: '#1D2420',
    textSecondary: '#56605A',
    border: '#7F8983',
    primary: '#2E6B4E',
    onPrimary: '#FFFFFF',
    primaryTint: '#E6F0EA',
    streak: '#A36100',
    danger: '#9B1C1C',
    onChip: '#FFFFFF',
    hairline: 'rgba(127,137,131,0.28)',
    divider: 'rgba(127,137,131,0.18)',
    scrim: 'rgba(18,23,20,0.45)',
    photoButton: 'rgba(18,23,20,0.6)',
    pressedOverlay: 'rgba(29,36,32,0.22)',
  },
  dark: {
    background: '#121714',
    surface: '#1B221E',
    textPrimary: '#E8EEEA',
    textSecondary: '#A9B5AE',
    border: '#69756E',
    primary: '#7BC79C',
    onPrimary: '#0E1A13',
    primaryTint: '#1E3328',
    streak: '#F2B35C',
    danger: '#F2A3A3',
    onChip: '#0E1A13',
    hairline: 'rgba(105,117,110,0.45)',
    divider: 'rgba(105,117,110,0.4)',
    scrim: 'rgba(18,23,20,0.45)',
    photoButton: 'rgba(18,23,20,0.6)',
    pressedOverlay: 'rgba(14,26,19,0.2)',
  },
};

export const verdictColors: Record<Scheme, Record<Severity, string>> = {
  light: {
    unknown: '#5F6B66',
    none: '#2B6A45',
    mild: '#8A5A00',
    moderate: '#B3401F',
    severe: '#9B1C1C',
  },
  dark: {
    unknown: '#B9C3BE',
    none: '#86CFA1',
    mild: '#E6B85C',
    moderate: '#F0A07F',
    severe: '#F2A3A3',
  },
};

export const rarityColors: Record<Scheme, Record<RarityTier, string>> = {
  light: { common: '#5E6E66', uncommon: '#2F7D6D', rare: '#3F5BA9', legendary: '#8C6A12' },
  dark: { common: '#B4C0B9', uncommon: '#7FCDB9', rare: '#A9B8F0', legendary: '#E3C26A' },
};

export type TypeVariant =
  'moment' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'sub' | 'sci' | 'caption';

export interface TypeStyle {
  family: 'Fraunces' | 'Inter';
  weight: '400' | '500' | '600';
  italic: boolean;
  size: number;
  lineHeight: number;
}

export const typeScale: Record<TypeVariant, TypeStyle> = {
  moment: { family: 'Fraunces', weight: '600', italic: false, size: 34, lineHeight: 41 },
  title: { family: 'Fraunces', weight: '600', italic: false, size: 28, lineHeight: 34 },
  heading: { family: 'Inter', weight: '600', italic: false, size: 20, lineHeight: 25 },
  body: { family: 'Inter', weight: '400', italic: false, size: 17, lineHeight: 22 },
  bodyStrong: { family: 'Inter', weight: '600', italic: false, size: 17, lineHeight: 22 },
  sub: { family: 'Inter', weight: '400', italic: false, size: 15, lineHeight: 21 },
  sci: { family: 'Inter', weight: '400', italic: true, size: 15, lineHeight: 20 },
  caption: { family: 'Inter', weight: '500', italic: false, size: 13, lineHeight: 18 },
};

/** 4 pt grid. */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 } as const;
export const radius = { card: 16, button: 14, note: 14, input: 12, tile: 14, pill: 999 } as const;
export const motion = { fast: 200, base: 250, slow: 300 } as const;

/** Drop shadows as CSS box-shadow strings: the floating snackbar and the raised Scan circle. */
export const shadows = {
  floating: '0 8px 24px rgba(29, 36, 32, 0.25)',
  raised: '0 4px 12px rgba(29, 36, 32, 0.18)',
} as const;
