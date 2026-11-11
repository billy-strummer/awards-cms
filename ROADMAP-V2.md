# Version 2 Roadmap

Nothing in this document is implemented. It's a prioritized idea list for after v1.0 ships, drawn from real gaps found during this project's audits (referenced inline) rather than speculative feature brainstorming. Effort is a rough order-of-magnitude estimate for one experienced developer; benefit is who it helps and how much.

---

## Quick Wins
_Small effort, clear, immediate value. Good first PRs for whoever picks this project up._

| Item | Effort | Benefit |
|---|---|---|
| ~~Wire up `automation-scheduler.js` via Vercel Cron~~ — **done**, see `RELEASE-REPORT-V1.md` §11 and `DEPLOYMENT-GUIDE.md` §11. | — | — |
| **Fix the Resend webhook to read event `type` from the payload** instead of trusting a static URL parameter (see `RELEASE-REPORT-V1.md` §7). | Small (1–2 hrs) | Medium — correctness fix for bounce/complaint tracking |
| **Rewrite the Organisations "Counties/Cities/Regions" panel to read live from the `areas` table** instead of a static 100-entry HTML accordion that can drift from the real 118-row list (flagged this pass, deliberately deferred — see `RELEASE-REPORT-V1.md` §7). Pattern already proven in `nominee-uploads.js`. | Small–Medium (3–5 hrs) | Medium — removes a data-consistency footgun |
| **Add an empty state to CRM > Communications** when there are zero logged communications, matching the pattern already used elsewhere (Media Gallery's "No media yet"). | Tiny (<1 hr) | Low–Medium — polish, consistency |
| **Add `gitleaks` (or similar) to CI** to catch accidentally-committed secrets before merge. | Tiny (<1 hr) | Medium — cheap insurance against a real, high-severity mistake class |
| **Decide the fate of `sponsor-portal.js`**: it has the same top-level `ModuleRegistry.register()` crash pattern already fixed in `judge-portal.js`, but is unreferenced by any page. Either wire it to a real page (with the same fix applied) or delete it. | Small (1–2 hrs either way) | Low — currently zero live impact, but confusing for a future contributor |

---

## Nice-to-Have Improvements
_Real value, not urgent._

| Item | Effort | Benefit |
|---|---|---|
| **Consolidate the duplicate CSP** (HTTP header in `vercel.json` + `<meta http-equiv>` in `00-shell-head.html`) down to the header alone. | Small (1–2 hrs, careful testing) | Medium — removes a maintenance trap that already caused one real drift this pass |
| **Move `STRIPE_PUBLISHABLE_KEY` from per-browser `localStorage` to a shared, server-driven Settings value.** Not broken today, but per-browser storage means every admin's browser needs it set separately, and it's lost on cleared browser data. | Medium (4–8 hrs — needs a small DB table + Settings UI + read path) | Medium — operational convenience, one less thing to explain to a new admin |
| **Reconcile `judge-portal.js`'s `esc()` with `public-utils.js`'s `escapeHtml()`.** Deliberately left unmerged this pass because they're not behaviorally identical (quote-escaping differs) — needs a careful audit of every attribute-context call site in `judge-portal.js` before merging safely. | Medium (4–6 hrs, mostly careful review) | Low — code quality, removes one genuine duplication |
| **Structured data (JSON-LD)** on public pages (Organization/Event schema) for richer search results. | Small–Medium (1 day) | Low–Medium — SEO |
| **Wire up `company-profile.html`'s per-company Open Graph tags** — the `id` hooks (`ogTitle`/`ogDescription`) already exist, `company-profile-app.js` just needs to populate them. | Small (2–3 hrs) | Low–Medium — better link previews when a company profile is shared |

---

## Scalability Improvements
_Relevant once the stated "thousands of entries/organisations" scale is real, not before._

| Item | Effort | Benefit |
|---|---|---|
| **Load-test CSV import at real volume** (thousands of rows, not the dozens currently in the test database) — the batching design (groups of 50, server-validated) should hold up, but hasn't been proven at scale. | Medium (1–2 days, needs synthetic data + monitoring) | High — confidence before the first real large import, not after it fails |
| **Split the 4 oversized lazy-loaded JS chunks** (events 517KB, email 316KB, crm 260KB, media 249KB — all flagged `>150KB` by the build's own warning) into smaller sub-chunks. | Medium (1–2 days per chunk, needs careful dependency mapping) | Medium — faster first-load of those tabs, more noticeable as the codebase grows further |
| **External Supabase Storage bucket sync** to a secondary location (S3/GCS), closing the gap flagged in `DISASTER-RECOVERY.md` §2 where uploaded files (logos, entry attachments, certificates) have no recovery path if Storage itself is compromised. | Medium (1–2 days — scripting + scheduling, blocked on the Cron fix above to actually run on a schedule) | High for disaster-recovery confidence, low for day-to-day operation |
| **Structured logging** (e.g. Axiom via Vercel Log Drains) once log volume outgrows what's comfortable to search in Vercel's raw log viewer. | Small (half a day to wire up) | Medium, scales with traffic |
| **Re-evaluate the settings tab's concurrent request fan-out** (~9 simultaneous calls) if Settings grows more sub-sections — flagged as low-risk at current scale in `RELEASE-REPORT-V1.md` §5, worth revisiting if that changes. | Small (a few hours to stagger the requests) | Low today, grows with Settings' size |

---

## UX Improvements
_Beyond what this pass already covered (see `RELEASE-REPORT-V1.md` §9 for what was fixed)._

| Item | Effort | Benefit |
|---|---|---|
| **Table row-action pattern consistency**: Awards/Entries use a "⋮" dropdown for row actions, Winners uses 6 individual icon buttons. Pick one pattern and apply it everywhere. | Medium (1–2 days across all tables) | Medium — a genuinely more "mature commercial product" feel, exactly the standard this pass was measured against |
| **Bulk actions parity** across all list views — audit which tables have bulk select/action and which don't, close the gaps. | Medium (varies per table) | Medium — efficiency at scale, directly relevant to the "20,000+ entries" scenario this pass was asked to consider |
| **In-app guided onboarding** beyond the existing "Getting Started" banners — a proper first-run checklist/tour for a brand-new admin with zero data. | Medium–Large (several days) | Medium — reduces training burden, aligned with this project's explicit "no training needed" goal |

---

## Performance Improvements

| Item | Effort | Benefit |
|---|---|---|
| **Address the 4 oversized JS chunks** — see Scalability section above (same item, cross-listed since it's as much a performance issue as a scale one). | (see above) | (see above) |
| **Audit for duplicate/redundant API calls** on tab switches — a lighter-weight version of the settings fan-out issue may exist elsewhere; worth a dedicated network-tab audit once there's a real usage pattern to profile against (profiling against dozens of test records, as this project currently has, won't surface much). | Medium (1–2 days, needs real usage data first) | Medium, grows with data volume |
| **Image optimization pipeline** for uploaded organisation logos/event photos (resize/compress on upload rather than storing originals at full resolution). | Medium (1–2 days) | Medium — storage cost and page load, more relevant as Media Gallery usage grows |

---

## Future Automation
_The core scheduler now runs correctly via Vercel Cron (see Quick Wins, above) — these are further automation ideas beyond that fix._

| Item | Effort | Benefit |
|---|---|---|
| **Automated year-rollover wizard** — a single guided flow for the "Archive this year, clone awards to next year" sequence currently done award-by-award (see `OPERATIONS-MANUAL.md` §10–11). | Medium–Large (several days) | Medium — meaningful time savings once a year, for the highest-stakes recurring workflow this system has |
| **Automated judge-conflict detection** beyond what exists today — cross-reference judge and nominee organisation affiliations automatically to flag likely conflicts of interest before assignment, rather than relying on manual conflict logging. | Large (design + implementation, needs real judge/org data modeling) | Medium–High — reduces a real governance risk for the awards programme itself |
| **Scheduled data-quality reports** (incomplete organisation profiles, entries stuck in one status too long, etc.) delivered via email on the now-working cron infrastructure. | Small once Cron is wired up (a few hours) | Medium — proactive rather than reactive data hygiene |

---

## AI Enhancements
_Beyond the existing AI Vetting feature._

| Item | Effort | Benefit |
|---|---|---|
| **AI-assisted entry summarization for judges** — generate a short summary of a long-form entry to help judges triage before deep-reading, using the same Anthropic integration already wired up for vetting. | Medium (2–4 days) | Medium — judge time savings at scale |
| **AI-assisted duplicate-organisation detection** during CSV import (beyond exact-match dedup) — catch "Acme Ltd" vs "Acme Limited" style near-duplicates before they pollute the CRM. | Medium (2–4 days) | Medium — data quality, directly relevant to CRM usefulness at scale |
| **AI-drafted winner announcement copy** as a starting point for the Marketing team to edit, not auto-publish. | Small–Medium (1–2 days, mostly a prompt + review-before-send UI) | Low–Medium — convenience, not a core need |

---

## Commercial Features
_Features that would make this a sellable multi-customer product, not just this one awards programme's internal tool._

| Item | Effort | Benefit |
|---|---|---|
| **Activate real multi-tenancy** — the schema and server-side scoping already exist and are exercised (per `RELEASE-REPORT-V1.md` §3) but only one tenant is in practical use. Turning this into a genuine multi-customer SaaS needs: tenant-aware billing, a tenant provisioning flow, and per-tenant branding beyond what Settings currently exposes. | Large (weeks, not days) | High — this is the difference between "our awards CMS" and "an awards CMS product," a real business decision not a technical one |
| **White-label branding** (custom domain per tenant, fully custom colour/logo/email templates beyond the existing Branding settings) — a natural extension of activating multi-tenancy above. | Large | High, but only if multi-tenancy is actually being commercialized |
| **Self-serve billing** (Stripe subscriptions for the CMS itself, not just entry-fee payments) if this becomes a multi-customer product. | Large | High, same caveat as above |
| **Public API** for programmatic access (read-only awards/winners data for embedding on a customer's own site, for instance) — a genuinely new capability, not a fix, so scope it carefully against the existing 12-function Vercel limit before committing to it. | Large | Medium — nice differentiator, meaningful engineering investment |

---

## How to use this document

This is a backlog, not a commitment. Reassess priority against real usage once v1.0 has been live for a few months — several "Nice-to-Have" items may turn out to matter more (or less) than estimated once real administrators are using the product day-to-day. The Quick Wins section is the only part worth treating as a near-term default plan; everything else should wait for evidence.
