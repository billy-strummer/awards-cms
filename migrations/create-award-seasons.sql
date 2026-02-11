-- Create award_seasons table for managing key dates
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS award_seasons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  entry_open_date DATE,
  entry_close_date DATE,
  nominees_announcement_date DATE,
  voting_open_date DATE,
  voting_close_date DATE,
  winners_announcement_date DATE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow public access (matches existing RLS pattern)
ALTER TABLE award_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to award_seasons"
  ON award_seasons
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Insert a default 2026 season
INSERT INTO award_seasons (name, year, is_default)
VALUES ('2026 Main Season', 2026, true)
ON CONFLICT DO NOTHING;
