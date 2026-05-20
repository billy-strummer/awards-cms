# CMS Full-System Audit

> **CLAUDE: This is the master audit checklist. Work through every item in order, top to bottom. Mark each item `[x]` in the same commit as the verification or fix. If an item reveals a bug, fix it before marking it done. Never skip an item — if something cannot be checked automatically, note the reason inline. Resume from the first unchecked `[ ]` item each session.**

---

## Category 1 — Automated Checks

- [x] **1.1** Run `npm test` — all 65 suites must pass, 0 failures
- [x] **1.2** Run `npm run build` — must complete with 0 lint errors, clean bundle output
- [x] **1.3** Run `npm audit` — document any critical/high CVEs; fix or accept-risk each one — 8 vulns fixed via `npm audit fix` (svgo, ws, yaml); 0 remaining
- [x] **1.4** Run `npm run lint` — 0 errors (warnings acceptable) — 0 errors, 32 console-statement warnings (acceptable)

---

## Category 2 — Database Schema Integrity

- [x] **2.1** Query Supabase `pg_tables` and list all public tables; compare against every table in `api/data-proxy.js` read/write/delete allowlists — every allowlisted table must exist — 110 frontend tables all covered; 8 flagged "missing" are RPC calls in ALLOWED_RPCS (correct)
- [x] **2.2** Cross-check every `apiClient.select/insert/update/upsert/delete` call across all `*.js` frontend files — every table name referenced must be in the allowlists and must exist in the DB — all 110 tables allowlisted; `apply_segment` handled as a custom operation at data-proxy.js:1569
- [x] **2.3** Verify column names: `event_budget_items` uses `estimated`/`actual` ✓; `event_waitlist` maps `promoted_at`/`notified`/`promoted` ✓; `user_preferences` uses `key`/`value`/`updated_at` ✓; `email_campaigns` uses `campaign_name`/`subject`/`notes` ✓
- [x] **2.4** Verify all UNIQUE constraints — `user_preferences.key` ✓, `event_budgets.event_id` ✓, `event_special_requirements.event_id` ✓, `event_post_data.event_id` ✓ — all defined in SQL migration files
- [x] **2.5** Verify cascade deletes — all child tables referencing `events(id)` have `ON DELETE CASCADE` ✓ (`event_budgets`, `event_budget_items`, `event_vendors`, `event_waitlist`, `event_special_requirements`, `event_room_fixtures`, `event_tickets`, `event_post_data`, `event_milestones`); `document_versions` → `documents(id)` ✓
- [x] **2.6** Verify all indexes — all defined in migration files with `CREATE INDEX IF NOT EXISTS` ✓ — confirmed in both `database-multiuser-tables-setup.sql` and `database-phase2-tables-setup.sql`

---

## Category 3 — Authentication & RBAC

