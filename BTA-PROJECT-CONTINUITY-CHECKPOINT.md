# BTA CMS — Project Continuity Checkpoint

**Purpose:** a single, quickly-readable snapshot of exactly where this project stands, for safely resuming work in a future Claude session. This supplements, and does not replace, `BTA-CMS-PROJECT-TASKS.md` (the full, detailed historical record) and `CLAUDE.md` (durable project rules). Read this file first for orientation; consult the full task sheet for detailed evidence on any specific point.

## 1. Checkpoint date

2026-11-02 (written by BTA-083, covering completed work through BTA-082).

## 2. Current branch and HEAD

- Branch: `claude/supabase-cms-setup-test-e6oiza`
- HEAD: `fd2e14522d2259c3cd0ceb73176e65db1096ec81`
- This commit and branch have been unchanged since BTA-074. **Every BTA task from BTA-074 through BTA-083 has produced only local, uncommitted changes.** Nothing described in this document has been committed, pushed, or deployed.

## 3. Staged, unstaged and untracked state

- **Staged: 0 files**, throughout this entire project history since the last commit.
- **Unstaged (modified): 56 files** — see `git status --short` for the exact list; spans work from many prior BTA tasks across almost every area of the application (API handlers, frontend modules, HTML pages, tests, documentation).
- **Untracked: 18 files**, specifically:
  - `become-a-sponsor-packages.js`, `public-site-settings.js` (new frontend modules)
  - `migrations/087-harden-sponsorship-opportunities-rls.sql`
  - `migrations/088-harden-remaining-046-grant-array-tables.sql`
  - `migrations/089-secure-gdpr-erasure-rpc.sql`
  - `migrations/091-sponsorship-catalogue-packages.sql`
  - `migrations/092-fix-anonymize-organisation-return-contract.sql`
  - `migrations/093-harden-remaining-permissive-policy-tables.sql`
  - `tests/areas-manager.test.js`, `tests/become-a-sponsor-packages.test.js`, `tests/data-proxy-user-management.test.js`, `tests/home-data.test.js`, `tests/home.test.js`, `tests/location.test.js`, `tests/migration-093.test.js`, `tests/public-site-settings.test.js`
- **Total: 74 changed entries.** Verify this with `git status --short | wc -l` before trusting this number — it is a snapshot, not a guarantee, and the next session must re-verify rather than assume.
- BTA-003's homepage cleanup (`home-blue*.html`, `home2.html`, `home2.js`) is confirmed **absent** (correctly removed) as of this checkpoint.

## 4. Completed task history through BTA-082 (summary)

Full detail lives in `BTA-CMS-PROJECT-TASKS.md`, Sections A through T. High-level arc:

- **Early tasks (BTA-001 through ~BTA-070):** established project continuity practices, recovered lost task history from session transcripts, did extensive local code/security/UX audits, removed Northern Ireland from all geographic code (permanent business decision), built the sponsorship catalogue architecture, closed numerous CMS content-management gaps.
- **BTA-073/074:** production-readiness and database-reconciliation pass; found and fixed the GDPR CRM table-name bug (`crm_communications`/`crm_deals`/`crm_meetings` never existed — canonical names are `communications`/`deals`/`meeting_notes`) and other workflow defects; authored migrations 087/088/089/091.
- **BTA-075:** pure read-only review of migration 089 — found it correctable but not yet correct.
- **BTA-076:** fixed migration 089 (VOID→TEXT return contract, correct table names, search_path) and the corresponding `gdpr.js` export/erasure logic; added regression tests.
- **BTA-077:** broader CMS audit; found and fixed the identical VOID-return bug in `anonymize_organisation` (authored migration 092); fixed two minor error-message-leak inconsistencies; four parallel investigation forks found the rest of the CMS (entry/CRM/awards/taxonomy/CMS-content/sponsorship/admin-security/build-config) essentially sound, surfacing only two new open business-decision items (award eligibility enforcement, duplicate-entry-per-award prevention).
- **BTA-078:** first live, read-only connection to **production** — confirmed migrations 087/088/089/091/092 all unapplied, and found a serious, previously-undocumented live exposure: `organisations`, `organisation_contacts`, `gdpr_requests`, `entries`, `award_assignments`, `invoices`, `payments`, `award_years`, `event_guests` all fully open to `anon`/`authenticated` via a leftover permissive policy, traced to migration 052 never having been applied.
- **BTA-079:** exhaustive re-verification of all 32 affected tables (BTA-078's 9 plus migration 088's 22) with no sampling; confirmed `anonymize_organisation` directly callable by the public `anon` key; found migration 052 itself is defective (never drops the original permissive policy) and conflicts with migration 045's different intended design for the same 5-6 tables.
- **BTA-080:** authored the corrective migration, `migrations/093-harden-remaining-permissive-policy-tables.sql`, resolving the 045-vs-052 conflict with fresh evidence (zero legitimate app dependency found); added 40 static structural tests (`tests/migration-093.test.js`).
- **BTA-081/082:** attempted to verify migration 093 against the test project; found its database connection unreachable (timing out) despite the control plane reporting healthy, across both tasks; one correctly-scoped wake/restore request was made and did not restore connectivity.
- **BTA-083 (this checkpoint):** no new investigation — preserves and indexes the above.

