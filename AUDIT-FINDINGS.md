# Awards CMS - Deep Audit Findings

**Date:** 2026-03-08
**Auditor:** Claude (Opus 4.6)
**Scope:** Full codebase analysis — frontend, backend, tests, database, deployment

---

## Overall Assessment: ~75-80% Production-Ready

The code is well-structured and feature-complete. All 65 test suites pass (6,381 tests). Build produces clean output (0 lint errors). However, the system has never been tested against real services (Supabase, Stripe, Resend, social media APIs).

---

## Bugs Fixed in This Session

### 1. Hardcoded Dates/Venues in Email Templates (FIXED)
**File:** `api/email-automation.js`
**Was:** Emails used hardcoded values like `'January 15, 2025'`, `'TBC'`, `'The Grand Hall, London'`
**Now:** All 5 email functions query `award_years` and `events` tables for real dates and venues

### 2. Payment Reminders Not Sending Emails (FIXED)
**File:** `api/automation-scheduler.js`
**Was:** `sendPaymentReminders()` logged to DB but never called email-sending function
**Now:** Calls `sendTemplateEmail('PAYMENT_REMINDER', ...)` with invoice details before logging

### 3. Empty togglePhotoSelection Stub (FIXED)
**File:** `winners.js`
**Was:** Empty function body, photos couldn't be deselected in press release export
**Now:** Tracks excluded photos via `excludedPhotos` Map, integrated with CSV/PDF/HTML exports

### 4. Missing Tenant Isolation in Emails (FIXED)
**File:** `api/email-automation.js`
**Was:** Single global branding cache, no tenant_id in email logs
**Now:** Per-tenant branding cache, `sendTemplateEmail()` accepts `tenantId` option, email logs include tenant_id

---

## Remaining Issues (Not Yet Fixed)

### Critical — Must Fix Before Production

#### A. Database Migration Runner Missing
- **Files:** 75 `database-*.sql` files in root directory
- **Issue:** No automated migration runner, no dependency ordering, no versioning
- **Risk:** Manual deployment may skip or mis-order migrations
- **Fix:** Create a numbered migration system or use a tool like `dbmate`/`flyway`

#### B. Social Media Schema Column Mismatch
- **File:** `social-media.js` lines 9-28
- **Issue:** Runtime `stripUnknownColumn()` function works around missing DB columns (PGRST204 errors)
- **Fix:** Ensure all `database-*.sql` migrations are applied; remove the workaround once schema is complete

### Moderate — Should Fix

#### C. No Integration/E2E Tests
- **Status:** All 6,381 tests use mocks; ~40% test real business logic, ~60% verify mock setup
- **Impact:** Zero confidence in: Stripe payment flow, Resend email delivery, Supabase query correctness, social media OAuth, full user workflows
- **Fix:** Add Playwright/Cypress E2E tests for critical paths (entry submission → payment → email confirmation)

#### D. Environment Variable Documentation
- **Issue:** No `.env.example` file listing all required variables
- **Fix:** Create `.env.example` with all ~15 required env vars and descriptions

#### E. Social Media API Compatibility
- **File:** `api/social-media-api.js`
- **Issue:** Twitter/X API has changed; OAuth flows untested against real APIs
- **Fix:** Test each platform's OAuth flow and posting with real test credentials

### Minor

#### F. Instagram Requires Image
- **File:** `api/social-media-api.js` lines 257-296
- **Issue:** Instagram posts fail if no image is provided; no fallback mechanism
- **Fix:** Add validation in the scheduling UI or generate a default image

#### G. CRM Deal Dates Show "TBD"
- **File:** `crm.js` line 1682
- **Issue:** Deals without expected_close_date show "TBD" — not actionable
- **Fix:** Either require the field or show a more helpful default

#### H. Hardcoded Sponsor ROI Values
- **File:** `reporting.js` lines 332-333
- **Issue:** Sponsor tier values are hardcoded (`Platinum: 15000`, `Gold: 8000`, etc.)
- **Fix:** Make configurable per tenant/season via settings

---

## Test Quality Summary

| Metric | Value |
|--------|-------|
| Total tests | 6,381 |
| Passing | 6,381 (100%) |
| Skipped | 3 |
| Test suites | 65/65 |
| Meaningful tests (~40%) | ~2,500 (business logic, validation, filtering) |
| Trivial tests (~60%) | ~3,800 (mock verification, DOM rendering, structure checks) |
| Integration tests | 0 |
| E2E tests | 0 |

---

## Category Readiness Scores

| Category | Code Complete | Production Ready |
|----------|:------------:|:----------------:|
| Core CRUD | 95% | 85% |
| Authentication/RBAC | 95% | 85% |
| Entry System | 95% | 80% |
| Judging | 90% | 75% |
| Payments/Stripe | 90% | 70% |
| Email System | 90% | 70% |
| Events/Tickets | 90% | 75% |
| Reporting | 95% | 85% |
| Social Media | 85% | 40% |
| Database/Deployment | 80% | 45% |
| UI/Frontend | 95% | 85% |

---

## Deployment Steps (When Ready)

1. Create Supabase project and run all `database-*.sql` files (start with `database-schema.sql`)
2. Set all environment variables in Vercel dashboard
3. Deploy to Vercel: `vercel --prod`
4. Configure Stripe webhook: `https://your-domain.com/api/stripe-payment`
5. Test entry submission flow end-to-end
6. Test payment flow with Stripe test keys
7. Send a test email via the admin panel
8. Configure social media OAuth credentials per platform
9. Set up Sentry DSN for error monitoring

---

## Next Claude Session Instructions

If this session gets cut off, the next Claude session should:
1. Read `CLAUDE.md` first for project context
2. Read `IMPLEMENTATION-PLAN.md` for progress and session log
3. Read this file (`AUDIT-FINDINGS.md`) for remaining issues
4. Focus on items in the "Remaining Issues" section above
5. Priority order: A (migration runner) → B (schema fix) → D (env docs) → C (E2E tests)
