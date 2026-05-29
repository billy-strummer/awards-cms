# UX & Workflows Audit — 2026-05-29

## Summary

Audited 20+ source files across the British Trade Awards CMS covering 10 UX/workflow areas:
empty states, loading states, error feedback, form validation, confirmation dialogs, bulk action UX,
workflow completeness, navigation/breadcrumbs, responsive/mobile, and accessibility.

**Total issues found: 16**
- Critical: 1
- High: 6
- Medium: 6
- Low: 5 (including 2 sub-items merged)

---

## CRITICAL

### UX2-C1 — No mobile hamburger button: sidebar is permanently inaccessible on mobile

**File:** `app.js` line 2342 / `index.html` (navbar section, ~line 106) / `styles.css` line 4061
**Area:** Responsive / Mobile navigation

**Description:**
`app.js` line 2342 calls `document.getElementById('mobileSidebarToggle')?.addEventListener(...)` but no
element with that ID exists anywhere in `index.html`. On screens narrower than 992px the sidebar is
hidden with `transform: translateX(-100%)` (styles.css:4047–4063) and the only way to reveal it is the
`.mobile-open` class — which is only toggled by `mobileSidebarToggle`. Because the button was never
added to the HTML, mobile users have no way to open the navigation sidebar at all.
The CSS comment at `styles.css:4061` even reads "replaced by hamburger in navbar on mobile" confirming
the button was intentional but never implemented.

**Suggested fix:**
Add a hamburger button to the navbar in `index.html` (inside the `<nav>` element, before the brand/logo):
```html
<button id="mobileSidebarToggle"
        class="btn btn-outline-light d-lg-none me-2"
        aria-label="Open navigation menu"
        aria-expanded="false">
  <i class="bi bi-list fs-5"></i>
</button>
```
The existing `app.js` handler (lines 2340–2354) will wire up automatically once the element exists.

---

## HIGH

### UX2-H1 — "not_shortlisted" status applied by bulk reject but absent from the entry state machine

**File:** `entries.js` lines 5–18 (state machine) and line 725 (bulk reject)
**Area:** Workflow completeness / Entry status lifecycle

**Description:**
`ENTRY_VALID_TRANSITIONS` (lines 5–18) defines the allowed status flow: draft → submitted →
under_review → shortlisted → winner / rejected. The string `"not_shortlisted"` does not appear in this
object. However, the bulk "Reject" dropdown option (line 725) sets `status = 'not_shortlisted'` for all
selected entries. Once saved, those entries have a status outside the state machine, so
`inlineUpdateEntryStatus()` cannot transition them anywhere — the dropdown shows as invalid or stale and
the entry is effectively orphaned.

**Suggested fix:**
Either (a) add `not_shortlisted` to the state machine with valid outgoing transitions, e.g.:
```js
not_shortlisted: ['rejected', 'under_review'],
```
or (b) change the bulk reject action to set `status = 'rejected'` and remove `not_shortlisted` from the
codebase entirely.

---

### UX2-H2 — Inline status dropdowns change records immediately without confirmation

**File:** `awards.js` line 828 / `entries.js` line 411
**Area:** Confirmation dialogs / Destructive action safety

**Description:**
Both the awards table and entries table render an inline `<select>` for status. On `change`, they
immediately call `inlineUpdateStatus()` / `inlineUpdateEntryStatus()` with no confirmation step. A single
accidental click can move an award to "archived" or an entry to "winner" or "rejected". This is
especially risky in entries where the state machine makes reversal non-trivial.

**Suggested fix:**
Wrap the update call in `utils.confirmDialog()`:
```js
selectEl.addEventListener('change', async function () {
  const newStatus = this.value;
  const confirmed = await utils.confirmDialog(
    'Change Status',
    `Change status to "${newStatus}"?`,
    'Change'
  );
  if (!confirmed) { this.value = previousValue; return; }
  await module.inlineUpdateStatus(id, newStatus);
});
```
Store the previous value on `focus` so it can be restored on cancel.

---

### UX2-H3 — "Select All" only selects visible page with no indication that other pages exist

**File:** `organisations.js` line 3075 / `entries.js` line 751
**Area:** Bulk action UX / Server-side pagination

