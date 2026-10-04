import type { Drainage, IsoDate, LightLevel, Plan, PotMaterial } from '../domain.ts';
import { addDays } from '../period.ts';
import { baseIntervalDays, FREE_RECHECK_DAYS } from './basic.ts';
import type { DiagnosisEffect } from './diagnosis.ts';
import { type CareState, type CheckBasis, clampLearned } from './state.ts';

/** What a plant's schedule is computed from, besides its state. */
export interface PlantFactors {
  wateringMin: number | null;
  wateringMax: number | null;
  intervalOverride: number | null;
  potMaterial: PotMaterial;
  potSizeCm: number | null;
  light: LightLevel;
  drainage: Drainage;
  indoor: boolean;
}

/** The next 48 hours at a plant's weather cell. */
export interface WeatherSummary {
  rainNext48hMm: number;
  maxTempNext48hC: number;
  /** When the forecast was fetched (an ISO 8601 instant). Over 24 hours old, it is ignored. */
  fetchedAt: string;
}

export interface EngineInput {
  plan: Plan;
  /** The user's local calendar date. Every date the engine returns is whole days from it. */
  today: IsoDate;
  /** The current instant. Used only to judge how old `weather` is. */
  now: Date;
  /** Only the sign matters: negative is the southern hemisphere; null is northern. */
  latitude: number | null;
  factors: PlantFactors;
  state: CareState;
  /** Used only for an outdoor plant on Premium, and only while fresh; ignored otherwise. */
  weather: WeatherSummary | null;
}

export interface CheckInDecision {
  waterTaskOn: IsoDate | null;
  nextCheckOn: IsoDate;
  state: CareState;
  intervalDays: number;
}

export interface RecomputeInput extends EngineInput {
  /** The due date of the plant's open check, or null when it has none. */
  openCheckOn: IsoDate | null;
}

export interface RecomputeDecision {
  /** Where the open check should be; equal to `openCheckOn` when `changed` is false. */
  nextCheckOn: IsoDate;
  changed: boolean;
  /** The input state, or with the basis it was found to have when it had none. */
  state: CareState;
  intervalDays: number;
}

const MIN_DAYS = 2;
const MAX_DAYS = 21;
const RAIN_MM = 5;
const RAIN_DAYS = 2;
const HEAT_C = 28;
const HEAT_DAYS = 1;
const WEATHER_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** A summary stamped slightly ahead of this clock is clock skew; further ahead, it is not trusted. */
const WEATHER_MAX_SKEW_MS = 60 * 60 * 1000;
const LEARN_NO = 1.1;
const LEARN_ON_TIME_YES = 0.95;
/** A damp answer, during a pause, puts the count of dry checks needed back to the diagnosis's two. */
const DRY_CHECKS_TO_RESUME: Extract<
  DiagnosisEffect,
  { kind: 'pause_watering' }
>['dryChecksNeeded'] = 2;

const POT: Record<PotMaterial, number> = {
  terracotta: 0.85,
  plastic: 1,
  ceramic: 1.05,
  unknown: 1,
};
const LIGHT: Record<LightLevel, number> = { bright: 0.85, medium: 1, low: 1.25, unknown: 1 };
const DRAINAGE: Record<Drainage, number> = { yes: 1, no: 1.2, unknown: 1 };
const SEASON = { summer: 0.85, shoulder: 1, winter: 1.35 } as const;

/** Northern hemisphere unless the latitude is negative: Jun–Aug summer, Dec–Feb winter. */
export function season(month: number, latitude: number | null): 'summer' | 'winter' | 'shoulder' {
  const southern = latitude !== null && latitude < 0;
  if (month >= 6 && month <= 8) return southern ? 'winter' : 'summer';
  if (month === 12 || month === 1 || month === 2) return southern ? 'summer' : 'winter';
  return 'shoulder';
}

function potSizeFactor(cm: number | null): number {
  if (cm === null || !Number.isFinite(cm) || cm <= 0) return 1;
  if (cm <= 12) return 0.8;
  if (cm <= 20) return 1;
  return 1.2;
}

/** The boost multiplier while it has cycles left, else 1. */
function boostFactor(state: CareState): number {
  const b = state.boost;
  if (!b || !(b.cyclesLeft >= 1) || !Number.isFinite(b.factor) || b.factor <= 0) return 1;
  return b.factor;
}

function isFresh(fetchedAt: string, now: Date): boolean {
  const age = now.getTime() - Date.parse(fetchedAt);
  return Number.isFinite(age) && age <= WEATHER_MAX_AGE_MS && age >= -WEATHER_MAX_SKEW_MS;
}

/**
 * The weather the engine will act on: the summary for an outdoor plant on Premium while it is under
 * 24 hours old, else null. Also tells the app whether to credit the weather source.
 */
export function usableWeather(
  input: Pick<EngineInput, 'plan' | 'factors' | 'weather' | 'now'>,
): WeatherSummary | null {
  const { weather } = input;
  if (input.plan !== 'premium' || input.factors.indoor || !weather) return null;
  return isFresh(weather.fetchedAt, input.now) ? weather : null;
}

/**
 * Days from a dry check or a watering to the next check.
 * - Free: the base interval, shortened by a diagnosis boost.
 * - Premium: the base interval × pot, pot size, light, drainage, season, learned and boost factors,
 *   rounded and clamped to 2–21; then for an outdoor plant, fresh weather adds 2 days for rain or
 *   takes 1 off for heat, never below 1.
 */
