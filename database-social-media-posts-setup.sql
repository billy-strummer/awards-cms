-- ==================================================
-- SOCIAL MEDIA POSTS TABLE
-- ==================================================
-- This table stores individual social media posts for scheduling,
-- drafting, and publishing across platforms (Twitter, LinkedIn, Facebook, Instagram).
-- Used by: social-media.js (frontend), api/social-media-api.js (backend)

CREATE TABLE IF NOT EXISTS social_media_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  award_id UUID REFERENCES award_years(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  platform_content JSONB, -- Platform-specific content overrides { twitter: "...", linkedin: "..." }
  template_type VARCHAR(100), -- Template used to generate content
  platforms TEXT[] NOT NULL DEFAULT '{}', -- Array of platforms: twitter, linkedin, facebook, instagram
  image_url TEXT,
  add_logo_overlay BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'draft', -- draft, scheduled, published, partial, failed
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  publish_results JSONB, -- Array of { platform, postId, url } results
  publish_errors JSONB, -- Array of { platform, error } failures
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_social_media_posts_status ON social_media_posts(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_social_media_posts_company ON social_media_posts(company_id);
CREATE INDEX IF NOT EXISTS idx_social_media_posts_award ON social_media_posts(award_id);
CREATE INDEX IF NOT EXISTS idx_social_media_posts_created ON social_media_posts(created_at DESC);

COMMENT ON TABLE social_media_posts IS 'Individual social media posts for scheduling and cross-platform publishing';
