import { describe, expect, it } from 'vitest';
import { localDate } from '../period.ts';
import { baseIntervalDays, basicCheckIn } from './basic.ts';
import {
  decideAfterCheckIn,
  decideAfterWatering,
  intervalDays,
  recomputeNextCheck,
  season,
  usableWeather,
  type PlantFactors,
  type WeatherSummary,
} from './engine.ts';
import { INITIAL_CARE_STATE, type CareState } from './state.ts';

const factors = {
  wateringMin: 2,
  wateringMax: 2,
  intervalOverride: null,
  potMaterial: 'plastic',
  potSizeCm: 15,
  light: 'medium',
  drainage: 'yes',
  indoor: true,
} as const;
const NOW = new Date('2026-10-03T08:00:00Z');
const base = {
  plan: 'premium' as const,
  today: '2026-10-03',
  now: NOW,
  latitude: 53.3,
  factors,
  state: INITIAL_CARE_STATE,
  weather: null,
};
const outdoor = { ...factors, indoor: false };
/** A summary fetched two hours before NOW. */
const fresh = (rainNext48hMm: number, maxTempNext48hC: number): WeatherSummary => ({
  rainNext48hMm,
  maxTempNext48hC,
  fetchedAt: '2026-10-03T06:00:00Z',
});
const RAIN = fresh(8, 15);
const HEAT = fresh(0, 30);
const BOOSTED: CareState = { ...INITIAL_CARE_STATE, boost: { factor: 0.8, cyclesLeft: 2 } };
const PAUSED: CareState = {
  ...INITIAL_CARE_STATE,
  pause: { reason: 'overwatering', dryChecksNeeded: 2 },
};

