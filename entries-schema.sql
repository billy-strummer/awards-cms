-- ============================================
-- ENTRY SUBMISSION SYSTEM - DATABASE SCHEMA
-- ============================================

-- Table: entries
-- Main entry submissions table
CREATE TABLE IF NOT EXISTS entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number VARCHAR(50) UNIQUE NOT NULL, -- Auto-generated: BTA-2025-001
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  award_id UUID REFERENCES awards(id) ON DELETE CASCADE,

  -- Entry Details
  entry_title VARCHAR(500) NOT NULL,
  entry_description TEXT,
  why_should_win TEXT, -- Main submission content
  supporting_information TEXT,

  -- Contact Information (from submitter)
  contact_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(50),
  contact_position VARCHAR(255),

  -- Entry Status
  status VARCHAR(50) DEFAULT 'draft', -- draft, submitted, under_review, shortlisted, winner, rejected
  submission_date TIMESTAMP WITH TIME ZONE,

  -- Payment Information
  entry_fee DECIMAL(10,2) DEFAULT 0.00,
  payment_status VARCHAR(50) DEFAULT 'pending', -- pending, paid, refunded, waived
  payment_reference VARCHAR(255),
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,

  -- Judging
  average_score DECIMAL(3,2), -- Calculated from judge_scores
  total_scores INTEGER DEFAULT 0, -- Count of judges who scored
  is_shortlisted BOOLEAN DEFAULT false,
  shortlisted_date TIMESTAMP WITH TIME ZONE,

  -- File Attachments
  supporting_documents JSONB, -- Array of file URLs and metadata
  images JSONB, -- Array of image URLs
  videos JSONB, -- Array of video URLs or YouTube links

  -- Metadata
  year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_by UUID, -- User ID if logged in

  -- Flags
  is_public BOOLEAN DEFAULT false, -- Show in public voting
  allow_public_voting BOOLEAN DEFAULT false,
  public_votes INTEGER DEFAULT 0,

  -- Admin Notes
  admin_notes TEXT,
  internal_tags TEXT[]
);

-- Table: entry_files
-- Separate table for file management
CREATE TABLE IF NOT EXISTS entry_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES entries(id) ON DELETE CASCADE,
  file_name VARCHAR(500) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(100), -- pdf, image, video, document
  file_size BIGINT, -- Size in bytes
  mime_type VARCHAR(100),
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploaded_by VARCHAR(255), -- Email of uploader
  description TEXT,
  is_public BOOLEAN DEFAULT false, -- Can be shown publicly
  display_order INTEGER DEFAULT 0
);

-- Table: judge_scores
-- Individual judge scores for entries
CREATE TABLE IF NOT EXISTS judge_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES entries(id) ON DELETE CASCADE,
  judge_id UUID, -- Reference to judge user/contact
  judge_name VARCHAR(255) NOT NULL,
  judge_email VARCHAR(255) NOT NULL,

  -- Scoring (customize based on criteria)
  innovation_score DECIMAL(3,1), -- Out of 10
  impact_score DECIMAL(3,1),
  quality_score DECIMAL(3,1),
  presentation_score DECIMAL(3,1),
  overall_score DECIMAL(3,1),
  total_score DECIMAL(4,1), -- Sum or weighted average

  -- Feedback
  strengths TEXT,
  weaknesses TEXT,
  comments TEXT,
  recommendation VARCHAR(50), -- shortlist, reject, maybe

  -- Metadata
  scored_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  time_spent_minutes INTEGER, -- Track judging time
  is_complete BOOLEAN DEFAULT false,

  -- Conflict of Interest
  has_conflict BOOLEAN DEFAULT false,
  conflict_reason TEXT,

  UNIQUE(entry_id, judge_email)
);

-- Table: entry_versions
-- Track entry edits and versions
CREATE TABLE IF NOT EXISTS entry_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES entries(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  entry_data JSONB NOT NULL, -- Full entry snapshot
  changed_by VARCHAR(255),
  change_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: public_votes
-- Public voting for entries
CREATE TABLE IF NOT EXISTS public_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES entries(id) ON DELETE CASCADE,
  voter_email VARCHAR(255) NOT NULL,
  voter_ip VARCHAR(100),
  voter_name VARCHAR(255),
  vote_value INTEGER DEFAULT 1, -- Could be 1-5 for rating
  voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Verification
  email_verified BOOLEAN DEFAULT false,
  verification_token VARCHAR(255),
  verification_sent_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(entry_id, voter_email)
);

