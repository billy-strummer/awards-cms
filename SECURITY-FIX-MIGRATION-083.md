# Security Fix — Migration 083 (View RLS Bypass via missing security_invoker)

**Date:** 2026-07-22. Scope: Claude TEST CMS only. `british-trade-awards-cms` was not touched.

This is finding 4 of the risk-assessed "Must fix before launch" list, investigated and closed as its own complete unit.

## 1. Proof the vulnerability existed

All 15 views in the public schema had `reloptions IS NULL` — no `security_invoker` set — meaning every one ran with the view owner's privileges on `SELECT`, not the querying role's.

Real anon-key REST calls, executed live:
- Direct `SELECT` on `organisations` correctly returns `[]`, but `organisations_with_stats` and `organisations_with_crm_summary` (views over the same table) returned real company names, contact names, emails, and phone numbers.
- Direct `SELECT` on `activity_logs` is authenticated-only, but the `activity_log` view returned real audit trail entries including an admin's email address and action details.
- **Most concretely**: `event_guests` was hardened in migration 079 to fully block anon (re-confirmed here: a fresh, real test guest's direct `SELECT` via anon correctly returned `[]`) — but `running_order_full` (a view joining `running_order` + `event_guests`) returned that same guest's real name and email to anon anyway, completely undoing that fix for anyone querying the view instead of the table directly.

**Two of the 15 (`awards`, `awards_with_stats`) turned out not to be part of the real vulnerability**, discovered during this investigation: their base table, `award_years`, has a deliberate `award_years_anon_select` policy (`roles={anon}`, `USING(true)`) — award categories are intentionally public for the voting/nominee-browsing pages. Confirmed direct `award_years` `SELECT` already returns real data to anon before any fix. Fixing these two views is still correct for consistency and costs nothing, but doesn't change what anon can already see — flagging this explicitly rather than overstating the finding.

## 2. Why the app doesn't already prevent it

PostgreSQL views default to running with the view creator's privileges, not the caller's, unless `security_invoker = true` is set explicitly. Nothing in application code can change this — it's a database-level default each view has to opt out of individually.

## 3. Browser-side dependency check

The real app reads all 15 views exclusively through `/api/data-proxy` (service-role key, which bypasses RLS regardless of `security_invoker`) — same routing already confirmed for findings 1–3. Enabling `security_invoker` only changes behavior for roles actually subject to RLS (anon/authenticated querying directly); it has no effect on `service_role`, so no real feature is affected.

## 4. Fix applied — `migrations/083-enable-security-invoker-on-views.sql`

`ALTER VIEW ... SET (security_invoker = true)` on all 15 views. Applied to Claude TEST CMS; re-ran a second time with no errors (idempotent — re-setting an already-set option is a no-op).

## 5. Verification

| Check | Result |
|---|---|
| View options after fix | All 15 confirmed `reloptions: ["security_invoker=true"]` |
| anon `organisations_with_stats` / `organisations_with_crm_summary` / `activity_log` | All now `[]` |
| anon `running_order_full` for the real test guest | Row still returned (the base `running_order` table isn't yet hardened — separate, already-tracked finding), but `guest_name`/`guest_email` are now correctly `null` — the specific PII leak through the joined, protected `event_guests` table is closed |
| anon `awards`/`awards_with_stats` | Still return real data, as expected — confirms the fix didn't touch the two views that were never actually part of the vulnerability |
| service-role reads of `organisations_with_stats` and `running_order_full` (full guest PII intact) | Both still work correctly, `HTTP 200` |
| Affected Jest suites (`organisations`, `crm`, `dashboard`, `reporting`, `events`, `seating`, `media-gallery`, `media-gallery-new`, `email-lists`, `awards`) | 10 suites, 2176 tests, all pass |
| Full test suite / lint / build | 68 suites, 6474 passed (3 pre-existing skips), lint clean, build clean |

## 6. Data restored — plus another incidental correction to the tracked baseline

Deleted the test `running_order` row and this session's test `event_guests` row. While doing so, also found and deleted an **older orphaned `event_guests` row from a previous session** (id `eb6bdbc3-...`, explicitly labeled in its own `notes` field: *"post-fix verification row — will be deleted"* — but never was). This means the `event_guests: 1` baseline tracked since the start of this investigation was itself already-stale debris. The corrected, verified-clean baseline is `event_guests: 0`; all subsequent snapshots use this corrected value. (This is the second such incidental cleanup this pass — see migration 082's report for the first, a stray `user_roles`/`auth.users` pair. Both were caught by re-verifying via service-role reads rather than trusting apparent state, consistent with this engagement's established methodology.)

## Conclusion

**Confirmed, not a false positive**, for 13 of the 15 views. The remaining 2 (`awards`/`awards_with_stats`) are a **partial false positive** relative to the original sweep's framing: they share the same missing-`security_invoker` gap, but their base table is already intentionally public, so there was no real incremental data exposure to correct — noted transparently rather than silently fixed and left unexplained. Fix applied to all 15 regardless (correct and free to do), verified working, real app unaffected. Moving to the next finding (sensitive 80-table subset) as its own separate investigation.