export function intervalDays(input: EngineInput): number {
  const { factors: f, state } = input;
  const base = baseIntervalDays({ min: f.wateringMin, max: f.wateringMax }, f.intervalOverride);
  const boost = boostFactor(state);
  if (input.plan !== 'premium') return boost === 1 ? base : Math.max(1, Math.round(base * boost));

  const month = Number(input.today.slice(5, 7));
  const raw =
    base *
    (POT[f.potMaterial] ?? 1) *
    potSizeFactor(f.potSizeCm) *
    (LIGHT[f.light] ?? 1) *
    (DRAINAGE[f.drainage] ?? 1) *
    SEASON[season(month, input.latitude)] *
    clampLearned(state.learned) *
    boost;
  const days = Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(raw)));

  const weather = usableWeather(input);
  if (!weather) return days;
  const rain = weather.rainNext48hMm >= RAIN_MM ? RAIN_DAYS : 0;
  const heat = weather.maxTempNext48hC >= HEAT_C ? HEAT_DAYS : 0;
  return Math.max(1, days + rain - heat);
}

/** Days from a damp check (or a dry one during a pause) to the next. */
function recheckDays(plan: Plan, interval: number): number {
  return plan === 'premium' ? Math.max(2, Math.round(interval / 2)) : FREE_RECHECK_DAYS;
}

function checkOn(input: EngineInput, basis: CheckBasis, interval: number): IsoDate {
  return addDays(
    basis.from,
    basis.kind === 'interval' ? interval : recheckDays(input.plan, interval),
  );
}

function learn(learned: number, soilDry: boolean, today: IsoDate, dueOn: IsoDate | null): number {
  if (!soilDry) return clampLearned(learned * LEARN_NO);
  if (dueOn !== null && today >= dueOn) return clampLearned(learned * LEARN_ON_TIME_YES);
  return clampLearned(learned);
}

/**
 * The outcome of a soil check. Dry soil means a water task today and the next check one interval
 * later; damp soil means a recheck. During an overwatering pause a dry answer counts towards the two
 * dry checks in a row instead, and only the second one waters; a damp answer starts the count again.
 * Premium also learns from the answer. A check-in never uses up a boost cycle or records a watering:
 * that is `decideAfterWatering`.
 */
export function decideAfterCheckIn(
  input: EngineInput & { soilDry: boolean; dueOn: IsoDate | null },
): CheckInDecision {
  const { today, soilDry, state } = input;
  let pause = state.pause;
  let water = soilDry;
  if (pause) {
    if (!soilDry) {
      pause = { ...pause, dryChecksNeeded: DRY_CHECKS_TO_RESUME };
    } else if (pause.dryChecksNeeded > 1) {
      pause = { ...pause, dryChecksNeeded: pause.dryChecksNeeded - 1 };
      water = false;
    } else {
      pause = null; // the last dry check needed: water today
    }
  }
  const checkBasis: CheckBasis = { from: today, kind: water ? 'interval' : 'recheck' };
  const next: CareState = {
    ...state,
    learned:
      input.plan === 'premium' ? learn(state.learned, soilDry, today, input.dueOn) : state.learned,
    pause,
    lastCheckOn: today,
    checkBasis,
  };
  const days = intervalDays({ ...input, state: next });
  return {
    waterTaskOn: water ? today : null,
    nextCheckOn: checkOn(input, checkBasis, days),
    state: next,
    intervalDays: days,
  };
}

/**
 * A water task was completed today: record the watering, use up one boost cycle, and date the next
 * check one interval from now (with whatever boost is left). The only place either happens.
 */
export function decideAfterWatering(input: EngineInput): {
  nextCheckOn: IsoDate;
  state: CareState;
} {
  const { today, state } = input;
  const b = state.boost;
  const checkBasis: CheckBasis = { from: today, kind: 'interval' };
  const next: CareState = {
    ...state,
    boost: b && b.cyclesLeft > 1 ? { ...b, cyclesLeft: b.cyclesLeft - 1 } : null,
    lastWateredOn: today,
    checkBasis,
  };
  return {
    nextCheckOn: checkOn(input, checkBasis, intervalDays({ ...input, state: next })),
    state: next,
  };
}

/**
 * Re-dates the open check after its inputs changed (weather, season, a diagnosis, the plan or the
 * setup), on the same basis it was dated with:
 * - a check that is already due or overdue is never moved;
 * - a check only moves by whole days, and never earlier than tomorrow;
 * - weather over 24 hours old is ignored.
 * A plant never checked in has no basis; its open check is taken to be one base interval from setup,
 * which is how plant creation dates it, and that basis is returned in the state so it never drifts.
 * With no open check, one is dated from the basis, or one interval from today.
 */
export function recomputeNextCheck(input: RecomputeInput): RecomputeDecision {
  const { today, openCheckOn, state } = input;
  const days = intervalDays(input);
  if (openCheckOn !== null && openCheckOn <= today) {
    return { nextCheckOn: openCheckOn, changed: false, state, intervalDays: days };
  }
  const f = input.factors;
  const basis: CheckBasis =
    state.checkBasis ??
    (openCheckOn === null
      ? { from: today, kind: 'interval' }
      : {
          from: addDays(
            openCheckOn,
            -baseIntervalDays({ min: f.wateringMin, max: f.wateringMax }, f.intervalOverride),
          ),
          kind: 'interval',
        });
  const planned = checkOn(input, basis, days);
  const tomorrow = addDays(today, 1);
  const nextCheckOn = planned < tomorrow ? tomorrow : planned;
  return {
    nextCheckOn,
    changed: nextCheckOn !== openCheckOn,
    state: basis === state.checkBasis ? state : { ...state, checkBasis: basis },
    intervalDays: days,
  };
}
