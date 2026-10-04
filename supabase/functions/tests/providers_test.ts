import { assert, assertEquals, assertRejects } from '@std/assert';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { mapPlantIdResponse } from '../_shared/providers/plantid-map.ts';
import { plantIdProvider } from '../_shared/providers/plantid.ts';
import { appCheckVerifier } from '../_shared/providers/appcheck.ts';
import { fakeIdentificationProvider } from '../_shared/providers/fake-identification.ts';
import {
  resetSelectionForTests,
  selectAppCheck,
  selectAppCheckMode,
  selectIdentificationProvider,
} from '../_shared/providers/select.ts';
import { ApiError } from '../_shared/errors.ts';
import type { IdentifyInput } from '../_shared/providers/identification.ts';

const load = async (n: string) =>
  JSON.parse(
    await Deno.readTextFile(new URL(`../_shared/providers/fixtures/${n}`, import.meta.url)),
  );

const input = (over: Partial<IdentifyInput> = {}): IdentifyInput => ({
  imagesBase64: ['QUJD'],
  lat: null,
  lng: null,
  datetime: '2026-10-03',
  health: false,
  ...over,
});

function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void> | void) {
  return async () => {
    const saved = Object.keys(vars).map((k) => [k, Deno.env.get(k)] as const);
    try {
      resetSelectionForTests();
      for (const [k, v] of Object.entries(vars)) {
        if (v === undefined) Deno.env.delete(k);
        else Deno.env.set(k, v);
      }
      await fn();
    } finally {
      resetSelectionForTests();
      for (const [k, v] of saved) {
        if (v === undefined) Deno.env.delete(k);
        else Deno.env.set(k, v);
      }
    }
  };
}

Deno.test('maps a Plant.id identification', async () => {
  const r = mapPlantIdResponse(await load('plantid-peace-lily.json'));
  assertEquals(r.isPlant, true);
  assertEquals(r.isPlantProbability, 0.98);
  assertEquals(r.accessToken, 'tok-peace-lily');
  assertEquals(r.suggestions[0]?.scientificName, 'Spathiphyllum');
  assertEquals(r.suggestions[0]?.commonNames[0], 'peace lily');
  assertEquals(r.suggestions[0]?.watering, { min: 2, max: 3 });
  assertEquals(r.suggestions[0]?.gbifId, 2868323);
  assertEquals(r.suggestions[0]?.family, 'Araceae');
  assertEquals(r.suggestions[0]?.genus, 'Spathiphyllum');
  assert(r.suggestions[0]?.imageUrl?.startsWith('https://'));
  assert(r.suggestions[0]?.similarImageUrl?.startsWith('https://'));
  assertEquals(r.suggestions[1]?.scientificName, 'Anthurium andraeanum');
  assertEquals(r.diagnosis, []);
});

Deno.test('maps not-a-plant', async () => {
  const r = mapPlantIdResponse(await load('plantid-not-a-plant.json'));
  assertEquals(r.isPlant, false);
  assertEquals(r.suggestions, []);
});

Deno.test('maps health with array or string treatments', async () => {
  const j = await load('plantid-health.json');
  const r = mapPlantIdResponse(j);
  assertEquals(r.diagnosis[0]?.name, 'overwatering');
  assertEquals(r.diagnosis[0]?.probability, 0.72);
  assertEquals(r.diagnosis[0]?.treatment, ['Water only when the top of the soil is dry']);
  j.result.disease.suggestions[0].details.treatment = { chemical: 'Use a fungicide' };
  assertEquals(mapPlantIdResponse(j).diagnosis[0]?.treatment, ['Use a fungicide']);
});

Deno.test('mapping keeps the top 5 by probability and never invents taxonomy', async () => {
  const j = await load('plantid-peace-lily.json');
  const base = j.result.classification.suggestions[0];
  j.result.classification.suggestions = [0.1, 0.5, 0.2, 0.05, 0.3, 0.01, 0.4].map((p, i) => ({
    ...structuredClone(base),
    id: `s${i}`,
    name: `Sp ${i}`,
    probability: p,
    details: { common_names: null },
  }));
  const r = mapPlantIdResponse(j);
  assertEquals(r.suggestions.length, 5);
  assertEquals(
    r.suggestions.map((s) => s.probability),
    [0.5, 0.4, 0.3, 0.2, 0.1],
  );
  assertEquals(r.suggestions[0]?.family, null);
  assertEquals(r.suggestions[0]?.genus, null);
  assertEquals(r.suggestions[0]?.commonNames, []);
  assertEquals(r.suggestions[0]?.watering, null);
});

Deno.test('mapping rejects a malformed body as provider_unavailable', () => {
  try {
    mapPlantIdResponse({ nope: true });
    throw new Error('expected throw');
  } catch (e) {
    assert(e instanceof ApiError);
    assertEquals(e.code, 'provider_unavailable');
  }
});

