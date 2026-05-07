# UX/UI Audit — Implementation To-Do

**CLAUDE: Read this file at the start of every session. Work through items in priority order (Critical → High → Medium → Low). Mark each item `[x]` immediately after it is fully implemented, tested, and committed. Never mark an item complete unless the change is in a committed and pushed git commit.**

Last audit: 2026-05-07  
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
- [ ] Implemented

### M2 — CRM communication timeline per organisation
- **Files:** `crm.js`, `organisations.js`, `index.html`
- **What to build:** In the organisation detail modal, add a "History" tab showing all CRM communications, meetings, and notes for that org in chronological order.
- **Done when:** Opening an organisation shows its full interaction history in one view.
- [ ] Implemented

### M3 — Smart segments AND/OR rule logic
- **Files:** `crm.js`, `index.html`
- **What to build:** Upgrade the smart segment rule builder to support multiple conditions with AND/OR operators. Add "Add condition" button that appends a new field/operator/value row. Add an AND/OR toggle between conditions.
- **Done when:** User can build "Sector = Construction AND Region = London AND Status = Active".
- [ ] Implemented

### M4 — Calendar as default Events view
- **Files:** `events.js`, `index.html`
- **What to build:** Make the calendar view the default when opening the Events tab. Move the "List View" toggle to a secondary button. Persist the user's last-used view in localStorage.
- **Done when:** Opening Events shows the calendar; toggling to list and refreshing remembers preference.
- [x] Implemented

### M5 — Reporting: charts and visualisations
- **Files:** `reporting.js`, `index.html`
- **What to build:** Add Chart.js (already likely in project or add via CDN). Add bar charts for: entries per sector, winners per region, revenue per month. Add a pie chart for award status breakdown. Render below the existing report table.
- **Done when:** The Reporting tab shows at least 3 charts that update when filters change.
- [ ] Implemented

### M6 — Reporting: PDF and Excel export
- **Files:** `reporting.js`, `index.html`
- **What to build:** Add "Export PDF" and "Export Excel" buttons to the reporting tab. PDF uses browser print with a print stylesheet. Excel uses SheetJS (already in package.json if present, otherwise add).
- **Done when:** Clicking Export PDF opens print dialog; Export Excel downloads an .xlsx file.
- [x] Implemented

### M7 — Scheduled report delivery by email
- **Files:** `reporting.js`, `index.html`, `api/email-automation.js`
- **What to build:** Add a "Schedule Report" button. Opens modal: report type, frequency (weekly/monthly), recipient email(s). Stores schedule in settings. Email automation triggers the report on schedule.
- **Done when:** User can set "Email me the monthly revenue report on the 1st of each month".
- [ ] Implemented

### M8 — Winner announcement scheduling
- **Files:** `winners.js`, `index.html`
- **What to build:** Add an "Announce on" date-time picker to the winner edit modal. When the scheduled time arrives (via automation scheduler), automatically update status to "Announced" and trigger announcement email.
- **Done when:** Setting an announce date updates the winner status automatically at that time.
- [x] Implemented

### M9 — Entry deadline enforcement
- **Files:** `entries.js`, `awards.js`, `index.html`
- **What to build:** Add `entry_deadline` date field to the award record. In the entries table, flag submissions past the deadline with an "Overdue" badge. Optionally block new public submissions past the deadline in `entry-proxy.js`.
- **Done when:** Awards with a past deadline show their entries flagged; new public submissions are blocked.
- [ ] Implemented

### M10 — Email template thumbnail grid
- **Files:** `email-templates.js`, `index.html`
- **What to build:** Change the email templates list from a plain table to a card grid. Each card shows a small preview (first 200px of the template rendered in an iframe or screenshot), the template name, last modified date, and Use/Edit/Delete buttons.
- **Done when:** Email Templates tab shows a visual card grid instead of a plain list.
- [ ] Implemented

### M11 — Email A/B subject line testing
- **Files:** `email-builder.js`, `index.html`
- **What to build:** Add an "A/B Test" toggle in the campaign send modal. When on, show two subject line inputs and a split % slider. Send version A to X% and version B to the rest. Record which performed better in the campaign log.
- **Done when:** User can create a campaign with two subject lines and a 50/50 split.
- [ ] Implemented

