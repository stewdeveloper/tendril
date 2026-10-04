# Phase 2A (database) — rulings and deferred items

Persisted from the SDD ledger when the phase closed on 2026-10-04. Plan: `docs/superpowers/plans/2026-10-03-phase-2a-database.md`. Final review: opus, with fixes; fix wave re-reviewed clean (16 pgTAP files, 184 tests).

## Rulings

- Ruling: Phase 2A runs in a separate worktree in parallel with Phase 1A — different directories; root package.json scripts may conflict at merge (controller resolves) — cost if wrong: a manual merge
- Ruling: Task 1 minors carried into Task 2 — revoke execute on private.set_updated_at from public, anon; add is_admin positive/negative claim tests — cost if wrong: none
- Ruling: Supabase default privileges grant ALL on new public tables (and EXECUTE on functions) to anon/authenticated; add a migration at the start of Task 3: alter default privileges for role postgres in schema public revoke all on tables, sequences, functions from public/anon/authenticated — explicit grants per object remain the rule; Task 2's per-table revokes stay — cost if wrong: a grant missing on some table (tests catch it)
- Ruling: handles are lowercase-only — fix check to `handle::text ~ '^[a-z0-9_]{3,20}$'` in Task 3's opening migration (citext regex is case-insensitive) — cost if wrong: none (bootstrap lowercases)
- Ruling: Task 3 opening migration also adds set_updated_at triggers on privacy_zones and household_vets, and a catalog-driven grants test (anon: no grants on public tables except species/species_toxicity select; authenticated: SELECT only) — cost if wrong: none
- Ruling: accept global 'alter default privileges for role postgres revoke execute on functions from public' (schema-scoped form doesn't remove PG's built-in PUBLIC execute) — functions needing client execute get explicit grants — cost if wrong: a missing grant surfaces as a permission error in tests
- Ruling: carry into Task 4's migration/tests — add MAINTAIN to the grants audit; enable RLS (no policies) on private.* tables and extend the audit to schema private; check (btrim(taxon) <> '') on private.sensitive_taxa — cost if wrong: none
- Ruling: Task 5 adds a migration indexing FK columns used by cascades/set-null and joins (observations.household_id/plant_id/species_id, plants.species_id/parent_plant_id/observation_id/created_by, care_tasks.completed_by, diagnoses.observation_id/user_id, households.created_by) — cost if wrong: small write overhead
- Ruling: Task 6 adds pgTAP tests for the plant-photos storage folder policies (own folder upload/read ok; other uid's folder rejected) — cost if wrong: none
- Ruling: Task 6 also adds positive tests — owner sees own observation_photos rows; household member sees diagnoses for a household plant; outsider sees no care_events — and renames storage policies with a bucket prefix ("plant-photos: own folder read" etc.) via alter policy … rename; reword the 015 blank-taxon comment to "would over-flag family-less species" — cost if wrong: none
- Ruling: public_label may return catalogue fields for sensitive species — the sensitive flag protects locations, and labels carry none — cost if wrong: one filter in public_label
- Ruling: Task 6 additions — (a) function EXECUTE audit in 015: anon may execute no function in public/private except public_label; authenticated only public_label, private.is_admin, private.my_household_ids (+ any the Task 6 brief explicitly grants); (b) `create or replace` reserve_usage with `if lim is null or lim <= 0 then return false`; (c) public_label toxicity array ordered by animal and each entry carries reviewStatus (pet-safety data still at seed_pending_vet must not read as settled); (d) tests: label JSON top-level key allow-list (no contact_email/partner id), lowercase+whitespace code normalisation, release_usage at zero is a no-op — cost if wrong: none
- Ruling (cross-plan): plan 2B labels route maps public_label JSON → LabelInfo via labelFromRpc; core ToxicityEntry gains optional reviewStatus in 2B — RPC shape ≠ LabelInfo (care/careLines) — cost if wrong: a mapper rewrite (commit in main tree)
- Ruling: seed flamingo flower (Anthurium andraeanum) moderate for cats and dogs (insoluble calcium oxalates, ASPCA), seed_pending_vet — brief said Unknown, but ASPCA lists it toxic; seed truth beats the plan for pet safety; core fixture (design demo data) unchanged — cost if wrong: one row
- Ruling: moth orchid stays sensitive (family Orchidaceae per spec) — over-hiding locations is the safe side — cost if wrong: houseplant orchid finds show no map pin
- Ruling: 2A final fix wave adds a CI step `pnpm db:seed && git diff --exit-code supabase/seed.sql` (seed drift guard) — cost if wrong: none
- Ruling (cross-plan, plan 2B): labelFromRpc soil line = "Check the soil every N−1 to N+1 days" from checkIntervalDays (6 → "5 to 7", matching the fixture); null interval → no soil line; light line uses the light text as-is (no appended " light") — cost if wrong: copy tweak
- Ruling (cross-plan, plan 4): set-membership FKs to species use on delete cascade (pgTAP files 020/031/041/050/052 delete seeded species inside their transactions) — cost if wrong: test edits
- Ruling: reference data ships as a migration — sensitive taxa + curated species/toxicity in `<ts>_reference_catalogue.sql` generated ONCE by build.ts (`--reference-migration`); seed.sql keeps demo data only (partner, PL-0001); catalogue corrections after this ship as new migrations — db push doesn't apply seeds; --include-seed would publish demo data — cost if wrong: migration rework before first prod push
- Ruling: sensitive_taxa insert/delete re-flags species via a shared private.species_is_sensitive(scientific_name, genus, family) predicate used by both triggers; taxa unique on (rank, lower(taxon)) — cost if wrong: none
- Ruling: matrix outsider test + 015 pins the exact set of tables authenticated may SELECT — cost if wrong: none
- Ruling: drop the plant-photos delete policy (spec §7: only client write is upload); server overwrites/deletes via service role; 052 adjusted — cost if wrong: client can't remove a mistaken upload (server discard handles it)
- Ruling: fold minors — auth.users FK catalog guard (confdeltype in c,n) + push_tokens/household_members in 050; 051 positive control; species_toxicity reviewed→reviewed_by/at and non-blank source checks; unique push token (server upsert reassigns owner); leaf_states/organs value checks; CI seed+types drift guards — cost if wrong: none
- Ruling (cross-plan, 2B): photo sha256 computed before inserting observation_photos (NOT NULL); private stays unexposed (srv_* wrappers only); Plantdex increment via srv_* RPC; toxicity lookup falls back to the genus-level species row when a Plant.id species has no rows (pet safety) — cost if wrong: plan edits
- Ruling (cross-plan, 6 — household invites live there): co-members need each other's display names — Phase 5 adds a household_member_profiles RPC/policy — cost if wrong: none
- Ruling: species.sensitive is derived only from sensitive_taxa (admin marks one species by adding a species-rank taxon; Phase 7 admin manages taxa only) — re-flag overriding a manual flag is intended — cost if wrong: none

## Deferred and carried items

- Task 1: minor (carry to Task 6): extend leak guard to schema private — no function there executable by anon/authenticated except allow-list (is_admin, my_household_ids)
- Task 1: minor (deferred): vendored helper header lacks MIT copyright line and has trailing whitespace; tests.rls_enabled counts views/composite types; set_updated_at search_path ignores tests.freeze_time
- Task 2: minor (deferred): households.created_by unindexed; orphan households when last member deleted (Phase 6 account deletion handles sole-member households); push_tokens readable by owner
- Task 3: minor (deferred): species flag trigger update path untested; species.sensitive readable by anon (by design)
- Task 4: minor (deferred to final review): child tables repeat user_id/household_id without composite FKs to parent (service-role write bug could mis-scope rows); bucket insert `on conflict do nothing` keeps a pre-existing public bucket; care_events.client_id globally unique (functions must check ownership on 23505); household partners can't read each other's photos — shared photos need server-signed URLs (Phase 3)
- Task 5: minor (carry to Phase 6 webhook task): is_premium ignores product/environment — webhook must not write SANDBOX rows for production users
- Task 5: minor (deferred): FK audit ignores partial indexes (indpred) and composite FKs (none exist)
- Task 6: minor (deferred): 051 blind to matviews/transitive reads/argument types (015 grants audit covers matviews); 041 nested key sets not pinned
- Task 7: minor (deferred): fixture shows Swiss cheese plant Unknown while seed says moderate (design demo vs real data); light vocabulary not normalised; ASPCA genus/synonym listings unannotated except flamingo flower
- Deferred: profiles.timezone validation (2B server validates on write); referral_code 40-bit collisions; radius_m 30000 cap vs ×1.5 enlargement (20 km user max — acceptable)
- Carry to Phase 6: account purge deletes plant-photos objects — already in plan 6 (step 2, account_test) — no edit needed

## Runtime checks

- Docker back; runtime check 1 PASS (db:reset + db:test: 13 files, 139 tests). Final fix wave dispatched (base 21d3a21).
- Final fix wave: returned (commits 21d3a21..3813247) — 16 files / 184 tests; runtime checks: quota race PASS (one true, used=1), account deletion leaves plant-photos object orphaned (Phase 6 purge), db lint clean for our schemas