## 5. Important architecture and business rules (durable, do not re-litigate)

- **Northern Ireland is permanently excluded** from geographic coverage (England/Scotland/Wales only) — settled business decision, do not reintroduce.
- All application data access is meant to route through two service-role-backed serverless proxies: `api/data-proxy.js` (admin/authenticated operations) and `api/entry-proxy.js` (public operations). Both connect to Supabase with `SUPABASE_SERVICE_KEY` exclusively, never the anon key.
- The only legitimate **direct browser-side** Supabase table/RPC access anywhere in the repository is `check-in-app.js`'s use of `events` (read) and `event_guests` (read+update), for the deployed staff Event Check-in tool. This is deliberate and already correctly scoped by migrations 078+079.
- Canonical CRM table names are `communications`, `deals`, `meeting_notes` — never `crm_communications`/`crm_deals`/`crm_meetings` (those never existed; the GDPR code used to reference them incorrectly, fixed in BTA-076).
- Vercel Hobby plan: hard limit of 12 serverless functions in `/api/` (not `/api/_lib/`) — confirmed still exactly at 12/12 as of BTA-077.
- `gdpr_requests.status` has a DB-level CHECK constraint permitting only `pending`/`processing`/`completed`/`rejected` — no `failed` status exists; failed processing reverts to `pending`.
- `gdpr_requests.request_type` has a DB-level CHECK constraint permitting only `export`/`delete`/`anonymize`.

## 6. Migration inventory and application status

**None of the following have been applied to any Supabase project (production or test).** All are locally authored, reviewed, and (where noted) test-covered only.

| Migration | Purpose | Local status | Live status |
|---|---|---|---|
| 087 | Lock down `sponsorship_opportunities` RLS/grants | Authored, reviewed, no code dependency | Not applied (confirmed live on production, BTA-078) |
| 088 | Lock down 22 tables' RLS/grants (migration 046's grant-array leftovers) | Authored, reviewed | Not applied (confirmed live on production, BTA-078) |
| 089 | `erase_organisation_gdpr` RPC — corrected to `RETURNS TEXT`, fixed table names, search_path pinned | Authored, corrected (BTA-076), `gdpr.js` updated and tested | Function does not exist on production (BTA-078) |
| 091 | New `sponsorship_catalogue_packages` table | Authored, reviewed, app-side wiring confirmed correct | Table does not exist on production (BTA-078) |
| 092 | `anonymize_organisation` RPC — corrected to `RETURNS TEXT`, EXECUTE revoked from anon/authenticated/PUBLIC | Authored (BTA-077), `gdpr.js` updated and tested | Live function is still the old, unrevoked, `RETURNS void` version (BTA-078) — **confirmed currently callable by the public anon key** |
| 093 | Lock down `organisations`/`organisation_contacts`/`gdpr_requests`/`entries`/`award_assignments`/`invoices`/`payments`/`award_years` RLS/grants; deliberately excludes `event_guests` | Authored (BTA-080), 40 static tests passing | Not applied; **not yet verified against any live database at all** — test-project connectivity blocked (see Section 7) |

