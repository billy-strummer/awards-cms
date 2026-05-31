-- ============================================================
-- LOCATION RESTRUCTURE: Country > Region > Area
-- Creates the regions table, adds region_id FK to areas,
-- and seeds the full canonical area list.
--
-- Run once in Supabase SQL Editor.
-- Safe to re-run: uses INSERT ... ON CONFLICT DO NOTHING for regions;
-- areas are truncated and re-seeded.
-- ============================================================

-- ── 1. REGIONS TABLE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS regions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  country      TEXT NOT NULL CHECK (country IN ('England','Scotland','Wales')),
  sort_order   INTEGER DEFAULT 0,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (display_name, country)
);

-- Add timestamps to existing regions tables that were created before this change
ALTER TABLE regions
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ── 2. ADD region_id TO areas (idempotent) ──────────────────
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id);

-- ── 3. SEED REGIONS ──────────────────────────────────────────
INSERT INTO regions (display_name, country, sort_order) VALUES
  -- England
  ('East of England', 'England', 10),
  ('East Midlands',   'England', 20),
  ('London',          'England', 30),
  ('North East',      'England', 40),
  ('North West',      'England', 50),
  ('South East',      'England', 60),
  ('South West',      'England', 70),
  ('West Midlands',   'England', 80),
  -- Wales
  ('North Wales',     'Wales',   10),
  ('Mid & West Wales','Wales',   20),
  ('South Wales',     'Wales',   30),
  -- Scotland
  ('North Scotland',  'Scotland', 10),
  ('Central Scotland','Scotland', 20),
  ('West Scotland',   'Scotland', 30),
  ('South Scotland',  'Scotland', 40)
ON CONFLICT (display_name, country) DO NOTHING;

-- ── 4. RESEED areas ──────────────────────────────────────────
-- Wipe all existing areas and start clean.
-- awards.area_id and organisations.area_id will temporarily be
-- orphaned; re-assign them via the CMS after seeding.
TRUNCATE areas RESTART IDENTITY CASCADE;

INSERT INTO areas (display_name, country, area_type, is_small, sort_order, is_active, region_id)
SELECT v.display_name, v.country, v.area_type, v.is_small, v.sort_order, true,
       (SELECT id FROM regions WHERE regions.display_name = v.region AND regions.country = v.country)
