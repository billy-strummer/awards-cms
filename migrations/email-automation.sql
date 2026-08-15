-- ============================================
-- EMAIL AUTOMATION - Database Setup
-- ============================================

-- Table: email_logs
-- Track all emails sent from the system
-- Note: database-schema.sql already creates email_logs for campaign-based logging;
-- this backfills the entry-confirmation-specific columns onto that same table.
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
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS entry_id UUID REFERENCES entries(id) ON DELETE CASCADE;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS email_provider_id VARCHAR(255);
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMP WITH TIME ZONE;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_email_logs_entry ON email_logs(entry_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);

-- Note: the original trigger-based "send_entry_confirmation_email()" (Edge
-- Function caller, zero-arg) that used to live here has been superseded by
-- migrations/028-entry-confirmation-email-rpc.sql's RPC function of the same
-- name but a different signature (send_entry_confirmation_email(p_entry_id
-- UUID)) — the public entry form calls that one directly via supabase.rpc(),
-- so the trigger/edge-function plumbing is no longer needed here.

-- Comments
COMMENT ON TABLE email_logs IS 'Log of all emails sent from the system';
