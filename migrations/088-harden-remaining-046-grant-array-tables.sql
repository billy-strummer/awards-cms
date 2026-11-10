-- ============================================================
-- Migration 088: Harden RLS and grants on the remaining tables
-- from migration 046's unconditional grant array
-- ============================================================
-- BTA-050 (2026-10-27) listed ~29 tables from migration 046's big
-- unconditional "GRANT ALL ... TO anon/authenticated" + permissive-policy
-- loop that had never been live-tested (unlike BTA-019/020's original
-- 13-table finding) and had no later migration confirmed to cover them.
--
-- BTA-051 (2026-10-27) checked all ~29 via a live read-only query against
-- the TEST project (htcsewpztvxafksdzuhp) and found:
--   - 7 already correctly hardened, no action needed: api_request_logs,
--     document_versions, ip_blocklist, rate_limit_alerts,
--     rate_limit_config, sponsor_contracts, webhook_logs.
--   - 22 CONFIRMED still exposed to anon -- this migration.
--
-- For all 22, the live query found the exact same bug pattern already
-- fixed five times in this codebase (migrations 080/084/085/086/087):
-- a permissive "Allow all access to X" (or equivalent) policy, PostgreSQL
-- ORs multiple PERMISSIVE policies together, so it alone grants anon (and
-- authenticated) full read/write regardless of any other policy present.
-- Several of these 22 (org_activity_notes, event_budgets,
-- event_budget_items, event_milestones, event_post_data,
-- event_special_requirements, event_tickets, event_vendors,
-- event_waitlist, notification_queue, notifications, scheduled_reports,
-- tenant_branding) already had a correctly-scoped authenticated/service
-- policy pair added alongside the old one at some point -- but the old
-- permissive policy was never dropped, so none of that later hardening
-- actually took effect. (tenant_branding_select/_service and the
-- notifications/org_activity_notes equivalents are very likely the
-- "three unidentified policy sources" BTA-021 could not trace to a named
-- migration -- this confirms they exist, and why they didn't help.)
--
-- Browser-side dependency check (required before this migration, same as
-- migrations 080/084): grepped the full frontend for any direct
-- supabase.createClient()/.from() usage against all 22 table names --
-- none found. Every legitimate feature already goes through
-- apiClient -> /api/data-proxy (server-side, service-role key, which
-- bypasses RLS/grants regardless), so a full lockdown with no follow-up
-- "restore access" migration (unlike event_guests/migration 079) is safe
-- for all 22, same reasoning as migration 080's.
--
-- Idempotent: DROP POLICY IF EXISTS is a no-op if already removed;
-- CREATE POLICY is wrapped in duplicate_object exception handling,
-- matching migrations 052/080/086/087's own approach; REVOKE on a
-- privilege that was never granted (or already revoked) is a no-op in
-- PostgreSQL, not an error.
--
-- NOT APPLIED by this migration file's authoring task (BTA-051). This
-- file has been created and reviewed as source only -- it must be run
-- against the test project first, verified, and only then applied to
-- production, per the project's standard migration process.
-- ============================================================

-- Drop every leftover policy name found live on each table (exact names,
-- confirmed by query, not guessed) -- including the "later hardening that
-- never took effect" pairs, since they'll be replaced by the standard
-- service_role_all/no_direct_client_access pair below.
DROP POLICY IF EXISTS "Allow all access to announcements" ON announcements;
DROP POLICY IF EXISTS "Allow all access to calendar_feeds" ON calendar_feeds;
DROP POLICY IF EXISTS "Allow all access to event_budgets" ON event_budgets;
DROP POLICY IF EXISTS "Allow anon read on event_budgets" ON event_budgets;
DROP POLICY IF EXISTS "Allow authenticated full access on event_budgets" ON event_budgets;
DROP POLICY IF EXISTS "Allow all access to event_budget_items" ON event_budget_items;
DROP POLICY IF EXISTS "Allow anon read on event_budget_items" ON event_budget_items;
DROP POLICY IF EXISTS "Allow authenticated full access on event_budget_items" ON event_budget_items;
DROP POLICY IF EXISTS "Allow all access to event_milestones" ON event_milestones;
DROP POLICY IF EXISTS "Allow anon read on event_milestones" ON event_milestones;
DROP POLICY IF EXISTS "Allow authenticated full access on event_milestones" ON event_milestones;
DROP POLICY IF EXISTS "Allow all access to event_post_data" ON event_post_data;
DROP POLICY IF EXISTS "Allow anon read on event_post_data" ON event_post_data;
DROP POLICY IF EXISTS "Allow authenticated full access on event_post_data" ON event_post_data;
DROP POLICY IF EXISTS "Allow all access to event_room_fixtures" ON event_room_fixtures;
DROP POLICY IF EXISTS "Allow all access to event_special_requirements" ON event_special_requirements;
DROP POLICY IF EXISTS "Allow anon read on event_special_requirements" ON event_special_requirements;
DROP POLICY IF EXISTS "Allow authenticated full access on event_special_requirements" ON event_special_requirements;
DROP POLICY IF EXISTS "Allow all access to event_ticket_types" ON event_ticket_types;
DROP POLICY IF EXISTS "Allow all access to event_tickets" ON event_tickets;
DROP POLICY IF EXISTS "Allow anon read on event_tickets" ON event_tickets;
DROP POLICY IF EXISTS "Allow authenticated full access on event_tickets" ON event_tickets;
DROP POLICY IF EXISTS "Allow all access to event_vendors" ON event_vendors;
DROP POLICY IF EXISTS "Allow anon read on event_vendors" ON event_vendors;
DROP POLICY IF EXISTS "Allow authenticated full access on event_vendors" ON event_vendors;
DROP POLICY IF EXISTS "Allow all access to event_waitlist" ON event_waitlist;
DROP POLICY IF EXISTS "Allow anon read on event_waitlist" ON event_waitlist;
DROP POLICY IF EXISTS "Allow authenticated full access on event_waitlist" ON event_waitlist;
DROP POLICY IF EXISTS "Allow all access to notification_preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Allow all access to notification_queue" ON notification_queue;
DROP POLICY IF EXISTS "Allow anon read on notification_queue" ON notification_queue;
DROP POLICY IF EXISTS "Allow authenticated full access on notification_queue" ON notification_queue;
DROP POLICY IF EXISTS "Allow all access to notifications" ON notifications;
DROP POLICY IF EXISTS "notifications_select" ON notifications;
DROP POLICY IF EXISTS "notifications_service" ON notifications;
DROP POLICY IF EXISTS "Allow all access to org_activity_notes" ON org_activity_notes;
DROP POLICY IF EXISTS "Allow anon read on org_activity_notes" ON org_activity_notes;
DROP POLICY IF EXISTS "Allow authenticated full access on org_activity_notes" ON org_activity_notes;
DROP POLICY IF EXISTS "org_activity_notes_select" ON org_activity_notes;
DROP POLICY IF EXISTS "org_activity_notes_service" ON org_activity_notes;
DROP POLICY IF EXISTS "Allow all access to running_order_versions" ON running_order_versions;
DROP POLICY IF EXISTS "Allow all access to scheduled_reports" ON scheduled_reports;
DROP POLICY IF EXISTS "Allow anon read on scheduled_reports" ON scheduled_reports;
DROP POLICY IF EXISTS "Allow authenticated full access on scheduled_reports" ON scheduled_reports;
DROP POLICY IF EXISTS "Allow all access to seating_sections" ON seating_sections;
DROP POLICY IF EXISTS "Allow all access to sponsor_assignments" ON sponsor_assignments;
DROP POLICY IF EXISTS "Allow all access to sponsor_impressions" ON sponsor_impressions;
DROP POLICY IF EXISTS "Allow all access to tenant_branding" ON tenant_branding;
DROP POLICY IF EXISTS "tenant_branding_select" ON tenant_branding;
DROP POLICY IF EXISTS "tenant_branding_service" ON tenant_branding;

DO $$
DECLARE
  tbls TEXT[] := ARRAY[
    'announcements', 'calendar_feeds', 'event_budgets', 'event_budget_items',
    'event_milestones', 'event_post_data', 'event_room_fixtures',
    'event_special_requirements', 'event_ticket_types', 'event_tickets',
    'event_vendors', 'event_waitlist', 'notification_preferences',
    'notification_queue', 'notifications', 'org_activity_notes',
    'running_order_versions', 'scheduled_reports', 'seating_sections',
    'sponsor_assignments', 'sponsor_impressions', 'tenant_branding'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    BEGIN
      EXECUTE format('CREATE POLICY "service_role_all" ON %I FOR ALL USING (auth.role() = ''service_role'')', tbl);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      EXECUTE format('CREATE POLICY "no_direct_client_access" ON %I FOR ALL USING (false)', tbl);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', tbl);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', tbl);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
