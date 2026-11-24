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
| 2026-11-24 | 0.2 Cross-Screen Admin UI/UX Polish | **Done — PR open, not yet merged** | `claude/admin-ui-polish-pass` → #TBD | See full evidence in `BTA-CMS-PROJECT-TASKS.md` Section V. Could not verify a literal "¢" character or a "stale timestamp" header badge anywhere in source (exhaustive grep); fixed the concrete, verified bugs found instead — see Section V for the discrepancy report. |

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

### `[ ]` 0.3 — Fix Admin Data Load Errors on Production
**Status: not started. Not yet investigated.**
- Reported symptoms (user's report, not yet reproduced or root-caused by a session): `Failed to load awards summary`, `Error loading completion data`, `Failed to load awards`, `Failed to load winners` — on production (`qdzyknercdqwhwijbcxf`).
- Target files: TBD — needs a live, read-only pass against production first (check `get_advisors`, check the relevant `data-proxy.js` operations these screens call, check RLS/grant state post-migration-093/096, check browser console/network for the actual failing request and status code) before concluding a root cause. Given this project's history of RLS/grant exposure work on exactly this production project, a policy or grant side-effect is one plausible lead, not a confirmed cause.
- Acceptance criteria:
  - [ ] Root cause confirmed with evidence (exact failing request, exact error, exact table/column/policy involved) — not patched blind.
  - [ ] Every one of the 4 reported error messages reproduced or disproved individually.
  - [ ] Fix applied and verified live on production (read-only verification preferred where possible; any further migration follows the existing test-first-then-authorized process).
  - [ ] Lint clean, full suite green, build clean.

---

## Phase 1 — Region-First Operational Command Centre (Core Workflow)

### `[ ]` 1.1 — Global Season / Award Year Switcher
- Goal: a persistent year switcher (e.g. defaulting to `2027`) in the admin header, scoping Dashboard, Award Areas, Entries, Winners, and Payments to that year without each tab needing its own separate year control.
- Target files/approach: TBD. Needs investigating how year scoping currently differs per screen (Award Areas already has its own per-tab year filter as of 0.1; Entries/Winners/Payments do not yet) before deciding whether this is a new shared header component + a shared state store, or a per-screen retrofit.
- Acceptance criteria:
  - [ ] One switcher, one place, persists across tab navigation within a session.
  - [ ] Every listed tab's data respects it.
  - [ ] Does not regress Award Areas' existing per-tab year filter from 0.1 (reconcile or supersede deliberately, not accidentally).

### `[ ]` 1.2 — Unified Region Hub
- Goal: clicking a County/City/Borough in Award Areas opens a drawer/view showing that area's lifecycle stage, nominee count by category, sponsor status, quick actions, and a "View on Live Site ↗" link to the matching public page.
- Target files/approach: TBD. "Sponsor status" and "lifecycle stage" per area aren't concepts that exist in the schema yet as far as this roadmap's authoring session has confirmed — needs a check of `areas`/`award_assignments`/sponsorship tables before scoping, not an assumption that the data is already there.
- Acceptance criteria:
  - [ ] Opens from an area row without leaving the Award Areas tab.
  - [ ] Shows real, live nominee-by-category counts for the selected year.
  - [ ] "View on Live Site ↗" links to the correct public URL for that exact area (watch for the London-borough naming drift class of bug already found and fixed once this session — verify the link target matches `home-data.js`'s current `REGION_DATA`, not just the `areas` table name).

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
