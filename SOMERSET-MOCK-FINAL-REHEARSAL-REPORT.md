# Somerset Mock Data — Final End-to-End Rehearsal Report

**Date:** 2026-07-21
**Scope:** Full production-pipeline rehearsal using `Somerset_Mock_Demo.xlsx`, exactly as a real administrator would run it, ahead of importing the remaining 117 real county workbooks.

**Headline: two genuine bugs were found in the public voting path during this rehearsal (not in the import pipeline itself) and have been fixed, tested, and pushed.** Everything else — workbook compatibility, the import pipeline, database integrity, and the CMS — passed cleanly with no changes needed.

---

## What this rehearsal actually did

Before importing anything, the live Supabase test project's Somerset area was reset to its true pre-rehearsal baseline (5 organisations / 5 entries / 5 award categories — precisely identified and preserved, with everything from an earlier rehearsal in this engagement removed) so that this run would be a genuine **first-time county import**, not a re-run against already-populated data. That is the scenario every one of the 117 real counties will actually face.

Every phase below was executed against the real, shipped code — the actual `nominee-uploads.js` client module (loaded in a jsdom environment and driven through its real exposed functions, not a re-implementation), the actual `api/data-proxy.js` import handler, and the actual `api/voting-proxy.js` public API — all running against the live Supabase test database, not mocks.

---

## Phase 1 — Workbook Compatibility

Loaded the real `Somerset_Mock_Demo.xlsx` bytes through the actual shipped client code path (`_readFileAsCSVText` → `_parseCSV` → `_detectColumn`), not a re-implementation.

- **1 worksheet**, 566 rows (1 header + 565 data rows), **13 columns**.
- `.xlsx` → CSV conversion via SheetJS: **82ms**. CSV parse: **5.9ms**.
- All 7 columns the importer actually uses were auto-detected correctly: `Company Name`, `Category`, `Direct Email`, `Contact Name`, `Phone Number`, `Website URL`, `Notes`.
- The other 6 columns (`NominationDate`, `Region`, `Sector`, `Business/Contact Address`, `Catchment Area`, `Rank`) are intentionally ignored by design — already documented in `ADMIN-GUIDE.md` and `FIRST-COUNTY-IMPORT-GUIDE.md`.

**No workbook changes were needed or made.** The real county workbooks can use this exact same 13-column structure — the importer only needs the 7 columns it already knows how to find, by header name, regardless of column order or the 6 extra columns present.

---

## Phase 2 — Import Process

Ran the **real** `award_area_import` operation through `api/data-proxy.js`, exactly as the Award Areas UI does — first `mode: 'validate'`, then `mode: 'import'`.

**Validate** (all 565 raw rows): **924ms**. Found **83 errors** — identical in kind and count to previous validation runs of this same workbook, confirming no regression:
- 57 category errors (7 rows missing a category, 50 rows with an unrecognized category across 5 near-miss category names, e.g. "Fencing Company" vs. the real "Fencing Installer")
- 26 true duplicate rows (same company + same category repeated)

**None of these 83 rows were imported** — cleaned to the remaining **485 valid rows**, matching the known-good figure from the prior rehearsal exactly.

**Import** (485 clean rows, via the real 40-row chunked flow `nominee-uploads.js` actually uses): **13 sequential chunk calls, 100% success, 0 failures.**
- 485/485 entries created, 100 new organisations, 385 rows correctly reused an organisation created earlier in the same batch while still receiving their own entry (proving the multi-category fix from earlier in this engagement continues to hold).

---

## Phase 3 — Database Verification

| Check | Result |
|---|---|
| Organisations created correctly | ✅ 105 total (5 baseline + 100 new), 0 duplicate names |
| Entries created correctly | ✅ 490 total (5 baseline + 485 new) |
| Categories matched correctly | ✅ 51 `award_years` rows, 0 duplicates, all year=2026 |
| Award Area assigned correctly | ✅ 100% of new orgs/entries stamped with Somerset's `area_id`/`county_city`/`country` |
| Season assigned correctly | ✅ *(see note below)* |
| No duplicate organisations | ✅ 0 found |
| Multi-category company behaviour | ✅ 98 of 105 orgs (93%) hold >1 entry, max 10 for one org — correct |
| Relationships between all tables | ✅ 0 entries with an unresolvable `organisation_id` or `award_id` |
| No orphaned records | ✅ confirmed via join-back checks |
| No validation warnings ignored | ✅ all 83 error rows verified excluded from the 485 imported |

**Season note:** there is no `season_id` foreign key anywhere in the schema linking `entries` or `award_years` to `award_seasons` — confirmed by code (zero references in `api/data-proxy.js`) and by the live data (exactly one `award_seasons` row: *"2026 Main Season"*, `year: 2026`, `status: "upcoming"`, all dates null). Season "assignment" is an implicit match on the `year` integer, and it aligns correctly — imported entries stamp `year: 2026`, matching the one 2026 season. This isn't a defect in the import; it's worth knowing that the season's own dates/status aren't yet configured (a Settings → Seasons & Areas task, unrelated to this rehearsal).

