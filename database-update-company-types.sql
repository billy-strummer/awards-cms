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

-- ============================================
-- Show results
-- ============================================
SELECT
  'Update Complete!' as message,
  'All "Drainage Specialist" changed to "Drainage Company"' as change_1,
  'All "Electrical Contractor" changed to "Electrical Company"' as change_2,
  'All "Extension Specialist" changed to "Extension Company"' as change_3;
