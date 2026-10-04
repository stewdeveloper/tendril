begin;
select plan(38);
select tests.create_supabase_user('aoife');
select tests.create_supabase_user('partner');
select tests.create_supabase_user('outsider');
create temp table boot as select public.srv_bootstrap(tests.get_supabase_uid('aoife'), 'aoifefix', 'Aoife', 'Europe/Dublin', 'IE') as r;
select public.srv_bootstrap(tests.get_supabase_uid('partner'), 'partnerfix', null, 'UTC', 'IE');
insert into public.household_members (household_id, user_id, role)
values ((select (r->>'householdId')::uuid from boot), tests.get_supabase_uid('partner'), 'member');
insert into public.species (id, scientific_name, common_name, slug, family, is_houseplant) values
  ('00000000-0000-0000-0000-0000007400c1', 'Fixtest plantae', 'Fix test plant', 'fix-test-plant', 'Testaceae', true);
insert into public.partners (id, name, kind) values ('00000000-0000-0000-0000-0000007400a1', 'Fix Growers', 'grower');
insert into public.qr_codes (code, partner_id, species_id, status) values
  ('FIX-0001', '00000000-0000-0000-0000-0000007400a1', '00000000-0000-0000-0000-0000007400c1', 'active');

create function pg_temp.mk(p_nick text, p_first date default '2026-10-07', p_client uuid default null) returns uuid language sql as $$
  select public.srv_create_plant(tests.get_supabase_uid('aoife'), (select (r->>'householdId')::uuid from boot),
    '00000000-0000-0000-0000-0000007400c1', null, p_nick, null, true, null, 'unknown', 'unknown', 'unknown', 'manual', null, p_first, '2026-10-03T10:00:00Z', p_client)
$$;
create temp table a as select pg_temp.mk('Alpha') as id;

