import type { IsoDate } from './domain.ts';

/** The calendar date (YYYY-MM-DD) of an instant in a timezone. Unknown timezones fall back to UTC. */
export function localDate(now: Date, timeZone: string): IsoDate {
  const options = { year: 'numeric', month: '2-digit', day: '2-digit' } as const;
  try {
    return new Intl.DateTimeFormat('en-CA', { ...options, timeZone }).format(now);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { ...options, timeZone: 'UTC' }).format(now);
  }
}

/** `YYYY-MM` of an instant in a timezone. */
export function monthKey(now: Date, timeZone: string): string {
  return localDate(now, timeZone).slice(0, 7);
}

function parse(iso: IsoDate): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y: y!, m: m!, d: d! };
}

function fromUtc(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const { y, m, d } = parse(iso);
  return fromUtc(Date.UTC(y, m - 1, d + days));
}

/** First day of the month after `now`, in the timezone: when monthly quotas reset. */
export function nextMonthStart(now: Date, timeZone: string): IsoDate {
  const { y, m } = parse(localDate(now, timeZone));
  return fromUtc(Date.UTC(y, m, 1));
}

export function weekdayName(iso: IsoDate): string {
  const { y, m, d } = parse(iso);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}
