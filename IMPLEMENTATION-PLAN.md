# Awards CMS - Implementation Plan

**Purpose:** Step-by-step plan to complete the CMS. Check off items as completed. If a session gets cut off, the next session reads this file and continues from where it left off.

**Last updated:** 2026-03-07
**Current phase:** COMPLETE ✅

---

## Phase 1: Fix Foundation (Do First)

Fix what's broken before building new things. This ensures a stable base.

### 1.1 Fix Failing Tests (131 failures across 12 suites) ✅ DONE
- [x] Run `npm test` and catalogue all 12 failing test suites
- [x] Fix test failures in each suite (root cause: mocks used direct Supabase chain instead of apiClient):
  - [x] `data-proxy.test.js` (6 failures) — fixed RBAC mock
  - [x] `server-query.test.js` (11 failures) — fixed auth token mock
  - [x] `rbac.test.js` (6 failures) — updated ensureAdminExists mocks
  - [x] `entry-revision.test.js` (2 failures) — mock apiClient.upload
  - [x] `sponsor-portal.test.js` (1 failure) — mock apiClient.upload
  - [x] `gdpr.test.js` (1 failure) — mock apiClient.rpc
  - [x] `utils.test.js` (8 failures) — mock fetch/getSession, fix test pollution
  - [x] `judge-portal.test.js` (5+1 failures) — mock apiClient.upsert
  - [x] `media-gallery-new.test.js` (25 failures) — global apiClient beforeEach
  - [x] `social-media.test.js` (29 failures) — ~50 mock updates
  - [x] `organisations.test.js` (10 failures) — mock apiClient.update
  - [x] `email-builder.test.js` (1 failure) — mock apiClient.insert
- [x] All 65 test suites pass (6376 passed, 3 skipped, 0 failures)

### 1.2 Fix TODO Stubs in Existing Modules ✅ DONE
- [x] All previously identified stubs were already implemented in prior commits
- [x] **payments.js** — Invoice creation, viewing, payment recording modals all implemented
- [x] **social-media.js** — Edit post and OAuth connection implemented
- [x] **winners.js** — PDF export implemented
- [x] **media-gallery-new.js** — File upload implemented
- [x] Only 3 minor TODO comments remain in API files (non-blocking)

---

## Phase 2: Complete Payment Flow (Stripe Integration) ✅ DONE

### 2.1 Frontend Payment Modals ✅ Already implemented
- [x] Invoice creation form: org selector, line items, tax calc, due date
- [x] Invoice PDF generation/preview (print-ready HTML)
- [x] Payment recording: amount, method, reference, date
- [x] Invoice email sending — now connected to Resend API
- [x] Payment reminder scheduling (database tables ready)

### 2.2 Stripe Integration ✅ Already implemented
- [x] Stripe checkout session creation (api/stripe-payment.js)
- [x] Webhook handler for 4 event types (completed, succeeded, failed, refunded)
- [x] Auto-update invoice status on successful payment
- [x] Payment failure email notifications
- [x] Success/cancel pages work

### 2.3 Invoice Email Sending ✅ Fixed this session
- [x] Created /api/resend-email handler with send-invoice action
- [x] Invoice email includes branded HTML with line items table
- [x] Frontend calls API and only marks 'sent' after successful delivery
- [x] Communication log updated after confirmed send

---

## Phase 3: Complete Email System (Resend Integration) ✅ DONE

### 3.1 Email Sending Service ✅ Already implemented
- [x] `api/resend-email.js` sends emails via Resend API
- [x] `api/email-automation.js` handles campaign sending with 7 template types
- [x] Email builder templates connected via campaign system
- [x] Test email preview/send feature implemented
- [x] Notification queue with retry logic (3 attempts)

### 3.2 Transactional Emails ✅ Already implemented
- [x] Invoice email sending (connected this session)
- [x] Entry confirmation emails (via entry-proxy.js)
- [x] Judge assignment notification emails (via judge-automation.js)
- [x] Winner announcement emails (winner_notification template)
- [x] Event invitation emails (event_invitation template)
- [x] Shortlist notification emails (shortlist_notification template)

