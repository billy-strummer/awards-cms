-- ============================================================
-- Migration 073: Fix nominee_upload_batches columns
-- ============================================================
-- migrations/058-missing-tables-and-columns.sql created nominee_upload_batches
-- referencing a file ("database-nominee-uploads.sql") that was never actually
-- checked into this repo, with an award_id-based schema. But two real
-- consumers expect an area-based schema instead:
--   - api/data-proxy.js's Award Areas import audit trail (area, filename,
--     category, country, csv_row_count, stored_row_count)
--   - dashboard.js's "county coverage" widget (area, stored_row_count)
-- Both have been silently failing / reporting zero coverage. Add the
-- missing columns rather than picking one schema and breaking the other.
-- ============================================================

ALTER TABLE nominee_upload_batches ADD COLUMN IF NOT EXISTS area TEXT;
ALTER TABLE nominee_upload_batches ADD COLUMN IF NOT EXISTS filename TEXT;
ALTER TABLE nominee_upload_batches ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE nominee_upload_batches ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE nominee_upload_batches ADD COLUMN IF NOT EXISTS csv_row_count INTEGER DEFAULT 0;
ALTER TABLE nominee_upload_batches ADD COLUMN IF NOT EXISTS stored_row_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_nominee_upload_batches_area ON nominee_upload_batches(area);

NOTIFY pgrst, 'reload schema';
