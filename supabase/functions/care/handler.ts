import type { CheckInResponse, CreatePlantResponse } from '@core/api.ts';
import { basicCheckIn, baseIntervalDays } from '@core/care/basic.ts';
import { localDate, weekdayName } from '@core/period.ts';
import type { Database } from '../../../packages/db/src/index.ts';
import { requireUser, type UserVerifier } from '../_shared/auth.ts';
import { callPrivate, type Db, throwDbError } from '../_shared/db.ts';
import { ApiError } from '../_shared/errors.ts';
import { json, readJson, router } from '../_shared/http.ts';
import { createPlant } from '../_shared/plants.ts';
import {
  assertUuid,
  parseCheckIn,
  parseCreatePlant,
  parsePlantPatch,
  parsePlantStatus,
  parseTaskDone,
} from '../_shared/validate.ts';

export interface CareDeps {
  db: Db;
  verifier: UserVerifier;
  now?: () => Date;
}

type PlantUpdate = Database['public']['Tables']['plants']['Update'];
const noContent = () => new Response(null, { status: 204 });
const pattern = (pathname: string) => new URLPattern({ pathname });

export function createHandler(deps: CareDeps): (req: Request) => Promise<Response> {
  const { db, verifier } = deps;
  const now = () => (deps.now ?? (() => new Date()))();

  /** The plant, once the caller is known to be in its household: unknown is 404, someone else's is 403. */
  async function memberPlant(uid: string, plantId: string) {
    const plant = await db
      .from('plants')
      .select('id, household_id, species_id, status')
      .eq('id', plantId)
      .maybeSingle();
    if (plant.error) throwDbError(plant.error);
    if (!plant.data) throw new ApiError('not_found', 'Plant not found.');
    const member = await db
      .from('household_members')
      .select('user_id')
      .eq('household_id', plant.data.household_id)
      .eq('user_id', uid)
      .maybeSingle();
    if (member.error) throwDbError(member.error);
    if (!member.data) throw new ApiError('forbidden', 'You do not have access to that plant.');
    return plant.data;
  }

  /** The caller's timezone and the species' base interval: what every date below is computed from. */
  async function careContext(uid: string, speciesId: string) {
    const [sp, profile] = await Promise.all([
      db
        .from('species')
        .select('watering_min, watering_max, check_interval_days')
        .eq('id', speciesId)
        .maybeSingle(),
      db.from('profiles').select('timezone').eq('id', uid).maybeSingle(),
    ]);
    if (sp.error) throwDbError(sp.error);
    if (profile.error) throwDbError(profile.error);
    if (!sp.data) throw new ApiError('internal', 'Plant species is missing.');
    return {
      today: localDate(now(), profile.data?.timezone ?? 'UTC'),
      baseDays: baseIntervalDays(
        { min: sp.data.watering_min, max: sp.data.watering_max },
        sp.data.check_interval_days,
      ),
    };
  }

  async function create(req: Request): Promise<Response> {
    const uid = await requireUser(verifier, req);
    const body = parseCreatePlant(await readJson(req));
    const at = now();

    let speciesId = body.speciesId;
    if (body.source === 'label_qr') {
      // The code decides the species. Only an active code can be adopted.
      const code = await db
        .from('qr_codes')
        .select('species_id, status')
        .eq('code', body.labelCode!)
        .maybeSingle();
      if (code.error) throwDbError(code.error);
      if (!code.data || code.data.status !== 'active') {
        throw new ApiError('not_found', 'That label is not active.');
      }
      speciesId = code.data.species_id;
    }
    const profile = await db.from('profiles').select('timezone').eq('id', uid).maybeSingle();
    if (profile.error) throwDbError(profile.error);
    const plantId = await createPlant(db, {
      userId: uid,
      householdId: body.householdId,
      speciesId: speciesId!,
      setup: body.setup,
      source: body.source,
      labelCode: body.source === 'label_qr' ? body.labelCode : null,
      today: localDate(at, profile.data?.timezone ?? 'UTC'),
      now: at,
      clientId: body.clientId,
    });
    return json({ plantId } satisfies CreatePlantResponse);
  }

  async function patch(req: Request, params: Record<string, string>): Promise<Response> {
    const uid = await requireUser(verifier, req);
    const id = assertUuid(params.id, 'plant id');
    const body = parsePlantPatch(await readJson(req));
    await memberPlant(uid, id);
    const row: PlantUpdate = {};
    if (body.nickname !== undefined) row.nickname = body.nickname;
    if (body.room !== undefined) row.room = body.room;
    if (body.light !== undefined) row.light = body.light;
    if (body.potMaterial !== undefined) row.pot_material = body.potMaterial;
    if (body.potSizeCm !== undefined) row.pot_size_cm = body.potSizeCm;
    if (body.drainage !== undefined) row.drainage = body.drainage;
    if (body.indoor !== undefined) row.indoor = body.indoor;
    const upd = await db.from('plants').update(row).eq('id', id);
    if (upd.error) throwDbError(upd.error);
    return noContent();
  }

  async function setStatus(req: Request, params: Record<string, string>): Promise<Response> {
    const uid = await requireUser(verifier, req);
    const id = assertUuid(params.id, 'plant id');
    const body = parsePlantStatus(await readJson(req));
    const plant = await memberPlant(uid, id);
    const { today, baseDays } = await careContext(uid, plant.species_id);
    // One SQL transaction: the status, the superseded or restored task, and the status event.
    const res = await callPrivate(db, 'srv_set_plant_status', {
      p_uid: uid,
      p_plant_id: id,
      p_status: body.status,
      p_death_cause: body.deathCause ?? null,
      p_today: today,
      p_now: now().toISOString(),
      p_base_days: baseDays,
    });
    return json(res);
  }

  async function checkIn(req: Request): Promise<Response> {
    const uid = await requireUser(verifier, req);
    const at = now();
    const body = parseCheckIn(await readJson(req), uid, at);
    const plant = await memberPlant(uid, body.plantId);
    const { today, baseDays } = await careContext(uid, plant.species_id);
    const outcome = basicCheckIn({ today, soilDry: body.soilDry, baseDays });
    // Idempotent on clientId inside SQL (which also refuses a closed plant, after the replay branch): a repeat returns the stored answer, not this recomputation.
    const res = (await callPrivate(db, 'srv_check_in', {
      p_uid: uid,
      p_client_id: body.clientId,
      p_plant_id: body.plantId,
      p_soil_dry: body.soilDry,
      p_leaf_states: body.leafStates,
      p_occurred_at: body.occurredAt,
      p_photo_path: body.photoPath ?? null,
      p_today: today,
      p_next_check_on: outcome.nextCheckOn,
      p_create_water: outcome.waterTaskOn !== null,
    })) as unknown as { nextCheckOn: string; waterTaskCreated: boolean };
    return json({
      nextCheckOn: res.nextCheckOn,
      nextCheckWeekday: weekdayName(res.nextCheckOn),
      waterTaskCreated: res.waterTaskCreated,
      streakDays: 0, // Phase 5
    } satisfies CheckInResponse);
  }

  async function taskDone(req: Request, params: Record<string, string>): Promise<Response> {
    const uid = await requireUser(verifier, req);
    const id = assertUuid(params.id, 'task id');
    const body = parseTaskDone(await readJson(req), now());
    // Water tasks only; membership, idempotency and the water event are all inside SQL.
    await callPrivate(db, 'srv_complete_task', {
      p_uid: uid,
      p_task_id: id,
      p_client_id: body.clientId,
      p_occurred_at: body.occurredAt,
    });
    return noContent();
  }

  return router('care', [
    { method: 'POST', pattern: pattern('/plants'), handle: create },
    { method: 'PATCH', pattern: pattern('/plants/:id'), handle: patch },
    { method: 'POST', pattern: pattern('/plants/:id/status'), handle: setStatus },
    { method: 'POST', pattern: pattern('/checkins'), handle: checkIn },
    { method: 'POST', pattern: pattern('/tasks/:id/done'), handle: taskDone },
  ]);
}
