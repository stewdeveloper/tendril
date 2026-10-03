-- Review follow-ups: quota guard against a null limit, review status on the public label, deterministic
-- toxicity order, and bucket-prefixed storage policy names.

-- A null limit used to slip past `lim <= 0` (the comparison is null, so the guard did not fire) and let the first
-- reservation through. Treat null like zero: no limit configured means no credit.
create or replace function private.reserve_usage(uid uuid, kind text, period_key text, lim integer) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if lim is null or lim <= 0 then
    return false;
  end if;
  insert into public.usage_counters as u (user_id, kind, period_key, used)
  values (uid, kind, period_key, 1)
  on conflict on constraint usage_counters_pkey do update set used = u.used + 1 where u.used < lim;
  return found;
end $$;

-- create or replace keeps the owner and ACL; re-assert the grants anyway so this migration stands on its own.
revoke all on function private.reserve_usage(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function private.reserve_usage(uuid, text, text, integer) to service_role;

-- Toxicity entries now come back in a stable order (by animal) and say whether a vet has reviewed them, so the
-- label page can show seed data as provisional. Everything else is unchanged and still allow-listed field by field.
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
      'summary', t.summary, 'symptoms', t.symptoms, 'sourceName', t.source_name, 'sourceUrl', t.source_url,
      'reviewStatus', t.review_status) order by t.animal)
      from public.species_toxicity t where t.species_id = s.id), '[]'::jsonb))
  from public.qr_codes q
  join public.partners p on p.id = q.partner_id
  join public.species s on s.id = q.species_id
  where q.code = upper(btrim(p_code)) and q.status = 'active'
$$;
revoke all on function public.public_label(text) from public;
grant execute on function public.public_label(text) to anon, authenticated, service_role;

-- storage.objects is shared by every bucket, so policy names carry the bucket they belong to. ALTER POLICY ... RENAME
-- needs ownership of storage.objects (supabase_storage_admin) and the migration role is not a member, whereas
-- creating and dropping policies is allowed, so the three are recreated with identical predicates under the new names.
-- Both halves run in this migration's transaction, so there is no window without a policy.
drop policy "own folder read" on storage.objects;
drop policy "own folder upload" on storage.objects;
drop policy "own folder delete" on storage.objects;
create policy "plant-photos: own folder read" on storage.objects for select to authenticated
  using (bucket_id = 'plant-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "plant-photos: own folder upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'plant-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "plant-photos: own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'plant-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
