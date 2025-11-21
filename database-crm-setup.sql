-- ============================================
-- CRM SYSTEM FOR AWARDS COMPANY
-- Customer Relationship Management
-- ============================================

-- ============================================
-- COMMUNICATIONS LOG
-- ============================================
CREATE TABLE IF NOT EXISTS communications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relationships
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES organisation_contacts(id) ON DELETE SET NULL,
  user_id VARCHAR(255), -- CMS user who made the communication

  -- Communication Details
  type VARCHAR(50) NOT NULL, -- 'email', 'phone', 'meeting', 'note', 'text', 'linkedin'
  direction VARCHAR(20) NOT NULL, -- 'inbound', 'outbound'
  subject VARCHAR(500),
  message TEXT NOT NULL,

  -- Context
  regarding VARCHAR(100), -- 'sponsorship', 'award_application', 'event_ticket', 'follow_up', 'renewal', 'general'
  related_deal_id UUID, -- Link to deal pipeline
  related_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  related_event_id UUID REFERENCES events(id) ON DELETE SET NULL,

  -- Tracking
  communication_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_date DATE,
  completed BOOLEAN DEFAULT true,

  -- Attachments
  attachments TEXT, -- JSON array of attachment URLs

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DEAL PIPELINE
-- ============================================
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relationships
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES organisation_contacts(id) ON DELETE SET NULL,

  -- Deal Details
  deal_name VARCHAR(255) NOT NULL,
  deal_type VARCHAR(50) NOT NULL, -- 'sponsorship', 'award_fee', 'event_tickets', 'partnership', 'package_upgrade', 'other'
  description TEXT,

  -- Pipeline Stage
  stage VARCHAR(50) NOT NULL DEFAULT 'lead', -- 'lead', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'
  probability INTEGER DEFAULT 50, -- % chance of closing (0-100)

  -- Financial
  deal_value DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'GBP',

  -- Dates
  expected_close_date DATE,
  actual_close_date DATE,

  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'won', 'lost', 'on_hold', 'cancelled'
  lost_reason TEXT,

  -- Assignment
  assigned_to VARCHAR(255), -- Sales person / account manager

  -- Related Records
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MEETING NOTES
-- ============================================
CREATE TABLE IF NOT EXISTS meeting_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relationships
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,

  -- Meeting Details
  meeting_title VARCHAR(255) NOT NULL,
  meeting_date TIMESTAMPTZ NOT NULL,
  meeting_type VARCHAR(50), -- 'in_person', 'video_call', 'phone', 'conference'
  duration_minutes INTEGER,
  location VARCHAR(255),

  -- Attendees
  attendees TEXT, -- JSON array of attendee names/emails
  internal_attendees TEXT, -- JSON array of internal team members

  -- Content
  agenda TEXT,
  notes TEXT NOT NULL,
  action_items TEXT, -- JSON array of action items

  -- Follow-up
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_date DATE,

  -- Recording/Attachments
  recording_url TEXT,
  attachments TEXT, -- JSON array of attachment URLs

  -- Metadata
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONTACT SEGMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS contact_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Segment Details
  segment_name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  color VARCHAR(7), -- Hex color code for UI
  icon VARCHAR(50), -- Bootstrap icon class

  -- Auto-assignment Rules
  auto_assign_rules TEXT, -- JSON rules for automatic assignment

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORGANISATION SEGMENT ASSIGNMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS organisation_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES contact_segments(id) ON DELETE CASCADE,

  -- Assignment Details
  assigned_date TIMESTAMPTZ DEFAULT NOW(),
  assigned_by VARCHAR(255),
  notes TEXT,

  -- Unique constraint - org can only be in each segment once
  UNIQUE(organisation_id, segment_id)
);

-- ============================================
-- SPONSORSHIP OPPORTUNITIES
-- ============================================
CREATE TABLE IF NOT EXISTS sponsorship_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Opportunity Details
  opportunity_name VARCHAR(255) NOT NULL,
  description TEXT,
  tier VARCHAR(50), -- 'platinum', 'gold', 'silver', 'bronze'

  -- Financial
  value DECIMAL(10,2) NOT NULL,
  benefits TEXT, -- JSON array of benefits included

  -- Availability
  total_slots INTEGER DEFAULT 1,
  available_slots INTEGER DEFAULT 1,

  -- Event/Award Connection
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  award_id UUID REFERENCES awards(id) ON DELETE SET NULL,

  -- Status
  is_active BOOLEAN DEFAULT true,
  valid_from DATE,
  valid_until DATE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_communications_org ON communications(organisation_id);
CREATE INDEX IF NOT EXISTS idx_communications_contact ON communications(contact_id);
CREATE INDEX IF NOT EXISTS idx_communications_type ON communications(type);
CREATE INDEX IF NOT EXISTS idx_communications_date ON communications(communication_date);
CREATE INDEX IF NOT EXISTS idx_communications_follow_up ON communications(follow_up_required, follow_up_date);

