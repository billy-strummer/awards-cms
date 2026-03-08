-- ============================================================
-- MIGRATION 046: Catch-up — Create All Missing Tables & Functions
-- ============================================================
-- Run this in Supabase SQL Editor to fill gaps found by
-- verify-migrations.sql (24 missing tables, 24 missing functions).
--
-- All statements use IF NOT EXISTS / CREATE OR REPLACE so it is
-- safe to run even if some objects already exist.
-- ============================================================


-- ============================================================
-- PART 1: MISSING TABLES
-- ============================================================

-- ---- 1. Organisation Enhancements ----

CREATE TABLE IF NOT EXISTS organisation_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_value TEXT,
  field_type TEXT DEFAULT 'text',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organisation_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organisation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  author TEXT,
  note_type TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organisation_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  related_organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organisation_comms_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  comm_type TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  sent_by TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_activity_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  author TEXT,
  activity_type TEXT DEFAULT 'note',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organisation_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- 2. CRM Tables ----

CREATE TABLE IF NOT EXISTS meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES organisation_contacts(id) ON DELETE SET NULL,
  meeting_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attendees TEXT,
  location TEXT,
  summary TEXT NOT NULL,
  action_items TEXT,
  follow_up_date DATE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB DEFAULT '{}',
  is_dynamic BOOLEAN DEFAULT TRUE,
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organisation_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES contact_segments(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organisation_id, segment_id)
);

CREATE TABLE IF NOT EXISTS sponsorship_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  tier TEXT DEFAULT 'bronze',
  price NUMERIC(10,2),
  benefits TEXT[],
  max_sponsors INTEGER,
  current_sponsors INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- 3. Event Tables (from migration 015) ----

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

-- ---- 4. Audit, GDPR, Notifications (from migration 015) ----

CREATE TABLE IF NOT EXISTS cms_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  description TEXT,
  user_email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cms_audit_logs_action ON cms_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_cms_audit_logs_entity ON cms_audit_logs(entity);
CREATE INDEX IF NOT EXISTS idx_cms_audit_logs_created ON cms_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cms_audit_logs_user ON cms_audit_logs(user_email);

CREATE TABLE IF NOT EXISTS gdpr_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  requester_email TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  processed_by TEXT,
  processed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_status ON gdpr_requests(status);

CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  template_id TEXT,
  template_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  last_error TEXT,
  scheduled_for TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled ON notification_queue(scheduled_for);

-- ---- 5. Running Order Versions ----

CREATE TABLE IF NOT EXISTS running_order_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  version_name TEXT,
  data JSONB NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- 6. Marketing / Sponsors ----

CREATE TABLE IF NOT EXISTS sponsor_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID REFERENCES sponsors(id) ON DELETE CASCADE,
  award_id UUID REFERENCES award_years(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  assignment_type TEXT DEFAULT 'award',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- 7. New Feature Tables (from migration 021) ----

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  frequency TEXT DEFAULT 'weekly',
  recipients TEXT[],
  sections TEXT[],
  filters JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  last_sent_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sponsor_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  page TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sponsor_impressions_sponsor ON sponsor_impressions(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_impressions_date ON sponsor_impressions(created_at);

CREATE TABLE IF NOT EXISTS sponsor_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  amount NUMERIC(10,2),
  currency TEXT DEFAULT 'GBP',
  status TEXT DEFAULT 'active',
  benefits TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 100,
  sold INTEGER DEFAULT 0,
  early_bird_price NUMERIC(10,2),
  early_bird_deadline TIMESTAMPTZ,
  includes_table BOOLEAN DEFAULT FALSE,
  table_size INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ticket_type_id UUID REFERENCES event_ticket_types(id) ON DELETE SET NULL,
  guest_id UUID REFERENCES event_guests(id) ON DELETE SET NULL,
  purchaser_email TEXT NOT NULL,
  purchaser_name TEXT,
  stripe_payment_id TEXT,
  qr_code TEXT,
  status TEXT DEFAULT 'active',
  price_paid NUMERIC(10,2),
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  refund_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_tickets_event ON event_tickets(event_id);

CREATE TABLE IF NOT EXISTS event_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  ticket_type_id UUID REFERENCES event_ticket_types(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'waiting',
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_email);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_email, is_read) WHERE is_read = FALSE;

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  type TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, type)
);

CREATE TABLE IF NOT EXISTS entry_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  requested_by TEXT,
  feedback TEXT NOT NULL,
  response TEXT,
  status TEXT DEFAULT 'pending',
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_entry_revisions_entry ON entry_revisions(entry_id);

