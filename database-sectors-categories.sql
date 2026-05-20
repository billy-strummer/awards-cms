-- Custom sectors (additions on top of hardcoded SECTORS)
CREATE TABLE IF NOT EXISTS custom_sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Custom categories (additions on top of hardcoded STANDARD/SMALL_CATEGORIES)
CREATE TABLE IF NOT EXISTS custom_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_name text NOT NULL,  -- matches either a hardcoded sector OR a custom_sectors.name
  name text NOT NULL,
  available_for_small boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Unique constraints to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS custom_sectors_name_idx ON custom_sectors (lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS custom_categories_unique_idx ON custom_categories (lower(sector_name), lower(name));
