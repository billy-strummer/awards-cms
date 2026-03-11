-- ============================================================
-- FIX SCHEMA MISMATCHES: Align DB columns with JS code expectations
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. ENTRIES: Add FK to award_years and is_self_nomination column
ALTER TABLE entries ADD COLUMN IF NOT EXISTS is_self_nomination BOOLEAN DEFAULT FALSE;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'entries_award_id_fkey' AND table_name = 'entries'
  ) THEN
    ALTER TABLE entries ADD CONSTRAINT entries_award_id_fkey
      FOREIGN KEY (award_id) REFERENCES award_years(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. SPONSORS: Add missing columns the code expects
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS sponsorship_amount NUMERIC DEFAULT 0;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS description TEXT;
-- Migrate existing 'name' data to 'company_name' if company_name is empty
UPDATE sponsors SET company_name = name WHERE company_name IS NULL AND name IS NOT NULL;

-- 3. SOCIAL_CAMPAIGNS: Add missing columns
ALTER TABLE social_campaigns ADD COLUMN IF NOT EXISTS campaign_name TEXT;
ALTER TABLE social_campaigns ADD COLUMN IF NOT EXISTS platform TEXT;
ALTER TABLE social_campaigns ADD COLUMN IF NOT EXISTS hashtags TEXT;
ALTER TABLE social_campaigns ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE social_campaigns ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMPTZ;
ALTER TABLE social_campaigns ADD COLUMN IF NOT EXISTS posted_date TIMESTAMPTZ;
ALTER TABLE social_campaigns ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;
ALTER TABLE social_campaigns ADD COLUMN IF NOT EXISTS shares INTEGER DEFAULT 0;
ALTER TABLE social_campaigns ADD COLUMN IF NOT EXISTS comments INTEGER DEFAULT 0;
ALTER TABLE social_campaigns ADD COLUMN IF NOT EXISTS reach INTEGER DEFAULT 0;
ALTER TABLE social_campaigns ADD COLUMN IF NOT EXISTS impressions INTEGER DEFAULT 0;
-- Migrate existing 'name' data to 'campaign_name'
UPDATE social_campaigns SET campaign_name = name WHERE campaign_name IS NULL AND name IS NOT NULL;

-- 4. EMAIL_TEMPLATES: Add missing columns
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS template_name TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS template_type TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS html_body TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS html_content TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS variables JSONB DEFAULT '[]';
-- Migrate existing 'name' data to 'template_name'
UPDATE email_templates SET template_name = name WHERE template_name IS NULL AND name IS NOT NULL;

-- 5. INVOICE_LINE_ITEMS: Add missing columns the code expects
ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS item_name TEXT;
ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS line_total NUMERIC DEFAULT 0;
-- Migrate existing data
UPDATE invoice_line_items SET item_name = description WHERE item_name IS NULL AND description IS NOT NULL;
UPDATE invoice_line_items SET line_total = total WHERE line_total IS NULL AND total IS NOT NULL;

-- 6. COUNTIES: Fix the regions relationship
-- The code does .select('Name, regions(name)') which expects a regions table with FK
CREATE TABLE IF NOT EXISTS regions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to regions" ON regions;
CREATE POLICY "Allow all access to regions"
  ON regions FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.regions TO anon;
GRANT ALL ON public.regions TO authenticated;
GRANT ALL ON public.regions TO service_role;

-- Add FK constraint on counties.region_id -> regions.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'counties_region_id_fkey' AND table_name = 'counties'
  ) THEN
    ALTER TABLE counties ADD CONSTRAINT counties_region_id_fkey
      FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Insert standard UK regions
INSERT INTO regions (name) VALUES
  ('East of England'),
  ('East Midlands'),
  ('Greater London'),
  ('North East'),
  ('North West'),
  ('South East'),
  ('South West'),
  ('West Midlands'),
  ('Wales, NW (Gwynedd)'),
  ('Wales, NE (Clwyd)'),
  ('Wales, Mid & West'),
  ('Wales, South'),
  ('Scotland, North'),
  ('Scotland, Central'),
  ('Scotland, West'),
  ('Scotland, South')
ON CONFLICT DO NOTHING;

-- 7. Ensure all tables have proper GRANTs
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'entries', 'sponsors', 'social_campaigns', 'email_templates',
      'invoice_line_items', 'invoices', 'counties', 'regions',
      'email_lists', 'email_list_subscribers', 'email_import_batches',
      'award_years', 'organisations', 'organisation_contacts'
    ])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('GRANT ALL ON public.%I TO anon', tbl);
      EXECUTE format('GRANT ALL ON public.%I TO authenticated', tbl);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl);
    END IF;
  END LOOP;
END $$;

-- Grant on views
GRANT ALL ON public.awards TO anon;
GRANT ALL ON public.awards TO authenticated;
GRANT ALL ON public.awards TO service_role;
GRANT ALL ON public.email_lists_with_stats TO anon;
GRANT ALL ON public.email_lists_with_stats TO authenticated;
GRANT ALL ON public.email_lists_with_stats TO service_role;
GRANT ALL ON public.organisations_with_crm_summary TO anon;
GRANT ALL ON public.organisations_with_crm_summary TO authenticated;
GRANT ALL ON public.organisations_with_crm_summary TO service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
