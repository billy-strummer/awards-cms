# BTA-088 — Public Website and Forms Audit

**Date:** 2026-11-02. **Type:** read-only code audit. No public page was modified, no real submission was made, no live network call occurred. All findings are from static inspection of the current repository.

## Executive summary

The public website's **two nomination-type forms — `nominate.html` and `industry-leader.html` — are both completely broken**: every submission from either page will be rejected by the server with a 400 error, because the payload each one sends does not match what `api/entry-proxy.js`'s `handleSubmitNomination` now requires. This is a **Confirmed, Critical** finding with a direct, demonstrable impact on real users: no one can currently submit a nomination through either public journey. By contrast, the main entry form (`submit-entry.html`/`submit-entry.js`) is correctly wired to its handler — its field names match `handleSubmitEntry`'s destructuring exactly. A handful of smaller SEO/metadata and minor data-loss issues were also found. CMS-content wiring (`form_content`, `page_seo`) was independently re-confirmed correct, consistent with prior tasks' findings.

## Findings by page/journey

### 1. Nomination form (`nominate.html` / `nominate.js`) — **Confirmed, Critical**

`nominate.js`'s `buildPayload()` (lines 126–138) sends:
```
{ action: 'submit_nomination', nomineeName, nomineeWebsite, nomineePhone, nomineeWorkDesc,
  nominationReason, nominatorName, nominatorEmail, nominatorPhone }
```
`api/entry-proxy.js`'s `handleSubmitNomination` (line 973) destructures `req.body` and **requires** `awardCategory` as its very first validation (line ~1001: `if (!awardCategory || typeof awardCategory !== 'string') return res.status(400)...`). `nominate.js` never collects or sends `awardCategory` — `nominate.html` has no such field anywhere (confirmed by grep: no `awardCategory`, no `<select>` for category). **Every submission from this page fails immediately** with `"Award category is required"`, before any other field is even checked. Even if that were fixed, the handler also requires `nomineeCompany` (non-"New Business" branch) or `businessName`/`businessOwner` ("New Business" branch) — none of which `nominate.js` sends either (it sends `nomineeWorkDesc` instead, a field the handler never reads).

This form is reachable and linked from the live site: `about.html:195` ("Nominate Someone") and `submit-entry.html:827` ("Nominate") both link to `nominate.html`, and it is included in `build.js`'s public-page list (line 302) — this is not an orphaned page.

**Secondary, independent defect on the same page:** `nominate.html` has a labelled, optional `nominatorArea` text input (lines 419–424, "In what county or city are you based?") that `nominate.js`'s `buildPayload()` never reads — any value a user types into it is silently discarded and never sent anywhere, even before the above 400 error would occur.

### 2. Industry Leader nomination (`industry-leader.html` / `industry-leader.js`) — **Confirmed, Critical**

