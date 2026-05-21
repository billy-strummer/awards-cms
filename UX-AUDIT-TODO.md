# UX/UI Audit — Implementation To-Do

**CLAUDE: Read this file at the start of every session. Work through items in priority order (Critical → High → Medium → Low). Mark each item `[x]` immediately after it is fully implemented, tested, and committed. Never mark an item complete unless the change is in a committed and pushed git commit.**

Last audit: 2026-05-07 (original items — all complete)
Seventeenth audit: 2026-05-20 (comprehensive 5-agent audit — see V17 section at bottom)
Second audit: 2026-05-07 (new deep audit — see V2 section below)
Third audit: 2026-05-07 (post-structural-fix audit — see V3 section below)
Sixth audit: 2026-05-08 (international awards business first-run UX audit — see V6 section below)
Seventh audit: 2026-05-14 (top-to-bottom professional CMS audit — see V7 section below)
Fourteenth audit: 2026-05-14 (deep tab-by-tab audit with 7 parallel agents — see V14 section below)
Fifteenth audit: 2026-05-14 (follow-up suggestions from V14 review — see V15 section below)
Sixteenth audit: 2026-05-20 (5-agent comprehensive audit: business logic, workflows, accessibility, mobile, terminology, first-run — see V16 section below)
Branch: `claude/bta-location-restructure-JS5hX`

---

## How to use this file

- `[ ]` = Not started
- `[~]` = In progress / partially done
- `[x]` = Complete (committed + pushed)
- Each item includes the affected file(s) and what "done" looks like

---

## CRITICAL — Blocks or severely impairs core operations

### C1 — Award cloning ("Duplicate for next year")
- **Files:** `awards.js`, `index.html`
- **What to build:** Add a "Duplicate" button on each award row (and in the award detail modal). Clicking opens a small modal asking for the target year. Copies all fields except status (sets to Draft) and clears winner/nominee counts.
- **Done when:** User can duplicate an award to a new year in 2 clicks from the awards table.
- [x] Implemented

### C2 — Bulk award creation via CSV import
- **Files:** `awards.js`, `index.html`
- **What to build:** Add "Import Awards CSV" button to Awards tab toolbar. Reuse the existing CSV import pattern from Organisations. Required columns: award_name, year, sector, status. Show preview before import.
- **Done when:** User can upload a CSV of 50 awards and they appear in the table.
- [x] Implemented

### C3 — Duplicate detection for Organisations
- **Files:** `organisations.js`
- **What to build:** When saving a new organisation, check for existing records with similar name (case-insensitive, strip "Ltd/Limited/PLC"). If match found, show warning modal "Possible duplicate: [name]. Add anyway?" with link to existing record.
- **Done when:** Creating "Acme Limited" when "Acme Ltd" exists triggers a warning.
- [x] Implemented

### C4 — Duplicate detection for Awards
- **Files:** `awards.js`
- **What to build:** When saving a new award, check for existing award with same `award_name` + `year`. Show inline warning if match found.
- **Done when:** Creating "Best Builder 2025" when it already exists shows a warning.
- [x] Implemented

### C5 — GDPR consent flag on Winners
- **Files:** `winners.js`, `index.html`
- **What to build:** Add a "Consent" boolean column to the winners table view. Add checkbox "Winner consents to use of name & image" in the winner edit modal. Show a warning badge on rows where consent is not recorded.
- **Done when:** Each winner row shows consent status; unconsented winners are flagged.
- [x] Implemented

### C6 — Unsaved changes warning on form navigation
- **Files:** `app.js` or `utils.js`
- **What to build:** When a modal form has been modified and the user tries to close it or navigate away, show a Bootstrap confirmation modal: "You have unsaved changes. Leave anyway?"
- **Done when:** Editing an award form, clicking the X or navigating away triggers the warning.
- [x] Implemented

### C7 — Bulk operation undo (last action)
- **Files:** `utils.js`, `index.html`
- **What to build:** After any bulk action (status change, archive, delete), show a toast with an "Undo" button for 8 seconds. Store the previous state in memory. On Undo click, revert the changes via the data proxy.
- **Done when:** Bulk-archiving 5 orgs shows "Archived 5 organisations. Undo" toast that works.
- [x] Implemented

### C8 — Progress indicators for long operations
- **Files:** `organisations.js`, `winners.js`, `awards.js`, `utils.js`
- **What to build:** Add a reusable `utils.showProgress(label, percent)` / `utils.hideProgress()` helper. Use it in: CSV import (after each batch), bulk logo fetch, bulk export, bulk email send. Show as a fixed bottom progress bar.
- **Done when:** Importing a 100-row CSV shows a progress bar incrementing as rows process.
- [x] Implemented

---

## HIGH — Significantly degrades usability

### H1 — Active filter chips on all filtered tables
- **Files:** `awards.js`, `winners.js`, `entries.js`, `payments.js`
- **What to build:** After applying filters, render chip tags below the filter bar ("Year: 2025 ×", "Status: Active ×"). Clicking × removes that filter. Already partially implemented in organisations.js — reuse that pattern.
- **Done when:** Filtering awards by Year + Status shows two removable chips.
- [x] Implemented

