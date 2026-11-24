-- Import batch rollback / bulk delete for spreadsheet uploads. Three
-- minimal, additive, idempotent columns plus their lookup indexes -- no
-- new tables, since `nominee_upload_batches` (the existing best-effort
-- audit trail written by executeAwardAreaImport()) is already exactly the
-- right shape to be the batch record; it just didn't carry enough to
-- identify, scope, or reverse what it logged.
--
-- Before this migration, `nominee_upload_batches` recorded that an import
-- happened (filename/area/row counts/uploader) but nothing it created was
-- ever linked back to that record -- there was no way to answer "which
-- entries came from batch X" other than guessing by timestamp proximity,
-- which is exactly the kind of imprecise, unauditable basis a bulk-delete
-- feature must not be built on.
--
-- `nominee_upload_batches.area_id` / `.year`: an exact area/season handle
-- for the "Recent Imports" list this feature adds (nominee-uploads.js
-- already stamps `area: area.display_name` as free text; display names are
-- not guaranteed unique across different Area rows, so an exact id is
-- needed to reliably list/filter a specific area's own past batches
-- without fragile text matching). Nullable: historical batch rows
-- recorded before this migration ships keep working as pure audit-log
-- entries, they just aren't usable with the new rollback feature (there is
-- no way to retroactively know which entries a historical batch created
-- without this column having existed at insert time).
--
-- `entries.import_batch_id`: the actual link the rollback feature deletes
-- by. ON DELETE SET NULL (not CASCADE) in both directions deliberately --
-- deleting the batch's own audit row must never, by itself, cascade-delete
-- real entry data, and deleting an entry must never destroy its batch's
-- audit trail; the rollback operation explicitly deletes entries first,
-- then optionally the now-empty batch row, rather than relying on an
-- implicit cascade for the destructive half of that sequence.
ALTER TABLE nominee_upload_batches
  ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS year INTEGER;

ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES nominee_upload_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_entries_import_batch_id ON entries(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_nominee_upload_batches_area_id ON nominee_upload_batches(area_id);
