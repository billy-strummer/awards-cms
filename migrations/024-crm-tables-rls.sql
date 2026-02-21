-- ============================================================
-- Migration 024: Add RLS policies and GRANTs for CRM tables
-- ============================================================
-- The CRM tables (communications, deals, meeting_notes,
-- contact_segments, organisation_segments, sponsorship_opportunities)
-- were created without RLS policies. Without these, the Supabase
-- frontend client (anon key) cannot read or write to them.
-- ============================================================

-- ============================================
-- 1. COMMUNICATIONS
-- ============================================
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to communications" ON communications;
CREATE POLICY "Allow all access to communications"
  ON communications FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.communications TO anon;
GRANT ALL ON public.communications TO authenticated;
GRANT ALL ON public.communications TO service_role;

-- ============================================
-- 2. DEALS
-- ============================================
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to deals" ON deals;
CREATE POLICY "Allow all access to deals"
  ON deals FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.deals TO anon;
GRANT ALL ON public.deals TO authenticated;
GRANT ALL ON public.deals TO service_role;

-- ============================================
-- 3. MEETING NOTES
-- ============================================
ALTER TABLE meeting_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to meeting_notes" ON meeting_notes;
CREATE POLICY "Allow all access to meeting_notes"
  ON meeting_notes FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.meeting_notes TO anon;
GRANT ALL ON public.meeting_notes TO authenticated;
GRANT ALL ON public.meeting_notes TO service_role;

-- ============================================
-- 4. CONTACT SEGMENTS
-- ============================================
ALTER TABLE contact_segments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to contact_segments" ON contact_segments;
CREATE POLICY "Allow all access to contact_segments"
  ON contact_segments FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.contact_segments TO anon;
GRANT ALL ON public.contact_segments TO authenticated;
GRANT ALL ON public.contact_segments TO service_role;

-- ============================================
-- 5. ORGANISATION SEGMENTS
-- ============================================
ALTER TABLE organisation_segments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to organisation_segments" ON organisation_segments;
CREATE POLICY "Allow all access to organisation_segments"
  ON organisation_segments FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.organisation_segments TO anon;
GRANT ALL ON public.organisation_segments TO authenticated;
GRANT ALL ON public.organisation_segments TO service_role;

-- ============================================
-- 6. SPONSORSHIP OPPORTUNITIES
-- ============================================
ALTER TABLE sponsorship_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to sponsorship_opportunities" ON sponsorship_opportunities;
CREATE POLICY "Allow all access to sponsorship_opportunities"
  ON sponsorship_opportunities FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.sponsorship_opportunities TO anon;
GRANT ALL ON public.sponsorship_opportunities TO authenticated;
GRANT ALL ON public.sponsorship_opportunities TO service_role;

-- ============================================
-- 7. Add missing FK: communications.related_deal_id -> deals
-- ============================================
-- Was created as a bare UUID with no constraint, so orphaned
-- deal references won't get cleaned up on deal deletion.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'communications_related_deal_id_fkey'
      AND table_name = 'communications'
  ) THEN
    ALTER TABLE communications
      ADD CONSTRAINT communications_related_deal_id_fkey
      FOREIGN KEY (related_deal_id) REFERENCES deals(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- 8. Fix upcoming_follow_ups view
-- ============================================
-- The original view filters on completed = false, but new communications
-- default to completed = true. This means follow-ups never appear unless
-- manually set. Fix: only check follow_up_required and follow_up_date.
CREATE OR REPLACE VIEW upcoming_follow_ups AS
SELECT
  c.*,
  o.company_name,
  oc.first_name || ' ' || oc.last_name as contact_name,
  oc.email as contact_email
FROM communications c
LEFT JOIN organisations o ON c.organisation_id = o.id
LEFT JOIN organisation_contacts oc ON c.contact_id = oc.id
WHERE c.follow_up_required = true
  AND c.follow_up_date >= CURRENT_DATE
ORDER BY c.follow_up_date ASC;

-- ============================================
-- 9. GRANT SELECT on CRM views
-- ============================================
GRANT SELECT ON public.organisations_with_crm_summary TO anon;
GRANT SELECT ON public.organisations_with_crm_summary TO authenticated;
GRANT SELECT ON public.organisations_with_crm_summary TO service_role;

GRANT SELECT ON public.deal_pipeline_summary TO anon;
GRANT SELECT ON public.deal_pipeline_summary TO authenticated;
GRANT SELECT ON public.deal_pipeline_summary TO service_role;

GRANT SELECT ON public.communication_activity TO anon;
GRANT SELECT ON public.communication_activity TO authenticated;
GRANT SELECT ON public.communication_activity TO service_role;

GRANT SELECT ON public.upcoming_follow_ups TO anon;
GRANT SELECT ON public.upcoming_follow_ups TO authenticated;
GRANT SELECT ON public.upcoming_follow_ups TO service_role;

-- ============================================
-- 10. Refresh PostgREST schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';
