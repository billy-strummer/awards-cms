# Security Fix — Migration 080 (Vote & Judging Integrity Tables)

**Date:** 2026-07-22. Scope: Claude TEST CMS only. `british-trade-awards-cms` was not touched.

This is finding 1 of the risk-assessed "Must fix before launch" list, investigated and closed as its own complete unit before starting any other finding.

## 1. Proof the vulnerability existed

`public_votes`, `judge_scores`, `shortlists`, `winner_documents`, `winner_media`, `deliberation_notes` all had RLS **enabled** but only the original migration-000 policy (`"Allow all access to X"`, `FOR ALL`, `roles={public}`, `USING (true)`, `WITH CHECK (true)`), plus standard `anon`/`authenticated` grants.

Inserted a real row into each table via service-role, then confirmed with the real anon key:
- **Read**: anon `SELECT` returned every real row on all 6 tables, including a `winner_documents` row explicitly flagged `is_public: false` — proving that flag is enforced only in application UI, not the database.
- **Write**: anon `INSERT` into `public_votes` succeeded (`HTTP 201`, real row created) — an unauthenticated ballot-stuffing vector that completely bypasses `voting-proxy.js`'s IP/email rate-limiting and duplicate-vote checks. anon `UPDATE` on `judge_scores` returned `HTTP 200`; a service-role re-read confirmed `total_score` had genuinely changed from `42` to `100` in the real row — direct tampering with blind judging scores, not just an echoed response.

## 2. Why the app doesn't already prevent it

`voting-proxy.js` and the judge portal (via `apiClient` → `/api/data-proxy`) are the intended access paths, both server-side using the service-role key, and both do enforce real validation/rate-limiting in application code. But none of that is backed by a database-level policy — a request that skips the proxy and calls the Supabase REST API directly with the public anon key hits the leftover permissive policy with nothing to stop it.

## 3. Browser-side dependency check

Grepped every frontend file for direct `supabase.createClient()`/`.from()` usage against these 6 tables. Found none. `nominee-voting.js`/`public-voting.js` only read `entries.public_votes` (a denormalized counter column on a different table, unaffected by this migration). `judge-portal.js` reads/writes `judge_scores` exclusively via `apiClient`, confirmed (via `utils.js`) to route through `/api/data-proxy` server-side. **No feature depends on direct browser access to any of these 6 tables** — unlike `event_guests`, no follow-up "restore access" migration was needed.

## 4. Fix applied — `migrations/080-enable-rls-vote-judging-integrity-tables.sql`

Same underlying bug shape as `event_guests` (migration 078), not `email_logs` (migration 077): RLS was already enabled with a leftover permissive policy still present, which would have silently defeated a migration-077-style "just add restrictive policies" fix (Postgres ORs permissive policies together). The migration therefore:
1. Drops the obsolete `"Allow all access to X"` policy on each table.
2. Adds `service_role_all` (`FOR ALL USING (auth.role() = 'service_role')`) and `no_direct_client_access` (`FOR ALL USING (false)`), matching the migration-052 pattern, in an idempotent `DO $$...EXCEPTION WHEN duplicate_object$$` block.

Applied to Claude TEST CMS. Re-ran the same migration a second time with no errors (idempotent).

## 5. Verification — re-ran the exact same exploits

| Check | Result |
|---|---|
| anon `SELECT` on all 6 tables | `[]` on every table, despite real rows genuinely still existing (confirmed via service-role re-read) — true RLS filtering, not an empty-table coincidence |
| anon `INSERT` ballot-stuffing attempt on `public_votes` | Blocked outright: `HTTP 401`, `42501 row-level security policy violation` |
| anon `UPDATE` tamper attempt on `judge_scores` | `HTTP 200` with `[]`; service-role re-read confirmed `total_score` was still `100`, not the attempted `999` — genuine no-op, not a misleading success response |
| service-role real workflow: `voting-proxy.js`-style insert + `increment_entry_public_votes` RPC | Both succeeded (`201`, `204`) |
| service-role real workflow: judge-portal-style `judge_scores` upsert | Succeeded (`201`) |
| Affected Jest suites (`voting-proxy`, `nominee-voting`, `judge-portal`, `judge-automation`, `winner-pipeline`) | 5 suites, 324 tests, all pass |
| Full test suite / lint / build | 68 suites, 6474 passed (3 pre-existing skips), lint clean, build clean |

## 6. Data restored

All test rows (service-role-inserted sec-test rows, the pre-fix anon ballot-stuffing row, the real-workflow-simulation rows) deleted; the `entries.public_votes` counter bumped by the RPC test reverted to `0`. Final snapshot (`organisations, entries, award_years, winners, areas, user_roles, public_votes, award_seasons, judge_scores, shortlists, event_guests, table_assignments`) is byte-identical to the pre-test baseline.

## Conclusion

**Confirmed, not a false positive.** This was the single highest-severity item on the risk-assessed list — direct manipulability of vote counts and blind judging scores via the public anon key. Now closed. Moving to the next finding (email relay functions) as its own separate investigation.
