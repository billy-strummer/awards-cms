# Previous Winner Auto-Flagging System

## Overview

This system automatically detects and flags companies as **Previous Winners** when they're nominated in subsequent award years, eliminating manual tracking.

---

## How It Works

### Two Separate Fields:

1. **`winner_position`** (1, 2, 3)
   - Your **recommended** top 3 before final judging
   - Shows Gold/Silver/Bronze badges
   - Set in CSV or manually

2. **`actual_winner`** (true/false)
   - The **final winner** after judging/voting
   - Used to auto-flag future nominations
   - Set after awards ceremony

### Automatic Detection:

When a company is nominated for a 2026 award, the system:
1. Checks if they won ANY award in previous years (2025, 2024, etc.)
2. If yes → automatically sets `is_previous_winner = TRUE`
3. They get the 🏅 **Previous Winner** badge

---

## Setup Instructions

### 1. Run the Automation Setup (ONE TIME)

Execute this in Supabase SQL Editor:

```sql
-- Run the entire file
\i database-previous-winner-automation.sql
```

This creates:
- ✅ `actual_winner` column
- ✅ Database trigger for auto-detection
- ✅ Performance indexes

### 2. Update Import Script (ALREADY DONE)

The CSV import script (`database-import-award-assignments.sql`) now includes `actual_winner` column.

---

## Usage Workflow

### Year 1: 2025 Awards

**Step 1: Import Nominees (CSV)**

Your CSV just needs the basics:
```csv
sector,region,award_category,organisation,winner_position
Construction,Bedfordshire,Best Builder,ABC Construction Ltd,1
Construction,Bedfordshire,Best Builder,XYZ Builders Ltd,2
Construction,Bedfordshire,Best Builder,Top Build Co,3
```

