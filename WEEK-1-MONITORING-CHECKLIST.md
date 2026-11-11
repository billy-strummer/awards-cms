# Week 1 Daily Monitoring Checklist

More intensive than the steady-state checks in `OPERATIONS-MANUAL.md` (which cover the ongoing daily/weekly/monthly cadence once things have settled) — this is specifically for the first 7 days after launch, when you're building confidence that everything works unattended, not just when you're watching it.

Copy this into a fresh checklist each day for the first week. Takes 10–15 minutes once you know where to look.

---

## Day ___ — Date ___

### Application Errors
- [ ] Sentry Dashboard — any new issues since yesterday? (Zero is the expected, healthy state.)
- [ ] If Sentry isn't set up yet: Vercel Dashboard → Logs, filtered to `error` level — any unexpected entries?

### Failed Jobs
- [ ] Vercel → Cron Jobs — did today's scheduled invocation run? Check its status and timestamp.
- [ ] Open the invocation's response/log — confirm every task in the `results` object shows `"status": "ok"`. Any `"status": "error"` needs investigating today, not "eventually" — see `TROUBLESHOOTING-GUIDE.md`'s "Cron not running" entry if the job didn't fire at all.

### Failed Emails
- [ ] Resend Dashboard → check delivery status for anything sent in the last 24 hours — any bounces or complaints?
- [ ] If you've wired up the bounce/complaint webhooks (`DEPLOYMENT-GUIDE.md` §7), check the `email_suppressions` table for new entries and understand why each one landed there.

### Storage Usage
- [ ] Supabase Dashboard → Storage — check the usage bar. This only needs a glance on days with meaningful upload activity (logo uploads, entry attachments) — don't worry about checking this if nothing was uploaded.

### API Errors
- [ ] Vercel → Observability → Function Duration / Error Rate — any function showing an elevated error rate compared to the previous day?

### Slow Queries
- [ ] Supabase Dashboard → Database → Query Performance — sort by duration, check if anything new and slow appeared. In week 1 with real but modest data volume, nothing here should be alarming; this is about building the habit of checking, not expecting problems yet.

### Backups
- [ ] Supabase Dashboard → Database → Backups — confirm a backup/PITR checkpoint exists with a recent timestamp. **Do this every day in week 1** even though it becomes a weekly check later (`OPERATIONS-MANUAL.md`) — you want to catch a broken backup process in its first week, not its first month.

### Authentication Failures
- [ ] Supabase Dashboard → Authentication → Logs — any repeated failed login attempts from the same account/IP that look like more than normal user error (could indicate a locked-out real user needing help, or something worth a closer look)?

### CSV Imports
- [ ] If you imported data today (see `FIRST-COUNTY-IMPORT-GUIDE.md`), re-confirm the specific verification steps in that guide — don't rely on "it said success" alone.

### User Feedback
- [ ] Check whatever channel your real admins/judges use to reach you (email, Slack, a support inbox) — anything reported that didn't show up in the technical checks above? User-reported issues are often the fastest signal for problems your monitoring doesn't cover yet (confusing wording, a workflow that's technically working but unclear).

---

## End of Week 1

- [ ] Look back across all 7 days' worth of checks — anything that appeared more than once? A one-off is noise; a repeat is a pattern worth investigating even if each individual day looked fine.
- [ ] Confirm you're ready to relax the cadence to `OPERATIONS-MANUAL.md`'s steady-state daily/weekly/monthly checks — if anything above still feels uncertain, keep the daily cadence a second week rather than stepping down prematurely.
- [ ] Review `TROUBLESHOOTING-GUIDE.md` once, cold, even if you haven't needed it yet — better to know where it is before you need it under pressure.
