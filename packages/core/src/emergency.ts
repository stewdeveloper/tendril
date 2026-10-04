export interface PoisonLine {
  name: string;
  phone: string;
  note: string;
}

/**
 * The animal poison line for a country. Only the US line is confirmed (ASPCA). Ireland and the EU
 * show the vet only until a line is confirmed. The fixture API and the Phase 2B server both call it.
 */
export function poisonLineFor(countryCode: string): PoisonLine | null {
  if (countryCode.toUpperCase() === 'US') {
    return {
      name: 'ASPCA Poison Control',
      phone: '(888) 426-4435',
      note: 'Open 24 hours. A fee may apply.',
    };
  }
  return null;
}
