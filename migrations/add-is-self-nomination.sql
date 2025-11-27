-- Migration: Add is_self_nomination column to entries table
-- This column tracks whether an entry was submitted via the public self-nomination form

ALTER TABLE entries
ADD COLUMN IF NOT EXISTS is_self_nomination BOOLEAN DEFAULT false;

-- Update existing entries to false if they don't have a value
UPDATE entries
SET is_self_nomination = false
WHERE is_self_nomination IS NULL;

-- Add comment
COMMENT ON COLUMN entries.is_self_nomination IS 'Entry submitted via public self-nomination form';
