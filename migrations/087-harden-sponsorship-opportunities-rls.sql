-- ============================================================
-- Migration 087: Harden RLS and grants on sponsorship_opportunities
-- ============================================================
-- BTA-019/020 (2026-10-23) found migration 045 revokes/replaces the
-- original migration-024 permissive policy on sponsorship_opportunities,
-- but migration 046 (run after 045) unconditionally re-creates
-- "Allow all access to sponsorship_opportunities" (FOR ALL, roles=PUBLIC,
-- USING(true), WITH CHECK(true)) and re-GRANTs ALL to anon/authenticated
-- -- the exact same "045 fixes it, 046 undoes it" pattern migration 086
-- fixed for email_list_subscribers. BTA-050 (2026-10-27) found this was
-- the one table from BTA-019/020's 13-table finding that migrations
-- 080/084/085 (which fixed the other 12) never covered.
--
-- Current state after migrations 024, 045 and 046 all run in order (not
-- verified against any live database by this task -- see the task sheet
-- for the read-only query that would confirm it): THREE permissive
-- policies coexist on this table --
--   - "Allow all access to sponsorship_opportunities" (migration 046,
--     roles=PUBLIC, USING(true)) -- alone already grants anon full access,
--     since PostgreSQL ORs multiple PERMISSIVE policies together (same
--     precedent as migrations 078/080/086).
--   - "sponsorship_opportunities_service" (migration 045, TO service_role,
--     USING(true)) -- redundant once service_role_all exists below;
--     service_role bypasses RLS entirely regardless.
--   - "sponsorship_opportunities_auth" (migration 045, TO authenticated,
--     USING(true)) -- grants ANY authenticated user (any logged-in judge,
--     voter, etc. if such accounts exist, not just admin-role staff) full
--     read/write on every row, bypassing the app's own role system
--     entirely.
--
-- Browser-side dependency check (required before this migration, same as
-- migration 080): grepped the full frontend for any reference to
-- `sponsorship_opportunities` -- none found. It is not even in
-- api/data-proxy.js's ALLOWED_TABLES, so the server-side proxy itself
-- cannot reach it either. No legitimate feature depends on any access
-- path to this table, so -- like migration 080 -- a full lockdown with no
-- follow-up "restore access" migration is safe.
--
-- Idempotent: DROP POLICY IF EXISTS is a no-op if already removed;
-- CREATE POLICY is wrapped in duplicate_object exception handling,
-- matching migrations 052/080/086's own approach; REVOKE on a privilege
-- that was never granted (or already revoked) is a no-op in PostgreSQL,
-- not an error.
--
-- NOT APPLIED by this migration file's authoring task (BTA-050). This
-- file has been created and reviewed as source only -- it must be run
-- against the test project first, verified, and only then applied to
-- production, per the project's standard migration process.
-- ============================================================

DROP POLICY IF EXISTS "Allow all access to sponsorship_opportunities" ON sponsorship_opportunities;
DROP POLICY IF EXISTS "sponsorship_opportunities_service" ON sponsorship_opportunities;
DROP POLICY IF EXISTS "sponsorship_opportunities_auth" ON sponsorship_opportunities;

DO $$
BEGIN
  BEGIN
    EXECUTE 'CREATE POLICY "service_role_all" ON sponsorship_opportunities FOR ALL USING (auth.role() = ''service_role'')';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    EXECUTE 'CREATE POLICY "no_direct_client_access" ON sponsorship_opportunities FOR ALL USING (false)';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

REVOKE ALL ON public.sponsorship_opportunities FROM anon;
REVOKE ALL ON public.sponsorship_opportunities FROM authenticated;

NOTIFY pgrst, 'reload schema';
