-- ============================================
-- SOCIAL MEDIA MANAGER - DATABASE SCHEMA
-- ============================================

-- Table: social_media_posts
-- Stores all social media posts (drafts, scheduled, published)
CREATE TABLE IF NOT EXISTS social_media_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  award_id UUID REFERENCES awards(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  template_type VARCHAR(50), -- 'nominee', 'winner', 'voting', or NULL for custom
  platforms TEXT[] NOT NULL, -- Array of platforms: ['twitter', 'facebook', 'instagram', 'linkedin']
  image_url TEXT,
  add_logo_overlay BOOLEAN DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft', 'scheduled', 'published', 'failed'
  scheduled_for TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID, -- Optional: reference to user who created the post

  -- Platform-specific post IDs (when published)
  twitter_post_id VARCHAR(255),
  facebook_post_id VARCHAR(255),
  instagram_post_id VARCHAR(255),
  linkedin_post_id VARCHAR(255),

  -- Engagement metrics (optional, can be populated by webhooks/API)
  twitter_likes INTEGER DEFAULT 0,
  twitter_retweets INTEGER DEFAULT 0,
  facebook_likes INTEGER DEFAULT 0,
  facebook_shares INTEGER DEFAULT 0,
  instagram_likes INTEGER DEFAULT 0,
  linkedin_likes INTEGER DEFAULT 0,

  -- Error tracking
  last_error TEXT,
  error_count INTEGER DEFAULT 0
);

-- Table: social_media_accounts
-- Stores connected social media account credentials (OAuth tokens)
CREATE TABLE IF NOT EXISTS social_media_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform VARCHAR(50) NOT NULL, -- 'twitter', 'facebook', 'instagram', 'linkedin'
  account_name VARCHAR(255) NOT NULL,
  account_id VARCHAR(255), -- Platform-specific account ID
  access_token TEXT, -- Encrypted OAuth access token
  refresh_token TEXT, -- Encrypted OAuth refresh token
  token_expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(platform, account_id)
);

-- Table: social_media_templates
-- Reusable post templates
CREATE TABLE IF NOT EXISTS social_media_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_type VARCHAR(50) NOT NULL, -- 'nominee', 'winner', 'voting', 'custom'
  content TEXT NOT NULL,
  platforms TEXT[], -- Recommended platforms for this template
  default_image_source VARCHAR(50), -- 'company_logo', 'custom', 'none'
  add_logo_overlay BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: social_media_campaigns
-- Group related posts into campaigns
CREATE TABLE IF NOT EXISTS social_media_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  award_id UUID REFERENCES awards(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'paused', 'completed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Link posts to campaigns
ALTER TABLE social_media_posts ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES social_media_campaigns(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_social_media_posts_status ON social_media_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_media_posts_scheduled_for ON social_media_posts(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_social_media_posts_company_id ON social_media_posts(company_id);
CREATE INDEX IF NOT EXISTS idx_social_media_posts_award_id ON social_media_posts(award_id);
CREATE INDEX IF NOT EXISTS idx_social_media_posts_created_at ON social_media_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_media_accounts_platform ON social_media_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_social_media_accounts_is_active ON social_media_accounts(is_active);

-- Insert default templates
INSERT INTO social_media_templates (name, description, template_type, content, platforms, add_logo_overlay, is_default)
VALUES
  (
    'Nominee Announcement',
    'Standard template for announcing nominees',
    'nominee',
    '🌟 Congratulations to {{company_name}} for being nominated for the {{award_name}} at the British Trade Awards {{year}}!

We''re proud to recognize their outstanding achievements.

Cast your vote now: {{website}}

#BritishTradeAwards #{{award_name}} #Excellence',
    ARRAY['twitter', 'facebook', 'linkedin', 'instagram'],
    true,
    true
  ),
  (
    'Winner Announcement',
    'Standard template for announcing winners',
    'winner',
    '🏆 Huge congratulations to {{company_name}} - WINNER of the {{award_name}} at the British Trade Awards {{year}}!

Their exceptional work has set the standard for excellence in British trade.

Learn more about their winning entry: {{website}}

#BritishTradeAwards #Winner #{{award_name}}',
    ARRAY['twitter', 'facebook', 'linkedin', 'instagram'],
    true,
    true
  ),
  (
    'Voting Reminder',
    'Standard template for voting reminders',
    'voting',
    '⏰ Time is running out to vote for {{company_name}} in the {{award_name}} category!

Show your support and cast your vote today.

Vote now: {{website}}

#BritishTradeAwards #VoteNow #{{award_name}}',
    ARRAY['twitter', 'facebook', 'linkedin', 'instagram'],
    true,
    true
  )
ON CONFLICT DO NOTHING;

-- Update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_social_media_posts_updated_at
  BEFORE UPDATE ON social_media_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_media_accounts_updated_at
  BEFORE UPDATE ON social_media_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_media_templates_updated_at
  BEFORE UPDATE ON social_media_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_media_campaigns_updated_at
  BEFORE UPDATE ON social_media_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE social_media_posts IS 'Stores all social media posts including drafts, scheduled, and published posts';
COMMENT ON TABLE social_media_accounts IS 'Stores OAuth credentials for connected social media accounts';
COMMENT ON TABLE social_media_templates IS 'Reusable post templates with placeholders';
COMMENT ON TABLE social_media_campaigns IS 'Group related posts into marketing campaigns';
