-- ============================================
-- Multi-Tenancy: Add tenant_id columns
-- ============================================
-- Run this migration to add tenant_id support to all tenant-scoped tables.
-- This enables data isolation between different tenants (e.g., different awards programmes).
--
-- Prerequisites: Ensure the 'tenants' table exists first.
-- After running, set tenant_id on existing rows if needed:
--   UPDATE table_name SET tenant_id = 'your-tenant-id' WHERE tenant_id IS NULL;

-- Create tenants table if it doesn't exist
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add tenant_id to all tenant-scoped tables
-- Using IF NOT EXISTS pattern via DO blocks for idempotency

DO $$
DECLARE
  tables TEXT[] := ARRAY[
    'award_years',
    'organisations',
    'events',
    'winners',
    'entries',
    'invoices',
    'payments',
    'award_assignments',
    'contacts',
    'sponsors',
    'sponsorship_packages',
    'email_campaigns',
    'email_lists',
    'email_list_members',
    'email_list_subscribers',
    'media_gallery',
    'media_items',
    'event_galleries',
    'social_media_posts',
    'banners'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Only add column if table exists and column doesn't
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'tenant_id') THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN tenant_id UUID REFERENCES tenants(id)', t);
        EXECUTE format('CREATE INDEX idx_%s_tenant_id ON %I (tenant_id)', t, t);
        RAISE NOTICE 'Added tenant_id to %', t;
      ELSE
        RAISE NOTICE 'tenant_id already exists on %', t;
      END IF;
    ELSE
      RAISE NOTICE 'Table % does not exist, skipping', t;
    END IF;
  END LOOP;
END $$;