Deno.test('provider 5xx and 429 become provider_unavailable', async () => {
  for (const status of [429, 500, 503]) {
    const p = plantIdProvider('k', () => Promise.resolve(new Response('{}', { status })));
    const err = await assertRejects(() => p.identify(input()), ApiError);
    assertEquals(err.code, 'provider_unavailable');
  }
});

Deno.test('provider network error becomes provider_unavailable', async () => {
  const p = plantIdProvider('k', () => Promise.reject(new TypeError('boom')));
  const err = await assertRejects(() => p.identify(input()), ApiError);
  assertEquals(err.code, 'provider_unavailable');
});

Deno.test('provider times out when fetch never resolves', async () => {
  const p = plantIdProvider('k', () => new Promise<Response>(() => {}), 20);
  const err = await assertRejects(() => p.identify(input()), ApiError);
  assertEquals(err.code, 'provider_unavailable');
  const err2 = await assertRejects(() => p.feedback('tok', 'c'), ApiError);
  assertEquals(err2.code, 'provider_unavailable');
});

Deno.test(
  'provider sends health only when asked and never sends the API key elsewhere',
  async () => {
    let body: Record<string, unknown> = {};
    let headers = new Headers();
    let url = '';
    const p = plantIdProvider('secret-key', (u, init) => {
      url = String(u);
      body = JSON.parse(String(init?.body));
      headers = new Headers(init?.headers);
      return load('plantid-peace-lily.json').then(
        (j) => new Response(JSON.stringify(j), { status: 201 }),
      );
    });
    await p.identify(input({ lat: 53.3, lng: -6.2 }));
    assertEquals('health' in body, false);
    assertEquals((body.images as string[])[0], 'data:image/jpeg;base64,QUJD');
    assertEquals(headers.get('Api-Key'), 'secret-key');
    assertEquals(body.latitude, 53.3);
    assertEquals(body.similar_images, true);
    assertEquals(body.classification_level, 'species');
    assert(url.startsWith('https://plant.id/api/v3/identification?details='));
    assert(url.includes('taxonomy'));
    assert(!url.includes('secret-key'));
    assert(!JSON.stringify(body).includes('secret-key'));
    await p.identify(input({ health: true }));
    assertEquals(body.health, 'all');
  },
);

Deno.test('feedback posts the comment to the token path', async () => {
  let url = '';
  let method = '';
  let body: unknown;
  const p = plantIdProvider('k', (u, init) => {
    url = String(u);
    method = String(init?.method);
    body = JSON.parse(String(init?.body));
    return Promise.resolve(new Response('{}', { status: 200 }));
  });
  await p.feedback('tok123', 'user chose 42');
  assertEquals(url, 'https://plant.id/api/v3/identification/tok123/feedback');
  assertEquals(method, 'POST');
  assertEquals(body, { comment: 'user chose 42' });
  const bad = plantIdProvider('k', () => Promise.resolve(new Response('{}', { status: 500 })));
  const err = await assertRejects(() => bad.feedback('t', 'c'), ApiError);
  assertEquals(err.code, 'provider_unavailable');
});

Deno.test('fake provider scenarios', async () => {
  const run = (scenario?: Parameters<typeof fakeIdentificationProvider>[0], requested?: string) =>
    fakeIdentificationProvider(scenario).identify(input(requested ? { scenario: requested } : {}));

  const vl = await run();
  assertEquals(vl.isPlant, true);
  assertEquals(vl.suggestions[0]?.scientificName, 'Spathiphyllum');
  assertEquals(vl.suggestions[0]?.probability, 0.94);
  assertEquals(vl.suggestions[1]?.probability, 0.03);
  assertEquals(vl.suggestions[1]?.commonNames, ['flamingo flower']);

  const likely = await run(undefined, 'likely');
  assertEquals(
    [0, 1].map((i) => likely.suggestions[i]?.probability),
    [0.71, 0.22],
  );

  const ns = await run(undefined, 'not_sure');
  assertEquals(
    [0, 1].map((i) => ns.suggestions[i]?.probability),
    [0.41, 0.32],
  );

  const nap = await run(undefined, 'not_a_plant');
  assertEquals(nap.isPlant, false);
  assertEquals(nap.suggestions, []);

  const orchid = await run(undefined, 'orchid');
  assertEquals(orchid.suggestions.length, 1);
  assertEquals(orchid.suggestions[0]?.family, 'Orchidaceae');
  assertEquals(orchid.suggestions[0]?.scientificName, 'Orchis mascula');

  const e = await assertRejects(() => run(undefined, 'error'), ApiError);
  assertEquals(e.code, 'provider_unavailable');

  // Constructor scenario applies when no marker is present; unknown markers fall back.
  assertEquals((await run('likely')).suggestions[0]?.probability, 0.71);
  assertEquals((await run(undefined, 'bogus')).suggestions[0]?.probability, 0.94);
  // Image bytes never choose a scenario any more.
  assertEquals((await run(undefined, undefined)).suggestions[0]?.probability, 0.94);
  assertEquals(
    (
      await fakeIdentificationProvider().identify(
        input({ imagesBase64: [btoa('TENDRIL_FAKE:likely')] }),
      )
    ).suggestions[0]?.probability,
    0.94,
  );

  await fakeIdentificationProvider().feedback('tok', 'c');
});

