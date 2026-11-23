# BTA-090 — Automated Test Coverage Review

**Date:** 2026-11-02
**Scope:** read-only review of `tests/*.test.js` (83 suites) against critical business workflows. No test or application file was modified. The existing suite was run (non-mutating) to establish a current baseline.

## Executive summary

The suite is large (83 suites, 6,815 tests) and unusually strong in the areas that received dedicated remediation work this project (GDPR: 101 tests; `data-proxy.js` role gating: 60 tests; `settings.js` custom sector/category CRUD: 12 tests). It is comparatively thin in two places with real business impact: the **public-facing winners display page** (`public-winners-app.js`, only 3 tests covering 1 of 6 functions) and **geography/area-matching infrastructure** (`areas-manager.test.js`: 4 tests, `location.test.js`: 3 tests) given how much of this project's own history (Northern Ireland exclusion, area-scoped award matching) depends on that code being correct. One test file (`tests/migration-093.test.js`) is explicitly and only a static-source-text check, not a behavioural test — already clearly labelled as such in its own header, and the only file in the suite with that limitation (confirmed by checking every other file that uses `readFileSync`; the other six all load real code into a JSDOM environment and exercise it behaviourally, not just read its text).

## Baseline test run

```
npx jest
```
```
Test Suites: 82 passed, 82 total
Tests:       3 skipped, 6812 passed, 6815 total
Snapshots:   0 total
Time:        31.555 s
```
(82 suites reported by Jest vs. 83 files on disk — `tests/setup.js` is a shared setup file, not itself a test suite.) All passing; 3 skipped (not investigated further here — out of scope for a coverage review, but worth noting for a future pass: identify which 3 and why).

## Findings by workflow area

### Entry submission — Confirmed: solid
`tests/entry-proxy.test.js` (49 tests) and `tests/submit-entry.test.js` (113 tests, behavioural via JSDOM+script-injection) cover organisation creation vs. reuse (`'creates entry with existing organisation'`, line 264), area-resolution fallback to new-org creation (lines 320, 1062), and the BTA-061 area-vs-legacy-county matching fix (line 974) with its own regression test. No significant gap found.

### Nomination submission — Confirmed: adequate, narrower than entry submission
`tests/nominate.test.js` (18 tests) and `tests/industry-leader.test.js` (37 tests). Fewer tests than the entry path, but both load the real script behaviourally. Not deeply compared line-by-line against entry-proxy's coverage breadth in this pass — **Potential** gap: nomination's own area/duplicate-handling edge cases may not be as exhaustively covered as entries' are, since nomination reuses `findMatchingOrganisation` but wasn't checked here for every one of entry's edge-case tests having a nomination equivalent.

### Organisation matching — Confirmed: the shared helper is well-tested in isolation
`tests/organisation-matching.test.js` (11 tests) thoroughly covers `escapeLikePattern` and `findMatchingOrganisation` as pure functions (LIKE-escaping, null/undefined `areaId` short-circuits, area-scoped query construction, error propagation, "lookup only, never mutates" — line 101). **Potential gap:** no single test exercises the full "two submissions for the same org/area produce one row, not two" outcome end-to-end through a real caller; the unit-level guarantee is strong, but the integration-level guarantee rests on each caller's own mocked tests instead.

### Area/award matching, custom sectors/categories — Confirmed: sectors/categories strong, geography infrastructure thin
`tests/settings.test.js` has 12 well-targeted tests for custom sector/category CRUD (add/edit/delete/duplicate-rejection/location-scoping, lines 1386-1515). By contrast, **Confirmed gap:** `tests/areas-manager.test.js` has only 4 tests and `tests/location.test.js` only 3, for the two files CLAUDE.md itself flags as central to the permanent Northern-Ireland-exclusion business rule and to area-scoped award eligibility. Given this project's own history of repeatedly re-verifying "no NI reintroduction" by grep rather than by a dedicated regression test, a named test asserting the supported-country list is exactly `['England', 'Scotland', 'Wales']` (or equivalent) would catch a future regression mechanically instead of relying on manual audits every few tasks.

### GDPR export, erasure, anonymisation — Confirmed: the strongest-covered workflow in the suite
`tests/gdpr.test.js`, 101 tests (count includes `describe`/`test` combined). Covers: canonical table names, org-scoping, missing-org handling for all three operations (export/delete/anonymize), already-completed-request guards, RPC return-contract interpretation (`'erased'`/`'not_found'`/`'anonymized'`), unsupported-request-type rejection, and multiple specifically-named BTA-076/077 regression tests. No gap found that isn't already a documented, deliberate out-of-scope item (e.g., the audit-log-timing limitation, which is a known architectural limitation, not a test gap).

