import { assertEquals } from '@std/assert';
import { createHandler, labelFromRpc } from '../labels/handler.ts';
import { fakeDb } from '../_shared/testing/fake-db.ts';

const rpcLabel = {
  code: 'PL-0001',
  growerName: 'Greenhouse Growers',
  cultivar: null,
  species: {
    id: 'sp1',
    slug: 'peace-lily',
    commonName: 'Peace lily',
    scientificName: 'Spathiphyllum',
    imageUrl: null,
    light: 'Bright, indirect light',
    checkIntervalDays: 6,
    warmth: '18 to 27 °C',
    rarityTier: 'common',
    sensitive: false,
  },
  toxicity: [
    {
      animal: 'cat',
      severity: 'moderate',
      summary: 's',
      symptoms: 'y',
      sourceName: 'ASPCA',
      sourceUrl: 'https://x',
      reviewStatus: 'seed_pending_vet',
    },
    {
      animal: 'dog',
      severity: 'moderate',
      summary: null,
      symptoms: null,
      sourceName: null,
      sourceUrl: null,
      reviewStatus: 'reviewed',
    },
  ],
};

function setup(label: unknown = rpcLabel) {
  const db = fakeDb({
    qr_codes: [
      { code: 'PL-0001', status: 'active' },
      { code: 'PL-OLD1', status: 'retired' },
    ],
  });
  db.rpcImpl.public_label = (a) => ({
    data: String(a.p_code).trim().toUpperCase() === 'PL-0001' ? label : null,
    error: null,
  });
  return { db, h: createHandler({ db }) };
}
const get = (h: (r: Request) => Promise<Response>, code: string) =>
  h(new Request(`http://x/functions/v1/labels/${code}`));
const event = (h: (r: Request) => Promise<Response>, code: string, body: unknown) =>
  h(
    new Request(`http://x/functions/v1/labels/${code}/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

Deno.test('GET /PL-0001 maps the RPC JSON to a LabelInfo, with a short cache', async () => {
  const { h } = setup();
  const res = await get(h, 'PL-0001');
  assertEquals(res.status, 200);
  assertEquals(res.headers.get('cache-control'), 'public, max-age=60');
  const l = await res.json();
  assertEquals(Object.keys(l).sort(), [
    'care',
    'careLines',
    'code',
    'growerName',
    'species',
    'toxicity',
  ]);
  assertEquals(Object.keys(l.species).sort(), [
    'commonName',
    'id',
    'imageUrl',
    'rarity',
    'scientificName',
    'sensitive',
  ]);
  assertEquals(l.species.rarity, 'common');
  assertEquals(l.species.sensitive, false);
  assertEquals(l.care, {
    light: 'Bright, indirect light',
    soilCheck: 'Every 5 to 7 days',
    warmth: '18 to 27 °C',
  });
  assertEquals(l.careLines, ['Bright, indirect light', 'Check the soil every 5 to 7 days']);
  assertEquals(
    l.toxicity.map((t: { reviewStatus: string }) => t.reviewStatus),
    ['seed_pending_vet', 'reviewed'],
  );
  assertEquals(typeof l.growerName, 'string');
});

Deno.test('labelFromRpc omits the soil line when there is no interval', () => {
  const l = labelFromRpc({
    ...rpcLabel,
    species: { ...rpcLabel.species, checkIntervalDays: null, light: null },
  });
  assertEquals(l.careLines, []);
  assertEquals(l.care, { light: null, soilCheck: null, warmth: '18 to 27 °C' });
});

Deno.test('an unknown code is null with status 200', async () => {
  const { h } = setup();
  const res = await get(h, 'NOPE');
  assertEquals(res.status, 200);
  assertEquals(await res.json(), null);
});

Deno.test('events insert a scan for a known code; unknown codes are 404', async () => {
  const { db, h } = setup();
  assertEquals((await event(h, 'pl-0001', { event: 'app_open', platform: 'ios' })).status, 204);
  assertEquals(db.tables.qr_scans.length, 1);
  assertEquals(db.tables.qr_scans[0]?.code, 'PL-0001');
  assertEquals(db.tables.qr_scans[0]?.event, 'app_open');
  assertEquals((await event(h, 'NOPE', { event: 'app_open', platform: 'ios' })).status, 404);
  assertEquals((await event(h, 'PL-OLD1', { event: 'app_open', platform: 'ios' })).status, 404);
  assertEquals(db.tables.qr_scans.length, 1);
});

Deno.test('events accept only app_open and store_click on ios, android or web', async () => {
  const { db, h } = setup();
  for (const b of [
    { event: 'adoption', platform: 'ios' },
    { event: 'page_view', platform: 'ios' },
    { event: 'app_open', platform: 'windows' },
    { event: 'app_open' },
    {},
  ]) {
    assertEquals((await event(h, 'PL-0001', b)).status, 400, JSON.stringify(b));
  }
  assertEquals((await event(h, 'PL-0001', { event: 'store_click', platform: 'web' })).status, 204);
  assertEquals(db.tables.qr_scans.length, 1);
});
