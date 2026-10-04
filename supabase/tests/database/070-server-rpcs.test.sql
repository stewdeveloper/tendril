begin;
select plan(59);
-- supabase/seed.sql loads a real catalogue; this test inserts its own species, so use names the catalogue does not hold.
select tests.create_supabase_user('aoife');
select tests.create_supabase_user('partner');
select tests.create_supabase_user('outsider');

-- Privileges: every srv_* function is service_role only. -------------------------------------------------------
create temp view srv_fns as
select p.oid, p.proname::text as proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'srv\_%';
select is((select count(*)::int from srv_fns), 21, 'there are 21 srv_ functions');
select is_empty($$select proname from srv_fns where has_function_privilege('anon', oid, 'execute')$$, 'anon cannot execute any srv_ function');
select is_empty($$select proname from srv_fns where has_function_privilege('authenticated', oid, 'execute')$$, 'authenticated cannot execute any srv_ function');
select is_empty($$select proname from srv_fns where not has_function_privilege('service_role', oid, 'execute')$$, 'service_role can execute every srv_ function');
select is_empty($$select f.proname from srv_fns f join pg_proc p on p.oid = f.oid where not p.prosecdef$$, 'every srv_ function is security definer');
select is_empty($$select f.proname from srv_fns f join pg_proc p on p.oid = f.oid where p.proconfig is null or not ('search_path=""' = any (p.proconfig))$$, 'every srv_ function pins an empty search_path');

-- Quota ----------------------------------------------------------------------------------------------------------
select is(public.srv_reserve_usage(tests.get_supabase_uid('aoife'), 'identification', '2026-10', 2), '{"ok": true, "used": 1}'::jsonb, 'first reservation');
select is(public.srv_reserve_usage(tests.get_supabase_uid('aoife'), 'identification', '2026-10', 2), '{"ok": true, "used": 2}'::jsonb, 'second reservation');
select is(public.srv_reserve_usage(tests.get_supabase_uid('aoife'), 'identification', '2026-10', 2), '{"ok": false, "used": 2}'::jsonb, 'refused at the limit, used unchanged');
select public.srv_release_usage(tests.get_supabase_uid('aoife'), 'identification', '2026-10');
select is((select used from public.usage_counters where kind = 'identification'), 1, 'release gives one back');
select is(public.srv_reserve_usage(tests.get_supabase_uid('aoife'), 'diagnosis', '2026-10', 0), '{"ok": false, "used": 0}'::jsonb, 'a zero limit refuses with used 0');
select is(public.srv_is_premium(tests.get_supabase_uid('aoife')), false, 'not premium without an entitlement');
insert into public.entitlements (user_id, source, active_until) values (tests.get_supabase_uid('aoife'), 'preview', now() + interval '1 day');
select is(public.srv_is_premium(tests.get_supabase_uid('aoife')), true, 'premium with an active entitlement');

-- Bootstrap ------------------------------------------------------------------------------------------------------
create temp table boot as select public.srv_bootstrap(tests.get_supabase_uid('aoife'), 'aoifegrows', 'Aoife', 'Europe/Dublin', 'IE') as r;
select is((select r->>'handle' from boot), 'aoifegrows', 'bootstrap uses the requested handle');
select is(public.srv_bootstrap(tests.get_supabase_uid('aoife'), 'other', null, 'UTC', 'US'), (select r from boot), 'bootstrap is idempotent and ignores later arguments');
select is((select count(*)::int from public.households), 1, 'one household');
select is((select role from public.household_members where user_id = tests.get_supabase_uid('aoife')), 'owner', 'creator is the owner');
select is((select name from public.households), 'Home', 'household is called Home');
select is((select age_confirmed_13_plus from public.profiles where id = tests.get_supabase_uid('aoife')), true, 'age attestation stored');
select throws_ok($$select public.srv_bootstrap(tests.get_supabase_uid('partner'), 'aoifegrows', null, 'UTC', 'IE')$$, 'P0409', null, 'a taken handle raises P0409');
select is((select count(*)::int from public.profiles), 1, 'the failed bootstrap left no profile behind');
select matches(public.srv_bootstrap(tests.get_supabase_uid('partner'), null, null, 'UTC', 'IE')->>'handle', '^plant[0-9]{6}$', 'a generated handle is plant plus six digits');

-- Fixtures for the rest ------------------------------------------------------------------------------------------
insert into public.species (id, scientific_name, common_name, slug) values
  ('00000000-0000-0000-0000-0000000070c1', 'Srvtest plantae', 'Srv test plant', 'srv-test-plant');
insert into public.observations (id, user_id, device_time, capture_source)
values ('00000000-0000-0000-0000-0000000070b1', tests.get_supabase_uid('aoife'), now(), 'camera'),
       ('00000000-0000-0000-0000-0000000070b2', tests.get_supabase_uid('aoife'), now(), 'camera');

