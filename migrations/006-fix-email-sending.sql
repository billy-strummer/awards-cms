-- ============================================
-- Migration 006: Fix email sending pipeline
-- ============================================
-- Fixes:
-- 1. Ensures email_campaigns table exists (was missing from numbered migrations)
-- 2. Recreates send_test_email / send_campaign_emails to use correct table name
--    (email_log not email_logs) and correct column (created_at not sent_at)

-- ============================================
-- 1. ENSURE email_campaigns TABLE EXISTS
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

ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to email_campaigns" ON email_campaigns;
CREATE POLICY "Allow all access to email_campaigns"
  ON email_campaigns FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON email_campaigns TO anon;
GRANT ALL ON email_campaigns TO authenticated;
GRANT ALL ON email_campaigns TO service_role;

-- ============================================
-- 2. FIX send_test_email FUNCTION
--    (was inserting into email_logs with sent_at column;
--     table is actually email_log with created_at column)
-- ============================================
CREATE OR REPLACE FUNCTION send_test_email(
  p_to TEXT,
  p_subject TEXT,
  p_html TEXT,
  p_from_name TEXT DEFAULT 'British Trade Awards',
  p_from_email TEXT DEFAULT NULL,
  p_reply_to TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_from TEXT;
  v_result JSONB;
BEGIN
  -- Build from address: "Name <email>"
  IF p_from_email IS NOT NULL AND p_from_email != '' THEN
    v_from := p_from_name || ' <' || p_from_email || '>';
  ELSE
    SELECT value INTO v_from FROM cms_config WHERE key = 'from_email';
    v_from := COALESCE(v_from, p_from_name || ' <awards@britishtradeawards.com>');
  END IF;

  v_result := send_single_email(p_to, '[TEST] ' || p_subject, p_html, v_from, p_reply_to);

  -- Log the test send
  INSERT INTO email_log (recipient_email, subject, status, created_at)
  VALUES (p_to, '[TEST] ' || p_subject, 'sent', NOW());

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. FIX send_campaign_emails FUNCTION
--    (same table/column fix)
-- ============================================
CREATE OR REPLACE FUNCTION send_campaign_emails(
  p_list_id UUID,
  p_subject TEXT,
  p_html TEXT,
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
  -- Build from address
  IF p_from_email IS NOT NULL AND p_from_email != '' THEN
    v_from := p_from_name || ' <' || p_from_email || '>';
  ELSE
    SELECT value INTO v_from FROM cms_config WHERE key = 'from_email';
    v_from := COALESCE(v_from, p_from_name || ' <awards@britishtradeawards.com>');
  END IF;

  -- Count total subscribers
  SELECT COUNT(*) INTO v_total
  FROM email_list_subscribers
  WHERE list_id = p_list_id AND status = 'active';

  IF v_total = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active subscribers on this list', 'sent', 0, 'total', 0);
  END IF;

  -- Loop through active subscribers and send (with optional limit/offset for A/B testing)
  FOR v_subscriber IN
    SELECT email, first_name, last_name, company_name
    FROM email_list_subscribers
    WHERE list_id = p_list_id AND status = 'active'
    ORDER BY created_at ASC
    OFFSET p_offset
    LIMIT p_limit
  LOOP
    -- Build contact name
    v_contact_name := TRIM(COALESCE(v_subscriber.first_name, '') || ' ' || COALESCE(v_subscriber.last_name, ''));
    IF v_contact_name = '' THEN
      v_contact_name := 'there';
    END IF;

    -- Personalise HTML
    v_personalised_html := p_html;
    v_personalised_html := REPLACE(v_personalised_html, '{{contact_name}}', v_contact_name);
    v_personalised_html := REPLACE(v_personalised_html, '{{first_name}}', COALESCE(v_subscriber.first_name, ''));
    v_personalised_html := REPLACE(v_personalised_html, '{{last_name}}', COALESCE(v_subscriber.last_name, ''));
    v_personalised_html := REPLACE(v_personalised_html, '{{company_name}}', COALESCE(v_subscriber.company_name, ''));
    v_personalised_html := REPLACE(v_personalised_html, '{{email}}', v_subscriber.email);

    -- Personalise subject
    v_personalised_subject := p_subject;
    v_personalised_subject := REPLACE(v_personalised_subject, '{{contact_name}}', v_contact_name);
    v_personalised_subject := REPLACE(v_personalised_subject, '{{first_name}}', COALESCE(v_subscriber.first_name, ''));
    v_personalised_subject := REPLACE(v_personalised_subject, '{{company_name}}', COALESCE(v_subscriber.company_name, ''));

    -- Send the email
    v_result := send_single_email(v_subscriber.email, v_personalised_subject, v_personalised_html, v_from, p_reply_to);

    -- Update subscriber stats
    UPDATE email_list_subscribers
    SET emails_received = COALESCE(emails_received, 0) + 1
    WHERE email = v_subscriber.email AND list_id = p_list_id;

    v_count := v_count + 1;
  END LOOP;

  -- Log the campaign
  INSERT INTO email_log (recipient_email, subject, status, created_at)
  VALUES (
    'campaign:' || p_list_id || ' (' || v_count || ' subscribers)',
    COALESCE(p_campaign_name, p_subject),
    'sent',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'sent', v_count,
    'total', v_total
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. RE-GRANT EXECUTE PERMISSIONS
-- ============================================
GRANT EXECUTE ON FUNCTION send_test_email(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION send_campaign_emails(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;

-- ============================================
-- 5. RELOAD SCHEMA CACHE
-- ============================================
NOTIFY pgrst, 'reload schema';
