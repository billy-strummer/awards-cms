-- Add the pre-assigned priority rank (1, 2, 3, ... or null) that bulk
-- upload spreadsheets carry per nominee row (column "Rank"). This is a
-- property of the nomination itself (an organisation can rank differently
-- in different categories), so it belongs on entries, not organisations --
-- not to be confused with shortlists.rank, which is a judge-score-derived
-- ranking computed after judging, a different concept entirely.
ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS priority_rank SMALLINT
  CHECK (priority_rank IS NULL OR priority_rank > 0);
