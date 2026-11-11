-- ============================================================
-- Migration 078: Remove obsolete permissive policy on event_guests
-- ============================================================
-- migrations/052-rls-policies.sql added `service_role_all` and
-- `no_direct_client_access` to event_guests to lock it to service-role-only
-- access, but never dropped the original `"Allow all access to event_guests"`
-- policy from migrations/000-complete-database-setup.sql. PostgreSQL
-- combines multiple PERMISSIVE policies with OR, so that leftover
-- USING (true) policy silently cancelled out USING (false) — the table
-- showed RLS as "enabled" but was, in practice, exactly as open to
-- anon/authenticated as if migration 052 had never run for it.
--
-- Confirmed empirically before this fix, not just from policy inspection:
-- with RLS in its pre-078 state, a direct anon-key request against the
-- live Supabase REST API could both SELECT and INSERT into event_guests.
--
-- This migration removes ONLY the obsolete permissive policy. It does not
-- touch service_role_all or no_direct_client_access, and does not change
-- the security model for this table in any way beyond removing the policy
-- that was defeating it — the intended architecture (service-role-only
-- direct access, everything else through api/data-proxy.js) already
-- existed on this table; this makes it actually take effect.
--
-- award_assignments was investigated in the same pass and found to
-- already be correctly configured (no leftover permissive policy) — its
-- narrower award_assignments_select policy (authenticated, SELECT only,
-- no write access) is a deliberate, different, and already-correct design,
-- confirmed via the same live anon/authenticated request tests. No change
-- needed or made to award_assignments.
--
-- Idempotent: DROP POLICY IF EXISTS is a no-op if already removed.
-- ============================================================

DROP POLICY IF EXISTS "Allow all access to event_guests" ON event_guests;

NOTIFY pgrst, 'reload schema';
