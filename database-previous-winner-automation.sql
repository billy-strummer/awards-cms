-- ============================================
-- AUTO-FLAG PREVIOUS WINNERS SYSTEM
-- ============================================
-- Automatically detects and flags companies that won in previous years
-- when they're nominated for new awards
-- ============================================

-- STEP 1: Add actual_winner field to track final winners
-- (separate from winner_position which is just recommendations)
ALTER TABLE award_assignments
ADD COLUMN IF NOT EXISTS actual_winner BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN award_assignments.actual_winner IS
  'TRUE if this company was the final winner. Separate from winner_position (1,2,3) which are recommendations.';

-- STEP 2: Create index for performance on previous winner lookups
CREATE INDEX IF NOT EXISTS idx_award_assignments_winner_lookup
  ON award_assignments(organisation_id, actual_winner)
  WHERE actual_winner = TRUE;

CREATE INDEX IF NOT EXISTS idx_awards_year
  ON awards(year);

-- STEP 3: Create function to auto-detect previous winners
CREATE OR REPLACE FUNCTION auto_flag_previous_winner()
RETURNS TRIGGER AS $$
DECLARE
  current_award_year TEXT;
  has_won_before BOOLEAN;
BEGIN
  -- Only auto-flag if is_previous_winner is not already explicitly set to TRUE
  -- (CSV data takes priority over auto-detection)
  IF NEW.is_previous_winner = TRUE THEN
    RETURN NEW;
  END IF;

  -- Get the year of the award being assigned
  SELECT year INTO current_award_year
  FROM awards
  WHERE id = NEW.award_id;

  -- Check if this company won ANY award in previous years
  SELECT EXISTS(
    SELECT 1
    FROM award_assignments aa
    JOIN awards a ON aa.award_id = a.id
    WHERE aa.organisation_id = NEW.organisation_id
      AND aa.actual_winner = TRUE
      AND a.year < current_award_year
  ) INTO has_won_before;

  -- Auto-flag as previous winner if they won before
  IF has_won_before THEN
    NEW.is_previous_winner = TRUE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- STEP 4: Create trigger on INSERT (new nominations)
DROP TRIGGER IF EXISTS trigger_auto_flag_previous_winner_insert ON award_assignments;
CREATE TRIGGER trigger_auto_flag_previous_winner_insert
  BEFORE INSERT ON award_assignments
  FOR EACH ROW
  EXECUTE FUNCTION auto_flag_previous_winner();

-- STEP 5: Create trigger on UPDATE (when actual_winner changes)
-- This ensures that when you mark someone as actual_winner,
-- their future nominations will be auto-flagged
DROP TRIGGER IF EXISTS trigger_auto_flag_previous_winner_update ON award_assignments;
CREATE TRIGGER trigger_auto_flag_previous_winner_update
  BEFORE UPDATE OF actual_winner ON award_assignments
  FOR EACH ROW
  WHEN (NEW.actual_winner = TRUE AND OLD.actual_winner = FALSE)
  EXECUTE FUNCTION auto_flag_previous_winner();

-- ============================================
-- UTILITY QUERIES
-- ============================================

-- Mark actual winners for an award (example)
-- UNCOMMENT AND MODIFY:
-- UPDATE award_assignments
-- SET actual_winner = TRUE
-- WHERE award_id = (SELECT id FROM awards WHERE award_name = 'Best Builder' AND year = '2025')
--   AND organisation_id = (SELECT id FROM organisations WHERE company_name = 'ABC Construction Ltd');

-- View all winners by year
-- SELECT
--   a.year,
--   a.award_name,
--   o.company_name as winner
-- FROM award_assignments aa
-- JOIN awards a ON aa.award_id = a.id
-- JOIN organisations o ON aa.organisation_id = o.id
-- WHERE aa.actual_winner = TRUE
-- ORDER BY a.year DESC, a.award_name;

-- Test the auto-flagging (before importing 2026 data)
-- SELECT
--   o.company_name,
--   COUNT(*) as times_won,
--   STRING_AGG(a.award_name || ' (' || a.year || ')', ', ' ORDER BY a.year) as wins
-- FROM award_assignments aa
-- JOIN awards a ON aa.award_id = a.id
-- JOIN organisations o ON aa.organisation_id = o.id
-- WHERE aa.actual_winner = TRUE
-- GROUP BY o.id, o.company_name
-- ORDER BY times_won DESC;
