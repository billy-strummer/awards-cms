# Pre-Production Fixes

**Purpose:** Checklist of all issues found during the March 2026 production readiness audit. Claude should read this file when asked to work through these fixes. Work through each item in order — security fixes first, then code fixes, then infrastructure.

**Status:** SECTIONS A & B COMPLETE (code fixes done), SECTION C pending (infrastructure — requires user action)
**Created:** 2026-03-08
**Last updated:** 2026-03-08

---

## A. Security Fixes (Code Changes — Claude Can Do These)

### A1. Add authentication to `api/certificates-qr.js`
- **Severity:** CRITICAL
- **Status:** [x] DONE
- **Problem:** No authentication or rate limiting on any endpoint. Anyone can generate certificates, QR codes, badges, or trigger check-ins if they know the endpoint URL.
- **Fix:** Add `verifyAuth()` function (same pattern as `data-proxy.js`) that validates the JWT from the `Authorization` header using `supabase.auth.getUser(token)`. Apply it to all actions in the handler.
- **File:** `api/certificates-qr.js`
- **Pattern to follow:** See `api/data-proxy.js` lines 553-580 for the `verifyAuth()` implementation.

### A2. Add authentication to `api/resend-email.js`
- **Severity:** CRITICAL
- **Status:** [x] DONE
- **Problem:** No authentication on any action. An attacker can send arbitrary emails using your Resend API key/quota, send campaign emails to entire subscriber lists, process the notification queue, or send invoice emails to arbitrary addresses.
- **Fix:** Add `verifyAuth()` function that validates JWT. Apply to all actions (`send`, `send-invoice`, `send-campaign`, `process-queue`).
- **File:** `api/resend-email.js`

### A3. Add authentication to `api/judge-automation.js`
- **Severity:** CRITICAL
- **Status:** [x] DONE
- **Problem:** No authentication on any endpoint. Anyone can trigger judge assignments (`assign-judges`), generate shortlists (`generate-shortlist`, `generate-all-shortlists`), or view stats. This could manipulate the judging process.
- **Fix:** Add `verifyAuth()` function that validates JWT. Apply to all actions.
- **File:** `api/judge-automation.js`

### A4. Add authentication to unprotected actions in `api/email-automation.js`
- **Severity:** CRITICAL
- **Status:** [x] DONE
- **Problem:** Only the `send-email` action checks JWT. The `send-deadline-reminders` and `send-winner-announcements` actions have NO auth — anyone can trigger mass emails to all judges and entrants by POSTing to the endpoint.
- **Fix:** Extend the existing auth check to cover ALL actions, not just `send-email`. Move the auth verification to the top of the handler before the action switch.
- **File:** `api/email-automation.js`
- **Lines:** Auth check is currently only inside the `send-email` case (~line 856). Move it before the switch statement.

### A5. Fix open redirect in `api/stripe-payment.js`
- **Severity:** CRITICAL
- **Status:** [x] DONE
- **Problem:** `success_url` and `cancel_url` use `req.headers.origin` (client-controlled). An attacker can set the Origin header to a malicious domain, causing Stripe to redirect the user there after payment. This is an open redirect vulnerability.
- **Fix:** Replace `req.headers.origin` with `process.env.APP_URL` (already defined in `.env` as `https://admin.britishtradeawards.com`). Fall back to a hardcoded safe default if env var is missing.
- **File:** `api/stripe-payment.js`
- **Lines:** ~96-97 where `success_url` and `cancel_url` are constructed.

### A6. Add authentication to payment status endpoints in `api/stripe-payment.js`
- **Severity:** HIGH
- **Status:** [x] DONE
- **Problem:** `getPaymentStatus` and `verifyPayment` actions have no authentication checks. Any unauthenticated user can query payment status for any entry by guessing an entry ID or Stripe session ID.
- **Fix:** Add the existing `verifyAuth()` call to the `getPaymentStatus` and `verifyPayment` action handlers. The `verifyAuth` function already exists in this file (line 29).
- **File:** `api/stripe-payment.js`

### A7. Sanitize error messages in `api/stripe-payment.js`
- **Severity:** HIGH
- **Status:** [x] DONE
- **Problem:** Raw `error.message` is returned to the client in 500 responses (lines ~117, ~517), exposing internal error details that could help an attacker understand the system.
- **Fix:** Replace `res.status(500).json({ error: error.message })` with a generic message like `res.status(500).json({ error: 'An internal error occurred' })`. Log the real error server-side with `console.error`.
- **File:** `api/stripe-payment.js`

---

