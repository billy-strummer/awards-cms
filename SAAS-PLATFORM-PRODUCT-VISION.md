# Awards Platform — SaaS Product Design

*Written as SaaS product architect, not database architect. This is a companion to `AWARDS-PLATFORM-2030-VISION.md`, which covered the broader five-year strategy (AI, automation, roadmap). This document answers one specific question in depth: how do we design the product so hundreds of award organisations can each believe they have their own dedicated system, when a brand-new one can be created without a human writing code, cloning a repo, or touching a database? No schema talk below — this is about the product a customer buys and the experience they have using it.*

---

## 0. The Mental Model

Stop thinking "CMS with tenants." Start thinking **factory**. The product isn't Award Management Software — it's a machine that produces fully-functional, fully-isolated Award Management Systems on demand, the same way Shopify doesn't sell you "a store," it sells you a factory that produces stores, and each merchant genuinely believes — correctly, for all practical purposes — that they have their own shop.

Applied here: **British Trade Awards should be Tenant #1 that came out of the factory, not the factory itself.** The factory is the product. Every capability below — branding, payments, AI, domains — is a dial the factory lets a new tenant set during and after provisioning. Nothing is a special case bolted onto a single-tenant CMS after the fact.

The single test of whether this vision is real: **a stranger who has never spoken to us should be able to sign up, brand their organisation, invite their team, and publish their first award category — without ever suspecting anyone else uses the same platform.** Everything in this document serves that one sentence.

---

## 1. Platform Owner vs. Tenant Owner

Two genuinely different products, two genuinely different users:

