import { describe, expect, it } from 'vitest';
import { applyEffect, diagnosisEffect, planChangeCopy, type DiagnosisEffect } from './diagnosis.ts';
import { INITIAL_CARE_STATE, type CareState } from './state.ts';

const PAUSE = { kind: 'pause_watering', dryChecksNeeded: 2 } as const;
const BOOST = { kind: 'boost', factor: 0.8, cycles: 2 } as const;
const ADVICE = { kind: 'advice_only' } as const;

describe('diagnosis effects', () => {
  it('maps conditions to effects, case-insensitively', () => {
    expect(diagnosisEffect('Overwatering')).toEqual(PAUSE);
    expect(diagnosisEffect('underwatering')).toEqual(BOOST);
    expect(diagnosisEffect('Powdery mildew')).toEqual(ADVICE);
  });

  it('matches the real Plant.id v3 health-assessment names', () => {
    expect(diagnosisEffect('water excess or uneven watering')).toEqual(PAUSE);
    expect(diagnosisEffect('water deficiency')).toEqual(BOOST);
  });

  it("keeps the plan's own names as aliases", () => {
    for (const name of ['overwatering', 'root rot']) expect(diagnosisEffect(name)).toEqual(PAUSE);
    for (const name of ['underwatering', 'dehydration', 'water stress']) {
      expect(diagnosisEffect(name)).toEqual(BOOST);
    }
  });

  it('ignores case and stray whitespace', () => {
    expect(diagnosisEffect('  Water   Excess or Uneven  Watering ')).toEqual(PAUSE);
    expect(diagnosisEffect('WATER DEFICIENCY\n')).toEqual(BOOST);
    expect(diagnosisEffect('Root\tRot')).toEqual(PAUSE);
  });

  it('gives advice only for every other Plant.id condition, including the other watering-related ones', () => {
    for (const name of [
      'nutrient deficiency',
      'lack of light',
      'light excess',
      'senescence',
      'dry air',
      'root damage',
      'watering on the leaves',
      'inappropriate leaf rosette watering',
      'water spray liquid residue',
      'water-related issue',
      'sunburn',
      'Fungi',
    ]) {
      expect(diagnosisEffect(name)).toEqual(ADVICE);
    }
  });

  it('matches whole names only, never a fragment', () => {
    expect(diagnosisEffect('water')).toEqual(ADVICE);
    expect(diagnosisEffect('overwatering damage')).toEqual(ADVICE);
    expect(diagnosisEffect('not water deficiency')).toEqual(ADVICE);
  });

  it('gives advice only for an empty or non-string name', () => {
    expect(diagnosisEffect('')).toEqual(ADVICE);
    expect(diagnosisEffect(null as unknown as string)).toEqual(ADVICE);
    expect(diagnosisEffect(42 as unknown as string)).toEqual(ADVICE);
  });

  it('returns a fresh effect each time, so a caller cannot corrupt the next one', () => {
    const a = diagnosisEffect('overwatering');
    (a as { dryChecksNeeded: number }).dryChecksNeeded = 9;
    expect(diagnosisEffect('overwatering')).toEqual(PAUSE);
  });
});

describe('applyEffect', () => {
  it('applying the same effect twice is idempotent', () => {
    const e = diagnosisEffect('overwatering');
    expect(applyEffect(applyEffect(INITIAL_CARE_STATE, e), e)).toEqual(
      applyEffect(INITIAL_CARE_STATE, e),
    );
    const b = diagnosisEffect('underwatering');
    expect(applyEffect(applyEffect(INITIAL_CARE_STATE, b), b)).toEqual(
      applyEffect(INITIAL_CARE_STATE, b),
    );
  });

  it('pauses watering until two dry checks in a row', () => {
    expect(applyEffect(INITIAL_CARE_STATE, PAUSE).pause).toEqual({
      reason: 'overwatering',
      dryChecksNeeded: 2,
    });
  });

  it('re-applying a pause part-way through starts the two dry checks again', () => {
    const halfway: CareState = {
      ...INITIAL_CARE_STATE,
      pause: { reason: 'overwatering', dryChecksNeeded: 1 },
    };
    expect(applyEffect(halfway, PAUSE).pause?.dryChecksNeeded).toBe(2);
  });

  it('boosts the next two watering cycles by 0.8', () => {
    expect(applyEffect(INITIAL_CARE_STATE, BOOST).boost).toEqual({ factor: 0.8, cyclesLeft: 2 });
  });

  it('the latest of two opposite diagnoses wins', () => {
    const paused = applyEffect(INITIAL_CARE_STATE, PAUSE);
    const boosted = applyEffect(paused, BOOST);
    expect(boosted.pause).toBeNull();
    expect(boosted.boost).toEqual({ factor: 0.8, cyclesLeft: 2 });
    const pausedAgain = applyEffect(boosted, PAUSE);
    expect(pausedAgain.boost).toBeNull();
    expect(pausedAgain.pause).toEqual({ reason: 'overwatering', dryChecksNeeded: 2 });
  });

  it('advice only leaves the state alone', () => {
    const s: CareState = {
      ...INITIAL_CARE_STATE,
      learned: 1.2,
      boost: { factor: 0.8, cyclesLeft: 1 },
      lastCheckOn: '2026-10-01',
    };
    expect(applyEffect(s, ADVICE)).toEqual(s);
  });

  it('keeps everything the effect is not about, and never mutates its input', () => {
    const s: CareState = {
      learned: 1.4,
      pause: null,
      boost: null,
      lastCheckOn: '2026-10-01',
      lastWateredOn: '2026-09-25',
      checkBasis: { from: '2026-10-01', kind: 'recheck' },
    };
    const before = JSON.parse(JSON.stringify(s));
    const after = applyEffect(s, PAUSE);
    expect(s).toEqual(before);
    expect(after).toEqual({ ...s, pause: { reason: 'overwatering', dryChecksNeeded: 2 } });
  });
});

describe('planChangeCopy', () => {
  it('plan change copy matches the design', () => {
    expect(planChangeCopy(diagnosisEffect('overwatering'))).toEqual({
      title: 'Pause watering',
      detail: 'Until two dry checks in a row',
    });
    expect(planChangeCopy(diagnosisEffect('water deficiency'))).toEqual({
      title: 'Check sooner',
      detail: 'For the next two checks',
    });
    expect(planChangeCopy({ kind: 'advice_only' })).toBeNull();
  });
});

describe('applyEffect with a stored effect', () => {
  const stored = (e: object) => e as unknown as DiagnosisEffect;
  it('takes its numbers from the kind, never from the effect’s own fields', () => {
    for (const e of [
      { kind: 'pause_watering' },
      { kind: 'pause_watering', dryChecksNeeded: 99 },
      { kind: 'pause_watering', dryChecksNeeded: 'x' },
    ]) {
      expect(applyEffect(INITIAL_CARE_STATE, stored(e)).pause).toEqual({
        reason: 'overwatering',
        dryChecksNeeded: 2,
      });
    }
    for (const e of [
      { kind: 'boost' },
      { kind: 'boost', factor: 5, cycles: 1e6 },
      { kind: 'boost', factor: -1, cycles: 0 },
    ]) {
      expect(applyEffect(INITIAL_CARE_STATE, stored(e)).boost).toEqual({
        factor: 0.8,
        cyclesLeft: 2,
      });
    }
  });
  it('leaves the state alone for an unknown kind', () => {
    expect(applyEffect(INITIAL_CARE_STATE, stored({ kind: 'repot' }))).toEqual(INITIAL_CARE_STATE);
  });
});
