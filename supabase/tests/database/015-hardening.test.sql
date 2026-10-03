begin;
select plan(24);

select tests.create_supabase_user('aoife');

-- Handles are lowercase only. The column is citext, whose ~ operator is case-insensitive, so the check
-- has to compare as text.
select throws_ok(
  $$insert into public.profiles (id, handle) values (tests.get_supabase_uid('aoife'), 'AoifeGrows')$$,
  '23514', null, 'mixed-case handles are rejected');
select lives_ok(
  $$insert into public.profiles (id, handle) values (tests.get_supabase_uid('aoife'), 'aoifegrows')$$,
  'lowercase handles are accepted');

-- Catalog-driven grants audit: what can the client roles actually do to relations in public and private?
-- Uses has_*_privilege, which sees direct grants, PUBLIC grants and column-level grants alike. It is a view
-- so that it is evaluated when queried and can be pointed at probe tables created later in this test.
-- MAINTAIN (Postgres 17) is a table-level privilege only, so it sits with the table-level list.
create temp view held_privs as
with roles(role_name) as (values ('anon'), ('authenticated')),
rels as (
  select c.oid, n.nspname::text as schema_name, c.relname::text as relname, c.relkind
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private') and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
)
select role_name, schema_name, relname, priv from roles, rels, (values ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')) as p(priv)
  where rels.relkind <> 'S' and has_any_column_privilege(role_name, rels.oid, priv)
union all
select role_name, schema_name, relname, priv from roles, rels, (values ('DELETE'), ('TRUNCATE'), ('TRIGGER'), ('MAINTAIN')) as p(priv)
  where rels.relkind <> 'S' and has_table_privilege(role_name, rels.oid, priv)
union all
select role_name, schema_name, relname, priv from roles, rels, (values ('USAGE'), ('SELECT'), ('UPDATE')) as p(priv)
  where rels.relkind = 'S' and has_sequence_privilege(role_name, rels.oid, priv);

select isnt_empty(
  $$select 1 from held_privs where role_name = 'authenticated' and schema_name = 'public' and relname = 'profiles' and priv = 'SELECT'$$,
  'the audit can see the grants it is meant to police');
select is_empty(
  $$select * from held_privs where schema_name = 'public' and role_name = 'anon' and not (relname in ('species', 'species_toxicity') and priv = 'SELECT')$$,
  'anon holds nothing in public except select on the species catalogue');
select is_empty(
  $$select * from held_privs where schema_name = 'public' and role_name = 'authenticated' and priv <> 'SELECT'$$,
  'authenticated holds nothing in public but select');
select is_empty(
  $$select * from held_privs where schema_name = 'private'$$,
  'neither client role holds any privilege on any private relation');

-- The private audit is not vacuous: a probe with deliberate grants (SELECT, and MAINTAIN which is new in
-- Postgres 17) shows up.
create table private.zz_probe (id int);
grant select on private.zz_probe to authenticated;
grant maintain on private.zz_probe to anon;
select isnt_empty(
  $$select 1 from held_privs where schema_name = 'private' and relname = 'zz_probe' and role_name = 'authenticated' and priv = 'SELECT'$$,
  'the audit sees a grant on a private relation');
select isnt_empty(
  $$select 1 from held_privs where schema_name = 'private' and relname = 'zz_probe' and role_name = 'anon' and priv = 'MAINTAIN'$$,
  'the audit sees MAINTAIN');

-- Every table in private has row level security on (with no policies), so a stray grant still exposes nothing.
select cmp_ok(
  (select count(*)::int from pg_tables where schemaname = 'private' and tablename <> 'zz_probe'), '>=', 2,
  'private holds the tables the RLS check is meant to cover');
select is_empty(
  $$select tablename from pg_tables where schemaname = 'private' and tablename <> 'zz_probe' and not rowsecurity$$,
  'every private table has row level security enabled');

-- Default privileges: new objects start closed to clients.
create table public.zz_tmp (id int);
create sequence public.zz_seq;
create function public.zz_fn() returns int language sql as $$ select 1 $$;
select is(
  (select count(*)::int from pg_class c, (values ('anon'), ('authenticated')) as r(role_name),
     (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')) as p(priv)
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

-- Function EXECUTE audit: which of our functions can the client roles call? Functions are ours when no extension owns
-- them (extension functions are not ours to grant or revoke). Views, so the probes below can be added after they are
-- defined. security definer functions run with the owner's rights, so each client-callable one is a deliberate door:
-- anon gets the public label lookup only; authenticated additionally gets the two helpers its RLS policies call.
-- The allow-list names exact signatures (resolved to oids, so it does not depend on search_path), so an overload of an
-- allowed name is still flagged. fn is the readable form, for failure output only.
create temp view held_fn_exec as
select r.role_name, p.oid as fn_oid, p.oid::regprocedure::text as fn
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join (values ('anon'), ('authenticated')) as r(role_name)
where n.nspname in ('public', 'private')
  and not exists (
    select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
  )
  and has_function_privilege(r.role_name, p.oid, 'execute');

create temp view fn_exec_offenders as
select * from held_fn_exec
where (role_name = 'anon' and fn_oid <> 'public.public_label(text)'::regprocedure::oid)
   or (role_name = 'authenticated' and fn_oid not in (
     'public.public_label(text)'::regprocedure::oid,
     'private.is_admin()'::regprocedure::oid,
     'private.my_household_ids()'::regprocedure::oid));

select isnt_empty(
  $$select 1 from held_fn_exec where role_name = 'anon' and fn_oid = 'public.public_label(text)'::regprocedure::oid$$,
  'the function audit can see the grants it is meant to police');
select is_empty(
  $$select * from fn_exec_offenders where role_name = 'anon'$$,
  'anon may execute only public.public_label(text)');
select is_empty(
  $$select * from fn_exec_offenders where role_name = 'authenticated'$$,
  'authenticated may execute only public_label(text), is_admin() and my_household_ids()');
grant execute on function public.zz_fn() to anon;
select isnt_empty(
  $$select 1 from fn_exec_offenders where role_name = 'anon' and fn_oid = 'public.zz_fn()'::regprocedure::oid$$,
  'the function audit flags a grant it should flag');
create function public.public_label(integer) returns text language sql as $$ select 'x'::text $$;
grant execute on function public.public_label(integer) to authenticated;
select isnt_empty(
  $$select 1 from fn_exec_offenders where role_name = 'authenticated' and fn_oid = 'public.public_label(integer)'::regprocedure::oid$$,
  'the function audit flags an overload of an allowed name');

-- A blank taxon would over-flag rather than never match: flag_sensitive compares against coalesce(family, ''), so a
-- blank family-rank row would mark every species that has no family as sensitive.
select throws_ok(
  $$insert into private.sensitive_taxa (rank, taxon, reason, source) values ('genus', '  ', 'Poaching risk', 'test')$$,
  '23514', null, 'a blank sensitive taxon is rejected');

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

-- Postgres does not index foreign key columns by itself, and cascades, set-null and joins scan them. Every
-- foreign key in public and private must have an index whose leading column is the key's first column
-- (all of ours are single-column). A view, so the probe below can be added after it is defined.
create temp view fk_cols as
select n.nspname::text as schema_name, c.relname::text as relname, a.attname::text as attname,
  exists (
    select 1 from pg_index i
    where i.indrelid = k.conrelid and i.indkey[0] = k.conkey[1] and i.indisvalid
  ) as indexed
from pg_constraint k
join pg_class c on c.oid = k.conrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
where k.contype = 'f' and n.nspname in ('public', 'private');

select isnt_empty(
  $$select 1 from fk_cols where schema_name = 'public' and relname = 'plants' and attname = 'household_id' and indexed$$,
  'the foreign key audit can see an indexed foreign key');
select is_empty(
  $$select schema_name, relname, attname from fk_cols where not indexed$$,
  'every foreign key column is indexed');
create table public.zz_fk_probe (species_id uuid references public.species);
select isnt_empty(
  $$select 1 from fk_cols where relname = 'zz_fk_probe' and attname = 'species_id' and not indexed$$,
  'the foreign key audit sees an unindexed foreign key');

select * from finish();
rollback;
