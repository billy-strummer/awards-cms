-- ============================================================
-- Migration 068: Add area_id/country columns awards.js and
-- organisations.js actually save, plus award_years.scoring_criteria
-- ============================================================
-- Both the Add/Edit Award form (awards.js saveAward) and the Add/Edit
-- Organisation form (organisations.js) write `country` and `area_id`
-- (a FK into the 'areas' table added in migration 067) directly onto
-- their records, but neither award_years nor organisations had these
-- columns — every award/organisation save failed with
-- "column awards.area_id does not exist".
-- ============================================================

ALTER TABLE award_years ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id);
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS scoring_criteria TEXT;

ALTER TABLE organisations ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id);

CREATE INDEX IF NOT EXISTS idx_award_years_area ON award_years(area_id);
CREATE INDEX IF NOT EXISTS idx_organisations_area ON organisations(area_id);

NOTIFY pgrst, 'reload schema';
