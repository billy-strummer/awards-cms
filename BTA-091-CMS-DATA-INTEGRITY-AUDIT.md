# BTA-091 — CMS Data Integrity and Relationship Audit

**Type:** read-only investigation. No migration, SQL, or application file was modified. No Supabase connection was made — all findings are from static inspection of `migrations/*.sql`, `database-*.sql`, and application source. Any question that genuinely requires live-schema confirmation is marked **Unknown (requires live verification)**.

## Executive summary

The schema's foreign-key coverage for the core award/organisation/entry relationships is reasonably solid and was actively hardened over time (migrations 002, 019, 020, 053 retrofitted FKs the original `migrations/000` setup omitted). The most significant findings are not missing FKs but **places where the application assumes uniqueness or referential integrity that no database constraint actually enforces**: organisation de-duplication during entry/import (TOCTOU race, no UNIQUE constraint), duplicate award-entries per organisation (no UNIQUE constraint — already a known open business decision, now confirmed as a DB-level gap too, not just a UI one), and `award_years.sector` being free text with no link back to the structured `custom_sectors` table. Cascade behaviour is mixed by design (CASCADE for CRM/contact data, SET NULL for `entries`/`winners`) and migration 089's GDPR erasure RPC correctly does NOT rely on cascade alone for `entries` (a hard delete is necessary there since `entries` carries its own copy of personal data independent of the `organisations` row).

## Findings by relationship/entity

### 1. `organisations` ↔ `award_assignments` / `entries` / `winners`

- **Confirmed** (`migrations/000-complete-database-setup.sql:153-221`): `award_assignments.organisation_id` → `ON DELETE CASCADE`; `winners.organisation_id` → `ON DELETE SET NULL`; `entries.organisation_id` → `ON DELETE SET NULL`. This is a real asymmetry: deleting an organisation **removes** its award assignments entirely but **orphans** (nulls the link, keeps the row) its entries and winner records.
- **Confirmed**: `migrations/089-secure-gdpr-erasure-rpc.sql:109-119` explicitly `DELETE`s `award_assignments` and `entries` for the target organisation rather than relying on the FK behaviour above. For `award_assignments` this is **redundant** with the existing `ON DELETE CASCADE` (harmless, just unnecessary). For `entries` it is **necessary and correct**: `entries` carries its own `contact_name`/`contact_email` columns (`migrations/000:200-201`) that are independent personal data, not just a link to the organisation — if the function relied on `SET NULL` alone, these fields would survive erasure. No defect found here; this is a point where the migration's design is more careful than the schema's default behaviour, which is good, not a gap.
- **Confirmed**: `winners` is not in migration 089's delete list at all. This matches the already-documented, deliberately unresolved business decision on `winners.winner_name` retention (tracked since BTA-074 Q.6) — not a new finding, but independently confirmed consistent with that decision rather than an oversight.
- **Confirmed, no DB-level duplicate prevention**: no `UNIQUE` constraint exists anywhere in the migration history on `award_assignments(award_id, organisation_id)` (checked via `grep -n UNIQUE migrations/*.sql` — no match for this pair). This means the already-known "duplicate entry per award" open question (BTA-077) is not just a missing UI/API rule — the database itself would silently accept any number of duplicate assignment rows for the same organisation and award.

### 2. `organisations` duplicate prevention (entry/nomination/import matching)

- **Confirmed**: the single shared matching helper, `api/_lib/organisation-matching.js:38-50` (`findMatchingOrganisation`), performs a `SELECT ... ILIKE company_name ... AND area_id = :areaId LIMIT 1` and returns the match (or `null`) for the caller to then `INSERT` a new row if nothing matched. This is a classic **check-then-act** pattern.
- **Confirmed, no DB-level constraint backs this check**: `organisations` has no `UNIQUE` constraint on `(company_name, area_id)` or any equivalent (checked `migrations/000:108-122` plus every later `ALTER TABLE organisations` statement — none adds one). **Potential defect**: under two concurrent submissions for the same new company in the same area (plausible for a popular/first-day-of-entries scenario), both requests could run the `SELECT`, both see no match, and both `INSERT`, creating two organisation rows for what should be one. This is not hypothetical paranoia — it is the textbook failure mode of check-then-act without a unique constraint or `INSERT ... ON CONFLICT`. Classified **Potential** (not Confirmed as a reproduced bug) since it requires genuine concurrency to manifest, but the absence of any constraint that would prevent it is Confirmed.
- `area_id` itself is a proper FK (`migrations/068-add-area-id-to-awards-and-orgs.sql:18`: `organisations.area_id UUID REFERENCES areas(id)`, indexed) — this part of the relationship is solid.

### 3. `award_years`/`awards` ↔ sectors and categories — free text vs. structured FK

