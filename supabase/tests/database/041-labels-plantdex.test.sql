begin;
select plan(15);
select tests.create_supabase_user('aoife');
select tests.create_supabase_user('outsider');
insert into public.species (id, scientific_name, common_name, slug)
values ('00000000-0000-0000-0000-00000000c002', 'Spathiphyllum', 'Peace lily', 'peace-lily');
insert into public.partners (id, name, kind, contact_email)
values ('00000000-0000-0000-0000-00000000f001', 'Greenhouse Growers', 'grower', 'sales@greenhouse-growers.example');
insert into public.qr_codes (code, partner_id, species_id, status) values
  ('PL-0001', '00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000c002', 'active'),
  ('PL-OLD1', '00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000c002', 'retired');
-- Dog is inserted before cat so the label has to sort them rather than echo insertion order.
insert into public.species_toxicity (species_id, animal, severity, summary, source_name, source_url, review_status) values
  ('00000000-0000-0000-0000-00000000c002', 'dog', 'moderate', 'Mouth and throat irritation.', 'ASPCA', 'https://example.org/dog', 'reviewed'),
  ('00000000-0000-0000-0000-00000000c002', 'cat', 'mild', 'Mild oral irritation.', 'ASPCA', 'https://example.org/cat', 'seed_pending_vet');
insert into public.plantdex_entries (user_id, species_id, category, first_found_at)
values (tests.get_supabase_uid('aoife'), '00000000-0000-0000-0000-00000000c002', 'houseplant', now());

set local role anon;
select is((public.public_label('PL-0001') ->> 'growerName'), 'Greenhouse Growers', 'anon can resolve an active label');
select is((public.public_label('PL-0001') -> 'species' ->> 'commonName'), 'Peace lily', 'label carries the species');
select is(public.public_label('PL-OLD1'), null, 'retired codes resolve to null');
select is(public.public_label('NOPE'), null, 'unknown codes resolve to null');
select throws_ok('select * from public.qr_codes', '42501', null, 'anon cannot list codes');
select is(
  (select array_agg(k order by k collate "C") from jsonb_object_keys(public.public_label('PL-0001')) as k),
  array['code', 'cultivar', 'growerName', 'species', 'toxicity'],
  'the label exposes exactly the allow-listed top-level keys');
select ok(
  public.public_label('PL-0001')::text !~* '"(contact_email|partner_id|partnerId)"\s*:',
  'the label carries no partner contact or partner id key');
select ok(
  public.public_label('PL-0001')::text not like '%greenhouse-growers.example%',
  'the partner contact address appears nowhere in the label');
select is(public.public_label('  pl-0001 ') ->> 'code', 'PL-0001', 'a lowercase, padded code resolves');
select is(public.public_label('  pl-0001 '), public.public_label('PL-0001'), 'a lowercase, padded code gives the same label');
select is(
  jsonb_path_query_array(public.public_label('PL-0001'), '$.toxicity[*].animal'),
  '["cat", "dog"]'::jsonb,
  'toxicity entries are ordered by animal');
select is(
  jsonb_path_query_array(public.public_label('PL-0001'), '$.toxicity[*].reviewStatus'),
  '["seed_pending_vet", "reviewed"]'::jsonb,
  'toxicity entries carry their review status');
reset role;

select tests.authenticate_as('aoife');
select results_eq('select count(*)::int from public.plantdex_entries', $$values (1)$$, 'owner sees own Plantdex');
select throws_ok('select * from public.partners', '42501', null, 'clients cannot read partners');
select tests.authenticate_as('outsider');
select is_empty('select * from public.plantdex_entries', 'others cannot see the Plantdex');
select * from finish();
rollback;
