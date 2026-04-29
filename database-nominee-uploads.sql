-- ============================================================
-- NOMINEE UPLOADS: batch tracking + row storage
-- Run once in Supabase SQL Editor.
-- Safe to re-run: uses CREATE TABLE IF NOT EXISTS.
-- ============================================================

-- ── 1. UPLOAD BATCHES ────────────────────────────────────────
-- One record per CSV file upload.
CREATE TABLE IF NOT EXISTS nominee_upload_batches (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  filename     TEXT        NOT NULL,
  area         TEXT        NOT NULL,        -- canonical area name (e.g. 'Kent')
  country      TEXT,                        -- 'England' | 'Scotland' | 'Wales'
  category     TEXT,                        -- award category (optional, user-supplied)
  csv_row_count   INTEGER  NOT NULL,        -- rows detected in the file (excl. blanks/header)
  stored_row_count INTEGER NOT NULL DEFAULT 0, -- rows actually written to DB (for verification)
  uploaded_by  TEXT,                        -- user email
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes        TEXT
);

-- ── 2. NOMINEE ROWS ──────────────────────────────────────────
-- One record per data row in the uploaded CSV.
CREATE TABLE IF NOT EXISTS nominee_upload_rows (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id     UUID        NOT NULL REFERENCES nominee_upload_batches(id) ON DELETE CASCADE,
  area         TEXT        NOT NULL,        -- canonical area name for this row
  row_number   INTEGER     NOT NULL,        -- 1-based position in original CSV (excl. header)
  company_name TEXT,                        -- extracted from 'Company Name' / 'Organisation' column
  raw_data     JSONB       NOT NULL,        -- all CSV columns preserved as key→value
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. INDEXES ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_nominee_rows_batch_id ON nominee_upload_rows(batch_id);
CREATE INDEX IF NOT EXISTS idx_nominee_rows_area     ON nominee_upload_rows(area);
CREATE INDEX IF NOT EXISTS idx_nominee_batches_area  ON nominee_upload_batches(area);

-- ── 4. RLS (Row Level Security) ──────────────────────────────
-- Allow service role full access; anon key read-only.
ALTER TABLE nominee_upload_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE nominee_upload_rows    ENABLE ROW LEVEL SECURITY;

-- Service role bypass (used by server-side API)
CREATE POLICY IF NOT EXISTS "service_all_batches"
  ON nominee_upload_batches FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "service_all_rows"
  ON nominee_upload_rows FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can read
CREATE POLICY IF NOT EXISTS "auth_read_batches"
  ON nominee_upload_batches FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "auth_read_rows"
  ON nominee_upload_rows FOR SELECT TO authenticated USING (true);
