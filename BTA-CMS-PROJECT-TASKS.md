# BTA CMS — Project Task Sheet

> ## ⚠️ RECONSTRUCTED PROJECT RECORD — NOT THE RECOVERED ORIGINAL
>
> The original `BTA-CMS-PROJECT-TASKS.md` could not be located anywhere searched: current working tree (tracked, untracked, ignored), local git history on the current branch, GitHub code/commit/PR search across the repository, direct file lookups on `main`, the current branch's tip, and all 16 other `claude/*` branches on `origin`. It most likely existed only as an uncommitted local file in a container that was later recreated — the same failure mode that lost several local-only commits (see Section G).
>
> **This document is a reconstruction**, assembled from the surviving conversation record and fresh repository/GitHub checks performed while writing and later revising it. It is **not** a recovered copy of the original, may not match the original's structure or content, and some of the original's content may be permanently unrecoverable. Every factual claim is labeled **Verified**, **Previously reported**, or **Uncertain / decision required**.
>
> **Reconstruction date:** 2026-10-22. **Last revised:** 2026-10-22 (continuity-system update, this task).

---

## A. Project identity and architecture

**British Trade Awards CMS** — a web-based admin system for managing awards ceremonies, organisations, entries, judging, events, payments, email marketing, and CRM.

- **Repository:** `billy-strummer/awards-cms` — **Verified** (confirmed via `git remote -v` and GitHub API calls throughout this engagement).
- **Working branch:** `claude/supabase-cms-setup-test-e6oiza` — **Verified**.
- **Supabase project:** `qdzyknercdqwhwijbcxf` (name `british-trade-awards-cms`, region `eu-west-2`) — **Previously reported** (via `mcp__Supabase__get_project`). Live database status is currently **Uncertain** — see Section E/G.

**Technology stack** (per `CLAUDE.md`'s own self-description — **Verified as the document's content**, not independently re-audited feature-by-feature against the live codebase):
- Frontend: Vanilla JavaScript + Bootstrap 5 (single-page app)
- Backend: Supabase (PostgreSQL) + Vercel serverless functions (`/api/`, capped at 12 functions on the Vercel Hobby plan)
- Email: Resend API · Payments: Stripe · AI vetting: Anthropic Claude API
- Build: esbuild (`node build.js`) · Tests: Jest (`npm test`) · Deployment: Vercel

Distinguish: the architecture description reflects `CLAUDE.md`'s own content, read directly from the current checkout. It has not been independently re-verified feature-by-feature in this task.

---

## B. Permanent operating rules

