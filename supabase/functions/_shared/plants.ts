import { baseIntervalDays } from '@core/care/basic.ts';
import type { IsoDate, PlantSetup } from '@core/domain.ts';
import { addDays } from '@core/period.ts';
import { callPrivate, type Db, throwDbError } from './db.ts';
import { ApiError } from './errors.ts';
import { resolveHousehold } from './households.ts';

export interface CreatePlantInput {
  userId: string;
  /** The caller must be a member. Defaults to the caller's own household (owner first). */
  householdId?: string;
  speciesId: string;
  setup: PlantSetup;
  source: 'scan' | 'label_qr' | 'gift' | 'manual';
  observationId?: string | null;
  labelCode?: string | null;
  /** The user's local date; the first check falls one base interval after it. */
  today: IsoDate;
  now?: Date;
  /** A retry with the same id returns the first plant. */
  clientId?: string;
}

/**
 * Creates a plant with its first check task and its setup event, all in one transaction (`srv_create_plant`,
 * which also checks household membership and observation ownership). Returns the plant id.
 */
export async function createPlant(db: Db, input: CreatePlantInput): Promise<string> {
  const householdId = await resolveHousehold(db, input.userId, input.householdId);
  const sp = await db
    .from('species')
    .select('watering_min, watering_max, check_interval_days')
    .eq('id', input.speciesId)
    .maybeSingle();
  if (sp.error) throwDbError(sp.error);
  if (!sp.data) throw new ApiError('invalid_input', 'That species is not known.');
  const interval = baseIntervalDays(
    { min: sp.data.watering_min, max: sp.data.watering_max },
    sp.data.check_interval_days,
  );
  const s = input.setup;
  const id = await callPrivate(db, 'srv_create_plant', {
    p_uid: input.userId,
    p_household_id: householdId,
    p_species_id: input.speciesId,
    p_observation_id: input.observationId ?? null,
    p_nickname: s.nickname,
    p_room: s.room,
    p_indoor: s.indoor,
    p_pot_size_cm: s.potSizeCm,
    p_pot_material: s.potMaterial,
    p_drainage: s.drainage,
    p_light: s.light,
    p_source: input.source,
    p_label_code: input.labelCode ?? null,
    p_first_check_on: addDays(input.today, interval),
    p_now: (input.now ?? new Date()).toISOString(),
    p_client_id: input.clientId ?? null,
  });
  return id as string;
}