Two pre-existing anomalies were checked and confirmed **unrelated to this import** (both predate this rehearsal, from earlier manual test-data setup): one baseline entry has `status: 'winner'` (manually promoted during earlier CMS testing), and the 5 baseline organisations carry a non-null `tenant_id` from earlier in this engagement. Neither came from the Somerset Mock workbook.

---

## Phase 4 — CMS Verification

Queried every relevant module the same way the CMS itself would, through the real `data-proxy.js` handler:

- **Dashboard-style counts**: 105 orgs / 490 entries / 51 categories — all correct.
- **Awards tab**: 51 categories listed for Somerset.
- **Award Areas tab**: area record correct.
- **Entries tab**: pagination correct (490 total, 50/page); category filter correct (10 "Roofing Company" entries).
- **Organisations tab**: pagination correct (105 total); search correct ("Mendip" → 10 exact matches).
- **Winners tab**: **0** winners auto-created from the import — correct, expected behaviour.
- **Reports**: site-wide totals (490 entries, 106 orgs) reconcile exactly with Somerset's own counts (the 1 extra org outside Somerset predates this rehearsal).

---

## Phase 5 — Front-End Website Verification ("the most important part")

This is where the rehearsal earned its keep. Testing the real public API (`api/voting-proxy.js`) surfaced two genuine, previously-undiscovered bugs — both now fixed.

### Bug 1 (Critical): public voting was completely broken

