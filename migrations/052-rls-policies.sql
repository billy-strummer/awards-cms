-- Migration 052: Enable Row Level Security on critical tables
--
-- Strategy:
--   - Enable RLS on each table
--   - Service role bypasses RLS (used by data-proxy server-side via SUPABASE_SERVICE_KEY)
--   - All other direct client access is denied (all reads/writes go through data-proxy)
--
-- This is defence-in-depth: the data-proxy API layer already enforces authentication,
-- but RLS ensures that even if the anon/authenticated key is leaked, direct DB access
-- to these tables is blocked.
--
-- Safe to re-run: ALTER TABLE ... ENABLE ROW LEVEL SECURITY is idempotent.
-- CREATE POLICY uses IF NOT EXISTS guard equivalent via DO blocks.

-- ── Helper to create policy if it doesn't already exist ───────────────────────
-- (PostgreSQL lacks CREATE POLICY IF NOT EXISTS, so we use exception handling)

DO $$
DECLARE
  -- 'awards' is a view over award_years (not a table — RLS attaches to
  -- award_years instead, which is already in this list), so it's excluded here.
  tbls TEXT[] := ARRAY[
    'organisations', 'award_years', 'entries',
    'award_assignments', 'event_guests', 'invoices', 'payments'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    -- Allow service role full access (data-proxy uses the service key)
    BEGIN
      EXECUTE format(
        'CREATE POLICY "service_role_all" ON %I FOR ALL USING (auth.role() = ''service_role'')',
        tbl
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    -- Block all direct client access (all reads/writes must go through data-proxy)
    BEGIN
      EXECUTE format(
        'CREATE POLICY "no_direct_client_access" ON %I FOR ALL USING (false)',
        tbl
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;
