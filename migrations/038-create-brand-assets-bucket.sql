-- ============================================
-- CREATE brand-assets STORAGE BUCKET
-- ============================================
-- The branding module uploads logos to Supabase Storage in a bucket
-- called "brand-assets". This must exist before uploads can work.
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-assets',
  'brand-assets',
  true,
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
DROP POLICY IF EXISTS "Allow authenticated uploads to brand-assets" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to brand-assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'brand-assets');

-- Allow authenticated users to update (upsert)
DROP POLICY IF EXISTS "Allow authenticated updates to brand-assets" ON storage.objects;
CREATE POLICY "Allow authenticated updates to brand-assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'brand-assets')
  WITH CHECK (bucket_id = 'brand-assets');

-- Allow public read access (logos need to be publicly visible)
DROP POLICY IF EXISTS "Allow public read of brand-assets" ON storage.objects;
CREATE POLICY "Allow public read of brand-assets"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'brand-assets');

-- Allow authenticated users to delete their uploads
DROP POLICY IF EXISTS "Allow authenticated deletes from brand-assets" ON storage.objects;
CREATE POLICY "Allow authenticated deletes from brand-assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'brand-assets');
