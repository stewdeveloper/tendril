// deno-lint-ignore-file no-explicit-any
import { distanceM } from '@core/privacy.ts';
import type { Db } from '../db.ts';

/**
 * A minimal in-memory stand-in for the supabase-js client: just the query-builder subset the handlers use,
 * a few unique constraints, and an `rpc` registry that implements each `srv_*` contract. The real database is
 * covered by pgTAP and the Task 7 integration test.
 */
type Row = Record<string, any>;
type Err = { code?: string; message: string };
type Result = { data: any; error: Err | null; count?: number };

const UNIQUES: Record<string, string[]> = {
  species: ['slug', 'scientific_name', 'provider_entity_id'],
  push_tokens: ['token'],
  observation_photos: ['storage_path'],
  profiles: ['handle'],
};
const NO_ID = new Set([
  'household_members',
  'privacy_zones',
  'push_tokens',
  'profiles',
  'household_vets',
  'species_toxicity',
  'plantdex_entries',
]);

export type FakeDb = Db & {
  tables: Record<string, Row[]>;
  rpcCalls: { fn: string; args: Record<string, any> }[];
  storageWrites: { path: string; bytes: Uint8Array; opts: Record<string, unknown> }[];
  usage: Record<string, number>;
  providerTokens: Record<string, string>;
  refuseReservations: boolean;
  rpcImpl: Record<string, (a: Record<string, any>) => { data: any; error: Err | null }>;
};

