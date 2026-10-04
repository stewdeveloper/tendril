begin;
select plan(45);
select tests.create_supabase_user('aoife');
select tests.create_supabase_user('partner');
select tests.create_supabase_user('outsider');
create temp table boot as select public.srv_bootstrap(tests.get_supabase_uid('aoife'), 'aoifecare', 'Aoife', 'Europe/Dublin', 'IE') as r;
select public.srv_bootstrap(tests.get_supabase_uid('partner'), 'partnercare', null, 'UTC', 'IE');
insert into public.household_members (household_id, user_id, role)
values ((select (r->>'householdId')::uuid from boot), tests.get_supabase_uid('partner'), 'member');

insert into public.species (id, scientific_name, common_name, slug, family, is_houseplant) values
  ('00000000-0000-0000-0000-0000007300c1', 'Caretest plantae', 'Care test plant', 'care-test-plant', 'Testaceae', true),
  ('00000000-0000-0000-0000-0000007300c2', 'Caretest alba', 'Care test other', 'care-test-other', 'Testaceae', true);
insert into public.partners (id, name, kind) values ('00000000-0000-0000-0000-0000007300a1', 'Care Growers', 'grower');
insert into public.qr_codes (code, partner_id, species_id, status) values
  ('CARE-0001', '00000000-0000-0000-0000-0000007300a1', '00000000-0000-0000-0000-0000007300c1', 'active'),
  ('CARE-OLD1', '00000000-0000-0000-0000-0000007300a1', '00000000-0000-0000-0000-0000007300c1', 'retired');

-- Label adoption: the plant, its first check, the setup event and the adoption scan are written together ----------
create temp table lab as select public.srv_create_plant(tests.get_supabase_uid('aoife'), (select (r->>'householdId')::uuid from boot),
  '00000000-0000-0000-0000-0000007300c1', null, 'Lily', null, true, null, 'unknown', 'unknown', 'unknown', 'label_qr', 'CARE-0001', '2026-10-07', '2026-10-03T10:00:00Z') as id;
select is((select source from public.plants where id = (select id from lab)), 'label_qr', 'a label plant has source label_qr');
select is((select count(*)::int from public.qr_scans where code = 'CARE-0001' and event = 'adoption' and user_id = tests.get_supabase_uid('aoife')), 1, 'the adoption is recorded for that user');
select throws_ok($$select public.srv_create_plant(tests.get_supabase_uid('aoife'), (select (r->>'householdId')::uuid from boot), '00000000-0000-0000-0000-0000007300c1', null, 'X', null, true, null, 'unknown', 'unknown', 'unknown', 'label_qr', 'CARE-OLD1', '2026-10-07', now())$$,
  'P0404', null, 'a retired code cannot be adopted');
select throws_ok($$select public.srv_create_plant(tests.get_supabase_uid('aoife'), (select (r->>'householdId')::uuid from boot), '00000000-0000-0000-0000-0000007300c1', null, 'X', null, true, null, 'unknown', 'unknown', 'unknown', 'label_qr', 'NOPE-9999', '2026-10-07', now())$$,
  'P0404', null, 'an unknown code cannot be adopted');
select throws_ok($$select public.srv_create_plant(tests.get_supabase_uid('aoife'), (select (r->>'householdId')::uuid from boot), '00000000-0000-0000-0000-0000007300c2', null, 'X', null, true, null, 'unknown', 'unknown', 'unknown', 'label_qr', 'CARE-0001', '2026-10-07', now())$$,
  '22023', null, 'the species must be the code''s species');
select throws_ok($$select public.srv_create_plant(tests.get_supabase_uid('aoife'), (select (r->>'householdId')::uuid from boot), '00000000-0000-0000-0000-0000007300c1', null, 'X', null, true, null, 'unknown', 'unknown', 'unknown', 'label_qr', null, '2026-10-07', now())$$,
  '22023', null, 'a label plant needs a code');
select is((select count(*)::int from public.qr_scans where event = 'adoption'), 1, 'refused adoptions leave no scan');
select is((select count(*)::int from public.plants where nickname = 'X'), 0, 'refused adoptions leave no plant');

