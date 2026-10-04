begin;
select plan(28);
select tests.create_supabase_user('aoife');
select tests.create_supabase_user('partner');
select tests.create_supabase_user('outsider');
create temp table boot as select public.srv_bootstrap(tests.get_supabase_uid('aoife'), 'aoifegrows', 'Aoife', 'Europe/Dublin', 'IE') as r;
select public.srv_bootstrap(tests.get_supabase_uid('partner'), 'partnergrows', null, 'UTC', 'IE');

-- A species with a family is not sensitive; one without a family is (the provider often omits it).
insert into public.species (id, scientific_name, common_name, slug, family, is_houseplant) values
  ('00000000-0000-0000-0000-0000007200c1', 'Cnftest plantae', 'Cnf test plant', 'cnf-test-plant', 'Testaceae', true),
  ('00000000-0000-0000-0000-0000007200c2', 'Cnftest alba', 'Cnf test wild', 'cnf-test-wild', 'Testaceae', false);
insert into public.species (id, scientific_name, common_name, slug, is_houseplant) values
  ('00000000-0000-0000-0000-0000007200c3', 'Cnftest occulta', 'Cnf test hidden', 'cnf-test-hidden', false);
select is((select sensitive from public.species where id = '00000000-0000-0000-0000-0000007200c3'), true, 'fixture: a species with no family is sensitive');

-- Observations 1..9, all identified with two suggestions (c1 on top, c2 second); b3 suggests the sensitive c3.
insert into public.observations (id, user_id, device_time, capture_source, status, suggestions)
select ('00000000-0000-0000-0000-0000007200b' || n)::uuid, tests.get_supabase_uid('aoife'), now(), 'camera', 'identified',
  '[{"speciesId":"00000000-0000-0000-0000-0000007200c1","probability":0.94,"providerEntityId":"e1"},
    {"speciesId":"00000000-0000-0000-0000-0000007200c2","probability":0.04,"providerEntityId":"e2"},
    {"speciesId":"00000000-0000-0000-0000-0000007200c3","probability":0.01,"providerEntityId":"e3"}]'::jsonb
from generate_series(1, 9) n;
-- Every observation sits at the same Dublin point except where noted; b9 is far from the zone.
insert into public.observation_locations (observation_id, user_id, point, cell_r5)
select o.id, o.user_id, extensions.st_geogfromtext(case when o.id = '00000000-0000-0000-0000-0000007200b9' then 'POINT(-6.26 53.55)' else 'POINT(-6.26 53.35)' end), 599686042433355775
from public.observations o;
-- aoife's zone covers b1..b8's point but not b9's. Observations b4..b8 are in the zone, so only b9 may ever get a cell.
insert into public.privacy_zones (user_id, center, radius_m)
values (tests.get_supabase_uid('aoife'), extensions.st_geogfromtext('POINT(-6.26 53.35)'), 1000);

create temp table setup as select '{"nickname":"Lily","room":"Bedroom","light":"medium","potMaterial":"plastic","potSizeCm":14,"drainage":"yes","indoor":true}'::jsonb as s;

-- Refusals -------------------------------------------------------------------------------------------------------
select throws_ok($$select public.srv_confirm_observation(tests.get_supabase_uid('partner'), '00000000-0000-0000-0000-0000007200b1', '00000000-0000-0000-0000-0000007200c1', 'log_find', 'wild', null, null, '2026-10-07', now())$$,
  'P0404', null, 'another user gets not found');
