begin;
select plan(10);

select tests.create_supabase_user('aoife');

-- Handles are lowercase only. The column is citext, whose ~ operator is case-insensitive, so the check
-- has to compare as text.
select throws_ok(
  $$insert into public.profiles (id, handle) values (tests.get_supabase_uid('aoife'), 'AoifeGrows')$$,
  '23514', null, 'mixed-case handles are rejected');
select lives_ok(
  $$insert into public.profiles (id, handle) values (tests.get_supabase_uid('aoife'), 'aoifegrows')$$,
  'lowercase handles are accepted');

-- Catalog-driven grants audit: what can the client roles actually do to relations in public? Uses
-- has_*_privilege, which sees direct grants, PUBLIC grants and column-level grants alike.
create temp table held_privs on commit drop as
with roles(role_name) as (values ('anon'), ('authenticated')),
rels as (
  select c.oid, c.relname::text as relname, c.relkind
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
)
select role_name, relname, priv from roles, rels, (values ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')) as p(priv)
  where rels.relkind <> 'S' and has_any_column_privilege(role_name, rels.oid, priv)
union all
select role_name, relname, priv from roles, rels, (values ('DELETE'), ('TRUNCATE'), ('TRIGGER')) as p(priv)
  where rels.relkind <> 'S' and has_table_privilege(role_name, rels.oid, priv)
union all
select role_name, relname, priv from roles, rels, (values ('USAGE'), ('SELECT'), ('UPDATE')) as p(priv)
  where rels.relkind = 'S' and has_sequence_privilege(role_name, rels.oid, priv);

select isnt_empty(
  $$select 1 from held_privs where role_name = 'authenticated' and relname = 'profiles' and priv = 'SELECT'$$,
  'the audit can see the grants it is meant to police');
select is_empty(
  $$select * from held_privs where role_name = 'anon' and not (relname in ('species', 'species_toxicity') and priv = 'SELECT')$$,
  'anon holds nothing in public except select on the species catalogue');
select is_empty(
  $$select * from held_privs where role_name = 'authenticated' and priv <> 'SELECT'$$,
  'authenticated holds nothing in public but select');

-- Default privileges: new objects start closed to clients.
create table public.zz_tmp (id int);
create sequence public.zz_seq;
create function public.zz_fn() returns int language sql as $$ select 1 $$;
select is(
  (select count(*)::int from pg_class c, (values ('anon'), ('authenticated')) as r(role_name),
     (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as p(priv)
   where c.oid = 'public.zz_tmp'::regclass and has_table_privilege(r.role_name, c.oid, p.priv)),
  0, 'a new table grants clients nothing');
select is(
  (select count(*)::int from (values ('anon'), ('authenticated')) as r(role_name),
     (values ('USAGE'), ('SELECT'), ('UPDATE')) as p(priv)
   where has_sequence_privilege(r.role_name, 'public.zz_seq', p.priv)),
  0, 'a new sequence grants clients nothing');
select is(
  (select count(*)::int from (values ('anon'), ('authenticated')) as r(role_name)
   where has_function_privilege(r.role_name, 'public.zz_fn()', 'execute')),
  0, 'a new function is not executable by clients');

-- updated_at triggers on the tables that carry the column.
insert into public.households (id, name) values ('00000000-0000-0000-0000-0000000000b1', 'Our flat');
insert into public.privacy_zones (user_id, center, radius_m, updated_at)
values (tests.get_supabase_uid('aoife'), extensions.st_geogfromtext('POINT(-6.26 53.35)'), 2000, '2020-01-01');
insert into public.household_vets (household_id, name, phone, updated_at)
values ('00000000-0000-0000-0000-0000000000b1', 'Dublin Vets', '01 234 5678', '2020-01-01');
update public.privacy_zones set radius_m = 3000;
update public.household_vets set name = 'Dublin Vets Ltd';
select cmp_ok((select updated_at from public.privacy_zones), '>', '2020-01-01'::timestamptz, 'privacy_zones.updated_at is maintained');
select cmp_ok((select updated_at from public.household_vets), '>', '2020-01-01'::timestamptz, 'household_vets.updated_at is maintained');

select * from finish();
rollback;
