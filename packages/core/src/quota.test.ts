import { describe, expect, it } from 'vitest';
import {
  formatResetDate,
  healthToggleLine,
  limitReachedBody,
  limitReachedLine,
  limitReachedTitle,
  QUOTA_LIMITS,
  quotaLeft,
  quotaMeterLabel,
} from './quota.ts';

describe('quota', () => {
  const free = {
    kind: 'identification',
    used: 3,
    limit: 10,
    resetsOn: '2026-11-01',
    plan: 'free',
  } as const;
  it('limits match the architecture doc', () => {
    expect(QUOTA_LIMITS).toEqual({
      free: { identification: 10, diagnosis: 1 },
      premium: { identification: 60, diagnosis: 10 },
    });
  });
  it('reads "7 of 10 left this month"', () => {
    expect(quotaLeft(free)).toBe(7);
    expect(quotaMeterLabel(free)).toBe('7 of 10 left this month');
  });
  it('never goes negative', () => {
    expect(quotaLeft({ ...free, used: 12 })).toBe(0);
    expect(quotaMeterLabel({ ...free, used: 12 })).toBe('0 of 10 left this month');
  });
  it('formats the reset date as day and month', () => {
    expect(formatResetDate('2026-11-01')).toBe('1 November');
    expect(formatResetDate('2027-01-31')).toBe('31 January');
  });
  it('limit lines differ for free and premium at its cap', () => {
    expect(limitReachedLine({ ...free, used: 10 })).toBe(
      "You've used your 10 free identifications this month. More arrive on 1 November, or get 60 a month with Premium.",
    );
    expect(limitReachedLine({ ...free, used: 60, limit: 60, plan: 'premium' })).toBe(
      "You've used your 60 identifications this month. More arrive on 1 November.",
    );
    expect(
      limitReachedLine({
        kind: 'diagnosis',
        used: 1,
        limit: 1,
        resetsOn: '2026-11-01',
        plan: 'free',
      }),
    ).toBe(
      "You've used this month's diagnosis. More arrive on 1 November, or get 10 a month with Premium.",
    );
  });
});

describe('limit reached title and body', () => {
  const free = {
    kind: 'identification',
    used: 3,
    limit: 10,
    resetsOn: '2026-11-01',
    plan: 'free',
  } as const;
  const diag = {
    kind: 'diagnosis',
    used: 1,
    limit: 1,
    resetsOn: '2026-11-01',
    plan: 'free',
  } as const;
  it('splits the free diagnosis line as frame 4r shows it', () => {
    expect(limitReachedTitle('diagnosis')).toBe("You've used this month's diagnosis");
    expect(limitReachedBody(diag)).toBe(
      'More arrive on 1 November, or get 10 a month with Premium.',
    );
  });
  it('titles the identification sheet "Limit reached" and keeps the whole sentence in the body', () => {
    expect(limitReachedTitle('identification')).toBe('Limit reached');
    expect(limitReachedBody({ ...free, used: 10 })).toBe(
      "You've used your 10 free identifications this month. More arrive on 1 November, or get 60 a month with Premium.",
    );
    expect(limitReachedBody({ ...free, used: 60, limit: 60, plan: 'premium' })).toBe(
      "You've used your 60 identifications this month. More arrive on 1 November.",
    );
  });
  it('titles a premium diagnosis cap with its count', () => {
    expect(limitReachedTitle('diagnosis', 'premium')).toBe(
      "You've used your 10 diagnoses this month",
    );
  });
  it('keeps the joined line for diagnoses, and the body alone for identifications', () => {
    expect(limitReachedLine(diag)).toBe(
      "You've used this month's diagnosis. More arrive on 1 November, or get 10 a month with Premium.",
    );
    expect(limitReachedLine({ ...free, used: 10 })).toBe(limitReachedBody({ ...free, used: 10 }));
  });
});

describe('healthToggleLine (the camera health toggle)', () => {
  const diagnosis = {
    kind: 'diagnosis',
    used: 0,
    limit: 1,
    resetsOn: '2026-11-01',
    plan: 'free',
  } as const;
  it('names the one free diagnosis it uses', () => {
    expect(healthToggleLine(diagnosis)).toBe('Uses your 1 diagnosis this month');
  });
  it('counts what is left for Premium', () => {
    expect(healthToggleLine({ ...diagnosis, plan: 'premium', limit: 10, used: 3 })).toBe(
      'Uses 1 of your 7 diagnoses this month',
    );
  });
  it('says so when the month is used up', () => {
    expect(healthToggleLine({ ...diagnosis, used: 1 })).toBe('Diagnosis used this month');
  });
});
