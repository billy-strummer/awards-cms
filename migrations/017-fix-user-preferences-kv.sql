-- ============================================================
-- MIGRATION 017: Fix user_preferences to support KV store pattern
-- The JS code uses a key/value pattern but the original migration
-- created a column-per-setting design. This adds a proper KV table.
-- ============================================================

-- Add key and value columns to existing user_preferences table
-- to support both the column-based and KV-store patterns
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS key TEXT;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS value TEXT;

-- Create a unique index on key (for onConflict: 'key' upserts)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_preferences_key ON user_preferences(key) WHERE key IS NOT NULL;

-- Drop the user_email UNIQUE constraint so multiple rows per user are allowed
-- (each row is a different key for the same user)
ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_user_email_key;

-- Create composite unique index for user+key pairs
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_preferences_user_key ON user_preferences(user_email, key) WHERE key IS NOT NULL;

-- Also create the org_activity_notes table (referenced by organisations.js)
CREATE TABLE IF NOT EXISTS org_activity_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_activity_notes_org ON org_activity_notes(organisation_id);

-- RLS for new table
ALTER TABLE org_activity_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated full access on org_activity_notes" ON org_activity_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read on org_activity_notes" ON org_activity_notes FOR SELECT TO anon USING (true);
