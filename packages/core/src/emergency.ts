import type { DiagnosisResult, ToxicityEntry } from './domain.ts';
import { bandFor } from './confidence.ts';
import { ANY_PLANT_CAVEAT, petCheckLine, type Animal } from './toxicity.ts';

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

/**
 * A phone number that never splits across lines: spaces become no-break spaces and hyphens
 * non-breaking hyphens, so "(888) 426-4435" wraps whole or not at all.
 */
export const nonBreakingPhone = (phone: string): string =>
  phone.replace(/ /g, '\u00A0').replace(/-/g, '\u2011');

/** A diagnosis worth acting on: it changes the plan, and its confidence is above "not sure". */
export const isActionableDiagnosis = (result: DiagnosisResult): boolean =>
  result.planChange != null && bandFor(result.probability) !== 'not_sure';

/**
 * The sentence under the pet emergency title. A summary stands alone, as in frame 4bh, but the
 * caveats stay: "no known toxicity" keeps the upset-stomach line, severe says to call the vet, and
 * a plant with no review says so.
 */
export function emergencyBody(input: {
  animal: Animal;
  petName: string | null;
  toxicity: ToxicityEntry | null;
}): string {
  const { toxicity } = input;
  const unreviewed = petCheckLine({
    animal: input.animal,
    severity: 'unknown',
    summary: null,
    sourceName: null,
    petName: input.petName,
  });
  if (!toxicity || input.animal === 'other' || toxicity.severity === 'unknown') return unreviewed;
  const text = toxicity.summary ?? toxicity.symptoms;
  if (toxicity.severity === 'none') {
    return text
      ? `${text} ${ANY_PLANT_CAVEAT}`
      : petCheckLine({ ...toxicity, animal: input.animal, petName: input.petName });
  }
  if (toxicity.severity === 'severe')
    return text ? `${text} Call your vet now.` : 'Call your vet now.';
  return text ?? petCheckLine({ ...toxicity, animal: input.animal, petName: input.petName });
}
