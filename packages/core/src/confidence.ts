export type ConfidenceBand = 'very_likely' | 'likely' | 'not_sure';

/** Starting values from the UX brief; tune with real data. */
export const CONFIDENCE_THRESHOLDS = { veryLikely: 80, likely: 50 } as const;

const WORDS: Record<ConfidenceBand, 'Very likely' | 'Likely' | 'Not sure'> = {
  very_likely: 'Very likely',
  likely: 'Likely',
  not_sure: 'Not sure',
};

/** Whole percent from 0 to 100. Bad provider values clamp; NaN counts as 0. */
export function toPercent(probability: number): number {
  if (Number.isNaN(probability)) return 0;
  const clamped = Math.min(1, Math.max(0, probability));
  return Math.round(clamped * 100);
}

/** Band from the rounded percent, so the band always agrees with the number shown. */
export function bandFor(probability: number): ConfidenceBand {
  const percent = toPercent(probability);
  if (percent >= CONFIDENCE_THRESHOLDS.veryLikely) return 'very_likely';
  if (percent >= CONFIDENCE_THRESHOLDS.likely) return 'likely';
  return 'not_sure';
}

export function bandWord(band: ConfidenceBand): 'Very likely' | 'Likely' | 'Not sure' {
  return WORDS[band];
}

/** "Very likely, 94%": the word first, never a bare number. */
export function confidenceLabel(probability: number): string {
  return `${bandWord(bandFor(probability))}, ${toPercent(probability)}%`;
}

/** "Very likely, 94 percent", for VoiceOver and TalkBack. */
export function confidenceA11yLabel(probability: number): string {
  return `${bandWord(bandFor(probability))}, ${toPercent(probability)} percent`;
}