**Proposed application order** (from BTA-080's assessment, not yet actioned): 093 → 087 → 088 as one group (closes the permissive-policy exposure), 089 → 092 as a second group (function-contract fixes), 091 independently (additive, no dependency on the others). All should go to the **test project first**, never production first.

## 7. Current Supabase support blocker

- **Test project:** `Claude TEST CMS > Website`, project ID `htcsewpztvxafksdzuhp`, region `eu-west-1`.
- **Production project:** `british-trade-awards-cms`, project ID `qdzyknercdqwhwijbcxf`, region `eu-west-2`. **Never touched for writes** by any task in this series beyond read-only inspection (BTA-078/079) and one `restore_project` call made against production specifically in BTA-012, long before this security-work sequence began.
- The test project's Postgres connection has returned `"Connection terminated due to connection timeout"` on every query attempt across BTA-078, BTA-079, BTA-081, and BTA-082, despite the Supabase control plane (`get_project`/`list_projects`) consistently reporting `status: "ACTIVE_HEALTHY"`.
- A correctly-scoped `restore_project` call was made against the test project only during BTA-081. The platform's response: *"This project is no longer in a paused state, it is ACTIVE_HEALTHY, it may take a while to fully restore. Please open a ticket at https://app.supabase.com/support/new if you have been waiting more than 30 minutes."* A connectivity check immediately after, and again in BTA-082, still failed identically.
- A Supabase support ticket has been submitted describing this problem and identifying the test project by name and ID. A follow-up clarification concerning a 21–22 October project lifecycle incident is being added to the existing ticket.
- **Do not treat this as resolved.** No confirmation exists that Supabase has acted on or responded to the ticket. The next session must independently re-attempt a minimal read-only query (e.g. `SELECT 1`) against `htcsewpztvxafksdzuhp` and verify success before assuming connectivity has been restored.

## 8. Outstanding technical tasks

1. Re-attempt test-project connectivity (once there's reason to believe time has passed or the support ticket has been addressed) and, if successful, complete the BTA-081/082 baseline-inspection-then-apply sequence for migration 093.
2. Once 093 is verified on test: apply and verify 087/088 (same exposure class), then 089/092 (function contracts), then 091 (additive), each on test first.
3. After all are verified on test: a separate, explicitly-authorised decision and task to apply any of them to production.
4. The staging GDPR drill specified in BTA-077/BTA-079 (disposable test organisation, synthetic data, export/erasure/anonymise end-to-end through the real admin UI) — still not performed, blocked by the same test-project connectivity issue.

## 9. Outstanding decisions requiring approval (none resolved by BTA-078–083)

1. **Decision 18** — `winner_position` vs `placement` as the canonical results field. Open since early in this project; explicitly not to be resolved unilaterally.
2. **`winners.winner_name` retention** under GDPR erasure/anonymisation — whether it should be cleared, retained, or something else. Open business/legal decision.
3. **Backend award-eligibility enforcement** — currently, nothing server-side stops a direct API call from submitting an entry to an area/sector-mismatched award; the submit UI only *offers* matching awards. Whether this should be enforced server-side, and how strictly, is undecided.
4. **Duplicate-entry-per-award prevention** — nothing currently stops the same organisation submitting multiple entries to the same award/category beyond a per-email rate limit. Whether this should be restricted is undecided.
5. **Migration application timing** — whether/when to apply 087/088/089/091/092/093, and to which environment first, remains entirely your call, pending the test-project connectivity issue being resolved.

## 10. Recommended next action

Given the test project's connectivity is the single blocker preventing almost all further forward progress on the security work, the most useful next action is likely **outside this session's control**: checking the Supabase dashboard directly for the test project's actual status, or following up on the support ticket. Once connectivity is confirmed restored, resume directly at BTA-081/082's own procedure: verify identity → check connectivity → inspect baseline → apply migration 093 only if the baseline is as expected → verify the result. Do not skip the baseline-inspection step even if connectivity returns, since the project's state has not been positively confirmed since before it became unreachable.

## 11. Exact instructions for safely resuming this project

1. Read this file first, then `CLAUDE.md`'s "ACTIVE WORK" banners and the tail of `BTA-CMS-PROJECT-TASKS.md` (Section T onward) for full detail.
2. **Do not trust any state described above as current** — re-verify independently:
   - `git branch --show-current`, `git rev-parse HEAD`, `git status --short`, `git diff --cached --name-only` — compare against Section 2/3 above.
   - `mcp__Supabase__get_project` for both `htcsewpztvxafksdzuhp` and `qdzyknercdqwhwijbcxf` to re-check status.
   - A single minimal `SELECT 1` against the test project to check connectivity — do not loop if it fails; report and stop, as BTA-081/082 did.
3. Never apply a migration to production without it first being verified on the test project and separately, explicitly authorised for production.
4. Never commit, push, or stage anything without the user's explicit, task-specific instruction to do so — this has been the standing rule throughout this entire project's history, reinforced by every single task prompt in this series.
5. If resuming database security work specifically: start from Section 6 of this document (migration inventory) and Section 7 (the connectivity blocker) — do not re-derive the BTA-078/079 findings from scratch; they are already fully evidenced in `BTA-CMS-PROJECT-TASKS.md` Sections T.1–T.2.