-- 1. A closed plant takes no new check-ins, but a replay still gets the stored answer --------------------------------
create temp table ci1 as select public.srv_check_in(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007400e1', (select id from a), true, '{}', '2026-10-03T11:00:00Z', null, '2026-10-03', '2026-10-07', true) as r;
select public.srv_set_plant_status(tests.get_supabase_uid('aoife'), (select id from a), 'given_away', null, '2026-10-03', '2026-10-03T12:00:00Z', 7);
select is((select count(*)::int from public.care_tasks where plant_id = (select id from a)), 3, 'fixture: three tasks, none open');
select throws_ok($$select public.srv_check_in(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007400e2', (select id from a), true, '{}', '2026-10-03T13:00:00Z', null, '2026-10-03', '2026-10-07', true)$$,
  'P0409', null, 'a new check-in on a closed plant is a conflict');
select is((select count(*)::int from public.care_tasks where plant_id = (select id from a)), 3, 'and creates no tasks');
select is((select count(*)::int from public.care_events where client_id = '00000000-0000-0000-0000-0000007400e2'), 0, 'and no event');
select is((public.srv_check_in(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007400e1', (select id from a), true, '{}', '2026-10-03T11:00:00Z', null, '2026-10-03', '2026-10-07', true)) - 'duplicate',
  (select r from ci1) - 'duplicate', 'a replay on the closed plant returns the original response');
select public.srv_set_plant_status(tests.get_supabase_uid('aoife'), (select id from a), 'alive', null, '2026-10-03', '2026-10-03T14:00:00Z', 7);

-- 2. Date bounds -----------------------------------------------------------------------------------------------------
select throws_ok($$select public.srv_set_plant_status(tests.get_supabase_uid('aoife'), (select id from a), 'dead', null, '2026-10-03', now(), 0)$$, '22023', null, 'base days of 0 are refused');
select throws_ok($$select public.srv_set_plant_status(tests.get_supabase_uid('aoife'), (select id from a), 'dead', null, '2026-10-03', now(), 31)$$, '22023', null, 'base days over 30 are refused');
select throws_ok($$select public.srv_set_plant_status(tests.get_supabase_uid('aoife'), (select id from a), 'dead', null, '2026-10-03', now(), null)$$, '22023', null, 'null base days are refused');
select throws_ok($$select pg_temp.mk('Early', '2026-10-01')$$, '22023', null, 'a first check two days before now is refused');
select throws_ok($$select pg_temp.mk('Late', '2026-11-04')$$, '22023', null, 'a first check more than 31 days out is refused');
select lives_ok($$select pg_temp.mk('Edge1', '2026-10-02')$$, 'one day before now is allowed');
select lives_ok($$select pg_temp.mk('Edge2', '2026-11-03')$$, '31 days out is allowed');
select throws_ok($$select public.srv_check_in(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007400e3', (select id from a), false, '{}', now(), null, '2026-10-03', '2026-10-01', false)$$, '22023', null, 'a next check before the window is refused');
select throws_ok($$select public.srv_check_in(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007400e3', (select id from a), false, '{}', now(), null, '2026-10-03', '2026-11-04', false)$$, '22023', null, 'a next check after the window is refused');
select throws_ok($$select public.srv_check_in(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007400e3', (select id from a), false, '{}', now(), null, null, '2026-10-05', false)$$, '22023', null, 'a missing today is refused');
select is((select count(*)::int from public.care_events where client_id = '00000000-0000-0000-0000-0000007400e3'), 0, 'refused check-ins leave no event');
select lives_ok($$select public.srv_check_in(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007400e4', (select id from a), false, '{}', now(), null, '2026-10-03', '2026-11-03', false)$$, '31 days out is allowed for a check-in');

-- 3. A completion replay is matched by task --------------------------------------------------------------------------
create temp table b as select pg_temp.mk('Beta') as id;
select public.srv_check_in(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007400e5', (select id from b), true, '{}', '2026-10-03T11:00:00Z', null, '2026-10-03', '2026-10-07', true);
create temp table wb as select id from public.care_tasks where plant_id = (select id from b) and kind = 'water';
select public.srv_check_in(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007400e6', (select id from a), true, '{}', '2026-10-03T11:00:00Z', null, '2026-10-03', '2026-10-07', true);
create temp table wa as select id from public.care_tasks where plant_id = (select id from a) and kind = 'water' and status = 'due';
select public.srv_complete_task(tests.get_supabase_uid('aoife'), (select id from wb), '00000000-0000-0000-0000-0000007400f1', '2026-10-03T12:00:00Z');
select throws_ok($$select public.srv_complete_task(tests.get_supabase_uid('aoife'), (select id from wa), '00000000-0000-0000-0000-0000007400f1', '2026-10-03T12:00:00Z')$$,
  'P0409', null, 'a client id used for another task is a conflict');
select is((select status from public.care_tasks where id = (select id from wa)), 'due', 'and the other task stays open');
select is((public.srv_complete_task(tests.get_supabase_uid('aoife'), (select id from wb), '00000000-0000-0000-0000-0000007400f1', '2026-10-03T12:00:00Z'))->>'duplicate', 'true', 'the same task and client id is still a replay');

-- 4. Plant creation is idempotent on client id -----------------------------------------------------------------------
create temp table c1 as select pg_temp.mk('Gamma', '2026-10-07', '00000000-0000-0000-0000-0000007400d1') as id;
select is(pg_temp.mk('Gamma', '2026-10-07', '00000000-0000-0000-0000-0000007400d1'), (select id from c1), 'a repeat returns the same plant');
select is((select count(*)::int from public.plants where client_id = '00000000-0000-0000-0000-0000007400d1'), 1, 'one plant');
select is((select count(*)::int from public.care_tasks where plant_id = (select id from c1)), 1, 'one task');
select is((select count(*)::int from public.care_events where plant_id = (select id from c1)), 1, 'one event');
select throws_ok($$select public.srv_create_plant(tests.get_supabase_uid('partner'), (select (r->>'householdId')::uuid from boot), '00000000-0000-0000-0000-0000007400c1', null, 'Gamma', null, true, null, 'unknown', 'unknown', 'unknown', 'manual', null, '2026-10-07', '2026-10-03T10:00:00Z', '00000000-0000-0000-0000-0000007400d1')$$,
  'P0409', null, 'another user reusing the client id is a conflict');
create temp table l1 as select public.srv_create_plant(tests.get_supabase_uid('aoife'), (select (r->>'householdId')::uuid from boot),
  '00000000-0000-0000-0000-0000007400c1', null, 'Label', null, true, null, 'unknown', 'unknown', 'unknown', 'label_qr', 'FIX-0001', '2026-10-07', '2026-10-03T10:00:00Z', '00000000-0000-0000-0000-0000007400d2') as id;
select public.srv_create_plant(tests.get_supabase_uid('aoife'), (select (r->>'householdId')::uuid from boot),
  '00000000-0000-0000-0000-0000007400c1', null, 'Label', null, true, null, 'unknown', 'unknown', 'unknown', 'label_qr', 'FIX-0001', '2026-10-07', '2026-10-03T10:00:00Z', '00000000-0000-0000-0000-0000007400d2');
select is((select count(*)::int from public.qr_scans where code = 'FIX-0001' and event = 'adoption'), 1, 'a replayed adoption writes one scan');
select throws_ok($$select public.srv_create_plant(tests.get_supabase_uid('aoife'), (select (r->>'householdId')::uuid from boot), '00000000-0000-0000-0000-0000007400c1', null, 'X', null, true, null, 'unknown', 'unknown', 'unknown', 'manual', 'FIX-0001', '2026-10-07', '2026-10-03T10:00:00Z')$$,
  '22023', null, 'a label code needs the label_qr source');

-- 5. Transitions -----------------------------------------------------------------------------------------------------
create temp table d as select pg_temp.mk('Delta') as id;
select public.srv_set_plant_status(tests.get_supabase_uid('aoife'), (select id from d), 'dead', 'Drought', '2026-10-03', '2026-10-04T10:00:00Z', 7);
select is((select new_status from public.care_events where plant_id = (select id from d) and kind = 'status'), 'dead', 'the status event records the new status');
select throws_ok($$select public.srv_set_plant_status(tests.get_supabase_uid('aoife'), (select id from d), 'given_away', null, '2026-10-03', now(), 7)$$, 'P0409', null, 'dead to given_away is a conflict');
select public.srv_set_plant_status(tests.get_supabase_uid('aoife'), (select id from d), 'dead', 'Pests', '2026-10-03', '2026-10-04T11:00:00Z', 7);
select is((select death_cause from public.plants where id = (select id from d)), 'Pests', 'dead to dead with a new cause updates the cause');
select public.srv_set_plant_status(tests.get_supabase_uid('aoife'), (select id from d), 'dead', null, '2026-10-03', '2026-10-04T12:00:00Z', 7);
select is((select death_cause from public.plants where id = (select id from d)), 'Pests', 'dead to dead with no cause keeps it');
select is((select count(*)::int from public.care_events where plant_id = (select id from d) and kind = 'status'), 1, 'and records no further event');
select throws_ok($$select public.srv_set_plant_status(tests.get_supabase_uid('aoife'), (select id from d), 'alive', 'oops', '2026-10-03', now(), 7)$$, '22023', null, 'a cause with alive is refused');
create temp table g as select pg_temp.mk('Gee') as id;
select throws_ok($$select public.srv_set_plant_status(tests.get_supabase_uid('aoife'), (select id from g), 'given_away', 'oops', '2026-10-03', now(), 7)$$, '22023', null, 'a cause with given_away is refused');
select public.srv_set_plant_status(tests.get_supabase_uid('aoife'), (select id from g), 'given_away', null, '2026-10-03', '2026-10-04T10:00:00Z', 7);
select throws_ok($$select public.srv_set_plant_status(tests.get_supabase_uid('aoife'), (select id from g), 'dead', null, '2026-10-03', now(), 7)$$, 'P0409', null, 'given_away to dead is a conflict');

-- 6. An open water task is re-dated, not duplicated ------------------------------------------------------------------
create temp table w as select pg_temp.mk('Water') as id;
select public.srv_check_in(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007400e7', (select id from w), true, '{}', '2026-10-03T11:00:00Z', null, '2026-10-03', '2026-10-07', true);
create temp table wr as select public.srv_check_in(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007400e8', (select id from w), true, '{}', '2026-10-05T11:00:00Z', null, '2026-10-05', '2026-10-09', true) as r;
select is((select count(*)::int from public.care_tasks where plant_id = (select id from w) and kind = 'water' and status = 'due'), 1, 'still one open water task');
select is((select due_on from public.care_tasks where plant_id = (select id from w) and kind = 'water' and status = 'due'), '2026-10-05'::date, 'it is due today');
select is((select r->>'waterTaskCreated' from wr), 'true', 'and the check-in says water is wanted');

select * from finish();
rollback;
