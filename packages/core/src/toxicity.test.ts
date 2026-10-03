import { describe, expect, it } from 'vitest';
import {
  animalPlural,
  effectiveSeverity,
  likelyMatchNote,
  petCheckLine,
  severityWord,
  verdictA11yLabel,
  verdictChipLabel,
} from './toxicity.ts';

describe('verdict labels', () => {
  it('names the animal, then the verdict word', () => {
    expect(verdictChipLabel('cat', 'moderate')).toBe('Cats: Moderate');
    expect(verdictChipLabel('dog', 'none')).toBe('Dogs: No known toxicity');
    expect(verdictChipLabel('cat', 'unknown')).toBe('Cats: Unknown');
    expect(verdictChipLabel('other', 'unknown')).toBe('Other pets: Unknown');
  });
  it('reads in full for screen readers and never says safe', () => {
    expect(verdictA11yLabel('cat', 'moderate')).toBe('Cats: moderate toxicity');
    expect(verdictA11yLabel('dog', 'severe')).toBe('Dogs: severe toxicity');
    expect(verdictA11yLabel('dog', 'none')).toBe('Dogs: no known toxicity');
    expect(verdictA11yLabel('cat', 'unknown')).toBe('Cats: toxicity not reviewed yet');
    for (const s of ['unknown', 'none', 'mild', 'moderate', 'severe'] as const) {
      expect(verdictA11yLabel('cat', s).toLowerCase()).not.toContain('safe');
      expect(severityWord(s).toLowerCase()).not.toContain('safe');
    }
  });
  it('pluralises animals', () => {
    expect(animalPlural('cat')).toBe('Cats');
    expect(animalPlural('dog')).toBe('Dogs');
    expect(animalPlural('other')).toBe('Other pets');
  });
});

describe('effectiveSeverity', () => {
  it('treats other pets and missing data as unknown, never as safe', () => {
    expect(effectiveSeverity('other', 'none')).toBe('unknown');
    expect(effectiveSeverity('cat', undefined)).toBe('unknown');
    expect(effectiveSeverity('dog', 'mild')).toBe('mild');
  });
});

describe('petCheckLine', () => {
  const lily = 'Peace lily can irritate the mouth and cause drooling and vomiting.';
  it('moderate and mild: severity, summary, source', () => {
    expect(
      petCheckLine({ animal: 'cat', severity: 'moderate', summary: lily, sourceName: 'ASPCA', petName: 'Miso' }),
    ).toBe('Moderate for cats. Peace lily can irritate the mouth and cause drooling and vomiting. Source: ASPCA.');
  });
  it('severe tells you to call the vet', () => {
    expect(
      petCheckLine({
        animal: 'cat',
        severity: 'severe',
        summary: 'Easter lily can cause kidney failure.',
        sourceName: 'ASPCA',
        petName: 'Miso',
      }),
    ).toBe('Severe for cats. Easter lily can cause kidney failure. Call your vet now.');
  });
  it('no known toxicity names the source and the general caveat', () => {
    expect(
      petCheckLine({ animal: 'cat', severity: 'none', summary: null, sourceName: 'ASPCA', petName: 'Miso' }),
    ).toBe('No known toxicity to cats (ASPCA). Eating any plant can still cause vomiting or an upset stomach.');
  });
  it('unknown uses the pet name, falling back to the animal, never null', () => {
    expect(
      petCheckLine({ animal: 'cat', severity: 'unknown', summary: null, sourceName: null, petName: 'Miso' }),
    ).toBe('Not reviewed yet. Keep it away from Miso until we know more.');
    expect(
      petCheckLine({ animal: 'dog', severity: 'unknown', summary: null, sourceName: null, petName: null }),
    ).toBe('Not reviewed yet. Keep it away from your dog until we know more.');
    expect(
      petCheckLine({ animal: 'other', severity: 'none', summary: null, sourceName: 'ASPCA', petName: null }),
    ).toBe('Not reviewed yet. Keep it away from your pet until we know more.');
  });
  it('falls back gracefully when a reviewed verdict has no summary or source', () => {
    const line = petCheckLine({ animal: 'dog', severity: 'mild', summary: null, sourceName: null, petName: 'Bran' });
    expect(line).toBe('Mild for dogs.');
    expect(line).not.toMatch(/null|undefined/);
  });
});

describe('likelyMatchNote', () => {
  it('only appears when the match is not very likely', () => {
    expect(likelyMatchNote('very_likely')).toBeNull();
    expect(likelyMatchNote('likely')).toBe('This depends on the match. Confirm the plant to be sure.');
    expect(likelyMatchNote('not_sure')).toBe('This depends on the match. Confirm the plant to be sure.');
  });
});
