-- ============================================
-- DIAGNOSTIC: Check overall assignment status
-- ============================================

-- 1. Total awards count
SELECT COUNT(*) as total_awards
FROM awards;

-- 2. How many awards have at least one assignment?
SELECT
  COUNT(DISTINCT a.id) as awards_with_assignments,
  (SELECT COUNT(*) FROM awards) as total_awards,
  COUNT(DISTINCT a.id)::float / (SELECT COUNT(*) FROM awards)::float * 100 as percentage_with_assignments
FROM awards a
INNER JOIN award_assignments aa ON aa.award_id = a.id;

-- 3. Total assignment records
SELECT COUNT(*) as total_assignments
FROM award_assignments;

-- 4. Awards with most assignments (top 10)
SELECT
  a.award_name,
  a.region,
  a.year,
  COUNT(aa.id) as assignment_count
FROM awards a
LEFT JOIN award_assignments aa ON aa.award_id = a.id
GROUP BY a.id, a.award_name, a.region, a.year
ORDER BY assignment_count DESC
LIMIT 10;

-- 5. Awards with ZERO assignments (sample)
SELECT
  a.award_name,
  a.region,
  a.year
FROM awards a
LEFT JOIN award_assignments aa ON aa.award_id = a.id
WHERE aa.id IS NULL
ORDER BY a.year DESC, a.award_name
LIMIT 20;

-- 6. Is the award_assignments table completely empty?
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '⚠️ award_assignments table is EMPTY - no companies assigned to any awards'
    ELSE '✅ award_assignments table has ' || COUNT(*) || ' records'
  END as status
FROM award_assignments;
