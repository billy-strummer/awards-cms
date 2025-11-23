-- ============================================
-- UPDATE: Electrical Contractor → Electrical Company
-- ============================================
-- This script changes all occurrences of "Electrical Contractor"
-- to "Electrical Company" across all tables
-- ============================================

-- ============================================
-- SECTION 1: FIND ALL OCCURRENCES (REVIEW FIRST)
-- ============================================

-- Check organisations table
SELECT
  'organisations' as table_name,
  id,
  company_name,
  business_type
FROM organisations
WHERE
  company_name ILIKE '%Electrical Contractor%'
  OR business_type ILIKE '%Electrical Contractor%'
  OR description ILIKE '%Electrical Contractor%'
  OR services_offered ILIKE '%Electrical Contractor%';

-- Check awards table
SELECT
  'awards' as table_name,
  id,
  award_name,
  category,
  description
FROM awards
WHERE
  award_name ILIKE '%Electrical Contractor%'
  OR category ILIKE '%Electrical Contractor%'
  OR description ILIKE '%Electrical Contractor%';

-- Check award_assignments table (if it has text fields)
SELECT
  'award_assignments' as table_name,
  id,
  notes
FROM award_assignments
WHERE notes ILIKE '%Electrical Contractor%';

-- Check event_guests table
SELECT
  'event_guests' as table_name,
  id,
  guest_name,
  company_name,
  notes
FROM event_guests
WHERE
  guest_name ILIKE '%Electrical Contractor%'
  OR company_name ILIKE '%Electrical Contractor%'
  OR notes ILIKE '%Electrical Contractor%';

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
  display_name ILIKE '%Electrical Contractor%'
  OR award_name ILIKE '%Electrical Contractor%'
  OR recipient_collecting ILIKE '%Electrical Contractor%'
  OR notes ILIKE '%Electrical Contractor%'
  OR special_requirements ILIKE '%Electrical Contractor%';

-- ============================================
-- SECTION 2: COUNT TOTAL OCCURRENCES
-- ============================================

