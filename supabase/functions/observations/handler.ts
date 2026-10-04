/// <reference path="../_shared/runtime.d.ts" />
import type { ConfirmResponse } from '@core/api.ts';
import type { NoPointsReason, Outcome, PointsStatus } from '@core/domain.ts';
import { localDate } from '@core/period.ts';
import { requireUser, type UserVerifier } from '../_shared/auth.ts';
import { callPrivate, type Db, throwDbError } from '../_shared/db.ts';
import { ApiError } from '../_shared/errors.ts';
import { parsePoint } from '../_shared/geo.ts';
import { resolveHousehold } from '../_shared/households.ts';
import { json, readJson, router } from '../_shared/http.ts';
import { log } from '../_shared/log.ts';
import { createPlant } from '../_shared/plants.ts';
import type { IdentificationProvider } from '../_shared/providers/identification.ts';
import { selectIdentificationProvider } from '../_shared/providers/select.ts';
import { parseConfirm } from '../_shared/validate.ts';

export interface ObservationsDeps {
  db: Db;
  verifier: UserVerifier;
  /** Defaults to `selectIdentificationProvider()`; only used for free correction feedback. */
  provider?: IdentificationProvider;
  now?: () => Date;
}

type Suggestion = { speciesId: string; probability: number; providerEntityId: string };

const noContent = () => new Response(null, { status: 204 });
const pattern = (pathname: string) => new URLPattern({ pathname });

