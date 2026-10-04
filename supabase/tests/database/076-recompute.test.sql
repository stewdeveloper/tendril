begin;
select plan(53);
select tests.create_supabase_user('aoife');
select tests.create_supabase_user('partner');
select tests.create_supabase_user('kiwi');
select tests.create_supabase_user('gone');
create temp table boot as select public.srv_bootstrap(tests.get_supabase_uid('aoife'), 'aoiferecomp', 'Aoife', 'Europe/Dublin', 'IE') as r;
create temp table boot_kiwi as select public.srv_bootstrap(tests.get_supabase_uid('kiwi'), 'kiwirecomp', null, 'Pacific/Auckland', 'NZ') as r;
create temp table boot_gone as select public.srv_bootstrap(tests.get_supabase_uid('gone'), 'gonerecomp', null, 'America/New_York', 'US') as r;
insert into public.household_members (household_id, user_id, role)
values ((select (r->>'householdId')::uuid from boot), tests.get_supabase_uid('partner'), 'member');
insert into public.species (id, scientific_name, common_name, slug, watering_min, watering_max, check_interval_days) values
  ('00000000-0000-0000-0000-0000007600c1', 'Recomputa plantae', 'Recompute plant', 'recompute-plant', 2, 3, 9);

create function pg_temp.mk(p_uid uuid, p_hh uuid, p_nick text, p_indoor boolean) returns uuid language sql as $$
  select public.srv_create_plant(p_uid, p_hh, '00000000-0000-0000-0000-0000007600c1', null, p_nick, null, p_indoor, 16, 'terracotta', 'yes', 'bright', 'manual', null, '2026-10-20', '2026-10-03T10:00:00Z', null)
$$;
create temp table pl as select
  pg_temp.mk(tests.get_supabase_uid('aoife'), (select (r->>'householdId')::uuid from boot), 'Out', false) as outdoor,
  pg_temp.mk(tests.get_supabase_uid('aoife'), (select (r->>'householdId')::uuid from boot), 'In', true) as indoor,
  pg_temp.mk(tests.get_supabase_uid('aoife'), (select (r->>'householdId')::uuid from boot), 'Dead', false) as dead,
  pg_temp.mk(tests.get_supabase_uid('kiwi'), (select (r->>'householdId')::uuid from boot_kiwi), 'Kiwi', true) as kiwi,
  pg_temp.mk(tests.get_supabase_uid('gone'), (select (r->>'householdId')::uuid from boot_gone), 'Orphan', true) as orphan;
select public.srv_set_plant_status(tests.get_supabase_uid('aoife'), (select dead from pl), 'dead', null, '2026-10-05', '2026-10-05T10:00:00Z', 9);
-- The creator of the orphan plant deletes their account: created_by becomes null.
delete from auth.users where id = tests.get_supabase_uid('gone');
update public.plants set cell_r7 = 608533827635118079, care_state = '{"learned": 1.2, "extra": true}'::jsonb where id = (select outdoor from pl);
select public.srv_weather_store('608533827635118079', 'Europe/Dublin', '{"rainNext48hMm": 6.5, "maxTempNext48hC": 14}'::jsonb);

create temp view mine as select * from public.srv_recompute_batch(null, 1000)
  where plant_id in (select outdoor from pl union all select indoor from pl union all select dead from pl union all select kiwi from pl union all select orphan from pl);
create temp view row_out as select * from mine where plant_id = (select outdoor from pl);

-- Privileges ----------------------------------------------------------------------------------------------------
select is_empty($$select proname from pg_proc where proname in ('srv_recompute_batch', 'srv_recompute_plant')
  and (has_function_privilege('anon', oid, 'execute') or has_function_privilege('authenticated', oid, 'execute') or not has_function_privilege('service_role', oid, 'execute'))$$,
  'the recompute srv_ functions are service_role only');
select is((select count(*)::int from pg_proc where proname in ('srv_recompute_batch', 'srv_recompute_plant') and prosecdef and 'search_path=""' = any (proconfig)), 2,
  'both are security definer with an empty search_path');

