-- Audit hardening: row level security on every private table and a non-blank sensitive taxon.

-- The private schema is not exposed through the API, but a stray grant or an exposed-schema setting change
-- would otherwise open its tables. With RLS on and no policies, clients see nothing even then; the server
-- (service_role bypasses RLS) is unaffected.
alter table private.sensitive_taxa enable row level security;
alter table private.observation_provider enable row level security;

-- A blank taxon can never match a species and would pass for coverage that is not there.
alter table private.sensitive_taxa
  add constraint sensitive_taxa_taxon_not_blank check (btrim(taxon) <> '');
