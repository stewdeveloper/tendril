-- Observations (scan sessions), owner-only precise locations, photo rows, the private photo bucket,
-- plants and the care tables.
-- Clients may only read. Every write goes through an Edge Function running as service_role, so there are
-- deliberately no insert/update/delete grants or policies for anon or authenticated here.

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

-- The precise point is stored apart from the observation so it can be locked to its owner while the
-- (coarse) public cell on the observation can be shared. Nobody but the owner and the server ever sees it.
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

-- Raw identification-provider responses and access tokens. Server-only.
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
