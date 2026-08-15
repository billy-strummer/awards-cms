-- ============================================================
-- Migration 070: Add missing updated_at columns
-- ============================================================
-- api/data-proxy.js unconditionally stamps `updated_at: new Date().toISOString()`
-- onto every row for EVERY table on 'insert'/'upsert'/'update' operations
-- (see executeQuery's INSERT/UPSERT/UPDATE branches). Any table without an
-- updated_at column fails ALL writes through the proxy with
-- "Could not find the 'updated_at' column of '<table>' in the schema cache" —
-- discovered via the winners CSV import, which silently failed for exactly
-- this reason. This is systemic: 57 tables from
-- migrations/000-complete-database-setup.sql never got this column.
--
-- Adding a nullable, defaulted updated_at is harmless even for append-only
-- audit/log tables (cms_audit_logs, activity_logs, etc.) — it doesn't change
-- their immutability guarantees (nothing UPDATEs them), it just stops
-- INSERTs from being rejected by PostgREST's schema cache lookup.
-- ============================================================

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'activity_logs', 'ai_vetting_results', 'ai_vetting_runs', 'announcements',
    'api_request_logs', 'calendar_feeds', 'cms_audit_logs', 'counties',
    'custom_categories', 'custom_sectors', 'deliberation_notes', 'document_versions',
    'email_campaign_recipients', 'email_import_batches', 'email_log', 'email_logs',
    'email_suppressions', 'email_unsubscribes', 'entry_files', 'event_attendees',
    'event_budget_items', 'event_galleries', 'event_room_fixtures', 'event_templates',
    'event_ticket_types', 'event_vendors', 'event_waitlist', 'gallery_sections',
    'invoice_line_items', 'ip_blocklist', 'judge_conflicts', 'judge_scores',
    'media_items', 'nominee_upload_rows', 'notification_preferences', 'notification_queue',
    'notifications', 'org_activity_notes', 'org_audit_log', 'organisation_comms_log',
    'organisation_documents', 'organisation_images', 'organisation_relationships',
    'organisation_segments', 'payment_reminders', 'public_votes', 'rate_limit_alerts',
    'rate_limit_config', 'record_notes', 'running_order_versions', 'seating_sections',
    'social_campaigns', 'sponsor_impressions', 'sponsors', 'webhook_logs',
    'winner_documents', 'winner_media', 'winners'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
