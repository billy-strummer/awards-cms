# BTA CMS Roadmap — Execution Checklist

**This is the active, cross-session execution checklist for finishing the British Trade Awards CMS as a commercial-grade platform.** It is referenced from `CLAUDE.md` and `BTA-CMS-PROJECT-TASKS.md` as the standing source of truth for *what's next*; those two files remain the authoritative record of *what already happened* (decisions, evidence, git/recovery history). Check items off (`[x]`) and update the Status Log in the same commit as the work that completes them.

**A note on evidence, carried over from this project's standing continuity protocol:** items below that are genuinely new, unscoped feature work (most of Phase 1–3) are written as outcomes and known starting points, not as a settled technical spec — several explicitly say "target files/approach: TBD, needs investigation" rather than guessing at a design before anyone has looked at the relevant code. Treat those lines as honest gaps to fill in during that item's own session, not as oversights.

**Prior work, not re-logged here:** substantial related work already merged into `main` before this roadmap existed — the nominee-upload pipeline audit, London-borough public/admin sync, the bulk-upload Award Year selector, the `winners.access_token` public-API leak fix, migrations 093/095/096, and the 4-way `feature/safe-reconciliation` split (PRs #361–#365). Full history for that work is in `BTA-CMS-PROJECT-TASKS.md` Sections II–III, not duplicated here.

---

## Status Log

| Date | Item | Status | Branch / PR | Notes |
|---|---|---|---|---|
| 2026-11-24 | Roadmap created | Done | this commit | Initial version of this file. |
| 2026-11-24 | 0.1 Award Areas UX Overhaul | **Done — merged to `main`** | [#366](https://github.com/billy-strummer/awards-cms/pull/366) (merge commit `9233abf`) | Merged per explicit authorization. Branch `claude/award-areas-ux-overhaul` deleted locally; remote delete blocked by a 403 from this session's egress proxy (policy denial, not retried) — remote branch may still exist on `origin`, harmlessly, since its content is fully merged. |
| 2026-11-24 | 0.2 Cross-Screen Admin UI/UX Polish | **Done — merged to `main`** | [#367](https://github.com/billy-strummer/awards-cms/pull/367) (merge commit `e462eb4`) | See full evidence in `BTA-CMS-PROJECT-TASKS.md` Section V. Could not verify a literal "¢" character or a "stale timestamp" header badge anywhere in source (exhaustive grep); fixed the concrete, verified bugs found instead — see Section V for the discrepancy report. |
| 2026-11-24 | 0.3 Fix Admin Data Load Errors | **Done (with honest limits) — merged to `main`** | [#368](https://github.com/billy-strummer/awards-cms/pull/368) (merge commit `303d6c7`) | See full evidence in `BTA-CMS-PROJECT-TASKS.md` Section VI. The 4 reported exceptions were not reproducible via live schema+code tracing; fixed the 2 concrete bugs found (Winners status filter, diagnosability) and flagged a new, separate schema-drift finding (`gdpr_consent`/`trophy_collected`/`announce_at` don't exist anywhere) for its own future task. |
| 2026-11-24 | 1.1 Global Season / Award Year Switcher | **Done (Payments deliberately not scoped) — PR open, not yet merged** | `claude/global-season-switcher` → [#369](https://github.com/billy-strummer/awards-cms/pull/369) | See full evidence in `BTA-CMS-PROJECT-TASKS.md` Section VII. New `season-switcher.js` module + top-navbar dropdown; syncs Dashboard/Awards/Entries/Winners via each tab's own existing filter functions; Award Areas synced except on "All Seasons" (no equivalent of its own); Payments has no year dimension in its data model — flagged, not wired, for a separate task. |
| 2026-11-24 | 1.2 Unified Region Hub | **Done (Sponsor status deliberately out of scope per user's own refined instructions) — PR open, not yet merged** | `claude/unified-region-hub` → [#370](https://github.com/billy-strummer/awards-cms/pull/370) | See full evidence in `BTA-CMS-PROJECT-TASKS.md` Section VIII. New `region-hub.js` module + offcanvas drawer on Award Areas; season-scoped metrics strip, lifecycle badge (derived heuristic, not stored), clickable category breakdown, 3 quick actions (upload pre-locked, view filtered entries, view on live site). Added a real Area/Category filter to Entries (did not exist before). Discovered and flagged, not fixed: `winner-pipeline.js`'s offcanvas markup doesn't exist anywhere in the repo — a pre-existing, unrelated bug. |

---

## Phase 0 — UI/UX Polish & Live Data Stabilization (Immediate)

### `[x]` 0.1 — Merge Award Areas UX Overhaul
**Status: Done. PR #366 merged into `main` (merge commit `9233abf`).**
- Branch: `claude/award-areas-ux-overhaul`. PR: [#366](https://github.com/billy-strummer/awards-cms/pull/366) → `main`.
- Target files: `src/partials/03a-award-areas.html`, `src/partials/06-entries.html`, `nominee-uploads.js`, `entries.js`, `ui-init.js`, `global-actions.js`.
- Acceptance criteria:
  - [x] Areas sort strictly A–Z by default; Area/Type/Nominees headers sortable.
  - [x] Type pills (All/Counties/Cities/London Boroughs) and status pills (All/Imported/Empty).
  - [x] Award Year selector in the toolbar, recomputing counts/status per year.
  - [x] Column widths balanced to spec (38/18/12/14/18%).
  - [x] "Upload CSV"/"Replace CSV" → "Upload Spreadsheet"/"Re-upload" everywhere.
  - [x] Top-level "Import Spreadsheet" button on both Award Areas and Entries.
  - [x] Lint clean, full suite green, build clean.
  - [x] **PR #366 merged into `main`** (merge commit `9233abf`), per explicit authorization.

### `[x]` 0.2 — Cross-Screen Admin UI/UX Polish (Dashboard, Awards, Entries, Winners)
**Status: Done. Branch `claude/admin-ui-polish-pass`. Full evidence and discrepancy report in `BTA-CMS-PROJECT-TASKS.md` Section V.**
- Target files: `src/partials/02-dashboard.html`, `src/partials/05-winners.html`, `dashboard.js`, `entries.js`, `media-gallery-new.js`, `ai-vetting.js`, `styles.css`, `tests/dashboard.test.js`.
- Acceptance criteria:
  - [x] Card spacing tightened: Dashboard's 4 "sandwiched" widget rows moved from `mb-5` (3rem) to `mb-4` (1.5rem).
  - [x] **No literal `¢` character or escape sequence exists anywhere in source** (confirmed by raw-byte and escape-sequence search across the whole repo) — this is a discrepancy from the report, not silently resolved. Fixed the closely-related, concretely-verified bug instead: Dashboard's Media Gallery/AI Vetting cards and Entries' 4 stat cards left a spinner glyph stuck forever on a failed load (asymmetric with sibling cards that default to a plain "0"). All now fall back to "—" on failure.
  - [x] Lingering skeleton rows: `entries.js`'s `initialize()` left 10 shimmer rows in `entriesTableBody` forever on failure (only a fading toast, no table update). Now replaced with a calm, retry-able empty state on failure.
  - [x] Table column proportions: Winners table `<th>`s had no explicit widths (unlike Awards, which already had them) — added explicit `%` widths matching the Award Areas/Awards standard, removing the dead whitespace on the right.
  - [x] Noisy header warnings toned down: Dashboard's "Failed to load awards summary" / "Error loading completion data" widget states were genuinely `text-danger` + exclamation-triangle (confirmed in source) — softened to calm `text-muted` placeholders. Global `Disconnected` connection badge softened from a saturated red tint to a muted amber one.
  - [x] **Could not verify a "stale timestamp" header badge anywhere in Awards or Winners** (exhaustive grep for `stale`/`lastUpdated`/similar found nothing visible in either screen) — reported as a discrepancy, not fixed speculatively.
  - [x] Lint clean. 85/85 suites, 6,880/6,880 tests (1 test updated for new copy, 1 pre-existing latent test gap noted — see Section V). Production build clean.

### `[x]` 0.3 — Fix Admin Data Load Errors on Production
**Status: Done, with an honest limit on what "done" means here — see `BTA-CMS-PROJECT-TASKS.md` Section VI. The 4 reported exceptions were NOT reproducible via live schema + code tracing (every query structure checked out valid against production); fixed the 2 concrete, verified bugs the investigation did surface, and added diagnostics so a real recurrence is traceable without a live database session.**
- Target files: `winners.js`, `tests/winners.test.js`, `api/data-proxy.js`, `utils.js`, `tests/data-proxy.test.js`, `tests/api-client.test.js`.
- Acceptance criteria:
  - [x] Root cause investigated with evidence: live production schema (`qdzyknercdqwhwijbcxf`) checked column-by-column, FK-by-FK, against every query the 4 screens issue; PostgREST relationship resolution independently confirmed live via direct REST calls; `ALLOWED_TABLES`/role-permission logic traced in `api/data-proxy.js`. **No query-structure bug reproducible** — service role (which the admin proxy uses) bypasses RLS entirely, so migrations 093/095/096 are not implicated.
  - [x] Each of the 4 reported messages individually traced to its exact source line; none could be forced to reproduce from the current schema state. Concretely verified instead: production's `award_years` (hence the `awards` view), `award_assignments`, `winner_media` and `winners` tables are currently empty (0 rows); `entries` (29) and `organisations` (19) are not.
  - [x] Found and fixed a real, verified bug surfaced by this trace: Winners' status filter dropdown was never sent to the server (`_buildServerFilters()` only forwarded `year`) — and critically, the column is `winner_status` (migration 025), not `status`, so naively "fixing" this by forwarding the dropdown's own key would have introduced the exact class of bug being hunted for.
  - [x] Found, documented, not fixed in this task (flagged as its own follow-up, not patched blind): `winners.js`'s row rendering references `gdpr_consent`, `trophy_collected` and `announce_at` — none of which exist in any migration anywhere in the repo, test or production. Doesn't throw (the query uses `*`, not named columns) but is a real, silent correctness gap; deciding whether to add these columns or remove the dead UI is a product decision, not this task's to make unilaterally.
  - [x] Diagnosability improvement: `api/data-proxy.js`'s catch-all now returns the Postgres/PostgREST error `code` (validated to a safe alphanumeric pattern) alongside the generic 500, and `utils.js`'s `apiClient._call` appends it to the thrown message — so a future real recurrence shows e.g. `Internal server error [42703]` in the toast instead of a bare, undiagnosable message.
  - [x] Tests added: Winners status-filter→`winner_status` mapping; data-proxy empty-table-resolves-cleanly vs. real-Postgres-error-surfaces-code vs. malformed-code-is-dropped; apiClient code-suffix append/no-append.
  - [x] Lint clean. 85/85 suites, 6,886/6,886 tests. Production build clean.

---

## Phase 1 — Region-First Operational Command Centre (Core Workflow)

### `[x]` 1.1 — Global Season / Award Year Switcher
**Status: Done. Branch `claude/global-season-switcher`. Full evidence in `BTA-CMS-PROJECT-TASKS.md` Section VII.**
- Goal: a persistent year switcher in the admin header, scoping Dashboard, Award Areas, Entries, Winners, and Payments to that year without each tab needing its own separate year control.
- What was actually found (none of this was assumed): Dashboard and Payments had **no year/season concept at all** before this task; Awards/Winners defaulted their own per-tab filter to the *calendar* year (`new Date().getFullYear()`) via `utils.populateYearFilterFromDB`, independent of any global state; Award Areas (from 0.1) has a filter model that is *always* a specific year — it has no "All Seasons" equivalent of its own.
- Target files: `season-switcher.js` (new module), `src/partials/00-shell-head.html` (dropdown in the top navbar — the project's real "top admin header bar"; the left sidebar is a separate, distinct nav), `build.js` / `src/partials/99-shell-foot.html` (script registration), `app.js` (cross-tab sync wiring, reusing each tab's own existing filter functions), `auth.js` (startup ordering), `awards.js` / `winners.js` (apply the global season as their own load-time default instead of the calendar year — only when that tab's own saved filter hasn't already set one), `dashboard.js` (`updateStats()` now scopes Total Awards/Pending Approvals/Winners to the season; Organisations is deliberately never season-scoped — it isn't tied to one award year).
- Acceptance criteria:
  - [x] One switcher, one place (top navbar `Season:` dropdown), persists across tab navigation within a session (`localStorage`, key `btaGlobalSeason`) and across page reloads.
  - [x] Dashboard, Awards, Entries, Winners respect it (Dashboard via `updateStats()` reading the season directly; the other three via syncing their own existing year `<select>` + calling their own existing filter function — no duplicated filtering logic).
  - [x] Does not regress Award Areas' existing per-tab year filter from 0.1 — reconciled deliberately: Award Areas syncs to a specific season normally, but is **left untouched on "All Seasons"** since it has no way to represent that itself (documented, not silently broken).
  - [ ] **Payments is not season-scoped** — investigated and found to have no `year`/award-season dimension anywhere in its current data model; wiring that in would be a real scope expansion (touching invoice/payment query logic) beyond "add a switcher," not something to do unilaterally mid-task. Flagged as an explicit, honest gap for its own future task, not silently skipped.
  - [x] Unit tests: season persistence, dropdown population (incl. "All Seasons" + latest-season default + fallback range when `award_years` is empty + saved-season restoration), and cross-tab sync behaviour (`tests/season-switcher.test.js`, `tests/app.test.js`).
  - [x] Lint clean. 86/86 suites, 6,913/6,913 tests. Production build clean.

### `[x]` 1.2 — Unified Region Hub
**Status: Done. Branch `claude/unified-region-hub`. Full evidence in `BTA-CMS-PROJECT-TASKS.md` Section VIII.**
- Goal: clicking a County/City/Borough in Award Areas opens a drawer/view showing that area's lifecycle stage, nominee count by category, quick actions, and a "View on Live Site ↗" link to the matching public page.
- What was actually found (none of this was assumed): no `lifecycle_stage` or sponsor-status field exists on `areas` anywhere in the schema; the user's own refined task instructions for this item (superseding this roadmap's original Goal line) scoped the drawer to Header/Lifecycle Badge + Key Metrics Strip + Category Breakdown + Quick Actions, and did **not** ask for sponsor status — so it was not built, rather than silently dropped mid-scope. No public URL "slug" field exists either; `public-voting.html?city=<name>` is a genuine, already-working, deep-linkable public filter, confirmed end-to-end through `public-voting.js` → `api/voting-proxy.js`, and was reused as the "View on Live Site ↗" target.
- Target files: `region-hub.js` (new module), `src/partials/03a-award-areas.html` (offcanvas drawer markup), `nominee-uploads.js` (row click → open hub; `openUploadModal` preset-year param; new `getYearFilter()` export), `entries.js` + `src/partials/06-entries.html` (new Area filter dropdown + hidden Category filter, needed for the "View Filtered Entries" quick actions — did not exist before this task), `build.js` / `src/partials/99-shell-foot.html` (script registration), `.eslintrc.json` (new global).
- Acceptance criteria:
  - [x] Opens from an area row (row click, or a dedicated "Open Hub" button) without leaving the Award Areas tab — a Bootstrap offcanvas drawer, scoped to Award Areas' own currently-displayed season.
  - [x] Shows real, live nominee-by-category counts for the selected year — category breakdown unions configured categories (`award_years`) with any category that actually has entries, so real data is never hidden for lack of prior configuration.
  - [x] "View on Live Site ↗" links to the correct public URL for that exact area via `public-voting.html?city=<area display_name>` (URL-encoded) — confirmed against `public-voting.js`'s actual query, not `home-data.js`'s `REGION_DATA` (which has no slugs/URLs at all).
  - [x] Lifecycle stage is a computed, documented heuristic (Not Started → Nominees Imported → Active/Voting → Winners Announced, derived from `entries.status`/`is_shortlisted`), not invented or stored state.
  - [x] Discovered, flagged, not fixed in this task: `winner-pipeline.js` references `winnerPipelineOffcanvas`/`winnerPipelineContent` markup that doesn't exist in any partial anywhere in the repo — clicking its trigger in production shows a "panel not found" error. Pre-existing, unrelated to this task; Region Hub's own markup was added for real to avoid repeating this.
  - [x] Unit tests: `tests/region-hub.test.js` (22, new), `tests/entries.test.js` (177, updated — new Area/Category filter + `filterByArea()`), `tests/nominee-uploads.test.js` (47, updated — row click/"Open Hub" button data-args, preset-year, `getYearFilter()`).
  - [x] Lint clean. 87/87 suites, 6,946/6,946 tests. Production build clean.

### `[ ]` 1.3 — Season Rollover Wizard
- Goal: one-click clone of active regions + standard categories into a new award year, without duplicating prior years' nominees.
- Target files/approach: TBD — needs to reuse `getOrCreateAward`-style found-or-create logic (already proven in `api/data-proxy.js`'s `executeAwardAreaImport`) rather than a new bespoke copy path, and must NOT touch `entries`/`organisations` rows (those belong to the year they were created in).
- Acceptance criteria:
  - [ ] Running it for a new year creates `award_years` rows for every active area × standard category combination that doesn't already exist for that year.
  - [ ] Running it twice for the same year is a no-op the second time (idempotent).
  - [ ] Zero nominee/organisation data is duplicated or moved.

---

## Phase 2 — Single Source of Truth & Nominee Growth Engine

### `[ ]` 2.1 — Live Public Site Sync
- Goal: `home.html`/`home-data.js`'s area picker and `Marketing → Website Banners` read live from Supabase, so CMS edits show up without a code deploy.
- Known starting point (already confirmed this session, not a guess): `home-data.js`'s `REGION_DATA` is currently hardcoded and independent of the `areas` table — this is the exact drift class already found and fixed once (the London-borough sync). This item is the structural fix: make that picker genuinely live instead of fixing its data by hand again next time it drifts. `banners` table already exists and has full admin CRUD (`marketing.js`) but, confirmed this session, nothing on the public site currently reads it — it's a real, currently-disconnected feature, not a small tweak.
- Target files: `home.html`, `home-data.js`, `home.js`, `api/entry-proxy.js` (or a new action on an existing endpoint — **no new `/api/` file**, Vercel Hobby plan is at 12/12), `marketing.js`.
- Acceptance criteria:
  - [ ] Area picker reflects the live `areas` table with no manual sync step.
  - [ ] Banners created in Marketing → Website Banners actually render somewhere real on the public site.
  - [ ] No new serverless function file added.

### `[ ]` 2.2 — Region-Level Nominee Outreach Trigger
- Goal: from a Region Hub, preview and send/queue "Official Nominee" outreach emails after a spreadsheet upload, tracking Sent/Opened/Claimed.
- Target files/approach: TBD. `api/email-automation.js` and the `email_lists`/campaign tables are the likely foundation; "Claimed" has no existing concept in the schema (nominees don't currently log in to "claim" anything) — needs a product decision on what "Claimed" means operationally before it's built, not an assumed definition.
- Acceptance criteria:
  - [ ] Admin can preview the exact email before sending.
  - [ ] Sent/Opened are tracked using the existing Resend-webhook infrastructure (`api/email-automation.js`'s bounce/complaint handling is the closest existing precedent) rather than a new bespoke tracking path.
  - [ ] "Claimed" has an explicit, agreed definition recorded in this roadmap before being marked done.

### `[ ]` 2.3 — "Official Nominee 2027" Social Badge & Shareable Link Generator
- Goal: per-entrant shareable voting link + a social badge image/asset nominees can post themselves.
- Target files/approach: TBD. `api/certificates-qr.js` already generates QR/certificate images per winner — the closest existing precedent for "generate a per-entrant image asset," worth extending rather than building a parallel image-generation path.
- Acceptance criteria:
  - [ ] Shareable link resolves to that entrant's real public voting page.
  - [ ] Badge is generated per-entrant, not a generic static image.
  - [ ] No new serverless function file added (extend `certificates-qr.js` or another existing handler).

---

## Phase 3 — Commercial Sponsorship & Judging Workflows

### `[ ]` 3.1 — Region & Category Sponsorship Slots
- Goal: assign sponsors to specific Counties/Cities/Boroughs or Categories; display their branding on public voting pages and winner packs.
- Target files/approach: TBD. `sponsorship_catalogue_packages` (migration 091) and `organisations`/`sponsors`-adjacent tables are the likely base — needs a schema check for whether "sponsor ↔ area" and "sponsor ↔ category" are both already modelled or need a new join table, before scoping.
- Acceptance criteria:
  - [ ] A sponsor can be scoped to one or more specific areas and/or categories.
  - [ ] Public voting pages for a sponsored area/category actually show that sponsor's branding.
  - [ ] Winner packs include sponsor branding for sponsored categories.

### `[ ]` 3.2 — Inline Judging & Shortlist Workspace
- Goal: side-by-side category judging view — inline Priority Rank (1/2/3), notes, website preview, one-click shortlist/winner promotion.
- Known starting point: `judge-portal.js`/`api/judge-automation.js` are the existing judging pipeline — but, confirmed in this session's earlier audit, both are hardcoded to `status: 'submitted'` entries only, meaning bulk-imported nominees (status `'shortlisted'` directly) never enter this pipeline today. This item should resolve that gap deliberately as part of its own scoping, not route around it silently.
- Target files/approach: TBD beyond the above.
- Acceptance criteria:
  - [ ] A judge can see and act on entries without leaving a single category view.
  - [ ] `entries.priority_rank` (added this session, migration 095) is editable inline here, not only in the Entries tab's edit modal.
  - [ ] Explicit decision recorded on whether bulk-imported nominees enter this workspace, and if so, how the `status: 'submitted'` gate is handled.

### `[ ]` 3.3 — Batch Winner Certificate & Regional Press Release Pack Generator
- Goal: generate certificates + a regional press-release pack for a batch of winners in one action.
- Target files/approach: TBD. `winner-certificate.js` and `api/certificates-qr.js` already do single-winner certificates — this is a batch/bulk extension of that, plus new press-release templating that doesn't exist yet as far as this roadmap's authoring session has confirmed.
- Acceptance criteria:
  - [ ] Can generate certificates for a whole region/category in one action, not one winner at a time.
  - [ ] Press release pack output format agreed and recorded here before being marked done.
  - [ ] No new serverless function file added.