### H2 — Pagination "Page X of Y" totals
- **Files:** `awards.js`, `organisations.js`, `winners.js`, `entries.js`
- **What to build:** Update `utils.renderServerPagination()` (or each module's pagination render) to show "Page 1 of 12 (573 records)" next to the page controls.
- **Done when:** Awards table pagination shows total page count and record count.
- [x] Implemented

### H3 — Tab badge counts refresh on data change
- **Files:** `app.js`, `dashboard.js`
- **What to build:** After any create/update/delete operation, call `updateTabCounts()` to refresh the red badge numbers on the sidebar nav items. Hook into the post-save callbacks in each module.
- **Done when:** Adding an award increments the Awards badge count without a page reload.
- [x] Implemented

### H4 — Award status workflow visual indicator
- **Files:** `awards.js`, `index.html`
- **What to build:** Add a small horizontal stepper (Draft → Pending → Active → Archived) to the award detail modal header. Highlight the current step. Allow clicking a step to transition status (with confirmation).
- **Done when:** Opening an award in "Pending" status shows the stepper with Pending highlighted.
- [x] Implemented

### H5 — Dashboard activity feed panel
- **Files:** `dashboard.js`, `index.html`
- **What to build:** Add an "Activity Feed" card to the dashboard (below the KPI row). Calls `loadActivityFeed()` which already exists. Shows last 20 actions (created award, updated organisation, sent email, etc.) with timestamps and user names.
- **Done when:** Dashboard shows a live activity feed card with recent CMS actions.
- [x] Implemented

### H6 — Dashboard date range filter
- **Files:** `dashboard.js`, `index.html`
- **What to build:** Add a date range selector to the dashboard header (Today / This Week / This Month / This Year / Custom). All KPI cards re-query using the selected range.
- **Done when:** Switching to "This Month" updates all stat cards to show current-month data.
- [x] Implemented

### H7 — Search term highlighting in table results
- **Files:** `awards.js`, `organisations.js`, `winners.js`, `utils.js`
- **What to build:** Add a `utils.highlightMatch(text, query)` helper that wraps matched characters in `<mark>`. Call it when rendering table cells for name/title columns when a search query is active.
- **Done when:** Searching "acme" in Organisations bolds "Acme" in every matching row.
- [x] Implemented

### H8 — Certificate generator button on winner rows
- **Files:** `winners.js`, `index.html`
- **What to build:** Add a certificate icon button (bi-award) directly in the winner table row actions (alongside the existing Edit/Delete buttons). Clicking opens the certificate generator modal pre-populated with that winner's data.
- **Done when:** Each winner row has a certificate button that opens the generator in 1 click.
- [x] Implemented

### H9 — Email merge tag reference panel
- **Files:** `email-builder.js`, `index.html`
- **What to build:** Add a collapsible "Available Merge Tags" panel in the email composer and bulk email modal. List all supported tags: {{company_name}}, {{contact_name}}, {{award_name}}, {{award_year}}, {{entry_number}}, {{invoice_number}}, {{event_date}}, {{unsubscribe_link}}.
- **Done when:** Composing a bulk email shows a "Merge Tags" reference panel nearby.
- [x] Implemented

### H10 — Dunning automation for overdue invoices
- **Files:** `payments.js`, `index.html`
- **What to build:** Add a "Set up auto-reminders" button in the Invoices tab. Opens a modal to configure: Reminder 1 (X days after due), Reminder 2 (Y days), Final notice (Z days). Store settings, trigger reminders via existing email automation.
- **Done when:** User can configure 3-step overdue reminder sequence that fires automatically.
- [x] Implemented

### H11 — Inline entry status editing
- **Files:** `entries.js`
- **What to build:** Replace the status text in the entries table with a Bootstrap dropdown (`<select class="form-select form-select-sm">`) that saves on change. No modal needed for a status-only change.
- **Done when:** Changing entry status in the table row saves immediately without opening a modal.
- [x] Implemented

### H12 — VAT calculation on invoices
- **Files:** `payments.js`, `index.html`
- **What to build:** Add VAT rate field (0%, 5%, 20%) to invoice creation form. Calculate and display subtotal + VAT + total. Store vat_rate and vat_amount on the invoice record.
- **Done when:** Creating an invoice with £1000 at 20% VAT shows £200 VAT and £1200 total.
- [x] Implemented

### H13 — Companies House lookup for Organisations
- **Files:** `organisations.js`, `index.html`
- **What to build:** Add a "Lookup" button next to the Organisation Name field in the add/edit modal. Calls Companies House API (free, no key needed for basic search) to return company name, registered address, SIC code, and status. Pre-fills matching fields.
- **Done when:** Typing a company name and clicking Lookup fills in address and sector fields.
- [x] Implemented

### H14 — Conflict of interest tracking for Judges
- **Files:** `assignments.js`, `index.html`
- **What to build:** Add a "Conflicts" tab or panel to the judge assignment modal. Allow admins to record "Judge X cannot score Organisation Y" relationships. Flag assignments that violate conflicts with a warning badge.
- **Done when:** Assigning a judge to an entry from their own company shows a conflict warning.
- [x] Implemented

### H15 — Event attendee management
- **Files:** `events.js`, `index.html`
- **What to build:** Add an "Attendees" sub-tab or panel to the event detail modal. Show RSVP list with columns: Name, Organisation, Role, RSVP Status, Check-in Status. Add "Check In" button per row and a bulk "Export Attendee List" button.
- **Done when:** Opening an event shows an attendee list with check-in capability.
- [x] Implemented

---

## MEDIUM — Confusing or incomplete but workable

### M1 — CRM deal pipeline custom stages
- **Files:** `crm.js`, `index.html`
- **What to build:** Add a "Manage Stages" button in the Deal Pipeline sub-tab. Opens a modal to add/rename/reorder/delete pipeline stages. Stages stored in settings table.
- **Done when:** User can rename "Stage 1" to "Proposal Sent" and it reflects in the Kanban.
- [x] Implemented

### M2 — CRM communication timeline per organisation
- **Files:** `crm.js`, `organisations.js`, `index.html`
- **What to build:** In the organisation detail modal, add a "History" tab showing all CRM communications, meetings, and notes for that org in chronological order.
- **Done when:** Opening an organisation shows its full interaction history in one view.
- [x] Implemented (pre-existing: `loadUnifiedTimeline` / `orgActivityTimeline`)

### M3 — Smart segments AND/OR rule logic
- **Files:** `crm.js`, `index.html`
- **What to build:** Upgrade the smart segment rule builder to support multiple conditions with AND/OR operators. Add "Add condition" button that appends a new field/operator/value row. Add an AND/OR toggle between conditions.
- **Done when:** User can build "Sector = Construction AND Region = London AND Status = Active".
- [x] Implemented

### M4 — Calendar as default Events view
- **Files:** `events.js`, `index.html`
- **What to build:** Make the calendar view the default when opening the Events tab. Move the "List View" toggle to a secondary button. Persist the user's last-used view in localStorage.
- **Done when:** Opening Events shows the calendar; toggling to list and refreshing remembers preference.
- [x] Implemented

### M5 — Reporting: charts and visualisations
- **Files:** `reporting.js`, `index.html`
- **What to build:** Add Chart.js (already likely in project or add via CDN). Add bar charts for: entries per sector, winners per region, revenue per month. Add a pie chart for award status breakdown. Render below the existing report table.
- **Done when:** The Reporting tab shows at least 3 charts that update when filters change.
- [x] Implemented (pre-existing: `renderSectorChart`, `renderRegionChart`, etc. in `reporting.js`)

### M6 — Reporting: PDF and Excel export
- **Files:** `reporting.js`, `index.html`
- **What to build:** Add "Export PDF" and "Export Excel" buttons to the reporting tab. PDF uses browser print with a print stylesheet. Excel uses SheetJS (already in package.json if present, otherwise add).
- **Done when:** Clicking Export PDF opens print dialog; Export Excel downloads an .xlsx file.
- [x] Implemented

### M7 — Scheduled report delivery by email
- **Files:** `reporting.js`, `index.html`, `api/email-automation.js`
- **What to build:** Add a "Schedule Report" button. Opens modal: report type, frequency (weekly/monthly), recipient email(s). Stores schedule in settings. Email automation triggers the report on schedule.
- **Done when:** User can set "Email me the monthly revenue report on the 1st of each month".
- [x] Implemented (pre-existing: `reportsScheduler` module in `app.js`)

### M8 — Winner announcement scheduling
- **Files:** `winners.js`, `index.html`
- **What to build:** Add an "Announce on" date-time picker to the winner edit modal. When the scheduled time arrives (via automation scheduler), automatically update status to "Announced" and trigger announcement email.
- **Done when:** Setting an announce date updates the winner status automatically at that time.
- [x] Implemented

### M9 — Entry deadline enforcement
- **Files:** `entries.js`, `awards.js`, `index.html`
- **What to build:** Add `entry_deadline` date field to the award record. In the entries table, flag submissions past the deadline with an "Overdue" badge. Optionally block new public submissions past the deadline in `entry-proxy.js`.
- **Done when:** Awards with a past deadline show their entries flagged; new public submissions are blocked.
- [x] Implemented

### M10 — Email template thumbnail grid
- **Files:** `email-templates.js`, `index.html`
- **What to build:** Change the email templates list from a plain table to a card grid. Each card shows a small preview (first 200px of the template rendered in an iframe or screenshot), the template name, last modified date, and Use/Edit/Delete buttons.
- **Done when:** Email Templates tab shows a visual card grid instead of a plain list.
- [x] Implemented

### M11 — Email A/B subject line testing
- **Files:** `email-builder.js`, `index.html`
- **What to build:** Add an "A/B Test" toggle in the campaign send modal. When on, show two subject line inputs and a split % slider. Send version A to X% and version B to the rest. Record which performed better in the campaign log.
- **Done when:** User can create a campaign with two subject lines and a 50/50 split.
- [x] Implemented (pre-existing: `abTestEnabled` + `abTestSection` in `email-builder.js`)

### M12 — Sponsor tier visual badges
- **Files:** `organisations.js`, `marketing.js`, `index.html`
- **What to build:** Add a tier badge (Gold/Silver/Bronze/Partner with colour-coded styling) to sponsor organisation rows and the marketing sponsors section. Badge colour: Gold=#FFD700, Silver=#C0C0C0, Bronze=#CD7F32.
- **Done when:** Sponsor organisations show a coloured tier badge in the table and marketing section.
- [x] Implemented (pre-existing: `tierColors` in `organisations.js:845` + `getTierColor()` in `marketing.js`)

### M13 — Social media content calendar
- **Files:** `marketing.js`, `index.html`
- **What to build:** Add a "Content Calendar" sub-tab to Marketing. Shows a monthly calendar grid with scheduled posts as event blocks (colour-coded by platform). Clicking a block opens the post for editing.
- **Done when:** Marketing → Content Calendar shows a monthly view of all scheduled social posts.
- [x] Implemented

### M14 — Hashtag library for social posts
- **Files:** `marketing.js`, `index.html`
- **What to build:** Add a "# Hashtags" button in the social media post composer. Opens a panel with curated hashtag groups (Awards, Sectors, Locations). Clicking a hashtag appends it to the post.
- **Done when:** Composing a social post can insert hashtags from a library panel.
- [x] Implemented

### M15 — Meeting note templates in CRM
- **Files:** `crm.js`, `index.html`
- **What to build:** When logging a meeting, pre-populate the notes field with a template: "**Attendees:** \n**Key Points:** \n**Action Items:** \n**Next Steps:**". User can edit before saving.
- **Done when:** Adding a meeting pre-fills the notes with a structured template.
- [x] Implemented

### M16 — Settings: login activity audit log
- **Files:** `settings.js`, `index.html`, `auth.js`
- **What to build:** Add a "Login History" panel to Settings → Security sub-tab. Shows last 50 logins: date/time, user email, IP address, browser. Query from Supabase auth.audit_log_entries or a custom logins table.
- **Done when:** Settings → Security shows a table of recent login events.
- [x] Implemented

### M17 — Settings: per-user notification preferences
- **Files:** `settings.js`, `index.html`
- **What to build:** Add a "Notifications" section to Settings → General. Checkboxes for: "Notify me of new entries", "Notify me of overdue invoices", "Notify me of new organisations", "Daily digest email". Saved per user in localStorage or Supabase user metadata.
- **Done when:** User can toggle notification types and preferences persist across sessions.
- [x] Implemented

### M18 — Co-winner / runner-up support
- **Files:** `winners.js`, `index.html`
- **What to build:** Add a "Position" field to the winner record (Winner / Runner-Up / Highly Commended). Show position as a badge in the winners table. Allow multiple records per award year (one per position).
- **Done when:** An award can have a Winner, a Runner-Up, and a Highly Commended entry.
- [x] Implemented

### M19 — Data quality score on Dashboard
- **Files:** `dashboard.js`, `index.html`
- **What to build:** Add a "Data Quality" card to the dashboard showing: % of organisations with logos, % with email addresses, % of awards with nominees, % of winners with confirmed status. Each metric is a mini progress bar.
- **Done when:** Dashboard shows a data quality card with 4 progress indicators.
- [x] Implemented

### M20 — Organisation parent/subsidiary hierarchy
- **Files:** `organisations.js`, `index.html`
- **What to build:** Add a `parent_org_id` field to organisations. In the org edit modal, add a "Parent Organisation" searchable dropdown. In the org table, show a hierarchy icon if the org has a parent, with a tooltip showing the parent name.
- **Done when:** Organisation "Acme Electrical" can be linked as a subsidiary of "Acme Group".
- [x] Implemented (pre-existing: `organisation_relationships` table + `addRelationship` in org profile)

---

## LOW — Polish and refinement

### L1 — Colour-only status indicators: add icon fallback
- **Files:** `awards.js`, `organisations.js`, `winners.js`, `entries.js`
- **What to build:** Everywhere a status is shown as a colour badge only, add a small icon inside the badge. E.g. Active = green + `bi-check-circle`, Pending = yellow + `bi-clock`, Archived = grey + `bi-archive`. Ensures WCAG compliance.
- **Done when:** All status badges across all tabs show an icon alongside the colour.
- [x] Implemented

### L2 — Consistent loading states (skeleton loaders everywhere)
- **Files:** `utils.js`, all module JS files
- **What to build:** Audit all tabs — any that still use a plain "Loading..." text or spinner should use `utils.showSkeletonLoading()` instead. Ensure skeleton row count matches expected table columns.
- **Done when:** Every table shows a skeleton loader (not a spinner or text) while fetching data.
- [x] Implemented (payments invoices + payments table now use skeleton; other spinners are appropriate button/modal loaders)

### L3 — Sidebar collapse state persisted in localStorage
- **Files:** `app.js`, `index.html`
- **What to build:** When the user collapses/expands the sidebar, store state in `localStorage.setItem('sidebarCollapsed', true/false)`. On page load, apply the stored state before rendering.
- **Done when:** Collapsing the sidebar and refreshing keeps it collapsed.
- [x] Implemented (pre-existing)

### L4 — Sector filter: searchable dropdown
- **Files:** `awards.js`, `index.html`
- **What to build:** Replace the plain `<select>` sector filter on Awards with a searchable dropdown (Bootstrap's `tom-select` or a simple filtered list). Makes finding a sector fast when there are 50+ options.
- **Done when:** The sector filter has a search input that narrows the dropdown options as you type.
- [x] Implemented (`utils.makeSearchableSelect()` wraps the sector `<select>` with a live-filter input)

### L5 — Toast notifications: longer duration + action link
- **Files:** `utils.js`
- **What to build:** Increase success toast duration from 3s to 5s. Add an optional action link parameter (e.g. "View Invoice #1234") that navigates to the relevant record. Update all toast calls that have a clear navigation target.
- **Done when:** Creating a new award shows "Award created. View Award →" toast that lasts 5 seconds.
- [x] Implemented

### L6 — Required field indicators consistent across all forms
- **Files:** `index.html` (all modal forms)
- **What to build:** Audit all modal forms. Any required field that is missing the red asterisk `<span class="text-danger">*</span>` label should have one added. Also ensure `required` attribute is set on the input.
- **Done when:** All required fields across all modal forms are marked with a red asterisk.
- [x] Implemented (invoice, payment, event, season, media upload, gallery section, clone event, template forms all updated)

### L7 — Campaign log columns: responsive hide/show
- **Files:** `email-builder.js`, `index.html`
- **What to build:** On the email campaign log table, mark lower-priority columns (Bounced, Unsubscribed) as `d-none d-xl-table-cell` so they hide on smaller screens. Ensure the table is still usable at 1024px width.
- **Done when:** Email campaign log table shows without horizontal scroll on a 1024px screen.
- [x] Implemented

### L8 — Winner table: row highlight on checkbox selection
- **Files:** `winners.js`, `styles.css`
- **What to build:** Add a CSS rule and JS toggle: when a winner row checkbox is checked, add class `table-primary` to the `<tr>`. Remove it when unchecked.
- **Done when:** Checking a winner row highlights it in light blue; unchecking removes highlight.
- [x] Implemented

### L9 — Awards table: show "last modified" column
- **Files:** `awards.js`, `index.html`
- **What to build:** Add an optional "Modified" column to the awards table (hidden by default, toggleable via column visibility). Shows `updated_at` formatted as relative time ("2 days ago").
- **Done when:** Awards column visibility menu has a "Modified" option that shows the updated_at date.
- [x] Implemented

### L10 — Bulk action bar: visual hierarchy (destructive actions distinct)
- **Files:** `index.html`, `styles.css`
- **What to build:** In bulk action bars across all tabs, style destructive actions (Archive, Delete) as `btn-outline-danger` and separate them from non-destructive actions with a `|` divider. Currently all buttons look the same.
- **Done when:** Bulk action bars show Archive/Delete buttons in red, separated from other actions.
- [x] Implemented

---

## COMPLETED (V1 Audit — all items done)

*(Original V1 items C1–C8, H1–H15, M1–M20, L1–L10 are all committed and pushed)*

---

## ═══════════════════════════════════════════════
## V2 AUDIT — Deep UX Audit (2026-05-07)

## ═══════════════════════════════════════════════

> **CLAUDE: If any V2 items are still `[ ]`, start here before doing anything else.**
> Items are ordered strictly: V2-C → V2-H → V2-M → V2-L.
> Each item has a precise description of the file(s) and exact change needed.

---

## V2-CRITICAL — Broken right now, must fix first

### V2-C1 — Google Fonts blocked by CSP (Inter never loads)
- **Files:** `index.html`
- **Root cause:** `modern-theme.css` imports Inter via `@import url('https://fonts.googleapis.com/css2?family=Inter...')`. The `<meta http-equiv="Content-Security-Policy">` in `index.html` has `font-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com` — no `fonts.googleapis.com` or `fonts.gstatic.com`. Inter is silently blocked; the app falls back to system fonts.
- **Fix:** Add `https://fonts.googleapis.com https://fonts.gstatic.com` to the `font-src` directive in the CSP meta tag in `index.html`. Also add `https://fonts.googleapis.com` to `style-src` (Google Fonts injects a `<link>` stylesheet). The exact CSP attribute is on line 6 of `index.html`.
- **Done when:** DevTools Network tab shows Inter font files loaded (not blocked), and the app renders in Inter.
- [x] Implemented

### V2-C2 — Inline `<script>` may be blocked by CSP
- **Files:** `index.html`, `dashboard.js` (or `app.js`)
- **Root cause:** Lines 369–381 of `index.html` contain an inline `<script>` block for the Getting Started banner (reads/writes `localStorage`, wires dismiss click). The CSP `script-src` has no `'unsafe-inline'` — this may be blocked in strict browsers. Even if it runs, it is an anomaly (everything else is in module JS).
- **Fix:** Remove the inline `<script>` block entirely from `index.html`. In `dashboard.js`, add equivalent logic inside the `loadDashboard()` or `init()` function:
  ```javascript
  // Getting Started banner
  if (!localStorage.getItem('btaGettingStartedDismissed')) {
    document.getElementById('gettingStartedBanner')?.classList.remove('d-none');
  }
  document.getElementById('dismissGettingStarted')?.addEventListener('click', () => {
    document.getElementById('gettingStartedBanner')?.classList.add('d-none');
    localStorage.setItem('btaGettingStartedDismissed', '1');
  });
  ```
- **Done when:** The Getting Started banner still shows/dismisses correctly, but there is no `<script>` tag inside `index.html`'s dashboard tab pane.
- [x] Implemented

### V2-C3 — Universal `* { transition }` performance bomb
- **Files:** `modern-theme.css`
- **Root cause:** Line 55–57 of `modern-theme.css`:
  ```css
  * {
    transition: var(--transition-base);
  }
  ```
  This applies `transition: all 0.2s ease` to every element — `<html>`, `<body>`, `<table>`, SVG paths, every `<div>`, every `<span>`. Causes significant jank during tab switches and data loads, makes dark mode toggle animate the entire page background, and forces the browser to track property changes on all elements continuously.
- **Fix:** Delete those 3 lines entirely. Add targeted transitions only on interactive components that need them. Most are already defined on individual selectors (`.btn`, `.form-control`, `.card`, `.nav-link`, `.sidebar-nav-link`, etc.).
- **Done when:** No `* { transition }` rule exists in any CSS file. Verify dark mode toggle is still smooth (it has its own `body { transition: background-color }` rule in `styles.css`).
- [x] Implemented

### V2-C4 — Infinite pulse animation on stat values
- **Files:** `modern-theme.css`
- **Root cause:** Lines 524–527 of `modern-theme.css`:
  ```css
  .stat-value {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  ```
  Every KPI number on the dashboard pulsates for ever. Users interpret this as "still loading" or "there is a problem". It adds no informational value.
- **Fix:** Delete those 4 lines. If a load-complete animation is desired, use a one-shot `fadeIn` class applied programmatically after data loads (already defined as `.fade-in` in `styles.css`).
- **Done when:** Dashboard KPI numbers are static after loading — no breathing/pulsing.
- [x] Implemented

---

## V2-HIGH — Dramatic improvement available

### V2-H1 — Unified primary colour (blue vs purple split)
- **Files:** `styles.css`, `modern-theme.css`
- **Root cause:** Two competing primary colours are in use simultaneously:
  - `styles.css` defines `--primary-color: #0d6efd` (Bootstrap blue)
  - `modern-theme.css` defines `--bs-primary: #6366f1` (indigo)
  - Stat card values, row count badges, sidebar badges → Bootstrap blue
  - Navbar gradient, primary buttons, active tab underline → indigo/purple
  - This makes the app look like two different design systems were glued together
- **Fix:** Pick indigo (`#6366f1`) as the single primary. In `styles.css`:
  1. Change `--primary-color: #0d6efd` → `--primary-color: #6366f1`
  2. Change `--primary-color` hex fallbacks anywhere they appear as string literals (e.g. `rgba(13, 110, 253, ...)` → `rgba(99, 102, 241, ...)`)
  3. Verify `.stat-value { color: var(--primary-color) }` now renders indigo
  4. Verify `box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.15)` on focus is updated to match
- **Done when:** All interactive highlights, borders, badges, and the navbar use the same indigo colour family.
- [x] Implemented

### V2-H2 — Standardise filter bar across all tabs
- **Files:** `index.html`, `styles.css`
- **Root cause:** Awards, Winners, Entries, and Payments each render their filter bar with a different wrapper class/inline style. There is no canonical `.filter-bar` component.
  - Awards: `.filters-section` (class defined in styles.css) with position:sticky inline style
  - Winners: `<div class="rounded-2 p-3 mb-2" style="background:#f8f9fa;">`
  - Entries: `<div class="rounded-2 p-3 mb-3" style="background:#f8f9fa;border:1px solid #e9ecef;">`
  - Payments invoices: `.content-card mb-4`
- **Fix:**
  1. In `styles.css`, ensure `.filters-section` has the correct base styles (white bg, border, border-radius, padding, margin-bottom). Already defined — just verify.
  2. In `index.html`, update Winners and Entries filter wrappers from the inline-style `<div>` to use `class="filters-section"`. Remove inline `style=""` attributes.
  3. The Payments filter is inside `.content-card` which is fine — it can stay as `.content-card` since it is a content-area filter, not a sticky bar.
  4. If any of the Winners/Entries filter bars need sticky positioning, add the sticky inline style (or a `.filter-bar-sticky` class) consistently.
- **Done when:** Awards, Winners, and Entries filter bars visually match each other.
- [x] Implemented

### V2-H3 — Condense Awards filter bar (too many controls)
- **Files:** `index.html`, `awards.js`
- **Root cause:** The Awards filter row has 7 controls: Year (col-md-1), Status (col-md-2), Sector (col-md-2), Country (col-md-1), Region (col-md-2), County/City/Borough (col-md-2), and Search. At 1280px these are each ≈155px wide. The Country, Region, and Area controls are a cascade — you can only use Area if you've set Region, and Region only if you've set Country. They are used rarely compared to Year/Status/Sector.
- **Fix:** Collapse Country, Region, and Area into a single "Location" filter. Options:
  - Replace the three separate selects with a single `<select id="awardsLocationFilter">` that progressively reveals sub-options (simplest approach).
  - Or: put Country/Region/Area inside an "Advanced Filters" collapse section (a `<a data-bs-toggle="collapse">More filters</a>`) that shows/hides the extra three controls.
  - The collapse approach is lower risk. Add a "More filters ▾" link that toggles a second row containing Country, Region, and Area. The main row stays: Year, Status, Sector, Search.
- **Done when:** The primary Awards filter row has 4 controls (Year, Status, Sector, Search). Location filters are accessible behind "More filters" toggle.
- [x] Implemented

### V2-H4 — Hide Test Mode button in production
- **Files:** `app.js` (or `auth.js`)
- **Root cause:** `<div class="dropdown" id="testModeDropdown">` is always rendered in the navbar. It is shown to all admin users including in production, giving the impression of a debugging/broken state.
- **Fix:** In `app.js` after auth initialisation (or in the `showDashboard` function), add:
  ```javascript
  const isDevEnv = window.location.hostname === 'localhost' ||
                   window.location.hostname === '127.0.0.1' ||
                   window.location.search.includes('testMode=1');
  document.getElementById('testModeDropdown')?.classList.toggle('d-none', !isDevEnv);
  ```
- **Done when:** On `localhost`, Test Mode is visible. On any other hostname, it is hidden.
- [x] Implemented

### V2-H5 — Unify stats cards across tabs
- **Files:** `index.html`, `styles.css`
- **Root cause:** Three visual patterns for "stats card" exist:
  1. Dashboard: `.stat-card` — large card, giant icon top-right (opacity 0.15), 2.25rem value
  2. Entries/CRM: `.card.stats-card` — compact, coloured icon box left, 1.5rem value, no click chevron
  3. Payments: `.content-card text-center` — icon above number, no left decoration
- **Fix:** Keep `.stat-card` as the canonical pattern. Convert Entries stats cards to use `.stat-card` (possibly a `.stat-card-sm` variant for compact height). Update their HTML structure to match. The CSS for `.stat-card` already exists and is well-styled.
- **Done when:** Entries tab stats cards visually match the Dashboard stat cards (same border-radius, shadow, icon treatment, value size).
- [x] Implemented

### V2-H6 — Fix `#mainTabContent` premature closure (structural)
- **Files:** `index.html`
- **Root cause:** `#mainTabContent` closes at line 2494, after only 3 of 11 tab panes (dashboard, awards, organisations). The remaining 8 panes (winners, entries, media-gallery, events, reports, marketing, payments, crm, settings, bitcoin) are outside it. The CSS fix `.tab-pane:not(.active){display:none}` compensates but is fragile.
- **Fix:** Move the `</div>` that closes `#mainTabContent` (currently at line 2494) to after the closing `</div>` of the last tab pane (bitcoin, currently around line 6754). This requires carefully finding the right closing div. Use the following procedure:
  1. Find `<!-- /tab-pane#organisations -->` comment (around line 2490) — the `</div></div>` immediately before it closes organisations tab + a container.
  2. Find the line that closes `#mainTabContent` — it should be a lone `</div>` at depth 3→2 around line 2494.
  3. Remove that `</div>`.
  4. Add `</div><!-- /#mainTabContent -->` immediately after the closing `</div>` of the bitcoin tab pane (find `<!-- /tab-pane#bitcoin -->` or similar).
  5. Verify the HTML structure: `#appMain > #mainTabContent > [all 11 .tab-pane divs]`.
  6. The CSS workaround `.tab-pane:not(.active){display:none}` can be **removed** once the structure is correct (Bootstrap handles it natively).
- **Done when:** All 11 tab panes are direct children of `#mainTabContent`. The CSS workaround is removed. Tab switching still works correctly.
- [x] Implemented

### V2-H7 — Payments actions: declutter the filter row
- **Files:** `index.html`
- **Root cause:** The Payments → Invoices filter row last column (`col-md-2`) contains 4 actions: Create Invoice (btn-primary), Export dropdown, Reminders (btn-outline-warning), and Auto-Reminders (btn-outline-info). At <1400px this wraps or overflows.
- **Fix:**
  1. Move "Create Invoice" primary button to the table header area (alongside the table title "Invoices List"), mirroring how Awards places "Add Award" next to the table title.
  2. Merge Reminders + Auto-Reminders into the Export dropdown (or a new "Actions" dropdown) so the filter row's action area has only: Export dropdown + Create Invoice button.
- **Done when:** The Payments filter row has at most 2 action buttons. Create Invoice appears near the table heading.
- [x] Implemented

### V2-H8 — Hide Accounting Integration subtab until implemented
- **Files:** `index.html`
- **Root cause:** The Payments tab has an "Accounting Integration" nav-pill tab. If its content panel is a stub/placeholder, showing the tab creates a false expectation of a working feature.
- **Fix:** Check the content of `#accounting-content` in `index.html`. If it is empty or contains only placeholder text:
  1. Add `class="d-none"` to the `<li class="nav-item">` wrapping the Accounting Integration button.
  2. Or, if it has partial content: add a `<div class="alert alert-info"><i class="bi bi-info-circle me-2"></i>Coming soon — connect Xero, QuickBooks, or Sage.</div>` and keep the tab visible.
- **Done when:** Users cannot click into an empty Accounting Integration panel, or the panel shows a clear "coming soon" message.
- [x] Implemented

---

## V2-MEDIUM — Visible polish gaps

### V2-M1 — Dark mode: stat cards stay white (modern-theme.css wins over dark mode)
- **Files:** `styles.css`
- **Root cause:** `modern-theme.css` (loaded second) gives `.stat-card` the rule `background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)`. The dark mode override in `styles.css` sets `background-color: #2d2d2d`. Because `modern-theme.css` loads after `styles.css`, the gradient wins.
- **Fix:** In `styles.css`, update the dark mode stat-card override to use `background` (not `background-color`) to override the gradient:
  ```css
  body.dark-mode .stat-card {
    background: #2d2d2d !important;
    border-color: #404040;
    color: #fff;
  }
  ```
  Similarly audit other elements that `modern-theme.css` styles with a gradient `background` shorthand and ensure dark mode overrides also use the `background` shorthand.
- **Done when:** In dark mode, stat cards are dark (#2d2d2d), not white/light.
- [x] Implemented

### V2-M2 — Award Categories Reference: extracted to a data constant
- **Files:** `index.html`, `awards.js`
- **Root cause:** Lines 922–1480 of `index.html` are ~500 lines of hardcoded HTML listing 56 award sub-categories in a static accordion. New award types cannot be reflected here without manually editing the HTML.
- **Fix:** Extract the category data to a `AWARD_CATEGORIES` constant in `awards.js`. Write a `renderCategoryReference()` function that generates the accordion HTML from the constant and injects it into a placeholder `<div id="awardCatRefBody">`. This keeps the data in one place and makes the reference updatable without touching HTML.
- **Note:** This is a medium-effort refactor. Prioritise after the Critical and High items.
- **Done when:** `index.html` has no hardcoded category list. The accordion is rendered dynamically from `awards.js`.
- [x] Implemented

### V2-M3 — Entries status filter: remove compound value
- **Files:** `index.html`, `entries.js`
- **Root cause:** `<option value="submitted,under_review">Pending Review</option>` exposes implementation detail (comma-separated DB values) in the UI HTML.
- **Fix:**
  1. Change the option to `<option value="pending_review">Pending Review</option>`.
  2. In `entries.js` `filterEntries()` / `_buildServerFilters()`, translate `"pending_review"` → `["submitted", "under_review"]` for the DB query.
- **Done when:** The DOM option value is `"pending_review"`, not a comma-separated string. Filtering by "Pending Review" still returns submitted + under_review entries.
- [x] Implemented

### V2-M4 — Eliminate inline style proliferation (phase 1: filter labels)
- **Files:** `index.html`, `styles.css`
- **Root cause:** This inline style appears verbatim 4+ times across Awards, Winners, Entries filter bars:
  `style="font-size:0.8rem;letter-spacing:.04em;text-transform:uppercase;"`
  Similar repetition for filter label text: `style="font-size:0.8rem;"` on `<label>` elements.
- **Fix:**
  1. Add to `styles.css`:
     ```css
     .filter-bar-label {
       font-size: 0.8rem;
       letter-spacing: 0.04em;
       text-transform: uppercase;
     }
     .filter-bar-field-label {
       font-size: 0.8rem;
     }
     ```
  2. In `index.html`, replace all occurrences of the matching inline styles with the new classes.
- **Done when:** No `style="font-size:0.8rem"` or `style="font-size:0.8rem;letter-spacing..."` inline styles remain in filter bar sections.
- [x] Implemented

### V2-M5 — Document title updates on tab navigation
- **Files:** `app.js`
- **Root cause:** `document.title` is always "British Trade Awards Admin" regardless of active tab. Users with many browser tabs can't distinguish which section is open.
- **Fix:** In the `shown.bs.tab` event handler (wherever tab switches are handled in `app.js`), add:
  ```javascript
  const tabLabels = {
    dashboard: 'Dashboard', awards: 'Awards', organisations: 'Organisations',
    entries: 'Entries', winners: 'Winners', events: 'Events',
    payments: 'Payments', crm: 'CRM', reports: 'Reports',
    marketing: 'Marketing', settings: 'Settings'
  };
  document.title = `${tabLabels[tabId] || tabId} · BTA Admin`;
  ```
- **Done when:** Switching to the Awards tab updates browser tab title to "Awards · BTA Admin".
- [x] Implemented

### V2-M6 — Connection status: hide when connected
- **Files:** `styles.css` (or `app.js`)
- **Root cause:** The "Connected" status pill is always visible in the navbar, taking up space. It is only useful when showing a disconnection warning.
- **Fix:** In `app.js`, wherever connection status is updated: hide the `#connectionStatus` element when status is "connected", show it (with warning colour) only when disconnected. Or: use CSS `opacity: 0` (not `display:none`) so it still takes up space but is invisible — this prevents navbar layout shift on reconnect.
  ```javascript
  // When connected:
  connectionEl.style.opacity = '0';
  connectionEl.style.pointerEvents = 'none';
  // When disconnected:
  connectionEl.style.opacity = '1';
  connectionEl.style.pointerEvents = '';
  connectionEl.classList.remove('connected');
  connectionEl.classList.add('disconnected');
  ```
- **Done when:** Navbar shows no "Connected" pill during normal operation. A disconnection indicator appears when the connection drops.
- [x] Implemented

### V2-M7 — Getting Started banner: check for real data before showing
- **Files:** `dashboard.js`
- **Root cause:** The Getting Started banner shows based solely on `localStorage`. Admins who clear storage, or open the app in a new browser, see the onboarding checklist even when the system is fully set up with hundreds of records.
- **Fix:** In the banner initialisation logic (after V2-C2 is done and it's in `dashboard.js`), add a check:
  ```javascript
  const dismissed = localStorage.getItem('btaGettingStartedDismissed');
  const hasData = parseInt(document.getElementById('totalAwards')?.textContent || '0') > 0
               || parseInt(document.getElementById('totalOrgs')?.textContent || '0') > 0;
  if (!dismissed && !hasData) {
    document.getElementById('gettingStartedBanner')?.classList.remove('d-none');
  }
  ```
  Call this after KPI stats load, not before.
- **Done when:** A system with existing awards/orgs does not show the Getting Started banner, even in a fresh browser session.
- [x] Implemented

### V2-M8 — Remove imperceptible table row hover scale
- **Files:** `styles.css` or `modern-theme.css`
- **Root cause:**
  ```css
  .table-hover tbody tr:hover {
    transform: scale(1.005);  /* in modern-theme.css */
  }
  /* also in styles.css: */
  .table tbody tr:hover {
    transform: scale(1.001);
  }
  ```
  A 0.1–0.5% scale on a full-width table row is imperceptible to users but forces GPU compositing on every row hover. Remove both.
- **Fix:** Delete `transform: scale(1.001)` from `.table tbody tr:hover` in `styles.css`. Delete `transform: scale(1.005)` from `.table-hover tbody tr:hover` in `modern-theme.css`. The hover highlight background colour is sufficient.
- **Done when:** Table rows do not scale on hover. A simple background colour change remains.
- [x] Implemented

---

## V2-LOW — Small but worth fixing

### V2-L1 — Accessibility: `aria-hidden` on decorative filter label icons
- **Files:** `index.html`
- **Root cause:** All filter `<label>` elements contain `<i class="bi bi-calendar3 me-1"></i>` (and similar) with no `aria-hidden="true"`. Screen readers announce the icon name before every label: "calendar icon Year".
- **Fix:** Add `aria-hidden="true"` to every `<i>` icon that is inside a `<label>` element across all filter bars. Search for `<label` in `index.html` and audit each one.
- **Done when:** No decorative icons inside `<label>` elements lack `aria-hidden="true"`.
- [x] Implemented

### V2-L2 — Accessibility: sortable column headers need `aria-label`
- **Files:** `index.html`
- **Root cause:** Sort icon `<i class="bi bi-arrow-down-up">` inside table headers has no accessible text. Keyboard users cannot discover sortable columns.
- **Fix:** On each sortable `<th>`, add `aria-sort="none"` (changing to `"ascending"` / `"descending"` as sorted). On the sort icon `<i>`, add `aria-hidden="true"`. Add a visually-hidden `<span class="visually-hidden"> (click to sort)</span>` inside each sortable `<th>`.
- **Done when:** Sortable columns in Awards, Winners, Entries, Organisations tables have `aria-sort` attribute and screen-reader-readable sort affordance.
- [x] Implemented

### V2-L3 — Inconsistent shadow tokens (two systems)
- **Files:** `styles.css`, `modern-theme.css`
- **Root cause:** `styles.css` defines `--shadow-sm/md/lg/xl` used by components directly. `modern-theme.css` defines `--bs-box-shadow-sm/md/lg` (Bootstrap shadow overrides). Components using `var(--shadow-sm)` get one shadow; components using `var(--bs-box-shadow)` or Bootstrap utility classes get a different shadow.
- **Fix:** In `modern-theme.css`, add:
  ```css
  --shadow-sm: var(--bs-box-shadow-sm);
  --shadow-md: var(--bs-box-shadow);
  --shadow-lg: var(--bs-box-shadow-lg);
  ```
  This makes the custom tokens resolve to the modern-theme values, unifying both systems without changing component markup.
- **Done when:** All card/table shadows visually match each other regardless of which token the component uses.
- [x] Implemented

### V2-L4 — Sidebar group label taxonomy review
- **Files:** `index.html`
- **Root cause:** Current grouping:
  - "Programme" = Awards, Entries, Winners, Media Gallery
  - "People" = Organisations, CRM
  - "Commercial" = Events, Payments
  - "Intelligence" = Reports, Marketing ← Marketing ≠ Intelligence
- **Fix:** Move Marketing to "Commercial" (Events, Payments, Marketing). Rename "Intelligence" to "Analytics" or remove the group and put Reports under "System". This better reflects what each group does.
- **Done when:** Sidebar group labels accurately describe their contents. Marketing is not grouped under Intelligence.
- [x] Implemented

### V2-L5 — Empty Dashboard stats row (second row has 2 of 4 columns)
- **Files:** `index.html`
- **Root cause:** The "Events & Upcoming Stats" row defines 4 `col-md-3` slots but only 2 are visibly populated (Total Events, Upcoming Events). The other 2 appear to be absent or empty, leaving a visual gap.
- **Fix:** Either:
  - Add 2 more stat cards to the row (e.g. "Total Attendees" across all events, "Overdue Invoices" count with link to payments), OR
  - Change the existing 2 cards from `col-md-3` to `col-md-4` (or `col-md-6`) so they fill the row proportionally.
- **Done when:** The Events stats row has no empty columns — either all slots are used or cards are proportioned to fill the row.
- [x] Implemented

---

## Notes for Claude (V2)

- **Implementation order is strict**: V2-C items first, then V2-H, then V2-M, then V2-L.
- **V2-H6 (mainTabContent fix) is complex** — read the full description carefully and use a script to verify div depths before and after the change.
- **V2-C3 and V2-C4 are in `modern-theme.css`** — not `styles.css`. Don't confuse them.
- **V2-H1 colour change** — after changing `--primary-color`, search for all hardcoded `rgba(13, 110, 253` occurrences in `styles.css` and update to `rgba(99, 102, 241`.
- Always run `npm test` and `npm run build` after each commit. All 65 suites must pass.
- Commit message format: "Implements V2-C1, V2-C2" etc.
- Vercel 12-function limit still applies — no new `/api/` files.

---

## ═══════════════════════════════════════════════
## V3 AUDIT — Post-Structural Fix (2026-05-07)
## ═══════════════════════════════════════════════

> **CLAUDE: All V3 items are open. Work in order: V3-C → V3-H → V3-M → V3-L.**

---

## V3-CRITICAL — Broken right now

### V3-C1 — Scroll architecture: full-window scroll causes broken UX
- **Files:** `styles.css`
- **Root cause:** `.app-main` uses `min-height: calc(100vh - 56px)` with no `overflow` set, so the **entire browser window** scrolls (body scroll). The sidebar is `position: fixed`, the navbar is `sticky-top`. This means:
  1. Scrolling down on a long tab (CRM, Marketing) and then switching tabs keeps the scroll position — you land partway down a different tab's content.
  2. The sticky filter bars use `top: 56px` but with body scroll this sticks to the window top — if the navbar renders taller than 56px (it does: ~60px), the bar clips under the navbar bottom border.
  3. Short-content tabs (Bitcoin, Media Gallery) feel oddly tiny before JS loads.
- **Fix:**
  1. Change `.app-main` from `min-height` to a contained scroll area:
     ```css
     .app-main {
       height: calc(100vh - 60px);   /* replaces min-height */
       overflow-y: auto;
       scroll-behavior: smooth;
     }
     ```
  2. Change `.filter-bar-sticky { top: 56px }` → `top: 0` (now sticky relative to `.app-main`'s scroll container).
  3. Update `.app-sidebar`, `.app-layout`, and `.app-sidebar.collapsed + .app-main` to use `60px` instead of `56px` for all navbar-offset values.
  4. Add a `--navbar-height: 60px` CSS variable to `:root` and replace all hardcoded `56px` values in one pass.
- **Done when:** Switching tabs always shows the top of the new tab's content. Sidebar and navbar never scroll. Scroll is contained within `.app-main`.
- [x] Implemented

### V3-C2 — Media Gallery and Bitcoin tabs appear completely blank on first visit
- **Files:** `index.html`
- **Root cause:** Neither the Media Gallery nor Bitcoin tab-panes have any visible static HTML content below the page header. All their content is JS-rendered (gallery grid from `mediaGalleryModule.initialize()`, TradingView widget from `btcModule`). Before JS renders, both tabs show only a title and subtitle — the rest is white/blank.
- **Fix:** Add a visible loading placeholder inside each tab's main content container:
  - In Media Gallery: inside `#mediaGalleryContent` add `<div id="mediaGalleryLoadingState" class="text-center py-5 text-muted"><div class="spinner-border spinner-border-sm mb-2"></div><p class="small mb-0">Loading media…</p></div>`
  - In Bitcoin: inside the chart container div add `<div id="btcLoadingState" class="d-flex align-items-center justify-content-center" style="height:450px;"><div class="text-center text-muted"><div class="spinner-border mb-3"></div><p>Loading market data…</p></div></div>`
  - In `media-gallery-new.js` and `btc-module.js`, remove/hide the loading placeholder once real content renders.
- **Done when:** Media Gallery and Bitcoin tabs show a spinner while loading instead of blank white space.
- [x] Implemented

---

## V3-HIGH — Significantly degrades usability

### V3-H1 — Tab switch does not scroll to top
- **Files:** `app.js`
- **Root cause:** Switching tabs does not reset scroll position. After V3-C1 (scroll in `.app-main`), the `appMain` element retains scroll position between tabs. A user scrolled to the bottom of CRM will see the bottom of whatever tab they switch to.
- **Fix:** In the `shown.bs.tab` handler in `app.js` (around line 1714), add:
  ```javascript
  document.getElementById('appMain')?.scrollTo({ top: 0, behavior: 'instant' });
  ```
  Use `'instant'` not `'smooth'` to avoid visible scroll animation.
- **Done when:** Every tab switch places the user at the top of the new tab's content.
- [x] Implemented

### V3-H2 — Sticky filter bars on only 2 of 7 filtered tabs
- **Files:** `index.html`
- **Root cause:** Only Awards (L949) and Winners (L2179) have `filter-bar-sticky`. Organisations, Entries, Payments, CRM, and Reports all have filter bars that scroll away, forcing users to scroll back to the top to change filters on long tables.
- **Fix:** Add `filter-bar-sticky` class to the outermost filter wrapper div in each of these tabs:
  - Organisations main filter bar (in `#orgsMainContent`)
  - Entries filter bar
  - Payments Invoices filter row wrapper
  - Reports filter row
  (CRM has no standalone filter bar — skip for now.)
- **Done when:** All tabular content tabs keep their filter controls visible while scrolling the table.
- [x] Implemented

### V3-H3 — Sticky table `<thead>` overlaps sticky filter bar when both are present
- **Files:** `styles.css`
- **Root cause:** Awards, Winners, and Payments tables use `<thead class="sticky-top">`. After V3-C1, sticky elements are relative to `.app-main` scroll container. The `<thead>` with no explicit `top` value defaults to `top: 0` and slides under the filter bar when scrolling. Users see column headers disappear behind the filters.
- **Fix:** After V3-C1, add:
  ```css
  /* Place sticky thead below the sticky filter bar (~52px filter bar height) */
  .tab-pane .filter-bar-sticky + * table thead.sticky-top,
  .tab-pane table thead.sticky-top {
    top: 0;
  }
  ```
  Then for tabs WITH a sticky filter bar, the thead needs `top: [filter-bar-height]`. The cleanest approach: add a CSS variable `--filter-bar-height: 52px` and use it. Or: just remove `sticky-top` from `<thead>` elements and instead keep the filter bar sticky (most important UX win).
- **Done when:** Column headers in tables with sticky filter bars do not disappear under the filter bar when scrolling.
- [x] Implemented

### V3-H4 — Organisations sub-nav (All Orgs / Sponsors) uses custom JS show/hide, not Bootstrap tabs
- **Files:** `organisations.js`, `index.html`
- **Root cause:** The `#orgsSubNav` pills switch between All Organisations and Sponsors views via custom `showOrgsView()` / `showSponsorsView()` functions in `organisations.js`. This means the active pill is managed manually, the URL doesn't reflect sub-view, and it's a separate code path from the rest of the app's Bootstrap tab pattern.
- **Fix:** Wrap the two org views in proper tab-pane divs. Give the pills `data-bs-toggle="tab"` and `data-bs-target` attributes pointing to the panes. Remove the custom show/hide JS — Bootstrap handles it automatically.
- **Done when:** Orgs sub-nav works as Bootstrap tabs. Active pill updates automatically. No custom show/hide code required.
- [x] Implemented

### V3-H5 — Reports tab shows empty state on first visit even with data
- **Files:** `app.js`
- **Root cause:** The `shown.bs.tab` handler for Reports (line 1187 of app.js) calls `reportsAnalytics.loadAnalytics()` when tab is shown. But `reportingModule.generateReport()` — which populates the main report table — is only called when the user manually clicks a filter or generate button. On first visit the table body is empty even if there is data.
- **Fix:** In the Reports `shown.bs.tab` handler, also call `reportingModule?.generateReport()` on first visit (use a `let reportsInitialized = false` flag, set to `true` after first call).
- **Done when:** Opening Reports shows populated data on first click, not an empty table.
- [x] Implemented

### V3-H6 — Settings sub-tab state not preserved on page refresh
- **Files:** `app.js`, `settings.js`
- **Root cause:** When the URL hash is `#settings`, `app.js` restores the Settings tab. But it always opens the default sub-tab (General). If user was on Settings → Security before refresh, they lose that context.
- **Fix:** On `shown.bs.tab` for settings sub-tabs, `localStorage.setItem('lastSettingsSubTab', tabId)`. On Settings tab activation, read that key and call `.click()` on the stored sub-tab button (with a short timeout to allow the tab to render first).
- **Done when:** Refreshing the page while on Settings → Integrations returns to Settings → Integrations.
- [x] Implemented

---

## V3-MEDIUM — Visible gaps

### V3-M1 — No "Back to top" button for long-content tabs
- **Files:** `index.html`, `styles.css`, `app.js`
- **Root cause:** CRM, Marketing, Settings tabs regularly exceed the viewport height. There is no quick way to return to the top of the page without scrolling.
- **Fix:** Add a floating "Back to top" button. Show it when `.app-main` scroll position > 400px:
  ```html
  <!-- Add just before </body> -->
  <button id="backToTopBtn" class="btn btn-primary rounded-circle d-none" aria-label="Back to top"
    style="position:fixed;bottom:1.5rem;right:1.5rem;z-index:998;width:40px;height:40px;padding:0;">
    <i class="bi bi-arrow-up"></i>
  </button>
  ```
  ```javascript
  // In app.js after appMain reference:
  document.getElementById('appMain')?.addEventListener('scroll', () => {
    document.getElementById('backToTopBtn')?.classList.toggle('d-none',
      document.getElementById('appMain').scrollTop < 400);
  });
  document.getElementById('backToTopBtn')?.addEventListener('click', () => {
    document.getElementById('appMain')?.scrollTo({ top: 0, behavior: 'smooth' });
  });
  ```
- **Done when:** A floating up-arrow button appears after scrolling down 400px on any tab and returns to top on click.
- [x] Implemented

### V3-M2 — Dark mode: filter-bar-sticky shows white background
- **Files:** `styles.css`
- **Root cause:** `.filter-bar-sticky { background-color: var(--bs-body-bg, white) }` — the `white` fallback renders in dark mode if `--bs-body-bg` isn't set at the right cascade point. The sticky bar appears white/light over a dark table.
- **Fix:** Add to dark mode block in `styles.css`:
  ```css
  body.dark-mode .filter-bar-sticky {
    background-color: #1e1e2e;
    border-bottom-color: #404040;
  }
  ```
- **Done when:** Sticky filter bars in dark mode match the dark body background.
- [x] Implemented

### V3-M3 — Sidebar active sub-tab: no visible hint
- **Files:** `index.html`, `styles.css`, `app.js`
- **Root cause:** When on CRM → Deals, the sidebar shows only "CRM" as highlighted with no indication of which sub-section is active. Same for Marketing, Payments, Settings. This harms wayfinding.
- **Fix:** Add a sub-label element below each sidebar tab button that has sub-tabs (CRM, Marketing, Payments, Settings). Update it in the `shown.bs.tab` handler for sub-tabs:
  ```css
  .sidebar-sub-label {
    font-size: 0.65rem;
    opacity: 0.6;
    padding-left: 2.25rem;
    margin-top: -0.25rem;
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: rgba(255,255,255,0.8);
  }
  .app-sidebar.collapsed .sidebar-sub-label { display: none; }
  ```
- **Done when:** Sidebar shows "▸ Deals" under CRM when the Deals sub-tab is active.
- [x] Implemented

### V3-M4 — Empty states missing from Entries and Media Gallery
- **Files:** `index.html`, `entries.js`, `media-gallery-new.js`
- **Root cause:** `<tbody id="entriesTableBody">` is empty when no entries exist, showing bare column headers. Media Gallery has no empty state. Both give no guidance on next steps.
- **Fix:**
  - Entries: add an empty-state row inside `<tbody id="entriesTableBody">` with `id="entriesEmptyRow" class="d-none"` containing a helpful message and CTA.
  - Media Gallery: add a visible card inside `#mediaGalleryContent` with `id="mediaGalleryEmptyState" class="d-none"` showing "No media yet — upload your first photo".
  - In the respective JS modules, toggle `d-none` based on whether data is present.
- **Done when:** Empty Entries and Media Gallery tabs show friendly messages rather than blank/bare-table UI.
- [x] Implemented

### V3-M5 — Sidebar "Analytics" group has only one item
- **Files:** `index.html`
- **Root cause:** After V2-L4 moved Marketing to Commercial, the "Analytics" group contains only "Reports". A single-item group label adds noise without benefit.
- **Fix:** Remove the "Analytics" `<div class="sidebar-group">` wrapper and `<span class="sidebar-group-label">` label. Move the Reports button into the "Commercial" group below Payments and Marketing, or into a new "Insights" group if paired with another item.
- **Done when:** No sidebar group has fewer than two navigation items.
- [x] Implemented

### V3-M6 — `touch-action: manipulation` missing on interactive elements
- **Files:** `styles.css`
- **Root cause:** Without `touch-action: manipulation`, browsers add a 300ms delay on tap events for buttons and table rows on mobile/tablet (legacy behaviour for double-tap zoom detection). This makes the app feel sluggish on touch devices.
- **Fix:** Add to `styles.css`:
  ```css
  button, .btn, [role="button"], .sidebar-nav-link,
  td[data-action], tr[data-action], .stat-card {
    touch-action: manipulation;
  }
  ```
- **Done when:** No perceptible tap delay on buttons and clickable rows on mobile/tablet.
- [x] Implemented

---

## V3-LOW — Polish

### V3-L1 — Filter-bar sticky background doesn't extend edge-to-edge
- **Files:** `styles.css`
- **Root cause:** `.filter-bar-sticky` sits inside `.app-main .tab-content { padding: 1.5rem 1.75rem }`. The sticky bar's background only covers the content area, leaving the padded edges visually broken when it sticks — you can see the scrolling content behind the padding.
- **Fix:**
  ```css
  .filter-bar-sticky {
    margin-left: -1.75rem;
    margin-right: -1.75rem;
    padding-left: 1.75rem;
    padding-right: 1.75rem;
  }
  ```
- **Done when:** Sticky filter bar background covers the full width flush to the viewport edge.
- [x] Implemented

### V3-L2 — Sidebar toggle button tooltip is static ("Toggle sidebar")
- **Files:** `app.js`
- **Root cause:** The sidebar toggle `#sidebarToggle` has a fixed `title="Toggle sidebar"`. When collapsed it should say "Expand sidebar" and when expanded "Collapse sidebar".
- **Fix:** In the sidebar toggle click handler in `app.js`, after the classList toggle:
  ```javascript
  sidebarToggle.title = appSidebar.classList.contains('collapsed') ? 'Expand sidebar' : 'Collapse sidebar';
  ```
- **Done when:** Tooltip on sidebar toggle reflects current state.
- [x] Implemented

### V3-L3 — Connection status pill illegible in dark mode on purple navbar
- **Files:** `styles.css`
- **Root cause:** The navbar has a purple gradient. `#connectionStatus` in "Connected" state uses a green-tinted or default pill that may lack contrast against the purple.
- **Fix:**
  ```css
  body.dark-mode .connection-status,
  .connection-status {
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.25);
    color: #fff;
  }
  ```
- **Done when:** Connection status pill is readable in both light and dark mode against the navbar.
- [x] Implemented

### V3-L4 — `aria-selected` on sidebar tab buttons not dynamically updated
- **Files:** `app.js`
- **Root cause:** Sidebar buttons have `aria-selected` hardcoded (`dashboard-tab` = true, all others = false). Bootstrap's tab system may not update `aria-selected` on non-standard tab containers. Screen reader users can't tell which tab is active.
- **Fix:** In `shown.bs.tab` handler in `app.js`, update all sidebar buttons:
  ```javascript
  document.querySelectorAll('.sidebar-nav-link[role="tab"]').forEach(btn => {
    btn.setAttribute('aria-selected', btn.id === e.target.id ? 'true' : 'false');
  });
  ```
- **Done when:** Active sidebar tab button has `aria-selected="true"`; all others have `aria-selected="false"`.
- [x] Implemented

### V3-L5 — Settings sub-tab content sections lack card wrappers
- **Files:** `index.html`, `styles.css`
- **Root cause:** Settings General, Seasons, Data, Security sub-tabs mix raw form groups and card-wrapped sections inconsistently. Some sections have `.content-card`, others just use `<hr>` dividers. The visual rhythm is uneven.
- **Fix:** Audit the Settings sub-tab HTML. For each logical section (e.g., "Email Settings", "Account Details", "Password Change"), wrap in a `.content-card` with a `<h6 class="fw-semibold mb-3"><i class="bi bi-..."></i> Section Name</h6>` header. This matches how Dashboard and CRM are structured.
- **Done when:** All Settings sub-tabs have consistent card-wrapped sections with visible headers.
- [x] Implemented

---

## Notes for Claude (V3)

- **V3-C1 first** — fixing scroll containment in `.app-main` changes how sticky positions work everywhere. Do this before V3-H2, V3-H3, V3-M1.
- **Navbar height**: actual rendered height is ~60px (padding-top:1rem + padding-bottom:1rem + ~28px content). Use 60px everywhere. Add `--navbar-height: 60px` to `:root`.
- **After V3-C1**: verify sidebar aligns with the top of the content area correctly. Check at all viewport widths. Check dark mode.
- Always run `npm test` and `npm run build` after each commit. All 65 suites must pass.
- Commit message format: "Implements V3-C1, V3-C2" etc.

---

## COMPLETED (V1 Audit — all items done)

*(Original V1 items C1–C8, H1–H15, M1–M20, L1–L10 are all committed and pushed)*

---

## ═══════════════════════════════════════════════
## V4 AUDIT — Fresh Deep UX Audit (2026-05-08)
## ═══════════════════════════════════════════════

---

## V4-CRITICAL

### V4-C1 — Organisations table overflows at 1280px
- **Files:** `organisations.js`
- [x] Implemented

### V4-C2 — Awards table Phase column wiring
- **Files:** `awards.js`, `index.html`
- [x] Implemented

### V4-C3 — Stat card values hardcoded to 0
- **Files:** `index.html`
- [x] Implemented

### V4-C4 — Invoice line items allow blank name and zero quantity
- **Files:** `payments.js`
- [x] Implemented

---

## V4-HIGH

### V4-H1 — "Company" used instead of "Organisation" in UI labels
- **Files:** `index.html`
- [x] Implemented

### V4-H2 — Small modals for Webhook, Season, Clone Event
- [x] Implemented (modal-lg already present)

### V4-H3 — btn-success standardisation
- [x] Implemented (intentional — no change needed)

### V4-H4 — Empty-state colspan hardcoded
- **Files:** `utils.js`, `organisations.js`
- [x] Implemented

### V4-H5 — Dashboard tables missing .table-responsive
- [x] Implemented (already present)

### V4-H6 — Required field asterisks audit
- [x] Implemented (all present — no change needed)

---

## V4-MEDIUM

### V4-M1 — Sub-navs use nav-pills instead of nav-tabs
- **Files:** `index.html`
- [x] Implemented

### V4-M2 — Payments stat cards use old content-card pattern
- **Files:** `index.html`
- [x] Implemented

### V4-M3 — Payments sub-nav descriptor text
- **Files:** `index.html`
- [x] Implemented

### V4-M4 — Emoji in option elements
- **Files:** `index.html`
- [x] Implemented

### V4-M5 — Award form date sequence validation
- [x] Implemented (pre-existing)

### V4-M6 — Mobile sidebar auto-collapse
- **Files:** `index.html`
- [x] Implemented

### V4-M7 — Email column truncation and health icon aria-label
- **Files:** `organisations.js`, `styles.css`
- [x] Implemented

### V4-M8 — Award form help text
- **Files:** `index.html`
- [x] Implemented

### V4-M9 — Scheduled Reports as table
- **Files:** `app.js`, `tests/app.test.js`
- [x] Implemented

---

## V4-LOW

### V4-L1 — Sidebar toggle aria-label
- [x] Implemented

### V4-L2 — Tables missing visually-hidden caption
- **Files:** `index.html`
- [x] Implemented

### V4-L3 — "Overview" single-item sidebar group
- **Files:** `index.html`
- [x] Implemented

### V4-L4 — Sort icon class attributes outside class=""
- [x] Implemented

### V4-L5 — Pagination range display
- **Files:** `utils.js`
- [x] Implemented

### V4-L6 — Relative timestamps for Last Refreshed
- **Files:** `organisations.js`
- [x] Implemented

### V4-L7 — Date input placeholders
- [x] Implemented (already present)

---

## ═══════════════════════════════════════════════
## V5 AUDIT — Fresh Deep UX Audit (2026-05-08)
## ═══════════════════════════════════════════════

> **CLAUDE: All V5 items are open. Work in order: V5-C → V5-H → V5-M → V5-L.**

---

## V5-CRITICAL — Blocks or severely impairs core operations

### V5-C1 — Filtered empty states have descriptive text but no "Clear Filters" button
- **Files:** `utils.js`, `organisations.js`, `awards.js`, `winners.js`, `entries.js`, `payments.js`, `events.js`, `crm.js`
- **Root cause:** `showEnhancedEmptyState()` (`utils.js:1813`) renders a text hint `"Try adjusting your filters or search terms"` when `isFiltered: true`, but no action button. Awards uses the older `showEmptyState()` which doesn't even show a hint. Users who filter to zero results reach a dead end and must scroll back up to find and manually reset each filter control.
- **Fix:** In `showEnhancedEmptyState()`, when `isFiltered` is true, add a clear-filters button below the hint text:
  ```javascript
  const clearBtn = isFiltered
    ? `<button class="btn btn-sm btn-outline-secondary mt-2" onclick="document.querySelectorAll('.filter-bar-sticky select, .filter-bar-sticky input[type=text]').forEach(el=>{el.value=''}); document.querySelector('[data-action*=filter]')?.dispatchEvent(new Event('change'))">
        <i class="bi bi-x-circle me-1"></i>Clear Filters
       </button>`
    : '';
  ```
  Or better: accept a `clearAction` option (e.g. `clearAction: 'orgsModule.resetFilters'`) and render a `data-action` button.
- **Done when:** All filtered-empty-state rows include a working "Clear Filters" button that resets filters and re-queries.
- [x] Implemented

### V5-C2 — Print/PDF stylesheet incomplete: sidebar and UI chrome appear in print output
- **Files:** `styles.css`
- **Root cause:** `@media print` (line 1297) hides `.navbar`, `.nav-tabs`, `.btn`, `.filters-section`. But `.app-sidebar`, `#bulkActionsBar`, `#backToTopBtn`, `.filter-bar-sticky`, `.sidebar-group-label`, and Bootstrap modal backdrop remnants are all printed. "Export PDF" in Reporting calls `window.print()` directly, so this is a live defect affecting a core feature.
- **Fix:** Extend `@media print` to hide all non-content chrome:
  ```css
  @media print {
    .app-sidebar, .app-navbar,
    #bulkActionsBar, #backToTopBtn,
    .filter-bar-sticky, .nav-tabs, .navbar,
    .btn, .filters-section,
    .sidebar-group-label, .toast-container,
    [data-action], .modal-backdrop { display: none !important; }
    .app-main { height: auto; overflow: visible; }
    .tab-pane { display: block !important; }
  }
  ```
- **Done when:** `window.print()` from the Reporting tab shows only charts and data tables, no sidebar/nav/buttons.
- [x] Implemented

---

## V5-HIGH — Significantly degrades usability

### V5-H1 — V3-H4 outstanding: Organisations sub-nav uses custom JS show/hide, not Bootstrap tabs
- **Files:** `index.html`, `organisations.js`
- **Root cause:** `#orgsSubNav` was converted to `nav-tabs` visually in V4-M1, but buttons still use `data-action="orgsModule.showOrgsView"` / `data-action="orgsModule.showSponsorsView"` with no `data-bs-toggle="tab"` or `data-bs-target`. Content areas (`#orgsMainContent`, `#orgsSponsorSection`) are plain `<div>`s with `d-none` — not `tab-pane` elements. The custom JS manually toggles the `active` class. This means: no Bootstrap keyboard arrow-key navigation, `aria-selected` not updated by Bootstrap, semantic mismatch between `role="tablist"` and the actual non-tab behaviour.
- **Fix:**
  1. Give buttons `data-bs-toggle="tab"` and `data-bs-target="#orgsMainContent"` / `"#orgsSponsorSection"`.
  2. Add `class="tab-pane fade show active"` to `#orgsMainContent` and `class="tab-pane fade"` to `#orgsSponsorSection`.
  3. Remove or simplify `showOrgsView()` / `showSponsorsView()` in `organisations.js` — Bootstrap handles active class and show/hide. Keep only the `marketingModule.loadSponsors()` side-effect call by wiring it to the `shown.bs.tab` event.
- **Done when:** Clicking All Organisations / Sponsors & Partners tabs uses Bootstrap's tab system; arrow keys navigate between tabs; `aria-selected` updates automatically.
- [x] Implemented

### V5-H2 — Unsaved-changes warning missing from 65+ form modals
- **Files:** `app.js`
- **Root cause:** `utils.initModalDirtyTracking()` is wired to only 5 modals: `awardFormModal`, `orgFormModal`, `eventFormModal`, `paymentFormModal`, `invoiceFormModal` (`app.js:1979`). The remaining ~65 modals with form inputs (winner modal, CRM communications modal, assignment modal, season form, webhook form, etc.) silently discard all user input on close.
- **Fix:** Either:
  - Apply dirty tracking to all modals that contain a `<form>` element using a generic initialiser:
    ```javascript
    document.querySelectorAll('.modal.fade').forEach(modal => {
      if (modal.querySelector('form')) utils.initModalDirtyTracking(modal.id);
    });
    ```
  - Or: add `data-dirty-track="true"` to the 15-20 most important form modals and target those specifically.
- **Done when:** Closing any modal with unsaved form input shows "You have unsaved changes. Leave anyway?" confirmation.
- [x] Implemented

### V5-H3 — Modal header colours have no semantic rule — confusing visual language
- **Files:** `index.html`
- **Root cause:** 70 modals use 7 different header colour schemes with no consistent meaning:
  - `bg-primary` — used for Create Invoice, Webhook, Award Form, Record Payment, Send Email, and others
  - `bg-success` — used for Create Invoice (another), Record New Payment, Clone Event, Add Gallery Section
  - `bg-info` — used for Season Form, Send Invoice Email, Add Webhook
  - `bg-danger` — used for Delete confirmation
  - `bg-dark` — used for QR code modal
  - `bg-warning` — used for bulk action confirm
  - Plain (no class) — used for Org Profile, Public Link, Media, many others
  Users cannot learn what colour implies. Create vs Edit vs Danger vs Info all use the same colours.
- **Fix:** Adopt a 3-colour semantic rule:
  - Plain header: all read/view/info modals
  - `bg-primary text-white`: all create/edit/save modals
  - `bg-danger text-white`: all destructive/delete/warning modals
  Audit and update all 70 modal headers. Remove `bg-success`, `bg-info`, `bg-dark`, `bg-warning` from modal headers.
- **Done when:** Modal header colour indicates the action type (view = plain, create/edit = blue, destructive = red) consistently across all modals.
- [x] Implemented

### V5-H4 — stat-card-clickable elements missing explicit focus-visible ring
- **Files:** `styles.css`
- **Root cause:** Stat cards have `tabindex="0"` making them keyboard-focusable, but `styles.css` defines `focus-visible` rules only for `:focus-visible` (generic), `.btn:focus-visible`, `.form-control:focus-visible`, `.form-select:focus-visible`, `.sidebar-nav-link:focus-visible`. `.stat-card` is not listed, so the default outline may be invisible (browsers differ) and keyboard users can't see which card is active.
- **Fix:** Add to `styles.css`:
  ```css
  .stat-card-clickable:focus-visible {
    outline: 3px solid var(--primary-color);
    outline-offset: 3px;
  }
  ```
- **Done when:** Tabbing through dashboard stat cards shows a clear blue focus ring on each card.
- [x] Implemented

### V5-H5 — Awards table uses old `showEmptyState()` while all other tables use `showEnhancedEmptyState()`
- **Files:** `awards.js`
- **Root cause:** `awards.js:751` calls `utils.showEmptyState()` which renders `<i class="bi ${icon}">` (inline, tiny) with a bare `<p>` — no `display-4 d-block opacity-25` icon sizing, no description line, no action button. All other tables (orgs, winners, entries, invoices, events, CRM) call `utils.showEnhancedEmptyState()` which renders a large centred icon, description text, filter hint, and optional CTA button.
- **Fix:** Replace the `showEmptyState()` call in `awards.js` with `showEnhancedEmptyState()` passing `icon`, `message`, `description`, `isFiltered`, and `actionLabel`/`actionAction` for the non-filtered case (e.g. "Add Award" → `awardsModule.openAddAwardModal`).
- **Done when:** Awards empty state visually matches the Organisations and Winners empty states.
- [x] Implemented

---

## V5-MEDIUM — Visible polish gaps

### V5-M1 — Report Analytics charts render blank canvas when no data for selected period
- **Files:** `app.js` (chart rendering in `loadAnalyticsData`), `dashboard.js`
- **Root cause:** `dashboard.js:renderWinnersYearChart()` correctly handles zero data. But other Chart.js instances in `app.js` (sector chart, revenue chart, region chart) likely call `new Chart(ctx, {...})` directly with empty data arrays — resulting in a blank canvas with no message. When a user filters to a year with no entries/winners, charts silently render empty.
- **Fix:** Before each `new Chart(...)` call, check if the data array is empty. If so, replace the canvas with a `<div class="text-center py-4 text-muted">` message: "No data for the selected period — try a different year or filter."
- **Done when:** Selecting a year with no data shows "No data" message instead of blank chart area.
- [x] Implemented

### V5-M2 — Settings General sub-tab section headers not visible (dynamically rendered containers lack headings)
- **Files:** `index.html`, `settings.js`
- **Root cause:** `#settings-general` contains three bare `<div>` placeholder containers (`brandingSettingsContainer`, `uxSettingsContainer`, `notificationSettingsContainer`) injected by JS. Other Settings sub-tabs (Data, Security, Integrations) use explicit `content-card` divs with `<h5>` headers inside `index.html`. The General tab's card structure depends entirely on JS rendering — if branding settings fail to load, the tab shows a blank white area.
- **Fix:** Add static skeleton structure in `index.html` inside `#settings-general` (similar to other tabs):
  ```html
  <div class="content-card mb-4">
    <h5 class="mb-3"><i class="bi bi-palette me-2"></i>Branding</h5>
    <div id="brandingSettingsContainer"></div>
  </div>
  <div class="content-card mb-4">
    <h5 class="mb-3"><i class="bi bi-sliders me-2"></i>Preferences</h5>
    <div id="uxSettingsContainer"></div>
  </div>
  <div class="content-card mb-4">
    <h5 class="mb-3"><i class="bi bi-bell me-2"></i>Notifications</h5>
    <div id="notificationSettingsContainer"></div>
  </div>
  ```
- **Done when:** Settings → General shows the same visual card structure as Data/Security/Integrations.
- [x] Implemented

### V5-M3 — Loading spinners without adjacent text have no aria-label
- **Files:** `index.html`
- **Root cause:** Several `<div class="spinner-border" role="status">` elements have no `aria-label` and no adjacent visible text. Examples: line 540 (content calendar loading), line 564 (social media preview spinner), line 579 (hashtag panel spinner). Screen readers announce "status" with no context. (Spinners added in V4-C3 correctly have `aria-label="Loading"` — these older ones were missed.)
- **Fix:** Add `aria-label="Loading [context]"` to each bare spinner. Example: `aria-label="Loading content calendar"`. Quick grep for `role="status">` without `aria-label` to find all instances.
- **Done when:** No `<div role="status">` exists without either `aria-label` or adjacent text in a visually-hidden `<span>`.
- [x] Implemented

### V5-M4 — Horizontally-scrollable tables on mobile have no scroll indicator
- **Files:** `styles.css`
- **Root cause:** `.table-responsive` hides overflow-x content on small screens. Users on mobile/tablet don't know that columns extend to the right. No fade shadow or "swipe" hint is shown.
- **Fix:** Add a right-edge shadow that disappears once the table is fully scrolled:
  ```css
  @media (max-width: 991.98px) {
    .table-responsive {
      background: linear-gradient(to right, white 30%, rgba(255,255,255,0)) center right,
                  linear-gradient(to left, #e9ecef 50%, rgba(255,255,255,0)) center right;
      background-size: 30px 100%, 8px 100%;
      background-repeat: no-repeat;
      background-attachment: local, scroll;
    }
  }
  ```
- **Done when:** On narrow screens, a subtle shadow on the right edge of tables indicates hidden columns.
- [x] Implemented

### V5-M5 — Large textarea fields have no character counter or length guidance
- **Files:** `index.html`
- **Root cause:** Several key textareas accept long form content with no visible limit or counter: event description (`#eventDescription`), invoice message (`#sendInvoiceMessage`), CRM communication notes (`#communicationNotes`), award form description (`#awardFormDescription`). Users don't know if they're about to exceed a database column limit or email display limit.
- **Fix:** For each important textarea, add a character counter below it:
  ```html
  <textarea id="eventDescription" rows="3" maxlength="2000" ...></textarea>
  <div class="d-flex justify-content-end">
    <small class="text-muted char-counter" data-target="eventDescription">0 / 2000</small>
  </div>
  ```
  Add a `utils.initCharCounter()` helper that wires `input` events to update the counter. Add to `app.js` init.
- **Done when:** Key textarea fields show a live "X / Y characters" counter below them.
- [x] Implemented

### V5-M6 — Error toasts have no retry action
- **Files:** `utils.js`
- **Root cause:** `utils.showToast()` renders a static toast. When an API call fails (save award, create invoice, etc.), the user sees "Failed to save" with no way to retry. They must remember what they did, find the form/button again, and repeat the action manually.
- **Fix:** Extend `utils.showToast()` with an optional `retryFn` parameter:
  ```javascript
  showToast(message, type = 'success', duration = 5000, retryFn = null) {
    // existing toast creation...
    if (retryFn && type === 'error') {
      toastBody.innerHTML += `<button class="btn btn-sm btn-outline-light ms-2 mt-1" onclick="(${retryFn})()">Retry</button>`;
    }
  }
  ```
  Wire `retryFn` in key save operations (save award, save org, save invoice, etc.).
- **Done when:** Failed save operations show a "Retry" button in the error toast.
- [x] Implemented

### V5-M7 — No keyboard shortcut to focus search box (power user gap)
- **Files:** `app.js`
- **Root cause:** All list tabs (Awards, Organisations, Winners, Entries, Events) have a search box, but no keyboard shortcut to jump to it. Users must click the search box or tab through many elements to reach it. Convention: `/` focuses search on the current tab.
- **Fix:** In the `shown.bs.tab` handler (or as a global `keydown` listener), bind `/`:
  ```javascript
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      const activeTab = document.querySelector('.tab-pane.active');
      const searchBox = activeTab?.querySelector('input[type="text"][id*="Search"], input[type="search"]');
      searchBox?.focus();
      searchBox?.select();
    }
  });
  ```
- **Done when:** Pressing `/` on any list tab focuses the search box.
- [x] Implemented

---

## V5-LOW — Polish and refinement

### V5-L1 — No skip-to-main-content link (keyboard accessibility baseline)
- **Files:** `index.html`
- **Root cause:** Keyboard and screen reader users must tab through the sidebar (30+ nav buttons) before reaching the main content on every page load and tab switch. No skip link exists.
- **Fix:** Add as the first element inside `<body>`:
  ```html
  <a href="#appMain" class="visually-hidden-focusable btn btn-primary btn-sm"
     style="position:fixed;top:0.5rem;left:50%;transform:translateX(-50%);z-index:9999;">
    Skip to main content
  </a>
  ```
- **Done when:** Pressing Tab once after page load reveals a "Skip to main content" link that jumps focus to `#appMain`.
- [x] Implemented

### V5-L2 — Add/create button icons inconsistent across sections
- **Files:** `index.html`
- **Root cause:** "Add" / "Create" buttons use three different icons with no rule: `bi-plus-circle` (Organisations), `bi-plus-lg` (Settings → Add Webhook, Reporting → Add Season), and `bi-plus` (some inline buttons). This creates visual noise across the toolbar.
- **Fix:** Standardise on `bi-plus-lg` for all primary "add/create" toolbar buttons. Audit all `.btn-primary` and `.btn-outline-primary` buttons with `bi-plus-*` and update to `bi-plus-lg`.
- **Done when:** All add/create buttons use `bi-plus-lg me-1` consistently.
- [x] Implemented

### V5-L3 — Login History panel requires manual "Refresh" click instead of auto-loading
- **Files:** `index.html`, `settings.js`
- **Root cause:** The Login History panel (`#loginHistoryContainer`) in Settings → Security shows "Click Refresh to load recent login activity." on first visit. All other settings sub-tabs load their content automatically on `shown.bs.tab`. This is an inconsistency — users expect the data to be there.
- **Fix:** In `app.js` (or `settings.js`), listen for `shown.bs.tab` on `#settings-security-subtab` (or similar) and call `settingsModule.loadLoginHistory()` automatically on first activation. Use a `let loginHistoryLoaded = false` flag to avoid redundant re-fetches.
- **Done when:** Opening Settings → Security automatically shows the recent login history without requiring a manual click.
- [x] Implemented

### V5-L4 — Hover-only tooltips not accessible on touch / keyboard-only users
- **Files:** `index.html`
- **Root cause:** `data-bs-toggle="tooltip"` elements show content only on hover — invisible on touch devices and when using keyboard navigation. Affected: stat card info buttons (e.g. `#totalAwardsInfo`), table column headers with `title=` only, and icon-only action buttons. Bootstrap tooltips have no built-in touch or focus fallback.
- **Fix:** On every `data-bs-toggle="tooltip"` element also set `aria-label` to the same tooltip text. This makes the content available to screen readers and touch users via long-press or inspection:
  ```javascript
  // In app.js tooltip init:
  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
    if (!el.getAttribute('aria-label') && el.getAttribute('title')) {
      el.setAttribute('aria-label', el.getAttribute('title'));
    }
  });
  ```
  Additionally, icon-only buttons must always have `aria-label`.
- **Done when:** All tooltip content is also present as `aria-label` on the triggering element.
- [x] Implemented

### V5-L5 — `<input type="date">` native picker contradicts DD/MM/YYYY placeholder
- **Files:** `index.html`
- **Root cause:** Every date input has `placeholder="DD/MM/YYYY"` (per V4-L7), but browsers ignore the `placeholder` attribute on `<input type="date">` because a native date picker is shown instead. On mobile, the native date picker UI occupies the full screen. The placeholder is never visible, creating a false expectation in the codebase that user guidance is being shown.
- **Fix:** Remove the `placeholder="DD/MM/YYYY"` attribute from all `<input type="date">` elements (it has no effect). Instead add `<div class="form-text">Enter date in DD/MM/YYYY format</div>` only for date inputs where manual entry is expected (i.e. inputs outside native-picker context). This avoids the misleading codebase assumption.
- **Done when:** No `<input type="date">` has a `placeholder` attribute (which browsers ignore). Date format guidance appears as `form-text` only where necessary.
- [x] Implemented

### V5-L6 — CRM Communications table empty state has no "Log Communication" CTA
- **Files:** `crm.js`
- **Root cause:** When the Communications table is empty, `showEnhancedEmptyState()` is called. Checking `crm.js:407`, the empty state likely shows "No communications yet" with no action button. Users are left without a clear next step. Other empty states (Orgs, Awards) do provide a CTA button via `actionLabel`/`actionAction` options.
- **Fix:** In `crm.js`'s communications empty state call, add `actionLabel: 'Log Communication'` and `actionAction: 'crmModule.openLogCommunicationModal'`.
- **Done when:** The CRM Communications empty state shows a "Log Communication" button that opens the modal directly.
- [x] Implemented

---

## Notes for Claude (V5)

- **V5-C1 first**: the `showEnhancedEmptyState()` change in `utils.js` affects all modules; test that the new `clearAction` option works in Organisations, Awards, Winners, Entries, Events, Invoices.
- **V5-C2**: test `window.print()` from the Reporting tab after the print CSS fix. Verify sidebar is hidden.
- **V5-H1**: converting Orgs sub-nav to proper Bootstrap tabs requires structural changes to `index.html` (add `tab-pane` class to content divs) and `organisations.js` (replace `showOrgsView`/`showSponsorsView` with event listeners on the Bootstrap `shown.bs.tab` event).
- **V5-H2**: test dirty tracking by opening the winner edit modal, changing a field, then pressing Escape or clicking X — should show the unsaved changes dialog.
- **V5-H3**: Modal header colour audit is a large `index.html` change — do all 70 modals in one pass using a script.
- Always run `npm test` and `npm run build` after each commit. All 65 suites must pass.
- Commit format: "Implements V5-C1, V5-C2" etc.

---

## ═══════════════════════════════════════════════
## V6 AUDIT — International Awards Business First-Run UX (2026-05-08)
## ═══════════════════════════════════════════════

**Context:** This audit is from the perspective of a first-time admin at a professional international awards business. Every finding is verified against the actual codebase. No hypothetical issues.

---

## V6-CRITICAL

### V6-C1 — Social media "Post Now" silently fails with no upfront warning
- **Files:** `index.html` (social-content tab), `social-media.js`
- **Root cause:** The Social Media Manager presents fully functional-looking "Post Now" and "Schedule Post" buttons. When clicked, they show: *"Post has been queued for Twitter, LinkedIn. Note: Platform API integration required for actual posting."* via a toast. The post appears in Scheduled/Published lists but never reaches any platform. There is **no persistent warning** visible before the user starts composing. An international awards business client will spend time drafting and "posting" announcements believing they are live, when they are not.
- **Fix:** Add a visible `alert alert-warning` banner at the top of `#social-content` that shows when platform credentials are not configured. Check for the presence of platform tokens via a lightweight `/api/data-proxy.js` action or a localStorage flag set by Settings → Integrations. Banner text: *"⚠️ Social media posting is not yet active. Configure your API credentials in [Settings → Integrations] to enable live posting."* Dismiss once credentials are saved.
- **Also:** Change `openPlatformSettings()` to open a proper modal or navigate to Settings → Integrations rather than showing a toast.
- **Done when:** A user with no API credentials set sees a warning banner before composing a post. Once credentials are saved the banner disappears.
- [x] Implemented

### V6-C2 — No Getting Started guidance in Entries, CRM, Payments, Events, Organisations
- **Files:** `index.html` (entries, crm, payments, events, organisations sections)
- **Root cause:** Dashboard has `#gettingStartedBanner` and Marketing has `#marketingGettingStarted` — both show numbered workflow steps for a first-time user. The five core workflow sections (Entries, CRM, Payments, Events, Organisations) have **no onboarding banner**. A new user arriving at Entries sees a blank table with no explanation of what an "entry" is, how it relates to awards, or what to do first.
- **Fix:** Add a dismissible getting-started banner (matching the Marketing pattern — `card border-0 shadow-sm` with numbered steps, dismiss via localStorage flag) to each of these 5 sections:
  - **Entries:** Steps: 1) Ensure award categories exist → 2) Share the public entry link → 3) Review submissions here. Action button: "Copy Entry Submission Link".
  - **Organisations:** Steps: 1) Import via CSV or add manually → 2) Tag with sector/region → 3) Entries & CRM auto-link by org. Action: "Download Import Template".
  - **CRM:** Steps: 1) Organisations sync automatically from Organisations tab → 2) Log communications → 3) Track deals and sponsorship. Action: "Go to Communications".
  - **Payments:** Steps: 1) Create an invoice for an organisation → 2) Send it via email → 3) Record payment when received or use Stripe checkout. Action: "Create First Invoice".
  - **Events:** Steps: 1) Create an event → 2) Share registration link → 3) Manage attendees and seating here. Action: "Create First Event".
