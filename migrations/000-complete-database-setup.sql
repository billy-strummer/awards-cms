-- ============================================================
-- COMPLETE DATABASE SETUP FOR AWARDS CMS
-- Run this in Supabase SQL Editor (you can run it all at once)
-- Safe to re-run: uses IF NOT EXISTS throughout
-- ============================================================

-- ============================================================
-- 1. AWARDS VIEW (maps 'awards' to your existing 'award_years' table)
-- ============================================================

-- First, add any missing columns to the existing award_years table
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS award_name TEXT;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS award_category TEXT;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS sector TEXT;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS county TEXT;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Draft';
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS entry_open_date DATE;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS entry_close_date DATE;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS nominees_announcement_date DATE;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS judging_open_date DATE;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS judging_close_date DATE;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS voting_open_date DATE;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS voting_close_date DATE;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS winners_announcement_date DATE;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS prev_year_winner TEXT;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS prev_year_2nd TEXT;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS prev_year_3rd TEXT;
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE award_years ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create an updatable view called 'awards' that the JS code expects
CREATE OR REPLACE VIEW awards AS SELECT * FROM award_years;

-- Make the view insertable/updatable/deletable
CREATE OR REPLACE FUNCTION awards_insert_fn()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO award_years VALUES (NEW.*);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION awards_update_fn()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE award_years SET
    award_name = NEW.award_name,
    award_category = NEW.award_category,
    sector = NEW.sector,
    year = NEW.year,
    county = NEW.county,
    status = NEW.status,
    description = NEW.description,
    is_active = NEW.is_active,
    entry_open_date = NEW.entry_open_date,
    entry_close_date = NEW.entry_close_date,
    nominees_announcement_date = NEW.nominees_announcement_date,
    judging_open_date = NEW.judging_open_date,
    judging_close_date = NEW.judging_close_date,
    voting_open_date = NEW.voting_open_date,
    voting_close_date = NEW.voting_close_date,
    winners_announcement_date = NEW.winners_announcement_date,
    prev_year_winner = NEW.prev_year_winner,
    prev_year_2nd = NEW.prev_year_2nd,
    prev_year_3rd = NEW.prev_year_3rd,
    updated_at = NEW.updated_at
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION awards_delete_fn()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM award_years WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS awards_insert_trigger ON awards;
CREATE TRIGGER awards_insert_trigger
  INSTEAD OF INSERT ON awards
  FOR EACH ROW EXECUTE FUNCTION awards_insert_fn();

DROP TRIGGER IF EXISTS awards_update_trigger ON awards;
CREATE TRIGGER awards_update_trigger
  INSTEAD OF UPDATE ON awards
  FOR EACH ROW EXECUTE FUNCTION awards_update_fn();

DROP TRIGGER IF EXISTS awards_delete_trigger ON awards;
CREATE TRIGGER awards_delete_trigger
  INSTEAD OF DELETE ON awards
  FOR EACH ROW EXECUTE FUNCTION awards_delete_fn();


-- ============================================================
-- 2. ORGANISATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS organisations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  email TEXT,
  contact_phone TEXT,
  contact_name TEXT,
  logo_url TEXT,
  website TEXT,
  region TEXT,
  sector TEXT,
  annual_revenue NUMERIC,
  winner_profile_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to organisations" ON organisations;
CREATE POLICY "Allow all access to organisations"
  ON organisations FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 3. ORGANISATION CONTACTS
-- ============================================================

CREATE TABLE IF NOT EXISTS organisation_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE organisation_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to organisation_contacts" ON organisation_contacts;
CREATE POLICY "Allow all access to organisation_contacts"
  ON organisation_contacts FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 4. AWARD ASSIGNMENTS (nominees, shortlisted, winners per award)
-- ============================================================

CREATE TABLE IF NOT EXISTS award_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  award_id UUID,
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'nominated',
  winner_position INTEGER,
  assigned_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE award_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to award_assignments" ON award_assignments;
