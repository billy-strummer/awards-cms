# Vercel / Build / CSP Configuration Audit — 2026-05-30

## Summary

Audit of `vercel.json`, `build.js`, CSP headers, security headers, function count, and environment variable coverage. This area had never been specifically reviewed.

**Severity counts:** 2 Critical · 3 High · 2 Medium · 1 Low

---

## CRITICAL

### [ ] VC-C1 — No SPA catch-all rewrite in `vercel.json`

- **File:** `vercel.json`
- **Description:** There is no `rewrites` configuration to serve `index.html` for all non-API, non-asset paths. Without it, deep links to admin routes (e.g. `/dashboard`, `/awards`) return 404 instead of loading the SPA. Users who bookmark a specific tab or receive a direct link to an admin section will hit a dead end.
- **Suggested fix:** Add a rewrites block in `vercel.json`:
  ```json
  "rewrites": [
    { "source": "/((?!api|dist|.*\\.(js|css|png|jpg|svg|ico|woff2?|ttf)).*)", "destination": "/index.html" }
  ]
  ```
  Place it after the existing `headers` array and before any explicit `routes`.

### [ ] VC-C2 — Undocumented environment variables used in production API code

- **Files:** `api/data-proxy.js`, `api/social-media-api.js`, `api/stripe-payment.js`
- **Description:** Four env vars are referenced in production code but absent from both `CLAUDE.md` and `.env.example`:
  - `ALLOWED_ORIGINS` (`data-proxy.js`) — CORS origin allowlist; if unset, CORS may be misconfigured
  - `CONTACT_EMAIL` (`stripe-payment.js`) — fallback contact address in payment emails; if unset, emails sent with no reply-to
  - `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_TOKEN_SECRET` — listed in CLAUDE.md "not yet configured" section ✓ (these are OK)
  
  `ALLOWED_ORIGINS` and `CONTACT_EMAIL` are the two that are genuinely missing from all documentation.
- **Suggested fix:** Add both to the CLAUDE.md env var table (Configured section) and to `.env.example` with descriptions. For `CONTACT_EMAIL`, add a sensible fallback (`process.env.FROM_EMAIL || process.env.CONTACT_EMAIL`) in `stripe-payment.js` so missing the var doesn't break email delivery.

---

## HIGH

### [ ] VC-H1 — CSP missing `form-action` directive

- **File:** `vercel.json` — `Content-Security-Policy` header value
- **Description:** The CSP has no `form-action` directive. Without it, HTML forms can `POST` to any origin, bypassing the intent of the policy. An attacker who can inject a form (e.g. via a stored XSS) could exfiltrate form data to an external server.
- **Suggested fix:** Add `form-action 'self'` to the CSP value in `vercel.json`. All existing forms post to `/api/*` which is same-origin.

### [ ] VC-H2 — `'unsafe-inline'` in `style-src` weakens CSP

- **File:** `vercel.json` — `Content-Security-Policy` header, `style-src` directive
- **Description:** `style-src 'self' 'unsafe-inline' ...` allows any inline `<style>` tag or `style=` attribute anywhere in the app. This negates much of the XSS protection CSP provides for CSS injection attacks. Bootstrap and the email builder use inline styles on dynamically-generated elements, which is the likely reason for `unsafe-inline`.
- **Suggested fix:** Audit which inline styles are strictly required vs. can be moved to classes. For the email builder canvas (which dynamically applies styles), consider scoping `unsafe-inline` to only that section using a nonce, or accept this as a known trade-off and add a code comment documenting why it's needed.

### [ ] VC-H3 — No automated guard against exceeding 12-function Vercel limit

- **File:** `build.js`
- **Description:** Vercel Hobby plan allows exactly 12 serverless functions. We are at 12/12. The build script has no check for this — a developer can add a 13th `/api/*.js` file and only discover the limit when Vercel rejects the deployment. This is silent until deploy time.
- **Suggested fix:** Add a pre-build guard in `build.js`:
  ```js
  const apiFiles = fs.readdirSync('./api').filter(f => f.endsWith('.js') && !f.startsWith('_'));
  if (apiFiles.length > 12) {
    console.error(`ERROR: ${apiFiles.length} API functions exceed Vercel Hobby limit of 12`);
    process.exit(1);
  }
  ```

---

## MEDIUM

### [ ] VC-M1 — `public-winners.html` missing from build copy list

- **File:** `build.js` — `PUBLIC_PAGES` array
- **Description:** `public-winners.html` exists in the root directory and is loaded by `public-winners-app.js`, but it is not included in the `PUBLIC_PAGES` array in `build.js`. This means running `npm run build` does not copy it to `dist/`, so the production deployment is missing this public winners display page.
- **Suggested fix:** Add `'public-winners.html'` to the `PUBLIC_PAGES` array in `build.js`.

### [ ] VC-M2 — Unusual `frame-src` entries for TradingView widgets

- **File:** `vercel.json` — `Content-Security-Policy` header, `frame-src` directive
- **Description:** The CSP `frame-src` includes `s3.tradingview.com` and `*.tradingview-widget.com`. TradingView is a financial charting platform with no apparent connection to a trade awards CMS. These entries are either leftover from a copy-paste CSP template or from an abandoned feature. Each unnecessary allowlist entry expands the attack surface.
- **Suggested fix:** Search the codebase for `tradingview` references. If none are found, remove the entries from `frame-src`.

---

## LOW

### [ ] VC-L1 — ESLint failures do not halt the build

- **File:** `build.js` — ESLint step
- **Description:** The build script runs ESLint but catches its exception and only logs a warning. A file with lint errors will still be bundled and deployed. The `npm run validate` script does fail on lint errors (it runs ESLint directly), but `npm run build` alone does not — which is the command used in Vercel's build pipeline.
- **Suggested fix:** In `build.js`, remove the `try/catch` around the ESLint `execSync` call (or re-throw), so a lint failure causes a non-zero exit code and aborts the Vercel build.

---

## How to work through this list

1. Work through items VC-C1 → VC-C2 → VC-H1 → … → VC-L1 in order
2. Run `npm run build` and `npm test` after each change to confirm no regressions
3. Mark each item `[x]` in the same commit as the fix
4. Push to `claude/continue-cms-build-gknZa`
