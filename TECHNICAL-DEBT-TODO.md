# Technical Improvements — Systematic Work Plan

**CLAUDE: Read this file at the start of any session focused on technical improvements (architecture, missing features, code quality). Work through items in order. Mark each item `[x]` in the same commit as the implementation. Never mark complete unless committed and pushed.**

Branch: `claude/bta-location-restructure-JS5hX`
Last updated: 2026-05-14 (Phase 1 complete — all partials extracted)

---

## Why this matters

The CMS is functionally complete at a surface level but has three categories of weakness that a production-grade system at this scale should not have:

1. **Architecture**: The entire 11,000+ line admin UI lives in one `index.html`. At this scale, a professional codebase separates sections into composable partials assembled at build time. A merge conflict in this file between two developers would be catastrophic, and finding anything takes scrolling through thousands of lines.

2. **Missing feature implementations**: Several tabs and sections exist in the UI with real, meaningful HTML shells but the JavaScript behind them is either a stub, a placeholder comment, or entirely absent. These are gaps in the product — a paying client who opens the Post-Event tab, the Ticket Issuance section, or the Milestones tab gets nothing.

3. **Code quality at scale**: Vanilla JS without any type annotations means bugs that a typed language catches at write-time only surface at runtime. With 30+ modules this is real maintenance debt.

---

## PHASE 1 — HTML Architecture Refactor

**Goal:** Break `index.html` into composable partials. The build output must be byte-for-byte functionally identical. No UI changes, no behaviour changes — purely structural.

**Why first:** Every subsequent change is easier to make in a 300-line file than a 11,000-line one. This also makes code review meaningful.

**Risk level:** Medium — careful build step change, but fully testable (65 test suites must still pass, build must still work).

---

### T1-A — Create partials build system
- **What:** Create `src/partials/` directory. Update `build.js` to read a manifest of partial HTML files and concatenate them (in order) to produce `dist/index.html`. The concatenation must preserve all `<!-- section comments -->`, IDs, and whitespace in the correct positions.
- **Done when:** `npm run build` produces an identical `index.html` to the current one, and all 65 tests pass.
- [x] Implemented

### T1-B — Extract: Navigation & shell
- **What:** Extract the outer shell — `<head>`, nav sidebar, top bar, and closing scripts — into `src/partials/00-shell-head.html` and `src/partials/99-shell-foot.html`.
- **Done when:** Build output unchanged, tests pass.
- [x] Implemented

### T1-C — Extract: Dashboard
- **What:** Extract the Dashboard section into `src/partials/01-dashboard.html`.
- **Done when:** Build output unchanged, tests pass.
- [x] Implemented

### T1-D — Extract: Awards
- **What:** Extract Awards section + Add Award modal into `src/partials/02-awards.html`.
- **Done when:** Build output unchanged, tests pass.
- [x] Implemented

### T1-E — Extract: Organisations
- **What:** Extract Organisations section + all related modals into `src/partials/03-organisations.html`.
- **Done when:** Build output unchanged, tests pass.
- [x] Implemented

### T1-F — Extract: Winners + Entries
- **What:** Extract Winners and Entries sections into `src/partials/04-winners.html` and `src/partials/05-entries.html`.
- **Done when:** Build output unchanged, tests pass.
- [x] Implemented

### T1-G — Extract: Events + Media Gallery
- **What:** Extract Events section and Media Gallery into `src/partials/06-events.html` and `src/partials/07-media.html`.
- **Done when:** Build output unchanged, tests pass.
- [x] Implemented

### T1-H — Extract: CRM + Payments + Reports
- **What:** Extract CRM, Payments, and Reports sections into `src/partials/08-crm.html`, `src/partials/09-payments.html`, `src/partials/10-reports.html`.
- **Done when:** Build output unchanged, tests pass.
- [x] Implemented

### T1-I — Extract: Email + Marketing + Social Media
- **What:** Extract Email Builder/Lists/Templates, Marketing, and Social Media into `src/partials/11-email.html`, `src/partials/12-marketing.html`.
- **Done when:** Build output unchanged, tests pass.
- [x] Implemented

