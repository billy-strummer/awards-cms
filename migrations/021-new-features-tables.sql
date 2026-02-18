-- ============================================================
-- MIGRATION 021: New feature tables
-- Reporting, Sponsor Portal, Tickets, Notifications,
-- Entry Revisions, Winner Pipeline, Branding, Webhooks,
-- Documents, Seating Sections, Calendar, Rate Limiting,
-- Announcements
-- ============================================================

-- ============================================
-- 1. SCHEDULED REPORTS (enhanced)
-- ============================================
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

-- ============================================
-- 2. SPONSOR PORTAL
-- ============================================
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

-- Add tier benefits to sponsors
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS tier_level TEXT DEFAULT 'bronze';
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS click_url TEXT;

-- ============================================
-- 3. TICKET MANAGEMENT
-- ============================================
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

-- Add accessibility to event_guests
ALTER TABLE event_guests ADD COLUMN IF NOT EXISTS accessibility_requirements TEXT;
ALTER TABLE event_guests ADD COLUMN IF NOT EXISTS ticket_id UUID;

-- ============================================
-- 4. NOTIFICATIONS
-- ============================================
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

-- ============================================
-- 5. ENTRY REVISIONS
-- ============================================
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

-- Add revision-related status support
ALTER TABLE entries ADD COLUMN IF NOT EXISTS revision_count INTEGER DEFAULT 0;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS last_revision_at TIMESTAMPTZ;

-- ============================================
-- 6. WINNER PIPELINE
-- ============================================
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

-- ============================================
-- 7. WHITE-LABEL BRANDING
-- ============================================
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

-- ============================================
-- 8. WEBHOOKS
-- ============================================
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

-- ============================================
-- 9. DOCUMENT MANAGEMENT
-- ============================================
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

-- ============================================
-- 10. SEATING SECTIONS
-- ============================================
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

-- Add section_id and accessibility to event_tables
ALTER TABLE event_tables ADD COLUMN IF NOT EXISTS section_id UUID;
ALTER TABLE event_tables ADD COLUMN IF NOT EXISTS is_accessible BOOLEAN DEFAULT FALSE;

-- ============================================
-- 12. CALENDAR FEEDS
-- ============================================
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

-- ============================================
-- 14. RATE LIMITING
-- ============================================
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

-- ============================================
-- 15. ANNOUNCEMENTS
-- ============================================
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

-- Add embargo to winners
ALTER TABLE winners ADD COLUMN IF NOT EXISTS embargo_until TIMESTAMPTZ;
ALTER TABLE winners ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE;
ALTER TABLE winners ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- ============================================
-- RLS POLICIES (allow all for authenticated users)
-- ============================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
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
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all access to %I" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "Allow all access to %I" ON %I FOR ALL USING (true) WITH CHECK (true)', tbl, tbl);
    EXECUTE format('GRANT ALL ON public.%I TO anon', tbl);
    EXECUTE format('GRANT ALL ON public.%I TO authenticated', tbl);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl);
  END LOOP;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