CREATE POLICY "Allow all access to award_assignments"
  ON award_assignments FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 5. WINNERS
-- ============================================================

CREATE TABLE IF NOT EXISTS winners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  winner_name TEXT,
  award_id UUID,
  organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  year INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE winners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to winners" ON winners;
CREATE POLICY "Allow all access to winners"
  ON winners FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 6. ENTRIES (competition submissions)
-- ============================================================

CREATE TABLE IF NOT EXISTS entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_number TEXT,
  entry_title TEXT,
  entry_description TEXT,
  award_id UUID,
  organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft',
  contact_name TEXT,
  contact_email TEXT,
  submission_date TIMESTAMPTZ,
  payment_status TEXT DEFAULT 'pending',
  payment_reference TEXT,
  certificate_url TEXT,
  admin_notes TEXT,
  is_shortlisted BOOLEAN DEFAULT FALSE,
  shortlisted_date TIMESTAMPTZ,
  is_public BOOLEAN DEFAULT FALSE,
  allow_public_voting BOOLEAN DEFAULT FALSE,
  public_votes INTEGER DEFAULT 0,
  vote_count INTEGER DEFAULT 0,
  average_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to entries" ON entries;
CREATE POLICY "Allow all access to entries"
  ON entries FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 7. ENTRY FILES
-- ============================================================

CREATE TABLE IF NOT EXISTS entry_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID REFERENCES entries(id) ON DELETE CASCADE,
  file_name TEXT,
  file_url TEXT,
  file_size INTEGER,
  upload_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE entry_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to entry_files" ON entry_files;
CREATE POLICY "Allow all access to entry_files"
  ON entry_files FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 8. EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_date DATE,
  year INTEGER,
  venue TEXT,
  description TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to events" ON events;
CREATE POLICY "Allow all access to events"
  ON events FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 9. EVENT TEMPLATES
-- ============================================================

CREATE TABLE IF NOT EXISTS event_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  description TEXT,
  template_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE event_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to event_templates" ON event_templates;
CREATE POLICY "Allow all access to event_templates"
  ON event_templates FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 10. EVENT ATTENDEES
-- ============================================================

CREATE TABLE IF NOT EXISTS event_attendees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  attendee_name TEXT,
  attendee_email TEXT,
  organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  table_number INTEGER,
  meal_preference TEXT,
  qr_code_url TEXT,
  rsvp_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to event_attendees" ON event_attendees;
CREATE POLICY "Allow all access to event_attendees"
  ON event_attendees FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 11. EVENT TABLES (seating)
-- ============================================================

