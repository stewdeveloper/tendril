-- Phase 3 Task 3: the nightly recompute. The worker pages through alive plants with everything the engine needs
-- (srv_recompute_batch), computes each plant's next check in TypeScript, and writes it back with a compare-and-set on
-- care_state (srv_recompute_plant). Both are service_role only.

-- One page of alive plants after p_after, in plant id order (keyset paging; at most 1000 a page). Each row carries:
-- - the raw care_state (the compare-and-set value);
-- - the engine factors (species watering and curated interval, pot, light, drainage, indoor);
-- - the household plan (premium when any member is);
-- - the creator's tz and country code (UTC and null when the creator is gone);
-- - the open check's due date (null when there is none);
-- - the weather cell as text (bigints lose precision in JSON) and its cached summary with fetched_at as ISO text.
create function public.srv_recompute_batch(p_after uuid, p_limit integer)
returns table (
  plant_id uuid,
  care_state jsonb,
  watering_min integer,
  watering_max integer,
  interval_override integer,
  pot_material text,
  pot_size_cm integer,
  light text,
  drainage text,
  indoor boolean,
  plan text,
  tz text,
  country_code text,
  open_check_on date,
  cell text,
  weather_summary jsonb,
  weather_fetched_at text
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.care_state, s.watering_min::integer, s.watering_max::integer, s.check_interval_days::integer,
    p.pot_material, p.pot_size_cm::integer, p.light, p.drainage, p.indoor,
    case when private.household_is_premium(p.household_id) then 'premium' else 'free' end,
    coalesce(pr.timezone, 'UTC'), pr.country_code,
    t.due_on, p.cell_r7::text, w.summary,
    to_char(w.fetched_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  from public.plants p
  join public.species s on s.id = p.species_id
  left join public.profiles pr on pr.id = p.created_by
  -- At most one: care_tasks_one_open_check_idx.
  left join public.care_tasks t on t.plant_id = p.id and t.kind = 'check' and t.status = 'due'
  left join private.weather_cache w on w.cell_r7 = p.cell_r7
  where p.status = 'alive' and p.id > coalesce(p_after, '00000000-0000-0000-0000-000000000000'::uuid)
  order by p.id
  limit least(greatest(coalesce(p_limit, 0), 0), 1000)
$$;

-- Writes a recomputed state and next check under the plant's lock. Returns:
-- - 'closed' when the plant is not alive or is gone (nothing is written);
-- - 'conflict' when care_state is no longer p_expected_state (it changed since the batch read it; nothing is written);
-- - 'updated' when the state was written, the open check re-dated, or a missing open check inserted;
-- - 'unchanged' otherwise.
-- A check that is due or overdue (due_on <= p_today) is never moved, and a check is never dated before tomorrow.
create function public.srv_recompute_plant(
  p_plant_id uuid,
  p_expected_state jsonb,
  p_state jsonb,
  p_next_check_on date,
  p_today date
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_plant record;
  v_task_id uuid;
  v_due_on date;
  v_changed boolean := false;
begin
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'state must be an object' using errcode = '22023';
  end if;
  if p_next_check_on is null or p_today is null then
    raise exception 'next check and today are required' using errcode = '22023';
  end if;

  select p.household_id, p.status, p.care_state into v_plant from public.plants p where p.id = p_plant_id for update;
  if not found or v_plant.status <> 'alive' then
    return 'closed';
  end if;
  if v_plant.care_state is distinct from p_expected_state then
    return 'conflict';
  end if;

  if v_plant.care_state is distinct from p_state then
    update public.plants set care_state = p_state where id = p_plant_id;
    v_changed := true;
  end if;

  select t.id, t.due_on into v_task_id, v_due_on from public.care_tasks t
  where t.plant_id = p_plant_id and t.kind = 'check' and t.status = 'due'
  for update;
  -- Insert a missing open check, or re-date one that is not yet due; a due or overdue check stays put.
  if v_task_id is null or (v_due_on > p_today and v_due_on <> p_next_check_on) then
    if p_next_check_on <= p_today then
      raise exception 'a check is never dated before tomorrow' using errcode = '22023';
    end if;
    if v_task_id is null then
      insert into public.care_tasks (plant_id, household_id, kind, due_on)
      values (p_plant_id, v_plant.household_id, 'check', p_next_check_on);
    else
      update public.care_tasks set due_on = p_next_check_on where id = v_task_id;
    end if;
    v_changed := true;
  end if;

  return case when v_changed then 'updated' else 'unchanged' end;
end $$;

revoke all on function public.srv_recompute_batch(uuid, integer), public.srv_recompute_plant(uuid, jsonb, jsonb, date, date)
from public, anon, authenticated;
grant execute on function public.srv_recompute_batch(uuid, integer), public.srv_recompute_plant(uuid, jsonb, jsonb, date, date)
to service_role;
