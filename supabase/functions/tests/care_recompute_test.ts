import { assert, assertEquals, assertNotEquals } from '@std/assert';
import { recomputeNextCheck, type RecomputeInput } from '@core/care/engine.ts';
import { addDays } from '@core/period.ts';
import { recomputeRow, type RecomputeRow, runNightly } from '../_shared/care-recompute.ts';
import { cellR7Text } from '../_shared/h3.ts';
import { fakeDb } from '../_shared/testing/fake-db.ts';

const NOW = new Date('2026-10-10T09:00:00Z');
const BASIS = { from: '2026-10-10', kind: 'interval' } as const;
const STATE = {
  learned: 1,
  pause: null,
  boost: null,
  lastCheckOn: '2026-10-10',
  lastWateredOn: null,
  checkBasis: BASIS,
};

/** Watering 2/2 is a 7-day base interval. */
const row = (over: Partial<RecomputeRow> = {}): RecomputeRow => ({
  plant_id: '00000000-0000-4000-8000-000000000001',
  care_state: STATE,
  watering_min: 2,
  watering_max: 2,
  interval_override: null,
  pot_material: 'unknown',
  pot_size_cm: null,
  light: 'unknown',
  drainage: 'unknown',
  indoor: true,
  plan: 'free',
  tz: 'Europe/Dublin',
  country_code: 'IE',
  open_check_on: '2026-10-17',
  cell: null,
  weather_summary: null,
  weather_fetched_at: null,
  ...over,
});

const DUBLIN_CELL = cellR7Text(53.35, -6.26);
const SYDNEY_CELL = cellR7Text(-33.87, 151.21);

Deno.test('recomputeRow: an up-to-date check needs no write', () => {
  assertEquals(recomputeRow(row(), NOW), null);
});

Deno.test('recomputeRow: a plant with no basis gains one from its open check, once', () => {
  const call = recomputeRow(row({ care_state: {} }), NOW);
  assert(call);
  assertEquals(call.p_expected_state, {}, 'the compare-and-set value is the raw stored state');
  assertEquals((call.p_state as { checkBasis: unknown }).checkBasis, {
    from: '2026-10-10',
    kind: 'interval',
  });
  assertEquals(call.p_next_check_on, '2026-10-17', 'the check itself does not move');
  assertEquals(call.p_today, '2026-10-10');
  assertEquals(recomputeRow(row({ care_state: call.p_state }), NOW), null, 'the next run is quiet');
});

Deno.test('recomputeRow: no open check means one is dated, from the basis or today', () => {
  const fromBasis = recomputeRow(row({ open_check_on: null }), NOW);
  assertEquals(fromBasis?.p_next_check_on, '2026-10-17');
  const fresh = recomputeRow(row({ open_check_on: null, care_state: {} }), NOW);
  assertEquals(fresh?.p_next_check_on, '2026-10-17');
  assertEquals((fresh?.p_state as { checkBasis: unknown }).checkBasis, BASIS);
});

Deno.test("recomputeRow: today is each plant's own local date", () => {
  const late = new Date('2026-10-10T23:30:00Z');
  const today = (tz: string) =>
    recomputeRow(row({ tz, open_check_on: null, care_state: {} }), late)?.p_today;
  assertEquals(today('Europe/Dublin'), '2026-10-11');
  assertEquals(today('Pacific/Auckland'), '2026-10-11');
  assertEquals(today('America/New_York'), '2026-10-10');
  assertEquals(today('Not/AZone'), '2026-10-10', 'an unreadable tz is UTC');
});

Deno.test('recomputeRow: a due or overdue check is left alone', () => {
  assertEquals(recomputeRow(row({ open_check_on: '2026-10-10' }), NOW), null);
  assertEquals(recomputeRow(row({ open_check_on: '2026-10-02', care_state: {} }), NOW), null);
});

function premiumOutdoor(over: Partial<RecomputeRow> = {}): RecomputeRow {
  return row({ plan: 'premium', indoor: false, cell: DUBLIN_CELL, ...over });
}

