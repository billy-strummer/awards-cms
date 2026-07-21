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
9. `database-location-restructure.sql`
10. All remaining `migrations/0XX-*.sql` files in numeric order

## Numbered migrations (run in order after step 10 above)

Run `migrations/001-*.sql` through the highest-numbered file sequentially. Each file is
idempotent (uses `IF NOT EXISTS` guards) so re-running is safe.

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

11. `migrations/create-award-seasons.sql` — creates the `award_seasons` table (Settings → Seasons & Areas)
12. `migrations/add-is-self-nomination.sql` — adds `entries.is_self_nomination`
13. `migrations/add-prev-year-results.sql` — adds previous-year-result columns used by the award "Roll Over to Next Year" flow
14. `migrations/rename-awards-region-to-county.sql` — renames `awards.region` to `awards.county` to match what it actually stores
15. `migrations/email-automation.sql` — backfills entry-confirmation-specific columns onto `email_logs`

## Production deployment

Use the Supabase dashboard SQL Editor or the Supabase CLI (`supabase db push`) to apply
migrations. Never run raw SQL against a production database without reviewing it first.