### T1-J — Extract: Settings + all remaining modals
- **What:** Extract Settings section and all shared/global modals into `src/partials/13-settings.html` and `src/partials/14-modals-shared.html`.
- **Done when:** `index.html` is gone from root (replaced by partials), build output is identical, all 65 tests pass.
- [x] Implemented

---

## PHASE 2 — Missing Feature Implementations

**Goal:** Each tab/section that currently shows a blank JS-placeholder gets a real, working implementation.

**Risk level:** Medium-High — new database queries and business logic. Each item must be tested end-to-end.

**Important:** Each item below is a separate commit. Do not bundle them.

---

### T2-A — Post-Event tab: attendance + budget summary
- **What:** After the event date passes, the Post-Event tab should display:
  1. Attendance report: checked-in count, registered count, capacity, no-show count, check-in rate %.
  2. Budget summary: total budget, estimated costs, actual costs, variance, profit margin.
  3. Quick-access button to each of the other 8 tabs for post-event review.
- **Data sources:** Existing `events`, `attendees`, `event_budget_items` Supabase tables via data-proxy.js.
- **No new API files** — add a new `action` to `data-proxy.js`.
- **Done when:** Opening Post-Event tab on a past event shows real numbers from the database. Empty state shown for future events.
- [x] Implemented

### T2-B — Ticket Issuance system
- **What:** The Ticket Issuance section in the Tickets tab should:
  1. List all attendees with RSVP=Attending and show whether a ticket has been issued (yes/no/date).
  2. "Issue Ticket" button per row: generates a unique QR code (using existing `certificates-qr.js`) and emails it via Resend with a ticket template.
  3. "Issue All" bulk button with a confirmation: "Send tickets to X confirmed attendees?"
  4. Track issued status in Supabase (`ticket_issued_at` timestamp on attendee record or separate `tickets` table).
- **Done when:** Clicking Issue Ticket sends a real email with a QR code attachment to that attendee's email address.
- [x] Implemented

### T2-C — Milestones tab
- **What:** Implement a real milestone/checklist system for events:
  1. Pre-populate new events with 8 standard milestones (Confirm venue, Set ticket price, Share registration link, Confirm catering, Issue QR tickets, Send final attendee list, Brief door staff, Post-event debrief).
  2. Each milestone has: title, due date (relative to event date), status (pending/complete), optional notes.
  3. Checkboxes mark milestones complete. Progress bar shows X/8 complete.
  4. "Add Custom Milestone" button for non-standard tasks.
  5. Store per-event milestones in Supabase.
- **Done when:** Opening Milestones tab on any event shows the pre-populated checklist. Checking items saves to database. Progress bar updates in real time.
- [x] Implemented

### T2-D — Audit social media posting end-to-end
- **What:** Audit every platform's post action in `social-media-api.js`:
  1. For each platform (X/Twitter, Facebook, LinkedIn, Instagram), trace the code path from the "Post Now" button to the API response.
  2. Identify which are real API calls vs stubs/mock responses.
  3. For any that return mock/hardcoded success, implement the real API call using the platform env vars.
  4. Add proper error handling: if a platform returns an error, show the error message in the UI (not just a generic failure).
  5. Document which platforms require credentials not yet in Vercel (see CLAUDE.md env var table).
- **Done when:** Posting to any connected platform makes a real API call. Disconnected platforms show a clear "credentials not configured" message rather than silently failing.
- [x] Implemented

### T2-E — Auto-segments: verify and complete rule evaluation
- **What:** Audit the Auto-Segments feature in the CRM tab:
  1. Trace each rule type (Tier, Sector, Region, Invoice Status, Engagement Score, etc.) from the front-end rule builder to the database query.
  2. Identify any rules that are front-end only (filter client-side data) vs properly queried server-side.
  3. For any client-side-only rules, implement a proper server-side query via data-proxy.js.
  4. The "Apply Segment" button must show a count + preview list of matching organisations.
  5. "Save Segment" must persist the rules to Supabase so they survive page refresh.
