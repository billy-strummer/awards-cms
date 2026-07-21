-- ============================================================
-- Migration 076: Indexes for the Award Areas import + public voting hot paths
-- ============================================================
-- Found during the release-candidate audit while verifying these exact
-- code paths against a live Somerset import. Both are invisible at
-- Somerset's current scale (~500 rows) but become real sequential-scan
-- costs once all 118 county workbooks are imported (tens of thousands
-- of rows):
--
-- 1. entries.county_city has no index. api/voting-proxy.js's load_entries()
--    filters `.eq('county_city', city)` on every single public county page
--    view (public-voting.html) — the exact query exercised in the Somerset
--    rehearsal.
--
-- 2. organisations.company_name has no index. api/data-proxy.js's
--    executeAwardAreaImport() does `.ilike('company_name', r.companyName)`
--    for every single imported row to detect existing organisations. A
--    plain btree index doesn't accelerate ILIKE reliably across locales,
--    so this uses a trigram (pg_trgm) GIN index, the standard Postgres
--    approach for case-insensitive text lookups — Supabase enables
--    pg_trgm by default.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_entries_county_city ON entries(county_city);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_organisations_company_name_trgm
  ON organisations USING gin (company_name gin_trgm_ops);

NOTIFY pgrst, 'reload schema';
