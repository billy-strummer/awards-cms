-- judge_scores is missing most of the columns judge-portal.js's own
-- saveScore() has always sent (Roadmap 3.2/3.3 audit).
--
-- Live production confirmed (information_schema.columns) to have only:
--   id, entry_id, judge_email, judge_name, is_complete, has_conflict,
--   conflict_declared, total_score, created_at
--
-- But saveScore()'s upsert payload has always also included:
--   - one column per scoring criterion id (the 4 DEFAULT_SCORING_CRITERIA
--     ids: innovation_score, impact_score, quality_score,
--     presentation_score -- confirmed as the only ones any existing code
--     actually reads by name, in reporting.js's exportJudgeProgress())
--   - strengths, weaknesses, comments, recommendation (free-text judge
--     feedback fields)
--   - scored_at (distinct from created_at: created_at's DEFAULT only
--     applies on INSERT, so it never reflects a judge updating their own
--     already-saved draft via the onConflict upsert)
--
-- PostgREST rejects an insert/upsert outright if ANY key in the payload
-- doesn't match a real column -- not just the unknown ones -- so every
-- single call to saveScore() has very likely been failing in production
-- for every entry/judge, and reporting.js's own exportJudgeProgress()
-- (which already reads innovation_score/impact_score/quality_score/
-- presentation_score by name) has very likely been failing the same way.
--
-- Award-specific CUSTOM scoring criteria (loaded in judge-portal.js's
-- _loadScoringCriteria(), mapped to ids custom_score_0, custom_score_1, ...)
-- are NOT covered here and are explicitly flagged, not fixed: those ids
-- are unbounded (one per admin-configured criterion, however many an
-- award defines) and not currently read anywhere by name outside
-- judge-portal.js itself, so a fixed migration can't cover every possible
-- award's own criteria count. An award using custom criteria will still
-- fail to save a score after this migration. See
-- BTA-CMS-PROJECT-TASKS.md Section XVI for the full writeup and the
-- options considered (a JSONB criteria_scores column would cover it, but
-- was rejected here because reporting.js already reads the 4 default
-- criteria as flat, named columns -- redesigning the shape is a separate,
-- larger change than "make saveScore() actually work").
ALTER TABLE judge_scores
  ADD COLUMN IF NOT EXISTS innovation_score NUMERIC;
ALTER TABLE judge_scores
  ADD COLUMN IF NOT EXISTS impact_score NUMERIC;
ALTER TABLE judge_scores
  ADD COLUMN IF NOT EXISTS quality_score NUMERIC;
ALTER TABLE judge_scores
  ADD COLUMN IF NOT EXISTS presentation_score NUMERIC;
ALTER TABLE judge_scores
  ADD COLUMN IF NOT EXISTS strengths TEXT;
ALTER TABLE judge_scores
  ADD COLUMN IF NOT EXISTS weaknesses TEXT;
ALTER TABLE judge_scores
  ADD COLUMN IF NOT EXISTS comments TEXT;
ALTER TABLE judge_scores
  ADD COLUMN IF NOT EXISTS recommendation TEXT;
ALTER TABLE judge_scores
  ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ;
