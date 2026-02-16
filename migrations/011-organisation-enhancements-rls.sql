-- ============================================================
-- Migration 011: Organisation enhancements — tables, RLS, constraints
-- ============================================================
-- Rolls database-organisations-enhancements.sql into the numbered
-- migration sequence. Ensures all 7 enhancement tables exist, have
-- RLS policies, indexes, and GRANTs. Also adds a UNIQUE constraint
-- on email_lists(list_name) so the seed INSERT ... ON CONFLICT in
-- migration 008 works correctly.
-- ============================================================

-- ============================================
-- 1. Organisation Custom Fields
-- ============================================
CREATE TABLE IF NOT EXISTS organisation_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  field_name VARCHAR(255) NOT NULL,
  field_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organisation_id, field_name)
);
CREATE INDEX IF NOT EXISTS idx_org_custom_fields_org ON organisation_custom_fields(organisation_id);

ALTER TABLE organisation_custom_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to organisation_custom_fields" ON organisation_custom_fields;
CREATE POLICY "Allow all access to organisation_custom_fields"
  ON organisation_custom_fields FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.organisation_custom_fields TO anon;
GRANT ALL ON public.organisation_custom_fields TO authenticated;
GRANT ALL ON public.organisation_custom_fields TO service_role;

-- ============================================
-- 2. Organisation Follow-ups
-- ============================================
CREATE TABLE IF NOT EXISTS organisation_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  company_name VARCHAR(255),
  follow_up_date DATE NOT NULL,
  note TEXT,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_org_follow_ups_org ON organisation_follow_ups(organisation_id);
CREATE INDEX IF NOT EXISTS idx_org_follow_ups_date ON organisation_follow_ups(follow_up_date);

ALTER TABLE organisation_follow_ups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to organisation_follow_ups" ON organisation_follow_ups;
CREATE POLICY "Allow all access to organisation_follow_ups"
  ON organisation_follow_ups FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.organisation_follow_ups TO anon;
GRANT ALL ON public.organisation_follow_ups TO authenticated;
GRANT ALL ON public.organisation_follow_ups TO service_role;

-- ============================================
-- 3. Organisation Documents
-- ============================================
CREATE TABLE IF NOT EXISTS organisation_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  title VARCHAR(255),
  file_type VARCHAR(100),
  file_size INTEGER,
  uploaded_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_org_documents_org ON organisation_documents(organisation_id);

ALTER TABLE organisation_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to organisation_documents" ON organisation_documents;
CREATE POLICY "Allow all access to organisation_documents"
  ON organisation_documents FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.organisation_documents TO anon;
GRANT ALL ON public.organisation_documents TO authenticated;
GRANT ALL ON public.organisation_documents TO service_role;

-- ============================================
-- 4. Organisation Notes (threaded/pinnable)
-- ============================================
CREATE TABLE IF NOT EXISTS organisation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  author VARCHAR(255),
  content TEXT NOT NULL,
  pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_org_notes_org ON organisation_notes(organisation_id);

ALTER TABLE organisation_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to organisation_notes" ON organisation_notes;
CREATE POLICY "Allow all access to organisation_notes"
  ON organisation_notes FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.organisation_notes TO anon;
GRANT ALL ON public.organisation_notes TO authenticated;
GRANT ALL ON public.organisation_notes TO service_role;

-- ============================================
-- 5. Organisation Relationships
-- ============================================
CREATE TABLE IF NOT EXISTS organisation_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  related_organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL DEFAULT 'related',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organisation_id, related_organisation_id)
);
CREATE INDEX IF NOT EXISTS idx_org_relationships_org ON organisation_relationships(organisation_id);
CREATE INDEX IF NOT EXISTS idx_org_relationships_related ON organisation_relationships(related_organisation_id);

ALTER TABLE organisation_relationships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to organisation_relationships" ON organisation_relationships;
CREATE POLICY "Allow all access to organisation_relationships"
  ON organisation_relationships FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.organisation_relationships TO anon;
GRANT ALL ON public.organisation_relationships TO authenticated;
GRANT ALL ON public.organisation_relationships TO service_role;

-- ============================================
-- 6. Sponsorship Packages
-- ============================================
CREATE TABLE IF NOT EXISTS sponsorship_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  package_name VARCHAR(100) NOT NULL,
  tier VARCHAR(50),
  amount DECIMAL(12,2),
  currency VARCHAR(3) DEFAULT 'GBP',
  start_date DATE,
  end_date DATE,
  renewal_date DATE,
  status VARCHAR(50) DEFAULT 'active',
  benefits JSONB DEFAULT '[]',
  deliverables JSONB DEFAULT '[]',
  payment_schedule VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sponsorship_packages_org ON sponsorship_packages(organisation_id);

ALTER TABLE sponsorship_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to sponsorship_packages" ON sponsorship_packages;
CREATE POLICY "Allow all access to sponsorship_packages"
  ON sponsorship_packages FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.sponsorship_packages TO anon;
GRANT ALL ON public.sponsorship_packages TO authenticated;
GRANT ALL ON public.sponsorship_packages TO service_role;

-- ============================================
-- 7. Organisation Comms Log (ensure RLS — table created in 009)
-- ============================================
-- Table already created in migration 009; just ensure RLS is present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organisation_comms_log') THEN
    EXECUTE 'ALTER TABLE organisation_comms_log ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- ============================================
-- 8. UNIQUE constraint on email_lists(list_name)
-- ============================================
-- Migration 008 uses INSERT ... ON CONFLICT DO NOTHING to seed default
-- lists, but that only works when a UNIQUE/exclusion constraint exists.
-- Without it, duplicates get inserted on every re-run.
-- First deduplicate any existing rows, keeping the oldest per list_name.
DELETE FROM email_lists
WHERE id NOT IN (
  SELECT DISTINCT ON (list_name) id
  FROM email_lists
  ORDER BY list_name, created_at ASC
);

-- Now add the constraint (safe — duplicates removed above)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'email_lists'
      AND constraint_name = 'email_lists_list_name_unique'
  ) THEN
    ALTER TABLE email_lists
      ADD CONSTRAINT email_lists_list_name_unique UNIQUE (list_name);
  END IF;
END $$;

-- ============================================
-- 9. Refresh PostgREST schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';
