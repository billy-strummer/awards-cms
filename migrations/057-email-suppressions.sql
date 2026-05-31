-- Email suppression list: tracks bounced/complained addresses that must not be emailed.
-- Populated by Resend webhook events (bounce, spam_complaint).

CREATE TABLE IF NOT EXISTS email_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('bounce', 'spam_complaint', 'unsubscribe', 'manual')),
  detail TEXT,
  suppressed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT email_suppressions_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_email_suppressions_email ON email_suppressions(email);
CREATE INDEX IF NOT EXISTS idx_email_suppressions_reason ON email_suppressions(reason);

-- Enable RLS
ALTER TABLE email_suppressions ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write
CREATE POLICY "service_role_all" ON email_suppressions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated admins can read
CREATE POLICY "authenticated_select" ON email_suppressions
  FOR SELECT TO authenticated USING (true);
