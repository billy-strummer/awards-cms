-- ============================================================
-- Migration 067: Create the missing 'areas' table
-- ============================================================
-- location.js / areas-manager.js (Settings > Manage Areas) and the
-- Award/Organisation "Country > Region > Area" cascading selects all
-- depend on an 'areas' table that was apparently created directly on
-- the live database at some point but was never captured in any
-- migration file — a fresh project has no such table, which breaks
-- the Add Award / Add Organisation forms entirely (the Area dropdown
-- can never populate).
--
-- This migration creates 'areas' from scratch and reconciles 'regions'
-- (created earlier by migrations/047-seed-counties-regions.sql with
-- just id/name/created_at) with the additional display_name/country/
-- sort_order/is_active columns that database-location-restructure.sql
-- and location.js expect, then seeds both tables using the canonical
-- area list from database-location-restructure.sql.
-- ============================================================

-- ── 1. Reconcile REGIONS with the columns areas-manager.js needs ──
ALTER TABLE regions ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- The ON CONFLICT (display_name, country) seed below needs a matching unique
-- constraint; regions predates display_name/country so it was never created.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'regions_display_name_country_key' AND conrelid = 'regions'::regclass
  ) THEN
    ALTER TABLE regions ADD CONSTRAINT regions_display_name_country_key UNIQUE (display_name, country);
  END IF;
END $$;

-- ── 2. Create AREAS table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS areas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  country      TEXT NOT NULL CHECK (country IN ('England', 'Scotland', 'Wales')),
  area_type    TEXT DEFAULT 'county',
  is_small     BOOLEAN DEFAULT false,
  sort_order   INTEGER DEFAULT 0,
  is_active    BOOLEAN DEFAULT true,
  region_id    UUID REFERENCES regions(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (display_name, country)
);

ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to areas" ON areas;
CREATE POLICY "Allow all access to areas" ON areas FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.areas TO anon;
GRANT ALL ON public.areas TO authenticated;
GRANT ALL ON public.areas TO service_role;

-- ── 3. Seed REGIONS (England/Scotland/Wales sub-regions) ────────
-- These coexist with the broader 16-region set from migration 047
-- (used for organisation/entry county_city lookups); this narrower
-- set is what the Award/Organisation Area cascading select uses.
-- regions.name is NOT NULL (from migrations/047-seed-counties-regions.sql);
-- set it to the same value as display_name for these rows.
INSERT INTO regions (name, display_name, country, sort_order) VALUES
  ('East of England', 'East of England', 'England', 10),
  ('East Midlands',   'East Midlands',   'England', 20),
  ('London',          'London',          'England', 30),
  ('North East',      'North East',      'England', 40),
  ('North West',      'North West',      'England', 50),
  ('South East',      'South East',      'England', 60),
  ('South West',      'South West',      'England', 70),
  ('West Midlands',   'West Midlands',   'England', 80),
  ('North Wales',     'North Wales',     'Wales',   10),
  ('Mid & West Wales','Mid & West Wales','Wales',   20),
  ('South Wales',     'South Wales',     'Wales',   30),
  ('North Scotland',  'North Scotland',  'Scotland', 10),
  ('Central Scotland','Central Scotland','Scotland', 20),
  ('West Scotland',   'West Scotland',   'Scotland', 30),
  ('South Scotland',  'South Scotland',  'Scotland', 40)
ON CONFLICT (display_name, country) DO NOTHING;

-- ── 4. Seed AREAS (counties/cities/boroughs) ─────────────────────
INSERT INTO areas (display_name, country, area_type, is_small, sort_order, is_active, region_id)
SELECT v.display_name, v.country, v.area_type, v.is_small, v.sort_order, true,
       (SELECT id FROM regions WHERE regions.display_name = v.region AND regions.country = v.country)
