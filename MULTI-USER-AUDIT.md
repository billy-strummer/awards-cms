# Multi-User Compatibility Audit

**Date:** 2026-05-20  
**Branch:** `claude/bta-location-restructure-JS5hX`  
**Scope:** Every localStorage write in the codebase, classified by whether it stores data that must be shared between users or is legitimately per-user.

---

## How to read this

The CMS correctly uses Supabase for all core records (organisations, awards, entries, winners, events, payments, communications, deals). The issues below are in **feature sub-areas** where data is written to localStorage instead of — or as a fallback from — Supabase.

Three categories:

| Severity | Meaning |
|---|---|
| **Critical** | Shared operational data. Admin A enters it, Admin B cannot see it. |
| **Medium** | Shared configuration. Customisations made by one user are invisible to others, causing inconsistent UI. |
| **Low / OK** | Per-user preferences (dark mode, column widths, filter state). Per-user is correct behaviour here. |

---

## CRITICAL — Shared operational data stored per-browser

### C1 — Event Budget (event_budgets + event_budget_items)

**Files:** `events.js`, `api/data-proxy.js`  
**Tables:** `event_budgets`, `event_budget_items` (in data-proxy allowlist, no SQL migration)

`getBudget()` tries Supabase first and falls back to localStorage when both tables throw. Since neither table has been created by any migration file, **every budget falls back to localStorage in production**. Admin A adds budget items; Admin B and every other device sees an empty budget.

**Fix:** Add `CREATE TABLE IF NOT EXISTS event_budgets` and `event_budget_items` SQL (these tables are already allowlisted in data-proxy and the save/load code is already written).

---

### C2 — Event Vendors

**Files:** `events.js` (`getVendors`, `_saveVendors`), `api/data-proxy.js`  
**Table:** `event_vendors` (in data-proxy allowlist, no SQL migration)

`getVendors()` tries `event_vendors` in Supabase, falls back to localStorage on error. No migration creates the table. Vendor contacts, costs, and statuses entered by one admin are invisible to all others.

**Fix:** Add `CREATE TABLE IF NOT EXISTS event_vendors` SQL.

---

### C3 — Event Waitlist

**Files:** `events.js` (`getWaitlist`, `_saveWaitlist`), `api/data-proxy.js`  
**Table:** `event_waitlist` (in data-proxy allowlist, no SQL migration)

Same pattern — Supabase-first with localStorage fallback, table never created. Someone added to the waitlist by Admin A will not appear for Admin B. If Admin B promotes a different person from their (empty) waitlist, they get a double-booking.

**Fix:** Add `CREATE TABLE IF NOT EXISTS event_waitlist` SQL.

---

### C4 — Event Special Requirements

**Files:** `events.js` (`_getSpecialReqs`, `saveSpecialReqs`)  
**Table:** `event_special_requirements` (no SQL migration)

Parking passes, emergency contacts, dress code, arrival/ceremony times — all upserted to `event_special_requirements`. The table does not exist, so every write silently falls back to localStorage. The venue logistics admin fills this in; the front-of-house team on a different device sees nothing.

**Fix:** Add `CREATE TABLE IF NOT EXISTS event_special_requirements` SQL.

---

### C5 — Event Templates

**Files:** `events.js` (line 500, 523)  
**Key:** `eventTemplates`  
**Storage:** Pure localStorage — no Supabase path exists.

Event templates are saved as `localStorage.setItem('eventTemplates', ...)`. Templates created by one admin are invisible to all others. Since event templates are reusable configuration, this should be database-backed.

**Fix:** Create `event_templates` table and add Supabase load/save path.

---

### C6 — Judge Conflicts of Interest

**Files:** `assignments.js` (`getJudgeConflicts`, `saveJudgeConflicts`)  
**Key:** `judgeConflicts`  
**Storage:** Pure localStorage — no Supabase path exists.

Conflict-of-interest records are stored as `localStorage.setItem('judgeConflicts', ...)`. If Admin A records that Judge X must not see Org Y's entry, Admin B sees no conflicts. Judge assignments made from another browser will skip the conflict check entirely.

**Fix:** Create `judge_conflicts` table, add Supabase save/load, run conflict check server-side in `judge-automation.js`.

