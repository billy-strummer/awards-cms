# Security & Auth Re-Audit — 2026-05-29

## Summary

The recent changes (CSP tightening, DB-backed rate limiting, magic-byte validation, role check on stripe-payment, QR verification auth) are directionally correct and represent genuine security improvements. However, five concrete issues were found: a broken inline-script CSP that silently breaks multiple HTML pages, client-supplied ticket prices trusted by the event checkout, unescaped guest names rendered into innerHTML, dead magic-byte validation code that never runs, and a mismatched role hierarchy in stripe-payment.js. No critical authentication bypasses or SQL injection vectors were found.

---

## CRITICAL — Must fix immediately

### SA2-C1 — Inline scripts in six HTML files silently blocked by new CSP

- **File:** `vercel.json:60` (CSP `script-src` has no `unsafe-inline`), against `check-in.html:208,565`, `award-nominees.html:62,192`, `company-profile.html:206,546`, `winners-portal.html:97`, `public-winners.html:333`, `award_companies.html:58,188`
- **Impact:** The Vercel CSP (`source: "/(.*)"`) applies to every served file. Every `<script>` block without a `src=` attribute is an inline script; without `unsafe-inline` or a nonce in `script-src`, all of these are silently blocked by the browser. The check-in system, public winners page, company profile page, and award-nominees page are completely non-functional in production. The CSP was apparently added/tightened for `index.html` (which had its scripts extracted to `global-actions.js`), but the other HTML pages were not updated.
- **Fix:** Either (a) extract the inline scripts from the five affected files into separate `.js` files loaded via `src=` (same approach used for `global-actions.js`, `register-app.js`, `footer-year.js`), OR (b) generate a nonce per response and add it to both the CSP header and each `<script>` tag — but Vercel static hosting does not support dynamic headers, so option (a) is the only viable path. Do NOT re-add `unsafe-inline` — that undoes the security improvement.
- [x] Implemented

---

## HIGH — Fix before production

### SA2-H1 — Event checkout trusts client-supplied ticket prices

- **File:** `api/stripe-payment.js:963-973` (`createEventCheckout`)
- **Impact:** An authenticated editor can POST `{ eventId, tickets: [{ price: 0.01, quantity: 1 }] }` and create a valid Stripe checkout session charging £0.01 instead of the real ticket price. Because `createEventCheckout` is auth-gated (editor+), exploitation requires a compromised CMS account, but once in, an insider can undercharge any event ticket purchase by an arbitrary amount.
- **Fix:** Look up ticket types from the `event_ticket_types` table using `ticket_type_id` from each `tickets` entry, and use the DB-stored `price` instead of `t.price`. Validate that each `t.ticket_type_id` is valid and belongs to the given `eventId`. Reject requests where the client-supplied price differs from the DB price.
- [x] Implemented

### SA2-H2 — Stripe-payment.js has a divergent, incomplete role hierarchy

- **File:** `api/stripe-payment.js:32`
- **Impact:** The local `ROLE_HIERARCHY` in `stripe-payment.js` is `['viewer', 'editor', 'manager', 'admin', 'super_admin']`, which is missing `judge`, `marketing`, and `finance` roles compared to `data-proxy.js`'s authoritative hierarchy `['viewer', 'judge', 'marketing', 'finance', 'editor', 'admin', 'super_admin']`. A user with role `judge`, `marketing`, or `finance` returns `indexOf` = -1, so `hasMinimumRole` returns `false` — these users cannot initiate payment sessions even though by the canonical hierarchy `finance` should be able to. Additionally, `manager` is not a valid role in this system, so if a row in `user_roles` ever has `role = 'finance'`, the check silently denies it.
- **Fix:** Replace the local `ROLE_HIERARCHY` in `stripe-payment.js` with the canonical one from `data-proxy.js`: `['viewer', 'judge', 'marketing', 'finance', 'editor', 'admin', 'super_admin']`. Remove `manager`. Update `hasMinimumRole` accordingly.
- [x] Implemented

### SA2-H3 — Magic-byte validation in upload-proxy is dead code (never called)

