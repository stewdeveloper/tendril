import type { SpeciesRef } from '@core/domain.ts';
import type { RarityTier } from '@core/toxicity.ts';
import type { Database } from '../../../packages/db/src/index.ts';
import type { Db } from './db.ts';
import { throwDbError } from './db.ts';
import { log } from './log.ts';
import type { ProviderSuggestion } from './providers/identification.ts';

export type SpeciesRow = Database['public']['Tables']['species']['Row'];

export function toSpeciesRef(row: SpeciesRow): SpeciesRef {
  return {
    id: row.id,
    commonName: row.common_name,
    scientificName: row.scientific_name,
    rarity: row.rarity_tier as RarityTier,
    sensitive: row.sensitive,
    imageUrl: row.image_url,
  };
}

export const sentenceCase = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** ASCII-folded kebab case, matching species.slug's `^[a-z0-9-]+$`. */
export function kebab(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const clampWatering = (n: number | null | undefined): number | null =>
  n === null || n === undefined || !Number.isFinite(n)
    ? null
    : Math.min(3, Math.max(1, Math.round(n)));

async function freeSlug(db: Db, base: string): Promise<string> {
  const candidates = [base, ...Array.from({ length: 19 }, (_, i) => `${base}-${i + 2}`)];
  const { data, error } = await db.from('species').select('slug').in('slug', candidates);
  if (error) throwDbError(error);
  const taken = new Set((data ?? []).map((r) => r.slug));
  const free = candidates.find((c) => !taken.has(c));
  if (!free) throw new Error(`no free slug for ${base}`);
  return free;
}

async function familyFromCatalogue(db: Db, genus: string): Promise<string | null> {
  const { data, error } = await db.from('species').select('family').eq('genus', genus);
  if (error) throwDbError(error);
  return (data ?? []).find((r) => r.family)?.family ?? null;
}

/**
 * Finds or creates the catalogue row for a provider suggestion: by provider_entity_id, then by scientific
 * name (the reference rows have no provider id yet; they gain it and keep their curated fields). A new row
 * with no family anywhere is inserted `sensitive`, since hiding a location is the safe side.
 */
export async function upsertSpeciesFromProvider(
  db: Db,
  s: ProviderSuggestion,
  retry = true,
): Promise<SpeciesRow> {
  const byEntity = await db
    .from('species')
    .select('*')
    .eq('provider_entity_id', s.providerEntityId)
    .maybeSingle();
  if (byEntity.error) throwDbError(byEntity.error);
  if (byEntity.data) return byEntity.data;

  const byName = await db
    .from('species')
    .select('*')
    .eq('scientific_name', s.scientificName)
    .maybeSingle();
  if (byName.error) throwDbError(byName.error);
  if (byName.data) {
    if (byName.data.provider_entity_id !== null) return byName.data;
    const upd = await db
      .from('species')
      .update({ provider_entity_id: s.providerEntityId, gbif_id: byName.data.gbif_id ?? s.gbifId })
      .eq('id', byName.data.id)
      .select('*')
      .single();
    if (upd.error) throwDbError(upd.error);
    return upd.data;
  }

  const genus = s.genus ?? s.scientificName.split(' ')[0] ?? null;
  const family = s.family ?? (genus ? await familyFromCatalogue(db, genus) : null);
  if (family === null) {
    log('warn', 'species_family_unknown', { scientificName: s.scientificName });
  }
  const common = s.commonNames[0]?.trim() || s.scientificName;
  const base = kebab(common) || kebab(s.scientificName) || 'plant';
  const ins = await db
    .from('species')
    .insert({
      provider_entity_id: s.providerEntityId,
      gbif_id: s.gbifId,
      scientific_name: s.scientificName,
      common_name: sentenceCase(common),
      family,
      genus,
      slug: await freeSlug(db, base),
      image_url: s.imageUrl,
      watering_min: clampWatering(s.watering?.min),
      watering_max: clampWatering(s.watering?.max),
      light: s.light,
      ...(family === null ? { sensitive: true } : {}),
    })
    .select('*')
    .single();
  if (ins.error) {
    if (ins.error.code === '23505' && retry) return upsertSpeciesFromProvider(db, s, false);
    throwDbError(ins.error);
  }
  return ins.data;
}
