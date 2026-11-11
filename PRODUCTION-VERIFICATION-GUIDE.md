# Production Verification Guide

Once `PRODUCTION-DEPLOYMENT-PLAN.md`'s 11 steps all pass, work through this guide against your real production URL, logged in as a real (not test) Super Admin account. Do this before importing any real data (see `FIRST-COUNTY-IMPORT-GUIDE.md` for that next step) — the goal here is confirming the platform itself is sound, using whatever placeholder/empty state it's in immediately after deployment.

Check each box as you go. If anything fails, stop and fix it before continuing — later checks assume earlier ones passed.

---

## A. CMS

### Login
- [ ] Load the production URL — the login page renders with correct branding (logo, colours).
- [ ] Log in with your real Super Admin credentials.
- [ ] Confirm you land on the Dashboard, not an error page.
- [ ] Log out, confirm you're returned to the login page (not left on a broken authenticated view).

### Dashboard
- [ ] KPI cards render (Total Awards, Total Organisations, Total Winners, Total Entries) — expect zeros or small numbers if this is a fresh production database, not an error state.
- [ ] Activity feed loads without an error (empty is fine on a fresh database).
- [ ] Getting Started banner appears (expected on a database with no/little data yet).
- [ ] No red error banners or stuck spinners anywhere on the page after ~5 seconds.

### Awards
- [ ] Awards tab loads, shows an empty state (fresh database) or your existing awards.
- [ ] Create a test award (name, year, sector, region), confirm it appears in the list immediately.
- [ ] Edit that test award, confirm the change saves and persists after a page refresh.
- [ ] Delete the test award — confirm the confirmation dialog appears before deletion, and the award is actually removed.

### Award Areas
- [ ] Tab loads and shows all 118 counties/cities/boroughs — this is a permanent, pre-seeded master list, not something you create per-deployment. If it's empty or shows an unexpected count, your migrations (Step 2 of the deployment plan) didn't run fully — go back and check.

### Organisations
- [ ] Tab loads (empty state expected on fresh production).
- [ ] Create a test organisation, confirm it appears in the list.
- [ ] Upload a logo for it — confirm the upload succeeds and the image displays (this exercises Storage from Step 8 of the deployment plan for real, not just a raw file upload test).
- [ ] Edit and then archive the test organisation — confirm it moves to the archived view rather than being hard-deleted.

### Entries
- [ ] Tab loads (empty state expected).
- [ ] If you have a test award and organisation, manually add a test entry, confirm it appears with the correct default status.
- [ ] Change its status through at least one transition, confirm the change is confirmed (irreversible transitions should prompt).

### Winners
- [ ] Tab loads (empty state expected).
- [ ] Add a test winner manually, move it through Pending → Notified → Pack Sent → Confirmed → Published.
- [ ] Confirm the GDPR consent checkbox is available and the UI treats it as a deliberate step before publishing (not required by the system to proceed, but present as a reminder — see `ADMIN-GUIDE.md`).
- [ ] After publishing, check the public website (§B below) to confirm it actually appears there.
- [ ] **Delete this test winner and test entry/organisation/award before real data import** — do not leave test records in the production database once verification is complete.

### Sponsors
- [ ] Accessible under Organisations (sponsor tier fields) or CRM depending on your workflow — confirm sponsor-tier data can be set and saved on a test organisation.

