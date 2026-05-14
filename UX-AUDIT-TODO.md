# UX/UI Audit — Implementation To-Do

**CLAUDE: Read this file at the start of every session. Work through items in priority order (Critical → High → Medium → Low). Mark each item `[x]` immediately after it is fully implemented, tested, and committed. Never mark an item complete unless the change is in a committed and pushed git commit.**

Last audit: 2026-05-07 (original items — all complete)
Second audit: 2026-05-07 (new deep audit — see V2 section below)
Third audit: 2026-05-07 (post-structural-fix audit — see V3 section below)
Sixth audit: 2026-05-08 (international awards business first-run UX audit — see V6 section below)
Seventh audit: 2026-05-14 (top-to-bottom professional CMS audit — see V7 section below)
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
