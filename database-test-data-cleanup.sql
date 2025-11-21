-- ============================================
-- REMOVE TEST DATA FROM AWARDS CMS
-- ============================================
-- Removes all test data created by the test data generator
-- All test data has 'TEST_MODE_' prefix
-- ============================================

-- Delete in correct order to respect foreign key constraints

-- 1. Delete table assignments for test event
DELETE FROM table_assignments
WHERE event_id = '00000000-0000-0000-0000-000000000001';

-- 2. Delete event tables for test event
DELETE FROM event_tables
WHERE event_id = '00000000-0000-0000-0000-000000000001';

-- 3. Delete running order for test event
DELETE FROM running_order
WHERE event_id = '00000000-0000-0000-0000-000000000001';

-- 4. Delete running order settings for test event
DELETE FROM running_order_settings
WHERE event_id = '00000000-0000-0000-0000-000000000001';

-- 5. Delete event guests (RSVPs) for test event
DELETE FROM event_guests
WHERE event_id = '00000000-0000-0000-0000-000000000001';

-- 6. Delete media gallery items for test organisations
DELETE FROM media_gallery
WHERE organisation_id IN (
  SELECT id FROM organisations WHERE company_name LIKE 'TEST_MODE_%'
);

-- 7. Delete entries for test organisations
DELETE FROM entries
WHERE organisation_id IN (
  SELECT id FROM organisations WHERE company_name LIKE 'TEST_MODE_%'
);

-- 8. Delete award assignments (winners)
DELETE FROM award_assignments
WHERE id >= '30000000-0000-0000-0000-000000000001'
  AND id <= '30000000-0000-0000-0000-000000000030';

-- 9. Delete test organisations
DELETE FROM organisations
WHERE company_name LIKE 'TEST_MODE_%';

-- 10. Delete test awards
DELETE FROM awards
WHERE award_name LIKE 'TEST_MODE_%';

-- 11. Delete test event
DELETE FROM events
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Display success message
SELECT
  'Test Data Removed Successfully!' as status,
  'All test organisations, awards, winners, and event data deleted' as result,
  'Safe to create new test data or use production data' as next_step;
