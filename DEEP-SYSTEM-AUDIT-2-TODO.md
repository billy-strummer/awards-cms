# Deep System Audit 2 — 2026-05-31

## Summary

Six-agent deep audit covering: Load & Scalability, GDPR/Legal Compliance, Operational Readiness,
Email Deliverability, Stripe/Payment Robustness, and Public-facing Pages security.

**Severity counts:** 14 Critical · 18 High · 16 Medium · 8 Low

---

## CRITICAL

### [x] DS2-C1 — Sequential email sends will timeout Vercel (30s limit)

- **Files:** `api/email-automation.js` lines ~573 (sendWinnerAnnouncements), ~446 (sendDeadlineReminders)
- **Description:** Both functions loop through recipients and `await sendTemplateEmail()` sequentially. 1000 winners × 500ms per email = 500 seconds → Vercel timeout. 150 emails (100 draft entries + 50 judges) × 500ms = 75 seconds → timeout.
- **Fix:** Replace sequential for-loop with `Promise.all` batched to 5 concurrent sends.

### [x] DS2-C2 — N+1 query in judge assignment (up to 10,000 DB queries)

- **File:** `api/judge-automation.js` lines 83–136
- **Description:** `assignJudgesToEntries()` queries `judge_scores` **per entry per judge** inside a loop. 100 entries × 50 judges = ~10,000 queries. Should batch-fetch all assignments once, then filter in-memory.
- **Fix:** Fetch all `judge_scores` in one query before the loop; build a Map keyed by entry_id.

### [x] DS2-C3 — Missing FK indexes on `entries` and `public_votes` tables

- **Description:** `entries(award_id)`, `entries(organisation_id)`, `entries(status)`, `entries(is_public)`, `public_votes(voted_at)`, `public_votes(voter_ip)`, `judge_scores(judge_email, is_complete)` have no indexes. Rate-limit checks on `public_votes` become full table scans.
- **Fix:** New migration `054-additional-indexes.sql`.

### [x] DS2-C4 — Supabase connection pool exhaustion under concurrent load

- **Files:** All `api/*.js`
- **Description:** Every API file creates its own `createClient()` at module level. With 12 functions × concurrent invocations, and Supabase's default 20-connection pool, this exhausts connections at ~15–20 concurrent requests.
- **Fix:** Create `api/_lib/supabase-client.js` singleton; update all API files to use it.

### [x] DS2-C5 — GDPR right-to-erasure incomplete (orphaned PII in 6 tables)

- **File:** `gdpr.js` lines 527–548
- **Description:** `_deleteEntityData()` deletes from `organisation_contacts`, `award_assignments`, `entries`, `organisations` — but NOT from `email_logs`, `event_guests`, `crm_communications`, `crm_deals`, `crm_meetings`, `public_votes`. GDPR Article 17 requires complete erasure.
- **Fix:** Add missing tables to the deletion cascade in `gdpr.js`.

### [x] DS2-C6 — N+1 deadline reminders (separate query per judge)

- **File:** `api/email-automation.js` lines 464–502
- **Description:** Loops through judges, querying `judge_scores` and `award_years` per judge. 100 judges = 200 queries minimum.
- **Fix:** Batch-fetch all scores once before the loop; fetch deadline once outside the loop.

### [x] DS2-C7 — In-memory rate limit map — race condition and shared-state risk

- **File:** `api/data-proxy.js` lines ~1069–1106
- **Description:** Module-level `rateLimits = new Map()` with a `lastCleanup` timestamp. Two simultaneous requests can race on `lastCleanup`. Each Vercel instance has its own Map, so rate limiting is not distributed.
- **Fix:** Move rate limiting to Supabase table (`rate_limit_log`) or accept per-instance limits (currently the lesser risk). At minimum, fix the cleanup race by removing the shared `lastCleanup` global.

### [x] DS2-C8 — Stripe webhook returns 200 on handler errors (Stripe won't retry)

- **File:** `api/stripe-payment.js`
- **Description:** If `handleCheckoutSessionCompleted()` throws, the catch block returns 200 (or relies on Express defaults). Stripe only retries on non-2xx responses. A failed payment record write is silently lost.
- **Fix:** Ensure the catch block returns `res.status(500)` so Stripe retries the webhook.

