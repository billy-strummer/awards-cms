-- ============================================
-- FIX EVENT_TABLES AND TABLE_ASSIGNMENTS SCHEMA
-- ============================================
-- The base migration (000) created event_tables with minimal columns:
--   id, event_id, table_number, capacity, created_at
--
-- But the table plan feature requires additional columns for layout,
-- display, and seating management. This migration adds all missing
-- columns so the table plan works correctly.
--
-- Similarly, table_assignments needs additional guest detail columns
-- beyond the basic foreign keys.
-- ============================================

-- ============================================
-- 1. ADD MISSING COLUMNS TO event_tables
-- ============================================

-- Table display name (e.g. "VIP Table", "Sponsor Table")
ALTER TABLE event_tables ADD COLUMN IF NOT EXISTS table_name VARCHAR(100);

-- Total seats (code uses total_seats, not capacity)
ALTER TABLE event_tables ADD COLUMN IF NOT EXISTS total_seats INTEGER DEFAULT 8;

-- Table shape for visual layout
ALTER TABLE event_tables ADD COLUMN IF NOT EXISTS shape VARCHAR(50) DEFAULT 'round';

-- Position on the visual canvas editor
ALTER TABLE event_tables ADD COLUMN IF NOT EXISTS position_x INTEGER DEFAULT 0;
ALTER TABLE event_tables ADD COLUMN IF NOT EXISTS position_y INTEGER DEFAULT 0;

-- Active status flag
ALTER TABLE event_tables ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Notes field
ALTER TABLE event_tables ADD COLUMN IF NOT EXISTS notes TEXT;

-- Updated timestamp
ALTER TABLE event_tables ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Section and accessibility (from migration 021)
ALTER TABLE event_tables ADD COLUMN IF NOT EXISTS section_id UUID;
ALTER TABLE event_tables ADD COLUMN IF NOT EXISTS is_accessible BOOLEAN DEFAULT FALSE;

-- Unique constraint on event_id + table_number (ignore if exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_tables_event_id_table_number_key'
  ) THEN
    ALTER TABLE event_tables ADD CONSTRAINT event_tables_event_id_table_number_key
      UNIQUE (event_id, table_number);
  END IF;
END $$;

-- Copy existing capacity values to total_seats where total_seats is still default
UPDATE event_tables
SET total_seats = capacity
WHERE capacity IS NOT NULL
  AND capacity != 10
  AND total_seats = 8;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_event_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS event_tables_updated_at ON event_tables;
CREATE TRIGGER event_tables_updated_at
  BEFORE UPDATE ON event_tables
  FOR EACH ROW
  EXECUTE FUNCTION update_event_tables_updated_at();

-- ============================================
-- 2. ADD MISSING COLUMNS TO table_assignments
-- ============================================

-- Guest details for display without joins
ALTER TABLE table_assignments ADD COLUMN IF NOT EXISTS guest_name VARCHAR(255);
ALTER TABLE table_assignments ADD COLUMN IF NOT EXISTS organisation_id UUID;
ALTER TABLE table_assignments ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
ALTER TABLE table_assignments ADD COLUMN IF NOT EXISTS seat_number INTEGER;
ALTER TABLE table_assignments ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE;
ALTER TABLE table_assignments ADD COLUMN IF NOT EXISTS dietary_requirements TEXT;

-- Add FK for organisation_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'table_assignments_organisation_id_fkey'
  ) THEN
    ALTER TABLE table_assignments
      ADD CONSTRAINT table_assignments_organisation_id_fkey
      FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- ============================================
-- 3. CREATE event_room_fixtures IF NOT EXISTS
-- ============================================
-- Room fixtures (stage, photowall, AV booth) for the table plan canvas

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

ALTER TABLE event_room_fixtures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to event_room_fixtures" ON event_room_fixtures;
CREATE POLICY "Allow all access to event_room_fixtures"
  ON event_room_fixtures FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 4. HELPER FUNCTIONS
-- ============================================

-- Get next table number for an event
CREATE OR REPLACE FUNCTION get_next_table_number(p_event_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(MAX(table_number), 0) + 1
  FROM event_tables
  WHERE event_id = p_event_id;
$$ LANGUAGE sql;

-- Get unassigned guests for an event
CREATE OR REPLACE FUNCTION get_unassigned_guests(p_event_id UUID)
RETURNS TABLE (
  id UUID,
  guest_id UUID,
  guest_name TEXT,
  organisation_id UUID,
  company_name TEXT,
  is_vip BOOLEAN,
  dietary_requirements TEXT
) AS $$
  SELECT
    ea.id,
    ea.id as guest_id,
    ea.attendee_name as guest_name,
    ea.organisation_id,
    o.company_name,
    FALSE as is_vip,
    ea.meal_preference as dietary_requirements
  FROM event_attendees ea
  LEFT JOIN organisations o ON ea.organisation_id = o.id
  WHERE ea.event_id = p_event_id
    AND ea.rsvp_status IN ('attending', 'confirmed')
    AND ea.id NOT IN (
      SELECT ta.guest_id FROM table_assignments ta
      WHERE ta.event_id = p_event_id
        AND ta.guest_id IS NOT NULL
    );
$$ LANGUAGE sql;

-- ============================================
-- 5. GRANT PERMISSIONS
-- ============================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['event_tables', 'table_assignments', 'event_room_fixtures']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('GRANT ALL ON public.%I TO anon', tbl);
      EXECUTE format('GRANT ALL ON public.%I TO authenticated', tbl);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl);
    END IF;
  END LOOP;
END $$;

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION get_next_table_number(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_unassigned_guests(UUID) TO anon, authenticated, service_role;

-- ============================================
-- 6. RELOAD SCHEMA CACHE
-- ============================================
-- This is critical! Without this, PostgREST won't see the new columns
-- and will throw "Could not find the 'position_x' column" errors.

NOTIFY pgrst, 'reload schema';
