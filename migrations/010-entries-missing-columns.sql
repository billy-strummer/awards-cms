-- ============================================================
-- Migration 010: Add missing columns to entries table
-- These columns are referenced in entries.js but were never
-- added to the entries table in any prior migration.
-- ============================================================

ALTER TABLE entries ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS contact_position TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS why_should_win TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS supporting_information TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS total_scores INTEGER DEFAULT 0;

-- Index on year for filter dropdown performance
CREATE INDEX IF NOT EXISTS idx_entries_year ON entries(year);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
