-- ============================================================
-- MIGRATION 020: Fix remaining schema/code mismatches (Round 4)
-- FKs, missing columns, column renames
-- ============================================================

-- 1. WINNERS — add missing FK so PostgREST can resolve !winners_award_id_fkey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'winners_award_id_fkey'
      AND table_name = 'winners'
  ) THEN
    ALTER TABLE winners
      ADD CONSTRAINT winners_award_id_fkey
      FOREIGN KEY (award_id) REFERENCES award_years(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. MEDIA_GALLERY — rename visibility columns to match JS code
--    Migration 014 created: show_on_winner, show_on_company, show_on_gallery
--    JS uses: show_on_winner_page, show_on_company_page, show_in_gallery
--    (database-schema.sql may have already created the target names directly,
--    so only rename when the source exists and the target doesn't.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media_gallery' AND column_name = 'show_on_winner')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media_gallery' AND column_name = 'show_on_winner_page') THEN
    ALTER TABLE media_gallery RENAME COLUMN show_on_winner TO show_on_winner_page;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media_gallery' AND column_name = 'show_on_company')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media_gallery' AND column_name = 'show_on_company_page') THEN
    ALTER TABLE media_gallery RENAME COLUMN show_on_company TO show_on_company_page;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media_gallery' AND column_name = 'show_on_gallery')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media_gallery' AND column_name = 'show_in_gallery') THEN
    ALTER TABLE media_gallery RENAME COLUMN show_on_gallery TO show_in_gallery;
  END IF;
END $$;

-- 3. MEDIA_GALLERY — add alt_text column
ALTER TABLE media_gallery ADD COLUMN IF NOT EXISTS alt_text TEXT;

-- 4. PUBLIC_VOTES — add 6 missing columns for voting insert
ALTER TABLE public_votes ADD COLUMN IF NOT EXISTS voter_name TEXT;
ALTER TABLE public_votes ADD COLUMN IF NOT EXISTS voter_ip TEXT;
ALTER TABLE public_votes ADD COLUMN IF NOT EXISTS vote_value INTEGER DEFAULT 1;
ALTER TABLE public_votes ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public_votes ADD COLUMN IF NOT EXISTS verification_token TEXT;
ALTER TABLE public_votes ADD COLUMN IF NOT EXISTS verification_sent_at TIMESTAMPTZ;

-- 5. SOCIAL_MEDIA_POSTS — add FK for award_id join
ALTER TABLE social_media_posts
  ADD CONSTRAINT social_media_posts_award_id_fkey
  FOREIGN KEY (award_id) REFERENCES award_years(id) ON DELETE SET NULL;

-- 6. SOCIAL_MEDIA_POSTS — add 3 missing publishing columns
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS publish_results JSONB;
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS publish_errors JSONB;

-- 7. RUNNING_ORDER_SETTINGS — add published_at column
ALTER TABLE running_order_settings ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- 8. DEALS — add FK for contact_id → organisation_contacts join
-- (database-crm-setup.sql's inline "contact_id UUID REFERENCES organisation_contacts(id)"
-- already auto-created this constraint under the same conventional name.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'deals_contact_id_fkey' AND table_name = 'deals'
  ) THEN
    ALTER TABLE deals
      ADD CONSTRAINT deals_contact_id_fkey
      FOREIGN KEY (contact_id) REFERENCES organisation_contacts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 9. JUDGE_SCORES — add judge_id FK for contacts→judge_scores join
ALTER TABLE judge_scores ADD COLUMN IF NOT EXISTS judge_id UUID;
ALTER TABLE judge_scores
  ADD CONSTRAINT judge_scores_judge_id_fkey
  FOREIGN KEY (judge_id) REFERENCES contacts(id) ON DELETE SET NULL;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