## B. Code Fixes (Functional Issues — Claude Can Do These)

### B1. Wire up `notificationsModule.init()` after login
- **Severity:** MEDIUM
- **Status:** [x] DONE
- **Problem:** The `notifications.js` module has a fully implemented bell icon notification system with polling and realtime subscriptions, but `init()` is never called. The navbar bell icon won't appear after login. (The dashboard has its own separate inline notification panel that works independently.)
- **Fix:** Add `if (typeof notificationsModule !== 'undefined') notificationsModule.init();` to `authModule.showDashboard()` in `auth.js`, after the dashboard is shown (~line 341).
- **File:** `auth.js`
- **Test:** After fix, verify `notifications.test.js` still passes.

### B2. Add UI triggers for orphaned modules
- **Severity:** LOW
- **Status:** [x] DONE
- **Problem:** Four modules are code-complete and registered on `window` but have no buttons or `data-action` attributes in `index.html` to invoke them:
  1. **`sponsor-portal.js`** — Sponsor self-service dashboard, package management, ROI calculations. No `data-action` references it.
  2. **`winner-announcements.js`** — Social media pack, press release builder, batch announcements. No `data-action` references it.
  3. **`ticket-management.js`** — Ticket generation, QR codes, PDF tickets, Stripe refunds. No `data-action` references it from `events.js` or `index.html`.
  4. **`calendar.js`** — Monthly calendar grid, ICS export. Registered via ModuleRegistry but no trigger point in the UI.
- **Fix:** Add appropriate buttons/links in the relevant sections of `index.html`:
  - Sponsor portal: Add button in the Marketing > Sponsors sub-tab
  - Winner announcements: Add button in the Winners tab toolbar
  - Ticket management: Add button in the Events tab attendee section
  - Calendar: Add a calendar view toggle in the Events tab or Dashboard
- **Files:** `index.html`, potentially `app.js` for event wiring

---

## C. Infrastructure Setup (Requires User Action — Claude Cannot Do These)

### C1. Set real `SUPABASE_SERVICE_KEY`
- **Priority:** BLOCKER — nothing works without this
- **Status:** [x] DONE
- **Current state:** Set in Vercel environment variables (All Environments)
- **Action:** Go to Supabase Dashboard → Settings → API → copy the `service_role` secret key
- **Set in:** `.env` locally AND Vercel environment variables for production

### C2. Run database migrations
- **Priority:** BLOCKER — no tables exist yet
- **Status:** [x] DONE
- **Action:** Either run `node scripts/run-migrations.js` (requires service key from C1) or paste SQL files into Supabase Dashboard → SQL Editor in this order:
  1. `database-schema.sql` (core tables — must be first)
  2. `database-events-setup.sql`
  3. `database-crm-setup.sql`
  4. `database-payments-setup.sql`
  5. `database-marketing-setup.sql`
  6. `database-email-lists-setup.sql`
  7. `database-voting-system-setup.sql`
  8. `database-ai-vetting-setup.sql`
  9. `database-event-management-setup.sql`
  10. `database-event-galleries-setup.sql`
  11. `database-organisations-enhancements.sql`
  12. `database-organisation-images-setup.sql`
  13. `database-table-plan-setup.sql`
  14. `database-running-order-setup.sql`
  15. `database-year-rollover-system.sql`
  16. `database-previous-winner-automation.sql`
  17. `database-add-package-fields.sql`
  18. `database-add-published-field.sql`
  19. `database-setup-2025-2026-awards.sql` (seed data — run after tables exist)
  20. `database-social-media-posts-setup.sql`
- **Note:** The migration runner (`scripts/run-migrations.js`) handles dependency ordering automatically.

### C3. Set up Stripe (payments)
- **Priority:** HIGH — payments won't process without this
- **Status:** [x] DONE
- **Action:**
  1. Go to Stripe Dashboard → Developers → API keys
  2. Copy test keys: `sk_test_...` and `pk_test_...` (use test mode first)
  3. Go to Stripe Dashboard → Developers → Webhooks
  4. Add endpoint: `https://your-domain.com/api/stripe-payment`
  5. Select events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
  6. Copy the webhook signing secret (`whsec_...`)
  7. Set all four values in `.env` and Vercel env vars:
     - `STRIPE_SECRET_KEY`
     - `STRIPE_PUBLISHABLE_KEY`
     - `STRIPE_WEBHOOK_SECRET`
     - `STRIPE_PRICE_ID` (create a product in Stripe first, copy its price ID)

