import { describe, expect, it } from 'vitest';
import { isAtLeast13 } from './age.ts';

const today = { year: 2026, month: 10 };
describe('isAtLeast13', () => {
  it('allows anyone clearly 13 or over', () => {
    expect(isAtLeast13({ year: 1998, month: 9 }, today)).toBe(true);
    expect(isAtLeast13({ year: 2013, month: 9 }, today)).toBe(true);
  });
  it('blocks the 13th-birthday month because they may still be 12', () => {
    expect(isAtLeast13({ year: 2013, month: 10 }, today)).toBe(false);
  });
  it('blocks anyone younger', () => {
    expect(isAtLeast13({ year: 2013, month: 11 }, today)).toBe(false);
    expect(isAtLeast13({ year: 2020, month: 1 }, today)).toBe(false);
  });
  it('rejects impossible input as not old enough', () => {
    expect(isAtLeast13({ year: 2030, month: 1 }, today)).toBe(false);
    expect(isAtLeast13({ year: 1998, month: 13 }, today)).toBe(false);
  });
  it('rejects a month of zero and non-integer input', () => {
    expect(isAtLeast13({ year: 1998, month: 0 }, today)).toBe(false);
    expect(isAtLeast13({ year: 1998.5, month: 9 }, today)).toBe(false);
  });
  it('handles the year boundary: a January birth is clear by the following January', () => {
    expect(isAtLeast13({ year: 2013, month: 12 }, { year: 2026, month: 1 })).toBe(false);
    expect(isAtLeast13({ year: 2012, month: 12 }, { year: 2026, month: 1 })).toBe(true);
  });
});
