# Phase 2A: Database, Security and Seeds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Load `supabase:supabase-postgres-best-practices` before writing any SQL.

**Goal:** The Supabase Postgres schema for Tendril's core loop, from accounts and households through species, observations, plants, care, Plantdex, quotas and labels. Every table has explicit grants, row-level security and pgTAP tests, and the seed data loads the species catalogue, the curated pet toxicity, sets, badges, sensitive taxa and a demo label.

**Architecture:**
- **Migrations:** hand-written in `supabase/migrations/`, which are the source of truth.
- **Read and write split:** clients only **read**, through RLS-scoped select policies. Every write goes through Edge Functions, which run as `service_role` (Phase 2B).
- **Private schema:** server-only data and the security-definer helpers live in `private`, which has no grants for `anon` or `authenticated`.
- **Tests:** pgTAP files in `supabase/tests/database/`, run by `supabase test db` against the local Docker stack.
- **Types:** generated into a tiny package, `@tendril/db`.

**Tech Stack:** Supabase CLI 2.119.0 (Postgres 17), PostGIS 3.3, pgTAP 1.3, `basejump-supabase_test_helpers` 0.0.6 (vendored), citext.

**Spec:** `docs/superpowers/specs/2026-10-03-tendril-v1-design.md` (§7 API, §8.1 schema, §8.2 privacy, §8.4 quotas). Research: `docs/research/2026-10-03-stack-research.md` ("Backend: Supabase").

## Global Constraints

- **Docker is required.**
  - `pnpm exec supabase start -x studio,postgres-meta,logflare,vector,imgproxy,supavisor` must be running.
  - If `docker info` fails, stop and report BLOCKED; nothing in this phase can be verified without it.
- **Grants (required from 30 Oct 2026):** every `public` table gets explicit grants. Clients get `grant select` at most, and only on tables they may read. `service_role` gets `grant all`. Nothing grants insert, update or delete to `anon` or `authenticated`.
- **RLS:** enabled on every `public` table. Every policy names its roles (`to authenticated` or `to anon, authenticated`) and uses `(select auth.uid())`. Every column a policy filters on is indexed.
- **Helpers:** security-definer helpers live in `private`, with `set search_path = ''` and fully qualified names (`public.x`, `extensions.st_dwithin`). `grant usage on schema private to authenticated`, and execute is granted only on the helpers that policies call.
- **Keys and times:** UUID primary keys (`gen_random_uuid()`), `timestamptz` in UTC, and every user foreign key is `references auth.users on delete cascade`, or `on delete set null` where the row outlives the user.
- **Locations:** precise locations live only in `observation_locations`, which only the owner can read. No view, RPC or other table exposes `point`.
- **Pet toxicity:** "Unknown" is the absence of a row, or `severity = 'unknown'`. A `none` row must carry a source URL.
- **Migration names:** `supabase/migrations/<timestamp>_<name>.sql`, created with `pnpm exec supabase migration new <name>`. Never edit a migration after it has been committed; add a new one instead.
- **Each task ends** with `pnpm exec supabase db reset && pnpm exec supabase test db` passing.

## Review Focus

1. **An authenticated user writing to a table directly through PostgREST, bypassing the functions.** Every insert, update or delete as `authenticated` must fail with a permissions error (42501). Tested per table in each task with `throws_ok`.
2. **A user in two households.** They see the plants of both, and no others. Leaving a household removes access immediately. Tested in Task 2 and Task 4.
3. **Two quota reservations racing.** The `on conflict … where used < limit` update must never let usage exceed the limit, including when the limit is 0. Tested in Task 5, including the zero-limit case.
4. **Deleting a user who owns rows in every table.** Cascades remove their profile, households where they're the only member (handled by the account function in Phase 6), observations, locations, photos rows, Plantdex, counters and entitlements. Nothing is left orphaned. Tested in Task 6.
5. **Matching a species to a sensitive genus or family when its scientific name has different casing or extra whitespace.** It must still be flagged sensitive. Tested in Task 3.

---

### Task 1: Foundation migration, test helpers and the CI database job

**Files:**
- Create:
  - `supabase/migrations/<ts>_foundation.sql`
  - `supabase/tests/database/000-setup-tests-hooks.sql` (vendored helpers)
  - `supabase/tests/database/001-foundation.test.sql`
- Modify:
  - `.github/workflows/ci.yml`: add a `database` job
  - `package.json`: add root scripts `db:start`, `db:reset`, `db:test` and `db:types`

**Interfaces:**
- Produces:
  - extensions: `postgis` and `citext` (both in schema `extensions`), `pgtap` (for tests)
  - schema `private`
  - `private.my_household_ids() returns setof uuid`
  - `private.is_admin() returns boolean`
  - `private.set_updated_at()`, a trigger function
  - root scripts:
    - `db:start`: `supabase start -x studio,postgres-meta,logflare,vector,imgproxy,supavisor`
    - `db:reset`: `supabase db reset`
    - `db:test`: `supabase test db`
    - `db:types`: `supabase gen types --local > packages/db/src/database.types.ts`
  - test helpers `tests.create_supabase_user(text)`, `tests.get_supabase_uid(text)`, `tests.authenticate_as(text)`, `tests.clear_authentication()` and `tests.rls_enabled(text)`

- [ ] **Step 1: Start the stack**

Run: `docker info >/dev/null && pnpm exec supabase start -x studio,postgres-meta,logflare,vector,imgproxy,supavisor`
Expected: the API URL, the DB URL and the keys are printed. If Docker is missing, stop and report BLOCKED.

- [ ] **Step 2: Vendor the test helpers**

1. Download `https://raw.githubusercontent.com/usebasejump/supabase-test-helpers/main/supabase/migrations/20240106120000_supabase_test_helpers--0.0.6.sql` (if that path 404s, find the 0.0.6 SQL file in that repository).
2. Write `supabase/tests/database/000-setup-tests-hooks.sql` containing, in order:
   - `create extension if not exists pgtap with schema extensions;`
   - the downloaded helper SQL, unchanged
   - a trivial test so the file passes: `begin; select plan(1); select ok(true, 'test helpers installed'); select * from finish(); rollback;`

   Wrap the helper body so it's idempotent (`create schema if not exists tests`, `create or replace function`).
