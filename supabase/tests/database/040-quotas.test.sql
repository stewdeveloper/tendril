begin;
select plan(15);
select tests.create_supabase_user('aoife');

select is(private.reserve_usage(tests.get_supabase_uid('aoife'), 'identification', '2026-10', 2), true, 'first reservation succeeds');
select is(private.reserve_usage(tests.get_supabase_uid('aoife'), 'identification', '2026-10', 2), true, 'second reservation succeeds');
select is(private.reserve_usage(tests.get_supabase_uid('aoife'), 'identification', '2026-10', 2), false, 'third is refused at the limit');
select is((select used from public.usage_counters where kind = 'identification'), 2, 'usage never exceeds the limit');
select is(private.reserve_usage(tests.get_supabase_uid('aoife'), 'diagnosis', '2026-10', 0), false, 'a zero limit refuses even the first call');
select is((select count(*)::int from public.usage_counters where kind = 'diagnosis'), 0, 'a refused first call writes nothing');
select private.release_usage(tests.get_supabase_uid('aoife'), 'identification', '2026-10');
select is((select used from public.usage_counters where kind = 'identification'), 1, 'release gives one back');

insert into public.entitlements (user_id, source, active_until) values (tests.get_supabase_uid('aoife'), 'preview', now() + interval '7 days');
select is(private.is_premium(tests.get_supabase_uid('aoife')), true, 'active preview is premium');
update public.entitlements set active_until = now() - interval '1 second';
select is(private.is_premium(tests.get_supabase_uid('aoife')), false, 'expired entitlement is not premium');

-- A null limit is "no limit configured", which must refuse like zero: `lim <= 0` alone is null for a null lim and
-- would let the first reservation through.
select is(private.reserve_usage(tests.get_supabase_uid('aoife'), 'identification', '2026-11', null), false, 'a null limit refuses');
select is((select count(*)::int from public.usage_counters where period_key = '2026-11'), 0, 'a refused null-limit call writes no row');

-- Release is forgiving: nothing to give back is a no-op, and a counter at zero stays at zero.
select lives_ok($$select private.release_usage(tests.get_supabase_uid('aoife'), 'scoring_scan', '2026-10')$$, 'releasing a counter that has no row is a no-op');
select is((select count(*)::int from public.usage_counters where kind = 'scoring_scan'), 0, 'releasing a missing counter creates no row');
select is(private.reserve_usage(tests.get_supabase_uid('aoife'), 'scoring_scan', '2026-10', 5), true, 'a fresh counter reserves');
select private.release_usage(tests.get_supabase_uid('aoife'), 'scoring_scan', '2026-10');
select private.release_usage(tests.get_supabase_uid('aoife'), 'scoring_scan', '2026-10');
select is((select used from public.usage_counters where kind = 'scoring_scan'), 0, 'releasing at zero leaves the counter at zero');
select * from finish();
rollback;