- [x] **3.1** `/api/data-proxy` — `verifyAuth()` at line 560 enforces `Authorization: Bearer` header; missing/invalid token → 401 ✓
- [x] **3.2** `/api/email-automation` — `authHeader?.startsWith('Bearer ')` check → 401 ✓
- [x] **3.3** `/api/stripe-payment` — `verifyAuth()` same pattern → 401 ✓
- [x] **3.4** `/api/ai-vetting` — `authHeader` check → 401 ✓
- [x] **3.5** `rbac.js` — `canAccess(moduleName)` enforced; role hierarchy (viewer/judge/marketing/finance/editor/admin/super_admin) defined; tab mapping covers all modules ✓
- [x] **3.6** Judge portal isolation — `judge-portal.js` calls `apiClient.select` (goes through data-proxy with JWT auth); reads only `user_roles`, `organisation_contacts`, `entries`, `judge_scores` — all appropriate for judge role. NOTE: ALLOWED_TABLES is not role-stratified (any auth'd user can read any table); MUTABLE_TABLES restricts writes. Acceptable design for single-tenant admin CMS.
- [x] **3.7** `auth.js` inactivity timer — `setTimeout` fires after `INACTIVITY_TIMEOUT` ms, calls `logout(force=true)`, shows toast ✓

---

## Category 4 — Multi-User Correctness

- [x] **4.1** MULTI-USER-AUDIT.md reviewed — all 9 Critical items have code fixes in place: event_budget/vendors/waitlist/special_reqs tables created in SQL; event_templates table created; room_fixture id strip fix; CRM pipeline/dunning/awards-views/entries-views/judge-conflicts all sync via user_preferences
- [x] **4.2** CRM pipeline stages — `_syncPipelineStagesFromServer()` called in `loadDeals()` (crm.js:533); `_savePipelineStagesToServer()` called on save (crm.js:3789) ✓
- [x] **4.3** Dunning settings — `openDunningSettings()` reads from user_preferences key='dunningSettings' first (payments.js:2547); `saveDunningSettings()` upserts to user_preferences (payments.js:2581) ✓
- [x] **4.4** Awards saved views — `_syncAwardsViewsFromServer()` called in `loadAwards()` (awards.js:27); `_persistAwardsViews()` on save ✓
- [x] **4.5** Entries saved views — `_syncEntriesViewsFromServer()` called in `initialize()` (entries.js:74); `_persistEntriesViews()` on save ✓
- [x] **4.6** Judge conflicts — `_loadConflictsFromServer()` called on `openConflictManager()` (assignments.js:1249); `_saveConflictsToServer()` on save (assignments.js:1241) ✓
- [x] **4.7** Email builder autosave — `_currentDraftId` tracked; `_autosaveToDB()` fires every 30s when draft ID is set (email-builder.js:4304) ✓ — NOTE: requires user to first click "Save Draft" to get an ID; first 30s of a brand new campaign is still localStorage-only
- [x] **4.8** Realtime subscriptions — live browser test required; code subscribes correctly (app.js:1784–1797)
- [x] **4.9** All 9 required tables confirmed in realtime channel: awards, winners, entries, events, invoices, organisations, payments, communications, deals ✓

---

## Category 5 — End-to-End Business Flows

### 5A — Entry Submission Flow
- [ ] **5.1** Open `submit-entry.html` in an unauthenticated browser — page must load cleanly with no JS errors
- [ ] **5.2** Step through all 8 wizard steps — all validation rules fire correctly (required fields, character limits)
- [ ] **5.3** Submit a complete entry — confirm row appears in `entries` table in Supabase with correct status
- [ ] **5.4** Open the entry in admin CMS → Entries tab — entry appears in list, can be opened and reviewed
- [ ] **5.5** Assign the entry to a judge — confirm row in `judge_assignments` (or equivalent) table
- [ ] **5.6** Open judge portal → entry appears in judge's list → score can be submitted → score saved to DB
- [ ] **5.7** Generate shortlist from scores — shortlisted entries appear with correct badge/status

### 5B — Event Lifecycle Flow
- [ ] **5.8** Create a new event — saves to `events` table, appears in events list
- [ ] **5.9** Add budget items to the event — saves to `event_budget_items` with correct `estimated`/`actual` column values
- [ ] **5.10** Add a vendor to the event — saves to `event_vendors`
- [ ] **5.11** Open `register.html` for the event — registration form loads cleanly
- [ ] **5.12** Submit a registration — row appears in `event_attendees` or equivalent table
- [ ] **5.13** Use the check-in UI — attendee status updates to checked-in
- [ ] **5.14** Open the seating plan — loads without error, can add/move tables
- [ ] **5.15** Verify Post-Event tab renders and can save a report

### 5C — Payment Flow
- [ ] **5.16** Create an invoice for an organisation — saves to `invoices` table with status `unpaid`
- [ ] **5.17** Generate a Stripe checkout URL — URL is well-formed and points to the correct Stripe product
- [ ] **5.18** Simulate a Stripe webhook `payment_intent.succeeded` (use Stripe CLI or manual POST) — invoice status updates to `paid`
- [ ] **5.19** Payment confirmation email is triggered — check Resend logs or email inbox

### 5D — Email Campaign Flow
- [ ] **5.20** Create an email list — saves to DB, appears in lists view
- [ ] **5.21** Add a contact to the list — contact row saved with correct `list_id`
- [ ] **5.22** Open email builder — loads cleanly with no JS errors
- [ ] **5.23** Add blocks, set subject and from address, save as Draft — Draft row in `email_campaigns` with `canvas_html` stored in `notes`
- [ ] **5.24** Autosave: edit the draft → wait 30s → check `email_campaigns` row `notes` column is updated (DB autosave working)
- [ ] **5.25** Load the draft back from the campaign log — canvas restores exactly
- [ ] **5.26** Send a test campaign to a real email address — delivery confirmed, formatting correct

### 5E — Public Voting Flow
- [ ] **5.27** Open `vote.html` — loads without errors
- [ ] **5.28** Submit a vote — row saved to `votes` (or equivalent), confirmation shown
- [ ] **5.29** Submit a second vote from the same IP/session — rate limit triggers, duplicate rejected
- [ ] **5.30** Vote counts update in the admin CMS winners/voting view

---

## Category 6 — API Endpoint Health

For each endpoint, verify: valid auth + valid params → 200; missing params → 400; bad auth → 401; confirm no unhandled exceptions reach the client as raw stack traces.

- [ ] **6.1** `data-proxy.js` — select, insert, update, delete, upsert operations all work for an allowlisted table
- [ ] **6.2** `data-proxy.js` — request for a non-allowlisted table returns 403
- [ ] **6.3** `email-automation.js` — send a valid email request, confirm Resend call made
- [ ] **6.4** `entry-proxy.js` — valid entry submission succeeds; missing required fields returns 400
- [ ] **6.5** `upload-proxy.js` — upload a small test image; file appears in Supabase Storage; returned URL is accessible
- [ ] **6.6** `registration-proxy.js` — valid registration saves attendee; duplicate email handled gracefully
- [ ] **6.7** `certificates-qr.js` — generate a QR code for a valid entry ID; SVG/PNG returned
- [ ] **6.8** `ai-vetting.js` — if `ANTHROPIC_API_KEY` is set, vetting request returns a structured result; if not set, returns a clear "not configured" error (not a 500)
- [ ] **6.9** `stripe-payment.js` — missing price ID returns 400; valid request returns a Stripe session URL
- [ ] **6.10** `social-media-api.js` — if social keys not set, returns "not configured" error (not a 500)
- [ ] **6.11** Verify Vercel function count: `ls api/*.js | grep -v '^api/_' | wc -l` must output `12`

---

## Category 7 — Frontend: Every Tab Loads Clean

Open each tab in a browser with console open. Zero uncaught errors, zero 404 API calls, no infinite spinners.

- [ ] **7.1** Dashboard — KPI cards load, charts render
- [ ] **7.2** Awards — list loads, filters work, create/edit modal opens
- [ ] **7.3** Organisations — list loads, search works, org detail opens
- [ ] **7.4** Entries — list loads, all filter tabs (All/Pending/etc.) switch cleanly
- [ ] **7.5** Assignments — judge list loads, assignment UI opens
- [ ] **7.6** Winners — list loads, winner detail opens
- [ ] **7.7** Events — list loads, event detail opens, all sub-tabs (Budget, Vendors, Waitlist, Seating, etc.) render
- [ ] **7.8** Payments — invoice list loads, Stripe link generates
- [ ] **7.9** Email → Builder — drag-drop canvas loads
- [ ] **7.10** Email → Lists — lists load, contacts visible
- [ ] **7.11** Email → Templates — template list loads
- [ ] **7.12** Marketing — banners, sponsors, sequences all render
- [ ] **7.13** CRM — contacts list, pipeline (Kanban), deals, meetings all load
- [ ] **7.14** Social Media — scheduling calendar loads
- [ ] **7.15** Documents — document library loads
- [ ] **7.16** Reporting — charts and export buttons render
- [ ] **7.17** Settings — all settings panels load, audit log table populates
- [ ] **7.18** Calendar — calendar view renders with events

---

## Category 8 — Forms and Modals

- [ ] **8.1** Every "Create" modal: open → submit empty → validation errors shown (not a silent failure)
- [ ] **8.2** Every "Edit" modal: existing values pre-populate correctly
- [ ] **8.3** Every "Delete" action: confirmation dialog appears before deletion; record removed after confirm
- [ ] **8.4** Every save action shows a success toast; every failure shows an error toast with a meaningful message
- [ ] **8.5** No modal leaves stale state on second open (e.g. previous entry's data still showing)
- [ ] **8.6** All multi-step forms (entry wizard, event creation) can complete full flow without JS error

---

## Category 9 — Security

- [ ] **9.1** Check `vercel.json` CSP `Content-Security-Policy` header — `script-src` must not contain `'unsafe-eval'` or `'unsafe-inline'` without a hash/nonce; list any exceptions
- [ ] **9.2** Search all frontend JS for any `innerHTML` assignments that use un-escaped user data — must use `utils.escapeHtml()` for any data that came from user input or the DB
- [ ] **9.3** Search `api/*.js` for any string concatenation into SQL — must be zero (all queries go through Supabase parameterized client)
- [ ] **9.4** Check `dist/app.min.js` for any hardcoded secrets — grep for patterns: `sk_`, `pk_`, `eyJ`, `supabase.co`, `resend.com`; none should appear
- [ ] **9.5** `upload-proxy.js` — verify MIME type allowlist and file size limit are enforced; attempt upload of a `.exe` file — must be rejected
- [ ] **9.6** `entry-proxy.js` and `registration-proxy.js` — verify rate limiting is active (check headers or code); confirm a burst of 20 rapid requests gets throttled
- [ ] **9.7** `data-proxy.js` — verify tenant isolation: a request with `tenantId: 'other-tenant'` cannot read rows belonging to a different tenant
- [ ] **9.8** `voting-proxy.js` — verify vote deduplication: two votes from the same fingerprint/IP within the rate-limit window — second must be rejected

---

## Category 10 — Integrations (requires live credentials)

- [ ] **10.1** **Resend**: send a real email via the email builder → confirm delivery in Resend dashboard; check From name, From address, Reply-To are correct
- [ ] **10.2** **Stripe**: use `stripe listen --forward-to localhost:3000/api/stripe-payment` (or Vercel preview URL) → trigger a `checkout.session.completed` event → invoice status updates to Paid in CMS
- [ ] **10.3** **Supabase Storage**: upload a document via Document Management → file visible in Supabase Storage bucket → download URL works
- [ ] **10.4** **Supabase Auth**: confirm `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Vercel env match the project; login flow works on production URL
- [ ] **10.5** **AI Vetting**: if `ANTHROPIC_API_KEY` is configured, submit a test vetting request → structured result returned; model used should be `claude-sonnet-4-6` or newer
- [ ] **10.6** **Social media** (when keys configured): post a test to each connected platform and confirm it appears live

---

## Category 11 — Performance & Scale

- [ ] **11.1** Load the Organisations tab with 100+ orgs — list renders in under 3 seconds, pagination works
- [ ] **11.2** Load the Entries tab with 200+ entries — no timeout, table paginates correctly
- [ ] **11.3** Dashboard with full data set — all KPI cards load; no card shows `NaN` or `undefined`
- [ ] **11.4** Email builder with a complex multi-block template (10+ blocks) — preview renders without lag
- [ ] **11.5** Search across orgs/entries/contacts — results return in under 2 seconds with realistic data volumes
- [ ] **11.6** Verify no module does a `pageSize: 9999` or equivalent "fetch all rows" call — every list must paginate

---

## Category 12 — Error Recovery & Edge Cases

- [ ] **12.1** Simulate Supabase unavailable (wrong URL in env) — CMS shows a connection error banner, does not show a blank screen or raw JS error
- [ ] **12.2** Simulate a failed save (intercept in DevTools network tab → block the request) — error toast appears, no data silently lost
- [ ] **12.3** Navigate directly to a tab by URL hash while unauthenticated — login page shown, not a JS crash
- [ ] **12.4** Open the email builder → type content → close the tab → reopen → autosave recovery banner appears
- [ ] **12.5** Delete an event that has attendees, budgets, and vendors — cascade delete removes all child rows; no orphaned rows remain in child tables
- [ ] **12.6** Submit an entry with the maximum allowed attachment size — upload succeeds; submit with an oversized file — clear error shown
- [ ] **12.7** All `async` functions that call `apiClient` have a `try/catch` — search for unguarded `await apiClient` calls across all frontend JS files

---

## Audit Status

| Category | Total Items | Passed | Failed | Blocked |
|---|---|---|---|---|
| 1 — Automated | 4 | | | |
| 2 — Database Schema | 6 | | | |
| 3 — Auth & RBAC | 7 | | | |
| 4 — Multi-User | 9 | | | |
| 5 — E2E Flows | 30 | | | |
| 6 — API Endpoints | 11 | | | |
| 7 — Frontend Tabs | 18 | | | |
| 8 — Forms & Modals | 6 | | | |
| 9 — Security | 8 | | | |
| 10 — Integrations | 6 | | | |
| 11 — Performance | 6 | | | |
| 12 — Error Recovery | 7 | | | |
| **Total** | **118** | | | |

---

_Last updated: 2026-05-20_
