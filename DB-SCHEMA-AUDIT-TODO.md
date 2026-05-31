# Database Schema Audit — 2026-05-30

## Summary

Audit of all 48 SQL migration files in the British Trade Awards CMS. Covers: missing RLS policies, schema conflicts, missing indexes, referential integrity, migration ordering, and timestamp conventions.

**Severity counts:** 3 Critical · 3 High · 3 Medium · 1 Low

---

## CRITICAL

### [x] DB-C1 — `award_years` table referenced in 20+ FKs but not defined in root SQL files

- **Files:** `database-schema.sql`, `entries-schema.sql`, `database-payments-setup.sql`, and others
- **Description:** Every table that links to an awards cycle uses `REFERENCES award_years(id)`, but `award_years` is only defined in `migrations/000-complete-database-setup.sql`. Running the individual root SQL files without the migrations folder will fail with "relation 'award_years' does not exist". There is no documented migration ordering requirement.
- **Suggested fix:** Either (a) add `award_years` CREATE TABLE to `database-schema.sql` with a guard (`CREATE TABLE IF NOT EXISTS award_years ...`) so root files can run standalone, or (b) add a prominent `MIGRATION_ORDER.md` file documenting that `migrations/000-complete-database-setup.sql` must be run first.

### [x] DB-C2 — `events` table defined twice with incompatible column names

- **Files:** `database-schema.sql` vs `database-events-setup.sql`
- **Description:** `database-schema.sql` defines `events` with columns `name`, `venue_name`, `event_type`. `database-events-setup.sql` redefines it with `event_name`, `venue`. The application code uses `event_name` and `venue` (matching `database-events-setup.sql`). Running both files in sequence corrupts the schema; running just `database-schema.sql` leaves incompatible column names that break every event query.
- **Suggested fix:** Remove the `events` table definition from `database-schema.sql` (or replace it with a stub comment pointing to `database-events-setup.sql`). Add a `CREATE TABLE IF NOT EXISTS` guard to `database-events-setup.sql` to make it idempotent.

### [x] DB-C3 — RLS (Row Level Security) missing on 8 critical tables

