import { importPKCS8, SignJWT } from 'jose';
import { log } from '../log.ts';
import type { WeatherForecast, WeatherProvider } from './weather.ts';

/**
 * Apple WeatherKit REST API (https://developer.apple.com/documentation/weatherkitrestapi):
 * `GET /api/v1/weather/{language}/{latitude}/{longitude}?dataSets=forecastHourly&hourlyStart&hourlyEnd&timezone`
 * returns `forecastHourly.hours[]` of HourWeatherConditions, each with `forecastStart`, `temperature` (°C) and
 * `precipitationAmount` (mm, liquid equivalent). Authorised by an ES256 developer token.
 */
const BASE = 'https://weatherkit.apple.com/api/v1/weather/en';
export const WEATHERKIT_TIMEOUT_MS = 10_000;
const TOKEN_TTL_S = 30 * 60;
/** A cached token is renewed this long before it expires. */
const TOKEN_RENEW_EARLY_S = 5 * 60;
const HOUR_MS = 60 * 60 * 1000;
const WINDOW_MS = 48 * HOUR_MS;

type FetchFn = (url: string | URL, init?: RequestInit) => Promise<Response>;

export interface WeatherKitConfig {
  /** The 10-character Apple Developer Team ID. */
  teamId: string;
  /** The registered WeatherKit Service ID, e.g. `com.example.weatherkit-client`. */
  serviceId: string;
  /** The WeatherKit key's Key ID. */
  keyId: string;
  /** The key as PKCS#8 PEM (the `.p8` file). Literal `\n` escapes are accepted. */
  privateKey: string;
}

export interface WeatherKitOptions {
  now?: () => Date;
  timeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f + 0; // + 0 turns -0 into 0
}

/** `2026-10-04T14:00:00Z`: the ISO 8601 form WeatherKit takes, without milliseconds. */
function isoSeconds(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Total precipitation and highest temperature over the hours starting in [startMs, endMs), each to 0.1. Rejects a
 * body with no hourly forecast, one marked temporarily unavailable, or one with no usable hour in the window.
 */
export function summariseHourly(json: unknown, startMs: number, endMs: number): WeatherForecast {
  const hourly = isRecord(json) ? json.forecastHourly : undefined;
  if (!isRecord(hourly) || !Array.isArray(hourly.hours)) {
    throw new Error('weatherkit: no hourly forecast in the response');
  }
  if (isRecord(hourly.metadata) && hourly.metadata.temporarilyUnavailable === true) {
    throw new Error('weatherkit: data temporarily unavailable');
  }
  let rain = 0;
  let maxTemp = -Infinity;
  let hours = 0;
  for (const h of hourly.hours) {
    if (!isRecord(h) || typeof h.forecastStart !== 'string') continue;
    const at = Date.parse(h.forecastStart);
    if (!Number.isFinite(at) || at < startMs || at >= endMs) continue;
    if (typeof h.temperature !== 'number' || !Number.isFinite(h.temperature)) continue;
    hours += 1;
    maxTemp = Math.max(maxTemp, h.temperature);
    const mm = h.precipitationAmount;
    if (typeof mm === 'number' && Number.isFinite(mm) && mm > 0) rain += mm;
  }
  if (hours === 0) throw new Error('weatherkit: no usable hours in the next 48 hours');
  return { rainNext48hMm: round(rain, 1), maxTempNext48hC: round(maxTemp, 1) };
}

/**
 * The next 48 hours from WeatherKit's hourly forecast. Apple sees only the coordinates it is given, rounded to 3
 * decimal places; errors never carry them. The developer token lives 30 minutes and is reused until 5 minutes before
 * it expires.
 */
export function weatherKitProvider(
  cfg: WeatherKitConfig,
  fetchFn: FetchFn = fetch,
  opts: WeatherKitOptions = {},
): WeatherProvider {
  const now = opts.now ?? (() => new Date());
  const timeoutMs = opts.timeoutMs ?? WEATHERKIT_TIMEOUT_MS;
  let key: Promise<CryptoKey> | null = null;
  let cached: { token: string; renewAtMs: number } | null = null;

  async function token(nowMs: number): Promise<string> {
    if (cached && nowMs < cached.renewAtMs) return cached.token;
    key ??= importPKCS8(cfg.privateKey.replaceAll('\\n', '\n'), 'ES256');
    let signingKey: CryptoKey;
    try {
      signingKey = await key;
    } catch {
      key = null;
      throw new Error('weatherkit: the private key could not be read');
    }
    const iat = Math.floor(nowMs / 1000);
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: cfg.keyId, id: `${cfg.teamId}.${cfg.serviceId}` })
      .setIssuer(cfg.teamId)
      .setSubject(cfg.serviceId)
      .setIssuedAt(iat)
      .setExpirationTime(iat + TOKEN_TTL_S)
      .sign(signingKey);
    cached = { token: jwt, renewAtMs: (iat + TOKEN_TTL_S - TOKEN_RENEW_EARLY_S) * 1000 };
    return jwt;
  }

  async function get(url: string, bearer: string): Promise<unknown> {
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        ctrl.abort();
        reject(new Error('weatherkit: request timed out'));
      }, timeoutMs);
    });
    const work = (async () => {
      let res: Response;
      try {
        res = await fetchFn(url, {
          method: 'GET',
          headers: { Authorization: `Bearer ${bearer}` },
          signal: ctrl.signal,
        });
      } catch {
        // A fetch error message can include the URL, which holds the coordinates.
        throw new Error('weatherkit: request failed (network)');
      }
      if (!res.ok) {
        await res.body?.cancel();
        if (res.status === 401 || res.status === 403) cached = null;
        log('warn', 'weatherkit_request_failed', { status: res.status });
        throw new Error(`weatherkit: request failed (${res.status})`);
      }
      try {
        return await res.json();
      } catch {
        throw new Error('weatherkit: response is not JSON');
      }
    })();
    try {
      return await Promise.race([work, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async forecast(lat, lng, timeZone) {
      const nowMs = now().getTime();
      const startMs = Math.floor(nowMs / HOUR_MS) * HOUR_MS;
      const endMs = startMs + WINDOW_MS;
      const query = new URLSearchParams({
        dataSets: 'forecastHourly',
        hourlyStart: isoSeconds(startMs),
        hourlyEnd: isoSeconds(endMs),
        timezone: timeZone,
      });
      const url = `${BASE}/${round(lat, 3)}/${round(lng, 3)}?${query}`;
      const json = await get(url, await token(nowMs));
      return summariseHourly(json, startMs, endMs);
    },
  };
}
