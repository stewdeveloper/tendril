// The JPEG fixtures (gps.jpg, xmp.jpg, plain.jpg) are generated once with:
//   deno run --config supabase/functions/deno.json --allow-write supabase/functions/tests/fixtures/make-gps-fixture.ts
import { assertEquals, assertRejects } from '@std/assert';
import { ApiError, errorResponse, statusFor } from '../_shared/errors.ts';
import { json, readJson, router } from '../_shared/http.ts';
import { cellsFor, toBigint } from '../_shared/h3.ts';
import { assertNoGps, stripExif } from '../_shared/exif.ts';
import { env, isLocalStack, secretKey } from '../_shared/env.ts';
import { requireUser, supabaseUserVerifier } from '../_shared/auth.ts';
import type { Db } from '../_shared/db.ts';

function withEnv(vars: Record<string, string | undefined>, fn: () => void): void {
  const saved = Object.keys(vars).map((k) => [k, Deno.env.get(k)] as const);
  try {
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
    fn();
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
}

Deno.test('router matches routes under the function prefix and 404s others', async () => {
  const handle = router('me', [
    {
      method: 'GET',
      pattern: new URLPattern({ pathname: '/ping/:id' }),
      handle: (_r, p) => Promise.resolve(json({ id: p.id })),
    },
  ]);
  const ok = await handle(new Request('http://x/functions/v1/me/ping/7'));
  assertEquals(await ok.json(), { id: '7' });
  assertEquals(ok.headers.has('x-request-id'), true);
  assertEquals((await handle(new Request('http://x/me/ping/8'))).status, 200);
  const missing = await handle(new Request('http://x/functions/v1/me/nope'));
  assertEquals(missing.status, 404);
  assertEquals((await missing.json()).error.code, 'not_found');
});

Deno.test('router answers OPTIONS with CORS headers', async () => {
  const handle = router('me', []);
  const res = await handle(new Request('http://x/functions/v1/me/ping', { method: 'OPTIONS' }));
  assertEquals(res.status, 204);
  assertEquals(res.headers.get('access-control-allow-origin'), '*');
  assertEquals(
    res.headers.get('access-control-allow-headers')?.includes('x-firebase-appcheck'),
    true,
  );
});

Deno.test('readJson rejects oversized and malformed bodies with invalid_input', async () => {
  await assertRejects(
    () => readJson(new Request('http://x', { method: 'POST', body: '{bad' })),
    ApiError,
  );
  const big = JSON.stringify({ a: 'x'.repeat(70_000) });
  JSON.parse(big); // valid JSON, so only the size limit can reject it
  const err = await assertRejects(
    () => readJson(new Request('http://x', { method: 'POST', body: big })),
    ApiError,
  );
  assertEquals(err.message, 'Request body is too large.');
  assertEquals(await readJson(new Request('http://x', { method: 'POST', body: '{"a":1}' })), {
    a: 1,
  });
});

Deno.test('errorResponse maps codes to statuses and hides unknown errors', async () => {
  assertEquals(errorResponse(new ApiError('quota_exceeded', 'Limit reached.'), 'r1').status, 429);
  assertEquals(statusFor('provider_unavailable'), 503);
  const hidden = errorResponse(new Error('db password is hunter2'), 'r2');
  assertEquals(hidden.status, 500);
  assertEquals((await hidden.json()).error.message, 'Something went wrong.');
});

Deno.test('h3 cells are stable bigints', () => {
  const a = cellsFor(53.35, -6.26);
  const b = cellsFor(53.35, -6.26);
  assertEquals(a.r7, b.r7);
  assertEquals(typeof a.r5, 'bigint');
  assertEquals(a.r5 > 0n, true);
  assertEquals(a.r5, toBigint(a.r5Hex));
});

Deno.test('stripExif removes GPS from a JPEG', async () => {
  const withGps = await Deno.readFile(new URL('./fixtures/gps.jpg', import.meta.url));
  const stripped = stripExif(withGps);
  await assertNoGps(stripped);
  await assertRejects(() => assertNoGps(withGps), ApiError);
});

const fixture = (name: string) => Deno.readFile(new URL(`./fixtures/${name}`, import.meta.url));

Deno.test('stripExif removes XMP, IPTC and COM segments and assertNoGps agrees', async () => {
  const withXmp = await fixture('xmp.jpg');
  await assertRejects(() => assertNoGps(withXmp), ApiError);
  const stripped = stripExif(withXmp);
  await assertNoGps(stripped);
  const text = new TextDecoder('latin1').decode(stripped);
  assertEquals(text.includes('GPSLatitude'), false);
  assertEquals(text.includes('taken at home'), false);
});

Deno.test('stripExif round-trips a metadata-free JPEG', async () => {
  const plain = await fixture('plain.jpg');
  const out = stripExif(plain);
  assertEquals([out[0], out[1]], [0xff, 0xd8]);
  assertEquals([out[out.length - 2], out[out.length - 1]], [0xff, 0xd9]);
  assertEquals(out, plain);
  await assertNoGps(out);
});

Deno.test('stripExif rejects PNG, truncated and empty input with invalid_input', async () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const gps = await fixture('gps.jpg');
  const inputs = [png, new Uint8Array(0), gps.subarray(0, 30), gps.subarray(0, gps.length - 2)];
  for (const input of inputs) {
    let code = '';
    try {
      stripExif(input);
    } catch (e) {
      code = (e as ApiError).code;
    }
    assertEquals(code, 'invalid_input', `length ${input.length}`);
  }
});

