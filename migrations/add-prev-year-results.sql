-- Add previous year results columns to awards table
-- These are populated during the "Roll Over to Next Year" process
-- Run this in Supabase SQL Editor

-- Try award_years first (the base table), fall back to awards if it's a direct table
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS prev_year_winner TEXT;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS prev_year_2nd TEXT;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS prev_year_3rd TEXT;

-- Also add the date columns needed for seasons (if not already present)
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS entry_open_date DATE;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS entry_close_date DATE;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS nominees_announcement_date DATE;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS judging_open_date DATE;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS judging_close_date DATE;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS voting_open_date DATE;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS voting_close_date DATE;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS winners_announcement_date DATE;