3. Add a header comment naming the source URL and version.

- [ ] **Step 3: Write the failing test**

`supabase/tests/database/001-foundation.test.sql`:
```sql
begin;
select plan(6);
select has_extension('postgis', 'postgis is installed');
select has_extension('citext', 'citext is installed');
select has_schema('private', 'private schema exists');
select function_privs_are('private', 'is_admin', '{}', 'anon', '{}', 'anon cannot execute private.is_admin');
select tests.authenticate_as_service_role();
select is((select private.is_admin()), false, 'service role JWT is not an admin user');
select schema_privs_are('private', 'anon', '{}', 'anon has no access to private');
select * from finish();
rollback;
```

If `tests.authenticate_as_service_role` doesn't exist in 0.0.6, use `set local role service_role;` instead.

- [ ] **Step 4: Run it to verify it fails**

Run: `pnpm exec supabase migration new foundation && pnpm exec supabase db reset && pnpm exec supabase test db`
Expected: FAIL, because the extensions and the `private` schema are missing.

- [ ] **Step 5: Write the migration**

```sql
-- Foundation: extensions, the private schema and shared helpers.
create extension if not exists postgis with schema extensions;
create extension if not exists citext with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- Households the current user belongs to. Security definer so membership policies don't recurse.
-- (household_members is created in the next migration; this function is created there.)

create or replace function private.is_admin() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;

create or replace function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
```

Add the root scripts to `package.json`:
- `"db:start": "supabase start -x studio,postgres-meta,logflare,vector,imgproxy,supavisor"`
- `"db:reset": "supabase db reset"`
- `"db:test": "supabase test db"`
- `"db:types": "supabase gen types --local > packages/db/src/database.types.ts"`

- [ ] **Step 6: Add the CI database job**

Append to `.github/workflows/ci.yml` under `jobs:`:
```yaml
  database:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:start
      - run: pnpm db:test
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm db:reset && pnpm db:test`
Expected: every test passes, the helpers file included.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations supabase/tests package.json .github/workflows/ci.yml
git commit -m "feat(db): foundation migration, vendored pgTAP helpers and CI database job"
```

---

### Task 2: Accounts, households and pets

**Files:**
- Create:
  - `supabase/migrations/<ts>_accounts.sql`
  - `supabase/tests/database/010-accounts.test.sql`

**Interfaces:**
- Consumes: `private.set_updated_at` (Task 1).
- Produces these tables:
  - `public.profiles(id, handle citext unique, display_name, timezone, country_code, age_confirmed_13_plus, preview_used_at, referral_code, created_at, updated_at)`
  - `public.privacy_zones(user_id, center geography(Point,4326), radius_m, updated_at)`
  - `public.households(id, name, created_by, created_at)`
  - `public.household_members(household_id, user_id, role, joined_at)`
  - `public.household_pets(id, household_id, animal, name, created_at)`
  - `public.household_vets(household_id, name, phone, updated_at)`
  - `public.push_tokens(user_id, token, platform, created_at, last_seen_at)`

  And this helper: `private.my_household_ids() returns setof uuid`.

- [ ] **Step 1: Write the failing test**

`supabase/tests/database/010-accounts.test.sql`:
```sql
begin;
select plan(16);

select tests.create_supabase_user('aoife');
select tests.create_supabase_user('siobhan');
select tests.create_supabase_user('outsider');

-- As the server would (functions run as service_role):
insert into public.profiles (id, handle, timezone, country_code, age_confirmed_13_plus)
values (tests.get_supabase_uid('aoife'), 'aoifegrows', 'Europe/Dublin', 'IE', true),
       (tests.get_supabase_uid('siobhan'), 'siobhanplants', 'Europe/Dublin', 'IE', true);
insert into public.households (id, name, created_by) values
  ('00000000-0000-0000-0000-0000000000a1', 'Our flat', tests.get_supabase_uid('aoife')),
  ('00000000-0000-0000-0000-0000000000a2', 'Mam''s house', tests.get_supabase_uid('siobhan'));
