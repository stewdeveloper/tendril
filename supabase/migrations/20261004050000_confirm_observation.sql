-- Confirming an observation is one transaction: the observation, the shareable cell, the plant (for add_plant) and the
-- Plantdex entry are written together or not at all, and a replay changes nothing.

-- private.create_plant / private.plantdex_record are the shared bodies; the public srv_* wrappers just call them.
create function private.create_plant(
  p_uid uuid, p_household_id uuid, p_species_id uuid, p_observation_id uuid, p_nickname text, p_room text,
  p_indoor boolean, p_pot_size_cm integer, p_pot_material text, p_drainage text, p_light text, p_source text,
  p_label_code text, p_first_check_on date, p_now timestamptz
) returns uuid
language plpgsql set search_path = '' as $$
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

create function private.plantdex_record(p_uid uuid, p_species_id uuid, p_category text, p_observation_id uuid, p_found_at timestamptz) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_new boolean;
begin
  insert into public.plantdex_entries as e (user_id, species_id, category, first_observation_id, first_found_at)
  values (p_uid, p_species_id, p_category, p_observation_id, p_found_at)
  on conflict (user_id, species_id) do update set finds_count = e.finds_count + 1
  -- A fresh insert starts at 1 and every conflict adds one (so is at least 2), which tells the two apart.
  returning (e.finds_count = 1) into v_new;
  return jsonb_build_object(
    'newToPlantdex', v_new,
    'count', (select count(*)::int from public.plantdex_entries d where d.user_id = p_uid));
end $$;

revoke all on function
  private.create_plant(uuid, uuid, uuid, uuid, text, text, boolean, integer, text, text, text, text, text, date, timestamptz),
  private.plantdex_record(uuid, uuid, text, uuid, timestamptz)
  from public, anon, authenticated;

create or replace function public.srv_create_plant(
  p_uid uuid, p_household_id uuid, p_species_id uuid, p_observation_id uuid, p_nickname text, p_room text,
  p_indoor boolean, p_pot_size_cm integer, p_pot_material text, p_drainage text, p_light text, p_source text,
  p_label_code text, p_first_check_on date, p_now timestamptz
) returns uuid
language sql security definer set search_path = '' as $$
  select private.create_plant(p_uid, p_household_id, p_species_id, p_observation_id, p_nickname, p_room, p_indoor,
    p_pot_size_cm, p_pot_material, p_drainage, p_light, p_source, p_label_code, p_first_check_on, p_now)
$$;

create or replace function public.srv_plantdex_record(p_uid uuid, p_species_id uuid, p_category text, p_observation_id uuid, p_found_at timestamptz) returns jsonb
language sql security definer set search_path = '' as $$
  select private.plantdex_record(p_uid, p_species_id, p_category, p_observation_id, p_found_at)
$$;

-- One plant per scan, so a replayed confirm can never make a second one.
create unique index plants_observation_unique on public.plants (observation_id) where observation_id is not null;

