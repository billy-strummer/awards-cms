-- Migration 025: Add winner_status column for status tracking workflow
-- Statuses: pending, notified, pack_sent, confirmed, published

ALTER TABLE winners ADD COLUMN IF NOT EXISTS winner_status TEXT DEFAULT 'pending';

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON winners TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON winners TO anon;
