-- AI Vetting Results Table
-- Stores results from AI vetting of companies

CREATE TABLE IF NOT EXISTS ai_vetting_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  sector TEXT,
  vetting_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Vetting results
  is_operational BOOLEAN,
  category_match BOOLEAN,
  reputation_score INTEGER CHECK (reputation_score >= 1 AND reputation_score <= 10),
  recent_news TEXT,
  ownership_changes TEXT,
  ai_recommendation TEXT,
  confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),

  -- Status and metadata
  status TEXT CHECK (status IN ('flagged', 'verified', 'needs_review')) DEFAULT 'verified',
  dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  dismissed_by TEXT,
  notes TEXT,
  raw_response JSONB,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_vetting_organisation_id ON ai_vetting_results(organisation_id);
CREATE INDEX IF NOT EXISTS idx_ai_vetting_status ON ai_vetting_results(status);
CREATE INDEX IF NOT EXISTS idx_ai_vetting_date ON ai_vetting_results(vetting_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_vetting_dismissed ON ai_vetting_results(dismissed) WHERE dismissed = false;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_ai_vetting_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_vetting_updated_at
  BEFORE UPDATE ON ai_vetting_results
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_vetting_updated_at();

-- Vetting run tracking table
CREATE TABLE IF NOT EXISTS ai_vetting_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE,
  total_companies INTEGER,
  companies_vetted INTEGER DEFAULT 0,
  companies_flagged INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('running', 'completed', 'failed')) DEFAULT 'running',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for vetting runs
CREATE INDEX IF NOT EXISTS idx_ai_vetting_runs_start_time ON ai_vetting_runs(start_time DESC);

-- Comments
COMMENT ON TABLE ai_vetting_results IS 'Stores AI vetting results for companies/organisations';
COMMENT ON TABLE ai_vetting_runs IS 'Tracks AI vetting run history and progress';
COMMENT ON COLUMN ai_vetting_results.is_operational IS 'Whether the company is still in business';
COMMENT ON COLUMN ai_vetting_results.category_match IS 'Whether the company sector matches their actual business';
COMMENT ON COLUMN ai_vetting_results.reputation_score IS 'AI-assessed reputation score from 1-10';
COMMENT ON COLUMN ai_vetting_results.confidence_score IS 'AI confidence in the assessment (0-1)';
