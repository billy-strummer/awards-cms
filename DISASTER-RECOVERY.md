# Disaster Recovery Guide

What to do when something breaks. Written to be followed under pressure — each section assumes you're reading it *during* the incident, not studying it in advance.

**Companion documents:** `DEPLOYMENT-GUIDE.md` (how deployment normally works), `ENVIRONMENT-VARIABLES.md` (every variable and where to get it), `MIGRATION_ORDER.md` (exact SQL run order).

---

## Recovery Objectives

| | Target | Why |
|---|---|---|
| **RTO** (Recovery Time Objective) — how long you're down | **Under 1 hour** for a frontend/API rollback (Vercel instant promote); **2–4 hours** for a database restore from backup on Supabase Free/Pro; **under 15 minutes** for Point-in-Time Recovery on Supabase Pro+ | Frontend rollback is a single click (§5). Database restore time is bounded by how large your database is and which Supabase plan you're on — PITR is dramatically faster than replaying a `pg_dump`. |
| **RPO** (Recovery Point Objective) — how much data you can afford to lose | **Up to 1 week** if you're only doing manual weekly `pg_dump`s (Free/no add-on); **under 5 minutes** on Supabase Pro+ with Point-in-Time Recovery enabled | This is a direct consequence of your backup strategy, not a property of the code. See `DEPLOYMENT-GUIDE.md` §13 — **if you haven't upgraded to at least Pro and enabled PITR, your real RPO today is "however long since your last manual backup," which could be a lot worse than a week if backups aren't actually being run on schedule.** Fixing your actual RPO is a backup-cadence decision, not a code change. |

**The honest baseline right now**: this project's own daily automation (see `DEPLOYMENT-GUIDE.md` §11) handles application-level tasks — reminders, campaigns, retention cleanup — not database backups, which were never in its scope and remain Supabase's responsibility, not something this codebase implements. Your real RPO is exactly as good as your Supabase plan's PITR settings, or as good as your manual backup discipline if you haven't upgraded. Treat the numbers above as best-case, not guaranteed.

---

## 1. Database Restoration

**Symptom**: data corrupted, accidentally deleted, or a bad migration ran.

### If you have Supabase Pro+ with Point-in-Time Recovery
1. Supabase Dashboard → Database → Backups → Point in Time Recovery.
2. Pick a timestamp just before the incident.
3. Confirm — Supabase provisions a new database from that point and cuts over. This takes minutes, not hours.
4. **Do this first, before trying anything manual** — it's faster and safer than a manual restore.

### If you're restoring from a manual `pg_dump`
1. Get your most recent dump (see `DEPLOYMENT-GUIDE.md` §13 for where these should be stored — ideally somewhere outside Supabase itself).
2. **Do not restore directly into the live production database if you can avoid it.** Create a new Supabase project first, restore into that, verify it looks correct, then either point the app at the new project (update `SUPABASE_URL`/keys in Vercel) or use Supabase's own migration tooling to move data back into the original project.
3. Restore command: `psql "<connection-string-from-Supabase-Dashboard>" < backup-YYYY-MM-DD.sql` (or `supabase db reset` + replay if using the CLI workflow).
4. After restoring, immediately re-run the RLS check from `DEPLOYMENT-GUIDE.md` §2.3 — a raw restore can sometimes not preserve policies depending on how the dump was taken.
5. Smoke-test: log in, view Awards/Organisations/Winners, confirm counts look sane against what you remember.

### If only specific rows/tables are wrong (not the whole database)
Prefer a targeted fix over a full restore — a full PITR/restore will also undo any *legitimate* writes that happened after the bad event. Query the specific bad rows, understand exactly what changed (check `cms_audit_logs` — this project has an audit trail specifically for this purpose), and write a targeted `UPDATE`/`DELETE` to fix just those rows.

---

## 2. Storage Restoration

**Symptom**: uploaded files (logos, entry attachments, certificates, QR codes) are missing or corrupted.

1. Supabase Storage does not have the same Point-in-Time Recovery as the database — restoring individual objects depends entirely on whether you've been syncing buckets to external storage (§13 of `DEPLOYMENT-GUIDE.md`).
2. If you have an external sync: restore the affected bucket's contents from your external copy via the Supabase CLI (`supabase storage cp` in reverse) or the Management API.
3. If you don't have an external sync: check whether the underlying record still has the file's original URL/path stored in the database (e.g. `organisations.logo_url`, `entries.attachment_url`) — if the object itself is gone from Storage but the reference survived, the specific file is unrecoverable and needs to be re-uploaded by whoever provided it originally. This is exactly the gap flagged in `DEPLOYMENT-GUIDE.md` §13 — **set up external bucket syncing before you need this section for real.**
4. Certificates and QR codes (`certificate-assets`, `qr-codes` buckets) are *usually* regeneratable from the underlying entry/winner data — check `api/certificates-qr.js` for the generation logic before assuming a manual recovery is needed.

---

## 3. Lost Environment Variables

**Symptom**: a teammate who had access left, a `.env` file was accidentally deleted locally, or Vercel's env var list looks wrong after a project transfer.

1. `ENVIRONMENT-VARIABLES.md` is the canonical list of every variable the app needs — use it as your recovery checklist, not memory.
2. Most values are **not** independently recoverable — they're credentials issued by third parties. You need to regenerate/re-fetch each one from its source:
   - Supabase URL/keys: Supabase Dashboard → Settings → API (URL and anon key are always visible; the service role key can be regenerated if lost, but regenerating it **invalidates the old one immediately** — see §5 below for the deploy sequencing this requires).
   - Resend API key: Resend Dashboard → API Keys (regenerate if lost).
   - Stripe keys: Stripe Dashboard → Developers → API Keys.
   - Anthropic key: console.anthropic.com → API Keys.
   - Sentry DSN: sentry.io → your project → Settings → Client Keys (DSN).
   - Social platform tokens: see the "where to get it" column already in `CLAUDE.md`'s env var table / `ENVIRONMENT-VARIABLES.md`.
