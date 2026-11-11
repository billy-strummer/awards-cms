-- ============================================================
-- Migration 081: Revoke anon/authenticated EXECUTE on internal
-- email-sending SECURITY DEFINER functions
-- ============================================================
-- Empirical investigation (Claude TEST CMS, 2026-07-22) proved that 6
-- SECURITY DEFINER functions -- check_email_config, process_scheduled_campaigns,
-- send_campaign_emails, send_entry_confirmation_email, send_single_email,
-- send_test_email -- were EXECUTE-able by anon and authenticated (granted
-- both explicitly and implicitly via the default PUBLIC grant Postgres
-- applies on CREATE FUNCTION).
--
-- Proof (real anon-key RPC calls, not just inspection):
--   - check_email_config(): anon got back real config disclosure
--     ({"has_api_key":true,"has_from_email":true,"from_email":"British
--     Trade Awards <awards@britishtradeawards.com>"}) with zero auth.
--   - process_scheduled_campaigns(): anon successfully invoked it directly
--     (returned {"processed":0,"campaigns":[]} because 0 campaigns were
--     due at test time -- a real, safe no-op that still proves anon can
--     force this function to run on demand; had real scheduled campaigns
--     existed, this would have forced them to send immediately).
--   - send_campaign_emails(): anon successfully invoked it directly with a
--     fabricated list_id (0 active subscribers -> the function's own
--     "no active subscribers" branch fired, a safe no-op that still
--     proves anon can call it; against a real list with active
--     subscribers this would mass-send attacker-controlled HTML).
--   - send_entry_confirmation_email(): anon successfully invoked it
--     against a real, existing entry_id (the function's own >24h-old
--     rejection branch fired safely, but this proves anon can enumerate
--     and invoke it against arbitrary real entry IDs).
--   - send_single_email()/send_test_email(): NOT executed, deliberately.
--     Their source (pulled directly from pg_proc.prosrc) shows no
--     conditional safe branch -- both read the real Resend API key from
--     cms_config and call net.http_post immediately and unconditionally
--     with a caller-controlled recipient/subject/html/from body. There is
--     no way to invoke either without a live, uncontrolled outbound email
--     via the platform's real Resend account, so this finding rests on
--     the confirmed grant + confirmed source (conclusive on its own given
--     SECURITY DEFINER semantics) plus the sibling functions above, which
--     share the identical unprotected pattern and were proven to execute
--     for anon under safe conditions.
--
-- Why the app doesn't already prevent this: api/data-proxy.js's
-- ALLOWED_RPCS map *does* correctly gate send_test_email/check_email_config
-- /send_campaign_emails behind a required 'admin' role for the app's own
-- intended call path, and api/_lib/automation-scheduler.js calls
-- send_campaign_emails server-side with the service-role key. But none of
-- that matters for direct access: Postgres GRANT EXECUTE exists
-- independently of the app's own authorization logic, and PostgREST
-- auto-exposes every function as a public RPC endpoint
-- (/rest/v1/rpc/<name>) regardless of whether the app's own code path
-- happens to be gated. send_entry_confirmation_email and
-- process_scheduled_campaigns aren't even referenced anywhere in the
-- app's JS at all (confirmed via full-codebase grep) -- they are
-- orphaned from the application's perspective but were still fully live
-- and callable in the database.
--
-- Browser-side dependency check: apiClient.rpc() (utils.js) routes every
-- RPC call through /api/data-proxy server-side -- confirmed via
-- full-codebase grep that no frontend file calls supabase.rpc() directly
-- with the anon/authenticated key for any of these 6 functions. No
-- feature depends on direct client-side execute access, so revoking it
-- is safe.
-- ============================================================

REVOKE EXECUTE ON FUNCTION check_email_config() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION process_scheduled_campaigns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION send_campaign_emails(uuid, text, text, text, text, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION send_entry_confirmation_email(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION send_single_email(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION send_test_email(text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
