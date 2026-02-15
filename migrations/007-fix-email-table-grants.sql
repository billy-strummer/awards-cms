-- ============================================
-- Migration 007: Fix missing GRANT statements for email tables
-- ============================================
-- PostgREST requires explicit GRANT statements (in addition to RLS policies)
-- for tables to be accessible via the Supabase client API.
-- Migration 000 set up RLS policies but missed GRANT statements.

-- email_lists
GRANT ALL ON public.email_lists TO anon;
GRANT ALL ON public.email_lists TO authenticated;
GRANT ALL ON public.email_lists TO service_role;

-- email_list_subscribers
GRANT ALL ON public.email_list_subscribers TO anon;
GRANT ALL ON public.email_list_subscribers TO authenticated;
GRANT ALL ON public.email_list_subscribers TO service_role;

-- email_templates
GRANT ALL ON public.email_templates TO anon;
GRANT ALL ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;

-- email_log (used by SECURITY DEFINER RPCs, but grant for direct access too)
GRANT ALL ON public.email_log TO anon;
GRANT ALL ON public.email_log TO authenticated;
GRANT ALL ON public.email_log TO service_role;

-- email_campaign_recipients (for campaign detail view)
GRANT ALL ON public.email_campaign_recipients TO anon;
GRANT ALL ON public.email_campaign_recipients TO authenticated;
GRANT ALL ON public.email_campaign_recipients TO service_role;

-- email_import_batches
GRANT ALL ON public.email_import_batches TO anon;
GRANT ALL ON public.email_import_batches TO authenticated;
GRANT ALL ON public.email_import_batches TO service_role;

-- email_unsubscribes
GRANT ALL ON public.email_unsubscribes TO anon;
GRANT ALL ON public.email_unsubscribes TO authenticated;
GRANT ALL ON public.email_unsubscribes TO service_role;

-- cms_config (read-only for authenticated, already has RLS policy limiting to SELECT)
GRANT SELECT ON public.cms_config TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
