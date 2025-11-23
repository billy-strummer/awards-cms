-- ============================================
-- IMPORT AWARD ASSIGNMENTS FROM CSV
-- ============================================
-- This script helps import the correct award assignments from your CSV file
-- ============================================

-- STEP 1: Delete all existing award assignments (clean slate)
-- UNCOMMENT TO RUN:
-- DELETE FROM award_assignments;

-- STEP 2: Create a staging table for CSV import
CREATE TABLE IF NOT EXISTS award_assignments_staging (
  id SERIAL PRIMARY KEY,
  sector TEXT,
  region TEXT,
  award_name TEXT,
  organisation TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  catchment_area TEXT,
  notes TEXT,
  imported_at TIMESTAMP DEFAULT NOW()
);

-- STEP 3: Import your CSV file
-- Go to Supabase Dashboard → Table Editor → award_assignments_staging → Click "Insert" dropdown → "Import data from CSV"
-- Upload your CSV file
-- Make sure column mapping matches: sector, region, award_name, organisation, email, website, address, catchment_area, notes

-- STEP 4: Review the staged data
SELECT
  award_name,
  organisation,
  COUNT(*) as count
FROM award_assignments_staging
GROUP BY award_name, organisation
ORDER BY award_name, organisation;

-- STEP 5: Check for mismatches (awards that won't match)
SELECT DISTINCT
  s.award_name,
  'Award not found in database' as issue
FROM award_assignments_staging s
LEFT JOIN awards a ON LOWER(TRIM(a.award_name)) = LOWER(TRIM(s.award_name))
  AND (a.year = '2025' OR a.year = 2025)
WHERE a.id IS NULL
ORDER BY s.award_name;

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
-- UNCOMMENT TO RUN:
-- INSERT INTO award_assignments (award_id, organisation_id, status, assigned_date)
-- SELECT DISTINCT
--   a.id as award_id,
--   o.id as organisation_id,
--   'nominated' as status,
--   NOW() as assigned_date
-- FROM award_assignments_staging s
-- JOIN awards a ON LOWER(TRIM(a.award_name)) = LOWER(TRIM(s.award_name))
--   AND (a.year = '2025' OR a.year = 2025)
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
WHERE a.year = '2025' OR a.year = 2025
GROUP BY a.id, a.award_name
HAVING COUNT(aa.id) > 0
ORDER BY a.award_name;

-- STEP 9: Clean up staging table (optional - you may want to keep it for reference)
-- UNCOMMENT TO RUN:
-- DROP TABLE award_assignments_staging;
