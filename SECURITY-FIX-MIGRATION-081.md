# Security Fix — Migration 081 (Email-Sending Function Execute Grants)

**Date:** 2026-07-22. Scope: Claude TEST CMS only. `british-trade-awards-cms` was not touched.

This is finding 2 of the risk-assessed "Must fix before launch" list, investigated and closed as its own complete unit.

## 1. Proof the vulnerability existed

Six `SECURITY DEFINER` functions had `EXECUTE` granted to `anon`/`authenticated` (both explicitly and via the default `PUBLIC` grant Postgres applies on `CREATE FUNCTION`): `check_email_config`, `process_scheduled_campaigns`, `send_campaign_emails`, `send_entry_confirmation_email`, `send_single_email`, `send_test_email`.

Real anon-key RPC calls, executed live against Claude TEST CMS:
- `check_email_config()` → anon got back real config disclosure: `{"has_api_key":true,"has_from_email":true,"from_email":"British Trade Awards <awards@britishtradeawards.com>"}` — zero authentication required.
- `process_scheduled_campaigns()` → anon successfully invoked it (`{"processed":0,"campaigns":[]}`, safe because 0 campaigns were due at test time — but the source code, pulled directly from `pg_proc.prosrc`, confirms this would have force-sent every currently-scheduled campaign had any existed).
- `send_campaign_emails()` → anon successfully invoked it with a fabricated `list_id` (`{"success":false,"error":"No active subscribers","sent":0,"total":0}` — safe because that list had 0 subscribers, but the source shows it would mass-send attacker-controlled HTML to every active subscriber on a real list).
- `send_entry_confirmation_email()` → anon successfully invoked it against a real, existing `entry_id` (`{"success":false,"error":"Confirmation can only be sent for recent entries"}` — safely rejected only because the real entry was >24h old, but this proves anon can enumerate and invoke it against arbitrary real entry IDs).
- `send_single_email()` / `send_test_email()` — **deliberately not executed.** Their source (read directly from the live database) shows no conditional safe branch: both read the real Resend API key from `cms_config` and call `net.http_post` immediately and unconditionally with a caller-controlled recipient/subject/HTML/from-address body. There is no way to invoke either without a live, uncontrolled outbound email through the platform's real, paid Resend account. This finding instead rests on: the confirmed grant, the confirmed source code (conclusive on its own given `SECURITY DEFINER` semantics), and the fact that the four sibling functions above — sharing the exact same unprotected pattern — were proven to actually execute for anon under safe conditions.

## 2. Why the app doesn't already prevent it

`api/data-proxy.js`'s `ALLOWED_RPCS` map does correctly gate `send_test_email`/`check_email_config`/`send_campaign_emails` behind a required `'admin'` role for the app's own intended call path, and `api/_lib/automation-scheduler.js` calls `send_campaign_emails` server-side with the service-role key. None of that matters for direct access, though: Postgres `GRANT EXECUTE` exists independently of the app's own authorization logic, and PostgREST auto-exposes every database function as a public RPC endpoint (`/rest/v1/rpc/<name>`) regardless of whether the app's own code path happens to be gated. `send_entry_confirmation_email` and `process_scheduled_campaigns` aren't referenced anywhere in the app's JS at all (confirmed via full-codebase grep) — orphaned from the application's perspective, but still fully live and callable directly.

## 3. Browser-side dependency check

`apiClient.rpc()` (`utils.js`) routes every RPC call through `/api/data-proxy` server-side. Confirmed via full-codebase grep that no frontend file calls `supabase.rpc()` directly with the anon/authenticated key for any of these 6 functions — `email-builder.js`/`email-templates.js` only call `apiClient.rpc(...)`. **No feature depends on direct client-side execute access.**

## 4. Fix applied — `migrations/081-revoke-anon-execute-email-functions.sql`

`REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` on all 6 functions, by exact signature. Applied to Claude TEST CMS; re-ran a second time with no errors (REVOKE is naturally idempotent).

## 5. Verification

| Check | Result |
|---|---|
| Grants after fix | Only `postgres`/`service_role` remain on all 6 functions |
| anon RPC calls (all 6, including `send_single_email`/`send_test_email` for the first time) | All 6 blocked: `HTTP 401`, `42501 permission denied for function <name>` |
| service-role `check_email_config()` (simulates `data-proxy.js` post-admin-check) | Still works, `HTTP 200` |
| service-role `send_campaign_emails()` (simulates `automation-scheduler.js`'s real call) | Still works, `HTTP 200` |
| Affected Jest suites (`email-builder`, `email-templates`, `automation-scheduler`, `data-proxy`, `entry-proxy`) | 5 suites, 393 tests, all pass |
| Full test suite / lint / build | 68 suites, 6474 passed (3 pre-existing skips), lint clean, build clean |

## 6. Data restored

No rows were created or modified this round (every anon call either failed outright after the fix, or hit a safe no-op branch before the fix). Data snapshot confirmed unchanged before and after.

## Conclusion

**Confirmed, not a false positive**, for 4 of the 6 functions via direct execution. The remaining 2 (`send_single_email`/`send_test_email`) are confirmed via grant + source-code inspection plus behavioral proof from the 4 sibling functions sharing the identical pattern — a deliberate, reasoned limit to avoid an irreversible real-world side effect (an uncontrolled email via the platform's paid Resend account), not a gap in rigor. Fix verified, real workflows unaffected. Moving to the next finding (`certificate-assets` storage bucket) as its own separate investigation.
