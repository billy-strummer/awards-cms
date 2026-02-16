-- ============================================================
-- Migration 009: Add extended fields to organisations table
-- Adds: description, achievements, company_size, employee_count,
--        year_founded, social media URLs, tier
-- Also creates audit_log and comms_log tables in Supabase
-- ============================================================

-- Extended organisation fields
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS achievements TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS company_size VARCHAR(50);
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS employee_count INTEGER;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS year_founded INTEGER;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS twitter_url TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS tier VARCHAR(50);

-- Audit log table (replaces localStorage-based audit trail)
CREATE TABLE IF NOT EXISTS org_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  company_name TEXT,
  action TEXT NOT NULL,
  details TEXT,
  user_email VARCHAR(255),
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patch columns if table already existed without them
ALTER TABLE org_audit_log ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);
ALTER TABLE org_audit_log ADD COLUMN IF NOT EXISTS old_value TEXT;
ALTER TABLE org_audit_log ADD COLUMN IF NOT EXISTS new_value TEXT;

CREATE INDEX IF NOT EXISTS idx_org_audit_log_org ON org_audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_org_audit_log_created ON org_audit_log(created_at DESC);

ALTER TABLE org_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to org_audit_log" ON org_audit_log;
CREATE POLICY "Allow all access to org_audit_log"
  ON org_audit_log FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.org_audit_log TO anon;
GRANT ALL ON public.org_audit_log TO authenticated;
GRANT ALL ON public.org_audit_log TO service_role;

-- Communications log table (replaces localStorage-based comms history)
-- Table name must match JS code: organisation_comms_log (not org_comms_log)
CREATE TABLE IF NOT EXISTS organisation_comms_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  template_id TEXT,
  template_name TEXT,
  subject VARCHAR(500),
  message TEXT,
  direction VARCHAR(20) DEFAULT 'outbound',
  channel VARCHAR(50) DEFAULT 'email',
  sent_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_comms_log_org ON organisation_comms_log(organisation_id);

ALTER TABLE organisation_comms_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to organisation_comms_log" ON organisation_comms_log;
CREATE POLICY "Allow all access to organisation_comms_log"
  ON organisation_comms_log FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.organisation_comms_log TO anon;
GRANT ALL ON public.organisation_comms_log TO authenticated;
GRANT ALL ON public.organisation_comms_log TO service_role;

-- Clean up old misnamed table if it exists
DROP TABLE IF EXISTS org_comms_log;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
