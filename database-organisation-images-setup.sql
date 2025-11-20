-- ============================================
-- Organisation Images Setup (for Marketing)
-- ============================================
-- Run these SQL commands in your Supabase SQL Editor
-- ============================================

-- 1. Create organisation_images table
CREATE TABLE IF NOT EXISTS organisation_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  title VARCHAR(255),
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_organisation_images_org_id ON organisation_images(organisation_id);
CREATE INDEX IF NOT EXISTS idx_organisation_images_order ON organisation_images(organisation_id, display_order);

-- 3. Enable Row Level Security (optional, adjust policies as needed)
ALTER TABLE organisation_images ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for organisation_images
CREATE POLICY "Allow authenticated read access to organisation_images"
ON organisation_images FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated insert to organisation_images"
ON organisation_images FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated update to organisation_images"
ON organisation_images FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated delete from organisation_images"
ON organisation_images FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- After running this SQL, you can:
-- - Upload multiple company images per organisation
-- - Add captions and titles for each image
-- - Order images for email campaigns
-- - Query all images for a specific company
-- ============================================
