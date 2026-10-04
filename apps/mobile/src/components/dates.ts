import type { IsoDate } from '@tendril/core';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Calendar dates (YYYY-MM-DD) as a UTC day count, so no timezone or daylight-saving shift. */
function dayNumber(iso: IsoDate): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / MS_PER_DAY;
}

/** The device's calendar date as YYYY-MM-DD, for screens that don't pass `today`. */
export function deviceToday(now: Date = new Date()): IsoDate {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Whole days from `from` to `to` (negative when `to` is earlier); null for a malformed date. */
export function daysBetween(from: IsoDate, to: IsoDate): number | null {
  const a = dayNumber(from);
  const b = dayNumber(to);
  return a == null || b == null ? null : b - a;
}

/** "Monday". */
export function weekdayName(iso: IsoDate): string | null {
  const n = dayNumber(iso);
  // 1970-01-01, day 0, was a Thursday.
  return n == null ? null : (WEEKDAYS[(((n + 4) % 7) + 7) % 7] ?? null);
}

/** "20 Aug". */
export function dayMonth(iso: IsoDate): string | null {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[2])} ${MONTHS[Number(m[1]) - 1]}` : null;
}

/**
 * How long ago a past date was: "yesterday" for the day before `today`, else "20 Aug". Null when
 * the date is missing, malformed or not in the past.
 */
export function sinceLabel(iso: IsoDate | null, today: IsoDate): string | null {
  if (iso == null) return null;
  const diff = daysBetween(iso, today);
  if (diff == null || diff < 1) return null;
  return diff === 1 ? 'yesterday' : dayMonth(iso);
}