describe('intervalDays', () => {
  it('free plan ignores factors and uses the base interval', () => {
    expect(
      intervalDays({
        ...base,
        plan: 'free',
        factors: { ...factors, potMaterial: 'terracotta', light: 'bright' },
      }),
    ).toBe(7);
  });
  it('premium multiplies factors and clamps to 2..21', () => {
    expect(intervalDays(base)).toBe(7); // shoulder season, all 1.0
    expect(
      intervalDays({
        ...base,
        factors: { ...factors, potMaterial: 'terracotta', light: 'bright', potSizeCm: 10 },
      }),
    ).toBe(4); // 7 × .85 × .85 × .8 = 4.046
    expect(
      intervalDays({
        ...base,
        today: '2027-01-10',
        factors: {
          ...factors,
          light: 'low',
          drainage: 'no',
          potSizeCm: 30,
          wateringMin: 1,
          wateringMax: 1,
        },
      }),
    ).toBe(21); // 10 × 1.25 × 1.2 × 1.2 × 1.35 = 24.3
  });
  it('all-unknown setup and no watering data still gives a sane interval', () => {
    const unknown = {
      wateringMin: null,
      wateringMax: null,
      intervalOverride: null,
      potMaterial: 'unknown',
      potSizeCm: null,
      light: 'unknown',
      drainage: 'unknown',
      indoor: true,
    } as const;
    const d = intervalDays({ ...base, factors: unknown });
    expect(d).toBe(7);
    expect(Number.isFinite(d)).toBe(true);
    expect(intervalDays({ ...base, plan: 'free', factors: unknown })).toBe(7);
  });
  it('outdoor premium plants respond to rain and heat; indoor plants do not', () => {
    expect(intervalDays({ ...base, factors: outdoor, weather: RAIN })).toBe(9);
    expect(intervalDays({ ...base, factors: outdoor, weather: HEAT })).toBe(6);
    expect(intervalDays({ ...base, factors: outdoor, weather: fresh(8, 30) })).toBe(8);
    expect(intervalDays({ ...base, weather: fresh(8, 30) })).toBe(7);
  });
  it('rain and heat thresholds are inclusive: 5 mm and 28 °C', () => {
    expect(intervalDays({ ...base, factors: outdoor, weather: fresh(5, 27.9) })).toBe(9);
    expect(intervalDays({ ...base, factors: outdoor, weather: fresh(4.9, 28) })).toBe(6);
  });

  it('clamps a very short interval to 2 days, and weather may then take it to 1 but never below', () => {
    const thirsty: PlantFactors = {
      ...outdoor,
      wateringMin: 3,
      wateringMax: 3,
      potMaterial: 'terracotta',
      light: 'bright',
      potSizeCm: 10,
    };
    const input = {
      ...base,
      today: '2026-07-15',
      factors: thirsty,
      state: { ...INITIAL_CARE_STATE, learned: 0.6 },
    };
    expect(intervalDays(input)).toBe(2); // 4 × .85 × .85 × .8 × .85 × .6 = 1.18
    expect(intervalDays({ ...input, weather: HEAT })).toBe(1);
  });
  it('weather may take the clamped 21 days up to 23', () => {
    const slow: PlantFactors = {
      ...outdoor,
      light: 'low',
      drainage: 'no',
      potSizeCm: 30,
      wateringMin: 1,
      wateringMax: 1,
    };
    expect(intervalDays({ ...base, today: '2027-01-10', factors: slow, weather: RAIN })).toBe(23);
  });

  it('ignores weather older than 24 hours, unreadable, or from the future', () => {
    const at = (fetchedAt: string) =>
      intervalDays({ ...base, factors: outdoor, weather: { ...RAIN, fetchedAt } });
    expect(at('2026-10-02T08:00:00Z')).toBe(9); // exactly 24 h old
    expect(at('2026-10-02T07:59:59.999Z')).toBe(7);
    expect(at('2026-09-30T08:00:00Z')).toBe(7);
    expect(at('2026-10-03T08:30:00Z')).toBe(9); // a little clock skew is fine
    expect(at('2026-10-03T09:00:01Z')).toBe(7);
    expect(at('yesterday')).toBe(7);
    expect(
      intervalDays({
        ...base,
        factors: outdoor,
        weather: { rainNext48hMm: 8, maxTempNext48hC: 15 } as WeatherSummary,
      }),
    ).toBe(7);
    expect(intervalDays({ ...base, now: new Date('nope'), factors: outdoor, weather: RAIN })).toBe(
      7,
    );
  });
  it('ignores weather it cannot read', () => {
    expect(
      intervalDays({
        ...base,
        factors: outdoor,
        weather: { ...RAIN, rainNext48hMm: NaN, maxTempNext48hC: NaN },
      }),
    ).toBe(7);
  });

  it('free plan ignores weather and learning', () => {
    expect(intervalDays({ ...base, plan: 'free', factors: outdoor, weather: RAIN })).toBe(7);
    expect(
      intervalDays({ ...base, plan: 'free', state: { ...INITIAL_CARE_STATE, learned: 1.8 } }),
    ).toBe(7);
  });
  it('a boost shortens the interval on both plans', () => {
    expect(intervalDays({ ...base, state: BOOSTED })).toBe(6); // 7 × .8 = 5.6
    expect(intervalDays({ ...base, plan: 'free', state: BOOSTED })).toBe(6);
    expect(
      intervalDays({
        ...base,
        plan: 'free',
        state: BOOSTED,
        factors: { ...factors, wateringMin: 1, wateringMax: 1 },
      }),
    ).toBe(8);
    expect(
      intervalDays({
        ...base,
        plan: 'free',
        state: BOOSTED,
        factors: { ...factors, wateringMin: 3, wateringMax: 3 },
      }),
    ).toBe(3);
  });
  it('a boost with no cycles left does nothing', () => {
    expect(
      intervalDays({
        ...base,
        state: { ...INITIAL_CARE_STATE, boost: { factor: 0.8, cyclesLeft: 0 } },
      }),
    ).toBe(7);
  });

  it('uses the season of the local date, by hemisphere, at the month boundaries', () => {
    const on = (today: string, latitude: number | null = 53.3) =>
      intervalDays({ ...base, today, latitude });
    expect(on('2026-05-31')).toBe(7);
    expect(on('2026-06-01')).toBe(6); // 7 × .85 = 5.95
    expect(on('2026-08-31')).toBe(6);
    expect(on('2026-09-01')).toBe(7);
    expect(on('2026-11-30')).toBe(7);
    expect(on('2026-12-01')).toBe(9); // 7 × 1.35 = 9.45
    expect(on('2027-02-28')).toBe(9);
    expect(on('2027-03-01')).toBe(7);
    expect(on('2026-07-15', -33)).toBe(9);
    expect(on('2026-12-01', -33)).toBe(6);
    expect(on('2026-01-15', null)).toBe(9);
  });

  it('clamps a learned multiplier that skipped parseCareState', () => {
    expect(intervalDays({ ...base, state: { ...INITIAL_CARE_STATE, learned: 5 } })).toBe(13); // 7 × 1.8 = 12.6
    expect(intervalDays({ ...base, state: { ...INITIAL_CARE_STATE, learned: NaN } })).toBe(7);
  });

  it('is always a whole number of days in 1..23 (free overrides up to 30), never NaN', () => {
    const waterings = [
      [null, null],
      [1, 1],
      [3, 3],
      [1, 3],
    ] as const;
    const seen = new Set<number>();
    for (const plan of ['free', 'premium'] as const)
      for (const potMaterial of ['plastic', 'terracotta', 'ceramic', 'unknown'] as const)
        for (const light of ['bright', 'medium', 'low', 'unknown'] as const)
          for (const drainage of ['yes', 'no', 'unknown'] as const)
            for (const potSizeCm of [null, 12, 13, 20, 21])
              for (const [wateringMin, wateringMax] of waterings)
                for (const intervalOverride of [null, 2, 30])
                  for (const today of ['2026-01-15', '2026-04-15', '2026-07-15'])
                    for (const learned of [0.6, 1.8])
                      for (const weather of [null, RAIN, HEAT]) {
                        const d = intervalDays({
                          ...base,
                          plan,
                          today,
                          weather,
                          state: { ...INITIAL_CARE_STATE, learned },
                          factors: {
                            wateringMin,
                            wateringMax,
                            intervalOverride,
                            potMaterial,
                            potSizeCm,
                            light,
                            drainage,
                            indoor: false,
                          },
                        });
                        expect(Number.isInteger(d)).toBe(true);
                        expect(d).toBeGreaterThanOrEqual(1);
                        expect(d).toBeLessThanOrEqual(plan === 'free' ? 30 : 23);
                        seen.add(d);
                      }
    expect(seen.has(1)).toBe(true);
    expect(seen.has(23)).toBe(true);
  });
});