CREATE TABLE IF NOT EXISTS event_tables (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  table_number INTEGER,
  capacity INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE event_tables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to event_tables" ON event_tables;
CREATE POLICY "Allow all access to event_tables"
  ON event_tables FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 12. TABLE ASSIGNMENTS (guest seating)
-- ============================================================

CREATE TABLE IF NOT EXISTS table_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  table_id UUID REFERENCES event_tables(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES event_attendees(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE table_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to table_assignments" ON table_assignments;
CREATE POLICY "Allow all access to table_assignments"
  ON table_assignments FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 13. EVENT GALLERIES
-- ============================================================

CREATE TABLE IF NOT EXISTS event_galleries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  gallery_name TEXT,
  gallery_description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE event_galleries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to event_galleries" ON event_galleries;
CREATE POLICY "Allow all access to event_galleries"
  ON event_galleries FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 14. RUNNING ORDER
-- ============================================================

CREATE TABLE IF NOT EXISTS running_order (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  item_name TEXT,
  start_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE running_order ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to running_order" ON running_order;
CREATE POLICY "Allow all access to running_order"
  ON running_order FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 15. RUNNING ORDER SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS running_order_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  settings JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE running_order_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to running_order_settings" ON running_order_settings;
CREATE POLICY "Allow all access to running_order_settings"
  ON running_order_settings FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 16. MEDIA GALLERY
-- ============================================================

CREATE TABLE IF NOT EXISTS media_gallery (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  file_type TEXT,
  file_url TEXT,
  video_type TEXT,
  organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  award_id UUID,
  published BOOLEAN DEFAULT FALSE,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE media_gallery ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to media_gallery" ON media_gallery;
CREATE POLICY "Allow all access to media_gallery"
  ON media_gallery FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 17. GALLERY SECTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS gallery_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE gallery_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to gallery_sections" ON gallery_sections;
CREATE POLICY "Allow all access to gallery_sections"
  ON gallery_sections FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 18. MEDIA ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS media_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  media_type TEXT,
  title TEXT,
  description TEXT,
  file_url TEXT,
  organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  award_id UUID,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  published BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE media_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to media_items" ON media_items;
CREATE POLICY "Allow all access to media_items"
  ON media_items FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 19. WINNER MEDIA
-- ============================================================

CREATE TABLE IF NOT EXISTS winner_media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  winner_id UUID REFERENCES winners(id) ON DELETE CASCADE,
  media_type TEXT,
  file_url TEXT,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE winner_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to winner_media" ON winner_media;
CREATE POLICY "Allow all access to winner_media"
  ON winner_media FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 20. ORGANISATION IMAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS organisation_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  image_url TEXT,
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE organisation_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to organisation_images" ON organisation_images;
CREATE POLICY "Allow all access to organisation_images"
  ON organisation_images FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 21. JUDGE SCORES
-- ============================================================

CREATE TABLE IF NOT EXISTS judge_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID REFERENCES entries(id) ON DELETE CASCADE,
  judge_email TEXT,
  judge_name TEXT,
  is_complete BOOLEAN DEFAULT FALSE,
  has_conflict BOOLEAN DEFAULT FALSE,
  conflict_declared BOOLEAN DEFAULT FALSE,
  total_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE judge_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to judge_scores" ON judge_scores;
CREATE POLICY "Allow all access to judge_scores"
  ON judge_scores FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 22. USER ROLES
-- ============================================================

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE,
  role TEXT DEFAULT 'editor',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to user_roles" ON user_roles;
CREATE POLICY "Allow all access to user_roles"
  ON user_roles FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 23. PUBLIC VOTES
-- ============================================================

CREATE TABLE IF NOT EXISTS public_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID REFERENCES entries(id) ON DELETE CASCADE,
  voter_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to public_votes" ON public_votes;
CREATE POLICY "Allow all access to public_votes"
  ON public_votes FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 24. INVOICES
-- ============================================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  invoice_number TEXT,
  invoice_type TEXT DEFAULT 'entry_fee',
  status TEXT DEFAULT 'draft',
  payment_status TEXT DEFAULT 'pending',
  invoice_date DATE,
  due_date DATE,
  total_amount NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  balance_due NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'GBP',
  payment_method TEXT,
  payment_reference TEXT,
  paid_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to invoices" ON invoices;
CREATE POLICY "Allow all access to invoices"
  ON invoices FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 25. INVOICE LINE ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to invoice_line_items" ON invoice_line_items;
CREATE POLICY "Allow all access to invoice_line_items"
  ON invoice_line_items FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 26. PAYMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  amount NUMERIC,
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  payment_method TEXT,
  payment_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to payments" ON payments;
CREATE POLICY "Allow all access to payments"
  ON payments FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 27. EMAIL TEMPLATES
-- ============================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  subject TEXT,
  body TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  last_modified_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to email_templates" ON email_templates;
CREATE POLICY "Allow all access to email_templates"
  ON email_templates FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 28. EMAIL LISTS
-- ============================================================

CREATE TABLE IF NOT EXISTS email_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  list_name TEXT,
  list_type TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  color TEXT,
  icon TEXT,
  avg_open_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_lists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to email_lists" ON email_lists;
CREATE POLICY "Allow all access to email_lists"
  ON email_lists FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 29. EMAIL LIST SUBSCRIBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS email_list_subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID REFERENCES email_lists(id) ON DELETE CASCADE,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  status TEXT DEFAULT 'active',
  emails_opened INTEGER DEFAULT 0,
  emails_received INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_list_subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to email_list_subscribers" ON email_list_subscribers;
CREATE POLICY "Allow all access to email_list_subscribers"
  ON email_list_subscribers FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 30. EMAIL LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS email_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_email TEXT,
  subject TEXT,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to email_log" ON email_log;
CREATE POLICY "Allow all access to email_log"
  ON email_log FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 31. EMAIL IMPORT BATCHES
-- ============================================================

CREATE TABLE IF NOT EXISTS email_import_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT,
  total_records INTEGER DEFAULT 0,
  imported INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_import_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to email_import_batches" ON email_import_batches;
CREATE POLICY "Allow all access to email_import_batches"
  ON email_import_batches FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 32. COMMUNICATIONS (CRM)
-- ============================================================

CREATE TABLE IF NOT EXISTS communications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES organisation_contacts(id) ON DELETE SET NULL,
  type TEXT DEFAULT 'email',
  direction TEXT DEFAULT 'outbound',
  subject TEXT,
  message TEXT,
  regarding TEXT,
  communication_date TIMESTAMPTZ DEFAULT NOW(),
  follow_up_required BOOLEAN DEFAULT FALSE,
  follow_up_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to communications" ON communications;
CREATE POLICY "Allow all access to communications"
  ON communications FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 33. SOCIAL MEDIA POSTS
-- ============================================================

CREATE TABLE IF NOT EXISTS social_media_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  award_id UUID,
  content TEXT,
  template_type TEXT,
  platforms TEXT[],
  status TEXT DEFAULT 'draft',
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE social_media_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to social_media_posts" ON social_media_posts;
CREATE POLICY "Allow all access to social_media_posts"
  ON social_media_posts FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 34. BANNERS
-- ============================================================

CREATE TABLE IF NOT EXISTS banners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  image_url TEXT,
  link_url TEXT,
  position TEXT,
  width INTEGER,
  height INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  start_date DATE,
  end_date DATE,
  display_order INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to banners" ON banners;
CREATE POLICY "Allow all access to banners"
  ON banners FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 35. SPONSORS
-- ============================================================

CREATE TABLE IF NOT EXISTS sponsors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  logo_url TEXT,
  website TEXT,
  tier TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to sponsors" ON sponsors;
CREATE POLICY "Allow all access to sponsors"
  ON sponsors FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 36. AI VETTING RUNS
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_vetting_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  total_companies INTEGER DEFAULT 0,
  companies_vetted INTEGER DEFAULT 0,
  companies_flagged INTEGER DEFAULT 0,
  status TEXT DEFAULT 'running',
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_vetting_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to ai_vetting_runs" ON ai_vetting_runs;
CREATE POLICY "Allow all access to ai_vetting_runs"
  ON ai_vetting_runs FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 37. AI VETTING RESULTS
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_vetting_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'verified',
  vetting_date TIMESTAMPTZ DEFAULT NOW(),
  dismissed BOOLEAN DEFAULT FALSE,
  is_operational BOOLEAN,
  category_match BOOLEAN,
  reputation_score INTEGER,
  confidence_score NUMERIC,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_vetting_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to ai_vetting_results" ON ai_vetting_results;
CREATE POLICY "Allow all access to ai_vetting_results"
  ON ai_vetting_results FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 38. ACTIVITY LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT,
  entity_id UUID,
  action TEXT,
  details TEXT,
  performed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to activity_logs" ON activity_logs;
CREATE POLICY "Allow all access to activity_logs"
  ON activity_logs FOR ALL USING (true) WITH CHECK (true);

-- Also create activity_log alias if the code uses both names
CREATE OR REPLACE VIEW activity_log AS SELECT * FROM activity_logs;


-- ============================================================
-- 39. COUNTIES (lookup)
-- ============================================================

CREATE TABLE IF NOT EXISTS counties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "Name" TEXT,
  region TEXT,
  region_id UUID
);

ALTER TABLE counties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to counties" ON counties;
CREATE POLICY "Allow all access to counties"
  ON counties FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 40. CONTACTS (CRM directory)
-- ============================================================

CREATE TABLE IF NOT EXISTS contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to contacts" ON contacts;
CREATE POLICY "Allow all access to contacts"
  ON contacts FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 41. DEALS (sales pipeline)
-- ============================================================

CREATE TABLE IF NOT EXISTS deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  title TEXT,
  value NUMERIC,
  stage TEXT DEFAULT 'lead',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to deals" ON deals;
CREATE POLICY "Allow all access to deals"
  ON deals FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 42. PAYMENT REMINDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  reminder_date TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to payment_reminders" ON payment_reminders;
CREATE POLICY "Allow all access to payment_reminders"
  ON payment_reminders FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 43. EVENT GUESTS
-- ============================================================

CREATE TABLE IF NOT EXISTS event_guests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  rsvp_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE event_guests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to event_guests" ON event_guests;
CREATE POLICY "Allow all access to event_guests"
  ON event_guests FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 44. SOCIAL CAMPAIGNS
-- ============================================================

CREATE TABLE IF NOT EXISTS social_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE social_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to social_campaigns" ON social_campaigns;
CREATE POLICY "Allow all access to social_campaigns"
  ON social_campaigns FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 45. AWARD SEASONS
-- ============================================================

CREATE TABLE IF NOT EXISTS award_seasons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'open', 'closed')),
  entry_open_date DATE,
  entry_close_date DATE,
  nominees_announcement_date DATE,
  judging_open_date DATE,
  judging_close_date DATE,
  voting_open_date DATE,
  voting_close_date DATE,
  winners_announcement_date DATE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE award_seasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to award_seasons" ON award_seasons;
CREATE POLICY "Allow all access to award_seasons"
  ON award_seasons FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- GRANT API ACCESS TO ALL TABLES
-- Required for Supabase PostgREST to expose tables via the API.
-- Without these, tables created via SQL Editor will return
-- "Could not find the table in the schema cache".
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'award_years', 'award_seasons', 'organisations', 'organisation_contacts',
      'award_assignments', 'winners', 'entries', 'entry_files',
      'events', 'event_templates', 'event_attendees', 'event_tables',
      'table_assignments', 'event_galleries', 'running_order', 'running_order_settings',
      'media_gallery', 'gallery_sections', 'media_items', 'winner_media',
      'organisation_images', 'judge_scores', 'user_roles', 'public_votes',
      'invoices', 'invoice_line_items', 'payments', 'email_templates',
      'email_lists', 'email_list_subscribers', 'email_log', 'email_import_batches',
      'communications', 'social_media_posts', 'banners', 'sponsors',
      'ai_vetting_runs', 'ai_vetting_results', 'activity_logs', 'counties',
      'contacts', 'deals', 'payment_reminders', 'event_guests', 'social_campaigns'
    ])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('GRANT ALL ON public.%I TO anon', tbl);
      EXECUTE format('GRANT ALL ON public.%I TO authenticated', tbl);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl);
    END IF;
  END LOOP;
END $$;

-- Grant access to views
GRANT ALL ON public.awards TO anon;
GRANT ALL ON public.awards TO authenticated;
GRANT ALL ON public.awards TO service_role;
GRANT ALL ON public.activity_log TO anon;
GRANT ALL ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';


-- ============================================================
-- DONE! Your database is now fully set up.
-- Refresh your browser to start using the CMS.
-- ============================================================
