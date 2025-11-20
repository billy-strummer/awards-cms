-- ============================================
-- Add Published Field to Media Gallery
-- ============================================

-- Add published column to media_gallery table
-- Default to true (published) for backward compatibility with existing media
ALTER TABLE media_gallery
ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT true;

-- Create index for better query performance when filtering by published status
CREATE INDEX IF NOT EXISTS idx_media_gallery_published ON media_gallery(published);

-- You can now filter media by published status:
-- SELECT * FROM media_gallery WHERE published = true;