- **Done when:** Each section shows a numbered workflow banner on first visit (dismissed per section, stored in localStorage).
- [x] Implemented

---

## V6-HIGH

### V6-H1 — GDPR panel uses Bootstrap card style inside content-card Settings tab
- **Files:** `gdpr.js` lines 32–84
- **Root cause:** `gdprModule.renderGdprPanel()` outputs HTML using Bootstrap `.card`/`.card-header`/`.card-body`. This panel is injected into `#gdprPanel` inside `#settings-security`, which is surrounded by `.content-card` sections. The result is a visual inconsistency — GDPR Data Requests and Retention Policy sections look different from the rest of the Security tab.
- **Fix:** In `gdpr.js`, replace `.card` → `<div class="content-card">`, `.card-header` content → `<h5 class="mb-3"><i class="bi bi-..."></i> Title</h5>`, `.card-body` → remove (content sits directly in `.content-card`). Match the pattern used in `branding.js` after V3-L5 fix.
- **Done when:** GDPR sections in Security tab are visually indistinguishable from other sections (same card style, same header weight).
- [x] Implemented

### V6-H2 — Social media section uses Bootstrap card style throughout
- **Files:** `index.html` lines 3884–4215 (social-content tab)
- **Root cause:** The Social Media Manager sub-tab uses Bootstrap `.card`/`.card-header`/`.card-body` for "Create New Post", "Scheduled Posts", "Drafts", and "Published Posts" sections. All other CMS sections use `.content-card`. This inconsistency is particularly visible because the social media section is long and card-heavy.
- **Fix:** Replace the 4 Bootstrap cards in `#social-content` with `.content-card` divs. Convert `.card-header` content to `<h5 class="mb-3"><i class="bi bi-..."></i> Title</h5>` headings directly inside `.content-card`. The scheduled/draft/published count badges can move to `d-flex justify-content-between align-items-center mb-3` wrapper with the h5 on the left and badge on the right.
- **Done when:** Social media section cards match the `.content-card` style used everywhere else.
- [x] Implemented

