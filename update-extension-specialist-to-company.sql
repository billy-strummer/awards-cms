-- ============================================
-- UPDATE: Extension Specialist → Extension Company
-- ============================================
-- This script changes all occurrences of "Extension Specialist"
-- to "Extension Company" across all tables
-- ============================================

-- ============================================
-- SECTION 1: FIND ALL OCCURRENCES (REVIEW FIRST)
-- ============================================

-- Check organisations table
SELECT
  'organisations' as table_name,
  id,
  company_name,
  industry
FROM organisations
WHERE
  company_name ILIKE '%Extension Specialist%'
  OR industry ILIKE '%Extension Specialist%'
  OR description ILIKE '%Extension Specialist%';

-- Check awards table
SELECT
  'awards' as table_name,
  id,
  award_name,
  category,
  description
FROM awards
WHERE
  award_name ILIKE '%Extension Specialist%'
  OR category ILIKE '%Extension Specialist%'
  OR description ILIKE '%Extension Specialist%';

-- Check award_assignments table (if it has text fields)
SELECT
  'award_assignments' as table_name,
  id,
  notes
FROM award_assignments
WHERE notes ILIKE '%Extension Specialist%';

-- Check event_guests table
SELECT
  'event_guests' as table_name,
  id,
  guest_name,
  company_name,
  notes
FROM event_guests
WHERE
  guest_name ILIKE '%Extension Specialist%'
  OR company_name ILIKE '%Extension Specialist%'
  OR notes ILIKE '%Extension Specialist%';

-- Check running_order table
SELECT
  'running_order' as table_name,
  id,
  display_name,
  award_name,
  recipient_collecting,
  notes
FROM running_order
WHERE
  display_name ILIKE '%Extension Specialist%'
  OR award_name ILIKE '%Extension Specialist%'
  OR recipient_collecting ILIKE '%Extension Specialist%'
  OR notes ILIKE '%Extension Specialist%'
  OR special_requirements ILIKE '%Extension Specialist%';

-- ============================================
-- SECTION 2: COUNT TOTAL OCCURRENCES
-- ============================================

SELECT
  'Total records to update' as info,
  (
    SELECT COUNT(*) FROM organisations
    WHERE company_name ILIKE '%Extension Specialist%'
       OR industry ILIKE '%Extension Specialist%'
       OR description ILIKE '%Extension Specialist%'
  ) +
  (
    SELECT COUNT(*) FROM awards
    WHERE award_name ILIKE '%Extension Specialist%'
       OR category ILIKE '%Extension Specialist%'
       OR description ILIKE '%Extension Specialist%'
  ) +
  (
    SELECT COUNT(*) FROM award_assignments
    WHERE notes ILIKE '%Extension Specialist%'
  ) +
  (
    SELECT COUNT(*) FROM event_guests
    WHERE guest_name ILIKE '%Extension Specialist%'
       OR company_name ILIKE '%Extension Specialist%'
       OR notes ILIKE '%Extension Specialist%'
  ) +
  (
    SELECT COUNT(*) FROM running_order
    WHERE display_name ILIKE '%Extension Specialist%'
       OR award_name ILIKE '%Extension Specialist%'
       OR recipient_collecting ILIKE '%Extension Specialist%'
       OR notes ILIKE '%Extension Specialist%'
       OR special_requirements ILIKE '%Extension Specialist%'
  ) as total_count;

-- ============================================
-- SECTION 3: UPDATE ALL OCCURRENCES
-- ============================================
-- REVIEW SECTION 1 RESULTS BEFORE RUNNING THIS!
-- UNCOMMENT THE LINES BELOW TO RUN:

