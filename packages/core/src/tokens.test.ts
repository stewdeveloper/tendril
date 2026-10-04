import { describe, expect, it } from 'vitest';
import {
  colors,
  motion,
  radius,
  rarityColors,
  shadows,
  typeScale,
  verdictColors,
} from './tokens.ts';

describe('tokens', () => {
  it('match the UX brief exactly', () => {
    expect(colors.light).toMatchObject({
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
    });
    expect(colors.dark).toMatchObject({
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
    });
    expect(verdictColors.light).toEqual({
      unknown: '#5F6B66',
      none: '#2B6A45',
      mild: '#8A5A00',
      moderate: '#B3401F',
      severe: '#9B1C1C',
    });
    expect(verdictColors.dark).toEqual({
      unknown: '#B9C3BE',
      none: '#86CFA1',
      mild: '#E6B85C',
      moderate: '#F0A07F',
      severe: '#F2A3A3',
    });
    expect(rarityColors.light).toEqual({
      common: '#5E6E66',
      uncommon: '#2F7D6D',
      rare: '#3F5BA9',
      legendary: '#8C6A12',
    });
    expect(rarityColors.dark).toEqual({
      common: '#B4C0B9',
      uncommon: '#7FCDB9',
      rare: '#A9B8F0',
      legendary: '#E3C26A',
    });
  });
  it('type scale follows Dynamic Type defaults and never goes below 11 pt', () => {
    expect(typeScale.moment).toEqual({
      family: 'Fraunces',
      weight: '600',
      italic: false,
      size: 34,
      lineHeight: 41,
    });
    expect(typeScale.title).toEqual({
      family: 'Fraunces',
      weight: '600',
      italic: false,
      size: 28,
      lineHeight: 34,
    });
    expect(typeScale.heading).toEqual({
      family: 'Inter',
      weight: '600',
      italic: false,
      size: 20,
      lineHeight: 25,
    });
    expect(typeScale.body).toEqual({
      family: 'Inter',
      weight: '400',
      italic: false,
      size: 17,
      lineHeight: 22,
    });
    expect(typeScale.bodyStrong).toEqual({
      family: 'Inter',
      weight: '600',
      italic: false,
      size: 17,
      lineHeight: 22,
    });
    expect(typeScale.sub).toEqual({
      family: 'Inter',
      weight: '400',
      italic: false,
      size: 15,
      lineHeight: 21,
    });
    expect(typeScale.sci).toEqual({
      family: 'Inter',
      weight: '400',
      italic: true,
      size: 15,
      lineHeight: 20,
    });
    expect(typeScale.caption).toEqual({
      family: 'Inter',
      weight: '500',
      italic: false,
      size: 13,
      lineHeight: 18,
    });
    for (const v of Object.values(typeScale)) expect(v.size).toBeGreaterThanOrEqual(11);
  });
  it('shapes', () => {
    expect(radius).toEqual({ card: 16, button: 14, note: 14, input: 12, tile: 14, pill: 999 });
  });
  it('motion timing', () => {
    expect(motion).toEqual({ fast: 200, base: 250, slow: 300 });
  });
  it('shadow effects', () => {
    expect(shadows.floating).toBe('0 8px 24px rgba(29, 36, 32, 0.25)');
    expect(shadows.raised).toBe('0 4px 12px rgba(29, 36, 32, 0.18)');
    expect(shadows.popover).toBe('0 8px 24px rgba(29, 36, 32, 0.08)');
    expect(shadows.handle).toBe('0 2px 6px rgba(29, 36, 32, 0.2)');
  });
});
