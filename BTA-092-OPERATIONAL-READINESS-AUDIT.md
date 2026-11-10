# BTA-092 — Operational and Deployment Readiness Audit

**Date:** 2026-11-02. **Type:** read-only repository audit, part of the BTA-084–093 autonomous programme. No file was modified, no secret value is quoted below, no live service was called.

## Executive summary

Configuration and deployment setup is generally sound: CSP, security headers, and the SPA rewrite are all present and consistent with earlier findings (BTA-077) that they're already correctly configured. Two new **Confirmed** findings this task: (1) `STRIPE_PUBLISHABLE_KEY`, documented in `CLAUDE.md` as a "Configured" Vercel env var, is **not read anywhere in the codebase** — the real Stripe publishable key is stored via the admin Settings UI into `localStorage` (`bta_stripe_pk`), making the CLAUDE.md table entry stale/inaccurate; (2) `@anthropic-ai/sdk` is two major versions behind (`0.39.0` installed vs `1.4.0` latest) — worth a deliberate upgrade decision given the AI-vetting feature depends on it. No hardcoded secrets found (re-confirmed). No health-check endpoint exists. `DISASTER-RECOVERY.md` predates and does not account for the BTA-078–083 RLS/grant exposure findings or migration 093.

## Findings by category

### Environment variables — Confirmed
Every `process.env.X` read across `api/*.js`, `api/_lib/*.js`, and `build.js` (27 distinct variables) is documented somewhere in `CLAUDE.md`'s environment-variable tables — re-confirms BTA-077's G/H fork finding, still accurate.

**New discrepancy (Confirmed):** `STRIPE_PUBLISHABLE_KEY` is listed in `CLAUDE.md`'s "Configured (All Environments)" table but a repository-wide grep for the literal string found zero matches in any `.js`/`.html` file. Tracing the actual Stripe-publishable-key code path (`stripe-frontend.js:14-28`, `register-app.js:271`) shows it is read from `localStorage.getItem('bta_stripe_pk')`, populated via an admin Settings form (`events.js:3929-3947`), not from any server environment variable. **Impact:** low — this is a documentation accuracy issue, not a functional defect; the app works as designed, but `CLAUDE.md`'s table gives a wrong impression of where this value lives.

