begin;
select plan(39);
select tests.create_supabase_user('aoife');
select tests.create_supabase_user('partner');
select tests.create_supabase_user('nozone');
create temp table boot as select public.srv_bootstrap(tests.get_supabase_uid('aoife'), 'aoifeloop', 'Aoife', 'Europe/Dublin', 'IE') as r;
create temp table boot2 as select public.srv_bootstrap(tests.get_supabase_uid('nozone'), 'nozoneloop', null, 'UTC', 'IE') as r;
insert into public.species (id, scientific_name, common_name, slug, family, is_houseplant) values
  ('00000000-0000-0000-0000-0000007500c1', 'Looptest plantae', 'Loop test plant', 'loop-test-plant', 'Testaceae', true);
insert into public.privacy_zones (user_id, center, radius_m)
values (tests.get_supabase_uid('aoife'), extensions.st_setsrid(extensions.st_makepoint(-6.25, 53.35), 4326)::extensions.geography, 1000);

create function pg_temp.mk(p_uid uuid, p_hh uuid, p_nick text, p_indoor boolean) returns uuid language sql as $$
  select public.srv_create_plant(p_uid, p_hh, '00000000-0000-0000-0000-0000007500c1', null, p_nick, null, p_indoor, null, 'unknown', 'unknown', 'unknown', 'manual', null, '2026-10-07', '2026-10-03T10:00:00Z', null)
$$;
create temp table pl as select
  pg_temp.mk(tests.get_supabase_uid('aoife'), (select (r->>'householdId')::uuid from boot), 'Out', false) as outdoor,
  pg_temp.mk(tests.get_supabase_uid('aoife'), (select (r->>'householdId')::uuid from boot), 'In', true) as indoor,
  pg_temp.mk(tests.get_supabase_uid('aoife'), (select (r->>'householdId')::uuid from boot), 'Dead', false) as dead,
  pg_temp.mk(tests.get_supabase_uid('nozone'), (select (r->>'householdId')::uuid from boot2), 'NoZone', false) as nozone;
update public.plants set status = 'dead', status_at = now() where id = (select dead from pl);

-- Schema ---------------------------------------------------------------------------------------------------------
select has_column('public', 'plants', 'cell_r7', 'plants.cell_r7 exists');
select hasnt_column('public', 'plants', 'latitude', 'plants never store a latitude');
select has_column('public', 'observations', 'health_result', 'observations.health_result exists');
select has_column('public', 'care_events', 'diagnosis_id', 'care_events.diagnosis_id exists');
select isnt_empty($$select 1 from pg_indexes where tablename = 'care_events' and indexdef like '%(diagnosis_id)%'$$, 'diagnosis_id is indexed');
select lives_ok($$insert into public.care_events (plant_id, household_id, kind, occurred_at)
  select id, household_id, 'diagnosis_applied', now() from public.plants where id = (select outdoor from pl)$$, 'diagnosis_applied is an allowed event kind');

-- Weather cache and worker plumbing ------------------------------------------------------------------------------
select is((select relrowsecurity from pg_class where oid = 'private.weather_cache'::regclass), true, 'weather_cache has RLS on');
set local role authenticated;
select throws_ok($$select * from private.weather_cache$$, '42501', null, 'authenticated cannot read weather_cache');
reset role;
select is_empty($$select 1 from pg_proc where proname in ('call_worker', 'household_is_premium') and (has_function_privilege('authenticated', oid, 'execute') or has_function_privilege('anon', oid, 'execute'))$$, 'call_worker and household_is_premium have no client execute');
select is_empty($$select jobname from (values ('tendril-weather'), ('tendril-nightly'), ('tendril-purge-cron-log')) v(jobname) except select jobname from cron.job$$, 'the three cron jobs exist');
select is((select schedule from cron.job where jobname = 'tendril-weather'), '7 */6 * * *', 'weather schedule');
select is((select schedule from cron.job where jobname = 'tendril-nightly'), '17 3 * * *', 'nightly schedule');
select is((select schedule from cron.job where jobname = 'tendril-purge-cron-log'), '27 4 * * *', 'purge schedule');
select matches((select prosrc from pg_proc where proname = 'call_worker' and pronamespace = 'private'::regnamespace), 'Authorization.*Bearer', 'call_worker sends a bearer token');

-- Household premium ----------------------------------------------------------------------------------------------
select is(private.household_is_premium((select (r->>'householdId')::uuid from boot)), false, 'not premium without an entitlement');
select is(private.household_is_premium(null), false, 'null household is not premium');

