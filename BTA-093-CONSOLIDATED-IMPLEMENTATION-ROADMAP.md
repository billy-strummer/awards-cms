# BTA-093 — Consolidated Implementation Roadmap

**Source reports:** BTA-084 (Database Security Reconciliation), BTA-085 (Application Security Dependencies), BTA-086 (Database Deployment Readiness), BTA-087 (CMS Functionality Inventory), BTA-088 (Public Website and Forms Audit), BTA-089 (Admin Interface Audit), BTA-090 (Automated Test Coverage Review), BTA-091 (CMS Data Integrity Audit), BTA-092 (Operational Readiness Audit) — all produced 2026-11-02 as part of the BTA-084–093 autonomous programme. This document consolidates and prioritises their findings; it does not re-investigate anything, and it does not implement anything.

## How to read this roadmap

Each item lists: **Priority**, **Reason**, **Evidence** (source report), **Dependencies**, **Likely affected files/components**, **Supabase connectivity required?**, **Schema migration likely?**, **User approval needed?**, **Acceptance criteria**. Items are grouped into the 8 categories requested. Within each group, items are ordered by priority.

---

## 1. Critical security remediation

### 1.1 — Resolve migration 093's newly-discovered `test-data-manager.js` dependency before any further test-project work
- **Priority:** Critical — blocks all database security remediation progress.
- **Reason:** BTA-085 found migration 093 would break a real, deployed admin feature (`test-data-manager.js`, loaded in every admin session) that directly accesses 7 of 093's 8 target tables plus `event_guests`, contradicting the "zero dependency" premise 093/BTA-080 were built on.
- **Evidence:** BTA-085 §8.1; BTA-084 §11 (correction); BTA-086 §11 (correction).
- **Dependencies:** None technically; this must be decided before migration 093 is applied anywhere, including the test project.
- **Likely affected files/components:** `test-data-manager.js`, possibly `api/data-proxy.js` (if refactored to a proxy action), `migrations/093-harden-remaining-permissive-policy-tables.sql` (if a carve-out policy is added instead).
- **Supabase connectivity required?** No, to decide and implement the code-side fix. Yes, to verify it afterward.
- **Schema migration likely?** Possibly (a scoped policy carve-out), or none (if refactored to go through the proxy).
- **User approval needed?** **Yes — this is explicitly a business/architecture decision** (refactor vs. carve-out vs. accept breakage), named as such in both BTA-085 and BTA-086.
- **Acceptance criteria:** A documented decision exists; if refactor/carve-out is chosen, `test-data-manager.js`'s test-fixture workflow is confirmed still functional after migration 093 is eventually applied to a reachable test project.

### 1.2 — Apply migration 093 (plus 087/088, and separately 078/079) to the test project, once reachable and once 1.1 is resolved
- **Priority:** Critical.
- **Reason:** This is the actual fix for the confirmed live production exposure (BTA-078/079) of 32 tables; it remains entirely unverified against any database.
- **Evidence:** BTA-084 §§2–9; BTA-086 §§1–8.
- **Dependencies:** 1.1 must be resolved first. Test-project connectivity must be restored (currently blocked, Supabase support ticket open — see `BTA-PROJECT-CONTINUITY-CHECKPOINT.md` §7).
- **Likely affected files/components:** None (SQL already written); verification only.
- **Supabase connectivity required?** Yes — this is the definition of the task.
- **Schema migration likely?** Yes (093/087/088/078/079, all already authored).
- **User approval needed?** Yes — explicit, separate authorisation per every prior task's own instruction.
- **Acceptance criteria:** BTA-086 §§6–8's read-only verification queries all return the expected post-application state on the test project; the application smoke tests in BTA-086 §8 pass.

