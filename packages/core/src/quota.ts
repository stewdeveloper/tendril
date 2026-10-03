import type { IsoDate, Plan, QuotaKind, QuotaState } from './domain.ts';

export const QUOTA_LIMITS: Record<Plan, Record<QuotaKind, number>> = {
  free: { identification: 10, diagnosis: 1 },
  premium: { identification: 60, diagnosis: 10 },
};

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function quotaLeft(q: QuotaState): number {
  return Math.max(0, q.limit - q.used);
}

export function quotaMeterLabel(q: QuotaState): string {
  return `${quotaLeft(q)} of ${q.limit} left this month`;
}

/** "1 November". Dates are calendar dates (YYYY-MM-DD), so no timezone conversion. */
export function formatResetDate(iso: IsoDate): string {
  const [, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1]}`;
}

export function limitReachedLine(q: QuotaState): string {
  const when = formatResetDate(q.resetsOn);
  const premiumLimit = QUOTA_LIMITS.premium[q.kind];
  if (q.kind === 'diagnosis') {
    return q.plan === 'premium'
      ? `You've used your ${q.limit} diagnoses this month. More arrive on ${when}.`
      : `You've used this month's diagnosis. More arrive on ${when}, or get ${premiumLimit} a month with Premium.`;
  }
  return q.plan === 'premium'
    ? `You've used your ${q.limit} identifications this month. More arrive on ${when}.`
    : `You've used your ${q.limit} free identifications this month. More arrive on ${when}, or get ${premiumLimit} a month with Premium.`;
}