Agreed working process for all subsequent tasks on this project (mirrored in `CLAUDE.md`'s "MANDATORY: Project Continuity Protocol" section — that file holds the permanent rule, this file holds the changing project state and history):

1. Read this task sheet (if present) and verify the actual current repository state — do not assume prior reports still hold without rechecking git state, branch, HEAD, and remote tips.
2. Work on exactly one approved, clearly scoped task at a time. Do not expand scope mid-task.
3. Prefer read-only, evidence-first investigation before any implementation. Propose a bounded plan and get explicit approval before writing code or migrations.
4. Run the relevant tests after any change and report the **exact** results (pass/fail counts, suite names) — never characterize untested work as verified.
5. Update this task sheet at the end of each task: work completed, files changed, tests actually run and their results, current git state, decisions made, risks identified, and the proposed next task.
6. Before stopping, report the current branch, HEAD, working-tree state, and explicitly whether any change is **local-only**, **committed locally**, or **committed and pushed** (see Section H for what each level actually guarantees).
7. **Never** commit, push, merge, rebase, rewrite history, restore/resume the Supabase project, or execute live migrations without explicit, task-specific approval. A general earlier approval does not carry forward to a new action.
8. **Never** mark a task complete unless the evidence directly supports that status.
9. If this task sheet is ever found missing, contradictory, or inconsistent with repository evidence, stop and report the gap — do not silently proceed as though project history is known from memory.
10. Preserve the existing substantive CMS roadmap (Section D's BTA-00x sequence) whenever updating this sheet — continuity administration must never silently replace, reorder, or simplify away the underlying project work.

---

## C. Current verified state

**Freshly re-verified for this task** (this is a live check, not carried forward from an older phase):

| Item | Value | Status |
|---|---|---|
| Branch | `claude/supabase-cms-setup-test-e6oiza` | **Verified**, this task |
| HEAD | `3f3f2b02536f5b3f654751c3bf3d882d4b9af3a2` | **Verified**, this task |
| `origin/main` | `f58032dced1062b4f6e08c88245eb04b3edc0023` | Previously reported (not re-checked via `ls-remote` this task) |
| Working tree | `BTA-CMS-PROJECT-TASKS.md` staged as a new file (`A`); `CLAUDE.md` staged as a modification (`M`). Both uncommitted, unpushed | **Verified**, this task |
| Upstream branch | **None configured** (`git rev-parse @{u}` → "no upstream configured for branch") | **Verified**, this task — new finding, not previously recorded |
| Checkout | Shallow | Previously reported |
| PR #308 | Open, unmerged, `mergeable_state: dirty` **as of its last check only** — see Section G | Previously reported, not re-checked this task |
| Supabase live state | Unverified. Earlier reports said `INACTIVE` with connection timeouts; not rechecked since and not rechecked this task | **Uncertain** |

**Do not treat the un-"Verified-this-task" rows as current without re-checking at the start of the next task.**

---

## D. Task register and history

Three parallel workstreams exist on this project. They are related but distinct — do not collapse them into one narrative.

### D.1 — BTA-00x sequence (homepage/taxonomy workstream)

All BTA-00x commits below are known **only** as one-line commit-message subjects that I personally observed in this session's own `git log` output (captured in an earlier phase of this same conversation) — not from reading their diffs, and not from any task-sheet document. All are now confirmed **absent** from both this local (shallow) checkout and GitHub, via direct per-SHA lookups — the same unrecoverable fate as the six packages in D.2. Status descriptions beyond the bare commit subject are drawn from your own restatement of recovered external records (a saved September 25, 2026 reconciliation note and a saved BTA-005 audit document, both held in your ChatGPT Library, not visible to this or any other Claude session directly) — labeled accordingly.

| ID | Objective | Evidence found | Last evidenced status | Verified this session? | Outstanding |
|---|---|---|---|---|---|
| **BTA-001** | Make homepage public dates/countdowns CMS-driven from `award_seasons`, preserving existing date-selection and null-date logic | Commit subject `f05f3ac feat: wire homepage dates to award season` (observed in this session's own git log) | Previously reported (your restatement): implemented, with tests/lint/build passing at the time, under a fuller SHA you gave as `f05f3ac66e6c84…` — that fuller SHA could not be checked (GitHub resolves only `f05f3ac`, and finds nothing) | No — the commit is unrecoverable; current homepage date-handling code has not been freshly re-read in this session | Confirm current `home.html`/related JS actually implements this before assuming it's done or not done |
| **BTA-002** | Wire a website-stage control driven by `award_seasons.current_stage` | Commit subject `3cfa2a4 feat: add CMS website stage to award seasons` (observed in this session's own git log) | Previously reported (your restatement) only | No | Same — needs fresh code inspection |
| **BTA-003** | Remove orphaned homepage variants (`home-blue*`, `home2.html`, etc.) within an approved, restricted scope | Commit subject `8bca6a5 chore: remove orphaned homepage variants` (observed in this session's own git log) | Previously reported (your restatement) only | No | Needs a fresh check of whether those files still exist in the current checkout, and what the originally-approved scope boundary was |
| **BTA-004** | Decide the canonical category/sector taxonomy model | No commit — explicitly not implemented, by your own framing. Options on record: (a) CMS-only taxonomy, no hardcoded fallback; (b) CMS taxonomy + one hardcoded fallback/seed copy; (c) derive from `award_name` — rejected as problematic since `award_name` is free text | Not started | N/A | Blocked entirely on the Decision register (Section E) — **no user decision on record, per your own instruction not to assume one** |
| **BTA-005** | Audit duplicated category definitions, `custom_sectors`/`custom_categories`, `areas.is_small`, and schema/migration history | Commit subject `31012ca docs: record BTA-005 taxonomy architecture findings` (observed in this session's own git log) — the document itself is unrecoverable. **This session independently re-verified the audit's technical premise from current repository evidence** (not from the lost document): `scripts/award-categories-config.js:164` defines `SMALL_COUNTIES = ['Ceredigion', 'Herefordshire', 'Isle of Wight', 'Rutland']` (4 counties) **Verified**; `areas.is_small` is applied far more broadly on `main` per real, dated commit history (14 Scotland regions + 8 Wales areas + 14 London boroughs ≈ 36 areas, commit `d5ee4c2...`, Apr 29 2026) **Verified** | Previously reported as investigation-complete, decisions left open | Partially — see "Verified" notes above, plus the migration/schema comparison in Section F | The `areas.is_small` intent question (Section E, item 1) and the rest of Section E's open items |
| **BTA-006** | Read-only audit of the Award Areas feature and its CSV import (part of PR #308, never separately reviewed) | Two audit tasks performed this session, both read-only: feature/architecture audit, then a save-progress + follow-up-planning pass. See Section J for the full checkpoint. | Audit complete; **no fixes implemented**. 70/70 targeted tests (`tests/nominee-uploads.test.js`, `tests/organisation-matching.test.js`, `tests/data-proxy.test.js`) reproduced passing, local mocks only, no network/live DB. | Yes — this session, directly against current code | Three Risks (R1–R3) and four Minor findings (M1–M4) recorded in Section J; no fix authorised yet |

### D.2 — Package 1–6 git-recovery workstream (unrelated to BTA-00x's content, but the same loss pattern)

Six commits, each representing an attempt to recover functionality from an older migration lineage, were confirmed **absent** from both this local shallow checkout and GitHub (direct per-SHA API lookup, repeated across multiple phases with identical results):

| # | SHA | Reported purpose |
|---|---|---|
| 1 | `b5af369` | Organisation-matching recovery |
| 2 | `6827dbc` | Migration `070-add-missing-updated-at-columns.sql` (adapted) |
| 3 | `ec4fb42` | Migrations `071-a`/`071-b` (tenant_id columns + backfill) |
| 4 | `7eab93a` | Migrations `086`–`091` (RLS hardening) |
| 5 | `3f1414c` | Migrations `092`/`093` + `api/voting-proxy.js` + tests |
| 6 | `a831b63` | GDPR organisation-erasure fix (`gdpr.js` + tests) |

See Section G for full detail. **Do not reconstruct these from memory** — any replacement is new work requiring its own scoped review and tests.

### D.3 — PR #308 workstream

A large, already-pushed, unmerged pull request containing ~3 months of real accumulated work (organisation-matching fix plus many unrelated bundled changes). See Section G for full detail. **Not part of the BTA-00x sequence** — a separate body of work that happens to also touch organisation/area logic.

---

## E. Decision register

None of the items below have been decided by the user in any record available to this session. Listed in rough dependency order, not priority order unless marked.

1. **`areas.is_small` intent (highest priority / blocks BTA-004 and BTA-005's closure):** was the broad ~36-area `is_small=true` set a deliberate policy decision, or leftover/placeholder seed data unrelated to the 4-county `SMALL_COUNTIES` list the application logic actually uses today? Matters because adopting `is_small` as the live signal instead of `SMALL_COUNTIES` would change category-tier behaviour for dozens of real areas.
2. **BTA-004's canonical category model** — CMS-only / CMS + one hardcoded fallback / another model. Not decided.
3. **Category scope** — global, or area-/season-specific. Not decided.
4. **Schema reconciliation** between `migrations/058-missing-tables-and-columns.sql` and `database-sectors-categories.sql` for `custom_sectors`/`custom_categories` (see Section F for the full comparison). Blocked on (1)–(3) above being settled, and on live-schema verification once Supabase access is authorized.
5. **Fate of `scripts/award-categories-config.js` and `scripts/generate-awards.js`** — retain as seeding tools, or retire/change, once a model is chosen.
6. **Small-area category tiering representation** going forward, under whatever model is chosen.
7. **Certificate/shield download entitlements** — do contents vary by (a) award outcome (winner/top 3/finalist), (b) purchased package, or (c) a hybrid? No resolution found in any surviving record. Unrelated to the taxonomy decisions above.
8. **PR #308's fate** — merge as-is, split, replace, or close. Not decided; its `dirty` mergeability finding alone does not justify any of these (see Section G).
9. **Whether to rebuild any of the six missing Package commits** (Section D.2/G) as new, separately-reviewed work, and in what order.
10. **Whether/when to authorise resuming the Supabase project** — blocks item 4's live-schema verification and any other live check.
11. **Continuity-document persistence** — whether/when to commit and push this task sheet and the `CLAUDE.md` addition made in this task (immediate, administrative — see Section H).

---

## F. Evidence and validation

### F.1 — Migration/schema comparison: `migrations/058-missing-tables-and-columns.sql` vs. `database-sectors-categories.sql`

**Completed investigation, recorded here as evidence for BTA-004/BTA-005 — not a new project objective.** Both files were read in full; this is local file + current-codebase evidence only. **No Supabase connection was attempted and no SQL was executed.**

| Object | `migrations/058...sql` | `database-sectors-categories.sql` |
|---|---|---|
| `custom_sectors` | `id`, `name TEXT NOT NULL UNIQUE`, `description`, `is_active`, `created_at NOT NULL` (L143–149) | `id`, `name text NOT NULL` (uniqueness via separate `lower(name)` index, L22), `sort_order`, `is_active`, `created_at` nullable (L2–8) |
| `custom_categories` | `id`, `sector_id UUID REFERENCES custom_sectors(id)` (relational FK), `name`, `description`, `is_active`, `created_at NOT NULL` (L151–158) | `id`, `sector_name text NOT NULL` (free-text match, no FK — its own comment says it matches either a hardcoded sector *or* a `custom_sectors.name`), `name`, `available_for_small`, `sort_order`, `is_active`, `created_at` nullable (L11–19) |
| RLS | Enabled, 3 policies each (service_role/authenticated/anon) | None at all |

**Findings:**
- The two files define **incompatible shapes** for both tables — not additive variants. Because both use `CREATE TABLE IF NOT EXISTS`, whichever runs first on a given database fully determines the table's shape; the other's columns are never added.
- **Current application code was checked directly and conclusively prefers the `database-sectors-categories.sql` model**, not migration 058's: `api/entry-proxy.js:564` and `api/voting-proxy.js:392` `SELECT ... sector_name` (not `sector_id`); `awards.js:505`/`settings.js:1797` insert `custom_sectors` with `sort_order` (058 has no such column); `awards.js:556-561`/`settings.js:1914-1919` insert `custom_categories` with `sector_name`, `available_for_small`, `sort_order` (058 has none of these).
- The app's live small-area category filter (`submit-entry.js:577`, `submit-entry-payment.js:427`: `if (isSmall && !c.available_for_small) return;`) depends entirely on `available_for_small` — a column only `database-sectors-categories.sql` defines.
- The application code also conditionally inserts `country`, `region_id`, `area_id` on `custom_categories` (`settings.js:1914-1921`) — columns **neither file defines**. The live schema the app expects has evolved past both files on record, from a source not identified in this comparison.
- **Neither file should be run as-is.** Recommended (not applied): inspect live `information_schema.columns` for both tables first, then write one new migration reconciling to whatever the app code actually requires — which the file/code evidence points toward being closer to `database-sectors-categories.sql`'s model plus the undocumented `country`/`region_id`/`area_id` columns.
- **This comparison does not establish the live Supabase schema.** Which shape (058's, the other file's, or a third, undocumented one) is actually live is unknown without a fresh, authorized connection.
- **The `areas.is_small` policy question (Decision register item 1) is untouched by this comparison** and remains open.

### F.2 — Organisation-matching test evidence (PR #308)

677/677 tests passed across exactly four suites (`organisation-matching.test.js`, `entry-proxy.test.js`, `data-proxy.test.js`, `organisations.test.js`) during one specific prior check. Scoped strictly to those four suites and that run — does not establish the full project suite passes, that all 147 files in PR #308 are validated, or that live production behaviour has been verified. Not rerun in this task.

### F.3 — Change log

| Date | Change | Status |
|---|---|---|
| 2026-10-22 | Initial reconstruction. No original recovered; assembled from the surviving conversation record. Not committed. | RECONSTRUCTED |
| 2026-10-22 | Review pass: time-qualified the PR #308 `dirty` finding and the 677/677 test result; clarified the optional branch search as non-blocking; strengthened the Supabase status note. | VALIDATED (documentation only) |
| 2026-10-22 | Full 16-branch search for the original task sheet performed (per explicit authorisation) — found nothing on any of them. BTA-001–BTA-005 recovery attempted; underlying commits confirmed unrecoverable; `migrations/058` vs. `database-sectors-categories.sql` comparison completed (Section F.1). | INVESTIGATION COMPLETE (read-only) |
| 2026-10-22 | Continuity-system update (this task): restructured this document into the Section A–I register format; added the BTA-00x task register (Section D.1, previously missing entirely from this document); added the consolidated Decision register (Section E); moved the migration comparison into a dedicated Evidence section (F.1); added explicit Persistence-state (H) and "Start Here Next Session" (I) sections; added a mandatory continuity-protocol section to `CLAUDE.md`. No application code, tests, migrations, or database state touched. | DOCUMENTATION UPDATE (not committed) |
| 2026-10-22 | BTA-006 read-only audit of the Award Areas feature/CSV import (part of unreviewed PR #308 scope); added BTA-006 to Section D.1 and a full checkpoint as new Section J (findings R1–R3, M1–M4; 70/70 targeted tests reproduced passing, mocks only). Separate follow-up task then read-verified this same checkpoint, re-confirmed Git/PR state, and investigated R1–R3 further for a bounded next-task recommendation (see session report). No application code, tests, migrations, or database state touched; `CLAUDE.md` left untouched this task. | DOCUMENTATION UPDATE (not committed) |

---

## G. Git and recovery history

### G.1 — PR #308

`https://github.com/billy-strummer/awards-cms/pull/308`, titled *"Fix organisation-matching cross-area collision and ILIKE wildcard bugs"* — **a misleading title for its actual scope.** Open, unmerged. As of its last check (not re-verified this task), GitHub reported `mergeable_state: dirty`. This means only: GitHub detected a mergeability problem at that time; it does **not** establish conflict count/nature, does **not** mean the PR is unusable, and does **not** by itself justify merging, splitting, replacing, or closing it — any such decision needs a fresh reassessment against the then-current `main`.

At last check: 72 commits, 147 changed files, +9,541/−16,147 lines — roughly three months of accumulated branch work (migrations, Award Areas CSV import, judge-portal/mobile fixes, User Management, Vercel Cron automation, Sentry/OG-tag fixes, documentation suite), of which organisation-matching is only the latest addition. Never received human review. Has a disclosed legacy-data limitation: pre-fix organisations with `area_id IS NULL` won't be matched by the new area-scoped lookup, risking duplicates on resubmission (documented by the PR itself as a non-blocking follow-up).

**Unreviewed areas:** migration changes bundled in the PR; Award Areas/CSV import; judge portal/mobile fixes; User Management; Vercel Cron automation; security/operational docs; general compatibility with current `main`.

### G.2 — Missing recovery packages (Section D.2 detail)

Migration files that exist in the current checkout under the same or similar numbers (e.g. `070-add-missing-updated-at-columns.sql`, `071-add-missing-tenant-id-columns.sql`) are **confirmed by direct content comparison to be different files with different rationale and scope** than what the missing packages described — same filename never means same migration.

### G.3 — The September 25 reconciliation report and BTA-005 audit document

You identified that these exist in your own saved ChatGPT Library (`Pasted markdown(20260925-100034).md` and `Pasted markdown(7).md`), explaining why this session could not find them: **a file or report saved only in a ChatGPT conversation/Library is not visible to a Claude session inspecting this repository, and never was.** This is itself an important continuity lesson, not just a one-off gap — anything meant to survive for a future session must end up in this repository (committed and ideally pushed), not only in a chat transcript on a different platform. The report's central figure (local HEAD `31012cad010c386e68075d45897e7d95ea596be6`) does not exist as a git object in this repository today, by direct lookup, local and on GitHub — consistent with a real historical state that was simply never pushed before its container was lost, not with the report being fabricated.

### G.4 — BTA-00x commit subjects (Section D.1 detail)

`3cfa2a4`, `94bde57`, `f05f3ac`, `8bca6a5`, `31012ca` — all confirmed absent from this local shallow checkout and from GitHub by direct per-SHA lookup. Known only as one-line subjects personally observed in this session's own prior `git log` output.

---

## H. Persistence state

Three distinct levels, and what each actually guarantees for a **future, possibly-fresh** Claude session or container:

- **Working-tree only (uncommitted):** the file exists on disk right now but is invisible to `git log`/`git show` and **will be lost** if this container is recreated. This is the current state of both `BTA-CMS-PROJECT-TASKS.md` and the `CLAUDE.md` edit made in this task.
- **Committed locally:** the file is in this container's local git history, retrievable by `git show`/`git log` from this container — but a **new** container that only clones from `origin` will not have it, since nothing has been pushed.
- **Pushed to the intended remote branch:** retrievable by any future session that can access `origin/claude/supabase-cms-setup-test-e6oiza` (or wherever it's pushed), subject to normal remote availability/permissions.

**Current actual state, verified this task:** both `BTA-CMS-PROJECT-TASKS.md` and the `CLAUDE.md` continuity-protocol addition are **currently staged** (`git status`: `A BTA-CMS-PROJECT-TASKS.md`, `M CLAUDE.md`) — **not yet committed, not pushed**. No upstream branch is even configured for this branch (`git rev-parse @{u}` fails — "no upstream configured"), so a push would need an explicit target spelled out, not just `git push`.

**A report, summary, or task sheet described only in a chat conversation — on this platform or any other, including a ChatGPT Library — is not automatically available to a new Claude session**, exactly as Section G.3 just demonstrated in practice.

**Committing and pushing require your explicit authorisation, each time — not inferred from this task's instructions to "make documentation changes."**

---

## J. BTA-006 — Award Areas / CSV Import Safety Audit (checkpoint)

**Checkpoint date: 2026-10-22.** Two read-only tasks performed this session, both against the current `claude/supabase-cms-setup-test-e6oiza` checkout (= PR #308's head, `3f3f2b02536f5b3f654751c3bf3d882d4b9af3a2`). **No fixes have been implemented. This section records findings only.**

### J.1 — What was audited

The Award Areas bulk-CSV-nomination-import feature: `src/partials/03a-award-areas.html` (UI), `nominee-uploads.js` (frontend CSV parse/validate/upload orchestration), `api/data-proxy.js`'s `executeAwardAreaImport` (`award_area_import` operation, lines ~1315–1595) and its RBAC gate, `api/_lib/organisation-matching.js` (shared area-scoped matching helper — this PR's named security fix), `api/_lib/award-categories.js` (category allowlist), and the supporting migrations (`067`, `068`, `073`, `076`) and tables (`areas`, `organisations`, `award_years`, `entries`, `nominee_upload_batches`). This feature exists only on the PR #308 branch; it has **not** been separately merged into `main`.

### J.2 — What passed / was verified directly from code or a safe local run

- `award_area_import` requires an authenticated session (`verifyAuth`) and `editor` role or above, for both `validate` and `import` modes — confirmed from `api/data-proxy.js`'s handler dispatch order.
- `api/_lib/organisation-matching.js` escapes ILIKE wildcard characters (`%`, `_`, `\`) and returns `null` rather than matching globally when no `areaId` is resolvable — confirmed by direct code reading and by the one test that exercises the full validate→import path.
- `mode: 'import'` always re-validates server-side before writing — the client's own validation result is never trusted.
- A hard 2,000-row-per-call input limit is enforced.
- Unknown award categories are rejected as validation errors; they are never auto-created. Only `award_years` records are found-or-created per category+area+year.
- **Targeted test run reproduced this session:** `npx jest tests/nominee-uploads.test.js tests/organisation-matching.test.js tests/data-proxy.test.js` → **70/70 passed**, local mocks only, no network access, no live database connection. No file, test, migration, or git state was changed by running this.

### J.3 — What remains risky (not fixed — findings only)

- **R1 — No reliable undo for a completed import.** The audit-trail write (`nominee_upload_batches`) records a batch summary (filename/area/counts) only — it does not record which specific `organisations`/`entries` rows that batch created. The older `nominee_delete_all` operation deletes from a different table pair (`nominee_upload_rows`/`nominee_upload_batches` rows written by the *legacy* pipeline) and does **not** undo an Award Areas import.
- **R2 — A failed import can leave partial writes.** Each row's writes are sequential, unwrapped Supabase calls with no transaction; the frontend additionally splits large files into 25-row chunks. A failure partway through a row, or in a later chunk, leaves every already-processed row (and every already-completed chunk) already committed and already publicly visible — there is no rollback.
- **R3 — Two similar nominee-import pipelines coexist.** The older staging-table pipeline (`executeNomineeUpload` / `nominee_upload` operation / `nominee_delete_all`, backed by `database-nominee-uploads.sql`) was checked by grep across all `.js`/`.html` files in the repository and has **no frontend callers anywhere**. The live pipeline is `award_area_import` only. The dead pipeline's delete-all should not be mistaken for an Award Areas undo mechanism (see R1).

### J.4 — Other findings (minor; not fixed)

- **M1:** Migration 073's own comment states `database-nominee-uploads.sql` "was never actually checked into this repo" — that file exists and was read directly this session. Harmless (073 only does idempotent `ADD COLUMN IF NOT EXISTS`), but the comment itself is wrong.
- **M2:** `migrations/058` and `database-nominee-uploads.sql` define **incompatible shapes** for `nominee_upload_batches`/`nominee_upload_rows` (same `CREATE TABLE IF NOT EXISTS` conflict pattern as the `custom_sectors`/`custom_categories` finding from BTA-005/Section F.1). Migration 073 patches in the columns the live code needs regardless of which base won — very likely fine in practice, but **the actual live schema was not checked this session** (no Supabase connection was made, per task boundaries) and remains unverified.
- **M3:** Existing automated tests do not cover: duplicate-row detection within one CSV, unknown-category rejection via `resolveCategory`, email-format validation, the award found-or-create branch, sequential entry-number generation, any of the three `duplicateStrategy` (skip/update/replace) branches' actual field-merge behaviour, the audit-trail insert, or a multi-row validate→import round trip. The only end-to-end test covers the ILIKE-escaping/area-scoping fix specifically, not the feature's broader business logic.
- **M4:** Area-type labelling has no explicit Northern Ireland handling — already tracked in PR #308's own `POST-PHASE-1-FOLLOW-UP.md` as a pending business decision, not a new finding.

### J.5 — Recommendation on record

**Investigate the import-safety gaps (R1/R2 particularly) and improve confidence before processing the remaining large volume of county workbooks.** The feature is **not** described as fixed, approved for wider use, or deployed by this checkpoint — only audited. Any implementation remains subject to its own separate authorisation.

### J.6 — Verified Git/worktree state at this checkpoint

Re-verified fresh at the start of this task (not carried forward):

| Item | Value |
|---|---|
| Branch | `claude/supabase-cms-setup-test-e6oiza` |
| HEAD | `3f3f2b02536f5b3f654751c3bf3d882d4b9af3a2` (unchanged) |
| `origin/main` | `f58032dced1062b4f6e08c88245eb04b3edc0023` |
| `origin/claude/supabase-cms-setup-test-e6oiza` | `3f3f2b02536f5b3f654751c3bf3d882d4b9af3a2` (matches local HEAD) |
| PR #308 | Open, unmerged, `mergeable_state: dirty` (re-checked fresh) |
| Staged | `BTA-CMS-PROJECT-TASKS.md` (A, this file, now being edited further in this same task), `CLAUDE.md` (M) — unchanged by this task except this document's own edit |
| Unstaged | `api/entry-proxy.js`, `build.js`, `home.html`, `home.js`, `scripts/award-categories-config.js`, `tests/entry-proxy.test.js` (M); `home-blue.html`, `home-blue1.html`, `home-blue2.html`, `home-blue3.html`, `home2.html`, `home2.js` (D) — **all four pre-existing change sets (continuity docs, BTA-003, BTA-004A, BTA-001B) confirmed present and byte-for-byte unchanged this task** |

No application code, test, migration, or SQL file was touched this task. No staging/unstaging, commit, push, merge, rebase, or Supabase connection occurred.

---

## I. START HERE NEXT SESSION

**Immediate next step:** review this checkpoint (Section J) and the proposed next bounded task (reported alongside this edit, covering R1/R2 investigation and a recommended implementation scope) and tell me whether to authorise it. Separately, decide whether to commit/push the now-updated `BTA-CMS-PROJECT-TASKS.md` (staged) and `CLAUDE.md` (staged, untouched this task) — both remain **staged but not committed or pushed**.

**Next substantive CMS step (strongest evidence-supported candidate, not yet approved):** either (a) the Award Areas import-safety follow-up proposed in Section J/this task's report, or (b) resolving Decision register item 1 (`areas.is_small` intent) — both are independent and either could go first; neither is approved yet.

**Do not, without separate explicit authorisation each time:** commit or push anything; resume/restore Supabase; execute any SQL or migration; merge/rebase/split/close PR #308; rebuild any of the six missing recovery packages or the BTA-001–003 work; implement any Award Areas fix (R1/R2/R3 or otherwise); or make the `is_small`/category-model/certificate-entitlement product decisions on the user's behalf.