- **File:** `api/upload-proxy.js:125` — `detectMimeType()` function defined but never invoked anywhere in the codebase (confirmed by `grep -rn "detectMimeType"`).
- **Impact:** The MIME magic-byte check is announced as a security control (referenced in audit notes), but the actual file bytes are never passed through it. The current validation only cross-checks the client-declared MIME string against the file extension allowlist (`validateMimeVsExtension`). A client can upload a PHP webshell renamed to `file.pdf` by declaring `Content-Type: application/pdf` — the extension check passes, the magic-byte check is never run. (Note: Supabase Storage still runs its own MIME checks as a second layer, but the upload-proxy is supposed to be the first gate.)
- **Fix:** In `handleGetUploadToken`, the file bytes are not available server-side (only the storage path is returned for a direct-to-Storage upload). The correct fix is one of: (a) require the client to POST the first 16 bytes of the file (as a hex string or base64) and call `detectMimeType` on them before issuing the signed URL, OR (b) remove the misleading `detectMimeType`/`MAGIC_SIGNATURES` code entirely and document that magic-byte validation is delegated to Supabase Storage's server-side policy. Either is acceptable; what is not acceptable is having dead code that gives a false sense of security.
- [x] Implemented

### SA2-H4 — `data-proxy.js` leaks internal Supabase error details to clients

- **File:** `api/data-proxy.js:1632-1637`
- **Impact:** On unhandled errors, the response body includes `message`, `hint`, and `details` fields verbatim from the Supabase/PostgreSQL error object. These can leak schema information (table names, column names, constraint names, RLS policy names). Example: a schema mismatch error might return `{ hint: "No function matches the given name and argument types ... for table \"user_roles\"" }`. This is visible to any authenticated user.
- **Fix:** In the catch block, log the full error server-side (already done) but return only a generic `{ error: 'Internal server error' }` to the client. Strip `hint` and `details` from the 500 response. Validation errors at line 1617 (`{ error: 'Validation failed', details: validationErrors }`) are fine since those details are user-controlled input feedback.
- [x] Implemented

---

## MEDIUM — Fix within sprint

### SA2-M1 — Guest names injected unescaped into `innerHTML` in register-app.js

- **File:** `register-app.js:250-256` (`renderOrderSummary`)
- **Impact:** User-typed guest names are collected from form inputs and joined directly into a template literal that is assigned to `element.innerHTML`. If a user types `<img src=x onerror=alert(1)>` as their name, it executes in the browser. This is a stored-then-reflected self-XSS only (the data never leaves the browser in this flow), so exploitation requires the attacker to be the victim. However, if this data is ever echoed back from the server (e.g. in the confirmation email HTML), the impact escalates. The same `escapeHtml()` function already exists in the file at line 449 and is used elsewhere (line 127) — it just wasn't applied here.
- **Fix:** Wrap each guest name with `escapeHtml()` before insertion. Change line 255 from `` `${guestNames.join(', ')}` `` to `` `${guestNames.map(escapeHtml).join(', ')}` ``. Also escape `selectedPackage.name` at line 252 in case package names ever come from DB.
- [x] Implemented

### SA2-M2 — `public-winners.html` calls `voting-proxy` `load_winners` action that does not exist

- **File:** `public-winners.html:433`, `api/voting-proxy.js:340-349` (ACTIONS dispatch table)
- **Impact:** `public-winners.html` POSTs `{ action: 'load_winners' }` to `/api/voting-proxy`. The `ACTIONS` map in `voting-proxy.js` contains `load_awards`, `load_entries`, `check_votes`, `check_rate_limit`, `check_existing_vote`, `submit_vote`, `load_entry`, `send_vote_confirmation` — but NOT `load_winners`. The handler returns `{ error: "Unknown action: load_winners" }` with status 400, so the public winners page is completely broken and shows an error state to all visitors.
- **Fix:** Either (a) add a `load_winners` handler to `voting-proxy.js` that queries the `winners` table with `is_published = true` (respecting any embargo fields), or (b) if winners data is already accessible via `data-proxy.js` with no auth, have `public-winners.html` call a different endpoint. Given that `voting-proxy.js` is the intentionally public endpoint, option (a) is cleaner.
- [x] Implemented

### SA2-M3 — registration-proxy and upload-proxy use leftmost (spoofable) IP for rate limiting

