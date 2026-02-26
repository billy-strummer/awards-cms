-- ============================================
-- ENSURE tenant_branding TABLE EXISTS
-- ============================================
-- The branding module needs this table. Migration 021 originally
-- created it with a FK to tenants(id), but if that migration wasn't
-- run or the tenants table doesn't exist, the branding section fails.
--
-- This migration creates tenant_branding as a standalone table using
-- TEXT for tenant_id (instead of UUID FK) so it works regardless of
-- whether the tenants table exists.
-- ============================================

CREATE TABLE IF NOT EXISTS tenant_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT DEFAULT '#000000',
  secondary_color TEXT DEFAULT '#1a1a1a',
  accent_color TEXT DEFAULT '#D4AF37',
  company_name TEXT,
  tagline TEXT,
  email_from TEXT,
  email_reply_to TEXT,
  custom_domain TEXT,
  font_family TEXT DEFAULT '''Montserrat'', sans-serif',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure unique on tenant_id (may already exist from migration 021)
DO $$
BEGIN
  -- Drop the old FK-based unique constraint if it exists
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_branding_tenant_id_key') THEN
    NULL; -- already has unique constraint
  ELSE
    ALTER TABLE tenant_branding ADD CONSTRAINT tenant_branding_tenant_id_key UNIQUE (tenant_id);
  END IF;
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- If table was created by migration 021 with UUID tenant_id, alter to TEXT
-- so the branding module can use 'default' as tenant_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_branding' AND column_name = 'tenant_id' AND data_type = 'uuid'
  ) THEN
    -- Drop FK if exists
    ALTER TABLE tenant_branding DROP CONSTRAINT IF EXISTS tenant_branding_tenant_id_fkey;
    -- Change column type to TEXT
    ALTER TABLE tenant_branding ALTER COLUMN tenant_id TYPE TEXT USING tenant_id::TEXT;
    ALTER TABLE tenant_branding ALTER COLUMN tenant_id SET DEFAULT 'default';
  END IF;
END $$;

-- RLS
ALTER TABLE tenant_branding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to tenant_branding" ON tenant_branding;
CREATE POLICY "Allow all access to tenant_branding"
  ON tenant_branding FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grants
GRANT ALL ON tenant_branding TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
