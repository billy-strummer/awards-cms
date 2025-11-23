-- ============================================
-- VERIFY EVENT MANAGEMENT TABLES
-- ============================================
-- Run this query to check if all tables exist
-- ============================================

SELECT
  'running_order' as table_name,
  EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'running_order'
  ) as exists
UNION ALL
SELECT
  'running_order_settings',
  EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'running_order_settings'
  )
UNION ALL
SELECT
  'event_tables',
  EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'event_tables'
  )
UNION ALL
SELECT
  'table_assignments',
  EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'table_assignments'
  );

-- If all show "true", Event Management is ready!
-- If any show "false", run database-event-management-setup.sql
