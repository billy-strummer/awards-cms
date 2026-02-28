#!/usr/bin/env node

/**
 * Script to detect and remove duplicate award assignments
 * This addresses the duplicate data issue throughout the website
 */

const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. See .env.example'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDuplicates() {
  console.log('🔍 Checking for duplicate award assignments...\n');

  try {
    // Query 1: Check companies with excessive assignments
    console.log('📊 Query 1: Companies with more than 10 assignments');
    console.log('='.repeat(60));

    const { data: allAssignments, error: assignmentsError } = await supabase
      .from('award_assignments')
      .select(`
        organisation_id,
        award_id,
        organisations (
          company_name
        )
      `);

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError);
      return;
    }

    // Group by organisation
    const orgCounts = {};
    const orgNames = {};
    const awardCounts = {};

    allAssignments.forEach(assignment => {
      const orgId = assignment.organisation_id;
      const awardId = assignment.award_id;

      if (!orgCounts[orgId]) {
        orgCounts[orgId] = 0;
        orgNames[orgId] = assignment.organisations?.company_name || 'Unknown';
        awardCounts[orgId] = new Set();
      }

      orgCounts[orgId]++;
      awardCounts[orgId].add(awardId);
    });

    // Find organizations with > 10 assignments
    const excessiveAssignments = Object.entries(orgCounts)
      .filter(([_, count]) => count > 10)
      .map(([orgId, count]) => ({
        company_name: orgNames[orgId],
        total_assignments: count,
        unique_awards: awardCounts[orgId].size
      }))
      .sort((a, b) => b.total_assignments - a.total_assignments);

    if (excessiveAssignments.length > 0) {
      console.log(`Found ${excessiveAssignments.length} companies with > 10 assignments:\n`);
      excessiveAssignments.forEach(org => {
        console.log(`  • ${org.company_name}`);
        console.log(`    Total assignments: ${org.total_assignments}`);
        console.log(`    Unique awards: ${org.unique_awards}`);
        console.log();
      });
    } else {
      console.log('✅ No companies with > 10 assignments found.\n');
    }

    // Query 2: Find exact duplicates (same company + same award)
    console.log('📊 Query 2: Duplicate assignments (same company + same award)');
    console.log('='.repeat(60));

    const { data: assignmentsWithDetails, error: detailsError } = await supabase
      .from('award_assignments')
      .select(`
        id,
        organisation_id,
        award_id,
        assigned_date,
        organisations (
          company_name
        ),
        awards (
          award_name
        )
      `)
      .order('assigned_date', { ascending: false });

    if (detailsError) {
      console.error('Error fetching assignment details:', detailsError);
      return;
    }

    // Find duplicates
    const duplicateMap = {};
    const _duplicateRecords = [];

    assignmentsWithDetails.forEach(assignment => {
      const key = `${assignment.organisation_id}_${assignment.award_id}`;

      if (!duplicateMap[key]) {
        duplicateMap[key] = {
          count: 0,
          company_name: assignment.organisations?.company_name || 'Unknown',
          award_name: assignment.awards?.award_name || 'Unknown',
          records: []
        };
      }

      duplicateMap[key].count++;
      duplicateMap[key].records.push({
        id: assignment.id,
        assigned_date: assignment.assigned_date
      });
    });

    // Filter to only actual duplicates (count > 1)
    const actualDuplicates = Object.values(duplicateMap)
      .filter(item => item.count > 1)
      .sort((a, b) => b.count - a.count);

    if (actualDuplicates.length > 0) {
      console.log(`\n⚠️  Found ${actualDuplicates.length} duplicate company+award combinations:\n`);

      let totalDuplicateRecords = 0;
      actualDuplicates.forEach(dup => {
        console.log(`  • ${dup.company_name} - ${dup.award_name}`);
        console.log(`    Duplicate count: ${dup.count} (${dup.count - 1} will be removed)`);
        totalDuplicateRecords += (dup.count - 1);

        // Show dates of duplicates
        dup.records.forEach((record, idx) => {
          const date = record.assigned_date ? new Date(record.assigned_date).toLocaleDateString() : 'No date';
          const keep = idx === 0 ? '✓ KEEP (most recent)' : '✗ DELETE';
          console.log(`      ${date} - ${keep}`);
        });
        console.log();
      });

      console.log(`📈 Summary:`);
      console.log(`  • Total duplicate combinations: ${actualDuplicates.length}`);
      console.log(`  • Total records to delete: ${totalDuplicateRecords}`);
      console.log(`  • Total records to keep: ${actualDuplicates.length}\n`);

      // Store duplicates for cleanup
      return { duplicates: actualDuplicates, totalToDelete: totalDuplicateRecords };
    } else {
      console.log('✅ No duplicate assignments found.\n');
      return { duplicates: [], totalToDelete: 0 };
    }

  } catch (error) {
    console.error('Error checking duplicates:', error);
    throw error;
  }
}

async function removeDuplicates(duplicateData) {
  if (!duplicateData || duplicateData.totalToDelete === 0) {
    console.log('✅ No duplicates to remove.');
    return;
  }

  console.log('\n🧹 Removing duplicate assignments...');
  console.log('='.repeat(60));
  console.log(`This will delete ${duplicateData.totalToDelete} duplicate records.\n`);

  try {
    let deletedCount = 0;
    let errors = 0;

    for (const dup of duplicateData.duplicates) {
      // Keep the first (most recent) record, delete the rest
      const recordsToDelete = dup.records.slice(1); // Skip first record

      for (const record of recordsToDelete) {
        const { error } = await supabase
          .from('award_assignments')
          .delete()
          .eq('id', record.id);

        if (error) {
          console.error(`  ✗ Error deleting record ${record.id}:`, error.message);
          errors++;
        } else {
          deletedCount++;
        }
      }
    }

    console.log(`\n✅ Cleanup complete!`);
    console.log(`  • Records deleted: ${deletedCount}`);
    console.log(`  • Errors: ${errors}`);

    if (errors > 0) {
      console.log(`\n⚠️  Some deletions failed. Please check the errors above.`);
    }

    return { deletedCount, errors };

  } catch (error) {
    console.error('Error removing duplicates:', error);
    throw error;
  }
}

async function verifyCleanup() {
  console.log('\n🔍 Verifying cleanup...');
  console.log('='.repeat(60));

  const result = await checkDuplicates();

  if (result && result.totalToDelete === 0) {
    console.log('✅ Verification successful! No duplicates remaining.\n');
  } else {
    console.log('⚠️  Warning: Duplicates still found after cleanup.\n');
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('DUPLICATE AWARD ASSIGNMENTS CHECKER & REMOVER');
  console.log('='.repeat(60));
  console.log();

  // Step 1: Check for duplicates
  const duplicateData = await checkDuplicates();

  // Step 2: If duplicates found, ask to remove them
  if (duplicateData && duplicateData.totalToDelete > 0) {
    const shouldRemove = process.argv.includes('--fix') || process.argv.includes('--remove');

    if (shouldRemove) {
      await removeDuplicates(duplicateData);
      await verifyCleanup();
    } else {
      console.log('💡 To remove these duplicates, run:');
      console.log('   node check-and-fix-duplicates.js --fix\n');
    }
  }

  console.log('='.repeat(60));
  console.log('Done!');
  console.log('='.repeat(60));
}

// Run the script
main().catch(console.error);