### V6-H3 — Assignments module has no enhanced empty state
- **Files:** `assignments.js` lines 165–175
- **Root cause:** When no companies are assigned to the selected award, the module renders bare HTML: `<div class="text-center py-3 text-muted">No companies assigned yet. Add companies from the section below.</div>`. This plain text box has no icon, no primary action button, and doesn't match the `showEnhancedEmptyState()` pattern used in Awards, Entries, CRM, Events etc. It's especially jarring on a fresh system because the first thing judges/admins see is this blank text.
- **Fix:** Replace the bare HTML at line ~173 with:
  ```javascript
  utils.showEnhancedEmptyState('assignedCompaniesList', 1, {
    icon: 'bi-person-badge',
    message: 'No companies assigned yet',
    description: 'Search for companies in the panel below and click Assign to add them to this award',
    isFiltered: false,
  });
  ```
  Wrap the `<tbody id="assignedCompaniesList">` so the colspan covers the full table.
- **Done when:** An empty assignment panel shows the standard icon + message + description empty state.
- [x] Implemented

### V6-H4 — Winner pipeline "No active awards" state is plain text
- **Files:** `winner-pipeline.js` lines 354–362
- **Root cause:** When no active awards exist, the pipeline dashboard renders: `<div class="col text-muted">No active awards found.</div>` inside a `.row`. No icon, no guidance, no action button. A new user has no idea what "active" means or what to do.
- **Fix:** Replace the inline fallback string with a proper call after the container render:
  ```javascript
  if (!awards.length) {
    container.innerHTML = '';
    utils.showEnhancedEmptyState('pipelineDashboard', 1, {
      icon: 'bi-funnel',
      message: 'No active awards in the pipeline',
      description: 'Awards appear here once they have shortlisted nominees. Go to Awards to check status.',
      isFiltered: false,
      actionLabel: 'Go to Awards',
      actionFn: "dashboardModule.navigateToSection('awards')",
    });
    return;
  }
  ```
- **Done when:** An empty winner pipeline shows the standard empty state with an action to navigate to Awards.
- [x] Implemented

### V6-H5 — Event ticket price and URL stored in localStorage only
- **Files:** `events.js` lines 1434–1440
- **Root cause:** `renderTicketsTab()` reads ticket price and URL from `localStorage.getItem('bta_ticket_settings_${eventId}')`. If the admin uses a different browser, clears cache, or another admin logs in, these settings are silently missing. A professional events business setting ticket prices for hundreds-of-pounds-per-head events cannot rely on browser storage.
- **Fix:** Persist ticket price and ticket URL to the `events` table (add columns `ticket_price` and `ticket_url` if not present, or use a `bta_settings` key-value table). In `renderTicketsTab()`, load from the database first and fall back to localStorage only for migration. In `eventsModule.saveTicketSettings()`, write to the database via `apiClient`.
- **Done when:** Ticket price and URL survive a browser cache clear and are visible to any admin who opens the event.
- [x] Implemented

### V6-H6 — Marketing banners/sponsors use inconsistent empty state style
- **Files:** `marketing.js` lines 98–106, 425–432
- **Root cause:** When no banners or sponsors exist, `marketing.js` sets `container.innerHTML` to a Bootstrap `alert alert-info` block. This doesn't match the `showEnhancedEmptyState()` pattern. The result: Banners and Sponsors tabs show a plain blue info box while every other empty section in the CMS shows an icon + description + action button in the standard enhanced empty state style.
- **Fix:** Replace the `alert alert-info` empty states in `renderBanners()` and `renderSponsors()` with `utils.showEnhancedEmptyState()` calls:
  ```javascript
  // banners
  utils.showEnhancedEmptyState('bannersContainer', 1, {
    icon: 'bi-image',
    message: 'No banners yet',
    description: 'Create advertising banners to display on your awards pages',
    actionLabel: 'Add Banner',
    actionFn: 'marketingModule.openAddBannerModal',
  });
  // sponsors
  utils.showEnhancedEmptyState('sponsorsContainer', 1, {
    icon: 'bi-building',
    message: 'No sponsors yet',
    description: 'Add sponsors and partners to feature on your awards pages',
    actionLabel: 'Add Sponsor',
    actionFn: 'marketingModule.openAddSponsorModal',
  });
  ```
  Note: these containers use card-grid layout, not a `<tbody>`, so `showEnhancedEmptyState` needs to work with a `div` container (the `colspan` param should be ignored for non-table containers — verify `utils.showEnhancedEmptyState` handles this or adapt the call).
- **Done when:** Empty Banners and Sponsors tabs show the standard icon + description + primary action button.
- [x] Implemented

---

## V6-MEDIUM

### V6-M1 — Command palette (Ctrl+K) has no UI hint
- **Files:** `index.html` (topbar search area, around line 159), `utils.js` (`initCommandPalette`)
- **Root cause:** The global command palette is a powerful feature (Ctrl+K opens a fuzzy search across all modules). It is completely undiscoverable — no keyboard shortcut badge, no tooltip, no mention in the UI. New users never find it. The `?` shortcut modal (keyboard shortcuts help) could mention it, but only if users know `?` exists.
- **Fix:** Add a `<kbd>Ctrl+K</kbd>` hint badge next to the topbar search input:
  ```html
  <small class="text-muted ms-2 d-none d-md-inline"><kbd>Ctrl</kbd>+<kbd>K</kbd></small>
  ```
  Also add it to the `?` shortcuts modal. Style `kbd` elements in `styles.css` if not already styled (Bootstrap includes `.kbd` styles).
- **Done when:** The Ctrl+K shortcut is visible in the topbar and listed in the shortcuts modal.
- [x] Implemented

### V6-M2 — Reports "Data loaded: --" shows literal "--" on first render
- **Files:** `index.html` line 3470, `reporting.js` (freshness update logic)
- **Root cause:** The reports freshness indicator renders `<span>Data loaded: --</span>` on page load. The `--` looks like a rendering error to a new user. It should show a loading spinner until data is ready, then switch to the actual timestamp.
- **Fix:** Change the initial HTML to:
  ```html
  <span id="reportsDataFreshnessText">
    <span class="spinner-border spinner-border-sm me-1" role="status" aria-label="Loading data"></span>Loading…
  </span>
  ```
  In `reportsAnalytics` after data loads, replace this with the timestamp: `el.innerHTML = 'Data loaded: ' + new Date().toLocaleTimeString()`.
- **Done when:** Reports section shows a spinner then a real timestamp, never "--".
- [x] Implemented

### V6-M3 — Social media scheduled/draft/published empty states are bare HTML
- **Files:** `index.html` lines 4163–4169, `social-media.js` `loadScheduledPosts()` / `loadPublishedPosts()`
- **Root cause:** Scheduled Posts and Published Posts sections hard-code their empty state in HTML:
  ```html
  <div class="text-center text-muted py-4">
    <i class="bi bi-calendar-x display-4 d-block mb-2 opacity-25"></i>
    No scheduled posts
  </div>
  ```
  And `loadPublishedPosts()` likely uses a similar bare pattern. These don't use `showEnhancedEmptyState()` and have no call to action.
- **Fix:** In `social-media.js`, after loading scheduled/published posts, if the list is empty call `showEnhancedEmptyState()` on the container with a description pointing the user to the compose form. For the static HTML empty state, replace with a dynamic render driven by JS (remove the hard-coded HTML, let JS set the empty state after load).
- **Done when:** Empty scheduled/published/draft lists show the standard icon + description style, matching the rest of the CMS.
- [x] Implemented

### V6-M4 — `console.debug` calls left in crm.js production code
- **Files:** `crm.js` (31 occurrences of `console.debug`)
- **Root cause:** `crm.js` contains 31 `console.debug('Loading deals...')` and similar calls. While `console.debug` is suppressed in most production browser consoles, it is unprofessional and leaks internal implementation detail if a client opens DevTools.
- **Fix:** Run: `sed -i 's/console\.debug(/\/\/ console.debug(/g' crm.js` to comment them all out. Then remove any that are truly redundant (loading indicators that have UI spinners already). Keep errors (`console.error`) and warnings (`console.warn`).
- **Done when:** `grep -c "console.debug" crm.js` returns 0.
- [x] Implemented

### V6-M5 — Winner pipeline panel uses old Bootstrap card for score chart
- **Files:** `winner-pipeline.js` lines 143–148
- **Root cause:** The panel rendered by `_loadPipelinePanel()` includes `<div class="card-body"><canvas id="pipelineScoreChart" height="120"></canvas></div>` — a Bootstrap `.card-body` without a surrounding `.card`. This orphaned class produces inconsistent padding/styling in the pipeline panel.
- **Fix:** Wrap the canvas in a `.content-card` with a `<h6>` heading: `<div class="content-card mt-3"><h6 class="mb-3"><i class="bi bi-bar-chart-line me-2"></i>Score Distribution</h6><canvas id="pipelineScoreChart" height="120"></canvas></div>`.
- **Done when:** The score chart in the pipeline panel is visually consistent with other content cards.
- [x] Implemented

### V6-M6 — Assignments "Add Companies" section header uses bi-plus-circle
- **Files:** `assignments.js` line ~217
- **Root cause:** The "Add Companies" section heading uses `bi-plus-circle` icon — inconsistent with the V5-L2 standardisation to `bi-plus-lg` across all add/create actions.
- **Fix:** Change `<i class="bi bi-plus-circle me-2 text-primary"></i>` → `<i class="bi bi-plus-lg me-2 text-primary"></i>` in `assignments.js`.
- **Done when:** No `bi-plus-circle` icons remain in the rendered assignments panel.
- [x] Implemented

### V6-M7 — Social media "Configure Platforms" shows a toast instead of a settings path
- **Files:** `social-media.js` lines 999–1004, `index.html` line 4383
- **Root cause:** The "Configure Platforms" button calls `openPlatformSettings()` which shows a toast: *"Platform connection settings require OAuth API keys... Configure these in your .env file."*. This is unhelpful — a non-technical admin doesn't know what a `.env` file is. There's no link to Settings → Integrations where the Webhooks section lives (the closest thing to an integrations UI).
- **Fix:** Replace the toast with a navigation action to the Settings → Integrations sub-tab:
  ```javascript
  openPlatformSettings() {
    utils.showToast('Navigating to Settings → Integrations', 'info');
    app.navigateToSection('settings');
    // then programmatically activate the integrations sub-tab
    const tab = document.querySelector('[data-bs-target="#settings-integrations"]');
    if (tab) bootstrap.Tab.getOrCreateInstance(tab).show();
  },
  ```
  Also update the tooltip text on the button to "API Credentials" and add a note in Settings → Integrations about social media platform tokens.
