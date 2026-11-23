# Production Troubleshooting Guide

The most likely production issues, each with symptoms, likely cause, how to diagnose, how to resolve, and how to prevent recurrence. Cross-referenced to the deeper reference documents rather than duplicating their full detail.

---

## CSV Import Fails

**Symptoms**: Upload CSV shows validation errors and refuses to import; or the import appears to succeed but expected records don't show up.

**Likely cause**: Malformed source data (missing required column, unknown award category name, duplicate company within the file, invalid email, missing organisation name) — the importer is working correctly by rejecting it, not broken.

**Diagnosis**: Read the validation error list carefully — it names the exact row and problem for every issue. If it claims success but data is missing, check whether you used the wrong import tool: Award Areas creates nominees/entries; Organisations → "Add Contacts in Bulk" only creates contact records, not competition entries (a common, documented mix-up — see `ADMIN-GUIDE.md` §4).

**Resolution**: Fix the source CSV per the specific errors listed and re-upload — nothing partial is ever committed, so there's no cleanup needed from a failed validation pass. If you used the wrong tool, there's no "convert" path — re-import the same data through Award Areas correctly.

**Prevention**: Always do a small test batch (5–10 rows) before a large import, per `OPERATIONS-MANUAL.md`'s best practices. Keep award category names in your CSV exactly matching what's already created in Awards — this is the single most common real-world validation failure.

---

## Emails Not Sending

**Symptoms**: Invite/reset password emails never arrive; or CMS-triggered emails (winner notifications, invoices) don't arrive.

**Likely cause**: Two entirely separate systems can be at fault — distinguish which one first. Supabase Auth's own email service (invite/reset) is separate from Resend (the CMS's application emails).

**Diagnosis**:
- For invite/reset emails: check whether custom SMTP is configured in Supabase Auth (`DEPLOYMENT-GUIDE.md` §6). Without it, Supabase's built-in sender has a low rate limit and can silently stop delivering under any real load.
- For CMS-triggered emails: check the Resend Dashboard's delivery status for the specific email. A "sent" status there but no arrival is usually a spam-folder or recipient-domain issue, not a code bug; a missing/failed status points to `RESEND_API_KEY` or `FROM_EMAIL` misconfiguration.
- Check for entries in `email_suppressions` if you've wired up the bounce/complaint webhooks — a suppressed address will never receive mail again until manually removed.

