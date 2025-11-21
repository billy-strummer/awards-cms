-- ============================================
-- TEST DATA GENERATOR FOR AWARDS CMS
-- ============================================
-- Creates mock event with 30 winners for testing
-- All test data is tagged with 'TEST_MODE_' prefix
-- ============================================

-- 1. Create test event
INSERT INTO events (id, event_name, event_date, year, venue, description)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'TEST_MODE_2025 Awards Gala',
  '2025-12-15',
  2025,
  'Grand Test Ballroom',
  '[TEST MODE] This is a test event with mock winners for testing the CMS'
)
ON CONFLICT (id) DO UPDATE SET
  event_name = EXCLUDED.event_name,
  event_date = EXCLUDED.event_date;

-- 2. Create test awards (10 categories)
INSERT INTO awards (id, award_name, category, description, year, is_active)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'TEST_MODE_Best Innovation', 'Innovation', 'Excellence in innovation', 2025, true),
  ('10000000-0000-0000-0000-000000000002', 'TEST_MODE_Rising Star', 'Growth', 'Fast growing company', 2025, true),
  ('10000000-0000-0000-0000-000000000003', 'TEST_MODE_Export Excellence', 'International', 'Outstanding exports', 2025, true),
  ('10000000-0000-0000-0000-000000000004', 'TEST_MODE_Sustainability Leader', 'Environment', 'Green business practices', 2025, true),
  ('10000000-0000-0000-0000-000000000005', 'TEST_MODE_Digital Transformation', 'Technology', 'Digital innovation', 2025, true),
  ('10000000-0000-0000-0000-000000000006', 'TEST_MODE_Best Employer', 'People', 'Great workplace', 2025, true),
  ('10000000-0000-0000-0000-000000000007', 'TEST_MODE_Customer Excellence', 'Service', 'Outstanding customer service', 2025, true),
  ('10000000-0000-0000-0000-000000000008', 'TEST_MODE_Manufacturing Excellence', 'Manufacturing', 'Quality manufacturing', 2025, true),
  ('10000000-0000-0000-0000-000000000009', 'TEST_MODE_Social Impact', 'Community', 'Community contribution', 2025, true),
  ('10000000-0000-0000-0000-000000000010', 'TEST_MODE_Lifetime Achievement', 'Special', 'Career recognition', 2025, true)
ON CONFLICT (id) DO UPDATE SET
  award_name = EXCLUDED.award_name;

-- 3. Create 30 test organisations
INSERT INTO organisations (id, company_name, industry, website, logo_url, description)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'TEST_MODE_Acme Corporation', 'Technology', 'https://example.com', NULL, 'Leading tech innovator'),
  ('20000000-0000-0000-0000-000000000002', 'TEST_MODE_Global Dynamics Ltd', 'Manufacturing', 'https://example.com', NULL, 'International manufacturer'),
  ('20000000-0000-0000-0000-000000000003', 'TEST_MODE_TechStart Solutions', 'Software', 'https://example.com', NULL, 'Innovative software company'),
  ('20000000-0000-0000-0000-000000000004', 'TEST_MODE_Green Energy Co', 'Energy', 'https://example.com', NULL, 'Renewable energy provider'),
  ('20000000-0000-0000-0000-000000000005', 'TEST_MODE_Premier Consulting', 'Consulting', 'https://example.com', NULL, 'Business consultants'),
  ('20000000-0000-0000-0000-000000000006', 'TEST_MODE_Digital First Agency', 'Marketing', 'https://example.com', NULL, 'Digital marketing experts'),
  ('20000000-0000-0000-0000-000000000007', 'TEST_MODE_Swift Logistics', 'Transport', 'https://example.com', NULL, 'Logistics specialists'),
  ('20000000-0000-0000-0000-000000000008', 'TEST_MODE_HealthTech Innovations', 'Healthcare', 'https://example.com', NULL, 'Medical technology'),
  ('20000000-0000-0000-0000-000000000009', 'TEST_MODE_Financial Services Group', 'Finance', 'https://example.com', NULL, 'Financial services'),
  ('20000000-0000-0000-0000-000000000010', 'TEST_MODE_EduTech Platform', 'Education', 'https://example.com', NULL, 'Online learning platform'),
  ('20000000-0000-0000-0000-000000000011', 'TEST_MODE_Retail Revolution', 'Retail', 'https://example.com', NULL, 'Modern retail chain'),
  ('20000000-0000-0000-0000-000000000012', 'TEST_MODE_Construction Masters', 'Construction', 'https://example.com', NULL, 'Building excellence'),
  ('20000000-0000-0000-0000-000000000013', 'TEST_MODE_Food & Beverage Co', 'Food', 'https://example.com', NULL, 'Quality food products'),
  ('20000000-0000-0000-0000-000000000014', 'TEST_MODE_Creative Studios', 'Media', 'https://example.com', NULL, 'Creative agency'),
  ('20000000-0000-0000-0000-000000000015', 'TEST_MODE_Property Development Ltd', 'Real Estate', 'https://example.com', NULL, 'Property developers'),
  ('20000000-0000-0000-0000-000000000016', 'TEST_MODE_Automotive Innovations', 'Automotive', 'https://example.com', NULL, 'Car technology'),
  ('20000000-0000-0000-0000-000000000017', 'TEST_MODE_Legal Partners', 'Legal', 'https://example.com', NULL, 'Law firm'),
  ('20000000-0000-0000-0000-000000000018', 'TEST_MODE_Engineering Solutions', 'Engineering', 'https://example.com', NULL, 'Engineering firm'),
  ('20000000-0000-0000-0000-000000000019', 'TEST_MODE_Fashion Forward', 'Fashion', 'https://example.com', NULL, 'Fashion brand'),
  ('20000000-0000-0000-0000-000000000020', 'TEST_MODE_Sports Excellence', 'Sports', 'https://example.com', NULL, 'Sports company'),
  ('20000000-0000-0000-0000-000000000021', 'TEST_MODE_Travel & Tourism', 'Tourism', 'https://example.com', NULL, 'Travel agency'),
  ('20000000-0000-0000-0000-000000000022', 'TEST_MODE_Pharma Research', 'Pharmaceutical', 'https://example.com', NULL, 'Drug research'),
  ('20000000-0000-0000-0000-000000000023', 'TEST_MODE_Insurance Partners', 'Insurance', 'https://example.com', NULL, 'Insurance provider'),
  ('20000000-0000-0000-0000-000000000024', 'TEST_MODE_Telecom Services', 'Telecommunications', 'https://example.com', NULL, 'Telecom company'),
  ('20000000-0000-0000-0000-000000000025', 'TEST_MODE_Chemical Industries', 'Chemical', 'https://example.com', NULL, 'Chemical manufacturer'),
  ('20000000-0000-0000-0000-000000000026', 'TEST_MODE_Publishing House', 'Publishing', 'https://example.com', NULL, 'Book publisher'),
  ('20000000-0000-0000-0000-000000000027', 'TEST_MODE_Security Systems', 'Security', 'https://example.com', NULL, 'Security solutions'),
  ('20000000-0000-0000-0000-000000000028', 'TEST_MODE_Agriculture Tech', 'Agriculture', 'https://example.com', NULL, 'Farming technology'),
  ('20000000-0000-0000-0000-000000000029', 'TEST_MODE_Entertainment Group', 'Entertainment', 'https://example.com', NULL, 'Entertainment company'),
  ('20000000-0000-0000-0000-000000000030', 'TEST_MODE_Environmental Services', 'Environment', 'https://example.com', NULL, 'Environmental consulting')
