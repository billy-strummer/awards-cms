-- ============================================================
-- MISSING CRM TABLES AND VIEWS
-- Run this in Supabase SQL Editor after the main migration
-- ============================================================

-- 1. MEETING NOTES
CREATE TABLE IF NOT EXISTS meeting_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  meeting_type TEXT DEFAULT 'in_person',
  meeting_date TIMESTAMPTZ,
  duration_minutes INTEGER,
  subject TEXT,
  notes TEXT,
  attendees JSONB DEFAULT '[]',
  follow_up_required BOOLEAN DEFAULT FALSE,
  follow_up_date TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE meeting_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to meeting_notes" ON meeting_notes;
CREATE POLICY "Allow all access to meeting_notes"
  ON meeting_notes FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.meeting_notes TO anon;
GRANT ALL ON public.meeting_notes TO authenticated;
GRANT ALL ON public.meeting_notes TO service_role;


-- 2. CONTACT SEGMENTS
CREATE TABLE IF NOT EXISTS contact_segments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  segment_name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6c757d',
  icon TEXT DEFAULT 'tag',
  criteria JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contact_segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to contact_segments" ON contact_segments;
CREATE POLICY "Allow all access to contact_segments"
  ON contact_segments FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.contact_segments TO anon;
GRANT ALL ON public.contact_segments TO authenticated;
GRANT ALL ON public.contact_segments TO service_role;


-- 3. ORGANISATION SEGMENTS (join table)
CREATE TABLE IF NOT EXISTS organisation_segments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES contact_segments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organisation_id, segment_id)
);

ALTER TABLE organisation_segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to organisation_segments" ON organisation_segments;
CREATE POLICY "Allow all access to organisation_segments"
  ON organisation_segments FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.organisation_segments TO anon;
GRANT ALL ON public.organisation_segments TO authenticated;
GRANT ALL ON public.organisation_segments TO service_role;


-- 4. ORGANISATIONS WITH CRM SUMMARY (view)
CREATE OR REPLACE VIEW organisations_with_crm_summary AS
SELECT
  o.*,
  (SELECT COUNT(*) FROM deals d WHERE d.organisation_id = o.id AND d.stage NOT IN ('won', 'lost')) AS active_deals,
  (SELECT SUM(d.value) FROM deals d WHERE d.organisation_id = o.id AND d.stage NOT IN ('lost')) AS pipeline_value,
  (SELECT MAX(c.communication_date) FROM communications c WHERE c.organisation_id = o.id) AS last_communication_date,
  (SELECT COUNT(*) FROM communications c WHERE c.organisation_id = o.id AND c.follow_up_required = true AND c.follow_up_date >= NOW()) AS pending_follow_ups,
  (SELECT string_agg(cs.segment_name, ', ') FROM organisation_segments os JOIN contact_segments cs ON cs.id = os.segment_id WHERE os.organisation_id = o.id) AS segments
FROM organisations o;

GRANT ALL ON public.organisations_with_crm_summary TO anon;
GRANT ALL ON public.organisations_with_crm_summary TO authenticated;
GRANT ALL ON public.organisations_with_crm_summary TO service_role;


-- 5. EMAIL LISTS WITH STATS (view)
CREATE OR REPLACE VIEW email_lists_with_stats AS
SELECT
  el.*,
  (SELECT COUNT(*) FROM email_list_subscribers els WHERE els.list_id = el.id) AS subscriber_count,
  (SELECT COUNT(*) FROM email_list_subscribers els WHERE els.list_id = el.id AND els.status = 'active') AS active_subscribers
FROM email_lists el;

GRANT ALL ON public.email_lists_with_stats TO anon;
GRANT ALL ON public.email_lists_with_stats TO authenticated;
GRANT ALL ON public.email_lists_with_stats TO service_role;


-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- DONE! CRM tables and views are now set up.
-- ============================================================
