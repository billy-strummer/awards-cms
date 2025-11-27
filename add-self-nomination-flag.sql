-- ============================================
-- ADD SELF-NOMINATION FLAG TO ENTRIES TABLE
-- ============================================
-- This adds a boolean flag to mark entries as self-nominations

ALTER TABLE entries
ADD COLUMN IF NOT EXISTS is_self_nomination BOOLEAN DEFAULT false;

-- Update existing entries submitted through the public form to be marked as self-nominations
-- (entries with status 'submitted' and no payment are likely self-nominations)
UPDATE entries
SET is_self_nomination = true
WHERE status = 'submitted'
  AND payment_status = 'pending'
  AND is_self_nomination IS NOT true;

-- Add comment
COMMENT ON COLUMN entries.is_self_nomination IS 'Indicates if this entry was self-nominated through the public form';

-- Verification query
SELECT
  status,
  is_self_nomination,
  COUNT(*) as count
FROM entries
GROUP BY status, is_self_nomination
ORDER BY status, is_self_nomination;
