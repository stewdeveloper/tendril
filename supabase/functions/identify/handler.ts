import type { IdentifyResponse, SuggestionDto } from '@core/api.ts';
import { baseIntervalDays } from '@core/care/basic.ts';
import { soilCheckLine } from '@core/copy.ts';
import type { Plan, ToxicityEntry } from '@core/domain.ts';
import { monthKey, nextMonthStart } from '@core/period.ts';
import { QUOTA_LIMITS } from '@core/quota.ts';
import type { Severity } from '@core/toxicity.ts';
import { requireUser, type UserVerifier } from '../_shared/auth.ts';
import { callPrivate, type Db, throwDbError } from '../_shared/db.ts';
import { ApiError } from '../_shared/errors.ts';
import { assertNoGps, stripExif } from '../_shared/exif.ts';
import { cellsFor } from '../_shared/h3.ts';
import { readJson, router } from '../_shared/http.ts';
import { log } from '../_shared/log.ts';
import type { AppCheckVerifier } from '../_shared/providers/appcheck.ts';
import type { IdentificationProvider } from '../_shared/providers/identification.ts';
import {
  selectAppCheck,
  selectedProviderName,
  selectIdentificationProvider,
} from '../_shared/providers/select.ts';
import { type SpeciesRow, toSpeciesRef, upsertSpeciesFromProvider } from '../_shared/species.ts';
import { assertJpegUpload, parseIdentify } from '../_shared/validate.ts';

export interface IdentifyDeps {
  db: Db;
  verifier: UserVerifier;
  /** Defaults to `selectIdentificationProvider()` (fail closed outside a local stack). */
  provider?: IdentificationProvider;
  /** Defaults to `selectAppCheck()`. */
  appCheck?: AppCheckVerifier;
  /** Recorded with each observation; defaults to the selected provider's name. */
  providerName?: string;
  now?: () => Date;
}

const BUCKET = 'plant-photos';
const MAX_SUGGESTIONS = 3;

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function toxicityRows(db: Db, speciesId: string): Promise<ToxicityEntry[]> {
  const { data, error } = await db
    .from('species_toxicity')
    .select('*')
    .eq('species_id', speciesId)
    .order('animal');
  if (error) throwDbError(error);
  return (data ?? []).map((r) => ({
    animal: r.animal as 'cat' | 'dog',
    severity: r.severity as Severity,
    summary: r.summary,
    symptoms: r.symptoms,
    sourceName: r.source_name,
    sourceUrl: r.source_url,
  }));
}

/**
 * Toxicity for a species. Plant.id returns species-level names, while the reference catalogue stores some
 * entries at genus level (scientific_name equal to the genus), so fall back to that row rather than Unknown.
 */
async function toxicityFor(db: Db, top: SpeciesRow): Promise<ToxicityEntry[]> {
  const own = await toxicityRows(db, top.id);
  if (own.length > 0) return own;
  const genus = top.genus ?? top.scientific_name.split(' ')[0];
  if (!genus) return [];
  const { data, error } = await db
    .from('species')
    .select('id')
    .eq('genus', genus)
    .eq('scientific_name', genus)
    .maybeSingle();
  if (error) throwDbError(error);
  return data && data.id !== top.id ? toxicityRows(db, data.id) : [];
}

