import type { IsoDate } from '../domain.ts';
import { addDays } from '../period.ts';

/**
 * How the open check was dated: one interval from `from` (after a dry check or a watering), or a
 * shorter recheck from `from` (after a damp check, or a dry one during a pause). A recompute re-dates
 * the check on the same basis, so it never stretches a recheck into a full interval.
 */
export interface CheckBasis {
  from: IsoDate;
  kind: 'interval' | 'recheck';
}

/** A plant's care-engine state, stored as `plants.care_state`. */
export interface CareState {
  /** Premium's learned multiplier, 0.6..1.8: × 1.1 for each "No", × 0.95 for each on-time "Yes". */
  learned: number;
  /** An overwatering diagnosis: no water tasks until this many dry checks in a row. */
  pause: { reason: 'overwatering'; dryChecksNeeded: number } | null;
  /** An underwatering diagnosis: the interval × `factor` until `cyclesLeft` waterings have been done. */
  boost: { factor: number; cyclesLeft: number } | null;
  lastCheckOn: IsoDate | null;
  /** Set only when a water task is completed. */
  lastWateredOn: IsoDate | null;
  checkBasis: CheckBasis | null;
}

export const INITIAL_CARE_STATE: CareState = Object.freeze({
  learned: 1,
  pause: null,
  boost: null,
  lastCheckOn: null,
  lastWateredOn: null,
  checkBasis: null,
});

const LEARNED_MIN = 0.6;
const LEARNED_MAX = 1.8;

/** Keeps the learned multiplier in 0.6..1.8, at four decimal places; anything unreadable is 1. */
export function clampLearned(learned: number): number {
  if (typeof learned !== 'number' || !Number.isFinite(learned)) return 1;
  const tidy = Math.round(learned * 10_000) / 10_000;
  return Math.min(LEARNED_MAX, Math.max(LEARNED_MIN, tidy));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is IsoDate {
  return (
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value
  );
}

/** A count of at least one, rounded down; anything else is null. */
function wholeCount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const n = Math.floor(value);
  return n >= 1 ? n : null;
}

function parsePause(value: unknown): CareState['pause'] {
  if (!isRecord(value) || value.reason !== 'overwatering') return null;
  const dryChecksNeeded = wholeCount(value.dryChecksNeeded);
  return dryChecksNeeded === null ? null : { reason: 'overwatering', dryChecksNeeded };
}

function parseBoost(value: unknown): CareState['boost'] {
  if (!isRecord(value)) return null;
  const { factor } = value;
  const cyclesLeft = wholeCount(value.cyclesLeft);
  if (typeof factor !== 'number' || !Number.isFinite(factor) || factor <= 0) return null;
  return cyclesLeft === null ? null : { factor, cyclesLeft };
}

function parseBasis(value: unknown): CheckBasis | null {
  if (!isRecord(value) || !isIsoDate(value.from)) return null;
  return value.kind === 'interval' || value.kind === 'recheck'
    ? { from: value.from, kind: value.kind }
    : null;
}

/**
 * Reads a stored `care_state` tolerantly: each field that is missing or malformed falls back to its
 * initial value, unknown fields are dropped, and anything that is not an object (or the column's
 * `{}` default) reads as the initial state. Always returns a fresh object.
 */
export function parseCareState(json: unknown): CareState {
  const o = isRecord(json) ? json : {};
  return {
    learned: typeof o.learned === 'number' ? clampLearned(o.learned) : 1,
    pause: parsePause(o.pause),
    boost: parseBoost(o.boost),
    lastCheckOn: isIsoDate(o.lastCheckOn) ? o.lastCheckOn : null,
    lastWateredOn: isIsoDate(o.lastWateredOn) ? o.lastWateredOn : null,
    checkBasis: parseBasis(o.checkBasis),
  };
}
