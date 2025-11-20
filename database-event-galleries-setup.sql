-- ============================================
-- Event Gallery Sections Setup
-- ============================================
-- Run these SQL commands in your Supabase SQL Editor
-- ============================================

-- 1. Create event_galleries table (Gallery Sections within Events)
CREATE TABLE IF NOT EXISTS event_galleries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  gallery_name VARCHAR(255) NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add gallery_section_id to media_gallery table
ALTER TABLE media_gallery
ADD COLUMN IF NOT EXISTS gallery_section_id UUID REFERENCES event_galleries(id) ON DELETE SET NULL;

-- 3. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_event_galleries_event_id ON event_galleries(event_id);
CREATE INDEX IF NOT EXISTS idx_event_galleries_order ON event_galleries(event_id, display_order);
CREATE INDEX IF NOT EXISTS idx_media_gallery_section_id ON media_gallery(gallery_section_id);

-- 4. Enable Row Level Security
ALTER TABLE event_galleries ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for event_galleries
CREATE POLICY "Allow authenticated read access to event_galleries"
ON event_galleries FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated insert to event_galleries"
ON event_galleries FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated update to event_galleries"
ON event_galleries FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated delete from event_galleries"
ON event_galleries FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- Example Gallery Sections for an Event:
-- INSERT INTO event_galleries (event_id, gallery_name, description, display_order)
-- VALUES
-- ('event-uuid-here', 'Drinks Reception', 'Pre-ceremony drinks and networking', 0),
-- ('event-uuid-here', 'Dinner', 'Award ceremony dinner photos', 1),
-- ('event-uuid-here', 'Winner Photos', 'Photos with winners and their awards', 2),
-- ('event-uuid-here', 'Behind the Scenes', 'Backstage and preparation photos', 3);
-- ============================================

-- After running this SQL, the structure will be:
-- Event → Gallery Sections → Photos (each tagged to org/award)
-- ============================================
