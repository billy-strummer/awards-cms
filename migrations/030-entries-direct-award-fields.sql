-- ============================================
-- ADD DIRECT AWARD FIELDS TO ENTRIES TABLE
-- ============================================
-- The entries table currently relies entirely on the award_years FK join
-- to display award_name, sector, and region. When award_id is NULL
-- (e.g. no matching award record exists), the CMS shows "N/A".
--
-- This migration adds direct columns so form data is always preserved
-- regardless of whether an award record is linked.

ALTER TABLE entries ADD COLUMN IF NOT EXISTS award_category TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS sector TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS region TEXT;

-- Backfill existing entries: extract award_category from entry_title ("Company - Category")
UPDATE entries
SET award_category = TRIM(SUBSTRING(entry_title FROM POSITION(' - ' IN entry_title) + 3))
WHERE award_category IS NULL
  AND entry_title LIKE '% - %';

-- Backfill sector and region from linked organisations
UPDATE entries e
SET
  sector = COALESCE(e.sector, o.sector),
  region = COALESCE(e.region, o.region)
FROM organisations o
WHERE e.organisation_id = o.id
  AND (e.sector IS NULL OR e.region IS NULL);

-- Backfill from linked award_years if available
UPDATE entries e
SET
  award_category = COALESCE(e.award_category, ay.award_name),
  sector = COALESCE(e.sector, ay.sector),
  region = COALESCE(e.region, ay.county)
FROM award_years ay
WHERE e.award_id = ay.id
  AND (e.award_category IS NULL OR e.sector IS NULL OR e.region IS NULL);
