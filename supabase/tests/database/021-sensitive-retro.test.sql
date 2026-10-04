begin;
select plan(9);
-- Adding or removing a sensitive taxon re-flags species that already exist. The migrations seed the real taxa; clear
-- them (and the species) inside the transaction so each case starts from nothing. The rollback restores them.
delete from public.qr_codes;
delete from public.species;
delete from private.sensitive_taxa;

insert into public.species (scientific_name, common_name, family, genus, slug) values
  ('Orchis mascula', 'Early purple orchid', 'Orchidaceae', 'Orchis', 'early-purple-orchid'),
  ('Cypripedium calceolus', 'Lady''s slipper', null, null, 'ladys-slipper'),
  ('Monstera deliciosa', 'Swiss cheese plant', 'Araceae', 'Monstera', 'swiss-cheese-plant');
select is((select sensitive from public.species where slug = 'early-purple-orchid'), false, 'a species with no matching taxon starts public');

insert into private.sensitive_taxa (rank, taxon, reason, source) values ('family', 'Orchidaceae', 'Poaching risk', 'test');
select is((select sensitive from public.species where slug = 'early-purple-orchid'), true, 'a family taxon added later flags the existing species');
select is((select sensitive from public.species where slug = 'swiss-cheese-plant'), false, 'an unrelated species stays public');

delete from private.sensitive_taxa where taxon = 'Orchidaceae';
select is((select sensitive from public.species where slug = 'early-purple-orchid'), false, 'removing the taxon clears the flag');

insert into private.sensitive_taxa (rank, taxon, reason, source) values ('genus', 'cypripedium', 'Poaching risk', 'test');
select is((select sensitive from public.species where slug = 'ladys-slipper'), true, 'a genus taxon matches a species with a null genus via its scientific name');

insert into private.sensitive_taxa (rank, taxon, reason, source) values ('species', 'MONSTERA DELICIOSA', 'Test', 'test');
select is((select sensitive from public.species where slug = 'swiss-cheese-plant'), true, 'a species-rank taxon matches the exact name, ignoring case');
select is((select sensitive from public.species where slug = 'early-purple-orchid'), false, 'and no other species');

insert into private.sensitive_taxa (rank, taxon, reason, source) values ('family', 'Orchidaceae', 'Poaching risk', 'test');
select throws_ok(
  $$insert into private.sensitive_taxa (rank, taxon, reason, source) values ('family', 'orchidaceae ', 'Poaching risk', 'test')$$,
  '23505', null, 'the same taxon in another case or padding is a duplicate');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname = 'species_is_sensitive'
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
  0, 'clients cannot execute the predicate');
select * from finish();
rollback;
