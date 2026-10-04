begin;
select plan(8);
select tests.create_supabase_user('aoife');
select tests.create_supabase_user('bea');
insert into public.species (id, scientific_name, common_name, slug)
values ('00000000-0000-0000-0000-00000000c0f1', 'Zz testus', 'Test plant', 'zz-testus');

-- species_toxicity
select throws_ok(
  $$insert into public.species_toxicity (species_id, animal, severity, review_status) values ('00000000-0000-0000-0000-00000000c0f1', 'cat', 'mild', 'reviewed')$$,
  '23514', null, 'a reviewed row needs a reviewer and a review time');
select throws_ok(
  $$insert into public.species_toxicity (species_id, animal, severity, source_name, source_url) values ('00000000-0000-0000-0000-00000000c0f1', 'cat', 'none', '   ', 'https://example.org/x')$$,
  '23514', null, 'no known toxicity rejects a blank source name');
select lives_ok(
  $$insert into public.species_toxicity (species_id, animal, severity, review_status, reviewed_by, reviewed_at) values ('00000000-0000-0000-0000-00000000c0f1', 'cat', 'mild', 'reviewed', 'Dr Vet', now())$$,
  'a fully reviewed row is accepted');

-- push tokens
insert into public.push_tokens (user_id, token, platform) values (tests.get_supabase_uid('aoife'), 'tok-1', 'ios');
select throws_ok(
  $$insert into public.push_tokens (user_id, token, platform) values (tests.get_supabase_uid('bea'), 'tok-1', 'ios')$$,
  '23505', null, 'the same push token cannot belong to two users');

-- value checks
select throws_ok(
  $$insert into public.observations (user_id, device_time, capture_source, organs) values (tests.get_supabase_uid('aoife'), now(), 'camera', array['leaf', 'root'])$$,
  '23514', null, 'an unknown organ is rejected');
select lives_ok(
  $$insert into public.observations (user_id, device_time, capture_source, organs) values (tests.get_supabase_uid('aoife'), now(), 'camera', array['leaf', 'flower', 'whole'])$$,
  'known organs are accepted');
insert into public.households (id, name) values ('00000000-0000-0000-0000-0000000000a1', 'Flat');
insert into public.plants (id, household_id, species_id, nickname, source)
values ('00000000-0000-0000-0000-00000000d0f1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000c0f1', 'P', 'manual');
select throws_ok(
  $$insert into public.care_events (plant_id, household_id, kind, leaf_states, occurred_at) values ('00000000-0000-0000-0000-00000000d0f1', '00000000-0000-0000-0000-0000000000a1', 'checkin', array['crispy'], now())$$,
  '23514', null, 'an unknown leaf state is rejected');
select lives_ok(
  $$insert into public.care_events (plant_id, household_id, kind, leaf_states, occurred_at) values ('00000000-0000-0000-0000-00000000d0f1', '00000000-0000-0000-0000-0000000000a1', 'checkin', array['healthy', 'brown_tips'], now())$$,
  'known leaf states are accepted');
select * from finish();
rollback;