Deno.test('fake provider gives health diagnosis when asked', async () => {
  const r = await fakeIdentificationProvider().identify(input({ health: true }));
  assertEquals(r.diagnosis[0]?.name, 'overwatering');
});

Deno.test('dev app check accepts only dev-ok', async () => {
  const v = appCheckVerifier('dev', {});
  assertEquals(await v.verify('dev-ok'), 'valid');
  assertEquals(await v.verify(null), 'missing');
  assertEquals(await v.verify('forged'), 'invalid');
});

Deno.test('firebase app check verifies issuer, audience, sub, expiry and signature', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const other = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const keyGetter = createLocalJWKSet({ keys: [jwk] });
  const cfg = { projectNumber: '123', appIds: ['1:123:ios:abc'], keyGetter };
  const v = appCheckVerifier('firebase', cfg);
  const mint = (
    o: { iss?: string; aud?: string[]; sub?: string; exp?: string | number; key?: CryptoKey } = {},
  ) =>
    new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(o.iss ?? 'https://firebaseappcheck.googleapis.com/123')
      .setAudience(o.aud ?? ['projects/123', 'projects/my-project'])
      .setSubject(o.sub ?? '1:123:ios:abc')
      .setIssuedAt()
      .setExpirationTime(o.exp ?? '1h')
      .sign(o.key ?? privateKey);

  assertEquals(await v.verify(await mint()), 'valid');
  assertEquals(await v.verify(null), 'missing');
  assertEquals(await v.verify(''), 'missing');
  assertEquals(await v.verify('dev-ok'), 'invalid');
  assertEquals(await v.verify(await mint({ iss: 'https://evil.example/123' })), 'invalid');
  assertEquals(await v.verify(await mint({ aud: ['projects/999'] })), 'invalid');
  assertEquals(await v.verify(await mint({ sub: '1:123:ios:other' })), 'invalid');
  assertEquals(
    await v.verify(await mint({ exp: Math.floor(Date.now() / 1000) - 3600 })),
    'invalid',
  );
  assertEquals(await v.verify(await mint({ key: other.privateKey })), 'invalid');
});

Deno.test('firebase app check with missing config fails closed', async () => {
  const v = appCheckVerifier('firebase', {});
  assertEquals(await v.verify('anything'), 'invalid');
  assertEquals(await v.verify(null), 'missing');
});

const CLEAN = {
  SUPABASE_URL: 'https://abc.supabase.co',
  TENDRIL_LOCAL: undefined,
  IDENTIFY_PROVIDER: undefined,
  APP_CHECK_MODE: undefined,
  PLANT_ID_API_KEY: undefined,
};

Deno.test(
  'select: production defaults are plantid and firebase; missing key is provider_unavailable',
  withEnv(CLEAN, async () => {
    assertEquals(selectAppCheckMode(), 'firebase');
    const p = selectIdentificationProvider(() => Promise.reject(new Error('no network')));
    const err = await assertRejects(() => p.identify(input()), ApiError);
    assertEquals(err.code, 'provider_unavailable');
    const withKey = withEnv({ ...CLEAN, PLANT_ID_API_KEY: 'k' }, async () => {
      let called = false;
      const q = selectIdentificationProvider(() => {
        called = true;
        return Promise.resolve(new Response('{}', { status: 500 }));
      });
      await assertRejects(() => q.identify(input()), ApiError);
      assert(called);
    });
    await withKey();
  }),
);

Deno.test(
  'select: local stack defaults are fake and dev',
  withEnv({ ...CLEAN, SUPABASE_URL: 'http://kong:8000' }, async () => {
    assertEquals(selectAppCheckMode(), 'dev');
    const r = await selectIdentificationProvider().identify(input());
    assertEquals(r.suggestions[0]?.scientificName, 'Spathiphyllum');
  }),
);

Deno.test(
  'select: explicit values override the defaults',
  withEnv(
    {
      ...CLEAN,
      SUPABASE_URL: 'http://kong:8000',
      APP_CHECK_MODE: 'firebase',
      IDENTIFY_PROVIDER: 'plantid',
    },
    async () => {
      assertEquals(selectAppCheckMode(), 'firebase');
      const err = await assertRejects(
        () => selectIdentificationProvider().identify(input()),
        ApiError,
      );
      assertEquals(err.code, 'provider_unavailable');
    },
  ),
);