### Sponsorship catalogue — Confirmed: adequate for current scope
`tests/become-a-sponsor-packages.test.js` (9 tests) + `tests/marketing.test.js` (128 tests, broader than just sponsorship). Covers enquiry-destination consumption and static-fallback-when-empty behaviour (per BTA-073/077's own findings). Not independently re-verified line-by-line in this pass beyond confirming the file exists and has a non-trivial test count.

### Role-based permissions — Confirmed: strong at the data-proxy layer
`tests/data-proxy.test.js` (60 tests) and `tests/data-proxy-user-management.test.js` (11 tests) include the specific "role X cannot call RPC Y" / "super_admin can call RPC Y" pairing style (e.g. `erase_organisation_gdpr`/`anonymize_organisation` role-gate tests referenced in BTA-076/077's own work). **Potential, not confirmed:** `tests/certificates-qr-role-gate.test.js`, `tests/judge-automation-role-gate.test.js`, `tests/social-media-api-role-gate.test.js` are all named "-role-gate" and likely test only the denial path for insufficient roles — worth a follow-up check (not done here, out of time budget for this pass) on whether each also has a matching success-path test for the correct role, or only ever tests "wrong role → 403."

### Public forms — Confirmed: well covered for submission; thin for the public winners display
Entry/nomination forms are well covered (see above). **Confirmed gap, most significant finding of this review:** `tests/public-winners-app.test.js` has only 3 tests, all for one function (`placementLabel`). Reading `public-winners-app.js` directly (166 lines) shows 6 functions: `placementLabel` (tested), `placementBadgeClass`, `shareLinks`, `renderWinners` (the actual grouping/HTML-rendering logic, including where `company_name`/`award_name` are interpolated — the relevant XSS-escaping surface), `loadWinners`'s own filter logic (line 127), and its `catch` block (line 155, the empty/error state a real site visitor would see on a backend failure) — **none of these five are tested at all.** This is the single highest-value concrete gap found in this review given it is the actual public-facing winners page.

### Migration structural tests — Confirmed, already correctly caveated
`tests/migration-093.test.js` (9 `test.each`-expanded blocks, ~40 individual assertions) is **explicitly and only** a static check of the SQL source text — it cannot and does not prove anything about live Postgres behaviour. Its own file header already states this plainly ("These tests parse the migration's SQL source text... They cannot execute the SQL or prove what Postgres would actually do with it"). This is the right level of honesty for a test that exists specifically because no live database is reachable (see BTA-078/079/081/082) — flagged here only so this review's own "tests that only inspect source text" check is answered explicitly: this is the one and only such file in the suite.

### Winner and placement display — Confirmed: admin-side strong, public-side thin (see above)
`tests/winners.test.js` has 255 tests — very strong coverage of the admin winners module. `tests/public-winners-app.test.js`'s 3 tests are the gap, not `winners.test.js`.

### Error handling / API input validation — Potential, not exhaustively checked
Spot-checked via the role-gate files and `data-proxy.test.js`'s error-path tests; a systematic file-by-file audit of every `api/*.js` handler's input-validation test coverage was not performed in this pass (would be its own multi-hour task) — recorded as **Unknown** at the aggregate level, though no specific missing validation test was found where checked.

### Flaky/environment-dependent tests — Potential: not found, not exhaustively ruled out
No hardcoded real-world date comparison or un-mocked real timer was found in the files sampled in this pass. A full repository-wide grep for `new Date()`/`Date.now()` outside of explicit `jest.useFakeTimers()` blocks was not performed — recorded as **Unknown** rather than claimed clean.

## Prioritised test-gap list

1. **(Highest priority) `public-winners-app.js` — add tests for `renderWinners`, `placementBadgeClass`, `shareLinks`, `loadWinners`'s filter, and its error/catch path.**
   - `renders winners grouped by award category with escaped company and award names` — assert `renderWinners` HTML-escapes a company name containing `<script>` before interpolating it.
   - `shows an empty/error state when the voting-proxy fetch fails` — mock `fetch` to reject or return `ok: false`, assert `#winnersContent` shows a user-facing message, not a blank page or a thrown error.
   - `filters out winners with no organisation or award_name before rendering` — exercise the `filtered = data.winners.filter(...)` branch at line 127 with a mixed-validity winners array.
   - `shareLinks produces correctly-encoded URLs for a company/award name containing special characters`.

2. **`areas-manager.js`/`location.js` — add an explicit, named regression test asserting the supported-country list.**
   - `supported countries are exactly England, Scotland and Wales (Northern Ireland permanently excluded)` — a single assertion against the actual exported constant/array, so a future accidental reintroduction fails CI immediately instead of requiring another manual grep-based audit.

3. **Role-gate test files — confirm each has a matching allowed-role success test, not only the denial path.**
   - For `certificates-qr-role-gate.test.js`, `judge-automation-role-gate.test.js`, `social-media-api-role-gate.test.js`: `the correct minimum role can successfully call <action>` for each gated action, alongside the existing denial tests.

4. **Nomination-path parity check against entry-path coverage.**
   - Compare `tests/nominate.test.js`/`industry-leader.test.js` test-by-test against `tests/entry-proxy.test.js` for any area/duplicate/fallback scenario covered on the entry side but not the nomination side; add the missing equivalents.

5. **(Lower priority, larger effort) Systematic input-validation coverage audit across all 12 `api/*.js` handlers.** Not started in this pass; would need its own task.

## Classification summary

| Area | Classification |
|---|---|
| Entry submission coverage | Confirmed — solid |
| GDPR workflow coverage | Confirmed — strongest in suite |
| Custom sector/category coverage | Confirmed — solid |
| `public-winners-app.js` coverage gap | **Confirmed — significant** |
| `areas-manager.js`/`location.js` coverage thinness | **Confirmed — significant given business-rule history** |
| migration-093.test.js being static-only | Confirmed, already correctly self-disclosed |
| Nomination-vs-entry parity | Potential |
| Role-gate success-path coverage | Potential |
| Sponsorship catalogue coverage | Confirmed — adequate (not exhaustively re-verified) |
| Error-handling/input-validation breadth | Unknown (aggregate) |
| Flaky/environment-dependent tests | Unknown |
| 3 skipped tests — identity/reason | Unknown (not investigated) |
