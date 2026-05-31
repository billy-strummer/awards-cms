-- Migration 058: Create missing tables and add missing columns
-- Fixes runtime errors identified in DB schema audit

-- ────────────────────────────────────────────────────────────
-- record_notes: generic notes attached to any table/record
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS record_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  note TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS record_notes_record_idx ON record_notes(table_name, record_id);

ALTER TABLE record_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "record_notes_service_all" ON record_notes FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "record_notes_auth_read" ON record_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "record_notes_auth_insert" ON record_notes FOR INSERT TO authenticated WITH CHECK (true);

-- ────────────────────────────────────────────────────────────
-- media_videos: video assets in the media gallery
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  tags TEXT[],
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE media_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "media_videos_service_all" ON media_videos FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "media_videos_auth_all" ON media_videos FOR ALL TO authenticated USING (true);

-- ────────────────────────────────────────────────────────────
-- social_media_templates: email/social post templates
-- (was previously only in social-media-schema.sql root file)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_media_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'linkedin', 'facebook', 'instagram', 'all')),
  content TEXT NOT NULL,
  variables TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE social_media_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "social_media_templates_service_all" ON social_media_templates FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "social_media_templates_auth_all" ON social_media_templates FOR ALL TO authenticated USING (true);

-- ────────────────────────────────────────────────────────────
-- email_list_members: view alias for email_list_subscribers
-- (some code references the old name)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW email_list_members AS
  SELECT * FROM email_list_subscribers;

-- ────────────────────────────────────────────────────────────
-- Fix webhook_logs column mismatches
-- data-proxy inserts webhook_name and status_code;
-- the existing schema has no webhook_name and uses response_status
-- ────────────────────────────────────────────────────────────
ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS webhook_name TEXT;
ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS status_code INTEGER;

-- ────────────────────────────────────────────────────────────
-- Add template_key to notification_queue
-- ────────────────────────────────────────────────────────────
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS template_key TEXT;

-- ────────────────────────────────────────────────────────────
-- Add tenant_id to email_log
-- ────────────────────────────────────────────────────────────
ALTER TABLE email_log ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- ────────────────────────────────────────────────────────────
-- Add missing columns to event_guests
-- registration-proxy.js inserts: company_name, special_requirements,
-- ticket_type, rsvp_date, notes, registration_date, status
-- ────────────────────────────────────────────────────────────
ALTER TABLE event_guests ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE event_guests ADD COLUMN IF NOT EXISTS special_requirements TEXT;
ALTER TABLE event_guests ADD COLUMN IF NOT EXISTS ticket_type TEXT;
ALTER TABLE event_guests ADD COLUMN IF NOT EXISTS rsvp_date TIMESTAMPTZ;
ALTER TABLE event_guests ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE event_guests ADD COLUMN IF NOT EXISTS registration_date TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE event_guests ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'confirmed', 'checked_in', 'cancelled', 'no_show'));

-- ────────────────────────────────────────────────────────────
-- nominee_upload_batches and nominee_upload_rows
-- (previously only in database-nominee-uploads.sql)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nominee_upload_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  award_id UUID REFERENCES award_years(id) ON DELETE SET NULL,
  uploaded_by TEXT NOT NULL,
  file_name TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  error_log JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nominee_upload_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES nominee_upload_batches(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  raw_data JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE nominee_upload_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "nominee_upload_batches_service_all" ON nominee_upload_batches FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "nominee_upload_batches_auth_all" ON nominee_upload_batches FOR ALL TO authenticated USING (true);

ALTER TABLE nominee_upload_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "nominee_upload_rows_service_all" ON nominee_upload_rows FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "nominee_upload_rows_auth_all" ON nominee_upload_rows FOR ALL TO authenticated USING (true);

-- ────────────────────────────────────────────────────────────
-- custom_sectors and custom_categories
-- (previously only in database-sectors-categories.sql)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id UUID REFERENCES custom_sectors(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE custom_sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "custom_sectors_service_all" ON custom_sectors FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "custom_sectors_auth_read" ON custom_sectors FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "custom_sectors_anon_read" ON custom_sectors FOR SELECT TO anon USING (is_active = true);

ALTER TABLE custom_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "custom_categories_service_all" ON custom_categories FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "custom_categories_auth_read" ON custom_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "custom_categories_anon_read" ON custom_categories FOR SELECT TO anon USING (is_active = true);
