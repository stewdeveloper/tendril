import { env, isLocalStack } from '../env.ts';
import { ApiError } from '../errors.ts';
import { log } from '../log.ts';
import { type AppCheckMode, type AppCheckVerifier, appCheckVerifier } from './appcheck.ts';
import { fakeIdentificationProvider } from './fake-identification.ts';
import type { IdentificationProvider } from './identification.ts';
import { plantIdProvider } from './plantid.ts';

type FetchFn = (url: string | URL, init?: RequestInit) => Promise<Response>;

let appCheckInstance: AppCheckVerifier | undefined;
let providerInstance: IdentificationProvider | undefined;

/** Clears the memoised instances; tests call this after changing env. */
export function resetSelectionForTests(): void {
  appCheckInstance = undefined;
  providerInstance = undefined;
}

/** Fail closed: dev is honoured only on a local stack, and is the default only there. */
export function selectAppCheckMode(): AppCheckMode {
  const local = isLocalStack();
  const v = env('APP_CHECK_MODE', local ? 'dev' : 'firebase');
  if (v === 'dev' && !local) {
    log('error', 'APP_CHECK_MODE=dev refused outside a local stack; using firebase');
    return 'firebase';
  }
  return v === 'dev' ? 'dev' : 'firebase';
}

/** Memoised so the remote JWKS cache survives across requests in an isolate. */
export function selectAppCheck(): AppCheckVerifier {
  appCheckInstance ??= appCheckVerifier(selectAppCheckMode(), {
    projectNumber: Deno.env.get('FIREBASE_PROJECT_NUMBER') || undefined,
    appIds: (Deno.env.get('FIREBASE_APP_IDS') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  });
  return appCheckInstance;
}

const unavailable = () => new ApiError('provider_unavailable', 'Identification is unavailable.');

/**
 * Fail closed: fake is honoured only on a local stack; anything else is Plant.id, and no API
 * key means provider_unavailable. Memoised; `fetchFn` is only used when first built.
 */
export function selectIdentificationProvider(fetchFn?: FetchFn): IdentificationProvider {
  if (providerInstance) return providerInstance;
  const local = isLocalStack();
  let which = env('IDENTIFY_PROVIDER', local ? 'fake' : 'plantid');
  if (which === 'fake' && !local) {
    log('error', 'IDENTIFY_PROVIDER=fake refused outside a local stack; using plantid');
    which = 'plantid';
  }
  if (which === 'fake') {
    providerInstance = fakeIdentificationProvider();
    return providerInstance;
  }
  const key = Deno.env.get('PLANT_ID_API_KEY');
  if (!key) {
    log('error', 'PLANT_ID_API_KEY is not set; identification is unavailable');
    providerInstance = {
      identify: () => Promise.reject(unavailable()),
      feedback: () => Promise.reject(unavailable()),
    };
    return providerInstance;
  }
  providerInstance = plantIdProvider(key, fetchFn);
  return providerInstance;
}
