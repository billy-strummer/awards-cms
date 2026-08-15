# Awards Platform — CTO / Co-Founder Vision

*Third document in this series, after `AWARDS-PLATFORM-2030-VISION.md` (technical evaluation of the multi-tenant path) and `SAAS-PLATFORM-PRODUCT-VISION.md` (the self-service factory model). This one answers the operating-model and honesty questions those two didn't: how do 10 people run 500 tenants, what should genuinely be optional, and where — as requested explicitly — am I pushing back rather than agreeing.*

*Where a topic below was already covered in depth in one of the two prior documents, I've pointed to it rather than repeated it, and spent the words here on what's genuinely new.*

---

## 1. Platform Architecture

Already covered in depth in `AWARDS-PLATFORM-2030-VISION.md` §1 (server-side tenant resolution, tenant-aware isolation, per-tenant configuration) and `SAAS-PLATFORM-PRODUCT-VISION.md` (the provisioning-engine-as-product framing). The one thing to add here, specific to *this* document's framing of "hundreds of tenants, fewer than 10 operators":

**Maintainability is the real scalability constraint, not database performance.** Five hundred tenants on well-designed multi-tenant Postgres with proper indexing is a solved, boring problem — it will not be what keeps ten people up at night. What *will* is: can those ten people ship a fix, roll it out to 500 tenants simultaneously, and know within minutes whether it broke anything, for any one of them? That's an **observability and deployment-safety** problem, not a scaling problem, and it should be prioritized ahead of anything that looks like "performance work" for the next two years. A platform that's fast for 500 tenants but where a bad deploy is discovered by a customer calling in, rather than by a dashboard, is not actually ready for 500 tenants — it's ready for 5, where a human happens to notice.

---

## 2. Product Architecture — should everything be modular?

**No — and I'd push back on modularizing by default.** Over-modularizing a still-young vertical SaaS product creates two costs that are easy to underestimate: sales friction ("which modules do I need?" is a question a small awards charity's admin should never have to answer), and engineering drag (every module boundary is a future integration bug waiting to happen between modules that were never truly independent).

A more honest split:

