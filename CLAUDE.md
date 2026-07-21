# Awards CMS - Claude Development Guide

**Read this file first.** It provides the project context, current state, and step-by-step implementation plan. If a session gets cut off, the next Claude session should read this file and the `IMPLEMENTATION-PLAN.md` to pick up where things left off.

## Design System Rules

> **CLAUDE: Read these rules before touching any HTML page.**

### Master Brand Template
**`home.html` is the master brand template.** All public-facing HTML pages must align with its design system:
- Background: `#0a0a0a` (body), `#111111` (cards), `#1a1a1a` (raised surfaces)
- Gold: `#C9A227` (primary accent), `#e0b93a` (hover)
- Fonts: `Playfair Display` (headings/display), `Inter` (body text)
- Header: sticky, `rgba(10,10,10,0.92)` + `backdrop-filter:blur(12px)`, BTA logo, "Back to Home" link
- Footer: `#050505` bg, `border-top:1px solid #1a1a1a`, nav links, copyright
- When making UI changes to any public page, use `home.html` as the reference.

### Pages Excluded from Design Updates
The following pages serve a **legal purpose** and must **not** be restyled, restructured, or have their HTML modified as part of any design or branding update:

- **`privacy-policy.html`** — Legal document. Content and structure must remain as-is.
- **`terms-and-conditions.html`** — Legal document. Content and structure must remain as-is.

These pages intentionally use a plain/light design to ensure readability and legal clarity. Future design sweeps, brand refreshes, and UI improvements **must exclude these two files**.

---

## ACTIVE WORK: Full System Audit

> **CLAUDE: There is a master system audit at `CMS-AUDIT-TODO.md` covering 118 checks across 12 categories (automated tests, database schema, auth, multi-user, end-to-end flows, API health, frontend tabs, forms, security, integrations, performance, error recovery). Read it at the start of every session and work through items in order. Mark each item `[x]` in the same commit as the verification or fix. If an item reveals a bug, fix it before marking it done. Resume from the first unchecked `[ ]` item.**

## ACTIVE WORK: UX/UI Audit

> **CLAUDE: There is an active UX/UI improvement backlog at `UX-AUDIT-TODO.md`. Read it at the start of every session and work through items in order (Critical → High → Medium → Low). Mark each item `[x]` in the same commit as the implementation. Never start a new session without checking this file first.**

## ACTIVE WORK: Technical Improvements

> **CLAUDE: There is a technical improvement plan at `TECHNICAL-DEBT-TODO.md`. This covers three phases: (1) breaking the monolithic `index.html` into composable HTML partials, (2) implementing genuinely missing features (Post-Event tab, Ticket Issuance, Milestones, Special Requirements, Social Media audit, Auto-Segments), and (3) adding JSDoc type annotations for code quality. When the user asks to work on architecture, missing features, or code quality — read this file and pick up from the first unchecked `[ ]` item.**

## ACTIVE WORK: Professional Awards Company Audit

> **CLAUDE: A comprehensive 5-agent audit was run on 2026-05-22. All 20 items are COMPLETE — see `PROFESSIONAL-AUDIT-TODO.md` for the full record.**

## ACTIVE WORK: Deep System Audit (HIGHEST PRIORITY)

> **CLAUDE: A 4-agent deep audit (Security, UX/Workflows, Code Quality, Feature Completeness) was run on 2026-05-29. All findings are tracked at `DEEP-AUDIT-TODO.md` with 4 Critical, 10 High, 10 Medium, and 10 Low items. Read this file and work through items in order (DA-C1 → DA-C2 → … → DA-L10). Mark each `[x]` when committed and pushed. This is the HIGHEST PRIORITY active work.**

## ACTIVE WORK: Database Schema Audit

> **CLAUDE: A database schema audit was run on 2026-05-30 covering all 48 SQL migration files. Findings are tracked at `DB-SCHEMA-AUDIT-TODO.md` with 3 Critical, 3 High, 3 Medium, and 1 Low item. The most urgent finding is missing RLS policies on 8 tables (DB-C3) — without RLS, authenticated Supabase users can read all data directly. Work through items DB-C1 → DB-C3 → DB-H1 → … → DB-L1. Mark each `[x]` when committed and pushed.**

## ACTIVE WORK: Vercel / Build / CSP Configuration Audit

