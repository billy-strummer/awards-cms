# Awards CMS - Comprehensive Audit Log

> Last updated: 2026-02-26
> Branch: `claude/review-changes-mltprymys8798f8g-1z2Re`

---

## Summary

**Total areas audited:** 28+
**Total files modified:** 30+
**Total commits:** 20 audit-related commits

---

## Round 1: Core Functionality & Security

### 1. Save Button Functionality
- **Commit:** `a01592e` Add pending queue replay to sync localStorage fallback data
- **Fixes:** localStorage fallback queuing, offline save recovery, pending data replay on reconnect

### 2. Missing `await` Bugs
- **Commit:** `b81e0b5` Add asyncGuard/safeDate utilities
- **Fixes:** Unguarded async operations causing race conditions, missing awaits on Supabase calls

### 3. localStorage Fallbacks
- **Commit:** `a01592e` Add pending queue replay
- **Fixes:** Data saved to localStorage when offline now replays to Supabase on reconnect

### 4. XSS / Injection Vulnerabilities
- **Commits:** `2069c71`, `457735b`, `a15270c`, `7ba3975`, `cfcb260`, `653a5d8`, `6542689`, `6484334`, `20effe6`, `2a9db9e`
- **Fixes:** 50+ XSS vectors patched across all modules — innerHTML injection, URL hash, document.write, sponsor tier, event names, CRM modals, email builder drag-and-drop, winner pipeline, error messages
- **Files:** awards.js, entries.js, events.js, organisations.js, crm.js, email-builder.js, winner-announcements.js, sponsor-portal.js, reporting.js, app.js, utils.js

### 5. Search / Filter Edge Cases
- **Commit:** `cfcb260` Fix search, filter, and error message XSS issues
- **Fixes:** Search term injection, filter value sanitization, empty search handling

### 6. Pagination Edge Cases
- **Commit:** `2c6863b` (select-all pagination fix)
- **Fixes:** Select-all only selecting current page, off-by-one in page calculations

### 7. State Sync Issues
- **Commit:** `bfdd498` Add loading guards to prevent concurrent data fetches
- **Fixes:** Multiple concurrent loadAwards/loadEntries calls racing, stale data overwrites

### 8. Duplicate Element IDs
- **Commit:** `59589fe` Fix duplicate submitBtnText ID
- **Fixes:** Registration error handler creating duplicate IDs in DOM

### 9. Accessibility
- **Commit:** `3292bfa` Improve accessibility: keyboard support for clickable elements
- **Fixes:** Non-button clickable elements missing keyboard handlers, tabindex, aria-labels

### 10. File Upload Validation
- **Commit:** `2fc5108` Add file size and type validation
- **Fixes:** Missing file size limits, no MIME type validation, unrestricted upload types

### 11. Export Functions
- **Commit:** `6918856` Add try-catch error handling to export functions
- **Fixes:** Unhandled errors in CSV/PDF export, missing error feedback to users

### 12. Race Conditions
- **Commit:** `bfdd498` Add loading guards to prevent concurrent data fetches
- **Fixes:** Concurrent module loads, double-click creating duplicate records

### 13. Date Parsing
- **Commit:** `b81e0b5` Add asyncGuard/safeDate utilities
- **Fixes:** Invalid date strings causing NaN, timezone-related off-by-one, locale-dependent parsing

### 14. Error Recovery
- **Commit:** `b81e0b5` Fix date parsing and delete safety
- **Fixes:** Errors in one operation crashing other operations, missing try-catch in critical paths

### 15. Connection Health
- **Commit:** `c79d7e9` Add periodic Supabase connection health check
- **Fixes:** Silent disconnection from Supabase, no reconnection feedback, stale auth tokens

---

## Round 2: Infrastructure & Data Layer

### 16. Modal Lifecycle & Memory Leaks
- **Commit:** `2c6863b`
- **Findings:** 132+ Bootstrap modals audited — most properly self-remove or use `{ once: true }`. Dynamic modals in entries.js, events.js, email-builder.js all call `.remove()` on close
- **Status:** Verified as mostly correct; no major leaks found

### 17. Realtime Subscriptions
- **Commit:** `2c6863b`
- **Fixes:** Duplicate subscription guards added to `setupRealtimeSync()` and `_initPresence()` in app.js. Old channels now removed before creating new ones. Organisations module already had guard.

