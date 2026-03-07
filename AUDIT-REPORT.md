# Awards CMS - Full System Audit Report

**Date:** 2026-03-07
**Branch:** `claude/review-changes-mltprymys8798f8g-1z2Re`
**Purpose:** Deep dive to confirm CMS is fully functional and document all issues with fix plans.

---

## Overall Status

| Area | Status | Summary |
|------|--------|---------|
| **Build** | PASS | `npm run build` completes in ~7s, 33% JS reduction, 38% CSS reduction |
| **Tests** | PASS | 65/65 suites, 6381 passed, 3 skipped, 0 failures |
| **Lint** | PASS | 0 errors |
| **Core CRUD** | WORKING | Awards, Orgs, Winners, Assignments, Events, Media, CRM, Email all functional |
| **Database** | MOSTLY OK | 3 missing columns/tables referenced in code |
| **API Endpoints** | MOSTLY OK | 30 issues found, 3 critical |
| **Frontend Modules** | MOSTLY OK | 2 critical gaps (social posting, storage bucket) |
| **HTML/Integration** | MOSTLY OK | 3 broken API paths, 3 missing modals |

**Verdict:** The CMS is ~90% functional. Core admin features work. The issues below are mostly in secondary workflows (social media posting, certificates, automated scheduling) and edge cases.

---

## CRITICAL ISSUES (Must Fix - Will Cause Runtime Errors)

### C1. Missing email template: `ENTRY_DEADLINE_REMINDER`
- **File:** `api/email-automation.js:551`
- **Problem:** `sendTemplateEmail('ENTRY_DEADLINE_REMINDER', ...)` called but this template key doesn't exist in `DB_TEMPLATE_TYPE_MAP` or `EMAIL_TEMPLATES`
- **Impact:** Deadline reminder emails will crash
- **Fix Plan:** Add `ENTRY_DEADLINE_REMINDER` to the template maps with a sensible default HTML template

### C2. Missing database column: `events.max_capacity`
- **File:** `api/registration-proxy.js:142`
- **Problem:** Code queries `events.max_capacity` but column doesn't exist in schema
- **Impact:** Event registration capacity checks fail
- **Fix Plan:** Add migration to create `max_capacity INTEGER` column on `events` table, or remove the capacity check

### C3. Missing database table: `certificates`
- **File:** `api/certificates-qr.js:145`
- **Problem:** Code does `.from('certificates')` but table doesn't exist
- **Impact:** Certificate generation/storage fails
- **Fix Plan:** Create `certificates` table with columns: id, winner_id, certificate_url, qr_code, generated_at, etc.

### C4. Incorrect API endpoint paths (`.js` extension)
- **Files:**
  - `ticket-management.js:232` — fetches `/api/stripe-payment.js` (should be `/api/stripe-payment`)
  - `ticket-management.js:548` — fetches `/api/stripe-payment.js` (should be `/api/stripe-payment`)
  - `winner-announcements.js:328` — fetches `/api/resend-email.js` (should be `/api/resend-email`)
