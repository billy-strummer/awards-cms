# Feature Completeness Re-Audit — 2026-05-29

## Summary

Three recently added features are non-functional due to action-name mismatches between callers and handlers: auto certificate delivery, the public winners page, and all automated deadline-reminder emails from the scheduler. The remaining features (bulk entry actions, entry duplication, group booking, CSV/PDF exports) work correctly but have several notable gaps in edge-case handling, email coverage on bulk operations, and missing database schema migrations.

---

## CRITICAL — Feature is broken / non-functional

### FC2-C1 — Auto certificate delivery calls a non-existent action

- **File:** `winners.js:3940` (caller); `api/certificates-qr.js:760-778` (handler)
- **Impact:** When a winner's status is changed to "Published", `_deliverCertificate()` posts `{ action: 'generate_and_email', winner_id: winnerId }` to `/api/certificates-qr`. The switch statement in `certificates-qr.js` has no `case 'generate_and_email'` — it falls to the `default` branch and returns HTTP 400 "Invalid action". The call is fire-and-forget so the error is silently discarded. No certificate is ever auto-generated or emailed. The same problem affects `resendCertificate()` at line 3963.
- **Fix:** Add a `generate_and_email` case to the switch in `certificates-qr.js` that (a) calls `generateWinnerCertificate()`, then (b) emails the resulting PDF URL via `email-automation` using a `WINNER_NOTIFICATION` or dedicated `CERTIFICATE_DELIVERY` template. If the winner has no org email, log a warning but do not throw.
- [x] Implemented

### FC2-C2 — Public winners page calls a non-existent API action

- **File:** `public-winners.html:433` (caller); `api/voting-proxy.js:340-348` (ACTIONS map)
- **Impact:** `public-winners.html` calls `POST /api/voting-proxy` with `{ action: 'load_winners' }`. The `ACTIONS` map in `voting-proxy.js` only defines: `load_awards`, `load_entries`, `check_votes`, `check_rate_limit`, `check_existing_vote`, `submit_vote`, `load_entry`, `send_vote_confirmation`. There is no `load_winners` action, so the handler returns HTTP 400 "Unknown action: load_winners". The page always shows the error state spinner and "Unable to load winners at this time."
- **Fix:** Add a `loadWinners` function and register it as `load_winners` in the `ACTIONS` map. It should query `winners` joined with `organisations` and `award_years`, filter by `winner_status = 'published'` and embargo (`embargo_until <= now()`), and return both a flat `winners` array and a pre-grouped `grouped` object keyed by award category.
- [x] Implemented

### FC2-C3 — Automation scheduler deadline-reminder emails never send due to action-name mismatch

- **File:** `api/_lib/automation-scheduler.js:452,495` (caller); `api/email-automation.js:1316-1335` (handler)
- **Impact:** `checkDeadlineReminders()` in the scheduler POSTs `{ action: 'send_template', template_type: 'deadline_reminder', recipient_email: ... }` to `/api/email-automation`. The email-automation handler only recognises `case 'send-email'`, `case 'sendTemplate'`, `case 'send-deadline-reminders'`, and `case 'send-winner-announcements'`. The action `send_template` is unknown, so every scheduled deadline reminder returns 400 and is silently dropped. No entry-submission or judging deadline reminder has ever been successfully sent via the scheduler.
- **Fix:** Either (a) change the scheduler to use `action: 'sendTemplate'` with `templateKey` and `toEmail` matching the `sendTemplate` handler's expected fields, or (b) add a `case 'send_template'` alias in `email-automation.js` that maps `template_type → templateKey` and `recipient_email → toEmail` before calling `sendTemplateEmail()`.
- [x] Implemented

---

## HIGH — Feature works but has significant gaps

### FC2-H1 — Bulk entry status update (toolbar) does not fire status-change emails

- **File:** `entries.js:810-863`
- **Impact:** The quick-toolbar `bulkUpdateEntryStatus()` changes statuses for all selected entries but never calls `_sendShortlistEmail()`, `_sendStatusChangeEmail()`, or any email helper. Individual status updates (via the detail modal at line 1234) do fire emails. Bulk approving 50 entries to "Shortlisted" silently skips all 50 notification emails. The `executeBulkAction()` at line 2337 (reached via "More Actions") also skips emails.
- **Fix:** After the `apiClient.updateByFilters()` call in `bulkUpdateEntryStatus()`, loop over `ids` and fire the appropriate email helper for each entry (same logic as lines 1239-1254 in the single-update path). Use `Promise.allSettled()` to avoid blocking on failures.
- [x] Implemented

### FC2-H2 — Automation scheduler deadline reminders have no duplicate-send guard

- **File:** `api/_lib/automation-scheduler.js:437-470`
- **Impact:** `checkDeadlineReminders()` has no check against `email_log` or any dedup table before sending. If the scheduler runs more than once per day (e.g. due to retry, cron misconfiguration, or manual trigger), every qualifying entry contact will receive duplicate reminder emails for each extra run. Payment overdue reminders at line 263 have a proper dedup check via `payment_reminders` table; entry/judging deadline reminders do not.
- **Fix:** Before sending each reminder in `checkDeadlineReminders()`, query `email_log` for a row with `template_key = 'ENTRY_DEADLINE_REMINDER'`, `recipient_email = entry.contact_email`, and `sent_at >= today midnight`. Skip if a row is found.
- [x] Implemented

