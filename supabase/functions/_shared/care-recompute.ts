import { recomputeNextCheck, type WeatherSummary } from '@core/care/engine.ts';
import { hemisphereLatitude } from '@core/care/hemisphere.ts';
import { parseCareState } from '@core/care/state.ts';
import type { Drainage, IsoDate, LightLevel, PotMaterial } from '@core/domain.ts';
import { localDate } from '@core/period.ts';
import type { Json } from '../../../packages/db/src/index.ts';
import { callPrivate, type Db } from './db.ts';
import { cellCentre } from './h3.ts';
import { log } from './log.ts';

/** One row of `srv_recompute_batch` (the generated types mark every column non-null; these are the real ones). */
export interface RecomputeRow {
  plant_id: string;
  /** The raw stored value: the compare-and-set value, never re-serialised. */
  care_state: unknown;
  watering_min: number | null;
  watering_max: number | null;
  interval_override: number | null;
  pot_material: string;
  pot_size_cm: number | null;
  light: string;
  drainage: string;
  indoor: boolean;
  plan: string;
  tz: string;
  country_code: string | null;
  open_check_on: IsoDate | null;
  /** The weather cell as decimal text. */
  cell: string | null;
  weather_summary: unknown;
  weather_fetched_at: string | null;
}

/** The arguments of `srv_recompute_plant`. */
export interface RecomputeCall {
  p_plant_id: string;
  p_expected_state: Json;
  p_state: Json;
  p_next_check_on: IsoDate;
  p_today: IsoDate;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The cached summary as the engine's input, or null when it is missing or unreadable. */
function weatherOf(row: RecomputeRow): WeatherSummary | null {
  const s = row.weather_summary;
  if (!isRecord(s) || !row.weather_fetched_at) return null;
  const { rainNext48hMm: rain, maxTempNext48hC: temp } = s;
  if (typeof rain !== 'number' || !Number.isFinite(rain)) return null;
  if (typeof temp !== 'number' || !Number.isFinite(temp)) return null;
  const at = Date.parse(row.weather_fetched_at);
  if (!Number.isFinite(at)) return null;
  return { rainNext48hMm: rain, maxTempNext48hC: temp, fetchedAt: new Date(at).toISOString() };
}

function cellLatitude(cell: string | null): number | null {
  if (cell === null) return null;
  try {
    return cellCentre(cell).lat;
  } catch {
    return null;
  }
}

/**
 * Pure: what `srv_recompute_plant` should write for one batch row at `now`, or null when nothing changes. The plant's
 * `today` is the local date in its creator's tz, and its hemisphere comes from its cell, else the creator's country.
 * A write is needed when the open check moves, when a plant without a check basis gains one (so it never drifts), or
 * when there is no open check.
 */
export function recomputeRow(row: RecomputeRow, now: Date): RecomputeCall | null {
  const today = localDate(now, row.tz || 'UTC');
  const state = parseCareState(row.care_state);
  const decision = recomputeNextCheck({
    plan: row.plan === 'premium' ? 'premium' : 'free',
    today,
    now,
    latitude: hemisphereLatitude(cellLatitude(row.cell), row.country_code),
    factors: {
      wateringMin: row.watering_min,
      wateringMax: row.watering_max,
      intervalOverride: row.interval_override,
      potMaterial: row.pot_material as PotMaterial,
      potSizeCm: row.pot_size_cm,
      light: row.light as LightLevel,
      drainage: row.drainage as Drainage,
      indoor: row.indoor,
    },
    state,
    weather: weatherOf(row),
    openCheckOn: row.open_check_on,
  });
  const gainedBasis = state.checkBasis === null && decision.state.checkBasis !== null;
  if (!decision.changed && !gainedBasis && row.open_check_on !== null) return null;
  return {
    p_plant_id: row.plant_id,
    p_expected_state: (row.care_state ?? {}) as Json,
    p_state: decision.state as unknown as Json,
    p_next_check_on: decision.nextCheckOn,
    p_today: today,
  };
}

export interface NightlyOptions {
  /** The run instant: every plant's local date is taken from it. */
  now: Date;
  /** Stop at a clean point (between plants) once this much time has passed. */
  budgetMs: number;
  clock?: () => number;
  pageSize?: number;
}

export interface NightlyCounts {
  updated: number;
  unchanged: number;
  conflict: number;
  closed: number;
  /** Nothing to write. */
  skipped: number;
  failed: number;
  /** Plants looked at. */
  done: number;
  /** Plants already read but not looked at when the budget ran out. */
  remaining: number;
  exhausted: boolean;
}

export const NIGHTLY_PAGE_SIZE = 200;
const STATUSES = ['updated', 'unchanged', 'conflict', 'closed'] as const;

/**
 * Recomputes every alive plant's open check, a page at a time in plant id order, within the time budget. A conflict
 * (the state changed since the page was read) is skipped; it is picked up again tomorrow. A failure on one plant is
 * logged and skipped.
 */
export async function runNightly(db: Db, opts: NightlyOptions): Promise<NightlyCounts> {
  const clock = opts.clock ?? Date.now;
  const deadline = clock() + opts.budgetMs;
  const pageSize = opts.pageSize ?? NIGHTLY_PAGE_SIZE;
  const counts: NightlyCounts = {
    updated: 0,
    unchanged: 0,
    conflict: 0,
    closed: 0,
    skipped: 0,
    failed: 0,
    done: 0,
    remaining: 0,
    exhausted: false,
  };
  let after: string | null = null;
  pages: for (;;) {
    if (clock() >= deadline) {
      counts.exhausted = true;
      break;
    }
    const rows = (await callPrivate(db, 'srv_recompute_batch', {
      p_after: after,
      p_limit: pageSize,
    })) as unknown as RecomputeRow[];
    for (let i = 0; i < rows.length; i++) {
      if (clock() >= deadline) {
        counts.exhausted = true;
        counts.remaining = rows.length - i;
        break pages;
      }
      const row = rows[i]!;
      counts.done += 1;
      try {
        const call = recomputeRow(row, opts.now);
        if (!call) {
          counts.skipped += 1;
          continue;
        }
        const status = await callPrivate(db, 'srv_recompute_plant', call);
        const known = STATUSES.find((s) => s === status);
        if (known) counts[known] += 1;
        else throw new Error(`unexpected status ${String(status)}`);
      } catch (e) {
        counts.failed += 1;
        log('error', 'nightly_plant_failed', {
          plantId: row.plant_id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    if (rows.length < pageSize) break;
    after = rows[rows.length - 1]!.plant_id;
  }
  if (counts.exhausted) {
    log('warn', 'worker_budget_exhausted', {
      route: 'nightly',
      done: counts.done,
      remaining: counts.remaining,
    });
  }
  log('info', 'nightly_run', { ...counts });
  return counts;
}
