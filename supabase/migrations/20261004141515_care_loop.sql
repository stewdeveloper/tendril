-- Phase 3 Task 2: plant weather cells, the private weather cache, the cron-driven worker plumbing and the schema
-- groundwork for the care loop (one open check per plant, diagnosis links, check basis backfill).

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Weather cells ---------------------------------------------------------------------------------------------------
-- Plants never store a latitude. cell_r7 is an H3 resolution-7 cell computed by the worker from the creator's
-- randomised privacy-zone centre. It only applies to outdoor plants.
alter table public.plants add column cell_r7 bigint;

create function private.clear_cell_when_indoor() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.indoor then
    new.cell_r7 := null;
  end if;
  return new;
end $$;
create trigger plants_clear_cell_when_indoor before insert or update of indoor, cell_r7 on public.plants
  for each row execute function private.clear_cell_when_indoor();

create table private.weather_cache (
  cell_r7 bigint primary key,
  tz text not null,
  fetched_at timestamptz not null,
  summary jsonb not null
);
alter table private.weather_cache enable row level security;
revoke all on private.weather_cache from public, anon, authenticated;
grant all on private.weather_cache to service_role;

-- True when any member of the household is premium.
create function private.household_is_premium(p_household uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = p_household and private.is_premium(m.user_id)
  )
$$;
revoke all on function private.household_is_premium(uuid) from public, anon, authenticated;

-- Outdoor, alive plants without a cell whose creator has a privacy zone. The zone centre is already randomised.
create function public.srv_plants_missing_cell(p_limit integer)
returns table (plant_id uuid, zone_lat double precision, zone_lng double precision, owner_tz text)
language sql stable security definer set search_path = '' as $$
  select p.id, extensions.st_y(z.center::extensions.geometry), extensions.st_x(z.center::extensions.geometry),
    coalesce(pr.timezone, 'UTC')
  from public.plants p
  join public.privacy_zones z on z.user_id = p.created_by
  left join public.profiles pr on pr.id = p.created_by
  where p.status = 'alive' and not p.indoor and p.cell_r7 is null
  order by p.created_at, p.id
  limit greatest(p_limit, 0)
$$;

-- p_cells: [{"plantId": uuid, "cell": "<decimal text>"}]. Returns how many plants were updated.
create function public.srv_set_plant_cells(p_cells jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if p_cells is null or jsonb_typeof(p_cells) <> 'array' then
    raise exception 'cells must be an array' using errcode = '22023';
  end if;
  with c as (
    select (e->>'plantId')::uuid as plant_id, (e->>'cell')::bigint as cell
    from jsonb_array_elements(p_cells) e
  )
  update public.plants p set cell_r7 = c.cell
  from c where p.id = c.plant_id and not p.indoor and p.status = 'alive';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Distinct cells of alive outdoor plants in premium households whose cache row is missing or older than the interval.
create function public.srv_weather_cells_due(p_older_than interval, p_limit integer)
returns table (cell text, tz text)
language sql stable security definer set search_path = '' as $$
  select p.cell_r7::text, min(coalesce(pr.timezone, 'UTC'))
  from public.plants p
  left join public.profiles pr on pr.id = p.created_by
  left join private.weather_cache w on w.cell_r7 = p.cell_r7
  where p.status = 'alive' and not p.indoor and p.cell_r7 is not null
    and private.household_is_premium(p.household_id)
    and (w.cell_r7 is null or w.fetched_at <= now() - p_older_than)
  group by p.cell_r7
  order by p.cell_r7
  limit greatest(p_limit, 0)
$$;

create function public.srv_weather_store(p_cell text, p_tz text, p_summary jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into private.weather_cache as w (cell_r7, tz, fetched_at, summary)
  values (p_cell::bigint, p_tz, now(), p_summary)
  on conflict (cell_r7) do update set tz = excluded.tz, fetched_at = excluded.fetched_at, summary = excluded.summary
$$;

create function public.srv_weather_for_cell(p_cell text) returns table (summary jsonb, fetched_at text)
language sql stable security definer set search_path = '' as $$
  select w.summary, to_char(w.fetched_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  from private.weather_cache w where w.cell_r7 = p_cell::bigint
$$;

revoke all on function
  public.srv_plants_missing_cell(integer), public.srv_set_plant_cells(jsonb), public.srv_weather_cells_due(interval, integer),
  public.srv_weather_store(text, text, jsonb), public.srv_weather_for_cell(text)
from public, anon, authenticated;
grant execute on function
  public.srv_plants_missing_cell(integer), public.srv_set_plant_cells(jsonb), public.srv_weather_cells_due(interval, integer),
  public.srv_weather_store(text, text, jsonb), public.srv_weather_for_cell(text)
to service_role;

-- Worker calls ----------------------------------------------------------------------------------------------------
-- The worker authenticates with a dedicated random secret (Vault worker_key), not the service key.
create function private.call_worker(path text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  base text;
  key text;
begin
  select decrypted_secret into base from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into key from vault.decrypted_secrets where name = 'worker_key';
  if base is null or key is null then
    raise notice 'worker secrets missing; skipping %', path;
    return null;
  end if;
  return net.http_post(
    url := base || '/functions/v1/worker' || path,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || key, 'apikey', key),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
end $$;
revoke all on function private.call_worker(text) from public, anon, authenticated;

select cron.schedule('tendril-weather', '7 */6 * * *', $$select private.call_worker('/weather')$$);
select cron.schedule('tendril-nightly', '17 3 * * *', $$select private.call_worker('/nightly')$$);
select cron.schedule('tendril-purge-cron-log', '27 4 * * *', $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$);

-- One open check per plant ----------------------------------------------------------------------------------------
-- Keep the earliest-due open check, supersede the rest, then enforce it.
update public.care_tasks t set status = 'superseded', completed_at = now()
where t.kind = 'check' and t.status = 'due'
  and t.id not in (
    select distinct on (d.plant_id) d.id from public.care_tasks d
    where d.kind = 'check' and d.status = 'due'
    order by d.plant_id, d.due_on, d.created_at, d.id
  );
create unique index care_tasks_one_open_check_idx on public.care_tasks (plant_id) where kind = 'check' and status = 'due';

-- Diagnosis groundwork --------------------------------------------------------------------------------------------
alter table public.observations add column health_result jsonb;
alter table public.care_events add column diagnosis_id uuid references public.diagnoses (id) on delete set null;
create index care_events_diagnosis_idx on public.care_events (diagnosis_id) where diagnosis_id is not null;
-- care_events.kind already allows 'diagnosis_applied'.

-- checkBasis backfill ---------------------------------------------------------------------------------------------
-- A damp last check-in means the next check is a recheck; a dry one means a normal interval. Plants with no
-- check-in keep no key.
update public.plants p
set care_state = p.care_state || (
  select jsonb_build_object('checkBasis', jsonb_build_object(
    'from', to_char((e.occurred_at at time zone coalesce(pr.timezone, 'UTC'))::date, 'YYYY-MM-DD'),
    'kind', case when e.soil_dry then 'interval' else 'recheck' end))
  from public.care_events e
  left join public.profiles pr on pr.id = e.user_id
  where e.plant_id = p.id and e.kind = 'checkin' and e.soil_dry is not null
  order by e.occurred_at desc, e.created_at desc limit 1
)
where (not (p.care_state ? 'checkBasis') or jsonb_typeof(p.care_state->'checkBasis') = 'null')
  and exists (select 1 from public.care_events e where e.plant_id = p.id and e.kind = 'checkin' and e.soil_dry is not null);