insert into public.household_members (household_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', tests.get_supabase_uid('aoife'), 'owner'),
  ('00000000-0000-0000-0000-0000000000a2', tests.get_supabase_uid('siobhan'), 'owner'),
  ('00000000-0000-0000-0000-0000000000a2', tests.get_supabase_uid('aoife'), 'member');
insert into public.household_pets (household_id, animal, name) values
  ('00000000-0000-0000-0000-0000000000a1', 'cat', 'Miso'),
  ('00000000-0000-0000-0000-0000000000a1', 'dog', 'Bran'),
  ('00000000-0000-0000-0000-0000000000a2', 'other', null);
insert into public.privacy_zones (user_id, center, radius_m)
values (tests.get_supabase_uid('aoife'), extensions.st_geogfromtext('POINT(-6.26 53.35)'), 2000);

select tests.rls_enabled('public');

select tests.authenticate_as('aoife');
select results_eq('select handle::text from public.profiles', $$values ('aoifegrows')$$, 'sees only own profile');
select results_eq('select count(*)::int from public.households', $$values (2)$$, 'member of two households sees both');
select results_eq('select count(*)::int from public.household_pets', $$values (3)$$, 'sees pets of both households');
select results_eq('select count(*)::int from public.privacy_zones', $$values (1)$$, 'sees own privacy zone');
select throws_ok($$insert into public.household_pets (household_id, animal) values ('00000000-0000-0000-0000-0000000000a1', 'cat')$$, '42501', null, 'cannot insert pets directly');
select throws_ok($$update public.profiles set handle = 'hacker'$$, '42501', null, 'cannot update profile directly');
select throws_ok($$delete from public.household_members$$, '42501', null, 'cannot delete memberships directly');

select tests.authenticate_as('outsider');
select is_empty('select * from public.households', 'outsider sees no households');
select is_empty('select * from public.household_pets', 'outsider sees no pets');
select is_empty('select * from public.privacy_zones', 'outsider sees no privacy zones');
select is_empty('select * from public.profiles', 'outsider sees no other profiles');

select tests.clear_authentication();
set local role anon;
select is_empty('select * from public.profiles', 'anon sees no profiles');
select throws_ok('select * from public.privacy_zones', '42501', null, 'anon has no grant on privacy zones');
reset role;

-- Leaving a household removes access immediately
delete from public.household_members where household_id = '00000000-0000-0000-0000-0000000000a2' and user_id = tests.get_supabase_uid('aoife');
select tests.authenticate_as('aoife');
select results_eq('select count(*)::int from public.households', $$values (1)$$, 'after leaving, only own household');

select tests.clear_authentication();
select col_is_unique('public', 'profiles', 'handle', 'handles are unique');
select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec supabase migration new accounts && pnpm db:reset && pnpm db:test`
Expected: FAIL, because the tables don't exist.

- [ ] **Step 3: Write the migration**

```sql
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  handle extensions.citext not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text check (char_length(display_name) <= 60),
  timezone text not null default 'UTC',
  country_code text not null default 'IE' check (country_code ~ '^[A-Z]{2}$'),
  age_confirmed_13_plus boolean not null default false,
  preview_used_at timestamptz,
  referral_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles for each row execute function private.set_updated_at();

create table public.privacy_zones (
  user_id uuid primary key references auth.users on delete cascade,
  center extensions.geography(Point, 4326) not null,
  radius_m integer not null check (radius_m between 200 and 30000),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id);

create table public.household_pets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  animal text not null check (animal in ('cat', 'dog', 'other')),
  name text check (char_length(name) between 1 and 30),
  created_at timestamptz not null default now()
);
create index household_pets_household_idx on public.household_pets (household_id);

create table public.household_vets (
  household_id uuid primary key references public.households on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  phone text not null check (phone ~ '^[0-9 +()-]{5,25}$'),
  updated_at timestamptz not null default now()
);

create table public.push_tokens (
  user_id uuid not null references auth.users on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, token)
);

create or replace function private.my_household_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select household_id from public.household_members where user_id = (select auth.uid())
$$;
revoke all on function private.my_household_ids() from public, anon;
grant execute on function private.my_household_ids() to authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.privacy_zones enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_pets enable row level security;
alter table public.household_vets enable row level security;
alter table public.push_tokens enable row level security;

grant select on public.profiles, public.privacy_zones, public.households, public.household_members,
  public.household_pets, public.household_vets, public.push_tokens to authenticated;
grant all on public.profiles, public.privacy_zones, public.households, public.household_members,
  public.household_pets, public.household_vets, public.push_tokens to service_role;

create policy "own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "own privacy zone" on public.privacy_zones for select to authenticated using (user_id = (select auth.uid()));
create policy "member households" on public.households for select to authenticated
  using (id in (select private.my_household_ids()));
create policy "member household members" on public.household_members for select to authenticated
  using (household_id in (select private.my_household_ids()));
create policy "member household pets" on public.household_pets for select to authenticated
  using (household_id in (select private.my_household_ids()));
create policy "member household vet" on public.household_vets for select to authenticated
  using (household_id in (select private.my_household_ids()));
create policy "own push tokens" on public.push_tokens for select to authenticated using (user_id = (select auth.uid()));
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm db:reset && pnpm db:test`
Expected: every test passes.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat(db): profiles, households, pets, vets and push tokens with RLS tests"
```

---

### Task 3: Species catalogue, toxicity and sensitive taxa

**Files:**
- Create:
  - `supabase/migrations/<ts>_species.sql`
  - `supabase/tests/database/020-species.test.sql`

**Interfaces:**
- Produces:
  - `public.species`, with columns `id`, `provider_entity_id` (unique), `gbif_id`, `scientific_name` (unique), `common_name`, `family`, `genus`, `slug` (unique), `image_url`, `image_credit`, `watering_min`, `watering_max`, `light`, `check_interval_days`, `warmth`, `is_houseplant`, `sensitive`, `rarity_tier`, `created_at` and `updated_at`
  - `public.species_toxicity(species_id, animal, severity, summary, symptoms, source_name, source_url, review_status, reviewed_by, reviewed_at)`
  - `private.sensitive_taxa(id, rank, taxon, reason, source)`
  - trigger `species_flag_sensitive`

- [ ] **Step 1: Write the failing test**

`supabase/tests/database/020-species.test.sql`:
```sql
begin;
select plan(9);
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec supabase migration new species && pnpm db:reset && pnpm db:test`
Expected: FAIL.

- [ ] **Step 3: Write the migration**

