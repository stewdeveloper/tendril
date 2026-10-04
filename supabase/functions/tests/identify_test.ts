import { assertEquals } from '@std/assert';
import { createHandler } from '../identify/handler.ts';
import { fakeDb } from '../_shared/testing/fake-db.ts';
import { fakeIdentificationProvider } from '../_shared/providers/fake-identification.ts';
import { appCheckVerifier } from '../_shared/providers/appcheck.ts';
import type { IdentificationProvider } from '../_shared/providers/identification.ts';

const UID = '11111111-1111-1111-1111-111111111111';
const verifier = { verify: () => Promise.resolve({ userId: UID }) };
const jpeg = await Deno.readFile(new URL('./fixtures/gps.jpg', import.meta.url));
const req = (body: unknown, appCheck = 'dev-ok') =>
  new Request('http://x/functions/v1/identify', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-firebase-appcheck': appCheck },
    body: JSON.stringify(body),
  });
const body = (paths = [`${UID}/obs/1.jpg`]) => ({
  photos: paths.map((path) => ({ path, organ: 'leaf' })),
  captureSource: 'camera',
  location: { lat: 53.35, lng: -6.26, accuracyM: 8, mocked: false },
  deviceTime: '2026-10-03T10:00:00Z',
  healthCheck: false,
});

type Seed = Record<string, unknown>;
function setup(provider: IdentificationProvider = fakeIdentificationProvider(), seed: Seed = {}) {
  const db = fakeDb({
    profiles: [{ id: UID, timezone: 'Europe/Dublin', country_code: 'IE' }],
    storage: { [`${UID}/obs/1.jpg`]: jpeg },
    ...seed,
  });
  const handle = createHandler({
    db,
    verifier,
    provider,
    appCheck: appCheckVerifier('dev', {}),
    now: () => new Date('2026-10-03T10:00:00Z'),
  });
  return { db, handle };
}
const count = (db: { rpcCalls: { fn: string }[] }, fn: string) =>
  db.rpcCalls.filter((c) => c.fn === fn).length;

Deno.test('identifies, strips EXIF and returns suggestions with quota', async () => {
  const { db, handle } = setup();
  const res = await handle(req(body()));
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.state, 'identified');
  assertEquals(json.suggestions[0].species.commonName, 'Peace lily');
  assertEquals(json.diagnosis, null);
  assertEquals(json.quota, {
    kind: 'identification',
    used: 1,
    limit: 10,
    resetsOn: '2026-11-01',
    plan: 'free',
  });
  assertEquals(db.storageWrites.length, 1);
  assertEquals(db.storageWrites[0]?.opts, { contentType: 'image/jpeg', upsert: true });
  assertEquals(db.tables.observations[0]?.status, 'identified');
  assertEquals(db.tables.observations[0]?.suggestions.length, 2);
  assertEquals(db.tables.observation_photos.length, 1);
  assertEquals(db.tables.observation_photos[0]?.sha256.length, 64);
  assertEquals(db.tables.observations[0]?.image_hash, db.tables.observation_photos[0]?.sha256);
  assertEquals(db.tables.observation_locations.length, 1);
  assertEquals(db.providerTokens[db.tables.observations[0]!.id as string], 'fake-very_likely');
});

Deno.test("rejects another user's photo before using quota", async () => {
  const { db, handle } = setup();
  const res = await handle(req(body(['22222222-2222-2222-2222-222222222222/x.jpg'])));
  assertEquals(res.status, 403);
  assertEquals(count(db, 'srv_reserve_usage'), 0);
});

Deno.test('malformed photo lists and paths are 400 before any quota use', async () => {
  const { db, handle } = setup();
  const many = Array.from({ length: 6 }, (_, i) => `${UID}/a/${i}.jpg`);
  for (const paths of [
    [],
    many,
    [`${UID}/../x.jpg`],
    [`${UID}//x.jpg`],
    [UID],
    [`${UID}/a.jpg`, `${UID}/a.jpg`],
  ]) {
    assertEquals((await handle(req(body(paths)))).status, 400, JSON.stringify(paths));
  }
  assertEquals(count(db, 'srv_reserve_usage'), 0);
});