- **Table stakes, bundled into every plan, never optional**: Core Awards (categories/entries/judging/winners), Judge Portal, Sponsor Portal. These aren't "modules" — they're the product. An awards platform without judging or sponsor management isn't a smaller edition, it's a different product.
- **Genuinely optional, real buyer-need boundary**: CRM (a small awards programme run by two people doesn't need a deal pipeline; a franchise partner running five programmes does), advanced Reporting/Analytics, AI features, API access. These map to real differences in who's buying, which is the correct test for whether something should be a module — not "could we technically separate this."
- **Marketing** is a genuinely interesting middle case: basic email/social scheduling should be bundled (every customer needs to tell people nominations are open), but the *drag-and-drop campaign builder and advanced segmentation* is a legitimate Growth-tier-and-above upsell.
- **Mobile App — I'd actively argue against building one, and this is worth saying plainly rather than nodding it through the list.** A native mobile app is an ongoing multi-year commitment (two more codebases minimum, app-store review cycles, a second design system to maintain) for a workflow that is fundamentally *seasonal and low-frequency* — an awards admin, judge, or entrant uses this software intensively for a few weeks a year, not daily. That's exactly the profile where a genuinely excellent responsive web experience wins over a native app: nobody wants to download an app they'll open four times this year. I would spend that engineering budget on making the existing web experience installable (a PWA — home-screen icon, offline-tolerant judging for patchy venue wifi at a live ceremony) rather than commit to native mobile. If a specific enterprise customer later demands a native app as a contractual requirement, that's a build-for-one decision to make then, not a platform-wide roadmap item now.

**Finance** deserves its own note: payment processing (Stripe connection, entry-fee collection) is table stakes, but deep financial reporting/reconciliation tooling is a real optional module aimed specifically at larger operators with a finance team, not every customer.

---

## 3. Commercial Architecture

Plans, billing, feature flags, usage limits, white-label, and franchise tiers are covered in full in `SAAS-PLATFORM-PRODUCT-VISION.md` §3, §6-13, §17 — that document *is* the commercial architecture. One addition specific to "how should revenue grow": **expansion revenue from existing tenants should be assumed to matter more than new-logo growth in this category**, because awards programmes are annual and sticky — a customer who runs their programme successfully once is very unlikely to switch platforms the following year (the switching cost of moving historical winner data, judge relationships, and sponsor history is high). That argues for investing disproportionately in the upgrade path *within* a tenant's lifecycle (Starter → Growth → Enterprise, storage/volume overages, module add-ons) rather than only optimizing new-signup conversion. A platform that's excellent at expansion revenue can tolerate a fairly average trial-to-paid conversion rate; the reverse is much harder to recover from.

---

## 4. Operational Architecture — how do 10 people run 500 tenants?

This is the sharpest, most underspecified question in the brief, and deserves a direct answer rather than a features list.

**The honest model is a barbell, not a flat "10 people, self-service, done."** Five hundred tenants will not be five hundred equally-sized customers — in a niche B2B category like this, revenue concentration is real: a handful of large national/enterprise awards operators will plausibly generate as much revenue as hundreds of small regional ones combined. That means:

- **The long tail (hundreds of Starter/Growth tenants) must be genuinely, completely self-service** — onboarding, support, upgrades, even most troubleshooting, handled by product and automation, not people. This is achievable: guided setup wizards, a searchable help center, in-product contextual help, and — the single highest-leverage investment here — **an AI support assistant trained on this platform's own documentation and common failure modes**, deflecting the large majority of "how do I..." and "why isn't this working" tickets before a human ever sees them. This is the one AI investment in the whole operational model I'd prioritize above every other AI feature, because it's the thing that makes "10 people, 500 tenants" arithmetic actually work.
- **The top of the pyramid (Enterprise/Franchise tenants) needs real humans, and pretending otherwise is a retention risk, not an efficiency win.** A large national awards programme's admin, mid-ceremony-season, with a judging deadline in six hours and something not working, does not want a chatbot — they want a person who already knows their setup on the phone in minutes. Trying to force this segment through the same fully-automated support model as a two-person regional charity programme is how you keep the tenants who pay the least and lose the ones who pay the most. Budget for a small (2-3 person, even at 500-tenant scale) high-touch success function focused entirely on the top tier, funded directly by that tier's higher margin.
- **Provisioning, monitoring, and upgrades are pure automation, no exceptions** — every new tenant, every deploy, every backup, every health check must be a system doing it, not a person following a runbook, exactly as argued in `SAAS-PLATFORM-PRODUCT-VISION.md` §2. The moment any of these requires a human per-tenant action, the "10 people" number stops being true.
- **Disaster recovery and backups need to be tested, not just scheduled** — a monthly automated restore-and-verify drill against a real tenant's backup (in a sandboxed environment, never against production) is the only way to know backups actually work before the day they're needed for real, and it's cheap insurance relative to the reputational cost of failing a customer's data recovery once.
- **Observability is a support tool, not just an engineering one** — the small operating team should see tenant-level health (error rates, failed payments, unusually low login activity suggesting a confused/stuck customer) *before* a support ticket arrives, and should be able to proactively reach out. This flips support from reactive to preventative, which is the only way ten people can plausibly stay ahead of five hundred customers' worth of problems.

---

## 5. Customer Journey — where's the friction?

Mapping the funnel the user specified, with the honest friction point at each step and the fix:

| Stage | Real friction risk | Design answer |
|---|---|---|
| Prospective customer → Free trial | "I don't know if this is right for us without seeing it configured for an awards programme, not a generic empty form" | Trial signup should ask 2-3 questions (roughly how many entrants, roughly how many categories) and pre-seed a realistic *sample* programme structure, not a blank slate |
| Free trial → Tenant creation | Any manual step here (a sales call gating a real trial) kills self-serve conversion for the long tail | Instant, zero-human provisioning, as designed in `SAAS-PLATFORM-PRODUCT-VISION.md` §2 |
| Tenant creation → Branding | The "blank canvas" problem — an empty admin panel feels like work, not value | Starter themes + logo-driven auto colour palette, so the *first thing* a new admin sees already looks like their programme, not a form |
| Branding → Import first nominees | This is the single highest-risk step in the entire journey — it's exactly where `SOMERSET-REHEARSAL-REPORT.md` found real, serious defects in V1.0 before they were fixed, and it's the step where a new customer either trusts the platform or churns immediately | Continued investment here is disproportionately valuable versus almost anything else in this document — a validated, forgiving, well-tested import path is a trust moment, not a feature |
| Import → Launch nominations | Fear of "did this actually go live correctly" | A single, unambiguous "you are now live" confirmation with a live link to click through immediately, not a settings toggle that quietly took effect |
| Launch → Judging | Judges are recruited once a year and forget the interface between cycles | Judge onboarding needs to assume zero memory of last year — a short guided first-login, not documentation they're expected to have read |
| Judging → Winner management | The moment of highest reputational stakes for the *customer's own* brand (an admin publishing an incorrect winner is a public, embarrassing mistake) | The deliberate Pending→Published staging gate already in the product (see `ADMIN-GUIDE.md` §6) is correct and should never be "simplified away" in the name of automation — this is exactly the kind of human-gated step from `AWARDS-PLATFORM-2030-VISION.md` §3 that should stay manual forever |
| Winner management → Renew for next season | The most under-designed step in most SaaS products generally, and the highest-leverage one given the revenue-concentration argument in §3 above | A guided "clone this season to next year" flow (carrying forward categories, sponsors, branding, judge relationships, while resetting entries/nominations) should be a first-class, celebrated feature, not an afterthought — this is the moment a trial customer becomes a multi-year customer, and it deserves the same design attention as tenant creation itself |

---

## 6. AI Strategy — prioritized by commercial value, not novelty

Ranked, not listed:

1. **AI support deflection** (§4) — highest commercial value of any AI feature in this document, because it's the thing that makes the entire "fewer than 10 people" operating model arithmetic work. Not glamorous, extremely valuable.
2. **Judging assistant + anomaly/conflict detection** — directly improves judging quality and reduces an organiser's governance risk (already scoped in `AWARDS-PLATFORM-2030-VISION.md` §2) — this is a genuine differentiator because it's specific to *this* domain, not a generic AI chatbot bolted on.
3. **Award citation / winner-copy drafting** — real time savings for every customer, every cycle, low risk (always human-reviewed).
4. **Fraud/duplicate detection during import** — directly relevant given the real defects already found in the import path; protects data integrity, which protects trust, which protects renewal.
5. **Renewal-risk prediction** (a genuinely new idea worth adding here) — given the revenue-concentration argument in §3, an AI model flagging "this tenant's engagement pattern looks like last year's churned customers" *before* the renewal conversation, so the small human success team (§4) spends its limited time where it matters most, is a very high-leverage, very low-glamour AI use that directly serves the "10 people, 500 tenants" constraint rather than being a customer-facing feature at all.
6. **Sponsor/campaign optimization** — real, but lowest priority of the list; needs real cross-tenant data volume to be worth building well, and isn't load-bearing for the core business the way 1-5 are.

**What I'd deliberately not build**: generic "AI writes your marketing copy" or "AI chatbot for entrants" features that every SaaS category is adding right now as table-stakes hygiene rather than differentiation. Building them isn't wrong, but they shouldn't consume strategic attention or be marketed as the platform's edge — see Brutal Honesty §9 below.

---

## 7. Marketplace Strategy — could this be more than software?

Yes, and this is one of the genuinely differentiated long-term bets in the whole plan, because it's the one category of value that a single-tenant competitor *cannot* replicate no matter how good their software is — it requires many tenants on one platform. Prioritized:

1. **Judge marketplace** — highest strategic value. Recruiting good judges is a real, recurring pain for every awards organiser, and a cross-tenant pool of vetted judges (opt-in, with their own judge-side profile and history) turns a shared-infrastructure cost center into a genuine network effect: the platform gets *more* valuable to every tenant as more tenants join it, which is the strongest kind of moat available to a vertical SaaS company.
2. **Sponsor marketplace** — same network-effect logic from the sponsor's side (one relationship, many programmes to sponsor) — valuable, slightly harder to bootstrap since sponsors need a critical mass of tenants to make the directory worth browsing.
3. **Template/starter-pack marketplace** — genuinely useful, lower strategic ceiling (competitors can and will copy a template library; they can't copy a judge network).
4. **Integration marketplace** — valuable for Enterprise retention, but a later-stage bet — only worth investing in once the API (already scoped) has real external developer demand, not speculatively.

---

## 8. Long-Term Technical Vision — what would I do in Version 2 to protect Version 5?

If I inherited V1.0 today, knowing the five-year ambition:

- **Treat "no rewrite" as "no *forced* rewrite," not "no rewrite ever."** Promising zero rewrites for five years is the kind of promise that sounds disciplined but is actually a trap — real SaaS companies that scale successfully usually *do* replace specific subsystems (billing, search, sometimes the core data layer) once they cross genuine scale thresholds, and pretending otherwise leads to over-engineering V2 for a scale it may never reach. The honest goal is: don't cause an *avoidable* rewrite through decisions made carelessly now. That's a meaningfully different, more honest bar.
- **Instrument before you scale, not after.** The single highest-leverage V2 investment for protecting V5 is observability (structured logging, per-tenant error/usage dashboards, alerting) built in from the start of the multi-tenant work — not because it's glamorous, but because every "why is tenant #340 seeing this" question in year three is either a five-minute dashboard lookup or a multi-day forensic investigation, entirely depending on whether this was built in V2.
- **Keep the "consolidate into fewer, larger handlers" discipline that already exists (the 12-function Vercel constraint) as a permanent architectural law, not a workaround to escape later.** It's tempting to treat that limit as a thing to "graduate past" once the platform is bigger — resist that. The discipline it forces (fewer, well-organized surfaces rather than an endpoint per feature) is good architecture independent of the hosting constraint that originally forced it, and abandoning it the moment budget allows tends to produce exactly the kind of sprawl that causes the rewrites we're trying to avoid.
- **Testing and documentation are the actual determinant of whether a small team can move fast at scale**, more than any specific architecture choice — the existing discipline of a large, real automated test suite and living documentation (this repo's own `ADMIN-GUIDE.md`, updated in the same commit as every workflow change) is worth explicitly protecting as a *cultural* commitment through every future phase, not just a V1.0 nicety that quietly lapses under deadline pressure in V3.
- **Developer experience is a retention tool for the platform's own team**, not a luxury — a ten-person team running a 500-tenant platform cannot afford slow local development, flaky tests, or unclear ownership boundaries between "modules" (§2). Protecting developer velocity *is* protecting the five-year plan, because the plan depends entirely on a very small number of people being able to move confidently for a very long time.

---

## 9. Brutal Honesty

You asked for this directly, so plainly:

**The market reality check first.** This is not a greenfield category — Award Force and similar incumbents have been building exactly this kind of software for over a decade, with existing customers, existing judge/sponsor relationships, and existing trust. "We built one too, and ours has AI" is not a strategy; every incumbent will have AI within 18 months, because AI features are now table stakes across every SaaS category, not a differentiator any single company can hold onto. The honest strategic question isn't in this document at all yet: **what is the specific wedge that makes an organiser switch, or a new organiser choose this over an entrenched incumbent?** Candidates worth testing, not assuming: the judge/sponsor marketplace network effect (§7, genuinely hard to copy), a meaningfully better price point for the long tail, or a specific vertical/regional focus an incumbent has neglected. Pick one and be honest that the rest of this document is infrastructure *for* that wedge, not the wedge itself.

**"Fewer than 10 people, 500 tenants" is the right constraint for the *long tail*, and the wrong constraint if applied uniformly.** I said this in §4 and I'll say it again more bluntly here: if the plan is "10 people, fully self-service, no exceptions," the highest-revenue customers — the ones a niche B2B SaaS company actually depends on financially — will churn to a competitor willing to pick up the phone. Design the operating model as a barbell (self-service long tail + a small, real, high-touch team for the top) from the start, not as a single number to hit.

**AI is hygiene, not the moat, and the document above should be read that way.** Every AI feature listed will be table stakes across this whole software category within two to three years. Building them is necessary — a platform without an AI judging assistant will look dated by 2027 — but none of them should be described internally, to investors, or to customers as *the* differentiator, because that story has a very short shelf life. The moat, if there is one, is the judge/sponsor marketplace network effect and the accumulated trust of a programme's historical winner archive (switching cost) — not the model version being called.

**A native mobile app is very likely the wrong investment for a team this size, and it's worth saying I'd resist it even if asked for directly**, for the reasons in §2 — a seasonal, low-frequency workflow is exactly the profile where a great installable web app beats the multi-year maintenance cost of native apps, and "does this platform have a mobile app" is a checkbox question most enterprise buyers ask without it being an actual deciding factor once a good web experience exists.

**The single biggest risk right now isn't in any of the eight topics above — it's that this is the third strategic-planning document produced in this conversation, and none of it has yet been tested against a real second customer.** Every number, tier, and priority order above is a well-reasoned hypothesis, not a validated fact. The most valuable next action available is not a fourth planning document — it's getting British Trade Awards genuinely live, learning for real what breaks, what they actually ask for, and what they'd actually pay more for, and then finding *one* second design partner before committing engineering time to any specific item in this document's roadmap. A five-year plan is only as good as the assumptions it's built on, and right now every assumption here is untested. I'd rather say that plainly than keep producing confident-sounding five-year plans that feel like progress but aren't yet grounded in a second paying customer's real behaviour.

---

## Final Question

**If this were my own company, and my personal goal was to build the global market leader over the next ten years, what would I build, what would I deliberately not build, and why?**

I would build, in order: the self-service provisioning engine and instant tenant creation (because it's the one thing that makes the "10 people, 500 tenants" story possible at all); the judge and sponsor marketplaces (because they're the one part of this whole plan a well-funded incumbent competitor cannot simply copy by shipping a feature — they require the network, not just the code); and the observability/support-automation layer underneath all of it (because it's what lets a ten-person team survive its own success instead of drowning in it).

I would deliberately not build: a native mobile app, until a specific paying enterprise customer makes it a contractual dealbreaker, not before; more than a handful of AI features in the first eighteen months, because every one of them is perishable competitive advantage and none of them is the actual moat; a fourth strategic-planning document before British Trade Awards and one real second customer have told us, through actual usage, which of the hypotheses above survive contact with reality.

The honest version of ambition here isn't "plan five years perfectly upfront" — it's "build the smallest version of the provisioning engine and the marketplace idea that lets us learn from real customers fastest, and let their behaviour, not this document, write most of years two through five."
