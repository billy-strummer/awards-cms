# Security Fix Report — Migration 077

**Date:** 2026-07-21
**Scope:** Claude TEST CMS only. `british-trade-awards-cms` (production) was not touched.

## What the vulnerability was

Three tables — `email_logs`, `judge_conflicts`, `sponsorships` — had Row Level Security disabled, and on the real Supabase project (confirmed directly, not assumed) also carried Supabase's standard default grants of full `SELECT`/`INSERT`/`UPDATE`/`DELETE`/`TRUNCATE` to both the `anon` and `authenticated` roles. Since the public anon key is meant to be public (it's embedded in every page), this meant anyone who obtained it — which is trivial, it ships in the HTML — could read, modify, or wipe these tables directly via Supabase's REST API, with no authentication or authorization check at all.

`judge_conflicts` (conflict-of-interest records between judges and organisations) and `sponsorships` (commercial sponsorship deals) are the kind of data you would not want publicly readable or writable.

## Why it existed

The last release-candidate audit (documented in `RELEASE-CANDIDATE-AUDIT-2026-07.md`) found the missing RLS but checked it against a local Postgres replica built from scratch for that audit — which never reproduced Supabase's own default grant behavior, since that replica's `anon`/`authenticated` roles were created empty with no grants. The audit concluded the gap "wasn't currently exploitable," which was correct for that replica but wrong for any real Supabase project. This was corrected as part of this fix — see the annotation in `RELEASE-CANDIDATE-AUDIT-2026-07.md`.

## How it was fixed

`migrations/077-enable-rls-missing-tables.sql` enables RLS on all three tables and applies the same pattern already established in `migrations/052-rls-policies.sql`: a `service_role_all` policy (full access for the service-role key, which `api/data-proxy.js` uses for all real application access) plus a `no_direct_client_access` policy (`USING (false)`, blocking every other role entirely).

This is deliberately **not** the older `"Allow all access ... USING (true)"` pattern from `migrations/000-complete-database-setup.sql`, which is still used on many other tables in this schema. That pattern would not have closed anything here — given the pre-existing broad grants, a `USING (true)` policy is exactly as permissive as no RLS at all. The restrictive pattern was chosen because none of these three tables need direct client access; confirmed by checking the actual application code first: `judge_conflicts` is read via `apiClient.select/selectAll/deleteByFilters` (which routes through `data-proxy.js`'s service-role key), `email_logs` only appears as a column-list entry in a GDPR export/delete routine, and `sponsorships` isn't referenced by any application code at all. No code changes were required.

## How it was verified

Every check below was run against the real, live database — not inferred from the policy definitions alone:

1. **Policy state**: confirmed RLS enabled and exactly the two expected policies present on all three tables, both immediately after applying the migration and after a second, deliberate re-run (idempotency — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is a no-op if already enabled, and the `CREATE POLICY` statements are wrapped in `duplicate_object` exception handling, matching migration 052's own approach exactly since Postgres has no `CREATE POLICY IF NOT EXISTS`).
2. **Direct anon-key write blocked**: a raw `POST` to each table via Supabase's REST API using the public anon key was rejected with `HTTP 401` and Postgres error `42501` ("new row violates row-level security policy") — confirmed for all three tables.
3. **Direct anon-key read genuinely filtered, not just empty**: inserted a real row into `sponsorships` via the service-role key (simulating what `data-proxy.js` does), confirmed it was visible via a service-role query, then confirmed the same row was invisible (`[]`) via the anon key. This proves RLS is actually filtering rows, not that the table simply had nothing in it. The test row was then deleted.
4. **Application functionality unaffected**: re-ran a real `data-proxy.js` `select` on `judge_conflicts` through the actual authenticated-admin code path — returned `HTTP 200` as before, confirming the service-role bypass still works correctly for real application traffic.
5. **Data integrity**: took a full row-count snapshot of the database before touching anything and compared it against a snapshot after all changes (organisations, entries, award_years, winners, areas, user_roles, public_votes, award_seasons, tenant-scoped row counts) — identical in every field. No data was altered, lost, or left behind (including cleaning up the throwaway test admin user and sponsorship row created during verification).

## Other tables with the same issue

Two more, found while checking whether "the existing RLS pattern" was applied consistently — but **not fixed in this change**, since fixing them wasn't part of what was authorized here:

**`award_assignments` and `event_guests`** both still carry the *original* `"Allow all access to X" ... USING (true)` policy from migration 000, left in place alongside migration 052's `service_role_all`/`no_direct_client_access` policies that were supposed to lock them down. PostgreSQL combines multiple `PERMISSIVE` policies with `OR` — so the leftover `USING (true)` policy silently cancels out the `USING (false)` one. Both tables currently show RLS as "enabled" in a naive check, but are in practice just as open to direct `anon`/`authenticated` access as if migration 052 had never run for them.

This is flagged in `DB-SCHEMA-AUDIT-TODO.md`'s DB-C3 item and in `PRODUCTION-DEPLOYMENT-PLAN.md`'s Step 2, including a corrected verification query that checks for this specific failure mode (a naive `rowsecurity = true` check would never catch it) — but the fix itself is a separate decision, since it touches two tables beyond the three you authorized this session.

## Documentation and checklist updates made

- `MIGRATION_ORDER.md` — migration 077 called out explicitly as required (also covered implicitly by the existing "run through the highest-numbered file" instruction).
- `LAUNCH-CHECKLIST.md` — updated the migration and RLS checklist lines to reference migration 077 and the strengthened verification.
- `PRODUCTION-DEPLOYMENT-PLAN.md` — Step 2's verification query rewritten to check three things instead of one: RLS disabled outright, RLS enabled but neutralized by a leftover permissive policy, and a live anon-key request test against a real table.
- `DB-SCHEMA-AUDIT-TODO.md` — annotated the original DB-C3 item with what was actually found on the live project, including the `award_assignments`/`event_guests` follow-up.
- `RELEASE-CANDIDATE-AUDIT-2026-07.md` — corrected its now-wrong "not currently exploitable" claim, with an explanation of why the earlier check missed this.

## What remains before `british-trade-awards-cms` can safely be updated

This is a strong candidate for the **same gap existing on production**, since it's a Supabase project-level default, not something specific to TEST CMS. Before touching `british-trade-awards-cms`:

1. Run the same schema-fingerprint check used here (migration markers 000 through 077) to establish its actual current migration state — do not assume it matches TEST CMS.
2. Run the 3-part RLS verification query from `PRODUCTION-DEPLOYMENT-PLAN.md` Step 2 against it specifically — including the live anon-key request test — to confirm whether it has this same exposure (very likely) and whether `award_assignments`/`event_guests` show the same neutralized-policy problem.
3. Decide, with explicit authorization, whether to also fix `award_assignments`/`event_guests` at the same time as migration 077, given they'll need the same investigation on production regardless.
4. Only then apply the missing migrations (075, 076, 077, and whatever else the fingerprint check finds missing) to production, following the same idempotency-first, verify-before-and-after discipline used here.

I have not touched `british-trade-awards-cms` in any way.
