# British Trade Awards CMS — Version 1.0 Release Report

Prepared as the final technical sign-off before production launch, following multiple rounds of migration testing, functional QA, and a release-candidate audit.

---

## 1. Executive Summary

The CMS now covers the full lifecycle of running the British Trade Awards without developer intervention: creating award categories, managing the master list of counties/cities/boroughs, importing nominees via a single validated CSV pipeline, managing organisations, judges, sponsors and winners, publishing marketing content and media, and — as of this release — managing the CMS's own users and roles. Three genuinely critical, previously-undiscovered defects were found and fixed during this final audit pass (Judge Portal completely non-functional, the CMS unusable on mobile/tablet, and no way to onboard a new team member without direct database access). All are now fixed and verified live. The platform is **ready with minor improvements** — see Section 9.

---

## 2. Features

**Core award management**
- Awards: full CRUD, cascading Country → Area → Sector selection, duplicate prevention, season/date scheduling, previous-year results, clone-to-year, audit log.
- Award Areas: permanent master list of every UK county, city, and London borough; single CSV import pipeline for nominees with server-side validation, duplicate handling (skip/update/replace), and instant publish.
- Entries: review workflow with a validated status state machine (Draft → Submitted → Under Review → Shortlisted → Winner/Rejected), inline status changes with confirmation on irreversible transitions.
- Winners: separate publishing pipeline (Pending → Notified → Pack Sent → Confirmed → Published) with GDPR consent tracking, manual add, bulk CSV, or promotion from judging.

**People & organisations**
- Organisations: full CRUD, search/filter, soft-archive (never a hard delete), bulk contact-list CSV import (distinct from nominee import, now clearly labeled).
- Judges: dedicated Judge Portal with blind scoring, assignment automation, AI-assisted vetting.
- Sponsors: tiers, logos, enquiry tracking.
- **Users** (new this release): Super-Admin-only invite/role-change/disable/reactivate/password-reset, built on Supabase Auth's native Admin API — no separate authentication system.

**Marketing & content**
- Email: drag-drop builder, lists, templates, campaigns via Resend.
- Marketing: banners, sponsor management, press releases, social media scheduling (Twitter, LinkedIn, Facebook, Instagram).
- Media Gallery: upload, organise, publish/unpublish.

**Operations**
- Events: registration, QR check-in, seating, running order, attendee tracking.
- Payments: invoicing, manual payment recording, Stripe checkout and webhooks.
- CRM: communications, deals, meetings, segmentation.
- Reports: dashboards and financial reporting.

**Public website**
- Nine-plus standalone public pages (home, submit-entry, public-voting, public-winners, register, judge-login/portal, company-profile, check-in, payment success/cancelled) all reading live from the same tables the CMS writes to — no hard-coded content.

---

## 3. Architecture

**Frontend**: vanilla JavaScript + Bootstrap 5, single-page admin app assembled from `src/partials/*.html` at build time (esbuild bundles ~40 JS modules into a core bundle plus 5 lazy-loaded chunks). Standalone public pages are separate, unbundled HTML files sharing `config.js` for Supabase configuration.

**Backend**: Vercel serverless functions in `/api/`, capped at 12 functions (Vercel Hobby plan limit) — new functionality is added as operations inside existing handlers (`data-proxy.js` is the main one) rather than new files, exactly as done for Award Areas import and User Management this release.

**Database**: Supabase (PostgreSQL), accessed two ways — the CMS admin routes all writes through `/api/data-proxy.js` (service-role key, server-side RBAC + tenant scoping), while public pages read through purpose-built proxies (`voting-proxy.js`, `entry-proxy.js`, `registration-proxy.js`) that don't require browser-side Supabase credentials at all. A small number of pages that need direct browser-side Supabase Auth (Judge Portal, Judge Login) get real credentials injected into their `<meta>` tags at build time — this was broken for every page except `index.html` until this release; now fixed for all of them.

**Multi-tenancy**: `tenant_id` columns on 20 tables, enforced server-side; single-tenant in practice today, architected to support more without a schema change.

---

## 4. Database

72 numbered migrations (`migrations/000`–`074`) plus a set of legacy root `database-*.sql` files, documented run order in `MIGRATION_ORDER.md`. Key milestones from this project's migration history:
- `000`: core schema including `award_years` (referenced by 20+ foreign keys elsewhere).
- `016`: multi-tenancy (`tenants`, `tenant_id` on 4 core tables).
- `047`, `067`: the permanent counties/cities/boroughs master list (`areas`, `regions`) — 105 seeded areas.
- `069`: fixed a critical stale-view bug where the `awards` view hadn't picked up ~15 columns added to `award_years` since it was created, silently breaking award creation/editing.
- `070`–`073`: systemic fixes for missing `updated_at` columns (57 tables), missing `tenant_id` columns (16 tables), missing `entries.is_deleted`/`selected_country` (which had silently broken the public voting page entirely), and `nominee_upload_batches` schema mismatches.
- `071`, `074`: idempotent tenant_id backfill with pre-flight diagnostics (`RAISE NOTICE` reporting tenant count, orphaned-row count, and rows updated per table) — verified live with real orphaned data, confirmed zero data loss, confirmed idempotent via double-run.

All migrations are additive-only (no destructive statements), safe to run against a database with existing production data.

---

## 5. Security

