-- Fix round 1 for the server RPCs (the previous migration is already committed, so these are changes on top).
--
-- 1. A species with no family is sensitive. The insert trigger and reflag_species share one predicate, so a
--    provider species with no family stays hidden even after an admin edits the sensitive-taxa list.
-- 2. srv_check_in stores the response it gave, so a replay returns the original (water_task_created, next_check_on).
-- 3. Ownership guards inside the srv_* functions, so a bug in a handler cannot touch another user's rows.
-- 4. srv_plantdex_record no longer relies on xmax.

-- 1 ---------------------------------------------------------------------------------------------------------------
create or replace function private.species_is_sensitive(p_scientific_name text, p_genus text, p_family text) returns boolean
language sql stable set search_path = '' as $$
  select p_family is null or exists (
    select 1 from private.sensitive_taxa t
    where (t.rank = 'species' and lower(btrim(t.taxon)) = lower(btrim(p_scientific_name)))
       or (t.rank = 'genus' and lower(btrim(t.taxon)) = lower(btrim(coalesce(p_genus, split_part(btrim(p_scientific_name), ' ', 1)))))
       or (t.rank = 'family' and lower(btrim(t.taxon)) = lower(btrim(p_family)))
  )
$$;

-- 2 ---------------------------------------------------------------------------------------------------------------
alter table public.care_events
  add column water_task_created boolean,
  add column next_check_on date;

create or replace function public.srv_check_in(
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

  insert into public.care_events (plant_id, household_id, user_id, kind, soil_dry, leaf_states, photo_path, client_id,
    occurred_at, water_task_created, next_check_on)
  values (p_plant_id, v_household, p_uid, 'checkin', p_soil_dry, coalesce(p_leaf_states, '{}'), p_photo_path, p_client_id,
    p_occurred_at, p_create_water, p_next_check_on)
  on conflict (client_id) do nothing
  returning id into v_event;

  if v_event is null then
    select e.id, e.plant_id, e.user_id, e.water_task_created, e.next_check_on into v_old
    from public.care_events e where e.client_id = p_client_id;
    if v_old.plant_id is distinct from p_plant_id or v_old.user_id is distinct from p_uid then
      raise exception 'client id already used' using errcode = 'P0409';
    end if;
    -- The stored response, not a recomputation: later check-ins may have moved the open tasks on.
    return jsonb_build_object(
      'duplicate', true,
      'eventId', v_old.id,
      'nextCheckOn', v_old.next_check_on,
      'waterTaskCreated', coalesce(v_old.water_task_created, false));
  end if;

  update public.care_tasks t set status = 'done', completed_at = now(), completed_by = p_uid
  where t.plant_id = p_plant_id and t.kind = 'check' and t.status = 'due';
  if p_create_water then
    insert into public.care_tasks (plant_id, household_id, kind, due_on) values (p_plant_id, v_household, 'water', p_today);
  end if;
  insert into public.care_tasks (plant_id, household_id, kind, due_on) values (p_plant_id, v_household, 'check', p_next_check_on);
  return jsonb_build_object('duplicate', false, 'eventId', v_event, 'nextCheckOn', p_next_check_on, 'waterTaskCreated', p_create_water);
end $$;

-- 3 ---------------------------------------------------------------------------------------------------------------
drop function public.srv_replace_pets(uuid, jsonb);
create function public.srv_replace_pets(p_uid uuid, p_household_id uuid, p_pets jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.household_members m where m.household_id = p_household_id and m.user_id = p_uid) then
    raise exception 'not a member of this household' using errcode = 'P0403';
  end if;
  if p_pets is null or jsonb_typeof(p_pets) <> 'array' then
    raise exception 'p_pets must be a JSON array' using errcode = '22023';
  end if;
  delete from public.household_pets where household_id = p_household_id;
  insert into public.household_pets (household_id, animal, name)
  select p_household_id, r.animal, nullif(btrim(r.name), '')
  from jsonb_to_recordset(p_pets) as r(animal text, name text);
end $$;

drop function public.srv_store_provider(uuid, text, text, jsonb);
create function public.srv_store_provider(p_uid uuid, p_observation_id uuid, p_provider text, p_access_token text, p_raw jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.observations o where o.id = p_observation_id and o.user_id = p_uid) then
    raise exception 'observation is not yours' using errcode = 'P0403';
  end if;
  insert into private.observation_provider as o (observation_id, provider, access_token, raw)
  values (p_observation_id, p_provider, p_access_token, p_raw)
  on conflict (observation_id) do update
    set provider = excluded.provider, access_token = excluded.access_token, raw = excluded.raw;
end $$;

drop function public.srv_get_provider_token(uuid);
create function public.srv_get_provider_token(p_uid uuid, p_observation_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.observations o where o.id = p_observation_id and o.user_id = p_uid) then
    raise exception 'observation is not yours' using errcode = 'P0403';
  end if;
  return (select o.access_token from private.observation_provider o where o.observation_id = p_observation_id);
end $$;

create or replace function public.srv_create_plant(
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
  if p_observation_id is not null
     and not exists (select 1 from public.observations o where o.id = p_observation_id and o.user_id = p_uid) then
    raise exception 'observation is not yours' using errcode = 'P0403';
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

revoke all on function
  public.srv_replace_pets(uuid, uuid, jsonb),
  public.srv_store_provider(uuid, uuid, text, text, jsonb),
  public.srv_get_provider_token(uuid, uuid)
  from public, anon, authenticated;
grant execute on function
  public.srv_replace_pets(uuid, uuid, jsonb),
  public.srv_store_provider(uuid, uuid, text, text, jsonb),
  public.srv_get_provider_token(uuid, uuid)
  to service_role;

-- 4 ---------------------------------------------------------------------------------------------------------------
create or replace function public.srv_plantdex_record(p_uid uuid, p_species_id uuid, p_category text, p_observation_id uuid, p_found_at timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_new boolean;
begin
  insert into public.plantdex_entries as e (user_id, species_id, category, first_observation_id, first_found_at)
  values (p_uid, p_species_id, p_category, p_observation_id, p_found_at)
  on conflict (user_id, species_id) do update set finds_count = e.finds_count + 1
  -- A fresh insert starts at 1 and every conflict adds one (so is at least 2), which tells the two apart without xmax.
  returning (e.finds_count = 1) into v_new;
  return jsonb_build_object(
    'newToPlantdex', v_new,
    'count', (select count(*)::int from public.plantdex_entries d where d.user_id = p_uid));
end $$;
