-- Fix round 1 for the care functions (the previous migration is committed, so these are changes on top).
--
-- 1. srv_check_in locks the plant, refuses a closed plant (after the replay branch), re-dates an open water task
--    instead of adding a second one, and bounds its dates.
-- 2. private.create_plant / srv_create_plant take an optional client id (idempotent plant creation), refuse a label
--    code with another source, and bound the first check date.
-- 3. srv_set_plant_status has an explicit transition table and bounded base days; status events record the new status.
-- 4. srv_complete_task matches a replay by task.

alter table public.plants add column client_id uuid;
create unique index plants_client_id_unique on public.plants (client_id) where client_id is not null;
alter table public.care_events
  add column new_status text check (new_status in ('alive', 'dead', 'given_away')),
  add column task_id uuid references public.care_tasks on delete set null;
create index care_events_task_id_idx on public.care_events (task_id) where task_id is not null;

-- 2 ---------------------------------------------------------------------------------------------------------------
drop function public.srv_create_plant(uuid, uuid, uuid, uuid, text, text, boolean, integer, text, text, text, text, text, date, timestamptz);
drop function private.create_plant(uuid, uuid, uuid, uuid, text, text, boolean, integer, text, text, text, text, text, date, timestamptz);

create function private.create_plant(
  p_uid uuid, p_household_id uuid, p_species_id uuid, p_observation_id uuid, p_nickname text, p_room text,
  p_indoor boolean, p_pot_size_cm integer, p_pot_material text, p_drainage text, p_light text, p_source text,
  p_label_code text, p_first_check_on date, p_now timestamptz, p_client_id uuid default null
) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_plant uuid;
  v_code_species uuid;
  v_old record;
begin
  if not exists (select 1 from public.household_members m where m.household_id = p_household_id and m.user_id = p_uid) then
    raise exception 'not a member of this household' using errcode = 'P0403';
  end if;
  if p_client_id is not null then
    -- A replay returns the first plant and writes nothing; someone else's client id is a conflict.
    select p.id, p.created_by into v_old from public.plants p where p.client_id = p_client_id;
    if found then
      if v_old.created_by is distinct from p_uid then
        raise exception 'client id already used' using errcode = 'P0409';
      end if;
      return v_old.id;
    end if;
  end if;
  if p_observation_id is not null
     and not exists (select 1 from public.observations o where o.id = p_observation_id and o.user_id = p_uid) then
    raise exception 'observation is not yours' using errcode = 'P0403';
  end if;
  if p_label_code is not null and p_source <> 'label_qr' then
    raise exception 'a label code needs the label_qr source' using errcode = '22023';
  end if;
  if p_first_check_on is null or p_now is null
     or p_first_check_on < p_now::date - 1 or p_first_check_on > p_now::date + 31 then
    raise exception 'first check date is out of range' using errcode = '22023';
  end if;
  if p_source = 'label_qr' then
    if p_label_code is null then
      raise exception 'a label plant needs a code' using errcode = '22023';
    end if;
    select q.species_id into v_code_species from public.qr_codes q where q.code = p_label_code and q.status = 'active';
    if v_code_species is null then
      raise exception 'label not found' using errcode = 'P0404';
    end if;
    if v_code_species <> p_species_id then
      raise exception 'species does not match the label' using errcode = '22023';
    end if;
  end if;
  insert into public.plants (household_id, species_id, observation_id, nickname, room, indoor, pot_size_cm,
    pot_material, drainage, light, source, label_code, created_by, client_id)
  values (p_household_id, p_species_id, p_observation_id, p_nickname, p_room, p_indoor, p_pot_size_cm,
    p_pot_material, p_drainage, p_light, p_source, p_label_code, p_uid, p_client_id)
  returning id into v_plant;
  insert into public.care_tasks (plant_id, household_id, kind, due_on) values (v_plant, p_household_id, 'check', p_first_check_on);
  insert into public.care_events (plant_id, household_id, user_id, kind, occurred_at)
  values (v_plant, p_household_id, p_uid, 'setup', p_now);
  if p_source = 'label_qr' then
    insert into public.qr_scans (code, event, user_id) values (p_label_code, 'adoption', p_uid);
  end if;
  return v_plant;
end $$;

