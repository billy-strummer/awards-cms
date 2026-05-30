# Code Quality & Architecture Audit — 2026-05-29

## Summary

This audit covers 59 frontend JS modules, 12 API serverless functions, and 65 test files across the British Trade Awards CMS. Ten categories were examined: dead code, duplicated logic, inconsistent patterns, error handling gaps, magic numbers/strings, module coupling, test coverage, API handler size, naming consistency, and JSDoc annotations.

**Severity counts:** 2 Critical · 8 High · 9 Medium · 6 Low

The most urgent finding is a silent functional bug: public-facing entry forms call `/api/data-proxy` without an auth token and using the wrong field name (`action` instead of `operation`), so custom sectors/categories silently never load. The largest structural debt is six identical `verifyAuth()` implementations copy-pasted across API files — a single shared utility would eliminate hundreds of lines and prevent future divergence.

---

## CRITICAL

### [x] CQ2-C1 — `submit-entry.js` and `submit-entry-payment.js` call `/api/data-proxy` without auth and with wrong field name

- **Files:** `/home/user/awards-cms/submit-entry.js` L449–468, `/home/user/awards-cms/submit-entry-payment.js` L415–438
- **Description:** Both public entry-form pages make unauthenticated `fetch('/api/data-proxy', …)` calls to load `custom_sectors` and `custom_categories`. They pass `action: 'select'` but `data-proxy` reads `operation`, not `action`. `data-proxy` also requires a `Bearer` JWT for every request and returns 401 if missing. These calls therefore always fail with a 401 (wrong field name means `operation` is undefined too, which would be a 400 validation error). The errors are silently swallowed (`catch (_) { /* silently fall back */ }`), so custom sectors and categories simply never appear in the public form — users only see hardcoded fallbacks. This is a silent regression.
- **Suggested fix:** Either (a) create a public `/api/public-sectors` endpoint that returns `custom_sectors` and `custom_categories` without authentication, or (b) serve these at build time as JSON embedded in the HTML. Do not attempt to authenticate public entry forms via the private `data-proxy`.

### [x] CQ2-C2 — `verifyAuth()`, `ROLE_HIERARCHY`, and `hasMinimumRole()` copy-pasted across 6 API files

- **Files:**
  - `verifyAuth`: `api/data-proxy.js` L569, `api/email-automation.js` (inline, L1301–1311), `api/certificates-qr.js` L32, `api/judge-automation.js` L41, `api/resend-email.js` L32, `api/upload-proxy.js` L139, `api/stripe-payment.js` L70
  - `ROLE_HIERARCHY`: `api/data-proxy.js` L76, `api/stripe-payment.js` L32, `api/ai-vetting.js` L11
  - `hasMinimumRole`: `api/data-proxy.js` L84, `api/stripe-payment.js` L33, `api/ai-vetting.js` L13
- **Description:** The `verifyAuth` function (reads `Authorization` header, calls `supabaseAuth.auth.getUser`, returns `user` or sends 401) is identical in every file except `email-automation.js`, which inlines the auth logic directly in the handler (no `verifyAuth` function, just repeated code at L1301–1311). If any change is needed (e.g., token refresh, rate-limit bypass for internal calls), all 6 copies must be updated in sync. `ROLE_HIERARCHY` array and `hasMinimumRole()` function are also duplicated 3× each.
- **Suggested fix:** Create `api/_lib/auth.js` exporting `verifyAuth`, `ROLE_HIERARCHY`, `hasMinimumRole`, and `getUserRole`. Each API handler requires it with `const { verifyAuth, hasMinimumRole } = require('./_lib/auth');`. `api/_lib/` is already used for `email-header.js` and `automation-scheduler.js` and is excluded from Vercel's function count.

---

## HIGH

### [x] CQ2-H1 — `textToHtml()` duplicated identically in `email-automation.js` and `stripe-payment.js`

- **Files:** `api/email-automation.js` L143–147, `api/stripe-payment.js` L637–641
- **Description:** Both files contain character-for-character identical implementations of `textToHtml(text)` that escape `&`, `<`, `>` and convert newlines to `<p>` and `<br>` tags inside a padding div. Neither references the other or a shared module.
- **Suggested fix:** Move to `api/_lib/email-header.js` or a new `api/_lib/email-utils.js` and import in both files.