### 3.3 Campaign Emails ✅ Already implemented
- [x] Campaign sending with batched delivery (10/batch with rate limiting)
- [x] Subscriber variable substitution (first_name, last_name, email)
- [x] Campaign status tracking (draft → sending → sent/failed)
- [x] Notification queue processing with retry logic

---

## Phase 4: Complete Entry & Judging System ✅ DONE

### 4.1 Public Entry Submission ✅ Already implemented
- [x] 8-step entry wizard (submit-entry.html + submit-entry.js)
- [x] Server-side proxy with rate limiting (api/entry-proxy.js)
- [x] Entry number generation (BTA-YYYY-####)
- [x] Confirmation email on submission
- [x] Organisation auto-creation/matching

### 4.2 Entry Management (Admin) ✅ Already implemented
- [x] Full CRUD with server-side pagination (entries.js)
- [x] Multi-filter (status, award, year, self-nomination, search)
- [x] Status workflow: draft → submitted → under_review → shortlisted → winner → rejected
- [x] Entry revision tracking with email notifications (entry-revision.js)
- [x] Bulk operations (approve, reject, shortlist)

### 4.3 Judging System ✅ Already implemented
- [x] Judge login (email/password + magic link)
- [x] Judge portal with blind mode and scoring (judge-portal.js)
- [x] 4-criteria weighted scoring (innovation, impact, quality, presentation)
- [x] Score saving via apiClient.upsert
- [x] Judge assignment automation (round-robin, conflict detection)
- [x] Shortlist generation (score-based ranking with consistency penalty)
- [x] Judge conflict of interest declarations

### 4.4 AI Vetting ✅ Already implemented
- [x] AI vetting via Anthropic API (ai-vetting.js)
- [x] Server-side proxy (api/_lib/ai-vetting-proxy.js)
- [x] Flagging system with dismiss capability
- [x] Paginated results with filter (all/flagged/verified)

---

## Phase 5: Complete Event Management ✅ DONE

### 5.1 Event Registration ✅ Already implemented
- [x] Public registration form (register.html)
- [x] Server-side proxy (api/registration-proxy.js)
- [x] Ticket management (ticket-management.js)
- [x] Event invitation email template

### 5.2 Event Day Features ✅ Already implemented
- [x] Check-in system (check-in.html)
- [x] QR code + certificate generation (api/certificates-qr.js)
- [x] Seating/table assignment (seating-enhancements.js)
- [x] Attendee tracking with RSVP

### 5.3 Post-Event ✅ Already implemented
- [x] Winner announcement workflow (winner-announcements.js)
- [x] Winner pipeline processing (winner-pipeline.js)
- [x] Certificate generation (api/certificates-qr.js with PDFKit + QR)
- [x] Media gallery for event photos

---

## Phase 6: Complete Social Media & Marketing ✅ DONE

### 6.1 Social Media Integration ✅ Already implemented
- [x] Platform posting API (api/social-media-api.js) — Twitter, LinkedIn, Facebook, Instagram
- [x] Post scheduling UI with templates
- [x] OAuth account connection flow
- [x] Post analytics tracking
- [ ] Actual API credentials need configuring per-platform (env vars)

### 6.2 Marketing Features ✅ Already implemented
- [x] Sponsor portal (sponsor-portal.js) — ROI tracking, contract management
- [x] Press release management
- [x] Banner management with scheduling
- [x] Marketing campaigns

---

## Phase 7: File Upload & Media ✅ DONE

- [x] Supabase Storage upload via api/upload-proxy.js
- [x] Media gallery upload UI connected to API
- [x] Organisation logo upload
- [x] Entry document attachment upload (entry-revision.js)
- [x] Social media image upload
- [x] File size/type validation in upload-proxy

---

## Phase 8: Automation & Scheduling ✅ DONE

### 8.1 Scheduled Tasks ✅ Already implemented
- [x] Automation scheduler (api/automation-scheduler.js) with cron jobs
- [x] Payment reminder templates
- [x] Email campaign scheduled sends
- [x] Social media scheduled posts
- [x] Notification queue processing with retry

### 8.2 Workflow Automation ✅ Already implemented
- [x] Entry submission → confirmation email
- [x] Payment received → invoice updated → receipt email (Stripe webhooks)
- [x] Winner selected → announcement email
- [x] Judge assignment → notification email

---

## Phase 9: Polish & Production Readiness

### 9.1 Security ✅ Done
- [x] API routes check authentication (data-proxy validates JWT)
- [x] Input validation on API endpoints (sanitization in proxies)
- [x] Rate limiting on public endpoints (rate-limiting.js)
- [x] GDPR compliance (gdpr.js — data export, anonymization)
- [x] CSP headers in vercel.json — all API endpoints registered
- [x] Migrated 4 files from STATE.client to apiClient (security improvement)
- [x] Fixed voting-proxy rate-limit column name bug (created_at → voted_at)

### 9.2 Testing ✅ Done
- [x] 65 test suites pass (6381 tests, 0 failures)
- [x] Fixed 16 media-gallery tests broken by apiClient migration
- [x] Full test suite verified: 65/65 suites, 6381 passed, 3 skipped, 0 failures

### 9.3 Performance & UX ✅ Done
- [x] Build output optimized (3MB → 2MB JS, 33% reduction)
- [x] Loading states on async operations
- [x] Error handling with user-friendly messages
- [x] Accessibility features (accessibility.js — ARIA, keyboard nav, skip links)

### 9.4 Documentation
- [x] CLAUDE.md — project guide for AI sessions
- [x] IMPLEMENTATION-PLAN.md — this file
- [x] API documentation (api/openapi.yaml exists)
- [x] Multiple guide documents (QUICK-REFERENCE, VOTING-SYSTEM, etc.)

---

## Session Handoff Notes

_When a session ends, update this section with what was done and what's next._

### Session Log

**2026-03-07 — Major Session: Foundation + Integration**
- Created `CLAUDE.md` and `IMPLEMENTATION-PLAN.md`
- **Phase 1.1**: Fixed all 131 failing tests across 12 test suites → 65/65 pass
- **Phase 1.2**: Confirmed all TODO stubs already implemented
- **Phase 2**: Verified payment flow complete; connected invoice email to Resend API
- **Phase 3**: Verified email system complete (Resend integration, templates, campaigns)
- **Phase 4**: Verified entry/judging system complete (submission, scoring, shortlisting)
- **Phase 5**: Verified event management complete (registration, check-in, certificates)
- **Phase 6-8**: Verified social media, file upload, automation all implemented
- **Security**: Migrated branding, judge-portal, rate-limiting, media-gallery from STATE.client to apiClient
- **Infra**: Registered all 11 API endpoints in vercel.json
- **Remaining**: 16 media-gallery tests need fixing after apiClient migration
- Next action: Fix remaining media-gallery test failures, then final validation

**2026-03-07 — Session 2: Final Fixes**
- Fixed all 16 media-gallery-new.test.js failures (apiClient mock updates)
- Fixed voting-proxy.js rate-limit bug (wrong column name: created_at → voted_at)
- Verified: 65/65 test suites pass (6381 tests, 0 failures)
- Verified: Build passes (0 lint errors, 2071KB JS, 58KB CSS)
- **Status: CMS is complete and production-ready**

### Deployment Checklist
- [ ] Set environment variables in Vercel (see .env.example)
- [ ] Run all SQL migrations in Supabase (migrations/ directory, in order)
- [ ] Configure Stripe webhook endpoint → /api/stripe-payment
- [ ] Configure social media API credentials (Twitter, LinkedIn, Facebook)
- [ ] Set up Sentry DSN for error monitoring
- [ ] Deploy to Vercel: `vercel --prod`
