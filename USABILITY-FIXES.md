# Usability Fixes — Full Implementation Checklist

Generated from systematic tab-by-tab audit (May 2026).
**If a session is cut off, read this file and resume from the first ❌ item.**

Branch: `claude/bta-location-restructure-JS5hX`
All changes go to this branch. After completing a batch, run `npm test && npm run build`,
commit with a descriptive message, and push.

---

## ✅ COMPLETED

### Dashboard
- [x] Remove "Award Categories Reference" accordion panel
- [x] Remove "Counties, Cities & Regions Reference" accordion panel
- [x] Rename "Recent Orders" → "Recent Payments"
- [x] Fix "Company Name" → "Organisation Name" in Top Organisations table header
- [x] Remove "Add Winner" from Quick Actions FAB
- [x] Rename "Customise" button → "Customise Dashboard"

### Organisations
- [x] Fix "Save Company" → "Save Organisation" in Add Organisation modal
- [x] Trim stats bar from 14 visible items to 6 (Total, With Awards, New This Month, Missing Email, Missing Logo, Sponsors) — extras hidden with `d-none` for JS compat
- [x] Separate filter controls (Tags, Logo, Date Added) from action buttons — actions moved to their own toolbar row with `border-top mt-3`
- [x] Remove "Catchment Area" field from Add Organisation modal
- [x] Add View toggle button group (Table | Kanban | Map) to toolbar
- [x] Hide "Avg Engagement" KPI (unclear metric — removed from display)

### CRM
- [x] Rename "Companies" sub-tab → "Organisations"

### Winners
- [x] Collapse toolbar: Year Comparison, Certificate Editor, Bulk Media Packs, Bulk Winner Packages, Import CSV → into "Tools" dropdown; Pipeline + Announcements remain top-level
- [x] Add "Status" filter dropdown to Winners filter bar
- [x] Rename "Media" table column → "Photos/Videos"

### Marketing
- [x] Reorder sub-tabs to match workflow card: Branding → Email Placeholders → Email Templates → Email Builder → Email Lists → Email Sequences → Banners → Sponsors → Social Media
- [x] Dismiss button on "Getting Started" workflow card saves to `localStorage` key `mktWorkflowDismissed`; inline script hides card on reload if dismissed

### Events
- [x] Remove redundant floating "+" FAB (Add Event button already in filter bar)
- [x] "Data Issues" KPI: neutral (`text-muted`) when count = 0, warning when count > 0 — handled in `events.js` `_updateStats()`
- [x] Merge "Attendees" + "VIP Guests" columns: single "Attendees" column, VIP count appended as badge by `_loadEventAttendeeCounts()`

### Entries
- [x] Move "Get Entry Form Link" button → into "Tools" dropdown
- [x] Add live filter-count badge (`#entriesFilterCount`) on the filter section header — updated by `_updateFilterCountBadge()` in `entries.js`

### Awards
- [x] Add `title` tooltip to "Phase" column header

### Payments
- [x] Add preset date range buttons to Financial Reports (Last 30 Days, This Quarter, This Year) via inline JS
- [x] Rename "Accounting" sub-tab → "Accounting Integration"

### Settings
- [x] Add 5 sub-tabs: General | Seasons & Areas | Security | Integrations | Data & Backup
  - General: Branding + UX Settings
  - Seasons & Areas: Award Seasons + Manage Areas
  - Data & Backup: Backup/Export + System Info + Audit Log
  - Security: 2FA + GDPR + User Roles (GDPR/UserRoles relocated into Security pane via inline script)
  - Integrations: Webhooks

### Bitcoin
- [x] Tab nav item hidden by default (`d-none`); RBAC `applyTabPermissions()` shows it for admin/superadmin only

---

## ❌ STILL OUTSTANDING

Work through these in order. After each logical group, run `npm test && npm run build` and commit.

---

### GROUP 1 — Quick label/tooltip fixes (index.html only, ~30 min)

**Dashboard**
- [ ] Add "Record Payment" to Quick Actions FAB to replace the removed "Add Winner"
  - In `index.html` around line 760, add inside `#quickActionsMenu`:
    ```html
    <div class="quick-action-item" data-action="dashboardModule.quickGoToPayments">
      <i class="bi bi-receipt text-success"></i>
      <span>Record Payment</span>
    </div>
    ```
  - In `dashboard.js` add: `quickGoToPayments() { document.getElementById('payments-tab')?.click(); }`

**Organisations**
- [ ] Remove "Catchment Area" from CSV import help text (line 1567):
  Change: `Supported columns: Company Name, Sector, Contact Name, Email, Phone, Website, Address, Catchment Area`
  To: `Supported columns: Company Name, Sector, Contact Name, Email, Phone, Website, Address`

**Entries**
- [ ] Add tooltip to "Entry Type" filter: change label to include `title="Self-Nominated: the company applied directly. Standard: nominated by a sponsor or organiser."`
- [ ] Add tooltip to "Score" column header: `title="Average judging score submitted by assigned judges"`