describe('usableWeather', () => {
  it('is the weather only for a premium outdoor plant with a fresh summary', () => {
    expect(usableWeather({ ...base, factors: outdoor, weather: RAIN })).toEqual(RAIN);
    expect(usableWeather({ ...base, plan: 'free', factors: outdoor, weather: RAIN })).toBeNull();
    expect(usableWeather({ ...base, weather: RAIN })).toBeNull();
    expect(usableWeather({ ...base, factors: outdoor, weather: null })).toBeNull();
    expect(
      usableWeather({
        ...base,
        factors: outdoor,
        weather: { ...RAIN, fetchedAt: '2026-10-01T08:00:00Z' },
      }),
    ).toBeNull();
  });
});

describe('decideAfterCheckIn', () => {
  it('free: No moves the check 2 days, Yes waters today', () => {
    expect(
      decideAfterCheckIn({ ...base, plan: 'free', soilDry: false, dueOn: '2026-10-03' }),
    ).toMatchObject({ waterTaskOn: null, nextCheckOn: '2026-10-05' });
    expect(
      decideAfterCheckIn({ ...base, plan: 'free', soilDry: true, dueOn: '2026-10-03' }),
    ).toMatchObject({ waterTaskOn: '2026-10-03', nextCheckOn: '2026-10-10' });
  });
  it('premium learns: No lengthens, on-time Yes shortens, clamped', () => {
    const no = decideAfterCheckIn({ ...base, soilDry: false, dueOn: '2026-10-03' });
    expect(no.state.learned).toBeCloseTo(1.1);
    const yes = decideAfterCheckIn({ ...base, soilDry: true, dueOn: '2026-10-03' });
    expect(yes.state.learned).toBeCloseTo(0.95);
    const early = decideAfterCheckIn({ ...base, soilDry: true, dueOn: '2026-10-06' });
    expect(early.state.learned).toBe(1);
    let s = INITIAL_CARE_STATE;
    for (let i = 0; i < 20; i++)
      s = decideAfterCheckIn({ ...base, state: s, soilDry: false, dueOn: '2026-10-03' }).state;
    expect(s.learned).toBe(1.8);
  });
  it('premium learning floors at 0.6, a late Yes counts as on time, and no due date means no Yes learning', () => {
    let s = INITIAL_CARE_STATE;
    for (let i = 0; i < 30; i++)
      s = decideAfterCheckIn({ ...base, state: s, soilDry: true, dueOn: '2026-10-03' }).state;
    expect(s.learned).toBe(0.6);
    expect(
      decideAfterCheckIn({ ...base, soilDry: true, dueOn: '2026-09-28' }).state.learned,
    ).toBeCloseTo(0.95);
    expect(decideAfterCheckIn({ ...base, soilDry: true, dueOn: null }).state.learned).toBe(1);
    expect(decideAfterCheckIn({ ...base, soilDry: false, dueOn: null }).state.learned).toBeCloseTo(
      1.1,
    );
  });
  it('free never learns', () => {
    expect(
      decideAfterCheckIn({ ...base, plan: 'free', soilDry: false, dueOn: '2026-10-03' }).state
        .learned,
    ).toBe(1);
    expect(
      decideAfterCheckIn({ ...base, plan: 'free', soilDry: true, dueOn: '2026-10-03' }).state
        .learned,
    ).toBe(1);
  });
  it('premium: No rechecks after half the new interval, at least 2 days; Yes waits the new interval', () => {
    const no = decideAfterCheckIn({ ...base, soilDry: false, dueOn: '2026-10-03' });
    expect(no).toMatchObject({ waterTaskOn: null, intervalDays: 8, nextCheckOn: '2026-10-07' }); // 7 × 1.1 = 7.7 → 8, half is 4
    const yes = decideAfterCheckIn({ ...base, soilDry: true, dueOn: '2026-10-03' });
    expect(yes).toMatchObject({
      waterTaskOn: '2026-10-03',
      intervalDays: 7,
      nextCheckOn: '2026-10-10',
    }); // 7 × .95 = 6.65 → 7
    const thirsty: PlantFactors = {
      ...factors,
      wateringMin: 3,
      wateringMax: 3,
      potMaterial: 'terracotta',
      potSizeCm: 10,
    };
    const short = decideAfterCheckIn({
      ...base,
      factors: thirsty,
      soilDry: false,
      dueOn: '2026-10-03',
    });
    expect(short).toMatchObject({ intervalDays: 3, nextCheckOn: '2026-10-05' }); // 4 × .85 × .8 × 1.1 = 2.99 → 3, half rounds to 2
  });
  it('overwatering pause: dry answers create no water task until two dry checks in a row', () => {
    const first = decideAfterCheckIn({
      ...base,
      state: PAUSED,
      soilDry: true,
      dueOn: '2026-10-03',
    });
    expect(first.waterTaskOn).toBeNull();
    expect(first.state.pause?.dryChecksNeeded).toBe(1);
    const damp = decideAfterCheckIn({
      ...base,
      state: first.state,
      soilDry: false,
      dueOn: '2026-10-05',
    });
    expect(damp.state.pause?.dryChecksNeeded).toBe(2);
    const a = decideAfterCheckIn({
      ...base,
      state: damp.state,
      soilDry: true,
      dueOn: '2026-10-07',
    });
    const b = decideAfterCheckIn({ ...base, state: a.state, soilDry: true, dueOn: '2026-10-09' });
    expect(b.state.pause).toBeNull();
    expect(b.waterTaskOn).toBe('2026-10-03');
  });
  it('a paused dry check is a recheck, not a full interval', () => {
    const first = decideAfterCheckIn({
      ...base,
      state: PAUSED,
      soilDry: true,
      dueOn: '2026-10-03',
    });
    expect(first.nextCheckOn).toBe('2026-10-07'); // interval 7, half rounds to 4
    expect(first.state.checkBasis).toEqual({ from: '2026-10-03', kind: 'recheck' });
  });
  it('free: a pause followed by two dry checks waters on the second', () => {
    const first = decideAfterCheckIn({
      ...base,
      plan: 'free',
      state: PAUSED,
      soilDry: true,
      dueOn: '2026-10-03',
    });
    expect(first).toMatchObject({ waterTaskOn: null, nextCheckOn: '2026-10-05' });
    expect(first.state.pause).toEqual({ reason: 'overwatering', dryChecksNeeded: 1 });
    const second = decideAfterCheckIn({
      ...base,
      plan: 'free',
      today: '2026-10-05',
      state: first.state,
      soilDry: true,
      dueOn: '2026-10-05',
    });
    expect(second).toMatchObject({ waterTaskOn: '2026-10-05', nextCheckOn: '2026-10-12' });
    expect(second.state.pause).toBeNull();
    expect(second.state.checkBasis).toEqual({ from: '2026-10-05', kind: 'interval' });
  });
  it('records the check and how the next one was dated, but not a watering, and leaves a boost alone', () => {
    const watered: CareState = { ...BOOSTED, lastWateredOn: '2026-09-20' };
    for (const soilDry of [true, false]) {
      for (const plan of ['free', 'premium'] as const) {
        const d = decideAfterCheckIn({
          ...base,
          plan,
          state: watered,
          soilDry,
          dueOn: '2026-10-03',
        });
        expect(d.state.lastCheckOn).toBe('2026-10-03');
        expect(d.state.lastWateredOn).toBe('2026-09-20');
        expect(d.state.boost).toEqual({ factor: 0.8, cyclesLeft: 2 });
        expect(d.state.checkBasis).toEqual({
          from: '2026-10-03',
          kind: soilDry ? 'interval' : 'recheck',
        });
      }
    }
  });
  it('free with a boost waters and waits the boosted interval', () => {
    expect(
      decideAfterCheckIn({
        ...base,
        plan: 'free',
        state: BOOSTED,
        soilDry: true,
        dueOn: '2026-10-03',
      }),
    ).toMatchObject({ waterTaskOn: '2026-10-03', nextCheckOn: '2026-10-09', intervalDays: 6 });
  });
  it('never mutates the state it was given', () => {
    const s: CareState = { ...PAUSED, boost: null, learned: 1.2 };
    const before = JSON.parse(JSON.stringify(s));
    decideAfterCheckIn({ ...base, state: s, soilDry: true, dueOn: '2026-10-03' });
    decideAfterCheckIn({ ...base, state: s, soilDry: false, dueOn: '2026-10-03' });
    expect(s).toEqual(before);
  });

  it('free with no boost or pause gives exactly what basicCheckIn gives', () => {
    const days = [
      '2026-10-03',
      '2026-10-22',
      '2026-10-25',
      '2026-11-01',
      '2027-03-28',
      '2026-01-31',
      '2026-02-28',
      '2028-02-28',
      '2026-12-31',
    ];
    const waterings = [
      [null, null],
      [1, 1],
      [2, 2],
      [3, 3],
      [1, 2],
      [2, 3],
    ] as const;
    for (const today of days)
      for (const [wateringMin, wateringMax] of waterings)
        for (const intervalOverride of [null, 2, 9, 30])
          for (const soilDry of [true, false])
            for (const dueOn of [today, '2026-09-01', '2029-01-01', null]) {
              const f: PlantFactors = {
                ...factors,
                wateringMin,
                wateringMax,
                intervalOverride,
                potMaterial: 'terracotta',
                light: 'low',
                drainage: 'no',
                potSizeCm: 40,
                indoor: false,
              };
              const d = decideAfterCheckIn({
                ...base,
                plan: 'free',
                today,
                factors: f,
                weather: RAIN,
                state: { ...INITIAL_CARE_STATE, learned: 1.5 },
                soilDry,
                dueOn,
              });
              const expected = basicCheckIn({
                today,
                soilDry,
                baseDays: baseIntervalDays(
                  { min: wateringMin, max: wateringMax },
                  intervalOverride,
                ),
              });
              expect({ waterTaskOn: d.waterTaskOn, nextCheckOn: d.nextCheckOn }).toEqual(expected);
            }
  });

  it('dates cross the October clock change on the calendar, not by 24h steps', () => {
    expect(
      decideAfterCheckIn({
        ...base,
        plan: 'free',
        today: '2026-10-22',
        soilDry: true,
        dueOn: '2026-10-22',
      }).nextCheckOn,
    ).toBe('2026-10-29');
  });
  it('dates cross the March and November clock changes on the calendar', () => {
    expect(
      decideAfterCheckIn({
        ...base,
        plan: 'free',
        today: '2027-03-25',
        soilDry: true,
        dueOn: '2027-03-25',
      }).nextCheckOn,
    ).toBe('2027-04-01');
    expect(
      decideAfterCheckIn({
        ...base,
        plan: 'free',
        today: '2026-10-29',
        soilDry: true,
        dueOn: '2026-10-29',
      }).nextCheckOn,
    ).toBe('2026-11-05');
    expect(
      decideAfterCheckIn({
        ...base,
        plan: 'free',
        today: '2026-10-24',
        soilDry: false,
        dueOn: '2026-10-24',
      }).nextCheckOn,
    ).toBe('2026-10-26');
  });
  it('a local date taken on the clock-change day in the user’s timezone lands a week later on the calendar', () => {
    // Dublin falls back at 01:00 UTC on 25 Oct 2026; Sydney springs forward at 16:00 UTC on 3 Oct 2026.
    for (const [instant, tz, today, next] of [
      ['2026-10-24T23:30:00Z', 'Europe/Dublin', '2026-10-25', '2026-11-01'],
      ['2026-10-25T23:30:00Z', 'Europe/Dublin', '2026-10-25', '2026-11-01'],
      ['2026-10-03T14:30:00Z', 'Australia/Sydney', '2026-10-04', '2026-10-11'],
      ['2026-11-01T06:30:00Z', 'America/New_York', '2026-11-01', '2026-11-08'],
    ] as const) {
      const now = new Date(instant);
      expect(localDate(now, tz)).toBe(today);
      const d = decideAfterCheckIn({
        ...base,
        plan: 'free',
        now,
        today: localDate(now, tz),
        soilDry: true,
        dueOn: today,
      });
      expect(d.nextCheckOn).toBe(next);
    }
  });
  it('dates roll over month and year ends, including a leap day', () => {
    const free = (today: string, soilDry: boolean) =>
      decideAfterCheckIn({ ...base, plan: 'free', today, soilDry, dueOn: today }).nextCheckOn;
    expect(free('2026-01-31', true)).toBe('2026-02-07');
    expect(free('2026-02-28', false)).toBe('2026-03-02');
    expect(free('2028-02-28', false)).toBe('2028-03-01');
    expect(free('2028-02-29', true)).toBe('2028-03-07');
    expect(free('2026-12-30', true)).toBe('2027-01-06');
    expect(free('2026-04-30', false)).toBe('2026-05-02');
  });
  it('an all-unknown premium plant still gets a real next check', () => {
    const unknown = {
      wateringMin: null,
      wateringMax: null,
      intervalOverride: null,
      potMaterial: 'unknown',
      potSizeCm: null,
      light: 'unknown',
      drainage: 'unknown',
      indoor: false,
    } as const;
    for (const soilDry of [true, false]) {
      const d = decideAfterCheckIn({
        ...base,
        factors: unknown,
        latitude: null,
        soilDry,
        dueOn: null,
      });
      expect(d.nextCheckOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isInteger(d.intervalDays)).toBe(true);
    }
  });
});

