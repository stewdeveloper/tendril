-- Species catalogue, curated pet toxicity and sensitive-taxa flagging.
-- The catalogue is public reference data (web species pages read it as anon); only the server writes it.

-- Taxa whose precise locations must never be shown (poaching risk, e.g. orchids). Server-only.
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
revoke all on function private.flag_sensitive() from public, anon, authenticated;
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
