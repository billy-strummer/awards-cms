-- ============================================================
-- Migration 071: Add missing tenant_id columns
-- ============================================================
-- api/data-proxy.js's TENANT_SCOPED_TABLES set lists 20 tables that get
-- tenant-scoped when a tenant context is provided, but
-- migrations/016-create-tenants.sql only ever added the tenant_id column
-- to 4 of them (award_years, organisations, events, winners). Every other
-- table in that set silently falls back to an unscoped query and logs a
-- "lacks tenant_id column" security warning on nearly every read — this
-- adds the column to the remaining ones so tenant scoping actually works.
-- ============================================================

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'entries', 'invoices', 'payments', 'award_assignments', 'contacts',
    'sponsors', 'sponsorship_packages', 'email_campaigns', 'email_lists',
    'email_list_members', 'email_list_subscribers', 'media_gallery',
    'media_items', 'event_galleries', 'social_media_posts', 'banners'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t AND table_type = 'BASE TABLE') THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id)', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
