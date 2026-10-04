begin;
select plan(9);
-- supabase/seed.sql loads a real catalogue, and this test inserts its own species with the same slugs and names. Clear the
-- seeded reference data inside the transaction; the rollback at the end puts it back.
delete from public.qr_codes;
delete from public.species;
delete from private.sensitive_taxa;
insert into private.sensitive_taxa (rank, taxon, reason, source)
values ('family', 'Orchidaceae', 'Poaching risk', 'iNaturalist geoprivacy practice'),
       ('genus', 'Cypripedium', 'Poaching risk', 'iNaturalist geoprivacy practice');

insert into public.species (scientific_name, common_name, family, genus, slug)
values ('Orchis mascula', 'Early purple orchid', '  orchidaceae ', 'Orchis', 'early-purple-orchid'),
       ('Cypripedium calceolus', 'Lady''s slipper orchid', null, 'CYPRIPEDIUM', 'ladys-slipper'),
       ('Spathiphyllum', 'Peace lily', 'Araceae', 'Spathiphyllum', 'peace-lily');

select is((select sensitive from public.species where slug = 'early-purple-orchid'), true, 'family match ignores case and whitespace');
select is((select sensitive from public.species where slug = 'ladys-slipper'), true, 'genus match ignores case');
select is((select sensitive from public.species where slug = 'peace-lily'), false, 'non-sensitive species stays public');

select throws_ok($$insert into public.species_toxicity (species_id, animal, severity) values ((select id from public.species where slug='peace-lily'), 'cat', 'none')$$,
  '23514', null, 'no known toxicity requires a source');
insert into public.species_toxicity (species_id, animal, severity, summary, source_name, source_url, review_status)
values ((select id from public.species where slug='peace-lily'), 'cat', 'moderate',
  'Peace lily can irritate the mouth and cause drooling and vomiting.', 'ASPCA',
  'https://www.aspca.org/pet-care/aspca-poison-control/toxic-and-non-toxic-plants/peace-lily', 'seed_pending_vet');

select tests.create_supabase_user('aoife');
select tests.authenticate_as('aoife');
select results_eq('select count(*)::int from public.species', $$values (3)$$, 'everyone can read the catalogue');
select results_eq('select severity from public.species_toxicity', $$values ('moderate')$$, 'everyone can read toxicity');
select throws_ok($$update public.species set sensitive = false$$, '42501', null, 'clients cannot edit species');
select throws_ok('select * from private.sensitive_taxa', '42501', null, 'clients cannot read sensitive taxa');
select tests.clear_authentication();
set local role anon;
select results_eq('select count(*)::int from public.species', $$values (3)$$, 'anon can read the catalogue (web species pages)');
reset role;
select * from finish();
rollback;
