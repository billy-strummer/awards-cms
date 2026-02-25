-- ============================================================
-- Migration 036: Fix missing columns found during full CMS audit
-- ============================================================
-- Several tables are missing columns that the JS frontend tries
-- to insert/read, causing silent Supabase errors that fall back
-- to localStorage (data appears to save but is lost on refresh).
-- ============================================================

-- 1. MEETING_NOTES: missing location and action_items
-- saveMeetingNote() in crm.js inserts these but the columns don't exist
ALTER TABLE meeting_notes ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE meeting_notes ADD COLUMN IF NOT EXISTS action_items TEXT;

-- 2. COMMUNICATIONS: missing user_id
-- saveCommunication() in crm.js inserts user_id to track who logged it
ALTER TABLE communications ADD COLUMN IF NOT EXISTS user_id TEXT;

-- 3. EVENT_GUESTS: missing dietary_requirements, guest_type, plus_ones, organisation_id
-- events.js reads/writes these for seating charts, name badges, dietary summaries
ALTER TABLE event_guests ADD COLUMN IF NOT EXISTS dietary_requirements TEXT;
ALTER TABLE event_guests ADD COLUMN IF NOT EXISTS guest_type TEXT DEFAULT 'guest';
ALTER TABLE event_guests ADD COLUMN IF NOT EXISTS plus_ones INTEGER DEFAULT 0;
ALTER TABLE event_guests ADD COLUMN IF NOT EXISTS organisation_id UUID;

-- 4. EVENT_SPECIAL_REQUIREMENTS: missing requirements JSONB column
-- saveSpecialReqs() in events.js stores all requirements as a single
-- JSONB object in a "requirements" column, but the original table only
-- had individual boolean/text columns that the JS never uses
ALTER TABLE event_special_requirements ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT '{}';

-- 5. EVENT_POST_DATA: missing post_data JSONB column
-- savePostEventData() in events.js stores all post-event data as a single
-- JSONB object in a "post_data" column, but the original table only had
-- individual columns that the JS never uses
ALTER TABLE event_post_data ADD COLUMN IF NOT EXISTS post_data JSONB DEFAULT '{}';

-- Refresh PostgREST schema cache so new columns are immediately available
NOTIFY pgrst, 'reload schema';
