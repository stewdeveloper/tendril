import { describe, expect, it } from 'vitest';
import { addDays, localDate, monthKey, nextMonthStart, weekdayName } from './period.ts';

describe('period', () => {
  it('uses the user timezone for the calendar day and month', () => {
    const late = new Date('2026-10-31T23:30:00Z');
    // Ireland leaves summer time on 25 Oct 2026, so Dublin is UTC+0 and still on the 31st.
    expect(localDate(late, 'Europe/Dublin')).toBe('2026-10-31');
    expect(localDate(new Date('2026-07-31T23:30:00Z'), 'Europe/Dublin')).toBe('2026-08-01');
    expect(localDate(late, 'America/New_York')).toBe('2026-10-31');
    expect(monthKey(new Date('2026-11-01T03:00:00Z'), 'America/Los_Angeles')).toBe('2026-10');
  });
  it('falls back to UTC for an unknown timezone', () => {
    expect(localDate(new Date('2026-10-03T12:00:00Z'), 'Not/AZone')).toBe('2026-10-03');
  });
  it('finds next month start and weekday names', () => {
    expect(nextMonthStart(new Date('2026-10-03T12:00:00Z'), 'UTC')).toBe('2026-11-01');
    expect(nextMonthStart(new Date('2026-12-15T12:00:00Z'), 'UTC')).toBe('2027-01-01');
    expect(weekdayName('2026-10-09')).toBe('Friday');
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
  });
});