### [x] CQ2-H2 — `escapeHtml()` defined locally in 6 standalone-page modules

- **Files:** `award-companies-app.js` L33, `check-in-app.js` L334, `company-profile-app.js` L32, `award-nominees-app.js` L125, `register-app.js` L449, `public-winners-app.js` L92
- **Description:** Six standalone public/portal page modules each define their own `escapeHtml(str)`. These pages do not load the main `utils.js`, so the duplication is structurally necessary — but the implementations should at least be identical. `register-app.js` and `submit-entry-payment.js` each also define their own `toTitleCase()` helper. As the number of standalone pages grows, shared utility drift becomes a risk.
- **Suggested fix:** Create a tiny `public-utils.js` (or inline in `build.js` as a shared bundle) containing `escapeHtml`, `toTitleCase`, and `showPublicToast` that all standalone pages can load. This would also address the `proxyFetch` duplication (see CQ2-H3).

### [x] CQ2-H3 — `proxyFetch()` helper duplicated in 4 standalone-page modules

- **Files:** `award-nominees-app.js` L15, `award-companies-app.js` L17, `company-profile-app.js` L16, `winners-portal-app.js` L14
- **Description:** All four define an identical 10-line `async function proxyFetch(body)` that POSTs JSON to `/api/data-proxy` without an Authorization header and returns the parsed JSON. This is the same pattern as `apiClient._call()` in `utils.js` but without authentication — again calling auth-required endpoints without tokens (see also CQ2-C1).
- **Suggested fix:** Consolidate into `public-utils.js` and audit whether these portal pages actually need server-side auth.

### CQ2-H4 — `events.js` has 77 public async methods without `try/catch`

- **Files:** `events.js` — examples: `_fetchPage` L117, `openEditModal` L209, `renderAttendees` L921, `exportDietarySummary` L1083, `addAttendee` L1233, `renderCheckInTab` L1426
- **Description:** Out of ~170 async functions in the 14,489-line `events.js`, 77 have no `try/catch` at any level. Network errors or Supabase failures in these functions will result in unhandled promise rejections with no user feedback and no logging. `_fetchPage` (L117) is particularly critical because it fetches the primary event list and has no error boundary — a network failure silently renders an empty table.
- **Suggested fix:** Add `try/catch` with `utils.showToast(error.message, 'error')` to all public-facing async methods. At minimum, wrap `_fetchPage` (called from the pagination controls) so users see an error message rather than a blank list.

### CQ2-H5 — `organisations.js` has 15 public async methods without `try/catch`

- **Files:** `organisations.js` — examples: `_srvFetchPage` L437, `openCompanyProfile` L1040, `bulkEmail` L3341, `_sendBulkEmail` L3488, `saveNewCompany` L2989, `executeMerge` L6106, `executeCSVImport` L4874
- **Description:** `_srvFetchPage` (L437) fetches the main organisations list and has no error handling — a failure renders a blank table silently. `bulkEmail` (L3341) fetches contact emails before showing a modal; if the fetch fails, the call to `this._getContactEmails()` throws and the modal never opens with no error shown to the user. `saveNewCompany` (L2989) has no catch, so a failed insert leaves the form open with no feedback.
- **Suggested fix:** Same as CQ2-H4 — wrap each in `try/catch` with an appropriate `utils.showToast` on error.

### [x] CQ2-H6 — STATUS constants defined in `config.js` use Title Case but database/code uses lowercase — constant is barely used

- **Files:** `config.js` L28–34 (STATUS definition), `dashboard.js` L164, L358, L720, L2238 (only users)
- **Description:** `config.js` defines `STATUS = { DRAFT: 'Draft', PENDING: 'Pending', APPROVED: 'Approved', PUBLISHED: 'Published', REJECTED: 'Rejected' }`. However, the database and most code use lowercase strings (`'draft'`, `'pending'`, `'approved'`, `'published'`, `'rejected'`). `STATUS.DRAFT` would never match a DB field containing `'draft'`. Only 5 usages of `STATUS.*` exist in the entire codebase — all in `dashboard.js`. Meanwhile 131 usages of lowercase string literals are scattered across modules with no central definition.
- **Suggested fix:** Either: (a) fix `STATUS` to use lowercase values matching the DB (`DRAFT: 'draft'`) and migrate all hardcoded strings to use the constant, or (b) add a proper `ENTRY_STATUS`, `AWARD_STATUS`, `EVENT_STATUS` enum structure to `config.js` with lowercase values and enforce usage throughout.