### Configuration handling — Confirmed
`build.js:262-276` injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SENTRY_DSN`, and reads `APP_URL` for absolute OG-image URLs, writing the first three into `<meta>` tags in `index.html`. This matches `config.js`'s expected read-path (not independently re-traced this task; confirmed via build output logging "Supabase: credentials injected from environment" when `SUPABASE_URL` is set). No change from prior findings.

### Secret exposure — Confirmed (clean)
Re-ran a hardcoded-secret-shaped-string grep (`sk_live_`, `sk_test_`, `whsec_`, `re_<20+ alnum>`, `AKIA...`) across all tracked `.js`/`.html`/`.json` files, excluding `node_modules`/`dist`/tests — zero matches. Consistent with BTA-077/079's own findings.

### Logging — Unverified (not exhaustively re-checked)
Did not do a line-by-line audit of every `console.error`/`console.log` call in `api/*.js` for sensitive-data leakage into server logs (distinct from the client-facing error-message question already closed in BTA-077, S.3.3) — out of time budget for this pass. No evidence either way; flagged as **Unknown**, not Confirmed clean.

### Deployment configuration — Confirmed
`vercel.json`: SPA catch-all rewrite present (`/((?!.*\.[a-zA-Z0-9]{1,8}$).*)` → `/index.html`) — re-confirms BTA-077's finding that VC-C1 is already fixed. CSP (`default-src 'self' https://*.supabase.co`, with explicit allowlists for Stripe, Sentry, jsDelivr/unpkg/cdnjs, Supabase realtime, YouTube/Vimeo, Companies House API, logo/icon services) plus HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` are all present on every route. Per-function `maxDuration` is set for all 12 `/api/` functions (30s, except `judge-automation`/`ai-vetting` at 60s). One cron job configured (`/api/judge-automation?action=cron-tick`, daily 09:00 UTC), matching `CLAUDE.md`'s own description.

### Build process — Confirmed
Current build output (re-run this task, consistent with BTA-077/080's own build runs): core bundle 1000KB, 5 lazy chunks totalling 1404KB, 4 of 5 flagged `⚠️ LARGE (>150KB)` (events 517KB, media 249KB, email 323KB, crm 260KB). This warning is emitted by `build.js` itself but nothing in the repository's TODO files or task history proposes a concrete splitting plan — it's a known, self-reported, unaddressed condition, not a new finding.

### Static asset handling — Confirmed (re-verified, not re-litigated)
All 23 root-level `*.html` pages and 135 images are copied to `dist/` per the current build log — matches BTA-077's "VC-M1 already fixed" finding.

### Dependencies — Confirmed
`npm outdated` (read-only; does not modify `package.json` or `node_modules`): most dependencies are 1 minor/patch version behind. One dependency is substantially behind: **`@anthropic-ai/sdk` 0.39.0 installed vs 1.4.0 latest (major version gap)** — this package backs the AI-vetting feature (`api/_lib/ai-vetting-proxy.js`, confirmed in BTA-042). `@supabase/supabase-js` is also meaningfully behind (2.98.0 vs 2.118.0, same major version). Neither is a security advisory per se (not checked via `npm audit` this task — that was already run per the SessionStart hook output showing 45 known vulnerabilities, 9 low/27 moderate/9 high, not attributed to specific packages here), just version currency.

### Health checks — Confirmed (gap)
No `/health`, `/ping`, or equivalent endpoint exists anywhere in `/api/` or `vercel.json`. **Potential** gap for uptime monitoring — not necessarily a defect (many small apps rely on the hosting platform's own health signals instead), but worth a deliberate decision rather than an oversight.

### Backup assumptions / recovery documentation — Confirmed
`DISASTER-RECOVERY.md` (dated 2026-10-22, i.e. **before** BTA-078 through BTA-083) is a substantial, well-written runbook covering database restoration (PITR vs manual `pg_dump`), storage restoration, lost environment variables, and more. It explicitly states the project's real RPO depends entirely on the Supabase plan's PITR settings or manual backup discipline — "not something this codebase implements." **It does not mention, and could not have mentioned, the live RLS/grant exposure found in BTA-078/079 or migration 093** — if a security incident response were needed today, this document would not point an operator toward the actual current blocker (the exposed tables) or the prepared-but-unapplied fix. This is a **Potential** gap: the document isn't wrong, it's simply silent on the newest and most serious known issue, because it predates it.

### External service dependencies — Confirmed (partial)
`api/ai-vetting.js` and `api/social-media-api.js` both return a graceful `503 "not configured"` response (not a crash) when their respective API keys are unset, confirmed in BTA-077 (S.3.3 — these endpoints' error messages were specifically hardened that task). Did not re-trace Resend/Stripe's own unset-key behaviour this task — **Unknown**, not re-verified.

### Email / Supabase configuration — Confirmed (unchanged)
`api/data-proxy.js:31` and `api/entry-proxy.js:21` both construct their Supabase client with `SUPABASE_SERVICE_KEY` exclusively — re-confirms the consistent finding from every prior task this series that touched this.

## Prioritised issues (not fixed, for the BTA-093 roadmap)

1. **Low** — Correct `CLAUDE.md`'s Vercel Environment Variables table: remove or re-label `STRIPE_PUBLISHABLE_KEY` as not server-side-configured; document the actual `localStorage`/admin-settings mechanism instead.
2. **Medium** — Decide whether to upgrade `@anthropic-ai/sdk` (major version behind) and `@supabase/supabase-js` (significantly behind within the same major version); check each package's changelog for breaking changes before upgrading either.
3. **Low/Medium** — Update `DISASTER-RECOVERY.md` to reference the BTA-078–083 RLS exposure findings and migration 093's existence, so a future incident responder isn't working from a stale picture.
4. **Low** — Consider adding a minimal health-check endpoint, or explicitly document that none is planned and why.
5. **Low** — The 4 "LARGE" lazy chunks (events/media/email/crm) have no proposed splitting plan anywhere in the repo's TODOs; worth a deliberate decision (split further, or accept as-is).
