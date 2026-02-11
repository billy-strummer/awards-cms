-- Add previous year results columns to awards table
-- These are populated during the "Roll Over to Next Year" process
-- Run this in Supabase SQL Editor

ALTER TABLE awards ADD COLUMN IF NOT EXISTS prev_year_winner TEXT;
ALTER TABLE awards ADD COLUMN IF NOT EXISTS prev_year_2nd TEXT;
ALTER TABLE awards ADD COLUMN IF NOT EXISTS prev_year_3rd TEXT;
