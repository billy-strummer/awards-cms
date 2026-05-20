-- Phase 2 feature tables: event_tickets, event_post_data, event_milestones
-- Run this migration once against your Supabase project.
-- All three tables are referenced by events.js and already allowlisted in data-proxy.js.

-- ── Ticket Issuance ───────────────────────────────────────────────────────────
-- One row per ticket issued to an attendee for a given event.
-- _saveTicketData deletes all rows for the event and re-inserts to keep things
-- simple (avoids partial-update edge cases on bulk issuance).

CREATE TABLE IF NOT EXISTS event_tickets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  attendee_id    UUID,                          -- references event_attendees(id); soft FK (no constraint) to avoid migration ordering issues
  ticket_number  VARCHAR(50) NOT NULL,
  attendee_name  VARCHAR(255),
  attendee_email VARCHAR(255),
  guest_type     VARCHAR(50)  DEFAULT 'guest',
  status         VARCHAR(20)  DEFAULT 'issued', -- 'issued' | 'revoked'
  issued_at      TIMESTAMP    DEFAULT NOW(),
  revoked_at     TIMESTAMP,
  sent_at        TIMESTAMP,
  created_at     TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_tickets_event    ON event_tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_event_tickets_attendee ON event_tickets(attendee_id);
CREATE INDEX IF NOT EXISTS idx_event_tickets_status   ON event_tickets(status);


-- ── Post-Event Data ───────────────────────────────────────────────────────────
-- One row per event, storing survey responses, debrief notes, and sponsor
-- report data as a JSONB blob.  Upserted on conflict (event_id is unique).

CREATE TABLE IF NOT EXISTS event_post_data (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID  NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  post_data  JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT event_post_data_event_id_unique UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_post_data_event ON event_post_data(event_id);

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION update_event_post_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_event_post_data_updated_at ON event_post_data;
CREATE TRIGGER trg_event_post_data_updated_at
  BEFORE UPDATE ON event_post_data
  FOR EACH ROW EXECUTE FUNCTION update_event_post_data_updated_at();


-- ── Event Milestones ──────────────────────────────────────────────────────────
-- One row per milestone per event.
-- _saveMilestones deletes all rows for the event then re-inserts the full list,
-- so there is no unique constraint on (event_id, milestone_id).

CREATE TABLE IF NOT EXISTS event_milestones (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID    NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  milestone_id     VARCHAR(50),         -- e.g. 'm1'..'m8' for defaults; NULL for custom
  title            VARCHAR(500) NOT NULL,
  category         VARCHAR(100) DEFAULT 'General',
  is_completed     BOOLEAN  DEFAULT FALSE,
  is_custom        BOOLEAN  DEFAULT FALSE,
  completed_at     TIMESTAMP,
  due_days_relative INTEGER,            -- days relative to event date (negative = before)
  notes            TEXT,
  created_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_milestones_event     ON event_milestones(event_id);
CREATE INDEX IF NOT EXISTS idx_event_milestones_completed ON event_milestones(is_completed);
