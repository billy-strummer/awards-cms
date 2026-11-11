# Final Acceptance Test — Administrator & Public Visitor Journey

A full production-readiness review from the perspective of a real administrator and a real public visitor, following the data-layer rehearsal in `SOMERSET-REHEARSAL-REPORT.md`. That earlier pass proved the import pipeline; this one proves the experience around it.

**Method note, stated plainly per instruction:** a fully-authenticated live browser session against this sandbox's Supabase project could not be completed (the sandbox's outbound proxy cannot establish a working tunnel for Chromium's Auth/Realtime traffic — confirmed via the proxy's own diagnostics, an environment limitation, not a CMS defect). Everything below is either: (a) verified directly against the real, current source files and a live Supabase project via the exact same server-side code paths the browser would call, or (b) explicitly flagged as unverified where neither was possible. Two research agents surveyed the admin partials and public pages first; every finding they reported was independently re-verified against the actual current codebase before being acted on, because their isolated review environments turned out to be checked out from an older point in this branch's history and contained some stale claims (noted inline below where relevant).

---

## Administrator Journey

### Login
Renders correctly (verified via a real authenticated session against the live Supabase test project). **Gap found: no self-service "Forgot password?" link exists anywhere.** Traced `auth.js` and `api/data-proxy.js` in full — the only password-reset path (`user_reset_password`) requires the caller to already be an authenticated Super Admin resetting *someone else's* password. There is no public-facing password-recovery page, and no client-side call to Supabase's own `resetPasswordForEmail`. **If the only Super Admin forgets their password, there is no in-app recovery route at all.** Not fixed in this pass — building a genuine self-service reset (a new link, a landing page to handle the recovery token, wiring `updateUser`) is a small but real new feature with its own auth-correctness risk, better done as a deliberate, tested addition than rushed alongside this review. Documented in `ADMIN-GUIDE.md` §11/§13/§14 with a mitigation (keep ≥2 Super Admins) until it exists.

### Dashboard, Award Areas, Upload, Validation, Import Progress, Success/Failure
Fully covered by the prior rehearsal (`SOMERSET-REHEARSAL-REPORT.md`). No new findings here beyond what's already fixed there.

### Organisations
- Fixed: onboarding text called the bulk-contacts tool "CSV Import" — the exact term used for the *real* nominee importer, reinforcing the confusion `ADMIN-GUIDE.md` §4 already warns about. Now says "Add Contacts in Bulk", matching the actual button.
- Fixed: "Company added successfully!" toast — every other organisation-related toast says "Organisation"; corrected for consistency.
- Verified, not a bug: Organisations' delete action is labeled "Archive" with a `bi-archive` icon, unlike Awards/Entries/Winners' `bi-trash` "Delete". This is a **deliberate, correct distinction** — organisation deletion is a genuine soft-archive (reversible, restorable via "Show Archived"), while the others are hard deletes. Different behavior, different word — not an inconsistency to fix.

### Entries
Fixed: onboarding text described a status pipeline ("Draft → Submitted → Shortlisted → Winner") that matched neither the real status dropdown (`Under Review → Shortlisted → Winner`, or `Rejected`) nor `ADMIN-GUIDE.md`. Corrected to match both.

### Awards
No defects found. The Region/Area filter pair (`awardsRegionFilter` cascading into `awardsAreaFilter`) is implemented correctly — Region is derived client-side from each award's `area.region_id`, never stored directly, exactly the safe pattern recommended in the prior rehearsal's Phase 3 finding. Confirms that finding rather than contradicting it.

