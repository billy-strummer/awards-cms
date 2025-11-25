-- ============================================
-- YEAR-OVER-YEAR ROLLOVER SYSTEM
-- ============================================
-- Manages awards data that persists in the system forever
-- Provides utilities for creating new award years and carrying over nominees
-- ============================================

-- STEP 1: Ensure actual_winner field exists
ALTER TABLE award_assignments
ADD COLUMN IF NOT EXISTS actual_winner BOOLEAN DEFAULT FALSE;

-- STEP 2: Create indexes for history lookups
CREATE INDEX IF NOT EXISTS idx_award_assignments_history
  ON award_assignments(organisation_id, actual_winner);

CREATE INDEX IF NOT EXISTS idx_awards_year
  ON awards(year);

-- ============================================
-- FUNCTION: Get Nominee History
-- ============================================
-- Returns complete nomination history for a company across all years

CREATE OR REPLACE FUNCTION get_nominee_history(org_id UUID)
RETURNS TABLE (
  total_nominations BIGINT,
  total_wins BIGINT,
  years_nominated TEXT[],
  years_won TEXT[],
  awards_won TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_nominations,
    COUNT(*) FILTER (WHERE aa.actual_winner = TRUE)::BIGINT as total_wins,
    ARRAY_AGG(DISTINCT a.year::TEXT ORDER BY a.year::TEXT DESC) as years_nominated,
    ARRAY_AGG(DISTINCT a.year::TEXT ORDER BY a.year::TEXT DESC) FILTER (WHERE aa.actual_winner = TRUE) as years_won,
    ARRAY_AGG(a.award_name ORDER BY a.year DESC) FILTER (WHERE aa.actual_winner = TRUE) as awards_won
  FROM award_assignments aa
  JOIN awards a ON aa.award_id = a.id
  WHERE aa.organisation_id = org_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Auto-Detect Previous Winner
-- ============================================
-- Checks if a company won ANY award in previous years

CREATE OR REPLACE FUNCTION is_previous_winner(org_id UUID, current_year TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  has_won BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM award_assignments aa
    JOIN awards a ON aa.award_id = a.id
    WHERE aa.organisation_id = org_id
      AND aa.actual_winner = TRUE
      AND a.year::TEXT < current_year
  ) INTO has_won;

  RETURN has_won;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Auto-Flag Previous Winners
-- ============================================
-- When a nominee is added (via CMS or CSV), automatically check their history

CREATE OR REPLACE FUNCTION auto_flag_previous_winner()
RETURNS TRIGGER AS $$
DECLARE
  current_award_year TEXT;
  has_won_before BOOLEAN;
BEGIN
  -- Skip if already explicitly set to TRUE (CSV override)
  IF NEW.is_previous_winner = TRUE THEN
    RETURN NEW;
  END IF;

  -- Get current award year (cast to TEXT for consistency)
  SELECT year::TEXT INTO current_award_year
  FROM awards
  WHERE id = NEW.award_id;

  -- Check if this company won in previous years
  SELECT is_previous_winner(NEW.organisation_id, current_award_year)
  INTO has_won_before;

  -- Auto-flag if they won before
  IF has_won_before THEN
    NEW.is_previous_winner = TRUE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for INSERT and UPDATE
DROP TRIGGER IF EXISTS trigger_auto_flag_previous_winner_insert ON award_assignments;
CREATE TRIGGER trigger_auto_flag_previous_winner_insert
  BEFORE INSERT ON award_assignments
  FOR EACH ROW
  EXECUTE FUNCTION auto_flag_previous_winner();

DROP TRIGGER IF EXISTS trigger_auto_flag_previous_winner_update ON award_assignments;
CREATE TRIGGER trigger_auto_flag_previous_winner_update
  BEFORE UPDATE ON award_assignments
  FOR EACH ROW
  WHEN (OLD.organisation_id IS DISTINCT FROM NEW.organisation_id)
  EXECUTE FUNCTION auto_flag_previous_winner();

-- ============================================
-- FUNCTION: Copy Nominees to New Year
-- ============================================
-- Copies all nominees from one year to another
-- Automatically detects previous winners during copy

CREATE OR REPLACE FUNCTION copy_nominees_to_new_year(
  from_year TEXT,
  to_year TEXT,
  copy_winners BOOLEAN DEFAULT TRUE,
  copy_all_nominees BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  awards_processed INTEGER,
  nominees_copied INTEGER,
  previous_winners_flagged INTEGER
) AS $$
DECLARE
  awards_count INTEGER := 0;
  nominees_count INTEGER := 0;
  prev_winners_count INTEGER := 0;
BEGIN
  -- Copy nominees from old year to new year
  WITH copied_assignments AS (
    INSERT INTO award_assignments (
      award_id,
      organisation_id,
      status,
      assigned_date,
      nomination_source,
      is_previous_winner,
      winner_position,
      voting_slug,
      public_vote_count
    )
    SELECT
      a_new.id as award_id,
      aa_old.organisation_id,
      'nominated' as status,
      NOW() as assigned_date,
      'year_rollover' as nomination_source,
      FALSE as is_previous_winner, -- Will be auto-flagged by trigger
      NULL as winner_position, -- Reset rankings for new year
      generate_voting_slug(o.company_name, a_new.award_name, to_year) as voting_slug,
      0 as public_vote_count
    FROM award_assignments aa_old
    JOIN awards a_old ON aa_old.award_id = a_old.id
    JOIN awards a_new ON LOWER(TRIM(a_old.award_name)) = LOWER(TRIM(a_new.award_name))
    JOIN organisations o ON aa_old.organisation_id = o.id
    WHERE a_old.year = from_year
      AND a_new.year = to_year
      AND (copy_all_nominees = TRUE OR (copy_winners = TRUE AND aa_old.actual_winner = TRUE))
      AND NOT EXISTS (
        -- Prevent duplicates
        SELECT 1 FROM award_assignments aa_check
        WHERE aa_check.award_id = a_new.id
          AND aa_check.organisation_id = aa_old.organisation_id
      )
    RETURNING *
  )
  SELECT
    COUNT(DISTINCT award_id)::INTEGER,
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE is_previous_winner = TRUE)::INTEGER
  INTO awards_count, nominees_count, prev_winners_count
  FROM copied_assignments;

  RETURN QUERY SELECT awards_count, nominees_count, prev_winners_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- UTILITY QUERIES
