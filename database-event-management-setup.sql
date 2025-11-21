-- ============================================
-- EVENT MANAGEMENT COMPLETE SETUP
-- ============================================
-- This combines Running Order + Table Plan systems
-- Run this entire file in Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 1: RUNNING ORDER SYSTEM
-- ============================================

-- 1. Create running_order table
CREATE TABLE IF NOT EXISTS running_order (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,

  -- Winner/Organisation Details
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  award_id UUID REFERENCES awards(id) ON DELETE SET NULL,
  guest_id UUID REFERENCES event_guests(id) ON DELETE SET NULL,

  -- Display Information
  display_name VARCHAR(255) NOT NULL,
  award_name VARCHAR(255),
  award_number VARCHAR(20) NOT NULL, -- Format: 1-01, 1-02, 2-01, etc.
  recipient_collecting VARCHAR(255), -- Name of person collecting the award

  -- Order Management
  display_order INTEGER NOT NULL,
  section INTEGER DEFAULT 1, -- Section/Act number (1, 2, 3, etc.)

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, announced, completed

  -- Timing
  scheduled_time TIME,
  actual_time TIME,
  duration_minutes INTEGER,

  -- Notes
  notes TEXT,
  special_requirements TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(event_id, award_number)
);

-- 2. Create running_order_settings table
CREATE TABLE IF NOT EXISTS running_order_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL UNIQUE,

  -- State Management
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP WITH TIME ZONE,
  published_by VARCHAR(255),

  -- Auto-numbering Settings
  auto_number_format VARCHAR(50) DEFAULT '{section}-{number:02d}',
  current_section INTEGER DEFAULT 1,

  -- Display Settings
  show_times BOOLEAN DEFAULT TRUE,
  show_notes BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create indexes for running order
CREATE INDEX IF NOT EXISTS idx_running_order_event ON running_order(event_id);
CREATE INDEX IF NOT EXISTS idx_running_order_display_order ON running_order(event_id, display_order);
CREATE INDEX IF NOT EXISTS idx_running_order_organisation ON running_order(organisation_id);
CREATE INDEX IF NOT EXISTS idx_running_order_award ON running_order(award_id);
CREATE INDEX IF NOT EXISTS idx_running_order_number ON running_order(award_number);

-- 4. Create function to auto-update timestamps
CREATE OR REPLACE FUNCTION update_running_order_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create triggers for auto-update timestamps
DROP TRIGGER IF EXISTS running_order_updated_at ON running_order;
CREATE TRIGGER running_order_updated_at
  BEFORE UPDATE ON running_order
  FOR EACH ROW
  EXECUTE FUNCTION update_running_order_timestamp();

DROP TRIGGER IF EXISTS running_order_settings_updated_at ON running_order_settings;
CREATE TRIGGER running_order_settings_updated_at
  BEFORE UPDATE ON running_order_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_running_order_timestamp();

-- 6. Create function to get next award number
CREATE OR REPLACE FUNCTION get_next_award_number(
  p_event_id UUID,
  p_section INTEGER DEFAULT 1
)
RETURNS VARCHAR AS $$
DECLARE
  v_next_number INTEGER;
  v_award_number VARCHAR;
BEGIN
  -- Get the highest number in this section
  SELECT COALESCE(MAX(CAST(SPLIT_PART(award_number, '-', 2) AS INTEGER)), 0) + 1
  INTO v_next_number
  FROM running_order
  WHERE event_id = p_event_id
    AND section = p_section;

  -- Format as section-number (e.g., "1-01")
  v_award_number := p_section || '-' || LPAD(v_next_number::TEXT, 2, '0');

  RETURN v_award_number;
END;
$$ LANGUAGE plpgsql;

