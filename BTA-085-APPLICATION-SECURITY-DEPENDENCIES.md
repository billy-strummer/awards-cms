# BTA-085 — Application Security Dependency Audit

**Scope:** read-only code tracing of how browser-facing and server-side operations access data. No file was modified, no Supabase connection was made. Prior live-database findings (BTA-078/079) are cited as historical evidence, not re-verified.

## Executive summary

Server-side API handlers are consistently and correctly built on the service-role client, with sound shared authentication (`api/_lib/auth.js`) and generally correct role gating, including for GDPR RPCs and user management. **However, this audit found a material correction to the premise behind migration 093 (BTA-080) and the "zero legitimate browser dependency" conclusion in BTA-079/080's remediation plan.** Those tasks' grep for direct browser-side Supabase calls used a single-line pattern (`supabase\.(from|rpc)\(`) that misses the common multi-line method-chain style used throughout this codebase (`supabase\n  .from(...)`). A corrected, multiline-aware search finds **several additional real, deployed direct-client dependencies** — most importantly, an admin "Test Data Manager" feature (`test-data-manager.js`, loaded by every admin session via `src/partials/99-shell-foot.html`) that directly reads/writes **34 tables**, including `organisations`, `organisation_contacts`, `entries`, `award_assignments`, `invoices`, `payments`, `award_years`, and `event_guests` — i.e. every table migration 093 targets, plus the one table (`event_guests`) it deliberately excludes. This directly contradicts migration 093's own header comment ("ZERO matches... every legitimate read/write... already routes through api/data-proxy.js or api/entry-proxy.js") and BTA-080's compatibility analysis. Separately, `payment-success.html` (a real public confirmation page) directly queries `payments` with the anon key. These are **Confirmed** findings, not potential ones — see evidence below.

## 1. Supabase client initialisation

**Server-side (`api/*.js`):** all 11 files that call `createClient` use `process.env.SUPABASE_SERVICE_KEY` for their primary data client — confirmed by direct grep (`api/certificates-qr.js:22`, `api/data-proxy.js:31`, `api/email-automation.js:21`, `api/entry-proxy.js:21`, `api/judge-automation.js:29`, `api/registration-proxy.js:17`, `api/resend-email.js:22`, `api/social-media-api.js:13`, `api/stripe-payment.js:36`, `api/upload-proxy.js:18`, `api/voting-proxy.js:20`). `api/social-media-api.js:14-16` additionally creates a second client with `SUPABASE_ANON_KEY` (falling back to the service key if unset) — confirmed (`api/social-media-api.js:482`) this second client is used **only** for `supabaseAuth.auth.getUser(token)` (JWT verification), never for table/RPC access. `api/ai-vetting.js` does not create a Supabase client directly; it uses `api/_lib/auth.js`'s shared `verifyAuth`/`getUserRole` and gates itself at `editor` minimum role (`api/ai-vetting.js:14-24`).

**Browser-side, legitimate anon-key clients (session/auth only):** `auth.js:25`, `reset-password.js:64`, `public-utils.js:72` all construct an anon-key client used only for `supabase.auth.*` — confirmed no `.from()`/`.rpc()` call exists in any of these three files.

**Shared server-side auth module:** `api/_lib/auth.js` provides `verifyAuth` (Bearer-JWT verification via `supabaseAuth.auth.getUser`), `getUserRole` (looks up `user_roles` by email using a service-role client, defaults to `'viewer'` on any error — a fail-safe, least-privilege default), and `hasMinimumRole` (ordinal comparison against `ROLE_HIERARCHY = ['viewer','judge','marketing','finance','editor','admin','super_admin']`). This is sound, consistently shared design.

## 2. Role checks — client-side vs server-side

`rbac.js` defines the same 7-role hierarchy client-side for UI gating (hide/show). Server-side, `api/data-proxy.js`'s `ROLE_PERMISSIONS` (per-table read/write Sets) and `ALLOWED_RPCS` are the actual enforcement point. Spot-checked:
- GDPR RPCs: `anonymize_organisation: 'super_admin'`, `erase_organisation_gdpr: 'super_admin'` (`api/data-proxy.js:92-93`) — **confirmed unchanged**, consistent with BTA-076/077's own record.
- User management (`user_list`/`user_invite`/`user_set_role`/`user_set_status`/`user_reset_password`): gated as a block at `super_admin` (`api/data-proxy.js:2267-2270`), **before** dispatching to the specific operation — correct, cannot be bypassed by reaching an individual operation handler directly. `executeUserSetRole` additionally blocks a Super Admin from demoting themselves (`api/data-proxy.js:1700-1702`) — a sensible extra guard against accidental lockout.
- Financial tables (`invoices`/`payments`): writable by both `editor` and `finance` roles (`api/data-proxy.js:454-456`, `522-524`) — this is a **pre-existing, already-resolved** design decision (BTA-047B, "finance/editor role-hierarchy tension"), not a new finding.

No case was found in this spot-check where the server grants broader access than the client-side model implies (the inverse — server more permissive than the UI suggests — would be the dangerous direction; none found here).

