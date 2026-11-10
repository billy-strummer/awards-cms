/**
 * Server-side Test Data Manager fixture operations (BTA-098).
 *
 * Ported from test-data-manager.js's former direct-browser-client logic
 * (STATE.client.from(...) calls made from the authenticated anon-key
 * client) to run here, on the server, against the service-role Supabase
 * client passed into createTestDataFixtures(). The caller
 * (api/data-proxy.js) is responsible for the super_admin role check and
 * the isTestDataEnvironmentSafe() non-production check before invoking
 * any of these functions — this module does not re-check either, so it
 * must never be reachable from a path that hasn't already enforced both.
 *
 * Every write/delete here is scoped to the same reserved test-data
 * markers the original browser tool used (TEST_MODE_%, TEST-ENT-%,
 * TEST-INV-%, TEST-PAY-%, or a fixed UUID from the PREFIXES below), so
 * cleanup can only ever affect records this tool itself created.
 */

const PREFIXES = {
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
  SOCIAL_PREFIX: 'B2000000-0000-0000-0000-',
  TICKET_TYPE_PREFIX: 'B3000000-0000-0000-0000-',
  FOLLOWUP_PREFIX: 'B4000000-0000-0000-0000-',
  REPORT_PREFIX: 'B5000000-0000-0000-0000-',
  ATTENDEE_PREFIX: 'B6000000-0000-0000-0000-',
};

function uid(prefix, n) {
  return prefix + String(n).padStart(12, '0');
}

/**
 * @param {object} client - service-role Supabase client
 * @param {object} [deps]
 * @param {{generate: () => Promise<{success:boolean,errors:string[]}>, clear: () => Promise<{success:boolean,errors:string[]}>}} [deps.emailFixtures] -
 *   reuses api/data-proxy.js's existing executeTestDataFixture() actions for the
 *   email_lists/email_list_subscribers fixtures rather than duplicating that logic here.
 */
