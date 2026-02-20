/**
 * DIAGNOSTIC SCRIPT - Paste this entire block into your browser console (F12 > Console)
 * It will test every table the test data manager uses and report exact errors.
 */
(async function diagnoseTables() {
  if (!STATE || !STATE.client) {
    console.error('STATE.client is not initialized. Are you logged in?');
    return;
  }

  console.log('=== SUPABASE TEST DATA DIAGNOSTIC ===');
  console.log('Testing each table individually...\n');

  var tables = [
    'events', 'award_years', 'awards', 'organisations', 'award_assignments',
    'winners', 'entries', 'judge_scores', 'public_votes', 'event_guests',
    'sponsors', 'banners', 'organisation_contacts', 'communications', 'deals',
    'meeting_notes', 'contact_segments', 'organisation_segments',
    'invoices', 'invoice_line_items', 'payments',
    'event_galleries', 'media_items', 'media_gallery',
    'running_order', 'running_order_settings',
    'event_attendees', 'event_ticket_types',
    'email_templates', 'email_lists', 'email_list_subscribers',
    'social_media_posts', 'organisation_follow_ups', 'scheduled_reports',
    'counties'
  ];

  var results = [];

  for (var i = 0; i < tables.length; i++) {
    var table = tables[i];
    try {
      var { data, error, count } = await STATE.client
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        results.push({ table: table, status: 'ERROR', message: error.message, code: error.code, hint: error.hint });
        console.log('❌ ' + table + ': ' + error.message + (error.code ? ' [' + error.code + ']' : ''));
      } else {
        results.push({ table: table, status: 'OK', rows: count });
        console.log('✅ ' + table + ': accessible (' + (count || 0) + ' rows)');
      }
    } catch (e) {
      results.push({ table: table, status: 'EXCEPTION', message: e.message });
      console.log('💥 ' + table + ': ' + e.message);
    }
  }

  // Now test a write operation on organisations
  console.log('\n=== WRITE TEST ===');
  console.log('Testing insert into organisations...');

  var testId = '99999999-0000-0000-0000-000000000099';

  // Test 1: minimal insert (only columns from migration 000)
  var { error: writeErr1 } = await STATE.client.from('organisations').upsert({
    id: testId,
    company_name: 'DIAG_TEST_DELETE_ME'
  });
  if (writeErr1) {
    console.log('❌ WRITE TEST (minimal): ' + writeErr1.message + (writeErr1.code ? ' [' + writeErr1.code + ']' : '') + (writeErr1.hint ? ' Hint: ' + writeErr1.hint : ''));
  } else {
    console.log('✅ WRITE TEST (minimal): insert succeeded');
    // Clean up
    await STATE.client.from('organisations').delete().eq('id', testId);
    console.log('   (cleaned up test row)');
  }

  // Test 2: insert with description + status columns (from later migrations)
  var { error: writeErr2 } = await STATE.client.from('organisations').upsert({
    id: testId,
    company_name: 'DIAG_TEST_DELETE_ME',
    description: 'test',
    status: 'active'
  });
  if (writeErr2) {
    console.log('❌ WRITE TEST (with description+status): ' + writeErr2.message);
    console.log('   ^ This means migrations 003/009 have NOT been applied');
  } else {
    console.log('✅ WRITE TEST (with description+status): insert succeeded');
    await STATE.client.from('organisations').delete().eq('id', testId);
  }

  // Test 3: insert into entries with columns from migration 010
  var { error: writeErr3 } = await STATE.client.from('entries').upsert({
    id: testId,
    entry_number: 'DIAG-TEST-0001',
    entry_title: 'DIAG_TEST_DELETE_ME',
    status: 'draft',
    year: 2025,
    contact_phone: '000',
    why_should_win: 'test'
  });
  if (writeErr3) {
    console.log('❌ WRITE TEST (entries + migration 010 cols): ' + writeErr3.message);
    console.log('   ^ This means migration 010 has NOT been applied');
  } else {
    console.log('✅ WRITE TEST (entries + migration 010 cols): insert succeeded');
    await STATE.client.from('entries').delete().eq('id', testId);
  }

  // Test 4: insert into award_years
  var { error: writeErr4 } = await STATE.client.from('award_years').upsert({
    id: testId,
    award_name: 'DIAG_TEST_DELETE_ME',
    year: 2025
  });
  if (writeErr4) {
    console.log('❌ WRITE TEST (award_years): ' + writeErr4.message + (writeErr4.code ? ' [' + writeErr4.code + ']' : ''));
    // Try the view instead
    var { error: writeErr4b } = await STATE.client.from('awards').insert({
      id: testId,
      award_name: 'DIAG_TEST_DELETE_ME'
    });
    if (writeErr4b) {
      console.log('❌ WRITE TEST (awards view): ' + writeErr4b.message);
    } else {
      console.log('✅ WRITE TEST (awards view): works as fallback');
      await STATE.client.from('awards').delete().eq('id', testId);
    }
  } else {
    console.log('✅ WRITE TEST (award_years): insert succeeded');
    await STATE.client.from('award_years').delete().eq('id', testId);
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  var accessible = results.filter(function(r) { return r.status === 'OK'; });
  var errors = results.filter(function(r) { return r.status !== 'OK'; });
  console.log('Accessible tables: ' + accessible.length + '/' + results.length);
  if (errors.length > 0) {
    console.log('Failed tables:');
    errors.forEach(function(r) {
      console.log('  - ' + r.table + ': ' + r.message);
    });
  }
  console.log('\n=== COPY EVERYTHING ABOVE AND SHARE IT ===');

  return results;
})();