- **Impact:** These fetch calls will 404 on Vercel (serverless functions don't use `.js` in URL)
- **Fix Plan:** Remove `.js` extension from all three fetch URLs

### C5. Missing HTML modals referenced in JS
- **Modals not in `index.html`:**
  - `createScheduledReportModal` (referenced in `app.js`)
  - `reportPreviewModal` (referenced in `app.js`)
  - `dynamicAssignModal` (referenced in `assignments.js`)
- **Impact:** `document.getElementById()` returns null → runtime errors when these features are accessed
- **Fix Plan:** Add Bootstrap modal HTML for each to `index.html`, or guard the JS with null checks

### C6. Missing database column: `contacts.contact_type`
- **Files:** `api/email-automation.js:557`, `api/judge-automation.js:45`
- **Problem:** Code filters contacts by `contact_type` but column doesn't exist
- **Impact:** Judge-related email queries fail
- **Fix Plan:** Add `contact_type VARCHAR` column to contacts table, or restructure the query

---

## HIGH-SEVERITY ISSUES (Should Fix - Broken Secondary Features)

### H1. Social media posting not functional
- **File:** `social-media.js:567-582`
- **Problem:** Posts are saved to DB with 'published' status but never actually posted to platforms. The Supabase Edge Function `publish-social-post` doesn't exist. Falls back to showing "Configure API keys to auto-publish."
- **Impact:** Social media management UI works, but nothing actually posts
- **Fix Plan:** Either implement the Edge Function or route through `/api/social-media-api.js` which has posting logic already

### H2. Winner announcement social posts fail silently
- **File:** `api/email-automation.js:654-675`
- **Problem:** Social media auto-posting in winner announcements is wrapped in try/catch that swallows errors
- **Impact:** Winners are emailed but social posts silently fail with no tracking
- **Fix Plan:** Log failures to `activity_logs` table or add a retry queue

### H3. Judge progress reports query wrong field
- **File:** `api/automation-scheduler.js:221`
- **Problem:** Queries `judge_scores` with `eq('status', 'submitted')` but the field doesn't exist on that table
- **Impact:** Weekly judge progress reports show 0% completion always
- **Fix Plan:** Change to query the correct completion field (e.g., `is_complete = true`)

### H4. Event registration missing capacity validation
- **File:** `api/registration-proxy.js:142`
- **Problem:** Event capacity is fetched but never validated before inserting guests
- **Impact:** Can register unlimited guests, exceeding venue capacity
- **Fix Plan:** Add `if (currentGuests + newGuests > event.max_capacity) return 400` check

### H5. Certificate logo loading commented out
- **File:** `api/certificates-qr.js:78`
- **Problem:** `// doc.image('path/to/logo.png', ...)` — logo never appears on certificates
- **Impact:** Certificates generate without organisation/award logos
- **Fix Plan:** Load logo from `tenant_branding` table or Supabase storage

### H6. Hardcoded judging dates in entry confirmation
- **File:** `api/email-automation.js:495-498`
- **Problem:** Hardcoded 'January 15, 2025' and 'TBC' in entry confirmation email
- **Impact:** Outdated dates shown to entrants
- **Fix Plan:** Query `award_years.judging_start_date` and `judging_end_date` dynamically

### H7. Judge conflict warnings not enforced
- **File:** `judge-portal.js:400-509`
- **Problem:** Conflict of interest detection shows warnings but doesn't prevent scoring
- **Impact:** Judges can still score entries they have conflicts with
- **Fix Plan:** Disable score submission when conflict detected, or require explicit override

### H8. Media gallery uploads depend on uncreated storage bucket
- **File:** `media-gallery-new.js:3012-3036`
- **Problem:** File uploads call `apiClient.upload('media-gallery', ...)` but the `media-gallery` bucket must exist in Supabase Storage
- **Impact:** Drag-drop file uploads fail if bucket not configured
- **Fix Plan:** Add bucket creation to deployment checklist / Supabase setup script

---

## MEDIUM-SEVERITY ISSUES (Should Fix - Edge Cases & Data Integrity)

### M1. Data proxy rate limiting has race condition
- **File:** `api/data-proxy.js:1000-1006`
- **Problem:** In-memory rate limiting with `rateLimits.set()` is not atomic under concurrent requests
- **Fix Plan:** Use database-backed rate limiting or Redis

### M2. QR code verification crashes on invalid data
- **File:** `api/certificates-qr.js:475`
- **Problem:** `JSON.parse(qrData)` without try/catch in `verifyQRCode()`
- **Fix Plan:** Wrap in try/catch, return validation failure

### M3. Payment reference generation fallback
- **File:** `payments.js:1526-1534`
- **Problem:** Falls back to client-side `PAY-${year}-${rand}` if RPC missing — possible duplicates
- **Fix Plan:** Ensure RPC exists in Supabase, or add uniqueness check

### M4. Twitter API uses deprecated v1.1 endpoints
- **File:** `api/social-media-api.js:23-55`
- **Problem:** Uses Twitter API v1.1 media endpoint which is being deprecated
- **Fix Plan:** Migrate to Twitter/X API v2

### M5. Entry proxy silent error handling
- **File:** `api/entry-proxy.js:298-307`
- **Problem:** Email confirmation and extended field updates use non-blocking try/catch
- **Fix Plan:** Log failures to activity_logs

### M6. Stripe webhook secret not validated early
- **File:** `api/stripe-payment.js:133`
- **Problem:** `STRIPE_WEBHOOK_SECRET` assumed to exist, gives cryptic error if missing
- **Fix Plan:** Add early validation at handler entry

### M7. CORS origin validation weak
- **File:** `api/data-proxy.js:1148-1150`
- **Problem:** Empty origin header defaults to `*` which is insecure
- **Fix Plan:** Require origin header in production

### M8. Voting proxy incomplete error code handling
- **File:** `api/voting-proxy.js:147`
- **Problem:** Only handles `PGRST116` error code, other DB errors could crash endpoint
- **Fix Plan:** Add catch-all error handler

### M9. register.html invalid action handler
- **File:** `register.html:201`
- **Problem:** `data-action="window.print"` doesn't work with action delegation system
- **Fix Plan:** Change to `onclick="window.print()"` or wrap in utils method

---

## LOW-SEVERITY ISSUES (Nice to Fix - Code Quality)

| ID | File | Issue |
|----|------|-------|
| L1 | `api/certificates-qr.js:56` | Sync `fs.mkdirSync()` blocks event loop — use async |
| L2 | `api/social-media-api.js:317` | No validation that `post.platforms` is an array |
| L3 | `api/resend-email.js:11` | Unnecessary `require('dotenv').config()` on Vercel |
| L4 | `api/automation-scheduler.js:366` | Dynamic `require('./email-automation')` inside function — potential circular dep |
| L5 | `api/judge-automation.js:227` | `// score += judgeExperienceBonus;` — dead code comment |
| L6 | `email-builder.js:555` | Video elements render as static placeholders in emails |
| L7 | `sponsor-portal.js:94-105` | 10MB upload cap with no image compression |
| L8 | Various test files | 80+ "Cannot log after tests are done" async warnings |

---

## TEST SUITE STATUS

| Metric | Value |
|--------|-------|
| Test Suites | 65/65 passing |
| Tests | 6381 passing, 3 skipped |
| Skipped Tests | 3 in `app.test.js` (DOM event listeners, covered by e2e) |
| Async Warnings | ~80 "log after test" warnings (non-blocking) |
| Mock Quality | Appropriate — tests verify real business logic, not just mock data |
| Error Path Coverage | Good — error handling paths are actively tested |

---

## DATABASE STATUS

| Check | Status |
|-------|--------|
| Tables defined | 45+ tables across migrations |
| Foreign keys | All valid |
| RLS policies | Properly implemented (migration-045) |
| Indexes | Good coverage, minor gaps on `entry_number`, `company_name`, `event_date` |
| Missing columns | `events.max_capacity`, `contacts.contact_type` |
| Missing tables | `certificates` |

---

## DEPLOYMENT PREREQUISITES (Not Code Issues)

These are configuration tasks needed for production, not bugs:

- [ ] Set all environment variables in Vercel (.env.example as reference)
- [ ] Run SQL migrations in Supabase (in order)
- [ ] Create `media-gallery` storage bucket in Supabase
- [ ] Create `entry-files` storage bucket in Supabase
- [ ] Configure Stripe webhook endpoint → `/api/stripe-payment`
- [ ] Configure social media API credentials (Twitter, LinkedIn, Facebook)
- [ ] Configure Resend API key for email sending
- [ ] Configure Anthropic API key for AI vetting
- [ ] Set up Sentry DSN for error monitoring
- [ ] Deploy to Vercel: `vercel --prod`

---

## FIX PRIORITY ORDER

If this session gets cut off, the next Claude session should fix issues in this order:

### Phase 1: Critical Fixes (blocks core functionality)
1. **C4** — Remove `.js` from API fetch URLs in `ticket-management.js` and `winner-announcements.js`
2. **C1** — Add `ENTRY_DEADLINE_REMINDER` email template
3. **C5** — Add missing modals to `index.html` or add null guards
4. **C2** — Add `events.max_capacity` column migration
5. **C3** — Add `certificates` table migration
6. **C6** — Add `contacts.contact_type` column migration

### Phase 2: High-Severity Fixes (broken secondary features)
7. **H3** — Fix judge progress report query field
8. **H6** — Replace hardcoded judging dates with dynamic query
9. **H4** — Add event capacity validation
10. **H1** — Wire social media posting through existing API
11. **H7** — Enforce judge conflict of interest
12. **H5** — Implement certificate logo loading
13. **H8** — Document storage bucket creation in setup

### Phase 3: Medium-Severity Fixes (edge cases)
14. **M2** — Add try/catch to QR verification
15. **M5** — Log entry proxy failures
16. **M6** — Validate Stripe webhook secret early
17. **M7** — Tighten CORS validation
18. **M8** — Add catch-all error handler to voting proxy
19. **M9** — Fix register.html print button
20. **M1, M3, M4** — Rate limiting, payment refs, Twitter API

### Phase 4: Low-Severity & Code Quality
21. L1-L8 — Async file ops, input validation, dead code cleanup

---

## HOW TO CONTINUE IF SESSION IS CUT OFF

1. Read `CLAUDE.md` for project context
2. Read this file (`AUDIT-REPORT.md`) for the full issue list
3. Check `IMPLEMENTATION-PLAN.md` for what was already completed
4. Start fixing from **Phase 1** above — each fix is self-contained
5. Run `npm test` after each change to ensure no regressions
6. Run `npm run build` to verify build still passes
7. Commit and push to `claude/review-changes-mltprymys8798f8g-1z2Re`
