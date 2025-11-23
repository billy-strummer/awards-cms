# Event Management System - Setup & Testing Guide

## Overview
The Event Management system includes two main features:
1. **Running Order** - Manage the awards ceremony running order with drag-and-drop reordering
2. **Table Plan** - Manage event seating arrangements with visual table layout

## Prerequisites

### 1. Verify Database Tables Exist

Run this query in Supabase SQL Editor:
```sql
-- Copy contents of database-verify-event-management.sql
```

**Expected Result:** All 4 tables should show `exists = true`:
- `running_order`
- `running_order_settings`
- `event_tables`
- `table_assignments`

### 2. If Tables Don't Exist

Run the complete setup file in Supabase SQL Editor:
1. Open Supabase Dashboard → SQL Editor
2. Click "New query"
3. Copy **ALL 441 lines** from `database-event-management-setup.sql`
4. Paste and click "Run"
5. Verify success message appears

**IMPORTANT:**
- Run the ENTIRE file at once (all 441 lines)
- Do NOT run it in sections
- Do NOT copy from chat history - use the file from repository

---

## Testing Running Order

### Step 1: Open Running Order
1. Navigate to **Events Management** tab
2. Click on any event
3. Click the **Running Order** button (icon: list with numbers)

### Step 2: Add Items
**Option A - Sync from RSVPs:**
1. Click "Sync from RSVPs" button
2. System will auto-populate confirmed guests
3. Each item gets auto-numbered (1-01, 1-02, etc.)

**Option B - Manual Entry:**
1. Click "Add Manual Entry" button
2. Fill in award details
3. Save

### Step 3: Reorder Items
1. Ensure you're in EDIT MODE (unpublished)
2. Drag and drop items to reorder
3. Award numbers update automatically
4. Click "Save Changes"

### Step 4: Publish
1. Click "Publish" button
2. Running order becomes locked (read-only)
3. Items can no longer be reordered
4. Click "Unpublish" to make changes again

### Step 5: Export
1. Click "Export" button
2. Downloads CSV with:
   - Award Number
   - Award: Winner
   - Recipient Collecting

---

## Testing Table Plan

### Step 1: Open Table Plan
1. Navigate to **Events Management** tab
2. Click on any event
3. Click the **Table Plan** button (icon: table grid)

### Step 2: Add Tables
1. Click "Add Table" button
2. Enter number of seats (e.g., 8)
3. Table appears in grid with number

### Step 3: Assign Guests
1. Left sidebar shows "Unassigned Guests"
2. Drag a guest from sidebar
3. Drop onto a table card
4. Guest appears in table
5. Seat counter updates

### Step 4: Remove Guests
1. Click the X icon next to guest name
2. Guest moves back to unassigned list

### Step 5: Delete Tables
1. Click trash icon on table card
2. Confirm deletion
3. Guests become unassigned

### Step 6: Export
1. Click "Export" button
2. Downloads CSV with:
   - Table Number
   - Table Name
   - Guest Name
   - Company

---

## Features

### Running Order Features
- ✅ Auto-sync from event RSVPs
- ✅ Drag-and-drop reordering
- ✅ Auto-numbering (1-01, 1-02, 2-01, etc.)
- ✅ Publish/unpublish modes
- ✅ Award tracking
- ✅ Recipient tracking
- ✅ CSV export

### Table Plan Features
- ✅ Visual table layout
- ✅ Drag-and-drop guest assignment
- ✅ Seat capacity tracking
- ✅ Unassigned guests list
- ✅ Company grouping
- ✅ Plus-ones support
- ✅ CSV export

---

## Troubleshooting

### "Failed to load running order: Could not find the table 'public.running_order'"
**Solution:** Run `database-event-management-setup.sql` in Supabase SQL Editor

### "column a.award_category does not exist"
**Solution:** Pull latest version of `database-event-management-setup.sql` from repository (the fix is on line 239: `a.category as award_category`)

### "relation 'running_order' does not exist"
**Solution:** You ran only part of the SQL file. Run ALL 441 lines at once.

### No guests appear in Running Order after "Sync from RSVPs"
**Check:**
1. Event has guests in event_guests table
2. Guests have `rsvp_status = 'confirmed'`
3. Guests are linked to organisations with award assignments

### No guests appear in Table Plan unassigned list
**Check:**
1. Event has guests in event_guests table
2. Guests have `rsvp_status = 'confirmed'`
3. Guests are not already assigned to tables

---

## Database Schema

### `running_order`
Stores ceremony running order items
- Links to: events, organisations, awards, event_guests
- Auto-numbering via `award_number` field
- Drag-drop order via `display_order` field

### `running_order_settings`
Stores publish/edit state per event
- One row per event
- Controls published mode

### `event_tables`
Stores table definitions
- Table number, seats, shape
- Position for visual layout

### `table_assignments`
Stores guest-to-table assignments
- Links guests to tables
- CASCADE delete when table removed

---

## SQL Functions Available

1. **`get_next_award_number(event_id, section)`**
   - Returns next award number in sequence
   - Format: "1-01", "1-02", etc.

2. **`populate_running_order_from_rsvps(event_id)`**
   - Auto-populates running order from confirmed RSVPs
   - Returns count of items added

3. **`reorder_running_order(event_id, order_array)`**
   - Reorders items and renumbers
   - Used by drag-drop feature

4. **`get_available_seats(table_id)`**
   - Returns available seats for a table
   - Used for capacity checks

5. **`get_unassigned_guests(event_id)`**
   - Returns confirmed guests not assigned to tables
   - Used in table plan sidebar

6. **`get_next_table_number(event_id)`**
   - Returns next table number
   - Auto-increments from existing tables

---

## Next Steps

1. ✅ Verify database tables exist (run verification SQL)
2. ✅ Test Running Order functionality
3. ✅ Test Table Plan functionality
4. ✅ Export sample data to verify CSV format
5. ✅ Test publish/unpublish modes
6. ✅ Test drag-and-drop reordering

---

## Support

If you encounter issues:
1. Check Supabase SQL Editor for error messages
2. Verify all 4 tables exist using verification script
3. Check browser console for JavaScript errors
4. Verify database functions were created (check Functions in Supabase)

---

**Last Updated:** 2024
**System Version:** Event Management v1.0
