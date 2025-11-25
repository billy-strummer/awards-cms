# Year-Over-Year Rollover System - Complete Guide

## Overview

Your awards CMS now includes automatic year-over-year tracking that:
- ✅ Keeps ALL data in the database forever (no re-importing CSVs)
- ✅ Auto-detects previous winners when adding nominees via CMS
- ✅ Provides one-click rollover of nominees to new award years
- ✅ Tracks complete nominee history across all years
- ✅ Automatically flags previous winners with 🏅 badges

---

## Your Workflow

### **Year 1: 2026 (Initial Setup - NOW)**

1. **Import CSV** with 2026 nominees → Data stays in database forever
2. **Manage nominees** via CMS throughout the year
3. **Mark winners** by clicking "Winner" button → Sets `actual_winner = TRUE`
4. **Winners announced** at ceremony

### **Year 2: 2027 and Beyond**

1. **Create 2027 awards** (same award names, new year)
2. **Option A:** Copy all 2026 nominees to 2027 (bulk rollover)
3. **Option B:** Add new nominees individually via CMS
4. **System automatically** flags previous winners from 2026, 2025, 2024, etc.
5. **Repeat annually**

---

## Setup (ONE-TIME - Do This Now)

Run this script in Supabase SQL Editor:

```sql
-- Execute the entire file
\i database-year-rollover-system.sql
```

This creates:
- `actual_winner` field to track final winners
- Automatic triggers to detect previous winners
- Rollover functions for copying nominees year-to-year
- Performance indexes for history queries

---

## How It Works

### **Two Separate Tracking Fields:**

| Field | Purpose | Who Sets It | When |
|-------|---------|-------------|------|
| `winner_position` (1, 2, 3) | Your recommended top 3 BEFORE judging | You (in CSV or manually) | Before awards ceremony |
| `actual_winner` (TRUE/FALSE) | The final winner AFTER judging | CMS automatically when you click "Winner" | After awards ceremony |

### **Automatic Previous Winner Detection:**

When you add a nominee (via CMS or CSV), the system:
1. Checks ALL previous years in the database
2. If company won ANY award before → Sets `is_previous_winner = TRUE`
3. Shows 🏅 **Previous Winner** badge automatically

**Example:**
- 2026: ABC Construction Ltd wins "Best Builder"
- 2027: You add ABC Construction Ltd to "Best Renovator"
- System automatically flags them as Previous Winner ✅

---

## Complete Workflow Examples

### **Example 1: 2026 Initial Setup (You're Here)**

#### Step 1: Import Your CSV

CSV content:
```csv
sector,region,award_category,organisation,winner_position
Construction,Bedfordshire,Best Builder,ABC Construction Ltd,1
Construction,Bedfordshire,Best Builder,XYZ Builders Ltd,2
Construction,Bedfordshire,Best Builder,Top Build Co,3
Construction,Bedfordshire,Best Builder,Another Builder Ltd,
```

Upload to `award_assignments_staging` table via Supabase UI, then run import script.

#### Step 2: Throughout the Year

- Add/remove nominees via CMS
- Update winner_position recommendations
- Track votes, manage data

#### Step 3: After Awards Ceremony (December 2026)

Mark the actual winners in CMS:

1. Go to award category
2. Find the winner
3. Click **"Winner"** button
4. System automatically sets `actual_winner = TRUE` ✅

**OR** mark multiple winners via SQL:
```sql
-- Mark ABC Construction Ltd as winner
UPDATE award_assignments
SET status = 'winner', actual_winner = TRUE
WHERE award_id = (SELECT id FROM awards WHERE award_name = 'Best Builder' AND year = '2026')
  AND organisation_id = (SELECT id FROM organisations WHERE company_name = 'ABC Construction Ltd');
```

---

### **Example 2: 2027 Rollover**

#### Step 1: Create 2027 Awards

Create new awards with same names but year = 2027 (via admin panel or SQL).

#### Step 2: Roll Over Nominees

**Option A - Copy ALL 2026 nominees:**
```sql
SELECT * FROM copy_nominees_to_new_year('2026', '2027', TRUE, TRUE);
-- Parameters: from_year, to_year, copy_winners, copy_all_nominees
```

**Option B - Copy ONLY 2026 winners:**
```sql
SELECT * FROM copy_nominees_to_new_year('2026', '2027', TRUE, FALSE);
```

**Option C - Add individually via CMS:**
- Go to 2027 award category
- Click "Add Companies" on right panel
- Select companies to add
- System auto-detects previous winners ✅

