-- ============================================================
-- Migration 092: Fix anonymize_organisation's silent-no-op return
-- contract (BTA-077)
-- ============================================================
-- BTA-076 fixed this exact bug class for erase_organisation_gdpr
-- (migration 089): a RETURNS VOID function with no existence check gives
-- the caller no way to distinguish "the organisation existed and was
-- processed" from "p_org_id matched nothing" -- both return successfully
-- with no error, so the application (gdpr.js) marks the GDPR request
-- 'completed' either way.
--
-- BTA-077 found anonymize_organisation(UUID) -- the sibling GDPR
-- "anonymise" RPC, used by gdpr.js's processRequest() for
-- request_type: 'anonymize' -- has the exact same defect:
--
--   CREATE OR REPLACE FUNCTION anonymize_organisation(p_org_id UUID)
--   RETURNS VOID AS $$
--   BEGIN
--     UPDATE organisations SET ... WHERE id = p_org_id;
--     UPDATE organisation_contacts SET ... WHERE organisation_id = p_org_id;
--   END;
--   $$ LANGUAGE plpgsql;
--
-- Both UPDATEs affect zero rows for a non-existent or already-processed
-- p_org_id, with no error and no way to tell. gdpr.js's processRequest()
-- (the only caller) calls this RPC and -- unlike the erasure path, which
-- BTA-076 already fixed to inspect the result -- does not inspect the
-- result at all:
--
--   } else if (requestType === 'anonymize') {
--     await apiClient.rpc('anonymize_organisation', { p_org_id: entityId });
--   }
--   // ... unconditionally falls through to marking the request 'completed'
--
-- So a GDPR anonymisation request against an invalid or already-erased
-- organisation id is reported as 'completed' today, identically to the
-- erasure bug BTA-076 fixed -- this migration and gdpr.js's corresponding
-- fix (same task) close the same gap for this second RPC.
--
-- This function is defined identically (same body, same signature) in
-- TWO existing migrations: 015-localstorage-to-supabase.sql (the original
-- authoring) and 046-catchup-missing-objects.sql (a later idempotent
-- re-creation via CREATE OR REPLACE, not a conflicting definition --
-- confirmed byte-for-byte identical). Unlike migration 089's RPC, this
-- means anonymize_organisation in its OLD (VOID-returning) form may
-- already be live in any database that has run migration 015, which
-- predates this project's migration-authoring/applying split -- this
-- migration cannot assume a fresh, never-applied function the way 089
-- could. The DROP FUNCTION IF EXISTS below is therefore not just
-- defensive but likely necessary on a real database: CREATE OR REPLACE
-- FUNCTION cannot change an existing function's return type (VOID -> TEXT
-- here), and this one has a real, demonstrated prior existence path.
--
-- Also applies the same two defense-in-depth corrections already applied
-- to erase_organisation_gdpr by migration 089, for consistency and because
-- they are independently justified here on the same reasoning:
--   - SET search_path = public (SECURITY INVOKER is unchanged and was
--     always the default here too -- no SECURITY DEFINER keyword was ever
--     present in either prior definition -- so, as with migration 089,
--     this is schema-drift hardening, not closing a privilege-escalation
--     path that doesn't exist for an invoker-rights function).
--   - REVOKE EXECUTE FROM PUBLIC, anon, authenticated. Migration 089
--     already contains an identical REVOKE for this same function
--     (harmless if both migrations are ever applied -- REVOKE on an
--     already-revoked privilege is a no-op, not an error), but is
--     repeated here so this migration is independently complete and does
--     not silently depend on 089 having been applied first for its own
--     security intent to take effect.
--
-- NOT APPLIED by this authoring task. Must be run against a test project
-- first, verified, and only then applied to production, per this
-- project's standard migration process. See BTA-077's report for the
-- required pre/post-application verification queries and the proposed
-- application order relative to migrations 087/088/089/091.
-- ============================================================

DROP FUNCTION IF EXISTS anonymize_organisation(UUID);

CREATE OR REPLACE FUNCTION anonymize_organisation(p_org_id UUID) RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_existed BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM organisations WHERE id = p_org_id) INTO v_existed;
  IF NOT v_existed THEN
    RETURN 'not_found';
  END IF;

  UPDATE organisations SET
    company_name = 'REDACTED-' || LEFT(p_org_id::TEXT, 8),
    email = NULL,
    contact_phone = NULL,
    website = NULL,
    address = NULL,
    postcode = NULL,
    contact_name = NULL,
    notes = NULL
  WHERE id = p_org_id;

  UPDATE organisation_contacts SET
    first_name = 'REDACTED',
    last_name = 'REDACTED',
    email = NULL,
    phone = NULL,
    job_title = NULL
  WHERE organisation_id = p_org_id;

  RETURN 'anonymized';
END;
$$;

REVOKE EXECUTE ON FUNCTION anonymize_organisation(UUID) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