Deno.test('a path already used by an observation is a 409 and uses no quota', async () => {
  const { db, handle } = setup(undefined, {
    observation_photos: [{ id: 'p', storage_path: `${UID}/obs/1.jpg` }],
  });
  assertEquals((await handle(req(body()))).status, 409);
  assertEquals(count(db, 'srv_reserve_usage'), 0);
});

Deno.test('provider failure releases the quota and deletes the observation', async () => {
  const { db, handle } = setup(fakeIdentificationProvider('error'));
  const res = await handle(req(body()));
  assertEquals(res.status, 503);
  assertEquals(count(db, 'srv_release_usage'), 1);
  assertEquals(db.tables.observations.length, 0);
  assertEquals(db.tables.observation_photos.length, 0);
  assertEquals(db.usage['identification:2026-10'], 0);
  // A retry with the same paths now works.
  const retry = setup(fakeIdentificationProvider());
  assertEquals((await retry.handle(req(body()))).status, 200);
});

Deno.test('a non-JPEG upload is a 400, releases the quota and leaves nothing behind', async () => {
  const { db, handle } = setup(undefined, {
    storage: { [`${UID}/obs/1.jpg`]: new TextEncoder().encode('not a jpeg') },
  });
  assertEquals((await handle(req(body()))).status, 400);
  assertEquals(count(db, 'srv_release_usage'), 1);
  assertEquals(db.tables.observations.length, 0);
  assertEquals(db.storageWrites.length, 0);
});

Deno.test('a missing upload is 404 and releases the quota', async () => {
  const { db, handle } = setup();
  assertEquals((await handle(req(body([`${UID}/obs/missing.jpg`])))).status, 404);
  assertEquals(count(db, 'srv_release_usage'), 1);
});

Deno.test('not a plant releases quota, keeps the observation and says so', async () => {
  const { db, handle } = setup(fakeIdentificationProvider('not_a_plant'));
  const json = await (await handle(req(body()))).json();
  assertEquals(json.state, 'not_a_plant');
  assertEquals(json.suggestions, []);
  assertEquals(json.quota.used, 0);
  assertEquals(count(db, 'srv_release_usage'), 1);
  assertEquals(db.tables.observations[0]?.status, 'not_a_plant');
});

Deno.test('quota refusal returns 429 with reset details and makes no provider call', async () => {
  let called = false;
  const provider = {
    identify: () => {
      called = true;
      return Promise.reject(new Error('should not call'));
    },
    feedback: () => Promise.resolve(),
  };
  const { db, handle } = setup(provider);
  db.refuseReservations = true;
  const res = await handle(req(body()));
  assertEquals(res.status, 429);
  assertEquals((await res.json()).error.details, {
    kind: 'identification',
    limit: 10,
    resetsOn: '2026-11-01',
    plan: 'free',
  });
  assertEquals(called, false);
  assertEquals(db.tables.observations.length, 0);
});

Deno.test('premium users get the premium limit', async () => {
  const { handle } = setup(undefined, {
    entitlements: [{ user_id: UID, active_until: '2027-01-01T00:00:00Z' }],
  });
  const json = await (await handle(req(body()))).json();
  assertEquals(json.quota.limit, 60);
  assertEquals(json.quota.plan, 'premium');
});

Deno.test('healthCheck reserves no diagnosis quota and returns diagnosis null', async () => {
  const { db, handle } = setup();
  const res = await handle(req({ ...body(), healthCheck: true }));
  assertEquals(res.status, 200);
  assertEquals((await res.json()).diagnosis, null);
  assertEquals(
    db.rpcCalls.filter((c) => c.fn === 'srv_reserve_usage').map((c) => c.args.p_kind),
    ['identification'],
  );
});

Deno.test('missing app check still identifies but records the verdict', async () => {
  const { db, handle } = setup();
  await handle(req(body(), ''));
  assertEquals(db.tables.observations[0]?.integrity, { appCheck: 'missing' });
});

