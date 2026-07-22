# Release Candidate Audit — 2026-07-21

This branch is being treated as the Release Candidate. This document covers all five parts of that audit: migration 075 verification, a full production-deployment review, a final on-call-mindset pass, the live Somerset customer journey, and an honest final assessment.

**Everything below was verified against real code and, wherever possible, a real database — not assumptions.** Nine genuine defects were found and fixed. All are committed and pushed to `claude/supabase-cms-setup-test-e6oiza` (commits `c03499e`, `4d9f200`, and this report). Full test suite (68/68 suites, 6474/6477 tests, 3 pre-existing skips), lint, and build are clean after every change.

---

## 1. Migration 075

Verified using a real local PostgreSQL 16 instance (not mocks) — this sandbox has `psql`/`postgresql-16` installed, which turned out to be far more rigorous than relying on the hosted Supabase test project alone.

**Result: migration 075 itself was correctly written from the start.** But verifying it required replaying the *entire* documented migration order, which surfaced pre-existing defects unrelated to 075 — all fixed:

| Finding | Severity | Fix |
|---|---|---|
| `MIGRATION_ORDER.md` documented running `database-location-restructure.sql` before the numbered migrations, but it needs the `areas` table, which only `migrations/067` creates. **A fresh install following the documented order failed outright.** | Critical | Removed the file from the recommended order; migration 067 already fully and safely supersedes it. |
| That same file's `TRUNCATE areas RESTART IDENTITY CASCADE` would cascade-wipe `award_years` and `organisations` (both FK into `areas`) if ever run against a database with real data — exactly the state after real county imports begin. | Critical | Replaced with an insert-only, `ON CONFLICT DO NOTHING` reseed. |
| `migrations/015` and `migrations/016` used `CREATE POLICY` (016 also `CREATE TRIGGER`) without a preceding `DROP ... IF EXISTS`, contradicting `MIGRATION_ORDER.md`'s explicit claim that every file is safe to re-run. | Medium | Added the missing `DROP ... IF EXISTS` guards. |
| `migrations/rename-awards-region-to-county.sql` referenced `awards.region` unconditionally; a fresh install's `award_years` table has had `county` from the start and has **never** had a `region` column, so this migration always failed on a genuinely fresh database. | High | Added the same region-exists guard its sibling migration 048 already has correctly. |

**After these fixes, verified directly and empirically:**
- A **fresh install** (`000` → `075` plus the 5 named migrations, 88 files, one uninterrupted pass) succeeds with 0 failures.
- The **real upgrade scenario** — an existing `000`–`074` database with migration 075 applied on top — succeeds, and the resulting `increment_entry_public_votes()` function was tested directly (0 → 1 → 2, real increments).
- **Idempotency**: migration 075 re-applied a second time against an already-migrated database succeeds cleanly (`CREATE OR REPLACE FUNCTION` + `NOTIFY`, no side effects).
- **No conflicts**: `increment_entry_public_votes` is defined exactly once across all migration files.
- **Appears correctly in `MIGRATION_ORDER.md`**: covered by the existing "run `migrations/001-*.sql` through the highest-numbered file" instruction — no edit needed there.

