-- ============================================================
-- 047: Seed counties table with all UK counties/cities and region mappings
-- ============================================================
-- Ensures the counties table has a complete set of entries matching
-- the values used in award and organisation forms. Each county is
-- linked to a region via the text `region` column. If the regions
-- table already has matching rows, we also set `region_id` FK.
-- ============================================================

-- Clear existing data so we start fresh with the correct structure
DELETE FROM counties;
DELETE FROM regions;

-- Insert the 16 regions
INSERT INTO regions (name) VALUES
  ('East of England'),
  ('East Midlands'),
  ('Greater London'),
  ('North East'),
  ('North West'),
  ('South East'),
  ('South West'),
  ('West Midlands'),
  ('Wales, NW (Gwynedd)'),
  ('Wales, NE (Clwyd)'),
  ('Wales, Mid & West'),
  ('Wales, South'),
  ('Scotland, North'),
  ('Scotland, Central'),
  ('Scotland, West'),
  ('Scotland, South')
ON CONFLICT DO NOTHING;

-- Insert all counties/cities with their region mappings
DO $$
DECLARE
  county_data JSONB := '[
    {"name": "Bedfordshire", "region": "East of England"},
    {"name": "Cambridgeshire", "region": "East of England"},
    {"name": "Essex", "region": "East of England"},
    {"name": "Hertfordshire", "region": "East of England"},
    {"name": "Norfolk", "region": "East of England"},
    {"name": "Suffolk", "region": "East of England"},

    {"name": "Derbyshire", "region": "East Midlands"},
    {"name": "Lincolnshire", "region": "East Midlands"},
    {"name": "Leicestershire", "region": "East Midlands"},
    {"name": "Northamptonshire", "region": "East Midlands"},
    {"name": "Nottinghamshire", "region": "East Midlands"},
    {"name": "Rutland", "region": "East Midlands"},
    {"name": "Leicester", "region": "East Midlands"},
    {"name": "Nottingham", "region": "East Midlands"},

    {"name": "London, North", "region": "Greater London"},
    {"name": "London, South", "region": "Greater London"},
    {"name": "London, East", "region": "Greater London"},
    {"name": "London, West", "region": "Greater London"},

    {"name": "Northumberland", "region": "North East"},
    {"name": "Tyne & Wear", "region": "North East"},
    {"name": "County Durham", "region": "North East"},
    {"name": "North Yorkshire", "region": "North East"},
    {"name": "East Yorkshire", "region": "North East"},
    {"name": "South Yorkshire", "region": "North East"},
    {"name": "West Yorkshire", "region": "North East"},
    {"name": "Bradford", "region": "North East"},
    {"name": "Leeds", "region": "North East"},
    {"name": "Middlesborough", "region": "North East"},
    {"name": "Newcastle", "region": "North East"},
    {"name": "Sheffield", "region": "North East"},

    {"name": "Cheshire", "region": "North West"},
    {"name": "Cumbria", "region": "North West"},
    {"name": "Lancashire", "region": "North West"},
    {"name": "Liverpool", "region": "North West"},
    {"name": "Manchester", "region": "North West"},

    {"name": "Berkshire", "region": "South East"},
    {"name": "Buckinghamshire", "region": "South East"},
    {"name": "Hampshire", "region": "South East"},
    {"name": "Isle of Wight", "region": "South East"},
    {"name": "Kent", "region": "South East"},
    {"name": "Oxfordshire", "region": "South East"},
    {"name": "Surrey", "region": "South East"},
    {"name": "East Sussex", "region": "South East"},
    {"name": "West Sussex", "region": "South East"},
    {"name": "Brighton & Hove", "region": "South East"},
    {"name": "Southampton", "region": "South East"},

    {"name": "Cornwall", "region": "South West"},
    {"name": "Dorset", "region": "South West"},
    {"name": "Devon", "region": "South West"},
    {"name": "Gloucestershire", "region": "South West"},
    {"name": "Somerset", "region": "South West"},
    {"name": "Wiltshire", "region": "South West"},
    {"name": "Bristol", "region": "South West"},
    {"name": "Bournemouth", "region": "South West"},

    {"name": "Staffordshire", "region": "West Midlands"},
    {"name": "Warwickshire", "region": "West Midlands"},
    {"name": "Shropshire", "region": "West Midlands"},
    {"name": "Herefordshire", "region": "West Midlands"},
    {"name": "Worcestershire", "region": "West Midlands"},
    {"name": "Birmingham", "region": "West Midlands"},
    {"name": "Coventry", "region": "West Midlands"},

    {"name": "Gwynedd", "region": "Wales, NW (Gwynedd)"},
    {"name": "Anglesey", "region": "Wales, NW (Gwynedd)"},

    {"name": "Conwy", "region": "Wales, NE (Clwyd)"},
    {"name": "Denbighshire", "region": "Wales, NE (Clwyd)"},
    {"name": "Flintshire", "region": "Wales, NE (Clwyd)"},
    {"name": "Wrexham", "region": "Wales, NE (Clwyd)"},

    {"name": "Ceredigion", "region": "Wales, Mid & West"},
    {"name": "Carmarthenshire", "region": "Wales, Mid & West"},
    {"name": "Pembrokeshire", "region": "Wales, Mid & West"},
    {"name": "Powys", "region": "Wales, Mid & West"},

    {"name": "Gwent", "region": "Wales, South"},
    {"name": "Glamorgan", "region": "Wales, South"},
    {"name": "Cardiff", "region": "Wales, South"},
    {"name": "Swansea", "region": "Wales, South"},

    {"name": "Grampian", "region": "Scotland, North"},
    {"name": "Highlands", "region": "Scotland, North"},
    {"name": "Islands", "region": "Scotland, North"},
    {"name": "Tayside", "region": "Scotland, North"},

    {"name": "Central Scotland", "region": "Scotland, Central"},
    {"name": "Fife", "region": "Scotland, Central"},
    {"name": "Lothian", "region": "Scotland, Central"},
    {"name": "Edinburgh", "region": "Scotland, Central"},

    {"name": "Argyll & Bute", "region": "Scotland, West"},
    {"name": "Dunbartonshire", "region": "Scotland, West"},
    {"name": "Lanarkshire", "region": "Scotland, West"},
    {"name": "Renfrewshire", "region": "Scotland, West"},
    {"name": "Glasgow", "region": "Scotland, West"},

    {"name": "Ayrshire", "region": "Scotland, South"},
    {"name": "Dumfries & Galloway", "region": "Scotland, South"},
    {"name": "Scottish Borders", "region": "Scotland, South"}
  ]';
  item JSONB;
  region_uuid UUID;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(county_data)
  LOOP
    -- Look up region_id from regions table
    SELECT id INTO region_uuid FROM regions WHERE name = item->>'region' LIMIT 1;

    -- Insert county if it doesn't already exist (by Name)
    INSERT INTO counties ("Name", region, region_id)
    VALUES (item->>'name', item->>'region', region_uuid)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
