# Organisation Matching — Implementation Report

**Status:** Phase 1 complete and merged to `claude/supabase-cms-setup-test-e6oiza` (commit `4ac4c79`)
**Scope:** Security/data-integrity fix to organisation matching across all server-side write paths, plus the client-side Organisations CSV importer.
**Phase 2 (deferred):** Location-data single-source-of-truth architecture — see [Known Limitations](#6-known-limitations) and [Follow-Up Recommendations](#7-follow-up-recommendations).

---

## 1. Executive Summary

### What problem was being solved

Every code path that creates an organisation record from user-supplied data — the Award Areas bulk importer, the two public entry/nomination submission endpoints, and the Organisations tab's CSV importer — independently implemented its own "does this organisation already exist?" check. That check had two defects, present in three of the four implementations:

1. **Unescaped `ILIKE` wildcard matching.** A company name containing a literal `%` or `_` was interpreted as a SQL wildcard rather than a literal character, letting an unrelated organisation match by accident.
2. **Unscoped, global matching.** The lookup considered every organisation in the system regardless of which award area it belonged to, so a company name that happened to recur in two different areas (or, on the two public endpoints, was crafted to collide with an existing one) would be silently reused — and, under the importer's `update`/`replace` duplicate-handling strategies, would have its area reassigned.

### Why it was important

Two of the three affected server-side paths (`handleSubmitEntry`, `handleSubmitNomination`) are **fully public, unauthenticated endpoints**. The wildcard and cross-area defects there meant any anonymous visitor could, without any admin review step, cause their submission to attach to — and in some cases begin polluting the contact/business data of — an unrelated, pre-existing organisation. The admin-facing Award Areas importer carried the same defects with a smaller but still real blast radius, given the project's plan to import 117 further county workbooks, several of which are statistically likely to contain company names that recur across counties.

### High-level outcome

A single, shared, read-only matching helper (`api/_lib/organisation-matching.js`) now backs all three server-side write paths, with escaping and area-scoping applied uniformly. The client-side CSV importer was updated in parallel to enforce the same business rule. All changes were verified through unit tests, integration-level regression tests, the full existing test suite (69 suites, 6498/6501 tests passing, 3 pre-existing unrelated skips), lint, build, and a live re-verification against the Claude TEST CMS Supabase project using the actual deployed code, which confirmed both original defects no longer reproduce.

---

## 2. Root Cause Analysis

### 2.1 ILIKE wildcard matching

Three call sites executed a query of the shape:

```
supabase.from('organisations').select('id').ilike('company_name', <user input>).limit(1)
```

PostgREST's `ilike` filter passes its argument through to Postgres's `ILIKE` operator unmodified. `ILIKE`, like `LIKE`, treats `%` (zero-or-more characters) and `_` (exactly one character) as wildcards unless explicitly escaped. None of the three call sites escaped the input before passing it to `ilike()`. A company name such as `"100% Group Roofing Ltd"` was therefore evaluated as the *pattern* `100% Group Roofing Ltd`, which matches any string starting with `100` and ending with `Group Roofing Ltd` — including the unrelated, pre-existing organisation `"100 Group Roofing Ltd"`.

This was proven directly against Postgres (not assumed from documentation):

```sql
SELECT ('100 Group Roofing Ltd' ILIKE '100% Group Roofing Ltd');  -- true
SELECT ('100 Group Roofing Ltd' ILIKE ('100\% Group Roofing Ltd'));  -- false (escaped)
```

### 2.2 Cross-area organisation collisions

`organisations.area_id` is a real foreign key into the `areas` table, and every consumer of area data in the admin CMS (Awards tab, Award Areas tab, Organisations tab's own area fields, all via `locationModule`) treats an organisation as belonging to exactly one area — confirmed via the single-select UI field binding `area_id`, and via the absence anywhere in the schema or codebase of a "branch"/multi-location concept for organisations. Despite this, none of the three vulnerable lookups included an `area_id` filter. A company name search was therefore evaluated against every organisation in the system regardless of area.

The consequence differed by call site:

- `executeAwardAreaImport` supports `skip`/`update`/`replace` duplicate-handling strategies. Under `update`/`replace`, a cross-area name collision caused the *existing* organisation's `area_id`/`county_city`/`country` to be silently overwritten to the new import's area — a genuine data-corruption path, not merely a missed-match.
- `handleSubmitEntry`/`handleSubmitNomination` never update a matched organisation's fields, so the consequence there was mis-attribution: a new, unrelated entry would be attached to an existing organisation's `organisation_id`, causing the public site to display the wrong company's logo/website against that entry, and causing the existing organisation's admin-facing record to accumulate an entry that didn't belong to it.

### 2.3 Why the previous implementation allowed both issues

Each of the four write paths was implemented independently, at different points in the codebase's history, with no shared abstraction for "identify the organisation this data belongs to." `executeAwardAreaImport` already correctly set `area_id` on *newly created* organisations, which masked the fact that its *lookup* was unscoped — the bug was invisible until a second import into a different area introduced a genuine name collision, which had not yet occurred in practice (only one county, Somerset, had been imported prior to this fix). The two public endpoints never set `area_id` on new organisations at all prior to this fix. No test coverage existed for the organisation-matching logic in any of the four implementations before this work (`tests/nominee-uploads.test.js` contained a comment incorrectly claiming server-side coverage existed elsewhere).

---

## 3. Design Decisions

### 3.1 Why a shared server-side helper was introduced

An exhaustive, repository-wide search (server code, client code, admin tools, `api/_lib/*` shared libraries, Postgres RPC functions, and Supabase edge functions) confirmed exactly three live server-side implementations of organisation matching, all structurally identical in intent. Fixing the same defect three times independently would have left no guarantee the fixes stayed in sync, and was explicitly identified as a drift risk before implementation began. A single shared helper (`api/_lib/organisation-matching.js`, following the existing `api/_lib/award-categories.js` module pattern already established in this codebase) removes that risk: any future change to matching semantics happens in one place.

### 3.2 Why the client-side CSV importer remained separate (Option A)

A fourth implementation exists in `organisations.js` (the Organisations tab's own CSV importer), architecturally distinct from the server-side path: it performs duplicate detection client-side, in-memory, against already-loaded data, specifically to give the admin instant preview feedback before committing an import — a materially different workflow from the three server-side write paths. Two designs were considered:

- **Option A (adopted):** apply the same area-scoped matching *semantics* to the client-side implementation independently, keeping it architecturally separate.
- **Option B (rejected for this change):** unify all four implementations behind one shared abstraction, which would require either moving the CSV importer's duplicate check server-side (changing its UX — losing the instant client-side preview) or exposing the server-side matching logic for client-side preview calls.

Option B was assessed as a legitimate future improvement but materially larger in scope and risk than the two confirmed defects required fixing. Option A was adopted to keep the change surgical: both implementations now enforce the identical business rule (exact, case-insensitive match, scoped by area), without restructuring a working, differently-purposed feature.

### 3.3 Why no database migration or uniqueness constraint was introduced

Live schema inspection confirmed `organisations` has no unique constraint on `company_name` today, and that duplicate organisation records are an accepted, expected part of the existing product design — evidenced directly by the presence of a first-class, admin-facing "Duplicate Detection Dashboard" and "Merge Organisations" tool (`organisations.js`, `findDuplicates`/`showMergeDuplicatesModal`/`executeMerge`) that already anticipates and manually reconciles the case where the same real company ends up as more than one organisation row. Introducing a database-level uniqueness constraint on `(area_id, company_name)` would have worked against this existing, intentional design rather than aligning with it, and was explicitly evaluated and rejected on that basis. The fix is therefore application-logic-only, with no schema change.

### 3.4 Why update/replace behaviour intentionally remained inside `executeAwardAreaImport` rather than the helper

The shared helper's contract is deliberately narrow: it performs a lookup and returns a matching organisation ID or `null`, and **never** updates, merges, or otherwise modifies data. This was a specific, load-bearing design requirement, not an implementation convenience: two of the helper's three callers (`handleSubmitEntry`, `handleSubmitNomination`) are unauthenticated public endpoints. If the helper had absorbed any update-on-match capability, that capability would have been exposed identically to all three callers — meaning an anonymous public submitter could gain the ability to silently overwrite an existing organisation's stored contact/business data simply by submitting a form with a matching company name. This would have been a materially worse vulnerability than the one being fixed. `executeAwardAreaImport`'s `skip`/`update`/`replace` decision logic therefore remains entirely in that function, applied to the helper's return value, never inside the helper itself.

---

## 4. Files Changed

| File | Purpose of change | Behaviour change? |
|---|---|---|
| `api/_lib/organisation-matching.js` *(new)* | Shared, read-only matching helper: `findMatchingOrganisation(supabase, companyName, areaId)` and `escapeLikePattern(value)`. | New code; no prior behaviour to compare against. |
| `api/data-proxy.js` | `executeAwardAreaImport()`'s organisation lookup replaced with a call to the shared helper. Added one `require`. | **Yes** — lookup now escapes wildcards and scopes by `area_id`. |
| `api/entry-proxy.js` | `handleSubmitEntry()` restructured so the award (and its `area_id`, now additionally selected) resolves before organisation matching; organisation lookup replaced with the shared helper; new organisations now persist `area_id`. `handleSubmitNomination()` gained a direct `areas` table lookup by `display_name` (this flow has no award-matching step to derive area from) before calling the shared helper; new organisations now persist `area_id`. Step comments renumbered for both functions. | **Yes** — both endpoints now escape wildcards and scope by area; new organisations from these endpoints now carry `area_id` for the first time. |
| `organisations.js` | `_applyMapping()`'s client-side duplicate detection and `executeCSVImport()`'s merge-mode lookup now scoped by the selected area's resolved `area_id`; new records created by this importer now also persist `area_id` (previously only free-text `catchment_area`). | **Yes** — duplicate detection is now area-scoped; new records gain a populated `area_id`. |
| `tests/organisation-matching.test.js` *(new)* | 11 unit tests on the shared helper in isolation (escaping, area-scoping, the null-area fallback, error propagation, no side effects). | Test-only. |
| `tests/data-proxy.test.js` | New `award_area_import` describe block: mode/areaId/row-count validation, role gate, and an integration-level proof that the organisation lookup escapes wildcards and is scoped by `area_id`. Mock infrastructure extended with `.single()` support (previously absent; needed to exercise the full insert path). | Test-only. |
| `tests/entry-proxy.test.js` | New escaping/area-scoping proof tests for both public handlers, plus a new test for the unresolvable-area fallback. Five pre-existing tests' mock sequences corrected — their fixtures assumed the pre-refactor call order (organisation lookup before award match) and, after the reorder, silently stopped exercising the "existing organisation reused" path their names claimed (they still passed only because they never asserted on `organisation_id`). | Test-only (existing tests corrected to match new, intended call order; no production behaviour affected by the test changes themselves). |
| `tests/organisations.test.js` | Three new tests for `_applyMapping()`'s area-scoped duplicate detection, including the unresolvable-area fallback. | Test-only. |

No database migration, schema change, or configuration change was made.

---

## 5. Testing Performed

### Unit tests added
- `tests/organisation-matching.test.js` — 11 tests covering `escapeLikePattern` (four cases: `%`, `_`, backslash-ordering, plain text) and `findMatchingOrganisation` (null-area short-circuit with zero queries issued, empty-companyName short-circuit, correct escaped/scoped query construction, no-match return, error propagation, and confirmation the helper never calls `update`/`insert`).

### Existing tests updated
- `tests/data-proxy.test.js`: mock chain extended with `.single()` support (additive; re-verified against the pre-existing 32 tests with zero regressions before building further tests on top of it).
- `tests/entry-proxy.test.js`: five pre-existing tests' mock sequences and inline comments corrected to reflect the new (award-before-organisation) call order, per the finding in Section 4.

### Full suite results
- `npm test`: **69 suites passed, 6498/6501 tests passed** (3 pre-existing, unrelated skips — consistent with the project's documented baseline).

### Lint
- `npm run lint`: clean.
- `api/_lib/organisation-matching.js`, `tests/organisation-matching.test.js`, and all four modified test files additionally linted explicitly (the default `npm run lint` script does not cover `api/_lib/*` or `tests/*`): clean, zero errors or warnings.

### Build
- `npm run build`: completed successfully. Pre-existing chunk-size warnings (events/media/email/crm) are unrelated to this change.

### Live verification against Claude TEST CMS
Performed against the live Supabase project (`htcsewpztvxafksdzuhp`, Claude TEST CMS only, per this engagement's standing constraint) using the actual deployed handler code, not a simulation:

1. Two pre-existing organisations created directly (service-role) in Somerset: `"LiveVerify Wildcard Ltd"` and `"LiveVerify CrossArea Ltd"`.
2. **Wildcard test:** imported `"LiveVerify Wildcard% Ltd"` into Somerset via the real `executeAwardAreaImport` handler with a real editor-role JWT. Result: a new organisation was created; the pre-existing unrelated organisation was **not** matched.
3. **Cross-area test:** imported `"LiveVerify CrossArea Ltd"` (exact name) into Devon via the same handler. Result: a new organisation was created in Devon; the pre-existing Somerset organisation was **not** matched or modified.
4. **Integrity check:** both original Somerset organisations confirmed unchanged (same name, same `area_id`) after both tests.
5. **Cleanup:** all test organisations, entries, and the test user deleted; re-queried afterward and confirmed zero residual test data.

---

## 6. Known Limitations

- **Legacy organisations without `area_id`.** Organisations created via `handleSubmitEntry`, `handleSubmitNomination`, or the CSV importer *before* this fix have `area_id: null`, since none of those three paths set it prior to this change. Because `NULL = 'uuid'` is never true in SQL, these rows are permanently unreachable by the new area-scoped lookup — a genuine repeat submission from the same company will now create a duplicate organisation rather than finding the legacy one. `executeAwardAreaImport`-created organisations are unaffected (that path already set `area_id` correctly before this fix). See [Follow-Up Recommendations](#7-follow-up-recommendations).
- **Remaining duplicated lookup in `organisations.js`.** The pattern `(locationModule._cachedAreas || []).find((a) => a.display_name === selectedCounty)` appears identically in both `_applyMapping()` and `executeCSVImport()`. Cosmetic; zero behavioural risk; not extracted in this change.
- **`executeCSVImport()`'s new `area_id`-tagging has no dedicated automated test.** This function has no existing `apiClient`/`confirmDialog` mock infrastructure in the test suite (unlike `_applyMapping`, which does); building that from scratch was judged disproportionate to the one-line change involved. Verified by direct code review instead of an automated test.
- **Phase 2 location-data architecture remains fully open and untouched**, as explicitly agreed and scoped out of this work: three independent, drifted location-data sources exist (`home-data.js`'s `REGION_DATA`, its duplicate `LONDON_BOROUGHS` array, and `config.js`'s `REGIONS_GROUPED`/`COUNTIES_CITIES`), none generated from or synchronised with the authoritative `areas`/`regions` tables. Two confirmed data-quality defects within that untouched area (`"Kingston & Richmond"` and `"Middlesex"` in `home-data.js`'s London Boroughs list have no corresponding `areas` row; the entire Northern Ireland branch has zero corresponding `areas` rows) remain live and pre-date this work. The "unresolvable area ⇒ always create new, never match" fallback introduced by this fix correctly absorbs these cases safely (no incorrect matching), but does not fix the underlying data-quality gap — submissions from these values will continue to create a new organisation on every submission rather than being consolidated, until the Phase 2 work lands.

---

## 7. Follow-Up Recommendations

### Short-term follow-ups
1. **Backfill `area_id` on legacy organisations** created via the two public endpoints or the CSV importer prior to this fix, resolving it from their existing `county_city` text against `areas.display_name`. Closes the backwards-compatibility gap in Section 6. Small, one-time data task; no application code change required.
2. **Extract the duplicated area-lookup snippet** in `organisations.js` into a single local helper method. Cosmetic, zero-risk.
3. **Add dedicated automated coverage for `executeCSVImport()`'s `area_id`-tagging**, once/if the test suite gains the `apiClient`/`confirmDialog` mock infrastructure needed to exercise that function directly.

### Longer-term architectural improvements
1. **Phase 2: consolidate location data onto a single source of truth** (the `areas`/`regions` tables), replacing the three independent static lists with dynamic loading for the public pages that currently use them — already scoped as a separate, documented follow-up with its own problem statement, recommended architecture, risks, and estimated effort.
2. **Revisit Option B (full client/server matching unification)** if the Organisations tab CSV importer's workflow ever changes in a way that makes a shared abstraction lower-risk than it is today (e.g., if its duplicate-detection preview is ever moved server-side for other reasons).
3. **Decide whether Northern Ireland is a genuinely supported award region.** If yes, `areas` needs those rows added as a prerequisite to any Phase 2 work restoring that branch of the public form. If no, the branch should be removed from the public form rather than continuing to offer unreachable options.

---

## 8. Risk Assessment

### Remaining production risks after Phase 1
- The backwards-compatibility gap for legacy null-`area_id` organisations (Section 6) — bounded, understood, and does not cause incorrect matching (it causes correct-but-duplicate organisation creation, the safe failure direction), pending the recommended backfill.
- The two known London Borough data-quality defects and the Northern Ireland gap remain live in the public form until Phase 2 — bounded to those specific values, and the new fallback behaviour ensures they fail safely (new organisation created, never an incorrect match) rather than reintroducing the original vulnerability class.
- No new risk was identified in any of the ten review dimensions covered in the final implementation audit (unintended behavioural changes, backwards compatibility, duplicated logic, simplification opportunities, untested edge cases, performance, security, code style, dead code, and single-source-of-truth verification) beyond what is documented in this report.

### Why the implementation is considered safe to merge
- Both originally confirmed defects (ILIKE wildcard matching, cross-area collision) are proven closed against the live database using the actual deployed code, not only against mocks.
- The fix is application-logic-only — no schema migration, no new database objects, nothing that could fail independently of the application deploy.
- The read-only contract of the shared helper was independently verified to hold across all three server-side callers, eliminating the specific risk (public-endpoint write escalation) that the design phase identified as the primary danger of getting this fix wrong.
- Full existing test suite, lint, and build all pass with zero regressions; new regression tests directly encode the two original proofs-of-exploit as permanent tests.
- The implementation was scoped, reviewed, and re-verified across multiple independent passes (design review, dependency analysis, adversarial self-challenge, exhaustive call-site inventory, and a final ten-dimension code audit) before and after implementation, with every finding at each stage either resolved or explicitly and separately tracked rather than silently dropped.

---

## 9. Rollback Plan

This change is a self-contained application-logic change with no schema migration, so rollback is a standard code revert with no database follow-up required:

1. `git revert 4ac4c79` on `claude/supabase-cms-setup-test-e6oiza` (or the equivalent merge commit once merged to the target branch), then redeploy.
2. No data cleanup is required: the only schema-level effect of this change is that new organisations created via `handleSubmitEntry`, `handleSubmitNomination`, and the CSV importer now populate `area_id` where they previously left it `null`. A rollback simply stops populating it going forward; already-populated values on rows created while this fix was live are harmless if left in place and require no corrective action.
3. Reverting restores the pre-fix (vulnerable) matching behaviour immediately — if a rollback is ever required under time pressure for an unrelated reason, this should be treated as reopening both original defects, and the two live-verification scenarios in Section 5 should be re-run against the reverted code to reconfirm their pre-fix behaviour before considering the rollback complete.
