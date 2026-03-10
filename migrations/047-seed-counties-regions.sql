-- ============================================================
-- 047: Seed counties table with all UK counties/cities and region mappings
-- ============================================================
-- Ensures the counties table has a complete set of entries matching
-- the values used in award and organisation forms. Each county is
-- linked to a region via the text `region` column. If the regions
-- table already has matching rows, we also set `region_id` FK.
-- ============================================================

-- First ensure all regions exist
INSERT INTO regions (name) VALUES
  ('East Midlands'),
  ('East of England'),
  ('London'),
  ('North East'),
  ('North West'),
  ('Northern Ireland'),
  ('Scotland'),
  ('South East'),
  ('South West'),
  ('Wales'),
  ('West Midlands'),
  ('Yorkshire and the Humber')
ON CONFLICT DO NOTHING;

-- Insert all counties/cities with their region mappings
-- Uses ON CONFLICT on Name to avoid duplicates if some already exist
DO $$
DECLARE
  county_data JSONB := '[
    {"name": "Bedfordshire", "region": "East of England"},
    {"name": "Berkshire", "region": "South East"},
    {"name": "Buckinghamshire", "region": "South East"},
    {"name": "Cambridgeshire", "region": "East of England"},
    {"name": "Cheshire", "region": "North West"},
    {"name": "Cornwall", "region": "South West"},
    {"name": "Cumbria", "region": "North West"},
    {"name": "Derbyshire", "region": "East Midlands"},
    {"name": "Devon", "region": "South West"},
    {"name": "Dorset", "region": "South West"},
    {"name": "County Durham", "region": "North East"},
    {"name": "East Riding of Yorkshire", "region": "Yorkshire and the Humber"},
    {"name": "Essex", "region": "East of England"},
    {"name": "Gloucestershire", "region": "South West"},
    {"name": "Hampshire", "region": "South East"},
    {"name": "Herefordshire", "region": "West Midlands"},
    {"name": "Hertfordshire", "region": "East of England"},
    {"name": "Isle of Wight", "region": "South East"},
    {"name": "Kent", "region": "South East"},
    {"name": "Lancashire", "region": "North West"},
    {"name": "Leicestershire", "region": "East Midlands"},
    {"name": "Lincolnshire", "region": "East Midlands"},
    {"name": "Norfolk", "region": "East of England"},
    {"name": "Northamptonshire", "region": "East Midlands"},
    {"name": "North Yorkshire", "region": "Yorkshire and the Humber"},
    {"name": "Northumberland", "region": "North East"},
    {"name": "Nottinghamshire", "region": "East Midlands"},
    {"name": "Oxfordshire", "region": "South East"},
    {"name": "Rutland", "region": "East Midlands"},
    {"name": "Shropshire", "region": "West Midlands"},
    {"name": "Somerset", "region": "South West"},
    {"name": "South Yorkshire", "region": "Yorkshire and the Humber"},
    {"name": "Staffordshire", "region": "West Midlands"},
    {"name": "Suffolk", "region": "East of England"},
    {"name": "Surrey", "region": "South East"},
    {"name": "Sussex", "region": "South East"},
    {"name": "Tyne & Wear", "region": "North East"},
    {"name": "Warwickshire", "region": "West Midlands"},
    {"name": "West Yorkshire", "region": "Yorkshire and the Humber"},
    {"name": "Wiltshire", "region": "South West"},
    {"name": "Worcestershire", "region": "West Midlands"},
    {"name": "Argyll & Bute", "region": "Scotland"},
    {"name": "Ayrshire", "region": "Scotland"},
    {"name": "Central Scotland", "region": "Scotland"},
    {"name": "Dumfries & Galloway", "region": "Scotland"},
    {"name": "Dunbartonshire", "region": "Scotland"},
    {"name": "Fife", "region": "Scotland"},
    {"name": "Grampian", "region": "Scotland"},
    {"name": "Highlands", "region": "Scotland"},
    {"name": "Lanarkshire", "region": "Scotland"},
    {"name": "Lothian", "region": "Scotland"},
    {"name": "Renfrewshire", "region": "Scotland"},
    {"name": "Scottish Borders", "region": "Scotland"},
    {"name": "Scottish Islands", "region": "Scotland"},
    {"name": "Tayside", "region": "Scotland"},
    {"name": "Anglesey", "region": "Wales"},
    {"name": "Carmarthenshire", "region": "Wales"},
    {"name": "Ceredigion", "region": "Wales"},
    {"name": "Conwy", "region": "Wales"},
    {"name": "Denbighshire", "region": "Wales"},
    {"name": "Flintshire", "region": "Wales"},
    {"name": "Glamorgan", "region": "Wales"},
    {"name": "Gwent", "region": "Wales"},
    {"name": "Gwynedd", "region": "Wales"},
    {"name": "Pembrokeshire", "region": "Wales"},
    {"name": "Powys", "region": "Wales"},
    {"name": "Wrexham", "region": "Wales"},
    {"name": "Birmingham", "region": "West Midlands"},
    {"name": "Bournemouth", "region": "South West"},
    {"name": "Bradford", "region": "Yorkshire and the Humber"},
    {"name": "Brighton & Hove", "region": "South East"},
    {"name": "Bristol", "region": "South West"},
    {"name": "Cardiff", "region": "Wales"},
    {"name": "Coventry", "region": "West Midlands"},
    {"name": "Edinburgh", "region": "Scotland"},
    {"name": "Glasgow", "region": "Scotland"},
    {"name": "Leeds", "region": "Yorkshire and the Humber"},
    {"name": "Leicester", "region": "East Midlands"},
    {"name": "Liverpool", "region": "North West"},
    {"name": "London", "region": "London"},
    {"name": "Manchester", "region": "North West"},
    {"name": "Middlesbrough", "region": "North East"},
    {"name": "Newcastle", "region": "North East"},
    {"name": "Nottingham", "region": "East Midlands"},
    {"name": "Sheffield", "region": "Yorkshire and the Humber"},
    {"name": "Southampton", "region": "South East"},
    {"name": "Swansea", "region": "Wales"}
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

-- Also handle the variant spelling "Middlesborough" (used in some HTML forms)
-- by inserting it as an alias if it doesn't exist
INSERT INTO counties ("Name", region, region_id)
SELECT 'Middlesborough', 'North East', id FROM regions WHERE name = 'North East' LIMIT 1
WHERE NOT EXISTS (SELECT 1 FROM counties WHERE "Name" = 'Middlesborough');

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