-- Returns { plantId, duplicate, newToPlantdex, plantdexCount, feedbackEntityId }.
-- Not yours or unknown: P0404. Not identified, or a replay that disagrees with the first confirm: P0409.
-- Species not among the suggestions, or a missing place for a find: 22023. Household you are not in: P0403.
-- p_setup is the PlantSetup JSON (camelCase keys); p_first_check_on is computed by the caller.
create function public.srv_confirm_observation(
  p_uid uuid, p_observation_id uuid, p_species_id uuid, p_action text, p_place_type text, p_household_id uuid,
  p_setup jsonb, p_first_check_on date, p_now timestamptz
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.observations%rowtype;
  v_prob numeric;
  v_entity text;
  v_top boolean;
  v_sensitive boolean;
  v_houseplant boolean;
  v_household uuid;
  v_place text;
  v_cell bigint;
  v_plant uuid;
  v_dex jsonb;
  v_entry public.plantdex_entries%rowtype;
begin
  if p_action is null or p_action not in ('add_plant', 'log_find') then
    raise exception 'unknown action' using errcode = '22023';
  end if;
  select * into o from public.observations where id = p_observation_id and user_id = p_uid for update;
  if not found then
    raise exception 'observation not found' using errcode = 'P0404';
  end if;

  if o.status = 'confirmed' then
    if o.species_id is distinct from p_species_id or o.intent is distinct from p_action then
      raise exception 'already confirmed differently' using errcode = 'P0409';
    end if;
    select * into v_entry from public.plantdex_entries where user_id = p_uid and species_id = o.species_id;
    return jsonb_build_object(
      'plantId', o.plant_id,
      'duplicate', true,
      'newToPlantdex', v_entry.first_observation_id is not distinct from o.id,
      'plantdexCount', (select count(*)::int from public.plantdex_entries d where d.user_id = p_uid),
      'feedbackEntityId', null);
  end if;
  if o.status <> 'identified' then
    raise exception 'observation is not identified' using errcode = 'P0409';
  end if;

  select (e.value ->> 'probability')::numeric, e.value ->> 'providerEntityId', e.ord = 1
    into v_prob, v_entity, v_top
  from jsonb_array_elements(case when jsonb_typeof(o.suggestions) = 'array' then o.suggestions else '[]'::jsonb end)
    with ordinality as e(value, ord)
  where e.value ->> 'speciesId' = p_species_id::text
  limit 1;
  if not found then
    raise exception 'species is not one of the suggestions' using errcode = '22023';
  end if;

  select s.sensitive, s.is_houseplant into v_sensitive, v_houseplant from public.species s where s.id = p_species_id;
  if not found then
    raise exception 'unknown species' using errcode = '22023';
  end if;

  if p_action = 'add_plant' and p_household_id is not null then
    if not exists (select 1 from public.household_members m where m.household_id = p_household_id and m.user_id = p_uid) then
      raise exception 'not a member of this household' using errcode = 'P0403';
    end if;
    v_household := p_household_id;
  else
    select m.household_id into v_household from public.household_members m where m.user_id = p_uid
    order by (m.role = 'owner') desc, m.household_id limit 1;
    if v_household is null then
      raise exception 'no household' using errcode = 'P0404';
    end if;
  end if;

  -- A plant you add lives at home; a find needs to say where it was.
  v_place := case when p_action = 'add_plant' then 'home' else p_place_type end;
  if v_place is null then
    raise exception 'a find needs a place type' using errcode = '22023';
  end if;

  -- The shareable cell: only for a find in the wild or a shop, never for a sensitive species, and never for a point
  -- inside the user's privacy zone. Home and garden/park finds stay private even with no home area set.
  if v_place in ('wild', 'shop') and not v_sensitive then
    select l.cell_r5 into v_cell
    from public.observation_locations l
    where l.observation_id = o.id and l.user_id = p_uid
      and not exists (
        select 1 from public.privacy_zones z
        where z.user_id = p_uid and extensions.st_dwithin(z.center, l.point, z.radius_m::double precision));
  end if;

  update public.observations set
    species_id = p_species_id,
    confidence = round(least(1, greatest(0, v_prob)), 4),
    intent = p_action,
    place_type = v_place,
    household_id = v_household,
    public_cell_r5 = v_cell,
    status = 'confirmed',
    confirmed_at = p_now
  where id = o.id;

  if p_action = 'add_plant' then
    v_plant := private.create_plant(p_uid, v_household, p_species_id, o.id,
      p_setup ->> 'nickname', p_setup ->> 'room', (p_setup ->> 'indoor')::boolean, (p_setup ->> 'potSizeCm')::integer,
      p_setup ->> 'potMaterial', p_setup ->> 'drainage', p_setup ->> 'light', 'scan', null, p_first_check_on, p_now);
    update public.observations set plant_id = v_plant where id = o.id;
  end if;

  v_dex := private.plantdex_record(p_uid, p_species_id,
    case when p_action = 'add_plant' or v_houseplant then 'houseplant' else 'wild' end, o.id, p_now);

  return jsonb_build_object(
    'plantId', v_plant,
    'duplicate', false,
    'newToPlantdex', (v_dex ->> 'newToPlantdex')::boolean,
    'plantdexCount', (v_dex ->> 'count')::int,
    'feedbackEntityId', case when v_top then null else v_entity end);
end $$;

revoke all on function public.srv_confirm_observation(uuid, uuid, uuid, text, text, uuid, jsonb, date, timestamptz)
  from public, anon, authenticated;
grant execute on function public.srv_confirm_observation(uuid, uuid, uuid, text, text, uuid, jsonb, date, timestamptz)
  to service_role;
