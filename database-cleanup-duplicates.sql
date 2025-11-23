-- ============================================
-- CHECK AND CLEAN UP DUPLICATE ASSIGNMENTS
-- ============================================
-- This script detects and removes duplicate award assignments
-- Run each section in order, review the results before proceeding
-- ============================================

-- ============================================
-- SECTION 1: DETECTION QUERIES
-- ============================================

-- Query 1: Check how many times each company is assigned
-- (Shows companies with excessive assignments)
SELECT
  o.company_name,
  COUNT(*) as total_assignments,
  COUNT(DISTINCT aa.award_id) as unique_awards,
  CASE
    WHEN COUNT(*) > COUNT(DISTINCT aa.award_id) THEN '⚠️ HAS DUPLICATES'
    ELSE '✓ OK'
  END as status
FROM award_assignments aa
JOIN organisations o ON aa.organisation_id = o.id
JOIN awards a ON aa.award_id = a.id
GROUP BY o.id, o.company_name
HAVING COUNT(*) > 10  -- Show companies with more than 10 assignments
ORDER BY COUNT(*) DESC;

-- Query 2: Find exact duplicate assignments (same company + same award)
-- This is the main duplicate detection query
SELECT
  o.company_name,
  aw.award_name,
  aw.year,
  COUNT(*) as duplicate_count,
  COUNT(*) - 1 as records_to_delete,
  STRING_AGG(
    aa.id::TEXT || ' (' ||
    COALESCE(aa.assigned_date::TEXT, 'no date') || ')',
    ', '
    ORDER BY aa.assigned_date DESC NULLS LAST
  ) as assignment_ids
FROM award_assignments aa
JOIN organisations o ON aa.organisation_id = o.id
JOIN awards aw ON aa.award_id = aw.id
GROUP BY aa.organisation_id, aa.award_id, o.company_name, aw.award_name, aw.year
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, aw.award_name;

-- Query 3: Count total duplicates
SELECT
  COUNT(*) as duplicate_combinations,
  SUM(cnt - 1) as total_records_to_delete
FROM (
  SELECT
    organisation_id,
    award_id,
    COUNT(*) as cnt
  FROM award_assignments
  GROUP BY organisation_id, award_id
  HAVING COUNT(*) > 1
) duplicates;

-- ============================================
-- SECTION 2: DETAILED DUPLICATE ANALYSIS
-- ============================================

-- Show all duplicate records with full details
-- Review this before deleting anything
SELECT
  aa.id,
  aa.assigned_date,
  o.company_name,
  aw.award_name,
  aw.year,
  aa.status,
  aa.assigned_by,
  CASE
    WHEN aa.id IN (
      -- IDs to KEEP (most recent for each company+award pair)
      SELECT DISTINCT ON (organisation_id, award_id) id
      FROM award_assignments
      ORDER BY organisation_id, award_id, assigned_date DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) THEN '✓ KEEP'
    ELSE '✗ DELETE'
  END as action
FROM award_assignments aa
JOIN organisations o ON aa.organisation_id = o.id
JOIN awards aw ON aa.award_id = aw.id
WHERE (aa.organisation_id, aa.award_id) IN (
  -- Only show records that have duplicates
  SELECT organisation_id, award_id
  FROM award_assignments
  GROUP BY organisation_id, award_id
  HAVING COUNT(*) > 1
)
ORDER BY o.company_name, aw.award_name, aa.assigned_date DESC NULLS LAST;

-- ============================================
-- SECTION 3: CLEANUP (REMOVE DUPLICATES)
-- ============================================

-- CAREFULLY REVIEW THE ABOVE QUERIES BEFORE RUNNING THIS!
-- This will permanently delete duplicate records, keeping only the most recent
-- assignment for each company+award combination.

-- STEP 1: Delete duplicates, keeping the most recent assignment
-- UNCOMMENT THE LINES BELOW TO RUN:
/*
DELETE FROM award_assignments
WHERE id NOT IN (
  -- Keep only the most recent assignment for each org+award pair
  SELECT DISTINCT ON (organisation_id, award_id) id
  FROM award_assignments
  ORDER BY organisation_id, award_id,
    assigned_date DESC NULLS LAST,
    created_at DESC NULLS LAST,
    id DESC
);
*/

-- ============================================
-- SECTION 4: VERIFICATION
-- ============================================

-- After running the cleanup, run these queries to verify:

-- Verify no duplicates remain
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ NO DUPLICATES FOUND - Cleanup successful!'
    ELSE '⚠️ STILL HAS ' || COUNT(*) || ' DUPLICATE COMBINATIONS'
  END as verification_result
FROM (
  SELECT organisation_id, award_id, COUNT(*) as cnt
  FROM award_assignments
  GROUP BY organisation_id, award_id
  HAVING COUNT(*) > 1
) remaining_duplicates;

-- Show current assignment counts per award
SELECT
  aw.award_name,
  aw.year,
  COUNT(aa.id) as total_nominees
FROM awards aw
LEFT JOIN award_assignments aa ON aw.id = aa.award_id
WHERE aw.year IN ('2025', 2025)
GROUP BY aw.id, aw.award_name, aw.year
HAVING COUNT(aa.id) > 0
ORDER BY total_nominees DESC, aw.award_name;

-- ============================================
-- SECTION 5: OPTIONAL - LIMIT NOMINEES PER AWARD
-- ============================================

-- If you want to limit each award to maximum 5 nominees (keeping most recent)
-- UNCOMMENT TO RUN:
/*
DELETE FROM award_assignments
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY award_id
             ORDER BY assigned_date DESC NULLS LAST, created_at DESC NULLS LAST
           ) as rn
    FROM award_assignments
  ) ranked
  WHERE rn > 5
);
*/
