import { ApiError } from '../errors.ts';
import { log } from '../log.ts';
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
  async function post<T>(
    path: string,
    body: unknown,
    read: (res: Response) => Promise<T>,
  ): Promise<T> {
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        ctrl.abort();
        reject(unavailable());
      }, timeoutMs);
    });
    const work = (async () => {
      const res = await fetchFn(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        log('error', 'plant.id request failed', { status: res.status });
        throw unavailable(
          res.status === 429 ? 'Identification is busy. Try again soon.' : undefined,
        );
      }
      return await read(res);
    })();
    try {
      return await Promise.race([work, timeout]);
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
      const json = await post(`/identification?details=${DETAILS}&language=en`, body, (r) =>
        r.json(),
      );
      return mapPlantIdResponse(json);
    },
    async feedback(accessToken: string, comment: string) {
      await post(`/identification/${encodeURIComponent(accessToken)}/feedback`, { comment }, (r) =>
        r.arrayBuffer(),
      );
    },
  };
}