**Tenant Owner** (e.g., British Trade Awards' own admin) experiences exactly what exists today — their own branded system, their own users, their own data, their own "Super Admin" at the top of their own role hierarchy. They should have **zero awareness the platform is shared.** The only new thing a Tenant Owner sees is a **Billing & Subscription** area where they manage their own plan and payment method — a relationship with *us*, not with any other tenant.

**Platform Owner** (us) gets an entirely separate product surface — a **Platform Console** — that no Tenant Owner ever sees or can reach:
- A directory of every tenant: plan, MRR, health/usage, signup date, support flags.
- Tenant lifecycle controls: suspend, reinstate, manually adjust plan/limits, impersonate-for-support (with an audit trail and the tenant notified, never silent).
- Platform-wide analytics: revenue, churn, feature adoption, which plan tier converts best.
- Its own sub-roles: a Platform Support agent needs "view this tenant's config to help them," not "edit any tenant's award data" — the Platform Owner's own team needs the same kind of least-privilege thinking a Tenant Owner's team already gets.

This is the most important organizing idea in the whole document: **two products, two consoles, one engine underneath.** A Tenant Owner should never be one misclick away from platform-level controls, and a Platform Support agent should never casually browse a tenant's private award data without a reason and a record of having done so.

---

## 2. Self-Service Tenant Creation — the single most important screen in the product

This deserves more design attention than any feature *inside* a tenant, because it's the moment we either win or lose a customer before they've seen anything else.

**The experience**: a public "Start your Awards Programme" page → a short wizard (organisation name, choose-your-subdomain, pick a plan, pick a starter brand theme, create your admin account) → **instant provisioning** → the new Tenant Owner is logged straight into their own, fully working, empty-but-ready CMS within seconds. No sales call required for the entry tier. No "we'll set this up for you in 3-5 business days."

**What "instant" has to mean, as a product commitment**: creating a tenant is a single, versioned, repeatable action the platform runs — never a person following a checklist. If provisioning a new tenant ever requires a Platform Owner to run something by hand, the product doesn't scale past a handful of customers, no matter how good everything else is. This is the one place where "boring and automatic" beats "impressive and manual" every time.

**Two entry points, one engine**: the same provisioning action should be triggerable from (a) the public self-service signup flow, and (b) a "Create Tenant" button in the Platform Console, for white-glove enterprise onboarding where we want to pre-configure things on a customer's behalf before handing over the keys. Same machine, different door.

**Starter theme, not blank canvas**: a small curated library of pre-built brand themes (Classic Gold, Modern Minimal, Bold Corporate, etc.) a new tenant picks during signup and refines afterward. This single decision does more for activation than any onboarding checklist — it turns "here's an empty admin panel, good luck" into "here's your awards programme, already looking good, now make it yours."

---

## 3. White-Label Capability

Two distinct commercial tiers, not one binary feature:

- **Branded** (default, lower tiers): the tenant's own logo/colours/domain everywhere their own audience sees, but a subtle "Powered by Awards Platform" credit remains (in the footer, in system emails) — standard, expected, doesn't hurt trust.
- **True White-Label** (premium tier / franchise-and-agency add-on): zero trace of the underlying platform anywhere — no "powered by" anywhere, tenant's own sender domain on every email, tenant's own support contact surfaced instead of ours. This is the tier an agency reselling to their own sub-customers needs, because *their* customers should never learn the agency didn't build this themselves.

Product principle: white-label is a **flag on a tenant's plan**, resolved at render time — never a fork, never a separate build, never a reason two tenants are running different code.

---

## 4. Independent Domains

- **Free subdomain at signup, always** (`britishtradeawards.awardsplatform.com`) — zero friction, zero DNS knowledge required, works the instant provisioning finishes. This removes the single biggest friction point in self-service SaaS signup: nobody should ever be blocked from trying the product because they don't own a domain yet.
- **Custom domain as a guided upgrade**: "Connect your own domain" wizard — enter the domain, we show exactly which DNS records to add, we verify automatically once they propagate, TLS is handled without the tenant ever thinking about certificates. This is a well-proven pattern in hosting platforms generally, so it's a UX design problem to get right, not a research problem.
- The domain a request arrives on is what makes the illusion of a dedicated system complete — a Tenant Owner's own visitors should never see any URL, anywhere, that hints at shared infrastructure.

---

## 5. Per-Tenant Branding

Beyond logo/colour fields on a settings page — treat branding as an **onboarding product moment**, not a form:
- Upload a logo, and suggest a colour palette extracted from it automatically.
- Offer curated font pairings rather than a raw font picker.
- Preview the public homepage live as branding choices change, so a Tenant Owner sees their real award site taking shape in real time, not a settings page they hope looks right later.

---

## 6. Per-Tenant Payment Providers

Two entirely separate money flows, and being explicit about the difference is a commercial-integrity issue, not just a technical one:

1. **Platform subscription billing** — the Platform Owner's own Stripe relationship, billing each Tenant Owner for their plan. This is *our* revenue.
2. **Tenant's own entry-fee / sponsorship revenue** — each tenant connects **their own** payment account (the standard "connected accounts" pattern used by every credible multi-tenant marketplace/SaaS with payments — the platform facilitates the connection but the money goes directly to the tenant, never pooling through a platform-owned account). We are never in the business of holding or processing a tenant's award-entry-fee revenue as if it were ours; that would make us a payments company with all the regulatory weight that implies, for zero strategic benefit.

Enterprise tenants who already run their own merchant relationship should be able to bring their own existing payment account rather than create a new one through our flow.

---

## 7. Per-Tenant SMTP

Three tiers of increasing tenant control, matching plan level:
1. **Default (every tenant, day one)**: platform-managed sending, zero setup, works immediately on signup.
2. **Custom sending domain (Growth tier)**: tenant verifies their own domain for deliverability/branding ("sent from britishtradeawards.com," not a shared platform domain) via a guided DNS-record flow — the same well-established pattern used by every serious email-marketing SaaS.
3. **Bring-your-own SMTP (Enterprise)**: a tenant with existing infrastructure requirements plugs in their own credentials entirely.

Nobody should ever be blocked from sending their first invite email while they figure out DNS — tier 1 has to always work, with tiers 2-3 as pure upside.

---

## 8. Per-Tenant AI Configuration

- **Default**: AI features run on the platform's own provider relationship, metered per plan tier, bundled into subscription pricing — a tenant never sees an API key, never manages a provider account, it just works.
- **Enterprise option**: bring-your-own AI provider credentials, for customers with data-residency or compliance requirements that mean they need their AI calls made under their own account — same feature set from the tenant's point of view, different plumbing underneath.
- AI capabilities themselves are plan-gated (see Feature Flags) — e.g., the judging assistant is a Growth-tier-and-above feature, not available on Starter.

---

## 9. Per-Tenant Storage

Generous, invisible defaults on entry tiers, expandable as a metered upgrade as a tenant's media library grows year over year — the same "just works, then becomes a natural upsell" pattern Dropbox/Google Workspace use. Storage limits should never be the reason a tenant discovers the platform has other customers ("shared quota" thinking has no place here) — each tenant's storage experience should feel like their own dedicated allocation, whatever the truth underneath.

---

## 10. Subscription Plans

A concrete proposed structure — the plan *is* the bundle of limits and feature flags below, nothing more exotic:

| Plan | Who it's for | Includes |
|---|---|---|
| **Starter** | A new/small awards programme testing the waters | 1 programme, shared subdomain, platform branding, capped entries/year, core CRUD, no AI, no white-label — free or low-cost, designed to remove all friction from trying the product |
| **Growth** | The core paid tier most real customers land on | Custom domain, full branding, AI judging assistant, unlimited categories, automation, custom sending domain, standard support, generous (not unlimited) volume |
| **Enterprise** | Large, established awards operators | Unlimited volume, SSO, bring-your-own AI/SMTP, full white-label, dedicated support, custom SLA, migration assistance |
| **Franchise / Agency** | A partner running *multiple* award programmes commercially | Everything in Enterprise, plus the ability to spawn and manage several sub-tenants under one relationship and one bill |

---

## 11. Billing

- Platform-owned billing engine (subscriptions, proration on upgrade/downgrade, dunning for failed payments, invoicing) run against each Tenant Owner directly — entirely separate from whatever payment processor a tenant has connected for their own entry fees.
- Usage overages (extra storage, extra entry volume, extra AI credits) metered and billed as add-ons on the base subscription — a familiar, expected SaaS billing shape.
- Self-service upgrade, downgrade, and cancellation — with a guaranteed data export before any deletion, because a customer who trusts they can leave cleanly is more willing to sign up in the first place.
- A Platform Console view of MRR, churn, and per-tenant health, because this is now a business we're running, not just a product we're operating.

---

## 12. Feature Flags

Every premium capability (white-label, custom domain, AI features, SSO, API access) is a **flag resolved per tenant at the moment it's used**, driven by their current plan — never a code branch, never a different build, never a "the Enterprise version of the app." This is what makes upgrades and downgrades **instant**: change a tenant's plan, their available features change immediately, with no deploy, no migration, no support ticket. It also enables safe beta-testing of new features with a handful of tenants before wider release, and graceful degradation (a failed payment quietly drops a tenant to Starter-tier flags rather than an abrupt service cutoff — preserving the relationship, not punishing it).

---

## 13. Usage Limits

Concrete dimensions worth metering: entries per year, storage, admin/judge seats, email sends per month, AI requests per month, number of concurrent award programmes. The product principle that matters more than the numbers themselves: **limits should be generous enough that a real customer never hits one by surprise mid-programme** — nothing is worse than an admin locked out two days before their ceremony because of a quota. Soft warnings well ahead of any hard cap, and an "upgrade to continue" prompt that feels like an invitation, not a wall.

---

## 14. Marketplace Opportunities

Once there are genuinely many tenants, a real marketplace becomes possible — this is one of the clearest ways this platform becomes worth more than the sum of hosting a lot of independent CMS instances:
- **Template marketplace**: branding themes, email-template packs, and vertical-specific starter category lists (a "Hospitality Awards" starter pack looks nothing like a "Trade Awards" one) — sellable, some platform-built, eventually some third-party-built.
- **Judge marketplace**: a cross-tenant pool of vetted judges available for hire by any tenant needing panel capacity — a benefit genuinely only possible *because* many tenants share one platform, not something any single-tenant CMS could ever offer.
- **Sponsor marketplace**: sponsors interested in trade/industry awards discover multiple tenant programmes through one directory — one relationship for the sponsor, inbound discovery for the tenant they didn't have to generate themselves.
- **Integration marketplace**: third-party developers build against the platform API (see below); the platform takes a revenue share — classic, proven marketplace economics, and a second reason developers might build *for* this platform rather than against a generic form-builder.

---

## 15. API Access

A tenant-scoped, versioned public API (a tenant's own data only) for enterprise customers integrating their own registration systems, CRM, or BI tooling. API access is itself a plan-gated, usage-metered feature (Enterprise and above) — a genuine incremental revenue line, not a free technical capability given away. Separately, a platform-level API supports our own ops tooling and marketplace integration partners — a different audience, a different product.

---

## 16. Enterprise Editions

Beyond SSO, bring-your-own AI/SMTP, and dedicated support already covered above: the largest, most compliance-sensitive customers may specifically want **dedicated infrastructure** as a purchasable option — "we're a multi-tenant platform by default, and we also offer a private/dedicated tier for those who genuinely require it" is a completely standard, sellable SaaS pattern, not a contradiction of the multi-tenant vision. Add a named account manager, custom contractual SLAs, and migration assistance for large operators moving off a legacy system — migration help is a real sales enabler, since the biggest blocker for an established awards operator switching platforms is usually "what happens to our historical data," not features.

---

## 17. Franchising

A franchise/agency partner is a **Tenant Owner who is also granted the ability to spawn and manage their own family of sub-tenants**, billed and supported as one commercial relationship with us — effectively a Platform-Owner-lite role, scoped to just their own tenants, never the whole platform. This deserves to be its own product tier (Franchise/Agency, §10) rather than a checkbox on Enterprise, because the *experience* is genuinely different: a franchise partner needs a console for managing several award programmes at once, comparing them, and rolling their own branding conventions across them — a different job than running one programme really well.

---

## 18. International Expansion

Currency, language, and locale defaults (date formats, regional payment method preferences, region-appropriate starter category packs) are choices made **once, per tenant, during provisioning** — never a single global platform setting — because a UK tenant in GBP/English and a French tenant in EUR/French need to run correctly, side by side, on the same day, on the same platform. Internationalization here is a provisioning-wizard decision, not a platform-wide configuration project.

---

## Closing

The whole document reduces to one design discipline: **the tenant-provisioning engine is the product.** Branding, payments, AI, domains, storage — every one of them is a dial that engine already understands how to set for a brand-new tenant, not a special case retrofitted onto British Trade Awards after the fact. If we build the factory well, British Trade Awards being "Tenant #1" stops being a migration project and becomes simply the first, and eventually smallest, story the platform tells.