### FC2-H3 — Entry duplication generates non-unique entry_number on repeat clones

- **File:** `entries.js:1564`
- **Impact:** `cloneEntryToCategory()` generates `newEntryNumber = source.entry_number + '-COPY'` without checking whether that number is already taken. If the same entry is cloned twice, both clones get the same number (e.g. `BTA-2025-001-COPY`), and if there is a unique constraint on `entry_number` the second insert will throw a DB error that surfaces as "Failed to duplicate entry". If there is no unique constraint, two entries with the same number create data integrity problems.
- **Fix:** Append a short random suffix (e.g. `'-COPY-' + Math.random().toString(36).slice(2, 6).toUpperCase()`) or query for existing numbers with the same prefix and increment a counter.
- [x] Implemented

### FC2-H4 — Group booking does not check event capacity before creating attendees

- **File:** `events.js:1362-1388`
- **Impact:** `showGroupBookingModal()` creates N new attendee records and calls `saveAttendees()` without checking whether the event has a `capacity` set and whether the requested seats would exceed it. An operator could accidentally overbook a 100-seat event by booking 200 seats via group booking. The venue capacity tracker (line 938) displays the overbooked state after the fact but does not prevent it.
- **Fix:** After `getAttendees(resolvedEventId)`, look up the event's `capacity` from `STATE.allEvents`. If `(existingAttendees.length + seats) > capacity && capacity > 0`, show a warning confirmation dialog before proceeding.
- [x] Implemented

---

## MEDIUM — Feature works but missing polish/edge cases

### FC2-M1 — `entry_close_date` column is defined on `awards` table but scheduler and email-automation query `award_years`

- **File:** `database-schema.sql:82`; `api/_lib/automation-scheduler.js:433-435`; `api/email-automation.js:936-938`
- **Impact:** The schema only adds `entry_close_date` to the `awards` table (`ALTER TABLE awards ADD COLUMN IF NOT EXISTS entry_close_date DATE`). Both `automation-scheduler.checkDeadlineReminders()` and `email-automation.sendDeadlineReminders()` query the `award_years` table for this column. If `award_years` does not have `entry_close_date`, the queries return zero rows and no reminders are ever triggered — silently.
- **Fix:** Add `ALTER TABLE award_years ADD COLUMN IF NOT EXISTS entry_close_date DATE;` to the schema migrations, or change the scheduler queries to use the correct table (`awards`).
- [x] Implemented

### FC2-M2 — Auto-delivered certificate has no null-email guard

- **File:** `api/certificates-qr.js` (missing `generate_and_email` implementation); `winners.js:3930-3945`
- **Impact:** When `generate_and_email` is eventually implemented, if the winner record has no org email or contact email the certificate generation will succeed but the email send will silently fail with no user-facing indication. There is no fallback (e.g. admin notification or flag on the winner record).
- **Fix:** In the new `generate_and_email` handler, check for a valid recipient email before calling Resend. If missing, update the winner record with `certificate_url` (so the PDF is still stored) and log a warning to the activity log.
- [x] Implemented

### FC2-M3 — `exportAttendeeList` references `accessibility_notes` column that has no schema migration

- **File:** `events.js:2149`; no matching migration in `database-*.sql`
- **Impact:** `exportAttendeeList()` reads `a.accessibility_notes` from `event_attendees` rows. No `CREATE TABLE` or `ALTER TABLE` statement adds this column to `event_attendees`. The column silently returns `null` for all rows and the CSV "Accessibility Notes" column is always blank. Any special accessibility data stored via other means (e.g. in `notes`) is exported under the wrong column header.
- **Fix:** Add `ALTER TABLE event_attendees ADD COLUMN IF NOT EXISTS accessibility_notes TEXT;` and update the attendee add/edit forms to save to this column. Until then, fall back consistently to `notes` in the export.
- [x] Implemented

### FC2-M4 — Automation-scheduler judging-deadline reminders query `awards.judging_deadline` which differs from `award_years.judging_end_date`

- **File:** `api/_lib/automation-scheduler.js:476-477`; `api/email-automation.js:983-988`
- **Impact:** The scheduler's judging-reminder path (lines 474-509) queries the `awards` table for `judging_deadline`. The `email-automation.sendDeadlineReminders()` path queries `award_years` for `judging_end_date`. These are different tables and different column names. The `awards` table has `judging_deadline` (added in `database-schema.sql:83`); the `award_years` table has `judging_end_date` (used elsewhere in the codebase). Whichever path is canonical, the other will never match any rows.
- **Fix:** Decide on one source of truth (probably `award_years.judging_end_date` since that is used by email-automation and judges) and align the scheduler to query the same table/column.
- [x] Implemented

