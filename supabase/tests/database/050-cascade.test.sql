begin;
select plan(9);
-- supabase/seed.sql loads a real catalogue, and this test inserts its own species with the same slugs and names. Clear the
-- seeded reference data inside the transaction; the rollback at the end puts it back.
delete from public.qr_codes;
delete from public.species;
select tests.create_supabase_user('leaver');
insert into public.profiles (id, handle) values (tests.get_supabase_uid('leaver'), 'leaver1');
insert into public.privacy_zones (user_id, center, radius_m) values (tests.get_supabase_uid('leaver'), extensions.st_geogfromtext('POINT(0 0)'), 1000);
insert into public.species (id, scientific_name, common_name, slug) values ('00000000-0000-0000-0000-00000000c009', 'Ulex europaeus', 'Gorse', 'gorse');
insert into public.observations (id, user_id, device_time, capture_source) values ('00000000-0000-0000-0000-00000000b009', tests.get_supabase_uid('leaver'), now(), 'camera');
insert into public.observation_locations (observation_id, user_id, point) values ('00000000-0000-0000-0000-00000000b009', tests.get_supabase_uid('leaver'), extensions.st_geogfromtext('POINT(0 0)'));
insert into public.observation_photos (observation_id, user_id, storage_path, sha256) values ('00000000-0000-0000-0000-00000000b009', tests.get_supabase_uid('leaver'), 'x/y.jpg', 'h');
insert into public.plantdex_entries (user_id, species_id, category, first_found_at) values (tests.get_supabase_uid('leaver'), '00000000-0000-0000-0000-00000000c009', 'wild', now());
insert into public.usage_counters (user_id, kind, period_key, used) values (tests.get_supabase_uid('leaver'), 'identification', '2026-10', 3);
insert into public.entitlements (user_id, source, active_until) values (tests.get_supabase_uid('leaver'), 'preview', now());

delete from auth.users where id = tests.get_supabase_uid('leaver');

select is_empty($$select 1 from public.profiles where handle = 'leaver1'$$, 'profile removed');
select is_empty($$select 1 from public.privacy_zones$$, 'privacy zone removed');
select is_empty($$select 1 from public.observations where id = '00000000-0000-0000-0000-00000000b009'$$, 'observations removed');
select is_empty($$select 1 from public.observation_locations$$, 'precise points removed');
select is_empty($$select 1 from public.observation_photos$$, 'photo rows removed');
select is_empty($$select 1 from public.plantdex_entries$$, 'Plantdex removed');
select is_empty($$select 1 from public.usage_counters$$, 'usage removed');
select is_empty($$select 1 from public.entitlements$$, 'entitlements removed');
select isnt_empty($$select 1 from public.species where slug = 'gorse'$$, 'shared catalogue rows remain');
select * from finish();
rollback;
