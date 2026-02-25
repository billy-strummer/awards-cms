-- ============================================
-- ADD guest_type TO table_assignments
-- ============================================
-- Stores the full guest type (vip, speaker, sponsor, media, staff, guest)
-- so the table plan can display accurate type badges instead of only
-- the boolean is_vip flag.

ALTER TABLE table_assignments ADD COLUMN IF NOT EXISTS guest_type TEXT DEFAULT 'guest';

-- Backfill from is_vip where possible
UPDATE table_assignments SET guest_type = 'vip' WHERE is_vip = TRUE AND (guest_type IS NULL OR guest_type = 'guest');

NOTIFY pgrst, 'reload schema';
