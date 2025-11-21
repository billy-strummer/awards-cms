-- ============================================
-- EMAIL LIST MANAGEMENT SYSTEM
-- For Awards CMS - Email Marketing
-- ============================================

-- ============================================
-- EMAIL LISTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS email_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- List Details
  list_name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Categorization
  list_type VARCHAR(50) DEFAULT 'general', -- 'general', 'winners', 'nominees', 'sponsors', 'vip', 'event', 'custom'

  -- Related Records
  award_id UUID REFERENCES awards(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,

  -- List Settings
  is_active BOOLEAN DEFAULT true,
  allow_duplicates BOOLEAN DEFAULT false,
  auto_clean BOOLEAN DEFAULT true, -- Auto-remove bounced/unsubscribed

  -- Statistics
  subscriber_count INTEGER DEFAULT 0,
  active_subscriber_count INTEGER DEFAULT 0,

  -- Tags and Metadata
  tags TEXT, -- JSON array of tags
  color VARCHAR(7), -- Hex color code for UI
  icon VARCHAR(50), -- Bootstrap icon class

  -- Owner
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EMAIL LIST SUBSCRIBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS email_list_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relationships
  list_id UUID NOT NULL REFERENCES email_lists(id) ON DELETE CASCADE,
  organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL, -- Optional link to company

  -- Subscriber Details
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  company_name VARCHAR(255),

  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'unsubscribed', 'bounced', 'complained', 'pending'
  subscription_date TIMESTAMPTZ DEFAULT NOW(),
  unsubscribe_date TIMESTAMPTZ,

  -- Source Tracking
  source VARCHAR(100), -- 'manual', 'import', 'form', 'api', 'crm_sync'
  import_batch_id UUID, -- Track which import batch this came from

  -- Custom Fields (JSON for flexibility)
  custom_fields JSONB,

  -- Engagement Tracking
  emails_received INTEGER DEFAULT 0,
  emails_opened INTEGER DEFAULT 0,
  emails_clicked INTEGER DEFAULT 0,
  last_email_sent TIMESTAMPTZ,
  last_email_opened TIMESTAMPTZ,

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one email per list
  UNIQUE(list_id, email)
);

-- ============================================
-- EMAIL IMPORT BATCHES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS email_import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Import Details
  list_id UUID NOT NULL REFERENCES email_lists(id) ON DELETE CASCADE,
  file_name VARCHAR(255),
  import_type VARCHAR(50) NOT NULL, -- 'csv', 'manual', 'excel', 'crm_sync'

  -- Statistics
  total_rows INTEGER DEFAULT 0,
  successful_imports INTEGER DEFAULT 0,
  failed_imports INTEGER DEFAULT 0,
  duplicate_count INTEGER DEFAULT 0,

  -- Status
  status VARCHAR(50) DEFAULT 'processing', -- 'processing', 'completed', 'failed', 'partial'
  error_log TEXT, -- JSON array of errors

  -- Metadata
  imported_by VARCHAR(255),
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EMAIL UNSUBSCRIBES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS email_unsubscribes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  email VARCHAR(255) NOT NULL,
  reason VARCHAR(100), -- 'too_frequent', 'not_relevant', 'never_subscribed', 'other'
  reason_details TEXT,

  -- Optional: Link to subscriber record
  subscriber_id UUID REFERENCES email_list_subscribers(id) ON DELETE SET NULL,
  list_id UUID REFERENCES email_lists(id) ON DELETE SET NULL,

  -- Tracking
  unsubscribed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address VARCHAR(45),
  user_agent TEXT,

  -- Resubscribe Option
  can_resubscribe BOOLEAN DEFAULT true,
  resubscribed_at TIMESTAMPTZ
);

-- ============================================
-- EMAIL CAMPAIGN RECIPIENTS TABLE (Enhanced)
-- ============================================
-- Track individual recipient status for each campaign
CREATE TABLE IF NOT EXISTS email_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  subscriber_id UUID REFERENCES email_list_subscribers(id) ON DELETE SET NULL,

  email VARCHAR(255) NOT NULL,

  -- Delivery Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed'
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,

  -- Engagement
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,

  -- Bounce Details
  bounce_type VARCHAR(50), -- 'hard', 'soft', 'complaint'
  bounce_reason TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_email_lists_type ON email_lists(list_type);
CREATE INDEX IF NOT EXISTS idx_email_lists_active ON email_lists(is_active);
CREATE INDEX IF NOT EXISTS idx_email_lists_award ON email_lists(award_id);
CREATE INDEX IF NOT EXISTS idx_email_lists_event ON email_lists(event_id);

