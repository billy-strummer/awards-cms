-- ============================================
-- DIAGNOSTIC: Check actual table structure
-- ============================================
-- Run this to see what columns exist in your tables
-- ============================================

-- Check organisations table columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'organisations'
ORDER BY ordinal_position;

-- Check awards table columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'awards'
ORDER BY ordinal_position;

-- Sample some actual data from organisations
SELECT * FROM organisations LIMIT 3;

-- Sample some actual data from awards where name contains Extension
SELECT * FROM awards WHERE award_name ILIKE '%Extension%' LIMIT 5;
