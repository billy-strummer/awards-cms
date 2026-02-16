-- ============================================
-- Migration 007: Fix missing GRANT statements for email tables
-- ============================================
-- PostgREST requires explicit GRANT statements (in addition to RLS policies)
-- for tables to be accessible via the Supabase client API.
-- Migration 000 set up RLS policies but missed GRANT statements.
-- Wrapped in DO block so GRANTs only run if tables exist (safe for partial setups).

DO $$
DECLARE
  _tbl TEXT;
BEGIN
  -- Full access tables (from migration 000)
  FOREACH _tbl IN ARRAY ARRAY[
    'email_lists',
    'email_list_subscribers',
    'email_templates',
    'email_log',
    'email_campaign_recipients',
    'email_import_batches',
    'email_unsubscribes'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = _tbl) THEN
      EXECUTE format('GRANT ALL ON public.%I TO anon', _tbl);
      EXECUTE format('GRANT ALL ON public.%I TO authenticated', _tbl);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', _tbl);
    END IF;
  END LOOP;

  -- cms_config (read-only for authenticated)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cms_config') THEN
    EXECUTE 'GRANT SELECT ON public.cms_config TO authenticated';
  END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