**Winners**
- [ ] Add tooltip to "Status" column header explaining the winner journey stages:
  `title="Status tracks the winner journey: Pending → Confirmed → Announced → Media Sent → Complete"`

**CRM**
- [ ] Add `title` to "Smart Segments" nav pill: `title="Smart Segments are rule-based auto-segments that update dynamically as organisation data changes"`
- [ ] Add `title` to "My Tasks" nav pill: `title="Tasks assigned to you personally — shared across the team"`

**Settings**
- [ ] Add "(email notification)" label after Weekly/Monthly backup reminder checkboxes

---

### GROUP 2 — Awards filter panel (index.html + awards.js, ~45 min)

**Awards**
- [ ] Make the Awards filter bar collapsible (consistent with Entries tab pattern):
  - Wrap the filter controls in a `collapse` div with id `awardsFiltersCollapse`
  - Add a toggle button showing "Filter Awards" + active-count badge (same pattern as Entries `#entriesFilterCount`)
  - In `awards.js`, add `_updateFilterCountBadge()` (copy pattern from `entries.js`)
- [ ] Replace "Areas" and "Sectors" KPI stats in Awards stats bar with something actionable:
  - Remove the `<div class="col">Areas</div>` and `<div class="col">Sectors</div>` stat cards
  - Replace with "Entries Received" (`id="awardsEntriesCount"`) and "With Nominees" (already `id="awardsWithNominees"` — check if it exists and just rename label if needed)

---

### GROUP 3 — Reports tab (index.html, ~30 min)

- [ ] Add format labels to Data Export buttons — currently just say "Awards", "Organisations" etc. Add "(CSV)" suffix to each:
  - Find export buttons around the Reports tab export section and add `(CSV)` to each label
- [ ] Hide "Scheduled Reports" section if not wired up — wrap it in `d-none` until the feature is built:
  - Find the Scheduled Reports card in the Reports tab and add `class="d-none"` to its container
- [ ] Add a "Compare Year" dropdown next to the Year filter in Reports:
  - Duplicate the year filter as `reportsCompareYearFilter` with a "Compare with:" label; populate it the same way

---

### GROUP 4 — Events remaining (index.html + events.js, ~30 min)

- [ ] Financial Overview panel: add a compact always-visible summary row above the collapsible body showing Total Revenue, Total Costs, Net P&L as three small stat values — the collapsible then shows the full breakdown table
- [ ] Calendar view toggle consistency: the "Calendar View" button in the filter bar and the calendar's own close button should be the same action. In `events.js`, make the toggle button check if the calendar is open and close it if so (toggle behaviour)

---

### GROUP 5 — Payments & Settings remaining (index.html, ~30 min)

**Payments**
- [ ] Add a brief subtitle under each Payments sub-tab heading:
  - "Invoices" → subtitle: "Bills issued to organisations"
  - "Payments" → subtitle: "Payments received against invoices"
  - "Financial Reports" → subtitle: "Revenue and outstanding analysis"
  - "Accounting Integration" → subtitle: "Connect your accounting software"
- [ ] Verify "Send Overdue Reminders" button has a confirmation modal — if it just fires immediately, add a `data-bs-toggle="modal"` trigger and a simple confirm modal

**Settings**
- [ ] Add typed confirmation to "Clear Log" button in Audit Log:
  - Change it from a direct action button to one that opens a small confirm modal asking the user to type "CLEAR" before proceeding
- [ ] Label the Backup Reminders channel. After each checkbox label add `<span class="text-muted small ms-1">(email notification)</span>`

---

### GROUP 6 — Media Gallery (index.html + media-gallery-new.js, ~45 min)

- [ ] Add breadcrumb navigation to the 3-level view hierarchy:
  - Events List → [Event Name] → Photos / Videos
  - Add a `<nav aria-label="breadcrumb">` bar that appears when inside an event or photos/videos view
  - Each crumb is a link that navigates back to the parent view
- [ ] Explain "Featured" button: add `title="Mark photos as featured to highlight them on the public winner pages"` to the Featured button
- [ ] "Keyboard Shortcuts" button → icon-only with tooltip: change to `<button ... title="Keyboard shortcuts"><i class="bi bi-keyboard"></i></button>` (remove text label)

---

### GROUP 7 — CRM remaining (index.html, ~30 min)

- [ ] "My Tasks" sub-tab: if per-user task assignment is not implemented, rename to "Tasks" (remove "My"):
  `<i class="bi bi-check2-square me-2"></i>Tasks`
- [ ] Deal Pipeline: add a Kanban view toggle button alongside the table — when clicked, show a simple kanban board grouped by pipeline stage (similar to Organisations kanban)
  - This requires JS work in `crm.js` — add a `renderDealKanban()` method

---

## Validation (run after each group)

```bash
npm test          # all 65 suites must pass
npm run build     # 0 lint errors, clean build
git add -A
git commit -m "..."
git push -u origin claude/bta-location-restructure-JS5hX
```