- **Done when:** "Configure Platforms" navigates the user to Settings → Integrations rather than showing a useless toast.
- [x] Implemented

---

## V6-LOW

### V6-L1 — No keyboard shortcut hint visible in any section toolbar
- **Files:** `index.html` (filter bars in Awards, Organisations, Winners, Entries, Events), `utils.js` (`_buildShortcutsModal`)
- **Root cause:** The `?` keyboard shortcut opens a shortcuts reference modal. But `?` itself is not discovered unless the user already knows about it. No toolbar, filter bar, or section header shows a `?` or "Keyboard shortcuts" hint anywhere.
- **Fix:** Add a small `<button class="btn btn-link btn-sm text-muted p-0 ms-2" data-action="utils.toggleShortcutsModal" title="Keyboard shortcuts"><kbd>?</kbd></button>` to the right side of the filter bar in each major section (Awards, Organisations, Winners, Entries, Events, CRM, Payments). One global instance in the topbar would also work.
- **Done when:** At least one visible `?` hint is present in the UI that opens the shortcuts modal.
- [x] Implemented

### V6-L2 — Marketing getting-started banner uses Bootstrap card style (not content-card)
- **Files:** `index.html` lines 3660–3754
- **Root cause:** The Marketing Getting Started guide uses `class="card border-0 shadow-sm mb-4"` — a Bootstrap card, not `.content-card`. This is minor but inconsistent: the rest of the Marketing section uses `.content-card`.
- **Fix:** Change `<div class="card border-0 shadow-sm mb-4" id="marketingGettingStarted">` → `<div class="content-card mb-4" id="marketingGettingStarted">` and remove the inner `<div class="card-body py-3">` wrapper (`.content-card` provides its own padding).
- **Done when:** Marketing getting-started banner uses `.content-card` and renders with consistent padding/border-radius.
- [x] Implemented

### V6-L3 — Reports data freshness shows no auto-refresh option
- **Files:** `index.html` line 3468, `reporting.js`
- **Root cause:** The reports toolbar shows "Data loaded: [time]" but there's no way to refresh without navigating away and back. For an awards admin reviewing live data during a ceremony, this is inconvenient.
- **Fix:** Add a small `<button class="btn btn-sm btn-outline-secondary ms-2" data-action="reportsAnalytics.loadReports" title="Refresh data"><i class="bi bi-arrow-clockwise"></i></button>` next to the freshness indicator. Show a spinner inside the button while loading.
- **Done when:** User can click a Refresh button in the Reports toolbar to reload data without page navigation.
- [x] Implemented

### V6-L4 — CRM companies table "status" badge shows raw database value
- **Files:** `crm.js` line ~2702
- **Root cause:** The CRM companies embedded table (in deals section) renders: `<span class="badge bg-primary">${utils.escapeHtml(o.status || '')}</span>` — the raw `status` database value (e.g. `"nominee"`, `"active"`, `"prospect"`) without title-casing or badge colour coding. Users see a uniform blue badge for every status.
- **Fix:** Apply `utils.toTitleCase()` to the status value and map statuses to Bootstrap colour classes:
  ```javascript
  const statusColors = { nominee: 'bg-info', winner: 'bg-success', active: 'bg-primary', prospect: 'bg-secondary', inactive: 'bg-danger' };
  const cls = statusColors[o.status] || 'bg-secondary';
  `<span class="badge ${cls}">${utils.toTitleCase(o.status || 'Unknown')}</span>`
  ```
- **Done when:** CRM company status badges are colour-coded and title-cased.
- [x] Implemented

### V6-L5 — "Copy Entry Link" in entries empty state label is unclear
- **Files:** `entries.js` lines 302–312
- **Root cause:** The entries empty state (when no entries exist) shows a CTA button labelled "Copy Entry Link". A new admin doesn't know what this links to or where to paste it. The action is also ambiguous — "link" to what?
- **Fix:** Change the action button label to `"Copy Public Entry Form URL"` and add a description line: *"Share this link with entrants so they can submit online."* Update `showEnhancedEmptyState` call in `entries.js` accordingly.
- **Done when:** Empty entries state CTA is labelled "Copy Public Entry Form URL" with explanatory description.
- [x] Implemented

---

## Notes for Claude (V6)

- **V6-C1 first** — the social media warning banner is the most reputationally damaging issue. An international awards client posting to 4 platforms and seeing nothing happen will lose trust in the system.
- **V6-C2** — add the 5 getting-started banners in a single commit. Use the Marketing banner at line 3660 as the exact template. Each banner needs a unique localStorage key (`entriesWorkflowDismissed`, `orgsWorkflowDismissed`, etc.).
- **V6-H1 (GDPR)** — `gdpr.js` renders inside `#gdprPanel` which is moved into `#settings-security` by an inline script. The card changes are purely in `gdpr.js`.
- **V6-H2 (Social media cards)** — the 4 cards are in `index.html` `#social-content`. They are rendered as static HTML (not dynamically), so the change is purely in `index.html`.
- **V6-H5 (Ticket price persistence)** — check whether the `events` table already has `ticket_price` / `ticket_url` columns in `database-schema.sql` before assuming you need a migration. If the columns exist, the fix is purely in `events.js`.
- **V6-M4 (console.debug)** — use sed or a script; do not edit manually. Run `grep -c "console.debug" crm.js` to verify count before and after.
- Always run `npm test` and `npm run build` after each commit. All 65 suites must pass.
- Commit format: "Implements V6-C1, V6-C2" etc.

---

---

## V7 Audit — 2026-05-14 (Top-to-bottom professional CMS audit, first-time user perspective)

> **Focus:** A professional awards business employee using this CMS for the first time. They run international trade awards and are experienced business users but have never seen this system. Audited by reading every section of `index.html` and the modal/JS output text top-to-bottom.

---

## V7-CRITICAL

### V7-C1 — "Test Mode" button is permanently visible in the production topbar
- **Files:** `index.html` lines 119–144
- **Root cause:** The topbar contains a bright yellow `btn-outline-warning` dropdown labelled "🐛 Test Mode" with options: "Generate Test Data (30 Winners)", "Remove Test Data", "Create Mock Order", "Remove Mock Orders". This is visible to every user, including non-technical business admins. A single click on "Generate Test Data" injects 30 fake winner records into the live database. There is no confirmation step.
- **Fix:** Wrap the entire `#testModeDropdown` in a check so it only renders in non-production environments. The simplest approach: add a `data-env` attribute to `<body>` (set by the build script) and use CSS `body:not([data-env="development"]) #testModeDropdown { display: none !important; }`. Alternatively, hide it with `d-none` and only show it via a developer keyboard shortcut (`Ctrl+Shift+D`). The "Generate Test Data" action must also show a confirmation modal before executing.
- **Done when:** The Test Mode button is not visible to a logged-in business admin in any production build. It can only be accessed by developers who know the secret shortcut.
- [x] Implemented

---

## V7-HIGH

### V7-H1 — Awards section opens with a confusing "Award Categories Reference" card, not the awards table
- **Files:** `index.html` lines 888–949
- **Root cause:** The very first thing a user sees when clicking "Awards" in the sidebar is a collapsible `content-card` titled "Award Categories Reference — All award types by size". This is a static reference guide (expandable by size: Micro, Small, Medium, Large, Enterprise). Below it comes the filter bar, then the stat cards, then the awards table. A first-time user thinks they've landed in documentation, not a working data table.
- **Fix:** Move the "Award Categories Reference" card to a help/info panel — either a collapsible section at the BOTTOM of the Awards tab, or a modal opened via an "Award Size Guide" button in the toolbar. The first visible element in the Awards tab should be the filter bar and awards table (matching the pattern in Entries, Organisations, Events).
- **Also:** Add a "Getting Started — Awards" dismissible banner (matching the Entries/Events/Payments pattern) showing the award lifecycle: 1) Create award categories → 2) Set to Active to open for entries → 3) Manage judging phases → 4) Announce winners.
- **Done when:** Opening the Awards section shows the filter bar and table immediately. The reference card is accessible but not the first thing on the page.
- [x] Implemented

### V7-H2 — Winners section has no "Getting Started" banner
- **Files:** `index.html` (winners tab pane, around line 2205)
- **Root cause:** The Winners section opens with a filter bar and table, but no onboarding guidance. Every other major section (Entries, Organisations, Events, Payments, CRM, Marketing) has a numbered "Getting Started" workflow banner. Winners — where the final business decision (who won?) is recorded — has nothing. A first-time user doesn't understand how winners appear here (auto-populated from judging? manually added? imported?), what the statuses mean, or what to do first.
- **Fix:** Add a dismissible getting-started banner before the filter bar:
  - Step 1: Winners are added here manually, imported via CSV, or promoted from the Assignments panel
  - Step 2: Set status to "Notified" once you've informed the winner, then "Pack Sent" when materials are dispatched
  - Step 3: Set "Published" to make the winner visible on public pages; ensure GDPR Consent is recorded before publishing
  - Action CTA: "Import Winners CSV"
  - localStorage key: `winnersWorkflowDismissed`
- **Done when:** Opening the Winners section shows the numbered workflow banner on first visit.
- [x] Implemented

### V7-H3 — Assignments modal title "Manage Award Nominees" is wrong — it is the judge assignment screen
- **Files:** `index.html` line 7534–7535
- **Root cause:** The assignments modal (opened from Awards → each award row) is titled "Manage Award Nominees" with a trophy icon. But this modal is actually the judge-assignment workflow: it shows which organisations/nominees are assigned to a judge panel, allows sending decision emails (Shortlisted/Rejected/Winner), and shows vote counts. It is NOT a screen for managing who the nominees are. A first-time user will expect to find judges here, not see "nominees" terminology.
- **Fix:** Rename the modal title to `"Award Judging Panel"` or `"Manage Nominees & Decisions"`. Change the icon from `bi-trophy` to `bi-person-badge` or `bi-people`. Update the subtitle/description text inside the modal body to explain this is where judges review assigned nominees and record decisions.
- **Done when:** The modal title accurately describes its purpose (judge/decision management, not nominee creation).
- [x] Implemented

### V7-H4 — Entry status options "Under Review" and "Pending Review" are unexplained and redundant-seeming
- **Files:** `index.html` lines 2527–2529 (entries status filter select)
- **Root cause:** The entry status filter dropdown includes: Submitted, Under Review, Pending Review, Shortlisted, Rejected. Both "Under Review" and "Pending Review" exist with no tooltip, description, or differentiation. A first-time judge or admin will not understand the difference — they seem like synonyms. Looking at the codebase, `pending_review` = waiting to be assigned to a reviewer; `under_review` = actively being reviewed by a judge. This distinction is invisible in the UI.
- **Fix:** Add `<option>` titles or, better, add a tooltip icon next to the filter label explaining: "Pending Review = submitted, waiting for a judge to be assigned. Under Review = currently being scored by an assigned judge." Alternatively, rename to "Awaiting Judge" and "With Judge" to make the distinction crystal clear.
- **Done when:** A user can distinguish between the two review statuses without reading documentation.
- [x] Implemented

### V7-H5 — Marketing sub-tabs are in a different order from the "Getting Started" workflow steps
- **Files:** `index.html` lines 3899–3960 (marketingSubTabs nav)
- **Root cause:** The Marketing "Getting Started" banner lists the recommended workflow as: 1) Branding → 2) Email Placeholders → 3) Email Templates → 4) Email Builder → 5) Email Lists → 6) Email Sequences → 7) Banners → 8) Sponsors → 9) Social Media. But the actual sub-tabs appear in this order: Branding Overview, Placeholders, **Banners, Social Media, Content Calendar**, Email Templates, Email Builder, Email Lists, Email Sequences. Banners and Social are shown third and fourth, not seventh and ninth as the workflow suggests. The mismatch means the banner says "follow steps in order" but the tabs are NOT in that order.
- **Fix:** Reorder the Marketing sub-tabs to match the Getting Started workflow: 1) Branding, 2) Placeholders, 3) Email Templates, 4) Email Builder, 5) Email Lists, 6) Email Sequences, 7) Banners, 8) Sponsors, 9) Social Media, 10) Content Calendar. This is a pure HTML reorder — move the `<li>` tab buttons in `#marketingSubTabs`. Also move the corresponding `tab-pane` divs in the content area to match.
- **Done when:** Tab order in `#marketingSubTabs` matches the numbered steps in the Getting Started banner exactly.
- [x] Implemented

### V7-H6 — "Phase" column in Awards table is hidden by default; it is critical judging workflow info
- **Files:** `index.html` lines 1074–1076 (Tools dropdown column toggle), `awards.js` (column visibility logic)
- **Root cause:** The Phase column (showing the current judging phase: Entry / Judging / Shortlisting / Voting / Announced) is toggled off by default. It appears in Tools → Column Visibility as an opt-in. During active award programmes, Phase is one of the most important fields for an admin to see at a glance — it tells them what stage each award is at. Hiding it by default means users manage an active programme without visibility into phase.
- **Fix:** Make the Phase column visible by default. Change the initial checked state of `#colTogglePhase` to checked, and ensure `awardsModule` renders the Phase column in the initial table render. The user can still hide it via Tools → Column Visibility if they want a cleaner view.
- **Done when:** The Phase column is visible when a user first opens the Awards section, alongside Status, Year, and Sector.
- [x] Implemented

### V7-H7 — Social media compose: "Post Now" is green (success) and "Schedule Post" is blue (primary) — backwards priority
- **Files:** `index.html` lines 4284–4288 (social media compose buttons)
- **Root cause:** The social media compose panel has two submit buttons: "Schedule Post" (`btn-primary`, blue) and "Post Now" (`btn-success`, green). For an awards business, scheduling is the safe, deliberate workflow; "Post Now" is the dangerous one (publishes immediately). The green "success" colour makes "Post Now" look like the encouraged primary action. This compounds V6-C1: even with the warning banner, the button colour signals "Post Now = good / correct".
- **Fix:** Swap the button styles: "Schedule Post" → `btn-success` (green, encouraged action), "Post Now" → `btn-outline-warning` or `btn-outline-danger` (cautious action, especially since credentials may not be set). Add `title="Posts immediately — requires API credentials to be configured"` to the Post Now button.
- **Done when:** The button hierarchy visually communicates that Schedule is the intended workflow and Post Now is the exception.
- [x] Implemented

---

## V7-MEDIUM

### V7-M1 — Organisations filter bar uses Bootstrap card style, not content-card
- **Files:** `index.html` lines 1557–1700 (organisations filter bar)
- **Root cause:** The Organisations filter bar uses `<div class="card border-0 shadow-sm mb-4 filter-bar-sticky">` — a Bootstrap card, while all other sections (Awards, Entries, Events, Payments, CRM) use `<div class="content-card mb-4 filter-bar-sticky">`. Minor visual inconsistency but noticeable when switching between sections.
- **Fix:** Change `class="card border-0 shadow-sm mb-4 filter-bar-sticky"` → `class="content-card mb-4 filter-bar-sticky"` on the organisations filter bar. Remove the inner `<div class="card-body">` wrapper (`.content-card` includes its own padding). This is the same fix pattern as previous audits.
- **Done when:** Organisations filter bar is visually identical in style to the Awards filter bar.
- [x] Implemented

### V7-M2 — CRM "Regarding" column/filter label is passive and unclear
- **Files:** `index.html` lines 5731–5738 (CRM communications filter), line 5769 (communications table `<th>`)
- **Root cause:** The CRM communications filter and table column are labelled "Regarding" — a passive, formal word that doesn't communicate purpose. Options include "Sponsorship", "Award Application", "Event Ticket", "General Enquiry". The filter should tell users what they're filtering by: the topic or type of communication.
- **Fix:** Rename label `"Regarding"` → `"Topic"` in both the filter (`<label>`) and the table column (`<th>`). Also update `crm.js` render output that writes the `"regarding"` value into the table row to use `"Topic"` as the display header.
- **Done when:** Both the filter label and the table column header say "Topic" instead of "Regarding".
- [x] Implemented

### V7-M3 — Settings > "Seasons & Areas" description exposes technical language ("seed SQL")
- **Files:** `index.html` lines 6235–6238 (Manage Areas section)
- **Root cause:** The description reads: *"View the 101 geographic areas used for award categories. Populated by the areas seed SQL."* The phrase "seed SQL" is developer jargon that business users will not understand. It also says "101 geographic areas" with no explanation of what this means for their workflow.
- **Fix:** Replace the description with: *"The geographic areas available when assigning award categories to locations. These are pre-loaded from your initial setup and cover all UK regions and major cities."* Remove any reference to SQL or seeding.
- **Done when:** No technical jargon is visible in the Settings > Areas panel description.
- [x] Implemented

### V7-M4 — Events "Financial Overview" panel is collapsed by default; revenue data should be visible
- **Files:** `index.html` lines 3325–3395 (financial overview panel)
- **Root cause:** The "Financial Overview - All Events" panel (showing Total Revenue, Total Costs, Net P&L, and per-event breakdown) is rendered as a Bootstrap collapse that is closed by default. For an awards business processing ticket sales and sponsorship payments, this financial summary is a primary concern — not a secondary detail to be discovered.
- **Fix:** Change the panel to be expanded by default: add `class="show"` to the `#financialOverviewBody` collapse div and update the toggle button's `aria-expanded` to `"true"`. Users can still collapse it. The change is one-line in `index.html`.
- **Done when:** Financial Overview is visible when a user first opens the Events section without needing to click anything.
- [x] Implemented

### V7-M5 — Payments "Outstanding" stat card label is ambiguous (amount vs. count?)
- **Files:** `index.html` lines 5332–5337
- **Root cause:** The "Outstanding" stat card in the Payments > Invoices tab shows `£<amount>` but the card title is just "Outstanding". It's unclear at a glance whether this is a count of outstanding invoices or an outstanding monetary amount. The `£` prefix suggests it's a total balance but the label doesn't confirm this.
- **Fix:** Change the stat card `<h6>` label from `"Outstanding"` to `"Outstanding Balance"`. This immediately tells users it's a monetary total, not a count.
- **Done when:** The stat card clearly communicates it shows a total amount owed, not a count of invoices.
- [x] Implemented

### V7-M6 — "Sales Dashboard" button in the dashboard is confusing alongside the Reports section
- **Files:** `index.html` line 647
- **Root cause:** The dashboard header has a `btn-primary` button "Sales Dashboard" that opens a modal (`#salesDashboardModal`). There is also a "Reports" section in the sidebar. A first-time user will not understand the difference: why is there a "Sales Dashboard" in the main dashboard AND a "Reports" section? The modal appears to show payment/revenue charts — content that logically belongs in Reports.
- **Fix:** Either (a) rename the button to "Revenue Overview" and add a `title` tooltip explaining "Quick view of revenue and payments — see Reports for full analytics", or (b) remove the modal entirely and add its charts to the Payments section's KPI bar or the Reports section. If keeping, add a description under the button: `<small class="text-muted d-block mt-1">Quick payment & revenue summary</small>`.
- **Done when:** The relationship between "Sales Dashboard" and "Reports" is clear to a first-time user.
- [x] Implemented

### V7-M7 — CRM deal pipeline stages use generic sales jargon, not awards terminology
- **Files:** `index.html` lines 5829–5836 (deals stage filter), `crm.js` (renderDeals stage display)
- **Root cause:** The deals pipeline stages are: `lead`, `contacted`, `qualified`, `proposal`, `negotiation`, `closed_won`, `closed_lost`. These are standard B2B sales stages that don't map naturally to an awards business sponsorship pipeline. An awards admin thinking about sponsors won't naturally categorise them as "qualified" or "negotiation". The stages should use awards/sponsorship terminology.
- **Fix:** Rename stages in the filter options and CRM deal rendering to: Identified → Approached → Meeting Held → Proposal Sent → Under Negotiation → Confirmed → Declined. Update the `<option value>` attributes and any `crm.js` display logic that maps stage to a display label. This is a display-only change; DB values can stay the same if mapped via a translation object.
- **Done when:** Deal stages use awards/sponsorship terminology. No B2B sales jargon visible to business users.
- [x] Implemented

### V7-M8 — "Smart Segments" CRM tab name is technical jargon
- **Files:** `index.html` line 5698 (`#smart-segments-subtab`), line 6063–6064
- **Root cause:** The CRM sub-tab is labelled "Smart Segments" — this sounds like a marketing tech feature, not a business function. The tooltip explains it, but tooltips are invisible until hover. A first-time user may not know to click it, and may confuse it with email list segments in Marketing.
- **Fix:** Rename the tab label to "Auto-Segments" or "Dynamic Lists" — clearer, more self-explanatory. Update the `<h4>` heading inside the tab content at line 6065 to match. Also update the tooltip to: *"Rules-based filters that automatically update as your organisation data changes — e.g. 'All winners in Finance sector'"*.
- **Done when:** Tab label and heading are business-friendly and self-explanatory without needing the tooltip.
- [x] Implemented

### V7-M9 — Winner status "media_sent" in filter doesn't match the documented status lifecycle
- **Files:** `index.html` line 2286 (winners status filter), line 2373–2374 (status column tooltip)
- **Root cause:** The Winners status filter includes `"media_sent"` (displayed as "Media Sent") but the tooltip on the Status column documents the lifecycle as: `Pending → Notified → Pack Sent → Confirmed → Published`. "Media Sent" is not in this documented lifecycle. This is either a missing status in the tooltip or an undocumented status in the filter — either way it's inconsistent.
- **Fix:** Align the filter options with the documented lifecycle. Either: (a) Add "Media Sent" to the lifecycle tooltip with its definition, OR (b) Replace "Media Sent" in the filter with "Pack Sent" (which IS in the documented lifecycle) if they are the same thing. Update `winners.js` status badge rendering to match whichever canonical list is agreed.
- **Done when:** Every status option in the filter appears in the documented lifecycle tooltip, and vice versa.
- [x] Implemented

### V7-M10 — Events "This Year" stat card has no corresponding filter option
- **Files:** `index.html` lines 3300–3315 (events stat cards)
- **Root cause:** The Events section has stat cards including one labelled "This Year" showing the count of events this year. Other stat cards (like "Upcoming") are clickable and apply a filter. But there is no "This Year" option in the Events filter bar dropdown — the time filter only offers: All Events, Upcoming, Past, This Month. Clicking the "This Year" card (if it's supposed to filter) would have no matching filter state.
- **Fix:** Either (a) add a "This Year" option to the events time filter dropdown so the stat card can activate it on click, or (b) make the "This Year" stat card non-clickable and visually distinguish it from the clickable stat cards (remove `stat-card-clickable` class if present). Adding "This Year" to the filter is the better solution.
- **Done when:** "This Year" is a usable filter option in the Events filter bar, and the corresponding stat card activates it on click.
- [x] Implemented

---

## V7-LOW

### V7-L1 — Reports section has no "Getting Started" or context banner
- **Files:** `index.html` (reports tab pane, around line 3585)
- **Root cause:** Every other major section (Awards, Entries, Events, Payments, CRM, Organisations, Marketing, Winners) has a "Getting Started" banner. The Reports section — which contains chart tabs (Pipeline, Sector, Region, Year-on-Year), scheduled reports, and year filtering — opens with no explanation. A first-time user doesn't know what charts are available, how to schedule a report, or how to export data.
- **Fix:** Add a dismissible "Getting Started — Reports" banner above the filter bar: 1) Use the year filter to narrow the view → 2) Scroll down to see pipeline, sector, and region breakdowns → 3) Scroll to "Scheduled Reports" to set up automated email reports. Add an action button "Schedule a Report".
- **Done when:** Reports section has a getting-started banner matching the style of other sections.
- [x] Implemented

### V7-L2 — btn-info used for confirm/primary actions in several places; should be btn-primary
- **Files:** `index.html` lines 3040, 3050 (YouTube playlist buttons), 7378 (Send Invoice confirm), 9351 (winner export)
- **Root cause:** `btn-info` (Bootstrap's teal/cyan button) is used for several confirm/submit actions: "Fetch Playlist Videos", "Import Playlist Videos", "Send Invoice" (confirm), "Export Year Comparison". This is inconsistent with the rest of the CMS which uses `btn-primary` (blue) for all primary confirm/submit actions. `btn-info` also lacks sufficient colour contrast in some themes.
- **Fix:** Replace `btn-info text-white` and `btn-info` with `btn-primary` on all action/confirm buttons that aren't specifically status-indicator buttons. Do a global search for `btn-info` and convert each to `btn-primary` (unless it's genuinely an informational indicator, not an action).
- **Done when:** No `btn-info` is used for primary action buttons. Only `btn-primary` (blue), `btn-success` (green), `btn-warning` (amber), `btn-danger` (red) are used with clear semantic meaning.
- [x] Implemented

### V7-L3 — Award Categories Reference card should move out of the main Awards view
- **Files:** `index.html` lines 888–949
- **Note:** This is the secondary fix for V7-H1. If V7-H1 moves this card to the bottom of the page, this item is auto-complete. If V7-H1 converts it to a modal, add a "Size Guide" button to the Awards toolbar linking to the modal.
- **Done when:** The reference card is not the first content visible when opening Awards.
- [x] Implemented

