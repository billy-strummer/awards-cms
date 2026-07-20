-- ============================================================
-- MIGRATION 015: Migrate localStorage data to Supabase
-- Moves event tickets, budgets, vendors, milestones, waitlists,
-- special requirements, post-event data, and audit logs to DB
-- ============================================================

-- 1. Event Tickets
CREATE TABLE IF NOT EXISTS event_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ticket_number TEXT NOT NULL,
  attendee_id TEXT,
  attendee_name TEXT,
  attendee_email TEXT,
  guest_type TEXT DEFAULT 'guest',
  status TEXT DEFAULT 'issued' CHECK (status IN ('issued', 'revoked', 'used')),
  issued_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_tickets_event ON event_tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_event_tickets_status ON event_tickets(status);

-- 2. Event Budgets
CREATE TABLE IF NOT EXISTS event_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  total_budget NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  estimated_amount NUMERIC(12,2) DEFAULT 0,
  actual_amount NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_budget_items_event ON event_budget_items(event_id);

-- 3. Event Vendors
CREATE TABLE IF NOT EXISTS event_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  contact_name TEXT,
  company TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  vendor_type TEXT,
  cost NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_vendors_event ON event_vendors(event_id);

-- 4. Event Milestones
CREATE TABLE IF NOT EXISTS event_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  milestone_id TEXT NOT NULL,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  is_custom BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_milestones_event ON event_milestones(event_id);

-- 5. Event Waitlist
CREATE TABLE IF NOT EXISTS event_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'promoted', 'removed')),
  promoted BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_waitlist_event ON event_waitlist(event_id);

-- 6. Event Special Requirements
CREATE TABLE IF NOT EXISTS event_special_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  step_free_access BOOLEAN DEFAULT false,
  accessible_toilets BOOLEAN DEFAULT false,
  hearing_loop BOOLEAN DEFAULT false,
  reserved_seating BOOLEAN DEFAULT false,
  dietary_notes TEXT,
  other_requirements TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id)
);

-- 7. Event Post-Event Data
CREATE TABLE IF NOT EXISTS event_post_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  attendance_rate NUMERIC(5,2),
  no_show_count INT DEFAULT 0,
  peak_checkin_hour TEXT,
  survey_link TEXT,
  survey_sent BOOLEAN DEFAULT false,
  thank_you_sent BOOLEAN DEFAULT false,
  debrief_notes TEXT,
  debrief_highlights TEXT,
  debrief_improvements TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id)
);

-- 8. Audit Logs (move from localStorage to DB)
CREATE TABLE IF NOT EXISTS cms_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'login', 'logout', 'export', 'import')),
  entity TEXT NOT NULL,
  entity_id TEXT,
  description TEXT,
  user_email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- database-multiuser-tables-setup.sql already created a minimal cms_audit_logs
-- table (with entity_type instead of entity); backfill columns missing from that version.
ALTER TABLE cms_audit_logs ADD COLUMN IF NOT EXISTS entity TEXT;
ALTER TABLE cms_audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE cms_audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE cms_audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_cms_audit_logs_action ON cms_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_cms_audit_logs_entity ON cms_audit_logs(entity);
CREATE INDEX IF NOT EXISTS idx_cms_audit_logs_created ON cms_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cms_audit_logs_user ON cms_audit_logs(user_email);

-- 9. GDPR Data Requests
CREATE TABLE IF NOT EXISTS gdpr_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT NOT NULL CHECK (request_type IN ('export', 'delete', 'anonymize')),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  requester_email TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  processed_by TEXT,
  processed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gdpr_requests_status ON gdpr_requests(status);

-- 10. Notification Queue
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  template_id TEXT,
  template_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  last_error TEXT,
  scheduled_for TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled ON notification_queue(scheduled_for);

-- 11. User Preferences (move darkMode etc from localStorage)
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL UNIQUE,
  dark_mode BOOLEAN DEFAULT false,
  column_visibility JSONB DEFAULT '{}',
  filter_presets JSONB DEFAULT '[]',
  saved_views JSONB DEFAULT '[]',
  custom_column_order JSONB DEFAULT '[]',
  page_size INT DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- database-multiuser-tables-setup.sql already created a minimal user_preferences
-- table for the key/value pattern (id, key, value, updated_at); backfill the
-- column-per-setting fields this migration also needs. Migration 017 later adds
-- the composite (user_email, key) unique index and drops any bare user_email
-- unique constraint, so leave user_email unconstrained here.
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS dark_mode BOOLEAN DEFAULT false;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS column_visibility JSONB DEFAULT '{}';
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS filter_presets JSONB DEFAULT '[]';
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS saved_views JSONB DEFAULT '[]';
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS custom_column_order JSONB DEFAULT '[]';
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS page_size INT DEFAULT 50;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 12. Scheduled Reports (move from localStorage)
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('Daily', 'Weekly', 'Monthly')),
  recipients TEXT NOT NULL,
  sections JSONB DEFAULT '[]',
  active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies for all new tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'event_tickets', 'event_budgets', 'event_budget_items',
    'event_vendors', 'event_milestones', 'event_waitlist',
    'event_special_requirements', 'event_post_data',
    'cms_audit_logs', 'gdpr_requests', 'notification_queue',
    'user_preferences', 'scheduled_reports'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('CREATE POLICY "Allow authenticated full access on %I" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "Allow anon read on %I" ON %I FOR SELECT TO anon USING (true)', tbl, tbl);
  END LOOP;
END $$;

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'event_tickets', 'event_budgets', 'event_budget_items',
    'event_vendors', 'event_milestones', 'event_waitlist',
    'event_special_requirements', 'event_post_data',
    'gdpr_requests', 'user_preferences', 'scheduled_reports'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- Function to log audit entries
CREATE OR REPLACE FUNCTION log_audit(
  p_action TEXT,
  p_entity TEXT,
  p_description TEXT,
  p_entity_id TEXT DEFAULT NULL,
  p_user_email TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO cms_audit_logs (action, entity, description, entity_id, user_email, metadata)
  VALUES (p_action, p_entity, p_description, p_entity_id, p_user_email, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to anonymize organisation data (GDPR)
CREATE OR REPLACE FUNCTION anonymize_organisation(p_org_id UUID) RETURNS VOID AS $$
BEGIN
  UPDATE organisations SET
    company_name = 'REDACTED-' || LEFT(p_org_id::TEXT, 8),
    email = NULL,
    contact_phone = NULL,
    website = NULL,
    address = NULL,
    postcode = NULL,
    contact_name = NULL,
    notes = NULL
  WHERE id = p_org_id;

  UPDATE organisation_contacts SET
    first_name = 'REDACTED',
    last_name = 'REDACTED',
    email = NULL,
    phone = NULL,
    job_title = NULL
  WHERE organisation_id = p_org_id;
END;
$$ LANGUAGE plpgsql;

-- Function to queue notification
CREATE OR REPLACE FUNCTION queue_notification(
  p_type TEXT,
  p_email TEXT,
  p_subject TEXT,
  p_body TEXT,
  p_template_data JSONB DEFAULT '{}',
  p_scheduled_for TIMESTAMPTZ DEFAULT now()
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO notification_queue (notification_type, recipient_email, subject, body, template_data, scheduled_for)
  VALUES (p_type, p_email, p_subject, p_body, p_template_data, p_scheduled_for)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;