### 1.3 — Fix migration 052's dead-end design and decide the 045-vs-052 architectural question for `organisations`/`award_years`/`entries`/`award_assignments`/`invoices`/`payments`
- **Priority:** High (subsumed by 1.2's migration 093, which already implements the "full lockdown" resolution — this item exists to formally close the question, not to do new work).
- **Reason:** Migration 052 as written would never have worked (never drops the original policy); 093 already supersedes its intent based on a zero-dependency finding that 1.1 has now complicated.
- **Evidence:** BTA-084 §6.
- **Dependencies:** 1.1.
- **Likely affected files/components:** None beyond what 1.1/1.2 already touch.
- **Supabase connectivity required?** No.
- **Schema migration likely?** No new one — already covered by 093.
- **User approval needed?** Implicitly yes, bundled into 1.1's decision.
- **Acceptance criteria:** No further action needed once 1.1 is resolved and 1.2 applied; this item exists for completeness in the roadmap, not as independent work.

### 1.4 — `payment-success.html`'s direct anon-key `payments` read will silently stop showing the payment reference once `anon` access is revoked
- **Priority:** High.
- **Reason:** A real, live public page will visibly regress (confirmation page loses its payment-reference display) the moment migration 093 is applied, unless this is fixed first or in the same batch.
- **Evidence:** BTA-085 §8.2.
- **Dependencies:** Should be fixed before or alongside 1.2's application.
- **Likely affected files/components:** `payment-success.html`, likely a new small server-side proxy action in `api/data-proxy.js` or `api/stripe-payment.js` to fetch the payment reference server-side instead.
- **Supabase connectivity required?** No for the code fix; yes to verify afterward.
- **Schema migration likely?** No.
- **User approval needed?** No for the fix itself (it's a correctness fix, not a business decision) — but worth flagging since it's new work outside the original migration-093 scope.
- **Acceptance criteria:** After migration 093 is applied, `payment-success.html` still shows the correct payment reference for a real completed payment.

### 1.5 — `anonymize_organisation`'s current live `EXECUTE` grant to `PUBLIC`/`anon`/`authenticated` (confirmed exploitable today, per BTA-078/079)
- **Priority:** Critical, but **already has a prepared fix** (migration 092) — this item is "apply 092," not "write something new."
- **Reason:** Carried forward unchanged from BTA-078/079; re-stated here for roadmap completeness.
- **Evidence:** BTA-084 (implicitly, via the inventory); original finding BTA-078/079.
- **Dependencies:** Test-project connectivity.
- **Likely affected files/components:** None — already written.
- **Supabase connectivity required?** Yes.
- **Schema migration likely?** Yes (092, already authored).
- **User approval needed?** Yes, for application.
- **Acceptance criteria:** Live `anonymize_organisation` returns `TEXT` and `EXECUTE` is confirmed revoked from `PUBLIC`/`anon`/`authenticated` (BTA-086 §7 query).

### 1.6 — `document-management.js`'s and `judge-login.html`'s direct dependencies on `documents`/`document_versions`/`user_roles`
- **Priority:** Medium (not urgent — these tables are outside migration 093's scope and their live RLS/grant state is simply unknown, not confirmed exposed).
- **Reason:** Newly confirmed as real code dependencies that any future RLS work on those three tables must account for.
- **Evidence:** BTA-085 §§8.3–8.4.
- **Dependencies:** None.
- **Likely affected files/components:** None yet — this is a "remember this before touching those tables" flag, not an action item with a fix.
- **Supabase connectivity required?** Yes, eventually, to check these tables' live state.
- **Schema migration likely?** Unknown until checked.
- **User approval needed?** Not yet — informational.
- **Acceptance criteria:** N/A until a future task investigates these three tables' live state.

---

## 2. Data integrity and reliability

### 2.1 — No `UNIQUE` constraint backs organisation de-duplication (`organisations(company_name, area_id)`)
- **Priority:** High.
- **Reason:** Confirmed check-then-act race condition risk — concurrent submissions for the same new company/area could create duplicate organisation rows, with no database-level safety net.
- **Evidence:** BTA-091 §2, issue 1.
- **Dependencies:** None.
- **Likely affected files/components:** A new migration adding a unique index (possibly on a normalised/lower-cased expression to match the existing `ILIKE` comparison); `api/_lib/organisation-matching.js`'s insert path would need `ON CONFLICT` handling to match.
- **Supabase connectivity required?** To apply, yes. To design, no.
- **Schema migration likely?** Yes — new, not yet written.
- **User approval needed?** Likely no (a correctness fix, not a business decision), but the exact normalisation rule (case-sensitivity, whitespace handling) should be confirmed before writing the migration.
- **Acceptance criteria:** A concurrency test (two simultaneous submissions for the same new org/area) reliably produces exactly one organisation row.

### 2.2 — No `UNIQUE` constraint on `award_assignments(award_id, organisation_id)`
- **Priority:** Medium — this is a DB-level confirmation of an already-open business decision, not a new independent problem.
- **Reason:** Confirms the duplicate-entry-per-award question (open since BTA-077) is a schema gap too, not just a missing application rule.
- **Evidence:** BTA-091 §1, issue 2.
- **Dependencies:** **Blocked on the business decision** (should duplicates be prevented at all?).
- **Likely affected files/components:** A new migration, if the decision is "yes, prevent."
- **Supabase connectivity required?** To apply, yes.
- **Schema migration likely?** Yes, if approved.
- **User approval needed?** **Yes — this is explicitly the open business decision already tracked in `BTA-PROJECT-CONTINUITY-CHECKPOINT.md` §9.4.**
- **Acceptance criteria:** Decision recorded; if "prevent," a migration + matching application-code rule both ship together.

### 2.3 — `award_years.sector` is untethered free text relative to `custom_sectors`
- **Priority:** Medium.
- **Reason:** Renaming a custom sector has no mechanism to propagate to `award_years` rows referencing the old name by text — silent drift risk.
- **Evidence:** BTA-091 §3.
- **Dependencies:** None technically, but this is a taxonomy-architecture question.
- **Likely affected files/components:** A migration adding `sector_id UUID REFERENCES custom_sectors(id)`, a backfill script, and updates to `awards.js`/`settings.js` wherever `sector` is read/written as text.
- **Supabase connectivity required?** Yes, for the backfill and application.
- **Schema migration likely?** Yes.
- **User approval needed?** **Yes — taxonomy-architecture decisions are explicitly outside this audit's authority, per BTA-091's own framing.**
- **Acceptance criteria:** Decision recorded; if approved, renaming a custom sector correctly updates every `award_years` row that referenced it.

### 2.4 — `document-management.js`/`judge-login.html` live RLS state for `documents`/`document_versions`/`user_roles` (Unknown)
- **Priority:** Low-Medium (informational — not yet a confirmed problem).
- **Reason:** Carried forward from Security §1.6; included here too since it's as much a data-integrity unknown as a security one.
- **Evidence:** BTA-085 §§8.3–8.4.
- **Dependencies:** Test-project connectivity.
- **Acceptance criteria:** N/A until investigated.

---

## 3. Core CMS functionality

### 3.1 — Build an admin UI for the existing, tested, `super_admin`-gated user-management backend
- **Priority:** High.
- **Reason:** `user_list`/`user_invite`/`user_set_role`/`user_set_status`/`user_reset_password` are fully implemented and tested server-side with zero UI anywhere — user management currently requires direct Supabase access, outside the application entirely.
- **Evidence:** BTA-089, "User/role administration" finding.
- **Dependencies:** None.
- **Likely affected files/components:** A new admin module (e.g. `user-management.js`), wired into `settings.js` or its own tab, using the existing `api/data-proxy.js` operations.
- **Supabase connectivity required?** No for building the UI (it calls the already-working proxy); yes only for end-to-end testing.
- **Schema migration likely?** No.
- **User approval needed?** No for the build itself; possibly yes if the UI's exact placement/UX needs a decision.
- **Acceptance criteria:** A `super_admin` can invite, change the role of, disable, and trigger a password reset for a user entirely through the admin UI, with no direct Supabase access.

### 3.2 — GDPR erasure/anonymisation remain non-functional live (carried forward, not new)
- **Priority:** Critical for the feature, but entirely blocked on 1.1/1.2 above, not independent work.
- **Reason:** Restated for roadmap completeness; see Security §1.1–1.2 and BTA-087's classification of this feature as "code correct, live RPC missing/miscalibrated."
- **Evidence:** BTA-087; BTA-084.
- **Acceptance criteria:** Subsumed by 1.2's acceptance criteria.

### 3.3 — Sponsorship catalogue remains inert live (table doesn't exist) — carried forward, not new
- **Priority:** Medium, blocked on Supabase connectivity, not independent work.
- **Reason:** Migration 091 unapplied; feature gracefully falls back to static cards in the meantime, so this is not urgent.
- **Evidence:** BTA-087.
- **Acceptance criteria:** Subsumed by migration 091's eventual application.

---

## 4. Public website and form improvements

### 4.1 — Fix the completely broken `nominate.html` nomination journey
- **Priority:** Critical.
- **Reason:** **Confirmed: every real submission from this page fails with a 400 error.** This is the single most severe functional defect found across the entire programme — a live, linked, reachable public page that cannot be used at all.
- **Evidence:** BTA-088 §1.
- **Dependencies:** None.
- **Likely affected files/components:** `nominate.html` (add an award-category field, matching `handleSubmitNomination`'s branching), `nominate.js` (`buildPayload()` — send `awardCategory` and the correct company-name field for the handler's branch; also fix the silently-discarded `nominatorArea` field), or alternatively `api/entry-proxy.js`'s `handleSubmitNomination` if the simpler fix is relaxing the server's requirements to match the form's actual, simpler intent.
- **Supabase connectivity required?** No.
- **Schema migration likely?** No.
- **User approval needed?** Possibly — deciding *which side* should change (simplify the server's requirements to match the form, or restore the richer field set to the form) is a product decision about what the nomination flow is supposed to collect.
- **Acceptance criteria:** A real test submission through `nominate.html` succeeds and the resulting entry contains the expected data.

### 4.2 — Fix the completely broken `industry-leader.html` nomination journey
- **Priority:** Critical — same severity and nature as 4.1, different page.
- **Reason:** **Confirmed: every submission fails, in both of the form's two possible code paths** (New Business category, and every other category).
- **Evidence:** BTA-088 §2.
- **Dependencies:** Should be fixed together with 4.1, since both stem from the same handler divergence.
- **Likely affected files/components:** `industry-leader.html`/`industry-leader.js` (add `businessName`/`businessOwner` fields for the New Business path, and `nomineeCompany` for the general path), or `api/entry-proxy.js` if the server side is simplified instead.
- **Supabase connectivity required?** No.
- **Schema migration likely?** No.
- **User approval needed?** Same product decision as 4.1 — likely the same fix resolves both.
- **Acceptance criteria:** A real test submission through both of `industry-leader.html`'s category branches succeeds.

### 4.3 — Minor SEO gaps: missing Open Graph tags (`become-a-sponsor.html`) and missing meta-description fallback (`submit-entry.html`, `industry-leader.html`)
- **Priority:** Low.
- **Evidence:** BTA-088 §§4–5.
- **Dependencies:** None.
- **Likely affected files/components:** The three HTML files — add static fallback tags matching `home.html`'s pattern.
- **Supabase connectivity required?** No.
- **Schema migration likely?** No.
- **User approval needed?** No.
- **Acceptance criteria:** All public pages have at least a static fallback `<meta name="description">` and Open Graph tags, independent of whether an admin has configured a CMS override.

### 4.4 — `nominate.html`'s `nominatorArea` field is collected but never transmitted
- **Priority:** Low (will likely be fixed as a side effect of 4.1).
- **Evidence:** BTA-088 §1 (secondary finding).
- **Acceptance criteria:** Subsumed by 4.1's fix.

### 4.5 — Shared nav/footer CMS sync script not loaded on `submit-entry.html`/`industry-leader.html`/`nominate.html`
- **Priority:** Low, **Potential** (impact unverified).
- **Evidence:** BTA-088 §6.
- **Dependencies:** First confirm whether these pages even have a syncable nav/footer worth updating.
- **Acceptance criteria:** Either confirmed no-op (these pages have no CMS-driven nav/footer to sync) or the script is added and a CMS nav-label change is confirmed to propagate.

---

## 5. Administrative usability

### 5.1 — `rbac.js`'s delete-button-disable selector no longer matches any real button
- **Priority:** Medium.
- **Reason:** A `viewer`/`judge` role sees fully enabled delete/archive buttons throughout the admin UI with no visual warning, even though the server correctly rejects the write — a real UX inconsistency, not a security hole.
- **Evidence:** BTA-089, `rbac.js` findings.
- **Dependencies:** None.
- **Likely affected files/components:** `rbac.js`'s selector (update to match `data-action` attributes instead of `onclick`).
- **Supabase connectivity required?** No.
- **Schema migration likely?** No.
- **User approval needed?** No.
- **Acceptance criteria:** A `viewer`-role session shows delete buttons as visibly disabled, not just server-rejected on click.

### 5.2 — `data-rbac-action` fine-grained UI-gating mechanism is fully unused
- **Priority:** Medium.
- **Reason:** A real permission-gating feature was built into `rbac.js` and never wired up anywhere — either genuinely finish wiring it, or formally remove it to stop it looking like active protection it isn't.
- **Evidence:** BTA-089, `rbac.js` findings.
- **Dependencies:** None.
- **Likely affected files/components:** `rbac.js` plus every admin module's button markup, if wiring it up; just `rbac.js` if removing it.
- **Supabase connectivity required?** No.
- **Schema migration likely?** No.
- **User approval needed?** **Yes — which direction (wire up vs. remove) is a design decision**, per BTA-089's own framing.
- **Acceptance criteria:** Decision recorded; code matches the decision (either real action-level gating exists, or the dead mechanism is removed and documented as intentionally module-level-only).

### 5.3 — GDPR export's actual gate (`'settings'` module access) doesn't match its apparent design intent (`'gdpr'` action, super_admin-only)
- **Priority:** Medium.
- **Reason:** Any `admin`-role user can currently use GDPR export, not just `super_admin` — this may be intentional (export is less sensitive than erasure) or may be a genuine inconsistency; the code doesn't currently express a clear intent either way.
- **Evidence:** BTA-089, GDPR finding.
- **Dependencies:** None.
- **Likely affected files/components:** `gdpr.js`'s `submitRequest()` gate, or `rbac.js`'s action model, whichever is changed to match the decision.
- **Supabase connectivity required?** No.
- **Schema migration likely?** No.
- **User approval needed?** **Yes — explicitly a policy decision**, per BTA-089.
- **Acceptance criteria:** Decision recorded; the code's actual gate matches the decided policy exactly.

### 5.4 — Update `CLAUDE.md`'s stale `STRIPE_PUBLISHABLE_KEY` documentation
- **Priority:** Low.
- **Reason:** Documentation accuracy only — the app itself works correctly via `localStorage`/admin-settings, just not as `CLAUDE.md` currently describes.
- **Evidence:** BTA-092, environment-variables finding.
- **Dependencies:** None.
- **Likely affected files/components:** `CLAUDE.md` only.
- **Supabase connectivity required?** No.
- **Schema migration likely?** No.
- **User approval needed?** No.
- **Acceptance criteria:** `CLAUDE.md` accurately describes the `localStorage`/admin-settings mechanism instead of implying a server env var.

---

## 6. Test coverage and quality

### 6.1 — `public-winners-app.js` (the real public winners page) has only 3 tests covering 1 of 6 functions
- **Priority:** High — this is BTA-090's single highest-value finding, given it's a real public-facing page.
- **Reason:** `renderWinners` (including the HTML-escaping surface for company/award names), `placementBadgeClass`, `shareLinks`, the fetch-filter logic, and the error/catch path are all completely untested.
- **Evidence:** BTA-090, "Public forms" finding and prioritised list item 1.
- **Dependencies:** None.
- **Likely affected files/components:** `tests/public-winners-app.test.js` (new tests only — "do not modify tests" restriction in this programme means this is recorded for a future implementation task, not done here).
- **Supabase connectivity required?** No.
- **Schema migration likely?** No.
- **User approval needed?** No.
- **Acceptance criteria:** The 4 proposed test names in BTA-090 (XSS-escaping, empty/error state, filter logic, share-link encoding) exist and pass.

### 6.2 — Add a named regression test asserting the supported-country list (England/Scotland/Wales only)
- **Priority:** High given this project's own repeated-manual-grep history for Northern Ireland reintroduction.
- **Reason:** A mechanical CI check would catch a future accidental regression instead of relying on another manual audit every few tasks.
- **Evidence:** BTA-090, prioritised list item 2.
- **Dependencies:** None.
- **Likely affected files/components:** `tests/areas-manager.test.js` or `tests/location.test.js`.
- **Supabase connectivity required?** No.
- **Schema migration likely?** No.
- **User approval needed?** No.
- **Acceptance criteria:** A single new test asserts the exported supported-country constant/array is exactly `['England', 'Scotland', 'Wales']` (or equivalent), and fails loudly if Northern Ireland is ever added.

### 6.3 — Confirm role-gate test files have matching success-path tests, not just denial-path tests
- **Priority:** Medium.
- **Evidence:** BTA-090, prioritised list item 3.
- **Likely affected files/components:** `tests/certificates-qr-role-gate.test.js`, `tests/judge-automation-role-gate.test.js`, `tests/social-media-api-role-gate.test.js`.
- **Supabase connectivity required?** No.
- **User approval needed?** No.
- **Acceptance criteria:** Each file has at least one "correct role succeeds" test alongside its existing denial tests.

### 6.4 — Nomination-path test parity check against entry-path coverage
- **Priority:** Medium (and now higher-value given 4.1/4.2's discovery that the nomination paths are currently broken — the test suite should have caught this and didn't, which is itself informative).
- **Evidence:** BTA-090, prioritised list item 4.
- **Acceptance criteria:** A test exists asserting `nominate.js`/`industry-leader.js`'s payload shape matches `handleSubmitNomination`'s actual requirements — this specific class of test would have caught 4.1/4.2 before it reached production.

### 6.5 — Systematic input-validation coverage audit across all 12 `api/*.js` handlers
- **Priority:** Low (large effort, not started).
- **Evidence:** BTA-090, prioritised list item 5.
- **Acceptance criteria:** A future dedicated task, not scoped here.

---

## 7. Deployment and operational readiness

### 7.1 — Decide whether to upgrade `@anthropic-ai/sdk` (major version behind) and `@supabase/supabase-js`
- **Priority:** Medium.
- **Evidence:** BTA-092, dependencies finding.
- **Dependencies:** Check each package's changelog for breaking changes first.
- **Likely affected files/components:** `package.json`, `api/_lib/ai-vetting-proxy.js`, `config.js`/build pipeline for the Supabase client.
- **Supabase connectivity required?** No for the decision; yes for post-upgrade smoke testing.
- **Schema migration likely?** No.
- **User approval needed?** Yes — this is a dependency-upgrade decision, and this programme's own restrictions explicitly forbid changing package dependencies without approval.
- **Acceptance criteria:** Decision recorded; if approved, upgrade performed in its own task with full regression testing.

### 7.2 — Update `DISASTER-RECOVERY.md` to reference the BTA-078–083 RLS exposure and migration 093
- **Priority:** Medium.
- **Reason:** The document predates the most serious known issue and would misdirect a real incident responder today.
- **Evidence:** BTA-092, backup/recovery finding.
- **Dependencies:** None.
- **Likely affected files/components:** `DISASTER-RECOVERY.md` only.
- **Supabase connectivity required?** No.
- **User approval needed?** No.
- **Acceptance criteria:** The document names the current exposure and points to `BTA-PROJECT-CONTINUITY-CHECKPOINT.md` for current status.

### 7.3 — Consider a minimal health-check endpoint
- **Priority:** Low.
- **Evidence:** BTA-092, health-checks finding.
- **User approval needed?** Yes — adding a new `/api/` file is constrained by the Vercel Hobby 12-function limit (`CLAUDE.md`), so this would need to be an action inside an existing handler, which is itself a small design decision.
- **Acceptance criteria:** Decision recorded; if approved, implemented as a new action in an existing handler, not a new file.

### 7.4 — No proposed splitting plan for the 4 "LARGE" lazy JS chunks
- **Priority:** Low.
- **Evidence:** BTA-092, build-process finding.
- **Acceptance criteria:** Decision recorded (split further, or accept as-is).

---

## 8. Business decisions requiring user approval (consolidated list)

1. **Migration 093 / `test-data-manager.js` conflict (§1.1)** — refactor the tool, carve out a scoped policy, or accept the feature breaking.
2. **Duplicate entry per award/organisation (§2.2)** — whether to prevent it at all; now confirmed as a DB-level gap too, not just a UI question. (Carried forward from BTA-077, now reinforced with new evidence.)
3. **`award_years.sector` taxonomy architecture (§2.3)** — whether to migrate free-text sector to a proper FK.
4. **Nomination-form product decision (§4.1/4.2)** — simplify the server's requirements to match the current simpler forms, or restore the richer field set the forms used to collect.
5. **`data-rbac-action` mechanism's future (§5.2)** — wire it up for real, or formally remove it.
6. **GDPR export's intended gate (§5.3)** — `super_admin`-only (matching apparent design intent) or any `admin` (matching current behaviour).
7. **Dependency upgrades (§7.1)** — `@anthropic-ai/sdk` and `@supabase/supabase-js`.
8. **Health-check endpoint (§7.3)** — add one (as an action inside an existing handler) or explicitly decide not to.
9. **Carried forward, unchanged by this programme:** Decision 18 (`winner_position` vs `placement`); `winners.winner_name` retention under GDPR erasure; backend award-eligibility enforcement — all still open, none touched by BTA-084–093.

## Work that can proceed locally without Supabase connectivity

Sections 3.1 (user-management UI), 4.1/4.2 (nomination form fixes, code-side), 4.3–4.5, 5.1–5.4, 6.1–6.5, 7.2–7.4, and the design/decision portions of 2.1–2.3 can all be investigated, decided, and implemented without a live database connection. Verification of each still ultimately benefits from a reachable environment, but none is blocked from starting.

## Work that must wait for Supabase (test project reachable, or production for read-only re-verification)

1.1's decision can be made without Supabase, but 1.2, 1.5, 1.6, and the final verification of 2.1's migration all require a reachable database. The test project remains unreachable as of this report (see `BTA-PROJECT-CONTINUITY-CHECKPOINT.md` §7) — a Supabase support ticket is open, unconfirmed as resolved.
