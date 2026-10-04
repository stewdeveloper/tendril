import type { FindListItem } from '@tendril/core';

/** A find that can be drawn on the map: exact coordinates, never a sensitive species'. */
export type FindPin = { observationId: string; latitude: number; longitude: number };

/**
 * The pins for the person's own finds. A sensitive species never gets one, whatever coordinates the
 * find carries: its location stays private even from its owner's map (4aj). A find without a
 * position (location was off) has nothing to pin.
 */
export function findPins(finds: FindListItem[]): FindPin[] {
  return finds.flatMap((f) =>
    f.species.sensitive || f.lat == null || f.lng == null
      ? []
      : [{ observationId: f.observationId, latitude: f.lat, longitude: f.lng }],
  );
}