create function public.srv_create_plant(
  p_uid uuid, p_household_id uuid, p_species_id uuid, p_observation_id uuid, p_nickname text, p_room text,
  p_indoor boolean, p_pot_size_cm integer, p_pot_material text, p_drainage text, p_light text, p_source text,
  p_label_code text, p_first_check_on date, p_now timestamptz, p_client_id uuid default null
) returns uuid
language sql security definer set search_path = '' as $$
  select private.create_plant(p_uid, p_household_id, p_species_id, p_observation_id, p_nickname, p_room, p_indoor,
    p_pot_size_cm, p_pot_material, p_drainage, p_light, p_source, p_label_code, p_first_check_on, p_now, p_client_id)
$$;

revoke all on function
  private.create_plant(uuid, uuid, uuid, uuid, text, text, boolean, integer, text, text, text, text, text, date, timestamptz, uuid),
  public.srv_create_plant(uuid, uuid, uuid, uuid, text, text, boolean, integer, text, text, text, text, text, date, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function
  public.srv_create_plant(uuid, uuid, uuid, uuid, text, text, boolean, integer, text, text, text, text, text, date, timestamptz, uuid)
  to service_role;

-- 1 ---------------------------------------------------------------------------------------------------------------
create or replace function public.srv_check_in(
  p_uid uuid, p_client_id uuid, p_plant_id uuid, p_soil_dry boolean, p_leaf_states text[], p_occurred_at timestamptz,
  p_photo_path text, p_today date, p_next_check_on date, p_create_water boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid;
  v_status text;
  v_event uuid;
  v_old record;
  v_water uuid;
begin
  -- The lock serialises a check-in with srv_set_plant_status on the same plant.
  select p.household_id, p.status into v_household, v_status from public.plants p where p.id = p_plant_id for update;
  if v_household is null then
    raise exception 'plant not found' using errcode = 'P0404';
  end if;
  if not exists (select 1 from public.household_members m where m.household_id = v_household and m.user_id = p_uid) then
    raise exception 'not a member of this household' using errcode = 'P0403';
  end if;
  if p_today is null or p_next_check_on is null or p_next_check_on < p_today - 1 or p_next_check_on > p_today + 31 then
    raise exception 'next check date is out of range' using errcode = '22023';
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

  if v_status <> 'alive' then
    raise exception 'plant is not alive' using errcode = 'P0409'; -- also rolls the event back
  end if;

  update public.care_tasks t set status = 'done', completed_at = now(), completed_by = p_uid
  where t.plant_id = p_plant_id and t.kind = 'check' and t.status = 'due';
  if p_create_water then
    select t.id into v_water from public.care_tasks t
    where t.plant_id = p_plant_id and t.kind = 'water' and t.status = 'due' order by t.due_on limit 1;
    if v_water is null then
      insert into public.care_tasks (plant_id, household_id, kind, due_on) values (p_plant_id, v_household, 'water', p_today);
    else
      update public.care_tasks set due_on = p_today where id = v_water;
    end if;
  end if;
  insert into public.care_tasks (plant_id, household_id, kind, due_on) values (p_plant_id, v_household, 'check', p_next_check_on);
  return jsonb_build_object('duplicate', false, 'eventId', v_event, 'nextCheckOn', p_next_check_on, 'waterTaskCreated', p_create_water);
end $$;

-- 3 ---------------------------------------------------------------------------------------------------------------
-- Transitions: alive -> dead | given_away, dead | given_away -> alive. dead <-> given_away is P0409. The same status
-- again is a no-op, except dead -> dead with a new cause, which updates the cause. A cause with any status but dead,
-- and base days outside 1..30, are 22023.
create or replace function public.srv_set_plant_status(
  p_uid uuid, p_plant_id uuid, p_status text, p_death_cause text, p_today date, p_now timestamptz, p_base_days integer
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_plant public.plants%rowtype;
  v_cause text := nullif(btrim(p_death_cause), '');
  v_due date;
  v_next date;
begin
  if p_status is null or p_status not in ('alive', 'dead', 'given_away') then
    raise exception 'unknown status' using errcode = '22023';
  end if;
  if p_base_days is null or p_base_days < 1 or p_base_days > 30 or p_today is null then
    raise exception 'base days must be 1 to 30' using errcode = '22023';
  end if;
  if v_cause is not null and p_status <> 'dead' then
    raise exception 'only a death has a cause' using errcode = '22023';
  end if;
  select * into v_plant from public.plants p where p.id = p_plant_id for update;
  if not found then
    raise exception 'plant not found' using errcode = 'P0404';
  end if;
  if not exists (select 1 from public.household_members m where m.household_id = v_plant.household_id and m.user_id = p_uid) then
    raise exception 'not a member of this household' using errcode = 'P0403';
  end if;

  if v_plant.status = p_status then
    if p_status = 'dead' and v_cause is not null and v_cause is distinct from v_plant.death_cause then
      update public.plants set death_cause = v_cause where id = p_plant_id;
    end if;
    return jsonb_build_object('status', p_status, 'statusAt', v_plant.status_at, 'nextCheckOn', null);
  end if;
  if v_plant.status <> 'alive' and p_status <> 'alive' then
    raise exception 'a closed plant must be brought back first' using errcode = 'P0409';
  end if;

  if p_status = 'alive' then
    select t.due_on into v_due from public.care_tasks t
    where t.plant_id = p_plant_id and t.kind = 'check' and t.status = 'superseded'
    order by t.completed_at desc nulls last, t.created_at desc, t.due_on desc limit 1;
    if v_due is null then
      select e.next_check_on into v_due from public.care_events e
      where e.plant_id = p_plant_id and e.next_check_on is not null
      order by e.occurred_at desc, e.created_at desc limit 1;
    end if;
    v_next := coalesce(v_due, p_today + p_base_days);
    update public.plants set status = 'alive', status_at = null, death_cause = null where id = p_plant_id;
    if not exists (select 1 from public.care_tasks t where t.plant_id = p_plant_id and t.kind = 'check' and t.status = 'due') then
      insert into public.care_tasks (plant_id, household_id, kind, due_on, created_at)
      values (p_plant_id, v_plant.household_id, 'check', v_next, p_now);
    end if;
  else
    update public.plants set status = p_status, status_at = p_now, death_cause = v_cause where id = p_plant_id;
    update public.care_tasks t set status = 'superseded', completed_at = p_now
    where t.plant_id = p_plant_id and t.status = 'due';
  end if;
  insert into public.care_events (plant_id, household_id, user_id, kind, new_status, occurred_at)
  values (p_plant_id, v_plant.household_id, p_uid, 'status', p_status, p_now);
  return jsonb_build_object('status', p_status, 'statusAt', case when p_status = 'alive' then null else p_now end,
    'nextCheckOn', v_next);
end $$;

-- 4 ---------------------------------------------------------------------------------------------------------------
create or replace function public.srv_complete_task(p_uid uuid, p_task_id uuid, p_client_id uuid, p_occurred_at timestamptz)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_task public.care_tasks%rowtype;
  v_event uuid;
  v_old record;
begin
  select * into v_task from public.care_tasks t where t.id = p_task_id for update;
  if not found then
    raise exception 'task not found' using errcode = 'P0404';
  end if;
  if not exists (select 1 from public.household_members m where m.household_id = v_task.household_id and m.user_id = p_uid) then
    raise exception 'not a member of this household' using errcode = 'P0403';
  end if;
  if v_task.kind <> 'water' then
    raise exception 'only water tasks are completed here' using errcode = 'P0409';
  end if;

  insert into public.care_events (plant_id, household_id, user_id, kind, client_id, task_id, occurred_at)
  values (v_task.plant_id, v_task.household_id, p_uid, 'water', p_client_id, p_task_id, p_occurred_at)
  on conflict (client_id) do nothing
  returning id into v_event;

  if v_event is null then
    select e.id, e.plant_id, e.user_id, e.kind, e.task_id into v_old from public.care_events e where e.client_id = p_client_id;
    if v_old.plant_id is distinct from v_task.plant_id or v_old.user_id is distinct from p_uid
       or v_old.kind <> 'water' or v_old.task_id is distinct from p_task_id then
      raise exception 'client id already used' using errcode = 'P0409';
    end if;
    return jsonb_build_object('duplicate', true, 'eventId', v_old.id, 'taskId', p_task_id);
  end if;

  if v_task.status <> 'due' then
    raise exception 'task is no longer due' using errcode = 'P0409';
  end if;
  update public.care_tasks set status = 'done', completed_at = p_occurred_at, completed_by = p_uid where id = p_task_id;
  return jsonb_build_object('duplicate', false, 'eventId', v_event, 'taskId', p_task_id);
end $$;