### FC2-M5 — Group booking reference numbers can collide under concurrent requests

- **File:** `events.js:1366`
- **Impact:** Group booking IDs are `GRP-${Date.now()}-${i}`. If two group bookings are submitted within the same millisecond (uncommon but possible in testing or automation), seats `i=0` from both would have the same `id` (`GRP-<timestamp>-0`). Since `saveAttendees()` deletes and re-inserts all attendees for the event, this specific ID is used only in the in-memory array for UI operations (the DB generates its own UUID). However, within a single booking session the UI uses `a.id` for check-in toggle, ticket issuing, and attendee deletion — if two rows share an `id`, the wrong attendee may be affected.
- **Fix:** Use `crypto.randomUUID()` for each attendee `id` in group booking, consistent with how manual attendee adds work at line 1261.
- [x] Implemented

### FC2-M6 — Public winners page has a client-side-only embargo fallback that cannot work

- **File:** `public-winners.html:446-467`
- **Impact:** The page comments "Client-side embargo guard (belt-and-suspenders; server also filters)". Since the server (`load_winners` action) does not exist (FC2-C2), all embargo filtering is currently client-side only. When `load_winners` is implemented server-side, the client-side re-filter at line 448 operates on `data.winners` (a flat array) but the page also accepts `data.grouped` (pre-grouped object). If the server returns only `data.grouped` and omits `data.winners`, the client-side embargo filter runs on an empty array — meaning the client can never further restrict an embargoed winner that the server accidentally included in the grouped response.
- **Fix:** When implementing the server `load_winners` action, always filter embargo server-side and return both `winners` (flat, post-embargo) and `grouped` (derived from the same filtered set). Remove reliance on `data.grouped` overriding `data.winners`.
- [x] Implemented

---

## LOW — Nice to have improvements

### FC2-L1 — No way to view/manage individual judge scorecards in admin UI

- **File:** `entries.js:2845-2884` (score leaderboard); `index.html:2744`
- **Impact:** The admin can see a score leaderboard (ranked averages) and export a PDF scorecard. However there is no drill-down to see an individual judge's detailed scorecard for a specific entry (criteria-level scores, comments, timestamps). Admins cannot identify which judge scored an entry outlier without exporting the full PDF.
- **Fix:** Add a "View Scores" button per entry in the leaderboard that opens a modal fetching `judge_scores` rows for that entry, showing judge name, per-criterion scores, total, and any comments.
- [x] Implemented

### FC2-L2 — Bulk entry status change has no undo/revert mechanism

- **File:** `entries.js:810-863`
- **Impact:** After a bulk status change completes, there is no way to revert it. The activity log records the bulk action at the batch level (one log entry for N entries, with only `ids[0]` as the reference entity) making surgical rollback impossible. The `entries.js` module has no undo stack.
- **Fix:** Either (a) expand the activity log to record per-entry previous/new status (adding an `old_status` column), enabling a "Revert last bulk action" feature, or (b) add a confirmation with a 10-second toast undo window before committing the DB write.
- [x] Implemented

### FC2-L3 — Certificate log / auto-delivery history has no admin UI

- **File:** `winners.js` (no certificate log view); `api/certificates-qr.js` (no logging of delivery)
- **Impact:** When `generate_and_email` is fixed, there is no table or UI showing which winners have had certificates auto-generated, when they were sent, and whether delivery succeeded. The `winners` table has a `certificate_url` field but no `certificate_sent_at` or `certificate_delivery_status` field.
- **Fix:** Add `certificate_sent_at TIMESTAMPTZ` and `certificate_delivery_status TEXT` columns to the `winners` table. Update the auto-delivery handler to write these fields on success/failure. Add a "Certificate Log" column or expandable row to the winners table UI.
- [x] Implemented

### FC2-L4 — Group bookings list has no empty state or summary badge

- **File:** `events.js` (attendees panel); `index.html` (attendees modal)
- **Impact:** Group-booked attendees appear in the regular attendees list with notes like "Group booking ref: GRP-…". There is no dedicated "Group Bookings" sub-tab or summary count badge, so admins cannot quickly distinguish group-booked seats from individual registrations.
- **Fix:** Add a filter chip or badge in the attendees tab header showing "X group-booked seats" (rows where `notes` starts with "Group booking ref:"). Optionally add a `booking_type` column (`individual` / `group`) to `event_attendees`.
- [x] Implemented

### FC2-L5 — Bulk entry toolbar lacks "Approve" as a distinct action separate from "Shortlist"

- **File:** `index.html:2715-2719`
- **Impact:** The toolbar button reads "Approve (Shortlist)" and immediately sets status to `shortlisted`. For programs that have a separate "Approved" gate before shortlisting, this conflates two distinct steps. In the More Actions modal (line 2224), there is a "Mark as Submitted" option but no generic "Approve / Move to Review" step.
- **Fix:** If the workflow requires a separate "Approved" status before shortlisting, add it to the status enum and to the bulk toolbar. Otherwise, rename the button to just "Shortlist" to avoid confusion.
- [x] Implemented
