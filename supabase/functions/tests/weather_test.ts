import { assert, assertEquals, assertNotEquals, assertRejects } from '@std/assert';
import { decodeProtectedHeader, exportPKCS8, generateKeyPair, jwtVerify } from 'jose';
import { fakeWeatherProvider } from '../_shared/providers/weather.ts';
import { weatherKitProvider } from '../_shared/providers/weatherkit.ts';
import { resetSelectionForTests, selectWeatherProvider } from '../_shared/providers/select.ts';

type FetchFn = (url: string | URL, init?: RequestInit) => Promise<Response>;

const fixture = async () =>
  await Deno.readTextFile(
    new URL('../_shared/providers/fixtures/weatherkit-hourly.json', import.meta.url),
  );

const NOW = new Date('2026-10-04T14:23:10Z');

async function keys(): Promise<{ pem: string; publicKey: CryptoKey }> {
  const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
  return { pem: await exportPKCS8(privateKey), publicKey };
}

const cfg = (privateKey: string) => ({
  teamId: 'TEAM123456',
  serviceId: 'com.example.tendril-weather',
  keyId: 'KEY1234567',
  privateKey,
});

interface Captured {
  url: URL;
  init: RequestInit | undefined;
}

function stubFetch(body: string | (() => Promise<string>), status = 200) {
  const calls: Captured[] = [];
  const fn: FetchFn = async (url, init) => {
    calls.push({ url: new URL(String(url)), init });
    return new Response(typeof body === 'string' ? body : await body(), { status });
  };
  return { fn, calls };
}

const bearer = (c: Captured) => {
  const h = new Headers(c.init?.headers).get('authorization') ?? '';
  return h.replace(/^Bearer /, '');
};

Deno.test('weatherkit: maps the hourly fixture over the next 48 hours', async () => {
  const { pem } = await keys();
  const { fn, calls } = stubFetch(fixture);
  const p = weatherKitProvider(cfg(pem), fn, { now: () => NOW });
  // The fixture's 49th hour (2026-10-06T14:00Z, 3 mm, 22.6 °C) is outside the window.
  assertEquals(await p.forecast(53.35, -6.26, 'Europe/Dublin'), {
    rainNext48hMm: 6.5,
    maxTempNext48hC: 21.4,
  });
  assertEquals(calls.length, 1);
  const { url, init } = calls[0]!;
  assertEquals(url.origin, 'https://weatherkit.apple.com');
  assertEquals(url.pathname, '/api/v1/weather/en/53.35/-6.26');
  assertEquals(url.searchParams.get('dataSets'), 'forecastHourly');
  assertEquals(url.searchParams.get('hourlyStart'), '2026-10-04T14:00:00Z');
  assertEquals(url.searchParams.get('hourlyEnd'), '2026-10-06T14:00:00Z');
  assertEquals(url.searchParams.get('timezone'), 'Europe/Dublin');
  assertEquals(init?.method ?? 'GET', 'GET');
  assert(bearer(calls[0]!).split('.').length === 3, 'a signed JWT is sent as the bearer');
});

Deno.test('weatherkit: Apple only sees coordinates rounded to 3 decimal places', async () => {
  const { pem } = await keys();
  const { fn, calls } = stubFetch(fixture);
  const p = weatherKitProvider(cfg(pem), fn, { now: () => NOW });
  await p.forecast(53.3498712, -6.2604491, 'Europe/Dublin');
  assertEquals(calls[0]!.url.pathname, '/api/v1/weather/en/53.35/-6.26');
  await p.forecast(-33.86785, 151.20732, 'Australia/Sydney');
  assertEquals(calls[1]!.url.pathname, '/api/v1/weather/en/-33.868/151.207');
});

Deno.test(
  'weatherkit: the JWT is ES256 with kid and id, and only iss, sub, iat and exp',
  async () => {
    const { pem, publicKey } = await keys();
    const { fn, calls } = stubFetch(fixture);
    await weatherKitProvider(cfg(pem), fn, { now: () => NOW }).forecast(
      53.35,
      -6.26,
      'Europe/Dublin',
    );
    const token = bearer(calls[0]!);
    assertEquals(decodeProtectedHeader(token), {
      alg: 'ES256',
      kid: 'KEY1234567',
      id: 'TEAM123456.com.example.tendril-weather',
    });
    const iat = Math.floor(NOW.getTime() / 1000);
    const { payload } = await jwtVerify(token, publicKey, {
      currentDate: NOW,
      algorithms: ['ES256'],
    });
    assertEquals(payload, {
      iss: 'TEAM123456',
      sub: 'com.example.tendril-weather',
      iat,
      exp: iat + 30 * 60,
    });
  },
);

Deno.test('weatherkit: a private key with literal \\n escapes is accepted', async () => {
  const { pem } = await keys();
  const escaped = pem.trim().replaceAll('\n', '\\n');
  assert(!escaped.includes('\n'));
  const { fn } = stubFetch(fixture);
  const p = weatherKitProvider(cfg(escaped), fn, { now: () => NOW });
  assertEquals((await p.forecast(53.35, -6.26, 'Europe/Dublin')).maxTempNext48hC, 21.4);
});

