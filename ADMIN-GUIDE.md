# British Trade Awards CMS — Administrator Guide (v1.0)

This is the reference guide for running the entire British Trade Awards platform through the CMS, written for a non-technical administrator. Every task described here is done through the CMS interface — none require database access.

**Keep this file in sync with the software.** Whenever a CMS workflow changes, update the matching section here in the same commit.

---

## 1. Getting Started

### Logging in
Go to your CMS URL and sign in with the email and password a Super Admin gave you. If you don't have an account yet, ask a Super Admin to invite you (see [Section 11: User Management](#11-user-management)).

**Forgotten your password?** Click **"Forgot password?"** on the sign-in page, enter your email, and you'll receive a reset link (check your spam folder if it doesn't arrive within a few minutes). This works for your own account regardless of role — you don't need a Super Admin to reset it for you. Clicking the link takes you to a page to set a new password, then straight back to sign in.

### Your role determines what you see
The sidebar only shows tabs you have permission to use. Your role is shown next to your name in the top-right corner. Seven roles exist:

| Role | Typical use |
|---|---|
| **Super Admin** | Full access, including User Management |
| **Admin** | Full access except User Management |
| **Editor** | Create and edit awards, organisations, entries, winners, marketing |
| **Viewer** | Read-only — can look at everything, change nothing |
| **Judge** | Signs in through a separate Judge Portal, not this main CMS — only sees entries assigned to them |
| **Marketing** | Email, social media, banners, sponsors |
| **Finance** | Payments, invoices, financial reports |

If a button doesn't do anything or shows a permissions error, that's your role working as intended — ask a Super Admin to change your role if you need more access.

### The Dashboard
Your home screen shows total awards, organisations, winners, and upcoming events at a glance. Use the date filters (All Time / This Month / This Quarter / This Year) to change what the numbers cover.

---

## 2. Award Areas (the master list of counties, cities & London boroughs)

**You never create counties or cities by hand.** The full list of every UK county, city, and London borough already exists as a permanent CMS record, seeded once and shared by every part of the system — Awards, Organisations, CSV imports, the public site's region picker.

Open **Award Areas** in the sidebar to see the master list: Area name | Type (county/city/borough) | Entries count | Status | Action.

To manage or add a genuinely new area, go to **Settings > Seasons & Areas**.

---

## 3. Importing Nominees — the one correct way

**Award Areas is the only place a CSV import creates real, publishable nominees.** If you're bringing in a list of companies to compete for an award, this is where you do it — nowhere else.

