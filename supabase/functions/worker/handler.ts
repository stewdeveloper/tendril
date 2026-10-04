/// <reference path="../_shared/runtime.d.ts" />
import { runNightly } from '../_shared/care-recompute.ts';
import { callPrivate, type Db } from '../_shared/db.ts';
import { cellCentre, cellR7Text } from '../_shared/h3.ts';
import { json, router } from '../_shared/http.ts';
import { log } from '../_shared/log.ts';
import type { WeatherProvider } from '../_shared/providers/weather.ts';

/** About 100 s of work per call: well inside the edge runtime's wall clock, with room to stop cleanly. */
export const WORKER_BUDGET_MS = 100_000;
const MISSING_CELL_PAGE = 200;
const WEATHER_MAX_AGE = '6 hours';
const WEATHER_CELLS_PER_RUN = 500;
const WEATHER_CONCURRENCY = 4;

export interface WorkerDeps {
  db: Db;
  /** Null: no weather (selection refused or WeatherKit is not configured); cells are still filled. */
  weather: WeatherProvider | null;
  /** The bearer the cron jobs send (Vault `worker_key`). Unset or empty refuses every call. */
  workerKey: string | undefined;
  now?: () => Date;
  clock?: () => number;
  budgetMs?: number;
  /** `EdgeRuntime.waitUntil` when deployed: answer 202 at once, keep working after. Without it, work runs inline. */
  waitUntil?: (p: Promise<unknown>) => void;
}

const sha256 = async (s: string) =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

/** Constant time in the secret's content and length: both sides are hashed, then compared without an early exit. */
async function sameSecret(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}

/** `Authorization: Bearer <WORKER_KEY>` only; `apikey` and user JWTs are never accepted. */
async function authorised(req: Request, workerKey: string | undefined): Promise<boolean> {
  const presented = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.get('authorization') ?? '')?.[1];
  if (!workerKey || !presented) return false;
  return await sameSecret(presented, workerKey);
}

const unauthorised = () =>
  Response.json({ error: { code: 'unauthenticated', message: 'Unauthorized.' } }, { status: 401 });

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export interface WeatherCounts {
  cellsFilled: number;
  badZones: number;
  due: number;
  stored: number;
  failed: number;
  /** Due cells not fetched when the budget ran out. */
  remaining: number;
  exhausted: boolean;
}

/**
 * 1. Gives every outdoor plant whose creator has a home area its resolution-7 cell (from the zone's randomised
 *    centre), a page at a time until none are missing.
 * 2. Refreshes the cache for premium cells older than 6 hours, at most 500 a run, 4 at a time. Each fetch is at the
 *    cell centre in the cell's tz; a failed cell is logged and skipped. Skipped entirely without a provider.
 * Logs carry counts and cell ids only, never coordinates.
 */
export async function runWeather(
  db: Db,
  weather: WeatherProvider | null,
  opts: { budgetMs: number; clock?: () => number },
): Promise<WeatherCounts> {
  const clock = opts.clock ?? Date.now;
  const deadline = clock() + opts.budgetMs;
  const timeLeft = () => clock() < deadline;
  const out: WeatherCounts = {
    cellsFilled: 0,
    badZones: 0,
    due: 0,
    stored: 0,
    failed: 0,
    remaining: 0,
    exhausted: false,
  };

  for (;;) {
    if (!timeLeft()) {
      out.exhausted = true;
      break;
    }
    const rows = (await callPrivate(db, 'srv_plants_missing_cell', {
      p_limit: MISSING_CELL_PAGE,
    })) as { plant_id: string; zone_lat: number; zone_lng: number }[];
    if (rows.length === 0) break;
    const cells: { plantId: string; cell: string }[] = [];
    for (const r of rows) {
      try {
        cells.push({ plantId: r.plant_id, cell: cellR7Text(r.zone_lat, r.zone_lng) });
      } catch {
        out.badZones += 1;
      }
    }
    const set =
      cells.length === 0 ? 0 : await callPrivate(db, 'srv_set_plant_cells', { p_cells: cells });
    out.cellsFilled += set;
    // A short page is the last; a page that wrote nothing would only come back the same.
    if (set === 0 || rows.length < MISSING_CELL_PAGE) break;
  }

  if (weather && !out.exhausted) {
    if (!timeLeft()) {
      out.exhausted = true;
    } else {
      const due = (await callPrivate(db, 'srv_weather_cells_due', {
        p_older_than: WEATHER_MAX_AGE,
        p_limit: WEATHER_CELLS_PER_RUN,
      })) as { cell: string; tz: string }[];
      out.due = due.length;
      let next = 0;
      const lane = async () => {
        while (next < due.length) {
          if (!timeLeft()) {
            out.exhausted = true;
            return;
          }
          const { cell, tz } = due[next++]!;
          try {
            const { lat, lng } = cellCentre(cell);
            const f = await weather.forecast(lat, lng, tz);
            if (!Number.isFinite(f.rainNext48hMm) || !Number.isFinite(f.maxTempNext48hC)) {
              throw new Error('the forecast has no usable numbers');
            }
            await callPrivate(db, 'srv_weather_store', {
              p_cell: cell,
              p_tz: tz,
              p_summary: { rainNext48hMm: f.rainNext48hMm, maxTempNext48hC: f.maxTempNext48hC },
            });
            out.stored += 1;
          } catch (e) {
            out.failed += 1;
            log('warn', 'weather_cell_failed', { cell, error: message(e) });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(WEATHER_CONCURRENCY, due.length) }, lane));
      out.remaining = due.length - next;
    }
  }

  if (out.exhausted) {
    log('warn', 'worker_budget_exhausted', {
      route: 'weather',
      done: out.cellsFilled + out.stored + out.failed,
      remaining: out.remaining,
    });
  }
  log('info', 'weather_run', { ...out, provider: weather ? 'on' : 'off' });
  return out;
}

const pattern = (pathname: string) => new URLPattern({ pathname });

/** The cron-driven worker: `POST /weather` and `POST /nightly`, each answered 202 before the work. */
export function createHandler(deps: WorkerDeps): (req: Request) => Promise<Response> {
  const budgetMs = deps.budgetMs ?? WORKER_BUDGET_MS;
  const now = deps.now ?? (() => new Date());

  async function accept(route: string, work: () => Promise<unknown>): Promise<Response> {
    const run = (async () => {
      try {
        await work();
      } catch (e) {
        log('error', 'worker_run_failed', { route, error: message(e) });
      }
    })();
    if (deps.waitUntil) deps.waitUntil(run);
    else await run;
    return json({ accepted: true }, 202);
  }

  const routes = router('worker', [
    {
      method: 'POST',
      pattern: pattern('/weather'),
      handle: () =>
        accept('weather', () => runWeather(deps.db, deps.weather, { budgetMs, clock: deps.clock })),
    },
    {
      method: 'POST',
      pattern: pattern('/nightly'),
      handle: () =>
        accept('nightly', () => runNightly(deps.db, { now: now(), budgetMs, clock: deps.clock })),
    },
  ]);

  return async (req) => {
    if (!(await authorised(req, deps.workerKey))) return unauthorised();
    return routes(req);
  };
}
