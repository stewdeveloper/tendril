-- Accounts, households and pets.
-- All writes to these tables go through server-side functions (service_role), so authenticated gets
-- select-only grants plus RLS select policies; there are deliberately no insert/update/delete policies.

-- Hardening carried over from the foundation migration: the trigger function does not need to be
-- callable by clients. Triggers still fire after the revoke.
revoke all on function private.set_updated_at() from public, anon;

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

-- Households the current user belongs to. security definer so household policies can consult
-- household_members without recursing through that table's own RLS; stable so policies can wrap it in
-- (select ...) and have it evaluated once per statement.
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

-- Supabase's default privileges grant ALL on every new public table to anon and authenticated. Strip
-- that first so grants are explicit: anon gets nothing, authenticated gets select only (RLS alone would
-- turn forbidden writes into silent no-ops rather than permission errors).
revoke all on public.profiles, public.privacy_zones, public.households, public.household_members,
  public.household_pets, public.household_vets, public.push_tokens from anon, authenticated;
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