-- Batch: rows and fields -----------------------------------------------------------------------------------------
select is((select count(*)::int from mine), 4, 'every alive plant is in the batch');
select is_empty($$select 1 from mine where plant_id = (select dead from pl)$$, 'a dead plant is not');
select is((select care_state from row_out), '{"learned": 1.2, "extra": true}'::jsonb, 'care_state is the raw stored value');
select is((select row(watering_min, watering_max, interval_override)::text from row_out), '(2,3,9)', 'species watering and interval override');
select is((select row(pot_material, pot_size_cm, light, drainage, indoor)::text from row_out), '(terracotta,16,bright,yes,f)', 'pot, light, drainage and indoor');
select is((select tz from row_out), 'Europe/Dublin', 'tz is the creator''s profile tz');
select is((select tz from mine where plant_id = (select kiwi from pl)), 'Pacific/Auckland', 'each plant has its own creator''s tz');
select is((select tz from mine where plant_id = (select orphan from pl)), 'UTC', 'a plant with no creator falls back to UTC');
select is((select country_code from row_out), 'IE', 'country code of the creator');
select is((select country_code from mine where plant_id = (select kiwi from pl)), 'NZ', 'a southern country code');
select is((select country_code from mine where plant_id = (select orphan from pl)), null, 'no creator, no country code');
select is((select plan from row_out), 'free', 'free with no premium member');
insert into public.entitlements (user_id, source, active_until) values (tests.get_supabase_uid('partner'), 'store', now() + interval '1 day');
select is((select plan from row_out), 'premium', 'premium once any member of the household is');
select is((select plan from mine where plant_id = (select kiwi from pl)), 'free', 'another household stays free');
select is((select open_check_on from row_out), '2026-10-20'::date, 'the open check''s due date');
select is((select cell from row_out), '608533827635118079', 'a cell above 2^53 crosses as exact text');
select is((select cell from mine where plant_id = (select indoor from pl)), null, 'an indoor plant has no cell');
select is((select weather_summary from row_out), '{"rainNext48hMm": 6.5, "maxTempNext48hC": 14}'::jsonb, 'the cached summary for the cell');
select matches((select weather_fetched_at from row_out), '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$', 'fetched_at is ISO text');
select is((select weather_summary from mine where plant_id = (select kiwi from pl)), null, 'no cell, no weather');
update public.care_tasks set status = 'superseded' where plant_id = (select kiwi from pl) and kind = 'check' and status = 'due';
select is((select open_check_on from mine where plant_id = (select kiwi from pl)), null, 'no open check is null');

-- Batch: paging --------------------------------------------------------------------------------------------------
create temp table all_ids as select plant_id from public.srv_recompute_batch(null, 1000);
create temp table page1 as select plant_id from public.srv_recompute_batch(null, 2);
create temp table page2 as select plant_id from public.srv_recompute_batch((select plant_id from page1 order by plant_id desc limit 1), 2);
select is((select count(*)::int from page1), 2, 'a page holds at most the limit');
select ok((select plant_id from page2 order by plant_id limit 1) > (select plant_id from page1 order by plant_id desc limit 1), 'the next page starts after the cursor');
select is((select array_agg(plant_id order by plant_id) from page1), (select (array_agg(plant_id order by plant_id))[1:2] from all_ids), 'pages are in plant id order');
create temp table paged (plant_id uuid);
do $$
declare
  v_after uuid := null;
  v_page uuid[];
begin
  loop
    select array_agg(plant_id order by plant_id) into v_page from public.srv_recompute_batch(v_after, 2);
    exit when v_page is null;
    insert into paged select unnest(v_page);
    v_after := v_page[array_length(v_page, 1)];
  end loop;
end $$;
select is((select array_agg(plant_id order by plant_id) from paged), (select array_agg(plant_id order by plant_id) from all_ids), 'paging through covers every plant exactly once');
select is((select count(*)::int from public.srv_recompute_batch(null, 0)), 0, 'a zero limit returns nothing');

-- Recompute: compare-and-set -------------------------------------------------------------------------------------
create temp table st as select '{"learned": 1, "pause": null, "boost": null, "lastCheckOn": null, "lastWateredOn": null, "checkBasis": {"from": "2026-10-03", "kind": "interval"}}'::jsonb as s;
select is(public.srv_recompute_plant((select outdoor from pl), '{"learned": 1.2}'::jsonb, (select s from st), '2026-10-15', '2026-10-10'), 'conflict', 'a stale expected state is a conflict');
select is((select care_state from public.plants where id = (select outdoor from pl)), '{"learned": 1.2, "extra": true}'::jsonb, 'a conflict writes no state');
select is((select due_on from public.care_tasks where plant_id = (select outdoor from pl) and kind = 'check' and status = 'due'), '2026-10-20'::date, 'nor moves the check');
select is(public.srv_recompute_plant((select outdoor from pl), null, (select s from st), '2026-10-15', '2026-10-10'), 'conflict', 'a null expected state is a conflict');