### [x] DS2-C9 — `executeSegmentQuery()` loads 10,000 rows into memory

- **File:** `api/data-proxy.js` lines ~1310–1386
- **Description:** Paginates 500 rows at a time up to 10,000, accumulates in a JS array, then filters in-memory. At 2KB/row = 20 MB per request. Multiple concurrent requests risk OOM.
- **Fix:** Move simple field filters to WHERE clause; only use in-memory filtering for engagement scoring.

### [x] DS2-C10 — `cms_audit_logs` deletable by admin (audit trail integrity)

- **File:** `settings.js`; `gdpr.js`
- **Description:** Admin can call `clearAuditLog()` to delete audit entries, destroying the evidence trail. GDPR Article 5(1)(f) requires integrity and confidentiality.
- **Fix:** Add RLS policy preventing DELETE on `cms_audit_logs`. Remove the clear button from settings UI.

### [x] DS2-C11 — No consent timestamp or lawful basis recorded on entry/registration

- **Files:** `api/entry-proxy.js`, `api/registration-proxy.js`
- **Description:** Entry submissions capture a consent checkbox but never record when, via what channel, or on what lawful basis consent was given. Cannot prove GDPR compliance.
- **Fix:** New migration `055-consent-columns.sql`. Record `consent_timestamp`, `consent_ip_address`, `lawful_basis` in `entry-proxy.js` and `registration-proxy.js`.

### [x] DS2-C12 — Stripe test vs live key not validated at startup

- **File:** `api/stripe-payment.js`
- **Description:** If `STRIPE_SECRET_KEY` is a test key (`sk_test_`) but `STRIPE_PRICE_ID` is a live price ID (or vice versa), checkout silently fails with a confusing Stripe error. No guard at startup.
- **Fix:** Add a mode-consistency check: warn if key prefix doesn't match `PRICE_ID` prefix.

### [x] DS2-C13 — No environment variable validation at API startup

