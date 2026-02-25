-- Add status column to event_vendors table
-- The vendor form includes a status field (confirmed/pending/cancelled/enquired)
-- but the column was missing from the original table definition
ALTER TABLE event_vendors ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
