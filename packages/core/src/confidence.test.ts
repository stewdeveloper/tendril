import { describe, expect, it } from 'vitest';
import {
  bandFor,
  bandWord,
  confidenceA11yLabel,
  confidenceLabel,
  toPercent,
} from './confidence.ts';

describe('toPercent', () => {
  it('rounds to a whole percent', () => {
    expect(toPercent(0.94)).toBe(94);
    expect(toPercent(0.714)).toBe(71);
    expect(toPercent(0.795)).toBe(80);
  });
  it('clamps out-of-range and NaN values instead of throwing', () => {
    expect(toPercent(1.2)).toBe(100);
    expect(toPercent(-0.1)).toBe(0);
    expect(toPercent(Number.NaN)).toBe(0);
    expect(toPercent(Number.POSITIVE_INFINITY)).toBe(100);
  });
});

describe('bandFor', () => {
  it('uses 80% and 50% as the band edges', () => {
    expect(bandFor(0.94)).toBe('very_likely');
    expect(bandFor(0.8)).toBe('very_likely');
    expect(bandFor(0.79)).toBe('likely');
    expect(bandFor(0.5)).toBe('likely');
    expect(bandFor(0.49)).toBe('not_sure');
  });
  it('derives the band from the rounded percent so label and band agree', () => {
    expect(bandFor(0.795)).toBe('very_likely');
    expect(bandFor(0.4951)).toBe('likely');
    expect(bandFor(0.4949)).toBe('not_sure');
  });
  it('treats NaN as not sure', () => {
    expect(bandFor(Number.NaN)).toBe('not_sure');
  });
});

describe('labels', () => {
  it('puts the word first, then the percentage', () => {
    expect(confidenceLabel(0.94)).toBe('Very likely, 94%');
    expect(confidenceLabel(0.71)).toBe('Likely, 71%');
    expect(confidenceLabel(0.41)).toBe('Not sure, 41%');
    expect(confidenceLabel(0.795)).toBe('Very likely, 80%');
    expect(confidenceLabel(Number.NaN)).toBe('Not sure, 0%');
  });
  it('spells out percent for screen readers', () => {
    expect(confidenceA11yLabel(0.94)).toBe('Very likely, 94 percent');
  });
  it('maps bands to words', () => {
    expect(bandWord('very_likely')).toBe('Very likely');
    expect(bandWord('likely')).toBe('Likely');
    expect(bandWord('not_sure')).toBe('Not sure');
  });
});
