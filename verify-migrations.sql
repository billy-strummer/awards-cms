-- ============================================================
-- MIGRATION VERIFICATION QUERY
-- Run this in Supabase SQL Editor to check all migrations
-- have been applied successfully.
-- ============================================================

-- ============================================================
-- 1. CHECK ALL EXPECTED TABLES EXIST
-- ============================================================
WITH expected_tables(tbl) AS (VALUES
  ('activity_logs'),
  ('ai_vetting_results'),
  ('ai_vetting_runs'),
  ('announcements'),
  ('api_request_logs'),
  ('award_assignments'),
  ('award_seasons'),
  ('award_years'),
  ('banners'),
  ('calendar_feeds'),
  ('certificate_templates'),
  ('cms_audit_logs'),
  ('cms_config'),
  ('communications'),
  ('contact_segments'),
  ('contacts'),
  ('counties'),
  ('deals'),
  ('deliberation_notes'),
  ('document_versions'),
  ('documents'),
  ('email_campaign_recipients'),
  ('email_campaigns'),
  ('email_import_batches'),
  ('email_list_subscribers'),
  ('email_lists'),
  ('email_log'),
  ('email_templates'),
  ('email_unsubscribes'),
  ('entries'),
  ('entry_comments'),
  ('entry_files'),
  ('entry_revisions'),
  ('event_attendees'),
  ('event_budget_items'),
  ('event_budgets'),
  ('event_galleries'),
  ('event_guests'),
  ('event_milestones'),
  ('event_post_data'),
  ('event_room_fixtures'),
  ('event_special_requirements'),
  ('event_tables'),
  ('event_templates'),
  ('event_ticket_types'),
  ('event_tickets'),
  ('event_vendors'),
  ('event_waitlist'),
  ('events'),
  ('gallery_sections'),
  ('gdpr_requests'),
  ('invoice_line_items'),
  ('invoices'),
  ('ip_blocklist'),
  ('judge_scores'),
  ('media_gallery'),
  ('media_items'),
  ('meeting_notes'),
  ('notification_preferences'),
  ('notification_queue'),
  ('notifications'),
  ('org_activity_notes'),
  ('org_audit_log'),
  ('organisation_comms_log'),
  ('organisation_contacts'),
  ('organisation_custom_fields'),
  ('organisation_documents'),
  ('organisation_follow_ups'),
  ('organisation_images'),
  ('organisation_notes'),
  ('organisation_relationships'),
  ('organisation_segments'),
  ('organisations'),
  ('payment_reminders'),
  ('payments'),
  ('press_releases'),
  ('public_assignment_votes'),
  ('public_votes'),
  ('rate_limit_alerts'),
  ('rate_limit_config'),
  ('regions'),
  ('running_order'),
  ('running_order_settings'),
  ('running_order_versions'),
  ('scheduled_reports'),
  ('seating_sections'),
  ('shortlists'),
  ('social_media_accounts'),
  ('social_media_campaigns'),
  ('social_media_posts'),
  ('social_media_templates'),
  ('sponsor_assignments'),
  ('sponsor_contracts'),
  ('sponsor_impressions'),
  ('sponsors'),
  ('sponsorship_opportunities'),
  ('sponsorship_packages'),
  ('sponsorships'),
  ('table_assignments'),
  ('tenant_branding'),
  ('tenants'),
  ('user_preferences'),
  ('user_roles'),
  ('webhook_logs'),
  ('webhooks'),
  ('winner_documents'),
  ('winner_media'),
  ('winners')
)
SELECT
  e.tbl AS table_name,
  CASE WHEN t.tablename IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS status
FROM expected_tables e
LEFT JOIN pg_tables t ON t.tablename = e.tbl AND t.schemaname = 'public'
ORDER BY status DESC, e.tbl;


-- ============================================================
-- 2. CHECK ALL EXPECTED FUNCTIONS EXIST
-- ============================================================
WITH expected_functions(fn) AS (VALUES
  ('anonymize_organisation'),
  ('auto_flag_previous_winner'),
  ('check_email_config'),
  ('check_email_unsubscribe'),
  ('copy_nominees_to_new_year'),
  ('decrement_vote_count'),
  ('generate_entry_number'),
  ('generate_invoice_number'),
  ('generate_payment_reference'),
  ('generate_voting_slug'),
  ('get_available_seats'),
  ('get_award_assignment_count'),
  ('get_award_winner_count'),
  ('get_next_award_number'),
  ('get_next_table_number'),
  ('get_nominee_history'),
  ('get_unassigned_guests'),
  ('increment_vote_count'),
  ('is_previous_winner'),
  ('log_audit'),
  ('populate_running_order_from_rsvps'),
  ('process_scheduled_campaigns'),
  ('queue_notification'),
  ('reorder_running_order'),
  ('send_campaign_emails'),
  ('send_entry_confirmation_email'),
  ('send_single_email'),
  ('send_test_email'),
  ('update_ai_vetting_updated_at'),
  ('update_email_list_counts'),
  ('update_entry_scores'),
  ('update_event_tables_updated_at'),
  ('update_invoice_balance'),
  ('update_invoice_total_from_items'),
  ('update_public_vote_count'),
  ('update_running_order_timestamp'),
  ('update_table_plan_timestamp'),
  ('update_updated_at_column')
)
SELECT
  e.fn AS function_name,
  CASE WHEN p.proname IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS status