describe('decideAfterWatering', () => {
  it('records the watering and waits one interval from it', () => {
    const s: CareState = { ...INITIAL_CARE_STATE, learned: 1.2, lastCheckOn: '2026-10-03' };
    const w = decideAfterWatering({ ...base, today: '2026-10-04', state: s });
    expect(w.nextCheckOn).toBe('2026-10-12'); // 7 × 1.2 = 8.4 → 8
    expect(w.state).toEqual({
      ...s,
      lastWateredOn: '2026-10-04',
      checkBasis: { from: '2026-10-04', kind: 'interval' },
    });
  });
  it('boost cycles run out after two waterings, then the interval goes back to normal', () => {
    for (const plan of ['free', 'premium'] as const) {
      const w1 = decideAfterWatering({ ...base, plan, today: '2026-10-04', state: BOOSTED });
      expect(w1.state.boost).toEqual({ factor: 0.8, cyclesLeft: 1 });
      expect(w1.nextCheckOn).toBe('2026-10-10');
      const w2 = decideAfterWatering({ ...base, plan, today: '2026-10-10', state: w1.state });
      expect(w2.state.boost).toBeNull();
      expect(w2.nextCheckOn).toBe('2026-10-17');
    }
  });
  it('check-ins between waterings do not use up a boost cycle', () => {
    let s = BOOSTED;
    for (const soilDry of [false, false, true])
      s = decideAfterCheckIn({ ...base, state: s, soilDry, dueOn: '2026-10-03' }).state;
    expect(s.boost).toEqual({ factor: 0.8, cyclesLeft: 2 });
    expect(decideAfterWatering({ ...base, state: s }).state.boost).toEqual({
      factor: 0.8,
      cyclesLeft: 1,
    });
  });
  it('leaves a pause, learning and the last check alone, and never mutates its input', () => {
    const s: CareState = { ...PAUSED, learned: 1.3, lastCheckOn: '2026-10-01' };
    const before = JSON.parse(JSON.stringify(s));
    const w = decideAfterWatering({ ...base, state: s });
    expect(s).toEqual(before);
    expect(w.state.pause).toEqual(s.pause);
    expect(w.state.learned).toBe(1.3);
    expect(w.state.lastCheckOn).toBe('2026-10-01');
  });
});

