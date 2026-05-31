-- Migration 055: Add GDPR consent recording columns
-- Records when consent was given, via what IP, and on what lawful basis.
-- Required for GDPR Article 7 compliance (demonstrating valid consent).
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS

-- entries: record consent at submission time
ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS consent_given       BOOLEAN      DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_timestamp   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_ip_address  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS lawful_basis        VARCHAR(50)  DEFAULT 'legitimate_interest';

-- event_guests: record consent at registration time
ALTER TABLE event_guests
  ADD COLUMN IF NOT EXISTS consent_given       BOOLEAN      DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_timestamp   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_ip_address  VARCHAR(50);

-- winners: record consent for image/name publication with audit trail
ALTER TABLE winners
  ADD COLUMN IF NOT EXISTS consent_timestamp   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_method      VARCHAR(50), -- 'email','phone','in_person','form'
  ADD COLUMN IF NOT EXISTS image_consent       BOOLEAN      DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS image_consent_timestamp TIMESTAMPTZ;
