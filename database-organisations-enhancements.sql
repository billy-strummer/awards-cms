-- ==================================================
-- ORGANISATIONS ENHANCEMENTS MIGRATION
-- Adds tables for: custom fields, follow-ups, documents,
-- threaded notes, relationships, sponsorship packages,
-- and ensures org_audit_log exists
-- ==================================================

-- 1. Organisation Custom Fields (migrate from localStorage)
CREATE TABLE IF NOT EXISTS organisation_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  field_name VARCHAR(255) NOT NULL,
  field_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organisation_id, field_name)
);
CREATE INDEX IF NOT EXISTS idx_org_custom_fields_org ON organisation_custom_fields(organisation_id);

-- 2. Organisation Follow-ups (migrate from localStorage)
CREATE TABLE IF NOT EXISTS organisation_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  company_name VARCHAR(255),
  follow_up_date DATE NOT NULL,
  note TEXT,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_org_follow_ups_org ON organisation_follow_ups(organisation_id);
CREATE INDEX IF NOT EXISTS idx_org_follow_ups_date ON organisation_follow_ups(follow_up_date);

-- 3. Organisation Documents (ensure table exists for localStorage migration)
CREATE TABLE IF NOT EXISTS organisation_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  title VARCHAR(255),
  file_type VARCHAR(100),
  file_size INTEGER,
  uploaded_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_org_documents_org ON organisation_documents(organisation_id);

-- 4. Org Audit Log (ensure table exists for localStorage migration)
CREATE TABLE IF NOT EXISTS org_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  company_name VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  details TEXT,
  user_email VARCHAR(255),
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_org_audit_log_org ON org_audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_org_audit_log_created ON org_audit_log(created_at DESC);

-- 5. Organisation Threaded Notes / Comments
CREATE TABLE IF NOT EXISTS organisation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  author VARCHAR(255),
  content TEXT NOT NULL,
  pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_org_notes_org ON organisation_notes(organisation_id);

-- 6. Organisation Relationships (parent/subsidiary, co-sponsor, etc.)
CREATE TABLE IF NOT EXISTS organisation_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  related_organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL DEFAULT 'related',
  -- Types: 'parent', 'subsidiary', 'co_sponsor', 'partner', 'franchise', 'related'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organisation_id, related_organisation_id)
);
CREATE INDEX IF NOT EXISTS idx_org_relationships_org ON organisation_relationships(organisation_id);
CREATE INDEX IF NOT EXISTS idx_org_relationships_related ON organisation_relationships(related_organisation_id);

-- 7. Sponsorship Packages
CREATE TABLE IF NOT EXISTS sponsorship_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  package_name VARCHAR(100) NOT NULL,
  tier VARCHAR(50), -- Bronze, Silver, Gold, Platinum, Custom
  amount DECIMAL(12,2),
  currency VARCHAR(3) DEFAULT 'GBP',
  start_date DATE,
  end_date DATE,
  renewal_date DATE,
  status VARCHAR(50) DEFAULT 'active', -- active, expired, pending, cancelled
  benefits JSONB DEFAULT '[]',
  deliverables JSONB DEFAULT '[]',
  payment_schedule VARCHAR(50), -- one_time, monthly, quarterly, annual
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sponsorship_packages_org ON sponsorship_packages(organisation_id);

-- 8. Communications log (ensure exists)
CREATE TABLE IF NOT EXISTS organisation_comms_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  template_id VARCHAR(100),
  template_name VARCHAR(255),
  subject VARCHAR(500),
  message TEXT,
  direction VARCHAR(20) DEFAULT 'outbound', -- outbound, inbound
  channel VARCHAR(50) DEFAULT 'email', -- email, sms, whatsapp, phone, meeting
  sent_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_org_comms_log_org ON organisation_comms_log(organisation_id);

-- PostgREST permissions
GRANT ALL ON public.organisation_custom_fields TO anon;
GRANT ALL ON public.organisation_custom_fields TO authenticated;
GRANT ALL ON public.organisation_custom_fields TO service_role;

GRANT ALL ON public.organisation_follow_ups TO anon;
GRANT ALL ON public.organisation_follow_ups TO authenticated;
GRANT ALL ON public.organisation_follow_ups TO service_role;

GRANT ALL ON public.organisation_documents TO anon;
GRANT ALL ON public.organisation_documents TO authenticated;
GRANT ALL ON public.organisation_documents TO service_role;

GRANT ALL ON public.org_audit_log TO anon;
GRANT ALL ON public.org_audit_log TO authenticated;
GRANT ALL ON public.org_audit_log TO service_role;

GRANT ALL ON public.organisation_notes TO anon;
GRANT ALL ON public.organisation_notes TO authenticated;
GRANT ALL ON public.organisation_notes TO service_role;

GRANT ALL ON public.organisation_relationships TO anon;
GRANT ALL ON public.organisation_relationships TO authenticated;
GRANT ALL ON public.organisation_relationships TO service_role;

GRANT ALL ON public.sponsorship_packages TO anon;
GRANT ALL ON public.sponsorship_packages TO authenticated;
GRANT ALL ON public.sponsorship_packages TO service_role;

GRANT ALL ON public.organisation_comms_log TO anon;
GRANT ALL ON public.organisation_comms_log TO authenticated;
GRANT ALL ON public.organisation_comms_log TO service_role;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
