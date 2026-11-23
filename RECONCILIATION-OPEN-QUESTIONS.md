# `feature/safe-reconciliation` — Open Questions & Path to a Real Decision

**Status:** Living record. Item 1.1 below is now resolved (see "Resolved" box) with empirical evidence and a final decision; items 1.2–1.6 are still open.

**Context in one paragraph:** `feature/safe-reconciliation` merges `origin/main` (85 commits ahead, +26,622/−35,155 lines across 234 files) with our `claude/supabase-cms-setup-test-e6oiza` branch. The 24 real git conflicts were resolved and verified (build clean, 85/85 test suites passing). One of those resolutions — restoring `btc-module.js` — was done on explicit instruction after a prior audit flagged its removal as a silent, unreviewed deletion; that restoration has since been reverted (see below) after a live empirical test. The branch is pushed and inspectable. It has **not** been merged into `main`, and it probably shouldn't be yet, for the reasons below.

---

## 1. Open uncertainties

### 1.1 Should `btc-module.js` actually exist? — RESOLVED, pruned

> **Resolution:** Restored on commit `bba140d`, then empirically tested with Playwright against a locally built copy, then reverted on the commit noted in the top-level sign-off. The widget is gone from the branch again. Full chain of evidence below.

Original concern: three independent signals suggested the widget was unwanted —
- Our own branch removed it in a dedicated commit: *"Remove dead Markets/Bitcoin feature end-to-end."*
- Main's **own** `UX-AUDIT-TODO.md` flags the same widget as a dead-code candidate, recommending removal if it's not actually planned for use.
- The RBAC visibility toggle looked broken on main itself: it clears an **inline** `style.display`, but the element also carries Bootstrap's `.d-none` (`display: none !important`), which an inline style cannot override.

**That third point was tested live, not just read from source.** Built `feature/safe-reconciliation` fresh, served `dist/` locally, loaded it in headless Chromium (Playwright), and drove the app's real `rbacModule.applyPermissions()` function directly (no live Supabase in this sandbox, so login couldn't complete — the real RBAC code path was exercised directly instead, which is what actually controls this behavior):

| Step | Result |
|---|---|
| `rbacModule.canAccess('bitcoin')` under a simulated `super_admin` | `true` — RBAC logic is correct |
| `applyPermissions()` runs, clears `#markets-nav-item`'s inline `style.display` | confirmed, inline style became `''` |
| `getComputedStyle(#markets-nav-item).display` | **`"none"`** — still hidden |
| Control check: manually remove *only* the `.d-none` class, nothing else | computed display immediately flips to `"block"` |

The control check is conclusive: the `.d-none` class's `!important` rule is the only thing keeping it hidden, and no role simulation can touch it. **The tab was unreachable for every role, including super_admin, exactly as shipped on `main`.** Since the restoration changed nothing visible to any real user while adding ~300 lines, a third-party CSP allowance (`s3.tradingview.com` and friends), and RBAC/nav wiring, the decision was to prune it back out rather than carry dead, invisible code forward.

**This remains recoverable, not destroyed:** the full restoration (markup, JS, RBAC entries, CSP) lives in commit `bba140d` on this branch's history. If a product owner later decides the widget is wanted, that commit can be cherry-picked back and the one-line `d-none`/`!important` bug fixed at the same time — the bug is now diagnosed, not a fresh investigation.

### 1.2 Is a single 85-commit merge the right vehicle at all?
Even with the 24 conflicts correctly resolved, the diff is +26,622/−35,155 across 234 files. No reviewer — human or otherwise — can meaningfully evaluate that in one sitting. It will get rubber-stamped or rejected on size alone, neither of which is a real review.

### 1.3 Four files where the branches have quietly diverged in architecture
`entries.js`, `nominee-uploads.js`, `test-data-manager.js`, `automation-scheduler.js` all show large, non-conflicting rewrites — meaning git never forced anyone to reconcile them, it just picked whichever side happened to touch which lines. I traced each one back to a documented rationale (CSV-import relocated, geographic-CMS redesign, server-side security hardening, Vercel Cron replacing a scheduler that never ran on serverless). **Those rationales are solid, but no human stakeholder has confirmed "yes, our branch's version should be the one that wins going forward."** That's still an inference from code comments, made by me, in this session.

### 1.4 Did this detour even need to happen?
The actual deliverable from BTA-119 — the 3 skipped tests, the home-link fix, the auth fallback fix — is **already safely committed and pushed on `claude/supabase-cms-setup-test-e6oiza`**, independent of any of this reconciliation work. If the goal was "land those fixes," that goal was met before this whole exercise started. The reconciliation only matters if there's a real, standing intent to catch this branch up with main's parallel public-voting-site work. Worth confirming that intent explicitly before investing more effort here.

### 1.5 Zero live/manual verification
Everything claimed so far is build output + Jest. Nobody has opened a browser and clicked through: the admin SPA loading without console errors, the restored Markets tab (see 1.1), or the public pages that got touched (`payment-success.html`, `payment-cancelled.html`, `home.html`, `nominate.html`, etc.).

### 1.6 Pre-existing, unrelated staleness noticed along the way
`api/_lib/award-categories.js` on `main` is out of sync with its own declared source of truth (`config.js`) — missing the migration-068 category renames. Not caused by this work, not fixed by this work, just sitting there. Worth its own small ticket.

---

## 2. What would make this trustworthy enough to act on

In rough order:

1. ~~**Get an actual decision on `btc-module.js`**~~ — **Done.** Empirically verified unreachable in a live browser (see 1.1), then pruned back out. Fully recoverable from commit `bba140d` if a product owner wants it revisited later.
2. **Do a 15-minute manual pass**: boot the admin SPA, confirm no console errors, click into the Markets tab to resolve 1.1 empirically instead of by CSS-specificity theory, and skim the handful of touched public pages.
3. **Don't merge this branch into `main` as one PR.** Split by what's actually new and reviewable:
   - Security/RLS migrations (091–094) + their tests — small, mechanical, easy to review on their own.
   - BTA audit documentation — zero functional risk, can land anytime.
   - The 24 conflict resolutions (home-link fixes, payload fixes, category-rename sync) — these are genuinely small once isolated from the merge noise.
   - The four architecturally-diverged files (1.3) — pull these into their **own** conversation with whoever owns that part of the product, not a drive-by merge-conflict resolution. This is the one place where "just pick a side" was a judgment call made under time pressure, not a reviewed decision.
4. **Get a second pair of eyes — human, not another AI pass — specifically on the four diverged files**, confirming the architecture each should keep going forward.
5. Only after 1–4: consider a PR into `main`, scoped to whatever subset actually survived the above, with a diff small enough that a reviewer can actually read it.

---

## 3. What I'm *not* uncertain about

To be clear about where the confidence is real, not hedged:
- The 24 git conflicts themselves were resolved correctly and I can show my reasoning for each.
- Migrations 067/068, `middleware.js` + its tests, and the public-voting-layout files came through the merge byte-identical to main or with only clean, intentional additive diffs — verified, not assumed.
- Build and test suite are genuinely green (85/85 suites, 6837/6837 tests) on the pushed branch, re-confirmed after every change.