export function fakeDb(seed: Record<string, any> = {}): FakeDb {
  const { storage: seedStorage = {}, ...seedTables } = seed;
  const tables: Record<string, Row[]> = new Proxy(
    Object.fromEntries(
      Object.entries(seedTables).map(([k, v]) => [k, (v as Row[]).map((r) => ({ ...r }))]),
    ),
    {
      get(t, k: string) {
        return (t[k] ??= []);
      },
    },
  );
  for (const z of tables.privacy_zones) withCenter(z);

  const fake: any = {
    tables,
    rpcCalls: [],
    storageWrites: [],
    usage: {},
    providerTokens: {},
    refuseReservations: false,
  };

  class Query implements PromiseLike<Result> {
    private op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
    private filters: ((r: Row) => boolean)[] = [];
    private payload: any;
    private onConflict: string[] = [];
    private returning = true;
    private sort: { col: string } | null = null;
    private take: 'many' | 'one' | 'maybe' = 'many';
    constructor(private table: string) {}
    private head = false;
    private wantCount = false;
    select(_cols?: string, o: { count?: string; head?: boolean } = {}) {
      if (this.op !== 'select') this.returning = true;
      this.wantCount = !!o.count;
      this.head = !!o.head;
      return this;
    }
    insert(p: any) {
      this.op = 'insert';
      this.payload = p;
      this.returning = false;
      return this;
    }
    upsert(p: any, o: { onConflict?: string } = {}) {
      this.op = 'upsert';
      this.payload = p;
      this.onConflict = (o.onConflict ?? 'id').split(',').map((s) => s.trim());
      this.returning = false;
      return this;
    }
    update(p: any) {
      this.op = 'update';
      this.payload = p;
      this.returning = false;
      return this;
    }
    delete() {
      this.op = 'delete';
      this.returning = false;
      return this;
    }
    eq(c: string, v: any) {
      this.filters.push((r) => r[c] === v);
      return this;
    }
    neq(c: string, v: any) {
      this.filters.push((r) => r[c] !== v);
      return this;
    }
    in(c: string, vs: any[]) {
      this.filters.push((r) => vs.includes(r[c]));
      return this;
    }
    order(col: string) {
      this.sort = { col };
      return this;
    }
    single() {
      this.take = 'one';
      return this;
    }
    maybeSingle() {
      this.take = 'maybe';
      return this;
    }
    then<A, B>(ok?: (v: Result) => A | PromiseLike<A>, fail?: (e: unknown) => B | PromiseLike<B>) {
      return Promise.resolve(this.run()).then(ok, fail);
    }

    private run(): Result {
      const rows = tables[this.table]!;
      const matched = () => rows.filter((r) => this.filters.every((f) => f(r)));
      let out: Row[] = [];
      if (this.op === 'select') {
        out = matched();
        if (this.head) return { data: null, count: out.length, error: null } as Result;
      } else if (this.op === 'insert' || this.op === 'upsert') {
        for (const p of Array.isArray(this.payload) ? this.payload : [this.payload]) {
          const row: Row = { ...p };
          if (!NO_ID.has(this.table) && row.id === undefined) row.id = crypto.randomUUID();
          const existing =
            this.op === 'upsert'
              ? rows.find((r) => this.onConflict.every((c) => r[c] === row[c]))
              : undefined;
          if (existing) {
            Object.assign(existing, row);
            withCenter(existing);
            out.push(existing);
            continue;
          }
          const clash = (UNIQUES[this.table] ?? []).find(
            (c) => row[c] != null && rows.some((r) => r[c] === row[c]),
          );
          if (clash) return { data: null, error: { code: '23505', message: `duplicate ${clash}` } };
          withCenter(row);
          rows.push(row);
          out.push(row);
        }
      } else if (this.op === 'update') {
        out = matched();
        for (const r of out) Object.assign(r, this.payload);
      } else {
        const gone = matched();
        tables[this.table] = rows.filter((r) => !gone.includes(r));
        if (this.table === 'observations') {
          for (const t of ['observation_photos', 'observation_locations']) {
            tables[t] = tables[t]!.filter((r) => !gone.some((g) => g.id === r.observation_id));
          }
        }
        out = gone;
      }
      if (this.sort) {
        const col = this.sort.col;
        out = [...out].sort((a, b) => String(a[col]).localeCompare(String(b[col])));
      }
      if (this.op !== 'select' && !this.returning) return { data: null, error: null };
      const copy = out.map((r) => ({ ...r }));
      if (this.take === 'many') return { data: copy, error: null };
      if (copy.length === 0 && this.take === 'one') {
        return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
      }
      return { data: copy[0] ?? null, error: null };
    }
  }

  fake.from = (table: string) => new Query(table);

  const files: Record<string, Uint8Array> = { ...seedStorage };
  fake.storage = {
    from: () => ({
      download: (path: string) =>
        Promise.resolve(
          files[path]
            ? { data: new Blob([files[path]! as BlobPart]), error: null }
            : { data: null, error: { message: 'Object not found' } },
        ),
      upload: (path: string, bytes: Uint8Array, opts: Record<string, unknown> = {}) => {
        if (files[path] && !opts.upsert)
          return Promise.resolve({ data: null, error: { message: 'exists' } });
        files[path] = bytes;
        fake.storageWrites.push({ path, bytes, opts });
        return Promise.resolve({ data: { path }, error: null });
      },
      remove: (paths: string[]) => {
        for (const p of paths) delete files[p];
        return Promise.resolve({ data: [], error: null });
      },
    }),
  };

  const err = (code: string, message = code): Result => ({ data: null, error: { code, message } });
  const ok = (data: any): Result => ({ data, error: null });
  const registry: Record<string, (a: Record<string, any>) => Result> = {
    srv_reserve_usage: (a) => {
      const key = `${a.p_uid}:${a.p_kind}:${a.p_period_key}`;
      const used = fake.usage[key] ?? 0;
      if (fake.refuseReservations || used >= (a.p_limit ?? 0)) return ok({ ok: false, used });
      fake.usage[key] = used + 1;
      return ok({ ok: true, used: used + 1 });
    },
    srv_release_usage: (a) => {
      const key = `${a.p_uid}:${a.p_kind}:${a.p_period_key}`;
      fake.usage[key] = Math.max(0, (fake.usage[key] ?? 0) - 1);
      return ok(null);
    },
    srv_is_premium: (a) =>
      ok(
        tables.entitlements!.some(
          (e) => e.user_id === a.p_uid && Date.parse(e.active_until) > Date.now(),
        ),
      ),
    srv_store_provider: (a) => {
      fake.providerTokens[a.p_observation_id] = a.p_access_token;
      return ok(null);
    },
    srv_get_provider_token: (a) => ok(fake.providerTokens[a.p_observation_id] ?? null),
    srv_point_in_zone: (a) => {
      const z = tables.privacy_zones!.find((r) => r.user_id === a.p_uid);
      return ok(!!z && distanceM({ lat: a.p_lat, lng: a.p_lng }, z.centerLatLng) <= z.radius_m);
    },
    srv_plantdex_record: (a) => {
      const rows = tables.plantdex_entries!;
      const e = rows.find((r) => r.user_id === a.p_uid && r.species_id === a.p_species_id);
      if (e) e.finds_count += 1;
      else
        rows.push({
          user_id: a.p_uid,
          species_id: a.p_species_id,
          category: a.p_category,
          first_observation_id: a.p_observation_id,
          first_found_at: a.p_found_at,
          finds_count: 1,
        });
      return ok({ newToPlantdex: !e, count: rows.filter((r) => r.user_id === a.p_uid).length });
    },
    srv_create_plant: (a) => {
      if (
        !tables.household_members!.some(
          (m) => m.household_id === a.p_household_id && m.user_id === a.p_uid,
        )
      )
        return err('P0403', 'not a member of this household');
      if (
        a.p_observation_id &&
        !tables.observations!.some((o) => o.id === a.p_observation_id && o.user_id === a.p_uid)
      )
        return err('P0403', 'observation is not yours');
      const id = crypto.randomUUID();
      tables.plants!.push({
        id,
        household_id: a.p_household_id,
        species_id: a.p_species_id,
        observation_id: a.p_observation_id,
        nickname: a.p_nickname,
        room: a.p_room,
        indoor: a.p_indoor,
        pot_size_cm: a.p_pot_size_cm,
        pot_material: a.p_pot_material,
        drainage: a.p_drainage,
        light: a.p_light,
        source: a.p_source,
        label_code: a.p_label_code,
        created_by: a.p_uid,
      });
      tables.care_tasks!.push({
        id: crypto.randomUUID(),
        plant_id: id,
        household_id: a.p_household_id,
        kind: 'check',
        due_on: a.p_first_check_on,
      });
      tables.care_events!.push({
        id: crypto.randomUUID(),
        plant_id: id,
        household_id: a.p_household_id,
        user_id: a.p_uid,
        kind: 'setup',
        occurred_at: a.p_now,
      });
      return ok(id);
    },
    srv_confirm_observation: (a) => {
      const o = tables.observations!.find(
        (r) => r.id === a.p_observation_id && r.user_id === a.p_uid,
      );
      if (!o) return err('P0404', 'observation not found');
      const dexCount = () => tables.plantdex_entries!.filter((r) => r.user_id === a.p_uid).length;
      if (o.status === 'confirmed') {
        if (o.species_id !== a.p_species_id || o.intent !== a.p_action)
          return err('P0409', 'already confirmed differently');
        const e = tables.plantdex_entries!.find(
          (r) => r.user_id === a.p_uid && r.species_id === o.species_id,
        );
        return ok({
          plantId: o.plant_id ?? null,
          duplicate: true,
          newToPlantdex: e?.first_observation_id === o.id,
          plantdexCount: dexCount(),
          feedbackEntityId: null,
        });
      }
      if (o.status !== 'identified') return err('P0409', 'observation is not identified');
      const list: any[] = Array.isArray(o.suggestions) ? o.suggestions : [];
      const at = list.findIndex((x) => x.speciesId === a.p_species_id);
      if (at < 0) return err('22023', 'species is not one of the suggestions');
      const sp = tables.species!.find((r) => r.id === a.p_species_id);
      if (!sp) return err('22023', 'unknown species');
      const mine = tables.household_members!.filter((m) => m.user_id === a.p_uid);
      let household: string | undefined;
      if (a.p_action === 'add_plant' && a.p_household_id) {
        if (!mine.some((m) => m.household_id === a.p_household_id))
          return err('P0403', 'not a member of this household');
        household = a.p_household_id;
      } else {
        household = (mine.find((m) => m.role === 'owner') ?? mine[0])?.household_id;
        if (!household) return err('P0404', 'no household');
      }
      const place = a.p_action === 'add_plant' ? 'home' : a.p_place_type;
      if (!place) return err('22023', 'a find needs a place type');
      let cell: string | null = null;
      const loc = tables.observation_locations!.find((l) => l.observation_id === o.id);
      if (loc && (place === 'wild' || place === 'shop') && !sp.sensitive) {
        const m = /POINT\(([-\d.e+]+) ([-\d.e+]+)\)/.exec(String(loc.point));
        const inside = m
          ? (registry.srv_point_in_zone!({
              p_uid: a.p_uid,
              p_lat: Number(m[2]),
              p_lng: Number(m[1]),
            }).data as boolean)
          : true;
        if (!inside) cell = loc.cell_r5 ?? null;
      }
      Object.assign(o, {
        species_id: a.p_species_id,
        confidence: Math.round(Math.min(1, Math.max(0, list[at].probability)) * 10000) / 10000,
        intent: a.p_action,
        place_type: place,
        household_id: household,
        public_cell_r5: cell,
        status: 'confirmed',
        confirmed_at: a.p_now,
      });
      let plantId: string | null = null;
      if (a.p_action === 'add_plant') {
        const made = registry.srv_create_plant!({
          p_uid: a.p_uid,
          p_household_id: household,
          p_species_id: a.p_species_id,
          p_observation_id: o.id,
          p_nickname: a.p_setup.nickname,
          p_room: a.p_setup.room,
          p_indoor: a.p_setup.indoor,
          p_pot_size_cm: a.p_setup.potSizeCm,
          p_pot_material: a.p_setup.potMaterial,
          p_drainage: a.p_setup.drainage,
          p_light: a.p_setup.light,
          p_source: 'scan',
          p_label_code: null,
          p_first_check_on: a.p_first_check_on,
          p_now: a.p_now,
        });
        plantId = made.data;
        o.plant_id = plantId;
      }
      const dex = registry.srv_plantdex_record!({
        p_uid: a.p_uid,
        p_species_id: a.p_species_id,
        p_category: a.p_action === 'add_plant' || sp.is_houseplant ? 'houseplant' : 'wild',
        p_observation_id: o.id,
        p_found_at: a.p_now,
      }).data;
      return ok({
        plantId,
        duplicate: false,
        newToPlantdex: dex.newToPlantdex,
        plantdexCount: dex.count,
        feedbackEntityId: at === 0 ? null : (list[at].providerEntityId ?? null),
      });
    },
    srv_bootstrap: (a) => {
      let profile = tables.profiles!.find((p) => p.id === a.p_uid);
      if (!profile) {
        const handle =
          a.p_handle ?? `plant${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`;
        if (tables.profiles!.some((p) => p.handle === handle)) return err('P0409', 'handle taken');
        profile = {
          id: a.p_uid,
          handle,
          display_name: a.p_display_name,
          timezone: a.p_timezone,
          country_code: a.p_country_code,
          age_confirmed_13_plus: true,
        };
        tables.profiles!.push(profile);
      }
      let member = tables.household_members!.find((m) => m.user_id === a.p_uid);
      if (!member) {
        const id = crypto.randomUUID();
        tables.households!.push({ id, name: 'Home', created_by: a.p_uid });
        member = { household_id: id, user_id: a.p_uid, role: 'owner' };
        tables.household_members!.push(member);
      }
      return ok({ userId: a.p_uid, handle: profile.handle, householdId: member.household_id });
    },
    srv_replace_pets: (a) => {
      tables.household_pets = tables.household_pets!.filter(
        (p) => p.household_id !== a.p_household_id,
      );
      for (const p of a.p_pets as Row[]) {
        tables.household_pets!.push({
          id: crypto.randomUUID(),
          household_id: a.p_household_id,
          animal: p.animal,
          name: p.name,
        });
      }
      return ok(null);
    },
  };
  fake.rpcImpl = registry; // tests may add or override an rpc (for example the anon-callable public_label)
  fake.rpc = (fn: string, args: Record<string, any> = {}) => {
    fake.rpcCalls.push({ fn, args });
    const impl = registry[fn];
    return Promise.resolve(impl ? impl(args) : err('42883', `fake rpc ${fn} is not implemented`));
  };

  return fake as FakeDb;
}

/** privacy_zones rows carry `centerLatLng` for inspection; the handler writes `center` as EWKT. */
function withCenter(row: Row): void {
  const m = /^SRID=4326;POINT\(([-\d.e+]+) ([-\d.e+]+)\)$/.exec(String(row.center ?? ''));
  if (m) row.centerLatLng = { lat: Number(m[2]), lng: Number(m[1]) };
}
