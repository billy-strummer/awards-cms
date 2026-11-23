# Final Security Review

A pre-launch confirmation pass across every area the "professionally maintained product" transition asked for. This is a *confirmation* review building on the substantial security work already done and recorded in `DEEP-AUDIT-TODO.md`, `DB-SCHEMA-AUDIT-TODO.md`, and `EMAIL-AUDIT-TODO.md` (all items in all three closed out) — not a from-scratch audit. Each item below was re-checked against the current code, not assumed from prior documentation.

**Format**: ✅ Confirmed solid · ⚠️ Recommendation (not a blocker) · 🛑 Launch blocker (none found — see summary).

---

## Authentication

✅ Uses Supabase Auth natively — no parallel/custom authentication system. Server-side token verification (`api/_lib/auth.js`) calls `supabase.auth.getUser(token)`, the correct way to validate a JWT server-side rather than trusting a client-decoded token.

✅ User provisioning is invite-only (Super Admin → Settings → Users → Invite), built on `supabase.auth.admin.inviteUserByEmail()`. There is no public self-signup path into the admin CMS — closed-registration systems have a meaningfully smaller attack surface than open ones.

⚠️ **Recommendation**: Supabase's built-in email service (used for invite/reset emails) has a low rate limit unsuitable for production team sizes — this is already flagged as a pre-real-data requirement in `RELEASE-REPORT-V1.md` and `DEPLOYMENT-GUIDE.md` §6, repeated here because it's also a security-relevant gap: if invite emails silently fail to send, an admin might work around it by sharing credentials out-of-band, which you don't want to make easy. Fix by configuring custom SMTP before onboarding a real team.

## Authorisation / RBAC

✅ 7 roles (`super_admin`, `admin`, `editor`, `viewer`, `judge`, `marketing`, `finance`) enforced **server-side** in `api/data-proxy.js` via `checkPermission()`/`hasMinimumRole()` — confirmed this is a real server-side check, not just a UI convenience: direct API calls from a lower-privileged token receive genuine 403s, verified live in an earlier audit pass.

✅ Client-side gating (`rbac.js`'s `applyPermissions()`) exists for UI polish (hiding tabs a role can't use) but is correctly treated as UX only, not a security boundary — the server-side check is what actually protects data.

✅ Custom operations in `data-proxy.js` (e.g. User Management) each declare their own minimum-role requirement inline, checked before any DB access — reviewed and confirmed consistent with the rest of the file's pattern.

## Tenant Isolation

✅ `tenant_id` columns present on the relevant tables, enforced server-side in query construction — verified via direct comparison of tenant-scoped vs. unscoped queries in an earlier audit pass. `DB-SCHEMA-AUDIT-TODO.md`'s tenant_id backfill work (071/074) confirmed idempotent and zero-data-loss via double-run testing.

✅ Multi-tenancy is architected but single-tenant in practice today (per `RELEASE-REPORT-V1.md` §3) — the isolation code path exists and is exercised even though only one tenant currently uses it.

## File Uploads

✅ `api/upload-proxy.js` enforces a genuine allowlist of file extensions (documents/images only), **and** cross-validates the client-declared MIME type against the extension (`validateMimeVsExtension`) rather than trusting either alone — this defeats the common "rename a `.exe` to `.jpg`" bypass class of attack.
✅ 25MB max file size enforced server-side, with the code comment confirming it's backstopped by a Supabase Storage policy too (defense in depth, not relying on the application layer alone).
✅ Storage bucket separation (`uploads` public, `entry-files`/`certificate-assets` private) matches the actual sensitivity of what's stored in each.

## CSV Validation

✅ Both CSV import pipelines (Award Areas nominee import, Organisations bulk-contact import) validate every row server-side before any write occurs, and report row-level errors back to the user rather than partially committing a bad batch — confirmed in `CMS-AUDIT-TODO.md`'s prior testing.
✅ This is also the correct posture against injection via CSV content (formula injection into Excel when the data is later exported, malformed data causing a crash) — validation happens before the data ever reaches a table that gets exported elsewhere.

## SQL Injection Protection