### Winners — the most significant finding of this pass
**"Add Winner" — the manual-entry path documented in `ADMIN-GUIDE.md` §6 and described in the tab's own onboarding banner — was completely missing from the shipped application.** Traced the root cause precisely:
- The button and modal only ever existed in the old monolithic `index.html`, which was correctly deleted in an earlier commit (`2a5e25d`, "Repository cleanup: remove stale monolith") once the app moved to a `src/partials/*.html` + `build.js` architecture.
- They were never carried over into `src/partials/05-winners.html`/`99-shell-foot.html`.
- `vercel.json` builds and deploys `dist/`, generated **exclusively** from `src/partials/*.html` — confirmed directly (`outputDirectory: "dist"`, `buildCommand: "node build.js"`). The old `index.html` was never part of what actually ships.
- Net effect: `winnersModule.openAddWinnerModal()` still existed in `winners.js` but its target (`#addWinnerModal`) didn't exist anywhere in the real page, so the button call (had a button existed) would have silently no-op'd (`if (!modalEl) return;`).

**Restored** the button and modal, and while restoring it, found it would have **still been broken** even with the UI back:
- The organisation dropdown queried `organisations.name` — that column doesn't exist (real column: `company_name`). Confirmed directly against the live database.
- The save handler tried to insert `placement`, `notes`, and `status` into the `winners` table — none of those columns exist (confirmed against the real table: no `placement`, no `notes`, and the real status column is `winner_status`, not `status`). This insert would have failed outright the moment anyone tried to use the restored feature.

Fixed all three: the dropdown now queries `company_name`; the save handler now inserts `winner_story` (a real column, matching the documented "add photos, a winner story, and a judge quote" step) and `winner_status: 'pending'`, dropped the non-existent Placement/Notes fields from the form entirely. Rebuilt and confirmed the restored modal and button are present in the actual `dist/index.html` output. Full test suite (68 suites, 6470 tests) and lint remain clean.

Documented, not fixed: Winners' row actions are individual icon-only buttons (up to 7-8 wide) with **no Edit button at all** — there's no obvious way to correct a winner's name/details from the table itself (only Media, Certificate, Resend, Media Pack, Winner Package, Trophy toggle, Seating, Delete). Worth adding in a follow-up pass.

### Reports
Sampled `reporting.js`'s export/error-toast pairs across five report types — consistent "X exported" / "Failed to export X" pattern throughout, no issues found. One dead-UI note: a fully-built "Scheduled Reports" card with a wired-up button is hard-coded `d-none` in `08-events.html` — inert markup shipped to production. Low priority; either finish or remove.