-- Status ---------------------------------------------------------------------------------------------------------
create temp table made as select public.srv_create_plant(tests.get_supabase_uid('aoife'), (select (r->>'householdId')::uuid from boot),
  '00000000-0000-0000-0000-0000007300c1', null, 'Fern', 'Bedroom', true, 14, 'plastic', 'yes', 'medium', 'manual', null, '2026-10-07', '2026-10-03T10:00:00Z') as id;
select public.srv_check_in(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007300e1', (select id from made), true, '{}', '2026-10-08T09:00:00Z', null, '2026-10-08', '2026-10-15', true);
select is((select count(*)::int from public.care_tasks where plant_id = (select id from made) and status = 'due'), 2, 'fixture: a water task and a check task are open');

create temp table dead as select public.srv_set_plant_status(tests.get_supabase_uid('aoife'), (select id from made), 'dead', 'Overwatered', '2026-10-09', '2026-10-09T10:00:00Z', 7) as r;
select is((select status from public.plants where id = (select id from made)), 'dead', 'the plant is dead');
select is((select death_cause from public.plants where id = (select id from made)), 'Overwatered', 'the cause is stored');
select is((select status_at from public.plants where id = (select id from made)), '2026-10-09T10:00:00Z'::timestamptz, 'status_at is the time given');
select is((select count(*)::int from public.care_tasks where plant_id = (select id from made) and status = 'due'), 0, 'closing leaves no open task');
select is((select count(*)::int from public.care_tasks where plant_id = (select id from made) and status = 'superseded'), 2, 'both open tasks are superseded');
select is((select count(*)::int from public.care_events where plant_id = (select id from made) and kind = 'status'), 1, 'a status event is recorded');
select is((select r->>'status' from dead), 'dead', 'the result carries the status');

-- dead -> alive restores the check at the last due date and clears the cause
create temp table back as select public.srv_set_plant_status(tests.get_supabase_uid('aoife'), (select id from made), 'alive', null, '2026-10-09', '2026-10-10T10:00:00Z', 7) as r;
select is((select status from public.plants where id = (select id from made)), 'alive', 'dead can go back to alive');
select is((select status_at from public.plants where id = (select id from made)), null, 'status_at is cleared');
select is((select death_cause from public.plants where id = (select id from made)), null, 'death_cause is cleared');
select is((select count(*)::int from public.care_tasks where plant_id = (select id from made) and status = 'due'), 1, 'exactly one task is open again');
select is((select due_on from public.care_tasks where plant_id = (select id from made) and status = 'due'), '2026-10-15'::date, 'it is the check due at the last next_check_on');
select is((select kind from public.care_tasks where plant_id = (select id from made) and status = 'due'), 'check', 'and it is a check, not a water task');
select is((select r->>'nextCheckOn' from back), '2026-10-15', 'the result says when the check is due');

-- given_away -> alive (the app's Undo), twice over, still one open task
select public.srv_set_plant_status(tests.get_supabase_uid('aoife'), (select id from made), 'given_away', 'ignored', '2026-10-11', '2026-10-11T10:00:00Z', 7);
select is((select death_cause from public.plants where id = (select id from made)), null, 'only a death carries a cause');
select is((select count(*)::int from public.care_tasks where plant_id = (select id from made) and status = 'due'), 0, 'given away closes the tasks');
select public.srv_set_plant_status(tests.get_supabase_uid('aoife'), (select id from made), 'alive', null, '2026-10-11', '2026-10-11T11:00:00Z', 7);
select is((select due_on from public.care_tasks where plant_id = (select id from made) and status = 'due'), '2026-10-15'::date, 'Undo restores the same due date');
select is((select count(*)::int from public.care_tasks where plant_id = (select id from made) and status = 'due'), 1, 'and only one task');

-- no history to restore from: today plus the base interval
create temp table bare as select public.srv_create_plant(tests.get_supabase_uid('aoife'), (select (r->>'householdId')::uuid from boot),
  '00000000-0000-0000-0000-0000007300c2', null, 'Bare', null, true, null, 'unknown', 'unknown', 'unknown', 'manual', null, '2026-10-07', '2026-10-03T10:00:00Z') as id;
delete from public.care_tasks where plant_id = (select id from bare);
select public.srv_set_plant_status(tests.get_supabase_uid('aoife'), (select id from bare), 'given_away', null, '2026-10-09', '2026-10-09T10:00:00Z', 4);
select public.srv_set_plant_status(tests.get_supabase_uid('aoife'), (select id from bare), 'alive', null, '2026-10-12', '2026-10-12T10:00:00Z', 4);
select is((select due_on from public.care_tasks where plant_id = (select id from bare) and status = 'due'), '2026-10-16'::date, 'with no last date the check is today plus the base interval');

-- a repeat of the current status changes nothing
select is((public.srv_set_plant_status(tests.get_supabase_uid('aoife'), (select id from bare), 'alive', null, '2026-10-12', '2026-10-12T12:00:00Z', 4))->>'status', 'alive', 'alive to alive reports alive');
select is((select count(*)::int from public.care_tasks where plant_id = (select id from bare) and status = 'due'), 1, 'and adds no task');
select is((select count(*)::int from public.care_events where plant_id = (select id from bare) and kind = 'status'), 2, 'and no event');

select throws_ok($$select public.srv_set_plant_status(tests.get_supabase_uid('outsider'), (select id from made), 'dead', null, current_date, now(), 7)$$, 'P0403', null, 'a non-member cannot change status');
select throws_ok($$select public.srv_set_plant_status(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-00000000dead', 'dead', null, current_date, now(), 7)$$, 'P0404', null, 'an unknown plant is not found');
select throws_ok($$select public.srv_set_plant_status(tests.get_supabase_uid('aoife'), (select id from made), 'sold', null, current_date, now(), 7)$$, '22023', null, 'an unknown status is refused');

-- Completing a water task ------------------------------------------------------------------------------------------
select public.srv_check_in(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007300e2', (select id from bare), true, '{}', '2026-10-13T09:00:00Z', null, '2026-10-13', '2026-10-20', true);
create temp table wt as select id from public.care_tasks where plant_id = (select id from bare) and kind = 'water' and status = 'due';
create temp table ct as select id from public.care_tasks where plant_id = (select id from bare) and kind = 'check' and status = 'due';
create temp table done1 as select public.srv_complete_task(tests.get_supabase_uid('partner'), (select id from wt), '00000000-0000-0000-0000-0000007300f1', '2026-10-13T11:00:00Z') as r;
select is((select status from public.care_tasks where id = (select id from wt)), 'done', 'the water task is done');
select is((select completed_by from public.care_tasks where id = (select id from wt)), tests.get_supabase_uid('partner'), 'by the member who did it');
select is((select count(*)::int from public.care_events where client_id = '00000000-0000-0000-0000-0000007300f1' and kind = 'water' and plant_id = (select id from bare)), 1, 'a water event is recorded');
select is((public.srv_complete_task(tests.get_supabase_uid('partner'), (select id from wt), '00000000-0000-0000-0000-0000007300f1', '2026-10-13T11:00:00Z'))->>'duplicate', 'true', 'a repeat is a duplicate');
select is((select count(*)::int from public.care_events where client_id = '00000000-0000-0000-0000-0000007300f1'), 1, 'a repeat stores one event');
select throws_ok($$select public.srv_complete_task(tests.get_supabase_uid('aoife'), (select id from wt), '00000000-0000-0000-0000-0000007300f1', now())$$, 'P0409', null, 'the client id of someone else''s completion is a conflict');
select throws_ok($$select public.srv_complete_task(tests.get_supabase_uid('aoife'), (select id from wt), '00000000-0000-0000-0000-0000007300f2', now())$$, 'P0409', null, 'a task already done is a conflict');
select throws_ok($$select public.srv_complete_task(tests.get_supabase_uid('aoife'), (select id from ct), '00000000-0000-0000-0000-0000007300f3', now())$$, 'P0409', null, 'a check task is completed by a check-in, not here');
select throws_ok($$select public.srv_complete_task(tests.get_supabase_uid('outsider'), (select id from ct), '00000000-0000-0000-0000-0000007300f4', now())$$, 'P0403', null, 'a non-member cannot complete a task');
select throws_ok($$select public.srv_complete_task(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-00000000dead', '00000000-0000-0000-0000-0000007300f5', now())$$, 'P0404', null, 'an unknown task is not found');
select is((select count(*)::int from public.care_events where client_id = '00000000-0000-0000-0000-0000007300f2'), 0, 'a refused completion leaves no event');

select * from finish();
rollback;
