-- The public label's species now carries its rarity tier and sensitivity flag, so the label page can build a full
-- SpeciesRef without a second query. Everything else is unchanged and still allow-listed field by field.
create or replace function public.public_label(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'code', q.code,
    'growerName', p.name,
    'cultivar', q.cultivar,
    'species', jsonb_build_object('id', s.id, 'slug', s.slug, 'commonName', s.common_name,
      'scientificName', s.scientific_name, 'imageUrl', s.image_url, 'light', s.light,
      'checkIntervalDays', s.check_interval_days, 'warmth', s.warmth,
      'rarityTier', s.rarity_tier, 'sensitive', s.sensitive),
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