/*
-- Update organisations table
UPDATE organisations
SET
  company_name = REPLACE(company_name, 'Extension Specialist', 'Extension Company'),
  industry = REPLACE(industry, 'Extension Specialist', 'Extension Company'),
  description = REPLACE(description, 'Extension Specialist', 'Extension Company')
WHERE
  company_name ILIKE '%Extension Specialist%'
  OR industry ILIKE '%Extension Specialist%'
  OR description ILIKE '%Extension Specialist%';

-- Update awards table
UPDATE awards
SET
  award_name = REPLACE(award_name, 'Extension Specialist', 'Extension Company'),
  category = REPLACE(category, 'Extension Specialist', 'Extension Company'),
  description = REPLACE(description, 'Extension Specialist', 'Extension Company')
WHERE
  award_name ILIKE '%Extension Specialist%'
  OR category ILIKE '%Extension Specialist%'
  OR description ILIKE '%Extension Specialist%';

-- Update award_assignments table
UPDATE award_assignments
SET notes = REPLACE(notes, 'Extension Specialist', 'Extension Company')
WHERE notes ILIKE '%Extension Specialist%';

-- Update event_guests table
UPDATE event_guests
SET
  guest_name = REPLACE(guest_name, 'Extension Specialist', 'Extension Company'),
  company_name = REPLACE(company_name, 'Extension Specialist', 'Extension Company'),
  notes = REPLACE(notes, 'Extension Specialist', 'Extension Company')
WHERE
  guest_name ILIKE '%Extension Specialist%'
  OR company_name ILIKE '%Extension Specialist%'
  OR notes ILIKE '%Extension Specialist%';

-- Update running_order table
UPDATE running_order
SET
  display_name = REPLACE(display_name, 'Extension Specialist', 'Extension Company'),
  award_name = REPLACE(award_name, 'Extension Specialist', 'Extension Company'),
  recipient_collecting = REPLACE(recipient_collecting, 'Extension Specialist', 'Extension Company'),
  notes = REPLACE(notes, 'Extension Specialist', 'Extension Company'),
  special_requirements = REPLACE(special_requirements, 'Extension Specialist', 'Extension Company')
WHERE
  display_name ILIKE '%Extension Specialist%'
  OR award_name ILIKE '%Extension Specialist%'
  OR recipient_collecting ILIKE '%Extension Specialist%'
  OR notes ILIKE '%Extension Specialist%'
  OR special_requirements ILIKE '%Extension Specialist%';
*/

-- ============================================
-- SECTION 4: VERIFICATION
-- ============================================

-- After running updates, verify no occurrences remain
SELECT
  'Verification Complete' as status,
  CASE
    WHEN (
      SELECT COUNT(*) FROM organisations
      WHERE company_name ILIKE '%Extension Specialist%'
         OR industry ILIKE '%Extension Specialist%'
         OR description ILIKE '%Extension Specialist%'
    ) +
    (
      SELECT COUNT(*) FROM awards
      WHERE award_name ILIKE '%Extension Specialist%'
         OR category ILIKE '%Extension Specialist%'
         OR description ILIKE '%Extension Specialist%'
    ) +
    (
      SELECT COUNT(*) FROM award_assignments
      WHERE notes ILIKE '%Extension Specialist%'
    ) +
    (
      SELECT COUNT(*) FROM event_guests
      WHERE guest_name ILIKE '%Extension Specialist%'
         OR company_name ILIKE '%Extension Specialist%'
         OR notes ILIKE '%Extension Specialist%'
    ) +
    (
      SELECT COUNT(*) FROM running_order
      WHERE display_name ILIKE '%Extension Specialist%'
         OR award_name ILIKE '%Extension Specialist%'
         OR recipient_collecting ILIKE '%Extension Specialist%'
         OR notes ILIKE '%Extension Specialist%'
         OR special_requirements ILIKE '%Extension Specialist%'
    ) = 0
    THEN '✅ All occurrences updated successfully!'
    ELSE '⚠️ Some occurrences still remain - check above queries'
  END as result;

-- Show all "Extension Company" records (should now show the updated values)
SELECT
  'organisations' as table_name,
  id,
  company_name,
  industry
FROM organisations
WHERE
  company_name ILIKE '%Extension Company%'
  OR industry ILIKE '%Extension Company%';

-- ============================================
-- INSTRUCTIONS
-- ============================================
/*
1. Run SECTION 1 queries first to see all current occurrences
2. Run SECTION 2 to see total count
3. Review the results carefully
4. Uncomment SECTION 3 and run to update all occurrences
5. Run SECTION 4 to verify the changes were successful
*/
