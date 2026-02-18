-- ============================================
-- 023: Fix event_attendees column mismatches
-- ============================================
-- The JS UI uses property names (guest_type, plus_ones, notes, etc.)
-- that don't exist on the original event_attendees table.
-- This migration adds the missing columns.

ALTER TABLE event_attendees ADD COLUMN IF NOT EXISTS guest_type TEXT DEFAULT 'guest';
ALTER TABLE event_attendees ADD COLUMN IF NOT EXISTS plus_ones INTEGER DEFAULT 0;
ALTER TABLE event_attendees ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE event_attendees ADD COLUMN IF NOT EXISTS checked_in BOOLEAN DEFAULT FALSE;
ALTER TABLE event_attendees ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMPTZ;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
