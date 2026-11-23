-- ============================================================
-- Migration 079: Restore Event Check-in access on event_guests
-- ============================================================
-- Migration 078 correctly removed a leftover permissive policy that was
-- neutralizing event_guests' RLS, but check-in-app.js (the real Event
-- Check-in page, check-in.html) makes direct authenticated-role Supabase
-- calls to this table -- SELECT (load the guest list, look up a scanned
-- QR code) and UPDATE (mark checked_in / check_in_time) -- bypassing
-- api/data-proxy.js entirely. Locking the table to service-role-only
-- broke this real feature.
--
-- Access analysis (from check-in-app.js):
--   - loadGuests(): SELECT * WHERE event_id = :eventId
--   - onScanSuccess(): SELECT * WHERE id = :guestId AND event_id = :eventId
--   - performCheckIn() / checkInByButton(): UPDATE checked_in, check_in_time
--     WHERE id = :guestId
--   - No INSERT, no DELETE anywhere in this file.
--
-- Which existing security boundary to reuse: event_guests has no
-- ownership column matching the *acting* user (the guest doesn't check
-- themselves in -- staff scan the guest's QR code), no tenant_id column
-- at all, and no per-event staff-assignment table anywhere in this
-- schema. The two patterns that actually exist elsewhere are (a) a
-- blanket `authenticated, USING (true)` read policy (entries_select,
-- award_assignments_select, organisations_select, ...) and (b) row
-- ownership via user_email() (entries_update, matching a submitted
-- entry's own contact_email) -- (b) doesn't apply here since staff are
-- never the "owner" of a guest row. (a) is the correct, already-used
-- pattern to extend, and check-in-app.js's own init() already only
-- requires *a* valid session (no stricter role check), so a blanket
-- authenticated policy matches the feature's actual current
-- authorization model rather than introducing a stricter one that
-- would itself be a new, uninstructed design decision.
--
-- Scope kept to the minimum the feature needs: SELECT + UPDATE only, no
-- INSERT/DELETE grant, matching exactly what check-in-app.js does and
-- nothing more. anon remains fully blocked by the existing
-- no_direct_client_access policy (unscoped policies apply per-role; an
-- authenticated-only policy adds no access for anon).
--
-- Idempotent: CREATE POLICY wrapped in duplicate_object exception
-- handling, matching migrations/052-rls-policies.sql's own approach.
-- ============================================================

DO $$
BEGIN
  BEGIN
    EXECUTE 'CREATE POLICY "event_guests_select" ON event_guests FOR SELECT TO authenticated USING (true)';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    EXECUTE 'CREATE POLICY "event_guests_update" ON event_guests FOR UPDATE TO authenticated USING (true) WITH CHECK (true)';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

NOTIFY pgrst, 'reload schema';
