-- Plantdex, entitlements, atomic quota counters, partner QR labels and the public label lookup.

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