### CQ2-H7 — `email-automation.js` mixes kebab-case and camelCase action names in the same handler

- **Files:** `api/email-automation.js` L1316–1335
- **Description:** The handler switch uses `'send-email'` (kebab-case) and `'send-deadline-reminders'` (kebab-case) alongside `'sendTemplate'` (camelCase). The certificates-qr.js handler similarly mixes `'generate-certificate'` (kebab) with `'generate_and_email'` (snake_case) at L781.
- **Suggested fix:** Standardize all action names within a single file to kebab-case (already used by `resend-email.js`, `social-media-api.js`, `certificates-qr.js`, `judge-automation.js`), and rename `'sendTemplate'` → `'send-template'` and `'generate_and_email'` → `'generate-and-email'`. Update all callers.

### [x] CQ2-H8 — `serverQuery` object in `utils.js` is exported but never called externally — dead abstraction

- **Files:** `utils.js` L2831–2920
- **Description:** `serverQuery` (exported at L3663 and L3667) provides `execute()` and `loadAll()` methods that are thin wrappers around `apiClient.select()` and `apiClient.selectAll()`. No module outside `utils.js` calls `serverQuery.*` — confirmed by full-codebase grep. It has its own test file (`tests/server-query.test.js`) but the underlying `apiClient` methods it wraps are tested directly. The abstraction adds ~90 lines of maintained surface area with no active consumers.
- **Suggested fix:** Remove `serverQuery` from the exports. If `loadAll` semantics are still needed, they already exist as `apiClient.selectAll()`. Update `server-query.test.js` to test `apiClient.selectAll` directly.

---

## MEDIUM

### CQ2-M1 — 13 frontend modules have no test file at all

- **Untested modules:** `areas-manager.js`, `award-companies-app.js`, `award-nominees-app.js`, `btc-module.js`, `check-in-app.js`, `company-profile-app.js`, `config.js`, `global-actions.js`, `location.js`, `nominate.js`, `nominee-uploads.js`, `public-winners-app.js`, `register-app.js`, `seating-enhancements.js`, `submit-entry-payment.js`, `winners-portal-app.js`
- **Description:** Of these, the highest-risk untested modules are: `submit-entry-payment.js` (913 lines, payment flow), `seating-enhancements.js` (1037 lines, complex seating logic), `nominee-uploads.js` (1018 lines, CSV parsing and batch DB operations), `nominate.js` (836 lines, public nomination form), and `register-app.js` (487 lines, event registration with Stripe integration).
- **Suggested fix:** Prioritize test files for `submit-entry-payment.js`, `seating-enhancements.js`, and `nominee-uploads.js` which are the largest and touch payment/data-integrity-critical flows.

### CQ2-M2 — `stripe-payment.js` API: `createPublicCheckout`, `createEventCheckout`, `processRefund`, and all email-sending functions are untested

- **Files:** `api/stripe-payment.js` — untested: `createPublicCheckout` L858, `createEventCheckout` L940, `processRefund` L1028, `sendEntryConfirmationEmail` L658, `sendPaymentFailedEmail` L702, `sendRefundConfirmationEmail` L743, `handleCheckoutSessionCompleted` L228, `handlePaymentIntentSucceeded` L300, `handleChargeSucceeded` L409, `handleChargeRefunded` L536
- **Description:** The 505-line test file covers only `createCheckoutSession`, `handleStripeWebhook` (routing only), and `verifyPayment`. The event checkout (used for event registration) and public checkout (used for anonymous entry payments) are entirely untested. `processRefund` (the admin refund path) has no test coverage. The three email-sending functions have no tests despite interacting with both the DB and Resend API.
- **Suggested fix:** Add test suites for `createPublicCheckout` (with and without `STRIPE_SECRET_KEY`), `createEventCheckout`, and `processRefund`. Mock `stripe.refunds.create`.

