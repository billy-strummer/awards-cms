-- ============================================
-- Migration 008: Ensure email list tables have all required columns
-- ============================================
-- Problem: email_list_subscribers (and possibly email_lists) may have been
-- created by an earlier migration or manually, missing columns that
-- database-email-lists-setup.sql expects. Since CREATE TABLE IF NOT EXISTS
-- skips existing tables, the columns never get added.
--
-- This migration adds any missing columns using ADD COLUMN IF NOT EXISTS.

-- ============================================
-- 1. FIX email_lists - add missing columns
-- ============================================
ALTER TABLE email_lists ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE email_lists ADD COLUMN IF NOT EXISTS list_type VARCHAR(50) DEFAULT 'general';
ALTER TABLE email_lists ADD COLUMN IF NOT EXISTS award_id UUID;
ALTER TABLE email_lists ADD COLUMN IF NOT EXISTS event_id UUID;
ALTER TABLE email_lists ADD COLUMN IF NOT EXISTS allow_duplicates BOOLEAN DEFAULT false;
ALTER TABLE email_lists ADD COLUMN IF NOT EXISTS auto_clean BOOLEAN DEFAULT true;
ALTER TABLE email_lists ADD COLUMN IF NOT EXISTS subscriber_count INTEGER DEFAULT 0;
ALTER TABLE email_lists ADD COLUMN IF NOT EXISTS active_subscriber_count INTEGER DEFAULT 0;
ALTER TABLE email_lists ADD COLUMN IF NOT EXISTS tags TEXT;
ALTER TABLE email_lists ADD COLUMN IF NOT EXISTS icon VARCHAR(50);
ALTER TABLE email_lists ADD COLUMN IF NOT EXISTS color VARCHAR(7);
ALTER TABLE email_lists ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
ALTER TABLE email_lists ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- 2. FIX email_list_subscribers - add missing columns
-- ============================================
ALTER TABLE email_list_subscribers ADD COLUMN IF NOT EXISTS list_id UUID REFERENCES email_lists(id) ON DELETE CASCADE;
ALTER TABLE email_list_subscribers ADD COLUMN IF NOT EXISTS organisation_id UUID;
ALTER TABLE email_list_subscribers ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE email_list_subscribers ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE email_list_subscribers ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
ALTER TABLE email_list_subscribers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE email_list_subscribers ADD COLUMN IF NOT EXISTS subscription_date TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE email_list_subscribers ADD COLUMN IF NOT EXISTS unsubscribe_date TIMESTAMPTZ;
ALTER TABLE email_list_subscribers ADD COLUMN IF NOT EXISTS source VARCHAR(100);
ALTER TABLE email_list_subscribers ADD COLUMN IF NOT EXISTS import_batch_id UUID;
ALTER TABLE email_list_subscribers ADD COLUMN IF NOT EXISTS custom_fields JSONB;
ALTER TABLE email_list_subscribers ADD COLUMN IF NOT EXISTS emails_received INTEGER DEFAULT 0;
ALTER TABLE email_list_subscribers ADD COLUMN IF NOT EXISTS emails_opened INTEGER DEFAULT 0;
ALTER TABLE email_list_subscribers ADD COLUMN IF NOT EXISTS emails_clicked INTEGER DEFAULT 0;
ALTER TABLE email_list_subscribers ADD COLUMN IF NOT EXISTS last_email_sent TIMESTAMPTZ;
ALTER TABLE email_list_subscribers ADD COLUMN IF NOT EXISTS last_email_opened TIMESTAMPTZ;
ALTER TABLE email_list_subscribers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE email_list_subscribers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- 3. ENSURE email_import_batches exists
-- ============================================
CREATE TABLE IF NOT EXISTS email_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES email_lists(id) ON DELETE CASCADE,
  file_name VARCHAR(255),
  import_type VARCHAR(50) NOT NULL,
  total_rows INTEGER DEFAULT 0,
  successful_imports INTEGER DEFAULT 0,
  failed_imports INTEGER DEFAULT 0,
  duplicate_count INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'processing',
  error_log TEXT,
  imported_by VARCHAR(255),
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. ENSURE email_unsubscribes exists
-- ============================================
CREATE TABLE IF NOT EXISTS email_unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  reason VARCHAR(100),
  reason_details TEXT,
  subscriber_id UUID REFERENCES email_list_subscribers(id) ON DELETE SET NULL,
  list_id UUID REFERENCES email_lists(id) ON DELETE SET NULL,
  unsubscribed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address VARCHAR(45),
  user_agent TEXT,
  can_resubscribe BOOLEAN DEFAULT true,
  resubscribed_at TIMESTAMPTZ
);

-- ============================================
-- 5. ENSURE email_campaigns exists
-- ============================================
CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name VARCHAR(255) NOT NULL,
  template_id UUID,
  subject VARCHAR(500) NOT NULL,
  recipients TEXT NOT NULL DEFAULT '',
  scheduled_date TIMESTAMPTZ,
  sent_date TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'Draft',
  total_recipients INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. ENSURE email_campaign_recipients exists