### Judges
- [ ] Settings → Users: send a test invite to an email address you control, using the **Judge** role.
- [ ] Confirm the invite email arrives (this is your real end-to-end test of Step 4's SMTP configuration, not just a dashboard setting).
- [ ] Accept the invite, confirm the judge can log in via `judge-login.html` (a separate login path from the main admin CMS) and reaches the Judge Portal.
- [ ] Remove/deactivate this test judge account before real launch if it was only for testing.

### Media
- [ ] Media Gallery tab loads (empty state expected).
- [ ] Upload a test photo, confirm it displays and can be linked to the test organisation/winner created above.

### Reports
- [ ] Reports & Analytics tab loads without error.
- [ ] Confirm the Total Entries stat is accurate even without visiting the Entries tab first in this session (this was a real bug fixed in an earlier pass — worth specifically re-confirming once in production).

### Settings
- [ ] General/Branding: confirm your real company name, logo, and colours are set (not placeholders).
- [ ] Seasons & Areas: create your first real season with correct open/close dates for the year you're launching.
- [ ] Security: confirm 2FA/GDPR settings match your intended policy.
- [ ] Users: confirm your real team's roles are set correctly (see Authentication section below).
- [ ] Integrations: confirm webhook/API settings show as configured where expected.
- [ ] Data & Backup: familiarize yourself with the export options here before you need them under pressure.

---

## B. Public Website

Do these checks in a private/incognito browser window (no admin session) to see exactly what a real visitor sees.

### Homepage
- [ ] Loads at your real domain root, correct branding, no console errors (check browser DevTools).
- [ ] "Back to Home" / navigation links all resolve correctly.

### Categories
- [ ] Award categories (if published) display correctly with correct names/sectors.

### County Pages
- [ ] If your programme organises by county, confirm county pages load and show the correct area name.

### Organisation Pages
- [ ] The test organisation you published (if any) has a working public profile page.
- [ ] Open Graph tags render correctly when you view page source (`<meta property="og:image">` should be an **absolute** URL, e.g. `https://yourdomain.com/...` — this was a real bug found and fixed in the final pre-launch review; re-confirm it didn't regress with your real `APP_URL`).

### Winner Pages
- [ ] The test winner you published above appears on `public-winners.html`.
- [ ] Its photo/story (if added) displays correctly.

### Search
- [ ] Known gap, not a regression to chase: `public-winners.html` currently has no search/filter UI at all (confirmed during the final pre-launch review). Confirm this matches your expectations for launch — it's tracked as a Version 1.1 item, not something to debug as broken.

### Filters
- [ ] Same as Search, above.

### SEO
- [ ] View page source on the homepage and winners page — confirm `<title>` and `<meta name="description">` are correct and not placeholder text.
- [ ] No `<link rel="canonical">` tag exists anywhere on the public site currently (known, pre-existing gap, not new) — acceptable for launch, tracked as future SEO work.

### Open Graph
- [ ] Paste your real production homepage and winners-page URLs into a link-preview debugger (e.g. Facebook's Sharing Debugger, or simply share the link in a private Slack/Discord channel to see the preview) — confirm the image and description render correctly, not broken/missing. This directly re-verifies the `og:image` absolute-URL fix with your real domain rather than the sandbox's test values.

---

## C. Authentication

### Login
- [ ] Already covered in §A — re-confirm specifically that a **wrong password** shows a clear error rather than a crash or silent failure.

### Password Reset
- [ ] From the login page, trigger "Forgot Password" for your own real admin account.
- [ ] Confirm the reset email arrives (via your configured SMTP, Step 4).
- [ ] Complete the reset, confirm you can log in with the new password.

### User Invitation
- [ ] Already exercised in §A's Judges check — if you haven't yet, invite one real non-judge team member (e.g. an Editor) and confirm the same end-to-end flow: invite sent → email arrives → account activated → correct role applied.

### Role Permissions
- [ ] Log in as a non-Super-Admin role (Editor, Viewer, etc. — use the test account from above, or a role-appropriate second account) and confirm:
  - Restricted tabs (e.g. Settings → Users) are hidden or inaccessible.
  - Attempting a restricted action via direct interaction shows a clear permission error, not a silent failure or crash.

---

## D. Automation

### Cron
- [ ] Already covered in Step 6 of the deployment plan — re-confirm here specifically that the Vercel Cron Jobs dashboard shows at least one successful invocation with today's date.

### Emails
- [ ] Confirm at least one of each email type your launch depends on has been sent and received for real: invite (§C), password reset (§C), and — if you published a test winner — a winner-related notification if your workflow triggers one automatically.

### Scheduled Tasks
- [ ] Check the cron invocation's logged summary (Vercel Observability → Logs, filtered to `api/judge-automation`) — confirm the `results` object shows every attempted task as `"status": "ok"`, and that the right subset ran for today's day of week (weekly tasks like judge progress reports/weekly stats only run on Monday; retention cleanup only on Sunday — don't expect to see those on other days, that's correct behaviour, not a bug).

---

## Before moving to real data import

- [ ] Every box above is checked.
- [ ] All test records created during this verification (test award, organisation, entry, winner, judge invite) are deleted or clearly marked as test data, so they don't contaminate your first real import or public site.
- [ ] Proceed to `FIRST-COUNTY-IMPORT-GUIDE.md`.
