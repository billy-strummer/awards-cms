/* ==================================================== */
/* AWARD ASSIGNMENTS MODULE */
/* ==================================================== */

const assignmentsModule = {
  currentAwardId: null,
  currentAwardName: null,
  currentSortColumn: 'company',
  currentSortDirection: 'asc',

  /**
   * Get all assignments for a specific award
   */
  async getAwardAssignments(awardId) {
    try {
      const data = await apiClient.selectAll('award_assignments', {
        select: '*, organisations!award_assignments_organisation_id_fkey (*)',
        filters: { award_id: awardId }
      });

      // Get other nominations for each company
      const orgIds = data.map(a => a.organisation_id).filter(Boolean);
      if (orgIds.length > 0) {
        const otherAssignments = await apiClient.selectAll('award_assignments', {
          select: 'organisation_id, award_id, awards:award_years!award_assignments_award_id_fkey (award_name, year)',
          filters: {
            organisation_id: { op: 'in', value: orgIds },
            award_id: { op: 'neq', value: awardId }
          }
        });

        // Add other nominations info to each assignment
        data.forEach(assignment => {
          const otherNominations = (otherAssignments || [])
            .filter(other => other.organisation_id === assignment.organisation_id)
            .map(other => other.awards);
          assignment.other_nominations = otherNominations;
        });
      }

      // Sort alphabetically by company name
      const sortedData = (data || []).sort((a, b) => {
        const nameA = a.organisations?.company_name?.toLowerCase() || '';
        const nameB = b.organisations?.company_name?.toLowerCase() || '';
        return nameA.localeCompare(nameB);
      });

      return sortedData;
    } catch (error) {
      console.error('Error loading assignments:', error);
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

    // Ensure proper z-index for stacked modals
    setTimeout(() => {
      const modalElement = document.getElementById('assignmentsModal');
      const backdrops = document.querySelectorAll('.modal-backdrop');
      if (backdrops.length > 1) {
        // Multiple modals open - ensure this one is on top
        modalElement.style.zIndex = '1061';
        backdrops[backdrops.length - 1].style.zIndex = '1060';
      }
    }, 100);

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
      this._cachedAssignments = assignments; // Cache for email feature

      // Filter out assignments with missing organisations (deleted companies)
      const validAssignments = assignments.filter(a => {
        if (!a.organisations || !a.organisations.id) {
          console.warn('Found assignment with missing organisation:', a);
          return false;
        }
        return true;
      });

      if (validAssignments.length < assignments.length) {
        console.warn('Filtered out', assignments.length - validAssignments.length, 'assignments with missing organisations');
      }

      // Load available organisations (only essential columns)
      const allOrgs = await apiClient.selectAll('organisations', {
        select: 'id, company_name, email, logo_url',
        sort: { column: 'company_name', ascending: true }
      });

      // Filter out already assigned organisations
      const assignedOrgIds = validAssignments.map(a => a.organisations.id);
      const availableOrgs = (allOrgs || []).filter(org => !assignedOrgIds.includes(org.id));

      // validAssignments.length assigned, availableOrgs.length available

      // Store all assignments for filtering
      this.allAssignments = validAssignments;
      this.currentFilter = 'all';
      this.currentSortColumn = 'company';
      this.currentSortDirection = 'asc';

      // Render UI
      contentEl.innerHTML = `
        <div class="row">
          <div class="col-12">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h5 class="mb-0">
                <i class="bi bi-people-fill me-2 text-success"></i>
                Assigned Companies (<span id="assignedCount">${validAssignments.length}</span>)
              </h5>
            </div>

            ${validAssignments.length === 0 ? `
              <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>
                No companies assigned yet. Add companies from the section below.
              </div>
            ` : `
              <div class="btn-group btn-group-sm mb-3 d-flex" role="group">
                <button type="button" class="btn btn-outline-secondary active" id="filter-all" onclick="assignmentsModule.filterAssignments('all')">
                  All
                </button>
                <button type="button" class="btn btn-outline-info" id="filter-self_nomination" onclick="assignmentsModule.filterAssignments('self_nomination')">
                  <i class="bi bi-hand-index me-1"></i>Self Nominated
                </button>
                <button type="button" class="btn btn-outline-warning" id="filter-previous_winner" onclick="assignmentsModule.filterAssignments('previous_winner')">
                  <i class="bi bi-trophy me-1"></i>Previous Winners
                </button>
                <button type="button" class="btn btn-outline-primary" id="filter-new" onclick="assignmentsModule.filterAssignments('new')">
                  <i class="bi bi-star me-1"></i>New Nominees
                </button>
              </div>

              <table class="table table-sm table-hover align-middle" style="font-size: 0.875rem;">
                <thead class="table-light">
                  <tr>
                    <th style="cursor: pointer;" onclick="assignmentsModule.sortAssignments('company')">
                      Company <i class="bi bi-arrow-down-up ms-1"></i>
                    </th>
                    <th>Badges</th>
                    <th style="cursor: pointer;" onclick="assignmentsModule.sortAssignments('votes')">
                      Votes <i class="bi bi-arrow-down-up ms-1"></i>
                    </th>
                    <th>Contact</th>
                    <th class="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody id="assignedCompaniesList">
                  ${validAssignments.map(a => this.renderAssignedCompany(a)).join('')}
                </tbody>
              </table>
            `}
          </div>

          <div class="col-12 mt-4">
            <hr class="mb-4">
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

            <div id="availableCompaniesList" style="max-height: 300px; overflow-y: auto;">
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

      // Dispose old tooltips before creating new ones to prevent memory leak
      setTimeout(() => {
        const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        [...tooltipTriggerList].forEach(el => {
          const existing = bootstrap.Tooltip.getInstance(el);
          if (existing) existing.dispose();
        });
        [...tooltipTriggerList].map(el => new bootstrap.Tooltip(el));
      }, 100);

    } catch (error) {
      console.error('Error refreshing assignments:', error);
      contentEl.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>
          Failed to load assignments: ${utils.escapeHtml(error.message)}
        </div>
      `;
    }
  },

  /**
   * Render assigned company as table row
   */
  renderAssignedCompany(assignment) {
    const org = assignment.organisations;
    const voteCount = assignment.public_vote_count || 0;

    // Collect all badges
    const badges = [];

    // Winner position badge (gold/silver/bronze)
    const positionBadge = this.getWinnerPositionBadge(assignment);
    if (positionBadge) badges.push(positionBadge);

    // Status badge
    badges.push(this.getStatusBadge(assignment.status));

    // Nomination type badges
    if (assignment.is_previous_winner) {
      badges.push('<span class="badge bg-warning text-dark" title="Previous Winner"><i class="bi bi-trophy"></i></span>');
    }
    if (assignment.nomination_source === 'self_nomination') {
      badges.push('<span class="badge bg-info" title="Self Nominated"><i class="bi bi-hand-index"></i></span>');
    }

    // Multi-category badge
    const otherNominations = assignment.other_nominations || [];
    if (otherNominations.length > 0) {
      const otherAwardsList = otherNominations.map(award => utils.escapeHtml(utils.formatAwardName(award))).join(', ');
      badges.push(`<span class="badge" style="background-color: #e7d5ff; color: #7c3aed;" title="Also in: ${otherAwardsList}" data-bs-toggle="tooltip"><i class="bi bi-clipboard2-check"></i> +${otherNominations.length}</span>`);
    }

    // Contact info
    const contactParts = [];
    if (org.email) contactParts.push(`<a href="mailto:${utils.escapeHtml(org.email)}" class="text-decoration-none">${utils.escapeHtml(org.email)}</a>`);
    if (org.contact_phone) contactParts.push(`<a href="tel:${utils.escapeHtml(org.contact_phone)}" class="text-decoration-none"><i class="bi bi-telephone"></i></a>`);
    const contactInfo = contactParts.length > 0 ? contactParts.join(' ') : '<span class="text-muted">No contact</span>';

    return `
      <tr>
        <td>
          <div class="d-flex align-items-center">
            ${org.logo_url ?
              `<img src="${org.logo_url}" alt="${utils.escapeHtml(org.company_name)}"
                style="width: 24px; height: 24px; object-fit: contain; margin-right: 8px;">` :
              `<div style="width: 24px; height: 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; border-radius: 4px; display: flex; align-items: center; justify-content: center;
                font-weight: 600; font-size: 0.75rem; margin-right: 8px;">${org.company_name.charAt(0)}</div>`
            }
            <a href="javascript:void(0);"
               class="text-decoration-none fw-semibold text-primary"
               onclick="orgsModule.openCompanyProfile('${org.id}', '${utils.escapeHtml(org.company_name).replace(/'/g, "\\'")}')"
               title="View company profile">
              ${utils.escapeHtml(org.company_name)}
            </a>
          </div>
        </td>
        <td>
          <div class="d-flex gap-1 flex-wrap">
            ${badges.join('')}
          </div>
        </td>
        <td>
          <span class="badge bg-light text-dark">
            <i class="bi bi-hand-thumbs-up me-1"></i>${voteCount.toLocaleString()}
          </span>
        </td>
        <td style="font-size: 0.8rem;">
          ${contactInfo}
        </td>
        <td>
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-primary btn-sm"
              onclick="assignmentsModule.changeStatus('${assignment.id}', 'shortlisted')"
              title="Mark as Shortlisted">
              <i class="bi bi-star"></i>
            </button>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-success btn-sm dropdown-toggle"
                data-bs-toggle="dropdown" title="Set Winner Position">
                <i class="bi bi-trophy"></i>
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li><a class="dropdown-item" href="javascript:void(0);" onclick="assignmentsModule.setWinnerPosition('${assignment.id}', 1)"><i class="bi bi-star-fill me-2" style="color: #ffd700;"></i>1st Place (Gold)</a></li>
                <li><a class="dropdown-item" href="javascript:void(0);" onclick="assignmentsModule.setWinnerPosition('${assignment.id}', 2)"><i class="bi bi-star-fill me-2" style="color: #c0c0c0;"></i>2nd Place (Silver)</a></li>
                <li><a class="dropdown-item" href="javascript:void(0);" onclick="assignmentsModule.setWinnerPosition('${assignment.id}', 3)"><i class="bi bi-star-fill me-2" style="color: #cd7f32;"></i>3rd Place (Bronze)</a></li>
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item" href="javascript:void(0);" onclick="assignmentsModule.changeStatus('${assignment.id}', 'winner')"><i class="bi bi-trophy me-2 text-success"></i>Winner (no position)</a></li>
              </ul>
            </div>
            <button class="btn btn-outline-secondary btn-sm"
              onclick="orgsModule.openCompanyProfile('${org.id}', '${utils.escapeHtml(org.company_name).replace(/'/g, "\\'")}')"
              title="View Profile">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-outline-danger btn-sm"
              onclick="assignmentsModule.removeAssignment('${assignment.id}')"
              title="Remove">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
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
      const companyName = (card.getAttribute('data-company-name') || '').toLowerCase();
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
    const activeBtn = document.getElementById(`filter-${filterType}`);
    if (activeBtn) activeBtn.classList.add('active');

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
   * Sort assignments by column
   */
  sortAssignments(column) {
    // Toggle direction if clicking same column
    if (this.currentSortColumn === column) {
      this.currentSortDirection = this.currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.currentSortColumn = column;
      this.currentSortDirection = 'asc';
    }
    utils.saveSortState('assignments', this.currentSortColumn, this.currentSortDirection);

    // Get currently displayed assignments (respects filters)
    const listContainer = document.getElementById('assignedCompaniesList');
    if (!listContainer) return;

    // Re-filter to get current filtered set
    let filtered = this.allAssignments;

    switch(this.currentFilter) {
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

    // Sort the filtered assignments
    filtered.sort((a, b) => {
      let aVal, bVal;

      switch(column) {
        case 'company':
          aVal = (a.organisations?.company_name || '').toLowerCase();
          bVal = (b.organisations?.company_name || '').toLowerCase();
          break;
        case 'votes':
          aVal = a.public_vote_count || 0;
          bVal = b.public_vote_count || 0;
          break;
        case 'position':
          aVal = a.winner_position || 999;
          bVal = b.winner_position || 999;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return this.currentSortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.currentSortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    // Re-render
    listContainer.innerHTML = filtered.map(a => this.renderAssignedCompany(a)).join('');
  },

  /**
   * Assign company to award
   */
  async assignCompany(orgId, companyName) {
    try {
      utils.showLoading();

      // Check if this assignment already exists (prevent duplicates)
      const { data: existingCheck } = await apiClient.select('award_assignments', {
        select: 'id',
        filters: { award_id: this.currentAwardId, organisation_id: orgId },
        pageSize: 1
      });
      const existingAssignment = existingCheck?.[0] || null;

      if (existingAssignment) {
        utils.showToast(`${companyName} is already assigned to this award!`, 'warning');
        return;
      }

      await apiClient.insert('award_assignments', {
        award_id: this.currentAwardId,
        organisation_id: orgId,
        status: 'nominated',
        assigned_by: STATE.currentUser?.email
      });

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
    // Find the assignment to show context in confirmation
    const assignment = (this.currentAssignments || []).find(a => a.id === assignmentId);
    const companyName = assignment?.organisations?.company_name || assignment?.company_name || 'this company';
    if (!await utils.confirmDialog({ title: 'Remove Assignment', message: `Remove <strong>${utils.escapeHtml(companyName)}</strong> from the award?`, confirmText: 'Remove', danger: true })) {
      return;
    }
    
    try {
      utils.showLoading();
      
      await apiClient.delete('award_assignments', assignmentId);

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

      // If marking as winner, add announcement date AND set actual_winner flag
      // This actual_winner flag is used for year-over-year carry-over of previous winners
      if (newStatus === 'winner') {
        updates.announcement_date = new Date().toISOString().split('T')[0];
        updates.actual_winner = true;
      }

      // If unmarking as winner, remove actual_winner flag
      if (newStatus !== 'winner') {
        updates.actual_winner = false;
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

      // Audit trail for status changes
      const assignment = this._cachedAssignments?.find(a => a.id === assignmentId);
      const companyName = assignment?.organisations?.company_name || '';
      if (typeof awardsModule !== 'undefined' && awardsModule._logAwardAudit) {
        awardsModule._logAwardAudit(this.currentAwardId, newStatus === 'winner' ? 'winner_set' : 'status_change',
          this.currentAwardName || '', `${companyName} → ${statusLabels[newStatus]}`);
      }

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
   * Get winner position badge (Top 3)
   */
  getWinnerPositionBadge(assignment) {
    if (!assignment.winner_position) {
      return '';
    }

    const positions = {
      1: '<span class="badge" style="background-color: #ffd700; color: #000;"><i class="bi bi-star-fill me-1"></i>#1 Recommended</span>',
      2: '<span class="badge" style="background-color: #c0c0c0; color: #000;"><i class="bi bi-star-fill me-1"></i>#2 Recommended</span>',
      3: '<span class="badge" style="background-color: #cd7f32; color: #fff;"><i class="bi bi-star-fill me-1"></i>#3 Recommended</span>'
    };

    return positions[assignment.winner_position] || '';
  },

  /**
   * Set winner position (1st, 2nd, 3rd)
   */
  async setWinnerPosition(assignmentId, position) {
    try {
      utils.showLoading();

      const positionLabels = { 1: '1st Place (Gold)', 2: '2nd Place (Silver)', 3: '3rd Place (Bronze)' };

      const { error } = await STATE.client
        .from('award_assignments')
        .update({
          status: 'winner',
          winner_position: position,
          actual_winner: true,
          announcement_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString()
        })
        .eq('id', assignmentId);

      if (error) throw error;

      utils.showToast(`Set as ${positionLabels[position]}!`, 'success');
      await this.refreshAssignments();

    } catch (error) {
      console.error('Error setting winner position:', error);
      utils.showToast('Failed to set winner position: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Email all assigned companies for current award
   */
  emailAllAssigned() {
    if (!this.currentAwardId) { utils.showToast('No award selected', 'warning'); return; }

    const assignments = this._cachedAssignments || [];
    if (assignments.length === 0) { utils.showToast('No nominees to email', 'warning'); return; }

    // Collect all email addresses from assigned organisations
    const emails = assignments
      .map(a => a.organisations?.email)
      .filter(Boolean);

    if (emails.length === 0) {
      utils.showToast('No email addresses found for nominees', 'warning');
      return;
    }

    const uniqueEmails = [...new Set(emails)];
    const awardName = this.currentAwardName || 'Award';

    // Show options modal
    const html = `
      <div class="mb-3">
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          <strong>${uniqueEmails.length}</strong> email addresses found from <strong>${assignments.length}</strong> nominees for "${utils.escapeHtml(awardName)}"
        </div>
      </div>
      <div class="mb-3">
        <h6 class="fw-semibold">Filter by status:</h6>
        <div class="btn-group btn-group-sm mb-2">
          <button class="btn btn-outline-secondary active" onclick="assignmentsModule._filterEmailList('all', this)">All (${assignments.length})</button>
          <button class="btn btn-outline-warning" onclick="assignmentsModule._filterEmailList('shortlisted', this)">Shortlisted (${assignments.filter(a => a.status === 'shortlisted').length})</button>
          <button class="btn btn-outline-success" onclick="assignmentsModule._filterEmailList('winner', this)">Winners (${assignments.filter(a => a.status === 'winner').length})</button>
          <button class="btn btn-outline-primary" onclick="assignmentsModule._filterEmailList('nominated', this)">Nominated (${assignments.filter(a => a.status === 'nominated').length})</button>
        </div>
      </div>
      <div id="emailListPreview">
        <textarea class="form-control form-control-sm" rows="4" id="nomineeEmailList" readonly>${uniqueEmails.join('; ')}</textarea>
      </div>
      <div class="mt-3 d-flex gap-2">
        <button class="btn btn-primary btn-sm" onclick="navigator.clipboard.writeText(document.getElementById('nomineeEmailList').value); utils.showToast('Emails copied to clipboard!', 'success');">
          <i class="bi bi-clipboard me-1"></i>Copy All Emails
        </button>
        <button class="btn btn-success btn-sm" onclick="window.open('mailto:?bcc=' + encodeURIComponent(document.getElementById('nomineeEmailList').value.replace(/;\\s*/g, ',')))">
          <i class="bi bi-envelope me-1"></i>Open Email Client (BCC)
        </button>
      </div>
    `;

    // Use dynamic modal
    document.getElementById('dynamicAssignModal')?.remove();
    const modalHtml = `<div class="modal fade" id="dynamicAssignModal" tabindex="-1">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title"><i class="bi bi-envelope me-2"></i>Email Nominees</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">${html}</div>
        <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Close</button></div>
      </div></div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    new bootstrap.Modal(document.getElementById('dynamicAssignModal')).show();
  },

  _cachedAssignments: [],

  _filterEmailList(status, btn) {
    // Update button states
    btn.closest('.btn-group').querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const assignments = this._cachedAssignments || [];
    const filtered = status === 'all' ? assignments : assignments.filter(a => a.status === status);
    const emails = [...new Set(filtered.map(a => a.organisations?.email).filter(Boolean))];
    const textarea = document.getElementById('nomineeEmailList');
    if (textarea) textarea.value = emails.join('; ');
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
  },

  /**
   * Filter the bulk add company list by search input
   */
  filterBulkAdd() {
    const searchVal = (document.getElementById('bulkAddSearchBox')?.value || '').toLowerCase();
    const listEl = document.getElementById('bulkAddCompanyList');
    if (!listEl) return;

    const items = listEl.querySelectorAll('.bulk-add-item');
    items.forEach(item => {
      const name = (item.dataset.name || '').toLowerCase();
      item.style.display = name.includes(searchVal) ? '' : 'none';
    });
  },

  /**
   * Add all selected companies from the bulk add modal
   */
  async addSelectedCompanies() {
    const checkboxes = document.querySelectorAll('.bulk-add-check:checked');
    if (checkboxes.length === 0) {
      utils.showToast('No companies selected', 'warning');
      return;
    }

    const orgIds = [...checkboxes].map(cb => cb.value);

    try {
      utils.showLoading();

      await this.bulkAssignCompanies(this.currentAwardId, orgIds);

      // Close the add modal
      const addModal = document.getElementById('addCompanyModal');
      if (addModal) {
        const bsModal = bootstrap.Modal.getInstance(addModal);
        if (bsModal) bsModal.hide();
      }

      // Refresh assignments list
      await this.refreshAssignments();
    } catch (error) {
      console.error('Error adding selected companies:', error);
      utils.showToast('Error adding companies: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Update the selected count display
   */
  updateSelectedCount() {
    const count = document.querySelectorAll('.bulk-add-check:checked').length;
    const el = document.getElementById('assignSelectedCount');
    if (el) el.textContent = count;
  }
};

// Export to window
ModuleRegistry.register('assignmentsModule', assignmentsModule);
