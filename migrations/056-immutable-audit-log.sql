-- Migration 056: Make cms_audit_logs append-only (GDPR Article 5(1)(f))
-- Prevents admins from deleting their own audit trail entries.
-- Audit logs should only ever be inserted, never updated or deleted.
-- Safe to re-run: exception handlers absorb duplicate policy errors.

ALTER TABLE cms_audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role full INSERT access (used by data-proxy server-side)
DO $$
BEGIN
  EXECUTE 'CREATE POLICY "audit_service_insert" ON cms_audit_logs
    FOR INSERT USING (auth.role() = ''service_role'')';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow service role to SELECT (for admin viewing)
DO $$
BEGIN
  EXECUTE 'CREATE POLICY "audit_service_select" ON cms_audit_logs
    FOR SELECT USING (auth.role() = ''service_role'')';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Block DELETE for all roles (audit logs are immutable)
DO $$
BEGIN
  EXECUTE 'CREATE POLICY "audit_no_delete" ON cms_audit_logs
    FOR DELETE USING (false)';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Block UPDATE for all roles (audit logs are immutable)
DO $$
BEGIN
  EXECUTE 'CREATE POLICY "audit_no_update" ON cms_audit_logs
    FOR UPDATE USING (false)';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
