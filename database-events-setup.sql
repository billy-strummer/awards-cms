-- ============================================
-- Events Management Setup
-- ============================================
-- Run these SQL commands in your Supabase SQL Editor
-- ============================================

-- 1. Create events table
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name VARCHAR(255) NOT NULL,
  event_date DATE,
  year INTEGER,
  venue VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add event_id column to media_gallery table
ALTER TABLE media_gallery
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;

-- 3. Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_media_gallery_event_id ON media_gallery(event_id);

-- 4. Insert some sample events (optional - you can add these via the UI instead)
-- Uncomment if you want to add sample data:
-- INSERT INTO events (event_name, event_date, year, venue, description) VALUES
-- ('2024 Awards Ceremony', '2024-11-15', 2024, 'Grand Hotel Ballroom', 'Annual awards ceremony celebrating excellence'),
-- ('2023 Awards Gala', '2023-11-20', 2023, 'Convention Center', 'Previous year awards event'),
-- ('2024 Networking Evening', '2024-06-10', 2024, 'Rooftop Bar', 'Summer networking event for nominees');

-- ============================================
-- After running this SQL, the system will support:
-- - Creating events
-- - Assigning media to events during upload
-- - Filtering media by event
-- - Displaying event badges on media cards
-- ============================================
