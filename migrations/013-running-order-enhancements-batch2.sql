-- ============================================
-- RUNNING ORDER ENHANCEMENTS (BATCH 2)
-- ============================================
-- Adds: checklist, trophy tracking, cue notes, table_number, versioning, act colours
-- ============================================

-- 1. Rehearsal checklist fields on running_order
ALTER TABLE running_order ADD COLUMN IF NOT EXISTS checklist_trophy_ready BOOLEAN DEFAULT FALSE;
ALTER TABLE running_order ADD COLUMN IF NOT EXISTS checklist_recipient_confirmed BOOLEAN DEFAULT FALSE;
ALTER TABLE running_order ADD COLUMN IF NOT EXISTS checklist_special_reqs_handled BOOLEAN DEFAULT FALSE;
ALTER TABLE running_order ADD COLUMN IF NOT EXISTS checklist_engraving_correct BOOLEAN DEFAULT FALSE;

-- 2. Trophy tracking fields
ALTER TABLE running_order ADD COLUMN IF NOT EXISTS trophy_status VARCHAR(30) DEFAULT 'not_started';
-- trophy_status values: 'not_started', 'ordered', 'engraved', 'checked', 'backstage_ready'

-- 3. Cue notes for AV/lighting/stage team
ALTER TABLE running_order ADD COLUMN IF NOT EXISTS cue_notes TEXT;

-- 4. Table number link (to connect to table plan)
ALTER TABLE running_order ADD COLUMN IF NOT EXISTS table_number INTEGER;

-- 5. Act/section colour on running_order_settings
ALTER TABLE running_order_settings ADD COLUMN IF NOT EXISTS section_config JSONB DEFAULT '[]'::jsonb;
-- Format: [{ "section": 1, "name": "Act 1: Community", "colour": "#4caf50" }, ...]

-- 6. Running order versions table
CREATE TABLE IF NOT EXISTS running_order_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  version_name VARCHAR(100) NOT NULL,
  version_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL, -- Full snapshot of running_order_items at time of save
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_ro_versions_event ON running_order_versions(event_id);

SELECT 'Running Order Enhancements Batch 2 Applied!' as message;
