-- ============================================
-- BRITISH TRADE AWARDS - ENHANCED CMS SCHEMA
-- FINAL FIXED VERSION - Correct column references
-- ============================================

-- ============================================
-- STEP 1: FIX EXISTING TABLES (Add Primary Keys)
-- ============================================

-- Fix organisations table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'organisations_pkey' AND conrelid = 'organisations'::regclass
  ) THEN
    ALTER TABLE organisations ADD PRIMARY KEY (id);
  END IF;
END $$;

-- Fix awards table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'awards_pkey' AND conrelid = 'awards'::regclass
  ) THEN
    ALTER TABLE awards ADD PRIMARY KEY (id);
  END IF;
END $$;

-- Fix winners table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'winners_pkey' AND conrelid = 'winners'::regclass
  ) THEN
    ALTER TABLE winners ADD PRIMARY KEY (id);
  END IF;
END $$;

-- ============================================
-- STEP 2: ADD NEW COLUMNS TO EXISTING TABLES
-- ============================================

-- Enhanced organisations table
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS achievements TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS company_size VARCHAR(50);
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS employee_count INTEGER;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS annual_revenue DECIMAL(15,2);
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS year_founded INTEGER;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS twitter_url TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS tier VARCHAR(50);

-- Enhanced awards table
ALTER TABLE awards ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE awards ADD COLUMN IF NOT EXISTS criteria TEXT;
ALTER TABLE awards ADD COLUMN IF NOT EXISTS prize_details TEXT;
ALTER TABLE awards ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE awards ADD COLUMN IF NOT EXISTS sponsor_logo_url TEXT;
ALTER TABLE awards ADD COLUMN IF NOT EXISTS sponsor_name VARCHAR(255);
ALTER TABLE awards ADD COLUMN IF NOT EXISTS parent_category_id UUID;
ALTER TABLE awards ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE awards ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE awards ADD COLUMN IF NOT EXISTS show_on_website BOOLEAN DEFAULT TRUE;
ALTER TABLE awards ADD COLUMN IF NOT EXISTS entry_open_date DATE;
ALTER TABLE awards ADD COLUMN IF NOT EXISTS entry_close_date DATE;
ALTER TABLE awards ADD COLUMN IF NOT EXISTS judging_deadline DATE;
ALTER TABLE awards ADD COLUMN IF NOT EXISTS announcement_date DATE;

-- Enhanced winners table
ALTER TABLE winners ADD COLUMN IF NOT EXISTS organisation_id UUID;
ALTER TABLE winners ADD COLUMN IF NOT EXISTS award_id UUID;
ALTER TABLE winners ADD COLUMN IF NOT EXISTS winner_story TEXT;
ALTER TABLE winners ADD COLUMN IF NOT EXISTS judge_quote TEXT;
ALTER TABLE winners ADD COLUMN IF NOT EXISTS impact_statement TEXT;
ALTER TABLE winners ADD COLUMN IF NOT EXISTS score DECIMAL(3,1);
ALTER TABLE winners ADD COLUMN IF NOT EXISTS show_on_website BOOLEAN DEFAULT TRUE;
ALTER TABLE winners ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE;
ALTER TABLE winners ADD COLUMN IF NOT EXISTS announced_date DATE;

-- Add foreign key for winners.organisation_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'winners_organisation_id_fkey'
  ) THEN
    ALTER TABLE winners 
    ADD CONSTRAINT winners_organisation_id_fkey 
    FOREIGN KEY (organisation_id) 
    REFERENCES organisations(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key for winners.award_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'winners_award_id_fkey'
  ) THEN
    ALTER TABLE winners 
    ADD CONSTRAINT winners_award_id_fkey 
    FOREIGN KEY (award_id) 
    REFERENCES awards(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- STEP 3: CREATE NEW TABLES
-- ============================================

-- Award Assignments
CREATE TABLE IF NOT EXISTS award_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  award_id UUID REFERENCES awards(id) ON DELETE CASCADE,
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  
  status VARCHAR(50) DEFAULT 'nominated',
  assigned_date TIMESTAMP DEFAULT NOW(),
  assigned_by VARCHAR(255),
  
  judge_score DECIMAL(3,1),
  judge_comments TEXT,
  
  winner_position INTEGER,
  announcement_date DATE,
  
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(award_id, organisation_id)
);

CREATE INDEX IF NOT EXISTS idx_award_assignments_award ON award_assignments(award_id);
CREATE INDEX IF NOT EXISTS idx_award_assignments_org ON award_assignments(organisation_id);
CREATE INDEX IF NOT EXISTS idx_award_assignments_status ON award_assignments(status);