CREATE INDEX IF NOT EXISTS idx_subscribers_list ON email_list_subscribers(list_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON email_list_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON email_list_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_subscribers_organisation ON email_list_subscribers(organisation_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_import_batch ON email_list_subscribers(import_batch_id);

CREATE INDEX IF NOT EXISTS idx_import_batches_list ON email_import_batches(list_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_status ON email_import_batches(status);

CREATE INDEX IF NOT EXISTS idx_unsubscribes_email ON email_unsubscribes(email);
CREATE INDEX IF NOT EXISTS idx_unsubscribes_list ON email_unsubscribes(list_id);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON email_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_subscriber ON email_campaign_recipients(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON email_campaign_recipients(status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_email ON email_campaign_recipients(email);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update subscriber count when subscribers change
CREATE OR REPLACE FUNCTION update_email_list_counts()
RETURNS TRIGGER AS $$
DECLARE
  list_uuid UUID;
BEGIN
  -- Get the list_id (works for INSERT, UPDATE, DELETE)
  IF TG_OP = 'DELETE' THEN
    list_uuid := OLD.list_id;
  ELSE
    list_uuid := NEW.list_id;
  END IF;

  -- Update the list counts
  UPDATE email_lists
  SET
    subscriber_count = (
      SELECT COUNT(*)
      FROM email_list_subscribers
      WHERE list_id = list_uuid
    ),
    active_subscriber_count = (
      SELECT COUNT(*)
      FROM email_list_subscribers
      WHERE list_id = list_uuid AND status = 'active'
    ),
    updated_at = NOW()
  WHERE id = list_uuid;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to prevent duplicate emails across lists (optional)
CREATE OR REPLACE FUNCTION check_email_unsubscribe()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if email is in unsubscribe list
  IF EXISTS (
    SELECT 1 FROM email_unsubscribes
    WHERE email = NEW.email
    AND can_resubscribe = false
  ) THEN
    RAISE EXCEPTION 'Email address % has permanently unsubscribed', NEW.email;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger to update list counts after subscriber changes
DROP TRIGGER IF EXISTS trigger_update_list_counts_insert ON email_list_subscribers;
CREATE TRIGGER trigger_update_list_counts_insert
  AFTER INSERT ON email_list_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION update_email_list_counts();

DROP TRIGGER IF EXISTS trigger_update_list_counts_update ON email_list_subscribers;
CREATE TRIGGER trigger_update_list_counts_update
  AFTER UPDATE ON email_list_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION update_email_list_counts();

DROP TRIGGER IF EXISTS trigger_update_list_counts_delete ON email_list_subscribers;
CREATE TRIGGER trigger_update_list_counts_delete
  AFTER DELETE ON email_list_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION update_email_list_counts();

-- Trigger for updated_at timestamps
DROP TRIGGER IF EXISTS update_email_lists_updated_at ON email_lists;
CREATE TRIGGER update_email_lists_updated_at
  BEFORE UPDATE ON email_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_list_subscribers_updated_at ON email_list_subscribers;
CREATE TRIGGER update_email_list_subscribers_updated_at
  BEFORE UPDATE ON email_list_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Optional: Prevent subscribing if permanently unsubscribed
-- Uncomment if you want this strict checking
-- DROP TRIGGER IF EXISTS trigger_check_unsubscribe ON email_list_subscribers;
-- CREATE TRIGGER trigger_check_unsubscribe
--   BEFORE INSERT ON email_list_subscribers
--   FOR EACH ROW
--   EXECUTE FUNCTION check_email_unsubscribe();

-- ============================================
-- VIEWS FOR REPORTING
-- ============================================

-- View: Email lists with statistics
CREATE OR REPLACE VIEW email_lists_with_stats AS
SELECT
  el.*,
  COUNT(DISTINCT els.id) as total_subscribers,
  COUNT(DISTINCT CASE WHEN els.status = 'active' THEN els.id END) as active_subscribers,
  COUNT(DISTINCT CASE WHEN els.status = 'unsubscribed' THEN els.id END) as unsubscribed_count,
  COUNT(DISTINCT CASE WHEN els.status = 'bounced' THEN els.id END) as bounced_count,
  AVG(els.emails_opened::float / NULLIF(els.emails_received, 0)) as avg_open_rate,
  MAX(els.subscription_date) as last_subscriber_added
FROM email_lists el
LEFT JOIN email_list_subscribers els ON el.id = els.list_id
GROUP BY el.id;

-- View: Subscriber engagement summary
CREATE OR REPLACE VIEW subscriber_engagement_summary AS
SELECT
  els.*,
  el.list_name,
  CASE
    WHEN els.emails_received = 0 THEN 0
    ELSE ROUND((els.emails_opened::float / els.emails_received) * 100, 2)
  END as open_rate,
  CASE
    WHEN els.emails_received = 0 THEN 0
    ELSE ROUND((els.emails_clicked::float / els.emails_received) * 100, 2)
  END as click_rate,
  EXTRACT(DAYS FROM (NOW() - els.last_email_sent)) as days_since_last_email
FROM email_list_subscribers els
LEFT JOIN email_lists el ON els.list_id = el.id
WHERE els.status = 'active';

-- ============================================
-- INSERT DEFAULT EMAIL LISTS
-- ============================================
INSERT INTO email_lists (list_name, description, list_type, color, icon) VALUES
  ('All Winners', 'All award winners across all years', 'winners', '#28a745', 'trophy-fill'),
  ('All Nominees', 'All award nominees and applicants', 'nominees', '#ffc107', 'star'),
  ('Event Attendees', 'Companies attending award ceremonies', 'event', '#0d6efd', 'calendar-event'),
  ('Sponsors & Partners', 'Sponsorship and partnership contacts', 'sponsors', '#6f42c1', 'award'),
  ('VIP List', 'High-priority contacts and VIP clients', 'vip', '#dc3545', 'star-fill'),
  ('General Newsletter', 'General marketing and news updates', 'general', '#6c757d', 'envelope')
ON CONFLICT DO NOTHING;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT
  'Email List Management System Installed Successfully!' as message,
  'Tables: email_lists, email_list_subscribers, email_import_batches, email_unsubscribes, email_campaign_recipients' as tables_created,
  'Default lists: All Winners, All Nominees, Event Attendees, Sponsors & Partners, VIP List, General Newsletter' as lists_created,
  'Views: email_lists_with_stats, subscriber_engagement_summary' as views_created,
  'Functions: update_email_list_counts(), check_email_unsubscribe()' as functions_created;
