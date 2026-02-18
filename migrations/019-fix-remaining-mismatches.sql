-- ============================================================
-- MIGRATION 019: Fix remaining schema/code mismatches
-- Round 3: FK constraint, email_log columns, activity notes,
-- event templates, follow-up assigned_to
-- ============================================================

-- 1. AWARD_ASSIGNMENTS — add missing FK so PostgREST can resolve the hint
--    4 queries use awards!award_assignments_award_id_fkey which requires
--    the actual FK constraint to exist
ALTER TABLE award_assignments
  ADD CONSTRAINT award_assignments_award_id_fkey
  FOREIGN KEY (award_id) REFERENCES award_years(id) ON DELETE SET NULL;

-- 2. EMAIL_LOG — add 3 missing columns used by email-automation API
ALTER TABLE email_log ADD COLUMN IF NOT EXISTS template_key TEXT;
ALTER TABLE email_log ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE email_log ADD COLUMN IF NOT EXISTS error_message TEXT;

-- 3. ORG_ACTIVITY_NOTES — add columns to support the richer data model
--    The JS insert uses type, content, priority, created_by
--    But migration 017 only created: organisation_id, note, user_email
ALTER TABLE org_activity_notes ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'note';
ALTER TABLE org_activity_notes ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE org_activity_notes ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE org_activity_notes ADD COLUMN IF NOT EXISTS created_by TEXT;

-- 4. EVENT_TEMPLATES — add created_by column
ALTER TABLE event_templates ADD COLUMN IF NOT EXISTS created_by TEXT;

-- 5. ORGANISATION_FOLLOW_UPS — add assigned_to column
ALTER TABLE organisation_follow_ups ADD COLUMN IF NOT EXISTS assigned_to TEXT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
