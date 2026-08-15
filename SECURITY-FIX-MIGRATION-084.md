# Security Fix — Migration 084 (Sensitive Table Subset RLS)

**Date:** 2026-07-22. Scope: Claude TEST CMS only. `british-trade-awards-cms` was not touched.

This is finding 5 of the risk-assessed "Must fix before launch" list, investigated and closed as its own complete unit. Covers 27 tables: `user_roles`, `ip_blocklist`, `rate_limit_config`, `rate_limit_alerts`, `org_audit_log`, `cms_audit_logs`, `webhooks`, `webhook_logs`, `gdpr_requests`, `sponsor_contracts`, `invoice_line_items`, `payment_reminders`, `entry_files`, `entry_revisions`, `ai_vetting_results`, `ai_vetting_runs`, `documents`, `document_versions`, `api_request_logs`, `meeting_notes`, `contact_segments`, and the 7 `organisation_*` CRM tables.

## 1. Proof the vulnerability existed

All 27 carried the original migration-000 `"Allow all access to X"` permissive policy. Real anon-key REST calls, executed live, against real inserted rows:
- **`user_roles`**: anon `SELECT` returned the real admin account's email and `super_admin` role.
- **`sponsor_contracts`**: anon `SELECT` returned a real contract's amount, currency, and confidential notes.
- **`gdpr_requests`**: anon `SELECT` returned a real data-subject's email and request details; anon `DELETE` actually destroyed that legal request record (confirmed via service-role re-read).
- **`cms_audit_logs`**: anon `SELECT` returned a real audit entry — despite migration 056's explicit, well-designed intent to make this table immutable and service-role-select-only; anon `INSERT` successfully forged a fabricated audit log entry.
- **`webhooks`**: anon `SELECT` returned a real webhook's signing **secret in full** — the single most severe individual finding in this batch, since a leaked signing secret allows forging webhook payloads.
- The remaining tables (mostly empty) were confirmed structurally open (`HTTP 200`, no permission error) via the identical grant shape already proven exploitable in migrations 077 and 080.

## 2. Why the app doesn't already prevent it

Same as prior findings: `data-proxy.js` (service-role key) is the real, intended path and isn't affected by anon/authenticated grants. `cms_audit_logs` and `gdpr_requests` additionally carry an **explicit** `"Allow anon read on X"` + `"Allow authenticated full access on X"` policy pair from migration 015 — a deliberate, blanket decision applied across a batch of tables during an early localStorage-migration phase, long before the later per-table hardening effort (migrations 052/056/077+). This directly contradicts migration 056's later, more careful design for `cms_audit_logs` (service-role-only, immutable) — a real conflict between two migrations' intents, not just an omission.

## 3. Browser-side dependency check

Found **one real, working exception**: `judge-login.html` creates its own Supabase client and, after a real sign-in, queries `user_roles` directly (`SELECT`, filtered to the current session's own email) to gate access to the judge portal. `judge-portal.js`'s own `user_roles` read goes through `apiClient` (server-side, unaffected). No other file among these 27 tables has any direct browser-side Supabase dependency (confirmed via full-codebase grep).

## 4. Fix applied — `migrations/084-harden-sensitive-table-subset-rls.sql`

Categorized by each table's **actual existing policy shape**, not a single assumed pattern — preserving, not redesigning, whatever intent already existed:
- **Category A** (12 tables, only the leftover policy existed): drop it, add the standard migration-052 `service_role_all` + `no_direct_client_access` pair.
- **Category B** (13 tables, already had a correct `<table>_select`/`<table>_auth` + `<table>_service` pair being silently cancelled by the leftover — the exact `event_guests`-shaped bug): drop **only** the leftover; the existing, already-correct policies need nothing added.
- **Category C** — `cms_audit_logs`: drop the 3 migration-000/015 leftovers, leave migration 056's already-correct hardening completely untouched. `gdpr_requests`: drop its 3 leftovers, then add the standard 052 pattern (no other hardening existed for it).
- **Category D** — `user_roles`: drop the leftover, add a **row-ownership** `SELECT` policy reusing the existing `user_email()` helper (`email = user_email()`) — the same pattern already used by `entries_update` — so each authenticated user can read only their own role row, exactly what `judge-login.html` needs and nothing more, plus the standard `service_role_all`.

Applied to Claude TEST CMS; re-ran a second time with no errors (idempotent).

## 5. Verification

| Check | Result |
|---|---|
| Final policy state | Every table shows exactly its intended set — no leftovers remain (confirmed via full `pg_policies` re-query) |
| anon `SELECT` on `user_roles`/`sponsor_contracts`/`gdpr_requests`/`cms_audit_logs`/`webhooks` | All now `[]`, despite real rows genuinely still existing (confirmed via service-role re-read) |
| anon `INSERT` forgery re-attempt on `cms_audit_logs` | Blocked: `HTTP 401`, `42501 row-level security policy violation` |
| Spot-check Category A (`ip_blocklist`) and B (`organisation_notes`, `contact_segments`) | All now `[]` |
| Real test user (`authenticated`, `editor` role) reads **own** `user_roles` row | Succeeds — exactly matches `judge-login.html`'s query shape |
| Same user attempts to read the **admin's** row | Blocked — returns `[]` |
| Same user does an unfiltered `SELECT *` on `user_roles` | Returns **only their own row**, not all rows — confirms true row-level scoping, not just query-level filtering |
| service-role full `user_roles` access (simulates `data-proxy.js` admin user management) | Still works, returns both real rows |
| Affected Jest suites (`rbac`, `judge-portal`, `crm`, `gdpr`, `document-management`, `entry-revision`, `organisations`, `webhooks`, `ai-vetting`, `marketing`) | 10 suites, 1388 tests, all pass |
| Full test suite / lint / build | 68 suites, 6474 passed (3 pre-existing skips), lint clean, build clean |

## 6. Data restored

All test rows (sponsor + contract, GDPR request, audit log entries, webhook, both test `user_roles`/`auth.users` entries) deleted and confirmed gone. Final snapshot is byte-identical to the corrected baseline established in migrations 082/083's reports.

## Conclusion

**Confirmed, not a false positive** — this batch contains the single most severe individual finding of the entire risk-assessed list (`webhooks.secret`), plus a genuine conflict between two historical migrations' intents on `cms_audit_logs`/`gdpr_requests`. The one real browser dependency (`judge-login.html`) was handled with a least-privilege, pattern-reusing restore rather than a blanket lockdown. Moving to the final finding (`table_assignments`) as its own separate investigation.