`industry-leader.js`'s `submitNomination` (line 812) sends:
```
{ action: 'submit_nomination', awardCategory, county_city, london_borough, nominationReason,
  nominatorName, nominatorEmail, nominatorPhone, nomineeName, nomineeWebsite, nomineePhone, nomineeWorkDesc }
```
This page *does* send `awardCategory` (good — it passes the server's first check). However:
- If the selected category is `'New Business of the Year'` (a real, selectable option — line 66's category list), the handler requires `businessName` and `businessOwner`, neither of which this form ever collects or sends — **400 "Business name is required"**.
- For every other category, the handler requires `nomineeCompany` (min 2 chars) in addition to `nomineeName`. `industry-leader.js` never sends `nomineeCompany` — it only sends `nomineeWorkDesc`, a field the handler does not read at all. **400 "Nominee company is required"**.
- Confirmed via `updateNomineeFields` (line 302): this function is an explicit, intentional no-op — its own comment states *"Step 3 now uses a single set of company/trade professional fields"* — meaning the form was deliberately simplified to one shared field set at some point, after `handleSubmitNomination` had already diverged to expect a Person-vs-New-Business field split. The two sides were never reconciled.

**Every submission from this page also fails, in both of its two possible code paths.** Combined with Finding 1, this means neither of the site's two nomination journeys can currently be completed by a real user.

**Likely root cause (not fixed, per task scope):** `handleSubmitNomination` appears to have been written or extended for a richer, award-category/business-vs-person nomination model that neither client-side form was ever updated to match, or the forms were later simplified without the server catching up. Reconciling the two is an implementation task, not something addressed here.

### 3. Public entry form (`submit-entry.html` / `submit-entry.js`) — Confirmed working

`submitEntry()` (line 1077) sends `companyName`, `selected_country`, `region_group`, `county_city`, `london_borough`, `sector`, `contactEmail`, `contactName`, `contactPhone`, `companyWebsite`, `awardCategory`, `entryDescription`, `supportingInfo`, `tradeBodies`, `accreditations`, `employeeCount`, `contactPosition`. Cross-checked against `handleSubmitEntry`'s destructuring (`api/entry-proxy.js:723`) — every required field (`companyName`, `contactEmail`, `awardCategory`, etc.) is present and named identically. This form's server-side contract is intact. (`selected_country`/`region_group`/`london_borough` are sent but not destructured server-side — harmless unused fields, not an error.)

### 4. Sponsorship page (`become-a-sponsor.html` / `become-a-sponsor-packages.js`) — Confirmed working, minor SEO gap

Package fetch/render/enquiry-redirect logic (already verified by prior tasks, re-confirmed here by reading the file) is correct and has a safe static fallback. No form submission on this page itself (enquiry is a redirect or scroll-to-contact, not a proxy call). **Minor, Confirmed:** the page has a static `<meta name="description">` but **no Open Graph tags at all** in its HTML (`og:title`/`og:description` absent — confirmed by grep across all 4 relevant pages). `public-site-settings.js`'s `applyPageSeo` (line 199) only *creates* these tags when an admin has configured a `page_seo` override for the `become-a-sponsor` slug; absent an override, the page ships with zero social-preview tags, unlike `home.html`, which has them hardcoded as a sensible default (lines 8–9). Low severity — affects only social-media link previews, not functionality.

### 5. Metadata/SEO — Confirmed gap on two pages

`submit-entry.html` and `industry-leader.html` have **no `<meta name="description">` tag at all** in their static HTML (confirmed by grep; `home.html` and `become-a-sponsor.html` both have one). These two pages rely entirely on `form_content`'s `metaDescription`/`pageTitle` JS injection for a description to exist at all — if that fetch fails or the admin never configures it, the page ships with no description meta tag whatsoever, not even a generic fallback. Low severity, confirmed.

### 6. Shared nav/footer CMS sync — Potential, not fully verified

`submit-entry.html`, `industry-leader.html`, and `nominate.html` do **not** include `public-site-settings.js` at all (confirmed by grep — only `become-a-sponsor.html` includes it). This means any CMS-configured nav-label or footer-link change (via `settings.js`'s nav/footer admin UI) would not propagate to these three forms' own header/footer, if they have one — they would show hardcoded content regardless. Not independently confirmed whether these pages even have a syncable nav/footer worth updating (not traced further given scope/time); recorded as Potential rather than Confirmed.

### 7. Validation, confirmation and error states — Confirmed, generally sound

All four forms (`submit-entry.js`, `nominate.js`, `industry-leader.js`, and `become-a-sponsor-packages.js`'s read path) show a toast or inline error on failure rather than failing silently, and swap to a visible success/confirmation state rather than a blank page on success. `nominate.js`'s `handleSubmit` (line 140) and `industry-leader.js`'s `submitNomination` both correctly re-enable the submit button and show the real error message on failure — this part of the error-handling design is sound; it is the *payload shape*, not the error handling around it, that is broken.

### 8. Accessibility and mobile — spot-checked, no defects found in the sample

`nominate.html` has `aria-label` on its home link, `<label for="...">` correctly associated with every input (lines 344–430), and an `alt` attribute on its logo image. All four pages declare a responsive `<meta name="viewport">` tag. Full rendered-layout/contrast verification would require a real browser, which this static audit cannot do — not claimed as proof of full accessibility compliance, only that the sampled static markup shows no obvious defect.

### 9. CMS-content wiring — Re-confirmed correct (not re-derived)

Cross-checked against `BTA-CMS-PROJECT-TASKS.md`'s existing findings (Sections N/O): `form_content`'s key structure (`submit_entry`/`industry_leader`/`nominate`, each with a `steps` map and `confirmationTitle`/`confirmationMessage`) is still exactly reflected in `nominate.js`'s `applyFormContent()` (line 181) and matches `api/entry-proxy.js`'s `handleGetPublicData`. No discrepancy found with the prior, already-verified report.

## Prioritised issue list

1. **Critical — `nominate.html`'s nomination journey cannot be completed.** `nominate.js` never sends `awardCategory` (or a correctly-named nominee-company field); `handleSubmitNomination` requires both. Every real submission fails with a 400 error.
2. **Critical — `industry-leader.html`'s nomination journey cannot be completed.** Same root handler mismatch; fails on `businessName`/`businessOwner` (New Business category) or `nomineeCompany` (every other category) in all cases.
3. **Low — data loss.** `nominate.html`'s `nominatorArea` field is collected from the user but never transmitted anywhere.
4. **Low — SEO.** `become-a-sponsor.html` has no static Open Graph fallback; `submit-entry.html`/`industry-leader.html` have no static meta-description fallback at all.
5. **Potential, unverified — nav/footer CMS sync** does not reach `submit-entry.html`/`industry-leader.html`/`nominate.html` (they don't load `public-site-settings.js`); impact depends on whether these pages have a nav/footer worth syncing, not independently confirmed this task.

No code was changed to address any of the above, per this task's read-only scope.
