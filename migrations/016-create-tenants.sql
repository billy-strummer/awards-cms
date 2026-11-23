-- ============================================
-- Migration 016: Create tenants table for multi-tenancy
-- ============================================

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Default tenant
INSERT INTO tenants (name, slug, is_active)
VALUES ('British Trade Awards', 'bta', true)
ON CONFLICT (slug) DO NOTHING;

-- RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants are readable by authenticated users" ON tenants;
CREATE POLICY "Tenants are readable by authenticated users"
  ON tenants FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Tenants are manageable by admins" ON tenants;
CREATE POLICY "Tenants are manageable by admins"
  ON tenants FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE email = auth.jwt() ->> 'email'
      AND role IN ('super_admin', 'admin')
    )
  );

-- Updated at trigger
DROP TRIGGER IF EXISTS set_tenants_updated_at ON tenants;
CREATE TRIGGER set_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add tenant_id column to core tables (nullable for backward compat)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='award_years' AND column_name='tenant_id') THEN
    ALTER TABLE award_years ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organisations' AND column_name='tenant_id') THEN
    ALTER TABLE organisations ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='tenant_id') THEN
    ALTER TABLE events ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='winners' AND column_name='tenant_id') THEN
    ALTER TABLE winners ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  END IF;
END $$;

-- Add notes column to events if it doesn't exist (used by _getEventNotes migration)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='notes') THEN
    ALTER TABLE events ADD COLUMN notes TEXT DEFAULT '';
  END IF;
END $$;
