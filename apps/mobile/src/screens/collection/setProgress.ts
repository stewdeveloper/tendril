import type { CollectionSet, PlantdexEntry, SpeciesRef } from '@tendril/core';

export type PlantdexFilter = 'all' | 'houseplant' | 'wild';

export interface SetTileState {
  /** The set's species for this slot, or null when the set has not revealed it. */
  species: SpeciesRef | null;
  /** The person's Plantdex entry for it: a species is found only when this exists. */
  entry: PlantdexEntry | null;
}

export interface SetProgress {
  found: number;
  total: number;
  tiles: SetTileState[];
}

/**
 * A set's progress from the person's Plantdex entries. A tile is found only when an entry exists
 * for its species; what the set itself claims is never the source of truth, so the tiles, the
 * progress card and the Sets rows cannot disagree.
 */
export function setProgressFrom(
  set: CollectionSet,
  entriesById: ReadonlyMap<string, PlantdexEntry>,
): SetProgress {
  const tiles = set.tiles.map((t): SetTileState => {
    const entry = t.species ? (entriesById.get(t.species.id) ?? null) : null;
    return { species: entry ? t.species : null, entry };
  });
  return { found: tiles.filter((t) => t.entry).length, total: set.total, tiles };
}

/**
 * The set the Plantdex's progress card shows: the first incomplete one that has something found
 * under the filter (the entries are already filtered), else the first such set. Null hides the card.
 */
export function progressCardSet(
  sets: CollectionSet[],
  entriesById: ReadonlyMap<string, PlantdexEntry>,
  filter: PlantdexFilter,
): { set: CollectionSet; progress: SetProgress } | null {
  const all = sets.map((set) => ({ set, progress: setProgressFrom(set, entriesById) }));
  const shown = filter === 'all' ? all : all.filter((s) => s.progress.found > 0);
  return shown.find((s) => s.progress.found < s.progress.total) ?? shown[0] ?? null;
}
