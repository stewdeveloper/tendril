begin;
select plan(15);
-- supabase/seed.sql loads a real catalogue, and this test inserts its own species with the same slugs and names. Clear the
-- seeded reference data inside the transaction; the rollback at the end puts it back.
delete from public.qr_codes;
delete from public.species;
-- The other policy tests lean on "others see nothing". These are the positive halves: the people who should see rows
-- do, and the plant-photos bucket policies let a user into their own folder and nobody else's.
select tests.create_supabase_user('aoife');
select tests.create_supabase_user('partner');
select tests.create_supabase_user('outsider');

insert into public.households (id, name) values ('00000000-0000-0000-0000-0000000000a1', 'Our flat');
insert into public.household_members (household_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', tests.get_supabase_uid('aoife'), 'owner'),
  ('00000000-0000-0000-0000-0000000000a1', tests.get_supabase_uid('partner'), 'member');
insert into public.species (id, scientific_name, common_name, slug)
values ('00000000-0000-0000-0000-00000000c001', 'Monstera deliciosa', 'Swiss cheese plant', 'swiss-cheese-plant');
insert into public.plants (id, household_id, species_id, nickname, room, source)
values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000c001', 'Monty', 'Living room', 'scan');
insert into public.care_events (plant_id, household_id, user_id, kind, soil_dry, client_id, occurred_at)
values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1', tests.get_supabase_uid('aoife'), 'checkin', false, '00000000-0000-0000-0000-00000000e001', now());
insert into public.diagnoses (plant_id, user_id, condition_name, probability)
values ('00000000-0000-0000-0000-00000000d001', tests.get_supabase_uid('aoife'), 'Overwatering', 0.8);

-- Two users' photo rows, so "sees its own" cannot pass by seeing everything.
insert into public.observations (id, user_id, device_time, capture_source) values
  ('00000000-0000-0000-0000-00000000b001', tests.get_supabase_uid('aoife'), now(), 'camera'),
  ('00000000-0000-0000-0000-00000000b002', tests.get_supabase_uid('outsider'), now(), 'camera');
insert into public.observation_photos (observation_id, user_id, storage_path, sha256) values
  ('00000000-0000-0000-0000-00000000b001', tests.get_supabase_uid('aoife'), tests.get_supabase_uid('aoife')::text || '/b001/1.jpg', 'h1'),
  ('00000000-0000-0000-0000-00000000b002', tests.get_supabase_uid('outsider'), tests.get_supabase_uid('outsider')::text || '/b002/1.jpg', 'h2');

-- The other user's stored photo, put there as the migration owner (clients may only write their own folder).
insert into storage.objects (bucket_id, name, owner_id)
values ('plant-photos', tests.get_supabase_uid('outsider')::text || '/theirs.jpg', tests.get_supabase_uid('outsider')::text);
select isnt_empty(
  $$select 1 from storage.objects where bucket_id = 'plant-photos' and name = tests.get_supabase_uid('outsider')::text || '/theirs.jpg'$$,
  'the other user''s object exists, so the invisibility check below is not vacuous');

-- storage.objects serves every bucket, so its policies are named for the bucket they guard.
select is(
  (select string_agg(policyname || ':' || cmd, ',' order by policyname) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'plant-photos: %'),
  'plant-photos: own folder read:SELECT,plant-photos: own folder upload:INSERT',
  'the plant-photos policies carry the bucket prefix and allow only read and upload');
select is_empty(
  $$select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'own folder %'$$,
  'no unprefixed plant-photos policy is left behind');

select tests.authenticate_as('aoife');
select results_eq(
  'select storage_path from public.observation_photos',
  $$select tests.get_supabase_uid('aoife')::text || '/b001/1.jpg'$$,
  'owner sees exactly their own photo rows');
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('plant-photos', (select auth.uid())::text || '/x.jpg', (select auth.uid())::text)$$,
  'a user can upload into their own folder of plant-photos');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('plant-photos', tests.get_supabase_uid('outsider')::text || '/x.jpg', (select auth.uid())::text)$$,
  '42501', null, 'a user cannot upload into someone else''s folder');
select isnt_empty(
  $$select 1 from storage.objects where bucket_id = 'plant-photos' and name = (select auth.uid())::text || '/x.jpg'$$,
  'a user can read their own object');
select is_empty(
  $$select 1 from storage.objects where bucket_id = 'plant-photos' and name = tests.get_supabase_uid('outsider')::text || '/theirs.jpg'$$,
  'a user cannot see another user''s object');

-- storage.protect_delete refuses direct deletes unless this is set (the Storage API sets it); it is a guard against
-- orphaned files, separate from the row level security under test here.
set local storage.allow_delete_query = 'true';
-- There is no delete policy (spec section 7: the only client write is upload), so a client cannot swap evidence.
select lives_ok(
  $$delete from storage.objects where bucket_id = 'plant-photos' and name = (select auth.uid())::text || '/x.jpg'$$,
  'a client delete of its own object is filtered out, not an error');
select isnt_empty(
  $$select 1 from storage.objects where bucket_id = 'plant-photos' and name = (select auth.uid())::text || '/x.jpg'$$,
  'the client''s own object is still there after its delete attempt');
select tests.clear_authentication();
reset role;
select isnt_empty(
  $$select 1 from storage.objects where bucket_id = 'plant-photos' and name = tests.get_supabase_uid('aoife')::text || '/x.jpg'$$,
  'the object still exists as postgres');
select tests.authenticate_as('aoife');
-- RLS filters rather than rejects: the delete runs and touches nothing.
select lives_ok(
  $$delete from storage.objects where bucket_id = 'plant-photos' and name = tests.get_supabase_uid('outsider')::text || '/theirs.jpg'$$,
  'deleting another user''s object is filtered out, not an error');
select tests.clear_authentication();
reset role;
select isnt_empty(
  $$select 1 from storage.objects where bucket_id = 'plant-photos' and name = tests.get_supabase_uid('outsider')::text || '/theirs.jpg'$$,
  'another user''s object survives the attempted delete');

select tests.authenticate_as('partner');
select results_eq(
  'select condition_name from public.diagnoses',
  $$values ('Overwatering')$$,
  'a household member sees diagnoses for a household plant');

select tests.authenticate_as('outsider');
select is_empty('select * from public.care_events', 'an outsider sees no care events');
select * from finish();
rollback;
