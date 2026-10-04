begin;
select plan(20);
-- Outsider matrix: user A has a row in every user- or household-scoped public table, user B (own household, no
-- relationship to A) must see none of them. A positive control shows A sees the same rows, so the checks are not vacuous.
select tests.create_supabase_user('a');
select tests.create_supabase_user('b');

insert into public.profiles (id, handle) values (tests.get_supabase_uid('a'), 'usera1') on conflict (id) do nothing;
insert into public.profiles (id, handle) values (tests.get_supabase_uid('b'), 'userb1') on conflict (id) do nothing;
insert into public.households (id, name) values
  ('00000000-0000-0000-0000-0000000000a1', 'A flat'), ('00000000-0000-0000-0000-0000000000b1', 'B flat');
insert into public.household_members (household_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', tests.get_supabase_uid('a'), 'owner'),
  ('00000000-0000-0000-0000-0000000000b1', tests.get_supabase_uid('b'), 'owner');
insert into public.privacy_zones (user_id, center, radius_m)
values (tests.get_supabase_uid('a'), extensions.st_geogfromtext('POINT(0 0)'), 1000);
insert into public.household_pets (household_id, animal, name) values ('00000000-0000-0000-0000-0000000000a1', 'cat', 'Tom');
insert into public.household_vets (household_id, name, phone) values ('00000000-0000-0000-0000-0000000000a1', 'Dublin Vets', '01 234 5678');
insert into public.push_tokens (user_id, token, platform) values (tests.get_supabase_uid('a'), 'tok-a', 'ios');
insert into public.observations (id, user_id, household_id, device_time, capture_source)
values ('00000000-0000-0000-0000-00000000b0a1', tests.get_supabase_uid('a'), '00000000-0000-0000-0000-0000000000a1', now(), 'camera');
insert into public.observation_locations (observation_id, user_id, point)
values ('00000000-0000-0000-0000-00000000b0a1', tests.get_supabase_uid('a'), extensions.st_geogfromtext('POINT(0 0)'));
insert into public.observation_photos (observation_id, user_id, storage_path, sha256)
values ('00000000-0000-0000-0000-00000000b0a1', tests.get_supabase_uid('a'), tests.get_supabase_uid('a')::text || '/b0a1/1.jpg', 'h');
insert into public.plants (id, household_id, species_id, nickname, source)
values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1', (select id from public.species where slug = 'peace-lily'), 'Lily', 'scan');
insert into public.care_tasks (plant_id, household_id, kind, due_on)
values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1', 'check', current_date);
insert into public.care_events (plant_id, household_id, user_id, kind, occurred_at)
values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1', tests.get_supabase_uid('a'), 'checkin', now());
insert into public.diagnoses (plant_id, user_id, condition_name, probability)
values ('00000000-0000-0000-0000-00000000d001', tests.get_supabase_uid('a'), 'Overwatering', 0.8);
insert into public.plantdex_entries (user_id, species_id, category, first_found_at)
values (tests.get_supabase_uid('a'), (select id from public.species where slug = 'peace-lily'), 'houseplant', now());
insert into public.entitlements (user_id, source, active_until) values (tests.get_supabase_uid('a'), 'preview', now() + interval '1 day');
insert into public.usage_counters (user_id, kind, period_key, used) values (tests.get_supabase_uid('a'), 'identification', '2026-10', 1);

select tests.authenticate_as('a');
select is((select count(*)::int from (
  select 1 from public.profiles where id = tests.get_supabase_uid('a')
  union all
  select 1 from public.privacy_zones where user_id = tests.get_supabase_uid('a')
  union all
  select 1 from public.households where id = '00000000-0000-0000-0000-0000000000a1'
  union all
  select 1 from public.household_members where household_id = '00000000-0000-0000-0000-0000000000a1'
  union all
  select 1 from public.household_pets where household_id = '00000000-0000-0000-0000-0000000000a1'
  union all
  select 1 from public.household_vets where household_id = '00000000-0000-0000-0000-0000000000a1'
  union all
  select 1 from public.push_tokens where user_id = tests.get_supabase_uid('a')
  union all
  select 1 from public.observations where user_id = tests.get_supabase_uid('a')
  union all
  select 1 from public.observation_locations where user_id = tests.get_supabase_uid('a')
  union all
  select 1 from public.observation_photos where user_id = tests.get_supabase_uid('a')
  union all
  select 1 from public.plants where household_id = '00000000-0000-0000-0000-0000000000a1'
  union all
  select 1 from public.care_tasks where household_id = '00000000-0000-0000-0000-0000000000a1'
  union all
  select 1 from public.care_events where household_id = '00000000-0000-0000-0000-0000000000a1'
  union all
  select 1 from public.diagnoses where plant_id = '00000000-0000-0000-0000-00000000d001'
  union all
  select 1 from public.plantdex_entries where user_id = tests.get_supabase_uid('a')
  union all
  select 1 from public.entitlements where user_id = tests.get_supabase_uid('a')
  union all
  select 1 from public.usage_counters where user_id = tests.get_supabase_uid('a')
) x), 17, 'the owner sees a row in every one of the 17 tables');
select tests.authenticate_as('b');
select is_empty($$select 1 from public.profiles where id = tests.get_supabase_uid('a')$$, 'an outsider sees none of A''s profiles');
select is_empty($$select 1 from public.privacy_zones where user_id = tests.get_supabase_uid('a')$$, 'an outsider sees none of A''s privacy_zones');
select is_empty($$select 1 from public.households where id = '00000000-0000-0000-0000-0000000000a1'$$, 'an outsider sees none of A''s households');
select is_empty($$select 1 from public.household_members where household_id = '00000000-0000-0000-0000-0000000000a1'$$, 'an outsider sees none of A''s household_members');
select is_empty($$select 1 from public.household_pets where household_id = '00000000-0000-0000-0000-0000000000a1'$$, 'an outsider sees none of A''s household_pets');
select is_empty($$select 1 from public.household_vets where household_id = '00000000-0000-0000-0000-0000000000a1'$$, 'an outsider sees none of A''s household_vets');
select is_empty($$select 1 from public.push_tokens where user_id = tests.get_supabase_uid('a')$$, 'an outsider sees none of A''s push_tokens');
select is_empty($$select 1 from public.observations where user_id = tests.get_supabase_uid('a')$$, 'an outsider sees none of A''s observations');
select is_empty($$select 1 from public.observation_locations where user_id = tests.get_supabase_uid('a')$$, 'an outsider sees none of A''s observation_locations');
select is_empty($$select 1 from public.observation_photos where user_id = tests.get_supabase_uid('a')$$, 'an outsider sees none of A''s observation_photos');
select is_empty($$select 1 from public.plants where household_id = '00000000-0000-0000-0000-0000000000a1'$$, 'an outsider sees none of A''s plants');
select is_empty($$select 1 from public.care_tasks where household_id = '00000000-0000-0000-0000-0000000000a1'$$, 'an outsider sees none of A''s care_tasks');
select is_empty($$select 1 from public.care_events where household_id = '00000000-0000-0000-0000-0000000000a1'$$, 'an outsider sees none of A''s care_events');
select is_empty($$select 1 from public.diagnoses where plant_id = '00000000-0000-0000-0000-00000000d001'$$, 'an outsider sees none of A''s diagnoses');
select is_empty($$select 1 from public.plantdex_entries where user_id = tests.get_supabase_uid('a')$$, 'an outsider sees none of A''s plantdex_entries');
select is_empty($$select 1 from public.entitlements where user_id = tests.get_supabase_uid('a')$$, 'an outsider sees none of A''s entitlements');
select is_empty($$select 1 from public.usage_counters where user_id = tests.get_supabase_uid('a')$$, 'an outsider sees none of A''s usage_counters');

-- Everything B can read at all is accounted for: B sees only B's own household and membership rows.
select is((select count(*)::int from public.households), 1, 'an outsider sees only their own household');
select is((select count(*)::int from public.household_members), 1, 'an outsider sees only their own membership');
select * from finish();
rollback;