```sql
create table private.sensitive_taxa (
  id uuid primary key default gen_random_uuid(),
  rank text not null check (rank in ('species', 'genus', 'family')),
  taxon text not null,
  reason text not null,
  source text not null,
  unique (rank, taxon)
);

create table public.species (
  id uuid primary key default gen_random_uuid(),
  provider_entity_id text unique,
  gbif_id bigint,
  scientific_name text not null unique,
  common_name text not null,
  family text,
  genus text,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  image_url text,
  image_credit text,
  watering_min smallint check (watering_min between 1 and 3),
  watering_max smallint check (watering_max between 1 and 3),
  light text,
  check_interval_days smallint check (check_interval_days between 2 and 30),
  warmth text,
  is_houseplant boolean not null default false,
  sensitive boolean not null default false,
  rarity_tier text not null default 'common' check (rarity_tier in ('common', 'uncommon', 'rare', 'legendary')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger species_updated_at before update on public.species for each row execute function private.set_updated_at();

create or replace function private.flag_sensitive() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  norm_species text := lower(btrim(new.scientific_name));
  norm_genus text := lower(btrim(coalesce(new.genus, split_part(btrim(new.scientific_name), ' ', 1))));
  norm_family text := lower(btrim(coalesce(new.family, '')));
begin
  if exists (
    select 1 from private.sensitive_taxa t
    where (t.rank = 'species' and lower(btrim(t.taxon)) = norm_species)
       or (t.rank = 'genus' and lower(btrim(t.taxon)) = norm_genus)
       or (t.rank = 'family' and lower(btrim(t.taxon)) = norm_family)
  ) then
    new.sensitive := true;  -- never unset automatically; admins may set it manually too
  end if;
  return new;
end $$;
create trigger species_flag_sensitive before insert or update of scientific_name, genus, family
  on public.species for each row execute function private.flag_sensitive();

create table public.species_toxicity (
  species_id uuid not null references public.species on delete cascade,
  animal text not null check (animal in ('cat', 'dog')),
  severity text not null check (severity in ('unknown', 'none', 'mild', 'moderate', 'severe')),
  summary text,
  symptoms text,
  source_name text,
  source_url text,
  review_status text not null default 'seed_pending_vet' check (review_status in ('seed_pending_vet', 'reviewed')),
  reviewed_by text,
  reviewed_at timestamptz,
  primary key (species_id, animal),
  -- "No known toxicity" is never shown without a named source.
  constraint none_needs_source check (severity <> 'none' or (source_url is not null and source_name is not null))
);

alter table public.species enable row level security;
alter table public.species_toxicity enable row level security;
grant select on public.species, public.species_toxicity to anon, authenticated;
grant all on public.species, public.species_toxicity to service_role;
create policy "catalogue is public" on public.species for select to anon, authenticated using (true);
create policy "toxicity is public" on public.species_toxicity for select to anon, authenticated using (true);
revoke all on private.sensitive_taxa from public, anon, authenticated;
grant all on private.sensitive_taxa to service_role;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm db:reset && pnpm db:test`
Expected: every test passes.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat(db): species catalogue, curated toxicity and sensitive-taxa flagging"
```

---

### Task 4: Observations, precise locations, photos and plants

**Files:**
- Create:
  - `supabase/migrations/<ts>_observations_plants.sql`
  - `supabase/tests/database/030-observations.test.sql`
  - `supabase/tests/database/031-plants-care.test.sql`

**Interfaces:**
- Produces:
  - `public.observations`, with columns `id`, `user_id`, `household_id`, `created_at`, `device_time`, `capture_source`, `organs`, `health_requested`, `status`, `intent`, `place_type`, `species_id`, `confidence`, `suggestions`, `image_hash`, `integrity`, `public_cell_r5`, `points_status`, `no_points_reason`, `plant_id` and `confirmed_at`
  - `public.observation_locations(observation_id, user_id, point geography(Point,4326), accuracy_m, mocked, cell_r7, cell_r5)`
  - `public.observation_photos(id, observation_id, user_id, storage_path, organ, bytes, width, height, sha256, created_at)`
  - `private.observation_provider(observation_id, provider, access_token, raw, created_at)`
  - `public.plants`, with columns `id`, `household_id`, `species_id`, `observation_id`, `nickname`, `room`, `indoor`, `pot_size_cm`, `pot_material`, `drainage`, `light`, `status`, `status_at`, `death_cause`, `parent_plant_id`, `source`, `label_code`, `photo_path`, `care_state`, `created_by`, `created_at` and `updated_at`
  - `public.care_tasks(id, plant_id, household_id, kind, due_on, status, created_at, completed_at, completed_by)`
  - `public.care_events(id, plant_id, household_id, user_id, kind, soil_dry, leaf_states, photo_path, client_id unique, occurred_at, created_at)`
  - `public.diagnoses(id, plant_id, observation_id, user_id, condition_name, probability, details, effect, applied_at, created_at)`
  - storage bucket `plant-photos` with own-folder policies

- [ ] **Step 1: Write the failing tests**

`supabase/tests/database/030-observations.test.sql`:
```sql
begin;
select plan(10);
select tests.create_supabase_user('aoife');
select tests.create_supabase_user('outsider');
insert into public.observations (id, user_id, device_time, capture_source)
values ('00000000-0000-0000-0000-00000000b001', tests.get_supabase_uid('aoife'), now(), 'camera');
insert into public.observation_locations (observation_id, user_id, point, accuracy_m)
values ('00000000-0000-0000-0000-00000000b001', tests.get_supabase_uid('aoife'), extensions.st_geogfromtext('POINT(-6.26 53.35)'), 8);
insert into public.observation_photos (observation_id, user_id, storage_path, organ, sha256)
values ('00000000-0000-0000-0000-00000000b001', tests.get_supabase_uid('aoife'),
  tests.get_supabase_uid('aoife')::text || '/00000000-0000-0000-0000-00000000b001/1.jpg', 'leaf', 'abc');

select tests.authenticate_as('aoife');
select results_eq('select count(*)::int from public.observations', $$values (1)$$, 'owner sees own observation');
select results_eq('select count(*)::int from public.observation_locations', $$values (1)$$, 'owner sees own precise point');
select throws_ok($$insert into public.observations (user_id, device_time, capture_source) values ((select auth.uid()), now(), 'camera')$$, '42501', null, 'clients cannot create observations');
select throws_ok($$update public.observations set points_status = 'awarded'$$, '42501', null, 'clients cannot award themselves points');
select throws_ok('select * from private.observation_provider', '42501', null, 'clients cannot read provider tokens');

select tests.authenticate_as('outsider');
select is_empty('select * from public.observations', 'others cannot see the observation');
select is_empty('select * from public.observation_locations', 'others never see precise points');
select is_empty('select * from public.observation_photos', 'others cannot see photo rows');

select tests.clear_authentication();
set local role anon;
select throws_ok('select * from public.observation_locations', '42501', null, 'anon has no grant on precise points');
reset role;

select is(
  (select count(*)::int from storage.buckets where id = 'plant-photos' and public = false),
  1, 'plant-photos bucket exists and is private');