3. If you suspect a variable was *leaked* (not just lost), treat it as compromised — rotate it (§4) rather than just re-adding the old value.
4. Vercel keeps historical deployments but **does not show you the plaintext value of a previously-set environment variable once removed** — there is no way to recover a secret from Vercel's history after deletion. Prevention: keep an encrypted copy of production `.env` values in a password manager or secrets vault, not just in Vercel.

---

## 4. Lost SMTP Credentials

**Symptom**: Supabase Auth emails (invite/reset password) stop sending, or you've lost access to your SMTP provider account.

1. This is separate from Resend (application emails) — see `DEPLOYMENT-GUIDE.md` §6 vs §7 if you're not sure which is failing (check whether the failing email is a login-related one from Supabase itself, or a CMS-triggered one like a winner notification).
2. Log into your SMTP provider directly (not through Supabase) to regenerate credentials.
3. Supabase Dashboard → Authentication → Settings → SMTP Settings → update host/port/username/password.
4. Send a test invite from Settings → Users to confirm before telling anyone it's fixed.
5. If you've lost access to the SMTP provider account entirely: most providers (Resend, SendGrid, Postmark) support account recovery via the domain's DNS (prove domain ownership) — this can take longer than a simple credential reset, so start it immediately rather than troubleshooting other things first if this is the actual blocker.

---

## 5. Expired API Keys

**Symptom**: a specific integration (Stripe, Resend, AI Vetting, a social platform) suddenly stops working with an authentication error in the logs.

1. Confirm which key by checking Vercel's function logs for the specific `api/*.js` file throwing the error, or check that provider's own dashboard for an "API key expired/revoked" notice.
2. Regenerate the key at the source (see the list in §3).
3. Update the Vercel environment variable.
4. **Redeploy is required** — Vercel environment variables are baked into each serverless function's execution environment at deploy time, not read live from the dashboard. Changing a variable in the Vercel UI alone does nothing until the next deployment. The fastest way to force this without a code change: Vercel → Deployments → "..." on the current production deployment → **Redeploy**.
5. For `SUPABASE_SERVICE_KEY` specifically: regenerating it in the Supabase dashboard invalidates the old key **immediately**, before your new deployment is live. This means there's a real window where the old deployment can't reach the database. Minimize it: regenerate the key, immediately update Vercel, immediately redeploy — do this as one continuous action, not spread across a support ticket queue.

---

## 6. Failed Deployment

**Symptom**: a Vercel deployment fails to build, or builds but the live site is broken.

1. **If the build itself failed**: check the Vercel deployment log — `build.js` fails loudly on: a missing `src/partials/manifest.json`, a referenced partial file that doesn't exist, an ESLint error (the build runs lint first and stops on failure), or a missing partial. The error message names the exact missing file — start there.
2. **If the build succeeded but the site is broken**: this is not a "failed deployment" in Vercel's eyes (it deployed successfully) — this is a rollback situation. Go straight to §5 below.
3. **If deployment fails specifically after a database migration**: this is the most dangerous combination (schema and code out of sync) — see §7.

---

## 7. Broken Migration

**Symptom**: a migration was run that either failed partway through, or succeeded but broke something (a column rename that a still-deploying frontend build doesn't expect, for instance).

1. **Every migration in this project is designed to be additive-only** (`RELEASE-REPORT-V1.md` §4) — a genuinely "broken" migration that needs undoing should be rare by design. If you're here, something deviated from that convention.
2. If the migration failed partway through (a mid-transaction error): check whether it was wrapped in a transaction (`BEGIN`/`COMMIT`) — most of this project's migrations use `IF NOT EXISTS` guards specifically so they're safe to simply re-run after fixing whatever caused the failure, rather than needing an explicit rollback.
3. If the migration succeeded but broke the live app (e.g., a column the frontend expects was renamed/dropped): this is a same-class problem as any breaking schema change — write a corrective migration that restores compatibility (e.g., re-add the column, or add a view aliasing the old name) rather than trying to "undo" the original migration, which risks losing any data written since. Deploy the corrective migration, confirm the app recovers, then plan the *correct* additive way to make the change you originally wanted.
4. If you truly need to reverse a migration and have no corrective-migration option: this is a Point-in-Time Recovery situation — see §1. Restoring to a moment before the migration ran is safer than attempting to hand-write a reverse migration under pressure.

---

## 8. Rollback Process

See `DEPLOYMENT-GUIDE.md` §15 for the full procedure. Summary for use during an active incident:

1. Vercel → your project → Deployments.
2. Find the most recent deployment you're confident was working.
3. "..." menu → **Promote to Production**.
4. This is near-instant and doesn't require a rebuild — traffic switches immediately.
5. Because migrations are additive-only, an older frontend build talking to the current (newer) database schema should keep working — you generally do **not** need to also roll back the database to roll back the frontend/API. Only roll back the database (§1) if the data itself, not just the code, is the problem.

---

## 9. Post-Incident Checklist

After resolving any of the above:
1. Write down what happened and the exact fix, even briefly — this document should grow from real incidents, not stay theoretical.
2. If a secret was rotated (§3/§5), confirm every environment (Production **and** Preview, if you use Preview deployments) has the new value — it's easy to fix Production and forget Preview still has the old, now-invalid key.
3. Re-run the post-deploy smoke test in `DEPLOYMENT-GUIDE.md` §17.
4. If the incident revealed a gap in this document, update it — this file is only useful if it reflects reality.