-- 7. Create function to auto-populate from RSVPs
CREATE OR REPLACE FUNCTION populate_running_order_from_rsvps(p_event_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_guest RECORD;
  v_next_order INTEGER;
  v_award_number VARCHAR;
BEGIN
  -- Get current max display order
  SELECT COALESCE(MAX(display_order), 0) + 1
  INTO v_next_order
  FROM running_order
  WHERE event_id = p_event_id;

  -- Insert winners from accepted RSVPs that aren't already in running order
  FOR v_guest IN
    SELECT DISTINCT
      eg.id as guest_id,
      eg.organisation_id,
      eg.guest_name,
      o.company_name,
      aa.award_id,
      a.award_name
    FROM event_guests eg
    LEFT JOIN organisations o ON eg.organisation_id = o.id
    LEFT JOIN award_assignments aa ON aa.organisation_id = eg.organisation_id
      AND aa.status = 'winner'
    LEFT JOIN awards a ON aa.award_id = a.id
    WHERE eg.event_id = p_event_id
      AND eg.rsvp_status = 'confirmed'
      AND NOT EXISTS (
        SELECT 1 FROM running_order ro
        WHERE ro.event_id = p_event_id
          AND ro.guest_id = eg.id
      )
  LOOP
    -- Get next award number
    v_award_number := get_next_award_number(p_event_id, 1);

    -- Insert into running order
    INSERT INTO running_order (
      event_id,
      organisation_id,
      award_id,
      guest_id,
      display_name,
      award_name,
      award_number,
      display_order,
      section,
      recipient_collecting
    ) VALUES (
      p_event_id,
      v_guest.organisation_id,
      v_guest.award_id,
      v_guest.guest_id,
      COALESCE(v_guest.company_name, 'Guest'),
      v_guest.award_name,
      v_award_number,
      v_next_order,
      1,
      v_guest.guest_name
    );

    v_count := v_count + 1;
    v_next_order := v_next_order + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to reorder and renumber awards
CREATE OR REPLACE FUNCTION reorder_running_order(
  p_event_id UUID,
  p_order_array UUID[]
)
RETURNS VOID AS $$
DECLARE
  v_index INTEGER;
  v_id UUID;
  v_section INTEGER := 1;
  v_number INTEGER := 1;
  v_award_number VARCHAR;
BEGIN
  -- Loop through the array and update order
  FOR v_index IN 1..array_length(p_order_array, 1)
  LOOP
    v_id := p_order_array[v_index];
    v_award_number := v_section || '-' || LPAD(v_number::TEXT, 2, '0');

    UPDATE running_order
    SET
      display_order = v_index,
      award_number = v_award_number,
      section = v_section
    WHERE id = v_id
      AND event_id = p_event_id;

    v_number := v_number + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 9. Create view for running order with full details
CREATE OR REPLACE VIEW running_order_full AS
SELECT
  ro.*,
  o.company_name,
  o.logo_url,
  a.award_name as full_award_name,
  a.award_category,
  eg.guest_name,
  eg.guest_email,
  eg.rsvp_status,
  e.event_name,
  e.event_date
FROM running_order ro
LEFT JOIN organisations o ON ro.organisation_id = o.id
LEFT JOIN awards a ON ro.award_id = a.id
LEFT JOIN event_guests eg ON ro.guest_id = eg.id
LEFT JOIN events e ON ro.event_id = e.id
ORDER BY ro.event_id, ro.display_order;

-- ============================================
-- PART 2: TABLE PLAN SYSTEM
-- ============================================

-- 1. Create event_tables table
CREATE TABLE IF NOT EXISTS event_tables (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,

  -- Table Information
  table_number INTEGER NOT NULL,
  table_name VARCHAR(100), -- Optional: "VIP Table", "Sponsor Table", etc.
  total_seats INTEGER NOT NULL DEFAULT 8,
  shape VARCHAR(50) DEFAULT 'round', -- round, rectangular, oval

  -- Layout Position (for visual editor)
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(event_id, table_number)
);

-- 2. Create table_assignments table
CREATE TABLE IF NOT EXISTS table_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  table_id UUID REFERENCES event_tables(id) ON DELETE CASCADE NOT NULL,
  guest_id UUID REFERENCES event_guests(id) ON DELETE CASCADE,

  -- Guest Information
  guest_name VARCHAR(255) NOT NULL,
  organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  company_name VARCHAR(255),

  -- Seating Details
  seat_number INTEGER,
  is_vip BOOLEAN DEFAULT FALSE,
  dietary_requirements TEXT,

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create indexes for table plan
CREATE INDEX IF NOT EXISTS idx_event_tables_event ON event_tables(event_id);
CREATE INDEX IF NOT EXISTS idx_event_tables_number ON event_tables(event_id, table_number);
CREATE INDEX IF NOT EXISTS idx_table_assignments_event ON table_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_table_assignments_table ON table_assignments(table_id);
CREATE INDEX IF NOT EXISTS idx_table_assignments_guest ON table_assignments(guest_id);

-- 4. Create function to auto-update table plan timestamps
CREATE OR REPLACE FUNCTION update_table_plan_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create triggers for table plan auto-update timestamps
DROP TRIGGER IF EXISTS event_tables_updated_at ON event_tables;
CREATE TRIGGER event_tables_updated_at
  BEFORE UPDATE ON event_tables
  FOR EACH ROW
  EXECUTE FUNCTION update_table_plan_timestamp();

DROP TRIGGER IF EXISTS table_assignments_updated_at ON table_assignments;
CREATE TRIGGER table_assignments_updated_at
  BEFORE UPDATE ON table_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_table_plan_timestamp();

-- 6. Create function to get available seats for a table
CREATE OR REPLACE FUNCTION get_available_seats(p_table_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_total_seats INTEGER;
  v_assigned_seats INTEGER;
BEGIN
  -- Get total seats
  SELECT total_seats INTO v_total_seats
  FROM event_tables
  WHERE id = p_table_id;

  -- Get assigned seats count
  SELECT COUNT(*) INTO v_assigned_seats
  FROM table_assignments
  WHERE table_id = p_table_id;

  RETURN COALESCE(v_total_seats, 0) - COALESCE(v_assigned_seats, 0);
END;
$$ LANGUAGE plpgsql;

-- 7. Create function to get unassigned guests for an event
CREATE OR REPLACE FUNCTION get_unassigned_guests(p_event_id UUID)
RETURNS TABLE (
  guest_id UUID,
  guest_name VARCHAR,
  guest_email VARCHAR,
  organisation_id UUID,
  company_name VARCHAR,
  rsvp_status VARCHAR,
  plus_ones INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    eg.id,
    eg.guest_name,
    eg.guest_email,
    eg.organisation_id,
    o.company_name,
    eg.rsvp_status,
    eg.plus_ones
  FROM event_guests eg
  LEFT JOIN organisations o ON eg.organisation_id = o.id
  WHERE eg.event_id = p_event_id
    AND eg.rsvp_status = 'confirmed'
    AND NOT EXISTS (
      SELECT 1 FROM table_assignments ta
      WHERE ta.guest_id = eg.id
        AND ta.event_id = p_event_id
    )
  ORDER BY o.company_name, eg.guest_name;
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to auto-number tables
CREATE OR REPLACE FUNCTION get_next_table_number(p_event_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_max_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(table_number), 0) + 1
  INTO v_max_number
  FROM event_tables
  WHERE event_id = p_event_id;

  RETURN v_max_number;
END;
$$ LANGUAGE plpgsql;

-- 9. Create view for table plan summary
CREATE OR REPLACE VIEW table_plan_summary AS
SELECT
  et.id as table_id,
  et.event_id,
  et.table_number,
  et.table_name,
  et.total_seats,
  et.shape,
  COUNT(ta.id) as assigned_seats,
  et.total_seats - COUNT(ta.id) as available_seats,
  ARRAY_AGG(
    CASE
      WHEN ta.guest_name IS NOT NULL
      THEN json_build_object(
        'guest_name', ta.guest_name,
        'company_name', ta.company_name,
        'seat_number', ta.seat_number
      )
    END
  ) FILTER (WHERE ta.guest_name IS NOT NULL) as guests
FROM event_tables et
LEFT JOIN table_assignments ta ON et.id = ta.table_id
GROUP BY et.id, et.event_id, et.table_number, et.table_name, et.total_seats, et.shape
ORDER BY et.table_number;

-- ============================================
-- SETUP COMPLETE!
-- ============================================

SELECT
  'Event Management Systems Installed!' as message,
  'Running Order + Table Plan' as systems,
  '4 tables, 9 functions, 2 views' as objects_created;
