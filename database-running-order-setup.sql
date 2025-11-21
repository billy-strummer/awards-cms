-- ============================================
-- RUNNING ORDER SYSTEM FOR AWARDS CEREMONY
-- ============================================
-- This system manages the ceremony running order with auto-numbering
-- and links photos to winners during the event
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

-- 2. Create running_order_settings table for managing edit/published state
CREATE TABLE IF NOT EXISTS running_order_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL UNIQUE,

  -- State Management
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP WITH TIME ZONE,
  published_by VARCHAR(255),

  -- Auto-numbering Settings
  auto_number_format VARCHAR(50) DEFAULT '{section}-{number:02d}', -- e.g., "1-01", "2-03"
  current_section INTEGER DEFAULT 1,

  -- Display Settings
  show_times BOOLEAN DEFAULT TRUE,
  show_notes BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create indexes for better performance
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
      section
    ) VALUES (
      p_event_id,
      v_guest.organisation_id,
      v_guest.award_id,
      v_guest.guest_id,
      COALESCE(v_guest.company_name, 'Guest'),
      v_guest.award_name,
      v_award_number,
      v_next_order,
      1
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
  a.category as award_category,
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
-- SETUP COMPLETE!
-- ============================================

SELECT
  'Running Order System Installed!' as message,
  'Tables: running_order, running_order_settings' as tables_created,
  'Functions: get_next_award_number, populate_running_order_from_rsvps, reorder_running_order' as functions_created,
  'View: running_order_full' as views_created;