- **RBAC**: 7 roles (super_admin, admin, editor, viewer, judge, marketing, finance), enforced server-side in `data-proxy.js` via `checkPermission()`/`hasMinimumRole()` — verified live by direct API calls proving a Viewer role gets a real 403, not just a hidden button.
- **Tenant isolation**: enforced server-side, verified via direct SQL comparison of scoped vs. unscoped queries.
- **XSS**: verified live with an injected `<script>`/`onerror=` payload — safely escaped, never entered the DOM as executable HTML.
- **Rate limiting**: 120 requests/minute per user, server-side, degrades gracefully (individual widget failures, not a page crash).
- **User Management**: Super-Admin-gated, built on Supabase Auth's own Admin API — no parallel authentication system, no plaintext password handling in application code.
- **Known gap**: `settingsModule.init()`'s heavy concurrent request fan-out (~9 simultaneous calls) can occasionally trigger Supabase client-side session-lock contention under heavy load; a 15-second timeout now ensures this fails visibly instead of silently hanging (fixed this release), but the underlying concurrency pattern would benefit from staggering in a future pass.

---

## 6. CMS — Module Summary

| Module | Status | Notes |
|---|---|---|
| Dashboard | ✅ | KPIs, activity feed, notifications |
| Awards | ✅ | Full CRUD verified live |
| Award Areas | ✅ | Single nominee-import pipeline, deeply tested |
| Entries | ✅ | State-machine workflow verified |
| Winners | ✅ | Publishing pipeline verified |
| Organisations | ✅ | Full CRUD + soft-archive verified; bulk-contact CSV relabeled for clarity this release |
| CRM | ✅ | Smoke-tested |
| Events | ✅ | Smoke-tested |
| Payments | ✅ | Smoke-tested; live Stripe checkout not exercised in this sandbox |
| Marketing | ✅ | Smoke-tested |
| Media Gallery | ✅ | Smoke-tested |
| Reports | ✅ | Smoke-tested |
| Settings | ✅ | 6 sub-tabs including new Users (this release) |
| Markets/Bitcoin | ❌ dead code | Unreachable, unrelated to product — recommend removal (see Section 7) |

---

## 7. Remaining Technical Debt

**Deferred, not removed this release** (diagnosed, safe to act on when convenient):
- **Markets/Bitcoin tab**: sidebar entry, tab-pane, and `btc-module.js` (~180 lines) are permanently hidden with no code path that reveals them, and embed unrelated third-party TradingView widgets. Touches 8 files; safe to remove, deferred to keep this release focused on launch blockers.
- **`sponsor-portal.js`**: has the same "top-level `ModuleRegistry.register()` before its DOMContentLoaded listener" crash pattern found and fixed in `judge-portal.js`, but is currently unreferenced by any HTML page — zero live impact today. Fix or remove before wiring it up to a real page.
- **Root `index.html`**: the pre-partials-refactor monolith, no longer used by the build (`build.js` assembles from `src/partials/` via `manifest.json`), but still present and could confuse a future contributor into editing the wrong file. Safe to delete.
- **"[Company Name Placeholder]" in 20 public page footers**: cannot fix without the real registered company name — needs your input.
- **No structured data (JSON-LD)** anywhere on the public site (Organization/Event schema) — an SEO opportunity, not a defect.
- **`company-profile.html`'s Open Graph tags are static**, not per-company — the meta tags now have `id` hooks (`ogTitle`/`ogDescription`) ready for `company-profile-app.js` to populate dynamically; the JS side isn't wired up yet.

---

## 8. Production Readiness (at scale)

Reviewed against the stated near-term load: thousands of organisations, thousands of nominees, hundreds of winners, multiple award years, multiple administrators, judges, and sponsors.

- **CSV import**: batches inserts in groups of 50, validates server-side before any write — should scale to thousands of rows without special handling, but has not been tested at that volume in this sandbox (test database currently holds dozens of records, not thousands).
- **Rate limiting** (120 req/min/user): reasonable for interactive admin use; a large CSV import or bulk operation run by a single admin session should stay well under this, but worth monitoring during your first large real import.
- **Settings tab's concurrent request fan-out**: flagged above — low risk at current scale, worth revisiting if Settings grows more sections.
- **No pagination concerns found** in the tables reviewed — Awards, Organisations, Entries all use server-side pagination already.
- **Email sending**: Supabase's built-in auth email service (used by Invite User / Reset Password) has a low default rate limit unsuitable for anything beyond light use — **before relying on User Management in production, configure a custom SMTP provider in your Supabase project's Auth settings.** This is a genuine, real operational requirement, not optional.

---

## 9. Launch Recommendation

**Ready with Minor Improvements.**

The core award/nominee/organisation/winner pipeline has now been tested end-to-end across multiple audit passes, with every discovered bug fixed and verified live rather than just logged. This release closed the last structural gap (user management) and fixed two genuinely critical defects (Judge Portal, mobile usability) that would have caused real harm on launch day.

**Before importing real data:**
1. Configure a custom SMTP provider in Supabase Auth (required for Invite User / Reset Password to work at any real volume).
2. Supply the real registered company name to fix the 20-file footer placeholder.
3. Confirm the Users tab's role list matches your actual team before inviting anyone.

Everything else identified is genuinely deferrable — documented, understood, and prioritised, but not standing between you and a safe launch.