> **CLAUDE: A deployment config audit was run on 2026-05-30. Findings are tracked at `VERCEL-CONFIG-AUDIT-TODO.md` with 2 Critical, 3 High, 2 Medium, and 1 Low item. Most urgent: VC-C1 (no SPA catch-all rewrite — deep links 404) and VC-C2 (undocumented env vars). Also: VC-M1 (`public-winners.html` missing from build copy list — breaks production page). Work through VC-C1 → VC-C2 → VC-H1 → … → VC-L1.**

## ACTIVE WORK: Email Templates Audit

> **CLAUDE: An email templates audit was run on 2026-05-30. Findings are tracked at `EMAIL-AUDIT-TODO.md` with 1 Critical, 2 High, 2 Medium, and 2 Low items. Most urgent: EA-C1 — database-template substitution path does NOT escape user data before injecting into email HTML (XSS risk). Work through EA-C1 → EA-H1 → … → EA-L1.**

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
Build passes (0 lint errors, ~1334KB JS chunks + core, 65KB CSS). 65/65 test suites pass (6398 tests, 0 failures).

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
| `ALLOWED_ORIGINS` | CORS origin allowlist for data-proxy (`data-proxy.js`) | Set (comma-separated URLs) |
| `CONTACT_EMAIL` | Fallback contact email in payment receipts (`stripe-payment.js`); falls back to `FROM_EMAIL` if unset | Set |

#### Required — verify these are set in Vercel before launch

> **CLAUDE: These two were found missing from this document during a 2026-07 release-candidate audit — their presence in Vercel was never actually confirmed. Verify both are set before relying on the features below; do not assume "Set" just because they're listed here.**

| Variable | Service | Why it's required |
|---|---|---|
| `CRON_SECRET` | Authenticates Vercel Cron's daily call to `/api/judge-automation?action=cron-tick` (judge assignment automation, `vercel.json`'s only scheduled cron) | `judge-automation.js` explicitly refuses to run (500) if this is unset — the daily automation silently does nothing every day until it's set. |
| `RESEND_WEBHOOK_SECRET` | Verifies the `x-resend-signature` header on Resend's bounce/complaint webhook (`email-automation.js`, actions `resend-bounce`/`resend-complaint`) | As of this audit, the endpoint refuses the request (500) if unset, rather than skipping verification — previously it skipped verification silently, letting anyone suppress any email address. Must be set to the same value configured in the Resend dashboard's webhook settings for this endpoint to work at all. |

#### Not Yet Configured (only needed when ready for these features)

| Variable | Service | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | AI vetting (Claude API) | console.anthropic.com → API Keys |
| `TWITTER_API_KEY` | Twitter/X posting (OAuth 1.0a consumer key) | developer.x.com → Projects & Apps → Keys and Tokens → API Key |
| `TWITTER_API_SECRET` | Twitter/X posting (OAuth 1.0a consumer secret) | developer.x.com → Projects & Apps → Keys and Tokens → API Key Secret |
| `TWITTER_ACCESS_TOKEN` | Twitter/X posting (OAuth 1.0a user access token) | developer.x.com → Projects & Apps → Keys and Tokens → Access Token |
| `TWITTER_ACCESS_TOKEN_SECRET` | Twitter/X posting (OAuth 1.0a user access token secret) | developer.x.com → Projects & Apps → Keys and Tokens → Access Token Secret |
| `LINKEDIN_ACCESS_TOKEN` | LinkedIn posting | linkedin.com/developers → Auth tab → OAuth 2.0 token (`w_organization_social` scope) |
| `LINKEDIN_ORG_ID` | LinkedIn posting | LinkedIn company page URL numeric ID |
| `FACEBOOK_PAGE_TOKEN` | Facebook & Instagram posting | developers.facebook.com → Graph API Explorer → Page Access Token (`pages_manage_posts`) |
| `FACEBOOK_PAGE_ID` | Facebook posting | Facebook Page → About → Page ID |
| `INSTAGRAM_ACCOUNT_ID` | Instagram posting | Graph API: `GET /{page-id}?fields=instagram_business_account` |

#### Optional (have safe fallbacks — not needed to launch)

| Variable | Service | Fallback if unset |
|---|---|---|
| `BTA_LOGO_URL` | Logo shown in Stripe Checkout and email headers (`stripe-payment.js`, `_lib/email-header.js`) | Falls back to `${APP_URL}/assets/british-trade-awards-logo.png`, or an empty string in email headers |
| `SENTRY_DSN` | Error tracking | Sentry stays disabled; `build.js` logs this plainly at build time |
| `DEV_EMAIL` | Redirects all outbound email to one inbox in non-production environments | Only read when `NODE_ENV !== 'production'` — irrelevant in production |

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
