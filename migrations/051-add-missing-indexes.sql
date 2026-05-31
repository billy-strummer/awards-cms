-- Migration 051: Add missing indexes on high-traffic query columns
-- Safe to re-run: uses CREATE INDEX IF NOT EXISTS

-- email_logs.status is filtered on every pending/sent/failed dashboard query
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);

-- event_guests composite filter used in attendee reports
CREATE INDEX IF NOT EXISTS idx_event_guests_event_rsvp ON event_guests(event_id, rsvp_status);

-- award_assignments composite filter for shortlist/winner count queries
CREATE INDEX IF NOT EXISTS idx_assignments_award_status ON award_assignments(award_id, status);
