# Awards Platform — 2030 Vision

*Written as Technical Director and Product Owner, looking five years out. This is a strategy document, not an implementation plan for V1.0 — nothing here implies V1.0 has defects. It assumes V1.0 is done, correct, and the foundation to build on.*

---

## 0. The Core Bet

British Trade Awards CMS becomes **Awards Platform** — a multi-tenant SaaS product where British Trade Awards is tenant #1, not the product. Every subsequent section serves one thesis: **the tenant boundary is the single most important architectural decision of the next five years**, and everything else — AI, automation, portals, commercial model — is only valuable once that boundary is real, not aspirational.

I'd resist the temptation to build AI features or new portals before the tenant boundary is genuinely load-bearing. A dazzling AI judging assistant built on single-tenant assumptions becomes a liability the day a second real customer signs up and their data touches the first customer's. Sequencing matters more than any individual feature here.

---

## 1. Multi-Tenant Architecture — Honest Evaluation

### What already exists, and why it's a real head start
- `tenant_id` columns exist on roughly 20 tables, added deliberately, not as an afterthought.
- The frontend never talks to Supabase directly for writes — everything routes through `/api/data-proxy.js`, which already threads a `tenantId` parameter through inserts/selects. That's the single most valuable thing already in place: **there is one chokepoint**, not forty places to retrofit tenant scoping into.
- RBAC (7 roles) is already server-side enforced, not just UI-hidden — the pattern needed for "restrict a user to one or more tenants" is a natural extension of a system that already does "restrict a user to one or more permission levels."
- Global reference data (the `areas`/`regions` master list, `award_years` structure) is already factored out as shared, tenant-independent lookup data — the right shape for multi-tenant systems, where some data is genuinely global (UK counties don't change per customer) and some is genuinely tenant-scoped (which counties a given tenant actually competes in).

### What's missing — and this is the honest part
Today, `tenant_id` is a column that *can* be stamped, not a boundary that *is* enforced. Concretely:

1. **No tenant resolution layer.** Nothing decides "which tenant is this request for" from the URL, subdomain, or session — a tenant ID is passed by the client, which means the client is trusted to say who it is. That's not multi-tenancy, that's a labeling scheme. The first real architectural task is moving tenant resolution server-side and unforgeable (derived from the authenticated user's tenant membership, never from a client-supplied parameter).
2. **RLS isn't tenant-aware yet.** Row-Level Security policies exist for other purposes (the DB schema audit found 8 tables initially missing RLS entirely), but tenant isolation needs to be enforced *at the database layer*, not just in application code — because application code has bugs, and a missing `WHERE tenant_id = ?` clause in one query is a real cross-tenant data leak, not a cosmetic issue. Postgres RLS policies keyed on tenant membership are the correct backstop; app-layer scoping alone is not sufficient for a paying multi-tenant SaaS product.
3. **Configuration is global, not per-tenant.** `.env` holds one Stripe key, one SMTP config, one Resend key, one Anthropic key, one set of social media credentials. Every one of "branding, domains, email templates, Stripe, SMTP, storage, AI configuration" the user asked about is currently a single global value, not a per-tenant row. This is the single biggest gap between "has tenant_id columns" and "is a multi-tenant SaaS."
4. **No tenant selector, no Super Platform Admin.** The UI has zero concept of "which org am I currently operating as," because there's only ever been one.
5. **The Vercel Hobby 12-function ceiling is a real constraint to solve early, not late.** Every new tenant-management surface (billing, provisioning, domain verification, per-tenant webhook handling) wants its own endpoint under the current architecture's instinct. That instinct has to change *before* multi-tenancy, not after — the existing convention of "new capability = new action inside an existing handler" needs to become the permanent law of this platform, or the team needs to move off the Hobby plan (a $20/month decision, not a technical one, but one that has to be made deliberately rather than discovered under pressure).
6. **Storage isn't tenant-partitioned.** Supabase Storage buckets today are feature-partitioned (logos, certificates, media), not tenant-partitioned. A second tenant's logo upload needs to be provably unreachable by the first tenant's service-role queries, which today would technically have access to everything.

### Direct answers to the checklist

| Question | Today | What's required |
|---|---|---|
| Can multiple orgs run from one codebase? | Architecturally yes, in practice no | Server-side tenant resolution (§1 above) |
| Completely isolated data? | Not yet — app-layer only | Tenant-aware RLS on every table, not just the API layer |
| Tenant selector in the CMS? | Doesn't exist | New UI: a switcher, backed by a `user_tenants` join table (a user can belong to N tenants with a role per tenant — RBAC already models roles, it needs a second dimension) |
| Restrict users to one or more tenants? | Not modeled | Same `user_tenants` table above — natural extension of existing RBAC, not a rewrite |
| Super Platform Admin managing all tenants? | Doesn't exist | New role, above Super Admin, scoped to the platform itself rather than any one tenant — needs its own admin surface (tenant provisioning, billing, suspension) that's deliberately separate from any single tenant's CMS |
| Per-tenant branding/logo/colours? | Single global `Settings > General` | Move from `.env`/single-row config to a `tenants` config table — mechanically simple, already partially proven by the existing branding-apply code path |
| Per-tenant domains? | Single `APP_URL` | Vercel supports multiple domains per project natively; needs a `tenants.domain` column and request-time domain→tenant resolution (this *is* the unforgeable tenant-resolution mechanism from point 1 — the domain the request arrived on, not a client parameter, decides the tenant) |
| Per-tenant email templates? | Global template set | Straightforward — templates already live in a database table; add `tenant_id`, fall back to a platform default when a tenant hasn't customized theirs |
| Per-tenant judges/sponsors/categories/areas/automation/reports/AI config/Stripe/SMTP/storage/marketing/CRM/analytics? | All currently single-tenant-shaped | Each is a variation on the same two moves: (a) tenant-scope the data (mechanical, `tenant_id` mostly already exists), (b) tenant-scope the *configuration* that drives it (the real work — credentials, not just content) |

### The migration path — preserving backward compatibility

This is not a rewrite. It's four deliberate phases, each shippable and each leaving British Trade Awards fully functional throughout:

1. **Harden the boundary that already half-exists.** Make tenant resolution server-side and unforgeable; add tenant-aware RLS everywhere `tenant_id` already exists. British Trade Awards keeps running exactly as-is, because it's tenant `default` — this phase is invisible to it.
2. **Tenant-scope configuration, not just data.** Move Stripe/SMTP/AI/social keys from `.env` into an encrypted per-tenant config table, with `.env` values becoming the fallback for tenant `default` only. Zero behavior change for the existing tenant.
3. **Build the second tenant, deliberately, before selling it.** Stand up a real second tenant internally (a demo or pilot org) and run it in parallel — this is the actual proof the isolation works, not a code review of it. Everything that breaks here is cheaper to find before a paying second customer exists than after.
4. **Ship the tenant-facing surfaces**: selector, Super Platform Admin, self-service provisioning, per-tenant billing. Only now does "multi-tenant" become a sellable feature rather than an internal capability.

---

## 2. AI Vision

The platform already has one AI integration (Claude-based company vetting during judging). That's the right foundation to extend, not replace — every AI feature below should be additive to that same pattern (server-side call, human always reviews before anything goes live), not a parallel AI system.

**Judging & scoring**
- **Judging assistant**: summarizes a long entry into the 3-5 things a judge should weigh, never scores on its own — judges score, AI prepares.
- **Anomaly detection on scores**: flag a judge whose scores are statistical outliers vs. their panel (either genuinely harsh/lenient, or a data-entry mistake) — this is a governance tool, not a replacement for human judgment, and directly extends the "judge conflict detection" gap already identified as a V1.1 backlog item.
- **Duplicate/fraud detection**: cross-reference nominee submissions against company registries, flag near-duplicate company names or suspiciously similar entry text across categories — a natural extension of the existing AI-vetting call, same infrastructure, new prompt.

**Content & drafting**
- **Award citation drafting**: given a winning entry, draft the one-paragraph public citation a human edits and approves — high value, low risk (always human-reviewed before publish, exactly like the existing email-template pattern).
- **Winner announcement copy**: already flagged in the V1.1 backlog as low-effort — extend it to press releases and social captions from the same source data.

**Growth-side AI**
- **Sponsor recommendations**: match sponsors to categories/regions based on historical enquiry and conversion data — this only becomes real once there's enough tenant-level data volume to train on, which argues for building it *after* multiple tenants exist, not before.
- **Predictive analytics**: entry volume forecasting per category/region to help an organiser plan judging capacity and marketing spend ahead of deadlines.
- **Marketing campaign optimization**: suggest send-time/subject-line variants for the existing email builder based on open-rate history — an enhancement to infrastructure that already exists (Resend + campaign tracking), not new infrastructure.

**Discipline worth stating explicitly**: every AI feature here should degrade gracefully to "off" with zero functional loss — this platform must work perfectly for a tenant who never touches AI at all, both because some customers will want that and because AI providers have outages.

---

## 3. Automation Vision

Vercel Cron (already wired up for daily/weekly tasks) is the right foundation — the goal is expanding *what* runs on it, not replacing *how* it runs.

Realistically automatable across the annual cycle: opening/closing nominations on schedule, deadline reminder cadences, payment chasing sequences, sponsor renewal reminders, certificate generation the moment a winner is published, winner notification emails, scheduled social posts around the ceremony date, and post-award follow-up surveys.

**What should stay human-gated, deliberately**: final judging decisions, the moment a winner's name goes public (the existing Pending→Published pipeline's manual final step is a feature, not a gap — a governance award programme's credibility depends on a human choosing to publish, not a cron job doing it), and anything customer-facing that involves money (a human should always be able to see and override an automated payment-chasing sequence before it fires).

A realistic ceiling: **80-90% of the *operational* lifecycle** (the parts that are the same every year) is automatable. The remaining 10-20% — judging quality, final publish decisions, sponsor relationship management — is where the organiser's actual expertise and judgment lives, and automating those away isn't a feature, it's removing the reason a human is running the programme at all.

---

## 4. Platform Growth

- **Unlimited award programmes**: falls out directly from real multi-tenancy (§1) — each programme is a tenant, or a tenant can run multiple programmes if the data model allows one tenant → many `award_seasons`.
- **Internationalization**: the UK-specific data (counties/regions master list, `£` currency assumptions, UK company-registry lookups) needs to become tenant-configurable rather than hard-coded — this is real work, not a translation-file exercise, because the *domain model* (what a "region" means) is UK-shaped today.
- **Multi-currency**: Stripe already supports it natively; the work is making the amount-display and reporting layers currency-aware per tenant, not a Stripe integration problem.
- **White-label**: a direct consequence of per-tenant branding/domains (§1) — once that exists, "white-label" is a marketing term for a capability that already exists, not new engineering.
- **Franchise/regional operators**: this is a *business model* question before a technical one — does a franchise partner get their own tenant (simple, isolated) or a scoped sub-view of a shared tenant (harder, needs a real hierarchy)? I'd start with "franchise partner = tenant" and only build hierarchy if real customers demand cross-region reporting that a shared platform-level dashboard can't already answer.
- **Enterprise customers**: will want SSO (SAML/OIDC via Supabase Auth's enterprise features), audit-log export, and SLA-backed support — all additive to the existing RBAC/audit-log foundation, not architectural changes.

---

## 5. Administrator Experience

The existing UX-audit discipline (multiple completed passes, 360+ items resolved in prior work) is the right habit to keep, applied to new surfaces as they're built rather than treated as a one-time project. Concretely for 2030:
- **Role-aware dashboards**: a Finance-role user's home screen should lead with payments/invoices, not award counts — the data already exists per-role, the dashboard just needs to reflect it.
- **An AI assistant surfaced in-context** (not a separate chatbot tab) — "why does this entry show zero votes" answered inline, using the same data the page already queries.
- **Bulk operations parity** across every list view, already flagged as a V1.1 item — worth prioritizing early since it compounds: every new tenant's admin spends less time per task, every time.
- **Guided onboarding for a brand-new tenant** — the single highest-leverage UX investment once multi-tenancy ships, since a new tenant's first-week experience determines whether they become a renewal or a churn statistic.

---

## 6. Entrant, Judge & Sponsor Portals

Each deserves to feel like a product built *for* them, not a cut-down view of the admin CMS:

- **Entrant portal**: track their own submission status, download their certificate once published, see their own public voting stats, manage payment/invoice history — all data that already exists per-entry, currently scattered across public form confirmations and emails rather than a persistent, logged-in home.
- **Judge portal** (already exists, extend rather than rebuild): personalized "your assignments" dashboard, scoring history across years, calendar of upcoming deadlines — the blind-scoring foundation is already right, this is about making a returning judge's experience effortless year over year.
- **Sponsor portal** (already exists, extend): enquiry-to-conversion pipeline visibility, their own logo/asset management, renewal reminders, and eventually — once real usage data exists — benchmarking against category averages ("sponsors like you typically renew at X").

---

## 7. Commercial Opportunities

- **Tiered SaaS subscriptions** (Starter / Growth / Enterprise) — the natural monetization once multi-tenancy is real; gate by entry volume, judge seats, or feature tier (AI features, white-label, SSO as Enterprise-only).
- **White-label licensing** — a distinct SKU from multi-tenancy itself: multi-tenancy is the technical capability, white-label is the commercial packaging of "your brand, our infrastructure."
- **Franchise/regional-operator licensing** — a partner runs their own award programme on the platform under a revenue-share, not a flat SaaS fee.
- **Premium analytics & benchmarking** — "how does your programme's entry growth compare to similar programmes" is only sellable once there are enough tenants to benchmark against; sequence this after real multi-tenant adoption, not before.
- **AI modules as an add-on tier** — judging assistance, fraud detection, and campaign optimization as an upsell above the base subscription, not bundled — keeps the base product's cost structure predictable as AI provider pricing changes.
- **API access** — a read/write API for enterprise customers who want to integrate their own registration systems; needs careful scoping against the same 12-function-style discipline (an API gateway pattern, not N new endpoints per capability).

---

## 8. Phased Roadmap

### Version 2 — "Make the boundary real"
| Item | Why this phase | Complexity | Customer value | Commercial value | Dependencies |
|---|---|---|---|---|---|
| Server-side tenant resolution + tenant-aware RLS | Everything else depends on this being genuinely secure, not just labeled | High | None visible yet — pure foundation | None yet, but blocks all future tenant revenue | None |
| Per-tenant configuration (Stripe/SMTP/AI/social keys) | The other half of "isolated," and the part that's currently 100% missing | Medium-High | None visible yet | Unlocks selling to a second customer at all | Tenant resolution above |
| Tenant selector + `user_tenants` model | First user-visible multi-tenant surface | Medium | Lets one admin help run two programmes | Enables the first real second-tenant pilot | Config isolation above |
| Bulk operations parity, judge-conflict detection | Already-identified V1.1 items, high value, low risk, ship regardless of tenancy timeline | Low-Medium | High, immediate | Retention, not acquisition | None — can ship in parallel |

### Version 3 — "Prove it, then sell it"
| Item | Why this phase | Complexity | Customer value | Commercial value | Dependencies |
|---|---|---|---|---|---|
| Real second tenant live in production | The actual proof, not a code review | Medium (mostly operational) | N/A internally | Validates the whole V2 investment | V2 complete |
| Super Platform Admin surface | Needed the moment a second real tenant exists | Medium | Indirect (platform reliability) | Required for any self-service growth | Second tenant live |
| Self-service tenant provisioning + billing | Turns the platform into a product a stranger can buy | High | New-customer onboarding speed | Direct — this is the SaaS subscription product | Super Platform Admin |
| White-label branding/domains | Sellable the moment config isolation (V2) exists | Medium | High for agencies/franchises | New SKU | Per-tenant config (V2) |
| Judging AI assistant, citation drafting | Low-risk, human-reviewed, extends existing AI pattern | Low-Medium | High for judges/organisers | Justifies an AI-tier upsell | Existing AI vetting infra |

### Version 4 — "Scale and specialize"
| Item | Why this phase | Complexity | Customer value | Commercial value | Dependencies |
|---|---|---|---|---|---|
| Multi-currency, i18n for the domain model | Needed before genuine international expansion, not before | High | Unlocks non-UK customers entirely | New market | Multi-tenant billing (V3) |
| Fraud/duplicate/anomaly detection at scale | Needs real multi-tenant data volume to be worth building well | Medium-High | Trust & integrity for organisers | Differentiator vs. generic form-builders | Multiple tenants' real data (V3) |
| Enterprise SSO, audit export, SLA tier | Enterprise customers won't sign without this | Medium | Enables enterprise segment | New, higher-ACV SKU | Real multi-tenant platform (V3) |
| Franchise/regional-operator model | Business-model decision made concrete in code | Medium-High | New partner segment | New revenue line | Tenant model + billing (V3) |
| Sponsor recommendations, benchmarking | Needs enough cross-tenant data to be genuinely useful, not gimmicky | Medium | High for sponsors/organisers | Premium analytics SKU | Multiple tenants, real usage history |

### Long-term vision (2030)
By this point the platform should be judged not by feature count but by three things: **whether a brand-new award organisation can go from signup to their first published winner with zero developer involvement**; **whether the platform's isolation and reliability are trusted enough that an enterprise customer's legal team signs off without a lengthy security review**; and **whether AI features are quietly making every organiser's job easier without ever being the reason a customer chose the platform** — the awards programme's own quality and credibility should still be the product; the platform is the infrastructure that gets out of the way of that.

---

## Final Challenge

**If this were my own company, what would I build over the next five years?**

I would resist the two most tempting mistakes: building AI features before the tenant boundary is real, and chasing every commercial opportunity in this document simultaneously. Multi-tenancy done properly — server-side, RLS-enforced, config-isolated — is boring, unglamorous, and the single highest-leverage thing this platform can do, because every other ambition in this document (AI, portals, franchising, international expansion) is worth zero to a second paying customer if their data isn't provably separate from the first one's. I'd spend Year 1 almost entirely there, resisting pressure to ship visible features, because the payoff of Year 1 is that Years 2 through 5 become additive rather than requiring a rewrite.

Then I'd prove it with one real second tenant before selling to a third — not a demo, a genuine second customer, because the gap between "should work" and "works" in multi-tenant isolation is exactly where the expensive mistakes live.

From there, I'd let commercial pull — not engineering taste — decide the order of AI features, portals, and international expansion. The market will tell us, once there are real tenants paying real money, which of judging assistance, white-label licensing, or franchise partnerships actually has demand behind it. Building all of it speculatively is how a good CMS never becomes a market-leading platform: it becomes a platform with fifty features and no customer who needed most of them. The discipline this whole engagement has shown so far — fix what's proven broken, document what's deliberately deferred, don't invent work to look thorough — is exactly the discipline this five-year plan needs too.