### M12 — Sponsor tier visual badges
- **Files:** `organisations.js`, `marketing.js`, `index.html`
- **What to build:** Add a tier badge (Gold/Silver/Bronze/Partner with colour-coded styling) to sponsor organisation rows and the marketing sponsors section. Badge colour: Gold=#FFD700, Silver=#C0C0C0, Bronze=#CD7F32.
- **Done when:** Sponsor organisations show a coloured tier badge in the table and marketing section.
- [ ] Implemented

### M13 — Social media content calendar
- **Files:** `marketing.js`, `index.html`
- **What to build:** Add a "Content Calendar" sub-tab to Marketing. Shows a monthly calendar grid with scheduled posts as event blocks (colour-coded by platform). Clicking a block opens the post for editing.
- **Done when:** Marketing → Content Calendar shows a monthly view of all scheduled social posts.
- [ ] Implemented

### M14 — Hashtag library for social posts
- **Files:** `marketing.js`, `index.html`
- **What to build:** Add a "# Hashtags" button in the social media post composer. Opens a panel with curated hashtag groups (Awards, Sectors, Locations). Clicking a hashtag appends it to the post.
- **Done when:** Composing a social post can insert hashtags from a library panel.
- [ ] Implemented

### M15 — Meeting note templates in CRM
- **Files:** `crm.js`, `index.html`
- **What to build:** When logging a meeting, pre-populate the notes field with a template: "**Attendees:** \n**Key Points:** \n**Action Items:** \n**Next Steps:**". User can edit before saving.
- **Done when:** Adding a meeting pre-fills the notes with a structured template.
- [ ] Implemented

### M16 — Settings: login activity audit log
- **Files:** `settings.js`, `index.html`, `auth.js`
- **What to build:** Add a "Login History" panel to Settings → Security sub-tab. Shows last 50 logins: date/time, user email, IP address, browser. Query from Supabase auth.audit_log_entries or a custom logins table.
- **Done when:** Settings → Security shows a table of recent login events.
- [ ] Implemented

### M17 — Settings: per-user notification preferences
- **Files:** `settings.js`, `index.html`
- **What to build:** Add a "Notifications" section to Settings → General. Checkboxes for: "Notify me of new entries", "Notify me of overdue invoices", "Notify me of new organisations", "Daily digest email". Saved per user in localStorage or Supabase user metadata.
- **Done when:** User can toggle notification types and preferences persist across sessions.
- [ ] Implemented

### M18 — Co-winner / runner-up support
- **Files:** `winners.js`, `index.html`
- **What to build:** Add a "Position" field to the winner record (Winner / Runner-Up / Highly Commended). Show position as a badge in the winners table. Allow multiple records per award year (one per position).
- **Done when:** An award can have a Winner, a Runner-Up, and a Highly Commended entry.
- [x] Implemented

### M19 — Data quality score on Dashboard
- **Files:** `dashboard.js`, `index.html`
- **What to build:** Add a "Data Quality" card to the dashboard showing: % of organisations with logos, % with email addresses, % of awards with nominees, % of winners with confirmed status. Each metric is a mini progress bar.
- **Done when:** Dashboard shows a data quality card with 4 progress indicators.
- [ ] Implemented

### M20 — Organisation parent/subsidiary hierarchy
- **Files:** `organisations.js`, `index.html`
- **What to build:** Add a `parent_org_id` field to organisations. In the org edit modal, add a "Parent Organisation" searchable dropdown. In the org table, show a hierarchy icon if the org has a parent, with a tooltip showing the parent name.
- **Done when:** Organisation "Acme Electrical" can be linked as a subsidiary of "Acme Group".
- [ ] Implemented

---

## LOW — Polish and refinement

### L1 — Colour-only status indicators: add icon fallback
- **Files:** `awards.js`, `organisations.js`, `winners.js`, `entries.js`
- **What to build:** Everywhere a status is shown as a colour badge only, add a small icon inside the badge. E.g. Active = green + `bi-check-circle`, Pending = yellow + `bi-clock`, Archived = grey + `bi-archive`. Ensures WCAG compliance.
- **Done when:** All status badges across all tabs show an icon alongside the colour.
- [ ] Implemented

