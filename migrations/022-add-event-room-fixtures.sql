-- ============================================
-- ADD EVENT ROOM FIXTURES TABLE
-- ============================================
-- Stores stage, photowall, AV booth and other
-- room elements placed on the table plan canvas.
-- Without this table, fixtures fall back to
-- localStorage and don't persist across sessions.
-- ============================================

CREATE TABLE IF NOT EXISTS event_room_fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  fixture_type TEXT NOT NULL,
  label TEXT,
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  width INTEGER DEFAULT 120,
  height INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_room_fixtures_event ON event_room_fixtures(event_id);

-- RLS
ALTER TABLE event_room_fixtures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to event_room_fixtures" ON event_room_fixtures;
CREATE POLICY "Allow all access to event_room_fixtures"
  ON event_room_fixtures FOR ALL
  USING (true)
  WITH CHECK (true);
