/* ==================================================== */
/* AWARD ASSIGNMENTS MODULE - FIXED VERSION */
/* Works with basic organisations table structure */
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

      // Get other nominations for each company
      const orgIds = data.map(a => a.organisation_id).filter(Boolean);
      if (orgIds.length > 0) {
        const { data: otherAssignments } = await STATE.client
          .from('award_assignments')
          .select(`
            organisation_id,
            award_id,
            awards!award_assignments_award_id_fkey (award_name, year)
          `)
          .in('organisation_id', orgIds)
          .neq('award_id', awardId);

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

      // Initialize Bootstrap tooltips for multi-category badges
      setTimeout(() => {
        const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
      }, 100);

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
      const otherAwardsList = otherNominations.map(award => utils.escapeHtml(award.award_name)).join(', ');
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
            <button class="btn btn-outline-success btn-sm"
              onclick="assignmentsModule.changeStatus('${assignment.id}', 'winner')"
              title="Mark as Winner">
              <i class="bi bi-trophy"></i>
            </button>
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
   * Get multi-category nomination badge
   */
  getMultiCategoryBadge(assignment) {
    const otherNominations = assignment.other_nominations || [];

    if (otherNominations.length === 0) {
      return '';
    }

    const count = otherNominations.length;
    const otherAwardsList = otherNominations
      .map(award => utils.escapeHtml(award.award_name))
      .join('&#10;'); // Line break for tooltip

    return `
      <div class="mb-2">
        <span class="badge bg-purple-subtle text-purple"
          title="${otherAwardsList}"
          data-bs-toggle="tooltip"
          data-bs-html="true"
          style="background-color: #e7d5ff; color: #7c3aed; cursor: help;">
          <i class="bi bi-clipboard2-check me-1"></i>Also in ${count} other ${count === 1 ? 'category' : 'categories'}
        </span>
      </div>
    `;
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
   * Get vote count display with voting link
   */
  getVoteCount(assignment) {
    const voteCount = assignment.public_vote_count || 0;
    const votingSlug = assignment.voting_slug || '';

    if (!votingSlug) {
      return `
        <div class="d-flex align-items-center mb-2">
          <span class="badge bg-light text-dark">
            <i class="bi bi-hand-thumbs-up me-1"></i>${voteCount.toLocaleString()} ${voteCount === 1 ? 'vote' : 'votes'}
          </span>
        </div>
      `;
    }

    const voteUrl = `${window.location.origin}/vote/${votingSlug}`;

    return `
      <div class="d-flex align-items-center gap-2 mb-2">
        <span class="badge bg-light text-dark">
          <i class="bi bi-hand-thumbs-up me-1"></i>${voteCount.toLocaleString()} ${voteCount === 1 ? 'vote' : 'votes'}
        </span>
        <button class="btn btn-sm btn-outline-primary"
          onclick="navigator.clipboard.writeText('${voteUrl}'); utils.showToast('Vote link copied!', 'success')"
          title="Copy voting link">
          <i class="bi bi-link-45deg"></i> Copy Vote Link
        </button>
      </div>
    `;
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