describe('recomputeNextCheck', () => {
  const since = (from: string, kind: 'interval' | 'recheck' = 'interval'): CareState => ({
    ...INITIAL_CARE_STATE,
    checkBasis: { from, kind },
  });

  it('never re-dates a check that is already due or overdue', () => {
    for (const openCheckOn of ['2026-10-03', '2026-10-01', '2026-09-01']) {
      const r = recomputeNextCheck({
        ...base,
        factors: outdoor,
        weather: RAIN,
        state: since('2026-09-26'),
        openCheckOn,
      });
      expect(r).toMatchObject({ nextCheckOn: openCheckOn, changed: false });
    }
  });
  it('re-dates a future check from how it was dated, with fresh weather', () => {
    const input = {
      ...base,
      factors: outdoor,
      state: since('2026-09-30'),
      openCheckOn: '2026-10-07',
    };
    expect(recomputeNextCheck({ ...input, weather: RAIN })).toMatchObject({
      nextCheckOn: '2026-10-09',
      changed: true,
      intervalDays: 9,
    });
    expect(recomputeNextCheck({ ...input, weather: HEAT })).toMatchObject({
      nextCheckOn: '2026-10-06',
      changed: true,
      intervalDays: 6,
    });
    expect(recomputeNextCheck({ ...input, weather: null })).toMatchObject({
      nextCheckOn: '2026-10-07',
      changed: false,
    });
  });
  it('ignores stale weather', () => {
    const stale = { ...RAIN, fetchedAt: '2026-10-01T20:00:00Z' };
    expect(
      recomputeNextCheck({
        ...base,
        factors: outdoor,
        weather: stale,
        state: since('2026-09-30'),
        openCheckOn: '2026-10-07',
      }),
    ).toMatchObject({ nextCheckOn: '2026-10-07', changed: false });
  });
  it('free ignores weather when re-dating', () => {
    expect(
      recomputeNextCheck({
        ...base,
        plan: 'free',
        factors: outdoor,
        weather: RAIN,
        state: since('2026-09-30'),
        openCheckOn: '2026-10-07',
      }),
    ).toMatchObject({ nextCheckOn: '2026-10-07', changed: false });
  });
  it('never moves a check earlier than tomorrow', () => {
    const r = recomputeNextCheck({
      ...base,
      state: since('2026-09-20'),
      openCheckOn: '2026-10-11',
    });
    expect(r).toMatchObject({ nextCheckOn: '2026-10-04', changed: true });
    const boosted = { ...BOOSTED, checkBasis: { from: '2026-09-27', kind: 'interval' as const } };
    expect(
      recomputeNextCheck({ ...base, plan: 'free', state: boosted, openCheckOn: '2026-10-04' }),
    ).toMatchObject({ nextCheckOn: '2026-10-04', changed: false });
  });
  it('re-dates a recheck as a recheck', () => {
    expect(
      recomputeNextCheck({
        ...base,
        plan: 'free',
        factors: outdoor,
        state: since('2026-10-02', 'recheck'),
        openCheckOn: '2026-10-04',
      }),
    ).toMatchObject({ nextCheckOn: '2026-10-04', changed: false });
    const premium = {
      ...base,
      factors: outdoor,
      state: since('2026-10-01', 'recheck'),
      openCheckOn: '2026-10-05',
    };
    expect(recomputeNextCheck(premium)).toMatchObject({
      nextCheckOn: '2026-10-05',
      changed: false,
    }); // half of 7, rounded
    expect(recomputeNextCheck({ ...premium, weather: RAIN })).toMatchObject({
      nextCheckOn: '2026-10-06',
      changed: true,
    }); // half of 9, rounded
  });
  it('applying a boost brings the open check forward, on Free too', () => {
    const s = { ...BOOSTED, checkBasis: { from: '2026-10-01', kind: 'interval' as const } };
    for (const plan of ['free', 'premium'] as const) {
      expect(
        recomputeNextCheck({ ...base, plan, state: s, openCheckOn: '2026-10-08' }),
      ).toMatchObject({ nextCheckOn: '2026-10-07', changed: true });
    }
  });
  it('is a no-op straight after any decision', () => {
    for (const plan of ['free', 'premium'] as const)
      for (const state of [INITIAL_CARE_STATE, PAUSED, BOOSTED])
        for (const soilDry of [true, false]) {
          const input = { ...base, plan, factors: outdoor, weather: RAIN, state };
          const d = decideAfterCheckIn({ ...input, soilDry, dueOn: '2026-10-03' });
          const r = recomputeNextCheck({ ...input, state: d.state, openCheckOn: d.nextCheckOn });
          expect(r).toEqual({
            nextCheckOn: d.nextCheckOn,
            changed: false,
            state: d.state,
            intervalDays: d.intervalDays,
          });
          const w = decideAfterWatering({ ...input, state: d.state });
          expect(
            recomputeNextCheck({ ...input, state: w.state, openCheckOn: w.nextCheckOn }),
          ).toMatchObject({ nextCheckOn: w.nextCheckOn, changed: false, state: w.state });
        }
  });
  it('a plant never checked in is taken to be dated one base interval from setup, and the basis is kept so it never drifts', () => {
    const premium: PlantFactors = { ...factors, potMaterial: 'terracotta', light: 'bright' }; // 7 × .85 × .85 = 5.06 → 5
    const first = recomputeNextCheck({ ...base, factors: premium, openCheckOn: '2026-10-08' }); // set up 1 Oct, first check one base interval (7) later
    expect(first).toMatchObject({ nextCheckOn: '2026-10-06', changed: true });
    expect(first.state.checkBasis).toEqual({ from: '2026-10-01', kind: 'interval' });
    const second = recomputeNextCheck({
      ...base,
      factors: premium,
      state: first.state,
      openCheckOn: first.nextCheckOn,
    });
    expect(second).toMatchObject({ nextCheckOn: '2026-10-06', changed: false });
    const nextDay = recomputeNextCheck({
      ...base,
      today: '2026-10-04',
      now: new Date('2026-10-04T08:00:00Z'),
      factors: premium,
      state: second.state,
      openCheckOn: second.nextCheckOn,
    });
    expect(nextDay).toMatchObject({ nextCheckOn: '2026-10-06', changed: false });
  });
  it('a new plant with a boost from the camera health check gets its first check sooner', () => {
    const r = recomputeNextCheck({
      ...base,
      plan: 'free',
      state: BOOSTED,
      openCheckOn: '2026-10-10',
    });
    expect(r).toMatchObject({ nextCheckOn: '2026-10-09', changed: true });
  });
  it('dates a missing open check from the basis, or one interval from today', () => {
    expect(
      recomputeNextCheck({ ...base, state: since('2026-09-30'), openCheckOn: null }),
    ).toMatchObject({ nextCheckOn: '2026-10-07', changed: true });
    const none = recomputeNextCheck({ ...base, openCheckOn: null });
    expect(none).toMatchObject({ nextCheckOn: '2026-10-10', changed: true });
    expect(none.state.checkBasis).toEqual({ from: '2026-10-03', kind: 'interval' });
  });
  it('leaves the state alone when nothing needed inferring', () => {
    const s = since('2026-09-30');
    expect(recomputeNextCheck({ ...base, state: s, openCheckOn: '2026-10-07' }).state).toBe(s);
    expect(recomputeNextCheck({ ...base, openCheckOn: '2026-10-01' }).state).toBe(
      INITIAL_CARE_STATE,
    );
  });
});

describe('season', () => {
  it('northern by default, southern when latitude is negative', () => {
    expect(season(7, 53)).toBe('summer');
    expect(season(1, null)).toBe('winter');
    expect(season(7, -33)).toBe('winter');
    expect(season(4, 10)).toBe('shoulder');
  });
  it('covers every month in both hemispheres; the equator counts as northern', () => {
    const north = [
      'winter',
      'winter',
      'shoulder',
      'shoulder',
      'shoulder',
      'summer',
      'summer',
      'summer',
      'shoulder',
      'shoulder',
      'shoulder',
      'winter',
    ];
    const south = [
      'summer',
      'summer',
      'shoulder',
      'shoulder',
      'shoulder',
      'winter',
      'winter',
      'winter',
      'shoulder',
      'shoulder',
      'shoulder',
      'summer',
    ];
    for (let m = 1; m <= 12; m++) {
      expect(season(m, 51.5)).toBe(north[m - 1]);
      expect(season(m, 0)).toBe(north[m - 1]);
      expect(season(m, -0.1)).toBe(south[m - 1]);
    }
  });
});
