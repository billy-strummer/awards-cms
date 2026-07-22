# Database Migration Order

## IMPORTANT: Run `migrations/000-complete-database-setup.sql` first

The root SQL files (`database-schema.sql`, `database-events-setup.sql`, etc.) contain
`REFERENCES award_years(id)` foreign keys, but `award_years` is only defined inside
`migrations/000-complete-database-setup.sql`. Running the root files standalone without
first running that migration will fail with "relation 'award_years' does not exist".

## Recommended migration order for a fresh Supabase project

1. `migrations/000-complete-database-setup.sql` — creates core tables including `award_years`
2. `database-schema.sql` — adds email, campaign, and supporting tables
3. `database-events-setup.sql` — authoritative events table (use this, not the stub in database-schema.sql)
4. `database-payments-setup.sql`
5. `database-crm-setup.sql`
6. `database-event-management-setup.sql`
7. `database-multiuser-tables-setup.sql`
8. `database-email-lists-setup.sql`
9. All `migrations/0XX-*.sql` files in numeric order — run `migrations/001-*.sql` through
   the highest-numbered file sequentially. Each file is idempotent (uses `IF NOT EXISTS`
   guards) so re-running is safe.

> ⚠️ **`migrations/077-enable-rls-missing-tables.sql` is required, not optional.**
> It closes a real, live security gap found during production-deployment
> verification: `email_logs`, `judge_conflicts`, and `sponsorships` had RLS
> disabled and (on a real Supabase project — this doesn't show up against a
> bare local Postgres instance) the standard broad default grants to
> `anon`/`authenticated`, meaning anyone holding the public anon key could
> read or write those tables directly via the REST API. It's covered by the
> "through the highest-numbered file" instruction above, but is called out
> here explicitly given the severity — do not skip it, and see
> `PRODUCTION-DEPLOYMENT-PLAN.md` Step 2 for how to verify it actually took
> effect (not just that the migration ran without error).

> ⚠️ **`migrations/080-enable-rls-vote-judging-integrity-tables.sql` is required, not optional.**
> Same class of gap as migration 077, found during a follow-up empirical risk
> assessment: `public_votes`, `judge_scores`, `shortlists`, `winner_documents`,
> `winner_media`, and `deliberation_notes` had RLS *enabled* but only the
> original migration-000 permissive policy (`USING (true)`), which is
> functionally identical to having no RLS at all. Proven exploitable with
> real anon-key REST calls: anonymous ballot-stuffing into `public_votes`,
> and a confirmed, verified tamper of a real `judge_scores.total_score` value
> — i.e., the two things this platform's entire product integrity depends on
> (vote counts and blind judging) were directly manipulable by anyone with
> the public anon key, bypassing `voting-proxy.js`'s rate-limiting entirely.
> Do not skip this migration.

> ⚠️ **Migrations 081–085 are all required, not optional.** Produced by the same
> empirical risk-assessment pass as migration 080, each independently proven
> exploitable with real anon-key calls and independently verified after fixing:
> - **081** (`revoke-anon-execute-email-functions.sql`) — revokes anon/authenticated
>   `EXECUTE` on 6 `SECURITY DEFINER` functions, including `send_single_email`/
>   `send_test_email`, which had no internal auth check and would let anyone send
>   arbitrary email through this platform's real Resend account.
> - **082** (`fix-certificate-assets-storage-policies.sql`) — the `certificate-assets`
>   storage bucket's write policies were scoped to `{public}` instead of
>   `{authenticated}`; anyone could upload/overwrite/delete files with only the
>   anon key (confirmed exploitable).
> - **083** (`enable-security-invoker-on-views.sql`) — none of the 15 views in the
>   schema had `security_invoker` set, so they ran with the view owner's
>   privileges and silently bypassed RLS hardening already applied to their
>   underlying tables (confirmed: real company/contact PII and a real guest's
>   name/email leaked via views even though the base tables correctly blocked anon).
> - **084** (`harden-sensitive-table-subset-rls.sql`) — 27 tables (`user_roles`,
>   `webhooks`, `gdpr_requests`, `sponsor_contracts`, CRM/audit tables, etc.) still
>   on the migration-000 permissive policy; confirmed exploitable including a real
>   webhook signing secret readable in full via the anon key.
> - **085** (`harden-table-assignments-rls.sql`) — same gap on `table_assignments`
>   (event seating, including dietary requirements).
>
> See `SECURITY-FIX-MIGRATION-080.md` through `-085.md` for full proof-of-exploit
> detail, browser-dependency analysis, and verification evidence for each.

> ⚠️ **`database-location-restructure.sql` is deliberately NOT in this list.**
> It requires the `areas` table, which doesn't exist until
> `migrations/067-create-missing-areas-table.sql` runs — so running it at
> this step (as an earlier version of this document said to) fails outright
> on a genuinely fresh project with "relation areas does not exist".
> Migration 067 already creates `areas` and seeds both it and `regions`
> with the same canonical list, safely (`ON CONFLICT DO NOTHING`, no
> destructive truncate). `database-location-restructure.sql` is superseded
> and does not need to be run — it's kept only for historical reference,
> and has been guarded so it's a safe no-op even if run by mistake.

## Additional non-numbered migrations (run last)

> ⚠️ **Found during a production-readiness dress rehearsal**: these 5 files exist in
> `migrations/` but were never added to this document — a fresh deployment following
> only the steps above would silently skip them. `create-award-seasons.sql` in
> particular creates the `award_seasons` table that Settings → Seasons & Areas
> (nomination open/close dates — see `OPERATIONS-MANUAL.md`) depends on entirely;
> skipping it leaves that whole feature broken with no obvious error pointing back
> to a missing migration. All five are idempotent (`IF NOT EXISTS` guards), so run
> them now even against an already-provisioned database — they're safe no-ops if
> already applied.

10. `migrations/create-award-seasons.sql` — creates the `award_seasons` table (Settings → Seasons & Areas)
11. `migrations/add-is-self-nomination.sql` — adds `entries.is_self_nomination`
12. `migrations/add-prev-year-results.sql` — adds previous-year-result columns used by the award "Roll Over to Next Year" flow
13. `migrations/rename-awards-region-to-county.sql` — renames `awards.region` to `awards.county` to match what it actually stores
14. `migrations/email-automation.sql` — backfills entry-confirmation-specific columns onto `email_logs`

## Production deployment

Use the Supabase dashboard SQL Editor or the Supabase CLI (`supabase db push`) to apply
migrations. Never run raw SQL against a production database without reviewing it first.
