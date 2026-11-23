# Version 1.0 Launch Checklist

Print this page. Work through it top to bottom before announcing the system publicly. Full detail for any item lives in the referenced document — this page is the at-a-glance tracker, not the instructions themselves.

| ☐ Task | ☐ Verified | Notes |
|---|---|---|
| **Backups & Migrations** | | |
| Manual backup taken of any existing production data | ☐ | `PRODUCTION-DEPLOYMENT-PLAN.md` Step 1 |
| All migrations run in `MIGRATION_ORDER.md` order, including the 5 additional files at the end and migration 077 | ☐ | Step 2 — the `award_seasons` table and RLS coverage on `email_logs`/`judge_conflicts`/`sponsorships` specifically depend on this |
| RLS confirmed enabled *and effective* on every table (not just "enabled" — check for leftover permissive policies too) | ☐ | Step 2's 3-part verification query |
| **Environment & Configuration** | | |
| Every variable in `ENVIRONMENT-VARIABLES.md` set in Vercel, real production values | ☐ | Step 3 |
| `CRON_SECRET` generated and set | ☐ | Required for automation to run at all |
| `APP_URL` set to the real production domain | ☐ | Not the code's placeholder fallback |
| `FROM_EMAIL`/`FROM_NAME` set to a domain verified in Resend | ☐ | |
| Custom SMTP configured in Supabase Auth | ☐ | Step 4 — required before any real user invite |
| **Deployment** | | |
| Vercel deployment shows "Ready", no build errors | ☐ | Step 5 |
| Cron job registered and first invocation shows `"success": true` | ☐ | Step 6 |
| Supabase Auth Site URL / Redirect URLs point at production domain | ☐ | Step 7 |
| All 4 Storage buckets exist with correct public/private policies | ☐ | Step 8 |
| DNS records added and propagated | ☐ | Step 9 |
| Domain shows "Valid Configuration" in Vercel | ☐ | Step 10 |
| HTTPS works with a valid certificate; HTTP redirects | ☐ | Step 11 |
| **CMS Verification** (`PRODUCTION-VERIFICATION-GUIDE.md` §A) | | |
| Login / logout works with real Super Admin credentials | ☐ | |
| Dashboard loads, no error banners or stuck spinners | ☐ | |
| Awards: create / edit / delete test record works | ☐ | |
| Award Areas: all 118 counties/cities/boroughs present | ☐ | If wrong, migrations didn't fully run |
| Organisations: create / logo upload / archive works | ☐ | |
| Entries: create and status-transition works | ☐ | |
| Winners: full pipeline (Pending → Published) works | ☐ | |
| Judge invite → email arrives → judge can log in via `judge-login.html` | ☐ | Real SMTP end-to-end test |
| Media upload and linking works | ☐ | |
| Reports: Total Entries stat accurate without visiting Entries tab first | ☐ | Regression check for a previously-fixed bug |
| Settings: real branding, seasons, users all correctly configured | ☐ | |
| All test records deleted before real data import | ☐ | Do not skip this |
| **Public Website Verification** (`PRODUCTION-VERIFICATION-GUIDE.md` §B) | | |
| Homepage loads, correct branding, no console errors | ☐ | |
| Published test winner appears on `public-winners.html` | ☐ | |
| `og:image` renders as an absolute URL (view page source) | ☐ | Regression check for a previously-fixed bug |
| Link-preview debugger shows correct image/description | ☐ | Real domain, not sandbox test values |
| Title / meta description correct, not placeholder text | ☐ | |
| **Authentication Verification** (`PRODUCTION-VERIFICATION-GUIDE.md` §C) | | |
| Wrong password shows a clear error, not a crash | ☐ | |
| Password reset round-trip works end-to-end | ☐ | |
| A second real user invited and role-verified | ☐ | |
| Non-Super-Admin role correctly restricted (server-side, not just hidden UI) | ☐ | |
| **Automation Verification** (`PRODUCTION-VERIFICATION-GUIDE.md` §D) | | |
| Cron Jobs dashboard shows a successful invocation with today's date | ☐ | |
| At least one real invite / reset email received | ☐ | |
| Cron's logged task summary shows every attempted task `"status": "ok"` | ☐ | |
| **First Data Import** (`FIRST-COUNTY-IMPORT-GUIDE.md`) | | |
| Award categories created before import | ☐ | |
| Season open/close dates set | ☐ | |
| First county CSV validated cleanly and imported | ☐ | |
| Organisations / Entries / Categories / County / Public site / Search / Filters / SEO all verified for this county | ☐ | Full checklist in the guide |
| Decision made: proceed to remaining counties, or fix issues first | ☐ | Do not import the rest until this county is fully correct |
| **Monitoring Ready** | | |
| `SENTRY_DSN` set, error reporting confirmed working | ☐ | |
| Resend bounce/complaint webhooks configured | ☐ | `DEPLOYMENT-GUIDE.md` §7 |
| Free uptime monitor (e.g. UptimeRobot) pointed at production URL | ☐ | |
| `WEEK-1-MONITORING-CHECKLIST.md` printed/ready for day 1 | ☐ | |
| **Known, Accepted Gaps** (confirm you're OK launching with these, not fixing them now) | | |
| No search/filter UI on `public-winners.html` | ☐ acknowledged | Tracked as V1.1, not a launch blocker |
| No canonical URL / structured data on public pages | ☐ acknowledged | Pre-existing SEO opportunity, not a defect |
| 6 live-credential checks (`CMS-AUDIT-TODO.md` §10) still need real-world confirmation | ☐ acknowledged | Cannot be verified from a sandbox |
| Company name placeholder in public footers | ☐ resolved / ☐ acknowledged | Needs your real registered company name |

---

**Do not announce publicly until every row above is checked** (or explicitly acknowledged as an accepted gap, for the final section). Once complete, proceed to `WEEK-1-MONITORING-CHECKLIST.md` for day 1.
