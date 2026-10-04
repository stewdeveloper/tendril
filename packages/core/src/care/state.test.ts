import { describe, expect, it } from 'vitest';
import { INITIAL_CARE_STATE, parseCareState, type CareState } from './state.ts';

describe('INITIAL_CARE_STATE', () => {
  it('is a neutral state: no learning, no diagnosis, nothing recorded', () => {
    expect(INITIAL_CARE_STATE).toEqual({
      learned: 1,
      pause: null,
      boost: null,
      lastCheckOn: null,
      lastWateredOn: null,
      checkBasis: null,
    });
  });
  it('cannot be mutated by a careless caller', () => {
    expect(Object.isFrozen(INITIAL_CARE_STATE)).toBe(true);
  });
});

describe('parseCareState', () => {
  it('reads anything that is not an object as the initial state', () => {
    for (const json of [null, undefined, 'state', 42, true, [], [1, 2]]) {
      expect(parseCareState(json)).toEqual(INITIAL_CARE_STATE);
    }
  });

  it("reads the column default '{}' (every plant before Phase 3) as the initial state", () => {
    expect(parseCareState({})).toEqual(INITIAL_CARE_STATE);
  });

  it('returns a fresh object, never the frozen constant', () => {
    const s = parseCareState({});
    expect(s).not.toBe(INITIAL_CARE_STATE);
    expect(Object.isFrozen(s)).toBe(false);
  });

  it('round-trips a full state through JSON', () => {
    const full: CareState = {
      learned: 1.21,
      pause: { reason: 'overwatering', dryChecksNeeded: 1 },
      boost: { factor: 0.8, cyclesLeft: 2 },
      lastCheckOn: '2026-10-03',
      lastWateredOn: '2026-09-28',
      checkBasis: { from: '2026-10-03', kind: 'recheck' },
    };
    expect(parseCareState(JSON.parse(JSON.stringify(full)))).toEqual(full);
  });

  it('keeps the good fields of a partial or older shape and defaults the rest', () => {
    expect(parseCareState({ learned: 1.3 })).toEqual({ ...INITIAL_CARE_STATE, learned: 1.3 });
    expect(parseCareState({ lastCheckOn: '2026-10-01', somethingNew: { a: 1 } })).toEqual({
      ...INITIAL_CARE_STATE,
      lastCheckOn: '2026-10-01',
    });
  });

  it('clamps learned to 0.6..1.8 and defaults a non-number to 1', () => {
    expect(parseCareState({ learned: 5 }).learned).toBe(1.8);
    expect(parseCareState({ learned: 0.1 }).learned).toBe(0.6);
    for (const bad of [NaN, Infinity, '1.2', null, {}]) {
      expect(parseCareState({ learned: bad }).learned).toBe(1);
    }
  });

  it('drops a malformed pause, or one with no dry checks left', () => {
    const pause = (p: unknown) => parseCareState({ pause: p }).pause;
    expect(pause({ reason: 'overwatering', dryChecksNeeded: 2 })).toEqual({
      reason: 'overwatering',
      dryChecksNeeded: 2,
    });
    expect(pause({ reason: 'overwatering', dryChecksNeeded: 1.7 })).toEqual({
      reason: 'overwatering',
      dryChecksNeeded: 1,
    });
    for (const bad of [
      true,
      'paused',
      { reason: 'overwatering', dryChecksNeeded: 0 },
      { reason: 'overwatering', dryChecksNeeded: -1 },
      { reason: 'overwatering', dryChecksNeeded: '2' },
      { reason: 'overwatering' },
      { reason: 'pests', dryChecksNeeded: 2 },
      { dryChecksNeeded: 2 },
    ]) {
      expect(pause(bad)).toBeNull();
    }
  });

  it('drops a malformed boost, or one with no cycles left', () => {
    const boost = (b: unknown) => parseCareState({ boost: b }).boost;
    expect(boost({ factor: 0.8, cyclesLeft: 1 })).toEqual({ factor: 0.8, cyclesLeft: 1 });
    for (const bad of [
      0.8,
      { factor: 0.8, cyclesLeft: 0 },
      { factor: 0.8 },
      { factor: 0, cyclesLeft: 2 },
      { factor: -0.8, cyclesLeft: 2 },
      { factor: NaN, cyclesLeft: 2 },
      { factor: '0.8', cyclesLeft: 2 },
    ]) {
      expect(boost(bad)).toBeNull();
    }
  });

  it('keeps only real calendar dates', () => {
    expect(parseCareState({ lastWateredOn: '2028-02-29' }).lastWateredOn).toBe('2028-02-29');
    for (const bad of [
      '2026-02-29',
      '2026-02-30',
      '2026-13-01',
      '2026-1-5',
      '2026-10-03T00:00:00Z',
      20261003,
      '',
    ]) {
      expect(parseCareState({ lastCheckOn: bad, lastWateredOn: bad })).toEqual(INITIAL_CARE_STATE);
    }
  });

  it('keeps a check basis only with a real date and a known kind', () => {
    expect(
      parseCareState({ checkBasis: { from: '2026-10-01', kind: 'interval' } }).checkBasis,
    ).toEqual({
      from: '2026-10-01',
      kind: 'interval',
    });
    for (const bad of [
      { from: '2026-10-01', kind: 'soon' },
      { from: '2026-02-30', kind: 'interval' },
      { kind: 'recheck' },
      '2026-10-01',
    ]) {
      expect(parseCareState({ checkBasis: bad }).checkBasis).toBeNull();
    }
  });
});