- **Done when:** All rule types query the database correctly. Saved segments reload on next session. Preview shows real matching organisations.
- [ ] Implemented

### T2-F — Special Requirements: aggregate from attendees
- **What:** The Special Requirements tab currently shows a blank placeholder. Implement it:
  1. Query all attendees for this event who have dietary notes, accessibility notes, or special requirements in their Notes field.
  2. Display a summary grouped by requirement type: Dietary (count + list), Accessibility (count + list), Other (count + list).
  3. Show a "No special requirements recorded" empty state if none exist.
  4. Add an "Export Requirements" button that downloads a CSV for the catering/venue team.
- **Done when:** Opening Special Reqs on an event with attendees who have notes shows those requirements grouped and summarised.
- [ ] Implemented

---

## PHASE 3 — Code Quality

**Goal:** Add type safety without a full TypeScript migration. Catch bugs at write-time rather than runtime.

**Risk level:** Low — JSDoc annotations are comments; they don't change runtime behaviour. TypeScript checking (`--checkJs`) is a dev-only tool.

---

### T3-A — Add JSDoc type annotations to all modules
- **What:** Add `@param`, `@returns`, and `@typedef` JSDoc annotations to every exported function in every `.js` module. Focus first on the API boundary functions (anything called by `app.js` or another module).
- **Priority order:** `config.js`, `app.js`, `auth.js`, `rbac.js`, then all feature modules alphabetically.
- **Done when:** Every exported function has complete JSDoc. Running `npx tsc --checkJs --noEmit --allowJs --target ES2020` reports 0 errors.
- [ ] Implemented

### T3-B — Add tsconfig.json for checkJs mode
- **What:** Add a `tsconfig.json` configured for JavaScript checking mode (not TypeScript compilation):
  ```json
  {
    "compilerOptions": {
      "checkJs": true,
      "noEmit": true,
      "allowJs": true,
      "target": "ES2020",
      "moduleResolution": "node",
      "strict": false,
      "noImplicitAny": false
    },
    "include": ["*.js", "api/**/*.js"]
  }
  ```
- Add `"typecheck": "tsc --noEmit"` to `package.json` scripts.
- **Done when:** `npm run typecheck` runs cleanly with 0 errors after T3-A is complete.
- [ ] Implemented

### T3-C — Fix any type errors surfaced by checkJs
- **What:** After T3-A and T3-B, run `npm run typecheck` and fix every error found. Common issues to expect: wrong argument count, undefined properties accessed without null checks, incorrect return types.
- **Done when:** `npm run typecheck` → 0 errors. All 65 test suites still pass.
- [ ] Implemented

---

## Implementation Order

Work through phases in order. Within each phase, work through items in alphabetical order (T1-A before T1-B, etc.).

**Start of every session:**
1. Read this file
2. Find the first `[ ]` item
3. Implement it
4. Mark it `[x]`
5. Run `npm test` and `npm run build` — both must pass before committing
6. Commit with a clear message referencing the item (e.g. "T1-C: Extract Dashboard section to src/partials/01-dashboard.html")
7. Push and create/update PR

**If cut off mid-session:**
The next session reads this file, finds the first incomplete `[ ]` item, and picks up from there. The commit history will show exactly what was last completed.

---

## Expected outcomes

| Phase | Outcome |
|---|---|
| Phase 1 (Partials) | `index.html` shrinks to a build artifact. Each section is a maintainable 200–500 line file. PRs become reviewable. |
| Phase 2 (Features) | Post-Event, Tickets, Milestones, Special Reqs, Social Media, and Auto-Segments become genuinely functional. The CMS has no meaningful placeholder content. |
| Phase 3 (Types) | Runtime type bugs surface at write-time in the IDE. New code written against the codebase is safer. |

**Combined result:** The CMS moves from "functionally complete prototype" to "production-grade system" — the gap a client or investor would notice.
