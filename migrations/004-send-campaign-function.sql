-- ============================================
-- EMAIL CAMPAIGN SENDING - Database Setup
-- ============================================
-- This creates a pg_net-based campaign sender that can be called
-- via Supabase RPC from the email builder.
--
-- SETUP: After running this migration, store your Resend API key:
--   INSERT INTO cms_config (key, value) VALUES ('resend_api_key', 're_YOUR_KEY_HERE');
--   INSERT INTO cms_config (key, value) VALUES ('from_email', 'British Trade Awards <awards@britishtradeawards.com>');
--
-- The email builder calls: supabase.rpc('send_campaign_emails', { ... })

-- ============================================
-- 1. CONFIG TABLE (stores API keys securely)
-- ============================================
CREATE TABLE IF NOT EXISTS cms_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only service_role and authenticated can read config
ALTER TABLE cms_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read cms_config" ON cms_config;
CREATE POLICY "Allow authenticated read cms_config"
  ON cms_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow service_role all cms_config" ON cms_config;
CREATE POLICY "Allow service_role all cms_config"
  ON cms_config FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Grant access
GRANT SELECT ON cms_config TO authenticated;
GRANT ALL ON cms_config TO service_role;

-- ============================================
-- 2. SEND SINGLE EMAIL FUNCTION (via pg_net + Resend)
-- ============================================
CREATE OR REPLACE FUNCTION send_single_email(
  p_to TEXT,
  p_subject TEXT,
  p_html TEXT,
  p_from TEXT DEFAULT NULL,
  p_reply_to TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_api_key TEXT;
  v_from TEXT;
  v_body JSONB;
  v_request_id BIGINT;
BEGIN
  -- Get API key from config
  SELECT value INTO v_api_key FROM cms_config WHERE key = 'resend_api_key';
  IF v_api_key IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Resend API key not configured. Add it to cms_config table.');
  END IF;

  -- Get from address
  IF p_from IS NOT NULL THEN
    v_from := p_from;
  ELSE
    SELECT value INTO v_from FROM cms_config WHERE key = 'from_email';
    v_from := COALESCE(v_from, 'British Trade Awards <awards@britishtradeawards.com>');
  END IF;

  -- Build the request body
  v_body := jsonb_build_object(
    'from', v_from,
    'to', jsonb_build_array(p_to),
    'subject', p_subject,
    'html', p_html
  );

  -- Add reply_to if provided
  IF p_reply_to IS NOT NULL AND p_reply_to != '' THEN
    v_body := v_body || jsonb_build_object('reply_to', p_reply_to);
  END IF;

  -- Send via Resend API using pg_net
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

-- ============================================
-- 3. SEND TEST EMAIL FUNCTION
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
  INSERT INTO email_logs (recipient_email, subject, status, sent_at)
  VALUES (p_to, '[TEST] ' || p_subject, 'sent', NOW());

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. SEND CAMPAIGN TO LIST FUNCTION
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
  INSERT INTO email_logs (recipient_email, subject, status, sent_at)
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
-- 5. CHECK API KEY FUNCTION (for pre-send validation)
-- ============================================
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

-- ============================================
-- 6. GRANT EXECUTE TO AUTHENTICATED USERS
-- ============================================
-- Drop old function signatures first to avoid conflicts
DROP FUNCTION IF EXISTS send_single_email(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS send_test_email(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS send_campaign_emails(UUID, TEXT, TEXT, TEXT, TEXT);

GRANT EXECUTE ON FUNCTION send_single_email(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION send_test_email(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION send_campaign_emails(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION check_email_config() TO authenticated;

-- ============================================
-- 7. COMMENTS
-- ============================================
COMMENT ON TABLE cms_config IS 'Stores CMS configuration like API keys. Only readable by authenticated users.';
COMMENT ON FUNCTION send_single_email IS 'Send a single email via Resend API using pg_net. Supports reply_to.';
COMMENT ON FUNCTION send_test_email IS 'Send a test email (prefixed with [TEST]). Accepts from_name, from_email, reply_to.';
COMMENT ON FUNCTION send_campaign_emails IS 'Send an email campaign to active subscribers on a list. Supports A/B testing via limit/offset.';
COMMENT ON FUNCTION check_email_config IS 'Check if email sending is properly configured (API key, from address).';

-- ============================================
-- AFTER RUNNING THIS MIGRATION:
-- ============================================
-- Run these INSERT statements with your actual Resend API key:
--
--   INSERT INTO cms_config (key, value)
--   VALUES ('resend_api_key', 're_YOUR_RESEND_API_KEY_HERE')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
--
--   INSERT INTO cms_config (key, value)
--   VALUES ('from_email', 'British Trade Awards <awards@britishtradeawards.com>')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
