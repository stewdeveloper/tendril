begin;
select plan(10);
select tests.create_supabase_user('aoife');
select tests.create_supabase_user('outsider');
insert into public.observations (id, user_id, device_time, capture_source)
values ('00000000-0000-0000-0000-00000000b001', tests.get_supabase_uid('aoife'), now(), 'camera');
insert into public.observation_locations (observation_id, user_id, point, accuracy_m)
values ('00000000-0000-0000-0000-00000000b001', tests.get_supabase_uid('aoife'), extensions.st_geogfromtext('POINT(-6.26 53.35)'), 8);
insert into public.observation_photos (observation_id, user_id, storage_path, organ, sha256)
values ('00000000-0000-0000-0000-00000000b001', tests.get_supabase_uid('aoife'),
  tests.get_supabase_uid('aoife')::text || '/00000000-0000-0000-0000-00000000b001/1.jpg', 'leaf', 'abc');

select tests.authenticate_as('aoife');
select results_eq('select count(*)::int from public.observations', $$values (1)$$, 'owner sees own observation');
select results_eq('select count(*)::int from public.observation_locations', $$values (1)$$, 'owner sees own precise point');
select throws_ok($$insert into public.observations (user_id, device_time, capture_source) values ((select auth.uid()), now(), 'camera')$$, '42501', null, 'clients cannot create observations');
select throws_ok($$update public.observations set points_status = 'awarded'$$, '42501', null, 'clients cannot award themselves points');
select throws_ok('select * from private.observation_provider', '42501', null, 'clients cannot read provider tokens');

select tests.authenticate_as('outsider');
select is_empty('select * from public.observations', 'others cannot see the observation');
select is_empty('select * from public.observation_locations', 'others never see precise points');
select is_empty('select * from public.observation_photos', 'others cannot see photo rows');

select tests.clear_authentication();
set local role anon;
select throws_ok('select * from public.observation_locations', '42501', null, 'anon has no grant on precise points');
reset role;

select is(
  (select count(*)::int from storage.buckets where id = 'plant-photos' and public = false),
  1, 'plant-photos bucket exists and is private');
select * from finish();
rollback;