function createTestDataFixtures(client, deps) {
  const emailFixtures = (deps && deps.emailFixtures) || {
    generate: async () => ({ success: true, errors: [] }),
    clear: async () => ({ success: true, errors: [] }),
  };

  const self = Object.assign(
    {
      db: client,

      uid,

      _logErr(step, err) {
        if (err) {
          const msg = err.message || JSON.stringify(err);
          console.warn('[test-data-fixtures] ' + step + ':', msg);
          return true;
        }
        return false;
      },

      /**
       * Resilient write: auto-strips columns the database doesn't have and retries.
       */
      async _safeWrite(table, records, label, mode) {
        const data = JSON.parse(JSON.stringify(records));
        const stripped = [];

        for (let attempt = 0; attempt < 20; attempt++) {
          const r = mode === 'upsert' ? await self.db.from(table).upsert(data) : await self.db.from(table).insert(data);

          if (!r.error) {
            return { error: null, stripped: stripped };
          }

          const errText = (r.error.message || '') + ' ' + (r.error.details || '') + ' ' + (r.error.hint || '');

          let match = errText.match(/Could not find the '([^']+)' column/);
          if (!match) match = errText.match(/column "([^"]+)".*does not exist/);
          if (!match) match = errText.match(/Could not find.*?column.*?'([^']+)'/i);

          if (!match && /Could not find.*in the schema cache/i.test(errText) && !/column/i.test(errText)) {
            console.warn(label + ': table "' + table + '" not found in schema cache');
            return { error: r.error, stripped: stripped };
          }

          if (!match || stripped.indexOf(match[1]) >= 0) {
            return { error: r.error, stripped: stripped };
          }

          const badCol = match[1];
          stripped.push(badCol);
          console.warn(label + ': auto-stripping missing column "' + badCol + '", retrying...');

          if (Array.isArray(data)) {
            data.forEach(function (row) {
              delete row[badCol];
            });
          } else {
            delete data[badCol];
          }
        }

        return { error: { message: 'Too many missing columns stripped: ' + stripped.join(', ') }, stripped: stripped };
      },

      /** Safe delete: swallows errors from missing tables/columns */
      async _safeDel(promise) {
        try {
          await promise;
        } catch (e) {
          console.warn('Cleanup skip:', e.message || e);
        }
      },

      /**
       * Generate comprehensive test data across every admin tab.
       * @returns {Promise<{success: boolean, errors: string[]}>}
       */
      async generateTestData() {
        const eventId = self.EVENT_ID;
        const errors = [];

        const { error: pfErr } = await self.db.from('events').select('id').limit(1);
        if (pfErr) {
          return { success: false, errors: ['preflight: ' + (pfErr.message || 'cannot read from database')] };
        }

        try {
          await self.seedCounties();
        } catch (e) {
          self._logErr('Counties seed', e);
        }

        try {
          const evtResult = await self._safeWrite(
            'events',
            {
              id: eventId,
              event_name: 'TEST_MODE_2025 Awards Gala',
              event_date: '2025-12-15',
              year: 2025,
              venue: 'Grand Test Ballroom',
              description: '[TEST MODE] This is a test event with mock winners for testing the CMS',
            },
            'Events',
            'upsert'
          );
          if (self._logErr('Events', evtResult.error)) errors.push('events');
        } catch (e) {
          self._logErr('Events', e);
          errors.push('events');
        }

        const awards = [
          {
            id: uid(self.AWARD_PREFIX, 1),
            award_name: 'TEST_MODE_Best Innovation',
            award_category: 'Innovation',
            sector: 'Technology & Digital',
            county: 'Greater London',
            description: 'Excellence in innovation',
            year: 2025,
            is_active: true,
            status: 'Published',
          },
          {
            id: uid(self.AWARD_PREFIX, 2),
            award_name: 'TEST_MODE_Rising Star',
            award_category: 'Growth',
            sector: 'Business Services',
            county: 'Greater Manchester',
            description: 'Fast growing company',
            year: 2025,
            is_active: true,
            status: 'Published',
          },
          {
            id: uid(self.AWARD_PREFIX, 3),
            award_name: 'TEST_MODE_Export Excellence',
            award_category: 'International',
            sector: 'Business Services',
            county: 'West Midlands',
            description: 'Outstanding exports',
            year: 2025,
            is_active: true,
            status: 'Published',
          },
          {
            id: uid(self.AWARD_PREFIX, 4),
            award_name: 'TEST_MODE_Sustainability Leader',
            award_category: 'Environment',
            sector: 'Environment & Energy',
            county: 'Bristol',
            description: 'Green business practices',
            year: 2025,
            is_active: true,
            status: 'Published',
          },
          {
            id: uid(self.AWARD_PREFIX, 5),
            award_name: 'TEST_MODE_Digital Transformation',
            award_category: 'Technology',
            sector: 'Technology & Digital',
            county: 'West Yorkshire',
            description: 'Digital innovation',
            year: 2025,
            is_active: true,
            status: 'Approved',
          },
          {
            id: uid(self.AWARD_PREFIX, 6),
            award_name: 'TEST_MODE_Best Employer',
            award_category: 'People',
            sector: 'People & Culture',
            county: 'Surrey',
            description: 'Great workplace',
            year: 2025,
            is_active: true,
            status: 'Approved',
          },
          {
            id: uid(self.AWARD_PREFIX, 7),
            award_name: 'TEST_MODE_Customer Excellence',
            award_category: 'Service',
            sector: 'Business Services',
            county: 'Edinburgh',
            description: 'Outstanding customer service',
            year: 2025,
            is_active: true,
            status: 'Approved',
          },
          {
            id: uid(self.AWARD_PREFIX, 8),
            award_name: 'TEST_MODE_Manufacturing Excellence',
            award_category: 'Manufacturing',
            sector: 'Manufacturing & Engineering',
            county: 'South Yorkshire',
            description: 'Quality manufacturing',
            year: 2025,
            is_active: true,
            status: 'Approved',
          },
          {
            id: uid(self.AWARD_PREFIX, 9),
            award_name: 'TEST_MODE_Social Impact',
            award_category: 'Community',
            sector: 'People & Culture',
            county: 'Cardiff',
            description: 'Community contribution',
            year: 2025,
            is_active: true,
            status: 'Pending',
          },
          {
            id: uid(self.AWARD_PREFIX, 10),
            award_name: 'TEST_MODE_Lifetime Achievement',
            award_category: 'Special',
            sector: 'Special Awards',
            county: 'Belfast',
            description: 'Career recognition',
            year: 2025,
            is_active: true,
            status: 'Draft',
          },
        ];
        try {
          const awardsResult = await self._safeWrite('award_years', awards, 'Awards (award_years)', 'upsert');
          if (awardsResult.error) {
            console.warn('award_years upsert failed, trying awards view:', awardsResult.error.message);
            try {
              await self.db.from('awards').delete().like('award_name', 'TEST_MODE_%');
            } catch (e2) {}
            const awardsResult2 = await self._safeWrite('awards', awards, 'Awards (view)', 'insert');
            if (self._logErr('Awards (via view)', awardsResult2.error)) errors.push('awards');
          }
        } catch (e) {
          self._logErr('Awards', e);
          errors.push('awards');
        }

        const orgNames = [
          'Acme Corporation',
          'Global Dynamics Ltd',
          'TechStart Solutions',
          'Green Energy Co',
          'Premier Consulting',
          'Digital First Agency',
          'Swift Logistics',
          'HealthTech Innovations',
          'Financial Services Group',
          'EduTech Platform',
          'Retail Revolution',
          'Construction Masters',
          'Food & Beverage Co',
          'Creative Studios',
          'Property Development Ltd',
          'Automotive Innovations',
          'Legal Partners',
          'Engineering Solutions',
          'Fashion Forward',
          'Sports Excellence',
          'Travel & Tourism',
          'Pharma Research',
          'Insurance Partners',
          'Telecom Services',
          'Chemical Industries',
          'Publishing House',
          'Security Systems',
          'Agriculture Tech',
          'Entertainment Group',
          'Environmental Services',
        ];
        const industries = [
          'Technology',
          'Manufacturing',
          'Software',
          'Energy',
          'Consulting',
          'Marketing',
          'Transport',
          'Healthcare',
          'Finance',
          'Education',
          'Retail',
          'Construction',
          'Food',
          'Media',
          'Real Estate',
          'Automotive',
          'Legal',
          'Engineering',
          'Fashion',
          'Sports',
          'Tourism',
          'Pharmaceutical',
          'Insurance',
          'Telecommunications',
          'Chemical',
          'Publishing',
          'Security',
          'Agriculture',
          'Entertainment',
          'Environment',
        ];
        const regions = [
          'London',
          'South East',
          'South West',
          'East Midlands',
          'West Midlands',
          'North West',
          'North East',
          'Yorkshire',
          'East of England',
          'Scotland, North',
          'Scotland, Central',
          'Scotland, West',
          'Scotland, South',
          'Wales, South',
          'Wales, NW (Gwynedd)',
          'Greater London',
          'South East',
          'South West',
          'East Midlands',
          'West Midlands',
          'North West',
          'North East',
          'Yorkshire',
          'East of England',
          'Scotland',
          'Wales',
          'London',
          'South East',
          'South West',
          'East Midlands',
          'West Midlands',
          'North West',
          'North East',
        ];
        const orgs = orgNames.map((name, i) => ({
          id: uid(self.ORG_PREFIX, i + 1),
          company_name: 'TEST_MODE_' + name,
          sector: industries[i],
          description: 'Test organisation #' + (i + 1),
          county_city: regions[i],
          status: 'active',
          contact_name: 'Contact ' + (i + 1),
          email: name.toLowerCase().replace(/[^a-z0-9]/g, '.') + '@example.com',
          website: 'https://' + name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.example.com',
          contact_phone: '020 ' + String(7000 + i).padStart(4, '0') + ' ' + String(1000 + i * 37).padStart(4, '0'),
        }));
        try {
          const orgsResult = await self._safeWrite('organisations', orgs, 'Organisations', 'upsert');
          if (self._logErr('Organisations', orgsResult.error)) errors.push('organisations');
        } catch (e) {
          self._logErr('Organisations', e);
          errors.push('organisations');
        }

        const winnerOrgIndices = [
          [1, 3, 5],
          [7, 10, 11],
          [2, 13, 24],
          [4, 28, 30],
          [6, 8, 14],
          [9, 22, 26],
          [21, 23, 25],
          [12, 16, 18],
          [15, 20, 29],
          [17, 19, 27],
        ];
        const assignments = [];
        let assignIdx = 1;
        for (let a = 0; a < 10; a++) {
          for (let w = 0; w < 3; w++) {
            assignments.push({
              id: uid(self.ASSIGN_PREFIX, assignIdx),
              award_id: uid(self.AWARD_PREFIX, a + 1),
              organisation_id: uid(self.ORG_PREFIX, winnerOrgIndices[a][w]),
              status: 'winner',
              winner_position: w + 1,
            });
            assignIdx++;
          }
        }
        try {
          const assignResult = await self._safeWrite('award_assignments', assignments, 'Award assignments', 'upsert');
          if (self._logErr('Award assignments', assignResult.error)) errors.push('award_assignments');
        } catch (e) {
          self._logErr('Award assignments', e);
          errors.push('award_assignments');
        }

        const winners = [];
        let winnerIdx = 1;
        for (let wi = 0; wi < 10; wi++) {
          const topOrgIdx = winnerOrgIndices[wi][0];
          winners.push({
            id: uid(self.WINNER_PREFIX, winnerIdx),
            winner_name: orgNames[topOrgIdx - 1],
            award_id: uid(self.AWARD_PREFIX, wi + 1),
            organisation_id: uid(self.ORG_PREFIX, topOrgIdx),
            year: 2025,
          });
          winnerIdx++;
        }
        try {
          const winnerResult = await self._safeWrite('winners', winners, 'Winners', 'upsert');
          if (self._logErr('Winners', winnerResult.error)) errors.push('winners');
        } catch (e) {
          self._logErr('Winners', e);
          errors.push('winners');
        }

        try {
          const guests = orgs.map(function (org) {
            return {
              event_id: eventId,
              guest_name: 'CEO ' + org.company_name.replace('TEST_MODE_', ''),
              guest_email: org.email,
              rsvp_status: 'confirmed',
            };
          });
          try {
            await self.db.from('event_guests').delete().eq('event_id', eventId);
          } catch (e2) {}
          const guestResult = await self._safeWrite('event_guests', guests, 'Event guests', 'insert');
          if (self._logErr('Event guests', guestResult.error)) errors.push('event_guests');
        } catch (e) {
          self._logErr('Event guests', e);
          errors.push('event_guests');
        }

        try {
          await self.generateEntries(awards, orgs);
        } catch (e) {
          self._logErr('Entries', e);
          errors.push('entries');
        }

        try {
          await self.generateMarketingData();
        } catch (e) {
          self._logErr('Marketing', e);
          errors.push('marketing');
        }

        try {
          await self.generateCRMData(orgs);
        } catch (e) {
          self._logErr('CRM', e);
          errors.push('crm');
        }

        try {
          await self.generatePaymentsData(orgs);
        } catch (e) {
          self._logErr('Payments', e);
          errors.push('payments');
        }

        try {
          await self.generateMediaData(eventId, orgs, awards);
        } catch (e) {
          self._logErr('Media gallery', e);
          errors.push('media');
        }

        try {
          await self.generateRunningOrder(eventId, awards, orgs, winnerOrgIndices);
        } catch (e) {
          self._logErr('Running order', e);
          errors.push('running_order');
        }

        try {
          await self.generateEventExtras(eventId, orgs);
        } catch (e) {
          self._logErr('Event extras', e);
          errors.push('event_extras');
        }

        try {
          await self.generateMarketingExtras(awards, orgs);
        } catch (e) {
          self._logErr('Marketing extras', e);
          errors.push('marketing_extras');
        }

        try {
          await self.generateExtras(orgs);
        } catch (e) {
          self._logErr('Extras', e);
          errors.push('extras');
        }

        return { success: errors.length === 0, errors };
      },

      /**
       * Generate entries with varied statuses + judge scores + public votes
       */
      async generateEntries(awards, orgs) {
        const statuses = ['draft', 'submitted', 'under_review', 'shortlisted', 'winner', 'rejected'];
        const payStatuses = ['paid', 'pending', 'waived'];
        const entries = [];
        for (let i = 0; i < 20; i++) {
          const status = statuses[i % statuses.length];
          const awardIdx = i % 10;
          const orgIdx = i % 30;
          entries.push({
            id: uid(self.ENTRY_PREFIX, i + 1),
            entry_number: 'TEST-ENT-' + String(i + 1).padStart(4, '0'),
            organisation_id: orgs[orgIdx].id,
            award_id: awards[awardIdx].id,
            entry_title:
              'TEST_MODE_Entry: ' +
              orgs[orgIdx].company_name.replace('TEST_MODE_', '') +
              ' for ' +
              awards[awardIdx].award_name.replace('TEST_MODE_', ''),
            entry_description:
              'This is a test entry #' + (i + 1) + ' demonstrating the awards entry submission process.',
            why_should_win:
              'Outstanding achievements in ' +
              awards[awardIdx].award_category +
              ' including significant growth and innovation.',
            supporting_information:
              'Revenue increased 45% year-over-year. Launched 3 new products. Expanded to 5 new markets.',
            contact_name: 'Contact Person ' + (i + 1),
            contact_email: 'entry' + (i + 1) + '@example.com',
            contact_phone: '0' + (1234567890 + i),
            contact_position: ['CEO', 'CTO', 'COO', 'CFO', 'Director'][i % 5],
            status: status,
            payment_status: payStatuses[i % 3],
            year: 2025,
            is_shortlisted: status === 'shortlisted' || status === 'winner',
            shortlisted_date: status === 'shortlisted' || status === 'winner' ? '2025-09-01' : null,
            submission_date: '2025-0' + Math.min((i % 9) + 1, 9) + '-' + String((i % 28) + 1).padStart(2, '0'),
            is_self_nomination: i % 4 === 0,
            allow_public_voting: i % 3 === 0,
            is_public: status !== 'draft',
            public_votes: i % 3 === 0 ? Math.floor(Math.random() * 50) + 5 : 0,
            average_score:
              status === 'winner' ? 8.5 + Math.random() : status === 'shortlisted' ? 7.0 + Math.random() * 1.5 : null,
            total_scores: ['under_review', 'shortlisted', 'winner'].includes(status) ? 3 : 0,
            admin_notes: status === 'rejected' ? '[TEST] Did not meet minimum criteria' : null,
          });
        }
        const entryResult = await self._safeWrite('entries', entries, 'Entries', 'upsert');
        self._logErr('Entries', entryResult.error);

        const scoredEntries = entries.filter(function (e) {
          return ['under_review', 'shortlisted', 'winner'].includes(e.status);
        });
        const judgeNames = ['Judge Alice Smith', 'Judge Bob Jones', 'Judge Carol White'];
        const judgeEmails = ['alice.judge@example.com', 'bob.judge@example.com', 'carol.judge@example.com'];
        const scoreRecords = [];
        for (let si = 0; si < scoredEntries.length; si++) {
          const entry = scoredEntries[si];
          for (let j = 0; j < 3; j++) {
            const base = entry.status === 'winner' ? 8 : entry.status === 'shortlisted' ? 7 : 6;
            scoreRecords.push({
              entry_id: entry.id,
              judge_name: judgeNames[j],
              judge_email: judgeEmails[j],
              is_complete: true,
              has_conflict: false,
              total_score: base + Math.random() * 2,
            });
          }
        }
        if (scoreRecords.length > 0) {
          for (let di = 0; di < scoredEntries.length; di++) {
            try {
              await self.db.from('judge_scores').delete().eq('entry_id', scoredEntries[di].id);
            } catch (e3) {}
          }
          const scoreResult = await self._safeWrite('judge_scores', scoreRecords, 'Judge scores', 'insert');
          self._logErr('Judge scores', scoreResult.error);
        }

        const votableEntries = entries.filter(function (e) {
          return e.allow_public_voting && e.status !== 'draft';
        });
        const voteRecords = [];
        let voteIdx = 1;
        for (let vi = 0; vi < votableEntries.length; vi++) {
          const vEntry = votableEntries[vi];
          const numVotes = Math.floor(Math.random() * 8) + 2;
          for (let v = 0; v < numVotes; v++) {
            voteRecords.push({
              id: uid(self.VOTE_PREFIX, voteIdx),
              entry_id: vEntry.id,
              voter_email: 'voter' + voteIdx + '@example.com',
              voter_name: 'Test Voter ' + voteIdx,
              voter_ip: '192.168.1.' + ((voteIdx % 254) + 1),
              vote_value: 1,
              email_verified: true,
            });
            voteIdx++;
          }
        }
        if (voteRecords.length > 0) {
          for (let dvi = 0; dvi < votableEntries.length; dvi++) {
            try {
              await self.db.from('public_votes').delete().eq('entry_id', votableEntries[dvi].id);
            } catch (e3) {}
          }
          const voteResult = await self._safeWrite('public_votes', voteRecords, 'Public votes', 'insert');
          self._logErr('Public votes', voteResult.error);
        }
      },

      /** Generate Marketing data: sponsors + banners */
      async generateMarketingData() {
        const sponsors = [
          {
            id: uid(self.SPONSOR_PREFIX, 1),
            name: 'TEST_MODE_Platinum Corp',
            company_name: 'TEST_MODE_Platinum Corp',
            tier: 'Platinum',
            sponsorship_amount: 25000,
            contact_name: 'Sarah Platinum',
            email: 'sarah@platinumcorp.example.com',
            website: 'https://example.com/platinum',
            is_active: true,
            display_order: 1,
          },
          {
            id: uid(self.SPONSOR_PREFIX, 2),
            name: 'TEST_MODE_Gold Industries',
            company_name: 'TEST_MODE_Gold Industries',
            tier: 'Gold',
            sponsorship_amount: 15000,
            contact_name: 'James Gold',
            email: 'james@goldindustries.example.com',
            website: 'https://example.com/gold',
            is_active: true,
            display_order: 2,
          },
          {
            id: uid(self.SPONSOR_PREFIX, 3),
            name: 'TEST_MODE_Silver Solutions',
            company_name: 'TEST_MODE_Silver Solutions',
            tier: 'Silver',
            sponsorship_amount: 7500,
            contact_name: 'Emma Silver',
            email: 'emma@silversolutions.example.com',
            website: 'https://example.com/silver',
            is_active: true,
            display_order: 3,
          },
          {
            id: uid(self.SPONSOR_PREFIX, 4),
            name: 'TEST_MODE_Bronze Partners',
            company_name: 'TEST_MODE_Bronze Partners',
            tier: 'Bronze',
            sponsorship_amount: 3500,
            contact_name: 'Tom Bronze',
            email: 'tom@bronzepartners.example.com',
            website: 'https://example.com/bronze',
            is_active: true,
            display_order: 4,
          },
          {
            id: uid(self.SPONSOR_PREFIX, 5),
            name: 'TEST_MODE_Community Partner',
            company_name: 'TEST_MODE_Community Partner',
            tier: 'Partner',
            sponsorship_amount: 1000,
            contact_name: 'Lisa Partner',
            email: 'lisa@communitypartner.example.com',
            website: 'https://example.com/partner',
            is_active: true,
            display_order: 5,
          },
        ];
        const sponsorResult = await self._safeWrite('sponsors', sponsors, 'Sponsors', 'upsert');
        self._logErr('Sponsors', sponsorResult.error);

        const today = new Date().toISOString().split('T')[0];
        const banners = [
          {
            id: uid(self.BANNER_PREFIX, 1),
            title: 'TEST_MODE_Awards Now Open',
            position: 'header',
            image_url: 'https://placehold.co/728x90?text=Awards+Now+Open',
            link_url: 'https://example.com/enter',
            width: 728,
            height: 90,
            is_active: true,
            display_order: 1,
            impressions: 1250,
            clicks: 87,
            start_date: today,
          },
          {
            id: uid(self.BANNER_PREFIX, 2),
            title: 'TEST_MODE_Sponsor Spotlight',
            position: 'sidebar',
            image_url: 'https://placehold.co/300x250?text=Sponsor+Spotlight',
            link_url: 'https://example.com/sponsors',
            width: 300,
            height: 250,
            is_active: true,
            display_order: 2,
            impressions: 980,
            clicks: 42,
            start_date: today,
          },
          {
            id: uid(self.BANNER_PREFIX, 3),
            title: 'TEST_MODE_Early Bird Tickets',
            position: 'footer',
            image_url: 'https://placehold.co/728x90?text=Early+Bird+Tickets',
            link_url: 'https://example.com/tickets',
            width: 728,
            height: 90,
            is_active: true,
            display_order: 3,
            impressions: 560,
            clicks: 23,
            start_date: today,
          },
          {
            id: uid(self.BANNER_PREFIX, 4),
            title: 'TEST_MODE_Vote Now',
            position: 'popup',
            image_url: 'https://placehold.co/600x400?text=Vote+Now',
            link_url: 'https://example.com/vote',
            width: 600,
            height: 400,
            is_active: false,
            display_order: 4,
            impressions: 320,
            clicks: 15,
            start_date: today,
          },
        ];
        const bannerResult = await self._safeWrite('banners', banners, 'Banners', 'upsert');
        self._logErr('Banners', bannerResult.error);
      },

      /** Generate CRM data: contacts, communications, deals, meetings, segments */
      async generateCRMData(orgs) {
        const firstNames = [
          'Alice',
          'Bob',
          'Charlie',
          'Diana',
          'Edward',
          'Fiona',
          'George',
          'Hannah',
          'Ian',
          'Julia',
          'Kevin',
          'Laura',
          'Michael',
          'Nora',
          'Oliver',
        ];
        const lastNames = [
          'Smith',
          'Jones',
          'Williams',
          'Brown',
          'Taylor',
          'Davies',
          'Wilson',
          'Evans',
          'Thomas',
          'Roberts',
          'Johnson',
          'Walker',
          'Wright',
          'Thompson',
          'White',
        ];

        const contacts = firstNames.map(function (fn, i) {
          return {
            id: uid(self.CONTACT_PREFIX, i + 1),
            organisation_id: orgs[i].id,
            first_name: fn,
            last_name: lastNames[i],
            email: fn.toLowerCase() + '.' + lastNames[i].toLowerCase() + '@example.com',
          };
        });
        const contactResult = await self._safeWrite('organisation_contacts', contacts, 'Contacts', 'upsert');
        self._logErr('Contacts', contactResult.error);

        const commTypes = [
          'email',
          'phone',
          'meeting',
          'email',
          'phone',
          'linkedin',
          'email',
          'note',
          'email',
          'phone',
        ];
        const commSubjects = [
          'Sponsorship enquiry follow-up',
          'Award entry discussion',
          'Event tickets confirmation',
          'Partnership proposal',
          'Invoice payment reminder',
          'LinkedIn introduction',
          'Entry submission support',
          'Internal note on engagement',
          'Thank you for attending',
          'Upsell discussion',
        ];
        const regardingOptions = ['sponsorship', 'award_application', 'event_tickets', 'partnership', 'payment'];
        const comms = commTypes.map(function (type, i) {
          return {
            id: uid(self.COMM_PREFIX, i + 1),
            organisation_id: orgs[i].id,
            contact_id: contacts[i].id,
            type: type,
            direction: i % 2 === 0 ? 'outbound' : 'inbound',
            subject: 'TEST_MODE_' + commSubjects[i],
            message: 'This is a test ' + type + ' communication regarding ' + commSubjects[i].toLowerCase() + '.',
            regarding: regardingOptions[i % 5],
            follow_up_required: i % 3 === 0,
            follow_up_date:
              i % 3 === 0 ? new Date(Date.now() + (i + 1) * 86400000 * 3).toISOString().split('T')[0] : null,
          };
        });
        const commResult = await self._safeWrite('communications', comms, 'Communications', 'upsert');
        self._logErr('Communications', commResult.error);

        const dealStages = ['lead', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won'];
        const dealTypes = [
          'sponsorship',
          'award_fee',
          'event_tickets',
          'partnership',
          'package_upgrade',
          'sponsorship',
        ];
        const dealValues = [25000, 500, 2500, 10000, 1500, 15000];
        const dealProbs = [10, 25, 50, 65, 80, 100];
        const deals = dealStages.map(function (stage, i) {
          return {
            id: uid(self.DEAL_PREFIX, i + 1),
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
            description: 'Test deal for ' + dealTypes[i] + ' with ' + orgs[i].company_name.replace('TEST_MODE_', ''),
          };
        });
        const dealResult = await self._safeWrite('deals', deals, 'Deals', 'upsert');
        self._logErr('Deals', dealResult.error);

        const meetings = [
          {
            id: uid(self.MEETING_PREFIX, 1),
            organisation_id: orgs[0].id,
            deal_id: deals[0].id,
            subject: 'TEST_MODE_Platinum Sponsorship Discussion',
            meeting_type: 'video_call',
            duration_minutes: 45,
            notes: 'Discussed platinum tier benefits. Very interested.',
            follow_up_required: true,
            follow_up_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          },
          {
            id: uid(self.MEETING_PREFIX, 2),
            organisation_id: orgs[3].id,
            deal_id: deals[3].id,
            subject: 'TEST_MODE_Partnership Review',
            meeting_type: 'in_person',
            duration_minutes: 60,
            notes: 'Reviewed partnership terms. Need to send revised proposal.',
            follow_up_required: true,
            follow_up_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
          },
          {
            id: uid(self.MEETING_PREFIX, 3),
            organisation_id: orgs[5].id,
            subject: 'TEST_MODE_Award Entry Guidance',
            meeting_type: 'phone',
            duration_minutes: 20,
            notes: 'Guided them through the entry process. Will submit next week.',
            follow_up_required: false,
          },
          {
            id: uid(self.MEETING_PREFIX, 4),
            organisation_id: orgs[8].id,
            subject: 'TEST_MODE_Event Planning Debrief',
            meeting_type: 'conference',
            duration_minutes: 90,
            notes: 'Reviewed last event feedback. Planning improvements for next year.',
            follow_up_required: false,
          },
        ];
        const meetingResult = await self._safeWrite('meeting_notes', meetings, 'Meetings', 'upsert');
        self._logErr('Meetings', meetingResult.error);

        const segments = [
          {
            id: uid(self.SEGMENT_PREFIX, 1),
            segment_name: 'TEST_MODE_VIP Sponsors',
            description: 'High-value sponsors (Gold+ tier)',
            color: '#FFD700',
            icon: 'bi-star-fill',
          },
          {
            id: uid(self.SEGMENT_PREFIX, 2),
            segment_name: 'TEST_MODE_Active Entrants',
            description: 'Organisations with active award entries',
            color: '#28a745',
            icon: 'bi-file-earmark-check',
          },
          {
            id: uid(self.SEGMENT_PREFIX, 3),
            segment_name: 'TEST_MODE_Past Winners',
            description: 'Previous award winners',
            color: '#6f42c1',
            icon: 'bi-trophy',
          },
        ];
        const segResult = await self._safeWrite('contact_segments', segments, 'Segments', 'upsert');
        self._logErr('Segments', segResult.error);

        const orgSegments = [];
        for (let s1 = 0; s1 < 3; s1++) {
          orgSegments.push({ organisation_id: orgs[s1].id, segment_id: segments[0].id });
        }
        for (let s2 = 3; s2 < 8; s2++) {
          orgSegments.push({ organisation_id: orgs[s2].id, segment_id: segments[1].id });
        }
        for (let s3 = 8; s3 < 14; s3++) {
          orgSegments.push({ organisation_id: orgs[s3].id, segment_id: segments[2].id });
        }
        for (let ds = 0; ds < segments.length; ds++) {
          try {
            await self.db.from('organisation_segments').delete().eq('segment_id', segments[ds].id);
          } catch (e3) {}
        }
        const orgSegResult = await self._safeWrite('organisation_segments', orgSegments, 'Org segments', 'insert');
        self._logErr('Org segments', orgSegResult.error);
      },

      /** Generate Payments data: invoices, line items, payments */
      async generatePaymentsData(orgs) {
        const invStatuses = ['sent', 'sent', 'paid', 'paid', 'overdue', 'draft', 'paid', 'cancelled'];
        const payStatuses = ['unpaid', 'unpaid', 'paid', 'paid', 'overdue', 'unpaid', 'paid', 'cancelled'];
        const types = [
          'package',
          'package',
          'entry_fee',
          'entry_fee',
          'package',
          'entry_fee',
          'sponsorship',
          'package',
        ];
        const amounts = [1250, 2500, 350, 500, 1500, 250, 15000, 750];

        const invoices = [];
        for (let ii = 0; ii < invStatuses.length; ii++) {
          invoices.push({
            id: uid(self.INVOICE_PREFIX, ii + 1),
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
            notes: '[TEST MODE] Invoice #' + (ii + 1) + ' for ' + types[ii],
          });
        }
        const invResult = await self._safeWrite('invoices', invoices, 'Invoices', 'upsert');
        self._logErr('Invoices', invResult.error);

        const lineItems = [];
        for (let li = 0; li < invoices.length; li++) {
          const inv = invoices[li];
          if (inv.invoice_type === 'package') {
            lineItems.push(
              {
                invoice_id: inv.id,
                item_name: 'Awards Package',
                quantity: 1,
                unit_price: inv.total_amount * 0.8,
                line_total: inv.total_amount * 0.8,
              },
              {
                invoice_id: inv.id,
                item_name: 'Additional Guest Tickets',
                quantity: Math.ceil((inv.total_amount * 0.2) / 50),
                unit_price: 50,
                line_total: inv.total_amount * 0.2,
              }
            );
          } else if (inv.invoice_type === 'entry_fee') {
            lineItems.push({
              invoice_id: inv.id,
              item_name: 'Award Entry Fee',
              quantity: 1,
              unit_price: inv.total_amount,
              line_total: inv.total_amount,
            });
          } else {
            lineItems.push({
              invoice_id: inv.id,
              item_name: 'Sponsorship Package',
              quantity: 1,
              unit_price: inv.total_amount,
              line_total: inv.total_amount,
            });
          }
        }
        for (let dli = 0; dli < invoices.length; dli++) {
          try {
            await self.db.from('invoice_line_items').delete().eq('invoice_id', invoices[dli].id);
          } catch (e3) {}
        }
        const liResult = await self._safeWrite('invoice_line_items', lineItems, 'Line items', 'insert');
        self._logErr('Line items', liResult.error);

        const paidInvoices = invoices.filter(function (inv) {
          return inv.payment_status === 'paid';
        });
        const payments = paidInvoices.map(function (inv, i) {
          return {
            id: uid(self.PAYMENT_PREFIX, i + 1),
            payment_reference: 'TEST-PAY-2025-' + String(i + 1).padStart(4, '0'),
            invoice_id: inv.id,
            organisation_id: inv.organisation_id,
            payment_date: new Date(Date.now() - (10 - i * 2) * 86400000).toISOString().split('T')[0],
            amount: inv.total_amount,
            payment_method: ['bank_transfer', 'card', 'stripe'][i % 3],
            status: 'completed',
            notes: '[TEST MODE] Payment for ' + inv.invoice_number,
          };
        });
        const payResult = await self._safeWrite('payments', payments, 'Payments', 'upsert');
        self._logErr('Payments', payResult.error);
      },

      /** Generate Media Gallery data */
      async generateMediaData(eventId, orgs, awards) {
        const galleries = [
          {
            id: uid(self.GALLERY_PREFIX, 1),
            event_id: eventId,
            gallery_name: 'TEST_MODE_Awards Ceremony',
            gallery_description: 'Photos from the main ceremony',
            display_order: 1,
          },
          {
            id: uid(self.GALLERY_PREFIX, 2),
            event_id: eventId,
            gallery_name: 'TEST_MODE_Winners Collection',
            gallery_description: 'Winner announcement photos',
            display_order: 2,
          },
        ];
        const galResult = await self._safeWrite('event_galleries', galleries, 'Galleries', 'upsert');
        self._logErr('Galleries', galResult.error);

        const mediaItems = [];
        for (let mi = 0; mi < 10; mi++) {
          mediaItems.push({
            id: uid(self.MEDIA_ITEM_PREFIX, mi + 1),
            event_id: eventId,
            media_type: mi < 8 ? 'image' : 'video',
            title: 'TEST_MODE_Photo ' + (mi + 1),
            description: 'Test media item ' + (mi + 1) + ' from the awards ceremony',
            organisation_id: orgs[mi].id,
            award_id: awards[mi % 10].id,
            published: mi < 7,
            display_order: mi + 1,
          });
        }
        const miResult = await self._safeWrite('media_items', mediaItems, 'Media items', 'upsert');
        self._logErr('Media items', miResult.error);

        const mediaGallery = [];
        for (let mg = 0; mg < 8; mg++) {
          mediaGallery.push({
            id: uid(self.MEDIA_GAL_PREFIX, mg + 1),
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
            show_on_company_page: true,
          });
        }
        const mgResult = await self._safeWrite('media_gallery', mediaGallery, 'Media gallery', 'upsert');
        self._logErr('Media gallery', mgResult.error);
      },

      /** Generate Running Order for the test event */
      async generateRunningOrder(eventId, awards, orgs, winnerOrgIndices) {
        const runningOrder = [];
        for (let ro = 0; ro < 10; ro++) {
          const winnerOrgIdx = winnerOrgIndices[ro][0];
          runningOrder.push({
            id: uid(self.RUNNING_PREFIX, ro + 1),
            event_id: eventId,
            organisation_id: uid(self.ORG_PREFIX, winnerOrgIdx),
            award_id: awards[ro].id,
            display_name: orgs[winnerOrgIdx - 1].company_name.replace('TEST_MODE_', ''),
            award_name: awards[ro].award_name.replace('TEST_MODE_', ''),
            award_number: '1-' + String(ro + 1).padStart(2, '0'),
            display_order: ro + 1,
            section: 1,
            status: ro < 3 ? 'completed' : ro < 6 ? 'announced' : 'pending',
            duration_minutes: 5,
            notes: ro === 0 ? 'Opening award - extra time for speech' : null,
          });
        }
        try {
          await self.db.from('running_order').delete().eq('event_id', eventId);
        } catch (e2) {}
        const roResult = await self._safeWrite('running_order', runningOrder, 'Running order', 'insert');
        self._logErr('Running order', roResult.error);

        const rosResult = await self._safeWrite(
          'running_order_settings',
          {
            id: uid(self.RUNNING_PREFIX, 99),
            event_id: eventId,
            settings: { time_per_award: 5, break_after: 5, ceremony_type: 'formal' },
            is_published: false,
          },
          'Running order settings',
          'upsert'
        );
        self._logErr('Running order settings', rosResult.error);
      },

      /** Seed counties reference data if the table is empty */
      async seedCounties() {
        const { count } = await self.db.from('counties').select('*', { count: 'exact', head: true });
        if (count && count > 0) return;

        const counties = [
          { Name: 'Camden', region: 'London' },
          { Name: 'Westminster', region: 'London' },
          { Name: 'Southwark', region: 'London' },
          { Name: 'Greenwich', region: 'London' },
          { Name: 'Manchester', region: 'North West' },
          { Name: 'Birmingham', region: 'West Midlands' },
          { Name: 'West Yorkshire', region: 'North East' },
          { Name: 'South Yorkshire', region: 'North East' },
          { Name: 'Surrey', region: 'South East' },
          { Name: 'Kent', region: 'South East' },
          { Name: 'Essex', region: 'East of England' },
          { Name: 'Hampshire', region: 'South East' },
          { Name: 'Lancashire', region: 'North West' },
          { Name: 'Liverpool', region: 'North West' },
          { Name: 'Tyne & Wear', region: 'North East' },
          { Name: 'Nottinghamshire', region: 'East Midlands' },
          { Name: 'Derbyshire', region: 'East Midlands' },
          { Name: 'Devon', region: 'South West' },
          { Name: 'Bristol', region: 'South West' },
          { Name: 'Somerset', region: 'South West' },
          { Name: 'Norfolk', region: 'East of England' },
          { Name: 'Suffolk', region: 'East of England' },
          { Name: 'Oxfordshire', region: 'South East' },
          { Name: 'Cambridgeshire', region: 'East of England' },
          { Name: 'Warwickshire', region: 'West Midlands' },
          { Name: 'Staffordshire', region: 'West Midlands' },
          { Name: 'Edinburgh', region: 'Scotland, Central' },
          { Name: 'Glasgow', region: 'Scotland, West' },
          { Name: 'Cardiff', region: 'Wales, South' },
          { Name: 'Swansea', region: 'Wales, South' },
          { Name: 'East Sussex', region: 'South East' },
          { Name: 'West Sussex', region: 'South East' },
          { Name: 'Berkshire', region: 'South East' },
        ];
        const countyResult = await self._safeWrite('counties', counties, 'Counties seed', 'insert');
        if (self._logErr('Counties seed', countyResult.error)) return;
        console.warn('Seeded 30 counties for region/county filtering');
      },

      /** Generate event attendees and ticket types */
      async generateEventExtras(eventId, orgs) {
        const guestTypes = ['vip', 'guest', 'sponsor', 'media', 'staff'];
        const mealPrefs = ['standard', 'vegetarian', 'vegan', 'halal', 'gluten-free'];
        const attendees = [];
        for (let i = 0; i < 20; i++) {
          attendees.push({
            id: uid(self.ATTENDEE_PREFIX, i + 1),
            event_id: eventId,
            attendee_name: orgs[i].contact_name || 'Attendee ' + (i + 1),
            attendee_email: orgs[i].email,
            organisation_id: orgs[i].id,
            table_number: Math.floor(i / 4) + 1,
            meal_preference: mealPrefs[i % 5],
            rsvp_status: i < 15 ? 'confirmed' : i < 18 ? 'pending' : 'declined',
            guest_type: guestTypes[i % 5],
            plus_ones: i % 4 === 0 ? 1 : 0,
            checked_in: i < 8,
            check_in_time: i < 8 ? new Date(Date.now() - (20 - i) * 60000).toISOString() : null,
            notes: i === 0 ? 'VIP - ensure table 1 placement' : null,
          });
        }
        try {
          await self.db.from('event_attendees').delete().eq('event_id', eventId);
        } catch (e2) {}
        const attResult = await self._safeWrite('event_attendees', attendees, 'Attendees', 'insert');
        self._logErr('Attendees', attResult.error);

        const ticketTypes = [
          {
            id: uid(self.TICKET_TYPE_PREFIX, 1),
            event_id: eventId,
            name: 'TEST_MODE_Standard Ticket',
            description: 'General admission with dinner',
            price: 150.0,
            quantity: 200,
            sold: 142,
            early_bird_price: 120.0,
            includes_table: false,
            is_active: true,
          },
          {
            id: uid(self.TICKET_TYPE_PREFIX, 2),
            event_id: eventId,
            name: 'TEST_MODE_VIP Table (10)',
            description: 'Premium table of 10 with champagne reception',
            price: 2000.0,
            quantity: 20,
            sold: 15,
            early_bird_price: 1750.0,
            includes_table: true,
            table_size: 10,
            is_active: true,
          },
          {
            id: uid(self.TICKET_TYPE_PREFIX, 3),
            event_id: eventId,
            name: 'TEST_MODE_Corporate Package',
            description: 'Branding, 2 tables, sponsor recognition',
            price: 5000.0,
            quantity: 10,
            sold: 4,
            includes_table: true,
            table_size: 10,
            is_active: true,
          },
        ];
        const ttResult = await self._safeWrite('event_ticket_types', ticketTypes, 'Ticket types', 'upsert');
        self._logErr('Ticket types', ttResult.error);
      },

      /** Generate email templates and social media posts; email list fixtures delegate to emailFixtures */
      async generateMarketingExtras(awards, orgs) {
        const templates = [
          {
            id: uid(self.TEMPLATE_PREFIX, 1),
            name: 'TEST_MODE_Entry Confirmation',
            subject: 'Your award entry has been received',
            body: '<h2>Thank you for your entry!</h2><p>We have received your submission for {{award_name}}. Your entry number is {{entry_number}}.</p><p>We will be in touch with updates as the judging process progresses.</p>',
            description: 'Sent when a new entry is submitted',
            is_active: true,
            is_default: true,
          },
          {
            id: uid(self.TEMPLATE_PREFIX, 2),
            name: 'TEST_MODE_Shortlist Notification',
            subject: 'Congratulations! You have been shortlisted',
            body: '<h2>Congratulations {{company_name}}!</h2><p>We are delighted to inform you that your entry for {{award_name}} has been shortlisted.</p><p>The winners will be announced at the Awards Gala on {{event_date}}.</p>',
            description: 'Sent to shortlisted entrants',
            is_active: true,
          },
          {
            id: uid(self.TEMPLATE_PREFIX, 3),
            name: 'TEST_MODE_Invoice Reminder',
            subject: 'Payment reminder - Invoice {{invoice_number}}',
            body: '<h2>Payment Reminder</h2><p>This is a reminder that invoice {{invoice_number}} for {{total_amount}} is due on {{due_date}}.</p><p>Please arrange payment at your earliest convenience.</p>',
            description: 'Sent for overdue invoices',
            is_active: true,
          },
          {
            id: uid(self.TEMPLATE_PREFIX, 4),
            name: 'TEST_MODE_Event Invitation',
            subject: 'You are invited to the Awards Gala!',
            body: '<h2>You are invited!</h2><p>We would be honoured to welcome {{company_name}} to the Awards Gala on {{event_date}} at {{venue}}.</p><p>Please RSVP by clicking the link below.</p>',
            description: 'Event invitation email',
            is_active: true,
          },
          {
            id: uid(self.TEMPLATE_PREFIX, 5),
            name: 'TEST_MODE_Winner Announcement',
            subject: 'And the winner is...',
            body: "<h2>Winner Announcement</h2><p>We are thrilled to announce the winners of this year's awards!</p><p>{{winner_list}}</p><p>Congratulations to all our winners and finalists.</p>",
            description: 'Public winner announcement',
            is_active: false,
          },
        ];
        const tplResult = await self._safeWrite('email_templates', templates, 'Email templates', 'upsert');
        self._logErr('Email templates', tplResult.error);

        // Email lists + subscribers (3 fixed fixtures), via the dedicated
        // executeTestDataFixture() path in api/data-proxy.js — no table
        // name, ID or filter originates here.
        try {
          const fixtureResult = await emailFixtures.generate();
          if (!fixtureResult?.success) {
            self._logErr('Email list fixtures', {
              message: (fixtureResult?.errors || []).join(', ') || 'Unknown error',
            });
          }
        } catch (fixtureErr) {
          self._logErr('Email list fixtures', fixtureErr);
        }

        const socialPosts = [
          {
            id: uid(self.SOCIAL_PREFIX, 1),
            company_id: orgs[0].id,
            award_id: awards[0].id,
            content: 'Congratulations to TEST_MODE_Acme Corporation for winning Best Innovation! #Awards2025',
            template_type: 'winner_announcement',
            platforms: ['twitter', 'linkedin'],
            status: 'published',
            scheduled_for: new Date(Date.now() - 7 * 86400000).toISOString(),
          },
          {
            id: uid(self.SOCIAL_PREFIX, 2),
            company_id: orgs[1].id,
            award_id: awards[1].id,
            content: 'Meet our Rising Star finalist: TEST_MODE_Global Dynamics Ltd! #Awards2025 #RisingStar',
            template_type: 'finalist_spotlight',
            platforms: ['twitter', 'facebook', 'instagram'],
            status: 'published',
            scheduled_for: new Date(Date.now() - 5 * 86400000).toISOString(),
          },
          {
            id: uid(self.SOCIAL_PREFIX, 3),
            content: 'Entries are now open for the 2025 Awards! Submit yours today. #Awards2025 #EnterNow',
            template_type: 'call_for_entries',
            platforms: ['twitter', 'linkedin', 'facebook'],
            status: 'scheduled',
            scheduled_for: new Date(Date.now() + 2 * 86400000).toISOString(),
          },
          {
            id: uid(self.SOCIAL_PREFIX, 4),
            content: 'Only 2 weeks until the Awards Gala! Have you got your tickets? #Awards2025 #Countdown',
            template_type: 'event_promotion',
            platforms: ['twitter', 'instagram'],
            status: 'scheduled',
            scheduled_for: new Date(Date.now() + 5 * 86400000).toISOString(),
          },
          {
            id: uid(self.SOCIAL_PREFIX, 5),
            company_id: orgs[3].id,
            award_id: awards[3].id,
            content: 'TEST_MODE_Green Energy Co leads the way in sustainability. Read their story. #GreenBusiness',
            template_type: 'finalist_spotlight',
            platforms: ['linkedin'],
            status: 'draft',
          },
          {
            id: uid(self.SOCIAL_PREFIX, 6),
            content: 'Thank you to all our sponsors for making the 2025 Awards possible! #ThankYou #Awards2025',
            template_type: 'sponsor_thanks',
            platforms: ['twitter', 'linkedin', 'facebook', 'instagram'],
            status: 'draft',
          },
        ];
        const socialResult = await self._safeWrite('social_media_posts', socialPosts, 'Social media posts', 'upsert');
        self._logErr('Social media posts', socialResult.error);
      },

      /** Generate CRM follow-ups and scheduled reports */
      async generateExtras(orgs) {
        const followUps = [
          {
            id: uid(self.FOLLOWUP_PREFIX, 1),
            organisation_id: orgs[0].id,
            company_name: orgs[0].company_name,
            follow_up_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
            note: 'TEST_MODE_Follow up on platinum sponsorship proposal',
            completed: false,
            created_by: 'admin@example.com',
          },
          {
            id: uid(self.FOLLOWUP_PREFIX, 2),
            organisation_id: orgs[2].id,
            company_name: orgs[2].company_name,
            follow_up_date: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
            note: 'TEST_MODE_Chase outstanding entry submission',
            completed: false,
            created_by: 'admin@example.com',
          },
          {
            id: uid(self.FOLLOWUP_PREFIX, 3),
            organisation_id: orgs[4].id,
            company_name: orgs[4].company_name,
            follow_up_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
            note: 'TEST_MODE_Discuss event table requirements',
            completed: false,
            created_by: 'admin@example.com',
          },
          {
            id: uid(self.FOLLOWUP_PREFIX, 4),
            organisation_id: orgs[7].id,
            company_name: orgs[7].company_name,
            follow_up_date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
            note: 'TEST_MODE_Send revised invoice for package upgrade',
            completed: true,
            completed_at: new Date().toISOString(),
            created_by: 'admin@example.com',
          },
          {
            id: uid(self.FOLLOWUP_PREFIX, 5),
            organisation_id: orgs[9].id,
            company_name: orgs[9].company_name,
            follow_up_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
            note: 'TEST_MODE_Book photography session for winner profile',
            completed: false,
            created_by: 'admin@example.com',
          },
        ];
        const fuResult = await self._safeWrite('organisation_follow_ups', followUps, 'Follow-ups', 'upsert');
        self._logErr('Follow-ups', fuResult.error);

        const reports = [
          {
            id: uid(self.REPORT_PREFIX, 1),
            name: 'TEST_MODE_Weekly Entry Summary',
            report_type: 'entries',
            frequency: 'weekly',
            recipients: ['admin@example.com'],
            sections: ['entry_stats', 'status_breakdown'],
            is_active: true,
            next_run_at: new Date(Date.now() + 7 * 86400000).toISOString(),
            created_by: 'admin@example.com',
          },
          {
            id: uid(self.REPORT_PREFIX, 2),
            name: 'TEST_MODE_Monthly Financial Report',
            report_type: 'financial',
            frequency: 'monthly',
            recipients: ['admin@example.com', 'finance@example.com'],
            sections: ['revenue', 'payments', 'overdue'],
            is_active: true,
            next_run_at: new Date(Date.now() + 30 * 86400000).toISOString(),
            created_by: 'admin@example.com',
          },
          {
            id: uid(self.REPORT_PREFIX, 3),
            name: 'TEST_MODE_Judge Scoring Progress',
            report_type: 'judging',
            frequency: 'daily',
            recipients: ['admin@example.com'],
            sections: ['judge_progress', 'score_distribution'],
            is_active: false,
            created_by: 'admin@example.com',
          },
        ];
        const repResult = await self._safeWrite('scheduled_reports', reports, 'Scheduled reports', 'upsert');
        self._logErr('Scheduled reports', repResult.error);
      },

      /**
       * Remove all test data created by generateTestData().
       * @returns {Promise<{success: boolean, error?: string}>}
       */
      async removeTestData() {
        try {
          const eventId = self.EVENT_ID;

          const { data: testOrgs } = await self.db
            .from('organisations')
            .select('id')
            .like('company_name', 'TEST_MODE_%');
          const orgIds = (testOrgs || []).map(function (o) {
            return o.id;
          });

          const { data: testAwards } = await self.db.from('award_years').select('id').like('award_name', 'TEST_MODE_%');
          const awardIds = (testAwards || []).map(function (a) {
            return a.id;
          });

          const { data: testEntries } = await self.db.from('entries').select('id').like('entry_number', 'TEST-ENT-%');
          const entryIds = (testEntries || []).map(function (e) {
            return e.id;
          });

          await self._safeDel(self.db.from('scheduled_reports').delete().like('name', 'TEST_MODE_%'));
          await self._safeDel(self.db.from('organisation_follow_ups').delete().like('note', 'TEST_MODE_%'));
          if (orgIds.length > 0) {
            await self._safeDel(self.db.from('organisation_follow_ups').delete().in('organisation_id', orgIds));
          }
          await self._safeDel(self.db.from('social_media_posts').delete().like('content', '%TEST_MODE_%'));
          if (orgIds.length > 0) {
            await self._safeDel(self.db.from('social_media_posts').delete().in('company_id', orgIds));
          }

          try {
            const fixtureResult = await emailFixtures.clear();
            if (!fixtureResult?.success) {
              console.warn('Cleanup skip: email list fixtures', (fixtureResult?.errors || []).join(', '));
            }
          } catch (e3) {
            console.warn('Cleanup skip: email list fixtures', e3.message);
          }
          await self._safeDel(self.db.from('email_templates').delete().like('name', 'TEST_MODE_%'));
          await self._safeDel(self.db.from('event_tickets').delete().eq('event_id', eventId));
          await self._safeDel(self.db.from('event_ticket_types').delete().eq('event_id', eventId));
          await self._safeDel(self.db.from('event_attendees').delete().eq('event_id', eventId));

          for (let pv = 0; pv < entryIds.length; pv++) {
            await self._safeDel(self.db.from('public_votes').delete().eq('entry_id', entryIds[pv]));
          }
          for (let js = 0; js < entryIds.length; js++) {
            await self._safeDel(self.db.from('judge_scores').delete().eq('entry_id', entryIds[js]));
          }
          await self._safeDel(self.db.from('entries').delete().like('entry_number', 'TEST-ENT-%'));

          try {
            const { data: testSegs } = await self.db
              .from('contact_segments')
              .select('id')
              .like('segment_name', 'TEST_MODE_%');
            if (testSegs && testSegs.length > 0) {
              for (let os = 0; os < testSegs.length; os++) {
                await self._safeDel(self.db.from('organisation_segments').delete().eq('segment_id', testSegs[os].id));
              }
            }
          } catch (e3) {
            console.warn('Cleanup skip: organisation_segments', e3.message);
          }

          await self._safeDel(self.db.from('contact_segments').delete().like('segment_name', 'TEST_MODE_%'));
          await self._safeDel(self.db.from('meeting_notes').delete().like('subject', 'TEST_MODE_%'));
          if (orgIds.length > 0) {
            await self._safeDel(self.db.from('meeting_notes').delete().in('organisation_id', orgIds));
          }
          await self._safeDel(self.db.from('communications').delete().like('subject', 'TEST_MODE_%'));
          if (orgIds.length > 0) {
            await self._safeDel(self.db.from('communications').delete().in('organisation_id', orgIds));
          }
          await self._safeDel(self.db.from('deals').delete().like('title', 'TEST_MODE_%'));
          if (orgIds.length > 0) {
            await self._safeDel(self.db.from('deals').delete().in('organisation_id', orgIds));
          }

          if (orgIds.length > 0) {
            await self._safeDel(self.db.from('organisation_contacts').delete().in('organisation_id', orgIds));
          }

          await self._safeDel(self.db.from('payments').delete().like('payment_reference', 'TEST-PAY-%'));

          try {
            const { data: testInvoices } = await self.db
              .from('invoices')
              .select('id')
              .like('invoice_number', 'TEST-INV-%');
            if (testInvoices && testInvoices.length > 0) {
              for (let il = 0; il < testInvoices.length; il++) {
                await self._safeDel(self.db.from('invoice_line_items').delete().eq('invoice_id', testInvoices[il].id));
              }
            }
          } catch (e3) {
            console.warn('Cleanup skip: invoice_line_items', e3.message);
          }

          await self._safeDel(self.db.from('invoices').delete().like('invoice_number', 'TEST-INV-%'));
          await self._safeDel(self.db.from('sponsors').delete().like('name', 'TEST_MODE_%'));
          await self._safeDel(self.db.from('banners').delete().like('title', 'TEST_MODE_%'));
          await self._safeDel(self.db.from('media_gallery').delete().like('title', 'TEST_MODE_%'));
          if (orgIds.length > 0) {
            await self._safeDel(self.db.from('media_gallery').delete().in('organisation_id', orgIds));
          }
          await self._safeDel(self.db.from('media_items').delete().like('title', 'TEST_MODE_%'));
          await self._safeDel(self.db.from('media_items').delete().eq('event_id', eventId));
          await self._safeDel(self.db.from('event_galleries').delete().like('gallery_name', 'TEST_MODE_%'));
          await self._safeDel(self.db.from('event_galleries').delete().eq('event_id', eventId));
          await self._safeDel(self.db.from('table_assignments').delete().eq('event_id', eventId));
          await self._safeDel(self.db.from('event_tables').delete().eq('event_id', eventId));
          await self._safeDel(self.db.from('running_order').delete().eq('event_id', eventId));
          await self._safeDel(self.db.from('running_order_settings').delete().eq('event_id', eventId));
          await self._safeDel(self.db.from('event_guests').delete().eq('event_id', eventId));

          if (awardIds.length > 0) {
            await self._safeDel(self.db.from('award_assignments').delete().in('award_id', awardIds));
          }
          if (orgIds.length > 0) {
            await self._safeDel(self.db.from('award_assignments').delete().in('organisation_id', orgIds));
          }
          if (awardIds.length > 0) {
            await self._safeDel(self.db.from('winners').delete().in('award_id', awardIds));
          }
          if (orgIds.length > 0) {
            await self._safeDel(self.db.from('winners').delete().in('organisation_id', orgIds));
          }

          await self._safeDel(self.db.from('organisations').delete().like('company_name', 'TEST_MODE_%'));
          await self._safeDel(self.db.from('award_years').delete().like('award_name', 'TEST_MODE_%'));
          await self._safeDel(self.db.from('events').delete().eq('id', eventId));

          return { success: true };
        } catch (error) {
          console.error('Error removing test data:', error);
          return { success: false, error: 'Some test data may not have been removed.' };
        }
      },

      /**
       * Read-only fixture status/counts.
       * @returns {Promise<object>} raw counts; the caller builds any display text.
       */
      async getStatus() {
        const results = await Promise.all([
          self.db.from('events').select('*').eq('id', self.EVENT_ID).single(),
          self.db.from('organisations').select('*', { count: 'exact', head: true }).like('company_name', 'TEST_MODE_%'),
          self.db.from('awards').select('*', { count: 'exact', head: true }).like('award_name', 'TEST_MODE_%'),
          self.db.from('event_guests').select('*', { count: 'exact', head: true }).eq('event_id', self.EVENT_ID),
          self.db.from('entries').select('*', { count: 'exact', head: true }).like('entry_number', 'TEST-ENT-%'),
          self.db.from('sponsors').select('*', { count: 'exact', head: true }).like('name', 'TEST_MODE_%'),
          self.db.from('banners').select('*', { count: 'exact', head: true }).like('title', 'TEST_MODE_%'),
          self.db.from('invoices').select('*', { count: 'exact', head: true }).like('invoice_number', 'TEST-INV-%'),
          self.db
            .from('organisation_contacts')
            .select('*', { count: 'exact', head: true })
            .like('id', self.CONTACT_PREFIX + '%'),
          self.db.from('deals').select('*', { count: 'exact', head: true }).like('title', 'TEST_MODE_%'),
          self.db.from('communications').select('*', { count: 'exact', head: true }).like('subject', 'TEST_MODE_%'),
        ]);

        return {
          hasTestEvent: !!results[0].data,
          organisations: results[1].count || 0,
          awards: results[2].count || 0,
          rsvps: results[3].count || 0,
          entries: results[4].count || 0,
          sponsors: results[5].count || 0,
          banners: results[6].count || 0,
          invoices: results[7].count || 0,
          contacts: results[8].count || 0,
          deals: results[9].count || 0,
          communications: results[10].count || 0,
        };
      },

      /**
       * Generate a single mock pending order (organisation + invoice + line items).
       * @returns {Promise<{success: boolean, invoiceNumber?: string, error?: string}>}
       */
      async generateMockOrder() {
        try {
          let testOrg;
          const { data: existingOrg } = await self.db
            .from('organisations')
            .select('id, company_name')
            .eq('company_name', 'TEST_MODE_Mock Company Ltd')
            .single();

          if (existingOrg) {
            testOrg = existingOrg;
          } else {
            const { data: newOrg, error: orgError } = await self.db
              .from('organisations')
              .insert({
                company_name: 'TEST_MODE_Mock Company Ltd',
                contact_name: 'Test Contact',
                email: 'test@mockcompany.com',
                status: 'active',
                county_city: 'London',
              })
              .select()
              .single();

            if (orgError) throw orgError;
            testOrg = newOrg;
          }

          const invoiceNumber = 'TEST-INV-' + Date.now();

          const { data: invoice, error: invoiceError } = await self.db
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
              total_amount: 1250.0,
              currency: 'GBP',
              notes: '[TEST MODE] Mock order for testing dashboard notifications',
            })
            .select()
            .single();

          if (invoiceError) throw invoiceError;

          await self.db.from('invoice_line_items').insert([
            { invoice_id: invoice.id, item_name: 'Gold Package', quantity: 1, unit_price: 1000.0, line_total: 1000.0 },
            { invoice_id: invoice.id, item_name: 'Extra Tickets', quantity: 5, unit_price: 50.0, line_total: 250.0 },
          ]);

          return { success: true, invoiceNumber };
        } catch (error) {
          console.error('Error generating mock order:', error);
          return { success: false, error: error.message };
        }
      },

      /**
       * Remove mock pending orders and the mock organisation created by generateMockOrder().
       * @returns {Promise<{success: boolean, error?: string}>}
       */
      async removeMockOrders() {
        try {
          const { data: mockInvoices } = await self.db
            .from('invoices')
            .select('id')
            .like('invoice_number', 'TEST-INV-%');

          if (mockInvoices && mockInvoices.length > 0) {
            for (let i = 0; i < mockInvoices.length; i++) {
              await self.db.from('invoice_line_items').delete().eq('invoice_id', mockInvoices[i].id);
            }
            for (let p = 0; p < mockInvoices.length; p++) {
              await self.db.from('payments').delete().eq('invoice_id', mockInvoices[p].id);
            }
          }

          await self.db.from('invoices').delete().like('invoice_number', 'TEST-INV-%');
          await self.db.from('organisations').delete().eq('company_name', 'TEST_MODE_Mock Company Ltd');

          return { success: true };
        } catch (error) {
          console.error('Error removing mock orders:', error);
          return { success: false, error: error.message };
        }
      },
    },
    PREFIXES
  );

  return self;
}

module.exports = { createTestDataFixtures, PREFIXES };