### CQ2-M3 — Global `STATE` object is mutated by 20+ modules with no access control

- **Files:** `config.js` L180 (definition); mutated by `organisations.js` (157 usages), `events.js` (68), `dashboard.js` (67), `winners.js` (48), `awards.js` (40), and 15+ other modules
- **Description:** `STATE` is a plain global object that any module can read or write. `organisations.js` directly assigns `STATE.allOrganisations = pageData` and `STATE.filteredOrganisations = pageData` as part of server-side pagination, but `dashboard.js` reads `STATE.allOrganisations` for stats calculations. If two modules race to update `STATE.allOrganisations`, the stats can be stale or wrong. There is no freeze, no setter, no event mechanism — just raw property assignment.
- **Suggested fix:** While a full state management system would be over-engineered for vanilla JS, document which module "owns" each STATE property and add a comment warning against cross-module mutation. Medium-term: introduce per-module state and use `customEvent` for cross-module updates instead of shared mutable state.

### CQ2-M4 — Magic status strings scattered across 172 usages with no central definition

- **Files:** Across 20+ frontend modules and all API handlers
- **Description:** Status strings like `'submitted'`, `'shortlisted'`, `'under_review'`, `'winner'`, `'rejected'`, `'draft'`, `'published'`, `'attending'`, `'not_attending'`, `'maybe'` appear as inline string literals 172+ times. `entries.js` alone references `'shortlisted'` 15 times, `'submitted'` 12 times. A typo in one place (e.g. `'shortlisted'` vs `'short_listed'`) would silently fail DB queries with no error.
- **Suggested fix:** Expand `config.js` to export proper enum objects: `ENTRY_STATUS = { DRAFT: 'draft', SUBMITTED: 'submitted', UNDER_REVIEW: 'under_review', SHORTLISTED: 'shortlisted', WINNER: 'winner', REJECTED: 'rejected' }` and `EVENT_ATTENDEE_STATUS = { ATTENDING: 'attending', NOT_ATTENDING: 'not_attending', MAYBE: 'maybe' }`. Replace all string literals with these constants.

### CQ2-M5 — `events.js` and `organisations.js` have 130 and 91 async functions without JSDoc

- **Files:** `events.js` (130 undocumented async), `organisations.js` (91 undocumented async), `crm.js` (19 undocumented async)
- **Description:** `events.js` is 14,489 lines and `organisations.js` is 9,737 lines — the two largest files in the codebase. Only about 30% of their async functions have JSDoc comments. Public methods like `addAttendee`, `exportDietarySummary`, `bulkEmail`, and `calculateDashboardStats` have no parameter documentation.
- **Suggested fix:** Add JSDoc at minimum to all public-facing methods (those reachable via `data-action` attributes or called from other modules). Internal helpers prefixed with `_` can be lower priority.

### [x] CQ2-M6 — `_populateFiltersFromConstants()` in `awards.js` is a dead stub

- **File:** `awards.js` L92–97
- **Description:** The function is called from `loadAwards()` at L30 but its body is empty with the comment `// All filters are now populated from DB after data loads`. It contributes dead call overhead and creates confusion about the filter population sequence.
- **Suggested fix:** Remove the function and its call from `loadAwards()`.

### CQ2-M7 — API action naming is inconsistent across handlers (snake_case vs kebab-case vs camelCase)

- **Files:** All `api/*.js` files
- **Description:** Different handlers use different conventions for the `action` field:
  - `resend-email.js`: `'send-invoice'`, `'send-templated'`, `'send-campaign'`, `'send-test'`, `'send'`, `'process-queue'` — kebab-case
  - `upload-proxy.js`: `'get_entry'`, `'get_existing_files'`, `'save_file_metadata'`, `'get_upload_token'` — snake_case
  - `entry-proxy.js`: `'submit_entry'`, `'submit_nomination'` — snake_case
  - `registration-proxy.js`: `'get_event'`, `'register_guest'` — snake_case
  - `social-media-api.js`: `'publish'`, `'process-scheduled'` — kebab-case
  - `certificates-qr.js`: `'generate-certificate'` (kebab) + `'generate_and_email'` (snake) — mixed within same file
  - `email-automation.js`: `'send-email'` (kebab) + `'sendTemplate'` (camelCase) — mixed within same file