select * from finish();
rollback;
```

`supabase/tests/database/031-plants-care.test.sql`:
```sql
begin;
select plan(8);
select tests.create_supabase_user('aoife');
select tests.create_supabase_user('partner');
select tests.create_supabase_user('outsider');
insert into public.households (id, name) values ('00000000-0000-0000-0000-0000000000a1', 'Our flat');
insert into public.household_members (household_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', tests.get_supabase_uid('aoife'), 'owner'),
  ('00000000-0000-0000-0000-0000000000a1', tests.get_supabase_uid('partner'), 'member');
insert into public.species (id, scientific_name, common_name, slug)
values ('00000000-0000-0000-0000-00000000c001', 'Monstera deliciosa', 'Swiss cheese plant', 'swiss-cheese-plant');
insert into public.plants (id, household_id, species_id, nickname, room, source)
values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000c001', 'Monty', 'Living room', 'scan');
insert into public.care_tasks (plant_id, household_id, kind, due_on, status)
values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1', 'check', current_date, 'due');
insert into public.care_events (plant_id, household_id, user_id, kind, soil_dry, client_id, occurred_at)
values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1', tests.get_supabase_uid('aoife'), 'checkin', false, '00000000-0000-0000-0000-00000000e001', now());

select tests.authenticate_as('partner');
select results_eq('select nickname from public.plants', $$values ('Monty')$$, 'household member sees the plant');
select results_eq('select count(*)::int from public.care_tasks', $$values (1)$$, 'household member sees tasks');
select results_eq('select count(*)::int from public.care_events', $$values (1)$$, 'household member sees events');
select throws_ok($$update public.plants set nickname = 'X'$$, '42501', null, 'clients cannot edit plants directly');
select throws_ok($$insert into public.care_events (plant_id, household_id, kind, occurred_at) values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1', 'checkin', now())$$, '42501', null, 'clients cannot write events directly');

select tests.authenticate_as('outsider');
select is_empty('select * from public.plants', 'outsiders see no plants');
select is_empty('select * from public.care_tasks', 'outsiders see no tasks');

select tests.clear_authentication();
select throws_ok($$insert into public.care_events (plant_id, household_id, kind, client_id, occurred_at) values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1', 'checkin', '00000000-0000-0000-0000-00000000e001', now())$$, '23505', null, 'client_id makes check-ins idempotent');
select * from finish();
rollback;
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec supabase migration new observations_plants && pnpm db:reset && pnpm db:test`
Expected: FAIL.

- [ ] **Step 3: Write the migration**

```sql
create table public.plants (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  species_id uuid not null references public.species,
  observation_id uuid,
  nickname text not null check (char_length(nickname) between 1 and 40),
  room text check (char_length(room) <= 40),
  indoor boolean not null default true,
  pot_size_cm smallint check (pot_size_cm between 4 and 200),
  pot_material text not null default 'unknown' check (pot_material in ('plastic', 'terracotta', 'ceramic', 'unknown')),
  drainage text not null default 'unknown' check (drainage in ('yes', 'no', 'unknown')),
  light text not null default 'unknown' check (light in ('bright', 'medium', 'low', 'unknown')),
  status text not null default 'alive' check (status in ('alive', 'dead', 'given_away')),
  status_at timestamptz,
  death_cause text check (char_length(death_cause) <= 80),
  parent_plant_id uuid references public.plants on delete set null,
  source text not null check (source in ('scan', 'label_qr', 'gift', 'manual')),
  label_code text,
  photo_path text,
  care_state jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index plants_household_idx on public.plants (household_id);
create trigger plants_updated_at before update on public.plants for each row execute function private.set_updated_at();

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  household_id uuid references public.households on delete set null,
  created_at timestamptz not null default now(),
  device_time timestamptz not null,
  capture_source text not null check (capture_source in ('camera', 'gallery')),
  organs text[] not null default '{}',
  health_requested boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'identified', 'not_a_plant', 'failed', 'confirmed', 'discarded')),
  intent text check (intent in ('add_plant', 'log_find')),
  place_type text check (place_type in ('shop', 'garden_park', 'wild', 'home')),
  species_id uuid references public.species,
  confidence numeric(5, 4) check (confidence between 0 and 1),
  suggestions jsonb not null default '[]'::jsonb,
  image_hash text,
  integrity jsonb not null default '{}'::jsonb,
  public_cell_r5 bigint,
  points_status text not null default 'none' check (points_status in ('none', 'processing', 'awarded', 'held', 'no_points')),
  no_points_reason text,
  plant_id uuid references public.plants on delete set null,
  confirmed_at timestamptz
);
create index observations_user_created_idx on public.observations (user_id, created_at desc);
create index observations_user_species_idx on public.observations (user_id, species_id);
create index observations_hash_idx on public.observations (user_id, image_hash);
alter table public.plants add constraint plants_observation_fk foreign key (observation_id) references public.observations on delete set null;

create table public.observation_locations (
  observation_id uuid primary key references public.observations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  point extensions.geography(Point, 4326) not null,
  accuracy_m real check (accuracy_m >= 0),
  mocked boolean not null default false,
  cell_r7 bigint,
  cell_r5 bigint
);
create index observation_locations_user_idx on public.observation_locations (user_id);
create index observation_locations_point_idx on public.observation_locations using gist (point);

create table public.observation_photos (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.observations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  storage_path text not null unique,
  organ text check (organ in ('leaf', 'flower', 'whole')),
  bytes integer,
  width integer,
  height integer,
  sha256 text not null,
  created_at timestamptz not null default now()
);
create index observation_photos_obs_idx on public.observation_photos (observation_id);
create index observation_photos_user_idx on public.observation_photos (user_id);

create table private.observation_provider (
  observation_id uuid primary key references public.observations on delete cascade,
  provider text not null,
  access_token text,
  raw jsonb,
  created_at timestamptz not null default now()
);

create table public.care_tasks (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants on delete cascade,
  household_id uuid not null references public.households on delete cascade,
  kind text not null check (kind in ('check', 'water')),
  due_on date not null,
  status text not null default 'due' check (status in ('due', 'done', 'skipped', 'superseded')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references auth.users on delete set null
);
create index care_tasks_household_due_idx on public.care_tasks (household_id, status, due_on);
create index care_tasks_plant_idx on public.care_tasks (plant_id);

create table public.care_events (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants on delete cascade,
  household_id uuid not null references public.households on delete cascade,
  user_id uuid references auth.users on delete set null,
  kind text not null check (kind in ('checkin', 'water', 'status', 'diagnosis_applied', 'setup')),
  soil_dry boolean,
  leaf_states text[] not null default '{}',
  photo_path text,
  client_id uuid unique,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index care_events_plant_idx on public.care_events (plant_id, occurred_at desc);
create index care_events_household_idx on public.care_events (household_id);
create index care_events_user_idx on public.care_events (user_id, occurred_at desc);

create table public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants on delete cascade,
  observation_id uuid references public.observations on delete set null,
  user_id uuid references auth.users on delete set null,
  condition_name text not null,
  probability numeric(5, 4) not null check (probability between 0 and 1),
  details jsonb not null default '{}'::jsonb,
  effect jsonb,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);
create index diagnoses_plant_idx on public.diagnoses (plant_id);

alter table public.observations enable row level security;
alter table public.observation_locations enable row level security;
alter table public.observation_photos enable row level security;
alter table public.plants enable row level security;
alter table public.care_tasks enable row level security;
alter table public.care_events enable row level security;
alter table public.diagnoses enable row level security;

grant select on public.observations, public.observation_locations, public.observation_photos,
  public.plants, public.care_tasks, public.care_events, public.diagnoses to authenticated;
grant all on public.observations, public.observation_locations, public.observation_photos,
  public.plants, public.care_tasks, public.care_events, public.diagnoses to service_role;
revoke all on private.observation_provider from public, anon, authenticated;
grant all on private.observation_provider to service_role;

create policy "own observations" on public.observations for select to authenticated using (user_id = (select auth.uid()));
create policy "own precise points" on public.observation_locations for select to authenticated using (user_id = (select auth.uid()));
create policy "own photo rows" on public.observation_photos for select to authenticated using (user_id = (select auth.uid()));
create policy "household plants" on public.plants for select to authenticated using (household_id in (select private.my_household_ids()));
create policy "household tasks" on public.care_tasks for select to authenticated using (household_id in (select private.my_household_ids()));
create policy "household events" on public.care_events for select to authenticated using (household_id in (select private.my_household_ids()));
create policy "household diagnoses" on public.diagnoses for select to authenticated
  using (plant_id in (select id from public.plants where household_id in (select private.my_household_ids())));

-- Private photo bucket: users may upload into and read only their own folder (uid/…).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plant-photos', 'plant-photos', false, 10485760, array['image/jpeg'])
on conflict (id) do nothing;
create policy "own folder read" on storage.objects for select to authenticated
  using (bucket_id = 'plant-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own folder upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'plant-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'plant-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm db:reset && pnpm db:test`
Expected: every test passes.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat(db): observations with owner-only precise points, photo bucket, plants and care tables"
```

---

### Task 5: Plantdex, entitlements, quotas and labels

**Files:**
- Create:
  - `supabase/migrations/<ts>_collection_money_labels.sql`
  - `supabase/tests/database/040-quotas.test.sql`
  - `supabase/tests/database/041-labels-plantdex.test.sql`

**Interfaces:**
- Produces:
  - `public.plantdex_entries(user_id, species_id, category, first_observation_id, first_found_at, finds_count)`
  - `public.entitlements(user_id, source, product, active_until, store, product_id, environment, updated_at)`
  - `public.usage_counters(user_id, kind, period_key, used)`
  - `private.is_premium(uid uuid) returns boolean`
  - `private.reserve_usage(uid uuid, kind text, period_key text, lim integer) returns boolean`
  - `private.release_usage(uid uuid, kind text, period_key text) returns void`
  - `public.partners(id, name, kind, contact_email, created_at)`
  - `public.qr_codes(code, partner_id, species_id, cultivar, status, created_at)`
  - `public.qr_scans(id, code, event, user_id, platform, created_at)`
  - `public.public_label(p_code text) returns jsonb`, granted to anon and authenticated; returns null for unknown or retired codes

- [ ] **Step 1: Write the failing tests**

`supabase/tests/database/040-quotas.test.sql`:
```sql
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
```

`supabase/tests/database/041-labels-plantdex.test.sql`:
```sql
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
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec supabase migration new collection_money_labels && pnpm db:reset && pnpm db:test`
Expected: FAIL.

- [ ] **Step 3: Write the migration**

```sql
create table public.plantdex_entries (
  user_id uuid not null references auth.users on delete cascade,
  species_id uuid not null references public.species,
  category text not null check (category in ('houseplant', 'wild')),
  first_observation_id uuid references public.observations on delete set null,
  first_found_at timestamptz not null,
  finds_count integer not null default 1 check (finds_count >= 1),
  primary key (user_id, species_id)
);

create table public.entitlements (
  user_id uuid not null references auth.users on delete cascade,
  source text not null check (source in ('preview', 'store')),
  product text not null default 'premium',
  active_until timestamptz not null,
  store text,
  product_id text,
  environment text check (environment in ('SANDBOX', 'PRODUCTION')),
  updated_at timestamptz not null default now(),
  primary key (user_id, source)
);

create table public.usage_counters (
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('identification', 'diagnosis', 'scoring_scan')),
  period_key text not null,
  used integer not null default 0 check (used >= 0),
  primary key (user_id, kind, period_key)
);

create or replace function private.is_premium(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.entitlements e where e.user_id = uid and e.active_until > now())
$$;

-- Atomic: increments only while used < lim, in one statement, so retries and parallel calls can't overspend.
create or replace function private.reserve_usage(uid uuid, kind text, period_key text, lim integer) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if lim <= 0 then
    return false;
  end if;
  insert into public.usage_counters as u (user_id, kind, period_key, used)
  values (uid, kind, period_key, 1)
  on conflict on constraint usage_counters_pkey do update set used = u.used + 1 where u.used < lim;
  return found;
end $$;

create or replace function private.release_usage(uid uuid, kind text, period_key text) returns void
language sql security definer set search_path = '' as $$
  update public.usage_counters u set used = u.used - 1
  where u.user_id = uid and u.kind = release_usage.kind and u.period_key = release_usage.period_key and u.used > 0
$$;

revoke all on function private.is_premium(uuid), private.reserve_usage(uuid, text, text, integer),
  private.release_usage(uuid, text, text) from public, anon, authenticated;
grant execute on function private.is_premium(uuid), private.reserve_usage(uuid, text, text, integer),
  private.release_usage(uuid, text, text) to service_role;

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('grower', 'garden_centre')),
  contact_email text,
  created_at timestamptz not null default now()
);