**Resolution**: Configure/fix SMTP for Auth emails; verify `RESEND_API_KEY`/`FROM_EMAIL`/`FROM_NAME` for CMS emails (`ENVIRONMENT-VARIABLES.md`). Remember: **environment variable changes require a redeploy** to take effect (they're baked in at deploy time, not read live).

**Prevention**: Do the real end-to-end email tests in `PRODUCTION-VERIFICATION-GUIDE.md` §C before launch, not after a real user complains. Set up the Resend bounce/complaint webhooks (`DEPLOYMENT-GUIDE.md` §7) so failures surface automatically instead of silently.

---

## Cron Not Running

**Symptoms**: Deadline reminders, payment reminders, scheduled campaigns, judge progress reports, or retention cleanup aren't happening.

**Likely cause**: `CRON_SECRET` isn't set (the endpoint fails closed with a 500 rather than silently allowing an unauthenticated request through), or the cron job isn't registered at all.

**Diagnosis**: Vercel Dashboard → your project → Cron Jobs — is the job listed? If not, check `vercel.json` was actually deployed with the `crons` array intact. If it's listed but failing, check the invocation's response — a 500 with `"CRON_SECRET is not configured"` names the exact problem. A 401 means the secret is set but a manual test call used the wrong value.

**Resolution**: Set `CRON_SECRET` (generate with `openssl rand -hex 32`) and redeploy. Manually verify with:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://your-domain.com/api/judge-automation?action=cron-tick"
```
A successful response is a JSON summary with `"success": true` and every task in `results` showing `"status": "ok"`.

**Prevention**: This is Step 6/Step 3 of `PRODUCTION-DEPLOYMENT-PLAN.md` — don't skip verifying it before considering the deployment complete. Note the accepted limitation that scheduled email campaigns dispatch within 24 hours (not ~5 minutes) on Vercel's Hobby plan — this is expected behaviour, not a bug, unless you've upgraded to Pro with a more frequent second cron entry.

---

## Storage Full

**Symptoms**: File uploads (logos, entry attachments, media) start failing.

**Likely cause**: Supabase Storage plan limit reached.

**Diagnosis**: Supabase Dashboard → Storage (or Settings → Billing) — check current usage against your plan's limit.

**Resolution**: Upgrade your Supabase plan, or clear genuinely unneeded old files (there's no automatic cleanup built into this codebase — see `DISASTER-RECOVERY.md`'s storage note). Do not delete files without confirming nothing still references them (check the relevant table's URL/path column first).

**Prevention**: Monitor storage usage monthly per `OPERATIONS-MANUAL.md` (weekly in week 1 per `WEEK-1-MONITORING-CHECKLIST.md`) — this should never be a surprise if you're checking on schedule.

---

## Organisation Missing

**Symptoms**: An organisation you expect to exist isn't showing up in the Organisations tab or search.

**Likely cause**: It's archived (soft-deleted, not hard-deleted — check the archived filter/view), or it was never actually created because a prior CSV import failed validation silently (i.e., you assumed it succeeded but it didn't).

**Diagnosis**: Search Organisations with the "include archived" filter if one exists. Check the relevant import's validation history if it came from a CSV. Check `cms_audit_logs` for the organisation's expected name — this project has an audit trail specifically for this purpose.

**Resolution**: Un-archive if found archived. Re-import via Award Areas if it was never actually created.

**Prevention**: Always verify import success against the actual data (per `FIRST-COUNTY-IMPORT-GUIDE.md`'s verification checklist), not just the "success" toast message.

---

## Winner Not Appearing (on public site)

**Symptoms**: A winner exists in the CMS but doesn't show on `public-winners.html`.

**Likely cause**: Status isn't actually "Published" yet — the publishing pipeline (Pending → Notified → Pack Sent → Confirmed → Published) gates public visibility strictly on that final status.

**Diagnosis**: Check the winner's Status column in the Winners tab. Anything other than "Published" won't appear publicly — this is correct, intentional behaviour (verified live during the final pre-launch review), not a bug.

**Resolution**: Move the winner's status to Published if it's genuinely ready (confirm GDPR consent is recorded first, per `ADMIN-GUIDE.md`).

**Prevention**: None needed beyond understanding the intended workflow — this "issue" is almost always a correct gate working as designed, not a defect.

---

## Judge Cannot Log In

**Symptoms**: A judge's invite was sent but they can't access the Judge Portal.

**Likely cause**: They're using the wrong login page (`judge-login.html`, a separate path from the main admin CMS login), haven't accepted their invite email yet, or their account's role isn't actually "Judge."

**Diagnosis**: Confirm with the judge which URL they're trying. Check Settings → Users for their account status (invited vs. active) and role.

**Resolution**: Point them to the correct URL. Resend the invite if it was never accepted (check spam folders — see the Emails Not Sending entry above if invites aren't arriving at all). Correct the role if it was set wrong.

**Prevention**: Test this exact flow yourself with a real invite before onboarding real judges — covered in `PRODUCTION-VERIFICATION-GUIDE.md` §A (Judges).

---

## Permissions Incorrect

**Symptoms**: A user can see/do something they shouldn't, or can't do something they should be able to.

**Likely cause**: Wrong role assigned in Settings → Users.

**Diagnosis**: Confirm the user's actual assigned role matches what you intend. RBAC is enforced server-side (confirmed in `SECURITY-REVIEW-FINAL.md`) — client-side tab hiding is UX polish, not the real security boundary, so a "hidden" tab that's still reachable by direct action would indicate a genuine server-side bug worth reporting carefully, not just a display issue.

**Resolution**: Correct the role assignment. If a lower-privileged role can perform a server-side action it shouldn't be able to (not just see a hidden button), treat this as a genuine security issue and stop using that role until understood — this would contradict the security review's findings and warrants careful, prompt investigation.

**Prevention**: Follow the principle already in `OPERATIONS-MANUAL.md`: start new users at the lowest role that lets them do their job, raise it later if needed rather than over-granting up front.

---

## Broken Image

**Symptoms**: A logo, photo, certificate, or QR code doesn't display.

**Likely cause**: The Storage bucket policy doesn't match what the image needs (e.g., a private bucket being accessed without proper authorization), or the file was never actually uploaded successfully despite the UI appearing to accept it.

**Diagnosis**: Check the browser's Network tab for the actual failing request — a 403/401 points to a bucket policy problem; a 404 means the file genuinely isn't in Storage. Confirm bucket policies match `DEPLOYMENT-GUIDE.md` §2.4's table (`uploads`/`qr-codes` public, `entry-files`/`certificate-assets` private).

**Resolution**: Fix the specific bucket's policy in Supabase Dashboard → Storage, or re-upload the file if it's genuinely missing.

**Prevention**: The Storage verification step in `PRODUCTION-DEPLOYMENT-PLAN.md` (Step 8) exists specifically to catch this before real users hit it.

---

## Migration Failed

**Symptoms**: A migration errors out partway through, or a feature that depends on a new table/column doesn't work after you believed migrations were complete.

**Likely cause**: A dependency wasn't met (e.g., ran a root `database-*.sql` file before `migrations/000-complete-database-setup.sql`), or — as found during the final pre-launch review — one of the 5 non-numbered migration files at the end of `MIGRATION_ORDER.md` was skipped because it wasn't obviously part of the numbered sequence.

**Diagnosis**: Read the specific SQL error — it names the missing relation/column. Cross-check `MIGRATION_ORDER.md` against what's actually been run (`select * from information_schema.tables where table_schema='public'` to see what exists, compared against what each migration file is supposed to create).

**Resolution**: Every migration is idempotent (`IF NOT EXISTS` guards) — simply run the missing/failed file in the correct order rather than trying to hand-write a fix. See `DISASTER-RECOVERY.md` §7 for a genuinely broken (not just missed) migration.

**Prevention**: Follow `MIGRATION_ORDER.md` exactly, including the 5 additional files at the end — this exact gap was found and fixed in the final pre-launch review specifically because it's easy to miss.

---

## Database Connection (errors/timeouts)

**Symptoms**: Intermittent or total failure to load data, errors mentioning connection timeouts or "too many connections."

**Likely cause**: Supabase project paused (Free tier auto-pauses after inactivity — a common first-launch surprise), a genuinely expired/rotated `SUPABASE_SERVICE_KEY` not yet updated in Vercel, or real concurrent load exceeding your plan's connection limit.

**Diagnosis**: Supabase Dashboard — is the project shown as active/paused? Check Vercel's function logs for the specific connection error message. Check whether `SUPABASE_SERVICE_KEY` was recently rotated (`DISASTER-RECOVERY.md` §5).

**Resolution**: Un-pause the project if paused (and consider upgrading off the Free tier before launch specifically to avoid this). Update and redeploy with the current service key if it was rotated. If it's genuine load, this is a plan-upgrade decision, not a code fix.

**Prevention**: Don't launch on Supabase's Free tier if you can avoid it — the auto-pause behaviour is the single most common "why is production down" surprise for a small-team first launch.

---

## Slow Performance

**Symptoms**: Pages or searches take noticeably longer than expected.

**Likely cause**: At the "thousands of records" scale this project was designed for, genuine performance problems should be rare — the tables you'd expect to be large (Awards, Organisations, Entries, Winners) all use real server-side pagination, not client-side filtering of a fully-loaded dataset. The most likely real cause at moderate scale is the `ILIKE '%term%'` search pattern on organisation/entry names not being index-accelerated (a known, documented characteristic, not a bug — see `RELEASE-CANDIDATE-SIGNOFF.md` §8).

**Diagnosis**: Supabase Dashboard → Database → Query Performance — identify the specific slow query. Check whether it's a search (expected to be somewhat slower without a trigram index at higher volume) versus something else entirely (which would be a genuine, different problem worth investigating on its own merits).

**Resolution**: For search specifically: adding a `pg_trgm` GIN index on the searched column(s) is the targeted fix, tracked as a Version 1.1 item — not urgent at launch volume, worth doing once real usage approaches tens of thousands of rows. For anything else identified as slow: investigate the specific query rather than assuming it's the known search characteristic.

**Prevention**: Watch Query Performance as part of the monthly check in `OPERATIONS-MANUAL.md` — catch a genuinely new slow query pattern early rather than after it's affecting real users at scale.