CREATE TABLE IF NOT EXISTS shortlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  award_id UUID NOT NULL REFERENCES award_years(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  rank INTEGER,
  avg_score NUMERIC(5,2),
  median_score NUMERIC(5,2),
  min_score NUMERIC(5,2),
  max_score NUMERIC(5,2),
  judge_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'shortlisted',
  promoted_by TEXT,
  promoted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shortlists_award ON shortlists(award_id);

CREATE TABLE IF NOT EXISTS deliberation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  award_id UUID NOT NULL REFERENCES award_years(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES entries(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT DEFAULT '#0d6efd',
  secondary_color TEXT DEFAULT '#6c757d',
  accent_color TEXT DEFAULT '#ffc107',
  company_name TEXT,
  tagline TEXT,
  email_from TEXT,
  email_reply_to TEXT,
  custom_domain TEXT,
  font_family TEXT DEFAULT 'system-ui',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  attempt_number INTEGER DEFAULT 1,
  success BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook ON webhook_logs(webhook_id);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT DEFAULT 'other',
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  status TEXT DEFAULT 'draft',
  linked_entity_type TEXT,
  linked_entity_id UUID,
  expiry_date DATE,
  uploaded_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  current_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(linked_entity_type, linked_entity_id);
CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(expiry_date) WHERE expiry_date IS NOT NULL;

CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_document_versions_doc ON document_versions(document_id);

CREATE TABLE IF NOT EXISTS seating_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#e3f2fd',
  x INTEGER DEFAULT 0,
  y INTEGER DEFAULT 0,
  width INTEGER DEFAULT 400,
  height INTEGER DEFAULT 300,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_seating_sections_event ON seating_sections(event_id);

CREATE TABLE IF NOT EXISTS calendar_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  feed_token TEXT NOT NULL UNIQUE,
  include_events BOOLEAN DEFAULT TRUE,
  include_deadlines BOOLEAN DEFAULT TRUE,
  include_followups BOOLEAN DEFAULT TRUE,
  include_payments BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL,
  method TEXT DEFAULT 'GET',
  status_code INTEGER,
  response_time_ms INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint ON api_request_logs(endpoint, created_at);
CREATE INDEX IF NOT EXISTS idx_api_logs_ip ON api_request_logs(ip_address, created_at);

CREATE TABLE IF NOT EXISTS rate_limit_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL UNIQUE,
  max_requests INTEGER NOT NULL DEFAULT 60,
  window_seconds INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rate_limit_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT,
  ip_address TEXT,
  threshold INTEGER,
  actual_count INTEGER,
  window_minutes INTEGER,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ip_blocklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  reason TEXT,
  blocked_by TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  winner_id UUID REFERENCES winners(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  content TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_announcements_winner ON announcements(winner_id);

-- ---- 8. Remaining expected tables ----

CREATE TABLE IF NOT EXISTS winner_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  winner_id UUID REFERENCES winners(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS winner_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  winner_id UUID REFERENCES winners(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  media_url TEXT NOT NULL,
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- PART 2: MISSING FUNCTIONS
-- ============================================================

-- ---- General utility ----

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---- Entry system ----

CREATE OR REPLACE FUNCTION generate_entry_number()
RETURNS TRIGGER AS $$
DECLARE
  next_number INTEGER;
  year_val INTEGER;
BEGIN
  year_val := EXTRACT(YEAR FROM NOW());
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(entry_number FROM '(\d+)$') AS INTEGER)
  ), 0) + 1
  INTO next_number
  FROM entries
  WHERE entry_number LIKE 'BTA-' || year_val || '-%';
  NEW.entry_number := 'BTA-' || year_val || '-' || LPAD(next_number::TEXT, 4, '0');
  NEW.year := year_val;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_entry_scores()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE entries
  SET
    average_score = (
      SELECT AVG(total_score)
      FROM judge_scores
      WHERE entry_id = NEW.entry_id AND is_complete = true
    ),
    total_scores = (
      SELECT COUNT(*)
      FROM judge_scores
      WHERE entry_id = NEW.entry_id AND is_complete = true
    )
  WHERE id = NEW.entry_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_public_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE entries
  SET public_votes = (
    SELECT COUNT(*)
    FROM public_votes
    WHERE entry_id = NEW.entry_id AND email_verified = true
  )
  WHERE id = NEW.entry_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---- Voting system ----

CREATE OR REPLACE FUNCTION generate_voting_slug(
  company_name TEXT,
  award_name TEXT,
  award_year TEXT
) RETURNS TEXT AS $$
DECLARE
  slug TEXT;
BEGIN
  slug := LOWER(TRIM(company_name || ' ' || award_name || ' ' || award_year));
  slug := REGEXP_REPLACE(slug, '[^a-z0-9\s-]', '', 'g');
  slug := REGEXP_REPLACE(slug, '\s+', '-', 'g');
  slug := REGEXP_REPLACE(slug, '-+', '-', 'g');
  slug := TRIM(BOTH '-' FROM slug);
  RETURN slug;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE award_assignments
  SET public_vote_count = public_vote_count + 1
  WHERE id = NEW.assignment_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE award_assignments
  SET public_vote_count = GREATEST(public_vote_count - 1, 0)
  WHERE id = OLD.assignment_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ---- Awards & statistics ----

CREATE OR REPLACE FUNCTION get_award_assignment_count(award_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  result INTEGER;
BEGIN
  SELECT COUNT(*) INTO result
  FROM award_assignments
  WHERE award_id = award_uuid;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_award_winner_count(award_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  result INTEGER;
BEGIN
  SELECT COUNT(*) INTO result
  FROM winners
  WHERE award_id = award_uuid;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ---- Year rollover / previous winners ----

CREATE OR REPLACE FUNCTION get_nominee_history(org_id UUID)
RETURNS TABLE (
  total_nominations BIGINT,
  total_wins BIGINT,
  years_nominated TEXT[],
  years_won TEXT[],
  awards_won TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_nominations,
    COUNT(*) FILTER (WHERE aa.actual_winner = TRUE)::BIGINT as total_wins,
    ARRAY_AGG(DISTINCT a.year::TEXT ORDER BY a.year::TEXT DESC) as years_nominated,
    ARRAY_AGG(DISTINCT a.year::TEXT ORDER BY a.year::TEXT DESC) FILTER (WHERE aa.actual_winner = TRUE) as years_won,
    ARRAY_AGG(a.award_name ORDER BY a.year DESC) FILTER (WHERE aa.actual_winner = TRUE) as awards_won
  FROM award_assignments aa
  JOIN awards a ON aa.award_id = a.id
  WHERE aa.organisation_id = org_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION is_previous_winner(org_id UUID, current_year TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  has_won BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM award_assignments aa
    JOIN awards a ON aa.award_id = a.id
    WHERE aa.organisation_id = org_id
      AND aa.actual_winner = TRUE
      AND a.year::TEXT < current_year
  ) INTO has_won;
  RETURN has_won;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_flag_previous_winner()
RETURNS TRIGGER AS $$
DECLARE
  current_award_year TEXT;
  has_won_before BOOLEAN;
BEGIN
  IF NEW.is_previous_winner = TRUE THEN
    RETURN NEW;
  END IF;
  SELECT year::TEXT INTO current_award_year
  FROM awards
  WHERE id = NEW.award_id;
  SELECT is_previous_winner(NEW.organisation_id, current_award_year)
  INTO has_won_before;
  IF has_won_before THEN
    NEW.is_previous_winner = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION copy_nominees_to_new_year(
  from_year TEXT,
  to_year TEXT,
  copy_winners BOOLEAN DEFAULT TRUE,
  copy_all_nominees BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  awards_processed INTEGER,
  nominees_copied INTEGER,
  previous_winners_flagged INTEGER
) AS $$
DECLARE
  awards_count INTEGER := 0;
  nominees_count INTEGER := 0;
  prev_winners_count INTEGER := 0;
BEGIN
  WITH copied_assignments AS (
    INSERT INTO award_assignments (
      award_id, organisation_id, status, assigned_date,
      nomination_source, is_previous_winner, winner_position,
      voting_slug, public_vote_count
    )
    SELECT
      a_new.id as award_id,
      aa_old.organisation_id,
      'nominated' as status,
      NOW() as assigned_date,
      'year_rollover' as nomination_source,
      FALSE as is_previous_winner,
      NULL as winner_position,
      generate_voting_slug(o.company_name, a_new.award_name, to_year) as voting_slug,
      0 as public_vote_count
    FROM award_assignments aa_old
    JOIN awards a_old ON aa_old.award_id = a_old.id
    JOIN awards a_new ON LOWER(TRIM(a_old.award_name)) = LOWER(TRIM(a_new.award_name))
    JOIN organisations o ON aa_old.organisation_id = o.id
    WHERE a_old.year = from_year
      AND a_new.year = to_year
      AND (copy_all_nominees = TRUE OR (copy_winners = TRUE AND aa_old.actual_winner = TRUE))
      AND NOT EXISTS (
        SELECT 1 FROM award_assignments aa_check
        WHERE aa_check.award_id = a_new.id
          AND aa_check.organisation_id = aa_old.organisation_id
      )
    RETURNING *
  )
  SELECT
    COUNT(DISTINCT award_id)::INTEGER,
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE is_previous_winner = TRUE)::INTEGER
  INTO awards_count, nominees_count, prev_winners_count
  FROM copied_assignments;

  RETURN QUERY SELECT awards_count, nominees_count, prev_winners_count;
END;
$$ LANGUAGE plpgsql;

-- ---- Event management ----

CREATE OR REPLACE FUNCTION update_running_order_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_table_plan_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_event_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_next_award_number(
  p_event_id UUID,
  p_section INTEGER DEFAULT 1
)
RETURNS VARCHAR AS $$
DECLARE
  v_next_number INTEGER;
  v_award_number VARCHAR;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(award_number, '-', 2) AS INTEGER)), 0) + 1
  INTO v_next_number
  FROM running_order
  WHERE event_id = p_event_id
    AND section = p_section;
  v_award_number := p_section || '-' || LPAD(v_next_number::TEXT, 2, '0');
  RETURN v_award_number;
END;
$$ LANGUAGE plpgsql;

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

CREATE OR REPLACE FUNCTION get_available_seats(p_table_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_total_seats INTEGER;
  v_assigned_seats INTEGER;
BEGIN
  SELECT total_seats INTO v_total_seats
  FROM event_tables
  WHERE id = p_table_id;
  SELECT COUNT(*) INTO v_assigned_seats
  FROM table_assignments
  WHERE table_id = p_table_id;
  RETURN COALESCE(v_total_seats, 0) - COALESCE(v_assigned_seats, 0);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_unassigned_guests(p_event_id UUID)
RETURNS TABLE (
  guest_id UUID,
  guest_name TEXT,
  guest_email TEXT,
  organisation_id UUID,
  company_name TEXT,
  rsvp_status TEXT,
  plus_ones INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    eg.id::UUID,
    eg.guest_name::TEXT,
    eg.guest_email::TEXT,
    eg.organisation_id::UUID,
    o.company_name::TEXT,
    eg.rsvp_status::TEXT,
    eg.plus_ones::INTEGER
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

CREATE OR REPLACE FUNCTION populate_running_order_from_rsvps(p_event_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_guest RECORD;
  v_next_order INTEGER;
  v_award_number VARCHAR;
BEGIN
  SELECT COALESCE(MAX(display_order), 0) + 1
  INTO v_next_order
  FROM running_order
  WHERE event_id = p_event_id;

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
    v_award_number := get_next_award_number(p_event_id, 1);
    INSERT INTO running_order (
      event_id, organisation_id, award_id, guest_id,
      display_name, award_name, award_number,
      display_order, section, recipient_collecting
    ) VALUES (
      p_event_id, v_guest.organisation_id, v_guest.award_id,
      v_guest.guest_id, COALESCE(v_guest.company_name, 'Guest'),
      v_guest.award_name, v_award_number,
      v_next_order, 1, v_guest.guest_name
    );
    v_count := v_count + 1;
    v_next_order := v_next_order + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

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
  FOR v_index IN 1..array_length(p_order_array, 1)
  LOOP
    v_id := p_order_array[v_index];
    v_award_number := v_section || '-' || LPAD(v_number::TEXT, 2, '0');
    UPDATE running_order
    SET display_order = v_index,
        award_number = v_award_number,
        section = v_section
    WHERE id = v_id AND event_id = p_event_id;
    v_number := v_number + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ---- Invoice / Payment ----

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS VARCHAR AS $$
DECLARE
  next_num INTEGER;
  current_year VARCHAR(4);
BEGIN
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM '\d+$') AS INTEGER)
  ), 0) + 1 INTO next_num
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || current_year || '-%';
  RETURN 'INV-' || current_year || '-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_payment_reference()
RETURNS VARCHAR AS $$
DECLARE
  next_num INTEGER;
  current_year VARCHAR(4);
BEGIN
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(payment_reference FROM '\d+$') AS INTEGER)
  ), 0) + 1 INTO next_num
  FROM payments
  WHERE payment_reference LIKE 'PAY-' || current_year || '-%';
  RETURN 'PAY-' || current_year || '-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_invoice_balance()
