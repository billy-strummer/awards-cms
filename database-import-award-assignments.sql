-- ============================================
-- IMPORT AWARD ASSIGNMENTS FROM CSV
-- ============================================
-- This script helps import the correct award assignments from your CSV file
-- ============================================

-- STEP 1: Delete all existing award assignments (clean slate)
-- UNCOMMENT TO RUN:
-- DELETE FROM award_assignments;

-- STEP 2: Create a staging table for CSV import
-- Column names match your standardized CSV headers
DROP TABLE IF EXISTS award_assignments_staging;

CREATE TABLE award_assignments_staging (
  id SERIAL PRIMARY KEY,
  sector TEXT,
  region TEXT,
  award_category TEXT,
  organisation TEXT,
  contact_name TEXT,
  email TEXT,
  website TEXT,
  phone TEXT,
  address TEXT,
  catchment_area TEXT,
  nomination_date DATE,
  nomination_source TEXT,
  is_previous_winner TEXT,
  winner_position TEXT,
  actual_winner TEXT,
  notes TEXT,
  imported_at TIMESTAMP DEFAULT NOW()
);

-- Ensure award_assignments table has all required columns
ALTER TABLE award_assignments
ADD COLUMN IF NOT EXISTS nomination_date DATE;

ALTER TABLE award_assignments
ADD COLUMN IF NOT EXISTS nomination_source VARCHAR(50) DEFAULT 'csv_import';

ALTER TABLE award_assignments
ADD COLUMN IF NOT EXISTS is_previous_winner BOOLEAN DEFAULT FALSE;

ALTER TABLE award_assignments
ADD COLUMN IF NOT EXISTS winner_position INTEGER;

ALTER TABLE award_assignments
ADD COLUMN IF NOT EXISTS voting_slug TEXT;

ALTER TABLE award_assignments
ADD COLUMN IF NOT EXISTS public_vote_count INTEGER DEFAULT 0;

ALTER TABLE award_assignments
ADD COLUMN IF NOT EXISTS actual_winner BOOLEAN DEFAULT FALSE;

-- STEP 3: Import your CSV file
-- Go to Supabase Dashboard → Table Editor → award_assignments_staging → Click "Insert" dropdown → "Import data from CSV"
-- Upload your CSV file
-- The column names now match your CSV exactly, so it should import automatically!

-- STEP 4: Review the staged data
SELECT
  award_category,
  organisation,
  COUNT(*) as count
FROM award_assignments_staging
GROUP BY award_category, organisation
ORDER BY award_category, organisation;

-- STEP 5: Check for mismatches (awards that won't match)
SELECT DISTINCT
  s.award_category,
  'Award not found in database' as issue
FROM award_assignments_staging s
LEFT JOIN awards a ON LOWER(TRIM(a.award_name)) = LOWER(TRIM(s.award_category))
  AND (a.year = '2026' OR a.year = 2026)
WHERE a.id IS NULL
ORDER BY s.award_category;

-- STEP 6: Check for mismatches (organisations that won't match)
SELECT DISTINCT
  s.organisation,
  'Organisation not found in database' as issue
FROM award_assignments_staging s
LEFT JOIN organisations o ON LOWER(TRIM(o.company_name)) = LOWER(TRIM(s.organisation))
WHERE o.id IS NULL
ORDER BY s.organisation;

-- STEP 7: Insert assignments from staging table into award_assignments
-- This matches award names and organisation names to get their IDs
-- NOTE: is_previous_winner will be auto-flagged by trigger if company won in previous years
--       (unless explicitly set to TRUE in CSV, which takes priority)
-- UNCOMMENT TO RUN:
-- INSERT INTO award_assignments (
--   award_id,
--   organisation_id,
--   status,
--   assigned_date,
--   nomination_date,
--   nomination_source,
--   is_previous_winner,
--   winner_position,
--   voting_slug,
--   public_vote_count,
--   actual_winner
-- )
-- SELECT DISTINCT
--   a.id as award_id,
--   o.id as organisation_id,
--   'nominated' as status,
--   NOW() as assigned_date,
--   s.nomination_date,
--   COALESCE(s.nomination_source, 'csv_import') as nomination_source,
--   CASE
--     WHEN LOWER(TRIM(s.is_previous_winner)) IN ('true', 'yes', '1', 't', 'y') THEN TRUE
--     ELSE FALSE
--   END as is_previous_winner,
--   CASE
--     WHEN s.winner_position ~ '^\d+$' THEN s.winner_position::INTEGER
--     ELSE NULL
--   END as winner_position,
--   generate_voting_slug(o.company_name, a.award_name, a.year::TEXT) as voting_slug,
--   0 as public_vote_count,
--   CASE
--     WHEN LOWER(TRIM(s.actual_winner)) IN ('true', 'yes', '1', 't', 'y') THEN TRUE
--     ELSE FALSE
--   END as actual_winner
-- FROM award_assignments_staging s
-- JOIN awards a ON LOWER(TRIM(a.award_name)) = LOWER(TRIM(s.award_category))
--   AND (a.year = '2026' OR a.year = 2026)
-- JOIN organisations o ON LOWER(TRIM(o.company_name)) = LOWER(TRIM(s.organisation))
-- WHERE NOT EXISTS (
--   -- Prevent duplicates
--   SELECT 1 FROM award_assignments aa
--   WHERE aa.award_id = a.id AND aa.organisation_id = o.id
-- );

-- STEP 8: Verify the import
SELECT
  a.award_name,
  COUNT(aa.id) as nominee_count,
  STRING_AGG(o.company_name, ', ' ORDER BY o.company_name) as nominees
FROM awards a
LEFT JOIN award_assignments aa ON a.id = aa.award_id
LEFT JOIN organisations o ON aa.organisation_id = o.id
WHERE a.year = '2026' OR a.year = 2026
GROUP BY a.id, a.award_name
HAVING COUNT(aa.id) > 0
ORDER BY a.award_name;

-- STEP 9: Clean up staging table (optional - you may want to keep it for reference)
-- UNCOMMENT TO RUN:
-- DROP TABLE award_assignments_staging;
