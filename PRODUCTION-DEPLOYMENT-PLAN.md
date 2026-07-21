# Production Deployment Plan

A step-by-step launch sequence. Each step names what should happen, how to confirm it happened, and exactly what to do if it doesn't. Follow in order — later steps assume earlier ones succeeded.

**Companion documents**: `DEPLOYMENT-GUIDE.md` (full reference detail for every step below), `ENVIRONMENT-VARIABLES.md` (every variable), `MIGRATION_ORDER.md` (exact SQL order), `DISASTER-RECOVERY.md` (deeper recovery detail if a rollback below isn't enough).

---

## Step 1 — Backup of Existing Production Systems

**Do this even if "production" doesn't exist yet** (i.e., this is a first launch) — establishes your baseline and proves your backup process works before you need it for real.

- **Action**: If an existing production Supabase project has any real data already, take a manual backup now regardless of your plan tier: Supabase Dashboard → Database → Backups, or `supabase db dump -f pre-launch-backup-$(date +%F).sql` via the CLI. If this is a genuinely first deployment with no existing data, skip the dump but still confirm your Supabase plan's backup settings (see Verification).
- **Expected outcome**: A dated SQL dump file exists outside Supabase itself (downloaded locally, or pushed to S3/GCS/etc. — not left only inside the same Supabase project).
- **Verification**: Open the dump file and confirm it's non-empty and contains recognisable table definitions (`\d` or a text search for `CREATE TABLE`).
- **Rollback if it fails**: If you cannot produce a backup at all (permissions issue, CLI not authenticated), **do not proceed to Step 2** until this is resolved — deploying without a rollback point is the one step in this whole plan not worth skipping under time pressure.

---

## Step 2 — Supabase Migration Order

- **Action**: Run every file in `MIGRATION_ORDER.md`'s order exactly, via the Supabase Dashboard SQL Editor (paste and run one file at a time) or `supabase db push`. This includes the 5 additional non-numbered files at the end of that document (`create-award-seasons.sql` and the others) — these were found missing from the documented order during the final pre-launch review and are essential, not optional.
- **Expected outcome**: Every file reports success with no errors. `award_years`, `award_seasons`, and all other tables exist.
- **Verification**:
  ```sql
  select tablename, rowsecurity from pg_tables where schemaname = 'public' and rowsecurity = false;
  ```
  This should return zero rows (or only intentional exceptions you understand) — confirms RLS is enabled everywhere, per `DEPLOYMENT-GUIDE.md` §2.3. Also confirm `award_seasons` specifically exists (`select count(*) from award_seasons;`) since its migration was the one most recently found missing from documentation.
- **Rollback if it fails**: Every migration is additive-only and idempotent (`IF NOT EXISTS` guards) — a failed migration is almost always safe to fix and re-run rather than needing an undo. If a specific file errors, read the error message (it will name the missing dependency or conflicting object), fix the root cause, and re-run just that file. Do not skip ahead. If you truly need to start over, restore from Step 1's backup into a fresh Supabase project rather than trying to manually reverse partial migration state.

---

## Step 3 — Environment Variable Configuration

- **Action**: Set every variable in `ENVIRONMENT-VARIABLES.md` in Vercel (Project → Settings → Environment Variables), scoped to Production. Pay special attention to: `APP_URL` (must be your real domain, not the code's placeholder fallback), `FROM_EMAIL`/`FROM_NAME` (must be a domain you've verified in Resend), and the new `CRON_SECRET` (generate with `openssl rand -hex 32` — required for automation to run at all).
- **Expected outcome**: Every required variable is set; you have a private, secure record of each value (password manager, not just Vercel's UI, since Vercel won't show you a secret's plaintext again once saved).
- **Verification**: Vercel's Environment Variables page lists every name (values are masked) — cross-check the list of names against `ENVIRONMENT-VARIABLES.md` line by line before deploying.
- **Rollback if it fails**: Environment variables don't take effect until the next deploy, so there's nothing to "roll back" at this stage — just correct the value and it takes effect on the next deployment (Step 5).

---

## Step 4 — SMTP Configuration

- **Action**: Configure custom SMTP for Supabase Auth (Dashboard → Authentication → Settings → SMTP Settings) — see `DEPLOYMENT-GUIDE.md` §6. This is separate from Resend/`RESEND_API_KEY` (which sends the CMS's own application emails); this step is specifically for Supabase's own invite/password-reset emails.
- **Expected outcome**: SMTP settings saved and enabled in Supabase.
- **Verification**: Do not wait until real users exist to test this. Once the app is deployed (Step 5) and you can log in (Step 8), send yourself a test invite from Settings → Users and confirm it actually arrives, not just that the CMS says "sent."
- **Rollback if it fails**: Supabase falls back to its own built-in (rate-limited) email sender if custom SMTP isn't configured or fails — the app doesn't break, but Invite/Reset Password will be unreliable at any real volume. If SMTP setup is blocking your launch timeline, you may proceed without it, but treat "configure real SMTP" as a same-day, not "eventually," follow-up — do not onboard a real team on the fallback sender.

---

## Step 5 — Vercel Deployment

- **Action**: Import (or push to) the Git repository connected to your Vercel project. Vercel runs `node build.js` and serves `dist/` automatically — no manual build step needed. See `DEPLOYMENT-GUIDE.md` §3 for the one-time project setup if this is a new Vercel project.
- **Expected outcome**: Deployment completes with a "Ready" status in the Vercel dashboard, no build errors in the log.
- **Verification**: Open the deployment's preview/production URL, confirm the page loads (even before DNS is pointed at it — Vercel gives every deployment its own `*.vercel.app` URL you can check immediately).
- **Rollback if it fails**: If the build itself fails, the previous deployment (if any) keeps serving traffic untouched — Vercel deployments are atomic, there's no partial-rollout risk. Read the build log for the specific error (`build.js` fails loudly and names the exact missing file/lint error) and fix before retrying.

---

## Step 6 — Cron Verification

- **Action**: Confirm Vercel registered the cron job from `vercel.json`'s `crons` array (Vercel Dashboard → your project → Cron Jobs). This is new since the last release — automation now genuinely runs, where it previously did not.
- **Expected outcome**: One cron job listed, targeting `/api/judge-automation?action=cron-tick`, schedule `0 9 * * *`.
- **Verification**: Wait for (or manually trigger, see below) the first invocation and check its response/log shows `"success": true` with a `results` object where every task shows `"status": "ok"`. To test immediately without waiting for the schedule:
  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" "https://your-domain.com/api/judge-automation?action=cron-tick"
  ```
- **Rollback if it fails**: A 500 response with `"CRON_SECRET is not configured"` means Step 3 was incomplete — set the variable and redeploy. A 401 means the bearer token doesn't match — regenerate and reset consistently in Vercel. This step failing does not require rolling back the deployment itself; automation running is not a prerequisite for the CMS's core CRUD functionality to work.

---

## Step 7 — Authentication Verification

- **Action**: Confirm Supabase Auth's Site URL and Redirect URLs (Dashboard → Authentication → URL Configuration) point at your real production domain, not `localhost` or a preview URL.
- **Expected outcome**: Logging in at your production URL succeeds and redirects correctly; no "redirect URL not allowed" errors.
- **Verification**: Log in with a real admin account at the production URL (see Phase 2 below for the full CMS verification pass).
- **Rollback if it fails**: Update the Site URL/Redirect URLs in Supabase and retry — no code deploy needed, this is a Supabase-side dashboard setting.

---

## Step 8 — Storage Verification

- **Action**: Confirm all 4 Storage buckets exist (`uploads`, `entry-files`, `certificate-assets`, `qr-codes`) with the correct public/private policies — see `DEPLOYMENT-GUIDE.md` §2.4.
- **Expected outcome**: Uploading a logo (Organisations tab) or a document (Entries) succeeds and the file is retrievable.
- **Verification**: Upload one test file per bucket type you plan to use immediately; confirm it displays/downloads correctly.
- **Rollback if it fails**: Missing buckets are a Supabase-dashboard fix (create the bucket, set its policy) — no code/deploy rollback needed.

---

## Step 9 — DNS Verification

- **Action**: Add the DNS records Vercel provides when you add your domain (Vercel → Settings → Domains) — typically an `A` record or a `CNAME` to `cname.vercel-dns.com`.
- **Expected outcome**: DNS propagates (can take minutes to a few hours depending on your registrar/TTL).
- **Verification**: `dig your-domain.com` (or Vercel's own domain status page, which shows a green check once it detects correct propagation) shows the expected record.
- **Rollback if it fails**: DNS changes are reversible at your registrar — if something looks wrong, revert to the previous record and re-diagnose. No application-level rollback needed; this step is independent of the deployed code.

---

## Step 10 — Domain Verification

- **Action**: Once DNS propagates, confirm Vercel shows the domain as "Valid Configuration" in its dashboard.
- **Expected outcome**: Visiting your real domain serves the deployed CMS.
- **Verification**: Load the production domain in a real browser (not just `curl`, to also confirm no mixed-content or redirect issues), confirm the login page renders.
- **Rollback if it fails**: If the domain resolves but shows an error, re-check Steps 3 (is `APP_URL` set to this exact domain?) and 9 (DNS) before assuming it's a deeper problem.

---

## Step 11 — SSL Verification

- **Action**: Vercel automatically provisions and renews a Let's Encrypt certificate once DNS is correctly pointed — no manual action needed.
- **Expected outcome**: HTTPS works with a valid, trusted certificate; HTTP redirects to HTTPS automatically.
- **Verification**: Load `https://your-domain.com` and check the browser's padlock/certificate details show a valid cert for your domain, not a Vercel default or expired cert. Also load the plain `http://` version and confirm it redirects.
- **Rollback if it fails**: Certificate provisioning failures are almost always a DNS problem (Step 9 not fully propagated, or a CAA DNS record blocking Let's Encrypt) — re-check DNS before contacting Vercel support. No code rollback applicable.

---

## What happens if a later step fails after earlier ones succeeded

Because deployment is atomic (Step 5) and every migration is additive (Step 2), there is no scenario in this plan where you need to "undo" a partially-successful deploy — you fix the specific failing step and re-verify it, then continue. The one true rollback lever, if the deployed *code* itself turns out to be broken in a way none of the above catches: Vercel → Deployments → promote the last known-good deployment (see `DEPLOYMENT-GUIDE.md` §15 and `DISASTER-RECOVERY.md` §8). This is instant and doesn't require touching the database, since the additive-migration discipline means an older frontend build stays compatible with the current schema.

Once all 11 steps pass, proceed to **Phase 2 — Production Verification** (`PRODUCTION-VERIFICATION-GUIDE.md`).