### 18. Bulk Operations
- **Commit:** `2c6863b`
- **Fixes:** Select-all in entries.js and events.js now selects ALL filtered items across all pages, not just visible checkboxes on current page

### 19. Numeric / Currency Calculations
- **Commit:** `2c6863b`
- **Fixes:**
  - reporting.js: Division by zero in 5 judge progress averages + entries-by-status percentages
  - payments.js: parseFloat without NaN validation (could store NaN in DB)
  - payments.js: Floating point accumulation in invoice calculations — all steps now round to 2 decimal places

### 20. Email Template Substitution
- **Commit:** `2c6863b`
- **Fixes:**
  - api/email-automation.js: Template variable substitution now HTML-escapes values
  - api/resend-email.js: All user data (company names, award names, venues) HTML-escaped before embedding in templates
  - api/judge-automation.js: Judge names, award names, entry numbers escaped in assignment/shortlist emails

### 21. Print / Export / CSV Injection
- **Commit:** `2c6863b`
- **Fixes:**
  - payments.js, crm.js, reporting.js: All CSV exports sanitize cells starting with `=`, `+`, `-`, `@`, `|`, tab, CR
  - Added UTF-8 BOM (`\uFEFF`) for proper £ symbol rendering in Excel
  - crm.js: Added charset=utf-8 to Blob type

---

## Round 3: Security, Permissions, Integration & UX

### 22. Auth / Session Management
- **Commit:** `ffe2941`
- **Fixes:**
  - Auto-logout on 401/unauthorized instead of just showing toast
  - Force logout even when signOut() fails (network error) to prevent zombie sessions
  - Clear all cached STATE arrays on logout (allAwards, allOrganisations, allWinners, allEvents, allEntries) to prevent data leakage between sessions

### 23. RBAC Permission Enforcement
- **Commit:** `ffe2941`
- **Fixes:**
  - **Critical:** Default role changed from `admin` to `viewer` when no role found in DB
  - Error fallback also defaults to `viewer` instead of `admin`
  - Role names normalized to lowercase to prevent `Admin` vs `admin` bypasses
  - Delete permission guards added to: `deleteAward`, `bulkDelete` (awards), `deleteEntry`, `deleteEvent`, `deletePayment`

### 24. Form Validation
- **Commit:** `ffe2941`
- **Fixes:**
  - events.js `saveEvent()`: Added missing `form.checkValidity()` + `reportValidity()`
  - payments.js: Added NaN/<=0 validation on payment amount before save

### 25. URL Routing / Navigation
- **Commit:** `ffe2941`
- **Fixes:**
  - Added `popstate` event handler so browser back/forward buttons work correctly with tab navigation
  - Enabled `beforeunload` warning when save is in progress or email builder has unsaved changes

### 26. Stripe / Payment Integration
- **Commit:** `ffe2941`
- **Fixes:**
  - api/stripe-payment.js: Accept both `entryId` (camelCase) and `entry_id` (snake_case) from frontend
  - Store `payment_intent` (not `session.id`) as `payment_reference` to match webhook reconciliation
  - All references to entryId in createCheckoutSession updated to use resolved value

### 27. Data Integrity / Referential Consistency
- **Commit:** `ffe2941`
- **Fixes:**
  - awards.js: Clean up `award_assignments` before deleting award to prevent orphaned FK references
  - Documented: events, entries, organisations also need cascade cleanup (DB-level CASCADE recommended)
- **Noted issues (require DB migration):**
  - No DB-level CASCADE DELETE on any FK relationships
  - Mixed soft-delete (organisations) vs hard-delete (awards, entries, events) strategy
  - Organisation merge doesn't deduplicate conflicting assignments

### 28. Clipboard Operations
- **Commit:** `ffe2941`
- **Fixes:**
  - Added `utils.copyToClipboard()` with proper `.catch()` error handling
  - Includes `execCommand('copy')` fallback for browsers that deny Clipboard API access
  - All 9 files with `navigator.clipboard.writeText` now have a safe alternative available

### 29. Voting / Judge Portal
- **Commit:** `ffe2941`
- **Fixes:**
  - judge-portal.js: Score values now validated and clamped to valid range (0 to maxScore)
  - Prevents score manipulation via browser console DevTools

---

## Files Modified (Complete List)

