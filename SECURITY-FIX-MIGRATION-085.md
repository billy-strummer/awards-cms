# Security Fix — Migration 085 (table_assignments)

**Date:** 2026-07-22. Scope: Claude TEST CMS only. `british-trade-awards-cms` was not touched.

This is finding 6, the last of the risk-assessed "Must fix before launch" list, investigated and closed as its own complete unit.

## 1. Proof the vulnerability existed

`table_assignments` (event seating: `guest_name`, `company_name`, `dietary_requirements`, `notes`) had RLS enabled but only the original migration-000 `"Allow all access"` permissive policy.

Real anon-key REST calls against a real inserted row:
- anon `SELECT` returned real guest seating data including **dietary requirements (health-related data)** and internal VIP notes.
- anon `UPDATE` genuinely changed a real row's `seat_number` and `dietary_requirements` — confirmed via service-role re-read (`42, TAMPERED` → matched exactly), not just the echoed response body.

## 2. Why the app doesn't already prevent it

`events.js` and `seating-enhancements.js` manage `table_assignments` exclusively via `apiClient` (server-side proxy, service-role key) — confirmed via full-codebase grep. The gap is purely that RLS was never hardened past the migration-000 policy.

## 3. Browser-side dependency check

Found **one real, working exception**: `check-in-app.js` creates its own Supabase client and, after a real sign-in, reads `table_assignments` directly (`SELECT` only, filtered by `guest_id`, joined with `event_tables`) to show a checked-in guest's table assignment. No `INSERT`/`UPDATE`/`DELETE` anywhere in that file. This is the same shape of dependency as `event_guests` (migrations 078/079) — handled the same way, but since this feature only needs `SELECT` (unlike `event_guests`, which also needed `UPDATE` for the check-in action itself), only `SELECT` is restored here.

## 4. Fix applied — `migrations/085-harden-table-assignments-rls.sql`

Drop the leftover `"Allow all access to table_assignments"` policy; add `table_assignments_select` (`authenticated`, `SELECT`, `USING(true)`) plus the standard `service_role_all`. Applied to Claude TEST CMS; re-ran a second time with no errors (idempotent).

## 5. Verification

| Check | Result |
|---|---|
| Final policies | Exactly `table_assignments_select` (authenticated, SELECT) + `service_role_all` |
| anon `SELECT`/`UPDATE` re-attempt | Both blocked — `[]`; service-role re-read confirmed the row was genuinely unchanged (`seat_number` still `999`, not the attempted `1`) |
| Real test user (`authenticated`) `SELECT` (matches `check-in-app.js`'s exact need) | Succeeds |
| Same user attempts `UPDATE` (not needed by the feature) | Correctly blocked |
| Service-role full access (simulates `events.js`/`seating-enhancements.js` via `data-proxy.js`) | Still works |
| Affected Jest suites (`seating`, `events`, `ticket-management`) | 3 suites, 535 tests, all pass |
| Full test suite / lint / build | 68 suites, 6474 passed (3 pre-existing skips), lint clean, build clean |

## 6. Data restored

Test row and throwaway test user deleted. Final snapshot byte-identical to the corrected baseline.

## Conclusion

**Confirmed, not a false positive.** All 6 findings from the risk-assessed "Must fix before launch" list are now closed on Claude TEST CMS, each independently investigated, proven, fixed, and verified — no fixes batched together, and every browser-side dependency found (`event_guests` in the earlier pass, `judge-login.html`/`user_roles`, and `check-in-app.js`/`table_assignments` in this one) was restored with the minimum access the real feature actually needs, reusing existing patterns rather than inventing new ones.