### C4. Set up Resend (email)
- **Priority:** HIGH — no emails will send without this
- **Status:** [x] DONE
- **Action:**
  1. Sign up at resend.com
  2. Verify your sending domain (add DNS records they provide)
  3. Create an API key in the dashboard
  4. Set `RESEND_API_KEY` in `.env` and Vercel env vars
  5. Set `FROM_EMAIL` to a verified email address on your domain

### C5. Set up Anthropic API key (AI vetting)
- **Priority:** MEDIUM — AI vetting won't work without this, but other features are unaffected
- **Status:** [ ] Not started
- **Action:**
  1. Go to console.anthropic.com → API Keys
  2. Create a new key
  3. Set `ANTHROPIC_API_KEY` in `.env` and Vercel env vars

### C6. Set up social media API credentials (optional)
- **Priority:** LOW — scheduling/drafting works without credentials, only actual posting requires them
- **Status:** [ ] Not started
- **Action:** See the "Missing Credentials" section in `CLAUDE.md` for per-platform instructions (Twitter, LinkedIn, Facebook, Instagram)

### C7. Deploy to Vercel
- **Priority:** Required for production
- **Status:** [ ] Not started
- **Action:**
  1. Set ALL environment variables in Vercel Dashboard → Settings → Environment Variables
  2. Deploy: `vercel --prod`
  3. Verify the domain and SSL certificate
  4. Test each tab in the deployed environment

### C8. Set up Sentry (error monitoring — optional)
- **Priority:** LOW — recommended but not required
- **Status:** [ ] Not started
- **Action:**
  1. Create a project at sentry.io
  2. Copy the DSN
  3. Set `SENTRY_DSN` in Vercel env vars

---

## D. Post-Deployment Testing Checklist

Once A, B, and C are complete, test each area:

- [ ] **Login** — Sign in with email/password
- [ ] **Dashboard** — KPIs load, activity feed populates
- [ ] **Awards** — Create, edit, delete an award category
- [ ] **Organisations** — Add an organisation, upload a logo
- [ ] **Entries** — Submit a test entry via the public form (`/submit-entry.html`)
- [ ] **Winners** — Select a winner, generate a certificate
- [ ] **Payments** — Create an invoice, test Stripe checkout (use `4242 4242 4242 4242`)
- [ ] **Email** — Send a test email via the email builder
- [ ] **Events** — Create an event, register an attendee, test check-in
- [ ] **CRM** — Add a contact, log a communication, create a deal
- [ ] **Media Gallery** — Upload an image
- [ ] **Marketing** — Create a banner, manage sponsors
- [ ] **Social Media** — Schedule a post (actual posting requires API credentials)
- [ ] **Judge Portal** — Log in as a judge, score an entry
- [ ] **Public Voting** — Cast a vote on `/public-voting.html`
- [ ] **Settings** — Verify GDPR panel loads
- [ ] **Notifications** — Verify bell icon appears in navbar
- [ ] **Reports** — Generate a report, test CSV/PDF export

---

## Session Notes

_When working through these fixes, update the status checkboxes above and add notes here._

### Fix Log

**2026-03-08 — Security & Code Fixes (Sections A + B)**
- **A1**: Added `verifyAuth()` + `supabaseAuth` to `certificates-qr.js`, auth check at handler level
- **A2**: Added `verifyAuth()` + `supabaseAuth` to `resend-email.js`, auth check at handler level
- **A3**: Added `verifyAuth()` + `supabaseAuth` to `judge-automation.js`, auth check at handler level
- **A4**: Moved auth check in `email-automation.js` from `sendEmailEndpoint` to handler level (covers all actions)
- **A5**: Replaced `req.headers.origin` with `APP_URL` in `stripe-payment.js` success/cancel URLs
- **A6**: Added `verifyAuth()` calls to `getPaymentStatus` and `verifyPayment` in `stripe-payment.js`
- **A7**: Replaced `error.message` with generic `'An internal error occurred'` in 3 error responses in `stripe-payment.js`
- **B1**: Added `notificationsModule.init()` call in `auth.js` `showDashboard()` method
- **B2**: Added UI trigger buttons in `index.html`:
  - Winner Pipeline button in Winners tab toolbar
  - Winner Announcements button in Winners tab toolbar
  - Sponsor Portal button in Marketing > Sponsors sub-tab
  - Ticket Management button in Events attendee modal
  - Calendar View button in Events tab header
- Updated `email-automation.test.js`: auth tests now go through handler, added `query` to `createReq`
- **Verified**: 65/65 test suites pass (6,381 tests, 0 failures), build passes (0 lint errors)
