# Awards CMS - Implementation Plan

**Purpose:** Step-by-step plan to complete the CMS. Check off items as completed. If a session gets cut off, the next session reads this file and continues from where it left off.

**Last updated:** 2026-03-07
**Current phase:** Phase 1 - Fix Foundation

---

## Phase 1: Fix Foundation (Do First)

Fix what's broken before building new things. This ensures a stable base.

### 1.1 Fix Failing Tests (131 failures across 12 suites)
- [ ] Run `npm test` and catalogue all 12 failing test suites
- [ ] Fix test failures in each suite (likely caused by recent refactors):
  - [ ] `organisations.test.js`
  - [ ] `email-builder.test.js`
  - [ ] Identify and fix remaining 10 failing suites
- [ ] Ensure all 65 test suites pass (6379/6379 tests)
- [ ] Run `npm run validate` — all checks must pass

### 1.2 Fix TODO Stubs in Existing Modules
- [ ] **payments.js** — Implement invoice creation modal (line ~150)
- [ ] **payments.js** — Implement invoice viewing modal (line ~158)
- [ ] **payments.js** — Implement payment recording modal (line ~303)
- [ ] **payments.js** — Implement payment viewing modal (line ~311)
- [ ] **social-media.js** — Implement edit post form loading (line ~532)
- [ ] **social-media.js** — Implement OAuth connection modal UI (line ~606)
- [ ] **winners.js** — Implement PDF export (line ~658)
- [ ] **media-gallery-new.js** — Implement file upload to Supabase storage (line ~533)

---

## Phase 2: Complete Payment Flow (Stripe Integration)

### 2.1 Frontend Payment Modals
- [ ] Invoice creation form: org selector, line items, tax calc, due date
- [ ] Invoice PDF generation/preview
- [ ] Payment recording: amount, method, reference, date
- [ ] Invoice email sending (trigger API)
- [ ] Payment reminder scheduling

### 2.2 Stripe Integration (api/stripe-payment.js)
- [ ] Verify Stripe checkout session creation works
- [ ] Implement webhook handler for payment confirmations
- [ ] Auto-update invoice status on successful payment
- [ ] Handle payment failures and retries
- [ ] Test with Stripe test keys end-to-end

### 2.3 Payment Pages
- [ ] Verify `payment-success.html` flow works
- [ ] Verify `payment-cancelled.html` flow works
- [ ] Add payment receipt display

---

## Phase 3: Complete Email System (Resend Integration)

### 3.1 Email Sending Service
- [ ] Verify `api/resend-email.js` sends emails correctly
- [ ] Verify `api/email-automation.js` handles campaign sending
- [ ] Connect email builder templates to sending API
- [ ] Implement email preview/test send feature
- [ ] Add bounce/complaint webhook handling

### 3.2 Transactional Emails
- [ ] Invoice email sending (connects to Phase 2)
- [ ] Entry confirmation emails
- [ ] Judge assignment notification emails
- [ ] Winner announcement emails
- [ ] Event registration confirmation emails
- [ ] Password reset / auth emails (if not handled by Supabase)

### 3.3 Campaign Emails
- [ ] Connect email campaign scheduling to actual sends
- [ ] Track delivery, opens, clicks via Resend webhooks
- [ ] Update `email_logs` table with engagement data
- [ ] Unsubscribe handling end-to-end

---

## Phase 4: Complete Entry & Judging System

### 4.1 Public Entry Submission
- [ ] Verify `submit-entry.html` form works end-to-end
- [ ] Verify `api/entry-proxy.js` saves entries to database
- [ ] File/document attachment for entries (via upload-proxy)
- [ ] Entry confirmation email on submission
- [ ] Entry deadline enforcement
- [ ] Connect `entries.js` admin module to view/manage entries

### 4.2 Entry Management (Admin)
- [ ] Entry list view with filters (status, award, date)
- [ ] Entry detail view with all submitted data
- [ ] Entry status workflow: submitted → under review → shortlisted → winner
- [ ] Entry revision tracking (`entry-revision.js`)
- [ ] Bulk entry operations (approve, reject, shortlist)

### 4.3 Judging System
- [ ] Verify `judge-login.html` and `judge-portal.html` work
- [ ] Connect `judge-portal.js` to real data
- [ ] Judge assignment: assign judges to entries/awards
- [ ] Scoring interface: criteria-based scoring form
- [ ] Score aggregation and ranking
- [ ] Judge conflict of interest declarations
- [ ] Verify `api/judge-automation.js` assigns judges correctly

### 4.4 AI Vetting
- [ ] Verify `ai-vetting.js` integration with Anthropic API
- [ ] Verify `api/_lib/ai-vetting-proxy.js` works
- [ ] Entry quality/eligibility checks
- [ ] Flagging system for manual review

