// ============================================
// CRM MODULE FOR AWARDS CMS
// Customer Relationship Management System
// ============================================

const crmModule = {
  currentSubTab: 'companies-crm',
  allCompanies: [],
  filters: {
    companies: {},
    communications: { type: 'all', regarding: 'all', followUpRequired: 'all' },
    deals: { stage: 'all', type: 'all', status: 'active' },
    meetings: { type: 'all' },
    segments: {}
  },

  // Pagination, sorting, selection & view state
  _crmCurrentPage: 1,
  _crmPageSize: 50,
  _crmSortField: 'created_at',
  _crmSortDir: 'desc',
  _selectedCrmIds: new Set(),
  _dealCurrentPage: 1,
  _dealPageSize: 50,
  _dealSortField: 'created_at',
  _dealSortDir: 'desc',
  _selectedDealIds: new Set(),
  _meetingCurrentPage: 1,
  _meetingPageSize: 50,
  _meetingSortField: 'meeting_date',
  _meetingSortDir: 'desc',
  _selectedMeetingIds: new Set(),
  _kanbanView: false,

  // ============================================
  // MAIN LOAD FUNCTION
  // ============================================
  async loadAllData() {
    console.log('🎯 Loading CRM data...');
    try {
      // Load data based on current sub-tab
      switch(this.currentSubTab) {
        case 'companies-crm':
          await this.loadCompanies();
          break;
        case 'communications':
          await this.loadCommunications();
          break;
        case 'deals':
          await this.loadDeals();
          break;
        case 'meetings':
          await this.loadMeetings();
          break;
        case 'segments':
          await this.loadSegments();
          break;
        case 'smart-segments':
          // Smart segments are client-side only, no data to load
          break;
        case 'my-tasks':
          await this.loadMyTasks();
          break;
      }
    } catch (error) {
      console.error('Error loading CRM data:', error);
      utils.showErrorWithRetry(error, 'loading CRM data', () => this.loadAllData());
    }
  },

  // ============================================
  // COMPANIES CRM VIEW
  // ============================================
  async loadCompanies() {
    console.log('Loading companies CRM view...');

    try {
      // Load organisations with CRM summary from view
      const { data: companies, error } = await STATE.client
        .from('organisations_with_crm_summary')
        .select('*')
        .order('last_communication_date', { ascending: false, nullsFirst: false });

      if (error) throw error;

      // Calculate quick stats
      const stats = {
        totalCompanies: companies.length,
        activeDeals: companies.reduce((sum, c) => sum + (c.active_deals || 0), 0),
        recentCommunications: companies.filter(c => {
          if (!c.last_communication_date) return false;
          const lastComm = new Date(c.last_communication_date);
          const daysAgo = (Date.now() - lastComm.getTime()) / (1000 * 60 * 60 * 24);
          return daysAgo <= 7;
        }).length,
        pendingFollowUps: companies.reduce((sum, c) => sum + (c.pending_follow_ups || 0), 0)
      };

      // Update stats display (elements may not exist in all views)
      const el1 = document.getElementById('totalCompaniesCount');
      const el2 = document.getElementById('activeDealsCount');
      const el3 = document.getElementById('recentCommunicationsCount');
      const el4 = document.getElementById('pendingFollowUpsCount');
      if (el1) el1.textContent = stats.totalCompanies;
      if (el2) el2.textContent = stats.activeDeals;
      if (el3) el3.textContent = stats.recentCommunications;
      if (el4) el4.textContent = stats.pendingFollowUps;

      // Store full companies list for client-side filtering
      this.allCompanies = companies;

      // Populate segment filter dropdown from unique segments
      const segmentFilter = document.getElementById('crmSegmentFilter');
      if (segmentFilter) {
        const segments = new Set();
        companies.forEach(c => {
          if (c.segments) {
            c.segments.split(',').forEach(s => {
              const trimmed = s.trim();
              if (trimmed) segments.add(trimmed);
            });
          }
        });
        const currentVal = segmentFilter.value;
        segmentFilter.innerHTML = '<option value="">All Companies</option>' +
          [...segments].sort().map(s => `<option value="${utils.escapeHtml(s)}">${utils.escapeHtml(s)}</option>`).join('');
        segmentFilter.value = currentVal;
      }

      // Render companies table
      this.renderCompaniesTable(companies);

    } catch (error) {
      console.error('Error loading companies:', error);
      utils.showErrorWithRetry(error, 'loading companies', () => this.loadCompanies());
    }
  },

  renderCompaniesTable(companies) {
    const tbody = document.getElementById('companiesCrmTableBody');
    if (!tbody) return;

    if (!companies || companies.length === 0) {
      utils.showEnhancedEmptyState('companiesCrmTableBody', 8, { icon: 'bi-building', message: 'No companies found', description: 'Companies will appear here once added' });
      return;
    }

    tbody.innerHTML = companies.map(company => {
      const lastContact = company.last_communication_date
        ? new Date(company.last_communication_date).toLocaleDateString()
        : '<span class="text-muted">Never</span>';

      const pipelineValue = company.pipeline_value
        ? `£${parseFloat(company.pipeline_value).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
        : '£0.00';

      const segments = company.segments ? utils.escapeHtml(company.segments) : '<span class="text-muted">None</span>';

      return `
        <tr>
          <td>
            <strong>${utils.escapeHtml(company.company_name || 'Unknown')}</strong><br>
            <small class="text-muted">${utils.escapeHtml(company.industry || 'N/A')}</small>
          </td>
          <td>${segments}</td>
          <td class="text-center">${company.communication_count || 0}</td>
          <td class="text-center">${company.active_deals || 0}</td>
          <td>${pipelineValue}</td>
          <td>${lastContact}</td>
          <td class="text-center">
            ${company.pending_follow_ups > 0
              ? `<span class="badge bg-warning text-dark">${company.pending_follow_ups}</span>`
              : '<span class="text-muted">-</span>'}
          </td>
          <td>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" onclick="crmModule.viewCompanyProfile('${company.id}')" title="View Profile" aria-label="View company profile">
                <i class="bi bi-eye"></i>
              </button>
              <button class="btn btn-outline-success" onclick="crmModule.logCommunication('${company.id}')" title="Log Communication" aria-label="Log communication">
                <i class="bi bi-chat-dots"></i>
              </button>
              <button class="btn btn-outline-info" onclick="crmModule.createDeal('${company.id}')" title="Create Deal" aria-label="Create deal">
                <i class="bi bi-cash-coin"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  filterCompanies() {
    const searchVal = (document.getElementById('crmCompanySearch')?.value || '').toLowerCase();
    const segmentVal = document.getElementById('crmSegmentFilter')?.value || '';

    let filtered = this.allCompanies;

    if (searchVal) {
      filtered = filtered.filter(c =>
        (c.company_name || '').toLowerCase().includes(searchVal)
      );
    }

    if (segmentVal) {
      filtered = filtered.filter(c =>
        c.segments && c.segments.split(',').map(s => s.trim()).includes(segmentVal)
      );
    }

    // If search query is active and no exact matches found, try fuzzy search
    if (searchVal && filtered.length === 0) {
      filtered = utils.fuzzyFilter(this.allCompanies, searchVal, ['company_name', 'contact_name', 'email']);
      // Also apply non-search filters to fuzzy results
      if (segmentVal) filtered = filtered.filter(c => c.segments && c.segments.split(',').map(s => s.trim()).includes(segmentVal));
    }

    this.renderCompaniesTable(filtered);
  },

  // ============================================
  // COMMUNICATIONS LOG
  // ============================================
  async loadCommunications() {
    console.log('Loading communications...');

    // Read filter values from DOM
    const typeEl = document.getElementById('communicationTypeFilter');
    const regardingEl = document.getElementById('communicationRegardingFilter');
    const followUpEl = document.getElementById('communicationFollowUpFilter');
    this.filters.communications.type = typeEl && typeEl.value ? typeEl.value : 'all';
    this.filters.communications.regarding = regardingEl && regardingEl.value ? regardingEl.value : 'all';
    this.filters.communications.followUpRequired = followUpEl && followUpEl.value ? followUpEl.value : 'all';

    try {
      let query = STATE.client
        .from('communications')
        .select(`
          *,
          organisation:organisations(company_name),
          contact:organisation_contacts(first_name, last_name, email)
        `)
        .order('communication_date', { ascending: false });

      // Apply filters
      if (this.filters.communications.type !== 'all') {
        query = query.eq('type', this.filters.communications.type);
      }
      if (this.filters.communications.regarding !== 'all') {
        query = query.eq('regarding', this.filters.communications.regarding);
      }
      if (this.filters.communications.followUpRequired !== 'all') {
        query = query.eq('follow_up_required', this.filters.communications.followUpRequired === 'true');
      }

      const { data: communications, error } = await query;

      if (error) throw error;

      this._communications = communications || [];
      this.renderCommunicationsTable(this._communications);

    } catch (error) {
      console.error('Error loading communications:', error);
      utils.showErrorWithRetry(error, 'loading communications', () => this.loadCommunications());
    }
  },

  renderCommunicationsTable(communications) {
    const tbody = document.getElementById('communicationsTableBody');
    if (!tbody) return;

    if (!communications || communications.length === 0) {
      utils.showEnhancedEmptyState('communicationsTableBody', 8, { icon: 'bi-chat-dots', message: 'No communications found', description: 'Communications will appear here once logged' });
      return;
    }

    // Pagination
    const commTotalPages = Math.ceil(communications.length / this._crmPageSize);
    if (this._crmCurrentPage > commTotalPages) this._crmCurrentPage = commTotalPages || 1;
    const commStart = (this._crmCurrentPage - 1) * this._crmPageSize;
    const commEnd = commStart + this._crmPageSize;
    const pageComms = communications.slice(commStart, commEnd);

    tbody.innerHTML = pageComms.map(comm => {
      const date = new Date(comm.communication_date).toLocaleDateString();
      const companyName = comm.organisation?.company_name || 'Unknown';
      const contactName = comm.contact
        ? `${comm.contact.first_name} ${comm.contact.last_name}`
        : '<span class="text-muted">N/A</span>';

      const typeBadge = this.getTypeBadge(comm.type);
      const directionBadge = comm.direction === 'inbound'
        ? '<span class="badge bg-info"><i class="bi bi-arrow-down-left me-1"></i>Inbound</span>'
        : '<span class="badge bg-primary"><i class="bi bi-arrow-up-right me-1"></i>Outbound</span>';

      const followUpBadge = comm.follow_up_required
        ? `<span class="badge bg-warning text-dark">
             <i class="bi bi-calendar-check me-1"></i>${comm.follow_up_date ? new Date(comm.follow_up_date).toLocaleDateString() : 'ASAP'}
           </span>`
        : '<span class="text-muted">-</span>';

      return `
        <tr>
          <td>${date}<br><small>${directionBadge}</small></td>
          <td>${typeBadge}</td>
          <td>
            <strong>${utils.escapeHtml(companyName)}</strong><br>
            <small class="text-muted">${utils.escapeHtml(contactName)}</small>
          </td>
          <td>
            <strong>${utils.escapeHtml(comm.subject || 'No subject')}</strong><br>
            <small class="text-muted">${utils.escapeHtml((comm.message || '').substring(0, 50))}${(comm.message || '').length > 50 ? '...' : ''}</small>
          </td>
          <td>${this.formatRegarding(comm.regarding)}</td>
          <td>${followUpBadge}</td>
          <td>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" onclick="crmModule.viewCommunication('${comm.id}')" title="View Details">
                <i class="bi bi-eye"></i>
              </button>
              <button class="btn btn-outline-success" onclick="crmModule.editCommunication('${comm.id}')" title="Edit">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-danger" onclick="crmModule.deleteCommunication('${comm.id}')" title="Delete">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Pagination controls
    this._renderCrmPagination('crmCommsPagination', this._crmCurrentPage, commTotalPages, 'crmModule.goToCrmCommPage', 'communicationsTableBody');
  },

  goToCrmCommPage(page) {
    const total = Math.ceil((this._communications || []).length / this._crmPageSize);
    this._crmCurrentPage = Math.max(1, Math.min(page, total));
    this.renderCommunicationsTable(this._communications);
  },

  getTypeBadge(type) {
    const types = {
      'email': '<span class="badge bg-primary"><i class="bi bi-envelope me-1"></i>Email</span>',
      'phone': '<span class="badge bg-success"><i class="bi bi-telephone me-1"></i>Phone</span>',
      'meeting': '<span class="badge bg-info"><i class="bi bi-calendar-event me-1"></i>Meeting</span>',
      'note': '<span class="badge bg-secondary"><i class="bi bi-sticky me-1"></i>Note</span>',
      'text': '<span class="badge bg-warning text-dark"><i class="bi bi-chat-text me-1"></i>Text</span>',
      'linkedin': '<span class="badge bg-primary"><i class="bi bi-linkedin me-1"></i>LinkedIn</span>'
    };
    return types[type] || `<span class="badge bg-secondary">${type}</span>`;
  },

  formatRegarding(regarding) {
    if (!regarding) return '<span class="text-muted">General</span>';
    return regarding.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  },

  // ============================================
  // DEAL PIPELINE
  // ============================================
  async loadDeals() {
    console.log('Loading deals...');

    try {
      let query = STATE.client
        .from('deals')
        .select(`
          *,
          organisation:organisations(company_name),
          contact:organisation_contacts(first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (this.filters.deals.stage !== 'all') {
        query = query.eq('stage', this.filters.deals.stage);
      }
      if (this.filters.deals.type !== 'all') {
        query = query.eq('deal_type', this.filters.deals.type);
      }
      if (this.filters.deals.status !== 'all') {
        query = query.eq('status', this.filters.deals.status);
      }

      const { data: deals, error } = await query;

      if (error) throw error;

      // Calculate pipeline stats
      const activeDeals = deals.filter(d => d.status === 'active');
      const stats = {
        activeCount: activeDeals.length,
        pipelineValue: activeDeals.reduce((sum, d) => sum + parseFloat(d.deal_value || 0), 0),
        wonThisMonth: deals.filter(d => {
          if (d.status !== 'won' || !d.actual_close_date) return false;
          const closeDate = new Date(d.actual_close_date);
          const now = new Date();
          return closeDate.getMonth() === now.getMonth() && closeDate.getFullYear() === now.getFullYear();
        }).length,
        winRate: deals.filter(d => d.status === 'won' || d.status === 'lost').length > 0
          ? Math.round((deals.filter(d => d.status === 'won').length / deals.filter(d => d.status === 'won' || d.status === 'lost').length) * 100)
          : 0
      };

      // Update stats display (elements may not exist in all views)
      const dEl1 = document.getElementById('totalActiveDeals');
      const dEl2 = document.getElementById('totalPipelineValue');
      const dEl3 = document.getElementById('dealsWonThisMonth');
      const dEl4 = document.getElementById('averageWinRate');
      if (dEl1) dEl1.textContent = stats.activeCount;
      if (dEl2) dEl2.textContent = `£${stats.pipelineValue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
      if (dEl3) dEl3.textContent = stats.wonThisMonth;
      if (dEl4) dEl4.textContent = `${stats.winRate}%`;

      this._deals = deals || [];
      this.renderDealsTable(this._deals);

    } catch (error) {
      console.error('Error loading deals:', error);
      utils.showErrorWithRetry(error, 'loading deals', () => this.loadDeals());
    }
  },

  renderDealsTable(deals) {
    // Kanban view toggle
    if (this._kanbanView) {
      this.renderKanbanBoard();
      return;
    }

    const tbody = document.getElementById('dealsTableBody');
    if (!tbody) return;

    if (!deals || deals.length === 0) {
      utils.showEnhancedEmptyState('dealsTableBody', 9, { icon: 'bi-handshake', message: 'No deals found', description: 'Deals will appear here once created' });
      return;
    }

    // Pagination
    const dealTotalPages = Math.ceil(deals.length / this._dealPageSize);
    if (this._dealCurrentPage > dealTotalPages) this._dealCurrentPage = dealTotalPages || 1;
    const dealStart = (this._dealCurrentPage - 1) * this._dealPageSize;
    const dealEnd = dealStart + this._dealPageSize;
    const pageDeals = deals.slice(dealStart, dealEnd);

    tbody.innerHTML = pageDeals.map(deal => {
      const companyName = deal.organisation?.company_name || 'Unknown';
      const stageBadge = this.getStageBadge(deal.stage);
      const statusBadge = this.getStatusBadge(deal.status);
      const typeBadge = this.getDealTypeBadge(deal.deal_type);
      const value = `£${parseFloat(deal.deal_value).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
      const expectedClose = deal.expected_close_date
        ? new Date(deal.expected_close_date).toLocaleDateString()
        : '<span class="text-muted">TBD</span>';

      return `
        <tr>
          <td>
            <strong>${utils.escapeHtml(deal.deal_name)}</strong><br>
            <small class="text-muted">${deal.description ? utils.escapeHtml(deal.description.substring(0, 40)) + (deal.description.length > 40 ? '...' : '') : ''}</small>
          </td>
          <td>${utils.escapeHtml(companyName)}</td>
          <td>${typeBadge}</td>
          <td>${stageBadge}</td>
          <td class="text-end">${value}</td>
          <td class="text-center">
            <div class="progress" style="height: 20px;">
              <div class="progress-bar" role="progressbar" style="width: ${deal.probability}%;"
                   aria-valuenow="${deal.probability}" aria-valuemin="0" aria-valuemax="100">
                ${deal.probability}%
              </div>
            </div>
          </td>
          <td>${expectedClose}</td>
          <td>${statusBadge}</td>
          <td>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" onclick="crmModule.viewDeal('${deal.id}')" title="View Details">
                <i class="bi bi-eye"></i>
              </button>
              <button class="btn btn-outline-success" onclick="crmModule.editDeal('${deal.id}')" title="Edit">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-danger" onclick="crmModule.deleteDeal('${deal.id}')" title="Delete">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Pagination controls
    this._renderCrmPagination('crmDealsPagination', this._dealCurrentPage, dealTotalPages, 'crmModule.goToCrmDealPage', 'dealsTableBody');
  },

  goToCrmDealPage(page) {
    const total = Math.ceil((this._deals || []).length / this._dealPageSize);
    this._dealCurrentPage = Math.max(1, Math.min(page, total));
    this.renderDealsTable(this._deals);
  },

  getStageBadge(stage) {
    const stages = {
      'lead': '<span class="badge bg-secondary">Lead</span>',
      'contacted': '<span class="badge bg-info">Contacted</span>',
      'qualified': '<span class="badge bg-primary">Qualified</span>',
      'proposal': '<span class="badge bg-warning text-dark">Proposal</span>',
      'negotiation': '<span class="badge bg-warning">Negotiation</span>',
      'closed_won': '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Won</span>',
      'closed_lost': '<span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>Lost</span>'
    };
    return stages[stage] || `<span class="badge bg-secondary">${stage}</span>`;
  },

  getStatusBadge(status) {
    const statuses = {
      'active': '<span class="badge bg-success">Active</span>',
      'won': '<span class="badge bg-success"><i class="bi bi-trophy-fill me-1"></i>Won</span>',
      'lost': '<span class="badge bg-danger">Lost</span>',
      'on_hold': '<span class="badge bg-warning text-dark">On Hold</span>',
      'cancelled': '<span class="badge bg-secondary">Cancelled</span>'
    };
    return statuses[status] || `<span class="badge bg-secondary">${status}</span>`;
  },

  getDealTypeBadge(type) {
    const types = {
      'sponsorship': '<span class="badge bg-primary"><i class="bi bi-award me-1"></i>Sponsorship</span>',
      'award_fee': '<span class="badge bg-info"><i class="bi bi-trophy me-1"></i>Award Fee</span>',
      'event_tickets': '<span class="badge bg-success"><i class="bi bi-ticket-perforated me-1"></i>Event Tickets</span>',
      'partnership': '<span class="badge bg-warning text-dark"><i class="bi bi-handshake me-1"></i>Partnership</span>',
      'package_upgrade': '<span class="badge bg-danger"><i class="bi bi-arrow-up-circle me-1"></i>Package Upgrade</span>',
      'other': '<span class="badge bg-secondary">Other</span>'
    };
    return types[type] || `<span class="badge bg-secondary">${type}</span>`;
  },

  // ============================================
  // MEETINGS
  // ============================================
  async loadMeetings() {
    console.log('Loading meetings...');

    try {
      let query = STATE.client
        .from('meeting_notes')
        .select(`
          *,
          organisation:organisations(company_name),
          deal:deals(deal_name)
        `)
        .order('meeting_date', { ascending: false });

      // Apply filters
      if (this.filters.meetings.type !== 'all') {
        query = query.eq('meeting_type', this.filters.meetings.type);
      }

      const { data: meetings, error } = await query;

      if (error) throw error;

      this._meetings = meetings || [];
      this.renderMeetingsTable(this._meetings);

    } catch (error) {
      console.error('Error loading meetings:', error);
      utils.showErrorWithRetry(error, 'loading meetings', () => this.loadMeetings());
    }
  },

  renderMeetingsTable(meetings) {
    const tbody = document.getElementById('meetingsTableBody');
    if (!tbody) return;

    if (!meetings || meetings.length === 0) {
      utils.showEnhancedEmptyState('meetingsTableBody', 8, { icon: 'bi-calendar-check', message: 'No meetings found', description: 'Meetings will appear here once scheduled' });
      return;
    }

    // Pagination
    const mtgTotalPages = Math.ceil(meetings.length / this._meetingPageSize);
    if (this._meetingCurrentPage > mtgTotalPages) this._meetingCurrentPage = mtgTotalPages || 1;
    const mtgStart = (this._meetingCurrentPage - 1) * this._meetingPageSize;
    const mtgEnd = mtgStart + this._meetingPageSize;
    const pageMeetings = meetings.slice(mtgStart, mtgEnd);

    tbody.innerHTML = pageMeetings.map(meeting => {
      const date = new Date(meeting.meeting_date).toLocaleDateString();
      const time = new Date(meeting.meeting_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const companyName = meeting.organisation?.company_name || 'Unknown';
      const typeBadge = this.getMeetingTypeBadge(meeting.meeting_type);
      const duration = meeting.duration_minutes ? `${meeting.duration_minutes} min` : '<span class="text-muted">N/A</span>';

      let attendees = '<span class="text-muted">None</span>';
      try {
        const attendeesList = JSON.parse(meeting.attendees || '[]');
        attendees = attendeesList.length > 0 ? `${attendeesList.length} attendees` : attendees;
      } catch (e) { console.warn('Failed to parse meeting attendees:', e.message); }

      const followUpBadge = meeting.follow_up_required
        ? `<span class="badge bg-warning text-dark">
             <i class="bi bi-calendar-check me-1"></i>${meeting.follow_up_date ? new Date(meeting.follow_up_date).toLocaleDateString() : 'ASAP'}
           </span>`
        : '<span class="text-muted">-</span>';

      return `
        <tr>
          <td>
            ${date}<br>
            <small class="text-muted">${time}</small>
          </td>
          <td>
            <strong>${utils.escapeHtml(meeting.meeting_title)}</strong><br>
            <small class="text-muted">${utils.escapeHtml(companyName)}</small>
          </td>
          <td>${typeBadge}</td>
          <td>${duration}</td>
          <td>${attendees}</td>
          <td>${followUpBadge}</td>
          <td>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" onclick="crmModule.viewMeeting('${meeting.id}')" title="View Details">
                <i class="bi bi-eye"></i>
              </button>
              <button class="btn btn-outline-success" onclick="crmModule.editMeeting('${meeting.id}')" title="Edit">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-danger" onclick="crmModule.deleteMeeting('${meeting.id}')" title="Delete">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Pagination controls
    this._renderCrmPagination('crmMeetingsPagination', this._meetingCurrentPage, mtgTotalPages, 'crmModule.goToCrmMeetingPage', 'meetingsTableBody');
  },

  goToCrmMeetingPage(page) {
    const total = Math.ceil((this._meetings || []).length / this._meetingPageSize);
    this._meetingCurrentPage = Math.max(1, Math.min(page, total));
    this.renderMeetingsTable(this._meetings);
  },

  getMeetingTypeBadge(type) {
    const types = {
      'in_person': '<span class="badge bg-success"><i class="bi bi-person-fill me-1"></i>In Person</span>',
      'video_call': '<span class="badge bg-primary"><i class="bi bi-camera-video me-1"></i>Video Call</span>',
      'phone': '<span class="badge bg-info"><i class="bi bi-telephone me-1"></i>Phone</span>',
      'conference': '<span class="badge bg-warning text-dark"><i class="bi bi-people-fill me-1"></i>Conference</span>'
    };
    return types[type] || `<span class="badge bg-secondary">${type}</span>`;
  },

  // ============================================
  // SEGMENTS
  // ============================================
  async loadSegments() {
    console.log('Loading segments...');

    try {
      // Load all segments with counts
      const { data: segments, error } = await STATE.client
        .from('contact_segments')
        .select(`
          *,
          organisation_segments(count)
        `)
        .order('segment_name');

      if (error) throw error;

      // Use counts already fetched via the join
      const segmentsWithCounts = segments.map(segment => ({
        ...segment,
        count: segment.organisation_segments?.[0]?.count || 0
      }));

      this.renderSegments(segmentsWithCounts);

    } catch (error) {
      console.error('Error loading segments:', error);
      utils.showErrorWithRetry(error, 'loading segments', () => this.loadSegments());
    }
  },

  renderSegments(segments) {
    const container = document.getElementById('segments-content');
    if (!container) return;

    if (!segments || segments.length === 0) {
      container.innerHTML = '<div class="col-12"><p class="text-center text-muted">No segments found</p></div>';
      return;
    }

    container.innerHTML = segments.map(segment => `
      <div class="col-md-4 mb-3">
        <div class="card h-100 border-start border-4" style="border-color: ${segment.color} !important;">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-3">
              <div>
                <h5 class="card-title mb-1">
                  <i class="bi bi-${segment.icon || 'tag'} me-2" style="color: ${segment.color}"></i>
                  ${utils.escapeHtml(segment.segment_name)}
                </h5>
                <p class="card-text text-muted small mb-0">${utils.escapeHtml(segment.description || '')}</p>
              </div>
              <span class="badge rounded-pill" style="background-color: ${segment.color}; font-size: 1.2em;">
                ${segment.count}
              </span>
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-primary flex-grow-1" onclick="crmModule.viewSegmentCompanies('${segment.id}', '${utils.escapeHtml(segment.segment_name).replace(/'/g, "\\'")}')">
                <i class="bi bi-eye me-1"></i>View Companies
              </button>
              <button class="btn btn-sm btn-outline-secondary" onclick="crmModule.editSegment('${segment.id}')" title="Edit Segment">
                <i class="bi bi-pencil"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  },

  // ============================================
  // FILTER FUNCTIONS
  // ============================================
  applyFilter(category, filterType, value) {
    this.filters[category][filterType] = value;

    // Reload data based on category
    switch(category) {
      case 'communications':
        this.loadCommunications();
        break;
      case 'deals':
        this.loadDeals();
        break;
      case 'meetings':
        this.loadMeetings();
        break;
    }
  },

  // Stat-card shortcut filters for deals
  filterDealsActive() {
    this.applyFilter('deals', 'status', 'active');
    document.getElementById('dealStatusFilter').value = 'active';
  },
  filterDealsAll() {
    this.applyFilter('deals', 'status', 'all');
    this.applyFilter('deals', 'stage', 'all');
    document.getElementById('dealStatusFilter').value = '';
    document.getElementById('dealStageFilter').value = '';
  },
  filterDealsWon() {
    this.applyFilter('deals', 'status', 'won');
    document.getElementById('dealStatusFilter').value = 'won';
  },

  // ============================================
  // MODAL & ACTION FUNCTIONS
  // ============================================
  viewCompanyProfile(companyId) {
    // Open the organisation profile modal from organisations.js
    if (typeof orgsModule !== 'undefined' && orgsModule.openCompanyProfile) {
      const org = (STATE.allOrganisations || []).find(o => o.id === companyId);
      orgsModule.openCompanyProfile(companyId, org?.company_name || '');
    } else {
      utils.showToast('Company profile view not available', 'warning');
    }
  },

  async logCommunication(organisationId = null) {
    console.log('Log communication for:', organisationId);
    try {

    // Create modal
    const modalHtml = `
      <div class="modal fade" id="logCommunicationModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-chat-dots me-2"></i>Log Communication</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="logCommunicationForm">
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Type <span class="text-danger">*</span></label>
                    <select class="form-select" id="commType" required>
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                      <option value="meeting">Meeting</option>
                      <option value="note">Note</option>
                      <option value="text">Text</option>
                      <option value="linkedin">LinkedIn</option>
                    </select>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Direction <span class="text-danger">*</span></label>
                    <select class="form-select" id="commDirection" required>
                      <option value="outbound">Outbound</option>
                      <option value="inbound">Inbound</option>
                    </select>
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Company <span class="text-danger">*</span></label>
                  <select class="form-select" id="commOrganisation" required>
                    <option value="">Select company...</option>
                  </select>
                </div>
                <div class="mb-3">
                  <label class="form-label">Contact</label>
                  <select class="form-select" id="commContact">
                    <option value="">Select contact (optional)...</option>
                  </select>
                </div>
                <div class="mb-3">
                  <label class="form-label">Regarding</label>
                  <select class="form-select" id="commRegarding">
                    <option value="general">General</option>
                    <option value="sponsorship">Sponsorship</option>
                    <option value="award_application">Award Application</option>
                    <option value="event_ticket">Event Ticket</option>
                    <option value="follow_up">Follow Up</option>
                    <option value="renewal">Renewal</option>
                  </select>
                </div>
                <div class="mb-3">
                  <label class="form-label">Subject</label>
                  <input type="text" class="form-control" id="commSubject" placeholder="Brief subject line">
                </div>
                <div class="mb-3">
                  <label class="form-label">Message <span class="text-danger">*</span></label>
                  <textarea class="form-control" id="commMessage" rows="4" required placeholder="Communication details..."></textarea>
                </div>
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Communication Date</label>
                    <input type="date" class="form-control" id="commDate" value="${new Date().toISOString().split('T')[0]}">
                  </div>
                  <div class="col-md-6 mb-3">
                    <div class="form-check mt-4">
                      <input class="form-check-input" type="checkbox" id="commFollowUp">
                      <label class="form-check-label" for="commFollowUp">
                        Follow-up Required
                      </label>
                    </div>
                  </div>
                </div>
                <div class="mb-3" id="followUpDateContainer" style="display: none;">
                  <label class="form-label">Follow-up Date</label>
                  <input type="date" class="form-control" id="commFollowUpDate">
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" onclick="crmModule.saveCommunication()">
                <i class="bi bi-save me-2"></i>Save Communication
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById('logCommunicationModal');
    if (existingModal) existingModal.remove();

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Use already-loaded organisations if available
    const orgs = (STATE.allOrganisations || [])
      .map(o => ({ id: o.id, company_name: o.company_name }))
      .sort((a, b) => (a.company_name || '').localeCompare(b.company_name || ''));

    const orgSelect = document.getElementById('commOrganisation');
    orgSelect.innerHTML = '<option value="">Select company...</option>' +
      orgs.map(org => `<option value="${org.id}" ${org.id === organisationId ? 'selected' : ''}>${utils.escapeHtml(org.company_name)}</option>`).join('');

    // Show/hide follow-up date field
    document.getElementById('commFollowUp').addEventListener('change', function() {
      document.getElementById('followUpDateContainer').style.display = this.checked ? 'block' : 'none';
    });

    // Cleanup on close
    document.getElementById('logCommunicationModal').addEventListener('hidden.bs.modal', function() { this.remove(); });

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('logCommunicationModal'));
    modal.show();
    utils.initInlineValidation('logCommunicationForm');

    } catch (error) {
      console.error('Error opening communication modal:', error);
      utils.showToast('Failed to open communication form', 'error');
    }
  },

  async saveCommunication() {
    const form = document.getElementById('logCommunicationForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const communicationData = {
      type: document.getElementById('commType').value,
      direction: document.getElementById('commDirection').value,
      organisation_id: document.getElementById('commOrganisation').value,
      contact_id: document.getElementById('commContact').value || null,
      regarding: document.getElementById('commRegarding').value,
      subject: document.getElementById('commSubject').value,
      message: document.getElementById('commMessage').value,
      communication_date: document.getElementById('commDate').value,
      follow_up_required: document.getElementById('commFollowUp').checked,
      follow_up_date: document.getElementById('commFollowUp').checked ? document.getElementById('commFollowUpDate').value : null,
      user_id: STATE.currentUser?.id || 'system'
    };

    try {
      await utils.protectModalDuringSave('logCommunicationModal', async () => {
        const { error } = await STATE.client
          .from('communications')
          .insert([communicationData]);

        if (error) throw error;

        bootstrap.Modal.getInstance(document.getElementById('logCommunicationModal')).hide();
      });
    } catch (error) {
      console.warn('DB insert for communication failed, using localStorage:', error);
      const key = 'bta_communications_pending';
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      communicationData.id = crypto.randomUUID();
      stored.push(communicationData);
      localStorage.setItem(key, JSON.stringify(stored));
      bootstrap.Modal.getInstance(document.getElementById('logCommunicationModal'))?.hide();
    }
    utils.showToast('Communication logged successfully', 'success');
    this.loadCommunications();
  },

  async createDeal(organisationId = null) {
    console.log('Create deal for:', organisationId);

    try {
    const modalHtml = `
      <div class="modal fade" id="createDealModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-success text-white">
              <h5 class="modal-title"><i class="bi bi-cash-coin me-2"></i>Create New Deal</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="createDealForm">
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Deal Name <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" id="dealName" required placeholder="e.g. Gold Sponsorship 2026">
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Company <span class="text-danger">*</span></label>
                    <select class="form-select" id="dealOrganisation" required>
                      <option value="">Select company...</option>
                    </select>
                  </div>
                </div>
                <div class="row">
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Deal Type <span class="text-danger">*</span></label>
                    <select class="form-select" id="dealType" required>
                      <option value="sponsorship">Sponsorship</option>
                      <option value="award_fee">Award Fee</option>
                      <option value="event_tickets">Event Tickets</option>
                      <option value="partnership">Partnership</option>
                      <option value="package_upgrade">Package Upgrade</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Deal Value (£) <span class="text-danger">*</span></label>
                    <input type="number" class="form-control" id="dealValue" required min="0" step="0.01" placeholder="0.00">
                  </div>
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Probability (%)</label>
                    <input type="number" class="form-control" id="dealProbability" min="0" max="100" value="50">
                  </div>
                </div>
                <div class="row">
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Stage</label>
                    <select class="form-select" id="dealStage">
                      <option value="lead">Lead</option>
                      <option value="contacted">Contacted</option>
                      <option value="qualified">Qualified</option>
                      <option value="proposal">Proposal</option>
                      <option value="negotiation">Negotiation</option>
                    </select>
                  </div>
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Expected Close Date</label>
                    <input type="date" class="form-control" id="dealExpectedClose">
                  </div>
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Contact</label>
                    <select class="form-select" id="dealContact">
                      <option value="">Select contact (optional)...</option>
                    </select>
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Description</label>
                  <textarea class="form-control" id="dealDescription" rows="3" placeholder="Deal details..."></textarea>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-success" onclick="crmModule.saveDeal()">
                <i class="bi bi-save me-2"></i>Create Deal
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const existingModal = document.getElementById('createDealModal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Use already-loaded organisations if available
    const orgs = (STATE.allOrganisations || [])
      .map(o => ({ id: o.id, company_name: o.company_name }))
      .sort((a, b) => (a.company_name || '').localeCompare(b.company_name || ''));

    const orgSelect = document.getElementById('dealOrganisation');
    orgSelect.innerHTML = '<option value="">Select company...</option>' +
      orgs.map(org => `<option value="${org.id}" ${org.id === organisationId ? 'selected' : ''}>${utils.escapeHtml(org.company_name)}</option>`).join('');

    // If org is preselected, load contacts
    if (organisationId) {
      const { data: contacts } = await STATE.client
        .from('organisation_contacts')
        .select('id, first_name, last_name')
        .eq('organisation_id', organisationId)
        .order('first_name');

      const contactSelect = document.getElementById('dealContact');
      contactSelect.innerHTML = '<option value="">Select contact (optional)...</option>' +
        (contacts || []).map(c => `<option value="${c.id}">${utils.escapeHtml(c.first_name + ' ' + c.last_name)}</option>`).join('');
    }

    const modal = new bootstrap.Modal(document.getElementById('createDealModal'));
    modal.show();
    utils.initInlineValidation('createDealForm');

    document.getElementById('createDealModal').addEventListener('hidden.bs.modal', function() {
      this.remove();
    });

    } catch (error) {
      console.error('Error opening create deal modal:', error);
      utils.showToast('Error loading deal form: ' + error.message, 'error');
    }
  },

  async saveDeal() {
    const form = document.getElementById('createDealForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const dealData = {
      deal_name: document.getElementById('dealName').value,
      organisation_id: document.getElementById('dealOrganisation').value,
      deal_type: document.getElementById('dealType').value,
      deal_value: parseFloat(document.getElementById('dealValue').value),
      probability: parseInt(document.getElementById('dealProbability').value) || 50,
      stage: document.getElementById('dealStage').value,
      expected_close_date: document.getElementById('dealExpectedClose').value || null,
      contact_id: document.getElementById('dealContact').value || null,
      description: document.getElementById('dealDescription').value,
      status: 'active'
    };

    try {
      await utils.protectModalDuringSave('createDealModal', async () => {
        const { error } = await STATE.client
          .from('deals')
          .insert([dealData]);

        if (error) throw error;

        bootstrap.Modal.getInstance(document.getElementById('createDealModal')).hide();
      });
    } catch (error) {
      console.warn('DB insert for deal failed, using localStorage:', error);
      const key = 'bta_deals_pending';
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      dealData.id = crypto.randomUUID();
      stored.push(dealData);
      localStorage.setItem(key, JSON.stringify(stored));
      bootstrap.Modal.getInstance(document.getElementById('createDealModal'))?.hide();
    }
    utils.showToast('Deal created successfully', 'success');
    this.loadDeals();
  },

  async viewCommunication(commId) {
    console.log('View communication:', commId);

    try {
      const { data: comm, error } = await STATE.client
        .from('communications')
        .select(`
          *,
          organisation:organisations(company_name),
          contact:organisation_contacts(first_name, last_name, email)
        `)
        .eq('id', commId)
        .single();

      if (error) throw error;

      const date = new Date(comm.communication_date).toLocaleString();
      const companyName = comm.organisation?.company_name || 'Unknown';
      const contactName = comm.contact ? `${comm.contact.first_name} ${comm.contact.last_name}` : 'N/A';
      const contactEmail = comm.contact?.email || '';

      const modalHtml = `
        <div class="modal fade" id="viewCommunicationModal" tabindex="-1">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header bg-primary text-white">
                <h5 class="modal-title"><i class="bi bi-chat-dots me-2"></i>Communication Details</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <div class="row mb-3">
                  <div class="col-md-6">
                    <table class="table table-sm table-borderless">
                      <tr><td class="text-muted">Date:</td><td><strong>${date}</strong></td></tr>
                      <tr><td class="text-muted">Type:</td><td>${this.getTypeBadge(comm.type)}</td></tr>
                      <tr><td class="text-muted">Direction:</td><td>${comm.direction === 'inbound' ? '<span class="badge bg-info">Inbound</span>' : '<span class="badge bg-primary">Outbound</span>'}</td></tr>
                      <tr><td class="text-muted">Regarding:</td><td>${this.formatRegarding(comm.regarding)}</td></tr>
                    </table>
                  </div>
                  <div class="col-md-6">
                    <table class="table table-sm table-borderless">
                      <tr><td class="text-muted">Company:</td><td><strong>${companyName}</strong></td></tr>
                      <tr><td class="text-muted">Contact:</td><td>${contactName}</td></tr>
                      ${contactEmail ? `<tr><td class="text-muted">Email:</td><td><a href="mailto:${contactEmail}">${contactEmail}</a></td></tr>` : ''}
                      <tr><td class="text-muted">Follow-up:</td><td>${comm.follow_up_required
                        ? `<span class="badge bg-warning text-dark"><i class="bi bi-calendar-check me-1"></i>${comm.follow_up_date ? new Date(comm.follow_up_date).toLocaleDateString() : 'ASAP'}</span>`
                        : '<span class="text-muted">None</span>'}</td></tr>
                    </table>
                  </div>
                </div>
                ${comm.subject ? `<div class="mb-3"><h6 class="text-muted">Subject</h6><p class="fw-bold mb-0">${comm.subject}</p></div>` : ''}
                <div class="mb-0">
                  <h6 class="text-muted">Message</h6>
                  <div class="p-3 bg-light rounded" style="white-space: pre-wrap;">${comm.message}</div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-success" onclick="bootstrap.Modal.getInstance(document.getElementById('viewCommunicationModal')).hide(); crmModule.editCommunication('${comm.id}')">
                  <i class="bi bi-pencil me-2"></i>Edit
                </button>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              </div>
            </div>
          </div>
        </div>
      `;

      const existingModal = document.getElementById('viewCommunicationModal');
      if (existingModal) existingModal.remove();
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      const modal = new bootstrap.Modal(document.getElementById('viewCommunicationModal'));
      modal.show();
      document.getElementById('viewCommunicationModal').addEventListener('hidden.bs.modal', function() { this.remove(); });
    } catch (error) {
      console.error('Error loading communication:', error);
      utils.showToast('Error loading communication details', 'error');
    }
  },

  async editCommunication(commId) {
    console.log('Edit communication:', commId);

    try {
      const { data: comm, error } = await STATE.client
        .from('communications')
        .select('*')
        .eq('id', commId)
        .single();

      if (error) throw error;

      const modalHtml = `
        <div class="modal fade" id="editCommunicationModal" tabindex="-1">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header bg-success text-white">
                <h5 class="modal-title"><i class="bi bi-pencil me-2"></i>Edit Communication</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <form id="editCommunicationForm">
                  <div class="row">
                    <div class="col-md-6 mb-3">
                      <label class="form-label">Type <span class="text-danger">*</span></label>
                      <select class="form-select" id="editCommType" required>
                        <option value="email" ${comm.type === 'email' ? 'selected' : ''}>Email</option>
                        <option value="phone" ${comm.type === 'phone' ? 'selected' : ''}>Phone</option>
                        <option value="meeting" ${comm.type === 'meeting' ? 'selected' : ''}>Meeting</option>
                        <option value="note" ${comm.type === 'note' ? 'selected' : ''}>Note</option>
                        <option value="text" ${comm.type === 'text' ? 'selected' : ''}>Text</option>
                        <option value="linkedin" ${comm.type === 'linkedin' ? 'selected' : ''}>LinkedIn</option>
                      </select>
                    </div>
                    <div class="col-md-6 mb-3">
                      <label class="form-label">Direction <span class="text-danger">*</span></label>
                      <select class="form-select" id="editCommDirection" required>
                        <option value="outbound" ${comm.direction === 'outbound' ? 'selected' : ''}>Outbound</option>
                        <option value="inbound" ${comm.direction === 'inbound' ? 'selected' : ''}>Inbound</option>
                      </select>
                    </div>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Regarding</label>
                    <select class="form-select" id="editCommRegarding">
                      <option value="general" ${comm.regarding === 'general' ? 'selected' : ''}>General</option>
                      <option value="sponsorship" ${comm.regarding === 'sponsorship' ? 'selected' : ''}>Sponsorship</option>
                      <option value="award_application" ${comm.regarding === 'award_application' ? 'selected' : ''}>Award Application</option>
                      <option value="event_ticket" ${comm.regarding === 'event_ticket' ? 'selected' : ''}>Event Ticket</option>
                      <option value="follow_up" ${comm.regarding === 'follow_up' ? 'selected' : ''}>Follow Up</option>
                      <option value="renewal" ${comm.regarding === 'renewal' ? 'selected' : ''}>Renewal</option>
                    </select>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Subject</label>
                    <input type="text" class="form-control" id="editCommSubject" value="${utils.escapeHtml(comm.subject || '')}">
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Message <span class="text-danger">*</span></label>
                    <textarea class="form-control" id="editCommMessage" rows="4" required>${utils.escapeHtml(comm.message || '')}</textarea>
                  </div>
                  <div class="row">
                    <div class="col-md-6 mb-3">
                      <label class="form-label">Communication Date</label>
                      <input type="date" class="form-control" id="editCommDate" value="${comm.communication_date ? comm.communication_date.split('T')[0] : ''}">
                    </div>
                    <div class="col-md-6 mb-3">
                      <div class="form-check mt-4">
                        <input class="form-check-input" type="checkbox" id="editCommFollowUp" ${comm.follow_up_required ? 'checked' : ''}>
                        <label class="form-check-label" for="editCommFollowUp">Follow-up Required</label>
                      </div>
                    </div>
                  </div>
                  <div class="mb-3" id="editFollowUpDateContainer" style="display: ${comm.follow_up_required ? 'block' : 'none'};">
                    <label class="form-label">Follow-up Date</label>
                    <input type="date" class="form-control" id="editCommFollowUpDate" value="${comm.follow_up_date ? comm.follow_up_date.split('T')[0] : ''}">
                  </div>
                </form>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-success" onclick="crmModule.updateCommunication('${comm.id}')">
                  <i class="bi bi-save me-2"></i>Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      const existingModal = document.getElementById('editCommunicationModal');
      if (existingModal) existingModal.remove();
      document.body.insertAdjacentHTML('beforeend', modalHtml);

      document.getElementById('editCommFollowUp').addEventListener('change', function() {
        document.getElementById('editFollowUpDateContainer').style.display = this.checked ? 'block' : 'none';
      });

      const modal = new bootstrap.Modal(document.getElementById('editCommunicationModal'));
      modal.show();
      utils.initInlineValidation('editCommunicationForm');
      document.getElementById('editCommunicationModal').addEventListener('hidden.bs.modal', function() { this.remove(); });
    } catch (error) {
      console.error('Error loading communication for edit:', error);
      utils.showToast('Error loading communication', 'error');
    }
  },

  async updateCommunication(commId) {
    const form = document.getElementById('editCommunicationForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const updateData = {
      type: document.getElementById('editCommType').value,
      direction: document.getElementById('editCommDirection').value,
      regarding: document.getElementById('editCommRegarding').value,
      subject: document.getElementById('editCommSubject').value,
      message: document.getElementById('editCommMessage').value,
      communication_date: document.getElementById('editCommDate').value,
      follow_up_required: document.getElementById('editCommFollowUp').checked,
      follow_up_date: document.getElementById('editCommFollowUp').checked ? document.getElementById('editCommFollowUpDate').value : null
    };

    try {
      await utils.protectModalDuringSave('editCommunicationModal', async () => {
        const { error } = await STATE.client
          .from('communications')
          .update(updateData)
          .eq('id', commId);

        if (error) throw error;

        utils.showToast('Communication updated successfully', 'success');
        bootstrap.Modal.getInstance(document.getElementById('editCommunicationModal')).hide();
      });
      this.loadCommunications();
    } catch (error) {
      console.error('Error updating communication:', error);
      utils.showToast('Error updating communication: ' + error.message, 'error');
    }
  },

  async deleteCommunication(commId) {
    if (!await utils.confirmDialog({ title: 'Delete Communication', message: 'Are you sure you want to delete this communication? This action cannot be undone.' })) {
      return;
    }

    try {
      const { error } = await STATE.client
        .from('communications')
        .delete()
        .eq('id', commId);

      if (error) throw error;

      utils.showToast('Communication deleted successfully', 'success');
      this.loadCommunications();
    } catch (error) {
      console.error('Error deleting communication:', error);
      utils.showToast('Error deleting communication', 'error');
    }
  },

  async viewDeal(dealId) {
    console.log('View deal:', dealId);

    try {
      const { data: deal, error } = await STATE.client
        .from('deals')
        .select(`
          *,
          organisation:organisations(company_name),
          contact:organisation_contacts(first_name, last_name, email)
        `)
        .eq('id', dealId)
        .single();

      if (error) throw error;

      const companyName = deal.organisation?.company_name || 'Unknown';
      const contactName = deal.contact ? `${deal.contact.first_name} ${deal.contact.last_name}` : 'N/A';
      const value = `£${parseFloat(deal.deal_value).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
      const createdDate = new Date(deal.created_at).toLocaleDateString();

      const modalHtml = `
        <div class="modal fade" id="viewDealModal" tabindex="-1">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header bg-primary text-white">
                <h5 class="modal-title"><i class="bi bi-cash-coin me-2"></i>Deal Details</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <div class="row mb-3">
                  <div class="col-md-6">
                    <table class="table table-sm table-borderless">
                      <tr><td class="text-muted">Deal Name:</td><td><strong>${deal.deal_name}</strong></td></tr>
                      <tr><td class="text-muted">Company:</td><td>${companyName}</td></tr>
                      <tr><td class="text-muted">Contact:</td><td>${contactName}</td></tr>
                      <tr><td class="text-muted">Created:</td><td>${createdDate}</td></tr>
                    </table>
                  </div>
                  <div class="col-md-6">
                    <table class="table table-sm table-borderless">
                      <tr><td class="text-muted">Type:</td><td>${this.getDealTypeBadge(deal.deal_type)}</td></tr>
                      <tr><td class="text-muted">Stage:</td><td>${this.getStageBadge(deal.stage)}</td></tr>
                      <tr><td class="text-muted">Status:</td><td>${this.getStatusBadge(deal.status)}</td></tr>
                      <tr><td class="text-muted">Value:</td><td><strong class="text-success">${value}</strong></td></tr>
                    </table>
                  </div>
                </div>
                <div class="row mb-3">
                  <div class="col-md-6">
                    <div class="card">
                      <div class="card-body text-center">
                        <h6 class="text-muted mb-1">Probability</h6>
                        <div class="progress mb-2" style="height: 24px;">
                          <div class="progress-bar" role="progressbar" style="width: ${deal.probability}%;">${deal.probability}%</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="card">
                      <div class="card-body text-center">
                        <h6 class="text-muted mb-1">Expected Close</h6>
                        <h5 class="mb-0">${deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString() : 'TBD'}</h5>
                      </div>
                    </div>
                  </div>
                </div>
                ${deal.description ? `
                  <div class="mb-0">
                    <h6 class="text-muted">Description</h6>
                    <div class="p-3 bg-light rounded" style="white-space: pre-wrap;">${deal.description}</div>
                  </div>
                ` : ''}
                ${deal.notes ? `
                  <div class="mt-3">
                    <h6 class="text-muted">Notes</h6>
                    <div class="p-3 bg-light rounded" style="white-space: pre-wrap;">${deal.notes}</div>
                  </div>
                ` : ''}
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-success" onclick="bootstrap.Modal.getInstance(document.getElementById('viewDealModal')).hide(); crmModule.editDeal('${deal.id}')">
                  <i class="bi bi-pencil me-2"></i>Edit
                </button>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              </div>
            </div>
          </div>
        </div>
      `;

      const existingModal = document.getElementById('viewDealModal');
      if (existingModal) existingModal.remove();
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      const modal = new bootstrap.Modal(document.getElementById('viewDealModal'));
      modal.show();
      document.getElementById('viewDealModal').addEventListener('hidden.bs.modal', function() { this.remove(); });
    } catch (error) {
      console.error('Error loading deal:', error);
      utils.showToast('Error loading deal details', 'error');
    }
  },

  async editDeal(dealId) {
    console.log('Edit deal:', dealId);

    try {
      const { data: deal, error } = await STATE.client
        .from('deals')
        .select('*')
        .eq('id', dealId)
        .single();

      if (error) throw error;

      const modalHtml = `
        <div class="modal fade" id="editDealModal" tabindex="-1">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header bg-success text-white">
                <h5 class="modal-title"><i class="bi bi-pencil me-2"></i>Edit Deal</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <form id="editDealForm">
                  <div class="row">
                    <div class="col-md-6 mb-3">
                      <label class="form-label">Deal Name <span class="text-danger">*</span></label>
                      <input type="text" class="form-control" id="editDealName" required value="${utils.escapeHtml(deal.deal_name || '')}">
                    </div>
                    <div class="col-md-6 mb-3">
                      <label class="form-label">Deal Type</label>
                      <select class="form-select" id="editDealType">
                        <option value="sponsorship" ${deal.deal_type === 'sponsorship' ? 'selected' : ''}>Sponsorship</option>
                        <option value="award_fee" ${deal.deal_type === 'award_fee' ? 'selected' : ''}>Award Fee</option>
                        <option value="event_tickets" ${deal.deal_type === 'event_tickets' ? 'selected' : ''}>Event Tickets</option>
                        <option value="partnership" ${deal.deal_type === 'partnership' ? 'selected' : ''}>Partnership</option>
                        <option value="package_upgrade" ${deal.deal_type === 'package_upgrade' ? 'selected' : ''}>Package Upgrade</option>
                        <option value="other" ${deal.deal_type === 'other' ? 'selected' : ''}>Other</option>
                      </select>
                    </div>
                  </div>
                  <div class="row">
                    <div class="col-md-4 mb-3">
                      <label class="form-label">Deal Value (£) <span class="text-danger">*</span></label>
                      <input type="number" class="form-control" id="editDealValue" required min="0" step="0.01" value="${deal.deal_value || 0}">
                    </div>
                    <div class="col-md-4 mb-3">
                      <label class="form-label">Probability (%)</label>
                      <input type="number" class="form-control" id="editDealProbability" min="0" max="100" value="${deal.probability || 50}">
                    </div>
                    <div class="col-md-4 mb-3">
                      <label class="form-label">Stage</label>
                      <select class="form-select" id="editDealStage">
                        <option value="lead" ${deal.stage === 'lead' ? 'selected' : ''}>Lead</option>
                        <option value="contacted" ${deal.stage === 'contacted' ? 'selected' : ''}>Contacted</option>
                        <option value="qualified" ${deal.stage === 'qualified' ? 'selected' : ''}>Qualified</option>
                        <option value="proposal" ${deal.stage === 'proposal' ? 'selected' : ''}>Proposal</option>
                        <option value="negotiation" ${deal.stage === 'negotiation' ? 'selected' : ''}>Negotiation</option>
                        <option value="closed_won" ${deal.stage === 'closed_won' ? 'selected' : ''}>Closed Won</option>
                        <option value="closed_lost" ${deal.stage === 'closed_lost' ? 'selected' : ''}>Closed Lost</option>
                      </select>
                    </div>
                  </div>
                  <div class="row">
                    <div class="col-md-4 mb-3">
                      <label class="form-label">Status</label>
                      <select class="form-select" id="editDealStatus">
                        <option value="active" ${deal.status === 'active' ? 'selected' : ''}>Active</option>
                        <option value="won" ${deal.status === 'won' ? 'selected' : ''}>Won</option>
                        <option value="lost" ${deal.status === 'lost' ? 'selected' : ''}>Lost</option>
                        <option value="on_hold" ${deal.status === 'on_hold' ? 'selected' : ''}>On Hold</option>
                        <option value="cancelled" ${deal.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                      </select>
                    </div>
                    <div class="col-md-4 mb-3">
                      <label class="form-label">Expected Close Date</label>
                      <input type="date" class="form-control" id="editDealExpectedClose" value="${deal.expected_close_date ? deal.expected_close_date.split('T')[0] : ''}">
                    </div>
                    <div class="col-md-4 mb-3">
                      <label class="form-label">Actual Close Date</label>
                      <input type="date" class="form-control" id="editDealActualClose" value="${deal.actual_close_date ? deal.actual_close_date.split('T')[0] : ''}">
                    </div>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Description</label>
                    <textarea class="form-control" id="editDealDescription" rows="3">${utils.escapeHtml(deal.description || '')}</textarea>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Notes</label>
                    <textarea class="form-control" id="editDealNotes" rows="2">${utils.escapeHtml(deal.notes || '')}</textarea>
                  </div>
                </form>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-success" onclick="crmModule.updateDeal('${deal.id}')">
                  <i class="bi bi-save me-2"></i>Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      const existingModal = document.getElementById('editDealModal');
      if (existingModal) existingModal.remove();
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      const modal = new bootstrap.Modal(document.getElementById('editDealModal'));
      modal.show();
      utils.initInlineValidation('editDealForm');
      document.getElementById('editDealModal').addEventListener('hidden.bs.modal', function() { this.remove(); });
    } catch (error) {
      console.error('Error loading deal for edit:', error);
      utils.showToast('Error loading deal', 'error');
    }
  },

  async updateDeal(dealId) {
    const form = document.getElementById('editDealForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const updateData = {
      deal_name: document.getElementById('editDealName').value,
      deal_type: document.getElementById('editDealType').value,
      deal_value: parseFloat(document.getElementById('editDealValue').value),
      probability: parseInt(document.getElementById('editDealProbability').value) || 50,
      stage: document.getElementById('editDealStage').value,
      status: document.getElementById('editDealStatus').value,
      expected_close_date: document.getElementById('editDealExpectedClose').value || null,
      actual_close_date: document.getElementById('editDealActualClose').value || null,
      description: document.getElementById('editDealDescription').value,
      notes: document.getElementById('editDealNotes').value
    };

    try {
      await utils.protectModalDuringSave('editDealModal', async () => {
        const { error } = await STATE.client
          .from('deals')
          .update(updateData)
          .eq('id', dealId);

        if (error) throw error;

        utils.showToast('Deal updated successfully', 'success');
        bootstrap.Modal.getInstance(document.getElementById('editDealModal')).hide();
      });
      this.loadDeals();
    } catch (error) {
      console.error('Error updating deal:', error);
      utils.showToast('Error updating deal: ' + error.message, 'error');
    }
  },

  async deleteDeal(dealId) {
    if (!await utils.confirmDialog({ title: 'Delete Deal', message: 'Are you sure you want to delete this deal? This action cannot be undone.' })) {
      return;
    }

    try {
      const { error } = await STATE.client
        .from('deals')
        .delete()
        .eq('id', dealId);

      if (error) throw error;

      utils.showToast('Deal deleted successfully', 'success');
      this.loadDeals();
    } catch (error) {
      console.error('Error deleting deal:', error);
      utils.showToast('Error deleting deal', 'error');
    }
  },

  async viewMeeting(meetingId) {
    console.log('View meeting:', meetingId);

    try {
      const { data: meeting, error } = await STATE.client
        .from('meeting_notes')
        .select(`
          *,
          organisation:organisations(company_name),
          deal:deals(deal_name)
        `)
        .eq('id', meetingId)
        .single();

      if (error) throw error;

      const date = new Date(meeting.meeting_date).toLocaleDateString();
      const time = new Date(meeting.meeting_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const companyName = meeting.organisation?.company_name || 'N/A';
      const dealName = meeting.deal?.deal_name || 'N/A';
      let attendeesList = [];
      try { attendeesList = JSON.parse(meeting.attendees || '[]'); } catch (e) { console.warn('Failed to parse meeting attendees for view:', e.message); }

      const modalHtml = `
        <div class="modal fade" id="viewMeetingModal" tabindex="-1">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header bg-primary text-white">
                <h5 class="modal-title"><i class="bi bi-calendar-event me-2"></i>Meeting Details</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <div class="row mb-3">
                  <div class="col-md-6">
                    <table class="table table-sm table-borderless">
                      <tr><td class="text-muted">Title:</td><td><strong>${meeting.meeting_title}</strong></td></tr>
                      <tr><td class="text-muted">Date:</td><td>${date} at ${time}</td></tr>
                      <tr><td class="text-muted">Type:</td><td>${this.getMeetingTypeBadge(meeting.meeting_type)}</td></tr>
                      <tr><td class="text-muted">Duration:</td><td>${meeting.duration_minutes ? meeting.duration_minutes + ' minutes' : 'N/A'}</td></tr>
                    </table>
                  </div>
                  <div class="col-md-6">
                    <table class="table table-sm table-borderless">
                      <tr><td class="text-muted">Company:</td><td>${companyName}</td></tr>
                      <tr><td class="text-muted">Related Deal:</td><td>${dealName}</td></tr>
                      <tr><td class="text-muted">Location:</td><td>${meeting.location || 'N/A'}</td></tr>
                      <tr><td class="text-muted">Follow-up:</td><td>${meeting.follow_up_required
                        ? `<span class="badge bg-warning text-dark"><i class="bi bi-calendar-check me-1"></i>${meeting.follow_up_date ? new Date(meeting.follow_up_date).toLocaleDateString() : 'ASAP'}</span>`
                        : '<span class="text-muted">None</span>'}</td></tr>
                    </table>
                  </div>
                </div>
                ${attendeesList.length > 0 ? `
                  <div class="mb-3">
                    <h6 class="text-muted">Attendees</h6>
                    <div class="d-flex flex-wrap gap-2">
                      ${attendeesList.map(a => `<span class="badge bg-light text-dark border"><i class="bi bi-person me-1"></i>${a}</span>`).join('')}
                    </div>
                  </div>
                ` : ''}
                ${meeting.notes ? `
                  <div class="mb-3">
                    <h6 class="text-muted">Meeting Notes</h6>
                    <div class="p-3 bg-light rounded" style="white-space: pre-wrap;">${meeting.notes}</div>
                  </div>
                ` : ''}
                ${meeting.action_items ? `
                  <div class="mb-0">
                    <h6 class="text-muted">Action Items</h6>
                    <div class="p-3 bg-light rounded" style="white-space: pre-wrap;">${meeting.action_items}</div>
                  </div>
                ` : ''}
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-success" onclick="bootstrap.Modal.getInstance(document.getElementById('viewMeetingModal')).hide(); crmModule.editMeeting('${meeting.id}')">
                  <i class="bi bi-pencil me-2"></i>Edit
                </button>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              </div>
            </div>
          </div>
        </div>
      `;

      const existingModal = document.getElementById('viewMeetingModal');
      if (existingModal) existingModal.remove();
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      const modal = new bootstrap.Modal(document.getElementById('viewMeetingModal'));
      modal.show();
      document.getElementById('viewMeetingModal').addEventListener('hidden.bs.modal', function() { this.remove(); });
    } catch (error) {
      console.error('Error loading meeting:', error);
      utils.showToast('Error loading meeting details', 'error');
    }
  },

  async editMeeting(meetingId) {
    console.log('Edit meeting:', meetingId);

    try {
      const { data: meeting, error } = await STATE.client
        .from('meeting_notes')
        .select('*')
        .eq('id', meetingId)
        .single();

      if (error) throw error;

      let attendeesList = [];
      try { attendeesList = JSON.parse(meeting.attendees || '[]'); } catch (e) { console.warn('Failed to parse meeting attendees for edit:', e.message); }
      const meetingDateTime = meeting.meeting_date ? meeting.meeting_date.split('T') : ['', ''];

      const modalHtml = `
        <div class="modal fade" id="editMeetingModal" tabindex="-1">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header bg-success text-white">
                <h5 class="modal-title"><i class="bi bi-pencil me-2"></i>Edit Meeting</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <form id="editMeetingForm">
                  <div class="row">
                    <div class="col-md-6 mb-3">
                      <label class="form-label">Meeting Title <span class="text-danger">*</span></label>
                      <input type="text" class="form-control" id="editMeetingTitle" required value="${utils.escapeHtml(meeting.meeting_title || '')}">
                    </div>
                    <div class="col-md-6 mb-3">
                      <label class="form-label">Meeting Type</label>
                      <select class="form-select" id="editMeetingType">
                        <option value="in_person" ${meeting.meeting_type === 'in_person' ? 'selected' : ''}>In Person</option>
                        <option value="video_call" ${meeting.meeting_type === 'video_call' ? 'selected' : ''}>Video Call</option>
                        <option value="phone" ${meeting.meeting_type === 'phone' ? 'selected' : ''}>Phone</option>
                        <option value="conference" ${meeting.meeting_type === 'conference' ? 'selected' : ''}>Conference</option>
                      </select>
                    </div>
                  </div>
                  <div class="row">
                    <div class="col-md-4 mb-3">
                      <label class="form-label">Date</label>
                      <input type="date" class="form-control" id="editMeetingDate" value="${meetingDateTime[0]}">
                    </div>
                    <div class="col-md-4 mb-3">
                      <label class="form-label">Time</label>
                      <input type="time" class="form-control" id="editMeetingTime" value="${meetingDateTime[1] ? meetingDateTime[1].substring(0, 5) : ''}">
                    </div>
                    <div class="col-md-4 mb-3">
                      <label class="form-label">Duration (minutes)</label>
                      <input type="number" class="form-control" id="editMeetingDuration" min="0" value="${meeting.duration_minutes || ''}">
                    </div>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Location</label>
                    <input type="text" class="form-control" id="editMeetingLocation" value="${utils.escapeHtml(meeting.location || '')}" placeholder="e.g. Office, Zoom, Teams">
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Attendees (comma-separated)</label>
                    <input type="text" class="form-control" id="editMeetingAttendees" value="${utils.escapeHtml(attendeesList.join(', '))}" placeholder="John Smith, Jane Doe">
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Meeting Notes</label>
                    <textarea class="form-control" id="editMeetingNotes" rows="4">${utils.escapeHtml(meeting.notes || '')}</textarea>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Action Items</label>
                    <textarea class="form-control" id="editMeetingActions" rows="3">${utils.escapeHtml(meeting.action_items || '')}</textarea>
                  </div>
                  <div class="row">
                    <div class="col-md-6 mb-3">
                      <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="editMeetingFollowUp" ${meeting.follow_up_required ? 'checked' : ''}>
                        <label class="form-check-label" for="editMeetingFollowUp">Follow-up Required</label>
                      </div>
                    </div>
                    <div class="col-md-6 mb-3" id="editMeetingFollowUpDateContainer" style="display: ${meeting.follow_up_required ? 'block' : 'none'};">
                      <label class="form-label">Follow-up Date</label>
                      <input type="date" class="form-control" id="editMeetingFollowUpDate" value="${meeting.follow_up_date ? meeting.follow_up_date.split('T')[0] : ''}">
                    </div>
                  </div>
                </form>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-success" onclick="crmModule.updateMeeting('${meeting.id}')">
                  <i class="bi bi-save me-2"></i>Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      const existingModal = document.getElementById('editMeetingModal');
      if (existingModal) existingModal.remove();
      document.body.insertAdjacentHTML('beforeend', modalHtml);

      document.getElementById('editMeetingFollowUp').addEventListener('change', function() {
        document.getElementById('editMeetingFollowUpDateContainer').style.display = this.checked ? 'block' : 'none';
      });

      const modal = new bootstrap.Modal(document.getElementById('editMeetingModal'));
      modal.show();
      utils.initInlineValidation('editMeetingForm');
      document.getElementById('editMeetingModal').addEventListener('hidden.bs.modal', function() { this.remove(); });
    } catch (error) {
      console.error('Error loading meeting for edit:', error);
      utils.showToast('Error loading meeting', 'error');
    }
  },

  async updateMeeting(meetingId) {
    const form = document.getElementById('editMeetingForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const dateVal = document.getElementById('editMeetingDate').value;
    const timeVal = document.getElementById('editMeetingTime').value;
    const meetingDate = dateVal && timeVal ? `${dateVal}T${timeVal}:00` : dateVal || null;

    const attendeesRaw = document.getElementById('editMeetingAttendees').value;
    const attendeesArray = attendeesRaw ? attendeesRaw.split(',').map(a => a.trim()).filter(a => a) : [];

    const updateData = {
      meeting_title: document.getElementById('editMeetingTitle').value,
      meeting_type: document.getElementById('editMeetingType').value,
      meeting_date: meetingDate,
      duration_minutes: parseInt(document.getElementById('editMeetingDuration').value) || null,
      location: document.getElementById('editMeetingLocation').value || null,
      attendees: JSON.stringify(attendeesArray),
      notes: document.getElementById('editMeetingNotes').value,
      action_items: document.getElementById('editMeetingActions').value,
      follow_up_required: document.getElementById('editMeetingFollowUp').checked,
      follow_up_date: document.getElementById('editMeetingFollowUp').checked ? document.getElementById('editMeetingFollowUpDate').value : null
    };

    try {
      await utils.protectModalDuringSave('editMeetingModal', async () => {
        const { error } = await STATE.client
          .from('meeting_notes')
          .update(updateData)
          .eq('id', meetingId);

        if (error) throw error;

        utils.showToast('Meeting updated successfully', 'success');
        bootstrap.Modal.getInstance(document.getElementById('editMeetingModal')).hide();
      });
      this.loadMeetings();
    } catch (error) {
      console.error('Error updating meeting:', error);
      utils.showToast('Error updating meeting: ' + error.message, 'error');
    }
  },

  async deleteMeeting(meetingId) {
    if (!await utils.confirmDialog({ title: 'Delete Meeting Note', message: 'Are you sure you want to delete this meeting note? This action cannot be undone.' })) {
      return;
    }

    try {
      const { error } = await STATE.client
        .from('meeting_notes')
        .delete()
        .eq('id', meetingId);

      if (error) throw error;

      utils.showToast('Meeting note deleted successfully', 'success');
      this.loadMeetings();
    } catch (error) {
      console.error('Error deleting meeting:', error);
      utils.showToast('Error deleting meeting note', 'error');
    }
  },

  async viewSegmentCompanies(segmentId, segmentName) {
    console.log('View companies in segment:', segmentName);

    try {
      // Load companies in this segment
      const { data: assignments, error } = await STATE.client
        .from('organisation_segments')
        .select(`
          *,
          organisation:organisations(id, company_name, industry, email, phone)
        `)
        .eq('segment_id', segmentId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const companies = (assignments || []).filter(a => a.organisation);

      const modalHtml = `
        <div class="modal fade" id="viewSegmentCompaniesModal" tabindex="-1">
          <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header bg-primary text-white">
                <h5 class="modal-title"><i class="bi bi-people me-2"></i>Companies in "${segmentName}"</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                ${companies.length === 0 ? `
                  <div class="text-center py-4">
                    <i class="bi bi-inbox display-4 d-block mb-2 opacity-25"></i>
                    <p class="text-muted">No companies in this segment</p>
                  </div>
                ` : `
                  <p class="text-muted mb-3">${companies.length} compan${companies.length === 1 ? 'y' : 'ies'} in this segment</p>
                  <div class="table-responsive">
                    <table class="table table-hover">
                      <thead>
                        <tr>
                          <th>Company</th>
                          <th>Industry</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${companies.map(a => `
                          <tr>
                            <td><strong>${utils.escapeHtml(a.organisation.company_name)}</strong></td>
                            <td>${a.organisation.industry ? utils.escapeHtml(a.organisation.industry) : '<span class="text-muted">N/A</span>'}</td>
                            <td>${a.organisation.email ? `<a href="mailto:${encodeURIComponent(a.organisation.email)}">${utils.escapeHtml(a.organisation.email)}</a>` : '<span class="text-muted">N/A</span>'}</td>
                            <td>${a.organisation.phone ? utils.escapeHtml(a.organisation.phone) : '<span class="text-muted">N/A</span>'}</td>
                            <td>
                              <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-primary" onclick="crmModule.viewCompanyProfile('${a.organisation.id}')" title="View Profile">
                                  <i class="bi bi-eye"></i>
                                </button>
                                <button class="btn btn-outline-danger" onclick="crmModule.removeFromSegment('${a.id}', '${segmentId}', '${utils.escapeHtml(segmentName).replace(/'/g, "\\'")}')" title="Remove from Segment">
                                  <i class="bi bi-x-circle"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                `}
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              </div>
            </div>
          </div>
        </div>
      `;

      const existingModal = document.getElementById('viewSegmentCompaniesModal');
      if (existingModal) existingModal.remove();
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      const modal = new bootstrap.Modal(document.getElementById('viewSegmentCompaniesModal'));
      modal.show();
      document.getElementById('viewSegmentCompaniesModal').addEventListener('hidden.bs.modal', function() { this.remove(); });
    } catch (error) {
      console.error('Error loading segment companies:', error);
      utils.showToast('Error loading segment companies', 'error');
    }
  },

  async removeFromSegment(assignmentId, segmentId, segmentName) {
    if (!await utils.confirmDialog({ title: 'Remove from Segment', message: 'Remove this company from the segment?', confirmText: 'Remove' })) return;

    try {
      await utils.protectModalDuringSave('viewSegmentCompaniesModal', async () => {
        const { error } = await STATE.client
          .from('organisation_segments')
          .delete()
          .eq('id', assignmentId);

        if (error) throw error;

        utils.showToast('Company removed from segment', 'success');
        // Refresh the segment companies view
        bootstrap.Modal.getInstance(document.getElementById('viewSegmentCompaniesModal')).hide();
        this.viewSegmentCompanies(segmentId, segmentName);
        this.loadSegments();
      });
    } catch (error) {
      console.error('Error removing from segment:', error);
      utils.showToast('Error removing company from segment', 'error');
    }
  },

  async editSegment(segmentId) {
    console.log('Edit segment:', segmentId);

    try {
      const { data: segment, error } = await STATE.client
        .from('contact_segments')
        .select('*')
        .eq('id', segmentId)
        .single();

      if (error) throw error;

      const colors = ['#0d6efd', '#198754', '#dc3545', '#ffc107', '#0dcaf0', '#6f42c1', '#fd7e14', '#20c997', '#d63384', '#6610f2'];
      const icons = ['tag', 'trophy', 'star', 'people', 'building', 'award', 'cash', 'calendar-event', 'graph-up', 'megaphone'];

      const modalHtml = `
        <div class="modal fade" id="editSegmentModal" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header bg-success text-white">
                <h5 class="modal-title"><i class="bi bi-pencil me-2"></i>Edit Segment</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <form id="editSegmentForm">
                  <div class="mb-3">
                    <label class="form-label">Segment Name <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" id="editSegmentName" required value="${utils.escapeHtml(segment.segment_name || '')}">
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Description</label>
                    <textarea class="form-control" id="editSegmentDescription" rows="2">${utils.escapeHtml(segment.description || '')}</textarea>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Color</label>
                    <div class="d-flex flex-wrap gap-2" id="segmentColorPicker">
                      ${colors.map(c => `
                        <div class="rounded-circle border ${segment.color === c ? 'border-dark border-3' : ''}"
                             style="width: 32px; height: 32px; background: ${c}; cursor: pointer;"
                             onclick="document.getElementById('editSegmentColor').value = '${c}'; document.querySelectorAll('#segmentColorPicker > div').forEach(d => d.classList.remove('border-dark','border-3')); this.classList.add('border-dark','border-3');">
                        </div>
                      `).join('')}
                    </div>
                    <input type="hidden" id="editSegmentColor" value="${segment.color || '#0d6efd'}">
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Icon</label>
                    <div class="d-flex flex-wrap gap-2" id="segmentIconPicker">
                      ${icons.map(ic => `
                        <button type="button" class="btn btn-sm ${segment.icon === ic ? 'btn-primary' : 'btn-outline-secondary'}"
                                onclick="document.getElementById('editSegmentIcon').value = '${ic}'; document.querySelectorAll('#segmentIconPicker > button').forEach(b => { b.classList.remove('btn-primary'); b.classList.add('btn-outline-secondary'); }); this.classList.remove('btn-outline-secondary'); this.classList.add('btn-primary');">
                          <i class="bi bi-${ic}"></i>
                        </button>
                      `).join('')}
                    </div>
                    <input type="hidden" id="editSegmentIcon" value="${segment.icon || 'tag'}">
                  </div>
                </form>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-success" onclick="crmModule.updateSegment('${segment.id}')">
                  <i class="bi bi-save me-2"></i>Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      const existingModal = document.getElementById('editSegmentModal');
      if (existingModal) existingModal.remove();
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      const modal = new bootstrap.Modal(document.getElementById('editSegmentModal'));
      modal.show();
      document.getElementById('editSegmentModal').addEventListener('hidden.bs.modal', function() { this.remove(); });
    } catch (error) {
      console.error('Error loading segment for edit:', error);
      utils.showToast('Error loading segment', 'error');
    }
  },

  async updateSegment(segmentId) {
    const form = document.getElementById('editSegmentForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const updateData = {
      segment_name: document.getElementById('editSegmentName').value,
      description: document.getElementById('editSegmentDescription').value,
      color: document.getElementById('editSegmentColor').value,
      icon: document.getElementById('editSegmentIcon').value
    };

    try {
      await utils.protectModalDuringSave('editSegmentModal', async () => {
        const { error } = await STATE.client
          .from('contact_segments')
          .update(updateData)
          .eq('id', segmentId);

        if (error) throw error;

        utils.showToast('Segment updated successfully', 'success');
        bootstrap.Modal.getInstance(document.getElementById('editSegmentModal')).hide();
        this.loadSegments();
      });
    } catch (error) {
      console.error('Error updating segment:', error);
      utils.showToast('Error updating segment: ' + error.message, 'error');
    }
  },
  // ============================================
  // SMART SEGMENTS (moved from Organisations)
  // ============================================
  _segmentRuleCount: 1,

  addSegmentRule() {
    const i = this._segmentRuleCount++;
    const ruleHtml = `<div class="segment-rule d-flex gap-2 align-items-center mb-2">
      <select class="form-select form-select-sm" style="width:auto;" id="segField${i}">
        <option value="tier">Tier</option><option value="status">Status</option><option value="region">Region</option>
        <option value="sector">Sector</option><option value="awards_count">Awards Count</option><option value="engagement">Engagement Score</option>
      </select>
      <select class="form-select form-select-sm" style="width:auto;" id="segOp${i}">
        <option value="eq">equals</option><option value="neq">not equals</option>
        <option value="gt">greater than</option><option value="lt">less than</option>
        <option value="contains">contains</option>
      </select>
      <input type="text" class="form-control form-control-sm" style="width:150px;" id="segVal${i}" placeholder="Value...">
      <button class="btn btn-sm btn-outline-danger" onclick="this.parentElement.remove()"><i class="bi bi-x"></i></button>
    </div>`;
    document.getElementById('smartSegmentRules')?.insertAdjacentHTML('beforeend', ruleHtml);
  },

  _getSegmentRules() {
    const rules = [];
    document.querySelectorAll('#smart-segments-content .segment-rule').forEach((el) => {
      const field = el.querySelector('[id^="segField"]')?.value;
      const op = el.querySelector('[id^="segOp"]')?.value;
      const val = el.querySelector('[id^="segVal"]')?.value.trim();
      if (field && val) rules.push({ field, op, val });
    });
    return rules;
  },

  _matchesSegmentRules(org, rules) {
    return rules.every(r => {
      let orgVal;
      if (r.field === 'engagement' && typeof orgsModule !== 'undefined') orgVal = orgsModule.calculateEngagementScore(org);
      else if (r.field === 'awards_count') orgVal = org.awards_count || 0;
      else orgVal = org[r.field] || '';

      const testVal = r.val;
      switch (r.op) {
        case 'eq': return String(orgVal).toLowerCase() === testVal.toLowerCase();
        case 'neq': return String(orgVal).toLowerCase() !== testVal.toLowerCase();
        case 'gt': return Number(orgVal) > Number(testVal);
        case 'lt': return Number(orgVal) < Number(testVal);
        case 'contains': return String(orgVal).toLowerCase().includes(testVal.toLowerCase());
        default: return false;
      }
    });
  },

  applySmartSegment() {
    const rules = this._getSegmentRules();
    if (rules.length === 0) { utils.showToast('Add at least one rule', 'warning'); return; }
    const orgs = (typeof STATE !== 'undefined' && STATE.allOrganisations) ? STATE.allOrganisations : [];
    const matching = orgs.filter(o => this._matchesSegmentRules(o, rules));
    this._lastSegmentMatches = matching;
    const resultEl = document.getElementById('smartSegmentResult');
    if (resultEl) {
      resultEl.innerHTML = `<div class="alert alert-info small py-2">
        <strong>${matching.length}</strong> organisations match this segment.
        <button class="btn btn-sm btn-outline-primary ms-2" onclick="crmModule.applySegmentAsFilter()">View in Organisations Tab</button>
      </div>
      ${matching.length > 0 ? `<div class="table-responsive mt-2"><table class="table table-sm table-hover"><thead><tr><th>Company</th><th>Status</th><th>Sector</th><th>Region</th></tr></thead><tbody>
        ${matching.slice(0, 50).map(o => `<tr><td>${utils.escapeHtml(o.company_name || '')}</td><td><span class="badge bg-primary">${utils.escapeHtml(o.status || '')}</span></td><td>${utils.escapeHtml(o.sector || '-')}</td><td>${utils.escapeHtml(o.region || '-')}</td></tr>`).join('')}
        ${matching.length > 50 ? `<tr><td colspan="4" class="text-muted text-center">... and ${matching.length - 50} more</td></tr>` : ''}
      </tbody></table></div>` : ''}`;
    }
  },

  applySegmentAsFilter() {
    if (!this._lastSegmentMatches) return;
    if (typeof STATE !== 'undefined') {
      STATE.filteredOrganisations = this._lastSegmentMatches;
      if (typeof orgsModule !== 'undefined') {
        orgsModule._currentPage = 1;
        orgsModule.renderOrganisations();
      }
    }
    // Navigate to organisations tab
    const orgsTab = document.getElementById('organisations-tab');
    if (orgsTab) { new bootstrap.Tab(orgsTab).show(); }
    utils.showToast(`Showing ${this._lastSegmentMatches.length} segment matches`, 'success');
  },

  async _loadSegments() {
    try {
      if (typeof STATE !== 'undefined' && STATE.client) {
        const { data } = await STATE.client.from('user_preferences').select('value').eq('key', 'orgsSegments').limit(1);
        if (data?.[0]) return JSON.parse(data[0].value);
      }
    } catch (e) { console.warn('Failed to load segments from database:', e.message); }
    try { return JSON.parse(localStorage.getItem('orgsSegments') || '{}'); } catch (e) { console.warn('Failed to parse segments from localStorage:', e.message); return {}; }
  },

  async _saveSegments(segments) {
    try {
      if (typeof STATE !== 'undefined' && STATE.client) {
        await STATE.client.from('user_preferences').upsert({ key: 'orgsSegments', value: JSON.stringify(segments), updated_at: new Date().toISOString() }, { onConflict: 'key' });
      }
    } catch (e) { console.warn('Failed to save segments to database:', e.message); }
    localStorage.setItem('orgsSegments', JSON.stringify(segments));
  },

  async saveSmartSegment() {
    const rules = this._getSegmentRules();
    if (rules.length === 0) { utils.showToast('Add at least one rule', 'warning'); return; }
    const name = prompt('Name this segment:');
    if (!name || !name.trim()) return;
    try {
      const segments = await this._loadSegments();
      segments[name.trim()] = rules;
      await this._saveSegments(segments);
      utils.showToast(`Segment "${name.trim()}" saved`, 'success');
    } catch (e) { console.warn('Failed to save smart segment:', e.message); }
  },

  async loadSmartSegments() {
    const segments = await this._loadSegments();
    const names = Object.keys(segments);
    if (names.length === 0) { utils.showToast('No saved segments', 'info'); return; }

    const resultEl = document.getElementById('smartSegmentResult');
    if (resultEl) {
      resultEl.innerHTML = `<h6 class="fw-semibold mb-2">Saved Segments</h6><div class="list-group">${names.map(n => {
        const rules = segments[n];
        return `<a href="#" class="list-group-item list-group-item-action small" onclick="event.preventDefault(); crmModule._loadAndApplySegment('${utils.escapeHtml(n).replace(/'/g, "\\'")}')">
          <strong>${utils.escapeHtml(n)}</strong> &mdash; ${rules.map(r => `${r.field} ${r.op} "${r.val}"`).join(' AND ')}
        </a>`;
      }).join('')}</div>`;
    }
  },

  async _loadAndApplySegment(name) {
    try {
      const segments = await this._loadSegments();
      const rules = segments[name];
      if (!rules) return;
      const orgs = (typeof STATE !== 'undefined' && STATE.allOrganisations) ? STATE.allOrganisations : [];
      const matching = orgs.filter(o => this._matchesSegmentRules(o, rules));
      this._lastSegmentMatches = matching;
      const resultEl = document.getElementById('smartSegmentResult');
      if (resultEl) {
        resultEl.innerHTML = `<div class="alert alert-success small py-2">
          <strong>"${utils.escapeHtml(name)}"</strong>: ${matching.length} organisations match.
          <button class="btn btn-sm btn-outline-primary ms-2" onclick="crmModule.applySegmentAsFilter()">View in Organisations Tab</button>
        </div>`;
      }
    } catch (e) { console.warn('Failed to load and apply segment:', e.message); }
  },

  // ============================================
  // MY TASKS & FOLLOW-UPS (moved from Organisations)
  // ============================================
  async loadMyTasks() {
    const container = document.getElementById('myTasksContainer');
    if (!container) return;

    let followUps = [];
    try {
      const { data } = await STATE.client.from('organisation_follow_ups').select('*').order('date', { ascending: true });
      followUps = data || [];
    } catch (e) { console.warn('Could not load follow-ups:', e); }

    const today = new Date().toISOString().split('T')[0];
    const overdue = followUps.filter(f => !f.done && f.date < today);
    const todayTasks = followUps.filter(f => !f.done && f.date === today);
    const upcoming = followUps.filter(f => !f.done && f.date > today).slice(0, 20);
    const completed = followUps.filter(f => f.done).slice(0, 10);
    const orgs = (typeof STATE !== 'undefined' && STATE.allOrganisations) ? STATE.allOrganisations : [];

    const renderTask = (f, section) => {
      const org = orgs.find(o => o.id === f.org_id);
      const orgName = org ? utils.escapeHtml(org.company_name) : 'Unknown';
      const icons = { overdue: 'bi-exclamation-triangle text-danger', today: 'bi-bell text-warning', completed: 'bi-check-circle text-success', upcoming: 'bi-clock text-info' };
      return `<div class="d-flex align-items-center py-2 border-bottom">
        <i class="bi ${icons[section]} me-2 fs-5"></i>
        <div class="flex-grow-1"><div class="fw-semibold small">${utils.escapeHtml(f.note || 'Follow up')}</div>
        <div class="text-muted" style="font-size:0.75rem;">${orgName} &middot; ${new Date(f.date).toLocaleDateString('en-GB')}${f.assignee ? ' &middot; ' + utils.escapeHtml(f.assignee) : ''}</div></div>
        ${!f.done ? `<button class="btn btn-sm btn-outline-success me-1" onclick="crmModule.completeTask('${f.org_id}','${f.id}')"><i class="bi bi-check"></i></button>` : ''}
        ${org ? `<button class="btn btn-sm btn-outline-primary" onclick="orgsModule.openCompanyProfile('${f.org_id}','${utils.escapeHtml(orgName).replace(/'/g, "\\'")}')"><i class="bi bi-eye"></i></button>` : ''}
      </div>`;
    };

    container.innerHTML = `
      <div class="row mb-3 text-center">
        <div class="col-3"><div class="card border-danger"><div class="card-body py-2"><h4 class="text-danger mb-0">${overdue.length}</h4><small class="text-muted">Overdue</small></div></div></div>
        <div class="col-3"><div class="card border-warning"><div class="card-body py-2"><h4 class="text-warning mb-0">${todayTasks.length}</h4><small class="text-muted">Today</small></div></div></div>
        <div class="col-3"><div class="card border-info"><div class="card-body py-2"><h4 class="text-info mb-0">${upcoming.length}</h4><small class="text-muted">Upcoming</small></div></div></div>
        <div class="col-3"><div class="card border-success"><div class="card-body py-2"><h4 class="text-success mb-0">${completed.length}</h4><small class="text-muted">Done</small></div></div></div>
      </div>
      ${overdue.length > 0 ? `<h6 class="text-danger fw-bold"><i class="bi bi-exclamation-triangle me-1"></i>Overdue (${overdue.length})</h6>${overdue.map(f => renderTask(f, 'overdue')).join('')}<hr>` : ''}
      ${todayTasks.length > 0 ? `<h6 class="text-warning fw-bold"><i class="bi bi-bell me-1"></i>Due Today</h6>${todayTasks.map(f => renderTask(f, 'today')).join('')}<hr>` : ''}
      ${upcoming.length > 0 ? `<h6 class="text-info fw-bold"><i class="bi bi-clock me-1"></i>Upcoming</h6>${upcoming.map(f => renderTask(f, 'upcoming')).join('')}<hr>` : ''}
      ${completed.length > 0 ? `<h6 class="text-success fw-bold"><i class="bi bi-check-circle me-1"></i>Recently Completed</h6>${completed.map(f => renderTask(f, 'completed')).join('')}` : ''}
      ${followUps.filter(f => !f.done).length === 0 ? '<div class="text-center py-4"><i class="bi bi-emoji-smile fs-1 d-block mb-2 text-success"></i><p class="text-muted">All caught up!</p></div>' : ''}`;
  },

  async completeTask(orgId, followUpId) {
    try {
      await STATE.client.from('organisation_follow_ups').update({ done: true }).eq('id', followUpId);
      utils.showToast('Task completed', 'success');
      this.loadMyTasks();
    } catch (e) {
      utils.showToast('Error completing task', 'error');
    }
  },

  async refreshMyTasks() {
    await this.loadMyTasks();
    utils.showToast('Tasks refreshed', 'success');
  },

  // ============================================
  // MISSING ACTION FUNCTIONS
  // ============================================

  openCompanyDetails() {
    // "Add Company Activity" button - opens the log communication form
    // which is the primary way to add activity for a company
    this.logCommunication(null);
  },

  async createMeetingNote() {
    try {
      // Load organisations for the company dropdown
      const { data: orgs, error: orgsError } = await STATE.client
        .from('organisations')
        .select('id, company_name')
        .order('company_name');

      if (orgsError) throw orgsError;

      const orgOptions = (orgs || []).map(o =>
        `<option value="${o.id}">${utils.escapeHtml(o.company_name)}</option>`
      ).join('');

      const today = new Date().toISOString().split('T')[0];

      const modalHtml = `
        <div class="modal fade" id="createMeetingNoteModal" tabindex="-1">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header bg-primary text-white">
                <h5 class="modal-title"><i class="bi bi-calendar-plus me-2"></i>Add Meeting Note</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <form id="createMeetingNoteForm">
                  <div class="row">
                    <div class="col-md-6 mb-3">
                      <label class="form-label">Meeting Title <span class="text-danger">*</span></label>
                      <input type="text" class="form-control" id="newMeetingTitle" required placeholder="e.g. Quarterly Review">
                    </div>
                    <div class="col-md-6 mb-3">
                      <label class="form-label">Company <span class="text-danger">*</span></label>
                      <select class="form-select" id="newMeetingOrg" required>
                        <option value="">Select company...</option>
                        ${orgOptions}
                      </select>
                    </div>
                  </div>
                  <div class="row">
                    <div class="col-md-4 mb-3">
                      <label class="form-label">Meeting Type</label>
                      <select class="form-select" id="newMeetingType">
                        <option value="in_person">In Person</option>
                        <option value="video_call">Video Call</option>
                        <option value="phone">Phone</option>
                        <option value="conference">Conference</option>
                      </select>
                    </div>
                    <div class="col-md-4 mb-3">
                      <label class="form-label">Date</label>
                      <input type="date" class="form-control" id="newMeetingDate" value="${today}">
                    </div>
                    <div class="col-md-4 mb-3">
                      <label class="form-label">Time</label>
                      <input type="time" class="form-control" id="newMeetingTime">
                    </div>
                  </div>
                  <div class="row">
                    <div class="col-md-6 mb-3">
                      <label class="form-label">Duration (minutes)</label>
                      <input type="number" class="form-control" id="newMeetingDuration" min="0" placeholder="60">
                    </div>
                    <div class="col-md-6 mb-3">
                      <label class="form-label">Location</label>
                      <input type="text" class="form-control" id="newMeetingLocation" placeholder="e.g. Office, Zoom, Teams">
                    </div>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Attendees (comma-separated)</label>
                    <input type="text" class="form-control" id="newMeetingAttendees" placeholder="John Smith, Jane Doe">
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Meeting Notes</label>
                    <textarea class="form-control" id="newMeetingNotes" rows="3" placeholder="Key discussion points..."></textarea>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Action Items</label>
                    <textarea class="form-control" id="newMeetingActions" rows="2" placeholder="Follow-up actions..."></textarea>
                  </div>
                  <div class="form-check mb-3">
                    <input class="form-check-input" type="checkbox" id="newMeetingFollowUp"
                           onchange="document.getElementById('newMeetingFollowUpDate').parentElement.style.display = this.checked ? 'block' : 'none';">
                    <label class="form-check-label" for="newMeetingFollowUp">Follow-up Required</label>
                  </div>
                  <div class="mb-3" style="display:none;">
                    <label class="form-label">Follow-up Date</label>
                    <input type="date" class="form-control" id="newMeetingFollowUpDate">
                  </div>
                </form>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" onclick="crmModule.saveMeetingNote()">
                  <i class="bi bi-save me-2"></i>Save Meeting Note
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      const existing = document.getElementById('createMeetingNoteModal');
      if (existing) existing.remove();
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      const modal = new bootstrap.Modal(document.getElementById('createMeetingNoteModal'));
      modal.show();
      utils.initInlineValidation('createMeetingNoteForm');
      document.getElementById('createMeetingNoteModal').addEventListener('hidden.bs.modal', function() { this.remove(); });
    } catch (error) {
      console.error('Error opening meeting note form:', error);
      utils.showToast('Error opening meeting note form', 'error');
    }
  },

  async saveMeetingNote() {
    const form = document.getElementById('createMeetingNoteForm');
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const dateVal = document.getElementById('newMeetingDate').value;
    const timeVal = document.getElementById('newMeetingTime').value;
    const meetingDate = timeVal ? `${dateVal}T${timeVal}:00` : `${dateVal}T00:00:00`;

    const attendeesRaw = document.getElementById('newMeetingAttendees').value;
    const attendeesArr = attendeesRaw ? attendeesRaw.split(',').map(a => a.trim()).filter(Boolean) : [];

    const data = {
      meeting_title: document.getElementById('newMeetingTitle').value,
      organisation_id: document.getElementById('newMeetingOrg').value,
      meeting_type: document.getElementById('newMeetingType').value,
      meeting_date: meetingDate,
      duration_minutes: document.getElementById('newMeetingDuration').value ? parseInt(document.getElementById('newMeetingDuration').value) : null,
      location: document.getElementById('newMeetingLocation').value,
      attendees: JSON.stringify(attendeesArr),
      notes: document.getElementById('newMeetingNotes').value,
      action_items: document.getElementById('newMeetingActions').value,
      follow_up_required: document.getElementById('newMeetingFollowUp').checked,
      follow_up_date: document.getElementById('newMeetingFollowUp').checked ? document.getElementById('newMeetingFollowUpDate').value : null,
      created_by: STATE.currentUser?.email
    };

    try {
      await utils.protectModalDuringSave('createMeetingNoteModal', async () => {
        const { error } = await STATE.client.from('meeting_notes').insert(data);
        if (error) throw error;

        bootstrap.Modal.getInstance(document.getElementById('createMeetingNoteModal')).hide();
      });
    } catch (error) {
      console.warn('DB insert for meeting note failed, using localStorage:', error);
      const key = 'bta_meeting_notes_pending';
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      data.id = crypto.randomUUID();
      stored.push(data);
      localStorage.setItem(key, JSON.stringify(stored));
      bootstrap.Modal.getInstance(document.getElementById('createMeetingNoteModal'))?.hide();
    }
    utils.showToast('Meeting note saved', 'success');
    this.loadMeetings();
  },

  async assignSegments() {
    try {
      // Load segments; use already-loaded organisations
      const { data: segmentsData, error: segmentsError } = await STATE.client
        .from('contact_segments').select('*').order('segment_name');

      if (segmentsError) throw segmentsError;

      const segments = segmentsData || [];
      const orgs = (STATE.allOrganisations || [])
        .map(o => ({ id: o.id, company_name: o.company_name }))
        .sort((a, b) => (a.company_name || '').localeCompare(b.company_name || ''));

      const orgOptions = orgs.map(o =>
        `<option value="${o.id}">${utils.escapeHtml(o.company_name)}</option>`
      ).join('');

      const segmentCheckboxes = segments.map(s => `
        <div class="form-check">
          <input class="form-check-input segment-assign-check" type="checkbox" value="${s.id}" id="segAssign_${s.id}">
          <label class="form-check-label" for="segAssign_${s.id}">
            <i class="bi bi-${s.icon || 'tag'} me-1" style="color: ${s.color}"></i>
            ${utils.escapeHtml(s.segment_name)}
          </label>
        </div>
      `).join('');

      const modalHtml = `
        <div class="modal fade" id="assignSegmentsModal" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header bg-primary text-white">
                <h5 class="modal-title"><i class="bi bi-tags me-2"></i>Assign Company to Segments</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <div class="mb-3">
                  <label class="form-label">Select Company <span class="text-danger">*</span></label>
                  <select class="form-select" id="assignSegmentOrg" required>
                    <option value="">Select company...</option>
                    ${orgOptions}
                  </select>
                </div>
                <div class="mb-3">
                  <label class="form-label">Select Segments</label>
                  ${segments.length > 0 ? segmentCheckboxes : '<p class="text-muted">No segments created yet.</p>'}
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" onclick="crmModule.saveSegmentAssignments()">
                  <i class="bi bi-save me-2"></i>Assign
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      const existing = document.getElementById('assignSegmentsModal');
      if (existing) existing.remove();
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      const modal = new bootstrap.Modal(document.getElementById('assignSegmentsModal'));
      modal.show();
      document.getElementById('assignSegmentsModal').addEventListener('hidden.bs.modal', function() { this.remove(); });
    } catch (error) {
      console.error('Error opening assign segments:', error);
      utils.showToast('Error loading segments data', 'error');
    }
  },

  async saveSegmentAssignments() {
    const orgId = document.getElementById('assignSegmentOrg').value;
    if (!orgId) { utils.showToast('Please select a company', 'warning'); return; }

    const checked = document.querySelectorAll('.segment-assign-check:checked');
    if (checked.length === 0) { utils.showToast('Please select at least one segment', 'warning'); return; }

    try {
      await utils.protectModalDuringSave('assignSegmentsModal', async () => {
        const assignments = [...checked].map(cb => ({
          organisation_id: orgId,
          segment_id: cb.value
        }));

        const { error } = await STATE.client.from('organisation_segments').upsert(assignments, { onConflict: 'organisation_id,segment_id' });
        if (error) throw error;

        bootstrap.Modal.getInstance(document.getElementById('assignSegmentsModal')).hide();
      });
    } catch (error) {
      console.warn('DB upsert for segment assignments failed, using localStorage:', error);
      const key = `bta_org_segments_${orgId}`;
      const stored = [...checked].map(cb => cb.value);
      localStorage.setItem(key, JSON.stringify(stored));
      bootstrap.Modal.getInstance(document.getElementById('assignSegmentsModal'))?.hide();
    }
    utils.showToast(`Company assigned to ${checked.length} segment(s)`, 'success');
    this.loadSegments();
  },

  async createCustomSegment() {
    const colors = ['#0d6efd', '#198754', '#dc3545', '#ffc107', '#0dcaf0', '#6f42c1', '#fd7e14', '#20c997', '#d63384', '#6610f2'];
    const icons = ['tag', 'trophy', 'star', 'people', 'building', 'award', 'cash', 'calendar-event', 'graph-up', 'megaphone'];

    const modalHtml = `
      <div class="modal fade" id="createSegmentModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title"><i class="bi bi-plus-circle me-2"></i>Create Custom Segment</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="createSegmentForm">
                <div class="mb-3">
                  <label class="form-label">Segment Name <span class="text-danger">*</span></label>
                  <input type="text" class="form-control" id="newSegmentName" required placeholder="e.g. Enterprise Clients">
                </div>
                <div class="mb-3">
                  <label class="form-label">Description</label>
                  <textarea class="form-control" id="newSegmentDescription" rows="2" placeholder="Brief description of this segment..."></textarea>
                </div>
                <div class="mb-3">
                  <label class="form-label">Color</label>
                  <div class="d-flex flex-wrap gap-2" id="newSegmentColorPicker">
                    ${colors.map((c, i) => `
                      <div class="rounded-circle border ${i === 0 ? 'border-dark border-3' : ''}"
                           style="width: 32px; height: 32px; background: ${c}; cursor: pointer;"
                           onclick="document.getElementById('newSegmentColor').value = '${c}'; document.querySelectorAll('#newSegmentColorPicker > div').forEach(d => d.classList.remove('border-dark','border-3')); this.classList.add('border-dark','border-3');">
                      </div>
                    `).join('')}
                  </div>
                  <input type="hidden" id="newSegmentColor" value="#0d6efd">
                </div>
                <div class="mb-3">
                  <label class="form-label">Icon</label>
                  <div class="d-flex flex-wrap gap-2" id="newSegmentIconPicker">
                    ${icons.map((ic, i) => `
                      <button type="button" class="btn btn-sm ${i === 0 ? 'btn-primary' : 'btn-outline-secondary'}"
                              onclick="document.getElementById('newSegmentIcon').value = '${ic}'; document.querySelectorAll('#newSegmentIconPicker > button').forEach(b => { b.classList.remove('btn-primary'); b.classList.add('btn-outline-secondary'); }); this.classList.remove('btn-outline-secondary'); this.classList.add('btn-primary');">
                        <i class="bi bi-${ic}"></i>
                      </button>
                    `).join('')}
                  </div>
                  <input type="hidden" id="newSegmentIcon" value="tag">
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" onclick="crmModule.saveCustomSegment()">
                <i class="bi bi-save me-2"></i>Create Segment
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById('createSegmentModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('createSegmentModal'));
    modal.show();
    document.getElementById('createSegmentModal').addEventListener('hidden.bs.modal', function() { this.remove(); });
  },

  async saveCustomSegment() {
    const form = document.getElementById('createSegmentForm');
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const data = {
      segment_name: document.getElementById('newSegmentName').value,
      description: document.getElementById('newSegmentDescription').value,
      color: document.getElementById('newSegmentColor').value,
      icon: document.getElementById('newSegmentIcon').value
    };

    try {
      await utils.protectModalDuringSave('createSegmentModal', async () => {
        const { error } = await STATE.client.from('contact_segments').insert(data);
        if (error) throw error;

        bootstrap.Modal.getInstance(document.getElementById('createSegmentModal')).hide();
      });
    } catch (error) {
      console.warn('DB insert for custom segment failed, using localStorage:', error);
      const key = 'bta_custom_segments';
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      data.id = crypto.randomUUID();
      stored.push(data);
      localStorage.setItem(key, JSON.stringify(stored));
      bootstrap.Modal.getInstance(document.getElementById('createSegmentModal'))?.hide();
    }
    utils.showToast('Segment created successfully', 'success');
    this.loadSegments();
  },

  // ============================================
  // PAGINATION, SORTING, BULK ACTIONS & EXPORT
  // ============================================

  _renderCrmPagination(containerId, currentPage, totalPages, goToFn, tbodyId) {
    let el = document.getElementById(containerId);
    if (!el) {
      el = document.createElement('div');
      el.id = containerId;
      // Insert after the table containing the tbody
      const tbody = tbodyId ? document.getElementById(tbodyId) : null;
      const tableParent = tbody?.closest('.table-responsive') || tbody?.parentElement;
      if (tableParent) tableParent.after(el);
      else document.querySelector('.tab-pane.active')?.appendChild(el);
    }
    if (totalPages > 1) {
      let html = '<nav><ul class="pagination pagination-sm justify-content-center mt-3">';
      html += `<li class="page-item ${currentPage <= 1 ? 'disabled' : ''}"><a class="page-link" href="#" onclick="event.preventDefault(); ${goToFn}(${currentPage - 1})">Prev</a></li>`;
      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
          html += `<li class="page-item ${i === currentPage ? 'active' : ''}"><a class="page-link" href="#" onclick="event.preventDefault(); ${goToFn}(${i})">${i}</a></li>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
          html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
      }
      html += `<li class="page-item ${currentPage >= totalPages ? 'disabled' : ''}"><a class="page-link" href="#" onclick="event.preventDefault(); ${goToFn}(${currentPage + 1})">Next</a></li>`;
      html += '</ul></nav>';
      el.innerHTML = html;
    } else if (el) {
      el.innerHTML = '';
    }
  },

  sortCommunications(field) {
    if (this._crmSortField === field) {
      this._crmSortDir = this._crmSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this._crmSortField = field;
      this._crmSortDir = 'asc';
    }
    utils.saveSortState('crm_communications', this._crmSortField, this._crmSortDir);
    const sorted = [...(this._communications || [])].sort((a, b) => {
      let aVal, bVal;
      if (field === 'company') {
        aVal = (a.organisation?.company_name || '').toLowerCase();
        bVal = (b.organisation?.company_name || '').toLowerCase();
      } else if (field === 'contact') {
        aVal = (a.contact ? `${a.contact.first_name} ${a.contact.last_name}` : '').toLowerCase();
        bVal = (b.contact ? `${b.contact.first_name} ${b.contact.last_name}` : '').toLowerCase();
      } else {
        aVal = (a[field] || '').toString().toLowerCase();
        bVal = (b[field] || '').toString().toLowerCase();
      }
      if (aVal < bVal) return this._crmSortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return this._crmSortDir === 'asc' ? 1 : -1;
      return 0;
    });
    this._communications = sorted;
    this._crmCurrentPage = 1;
    this.renderCommunicationsTable(sorted);
  },

  sortDeals(field) {
    if (this._dealSortField === field) {
      this._dealSortDir = this._dealSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this._dealSortField = field;
      this._dealSortDir = 'asc';
    }
    utils.saveSortState('crm_deals', this._dealSortField, this._dealSortDir);
    const sorted = [...(this._deals || [])].sort((a, b) => {
      let aVal, bVal;
      if (field === 'company') {
        aVal = (a.organisation?.company_name || '').toLowerCase();
        bVal = (b.organisation?.company_name || '').toLowerCase();
      } else if (field === 'deal_value') {
        aVal = parseFloat(a.deal_value) || 0;
        bVal = parseFloat(b.deal_value) || 0;
      } else if (field === 'probability') {
        aVal = parseFloat(a.probability) || 0;
        bVal = parseFloat(b.probability) || 0;
      } else {
        aVal = (a[field] || '').toString().toLowerCase();
        bVal = (b[field] || '').toString().toLowerCase();
      }
      if (aVal < bVal) return this._dealSortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return this._dealSortDir === 'asc' ? 1 : -1;
      return 0;
    });
    this._deals = sorted;
    this._dealCurrentPage = 1;
    this.renderDealsTable(sorted);
  },

  sortMeetings(field) {
    if (this._meetingSortField === field) {
      this._meetingSortDir = this._meetingSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this._meetingSortField = field;
      this._meetingSortDir = 'asc';
    }
    utils.saveSortState('crm_meetings', this._meetingSortField, this._meetingSortDir);
    const sorted = [...(this._meetings || [])].sort((a, b) => {
      let aVal, bVal;
      if (field === 'company') {
        aVal = (a.organisation?.company_name || '').toLowerCase();
        bVal = (b.organisation?.company_name || '').toLowerCase();
      } else {
        aVal = (a[field] || '').toString().toLowerCase();
        bVal = (b[field] || '').toString().toLowerCase();
      }
      if (aVal < bVal) return this._meetingSortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return this._meetingSortDir === 'asc' ? 1 : -1;
      return 0;
    });
    this._meetings = sorted;
    this._meetingCurrentPage = 1;
    this.renderMeetingsTable(sorted);
  },

  toggleCrmSelect(id, checked, type) {
    const set = type === 'deal' ? this._selectedDealIds : type === 'meeting' ? this._selectedMeetingIds : this._selectedCrmIds;
    if (checked) set.add(id); else set.delete(id);
  },

  async bulkDeleteCrm(type) {
    const set = type === 'deal' ? this._selectedDealIds : type === 'meeting' ? this._selectedMeetingIds : this._selectedCrmIds;
    if (set.size === 0) return;
    const table = type === 'deal' ? 'deals' : type === 'meeting' ? 'meeting_notes' : 'communications';
    if (!await utils.confirmDialog({ title: 'Bulk Delete', message: `Delete ${set.size} ${type} record(s)? This cannot be undone.`, confirmText: 'Delete All', danger: true })) return;
    try {
      utils.showLoading();
      const ids = [...set];
      const result = await utils.runBatchOperation(ids, async (id) => {
        const { error } = await STATE.client.from(table).delete().eq('id', id);
        if (error) throw error;
      }, `Deleting ${type} records`);
      utils.showToast(`${result.succeeded.length} ${type} record(s) deleted`, 'success');
      set.clear();
      if (type === 'deal') this.loadDeals();
      else if (type === 'meeting') this.loadMeetings();
      else this.loadCommunications();
    } catch (err) {
      utils.showToast('Error: ' + err.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  exportCrmToCSV(type) {
    let data, filename, headers;
    if (type === 'communications') {
      data = this._communications || [];
      filename = 'crm-communications';
      headers = ['Date', 'Type', 'Company', 'Contact', 'Subject', 'Notes'];
      const rows = data.map(r => [
        r.communication_date || '', r.type || '', r.organisation?.company_name || '', r.contact ? `${r.contact.first_name} ${r.contact.last_name}` : '', r.subject || '', (r.message || '').replace(/"/g, '""')
      ]);
      this._downloadCSV(headers, rows, filename);
    } else if (type === 'deals') {
      data = this._deals || [];
      filename = 'crm-deals';
      headers = ['Deal Name', 'Company', 'Value', 'Stage', 'Probability', 'Expected Close', 'Created'];
      const rows = data.map(r => [
        r.deal_name || '', r.organisation?.company_name || '', r.deal_value || 0, r.stage || '', r.probability || '', r.expected_close_date || '', r.created_at || ''
      ]);
      this._downloadCSV(headers, rows, filename);
    } else if (type === 'meetings') {
      data = this._meetings || [];
      filename = 'crm-meetings';
      headers = ['Date', 'Title', 'Company', 'Attendees', 'Location', 'Notes'];
      const rows = data.map(r => [
        r.meeting_date || '', r.meeting_title || '', r.organisation?.company_name || '', r.attendees || '', r.location || '', (r.notes || '').replace(/"/g, '""')
      ]);
      this._downloadCSV(headers, rows, filename);
    }
  },

  _downloadCSV(headers, rows, filename) {
    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  toggleKanbanView() {
    this._kanbanView = !this._kanbanView;
    this.renderDealsTable(this._deals);
  },

  renderKanbanBoard() {
    const deals = this._deals || [];
    const stages = ['prospecting', 'proposal', 'negotiation', 'won', 'lost'];
    const stageLabels = { prospecting: 'Prospecting', proposal: 'Proposal', negotiation: 'Negotiation', won: 'Won', lost: 'Lost' };
    const stageColors = { prospecting: 'primary', proposal: 'info', negotiation: 'warning', won: 'success', lost: 'danger' };

    const tbody = document.getElementById('dealsTableBody');
    const container = tbody?.closest('.table-responsive') || tbody?.parentElement;
    if (!container) return;

    let html = '<div class="kanban-board">';
    stages.forEach(stage => {
      const stageDeals = deals.filter(d => (d.stage || 'prospecting') === stage);
      const totalValue = stageDeals.reduce((sum, d) => sum + (parseFloat(d.deal_value) || 0), 0);
      html += `
        <div class="kanban-column">
          <div class="kanban-column-header">
            <span class="badge bg-${stageColors[stage]}">${stageLabels[stage]}</span>
            <span class="text-muted small">${stageDeals.length} &middot; £${totalValue.toLocaleString()}</span>
          </div>
          ${stageDeals.length === 0 ? '<p class="text-muted small text-center py-3">No deals</p>' : ''}
          ${stageDeals.map(deal => `
            <div class="kanban-card" draggable="true" data-deal-id="${deal.id}">
              <div class="fw-semibold small">${utils.escapeHtml(deal.deal_name || 'Untitled')}</div>
              <div class="text-muted" style="font-size:0.75rem;">${utils.escapeHtml(deal.company_name || '')}</div>
              <div class="kanban-deal-value mt-1">£${(parseFloat(deal.deal_value) || 0).toLocaleString()}</div>
            </div>
          `).join('')}
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
  },

  goToCrmPage(page, type) {
    if (type === 'deal') {
      const totalPages = Math.ceil((this._deals || []).length / this._dealPageSize);
      this._dealCurrentPage = Math.max(1, Math.min(page, totalPages));
      this.renderDealsTable(this._deals);
    } else if (type === 'meeting') {
      const totalPages = Math.ceil((this._meetings || []).length / this._meetingPageSize);
      this._meetingCurrentPage = Math.max(1, Math.min(page, totalPages));
      this.renderMeetingsTable(this._meetings);
    } else {
      const totalPages = Math.ceil((this._communications || []).length / this._crmPageSize);
      this._crmCurrentPage = Math.max(1, Math.min(page, totalPages));
      this.renderCommunicationsTable(this._communications);
    }
  }
};

// ============================================
// INITIALIZATION
// ============================================
console.log('✅ CRM Module loaded');
