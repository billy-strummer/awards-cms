-- ============================================================
-- Migration 027: Ensure all columns needed by the public
-- entry submission form exist on the entries table.
--
-- These were originally added in migration 010 and the
-- unnumbered add-is-self-nomination migration, but may not
-- have been applied to every environment.
-- Safe to re-run: uses IF NOT EXISTS throughout.
-- ============================================================

-- Columns from migration 010
ALTER TABLE entries ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS contact_position TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS why_should_win TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS supporting_information TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS total_scores INTEGER DEFAULT 0;

-- Column from add-is-self-nomination migration
ALTER TABLE entries ADD COLUMN IF NOT EXISTS is_self_nomination BOOLEAN DEFAULT false;

-- Index on year for filter/dropdown performance
CREATE INDEX IF NOT EXISTS idx_entries_year ON entries(year);

-- Ensure anon/authenticated roles can insert entries (public form uses anon key)
GRANT ALL ON public.entries TO anon;
GRANT ALL ON public.entries TO authenticated;
GRANT ALL ON public.entries TO service_role;

-- Refresh PostgREST schema cache so new columns are immediately available
NOTIFY pgrst, 'reload schema';
