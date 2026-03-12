-- ============================================================
-- 049: Certificate Template Editor
-- Expand certificate_templates table with full template fields
-- for the visual drag-and-drop certificate editor.
-- ============================================================

-- Add template design columns
ALTER TABLE certificate_templates ADD COLUMN IF NOT EXISTS background_pdf_url TEXT;
ALTER TABLE certificate_templates ADD COLUMN IF NOT EXISTS fields_json JSONB DEFAULT '[]'::jsonb;
ALTER TABLE certificate_templates ADD COLUMN IF NOT EXISTS custom_fonts_json JSONB DEFAULT '[]'::jsonb;
ALTER TABLE certificate_templates ADD COLUMN IF NOT EXISTS page_width NUMERIC DEFAULT 842;
ALTER TABLE certificate_templates ADD COLUMN IF NOT EXISTS page_height NUMERIC DEFAULT 595;
ALTER TABLE certificate_templates ADD COLUMN IF NOT EXISTS orientation VARCHAR(20) DEFAULT 'landscape';
ALTER TABLE certificate_templates ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Ensure RLS is enabled
ALTER TABLE certificate_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to certificate_templates" ON certificate_templates;
CREATE POLICY "Allow all access to certificate_templates"
  ON certificate_templates FOR ALL USING (true) WITH CHECK (true);

-- Add certificate_url to winners table if not present
ALTER TABLE winners ADD COLUMN IF NOT EXISTS certificate_url TEXT;

-- Create storage bucket for certificate backgrounds and fonts (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificate-assets', 'certificate-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to certificate assets
DROP POLICY IF EXISTS "Public read certificate-assets" ON storage.objects;
CREATE POLICY "Public read certificate-assets"
  ON storage.objects FOR SELECT USING (bucket_id = 'certificate-assets');

-- Allow authenticated uploads
DROP POLICY IF EXISTS "Auth upload certificate-assets" ON storage.objects;
CREATE POLICY "Auth upload certificate-assets"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'certificate-assets');

DROP POLICY IF EXISTS "Auth update certificate-assets" ON storage.objects;
CREATE POLICY "Auth update certificate-assets"
  ON storage.objects FOR UPDATE USING (bucket_id = 'certificate-assets');

DROP POLICY IF EXISTS "Auth delete certificate-assets" ON storage.objects;
CREATE POLICY "Auth delete certificate-assets"
  ON storage.objects FOR DELETE USING (bucket_id = 'certificate-assets');