Deno.test('weatherkit: the token is reused until 5 minutes before it expires', async () => {
  const { pem } = await keys();
  const { fn, calls } = stubFetch(fixture);
  let now = NOW;
  const p = weatherKitProvider(cfg(pem), fn, { now: () => now });
  await p.forecast(53.35, -6.26, 'Europe/Dublin');
  now = new Date(NOW.getTime() + 24 * 60_000);
  await p.forecast(53.35, -6.26, 'Europe/Dublin');
  assertEquals(bearer(calls[1]!), bearer(calls[0]!), 'reused at 24 minutes');
  now = new Date(NOW.getTime() + 25 * 60_000 + 1000);
  await p.forecast(53.35, -6.26, 'Europe/Dublin');
  assertNotEquals(bearer(calls[2]!), bearer(calls[0]!), 'renewed after 25 minutes');
});

Deno.test('weatherkit: a failed request rejects without coordinates in the error', async () => {
  const { pem } = await keys();
  for (const status of [401, 429, 500]) {
    const { fn } = stubFetch('{"reason":"NOT_ENABLED"}', status);
    const p = weatherKitProvider(cfg(pem), fn, { now: () => NOW });
    const err = await assertRejects(() => p.forecast(53.35, -6.26, 'Europe/Dublin'));
    const message = (err as Error).message;
    assert(message.includes(String(status)), message);
    assert(!message.includes('53.35') && !message.includes('6.26'), message);
  }
  const network: FetchFn = (url) =>
    Promise.reject(new TypeError(`error sending request for url (${url})`));
  const err = await assertRejects(() =>
    weatherKitProvider(cfg(pem), network, { now: () => NOW }).forecast(53.35, -6.26, 'UTC'),
  );
  assert(!(err as Error).message.includes('53.35'), (err as Error).message);
});

Deno.test('weatherkit: a malformed or empty forecast rejects', async () => {
  const { pem } = await keys();
  const bodies = [
    'not json',
    '{}',
    '{"forecastHourly":{"hours":"nope"}}',
    '{"forecastHourly":{"metadata":{},"hours":[]}}',
    // Hours, but none inside the window.
    '{"forecastHourly":{"hours":[{"forecastStart":"2026-10-09T00:00:00Z","temperature":10}]}}',
    // Hours in the window without a temperature.
    '{"forecastHourly":{"hours":[{"forecastStart":"2026-10-04T15:00:00Z","precipitationAmount":1}]}}',
  ];
  for (const body of bodies) {
    const { fn } = stubFetch(body);
    await assertRejects(
      () => weatherKitProvider(cfg(pem), fn, { now: () => NOW }).forecast(53.35, -6.26, 'UTC'),
      Error,
      undefined,
      body,
    );
  }
  const unavailable = JSON.stringify({
    forecastHourly: {
      metadata: { temporarilyUnavailable: true },
      hours: [{ forecastStart: '2026-10-04T15:00:00Z', temperature: 10 }],
    },
  });
  const { fn } = stubFetch(unavailable);
  await assertRejects(() =>
    weatherKitProvider(cfg(pem), fn, { now: () => NOW }).forecast(53.35, -6.26, 'UTC'),
  );
});

Deno.test('weatherkit: a missing or negative precipitation counts as none', async () => {
  const { pem } = await keys();
  const body = JSON.stringify({
    forecastHourly: {
      hours: [
        { forecastStart: '2026-10-04T14:00:00Z', temperature: 9.04 },
        { forecastStart: '2026-10-04T15:00:00Z', temperature: 11.26, precipitationAmount: -1 },
        { forecastStart: '2026-10-04T16:00:00Z', temperature: 10, precipitationAmount: 0.1 },
        { forecastStart: '2026-10-04T17:00:00Z', temperature: 10, precipitationAmount: 0.2 },
      ],
    },
  });
  const { fn } = stubFetch(body);
  assertEquals(
    await weatherKitProvider(cfg(pem), fn, { now: () => NOW }).forecast(53.35, -6.26, 'UTC'),
    { rainNext48hMm: 0.3, maxTempNext48hC: 11.3 },
    'rounded to 0.1',
  );
});

Deno.test('weatherkit: times out when fetch never resolves', async () => {
  const { pem } = await keys();
  const hang: FetchFn = () => new Promise(() => {});
  const started = Date.now();
  await assertRejects(() =>
    weatherKitProvider(cfg(pem), hang, { now: () => NOW, timeoutMs: 20 }).forecast(1, 2, 'UTC'),
  );
  assert(Date.now() - started < 2000);
});

Deno.test('fake weather: dry and mild by default, or the given summary', async () => {
  assertEquals(await fakeWeatherProvider().forecast(53.35, -6.26, 'Europe/Dublin'), {
    rainNext48hMm: 0,
    maxTempNext48hC: 18,
  });
  const wet = fakeWeatherProvider({ rainNext48hMm: 12, maxTempNext48hC: 9 });
  assertEquals(await wet.forecast(0, 0, 'UTC'), { rainNext48hMm: 12, maxTempNext48hC: 9 });
});