create table public.qr_codes (
  code text primary key check (code ~ '^[A-Z0-9-]{4,32}$'),
  partner_id uuid not null references public.partners on delete cascade,
  species_id uuid not null references public.species,
  cultivar text,
  status text not null default 'active' check (status in ('active', 'retired')),
  created_at timestamptz not null default now()
);

create table public.qr_scans (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.qr_codes on delete cascade,
  event text not null check (event in ('page_view', 'app_open', 'store_click', 'adoption')),
  user_id uuid references auth.users on delete set null,
  platform text check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now()
);
create index qr_scans_code_idx on public.qr_scans (code, created_at);

alter table public.plantdex_entries enable row level security;
alter table public.entitlements enable row level security;
alter table public.usage_counters enable row level security;
alter table public.partners enable row level security;
alter table public.qr_codes enable row level security;
alter table public.qr_scans enable row level security;

grant select on public.plantdex_entries, public.entitlements, public.usage_counters to authenticated;
grant all on public.plantdex_entries, public.entitlements, public.usage_counters,
  public.partners, public.qr_codes, public.qr_scans to service_role;
create policy "own plantdex" on public.plantdex_entries for select to authenticated using (user_id = (select auth.uid()));
create policy "own entitlements" on public.entitlements for select to authenticated using (user_id = (select auth.uid()));
create policy "own usage" on public.usage_counters for select to authenticated using (user_id = (select auth.uid()));

