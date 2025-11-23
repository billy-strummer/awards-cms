-- ============================================
-- SETUP 2025 AND 2026 AWARDS
-- ============================================
-- 1. Update all 2025 categories to "Published" status
-- 2. Copy all 2025 award categories to 2026 without nominees
-- ============================================

-- Step 1: Add status column to awards table if it doesn't exist
ALTER TABLE awards ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Draft';

-- Step 2: Update all 2025 awards to "Published" status
UPDATE awards
SET status = 'Published'
WHERE year = '2025' OR year = 2025;

-- Step 3: Copy all 2025 award categories to 2026 (without nominees)
-- This creates new records for 2026 based on 2025 awards
-- Using only the essential columns that exist
INSERT INTO awards (
  award_name,
  sector,
  region,
  year,
  status
)
SELECT
  award_name,
  sector,
  region,
  '2026' as year,  -- Set year to 2026
  'Draft' as status  -- Set status to Draft (unpublished)
FROM awards
WHERE (year = '2025' OR year = 2025)
AND NOT EXISTS (
  -- Don't duplicate if 2026 award already exists with same name
  SELECT 1 FROM awards a2
  WHERE (a2.year = '2026' OR a2.year = 2026)
  AND a2.award_name = awards.award_name
);

-- Step 4: Assign sample nominees to 2025 awards (if they don't have any)
-- This will assign 3-5 random organisations to each 2025 award that has no nominees
DO $$
DECLARE
  award_record RECORD;
  org_record RECORD;
  assignment_count INTEGER;
  max_nominees INTEGER;
BEGIN
  -- Loop through each 2025 award
  FOR award_record IN
    SELECT id, award_name
    FROM awards
    WHERE (year = '2025' OR year = 2025)
  LOOP
    -- Check if this award already has nominees
    SELECT COUNT(*) INTO assignment_count
    FROM award_assignments
    WHERE award_id = award_record.id;

    -- Only assign nominees if none exist
    IF assignment_count = 0 THEN
      -- Assign 3-5 random organisations to this award
      max_nominees := 3 + floor(random() * 3)::INTEGER;  -- Random number between 3-5

      INSERT INTO award_assignments (award_id, organisation_id, status, assigned_date)
      SELECT
        award_record.id,
        id,
        CASE
          WHEN random() < 0.2 THEN 'winner'
          WHEN random() < 0.5 THEN 'shortlisted'
          ELSE 'nominated'
        END,
        NOW()
      FROM organisations
      ORDER BY random()
      LIMIT max_nominees;

      RAISE NOTICE 'Assigned % nominees to award: %', max_nominees, award_record.award_name;
    ELSE
      RAISE NOTICE 'Award already has % nominees: %', assignment_count, award_record.award_name;
    END IF;
  END LOOP;
END $$;

-- Step 5: Verify the results
-- Run these queries to check the data:

-- Check 2025 awards (should all be Published with nominees)
-- SELECT
--   a.award_name,
--   a.year,
--   a.status,
--   COUNT(aa.id) as nominee_count,
--   COUNT(CASE WHEN aa.status = 'winner' THEN 1 END) as winners,
--   COUNT(CASE WHEN aa.status = 'shortlisted' THEN 1 END) as shortlisted,
--   COUNT(CASE WHEN aa.status = 'nominated' THEN 1 END) as nominated
-- FROM awards a
-- LEFT JOIN award_assignments aa ON a.id = aa.award_id
-- WHERE a.year = '2025' OR a.year = 2025
-- GROUP BY a.id, a.award_name, a.year, a.status
-- ORDER BY a.award_name;

-- Check 2026 awards (should all be Draft with no nominees)
-- SELECT
--   a.award_name,
--   a.year,
--   a.status,
--   COUNT(aa.id) as nominee_count
-- FROM awards a
-- LEFT JOIN award_assignments aa ON a.id = aa.award_id
-- WHERE a.year = '2026' OR a.year = 2026
-- GROUP BY a.id, a.award_name, a.year, a.status
-- ORDER BY a.award_name;

-- List all 2025 nominees by award
-- SELECT
--   a.award_name,
--   o.company_name,
--   aa.status,
--   aa.assigned_date
-- FROM awards a
-- JOIN award_assignments aa ON a.id = aa.award_id
-- JOIN organisations o ON aa.organisation_id = o.id
-- WHERE a.year = '2025' OR a.year = 2025
-- ORDER BY a.award_name, aa.status DESC, o.company_name;