**Description:**
`orgsModule.toggleSelectAll()` iterates `STATE.filteredOrganisations` and `entriesModule.toggleSelectAll()`
iterates `this.filteredEntries`. With server-side pagination active, both arrays contain only the current
page (typically 50 records). The bulk actions toolbar updates to show "X selected" with no indication that
other pages exist. A user who checks "Select All" to delete or export expects all records — not just the
visible page.

**Suggested fix:**
After selecting all visible rows, show an inline notice in the bulk toolbar:
```
50 items on this page selected. [Select all 234 items]
```
Clicking the link sets a `_selectAllPages` flag that the bulk action handler reads to run the operation
across all pages (server-side loop), or at minimum warns the user that only the current page is affected.

---

### UX2-H4 — CRM module shows no loading state while fetching data

**File:** `crm.js` line 50 (`loadAllData`)
**Area:** Loading states

**Description:**
`loadAllData()` fires four parallel Supabase queries but calls neither `utils.showLoading()` nor
`utils.showSkeletonLoading()`. On a slow connection the Companies, Communications, Deals, and Meetings
tables remain blank until the fetch resolves. There is no visual feedback that data is loading.

**Suggested fix:**
Add skeleton loading to each sub-table before the fetch, then clear it in the finally block:
```js
utils.showSkeletonLoading('crmCompaniesTableBody', 8);
utils.showSkeletonLoading('crmCommunicationsTableBody', 8);
// … same for deals and meetings
try {
  const [companies, comms, deals, meetings] = await Promise.all([…]);
  renderCompaniesTable(companies);
  // …
} finally {
  // skeleton replaced by render calls above
}
```

---

### UX2-H5 — Email Lists module shows no loading state while fetching

**File:** `email-lists.js` line 89 (`loadEmailLists`)
**Area:** Loading states

**Description:**
`loadEmailLists()` fetches list data with no loading indicator. The card grid is blank until the async
call resolves. Combined with the non-enhanced empty state (see UX2-L2), first-load experience appears
broken.

**Suggested fix:**
Add `utils.showLoading()` before the fetch and `utils.hideLoading()` in the finally block. Optionally
render skeleton cards (e.g., two placeholder `.card` elements with shimmer) while loading.

---

### UX2-H6 — Judge Portal shows no loading state while fetching assigned entries

**File:** `judge-portal.js` line 291 (`loadAssignedEntries`)
**Area:** Loading states / Judge Portal workflow

**Description:**
`loadAssignedEntries()` performs an async fetch but shows no spinner or skeleton. Judges on a slow
network see a blank list until data arrives, with no indication the app is working.

**Suggested fix:**
Add a simple spinner inside the entries list container before the fetch:
```js
document.getElementById('judgeEntriesList').innerHTML =
  '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';
```
Replace with `renderEntriesList()` results in the finally block.

---

## MEDIUM

### UX2-M1 — Submit-entry wizard shows validation errors as toasts, not inline field errors

**File:** `submit-entry.js` line 625 (`validateStep`)
**Area:** Form validation / Entry submission workflow

