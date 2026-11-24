-- Region-level ("Headline") sponsor assignment (Roadmap 3.1).
--
-- sponsor_assignments already links a sponsor to an award category
-- (award_id -> award_years) via the existing Marketing -> Sponsors "category
-- sponsorships" picker (marketing.js) -- that mechanism is reused as-is for
-- Category Sponsors and needs no schema change.
--
-- There is no existing way to link a sponsor to an AREA as a whole
-- (independent of any one category), which the Region Hub's "Headline
-- Sponsor" card needs. Rather than a new table, this extends the same
-- sponsor_assignments table with the two columns a region-level row needs:
-- which area, and which season (sponsorship deals are typically per-year,
-- the same convention award_years/entries already use throughout this
-- project -- areas themselves have no year dimension of their own).
--
-- A region-level row is distinguished by having area_id set and award_id/
-- event_id left null (assignment_type = 'region'); the existing category
-- rows continue to have award_id set and area_id left null
-- (assignment_type = 'award', already the column's default). One row per
-- area+season is enforced at the application level (delete-then-insert,
-- the same convention the existing category-sponsor code already uses),
-- not a DB constraint.
--
-- CORRECTION (found via live schema verification before applying this
-- migration): migrations/046-catchup-missing-objects.sql's
-- "CREATE TABLE IF NOT EXISTS sponsor_assignments (..., assignment_type
-- TEXT DEFAULT 'award', created_at, updated_at)" assumed a clean install.
-- On an environment where sponsor_assignments already existed before 046
-- ran (confirmed live on production), that CREATE TABLE IF NOT EXISTS
-- silently no-ops, so assignment_type was never actually added there --
-- the existing Marketing -> Sponsors category-sponsor code (marketing.js)
-- never reads or writes assignment_type, so this went unnoticed. This
-- migration's own area_id/year columns are useless without
-- assignment_type to distinguish a region row from a category row, so it
-- is added here too, the same idempotent way, rather than assumed.
ALTER TABLE sponsor_assignments
  ADD COLUMN IF NOT EXISTS assignment_type TEXT DEFAULT 'award';
ALTER TABLE sponsor_assignments
  ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id) ON DELETE CASCADE;
ALTER TABLE sponsor_assignments
  ADD COLUMN IF NOT EXISTS year INTEGER;