ON CONFLICT (id) DO UPDATE SET
  company_name = EXCLUDED.company_name;

-- 4. Create award assignments (30 winners, 3 per award category)
INSERT INTO award_assignments (id, award_id, organisation_id, status, judge_score, assigned_date)
VALUES
  -- Best Innovation (3 winners)
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'winner', 9.5, NOW()),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'winner', 9.2, NOW()),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005', 'winner', 8.9, NOW()),

  -- Rising Star (3 winners)
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000007', 'winner', 9.3, NOW()),
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000010', 'winner', 9.0, NOW()),
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000011', 'winner', 8.8, NOW()),

  -- Export Excellence (3 winners)
  ('30000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'winner', 9.4, NOW()),
  ('30000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000013', 'winner', 9.1, NOW()),
  ('30000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000024', 'winner', 8.7, NOW()),

  -- Sustainability Leader (3 winners)
  ('30000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'winner', 9.6, NOW()),
  ('30000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000028', 'winner', 9.2, NOW()),
  ('30000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000030', 'winner', 8.9, NOW()),

  -- Digital Transformation (3 winners)
  ('30000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000006', 'winner', 9.3, NOW()),
  ('30000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000008', 'winner', 9.0, NOW()),
  ('30000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000014', 'winner', 8.8, NOW()),

  -- Best Employer (3 winners)
  ('30000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000009', 'winner', 9.4, NOW()),
  ('30000000-0000-0000-0000-000000000017', '10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000022', 'winner', 9.1, NOW()),
  ('30000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000026', 'winner', 8.9, NOW()),

  -- Customer Excellence (3 winners)
  ('30000000-0000-0000-0000-000000000019', '10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000021', 'winner', 9.5, NOW()),
  ('30000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000023', 'winner', 9.2, NOW()),
  ('30000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000025', 'winner', 8.8, NOW()),

  -- Manufacturing Excellence (3 winners)
  ('30000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000012', 'winner', 9.3, NOW()),
  ('30000000-0000-0000-0000-000000000023', '10000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000016', 'winner', 9.0, NOW()),
  ('30000000-0000-0000-0000-000000000024', '10000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000018', 'winner', 8.7, NOW()),

  -- Social Impact (3 winners)
  ('30000000-0000-0000-0000-000000000025', '10000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000015', 'winner', 9.4, NOW()),
  ('30000000-0000-0000-0000-000000000026', '10000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000020', 'winner', 9.1, NOW()),
  ('30000000-0000-0000-0000-000000000027', '10000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000029', 'winner', 8.9, NOW()),

  -- Lifetime Achievement (3 winners)
  ('30000000-0000-0000-0000-000000000028', '10000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000017', 'winner', 9.6, NOW()),
  ('30000000-0000-0000-0000-000000000029', '10000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000019', 'winner', 9.5, NOW()),
  ('30000000-0000-0000-0000-000000000030', '10000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000027', 'winner', 9.3, NOW())
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status;

-- 5. Create event guests (RSVPs) for all 30 winners
INSERT INTO event_guests (id, event_id, organisation_id, guest_name, guest_email, guest_type, rsvp_status, plus_ones)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  o.id,
  'CEO ' || SUBSTRING(o.company_name FROM 11), -- Remove TEST_MODE_ prefix
  LOWER(REPLACE(SUBSTRING(o.company_name FROM 11), ' ', '.')) || '@example.com',
  'winner',
  'confirmed',
  1
FROM organisations o
WHERE o.company_name LIKE 'TEST_MODE_%'
ON CONFLICT DO NOTHING;

-- 6. Display success message
SELECT
  'Test Data Created Successfully!' as status,
  '1 test event created' as events,
  '10 test awards created' as awards,
  '30 test organisations created' as organisations,
  '30 test winners created' as winners,
  '30 test RSVPs created' as rsvps,
  'Use "Remove Test Data" button to clean up' as cleanup;
