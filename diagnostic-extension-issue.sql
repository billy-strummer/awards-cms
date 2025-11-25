-- ============================================
-- DIAGNOSTIC: Find Extension awards and potential companies
-- ============================================

-- 1. Find Extension awards
SELECT
  id,
  award_name,
  region,
  year
FROM awards
WHERE award_name ILIKE '%Extension%'
ORDER BY year DESC, award_name;

-- 2. Check if there are ANY award_assignments for Extension awards
SELECT
  a.award_name,
  COUNT(aa.id) as assignment_count
FROM awards a
LEFT JOIN award_assignments aa ON aa.award_id = a.id
WHERE a.award_name ILIKE '%Extension%'
GROUP BY a.id, a.award_name;

-- 3. Find companies that might be Extension companies
-- (checking company_name since sector column might not exist)
SELECT
  id,
  company_name,
  region
FROM organisations
WHERE company_name ILIKE '%Extension%'
ORDER BY company_name
LIMIT 20;

-- 4. Check the award_assignments_staging table (if CSV was imported)
SELECT COUNT(*) as staging_count
FROM award_assignments_staging
WHERE award_category ILIKE '%Extension%';

-- 5. Show sample staging records for Extension
SELECT *
FROM award_assignments_staging
WHERE award_category ILIKE '%Extension%'
LIMIT 10;