- **File:** `api/registration-proxy.js:114`, `api/upload-proxy.js:235`
- **Impact:** Both files take the IP for rate limiting via `req.headers['x-forwarded-for']` without parsing it — this gives the leftmost value, which a client can spoof by sending `X-Forwarded-For: 1.2.3.4` (a clean IP). An attacker can bypass the in-memory rate limit entirely by rotating IPs in the header. Compare with `voting-proxy.js` and `stripe-payment.js` which correctly use `.split(',').pop().trim()` (rightmost) or `.split(',')[0]` (context-dependent but documented).
- **Fix:** In `registration-proxy.js:114` and `upload-proxy.js:235`, change:
  ```js
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  ```
  to:
  ```js
  const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const ip = rawIp.split(',').pop().trim() || 'unknown';
  ```
  (Use `.pop()` / rightmost value, which Vercel's CDN adds and clients cannot forge.)
- [x] Implemented

### SA2-M4 — `ai-vetting.js` has no role check — any authenticated user can call the Claude API

- **File:** `api/ai-vetting.js:15-71`
- **Impact:** Authentication is verified (line 21-37) but no role check is applied before calling `vetCompany` or `vetCompanies`. Any authenticated user (including `viewer` and `judge` roles) can trigger Anthropic API calls, potentially running up API costs or exhausting rate limits. `ai-vetting.js` also has no CORS restriction (no `Access-Control-Allow-Origin` header, which defaults to blocking cross-origin calls — acceptable here since it's internal, but not documented as intentional).
- **Fix:** Add a minimum-role guard before the switch statement:
  ```js
  const role = await getUserRole(user.email); // add getUserRole helper or import from a shared lib
  if (!hasMinimumRole(role, 'editor')) {
    return res.status(403).json({ error: 'Insufficient permissions for AI vetting' });
  }
  ```
- [x] Implemented

### SA2-M5 — `verifyQRCode` in certificates-qr uses unvalidated `data.id` from parsed QR JSON

- **File:** `api/certificates-qr.js:583-615` (`verifyQRCode`)
- **Impact:** The function `JSON.parse`s the QR payload and immediately uses `data.id` as an attendee UUID in a Supabase query without validating that it is a valid UUID format. A malformed `id` value would produce a Supabase error rather than a security bypass (the service-role client would reject it), but it allows an unauthenticated input to reach the DB layer without sanitization. Additionally, the error response at line 626-627 returns `error.message` from the catch block — Supabase error messages can include schema details.
- **Fix:** Add UUID validation before the DB query:
  ```js
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!data.id || !uuidPattern.test(data.id)) {
    return { valid: false, message: 'Invalid QR code format' };
  }
  ```
  Replace `error: error.message` in the catch with `error: 'QR verification error'`.
- [x] Implemented

---

## LOW — Nice to have / hygiene

### SA2-L1 — `data-proxy.js` CORS allows `*` when `ALLOWED_ORIGINS` env var is not set

- **File:** `api/data-proxy.js:1494-1496`
- **Impact:** When `ALLOWED_ORIGINS` is not configured (which is the case in Vercel — it is not in the documented env vars), `corsOrigin` evaluates to `origin || '*'`. Because the endpoint requires a valid JWT, there is no unauthenticated access risk. However, `Access-Control-Allow-Origin: *` combined with `Access-Control-Allow-Headers: Authorization` is a misuse of CORS: wildcards are incompatible with credentialed requests in the browser anyway, so the effective restriction is the JWT. Low risk, but should be documented or the variable should be set.
- **Fix:** Add `ALLOWED_ORIGINS=https://admin.britishtradeawards.com` to the Vercel environment variables and document it in CLAUDE.md alongside the other env vars.
- [x] Implemented

### SA2-L2 — `upload-proxy.js` rate limit is in-memory and per-instance (not cross-instance)

- **File:** `api/upload-proxy.js:212-225`
- **Impact:** The rate limit (30 requests per minute per IP) lives in a `Map` in serverless memory. Across Vercel cold starts / multiple concurrent instances, each instance has its own fresh counter. An attacker can bypass the limit by routing requests to different function instances. The `upload-proxy` is semi-public (the `get_upload_token` and `save_file_metadata` actions are in the `publicActions` list and only require an entry number — not auth). This was pre-existing; not introduced by the recent changes.
- **Fix:** Move the upload rate limit to a DB-backed check (like entry-proxy now does) using a `rate_limit_records` table, or enforce limits in Supabase Storage policies. Medium effort — acceptable to defer.
- [x] Implemented

### SA2-L3 — `stripe-payment.js` sets `Access-Control-Allow-Origin: *` for all actions including authenticated ones

- **File:** `api/stripe-payment.js:1061`
- **Impact:** The main handler sets `Access-Control-Allow-Origin: *` before routing, which means authenticated actions (`create-checkout-session`, `event-checkout`, `refund`, `payment-status`, `verify-payment`) all respond with `*`. Browser security prevents credentialed cross-origin requests with `*`, so in practice there is no bypass. However, the webhook endpoint (`action=webhook`) also gets this header — though webhook verification is via Stripe signature so it cannot be forged.
- **Fix:** Set `Access-Control-Allow-Origin` to the specific `APP_URL` for authenticated actions, and keep `*` only for `public-checkout` and `webhook`. Or follow the `data-proxy` pattern of checking `ALLOWED_ORIGINS`.
- [x] Implemented

### SA2-L4 — OR filter in `data-proxy.js` allows unvalidated string values in the operand position

- **File:** `api/data-proxy.js:854-860`
- **Impact:** The `safeOrPattern` regex validates column names and operators but the value part `[^,]+` accepts any character sequence including SQL-special characters. Because the or-clause is passed to Supabase's `query.or()` which uses parameterised PostgREST calls under the hood, this is not a direct SQL injection vector. However, unexpected values in the operand could trigger unexpected PostgREST behavior (e.g. `column.like.*` glob patterns). Low risk given Supabase parameterisation.
- **Fix:** Optionally tighten the value part of the regex to disallow unescaped parentheses and pipe characters that PostgREST uses for OR nesting: `[^,()]+` would be a minimal change.
- [x] Implemented

---

## FALSE POSITIVES / ALREADY HANDLED

- **entry-proxy.js rate limiting**: DB-backed, email-keyed, cross-instance. Correctly implemented. Nomination submissions share the same `checkEmailRateLimit` function — both `submit_entry` and `submit_nomination` are covered.
- **certificates-qr.js auth**: `verifyAuth` is called at the top of the handler before any action dispatch (line 755). The endpoint is fully gated.
- **upload-proxy.js public actions**: `get_entry`, `get_existing_files`, `save_file_metadata`, `get_upload_token` are intentionally unauthenticated (gated only by knowing a valid entry number). This is the correct design for the public "upload your supporting documents" flow. Non-public actions require auth.
- **data-proxy.js SQL injection**: All filter values pass through the Supabase client library as parameterised queries. Column names are validated by regex (`/^[a-zA-Z_][a-zA-Z0-9_.]*(@[a-zA-Z_]+)?$/`). No string concatenation into raw SQL found.
- **voting-proxy.js CORS `*`**: Intentionally public. The endpoint handles votes, which require a valid voter email and entry UUID. Server-side rate limiting and duplicate-vote checks are present. `Access-Control-Allow-Origin: *` is correct here.
- **registration-proxy.js CORS `*`**: Intentionally public — event registration does not require authentication by design.
- **stripe-payment.js public-checkout**: Correctly uses server-side entry fee from DB (line 889), not client-supplied amount. Rate-limited at 5 requests/minute/IP using rightmost IP (line 862).
- **global-actions.js XSS**: No user-supplied data is rendered via `innerHTML`. All dynamic content uses `.textContent` or constructs safe DOM elements.
- **CSP `img-src` in vercel.json includes `api.qrserver.com`**: Correct — QR code images for the registration confirmation are loaded from this service.
- **JWT/token logging**: Tokens are not logged anywhere in any API handler. The `user.email` is logged in activity logs (appropriate).
- **Hardcoded credentials**: None found in `global-actions.js`, `register-app.js`, or `footer-year.js`.
- **`judge-automation.js` role check**: Auth-gated but no per-action role check. All four actions (assign-judges, generate-shortlist, etc.) are heavy admin operations — adding editor+ role guard would be prudent but is pre-existing behaviour, not introduced by recent changes. Out of scope for this diff-focused audit.
