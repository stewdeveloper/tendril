-- Index foreign key columns. Postgres does not do this automatically, and these columns are scanned by
-- ON DELETE CASCADE / SET NULL actions on the referenced row and by joins. Foreign keys that already lead an
-- index (household_id, user_id and plant_id on most tables, qr_scans.code) are not repeated here.

create index households_created_by_idx on public.households (created_by);

create index observations_household_id_idx on public.observations (household_id);
create index observations_plant_id_idx on public.observations (plant_id);
create index observations_species_id_idx on public.observations (species_id);

create index plants_species_id_idx on public.plants (species_id);
create index plants_parent_plant_id_idx on public.plants (parent_plant_id);
create index plants_observation_id_idx on public.plants (observation_id);
create index plants_created_by_idx on public.plants (created_by);

create index care_tasks_completed_by_idx on public.care_tasks (completed_by);

create index diagnoses_observation_id_idx on public.diagnoses (observation_id);
create index diagnoses_user_id_idx on public.diagnoses (user_id);

create index plantdex_entries_species_id_idx on public.plantdex_entries (species_id);
create index plantdex_entries_first_observation_id_idx on public.plantdex_entries (first_observation_id);

create index qr_codes_partner_id_idx on public.qr_codes (partner_id);
create index qr_codes_species_id_idx on public.qr_codes (species_id);
create index qr_scans_user_id_idx on public.qr_scans (user_id);
