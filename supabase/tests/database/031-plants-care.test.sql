begin;
select plan(8);
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
insert into public.care_tasks (plant_id, household_id, kind, due_on, status)
values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1', 'check', current_date, 'due');
insert into public.care_events (plant_id, household_id, user_id, kind, soil_dry, client_id, occurred_at)
values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1', tests.get_supabase_uid('aoife'), 'checkin', false, '00000000-0000-0000-0000-00000000e001', now());

select tests.authenticate_as('partner');
select results_eq('select nickname from public.plants', $$values ('Monty')$$, 'household member sees the plant');
select results_eq('select count(*)::int from public.care_tasks', $$values (1)$$, 'household member sees tasks');
select results_eq('select count(*)::int from public.care_events', $$values (1)$$, 'household member sees events');
select throws_ok($$update public.plants set nickname = 'X'$$, '42501', null, 'clients cannot edit plants directly');
select throws_ok($$insert into public.care_events (plant_id, household_id, kind, occurred_at) values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1', 'checkin', now())$$, '42501', null, 'clients cannot write events directly');

select tests.authenticate_as('outsider');
select is_empty('select * from public.plants', 'outsiders see no plants');
select is_empty('select * from public.care_tasks', 'outsiders see no tasks');

select tests.clear_authentication();
-- clear_authentication leaves the role as anon; the duplicate insert has to run as the migration owner.
reset role;
select throws_ok($$insert into public.care_events (plant_id, household_id, kind, client_id, occurred_at) values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1', 'checkin', '00000000-0000-0000-0000-00000000e001', now())$$, '23505', null, 'client_id makes check-ins idempotent');
select * from finish();
rollback;