FROM expected_functions e
LEFT JOIN pg_proc p ON p.proname = e.fn
  AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY status DESC, e.fn;


-- ============================================================
-- 3. CHECK KEY COLUMNS ADDED BY MIGRATIONS
--    (spot-checks for important ALTER TABLE ADD COLUMN migrations)
-- ============================================================
WITH expected_columns(tbl, col, migration) AS (VALUES
  -- 003: organisations tab fixes
  ('organisations', 'address', '003'),
  ('organisations', 'catchment_area', '003'),
  ('organisations', 'status', '003'),
  ('organisations', 'notes', '003'),
  ('organisations', 'tags', '003'),
  -- 009: organisations extended fields
  ('organisations', 'primary_contact_name', '009'),
  ('organisations', 'primary_contact_email', '009'),
  ('organisations', 'primary_contact_phone', '009'),
  ('organisations', 'company_number', '009'),
  ('organisations', 'vat_number', '009'),
  ('organisations', 'employee_count', '009'),
  ('organisations', 'annual_revenue', '009'),
  ('organisations', 'founding_year', '009'),
  -- 010: entries missing columns
  ('entries', 'evidence_text', '010'),
  ('entries', 'supporting_url', '010'),
  ('entries', 'nominated_by_name', '010'),
  -- 012/013: running order enhancements
  ('running_order', 'presenter', '012'),
  ('running_order', 'sponsor_name', '012'),
  ('running_order', 'script_notes', '012'),
  ('running_order', 'av_requirements', '013'),
  ('running_order', 'music_cue', '013'),
  -- 014: media gallery
  ('media_gallery', 'file_size', '014'),
  ('media_gallery', 'mime_type', '014'),
  -- 018: add missing columns
  ('awards', 'is_active', '018'),
  ('organisations', 'sector', '018'),
  -- 023: event attendees
  ('event_attendees', 'dietary_requirements', '023'),
  ('event_attendees', 'accessibility_needs', '023'),
  -- 025: winner status
  ('winners', 'status', '025'),
  -- 026: email templates
  ('email_templates', 'category', '026'),
  -- 027: entries submit columns
  ('entries', 'is_self_nomination', '027'),
  -- 030: entries direct award fields
  ('entries', 'award_name', '030'),
  ('entries', 'county_name', '030'),
  -- 034: table assignments guest type
  ('table_assignments', 'guest_type', '034'),
  -- 035: event vendors status
  ('event_vendors', 'status', '035'),
  -- 036: missing columns audit
  ('events', 'venue_address', '036'),
  ('events', 'dress_code', '036'),
  ('invoices', 'stripe_payment_intent_id', '036'),
  -- 039: tenant branding
  ('tenant_branding', 'logo_url', '039'),
  ('tenant_branding', 'primary_color', '039'),
  -- 042: editable email header/footer
  ('tenant_branding', 'email_header_html', '042'),
  ('tenant_branding', 'email_footer_html', '042')
)
SELECT
  e.tbl AS table_name,
  e.col AS column_name,
  e.migration AS from_migration,
  CASE WHEN c.column_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS status
FROM expected_columns e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
  AND c.table_name = e.tbl
  AND c.column_name = e.col
ORDER BY status DESC, e.migration::text, e.tbl, e.col;


-- ============================================================
-- 4. CHECK STORAGE BUCKETS
-- ============================================================
WITH expected_buckets(bucket) AS (VALUES
  ('brand-assets'),
  ('media'),
  ('uploads'),
  ('entry-attachments')
)
SELECT
  e.bucket AS bucket_name,
  CASE WHEN b.id IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS status
FROM expected_buckets e
LEFT JOIN storage.buckets b ON b.id = e.bucket
ORDER BY status DESC, e.bucket;


-- ============================================================
-- 5. CHECK RLS IS ENABLED ON KEY TABLES
-- ============================================================
SELECT
  t.tablename AS table_name,
  CASE WHEN t.rowsecurity THEN 'RLS ENABLED' ELSE 'RLS DISABLED' END AS rls_status
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.tablename IN (
    'organisations', 'awards', 'winners', 'award_assignments',
    'entries', 'entry_files', 'entry_revisions',
    'events', 'event_attendees', 'event_tables', 'table_assignments',
    'invoices', 'payments', 'invoice_line_items',
    'email_campaigns', 'email_lists', 'email_list_subscribers', 'email_templates',
    'media_gallery', 'media_items',
    'communications', 'contacts', 'deals',
    'sponsors', 'sponsorships',
    'user_preferences', 'user_roles', 'tenants', 'tenant_branding',
    'cms_config', 'activity_logs'
  )
