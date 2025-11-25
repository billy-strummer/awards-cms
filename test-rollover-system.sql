-- ============================================
-- TEST: Year-Over-Year Rollover System
-- ============================================
-- Run these queries to verify the system is working
-- ============================================

-- TEST 1: Check actual_winner column exists
-- Expected: Should show actual_winner with type "boolean"
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'award_assignments'
  AND column_name = 'actual_winner';

-- EXPECTED RESULT:
-- | column_name    | data_type | column_default |
-- | actual_winner  | boolean   | false          |

-- ============================================

-- TEST 2: Check triggers were created
-- Expected: Should show 2 triggers for previous winner detection
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_name LIKE '%previous_winner%'
ORDER BY trigger_name;

-- EXPECTED RESULT:
-- | trigger_name                              | event_manipulation | event_object_table  | action_timing |
-- | trigger_auto_flag_previous_winner_insert  | INSERT             | award_assignments   | BEFORE        |
-- | trigger_auto_flag_previous_winner_update  | UPDATE             | award_assignments   | BEFORE        |

-- ============================================

-- TEST 3: Check functions exist
-- Expected: Should show 3 functions
SELECT
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_name IN (
  'get_nominee_history',
  'is_previous_winner',
  'copy_nominees_to_new_year',
  'auto_flag_previous_winner'
)
ORDER BY routine_name;

-- EXPECTED RESULT:
-- | routine_name                | routine_type | return_type |
-- | auto_flag_previous_winner   | FUNCTION     | trigger     |
-- | copy_nominees_to_new_year   | FUNCTION     | record      |
-- | get_nominee_history         | FUNCTION     | record      |
-- | is_previous_winner          | FUNCTION     | boolean     |

-- ============================================

-- TEST 4: Check indexes were created
-- Expected: Should show 2 indexes for performance
SELECT
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE indexname IN (
  'idx_award_assignments_history',
  'idx_awards_year'
)
ORDER BY indexname;

-- EXPECTED RESULT:
-- | indexname                        | tablename          |
-- | idx_award_assignments_history    | award_assignments  |
-- | idx_awards_year                  | awards             |

-- ============================================

-- TEST 5: Test get_nominee_history function
-- This will test if the function works (even with no data, it should return 0s)
SELECT * FROM get_nominee_history(
  (SELECT id FROM organisations LIMIT 1)
);

-- EXPECTED RESULT (if no nominations yet):
-- | total_nominations | total_wins | years_nominated | years_won | awards_won |
-- | 0                 | 0          | {}              | {}        | {}         |

-- ============================================

-- TEST 6: Test is_previous_winner function
-- Should return FALSE for any company before any winners are marked
SELECT is_previous_winner(
  (SELECT id FROM organisations LIMIT 1),
  '2026'
);

-- EXPECTED RESULT:
-- | is_previous_winner |
-- | false              |

-- ============================================

-- TEST 7: Verify all columns in award_assignments table
-- Should show all the columns we need for the system
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'award_assignments'
  AND column_name IN (
    'nomination_date',
    'nomination_source',
    'is_previous_winner',
    'winner_position',
    'voting_slug',
    'public_vote_count',
    'actual_winner'
  )
ORDER BY column_name;

-- EXPECTED RESULT: Should show all 7 columns
-- | column_name        | data_type         | is_nullable | column_default                  |
-- | actual_winner      | boolean           | YES         | false                           |
-- | is_previous_winner | boolean           | YES         | false                           |
-- | nomination_date    | date              | YES         | NULL                            |
-- | nomination_source  | character varying | YES         | 'csv_import'::character varying |
-- | public_vote_count  | integer           | YES         | 0                               |
-- | voting_slug        | text              | YES         | NULL                            |
-- | winner_position    | integer           | YES         | NULL                            |

-- ============================================

-- SUMMARY CHECK: Count all components
-- This gives you a quick overview
SELECT
  'Columns' as component,
  COUNT(*) as count
FROM information_schema.columns
WHERE table_name = 'award_assignments'
  AND column_name IN ('nomination_date', 'nomination_source', 'is_previous_winner',
                      'winner_position', 'voting_slug', 'public_vote_count', 'actual_winner')

UNION ALL

SELECT
  'Triggers' as component,
  COUNT(*) as count
FROM information_schema.triggers
WHERE trigger_name LIKE '%previous_winner%'

UNION ALL

SELECT
  'Functions' as component,
  COUNT(*) as count
FROM information_schema.routines
WHERE routine_name IN ('get_nominee_history', 'is_previous_winner',
                       'copy_nominees_to_new_year', 'auto_flag_previous_winner')

UNION ALL

SELECT
  'Indexes' as component,
  COUNT(*) as count
FROM pg_indexes
WHERE indexname IN ('idx_award_assignments_history', 'idx_awards_year');

-- EXPECTED RESULT:
-- | component  | count |
-- | Columns    | 7     |
-- | Triggers   | 2     |
-- | Functions  | 4     |
-- | Indexes    | 2     |

-- ============================================
-- ALL TESTS PASSED IF:
-- ✅ TEST 1: Shows actual_winner column with boolean type
-- ✅ TEST 2: Shows 2 triggers (insert and update)
-- ✅ TEST 3: Shows 4 functions
-- ✅ TEST 4: Shows 2 indexes
-- ✅ TEST 5: Function runs without error
-- ✅ TEST 6: Function runs without error
-- ✅ TEST 7: Shows all 7 columns
-- ✅ SUMMARY: Shows 7, 2, 4, 2
-- ============================================
