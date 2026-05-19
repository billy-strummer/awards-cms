-- Migration 050: Add category, notes, and due_days_relative to event_milestones
-- Supports the full T2-C milestone system (category display, relative due dates, per-milestone notes)

ALTER TABLE event_milestones ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE event_milestones ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE event_milestones ADD COLUMN IF NOT EXISTS due_days_relative INT;