---

### C7 — Document Management

**Files:** `document-management.js` (lines 328–330)  
**Key:** `bta_documents`  
**Storage:** Pure localStorage — no Supabase path exists.

All documents (files attached to the system) are stored per-browser. A document uploaded by Admin A is invisible to Admin B. This makes the document management feature non-functional in a multi-user environment.

**Fix:** Create `documents` table in Supabase, upload file to Supabase Storage, store metadata row. The upload proxy already exists (`/api/upload-proxy.js`).

---

### C8 — Audit Logs

**Files:** `settings.js` (lines 490–646)  
**Key:** `audit_logs`  
**Storage:** Pure localStorage, capped at 500 entries.

Every admin's activity is logged to their own browser's localStorage. In a multi-user system this means: (a) Admin B cannot see what Admin A did, (b) the log is lost when localStorage is cleared, (c) the 500-entry cap means older entries disappear. The Audit Log viewer in Settings shows completely different data depending on who is looking.

**Fix:** The `activity_log` table likely already exists (used for org/entry activity). Route `settings.js` audit writes to that table via `apiClient.insert('activity_log', ...)`.

---

### C9 — CRM Pipeline Stages

**Files:** `crm.js` (`_getPipelineStages`, `openManageStagesModal`)  
**Key:** `crmPipelineStages`  
**Storage:** Pure localStorage — no Supabase path exists.

Pipeline stages (Prospecting → Proposal → Negotiation → Won/Lost) are customisable. Customisations are written to `localStorage.setItem('crmPipelineStages', ...)`. Admin A renames "Prospecting" to "Lead" and adds a "Contract Sent" stage. Admin B still sees the defaults. The Kanban board renders differently for every user.

**Fix:** Add pipeline stages to `user_preferences` table (or a dedicated `crm_settings` table) with a Supabase upsert on save.

---

## MEDIUM — Shared configuration stored per-browser

These affect usability across the team but do not cause data loss or operational errors.

### M1 — Saved Filter Views (Awards, Entries, Organisations)

**Files:** `awards.js`, `entries.js`, `organisations.js`  
**Keys:** `awardsSavedViews`, `entriesSavedViews`, `orgsSavedViews`, `orgsFilterPresets`  
**Storage:** Pure localStorage.

Saved views (e.g. "Shortlisted 2026", "Unpaid entries") created by one admin are invisible to others. These are commonly shared between team members to standardise how they work the data.

**Fix:** Store saved views in `user_preferences` (keyed by view name + module) so they're shared across the team, or add a `saved_views` table if per-user vs shared distinction is needed.

---

### M2 — CRM Saved Segments

**Files:** `crm.js` (`_loadSegments`, `_saveSegments`)  
**Key:** `orgsSegments` (tries Supabase `user_preferences` table, falls back to localStorage)  

The code path exists to save to Supabase, but `user_preferences` has no SQL migration. Falls back to localStorage. Segments built by Admin A are invisible to Admin B.

**Fix:** Add `CREATE TABLE IF NOT EXISTS user_preferences` SQL (this table is also used by `payments.js` for accounting config and `app.js` for scheduled reports).

---

### M3 — Dunning / Payment Reminder Settings

**Files:** `payments.js` (`loadDunningSettings`, `saveDunningSettings`)  
**Key:** `dunningSettings`  
**Storage:** Pure localStorage — no Supabase path exists.

Payment dunning rules (when to send reminders, escalation thresholds) are stored per-browser. The finance admin sets them up; anyone else opening the dunning settings modal sees defaults.

**Fix:** Store in `user_preferences` table (key: `dunningSettings`).

---

### M4 — Accounting Integration Config

**Files:** `payments.js` (`_loadAccountingConfig`, `_saveAccountingConfig`)  
**Table:** Tries `user_preferences` (key: `orgAccountingConfig`), falls back to localStorage.

Same as M2 — code path exists for Supabase but `user_preferences` table is missing.

---

### M5 — Seating Chart Room Fixtures

**Files:** `events.js` (`addRoomFixture`, `_saveFixturesToLocalStorage`)  
**Key:** `room_fixtures_${eventId}`  
**Storage:** Tries Supabase insert, falls back to localStorage. No `room_fixtures` table in any migration.

