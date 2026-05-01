# Usability Fixes — Full Implementation Checklist

Generated from systematic tab-by-tab audit (May 2026).
Each item is marked [ ] pending or [x] complete.
**If a session is cut off, read this file and continue from the first unchecked item.**

Branch: `claude/bta-location-restructure-JS5hX`

---

## 🔴 HIGH PRIORITY

### Dashboard
- [x] Remove "Award Categories Reference" accordion panel from Dashboard
- [x] Remove "Counties, Cities & Regions Reference" accordion panel from Dashboard
- [x] Rename "Recent Orders" section → "Recent Payments"
- [x] Fix "Company Name" column header in Top Organisations table → "Organisation Name"
- [x] Remove "Add Winner" from Quick Actions FAB
- [x] Rename "Customise" button → "Customise Dashboard"

### Organisations
- [x] Fix "Save Company" button in Add Organisation modal → "Save Organisation"
- [x] Trim stats bar from 14 items to 6: Total, With Awards, New This Month, Missing Email, Missing Logo, Sponsors
- [x] Separate filter controls (Tags, Logo, Date Added) from action buttons (Add, Import, Export, Views, Tools) into dedicated toolbar row
- [x] Remove "Catchment Area" field from Add Organisation modal (legacy, unclear purpose)
- [x] Add View toggle button group to toolbar: Table | Kanban | Map

### CRM
- [x] Rename "Companies" sub-tab label → "Organisations"

---

## 🟡 MEDIUM PRIORITY

### Winners
- [x] Collapse infrequent toolbar buttons into a single "Tools" dropdown; keep Pipeline and Announcements as top-level
- [x] Add "Status" filter dropdown to the Winners filter bar
- [x] Rename "Media" column → "Photos/Videos"

### Marketing
- [x] Reorder sub-tabs to match workflow card: Branding → Email Placeholders → Email Templates → Email Builder → Email Lists → Email Sequences → Banners → Sponsors → Social Media
- [x] Dismiss button on "Getting Started" workflow card saves to localStorage (`mktWorkflowDismissed`)

### Events
- [x] Remove the floating "+" FAB from Events tab (redundant with "Add Event" button in filter bar)
- [x] Make "Data Issues" KPI card only styled warning when count > 0; neutral (text-muted) when 0
- [x] Merge "Attendees" and "VIP Guests" table columns into one: "Attendees" showing count with VIP badge appended

### Entries
- [x] Move "Get Entry Form Link" button into a "Tools" dropdown
- [x] Add filter-active count badge on the filter section header

---

## 🟢 LOW PRIORITY

### Awards
- [x] Add `title` tooltip to "Phase" column header explaining what Phase means

### Payments
- [x] Add preset date range buttons to Financial Reports sub-tab: Last 30 Days, This Quarter, This Year
- [x] Rename "Accounting" sub-tab label → "Accounting Integration"

### Settings
- [x] Add sub-tabs: General | Seasons & Areas | Security | Integrations | Data & Backup

### Bitcoin
- [x] Gate Bitcoin tab visibility to Admin/Superadmin role only (hidden by default via `d-none`, shown by RBAC)

---

## Not yet implemented (deferred)
- [ ] CRM: Add tooltip to "Smart Segments" explaining difference from Segments
- [ ] CRM: Add Kanban view toggle to Deal Pipeline
- [ ] Settings: Add typed confirmation to "Clear Log" button
- [ ] Settings: Label Backup Reminders with channel "(sent to your account email)"
- [ ] Media Gallery: Add breadcrumb navigation to 3-level view hierarchy
- [ ] Awards: Replace "Areas" and "Sectors" KPIs with more actionable metrics

---

## Validation

- [x] `npm test` — all 65 suites pass (6384 tests, 0 failures)
- [x] `npm run build` — clean build, 0 lint errors
- [x] Commit with descriptive message
- [x] Push to `claude/bta-location-restructure-JS5hX`
