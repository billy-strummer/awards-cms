-- ============================================
-- RUNNING ORDER ENHANCEMENTS
-- ============================================
-- Adds: item_type, sponsor, ceremony_start_time, auto_schedule
-- ============================================

-- 1. Add item_type column to distinguish awards from section breaks
ALTER TABLE running_order ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) DEFAULT 'award';
-- item_type values: 'award', 'break', 'speech', 'entertainment', 'interval', 'other'

-- 2. Add sponsor/presented_by field
ALTER TABLE running_order ADD COLUMN IF NOT EXISTS sponsor VARCHAR(255);

-- 3. Add ceremony_start_time and auto_schedule to settings
ALTER TABLE running_order_settings ADD COLUMN IF NOT EXISTS ceremony_start_time TIME;
ALTER TABLE running_order_settings ADD COLUMN IF NOT EXISTS auto_schedule BOOLEAN DEFAULT FALSE;

-- 4. Update the running_order_full view
-- item_type was just appended to running_order, which shifts the position of
-- ro.*'s expanded columns relative to the view's previous definition; DROP first
-- since CREATE OR REPLACE VIEW can't reorder/rename existing view columns.
DROP VIEW IF EXISTS running_order_full;
CREATE VIEW running_order_full AS
SELECT
  ro.*,
  o.company_name,
  o.logo_url,
  a.award_name as full_award_name,
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

SELECT 'Running Order Enhancements Applied!' as message;