**One honest limitation carried over from the previous session**: I still could not apply migration 075 to the *actual* live Supabase test project used throughout this engagement — this sandbox has no `SUPABASE_ACCESS_TOKEN` (Management API) or direct Postgres credentials for that specific project. Everything above was proven against a faithful local replica of the same schema instead, which is why the fresh-install and upgrade-path bugs were found at all (the hosted project was already past the point where they'd bite). The live application of 075 to that one specific project remains a manual step — see the on-call risk note in §3.

---

## 2. Production Deployment Review

| Area | Finding | Fix |
|---|---|---|
| Security | `api/email-automation.js`'s Resend bounce/complaint webhook **skipped signature verification entirely** when `RESEND_WEBHOOK_SECRET` was unset, rather than refusing the request — meaning anyone could POST a fake bounce/complaint event to permanently suppress any email address (an upsert into `email_suppressions`, keyed on email). The secret was also completely undocumented, so it was very likely never configured. | Now fails closed (500) if unset. Also fixed a `crypto.timingSafeEqual` crash on a missing/malformed signature header (mismatched buffer lengths throw rather than compare). Added test coverage for all three paths. |
| Documentation | `CRON_SECRET` (required — the code explicitly refuses to run the daily judge-automation cron without it) and `RESEND_WEBHOOK_SECRET` were **entirely absent** from `CLAUDE.md`'s environment variable table, despite that table's own header note saying "always refer to this section... do not ask the user to re-check Vercel." | Added both under a verify-before-launch section, plus `BTA_LOGO_URL`/`SENTRY_DSN`/`DEV_EMAIL` (optional, all with safe fallbacks) which were also undocumented. |
| CSP | Organisations' "Fetch Logo from Website" feature (both single and bulk) probes `logo.clearbit.com`, Google's favicon service, and `icons.duckduckgo.com` via `fetch()`, then displays the result as an `<img>`. None of the three were in the CSP's `connect-src` or `img-src` — the feature always silently failed, with a **false "success" toast** (the code's own fallback logic swallows the CSP-blocked fetch errors and stores a URL that then can't render either). | Added all three domains to both CSP directives. |
| Performance | `entries.county_city` (hit by every public county page view — the exact query exercised in the Somerset rehearsal) and `organisations.company_name` (the `.ilike()` lookup on every single imported row during Award Areas import) had **no indexes at all**. Invisible at Somerset's ~500-row scale; a real sequential-scan cost once all 118 counties are imported (tens of thousands of rows). | Added migration 076: a plain index on `county_city`, and a `pg_trgm` GIN index on `company_name` (verified via `EXPLAIN` that the planner actually selects it for the exact `ILIKE` pattern the code uses). |
| Forgotten files | `assignments-modals.html` — a root-level scratch file whose content was already integrated into `src/partials/99-shell-foot.html` (with refinements), and which nothing in the codebase referenced. | Removed. |
| Stale build references | `build.js` listed `vote.js` and `judge-login.js` to copy into `dist/`, but neither exists — `vote.html` actually uses `nominee-voting.js`, and `judge-login.html`'s logic is fully inline. Harmless (the copy loop guards with `existsSync`) but misleading. | Removed both stale entries. |

> ⚠️ **Correction (2026-07, later the same week)**: the RLS finding below was verified against a local Postgres replica, not the real Supabase project — and the conclusion was wrong. Checked again against the actual live Claude TEST CMS project: `anon` and `authenticated` **did** have full `SELECT`/`INSERT`/`UPDATE`/`DELETE`/`TRUNCATE` grants on all 3 tables (Supabase's own default grants, which a bare local Postgres instance never reproduces). This was a real, live, unauthenticated write path — confirmed and then fixed via migration 077, including empirical proof (a row inserted via the service key was invisible to the anon key; a direct anon-key `POST` was rejected with a `42501` RLS violation). See `DB-SCHEMA-AUDIT-TODO.md`'s DB-C3 annotation and `PRODUCTION-DEPLOYMENT-PLAN.md` Step 2 for the full writeup and the corrected verification query — the original "table shows RLS enabled" check isn't sufficient on its own, since a leftover permissive policy can silently neutralize a restrictive one (found live on `award_assignments`/`event_guests`, not yet fixed).

**Checked and found clean, no action needed:**
- Vercel function count: exactly 12/12, matching `vercel.json` and `CLAUDE.md`'s documented limit.
- SPA catch-all rewrite present and correct.
- ~~RLS enabled on 112 of 115 tables; the 3 exceptions (`email_logs`, `judge_conflicts`, `sponsorships`) were checked empirically — no role (`anon` or `authenticated`) has any grant on them at all, so the missing RLS isn't currently exploitable. Noted as a defense-in-depth gap, not an active one.~~ **Superseded — see correction above.**
- Zero ESLint errors or warnings.
- Zero broken internal links in the actual built `dist/` output.
- All 59 admin-SPA navigation targets resolve to a real tab pane; all `data-action` module namespaces (54 checked) resolve to a real `window`-registered module.
- The `automation-scheduler.js` module (moved to `api/_lib/` to stay within the function-count limit) is still correctly wired — Vercel Cron's daily call to `judge-automation.js?action=cron-tick` requires and runs it.
- `npm audit`'s 7 flagged vulnerabilities are all in `devDependencies`-only transitive packages (eslint/jest tooling) or `esbuild`'s dev-server-only CVE (esbuild here is used solely as a build-time bundler, never a running server) — zero production exposure. Deliberately not touched, since fixing would mean an unnecessary dependency churn (one path is an explicit breaking change) for no real security benefit — reviewed, not ignored.
- The ~70 other missing FK indexes found (mostly `tenant_id` columns across many tables) are real but **currently dormant** — tenant scoping is inactive for this single-tenant deployment (`tenantId: 'default'` never triggers the scoping filter in `data-proxy.js`). Fixing 70 indexes for an inactive code path would be speculative work for a feature not yet in use; left alone deliberately, not overlooked.

---

## 3. Final Release-Candidate Audit

Asked directly: *if I were on-call for this system, what would I be embarrassed to discover tomorrow?*

Checked and clean: no hardcoded secrets, no debug/auth-bypass flags, no `TODO`/`FIXME`/`XXX` markers in any production code, error handlers never leak stack traces or internal details to clients (confirmed in both `data-proxy.js` and `voting-proxy.js` — server-side `console.error`, generic "Internal server error" to the client).

**One real, honest risk remains, and it's the same one from §1**: `CRON_SECRET` and `RESEND_WEBHOOK_SECRET` are *required* (the code now refuses to run without them), but I have no way to confirm from this sandbox whether they're actually set in the live Vercel project — I can only confirm they're now documented. If either is unset, the symptom is exactly the kind of thing that's embarrassing to discover on-call: the daily automation silently does nothing (no crash, no obvious alert — just nothing happens), or the bounce webhook returns 500 to Resend forever. **This is a "please verify in Vercel" item, not a "found and fixed" item** — I want to be precise about that distinction rather than implying it's already confirmed set.

Beyond that: **I cannot find any remaining production defects.**

---

## 4. Mock Somerset Verification — Full Customer Journey

Everything below was executed against the real, shipped code and the real live Supabase test project (not mocks), continuing from the prior rehearsal's already-imported 485 Somerset entries.

**Administrator journey:**
- Import workbook — already verified in the prior rehearsal (485/485 rows, real chunked import path).
- View organisations / entries / awards / reports — already verified (105 orgs, 490 entries, 51 categories, all counts reconciling).
- **Add Winner** — verified fresh this session: inserted a real winner row for a real imported Somerset entry (Mendip Solutions Ltd) via the exact `winners.js` `saveAddWinner()` code path. Correctly created with `is_published: false`.
- **Publish Winner** — verified fresh this session: the exact `winner-announcements.js` `publishToWebsite()` code path (embargo check, then `is_published: true` + `published_at`). Confirmed absent from the public feed before publishing, present after.

**Public visitor journey:**
- Browse Somerset / categories / nominees — already verified (`load_entries` filtered by city and by category, correct results).
- **Vote** — already verified this session: full round-trip (`check_existing_vote` → `submit_vote` → duplicate correctly rejected 409 → `check_rate_limit` reflects it) after fixing the `voted_at`/`created_at` bug.
- **Confirm vote counts increase** — verified the underlying fix is correct (proven on the local Postgres replica: a real vote submission incremented `entries.public_votes` from 0 → 1 → 2). **Not yet verified on the live Supabase test project itself**, since migration 075 hasn't been applied there — same credential gap as §1. The code degrades safely in the meantime (votes still record; the counter just doesn't increment until the migration runs).
- **View published winners** — verified fresh this session: after publishing, the winner appeared correctly via the real `load_winners` public API, correctly grouped under its category ("Brickwork & Masonry Company"), with organisation name and logo joined correctly.

Test winner data was created, verified, and cleaned up — Somerset's live test data is back to its pre-check state (105 orgs / 490 entries / 51 categories).

**The journey behaves exactly as expected**, with the one clearly-flagged exception of live vote-count verification pending migration 075's application.

---

## 5. Final Honesty Check

**Would I deploy this myself?**
Yes, once `CRON_SECRET` and `RESEND_WEBHOOK_SECRET` are confirmed set in Vercel and migration 075 (now proven correct two different ways) is run against the live project. Both are quick, well-defined, low-risk actions — not open questions about whether the system works. Everything I could verify end-to-end without those two items, I did, against real code and mostly against a real database, and it held up. The defects this pass found weren't superficial — a fresh install literally couldn't complete before the migration-order fix, and the webhook fail-open was a genuine unauthenticated write path — but all of them are now fixed, tested, and verified, not just patched and hoped.

**Would I import all 118 counties?**
Yes. The Award Areas import pipeline itself needed no changes this pass — every finding here was in the surrounding production surface (deployment config, migrations, security, indexes), not the import logic, which has now been rehearsed twice end-to-end with real data. The two new indexes specifically address the concern of "what happens once this isn't just Somerset" — I didn't wait for county #50 to find out the county-filtered public page or the organisation-name lookup would degrade; I checked the query plans now.

**Would I be comfortable accepting paying customers?**
With the two Vercel-config verifications above done, yes. I'm not hedging that on anything I haven't already checked — I'm hedging it on two specific, named, already-fixed-in-code items that need a human with actual Vercel dashboard access to confirm, because I don't have that access in this sandbox.

**Is there anything I would still lose sleep over?**
One thing, honestly: I could not personally watch a real vote increment a real counter on the actual production-bound Supabase project — only on a faithful local stand-in. I'm confident in the fix because I built and tested it two independent ways (a live round-trip against the real project before 075 existed there, and a real increment test against a local replica after), but "I proved it twice, differently" is not quite the same as "I watched it happen once, for real, in the actual place it needs to work." That's a known, named gap, not a hidden one — and it closes the moment migration 075 is applied and I (or anyone) re-runs the same vote-and-check I already scripted.
