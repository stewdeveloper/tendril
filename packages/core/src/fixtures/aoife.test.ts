import { describe, expect, it } from 'vitest';
import { aoife, plantdexCounts } from './aoife.ts';

describe('aoife fixture (UX brief sample data)', () => {
  it('has the household from the brief', () => {
    expect(aoife.profile.handle).toBe('aoifegrows');
    expect(aoife.household.pets.map((p) => [p.name, p.animal])).toEqual([
      ['Miso', 'cat'],
      ['Bran', 'dog'],
    ]);
  });
  it('has Monty, Spidey and Lily with Monty showing Unknown toxicity', () => {
    expect(aoife.plants.map((p) => [p.nickname, p.species.commonName, p.room])).toEqual([
      ['Monty', 'Swiss cheese plant', 'Living room'],
      ['Spidey', 'Spider plant', 'Kitchen'],
      ['Lily', 'Peace lily', 'Bedroom'],
    ]);
    const monty = aoife.plantDetails['monty'];
    expect(monty?.toxicity.every((t) => t.severity === 'unknown')).toBe(true);
  });
  it('has no closing date on the living plants, on their summaries or their details', () => {
    expect(aoife.plants.every((p) => p.status === 'alive' && p.statusOn === null)).toBe(true);
    expect(aoife.plantDetails['monty']?.statusOn).toBeNull();
  });
  it('has the quota, streaks, league and collection numbers', () => {
    expect(aoife.today.identifications).toMatchObject({
      used: 3,
      limit: 10,
      resetsOn: '2026-11-01',
      plan: 'free',
    });
    expect(aoife.today.streak).toMatchObject({ careDays: 12, discoveryWeeks: 3, freezesHeld: 1 });
    expect(aoife.today.league).toEqual({ rank: 4, of: 20, points: 340, daysLeft: 3 });
    expect(aoife.profile.plantdexCount).toBe(37);
    expect(aoife.sets.map((s) => [s.name, s.found, s.total])).toEqual([
      ['Irish hedgerow', 4, 8],
      ['Easy-care houseplants', 3, 6],
    ]);
  });
  it('has the peace lily scan result: very likely 94%, flamingo flower 3%', () => {
    const r = aoife.scanResults['peace-lily-very-likely'];
    expect(r?.suggestions.map((s) => [s.species.commonName, s.probability])).toEqual([
      ['Peace lily', 0.94],
      ['Flamingo flower', 0.03],
    ]);
  });
  it('peace lily toxicity matches the ASPCA lines', () => {
    const lily = aoife.speciesToxicity['peace-lily'];
    expect(lily?.find((t) => t.animal === 'cat')).toMatchObject({
      severity: 'moderate',
      summary: 'Peace lily can irritate the mouth and cause drooling and vomiting.',
      sourceName: 'ASPCA',
    });
  });
  it('has every key the Phase 1B screens look up', () => {
    const keys = (record: Record<string, unknown>) => Object.keys(record).sort();
    expect(keys(aoife.plantDetails)).toEqual(['fern-dead', 'lily-given-away', 'monty']);
    expect(keys(aoife.outcomes)).toEqual(['bluebell-held', 'foxglove-awarded', 'primrose-gallery']);
    expect(keys(aoife.scanResults)).toEqual([
      'error',
      'foxglove-find',
      'not-a-plant',
      'not-sure',
      'offline',
      'peace-lily-likely',
      'peace-lily-very-likely',
    ]);
    for (const slug of ['foxglove', 'bluebell', 'primrose', 'early-purple-orchid']) {
      expect(aoife.species[slug]?.id).toBe(slug);
    }
    expect(aoife.species['early-purple-orchid']?.sensitive).toBe(true);
    expect(aoife.households.map((h) => [h.id, h.name])).toEqual([
      ['our-flat', 'Our flat'],
      ['mams-house', 'Mam’s house'],
    ]);
    expect(aoife.label.code).toBe('PL-0001');
    expect(plantdexCounts).toEqual({ all: 37, houseplants: 21, wild: 16 });
    expect(aoife.today.tasks.map((t) => t.id)).toEqual(['t-monty', 't-spidey', 't-lily-water']);
  });
  it('has the points outcomes for awarded, held and gallery finds', () => {
    expect(aoife.outcomes['foxglove-awarded']).toEqual({
      pointsStatus: 'awarded',
      points: 40,
      noPointsReason: null,
      newToPlantdex: true,
      plantdexCount: 38,
      sets: [{ setId: 'irish-hedgerow', name: 'Irish hedgerow', found: 5, total: 8 }],
    });
    expect(aoife.outcomes['bluebell-held']).toMatchObject({ pointsStatus: 'held', points: 80 });
    expect(aoife.outcomes['primrose-gallery']).toMatchObject({
      pointsStatus: 'no_points',
      points: 0,
      noPointsReason: 'gallery',
    });
  });
  it('keeps the closed plants, streak calendar and set tiles consistent', () => {
    expect(aoife.plantDetails['lily-given-away']).toMatchObject({
      status: 'given_away',
      statusOn: '2026-09-12',
    });
    expect(aoife.plantDetails['fern-dead']).toMatchObject({
      nickname: 'Fern',
      status: 'dead',
      statusOn: '2026-08-20',
      deathCause: 'too dry',
    });
    const { calendar } = aoife.today.streak;
    expect(calendar).toHaveLength(28);
    expect(calendar.filter((d) => d === 'checked')).toHaveLength(12);
    expect(calendar.slice(-12).every((d) => d === 'checked')).toBe(true);
    for (const set of aoife.sets) {
      expect(set.tiles).toHaveLength(set.total);
      expect(set.tiles.filter((t) => t.found)).toHaveLength(set.found);
    }
  });
  it('shows Unknown, never a safe verdict, when the match is not sure', () => {
    const r = aoife.scanResults['not-sure'];
    expect(r?.toxicity.map((t) => [t.animal, t.severity])).toEqual([
      ['cat', 'unknown'],
      ['dog', 'unknown'],
    ]);
    expect(JSON.stringify(aoife)).not.toMatch(/\bsafe\b/i);
  });
});