## 3. Administrative endpoints (`api/data-proxy.js`)

Dispatch is table/operation-driven through `ALLOWED_TABLES`/`MUTABLE_TABLES`/`ROLE_PERMISSIONS` for generic CRUD, plus dedicated, individually-gated functions for sensitive non-generic operations (user management, RPCs, storage uploads, award-area import). This two-tier design was not found to have a gap in the areas sampled.

## 4. Public entry/nomination submission (`api/entry-proxy.js`)

Not re-traced from scratch this task — BTA-077's investigation fork already confirmed server-side validation (contact-name/description minimum length, email format, per-email rate limiting, input sanitisation, GDPR consent timestamp/IP recording) and organisation matching via the shared `api/_lib/organisation-matching.js` helper. No contradicting evidence found this pass; not independently re-verified line-by-line given the multiple other forks running this programme.

## 5. GDPR workflows

`gdpr.js` makes zero direct Supabase calls (confirmed: no `supabase.(from|rpc|createClient)` match anywhere in the file) — everything routes through `apiClient` → `/api/data-proxy`. Both RPCs remain `super_admin`-gated (Section 2). Consistent with BTA-076/077/080's record; no new finding.

## 6. Sponsorship workflows

`marketing.js` (admin) and `become-a-sponsor-packages.js` (public) were not re-traced line-by-line this task — BTA-077's fork already confirmed the full path (`marketing.js` → `api/data-proxy.js`'s `sponsorship_catalogue_packages` entries in `ALLOWED_TABLES`/`MUTABLE_TABLES`/`ROLE_PERMISSIONS` → `api/entry-proxy.js`'s public read → `become-a-sponsor-packages.js`'s render, with the `enquiry_destination` fix and static-fallback behaviour all confirmed correct). No contradicting evidence found. `become-a-sponsor-packages.js` was separately confirmed (BTA-079) to make no direct Supabase calls.

## 7. File uploads

`api/upload-proxy.js` uses the service-role client (`api/upload-proxy.js:18`); `ALLOWED_STORAGE_BUCKETS` in `api/data-proxy.js` gates bucket access by role (`media`/`media-gallery`/`sponsor-assets`/`organisation-logos`: `editor`; `brand-assets`: `admin`) — consistent with BTA-073/074's prior record, not re-derived in depth this task.

## 8. Direct browser database calls — CORRECTED finding (the main result of this audit)

