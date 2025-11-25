-- ============================================
-- CREATE ALL BEDFORDSHIRE 2026 AWARD CATEGORIES
-- ============================================
-- This creates all 52 award categories for Bedfordshire 2026
-- Organized by 7 sectors matching the CSV import structure
-- ============================================

-- Insert awards for Bedfordshire 2026
INSERT INTO awards (
  id,
  award_name,
  sector,
  region,
  year,
  status,
  is_active,
  show_on_website,
  created_at
) VALUES

-- BUILDING & CONSTRUCTION (8 awards)
(gen_random_uuid(), 'Roofing Company', 'BUILDING & CONSTRUCTION', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Brickwork & Masonary Services', 'BUILDING & CONSTRUCTION', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'General Building Company', 'BUILDING & CONSTRUCTION', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Loft Conversion Specialist', 'BUILDING & CONSTRUCTION', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Extension Specialist', 'BUILDING & CONSTRUCTION', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Groundworks & Foundations Specialist', 'BUILDING & CONSTRUCTION', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Structural Steelwork Specialist', 'BUILDING & CONSTRUCTION', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Structural Engineering Specialist', 'BUILDING & CONSTRUCTION', 'Bedfordshire', '2026', 'Active', true, true, NOW()),

-- BUILDING & CONSTRUCTION continued (2 more)
(gen_random_uuid(), 'Drainage Company', 'BUILDING & CONSTRUCTION', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Maintenance Services', 'BUILDING & CONSTRUCTION', 'Bedfordshire', '2026', 'Active', true, true, NOW()),

-- MECHANICAL, ELECTRICAL & PLUMBING (7 awards)
(gen_random_uuid(), 'Heating Company', 'MECHANICAL, ELECTRICAL & PLUMBING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Plumbing Company', 'MECHANICAL, ELECTRICAL & PLUMBING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Air-Conditioning & Ventilation Company', 'MECHANICAL, ELECTRICAL & PLUMBING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Electrical Company', 'MECHANICAL, ELECTRICAL & PLUMBING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Smart Home & Automation Company', 'MECHANICAL, ELECTRICAL & PLUMBING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'EV Charger Installation Company', 'MECHANICAL, ELECTRICAL & PLUMBING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Underfloor Heating Specialist', 'MECHANICAL, ELECTRICAL & PLUMBING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),

-- CARPENTRY & JOINERY (5 awards)
(gen_random_uuid(), 'Carpentry Company', 'CARPENTRY & JOINERY', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Staircase Specialist', 'CARPENTRY & JOINERY', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Bespoke Joinery Company', 'CARPENTRY & JOINERY', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Bespoke Cabinet Maker', 'CARPENTRY & JOINERY', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Timber Windows Specialist', 'CARPENTRY & JOINERY', 'Bedfordshire', '2026', 'Active', true, true, NOW()),

-- INTERIOR FIT-OUT & FINISHING (13 awards)
(gen_random_uuid(), 'Interior Refurbishment Company', 'INTERIOR FIT-OUT & FINISHING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Plastering Services', 'INTERIOR FIT-OUT & FINISHING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Kitchen Installer', 'INTERIOR FIT-OUT & FINISHING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Bathroom Installer', 'INTERIOR FIT-OUT & FINISHING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Flooring Installer', 'INTERIOR FIT-OUT & FINISHING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Tiling Services', 'INTERIOR FIT-OUT & FINISHING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Painting & Decorating', 'INTERIOR FIT-OUT & FINISHING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Carpet Fitting Services', 'INTERIOR FIT-OUT & FINISHING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Curtins & Blinds Installer', 'INTERIOR FIT-OUT & FINISHING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Home Office Installer', 'INTERIOR FIT-OUT & FINISHING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Drylining & Ceiling Specialist', 'INTERIOR FIT-OUT & FINISHING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Screeding Specialist', 'INTERIOR FIT-OUT & FINISHING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Rendering Services', 'INTERIOR FIT-OUT & FINISHING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),

-- OUTDOOR & LANDSCAPING (9 awards)
(gen_random_uuid(), 'Landscaping & Garden Design Company', 'OUTDOOR & LANDSCAPING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Driveway & Paving Specialist', 'OUTDOOR & LANDSCAPING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Gardening Services', 'OUTDOOR & LANDSCAPING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Fencing Company', 'OUTDOOR & LANDSCAPING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Decking Specialist', 'OUTDOOR & LANDSCAPING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Garden Outbuilding Specialist', 'OUTDOOR & LANDSCAPING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Tree Surgery Services', 'OUTDOOR & LANDSCAPING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Outdoor Lighting & Electrical Solutions', 'OUTDOOR & LANDSCAPING', 'Bedfordshire', '2026', 'Active', true, true, NOW()),

-- ENERGY, TECH & SUSTAINABILITY (6 awards)
(gen_random_uuid(), 'Renewable Energy Provider', 'ENERGY, TECH & SUSTAINABILITY', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'PV Installer', 'ENERGY, TECH & SUSTAINABILITY', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Insulation & Energy Efficiency Provider', 'ENERGY, TECH & SUSTAINABILITY', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Security Systems Provider', 'ENERGY, TECH & SUSTAINABILITY', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Window & Door Installer', 'ENERGY, TECH & SUSTAINABILITY', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Locksmith', 'ENERGY, TECH & SUSTAINABILITY', 'Bedfordshire', '2026', 'Active', true, true, NOW()),

-- SPECIALIST TRADES (4 awards)
(gen_random_uuid(), 'Scaffolding Company', 'SPECIALIST TRADES', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Signage & Shopfitting Specialist', 'SPECIALIST TRADES', 'Bedfordshire', '2026', 'Active', true, true, NOW()),
(gen_random_uuid(), 'Asbestos Removal Specialist', 'SPECIALIST TRADES', 'Bedfordshire', '2026', 'Active', true, true, NOW())

ON CONFLICT (id) DO NOTHING;

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- Run this to verify all awards were created
SELECT
  sector,
  COUNT(*) as award_count,
  STRING_AGG(award_name, ', ' ORDER BY award_name) as awards
FROM awards
WHERE region = 'Bedfordshire' AND year = '2026'
GROUP BY sector
ORDER BY sector;

-- Summary count
SELECT COUNT(*) as total_bedfordshire_2026_awards
FROM awards
WHERE region = 'Bedfordshire' AND year = '2026';