- `winner_position` = your recommended top 3
- Leave `is_previous_winner` blank (no prior winners yet)
- Leave `actual_winner` blank (haven't judged yet)

**Step 2: After Awards Ceremony**

Mark the actual winners in Supabase:

```sql
-- Mark ABC Construction Ltd as the winner
UPDATE award_assignments
SET actual_winner = TRUE
WHERE award_id = (SELECT id FROM awards WHERE award_name = 'Best Builder' AND year = '2025')
  AND organisation_id = (SELECT id FROM organisations WHERE company_name = 'ABC Construction Ltd');
```

Or do this via the CMS UI (can add an "✓ Mark as Winner" button if needed).

---

### Year 2: 2026 Awards

**Step 1: Import New Nominees (CSV)**

```csv
sector,region,award_category,organisation,winner_position
Construction,Bedfordshire,Best Builder,ABC Construction Ltd,
Construction,Bedfordshire,Best Builder,New Builder Co,1
Construction,Bedfordshire,Best Builder,Another New Co,2
```

**Step 2: Automatic Detection Happens**

When you run the import:
- **ABC Construction Ltd** → ✅ Auto-flagged as `is_previous_winner = TRUE`
- Gets the 🏅 **Previous Winner** badge automatically
- No manual work needed!

---

## CSV Column Reference

### Optional Columns (add to your CSV if you want more control):

| Column | Values | Purpose | Default if Blank |
|--------|--------|---------|------------------|
| `nomination_date` | `2024-11-20` | Track when nominated | NULL |
| `nomination_source` | `self_nomination`, `csv_import`, `admin_manual` | How they were nominated | `csv_import` |
| `is_previous_winner` | `true`, `yes`, `1` | Override auto-detection | FALSE (auto-detected) |
| `winner_position` | `1`, `2`, `3` | Recommended top 3 | NULL |
| `actual_winner` | `true`, `yes`, `1` | Final winner (usually set AFTER import) | FALSE |

### When to Use `is_previous_winner` in CSV:

**Let the system auto-detect (recommended):**
- Leave column blank or omit entirely
- System checks database and flags automatically

**Manually override (rare cases):**
- Set `is_previous_winner = true` in CSV
- Example: Won a different awards program
- Example: Won before your database history

**Priority:** CSV `is_previous_winner = TRUE` overrides auto-detection

---

## Testing the System

### Test 1: Verify Setup

```sql
-- Check trigger exists
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%previous_winner%';
```

Should show 2 triggers.

### Test 2: Simulate 2025 → 2026 Workflow

```sql
-- 1. Create a test 2025 winner
INSERT INTO award_assignments (
  award_id,
  organisation_id,
  status,
  assigned_date,
  actual_winner
)
VALUES (
  (SELECT id FROM awards WHERE award_name = 'Best Builder' AND year = '2025'),
  (SELECT id FROM organisations WHERE company_name = 'Test Company' LIMIT 1),
  'winner',
  NOW(),
  TRUE
);

-- 2. Now nominate them for a 2026 award (simulating CSV import)
INSERT INTO award_assignments (
  award_id,
  organisation_id,
  status,
  assigned_date
)
VALUES (
  (SELECT id FROM awards WHERE award_name = 'Best Renovator' AND year = '2026'),
  (SELECT id FROM organisations WHERE company_name = 'Test Company' LIMIT 1),
  'nominated',
  NOW()
);

-- 3. Check if they were auto-flagged
SELECT
  o.company_name,
  a.award_name,
  a.year,
  aa.is_previous_winner,  -- Should be TRUE!
  aa.actual_winner
FROM award_assignments aa
JOIN awards a ON aa.award_id = a.id
JOIN organisations o ON aa.organisation_id = o.id
WHERE o.company_name = 'Test Company'
ORDER BY a.year DESC;
```

The 2026 nomination should have `is_previous_winner = TRUE` automatically!

---

## Utility Queries

### View All Winners by Year

```sql
SELECT
  a.year,
  a.award_name,
  o.company_name as winner,
  aa.winner_position as recommended_position
FROM award_assignments aa
JOIN awards a ON aa.award_id = a.id
JOIN organisations o ON aa.organisation_id = o.id
WHERE aa.actual_winner = TRUE
ORDER BY a.year DESC, a.award_name;
```

### Find Repeat Winners

```sql
SELECT
  o.company_name,
  COUNT(*) as times_won,
  STRING_AGG(a.award_name || ' (' || a.year || ')', ', ' ORDER BY a.year) as wins
FROM award_assignments aa
JOIN awards a ON aa.award_id = a.id
JOIN organisations o ON aa.organisation_id = o.id
WHERE aa.actual_winner = TRUE
GROUP BY o.id, o.company_name
HAVING COUNT(*) > 1
ORDER BY times_won DESC;
```

### Check Previous Winner Badges

```sql
SELECT
  a.year,
  a.award_name,
  o.company_name,
  aa.is_previous_winner,
  aa.actual_winner,
  aa.winner_position
FROM award_assignments aa
JOIN awards a ON aa.award_id = a.id
JOIN organisations o ON aa.organisation_id = o.id
WHERE aa.is_previous_winner = TRUE
ORDER BY a.year DESC;
```

---

## UI Integration

The CMS already displays the 🏅 **Previous Winner** badge when `is_previous_winner = TRUE`.

### Optional Enhancement: "Mark as Winner" Button

In `assignments.js`, you could add:

```javascript
// Add to the action buttons area
<button class="btn btn-sm btn-success"
  onclick="assignments.markAsWinner(${assignment.id})">
  ✓ Mark as Winner
</button>

// Add this method:
async markAsWinner(assignmentId) {
  const { error } = await STATE.client
    .from('award_assignments')
    .update({ actual_winner: true, status: 'winner' })
    .eq('id', assignmentId);

  if (error) {
    utils.showToast('Error marking winner', 'error');
  } else {
    utils.showToast('Marked as winner!', 'success');
    this.loadAssignments(this.currentAwardId);
  }
}
```

This lets you mark winners directly from the CMS instead of SQL.

---

## Summary

✅ **No more manual tracking** of previous winners
✅ **Automatic detection** across award years
✅ **CSV override** for special cases
✅ **Works immediately** once setup script is run
✅ **Scales across decades** of awards history

The system handles everything automatically—just mark `actual_winner = TRUE` after each year's ceremony, and future nominations will be auto-flagged!
