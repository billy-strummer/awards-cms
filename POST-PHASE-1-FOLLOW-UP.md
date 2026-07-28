# Post-Phase-1 Follow-Up

Companion to `ORGANISATION-MATCHING-FIX-REPORT.md`. Phase 1 (organisation-matching cross-area collision and ILIKE wildcard fixes, commits `4ac4c79`/`81e53e0`) is complete and requires no further changes to ship. This document tracks every remaining item raised during design, implementation, and the final adversarial review, so none are lost, without reopening Phase 1 for polish.

None of the items below are required before merging Phase 1.

---

## 1. Potential correctness improvements

### 1.1 Backfill `area_id` on legacy organisations
- **Priority:** Medium
- **Rationale:** Organisations created via `handleSubmitEntry`, `handleSubmitNomination`, or the CSV importer *before* Phase 1 have `area_id: null`, and are therefore permanently unreachable by the new area-scoped lookup. A genuine repeat submission from the same company will create a duplicate organisation instead of finding the legacy one. Fails in the safe direction (duplicate creation, not incorrect matching) but degrades data quality over time.
- **Estimated effort:** Small — a one-time script resolving `area_id` from each legacy organisation's existing `county_city` text against `areas.display_name`, no application code change.
- **Independent of Phase 1:** Yes, fully. Pure data remediation.

### 1.2 Case-sensitive area lookup in `handleSubmitNomination()`
- **Priority:** Low
- **Rationale:** `.eq('display_name', safe.countyCity)` is case-sensitive, while organisation-name matching in the same function is deliberately case-insensitive. A casing mismatch causes the safe "always create new" fallback to fire rather than an incorrect match — no security or corruption risk. No evidence this is currently happening in practice; not worth action without such evidence, per explicit decision this session.
- **Estimated effort:** Small — align to case-insensitive matching with proper escaping, plus one regression test.
- **Independent of Phase 1:** Yes.

### 1.3 `display_name` area lookups are not scoped by country
- **Priority:** Low (future-proofing, not a current defect)
- **Rationale:** `areas` has `UNIQUE(display_name, country)`, not `UNIQUE(display_name)` alone — a `display_name` is only guaranteed unique *within* a country, not across all of them. Three lookups key on `display_name` alone, without a `country` filter: `handleSubmitNomination()`'s area resolution (`entry-proxy.js`), and `organisations.js`'s CSV importer area resolution (used in both `_applyMapping()` and `executeCSVImport()`, via `(locationModule._cachedAreas || []).find((a) => a.display_name === selectedCounty)`). Today this is a non-issue: the dataset is UK-only and current UK county/city names in `areas` don't collide with each other. It becomes a real ambiguity only if a future territory introduces a `display_name` that duplicates an existing one under a different `country` — at that point `.limit(1)` (or `.find()`) could resolve to the wrong country's area, which would then incorrectly scope organisation matching to that area rather than failing safe.
- **Estimated effort:** Small — add a `country` (or `region_id`) filter alongside each `display_name` lookup, once a concrete multi-country scenario exists to test against.
- **Independent of Phase 1:** Yes.

---

## 2. Technical debt

### 2.1 No dedicated automated test for `executeCSVImport()`'s `area_id` tagging
- **Priority:** Medium
- **Rationale:** This function has no existing `apiClient`/`confirmDialog` mock infrastructure in the test suite, unlike `_applyMapping()`. The `area_id`-tagging change was verified by direct code review only. Low risk given the change's simplicity, but it's the one piece of Phase 1's behavioural change without automated coverage.
- **Estimated effort:** Medium — requires building new mock infrastructure for this function before the test itself is trivial.
- **Independent of Phase 1:** Yes.

### 2.2 Inconsistent test-mocking strategy between `data-proxy.test.js` and `entry-proxy.test.js`
- **Priority:** Low–Medium
- **Rationale:** `data-proxy.test.js`'s new tests use a table-name-dispatched mock (robust to call reordering); `entry-proxy.test.js` uses pre-existing, position-based mock sequencing (fragile — any future change to call count/order elsewhere in a handler silently misaligns every subsequent test). Phase 1 extended the position-based pattern rather than migrating it. Doesn't weaken current test coverage, but a future refactor of either handler is more likely to produce confusing, unrelated-looking test failures in `entry-proxy.test.js` than in `data-proxy.test.js`.
- **Estimated effort:** Medium — migrating `entry-proxy.test.js`'s ~15 affected tests to a table-aware dispatch pattern.
- **Independent of Phase 1:** Yes.