### Step by step
1. Open **Award Areas**.
2. Find the county/city/borough you're importing for (use the search box if the list is long).
3. Click **Upload CSV** on that row (it becomes **Replace CSV** once you've imported once).
4. Select your file — CSV or Excel (.xlsx/.xls) both work. Your file should have columns for: Company Name, Award Category, Email, Contact Name, Phone, Website, Notes (the importer detects common header variations automatically — "Company", "Organisation", "Business Name" all work for the company column, for example). Any other columns are read but ignored, including any "Region" column — the county/area a nominee is filed under always comes from which Award Area row you clicked, never from the file.
5. **Validation runs automatically before anything is imported.** You'll see a clear list of any problems, each tied to a row number:
   - Missing required columns
   - Unknown award categories (the category name must match an existing category exactly — this prevents accidental duplicate categories)
   - Duplicate rows — the same company nominated in the same category twice. A company nominated in *different* categories on different rows is expected and not flagged.
   - Invalid email addresses
   - Missing organisation names
6. **Nothing is imported until every error is fixed.** Fix your file and re-upload, or fix the specific rows flagged.
7. Once validation passes, choose how to handle companies that already exist in the system: **Skip** (leave existing records untouched — still creates a new entry if this row is a new category for that company), **Update Existing** (fill in blanks on the existing record), or **Replace Existing** (overwrite existing values).
8. Click **Upload & Publish**. This is instant — there is no separate "publish" step. The moment the import completes, the organisations, entries, and awards it created are live on the public site. Large files upload in batches with a progress indicator.

### What actually gets created
For every valid row, the import creates (or reuses) all three of:
- An **Organisation** record (the company)
- An **Award** record (matched by category + area + year — never duplicated if it already exists)
- An **Entry** record (the actual nomination, linking the organisation to the award, status "shortlisted")

### After importing
- The Award Areas table updates immediately to show "Imported" status and the correct nominee count for that area.
- Check the **Entries** tab — your new nominees appear there for review/shortlisting.
- Check the public voting page for that category — your nominees are visible immediately.

---

## 4. Organisations — Add Contacts in Bulk (a different tool — read this carefully)

The Organisations tab has its own **"Add Contacts in Bulk"** button. **This is not for importing nominees.** It only adds bare company records to your contact list (for prospecting, outreach, or building a CRM list before you know which award category they'll enter) — it does not create an Entry or link to an Award. If you use it expecting your CSV to produce nominees, they will not appear anywhere on the public site, because no Entry was ever created.

Use it only when you genuinely want to add companies to your contacts without entering them into an award yet. For anything else — always use Award Areas (Section 3).

To manually add or edit a single organisation, use the **Add Organisation** button and the on-screen form — the same country/area cascading select used everywhere else in the CMS.

---

## 5. Managing Awards, Categories & Years

Open **Awards** in the sidebar.

- **Add Award** opens a form: Category Name, Year, Country → Area (cascading select), Sector, Status, key dates (entry open/close, judging, voting, winners announcement), previous year's results, and description.
- The system prevents duplicate awards — the same category + area + year combination can't be created twice. If you see "already exists," search for it instead of re-creating it.
- Use the **status dropdown** directly in the table row for a quick status change (Draft → Pending → Published → Active → Archived) without opening the full edit form.
- The **"⋮" menu** on each row gives you: Manage Nominees, Edit Award, View Details, Timeline, Clone to Year (duplicate this award into a new year automatically), Audit Log, and Delete.
- **Deleting an award** warns you if it has linked entries and will orphan them — read that warning carefully. Deletion shows an "Undo" option in the confirmation toast if you change your mind immediately after.

---

## 6. Reviewing Entries & Publishing Winners

### Entries tab
Every nominee (whether imported via Award Areas or entered by an organisation directly) appears here. Change an entry's status inline: Under Review → Shortlisted → Winner → Rejected. Moving an entry to **Winner** requires a confirmation click (this is deliberate — it's a meaningful, semi-permanent decision).

**Important:** marking an entry "Winner" records the judging outcome but does **not** automatically create a public Winner record. That's a deliberate two-step process — see below.

### Winners tab
This is where a Winner becomes public. You can:
- **Add a winner manually**
- **Import winners in bulk via CSV**
- **Promote a shortlisted nominee from Assignments** — the recommended path once judging is complete

Each winner record moves through its own status pipeline: **Pending → Notified → Pack Sent → Confirmed → Published**. Nothing is visible on the public site until status reaches **Published** — this gives you a safe staging step to add photos, a winner story, and a judge quote before announcing.

Before publishing a winner's name or photo, record their **GDPR consent** using the checkbox on their row.

---

## 7. Organisations, Judges & Sponsors

- **Organisations**: full CRUD via the table — search, filter by country/area/sector, edit, or archive (archiving is reversible and never deletes data; you can restore any archived organisation from the "Show Archived" filter).
- **Judges**: judges sign in through a separate portal at `/judge-login.html`, not the main CMS. To make someone a judge, invite them with the **Judge** role via **Settings > Users** (see Section 11). Assign entries to judges via the Awards tab's "Manage Nominees" / Assignments feature. Judging is blind — judges never see the company name until after they submit their score.
- **Sponsors**: managed under **Marketing** — add sponsor logos, tiers, and enquiry tracking.

---

## 8. Marketing, Media & Public Pages

- **Marketing** tab: email campaigns (drag-drop builder), email lists, templates, banners, sponsor management, press releases, and social media scheduling.
- **Media Gallery**: upload and organise photos/videos, toggle "published" to control what's visible on the public site.
- **Settings > General**: your programme's name, logo, and colour scheme — these apply site-wide immediately.

---

## 9. Events

Manage registrations, check-in (with QR codes), seating plans, running order, and attendee tracking — all under the **Events** tab.

---

## 10. Payments

Under **Payments**: view and create invoices, record manual payments, and Stripe checkout integration for online payment. Financial reports are under **Reports**.

---

## 11. User Management (Super Admin only)

Go to **Settings > Users**. This tab is only visible to Super Admins.

- **Invite User**: enter their email and pick a starting role. They receive a real email with a sign-in link and set their own password on first login.
- **Change Role**: use the dropdown directly in their row. You can't demote yourself away from Super Admin from here — ask another Super Admin if you genuinely need to.
- **Disable / Reactivate**: the lock icon toggles a user's ability to sign in. This is fully reversible and never deletes their account or data.
- **Reset Password**: sends the user a password reset email.
- **Status column**: shows Active, Invited (pending — they haven't completed setup yet), or Disabled.

You cannot disable your own account from this screen (a safety guard to prevent accidental lockout).

**Self-service password reset**: every user — any role, not just Super Admin — can recover their own account via **"Forgot password?"** on the sign-in page (see Section 1). This uses Supabase Auth's own `resetPasswordForEmail`/`updateUser` functions directly, the same native mechanism used everywhere else in this app's authentication — no separate password-recovery system, no admin action required. A Super Admin's **Reset Password** button in this section remains useful for prompting a specific user to change their password (e.g. after a suspected compromise) by sending them the same reset email on their behalf.

---

## 12. Security & Integrations

Go to **Settings > Security** for:
- **Two-Factor Authentication (2FA)**: add an authenticator-app (TOTP) second factor to your own account for extra login security. Optional, but recommended for every Admin/Super Admin account.
- **Login History**: click Refresh to see recent sign-in activity for your account.

Go to **Settings > Integrations** for:
- **Outbound Webhooks**: notify an external system (e.g. a Zapier/Make automation, or your own internal tool) when data changes in the CMS. Add a webhook URL, choose which events trigger it, and review recent delivery attempts in the log underneath.

---

## 13. Troubleshooting

**"Failed to save: Role 'X' cannot ... on 'Y'."** — this is the system correctly blocking an action your role doesn't permit. It's not a bug; ask a Super Admin if you believe you should have access.

**A write action fails with a generic error, or a Settings section shows "Error loading ... : Settings section timed out."** — this usually means a temporary network hiccup or the system being under heavy load. Wait a few seconds and retry (re-click the tab). If it persists, check your internet connection first, then contact support.

**A CSV import won't proceed past validation.** — the error list tells you exactly which rows and columns are wrong, with row numbers. Fix your source file and re-upload; nothing partial is ever saved until every row passes.

**I imported nominees but they're not showing up anywhere.** — you almost certainly used the Organisations tab's "Add Contacts in Bulk" instead of Award Areas. See Section 4. There's no way to "convert" a contact-only import into nominees after the fact — re-import the same data through Award Areas.

**I can't find the Users tab.** — it's Super Admin only. Ask a Super Admin to either promote your role or make the change on your behalf.

**I forgot my password.** — click "Forgot password?" on the sign-in page (Section 1). No need to ask a Super Admin unless the reset email never arrives after checking spam — in that case, check SMTP is configured correctly, or ask a Super Admin to trigger the same reset email for you from Settings > Users.

---

## 14. Best Practices

- Always let **Award Areas** validate a CSV fully before fixing errors one-by-one — the full list saves you re-uploading repeatedly.
- Use **Skip** as your duplicate-handling default unless you specifically intend to overwrite existing organisation data — **Replace Existing** cannot be undone.
- Publish winners only once you're ready — status stays private (Pending/Notified/Pack Sent/Confirmed) until you explicitly move it to **Published**.
- Record GDPR consent before publishing a winner's name or photo, not after.
- When inviting a new team member, start them at the lowest role that lets them do their job (Editor rather than Admin, Viewer rather than Editor) — you can always raise their role later from Settings > Users.
- If you're about to bulk-import thousands of records, do a small test batch (5–10 rows) in one area first to confirm your CSV's column headers map correctly, before running the full file.

---

*This guide covers CMS v1.0. Update it whenever a described workflow changes.*

*Reviewed against a final commercial-polish pass on the live system: no workflow described above changed. That pass fixed silent display bugs only (a couple of stats that could show a misleading "0", and count labels like "1 winners" now correctly reading "1 winner") — see `RELEASE-REPORT-V1.md` Section 9 for the full list.*

*Reviewed again against a final acceptance test covering the full administrator and public-visitor journey — see `FINAL-ACCEPTANCE-REPORT.md`. That pass restored a genuinely missing "Add Winner" feature (Section 6) and added this Section 12 to document 2FA/Login History/Webhooks, which already existed but were never written up.*

*Closed out the two remaining open items from that acceptance test — see `PRODUCTION-SIGNOFF-FINAL.md`: self-service password recovery is now real (Sections 1, 11, 13), and the three orphaned public pages it flagged (`award_companies.html`, `award-nominees.html`, `company-profile.html`) have been removed rather than left in a broken state — they were never linked from anywhere in the live product.*
