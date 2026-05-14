# Awards CMS - Claude Development Guide

**Read this file first.** It provides the project context, current state, and step-by-step implementation plan. If a session gets cut off, the next Claude session should read this file and the `IMPLEMENTATION-PLAN.md` to pick up where things left off.

## ACTIVE WORK: UX/UI Audit

> **CLAUDE: There is an active UX/UI improvement backlog at `UX-AUDIT-TODO.md`. Read it at the start of every session and work through items in order (Critical → High → Medium → Low). Mark each item `[x]` in the same commit as the implementation. Never start a new session without checking this file first.**

## ACTIVE WORK: Technical Improvements

> **CLAUDE: There is a technical improvement plan at `TECHNICAL-DEBT-TODO.md`. This covers three phases: (1) breaking the monolithic `index.html` into composable HTML partials, (2) implementing genuinely missing features (Post-Event tab, Ticket Issuance, Milestones, Special Requirements, Social Media audit, Auto-Segments), and (3) adding JSDoc type annotations for code quality. When the user asks to work on architecture, missing features, or code quality — read this file and pick up from the first unchecked `[ ]` item.**

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

## IMPORTANT: Vercel Hobby Plan Limit

> **CLAUDE: DO NOT add more API files to `/api/`.** Vercel Hobby plan allows a maximum of **12 serverless functions**. We are currently at exactly **12/12**. If you need to add a new API endpoint, either:
> 1. Add it as a new `action` inside an existing handler (e.g., `data-proxy.js` or another relevant file)
> 2. Place utility/internal modules in `api/_lib/` (Vercel ignores this directory)
> 3. Merge two related endpoints into one file
>
> **Never** create a new `.js` file directly in `/api/` without removing or consolidating another first.
>
> `automation-scheduler.js` was moved to `api/_lib/` to stay within the limit.

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
│   ├── ai-vetting.js          AI company vetting via Claude API
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

**Status: COMPLETE — Production-ready.**
Build passes (0 lint errors, 2072KB JS, 58KB CSS). 65/65 test suites pass (6381 tests, 0 failures).

### What's Complete (100%)
- Core CRUD: Awards, Organisations, Winners, Assignments, Events, Media
- CRM: Communications, deals, meetings, segments
- Email: Builder (drag-drop), lists, templates, campaigns, sending via Resend API
- Marketing: Banners, sponsors, press releases
- Dashboard with KPIs
- Authentication + RBAC
- Activity logging / audit trail
- Data proxy API (frontend ↔ Supabase) — all data operations routed through secure proxy
- Multi-tenancy support
- 35+ database tables with proper relationships
- Payments: Invoice creation/viewing/recording, Stripe checkout, webhooks, payment emails
- Social media: Scheduling, posting API (Twitter, LinkedIn, Facebook, Instagram), OAuth flow
- File uploads: Supabase Storage via upload-proxy, media gallery, org logos, entry attachments
- Entry system: 8-step wizard, server-side proxy, entry number generation, revision tracking
- Judge portal: Login, blind scoring, assignment automation, shortlist generation, AI vetting
- Public voting: Nominee pages, vote submission, rate limiting, verification
- Event management: Registration, check-in, QR codes, certificates, seating, attendee tracking
- Automation: Scheduled tasks, notification queue, workflow triggers
- Security: All frontend data operations use apiClient (server-side proxy), CSP headers, rate limiting, GDPR compliance

### Deployment Prerequisites
- Set environment variables in Vercel (see .env.example)
- Run SQL migrations in Supabase
- Configure Stripe webhook endpoint → /api/stripe-payment
- Configure social media API credentials per platform (env vars)

### Vercel Environment Variables (as of March 2026)

> **CLAUDE REMINDER:** Always refer to this section when API keys or credentials come up. Do not ask the user to re-check Vercel — use this list.

#### Configured (All Environments)

| Variable | Service | Status |
|---|---|---|
| `FROM_NAME` | Email sender display name | Set |
| `FROM_EMAIL` | Email sender address | Set |
| `APP_URL` | Application URL | Set |
| `RESEND_API_KEY` | Resend (email sending) | Set |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhooks | Set |
| `STRIPE_PRICE_ID` | Stripe product price | Set |
| `STRIPE_SECRET_KEY` | Stripe server-side | Set |
| `STRIPE_PUBLISHABLE_KEY` | Stripe client-side | Set |
| `SUPABASE_URL` | Supabase project URL | Set |
| `SUPABASE_ANON_KEY` | Supabase public key | Set |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Set |

#### Not Yet Configured (only needed when ready for these features)

| Variable | Service | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | AI vetting (Claude API) | console.anthropic.com → API Keys |
| `TWITTER_BEARER_TOKEN` | Social media posting | developer.x.com → Projects & Apps → Keys and Tokens |
| `LINKEDIN_ACCESS_TOKEN` | Social media posting | linkedin.com/developers → Auth tab → OAuth 2.0 token (`w_organization_social` scope) |
| `LINKEDIN_ORG_ID` | Social media posting | LinkedIn company page URL numeric ID |
| `FACEBOOK_PAGE_TOKEN` | Social media posting | developers.facebook.com → Graph API Explorer → Page Access Token (`pages_manage_posts`) |
| `FACEBOOK_PAGE_ID` | Social media posting | Facebook Page → About → Page ID |
| `INSTAGRAM_ACCOUNT_ID` | Social media posting | Graph API: `GET /{page-id}?fields=instagram_business_account` |

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
