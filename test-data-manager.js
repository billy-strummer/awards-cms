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

  uid(prefix, n) {
    return prefix + String(n).padStart(12, '0');
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
      '<li><strong>Awards:</strong> 10 award categories</li>' +
      '<li><strong>Organisations:</strong> 30 companies with contacts</li>' +
      '<li><strong>Winners:</strong> 30 award assignments</li>' +
      '<li><strong>Entries:</strong> 20 entries with varied statuses + judge scores + public votes</li>' +
      '<li><strong>Media Gallery:</strong> 2 galleries with 10 media items</li>' +
      '<li><strong>Events:</strong> 1 event with RSVPs, running order</li>' +
      '<li><strong>Reports:</strong> Data from entries, payments, judges, sponsors</li>' +
      '<li><strong>Marketing:</strong> 5 sponsors + 4 banners</li>' +
      '<li><strong>Payments:</strong> 8 invoices with line items + 5 payments</li>' +
      '<li><strong>CRM:</strong> 15 contacts, 6 deals, 10 communications, 4 meetings, 3 segments</li>' +
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

    // ===== Step 1: Create test event =====
    utils.showToast('Step 1/12: Creating test event...', 'info');
    const { error: eventErr } = await STATE.client.from('events').upsert({
      id: eventId,
      event_name: 'TEST_MODE_2025 Awards Gala',
      event_date: '2025-12-15',
      year: 2025,
      venue: 'Grand Test Ballroom',
      description: '[TEST MODE] This is a test event with mock winners for testing the CMS'
    });
    if (eventErr) console.warn('Event upsert:', eventErr.message);

    // ===== Step 2: Create 10 test awards =====
    utils.showToast('Step 2/12: Creating test awards...', 'info');
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
    const { error: awardsErr } = await STATE.client.from('awards').upsert(awards);
    if (awardsErr) console.warn('Awards upsert:', awardsErr.message);

    // ===== Step 3: Create 30 test organisations =====
    utils.showToast('Step 3/12: Creating test organisations...', 'info');
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
    const { error: orgsErr } = await STATE.client.from('organisations').upsert(orgs);
    if (orgsErr) console.warn('Organisations upsert:', orgsErr.message);

    // ===== Step 4: Create 30 award assignments (3 winners per award) =====
    utils.showToast('Step 4/12: Creating test winners...', 'info');
    const winnerOrgIndices = [
      [1,3,5], [7,10,11], [2,13,24], [4,28,30], [6,8,14],
      [9,22,26], [21,23,25], [12,16,18], [15,20,29], [17,19,27]
    ];
    const awardScores = [
      [9.5,9.2,8.9], [9.3,9.0,8.8], [9.4,9.1,8.7], [9.6,9.2,8.9], [9.3,9.0,8.8],
      [9.4,9.1,8.9], [9.5,9.2,8.8], [9.3,9.0,8.7], [9.4,9.1,8.9], [9.6,9.5,9.3]
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
          judge_score: awardScores[a][w]
        });
        assignIdx++;
      }
    }
    const { error: assignErr } = await STATE.client.from('award_assignments').upsert(assignments);
    if (assignErr) console.warn('Assignments upsert:', assignErr.message);

    // ===== Step 4b: Populate winners table (used by Winners tab + dashboard stats) =====
    var winners = [];
    var winnerIdx = 1;
    for (var wi = 0; wi < 10; wi++) {
      var topOrgIdx = winnerOrgIndices[wi][0]; // 1st place per award
      winners.push({
        id: this.uid(this.WINNER_PREFIX, winnerIdx),
        winner_name: orgNames[topOrgIdx - 1],
        award_id: this.uid(this.AWARD_PREFIX, wi + 1),
        organisation_id: this.uid(this.ORG_PREFIX, topOrgIdx),
        year: 2025
      });
      winnerIdx++;
    }
    const { error: winnerErr } = await STATE.client.from('winners').upsert(winners);
    if (winnerErr) console.warn('Winners upsert:', winnerErr.message);

    // ===== Step 5: Create event guests (RSVPs) =====
    utils.showToast('Step 5/12: Creating test RSVPs...', 'info');
    const guests = orgs.map(function(org) {
      return {
        event_id: eventId,
        guest_name: 'CEO ' + org.company_name.replace('TEST_MODE_', ''),
        guest_email: org.email,
        rsvp_status: 'confirmed'
      };
    });
    await STATE.client.from('event_guests').delete().eq('event_id', eventId);
    const { error: guestErr } = await STATE.client.from('event_guests').insert(guests);
    if (guestErr) console.warn('Guests insert:', guestErr.message);

    // ===== Step 6: Create entries with varied statuses =====
    utils.showToast('Step 6/12: Creating test entries...', 'info');
    await this.generateEntries(awards, orgs);

    // ===== Step 7: Create sponsors and banners (Marketing tab) =====
    utils.showToast('Step 7/12: Creating sponsors & banners...', 'info');
    await this.generateMarketingData();

    // ===== Step 8: Create CRM data =====
    utils.showToast('Step 8/12: Creating CRM data...', 'info');
    await this.generateCRMData(orgs);

    // ===== Step 9: Create invoices, line items, payments (Payments tab) =====
    utils.showToast('Step 9/12: Creating invoices & payments...', 'info');
    await this.generatePaymentsData(orgs);

    // ===== Step 10: Create media gallery data =====
    utils.showToast('Step 10/12: Creating media gallery...', 'info');
    await this.generateMediaData(eventId, orgs, awards);

    // ===== Step 11: Create running order =====
    utils.showToast('Step 11/12: Creating running order...', 'info');
    await this.generateRunningOrder(eventId, awards, orgs, winnerOrgIndices);

    // ===== Step 12: Done =====
    utils.showToast('Step 12/12: All test data generated! Reload to see it.', 'success');
    setTimeout(function() { testDataManager.showInfoModal(); }, 1000);
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
    var { error: entryErr } = await STATE.client.from('entries').upsert(entries);
    if (entryErr) console.warn('Entries upsert:', entryErr.message);

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
        await STATE.client.from('judge_scores').delete().eq('entry_id', scoredEntries[di].id);
      }
      var { error: scoreErr } = await STATE.client.from('judge_scores').insert(scoreRecords);
      if (scoreErr) console.warn('Judge scores insert:', scoreErr.message);
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
        await STATE.client.from('public_votes').delete().eq('entry_id', votableEntries[dvi].id);
      }
      var { error: voteErr } = await STATE.client.from('public_votes').insert(voteRecords);
      if (voteErr) console.warn('Public votes insert:', voteErr.message);
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
    var { error: sponsorErr } = await STATE.client.from('sponsors').upsert(sponsors);
    if (sponsorErr) console.warn('Sponsors upsert:', sponsorErr.message);

    var today = new Date().toISOString().split('T')[0];
    var banners = [
      { id: this.uid(this.BANNER_PREFIX, 1), title: 'TEST_MODE_Awards Now Open', position: 'header', image_url: 'https://placehold.co/728x90?text=Awards+Now+Open', link_url: 'https://example.com/enter', width: 728, height: 90, is_active: true, display_order: 1, impressions: 1250, clicks: 87, start_date: today },
      { id: this.uid(this.BANNER_PREFIX, 2), title: 'TEST_MODE_Sponsor Spotlight', position: 'sidebar', image_url: 'https://placehold.co/300x250?text=Sponsor+Spotlight', link_url: 'https://example.com/sponsors', width: 300, height: 250, is_active: true, display_order: 2, impressions: 980, clicks: 42, start_date: today },
      { id: this.uid(this.BANNER_PREFIX, 3), title: 'TEST_MODE_Early Bird Tickets', position: 'footer', image_url: 'https://placehold.co/728x90?text=Early+Bird+Tickets', link_url: 'https://example.com/tickets', width: 728, height: 90, is_active: true, display_order: 3, impressions: 560, clicks: 23, start_date: today },
      { id: this.uid(this.BANNER_PREFIX, 4), title: 'TEST_MODE_Vote Now', position: 'popup', image_url: 'https://placehold.co/600x400?text=Vote+Now', link_url: 'https://example.com/vote', width: 600, height: 400, is_active: false, display_order: 4, impressions: 320, clicks: 15, start_date: today }
    ];
    var { error: bannerErr } = await STATE.client.from('banners').upsert(banners);
    if (bannerErr) console.warn('Banners upsert:', bannerErr.message);
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
    var { error: contactErr } = await STATE.client.from('organisation_contacts').upsert(contacts);
    if (contactErr) console.warn('Contacts upsert:', contactErr.message);

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
    var { error: commErr } = await STATE.client.from('communications').upsert(comms);
    if (commErr) console.warn('Communications upsert:', commErr.message);

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
        deal_name: 'TEST_MODE_' + orgs[i].company_name.replace('TEST_MODE_', '') + ' - ' + dealTypes[i],
        deal_type: dealTypes[i],
        stage: stage,
        probability: dealProbs[i],
        deal_value: dealValues[i],
        status: stage === 'closed_won' ? 'won' : 'active',
        expected_close_date: new Date(Date.now() + (i + 1) * 86400000 * 14).toISOString().split('T')[0],
        actual_close_date: stage === 'closed_won' ? new Date().toISOString().split('T')[0] : null,
        description: 'Test deal for ' + dealTypes[i] + ' with ' + orgs[i].company_name.replace('TEST_MODE_', '')
      };
    });
    var { error: dealErr } = await STATE.client.from('deals').upsert(deals);
    if (dealErr) console.warn('Deals upsert:', dealErr.message);

    // Meeting notes (4 meetings)
    var meetings = [
      { id: this.uid(this.MEETING_PREFIX, 1), organisation_id: orgs[0].id, deal_id: deals[0].id, meeting_title: 'TEST_MODE_Platinum Sponsorship Discussion', meeting_type: 'video_call', duration_minutes: 45, notes: 'Discussed platinum tier benefits. Very interested.', follow_up_required: true, follow_up_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] },
      { id: this.uid(this.MEETING_PREFIX, 2), organisation_id: orgs[3].id, deal_id: deals[3].id, meeting_title: 'TEST_MODE_Partnership Review', meeting_type: 'in_person', duration_minutes: 60, notes: 'Reviewed partnership terms. Need to send revised proposal.', follow_up_required: true, follow_up_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0] },
      { id: this.uid(this.MEETING_PREFIX, 3), organisation_id: orgs[5].id, meeting_title: 'TEST_MODE_Award Entry Guidance', meeting_type: 'phone', duration_minutes: 20, notes: 'Guided them through the entry process. Will submit next week.', follow_up_required: false },
      { id: this.uid(this.MEETING_PREFIX, 4), organisation_id: orgs[8].id, meeting_title: 'TEST_MODE_Event Planning Debrief', meeting_type: 'conference', duration_minutes: 90, notes: 'Reviewed last event feedback. Planning improvements for next year.', follow_up_required: false }
    ];
    var { error: meetingErr } = await STATE.client.from('meeting_notes').upsert(meetings);
    if (meetingErr) console.warn('Meetings upsert:', meetingErr.message);

    // Contact segments (3 segments)
    var segments = [
      { id: this.uid(this.SEGMENT_PREFIX, 1), segment_name: 'TEST_MODE_VIP Sponsors', description: 'High-value sponsors (Gold+ tier)', color: '#FFD700', icon: 'bi-star-fill' },
      { id: this.uid(this.SEGMENT_PREFIX, 2), segment_name: 'TEST_MODE_Active Entrants', description: 'Organisations with active award entries', color: '#28a745', icon: 'bi-file-earmark-check' },
      { id: this.uid(this.SEGMENT_PREFIX, 3), segment_name: 'TEST_MODE_Past Winners', description: 'Previous award winners', color: '#6f42c1', icon: 'bi-trophy' }
    ];
    var { error: segErr } = await STATE.client.from('contact_segments').upsert(segments);
    if (segErr) console.warn('Segments upsert:', segErr.message);

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
      await STATE.client.from('organisation_segments').delete().eq('segment_id', segments[ds].id);
    }
    var { error: orgSegErr } = await STATE.client.from('organisation_segments').insert(orgSegments);
    if (orgSegErr) console.warn('Org segments insert:', orgSegErr.message);
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
    var { error: invErr } = await STATE.client.from('invoices').upsert(invoices);
    if (invErr) console.warn('Invoices upsert:', invErr.message);

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
      await STATE.client.from('invoice_line_items').delete().eq('invoice_id', invoices[dli].id);
    }
    var { error: liErr } = await STATE.client.from('invoice_line_items').insert(lineItems);
    if (liErr) console.warn('Line items insert:', liErr.message);

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
    var { error: payErr } = await STATE.client.from('payments').upsert(payments);
    if (payErr) console.warn('Payments upsert:', payErr.message);
  },

  /**
   * Generate Media Gallery data
   */
  async generateMediaData(eventId, orgs, awards) {
    var galleries = [
      { id: this.uid(this.GALLERY_PREFIX, 1), event_id: eventId, gallery_name: 'TEST_MODE_Awards Ceremony', gallery_description: 'Photos from the main ceremony', display_order: 1 },
      { id: this.uid(this.GALLERY_PREFIX, 2), event_id: eventId, gallery_name: 'TEST_MODE_Winners Collection', gallery_description: 'Winner announcement photos', display_order: 2 }
    ];
    var { error: galErr } = await STATE.client.from('event_galleries').upsert(galleries);
    if (galErr) console.warn('Galleries upsert:', galErr.message);

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
    var { error: miErr } = await STATE.client.from('media_items').upsert(mediaItems);
    if (miErr) console.warn('Media items upsert:', miErr.message);

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
    var { error: mgErr } = await STATE.client.from('media_gallery').upsert(mediaGallery);
    if (mgErr) console.warn('Media gallery upsert:', mgErr.message);
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
    await STATE.client.from('running_order').delete().eq('event_id', eventId);
    var { error: roErr } = await STATE.client.from('running_order').insert(runningOrder);
    if (roErr) console.warn('Running order insert:', roErr.message);
  },

  /**
   * Remove Test Data
   */
  async removeTestData() {
    var confirmResult = await this.showConfirmDialog(
      'Remove All Test Data',
      'This will permanently delete <strong>all</strong> test data including:<br>' +
      '<ul>' +
      '<li>Test event, RSVPs, running order, table plan</li>' +
      '<li>Test organisations and contacts</li>' +
      '<li>Test awards and award assignments</li>' +
      '<li>Test entries, judge scores, public votes</li>' +
      '<li>Test invoices, payments, line items</li>' +
      '<li>Test sponsors and banners</li>' +
      '<li>Test CRM data (communications, deals, meetings, segments)</li>' +
      '<li>Test media gallery items</li>' +
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

      // Get test entry IDs
      var { data: testEntries } = await STATE.client
        .from('entries').select('id').like('entry_number', 'TEST-ENT-%');
      var entryIds = (testEntries || []).map(function(e) { return e.id; });

      utils.showToast('Removing test data...', 'info');

      // 1. Public votes
      for (var pv = 0; pv < entryIds.length; pv++) {
        await STATE.client.from('public_votes').delete().eq('entry_id', entryIds[pv]);
      }

      // 2. Judge scores
      for (var js = 0; js < entryIds.length; js++) {
        await STATE.client.from('judge_scores').delete().eq('entry_id', entryIds[js]);
      }

      // 3. Entries
      await STATE.client.from('entries').delete().like('entry_number', 'TEST-ENT-%');

      // 4. Organisation segments
      var { data: testSegs } = await STATE.client
        .from('contact_segments').select('id').like('segment_name', 'TEST_MODE_%');
      if (testSegs && testSegs.length > 0) {
        for (var os = 0; os < testSegs.length; os++) {
          await STATE.client.from('organisation_segments').delete().eq('segment_id', testSegs[os].id);
        }
      }

      // 5. Contact segments
      await STATE.client.from('contact_segments').delete().like('segment_name', 'TEST_MODE_%');

      // 6. Meeting notes
      if (orgIds.length > 0) {
        await STATE.client.from('meeting_notes').delete().in('organisation_id', orgIds);
      }

      // 7. Communications
      if (orgIds.length > 0) {
        await STATE.client.from('communications').delete().in('organisation_id', orgIds);
      }

      // 8. Deals
      if (orgIds.length > 0) {
        await STATE.client.from('deals').delete().in('organisation_id', orgIds);
      }

      // 9. Organisation contacts
      if (orgIds.length > 0) {
        await STATE.client.from('organisation_contacts').delete().in('organisation_id', orgIds);
      }

      // 10. Payments
      await STATE.client.from('payments').delete().like('payment_reference', 'TEST-PAY-%');

      // 11. Invoice line items
      var { data: testInvoices } = await STATE.client
        .from('invoices').select('id').like('invoice_number', 'TEST-INV-%');
      if (testInvoices && testInvoices.length > 0) {
        for (var il = 0; il < testInvoices.length; il++) {
          await STATE.client.from('invoice_line_items').delete().eq('invoice_id', testInvoices[il].id);
        }
      }

      // 12. Invoices
      await STATE.client.from('invoices').delete().like('invoice_number', 'TEST-INV-%');

      // 13. Sponsors
      await STATE.client.from('sponsors').delete().like('company_name', 'TEST_MODE_%');

      // 14. Banners
      await STATE.client.from('banners').delete().like('title', 'TEST_MODE_%');

      // 15. Media gallery records
      if (orgIds.length > 0) {
        await STATE.client.from('media_gallery').delete().in('organisation_id', orgIds);
      }

      // 16. Media items
      await STATE.client.from('media_items').delete().eq('event_id', eventId);

      // 17. Event galleries
      await STATE.client.from('event_galleries').delete().eq('event_id', eventId);

      // 18. Table assignments
      await STATE.client.from('table_assignments').delete().eq('event_id', eventId);

      // 19. Event tables
      await STATE.client.from('event_tables').delete().eq('event_id', eventId);

      // 20. Running order
      await STATE.client.from('running_order').delete().eq('event_id', eventId);

      // 21. Running order settings
      await STATE.client.from('running_order_settings').delete().eq('event_id', eventId);

      // 22. Event guests
      await STATE.client.from('event_guests').delete().eq('event_id', eventId);

      // 23. Award assignments
      if (orgIds.length > 0) {
        await STATE.client.from('award_assignments').delete().in('organisation_id', orgIds);
      }

      // 23b. Winners
      if (orgIds.length > 0) {
        await STATE.client.from('winners').delete().in('organisation_id', orgIds);
      }

      // 24. Organisations
      await STATE.client.from('organisations').delete().like('company_name', 'TEST_MODE_%');

      // 25. Awards
      await STATE.client.from('awards').delete().like('award_name', 'TEST_MODE_%');

      // 26. Event
      await STATE.client.from('events').delete().eq('id', eventId);

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
        STATE.client.from('sponsors').select('*', { count: 'exact', head: true }).like('company_name', 'TEST_MODE_%'),
        STATE.client.from('banners').select('*', { count: 'exact', head: true }).like('title', 'TEST_MODE_%'),
        STATE.client.from('invoices').select('*', { count: 'exact', head: true }).like('invoice_number', 'TEST-INV-%'),
        STATE.client.from('organisation_contacts').select('*', { count: 'exact', head: true }).like('id', testDataManager.CONTACT_PREFIX + '%'),
        STATE.client.from('deals').select('*', { count: 'exact', head: true }).like('deal_name', 'TEST_MODE_%'),
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
      '<li>1 test event with RSVPs</li>' +
      '<li>10 award categories</li>' +
      '<li>30 organisations with contacts</li>' +
      '<li>30 award winners</li>' +
      '<li>20 entries (varied statuses)</li>' +
      '<li>Judge scores + public votes</li>' +
      '</ul></div><div class="col-md-6"><ul>' +
      '<li>5 sponsors + 4 banners</li>' +
      '<li>8 invoices + payments</li>' +
      '<li>6 CRM deals + 10 communications</li>' +
      '<li>4 meeting notes + 3 segments</li>' +
      '<li>2 galleries + 10 media items</li>' +
      '<li>Running order (10 awards)</li>' +
      '</ul></div></div>' +
      '<p class="mt-3"><strong>Try every tab:</strong></p>' +
      '<ol>' +
      '<li><strong>Dashboard</strong> - Aggregated stats and charts</li>' +
      '<li><strong>Awards</strong> - 10 categories to manage</li>' +
      '<li><strong>Organisations</strong> - 30 companies with details</li>' +
      '<li><strong>Winners</strong> - Award assignments and scores</li>' +
      '<li><strong>Entries</strong> - Draft, submitted, reviewed, shortlisted, winner, rejected</li>' +
      '<li><strong>Media Gallery</strong> - Photos in 2 galleries</li>' +
      '<li><strong>Events</strong> - Running order + table plan + RSVPs</li>' +
      '<li><strong>Reports</strong> - Financial, entry, and judging reports</li>' +
      '<li><strong>Marketing</strong> - Sponsors (5 tiers) + banners</li>' +
      '<li><strong>Payments</strong> - Invoices, line items, and payment records</li>' +
      '<li><strong>CRM</strong> - Contacts, deals, comms, meetings, segments</li>' +
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

      var { error } = await STATE.client
        .from('invoices')
        .delete()
        .like('invoice_number', 'TEST-INV-%');

      if (error) throw error;

      utils.showToast('Mock orders removed successfully!', 'success');

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