-- Table: entry_comments
-- Comments/feedback on entries (internal or public)
CREATE TABLE IF NOT EXISTS entry_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES entries(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  author_email VARCHAR(255) NOT NULL,
  is_internal BOOLEAN DEFAULT true, -- Internal admin comment vs public
  parent_comment_id UUID REFERENCES entry_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function: Generate entry number
CREATE OR REPLACE FUNCTION generate_entry_number()
RETURNS TRIGGER AS $$
DECLARE
  next_number INTEGER;
  year_val INTEGER;
BEGIN
  year_val := EXTRACT(YEAR FROM NOW());

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(entry_number FROM '(\d+)$') AS INTEGER)
  ), 0) + 1
  INTO next_number
  FROM entries
  WHERE entry_number LIKE 'BTA-' || year_val || '-%';

  NEW.entry_number := 'BTA-' || year_val || '-' || LPAD(next_number::TEXT, 4, '0');
  NEW.year := year_val;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-generate entry number
CREATE TRIGGER set_entry_number
  BEFORE INSERT ON entries
  FOR EACH ROW
  WHEN (NEW.entry_number IS NULL)
  EXECUTE FUNCTION generate_entry_number();

-- Function: Update average score when judge score added/updated
CREATE OR REPLACE FUNCTION update_entry_scores()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE entries
  SET
    average_score = (
      SELECT AVG(total_score)
      FROM judge_scores
      WHERE entry_id = NEW.entry_id AND is_complete = true
    ),
    total_scores = (
      SELECT COUNT(*)
      FROM judge_scores
      WHERE entry_id = NEW.entry_id AND is_complete = true
    )
  WHERE id = NEW.entry_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update scores on judge_scores changes
CREATE TRIGGER update_scores_on_judge_score
  AFTER INSERT OR UPDATE ON judge_scores
  FOR EACH ROW
  WHEN (NEW.is_complete = true)
  EXECUTE FUNCTION update_entry_scores();

-- Function: Update public vote count
CREATE OR REPLACE FUNCTION update_public_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE entries
  SET public_votes = (
    SELECT COUNT(*)
    FROM public_votes
    WHERE entry_id = NEW.entry_id AND email_verified = true
  )
  WHERE id = NEW.entry_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update vote count
CREATE TRIGGER update_vote_count_on_vote
  AFTER INSERT OR UPDATE OR DELETE ON public_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_public_vote_count();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_entries_organisation ON entries(organisation_id);
CREATE INDEX IF NOT EXISTS idx_entries_award ON entries(award_id);
CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status);
CREATE INDEX IF NOT EXISTS idx_entries_year ON entries(year);
CREATE INDEX IF NOT EXISTS idx_entries_submission_date ON entries(submission_date DESC);
CREATE INDEX IF NOT EXISTS idx_entries_shortlisted ON entries(is_shortlisted);
CREATE INDEX IF NOT EXISTS idx_entry_files_entry ON entry_files(entry_id);
CREATE INDEX IF NOT EXISTS idx_judge_scores_entry ON judge_scores(entry_id);
CREATE INDEX IF NOT EXISTS idx_judge_scores_judge ON judge_scores(judge_email);
CREATE INDEX IF NOT EXISTS idx_public_votes_entry ON public_votes(entry_id);
CREATE INDEX IF NOT EXISTS idx_public_votes_email ON public_votes(voter_email);

-- View: Entry Summary with all data
CREATE OR REPLACE VIEW entry_summary AS
SELECT
  e.*,
  o.company_name,
  o.website,
  o.logo_url,
  a.award_name,
  a.category,
  COUNT(DISTINCT ef.id) as file_count,
  COUNT(DISTINCT js.id) as judge_count,
  AVG(js.total_score) as avg_judge_score
FROM entries e
LEFT JOIN organisations o ON e.organisation_id = o.id
LEFT JOIN awards a ON e.award_id = a.id
LEFT JOIN entry_files ef ON e.id = ef.entry_id
LEFT JOIN judge_scores js ON e.id = js.entry_id AND js.is_complete = true
GROUP BY e.id, o.company_name, o.website, o.logo_url, a.award_name, a.category;

-- Comments
COMMENT ON TABLE entries IS 'Main entry submissions for awards';
COMMENT ON TABLE entry_files IS 'File attachments for entries';
COMMENT ON TABLE judge_scores IS 'Individual judge scores and feedback';
COMMENT ON TABLE entry_versions IS 'Version history for entry edits';
COMMENT ON TABLE public_votes IS 'Public votes for entries';
COMMENT ON TABLE entry_comments IS 'Comments and feedback on entries';
