-- ============================================================
-- Migration 074: Backfill tenant_id on the original 4 tenant-scoped tables
-- ============================================================
-- migrations/016-create-tenants.sql added tenant_id to award_years,
-- organisations, events and winners but never backfilled existing rows.
-- Any row created before multi-tenancy shipped (or before this migration
-- runs, on a project where 016 predates it) has tenant_id IS NULL and is
-- invisible to every tenant-scoped read (api/data-proxy.js injects
-- `.eq('tenant_id', tenantId)` on SELECT once the column exists and a
-- real tenant is active — which it is by default, since 016 seeds a
-- 'bta' tenant row and the app always sends its id).
--
-- Same safety rule as migration 071's backfill: only auto-assign when
-- exactly one tenant exists. Safe to re-run (WHERE tenant_id IS NULL).
-- ============================================================

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['award_years', 'organisations', 'events', 'winners'];
  default_tenant_id UUID;
  tenant_count INT;
BEGIN
  SELECT count(*) INTO tenant_count FROM tenants;
  IF tenant_count = 1 THEN
    SELECT id INTO default_tenant_id FROM tenants LIMIT 1;
    FOREACH t IN ARRAY tables LOOP
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'tenant_id') THEN
        EXECUTE format('UPDATE %I SET tenant_id = $1 WHERE tenant_id IS NULL', t) USING default_tenant_id;
      END IF;
    END LOOP;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