FROM (VALUES

  -- ── ENGLAND: East of England ─────────────────────────────
  ('Bedfordshire',   'England', 'county', false, 101, 'East of England'),
  ('Cambridgeshire', 'England', 'county', false, 102, 'East of England'),
  ('Essex',          'England', 'county', false, 103, 'East of England'),
  ('Hertfordshire',  'England', 'county', false, 104, 'East of England'),
  ('Norfolk',        'England', 'county', false, 105, 'East of England'),
  ('Suffolk',        'England', 'county', false, 106, 'East of England'),

  -- ── ENGLAND: East Midlands ───────────────────────────────
  ('Derbyshire',       'England', 'county', false, 201, 'East Midlands'),
  ('Leicestershire',   'England', 'county', false, 202, 'East Midlands'),
  ('Lincolnshire',     'England', 'county', false, 203, 'East Midlands'),
  ('Northamptonshire', 'England', 'county', false, 204, 'East Midlands'),
  ('Nottinghamshire',  'England', 'county', false, 205, 'East Midlands'),
  ('Rutland',          'England', 'county', true,  206, 'East Midlands'),
  ('Leicester',        'England', 'city',   false, 207, 'East Midlands'),
  ('Nottingham',       'England', 'city',   false, 208, 'East Midlands'),

  -- ── ENGLAND: London (boroughs) ───────────────────────────
  ('Bromley',              'England', 'borough', true,  301, 'London'),
  ('Camden',               'England', 'borough', true,  302, 'London'),
  ('Croydon',              'England', 'borough', true,  303, 'London'),
  ('Greenwich',            'England', 'borough', true,  304, 'London'),
  ('Hackney',              'England', 'borough', true,  305, 'London'),
  ('Hammersmith & Fulham', 'England', 'borough', true,  306, 'London'),
  ('Islington',            'England', 'borough', true,  307, 'London'),
  ('Kensington & Chelsea', 'England', 'borough', true,  308, 'London'),
  ('Kingston & Richmond',  'England', 'borough', true,  309, 'London'),
  ('Lambeth',              'England', 'borough', true,  310, 'London'),
  ('Lewisham',             'England', 'borough', true,  311, 'London'),
  ('Middlesex',            'England', 'borough', false, 312, 'London'),
  ('Southwark',            'England', 'borough', true,  313, 'London'),
  ('Wandsworth',           'England', 'borough', true,  314, 'London'),
  ('Westminster',          'England', 'borough', true,  315, 'London'),

  -- ── ENGLAND: North East ──────────────────────────────────
  ('County Durham',  'England', 'county', false, 401, 'North East'),
  ('East Yorkshire', 'England', 'county', false, 402, 'North East'),
  ('North Yorkshire','England', 'county', false, 403, 'North East'),
  ('Northumberland', 'England', 'county', false, 404, 'North East'),
  ('South Yorkshire','England', 'county', false, 405, 'North East'),
  ('Tyne & Wear',    'England', 'county', false, 406, 'North East'),
  ('West Yorkshire', 'England', 'county', false, 407, 'North East'),
  ('Reading',        'England', 'city',   false, 408, 'South East'),
  ('Leeds',          'England', 'city',   false, 409, 'North East'),
  ('Middlesbrough',  'England', 'city',   false, 410, 'North East'),
  ('Newcastle',      'England', 'city',   false, 411, 'North East'),
  ('Sheffield',      'England', 'city',   false, 412, 'North East'),

  -- ── ENGLAND: North West ──────────────────────────────────
  ('Cheshire',   'England', 'county', false, 501, 'North West'),
  ('Cumbria',    'England', 'county', false, 502, 'North West'),
  ('Lancashire', 'England', 'county', false, 503, 'North West'),
  ('Liverpool',  'England', 'city',   false, 504, 'North West'),
  ('Manchester', 'England', 'city',   false, 505, 'North West'),

  -- ── ENGLAND: South East ──────────────────────────────────
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
  ('Southampton',     'England', 'city',   false, 611, 'South East'),

  -- ── ENGLAND: South West ──────────────────────────────────
  ('Cornwall',       'England', 'county', false, 701, 'South West'),
  ('Devon',          'England', 'county', false, 702, 'South West'),
  ('Dorset',         'England', 'county', false, 703, 'South West'),
  ('Gloucestershire','England', 'county', false, 704, 'South West'),
  ('Somerset',       'England', 'county', false, 705, 'South West'),
  ('Wiltshire',      'England', 'county', false, 706, 'South West'),
  ('Bournemouth',    'England', 'city',   false, 707, 'South West'),
  ('Bristol',        'England', 'city',   false, 708, 'South West'),

  -- ── ENGLAND: West Midlands ───────────────────────────────
  ('Herefordshire', 'England', 'county', true,  801, 'West Midlands'),
  ('Shropshire',    'England', 'county', false, 802, 'West Midlands'),
  ('Staffordshire', 'England', 'county', false, 803, 'West Midlands'),
  ('Warwickshire',  'England', 'county', false, 804, 'West Midlands'),
  ('Worcestershire','England', 'county', false, 805, 'West Midlands'),
  ('Birmingham',    'England', 'city',   false, 806, 'West Midlands'),
  ('Coventry',      'England', 'city',   false, 807, 'West Midlands'),

  -- ── WALES: North Wales ───────────────────────────────────
  ('Conwy & Denbighshire', 'Wales', 'county', true,  1101, 'North Wales'),
  ('Flintshire',           'Wales', 'county', true,  1102, 'North Wales'),
  ('Gwynedd & Anglesey',   'Wales', 'county', true,  1103, 'North Wales'),
  ('Wrexham',              'Wales', 'county', true,  1104, 'North Wales'),

  -- ── WALES: Mid & West Wales ──────────────────────────────
  ('Carmarthenshire', 'Wales', 'county', true,  1201, 'Mid & West Wales'),
  ('Ceredigion',      'Wales', 'county', true,  1202, 'Mid & West Wales'),
  ('Pembrokeshire',   'Wales', 'county', true,  1203, 'Mid & West Wales'),
  ('Powys',           'Wales', 'county', true,  1204, 'Mid & West Wales'),

  -- ── WALES: South Wales ───────────────────────────────────
  ('Glamorgan', 'Wales', 'county', false, 1301, 'South Wales'),
  ('Gwent',     'Wales', 'county', false, 1302, 'South Wales'),
  ('Cardiff',   'Wales', 'city',   false, 1303, 'South Wales'),
  ('Swansea',   'Wales', 'city',   false, 1304, 'South Wales'),

  -- ── SCOTLAND: North ──────────────────────────────────────
  ('Grampian',        'Scotland', 'region', true,  2101, 'North Scotland'),
  ('Highlands',       'Scotland', 'region', true,  2102, 'North Scotland'),
  ('Scottish Islands','Scotland', 'region', true,  2103, 'North Scotland'),
  ('Tayside',         'Scotland', 'region', true,  2104, 'North Scotland'),

  -- ── SCOTLAND: Central ────────────────────────────────────
  ('Central Scotland','Scotland', 'region', true,  2201, 'Central Scotland'),
  ('Fife',            'Scotland', 'region', true,  2202, 'Central Scotland'),
  ('Lothian',         'Scotland', 'region', true,  2203, 'Central Scotland'),
  ('Edinburgh',       'Scotland', 'city',   false, 2204, 'Central Scotland'),

  -- ── SCOTLAND: West ───────────────────────────────────────
  ('Argyll & Bute',  'Scotland', 'region', true,  2301, 'West Scotland'),
  ('Dunbartonshire', 'Scotland', 'region', true,  2302, 'West Scotland'),
  ('Lanarkshire',    'Scotland', 'region', true,  2303, 'West Scotland'),
  ('Renfrewshire',   'Scotland', 'region', true,  2304, 'West Scotland'),
  ('Glasgow',        'Scotland', 'city',   false, 2305, 'West Scotland'),

  -- ── SCOTLAND: South ──────────────────────────────────────
  ('Ayrshire',           'Scotland', 'region', true,  2401, 'South Scotland'),
  ('Dumfries & Galloway','Scotland', 'region', true,  2402, 'South Scotland'),
  ('Scottish Borders',   'Scotland', 'region', true,  2403, 'South Scotland')

) AS v(display_name, country, area_type, is_small, sort_order, region);
