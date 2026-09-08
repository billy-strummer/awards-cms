# SEO Audit — 2026-09-08

## Summary

A third-party developer reviewed the live site and sent over SEO recommendations (canonical URLs, schema markup, llms.txt, a sitemap, and an alt-text complaint), plus AI-generated implementation notes for the first three. This document verifies each point against what's actually in the codebase, adds findings the review missed, and gives a straight verdict on what's worth doing and in what order.

**Verdict up front:** three of his five points are genuinely worth doing, one couldn't be verified, and one (llms.txt) is fine to defer exactly as he said. The bigger issue is one he didn't flag: the few canonical tags that already exist point at the wrong domain, and building more on the same pattern would make that worse, not better.

**Severity counts:** 1 Critical · 3 High · 2 Medium · 1 Low · 1 Unverified

---

## CRITICAL

### [ ] SEO-C1 — Existing canonical tags point at the Vercel staging domain, not the real site

- **Files:** `home.html`, `home-stage2.html`, `home2.html`, `home-blue.html`, `home-blue1.html`, `home-blue2.html`, `home-blue3.html`
- **Description:** 6 of the site's 40 HTML pages already have a `<link rel="canonical">` tag, and all of them hardcode `https://awards-cms.vercel.app/` — the Vercel preview URL, not `britishtradeawards.com` (the domain already referenced in `robots.txt`'s `Sitemap:` line and in the FAQ's own hyperlinks). If canonical tags get rolled out site-wide using this same hardcoded pattern, every page will tell Google "the preferred version of this content lives on the staging domain," which is actively worse than having no canonical tags at all — it risks the real domain never getting indexed properly once it goes live.
- **Why this matters more than it looks:** this isn't a one-line fix, it's a process fix. Canonicals need to be generated from a single source of truth (the `APP_URL` env var already configured in Vercel per `CLAUDE.md`), not typed by hand into 40 files. Hand-typing them is exactly how the current wrong-domain tags happened.
- **Suggested fix:** Add canonical (and `og:url`) tag injection to `build.js`, templated from `process.env.APP_URL`, applied to every page in `PUBLIC_PAGES`. Fix the 6 existing hardcoded tags in the same pass. Do this *before* rolling out canonicals more broadly (SEO-H1) — otherwise the broader rollout just multiplies the same mistake.
- **Verdict: worth fixing, and it should happen first, not alongside.**

---

## HIGH

### [ ] SEO-H1 — Add canonical tags to the rest of the indexable pages

- **Files:** all pages listed under `Allow:` in `robots.txt` that don't yet have one — `submit-entry.html`, `nominate.html`, `vote.html`, `public-voting.html`, `public-winners.html`, `privacy-policy.html` — plus the other genuinely public pages not yet in `robots.txt` at all (`about.html`, `faqs.html`, `terms-and-conditions.html`, `cookie-policy.html`, `become-a-sponsor.html`).
- **Developer's verdict: "important."** Confirmed and agreed, once SEO-C1's domain problem is fixed first.
- **The one nuance his own notes surface but don't resolve for this specific site:** `public-voting.html` takes `city`, `country`, `sector`, and `category` as query parameters (`?city=Manchester&category=Electrician`), and his own guidance explicitly warns against every filter combination getting indexed separately. Two real options, and this needs a decision, not just an implementation:
  - **Self-canonicalize to the bare URL** (`public-voting.html`, no query string) if the filtered views aren't meant to rank individually in Google — simplest, safest default.
  - **Self-canonicalize to the exact query combination** if each city/category pairing is meant to be a real, independently-discoverable landing page (e.g. someone searching "best electricians Manchester" should be able to land directly on that filtered view). This only makes sense once that page is redesigned to be genuinely useful standalone content, not just a filter UI — which is exactly the still-open "redesign public-voting.html as a proper county/city landing page" item from the Stage 2 build list.
- **Suggested fix:** bare-URL self-canonical for now (matches current reality — the page is a filter tool, not yet a set of standalone landing pages); revisit once/if the landing-page redesign happens.
- **Verdict: worth doing, but decide the query-param approach explicitly rather than defaulting into it.**

### [ ] SEO-H2 — `robots.txt` references a sitemap that doesn't exist

- **File:** `robots.txt`
- **Description:** The file already contains `Sitemap: https://britishtradeawards.com/sitemap.xml` — but no `sitemap.xml` exists anywhere in the repo. Any crawler that respects this line gets a 404. This isn't "would be nice to add a sitemap" (the developer's framing) — it's a broken reference that's live right now.
- **Suggested fix:** Generate `sitemap.xml` at build time in `build.js` from the same `PUBLIC_PAGES` list already used for the copy step (excluding anything `robots.txt` disallows), so it can't drift out of sync with what's actually public. Static and small enough that a manual file would also work, but it will rot the first time a page is added or removed.
- **Verdict: worth doing, and it's the one item here that's a live bug rather than a missing enhancement.**

### [ ] SEO-H3 — Add Organization and WebSite schema now; hold off on Event and LocalBusiness

