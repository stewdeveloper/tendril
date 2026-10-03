begin;
select plan(9);
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
select * from finish();
rollback;
