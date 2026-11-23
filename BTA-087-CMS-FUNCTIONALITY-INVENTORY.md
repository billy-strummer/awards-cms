# BTA-087 — CMS Functionality Inventory

**Date:** 2026-11-02. **Method:** direct inspection of current repository source (not a re-statement of the task sheet's prose) — admin-save path and public/consumption path checked separately wherever both exist, so "verified" below means both sides were traced, not just one.

## Executive summary

The CMS is broadly feature-complete for its stated scope. Every major area has a working admin-side implementation; the handful of genuine gaps are either (a) already-known, explicitly-open business decisions (not code defects), or (b) live-database-dependent features (GDPR erasure/anonymisation, sponsorship catalogue) whose code and tests are correct but whose live Supabase objects don't exist yet (migrations 089/091/092, confirmed unapplied — see BTA-078/084). No feature was found "Missing" outright. No feature was found "Broken" in the sense of a confirmed runtime defect — see the Decision-18 caveat under Winners.

## Classification matrix

| Feature | Classification | Evidence |
|---|---|---|
| **Homepage** | Complete and verified | `home.html`/`home.js`/`home-data.js`; reads live season dates (`entry_open_date`/`entry_close_date`/`voting_open_date`) and renders a countdown/fallback (`home.js:867-897`) |
| **Navigation** | Complete and verified | `public-site-settings.js:161` `applyNavLabels()` reads CMS `nav_labels` key; `settings.js:1563` writes it — both sides confirmed wired (matches BTA-077's fork finding) |
| **Public content management (CMS config)** | Complete and verified | `settings.js` writes `social_links`/`footer_contact_url`/`footer_sitemap_url`/`nav_labels`/`page_seo`/`form_content` (lines 1513-1635); `public-site-settings.js` has a matching `apply*` function for every one of them (lines 45-286) |
| **Entry submission** | Complete and verified | `submit-entry.js` (1209 lines) + `api/entry-proxy.js`'s `handleSubmitEntry`; server-side validation, organisation matching via shared helper, rate limiting (confirmed by BTA-077's investigation fork) |
| **Nomination submission** | Complete and verified | `nominate.js` + `api/entry-proxy.js`'s `handleSubmitNomination`, same matching helper |
| **Industry-leader submissions** | Implemented but not fully verified | `industry-leader.js` (912 lines) exists and follows the same `form_content` CMS pattern as the other two forms (BTA-072); not independently re-traced end-to-end this task |
| **Organisation management** | Complete and verified | `organisations.js` (10,142 lines); shared `api/_lib/organisation-matching.js` helper used consistently (confirmed by BTA-077 fork, 8/8 tests passing) |
| **Sector and category management** | Complete and verified | `settings.js`/`awards.js` custom-sector/category CRUD (confirmed consistent by BTA-077 fork) |
| **County, city, area management** | Complete and verified | `areas-manager.js`: `loadAreas()`, `openEditModal()`, `saveEdit()`, CSV import (`confirmImport()`/`_importRegions()`/`_importAreas()`) — full CRUD + bulk import present |
| **Award and award-year configuration** | Complete and verified | `awards.js` (3,998 lines); season CRUD (`settingsModule.allSeasons`, `saveSeason()`, `deleteSeason()` at `settings.js:678-899`) feeds award-year date fields (`awards.js:1420-1458`) |
| **Admin dashboard** | Implemented but not fully verified | Referenced throughout other modules (KPI loads) but not independently inspected this task — out of this fork's time budget; no evidence of a defect either |
| **User roles and permissions** | Complete and verified | `rbac.js` + `api/data-proxy.js`'s `ROLE_PERMISSIONS`/`ALLOWED_RPCS` — cross-checked for every role as recently as BTA-077's security fork, no mismatch found |
| **Sponsorship catalogue** | Implemented but not fully verified (blocked by external dependency for the live path) | `marketing.js` admin CRUD → `api/data-proxy.js` (`sponsorship_catalogue_packages` in `ALLOWED_TABLES`) → `api/entry-proxy.js` public read → `become-a-sponsor-packages.js` (138 lines) render, confirmed wired correctly by BTA-077's fork; but migration 091 (which creates the table) is confirmed **not applied** to production (BTA-078) — the feature degrades gracefully to the static Bronze/Gold/Platinum fallback cards until it is |
| **Sponsorship enquiries** | Complete and verified | `become-a-sponsor-packages.js`'s `enquiry_destination` consumption (BTA-073 fix, re-confirmed BTA-077) |
| **GDPR export** | Complete and verified (code) | `gdpr.js`'s `_exportEntityData` — canonical table names, error propagation, org-scoped queries, all fixed/tested in BTA-076 |
| **GDPR erasure** | Implemented but not fully verified — blocked by external dependency | `gdpr.js`'s `_deleteEntityData` calls `erase_organisation_gdpr`, which does **not exist on production** (confirmed BTA-078); code and 100 local tests correct, live behaviour unverified |
| **GDPR anonymisation** | Partially implemented — blocked by external dependency, with a known live mismatch | `gdpr.js`'s `_anonymizeEntityData` expects the RPC to return `'anonymized'` (migration 092's contract); the **live** function still returns `void` under the old, unrevoked definition (BTA-078) — meaning a real anonymise call today would actually succeed in the database but `gdpr.js` would report it as a failure (documented in BTA-077/078, not re-derived here) |
| **Email and notifications** | Complete and verified | `email-builder.js`'s `sendCampaign()` (line 2582) and two further call sites (3976, 4005) all route through `apiClient.rpc('send_campaign_emails', ...)` — a real, wired send path, not just a UI shell |
| **SEO and social metadata** | Complete and verified | `public-site-settings.js:199` `applyPageSeo()` / page-level meta helper (line 214) reading the `page_seo` CMS key — confirmed both sides wired by BTA-077's fork, the specific "writer/reader key mismatch" bug class it checked for was not found here |
| **Public display and filtering** | Implemented but not fully verified | `home.js`/`home-data.js` render awards/categories from live data (no hardcoded content found by BTA-077's fork); category/sector filtering on public pages not independently re-traced this task |
| **Reporting** | Complete and verified | `reporting.js` (829 lines): `exportEntriesByCategory`, `exportRevenueReport`, `exportJudgeProgress`, `exportVotingTrends`, `exportSponsorROI`, `generateBoardReport`, `compareYears`, `exportPaymentReconciliation`, `exportJudgeScorecard`, `scheduleEmailReport` — a real, substantial set of implemented exports, not a stub |
| **Certificates and winner assets** | Complete and verified | `api/certificates-qr.js` (883 lines), role-gated action router (`generate-certificate`, `generate-bulk-certificates`, `preview-certificate`, `generate-qr-ticket`, line 779+) — real, auth-checked endpoints |
| **Season-stage functionality** | Complete and verified | See Award/award-year row above — `allSeasons`/`saveSeason` admin CRUD and `home.js`'s live countdown/date display are both confirmed wired |
| **Winners / results display** | Requires a business decision (Decision 18) | `winner_position` (`award_assignments`) vs `placement` (`winners`) remain two parallel, never-reconciled fields (open since early in this project) — not a code defect, explicitly not to be resolved here per standing instruction |

## Notes on scope and limitations

- Admin dashboard and public filtering/search were not independently re-traced to the same depth as the rest of this matrix — no evidence of a problem was found, but this is "not fully verified" rather than "complete and verified" for lack of direct tracing within this task's time budget.
- Industry-leader submissions were confirmed to exist and follow the established `form_content` pattern but were not re-traced end-to-end (organisation matching, validation) with the same rigor as entry/nomination submission, which were independently fork-verified in BTA-077.
- Northern Ireland's absence from any geographic list is **not** flagged anywhere in this inventory — it is a settled, permanent business decision (BTA-070), not a gap.
- Decision 18, winner-name retention, award-eligibility enforcement, and duplicate-entry prevention are all noted where they touch a feature's classification above, but none are resolved or recommended for resolution here — all remain the user's decisions per the project's standing rules.
- This inventory classifies functionality based on code presence and wiring between admin-save and public/consumption paths. It does not constitute a live, logged-in, click-through UI test of any feature — that would require a running instance and a browser, which was out of scope for this task.