- **Files:** All API handlers
- **Description:** If `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, or `RESEND_API_KEY` are unset, handlers fail with opaque "Cannot read properties of undefined" errors. No early validation.
- **Fix:** Add an `assertEnv()` helper in `api/_lib/auth.js` (or a new `_lib/env.js`) and call it at the top of each handler.

### [x] DS2-C14 — Voting page `load_entries` has no response caching (500 parallel DB queries)

- **File:** `api/voting-proxy.js`
- **Description:** Public voting page can have 500 concurrent users all requesting the same entry list. Each hits Supabase independently. No Cache-Control header, no in-memory TTL cache.
- **Fix:** Add `Cache-Control: public, max-age=60` header to `load_entries`; add 60-second in-memory cache keyed on award year.

---

## HIGH

### [x] DS2-H1 — Static assets have no cache headers (every visitor re-downloads full bundle)

- **File:** `vercel.json`
- **Description:** No `Cache-Control` header for `/dist/*` assets. Each page visit re-downloads all JS/CSS. Fingerprinted filenames make long-lived caching safe.
- **Fix:** Add cache headers for `/dist/` in `vercel.json`: `public, max-age=31536000, immutable`.

### [x] DS2-H2 — `sendDeadlineReminders` has unbounded judges query (no LIMIT)

- **File:** `api/email-automation.js` line ~462
- **Description:** `.eq('contact_type', 'judge')` with no `.limit()`. Could return thousands of rows.
- **Fix:** Add `.limit(1000)` and log a warning if truncated.

### [x] DS2-H3 — Lazy-require Anthropic SDK to reduce cold-start time

- **File:** `api/ai-vetting.js`
- **Description:** `require('./_lib/ai-vetting-proxy')` is at module level, loading the 30+ MB Anthropic SDK on every cold start — even for unrelated requests (though Vercel isolates functions, it still affects ai-vetting specifically).
- **Fix:** Move `require` inside the case handler so it only loads when needed.

### [x] DS2-H4 — No Stripe idempotency check (duplicate payment records on Stripe retry)

- **File:** `api/stripe-payment.js`
- **Description:** If Stripe retries a webhook event (because the server returned 500), `handleCheckoutSessionCompleted` could insert duplicate payment records. No `event.id` deduplication.
- **Fix:** Insert `stripe_event_id` into a `stripe_events_processed` table and skip if already seen.

### [x] DS2-H5 — GDPR third-party data sharing not disclosed to users

- **Files:** `submit-entry.html`, `register.html`, `nominate.html`
- **Description:** Personal data is sent to Resend, Stripe, Supabase, and Anthropic without disclosure in privacy notices. UK GDPR requires transparent disclosure of all processors.
- **Fix:** Create `privacy-policy.html` with processor list and link from all public forms.

### [x] DS2-H6 — GDPR breach response not documented

- **Description:** No documented incident response procedure for GDPR Article 33 (72-hour ICO notification). No code to log breach details.
- **Fix:** Create `GDPR-BREACH-RESPONSE.md` with 72-hour checklist, ICO contact, and breach log table schema.

### [x] DS2-H7 — Voting trigger lock contention at 500 concurrent voters

- **File:** `database-voting-system-setup.sql`
- **Description:** Each `INSERT INTO public_votes` triggers an `UPDATE award_assignments SET public_vote_count = public_vote_count + 1` on the same row. 500 concurrent votes for one entry → 500 serialized row-lock updates.
- **Fix:** Document the limitation; for scale, use a vote aggregation table with periodic flush.

### [x] DS2-H8 — Silent catch blocks hide real errors

- **Files:** `api/entry-proxy.js`, `api/data-proxy.js`
- **Description:** Several catch blocks `console.error(e)` and then return a success-looking response or continue execution. Real errors (DB down, constraint violations) are invisible to callers.
- **Fix:** Audit all catch blocks; ensure errors propagate as 4xx/5xx responses.

### [x] DS2-H9 — Resend bounce/complaint events not handled (no suppression list)

- **Description:** Sending email to an address that has previously bounced or complained is an email deliverability violation. No Resend webhook handler for bounce/complaint events; no suppression list.
- **Fix:** Add `bounce` and `complaint` actions to `email-automation.js`; create `email_suppressions` table; check before sending.

### [x] DS2-H10 — No retry logic for Resend API calls

- **File:** `api/resend-email.js`, `api/email-automation.js`
- **Description:** Resend API calls have no retry on transient failures (429 rate limit, 502/503). A single network hiccup silently drops an email.
- **Fix:** Add exponential-backoff retry (max 3 attempts) around Resend `send()` calls.

### [x] DS2-H11 — Open redirect risk on Stripe checkout success URL

- **File:** `api/stripe-payment.js`
- **Description:** If `success_url` is constructed from user-supplied data without validation, an attacker could redirect to a phishing site after payment.
- **Fix:** Validate that `success_url` and `cancel_url` start with `process.env.APP_URL` before passing to Stripe.

### [x] DS2-H12 — Winners consent (image/name publication) not audited

- **File:** `winners.js`, `database-schema.sql`
- **Description:** `winners.gdpr_consent` is a boolean with no timestamp, method, or scope. Toggling consent leaves no audit trail. Publishing winner images without a timestamped consent record is a GDPR risk.
- **Fix:** Add `consent_timestamp`, `consent_method` columns; log consent changes to `cms_audit_logs`.

### [x] DS2-H13 — Missing privacy notice on public-facing forms

- **Files:** `submit-entry.html`, `register.html`
- **Description:** Consent checkbox text is minimal ("I consent to being contacted"). No disclosure of: data storage, retention period, right to erasure, right to access, or DPO contact.
- **Fix:** Expand checkbox label; add "Your Rights" paragraph linking to privacy policy.

### [x] DS2-H14 — `checkout.session.expired` event not handled

- **File:** `api/stripe-payment.js`
- **Description:** When a Stripe session expires (30-minute window), no cleanup is performed. Invoice may remain in `pending` state indefinitely.
- **Fix:** Handle `checkout.session.expired` webhook to mark invoice as expired/cancelled.

### [x] DS2-H15 — No automated data retention cleanup (GDPR Article 5(1)(e))

- **Files:** `gdpr.js`, `api/_lib/automation-scheduler.js`
- **Description:** `runRetentionCleanup()` only cleans audit logs (>2 yr) and email logs (>1 yr). No cleanup for `entries`, `event_guests`, `public_votes`. No scheduler job runs it automatically.
- **Fix:** Add retention periods for all personal-data tables; wire `runRetentionCleanup()` into the automation scheduler.

### [x] DS2-H16 — `public_votes.voted_at` has no index (rate-limit check is full table scan)

- **File:** `database-voting-system-setup.sql`
- **Description:** Rate limiting queries `WHERE voted_at > NOW() - INTERVAL '1 hour'` but no index on `voted_at`.
- **Fix:** Included in DS2-C3 migration.

### [x] DS2-H17 — judge-automation N+1 deadline reminder loop (200+ queries)

- **File:** `api/email-automation.js` lines 464–502
- **Description:** Covered by DS2-C6.
- **Fix:** Same as DS2-C6.

### [x] DS2-H18 — No `checkout.session.expired` handler

- **Description:** Duplicate of DS2-H14.

---

## MEDIUM

### [x] DS2-M1 — Multiple `.select('*')` queries fetch all columns unnecessarily

- **Files:** `api/judge-automation.js:58`, `api/email-automation.js:262`, `api/data-proxy.js:752`
- **Description:** Fetching all columns (including large TEXT fields like `entry_description`) when only a few are needed wastes network bandwidth.
- **Fix:** Replace `select('*')` with explicit column lists in hot code paths.

### [x] DS2-M2 — No HTTP cache headers for public voting page entry list

- **File:** `api/voting-proxy.js`
- **Description:** Covered by DS2-C14.

### [x] DS2-M3 — `organisations.county_city` lacks index (segment query filters in memory)

- **File:** `api/data-proxy.js:~1299`
- **Description:** Segment query logic loads 10K rows and filters in JS. Index on `county_city` and `status, sector` would enable DB-level filtering.
- **Fix:** Included in DS2-C3 migration.

### [x] DS2-M4 — Branding cache has no promise-coalescing (duplicate queries on surge)

- **File:** `api/email-automation.js` lines 28–51
- **Description:** If two requests arrive for the same tenant before the cache is populated, both issue a DB query. Add promise-coalescing.
- **Fix:** Store promise in cache map; return same promise for concurrent callers.

### [x] DS2-M5 — Composite indexes missing for common multi-column filters

- **Description:** `judge_scores(judge_email, is_complete)`, `entries(status, is_public, allow_public_voting)`, `award_years(is_active, judging_end_date)`.
- **Fix:** Included in DS2-C3 migration.

### [x] DS2-M6 — No cookie consent banner on public forms

- **Files:** `submit-entry.html`, `vote.html`, `register.html`
- **Description:** UK PECR requires consent before setting non-essential cookies. No banner exists.
- **Fix:** Add minimal cookie notice; ensure no analytics loaded before consent.

### [x] DS2-M7 — Phone number required on entry form (data minimisation)

- **File:** `submit-entry.html`, `api/entry-proxy.js`
- **Description:** `contact_phone` is marked `required` on the form. For a B2B awards system, email + name may suffice. Unnecessary collection widens GDPR exposure.
- **Fix:** Make phone optional; update entry-proxy to treat it as nullable.

### [x] DS2-M8 — No preconnect hints for CDN resources (render-blocking fonts/icons)

- **File:** `index.html`
- **Description:** No `<link rel="preconnect">` for `cdn.jsdelivr.net`, `fonts.googleapis.com`. Bootstrap Icons CSS is render-blocking.
- **Fix:** Add preconnect hints; load Bootstrap Icons as `media="print" onload="this.media='all'"`.

### [x] DS2-M9 — Data portability (Article 20) only for admins, not self-service

- **File:** `gdpr.js`
- **Description:** Data export requires admin access. Data subjects cannot self-serve an export of their own submission data.
- **Fix:** Create a self-service export endpoint (add action to `entry-proxy.js` keyed by email + entry number).

### [x] DS2-M10 — No chunk size validation in build script

- **File:** `build.js`
- **Description:** Build doesn't warn if a lazy chunk exceeds 100KB. A large chunk negates the lazy-loading benefit.
- **Fix:** After build, check file sizes and warn if any chunk > 100KB.

### [ ] DS2-M11 — JPEG logos used without WebP fallback or responsive sizes (deferred — requires image conversion tooling)

- **File:** `public-voting.html`, `index.html`
- **Description:** `BTA-LOGO-entry.jpg` has no `srcset`, no WebP alternative, no `loading="lazy"`.
- **Fix:** Convert to WebP via build step; add `<picture>` element with WebP/JPG fallback.

### [x] DS2-M12 — Supabase client has no timeout configuration

- **Files:** All API files
- **Description:** Slow queries hold connections for Vercel's full 30-second timeout. No AbortSignal timeout set.
- **Fix:** Add `fetch` override with `AbortSignal.timeout(15000)` to Supabase client options.

### [x] DS2-M13 — `cms_audit_logs` `updated_at` omission not documented

- **File:** `database-multiuser-tables-setup.sql`
- **Description:** Already fixed with a comment in DB audit; confirming complete.
- **Fix:** Already done (marked here for completeness).

### [x] DS2-M14 — Age check missing for "Apprentice of the Year" category

- **File:** `nominate.js`
- **Description:** This category may involve under-18 nominees. No age-gate or parental consent mechanism.
- **Fix:** Add notice to nomination form for under-18 nominees.

### [x] DS2-M15 — `refund.created` Stripe event not handled (charge.refunded handler verified present)

- **File:** `api/stripe-payment.js`
- **Description:** Stripe can issue refunds. When `refund.created` fires, the payment record should be updated to reflect the refund amount. Currently unhandled.
- **Fix:** Add `charge.refunded` handler updating `payments` record.

### [x] DS2-M16 — Dev email intercept guard missing

- **File:** `api/resend-email.js`, `api/email-automation.js`
- **Description:** In non-production environments, emails send to real recipient addresses. No guard to redirect to a `DEV_EMAIL` address.
- **Fix:** If `NODE_ENV !== 'production'` and `DEV_EMAIL` is set, override recipient.

---

## LOW

### [x] DS2-L1 — Bootstrap Icons loaded as render-blocking stylesheet

- **File:** `index.html`
- **Description:** Covered by DS2-M8. Fixed: non-blocking media trick applied.

### [x] DS2-L2 — No chunk size guard in build script

- **Description:** Covered by DS2-M10. Fixed: warns if chunk >150KB.

### [x] DS2-L3 — Connection timeout not set on Supabase client

- **Description:** Covered by DS2-M12. Fixed: AbortSignal.timeout(15000) in supabase-client.js.

### [ ] DS2-L4 — Nominee upload holds full 50K-row array in memory before chunking

- **File:** `api/data-proxy.js` lines ~1254–1276
- **Description:** CSV upload accumulates all rows in memory before slicing into chunks. For 50,000 rows at ~500B each = 25 MB peak.
- **Fix:** Process CSV in streaming chunks. (Deferred — low frequency operation, acceptable at current scale.)

### [x] DS2-L5 — `award_assignments` count aggregation in join can be slow

- **File:** `api/data-proxy.js:1316`
- **Description:** Minor performance issue on tables with thousands of assignments. Acceptable at current scale.

### [x] DS2-L6 — No `font-display: swap` for Google Fonts

- **File:** `index.html`
- **Description:** Already present on all public pages that use Google Fonts (`?display=swap`). index.html does not load Google Fonts.

### [x] DS2-L7 — Children's data: no age confirmation for Apprentice category

- **Description:** Covered by DS2-M14. Fixed: age notice added to nominate.html.

### [x] DS2-L8 — Branding cache has no version-based invalidation

- **Description:** Covered by DS2-M4. Fixed: promise-coalescing + 5-min TTL.

---

## How to work through this list

1. Read each item in order (DS2-C1 → DS2-C2 → … → DS2-L8)
2. Apply the fix
3. Run `npm test` to confirm no regressions
4. Mark the item `[x]` in this file in the same commit as the fix
5. Push to `claude/continue-cms-build-gknZa`