RETURNS TRIGGER AS $$
BEGIN
  NEW.balance_due := NEW.total_amount - NEW.paid_amount;
  IF NEW.paid_amount = 0 THEN
    NEW.payment_status := 'unpaid';
  ELSIF NEW.paid_amount >= NEW.total_amount THEN
    NEW.payment_status := 'paid';
    IF NEW.paid_date IS NULL THEN
      NEW.paid_date := NOW();
    END IF;
  ELSE
    NEW.payment_status := 'partial';
  END IF;
  IF NEW.due_date < CURRENT_DATE AND NEW.payment_status != 'paid' THEN
    NEW.status := 'overdue';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_invoice_total_from_items()
RETURNS TRIGGER AS $$
DECLARE
  invoice_subtotal DECIMAL(10,2);
  invoice_record RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT * INTO invoice_record FROM invoices WHERE id = OLD.invoice_id;
  ELSE
    SELECT * INTO invoice_record FROM invoices WHERE id = NEW.invoice_id;
  END IF;
  SELECT COALESCE(SUM(line_total), 0.00) INTO invoice_subtotal
  FROM invoice_line_items
  WHERE invoice_id = invoice_record.id;
  UPDATE invoices
  SET
    subtotal = invoice_subtotal,
    tax_amount = invoice_subtotal * (tax_rate / 100),
    total_amount = invoice_subtotal + (invoice_subtotal * (tax_rate / 100)) - discount_amount,
    updated_at = NOW()
  WHERE id = invoice_record.id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ---- Email ----