-- Recompute: re-date ---------------------------------------------------------------------------------------------
select is(public.srv_recompute_plant((select outdoor from pl), '{"extra": true, "learned": 1.2}'::jsonb, (select s from st), '2026-10-15', '2026-10-10'), 'updated', 'the expected state matches as jsonb, whatever the key order');
select is((select care_state from public.plants where id = (select outdoor from pl)), (select s from st), 'the new state is written');
select is((select due_on from public.care_tasks where plant_id = (select outdoor from pl) and kind = 'check' and status = 'due'), '2026-10-15'::date, 'the open check is re-dated');
select is(public.srv_recompute_plant((select outdoor from pl), (select s from st), (select s from st), '2026-10-15', '2026-10-10'), 'unchanged', 'the same state and date change nothing');
select is(public.srv_recompute_plant((select outdoor from pl), (select s from st), (select s from st), '2026-10-12', '2026-10-10'), 'updated', 'a new date alone is an update');
select is((select count(*)::int from public.care_tasks where plant_id = (select outdoor from pl) and kind = 'check' and status = 'due'), 1, 'still exactly one open check');

-- Recompute: a due or overdue check is never moved ----------------------------------------------------------------
update public.care_tasks set due_on = '2026-10-09' where plant_id = (select outdoor from pl) and kind = 'check' and status = 'due';
select is(public.srv_recompute_plant((select outdoor from pl), (select s from st), (select s from st), '2026-10-15', '2026-10-10'), 'unchanged', 'an overdue check is not moved');
select is((select due_on from public.care_tasks where plant_id = (select outdoor from pl) and kind = 'check' and status = 'due'), '2026-10-09'::date, 'it keeps its date');
select is(public.srv_recompute_plant((select outdoor from pl), (select s from st), (select s from st), '2026-10-09', '2026-10-10'), 'unchanged', 'a past date is ignored while the open check is overdue');
update public.care_tasks set due_on = '2026-10-10' where plant_id = (select outdoor from pl) and kind = 'check' and status = 'due';
select is(public.srv_recompute_plant((select outdoor from pl), (select s from st), (select s || '{"learned": 1.1}'::jsonb from st), '2026-10-15', '2026-10-10'), 'updated', 'the state is still written while a check is due today');
select is((select due_on from public.care_tasks where plant_id = (select outdoor from pl) and kind = 'check' and status = 'due'), '2026-10-10'::date, 'but a check due today is not moved');

-- Recompute: a missing open check is inserted ---------------------------------------------------------------------
select is(public.srv_recompute_plant((select kiwi from pl), (select care_state from public.plants where id = (select kiwi from pl)), (select s from st), '2026-10-18', '2026-10-10'), 'updated', 'a plant with no open check gets one');
select is((select count(*)::int from public.care_tasks where plant_id = (select kiwi from pl) and kind = 'check' and status = 'due'), 1, 'exactly one');
select is((select row(due_on, household_id)::text from public.care_tasks where plant_id = (select kiwi from pl) and kind = 'check' and status = 'due'),
  row('2026-10-18'::date, (select (r->>'householdId')::uuid from boot_kiwi))::text, 'on the given date, in the plant''s household');

-- Recompute: closed plants and bad input --------------------------------------------------------------------------
select is(public.srv_recompute_plant((select dead from pl), (select care_state from public.plants where id = (select dead from pl)), (select s from st), '2026-10-18', '2026-10-10'), 'closed', 'a dead plant is closed');
select is_empty($$select 1 from public.care_tasks where plant_id = (select dead from pl) and kind = 'check' and status = 'due'$$, 'and gets no open check');
select isnt((select care_state from public.plants where id = (select dead from pl)), (select s from st), 'and no state');
select is(public.srv_recompute_plant('00000000-0000-0000-0000-000000000000', '{}'::jsonb, (select s from st), '2026-10-18', '2026-10-10'), 'closed', 'a plant that is gone is closed');
select throws_ok($$select public.srv_recompute_plant((select indoor from pl), (select care_state from public.plants where id = (select indoor from pl)), (select s from st), '2026-10-10', '2026-10-10')$$,
  '22023', null, 'a check is never dated before tomorrow');
select throws_ok($$select public.srv_recompute_plant((select indoor from pl), (select care_state from public.plants where id = (select indoor from pl)), '[]'::jsonb, '2026-10-18', '2026-10-10')$$,
  '22023', null, 'the state must be an object');
select throws_ok($$select public.srv_recompute_plant((select indoor from pl), (select care_state from public.plants where id = (select indoor from pl)), (select s from st), null, '2026-10-10')$$,
  '22023', null, 'the next check date is required');

select * from finish();
rollback;
