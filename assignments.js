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
      const { data, error } = await STATE.client
        .from('award_assignments')
        .select(`
          *,
          organisations!award_assignments_organisation_id_fkey (
            id,
            company_name,
            email,
            logo_url
          )
        `)
        .eq('award_id', awardId)
        .order('assigned_date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading assignments:', error);
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
      
      // Load available organisations (only essential columns)
      const { data: allOrgs, error: orgsError } = await STATE.client
        .from('organisations')
        .select('id, company_name, email, logo_url')
        .order('company_name', { ascending: true });
      
      if (orgsError) throw orgsError;
      
      // Filter out already assigned organisations
      const assignedOrgIds = assignments.map(a => a.organisations.id);
      const availableOrgs = (allOrgs || []).filter(org => !assignedOrgIds.includes(org.id));
      
      // Render UI
      contentEl.innerHTML = `
        <div class="row">
          <div class="col-md-6">
            <h5 class="mb-3">
              <i class="bi bi-people-fill me-2 text-success"></i>
              Assigned Companies (${assignments.length})
            </h5>
            
            ${assignments.length === 0 ? `
              <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>
                No companies assigned yet. Select companies from the right panel to add them.
              </div>
            ` : `
              <div class="assigned-companies-list">
                ${assignments.map(a => this.renderAssignedCompany(a)).join('')}
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
              
              <div class="d-flex gap-2 align-items-center mb-2">
                ${statusBadge}
                ${assignment.judge_score ? 
                  `<span class="badge bg-info-subtle text-info">
                    <i class="bi bi-star-fill me-1"></i>${assignment.judge_score}/10
                  </span>` : ''}
              </div>
              
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
   * Assign company to award
   */
  async assignCompany(orgId, companyName) {
    try {
      utils.showLoading();
      
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
