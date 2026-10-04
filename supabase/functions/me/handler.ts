import type { BootstrapResponse } from '@core/api.ts';
import { randomizeZone } from '@core/privacy.ts';
import { requireUser, type UserVerifier } from '../_shared/auth.ts';
import { callPrivate, type Db, throwDbError } from '../_shared/db.ts';
import { ApiError } from '../_shared/errors.ts';
import { json, readJson, type Route, router } from '../_shared/http.ts';
import {
  parseBootstrap,
  parseHomeArea,
  parsePets,
  parseProfilePatch,
  parsePushToken,
  parseVet,
} from '../_shared/validate.ts';

export interface MeDeps {
  db: Db;
  verifier: UserVerifier;
  /** Uniform [0, 1); crypto-backed by default. Injected for tests. */
  random?: () => number;
  now?: () => Date;
}

const cryptoRandom = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
const noContent = () => new Response(null, { status: 204 });
const pattern = (pathname: string) => new URLPattern({ pathname });

/** The household named in the request (the caller must be a member), else the caller's own (owner first). */
async function resolveHousehold(db: Db, uid: string, requested?: string): Promise<string> {
  const { data, error } = await db
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', uid);
  if (error) throwDbError(error);
  const mine = data ?? [];
  if (requested) {
    if (!mine.some((m) => m.household_id === requested)) {
      throw new ApiError('forbidden', 'You are not a member of that household.');
    }
    return requested;
  }
  const home = mine.find((m) => m.role === 'owner') ?? mine[0];
  if (!home) throw new ApiError('not_found', 'Finish setting up your account first.');
  return home.household_id;
}

export function createHandler(deps: MeDeps): (req: Request) => Promise<Response> {
  const { db, verifier } = deps;
  const random = deps.random ?? cryptoRandom;
  const now = () => (deps.now ?? (() => new Date()))().toISOString();

  const routes: Route[] = [
    {
      method: 'POST',
      pattern: pattern('/bootstrap'),
      handle: async (req) => {
        const uid = await requireUser(verifier, req);
        const b = parseBootstrap(await readJson(req));
        const res = (await callPrivate(db, 'srv_bootstrap', {
          p_uid: uid,
          p_handle: b.handle ?? null,
          p_display_name: b.displayName ?? null,
          p_timezone: b.timezone,
          p_country_code: b.countryCode,
        })) as unknown as BootstrapResponse;
        return json(res);
      },
    },
    {
      method: 'PATCH',
      pattern: pattern('/profile'),
      handle: async (req) => {
        const uid = await requireUser(verifier, req);
        const p = parseProfilePatch(await readJson(req));
        const { data, error } = await db
          .from('profiles')
          .update({
            ...(p.handle !== undefined ? { handle: p.handle } : {}),
            ...(p.displayName !== undefined ? { display_name: p.displayName } : {}),
            ...(p.timezone !== undefined ? { timezone: p.timezone } : {}),
            ...(p.countryCode !== undefined ? { country_code: p.countryCode } : {}),
          })
          .eq('id', uid)
          .select('handle, display_name, timezone, country_code')
          .maybeSingle();
        if (error) throwDbError(error);
        if (!data) throw new ApiError('not_found', 'Finish setting up your account first.');
        return json({
          handle: data.handle,
          displayName: data.display_name,
          timezone: data.timezone,
          countryCode: data.country_code,
        });
      },
    },
    {
      method: 'PUT',
      pattern: pattern('/pets'),
      handle: async (req) => {
        const uid = await requireUser(verifier, req);
        const b = parsePets(await readJson(req));
        const householdId = await resolveHousehold(db, uid, b.householdId);
        await callPrivate(db, 'srv_replace_pets', { p_household_id: householdId, p_pets: b.pets });
        return noContent();
      },
    },
    {
      method: 'PUT',
      pattern: pattern('/vet'),
      handle: async (req) => {
        const uid = await requireUser(verifier, req);
        const b = parseVet(await readJson(req));
        const householdId = await resolveHousehold(db, uid, b.householdId);
        const { error } = await db
          .from('household_vets')
          .upsert(
            { household_id: householdId, name: b.name, phone: b.phone, updated_at: now() },
            { onConflict: 'household_id' },
          );
        if (error) throwDbError(error);
        return noContent();
      },
    },
    {
      method: 'PUT',
      pattern: pattern('/home-area'),
      handle: async (req) => {
        const uid = await requireUser(verifier, req);
        const b = parseHomeArea(await readJson(req));
        // Only the randomised centre is ever stored; the home point itself never leaves this function.
        const zone = randomizeZone({ lat: b.lat, lng: b.lng }, b.radiusM, random);
        const { error } = await db.from('privacy_zones').upsert(
          {
            user_id: uid,
            center: `SRID=4326;POINT(${zone.center.lng.toFixed(7)} ${zone.center.lat.toFixed(7)})`,
            radius_m: zone.radiusM,
            updated_at: now(),
          },
          { onConflict: 'user_id' },
        );
        if (error) throwDbError(error);
        return json({ radiusM: zone.radiusM });
      },
    },
    {
      method: 'DELETE',
      pattern: pattern('/home-area'),
      handle: async (req) => {
        const uid = await requireUser(verifier, req);
        const { error } = await db.from('privacy_zones').delete().eq('user_id', uid);
        if (error) throwDbError(error);
        return noContent();
      },
    },
    {
      method: 'POST',
      pattern: pattern('/push-token'),
      handle: async (req) => {
        const uid = await requireUser(verifier, req);
        const b = parsePushToken(await readJson(req));
        // token is unique across users, so a shared device follows the signed-in account.
        const { error } = await db
          .from('push_tokens')
          .upsert(
            { user_id: uid, token: b.token, platform: b.platform, last_seen_at: now() },
            { onConflict: 'token' },
          );
        if (error) throwDbError(error);
        return noContent();
      },
    },
  ];
  return router('me', routes);
}
