-- ============================================
-- RENAME awards.region TO awards.county
-- ============================================
-- The 'region' column on the awards table actually stores county/city
-- names (e.g. "Bedfordshire", "Birmingham"), not region names.
-- The actual region is looked up via the 'counties' table.
--
-- This migration renames the column to match what it stores.
-- ============================================

-- Step 1: Check if 'county' column already exists
-- If it does and has data, we need to merge; if not, just rename.
DO $$
BEGIN
  -- Check if 'county' column already exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'awards' AND column_name = 'county'
  ) THEN
    -- County column exists - copy any region data into county where county is null
    UPDATE awards
    SET county = region
    WHERE county IS NULL AND region IS NOT NULL;

    RAISE NOTICE 'County column already exists. Copied region values into empty county fields.';

  ELSE
    -- County column does not exist - rename region to county
    ALTER TABLE awards RENAME COLUMN region TO county;
    RAISE NOTICE 'Renamed awards.region to awards.county';
  END IF;
END $$;

-- Step 2: Verify the column exists and has data
SELECT county, COUNT(*) as count
FROM awards
WHERE county IS NOT NULL
GROUP BY county
ORDER BY county;
