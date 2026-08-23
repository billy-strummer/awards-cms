-- ============================================
-- RENAME SIX AWARD CATEGORIES
-- ============================================
-- The category names below were changed on the front-end/CMS config
-- (home-data.js, config.js, awards.js, submit-entry.js,
-- submit-entry-payment.js, scripts/award-categories-config.js,
-- industry-leader.js). This migration brings existing database rows
-- in line with the new names so historical awards/entries aren't
-- left under the old spelling while new ones use the new spelling.
--
--   Structural Engineers               -> Structural Engineering Company
--   Structural Steelworks              -> Structural Steelworks Company
--   Timber Windows Installer           -> Timber Window Installer
--   Carpet Fitters                     -> Carpet Fitter
--   Female Tradesperson of the Year    -> Tradeswoman of the Year
--   Male Tradesperson of the Year      -> Tradesman of the Year
--
-- Safe to re-run: every UPDATE is a no-op once the rename has applied
-- (the WHERE clause no longer matches anything).
-- ============================================

DO $$
DECLARE
  renames text[][] := ARRAY[
    ARRAY['Structural Engineers', 'Structural Engineering Company'],
    ARRAY['Structural Steelworks', 'Structural Steelworks Company'],
    ARRAY['Timber Windows Installer', 'Timber Window Installer'],
    ARRAY['Carpet Fitters', 'Carpet Fitter'],
    ARRAY['Female Tradesperson of the Year', 'Tradeswoman of the Year'],
    ARRAY['Male Tradesperson of the Year', 'Tradesman of the Year']
  ];
  pair text[];
  affected_awards int;
  affected_entries int;
  has_award_category boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entries' AND column_name = 'award_category'
  ) INTO has_award_category;

  FOREACH pair SLICE 1 IN ARRAY renames
  LOOP
    UPDATE awards SET award_name = pair[2] WHERE award_name = pair[1];
    GET DIAGNOSTICS affected_awards = ROW_COUNT;

    affected_entries := 0;
    IF has_award_category THEN
      UPDATE entries SET award_category = pair[2] WHERE award_category = pair[1];
      GET DIAGNOSTICS affected_entries = ROW_COUNT;
    END IF;

    RAISE NOTICE '% -> %: % awards row(s), % entries row(s)',
      pair[1], pair[2], affected_awards, affected_entries;
  END LOOP;
END $$;

-- Verify: should return 0 rows once the migration has applied cleanly.
SELECT award_name, COUNT(*) AS remaining_old_rows
FROM awards
WHERE award_name IN (
  'Structural Engineers',
  'Structural Steelworks',
  'Timber Windows Installer',
  'Carpet Fitters',
  'Female Tradesperson of the Year',
  'Male Tradesperson of the Year'
)
GROUP BY award_name;
