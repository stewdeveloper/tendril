import type { ConfidenceBand } from './confidence.ts';

export type Animal = 'cat' | 'dog' | 'other';
export type Severity = 'unknown' | 'none' | 'mild' | 'moderate' | 'severe';
export type RarityTier = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface PetCheckInput {
  animal: Animal;
  severity: Severity;
  /** Curated one-sentence summary, e.g. "Peace lily can irritate the mouth…". */
  summary: string | null;
  sourceName: string | null;
  petName: string | null;
}

const PLURAL: Record<Animal, 'Cats' | 'Dogs' | 'Other pets'> = {
  cat: 'Cats',
  dog: 'Dogs',
  other: 'Other pets',
};
const SINGULAR: Record<Animal, string> = { cat: 'cat', dog: 'dog', other: 'pet' };
const WORD: Record<Severity, string> = {
  unknown: 'Unknown',
  none: 'No known toxicity',
  mild: 'Mild',
  moderate: 'Moderate',
  severe: 'Severe',
};
const A11Y: Record<Severity, string> = {
  unknown: 'toxicity not reviewed yet',
  none: 'no known toxicity',
  mild: 'mild toxicity',
  moderate: 'moderate toxicity',
  severe: 'severe toxicity',
};

export function animalPlural(animal: Animal): 'Cats' | 'Dogs' | 'Other pets' {
  return PLURAL[animal];
}

export function severityWord(severity: Severity): string {
  return WORD[severity];
}

/** Toxicity data covers cats and dogs only; anything else, or missing data, is unknown, never safe. */
export function effectiveSeverity(animal: Animal, severity: Severity | undefined): Severity {
  if (animal === 'other' || severity === undefined) return 'unknown';
  return severity;
}

export function verdictChipLabel(animal: Animal, severity: Severity): string {
  return `${PLURAL[animal]}: ${WORD[effectiveSeverity(animal, severity)]}`;
}

export function verdictA11yLabel(animal: Animal, severity: Severity): string {
  return `${PLURAL[animal]}: ${A11Y[effectiveSeverity(animal, severity)]}`;
}

/** The one plain line under each pet's verdict chip, as written in the UX brief's Copy table. */
export function petCheckLine(input: PetCheckInput): string {
  const severity = effectiveSeverity(input.animal, input.severity);
  const plural = PLURAL[input.animal].toLowerCase();
  if (severity === 'unknown') {
    const trimmed = input.petName?.trim();
    const who = trimmed || `your ${SINGULAR[input.animal]}`;
    return `Not reviewed yet. Keep it away from ${who} until we know more.`;
  }
  if (severity === 'none') {
    const source = input.sourceName ? ` (${input.sourceName})` : '';
    return `No known toxicity to ${plural}${source}. Eating any plant can still cause vomiting or an upset stomach.`;
  }
  const parts = [`${WORD[severity]} for ${plural}.`];
  if (input.summary) parts.push(input.summary);
  if (severity === 'severe') parts.push('Call your vet now.');
  else if (input.sourceName) parts.push(`Source: ${input.sourceName}.`);
  return parts.join(' ');
}

export function likelyMatchNote(band: ConfidenceBand): string | null {
  return band === 'very_likely' ? null : 'This depends on the match. Confirm the plant to be sure.';
}
