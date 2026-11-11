-- ============================================================
-- Migration 085: Harden RLS on table_assignments
-- ============================================================
-- Empirical investigation (Claude TEST CMS, 2026-07-22) proved
-- table_assignments (event seating: guest_name, company_name,
-- dietary_requirements, notes) had RLS enabled but only the original
-- migration-000 "Allow all access" permissive policy.
--
-- Proof (real anon-key REST calls against a real inserted row):
--   - anon SELECT returned real guest seating data including dietary
--     requirements (health-related data) and internal VIP notes.
--   - anon UPDATE genuinely changed a real row's seat_number and
--     dietary_requirements (confirmed via service-role re-read, not just
--     the echoed response body).
--
-- Why the app doesn't already prevent this: events.js and
-- seating-enhancements.js manage table_assignments exclusively via
-- apiClient (server-side proxy, service-role key) -- confirmed via
-- full-codebase grep. The gap is purely that RLS was never hardened
-- past the migration-000 policy.
--
-- Browser-side dependency check found ONE real, working exception:
-- check-in-app.js creates its own Supabase client and, after a real
-- sign-in, reads table_assignments directly (SELECT only, filtered by
-- guest_id, joined with event_tables) to show a checked-in guest's table
-- assignment. No INSERT/UPDATE/DELETE anywhere in that file. This is the
-- exact same shape of dependency as event_guests (migrations 078/079),
-- handled the same way: least-privilege restore, not a blanket lockdown.
-- Since check-in-app.js only needs SELECT (unlike event_guests, which
-- also needed UPDATE for the check-in action itself), only SELECT is
-- restored here.
-- ============================================================

DROP POLICY IF EXISTS "Allow all access to table_assignments" ON table_assignments;

DO $$
BEGIN
  BEGIN
    EXECUTE 'CREATE POLICY "table_assignments_select" ON table_assignments FOR SELECT TO authenticated USING (true)';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    EXECUTE 'CREATE POLICY "service_role_all" ON table_assignments FOR ALL USING (auth.role() = ''service_role'')';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

NOTIFY pgrst, 'reload schema';
