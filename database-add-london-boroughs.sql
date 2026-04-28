-- Add London Boroughs to the areas table
-- These replace the old 'London, North/South/East/West' quadrant entries
-- Run this after the main areas seed SQL

INSERT INTO areas (display_name, country, area_type, is_small, sort_order, is_active)
SELECT v.display_name, v.country, v.area_type, v.is_small, v.sort_order, v.is_active
FROM (VALUES
  ('Barking & Dagenham',   'England', 'borough', false, 1001, true),
  ('Barnet',               'England', 'borough', false, 1002, true),
  ('Bexley',               'England', 'borough', false, 1003, true),
  ('Brent',                'England', 'borough', false, 1004, true),
  ('Bromley',              'England', 'borough', false, 1005, true),
  ('Camden',               'England', 'borough', false, 1006, true),
  ('City of London',       'England', 'borough', true,  1007, true),
  ('Croydon',              'England', 'borough', false, 1008, true),
  ('Ealing',               'England', 'borough', false, 1009, true),
  ('Enfield',              'England', 'borough', false, 1010, true),
  ('Greenwich',            'England', 'borough', false, 1011, true),
  ('Hackney',              'England', 'borough', false, 1012, true),
  ('Hammersmith & Fulham', 'England', 'borough', false, 1013, true),
  ('Haringey',             'England', 'borough', false, 1014, true),
  ('Harrow',               'England', 'borough', false, 1015, true),
  ('Havering',             'England', 'borough', false, 1016, true),
  ('Hillingdon',           'England', 'borough', false, 1017, true),
  ('Hounslow',             'England', 'borough', false, 1018, true),
  ('Islington',            'England', 'borough', false, 1019, true),
  ('Kensington & Chelsea', 'England', 'borough', false, 1020, true),
  ('Kingston upon Thames', 'England', 'borough', false, 1021, true),
  ('Lambeth',              'England', 'borough', false, 1022, true),
  ('Lewisham',             'England', 'borough', false, 1023, true),
  ('Merton',               'England', 'borough', false, 1024, true),
  ('Newham',               'England', 'borough', false, 1025, true),
  ('Redbridge',            'England', 'borough', false, 1026, true),
  ('Richmond upon Thames', 'England', 'borough', false, 1027, true),
  ('Southwark',            'England', 'borough', false, 1028, true),
  ('Sutton',               'England', 'borough', false, 1029, true),
  ('Tower Hamlets',        'England', 'borough', false, 1030, true),
  ('Waltham Forest',       'England', 'borough', false, 1031, true),
  ('Wandsworth',           'England', 'borough', false, 1032, true),
  ('Westminster',          'England', 'borough', false, 1033, true)
) AS v(display_name, country, area_type, is_small, sort_order, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM areas WHERE areas.display_name = v.display_name AND areas.country = 'England'
);
