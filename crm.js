// ============================================
// CRM MODULE FOR AWARDS CMS
// Customer Relationship Management System
// ============================================

const crmModule = {
  currentSubTab: 'companies-crm',
  filters: {
    companies: {},
    communications: { type: 'all', regarding: 'all', followUpRequired: 'all' },
    deals: { stage: 'all', type: 'all', status: 'active' },
    meetings: { type: 'all' },
    segments: {}
  },

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
      }
    } catch (error) {
      console.error('Error loading CRM data:', error);
      showNotification('Error loading CRM data', 'error');
    }
  },

  // ============================================
  // COMPANIES CRM VIEW
  // ============================================
  async loadCompanies() {
    console.log('Loading companies CRM view...');

    try {
      // Load organisations with CRM summary from view
      const { data: companies, error } = await supabase
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

      // Update stats display
      document.getElementById('crm-total-companies').textContent = stats.totalCompanies;
      document.getElementById('crm-active-deals').textContent = stats.activeDeals;
      document.getElementById('crm-recent-comms').textContent = stats.recentCommunications;
      document.getElementById('crm-pending-followups').textContent = stats.pendingFollowUps;

      // Render companies table
      this.renderCompaniesTable(companies);

    } catch (error) {
      console.error('Error loading companies:', error);
      showNotification('Error loading companies data', 'error');
    }
  },

  renderCompaniesTable(companies) {
    const tbody = document.getElementById('companiesCrmTableBody');
    if (!tbody) return;

    if (!companies || companies.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No companies found</td></tr>';
      return;
    }

    tbody.innerHTML = companies.map(company => {
      const lastContact = company.last_communication_date
        ? new Date(company.last_communication_date).toLocaleDateString()
        : '<span class="text-muted">Never</span>';

      const pipelineValue = company.pipeline_value
        ? `£${parseFloat(company.pipeline_value).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
        : '£0.00';

      const segments = company.segments || '<span class="text-muted">None</span>';

      return `
        <tr>
          <td>
            <strong>${company.company_name || 'Unknown'}</strong><br>
            <small class="text-muted">${company.industry || 'N/A'}</small>
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
              <button class="btn btn-outline-primary" onclick="crmModule.viewCompanyProfile('${company.id}')" title="View Profile">
                <i class="bi bi-eye"></i>
              </button>
              <button class="btn btn-outline-success" onclick="crmModule.logCommunication('${company.id}')" title="Log Communication">
                <i class="bi bi-chat-dots"></i>
              </button>
              <button class="btn btn-outline-info" onclick="crmModule.createDeal('${company.id}')" title="Create Deal">
                <i class="bi bi-cash-coin"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // ============================================
  // COMMUNICATIONS LOG
  // ============================================
  async loadCommunications() {
    console.log('Loading communications...');

    try {
      let query = supabase
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
        query = query.eq('follow_up_required', this.filters.communications.followUpRequired === 'yes');
      }

      const { data: communications, error } = await query;

      if (error) throw error;

      this.renderCommunicationsTable(communications);

    } catch (error) {
      console.error('Error loading communications:', error);
      showNotification('Error loading communications', 'error');
    }
  },

  renderCommunicationsTable(communications) {
    const tbody = document.getElementById('communicationsTableBody');
    if (!tbody) return;

    if (!communications || communications.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No communications found</td></tr>';
      return;
    }

    tbody.innerHTML = communications.map(comm => {
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
            <strong>${companyName}</strong><br>
            <small class="text-muted">${contactName}</small>
          </td>
          <td>
            <strong>${comm.subject || 'No subject'}</strong><br>
            <small class="text-muted">${comm.message.substring(0, 50)}${comm.message.length > 50 ? '...' : ''}</small>
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
      let query = supabase
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

      // Update stats display
      document.getElementById('deals-active-count').textContent = stats.activeCount;
      document.getElementById('deals-pipeline-value').textContent =
        `£${stats.pipelineValue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
      document.getElementById('deals-won-month').textContent = stats.wonThisMonth;
      document.getElementById('deals-win-rate').textContent = `${stats.winRate}%`;

      this.renderDealsTable(deals);

    } catch (error) {
      console.error('Error loading deals:', error);
      showNotification('Error loading deals', 'error');
    }
  },

  renderDealsTable(deals) {
    const tbody = document.getElementById('dealsTableBody');
    if (!tbody) return;

    if (!deals || deals.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">No deals found</td></tr>';
      return;
    }

    tbody.innerHTML = deals.map(deal => {
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
            <strong>${deal.deal_name}</strong><br>
            <small class="text-muted">${deal.description ? deal.description.substring(0, 40) + '...' : ''}</small>
          </td>
          <td>${companyName}</td>
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
      let query = supabase
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

      this.renderMeetingsTable(meetings);

    } catch (error) {
      console.error('Error loading meetings:', error);
      showNotification('Error loading meetings', 'error');
    }
  },

  renderMeetingsTable(meetings) {
    const tbody = document.getElementById('meetingsTableBody');
    if (!tbody) return;

    if (!meetings || meetings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No meetings found</td></tr>';
      return;
    }

    tbody.innerHTML = meetings.map(meeting => {
      const date = new Date(meeting.meeting_date).toLocaleDateString();
      const time = new Date(meeting.meeting_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const companyName = meeting.organisation?.company_name || 'Unknown';
      const typeBadge = this.getMeetingTypeBadge(meeting.meeting_type);
      const duration = meeting.duration_minutes ? `${meeting.duration_minutes} min` : '<span class="text-muted">N/A</span>';

      let attendees = '<span class="text-muted">None</span>';
      try {
        const attendeesList = JSON.parse(meeting.attendees || '[]');
        attendees = attendeesList.length > 0 ? `${attendeesList.length} attendees` : attendees;
      } catch (e) {}

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
            <strong>${meeting.meeting_title}</strong><br>
            <small class="text-muted">${companyName}</small>
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
      const { data: segments, error } = await supabase
        .from('contact_segments')
        .select(`
          *,
          organisation_segments(count)
        `)
        .order('segment_name');

      if (error) throw error;

      // Get counts for each segment
      const segmentsWithCounts = await Promise.all(
        segments.map(async segment => {
          const { count, error } = await supabase
            .from('organisation_segments')
            .select('*', { count: 'exact', head: true })
            .eq('segment_id', segment.id);

          return {
            ...segment,
            count: count || 0
          };
        })
      );

      this.renderSegments(segmentsWithCounts);

    } catch (error) {
      console.error('Error loading segments:', error);
      showNotification('Error loading segments', 'error');
    }
  },

  renderSegments(segments) {
    const container = document.getElementById('segmentsContainer');
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
                  ${segment.segment_name}
                </h5>
                <p class="card-text text-muted small mb-0">${segment.description || ''}</p>
              </div>
              <span class="badge rounded-pill" style="background-color: ${segment.color}; font-size: 1.2em;">
                ${segment.count}
              </span>
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-primary flex-grow-1" onclick="crmModule.viewSegmentCompanies('${segment.id}', '${segment.segment_name}')">
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

  // ============================================
  // MODAL & ACTION FUNCTIONS
  // ============================================
  viewCompanyProfile(companyId) {
    console.log('View company profile:', companyId);
    // This would open the organisation modal from organisations.js
    if (typeof organisationsModule !== 'undefined' && organisationsModule.showCompanyModal) {
      organisationsModule.showCompanyModal(companyId);
    } else {
      showNotification('Company profile view not available', 'warning');
    }
  },

  async logCommunication(organisationId = null) {
    console.log('Log communication for:', organisationId);

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

    // Load organisations for dropdown
    const { data: orgs } = await supabase
      .from('organisations')
      .select('id, company_name')
      .order('company_name');

    const orgSelect = document.getElementById('commOrganisation');
    orgSelect.innerHTML = '<option value="">Select company...</option>' +
      orgs.map(org => `<option value="${org.id}" ${org.id === organisationId ? 'selected' : ''}>${org.company_name}</option>`).join('');

    // Show/hide follow-up date field
    document.getElementById('commFollowUp').addEventListener('change', function() {
      document.getElementById('followUpDateContainer').style.display = this.checked ? 'block' : 'none';
    });

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('logCommunicationModal'));
    modal.show();
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
      user_id: currentUser?.id || 'system'
    };

    try {
      const { error } = await supabase
        .from('communications')
        .insert([communicationData]);

      if (error) throw error;

      showNotification('Communication logged successfully', 'success');
      bootstrap.Modal.getInstance(document.getElementById('logCommunicationModal')).hide();
      this.loadCommunications();
    } catch (error) {
      console.error('Error saving communication:', error);
      showNotification('Error logging communication', 'error');
    }
  },

  async createDeal(organisationId = null) {
    console.log('Create deal for:', organisationId);
    showNotification('Deal creation modal coming soon', 'info');
  },

  async viewCommunication(commId) {
    console.log('View communication:', commId);
    showNotification('Communication detail view coming soon', 'info');
  },

  async editCommunication(commId) {
    console.log('Edit communication:', commId);
    showNotification('Communication editing coming soon', 'info');
  },

  async deleteCommunication(commId) {
    if (!confirm('Are you sure you want to delete this communication? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('communications')
        .delete()
        .eq('id', commId);

      if (error) throw error;

      showNotification('Communication deleted successfully', 'success');
      this.loadCommunications();
    } catch (error) {
      console.error('Error deleting communication:', error);
      showNotification('Error deleting communication', 'error');
    }
  },

  async viewDeal(dealId) {
    console.log('View deal:', dealId);
    showNotification('Deal detail view coming soon', 'info');
  },

  async editDeal(dealId) {
    console.log('Edit deal:', dealId);
    showNotification('Deal editing coming soon', 'info');
  },

  async deleteDeal(dealId) {
    if (!confirm('Are you sure you want to delete this deal? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('deals')
        .delete()
        .eq('id', dealId);

      if (error) throw error;

      showNotification('Deal deleted successfully', 'success');
      this.loadDeals();
    } catch (error) {
      console.error('Error deleting deal:', error);
      showNotification('Error deleting deal', 'error');
    }
  },

  async viewMeeting(meetingId) {
    console.log('View meeting:', meetingId);
    showNotification('Meeting detail view coming soon', 'info');
  },

  async editMeeting(meetingId) {
    console.log('Edit meeting:', meetingId);
    showNotification('Meeting editing coming soon', 'info');
  },

  async deleteMeeting(meetingId) {
    if (!confirm('Are you sure you want to delete this meeting note? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('meeting_notes')
        .delete()
        .eq('id', meetingId);

      if (error) throw error;

      showNotification('Meeting note deleted successfully', 'success');
      this.loadMeetings();
    } catch (error) {
      console.error('Error deleting meeting:', error);
      showNotification('Error deleting meeting note', 'error');
    }
  },

  async viewSegmentCompanies(segmentId, segmentName) {
    console.log('View companies in segment:', segmentName);
    showNotification(`Viewing companies in ${segmentName} - coming soon`, 'info');
  },

  async editSegment(segmentId) {
    console.log('Edit segment:', segmentId);
    showNotification('Segment editing coming soon', 'info');
  }
};

// ============================================
// INITIALIZATION
// ============================================
console.log('✅ CRM Module loaded');
