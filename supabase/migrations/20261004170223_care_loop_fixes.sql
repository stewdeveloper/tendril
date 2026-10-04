-- Phase 3 Task 2 fix round 1: the cell follows the home area, clients cannot see cells, pg_net is closed to clients,
-- the checkBasis backfill uses server time, and the dedupe is a callable function.

-- 1. Cell lifecycle -----------------------------------------------------------------------------------------------
-- Deleting or moving a home area invalidates every cell derived from it.
create function private.clear_cells_on_zone_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.plants set cell_r7 = null where created_by = old.user_id and cell_r7 is not null;
  return null;
end $$;
revoke all on function private.clear_cells_on_zone_change() from public, anon, authenticated;
create trigger privacy_zones_clear_cells after delete or update of center, radius_m on public.privacy_zones
  for each row execute function private.clear_cells_on_zone_change();

-- The creator must still be a member of the plant's household.
create or replace function public.srv_plants_missing_cell(p_limit integer)
returns table (plant_id uuid, zone_lat double precision, zone_lng double precision, owner_tz text)
language sql stable security definer set search_path = '' as $$
  select p.id, extensions.st_y(z.center::extensions.geometry), extensions.st_x(z.center::extensions.geometry),
    coalesce(pr.timezone, 'UTC')
  from public.plants p
  join public.privacy_zones z on z.user_id = p.created_by
  left join public.profiles pr on pr.id = p.created_by
  where p.status = 'alive' and not p.indoor and p.cell_r7 is null
    and exists (select 1 from public.household_members m where m.household_id = p.household_id and m.user_id = p.created_by)
  order by p.created_at, p.id
  limit greatest(p_limit, 0)
$$;

-- A cell is only due while its plant's creator still has a home area.
create or replace function public.srv_weather_cells_due(p_older_than interval, p_limit integer)
returns table (cell text, tz text)
language sql stable security definer set search_path = '' as $$
  select p.cell_r7::text, min(coalesce(pr.timezone, 'UTC'))
  from public.plants p
  join public.privacy_zones z on z.user_id = p.created_by
  left join public.profiles pr on pr.id = p.created_by
  left join private.weather_cache w on w.cell_r7 = p.cell_r7
  where p.status = 'alive' and not p.indoor and p.cell_r7 is not null
    and private.household_is_premium(p.household_id)
    and (w.cell_r7 is null or w.fetched_at <= now() - p_older_than)
  group by p.cell_r7
  order by p.cell_r7
  limit greatest(p_limit, 0)
$$;

-- 3. Clients never read plants.cell_r7: a column grant on everything else (RLS still applies). ----------------------
revoke select on public.plants from authenticated;
grant select (id, household_id, species_id, observation_id, nickname, room, indoor, pot_size_cm, pot_material, drainage,
  light, status, status_at, death_cause, parent_plant_id, source, label_code, photo_path, care_state, created_by,
  created_at, updated_at, client_id) on public.plants to authenticated;

-- 4. pg_net: NOT done here. The net.* grants to anon/authenticated are made by supabase_admin (event trigger
-- grant_pg_net_access) and the postgres role the migrations run as can neither revoke them nor act as supabase_admin
-- (a REVOKE reports "no privileges could be revoked"). See the task 2 report.

-- 6. call_worker trims a trailing slash from project_url ----------------------------------------------------------------
create or replace function private.call_worker(path text) returns bigint
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
    url := rtrim(base, '/') || '/functions/v1/worker' || path,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || key, 'apikey', key),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
end $$;

-- 7. Dedupe of open checks as a function: keeps the earliest-due open check per plant, supersedes the rest. Returns the
-- number superseded.
create function private.dedupe_open_checks() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  update public.care_tasks t set status = 'superseded', completed_at = now()
  where t.kind = 'check' and t.status = 'due'
    and t.id not in (
      select distinct on (d.plant_id) d.id from public.care_tasks d
      where d.kind = 'check' and d.status = 'due'
      order by d.plant_id, d.due_on, d.created_at, d.id
    );
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function private.dedupe_open_checks() from public, anon, authenticated;
select private.dedupe_open_checks();

-- 5. checkBasis backfill, corrected: server time (care_events.created_at) for both the date and the latest-event pick.
-- Recomputed for every plant that has a check-in. Nothing but the first backfill has written checkBasis so far (the
-- engine does not write state until Task 3), so overwriting is safe.
update public.plants p
set care_state = p.care_state || (
  select jsonb_build_object('checkBasis', jsonb_build_object(
    'from', to_char((e.created_at at time zone coalesce(pr.timezone, 'UTC'))::date, 'YYYY-MM-DD'),
    'kind', case when e.soil_dry then 'interval' else 'recheck' end))
  from public.care_events e
  left join public.profiles pr on pr.id = e.user_id
  where e.plant_id = p.id and e.kind = 'checkin' and e.soil_dry is not null
  order by e.created_at desc, e.id desc limit 1
)
where exists (select 1 from public.care_events e where e.plant_id = p.id and e.kind = 'checkin' and e.soil_dry is not null);
