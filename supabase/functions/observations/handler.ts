/// <reference path="../_shared/runtime.d.ts" />
import type { ConfirmResponse } from '@core/api.ts';
import type { NoPointsReason, Outcome, PointsStatus } from '@core/domain.ts';
import { baseIntervalDays } from '@core/care/basic.ts';
import { addDays, localDate } from '@core/period.ts';
import { requireUser, type UserVerifier } from '../_shared/auth.ts';
import { callPrivate, type Db, throwDbError } from '../_shared/db.ts';
import { ApiError } from '../_shared/errors.ts';
import { json, readJson, router } from '../_shared/http.ts';
import { log } from '../_shared/log.ts';
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

  /**
   * Everything that matters (ownership, status, suggestion membership, household, the shareable cell, plant and
   * Plantdex) happens inside one SQL transaction, `srv_confirm_observation`; this only prepares its inputs.
   */
  async function confirm(req: Request, params: Record<string, string>): Promise<Response> {
    const uid = await requireUser(verifier, req);
    const body = parseConfirm(await readJson(req));
    const at = now();
    const addPlant = body.action === 'add_plant';

    let firstCheckOn: string | null = null;
    if (addPlant) {
      const [sp, profile] = await Promise.all([
        db
          .from('species')
          .select('watering_min, watering_max, check_interval_days')
          .eq('id', body.speciesId)
          .maybeSingle(),
        db.from('profiles').select('timezone').eq('id', uid).maybeSingle(),
      ]);
      if (sp.error) throwDbError(sp.error);
      if (profile.error) throwDbError(profile.error);
      if (!sp.data) throw new ApiError('invalid_input', 'That species is not known.');
      firstCheckOn = addDays(
        localDate(at, profile.data?.timezone ?? 'UTC'),
        baseIntervalDays(
          { min: sp.data.watering_min, max: sp.data.watering_max },
          sp.data.check_interval_days,
        ),
      );
    }

    const res = (await callPrivate(db, 'srv_confirm_observation', {
      p_uid: uid,
      p_observation_id: params.id!,
      p_species_id: body.speciesId,
      p_action: body.action,
      p_place_type: body.placeType ?? null,
      p_household_id: addPlant ? (body.householdId ?? null) : null,
      p_setup: (body.setup ?? null) as never,
      p_first_check_on: firstCheckOn,
      p_now: at.toISOString(),
    })) as unknown as {
      plantId: string | null;
      duplicate: boolean;
      feedbackEntityId: string | null;
    };
    if (!res.duplicate && res.feedbackEntityId) {
      sendFeedback(uid, params.id!, res.feedbackEntityId);
    }
    return json({ plantId: res.plantId } satisfies ConfirmResponse);
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
    const all = await db
      .from('plantdex_entries')
      .select('species_id', { count: 'exact', head: true })
      .eq('user_id', uid);
    if (all.error) throwDbError(all.error);
    const res: Outcome = {
      pointsStatus: (obs.points_status ?? 'none') as PointsStatus,
      points: 0,
      noPointsReason: (obs.no_points_reason ?? null) as NoPointsReason | null,
      newToPlantdex: entry.data?.first_observation_id === obs.id,
      plantdexCount: all.count ?? 0,
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
      .neq('status', 'confirmed')
      .select('id');
    if (upd.error) throwDbError(upd.error);
    // A confirm that won the race leaves nothing to update.
    if ((upd.data ?? []).length === 0) {
      throw new ApiError('conflict', 'A confirmed scan cannot be discarded.');
    }
    return noContent();
  }

  return router('observations', [
    { method: 'POST', pattern: pattern('/:id/confirm'), handle: confirm },
    { method: 'GET', pattern: pattern('/:id/outcome'), handle: outcome },
    { method: 'POST', pattern: pattern('/:id/discard'), handle: discard },
  ]);
}
