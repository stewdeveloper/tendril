begin;
select plan(2);
-- No function callable by anon or authenticated may return or mention geography/geometry, except functions in schemas they cannot reach.
-- The CTE is materialized so the schema filter runs before pg_get_functiondef: the planner would otherwise push that
-- call down onto every pg_proc row, and it raises on aggregates (e.g. pg_catalog.array_agg).
select is_empty($$
  with fns as materialized (
    select p.oid, p.prokind
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  )
  select f.oid::regprocedure::text
  from fns f
  where (has_function_privilege('anon', f.oid, 'execute') or has_function_privilege('authenticated', f.oid, 'execute'))
    and (pg_get_function_result(f.oid) ~* 'geograph|geometr'
      or case when f.prokind = 'a' then false else pg_get_functiondef(f.oid) ~* 'observation_locations|privacy_zones' end)
$$, 'no client-callable public function returns or reads precise locations');
-- Only observation_locations and privacy_zones may hold geography columns in public. (information_schema names carry
-- collation "C", which clashes with the literal's default collation inside results_eq, so the result is re-collated.)
select results_eq($$
  select (string_agg(table_name::text || '.' || column_name::text, ',' order by table_name::text))::text collate "default"
  from information_schema.columns where table_schema = 'public' and udt_name in ('geography', 'geometry')
$$, $$values ('observation_locations.point,privacy_zones.center')$$, 'precise points live only in owner-only tables');
select * from finish();
rollback;
