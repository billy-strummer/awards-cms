# Monitoring Recommendations

What to monitor, and the cheapest reasonable way to monitor it, given this project's actual stack (Vercel + Supabase + Resend + Stripe) rather than generic advice. Prioritized by what would actually go unnoticed without it.

---

## Already available at zero extra cost (turn these on first)

| Signal | Where | Setup needed |
|---|---|---|
| **Server errors** (uncaught exceptions in `api/*.js`) | Vercel Dashboard → your project → Logs (real-time), or Vercel's Runtime Logs | None — already capturing, just needs someone to look. Set up a saved filter for `error` level. |
| **Browser-side JS errors** | **Sentry** — was found broken this pass (SDK loaded, never initialized) and fixed; see `DEPLOYMENT-GUIDE.md` §11 | Set `SENTRY_DSN`, redeploy. Free tier (5k errors/month) covers a project this size comfortably. |
| **Database errors, slow queries** | Supabase Dashboard → Database → Query Performance / Logs | None — built into every Supabase plan, including Free. |
| **Authentication failures** | Supabase Dashboard → Authentication → Logs | None — built in. |
| **Storage usage** | Supabase Dashboard → Storage (usage bar), or Settings → Billing for the account-wide total | None — built in. Set a calendar reminder to check monthly (see `OPERATIONS-MANUAL.md`) since Supabase doesn't proactively alert until you're already over. |
| **API latency / function duration** | Vercel Dashboard → your project → Observability tab (Function Duration, Error Rate) | None on Hobby; more retention/detail on Pro. |
| **Deployment failures** | Vercel automatically emails the account owner on a failed build | None — but confirm the right person's email is on the Vercel account. |

**Action item**: if nobody is currently looking at Vercel Logs or Supabase's Auth/Database logs regularly, that's the single highest-value, zero-cost fix available — the data already exists, it's just not being watched.

---

## Worth setting up (low cost, real gap today)

| Signal | Recommendation | Cost |
|---|---|---|
| **Email delivery failures** (bounces, complaints, sends that never went out) | Resend Dashboard has delivery status per email already; wire up the bounce/complaint webhook described in `DEPLOYMENT-GUIDE.md` §7 so failures land in `email_suppressions` instead of silently retrying forever. | Free (Resend's free tier includes webhooks) |
| **CSV import failures** | The CSV importers already validate and report row-level errors to the user in real time (per `CMS-AUDIT-TODO.md`'s findings) — the gap is a *silent* failure (e.g. a partial batch insert failing server-side) going unnoticed if nobody's watching. Once Sentry is live (above), wrap the batch-insert code paths in `api/data-proxy.js`'s CSV-related operations with explicit `Sentry.captureException` calls if they don't already surface through the general error handler. | Free (covered by Sentry once live) |
| **Uptime / "is the site even up"** | [UptimeRobot](https://uptimerobot.com) free tier: 50 monitors, 5-minute checks, email/SMS alert on downtime. Point it at your production URL and at one representative API route (e.g. a lightweight GET that doesn't require auth). | Free |
| **Unexpected traffic spikes** | Vercel's Observability tab shows request volume; set up a simple daily-glance habit (or, on Vercel Pro, configure a spend/usage alert so a spike that could blow through Hobby's rate limits or a paid plan's included quota doesn't surprise you on the invoice). | Free (Hobby) / included (Pro) |
| **Backup verification** | Nothing currently confirms backups actually ran (see `DISASTER-RECOVERY.md`'s RPO honesty note). Cheapest fix: a scheduled reminder (calendar or a free cron service like [cron-job.org](https://cron-job.org)) that pings a human to manually verify the latest Supabase backup/PITR checkpoint timestamp looks recent. | Free |

---

## Worth considering once the project has real revenue/scale (not needed for launch)

| Signal | Recommendation | Cost |
|---|---|---|
| **Structured application logging** | Right now, server-side logs are whatever `console.log`/`console.error` produces in `api/*.js`, viewable only in Vercel's raw log stream. A structured logging service ([Axiom](https://axiom.co) has a generous free tier and integrates directly with Vercel Log Drains) makes searching/alerting on specific error patterns much easier at higher volume. | Free tier available; paid beyond a few GB/month |
| **Real user monitoring (page load performance)** | Sentry's free tier includes basic performance monitoring once the DSN is live (already configured with `tracesSampleRate: 0.2` in `app.js`) — no extra setup needed, just keep an eye on it once you have real traffic. | Included in Sentry free tier |
| **Database connection pool exhaustion** | Only relevant once you have concurrent load Supabase's dashboard doesn't already surface clearly — Supabase's own Database → Reports tab covers this once you're watching it regularly (see the "already available" section above) before reaching for a third-party tool. | Free (built into Supabase) |

---

## What NOT to do

- Don't add a new monitoring *service* that requires its own SDK embedded in the frontend before Sentry (already wired up, zero marginal frontend cost) is actually being used. Get value out of what's already fixed before adding more surface area.
- Don't build custom monitoring dashboards inside the CMS itself — that's scope creep against this phase's explicit instruction (no new functionality beyond production fixes) and duplicates what Vercel/Supabase/Sentry already do for free.

---

## Minimum viable monitoring checklist for launch

If you only do four things before going live:
1. Set `SENTRY_DSN` (§ above, `DEPLOYMENT-GUIDE.md` §11) — this alone covers browser errors and a meaningful chunk of "is anything broken right now."
2. Set up the Resend bounce/complaint webhooks (`DEPLOYMENT-GUIDE.md` §7) — email silently failing is the hardest kind of failure to notice on your own.
3. Add a free UptimeRobot monitor on your production URL.
4. Put a recurring calendar reminder on the weekly/monthly checks already listed in `OPERATIONS-MANUAL.md` — most of the signals above already exist for free in Vercel/Supabase dashboards, and the only missing piece is a human looking at them on a schedule.
