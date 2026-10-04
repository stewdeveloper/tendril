/** Reads an environment variable, or the fallback when it is unset or empty. */
export function env(name: string, fallback?: string): string {
  const value = Deno.env.get(name);
  if (value !== undefined && value !== '') return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing environment variable ${name}`);
}

/** The server-side key: `SUPABASE_SECRET_KEYS` (JSON, `.default`), else the legacy service-role key. */
export function secretKey(): string {
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { default?: unknown };
      if (typeof parsed.default === 'string' && parsed.default !== '') return parsed.default;
    } catch {
      // fall through to the legacy key
    }
  }
  return env('SUPABASE_SERVICE_ROLE_KEY');
}

const LOCAL_HOSTS = new Set(['kong', 'localhost', '127.0.0.1', 'host.docker.internal']);

/**
 * True on the local Supabase stack; Task 3 uses it to choose fail-closed defaults.
 * TENDRIL_LOCAL must never be set in production: it switches the defaults to dev/fake.
 */
export function isLocalStack(): boolean {
  if (Deno.env.get('TENDRIL_LOCAL') === '1') return true;
  const url = Deno.env.get('SUPABASE_URL');
  if (!url) return false;
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}
