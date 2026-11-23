-- ============================================================
-- MIGRATION 018: Add all missing columns referenced by JS code
-- Fixes schema/code mismatches across deals, events, running_order,
-- social_media_posts, invoices, payments, email_campaigns, contacts,
-- running_order_settings, and the running_order_full view
-- ============================================================

-- 1. DEALS — add 8 missing columns (JS uses deal_name, deal_type, etc.)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS deal_name TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS deal_type TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS deal_value NUMERIC;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS probability INTEGER DEFAULT 50;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS expected_close_date DATE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS actual_close_date DATE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS contact_id UUID;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. EVENTS — add capacity and event_status columns (JS uses event_status not status)
ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity INTEGER;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_status TEXT DEFAULT 'draft';
-- Backfill event_status from status for any existing rows
UPDATE events SET event_status = status WHERE event_status IS NULL AND status IS NOT NULL;

-- 2b. MEETING_NOTES — add meeting_title column (JS uses meeting_title not subject)
ALTER TABLE meeting_notes ADD COLUMN IF NOT EXISTS meeting_title TEXT;
-- Note: database-crm-setup.sql's meeting_notes table already uses meeting_title
-- (no legacy 'subject' column ever existed on this project), so no backfill needed.

-- 3. RUNNING_ORDER — add columns needed by events.js for ceremony management
ALTER TABLE running_order ADD COLUMN IF NOT EXISTS award_number TEXT;
ALTER TABLE running_order ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE running_order ADD COLUMN IF NOT EXISTS award_name TEXT;
ALTER TABLE running_order ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE running_order ADD COLUMN IF NOT EXISTS recipient_collecting TEXT;
ALTER TABLE running_order ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMPTZ;
ALTER TABLE running_order ADD COLUMN IF NOT EXISTS actual_time TIMESTAMPTZ;
ALTER TABLE running_order ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE running_order ADD COLUMN IF NOT EXISTS special_requirements TEXT;
ALTER TABLE running_order ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE running_order ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL;
ALTER TABLE running_order ADD COLUMN IF NOT EXISTS award_id UUID;
ALTER TABLE running_order ADD COLUMN IF NOT EXISTS guest_id UUID REFERENCES event_guests(id) ON DELETE SET NULL;
ALTER TABLE running_order ADD COLUMN IF NOT EXISTS presentation_group TEXT;
ALTER TABLE running_order ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_running_order_event ON running_order(event_id);
CREATE INDEX IF NOT EXISTS idx_running_order_section ON running_order(section);

-- 4. RUNNING_ORDER_SETTINGS — add is_published column
ALTER TABLE running_order_settings ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE;
ALTER TABLE running_order_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 5. SOCIAL_MEDIA_POSTS — add 3 missing columns
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS platform_content JSONB DEFAULT '{}';
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS add_logo_overlay BOOLEAN DEFAULT FALSE;
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 6. INVOICES — add 6 missing columns
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS package_type TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 7. INVOICE_LINE_ITEMS — add item_name and line_total columns
ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS item_name TEXT;
ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS line_total NUMERIC DEFAULT 0;

-- 8. PAYMENTS — add status and notes columns
ALTER TABLE payments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 9. EMAIL_CAMPAIGNS — add missing columns used by resend-email API
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS list_id UUID;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS html_content TEXT;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS sent_count INTEGER DEFAULT 0;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS failed_count INTEGER DEFAULT 0;

-- 10. CONTACTS — add contact_type and is_active (used by judge-automation API)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contact_type TEXT DEFAULT 'general';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 11. EVENT_GUESTS — add guest_name alias column (view references it)
ALTER TABLE event_guests ADD COLUMN IF NOT EXISTS guest_name TEXT;
ALTER TABLE event_guests ADD COLUMN IF NOT EXISTS guest_email TEXT;
-- Backfill guest_name/guest_email from name/email
UPDATE event_guests SET guest_name = name WHERE guest_name IS NULL AND name IS NOT NULL;
UPDATE event_guests SET guest_email = email WHERE guest_email IS NULL AND email IS NOT NULL;

-- 12. Recreate running_order_full view with correct column references
-- DROP first since running_order's column set has changed since the view was
-- last defined, and CREATE OR REPLACE VIEW can't reorder/rename view columns.
DROP VIEW IF EXISTS running_order_full;
CREATE VIEW running_order_full AS
SELECT
  ro.*,
  o.company_name,
  o.logo_url,
  a.award_name as full_award_name,
  COALESCE(eg.guest_name, eg.name) as guest_name,
  COALESCE(eg.guest_email, eg.email) as guest_email,
  eg.rsvp_status,
  e.event_name,
  e.event_date
FROM running_order ro
LEFT JOIN organisations o ON ro.organisation_id = o.id
LEFT JOIN awards a ON ro.award_id = a.id
LEFT JOIN event_guests eg ON ro.guest_id = eg.id
LEFT JOIN events e ON ro.event_id = e.id
ORDER BY ro.event_id, ro.display_order;

-- Grants for the recreated view
GRANT ALL ON running_order_full TO anon;
GRANT ALL ON running_order_full TO authenticated;
GRANT ALL ON running_order_full TO service_role;

-- 13. AWARD_YEARS — add event_id and winner_confirmed (used by events.js award counts)
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS winner_confirmed BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_award_years_event ON award_years(event_id);

-- Recreate the awards view to include the new columns
CREATE OR REPLACE VIEW awards AS SELECT * FROM award_years;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