// Selection ---------------------------------------------------------------------------------------------------------

const WK = [
  'WEATHERKIT_TEAM_ID',
  'WEATHERKIT_SERVICE_ID',
  'WEATHERKIT_KEY_ID',
  'WEATHERKIT_PRIVATE_KEY',
];
const CLEAN: Record<string, string | undefined> = {
  SUPABASE_URL: 'https://abc.supabase.co',
  TENDRIL_LOCAL: undefined,
  WEATHER_PROVIDER: undefined,
  ...Object.fromEntries(WK.map((k) => [k, undefined])),
};

function withEnv(
  vars: Record<string, string | undefined>,
  fn: (logs: string[]) => Promise<void> | void,
) {
  return async () => {
    const saved = Object.keys(vars).map((k) => [k, Deno.env.get(k)] as const);
    const logs: string[] = [];
    const { error, warn, log } = console;
    console.error = console.warn = console.log = (...a: unknown[]) => logs.push(a.join(' '));
    try {
      resetSelectionForTests();
      for (const [k, v] of Object.entries(vars)) {
        if (v === undefined) Deno.env.delete(k);
        else Deno.env.set(k, v);
      }
      await fn(logs);
    } finally {
      Object.assign(console, { error, warn, log });
      resetSelectionForTests();
      for (const [k, v] of saved) {
        if (v === undefined) Deno.env.delete(k);
        else Deno.env.set(k, v);
      }
    }
  };
}

const fullWeatherKit = async () => ({
  WEATHERKIT_TEAM_ID: 'TEAM123456',
  WEATHERKIT_SERVICE_ID: 'com.example.tendril-weather',
  WEATHERKIT_KEY_ID: 'KEY1234567',
  WEATHERKIT_PRIVATE_KEY: (await keys()).pem.trim().replaceAll('\n', '\\n'),
});

Deno.test(
  'select weather: a local stack defaults to the fake',
  withEnv({ ...CLEAN, SUPABASE_URL: 'http://kong:8000' }, async () => {
    const p = selectWeatherProvider();
    assert(p);
    assertEquals(await p.forecast(53.35, -6.26, 'UTC'), { rainNext48hMm: 0, maxTempNext48hC: 18 });
  }),
);

Deno.test(
  'select weather: production defaults to weatherkit; any missing WEATHERKIT_* is no weather, logged once',
  withEnv(CLEAN, async (logs) => {
    assertEquals(selectWeatherProvider(), null);
    assertEquals(selectWeatherProvider(), null);
    const unavailable = logs.filter((l) => l.includes('weather_unavailable'));
    assertEquals(unavailable.length, 1, logs.join('\n'));
    assert(unavailable[0]!.includes('WEATHERKIT_TEAM_ID'), 'names the missing variables');
    const full = await fullWeatherKit();
    for (const name of WK) {
      resetSelectionForTests();
      for (const [k, v] of Object.entries(full)) Deno.env.set(k, v);
      Deno.env.delete(name);
      assertEquals(selectWeatherProvider(), null, `${name} missing`);
    }
  }),
);

Deno.test(
  'select weather: fake is refused outside a local stack',
  withEnv({ ...CLEAN, WEATHER_PROVIDER: 'fake' }, (logs) => {
    assertEquals(selectWeatherProvider(), null);
    assert(
      logs.some((l) => l.includes('weather_fake_refused')),
      logs.join('\n'),
    );
  }),
);

Deno.test('select weather: weatherkit with full config is used, and memoised', async () => {
  const full = await fullWeatherKit();
  await withEnv({ ...CLEAN, ...full }, async (logs) => {
    const { fn, calls } = stubFetch(fixture);
    const p = selectWeatherProvider(fn);
    assert(p);
    assertEquals(selectWeatherProvider(), p, 'memoised');
    await p.forecast(53.35, -6.26, 'Europe/Dublin');
    assertEquals(calls.length, 1);
    assertEquals(calls[0]!.url.origin, 'https://weatherkit.apple.com');
    assert(!logs.join('\n').includes(full.WEATHERKIT_PRIVATE_KEY.slice(30, 60)), 'no key in logs');
  })();
});

Deno.test(
  'select weather: an explicit weatherkit on a local stack still needs its config',
  withEnv(
    { ...CLEAN, SUPABASE_URL: 'http://127.0.0.1:54321', WEATHER_PROVIDER: 'weatherkit' },
    () => {
      assertEquals(selectWeatherProvider(), null);
    },
  ),
);

Deno.test(
  'select weather: an unknown value fails closed to weatherkit',
  withEnv({ ...CLEAN, SUPABASE_URL: 'http://kong:8000', WEATHER_PROVIDER: 'bogus' }, () => {
    assertEquals(selectWeatherProvider(), null);
  }),
);