-- Provider token -------------------------------------------------------------------------------------------------
select public.srv_store_provider(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000000070b1', 'plantid', 'tok-1', '{"a": 1}'::jsonb);
select is(public.srv_get_provider_token(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000000070b1'), 'tok-1', 'the provider token round-trips');
select public.srv_store_provider(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000000070b1', 'plantid', 'tok-2', '{"a": 2}'::jsonb);
select is(public.srv_get_provider_token(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000000070b1'), 'tok-2', 'storing again overwrites');
select is((select count(*)::int from private.observation_provider), 1, 'one provider row per observation');
select is(public.srv_get_provider_token(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000000070b2'), null, 'no token is null');
select throws_ok($$select public.srv_store_provider(tests.get_supabase_uid('partner'), '00000000-0000-0000-0000-0000000070b1', 'plantid', 'evil', '{}'::jsonb)$$, 'P0403', null, 'another user cannot overwrite a provider token');
select throws_ok($$select public.srv_get_provider_token(tests.get_supabase_uid('partner'), '00000000-0000-0000-0000-0000000070b1')$$, 'P0403', null, 'another user cannot read a provider token');

-- Privacy zone ---------------------------------------------------------------------------------------------------
select is(public.srv_point_in_zone(tests.get_supabase_uid('aoife'), 53.35, -6.26), false, 'no zone means not inside');
insert into public.privacy_zones (user_id, center, radius_m)
values (tests.get_supabase_uid('aoife'), extensions.st_geogfromtext('POINT(-6.26 53.35)'), 1000);
select is(public.srv_point_in_zone(tests.get_supabase_uid('aoife'), 53.351, -6.261), true, 'a point near the centre is inside');
select is(public.srv_point_in_zone(tests.get_supabase_uid('aoife'), 53.45, -6.26), false, 'a point 11 km away is outside');
select is(public.srv_point_in_zone(tests.get_supabase_uid('partner'), 53.351, -6.261), false, 'another user has no zone');

-- Plantdex -------------------------------------------------------------------------------------------------------
select is(public.srv_plantdex_record(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000000070c1', 'houseplant', '00000000-0000-0000-0000-0000000070b1', '2026-10-01T10:00:00Z'),
  '{"newToPlantdex": true, "count": 1}'::jsonb, 'the first find is new');
select is(public.srv_plantdex_record(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000000070c1', 'houseplant', '00000000-0000-0000-0000-0000000070b2', '2026-10-02T10:00:00Z'),
  '{"newToPlantdex": false, "count": 1}'::jsonb, 'a second find is not new');
select is((select finds_count from public.plantdex_entries), 2, 'finds_count went up by one');
select is((select first_observation_id from public.plantdex_entries), '00000000-0000-0000-0000-0000000070b1'::uuid, 'the first observation is kept');

-- Pets -----------------------------------------------------------------------------------------------------------
select public.srv_replace_pets(tests.get_supabase_uid('aoife'), (select (r->>'householdId')::uuid from boot), '[{"animal":"cat","name":"Miso"},{"animal":"dog","name":" "}]'::jsonb);
select is((select count(*)::int from public.household_pets), 2, 'two pets stored');
select is((select name from public.household_pets where animal = 'dog'), null, 'a blank name becomes null');
select public.srv_replace_pets(tests.get_supabase_uid('aoife'), (select (r->>'householdId')::uuid from boot), '[]'::jsonb);
select is((select count(*)::int from public.household_pets), 0, 'replacing with nothing clears the pets');
select throws_ok($$select public.srv_replace_pets(tests.get_supabase_uid('aoife'), (select (r->>'householdId')::uuid from boot), '[{"animal":"fish"}]'::jsonb)$$, '23514', null, 'a bad animal violates the check');
select throws_ok($$select public.srv_replace_pets(tests.get_supabase_uid('outsider'), (select (r->>'householdId')::uuid from boot), '[]'::jsonb)$$, 'P0403', null, 'a non-member cannot replace pets');
select throws_ok($$select public.srv_replace_pets(tests.get_supabase_uid('aoife'), (select (r->>'householdId')::uuid from boot), '{}'::jsonb)$$, '22023', null, 'a non-array is refused');

-- Plant and check-in ---------------------------------------------------------------------------------------------
create temp table made as select public.srv_create_plant(tests.get_supabase_uid('aoife'), (select (r->>'householdId')::uuid from boot),
  '00000000-0000-0000-0000-0000000070c1', null, 'Lily', 'Bedroom', true, 14, 'plastic', 'yes', 'medium', 'manual', null, '2026-10-07', '2026-10-03T10:00:00Z') as id;
select is((select count(*)::int from public.care_tasks where plant_id = (select id from made) and kind = 'check' and due_on = '2026-10-07'), 1, 'the first check task exists');
select is((select count(*)::int from public.care_events where plant_id = (select id from made) and kind = 'setup'), 1, 'the setup event exists');
select throws_ok($$select public.srv_create_plant(tests.get_supabase_uid('partner'), (select (r->>'householdId')::uuid from boot), '00000000-0000-0000-0000-0000000070c1', null, 'X', null, true, null, 'unknown', 'unknown', 'unknown', 'manual', null, '2026-10-07', now())$$,
  'P0403', null, 'a non-member cannot create a plant');

create temp table ci1 as select public.srv_check_in(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000000070e1', (select id from made), true, '{healthy}', '2026-10-07T09:00:00Z', null, '2026-10-07', '2026-10-11', true) as r;
select is((select r from ci1), jsonb_build_object('duplicate', false, 'eventId', (select r->>'eventId' from ci1), 'nextCheckOn', '2026-10-11', 'waterTaskCreated', true), 'check-in reports the next check and the water task');
select is((select count(*)::int from public.care_tasks where plant_id = (select id from made) and status = 'due'), 2, 'one water and one check task are open');
select is((select status from public.care_tasks where plant_id = (select id from made) and due_on = '2026-10-07' and kind = 'check'), 'done', 'the old check task is done');
select is((select (public.srv_check_in(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000000070e1', (select id from made), true, '{healthy}', '2026-10-07T09:00:00Z', null, '2026-10-07', '2026-10-11', true))->>'duplicate'), 'true', 'a repeat is reported as a duplicate');
select is((select count(*)::int from public.care_events where client_id = '00000000-0000-0000-0000-0000000070e1'), 1, 'a repeat stores one event');
select is((select count(*)::int from public.care_tasks where plant_id = (select id from made)), 3, 'a repeat creates no tasks');

-- Fix round 1 -----------------------------------------------------------------------------------------------------
insert into public.household_members (household_id, user_id, role)
values ((select (r->>'householdId')::uuid from boot), tests.get_supabase_uid('partner'), 'member');
select throws_ok($$select public.srv_create_plant(tests.get_supabase_uid('partner'), (select (r->>'householdId')::uuid from boot), '00000000-0000-0000-0000-0000000070c1', '00000000-0000-0000-0000-0000000070b1', 'X', null, true, null, 'unknown', 'unknown', 'unknown', 'manual', null, '2026-10-07', now())$$,
  'P0403', null, 'a plant cannot link another user''s observation');

-- A replay returns the stored response, even for soil_dry with no water task, and even after later check-ins.
create temp table ci2 as select public.srv_check_in(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000000070e2', (select id from made), true, '{}', '2026-10-08T09:00:00Z', null, '2026-10-08', '2026-10-15', false) as r;
select is((select r from ci2), jsonb_build_object('duplicate', false, 'eventId', (select r->>'eventId' from ci2), 'nextCheckOn', '2026-10-15', 'waterTaskCreated', false), 'soil dry without a water task reports waterTaskCreated false');
select public.srv_check_in(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000000070e3', (select id from made), false, '{}', '2026-10-09T09:00:00Z', null, '2026-10-09', '2026-10-11', false);
select is((public.srv_check_in(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000000070e2', (select id from made), true, '{}', '2026-10-08T09:00:00Z', null, '2026-10-08', '2026-10-15', false)) - 'duplicate',
  (select r from ci2) - 'duplicate', 'the replay equals the original, though a later check-in moved the open task');
select is((select (public.srv_check_in(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000000070e1', (select id from made), true, '{healthy}', '2026-10-07T09:00:00Z', null, '2026-10-07', '2026-10-11', true))->>'waterTaskCreated'), 'true', 'a replay of a water-creating check-in says so');

create temp table made2 as select public.srv_create_plant(tests.get_supabase_uid('aoife'), (select (r->>'householdId')::uuid from boot),
  '00000000-0000-0000-0000-0000000070c1', null, 'Fern', null, true, null, 'unknown', 'unknown', 'unknown', 'manual', null, '2026-10-07', now()) as id;
select throws_ok($$select public.srv_check_in(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000000070e2', (select id from made2), false, '{}', now(), null, current_date, current_date, false)$$,
  'P0409', null, 'the same client id on another plant is a conflict');
select throws_ok($$select public.srv_check_in(tests.get_supabase_uid('partner'), '00000000-0000-0000-0000-0000000070e2', (select id from made), false, '{}', now(), null, current_date, current_date, false)$$,
  'P0409', null, 'the same client id from another household member is a conflict');
select throws_ok($$select public.srv_check_in(tests.get_supabase_uid('outsider'), '00000000-0000-0000-0000-0000000070e9', (select id from made), false, '{}', now(), null, current_date, current_date, false)$$,
  'P0403', null, 'a non-member cannot check in');
select throws_ok($$select public.srv_check_in(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000000070e9', '00000000-0000-0000-0000-00000000dead', false, '{}', now(), null, current_date, current_date, false)$$,
  'P0404', null, 'an unknown plant is not found');

select * from finish();
rollback;
