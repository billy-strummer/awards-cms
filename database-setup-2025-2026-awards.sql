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
INSERT INTO awards (
  award_name,
  award_category,
  category,
  description,
  criteria,
  prize_details,
  sector,
  region,
  year,
  status,
  thumbnail_url,
  sponsor_logo_url,
  sponsor_name,
  parent_category_id,
  display_order,
  is_active,
  show_on_website,
  entry_open_date,
  entry_close_date,
  judging_deadline,
  announcement_date
)
SELECT
  award_name,
  award_category,
  category,
  description,
  criteria,
  prize_details,
  sector,
  region,
  '2026' as year,  -- Set year to 2026
  'Draft' as status,  -- Set status to Draft (unpublished)
  thumbnail_url,
  sponsor_logo_url,
  sponsor_name,
  parent_category_id,
  display_order,
  is_active,
  show_on_website,
  NULL as entry_open_date,  -- Clear dates for new year
  NULL as entry_close_date,
  NULL as judging_deadline,
  NULL as announcement_date
FROM awards
WHERE (year = '2025' OR year = 2025)
AND NOT EXISTS (
  -- Don't duplicate if 2026 award already exists with same name
  SELECT 1 FROM awards a2
  WHERE (a2.year = '2026' OR a2.year = 2026)
  AND a2.award_name = awards.award_name
);

-- Step 4: Verify the results
-- Run these queries to check the data:

-- Check 2025 awards (should all be Published)
-- SELECT award_name, year, status, COUNT(*) as nominee_count
-- FROM awards
-- LEFT JOIN award_assignments ON awards.id = award_assignments.award_id
-- WHERE year = '2025' OR year = 2025
-- GROUP BY awards.id, award_name, year, status
-- ORDER BY award_name;

-- Check 2026 awards (should all be Draft with no nominees)
-- SELECT award_name, year, status, COUNT(award_assignments.id) as nominee_count
-- FROM awards
-- LEFT JOIN award_assignments ON awards.id = award_assignments.award_id
-- WHERE year = '2026' OR year = 2026
-- GROUP BY awards.id, award_name, year, status
-- ORDER BY award_name;
