# First County Import Guide

Your first real data import into production. Treat this one county as a rehearsal for all the others — the goal is to prove the whole pipeline (import → categories → public site → SEO) works correctly with real data before you commit to importing everything.

**Do not start this until every box in `PRODUCTION-VERIFICATION-GUIDE.md` is checked and all test records have been deleted.**

---

## Before you import

1. **Pick one county deliberately.** Choose one with a moderate, manageable number of expected nominees — not your largest or most complex county for this first real run. You want to be able to manually eyeball every result.
2. **Create your real award categories first**, if you haven't already (Awards tab). The importer matches categories by exact name — if a category doesn't exist yet, decide now whether the importer should create it or whether you want it pre-created; per `ADMIN-GUIDE.md` §3, an *unknown* category name is treated as a validation error, not auto-created, so create every category you intend to import against before starting.
3. **Confirm your season's dates are set** (Settings → Seasons & Areas) so newly-created entries fall into the correct, currently-open cycle.
4. **Prepare your CSV** with columns for Company Name, Award Category, Email, Contact Name, Phone, Website, Notes. Common header variations are auto-detected, but keep it clean and consistent.

---

## Step by step

1. Open **Award Areas**, find your chosen county.
2. Click **Upload CSV** on that row.
3. Select your file.
4. **Read every validation error before doing anything else.** If the importer reports missing columns, unknown categories, duplicate companies within the file, invalid emails, or missing names — fix your source CSV and re-upload. Nothing is imported until validation passes cleanly. This is the single most important discipline for a first real import: don't try to "fix it after," since nothing is written to the database until this step passes.
5. Once validation passes, choose your duplicate-handling mode. For a genuinely first-time real import (no prior real data for this county), you'll typically see no duplicates, but choose deliberately anyway:
   - **Skip** — safest default, use this unless you have a specific reason not to.
   - **Update Existing** — only if you know some of these organisations are already in the system from another source and want gaps filled in.
   - **Replace Existing** — cannot be undone; do not use this on your first real import.
6. Click **Upload & Publish**. This is instant and immediately live — there is no separate review/draft step before the public site reflects it.

---

## Verify immediately after import

Work through every item below before considering this county "done." This is the exact same discipline `PRODUCTION-VERIFICATION-GUIDE.md` used for the empty-database check, now against real data.

### Organisations
- [ ] Open the Organisations tab, filter/search for a handful of the companies you just imported — confirm they exist with the correct name, category association, and contact details exactly matching your source CSV.
- [ ] Spot-check at least 3 records in detail, not just that a count went up.

### Entries
- [ ] Open the Entries tab — confirm the same number of new entries as rows in your (validated, deduplicated) CSV.
- [ ] Confirm each has status "shortlisted" (or whatever your workflow's initial status is) and links to the correct organisation and award.

### Categories
- [ ] Confirm no new, unexpected categories were created — the count of award categories should match what you deliberately set up beforehand (Step 2 above). If you see a category you didn't create, investigate before proceeding — it likely indicates a category-name mismatch you should understand rather than dismiss.

### County
- [ ] Back on Award Areas, confirm this county now shows "Imported" status and the correct nominee count.
- [ ] Spot-check that the county name/region/details are exactly correct — this is part of the permanent master list, not something re-created per-import, but worth a final glance.

### Public Website
- [ ] In a private browser window, find this county's nominees on the public voting/nominees page.
- [ ] Confirm the count matches what you just imported and spot-check 2–3 organisation names for correct spelling/display.

### Search
- [ ] If the relevant public page has search (the Award Nominees/voting pages do; `public-winners.html` currently doesn't — see the known gap noted in `PRODUCTION-VERIFICATION-GUIDE.md`), search for one of the imported companies by name and confirm it's found.

### Filters
- [ ] If the page has category/area filters, filter down to this specific county/category and confirm only the expected nominees show.

### SEO
- [ ] View page source on the county/category page — confirm the title and meta description reflect the real county/category name, not placeholder text, and that nothing about the page broke or regressed from the empty-database checks in `PRODUCTION-VERIFICATION-GUIDE.md`.

---

## Decision point

**Only proceed to import the remaining counties once every box above is checked and correct.**

If anything was wrong: do not attempt to "fix forward" by re-importing more counties on top of a suspected problem. Diagnose and resolve the specific issue with this one county first — since imports are additive and the underlying data model reuses organisations/awards by exact match, an unresolved category-mismatch or duplicate-handling misunderstanding will compound if repeated across every remaining county.

If everything passed: you now have a proven, real, end-to-end reference for what "correct" looks like. Repeat the same Step-by-step process per remaining county, but you do not need to repeat the full verification checklist in as much depth for every single one — a lighter spot-check (organisation count matches, no unexpected categories, a quick public-site glance) per county is reasonable once the first has fully proven the pipeline, escalating back to the full checklist if anything looks off.