-- Organisation Contacts
CREATE TABLE IF NOT EXISTS organisation_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  job_title VARCHAR(255),
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  mobile VARCHAR(50),
  linkedin_url TEXT,
  
  is_primary BOOLEAN DEFAULT FALSE,
  receive_emails BOOLEAN DEFAULT TRUE,
  
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_org ON organisation_contacts(organisation_id);
CREATE INDEX IF NOT EXISTS idx_contacts_primary ON organisation_contacts(is_primary);

-- Email Templates
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_category ON email_templates(category);

-- Email Campaigns
CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  template_id UUID,
  
  status VARCHAR(50) DEFAULT 'draft',
  send_at TIMESTAMP,
  sent_at TIMESTAMP,
  
  recipient_type VARCHAR(50),
  recipient_count INTEGER DEFAULT 0,
  
  emails_sent INTEGER DEFAULT 0,
  emails_delivered INTEGER DEFAULT 0,
  emails_opened INTEGER DEFAULT 0,
  emails_clicked INTEGER DEFAULT 0,
  emails_bounced INTEGER DEFAULT 0,
  
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_send_at ON email_campaigns(send_at);

-- Add foreign key for template_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_campaigns_template_id_fkey'
  ) THEN
    ALTER TABLE email_campaigns 
    ADD CONSTRAINT email_campaigns_template_id_fkey 
    FOREIGN KEY (template_id) 
    REFERENCES email_templates(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Email Logs
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID,
  
  organisation_id UUID,
  contact_id UUID,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  
  subject VARCHAR(500),
  body TEXT,
  
  status VARCHAR(50) DEFAULT 'pending',
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  
  error_message TEXT,
  bounce_reason TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_campaign ON email_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_org ON email_logs(organisation_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);

-- Add foreign keys for email_logs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_logs_campaign_id_fkey') THEN
    ALTER TABLE email_logs ADD CONSTRAINT email_logs_campaign_id_fkey 
    FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_logs_organisation_id_fkey') THEN
    ALTER TABLE email_logs ADD CONSTRAINT email_logs_organisation_id_fkey 
    FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_logs_contact_id_fkey') THEN
    ALTER TABLE email_logs ADD CONSTRAINT email_logs_contact_id_fkey 
    FOREIGN KEY (contact_id) REFERENCES organisation_contacts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Winner Documents
CREATE TABLE IF NOT EXISTS winner_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  winner_id UUID REFERENCES winners(id) ON DELETE CASCADE,
  
  document_type VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type VARCHAR(100),
  
  is_public BOOLEAN DEFAULT FALSE,
  
  uploaded_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_winner_docs_winner ON winner_documents(winner_id);
CREATE INDEX IF NOT EXISTS idx_winner_docs_type ON winner_documents(document_type);

-- Certificate Templates
CREATE TABLE IF NOT EXISTS certificate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  template_image_url TEXT,
  layout_json TEXT,
  
  is_default BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  event_type VARCHAR(50) DEFAULT 'ceremony',
  
  event_date DATE NOT NULL,
  event_time TIME,
  venue_name VARCHAR(255),
  venue_address TEXT,
  capacity INTEGER,
  
  ticket_price DECIMAL(10,2),
  ticket_url TEXT,
  
  dress_code VARCHAR(100),
  status VARCHAR(50) DEFAULT 'planned',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Event Guests
CREATE TABLE IF NOT EXISTS event_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  
  organisation_id UUID,
  contact_id UUID,
  
  guest_name VARCHAR(255) NOT NULL,
  guest_email VARCHAR(255),
  guest_type VARCHAR(50),
  
  rsvp_status VARCHAR(50) DEFAULT 'pending',
  rsvp_date TIMESTAMP,
  plus_ones INTEGER DEFAULT 0,
  
  table_number INTEGER,
  seat_number INTEGER,
  dietary_requirements TEXT,
  
  checked_in BOOLEAN DEFAULT FALSE,
  check_in_time TIMESTAMP,
  
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_guests_event ON event_guests(event_id);
CREATE INDEX IF NOT EXISTS idx_event_guests_org ON event_guests(organisation_id);
CREATE INDEX IF NOT EXISTS idx_event_guests_rsvp ON event_guests(rsvp_status);

-- Add foreign keys for event_guests
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_guests_organisation_id_fkey') THEN
    ALTER TABLE event_guests ADD CONSTRAINT event_guests_organisation_id_fkey 
    FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_guests_contact_id_fkey') THEN
    ALTER TABLE event_guests ADD CONSTRAINT event_guests_contact_id_fkey 
    FOREIGN KEY (contact_id) REFERENCES organisation_contacts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Sponsorships
CREATE TABLE IF NOT EXISTS sponsorships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  
  tier VARCHAR(50) NOT NULL,
  package_name VARCHAR(255),
  amount DECIMAL(10,2) NOT NULL,
  year INTEGER NOT NULL,
  
  benefits TEXT[],
  logo_placement TEXT[],
  event_tickets INTEGER DEFAULT 0,
  speaking_opportunity BOOLEAN DEFAULT FALSE,
  
  sponsored_awards UUID[],
  
  status VARCHAR(50) DEFAULT 'pending',
  contract_signed BOOLEAN DEFAULT FALSE,
  payment_received BOOLEAN DEFAULT FALSE,
  
  deliverables_json TEXT,
  
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sponsorships_org ON sponsorships(organisation_id);
CREATE INDEX IF NOT EXISTS idx_sponsorships_year ON sponsorships(year);
CREATE INDEX IF NOT EXISTS idx_sponsorships_tier ON sponsorships(tier);

-- User Roles
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,
  
  role VARCHAR(50) NOT NULL,
  
  permissions TEXT,
  
  restricted_to_awards UUID[],
  restricted_to_orgs UUID[],
  
  is_active BOOLEAN DEFAULT TRUE,
  
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_email ON user_roles(email);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID,
  user_email VARCHAR(255),
  
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  
  description TEXT,
  changes_json TEXT,
  
  ip_address VARCHAR(50),
  user_agent TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);