Deno.test(
  'a reference-catalogue species keeps its curated fields and gains the provider id',
  async () => {
    const { db, handle } = setup(undefined, {
      species: [
        {
          id: 'sp-lily',
          scientific_name: 'Spathiphyllum',
          common_name: 'Peace lily',
          slug: 'peace-lily',
          provider_entity_id: null,
          genus: 'Spathiphyllum',
          family: 'Araceae',
          check_interval_days: 6,
          rarity_tier: 'common',
          sensitive: false,
          light: 'Curated light text',
        },
      ],
    });
    const json = await (await handle(req(body()))).json();
    assertEquals(json.suggestions[0].species.id, 'sp-lily');
    const lily = db.tables.species.find((s) => s.id === 'sp-lily')!;
    assertEquals(lily.provider_entity_id, 'fake-peace-lily');
    assertEquals(lily.light, 'Curated light text');
    assertEquals(json.care.light, 'Curated light text');
    assertEquals(json.care.soilCheck, 'Check the soil every 5 to 7 days');
    assertEquals(db.tables.species.length, 2);
  },
);

Deno.test(
  'a new species gets a sentence-cased name, a slug that avoids collisions, clamped watering',
  async () => {
    const provider: IdentificationProvider = {
      ...fakeIdentificationProvider(),
      identify: async (input) => {
        const r = await fakeIdentificationProvider().identify(input);
        r.suggestions = [
          {
            ...r.suggestions[0]!,
            scientificName: 'Zamioculcas zamiifolia',
            commonNames: ['zz plant'],
            providerEntityId: 'zz',
            genus: 'Zamioculcas',
            watering: { min: 0, max: 5 },
          },
        ];
        return r;
      },
    };
    const { db, handle } = setup(provider, {
      species: [{ id: 'taken', scientific_name: 'Other', slug: 'zz-plant', common_name: 'x' }],
    });
    const json = await (await handle(req(body()))).json();
    assertEquals(json.suggestions[0].species.commonName, 'Zz plant');
    const row = db.tables.species.find((s) => s.provider_entity_id === 'zz')!;
    assertEquals(row.slug, 'zz-plant-2');
    assertEquals([row.watering_min, row.watering_max], [1, 3]);
  },
);

Deno.test('a null family with no catalogue match is inserted as sensitive', async () => {
  const provider: IdentificationProvider = {
    ...fakeIdentificationProvider(),
    identify: async (input) => {
      const r = await fakeIdentificationProvider().identify(input);
      r.suggestions = [
        {
          ...r.suggestions[0]!,
          family: null,
          providerEntityId: 'mystery',
          scientificName: 'Mysterium rarum',
          genus: 'Mysterium',
        },
      ];
      return r;
    },
  };
  const { db, handle } = setup(provider);
  const json = await (await handle(req(body()))).json();
  assertEquals(json.suggestions[0].species.sensitive, true);
  assertEquals(db.tables.species[0]?.sensitive, true);
});

Deno.test('a species-level name falls back to the genus-level toxicity rows', async () => {
  const provider: IdentificationProvider = {
    ...fakeIdentificationProvider(),
    identify: async (input) => {
      const r = await fakeIdentificationProvider().identify(input);
      r.suggestions = [
        { ...r.suggestions[0]!, scientificName: 'Spathiphyllum wallisii', providerEntityId: 'sw' },
      ];
      return r;
    },
  };
  const { handle } = setup(provider, {
    species: [
      {
        id: 'genus-row',
        scientific_name: 'Spathiphyllum',
        genus: 'Spathiphyllum',
        common_name: 'Peace lily',
        slug: 'peace-lily',
      },
    ],
    species_toxicity: [
      {
        species_id: 'genus-row',
        animal: 'dog',
        severity: 'mild',
        summary: 's',
        symptoms: 'y',
        source_name: 'ASPCA',
        source_url: 'https://aspca.org',
      },
      {
        species_id: 'genus-row',
        animal: 'cat',
        severity: 'moderate',
        summary: null,
        symptoms: null,
        source_name: 'ASPCA',
        source_url: null,
      },
    ],
  });
  const json = await (await handle(req(body()))).json();
  assertEquals(
    json.toxicity.map((t: { animal: string }) => t.animal),
    ['cat', 'dog'],
  );
  assertEquals(json.toxicity[1].severity, 'mild');
  assertEquals(json.toxicity[1].sourceName, 'ASPCA');
});

Deno.test('an unknown profile is told to finish setup, before any quota use', async () => {
  const { db, handle } = setup(undefined, { profiles: [] });
  assertEquals((await handle(req(body()))).status, 403);
  assertEquals(count(db, 'srv_reserve_usage'), 0);
});
