-- Region-level nominee outreach tracking (Roadmap 2.2). One minimal,
-- idempotent column, not a new table: an entry is already inherently
-- scoped to one area (county_city) and one season (year), so "has THIS
-- entry been sent outreach" is a 1:1 fact that belongs directly on it.
--
-- NOT derived from the pre-existing email_log table deliberately: that
-- table has no entry_id/area/season linkage (only recipient_email),
-- so matching by email alone would be wrong for the same nominee
-- contact entered in more than one area or season.
--
-- "Opened"/"Claimed" tracking is NOT added here -- no email-open-tracking
-- webhook exists in this codebase (only Resend bounce/complaint events are
-- wired), and "Claimed" has no agreed operational definition yet (see
-- BTA-CMS-ROADMAP.md 2.2's own note). Both are flagged, not built, in this
-- migration and the feature it supports.
ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS nominee_outreach_sent_at TIMESTAMPTZ;