Stage, photo wall, AV booth positions on the seating canvas fall back to localStorage. One admin arranges the room layout; it's invisible to another device viewing the same event's seating plan.

**Fix:** Add `CREATE TABLE IF NOT EXISTS room_fixtures` SQL, or store fixture data as JSONB on the `event_tables` or a new `seating_canvas` table.

---

### M6 — Running Order Section Config

**Files:** `events.js` (line 6950)  
**Key:** `bta_ro_section_config_${eventId}`  
**Storage:** Pure localStorage.

Which sections are expanded/collapsed in the running order editor. Low operational impact but means each admin sees a different editor layout for the same event.

---

## LOW / OK — Legitimately per-user preferences

These are correct as localStorage. No action needed.

| Key | What it stores | Why per-user is correct |
|---|---|---|
| `darkMode` | Dark/light theme | Visual preference |
| `layoutDensity` | Compact/comfortable row height | Visual preference |
| `defaultLandingTab` | Which tab opens on login | Personal workflow |
| `globalPageSize` | Default page size | Personal preference |
| `lastSettingsSubTab` | Last settings panel open | Session navigation |
| `eventsDefaultView` | Calendar vs list view | Personal preference |
| `dashboardWidgetConfig` | Dashboard widget layout | Personal preference |
| `awardsColModified` / `awardsColPhase` | Column visibility | Personal preference |
| `orgsColumnVisibility` | Column visibility | Personal preference |
| `awardsFilters` / `entriesFilters` / `eventsFilters` / `invoiceFilters` / `paymentFilters` | Current filter state | Personal session state |
| `bta_locale` | UI language | Personal preference |
| `btaGettingStartedDismissed` | Onboarding banner | Personal preference |
| `lastBackupTime` / backup reminders | Backup tracking | Per-instance OK |
| `orgImportHistory` | CSV import history | Per-session record |
| `csvImportedCounties` | Import dedup cache | Per-session |
| `emailPlaceholderDefaults` | Email preview defaults | Personal preference |
| `judgeEmail` | Judge portal login | Per-session auth token |

---

## Realtime subscriptions (what already updates live across users)

The following tables already push live updates to all connected browsers via Supabase realtime in `app.js`:

- `awards`, `winners`, `entries` — live score/status changes
- `events` — event record changes
- `invoices`, `payments` — payment status
- `organisations` — record changes
- `communications`, `deals` — CRM activity
- Notifications channel — bell icon updates

Tables **not** covered by realtime (require a manual page refresh to see another user's changes):  
`event_attendees`, `event_budgets`, `event_budget_items`, `event_vendors`, `event_waitlist`, `running_order`, `event_tickets`, `event_milestones`, `event_tables`, `table_assignments`.

Adding realtime to these is optional — users working the same event simultaneously is an edge case — but worth noting.

---

## Summary — what needs SQL migrations

The following tables are referenced in code and allowlisted in `data-proxy.js` but have no `CREATE TABLE` statement in any migration file:

| Table | Used by | Issue ref |
|---|---|---|
| `event_budgets` | `events.js getBudget()` | C1 |
| `event_budget_items` | `events.js getBudget()` | C1 |
| `event_vendors` | `events.js getVendors()` | C2 |
| `event_waitlist` | `events.js getWaitlist()` | C3 |
| `event_special_requirements` | `events.js _getSpecialReqs()` | C4 |
| `user_preferences` | `crm.js`, `payments.js`, `app.js` | M2, M3, M4 |

Three tables were already added in `database-phase2-tables-setup.sql` (previous session):
`event_tickets`, `event_post_data`, `event_milestones`.

---

## Recommended fix order

1. **SQL migrations** for the 6 tables above — same pattern as `database-phase2-tables-setup.sql`, low risk, high impact.
2. **C6 Judge Conflicts** — add Supabase path in `assignments.js`.
3. **C7 Document Management** — add Supabase Storage + metadata table.
4. **C8 Audit Logs** — route to existing `activity_log` table.
5. **C9 CRM Pipeline Stages** — store in `user_preferences` once that table exists.
6. **C5 Event Templates** — create table, add save/load path.
7. **M1 Saved Views** — defer unless the client specifically uses shared filter presets.
