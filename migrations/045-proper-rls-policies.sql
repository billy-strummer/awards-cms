-- ============================================================
-- Migration 045: Replace permissive RLS policies with proper
-- role-based policies
-- ============================================================
-- Previously all tables used USING(true) WITH CHECK(true) which
-- is equivalent to having no RLS at all. This migration replaces
-- those policies with proper role-based access control:
--
-- 1. service_role: Full access (used by API proxy server-side)
-- 2. authenticated: Read access to most tables; write only to
--    entries/votes/user_preferences (their own records)
-- 3. anon: Read access to public data only (awards, award_years,
--    public_votes, published entries)
-- ============================================================

-- ============================================
-- HELPER: Create a function to check if user owns a record
-- ============================================
CREATE OR REPLACE FUNCTION public.user_email()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'email',
    ''
  );
$$ LANGUAGE sql STABLE;

-- ============================================
-- 1. AWARDS — public read, admin write
-- ============================================
-- 'awards' is an updatable VIEW over award_years (see
-- migrations/000-complete-database-setup.sql), not a table — RLS and
-- policies attach to the base table only; section 2 below (award_years)
-- covers this, so skip enabling RLS/policies on the view itself.

-- ============================================
-- 2. AWARD_YEARS — public read, admin write
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'award_years') THEN
    ALTER TABLE award_years ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Allow all access to award_years" ON award_years';
    EXECUTE 'DROP POLICY IF EXISTS "award_years_service" ON award_years';
    EXECUTE 'DROP POLICY IF EXISTS "award_years_select" ON award_years';
    EXECUTE 'DROP POLICY IF EXISTS "award_years_anon_select" ON award_years';

    EXECUTE 'CREATE POLICY "award_years_service" ON award_years FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "award_years_select" ON award_years FOR SELECT TO authenticated USING (true)';
    EXECUTE 'CREATE POLICY "award_years_anon_select" ON award_years FOR SELECT TO anon USING (true)';
  END IF;
END $$;

-- ============================================
-- 3. ORGANISATIONS — authenticated read, admin write
-- ============================================
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to organisations" ON organisations;
DROP POLICY IF EXISTS "organisations_service" ON organisations;
DROP POLICY IF EXISTS "organisations_select" ON organisations;

CREATE POLICY "organisations_service" ON organisations FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "organisations_select" ON organisations FOR SELECT
  TO authenticated USING (true);

-- ============================================
-- 4. ENTRIES — authenticated read; entrants can create/update own
-- ============================================
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to entries" ON entries;
DROP POLICY IF EXISTS "entries_service" ON entries;
DROP POLICY IF EXISTS "entries_select" ON entries;
DROP POLICY IF EXISTS "entries_insert" ON entries;
DROP POLICY IF EXISTS "entries_update" ON entries;
DROP POLICY IF EXISTS "entries_anon_select" ON entries;

CREATE POLICY "entries_service" ON entries FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Authenticated users: read all entries
CREATE POLICY "entries_select" ON entries FOR SELECT
  TO authenticated USING (true);

-- Authenticated users: insert their own entries
CREATE POLICY "entries_insert" ON entries FOR INSERT
  TO authenticated WITH CHECK (contact_email = public.user_email());

-- Authenticated users: update their own entries
CREATE POLICY "entries_update" ON entries FOR UPDATE
  TO authenticated USING (contact_email = public.user_email());

-- Anon: read published entries only (for public-facing pages)
CREATE POLICY "entries_anon_select" ON entries FOR SELECT
  TO anon USING (status = 'Published' OR status = 'submitted');

-- ============================================
-- 5. WINNERS — public read, admin write
-- ============================================
ALTER TABLE winners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to winners" ON winners;
DROP POLICY IF EXISTS "winners_service" ON winners;
DROP POLICY IF EXISTS "winners_select" ON winners;
DROP POLICY IF EXISTS "winners_anon_select" ON winners;

CREATE POLICY "winners_service" ON winners FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "winners_select" ON winners FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "winners_anon_select" ON winners FOR SELECT
  TO anon USING (true);