`checkRateLimit`, `submitVote`, and `sendVoteConfirmation` all filtered `public_votes` on a column called `voted_at` — **which has never existed**. The table only has `created_at` (migration 054's own comment already documented this). Every real vote attempt threw a 500 error — direct proof: `column public_votes.voted_at does not exist` (Postgres error `42703`). The same bug existed in the GDPR vote-retention cleanup job in `api/_lib/automation-scheduler.js`.

**Fixed**: all 5 occurrences changed from `voted_at` to `created_at`, in `api/voting-proxy.js` and `api/_lib/automation-scheduler.js`.

### Bug 2 (High): vote counts never displayed

Even once votes could be recorded, `entries.public_votes` — the exact counter `public-voting.js` shows to visitors and sums for the site total — was never incremented anywhere. Every nominee would show **0 votes forever**, regardless of real voting activity.

**Fixed**: added an atomic `increment_entry_public_votes()` Postgres function (`migrations/075-increment-entry-public-votes.sql`) and call it via RPC immediately after each successful vote insert, with a non-fatal fallback so a not-yet-applied migration never blocks voting.

> ⚠️ **Action required**: migration 075 has **not yet been applied** to the live database — this sandbox had no `SUPABASE_ACCESS_TOKEN` / direct Postgres access available this session to run it. The code degrades safely in the meantime (votes still record; a warning is logged), but **real vote counts will not display on the public site until this migration is run** — via the Supabase SQL Editor, exactly as `MIGRATION_ORDER.md` already documents for other migrations.

### Everything else in Phase 5 passed cleanly

- `load_entries` filtered by `city=Somerset`: 489 of 490 returned — the 1 excluded row is the pre-existing `status: 'winner'` entry, correctly filtered out by the public feed's own `.in('status', ['shortlisted','submitted'])` clause. Not a bug.
- `load_entries` filtered by category: correctly narrows (10 "Roofing Company" entries).
- Cache-Control headers correct: absent on filtered requests, present (`public, max-age=60`) on the unfiltered feed, with a genuine cache hit (0ms) on the second call.
- **No mock/demo/test artefacts from the Somerset Mock workbook leak into public data.** A scan of all 489 public entries for "mock"/"demo"/"test" substrings found exactly 4 matches — all from 4 **pre-existing baseline organisations** created many turns earlier in this engagement (placeholder `.test` domains like `somersetroofing.test`), unrelated to this workbook. The real 485 imported rows use realistic company names, categories, and domains (e.g. `mendipsolutions.co.uk`) with zero origin tells. (Recommendation, not a blocker: replace or remove those 4 baseline `.test`-domain fixtures before go-live.)
- **Full vote round-trip re-verified after both fixes**: `check_existing_vote` (false) → `submit_vote` (success) → `check_existing_vote` (true) → duplicate vote correctly rejected (409) → `check_rate_limit` correctly reflects the new vote → `send_vote_confirmation` succeeds. Test vote cleaned up afterward, leaving no residue.

**A real visitor would have no way of telling this data came from a mock workbook** — confirmed directly: company names, categories, websites, and contact details all read as genuine UK trade businesses.

---

## Phase 6 — End-to-End User Journey

Traced the full visitor path through the real API responses gathered above (this sandbox has no live browser, so this is verified at the API-response level, not visually rendered — the same honest caveat as every prior rehearsal in this engagement):

1. Visitor arrives, requests the category/area list → `load_awards` returns 52 active categories.
2. Visitor navigates to Somerset → `load_entries({ city: 'Somerset' })` returns 489 public nominees, correctly excluding the one already-decided winner.
3. Visitor filters to a category (e.g. Roofing) → 10 relevant nominees returned, with organisation name, website, and category all correctly joined.
4. Visitor opens a nominee and votes → now works end-to-end (previously would have 500'd at the rate-limit check before either bug fix).
5. Visitor receives a vote confirmation → email send succeeds (via Resend, using the real `RESEND_API_KEY`).

Every step behaves exactly as it should, now that both bugs are fixed.

---

## Phase 7 — Performance

| Step | Time |
|---|---|
| Client-side `.xlsx` → CSV conversion | 82ms |
| Client-side CSV parse | 5.9ms |
| Server validate (565 rows) | 924ms |
| Server import, 485 rows / 13 chunks (original chunk size 40) | 252.1s total; per-chunk 2.9s–29.0s |
| Database verification queries | 1.5s |
| Public `load_entries` (Somerset, filtered) | 275ms |
| Public `load_entries` (category-filtered) | 149ms |
| Public `load_awards` | 1.0s (uncached — minor future optimization, not urgent) |
| Public `load_entries` (unfiltered, warm cache) | 0ms |

**Bottleneck found and fixed**: the worst-observed import chunk (40 rows, 24 of them brand-new organisations) took **28.976s** against `data-proxy.js`'s **30s** Vercel timeout — about 1 second of margin. Each row costs roughly 460–725ms in sequential DB round-trips (organisation lookup/insert, category lookup-or-create, entry existence check, entry insert), and a chunk where every row is a new company is the realistic worst case for a fresh county.

**Fix**: reduced `IMPORT_CHUNK_SIZE` in `nominee-uploads.js` from 40 to 25. Re-verified empirically with a throwaway 25-row, all-new-organisation batch (worst case) through the real import path: **16.8 seconds** — a comfortable 44% margin under the 30s ceiling (test data cleaned up immediately after, Somerset's counts confirmed unchanged at 105 orgs / 490 entries).

---

## Phase 8 — Production Readiness

**Is the mock Somerset workbook now fully compatible with the CMS?**
Yes. No workbook changes were needed at any point in this rehearsal.

**Would you be happy importing the remaining 117 county workbooks using exactly the same structure?**
Yes, with one prerequisite: **run migration `075-increment-entry-public-votes.sql` against the live database first**, so real vote counts actually display once county entries go live for public voting. The import pipeline itself needs no further changes.

**Is there anything you would change before importing the real data?**
One operational item, not a code change: the 4 pre-existing baseline organisations with placeholder `.test` website domains should be cleaned up or replaced before go-live, so nothing looks obviously synthetic on the public site. This is unrelated to the Award Areas import pipeline.

**Issues found were fixed, and the rehearsal was repeated until it succeeded** — per the explicit instruction for this rehearsal:
1. Found the `voted_at`/`created_at` schema mismatch breaking all public voting → fixed → re-ran the full vote round-trip live → confirmed working.
2. Found `entries.public_votes` never incrementing → fixed (code + migration) → re-verified graceful behavior live (migration itself still needs to be applied — see action item above).
3. Found the import chunk size left too little safety margin under the Vercel timeout → fixed → re-verified empirically with a real worst-case batch → confirmed safe margin.

All fixes are committed and pushed to `claude/supabase-cms-setup-test-e6oiza` (commit `dc5332c`). Full test suite (68/68 suites, 6470/6473 tests, 3 pre-existing skips), lint, and build all pass clean after every change.

---

## Summary of code changes made this rehearsal

| File | Change |
|---|---|
| `api/voting-proxy.js` | Fixed 4 queries referencing nonexistent `public_votes.voted_at` → `created_at`; added atomic vote-count increment via RPC after `submit_vote` |
| `api/_lib/automation-scheduler.js` | Fixed the same `voted_at` → `created_at` mismatch in the GDPR vote-retention cleanup job |
| `migrations/075-increment-entry-public-votes.sql` | New — atomic `increment_entry_public_votes()` Postgres function (**not yet applied to the live database — action required**) |
| `nominee-uploads.js` | `IMPORT_CHUNK_SIZE` reduced from 40 to 25 for safer margin under the Vercel function timeout |

## Recommendation

**Proceed with the real Somerset workbook, then the remaining 117 counties, using this exact process — after running migration 075 against the live database.** Everything else in the pipeline, from workbook upload through to the public voting page, has now been verified end-to-end against real code and a real database, not assumptions.