-- Public label lookup: only active codes, only public fields.
create or replace function public.public_label(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'code', q.code,
    'growerName', p.name,
    'cultivar', q.cultivar,
    'species', jsonb_build_object('id', s.id, 'slug', s.slug, 'commonName', s.common_name,
      'scientificName', s.scientific_name, 'imageUrl', s.image_url, 'light', s.light,
      'checkIntervalDays', s.check_interval_days, 'warmth', s.warmth),
    'toxicity', coalesce((select jsonb_agg(jsonb_build_object('animal', t.animal, 'severity', t.severity,
      'summary', t.summary, 'symptoms', t.symptoms, 'sourceName', t.source_name, 'sourceUrl', t.source_url))
      from public.species_toxicity t where t.species_id = s.id), '[]'::jsonb))
  from public.qr_codes q
  join public.partners p on p.id = q.partner_id
  join public.species s on s.id = q.species_id
  where q.code = upper(btrim(p_code)) and q.status = 'active'
$$;
revoke all on function public.public_label(text) from public;
grant execute on function public.public_label(text) to anon, authenticated, service_role;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm db:reset && pnpm db:test`
Expected: every test passes.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat(db): Plantdex, entitlements, atomic quota reservation and public label lookup"
```

---

### Task 6: Account cascade test and the "no precise coordinates" guard

**Files:**
- Create:
  - `supabase/tests/database/050-cascade.test.sql`
  - `supabase/tests/database/051-no-coordinates-leak.test.sql`

**Interfaces:**
- Consumes: every table from Tasks 2–5.
- Produces: regression guards that later phases' migrations must keep passing.

- [ ] **Step 1: Write the tests**

`supabase/tests/database/050-cascade.test.sql`:
```sql
begin;
select plan(9);
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
```

`supabase/tests/database/051-no-coordinates-leak.test.sql`:
```sql
begin;
select plan(2);
-- No function callable by anon or authenticated may return or mention geography/geometry, except functions in schemas they cannot reach.
select is_empty($$
  select p.oid::regprocedure::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
    and (pg_get_function_result(p.oid) ~* 'geograph|geometr' or pg_get_functiondef(p.oid) ~* 'observation_locations|privacy_zones')
$$, 'no client-callable public function returns or reads precise locations');
-- Only observation_locations and privacy_zones may hold geography columns in public.
select results_eq($$
  select string_agg(table_name || '.' || column_name, ',' order by table_name)
  from information_schema.columns where table_schema = 'public' and udt_name in ('geography', 'geometry')
$$, $$values ('observation_locations.point,privacy_zones.center')$$, 'precise points live only in owner-only tables');
select * from finish();
rollback;
```

- [ ] **Step 2: Run them**

