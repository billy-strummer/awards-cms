# Usability Fixes — Full Implementation Checklist

Generated from systematic tab-by-tab audit (May 2026).
**All items are complete as of the current branch.**

Branch: `claude/bta-location-restructure-JS5hX`

---

## ✅ COMPLETED

### Dashboard
- [x] Remove "Award Categories Reference" accordion panel
- [x] Remove "Counties, Cities & Regions Reference" accordion panel
- [x] Rename "Recent Orders" → "Recent Payments"
- [x] Fix "Company Name" → "Organisation Name" in Top Organisations table header
- [x] Remove "Add Winner" from Quick Actions FAB
- [x] Rename "Customise" button → "Customise Dashboard"
- [x] Add "Record Payment" to Quick Actions FAB (`dashboardModule.quickGoToPayments`)

### Organisations
- [x] Fix "Save Company" → "Save Organisation" in Add Organisation modal
- [x] Trim stats bar from 14 visible items to 6 (Total, With Awards, New This Month, Missing Email, Missing Logo, Sponsors) — extras hidden with `d-none` for JS compat
- [x] Separate filter controls (Tags, Logo, Date Added) from action buttons — actions moved to their own toolbar row with `border-top mt-3`
- [x] Remove "Catchment Area" field from Add Organisation modal
- [x] Remove "Catchment Area" from CSV import help text
- [x] Add View toggle button group (Table | Kanban | Map) to toolbar
- [x] Hide "Avg Engagement" KPI (unclear metric — removed from display)

### CRM
- [x] Rename "Companies" sub-tab → "Organisations"
- [x] Add `title` to "Smart Segments" nav pill
- [x] Add `title` to "My Tasks" nav pill
- [x] Rename "My Tasks" sub-tab → "Tasks"
- [x] Deal Pipeline: Kanban view toggle + `renderDealKanban()` in `crm.js`

### Winners
- [x] Collapse toolbar: Year Comparison, Certificate Editor, Bulk Media Packs, Bulk Winner Packages, Import CSV → into "Tools" dropdown; Pipeline + Announcements remain top-level
- [x] Add "Status" filter dropdown to Winners filter bar
- [x] Rename "Media" table column → "Photos/Videos"
- [x] Add `title` tooltip to "Status" column header (winner journey stages)

### Entries
- [x] Move "Get Entry Form Link" button → into "Tools" dropdown
- [x] Add live filter-count badge (`#entriesFilterCount`) on the filter section header — updated by `_updateFilterCountBadge()` in `entries.js`
- [x] Add tooltip to "Entry Type" filter label
- [x] Add tooltip to "Score" column header

### Marketing
- [x] Reorder sub-tabs to match workflow card: Branding → Email Placeholders → Email Templates → Email Builder → Email Lists → Email Sequences → Banners → Sponsors → Social Media
- [x] Dismiss button on "Getting Started" workflow card saves to `localStorage` key `mktWorkflowDismissed`; inline script hides card on reload if dismissed

### Events
- [x] Remove redundant floating "+" FAB (Add Event button already in filter bar)
- [x] "Data Issues" KPI: neutral (`text-muted`) when count = 0, warning when count > 0 — handled in `events.js` `_updateStats()`
- [x] Merge "Attendees" + "VIP Guests" columns: single "Attendees" column, VIP count appended as badge by `_loadEventAttendeeCounts()`
- [x] Financial Overview panel: compact always-visible summary row (Revenue / Costs / Net P&L) above collapsible breakdown — wired in `events.js`
- [x] Calendar toggle consistent: `toggleEventsCalendar()` uses `classList` for open/close; close button calls same action

### Awards
- [x] Add `title` tooltip to "Phase" column header
- [x] Make Awards filter bar collapsible (`#awardsFiltersCollapse`) with active-count badge (`#awardsFilterCount`)
- [x] `_updateFilterCountBadge()` added to `awards.js`
- [x] Replace "Areas" and "Sectors" KPI stats with "Entries Received" (`#awardsEntriesCount`)

### Payments
- [x] Add preset date range buttons to Financial Reports (Last 30 Days, This Quarter, This Year) via inline JS
- [x] Rename "Accounting" sub-tab → "Accounting Integration"
- [x] Add subtitle under each Payments sub-tab (Bills issued / Payments received / Revenue analysis / Connect accounting)
- [x] "Send Overdue Reminders" button opens confirmation modal (verified in `payments.js`)

### Reports
- [x] Export buttons labelled with "(CSV)" suffix
- [x] "Scheduled Reports" section hidden (`d-none`) until feature is built
- [x] "Compare Year" dropdown (`#reportsCompareYearFilter`) added next to Year filter; populated in `app.js`

### Settings
- [x] Add 5 sub-tabs: General | Seasons & Areas | Security | Integrations | Data & Backup
  - General: Branding + UX Settings
  - Seasons & Areas: Award Seasons + Manage Areas
  - Data & Backup: Backup/Export + System Info + Audit Log
  - Security: 2FA + GDPR + User Roles (GDPR/UserRoles relocated into Security pane via inline script)
  - Integrations: Webhooks
- [x] Add "(email notification)" label after Weekly/Monthly backup reminder checkboxes
- [x] "Clear Log" button opens typed-confirmation modal (type "CLEAR") — `clearAuditLogConfirmed()` in `settings.js`

### Media Gallery
- [x] Breadcrumb navigation (`#mediaGalleryBreadcrumb`) for 3-level hierarchy: Events List → Event → Photos/Videos — `_updateBreadcrumb()` in `media-gallery-new.js`
- [x] Featured button: `title="Mark photos as featured to highlight them on the public winner pages"`
- [x] "Keyboard Shortcuts" button → icon-only with tooltip (text label removed)

### Bitcoin
- [x] Tab nav item hidden by default (`d-none`); RBAC `applyTabPermissions()` shows it for admin/superadmin only

---

## ❌ STILL OUTSTANDING

None. All items complete. ✅

---

## Validation

```bash
npm test          # all 65 suites must pass
npm run build     # 0 lint errors, clean build
git add -A
git commit -m "..."
git push -u origin claude/bta-location-restructure-JS5hX
```
