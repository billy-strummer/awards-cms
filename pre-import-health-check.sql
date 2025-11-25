-- ============================================
-- PRE-IMPORT DATABASE HEALTH CHECK
-- ============================================
-- Run these queries to verify database is clean before CSV import
-- ============================================

-- CHECK 1: Are there any existing award assignments?
-- EXPECTED: 0 rows (clean slate for initial import)
SELECT COUNT(*) as existing_assignments
FROM award_assignments;

-- If > 0, see what they are:
-- SELECT
--   a.award_name,
--   a.year,
--   o.company_name,
--   aa.status,
--   aa.nomination_source
-- FROM award_assignments aa
-- JOIN awards a ON aa.award_id = a.id
-- JOIN organisations o ON aa.organisation_id = o.id
-- ORDER BY a.award_name;

-- ============================================

-- CHECK 2: Are there duplicate awards (same name + year)?
-- EXPECTED: 0 rows (no duplicates)
SELECT
  award_name,
  year,
  COUNT(*) as duplicate_count
FROM awards
GROUP BY award_name, year
HAVING COUNT(*) > 1;

-- ============================================

-- CHECK 3: Are there duplicate organisations (same company name)?
-- EXPECTED: 0 rows (no duplicates)
SELECT
  company_name,
  COUNT(*) as duplicate_count
FROM organisations
GROUP BY company_name
HAVING COUNT(*) > 1;

-- ============================================

-- CHECK 4: How many awards exist for 2026?
-- EXPECTED: Should match your award categories count
SELECT COUNT(*) as total_2026_awards
FROM awards
WHERE year = 2026 OR year = '2026';

-- See the actual awards:
SELECT
  id,
  award_name,
  year,
  sector,
  region
FROM awards
WHERE year = 2026 OR year = '2026'
ORDER BY award_name;

-- ============================================

-- CHECK 5: How many organisations exist?
-- EXPECTED: Should have companies ready to assign
SELECT COUNT(*) as total_organisations
FROM organisations;

-- See a sample:
SELECT
  id,
  company_name,
  email,
  region
FROM organisations
ORDER BY company_name
LIMIT 10;

-- ============================================

-- CHECK 6: Check for orphaned data or bad references
-- Awards with no valid year
SELECT
  id,
  award_name,
  year
FROM awards
WHERE year IS NULL OR TRIM(year::TEXT) = '';

-- Organisations with no name
SELECT
  id,
  company_name,
  email
FROM organisations
WHERE company_name IS NULL OR TRIM(company_name) = '';

-- ============================================

-- CHECK 7: Check staging table is empty (ready for import)
-- EXPECTED: 0 rows (or staging table doesn't exist yet - that's ok)
SELECT COUNT(*) as staged_rows
FROM award_assignments_staging;

-- If staging table doesn't exist, you'll get an error - that's fine!
-- The import script creates it in STEP 2

-- ============================================

-- CHECK 8: Verify no duplicate company names (case-insensitive)
-- EXPECTED: 0 rows
SELECT
  LOWER(company_name) as lowercase_name,
  COUNT(*) as count,
  STRING_AGG(company_name, ', ') as variations
FROM organisations
GROUP BY LOWER(company_name)
HAVING COUNT(*) > 1;

-- ============================================

-- CHECK 9: Verify no duplicate award names for same year (case-insensitive)
-- EXPECTED: 0 rows
SELECT
  LOWER(award_name) as lowercase_name,
  year,
  COUNT(*) as count,
  STRING_AGG(award_name, ', ') as variations
FROM awards
WHERE year = 2026 OR year = '2026'
GROUP BY LOWER(award_name), year
HAVING COUNT(*) > 1;

-- ============================================

-- SUMMARY HEALTH CHECK
SELECT
  'Award Assignments' as table_name,
  COUNT(*) as row_count,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ Clean (expected for initial import)'
    ELSE '⚠️ Has existing data'
  END as status
FROM award_assignments

UNION ALL

SELECT
  'Awards (2026)' as table_name,
  COUNT(*) as row_count,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ Awards exist'
    ELSE '❌ No awards found - need to create them first'
  END as status
FROM awards
WHERE year = 2026 OR year = '2026'

UNION ALL

SELECT
  'Organisations' as table_name,
  COUNT(*) as row_count,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ Companies exist'
    ELSE '❌ No companies found - need to create them first'
  END as status
FROM organisations;

-- ============================================
-- EXPECTED RESULTS FOR CLEAN DATABASE:
-- ✅ Award Assignments: 0 rows (clean)
-- ✅ Awards (2026): X rows where X = number of award categories
-- ✅ Organisations: Y rows where Y = number of companies
-- ✅ No duplicates in any table
-- ============================================