- **Suggested fix:** Standardize on kebab-case for all action names (matches REST conventions). Update all client-side callers. Document the convention in `CLAUDE.md`.

### [x] CQ2-M8 — `email-automation.js` does inline auth in the handler instead of calling `verifyAuth()`

- **File:** `api/email-automation.js` L1300–1312
- **Description:** Instead of calling the shared `verifyAuth(req, res)` pattern used by 5 other API files, `email-automation.js` inlines the auth check: reads `req.headers.authorization`, extracts token, calls `supabaseAuth.auth.getUser(token)`, and checks `authError || !user`. There is no `verifyAuth` function in this file at all. This is inconsistent and means any future auth enhancement (e.g., adding rate limiting per user, token refresh) must be applied separately here.
- **Suggested fix:** Extract the inline auth logic into a `verifyAuth()` helper (or, after CQ2-C2 is resolved, import from `api/_lib/auth.js`).

### CQ2-M9 — `utils.js` contains 7 dead utility methods that are exported but never called

- **File:** `utils.js`
  - `showTableLoading` L469 — no external callers
  - `showToastWithAction` L1410 — no external callers
  - `trackFormChanges` L1519 — no external callers
  - `markFormSaved` L1565 — no external callers
  - `showColumnVisibilityDialog` L1670 — no external callers (organisations.js has its own `_columnVisibility`)
  - `applyColumnVisibility` L1734 — no external callers
  - `highlightSearch` L1503 — duplicate of `highlightMatch` (L264); neither is identical but `highlightMatch` is used; `highlightSearch` is never called
- **Description:** These methods add ~250 lines of maintained code, are included in the build bundle, and appear in test output via `utils.test.js` coverage. `showColumnVisibilityDialog` was likely superseded by the inline column visibility implementation in `organisations.js`.
- **Suggested fix:** Remove or mark as `@deprecated` with `@internal`. If `trackFormChanges`/`markFormSaved` are intended for future use, add a `// TODO: not yet integrated` comment so they're not mistaken for active code.

---

## LOW

### [x] CQ2-L1 — `btc-module.js` uses `window.btcModule` (no ModuleRegistry) and has no test

- **File:** `btc-module.js` L178, `main.js` L64
- **Description:** `btc-module.js` exposes itself via `window.btcModule = btcModule` directly instead of `ModuleRegistry.register()`. It is the only module in the build that uses the legacy pattern. It also imports TradingView widgets which are unrelated to the awards CMS core and has no unit test.
- **Suggested fix:** Change `window.btcModule = btcModule` to `ModuleRegistry.register('btcModule', btcModule)` to follow the established pattern.

### [x] CQ2-L2 — `company-profile-app.js` and `register-app.js` use `alert()` for all user feedback

