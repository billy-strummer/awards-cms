#!/usr/bin/env node

// Quick script to check actual database schema
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

async function checkSchema() {
  console.log('=== CHECKING ORGANISATIONS TABLE COLUMNS ===\n');

  // Get a sample record to see what columns exist
  const { data: orgData, error: orgError } = await supabase.from('organisations').select('*').limit(1);

  if (orgError) {
    console.error('Error fetching organisations:', orgError.message);
  } else if (orgData && orgData.length > 0) {
    console.log('Organisations table columns:');
    console.log(Object.keys(orgData[0]).join(', '));
    console.log('\nSample record:');
    console.log(JSON.stringify(orgData[0], null, 2));
  }

  console.log('\n=== CHECKING AWARDS TABLE COLUMNS ===\n');

  // Get a sample award
  const { data: awardData, error: awardError } = await supabase.from('awards').select('*').limit(1);

  if (awardError) {
    console.error('Error fetching awards:', awardError.message);
  } else if (awardData && awardData.length > 0) {
    console.log('Awards table columns:');
    console.log(Object.keys(awardData[0]).join(', '));
    console.log('\nSample record:');
    console.log(JSON.stringify(awardData[0], null, 2));
  }

  console.log('\n=== CHECKING EXTENSION SPECIALIST AWARDS ===\n');

  // Look for Extension awards
  const { data: extensionAwards, error: extError } = await supabase
    .from('awards')
    .select('*')
    .ilike('award_name', '%Extension%');

  if (extError) {
    console.error('Error:', extError.message);
  } else {
    console.log(`Found ${extensionAwards.length} Extension awards:`);
    extensionAwards.forEach((award) => {
      console.log(`- ${award.award_name} (ID: ${award.id})`);
      console.log(`  Full record:`, JSON.stringify(award, null, 2));
    });
  }
}

checkSchema().catch(console.error);