-- Media Gallery (Feature 11 - Photo/Video CMS)
CREATE TABLE IF NOT EXISTS media_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_type VARCHAR(50),
  file_size INTEGER,
  
  award_id UUID,
  organisation_id UUID,
  winner_id UUID,
  
  title VARCHAR(255),
  caption TEXT,
  alt_text VARCHAR(255),
  tags TEXT[],
  
  media_category VARCHAR(50),
  event_date DATE,
  photographer VARCHAR(255),
  
  is_public BOOLEAN DEFAULT TRUE,
  featured BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  
  show_in_gallery BOOLEAN DEFAULT TRUE,
  show_on_winner_page BOOLEAN DEFAULT TRUE,
  show_on_company_page BOOLEAN DEFAULT TRUE,
  
  uploaded_by VARCHAR(255),
  uploaded_at TIMESTAMP DEFAULT NOW(),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_gallery_award ON media_gallery(award_id);
CREATE INDEX IF NOT EXISTS idx_media_gallery_org ON media_gallery(organisation_id);
CREATE INDEX IF NOT EXISTS idx_media_gallery_winner ON media_gallery(winner_id);
CREATE INDEX IF NOT EXISTS idx_media_gallery_category ON media_gallery(media_category);
CREATE INDEX IF NOT EXISTS idx_media_gallery_public ON media_gallery(is_public);

