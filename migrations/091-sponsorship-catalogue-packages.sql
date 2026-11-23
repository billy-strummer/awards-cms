-- ============================================================
-- Migration 091: Public sponsorship package catalogue
-- ============================================================
-- BTA-070 Priority 5: the public sponsorship page (become-a-sponsor.html)
-- has always hardcoded its Bronze/Gold/Platinum tiers directly in HTML.
-- Two prior candidate tables were investigated and found unusable as-is:
--
--   - sponsorship_packages (organisations.js:7719-7792) is scoped to
--     organisation_id -- it is per-sponsor CRM deal data (an already-
--     signed sponsor's own amount/payment schedule/renewal date), not a
--     public catalogue. Exposing it publicly would leak other sponsors'
--     confidential deal terms.
--   - sponsorship_opportunities has TWO CONFLICTING CREATE TABLE
--     IF NOT EXISTS definitions (database-crm-setup.sql:215 uses
--     opportunity_name/value/total_slots/available_slots/event_id/
--     award_id; migrations/046-catchup-missing-objects.sql:134 uses
--     name/price/max_sponsors/current_sponsors, with no event/award
--     link at all). Whichever ran first against a given database
--     silently wins, so the live column shape is unknown without a
--     direct database check this project could not perform. Nothing in
--     the application ever reads or writes this table (confirmed by a
--     repository-wide grep), so building on it today would risk
--     assuming the wrong column names for an ambiguous, possibly-already-
--     populated table.
--
-- This migration instead creates a NEW, distinctly-named table rather
-- than trying to reconcile the two unknown sponsorship_opportunities
-- shapes. This sidesteps the ambiguity entirely: it does not touch,
-- rename or drop either existing sponsorship_opportunities definition,
-- and does not depend on knowing which (if either) is actually live.
-- Resolving what -- if anything -- should happen to the old
-- sponsorship_opportunities table (e.g. dropping it once confirmed
-- empty via a live check) is a separate, smaller follow-up, not decided
-- or performed here.
--
-- Field choices directly follow BTA-070's section 5B proposed capability
-- list (package name, descriptions, optional price, benefits, optional
-- image, display order, featured status, published status, enquiry
-- button label/destination, optional availability note). No actual
-- package content is seeded by this migration -- the table is created
-- empty, exactly as BTA-070 requires ("the catalogue can initially be
-- empty... do not invent sponsorship packages, prices, benefits or
-- commercial terms").
--
-- NOT APPLIED by this authoring task. Must be run against the test
-- project first, verified, and only then applied to production, per
-- this project's standard migration process.
-- ============================================================

CREATE TABLE IF NOT EXISTS sponsorship_catalogue_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  short_description TEXT,
  full_description TEXT,

  -- NULL = "price on enquiry" / not yet agreed, matching how
  -- become-a-sponsor.html's existing hardcoded cards already show no
  -- figure ("fully customisable, enquire below").
  price NUMERIC(10,2),

  -- JSON array of benefit strings, e.g. ["Logo on BTA website", ...].
  -- JSONB rather than TEXT[] so a future admin UI can store per-benefit
  -- metadata (e.g. "included"/"muted") without a further migration.
  benefits JSONB DEFAULT '[]'::jsonb,

  image_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,

  -- Defaults to unpublished/draft -- an admin must explicitly publish a
  -- package before the public page will show it, so a half-filled-in
  -- draft is never accidentally visible.
  is_published BOOLEAN DEFAULT false,

  enquiry_button_label TEXT DEFAULT 'Enquire Now',
  -- NULL = use the sponsor enquiry form's existing default behaviour
  -- (become-a-sponsor.html's own #contact form), not an invented URL.
  enquiry_destination TEXT,

  availability_note TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sponsorship_catalogue_published
  ON sponsorship_catalogue_packages(is_published, display_order);

-- RLS: deny anon/authenticated entirely. The public page never queries
-- this table directly -- it reads published packages via the existing
-- server-side, service-role get_public_data proxy (api/entry-proxy.js),
-- the same pattern already used for cms_config/custom_sectors/
-- custom_categories. Admin reads/writes go through api/data-proxy.js,
-- which is also service-role and enforces its own role gate
-- (ALLOWED_TABLES/MUTABLE_TABLES). This mirrors the project's existing,
-- already-hardened pattern (migration 081's fix) rather than relying on
-- a public SELECT policy that PostgREST would otherwise expose directly.
ALTER TABLE sponsorship_catalogue_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all to anon/authenticated" ON sponsorship_catalogue_packages;
CREATE POLICY "Deny all to anon/authenticated" ON sponsorship_catalogue_packages
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

NOTIFY pgrst, 'reload schema';