### V7-L4 — Award form "Previous Winner" fields use placeholder text "1st Place / 2nd Place / 3rd Place" which looks like position codes
- **Files:** `index.html` lines 7067–7083 (award form modal, Previous Winner fields)
- **Root cause:** The award form has three "Previous Winner" fields with placeholder text "1st Place", "2nd Place", "3rd Place". These look like they expect a position code or selection, not a free-text name. A user might type "1st Place" literally rather than entering the winner's name.
- **Fix:** Change placeholder text to `"Winner's name (e.g. Acme Ltd)"`, `"Runner-up name (optional)"`, `"Third place name (optional)"`. Also add a `<small class="text-muted">` label above these three fields: "Previous year's results (optional — for display on award pages)".
- **Done when:** Previous Winner fields clearly communicate they expect company/person names, not position codes.
- [x] Implemented

### V7-L5 — "bitcoin" / "Markets" hidden sidebar item uses cryptocurrency branding in an awards CMS
- **Files:** `index.html` lines 282–289 (`#bitcoin-nav-item`)
- **Root cause:** There is a hidden sidebar item `id="bitcoin-nav-item"` with `id="bitcoin-tab"` and the Bootstrap icon `bi-currency-bitcoin`. The label says "Markets". If RBAC enables this item for certain admin roles, users will see a Bitcoin icon in an awards CMS. This is confusing regardless of context.
- **Fix:** If this feature will be used, rename the id to something business-appropriate (e.g., `#markets-nav-item`) and replace `bi-currency-bitcoin` with `bi-bar-chart-line` or `bi-graph-up`. If the feature is not planned for use, remove the HTML block entirely to reduce dead code.
- **Done when:** No cryptocurrency icon or identifier appears in the sidebar in any RBAC role.
- [x] Implemented

### V7-L6 — "Populated by the areas seed SQL" exposes database implementation language in Settings
- **Files:** `index.html` line 6237
- **Note:** This is the secondary item for V7-M3. V7-M3 covers the full fix; this item is auto-complete when V7-M3 is done.
- **Done when:** Settings > Areas description uses business language. No mention of SQL or seeding.
- [x] Implemented

---

## Notes for Claude (V7)

- **V7-C1 first** — the Test Mode button in production is the most dangerous issue. A click on "Generate Test Data" injects fake records into the live database with no confirmation. The fix is to either add CSS/JS to hide it based on an environment flag, or add a confirmation modal. Check if `app.js` has any environment detection (`window.location.hostname`, a config flag, etc.) to conditionally show this button.
- **V7-H1 (Awards reference card)** — The `#awardCatRefBody` collapse card spans lines 888–949. Moving it: either add it to the bottom of the Awards pane (after the table), or convert it to a modal triggered by a "Size Guide" button in the Awards toolbar. Do NOT delete it — it contains useful reference data.
- **V7-H3 (Assignments modal title)** — The title is in a single `<h5>` at line 7534–7535. The modal content itself is JS-rendered, so only the static HTML title needs updating.
- **V7-H5 (Marketing tab order)** — The tab buttons are in `<ul id="marketingSubTabs">`. The tab panes are inside `<div id="marketing-sub-content">`. Both need to be reordered in parallel. Do not change any `id` attributes — just move the HTML blocks.
- **V7-H6 (Phase column default visible)** — Find where `awardsModule` initialises column visibility (likely an object like `{ phase: false }`) and flip `phase` to `true`. Also update the checkbox initial state in the Tools dropdown. Verify in `awards.js` that the column render path is triggered on first load.
- **V7-M7 (Deal stage labels)** — The stage values in the DB (`lead`, `contacted`, etc.) should not be changed if data already exists. Use a mapping object in `crm.js` to display business-friendly labels. Update the filter `<option>` display text in `index.html` but keep `value` attributes as the DB values.
- **V7-M9 (Winner status "media_sent")** — Check `winners.js` and `database-schema.sql` to confirm whether `media_sent` is a valid DB status. If it exists, add it to the tooltip lifecycle. If it's a legacy value, replace `media_sent` display with "Pack Sent" via a mapping.
- Always run `npm test` and `npm run build` after each commit. All 65 suites must pass.
- Commit format: "Implements V7-C1", "Implements V7-H1, V7-H2, V7-L3" etc.

---

## V8 Audit — 2026-05-14 (Post-V7 follow-up: wiring, HTML bugs, consistency)

> **Focus:** Verifying that V7 fixes landed cleanly, then reading every section with fresh eyes for new first-time-user friction. Key findings: orphaned HTML in entries table, winner status filter completely unwired, Settings is the only major section without a Getting Started banner, btn-outline-info inconsistency, and several missing contextual hints.

---

## V8-CRITICAL

### V8-C1 — Orphaned `<tr>Loading entries...</tr>` sits outside `</tbody>` in the entries table
- **Files:** `index.html` lines 2722–2728
- **Root cause:** The entries table has two `</tbody>` tags. The first closes the real tbody at line 2721. Lines 2722–2727 contain a `<tr>` "Loading entries..." spinner row that is outside any `<tbody>` — invalid HTML. A second stray `</tbody>` closes nothing at line 2728. While browsers may visually hide this, it breaks table semantics, accessibility tools, and will cause issues in strict-mode parsers.
- **Fix:** Delete lines 2722–2728 entirely (the orphaned `<tr>Loading entries...</tr>` block and the second `</tbody>`). The real empty/loading state is already handled by `#entriesEmptyRow` inside the proper `<tbody>`.
- **Done when:** Only one `</tbody>` exists in the entries table, and no `<tr>` content sits outside a `<tbody>`.
- [x] Implemented

---

## V8-HIGH

### V8-H1 — Winner Status filter dropdown is completely unwired — changing it does nothing
- **Files:** `index.html` line 2382 (`#winnerStatusFilter`), `winners.js` `filterWinners()` method
- **Root cause:** `#winnerStatusFilter` has no `data-on-change` handler and `filterWinners()` never reads its value. The filter is visible in the UI but has zero effect. A user who tries to filter winners by "Pack Sent" or "Notified" will see no change and assume the CMS is broken.
- **Fix:** (1) Add `data-on-change="winnersModule.filterWinners"` to the select element in `index.html`. (2) In `winners.js` `filterWinners()`, read the value and apply it: filter by `winner.winner_status === status` (or skip if status is empty).
- **Done when:** Selecting a status in the filter instantly narrows the winners table to matching rows.
- [x] Implemented

### V8-H2 — Winner Status filter has wrong options vs. the actual statusConfig
- **Files:** `index.html` lines 2383–2388 (winner status filter options), `winners.js` statusConfig (line 386–392)
- **Root cause:** The filter shows: Pending / Confirmed / Announced / Pack Sent / Complete. But `statusConfig` defines five statuses: `pending`, `notified`, `pack_sent`, `confirmed`, `published`. Two filter options (`announced`, `complete`) don't exist in the status system and will never match any record. Two real statuses (`notified`, `published`) cannot be filtered at all.
- **Fix:** Replace filter options with exactly the five canonical statuses from `statusConfig`: Pending / Notified / Pack Sent / Confirmed / Published. Remove `announced` and `complete`.
- **Done when:** Every filter option corresponds to a real winner status, and every real status can be filtered.
- [x] Implemented

### V8-H3 — Settings is the only major section without a Getting Started banner
- **Files:** `index.html` — Settings tab pane starting at line 6255
- **Root cause:** Every other primary section has a dismissible numbered Getting Started banner (Awards, Organisations, Winners, Entries, Events, Reports, Marketing, Payments, CRM). Settings opens with eight sub-tabs and no introduction. A first-time admin won't know which tab to visit first, what "Season" means, or that Security/GDPR is where user roles are managed.
- **Fix:** Add a dismissible Getting Started banner at the top of the Settings tab (before the sub-tab nav) explaining the recommended setup order: 1) Programme (name, logo, branding) → 2) Email Settings (sender address, Resend API) → 3) Awards Config (entry fields, scoring) → 4) Season (open/close dates for the current cycle) → 5) Security (user roles, 2FA, GDPR). localStorage key: `settingsWorkflowDismissed`.
- **Done when:** Opening Settings shows a numbered workflow banner on first visit.
- [x] Implemented

### V8-H4 — `btn-info` / `btn-outline-info` remain on ~11 buttons after the V7-L2 partial fix
- **Files:** `index.html` lines 426, 2216, 2232, 2259, 2899, 3555, 5072, 5106, 8104, 9073, 9321
- **Root cause:** V7-L2 replaced `class="btn btn-info"` and `class="btn btn-info text-white"` but missed: (a) `btn-sm btn-info` at line 2216 (Organisations "Assign Award" bulk button), and (b) all `btn-outline-info` instances throughout (media gallery, email builder, events calendar, certificate preview, etc.). These teal buttons are inconsistent with the blue/green/amber/red semantic colour system.
- **Fix:** Change `btn-sm btn-info` → `btn-sm btn-primary` (line 2216). Change `btn-outline-info` → `btn-outline-secondary` for neutral secondary actions (media sync, calendar toggle, crop/rotate, certificate preview, EUR/USD symbol switch in BTC module). Keep `btn-outline-info` only if there is a genuine informational semantic — which there is not in any of these cases.
- **Done when:** No `btn-info` or `btn-outline-info` class appears on interactive buttons in `index.html`.
- [x] Implemented

---

## V8-MEDIUM

### V8-M1 — Dashboard "Top Organisations" metric options have no explanation
- **Files:** `index.html` lines 693–698 (`#topCompaniesMetric` select options)
- **Root cause:** The "View by:" dropdown in the Top Organisations widget offers: Most Active / Top Spenders / Most Awards Won / Recent Activity / Highest Revenue / Newest Members. None of these is defined. "Most Active" is ambiguous — it could mean most entries, most logins, most email opens, or most meetings. Business users may pick the wrong metric for their workflow.
- **Fix:** Add `title` attributes to each `<option>` explaining the metric. e.g. `title="Organisations with the most entries submitted across all awards"` for Most Active; `title="Organisations with the highest total invoice value"` for Top Spenders; etc.
- **Done when:** Hovering any metric option shows a plain-English definition of what it measures.
- [x] Implemented

### V8-M2 — "Apply Season" bulk action button in Awards has no tooltip and an ambiguous label
- **Files:** `index.html` line 1150
- **Root cause:** The Awards bulk-action toolbar has an `"Apply Season"` button (calendar icon, no title attribute). A first-time user won't know what "season" means or what applying it does — it bulk-copies the configured season open/close dates to all selected awards.
- **Fix:** Rename label to `"Apply Season Dates"` and add `title="Copy the configured season open/close dates to all selected awards"`.
- **Done when:** The button label and tooltip make its function obvious without reading documentation.
- [x] Implemented

### V8-M3 — CRM Deals table has no empty-state guidance
- **Files:** `crm.js` (deals render method), `index.html` (CRM deals tab pane)
- **Root cause:** When no deals exist, the Deals table is blank. There is no empty state message explaining how to create the first deal or what a "deal" represents in an awards business (sponsorship opportunity, entry fee negotiation, etc.).
- **Fix:** Add an empty-state row in the deals table render: *"No deals tracked yet — use 'New Deal' to record sponsorship conversations and award fee negotiations."* Match the pattern used in other empty-state tables.
- **Done when:** An empty Deals table shows actionable guidance instead of a blank table.
- [x] Implemented

### V8-M4 — Assignments section has no Getting Started banner
- **Files:** `index.html` — Assignments tab pane
- **Root cause:** The Assignments section (accessible from the sidebar) opens directly into a table of judge-to-entry assignments with no context. How are assignments created? Are they automatic or manual? What happens when a judge is assigned? There is no explanation.
- **Fix:** Add a compact dismissible banner: *"Assignments link judges to specific award entries for blind scoring. Use 'Auto-Assign' to allocate entries automatically, or create individual assignments. Once assigned, judges see entries in the Judge Portal."* localStorage key: `assignmentsWorkflowDismissed`.
- **Done when:** First-time users understand how assignments work and what to do next.
- [x] Implemented

### V8-M5 — Social media "Post Now" button missing its warning tooltip
- **Files:** `index.html` — Social Media compose panel (around line 4390)
- **Root cause:** V7-H7 correctly changed "Post Now" to `btn-outline-warning` but the accompanying V7 audit note also specified adding `title="Posts immediately to all selected platforms — requires API credentials to be configured"`. This tooltip was not added.
- **Fix:** Add `title="Posts immediately to all selected platforms — requires API credentials to be configured"` to the Post Now button.
- **Done when:** Hovering Post Now shows a warning about its immediate and irreversible nature.
- [x] Implemented

---

## V8-LOW

### V8-L1 — "Entry Type" filter label should be "Nomination Source"
- **Files:** `index.html` line 2649
- **Root cause:** The label "Entry Type" filters by self-nominated vs. standard submission. "Type" implies format (written/video/presentation), not origin. The tooltip text is correct but the label misleads users.
- **Fix:** Rename label text from `"Entry Type"` to `"Nomination Source"`. Keep existing tooltip.
- **Done when:** The filter label clearly communicates it distinguishes how an entry was submitted, not what format it is.
- [x] Implemented

### V8-L2 — Media Gallery section has no Getting Started banner
- **Files:** `index.html` — Media Gallery tab pane
- **Root cause:** Media Gallery opens directly into an asset grid with no introduction. Users don't know they can link YouTube playlists for automatic import, or that media uploaded here is linked to winners and organisations across the CMS.
- **Fix:** Add a compact dismissible banner: *"Upload photos and videos from your awards events here. Link a YouTube playlist for automatic import. Media is associated with winners and organisations across the CMS."* localStorage key: `mediaGalleryWorkflowDismissed`.
- **Done when:** First-time users understand what the Media Gallery is for and how to get started.
- [x] Implemented

### V8-L3 — Winner status tooltip on the Status column header does not list all statuses
- **Files:** `index.html` — Winners table Status column `<th>`
- **Root cause:** After fixing V7-M9 (renamed `media_sent` → `pack_sent`), the Status column header tooltip should list all five statuses in lifecycle order. Check that the tooltip reads: "Pending → Notified → Pack Sent → Confirmed → Published" and remove any reference to old status names.
- **Fix:** Verify and update the `<th>` tooltip for the winner status column to match the canonical five-status lifecycle.
- **Done when:** The tooltip lists exactly the five statuses that can appear in the table, in correct lifecycle order.
- [x] Implemented

---

## Notes for Claude (V8)

