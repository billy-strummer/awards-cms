-- ============================================================
-- Migration 014: Add missing columns to media_gallery and media_items
-- ============================================================
-- The JS frontend uses several columns that were added to the live
-- database but not captured in any migration file. This migration
-- ensures the schema is complete and reproducible.
-- ============================================================

-- =====================
-- media_gallery table
-- =====================

-- Link photos to gallery sections (event_galleries)
ALTER TABLE media_gallery
  ADD COLUMN IF NOT EXISTS gallery_section_id UUID REFERENCES event_galleries(id) ON DELETE SET NULL;

-- Photo metadata
ALTER TABLE media_gallery
  ADD COLUMN IF NOT EXISTS caption TEXT;

ALTER TABLE media_gallery
  ADD COLUMN IF NOT EXISTS photographer TEXT;

ALTER TABLE media_gallery
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Visibility flags for winner/company profile pages
ALTER TABLE media_gallery
  ADD COLUMN IF NOT EXISTS show_on_winner BOOLEAN DEFAULT FALSE;

ALTER TABLE media_gallery
  ADD COLUMN IF NOT EXISTS show_on_company BOOLEAN DEFAULT FALSE;

ALTER TABLE media_gallery
  ADD COLUMN IF NOT EXISTS show_on_gallery BOOLEAN DEFAULT TRUE;

-- FK constraint on award_id (base schema has the column but no FK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'media_gallery_award_id_fkey'
      AND table_name = 'media_gallery'
  ) THEN
    ALTER TABLE media_gallery
      ADD CONSTRAINT media_gallery_award_id_fkey
      FOREIGN KEY (award_id) REFERENCES award_years(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_media_gallery_section ON media_gallery(gallery_section_id);
CREATE INDEX IF NOT EXISTS idx_media_gallery_org ON media_gallery(organisation_id);
CREATE INDEX IF NOT EXISTS idx_media_gallery_award ON media_gallery(award_id);
CREATE INDEX IF NOT EXISTS idx_media_gallery_event ON media_gallery(event_id);


-- =====================
-- media_items table
-- =====================

-- YouTube video support
ALTER TABLE media_items
  ADD COLUMN IF NOT EXISTS youtube_id TEXT;

ALTER TABLE media_items
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- JSON tags for multi-org/award tagging (backward-compatible with FK approach)
ALTER TABLE media_items
  ADD COLUMN IF NOT EXISTS tags JSONB;

-- Status field (published, draft, archived)
ALTER TABLE media_items
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published';

-- created_at (code uses this instead of uploaded_at)
ALTER TABLE media_items
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- FK constraint on award_id (base schema has the column but no FK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'media_items_award_id_fkey'
      AND table_name = 'media_items'
  ) THEN
    ALTER TABLE media_items
      ADD CONSTRAINT media_items_award_id_fkey
      FOREIGN KEY (award_id) REFERENCES award_years(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_media_items_org ON media_items(organisation_id);
CREATE INDEX IF NOT EXISTS idx_media_items_award ON media_items(award_id);
CREATE INDEX IF NOT EXISTS idx_media_items_event ON media_items(event_id);
CREATE INDEX IF NOT EXISTS idx_media_items_youtube ON media_items(youtube_id);