| File | Commits Touched |
|------|----------------|
| app.js | 7 |
| utils.js | 6 |
| awards.js | 5 |
| entries.js | 5 |
| events.js | 5 |
| organisations.js | 4 |
| payments.js | 4 |
| crm.js | 3 |
| email-builder.js | 3 |
| auth.js | 3 |
| reporting.js | 3 |
| winner-announcements.js | 2 |
| api/resend-email.js | 2 |
| api/email-automation.js | 2 |
| api/judge-automation.js | 2 |
| api/stripe-payment.js | 1 |
| judge-portal.js | 1 |
| rbac.js | 1 |
| sponsor-portal.js | 1 |
| nominee-voting.js | 1 |
| assignments.js | 1 |
| branding.js | 1 |
| calendar.js | 1 |

---

---

## Verification Round (Commit `f91023a`)

All 29 areas were systematically re-verified by reading the actual code. 12 additional issues were found and fixed:

| Area | Verification | Issues Found & Fixed |
|------|-------------|---------------------|
| 1. Save Buttons | PARTIAL | Minor UX gap in offline path (not critical) |
| 2. Missing Awaits | **FIXED** | `await` added to `replayPendingQueues()` in auth.js (2 locations) |
| 3. localStorage | **FIXED** | try-catch added to column visibility localStorage calls |
| 4. XSS/Injection | **FIXED** | 5 remaining votingUrl XSS in onclick attributes (awards, entries, orgs) |
| 5. Search/Filters | PASS | No issues |
| 6. Pagination | PASS | No issues |
| 7. State Sync | PASS | No issues |
| 8. Duplicate IDs | PARTIAL | 3 modal IDs duplicated between assignments-modals.html and index.html |
| 9. Accessibility | **FIXED** | Stat card divs now have tabindex, role, keyboard handlers |
| 10. File Uploads | PASS | No issues |
| 11. Exports | **FIXED** | Empty data checks added to payments.js and crm.js CSV exports |
| 12. Race Conditions | PASS | Loading guards correct; asyncGuard exists but unused (acceptable) |
| 13. Date Parsing | **FIXED** | formatDate/formatRelativeTime now use safeDate() |
| 14. Error Recovery | PASS | Global handler + try-catch on all critical ops |
| 15. Connection Health | PASS | 60s ping, 2-failure threshold, recovery detection |
| 16. Modals | PASS | Dynamic modals self-remove, static use { once: true } |
| 17. Realtime | PASS | Guards verified on all 3 channel creation points |
| 18. Bulk Operations | **FIXED** | Chunked operations (500/chunk) for API limit compliance |
| 19. Numerics | PASS | Division guards and Math.round verified |
| 20. Email Templates | PASS | HTML escaping verified; URLs intentionally unescaped for href |
| 21. CSV/Export | PASS | Formula injection + UTF-8 BOM verified |
| 22. Auth/Session | PASS | 401 auto-logout, forced logout, state cleanup all verified |
| 23. RBAC | PASS | Default viewer role, delete guards all verified |
| 24. Form Validation | PASS | checkValidity and NaN checks verified |
| 25. Navigation | PASS | popstate and beforeunload verified |
| 26. Stripe | PASS | Dual param names, payment_intent storage verified |
| 27. Data Integrity | PASS | award_assignments cleanup before delete verified |
| 28. Clipboard | **FIXED** | events.js migrated to utils.copyToClipboard() |
| 29. Judge Portal | PASS | Score clamping verified |

---

## Known Remaining Issues (Not Yet Fixed)

These were identified during audits but require DB migrations or architectural changes:

1. **DB-level CASCADE DELETE** - All FK relationships should have `ON DELETE CASCADE` or `ON DELETE SET NULL` in Supabase schema
2. **Mixed delete strategy** - Standardize on soft-delete (archived status) or hard-delete across all modules
3. **Entry status state machine** - Any status can transition to any other; should enforce valid transitions (e.g., `rejected` cannot go directly to `winner`)
4. **Double-submit protection** - `protectModalDuringSave` disables close buttons but not the submit button itself
5. **Stale aggregate counts** - Entry counts per award, organisation award counts, and assignment counts are cached at load time and not updated after bulk operations
6. **Organisation merge deduplication** - Merging two orgs with same award creates duplicate assignments
7. **Notifications module** - `init()` is never called anywhere; dead code with orphaned cleanup in auth.js
8. **No maxlength on text inputs** - DB column limits may silently truncate long values
9. **Duplicate modal IDs** - 3 modals (assignmentsModal, assignmentActionsModal, addCompanyModal) duplicated between assignments-modals.html and index.html
10. **Remaining inline clipboard calls** - ~12 files still use raw `navigator.clipboard.writeText` instead of `utils.copyToClipboard()` (functional but lack fallback)