/** What the engine dates with these inputs and no weather. */
function dryDate(r: RecomputeRow): string {
  const input: RecomputeInput = {
    plan: 'premium',
    today: '2026-10-10',
    now: NOW,
    latitude: 53.35,
    factors: {
      wateringMin: 2,
      wateringMax: 2,
      intervalOverride: null,
      potMaterial: 'unknown',
      potSizeCm: null,
      light: 'unknown',
      drainage: 'unknown',
      indoor: false,
    },
    state: STATE,
    weather: null,
    openCheckOn: r.open_check_on,
  };
  return recomputeNextCheck(input).nextCheckOn;
}

Deno.test('recomputeRow: fresh rain moves a Premium outdoor check two days later', () => {
  const base = premiumOutdoor();
  const settled = premiumOutdoor({ open_check_on: dryDate(base) });
  assertEquals(recomputeRow(settled, NOW), null, 'no weather, no change');
  const wet = recomputeRow(
    {
      ...settled,
      weather_summary: { rainNext48hMm: 6.5, maxTempNext48hC: 14 },
      weather_fetched_at: '2026-10-10T06:00:00.000000Z',
    },
    NOW,
  );
  assertEquals(wet?.p_next_check_on, addDays(dryDate(base), 2));
  assertEquals(wet?.p_expected_state, STATE);
});

Deno.test('recomputeRow: stale or malformed weather is ignored', () => {
  const settled = premiumOutdoor({ open_check_on: dryDate(premiumOutdoor()) });
  const stale = {
    ...settled,
    weather_summary: { rainNext48hMm: 12, maxTempNext48hC: 14 },
    weather_fetched_at: '2026-10-09T03:00:00.000000Z',
  };
  assertEquals(recomputeRow(stale, NOW), null, 'over 24 hours old');
  for (const summary of [{ rainNext48hMm: 'lots', maxTempNext48hC: 14 }, [], 'wet', {}]) {
    assertEquals(
      recomputeRow(
        { ...stale, weather_summary: summary, weather_fetched_at: NOW.toISOString() },
        NOW,
      ),
      null,
      JSON.stringify(summary),
    );
  }
  assertEquals(
    recomputeRow(
      {
        ...stale,
        weather_summary: { rainNext48hMm: 12, maxTempNext48hC: 14 },
        weather_fetched_at: null,
      },
      NOW,
    ),
    null,
    'no fetched_at',
  );
});

Deno.test('recomputeRow: the season follows the cell latitude, else the country', () => {
  const july = new Date('2026-07-10T09:00:00Z');
  const next = (over: Partial<RecomputeRow>) =>
    recomputeRow(
      row({
        plan: 'premium',
        open_check_on: null,
        care_state: { checkBasis: { from: '2026-07-10', kind: 'interval' } },
        ...over,
      }),
      july,
    )?.p_next_check_on;
  const ireland = next({ country_code: 'IE' });
  const newZealand = next({ country_code: 'NZ' });
  assert(ireland && newZealand);
  assert(newZealand > ireland, `July is winter in NZ: ${newZealand} vs ${ireland}`);
  assertEquals(
    next({ country_code: 'IE', cell: SYDNEY_CELL }),
    newZealand,
    'a southern cell wins over IE',
  );
  assertEquals(
    next({ country_code: 'NZ', cell: DUBLIN_CELL }),
    ireland,
    'a northern cell wins over NZ',
  );
  assertEquals(next({ country_code: null }), ireland, 'no country is northern');
});

Deno.test('recomputeRow: only the engine fields are written back', () => {
  const call = recomputeRow(
    row({ care_state: { learned: 1.2, extra: true }, open_check_on: null }),
    NOW,
  );
  assert(call);
  assertEquals(call.p_expected_state, { learned: 1.2, extra: true });
  assertEquals(Object.keys(call.p_state as object).sort(), [
    'boost',
    'checkBasis',
    'lastCheckOn',
    'lastWateredOn',
    'learned',
    'pause',
  ]);
  assertNotEquals(call.p_state, call.p_expected_state);
});

// runNightly against the fake database --------------------------------------------------------------------------

const HH = '00000000-0000-4000-8000-0000000000a1';
const USER = '00000000-0000-4000-8000-0000000000b1';
const SPECIES = '00000000-0000-4000-8000-0000000000c1';

