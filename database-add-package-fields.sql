-- ============================================
-- ADD PACKAGE AND ENHANCED PROFILE FIELDS
-- ============================================

-- Add package_type column to award_assignments
ALTER TABLE award_assignments
ADD COLUMN IF NOT EXISTS package_type VARCHAR(50) DEFAULT 'bronze';

-- Add enhanced_profile column to award_assignments
ALTER TABLE award_assignments
ADD COLUMN IF NOT EXISTS enhanced_profile BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN award_assignments.package_type IS 'Package type: bronze, silver, gold, non-attendee';
COMMENT ON COLUMN award_assignments.enhanced_profile IS 'Whether the winner profile has enhanced marketing content';

-- Create index for package queries
CREATE INDEX IF NOT EXISTS idx_award_assignments_package ON award_assignments(package_type);
CREATE INDEX IF NOT EXISTS idx_award_assignments_enhanced ON award_assignments(enhanced_profile);

-- ============================================
-- SUCCESS!
-- ============================================
SELECT 'Package and enhanced profile fields added successfully!' as message;
