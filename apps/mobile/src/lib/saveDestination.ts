import type { Outcome } from '@tendril/core';

/** What the moment needs to name the right species and open the right plant. */
export interface SavedFind {
  observationId: string;
  /** The species the person confirmed: the moment names it, not always the top match. */
  speciesId: string;
  /** The plant just added, when there is one, so Continue can open it. */
  plantId?: string;
}

/**
 * Where a saved scan goes next. A species new to the Plantdex gets its moment first; anything else
 * goes to `fallback`.
 */
export function saveDestination(
  outcome: Outcome | null,
  find: SavedFind,
  fallback: string,
): string {
  if (!outcome?.newToPlantdex) return fallback;
  const query = new URLSearchParams({ speciesId: find.speciesId });
  if (find.plantId) query.set('plantId', find.plantId);
  return `/scan/${find.observationId}/new-species?${query.toString()}`;
}

/**
 * A scan the server says is already saved: that is a success, so look its outcome up and route as
 * a save would. Null when the lookup fails, and the caller says "This one's already saved."
 */
export async function savedDestination(
  fetchOutcome: (observationId: string) => Promise<Outcome>,
  find: SavedFind,
  fallback: string,
): Promise<string | null> {
  try {
    return saveDestination(await fetchOutcome(find.observationId), find, fallback);
  } catch {
    return null;
  }
}
