import { ApiError } from '../errors.ts';
import type { IdentificationProvider, IdentifyInput } from './identification.ts';
import { mapPlantIdResponse } from './plantid-map.ts';

const BASE = 'https://plant.id/api/v3';
const DETAILS = 'common_names,taxonomy,rank,gbif_id,image,watering,best_light_condition';
export const PLANT_ID_TIMEOUT_MS = 25_000;

type FetchFn = (url: string | URL, init?: RequestInit) => Promise<Response>;

const unavailable = (msg = 'Identification is unavailable. Try again soon.') =>
  new ApiError('provider_unavailable', msg);

/** Plant.id v3 over an injectable fetch. The timeout is enforced even if fetchFn ignores abort. */
export function plantIdProvider(
  apiKey: string,
  fetchFn: FetchFn = fetch,
  timeoutMs = PLANT_ID_TIMEOUT_MS,
): IdentificationProvider {
  async function post(path: string, body: unknown): Promise<Response> {
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        ctrl.abort();
        reject(unavailable());
      }, timeoutMs);
    });
    try {
      const res = await Promise.race([
        fetchFn(`${BASE}${path}`, {
          method: 'POST',
          headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        }),
        timeout,
      ]);
      if (res.status === 429) {
        throw unavailable('Identification is busy. Try again soon.');
      }
      if (!res.ok) throw unavailable();
      return res;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw unavailable();
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async identify(input: IdentifyInput) {
      const body: Record<string, unknown> = {
        images: input.imagesBase64.map((b) => `data:image/jpeg;base64,${b}`),
        latitude: input.lat,
        longitude: input.lng,
        datetime: input.datetime,
        similar_images: true,
        classification_level: 'species',
        ...(input.health ? { health: 'all' } : {}),
      };
      const res = await post(`/identification?details=${DETAILS}&language=en`, body);
      let json: unknown;
      try {
        json = await res.json();
      } catch {
        throw unavailable();
      }
      return mapPlantIdResponse(json);
    },
    async feedback(accessToken: string, comment: string) {
      await post(`/identification/${encodeURIComponent(accessToken)}/feedback`, { comment });
    },
  };
}
