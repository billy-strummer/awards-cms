# Environment Variables Reference

This is the single source of truth for every environment variable the CMS reads. It was compiled by grepping every `process.env.*` reference in `api/**/*.js` and `build.js` against what's documented in `CLAUDE.md` and `.env.example` — three genuine mismatches were found and fixed as part of this pass (see the note under each affected row).

Set these in **Vercel → Project → Settings → Environment Variables**. Locally, copy `.env.example` to `.env` (never commit `.env`).

## Supabase

| Variable | Purpose | Required? | Default | Production value required? | Example |
|---|---|---|---|---|---|
| `SUPABASE_URL` | Supabase project URL — used server-side (`api/*`) and injected client-side into `<meta name="supabase-url">` at build time | **Required** | none — app cannot start without it | Yes | `https://xxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase public anon key — client-side auth only, safe to expose | **Required** | none | Yes | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_KEY` | Supabase **service role** key — bypasses Row Level Security, used only server-side in `api/data-proxy.js` etc. **Never expose to the browser.** | **Required** | none | Yes | `eyJhbGciOi...` (secret) |

## Email (Resend)

| Variable | Purpose | Required? | Default | Production value required? | Example |
|---|---|---|---|---|---|
| `RESEND_API_KEY` | Authenticates all outgoing email | **Required** | none — email sending fails without it | Yes | `re_xxxxxxxxxxxx` (secret) |
| `FROM_EMAIL` | Sender address on every outgoing email | Required in practice | hardcoded fallback `awards@britishtradeawards.com` scattered across 6 files | Yes — the fallback is this project's placeholder domain, not yours | `awards@yourcompany.com` |
| `FROM_NAME` | Sender display name | Required in practice | hardcoded fallback `British Trade Awards` | Yes if you're white-labelling | `British Trade Awards` |
| `CONTACT_EMAIL` | Fallback contact address shown in payment receipts and email footers | Optional | falls back to `FROM_EMAIL` | Recommended | `awards@yourcompany.com` |
| `DEV_EMAIL` | Safety net: when `NODE_ENV !== 'production'`, all Resend emails are redirected here instead of real recipients | Optional | none — no redirect happens if unset (emails go to real addresses even in a non-prod deploy!) | No — dev/staging only | `you@example.com` |
| `RESEND_WEBHOOK_SECRET` | Verifies signatures on Resend delivery/bounce webhook payloads (`api/email-automation.js`) | Optional but recommended | none — webhook signature check is skipped if unset | Recommended | `whsec_xxxxxxxxxxxx` |

> ⚠️ **Found and fixed this pass**: `.env.example` previously did not list `DEV_EMAIL` or `RESEND_WEBHOOK_SECRET` at all, despite both being read by live code. Also see the `DEV_EMAIL` warning above — if you deploy a staging/preview environment on Vercel without setting `DEV_EMAIL`, it will send real emails to real people using whatever test data is in that database.

## Payments (Stripe)

| Variable | Purpose | Required? | Default | Production value required? | Example |
|---|---|---|---|---|---|
| `STRIPE_SECRET_KEY` | Server-side Stripe API calls (`api/stripe-payment.js`) | Required if using Payments | none | Yes | `sk_live_xxxxxxxxxxxx` (secret) |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe webhook signatures | Required if using Payments | none — webhook handler rejects all events without it | Yes | `whsec_xxxxxxxxxxxx` (secret) |
| `STRIPE_PRICE_ID` | Default Stripe Price object for entry-fee checkout | Required if using Payments | none | Yes | `price_xxxxxxxxxxxx` |
| ~~`STRIPE_PUBLISHABLE_KEY`~~ | **Not read from environment variables at all** — see note below | N/A | N/A | N/A | N/A |
| `BTA_LOGO_URL` | Logo shown on the Stripe Checkout page | Optional | falls back to `${APP_URL}/assets/british-trade-awards-logo.png` | Recommended | `https://yourdomain.com/assets/logo.png` |

