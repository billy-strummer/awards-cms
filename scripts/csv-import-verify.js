#!/usr/bin/env node

/**
 * POST-IMPORT VERIFICATION SCRIPT
 * ================================
 * Validates the database state after CSV import
 * Checks for duplicates, orphans, missing data, and data integrity
 *
 * Usage:
 *   node csv-import-verify.js
 */

const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. See .env.example'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const AWARD_YEAR = '2026';

let passCount = 0;
let warnCount = 0;
let failCount = 0;

function pass(msg) {
  passCount++;
  console.log(`  PASS  ${msg}`);
}

function warn(msg) {
  warnCount++;
  console.log(`  WARN  ${msg}`);
}

function fail(msg) {
  failCount++;
  console.log(`  FAIL  ${msg}`);
}

async function main() {
  console.log('='.repeat(70));
  console.log('  BRITISH TRADE AWARDS - POST-IMPORT VERIFICATION');
  console.log('='.repeat(70));
  console.log();

  // ---- CHECK 1: Duplicate assignments ----
  console.log('CHECK 1: Duplicate award assignments (same company + same award)');
  console.log('-'.repeat(50));
  {
    const { data, error } = await supabase
      .from('award_assignments')
      .select('id, award_id, organisation_id');

    if (error) {
      fail(`Could not query assignments: ${error.message}`);
    } else {
      const seen = new Map();
      const dupes = [];

      data.forEach(a => {
        const key = `${a.award_id}_${a.organisation_id}`;
        if (seen.has(key)) {
          dupes.push(key);
        } else {
          seen.set(key, a.id);
        }
      });

      if (dupes.length === 0) {
        pass(`No duplicate assignments found (${data.length} total assignments)`);
      } else {
        fail(`Found ${dupes.length} duplicate assignment(s)`);
      }
    }
  }
  console.log();

  // ---- CHECK 2: Duplicate organisations ----
  console.log('CHECK 2: Duplicate organisations (case-insensitive)');
  console.log('-'.repeat(50));
  {
    const { data, error } = await supabase
      .from('organisations')
      .select('id, company_name');

    if (error) {
      fail(`Could not query organisations: ${error.message}`);
    } else {
      const seen = new Map();
      const dupes = [];

      data.forEach(o => {
        const key = o.company_name.trim().toLowerCase();
        if (seen.has(key)) {
          dupes.push({ name1: seen.get(key), name2: o.company_name });
        } else {
          seen.set(key, o.company_name);
        }
      });

      if (dupes.length === 0) {
        pass(`No duplicate organisations (${data.length} total)`);
      } else {
        fail(`Found ${dupes.length} duplicate organisation name(s):`);
        dupes.slice(0, 10).forEach(d => {
          console.log(`          "${d.name1}" / "${d.name2}"`);
        });
        if (dupes.length > 10) console.log(`          ... and ${dupes.length - 10} more`);
      }
    }
  }
  console.log();

  // ---- CHECK 3: Duplicate awards ----
  console.log('CHECK 3: Duplicate awards (same name + year)');
  console.log('-'.repeat(50));
  {
    const { data, error } = await supabase
      .from('awards')
      .select('id, award_name, year');

    if (error) {
      fail(`Could not query awards: ${error.message}`);
    } else {
      const seen = new Map();
      const dupes = [];

      data.forEach(a => {
        const key = `${a.award_name.trim().toLowerCase()}_${a.year}`;
        if (seen.has(key)) {
          dupes.push(a.award_name);
        } else {
          seen.set(key, a.award_name);
        }
      });

      if (dupes.length === 0) {
        pass(`No duplicate awards (${data.length} total)`);
      } else {
        fail(`Found ${dupes.length} duplicate award(s):`);
        dupes.forEach(d => console.log(`          "${d}"`));
      }
    }
  }
  console.log();

  // ---- CHECK 4: Orphaned assignments ----
  console.log('CHECK 4: Orphaned assignments (referencing deleted orgs/awards)');
  console.log('-'.repeat(50));
  {
    const { data: assignments, error: aErr } = await supabase
      .from('award_assignments')
      .select('id, award_id, organisation_id, awards:award_years(id), organisations(id)');

    if (aErr) {
      fail(`Could not query: ${aErr.message}`);
    } else {
      const orphanedAward = assignments.filter(a => !a.awards);
      const orphanedOrg = assignments.filter(a => !a.organisations);

      if (orphanedAward.length === 0 && orphanedOrg.length === 0) {
        pass('No orphaned assignments');
      } else {
        if (orphanedAward.length > 0) fail(`${orphanedAward.length} assignments reference missing awards`);
        if (orphanedOrg.length > 0) fail(`${orphanedOrg.length} assignments reference missing organisations`);
      }
    }
  }
  console.log();

  // ---- CHECK 5: Awards coverage ----
  console.log('CHECK 5: Award coverage (awards with nominees)');
  console.log('-'.repeat(50));
  {
    const { data: awards, error: awErr } = await supabase
      .from('awards')
      .select('id, award_name')
      .or(`year.eq.${AWARD_YEAR},year.eq.${parseInt(AWARD_YEAR)}`);

    if (awErr) {
      fail(`Could not query awards: ${awErr.message}`);
    } else {
      const { data: assignments } = await supabase
        .from('award_assignments')
        .select('award_id');

      const assignedAwardIds = new Set((assignments || []).map(a => a.award_id));

      const unassigned = awards.filter(a => !assignedAwardIds.has(a.id));
      const assigned = awards.filter(a => assignedAwardIds.has(a.id));

      if (unassigned.length === 0) {
        pass(`All ${awards.length} awards have at least one nominee`);
      } else {
        warn(`${unassigned.length}/${awards.length} awards have NO nominees:`);
        unassigned.forEach(a => console.log(`          - ${a.award_name}`));
      }

      // Count nominees per award
      const awardCounts = {};
      (assignments || []).forEach(a => {
        awardCounts[a.award_id] = (awardCounts[a.award_id] || 0) + 1;
      });

      const counts = Object.values(awardCounts);
      if (counts.length > 0) {
        const min = Math.min(...counts);
        const max = Math.max(...counts);
        const avg = (counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1);
        console.log(`          Nominees per award: min=${min}, max=${max}, avg=${avg}`);
      }
    }
  }
  console.log();

  // ---- CHECK 6: Organisation data quality ----
  console.log('CHECK 6: Organisation data quality');
  console.log('-'.repeat(50));
  {
    const { data: orgs, error: oErr } = await supabase
      .from('organisations')
      .select('id, company_name, email, region');

    if (oErr) {
      fail(`Could not query: ${oErr.message}`);
    } else {
      const noEmail = orgs.filter(o => !o.email);
      const noRegion = orgs.filter(o => !o.region);
      const noName = orgs.filter(o => !o.company_name || o.company_name.trim() === '');

      if (noName.length === 0) {
        pass('All organisations have names');
      } else {
        fail(`${noName.length} organisations missing company name`);
      }

      if (noEmail.length === 0) {
        pass('All organisations have email addresses');
      } else {
        warn(`${noEmail.length}/${orgs.length} organisations missing email`);
      }

      if (noRegion.length === 0) {
        pass('All organisations have a region');
      } else {
        warn(`${noRegion.length}/${orgs.length} organisations missing region`);
      }

      console.log(`          Total organisations: ${orgs.length}`);
    }
  }
  console.log();

  // ---- CHECK 7: Assignment status distribution ----
  console.log('CHECK 7: Assignment status distribution');
  console.log('-'.repeat(50));
  {
    const { data, error } = await supabase
      .from('award_assignments')
      .select('status');

    if (error) {
      fail(`Could not query: ${error.message}`);
    } else {
      const statusCounts = {};
      data.forEach(a => {
        const s = a.status || 'null';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      });

      pass(`Status distribution (${data.length} total):`);
      Object.entries(statusCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([status, count]) => {
          console.log(`          ${status}: ${count}`);
        });
    }
  }
  console.log();

  // ---- CHECK 8: Companies with excessive assignments ----
  console.log('CHECK 8: Companies with excessive assignments (>15)');
  console.log('-'.repeat(50));
  {
    const { data, error } = await supabase
      .from('award_assignments')
      .select('organisation_id, organisations(company_name)');

    if (error) {
      fail(`Could not query: ${error.message}`);
    } else {
      const orgCounts = {};
      data.forEach(a => {
        const id = a.organisation_id;
        if (!orgCounts[id]) {
          orgCounts[id] = { name: a.organisations?.company_name || 'Unknown', count: 0 };
        }
        orgCounts[id].count++;
      });

      const excessive = Object.values(orgCounts)
        .filter(o => o.count > 15)
        .sort((a, b) => b.count - a.count);

      if (excessive.length === 0) {
        pass('No companies with > 15 assignments');
      } else {
        warn(`${excessive.length} companies have > 15 assignments:`);
        excessive.forEach(o => {
          console.log(`          ${o.name}: ${o.count} assignments`);
        });
      }
    }
  }
  console.log();

  // ---- SUMMARY ----
  console.log('='.repeat(70));
  console.log('  VERIFICATION SUMMARY');
  console.log('='.repeat(70));
  console.log();
  console.log(`  PASSED:   ${passCount}`);
  console.log(`  WARNINGS: ${warnCount}`);
  console.log(`  FAILED:   ${failCount}`);
  console.log();

  if (failCount === 0 && warnCount === 0) {
    console.log('  RESULT: ALL CHECKS PASSED - Import looks clean!');
  } else if (failCount === 0) {
    console.log('  RESULT: PASSED WITH WARNINGS - Review warnings above.');
  } else {
    console.log('  RESULT: ISSUES FOUND - Review failures above.');
  }

  console.log('='.repeat(70));
}

main().catch(err => {
  console.error('FATAL ERROR:', err.message);
  process.exit(1);
});