- **Files:** `home.html`, `home-stage2.html` (Organization + WebSite); everywhere else, not yet
- **Developer's verdict:** suggested Organization, WebSite, BreadcrumbList, Event, and LocalBusiness, with his own explicit caveat: *"don't add schema simply because we can... it should accurately represent information that's actually on the page."*
- **Taking him at his own word, checked against real content:**
  - **Organization / WebSite** — buildable now with real values (name, url, logo), even though the legal name, registration number, and address are still `[Placeholder]` text in the footer (`terms-and-conditions.html`, `privacy-policy.html`, `home.html`'s footer). Ship the fields that are real; add the rest when the legal placeholders are filled in — don't schema-mark placeholder text as if it were real company data.
  - **BreadcrumbList** — buildable now on pages that already render a visible breadcrumb (e.g. the somerset nominee page pattern), since schema should mirror what's genuinely on the page.
  - **Event** — *not yet.* The one candidate for this (`UK Tour Dates`, home page bento box 3) currently reads "Dates to be confirmed" — literally a placeholder. Marking that up as an `Event` would be schema describing content that doesn't exist yet, which is precisely what he warned against.
  - **LocalBusiness** — *not yet.* This would live on individual nominee/business listings, and per earlier findings the public "Find a Trade" directory is a working front-end wired to zero real data (search always returns "coming soon"). No live business listing pages exist yet to attach this schema to.
- **Verdict: do Organization/WebSite/BreadcrumbList now with real data only; Event and LocalBusiness are correctly sequenced *after* their underlying content ships, not before.**

---

## MEDIUM

### [ ] SEO-M1 — Several public pages have no meta description at all

- **Files:** `faqs.html`, `terms-and-conditions.html`, `privacy-policy.html`, `cookie-policy.html`, `submit-entry.html`, `public-voting.html`, `vote.html` (confirmed empty via direct check — 7 of 10 sampled pages)
- **Description:** not raised by the developer, found in the course of checking his points. Without a meta description, Google auto-generates a snippet from page content, which for an FAQ accordion or a legal document tends to produce a poor, unrepresentative search snippet.
- **Suggested fix:** one unique, human-written sentence per page. Cheap, no architecture decisions needed, can be done in the same pass as SEO-H1.
- **Verdict: worth doing, low effort, bundle with the canonical rollout since it touches the same `<head>` blocks.**

### [ ] SEO-M2 — `home.html`/`home-stage2.html` meta description said "Enter 2026" — now fixed

- **Files:** `home.html`, `home-stage2.html`
- **Description:** found and fixed in this same pass. The meta description still said "Enter 2026" after the Stage 1 Key Dates were corrected to a Dec 2026–2027 cycle (`about.html` now correctly says "Launching in 2027"). `home-stage2.html`'s copy of the same line also referenced "Enter 2026," which was doubly wrong there since Stage 2 is about voting, not entering. Both now read correctly (`home.html`: "Enter 2027"; `home-stage2.html`: reworded to lead with voting).
- **Related, not fixed:** the header logo badge on `home.html` still reads "Est. 2026" (`home.html` header markup). Left alone since "Est." plausibly refers to the company's founding/incorporation year rather than the programme's launch year, and changing it wasn't part of what was asked — flagging so it gets a deliberate answer rather than staying an accidental leftover.
- **Verdict: done. Confirm "Est. 2026" is intentional before the site goes live.**

---

## LOW

### [ ] SEO-L1 — llms.txt

- **Developer's verdict:** "optional but worth doing in the future," not an established ranking factor.
- **Checked:** no `llms.txt` exists yet. Agreed with his framing — cheap, low-risk, genuinely plausible fit for a directory-style site, but not the kind of thing worth interrupting other work for.
- **Verdict: agreed, defer. Revisit once the actual "Find a Trade" directory has real listings — an llms.txt written for a stub directory has nothing useful to point AI systems at yet.**

---

## UNVERIFIED

### [ ] SEO-U1 — "Some of the images have alt text saying stuff like 'Your logo'"

- **Checked:** every `alt="..."` value across every `.html` file in the repo, plus a search of the admin SPA bundle (`index.html`) for similar phrasing. No `alt="Your logo"` or equivalent exists anywhere. The closest match is `vote.html`'s nominee logo (`nominee-voting.js`): it correctly sets `alt` to the real company name when a logo exists, and only falls back to the generic `alt="Company Logo"` when there is no real logo to describe — which is correct, accessible behavior, not a bug.
- **Verdict: could not reproduce. Either it's on a page/environment not covered here, or it was a different site he had open at the same time — worth asking him for the specific URL or a screenshot before spending time on it.**

---

## Priority order

1. SEO-C1 — fix the domain in the canonical tags that already exist, and set up build-time templating so it can't happen again
2. SEO-H2 — generate `sitemap.xml` (robots.txt is pointing at a 404 right now)
3. SEO-H1 + SEO-M1 — roll out canonicals and meta descriptions together across the remaining public pages
4. SEO-H3 — Organization/WebSite/BreadcrumbList schema, real data only
5. SEO-L1 — llms.txt, once the trade directory has real content to describe
6. SEO-U1 — needs a URL/screenshot from the developer before it can be actioned
