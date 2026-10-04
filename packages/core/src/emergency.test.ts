import { describe, expect, it } from 'vitest';
import { poisonLineFor } from './emergency.ts';

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
