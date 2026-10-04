-- Server RPC wrappers for the Edge Functions. PostgREST exposes only `public`, so the functions reach the private
-- quota/provider helpers, the privacy zone and the transactional writes through these security definer wrappers.
-- Every one is granted to service_role only: never grant a srv_* function to anon or authenticated (the 015 and 051
-- audits would then fail, and clients could spend other users' quota or read privacy zones).
--
-- Domain failures raise SQLSTATEs the handlers map: P0403 forbidden, P0404 not found, P0409 conflict.

-- Quota ---------------------------------------------------------------------------------------------------------
create function public.srv_reserve_usage(p_uid uuid, p_kind text, p_period_key text, p_limit integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_ok boolean := private.reserve_usage(p_uid, p_kind, p_period_key, p_limit);
begin
  return jsonb_build_object(
    'ok', v_ok,
    'used', coalesce((select u.used from public.usage_counters u
      where u.user_id = p_uid and u.kind = p_kind and u.period_key = p_period_key), 0));
end $$;

create function public.srv_release_usage(p_uid uuid, p_kind text, p_period_key text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.release_usage(p_uid, p_kind, p_period_key);
end $$;

create function public.srv_is_premium(p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_premium(p_uid)
$$;

-- Provider token ------------------------------------------------------------------------------------------------
create function public.srv_store_provider(p_observation_id uuid, p_provider text, p_access_token text, p_raw jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into private.observation_provider as o (observation_id, provider, access_token, raw)
  values (p_observation_id, p_provider, p_access_token, p_raw)
  on conflict (observation_id) do update
    set provider = excluded.provider, access_token = excluded.access_token, raw = excluded.raw;
end $$;

create function public.srv_get_provider_token(p_observation_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select o.access_token from private.observation_provider o where o.observation_id = p_observation_id
$$;

-- Privacy zone --------------------------------------------------------------------------------------------------
-- Answers a yes/no question so the zone itself (a geography) never leaves the database.
create function public.srv_point_in_zone(p_uid uuid, p_lat double precision, p_lng double precision) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.privacy_zones z
    where z.user_id = p_uid
      and extensions.st_dwithin(
        z.center,
        extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
        z.radius_m::double precision))
$$;

-- Plantdex ------------------------------------------------------------------------------------------------------
-- Inserts, or adds one find and keeps the first_* values. `count` is the size of the user's Plantdex afterwards.
create function public.srv_plantdex_record(p_uid uuid, p_species_id uuid, p_category text, p_observation_id uuid, p_found_at timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_new boolean;
begin
  insert into public.plantdex_entries as e (user_id, species_id, category, first_observation_id, first_found_at)
  values (p_uid, p_species_id, p_category, p_observation_id, p_found_at)
  on conflict (user_id, species_id) do update set finds_count = e.finds_count + 1
  returning (e.xmax = 0) into v_new;
  return jsonb_build_object(
    'newToPlantdex', v_new,
    'count', (select count(*)::int from public.plantdex_entries d where d.user_id = p_uid));
end $$;

-- Transactional writes (PostgREST has no transactions) ----------------------------------------------------------
-- Idempotent: an existing profile is returned untouched. A requested handle that is taken raises P0409.
create function public.srv_bootstrap(p_uid uuid, p_handle text, p_display_name text, p_timezone text, p_country_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_handle text;
  v_household uuid;
  v_try integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext('srv_bootstrap:' || p_uid::text));
  select p.handle::text into v_handle from public.profiles p where p.id = p_uid;
  if v_handle is null then
    loop
      v_try := v_try + 1;
      v_handle := coalesce(p_handle, 'plant' || lpad(floor(random() * 1000000)::integer::text, 6, '0'));
      begin
        insert into public.profiles (id, handle, display_name, timezone, country_code, age_confirmed_13_plus)
        values (p_uid, v_handle, p_display_name, p_timezone, p_country_code, true)
        on conflict (id) do nothing;
        exit;
      exception when unique_violation then
        if p_handle is not null then
          raise exception 'handle taken' using errcode = 'P0409';
        end if;
        if v_try >= 20 then
          raise;
        end if;
      end;
    end loop;
    select p.handle::text into v_handle from public.profiles p where p.id = p_uid;
  end if;

  select m.household_id into v_household from public.household_members m
  where m.user_id = p_uid order by (m.role = 'owner') desc, m.joined_at limit 1;
  if v_household is null then
    insert into public.households (name, created_by) values ('Home', p_uid) returning id into v_household;
    insert into public.household_members (household_id, user_id, role) values (v_household, p_uid, 'owner');
  end if;
  return jsonb_build_object('userId', p_uid, 'handle', v_handle, 'householdId', v_household);
end $$;

-- p_pets: [{ "animal": "cat", "name": "Miso" | null }]. The caller has already checked membership.
create function public.srv_replace_pets(p_household_id uuid, p_pets jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_pets is null or jsonb_typeof(p_pets) <> 'array' then
    raise exception 'p_pets must be a JSON array' using errcode = '22023';
  end if;
  delete from public.household_pets where household_id = p_household_id;
  insert into public.household_pets (household_id, animal, name)
  select p_household_id, r.animal, nullif(btrim(r.name), '')
  from jsonb_to_recordset(p_pets) as r(animal text, name text);
end $$;

-- Plant, its first check task and the setup event, in one transaction. The caller computes the due date.
create function public.srv_create_plant(
  p_uid uuid, p_household_id uuid, p_species_id uuid, p_observation_id uuid, p_nickname text, p_room text,
  p_indoor boolean, p_pot_size_cm integer, p_pot_material text, p_drainage text, p_light text, p_source text,
  p_label_code text, p_first_check_on date, p_now timestamptz
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_plant uuid;
begin
  if not exists (select 1 from public.household_members m where m.household_id = p_household_id and m.user_id = p_uid) then
    raise exception 'not a member of this household' using errcode = 'P0403';
  end if;
  insert into public.plants (household_id, species_id, observation_id, nickname, room, indoor, pot_size_cm,
    pot_material, drainage, light, source, label_code, created_by)
  values (p_household_id, p_species_id, p_observation_id, p_nickname, p_room, p_indoor, p_pot_size_cm,
    p_pot_material, p_drainage, p_light, p_source, p_label_code, p_uid)
  returning id into v_plant;
  insert into public.care_tasks (plant_id, household_id, kind, due_on) values (v_plant, p_household_id, 'check', p_first_check_on);
  insert into public.care_events (plant_id, household_id, user_id, kind, occurred_at)
  values (v_plant, p_household_id, p_uid, 'setup', p_now);
  return v_plant;
end $$;

-- Check-in, idempotent on p_client_id. Returns { duplicate, eventId, nextCheckOn, waterTaskCreated }.
-- Not a member: P0403. Unknown plant: P0404. A client_id already used by another user or plant: P0409.
create function public.srv_check_in(
  p_uid uuid, p_client_id uuid, p_plant_id uuid, p_soil_dry boolean, p_leaf_states text[], p_occurred_at timestamptz,
  p_photo_path text, p_today date, p_next_check_on date, p_create_water boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid;
  v_event uuid;
  v_old record;
begin
  select p.household_id into v_household from public.plants p where p.id = p_plant_id;
  if v_household is null then
    raise exception 'plant not found' using errcode = 'P0404';
  end if;
  if not exists (select 1 from public.household_members m where m.household_id = v_household and m.user_id = p_uid) then
    raise exception 'not a member of this household' using errcode = 'P0403';
  end if;

  insert into public.care_events (plant_id, household_id, user_id, kind, soil_dry, leaf_states, photo_path, client_id, occurred_at)
  values (p_plant_id, v_household, p_uid, 'checkin', p_soil_dry, coalesce(p_leaf_states, '{}'), p_photo_path, p_client_id, p_occurred_at)
  on conflict (client_id) do nothing
  returning id into v_event;

  if v_event is null then
    select e.id, e.plant_id, e.user_id, e.soil_dry into v_old from public.care_events e where e.client_id = p_client_id;
    if v_old.plant_id is distinct from p_plant_id or v_old.user_id is distinct from p_uid then
      raise exception 'client id already used' using errcode = 'P0409';
    end if;
    return jsonb_build_object(
      'duplicate', true,
      'eventId', v_old.id,
      'nextCheckOn', (select min(t.due_on) from public.care_tasks t where t.plant_id = p_plant_id and t.kind = 'check' and t.status = 'due'),
      'waterTaskCreated', coalesce(v_old.soil_dry, false));
  end if;

  update public.care_tasks t set status = 'done', completed_at = now(), completed_by = p_uid
  where t.plant_id = p_plant_id and t.kind = 'check' and t.status = 'due';
  if p_create_water then
    insert into public.care_tasks (plant_id, household_id, kind, due_on) values (p_plant_id, v_household, 'water', p_today);
  end if;
  insert into public.care_tasks (plant_id, household_id, kind, due_on) values (p_plant_id, v_household, 'check', p_next_check_on);
  return jsonb_build_object('duplicate', false, 'eventId', v_event, 'nextCheckOn', p_next_check_on, 'waterTaskCreated', p_create_water);
end $$;

-- Grants: service_role only --------------------------------------------------------------------------------------
revoke all on function
  public.srv_reserve_usage(uuid, text, text, integer),
  public.srv_release_usage(uuid, text, text),
  public.srv_is_premium(uuid),
  public.srv_store_provider(uuid, text, text, jsonb),
  public.srv_get_provider_token(uuid),
  public.srv_point_in_zone(uuid, double precision, double precision),
  public.srv_plantdex_record(uuid, uuid, text, uuid, timestamptz),
  public.srv_bootstrap(uuid, text, text, text, text),
  public.srv_replace_pets(uuid, jsonb),
  public.srv_create_plant(uuid, uuid, uuid, uuid, text, text, boolean, integer, text, text, text, text, text, date, timestamptz),
  public.srv_check_in(uuid, uuid, uuid, boolean, text[], timestamptz, text, date, date, boolean)
  from public, anon, authenticated;
grant execute on function
  public.srv_reserve_usage(uuid, text, text, integer),
  public.srv_release_usage(uuid, text, text),
  public.srv_is_premium(uuid),
  public.srv_store_provider(uuid, text, text, jsonb),
  public.srv_get_provider_token(uuid),
  public.srv_point_in_zone(uuid, double precision, double precision),
  public.srv_plantdex_record(uuid, uuid, text, uuid, timestamptz),
  public.srv_bootstrap(uuid, text, text, text, text),
  public.srv_replace_pets(uuid, jsonb),
  public.srv_create_plant(uuid, uuid, uuid, uuid, text, text, boolean, integer, text, text, text, text, text, date, timestamptz),
  public.srv_check_in(uuid, uuid, uuid, boolean, text[], timestamptz, text, date, date, boolean)
  to service_role;
