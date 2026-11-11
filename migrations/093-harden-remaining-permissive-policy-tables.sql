-- ============================================================
-- Migration 093: Correct the remaining permissive-policy exposure
-- on organisations, organisation_contacts, gdpr_requests, entries,
-- award_assignments, invoices, payments and award_years (BTA-080)
-- ============================================================
-- BTA-078/079 found, via a direct live read-only connection to
-- production (qdzyknercdqwhwijbcxf), that all 8 tables below still
-- carry their original `migrations/000-complete-database-setup.sql`
-- (or, for gdpr_requests, `046-catchup-missing-objects.sql`) permissive
-- policy -- `USING (true) WITH CHECK (true)`, role `public` -- plus full
-- `anon`/`authenticated` grants (SELECT/INSERT/UPDATE/DELETE/TRUNCATE/
-- REFERENCES/TRIGGER). This is the exact same bug pattern already fixed
-- for 35 other tables by migrations 078/080/084/085/086/087/088: a
-- PERMISSIVE `USING (true)` policy ORs together with any other
-- PERMISSIVE policy on the same table, so a narrower or `USING (false)`
-- policy added *alongside* it (rather than replacing it) changes nothing.
--
-- migrations/052-rls-policies.sql was intended to fix 7 of these 8
-- tables (organisations, award_years, entries, award_assignments,
-- event_guests, invoices, payments) by adding `service_role_all` and
-- `no_direct_client_access` -- but it never drops the original
-- permissive policy first, so applying it as written would not have
-- closed the exposure on any of the 7 (confirmed by re-reading the file:
-- no `DROP POLICY` statement for the original policy name appears
-- anywhere in it). migrations/045-proper-rls-policies.sql separately
-- defines a DIFFERENT intended end-state for the same 6 tables (minus
-- event_guests, which 045 does not mention at all) --
-- `organisations_select`/`entries_select`/`award_years_select`/
-- `invoices_select`/`payments_select`/`award_assignments_select`,
-- `authenticated`-role, read-only -- that 052 does not drop either.
-- Both 045 and 052 are themselves still unapplied to production
-- (confirmed live: neither set of replacement policies exists), so this
-- is not a live conflict today, but it would become one if 045 and 052
-- were ever both applied in their current form, and it must be resolved
-- before this gap is closed rather than left for a future surprise.
--
-- Resolution (BTA-080, evidence-based, not assumed): a fresh repository-
-- wide grep of every browser-facing `.js`/`.html` file (excluding
-- `api/`, `tests/`, `dist/`, and the offline `scripts/` CLI tools, which
-- run locally with their own credentials, never in a browser) for direct
-- `supabase.from()`/`supabase.rpc()` calls against organisations,
-- organisation_contacts, gdpr_requests, entries, award_assignments,
-- invoices, award_years or payments found ZERO matches. The only direct
-- browser-side Supabase table/RPC access anywhere in this repository is
-- check-in-app.js's use of `events`/`event_guests` (see below) --
-- confirmed by also checking every other file that constructs a
-- client-side Supabase client (`reset-password.js`, `auth.js`,
-- `public-utils.js`) and finding each one uses it only for
-- `supabase.auth.*` session calls, never `.from()`/`.rpc()`. Every
-- legitimate read/write for all 8 tables in this migration already
-- routes through `api/data-proxy.js` or `api/entry-proxy.js`, both of
-- which connect with `SUPABASE_SERVICE_KEY` exclusively (re-confirmed
-- this task: `api/data-proxy.js:31`, `api/entry-proxy.js:21`), which
-- bypasses RLS entirely regardless of any policy here. This means
-- 045's `authenticated`-read design is not needed by anything that
-- currently exists, and 052's fully-locked-down design (service_role
-- only, no direct client access of any kind) is the one actually
-- consistent with how this application is built. This migration
-- therefore supersedes migration 052's intent for the 6 tables it
-- overlaps with (organisations, award_years, entries, award_assignments,
-- invoices, payments), extends the identical treatment to
-- organisation_contacts and gdpr_requests (which neither 045's nor 052's
-- array ever covered), and defensively drops 045's own policy names too,
-- in case 045 is ever found applied in some other environment. If a
-- genuine need for direct `authenticated` read access to any of these 8
-- tables is identified in the future, that is a new, separate, narrowly-
-- scoped policy decision -- not a reason to leave the current unrestricted
-- `public`-role exposure in place in the meantime.
--
-- event_guests is deliberately EXCLUDED from this migration. It is the
-- one table in BTA-079's original 9-table list with a confirmed, real,
-- already-solved browser dependency: check-in-app.js (the deployed
-- Event Check-in page, check-in.html) makes direct `authenticated`-role
-- Supabase calls against it (SELECT to load/look up guests, UPDATE to
-- mark checked_in/check_in_time -- no INSERT, no DELETE, re-confirmed by
-- reading check-in-app.js directly this task). migrations/078 already
-- drops the original permissive policy on event_guests specifically
-- (`DROP POLICY IF EXISTS "Allow all access to event_guests" ON
-- event_guests`), and migrations/079 already adds the exact minimum
-- replacement (`event_guests_select`/`event_guests_update`,
-- `authenticated` role, SELECT/UPDATE only). Together, 078+079 already
-- fully and correctly close event_guests' exposure without this
-- migration's help; touching it again here would only add risk for no
-- benefit, and 052's own `no_direct_client_access` policy for
-- event_guests (USING (false), no TO clause, so it would apply to every
-- role) is harmless to apply alongside 078/079 if 052 is ever corrected
-- and applied on its own, since PERMISSIVE policies only add access via
-- OR, never subtract it -- but this migration does not depend on that
-- and takes no position on 052's own fate.
--
-- gdpr_requests needed one extra check beyond the other 7: its live
-- state (confirmed by BTA-079's direct query) carries THREE permissive
-- policies simultaneously -- "Allow all access to gdpr_requests" (from
-- migration 046's PART 3 grant-array loop), "Allow anon read on
-- gdpr_requests" and "Allow authenticated full access on gdpr_requests"
-- (source migration not identified in tracked SQL -- likely created
-- directly against the database outside the tracked migration history,
-- the same "unidentified policy source" pattern BTA-021/052 already
-- documented for other tables). All three are dropped by exact name
-- below.
--
-- Does NOT touch erase_organisation_gdpr or anonymize_organisation --
-- their return-contract and EXECUTE-grant corrections already exist in
-- migrations/089-secure-gdpr-erasure-rpc.sql and
-- migrations/092-fix-anonymize-organisation-return-contract.sql and are
-- not duplicated here.
--
-- Idempotent: every DROP POLICY IF EXISTS is a no-op if already removed;
-- every CREATE POLICY is wrapped in duplicate_object exception handling
-- (matching migrations 052/080/086/087/088's own convention); REVOKE on
-- a privilege that was never granted, or already revoked, is a no-op in
-- PostgreSQL, not an error. Does not modify or delete any row of data.
--
-- NOT APPLIED by this authoring task (BTA-080). Must be run against a
-- non-production test/staging project first, verified, and only then
-- applied to production, per this project's standard migration process.
-- See BTA-080's report for the proposed ordering relative to migrations
-- 052/079/087/088/089/091/092 and the pre/post-application verification
-- queries.
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'organisations', 'organisation_contacts', 'entries',
    'award_assignments', 'invoices', 'payments', 'award_years'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    -- The original, still-live permissive policy.
    EXECUTE format('DROP POLICY IF EXISTS "Allow all access to %s" ON %I', tbl, tbl);

    -- migrations/045's own policy names for this table, dropped
    -- defensively in case 045 is ever found applied elsewhere.
    EXECUTE format('DROP POLICY IF EXISTS "%s_service" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_anon_select" ON %I', tbl, tbl);

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    BEGIN
      EXECUTE format('CREATE POLICY "service_role_all" ON %I FOR ALL USING (auth.role() = ''service_role'')', tbl);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      EXECUTE format('CREATE POLICY "no_direct_client_access" ON %I FOR ALL USING (false)', tbl);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    EXECUTE format('REVOKE ALL ON public.%I FROM anon', tbl);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', tbl);
  END LOOP;
END $$;

-- gdpr_requests: same treatment, plus its two extra live permissive
-- policies (see header comment).
DROP POLICY IF EXISTS "Allow all access to gdpr_requests" ON gdpr_requests;
DROP POLICY IF EXISTS "Allow anon read on gdpr_requests" ON gdpr_requests;
DROP POLICY IF EXISTS "Allow authenticated full access on gdpr_requests" ON gdpr_requests;

ALTER TABLE gdpr_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN
    EXECUTE 'CREATE POLICY "service_role_all" ON gdpr_requests FOR ALL USING (auth.role() = ''service_role'')';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    EXECUTE 'CREATE POLICY "no_direct_client_access" ON gdpr_requests FOR ALL USING (false)';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

REVOKE ALL ON public.gdpr_requests FROM anon;
REVOKE ALL ON public.gdpr_requests FROM authenticated;

NOTIFY pgrst, 'reload schema';
