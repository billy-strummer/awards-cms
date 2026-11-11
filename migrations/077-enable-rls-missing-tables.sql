-- ============================================================
-- Migration 077: Enable RLS on email_logs, judge_conflicts, sponsorships
-- ============================================================
-- Found during production-deployment verification: these 3 of 115
-- public-schema tables had RLS disabled, AND (on the real Supabase
-- project, unlike a bare local Postgres instance) the standard broad
-- default grants to anon/authenticated — meaning anyone holding the
-- public anon key could SELECT/INSERT/UPDATE/DELETE/TRUNCATE these
-- tables directly via PostgREST, with nothing checking who they are.
-- All three are empty on Claude TEST CMS at the time of this fix, so
-- nothing was actually exposed there, but the same gap is expected on
-- any other Supabase project built from this schema, including
-- british-trade-awards-cms (production) — this must be applied there
-- too before go-live.
--
-- Pattern used: migrations/052-rls-policies.sql's service-role-only
-- model (service_role_all + no_direct_client_access), NOT migration
-- 000's older "Allow all access ... USING (true)" pattern. All real
-- access to these 3 tables already goes through api/data-proxy.js
-- (SUPABASE_SERVICE_KEY, which bypasses RLS) — judge_conflicts via
-- apiClient.select/selectAll/deleteByFilters, email_logs only as a
-- GDPR export/delete table-list entry, and sponsorships isn't
-- referenced by any application code at all. None of the three need
-- direct anon/authenticated access, so the restrictive pattern is the
-- correct one — the permissive pattern would not have closed anything,
-- since the pre-existing broad grants already made `USING (true)`
-- equivalent to no RLS at all.
--
-- Idempotent: ALTER TABLE ... ENABLE ROW LEVEL SECURITY is a no-op if
-- already enabled; CREATE POLICY is wrapped in exception handling for
-- duplicate_object, matching migration 052's own idempotency approach
-- exactly (Postgres has no CREATE POLICY IF NOT EXISTS).
-- ============================================================

DO $$
DECLARE
  tbls TEXT[] := ARRAY['email_logs', 'judge_conflicts', 'sponsorships'];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    BEGIN
      EXECUTE format(
        'CREATE POLICY "service_role_all" ON %I FOR ALL USING (auth.role() = ''service_role'')',
        tbl
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      EXECUTE format(
        'CREATE POLICY "no_direct_client_access" ON %I FOR ALL USING (false)',
        tbl
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
