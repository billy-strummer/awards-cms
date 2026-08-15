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

-- Backfill: rows that existed before this column was added have tenant_id
-- IS NULL, which makes them invisible to every tenant-scoped read from now on
-- (api/data-proxy.js injects `.eq('tenant_id', tenantId)` on every SELECT
-- once the column exists). Without this, running this migration against a
-- database with real production data would make all existing entries,
-- invoices, payments, contacts, campaigns, media, etc. disappear from the
-- CMS admin UI (they'd remain in the DB, just unreachable via apiClient).
-- Only auto-backfill when exactly one tenant exists — with more than one,
-- there is no safe way to guess which tenant legacy rows belong to, so we
-- leave them NULL and let an admin assign them manually.
--
-- Emits RAISE NOTICE diagnostics (visible in the Supabase SQL Editor output
-- pane, or any psql-compatible client) so a deploy can be verified without a
-- separate round of manual COUNT queries: tenant count, orphaned-row count
-- per table before the update, and updated-row count per table after.
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'entries', 'invoices', 'payments', 'award_assignments', 'contacts',
    'sponsors', 'sponsorship_packages', 'email_campaigns', 'email_lists',
    'email_list_members', 'email_list_subscribers', 'media_gallery',
    'media_items', 'event_galleries', 'social_media_posts', 'banners'
  ];
  default_tenant_id UUID;
  tenant_count INT;
  orphan_count INT;
  updated_count INT;
BEGIN
  SELECT count(*) INTO tenant_count FROM tenants;
  RAISE NOTICE '[migration 071] Tenants detected: %', tenant_count;

  IF tenant_count = 1 THEN
    SELECT id INTO default_tenant_id FROM tenants LIMIT 1;
    RAISE NOTICE '[migration 071] Exactly one tenant found — backfilling orphaned rows to tenant_id %', default_tenant_id;

    FOREACH t IN ARRAY tables LOOP
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'tenant_id') THEN
        EXECUTE format('SELECT count(*) FROM %I WHERE tenant_id IS NULL', t) INTO orphan_count;
        RAISE NOTICE '[migration 071] Table %: % orphaned row(s) found', t, orphan_count;

        EXECUTE format('UPDATE %I SET tenant_id = $1 WHERE tenant_id IS NULL', t) USING default_tenant_id;
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE '[migration 071] Table %: % row(s) updated', t, updated_count;
      ELSE
        RAISE NOTICE '[migration 071] Table % has no tenant_id column (missing table or column) — skipped', t;
      END IF;
    END LOOP;
  ELSE
    RAISE NOTICE '[migration 071] SKIPPED backfill — % tenants detected, backfill only runs automatically when exactly 1 tenant exists. Orphaned rows (if any) were left with tenant_id IS NULL for manual assignment.', tenant_count;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
