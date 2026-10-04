import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import { log } from '../log.ts';

export type AppCheckMode = 'dev' | 'firebase';
export type AppCheckResult = 'valid' | 'missing' | 'invalid';
export interface AppCheckConfig {
  projectNumber?: string;
  appIds?: string[];
  /** Injected key source for tests; defaults to Firebase's remote JWKS. */
  keyGetter?: JWTVerifyGetKey;
}
export interface AppCheckVerifier {
  verify(token: string | null): Promise<AppCheckResult>;
}

const JWKS_URL = 'https://firebaseappcheck.googleapis.com/v1/jwks';

export function appCheckVerifier(mode: AppCheckMode, cfg: AppCheckConfig): AppCheckVerifier {
  if (mode === 'dev') {
    return {
      verify: (token) =>
        Promise.resolve(
          token === null || token === '' ? 'missing' : token === 'dev-ok' ? 'valid' : 'invalid',
        ),
    };
  }
  let getKey = cfg.keyGetter;
  return {
    async verify(token) {
      if (token === null || token === '') return 'missing';
      const { projectNumber, appIds } = cfg;
      if (!projectNumber || !appIds || appIds.length === 0) {
        log('error', 'app check misconfigured', {});
        return 'invalid';
      }
      try {
        getKey ??= createRemoteJWKSet(new URL(JWKS_URL));
        const { payload } = await jwtVerify(token, getKey, {
          algorithms: ['RS256'],
          requiredClaims: ['exp', 'sub'],
          issuer: `https://firebaseappcheck.googleapis.com/${projectNumber}`,
          audience: `projects/${projectNumber}`,
        });
        return typeof payload.sub === 'string' && appIds.includes(payload.sub)
          ? 'valid'
          : 'invalid';
      } catch {
        return 'invalid';
      }
    },
  };
}