**Description:**
`validateStep()` calls `showPublicToast()` for validation failures (e.g. "Please fill in all required
fields"). The toast appears briefly in the top-right corner and the invalid field receives no visual
highlight. Users must close the toast and manually hunt for the missing field, which is particularly
frustrating across the 8-step wizard.

**Suggested fix:**
Mark invalid fields with Bootstrap's `is-invalid` class and insert an `.invalid-feedback` sibling:
```js
function markInvalid(input, message) {
  input.classList.add('is-invalid');
  let fb = input.nextElementSibling;
  if (!fb || !fb.classList.contains('invalid-feedback')) {
    fb = document.createElement('div');
    fb.className = 'invalid-feedback';
    input.parentNode.insertBefore(fb, input.nextSibling);
  }
  fb.textContent = message;
}
```
Scroll the first invalid field into view. Clear `is-invalid` on the next `input` event.

---

### UX2-M2 — Four Bootstrap modals missing `aria-labelledby`

**File:** `index.html` lines 7519, 7582, 8339, 11671
**Area:** Accessibility

**Description:**
The following modals have no `aria-labelledby` attribute, so screen readers cannot announce the modal
title when it opens:
- Line 7519: `#webhookFormModal`
- Line 7582: `#seasonFormModal`
- Line 8339: `#addCompanyModal`
- Line 11671: `#addSectorModal`

**Suggested fix:**
For each modal, add `aria-labelledby="[titleId]"` to the `.modal` element and add a matching `id` to
the `<h5 class="modal-title">` inside it. Example:
```html
<div class="modal fade" id="webhookFormModal" tabindex="-1"
     aria-labelledby="webhookFormModalLabel" aria-hidden="true">
  …
  <h5 class="modal-title" id="webhookFormModalLabel">Webhook</h5>
```

---

### UX2-M3 — Winner Announcements wizard modal created dynamically without `aria-labelledby`

**File:** `winner-announcements.js` lines 55–67 (`openAnnouncementWizard`)
**Area:** Accessibility

**Description:**
The wizard modal is built via `innerHTML` string. The `.modal` element has `tabindex="-1"` but no
`aria-labelledby`, so the modal title (`<h5 class="modal-title">`) is not programmatically associated
with the dialog. Screen readers announce "dialog" with no title context.

**Suggested fix:**
Add `aria-labelledby="annWizTitle"` to the modal element and `id="annWizTitle"` to the `<h5>` in the
template string:
```js
modalEl.setAttribute('aria-labelledby', 'annWizTitle');
// inside innerHTML:
`<h5 class="modal-title" id="annWizTitle">Announce Winners</h5>`
```

---

### UX2-M4 — Seven progress bars missing required ARIA value attributes

**File:** `index.html` lines 8221, 8447, 8784, 9223, 9527, 9712, 11361
**Area:** Accessibility

**Description:**
Each of these elements has `role="progressbar"` but is missing `aria-valuemin`, `aria-valuemax`, and
`aria-valuenow`. Per WAI-ARIA spec all three are required for the progressbar role; without them
assistive technologies cannot convey progress to the user.

**Suggested fix:**
Add the three attributes to every progress bar element:
```html
<div class="progress-bar" role="progressbar"
     aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"
     style="width: 0%">
```
Update `aria-valuenow` programmatically whenever the width is updated.

---

### UX2-M5 — Entries filter bar labels not associated with their inputs

**File:** `index.html` lines 2652, 2658, 2664, 2672
**Area:** Accessibility / Form labels

**Description:**
The four filter controls in the entries panel (Award Category, Year, Nomination Source, Search) have
`<label>` elements but none has a `for=` attribute pointing to the corresponding input/select. Clicking
a label does not focus its control; screen readers cannot associate the label text with the input.

**Suggested fix:**
Add `for` attributes matching existing input IDs (confirm IDs in HTML and align):
```html
<label for="entriesAwardFilter">Award Category</label>
<label for="entriesYearFilter">Year</label>
<label for="entriesSelfNomFilter">Nomination Source</label>
<label for="entriesSearchInput">Search</label>
```

---

### UX2-M6 — Email Builder and Social Media form labels missing `for=` attributes

**File:** `index.html` lines 4836, 5199, 5204 (approximately)
**Area:** Accessibility / Form labels

**Description:**
Several labels in the Email Builder template editor and Social Media post composer are not associated
with their inputs via `for=`. This breaks click-to-focus and screen reader label announcement for those
controls.

**Suggested fix:**
Audit all `<label>` elements in the email builder section (`#emailBuilderTab`) and social media section
(`#socialMediaTab`) and add `for="[inputId]"` where missing, creating `id` attributes on inputs that
lack them.

---

## LOW

### UX2-L1 — Media Gallery modal form labels missing `for=` attributes (7 labels)

**File:** `index.html` lines 3111, 3130, 3149, 3181, 3189, 3199, 3234
**Area:** Accessibility / Form labels

**Description:**
Inside `#mediaUploadModal` / `#mediaEditModal`, the following labels have no `for=` attribute:
"Company Tags", "Award Tags", "Event", "YouTube URLs", "Organisation", "Award", "YouTube Playlist URL".
This is low severity as the inputs are usually adjacent, but it is still an accessibility gap.

**Suggested fix:**
Ensure each label has `for="[inputId]"` and each input has a matching `id`.

---

### UX2-L2 — Email Lists empty state uses plain alert div instead of enhanced empty state

**File:** `email-lists.js` line 159 (`renderEmailLists`)
**Area:** Empty states / Visual consistency

**Description:**
When no email lists exist, `renderEmailLists()` inserts a plain Bootstrap `alert-info` div with text.
Every other module (awards, entries, organisations, CRM, etc.) uses `utils.showEnhancedEmptyState()` with
an icon, heading, description, and CTA button. The inconsistency looks unpolished.

**Suggested fix:**
Replace the alert div with:
```js
utils.showEnhancedEmptyState('emailListsGrid', {
  icon: 'bi-envelope-plus',
  message: 'No email lists yet',
  description: 'Create your first list to start segmenting your audience.',
  actionLabel: 'Create List',
  actionFn: () => emailListsModule.openCreateListModal(),
});
```

---

### UX2-L3 — Reporting module scheduled-reports section uses plain text for empty state

**File:** `app.js` lines 62–108 (`reportsScheduler.loadReports`)
**Area:** Empty states / Visual consistency

**Description:**
When no scheduled reports exist, the section renders a small icon and minimal text. It does not offer
a prominent CTA to create the first scheduled report, unlike the pattern used elsewhere.

**Suggested fix:**
Use `utils.showEnhancedEmptyState()` with a "Create your first scheduled report" action button.

---

### UX2-L4 — No breadcrumb navigation in any admin section (except Media Gallery)

**File:** `index.html` — only `#mediaGalleryBreadcrumb` (line ~2871) exists
**Area:** Navigation / Breadcrumbs

**Description:**
The Media Gallery is the only section with a breadcrumb trail. Other deeply-nested workflows (e.g.
Entry → View → Score → Status change) rely solely on modal context titles. While modals do provide some
context, long workflows inside panels (not modals) would benefit from breadcrumbs for orientation.

**Suggested fix:**
For panel-based sub-views (e.g. entry detail view, organisation profile, event detail) add a simple
Bootstrap breadcrumb:
```html
<nav aria-label="breadcrumb">
  <ol class="breadcrumb">
    <li class="breadcrumb-item"><a href="#" data-action="backToEntries">Entries</a></li>
    <li class="breadcrumb-item active">Entry #BTA-2025-0042</li>
  </ol>
</nav>
```
Low priority as modals already handle most nested interactions.

---

### UX2-L5 — submit-entry.js uses optional-chained `utils?.showToast?.()` risking silent failures

**File:** `submit-entry.js` line 230
**Area:** Error feedback / Public-facing page robustness

**Description:**
`utils?.showToast?.('Draft restored', 'success')` uses optional chaining defensively, but if `utils`
is not loaded (e.g. script load failure), the success feedback silently disappears with no fallback.
Since this is a public-facing page used by entrants, silent feedback loss is a worse experience than
a degraded fallback.

**Suggested fix:**
Add a graceful fallback:
```js
if (window.utils?.showToast) {
  utils.showToast('Draft restored from autosave', 'success');
} else {
  // Fallback: brief inline banner
  const notice = document.createElement('div');
  notice.className = 'alert alert-success alert-dismissible';
  notice.textContent = 'Draft restored from autosave.';
  document.querySelector('.entry-wizard')?.prepend(notice);
}
```

---

## Appendix — Files Audited

| File | Lines examined |
|---|---|
| `app.js` | 1–2500 |
| `index.html` | ~100–12000 (all sections) |
| `styles.css` | 4026–4063 (sidebar/responsive) |
| `global-actions.js` | full |
| `utils.js` | 308, 1778, 1810, 2639 |
| `awards.js` | 828, 3518 |
| `entries.js` | 5–18, 410–415, 725, 751, 810, 2760 |
| `organisations.js` | 3075, 3100, 3633, 3686 |
| `crm.js` | 50, 219, 411, 613, 774 |
| `email-lists.js` | 89, 159 |
| `judge-portal.js` | 291, 306 |
| `submit-entry.js` | 230, 625 |
| `payments.js` | 143, 965, 1721 |
| `winner-announcements.js` | 43–67 |