export function createHandler(deps: IdentifyDeps): (req: Request) => Promise<Response> {
  const { db, verifier } = deps;
  const now = () => (deps.now ?? (() => new Date()))();

  async function identify(req: Request): Promise<Response> {
    const uid = await requireUser(verifier, req);
    const providerName = deps.providerName ?? selectedProviderName();
    const body = parseIdentify(await readJson(req), uid, now());
    const paths = body.photos.map((p) => p.path);
    const appCheck = await (deps.appCheck ?? selectAppCheck()).verify(
      req.headers.get('x-firebase-appcheck'),
    );

    const dup = await db.from('observation_photos').select('id').in('storage_path', paths);
    if (dup.error) throwDbError(dup.error);
    if ((dup.data ?? []).length > 0) {
      throw new ApiError('conflict', 'Those photos were already used. Take new ones.');
    }

    const profile = await db.from('profiles').select('timezone').eq('id', uid).maybeSingle();
    if (profile.error) throwDbError(profile.error);
    if (!profile.data) throw new ApiError('forbidden', 'Finish setting up your account first.');
    const timeZone = profile.data.timezone;
    const premium = await callPrivate(db, 'srv_is_premium', { p_uid: uid });
    const plan: Plan = premium === true ? 'premium' : 'free';

    // healthCheck reserves no diagnosis quota in 2B; diagnosis persistence arrives in Phase 3.
    const kind = 'identification';
    const limit = QUOTA_LIMITS[plan][kind];
    const period = monthKey(now(), timeZone);
    const reserved = (await callPrivate(db, 'srv_reserve_usage', {
      p_uid: uid,
      p_kind: kind,
      p_period_key: period,
      p_limit: limit,
    })) as { ok: boolean; used: number };
    if (!reserved.ok) {
      throw new ApiError('quota_exceeded', 'You have used all your identifications this month.', {
        kind,
        limit,
        resetsOn: nextMonthStart(now(), timeZone),
        plan,
      });
    }

    let held = true;
    const release = async () => {
      if (!held) return;
      held = false;
      try {
        await callPrivate(db, 'srv_release_usage', {
          p_uid: uid,
          p_kind: kind,
          p_period_key: period,
        });
      } catch (e) {
        log('error', 'failed to release identification quota', { uid, error: String(e) });
      }
    };
    let observationId: string | null = null;

    try {
      // Download, strip metadata, prove there is no GPS, re-upload and hash.
      const stripped: { path: string; organ: string; bytes: Uint8Array; sha256: string }[] = [];
      for (const photo of body.photos) {
        const dl = await db.storage.from(BUCKET).download(photo.path);
        if (dl.error || !dl.data) throw new ApiError('not_found', 'A photo could not be found.');
        const original = new Uint8Array(await dl.data.arrayBuffer());
        assertJpegUpload(original);
        const clean = stripExif(original);
        await assertNoGps(clean);
        const up = await db.storage
          .from(BUCKET)
          .upload(photo.path, clean, { contentType: 'image/jpeg', upsert: true });
        if (up.error) throw new Error(`photo upload failed: ${up.error.message}`);
        stripped.push({
          path: photo.path,
          organ: photo.organ,
          bytes: clean,
          sha256: await sha256Hex(clean),
        });
      }

      const obs = await db
        .from('observations')
        .insert({
          user_id: uid,
          device_time: body.deviceTime,
          capture_source: body.captureSource,
          organs: body.photos.map((p) => p.organ),
          health_requested: body.healthCheck,
          status: 'pending',
          image_hash: stripped[0]!.sha256,
          integrity: { appCheck },
        })
        .select('id')
        .single();
      if (obs.error) throwDbError(obs.error);
      observationId = obs.data.id;

      if (body.location) {
        const { lat, lng, accuracyM, mocked } = body.location;
        const cells = cellsFor(lat, lng);
        const loc = await db.from('observation_locations').insert({
          observation_id: observationId,
          user_id: uid,
          point: `SRID=4326;POINT(${lng.toFixed(7)} ${lat.toFixed(7)})`,
          accuracy_m: accuracyM,
          mocked,
          // H3 indexes exceed 2^53, so they travel as decimal strings; PostgREST casts them to bigint.
          cell_r7: cells.r7.toString() as unknown as number,
          cell_r5: cells.r5.toString() as unknown as number,
        });
        if (loc.error) throwDbError(loc.error);
      }
      const photoRows = await db.from('observation_photos').insert(
        stripped.map((p) => ({
          observation_id: observationId!,
          user_id: uid,
          storage_path: p.path,
          organ: p.organ,
          bytes: p.bytes.byteLength,
          sha256: p.sha256,
        })),
      );
      if (photoRows.error) throwDbError(photoRows.error);

      let result;
      try {
        result = await (deps.provider ?? selectIdentificationProvider()).identify({
          imagesBase64: stripped.map((p) => toBase64(p.bytes)),
          lat: body.location?.lat ?? null,
          lng: body.location?.lng ?? null,
          datetime: body.deviceTime,
          // Phase 3 turns health assessment on, together with the diagnosis quota; 2B never asks the provider.
          health: false,
          // Only the fake provider (local stack only) honours a per-request scenario; otherwise the header is ignored.
          scenario:
            providerName === 'fake' ? (req.headers.get('x-tendril-fake') ?? undefined) : undefined,
        });
      } catch (e) {
        log('error', 'identification provider failed', { error: String(e) });
        throw e instanceof ApiError && e.code === 'provider_unavailable'
          ? e
          : new ApiError('provider_unavailable', 'Identification is unavailable.');
      }

      if (!result.isPlant || result.suggestions.length === 0) {
        const upd = await db
          .from('observations')
          .update({ status: 'not_a_plant' })
          .eq('id', observationId);
        if (upd.error) throwDbError(upd.error);
        await release();
        const res: IdentifyResponse = {
          observationId,
          state: 'not_a_plant',
          suggestions: [],
          care: null,
          toxicity: [],
          diagnosis: null,
          quota: {
            kind,
            used: Math.max(0, reserved.used - 1),
            limit,
            resetsOn: nextMonthStart(now(), timeZone),
            plan,
          },
        };
        return Response.json(res);
      }

      const picked = result.suggestions.slice(0, MAX_SUGGESTIONS);
      const rows: SpeciesRow[] = [];
      for (const s of picked) rows.push(await upsertSpeciesFromProvider(db, s));
      const top = rows[0]!;

      const upd = await db
        .from('observations')
        .update({
          status: 'identified',
          suggestions: picked.map((s, i) => ({
            speciesId: rows[i]!.id,
            probability: s.probability,
            providerEntityId: s.providerEntityId,
          })),
          confidence: Math.round(Math.min(1, Math.max(0, picked[0]!.probability)) * 10000) / 10000,
        })
        .eq('id', observationId);
      if (upd.error) throwDbError(upd.error);
      await callPrivate(db, 'srv_store_provider', {
        p_uid: uid,
        p_observation_id: observationId,
        p_provider: providerName,
        p_access_token: result.accessToken,
        p_raw: result.raw as never,
      });

      const toxicity = await toxicityFor(db, top);
      const suggestions: SuggestionDto[] = picked.map((s, i) => ({
        species: toSpeciesRef(rows[i]!),
        probability: s.probability,
        referenceImageUrl: s.similarImageUrl ?? s.imageUrl,
      }));
      const interval = baseIntervalDays(
        { min: top.watering_min, max: top.watering_max },
        top.check_interval_days,
      );
      const res: IdentifyResponse = {
        observationId,
        state: 'identified',
        suggestions,
        care: {
          light: top.light,
          soilCheck: soilCheckLine(interval),
          warmth: top.warmth,
        },
        toxicity,
        diagnosis: null,
        quota: {
          kind,
          used: reserved.used,
          limit,
          resetsOn: nextMonthStart(now(), timeZone),
          plan,
        },
      };
      return Response.json(res);
    } catch (e) {
      // Any failure before a successful response gives the credit back and removes the half-made observation,
      // so a retry with the same photo paths works.
      await release();
      if (observationId) {
        const del = await db.from('observations').delete().eq('id', observationId);
        if (del.error)
          log('error', 'failed to delete observation', { observationId, error: del.error.message });
      }
      throw e;
    }
  }

  return router('identify', [
    { method: 'POST', pattern: new URLPattern({ pathname: '/' }), handle: identify },
  ]);
}