function seed(n: number, over: (i: number) => Record<string, unknown> = () => ({})) {
  const plants = Array.from({ length: n }, (_, i) => ({
    id: `00000000-0000-4000-8000-00000000010${i}`,
    household_id: HH,
    species_id: SPECIES,
    created_by: USER,
    status: 'alive',
    indoor: true,
    pot_material: 'unknown',
    pot_size_cm: null,
    light: 'unknown',
    drainage: 'unknown',
    care_state: {},
    cell_r7: null,
    created_at: `2026-10-0${1 + (i % 9)}T00:00:00Z`,
    ...over(i),
  }));
  return fakeDb({
    profiles: [{ id: USER, timezone: 'Europe/Dublin', country_code: 'IE' }],
    household_members: [{ household_id: HH, user_id: USER, role: 'owner' }],
    species: [{ id: SPECIES, watering_min: 2, watering_max: 2, check_interval_days: null }],
    plants,
    care_tasks: [],
  });
}

const openChecks = (db: ReturnType<typeof fakeDb>, plantId: string) =>
  db.tables.care_tasks!.filter(
    (t) => t.plant_id === plantId && t.kind === 'check' && t.status === 'due',
  );

Deno.test(
  'runNightly: pages through every alive plant and leaves each with one open check',
  async () => {
    const db = seed(5, (i) => (i === 4 ? { status: 'dead' } : {}));
    db.tables.care_tasks!.push({
      id: 't0',
      plant_id: '00000000-0000-4000-8000-000000000100',
      household_id: HH,
      kind: 'check',
      due_on: '2026-10-17',
      status: 'due',
    });
    const counts = await runNightly(db, { now: NOW, budgetMs: 60_000, pageSize: 2 });
    const batches = db.rpcCalls.filter((c) => c.fn === 'srv_recompute_batch');
    assertEquals(
      batches.map((c) => c.args.p_after),
      [null, '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000103'],
    );
    assertEquals(
      batches.map((c) => c.args.p_limit),
      [2, 2, 2],
    );
    for (let i = 0; i < 4; i++) {
      assertEquals(
        openChecks(db, `00000000-0000-4000-8000-00000000010${i}`).length,
        1,
        `plant ${i}`,
      );
    }
    assertEquals(openChecks(db, '00000000-0000-4000-8000-000000000104').length, 0, 'dead plant');
    assertEquals(openChecks(db, '00000000-0000-4000-8000-000000000101')[0]!.due_on, '2026-10-17');
    assertEquals(counts.updated, 4, 'three checks inserted and one basis written');
    assertEquals(counts.done, 4);
    assertEquals(counts.exhausted, false);

    const again = await runNightly(db, { now: NOW, budgetMs: 60_000, pageSize: 2 });
    assertEquals(again.updated, 0);
    assertEquals(again.skipped, 4, 'a second run is quiet');
  },
);

Deno.test(
  'runNightly: a conflict, a closed plant or a failure is counted and skipped',
  async () => {
    const db = seed(5);
    const real = db.rpcImpl.srv_recompute_plant!;
    db.rpcImpl.srv_recompute_plant = (a) => {
      if (a.p_plant_id.endsWith('100')) return { data: 'conflict', error: null };
      if (a.p_plant_id.endsWith('101'))
        return { data: null, error: { code: 'XX000', message: 'boom' } };
      // Closed between the batch read and the write.
      if (a.p_plant_id.endsWith('102')) return { data: 'closed', error: null };
      if (a.p_plant_id.endsWith('103')) return { data: 'surprise', error: null };
      return real(a);
    };
    const counts = await runNightly(db, { now: NOW, budgetMs: 60_000 });
    assertEquals(
      {
        conflict: counts.conflict,
        failed: counts.failed,
        closed: counts.closed,
        updated: counts.updated,
        done: counts.done,
      },
      { conflict: 1, failed: 2, closed: 1, updated: 1, done: 5 },
      'an unknown status is a failure',
    );
  },
);

Deno.test('runNightly: stops at a clean point when the budget runs out', async () => {
  const db = seed(4);
  let t = 0;
  // Each read of the clock moves time on 10 ms, so the budget runs out part-way through the first page.
  const counts = await runNightly(db, { now: NOW, budgetMs: 25, clock: () => (t += 10) });
  assertEquals(counts.exhausted, true);
  assert(counts.done < 4, JSON.stringify(counts));
  assertEquals(counts.done + counts.remaining, 4);
  const none = await runNightly(seed(2), { now: NOW, budgetMs: 0 });
  assertEquals({ done: none.done, exhausted: none.exhausted }, { done: 0, exhausted: true });
});
