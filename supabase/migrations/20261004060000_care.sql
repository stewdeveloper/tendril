-- Phase 2B Task 6: the care function's transactional writes.
--
-- 1. private.create_plant also handles label adoption: a label plant needs an active code for the same species, and
--    the adoption scan is written in the same transaction as the plant.
-- 2. srv_set_plant_status closes or reopens a plant: status, the superseded or restored task and the status event.
-- 3. srv_complete_task marks a water task done and records the water event, idempotent on the client id.

-- 1 ---------------------------------------------------------------------------------------------------------------
create or replace function private.create_plant(
  p_uid uuid, p_household_id uuid, p_species_id uuid, p_observation_id uuid, p_nickname text, p_room text,
  p_indoor boolean, p_pot_size_cm integer, p_pot_material text, p_drainage text, p_light text, p_source text,
  p_label_code text, p_first_check_on date, p_now timestamptz
) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_plant uuid;
  v_code_species uuid;
begin
  if not exists (select 1 from public.household_members m where m.household_id = p_household_id and m.user_id = p_uid) then
    raise exception 'not a member of this household' using errcode = 'P0403';
  end if;
  if p_observation_id is not null
     and not exists (select 1 from public.observations o where o.id = p_observation_id and o.user_id = p_uid) then
    raise exception 'observation is not yours' using errcode = 'P0403';
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
    pot_material, drainage, light, source, label_code, created_by)
  values (p_household_id, p_species_id, p_observation_id, p_nickname, p_room, p_indoor, p_pot_size_cm,
    p_pot_material, p_drainage, p_light, p_source, p_label_code, p_uid)
  returning id into v_plant;
  insert into public.care_tasks (plant_id, household_id, kind, due_on) values (v_plant, p_household_id, 'check', p_first_check_on);
  insert into public.care_events (plant_id, household_id, user_id, kind, occurred_at)
  values (v_plant, p_household_id, p_uid, 'setup', p_now);
  if p_source = 'label_qr' then
    insert into public.qr_scans (code, event, user_id) values (p_label_code, 'adoption', p_uid);
  end if;
  return v_plant;
end $$;

-- 2 ---------------------------------------------------------------------------------------------------------------
-- Returns { status, statusAt, nextCheckOn } (nextCheckOn only when the plant was brought back).
-- alive -> dead | given_away: status, status_at and (for dead) death_cause are set, every open task is superseded.
-- dead | given_away -> alive: status_at and death_cause are cleared and one check task is restored, due at the last
--   check date the plant had (its most recently superseded check, else the last check-in's next_check_on), else
--   p_today + p_base_days. A repeat of the current status changes nothing.
-- Not a member: P0403. Unknown plant: P0404. Unknown status: 22023.
create function public.srv_set_plant_status(
  p_uid uuid, p_plant_id uuid, p_status text, p_death_cause text, p_today date, p_now timestamptz, p_base_days integer
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_plant public.plants%rowtype;
  v_due date;
  v_next date;
begin
  if p_status is null or p_status not in ('alive', 'dead', 'given_away') then
    raise exception 'unknown status' using errcode = '22023';
  end if;
  select * into v_plant from public.plants p where p.id = p_plant_id for update;
  if not found then
    raise exception 'plant not found' using errcode = 'P0404';
  end if;
  if not exists (select 1 from public.household_members m where m.household_id = v_plant.household_id and m.user_id = p_uid) then
    raise exception 'not a member of this household' using errcode = 'P0403';
  end if;

  if v_plant.status = p_status then
    return jsonb_build_object('status', v_plant.status, 'statusAt', v_plant.status_at, 'nextCheckOn', null);
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
    update public.plants
    set status = p_status, status_at = p_now,
        death_cause = case when p_status = 'dead' then nullif(btrim(p_death_cause), '') else null end
    where id = p_plant_id;
    update public.care_tasks t set status = 'superseded', completed_at = p_now
    where t.plant_id = p_plant_id and t.status = 'due';
  end if;
  insert into public.care_events (plant_id, household_id, user_id, kind, occurred_at)
  values (p_plant_id, v_plant.household_id, p_uid, 'status', p_now);
  return jsonb_build_object('status', p_status, 'statusAt', case when p_status = 'alive' then null else p_now end,
    'nextCheckOn', v_next);
end $$;

-- 3 ---------------------------------------------------------------------------------------------------------------
-- Returns { duplicate, eventId, taskId }. Idempotent on p_client_id; a client id used by another user or plant is
-- P0409. A check task (completed by a check-in) or a task that is no longer due is P0409. Not a member: P0403.
-- Unknown task: P0404.
create function public.srv_complete_task(p_uid uuid, p_task_id uuid, p_client_id uuid, p_occurred_at timestamptz)
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

  insert into public.care_events (plant_id, household_id, user_id, kind, client_id, occurred_at)
  values (v_task.plant_id, v_task.household_id, p_uid, 'water', p_client_id, p_occurred_at)
  on conflict (client_id) do nothing
  returning id into v_event;

  if v_event is null then
    select e.id, e.plant_id, e.user_id, e.kind into v_old from public.care_events e where e.client_id = p_client_id;
    if v_old.plant_id is distinct from v_task.plant_id or v_old.user_id is distinct from p_uid or v_old.kind <> 'water' then
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

revoke all on function
  public.srv_set_plant_status(uuid, uuid, text, text, date, timestamptz, integer),
  public.srv_complete_task(uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function
  public.srv_set_plant_status(uuid, uuid, text, text, date, timestamptz, integer),
  public.srv_complete_task(uuid, uuid, uuid, timestamptz)
  to service_role;
