# Awards CMS - Claude Development Guide

**Read this file first.** It provides the project context, current state, and step-by-step implementation plan. If a session gets cut off, the next Claude session should read this file and the `IMPLEMENTATION-PLAN.md` to pick up where things left off.

## Project Overview

British Trade Awards CMS - a web-based admin system for managing awards ceremonies, organisations, entries, judging, events, payments, email marketing, and CRM.

**Tech Stack:**
- Frontend: Vanilla JavaScript + Bootstrap 5 (single-page app)
- Backend: Supabase (PostgreSQL) + Vercel serverless functions (`/api/` directory)
- Email: Resend API
- Payments: Stripe
- AI Vetting: Anthropic Claude API
- Build: esbuild (run `node build.js`)
- Tests: Jest (`npm test`)
- Deployment: Vercel

## Key Files & Structure

```
/                        Root (frontend)
├── CLAUDE.md            THIS FILE - read first
├── IMPLEMENTATION-PLAN.md  Step-by-step completion plan with checkboxes
├── index.html           Main SPA (539KB - all admin UI)
├── app.js               App initialization, routing, module loading
├── config.js            Supabase config (env vars injected at build)
├── auth.js              Authentication (Supabase auth)
├── rbac.js              Role-based access control
├── styles.css           Main stylesheet
├── build.js             esbuild bundler → dist/
├── vercel.json          Deployment config + CSP headers
├── .env                 Environment variables (never commit)
│
├── api/                 Vercel serverless functions (Node.js backend)
│   ├── data-proxy.js    Database proxy (frontend → Supabase)
│   ├── stripe-payment.js    Stripe payment processing
│   ├── email-automation.js  Email sending via Resend
│   ├── entry-proxy.js       Public entry submission handler
│   ├── voting-proxy.js      Public voting handler
│   ├── upload-proxy.js      File upload handler
│   ├── registration-proxy.js  Event registration
│   ├── judge-automation.js    Judge assignment automation
│   ├── certificates-qr.js    Certificate & QR code generation
│   ├── social-media-api.js    Social media posting
│   ├── automation-scheduler.js  Scheduled tasks
│   ├── resend-email.js        Email sending utility
│   └── _lib/                  Shared utilities
│
├── tests/               Jest test files (65 suites, ~6400 tests)
│
├── *.js                 Frontend modules (one per feature area):
│   dashboard.js, awards.js, organisations.js, winners.js,
│   assignments.js, events.js, media-gallery-new.js, crm.js,
│   payments.js, email-builder.js, email-lists.js, email-templates.js,
│   marketing.js, social-media.js, entries.js, settings.js,
│   judge-portal.js, public-voting.js, submit-entry.js,
│   notifications.js, reporting.js, calendar.js, gdpr.js,
│   sponsor-portal.js, winner-pipeline.js, winner-announcements.js,
│   ticket-management.js, seating-enhancements.js, etc.
│
├── *.html               Public-facing pages:
│   submit-entry.html, vote.html, register.html,
│   judge-login.html, judge-portal.html, public-voting.html,
│   payment-success.html, payment-cancelled.html, etc.
│
└── database-*.sql       Database schema/migration files
```

## Current State (as of March 2026)

**Working:** Build passes. 53/65 test suites pass (6245/6379 tests pass).
**12 failing test suites** with 131 failing tests need fixing.

### What's Complete (~70%)
- Core CRUD: Awards, Organisations, Winners, Assignments, Events, Media
- CRM: Communications, deals, meetings, segments
- Email: Builder (drag-drop), lists, templates, campaigns
- Marketing: Banners, sponsors, press releases
- Dashboard with KPIs
- Authentication + RBAC
- Activity logging / audit trail
- Data proxy API (frontend ↔ Supabase)
- Multi-tenancy support
- 35+ database tables with proper relationships

### What's Partially Done (~20%)
- Payments module (list/reports exist, creation modals are TODOs)
- Social media (scheduling UI done, actual posting is TODO)
- File uploads (commented out, uses placeholder)
- Entry system (HTML pages exist, backend proxies exist, integration incomplete)
- Judge portal (HTML exists, automation backend exists, frontend integration incomplete)

### What's Missing (~10%)
- Stripe payment flow end-to-end testing
- Email sending service integration testing
- Social media OAuth + posting
- Certificate generation end-to-end
- Automated workflow scheduling
- Public voting end-to-end flow
- Fix 131 failing tests

## Commands

```bash
npm test                    # Run all tests
npm run lint                # ESLint check
npm run lint:fix            # Auto-fix lint issues
npm run build               # Build to dist/
npm run validate            # Full validation (lint + format + typecheck + test + build)
npm run format              # Prettier format
```

## Development Rules

1. **Always run tests** after making changes: `npm test`
2. **Always run build** to verify: `npm run build`
3. **Check IMPLEMENTATION-PLAN.md** for current progress and next steps
4. **Update IMPLEMENTATION-PLAN.md** checkboxes as tasks are completed
5. Frontend modules export functions that `app.js` calls — follow existing patterns
6. API functions are Vercel serverless — export default `(req, res)` handler
7. All database access from frontend goes through `/api/data-proxy.js`
8. Keep CSP headers in `vercel.json` updated when adding new external resources
9. Supabase client is initialized in `config.js` — never hardcode credentials
10. Follow existing code style (no TypeScript, vanilla JS, Bootstrap 5)
