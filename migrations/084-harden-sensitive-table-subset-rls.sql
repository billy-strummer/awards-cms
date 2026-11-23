-- ============================================================
-- Migration 084: Harden RLS on the sensitive subset of remaining
-- migration-000 permissive tables
-- ============================================================
-- Empirical investigation (Claude TEST CMS, 2026-07-22) proved real,
-- exploitable anon-key read/write/delete access across the highest-
-- sensitivity tables still on the original migration-000 permissive
-- policy. Representative real anon-key REST proofs:
--   - user_roles: anon SELECT returned the real admin account's email
--     and super_admin role.
--   - sponsor_contracts: anon SELECT returned a real contract's amount,
--     currency, and confidential notes.
--   - gdpr_requests: anon SELECT returned a real data-subject's email
--     and request details; anon DELETE actually destroyed that legal
--     request record (confirmed gone via service-role re-read).
--   - cms_audit_logs: anon SELECT returned a real audit entry despite
--     migration 056's explicit intent to make this table service-role
--     -select-only and immutable; anon INSERT successfully forged a
--     fabricated audit log entry.
--   - webhooks: anon SELECT returned a real webhook's signing secret in
--     full -- the single most severe individual finding in this batch,
--     since a leaked signing secret allows forging webhook payloads.
--   - contact_segments (real row) and the remaining ~20 empty tables in
--     this batch were confirmed structurally open to anon (HTTP 200,
--     no permission error) via the same "Allow all access to X" grant
--     shape already proven exploitable on email_logs/judge_conflicts/
--     sponsorships (migration 077) and public_votes/judge_scores/etc
--     (migration 080).
--
-- Why the app doesn't already prevent this: as with prior findings,
-- data-proxy.js (service-role key) is the real, intended access path
-- and isn't affected by anon/authenticated grants at all. The bug is
-- purely that RLS was never hardened past the original migration-000
-- policy on these tables specifically.
--
-- Browser-side dependency check found ONE real, working exception:
-- judge-login.html creates its own Supabase client and, after a real
-- sign-in, queries `user_roles` directly (SELECT, filtered to the
-- current session's own email) to gate access to the judge portal.
-- judge-portal.js's own `user_roles` read goes through apiClient (server
-- -side, unaffected). This is a genuine dependency -- handled below with
-- a least-privilege restore, not a blanket lockdown, per the same
-- principle applied to event_guests in migrations 078/079: reusing the
-- existing user_email() row-ownership helper (already used by
-- entries_update) rather than inventing a new pattern, and scoped to
-- exactly what the feature needs (SELECT of the caller's own row only --
-- judge-login.html never writes to user_roles). No other file among
-- the tables in this batch has any direct browser-side Supabase client
-- dependency (confirmed via full-codebase grep).
--
-- The tables in this batch fall into four categories based on their
-- ACTUAL existing policy shape (not a single assumed pattern), each
-- handled to preserve -- not redesign -- whatever policy intent already
-- existed:
--
-- A) Tables with ONLY the migration-000 "Allow all access" policy and no
--    other hardening: drop it, add the standard migration-052
--    service_role_all + no_direct_client_access pair.
-- B) Tables that ALREADY have a correct authenticated-scoped policy
--    (<table>_select or <table>_auth) plus a service-role policy, where
--    the migration-000 leftover was silently cancelling that correct
--    design via permissive-policy OR-combination (the exact same bug
--    shape as event_guests/public_votes): drop ONLY the leftover.
--    Nothing is added -- the existing, already-correct policy already
--    covers the intended access.
-- C) cms_audit_logs and gdpr_requests: both also carry an EXPLICIT
--    "Allow anon read on X" + "Allow authenticated full access on X"
--    pair from migration 015 (a deliberate, blanket decision made across
--    a batch of tables during an early localStorage-migration phase,
--    long before the later per-table hardening effort). cms_audit_logs
--    additionally has migration 056's correct, already-hardened
--    audit_service_insert/audit_service_select/audit_no_delete/
--    audit_no_update policies, which this migration does not touch --
--    dropping the 3 migration-000/015 leftovers is sufficient there.
--    gdpr_requests has no other hardening, so also gets the standard
--    service_role_all + no_direct_client_access pair after its 3
--    leftovers are dropped.
-- D) user_roles: the one table with a real browser-side dependency.
--    Drop the leftover, add a row-ownership SELECT policy reusing
--    user_email() (matching entries_update's existing pattern) so each
--    authenticated user can read only their own role row -- exactly
--    what judge-login.html needs and nothing more -- plus the standard
--    service_role_all policy.
-- ============================================================

-- Category A: drop-only-leftover tables get the standard 052 pattern
DO $$
DECLARE
  tbls TEXT[] := ARRAY[
    'ai_vetting_results', 'ai_vetting_runs', 'api_request_logs',
    'document_versions', 'entry_files', 'invoice_line_items',
    'ip_blocklist', 'payment_reminders', 'rate_limit_alerts',
    'rate_limit_config', 'sponsor_contracts', 'webhook_logs'
  ];
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

-- Category B: tables that already have a correct authenticated + service
-- policy pair -- only remove the leftover permissive policy cancelling it
DO $$
DECLARE
  tbls TEXT[] := ARRAY[
    'contact_segments', 'documents', 'entry_revisions', 'meeting_notes',
    'org_audit_log', 'organisation_comms_log', 'organisation_custom_fields',
    'organisation_documents', 'organisation_images', 'organisation_notes',
    'organisation_relationships', 'organisation_segments', 'webhooks'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow all access to %s" ON %I', tbl, tbl);
  END LOOP;
END $$;

-- Category C: cms_audit_logs -- drop the 3 migration-000/015 leftovers,
-- leave migration 056's correct hardening untouched
DROP POLICY IF EXISTS "Allow all access to cms_audit_logs" ON cms_audit_logs;
DROP POLICY IF EXISTS "Allow anon read on cms_audit_logs" ON cms_audit_logs;
DROP POLICY IF EXISTS "Allow authenticated full access on cms_audit_logs" ON cms_audit_logs;

-- Category C: gdpr_requests -- drop the 3 leftovers, then add the
-- standard 052 pattern (no other hardening exists for this table)
DROP POLICY IF EXISTS "Allow all access to gdpr_requests" ON gdpr_requests;
DROP POLICY IF EXISTS "Allow anon read on gdpr_requests" ON gdpr_requests;
DROP POLICY IF EXISTS "Allow authenticated full access on gdpr_requests" ON gdpr_requests;
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

-- Category D: user_roles -- least-privilege restore for judge-login.html's
-- real dependency, reusing the existing user_email() row-ownership
-- pattern (matches entries_update) rather than inventing a new one
DROP POLICY IF EXISTS "Allow all access to user_roles" ON user_roles;
DO $$
BEGIN
  BEGIN
    EXECUTE 'CREATE POLICY "user_roles_own_row_select" ON user_roles FOR SELECT TO authenticated USING (email = user_email())';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    EXECUTE 'CREATE POLICY "service_role_all" ON user_roles FOR ALL USING (auth.role() = ''service_role'')';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

NOTIFY pgrst, 'reload schema';
