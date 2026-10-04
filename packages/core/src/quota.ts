import { longDate } from './dates.ts';
import type { IsoDate, Plan, QuotaKind, QuotaState } from './domain.ts';

export const QUOTA_LIMITS: Record<Plan, Record<QuotaKind, number>> = {
  free: { identification: 10, diagnosis: 1 },
  premium: { identification: 60, diagnosis: 10 },
};

export function quotaLeft(q: QuotaState): number {
  return Math.max(0, q.limit - q.used);
}

export function quotaMeterLabel(q: QuotaState): string {
  return `${quotaLeft(q)} of ${q.limit} left this month`;
}

/** "1 November". Dates are calendar dates (YYYY-MM-DD), so no timezone conversion. */
export function formatResetDate(iso: IsoDate): string {
  return longDate(iso);
}

/**
 * The heading of a limit-reached message. An identification cap is a sheet titled "Limit reached";
 * a diagnosis cap says what was used up (frame 4r).
 */
export function limitReachedTitle(
  kind: QuotaKind,
  plan: Plan = 'free',
  limit: number = QUOTA_LIMITS[plan][kind],
): string {
  if (kind === 'identification') return 'Limit reached';
  return plan === 'premium'
    ? `You've used your ${limit} diagnoses this month`
    : "You've used this month's diagnosis";
}

/** The sentence under a limit-reached heading: when more arrive, and what Premium adds. */
export function limitReachedBody(q: QuotaState): string {
  const when = formatResetDate(q.resetsOn);
  const premiumLimit = QUOTA_LIMITS.premium[q.kind];
  if (q.kind === 'diagnosis') {
    return q.plan === 'premium'
      ? `More arrive on ${when}.`
      : `More arrive on ${when}, or get ${premiumLimit} a month with Premium.`;
  }
  return q.plan === 'premium'
    ? `You've used your ${q.limit} identifications this month. More arrive on ${when}.`
    : `You've used your ${q.limit} free identifications this month. More arrive on ${when}, or get ${premiumLimit} a month with Premium.`;
}

/**
 * Title and body as one line, for places with no heading. An identification's title is only a
 * sheet heading, so its line is the body alone.
 */
export function limitReachedLine(q: QuotaState): string {
  const body = limitReachedBody(q);
  return q.kind === 'identification'
    ? body
    : `${limitReachedTitle(q.kind, q.plan, q.limit)}. ${body}`;
}