select throws_ok($$select public.srv_confirm_observation(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007200b1', '00000000-0000-0000-0000-0000007200c9', 'log_find', 'wild', null, null, '2026-10-07', now())$$,
  '22023', null, 'a species outside the suggestions is refused');
select throws_ok($$select public.srv_confirm_observation(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007200b1', '00000000-0000-0000-0000-0000007200c1', 'log_find', null, null, null, '2026-10-07', now())$$,
  '22023', null, 'a find without a place is refused');
select throws_ok($$select public.srv_confirm_observation(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007200b1', '00000000-0000-0000-0000-0000007200c1', 'add_plant', null, '00000000-0000-0000-0000-0000007200ff', (select s from setup), '2026-10-07', now())$$,
  'P0403', null, 'a household you are not in is refused');
select is((select status from public.observations where id = '00000000-0000-0000-0000-0000007200b1'), 'identified', 'refusals leave the observation identified');
update public.observations set status = 'failed' where id = '00000000-0000-0000-0000-0000007200b2';
select throws_ok($$select public.srv_confirm_observation(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007200b2', '00000000-0000-0000-0000-0000007200c1', 'log_find', 'wild', null, null, '2026-10-07', now())$$,
  'P0409', null, 'a non-identified observation is refused');

-- add_plant: plant, first check, setup event, link, Plantdex -----------------------------------------------------
create temp table c1 as select public.srv_confirm_observation(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007200b1', '00000000-0000-0000-0000-0000007200c1', 'add_plant', null, null, (select s from setup), '2026-10-07', '2026-10-03T10:00:00Z') as r;
select is((select r->>'duplicate' from c1), 'false', 'first confirm is not a duplicate');
select is((select r->>'newToPlantdex' from c1), 'true', 'first find is new to the Plantdex');
select is((select r->>'feedbackEntityId' from c1), null, 'the top suggestion needs no feedback');
select is((select plant_id from public.observations where id = '00000000-0000-0000-0000-0000007200b1'), (select (r->>'plantId')::uuid from c1), 'the plant is linked to the observation');
select is((select count(*)::int from public.care_tasks where plant_id = (select (r->>'plantId')::uuid from c1) and kind = 'check' and due_on = '2026-10-07'), 1, 'the first check task exists');
select is((select count(*)::int from public.care_events where plant_id = (select (r->>'plantId')::uuid from c1) and kind = 'setup'), 1, 'the setup event exists');
select is((select source from public.plants where observation_id = '00000000-0000-0000-0000-0000007200b1'), 'scan', 'the plant source is scan');
select is((select place_type from public.observations where id = '00000000-0000-0000-0000-0000007200b1'), 'home', 'add_plant is a home observation');
select is((select confidence from public.observations where id = '00000000-0000-0000-0000-0000007200b1'), 0.9400, 'confidence is the chosen suggestion probability');
select is((select public_cell_r5 from public.observations where id = '00000000-0000-0000-0000-0000007200b1'), null, 'a home observation never gets a public cell');

-- Replay ---------------------------------------------------------------------------------------------------------
select is((select (public.srv_confirm_observation(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007200b1', '00000000-0000-0000-0000-0000007200c1', 'add_plant', null, null, (select s from setup), '2026-10-07', now()))->>'plantId'),
  (select r->>'plantId' from c1), 'a replay returns the same plant');
select is((select finds_count from public.plantdex_entries where user_id = tests.get_supabase_uid('aoife') and species_id = '00000000-0000-0000-0000-0000007200c1'), 1, 'a replay does not add a find');
select is((select count(*)::int from public.plants where observation_id = '00000000-0000-0000-0000-0000007200b1'), 1, 'a replay does not add a plant');
select throws_ok($$select public.srv_confirm_observation(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007200b1', '00000000-0000-0000-0000-0000007200c2', 'add_plant', null, null, (select s from setup), '2026-10-07', now())$$,
  'P0409', null, 'a replay with a different species is refused');
select throws_ok($$insert into public.plants (household_id, species_id, observation_id, nickname, source) values ((select (r->>'householdId')::uuid from boot), '00000000-0000-0000-0000-0000007200c1', '00000000-0000-0000-0000-0000007200b1', 'Twin', 'scan')$$,
  '23505', null, 'a second plant for one observation is refused by the database');

-- Public cell ------------------------------------------------------------------------------------------------------
select public.srv_confirm_observation(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007200b3', '00000000-0000-0000-0000-0000007200c3', 'log_find', 'wild', null, null, '2026-10-07', now());
select is((select public_cell_r5 from public.observations where id = '00000000-0000-0000-0000-0000007200b3'), null, 'a sensitive species gets no cell even outside the zone');
select public.srv_confirm_observation(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007200b4', '00000000-0000-0000-0000-0000007200c2', 'log_find', 'wild', null, null, '2026-10-07', now());
select is((select public_cell_r5 from public.observations where id = '00000000-0000-0000-0000-0000007200b4'), null, 'a point inside the privacy zone gets no cell');
select public.srv_confirm_observation(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007200b9', '00000000-0000-0000-0000-0000007200c2', 'log_find', 'wild', null, null, '2026-10-07', now());
select is((select public_cell_r5 from public.observations where id = '00000000-0000-0000-0000-0000007200b9'), 599686042433355775::bigint, 'a wild find outside the zone gets the cell');
select public.srv_confirm_observation(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007200b8', '00000000-0000-0000-0000-0000007200c2', 'log_find', 'garden_park', null, null, '2026-10-07', now());
delete from public.privacy_zones;
update public.observation_locations set point = extensions.st_geogfromtext('POINT(-6.26 53.55)') where observation_id in ('00000000-0000-0000-0000-0000007200b5', '00000000-0000-0000-0000-0000007200b6');
select public.srv_confirm_observation(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007200b5', '00000000-0000-0000-0000-0000007200c2', 'log_find', 'garden_park', null, null, '2026-10-07', now());
select public.srv_confirm_observation(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007200b6', '00000000-0000-0000-0000-0000007200c2', 'log_find', 'home', null, null, '2026-10-07', now());
select is((select array_agg(public_cell_r5) from public.observations where id in ('00000000-0000-0000-0000-0000007200b5', '00000000-0000-0000-0000-0000007200b6')), array[null, null]::bigint[], 'garden and home finds get no cell, even with no zone set');

-- Second find of the same species, and feedback ----------------------------------------------------------------------
create temp table c7 as select public.srv_confirm_observation(tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-0000007200b7', '00000000-0000-0000-0000-0000007200c2', 'log_find', 'wild', null, null, '2026-10-07', now()) as r;
select is((select r->>'feedbackEntityId' from c7), 'e2', 'choosing a lower suggestion names its provider entity');
select is((select (r->>'newToPlantdex')::boolean from c7), false, 'a repeat find is not new');

select * from finish();
rollback;
