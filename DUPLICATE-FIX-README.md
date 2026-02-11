# Duplicate Award Assignments - Fix Documentation

## Problem Summary

The website was showing duplicate award assignments due to:

1. **Missing duplicate check in the frontend** - The `assignCompany()` function in `assignments.js` was inserting records without checking if the assignment already existed
2. **Historical data imports** - CSV imports may have introduced duplicates before the UNIQUE constraint was fully enforced
3. **Multiple rapid clicks** - Users clicking the assign button multiple times quickly could create duplicates before the UI refreshed

## What Was Fixed

### 1. Code Fix - `assignments.js` (Line 286-333)

Added duplicate checking before inserting new assignments:

```javascript
// Check if this assignment already exists (prevent duplicates)
const { data: existingAssignment, error: checkError } = await STATE.client
  .from('award_assignments')
  .select('id')
  .eq('award_id', this.currentAwardId)
  .eq('organisation_id', orgId)
  .maybeSingle();

if (existingAssignment) {
  utils.showToast(`${companyName} is already assigned to this award!`, 'warning');
  return;
}
```

**Impact**: Prevents future duplicates from being created through the UI.

### 2. Database Cleanup Script - `database-cleanup-duplicates.sql`

Enhanced the existing cleanup script with:
- **Section 1**: Detection queries to find duplicates
- **Section 2**: Detailed analysis showing which records will be kept/deleted
- **Section 3**: Safe cleanup query (commented out for safety)
- **Section 4**: Verification queries
- **Section 5**: Optional limit to 5 nominees per award

**Strategy**: Keeps the most recent assignment for each company+award pair, deletes older duplicates.

## How to Remove Existing Duplicates

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase Dashboard: https://qdzyknercdqwhwijbcxf.supabase.co
2. Navigate to **SQL Editor**
3. Create a new query

### Step 2: Detect Duplicates

Copy and run **Section 1** from `database-cleanup-duplicates.sql`:

```sql
-- Query 2: Find exact duplicate assignments (same company + same award)
SELECT
  o.company_name,
  aw.award_name,
  aw.year,
  COUNT(*) as duplicate_count,
  COUNT(*) - 1 as records_to_delete,
  ...
FROM award_assignments aa
...
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, aw.award_name;
```

This will show you:
- Which companies have duplicates
- How many duplicates exist
- Total records that will be deleted

### Step 3: Review Detailed Analysis

Run **Section 2** to see exactly which records will be kept vs deleted:

```sql
-- Show all duplicate records with full details
SELECT
  aa.id,
  aa.assigned_date,
  o.company_name,
  aw.award_name,
  ...
  CASE
    WHEN aa.id IN (...) THEN '✓ KEEP'
    ELSE '✗ DELETE'
  END as action
...
```

Review this carefully to ensure the correct records will be kept.

### Step 4: Remove Duplicates

**⚠️ IMPORTANT: This is permanent! Review Steps 2-3 first.**

Uncomment and run the cleanup query from **Section 3**:

```sql
DELETE FROM award_assignments
WHERE id NOT IN (
  -- Keep only the most recent assignment for each org+award pair
  SELECT DISTINCT ON (organisation_id, award_id) id
  FROM award_assignments
  ORDER BY organisation_id, award_id,
    assigned_date DESC NULLS LAST,
    created_at DESC NULLS LAST,
    id DESC
);
```

### Step 5: Verify Cleanup

Run the verification query from **Section 4**:

```sql
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ NO DUPLICATES FOUND - Cleanup successful!'
    ELSE '⚠️ STILL HAS ' || COUNT(*) || ' DUPLICATE COMBINATIONS'
  END as verification_result
FROM (...)
```

You should see: **"✅ NO DUPLICATES FOUND - Cleanup successful!"**

## Database Schema Protection

The database already has a UNIQUE constraint to prevent duplicates:

```sql
-- In database-schema.sql
UNIQUE(award_id, organisation_id)
```

This constraint should prevent duplicates at the database level, but the frontend code now also checks before attempting to insert.

## Future Prevention

With the code fix in `assignments.js`, duplicates should no longer be created through:
- ✅ Manual assignments in the UI
- ✅ Multiple rapid clicks on assign button
- ✅ Network retry attempts

The database UNIQUE constraint provides an additional safety layer.

## Testing the Fix

1. Try to assign the same company to the same award twice
2. You should see: **"[Company Name] is already assigned to this award!"**
3. The duplicate should NOT be created

## Monitoring

To periodically check for duplicates, run Section 1 Query 3:

```sql
SELECT
  COUNT(*) as duplicate_combinations,
  SUM(cnt - 1) as total_records_to_delete
FROM (
  SELECT organisation_id, award_id, COUNT(*) as cnt
  FROM award_assignments
  GROUP BY organisation_id, award_id
  HAVING COUNT(*) > 1
) duplicates;
```

Expected result after cleanup: `0 duplicate_combinations`

## Support

If you encounter any issues:
1. Check the browser console for error messages
2. Review the SQL query results carefully
3. Make sure you're running queries in the correct order
4. Keep a database backup before running DELETE queries

---

**Last Updated**: 2025-11-23
**Files Modified**:
- `assignments.js` - Added duplicate prevention
- `database-cleanup-duplicates.sql` - Enhanced cleanup script
