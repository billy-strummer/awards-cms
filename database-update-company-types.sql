-- ============================================
-- UPDATE COMPANY TYPE VALUES
-- ============================================
-- Changes:
--   "Drainage Specialist" → "Drainage Company"
--   "Electrical Contractor" → "Electrical Company"
--   "Extension Specialist" → "Extension Company"
-- ============================================

-- Update organisations table - sector field
UPDATE organisations
SET sector = 'Drainage Company'
WHERE sector = 'Drainage Specialist';

UPDATE organisations
SET sector = 'Electrical Company'
WHERE sector = 'Electrical Contractor';

UPDATE organisations
SET sector = 'Extension Company'
WHERE sector = 'Extension Specialist';

-- Update organisations table - industry_type field (if exists)
UPDATE organisations
SET industry_type = 'Drainage Company'
WHERE industry_type = 'Drainage Specialist';

UPDATE organisations
SET industry_type = 'Electrical Company'
WHERE industry_type = 'Electrical Contractor';

UPDATE organisations
SET industry_type = 'Extension Company'
WHERE industry_type = 'Extension Specialist';

-- Update awards table - sector field
UPDATE awards
SET sector = 'Drainage Company'
WHERE sector = 'Drainage Specialist';

UPDATE awards
SET sector = 'Electrical Company'
WHERE sector = 'Electrical Contractor';

UPDATE awards
SET sector = 'Extension Company'
WHERE sector = 'Extension Specialist';

-- Update awards table - award_category field
UPDATE awards
SET award_category = 'Drainage Company'
WHERE award_category = 'Drainage Specialist';

UPDATE awards
SET award_category = 'Electrical Company'
WHERE award_category = 'Electrical Contractor';

UPDATE awards
SET award_category = 'Extension Company'
WHERE award_category = 'Extension Specialist';

-- Update awards table - category field (if exists)
UPDATE awards
SET category = 'Drainage Company'
WHERE category = 'Drainage Specialist';

UPDATE awards
SET category = 'Electrical Company'
WHERE category = 'Electrical Contractor';

UPDATE awards
SET category = 'Extension Company'
WHERE category = 'Extension Specialist';

-- ============================================
-- Show results
-- ============================================
SELECT
  'Update Complete!' as message,
  'All "Drainage Specialist" changed to "Drainage Company"' as change_1,
  'All "Electrical Contractor" changed to "Electrical Company"' as change_2,
  'All "Extension Specialist" changed to "Extension Company"' as change_3;
