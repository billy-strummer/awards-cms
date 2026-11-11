-- ============================================================
-- Migration 072: Fix entries columns needed by voting-proxy.js
-- ============================================================
-- api/voting-proxy.js's load_entries() — which powers public-voting.html,
-- the public nominees/voting page linked from every category on home.html —
-- unconditionally filters `.neq('is_deleted', true)` on every request, but
-- entries never had an is_deleted column. This means the public voting page
-- has been unable to load ANY entries, filtered or not, since that filter
-- always throws "column entries.is_deleted does not exist". It also filters
-- on `selected_country` (a lowercase country slug set by entries.js's CSV
-- import — 'england' | 'scotland' | 'wales' | 'northern-ireland') when a
-- ?country= URL param is present, but that column was also missing.
-- ============================================================

ALTER TABLE entries ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS selected_country TEXT;

CREATE INDEX IF NOT EXISTS idx_entries_is_deleted ON entries(is_deleted);
CREATE INDEX IF NOT EXISTS idx_entries_selected_country ON entries(selected_country);

NOTIFY pgrst, 'reload schema';