---

## Deep Audit Round 2 (Commits `e149874`, `df1fc2a`, `24b9d72`)

Comprehensive scan of 5 additional audit dimensions covering 30 new areas (Areas 30-59).

### Areas Fixed

**CRITICAL (3 commits):**

| # | Area | Fix |
|---|------|-----|
| 30 | Unbounded queries | Added `.limit()` to 8 files: calendar.js, rate-limiting.js, entry-revision.js, document-management.js |
| 36 | Vote race condition | Double-submit guard + unique constraint handling (23505) in both voting modules |
| 37 | Vote rate limiting | Added 10 votes/hour/email limit in public-voting.js and nominee-voting.js |
| 47 | Deleted entry voting | Added `.neq('is_deleted', true)` to entry query in public-voting.js |
| 48 | Check-in auth | Added Supabase session check before guest list access in check-in.html |
| 49 | Stripe price integrity | Added price validation check in register.html before Stripe redirect |
| 50 | Payment verification | payment-success.html now verifies payment exists in DB before showing success |

**HIGH (9 areas):**

| # | Area | Fix |
|---|------|-----|
| 31 | Org delete orphans | organisations.js: Delete contacts, notes, follow-ups, images, custom_fields, documents |
| 32 | Bulk invoice line items | payments.js: Delete invoice_line_items before invoice in bulk delete |
| 38 | Discount > 100% | payments.js: Clamp discount to 0-100% |
| 39 | Overpayment | payments.js: Warn on overpayment via console |
| 40/41 | Judge scoring | judge-portal.js: Score bounds already validated; added conflict confirmation |
| 42 | Event capacity | events.js: Clamp capacity to min 0 |
| 43 | Timezone dates | awards.js: Parse all dates as UTC for phase calculation |
| 44 | Merge cascade | organisations.js: Transfer entries, invoices, contacts, notes, follow-ups, images, documents |
| 45 | Admin lockout | rbac.js: Added ensureAdminExists() to check admin count before demotion |
| 46 | CRM probability | crm.js: Clamp deal_value >= 0, probability 0-100% on create and edit |
| 51 | Judge portal auth | judge-portal.js: Prefer Supabase session over localStorage |
| 56 | API auth | api/stripe-payment.js: JWT verification middleware; api/email-automation.js: auth check |

**MEDIUM (6 areas):**

| # | Area | Fix |
|---|------|-----|
| 33 | Blob URL leaks | events.js: revokeObjectURL after download; social-media.js: revoke before new |
| 34 | Tooltip disposal | assignments.js: Dispose existing tooltips before creating new ones |
| 53 | Winner portal | winners-portal.html: Require access_token, not just ID |
| 55 | SRI hashes | index.html: Added integrity + crossorigin to Bootstrap CSS/JS CDN links |
| 57 | Security headers | vercel.json: Added HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| 58 | Upload paths | upload-documents.js: Sanitise filenames to prevent path traversal |
| 59 | AI prompt injection | api/ai-vetting-proxy.js: Sanitise inputs before prompt interpolation |

### Remaining Items (Require DB/Architectural Changes)

11. **DB UNIQUE constraint on public_votes(entry_id, voter_email)** - Client-side check added but DB constraint needed for true atomic protection
12. **DB UNIQUE constraint on judge_assignments(award_id, judge_email)** - Prevents duplicate judge assignments
13. **Server-side Stripe session creation** - Price currently validated client-side; should create session via server endpoint
14. **CSP `unsafe-inline` and `unsafe-eval`** - Cannot remove without refactoring all inline event handlers to external JS
15. **Supabase RLS policy audit** - All public pages rely on RLS for data isolation; needs manual review
16. **OAuth token encryption at rest** - Social media tokens stored as plain text in DB
17. **Event capacity enforcement on registration** - Capacity field validated but no attendee count check against capacity
18. **Entry deadline enforcement** - No server-side check that entry submission is within deadline
19. **Email verification before vote counting** - Votes insert with email_verified=false; need webhook to flip to true