export function createHandler(deps: ObservationsDeps): (req: Request) => Promise<Response> {
  const { db, verifier } = deps;
  const now = () => (deps.now ?? (() => new Date()))();

  async function ownObservation(uid: string, id: string) {
    const { data, error } = await db
      .from('observations')
      .select('*')
      .eq('id', id)
      .eq('user_id', uid)
      .maybeSingle();
    if (error) throwDbError(error);
    // Someone else's observation looks exactly like a missing one.
    if (!data) throw new ApiError('not_found', 'Observation not found.');
    return data;
  }

  /** The stored result of an already-confirmed observation; heals a plant created but not yet linked. */
  async function storedResult(
    obs: Awaited<ReturnType<typeof ownObservation>>,
  ): Promise<ConfirmResponse> {
    if (obs.intent !== 'add_plant' || obs.plant_id) return { plantId: obs.plant_id };
    const { data, error } = await db
      .from('plants')
      .select('id')
      .eq('observation_id', obs.id)
      .maybeSingle();
    if (error) throwDbError(error);
    if (!data) throw new ApiError('conflict', 'That is still being saved. Try again in a moment.');
    const link = await db.from('observations').update({ plant_id: data.id }).eq('id', obs.id);
    if (link.error) throwDbError(link.error);
    return { plantId: data.id };
  }

  /** The coarse cell that may be shared: never for a sensitive species, a point in the privacy zone, or an unreadable point. */
  async function publicCell(uid: string, observationId: string, sensitive: boolean) {
    if (sensitive) return null;
    // cell_r5 is a bigint above 2^53; ask for text so JSON never rounds it.
    const { data, error } = await db
      .from('observation_locations')
      .select('point, cell_r5::text')
      .eq('observation_id', observationId)
      .maybeSingle();
    if (error) throwDbError(error);
    if (!data || data.cell_r5 === null || data.cell_r5 === undefined) return null;
    const p = parsePoint(data.point);
    if (!p) return null;
    const inZone = await callPrivate(db, 'srv_point_in_zone', {
      p_uid: uid,
      p_lat: p.lat,
      p_lng: p.lng,
    });
    return inZone === false ? String(data.cell_r5) : null;
  }

  function sendFeedback(uid: string, observationId: string, entityId: string): void {
    const task = (async () => {
      try {
        const token = await callPrivate(db, 'srv_get_provider_token', {
          p_uid: uid,
          p_observation_id: observationId,
        });
        if (!token) return;
        await (deps.provider ?? selectIdentificationProvider()).feedback(
          token,
          `user chose ${entityId}`,
        );
      } catch (e) {
        log('warn', 'provider feedback failed', { observationId, error: String(e) });
      }
    })();
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime) EdgeRuntime.waitUntil(task);
  }

  async function confirm(req: Request, params: Record<string, string>): Promise<Response> {
    const uid = await requireUser(verifier, req);
    const body = parseConfirm(await readJson(req));
    const obs = await ownObservation(uid, params.id!);
    if (obs.status === 'confirmed') return json(await storedResult(obs));
    if (obs.status !== 'identified') {
      throw new ApiError('conflict', 'That scan cannot be confirmed.');
    }
    const suggestions = (Array.isArray(obs.suggestions) ? obs.suggestions : []) as Suggestion[];
    const chosen = suggestions.find((s) => s.speciesId === body.speciesId);
    if (!chosen) throw new ApiError('invalid_input', 'Pick one of the suggested species.');

    const sp = await db
      .from('species')
      .select('id, is_houseplant, sensitive')
      .eq('id', body.speciesId)
      .maybeSingle();
    if (sp.error) throwDbError(sp.error);
    if (!sp.data) throw new ApiError('invalid_input', 'That species is not known.');

    const addPlant = body.action === 'add_plant';
    const householdId = await resolveHousehold(db, uid, addPlant ? body.householdId : undefined);
    const cell = await publicCell(uid, obs.id, sp.data.sensitive);
    const profile = await db.from('profiles').select('timezone').eq('id', uid).maybeSingle();
    if (profile.error) throwDbError(profile.error);
    const at = now();

    // Claim the observation first, so two confirms racing each other cannot both write a plant and a find.
    const claim = await db
      .from('observations')
      .update({
        status: 'confirmed',
        species_id: body.speciesId,
        confidence: Math.round(Math.min(1, Math.max(0, chosen.probability)) * 10000) / 10000,
        intent: body.action,
        place_type: body.placeType ?? (addPlant ? 'home' : 'wild'),
        household_id: householdId,
        public_cell_r5: cell as unknown as number | null, // a decimal string; PostgREST casts it to bigint
        confirmed_at: at.toISOString(),
      })
      .eq('id', obs.id)
      .eq('user_id', uid)
      .eq('status', 'identified')
      .select('id');
    if (claim.error) throwDbError(claim.error);
    if ((claim.data ?? []).length === 0) {
      const again = await ownObservation(uid, obs.id);
      if (again.status === 'confirmed') return json(await storedResult(again));
      throw new ApiError('conflict', 'That scan cannot be confirmed.');
    }

    let plantId: string | null = null;
    try {
      if (addPlant) {
        plantId = await createPlant(db, {
          userId: uid,
          householdId,
          speciesId: body.speciesId,
          setup: body.setup!,
          source: 'scan',
          observationId: obs.id,
          today: localDate(at, profile.data?.timezone ?? 'UTC'),
          now: at,
        });
      }
    } catch (e) {
      // Nothing was written beyond the claim, so hand the observation back for a retry.
      const undo = await db
        .from('observations')
        .update({
          status: 'identified',
          species_id: null,
          confidence: null,
          intent: null,
          place_type: null,
          household_id: null,
          public_cell_r5: null,
          confirmed_at: null,
        })
        .eq('id', obs.id);
      if (undo.error) log('error', 'failed to release a claimed observation', { id: obs.id });
      throw e;
    }
    if (plantId) {
      const link = await db.from('observations').update({ plant_id: plantId }).eq('id', obs.id);
      if (link.error) throwDbError(link.error);
    }

    await callPrivate(db, 'srv_plantdex_record', {
      p_uid: uid,
      p_species_id: body.speciesId,
      p_category: addPlant || sp.data.is_houseplant ? 'houseplant' : 'wild',
      p_observation_id: obs.id,
      p_found_at: at.toISOString(),
    });

    if (suggestions[0] && suggestions[0].speciesId !== body.speciesId) {
      sendFeedback(uid, obs.id, chosen.providerEntityId);
    }
    return json({ plantId } satisfies ConfirmResponse);
  }

  async function outcome(req: Request, params: Record<string, string>): Promise<Response> {
    const uid = await requireUser(verifier, req);
    const obs = await ownObservation(uid, params.id!);
    if (obs.status !== 'confirmed' || !obs.species_id) {
      throw new ApiError('conflict', 'Confirm the scan first.');
    }
    const entry = await db
      .from('plantdex_entries')
      .select('first_observation_id')
      .eq('user_id', uid)
      .eq('species_id', obs.species_id)
      .maybeSingle();
    if (entry.error) throwDbError(entry.error);
    const all = await db.from('plantdex_entries').select('species_id').eq('user_id', uid);
    if (all.error) throwDbError(all.error);
    const res: Outcome = {
      pointsStatus: (obs.points_status ?? 'none') as PointsStatus,
      points: 0,
      noPointsReason: (obs.no_points_reason ?? null) as NoPointsReason | null,
      newToPlantdex: entry.data?.first_observation_id === obs.id,
      plantdexCount: (all.data ?? []).length,
      sets: [],
    };
    return json(res);
  }

  async function discard(req: Request, params: Record<string, string>): Promise<Response> {
    const uid = await requireUser(verifier, req);
    const obs = await ownObservation(uid, params.id!);
    if (obs.status === 'discarded') return noContent();
    if (obs.status === 'confirmed') {
      throw new ApiError('conflict', 'A confirmed scan cannot be discarded.');
    }
    const upd = await db
      .from('observations')
      .update({ status: 'discarded' })
      .eq('id', obs.id)
      .eq('user_id', uid)
      .neq('status', 'confirmed');
    if (upd.error) throwDbError(upd.error);
    return noContent();
  }

  return router('observations', [
    { method: 'POST', pattern: pattern('/:id/confirm'), handle: confirm },
    { method: 'GET', pattern: pattern('/:id/outcome'), handle: outcome },
    { method: 'POST', pattern: pattern('/:id/discard'), handle: discard },
  ]);
}
