-- Migration 054: Add missing indexes on high-traffic columns
-- Safe to re-run: uses CREATE INDEX IF NOT EXISTS

-- entries table FK and filter columns
CREATE INDEX IF NOT EXISTS idx_entries_award_id ON entries(award_id);
CREATE INDEX IF NOT EXISTS idx_entries_org_id ON entries(organisation_id);
CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status);
CREATE INDEX IF NOT EXISTS idx_entries_is_public ON entries(is_public);
CREATE INDEX IF NOT EXISTS idx_entries_is_shortlisted ON entries(is_shortlisted);

-- Composite index for public voting page filter
CREATE INDEX IF NOT EXISTS idx_entries_public_voting
  ON entries(status, is_public, allow_public_voting);

-- public_votes: rate-limit queries filter on created_at and voter_ip
-- (this table has no separate voted_at column; created_at serves that purpose)
CREATE INDEX IF NOT EXISTS idx_public_votes_voted_at ON public_votes(created_at);
CREATE INDEX IF NOT EXISTS idx_public_votes_voter_ip ON public_votes(voter_ip);

-- judge_scores: deadline reminder queries filter on judge_email + is_complete
CREATE INDEX IF NOT EXISTS idx_judge_scores_email_complete
  ON judge_scores(judge_email, is_complete);

-- award_years: active award + deadline lookup
CREATE INDEX IF NOT EXISTS idx_award_years_active_deadline
  ON award_years(is_active, judging_close_date);

-- organisations: segment query filters
CREATE INDEX IF NOT EXISTS idx_organisations_county_city ON organisations(county_city);
CREATE INDEX IF NOT EXISTS idx_organisations_status_sector ON organisations(status, sector);
