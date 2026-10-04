import type { Outcome } from '@tendril/core';

/**
 * Where a saved scan goes next. A species new to the Plantdex gets its moment first (carrying the
 * plant, when there is one, so Continue can open it); anything else goes to `fallback`.
 */
export function saveDestination(
  outcome: Outcome | null,
  observationId: string,
  fallback: string,
  plantId?: string,
): string {
  if (!outcome?.newToPlantdex) return fallback;
  const base = `/scan/${observationId}/new-species`;
  return plantId ? `${base}?plantId=${encodeURIComponent(plantId)}` : base;
}

/**
 * A scan the server says is already saved: that is a success, so look its outcome up and route as
 * a save would. Null when the lookup fails, and the caller says "This one's already saved."
 */
export async function savedDestination(
  fetchOutcome: (observationId: string) => Promise<Outcome>,
  observationId: string,
  fallback: string,
  plantId?: string,
): Promise<string | null> {
  try {
    return saveDestination(await fetchOutcome(observationId), observationId, fallback, plantId);
  } catch {
    return null;
  }
}
