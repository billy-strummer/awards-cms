# BTA-086 — Database Deployment Readiness

**Status:** Prepared from existing repository migration files and the historical evidence record (BTA-074 through BTA-084). No SQL was created or executed for this report, and no new Supabase connection was made. All "verified applied/unapplied" claims below are historical observations from specific earlier tasks, cited by task ID — re-verify independently before acting on them, since the live database may have changed since.

## 1. Migration inventory

| # | File | Purpose | Historical application status | Source |
|---|---|---|---|---|
| 045 | `045-proper-rls-policies.sql` | Replace permissive RLS across ~45 tables with role-based policies | **Unapplied** (observed via absence of its named policies on production) | BTA-079 |
| 052 | `052-rls-policies.sql` | Lock 7 sensitive tables to service-role-only | **Unapplied**; also **defective as written** — never drops the original permissive policy, so applying it would not fix anything | BTA-079 |
| 078 | `078-remove-obsolete-permissive-policy-event-guests.sql` | Drop the leftover permissive policy on `event_guests` | **Unapplied** (observed via the policy's continued presence on production) | BTA-078 |
| 079 | `079-restore-event-guests-checkin-access.sql` | Add minimum `authenticated` SELECT/UPDATE for the check-in app | **Unapplied** (observed: neither 078's drop nor 079's policies are present on production) | BTA-078 |
| 087 | `087-harden-sponsorship-opportunities-rls.sql` | Lock `sponsorship_opportunities` to service-role-only, correctly dropping the original policy | **Unapplied** (confirmed on production AND, earlier, on the test project — BTA-052) | BTA-052, BTA-078 |
| 088 | `088-harden-remaining-046-grant-array-tables.sql` | Lock 22 tables from migration 046's grant array, correctly dropping all leftover policies | **Unapplied** (confirmed on production AND test — BTA-052) | BTA-052, BTA-078 |
| 089 | `089-secure-gdpr-erasure-rpc.sql` | `erase_organisation_gdpr` RPC, `RETURNS TEXT` contract, correct table names, search_path pinned | **Unapplied** — function does not exist on production at all | BTA-078 |
| 091 | `091-sponsorship-catalogue-packages.sql` | New `sponsorship_catalogue_packages` table | **Unapplied** — table does not exist on production | BTA-078 |
| 092 | `092-fix-anonymize-organisation-return-contract.sql` | `anonymize_organisation` RPC, corrected to `RETURNS TEXT`, EXECUTE revoked | **Unapplied** — live function is still the old `RETURNS void` version, **and currently has EXECUTE granted to PUBLIC/anon/authenticated** | BTA-078 |
| 093 | `093-harden-remaining-permissive-policy-tables.sql` | Lock 8 tables (`organisations`, `organisation_contacts`, `gdpr_requests`, `entries`, `award_assignments`, `invoices`, `payments`, `award_years`) to service-role-only; excludes `event_guests` by design | **Unapplied, and never tested against any database** — test-project connectivity has been blocked since BTA-081 | BTA-080, BTA-081, BTA-082 |

**Historically verified as applied (for contrast, from earlier in this project):** migrations 080, 084, 085, 086 (RLS hardening for the original BTA-019/020 13-table list minus `sponsorship_opportunities`) — BTA-052 found 12 of 13 of those tables correctly hardened on the **test** project specifically; production's equivalent state for those same tables was not re-checked in BTA-078/079 (out of this reconciliation's named scope) and should be treated as **Unknown** until explicitly checked.

**Unknown:** every migration's status on the **test** project specifically (never reachable); production's status for migrations outside the 087/088/089/091/092/093 set (e.g. whether 080/084/085/086 are live there too).

**Superseded/potentially conflicting:** 052 is superseded in intent by 093 for the 6 tables they share (`organisations`, `award_years`, `entries`, `award_assignments`, `invoices`, `payments`) — see BTA-084 Section 6. 045's broader scope overlaps 052/093/087 for specific tables but was authored earliest and is superseded by all three for the tables they cover; 045's remaining ~35 tables outside this security work's scope were not reconciled and their status is unknown.