- **Files:** Across multiple schema files
- **Description:** The following tables have no `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and no `CREATE POLICY` statements: `organisations`, `awards`, `award_years`, `entries`, `award_assignments`, `event_guests`, `invoices`, `payments`. Without RLS, any authenticated Supabase user can read and write all rows in these tables regardless of role. This means a judge could read all entries, a registrant could read all invoices, etc. The `data-proxy.js` API layer provides application-level filtering, but RLS is a defence-in-depth requirement.
- **Suggested fix:** For each table, add at minimum a service-role bypass policy and a read restriction policy:
  ```sql
  ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
  -- Allow service role full access (used by data-proxy server-side)
  CREATE POLICY "service_role_all" ON organisations FOR ALL USING (auth.role() = 'service_role');
  -- Deny direct client access (all reads go through data-proxy)
  CREATE POLICY "no_direct_client_access" ON organisations FOR ALL USING (false);
  ```
  Then run `npm run validate` and confirm all API routes still work via `data-proxy` (which uses the service key and bypasses RLS).

---

## HIGH

### [x] DB-H1 — Missing indexes on high-query columns

- **Files:** `database-schema.sql`, `database-events-setup.sql`, `database-email-lists-setup.sql`
- **Description:** Three high-traffic query patterns have no supporting index:
  1. `email_logs.status` — filtered constantly for pending/sent/failed dashboards
  2. `event_guests(event_id, rsvp_status)` — composite filter used in attendee reports
  3. `award_assignments(award_id, status)` — filtered for shortlist/winner counts
- **Suggested fix:**
  ```sql
  CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
  CREATE INDEX IF NOT EXISTS idx_event_guests_event_rsvp ON event_guests(event_id, rsvp_status);
  CREATE INDEX IF NOT EXISTS idx_assignments_award_status ON award_assignments(award_id, status);
  ```

### [x] DB-H2 — `email_campaigns` foreign keys applied via DO block that can silently fail

- **File:** `database-schema.sql` (lines ~227–239)
- **Description:** `template_id`, `award_id`, `event_id` in `email_campaigns` are declared as plain UUID columns and their FK constraints are added inside a `DO $$ BEGIN ... EXCEPTION WHEN ... END $$` block. If the referenced tables don't exist at migration time, the exception is silently swallowed and the FK is never created. Orphaned campaign records can then reference non-existent templates or awards.
- **Suggested fix:** Define FKs inline at table creation with `CREATE TABLE IF NOT EXISTS` guards:
  ```sql
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  award_id    UUID REFERENCES award_years(id) ON DELETE SET NULL,
  event_id    UUID REFERENCES events(id) ON DELETE SET NULL,
  ```

### [x] DB-H3 — `regions` table missing `created_at` and `updated_at` timestamps

- **File:** `database-location-restructure.sql`
- **Description:** The `regions` table (introduced to support multi-region awards) has no `created_at` or `updated_at` columns. Every other table in the schema uses these for audit trails. The absence makes it impossible to detect when a region was added or modified.
- **Suggested fix:**
  ```sql
  ALTER TABLE regions
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  ```

---

## MEDIUM

### [x] DB-M1 — `judge_conflicts.org_id` is a soft FK with no referential integrity

- **File:** `database-multiuser-tables-setup.sql`
- **Description:** `judge_conflicts.org_id` is a UUID column with a comment noting it's a "soft FK" to `organisations(id)`. No hard constraint exists. If an organisation is deleted, its `judge_conflicts` rows become orphaned silently. The conflict check in `judge-automation.js` would then produce wrong results (treating a deleted org as a conflict).
- **Suggested fix:**
  ```sql
  ALTER TABLE judge_conflicts
    ADD CONSTRAINT judge_conflicts_org_fkey
    FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE;
  ```

### [x] DB-M2 — `cms_audit_logs` missing `updated_at` column

- **File:** `database-multiuser-tables-setup.sql`
- **Description:** `cms_audit_logs` records administrative actions but has no `updated_at` column. Since audit logs should be immutable, this is by design — but without the column, admin corrections (e.g., adding a note to a log entry) cannot be tracked. The absence also breaks the pattern of every other table having `updated_at`, causing inconsistency in any bulk schema queries.
- **Suggested fix:** Add column (or add an explicit comment in the SQL that this is intentionally omitted for immutability):
  ```sql
  -- Option A: add the column for consistency
  ALTER TABLE cms_audit_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  -- Option B: add a comment to document the intentional omission
  COMMENT ON TABLE cms_audit_logs IS 'Immutable audit log — no updated_at by design';
  ```

### [x] DB-M3 — Inconsistent FK convention: some hard constraints, some soft/commented

- **Files:** Multiple
- **Description:** The schema mixes three FK styles: (1) inline `REFERENCES` at column definition, (2) `ALTER TABLE ADD CONSTRAINT` after creation, and (3) comment-only "soft FKs". This makes it impossible to know at a glance which relationships are enforced. `entry_documents.entry_id` uses inline FK; `judge_conflicts.org_id` uses soft FK; `email_campaigns.*_id` uses deferred DO-block FK. Developers onboarding to the schema cannot rely on FK notation.
- **Suggested fix:** Standardize on inline `REFERENCES` for all new tables. Create an `add-missing-fk-constraints.sql` migration to harden all existing soft FKs to hard constraints, using `IF NOT EXISTS` guards.

---

## LOW

### [x] DB-L1 — Redundant `IF NOT EXISTS` checks around `CREATE OR REPLACE FUNCTION`

- **Files:** `database-payments-setup.sql`, `database-crm-setup.sql`, `database-event-management-setup.sql`
- **Description:** Several files wrap `CREATE OR REPLACE FUNCTION` inside `DO $$ BEGIN IF NOT EXISTS (SELECT ...) THEN ... END IF; END $$` blocks. `CREATE OR REPLACE` is already idempotent — the outer existence check is redundant and adds noise.
- **Suggested fix:** Remove the DO-block wrappers and use `CREATE OR REPLACE FUNCTION` directly.

---

## How to work through this list

1. Read each item in order (DB-C1 → DB-C2 → DB-C3 → DB-H1 → … → DB-L1)
2. Apply the SQL fix or documentation change
3. Run `npm test` to confirm no regressions (tests mock the DB, so they verify the JS logic still holds)
4. Mark the item `[x]` in this file in the same commit as the fix
5. Push to `claude/continue-cms-build-gknZa`
