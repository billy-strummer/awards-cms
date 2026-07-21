# Operations Manual

The recurring-task companion to `ADMIN-GUIDE.md` (which explains *how* to use each screen). This document is about *when* and *in what order* — the cadence of actually running an awards programme on this CMS.

---

## Daily Checks

_Takes under 5 minutes once part of routine._

1. **Dashboard tab** — glance at the KPI cards and the activity feed for anything unexpected (a sudden spike or drop in entries, a failed-looking activity).
2. **Notifications bell** (top right) — clear anything actionable.
3. **Entries tab** — if nominations are currently open, check for new submissions needing review/status changes. Don't let entries sit in "Submitted" indefinitely — a stale queue is the #1 way an awards programme loses nominee trust.
4. **If Payments are active this period**: Payments tab → check for new invoices or overdue balances.
5. Skim the browser console isn't something you can do daily without technical access — see `MONITORING.md` for how error monitoring (Sentry) replaces the need to manually check for this.

## Weekly Checks

1. **Organisations tab** — spot-check a few records for completeness (missing email/phone flags exist on the Dashboard's "incomplete profiles" widget — use it rather than manually scanning).
2. **Judge Portal progress** (if judging is active) — Assignments tab, check judging completion rate. Chase judges who haven't started if a deadline is approaching (Reports & Analytics has judge progress reporting).
3. **CRM > Communications** — confirm follow-ups flagged "required" from the past week have actually happened.
4. **Media Gallery** — clear any untagged photos flagged on the Dashboard widget.
5. **Backups** — confirm your backup job actually ran (see `DEPLOYMENT-GUIDE.md` §13 and `DISASTER-RECOVERY.md`'s RPO note — this project has no in-app automated backup scheduler, so "weekly" backups only happen if a human or an external cron actually triggers them).

## Monthly Checks

1. **Settings → Users** — review the team list. Deactivate anyone who's left. Confirm role assignments still match real responsibilities.
2. **Reports & Analytics** — run the month's revenue/entries/winners report, compare year-on-year using the Compare feature.
3. **Payments → Financial Reports** — reconcile against your actual bank/Stripe records.
4. **Storage usage** — Supabase Dashboard → Storage, confirm you're not approaching your plan's limit.
5. **Dependency/security check** (technical owner) — `npm audit` in the repository, review anything new.

## Annual Award Preparation

This is the big recurring cycle this whole system exists to support. Roughly in order, spread across the months leading up to the ceremony:

### 1. Import or create the new award year
- **If awards repeat year-to-year** (most common): use each award's **Clone to Year** action (Awards tab → row action menu → "Clone to Year") rather than recreating categories from scratch. This copies the award's structure (name, sector, region) into a new Draft award for the target year, and logs the clone in the audit trail. Do this once per repeating award, not in bulk, so you can review each one.
- **If this is a genuinely new award category**: Awards tab → **Add Award** → fill in name, year, sector, region, set status to Draft.

### 2. Set the season's open/close dates
Settings → Seasons & Areas tab → create or edit the season for the new year, setting nomination open and close dates. This is what "opening" and "closing" nominations actually means operationally — the CMS enforces these dates against the public submission form (`submit-entry.html`), not a manual per-award toggle.

### 3. Review Award Areas coverage
If this year's programme covers new counties/cities/regions, confirm the Award Areas master list (permanent, doesn't need annual re-creation) already covers them — it should, since it's the authoritative UK county/city/borough list, not year-specific.

### 4. Open nominations
- Move each award's status from Draft → **Active** once ready (Awards tab, status dropdown per row, or bulk via Tools menu).
- Confirm the season's open date (§2) has actually arrived, or entries submitted before it may be rejected by validation.
- Announce via Marketing (email campaign / social scheduling) once live.

### 5. Monitor entries during the open window
Daily checks (above) apply with extra attention. Watch entry volume against your expected pipeline — a big gap from prior years is worth investigating early, not at the deadline.

### 6. Close nominations
- At the season's close date, either let the system-enforced deadline handle it, or manually flip award status if you need to close early/extend.
- Move awards to whatever "judging" phase your process uses (the Phase field on each award tracks this).

### 7. Judging workflow
1. **Assignments tab** — assign entries to judges. Use the automation if configured (judge availability/conflict-of-interest aware assignment), or assign manually for smaller programmes.
2. Judges log into **Judge Portal** (`judge-portal.html`) with their own credentials and blind-score assigned entries.
3. Monitor completion via Reports & Analytics' judge progress view (weekly checks, above).
4. Once judging is complete for an award, generate the shortlist (Winners tab → Pipeline, or the award's Shortlist action) — review the AI-vetting flags if enabled before finalizing.

### 8. Publishing winners
Winners move through a deliberate pipeline — **do not skip steps**, especially consent:
1. **Pending** — winner record created (manually, via CSV import, or promoted from judging).
2. **Notified** — you've told the winner privately.
3. **Pack Sent** — winner information pack / next steps sent.
4. **Confirmed** — winner has confirmed acceptance.
5. **Published** — status flip that makes the winner visible on public pages (`public-winners.html`). **Record GDPR consent before this step, not after** — the Consent checkbox exists specifically to gate this responsibly.

### 9. Post-ceremony
- Certificates: generate via Winners tab bulk action (`api/certificates-qr.js`) once all winners are Published.
- Event check-in/attendance data (if you ran a ceremony through the Events tab) — export for your records.
- Send thank-you / feedback communications via Marketing.

### 10. Archive the completed award year
- Once the year's cycle is fully wrapped up (winners published, no more edits expected), move awards to **Archived** status. Archived awards stay fully visible and queryable (nothing is deleted) but are excluded from active-award counts and filtered out of the default "Active" views, keeping next year's working views uncluttered.
- Archiving is per-award, not a single "close out the year" button — work through the Awards tab, filtering by the completed year, and archive each one (or use the bulk Tools action if archiving many at once).

### 11. Set up next year
Loop back to step 1 — this is exactly what makes "Clone to Year" valuable: next year's award creation is mostly repeating step 1 against the now-archived awards, not starting from a blank form.

---

## A note on what's manual vs. automatic

Scheduled email reminders, judging-deadline shortlist generation, weekly judge progress reports, weekly stats, overdue-payment reminders, scheduled email campaign dispatch, and GDPR retention cleanup now run automatically once a day via Vercel Cron (see `DEPLOYMENT-GUIDE.md` §11 and `RELEASE-REPORT-V1.md` §11) — this was a known gap in an earlier pass, since fixed. **This depends on `CRON_SECRET` being set in your Vercel environment variables** (see `ENVIRONMENT-VARIABLES.md`) — without it, the cron job fires but the endpoint fails closed (500) and nothing runs. Check Vercel's Cron Jobs log (or Observability → Logs, filtered to `api/judge-automation`) if you're ever unsure whether the daily tick actually ran — every invocation logs a structured summary of what it did.

Steps above involving manual actions (opening/closing nominations, moving award status, publishing winners) are intentionally manual — they're editorial decisions an administrator makes, not automation gaps.
