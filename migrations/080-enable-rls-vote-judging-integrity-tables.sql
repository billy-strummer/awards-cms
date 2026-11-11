-- ============================================================
-- Migration 080: Harden RLS on vote/judging-integrity tables
-- ============================================================
-- Empirical investigation (Claude TEST CMS, 2026-07-22) proved that
-- public_votes, judge_scores, shortlists, winner_documents, winner_media,
-- and deliberation_notes all still carry only the original migration-000
-- policy ("Allow all access to X", FOR ALL, roles={public}, USING(true),
-- WITH CHECK(true)) plus full anon/authenticated grants.
--
-- NOTE: this is the event_guests-shaped bug (migration 078), not the
-- email_logs-shaped bug (migration 077): RLS is already ENABLED on all 6
-- tables here, with a leftover permissive USING(true) policy still
-- present. Simply adding service_role_all/no_direct_client_access
-- alongside that leftover policy would do nothing -- Postgres ORs
-- multiple PERMISSIVE policies together, so the old USING(true) policy
-- alone still grants anon/authenticated full access regardless of any
-- new policy added beside it. The obsolete policy must be dropped, same
-- as migration 078. Unlike event_guests, no follow-up "restore access"
-- migration (like 079) is needed here -- see the browser-dependency check
-- below, which found no legitimate feature relying on direct client
-- access to any of these 6 tables, so drop+harden is done in one step.
--
-- Proof (real anon-key REST calls against real rows, not just inspection):
--   - anon SELECT returned real rows on all 6 tables, including a
--     winner_documents row explicitly flagged is_public:false -- proving
--     that flag is a UI convention only, not enforced by the database.
--   - anon INSERT into public_votes succeeded (HTTP 201, real row
--     created) -- an unauthenticated ballot-stuffing vector that bypasses
--     every check in api/voting-proxy.js (IP/email rate-limiting,
--     duplicate-vote checks, email verification) entirely.
--   - anon UPDATE on judge_scores succeeded (HTTP 200) and was confirmed,
--     via a service-role re-read, to have actually changed total_score
--     from 42 to 100 in the real row -- direct tampering with blind
--     judging scores.
--
-- Why the app doesn't already prevent this: api/voting-proxy.js and the
-- judge portal (via apiClient -> /api/data-proxy, both server-side,
-- service-role key) are the *intended* access paths and do enforce their
-- own validation/rate-limiting -- but that enforcement lives entirely in
-- application code. Nothing in the database itself stops a request that
-- skips the proxy and calls the Supabase REST API directly with the
-- public anon key.
--
-- Browser-side dependency check (required before this migration): grepped
-- the full frontend for direct supabase.createClient()/`.from()` usage
-- against these 6 tables. None found -- nominee-voting.js/public-voting.js
-- only read the denormalized entries.public_votes counter (a different
-- column, unaffected by this migration), and judge-portal.js reads/writes
-- judge_scores exclusively via apiClient, which routes through
-- /api/data-proxy (server-side, service-role key). No feature depends on
-- browser-side anon/authenticated access to any of these 6 tables, so the
-- standard service-role-only lockdown (migration-052 pattern) applies
-- with no follow-up "restore access" migration needed, unlike event_guests.
-- ============================================================

DO $$
DECLARE
  tbls TEXT[] := ARRAY['public_votes', 'judge_scores', 'shortlists', 'winner_documents', 'winner_media', 'deliberation_notes'];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow all access to %s" ON %I', tbl, tbl);
    BEGIN
      EXECUTE format('CREATE POLICY "service_role_all" ON %I FOR ALL USING (auth.role() = ''service_role'')', tbl);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      EXECUTE format('CREATE POLICY "no_direct_client_access" ON %I FOR ALL USING (false)', tbl);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
