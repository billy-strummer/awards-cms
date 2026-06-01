-- Add optional location scoping to custom categories
-- country / region_id / area_id are all nullable; null = available everywhere
ALTER TABLE custom_categories
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS region_id uuid,
  ADD COLUMN IF NOT EXISTS area_id uuid;