ORDER BY rls_status, t.tablename;


-- ============================================================
-- 6. SUMMARY
-- ============================================================
SELECT '--- SUMMARY ---' AS section;

SELECT
  'Tables' AS check_type,
  COUNT(*) FILTER (WHERE t.tablename IS NOT NULL) AS found,
  COUNT(*) FILTER (WHERE t.tablename IS NULL) AS missing,
  COUNT(*) AS total
FROM (VALUES
  ('activity_logs'),('ai_vetting_results'),('ai_vetting_runs'),('announcements'),
  ('api_request_logs'),('award_assignments'),('award_seasons'),('award_years'),
  ('banners'),('calendar_feeds'),('certificate_templates'),('cms_audit_logs'),
  ('cms_config'),('communications'),('contact_segments'),('contacts'),('counties'),
  ('deals'),('deliberation_notes'),('document_versions'),('documents'),
  ('email_campaign_recipients'),('email_campaigns'),('email_import_batches'),
  ('email_list_subscribers'),('email_lists'),('email_log'),('email_templates'),
  ('email_unsubscribes'),('entries'),('entry_comments'),('entry_files'),
  ('entry_revisions'),('event_attendees'),('event_budget_items'),('event_budgets'),
  ('event_galleries'),('event_guests'),('event_milestones'),('event_post_data'),
  ('event_room_fixtures'),('event_special_requirements'),('event_tables'),
  ('event_templates'),('event_ticket_types'),('event_tickets'),('event_vendors'),
  ('event_waitlist'),('events'),('gallery_sections'),('gdpr_requests'),
  ('invoice_line_items'),('invoices'),('ip_blocklist'),('judge_scores'),
  ('media_gallery'),('media_items'),('meeting_notes'),('notification_preferences'),
  ('notification_queue'),('notifications'),('org_activity_notes'),('org_audit_log'),
  ('organisation_comms_log'),('organisation_contacts'),('organisation_custom_fields'),
  ('organisation_documents'),('organisation_follow_ups'),('organisation_images'),
  ('organisation_notes'),('organisation_relationships'),('organisation_segments'),
  ('organisations'),('payment_reminders'),('payments'),('press_releases'),
  ('public_assignment_votes'),('public_votes'),('rate_limit_alerts'),('rate_limit_config'),
  ('regions'),('running_order'),('running_order_settings'),('running_order_versions'),
  ('scheduled_reports'),('seating_sections'),('shortlists'),('social_media_accounts'),
  ('social_media_campaigns'),('social_media_posts'),('social_media_templates'),
  ('sponsor_assignments'),('sponsor_contracts'),('sponsor_impressions'),('sponsors'),
  ('sponsorship_opportunities'),('sponsorship_packages'),('sponsorships'),
  ('table_assignments'),('tenant_branding'),('tenants'),('user_preferences'),
  ('user_roles'),('webhook_logs'),('webhooks'),('winner_documents'),('winner_media'),
  ('winners')
) AS expected(tbl)
LEFT JOIN pg_tables t ON t.tablename = expected.tbl AND t.schemaname = 'public'

UNION ALL

SELECT
  'Functions' AS check_type,
  COUNT(*) FILTER (WHERE p.proname IS NOT NULL) AS found,
  COUNT(*) FILTER (WHERE p.proname IS NULL) AS missing,
  COUNT(*) AS total
FROM (VALUES
  ('anonymize_organisation'),('auto_flag_previous_winner'),('check_email_config'),
  ('check_email_unsubscribe'),('copy_nominees_to_new_year'),('decrement_vote_count'),
  ('generate_entry_number'),('generate_invoice_number'),('generate_payment_reference'),
  ('generate_voting_slug'),('get_available_seats'),('get_award_assignment_count'),
  ('get_award_winner_count'),('get_next_award_number'),('get_next_table_number'),
  ('get_nominee_history'),('get_unassigned_guests'),('increment_vote_count'),
  ('is_previous_winner'),('log_audit'),('populate_running_order_from_rsvps'),
  ('process_scheduled_campaigns'),('queue_notification'),('reorder_running_order'),
  ('send_campaign_emails'),('send_entry_confirmation_email'),('send_single_email'),
  ('send_test_email'),('update_ai_vetting_updated_at'),('update_email_list_counts'),
  ('update_entry_scores'),('update_event_tables_updated_at'),('update_invoice_balance'),
  ('update_invoice_total_from_items'),('update_public_vote_count'),
  ('update_running_order_timestamp'),('update_table_plan_timestamp'),
  ('update_updated_at_column')
) AS expected(fn)
LEFT JOIN pg_proc p ON p.proname = expected.fn
  AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