-- Add foreign keys for media_gallery
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_gallery_award_id_fkey') THEN
    ALTER TABLE media_gallery ADD CONSTRAINT media_gallery_award_id_fkey 
    FOREIGN KEY (award_id) REFERENCES awards(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_gallery_organisation_id_fkey') THEN
    ALTER TABLE media_gallery ADD CONSTRAINT media_gallery_organisation_id_fkey 
    FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_gallery_winner_id_fkey') THEN
    ALTER TABLE media_gallery ADD CONSTRAINT media_gallery_winner_id_fkey 
    FOREIGN KEY (winner_id) REFERENCES winners(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- STEP 4: CREATE HELPER FUNCTIONS
-- ============================================

-- Function to get assignment count
CREATE OR REPLACE FUNCTION get_award_assignment_count(award_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER 
  FROM award_assignments 
  WHERE award_id = award_uuid;
$$ LANGUAGE SQL;

-- Function to get winner count
CREATE OR REPLACE FUNCTION get_award_winner_count(award_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER 
  FROM award_assignments 
  WHERE award_id = award_uuid 
  AND status = 'winner';
$$ LANGUAGE SQL;

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 5: CREATE TRIGGERS
-- ============================================

-- Create triggers for updated_at (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_award_assignments_updated_at') THEN
    CREATE TRIGGER update_award_assignments_updated_at 
      BEFORE UPDATE ON award_assignments 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_organisation_contacts_updated_at') THEN
    CREATE TRIGGER update_organisation_contacts_updated_at 
      BEFORE UPDATE ON organisation_contacts 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_email_campaigns_updated_at') THEN
    CREATE TRIGGER update_email_campaigns_updated_at 
      BEFORE UPDATE ON email_campaigns 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_events_updated_at') THEN
    CREATE TRIGGER update_events_updated_at 
      BEFORE UPDATE ON events 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sponsorships_updated_at') THEN
    CREATE TRIGGER update_sponsorships_updated_at 
      BEFORE UPDATE ON sponsorships 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_media_gallery_updated_at') THEN
    CREATE TRIGGER update_media_gallery_updated_at 
      BEFORE UPDATE ON media_gallery 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- STEP 6: INSERT DEFAULT EMAIL TEMPLATES
-- ============================================

INSERT INTO email_templates (name, description, category, subject, body, is_default)
VALUES
('Winner Announcement', 'Congratulate winners', 'winner', 
'Congratulations! You''ve won the {AWARD_NAME}',
'Dear {CONTACT_NAME},

We are absolutely delighted to announce that {COMPANY_NAME} has won the {AWARD_NAME} {YEAR}!

Your outstanding achievement and innovation have impressed our judges, and we are honored to recognize your success.

Awards Ceremony Details:
Date: {EVENT_DATE}
Time: {EVENT_TIME}
Venue: {EVENT_VENUE}

We look forward to celebrating with you!

Best regards,
British Trade Awards Team',
TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO email_templates (name, description, category, subject, body, is_default)
VALUES
('Shortlist Notification', 'Notify shortlisted companies', 'shortlist',
'You''ve been shortlisted for the {AWARD_NAME}',
'Dear {CONTACT_NAME},

Congratulations! We are pleased to inform you that {COMPANY_NAME} has been shortlisted for the {AWARD_NAME} {YEAR}.

Being shortlisted places you among the top candidates in your category, which is a significant achievement in itself.

Winners will be announced on {ANNOUNCEMENT_DATE}.

Best of luck!

Best regards,
British Trade Awards Team',
TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO email_templates (name, description, category, subject, body, is_default)
VALUES
('Event Invitation', 'Invite guests to ceremony', 'event',
'{COMPANY_NAME} - British Trade Awards Ceremony Invitation',
'Dear {CONTACT_NAME},

You are cordially invited to attend the British Trade Awards {YEAR} Ceremony.

Event Details:
Date: {EVENT_DATE}
Time: {EVENT_TIME}
Venue: {EVENT_VENUE}
Dress Code: {DRESS_CODE}

Please RSVP by {RSVP_DATE}.

We look forward to celebrating excellence with you!

Best regards,
British Trade Awards Team',
TRUE)
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 7: CREATE VIEWS
-- ============================================

-- View: Awards with stats
CREATE OR REPLACE VIEW awards_with_stats AS
SELECT 
  a.*,
  COUNT(DISTINCT aa.id) as total_assignments,
  COUNT(DISTINCT CASE WHEN aa.status = 'winner' THEN aa.id END) as winner_count,
  COUNT(DISTINCT CASE WHEN aa.status = 'shortlisted' THEN aa.id END) as shortlist_count,
  COUNT(DISTINCT CASE WHEN aa.status = 'nominated' THEN aa.id END) as nominee_count
FROM awards a
LEFT JOIN award_assignments aa ON a.id = aa.award_id
GROUP BY a.id;

-- View: Organisations with stats
CREATE OR REPLACE VIEW organisations_with_stats AS
SELECT 
  o.*,
  COUNT(DISTINCT oc.id) as contact_count,
  COUNT(DISTINCT aa.id) as award_count,
  COUNT(DISTINCT CASE WHEN aa.status = 'winner' THEN aa.id END) as wins_count
FROM organisations o
LEFT JOIN organisation_contacts oc ON o.id = oc.organisation_id
LEFT JOIN award_assignments aa ON o.id = aa.organisation_id
GROUP BY o.id;

-- View: Media with details (FIXED - uses correct column names)
CREATE OR REPLACE VIEW media_gallery_with_details AS
SELECT 
  mg.*,
  a.award_name,
  a.year as award_year,
  o.company_name,
  COALESCE(w.winner_name, w.winner, o.company_name) as winner_display_name
FROM media_gallery mg
LEFT JOIN awards a ON mg.award_id = a.id
LEFT JOIN organisations o ON mg.organisation_id = o.id
LEFT JOIN winners w ON mg.winner_id = w.id;

-- ============================================
-- COMPLETED!
-- ============================================

SELECT 'British Trade Awards Enhanced CMS Schema Installed Successfully!' as message,
       'All tables, functions, triggers, and views have been created.' as status,
       'Database is ready! Proceed with Feature 1 installation.' as next_step;
