/* ==================================================== */
/* TEST DATA MANAGER — Comprehensive coverage for all tabs */
/* ==================================================== */

const testDataManager = {
  // Fixed IDs for deterministic test data
  EVENT_ID: '00000000-0000-0000-0000-000000000001',
  AWARD_PREFIX: '10000000-0000-0000-0000-',
  ORG_PREFIX: '20000000-0000-0000-0000-',
  ASSIGN_PREFIX: '30000000-0000-0000-0000-',
  ENTRY_PREFIX: '40000000-0000-0000-0000-',
  SPONSOR_PREFIX: '50000000-0000-0000-0000-',
  BANNER_PREFIX: '51000000-0000-0000-0000-',
  CONTACT_PREFIX: '60000000-0000-0000-0000-',
  DEAL_PREFIX: '61000000-0000-0000-0000-',
  COMM_PREFIX: '62000000-0000-0000-0000-',
  MEETING_PREFIX: '63000000-0000-0000-0000-',
  SEGMENT_PREFIX: '64000000-0000-0000-0000-',
  GALLERY_PREFIX: '70000000-0000-0000-0000-',
  MEDIA_ITEM_PREFIX: '71000000-0000-0000-0000-',
  MEDIA_GAL_PREFIX: '72000000-0000-0000-0000-',
  RUNNING_PREFIX: '73000000-0000-0000-0000-',
  INVOICE_PREFIX: '80000000-0000-0000-0000-',
  PAYMENT_PREFIX: '81000000-0000-0000-0000-',
  VOTE_PREFIX: '90000000-0000-0000-0000-',
  WINNER_PREFIX: 'A0000000-0000-0000-0000-',
  TEMPLATE_PREFIX: 'B0000000-0000-0000-0000-',
  EMAIL_LIST_PREFIX: 'B1000000-0000-0000-0000-',
  SOCIAL_PREFIX: 'B2000000-0000-0000-0000-',
  TICKET_TYPE_PREFIX: 'B3000000-0000-0000-0000-',
  FOLLOWUP_PREFIX: 'B4000000-0000-0000-0000-',
  REPORT_PREFIX: 'B5000000-0000-0000-0000-',
  ATTENDEE_PREFIX: 'B6000000-0000-0000-0000-',

  uid(prefix, n) {
    return prefix + String(n).padStart(12, '0');
  },

  /**
   * Log and show errors visibly
   */
  _logErr(step, err) {
    if (err) {
      var msg = err.message || JSON.stringify(err);
      var code = err.code ? ' [' + err.code + ']' : '';
      var detail = err.details ? ' | ' + err.details : '';
      var hint = err.hint ? ' | Hint: ' + err.hint : '';
      console.warn(step + code + ':', msg + detail + hint);
      utils.showToast('Error: ' + step + ' - ' + msg, 'warning');
      return true;
    }
    return false;
  },

  /**
   * Resilient write: auto-strips columns the database doesn't have and retries.
   * Works regardless of which migrations have been applied.
   * @param {string} table - Table name
   * @param {object|array} records - Data to write
   * @param {string} label - Human-readable label for logging
   * @param {string} mode - 'upsert' or 'insert'
   * @returns {{error: object|null, stripped: string[]}}
   */
  async _safeWrite(table, records, label, mode) {
    var data = JSON.parse(JSON.stringify(records)); // deep copy to avoid mutating originals
    var stripped = [];

    for (var attempt = 0; attempt < 20; attempt++) {
      var r = (mode === 'upsert')
        ? await STATE.client.from(table).upsert(data)
        : await STATE.client.from(table).insert(data);

      if (!r.error) {
        if (stripped.length > 0) {
          console.log(label + ': OK (auto-stripped missing columns: ' + stripped.join(', ') + ')');
          utils.showToast(label + ': inserted (skipped cols: ' + stripped.join(', ') + ')', 'info');
        }
        return { error: null, stripped: stripped };
      }

      // Build full error text for pattern matching
      var errText = (r.error.message || '') + ' ' + (r.error.details || '') + ' ' + (r.error.hint || '');

      // PostgREST pattern: "Could not find the 'colname' column of 'table' in the schema cache"
      var match = errText.match(/Could not find the '([^']+)' column/);
      // PostgreSQL pattern: column "colname" of relation "table" does not exist
      if (!match) match = errText.match(/column "([^"]+)".*does not exist/);
      // Generic fallback
      if (!match) match = errText.match(/Could not find.*?column.*?'([^']+)'/i);

      // Check for table not found (not a column issue - bail out)
      if (!match && /Could not find.*in the schema cache/i.test(errText) && !/column/i.test(errText)) {
        console.warn(label + ': table "' + table + '" not found in schema cache');
        return { error: r.error, stripped: stripped };
      }

      if (!match || stripped.indexOf(match[1]) >= 0) {
        // Not a column error or already stripped this column - return as-is
        return { error: r.error, stripped: stripped };
      }

      var badCol = match[1];
      stripped.push(badCol);
      console.warn(label + ': auto-stripping missing column "' + badCol + '", retrying...');

      if (Array.isArray(data)) {
        data.forEach(function(row) { delete row[badCol]; });
      } else {
        delete data[badCol];
      }
    }

    return { error: { message: 'Too many missing columns stripped: ' + stripped.join(', ') }, stripped: stripped };
  },

  /**
   * Safe delete: swallows errors from missing tables/columns
   */
  async _safeDel(promise) {
    try { await promise; } catch(e) { console.warn('Cleanup skip:', e.message || e); }
  },

  /**
   * Generate Test Data
   */
  async generateTestData() {
    const confirmed = await this.showConfirmDialog(
      'Generate Test Data',
      'This will create comprehensive test data for <strong>every tab</strong>:<br>' +
      '<ul class="mb-0">' +
      '<li><strong>Dashboard:</strong> Aggregated stats from all below</li>' +
      '<li><strong>Awards:</strong> 10 award categories with county reference data</li>' +
      '<li><strong>Organisations:</strong> 30 companies with contacts</li>' +
      '<li><strong>Winners:</strong> 30 award assignments</li>' +
      '<li><strong>Entries:</strong> 20 entries with varied statuses + judge scores + public votes</li>' +
      '<li><strong>Media Gallery:</strong> 2 galleries with 10 media items</li>' +
      '<li><strong>Events:</strong> 1 event with RSVPs, attendees, tickets, running order</li>' +
      '<li><strong>Reports:</strong> Scheduled reports + data from entries, payments, judges</li>' +
      '<li><strong>Marketing:</strong> Sponsors, banners, email templates, email lists, social media posts</li>' +
      '<li><strong>Payments:</strong> 8 invoices with line items + 5 payments</li>' +
      '<li><strong>CRM:</strong> 15 contacts, 6 deals, 10 communications, 4 meetings, 3 segments, follow-ups</li>' +
      '</ul><br>All test data uses <code>TEST_MODE_</code> prefix or fixed UUID ranges.',
      'Generate All Test Data'
    );

    if (!confirmed) return;

    try {
      utils.showLoading();
      await this.executeTestDataGeneration();
    } catch (error) {
      console.error('Error generating test data:', error);
      utils.showToast('Failed to generate test data: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Execute test data generation directly
   */
  async executeTestDataGeneration() {
    const eventId = this.EVENT_ID;
    var errors = [];

    // ===== Pre-flight: verify database connectivity =====
    utils.showToast('Pre-flight check: testing database connection...', 'info');
    try {
      var { data: pfData, error: pfErr } = await STATE.client.from('events').select('id').limit(1);
      if (pfErr) {
        var pfMsg = 'Pre-flight FAILED: cannot read from database. Error: ' + (pfErr.message || JSON.stringify(pfErr));
        if (pfErr.code) pfMsg += ' [code: ' + pfErr.code + ']';
        if (pfErr.hint) pfMsg += ' Hint: ' + pfErr.hint;
        console.error(pfMsg);
        utils.showToast(pfMsg, 'error');
        this.showModal('Database Connection Error',
          '<div class="alert alert-danger"><h6>Cannot connect to database</h6>' +
          '<p>' + pfMsg + '</p>' +
          '<p>Check that:<br>- You are logged in<br>- Your internet connection is working<br>- The Supabase project is running</p></div>');
        return;
      }
      console.log('Pre-flight OK: database is accessible');
    } catch(pfE) {
      console.error('Pre-flight exception:', pfE);
      utils.showToast('Pre-flight FAILED: ' + (pfE.message || pfE), 'error');
      return;
    }

    // ===== Step 0: Seed counties reference data if empty =====
    try { await this.seedCounties(); } catch(e) { this._logErr('Counties seed', e); }

    // ===== Step 1: Create test event =====
    utils.showToast('Step 1/15: Creating test event...', 'info');
    try {
      var evtResult = await this._safeWrite('events', {
        id: eventId,
        event_name: 'TEST_MODE_2025 Awards Gala',
        event_date: '2025-12-15',
        year: 2025,
        venue: 'Grand Test Ballroom',
        description: '[TEST MODE] This is a test event with mock winners for testing the CMS'
      }, 'Events', 'upsert');
      if (this._logErr('Events', evtResult.error)) errors.push('events');
    } catch(e) { this._logErr('Events', e); errors.push('events'); }

    // ===== Step 2: Create 10 test awards =====
    utils.showToast('Step 2/15: Creating test awards...', 'info');
    const awards = [
      { id: this.uid(this.AWARD_PREFIX, 1), award_name: 'TEST_MODE_Best Innovation', award_category: 'Innovation', sector: 'Technology & Digital', county: 'Greater London', description: 'Excellence in innovation', year: 2025, is_active: true, status: 'Published' },
      { id: this.uid(this.AWARD_PREFIX, 2), award_name: 'TEST_MODE_Rising Star', award_category: 'Growth', sector: 'Business Services', county: 'Greater Manchester', description: 'Fast growing company', year: 2025, is_active: true, status: 'Published' },
      { id: this.uid(this.AWARD_PREFIX, 3), award_name: 'TEST_MODE_Export Excellence', award_category: 'International', sector: 'Business Services', county: 'West Midlands', description: 'Outstanding exports', year: 2025, is_active: true, status: 'Published' },
      { id: this.uid(this.AWARD_PREFIX, 4), award_name: 'TEST_MODE_Sustainability Leader', award_category: 'Environment', sector: 'Environment & Energy', county: 'Bristol', description: 'Green business practices', year: 2025, is_active: true, status: 'Published' },
      { id: this.uid(this.AWARD_PREFIX, 5), award_name: 'TEST_MODE_Digital Transformation', award_category: 'Technology', sector: 'Technology & Digital', county: 'West Yorkshire', description: 'Digital innovation', year: 2025, is_active: true, status: 'Approved' },
      { id: this.uid(this.AWARD_PREFIX, 6), award_name: 'TEST_MODE_Best Employer', award_category: 'People', sector: 'People & Culture', county: 'Surrey', description: 'Great workplace', year: 2025, is_active: true, status: 'Approved' },
      { id: this.uid(this.AWARD_PREFIX, 7), award_name: 'TEST_MODE_Customer Excellence', award_category: 'Service', sector: 'Business Services', county: 'Edinburgh', description: 'Outstanding customer service', year: 2025, is_active: true, status: 'Approved' },
      { id: this.uid(this.AWARD_PREFIX, 8), award_name: 'TEST_MODE_Manufacturing Excellence', award_category: 'Manufacturing', sector: 'Manufacturing & Engineering', county: 'South Yorkshire', description: 'Quality manufacturing', year: 2025, is_active: true, status: 'Approved' },
      { id: this.uid(this.AWARD_PREFIX, 9), award_name: 'TEST_MODE_Social Impact', award_category: 'Community', sector: 'People & Culture', county: 'Cardiff', description: 'Community contribution', year: 2025, is_active: true, status: 'Pending' },
      { id: this.uid(this.AWARD_PREFIX, 10), award_name: 'TEST_MODE_Lifetime Achievement', award_category: 'Special', sector: 'Special Awards', county: 'Belfast', description: 'Career recognition', year: 2025, is_active: true, status: 'Draft' }
    ];
    try {
      // Try direct table first, fall back to view with delete+insert
      var awardsResult = await this._safeWrite('award_years', awards, 'Awards (award_years)', 'upsert');
      if (awardsResult.error) {
        console.warn('award_years upsert failed, trying awards view:', awardsResult.error.message);
        try { await STATE.client.from('awards').delete().like('award_name', 'TEST_MODE_%'); } catch(e2) {}
        var awardsResult2 = await this._safeWrite('awards', awards, 'Awards (view)', 'insert');
        if (this._logErr('Awards (via view)', awardsResult2.error)) errors.push('awards');
      }
    } catch(e) { this._logErr('Awards', e); errors.push('awards'); }

    // ===== Step 3: Create 30 test organisations =====
    utils.showToast('Step 3/15: Creating test organisations...', 'info');
    const orgNames = [
      'Acme Corporation', 'Global Dynamics Ltd', 'TechStart Solutions', 'Green Energy Co', 'Premier Consulting',
      'Digital First Agency', 'Swift Logistics', 'HealthTech Innovations', 'Financial Services Group', 'EduTech Platform',
      'Retail Revolution', 'Construction Masters', 'Food & Beverage Co', 'Creative Studios', 'Property Development Ltd',
      'Automotive Innovations', 'Legal Partners', 'Engineering Solutions', 'Fashion Forward', 'Sports Excellence',
      'Travel & Tourism', 'Pharma Research', 'Insurance Partners', 'Telecom Services', 'Chemical Industries',
      'Publishing House', 'Security Systems', 'Agriculture Tech', 'Entertainment Group', 'Environmental Services'
    ];
    const industries = [
      'Technology', 'Manufacturing', 'Software', 'Energy', 'Consulting',
      'Marketing', 'Transport', 'Healthcare', 'Finance', 'Education',
      'Retail', 'Construction', 'Food', 'Media', 'Real Estate',
      'Automotive', 'Legal', 'Engineering', 'Fashion', 'Sports',
      'Tourism', 'Pharmaceutical', 'Insurance', 'Telecommunications', 'Chemical',
      'Publishing', 'Security', 'Agriculture', 'Entertainment', 'Environment'
    ];
    const regions = [
      'London', 'South East', 'South West', 'East Midlands', 'West Midlands',
      'North West', 'North East', 'Yorkshire', 'East of England', 'Scotland',
      'Wales', 'Northern Ireland', 'London', 'South East', 'South West',
      'East Midlands', 'West Midlands', 'North West', 'North East', 'Yorkshire',
      'East of England', 'Scotland', 'Wales', 'London', 'South East',
      'South West', 'East Midlands', 'West Midlands', 'North West', 'North East'
    ];
    const orgs = orgNames.map((name, i) => ({
      id: this.uid(this.ORG_PREFIX, i + 1),
      company_name: 'TEST_MODE_' + name,
      sector: industries[i],
      description: 'Test organisation #' + (i + 1),
      region: regions[i],
      status: 'active',
      contact_name: 'Contact ' + (i + 1),
      email: name.toLowerCase().replace(/[^a-z0-9]/g, '.') + '@example.com',
      website: 'https://' + name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.example.com',
      contact_phone: '020 ' + String(7000 + i).padStart(4, '0') + ' ' + String(1000 + i * 37).padStart(4, '0')
    }));
    try {
      var orgsResult = await this._safeWrite('organisations', orgs, 'Organisations', 'upsert');
      if (this._logErr('Organisations', orgsResult.error)) errors.push('organisations');
    } catch(e) { this._logErr('Organisations', e); errors.push('organisations'); }

    // ===== Step 4: Create 30 award assignments (3 winners per award) =====
    utils.showToast('Step 4/15: Creating test winners...', 'info');
    const winnerOrgIndices = [
      [1,3,5], [7,10,11], [2,13,24], [4,28,30], [6,8,14],
      [9,22,26], [21,23,25], [12,16,18], [15,20,29], [17,19,27]
    ];
    const assignments = [];
    var assignIdx = 1;
    for (var a = 0; a < 10; a++) {
      for (var w = 0; w < 3; w++) {
        assignments.push({
          id: this.uid(this.ASSIGN_PREFIX, assignIdx),
          award_id: this.uid(this.AWARD_PREFIX, a + 1),
          organisation_id: this.uid(this.ORG_PREFIX, winnerOrgIndices[a][w]),
          status: 'winner',
          winner_position: w + 1
        });
        assignIdx++;
      }
    }
    try {
      var assignResult = await this._safeWrite('award_assignments', assignments, 'Award assignments', 'upsert');
      if (this._logErr('Award assignments', assignResult.error)) errors.push('award_assignments');
    } catch(e) { this._logErr('Award assignments', e); errors.push('award_assignments'); }

    // ===== Step 4b: Populate winners table =====
    var winners = [];
    var winnerIdx = 1;
    for (var wi = 0; wi < 10; wi++) {
      var topOrgIdx = winnerOrgIndices[wi][0];
      winners.push({
        id: this.uid(this.WINNER_PREFIX, winnerIdx),
        winner_name: orgNames[topOrgIdx - 1],
        award_id: this.uid(this.AWARD_PREFIX, wi + 1),
        organisation_id: this.uid(this.ORG_PREFIX, topOrgIdx),
        year: 2025
      });
      winnerIdx++;
    }
    try {
      var winnerResult = await this._safeWrite('winners', winners, 'Winners', 'upsert');
      if (this._logErr('Winners', winnerResult.error)) errors.push('winners');
    } catch(e) { this._logErr('Winners', e); errors.push('winners'); }

    // ===== Step 5: Create event guests (RSVPs) =====
    utils.showToast('Step 5/15: Creating test RSVPs...', 'info');
    try {
      var guests = orgs.map(function(org) {
        return {
          event_id: eventId,
          guest_name: 'CEO ' + org.company_name.replace('TEST_MODE_', ''),
          guest_email: org.email,
          rsvp_status: 'confirmed'
        };
      });
      try { await STATE.client.from('event_guests').delete().eq('event_id', eventId); } catch(e2) {}
      var guestResult = await this._safeWrite('event_guests', guests, 'Event guests', 'insert');
      if (this._logErr('Event guests', guestResult.error)) errors.push('event_guests');
    } catch(e) { this._logErr('Event guests', e); errors.push('event_guests'); }

    // ===== Step 6: Create entries with varied statuses =====
    utils.showToast('Step 6/15: Creating test entries...', 'info');
    try { await this.generateEntries(awards, orgs); } catch(e) { this._logErr('Entries', e); errors.push('entries'); }

    // ===== Step 7: Create sponsors and banners (Marketing tab) =====
    utils.showToast('Step 7/15: Creating sponsors & banners...', 'info');
    try { await this.generateMarketingData(); } catch(e) { this._logErr('Marketing', e); errors.push('marketing'); }

    // ===== Step 8: Create CRM data =====
    utils.showToast('Step 8/15: Creating CRM data...', 'info');
    try { await this.generateCRMData(orgs); } catch(e) { this._logErr('CRM', e); errors.push('crm'); }

    // ===== Step 9: Create invoices, line items, payments (Payments tab) =====
    utils.showToast('Step 9/15: Creating invoices & payments...', 'info');
    try { await this.generatePaymentsData(orgs); } catch(e) { this._logErr('Payments', e); errors.push('payments'); }

    // ===== Step 10: Create media gallery data =====
    utils.showToast('Step 10/15: Creating media gallery...', 'info');
    try { await this.generateMediaData(eventId, orgs, awards); } catch(e) { this._logErr('Media gallery', e); errors.push('media'); }

    // ===== Step 11: Create running order + settings =====
    utils.showToast('Step 11/15: Creating running order...', 'info');
    try { await this.generateRunningOrder(eventId, awards, orgs, winnerOrgIndices); } catch(e) { this._logErr('Running order', e); errors.push('running_order'); }

    // ===== Step 12: Create event attendees + tickets =====
    utils.showToast('Step 12/15: Creating attendees & tickets...', 'info');
    try { await this.generateEventExtras(eventId, orgs); } catch(e) { this._logErr('Event extras', e); errors.push('event_extras'); }

    // ===== Step 13: Create email templates, lists, social media posts =====
    utils.showToast('Step 13/15: Creating email & social media data...', 'info');
    try { await this.generateMarketingExtras(awards, orgs); } catch(e) { this._logErr('Marketing extras', e); errors.push('marketing_extras'); }

    // ===== Step 14: Create CRM follow-ups + scheduled reports =====
    utils.showToast('Step 14/15: Creating follow-ups & scheduled reports...', 'info');
    try { await this.generateExtras(orgs); } catch(e) { this._logErr('Extras', e); errors.push('extras'); }

    // ===== Step 15: Done - show summary =====
    if (errors.length > 0) {
      utils.showToast('Test data generated with ' + errors.length + ' error(s). See details below.', 'warning');
      var errorHtml = '<div class="alert alert-warning"><h6>Partial Success</h6>' +
        '<p>Test data was generated but ' + errors.length + ' table(s) had errors:</p>' +
        '<ul>' + errors.map(function(e) { return '<li><code>' + e + '</code></li>'; }).join('') + '</ul>' +
        '<p class="small">Errors usually mean missing database columns. Run the migration SQL files in Supabase SQL Editor to add missing columns, then try again.</p>' +
        '</div>' +
        '<p>Tables that succeeded should now have test data. Click "Reload Page" to see it.</p>';
      setTimeout(function() { testDataManager.showModal('Test Data - Partial Success', errorHtml, true); }, 500);
    } else {
      utils.showToast('Step 15/15: All test data generated! Reload to see it.', 'success');
      setTimeout(function() { testDataManager.showInfoModal(); }, 1000);
    }
  },

  /**
   * Generate entries with varied statuses + judge scores + public votes
   */
  async generateEntries(awards, orgs) {
    var statuses = ['draft', 'submitted', 'under_review', 'shortlisted', 'winner', 'rejected'];
    var payStatuses = ['paid', 'pending', 'waived'];
    var entries = [];
    for (var i = 0; i < 20; i++) {
      var status = statuses[i % statuses.length];
      var awardIdx = i % 10;
      var orgIdx = i % 30;
      entries.push({
        id: this.uid(this.ENTRY_PREFIX, i + 1),
        entry_number: 'TEST-ENT-' + String(i + 1).padStart(4, '0'),
        organisation_id: orgs[orgIdx].id,
        award_id: awards[awardIdx].id,
        entry_title: 'TEST_MODE_Entry: ' + orgs[orgIdx].company_name.replace('TEST_MODE_', '') + ' for ' + awards[awardIdx].award_name.replace('TEST_MODE_', ''),
        entry_description: 'This is a test entry #' + (i + 1) + ' demonstrating the awards entry submission process.',
        why_should_win: 'Outstanding achievements in ' + awards[awardIdx].award_category + ' including significant growth and innovation.',
        supporting_information: 'Revenue increased 45% year-over-year. Launched 3 new products. Expanded to 5 new markets.',
        contact_name: 'Contact Person ' + (i + 1),
        contact_email: 'entry' + (i + 1) + '@example.com',
        contact_phone: '0' + (1234567890 + i),
        contact_position: ['CEO', 'CTO', 'COO', 'CFO', 'Director'][i % 5],
        status: status,
        payment_status: payStatuses[i % 3],
        year: 2025,
        is_shortlisted: status === 'shortlisted' || status === 'winner',
        shortlisted_date: (status === 'shortlisted' || status === 'winner') ? '2025-09-01' : null,
        submission_date: '2025-0' + Math.min(i % 9 + 1, 9) + '-' + String((i % 28) + 1).padStart(2, '0'),
        is_self_nomination: i % 4 === 0,
        allow_public_voting: i % 3 === 0,
        is_public: status !== 'draft',
        public_votes: i % 3 === 0 ? Math.floor(Math.random() * 50) + 5 : 0,
        average_score: status === 'winner' ? 8.5 + Math.random() : (status === 'shortlisted' ? 7.0 + Math.random() * 1.5 : null),
        total_scores: ['under_review', 'shortlisted', 'winner'].includes(status) ? 3 : 0,
        admin_notes: status === 'rejected' ? '[TEST] Did not meet minimum criteria' : null
      });
    }
    var entryResult = await this._safeWrite('entries', entries, 'Entries', 'upsert');
    this._logErr('Entries', entryResult.error);

    // Judge scores for entries that are under_review, shortlisted, or winner
    var scoredEntries = entries.filter(function(e) {
      return ['under_review', 'shortlisted', 'winner'].includes(e.status);
    });
    var judgeNames = ['Judge Alice Smith', 'Judge Bob Jones', 'Judge Carol White'];
    var judgeEmails = ['alice.judge@example.com', 'bob.judge@example.com', 'carol.judge@example.com'];
    var scoreRecords = [];
    for (var si = 0; si < scoredEntries.length; si++) {
      var entry = scoredEntries[si];
      for (var j = 0; j < 3; j++) {
        var base = entry.status === 'winner' ? 8 : (entry.status === 'shortlisted' ? 7 : 6);
        scoreRecords.push({
          entry_id: entry.id,
          judge_name: judgeNames[j],
          judge_email: judgeEmails[j],
          is_complete: true,
          has_conflict: false,
          total_score: base + Math.random() * 2
        });
      }
    }
    if (scoreRecords.length > 0) {
      for (var di = 0; di < scoredEntries.length; di++) {
        try { await STATE.client.from('judge_scores').delete().eq('entry_id', scoredEntries[di].id); } catch(e3) {}
      }
      var scoreResult = await this._safeWrite('judge_scores', scoreRecords, 'Judge scores', 'insert');
      this._logErr('Judge scores', scoreResult.error);
    }

    // Public votes for entries that allow it
    var votableEntries = entries.filter(function(e) {
      return e.allow_public_voting && e.status !== 'draft';
    });
    var voteRecords = [];
    var voteIdx = 1;
    for (var vi = 0; vi < votableEntries.length; vi++) {
      var vEntry = votableEntries[vi];
      var numVotes = Math.floor(Math.random() * 8) + 2;
      for (var v = 0; v < numVotes; v++) {
        voteRecords.push({
          id: this.uid(this.VOTE_PREFIX, voteIdx),
          entry_id: vEntry.id,
          voter_email: 'voter' + voteIdx + '@example.com',
          voter_name: 'Test Voter ' + voteIdx,
          voter_ip: '192.168.1.' + ((voteIdx % 254) + 1),
          vote_value: 1,
          email_verified: true
        });
        voteIdx++;
      }
    }
    if (voteRecords.length > 0) {
      for (var dvi = 0; dvi < votableEntries.length; dvi++) {
        try { await STATE.client.from('public_votes').delete().eq('entry_id', votableEntries[dvi].id); } catch(e3) {}
      }
      var voteResult = await this._safeWrite('public_votes', voteRecords, 'Public votes', 'insert');
      this._logErr('Public votes', voteResult.error);
    }
  },

  /**
   * Generate Marketing data: sponsors + banners
   */
  async generateMarketingData() {
    var sponsors = [
      { id: this.uid(this.SPONSOR_PREFIX, 1), name: 'TEST_MODE_Platinum Corp', company_name: 'TEST_MODE_Platinum Corp', tier: 'Platinum', sponsorship_amount: 25000, contact_name: 'Sarah Platinum', email: 'sarah@platinumcorp.example.com', website: 'https://example.com/platinum', is_active: true, display_order: 1 },
      { id: this.uid(this.SPONSOR_PREFIX, 2), name: 'TEST_MODE_Gold Industries', company_name: 'TEST_MODE_Gold Industries', tier: 'Gold', sponsorship_amount: 15000, contact_name: 'James Gold', email: 'james@goldindustries.example.com', website: 'https://example.com/gold', is_active: true, display_order: 2 },
      { id: this.uid(this.SPONSOR_PREFIX, 3), name: 'TEST_MODE_Silver Solutions', company_name: 'TEST_MODE_Silver Solutions', tier: 'Silver', sponsorship_amount: 7500, contact_name: 'Emma Silver', email: 'emma@silversolutions.example.com', website: 'https://example.com/silver', is_active: true, display_order: 3 },
      { id: this.uid(this.SPONSOR_PREFIX, 4), name: 'TEST_MODE_Bronze Partners', company_name: 'TEST_MODE_Bronze Partners', tier: 'Bronze', sponsorship_amount: 3500, contact_name: 'Tom Bronze', email: 'tom@bronzepartners.example.com', website: 'https://example.com/bronze', is_active: true, display_order: 4 },
      { id: this.uid(this.SPONSOR_PREFIX, 5), name: 'TEST_MODE_Community Partner', company_name: 'TEST_MODE_Community Partner', tier: 'Partner', sponsorship_amount: 1000, contact_name: 'Lisa Partner', email: 'lisa@communitypartner.example.com', website: 'https://example.com/partner', is_active: true, display_order: 5 }
    ];
    var sponsorResult = await this._safeWrite('sponsors', sponsors, 'Sponsors', 'upsert');
    this._logErr('Sponsors', sponsorResult.error);

    var today = new Date().toISOString().split('T')[0];
    var banners = [
      { id: this.uid(this.BANNER_PREFIX, 1), title: 'TEST_MODE_Awards Now Open', position: 'header', image_url: 'https://placehold.co/728x90?text=Awards+Now+Open', link_url: 'https://example.com/enter', width: 728, height: 90, is_active: true, display_order: 1, impressions: 1250, clicks: 87, start_date: today },
      { id: this.uid(this.BANNER_PREFIX, 2), title: 'TEST_MODE_Sponsor Spotlight', position: 'sidebar', image_url: 'https://placehold.co/300x250?text=Sponsor+Spotlight', link_url: 'https://example.com/sponsors', width: 300, height: 250, is_active: true, display_order: 2, impressions: 980, clicks: 42, start_date: today },
      { id: this.uid(this.BANNER_PREFIX, 3), title: 'TEST_MODE_Early Bird Tickets', position: 'footer', image_url: 'https://placehold.co/728x90?text=Early+Bird+Tickets', link_url: 'https://example.com/tickets', width: 728, height: 90, is_active: true, display_order: 3, impressions: 560, clicks: 23, start_date: today },
      { id: this.uid(this.BANNER_PREFIX, 4), title: 'TEST_MODE_Vote Now', position: 'popup', image_url: 'https://placehold.co/600x400?text=Vote+Now', link_url: 'https://example.com/vote', width: 600, height: 400, is_active: false, display_order: 4, impressions: 320, clicks: 15, start_date: today }
    ];
    var bannerResult = await this._safeWrite('banners', banners, 'Banners', 'upsert');
    this._logErr('Banners', bannerResult.error);
  },

  /**
   * Generate CRM data: contacts, communications, deals, meetings, segments
   */
  async generateCRMData(orgs) {
    var firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Edward', 'Fiona', 'George', 'Hannah', 'Ian', 'Julia', 'Kevin', 'Laura', 'Michael', 'Nora', 'Oliver'];
    var lastNames = ['Smith', 'Jones', 'Williams', 'Brown', 'Taylor', 'Davies', 'Wilson', 'Evans', 'Thomas', 'Roberts', 'Johnson', 'Walker', 'Wright', 'Thompson', 'White'];
    var jobTitles = ['CEO', 'Managing Director', 'Marketing Director', 'CTO', 'CFO', 'Operations Manager', 'Sales Director', 'Head of PR', 'Business Development', 'Partnerships Lead', 'COO', 'Head of Innovation', 'General Manager', 'Commercial Director', 'Strategy Lead'];

    var contacts = firstNames.map(function(fn, i) {
      return {
        id: testDataManager.uid(testDataManager.CONTACT_PREFIX, i + 1),
        organisation_id: orgs[i].id,
        first_name: fn,
        last_name: lastNames[i],
        email: fn.toLowerCase() + '.' + lastNames[i].toLowerCase() + '@example.com'
      };
    });
    var contactResult = await this._safeWrite('organisation_contacts', contacts, 'Contacts', 'upsert');
    this._logErr('Contacts', contactResult.error);

    // Communications (10 records)
    var commTypes = ['email', 'phone', 'meeting', 'email', 'phone', 'linkedin', 'email', 'note', 'email', 'phone'];
    var commSubjects = [
      'Sponsorship enquiry follow-up', 'Award entry discussion', 'Event tickets confirmation',
      'Partnership proposal', 'Invoice payment reminder', 'LinkedIn introduction',
      'Entry submission support', 'Internal note on engagement', 'Thank you for attending', 'Upsell discussion'
    ];
    var regardingOptions = ['sponsorship', 'award_application', 'event_tickets', 'partnership', 'payment'];
    var comms = commTypes.map(function(type, i) {
      return {
        id: testDataManager.uid(testDataManager.COMM_PREFIX, i + 1),
        organisation_id: orgs[i].id,
        contact_id: contacts[i].id,
        type: type,
        direction: i % 2 === 0 ? 'outbound' : 'inbound',
        subject: 'TEST_MODE_' + commSubjects[i],
        message: 'This is a test ' + type + ' communication regarding ' + commSubjects[i].toLowerCase() + '.',
        regarding: regardingOptions[i % 5],
        follow_up_required: i % 3 === 0,
        follow_up_date: i % 3 === 0 ? new Date(Date.now() + (i + 1) * 86400000 * 3).toISOString().split('T')[0] : null
      };
    });
    var commResult = await this._safeWrite('communications', comms, 'Communications', 'upsert');
    this._logErr('Communications', commResult.error);

    // Deals (6 at various stages)
    var dealStages = ['lead', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won'];
    var dealTypes = ['sponsorship', 'award_fee', 'event_tickets', 'partnership', 'package_upgrade', 'sponsorship'];
    var dealValues = [25000, 500, 2500, 10000, 1500, 15000];
    var dealProbs = [10, 25, 50, 65, 80, 100];
    var deals = dealStages.map(function(stage, i) {
      return {
        id: testDataManager.uid(testDataManager.DEAL_PREFIX, i + 1),
        organisation_id: orgs[i].id,
        contact_id: contacts[i].id,
        title: 'TEST_MODE_' + orgs[i].company_name.replace('TEST_MODE_', '') + ' - ' + dealTypes[i],
        deal_type: dealTypes[i],
        stage: stage,
        probability: dealProbs[i],
        value: dealValues[i],
        status: stage === 'closed_won' ? 'won' : 'active',
        expected_close_date: new Date(Date.now() + (i + 1) * 86400000 * 14).toISOString().split('T')[0],
        actual_close_date: stage === 'closed_won' ? new Date().toISOString().split('T')[0] : null,
        description: 'Test deal for ' + dealTypes[i] + ' with ' + orgs[i].company_name.replace('TEST_MODE_', '')
      };
    });
    var dealResult = await this._safeWrite('deals', deals, 'Deals', 'upsert');
    this._logErr('Deals', dealResult.error);

    // Meeting notes (4 meetings)
    var meetings = [
      { id: this.uid(this.MEETING_PREFIX, 1), organisation_id: orgs[0].id, deal_id: deals[0].id, subject: 'TEST_MODE_Platinum Sponsorship Discussion', meeting_type: 'video_call', duration_minutes: 45, notes: 'Discussed platinum tier benefits. Very interested.', follow_up_required: true, follow_up_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] },
      { id: this.uid(this.MEETING_PREFIX, 2), organisation_id: orgs[3].id, deal_id: deals[3].id, subject: 'TEST_MODE_Partnership Review', meeting_type: 'in_person', duration_minutes: 60, notes: 'Reviewed partnership terms. Need to send revised proposal.', follow_up_required: true, follow_up_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0] },
      { id: this.uid(this.MEETING_PREFIX, 3), organisation_id: orgs[5].id, subject: 'TEST_MODE_Award Entry Guidance', meeting_type: 'phone', duration_minutes: 20, notes: 'Guided them through the entry process. Will submit next week.', follow_up_required: false },
      { id: this.uid(this.MEETING_PREFIX, 4), organisation_id: orgs[8].id, subject: 'TEST_MODE_Event Planning Debrief', meeting_type: 'conference', duration_minutes: 90, notes: 'Reviewed last event feedback. Planning improvements for next year.', follow_up_required: false }
    ];
    var meetingResult = await this._safeWrite('meeting_notes', meetings, 'Meetings', 'upsert');
    this._logErr('Meetings', meetingResult.error);

    // Contact segments (3 segments)
    var segments = [
      { id: this.uid(this.SEGMENT_PREFIX, 1), segment_name: 'TEST_MODE_VIP Sponsors', description: 'High-value sponsors (Gold+ tier)', color: '#FFD700', icon: 'bi-star-fill' },
      { id: this.uid(this.SEGMENT_PREFIX, 2), segment_name: 'TEST_MODE_Active Entrants', description: 'Organisations with active award entries', color: '#28a745', icon: 'bi-file-earmark-check' },
      { id: this.uid(this.SEGMENT_PREFIX, 3), segment_name: 'TEST_MODE_Past Winners', description: 'Previous award winners', color: '#6f42c1', icon: 'bi-trophy' }
    ];
    var segResult = await this._safeWrite('contact_segments', segments, 'Segments', 'upsert');
    this._logErr('Segments', segResult.error);

    // Organisation-segment relationships
    var orgSegments = [];
    // VIP Sponsors: first 3 orgs
    for (var s1 = 0; s1 < 3; s1++) {
      orgSegments.push({ organisation_id: orgs[s1].id, segment_id: segments[0].id });
    }
    // Active Entrants: orgs 4-8
    for (var s2 = 3; s2 < 8; s2++) {
      orgSegments.push({ organisation_id: orgs[s2].id, segment_id: segments[1].id });
    }
    // Past Winners: orgs 9-14
    for (var s3 = 8; s3 < 14; s3++) {
      orgSegments.push({ organisation_id: orgs[s3].id, segment_id: segments[2].id });
    }
    for (var ds = 0; ds < segments.length; ds++) {
      try { await STATE.client.from('organisation_segments').delete().eq('segment_id', segments[ds].id); } catch(e3) {}
    }
    var orgSegResult = await this._safeWrite('organisation_segments', orgSegments, 'Org segments', 'insert');
    this._logErr('Org segments', orgSegResult.error);
  },

  /**
   * Generate Payments data: invoices, line items, payments
   */
  async generatePaymentsData(orgs) {
    var invStatuses = ['sent', 'sent', 'paid', 'paid', 'overdue', 'draft', 'paid', 'cancelled'];
    var payStatuses = ['unpaid', 'unpaid', 'paid', 'paid', 'overdue', 'unpaid', 'paid', 'cancelled'];
    var types = ['package', 'package', 'entry_fee', 'entry_fee', 'package', 'entry_fee', 'sponsorship', 'package'];
    var amounts = [1250, 2500, 350, 500, 1500, 250, 15000, 750];

    var invoices = [];
    for (var ii = 0; ii < invStatuses.length; ii++) {
      invoices.push({
        id: this.uid(this.INVOICE_PREFIX, ii + 1),
        invoice_number: 'TEST-INV-2025-' + String(ii + 1).padStart(4, '0'),
        organisation_id: orgs[ii].id,
        invoice_date: new Date(Date.now() - (30 - ii * 3) * 86400000).toISOString().split('T')[0],
        due_date: new Date(Date.now() + (ii * 7 - 14) * 86400000).toISOString().split('T')[0],
        status: invStatuses[ii],
        payment_status: payStatuses[ii],
        invoice_type: types[ii],
        total_amount: amounts[ii],
        paid_amount: payStatuses[ii] === 'paid' ? amounts[ii] : 0,
        balance_due: payStatuses[ii] === 'paid' ? 0 : amounts[ii],
        currency: 'GBP',
        notes: '[TEST MODE] Invoice #' + (ii + 1) + ' for ' + types[ii]
      });
    }
    var invResult = await this._safeWrite('invoices', invoices, 'Invoices', 'upsert');
    this._logErr('Invoices', invResult.error);

    // Line items
    var lineItems = [];
    for (var li = 0; li < invoices.length; li++) {
      var inv = invoices[li];
      if (inv.invoice_type === 'package') {
        lineItems.push(
          { invoice_id: inv.id, item_name: 'Awards Package', quantity: 1, unit_price: inv.total_amount * 0.8, line_total: inv.total_amount * 0.8 },
          { invoice_id: inv.id, item_name: 'Additional Guest Tickets', quantity: Math.ceil(inv.total_amount * 0.2 / 50), unit_price: 50, line_total: inv.total_amount * 0.2 }
        );
      } else if (inv.invoice_type === 'entry_fee') {
        lineItems.push({ invoice_id: inv.id, item_name: 'Award Entry Fee', quantity: 1, unit_price: inv.total_amount, line_total: inv.total_amount });
      } else {
        lineItems.push({ invoice_id: inv.id, item_name: 'Sponsorship Package', quantity: 1, unit_price: inv.total_amount, line_total: inv.total_amount });
      }
    }
    for (var dli = 0; dli < invoices.length; dli++) {
      try { await STATE.client.from('invoice_line_items').delete().eq('invoice_id', invoices[dli].id); } catch(e3) {}
    }
    var liResult = await this._safeWrite('invoice_line_items', lineItems, 'Line items', 'insert');
    this._logErr('Line items', liResult.error);

    // Payments for paid invoices
    var paidInvoices = invoices.filter(function(inv) { return inv.payment_status === 'paid'; });
    var payments = paidInvoices.map(function(inv, i) {
      return {
        id: testDataManager.uid(testDataManager.PAYMENT_PREFIX, i + 1),
        payment_reference: 'TEST-PAY-2025-' + String(i + 1).padStart(4, '0'),
        invoice_id: inv.id,
        organisation_id: inv.organisation_id,
        payment_date: new Date(Date.now() - (10 - i * 2) * 86400000).toISOString().split('T')[0],
        amount: inv.total_amount,
        payment_method: ['bank_transfer', 'card', 'stripe'][i % 3],
        status: 'completed',
        notes: '[TEST MODE] Payment for ' + inv.invoice_number
      };
    });
    var payResult = await this._safeWrite('payments', payments, 'Payments', 'upsert');
    this._logErr('Payments', payResult.error);
  },

  /**
   * Generate Media Gallery data
   */
  async generateMediaData(eventId, orgs, awards) {
    var galleries = [
      { id: this.uid(this.GALLERY_PREFIX, 1), event_id: eventId, gallery_name: 'TEST_MODE_Awards Ceremony', gallery_description: 'Photos from the main ceremony', display_order: 1 },
      { id: this.uid(this.GALLERY_PREFIX, 2), event_id: eventId, gallery_name: 'TEST_MODE_Winners Collection', gallery_description: 'Winner announcement photos', display_order: 2 }
    ];
    var galResult = await this._safeWrite('event_galleries', galleries, 'Galleries', 'upsert');
    this._logErr('Galleries', galResult.error);

    var mediaItems = [];
    for (var mi = 0; mi < 10; mi++) {
      mediaItems.push({
        id: this.uid(this.MEDIA_ITEM_PREFIX, mi + 1),
        event_id: eventId,
        media_type: mi < 8 ? 'image' : 'video',
        title: 'TEST_MODE_Photo ' + (mi + 1),
        description: 'Test media item ' + (mi + 1) + ' from the awards ceremony',
        organisation_id: orgs[mi].id,
        award_id: awards[mi % 10].id,
        published: mi < 7,
        display_order: mi + 1
      });
    }
    var miResult = await this._safeWrite('media_items', mediaItems, 'Media items', 'upsert');
    this._logErr('Media items', miResult.error);

    var mediaGallery = [];
    for (var mg = 0; mg < 8; mg++) {
      mediaGallery.push({
        id: this.uid(this.MEDIA_GAL_PREFIX, mg + 1),
        gallery_section_id: galleries[mg < 4 ? 0 : 1].id,
        file_url: 'https://placehold.co/800x600?text=Award+Photo+' + (mg + 1),
        file_type: 'image/jpeg',
        organisation_id: orgs[mg].id,
        award_id: awards[mg % 10].id,
        title: 'TEST_MODE_Gallery Photo ' + (mg + 1),
        caption: 'Winner photo ' + (mg + 1) + ' from the awards ceremony',
        photographer: 'Test Photographer',
        published: true,
        display_order: mg + 1,
        show_in_gallery: true,
        show_on_winner_page: mg < 5,
        show_on_company_page: true
      });
    }
    var mgResult = await this._safeWrite('media_gallery', mediaGallery, 'Media gallery', 'upsert');
    this._logErr('Media gallery', mgResult.error);
  },

  /**
   * Generate Running Order for the test event
   */
  async generateRunningOrder(eventId, awards, orgs, winnerOrgIndices) {
    var runningOrder = [];
    for (var ro = 0; ro < 10; ro++) {
      var winnerOrgIdx = winnerOrgIndices[ro][0];
      runningOrder.push({
        id: this.uid(this.RUNNING_PREFIX, ro + 1),
        event_id: eventId,
        organisation_id: this.uid(this.ORG_PREFIX, winnerOrgIdx),
        award_id: awards[ro].id,
        display_name: orgs[winnerOrgIdx - 1].company_name.replace('TEST_MODE_', ''),
        award_name: awards[ro].award_name.replace('TEST_MODE_', ''),
        award_number: '1-' + String(ro + 1).padStart(2, '0'),
        display_order: ro + 1,
        section: 1,
        status: ro < 3 ? 'completed' : (ro < 6 ? 'announced' : 'pending'),
        duration_minutes: 5,
        notes: ro === 0 ? 'Opening award - extra time for speech' : null
      });
    }
    try { await STATE.client.from('running_order').delete().eq('event_id', eventId); } catch(e2) {}
    var roResult = await this._safeWrite('running_order', runningOrder, 'Running order', 'insert');
    this._logErr('Running order', roResult.error);

    // Running order settings
    var rosResult = await this._safeWrite('running_order_settings', {
      id: this.uid(this.RUNNING_PREFIX, 99),
      event_id: eventId,
      settings: { time_per_award: 5, break_after: 5, ceremony_type: 'formal' },
      is_published: false
    }, 'Running order settings', 'upsert');
    this._logErr('Running order settings', rosResult.error);
  },

  /**
   * Seed counties reference data if table is empty
   */
  async seedCounties() {
    var { count } = await STATE.client.from('counties').select('*', { count: 'exact', head: true });
    if (count && count > 0) return; // already seeded

    var counties = [
      { "Name": 'Greater London', region: 'London' },
      { "Name": 'Greater Manchester', region: 'North West' },
      { "Name": 'West Midlands', region: 'West Midlands' },
      { "Name": 'West Yorkshire', region: 'Yorkshire' },
      { "Name": 'South Yorkshire', region: 'Yorkshire' },
      { "Name": 'Surrey', region: 'South East' },
      { "Name": 'Kent', region: 'South East' },
      { "Name": 'Essex', region: 'East of England' },
      { "Name": 'Hampshire', region: 'South East' },
      { "Name": 'Lancashire', region: 'North West' },
      { "Name": 'Merseyside', region: 'North West' },
      { "Name": 'Tyne and Wear', region: 'North East' },
      { "Name": 'Nottinghamshire', region: 'East Midlands' },
      { "Name": 'Derbyshire', region: 'East Midlands' },
      { "Name": 'Devon', region: 'South West' },
      { "Name": 'Bristol', region: 'South West' },
      { "Name": 'Somerset', region: 'South West' },
      { "Name": 'Norfolk', region: 'East of England' },
      { "Name": 'Suffolk', region: 'East of England' },
      { "Name": 'Oxfordshire', region: 'South East' },
      { "Name": 'Cambridgeshire', region: 'East of England' },
      { "Name": 'Warwickshire', region: 'West Midlands' },
      { "Name": 'Staffordshire', region: 'West Midlands' },
      { "Name": 'Edinburgh', region: 'Scotland' },
      { "Name": 'Glasgow', region: 'Scotland' },
      { "Name": 'Cardiff', region: 'Wales' },
      { "Name": 'Swansea', region: 'Wales' },
      { "Name": 'Belfast', region: 'Northern Ireland' },
      { "Name": 'Antrim', region: 'Northern Ireland' },
      { "Name": 'Berkshire', region: 'South East' }
    ];
    var countyResult = await this._safeWrite('counties', counties, 'Counties seed', 'insert');
    if (this._logErr('Counties seed', countyResult.error)) return;
    console.log('Seeded 30 counties for region/county filtering');
  },

  /**
   * Generate event attendees, ticket types, and tickets
   */
  async generateEventExtras(eventId, orgs) {
    // Event attendees (20 attendees with varied check-in statuses)
    var guestTypes = ['vip', 'guest', 'sponsor', 'media', 'staff'];
    var mealPrefs = ['standard', 'vegetarian', 'vegan', 'halal', 'gluten-free'];
    var attendees = [];
    for (var i = 0; i < 20; i++) {
      attendees.push({
        id: this.uid(this.ATTENDEE_PREFIX, i + 1),
        event_id: eventId,
        attendee_name: orgs[i].contact_name || ('Attendee ' + (i + 1)),
        attendee_email: orgs[i].email,
        organisation_id: orgs[i].id,
        table_number: Math.floor(i / 4) + 1,
        meal_preference: mealPrefs[i % 5],
        rsvp_status: i < 15 ? 'confirmed' : (i < 18 ? 'pending' : 'declined'),
        guest_type: guestTypes[i % 5],
        plus_ones: i % 4 === 0 ? 1 : 0,
        checked_in: i < 8,
        check_in_time: i < 8 ? new Date(Date.now() - (20 - i) * 60000).toISOString() : null,
        notes: i === 0 ? 'VIP - ensure table 1 placement' : null
      });
    }
    try { await STATE.client.from('event_attendees').delete().eq('event_id', eventId); } catch(e2) {}
    var attResult = await this._safeWrite('event_attendees', attendees, 'Attendees', 'insert');
    this._logErr('Attendees', attResult.error);

    // Ticket types (3 types)
    var ticketTypes = [
      { id: this.uid(this.TICKET_TYPE_PREFIX, 1), event_id: eventId, name: 'TEST_MODE_Standard Ticket', description: 'General admission with dinner', price: 150.00, quantity: 200, sold: 142, early_bird_price: 120.00, includes_table: false, is_active: true },
      { id: this.uid(this.TICKET_TYPE_PREFIX, 2), event_id: eventId, name: 'TEST_MODE_VIP Table (10)', description: 'Premium table of 10 with champagne reception', price: 2000.00, quantity: 20, sold: 15, early_bird_price: 1750.00, includes_table: true, table_size: 10, is_active: true },
      { id: this.uid(this.TICKET_TYPE_PREFIX, 3), event_id: eventId, name: 'TEST_MODE_Corporate Package', description: 'Branding, 2 tables, sponsor recognition', price: 5000.00, quantity: 10, sold: 4, includes_table: true, table_size: 10, is_active: true }
    ];
    var ttResult = await this._safeWrite('event_ticket_types', ticketTypes, 'Ticket types', 'upsert');
    this._logErr('Ticket types', ttResult.error);
  },

  /**
   * Generate email templates, email lists, subscribers, social media posts
   */
  async generateMarketingExtras(awards, orgs) {
    // Email templates (5 templates for different use cases)
    var templates = [
      { id: this.uid(this.TEMPLATE_PREFIX, 1), name: 'TEST_MODE_Entry Confirmation', subject: 'Your award entry has been received', body: '<h2>Thank you for your entry!</h2><p>We have received your submission for {{award_name}}. Your entry number is {{entry_number}}.</p><p>We will be in touch with updates as the judging process progresses.</p>', description: 'Sent when a new entry is submitted', is_active: true, is_default: true },
      { id: this.uid(this.TEMPLATE_PREFIX, 2), name: 'TEST_MODE_Shortlist Notification', subject: 'Congratulations! You have been shortlisted', body: '<h2>Congratulations {{company_name}}!</h2><p>We are delighted to inform you that your entry for {{award_name}} has been shortlisted.</p><p>The winners will be announced at the Awards Gala on {{event_date}}.</p>', description: 'Sent to shortlisted entrants', is_active: true },
      { id: this.uid(this.TEMPLATE_PREFIX, 3), name: 'TEST_MODE_Invoice Reminder', subject: 'Payment reminder - Invoice {{invoice_number}}', body: '<h2>Payment Reminder</h2><p>This is a reminder that invoice {{invoice_number}} for {{total_amount}} is due on {{due_date}}.</p><p>Please arrange payment at your earliest convenience.</p>', description: 'Sent for overdue invoices', is_active: true },
      { id: this.uid(this.TEMPLATE_PREFIX, 4), name: 'TEST_MODE_Event Invitation', subject: 'You are invited to the Awards Gala!', body: '<h2>You are invited!</h2><p>We would be honoured to welcome {{company_name}} to the Awards Gala on {{event_date}} at {{venue}}.</p><p>Please RSVP by clicking the link below.</p>', description: 'Event invitation email', is_active: true },
      { id: this.uid(this.TEMPLATE_PREFIX, 5), name: 'TEST_MODE_Winner Announcement', subject: 'And the winner is...', body: '<h2>Winner Announcement</h2><p>We are thrilled to announce the winners of this year\'s awards!</p><p>{{winner_list}}</p><p>Congratulations to all our winners and finalists.</p>', description: 'Public winner announcement', is_active: false }
    ];
    var tplResult = await this._safeWrite('email_templates', templates, 'Email templates', 'upsert');
    this._logErr('Email templates', tplResult.error);

    // Email lists (3 lists)
    var emailLists = [
      { id: this.uid(this.EMAIL_LIST_PREFIX, 1), list_name: 'TEST_MODE_All Entrants 2025', list_type: 'entrants', is_active: true, color: '#007bff', icon: 'bi-file-earmark-text', description: 'All organisations that submitted entries in 2025', subscriber_count: 15, active_subscriber_count: 14 },
      { id: this.uid(this.EMAIL_LIST_PREFIX, 2), list_name: 'TEST_MODE_Sponsors & Partners', list_type: 'sponsors', is_active: true, color: '#28a745', icon: 'bi-star', description: 'Current sponsors and strategic partners', subscriber_count: 8, active_subscriber_count: 8 },
      { id: this.uid(this.EMAIL_LIST_PREFIX, 3), list_name: 'TEST_MODE_Event Guests', list_type: 'general', is_active: true, color: '#6f42c1', icon: 'bi-calendar-event', description: 'Invited guests for the awards ceremony', subscriber_count: 20, active_subscriber_count: 18 }
    ];
    var listResult = await this._safeWrite('email_lists', emailLists, 'Email lists', 'upsert');
    this._logErr('Email lists', listResult.error);

    // Email list subscribers (populate lists with org data)
    var subscribers = [];
    for (var sl = 0; sl < Math.min(15, orgs.length); sl++) {
      subscribers.push({
        list_id: emailLists[0].id,
        email: orgs[sl].email,
        first_name: 'Contact',
        last_name: orgs[sl].company_name.replace('TEST_MODE_', ''),
        company_name: orgs[sl].company_name.replace('TEST_MODE_', ''),
        status: sl < 14 ? 'active' : 'unsubscribed',
        source: 'entry_submission'
      });
    }
    for (var ss = 0; ss < 5; ss++) {
      subscribers.push({
        list_id: emailLists[1].id,
        email: 'sponsor' + (ss + 1) + '@example.com',
        first_name: ['Sarah', 'James', 'Emma', 'Tom', 'Lisa'][ss],
        last_name: ['Platinum', 'Gold', 'Silver', 'Bronze', 'Partner'][ss],
        company_name: ['Platinum Corp', 'Gold Industries', 'Silver Solutions', 'Bronze Partners', 'Community Partner'][ss],
        status: 'active',
        source: 'manual'
      });
    }
    // Clear existing test subscribers
    for (var dl = 0; dl < emailLists.length; dl++) {
      try { await STATE.client.from('email_list_subscribers').delete().eq('list_id', emailLists[dl].id); } catch(e3) {}
    }
    var subResult = await this._safeWrite('email_list_subscribers', subscribers, 'Email subscribers', 'insert');
    this._logErr('Email subscribers', subResult.error);

    // Social media posts (6 posts across different statuses)
    var socialPosts = [
      { id: this.uid(this.SOCIAL_PREFIX, 1), company_id: orgs[0].id, award_id: awards[0].id, content: 'Congratulations to TEST_MODE_Acme Corporation for winning Best Innovation! #Awards2025', template_type: 'winner_announcement', platforms: ['twitter', 'linkedin'], status: 'published', scheduled_for: new Date(Date.now() - 7 * 86400000).toISOString() },
      { id: this.uid(this.SOCIAL_PREFIX, 2), company_id: orgs[1].id, award_id: awards[1].id, content: 'Meet our Rising Star finalist: TEST_MODE_Global Dynamics Ltd! #Awards2025 #RisingStar', template_type: 'finalist_spotlight', platforms: ['twitter', 'facebook', 'instagram'], status: 'published', scheduled_for: new Date(Date.now() - 5 * 86400000).toISOString() },
      { id: this.uid(this.SOCIAL_PREFIX, 3), content: 'Entries are now open for the 2025 Awards! Submit yours today. #Awards2025 #EnterNow', template_type: 'call_for_entries', platforms: ['twitter', 'linkedin', 'facebook'], status: 'scheduled', scheduled_for: new Date(Date.now() + 2 * 86400000).toISOString() },
      { id: this.uid(this.SOCIAL_PREFIX, 4), content: 'Only 2 weeks until the Awards Gala! Have you got your tickets? #Awards2025 #Countdown', template_type: 'event_promotion', platforms: ['twitter', 'instagram'], status: 'scheduled', scheduled_for: new Date(Date.now() + 5 * 86400000).toISOString() },
      { id: this.uid(this.SOCIAL_PREFIX, 5), company_id: orgs[3].id, award_id: awards[3].id, content: 'TEST_MODE_Green Energy Co leads the way in sustainability. Read their story. #GreenBusiness', template_type: 'finalist_spotlight', platforms: ['linkedin'], status: 'draft' },
      { id: this.uid(this.SOCIAL_PREFIX, 6), content: 'Thank you to all our sponsors for making the 2025 Awards possible! #ThankYou #Awards2025', template_type: 'sponsor_thanks', platforms: ['twitter', 'linkedin', 'facebook', 'instagram'], status: 'draft' }
    ];
    var socialResult = await this._safeWrite('social_media_posts', socialPosts, 'Social media posts', 'upsert');
    this._logErr('Social media posts', socialResult.error);
  },

  /**
   * Generate CRM follow-ups and scheduled reports
   */
  async generateExtras(orgs) {
    // Organisation follow-ups (CRM > My Tasks)
    var followUps = [
      { id: this.uid(this.FOLLOWUP_PREFIX, 1), organisation_id: orgs[0].id, company_name: orgs[0].company_name, follow_up_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0], note: 'TEST_MODE_Follow up on platinum sponsorship proposal', completed: false, created_by: 'admin@example.com' },
      { id: this.uid(this.FOLLOWUP_PREFIX, 2), organisation_id: orgs[2].id, company_name: orgs[2].company_name, follow_up_date: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0], note: 'TEST_MODE_Chase outstanding entry submission', completed: false, created_by: 'admin@example.com' },
      { id: this.uid(this.FOLLOWUP_PREFIX, 3), organisation_id: orgs[4].id, company_name: orgs[4].company_name, follow_up_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], note: 'TEST_MODE_Discuss event table requirements', completed: false, created_by: 'admin@example.com' },
      { id: this.uid(this.FOLLOWUP_PREFIX, 4), organisation_id: orgs[7].id, company_name: orgs[7].company_name, follow_up_date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0], note: 'TEST_MODE_Send revised invoice for package upgrade', completed: true, completed_at: new Date().toISOString(), created_by: 'admin@example.com' },
      { id: this.uid(this.FOLLOWUP_PREFIX, 5), organisation_id: orgs[9].id, company_name: orgs[9].company_name, follow_up_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0], note: 'TEST_MODE_Book photography session for winner profile', completed: false, created_by: 'admin@example.com' }
    ];
    var fuResult = await this._safeWrite('organisation_follow_ups', followUps, 'Follow-ups', 'upsert');
    this._logErr('Follow-ups', fuResult.error);

    // Scheduled reports (Reports tab)
    var reports = [
      { id: this.uid(this.REPORT_PREFIX, 1), name: 'TEST_MODE_Weekly Entry Summary', report_type: 'entries', frequency: 'weekly', recipients: ['admin@example.com'], sections: ['entry_stats', 'status_breakdown'], is_active: true, next_run_at: new Date(Date.now() + 7 * 86400000).toISOString(), created_by: 'admin@example.com' },
      { id: this.uid(this.REPORT_PREFIX, 2), name: 'TEST_MODE_Monthly Financial Report', report_type: 'financial', frequency: 'monthly', recipients: ['admin@example.com', 'finance@example.com'], sections: ['revenue', 'payments', 'overdue'], is_active: true, next_run_at: new Date(Date.now() + 30 * 86400000).toISOString(), created_by: 'admin@example.com' },
      { id: this.uid(this.REPORT_PREFIX, 3), name: 'TEST_MODE_Judge Scoring Progress', report_type: 'judging', frequency: 'daily', recipients: ['admin@example.com'], sections: ['judge_progress', 'score_distribution'], is_active: false, created_by: 'admin@example.com' }
    ];
    var repResult = await this._safeWrite('scheduled_reports', reports, 'Scheduled reports', 'upsert');
    this._logErr('Scheduled reports', repResult.error);
  },

  /**
   * Remove Test Data
   */
  async removeTestData() {
    var confirmResult = await this.showConfirmDialog(
      'Remove All Test Data',
      'This will permanently delete <strong>all</strong> test data including:<br>' +
      '<ul>' +
      '<li>Test event, RSVPs, attendees, tickets, running order, table plan</li>' +
      '<li>Test organisations, contacts, and follow-ups</li>' +
      '<li>Test awards and award assignments</li>' +
      '<li>Test entries, judge scores, public votes</li>' +
      '<li>Test invoices, payments, line items</li>' +
      '<li>Test sponsors, banners, email templates, email lists, social media posts</li>' +
      '<li>Test CRM data (communications, deals, meetings, segments)</li>' +
      '<li>Test media gallery items and scheduled reports</li>' +
      '</ul>' +
      '<strong>This action cannot be undone!</strong>',
      'Delete All Test Data',
      'danger'
    );

    if (!confirmResult) return;

    try {
      utils.showLoading();
      var eventId = this.EVENT_ID;

      // Get test org IDs
      var { data: testOrgs } = await STATE.client
        .from('organisations').select('id').like('company_name', 'TEST_MODE_%');
      var orgIds = (testOrgs || []).map(function(o) { return o.id; });

      // Get test award IDs
      var { data: testAwards } = await STATE.client
        .from('award_years').select('id').like('award_name', 'TEST_MODE_%');
      var awardIds = (testAwards || []).map(function(a) { return a.id; });

      // Get test entry IDs
      var { data: testEntries } = await STATE.client
        .from('entries').select('id').like('entry_number', 'TEST-ENT-%');
      var entryIds = (testEntries || []).map(function(e) { return e.id; });

      utils.showToast('Removing test data...', 'info');
      var self = this;

      // ---- NEW TABLES (added for full coverage) ----
      // Each delete is wrapped in _safeDel so one missing table won't stop the rest

      await self._safeDel(STATE.client.from('scheduled_reports').delete().like('name', 'TEST_MODE_%'));
      await self._safeDel(STATE.client.from('organisation_follow_ups').delete().like('note', 'TEST_MODE_%'));
      if (orgIds.length > 0) {
        await self._safeDel(STATE.client.from('organisation_follow_ups').delete().in('organisation_id', orgIds));
      }
      await self._safeDel(STATE.client.from('social_media_posts').delete().like('content', '%TEST_MODE_%'));
      if (orgIds.length > 0) {
        await self._safeDel(STATE.client.from('social_media_posts').delete().in('company_id', orgIds));
      }

      // D. Email list subscribers (must be before email lists)
      try {
        var { data: testLists } = await STATE.client
          .from('email_lists').select('id').like('list_name', 'TEST_MODE_%');
        if (testLists && testLists.length > 0) {
          for (var els = 0; els < testLists.length; els++) {
            await self._safeDel(STATE.client.from('email_list_subscribers').delete().eq('list_id', testLists[els].id));
          }
        }
      } catch(e3) { console.warn('Cleanup skip: email_list_subscribers', e3.message); }

      await self._safeDel(STATE.client.from('email_lists').delete().like('list_name', 'TEST_MODE_%'));
      await self._safeDel(STATE.client.from('email_templates').delete().like('name', 'TEST_MODE_%'));
      await self._safeDel(STATE.client.from('event_tickets').delete().eq('event_id', eventId));
      await self._safeDel(STATE.client.from('event_ticket_types').delete().eq('event_id', eventId));
      await self._safeDel(STATE.client.from('event_attendees').delete().eq('event_id', eventId));

      // ---- ORIGINAL TABLES ----

      for (var pv = 0; pv < entryIds.length; pv++) {
        await self._safeDel(STATE.client.from('public_votes').delete().eq('entry_id', entryIds[pv]));
      }
      for (var js = 0; js < entryIds.length; js++) {
        await self._safeDel(STATE.client.from('judge_scores').delete().eq('entry_id', entryIds[js]));
      }
      await self._safeDel(STATE.client.from('entries').delete().like('entry_number', 'TEST-ENT-%'));

      try {
        var { data: testSegs } = await STATE.client
          .from('contact_segments').select('id').like('segment_name', 'TEST_MODE_%');
        if (testSegs && testSegs.length > 0) {
          for (var os = 0; os < testSegs.length; os++) {
            await self._safeDel(STATE.client.from('organisation_segments').delete().eq('segment_id', testSegs[os].id));
          }
        }
      } catch(e3) { console.warn('Cleanup skip: organisation_segments', e3.message); }

      await self._safeDel(STATE.client.from('contact_segments').delete().like('segment_name', 'TEST_MODE_%'));
      await self._safeDel(STATE.client.from('meeting_notes').delete().like('subject', 'TEST_MODE_%'));
      if (orgIds.length > 0) {
        await self._safeDel(STATE.client.from('meeting_notes').delete().in('organisation_id', orgIds));
      }
      await self._safeDel(STATE.client.from('communications').delete().like('subject', 'TEST_MODE_%'));
      if (orgIds.length > 0) {
        await self._safeDel(STATE.client.from('communications').delete().in('organisation_id', orgIds));
      }
      await self._safeDel(STATE.client.from('deals').delete().like('title', 'TEST_MODE_%'));
      if (orgIds.length > 0) {
        await self._safeDel(STATE.client.from('deals').delete().in('organisation_id', orgIds));
      }

      // 9. Organisation contacts
      if (orgIds.length > 0) {
        await self._safeDel(STATE.client.from('organisation_contacts').delete().in('organisation_id', orgIds));
      }

      // 10. Payments
      await self._safeDel(STATE.client.from('payments').delete().like('payment_reference', 'TEST-PAY-%'));

      // 11. Invoice line items
      try {
        var { data: testInvoices } = await STATE.client
          .from('invoices').select('id').like('invoice_number', 'TEST-INV-%');
        if (testInvoices && testInvoices.length > 0) {
          for (var il = 0; il < testInvoices.length; il++) {
            await self._safeDel(STATE.client.from('invoice_line_items').delete().eq('invoice_id', testInvoices[il].id));
          }
        }
      } catch(e3) { console.warn('Cleanup skip: invoice_line_items', e3.message); }

      await self._safeDel(STATE.client.from('invoices').delete().like('invoice_number', 'TEST-INV-%'));
      await self._safeDel(STATE.client.from('sponsors').delete().like('name', 'TEST_MODE_%'));
      await self._safeDel(STATE.client.from('banners').delete().like('title', 'TEST_MODE_%'));
      await self._safeDel(STATE.client.from('media_gallery').delete().like('title', 'TEST_MODE_%'));
      if (orgIds.length > 0) {
        await self._safeDel(STATE.client.from('media_gallery').delete().in('organisation_id', orgIds));
      }
      await self._safeDel(STATE.client.from('media_items').delete().like('title', 'TEST_MODE_%'));
      await self._safeDel(STATE.client.from('media_items').delete().eq('event_id', eventId));
      await self._safeDel(STATE.client.from('event_galleries').delete().like('gallery_name', 'TEST_MODE_%'));
      await self._safeDel(STATE.client.from('event_galleries').delete().eq('event_id', eventId));
      await self._safeDel(STATE.client.from('table_assignments').delete().eq('event_id', eventId));
      await self._safeDel(STATE.client.from('event_tables').delete().eq('event_id', eventId));
      await self._safeDel(STATE.client.from('running_order').delete().eq('event_id', eventId));
      await self._safeDel(STATE.client.from('running_order_settings').delete().eq('event_id', eventId));
      await self._safeDel(STATE.client.from('event_guests').delete().eq('event_id', eventId));

      if (awardIds.length > 0) {
        await self._safeDel(STATE.client.from('award_assignments').delete().in('award_id', awardIds));
      }
      if (orgIds.length > 0) {
        await self._safeDel(STATE.client.from('award_assignments').delete().in('organisation_id', orgIds));
      }
      if (awardIds.length > 0) {
        await self._safeDel(STATE.client.from('winners').delete().in('award_id', awardIds));
      }
      if (orgIds.length > 0) {
        await self._safeDel(STATE.client.from('winners').delete().in('organisation_id', orgIds));
      }

      await self._safeDel(STATE.client.from('organisations').delete().like('company_name', 'TEST_MODE_%'));
      await self._safeDel(STATE.client.from('award_years').delete().like('award_name', 'TEST_MODE_%'));
      await self._safeDel(STATE.client.from('events').delete().eq('id', eventId));

      utils.showToast('All test data removed successfully!', 'success');

      setTimeout(function() {
        testDataManager.showModal('Test Data Removed',
          '<div class="alert alert-success">' +
          '<h6><i class="bi bi-check-circle me-2"></i>Cleanup Complete</h6>' +
          '<p class="mb-0">All test data has been removed from every tab.</p>' +
          '</div>' +
          '<p class="mt-3">Click "Reload Page" to refresh all views.</p>',
          true);
      }, 500);

    } catch (error) {
      console.error('Error removing test data:', error);
      utils.showToast('Some test data may not have been removed. Check console for details.', 'warning');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Show Test Data Info
   */
  async showTestDataInfo() {
    try {
      utils.showLoading();

      var results = await Promise.all([
        STATE.client.from('events').select('*').eq('id', this.EVENT_ID).single(),
        STATE.client.from('organisations').select('*', { count: 'exact', head: true }).like('company_name', 'TEST_MODE_%'),
        STATE.client.from('awards').select('*', { count: 'exact', head: true }).like('award_name', 'TEST_MODE_%'),
        STATE.client.from('event_guests').select('*', { count: 'exact', head: true }).eq('event_id', this.EVENT_ID),
        STATE.client.from('entries').select('*', { count: 'exact', head: true }).like('entry_number', 'TEST-ENT-%'),
        STATE.client.from('sponsors').select('*', { count: 'exact', head: true }).like('name', 'TEST_MODE_%'),
        STATE.client.from('banners').select('*', { count: 'exact', head: true }).like('title', 'TEST_MODE_%'),
        STATE.client.from('invoices').select('*', { count: 'exact', head: true }).like('invoice_number', 'TEST-INV-%'),
        STATE.client.from('organisation_contacts').select('*', { count: 'exact', head: true }).like('id', testDataManager.CONTACT_PREFIX + '%'),
        STATE.client.from('deals').select('*', { count: 'exact', head: true }).like('title', 'TEST_MODE_%'),
        STATE.client.from('communications').select('*', { count: 'exact', head: true }).like('subject', 'TEST_MODE_%')
      ]);

      var testEvent = results[0].data;
      var orgCount = results[1].count;
      var awardCount = results[2].count;
      var rsvpCount = results[3].count;
      var entryCount = results[4].count;
      var sponsorCount = results[5].count;
      var bannerCount = results[6].count;
      var invoiceCount = results[7].count;
      var contactCount = results[8].count;
      var dealCount = results[9].count;
      var commCount = results[10].count;

      var hasTestData = testEvent || orgCount > 0 || awardCount > 0;

      var message = '';
      if (hasTestData) {
        message =
          '<div class="alert alert-info">' +
          '<h6><i class="bi bi-info-circle me-2"></i>Test Data Active</h6>' +
          '<p class="mb-0">Comprehensive test data is loaded across all tabs.</p>' +
          '</div>' +
          '<div class="row mt-3">' +
          '<div class="col-md-6">' +
          '<h6>Core Data</h6>' +
          '<ul class="mb-2">' +
          '<li>Test Event: ' + (testEvent ? '<strong>Yes</strong>' : 'No') + '</li>' +
          '<li>Organisations: <strong>' + (orgCount || 0) + '</strong></li>' +
          '<li>Awards: <strong>' + (awardCount || 0) + '</strong></li>' +
          '<li>RSVPs: <strong>' + (rsvpCount || 0) + '</strong></li>' +
          '</ul></div>' +
          '<div class="col-md-6">' +
          '<h6>Extended Data</h6>' +
          '<ul class="mb-2">' +
          '<li>Entries: <strong>' + (entryCount || 0) + '</strong></li>' +
          '<li>Invoices: <strong>' + (invoiceCount || 0) + '</strong></li>' +
          '<li>Sponsors: <strong>' + (sponsorCount || 0) + '</strong></li>' +
          '<li>Banners: <strong>' + (bannerCount || 0) + '</strong></li>' +
          '</ul></div></div>' +
          '<div class="row">' +
          '<div class="col-md-6">' +
          '<h6>CRM Data</h6>' +
          '<ul class="mb-2">' +
          '<li>Contacts: <strong>' + (contactCount || 0) + '</strong></li>' +
          '<li>Deals: <strong>' + (dealCount || 0) + '</strong></li>' +
          '<li>Communications: <strong>' + (commCount || 0) + '</strong></li>' +
          '</ul></div>' +
          '<div class="col-md-6">' +
          '<h6>Tabs Covered</h6>' +
          '<ul class="mb-2">' +
          '<li>Dashboard, Awards, Organisations</li>' +
          '<li>Winners, Entries, Media Gallery</li>' +
          '<li>Events, Reports, Marketing</li>' +
          '<li>Payments, CRM</li>' +
          '</ul></div></div>' +
          '<p class="mt-2"><strong>All test data uses "TEST_MODE_" prefix</strong> for easy identification.</p>';
      } else {
        message =
          '<div class="alert alert-warning">' +
          '<h6><i class="bi bi-exclamation-triangle me-2"></i>No Test Data Found</h6>' +
          '<p class="mb-0">Click "Generate Test Data" to populate all tabs with mock data.</p>' +
          '</div>' +
          '<p class="mt-3"><strong>Test data will cover every tab:</strong></p>' +
          '<ul>' +
          '<li>1 test event with RSVPs and running order</li>' +
          '<li>10 award categories with 30 winners</li>' +
          '<li>30 organisations with contacts</li>' +
          '<li>20 entries with judge scores and public votes</li>' +
          '<li>8 invoices with payments</li>' +
          '<li>5 sponsors and 4 banners</li>' +
          '<li>CRM data: deals, communications, meetings, segments</li>' +
          '<li>Media galleries with photos</li>' +
          '</ul>';
      }

      this.showModal('Test Data Information', message);

    } catch (error) {
      console.error('Error checking test data:', error);
      utils.showToast('Error checking test data', 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Show info modal after generation
   */
  showInfoModal() {
    var message =
      '<div class="alert alert-success">' +
      '<h6><i class="bi bi-check-circle me-2"></i>Test Data Created!</h6>' +
      '<p class="mb-0">Comprehensive test data has been generated for <strong>all tabs</strong>.</p>' +
      '</div>' +
      '<p class="mt-3"><strong>What has been created:</strong></p>' +
      '<div class="row"><div class="col-md-6"><ul>' +
      '<li>1 test event with RSVPs + 20 attendees</li>' +
      '<li>10 award categories + counties data</li>' +
      '<li>30 organisations with contacts</li>' +
      '<li>30 award winners + 10 in winners table</li>' +
      '<li>20 entries (varied statuses)</li>' +
      '<li>Judge scores + public votes</li>' +
      '<li>5 email templates + 3 email lists</li>' +
      '</ul></div><div class="col-md-6"><ul>' +
      '<li>5 sponsors + 4 banners</li>' +
      '<li>8 invoices + payments</li>' +
      '<li>6 CRM deals + 10 communications</li>' +
      '<li>4 meeting notes + 3 segments + 5 follow-ups</li>' +
      '<li>2 galleries + 10 media items</li>' +
      '<li>Running order + 3 ticket types</li>' +
      '<li>6 social media posts + 3 scheduled reports</li>' +
      '</ul></div></div>' +
      '<p class="mt-3"><strong>Try every tab:</strong></p>' +
      '<ol>' +
      '<li><strong>Dashboard</strong> - Aggregated stats and charts</li>' +
      '<li><strong>Awards</strong> - 10 categories with county/region filters</li>' +
      '<li><strong>Organisations</strong> - 30 companies with details</li>' +
      '<li><strong>Winners</strong> - Award assignments and scores</li>' +
      '<li><strong>Entries</strong> - Draft, submitted, reviewed, shortlisted, winner, rejected</li>' +
      '<li><strong>Media Gallery</strong> - Photos in 2 galleries</li>' +
      '<li><strong>Events</strong> - Attendees, tickets, running order, RSVPs</li>' +
      '<li><strong>Reports</strong> - Scheduled reports + financial, entry, judging data</li>' +
      '<li><strong>Marketing</strong> - Sponsors, banners, email templates, lists, social media</li>' +
      '<li><strong>Payments</strong> - Invoices, line items, and payment records</li>' +
      '<li><strong>CRM</strong> - Contacts, deals, comms, meetings, segments, follow-ups</li>' +
      '</ol>' +
      '<hr>' +
      '<p class="text-muted small mb-0">' +
      '<strong>Note:</strong> When done testing, click "Test Mode -> Remove Test Data" to clean up everything.' +
      '</p>';

    this.showModal('Test Data Ready', message, true);
  },

  /**
   * Show manual instructions modal
   */
  showManualInstructionsModal() {
    var message =
      '<div class="alert alert-warning">' +
      '<h6><i class="bi bi-exclamation-triangle me-2"></i>Manual Setup Required</h6>' +
      '<p class="mb-0">Please run the SQL script manually in Supabase.</p>' +
      '</div>' +
      '<p class="mt-3"><strong>Instructions:</strong></p>' +
      '<ol>' +
      '<li>Open your Supabase Dashboard</li>' +
      '<li>Go to SQL Editor</li>' +
      '<li>Open the file: <code>database-test-data-generate.sql</code></li>' +
      '<li>Click "Run" to execute the script</li>' +
      '<li>Reload this page to see the test data</li>' +
      '</ol>' +
      '<p class="mt-3 text-muted"><small>The SQL script creates all test organisations, awards, winners, and RSVPs.</small></p>';

    this.showModal('Setup Instructions', message);
  },

  /**
   * Show confirm dialog
   */
  async showConfirmDialog(title, message, confirmText, variant) {
    confirmText = confirmText || 'Confirm';
    variant = variant || 'primary';
    return new Promise(function(resolve) {
      var modalHtml =
        '<div class="modal fade" id="confirmModal" tabindex="-1">' +
        '<div class="modal-dialog modal-dialog-centered">' +
        '<div class="modal-content">' +
        '<div class="modal-header">' +
        '<h5 class="modal-title">' + title + '</h5>' +
        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button>' +
        '</div>' +
        '<div class="modal-body">' + message + '</div>' +
        '<div class="modal-footer">' +
        '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>' +
        '<button type="button" class="btn btn-' + variant + '" id="confirmBtn">' + confirmText + '</button>' +
        '</div></div></div></div>';

      var existingModal = document.getElementById('confirmModal');
      if (existingModal) existingModal.remove();

      document.body.insertAdjacentHTML('beforeend', modalHtml);

      var modalEl = document.getElementById('confirmModal');
      var modal = new bootstrap.Modal(modalEl);

      var wasConfirmed = false;
      document.getElementById('confirmBtn').onclick = function() {
        wasConfirmed = true;
        modal.hide();
      };

      modalEl.addEventListener('hidden.bs.modal', function() {
        modalEl.remove();
        resolve(wasConfirmed);
      });

      modal.show();
    });
  },

  /**
   * Show info modal
   */
  showModal(title, message, showReloadBtn) {
    var reloadBtn = showReloadBtn ? '<button type="button" class="btn btn-primary" onclick="location.reload()">Reload Page</button>' : '';
    var modalHtml =
      '<div class="modal fade" id="infoModal" tabindex="-1">' +
      '<div class="modal-dialog modal-dialog-centered modal-lg">' +
      '<div class="modal-content">' +
      '<div class="modal-header">' +
      '<h5 class="modal-title">' + title + '</h5>' +
      '<button type="button" class="btn-close" data-bs-dismiss="modal"></button>' +
      '</div>' +
      '<div class="modal-body">' + message + '</div>' +
      '<div class="modal-footer">' +
      reloadBtn +
      '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>' +
      '</div></div></div></div>';

    var existingModal = document.getElementById('infoModal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    var modal = new bootstrap.Modal(document.getElementById('infoModal'));
    modal.show();

    document.getElementById('infoModal').addEventListener('hidden.bs.modal', function() {
      this.remove();
    });
  },

  /**
   * Generate Mock Pending Order
   */
  async generateMockOrder() {
    try {
      utils.showLoading();

      var testOrg;
      var { data: existingOrg } = await STATE.client
        .from('organisations')
        .select('id, company_name')
        .eq('company_name', 'TEST_MODE_Mock Company Ltd')
        .single();

      if (existingOrg) {
        testOrg = existingOrg;
      } else {
        var { data: newOrg, error: orgError } = await STATE.client
          .from('organisations')
          .insert({
            company_name: 'TEST_MODE_Mock Company Ltd',
            contact_name: 'Test Contact',
            email: 'test@mockcompany.com',
            status: 'active',
            region: 'London'
          })
          .select()
          .single();

        if (orgError) throw orgError;
        testOrg = newOrg;
      }

      var invoiceNumber = 'TEST-INV-' + Date.now();

      var { data: invoice, error: invoiceError } = await STATE.client
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          organisation_id: testOrg.id,
          invoice_date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'sent',
          payment_status: 'unpaid',
          invoice_type: 'package',
          package_type: 'gold',
          total_amount: 1250.00,
          currency: 'GBP',
          notes: '[TEST MODE] Mock order for testing dashboard notifications'
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      await STATE.client
        .from('invoice_line_items')
        .insert([
          { invoice_id: invoice.id, item_name: 'Gold Package', quantity: 1, unit_price: 1000.00, line_total: 1000.00 },
          { invoice_id: invoice.id, item_name: 'Extra Tickets', quantity: 5, unit_price: 50.00, line_total: 250.00 }
        ]);

      utils.hideLoading();
      utils.showToast('Mock order created: ' + invoiceNumber + ' for £1,250.00', 'success');

      setTimeout(function() {
        if (window.confirm('Mock order created! Go to Dashboard to see the notification?')) {
          document.getElementById('dashboard-tab').click();
        }
      }, 1500);

    } catch (error) {
      console.error('Error generating mock order:', error);
      utils.showToast('Failed to generate mock order: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Remove Mock Orders
   */
  async removeMockOrders() {
    try {
      utils.showLoading();

      // 1. Find mock invoices so we can clean up related records
      var { data: mockInvoices } = await STATE.client
        .from('invoices')
        .select('id')
        .like('invoice_number', 'TEST-INV-%');

      if (mockInvoices && mockInvoices.length > 0) {
        // 2. Delete line items for these invoices (in case CASCADE doesn't fire)
        for (var i = 0; i < mockInvoices.length; i++) {
          await STATE.client.from('invoice_line_items').delete().eq('invoice_id', mockInvoices[i].id);
        }

        // 3. Delete payments referencing these invoices
        for (var p = 0; p < mockInvoices.length; p++) {
          await STATE.client.from('payments').delete().eq('invoice_id', mockInvoices[p].id);
        }
      }

      // 4. Delete the invoices themselves
      await STATE.client.from('invoices').delete().like('invoice_number', 'TEST-INV-%');

      // 5. Delete the mock organisation (and its children via CASCADE)
      await STATE.client.from('organisations').delete().eq('company_name', 'TEST_MODE_Mock Company Ltd');

      utils.hideLoading();
      utils.showToast('Mock orders removed successfully!', 'success');

      setTimeout(function() {
        testDataManager.showModal('Mock Orders Removed',
          '<div class="alert alert-success">' +
          '<h6><i class="bi bi-check-circle me-2"></i>Cleanup Complete</h6>' +
          '<p class="mb-0">All mock order data has been removed.</p>' +
          '</div>' +
          '<p class="mt-3">Click "Reload Page" to refresh all views.</p>',
          true);
      }, 500);

    } catch (error) {
      console.error('Error removing mock orders:', error);
      utils.showToast('Failed to remove mock orders: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  }
};

// Export to window
window.testDataManager = testDataManager;
