import { describe, expect, it } from 'vitest';
import { longDate, ordinal, shortDate } from './dates.ts';

describe('ordinal', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [20, '20th'],
    [21, '21st'],
    [22, '22nd'],
    [23, '23rd'],
    [101, '101st'],
    [111, '111th'],
    [112, '112th'],
  ])('writes %i as %s', (n, expected) => {
    expect(ordinal(n)).toBe(expected);
  });
});

describe('longDate', () => {
  it('writes a calendar date as day and month name, with no timezone shift', () => {
    expect(longDate('2026-09-12')).toBe('12 September');
    expect(longDate('2026-11-01')).toBe('1 November');
    expect(longDate('2026-01-31')).toBe('31 January');
  });
});

describe('shortDate', () => {
  it('writes a calendar date as day and a three-letter month', () => {
    expect(shortDate('2026-09-28')).toBe('28 Sep');
    expect(shortDate('2026-04-02')).toBe('2 Apr');
  });
});
