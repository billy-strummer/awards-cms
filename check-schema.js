#!/usr/bin/env node

// Quick script to check actual database schema
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://qdzyknercdqwhwijbcxf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkenlrbmVyY2Rxd2h3aWpiY3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDAwODEsImV4cCI6MjA4NjQxNjA4MX0.ecs9dgUaOW607imlYFJeLhLHlC8YWybnEUPEHJeRrkY'
);

async function checkSchema() {
  console.log('=== CHECKING ORGANISATIONS TABLE COLUMNS ===\n');

  // Get a sample record to see what columns exist
  const { data: orgData, error: orgError } = await supabase
    .from('organisations')
    .select('*')
    .limit(1);

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
  const { data: awardData, error: awardError } = await supabase
    .from('awards')
    .select('*')
    .limit(1);

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
    extensionAwards.forEach(award => {
      console.log(`- ${award.award_name} (ID: ${award.id})`);
      console.log(`  Full record:`, JSON.stringify(award, null, 2));
    });
  }
}

checkSchema().catch(console.error);
