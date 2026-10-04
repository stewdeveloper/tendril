import { describe, expect, it } from 'vitest';
import { baseIntervalDays, basicCheckIn, soilCheckRange } from './basic.ts';

describe('basic care schedule (free plan)', () => {
  it('derives the base interval from the Plant.id watering range', () => {
    expect(baseIntervalDays({ min: 1, max: 1 }, null)).toBe(10);
    expect(baseIntervalDays({ min: 2, max: 2 }, null)).toBe(7);
    expect(baseIntervalDays({ min: 2, max: 3 }, null)).toBe(4);
    expect(baseIntervalDays({ min: null, max: null }, null)).toBe(7);
    expect(baseIntervalDays({ min: 1, max: 1 }, 5)).toBe(5);
  });
  it('dry soil creates a watering task today; damp moves the check by 2 days', () => {
    expect(basicCheckIn({ today: '2026-10-03', soilDry: true, baseDays: 7 })).toEqual({
      waterTaskOn: '2026-10-03',
      nextCheckOn: '2026-10-10',
    });
    expect(basicCheckIn({ today: '2026-10-03', soilDry: false, baseDays: 7 })).toEqual({
      waterTaskOn: null,
      nextCheckOn: '2026-10-05',
    });
  });
  it('ignores an invalid override', () => {
    for (const bad of [0, -3, NaN, Infinity]) {
      expect(baseIntervalDays({ min: 1, max: 1 }, bad)).toBe(10);
    }
  });
  it('gives a soil check range of n-1 to n+1, never below 1', () => {
    expect(soilCheckRange(6)).toEqual({ min: 5, max: 7 });
    expect(soilCheckRange(1)).toEqual({ min: 1, max: 2 });
  });
});
