-- ============================================================
-- Migration 086: Harden RLS and grants on email_list_subscribers
-- ============================================================
-- BTA-024 (2026) found that public.email_list_subscribers has always
-- retained the original migration-000/007/008 permissive state:
--   - RLS enabled, but the only policy is
--     "Allow all access to email_list_subscribers"
--     (FOR ALL, roles = PUBLIC, USING (true), WITH CHECK (true))
--   - anon and authenticated both hold full SELECT/INSERT/UPDATE/DELETE/
--     TRUNCATE grants (migrations 007 and 008)
-- This was never covered by migration 045's RLS-hardening array, which
-- only ever named the email_list_members view, not the real table — see
-- BTA-023.
--
-- BTA-025/026 traced every legitimate access path and confirmed:
--   - The Email Lists / Email Builder admin UI (email-lists.js,
--     email-builder.js) already goes exclusively through
--     apiClient -> /api/data-proxy (server-side, service-role key).
--   - All three campaign-sending implementations (the send_campaign_emails
--     RPC used by the live UI, api/resend-email.js's send-campaign action,
--     and the supabase/functions/send-campaign Edge Function) use a
--     service-role client and are unaffected by this table's grants/RLS.
--   - The one remaining direct-browser-client dependency,
--     test-data-manager.js's email-list fixture generation/cleanup, was
--     migrated (BTA-027) to the new super_admin-only, environment-guarded
--     `test_data_fixture` operation in api/data-proxy.js, which uses the
--     shared service-role client and never needs a direct anon/
--     authenticated grant on this table.
--
-- With that dependency removed, no legitimate feature needs anon or
-- authenticated to reach this table directly, so this migration:
--   1. Drops the obsolete permissive policy (PostgreSQL ORs multiple
--      PERMISSIVE policies together, so simply adding a restrictive
--      policy alongside it would do nothing -- see migration 078's
--      identical event_guests precedent).
--   2. Adds the repository's established service_role_all /
--      no_direct_client_access policy pair (migrations 052, 080).
--   3. Revokes the SELECT/INSERT/UPDATE/DELETE/TRUNCATE grants from anon
--      and authenticated (migration 007's original grants). service_role
--      privileges are untouched -- service_role bypasses RLS entirely
--      regardless of grants or policies.
--
-- Scope: public.email_list_subscribers only. Does not touch the
-- email_list_members view (test-project-only; already correctly
-- configured with security_invoker=true per migration 083, and reads
-- through to this table's own, now-hardened, restrictions) or any other
-- table's policies or grants.
--
-- Idempotent: DROP POLICY IF EXISTS is a no-op if already removed;
-- CREATE POLICY is wrapped in duplicate_object exception handling,
-- matching migrations 052/080's own approach; REVOKE on a privilege that
-- was never granted (or already revoked) is a no-op in PostgreSQL, not
-- an error.
--
-- NOT APPLIED by this migration file's authoring task (BTA-027). This
-- file has been created and reviewed as source only -- it must be run
-- against the test project first, verified, and only then applied to
-- production, per the project's standard migration process.
-- ============================================================

DROP POLICY IF EXISTS "Allow all access to email_list_subscribers" ON email_list_subscribers;

DO $$
BEGIN
  BEGIN
    EXECUTE 'CREATE POLICY "service_role_all" ON email_list_subscribers FOR ALL USING (auth.role() = ''service_role'')';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    EXECUTE 'CREATE POLICY "no_direct_client_access" ON email_list_subscribers FOR ALL USING (false)';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.email_list_subscribers FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.email_list_subscribers FROM authenticated;

NOTIFY pgrst, 'reload schema';