A **multiline-aware** grep (`grep -n "^\s*\.from(\|^\s*\.rpc(\|supabase\.\(from\|rpc\)("`) across every browser-facing `.js`/`.html` file (excluding `api/`, `tests/`, `dist/`, `scripts/`) finds considerably more than the single previously-known exception (`check-in-app.js`'s `events`/`event_guests`). **Confirmed, with exact evidence:**

### 8.1 `test-data-manager.js` — Confirmed, high impact on migration 093

- Loaded in every admin session via `src/partials/99-shell-foot.html` (bundled into the SPA shell, not a standalone script).
- Exposed in the admin UI via a hidden dropdown in `src/partials/00-shell-head.html:150-174` (`id="testModeDropdown"`, class `d-none`, revealed only by a documented `Ctrl+Shift+D` shortcut — **this is UI obscurity, not access control**: any authenticated user of any role, including `viewer`, can invoke `testDataManager.generateTestData()`/`removeTestData()`/`generateMockOrder()`/`removeMockOrders()` directly from the browser console regardless of whether the menu is visible).
- Uses `STATE.client` (`test-data-manager.js:26`, confirmed defined at `auth.js:25` as the anon-key client — but since the user is logged in, Postgres RLS sees `role: authenticated`, not `anon`).
- The file's own header comment (`test-data-manager.js:3-5`) states: *"STATE.client.from() is intentional: test data setup requires direct DB access (insert/delete/upsert) that bypasses RLS and validation for test fixture management."* This is a documented, deliberate architectural exception to the service-role-proxy pattern — not an accident — but it means this feature's continued functioning depends on broad `authenticated`-role table access.
- Exact table list touched directly (34, via grep of every `.from('...')` call in the file): `award_assignments`, `award_years`, `awards`, `banners`, `communications`, `contact_segments`, `counties`, `deals`, `email_templates`, `entries`, `event_attendees`, `event_galleries`, `event_guests`, `event_tables`, `event_ticket_types`, `event_tickets`, `events`, `invoice_line_items`, `invoices`, `judge_scores`, `media_gallery`, `media_items`, `meeting_notes`, `organisation_contacts`, `organisation_follow_ups`, `organisation_segments`, `organisations`, `payments`, `public_votes`, `running_order`, `running_order_settings`, `scheduled_reports`, `social_media_posts`, `sponsors`, `table_assignments`, `winners`.
- **This overlaps every one of migration 093's 8 target tables** (`organisations`, `organisation_contacts`, `entries`, `award_assignments`, `invoices`, `payments`, `award_years` — directly; `gdpr_requests` is the only 093 target not in this list) **and `event_guests`, the table 093 deliberately excludes because 078/079 already lock it to `authenticated` SELECT/UPDATE only** — `test-data-manager.js` would need `authenticated` INSERT/DELETE on `event_guests` too (it generates and removes test guest records), which 078/079's narrower `event_guests_select`/`event_guests_update` policies do **not** grant.
- **Direct contradiction of migration 093's own header comment**, which states flatly that a repo-wide grep found zero direct dependency on its 8 target tables and that "every legitimate read/write... already routes through api/data-proxy.js or api/entry-proxy.js." That grep was run with the single-line pattern and missed this file entirely.

### 8.2 `payment-success.html` — Confirmed, public-facing

- `payment-success.html:171-180`: constructs its own anon-key client and directly `SELECT`s `payments` (`id, payment_reference, amount`) filtered by `entry_id` from the URL query string, to show the user their payment reference on the confirmation page.
- Degrades gracefully on failure (`payment-success.html:207-215`: a `catch` block falls back to showing the raw entry ID instead of a payment reference) — **so locking down `payments` for `anon` would not crash this page**, but it would silently stop showing the payment reference/confirmation message to every visitor, a real, visible regression on a real public page.
- Not scoped to an authenticated owner — any visitor who has (or guesses) an `entryId` can query this today; worth noting as a pre-existing, independent minor exposure (payment amount + reference number, not card data) separate from the migration-093 compatibility question.

### 8.3 `document-management.js` — Confirmed, admin-only

- Uses the same `STATE.client` pattern (`document-management.js:26`, via a `_client()` helper) to directly read/write `documents` and `document_versions` (`document-management.js:369,398,415,452,530,536,542`). Neither table is in migration 093's or migration 088's scope, so not an immediate blocker for 093 specifically, but the same architectural pattern (admin feature bypassing the service-role proxy) applies, and these two tables' live RLS/grant state has never been checked in this project's security work to date — **Unknown**.

### 8.4 `judge-login.html` — Confirmed, narrowly scoped, lower severity

- `judge-login.html:190-193, 240-243`: directly `SELECT`s `user_roles` (`role` column only), filtered to the caller's own email (`.eq('email', session.user.email)` / `.eq('email', email)`) immediately after that same user authenticates, to decide whether to route them to the judge portal. This is a minimal, self-scoped read, a materially lower-risk pattern than the others above — but it is still a real, deployed direct-client dependency on `user_roles` that any future RLS work on that table must account for. `user_roles`' live RLS/grant state has never been checked — **Unknown**.

### 8.5 `clear-test-data.js` — Not a browser dependency

- Confirmed via its `require('dotenv').config()` header and the absence of any `<script src="clear-test-data.js">` reference in any `.html` file: this is a standalone Node CLI script, in the same category as the `scripts/` folder tools already excluded by BTA-079/080's own reasoning. Not a browser-facing concern.

### 8.6 `check-in-app.js` — re-confirmed, one addition

- `events` (`:36`) and `event_guests` (`:67,150,185,229`) re-confirmed exactly as BTA-079/080 recorded. **New in this pass:** `check-in-app.js:201` also directly queries `table_assignments` — a table confirmed hardened via migration 085 per BTA-052's live test-project check, with (per that migration's own design) an `authenticated`-SELECT-only policy already compatible with a read here; not re-verified live this task, but flagged so a future task checks `check-in-app.js`'s exact usage (read-only vs. write) against `table_assignments`' intended policy shape before assuming full compatibility.

## 9. Error-message leakage

Not re-swept exhaustively this task (BTA-077 already found and fixed 3 instances: `judge-automation.js`, `ai-vetting.js`, `social-media-api.js`). No new instance found in the files read for this audit.

## Confirmed issues requiring future attention (not fixed here)

1. **Migration 093's compatibility analysis needs revision** before application: it would break `test-data-manager.js`'s direct access to `organisations`/`organisation_contacts`/`entries`/`award_assignments`/`invoices`/`payments`/`award_years`, and its `event_guests` write path (INSERT/DELETE) is not covered by the existing `event_guests_select`/`event_guests_update` policies either. A decision is needed: refactor this admin tool to go through `api/data-proxy.js` (preferred, consistent with the rest of the app's architecture), or carve out explicit, scoped `authenticated` policies for it, or accept the feature breaking and gate it off entirely. **This is a business/architecture decision, not made here.**
2. `payment-success.html`'s direct `payments` read will degrade (not crash) once `anon` access to `payments` is revoked — a real, visible UX regression on a public page that should be accounted for in the same remediation plan, likely by having this page call a server-side proxy endpoint instead.
3. `document-management.js` and `judge-login.html`'s direct dependencies on `documents`/`document_versions`/`user_roles` are confirmed to exist but their live RLS/grant state is unverified (Unknown) — out of scope for the already-authored migration 093, but should be checked before any future RLS work touches those three tables.
4. The hidden-dropdown-as-access-control pattern for the Test Data Manager feature (`d-none` + keyboard shortcut, no role check) means any authenticated user of any role can currently invoke it from the browser console — a separate, lower-severity finding from the table-exposure question, but worth noting as its own item.