SELECT
  'Total records to update' as info,
  (
    SELECT COUNT(*) FROM organisations
    WHERE company_name ILIKE '%Electrical Contractor%'
       OR business_type ILIKE '%Electrical Contractor%'
       OR description ILIKE '%Electrical Contractor%'
       OR services_offered ILIKE '%Electrical Contractor%'
  ) +
  (
    SELECT COUNT(*) FROM awards
    WHERE award_name ILIKE '%Electrical Contractor%'
       OR category ILIKE '%Electrical Contractor%'
       OR description ILIKE '%Electrical Contractor%'
  ) +
  (
    SELECT COUNT(*) FROM award_assignments
    WHERE notes ILIKE '%Electrical Contractor%'
  ) +
  (
    SELECT COUNT(*) FROM event_guests
    WHERE guest_name ILIKE '%Electrical Contractor%'
       OR company_name ILIKE '%Electrical Contractor%'
       OR notes ILIKE '%Electrical Contractor%'
  ) +
  (
    SELECT COUNT(*) FROM running_order
    WHERE display_name ILIKE '%Electrical Contractor%'
       OR award_name ILIKE '%Electrical Contractor%'
       OR recipient_collecting ILIKE '%Electrical Contractor%'
       OR notes ILIKE '%Electrical Contractor%'
       OR special_requirements ILIKE '%Electrical Contractor%'
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
  company_name = REPLACE(company_name, 'Electrical Contractor', 'Electrical Company'),
  business_type = REPLACE(business_type, 'Electrical Contractor', 'Electrical Company'),
  description = REPLACE(description, 'Electrical Contractor', 'Electrical Company'),
  services_offered = REPLACE(services_offered, 'Electrical Contractor', 'Electrical Company')
WHERE
  company_name ILIKE '%Electrical Contractor%'
  OR business_type ILIKE '%Electrical Contractor%'
  OR description ILIKE '%Electrical Contractor%'
  OR services_offered ILIKE '%Electrical Contractor%';

-- Update awards table
UPDATE awards
SET
  award_name = REPLACE(award_name, 'Electrical Contractor', 'Electrical Company'),
  category = REPLACE(category, 'Electrical Contractor', 'Electrical Company'),
  description = REPLACE(description, 'Electrical Contractor', 'Electrical Company')
WHERE
  award_name ILIKE '%Electrical Contractor%'
  OR category ILIKE '%Electrical Contractor%'
  OR description ILIKE '%Electrical Contractor%';

-- Update award_assignments table
UPDATE award_assignments
SET notes = REPLACE(notes, 'Electrical Contractor', 'Electrical Company')
WHERE notes ILIKE '%Electrical Contractor%';

-- Update event_guests table
UPDATE event_guests
SET
  guest_name = REPLACE(guest_name, 'Electrical Contractor', 'Electrical Company'),
  company_name = REPLACE(company_name, 'Electrical Contractor', 'Electrical Company'),
  notes = REPLACE(notes, 'Electrical Contractor', 'Electrical Company')
WHERE
  guest_name ILIKE '%Electrical Contractor%'
  OR company_name ILIKE '%Electrical Contractor%'
  OR notes ILIKE '%Electrical Contractor%';

-- Update running_order table
UPDATE running_order
SET
  display_name = REPLACE(display_name, 'Electrical Contractor', 'Electrical Company'),
  award_name = REPLACE(award_name, 'Electrical Contractor', 'Electrical Company'),
  recipient_collecting = REPLACE(recipient_collecting, 'Electrical Contractor', 'Electrical Company'),
  notes = REPLACE(notes, 'Electrical Contractor', 'Electrical Company'),
  special_requirements = REPLACE(special_requirements, 'Electrical Contractor', 'Electrical Company')
WHERE
  display_name ILIKE '%Electrical Contractor%'
  OR award_name ILIKE '%Electrical Contractor%'
  OR recipient_collecting ILIKE '%Electrical Contractor%'
  OR notes ILIKE '%Electrical Contractor%'
  OR special_requirements ILIKE '%Electrical Contractor%';
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
      WHERE company_name ILIKE '%Electrical Contractor%'
         OR business_type ILIKE '%Electrical Contractor%'
         OR description ILIKE '%Electrical Contractor%'
         OR services_offered ILIKE '%Electrical Contractor%'
    ) +
    (
      SELECT COUNT(*) FROM awards
      WHERE award_name ILIKE '%Electrical Contractor%'
         OR category ILIKE '%Electrical Contractor%'
         OR description ILIKE '%Electrical Contractor%'
    ) +
    (
      SELECT COUNT(*) FROM award_assignments
      WHERE notes ILIKE '%Electrical Contractor%'
    ) +
    (
      SELECT COUNT(*) FROM event_guests
      WHERE guest_name ILIKE '%Electrical Contractor%'
         OR company_name ILIKE '%Electrical Contractor%'
         OR notes ILIKE '%Electrical Contractor%'
    ) +
    (
      SELECT COUNT(*) FROM running_order
      WHERE display_name ILIKE '%Electrical Contractor%'
         OR award_name ILIKE '%Electrical Contractor%'
         OR recipient_collecting ILIKE '%Electrical Contractor%'
         OR notes ILIKE '%Electrical Contractor%'
         OR special_requirements ILIKE '%Electrical Contractor%'
    ) = 0
    THEN '✅ All occurrences updated successfully!'
    ELSE '⚠️ Some occurrences still remain - check above queries'
  END as result;

-- Show all "Electrical Company" records (should now show the updated values)
SELECT
  'organisations' as table_name,
  id,
  company_name,
  business_type
FROM organisations
WHERE
  company_name ILIKE '%Electrical Company%'
  OR business_type ILIKE '%Electrical Company%';

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