Run: `pnpm db:reset && pnpm db:test`
Expected: every test passes. If one fails, a migration from Tasks 2–5 is wrong: fix it in a **new** migration, never by editing a committed one.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests
git commit -m "test(db): account deletion cascade and precise-location leak guards"
```

---

### Task 7: Seed data and the generated types package

**Files:**
- Create:
  - `supabase/seed.sql` (generated by the script below; commit the output)
  - `supabase/seed/catalogue.ts`: the source data
  - `supabase/seed/build.ts`: writes `seed.sql` from `catalogue.ts`
  - `supabase/tests/database/060-seed.test.sql`
  - `packages/db/package.json`
  - `packages/db/src/database.types.ts`, generated
  - `packages/db/src/index.ts`
- Modify: root `package.json`, adding `"db:seed": "deno run --allow-write --allow-read supabase/seed/build.ts"`

**Interfaces:**
- Produces:
  - seed rows: species and toxicity for the plants in the research doc's ASPCA table, plus the UX brief's sample plants; sets "Irish hedgerow" and "Easy-care houseplants" (as data for Phase 4); sensitive taxa; the partner "Greenhouse Growers" with code `PL-0001` for peace lily
  - `@tendril/db`, exporting `type Database`

The catalogue data to encode in `supabase/seed/catalogue.ts`:
- Use the slugs and names of the `aoife` fixture species, plus snake plant (*Dracaena trifasciata*), golden pothos (*Epipremnum aureum*), aloe (*Aloe vera*), jade plant (*Crassula ovata*), ZZ plant (*Zamioculcas zamiifolia*), parlor palm (*Chamaedorea elegans*), calathea (*Goeppertia*), African violet (*Saintpaulia*), English ivy (*Hedera helix*), heartleaf philodendron (*Philodendron hederaceum*), dieffenbachia (*Dieffenbachia*), sago palm (*Cycas revoluta*), poinsettia (*Euphorbia pulcherrima*), Christmas cactus (*Schlumbergera*), moth orchid (*Phalaenopsis*), rubber plant (*Ficus elastica*), fiddle leaf fig (*Ficus lyrata*), blackthorn (*Prunus spinosa*), dog rose (*Rosa canina*) and honeysuckle (*Lonicera periclymenum*).
- **Toxicity**, all rows with `review_status 'seed_pending_vet'`, source "ASPCA" and the research doc's URL pattern:
  - none for cats and dogs: spider plant, Boston fern, African violet, parlor palm, calathea, Christmas cactus, moth orchid, hawthorn
  - moderate (insoluble calcium oxalates): peace lily, Swiss cheese plant, golden pothos, heartleaf philodendron, dieffenbachia. The peace lily summaries are exactly those in the fixture.
  - mild: snake plant, aloe, jade plant, English ivy, poinsettia, primrose
  - severe: sago palm and foxglove (both animals); Easter lily for cats only, with dogs none
  - no rows, so Unknown: ZZ plant, rubber plant, fiddle leaf fig, bluebell, gorse, blackthorn, dog rose, honeysuckle, flamingo flower, early purple orchid
- **Sets:**
  - Irish hedgerow: foxglove, gorse, primrose, hawthorn, bluebell, blackthorn, dog rose, honeysuckle
  - Easy-care houseplants: spider plant, peace lily, Swiss cheese plant, snake plant, ZZ plant, golden pothos

  Phase 4 creates the set tables, so in this phase put the set data in `catalogue.ts` only, exported for Phase 4.
- **Sensitive taxa:** family Orchidaceae and genus Cypripedium.
- **Care fields:**
  - houseplants: `is_houseplant = true`, `watering_min`/`watering_max` as average-based values (spider plant 2/2, peace lily 2/3, Swiss cheese plant 2/2, snake plant 1/1, ZZ plant 1/1, aloe 1/1, jade plant 1/1, golden pothos 2/2, others 2/2), and `light` text from the fixture's care lines
  - wild plants: `is_houseplant = false`, rarity foxglove uncommon, bluebell rare, early purple orchid rare, others common

- [ ] **Step 1: Write the failing seed test**

`supabase/tests/database/060-seed.test.sql`:
```sql
begin;
select plan(7);
select cmp_ok((select count(*)::int from public.species), '>=', 30, 'catalogue seeded');
select is((select severity from public.species_toxicity t join public.species s on s.id = t.species_id where s.slug = 'easter-lily' and t.animal = 'cat'), 'severe', 'Easter lily is severe for cats');
select is((select severity from public.species_toxicity t join public.species s on s.id = t.species_id where s.slug = 'easter-lily' and t.animal = 'dog'), 'none', 'Easter lily has no known toxicity for dogs');
select is_empty($$select 1 from public.species_toxicity t join public.species s on s.id = t.species_id where s.slug in ('zz-plant', 'bluebell', 'gorse', 'swiss-cheese-plant') and t.severity = 'none'$$, 'plants without a reviewed source are never no-known-toxicity');
select is((select sensitive from public.species where slug = 'early-purple-orchid'), true, 'orchids are sensitive');
select is((public.public_label('PL-0001') -> 'species' ->> 'slug'), 'peace-lily', 'demo label resolves');
select is_empty($$select 1 from public.species_toxicity where review_status <> 'seed_pending_vet'$$, 'every seeded verdict awaits vet review');
select * from finish();
rollback;
```

Swiss cheese plant is toxic per ASPCA (moderate), so the test's "never none" check holds for it.

- [ ] **Step 2: Write `catalogue.ts` and `build.ts`, then generate the seed**

`build.ts`:
- imports the data from `catalogue.ts`
- writes `supabase/seed.sql` with `insert … on conflict do nothing` statements, in this order: sensitive taxa, species, toxicity, partner, label code
- uses dollar-quoting (`$t$…$t$`) for every text value, so apostrophes are safe

Run: `pnpm db:seed && pnpm db:reset && pnpm db:test`
Expected: every test passes, including `060-seed`.

- [ ] **Step 3: Generate the types package**

`packages/db/package.json`:
```json
{ "name": "@tendril/db", "version": "0.0.0", "private": true, "type": "module", "main": "./src/index.ts", "types": "./src/index.ts" }
```

`packages/db/src/index.ts`:
```ts
export type { Database, Json } from './database.types.ts';
```

Run: `pnpm db:types && head -5 packages/db/src/database.types.ts`
Expected: the generated `export type Json = …` and `export type Database = …` appear.

- [ ] **Step 4: Run the whole check**

Run: `pnpm verify && pnpm db:test`
Expected: everything passes.

- [ ] **Step 5: Commit**

```bash
git add supabase packages/db package.json pnpm-lock.yaml
git commit -m "feat(db): seed catalogue with pending-vet-review toxicity and generated DB types"
```