> ⚠️ **Found and fixed this pass**: `CLAUDE.md` and `.env.example` both documented `STRIPE_PUBLISHABLE_KEY` as a Vercel environment variable, but **no code anywhere reads `process.env.STRIPE_PUBLISHABLE_KEY`**. The publishable key (which isn't secret) is instead entered directly into the CMS via Settings/Events and stored in the browser's `localStorage` (key `bta_stripe_pk`) — per-browser, not per-deployment. Setting this env var in Vercel currently does nothing. This is documented here rather than "fixed" in code, since changing the mechanism is a real design decision, not a bug — see `RELEASE-REPORT-V1.md` §7 (Remaining Technical Debt) if you want to move it to a shared, server-driven setting instead.

## AI Vetting

| Variable | Purpose | Required? | Default | Production value required? | Example |
|---|---|---|---|---|---|
| `ANTHROPIC_API_KEY` | Claude API key for AI-assisted company vetting (`api/ai-vetting.js`) | Optional — feature is inert without it | none | Only if you use AI Vetting | `sk-ant-xxxxxxxxxxxx` (secret) |

## Error Monitoring (Sentry)

| Variable | Purpose | Required? | Default | Production value required? | Example |
|---|---|---|---|---|---|
| `SENTRY_DSN` | Enables browser-side error reporting via Sentry | Optional | none — Sentry SDK loads but never initializes if unset | **Strongly recommended for production** | `https://xxxx@oXXXXXX.ingest.sentry.io/XXXXXX` |

> ⚠️ **Found and fixed this pass**: this was documented in `.env.example` as configurable, and the Sentry SDK was loaded on every page and `Sentry.init()` was written and ready to go — but it checked `window.SENTRY_DSN`, a global nothing ever set. Error monitoring has never actually reported a single error in any environment since this was added. Fixed by injecting the DSN into a `<meta name="sentry-dsn">` tag at build time (the same pattern already used for Supabase credentials) and having `app.js` read that instead. **Action needed: create a free Sentry project and set this variable — see `DEPLOYMENT-GUIDE.md` and `MONITORING.md`.**

## Social Media Posting

All social platforms are fully optional — each platform's posting feature is simply unavailable if its variables are unset, with no effect on the rest of the CMS.

| Variable | Purpose | Required? | Default | Production value required? | Example |
|---|---|---|---|---|---|
| `TWITTER_API_KEY` | Twitter/X OAuth 1.0a consumer key | Optional (all 4 Twitter vars needed together) | none | Only if posting to Twitter | `xxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWITTER_API_SECRET` | Twitter/X OAuth 1.0a consumer secret | Optional | none | Only if posting to Twitter | `xxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWITTER_ACCESS_TOKEN` | Twitter/X OAuth 1.0a user access token | Optional | none | Only if posting to Twitter | `xxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWITTER_ACCESS_TOKEN_SECRET` | Twitter/X OAuth 1.0a user access token secret | Optional | none | Only if posting to Twitter | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `LINKEDIN_ACCESS_TOKEN` | LinkedIn OAuth 2.0 token (`w_organization_social` scope) | Optional | none | Only if posting to LinkedIn | `xxxxxxxxxxxxxxxxxxxxxxxx` |
| `LINKEDIN_ORG_ID` | LinkedIn company page numeric ID | Optional | none | Only if posting to LinkedIn | `12345678` |
| `FACEBOOK_PAGE_TOKEN` | Facebook/Instagram Graph API page access token (`pages_manage_posts` scope) | Optional | none | Only if posting to Facebook/Instagram | `EAAxxxxxxxxxxxxx` |
| `FACEBOOK_PAGE_ID` | Facebook Page ID | Optional | none | Only if posting to Facebook | `123456789012345` |
| `INSTAGRAM_ACCOUNT_ID` | Instagram Business Account ID | Optional | none | Only if posting to Instagram | `17841400000000000` |

> ⚠️ **Found and fixed this pass**: `.env.example` previously listed a single `TWITTER_BEARER_TOKEN`, which `api/social-media-api.js` has never read. Twitter posting actually requires the four OAuth 1.0a variables above set together — a bearer token alone cannot post on a user's behalf. Fixed in `.env.example`.

## Application / Deployment

| Variable | Purpose | Required? | Default | Production value required? | Example |
|---|---|---|---|---|---|
| `APP_URL` | Base URL used in email links, Stripe redirect URLs, judge portal links, etc. | **Required** | hardcoded fallback `https://admin.britishtradeawards.com` (this project's placeholder domain) scattered across 6+ files | Yes — must be your real production URL | `https://admin.yourcompany.com` |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist for `api/data-proxy.js` | Optional | defaults to `APP_URL` alone | Recommended if you serve the admin from more than one origin (e.g. a staging URL too) | `https://admin.yourcompany.com,https://yourcompany.com` |
| `NODE_ENV` | Standard Node environment flag | Set automatically by Vercel | — | Do not set manually in Vercel's dashboard | `production` |
| ~~`PORT`~~ | Not used — Vercel serverless functions have no listening port | N/A | N/A | N/A | N/A |

> ⚠️ **Found and fixed this pass**: `.env.example` listed `PORT=3000`, a relic of `AUTOMATION-COMPLETE.md`'s older, pre-Vercel Express-server design (see `DEEP-AUDIT`/technical-debt notes). It has no effect on Vercel and has been removed from the example file with an explanatory comment, so it doesn't mislead a future deployer into thinking it does something.

## Automation (Scheduled Tasks)

| Variable | Purpose | Required? | Default | Production value required? | Example |
|---|---|---|---|---|---|
| `CRON_SECRET` | Authenticates Vercel Cron's daily automation trigger (`/api/judge-automation?action=cron-tick`). Vercel automatically sends `Authorization: Bearer $CRON_SECRET` when invoking a scheduled function if this variable is set — the endpoint checks it via a constant-time comparison and **fails closed (500) if unset**, rather than silently allowing unauthenticated requests through. | **Required** for scheduled automation to run (deadline reminders, payment reminders, scheduled campaigns, judging-deadline shortlist generation, weekly judge progress reports, weekly stats, GDPR retention cleanup) | none | Yes | a long random string, e.g. generated with `openssl rand -hex 32` |

> ✅ **Implemented this pass**: previously, none of the above tasks ran on any schedule in production at all — see `RELEASE-REPORT-V1.md` §9 for the full history. This is now wired up via Vercel Cron; see `DEPLOYMENT-GUIDE.md`'s Automation section for the complete setup and `api/_lib/automation-scheduler.js` for the implementation. **You must set `CRON_SECRET` for the daily automation to actually run** — without it, `vercel.json`'s cron entry will hit the endpoint but receive a 500 and no task will execute (fail-closed, not silently broken — check Vercel's Cron Jobs log if this happens).

## Confirming nothing is missing

Every `process.env.X` reference in `api/**/*.js` and `build.js` is accounted for in the tables above — cross-checked with:

```bash
grep -rhoE "process\.env\.[A-Z_][A-Z0-9_]*" api/*.js api/_lib/*.js build.js | sort -u
```

No variable found by that search is undocumented here. Three genuine mismatches between the code and the previous documentation (`STRIPE_PUBLISHABLE_KEY` not actually read, `SENTRY_DSN` never reaching the browser, `TWITTER_BEARER_TOKEN` not matching the real Twitter variable names) were found and corrected as part of this pass — see the ⚠️ notes above and `RELEASE-REPORT-V1.md` for the code-side fixes.

**Total: 25 environment variables** (3 required-always, 3 required-for-payments, 4 required-for-Twitter, 4 more single-platform social variables, 1 required-for-AI-vetting, 1 error-monitoring, 1 required-for-automation, 6 email/application variables with safe fallbacks, plus `NODE_ENV` which you don't set yourself).
