-- ============================================
-- CHECK AND CLEAN UP DUPLICATE ASSIGNMENTS
-- ============================================

-- 1. Check how many times each company is assigned
SELECT
  o.company_name,
  COUNT(*) as total_assignments,
  COUNT(DISTINCT a.award_id) as unique_awards
FROM award_assignments aa
JOIN organisations o ON aa.organisation_id = o.id
JOIN awards a ON aa.award_id = a.id
GROUP BY o.id, o.company_name
HAVING COUNT(*) > 10  -- Show companies with more than 10 assignments
ORDER BY COUNT(*) DESC;

-- 2. Find duplicate assignments (same company + same award)
SELECT
  o.company_name,
  aw.award_name,
  COUNT(*) as duplicate_count
FROM award_assignments aa
JOIN organisations o ON aa.organisation_id = o.id
JOIN awards aw ON aa.award_id = aw.id
GROUP BY aa.organisation_id, aa.award_id, o.company_name, aw.award_name
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 3. OPTIONAL: Clean up - keep only the most recent assignment for each company+award pair
-- UNCOMMENT TO RUN:
-- DELETE FROM award_assignments aa1
-- USING award_assignments aa2
-- WHERE aa1.organisation_id = aa2.organisation_id
--   AND aa1.award_id = aa2.award_id
--   AND aa1.assigned_date < aa2.assigned_date;

-- 4. OPTIONAL: Limit each award to 5 nominees max (keep most recent)
-- UNCOMMENT TO RUN:
-- DELETE FROM award_assignments
-- WHERE id IN (
--   SELECT id
--   FROM (
--     SELECT id,
--            ROW_NUMBER() OVER (PARTITION BY award_id ORDER BY assigned_date DESC) as rn
--     FROM award_assignments
--   ) sub
--   WHERE rn > 5
-- );
