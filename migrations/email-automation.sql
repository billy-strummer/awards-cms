-- ============================================
-- EMAIL AUTOMATION - Database Setup
-- ============================================

-- Table: email_logs
-- Track all emails sent from the system
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES entries(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'sent', -- sent, failed, bounced
  email_provider_id VARCHAR(255), -- ID from email service (e.g., Resend)
  error_message TEXT,

  -- Metadata
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  bounced_at TIMESTAMP WITH TIME ZONE
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_email_logs_entry ON email_logs(entry_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);

-- Function: Send confirmation email when entry is submitted
-- This function calls the Supabase Edge Function to send the email
CREATE OR REPLACE FUNCTION send_entry_confirmation_email()
RETURNS TRIGGER AS $$
DECLARE
  function_url TEXT;
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Only send email when status changes to 'submitted'
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN

    -- Get Supabase URL from environment (you'll need to set this)
    -- For now, we'll use a placeholder
    supabase_url := current_setting('app.supabase_url', true);
    service_role_key := current_setting('app.service_role_key', true);

    IF supabase_url IS NOT NULL THEN
      function_url := supabase_url || '/functions/v1/send-entry-confirmation';

      -- Call the edge function asynchronously using pg_net (if available)
      -- Note: This requires the pg_net extension
      -- If pg_net is not available, you'll need to trigger this from your application code

      PERFORM net.http_post(
        url := function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
        ),
        body := jsonb_build_object(
          'entryId', NEW.id
        )
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Send email when entry is submitted
-- Note: This trigger assumes pg_net extension is enabled
-- If not available, remove this trigger and call the edge function from your app code
CREATE OR REPLACE TRIGGER trigger_send_entry_confirmation
  AFTER INSERT OR UPDATE ON entries
  FOR EACH ROW
  EXECUTE FUNCTION send_entry_confirmation_email();

-- Comments
COMMENT ON TABLE email_logs IS 'Log of all emails sent from the system';
COMMENT ON FUNCTION send_entry_confirmation_email() IS 'Automatically sends confirmation email when entry is submitted';

-- Note: The trigger above requires pg_net extension and proper configuration
-- If pg_net is not available, you can call the edge function directly from your application
-- after inserting/updating an entry