#### Step 3: What Happens Automatically

After running rollover or adding via CMS:
- ✅ ABC Construction Ltd → Flagged as "Previous Winner" (won in 2026)
- ✅ XYZ Builders Ltd → Regular nominee (didn't win)
- ✅ Top Build Co → Regular nominee
- ✅ Voting slugs regenerated for 2027
- ✅ Vote counts reset to 0
- ✅ Winner positions cleared (fresh rankings for 2027)

---

## CMS Features

### **Marking Winners (Automatic `actual_winner` Tracking)**

When you click the **"Winner"** button in CMS:
- Sets `status = 'winner'`
- Sets `actual_winner = TRUE` ← This is what carries forward
- Adds announcement_date
- Future nominations auto-flagged as previous winner

### **Badge Display**

Nominees automatically show badges:
- 🏆 **#1 Recommended** (winner_position = 1)
- 🥈 **#2 Recommended** (winner_position = 2)
- 🥉 **#3 Recommended** (winner_position = 3)
- 🏅 **Previous Winner** (won in any previous year)
- 👤 **Self Nominated** (nomination_source = self_nomination)
- 🔁 **Also in X categories** (nominated in multiple awards)

### **Filter Buttons**

- **All**: Show everyone
- **Self Nominations**: Only self-nominated companies
- **Previous Winners**: Only companies that won before
- **New Nominees**: Only companies that never won

---

## Utility Queries

### **View Complete History for a Company**

```sql
SELECT * FROM get_nominee_history(
  (SELECT id FROM organisations WHERE company_name = 'ABC Construction Ltd')
);
```

Returns:
- Total nominations across all years
- Total wins
- Years nominated [2025, 2024, 2023]
- Years won [2025, 2023]
- Awards won ["Best Builder 2025", "Best Renovator 2023"]

### **View All Winners by Year**

```sql
SELECT
  a.year,
  a.award_name,
  o.company_name as winner,
  aa.public_vote_count as votes,
  aa.winner_position as recommended_position
FROM award_assignments aa
JOIN awards a ON aa.award_id = a.id
JOIN organisations o ON aa.organisation_id = o.id
WHERE aa.actual_winner = TRUE
ORDER BY a.year DESC, a.award_name;
```

### **Find Repeat Winners (Won Multiple Years)**

```sql
SELECT
  o.company_name,
  COUNT(*) as times_won,
  STRING_AGG(a.award_name || ' (' || a.year || ')', ', ' ORDER BY a.year DESC) as wins
FROM award_assignments aa
JOIN awards a ON aa.award_id = a.id
JOIN organisations o ON aa.organisation_id = o.id
WHERE aa.actual_winner = TRUE
GROUP BY o.id, o.company_name
HAVING COUNT(*) > 1
ORDER BY times_won DESC;
```

### **Companies Nominated Multiple Times But Never Won**

```sql
SELECT
  o.company_name,
  COUNT(*) as times_nominated,
  STRING_AGG(DISTINCT a.year ORDER BY a.year DESC) as years,
  STRING_AGG(DISTINCT a.award_name, ', ') as categories
FROM award_assignments aa
JOIN awards a ON aa.award_id = a.id
JOIN organisations o ON aa.organisation_id = o.id
WHERE aa.organisation_id NOT IN (
  SELECT DISTINCT organisation_id
  FROM award_assignments
  WHERE actual_winner = TRUE
)
GROUP BY o.id, o.company_name
HAVING COUNT(*) > 1
ORDER BY times_nominated DESC;
```

### **Refresh Previous Winner Flags (Run Once After Setup)**

If you already have historical data, refresh all previous winner flags:

```sql
UPDATE award_assignments aa
SET is_previous_winner = TRUE
WHERE is_previous_winner = FALSE
  AND EXISTS (
    SELECT 1
    FROM award_assignments aa_check
    JOIN awards a ON aa_check.award_id = a.id
    JOIN awards a_current ON aa.award_id = a_current.id
    WHERE aa_check.organisation_id = aa.organisation_id
      AND aa_check.actual_winner = TRUE
      AND a.year < a_current.year
  );
```

---

## CSV Import Reference

### **Required Columns (must have data):**
- `sector`
- `region`
- `award_category` (must match database award names exactly)
- `organisation` (must match database company names exactly)

### **Optional Columns:**

| Column | Values | Purpose |
|--------|--------|---------|
| `nomination_date` | `2024-11-20` | Track when nominated |
| `nomination_source` | `self_nomination`, `csv_import`, `admin_manual` | How they were nominated |
| `is_previous_winner` | `true`, `yes`, `1` | Override auto-detection |
| `winner_position` | `1`, `2`, `3` | Recommended top 3 |
| `actual_winner` | `true`, `yes`, `1` | Final winner (usually set AFTER ceremony) |
| `contact_name` | Text | Contact person |
| `email` | Email | Contact email |
| `phone` | Phone | Contact phone |
| `website` | URL | Company website |
| `notes` | Text | Additional notes |

### **When to Use `is_previous_winner` in CSV:**

**99% of the time: Leave blank or omit**
- System auto-detects from database history

**Rare cases: Set to `true`**
- Company won a different awards program
- Company won before your database existed
- Manual override needed

---

## Rollover Function Reference

### **Function:** `copy_nominees_to_new_year`

**Syntax:**
```sql
SELECT * FROM copy_nominees_to_new_year(
  from_year TEXT,
  to_year TEXT,
  copy_winners BOOLEAN,
  copy_all_nominees BOOLEAN
);
```

**Parameters:**
- `from_year`: Source year (e.g., '2025')
- `to_year`: Destination year (e.g., '2026')
- `copy_winners`: TRUE = include winners, FALSE = exclude winners
- `copy_all_nominees`: TRUE = copy everyone, FALSE = copy only winners

**Returns:**
- `awards_processed`: Number of award categories updated
- `nominees_copied`: Total nominees copied
- `previous_winners_flagged`: Auto-detected previous winners

**Examples:**

```sql
-- Copy everyone from 2026 to 2027
SELECT * FROM copy_nominees_to_new_year('2026', '2027', TRUE, TRUE);

-- Copy only 2026 winners to 2027
SELECT * FROM copy_nominees_to_new_year('2026', '2027', TRUE, FALSE);

-- Copy only non-winners (fresh start)
SELECT * FROM copy_nominees_to_new_year('2026', '2027', FALSE, TRUE);
```

---

## Troubleshooting

### **Previous Winner Badge Not Showing**

1. Check trigger is installed:
```sql
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name LIKE '%previous_winner%';
```

2. Run refresh query (see Utility Queries section)

3. Check if company actually won:
```sql
SELECT * FROM award_assignments
WHERE organisation_id = (SELECT id FROM organisations WHERE company_name = 'ABC Construction Ltd')
  AND actual_winner = TRUE;
```

### **Rollover Not Working**

1. Verify award names match exactly:
```sql
-- Check 2026 awards
SELECT id, award_name FROM awards WHERE year = '2026';

-- Check 2027 awards
SELECT id, award_name FROM awards WHERE year = '2027';
```

2. Ensure organisations exist:
```sql
SELECT COUNT(*) FROM organisations;
```

3. Check for duplicates:
```sql
SELECT award_id, organisation_id, COUNT(*)
FROM award_assignments
GROUP BY award_id, organisation_id
HAVING COUNT(*) > 1;
```

---

## Summary

✅ **Initial Setup (2026):** Import CSV → Mark winners via CMS (sets `actual_winner = TRUE`)
✅ **Year Rollover (2027+):** Copy nominees with one SQL command OR add individually via CMS
✅ **Auto-Detection:** System checks ALL previous years and flags winners automatically
✅ **No Re-Importing:** Data lives in database forever, no CSV re-uploads needed
✅ **Complete History:** Track nominations, wins, and trends across decades

The system handles everything automatically once setup. Just mark winners in the CMS each year, and future nominations will automatically show the 🏅 Previous Winner badge!

---

## Quick Reference Card

| Task | How To Do It |
|------|--------------|
| **Mark winner in CMS** | Click "Winner" button → Sets actual_winner=TRUE automatically |
| **Add 2027 nominee** | Use CMS "Add Companies" panel → Previous winners auto-detected |
| **Copy all 2026 to 2027** | `SELECT * FROM copy_nominees_to_new_year('2026', '2027', TRUE, TRUE);` |
| **View company history** | `SELECT * FROM get_nominee_history((SELECT id FROM organisations WHERE company_name = 'X'));` |
| **See all winners** | `SELECT * FROM award_assignments WHERE actual_winner = TRUE;` |
| **Refresh flags** | Run refresh query from Utility Queries section |

---

Need help? Check the SQL comments in `database-year-rollover-system.sql` for additional examples and utilities.