### L2 — Consistent loading states (skeleton loaders everywhere)
- **Files:** `utils.js`, all module JS files
- **What to build:** Audit all tabs — any that still use a plain "Loading..." text or spinner should use `utils.showSkeletonLoading()` instead. Ensure skeleton row count matches expected table columns.
- **Done when:** Every table shows a skeleton loader (not a spinner or text) while fetching data.
- [ ] Implemented

### L3 — Sidebar collapse state persisted in localStorage
- **Files:** `app.js`, `index.html`
- **What to build:** When the user collapses/expands the sidebar, store state in `localStorage.setItem('sidebarCollapsed', true/false)`. On page load, apply the stored state before rendering.
- **Done when:** Collapsing the sidebar and refreshing keeps it collapsed.
- [ ] Implemented

### L4 — Sector filter: searchable dropdown
- **Files:** `awards.js`, `index.html`
- **What to build:** Replace the plain `<select>` sector filter on Awards with a searchable dropdown (Bootstrap's `tom-select` or a simple filtered list). Makes finding a sector fast when there are 50+ options.
- **Done when:** The sector filter has a search input that narrows the dropdown options as you type.
- [ ] Implemented

### L5 — Toast notifications: longer duration + action link
- **Files:** `utils.js`
- **What to build:** Increase success toast duration from 3s to 5s. Add an optional action link parameter (e.g. "View Invoice #1234") that navigates to the relevant record. Update all toast calls that have a clear navigation target.
- **Done when:** Creating a new award shows "Award created. View Award →" toast that lasts 5 seconds.
- [x] Implemented

### L6 — Required field indicators consistent across all forms
- **Files:** `index.html` (all modal forms)
- **What to build:** Audit all modal forms. Any required field that is missing the red asterisk `<span class="text-danger">*</span>` label should have one added. Also ensure `required` attribute is set on the input.
- **Done when:** All required fields across all modal forms are marked with a red asterisk.
- [ ] Implemented

### L7 — Campaign log columns: responsive hide/show
- **Files:** `email-builder.js`, `index.html`
- **What to build:** On the email campaign log table, mark lower-priority columns (Bounced, Unsubscribed) as `d-none d-xl-table-cell` so they hide on smaller screens. Ensure the table is still usable at 1024px width.
- **Done when:** Email campaign log table shows without horizontal scroll on a 1024px screen.
- [ ] Implemented

### L8 — Winner table: row highlight on checkbox selection
- **Files:** `winners.js`, `styles.css`
- **What to build:** Add a CSS rule and JS toggle: when a winner row checkbox is checked, add class `table-primary` to the `<tr>`. Remove it when unchecked.
- **Done when:** Checking a winner row highlights it in light blue; unchecking removes highlight.
- [ ] Implemented

### L9 — Awards table: show "last modified" column
- **Files:** `awards.js`, `index.html`
- **What to build:** Add an optional "Modified" column to the awards table (hidden by default, toggleable via column visibility). Shows `updated_at` formatted as relative time ("2 days ago").
- **Done when:** Awards column visibility menu has a "Modified" option that shows the updated_at date.
- [ ] Implemented

### L10 — Bulk action bar: visual hierarchy (destructive actions distinct)
- **Files:** `index.html`, `styles.css`
- **What to build:** In bulk action bars across all tabs, style destructive actions (Archive, Delete) as `btn-outline-danger` and separate them from non-destructive actions with a `|` divider. Currently all buttons look the same.
- **Done when:** Bulk action bars show Archive/Delete buttons in red, separated from other actions.
- [ ] Implemented

---

## COMPLETED

*(Items move here once committed and pushed)*

---

## Notes for Claude

- Always run `npm test` and `npm run build` after implementing any item before marking `[x]`
- Commit each logical group together (e.g. all filter chips = one commit)
- Keep the Vercel 12-function limit in mind — no new `/api/` files
- Update this file's checkboxes in the same commit as the implementation
- Reference format: when committing, include the item code (e.g. "Implements H1, H2") in the commit message