Deno.test('env, secretKey and isLocalStack', () => {
  withEnv({ T_X: undefined }, () => {
    assertEquals(env('T_X', 'fb'), 'fb');
    try {
      env('T_X');
      throw new Error('should have thrown');
    } catch (e) {
      assertEquals((e as Error).message, 'Missing environment variable T_X');
    }
  });
  withEnv(
    { SUPABASE_SECRET_KEYS: '{"default":"sb_secret_a"}', SUPABASE_SERVICE_ROLE_KEY: 'legacy' },
    () => assertEquals(secretKey(), 'sb_secret_a'),
  );
  withEnv({ SUPABASE_SECRET_KEYS: undefined, SUPABASE_SERVICE_ROLE_KEY: 'legacy' }, () =>
    assertEquals(secretKey(), 'legacy'),
  );
  for (const host of ['kong', 'localhost', '127.0.0.1', 'host.docker.internal']) {
    withEnv({ SUPABASE_URL: `http://${host}:8000`, TENDRIL_LOCAL: undefined }, () =>
      assertEquals(isLocalStack(), true, host),
    );
  }
  withEnv({ SUPABASE_URL: 'https://abc.supabase.co', TENDRIL_LOCAL: undefined }, () =>
    assertEquals(isLocalStack(), false),
  );
  withEnv({ SUPABASE_URL: 'https://abc.supabase.co', TENDRIL_LOCAL: '1' }, () =>
    assertEquals(isLocalStack(), true),
  );
  withEnv({ SUPABASE_URL: undefined, TENDRIL_LOCAL: undefined }, () =>
    assertEquals(isLocalStack(), false),
  );
});

Deno.test('requireUser verifies the Bearer token and throws unauthenticated', async () => {
  const db = {
    auth: {
      getUser: (t: string) =>
        Promise.resolve(
          t === 'good'
            ? { data: { user: { id: 'u1' } }, error: null }
            : { data: { user: null }, error: new Error('bad') },
        ),
    },
  } as unknown as Db;
  const verifier = supabaseUserVerifier(db);
  const req = (auth?: string) =>
    new Request('http://x', { headers: auth ? { authorization: auth } : {} });
  assertEquals(await requireUser(verifier, req('Bearer good')), 'u1');
  for (const a of [undefined, 'Bearer nope', 'Basic good']) {
    const err = await assertRejects(() => requireUser(verifier, req(a)), ApiError);
    assertEquals(err.code, 'unauthenticated');
  }
});
