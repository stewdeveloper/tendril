begin;
select plan(8);
select tests.create_supabase_user('aoife');
select tests.create_supabase_user('outsider');
insert into public.species (id, scientific_name, common_name, slug)
values ('00000000-0000-0000-0000-00000000c002', 'Spathiphyllum', 'Peace lily', 'peace-lily');
insert into public.partners (id, name, kind) values ('00000000-0000-0000-0000-00000000f001', 'Greenhouse Growers', 'grower');
insert into public.qr_codes (code, partner_id, species_id, status) values
  ('PL-0001', '00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000c002', 'active'),
  ('PL-OLD1', '00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000c002', 'retired');
insert into public.plantdex_entries (user_id, species_id, category, first_found_at)
values (tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-00000000c002', 'houseplant', now());

set local role anon;
select is((public.public_label('PL-0001') ->> 'growerName'), 'Greenhouse Growers', 'anon can resolve an active label');
select is((public.public_label('PL-0001') -> 'species' ->> 'commonName'), 'Peace lily', 'label carries the species');
select is(public.public_label('PL-OLD1'), null, 'retired codes resolve to null');
select is(public.public_label('NOPE'), null, 'unknown codes resolve to null');
select throws_ok('select * from public.qr_codes', '42501', null, 'anon cannot list codes');
reset role;

select tests.authenticate_as('aoife');
select results_eq('select count(*)::int from public.plantdex_entries', $$values (1)$$, 'owner sees own Plantdex');
select throws_ok('select * from public.partners', '42501', null, 'clients cannot read partners');
select tests.authenticate_as('outsider');
select is_empty('select * from public.plantdex_entries', 'others cannot see the Plantdex');
select * from finish();
rollback;