-- ============================================

-- View nominee history for a specific company
-- EXAMPLE: Replace 'ABC Construction Ltd' with actual company name
-- SELECT * FROM get_nominee_history(
--   (SELECT id FROM organisations WHERE company_name = 'ABC Construction Ltd')
-- );

-- Copy all 2025 winners to 2026 awards
-- EXAMPLE: Run this when you create 2026 awards
-- SELECT * FROM copy_nominees_to_new_year('2025', '2026', TRUE, FALSE);

-- Copy ALL 2025 nominees to 2026 awards
-- SELECT * FROM copy_nominees_to_new_year('2025', '2026', TRUE, TRUE);

-- View companies with most wins
-- SELECT
--   o.company_name,
--   COUNT(*) as total_wins,
--   STRING_AGG(a.award_name || ' (' || a.year || ')', ', ' ORDER BY a.year DESC) as wins
-- FROM award_assignments aa
-- JOIN awards a ON aa.award_id = a.id
-- JOIN organisations o ON aa.organisation_id = o.id
-- WHERE aa.actual_winner = TRUE
-- GROUP BY o.id, o.company_name
-- ORDER BY total_wins DESC;

-- View companies nominated multiple times but never won
-- SELECT
--   o.company_name,
--   COUNT(*) as times_nominated,
--   STRING_AGG(DISTINCT a.year ORDER BY a.year DESC) as years,
--   STRING_AGG(DISTINCT a.award_name, ', ') as categories
-- FROM award_assignments aa
-- JOIN awards a ON aa.award_id = a.id
-- JOIN organisations o ON aa.organisation_id = o.id
-- WHERE aa.organisation_id NOT IN (
--   SELECT DISTINCT organisation_id
--   FROM award_assignments
--   WHERE actual_winner = TRUE
-- )
-- GROUP BY o.id, o.company_name
-- HAVING COUNT(*) > 1
-- ORDER BY times_nominated DESC;

-- Refresh previous winner flags for existing data (run once after setup)
-- UPDATE award_assignments aa
-- SET is_previous_winner = TRUE
-- WHERE is_previous_winner = FALSE
--   AND EXISTS (
--     SELECT 1
--     FROM award_assignments aa_check
--     JOIN awards a ON aa_check.award_id = a.id
--     JOIN awards a_current ON aa.award_id = a_current.id
--     WHERE aa_check.organisation_id = aa.organisation_id
--       AND aa_check.actual_winner = TRUE
--       AND a.year < a_current.year
--   );