- **Confirmed**: `award_years.sector` is a plain `TEXT` column (`migrations/000:20`: `ALTER TABLE award_years ADD COLUMN IF NOT EXISTS sector TEXT;`) — no foreign key to any sector table.
- **Confirmed**: `custom_sectors`/`custom_categories` (`migrations/058-missing-tables-and-columns.sql:143-158`) are a separate, properly-structured pair of tables — `custom_sectors.name TEXT NOT NULL UNIQUE`, `custom_categories.sector_id UUID REFERENCES custom_sectors(id) ON DELETE SET NULL`. These two tables are internally consistent with each other.
- **Confirmed gap**: there is no FK linking `award_years.sector` (free text) to `custom_sectors.id`/`custom_sectors.name`. If an admin renames a custom sector, any `award_years` row whose `sector` text matches the old name has no mechanism — trigger, FK, or application code discovered during this pass — to stay in sync. This is exactly the "free-text vs. stable foreign-key" drift risk the audit was asked to check for, confirmed present for sector (not checked exhaustively for every other free-text field in the schema; category linkage to awards was not traced to the same depth and should be treated as **Unknown** pending a dedicated pass).

### 4. `award_years`/`awards` view/trigger parity (068/069)

- **Confirmed, spot-checked only, consistent with BTA-077's prior full verification**: `migrations/069-refresh-awards-view.sql`'s `awards_insert_fn`/`awards_update_fn` instead-of triggers were re-opened and still list the same ~20 columns previously verified; no new column has been added to `award_years` by any migration numbered higher than 069 that isn't also in these trigger functions (checked via `grep -c "ALTER TABLE award_years ADD COLUMN"` across migrations 070–093 — zero hits). **Confirmed**: no regression of the view-silently-drops-newer-columns bug has crept back in.

### 5. `area_id` relationships (awards, organisations)

- **Confirmed**: `migrations/068-add-area-id-to-awards-and-orgs.sql` adds `area_id UUID REFERENCES areas(id)` to both `organisations` and (per its filename and header) `award_years`/awards-adjacent tables — spot-checked for `organisations` only this pass; the awards side was not re-verified independently here since BTA-077's fork investigation already covered it directly (`awards.js:1907-1931`'s field list matching the view/trigger columns) and no new evidence contradicts that.

### 6. Entries vs. nominations vs. industry-leader submissions — terminology check

- **Confirmed**: there is no separate "nomination" database table distinct from `entries`. `nominate.js` and `industry-leader.js` both ultimately submit into the same `entries` table via `api/entry-proxy.js` (confirmed by BTA-077's fork investigation tracing `handleSubmitNomination`, not re-traced line-by-line this pass since no new evidence suggests this has changed). "Nomination" in this codebase is a submission-flow/UI distinction (a different form, different `request_type`-equivalent framing), not a distinct data model or "pre-nomination candidate research" concept — no such concept (a separate research/shortlist-before-nomination stage) was found anywhere in the schema or the two form-handling files. This preserves the distinction asked for by noting there is no additional hidden layer to preserve — entries and nominations share one underlying table by design, not by oversight.

### 7. CRM tables (`communications`/`deals`/`meeting_notes`)

- **Confirmed**: all three have `organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE` (`database-crm-setup.sql`, lines consistent with the FK grep above) — correctly cascade on organisation deletion, consistent with migration 089 also explicitly deleting them (redundant-but-harmless, same pattern as `award_assignments`).

### 8. `sponsorship_catalogue_packages` (migration 091)

- **Confirmed**: standalone table, no FK to any other table (`migrations/091-sponsorship-catalogue-packages.sql:50-85` — `id`, `name`, `price`, `benefits` JSONB, no foreign keys at all). No relationship-integrity concern applies since it has no relationships yet.

### 9. Identifier consistency

- **Confirmed**: every core table inspected this pass (`organisations`, `organisation_contacts`, `award_assignments`, `winners`, `entries`, `award_years`, `custom_sectors`, `custom_categories`, `sponsorship_catalogue_packages`) uses `UUID DEFAULT gen_random_uuid() PRIMARY KEY` consistently — no mixed integer/UUID primary-key scheme found in the tables checked. `award_years.year` is a plain `INTEGER`, used as a business-logic year rather than an identifier, which is appropriate and not a defect.

## Prioritised issues list (reporting only — not fixed)

1. **Potential** — No DB-level unique constraint backs `findMatchingOrganisation`'s duplicate-prevention logic (`organisations(company_name, area_id)`); concurrent submissions could create duplicate organisation rows. A unique index (possibly on a normalised/lower-cased expression to match the existing `ILIKE` comparison) plus `ON CONFLICT DO NOTHING`/`DO UPDATE` handling would close this, but that is an implementation decision for a future task, not made here.
2. **Confirmed** — No unique constraint on `award_assignments(award_id, organisation_id)`. This reinforces (does not newly discover) the open business decision already tracked since BTA-077 on whether duplicate entries per award/organisation should be prevented — now with DB-level confirmation that nothing currently stops it even if a business rule were to be decided and only enforced in application code.
3. **Confirmed** — `award_years.sector` is untethered free text relative to the structured `custom_sectors`/`custom_categories` tables. Whether this should be migrated to a proper FK is a taxonomy-architecture decision outside this audit's authority to make.
4. **Unknown (requires live verification)** — whether any of the above has already caused real duplicate organisation or duplicate assignment rows in the live production data; this audit is schema/code-level only and did not and could not inspect live row data.

---
*Report written by a BTA-091 investigation fork as part of the BTA-084–093 autonomous work programme. No files other than this report were created or modified.*
