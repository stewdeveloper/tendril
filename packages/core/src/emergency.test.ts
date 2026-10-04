import { describe, expect, it } from 'vitest';
import {
  emergencyBody,
  isActionableDiagnosis,
  nonBreakingPhone,
  poisonLineFor,
} from './emergency.ts';

describe('poisonLineFor', () => {
  it('US gets the ASPCA line', () => {
    expect(poisonLineFor('US')).toEqual({
      name: 'ASPCA Poison Control',
      phone: '(888) 426-4435',
      note: 'Open 24 hours. A fee may apply.',
    });
  });
  it('is not fussy about case', () => {
    expect(poisonLineFor('us')?.name).toBe('ASPCA Poison Control');
  });
  it('Ireland and the EU show the vet only until a line is confirmed', () => {
    expect(poisonLineFor('IE')).toBeNull();
    expect(poisonLineFor('DE')).toBeNull();
    expect(poisonLineFor('')).toBeNull();
  });
});

describe('nonBreakingPhone', () => {
  it('keeps a number on one line: no-break spaces and hyphens', () => {
    expect(nonBreakingPhone('(888) 426-4435')).toBe('(888)\u00A0426\u20114435');
    expect(nonBreakingPhone('+353 1 478 0000')).toBe('+353\u00A01\u00A0478\u00A00000');
  });
});

describe('isActionableDiagnosis', () => {
  const change = { title: 'Pause watering', detail: 'Until two dry checks' };
  const result = (probability: number, planChange: typeof change | null) => ({
    id: 'd',
    conditionName: 'x',
    probability,
    explanation: 'x',
    planChange,
  });
  it('needs a change to the plan and a confidence above not sure', () => {
    expect(isActionableDiagnosis(result(0.72, change))).toBe(true);
    expect(isActionableDiagnosis(result(0.72, null))).toBe(false);
    expect(isActionableDiagnosis(result(0.34, change))).toBe(false);
  });
});

describe('emergencyBody', () => {
  const entry = (severity: 'none' | 'mild' | 'moderate' | 'severe', summary: string | null) => ({
    animal: 'cat' as const,
    severity,
    summary,
    symptoms: null,
    sourceName: 'ASPCA',
    sourceUrl: null,
  });
  const body = (toxicity: ReturnType<typeof entry> | null) =>
    emergencyBody({ animal: 'cat', petName: 'Miso', toxicity });
  it('a moderate summary stands alone, as in the frame', () => {
    expect(body(entry('moderate', 'Peace lily can irritate the mouth.'))).toBe(
      'Peace lily can irritate the mouth.',
    );
  });
  it('no known toxicity keeps the upset-stomach caveat even with a summary', () => {
    expect(body(entry('none', 'Spider plant is not known to harm cats.'))).toBe(
      'Spider plant is not known to harm cats. Eating any plant can still cause vomiting or an upset stomach.',
    );
  });
  it('severe says to call the vet', () => {
    expect(body(entry('severe', 'Lilies can cause kidney failure.'))).toBe(
      'Lilies can cause kidney failure. Call your vet now.',
    );
  });
  it('unknown, or no data, keeps the not reviewed line', () => {
    expect(body(null)).toBe('Not reviewed yet. Keep it away from Miso until we know more.');
  });
});