-- Missing cells --------------------------------------------------------------------------------------------------
select is((select count(*)::int from public.srv_plants_missing_cell(100) where plant_id = (select outdoor from pl)), 1, 'outdoor plant with a zone needs a cell');
select is_empty($$select 1 from public.srv_plants_missing_cell(100) where plant_id in (select indoor from pl union select dead from pl union select nozone from pl)$$, 'indoor, dead and zoneless plants do not');
select is((select owner_tz from public.srv_plants_missing_cell(100) where plant_id = (select outdoor from pl)), 'Europe/Dublin', 'owner tz comes with it');
select ok((select abs(zone_lat - 53.35) < 0.0001 and abs(zone_lng + 6.25) < 0.0001 from public.srv_plants_missing_cell(100) where plant_id = (select outdoor from pl)), 'zone centre as lat and lng');
select is((select count(*)::int from public.srv_plants_missing_cell(0)), 0, 'limit is respected');

select is(public.srv_set_plant_cells(jsonb_build_array(jsonb_build_object('plantId', (select outdoor from pl), 'cell', '608533827635118079'))), 1, 'one cell set');
select is((select cell_r7::text from public.plants where id = (select outdoor from pl)), '608533827635118079', 'a cell above 2^53 round-trips exactly');
select is_empty($$select 1 from public.srv_plants_missing_cell(100) where plant_id = (select outdoor from pl)$$, 'a plant with a cell is no longer missing one');

-- Weather cache access ------------------------------------------------------------------------------------------
select is_empty($$select 1 from public.srv_weather_cells_due('6 hours', 100)$$, 'non-premium households have no cells due');
insert into public.entitlements (user_id, source, active_until) values (tests.get_supabase_uid('aoife'), 'store', now() + interval '1 day');
select is(private.household_is_premium((select (r->>'householdId')::uuid from boot)), true, 'premium once any member is');
select is((select cell from public.srv_weather_cells_due('6 hours', 100)), '608533827635118079', 'premium outdoor cell is due, as text');
select is((select tz from public.srv_weather_cells_due('6 hours', 100)), 'Europe/Dublin', 'with its tz');
select lives_ok($$select public.srv_weather_store('608533827635118079', 'Europe/Dublin', '{"temp": 11}'::jsonb)$$, 'store a summary');
select is_empty($$select 1 from public.srv_weather_cells_due('6 hours', 100)$$, 'a fresh cell is not due');
select is((select count(*)::int from public.srv_weather_cells_due('0 seconds', 100)), 1, 'but is due again when the interval has passed');
select is((select summary from public.srv_weather_for_cell('608533827635118079')), '{"temp": 11}'::jsonb, 'summary read back');
select matches((select fetched_at from public.srv_weather_for_cell('608533827635118079')), '^\d{4}-\d\d-\d\dT', 'fetched_at is ISO text');
select public.srv_weather_store('608533827635118079', 'Europe/London', '{"temp": 12}'::jsonb);
select is((select tz || (summary->>'temp') from private.weather_cache where cell_r7 = 608533827635118079), 'Europe/London12', 'store upserts');
select is_empty($$select 1 from public.srv_weather_for_cell('1')$$, 'an unknown cell has no summary');

-- Indoor clears the cell ----------------------------------------------------------------------------------------
update public.plants set indoor = true where id = (select outdoor from pl);
select is((select cell_r7 from public.plants where id = (select outdoor from pl)), null, 'indoor clears the cell');

-- One open check per plant --------------------------------------------------------------------------------------
select throws_ok($$insert into public.care_tasks (plant_id, household_id, kind, due_on)
  select id, household_id, 'check', '2026-10-09' from public.plants where id = (select indoor from pl)$$, '23505', null, 'a second open check is refused');
select lives_ok($$insert into public.care_tasks (plant_id, household_id, kind, due_on, status)
  select id, household_id, 'check', '2026-10-09', 'done' from public.plants where id = (select indoor from pl)$$, 'closed checks are unlimited');

-- srv grants ----------------------------------------------------------------------------------------------------
select is_empty($$select proname from pg_proc where proname in ('srv_plants_missing_cell', 'srv_set_plant_cells', 'srv_weather_cells_due', 'srv_weather_store', 'srv_weather_for_cell')
  and (has_function_privilege('authenticated', oid, 'execute') or has_function_privilege('anon', oid, 'execute') or not has_function_privilege('service_role', oid, 'execute'))$$, 'new srv_ functions are service_role only');

select * from finish();
rollback;
