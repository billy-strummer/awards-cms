-- Simple fix: Update "Extension Specialist" to "Extension Company" in award names

-- Step 1: See what needs updating
SELECT id, award_name, region, year
FROM awards
WHERE award_name ILIKE '%Extension Specialist%';

-- Step 2: Run the update (uncomment to execute)
/*
UPDATE awards
SET award_name = REPLACE(award_name, 'Extension Specialist', 'Extension Company')
WHERE award_name ILIKE '%Extension Specialist%';
*/

-- Step 3: Verify (run after update)
SELECT id, award_name, region, year
FROM awards
WHERE award_name ILIKE '%Extension Company%';
