-- Final-review fixes for Phase 2A.

-- 1. Sensitive-taxon matching lives in one predicate, used by the per-species trigger and the per-taxon re-flagging.
create function private.species_is_sensitive(p_scientific_name text, p_genus text, p_family text) returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1 from private.sensitive_taxa t
    where (t.rank = 'species' and lower(btrim(t.taxon)) = lower(btrim(p_scientific_name)))
       or (t.rank = 'genus' and lower(btrim(t.taxon)) = lower(btrim(coalesce(p_genus, split_part(btrim(p_scientific_name), ' ', 1)))))
       or (t.rank = 'family' and lower(btrim(t.taxon)) = lower(btrim(coalesce(p_family, ''))))
  )
$$;
revoke all on function private.species_is_sensitive(text, text, text) from public, anon, authenticated;

create or replace function private.flag_sensitive() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.species_is_sensitive(new.scientific_name, new.genus, new.family) then
    new.sensitive := true;  -- never unset by a species write; taxon changes re-flag below
  end if;
  return new;
end $$;

-- Adding or removing a sensitive taxon re-flags existing species, in both directions. This overrides a manual flag on
-- a species that no taxon covers, which is the intent: the taxa list is the source of truth for the flag.
create function private.reflag_species() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.species s
  set sensitive = private.species_is_sensitive(s.scientific_name, s.genus, s.family)
  where s.sensitive is distinct from private.species_is_sensitive(s.scientific_name, s.genus, s.family);
  return null;
end $$;
revoke all on function private.reflag_species() from public, anon, authenticated;
create trigger sensitive_taxa_reflag after insert or update or delete on private.sensitive_taxa
  for each statement execute function private.reflag_species();

-- One taxon per rank, however it is cased or padded.
alter table private.sensitive_taxa drop constraint sensitive_taxa_rank_taxon_key;
create unique index sensitive_taxa_rank_taxon_key on private.sensitive_taxa (rank, lower(btrim(taxon)));

-- 2. Spec section 7: the only direct client write is uploading photos into the user's own folder. A delete policy would
-- let a client swap stored evidence after scoring; the server deletes with the service role.
drop policy "plant-photos: own folder delete" on storage.objects;

-- 3. Toxicity integrity.
alter table public.species_toxicity drop constraint none_needs_source;
alter table public.species_toxicity add constraint none_needs_source check (
  severity <> 'none'
  or (source_url is not null and source_name is not null and btrim(source_url) <> '' and btrim(source_name) <> ''));
alter table public.species_toxicity add constraint reviewed_needs_reviewer check (
  review_status <> 'reviewed' or (reviewed_by is not null and reviewed_at is not null));

-- 4. A push token belongs to one device, so one user at a time; server registration upserts and reassigns the owner.
create unique index push_tokens_token_key on public.push_tokens (token);

-- 5. Value checks (core Organ and LeafState types).
alter table public.observations add constraint observations_organs_valid
  check (organs <@ array['leaf', 'flower', 'whole']::text[]);
alter table public.care_events add constraint care_events_leaf_states_valid
  check (leaf_states <@ array['healthy', 'yellowing', 'drooping', 'brown_tips', 'spots']::text[]);
