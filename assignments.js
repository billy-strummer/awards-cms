/* ==================================================== */
/* AWARD ASSIGNMENTS MODULE - FIXED VERSION */
/* Works with basic organisations table structure */
/* ==================================================== */

const assignmentsModule = {
  currentAwardId: null,
  currentAwardName: null,

  /**
   * Get all assignments for a specific award
   */
  async getAwardAssignments(awardId) {
    try {
      console.log(`🔍 Fetching assignments for award ID: ${awardId}`);

      const { data, error } = await STATE.client
        .from('award_assignments')
        .select(`
          *,
          organisations!award_assignments_organisation_id_fkey (*)
        `)
        .eq('award_id', awardId);

      if (error) {
        console.error('❌ Database error loading assignments:', error);
        throw error;
      }

      console.log(`✅ Found ${data?.length || 0} assignments`);

      // Sort alphabetically by company name
      const sortedData = (data || []).sort((a, b) => {
        const nameA = a.organisations?.company_name?.toLowerCase() || '';
        const nameB = b.organisations?.company_name?.toLowerCase() || '';
        return nameA.localeCompare(nameB);
      });

      return sortedData;
    } catch (error) {
      console.error('💥 Error loading assignments:', error);
      utils.showToast('Failed to load assignments: ' + error.message, 'error');
      return [];
    }
  },

  /**
   * Open assignments modal for an award
   */
  async openAssignmentsModal(awardId, awardName) {
    this.currentAwardId = awardId;
    this.currentAwardName = awardName;
    
    const modal = new bootstrap.Modal(document.getElementById('assignmentsModal'));
    const titleEl = document.getElementById('assignmentsModalTitle');
    const contentEl = document.getElementById('assignmentsContent');
    
    titleEl.innerHTML = `
      <i class="bi bi-trophy me-2"></i>${utils.escapeHtml(awardName)} - Manage Nominees
    `;
    
    // Show loading
    contentEl.innerHTML = `
      <div class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="text-muted mt-2">Loading assignments...</p>
      </div>
    `;
    
    modal.show();
    
    // Load data
    await this.refreshAssignments();
  },

  /**
   * Refresh assignments display
   */
  async refreshAssignments() {
    const contentEl = document.getElementById('assignmentsContent');

    try {
      // Load current assignments
      const assignments = await this.getAwardAssignments(this.currentAwardId);

      console.log(`📋 Loaded ${assignments.length} assignments for award ${this.currentAwardId}`);

      // Filter out assignments with missing organisations (deleted companies)
      const validAssignments = assignments.filter(a => {
        if (!a.organisations || !a.organisations.id) {
          console.warn('⚠️ Found assignment with missing organisation:', a);
          return false;
        }
        return true;
      });

      if (validAssignments.length < assignments.length) {
        console.warn(`⚠️ Filtered out ${assignments.length - validAssignments.length} assignments with missing organisations`);
      }

      // Load available organisations (only essential columns)
      const { data: allOrgs, error: orgsError } = await STATE.client
        .from('organisations')
        .select('id, company_name, email, logo_url')
        .order('company_name', { ascending: true });

      if (orgsError) throw orgsError;

      // Filter out already assigned organisations
      const assignedOrgIds = validAssignments.map(a => a.organisations.id);
      const availableOrgs = (allOrgs || []).filter(org => !assignedOrgIds.includes(org.id));

      console.log(`📊 ${validAssignments.length} assigned, ${availableOrgs.length} available`);

      // Store all assignments for filtering
      this.allAssignments = validAssignments;
      this.currentFilter = 'all';

      // Render UI
      contentEl.innerHTML = `
        <div class="row">
          <div class="col-md-6">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h5 class="mb-0">
                <i class="bi bi-people-fill me-2 text-success"></i>
                Assigned Companies (<span id="assignedCount">${validAssignments.length}</span>)
              </h5>
            </div>

            ${validAssignments.length === 0 ? `
              <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>
                No companies assigned yet. Select companies from the right panel to add them.
              </div>
            ` : `
              <div class="btn-group btn-group-sm mb-3 d-flex" role="group">
                <button type="button" class="btn btn-outline-secondary active" id="filter-all" onclick="assignmentsModule.filterAssignments('all')">
                  All
                </button>
                <button type="button" class="btn btn-outline-info" id="filter-self" onclick="assignmentsModule.filterAssignments('self_nomination')">
                  <i class="bi bi-hand-index me-1"></i>Self Nominated
                </button>
                <button type="button" class="btn btn-outline-warning" id="filter-previous" onclick="assignmentsModule.filterAssignments('previous_winner')">
                  <i class="bi bi-trophy me-1"></i>Previous Winners
                </button>
                <button type="button" class="btn btn-outline-primary" id="filter-new" onclick="assignmentsModule.filterAssignments('new')">
                  <i class="bi bi-star me-1"></i>New Nominees
                </button>
              </div>
              <div class="assigned-companies-list" id="assignedCompaniesList">
                ${validAssignments.map(a => this.renderAssignedCompany(a)).join('')}
              </div>
            `}
          </div>

          <div class="col-md-6">
            <h5 class="mb-3">
              <i class="bi bi-plus-circle me-2 text-primary"></i>
              Add Companies
            </h5>

            <div class="mb-3">
              <input
                type="text"
                class="form-control"
                id="assignmentSearchBox"
                placeholder="Search companies..."
                onkeyup="assignmentsModule.filterAvailableCompanies()">
            </div>

            <div id="availableCompaniesList" style="max-height: 500px; overflow-y: auto;">
              ${availableOrgs.length === 0 ? `
                <div class="alert alert-warning">
                  All companies have been assigned to this award.
                </div>
              ` : `
                ${availableOrgs.map(org => this.renderAvailableCompany(org)).join('')}
              `}
            </div>
          </div>
        </div>
      `;

      // Store available orgs for filtering
      this.availableOrgs = availableOrgs;

    } catch (error) {
      console.error('Error refreshing assignments:', error);
      contentEl.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>
          Failed to load assignments: ${error.message}
        </div>
      `;
    }
  },

  /**
   * Render assigned company card
   */
  renderAssignedCompany(assignment) {
    const org = assignment.organisations;
    const statusBadge = this.getStatusBadge(assignment.status);
    
    return `
      <div class="card mb-2 assignment-card">
        <div class="card-body p-3">
          <div class="d-flex justify-content-between align-items-start">
            <div class="flex-grow-1">
              <div class="d-flex align-items-center mb-2">
                ${org.logo_url ? 
                  `<img src="${org.logo_url}" alt="${utils.escapeHtml(org.company_name)}" 
                    style="width: 40px; height: 40px; object-fit: contain; margin-right: 12px;">` : 
                  `<div class="company-initial-avatar me-2">${org.company_name.charAt(0)}</div>`
                }
                <div>
                  <h6 class="mb-0">${utils.escapeHtml(org.company_name)}</h6>
                  <small class="text-muted">${utils.escapeHtml(org.email || 'No email')}</small>
                </div>
              </div>
              
              <div class="d-flex gap-2 align-items-center mb-2 flex-wrap">
                ${statusBadge}
                ${assignment.judge_score ?
                  `<span class="badge bg-info-subtle text-info">
                    <i class="bi bi-star-fill me-1"></i>${assignment.judge_score}/10
                  </span>` : ''}
                ${this.getNominationBadges(assignment)}
              </div>

              ${assignment.nomination_date ?
                `<small class="text-muted d-block mb-2">
                  <i class="bi bi-calendar-event me-1"></i>Nominated: ${new Date(assignment.nomination_date).toLocaleDateString()}
                </small>` : ''}
              
              <div class="btn-group btn-group-sm" role="group">
                <button class="btn btn-outline-primary" 
                  onclick="assignmentsModule.changeStatus('${assignment.id}', 'shortlisted')"
                  title="Mark as Shortlisted">
                  <i class="bi bi-star"></i> Shortlist
                </button>
                <button class="btn btn-outline-success" 
                  onclick="assignmentsModule.changeStatus('${assignment.id}', 'winner')"
                  title="Mark as Winner">
                  <i class="bi bi-trophy"></i> Winner
                </button>
                <button class="btn btn-outline-danger" 
                  onclick="assignmentsModule.removeAssignment('${assignment.id}')"
                  title="Remove">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Render available company card
   */
  renderAvailableCompany(org) {
    return `
      <div class="card mb-2 available-company-card" data-company-name="${utils.escapeHtml(org.company_name).toLowerCase()}">
        <div class="card-body p-3">
          <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center flex-grow-1">
              ${org.logo_url ? 
                `<img src="${org.logo_url}" alt="${utils.escapeHtml(org.company_name)}" 
                  style="width: 32px; height: 32px; object-fit: contain; margin-right: 10px;">` : 
                `<div class="company-initial-avatar-sm me-2">${org.company_name.charAt(0)}</div>`
              }
              <div>
                <div class="fw-semibold">${utils.escapeHtml(org.company_name)}</div>
                <small class="text-muted">${utils.escapeHtml(org.email || 'No email')}</small>
              </div>
            </div>
            <button 
              class="btn btn-sm btn-primary" 
              onclick="assignmentsModule.assignCompany('${org.id}', '${utils.escapeHtml(org.company_name).replace(/'/g, "\\'")}')">
              <i class="bi bi-plus-lg"></i> Add
            </button>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Filter available companies
   */
  filterAvailableCompanies() {
    const search = document.getElementById('assignmentSearchBox').value.toLowerCase();
    const cards = document.querySelectorAll('.available-company-card');

    cards.forEach(card => {
      const companyName = card.getAttribute('data-company-name');
      if (companyName.includes(search)) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  },

  /**
   * Filter assigned companies by nomination type
   */
  filterAssignments(filterType) {
    this.currentFilter = filterType;

    // Update button states
    document.querySelectorAll('[id^="filter-"]').forEach(btn => {
      btn.classList.remove('active');
    });
    document.getElementById(`filter-${filterType}`).classList.add('active');

    // Filter assignments
    let filtered = this.allAssignments;

    switch(filterType) {
      case 'self_nomination':
        filtered = this.allAssignments.filter(a => a.nomination_source === 'self_nomination');
        break;
      case 'previous_winner':
        filtered = this.allAssignments.filter(a => a.is_previous_winner === true);
        break;
      case 'new':
        filtered = this.allAssignments.filter(a => !a.is_previous_winner);
        break;
      case 'all':
      default:
        filtered = this.allAssignments;
        break;
    }

    // Update display
    const listContainer = document.getElementById('assignedCompaniesList');
    const countEl = document.getElementById('assignedCount');

    if (listContainer && countEl) {
      listContainer.innerHTML = filtered.map(a => this.renderAssignedCompany(a)).join('');
      countEl.textContent = filtered.length;
    }
  },

  /**
   * Assign company to award
   */
  async assignCompany(orgId, companyName) {
    try {
      utils.showLoading();

      // Check if this assignment already exists (prevent duplicates)
      const { data: existingAssignment, error: checkError } = await STATE.client
        .from('award_assignments')
        .select('id')
        .eq('award_id', this.currentAwardId)
        .eq('organisation_id', orgId)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking for existing assignment:', checkError);
        throw checkError;
      }

      if (existingAssignment) {
        utils.showToast(`${companyName} is already assigned to this award!`, 'warning');
        return;
      }

      const { error } = await STATE.client
        .from('award_assignments')
        .insert([{
          award_id: this.currentAwardId,
          organisation_id: orgId,
          status: 'nominated',
          assigned_by: STATE.currentUser?.email
        }]);

      if (error) throw error;

      utils.showToast(`${companyName} assigned successfully!`, 'success');
      await this.refreshAssignments();

      // Refresh awards list to update counts
      if (typeof awardsModule !== 'undefined' && awardsModule.loadAwards) {
        await awardsModule.loadAwards();
      }

    } catch (error) {
      console.error('Error assigning company:', error);
      utils.showToast('Failed to assign company: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Remove assignment
   */
  async removeAssignment(assignmentId) {
    if (!confirm('Remove this company from the award?')) {
      return;
    }
    
    try {
      utils.showLoading();
      
      const { error } = await STATE.client
        .from('award_assignments')
        .delete()
        .eq('id', assignmentId);
      
      if (error) throw error;
      
      utils.showToast('Company removed from award', 'success');
      await this.refreshAssignments();
      
      // Refresh awards list
      if (typeof awardsModule !== 'undefined' && awardsModule.loadAwards) {
        await awardsModule.loadAwards();
      }
      
    } catch (error) {
      console.error('Error removing assignment:', error);
      utils.showToast('Failed to remove assignment: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Change assignment status
   */
  async changeStatus(assignmentId, newStatus) {
    try {
      utils.showLoading();
      
      const updates = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      
      // If marking as winner, add announcement date
      if (newStatus === 'winner') {
        updates.announcement_date = new Date().toISOString().split('T')[0];
      }
      
      const { error } = await STATE.client
        .from('award_assignments')
        .update(updates)
        .eq('id', assignmentId);
      
      if (error) throw error;
      
      const statusLabels = {
        'nominated': 'Nominated',
        'shortlisted': 'Shortlisted',
        'winner': 'Winner',
        'rejected': 'Rejected'
      };
      
      utils.showToast(`Status changed to ${statusLabels[newStatus]}`, 'success');
      await this.refreshAssignments();
      
    } catch (error) {
      console.error('Error changing status:', error);
      utils.showToast('Failed to change status: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Get status badge HTML
   */
  getStatusBadge(status) {
    const badges = {
      'nominated': '<span class="badge bg-secondary"><i class="bi bi-file-text me-1"></i>Nominated</span>',
      'shortlisted': '<span class="badge bg-warning text-dark"><i class="bi bi-star me-1"></i>Shortlisted</span>',
      'winner': '<span class="badge bg-success"><i class="bi bi-trophy-fill me-1"></i>Winner</span>',
      'rejected': '<span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>Rejected</span>'
    };

    return badges[status] || badges['nominated'];
  },

  /**
   * Get nomination source badges
   */
  getNominationBadges(assignment) {
    let badges = '';

    // Previous winner badge
    if (assignment.is_previous_winner) {
      badges += '<span class="badge bg-warning text-dark"><i class="bi bi-trophy me-1"></i>Previous Winner</span>';
    }

    // Nomination source badges
    const sourceBadges = {
      'self_nomination': '<span class="badge bg-info"><i class="bi bi-hand-index me-1"></i>Self Nominated</span>',
      'previous_winner': '<span class="badge bg-warning text-dark"><i class="bi bi-trophy me-1"></i>Previous Winner</span>',
      'admin_manual': '<span class="badge bg-primary"><i class="bi bi-person-gear me-1"></i>Admin</span>',
      'csv_import': '<span class="badge bg-secondary"><i class="bi bi-file-earmark-arrow-up me-1"></i>CSV Import</span>'
    };

    if (assignment.nomination_source && assignment.nomination_source !== 'csv_import') {
      badges += (badges ? ' ' : '') + (sourceBadges[assignment.nomination_source] || '');
    }

    return badges;
  },

  /**
   * Email all assigned companies (placeholder for Feature 3)
   */
  emailAllAssigned() {
    utils.showToast('Email feature will be available in Feature 3: Email Campaign Manager', 'info');
  },

  /**
   * Bulk assign companies
   */
  async bulkAssignCompanies(awardId, orgIds) {
    try {
      utils.showLoading();
      
      const assignments = orgIds.map(orgId => ({
        award_id: awardId,
        organisation_id: orgId,
        status: 'nominated',
        assigned_by: STATE.currentUser?.email
      }));
      
      const { error } = await STATE.client
        .from('award_assignments')
        .insert(assignments);
      
      if (error) throw error;
      
      utils.showToast(`${orgIds.length} companies assigned successfully!`, 'success');
      
    } catch (error) {
      console.error('Error bulk assigning:', error);
      utils.showToast('Failed to bulk assign: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  }
};

// Export to window
window.assignmentsModule = assignmentsModule;