-- ============================================
CREATE TABLE IF NOT EXISTS email_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  subscriber_id UUID REFERENCES email_list_subscribers(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  bounce_type VARCHAR(50),
  bounce_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. INDEXES (IF NOT EXISTS is safe to re-run)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_email_lists_type ON email_lists(list_type);
CREATE INDEX IF NOT EXISTS idx_email_lists_active ON email_lists(is_active);
CREATE INDEX IF NOT EXISTS idx_email_lists_award ON email_lists(award_id);

CREATE INDEX IF NOT EXISTS idx_subscribers_list ON email_list_subscribers(list_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON email_list_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON email_list_subscribers(status);

CREATE INDEX IF NOT EXISTS idx_import_batches_list ON email_import_batches(list_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_status ON email_import_batches(status);

CREATE INDEX IF NOT EXISTS idx_unsubscribes_email ON email_unsubscribes(email);
CREATE INDEX IF NOT EXISTS idx_unsubscribes_list ON email_unsubscribes(list_id);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON email_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_email ON email_campaign_recipients(email);

-- ============================================
-- 8. RLS POLICIES
-- ============================================
ALTER TABLE email_import_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to email_import_batches" ON email_import_batches;
CREATE POLICY "Allow all access to email_import_batches"
  ON email_import_batches FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE email_unsubscribes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to email_unsubscribes" ON email_unsubscribes;
CREATE POLICY "Allow all access to email_unsubscribes"
  ON email_unsubscribes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE email_campaign_recipients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to email_campaign_recipients" ON email_campaign_recipients;
CREATE POLICY "Allow all access to email_campaign_recipients"
  ON email_campaign_recipients FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 9. GRANT STATEMENTS
-- ============================================
GRANT ALL ON public.email_lists TO anon;
GRANT ALL ON public.email_lists TO authenticated;
GRANT ALL ON public.email_lists TO service_role;

GRANT ALL ON public.email_list_subscribers TO anon;
GRANT ALL ON public.email_list_subscribers TO authenticated;
GRANT ALL ON public.email_list_subscribers TO service_role;

GRANT ALL ON public.email_import_batches TO anon;
GRANT ALL ON public.email_import_batches TO authenticated;
GRANT ALL ON public.email_import_batches TO service_role;

GRANT ALL ON public.email_unsubscribes TO anon;
GRANT ALL ON public.email_unsubscribes TO authenticated;
GRANT ALL ON public.email_unsubscribes TO service_role;

GRANT ALL ON public.email_campaigns TO anon;
GRANT ALL ON public.email_campaigns TO authenticated;
GRANT ALL ON public.email_campaigns TO service_role;

GRANT ALL ON public.email_campaign_recipients TO anon;
GRANT ALL ON public.email_campaign_recipients TO authenticated;
GRANT ALL ON public.email_campaign_recipients TO service_role;

-- ============================================
-- 10. RECREATE VIEWS (use CREATE OR REPLACE)
-- ============================================
CREATE OR REPLACE VIEW email_lists_with_stats AS
SELECT
  el.*,
  (SELECT COUNT(*) FROM email_list_subscribers els WHERE els.list_id = el.id) AS total_subscribers,
  (SELECT COUNT(*) FROM email_list_subscribers els WHERE els.list_id = el.id AND els.status = 'active') AS active_subscribers
FROM email_lists el;

GRANT ALL ON public.email_lists_with_stats TO anon;
GRANT ALL ON public.email_lists_with_stats TO authenticated;
GRANT ALL ON public.email_lists_with_stats TO service_role;

-- ============================================
-- 11. TRIGGER FOR SUBSCRIBER COUNT UPDATES
-- ============================================
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

DROP TRIGGER IF EXISTS trigger_update_list_counts_insert ON email_list_subscribers;
CREATE TRIGGER trigger_update_list_counts_insert
  AFTER INSERT ON email_list_subscribers
  FOR EACH ROW EXECUTE FUNCTION update_email_list_counts();

DROP TRIGGER IF EXISTS trigger_update_list_counts_update ON email_list_subscribers;
CREATE TRIGGER trigger_update_list_counts_update
  AFTER UPDATE ON email_list_subscribers
  FOR EACH ROW EXECUTE FUNCTION update_email_list_counts();

DROP TRIGGER IF EXISTS trigger_update_list_counts_delete ON email_list_subscribers;
CREATE TRIGGER trigger_update_list_counts_delete
  AFTER DELETE ON email_list_subscribers
  FOR EACH ROW EXECUTE FUNCTION update_email_list_counts();

-- ============================================
-- 12. INSERT DEFAULT LISTS (skip if they exist)
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
-- 13. RELOAD SCHEMA CACHE
-- ============================================
NOTIFY pgrst, 'reload schema';
