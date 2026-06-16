# Certificate Generation — Implementation Notes

## Current state

`winner-certificate.html` is a self-contained, print-ready A4 landscape certificate.
It accepts URL parameters and requires no backend connection to render.

```
/winner-certificate.html?company=Smith+%26+Sons+Electrical&award=Electrical+Contractor+of+the+Year&year=2026&date=16+June+2026
```

| Param | Required | Description |
|---|---|---|
| `company` | Yes | Company or individual winner name |
| `award` | Yes | Award category name |
| `year` | No (defaults to 2026) | Ceremony year |
| `date` | No (defaults to today) | Date shown on the signature line |

---

## What needs to happen when wiring to the backend

### 1. Data source

The `winners` table already holds the data needed. The relevant fields are:

| DB field | Maps to param |
|---|---|
| `company_name` or `organisation_name` | `company` |
| `awards.award_name` or `awards.award_category` | `award` |
| `awards.year` | `year` |
| `created_at` or a custom `awarded_date` | `date` |

The existing `substitutePlaceholders()` function in `api/certificates-qr.js` already extracts exactly these fields — reuse that logic.

### 2. Entry point options (pick one when the time comes)

**Option A — Link per winner (simplest)**
In the Winners tab of the admin CMS (`index.html`), add a "Certificate" action button next to each winner row. It builds the URL and opens the certificate in a new tab for printing/saving.

```js
// Inside the winners table row actions:
const url = `/winner-certificate.html?${new URLSearchParams({
  company: winner.company_name,
  award:   winner.awards?.award_name,
  year:    winner.awards?.year,
  date:    new Date(winner.created_at).toLocaleDateString('en-GB', {
             day: 'numeric', month: 'long', year: 'numeric'
           }),
})}`;
window.open(url, '_blank');
```

No API changes needed. Zero extra infrastructure.

**Option B — Bulk generation via data-proxy action**
Add a `generate_certificates` action to `data-proxy.js` that returns a list of certificate URLs for all winners in a given award/year. The admin can then open them all at once or trigger a bulk PDF save.

**Option C — Server-side PDF (future)**
`api/certificates-qr.js` already has PDF generation via `pdf-lib`. If a pixel-perfect, non-browser PDF is ever needed, extend that file with a new `action: 'html_certificate'` that headlessly renders the HTML (e.g. via Puppeteer) and returns a PDF blob. This is more infrastructure than is needed right now.

### 3. Recommended approach

**Start with Option A.** It requires no backend changes, works today, and covers 99% of the use case (admin prints one certificate at a time). Move to Option B only if bulk generation becomes a real workflow need.

---

## Things to decide when implementing

- **Who signs?** The signature lines currently say "Chief Executive" and "Head of Ceremonies" — confirm the real names/titles to hardcode or make configurable.
- **Round seal** — currently decorative/faded. Replace with an actual logo or embossed seal graphic if one exists.
- **Logo on print** — the BTA logo loads from a relative path. In production (Vercel), verify the `images/` directory is served at the same origin as the certificate page.
- **Batch PDF** — if the awards team wants to email certificates to winners directly, Option C (Puppeteer + pdf-lib) would handle that from a single API call. Flag this when the post-event email workflow is being built.

---

## Files involved

| File | Role |
|---|---|
| `winner-certificate.html` | The certificate itself — edit design here |
| `api/certificates-qr.js` | Existing PDF/QR backend — extend for server-side PDF if needed |
| `index.html` | Winners tab — add the "Certificate" button here (Option A) |
| `api/data-proxy.js` | Add bulk action here if Option B is chosen |