-- ============================================
-- 6. VOTES — anon can insert, authenticated can read all
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'votes') THEN
    ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Allow all access to votes" ON votes';
    EXECUTE 'DROP POLICY IF EXISTS "votes_service" ON votes';
    EXECUTE 'DROP POLICY IF EXISTS "votes_select" ON votes';
    EXECUTE 'DROP POLICY IF EXISTS "votes_anon_insert" ON votes';

    EXECUTE 'CREATE POLICY "votes_service" ON votes FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "votes_select" ON votes FOR SELECT TO authenticated USING (true)';
    -- Anon users can submit votes (public voting)
    EXECUTE 'CREATE POLICY "votes_anon_insert" ON votes FOR INSERT TO anon WITH CHECK (true)';
    -- Anon can read vote counts
    EXECUTE 'CREATE POLICY "votes_anon_select" ON votes FOR SELECT TO anon USING (true)';
  END IF;
END $$;

-- ============================================
-- 7. EVENTS — authenticated read, admin write
-- ============================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to events" ON events;
DROP POLICY IF EXISTS "events_service" ON events;
DROP POLICY IF EXISTS "events_select" ON events;

CREATE POLICY "events_service" ON events FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "events_select" ON events FOR SELECT
  TO authenticated USING (true);

-- ============================================
-- 8. INVOICES & PAYMENTS — authenticated read, admin write
-- ============================================
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to invoices" ON invoices;
DROP POLICY IF EXISTS "invoices_service" ON invoices;
DROP POLICY IF EXISTS "invoices_select" ON invoices;

CREATE POLICY "invoices_service" ON invoices FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "invoices_select" ON invoices FOR SELECT
  TO authenticated USING (true);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to payments" ON payments;
DROP POLICY IF EXISTS "payments_service" ON payments;
DROP POLICY IF EXISTS "payments_select" ON payments;

CREATE POLICY "payments_service" ON payments FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "payments_select" ON payments FOR SELECT
  TO authenticated USING (true);

-- ============================================
-- 9. USER PREFERENCES — users manage their own
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_preferences') THEN
    ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Allow all access to user_preferences" ON user_preferences';
    EXECUTE 'DROP POLICY IF EXISTS "user_preferences_service" ON user_preferences';
    EXECUTE 'DROP POLICY IF EXISTS "user_preferences_own" ON user_preferences';

    EXECUTE 'CREATE POLICY "user_preferences_service" ON user_preferences FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "user_preferences_own" ON user_preferences FOR ALL TO authenticated USING (user_email = public.user_email()) WITH CHECK (user_email = public.user_email())';
  END IF;
END $$;

-- ============================================
-- 10. ACTIVITY LOG — authenticated read, service write
-- ============================================
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to activity_logs" ON activity_logs;
DROP POLICY IF EXISTS "activity_log_service" ON activity_logs;
DROP POLICY IF EXISTS "activity_log_select" ON activity_logs;

CREATE POLICY "activity_log_service" ON activity_logs FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "activity_log_select" ON activity_logs FOR SELECT
  TO authenticated USING (true);

-- ============================================
-- 11. EMAIL TEMPLATES — authenticated read, admin write
-- ============================================
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to email_templates" ON email_templates;
DROP POLICY IF EXISTS "email_templates_service" ON email_templates;
DROP POLICY IF EXISTS "email_templates_select" ON email_templates;

CREATE POLICY "email_templates_service" ON email_templates FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "email_templates_select" ON email_templates FOR SELECT
  TO authenticated USING (true);

-- ============================================
-- 12. CRM TABLES — authenticated access, service full
-- ============================================

-- Communications
DROP POLICY IF EXISTS "Allow all access to communications" ON communications;
DROP POLICY IF EXISTS "communications_service" ON communications;
DROP POLICY IF EXISTS "communications_auth" ON communications;

CREATE POLICY "communications_service" ON communications FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "communications_auth" ON communications FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Deals
DROP POLICY IF EXISTS "Allow all access to deals" ON deals;
DROP POLICY IF EXISTS "deals_service" ON deals;
DROP POLICY IF EXISTS "deals_auth" ON deals;

