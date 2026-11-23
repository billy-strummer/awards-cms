-- ============================================================
-- Migration 094: Add missing indexes on foreign-key columns
-- (BTA-115/116, Vertical 4 finding M4)
-- ============================================================
-- BTA-115's live, read-only audit of the test Supabase project
-- (htcsewpztvxafksdzuhp) found 7 foreign-key columns on the migration-093
-- table set with no supporting index (checked via pg_constraint/pg_index):
--   award_years.tenant_id, organisations.tenant_id,
--   award_assignments.tenant_id, entries.tenant_id, invoices.tenant_id,
--   invoices.award_id, payments.tenant_id.
--
-- Urgency varies: 6 of the 7 are `tenant_id` columns, which are currently
-- inert -- `api/data-proxy.js`'s `rejectUntrustedTenantId()` forces every
-- client-supplied tenantId to `'default'`, so no query today actually
-- filters or joins on these columns at any meaningful scale. The seventh,
-- `invoices.award_id`, is a genuinely active foreign key (populated by
-- real invoice-creation flows) and will slow invoice<->award joins/deletes
-- as the table grows, even though it is not an acute problem today.
--
-- This migration adds all 7 indexes together, since doing so is cheap and
-- removes the need to revisit `tenant_id` indexing separately if/when
-- multi-tenancy is ever activated for real.
--
-- Idempotent: CREATE INDEX IF NOT EXISTS is a no-op if the index already
-- exists. Does not lock out writes any longer than a normal CREATE INDEX
-- (not using CONCURRENTLY, matching this project's other migrations' own
-- convention of plain DDL run via the Supabase MCP/SQL editor rather than
-- a live, continuously-written production table) -- on a small-to-medium
-- table this is a sub-second operation; re-verify table size before
-- applying to production if it has grown very large by the time this is
-- applied. Does not modify or delete any row of data, and does not change
-- any policy, grant, or table structure beyond adding these indexes.
--
-- NOT APPLIED by this authoring task (BTA-116). Per this project's standing
-- migration process, this file must be verified against the test project
-- first and separately, explicitly authorised before being applied to
-- production -- the same process already followed for migration 093.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_award_years_tenant_id ON award_years (tenant_id);
CREATE INDEX IF NOT EXISTS idx_organisations_tenant_id ON organisations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_award_assignments_tenant_id ON award_assignments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_entries_tenant_id ON entries (tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices (tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_award_id ON invoices (award_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments (tenant_id);
