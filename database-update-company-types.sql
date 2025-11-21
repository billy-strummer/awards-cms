-- ============================================
-- UPDATE COMPANY TYPE VALUES
-- ============================================
-- Changes:
--   "Drainage Specialist" → "Drainage Company"
--   "Electrical Contractor" → "Electrical Company"
-- ============================================

-- Update organisations table - sector field
UPDATE organisations
SET sector = 'Drainage Company'
WHERE sector = 'Drainage Specialist';

UPDATE organisations
SET sector = 'Electrical Company'
WHERE sector = 'Electrical Contractor';

-- Update organisations table - industry_type field (if exists)
UPDATE organisations
SET industry_type = 'Drainage Company'
WHERE industry_type = 'Drainage Specialist';

UPDATE organisations
SET industry_type = 'Electrical Company'
WHERE industry_type = 'Electrical Contractor';

-- Update awards table - sector field
UPDATE awards
SET sector = 'Drainage Company'
WHERE sector = 'Drainage Specialist';

UPDATE awards
SET sector = 'Electrical Company'
WHERE sector = 'Electrical Contractor';

-- Update awards table - award_category field
UPDATE awards
SET award_category = 'Drainage Company'
WHERE award_category = 'Drainage Specialist';

UPDATE awards
SET award_category = 'Electrical Company'
WHERE award_category = 'Electrical Contractor';

-- Update awards table - category field (if exists)
UPDATE awards
SET category = 'Drainage Company'
WHERE category = 'Drainage Specialist';

UPDATE awards
SET category = 'Electrical Company'
WHERE category = 'Electrical Contractor';

-- ============================================
-- Show results
-- ============================================
SELECT
  'Update Complete!' as message,
  'All "Drainage Specialist" changed to "Drainage Company"' as change_1,
  'All "Electrical Contractor" changed to "Electrical Company"' as change_2;