CREATE OR REPLACE FUNCTION update_email_list_counts()
RETURNS TRIGGER AS $$
DECLARE
  list_uuid UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    list_uuid := OLD.list_id;
  ELSE
    list_uuid := NEW.list_id;
  END IF;
  UPDATE email_lists
  SET
    subscriber_count = (
      SELECT COUNT(*) FROM email_list_subscribers WHERE list_id = list_uuid
    ),
    active_subscriber_count = (
      SELECT COUNT(*) FROM email_list_subscribers WHERE list_id = list_uuid AND status = 'active'
    ),
    updated_at = NOW()
  WHERE id = list_uuid;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_email_unsubscribe()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM email_unsubscribes
    WHERE email = NEW.email AND can_resubscribe = false
  ) THEN
    RAISE EXCEPTION 'Email address % has permanently unsubscribed', NEW.email;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---- Email sending (requires pg_net extension) ----

-- Config table for API keys
CREATE TABLE IF NOT EXISTS cms_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION check_email_config()
RETURNS JSONB AS $$
DECLARE
  v_api_key TEXT;
  v_from TEXT;
BEGIN
  SELECT value INTO v_api_key FROM cms_config WHERE key = 'resend_api_key';
  SELECT value INTO v_from FROM cms_config WHERE key = 'from_email';
  RETURN jsonb_build_object(
    'has_api_key', v_api_key IS NOT NULL AND v_api_key != '',
    'has_from_email', v_from IS NOT NULL AND v_from != '',
    'from_email', COALESCE(v_from, 'Not configured')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION send_single_email(
  p_to TEXT, p_subject TEXT, p_html TEXT,
  p_from TEXT DEFAULT NULL, p_reply_to TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_api_key TEXT;
  v_from TEXT;
  v_body JSONB;
  v_request_id BIGINT;
BEGIN
  SELECT value INTO v_api_key FROM cms_config WHERE key = 'resend_api_key';
  IF v_api_key IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Resend API key not configured.');
  END IF;
  IF p_from IS NOT NULL THEN
    v_from := p_from;
  ELSE
    SELECT value INTO v_from FROM cms_config WHERE key = 'from_email';
    v_from := COALESCE(v_from, 'British Trade Awards <awards@britishtradeawards.com>');
  END IF;
  v_body := jsonb_build_object(
    'from', v_from,
    'to', jsonb_build_array(p_to),
    'subject', p_subject,
    'html', p_html
  );
  IF p_reply_to IS NOT NULL AND p_reply_to != '' THEN
    v_body := v_body || jsonb_build_object('reply_to', p_reply_to);
  END IF;
  SELECT net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_api_key
    ),
    body := v_body
  ) INTO v_request_id;
  RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION send_test_email(
  p_to TEXT, p_subject TEXT, p_html TEXT,
  p_from_name TEXT DEFAULT 'British Trade Awards',
  p_from_email TEXT DEFAULT NULL,
  p_reply_to TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_from TEXT;
  v_result JSONB;
BEGIN
  IF p_from_email IS NOT NULL AND p_from_email != '' THEN
    v_from := p_from_name || ' <' || p_from_email || '>';
  ELSE
    SELECT value INTO v_from FROM cms_config WHERE key = 'from_email';
    v_from := COALESCE(v_from, p_from_name || ' <awards@britishtradeawards.com>');
  END IF;
  v_result := send_single_email(p_to, '[TEST] ' || p_subject, p_html, v_from, p_reply_to);
  INSERT INTO email_log (recipient_email, subject, status, created_at)
  VALUES (p_to, '[TEST] ' || p_subject, 'sent', NOW());
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION send_campaign_emails(
  p_list_id UUID, p_subject TEXT, p_html TEXT,
  p_from_name TEXT DEFAULT 'British Trade Awards',
  p_from_email TEXT DEFAULT NULL,
  p_reply_to TEXT DEFAULT NULL,
  p_campaign_name TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT NULL,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
  v_subscriber RECORD;
  v_count INTEGER := 0;
  v_total INTEGER := 0;
  v_from TEXT;
  v_personalised_html TEXT;
  v_personalised_subject TEXT;
  v_contact_name TEXT;
  v_result JSONB;
BEGIN
  IF p_from_email IS NOT NULL AND p_from_email != '' THEN
    v_from := p_from_name || ' <' || p_from_email || '>';
  ELSE
    SELECT value INTO v_from FROM cms_config WHERE key = 'from_email';
    v_from := COALESCE(v_from, p_from_name || ' <awards@britishtradeawards.com>');
  END IF;
  SELECT COUNT(*) INTO v_total
  FROM email_list_subscribers
  WHERE list_id = p_list_id AND status = 'active';
  IF v_total = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active subscribers', 'sent', 0, 'total', 0);
  END IF;
  FOR v_subscriber IN
    SELECT email, first_name, last_name, company_name
    FROM email_list_subscribers
    WHERE list_id = p_list_id AND status = 'active'
    ORDER BY created_at ASC
    OFFSET p_offset LIMIT p_limit
  LOOP
    v_contact_name := TRIM(COALESCE(v_subscriber.first_name, '') || ' ' || COALESCE(v_subscriber.last_name, ''));
    IF v_contact_name = '' THEN v_contact_name := 'there'; END IF;
    v_personalised_html := p_html;
    v_personalised_html := REPLACE(v_personalised_html, '{{contact_name}}', v_contact_name);
    v_personalised_html := REPLACE(v_personalised_html, '{{first_name}}', COALESCE(v_subscriber.first_name, ''));
    v_personalised_html := REPLACE(v_personalised_html, '{{last_name}}', COALESCE(v_subscriber.last_name, ''));
    v_personalised_html := REPLACE(v_personalised_html, '{{company_name}}', COALESCE(v_subscriber.company_name, ''));
    v_personalised_html := REPLACE(v_personalised_html, '{{email}}', v_subscriber.email);
    v_personalised_subject := p_subject;
    v_personalised_subject := REPLACE(v_personalised_subject, '{{contact_name}}', v_contact_name);
    v_personalised_subject := REPLACE(v_personalised_subject, '{{first_name}}', COALESCE(v_subscriber.first_name, ''));
    v_personalised_subject := REPLACE(v_personalised_subject, '{{company_name}}', COALESCE(v_subscriber.company_name, ''));
    v_result := send_single_email(v_subscriber.email, v_personalised_subject, v_personalised_html, v_from, p_reply_to);
    UPDATE email_list_subscribers
    SET emails_received = COALESCE(emails_received, 0) + 1
    WHERE email = v_subscriber.email AND list_id = p_list_id;
    v_count := v_count + 1;
  END LOOP;
  INSERT INTO email_log (recipient_email, subject, status, created_at)
  VALUES ('campaign:' || p_list_id || ' (' || v_count || ' subscribers)', COALESCE(p_campaign_name, p_subject), 'sent', NOW());
  RETURN jsonb_build_object('success', true, 'sent', v_count, 'total', v_total);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---- Scheduled campaigns ----

CREATE OR REPLACE FUNCTION process_scheduled_campaigns()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  campaign RECORD;
  result jsonb := '[]'::jsonb;
  send_result jsonb;
  campaign_notes jsonb;
BEGIN
  FOR campaign IN
    SELECT * FROM email_campaigns
    WHERE status = 'Scheduled' AND scheduled_date <= NOW()
    ORDER BY scheduled_date ASC
  LOOP
    BEGIN
      campaign_notes := campaign.notes::jsonb;
      UPDATE email_campaigns SET status = 'Sending', updated_at = NOW() WHERE id = campaign.id;
      SELECT send_campaign_emails(
        p_list_id := (campaign_notes->>'list_id')::uuid,
        p_subject := campaign.subject,
        p_html := campaign_notes->>'html',
        p_from_name := COALESCE(campaign_notes->>'from_name', 'British Trade Awards'),
        p_from_email := campaign_notes->>'from_email',
        p_reply_to := campaign_notes->>'reply_to',
        p_campaign_name := campaign.campaign_name
      ) INTO send_result;
      IF (send_result->>'success')::boolean THEN
        UPDATE email_campaigns
        SET status = 'Sent', sent_date = NOW(),
            total_recipients = COALESCE((send_result->>'sent')::integer, 0),
            updated_at = NOW()
        WHERE id = campaign.id;
      ELSE
        UPDATE email_campaigns
        SET status = 'Failed',
            notes = jsonb_set(COALESCE(campaign.notes::jsonb, '{}'::jsonb), '{error}', to_jsonb(COALESCE(send_result->>'error', 'Unknown error')))::text,
            updated_at = NOW()
        WHERE id = campaign.id;
      END IF;
      result := result || jsonb_build_object(
        'campaign_id', campaign.id, 'campaign_name', campaign.campaign_name,
        'status', CASE WHEN (send_result->>'success')::boolean THEN 'sent' ELSE 'failed' END
      );
    EXCEPTION WHEN OTHERS THEN
      UPDATE email_campaigns
      SET status = 'Failed',
          notes = jsonb_set(COALESCE(campaign.notes::jsonb, '{}'::jsonb), '{error}', to_jsonb(SQLERRM))::text,
          updated_at = NOW()
      WHERE id = campaign.id;
      result := result || jsonb_build_object(
        'campaign_id', campaign.id, 'campaign_name', campaign.campaign_name,
        'status', 'failed', 'error', SQLERRM
      );
    END;
  END LOOP;
  RETURN jsonb_build_object('processed', jsonb_array_length(result), 'campaigns', result);
END;
$$;

-- ---- Entry confirmation email ----

CREATE OR REPLACE FUNCTION send_entry_confirmation_email(p_entry_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_entry RECORD;
  v_subject TEXT;
  v_html TEXT;
  v_award_name TEXT;
  v_sector TEXT;
  v_region TEXT;
  v_result JSONB;
  v_company_name TEXT := '';
BEGIN
  SELECT * INTO v_entry FROM entries WHERE id = p_entry_id;
  IF v_entry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entry not found');
  END IF;
  IF v_entry.created_at < NOW() - INTERVAL '24 hours' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Confirmation can only be sent for recent entries');
  END IF;
  IF v_entry.contact_email IS NULL OR v_entry.contact_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No contact email on entry');
  END IF;
  v_award_name := COALESCE(v_entry.award_category, '');
  v_sector := COALESCE(v_entry.sector, '');
  v_region := COALESCE(v_entry.region, '');
  IF v_entry.organisation_id IS NOT NULL THEN
    SELECT company_name INTO v_company_name FROM organisations WHERE id = v_entry.organisation_id;
  END IF;
  IF (v_award_name = '' OR v_sector = '' OR v_region = '') AND v_entry.award_id IS NOT NULL THEN
    SELECT
      COALESCE(NULLIF(v_award_name, ''), award_name),
      COALESCE(NULLIF(v_sector, ''), sector),
      COALESCE(NULLIF(v_region, ''), county)
    INTO v_award_name, v_sector, v_region
    FROM award_years WHERE id = v_entry.award_id;
  END IF;
  IF v_award_name = '' THEN
    IF v_entry.entry_title LIKE '%-%' THEN
      v_award_name := TRIM(SUBSTRING(v_entry.entry_title FROM POSITION(' - ' IN v_entry.entry_title) + 3));
    ELSE
      v_award_name := COALESCE(v_entry.entry_title, '');
    END IF;
  END IF;
  v_subject := 'Entry Received - ' || COALESCE(v_entry.entry_number, '') || ' | British Trade Awards';
  v_html := '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>'
    || '<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;">'
    || '<div style="max-width:600px;margin:0 auto;background:#ffffff;">'
    || '<div style="background:linear-gradient(135deg,#1a237e 0%,#0d47a1 100%);padding:32px;text-align:center;">'
    || '<h1 style="color:#cc9900;margin:0;font-size:24px;">British Trade Awards</h1>'
    || '<p style="color:#ffffff;margin:8px 0 0;font-size:14px;">Celebrating Excellence in British Trade</p></div>'
    || '<div style="padding:32px;color:#333;line-height:1.6;font-size:15px;">'
    || '<h2 style="color:#1a237e;margin-top:0;">Entry Confirmation</h2>'
    || '<p>Dear ' || COALESCE(v_entry.contact_name, 'Applicant') || ',</p>'
    || '<p>Thank you for entering the British Trade Awards. Your entry has been received.</p>'
    || '<div style="background:#f8f9fa;border-left:4px solid #cc9900;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0;">'
    || '<h3 style="margin:0 0 12px;color:#1a237e;font-size:16px;">Your Entry Details</h3>'
    || '<table style="width:100%;font-size:14px;border-collapse:collapse;">'
    || '<tr><td style="padding:4px 8px;color:#6c757d;width:120px;">Reference:</td><td style="padding:4px 8px;font-weight:600;">' || COALESCE(v_entry.entry_number, 'N/A') || '</td></tr>'
    || '<tr><td style="padding:4px 8px;color:#6c757d;">Company:</td><td style="padding:4px 8px;">' || COALESCE(v_company_name, '') || '</td></tr>'
    || '<tr><td style="padding:4px 8px;color:#6c757d;">Category:</td><td style="padding:4px 8px;">' || v_award_name || '</td></tr>';
  IF v_sector != '' THEN
    v_html := v_html || '<tr><td style="padding:4px 8px;color:#6c757d;">Sector:</td><td style="padding:4px 8px;">' || v_sector || '</td></tr>';
  END IF;
  IF v_region != '' THEN
    v_html := v_html || '<tr><td style="padding:4px 8px;color:#6c757d;">Region:</td><td style="padding:4px 8px;">' || v_region || '</td></tr>';
  END IF;
  v_html := v_html
    || '</table></div>'
    || '<p>Please keep your reference number <strong>' || COALESCE(v_entry.entry_number, '') || '</strong> safe.</p>'
    || '<p>Contact us at <a href="mailto:awards@britishtradeawards.com">awards@britishtradeawards.com</a></p>'
    || '<p>Kind regards,<br><strong>The British Trade Awards Team</strong></p></div>'
    || '<div style="background:#f8f9fa;padding:24px 32px;text-align:center;font-size:12px;color:#6c757d;">'
    || '<p>British Trade Awards | <a href="https://britishtrade.com" style="color:#0d6efd;">britishtrade.com</a></p>'
    || '</div></div></body></html>';
  v_result := send_single_email(v_entry.contact_email, v_subject, v_html);
  BEGIN
    INSERT INTO email_log (recipient_email, subject, status, created_at)
    VALUES (v_entry.contact_email, v_subject, 'sent', NOW());
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---- AI Vetting ----

CREATE OR REPLACE FUNCTION update_ai_vetting_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---- Audit / GDPR / Notifications ----

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


-- ============================================================
-- PART 3: RLS POLICIES & GRANTS
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    -- Organisation tables
    'organisation_custom_fields', 'organisation_documents',
    'organisation_notes', 'organisation_relationships',
    'organisation_comms_log', 'org_audit_log', 'org_activity_notes',
    'organisation_images',
    -- CRM
    'meeting_notes', 'contact_segments', 'organisation_segments',
    'sponsorship_opportunities',
    -- Events
    'event_budgets', 'event_budget_items', 'event_vendors',
    'event_milestones', 'event_special_requirements', 'event_post_data',
    'event_room_fixtures',
    -- Audit / GDPR / Notifications
    'cms_audit_logs', 'gdpr_requests', 'notification_queue',
    -- Other
    'running_order_versions', 'sponsor_assignments',
    'winner_documents', 'winner_media',
    -- New features (021)
    'scheduled_reports', 'sponsor_impressions', 'sponsor_contracts',
    'event_ticket_types', 'event_tickets', 'event_waitlist',
    'notifications', 'notification_preferences',
    'entry_revisions', 'shortlists', 'deliberation_notes',
    'tenant_branding', 'webhooks', 'webhook_logs',
    'documents', 'document_versions', 'seating_sections',
    'calendar_feeds', 'api_request_logs', 'rate_limit_config',
    'rate_limit_alerts', 'ip_blocklist', 'announcements'
  ])
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Allow all access to %I" ON %I', tbl, tbl);
      EXECUTE format('CREATE POLICY "Allow all access to %I" ON %I FOR ALL USING (true) WITH CHECK (true)', tbl, tbl);
      EXECUTE format('GRANT ALL ON public.%I TO anon', tbl);
      EXECUTE format('GRANT ALL ON public.%I TO authenticated', tbl);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping RLS for %: %', tbl, SQLERRM;
    END;
  END LOOP;
END $$;

-- Grant execute on key functions
GRANT EXECUTE ON FUNCTION check_email_config() TO authenticated;
GRANT EXECUTE ON FUNCTION send_single_email(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION send_test_email(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION send_campaign_emails(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION process_scheduled_campaigns() TO authenticated;
GRANT EXECUTE ON FUNCTION process_scheduled_campaigns() TO service_role;
GRANT EXECUTE ON FUNCTION send_entry_confirmation_email(UUID) TO anon;
GRANT EXECUTE ON FUNCTION send_entry_confirmation_email(UUID) TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- DONE! Re-run verify-migrations.sql to confirm 108/108 tables
-- and 38/38 functions.
-- ============================================================
