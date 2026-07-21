# Deployment Guide

Complete, reproducible deployment instructions for the British Trade Awards CMS. Written so a developer with no prior context on this project can take it from zero to a working production deployment, and can safely deploy updates afterward.

**Companion documents:** `ENVIRONMENT-VARIABLES.md` (every variable referenced below), `DISASTER-RECOVERY.md` (what to do when something breaks), `MIGRATION_ORDER.md` (exact SQL run order).

---

## 1. Architecture at a glance

- **Frontend**: vanilla JS + Bootstrap 5, assembled from `src/partials/*.html` and bundled by `build.js` (esbuild) into `dist/`.
- **Backend**: 12 Vercel serverless functions in `/api/` (hard-capped at 12 on the Hobby plan — see §3).
- **Database**: Supabase (managed PostgreSQL) with Row Level Security.
- **File storage**: Supabase Storage, 4 buckets (`uploads`, `entry-files`, `certificate-assets`, `qr-codes`).
- **Email**: Resend.
- **Payments**: Stripe.
- **Hosting**: Vercel (static `dist/` output + serverless functions), deployed from this Git repository.

---

## 2. Supabase Setup

### 2.1 Create the project
1. Create a new project at [supabase.com](https://supabase.com).
2. Note the **Project URL** and, under Settings → API, the **anon public key** and **service_role key** — these become `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`.
3. The service_role key bypasses Row Level Security — never expose it to the browser, and only reference it in server-side (`api/`) code, as the codebase already does.

### 2.2 Run migrations
Migrations are **additive-only** (no destructive statements) and idempotent (`IF NOT EXISTS` guards) — safe to run against a database that already has data, and safe to re-run.

Follow `MIGRATION_ORDER.md` exactly:
1. `migrations/000-complete-database-setup.sql` first — every other file depends on the `award_years` table it creates.
2. The root `database-*.sql` files in the order listed in `MIGRATION_ORDER.md` §"Recommended migration order".
3. All remaining `migrations/0XX-*.sql` files in numeric order through the highest-numbered file.

Run them via the Supabase Dashboard's SQL Editor (paste and run one file at a time, confirm no errors before the next) or the Supabase CLI (`supabase db push`). **Never run raw SQL against production without reading it first.**

### 2.3 Row Level Security
This project's RLS policies were audited and closed out in `DB-SCHEMA-AUDIT-TODO.md` (all 10 findings resolved, including the originally-missing policies on 8 tables). Confirm RLS is enabled on every table after running migrations:

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public' and rowsecurity = false;
```

Any table returned by that query that isn't an intentional exception is a launch blocker — do not proceed until you understand why.

### 2.4 Storage buckets
Create these 4 buckets (Dashboard → Storage → New Bucket), matching exactly:

| Bucket | Purpose | Public? |
|---|---|---|
| `uploads` | Organisation logos, general media | Public read |
| `entry-files` | Entry attachments/supporting documents | Private (accessed via signed URLs) |
| `certificate-assets` | Generated winner certificates | Private |
| `qr-codes` | Generated event check-in QR codes | Public read (QR images need to render in emails) |

Set bucket policies to match: public buckets need a `SELECT` policy allowing anonymous reads; private buckets should only be readable via the service-role key (server-side) or short-lived signed URLs.

### 2.5 Authentication
- Enable Email/Password auth (Dashboard → Authentication → Providers).
- **Configure a custom SMTP provider** (Authentication → Settings → SMTP Settings) before inviting real users. Supabase's built-in email service has a low default rate limit unsuitable for anything beyond light testing — the Users tab's Invite/Reset Password features will fail or queue indefinitely without this. See §6 below for SMTP-specific steps.
- Under Authentication → URL Configuration, set **Site URL** to your real `APP_URL` and add it (plus any preview URLs) to **Redirect URLs**.

---

## 3. Vercel Setup

### 3.1 The 12-function limit
Vercel's Hobby plan allows a maximum of **12 serverless functions**. This project is at exactly 12/12 (`api/*.js`, excluding `api/_lib/` which Vercel ignores). **Do not add a 13th file to `/api/`** — new backend functionality must be added as a new `action`/`operation` inside an existing handler (`api/data-proxy.js` is the usual place). If you're on a paid Vercel plan this limit doesn't apply, but the codebase's existing convention (consolidate into fewer, larger handlers) is still worth keeping for `api/_lib/` reusability.

### 3.2 Import and configure the project
1. Import this Git repository into Vercel.
2. Framework preset: **Other** (there's no framework auto-detection needed — `vercel.json` already specifies `buildCommand`, `outputDirectory`, and `installCommand` explicitly).
3. Vercel will run `node build.js` and serve `dist/` — no further build configuration needed.
4. Add every environment variable from `ENVIRONMENT-VARIABLES.md` under Settings → Environment Variables, scoped to **Production** (and Preview/Development as appropriate — see the `DEV_EMAIL` warning in that document before enabling email-sending variables on Preview).
5. Deploy.

### 3.3 SPA routing
`vercel.json` already includes the catch-all rewrite (`/((?!.*\.[a-zA-Z0-9]{1,8}$).*)`  → `/index.html`) so deep links into the SPA (e.g. a bookmarked `#winners` URL) don't 404. Confirm this is still present if you ever touch `vercel.json` — its absence was a launch blocker found and fixed in an earlier audit pass (`VERCEL-CONFIG-AUDIT-TODO.md`, VC-C1).

### 3.4 Content Security Policy
`vercel.json`'s `headers` block sets the CSP for every route. **There is a second, independent copy of this same policy** in `src/partials/00-shell-head.html` as a `<meta http-equiv="Content-Security-Policy">` tag — both must be kept in sync (a mismatch between them was found and fixed this pass; see `RELEASE-REPORT-V1.md` §9). If you add a new external script/API/frame source, update **both** locations, or better, remove the meta tag entirely and rely on the HTTP header alone (documented as a recommended future cleanup, not done in this pass to avoid unnecessary risk this late in the cycle).

---

## 4. Domain & DNS

1. In Vercel → your project → Settings → Domains, add your production domain (e.g. `admin.yourcompany.com`) and any public-facing domain the standalone pages use.
2. Vercel will show the exact DNS records to add. Typically: an `A` record pointing to Vercel's IP, or a `CNAME` pointing to `cname.vercel-dns.com` for subdomains.
3. Vercel automatically provisions and renews a Let's Encrypt TLS certificate once DNS propagates — no manual certificate management needed.
4. Update `APP_URL` and `ALLOWED_ORIGINS` (see `ENVIRONMENT-VARIABLES.md`) to match your real domain, and redeploy — these are baked into email links and CORS checks, not read dynamically from the request.
5. Update Supabase Auth's Site URL / Redirect URLs (§2.5) to match.

---

## 5. Storage (recap)

Already covered in §2.4. Operationally: monitor bucket size via Supabase Dashboard → Storage — there's no automatic cleanup of old uploads. If storage usage becomes a concern at scale, that's a Version 2 roadmap item (see `ROADMAP-V2.md`), not something this release handles automatically.

---

## 6. SMTP (Supabase Auth emails)

This is distinct from Resend (which sends the CMS's own emails — winner notifications, invoices, etc.) — this section is specifically about the emails Supabase Auth sends itself (invite, password reset, email confirmation).

1. Get SMTP credentials from any provider (Resend itself supports SMTP, or use SendGrid/Postmark/etc.).
2. Supabase Dashboard → Authentication → Settings → SMTP Settings → enable custom SMTP, fill in host/port/username/password and a sender address.
3. Send a test invite from the CMS's Settings → Users tab to confirm delivery before relying on it for real users.

**This step is not optional for production** — without it, the Users tab's Invite User / Reset Password features are rate-limited to the point of being unusable for a real team.

---

## 7. Resend (application email)

1. Create a Resend account, verify your sending domain (adds DNS TXT/CNAME records Resend provides — do this in the same DNS session as §4).
2. Create an API key, set `RESEND_API_KEY`.
3. Set `FROM_EMAIL`/`FROM_NAME` to your real, verified sending address — **do not leave these unset**; the code falls back to this project's own placeholder domain (`awards@britishtradeawards.com`), which will silently fail to deliver from your Resend account since you don't own that domain.
4. Optional but recommended: set up Resend bounce/complaint tracking. The handler routes on a static `action` query parameter rather than inspecting Resend's actual event payload, so you need **two separate webhook subscriptions** in the Resend Dashboard, each pointed at a different URL:
   - Bounce events → `${APP_URL}/api/email-automation?action=resend-bounce`
   - Complaint events → `${APP_URL}/api/email-automation?action=resend-complaint`

   Set `RESEND_WEBHOOK_SECRET` to verify the signature (Resend Dashboard → Webhooks → your webhook → Signing Secret). **Known limitation** (see `RELEASE-REPORT-V1.md` §7 / this pass's technical debt list): if you point a single Resend webhook subscription carrying multiple event types at one of these URLs instead of splitting them as above, every event will be recorded using whichever `action` was in the URL, regardless of what Resend actually sent — the handler never reads Resend's own `type` field to double-check. Two separate webhook subscriptions, exactly as configured above, avoids this.

---

## 8. Stripe (payments)

1. Get your live-mode Secret Key and Publishable Key from the Stripe Dashboard.
2. Set `STRIPE_SECRET_KEY` (server-side, secret).
3. The **Publishable Key is not an environment variable** in this codebase — enter it directly into the CMS (Settings/Events) once logged in; it's stored in that browser's `localStorage`. See `ENVIRONMENT-VARIABLES.md` for the full explanation.
4. Create a webhook endpoint in the Stripe Dashboard pointing to `${APP_URL}/api/stripe-payment`, subscribed at minimum to `checkout.session.completed`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
5. Create a default Price object for entry fees and set `STRIPE_PRICE_ID`.
6. Test with Stripe CLI before going live: `stripe listen --forward-to <your-deployed-url>/api/stripe-payment`, then trigger a test checkout.

---

## 9. AI Integrations (optional)

Only needed if you use AI Vetting. Get an API key from console.anthropic.com and set `ANTHROPIC_API_KEY`. The feature is fully inert (no errors, just unavailable in the UI) if unset.

---

## 10. Social Integrations (optional)

Each platform (Twitter/X, LinkedIn, Facebook, Instagram) is independently optional — see `ENVIRONMENT-VARIABLES.md` for the exact variables each requires and where to obtain them. None are required for the CMS's core functionality.

---

## 11. Automation (Scheduled Tasks)

Scheduled automation (deadline reminders, overdue-payment reminders, dispatching scheduled email campaigns, judging-deadline shortlist generation, weekly judge progress reports, weekly stats, GDPR retention cleanup) runs via **Vercel Cron**, configured in `vercel.json`'s `crons` array:

```json
"crons": [
  { "path": "/api/judge-automation?action=cron-tick", "schedule": "0 9 * * *" }
]
```

**How it works:**
- Vercel invokes this path once a day at 9:00 AM UTC (see the timezone note below), sending a GET request with `Authorization: Bearer $CRON_SECRET` automatically added — no code needs to construct this header, Vercel does it whenever `CRON_SECRET` is set as an environment variable.
- `api/judge-automation.js`'s handler checks that bearer token (constant-time comparison, fails closed with a 500 if `CRON_SECRET` isn't configured — it will never silently run unauthenticated) before calling `runDailyAutomation()` in `api/_lib/automation-scheduler.js`, which is where the actual task logic lives.
- `runDailyAutomation()` always runs the daily-cadence tasks (deadline reminders, payment reminders, scheduled campaign dispatch, the judging-deadline check), and additionally runs the weekly tasks (judge progress reports, weekly stats) only if the current day is Monday, and GDPR retention cleanup only if it's Sunday — both checked in Europe/London time, regardless of what timezone the server itself runs in.

**Why this architecture:** this file previously registered its own schedule using `node-cron`, which never actually ran in production — `node-cron` needs a long-lived process to keep its timers alive, and Vercel serverless functions are spun up per-invocation with nothing persisting between them. That was found and documented as the single most significant gap in an earlier audit pass (see `RELEASE-REPORT-V1.md` §9) and has been replaced with this Vercel Cron-based design.

**Why `api/judge-automation.js` specifically:** the actual task logic lives in `api/_lib/automation-scheduler.js`, but Vercel does not route HTTP traffic to anything under `api/_lib/` (that's the whole point of the directory — see §3.1's 12-function limit). `api/judge-automation.js` was chosen as the real HTTP entry point because it was — before this pass — an already-deployed function with zero live callers (its judge-assignment/shortlist actions were never called from the frontend), so wiring the cron trigger through it uses an existing function slot rather than needing a 13th one.

**Setup:**
1. Generate a secret: `openssl rand -hex 32`.
2. Set `CRON_SECRET` to that value in Vercel's environment variables (see `ENVIRONMENT-VARIABLES.md`).
3. Deploy. Vercel automatically registers the cron job from `vercel.json` — no separate dashboard configuration needed.
4. Confirm it's working: Vercel → your project → Cron Jobs (or Observability → Logs, filtered to `api/judge-automation`) shows each invocation and its result. The response body is a structured JSON summary of every task attempted and its outcome — look for `"success": true` and check `results` for any task with `"status": "error"`.

**Reliability, idempotency, and retry-safety** (verified both by the automated test suite and a live manual run against this project's test database during this pass):
- Each of the 5–8 sub-tasks (depending on day of week) runs independently — one failing task (logged via `console.error`) does not prevent the others from running.
- Every sub-task's own domain logic already de-dupes against database state before sending anything: `checkDeadlineReminders` and `sendPaymentReminders` check an "already sent" log before emailing anyone, `dispatchScheduledCampaigns` flips a campaign's status to `'Sending'` immediately to prevent double-dispatch, and the judging-deadline shortlist check only touches entries still in `'submitted'` status. This means invoking the endpoint more than once on the same day — a manual re-trigger while debugging, or Vercel retrying a slow invocation — will not double-send anything.
- The judging-deadline check specifically uses "deadline reached or passed" (not "reached exactly today") so a missed day (e.g. this being the first run after a period where the cron wasn't yet configured) still generates shortlists rather than silently never firing.

**Known limitation — Vercel Hobby plan's cron constraints:** Hobby allows a maximum of 2 cron job definitions, each running at most once per day, and schedules are evaluated in UTC only (no per-job timezone option — this is why the day-of-week logic above is computed manually in Europe/London time inside the function, rather than relying on Vercel's schedule). The original design (before this pass) wanted scheduled email campaigns dispatched within ~5 minutes of their scheduled time; on Hobby, they'll now go out within 24 hours instead (whenever the next daily tick runs), which is an accepted trade-off, not a bug. If tighter campaign-send timing matters, upgrade to Vercel Pro and add a second, more frequent cron entry pointing at the same path with a query parameter to run only `dispatchScheduledCampaigns` — no code change needed beyond `vercel.json`, since `runDailyAutomation` isn't required to be the only entry point.

**Manual testing without waiting for the schedule:**
```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://your-domain.com/api/judge-automation?action=cron-tick"
```
Locally, run `node api/_lib/automation-scheduler.js` to execute one tick directly (bypassing HTTP/auth entirely) against whatever database your `.env` points at.

---

## 12. Error Monitoring (Sentry) — recommended

Sentry was found this pass to be non-functional (SDK loaded but never initialized — see `ENVIRONMENT-VARIABLES.md`). It's now fixed and ready to use:

1. Create a free Sentry project (sentry.io — free tier covers a small production app comfortably).
2. Set `SENTRY_DSN` in Vercel.
3. Redeploy. Confirm it's working by triggering a deliberate JS error in a non-production environment and checking it appears in the Sentry dashboard.

See `MONITORING.md` for the full monitoring recommendation.

---

## 13. Backups

Supabase manages automatic daily backups on paid plans (Point-in-Time Recovery on Pro+). On the Free plan, Supabase does **not** guarantee backups — you are responsible for your own.

**Minimum recommended backup strategy regardless of plan:**
1. Weekly `pg_dump` via the Supabase CLI: `supabase db dump -f backup-$(date +%F).sql` (or via `pg_dump` directly against the connection string in Dashboard → Settings → Database).
2. Store dumps somewhere outside Supabase itself (S3, Google Cloud Storage, or even a private Git LFS repo for a small dataset) — a backup stored only inside the same Supabase project doesn't protect against account-level incidents.
3. Storage buckets: Supabase Storage isn't included in `pg_dump`. Periodically sync buckets to external storage (`supabase storage` CLI commands or the Management API) if the uploaded files themselves (certificates, entry attachments) are not reproducible from other data.
4. Upgrade to at least Supabase Pro before handling real customer/payment data in production — Point-in-Time Recovery is the difference between "restore to 5 minutes before the mistake" and "restore to last week's manual dump."

Full restore steps: `DISASTER-RECOVERY.md` §1.

---

## 14. Restore Procedure

See `DISASTER-RECOVERY.md` §1 (database) and §2 (storage) for step-by-step restore instructions. Summary: restore is done via the Supabase Dashboard's Point-in-Time Recovery (if on a paid plan) or by replaying your most recent `pg_dump`; there is no one-click restore built into this CMS itself.

---

## 15. Rollback Procedure

This project has no custom rollback tooling — it relies entirely on Vercel's built-in deployment history, which is the correct approach for a static+serverless app with no server-side state.

1. **Frontend/API rollback**: Vercel → your project → Deployments → find the last known-good deployment → "..." menu → **Promote to Production**. This is instant (no rebuild) and reverses both the static frontend and all 12 serverless functions atomically, since they're deployed together as one unit.
2. **Database rollback**: migrations in this project are additive-only by design specifically so that a frontend rollback never leaves the database in an incompatible state — an older frontend build talking to a newer (additive) schema should keep working. If a migration itself needs to be undone (rare — only for a genuinely broken migration), see `DISASTER-RECOVERY.md` §6 ("Broken migration").
3. There is no automatic rollback trigger — a human must notice the problem and promote the previous deployment. See `MONITORING.md` for how to notice quickly.

---

## 16. Zero-Downtime Deployment

Vercel's deployment model is zero-downtime by default and requires no special process here:

1. Every `git push` to the deployed branch triggers a new deployment that builds in isolation — the currently-live deployment keeps serving traffic throughout.
2. Once the new build passes (and, if configured, any deployment checks), Vercel atomically switches traffic to it. There's no partial-rollout window where some users get the old frontend talking to a new API shape or vice versa, because frontend and API deploy together as one unit.
3. **The only thing that can break this guarantee is a non-additive database migration** run manually ahead of a deploy that the *current* (soon-to-be-old) frontend can't handle for the few seconds before the new deploy finishes. Since every migration in this project is additive-only, this class of problem doesn't arise if you keep following that convention (see §13/§2.2).
4. Recommended practice for anything higher-stakes than a routine change: deploy to a Vercel Preview URL first (automatic on every PR), manually smoke-test the exact workflow you changed, then merge to trigger the production deploy.

---

## 17. Post-Deploy Smoke Test

After any production deploy, before considering it done:
1. Load the production URL, confirm login works.
2. Check the browser console for errors (there should be none — see `RELEASE-REPORT-V1.md` for the standard this codebase holds itself to).
3. Spot-check one write operation (e.g. edit an Award) to confirm `data-proxy.js` round-trips correctly against the real database.
4. Confirm Sentry is receiving events if you just set it up (§12).
5. Run through the 6 live-credential checks in `CMS-AUDIT-TODO.md` §10 the first time you deploy to a new production environment (real Resend send, real Stripe webhook, Supabase Storage upload, production Auth login, AI vetting if configured, social posting if configured) — these cannot be verified from a sandboxed dev environment and must be checked against your real, live services.