FROM (VALUES
  ('Bedfordshire',   'England', 'county', false, 101, 'East of England'),
  ('Cambridgeshire', 'England', 'county', false, 102, 'East of England'),
  ('Essex',          'England', 'county', false, 103, 'East of England'),
  ('Hertfordshire',  'England', 'county', false, 104, 'East of England'),
  ('Norfolk',        'England', 'county', false, 105, 'East of England'),
  ('Suffolk',        'England', 'county', false, 106, 'East of England'),

  ('Derbyshire',       'England', 'county', false, 201, 'East Midlands'),
  ('Leicestershire',   'England', 'county', false, 202, 'East Midlands'),
  ('Lincolnshire',     'England', 'county', false, 203, 'East Midlands'),
  ('Northamptonshire', 'England', 'county', false, 204, 'East Midlands'),
  ('Nottinghamshire',  'England', 'county', false, 205, 'East Midlands'),
  ('Rutland',          'England', 'county', true,  206, 'East Midlands'),
  ('Leicester',        'England', 'city',   false, 207, 'East Midlands'),
  ('Nottingham',       'England', 'city',   false, 208, 'East Midlands'),

  ('Barking & Dagenham',   'England', 'borough', false, 301, 'London'),
  ('Barnet',               'England', 'borough', false, 302, 'London'),
  ('Bexley',               'England', 'borough', false, 303, 'London'),
  ('Brent',                'England', 'borough', false, 304, 'London'),
  ('Bromley',              'England', 'borough', true,  305, 'London'),
  ('Camden',               'England', 'borough', true,  306, 'London'),
  ('City of London',       'England', 'borough', true,  307, 'London'),
  ('Croydon',              'England', 'borough', true,  308, 'London'),
  ('Ealing',               'England', 'borough', false, 309, 'London'),
  ('Enfield',              'England', 'borough', false, 310, 'London'),
  ('Greenwich',            'England', 'borough', true,  311, 'London'),
  ('Hackney',              'England', 'borough', true,  312, 'London'),
  ('Hammersmith & Fulham', 'England', 'borough', true,  313, 'London'),
  ('Haringey',             'England', 'borough', false, 314, 'London'),
  ('Harrow',               'England', 'borough', false, 315, 'London'),
  ('Havering',             'England', 'borough', false, 316, 'London'),
  ('Hillingdon',           'England', 'borough', false, 317, 'London'),
  ('Hounslow',             'England', 'borough', false, 318, 'London'),
  ('Islington',            'England', 'borough', true,  319, 'London'),
  ('Kensington & Chelsea', 'England', 'borough', true,  320, 'London'),
  ('Kingston upon Thames', 'England', 'borough', false, 321, 'London'),
  ('Lambeth',              'England', 'borough', true,  322, 'London'),
  ('Lewisham',             'England', 'borough', true,  323, 'London'),
  ('Merton',               'England', 'borough', false, 324, 'London'),
  ('Newham',               'England', 'borough', false, 325, 'London'),
  ('Redbridge',            'England', 'borough', false, 326, 'London'),
  ('Richmond upon Thames', 'England', 'borough', false, 327, 'London'),
  ('Southwark',            'England', 'borough', true,  328, 'London'),
  ('Sutton',               'England', 'borough', false, 329, 'London'),
  ('Tower Hamlets',        'England', 'borough', false, 330, 'London'),
  ('Waltham Forest',       'England', 'borough', false, 331, 'London'),
  ('Wandsworth',           'England', 'borough', true,  332, 'London'),
  ('Westminster',          'England', 'borough', true,  333, 'London'),

  ('County Durham',  'England', 'county', false, 401, 'North East'),
  ('East Yorkshire', 'England', 'county', false, 402, 'North East'),
  ('North Yorkshire','England', 'county', false, 403, 'North East'),
  ('Northumberland', 'England', 'county', false, 404, 'North East'),
  ('South Yorkshire','England', 'county', false, 405, 'North East'),
  ('Tyne & Wear',    'England', 'county', false, 406, 'North East'),
  ('West Yorkshire', 'England', 'county', false, 407, 'North East'),
  ('Leeds',          'England', 'city',   false, 409, 'North East'),
  ('Middlesbrough',  'England', 'city',   false, 410, 'North East'),
  ('Newcastle',      'England', 'city',   false, 411, 'North East'),
  ('Sheffield',      'England', 'city',   false, 412, 'North East'),

  ('Cheshire',   'England', 'county', false, 501, 'North West'),
  ('Cumbria',    'England', 'county', false, 502, 'North West'),
  ('Lancashire', 'England', 'county', false, 503, 'North West'),
  ('Liverpool',  'England', 'city',   false, 504, 'North West'),
  ('Manchester', 'England', 'city',   false, 505, 'North West'),

  ('Berkshire',       'England', 'county', false, 601, 'South East'),
  ('Buckinghamshire', 'England', 'county', false, 602, 'South East'),
  ('East Sussex',     'England', 'county', false, 603, 'South East'),
  ('Hampshire',       'England', 'county', false, 604, 'South East'),
  ('Isle of Wight',   'England', 'county', true,  605, 'South East'),
  ('Kent',            'England', 'county', false, 606, 'South East'),
  ('Oxfordshire',     'England', 'county', false, 607, 'South East'),
  ('Surrey',          'England', 'county', false, 608, 'South East'),
  ('West Sussex',     'England', 'county', false, 609, 'South East'),
  ('Brighton & Hove', 'England', 'city',   false, 610, 'South East'),
  ('Reading',         'England', 'city',   false, 611, 'South East'),
  ('Southampton',     'England', 'city',   false, 612, 'South East'),

  ('Cornwall',       'England', 'county', false, 701, 'South West'),
  ('Devon',          'England', 'county', false, 702, 'South West'),
  ('Dorset',         'England', 'county', false, 703, 'South West'),
  ('Gloucestershire','England', 'county', false, 704, 'South West'),
  ('Somerset',       'England', 'county', false, 705, 'South West'),
  ('Wiltshire',      'England', 'county', false, 706, 'South West'),
  ('Bournemouth',    'England', 'city',   false, 707, 'South West'),
  ('Bristol',        'England', 'city',   false, 708, 'South West'),

  ('Herefordshire', 'England', 'county', true,  801, 'West Midlands'),
  ('Shropshire',    'England', 'county', false, 802, 'West Midlands'),
  ('Staffordshire', 'England', 'county', false, 803, 'West Midlands'),
  ('Warwickshire',  'England', 'county', false, 804, 'West Midlands'),
  ('Worcestershire','England', 'county', false, 805, 'West Midlands'),
  ('Birmingham',    'England', 'city',   false, 806, 'West Midlands'),
  ('Coventry',      'England', 'city',   false, 807, 'West Midlands'),

  ('Conwy & Denbighshire', 'Wales', 'county', true,  1101, 'North Wales'),
  ('Flintshire',           'Wales', 'county', true,  1102, 'North Wales'),
  ('Gwynedd & Anglesey',   'Wales', 'county', true,  1103, 'North Wales'),
  ('Wrexham',              'Wales', 'county', true,  1104, 'North Wales'),

  ('Carmarthenshire', 'Wales', 'county', true,  1201, 'Mid & West Wales'),
  ('Ceredigion',      'Wales', 'county', true,  1202, 'Mid & West Wales'),
  ('Pembrokeshire',   'Wales', 'county', true,  1203, 'Mid & West Wales'),
  ('Powys',           'Wales', 'county', true,  1204, 'Mid & West Wales'),

  ('Glamorgan', 'Wales', 'county', false, 1301, 'South Wales'),
  ('Gwent',     'Wales', 'county', false, 1302, 'South Wales'),
  ('Cardiff',   'Wales', 'city',   false, 1303, 'South Wales'),
  ('Swansea',   'Wales', 'city',   false, 1304, 'South Wales'),

  ('Grampian',        'Scotland', 'region', true,  2101, 'North Scotland'),
  ('Highlands',       'Scotland', 'region', true,  2102, 'North Scotland'),
  ('Scottish Islands','Scotland', 'region', true,  2103, 'North Scotland'),
  ('Tayside',         'Scotland', 'region', true,  2104, 'North Scotland'),

  ('Central Scotland','Scotland', 'region', true,  2201, 'Central Scotland'),
  ('Fife',            'Scotland', 'region', true,  2202, 'Central Scotland'),
  ('Lothian',         'Scotland', 'region', true,  2203, 'Central Scotland'),
  ('Edinburgh',       'Scotland', 'city',   false, 2204, 'Central Scotland'),

  ('Argyll & Bute',  'Scotland', 'region', true,  2301, 'West Scotland'),
  ('Dunbartonshire', 'Scotland', 'region', true,  2302, 'West Scotland'),
  ('Lanarkshire',    'Scotland', 'region', true,  2303, 'West Scotland'),
  ('Renfrewshire',   'Scotland', 'region', true,  2304, 'West Scotland'),
  ('Glasgow',        'Scotland', 'city',   false, 2305, 'West Scotland'),

  ('Ayrshire',           'Scotland', 'region', true,  2401, 'South Scotland'),
  ('Dumfries & Galloway','Scotland', 'region', true,  2402, 'South Scotland'),
  ('Scottish Borders',   'Scotland', 'region', true,  2403, 'South Scotland')
) AS v(display_name, country, area_type, is_small, sort_order, region)
ON CONFLICT (display_name, country) DO NOTHING;

NOTIFY pgrst, 'reload schema';
