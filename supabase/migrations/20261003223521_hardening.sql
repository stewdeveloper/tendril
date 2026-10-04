-- Hardening: closed-by-default privileges, lowercase handles and the missing updated_at triggers.

-- Supabase's default privileges grant ALL on every new public table and sequence, and EXECUTE on every new
-- function, to anon and authenticated. For tables that quietly turns a denied write into an RLS no-op
-- instead of a permission error. Flip the defaults for objects created by postgres (the migration role) so
-- new objects start with no client access; each migration then grants exactly what it intends.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
-- Postgres grants EXECUTE on new functions to PUBLIC by built-in default. A per-schema revoke can only
-- remove entries that are themselves per-schema, so it cannot touch that one; it needs the global form.
-- Consequence: functions postgres creates in any schema start with no PUBLIC execute, which is what the
-- private-schema functions already ask for with explicit revokes.
alter default privileges for role postgres revoke execute on functions from public;

-- handle is citext, whose ~ operator ignores case, so the original check let 'AoifeGrows' through.
-- Compare as text instead.
alter table public.profiles
  drop constraint profiles_handle_check,
  add constraint profiles_handle_format check (handle::text ~ '^[a-z0-9_]{3,20}$');

create trigger privacy_zones_updated_at before update on public.privacy_zones
  for each row execute function private.set_updated_at();
create trigger household_vets_updated_at before update on public.household_vets
  for each row execute function private.set_updated_at();
