-- Foundation: extensions, the private schema and shared helpers.
create extension if not exists postgis with schema extensions;
create extension if not exists citext with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- private.my_household_ids() (households the current user belongs to) is created in the
-- households migration, because it is a security definer function over household_members.

-- True when the caller's JWT carries app_metadata.role = 'admin'. Reads the JWT only, so it needs no
-- security definer; stable so policies can wrap it in (select ...) and have it evaluated once.
create or replace function private.is_admin() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;

-- Generic before-update trigger: keeps updated_at current. Attach per table.
create or replace function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
