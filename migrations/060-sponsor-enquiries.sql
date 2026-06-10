-- Migration 060: Sponsor enquiries table
-- Records sponsorship enquiries submitted via become-a-sponsor.html
-- Both the API (service_role) and CMS admins (authenticated) need full access.

CREATE TABLE IF NOT EXISTS sponsor_enquiries (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  company    text        NOT NULL,
  role       text,
  email      text        NOT NULL,
  phone      text,
  package    text        NOT NULL,
  message    text,
  status     text        NOT NULL DEFAULT 'new'
               CHECK (status IN ('new', 'contacted', 'converted', 'rejected')),
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sponsor_enquiries_created_at_idx ON sponsor_enquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS sponsor_enquiries_status_idx     ON sponsor_enquiries (status);
CREATE INDEX IF NOT EXISTS sponsor_enquiries_email_idx      ON sponsor_enquiries (email);

-- Auto-bump updated_at on every UPDATE
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sponsor_enquiries_updated_at ON sponsor_enquiries;
CREATE TRIGGER sponsor_enquiries_updated_at
  BEFORE UPDATE ON sponsor_enquiries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ────────────────────────────────────────────────────────────────
ALTER TABLE sponsor_enquiries ENABLE ROW LEVEL SECURITY;

-- Service role (used by /api/entry-proxy to INSERT): full access
DROP POLICY IF EXISTS "sponsor_enquiries_service" ON sponsor_enquiries;
CREATE POLICY "sponsor_enquiries_service" ON sponsor_enquiries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users (CMS admin via /api/data-proxy): full read/write
DROP POLICY IF EXISTS "sponsor_enquiries_authenticated" ON sponsor_enquiries;
CREATE POLICY "sponsor_enquiries_authenticated" ON sponsor_enquiries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- anon: no access (public form submits go through service_role via entry-proxy)