Deno.test(
  'select: an unknown mode fails closed',
  withEnv({ ...CLEAN, APP_CHECK_MODE: 'bogus', IDENTIFY_PROVIDER: 'bogus' }, async () => {
    assertEquals(selectAppCheckMode(), 'firebase');
    const err = await assertRejects(
      () => selectIdentificationProvider().identify(input()),
      ApiError,
    );
    assertEquals(err.code, 'provider_unavailable');
  }),
);

Deno.test(
  'select: dev app check is refused outside a local stack',
  withEnv({ ...CLEAN, APP_CHECK_MODE: 'dev' }, async () => {
    assertEquals(selectAppCheckMode(), 'firebase');
    assertEquals(await selectAppCheck().verify('dev-ok'), 'invalid');
  }),
);

Deno.test(
  'select: fake provider is refused outside a local stack',
  withEnv({ ...CLEAN, IDENTIFY_PROVIDER: 'fake' }, async () => {
    const err = await assertRejects(
      () => selectIdentificationProvider().identify(input()),
      ApiError,
    );
    assertEquals(err.code, 'provider_unavailable');
  }),
);

Deno.test(
  'select: local stack with explicit dev and fake still gets them',
  withEnv(
    {
      ...CLEAN,
      SUPABASE_URL: 'http://localhost:54321',
      APP_CHECK_MODE: 'dev',
      IDENTIFY_PROVIDER: 'fake',
    },
    async () => {
      assertEquals(selectAppCheckMode(), 'dev');
      assertEquals(await selectAppCheck().verify('dev-ok'), 'valid');
      assertEquals((await selectIdentificationProvider().identify(input())).isPlant, true);
    },
  ),
);

Deno.test(
  'select: TENDRIL_LOCAL=1 still counts as local',
  withEnv({ ...CLEAN, TENDRIL_LOCAL: '1', APP_CHECK_MODE: 'dev' }, () => {
    assertEquals(selectAppCheckMode(), 'dev');
  }),
);

Deno.test(
  'select: instances are memoised until reset',
  withEnv({ ...CLEAN, SUPABASE_URL: 'http://kong:8000' }, () => {
    assert(selectAppCheck() === selectAppCheck());
    assert(selectIdentificationProvider() === selectIdentificationProvider());
    const a = selectAppCheck();
    resetSelectionForTests();
    assert(selectAppCheck() !== a);
  }),
);

Deno.test('firebase app check rejects HS256 and alg none tokens', async () => {
  const { publicKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const v = appCheckVerifier('firebase', {
    projectNumber: '123',
    appIds: ['app'],
    keyGetter: createLocalJWKSet({ keys: [jwk] }),
  });
  const claims = {
    iss: 'https://firebaseappcheck.googleapis.com/123',
    aud: ['projects/123'],
    sub: 'app',
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const hs = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256', kid: 'k1' })
    .sign(new TextEncoder().encode('secret-secret-secret-secret-secret!'));
  assertEquals(await v.verify(hs), 'invalid');
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
  const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.`;
  assertEquals(await v.verify(none), 'invalid');
});

Deno.test('firebase app check requires exp and sub', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const v = appCheckVerifier('firebase', {
    projectNumber: '123',
    appIds: ['app'],
    keyGetter: createLocalJWKSet({ keys: [jwk] }),
  });
  const noExp = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer('https://firebaseappcheck.googleapis.com/123')
    .setAudience(['projects/123'])
    .setSubject('app')
    .sign(privateKey);
  assertEquals(await v.verify(noExp), 'invalid');
});

Deno.test('mapping swaps inverted watering and clamps probability', async () => {
  const j = await load('plantid-peace-lily.json');
  const s = j.result.classification.suggestions[0];
  s.details.watering = { min: 3, max: 1 };
  s.probability = 1.4;
  j.result.classification.suggestions[1].probability = -0.2;
  const r = mapPlantIdResponse(j);
  assertEquals(r.suggestions[0]?.watering, { min: 1, max: 3 });
  assertEquals(r.suggestions[0]?.probability, 1);
  assertEquals(r.suggestions[1]?.probability, 0);
});

Deno.test('non-2xx logs only the status, never the body or key', async () => {
  const lines: string[] = [];
  const orig = console.error;
  console.error = (l: string) => lines.push(String(l));
  try {
    const p = plantIdProvider('secret-key', () =>
      Promise.resolve(new Response('SECRET BODY', { status: 502, headers: { 'x-h': 'hdr' } })),
    );
    await assertRejects(() => p.identify(input()), ApiError);
  } finally {
    console.error = orig;
  }
  const out = lines.join('\n');
  assert(out.includes('502'));
  assert(!out.includes('SECRET BODY') && !out.includes('secret-key') && !out.includes('hdr'));
});