- **V8-C1 (orphaned tbody)** — Lines 2722–2728 in `index.html`. The structure is: `</tbody>` at 2721, then a stray `<tr>` at 2722–2727 with the "Loading entries..." spinner, then `</tbody>` at 2728. Delete lines 2722–2728 entirely.
- **V8-H1+H2 (winner status filter)** — Two separate fixes: (1) wire up the `data-on-change` attribute in `index.html` and add status filtering to `filterWinners()` in `winners.js`; (2) replace the five filter option values/labels to match statusConfig exactly.
- **V8-H3 (Settings banner)** — Insert the banner inside `<div class="tab-pane fade" id="settings">` before the sub-tab navigation. Use the same card/dismiss pattern as all other Getting Started banners.
- **V8-H4 (btn-outline-info)** — Use `grep -n "btn-outline-info\|btn-sm btn-info" index.html` to find all instances. Replace each with `btn-outline-secondary` unless there is a genuine semantic reason to keep info colour (there isn't).
- **V8-M3 (CRM deals empty state)** — Find the `renderDeals` or equivalent method in `crm.js` that populates the deals table body. Add an `if (deals.length === 0)` empty state row.
- Always run `npm test` and `npm run build` after implementing. All 65 suites must pass, 0 lint errors.
- Branch: `claude/bta-location-restructure-JS5hX`

---

## V9 Audit — 2026-05-14 (Colour semantics, certificate editor, remaining polish)

> **Focus:** Areas not previously audited deeply — certificate template editor, email builder, winner pipeline toolbar, btn-warning semantic consistency, and hardcoded colour styles. The CMS is substantially complete; these are refinement-level issues.

---

## V9-HIGH

### V9-H1 — Certificate Template Editor: X, Y, Width, Font Size fields have no unit indicators
- **Files:** `index.html` lines 9293–9312 (certificate field properties panel)
- **Root cause:** The Certificate Template Editor has numeric inputs for X, Y, Width, and Font Size with no indication of units. A non-technical awards admin placing winner text on a certificate has no idea if "100" means 100px, 100mm, or 100pt. There is no hint text, no example, and no canvas scale reference.
- **Fix:** Add `<small class="text-muted ms-1">(px)</small>` next to X, Y, and Width labels; `<small class="text-muted ms-1">(pt)</small>` next to Font Size label. Add a note below the field list: *"Coordinates start from the top-left corner of the page (0, 0)."*
- **Done when:** A non-technical user can position a field on a certificate without guessing units.
- [x] Implemented

---

## V9-MEDIUM

### V9-M1 — Email Builder "Send to List" button uses `btn-warning` (amber) — wrong semantic
- **Files:** `index.html` line 5101 (`#btnSendCampaign`)
- **Root cause:** The primary send action in the email builder is styled `btn-warning` (amber). In this CMS amber consistently signals "proceed with caution / dangerous action" (Post Now social media, Overdue Reminders). But "Send to List" is the *intended normal outcome* of building an email — a positive primary action, not a cautionary one. Users hesitate at amber primary CTAs.
- **Fix:** Change `btn-warning` → `btn-success` on `#btnSendCampaign`. "Schedule Campaign" is already correctly `btn-primary`.
- **Done when:** The Send to List button is green (success/positive action), not amber.
- [x] Implemented

### V9-M2 — Winner Pipeline button is `btn-warning` (amber) on the Winners toolbar
- **Files:** `index.html` line 2425
- **Root cause:** The "Pipeline" button on the Winners section toolbar opens the winner pipeline dashboard — a read-only management view. It is styled `btn-warning` (amber), implying dangerous or cautionary action, when it is simply a navigation/view button.
- **Fix:** Change `btn-warning btn-sm` → `btn-outline-primary btn-sm` on the Pipeline button.
- **Done when:** The Pipeline button matches the neutral navigation style of the other toolbar buttons.
- [x] Implemented

### V9-M3 — "Conflicts" button in Assignments modal header is cryptic
- **Files:** `index.html` line 7732
- **Root cause:** The button reads "Conflicts" with a shield-exclamation icon. A first-time admin won't know this means "judge conflict of interest declarations". The title tooltip helps on hover but the button text alone is ambiguous — "Conflicts" could refer to scheduling conflicts, data conflicts, or anything else.
- **Fix:** Change button label from `"Conflicts"` to `"Judge Conflicts"`.
- **Done when:** The button text alone communicates it is about judge conflict-of-interest management.
- [x] Implemented

---

## V9-LOW

### V9-L1 — Hardcoded `#6f42c1` purple inline styles used on multiple buttons and panels
- **Files:** `index.html` lines 1154, 2428, 10492, 10502, 10586; `styles.css`
- **Root cause:** Bootstrap 5 does not include a purple theme colour. Several elements use inline `style="background-color:#6f42c1;..."` to create purple buttons and panels: the Awards bulk clone button, the Winner Announcements button, and the Events Summary modal header/card/button. This is inconsistent with the theme system and breaks if branding changes.
- **Fix:** Add a `.btn-purple` utility class to `styles.css` (`background-color:#6f42c1;border-color:#6f42c1;color:#fff`) and replace all inline colour styles with `class="btn btn-purple ..."`. Also add `.bg-purple` for the modal header and card backgrounds.
- **Done when:** No `#6f42c1` inline colour styles remain on interactive elements; all use CSS classes.
- [x] Implemented

### V9-L2 — "Run YouTube Health Check" button is `btn-warning` for a passive diagnostic
- **Files:** `index.html` line 3334
- **Root cause:** The "Run YouTube Health Check" in Media Gallery is `btn-warning` (amber). This operation checks the status of synced YouTube playlists — it is read-only and non-destructive. Amber incorrectly implies danger.
- **Fix:** Change `btn-warning btn-lg` → `btn-outline-secondary btn-lg`.
- **Done when:** The Health Check button is neutral-styled, matching other diagnostic/secondary actions.
- [x] Implemented

### V9-L3 — AI Vetting "Run Vetting" button is `btn-warning` for a primary action
- **Files:** `index.html` line 10787
- **Root cause:** The "Run Vetting" button in the AI Vetting panel is `btn-warning` (amber). Running AI vetting is the primary intended action of this panel — not a destructive or cautionary one. It queries the Claude API to vet an organisation.
- **Fix:** Change `btn-warning` → `btn-primary` on `#runVettingBtn`.
- **Done when:** Run Vetting is styled as a primary action (blue), not a warning.
- [x] Implemented

### V9-L4 — Email Builder sidebar heading "Send Campaign" conflicts with button label "Send to List"
- **Files:** `index.html` line 5049
- **Root cause:** The email builder sidebar panel has a heading `<h6>Send Campaign</h6>` and a button immediately below it labelled "Send to List". Using two different names for the same action in the same panel is confusing — users may think they are different operations.
- **Fix:** Change the `<h6>` heading text from `"Send Campaign"` to `"Send to List"` to match the button.
- **Done when:** The heading and the button use the same label for the same action.
- [x] Implemented

### V9-L5 — Sponsor Portal button has no tooltip explaining what it opens
- **Files:** `index.html` line 2259
- **Root cause:** The "Sponsor Portal" button in Organisations opens a summary dashboard of all sponsor/partner organisations. There is no tooltip or description explaining what it does or how it differs from the main Organisations table.
- **Fix:** Add `title="View a summary dashboard of all organisations marked as sponsors or partners"` to the button.
- **Done when:** Hovering the button gives a plain-English description of what it opens.
- [x] Implemented

---

## Notes for Claude (V9)

- **V9-H1 (certificate units)** — The field properties panel is at `#certFieldProps` (hidden until a field is selected). The inputs are `#certFieldX`, `#certFieldY`, `#certFieldWidth`, `#certFieldFontSize`. Add `<small>` unit hints after each `<label>`.
- **V9-L1 (btn-purple)** — Add to `styles.css`: `.btn-purple { background-color:#6f42c1;border-color:#6f42c1;color:#fff; } .btn-purple:hover { background-color:#5a329a;border-color:#5a329a;color:#fff; } .bg-purple { background-color:#6f42c1 !important; }`. Then replace inline styles in `index.html`.
- **V9-M1/M2/L2/L3** — These are all single-line `btn-warning` → `btn-*` class changes in `index.html`.
- Always run `npm test` and `npm run build` after implementing. All 65 suites must pass, 0 lint errors.
- Branch: `claude/bta-location-restructure-JS5hX`

---

# V10 UX Audit — Button Semantics & Inline Colour Cleanup

## V10-HIGH

### V10-H1 — "Save Draft" button uses `btn-outline-warning` (amber) for a safe action
- **File:** `index.html` line 5117
- **Fix:** `btn-outline-warning` → `btn-outline-secondary`
- [x] Implemented

### V10-H2 — "Tickets" toolbar button uses `btn-outline-warning` for a navigation action
- **File:** `index.html` line 8160
- **Fix:** `btn-outline-warning` → `btn-outline-secondary`
- [x] Implemented

### V10-H3 — "Tag Untagged Photos" uses `btn-warning` for a helpful maintenance task
- **File:** `index.html` line 10681
- **Fix:** `btn-warning` → `btn-outline-primary`
- [x] Implemented

### V10-H4 — "Featured" photos button uses `btn-outline-warning` for a positive editorial action
- **File:** `index.html` line 2745
- **Fix:** `btn-outline-warning` → `btn-outline-secondary`
- [x] Implemented

## V10-MEDIUM

### V10-M1 — AI Vetting info icon on Dashboard KPI card uses `btn-outline-warning`
- **File:** `index.html` line 502
- **Fix:** `btn-outline-warning` → `btn-outline-secondary`
- [x] Implemented

## V10-LOW

### V10-L1 — Three remaining inline `style="color:#6f42c1;"` when `.text-purple` CSS class exists
- **Files:** `index.html` lines 1572, 2195, 8157
- **Fix:** Replace inline colour with `text-purple` class; remove redundant inline styles
- [x] Implemented

---

# V11 UX Audit — First-Run Guidance, Missing Banners & Tooltips

## V11-CRITICAL

### V11-C1 — Email Builder has no Getting Started banner
- **File:** `index.html` line 4823 (inside `#email-builder-content` tab pane)
- **Problem:** Opens straight into a complex 3-column layout with zero guidance.
- **Fix:** Add a 3-step dismissible Getting Started banner above the builder columns.
- [x] Implemented

### V11-C2 — Social Media section has no Getting Started banner
- **File:** `index.html` line 4175 (before `<div class="d-flex justify-content-between...">`)
- **Problem:** Social Media Manager opens with complex layout (platforms, calendar, composer) but no banner.
- **Fix:** Add a 3-step banner: Connect platforms → Compose/generate posts → Schedule or post.
- [x] Implemented

## V11-HIGH

### V11-H1 — AI Vetting result column headers have no tooltips
- **File:** `index.html` lines 10807–10810
- **Fix:** Add `title` attributes to Operational, Category Match, Reputation, AI Findings `<th>` elements.
- [x] Implemented

### V11-H2 — Winners "Pack Sent" status is unexplained in filter
- **File:** `index.html` line 2381 (status filter label)
- **Fix:** Add pipeline info icon with tooltip to Status filter label.
- [x] Implemented

### V11-H3 — Certificate editor modal has no workflow guidance
- **File:** `index.html` line 9239 (modal-body start)
- **Fix:** Add dismissible info alert above the 3-panel layout explaining the workflow.
- [x] Implemented

### V11-H4 — "Requirements" tab label is ambiguous
- **File:** `index.html` line 8266
- **Fix:** Rename to `Special Reqs` with tooltip explaining it covers dietary, accessibility, mobility needs.
- [x] Implemented

### V11-H5 — Attendees modal 9 tabs with no workflow hint
- **File:** `index.html` line 8251 (before `<ul class="nav nav-tabs...">`)
- **Fix:** Add small Required/Optional hint bar above the tab list.
- [x] Implemented

## V11-MEDIUM

### V11-M1 — Winners status filter label gives no pipeline context
- **File:** `index.html` line 2381
- **Combined with V11-H2** — same label; info icon covers both.
- [x] Implemented

### V11-M2 — GDPR section has no intro explaining what it governs
- **File:** `index.html` line 6725 (before `<div id="gdprPanel">`)
- **Fix:** Add a static info alert above the dynamically-rendered panel.
- [x] Implemented

### V11-M3 — Check-In tab has no intro explaining the QR code workflow
- **File:** `index.html` line 8374 (top of `#checkInTab` pane)
- **Fix:** Add brief intro div explaining QR tickets → scan on night → marked checked in.
- [x] Implemented

### V11-M4 — Backup section has no intro distinguishing its three options
- **File:** `index.html` line 6457 (after `<p class="text-muted mb-4">`)
- **Fix:** Improve the existing description text to distinguish Full Backup vs Restore vs Table Export.
- [x] Implemented

## V11-LOW

### V11-L1 — Certificate text colour label is too vague
- **File:** `index.html` line 9334
- **Fix:** Change `Color` label to `Text Colour (solid only)` with tooltip.
- [x] Implemented

### V11-L3 — "Bulk Generate" button in Social Media has no tooltip
- **File:** `index.html` line 4181
- **Fix:** Add `title` attribute explaining it auto-generates posts from winner data.
- [x] Implemented

---

# V12 UX Audit — Form Clarity, Terminology & Help Text

## V12-HIGH

### V12-H1 — Phone input has no format placeholder
- **File:** `index.html` line 1999
- **Fix:** Added `placeholder="+44 7700 900123"` to the phone input in Add Organisation modal.
- [x] Implemented

### V12-H2 — A/B test toggle has no explanation
- **File:** `index.html` line 5102
- **Fix:** Added help text below the toggle explaining what A/B testing does and the 100+ recipient recommendation.
- [x] Implemented

### V12-H3 — AI Vetting config alert points to wrong location
- **File:** `index.html` line 10814
- **Fix:** Updated alert to say "Settings → Integrations → API Keys" with console.anthropic.com link.
- [x] Implemented

### V12-H4 — "Export Selected" buttons give no format hint
- **File:** `index.html` lines 2407, 3621 (Winners and Events)
- **Fix:** Changed label to "Export Selected (CSV)" with `bi-filetype-csv` icon and descriptive tooltip.
- [x] Implemented

## V12-MEDIUM

### V12-M1 — Invoice Type defaults to "Package" with no blank option
- **File:** `index.html` line 7433
- **Fix:** Added blank first option "Select invoice type…" and expanded option labels with brief descriptions.
- [x] Implemented

### V12-M2 — Tax Rate field has no UK VAT context
- **File:** `index.html` line 7452
- **Fix:** Added help text "UK standard VAT is 20%. Set to 0 for zero-rated or VAT-exempt invoices."
- [x] Implemented

### V12-M3 — Webhook Secret label uses developer jargon
- **File:** `index.html` line 7128
- **Fix:** Renamed to "Security Token" and added plain-English explanation below the field.
- [x] Implemented

### V12-M4 — Organisations filter "All Active" silently hides archived records
- **File:** `index.html` line 1706
- **Fix:** Changed default option to "All (Active Only)" to make the filter behaviour explicit.
- [x] Implemented

### V12-M5 — Organisations search placeholder says "Company" not "Organisation"
- **File:** `index.html` line 1641
- **Fix:** Changed placeholder to "Organisation name, email, contact…"
- [x] Implemented

### V12-M6 — CRM Deal Stage filter label has no context
- **File:** `index.html` line 6072
- **Fix:** Added info icon with tooltip listing all stage definitions (Identified through Declined).
- [x] Implemented

### V12-M7 — Stripe key help text doesn't explain test vs live mode
- **File:** `index.html` line 8609
- **Fix:** Updated help text to explain pk_test_ vs pk_live_ and link to Stripe dashboard.
- [x] Implemented

## V12 — NEEDS JAVASCRIPT (noted for awareness, not yet implemented)

### V12-J1 — "Post Now" social media has no confirmation dialog
- Social media Post Now button publishes immediately with no confirmation. Needs a modal.

### V12-J2 — "Send to List" too easy to click before sending a test
- Should prompt user to send test email before allowing full campaign send.

### V12-J3 — "Restore from Backup" has no confirmation modal
- Button should require a typed confirmation ("RESTORE") before overwriting all data.

### V12-J4 — Winner status change has no in-row affordance
- Status badge in Winners table should be clickable to change state directly.

---

# V13 UX Audit — Final Pass: Public Pages & Remaining Gaps

## V13-HIGH

### V13-H1 — Judge Portal has no onboarding for first-time judges
- **File:** `judge-portal.html` line 201
- **Fix:** Added "How judging works" alert above the entries list explaining: select entry → read submission → score criteria → auto-saves. Notes that judging is blind.
- [x] Implemented

## V13-MEDIUM

### V13-M1 — Vote page hides email verification requirement until after button click
- **File:** `vote.html` line 270
- **Fix:** Moved verification note above the Vote Now button as a visible alert-info box explaining that email verification will be required.
- [x] Implemented

### V13-M2 — Financial Reports "By Package Type" and "By Event" are unexplained
- **File:** `index.html` line 5804
- **Fix:** Added info icon tooltip to Report Type label explaining all six report types. Added blank "Select report type…" first option.
- [x] Implemented

## V13-LOW

### V13-L1 — Submit Entry Step 1 subtitle is ambiguous for multi-location businesses
- **File:** `submit-entry.html` line 650
- **Fix:** Changed to "Select the county or city where your business is based or primarily operates."
- [x] Implemented

---

# V14 UX Audit — Deep Tab-by-Tab Audit (7 Parallel Agents, 2026-05-14)

## V14-CRITICAL

### V14-C1 — Award status defaults to "Active" instead of "Draft"
- **File:** `index.html` line 7301
- **Fix:** Moved Draft to first position in Add Award status dropdown. Added descriptive labels to all options (e.g. "Active — open for entries") and added form text: "New awards start as Draft. Change to Active when ready to accept entries."
- [x] Implemented

### V14-C2 — Events Getting Started banner oversimplified (3 steps)
- **File:** `index.html` line 3369
- **Fix:** Expanded from 3 steps to 6: Create Event → Set Ticket Price & Stripe → Share Registration Link → Add & Manage Attendees → Issue QR Code Tickets → Check In Guests on the Night.
- [x] Implemented

### V14-C3 — Special Reqs tab completely blank on load
- **File:** `index.html` line 8806
- **Fix:** Added info alert explaining the tab purpose (accessibility, parking, photo consent, emergency contacts, dress code) and an empty-state message with guidance to add requirements via the Attendees tab.
- [x] Implemented

### V14-C4 — Post-Event tab completely blank on load
- **File:** `index.html` line 8837
- **Fix:** Added info alert explaining what will appear (attendance report, survey results, winner highlights, sponsor ROI, debrief notes) and an empty-state message explaining it becomes active after the event date.
- [x] Implemented

### V14-C5 — "Email Templates" subtab indistinguishable from "Email Builder"
- **File:** `index.html` lines 4073, 4843
- **Fix:** Renamed subtab nav to "Template Library". Added subtitle and an alert-light box in the content panel: "Template Library vs Email Builder: Edit reusable templates here. To compose and send a campaign, use the Email Builder tab."
- [x] Implemented

## V14-HIGH

### V14-H1 — Company Tags vs Award Tags have no explanation of what tagging does
- **File:** `index.html` lines 3042, 3061
- **Fix:** Updated helper text: Company Tags = "video will appear on the tagged company's profile"; Award Tags = "video will appear in the tagged award's gallery".
- [x] Implemented

### V14-H2 — Event Financial Overview uses undefined accounting terms
- **File:** `index.html` lines 3460–3480
- **Fix:** Added title tooltip attributes to Revenue, Costs, Net P&L labels and metric cards explaining what each measures (ticket sales vs invoiced costs vs revenue minus costs).
- [x] Implemented

### V14-H3 — Attendee Type dropdown has no description of each role's effect
- **File:** `index.html` line 8395
- **Fix:** Added `title` tooltip to the select: "Guest = standard attendee. VIP = priority seating & comms. Speaker = listed in agenda. Sponsor = tracked for ROI. Media = press credentials. Staff = bypasses check-in scan."
- [x] Implemented

### V14-H4 — Check-In tab instruction is a single dense paragraph
- **File:** `index.html` line 8475
- **Fix:** Broke into a numbered 3-step list: (1) Before event: issue QR tickets from Tickets tab. (2) On the night: Launch Scanner on any smartphone. (3) Scan each guest's ticket to mark them as Checked In.
- [x] Implemented

### V14-H5 — Tickets tab has 5+ workflows with no "start here" guide
- **File:** `index.html` line 8539
- **Fix:** Added a setup-order note at the top: "Setup order: 1. Set ticket price → 2. Add Stripe key (optional) → 3. Share registration link → 4. Issue QR code tickets."
- [x] Implemented

### V14-H6 — Registration link vs Check-In scanner link not differentiated
- **File:** `index.html` line 8670
- **Fix:** Added "For guests" green badge to registration link and "Staff only" amber badge to check-in scanner link. Added warning: "Do not share with guests."
- [x] Implemented

### V14-H7 — Vendors tab has no purpose explanation
- **File:** `index.html` line 8776
- **Fix:** Added alert-light intro explaining the purpose (all external suppliers in one place), categories (Catering, AV, Photography, etc.), and note to also record costs in the Budget tab.
- [x] Implemented

### V14-H8 — Campaign log status filter has no definitions
- **File:** `index.html` line 5318
- **Fix:** Added info icon with tooltip and title attribute to the filter select: defines Draft, Scheduled, Sending, Sent, Failed, Cancelled. Also improved search placeholder to "Search campaign name or subject...".
- [x] Implemented

### V14-H9 — Social media platform badges are grey "Not Connected" (looks fine)
- **File:** `index.html` line 4693
- **Fix:** Changed all four platform badges from `bg-secondary / Not Connected` to `bg-warning text-dark / Action required` with tooltips. Added amber alert banner above platforms. Changed Configure Platforms to `btn-primary` with updated label.
- [x] Implemented

### V14-H10 — Invoice status lifecycle not explained
- **File:** `index.html` line 5594
- **Fix:** Added info icon to the Status filter label with tooltip explaining the full lifecycle: Draft → Sent → Viewed → Paid/Partially Paid or Overdue → Cancelled. Notes that Stripe auto-updates status.
- [x] Implemented

### V14-H11 — Communications Type vs Topic filters not explained
- **File:** `index.html` line 5963
- **Fix:** Added intro text above filters: "Type = communication method (Email, Phone, etc.) · Topic = subject matter (Sponsorship, Renewal, etc.). Use either or both filters together."
- [x] Implemented

### V14-H12 — Report summary stat cards lack definitions
- **File:** `index.html` line 3781
- **Fix:** Added `title` tooltip attributes and info icons to all four stat cards (Total Awards, Total Organisations, Total Winners, Total Entries) explaining exactly what each counts.
- [x] Implemented

## V14-MEDIUM

### V14-M1 — Bulk YouTube import gives no hint about title auto-import
- **File:** `index.html` line 3105
- **Fix:** Updated alert text: "Video titles are automatically imported from YouTube — no need to enter them manually."
- [x] Implemented

### V14-M2 — Event Comparison modal labels ambiguous (Previous/Current)
- **File:** `index.html` line 3292
- **Fix:** Renamed to "Baseline Event (older / last year)" and "Comparison Event (newer / this year)".
- [x] Implemented

### V14-M3 — Milestones tab card is completely blank
- **File:** `index.html` line 8820
- **Fix:** Added empty-state placeholder explaining what milestones are (pre-event checklist tasks with deadlines) and that they will load once saved.
- [x] Implemented

### V14-M4 — Email Builder Available Variables section hard to find and use
- **File:** `index.html` line 5227
- **Fix:** Improved header to "Dynamic Variables" with info icon explaining auto-substitution. Added "Click any variable to copy it" instruction. Added descriptive tooltips to each variable tag.
- [x] Implemented

### V14-M5 — Email Sequences tab gives no examples of what sequences look like
- **File:** `index.html` line 5437
- **Fix:** Added alert-light box with three common sequence examples: Entry Received → confirmation → payment reminder → voting reminder; Winner Announced → congratulations → media pack → survey; Sponsor Onboarded → welcome → logistics → upgrade offer.
- [x] Implemented

### V14-M6 — Invoice Due Date field has no Overdue logic explanation
- **File:** `index.html` line 7452
- **Fix:** Added form text: "Invoices are automatically marked Overdue if this date passes without full payment."
- [x] Implemented

### V14-M7 — Package Type field in invoice has no context
- **File:** `index.html` line 7482
- **Fix:** Updated label to "Package Type (for tiered sponsorships)", changed blank option to "None — not a tiered package", added form text explaining when to use (Bronze/Silver/Gold sponsorships only, not entry fees or tickets).
- [x] Implemented

### V14-M8 — Auto-Segments AND/OR matching logic has no explanation
- **File:** `index.html` line 6332
- **Fix:** Added title tooltips to AND/OR buttons with concrete examples. Added inline label: "ALL = must match every rule · ANY = matches at least one rule".
- [x] Implemented

---

## V15 — Suggested improvements (post-V14 review), implemented 2026-05-14

### V15-C1 — Dashboard "Pending Reviews" → "Pending Approvals"
- **File:** `index.html` line 395
- **Fix:** Renamed to "Pending Approvals" + added tooltip "Awards in Draft or Pending status waiting to be set Active".
- [x] Implemented

### V15-C2 — Waitlist tab has no explanation of how the waitlist works
- **File:** `index.html` (Waitlist tab)
- **Fix:** Added alert explaining manual promotion flow and confirmation email behaviour.
- [x] Implemented

### V15-C3 — Budget tab: Estimated/Actual/Variance not explained
- **File:** `index.html` (Budget tab)
- **Fix:** Added alert defining Estimated, Actual, and Variance with positive/negative guidance.
- [x] Implemented

### V15-C4 — Seating Chart entry point has no tooltip
- **File:** `index.html` line 8301 (attendees modal tools dropdown)
- **Fix:** Added descriptive title tooltip to "Shareable Seating Chart" dropdown item.
- [x] Implemented

### V15-H2 — Entries Getting Started implies "Add Entry" admin button exists
- **File:** `index.html` (entries Getting Started step 2)
- **Fix:** Added note: "there is no manual 'Add Entry' button — all entries must be submitted through the public form."
- [x] Implemented

### V15-H4 — AI Vetting Actions column has no tooltip
- **File:** `index.html` line 11005
- **Fix:** Added tooltip to "Actions" column header explaining available actions.
- [x] Implemented

### V15-H5 — Season selector help text too brief
- **File:** `index.html` line 7361 (award form)
- **Fix:** Expanded help text to explain auto-fill scope and Settings → Award Seasons management.
- [x] Implemented

### V15-H6 — Award Judging Panel modal title has no subtitle
- **File:** `index.html` line 7873
- **Fix:** Added subtitle "— assign judges & manage nominees for this category".
- [x] Implemented

### V15-H7 — Outstanding Balance stat card misleads (only partially-paid)
- **File:** `index.html` line 5621
- **Fix:** Improved tooltip to explain partially-paid scope. Added "(Partial pay)" label.
- [x] Implemented

### V15-H8 — Send Overdue Reminders button has no explanation
- **File:** `index.html` line 5671
- **Fix:** Added tooltip describing recipients, trigger condition, and confirmation step.
- [x] Implemented

### V15-H9 — Year-over-Year chart has no subtitle explaining what is compared
- **File:** `index.html` line 3882
- **Fix:** Added subtitle: "Compares Entries, Winners, and Organisations across the last 3 calendar years."
- [x] Implemented

### V15-H10 — Social media Schedule Time has no timezone indication
- **File:** `index.html` (social media scheduling)
- **Fix:** Added "Times are in your browser's local timezone" note below time input.
- [x] Implemented

### V15-H11 — From Email field has no sender verification reminder
- **File:** `index.html` (Email Builder sidebar)
- **Fix:** Added form-text noting domain must be verified in Resend with link.
- [x] Implemented

### V15-H12 — Check-In Rate progress bar has no denominator explanation
- **File:** `index.html` (Events check-in tab)
- **Fix:** Added tooltip: "Checked-in guests ÷ guests with RSVP status 'Attending'."
- [x] Implemented

### V15-M1 — Export Data buttons have no per-button descriptions
- **File:** `index.html` (Reports Export section)
- **Fix:** Added title tooltips to each export button describing the included columns.
- [x] Implemented

### V15-M2 — Pipeline Summary "Visual" column name is unclear
- **File:** `index.html` line 3920
- **Fix:** Renamed "Visual" → "Trend" with tooltip explaining it's a mini progress bar.
- [x] Implemented

### V15-M3 — Deal Win Rate stat card tooltip does not define the calculation
- **File:** `index.html` line 6107
- **Fix:** Updated tooltip with full definition: Confirmed ÷ (Confirmed + Declined).
- [x] Implemented

### V15-M4 — Meetings Duration column has no entry guidance
- **File:** `index.html` line 6244
- **Fix:** Added tooltip explaining where to enter duration when logging a meeting.
- [x] Implemented

### V15-M5 — My Tasks heading does not distinguish personal vs team tasks
- **File:** `index.html` (CRM My Tasks tab)
- **Fix:** Added subtitle explaining tasks are personal (assigned to current user), vs team-wide communications log.
- [x] Implemented

### V15-M6 — Smart Segment result area is blank before first run
- **File:** `index.html` line 6388
- **Fix:** Added placeholder text "Click Apply Segment to preview matching organisations."
- [x] Implemented

### V15-M7 — Content Calendar has no usage instructions
- **File:** `index.html` (Marketing Content Calendar tab)
- **Fix:** Updated subtitle with workflow: schedule in Social Media tab → appears here → click to edit/cancel.
- [x] Implemented

### V15-M8 — Awards Getting Started references wrong icon ("trophy icon")
- **File:** `index.html` line 933
- **Fix:** Corrected to "people icon (bi-people-fill)" which matches the actual button rendered by awards.js.
- [x] Implemented

### V15-M9 — Flagged Companies card gives no guidance on next steps
- **File:** `index.html` line 10949
- **Fix:** Added action guidance: "review AI findings, then either approve (override to Pass) or disqualify from the shortlist".
- [x] Implemented

---

## ═══════════════════════════════════════════════
## V16 AUDIT — 5-Agent Comprehensive Audit (2026-05-20)
## Business Logic · Workflows · Accessibility · Mobile · Terminology · First-Run
## ═══════════════════════════════════════════════

> **CLAUDE: If any V16 items are still `[ ]`, start here before doing anything else.**
> Sources: 5 parallel agents covering (1) Dashboard/Awards/Orgs/Entries, (2) Events/Payments/Email,
> (3) Assignments/CRM/Settings/Cross-cutting, (4) Accessibility/Mobile/Terminology/First-run,
> (5) Business logic & workflow integrity.
> Items are ordered strictly: V16-C → V16-H → V16-M → V16-L.

---

## V16-CRITICAL — Data integrity and workflow-blocking bugs

### V16-C1 — Email campaign can be sent to 0 recipients without error
- **File:** `email-builder.js` — `sendCampaign()` around line 2604
- **Root cause:** After counting subscribers, if `count === 0` the code still shows the confirmation dialog and allows send. The RPC will silently send to nobody, logging a fake campaign record.
- **Fix:** After `const count = countResult.count || 0;`, add:
  ```js
  if (count === 0) {
    utils.showToast('This email list has no active subscribers. Add subscribers before sending.', 'warning');
    return;
  }
  ```
- **Done when:** Attempting to send to an empty list shows a warning toast and aborts — no confirmation dialog is shown.
- [x] Implemented

### V16-C2 — Invoice can be deleted when linked payments exist (orphaned payment records)
- **File:** `payments.js` — `deleteInvoice()` around line 965
- **Root cause:** The function deletes invoices and their line items but does not check for linked payment records. Deleting a paid invoice leaves orphaned `payments` rows referencing a non-existent `invoice_id`.
- **Fix:** Before deleting, query `payments` table for `invoice_id = invoiceId`. If any payments exist, block with an error toast: "Cannot delete this invoice — it has linked payment records. Delete the payments first, or void the invoice instead."
- **Done when:** Attempting to delete an invoice with linked payments shows the error and aborts.
- [x] Implemented

### V16-C3 — Entry status allows any transition (no state machine)
- **File:** `entries.js` — `updateEntryStatus()` and inline status dropdown rendering
- **Root cause:** The status dropdown shows all 6 statuses at all times. A user can jump from `draft` straight to `winner`, or revert from `winner` back to `draft` with no guard.
- **Fix:** Add a `VALID_TRANSITIONS` map and filter the dropdown to only show allowed next states:
  ```js
  const VALID_TRANSITIONS = {
    draft:        ['submitted', 'rejected'],
    submitted:    ['under_review', 'rejected'],
    under_review: ['shortlisted', 'rejected'],
    shortlisted:  ['winner', 'rejected', 'under_review'],
    winner:       ['shortlisted'],      // allow reverting to shortlisted only
    rejected:     ['under_review'],     // allow re-opening for review
  };
  ```
  Filter `<option>` elements so only valid next states (plus current state) are rendered. Apply in both the table inline dropdown and the detail modal dropdown.
- **Done when:** An entry with status `submitted` only shows `under_review` and `rejected` as options (not `draft`, `shortlisted`, or `winner`). An admin can still override by selecting the current status (no-op).
- [x] Implemented

### V16-C4 — Refund does not update invoice status to "Refunded"
- **File:** `payments.js` — `recordRefund()` or the refund action handler
- **Root cause:** When a refund is recorded, the payment record gets a `refunded` status but the linked invoice `payment_status` stays as `paid`. The invoice still appears as "Paid" in the list and in reports, hiding the fact that money was returned.
- **Fix:** After saving the refund, update the linked invoice: set `payment_status = 'refunded'` and `status = 'refunded'` (or `sent` if partial). Also adjust `paid_amount` downwards by the refund amount and recalculate `balance_due`.
- **Done when:** Recording a refund for a fully-paid invoice changes the invoice status badge to "Refunded" immediately.
- [x] Implemented

---

## V16-HIGH — Significantly degrades experience for new users

### V16-H1 — Icon-only action buttons missing aria-labels in table rows
- **File:** `index.html` — all table rows with edit/delete icon buttons
- **Root cause:** Buttons like `<button class="btn btn-sm btn-outline-danger"><i class="bi bi-trash"></i></button>` have no text, no `aria-label`, and no `title` visible on hover. Screen readers announce "button" with no context; mouse users get no tooltip.
- **Fix:** Ensure every icon-only action button has both `title="Delete award"` (for tooltip) and `aria-label="Delete award"` (for screen readers). Audit all tables: Awards, Organisations, Entries, Payments, CRM, Events. Use `aria-label` values like "Edit [module name]", "Delete [module name]".
- **Done when:** Hovering any icon-only button in any table shows a descriptive tooltip; no bare "button" announcements for screen reader users.
- [x] Implemented

### V16-H2 — Empty states lack calls-to-action buttons
- **File:** `index.html` — empty state messages across all tabs
- **Root cause:** Most empty states say "No X found" but the create button is elsewhere in the toolbar, invisible from the empty state. New users don't know how to proceed.
- **Fix:** For each key empty state add an inline action button:
  - Awards: "No awards yet — <button>Create your first award</button>"
  - Organisations: "No organisations yet — <button>Add Organisation</button>"
  - CRM Communications: "No communications logged — <button>Log First Communication</button>"
  - Email Lists: already has a note, but add a button
  Buttons should call the same open-modal function as the toolbar button (wire with `data-action`).
- **Done when:** Each major empty state has a visible CTA button that opens the create modal directly.
- [x] Implemented

### V16-H3 — "Company" vs "Organisation" terminology inconsistency
- **File:** `crm.js`, `assignments.js`, `index.html`
- **Root cause:** The database uses `organisations` table. The UI uses "organisation" in most places but CRM module uses "Company" in column headers and form labels. `assignments.js` uses "Remove company from award" in toasts.
- **Fix:**
  - `crm.js`: Replace "Company" column header → "Organisation" in rendered table rows
  - `assignments.js`: Replace "Remove company" toast → "Remove organisation"
  - `index.html`: Audit all CRM-related form labels for "Company" → "Organisation"
- **Done when:** The word "company" does not appear in any user-visible UI label, button, or toast (except where the actual database field is `company_name` which is fine in a data context).
- [x] Implemented

### V16-H4 — Judge portal URL not surfaced to admin
- **File:** `index.html` — Assignments tab or Settings
- **Root cause:** The judge portal is at a public URL (e.g. `/judge-portal.html`) but admins have no way to see or copy this URL from inside the CMS. New admins don't know where to direct judges.
- **Fix:** In the Assignments tab toolbar or the Judge panel, add a "Judge Portal URL" info box showing the URL (constructed from `window.location.origin + '/judge-portal.html'`) with a copy-to-clipboard button.
- **Done when:** An admin can see and copy the judge login URL from within the Assignments tab without needing to know the domain structure.
- [x] Implemented

### V16-H5 — Confirmation dialogs on destructive actions are inconsistent
- **File:** `awards.js`, `entries.js`, `organisations.js`, `events.js`, `payments.js`
- **Root cause:** Some delete actions use `utils.confirmDialog({ danger: true })` (red confirm button), others use the default (no danger styling), and a few have no confirmation at all.
- **Fix:** Audit all delete/purge/archive operations. Ensure every one uses `utils.confirmDialog({ danger: true, confirmText: 'Delete' })`. Add `danger: true` to the invoice deletion dialog, award deletion dialog, and any others missing it.
- **Done when:** All destructive action confirmation buttons are styled red via `danger: true`.
- [x] Implemented

### V16-H6 — No visible indication of which entries have uploaded documents
- **File:** `entries.js` — table row rendering, `index.html`
- **Root cause:** Entries with supporting documents look identical to those without. An admin doing a completeness review has no way to quickly scan which entries have documents attached.
- **Fix:** In the entries table, add a small file icon badge (e.g. `<i class="bi bi-paperclip text-muted" title="Has documents"></i>`) to rows where the entry has `entry_files` records. Fetch the count during `loadEntries()` via a join or a batch query.
- **Done when:** Entries with attached files show a paperclip icon in their table row; entries without show nothing.
- [x] Implemented

---

## V16-MEDIUM — Visible friction for regular users

### V16-M1 — Entries remain editable after shortlist/winner status
- **File:** `entries.js` — entry detail modal form
- **Root cause:** Entry content fields (title, description, answers) remain editable even when status is `shortlisted` or `winner`. An accidental edit after judging could alter the winning entry content.
- **Fix:** In the entry detail modal, when `entry.status` is `shortlisted` or `winner`, set all content input fields to `disabled` or `readonly`. Show a banner: "This entry has been shortlisted/selected as winner. Content is locked — change status to edit." Include an admin override button for superadmin role.
- **Done when:** Opening a `winner` entry in the edit modal shows all content fields as read-only.
- [x] Implemented

### V16-M2 — Same event attendee can be added twice (admin side)
- **File:** `events.js` — `addAttendee()` around line 1227
- **Root cause:** The admin attendee-add function doesn't check if the email already exists in the attendees list. The same person can be added multiple times.
- **Fix:** Before pushing the new attendee, check if any existing attendee has the same `email` (case-insensitive). If so, show: "An attendee with this email is already on the list." and abort.
- **Done when:** Adding an attendee with the same email twice shows an error and doesn't duplicate.
- [x] Implemented

### V16-M3 — Same email campaign can be sent twice (no idempotency)
- **File:** `email-builder.js` — `sendCampaign()`
- **Root cause:** If an admin clicks "Send" twice quickly, or re-opens a sent campaign and sends again, the RPC fires twice, double-sending to all subscribers.
- **Fix:** After a successful send, set a flag on the builder instance (e.g. `this._campaignAlreadySent = true`) and check it at the top of `sendCampaign()`. If already sent, show: "This campaign was already sent. Create a new campaign to send again." Clear the flag on `clearCanvas()`.
- **Done when:** Pressing Send on an already-sent campaign shows the warning and does not call the RPC again.
- [x] Implemented

### V16-M4 — Date format not locale-aware (GB users expect DD/MM/YYYY)
- **File:** `entries.js`, `payments.js`, `events.js`, `awards.js` — date display in table rows
- **Root cause:** Dates are displayed using `toLocaleDateString()` without a locale option, defaulting to the browser locale. GB users typically want DD/MM/YYYY but US browsers show MM/DD/YYYY.
- **Fix:** Replace bare `toLocaleDateString()` calls with `toLocaleDateString('en-GB')` throughout all modules. This forces `DD/MM/YYYY` format consistently regardless of browser locale.
- **Done when:** All displayed dates use `en-GB` locale (DD/MM/YYYY format).
- [x] Implemented

### V16-M5 — Filter "Clear All Filters" button missing across all tabs
- **File:** `index.html`, `entries.js`, `awards.js`, `organisations.js`
- **Root cause:** When multiple filters are active, users must clear them one by one (reset search box, reset status dropdown, reset date dropdown). There is no single "Clear All" button.
- **Fix:** Add a "Clear Filters" button next to the filter bar on the Entries, Awards, Organisations, and Payments tabs. It should reset all filter inputs to default and call the load function. Hide the button when no filters are active (check if any filter differs from default).
- **Done when:** An active filter state shows a "Clear Filters" button; clicking it resets all filters and reloads.
- [x] Implemented

### V16-M6 — Required form fields marked inconsistently
- **File:** `index.html` — all major create/edit forms
- **Root cause:** Some forms show `<span class="text-danger">*</span>` on required fields; others have no visual indicator. New users don't know what's mandatory until they hit a validation error.
- **Fix:** Add a `<small class="text-muted d-block mb-2">* Required fields</small>` legend at the top of every modal form that has required fields. Ensure all `required` HTML inputs also have a visible asterisk label.
- **Done when:** All create/edit modals show a required-fields legend; required inputs have visual asterisks.
- [x] Implemented

### V16-M7 — Loading state missing in CRM "Log Communication" modal org dropdown
- **File:** `crm.js` — communication modal open handler
- **Root cause:** When the log-communication modal opens, the organisations dropdown loads asynchronously. If data takes 2-3 seconds, the dropdown appears empty and users think it's broken.
- **Fix:** Show `<option disabled selected>Loading organisations…</option>` while the data loads. Replace with real options after the fetch completes.
- **Done when:** Opening the Log Communication modal shows "Loading organisations…" in the dropdown until data arrives.
- [x] Implemented

---

## V16-LOW — Polish and accessibility

### V16-L1 — Aria-live regions missing on toast notifications
- **File:** `app.js` or `utils.js` — toast display function
- **Root cause:** Success/error toasts are visually shown but not announced to screen readers because the container lacks `aria-live="polite"` or `role="alert"`.
- **Fix:** Ensure the toast container element has `aria-live="polite"` and `aria-atomic="true"`. Error toasts should use `aria-live="assertive"`.
- **Done when:** Screen readers announce toasts when they appear.
- [x] Implemented

### V16-L2 — "Entry" vs "Submission" vs "Application" used inconsistently
- **File:** `index.html`, `entries.js`, `entry-proxy.js`
- **Root cause:** Most places say "entry" but a few buttons/messages say "submission" or "application". Standardise on "entry" throughout.
- **Fix:** Search for "submission" and "application" in user-visible text in `index.html` and `entries.js`. Replace with "entry"/"entries" where referring to the entries module.
- **Done when:** "submission" and "application" do not appear in UI-facing strings in the entries context.
- [x] Implemented

### V16-L3 — Sidebar icon-only collapsed mode lacks tooltips
- **File:** `index.html` — sidebar nav links
- **Root cause:** When the sidebar collapses to icon-only, labels are hidden. Navigation links lack `title` attributes so users cannot identify icons by hovering.
- **Fix:** Add `title="Dashboard"`, `title="Awards"`, etc. to each `<a>` or `<li>` in the sidebar nav so icon-only mode still shows hover tooltips.
- **Done when:** Hovering any collapsed sidebar icon shows a tooltip with the section name.
- [x] Implemented

### V16-L4 — Modal close behavior inconsistent (auto-close vs manual)
- **File:** Multiple modules — modal success handlers
- **Root cause:** Some modals auto-close after a successful save; others stay open requiring manual close. Users become confused about whether the action succeeded.
- **Fix:** Standardise: after any successful create/update operation in a modal, auto-hide the modal after showing the success toast (1 second delay). Use `setTimeout(() => modal.hide(), 1000)` pattern. Do NOT auto-close on error or warning.
- **Done when:** All create/edit modals close automatically 1 second after a successful save.
- [ ] Implemented

---

## Seventeenth Audit — V17 (2026-05-20)

> 5-agent comprehensive audit covering all tabs, pages, and aspects of the CMS. Focus: new-user UX, workflow integrity, security, accessibility, mobile, performance.

---

## V17-CRITICAL — Must fix before any user sees this system

### V17-C1 — Judge portal shows ALL submitted entries, not just assigned ones
- **File:** `judge-portal.js` — `_fetchPage()`
- **Root cause:** Query filtered by `status: 'submitted'` with no judge_email filter. Any authenticated judge could view every entry in the system, breaking blind assignment.
- **Fix:** First fetch `judge_scores` for the current judge to get assigned entry IDs, then filter entries to `id@in` those IDs.
- [x] Implemented

### V17-C2 — Manual company assignment ignores conflict of interest registry
- **File:** `assignments.js` — `assignCompany()`
- **Root cause:** `hasConflict()` exists and is used in read-only `openConflictManager()`, but was never called during manual assignment. Automated batch path enforced conflicts; manual path had zero enforcement.
- **Fix:** Fetch all judge_scores for the award, check each judge email for conflicts with the org, show a blocking danger confirmation if any conflicts found.
- [x] Implemented

---

## V17-HIGH — Fix before production launch

### V17-H1 — Deleting a winner does not revert the entry status
- **File:** `winners.js` — `deleteWinner()`
- **Root cause:** Only deleted the winner record; entry remained at `status: 'winner'` with no winner record.
- **Fix:** After deletion, look up matching entry by `organisation_id + award_id + status='winner'` and update it to `status: 'shortlisted'`.
- [x] Implemented

### V17-H2 — Press release photo thumbnails broken (wrong field name)
- **File:** `winners.js` — lines 1069 and 1399
- **Root cause:** `photo.media_url` used but `winner_media` table stores `file_url`. Two thumbnail `<img>` tags in press release builder showed broken images.
- **Fix:** Replace both `photo.media_url` with `photo.file_url`.
- [x] Implemented

### V17-H3 — Entry inline status dropdown bypasses state machine
- **File:** `entries.js` — `inlineUpdateEntryStatus()` and `saveEntryEdit()`
- **Root cause:** `getEntryStatusOptions()` disables invalid options in the UI, but the save functions write whatever value is submitted without a server-side transition check. A POST with a skipped status would succeed.
- **Fix:** Add `validateTransition(currentStatus, newStatus)` guard in both `inlineUpdateEntryStatus` and `saveEntryEdit` before any DB write.
- [ ] Implemented

### V17-H4 — `why_should_win` field not locked for shortlisted/winner entries
- **File:** `entries.js` — `editEntry()` content-locking block
- **Root cause:** Content locking (added in V16) only covers `editEntryTitle`, `editEntryDescription`, `editEntrySupportingInfo`. The primary judged narrative field `editEntryWhyWin` is still editable after shortlisting.
- **Fix:** Add `'editEntryWhyWin'` to the `contentFieldIds` array in the content-locking block.
- [ ] Implemented

### V17-H5 — Entry number race condition in submission proxy
- **File:** `api/entry-proxy.js` — `generateEntryNumber()`
- **Root cause:** Read-then-write pattern — two concurrent submissions can read the same MAX(entry_number) and generate identical entry numbers. No DB sequence or unique constraint.
- **Fix:** Use a PostgreSQL sequence (`CREATE SEQUENCE bta_entry_seq`) and add `UNIQUE` constraint on `entry_number`. Or use `pg_advisory_lock` around the generate+insert.
- [ ] Implemented

### V17-H6 — No confirmation email on event registration (false claim in UI)
- **File:** `api/registration-proxy.js`, `register.html`
- **Status:** Already fixed — `registration-proxy.js` sends a Resend confirmation email after successful insert.
- [x] Implemented

### V17-H7 — GDPR SAR export missing tables
- **File:** `gdpr.js` — `_exportEntityData()`
- **Status:** Already fixed — export includes invoices, payments, crm_communications, crm_deals, crm_meetings, organisation_notes, organisation_follow_ups.
- [x] Implemented

### V17-H8 — GDPR erasure delete missing CRM tables
- **File:** `gdpr.js` — `_deleteEntityData()`
- **Status:** Already fixed — erasure deletes crm_communications, crm_deals, crm_meetings, organisation_notes, organisation_follow_ups.
- [x] Implemented

### V17-H9 — Organisation permanentDelete missing CRM/invoice tables
- **File:** `organisations.js` — `permanentDelete()`
- **Status:** Already fixed — deletion cascade includes crm_communications, crm_deals, crm_meetings, invoices, payments.
- [x] Implemented

### V17-H10 — Award deletion orphans linked entries
- **File:** `awards.js` — `deleteAward()` and `bulkDelete()`
- **Status:** Already fixed — both functions query entry count before deletion and show a warning in the confirmation dialog.
- [x] Implemented

### V17-H11 — Bulk status change in Entries bypassed state machine
- **File:** `entries.js` — `executeBulkAction()`
- **Status:** Already fixed — per-entry `ENTRY_VALID_TRANSITIONS` check, skipped entries are counted and reported.
- [x] Implemented

### V17-H12 — Reporting export ignores year filter
- **File:** `reporting.js` — all export functions
- **Root cause:** Export functions call `loadReportData()` but don't pass the active year filter to the query.
- **Fix:** Pass `STATE.selectedYear` or the active report filter to export queries.
- [ ] Implemented

### V17-H13 — Dashboard date range filter buttons have no effect on KPIs
- **File:** `dashboard.js` — `updateStats()`
- **Root cause:** `_getDateRangeFilter()` is defined and called by `setDateRange()` but `updateStats()` never passes the result as a filter to its `apiClient.select()` calls.
- **Fix:** Pass date range filter as `created_at >=` filter in each KPI query inside `updateStats()`.
- [ ] Implemented

### V17-H14 — Scheduled email campaigns are never auto-sent
- **File:** `api/automation-scheduler.js` and `email-builder.js`
- **Root cause:** Users can schedule campaigns with a future date, but no server-side cron polls `email_campaigns` for `status='Scheduled'` and sends them.
- **Fix:** Add a check in `automation-scheduler.js` for campaigns with `send_at <= now` and `status='Scheduled'`, and trigger sending via the `send_campaign_emails` RPC.
- [ ] Implemented

### V17-H15 — Mobile sidebar has no hamburger button
- **File:** `index.html`, `app.js`, `styles.css`
- **Status:** Already fixed — `#sidebarToggle` button exists in navbar, `app.js` line 2118 wires it up.
- [x] Implemented

### V17-H16 — API key / credential fields shown as plaintext
- **File:** `index.html`, `settings.js`
- **Status:** Already addressed — webhook secret uses `type="password"` with show/hide toggle; Stripe publishable key is intentionally public. No secret API keys are stored via the UI.
- [x] Implemented

---

## V17-MEDIUM — Fix before stable release

### V17-M1 — No votes IP-based rate limiting (email-only throttle)
- **File:** `api/voting-proxy.js`
- **Root cause:** `RATE_LIMIT_MAX = 10` per email per hour, but `voter_ip` is stored and never checked. Multiple votes from same IP with different emails are not throttled.
- **Fix:** Add a parallel IP-based check alongside the email check.
- [ ] Implemented

### V17-M2 — Live vote counts visible to voters (influences tactical voting)
- **File:** `vote.html`
- **Root cause:** Real-time `public_votes` count is shown to any visitor, which may encourage tactical voting against leading candidates.
- **Fix:** Consider hiding counts until voting closes, or add an admin config flag to control visibility.
- [ ] Implemented

### V17-M3 — No progress saved mid-wizard on public entry submission
- **File:** `submit-entry.html`
- **Root cause:** Leaving the page mid-wizard discards all form data. No `localStorage` persistence or server-side draft.
- **Fix:** Persist `formData` to `localStorage` on every `nextStep()` call and restore on page load.
- [ ] Implemented

### V17-M4 — No CAPTCHA on public entry submission form
- **File:** `submit-entry.html`, `api/entry-proxy.js`
- **Root cause:** No bot protection on entry submission — a bot can submit unlimited entries.
- **Fix:** Add Cloudflare Turnstile or a hidden honeypot field with server-side check.
- [ ] Implemented

### V17-M5 — Judge portal no auto-save (lost work risk)
- **File:** `judge-portal.js`
- **Root cause:** Scores are only persisted on explicit "Submit Score"/"Save Draft" clicks. Closing tab mid-scoring loses all work.
- **Fix:** Add debounced `localStorage` auto-save on slider input events, or `setInterval` draft save every 60 seconds.
- [ ] Implemented

### V17-M6 — Judge portal two-column layout breaks on mobile
- **File:** `judge-portal.html`
- **Root cause:** `grid-template-columns: 350px 1fr` has no `@media` breakpoints below 700px.
- **Fix:** Add `@media (max-width: 768px) { .entries-grid { grid-template-columns: 1fr; } }`.
- [ ] Implemented

### V17-M7 — Conflict score included in averages without flag
- **File:** `judge-portal.js` — `checkConflictOfInterest()`
- **Root cause:** A judge who declares a conflict still has scores included in `average_score`. Scores with `has_conflict: true` and `isComplete: true` are saved normally.
- **Fix:** Either exclude conflict scores from averages, or trigger an admin review queue for conflict-flagged scores.
- [ ] Implemented

### V17-M8 — CRM still has residual "Company/Companies" strings
- **File:** `crm.js` — view deal/communication/meeting modals, segment titles, filter dropdown
- **Root cause:** V16 audit fixed most but missed: "Company:" labels in detail modals, "Companies in segment" title, "View Companies" button, "All Companies" filter option, empty state text.
- **Fix:** Replace remaining user-visible "Company"/"Companies" with "Organisation"/"Organisations".
- [ ] Implemented

### V17-M9 — Awards rollover uses paginated STATE.allAwards (incomplete data)
- **File:** `awards.js` — `rolloverToNextYear()`
- **Root cause:** `STATE.allAwards` in server-pagination mode only holds the current page (50 records). Awards on other pages are silently excluded from rollover.
- **Fix:** Replace `STATE.allAwards` with `apiClient.selectAll('awards', { filters: { year: sourceYear } })`.
- [ ] Implemented

### V17-M10 — Assignment removal leaves orphaned judge_scores
- **File:** `assignments.js` — `removeAssignment()`
- **Root cause:** When an assignment is removed, `judge_scores` rows for that judge/entry persist and continue to affect average_score calculations.
- **Fix:** On removal, cascade-delete orphaned `judge_scores` rows, or mark them `voided`.
- [ ] Implemented

### V17-M11 — Organisation CSV import has no required-column check
- **File:** `organisations.js` — `parseCSVText()`
- **Root cause:** `_validateImportRow()` validates values but never checks that required column headers are present. A CSV without `company_name` column imports silently with blank names.
- **Fix:** Before import wizard proceeds, verify `this._csvHeaders` contains at least `company_name`.
- [ ] Implemented

### V17-M12 — Organisation logo upload has no byte-size limit
- **File:** `organisations.js` — `validateAndUploadLogo()`
- **Root cause:** Enforces 250×170 px dimensions but no maximum file size. A valid 250×170 image could be multi-megabyte.
- **Fix:** Add `if (file.size > 2 * 1024 * 1024) { showError; return; }` before the FileReader call.
- [ ] Implemented

### V17-M13 — Organisation Excel export omits custom fields
- **File:** `organisations.js` — export function
- **Root cause:** Export builds rows from fixed `org` fields only; `organisation_custom_fields` are never fetched or included.
- **Fix:** Fetch custom fields per-org in the export loop and append as extra columns.
- [ ] Implemented

### V17-M14 — Dashboard notification items navigate nowhere
- **File:** `dashboard.js` — `loadNotifications()`
- **Root cause:** Notifications using `data-action="dashboardModule.navigateToSection"` have no `data-id` attribute, so `navigateToSection(undefined)` is called.
- **Fix:** Serialise the target section ID into a `data-id` attribute when rendering notification action links.
- [ ] Implemented

### V17-M15 — URL hash routing doesn't persist sub-tab state
- **File:** `app.js` — hash routing
- **Root cause:** `history.replaceState` tracks top-level tab switches but not sub-tab state (e.g. Settings → Security, Payments → Invoices). Reloading the page loses sub-tab position.
- **Fix:** Extend hash routing to include active sub-tab (e.g. `#organisations/sponsors`).
- [ ] Implemented

### V17-M16 — Breadcrumbs only exist in Media Gallery
- **File:** `index.html`, all modules with detail drill-downs
- **Root cause:** No breadcrumb or back-navigation when drilling into record detail in any module except Media Gallery.
- **Fix:** Implement a shared breadcrumb component using the existing pattern in `app.js:2016` and apply it consistently.
- [ ] Implemented

### V17-M17 — Getting Started banner disappears after first record created
- **File:** `dashboard.js` — banner display logic
- **Root cause:** `hasData = awardsCount > 0 || orgsCount > 0` — creating even one record hides the banner permanently. No per-step completion state.
- **Fix:** Change banner logic to show until all four steps (Organisations, Awards, Events, Marketing) are individually completed. Persist per-step state.
- [ ] Implemented

### V17-M18 — Assignments (judge workflow) has no sidebar entry
- **File:** `index.html` — sidebar nav
- **Root cause:** Assignments is only accessible via Awards table row action buttons. New users following Getting Started steps will never discover the judging workflow.
- **Fix:** Add an "Assignments" link to the Programme sidebar group, or as a sub-item under Awards.
- [ ] Implemented

### V17-M19 — Marketing sequence can be saved with empty email body
- **File:** `marketing.js` — `_saveSequence()`
- **Root cause:** Guard checks `steps.length === 0 || !steps[0].subject` but allows a step with a subject and empty body.
- **Fix:** Validate that all steps have both subject and body before saving.
- [ ] Implemented

### V17-M20 — Revision history invisible to admins (feature exists but unreachable)
- **File:** `entries.js`, `index.html`
- **Root cause:** `entry-revision.js` is loaded and works, but `renderRevisionHistory`/`renderRevisionReview` are never called from the Entries tab UI.
- **Fix:** Add a "Revisions" button or tab to the entry view/edit modal calling `entryRevisionModule.renderRevisionReview(entryId)`.
- [ ] Implemented

---

## V17-LOW — Polish when time permits

### V17-L1 — Missing `aria-labelledby` on 20 modals
- **File:** `index.html`
- **Root cause:** 20+ modals lack `aria-labelledby` pointing to their modal-title. Screen readers cannot announce the dialog name.
- **Fix:** Add `id` to each `.modal-title`, then `aria-labelledby="that-id"` to the `.modal` wrapper.
- [ ] Implemented

### V17-L2 — No modals carry `aria-modal="true"`
- **File:** `index.html` — all `.modal` wrappers
- **Root cause:** Bootstrap adds `role="dialog"` via JS but the static HTML doesn't include `aria-modal="true"`.
- **Fix:** Add `aria-modal="true"` to all `.modal` div wrappers.
- [ ] Implemented

### V17-L3 — Clickable stat cards not keyboard-focusable
- **File:** `index.html` — `.stat-card-clickable` divs
- **Root cause:** Eight stat card divs use `data-action` for click handling but lack `tabindex="0"` and `role="button"`, making them unreachable via Tab key.
- **Fix:** Add `tabindex="0"` and `role="button"` to every `.stat-card-clickable` div.
- [ ] Implemented

### V17-L4 — 25 of 33 tables missing `<caption>`
- **File:** `index.html` — data tables
- **Root cause:** Only 8 tables include `<caption class="visually-hidden">`. Remaining 25 are unlabelled for assistive technologies.
- **Fix:** Add `<caption class="visually-hidden">` to every `<table>`.
- [ ] Implemented

### V17-L5 — Performance: 2.2 MB monolithic JS bundle, no code splitting
- **File:** `build.js`, `app.js`
- **Root cause:** esbuild produces a single 2.2 MB bundle. All module code downloads regardless of which tabs are visited.
- **Fix:** Use esbuild `splitting` + ESM output to create per-tab chunks; lazy-load heavy modules (email builder, charts) only when their tab is activated.
- [ ] Implemented

### V17-L6 — Gallery images have no lazy loading
- **File:** `media-gallery-new.js` — all gallery render functions
- **Root cause:** All `<img>` tags rendered without `loading="lazy"`. A gallery with hundreds of photos fires all network requests immediately.
- **Fix:** Add `loading="lazy"` to every generated `<img>` tag in gallery render functions.
- [ ] Implemented

### V17-L7 — Scheduled report modal checkboxes lack `for`/`id` pairing
- **File:** `app.js` — `reportsScheduler.showCreateReport()`
- **Root cause:** Dynamically generated checkboxes have `<label>` with no `for` attribute and `<input>` with no `id`. Clicking the label doesn't activate the checkbox.
- **Fix:** Give each checkbox a unique `id` and match `for` attributes on labels.
- [ ] Implemented

### V17-L8 — Judge portal no completion state on finishing all entries
- **File:** `judge-portal.js` — `nextEntry()`
- **Root cause:** When the last entry is scored, a toast appears but there is no persistent "done" state, summary view, or admin notification.
- **Fix:** Show a full-screen completion card listing all scored entries with a "Your judging is complete" confirmation.
- [ ] Implemented

### V17-L9 — `previous_winner` badge relies on manual status, not actual wins
- **File:** `organisations.js`
- **Root cause:** Badge shows when `org.status === 'past_winner'` regardless of actual award history.
- **Fix:** Cross-reference against `award_assignments` with `status = 'winner'` for ground-truth check.
- [ ] Implemented

### V17-L10 — Dashboard activity feed labels all awards as "New Award Added"
- **File:** `dashboard.js` — `loadActivityFeed()`
- **Root cause:** Feed shows all awards in `STATE.allAwards` (up to 5) as "New Award Added" regardless of age.
- **Fix:** Filter to awards created within 30 days, or use label "Award: `<name>`".
- [ ] Implemented

