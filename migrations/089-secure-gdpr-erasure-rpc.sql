-- ============================================================
-- Migration 089: Atomic, properly-restricted GDPR erasure RPC
-- ============================================================
-- BTA-064/Priority 4: gdpr.js's _deleteEntityData() previously ran 13
-- sequential apiClient.deleteByFilters() calls from the client, one per
-- table, with no transaction wrapping them. A failure partway through
-- (e.g. after entries but before organisations) left a partially-erased,
-- non-compliant record with no automatic rollback and no safe way to
-- resume (re-running from the top would error on tables already emptied
-- for this organisation, though re-running is itself harmless since every
-- DELETE here is naturally idempotent -- deleting rows that no longer
-- exist is a no-op, not an error).
--
-- Fix: move the entire 13-table cascade into a single plpgsql function.
-- Postgres executes a function body as part of the calling statement's
-- transaction, so if any single DELETE fails, every DELETE already run
-- earlier in the same call is automatically rolled back -- no explicit
-- BEGIN/COMMIT/ROLLBACK needed. This mirrors the exact existing pattern
-- already used for the sibling "anonymize" GDPR action in this same file
-- (anonymize_organisation(), migration 046) -- not a new architecture.
--
-- Table list and order are unchanged from gdpr.js's existing, already-
-- reviewed cascade (children first, organisations last) -- this migration
-- does not add, remove, or reorder any table, and does NOT delete
-- invoices/payments, matching the existing code's own (undocumented but
-- apparently deliberate) exclusion of financial records from erasure.
-- Confirming or correcting that retention decision is a legal/business
-- question this migration does not decide.
--
-- Also fixes a related, newly-found gap: anonymize_organisation() (the
-- sibling GDPR "anonymize" RPC, migration 046) has never had its EXECUTE
-- privilege restricted -- the same vulnerability class as migration 081's
-- email-sending functions (PostgREST auto-exposes every Postgres function
-- as a public /rest/v1/rpc/<name> endpoint regardless of the app's own
-- ALLOWED_RPCS role gate in api/data-proxy.js). Both this new function and
-- the pre-existing one are restricted to service_role only below.
--
-- NOT APPLIED by this authoring task. Must be run against the test
-- project first, verified, and only then applied to production, per this
-- project's standard migration process.
--
-- BTA-076 correction (this function was never applied anywhere, so this
-- replaces the original authoring in place rather than layering a second
-- migration on top of one that has no live effect to preserve):
--
-- 1. Three of the thirteen table names below were wrong:
--    crm_communications/crm_deals/crm_meetings do not exist anywhere in
--    this project's schema. The canonical names -- confirmed by
--    database-crm-setup.sql's own CREATE TABLE statements, and by every
--    real read/write in crm.js and api/data-proxy.js's
--    ALLOWED_TABLES/MUTABLE_TABLES/ROLE_PERMISSIONS -- are
--    `communications`, `deals`, `meeting_notes`. No RENAME TABLE for any
--    of these names exists anywhere in the migration history. Before this
--    fix, calling this function (once applied) would have failed with a
--    "relation does not exist" error on the first of these three DELETEs,
--    every single time, for every organisation -- atomically and safely
--    (the whole function is one transaction, so nothing partial would
--    ever have been erased), but never actually completing an erasure.
--
-- 2. Added `SET search_path = public`. This function is SECURITY INVOKER
--    (unchanged -- see point 4), so the classic SECURITY DEFINER
--    search_path-hijacking privilege-escalation risk does not apply here:
--    the function already runs with the caller's own privileges (always
--    service_role in practice, since the only caller is
--    api/data-proxy.js's service-role Supabase client). Pinning the
--    search_path is still worthwhile defense-in-depth -- it removes any
--    dependency on the calling session's own search_path configuration,
--    guarding against future schema additions or configuration drift --
--    not because a specific exploit is demonstrated today.
--
-- 3. Changed the return type from VOID to TEXT, returning either
--    'erased' or 'not_found'. VOID gave the caller no way to tell "the
--    organisation existed and all 13 cascades ran" apart from "p_org_id
--    matched nothing anywhere" -- a syntactically valid but non-existent
--    (or already-erased) UUID would complete successfully and report
--    nothing happened as indistinguishable from a real erasure. The
--    application (gdpr.js's _deleteEntityData) now inspects this value
--    and treats anything other than 'erased' as a failure, so a GDPR
--    request is never marked completed for an erasure that did not
--    actually happen.
--
-- 4. SECURITY INVOKER (the default, unchanged), execute grants (unchanged)
--    and the table list/order/scope (unchanged, other than the 3 name
--    corrections above) were all re-reviewed and found correct as
--    originally authored -- not altered beyond what's described above.
--
-- The DROP FUNCTION below is required, not just defensive: PostgreSQL's
-- CREATE OR REPLACE FUNCTION cannot change an existing function's return
-- type (VOID -> TEXT here) and errors if attempted directly. This
-- function has never been applied anywhere, so on a first application
-- the DROP is a safe no-op; it only matters if this file is ever re-run
-- against a database that already has an earlier (VOID-returning)
-- version from some other source.
-- ============================================================

DROP FUNCTION IF EXISTS erase_organisation_gdpr(UUID);

CREATE OR REPLACE FUNCTION erase_organisation_gdpr(p_org_id UUID) RETURNS TEXT
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

  DELETE FROM email_logs WHERE organisation_id = p_org_id;
  DELETE FROM event_guests WHERE organisation_id = p_org_id;
  DELETE FROM public_votes WHERE organisation_id = p_org_id;
  DELETE FROM organisation_contacts WHERE organisation_id = p_org_id;
  DELETE FROM award_assignments WHERE organisation_id = p_org_id;
  DELETE FROM entries WHERE organisation_id = p_org_id;
  DELETE FROM organisation_images WHERE organisation_id = p_org_id;
  DELETE FROM communications WHERE organisation_id = p_org_id;
  DELETE FROM deals WHERE organisation_id = p_org_id;
  DELETE FROM meeting_notes WHERE organisation_id = p_org_id;
  DELETE FROM organisation_notes WHERE organisation_id = p_org_id;
  DELETE FROM organisation_follow_ups WHERE organisation_id = p_org_id;
  DELETE FROM organisations WHERE id = p_org_id;

  RETURN 'erased';
END;
$$;

REVOKE EXECUTE ON FUNCTION erase_organisation_gdpr(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION anonymize_organisation(UUID) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