## 2. Dependencies

None of the 10 migrations above have a hard SQL-level dependency on another (no migration references an object only another creates) — confirmed in BTA-084's reconciliation. The only *soft* dependency is 093 relying on the premise that `event_guests` is handled by 078+079 rather than by 093 itself — if 078/079 are never applied, `event_guests` remains unprotected regardless of 093's application, and this is a known, accepted gap in 093's design (not an error).

## 3. Known migration conflicts

- 045 vs. 052 (resolved by 093's supersession — see BTA-084 Section 6). **Recommendation: do not apply 045 or 052 as written; apply 093 instead for the tables they overlap.**
- No other file-level conflict identified.

## 4. Recommended order for future review (not yet actioned)

1. **093 → 087 → 088** as one batch (closes the permissive-policy exposure for 31 of the 32 BTA-078/079-flagged tables).
2. **078 → 079** as a second batch, if not already applied, for `event_guests` specifically.
3. **089 → 092** as a third batch (GDPR RPC function-contract fixes — thematically linked, technically independent of the first two batches).
4. **091** independently (additive new table, no dependency on anything else).

Each batch should go to the **test project first**, with the read-only verification queries below run before and after, and only proceed to production after an explicit, separate authorisation following a passing test-project verification.

## 5. Pre-deployment checks

Before applying anything to any environment:
1. Confirm the target project ID matches intent (test `htcsewpztvxafksdzuhp` vs. production `qdzyknercdqwhwijbcxf`) via `get_project`/`list_projects` — never assume from a previous session's note.
2. Confirm the database connection is genuinely live (a minimal `SELECT 1`, not just a healthy control-plane status — BTA-081/082 demonstrated these can disagree).
3. Take a backup/PITR checkpoint of the target database (standard practice, independent of this project).
4. Read the exact current content of the migration file about to be applied — do not apply from memory or an earlier cached copy.

## 6. Baseline verification requirements (read-only, run before applying anything)

```sql
-- Confirms whether erase_organisation_gdpr/anonymize_organisation already
-- exist with an unexpected signature before 089/092 are applied
SELECT proname, pg_get_function_identity_arguments(oid), prorettype::regtype
FROM pg_proc WHERE proname IN ('erase_organisation_gdpr', 'anonymize_organisation');

-- Confirms sponsorship_catalogue_packages does not already exist with a different shape
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'sponsorship_catalogue_packages';

-- Confirms the exact current policy state for every table 093/087/088 target,
-- before applying any of them (expect the original "Allow all access to <table>"
-- permissive policy on each, per BTA-078/079's last observation)
SELECT tablename, policyname, permissive, cmd, roles FROM pg_policies
WHERE schemaname = 'public' AND tablename IN (
  'organisations','organisation_contacts','gdpr_requests','entries',
  'award_assignments','invoices','payments','award_years',
  'sponsorship_opportunities','event_guests'
  -- plus migration 088's 22 tables, listed in BTA-079's report
) ORDER BY tablename, policyname;
```

## 7. Post-deployment policy and grant checks

```sql
-- After 093/087/088: confirms no permissive anon/authenticated policy remains
-- on any target table
SELECT tablename, policyname, roles FROM pg_policies
WHERE tablename IN (/* same table list as above */)
  AND (roles @> ARRAY['anon']::name[] OR roles @> ARRAY['authenticated']::name[])
  AND policyname NOT IN ('event_guests_select', 'event_guests_update');
-- Expect: zero rows (event_guests's two authenticated-only policies are the
-- sole intended exception and are explicitly excluded from this check).

-- After 089/092: confirms the new signatures and lockdown took effect
SELECT proname, prorettype::regtype FROM pg_proc
WHERE proname IN ('erase_organisation_gdpr', 'anonymize_organisation');
-- Expect: both 'text'.
SELECT grantee, privilege_type FROM information_schema.routine_privileges
WHERE routine_name IN ('erase_organisation_gdpr', 'anonymize_organisation');
-- Expect: no row for anon/authenticated/PUBLIC.

-- After 091: confirms the table exists
SELECT to_regclass('public.sponsorship_catalogue_packages');
-- Expect: non-null.
```

## 8. Application smoke tests (after any application, before considering it done)

1. Log in to the admin UI as each role (super_admin, admin, editor, marketing, finance, judge, viewer) and confirm no previously-working screen now errors.
2. Submit a disposable test entry through the real public form; confirm it appears in the admin entries list.
3. Create, publish, and unpublish a sponsorship package (if 091 is in the batch); confirm the public page shows/falls back correctly.
4. Trigger a GDPR export against a disposable test organisation (if 089 is in the batch); confirm the downloaded JSON is correct and complete.
5. Use the Event Check-in page against a disposable test event/guest (after any batch, since all batches could theoretically affect `event_guests` indirectly via grant changes even though none should); confirm scan/check-in still works.

## 9. Rollback and recovery considerations

- **Policy/grant changes (093/087/088/078/079) are mechanically reversible**: re-creating the original permissive policy and re-granting privileges is a simple SQL operation. However, **this is not risk-free rollback** — any period during which legitimate access was unexpectedly blocked (if an undiscovered dependency exists) causes real application-level failures that a policy rollback does not undo retroactively, and any inappropriate access that occurred before a fix was applied is never undone by rolling the fix back.
- **Function changes (089/092)** use `DROP FUNCTION IF EXISTS` before `CREATE` — reverting to the old function would require redefining it from the pre-migration source (available in this project's git history/task-sheet record, not a live backup), and switching `gdpr.js`'s expectations back too, since the corrected client code expects the new `TEXT` contract.
- **091 (additive table)** rollback is a straightforward `DROP TABLE IF EXISTS sponsorship_catalogue_packages` with no data-loss risk if the table was never populated with real data, but would need a prior check that no real sponsorship data has been entered before dropping it.
- **No migration here deletes or mutates existing row data** — all are permission/policy/function-definition changes or new-table creation. This significantly limits worst-case rollback complexity compared to a data migration.

## 10. Explicit conditions before production deployment

1. Every migration in the batch must first be verified against the **test** project with the checks in Sections 6–8, and this verification must be real (query results captured), not assumed.
2. A production backup/PITR checkpoint must exist immediately before applying anything to production.
3. The business decisions listed in `BTA-PROJECT-CONTINUITY-CHECKPOINT.md` Section 9 that could interact with these tables (e.g. whether `authenticated`-role read access should exist for any of the 093 tables) must be confirmed as settled — the current plan assumes full lockdown is correct based on BTA-080's zero-dependency finding, but this should be re-confirmed by the approving human before production.
4. Explicit, separate authorisation for the production step itself — never automatic after a test-project pass.

## 11. CORRECTION (added after this report's initial writing, same task) — a real application dependency on migration 093's target tables now confirmed

**BTA-085 (run in parallel within this same programme) found that `test-data-manager.js` — a real, deployed admin feature loaded into every admin session — directly reads/writes 7 of migration 093's 8 target tables (all except `gdpr_requests`) plus `event_guests`, via a browser-side `authenticated`-role Supabase client.** This was missed by the single-line grep BTA-079/080 used to establish "zero dependency." Full evidence in `BTA-085-APPLICATION-SECURITY-DEPENDENCIES.md` Section 8.1; the correction is also recorded in `BTA-084-DATABASE-SECURITY-RECONCILIATION.md` Section 11.

**Practical effect on this report's plan:** Section 1's "Unapplied" status for 093 is unchanged, but Section 4/5/10's assumption that 093 can proceed once test-project connectivity returns, with no further decision needed, is **no longer accurate**. Before 093 is applied to even the test project, one of the following must be decided: (a) refactor `test-data-manager.js` to route through `api/data-proxy.js` instead of direct client access (architecturally consistent with the rest of the app, but a real code change, not a migration edit); (b) add narrowly-scoped `authenticated` policies for this tool's specific needs across the 7 overlapping tables plus `event_guests` INSERT/DELETE; or (c) accept that applying 093 disables this admin tool and gate it off deliberately. This is a business/architecture decision for the project owner, not resolved by this report.
