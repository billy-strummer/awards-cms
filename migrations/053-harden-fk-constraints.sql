-- Migration 053: Harden soft/missing foreign key constraints
-- Converts comment-only "soft FKs" to hard database constraints.
-- Safe to re-run: each ALTER TABLE is wrapped in an exception handler.

-- judge_conflicts.org_id → organisations(id)
DO $$
BEGIN
  ALTER TABLE judge_conflicts
    ADD CONSTRAINT judge_conflicts_org_fkey
    FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- email_campaigns.award_id → award_years(id)
DO $$
BEGIN
  ALTER TABLE email_campaigns
    ADD CONSTRAINT email_campaigns_award_id_fkey
    FOREIGN KEY (award_id) REFERENCES award_years(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL;
END $$;

-- email_campaigns.event_id → events(id)
DO $$
BEGIN
  ALTER TABLE email_campaigns
    ADD CONSTRAINT email_campaigns_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL;
END $$;
