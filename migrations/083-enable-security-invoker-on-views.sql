-- ============================================================
-- Migration 083: Enable security_invoker on all public views
-- ============================================================
-- Empirical investigation (Claude TEST CMS, 2026-07-22) proved that all 15
-- views in the public schema run with the view OWNER's privileges on
-- SELECT, not the querying role's, because none had `security_invoker`
-- set (confirmed: all 15 have reloptions IS NULL). This means views built
-- on top of tables that were already correctly hardened (organisations,
-- entries, invoices, payments, event_guests) silently bypass that
-- hardening for anyone querying the view directly instead of the table.
--
-- Proof (real anon-key REST calls against real rows, not just inspection):
--   - Direct SELECT on `organisations` (anon key) correctly returns []`,
--     but `organisations_with_stats` and `organisations_with_crm_summary`
--     (views over the same table) returned real company names, contact
--     names, emails, and phone numbers.
--   - Direct SELECT on `activity_logs` is authenticated-only (no anon
--     policy), but the `activity_log` view returned real audit trail
--     entries including admin email addresses and action details.
--   - Most concretely: `event_guests` was hardened in migration 079 to
--     block anon entirely (confirmed above: a real test guest's
--     SELECT via anon correctly returned []`) -- but `running_order_full`
--     (a view joining running_order + event_guests) returned that same
--     guest's real name and email to anon anyway, completely undoing
--     that fix for anyone who queries the view instead of the table.
--
-- Two of the 15 (`awards`, `awards_with_stats`) are NOT part of the real
-- vulnerability: their base table, `award_years`, has a deliberate
-- `award_years_anon_select` policy (roles={anon}, USING(true)) -- award
-- categories are intentionally public for the voting/nominee-browsing
-- pages. Fixing these two is still correct (consistency, and it costs
-- nothing) but doesn't change what anon can already see.
--
-- Why the app doesn't already prevent this: PostgreSQL views default to
-- running queries with the view creator's privileges, not the caller's,
-- unless `security_invoker = true` is set explicitly (available since
-- PG15). Nothing in application code can change this -- it's a database-
-- level default that has to be opted out of per view.
--
-- Browser-side dependency check: the real app reads all 15 views
-- exclusively through /api/data-proxy (service-role key, which bypasses
-- RLS regardless of security_invoker), confirmed via the same apiClient
-- routing already verified for findings 1-3 in this pass. Enabling
-- security_invoker only changes behaviour for roles that are actually
-- subject to RLS (anon/authenticated querying directly) -- it has no
-- effect on service_role, so no real feature is affected.
-- ============================================================

ALTER VIEW activity_log SET (security_invoker = true);
ALTER VIEW awards SET (security_invoker = true);
ALTER VIEW awards_with_stats SET (security_invoker = true);
ALTER VIEW communication_activity SET (security_invoker = true);
ALTER VIEW deal_pipeline_summary SET (security_invoker = true);
ALTER VIEW email_list_members SET (security_invoker = true);
ALTER VIEW email_lists_with_stats SET (security_invoker = true);
ALTER VIEW invoices_with_details SET (security_invoker = true);
ALTER VIEW media_gallery_with_details SET (security_invoker = true);
ALTER VIEW organisations_with_crm_summary SET (security_invoker = true);
ALTER VIEW organisations_with_stats SET (security_invoker = true);
ALTER VIEW payment_summary_by_organisation SET (security_invoker = true);
ALTER VIEW running_order_full SET (security_invoker = true);
ALTER VIEW table_plan_summary SET (security_invoker = true);
ALTER VIEW upcoming_follow_ups SET (security_invoker = true);

NOTIFY pgrst, 'reload schema';
