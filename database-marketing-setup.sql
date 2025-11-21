-- ==================================================
-- MARKETING & ADVERTISING SYSTEM SCHEMA
-- ==================================================

-- ============================================
-- BANNERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  position VARCHAR(50) NOT NULL, -- 'header', 'sidebar', 'footer', 'popup', 'leaderboard'
  width INTEGER,
  height INTEGER,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  target_blank BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SPONSORS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sponsors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  website TEXT,
  email VARCHAR(255),
  contact_name VARCHAR(255),
  contact_phone VARCHAR(50),
  tier VARCHAR(50) DEFAULT 'Bronze', -- 'Platinum', 'Gold', 'Silver', 'Bronze', 'Partner'
  sponsorship_amount DECIMAL(10, 2),
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  benefits TEXT,
  notes TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link sponsors to specific awards/events
CREATE TABLE IF NOT EXISTS sponsor_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sponsor_id UUID REFERENCES sponsors(id) ON DELETE CASCADE,
  award_id UUID REFERENCES awards(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  assigned_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SOCIAL MEDIA CAMPAIGNS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS social_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_name VARCHAR(255) NOT NULL,
  description TEXT,
  platform VARCHAR(50) NOT NULL, -- 'Twitter', 'LinkedIn', 'Instagram', 'Facebook', 'Multiple'
  post_content TEXT NOT NULL,
  image_url TEXT,
  scheduled_date TIMESTAMPTZ,
  posted_date TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'Draft', -- 'Draft', 'Scheduled', 'Posted', 'Cancelled'
  post_url TEXT,
  likes INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  award_id UUID REFERENCES awards(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  hashtags TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EMAIL TEMPLATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  html_content TEXT NOT NULL,
  plain_text_content TEXT,
  category VARCHAR(100), -- 'Winner Announcement', 'Event Invitation', 'Newsletter', 'Sponsor Update', etc.
  variables TEXT, -- JSON array of available variables like {{company_name}}, {{award_name}}
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EMAIL CAMPAIGNS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_name VARCHAR(255) NOT NULL,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  subject VARCHAR(500) NOT NULL,
  recipients TEXT NOT NULL, -- JSON array or comma-separated emails
  scheduled_date TIMESTAMPTZ,
  sent_date TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'Draft', -- 'Draft', 'Scheduled', 'Sent', 'Cancelled'
  total_recipients INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  award_id UUID REFERENCES awards(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRESS RELEASES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS press_releases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(500) NOT NULL,
  subtitle VARCHAR(500),
  content TEXT NOT NULL,
  featured_image_url TEXT,
  publish_date DATE NOT NULL,
  is_published BOOLEAN DEFAULT false,
  author VARCHAR(255),
  award_id UUID REFERENCES awards(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  tags TEXT,
  seo_title VARCHAR(255),
  seo_description TEXT,
  slug VARCHAR(255) UNIQUE,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_banners_active ON banners(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_banners_position ON banners(position, display_order);
CREATE INDEX IF NOT EXISTS idx_sponsors_active ON sponsors(is_active, tier);
CREATE INDEX IF NOT EXISTS idx_social_campaigns_status ON social_campaigns(status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_social_campaigns_platform ON social_campaigns(platform);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category, is_active);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_press_releases_published ON press_releases(is_published, publish_date);
CREATE INDEX IF NOT EXISTS idx_press_releases_slug ON press_releases(slug);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE banners IS 'Website advertising banners with scheduling and tracking';
COMMENT ON TABLE sponsors IS 'Sponsor and partner management';
COMMENT ON TABLE sponsor_assignments IS 'Link sponsors to specific awards or events';
COMMENT ON TABLE social_campaigns IS 'Social media campaign planning and tracking';
COMMENT ON TABLE email_templates IS 'Reusable email templates for marketing';
COMMENT ON TABLE email_campaigns IS 'Email campaign management and analytics';
COMMENT ON TABLE press_releases IS 'Press releases and news announcements';