---

## Phase 5: Complete Event Management

### 5.1 Event Registration
- [ ] Verify `register.html` public registration form
- [ ] Verify `api/registration-proxy.js` handles registrations
- [ ] Ticket purchase via Stripe (connects to Phase 2)
- [ ] Confirmation email on registration
- [ ] `ticket-management.js` — verify ticket allocation works

### 5.2 Event Day Features
- [ ] `check-in.html` — QR code check-in system
- [ ] Verify `api/certificates-qr.js` generates QR codes
- [ ] `seating-enhancements.js` — table/seating assignment
- [ ] Live attendee tracking

### 5.3 Post-Event
- [ ] Winner announcement workflow (`winner-announcements.js`)
- [ ] Winner pipeline processing (`winner-pipeline.js`)
- [ ] Certificate generation via `api/certificates-qr.js`
- [ ] Media gallery from event photos
- [ ] Post-event email campaign trigger

---

## Phase 6: Complete Social Media & Marketing

### 6.1 Social Media Integration
- [ ] `api/social-media-api.js` — posting to Twitter/X
- [ ] Posting to LinkedIn
- [ ] Posting to Facebook/Instagram
- [ ] OAuth account connection flow
- [ ] Schedule-based auto-posting
- [ ] Post analytics tracking

### 6.2 Marketing Features
- [ ] Sponsor portal (`sponsor-portal.js`) — sponsor self-service
- [ ] Press release publishing
- [ ] Banner management with scheduling
- [ ] Marketing campaign analytics

---

## Phase 7: File Upload & Media

- [ ] Implement Supabase Storage upload in `api/upload-proxy.js`
- [ ] Connect `media-gallery-new.js` upload UI to API
- [ ] Organisation logo upload
- [ ] Entry document attachment upload
- [ ] Event photo upload
- [ ] Social media image upload
- [ ] File size/type validation
- [ ] Image optimization/thumbnails

---

## Phase 8: Automation & Scheduling

### 8.1 Scheduled Tasks
- [ ] Verify `api/automation-scheduler.js` cron jobs work
- [ ] Payment reminder auto-sending
- [ ] Email campaign scheduled sends
- [ ] Social media scheduled posts
- [ ] Entry deadline notifications
- [ ] Follow-up reminders (CRM)

### 8.2 Workflow Automation
- [ ] Entry submission → confirmation email → admin notification
- [ ] Payment received → invoice updated → receipt email
- [ ] Winner selected → announcement email → certificate generated
- [ ] Event registration → confirmation → ticket generated

---

## Phase 9: Polish & Production Readiness

### 9.1 Security
- [ ] Verify all API routes check authentication
- [ ] Input validation on all API endpoints
- [ ] Rate limiting on public endpoints (`rate-limiting.js`)
- [ ] GDPR compliance features (`gdpr.js`) — data export, deletion
- [ ] Verify CSP headers cover all resources

### 9.2 Testing
- [ ] All 65+ test suites pass
- [ ] Add integration tests for critical flows (entry → judge → winner)
- [ ] Add API endpoint tests
- [ ] Test with Stripe test mode
- [ ] Test email sending with Resend test mode

### 9.3 Performance & UX
- [ ] Build output optimized (currently 2MB JS → verify acceptable)
- [ ] Loading states on all async operations
- [ ] Error handling with user-friendly messages
- [ ] Mobile responsiveness check on all modules
- [ ] Accessibility audit (`accessibility.js`)

### 9.4 Documentation
- [ ] Update CLAUDE.md with final state
- [ ] API documentation (verify `api/openapi.yaml`)
- [ ] User guide for admin features
- [ ] Deployment guide

---

## Where to Start

**Start with Phase 1.1** — fixing the 131 failing tests. This gives us a green baseline so we can confidently make changes without breaking things.

Then proceed phase by phase in order. Each phase builds on the previous one:
- Phase 1 (foundation) → stable codebase
- Phases 2-3 (payments + email) → core business operations work
- Phase 4 (entries + judging) → the award lifecycle is complete
- Phase 5 (events) → ceremony management works
- Phases 6-7 (social + media) → marketing & content
- Phase 8 (automation) → everything runs smoothly
- Phase 9 (polish) → production ready

---

## Session Handoff Notes

_When a session ends, update this section with what was done and what's next._

### Session Log

**2026-03-07 — Initial Planning Session**
- Created `CLAUDE.md` (project guide for Claude)
- Created `IMPLEMENTATION-PLAN.md` (this file)
- Current state: Build passes, 12/65 test suites failing (131 tests)
- Next action: Start Phase 1.1 — fix failing tests