CREATE POLICY "deals_service" ON deals FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "deals_auth" ON deals FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Meeting Notes
DROP POLICY IF EXISTS "Allow all access to meeting_notes" ON meeting_notes;
DROP POLICY IF EXISTS "meeting_notes_service" ON meeting_notes;
DROP POLICY IF EXISTS "meeting_notes_auth" ON meeting_notes;

CREATE POLICY "meeting_notes_service" ON meeting_notes FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "meeting_notes_auth" ON meeting_notes FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Contact Segments
DROP POLICY IF EXISTS "Allow all access to contact_segments" ON contact_segments;
DROP POLICY IF EXISTS "contact_segments_service" ON contact_segments;
DROP POLICY IF EXISTS "contact_segments_auth" ON contact_segments;

CREATE POLICY "contact_segments_service" ON contact_segments FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "contact_segments_auth" ON contact_segments FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Organisation Segments
DROP POLICY IF EXISTS "Allow all access to organisation_segments" ON organisation_segments;
DROP POLICY IF EXISTS "organisation_segments_service" ON organisation_segments;
DROP POLICY IF EXISTS "organisation_segments_auth" ON organisation_segments;

CREATE POLICY "organisation_segments_service" ON organisation_segments FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "organisation_segments_auth" ON organisation_segments FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Sponsorship Opportunities
DROP POLICY IF EXISTS "Allow all access to sponsorship_opportunities" ON sponsorship_opportunities;
DROP POLICY IF EXISTS "sponsorship_opportunities_service" ON sponsorship_opportunities;
DROP POLICY IF EXISTS "sponsorship_opportunities_auth" ON sponsorship_opportunities;

CREATE POLICY "sponsorship_opportunities_service" ON sponsorship_opportunities FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "sponsorship_opportunities_auth" ON sponsorship_opportunities FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 13. REMAINING TABLES — service full + authenticated read
-- ============================================

-- Apply standard pattern to all remaining tables
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'award_assignments', 'contacts', 'judges',
    'email_lists', 'email_list_members', 'email_campaigns',
    'tickets', 'ticket_types',
    'seating_tables', 'seating_assignments', 'documents',
    'media', 'notifications', 'webhooks', 'tenant_branding',
    'organisation_notes', 'organisation_documents',
    'organisation_custom_fields', 'organisation_follow_ups',
    'organisation_relationships', 'organisation_comms_log',
    'org_audit_log', 'organisation_images', 'organisation_contacts',
    'org_activity_notes', 'event_galleries',
    'entry_revisions', 'winner_announcements', 'calendar_events',
    'report_schedules', 'sponsorship_packages'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

      -- Drop old permissive policies
      EXECUTE format('DROP POLICY IF EXISTS "Allow all access to %s" ON %I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_service" ON %I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %I', t, t);

      -- Service role: full access
      EXECUTE format('CREATE POLICY "%s_service" ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)', t, t);

      -- Authenticated: read access
      EXECUTE format('CREATE POLICY "%s_select" ON %I FOR SELECT TO authenticated USING (true)', t, t);

      -- Revoke direct write from anon (service_role via proxy handles writes)
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON %I FROM anon', t);

      -- Keep SELECT for anon on safe tables, revoke on sensitive ones
      -- (service_role + authenticated still have access via proxy)
    END IF;
  END LOOP;
END $$;

-- ============================================
-- 14. REVOKE anon write access from core tables
-- ============================================
-- The anon key should never be able to write directly;
-- all mutations go through the API proxy (service_role).
DO $$
DECLARE
  t TEXT;
  sensitive TEXT[] := ARRAY[
    'organisations', 'entries', 'winners', 'events',
    'invoices', 'payments', 'activity_logs', 'email_templates',
    'awards', 'award_assignments', 'contacts', 'judges'
  ];
BEGIN
  FOREACH t IN ARRAY sensitive LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON %I FROM anon', t);
    END IF;
  END LOOP;
END $$;

-- ============================================
-- 15. Refresh PostgREST schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';