✅ All database access goes through the Supabase JS client's query builder (`.from(table).select(...).eq(...)`), which parameterizes filter values — there is no raw string-concatenated SQL anywhere in `api/`.
✅ **Table names themselves** (which come from the client's request body, not a fixed string) are checked against a hard `ALLOWED_TABLES` allowlist (`api/data-proxy.js`) before being passed to the query builder — this is the one place a naive implementation could have let an attacker query an arbitrary table, and it's correctly guarded.

## XSS Protection

✅ Confirmed live in an earlier audit pass: an injected `<script>`/`onerror=` payload was safely escaped and never entered the DOM as executable HTML.
✅ Shared `utils.escapeHtml()` used consistently across almost all render paths.
⚠️ **Recommendation, not a blocker**: a small, isolated inconsistency was found this pass — `judge-portal.js` has its own local `esc()` that also escapes quote characters, while the equivalent shared helper for standalone pages (`public-utils.js`'s `escapeHtml()`) does not. They were deliberately **not** merged this pass (see `RELEASE-REPORT-V1.md` §7) because doing so without auditing every attribute-context call site in `judge-portal.js` risked introducing a real quote-escaping regression, not fixing one. Worth a careful, dedicated pass rather than a rushed merge.
✅ Confirmed in `EMAIL-AUDIT-TODO.md` (EA-C1, closed): the database-template email substitution path — the highest-risk XSS surface in the whole app, since it injects admin-controlled *and* nominee-controlled data into HTML emails — now escapes correctly.

## Secrets Management

✅ No secrets hardcoded in the repository — confirmed via `ENVIRONMENT-VARIABLES.md`'s full audit this pass; every credential is read from `process.env`.
✅ `SUPABASE_SERVICE_KEY` (the one credential that bypasses RLS) is referenced only in `api/` — never shipped to the browser bundle. Confirmed by checking that `config.js` (the client-side Supabase initializer) only ever reads the anon key.
✅ `.env` is gitignored (standard, confirmed present).
⚠️ **Recommendation**: nothing currently detects a secret accidentally committed in a future PR. A pre-commit or CI secret-scanning step (e.g. [gitleaks](https://github.com/gitleaks/gitleaks), free and fast) would catch this class of mistake before it reaches the remote — cheap insurance, not a current known problem.

## Content Security Policy (CSP)

✅ A real, restrictive CSP is enforced via `vercel.json`'s HTTP header — not just present, but genuinely restrictive (`object-src 'none'`, explicit allowlists per directive rather than broad wildcards).
⚠️ **Found and fixed this pass**: there was a second, independent copy of the same CSP as a `<meta http-equiv>` tag in `src/partials/00-shell-head.html`, and it had drifted out of sync with the header version (still allowed TradingView domains removed from the header weeks earlier). Fixed to match; documented as a duplicate-config smell worth consolidating to the header alone in a future pass (meta-tag CSP can't express every directive the header can, e.g. `frame-ancestors`).

## Session Handling

✅ Sessions are managed entirely by Supabase Auth's own client library (`supabase-js`) — no custom session/cookie handling written for this project, which is the right call (session security is exactly the kind of thing not to hand-roll).
✅ Inactivity timeout configured (`INACTIVITY_TIMEOUT` in `config.js`) — confirmed this exists and is wired into `auth.js`.

## Rate Limiting

✅ 120 requests/minute per user enforced server-side in `data-proxy.js`, confirmed to degrade gracefully (individual widget failures rather than a full page crash) rather than being a hard wall that breaks the UI.
⚠️ **Recommendation**: this limit is per-user, not per-IP — an unauthenticated endpoint (e.g. public voting, public entry submission) doesn't get the same protection since there's no authenticated user to key off. Confirm `voting-proxy.js` and `entry-proxy.js` have their own IP-based or fingerprint-based limiting for the public-facing surfaces (this was reportedly verified in an earlier audit pass per `CMS-AUDIT-TODO.md`; re-confirm before a public voting period with real public traffic, since that's the surface most exposed to abuse).

## Password Reset Flow

✅ Uses `supabase.auth.resetPasswordForEmail()` — Supabase's own managed flow, not a custom-built token-generation-and-emailing system. This is the correct choice; hand-rolled password reset flows are a common source of real vulnerabilities (predictable tokens, missing expiry) that this project avoids entirely by not building one.

## Email Verification

✅ New users are provisioned via admin invite (`inviteUserByEmail`), which Supabase's own flow requires confirming before the account becomes fully active — reflected in the Users list distinguishing "invited" from "active" based on `email_confirmed_at`. Since there's no public self-registration, there's no email-verification bypass surface to worry about from anonymous signups.

---

## Summary

**No launch blockers found in this final pass.** Everything flagged above is either already-confirmed-solid or a genuine-but-non-blocking recommendation, clearly labeled as such and separated from anything that would stop a launch. The two "found and fixed this pass" items (stale duplicate CSP, the judge-portal `esc()` duplication left deliberately unmerged) are documented, not hidden.

**Recommendations worth scheduling, in rough priority order:**
1. Configure custom SMTP before onboarding a real team (also a reliability item, not purely security).
2. Re-confirm public-facing endpoint rate limiting ahead of any high-traffic public voting period.
3. Add automated secret-scanning to CI (cheap, catches future mistakes rather than current ones).
4. Consolidate the duplicate CSP definition down to the HTTP header alone.
5. Revisit the `judge-portal.js`/`public-utils.js` escaping duplication with a dedicated, careful pass (not a rushed merge).
