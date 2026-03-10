-- ============================================
-- RENAME region TO county_city ON organisations AND entries
-- ============================================
-- The 'region' column on organisations and entries tables actually stores
-- county/city names (e.g. "Bedfordshire", "Birmingham"), not geographic
-- region names (e.g. "East of England", "South East").
--
-- The awards table was already renamed (region → county) via
-- rename-awards-region-to-county.sql. This migration completes the
-- rename across the remaining tables for consistency and clarity.
--
-- The actual geographic region is looked up via the counties table
-- (counties.region_id → regions.name).
-- ============================================

-- Step 1: Rename organisations.region → organisations.county_city
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organisations' AND column_name = 'region'
  ) THEN
    -- Check if county_city already exists (idempotent)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'organisations' AND column_name = 'county_city'
    ) THEN
      -- Both exist: copy region data into county_city where county_city is null
      UPDATE organisations
      SET county_city = region
      WHERE county_city IS NULL AND region IS NOT NULL;
      RAISE NOTICE 'organisations.county_city already exists. Merged region values.';
    ELSE
      ALTER TABLE organisations RENAME COLUMN region TO county_city;
      RAISE NOTICE 'Renamed organisations.region → organisations.county_city';
    END IF;
  ELSE
    RAISE NOTICE 'organisations.region does not exist (already renamed or never existed).';
  END IF;
END $$;

-- Step 2: Rename entries.region → entries.county_city
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entries' AND column_name = 'region'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'entries' AND column_name = 'county_city'
    ) THEN
      UPDATE entries
      SET county_city = region
      WHERE county_city IS NULL AND region IS NOT NULL;
      RAISE NOTICE 'entries.county_city already exists. Merged region values.';
    ELSE
      ALTER TABLE entries RENAME COLUMN region TO county_city;
      RAISE NOTICE 'Renamed entries.region → entries.county_city';
    END IF;
  ELSE
    RAISE NOTICE 'entries.region does not exist (already renamed or never existed).';
  END IF;
END $$;

-- Step 3: Verify both columns exist
SELECT 'organisations' AS table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'organisations' AND column_name IN ('region', 'county_city')
UNION ALL
SELECT 'entries' AS table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'entries' AND column_name IN ('region', 'county_city')
ORDER BY table_name, column_name;
