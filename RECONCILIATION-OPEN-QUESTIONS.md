# `feature/safe-reconciliation` — Open Questions & Path to a Real Decision

**Status:** Living record. Items 1.1 and 1.3 are now resolved with explicit decisions; the branch has since been split into 4 reviewable PR branches (Section 3). Items 1.2, 1.4, 1.5, 1.6 are still open.

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

### 1.3 Four files where the branches have quietly diverged in architecture — RESOLVED, keeping our branch's versions

> **Decision:** After a dedicated decision-focused review (what each file does, what changed, explicit security/compliance flags separate from stylistic ones), the product owner approved keeping **our branch's version for all four files**: `entries.js`, `nominee-uploads.js`, `test-data-manager.js`, `automation-scheduler.js`.

Summary of why, per file:
- **`entries.js`** — CSV-import logic was relocated to `nominee-uploads.js` (documented in-code), not lost. Low-stakes either way; kept ours for consistency with the other three decisions.
- **`nominee-uploads.js`** — the one genuine trade-off: our branch requires the admin to pick a real area from a dropdown *before* uploading (eliminates area mis-assignment entirely); main's version fuzzy-matches free-text area names from the CSV itself (more convenient for mixed-area files, but a real risk of silently mis-tagging a nominee's geographic area). **Explicitly locked to the strict dropdown-first model, prioritizing data integrity over fuzzy-matching convenience.**
- **`test-data-manager.js`** — ours moved all database logic server-side (`api/_lib/test-data-fixtures.js`), independently verified to enforce both a `super_admin` role check and a non-production-environment check in the real server code (not just a comment). This is a genuine security hardening over main's client-side-only safety model.
- **`automation-scheduler.js`** — main still uses `node-cron`, which cannot reliably run on this app's serverless (Vercel) hosting. Ours uses Vercel's native Cron feature instead — a platform-compatibility fix, not a style preference.

This was the one item in this document that required an actual human decision rather than an AI inference from code comments, and that decision has now been made and recorded.

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
2. **Do a 15-minute manual pass**: boot the admin SPA, confirm no console errors, and skim the handful of touched public pages. *(Still open — the Markets-tab part of this is now moot since 1.1, but the rest hasn't been done.)*
3. ~~**Don't merge this branch into `main` as one PR**~~ — **Done.** Split into 4 reviewable branches; see Section 3 for the full breakdown, file counts, and verified test status of each.
4. ~~**Get a second pair of eyes — human, not another AI pass — specifically on the four diverged files**~~ — **Done.** See the decision recorded in 1.3.
5. Consider a PR into `main` for each of the 4 branches, in the order given in Section 3 — still open, no PRs have been opened yet, only the branches themselves have been pushed.

---

## 3. The 4-branch split (all pushed to `origin`)

`feature/safe-reconciliation`'s 235-file diff against `origin/main` was broken into 4 branches, each created fresh off `origin/main` and populated only with the files belonging to it (not stacked commits), so each branch's diff against `main` is exactly its own scope — nothing more.

| Branch | Files | Contents | Build | Tests (standalone) |
|---|---|---|---|---|
| `pr1/security-infra-migrations` | 21 | Migrations 091–094 + tests, new `api/_lib/` modules (`organisation-matching.js`, `test-data-fixtures.js`, `award-categories.js`), and the 4 files decided in §1.3 (`entries.js`, `nominee-uploads.js`, `test-data-manager.js`, `automation-scheduler.js`) | ✅ clean | ✅ 72/72 suites, 6,461 tests |
| `pr2/documentation` | 54 | All BTA audit series + release/production/ops docs. Zero code touched. | ✅ clean (no code) | N/A |
| `pr3a/public-pages-ui` | 38 | Public-facing HTML pages + their standalone JS (split using `build.js`'s own `PUBLIC_PAGES`/`publicJsFiles` lists as ground truth) — the 24 conflict-resolution fixes that touch public pages, plus the restored `reset-password` flow | ✅ clean | ✅ 75/75 suites, 6,588 tests — **fully independent, no dependency on PR1** |
| `pr3b/admin-app-drift` | 122 | Everything else: admin SPA core modules, API handlers, `src/partials/`, older migrations, remaining tests | ✅ clean | ⚠️ 73/76 suites standalone — 3 known failures (`tests/entry-proxy.test.js`, `tests/data-proxy-user-management.test.js`, `tests/data-proxy.test.js`), because `api/data-proxy.js`/`api/entry-proxy.js` here `require()` modules that live in PR1 |

(The original, unsplit `pr3/application-integration` branch — 160 files, the union of 3a+3b — is still sitting locally as a reference point but isn't meant to be opened as a PR itself.)

### Required merge order

```
PR1 ──────────────┐
                   ├──> PR3b (needs PR1's api/_lib/ modules to build/test green)
PR2 (anytime)      │
PR3a (anytime) ────┘
```

- **PR1 must merge first.** PR3b's `api/data-proxy.js` and `api/entry-proxy.js` import modules that only exist in PR1; PR3b will show 3 failing suites in CI until PR1 is merged (or PR3b is rebased onto a `main` that already has PR1).
- **PR2 and PR3a have no dependencies on anything** and can merge in parallel with PR1 or at any point afterward.
- **This is a testing-correctness ordering, not a merge-conflict one** — PR1 and PR3b touch completely disjoint files, so there's nothing for git to actually conflict over regardless of what order they're merged in. The only consequence of merging out of order is a reviewer seeing red CI on PR3b for a reason that has nothing to do with its actual diff.

---

## 4. What I'm *not* uncertain about

To be clear about where the confidence is real, not hedged:
- The 24 git conflicts themselves were resolved correctly and I can show my reasoning for each.
- Migrations 067/068, `middleware.js` + its tests, and the public-voting-layout files came through the merge byte-identical to main or with only clean, intentional additive diffs — verified, not assumed.
- Build and test suite are genuinely green (85/85 suites, 6837/6837 tests) on the pushed branch, re-confirmed after every change.