- **Files:** `company-profile-app.js` L118, L122, L258, L268, L272, L280, L283, L323, L333, L335 (10 usages); `register-app.js` L166, L174, L205, L324, L378 (5 usages); `check-in-app.js` L231, L244 (2 usages)
- **Description:** These standalone pages use browser `alert()` for all success/error feedback, which blocks the JS thread, can't be styled, and is jarring UX. `check-in-app.js` defines its own `showError(msg)` function using DOM insertion, but then calls `alert()` in the async error paths rather than `showError`.
- **Suggested fix:** Each standalone page should use its own lightweight toast (copy `check-in-app.js`'s `showError` pattern or extract to `public-utils.js` per CQ2-H2). Replace all `alert()` calls.

### CQ2-L3 — Hardcoded magic page-size numbers scattered across modules

- **Files:** `awards.js` L104 (1000), L200 (1000), L970 (1000); `award-nominees-app.js` L89 (1000); `award-companies-app.js` L73 (1000); `entries.js` L1547 (200); `awards.js` L1354, L1566 (200)
- **Description:** Magic numbers like `pageSize: 1000` and `pageSize: 200` appear in 8+ places. When Supabase or data-proxy row limits change, these must be hunted down manually. `pageSize: 1` (for existence checks) is fine and idiomatic.
- **Suggested fix:** Add constants to `config.js`: `const PAGE_SIZE_DEFAULT = 50`, `const PAGE_SIZE_FULL = 1000`, `const PAGE_SIZE_LARGE = 200`. Use these in all `apiClient` calls.

### CQ2-L4 — 8 API files are over 500 lines; `data-proxy.js` is 1,634 lines

- **Files:**
  - `api/data-proxy.js`: 1,634 lines
  - `api/email-automation.js`: 1,356 lines (includes 510 lines of hardcoded email template strings)
  - `api/stripe-payment.js`: 1,165 lines
  - `api/certificates-qr.js`: 842 lines
  - `api/judge-automation.js`: 635 lines
  - `api/entry-proxy.js`: 634 lines
  - `api/resend-email.js`: 558 lines
  - `api/social-media-api.js`: 520 lines
- **Description:** `data-proxy.js` is well-structured with a clear named-function-per-operation pattern and a single dispatch handler at the bottom — it is large but maintainable. `email-automation.js` has ~510 lines of `EMAIL_TEMPLATES` constant (L154–670) that could be moved to a separate `api/_lib/email-templates.js` file to make the handler logic easier to navigate. `stripe-payment.js` mixes webhook handlers, checkout session creation, and email sending in one file.
- **Suggested fix:** For `email-automation.js`, extract `EMAIL_TEMPLATES` and `DB_TEMPLATE_TYPE_MAP` to `api/_lib/email-templates.js`. This alone reduces the file from 1,356 to ~830 lines. Other files are within acceptable range given the Vercel 12-function limit.

### CQ2-L5 — Cross-module coupling via direct symbol references (not via events or registry)

- **Files:** `awards.js` L1131 (`orgsModule.openCompanyProfile` in a data-action string), `dashboard.js` L50–52 (calls `awardsModule.loadAwards()`, `orgsModule.loadOrganisations()`, `winnersModule.loadWinners()` directly), `winners.js` L387 (`winnerPipelineModule.renderPipelineDashboard` in a data-action string)
- **Description:** Modules reference each other's exported names directly. `dashboard.js` calls module load functions directly — this works because all modules are loaded as globals, but creates implicit load-order dependencies. If a module is lazy-loaded (via the chunk system), these calls can fail silently if the chunk hasn't loaded yet.
- **Suggested fix:** Route cross-module calls through `ModuleRegistry.get('awardsModule')?.loadAwards()` with optional chaining, rather than assuming global availability. For data-action strings, this is already safe since the action registry resolves at click time.

### [x] CQ2-L6 — `diagnose.js` and `check-schema.js` are developer scripts bundled with the application

- **Files:** `diagnose.js` (174 lines), `check-schema.js` (~50 lines)
- **Description:** `diagnose.js` is a browser console script (wrapped in an async IIFE) that queries all DB tables and logs results. `check-schema.js` is a Node.js script using `require()` and `dotenv`. Neither is part of the production app. `diagnose.js` is included in `index.html` script loading order via `build.js` pattern matching — if it is accidentally bundled, it runs on page load and floods the console.
- **Suggested fix:** Move both files to `scripts/` or `dev-tools/` with a `README` note. Add them to `.vercelignore` and ensure they are excluded from the esbuild bundle entry points.

---

## Where Shared Utilities Should Live

Based on this audit, the recommended shared utility structure is:

```
api/_lib/
  auth.js          — verifyAuth(), ROLE_HIERARCHY, hasMinimumRole(), getUserRole()
  email-utils.js   — textToHtml()  [currently in 2 files]
  email-templates.js — EMAIL_TEMPLATES, DB_TEMPLATE_TYPE_MAP  [from email-automation.js]
  email-header.js  — wrapEmail()  [already exists]
  automation-scheduler.js  [already exists]

public-utils.js    — escapeHtml(), toTitleCase(), showPublicToast(), proxyFetch()
  (loaded by standalone pages: check-in, register, company-profile, award-nominees, etc.)

config.js (additions)
  ENTRY_STATUS     — entry status enum (lowercase, matches DB)
  AWARD_STATUS     — award status enum
  EVENT_STATUS     — event status enum
  ATTENDEE_STATUS  — attending/not_attending/maybe
  PAGE_SIZE_*      — pagination constants
```
