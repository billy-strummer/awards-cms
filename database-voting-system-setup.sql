-- ============================================
-- PUBLIC VOTING SYSTEM FOR AWARD ASSIGNMENTS
-- ============================================
-- Adds vote tracking and public voting links
-- ============================================

-- Add vote count to award_assignments table
ALTER TABLE award_assignments
ADD COLUMN IF NOT EXISTS public_vote_count INTEGER DEFAULT 0;

-- Add winner position for top 3 rankings
ALTER TABLE award_assignments
ADD COLUMN IF NOT EXISTS winner_position INTEGER;

-- Add voting slug for pretty URLs (company-name-award-2025)
ALTER TABLE award_assignments
ADD COLUMN IF NOT EXISTS voting_slug TEXT UNIQUE;

-- Create public voting table
CREATE TABLE IF NOT EXISTS public_assignment_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES award_assignments(id) ON DELETE CASCADE,

  -- Voter info
  voter_email VARCHAR(255),
  voter_name VARCHAR(255),
  voter_ip VARCHAR(100),

  -- Vote details
  vote_value INTEGER DEFAULT 1,
  voted_at TIMESTAMP DEFAULT NOW(),

  -- Email verification (optional)
  email_verified BOOLEAN DEFAULT TRUE,
  verification_token VARCHAR(255),

  -- Prevent duplicate votes
  UNIQUE(assignment_id, voter_email)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_public_votes_assignment ON public_assignment_votes(assignment_id);
CREATE INDEX IF NOT EXISTS idx_public_votes_email ON public_assignment_votes(voter_email);
CREATE INDEX IF NOT EXISTS idx_assignment_voting_slug ON award_assignments(voting_slug);

-- Function to generate voting slug
CREATE OR REPLACE FUNCTION generate_voting_slug(
  company_name TEXT,
  award_name TEXT,
  award_year TEXT
) RETURNS TEXT AS $$
DECLARE
  slug TEXT;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  slug := LOWER(TRIM(company_name || ' ' || award_name || ' ' || award_year));
  slug := REGEXP_REPLACE(slug, '[^a-z0-9\s-]', '', 'g');
  slug := REGEXP_REPLACE(slug, '\s+', '-', 'g');
  slug := REGEXP_REPLACE(slug, '-+', '-', 'g');
  slug := TRIM(BOTH '-' FROM slug);

  RETURN slug;
END;
$$ LANGUAGE plpgsql;

-- Update existing assignments with voting slugs
-- UNCOMMENT TO RUN:
/*
UPDATE award_assignments aa
SET voting_slug = generate_voting_slug(
  o.company_name,
  a.award_name,
  a.year::TEXT
)
FROM organisations o, awards a
WHERE aa.organisation_id = o.id
  AND aa.award_id = a.id
  AND aa.voting_slug IS NULL;
*/

-- Function to increment vote count.
-- SCALABILITY NOTE: Each INSERT into public_assignment_votes triggers an UPDATE on the
-- award_assignments row for that entry. Under high concurrent voting (e.g. 500 simultaneous
-- voters for one entry), Postgres will serialize these row-lock updates, creating a queue.
-- At current expected loads (<100 concurrent voters per entry) this is acceptable.
-- For higher scale, replace with an append-only vote_events table and a periodic
-- aggregation job (SELECT COUNT(*) GROUP BY assignment_id) to flush totals.
CREATE OR REPLACE FUNCTION increment_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE award_assignments
  SET public_vote_count = public_vote_count + 1
  WHERE id = NEW.assignment_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-increment vote count
DROP TRIGGER IF EXISTS trigger_increment_vote_count ON public_assignment_votes;
CREATE TRIGGER trigger_increment_vote_count
  AFTER INSERT ON public_assignment_votes
  FOR EACH ROW
  EXECUTE FUNCTION increment_vote_count();

-- Function to decrement vote count (if vote is deleted)
CREATE OR REPLACE FUNCTION decrement_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE award_assignments
  SET public_vote_count = GREATEST(public_vote_count - 1, 0)
  WHERE id = OLD.assignment_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-decrement vote count
DROP TRIGGER IF EXISTS trigger_decrement_vote_count ON public_assignment_votes;
CREATE TRIGGER trigger_decrement_vote_count
  AFTER DELETE ON public_assignment_votes
  FOR EACH ROW
  EXECUTE FUNCTION decrement_vote_count();

-- View: Assignments with vote counts and rankings
CREATE OR REPLACE VIEW assignments_with_votes AS
SELECT
  aa.*,
  o.company_name,
  a.award_name,
  a.year,
  aa.public_vote_count,
  aa.winner_position,
  aa.voting_slug,
  RANK() OVER (PARTITION BY aa.award_id ORDER BY aa.public_vote_count DESC) as vote_rank
FROM award_assignments aa
JOIN organisations o ON aa.organisation_id = o.id
JOIN awards a ON aa.award_id = a.id;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check voting slugs
SELECT
  o.company_name,
  a.award_name,
  a.year,
  aa.voting_slug,
  aa.public_vote_count
FROM award_assignments aa
JOIN organisations o ON aa.organisation_id = o.id
JOIN awards a ON aa.award_id = a.id
LIMIT 10;

-- ============================================
-- INSTRUCTIONS
-- ============================================
/*
1. Run this script to add voting infrastructure
2. Run the UPDATE query (line 51) to generate slugs for existing assignments
3. Voting URLs will be: yoursite.com/vote/[voting_slug]
   Example: yoursite.com/vote/abc-construction-best-builder-2025

4. When CSV importing, voting_slug will be auto-generated via trigger
*/
