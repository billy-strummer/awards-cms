-- ============================================
-- ADD SECTOR COLUMN TO ORGANISATIONS TABLE
-- ============================================
-- The organisations table is missing the sector column
-- that the application code expects
-- ============================================

-- Add sector column if it doesn't exist
ALTER TABLE organisations
ADD COLUMN IF NOT EXISTS sector TEXT;

-- Verify the column was added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'organisations'
AND column_name = 'sector';

-- Show sample data
SELECT id, company_name, sector
FROM organisations
LIMIT 5;
