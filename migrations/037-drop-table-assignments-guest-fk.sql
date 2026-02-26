-- ============================================
-- DROP FK ON table_assignments.guest_id
-- ============================================
-- The original schema created guest_id with:
--   REFERENCES event_attendees(id) ON DELETE CASCADE
--
-- But the table plan now loads guests from BOTH event_guests and
-- event_attendees. When a guest sourced from event_guests is assigned,
-- the FK fails because the UUID doesn't exist in event_attendees.
--
-- Fix: drop the FK so guest_id can hold IDs from either table.
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'table_assignments_guest_id_fkey'
  ) THEN
    ALTER TABLE table_assignments DROP CONSTRAINT table_assignments_guest_id_fkey;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
