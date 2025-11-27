-- ============================================
-- UPDATE SECTORS FROM ALL CAPS TO TITLE CASE
-- ============================================
-- This updates all awards to use title case sector names
-- to match the updated config.js dropdown

UPDATE awards
SET sector = CASE sector
  WHEN 'BUILDING & CONSTRUCTION' THEN 'Building & Construction'
  WHEN 'CARPENTRY & JOINERY' THEN 'Carpentry & Joinery'
  WHEN 'ENERGY, TECH & SUSTAINABILITY' THEN 'Energy, Tech & Sustainability'
  WHEN 'INTERIOR FIT-OUT & FINISHING' THEN 'Interior Fit-Out & Finishing'
  WHEN 'MECHANICAL, ELECTRICAL & PLUMBING' THEN 'Mechanical, Electrical & Plumbing'
  WHEN 'OUTDOOR & LANDSCAPING' THEN 'Outdoor & Landscaping'
  WHEN 'SPECIALIST TRADES' THEN 'Specialist Trades'
  ELSE sector
END
WHERE sector IN (
  'BUILDING & CONSTRUCTION',
  'CARPENTRY & JOINERY',
  'ENERGY, TECH & SUSTAINABILITY',
  'INTERIOR FIT-OUT & FINISHING',
  'MECHANICAL, ELECTRICAL & PLUMBING',
  'OUTDOOR & LANDSCAPING',
  'SPECIALIST TRADES'
);

-- Verification query
SELECT sector, COUNT(*) as count
FROM awards
GROUP BY sector
ORDER BY sector;
