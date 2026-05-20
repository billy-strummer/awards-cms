-- Multi-user compatibility: tables referenced in code but missing from any migration.
-- All tables below are already allowlisted in api/data-proxy.js.
-- Run this once against your Supabase project (SQL Editor → Run).

-- ── Shared key-value preferences ─────────────────────────────────────────────
-- Used by: CRM pipeline stages, dunning settings, accounting config, saved views,
--          CRM segments.  One row per logical setting, shared across all admin users.

CREATE TABLE IF NOT EXISTS user_preferences (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  key         VARCHAR(255) NOT NULL,
  value       TEXT,
  updated_at  TIMESTAMP    DEFAULT NOW(),
  CONSTRAINT user_preferences_key_unique UNIQUE (key)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_key ON user_preferences(key);


-- ── CMS audit log ─────────────────────────────────────────────────────────────
-- Used by settings.js logAction() / getAuditLogs().  Per-instance localStorage
-- fallback is replaced by a real shared audit trail.

CREATE TABLE IF NOT EXISTS cms_audit_logs (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id   TEXT,
  description TEXT,
  user_email  VARCHAR(255),
  created_at  TIMESTAMP    DEFAULT NOW()
);

-- Add columns defensively in case the table already existed with fewer columns
ALTER TABLE cms_audit_logs ADD COLUMN IF NOT EXISTS entity_type VARCHAR(100);
ALTER TABLE cms_audit_logs ADD COLUMN IF NOT EXISTS entity_id   TEXT;
ALTER TABLE cms_audit_logs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE cms_audit_logs ADD COLUMN IF NOT EXISTS user_email  VARCHAR(255);
ALTER TABLE cms_audit_logs ADD COLUMN IF NOT EXISTS created_at  TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_cms_audit_logs_created    ON cms_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cms_audit_logs_user       ON cms_audit_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_cms_audit_logs_entity     ON cms_audit_logs(entity_type, entity_id);


-- ── Event budget ──────────────────────────────────────────────────────────────
-- One row per event (total budget envelope).

CREATE TABLE IF NOT EXISTS event_budgets (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID          NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  total_budget DECIMAL(10,2) DEFAULT 0,
  created_at   TIMESTAMP     DEFAULT NOW(),
  updated_at   TIMESTAMP     DEFAULT NOW(),
  CONSTRAINT event_budgets_event_id_unique UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_budgets_event ON event_budgets(event_id);


-- ── Event budget items ────────────────────────────────────────────────────────
-- Uses 'estimated' and 'actual' to match the property names used throughout
-- the JS UI code (item.estimated / item.actual).

CREATE TABLE IF NOT EXISTS event_budget_items (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID          NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name       VARCHAR(255)  NOT NULL,
  category   VARCHAR(100),
  estimated  DECIMAL(10,2) DEFAULT 0,
  actual     DECIMAL(10,2) DEFAULT 0,
  status     VARCHAR(50)   DEFAULT 'Pending',
  notes      TEXT,
  created_at TIMESTAMP     DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_budget_items_event ON event_budget_items(event_id);


-- ── Event vendors ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_vendors (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID          NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  contact_name VARCHAR(255),
  company      VARCHAR(255),
  email        VARCHAR(255),
  phone        VARCHAR(50),
  vendor_type  VARCHAR(100),
  cost         DECIMAL(10,2) DEFAULT 0,
  status       VARCHAR(50)   DEFAULT 'pending',
  notes        TEXT,
  created_at   TIMESTAMP     DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_vendors_event  ON event_vendors(event_id);
CREATE INDEX IF NOT EXISTS idx_event_vendors_status ON event_vendors(status);


-- ── Event waitlist ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_waitlist (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255),
  phone       VARCHAR(50),
  notified    BOOLEAN      DEFAULT FALSE,
  promoted    BOOLEAN      DEFAULT FALSE,
  promoted_at TIMESTAMP,
  created_at  TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_waitlist_event    ON event_waitlist(event_id);
CREATE INDEX IF NOT EXISTS idx_event_waitlist_promoted ON event_waitlist(promoted);


-- ── Event special requirements ────────────────────────────────────────────────
-- Parking, emergency contacts, dress code, photo consent — stored as JSONB.
-- One row per event, upserted on conflict.

CREATE TABLE IF NOT EXISTS event_special_requirements (
  id           UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID      NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  requirements JSONB     NOT NULL DEFAULT '{}',
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW(),
  CONSTRAINT event_special_requirements_event_id_unique UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_special_reqs_event ON event_special_requirements(event_id);


-- ── Event templates ───────────────────────────────────────────────────────────
-- Reusable event configurations (loadTemplates / saveTemplatesStorage in events.js).

CREATE TABLE IF NOT EXISTS event_templates (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  template_data JSONB        NOT NULL DEFAULT '{}',
  created_by    VARCHAR(255),
  created_at    TIMESTAMP    DEFAULT NOW()
);


-- ── Event room fixtures ───────────────────────────────────────────────────────
-- Stage, photo wall, AV booth, etc. on the seating canvas.

CREATE TABLE IF NOT EXISTS event_room_fixtures (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  fixture_type VARCHAR(50)  NOT NULL,
  label        VARCHAR(100),
  position_x   INTEGER      DEFAULT 100,
  position_y   INTEGER      DEFAULT 50,
  width        INTEGER      DEFAULT 200,
  height       INTEGER      DEFAULT 100,
  created_at   TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_room_fixtures_event ON event_room_fixtures(event_id);


-- ── Documents ─────────────────────────────────────────────────────────────────
-- Central document library (document-management.js).  Files stored in Supabase
-- Storage under the 'documents' bucket; metadata stored here.

CREATE TABLE IF NOT EXISTS documents (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title               VARCHAR(500) NOT NULL,
  category            VARCHAR(100),
  file_url            TEXT,
  file_name           VARCHAR(500),
  file_type           VARCHAR(100),
  file_size           INTEGER,
  status              VARCHAR(50)  DEFAULT 'draft',
  linked_entity_type  VARCHAR(100),
  linked_entity_id    UUID,
  expiry_date         DATE,
  uploaded_by         VARCHAR(255),
  created_at          TIMESTAMP    DEFAULT NOW(),
  updated_at          TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_category    ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_status      ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_linked      ON documents(linked_entity_type, linked_entity_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);


-- ── Document versions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_versions (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    UUID         NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER      NOT NULL DEFAULT 1,
  file_url       TEXT         NOT NULL,
  file_size      INTEGER,
  uploaded_by    VARCHAR(255),
  notes          TEXT,
  created_at     TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_versions_doc ON document_versions(document_id);


-- ── Judge conflicts of interest ───────────────────────────────────────────────
-- Used by assignments.js _getConflicts / _saveConflicts.

CREATE TABLE IF NOT EXISTS judge_conflicts (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  judge_email VARCHAR(255) NOT NULL,
  org_name    VARCHAR(500),
  org_id      UUID,
  created_at  TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_judge_conflicts_email ON judge_conflicts(judge_email);
