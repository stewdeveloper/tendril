begin;
select plan(6);
-- A species with no family is sensitive: the provider often omits it and hiding a location is the safe side.
-- The reference catalogue is seeded by seed.sql and must not change flag.
select is(
  (select array_agg(slug order by slug) from public.species where sensitive),
  array['early-purple-orchid', 'moth-orchid'],
  'only the two orchids in the reference catalogue are sensitive');
select is(
  (select count(*)::int from public.species where family is null), 0, 'no reference species lacks a family');

insert into public.species (id, scientific_name, common_name, slug, family)
values ('00000000-0000-0000-0000-0000000071c1', 'Nullfamilia rara', 'Null family plant', 'null-family-plant', null);
select is((select sensitive from public.species where slug = 'null-family-plant'), true, 'a null-family species is inserted sensitive');

insert into private.sensitive_taxa (rank, taxon, reason, source) values ('family', 'Zzzaceae', 'test', 'test');
select is((select sensitive from public.species where slug = 'null-family-plant'), true, 'adding a taxon leaves a null-family species sensitive');
delete from private.sensitive_taxa where taxon = 'Zzzaceae';
select is((select sensitive from public.species where slug = 'null-family-plant'), true, 'deleting a taxon leaves a null-family species sensitive');

insert into public.species (scientific_name, common_name, slug, family) values ('Aroidea plana', 'Plain aroid', 'plain-aroid', 'Araceae');
select is((select sensitive from public.species where slug = 'plain-aroid'), false, 'a species with a family and no taxon is not sensitive');
select * from finish();
rollback;
