begin;
select plan(18);

select tests.create_supabase_user('aoife');
select tests.create_supabase_user('siobhan');
select tests.create_supabase_user('outsider');

-- As the server would (functions run as service_role):
insert into public.profiles (id, handle, timezone, country_code, age_confirmed_13_plus)
values (tests.get_supabase_uid('aoife'), 'aoifegrows', 'Europe/Dublin', 'IE', true),
       (tests.get_supabase_uid('siobhan'), 'siobhanplants', 'Europe/Dublin', 'IE', true);
insert into public.households (id, name, created_by) values
  ('00000000-0000-0000-0000-0000000000a1', 'Our flat', tests.get_supabase_uid('aoife')),
  ('00000000-0000-0000-0000-0000000000a2', 'Mam''s house', tests.get_supabase_uid('siobhan'));
insert into public.household_members (household_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', tests.get_supabase_uid('aoife'), 'owner'),
  ('00000000-0000-0000-0000-0000000000a2', tests.get_supabase_uid('siobhan'), 'owner'),
  ('00000000-0000-0000-0000-0000000000a2', tests.get_supabase_uid('aoife'), 'member');
insert into public.household_pets (household_id, animal, name) values
  ('00000000-0000-0000-0000-0000000000a1', 'cat', 'Miso'),
  ('00000000-0000-0000-0000-0000000000a1', 'dog', 'Bran'),
  ('00000000-0000-0000-0000-0000000000a2', 'other', null);
insert into public.privacy_zones (user_id, center, radius_m)
values (tests.get_supabase_uid('aoife'), extensions.st_geogfromtext('POINT(-6.26 53.35)'), 2000);

select tests.rls_enabled('public');

select tests.authenticate_as('aoife');
select results_eq('select handle::text from public.profiles', $$values ('aoifegrows')$$, 'sees only own profile');
select results_eq('select count(*)::int from public.households', $$values (2)$$, 'member of two households sees both');
select results_eq('select count(*)::int from public.household_pets', $$values (3)$$, 'sees pets of both households');
select results_eq('select count(*)::int from public.privacy_zones', $$values (1)$$, 'sees own privacy zone');
select throws_ok($$insert into public.household_pets (household_id, animal) values ('00000000-0000-0000-0000-0000000000a1', 'cat')$$, '42501', null, 'cannot insert pets directly');
select throws_ok($$update public.profiles set handle = 'hacker'$$, '42501', null, 'cannot update profile directly');
select throws_ok($$delete from public.household_members$$, '42501', null, 'cannot delete memberships directly');

select tests.authenticate_as('outsider');
select is_empty('select * from public.households', 'outsider sees no households');
select is_empty('select * from public.household_pets', 'outsider sees no pets');
select is_empty('select * from public.privacy_zones', 'outsider sees no privacy zones');
select is_empty('select * from public.profiles', 'outsider sees no other profiles');

select tests.clear_authentication();
set local role anon;
select throws_ok('select * from public.profiles', '42501', null, 'anon has no grant on profiles');
select throws_ok('select * from public.privacy_zones', '42501', null, 'anon has no grant on privacy zones');
reset role;

-- Leaving a household removes access immediately
delete from public.household_members where household_id = '00000000-0000-0000-0000-0000000000a2' and user_id = tests.get_supabase_uid('aoife');
select tests.authenticate_as('aoife');
select results_eq('select count(*)::int from public.households', $$values (1)$$, 'after leaving, only own household');

select tests.clear_authentication();
select col_is_unique('public', 'profiles', 'handle', 'handles are unique');

-- private.is_admin() trusts only app_metadata.role (server-controlled), never user_metadata.role
-- (user-editable). Mirrors the claims shape set by tests.authenticate_as.
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', json_build_object(
  'sub', tests.get_supabase_uid('aoife'),
  'role', 'authenticated',
  'app_metadata', json_build_object('role', 'admin')
)::text, true);
select is((select private.is_admin()), true, 'app_metadata.role = admin is an admin');

select set_config('request.jwt.claims', json_build_object(
  'sub', tests.get_supabase_uid('aoife'),
  'role', 'authenticated',
  'user_metadata', json_build_object('role', 'admin')
)::text, true);
select is((select private.is_admin()), false, 'user_metadata.role = admin is not an admin');
reset role;

select * from finish();
rollback;
