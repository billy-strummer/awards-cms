-- ============================================================
-- FIX ORGANISATIONS TAB: Add missing columns
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. ORGANISATIONS: Add missing columns
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS catchment_area TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS winner_intro TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS winner_video_id TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS winner_vote_url TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'prospect';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 2. ORGANISATION_IMAGES: Add missing columns (code uses file_url + title, schema has image_url)
ALTER TABLE organisation_images ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE organisation_images ADD COLUMN IF NOT EXISTS title TEXT;
-- Migrate existing image_url data to file_url
UPDATE organisation_images SET file_url = image_url WHERE file_url IS NULL AND image_url IS NOT NULL;

-- 3. MEDIA_GALLERY: Add event_id for the events join
ALTER TABLE media_gallery ADD COLUMN IF NOT EXISTS event_id UUID;
-- Add FK if events table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events')
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'media_gallery_event_id_fkey' AND table_name = 'media_gallery'
  ) THEN
    ALTER TABLE media_gallery ADD CONSTRAINT media_gallery_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. INVOICES: Add missing columns
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS package_type TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS description TEXT;

-- 5. Ensure GRANTs
GRANT ALL ON public.organisations TO anon;
GRANT ALL ON public.organisations TO authenticated;
GRANT ALL ON public.organisations TO service_role;
GRANT ALL ON public.organisation_images TO anon;
GRANT ALL ON public.organisation_images TO authenticated;
GRANT ALL ON public.organisation_images TO service_role;
GRANT ALL ON public.media_gallery TO anon;
GRANT ALL ON public.media_gallery TO authenticated;
GRANT ALL ON public.media_gallery TO service_role;

-- Reload schema
NOTIFY pgrst, 'reload schema';