### 2.3 Duplicated area-resolution snippet in `organisations.js`
- **Priority:** Low
- **Rationale:** `(locationModule._cachedAreas || []).find((a) => a.display_name === selectedCounty)` appears identically in both `_applyMapping()` and `executeCSVImport()`. Purely cosmetic; zero behavioural risk either way.
- **Estimated effort:** Trivial — extract to one local method (e.g. `_resolveAreaId(displayName)`).
- **Independent of Phase 1:** Yes.

---

## 3. Code consistency / style

### 3.1 Simplify the helper's return statement
- **Priority:** Low
- **Rationale:** `return data && data[0] ? data[0].id : null;` could be `return data?.[0]?.id ?? null;`, consistent with optional chaining already used throughout the codebase. Purely cosmetic.
- **Estimated effort:** Trivial.
- **Independent of Phase 1:** Yes.

### 3.2 Helper parameter order vs. `api/_lib/auth.js`'s `getUserRole` convention
- **Priority:** Low
- **Rationale:** `getUserRole(userEmail, supabaseClient)` takes the Supabase client last and optional; `findMatchingOrganisation(supabase, companyName, areaId)` takes it first and required. Defensible on its own terms (every caller already has a client in scope), but inconsistent with the one directly comparable precedent in the same directory. Confirmed as a preference, not a defect.
- **Estimated effort:** Trivial code change, touches 3 call sites plus their tests.
- **Independent of Phase 1:** Yes.

### 3.3 Add explanatory inline comments
- **Priority:** Low
- **Rationale:** Two spots would benefit a future maintainer: a warning on `handleSubmitNomination`'s area lookup against switching to `.ilike()` without escaping (see 1.2), and a cross-reference between `organisations.js`'s client-side matching and `api/_lib/organisation-matching.js` so an edit to one prompts a check of the other.
- **Estimated effort:** Trivial.
- **Independent of Phase 1:** Yes.

### 3.4 Reconsider whether `escapeLikePattern` should remain exported
- **Priority:** Low
- **Rationale:** Exporting it enabled direct unit testing but slightly widens the module's public surface beyond what callers need, with a small theoretical risk of reuse for unrelated `ILIKE` calls elsewhere. No evidence of actual misuse; confirmed as a preference, not a defect.
- **Estimated effort:** Trivial (unexport, rely on `findMatchingOrganisation`'s behavioural tests for indirect coverage) — if ever acted on.
- **Independent of Phase 1:** Yes.

---

## 4. Longer-term architectural work

### 4.1 Phase 2 — Location data single source of truth
- **Priority:** High
- **Rationale:** Three independent, drifted static location-data sources exist (`home-data.js`'s `REGION_DATA` and duplicate `LONDON_BOROUGHS` array, `config.js`'s `REGIONS_GROUPED`/`COUNTIES_CITIES`), none generated from or synchronised with the authoritative `areas`/`regions` tables. Two confirmed live data-quality defects sit within this untouched area (`"Kingston & Richmond"`/`"Middlesex"` have no corresponding `areas` row; the entire Northern Ireland branch has zero corresponding rows). Phase 1's fallback behaviour absorbs these safely but doesn't fix the underlying gap. Already scoped separately with its own problem statement, recommended architecture, implementation approach, risks, and dependencies.
- **Estimated effort:** Large — touches three public-facing pages' load behaviour, two data files, a new/extended public endpoint, and changes a currently-synchronous data-loading model to asynchronous. Own design/review cycle.
- **Independent of Phase 1:** Yes — Phase 1 does not depend on this, and this does not require reopening Phase 1 code.

### 4.2 Northern Ireland support — business decision required
- **Priority:** Medium (blocks part of 4.1's scope until resolved)
- **Rationale:** `home-data.js`'s public form offers a full Northern Ireland hierarchy with zero corresponding `areas` rows. This is a product/business decision (add real NI area data, or remove the branch from the public form), not an engineering one — engineering effort is small once the decision is made.
- **Estimated effort:** Decision: none (business input required). Implementation once decided: Small.
- **Independent of Phase 1:** Yes.

### 4.3 Revisit full client/server matching unification (Option B)
- **Priority:** Low / speculative
- **Rationale:** Phase 1 deliberately kept the Organisations tab CSV importer's client-side matching separate from the shared server-side helper (Option A), since unifying them would require either moving the importer's duplicate-detection preview server-side or exposing the helper for client-side preview calls — larger in scope than the two confirmed defects required. Worth revisiting only if that importer's workflow changes for unrelated reasons.
- **Estimated effort:** Medium–Large, conditional on a trigger that hasn't occurred.
- **Independent of Phase 1:** Yes.

---

**Phase 1 status: complete.** No item above is required before merge. Branch `claude/supabase-cms-setup-test-e6oiza` is ready for PR review.
