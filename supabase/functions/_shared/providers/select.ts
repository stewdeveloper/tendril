import { env, isLocalStack } from '../env.ts';
import { ApiError } from '../errors.ts';
import { type AppCheckMode, type AppCheckVerifier, appCheckVerifier } from './appcheck.ts';
import { fakeIdentificationProvider } from './fake-identification.ts';
import type { IdentificationProvider } from './identification.ts';
import { plantIdProvider } from './plantid.ts';

type FetchFn = (url: string | URL, init?: RequestInit) => Promise<Response>;

/** Fail closed: only an explicit "dev" (or the local-stack default) disables App Check. */
export function selectAppCheckMode(): AppCheckMode {
  const v = env('APP_CHECK_MODE', isLocalStack() ? 'dev' : 'firebase');
  return v === 'dev' ? 'dev' : 'firebase';
}

export function selectAppCheck(): AppCheckVerifier {
  const mode = selectAppCheckMode();
  return appCheckVerifier(mode, {
    projectNumber: Deno.env.get('FIREBASE_PROJECT_NUMBER') || undefined,
    appIds: (Deno.env.get('FIREBASE_APP_IDS') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  });
}

const unavailable = () => new ApiError('provider_unavailable', 'Identification is unavailable.');

/** Fail closed: anything but an explicit "fake" is Plant.id; no API key means provider_unavailable. */
export function selectIdentificationProvider(fetchFn?: FetchFn): IdentificationProvider {
  const which = env('IDENTIFY_PROVIDER', isLocalStack() ? 'fake' : 'plantid');
  if (which === 'fake') return fakeIdentificationProvider();
  const key = Deno.env.get('PLANT_ID_API_KEY');
  if (!key) {
    return {
      identify: () => Promise.reject(unavailable()),
      feedback: () => Promise.reject(unavailable()),
    };
  }
  return plantIdProvider(key, fetchFn);
}