### Settings
Genuine, working features exist here that **were never documented**: Two-Factor Authentication (real TOTP enrollment via Supabase's native MFA API — `settings.js` confirmed, not a stub), Login History, and Outbound Webhooks. Added a new §12 to `ADMIN-GUIDE.md` covering both, since a non-technical administrator reading the guide had no way to know these existed.

---

## Public Website Journey

### The two genuinely public, working pages — verified against live data
`public-voting.html` and `public-winners.html` both work correctly for anonymous visitors, confirmed by calling their real API (`/api/voting-proxy`) directly: real search/filter (award dropdown, URL-param pre-filtering), genuine empty states with clear copy ("No winners have been announced yet. Check back soon!"), and visible error handling on failure (not silent). This matches and reconfirms the prior rehearsal's Phase 7 findings.

### The most significant new finding: three pages that aren't actually public
`award_companies.html`, `award-nominees.html`, and `company-profile.html` sit at the repo root alongside the real public pages and look like "browse nominees / view a company" pages — but are not functional for a genuine anonymous visitor:
- Both `award_companies.html` and `company-profile.html`'s primary data load calls `proxyFetch()` (`public-utils.js`), which throws `'Not authenticated'` whenever there's no live Supabase session — true for essentially every real anonymous visitor. Neither has a try/catch around that call, so for a real visitor these pages hang on "Loading…" forever, with a silent unhandled rejection in the console. (`award-nominees.html` at least shows a visible "Please log in" state — the better, existing pattern.)
- `award-nominees-app.js` additionally queries `organisations` filtered by `award_name` and selects a `region` column directly on `organisations` — neither exists in the current schema (confirmed live: `organisations` has no `award_name`/`region` columns, only `area_id`/`county_city`). Even a *logged-in* user would get broken results from this page.
- Nothing in the real public site (`home.html`, `public-voting.js`, `public-winners-app.js`) or the admin CMS (`organisations.js`, `awards.js`, etc.) links to any of these three pages — confirmed via a repo-wide grep. They only link to each other.

**Conclusion: this is a disconnected, vestigial cluster from an earlier architecture, superseded by `public-voting.html`/`public-winners.html`, left in place but never wired to the current schema or the rest of the app.** Not fixed in this pass — patching their error handling would just make a fundamentally broken, orphaned feature fail a little more gracefully, not make it correct. **Recommend a deliberate decision: remove these three pages, or schedule a proper rebuild against the current schema using the public `voting-proxy` pattern** if genuine public "browse by category/organisation" pages are wanted. Until then, they are effectively dead code that happens to be reachable by direct URL.

### Fixed this pass
- **`og:url`** was present only on `home.html`; missing from every other public page with Open Graph tags. Extended `build.js`'s existing og:image-absolutizing step to also inject `og:url` on any page with `og:title` but no `og:url` — now present on `public-winners.html`, `public-voting.html`, `vote.html`, and `company-profile.html`.
- **Missing `aria-label`** on the mobile hamburger button — present correctly on `home.html`/`public-voting.html`, missing on `award_companies.html`, `award-nominees.html`, `public-winners.html`, and `company-profile.html`. Added `aria-label="Open navigation menu"` to all four for a consistent accessible name.

### Documented, not fixed
- **Placeholder company details in every public footer** (`[Company Name Placeholder]`, `Reg. No. [PLACEHOLDER]`, `[Address Placeholder]`) — real, customer-facing text that would go live as-is. This is an already-tracked gap (`LAUNCH-CHECKLIST.md`'s "Known, Accepted Gaps" section) requiring the user's real registered company details, which I don't have and can't fabricate.
- **No canonical URL** on 5 of the 6 audited pages (only `home.html` has one), and **no JSON-LD structured data anywhere** — both pre-existing, already-tracked gaps (`V1.1-BACKLOG.md`).
- **`home.html`'s header/footer markup structurally differs** from the shared "sh-" header/footer pattern used by the 5 other legitimately-public pages, despite `CLAUDE.md` naming `home.html` the master template others should align with. Reconciling this is a larger design-consistency pass, not a one-line fix.
- **`company-profile.html`'s 13 form `<label>` elements have no `for` attribute**, so none is programmatically associated with its input — screen readers won't announce them. Not fixed, since this page is one of the three recommended for removal/rebuild above; fixing its accessibility now would be wasted effort if it's removed shortly.

---

## Consistency Review

Standardized where cheap and unambiguous (see Administrator Journey above for each). Surveyed and documented, not mass-edited, given the number of files touched would carry more risk than value under this review's time budget:

- **Terminology drift** for the same underlying concept: a submitted company is called "Nominee" (Awards tab), "Entry"/"Entrant" (Entries and Organisations tabs, sometimes both in the *same* pipeline), and there's a fourth adjacent term, "Nomination Source", on the Entries filter bar. "Company" vs "Organisation" also drifts across CRM's subtitle text vs. every other tab's own naming.
- **Create-button label varies by tab and sometimes within one modal**: "Add Award" opens a modal that submits via "Create Award"; "Add Organisation" submits via "Save Organisation"; "Add Winner" (now restored) submits via "Save Winner". Not necessarily wrong (many apps use "Save" as a generic submit verb) but genuinely inconsistent across tabs.
- **Row-action UI pattern varies by tab**: Awards uses one "⋮" dropdown; Entries uses individual labeled icon+text buttons; Winners uses up to 7-8 icon-only buttons with no dropdown; Organisations uses 2 icon-only buttons. No single tab is wrong, but a new administrator learns four different interaction patterns for the same underlying concept ("do something to this row").
- **Toast punctuation** varies: some end in "!", some in ".", most in nothing, for functionally identical "record saved" toasts across Awards/Organisations/Entries/Winners/Media.
- **Getting-Started banner treatment**: every tab uses a plain white card with numbered circular badges, except Dashboard, which uses a distinct gradient hero-block with a rocket icon for the same underlying feature.

None of the above block launch; all are real, and worth a dedicated consistency pass once the platform has been live for a stretch and the highest-value polish items are clearer from real usage (consistent with `V1.1-BACKLOG.md`'s existing framing).

---

## Administrator Documentation

`ADMIN-GUIDE.md` re-read in full and updated:
- New §12 "Security & Integrations" documenting 2FA, Login History, and Outbound Webhooks — real, working features that existed in the product but were never written up anywhere.
- Added the no-self-service-password-reset caveat to §11, a matching Troubleshooting entry in §13, and a "keep ≥2 Super Admins" line in §14 Best Practices.
- Everything else in the guide was re-checked against the actual current workflows (login, Award Areas import, Organisations, Awards, Entries, Winners, Users) and found accurate, including the fixes from the prior rehearsal.

---

## Release Documentation

`RELEASE-REPORT-V1.md` and `RELEASE-CANDIDATE-SIGNOFF.md` were already corrected in the prior rehearsal pass for the importer-specific claims (the "batches inserts in groups of 50" claim that turned out to be false). No further corrections were needed in those two files for this pass's findings — the Add Winner defect and public-site findings are new discoveries, not corrections to existing claims in those documents, and are recorded here and in `ADMIN-GUIDE.md` instead. `DEPLOYMENT-GUIDE.md`, `PRODUCTION-DEPLOYMENT-PLAN.md`, and `FIRST-COUNTY-IMPORT-GUIDE.md` were checked and contain no claims contradicted by anything found in this pass.

---

## Production Confidence

**If this were my own commercial SaaS platform, would I now feel comfortable importing the real Somerset workbook?** Yes. Both rehearsals — the data-layer one and this UX one — found genuine defects and fixed them in the same pass, re-verified against a live Supabase project each time. The import pipeline itself is now solid.

**Would I feel comfortable importing every remaining county workbook afterwards?** Yes, with the same expectation set in the prior report: each real county file will likely surface a handful of category-name near-misses and incomplete rows on first upload — that's the validation working as intended, not a defect to fix.

**Is there anything I would still change before launch?** Two things, specifically:
1. The missing self-service password reset — a real risk if the only Super Admin is ever locked out. Mitigated for now (keep ≥2 Super Admins), but I'd want the real feature before relying on a single admin long-term.
2. A conscious decision on the three orphaned public pages (`award_companies.html`, `award-nominees.html`, `company-profile.html`) — remove them or schedule a proper rebuild. They're currently reachable by direct URL and would confuse or silently fail for anyone who lands on them, even though nothing in the live product links to them today.

**Is there any part of the platform that I believe has not been sufficiently verified?** Yes, plainly: I could not run a live, fully-authenticated browser session against either the admin CMS or the public site in this sandbox (a proxy/Chromium networking limitation, stated clearly rather than glossed over). Everything reported here was verified via direct API calls, live database queries, and source-code tracing — rigorous, but not the same as watching it render and clicking through it. I also did not exercise live Stripe checkout, real SMTP email delivery, or the 2FA enrollment round-trip in this pass.

**Are there any areas that deserve one more focused audit?** A live-browser pass once tooling allows it; a deliberate decision (and follow-through) on the three orphaned public pages; and, at some point after real usage, the terminology/button-label consistency sweep documented above rather than rushed here.

---

## Final Verdict

**⚠ Production Ready After Minor Improvements**

Not choosing "Production Ready" honestly: I found and fixed a genuinely broken, documented feature (Add Winner) that would have embarrassed a real administrator on day one, plus its two follow-on schema bugs that would have broken it again immediately even after restoring the UI. I also identified — but deliberately did not rush a fix for — a real authentication gap (no self-service password reset) and an architectural question (three orphaned public pages) that a commercial launch should resolve deliberately rather than have discovered by an administrator or a customer first. I could not complete live-browser verification in this environment. Given all of that, I would not personally sign this off as fully launch-ready without those two open items being consciously addressed first — but nothing found in either rehearsal is a reason to delay significantly; both are bounded, well-understood, and small relative to the size of what's already been verified working.