CREATE INDEX IF NOT EXISTS idx_deals_org ON deals(organisation_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_close_date ON deals(expected_close_date);
CREATE INDEX IF NOT EXISTS idx_deals_type ON deals(deal_type);

CREATE INDEX IF NOT EXISTS idx_meeting_notes_org ON meeting_notes(organisation_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_deal ON meeting_notes(deal_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_date ON meeting_notes(meeting_date);

CREATE INDEX IF NOT EXISTS idx_org_segments_org ON organisation_segments(organisation_id);
CREATE INDEX IF NOT EXISTS idx_org_segments_segment ON organisation_segments(segment_id);

CREATE INDEX IF NOT EXISTS idx_sponsorship_opps_event ON sponsorship_opportunities(event_id);
CREATE INDEX IF NOT EXISTS idx_sponsorship_opps_active ON sponsorship_opportunities(is_active);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================
DROP TRIGGER IF EXISTS update_communications_updated_at ON communications;
CREATE TRIGGER update_communications_updated_at
  BEFORE UPDATE ON communications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deals_updated_at ON deals;
CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_meeting_notes_updated_at ON meeting_notes;
CREATE TRIGGER update_meeting_notes_updated_at
  BEFORE UPDATE ON meeting_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contact_segments_updated_at ON contact_segments;
CREATE TRIGGER update_contact_segments_updated_at
  BEFORE UPDATE ON contact_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sponsorship_opportunities_updated_at ON sponsorship_opportunities;
CREATE TRIGGER update_sponsorship_opportunities_updated_at
  BEFORE UPDATE ON sponsorship_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INSERT DEFAULT SEGMENTS
-- ============================================
INSERT INTO contact_segments (segment_name, description, color, icon) VALUES
  ('Past Winners', 'Companies that have won awards previously', '#28a745', 'trophy-fill'),
  ('Current Nominees', 'Companies nominated for current awards cycle', '#ffc107', 'star'),
  ('Sponsors', 'Companies providing sponsorship', '#0d6efd', 'award'),
  ('VIP Contacts', 'High-value or important contacts', '#dc3545', 'star-fill'),
  ('Industry Leaders', 'Leading companies in their sectors', '#17a2b8', 'building'),
  ('Renewal Prospects', 'Past participants eligible for renewal', '#6c757d', 'arrow-repeat')
ON CONFLICT (segment_name) DO NOTHING;

-- ============================================
-- VIEWS FOR REPORTING
-- ============================================

-- View: Organisation with CRM summary
CREATE OR REPLACE VIEW organisations_with_crm_summary AS
SELECT
  o.*,
  COUNT(DISTINCT c.id) as communication_count,
  COUNT(DISTINCT d.id) as deal_count,
  COUNT(DISTINCT CASE WHEN d.status = 'active' THEN d.id END) as active_deals,
  SUM(CASE WHEN d.status = 'active' THEN d.deal_value ELSE 0 END) as pipeline_value,
  COUNT(DISTINCT m.id) as meeting_count,
  STRING_AGG(DISTINCT cs.segment_name, ', ') as segments,
  MAX(c.communication_date) as last_communication_date,
  COUNT(DISTINCT CASE WHEN c.follow_up_required = true AND c.follow_up_date >= CURRENT_DATE THEN c.id END) as pending_follow_ups
FROM organisations o
LEFT JOIN communications c ON o.id = c.organisation_id
LEFT JOIN deals d ON o.id = d.organisation_id
LEFT JOIN meeting_notes m ON o.id = m.organisation_id
LEFT JOIN organisation_segments os ON o.id = os.organisation_id
LEFT JOIN contact_segments cs ON os.segment_id = cs.id
GROUP BY o.id;

-- View: Deal pipeline summary
CREATE OR REPLACE VIEW deal_pipeline_summary AS
SELECT
  stage,
  COUNT(*) as deal_count,
  SUM(deal_value) as total_value,
  AVG(deal_value) as avg_value,
  AVG(probability) as avg_probability,
  STRING_AGG(DISTINCT deal_type, ', ') as deal_types
FROM deals
WHERE status = 'active'
GROUP BY stage;

-- View: Communication activity by type
CREATE OR REPLACE VIEW communication_activity AS
SELECT
  type,
  direction,
  COUNT(*) as count,
  DATE_TRUNC('month', communication_date) as month,
  COUNT(DISTINCT organisation_id) as unique_organisations
FROM communications
GROUP BY type, direction, DATE_TRUNC('month', communication_date);

-- View: Upcoming follow-ups
CREATE OR REPLACE VIEW upcoming_follow_ups AS
SELECT
  c.*,
  o.company_name,
  oc.first_name || ' ' || oc.last_name as contact_name,
  oc.email as contact_email
FROM communications c
LEFT JOIN organisations o ON c.organisation_id = o.id
LEFT JOIN organisation_contacts oc ON c.contact_id = oc.id
WHERE c.follow_up_required = true
  AND c.follow_up_date >= CURRENT_DATE
  AND c.completed = false
ORDER BY c.follow_up_date ASC;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT
  'CRM System Installed Successfully!' as message,
  'Tables: communications, deals, meeting_notes, contact_segments, organisation_segments, sponsorship_opportunities' as tables_created,
  'Default segments created: Past Winners, Current Nominees, Sponsors, VIP Contacts, Industry Leaders, Renewal Prospects' as segments,
  'Views: organisations_with_crm_summary, deal_pipeline_summary, communication_activity, upcoming_follow_ups' as views_created;
