/* ==================================================== */
/* AWARD ASSIGNMENTS MODULE */
/* ==================================================== */

const assignmentsModule = {
  /** @type {string|null} Currently selected award ID */
  currentAwardId: null,
  /** @type {string|null} Currently selected award name */
  currentAwardName: null,
  /** @type {string} Current sort column */
  currentSortColumn: 'company',
  /** @type {string} Current sort direction */
  currentSortDirection: 'asc',

  /**
   * Get all assignments for a specific award, enriched with other nomination data.
   * @param {string} awardId - The award record ID
   * @returns {Promise<Array>} Sorted array of assignment records
   */
  async getAwardAssignments(awardId) {
    try {
      /* selectAll: justified — scoped to single award */
      const data = await apiClient.selectAll('award_assignments', {
        select: '*, organisations!award_assignments_organisation_id_fkey (*)',
        filters: { award_id: awardId },
      });

      // Get other nominations for each company
      const orgIds = data.map((a) => a.organisation_id).filter(Boolean);
      if (orgIds.length > 0) {
        /* selectAll: justified — filtered to known org IDs from single award */
        const otherAssignments = await apiClient.selectAll('award_assignments', {
          select: 'organisation_id, award_id, awards:award_years!award_assignments_award_id_fkey (award_name, year)',
          filters: {
            organisation_id: { op: 'in', value: orgIds },
            award_id: { op: 'neq', value: awardId },
          },
        });

        // Add other nominations info to each assignment
        data.forEach((assignment) => {
          const otherNominations = (otherAssignments || [])
            .filter((other) => other.organisation_id === assignment.organisation_id)
            .map((other) => other.awards);
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
   * Open the assignments modal for a specific award.
   * @param {string} awardId - The award record ID
   * @param {string} awardName - Display name of the award
   * @returns {Promise<void>}
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
   * Refresh the assignments display within the currently open modal.
   * @returns {Promise<void>}
   */
  async refreshAssignments() {
    const contentEl = document.getElementById('assignmentsContent');

    try {
      // Load current assignments
      const assignments = await this.getAwardAssignments(this.currentAwardId);
      this._cachedAssignments = assignments; // Cache for email feature

      // Filter out assignments with missing organisations (deleted companies)
      const validAssignments = assignments.filter((a) => {
        if (!a.organisations || !a.organisations.id) {
          console.warn('Found assignment with missing organisation:', a);
          return false;
        }
        return true;
      });

      if (validAssignments.length < assignments.length) {
        console.warn(
          'Filtered out',
          assignments.length - validAssignments.length,
          'assignments with missing organisations'
        );
      }

      /* selectAll: justified — populating assignment picker; organisations is a bounded business dataset */
      const allOrgs = await apiClient.selectAll('organisations', {
        select: 'id, company_name, email, logo_url',
        sort: { column: 'company_name', ascending: true },
      });

      // Filter out already assigned organisations
      const assignedOrgIds = validAssignments.map((a) => a.organisations.id);
      const availableOrgs = (allOrgs || []).filter((org) => !assignedOrgIds.includes(org.id));

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
              <button class="btn btn-sm btn-outline-primary" data-action="assignmentsModule.openBatchEmailModal" title="Send decision emails to all shortlisted, winners and rejected nominees">
                <i class="bi bi-envelope-check me-1"></i>Send Decision Emails
              </button>
            </div>

            ${
              validAssignments.length === 0
                ? `
              <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>
                No companies assigned yet. Add companies from the section below.
              </div>
            `
                : `
              <div class="btn-group btn-group-sm mb-3 d-flex" role="group">
                <button type="button" class="btn btn-outline-secondary active" id="filter-all" data-action="assignmentsModule.filterAssignments" data-id="all">
                  All
                </button>
                <button type="button" class="btn btn-outline-info" id="filter-self_nomination" data-action="assignmentsModule.filterAssignments" data-id="self_nomination">
                  <i class="bi bi-hand-index me-1"></i>Self Nominated
                </button>
                <button type="button" class="btn btn-outline-warning" id="filter-previous_winner" data-action="assignmentsModule.filterAssignments" data-id="previous_winner">
                  <i class="bi bi-trophy me-1"></i>Previous Winners
                </button>
                <button type="button" class="btn btn-outline-primary" id="filter-new" data-action="assignmentsModule.filterAssignments" data-id="new">
                  <i class="bi bi-star me-1"></i>New Nominees
                </button>
              </div>

              <table class="table table-sm table-hover align-middle" style="font-size: 0.875rem;">
                <thead class="table-light">
                  <tr>
                    <th style="cursor: pointer;" data-action="assignmentsModule.sortAssignments" data-id="company">
                      Company <i class="bi bi-arrow-down-up ms-1"></i>
                    </th>
                    <th>Badges</th>
                    <th style="cursor: pointer;" data-action="assignmentsModule.sortAssignments" data-id="votes">
                      Votes <i class="bi bi-arrow-down-up ms-1"></i>
                    </th>
                    <th>Contact</th>
                    <th class="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody id="assignedCompaniesList">
                  ${validAssignments.map((a) => this.renderAssignedCompany(a)).join('')}
                </tbody>
              </table>
            `
            }
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
                data-on-input="assignmentsModule.filterAvailableCompanies">
            </div>

            <div id="availableCompaniesList" style="max-height: 300px; overflow-y: auto;">
              ${
                availableOrgs.length === 0
                  ? `
                <div class="alert alert-warning">
                  All companies have been assigned to this award.
                </div>
              `
                  : `
                ${availableOrgs.map((org) => this.renderAvailableCompany(org)).join('')}
              `
              }
            </div>
          </div>
        </div>
      `;

      // Store available orgs for filtering
      this.availableOrgs = availableOrgs;

      // Dispose old tooltips before creating new ones to prevent memory leak
      setTimeout(() => {
        const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        [...tooltipTriggerList].forEach((el) => {
          const existing = bootstrap.Tooltip.getInstance(el);
          if (existing) existing.dispose();
        });
        [...tooltipTriggerList].map((el) => new bootstrap.Tooltip(el));
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
   * Render a single assigned company as a table row.
   * @param {Object} assignment - The assignment record with nested organisation
   * @returns {string} HTML table row
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
      badges.push(
        '<span class="badge bg-warning text-dark" title="Previous Winner"><i class="bi bi-trophy"></i></span>'
      );
    }
    if (assignment.nomination_source === 'self_nomination') {
      badges.push('<span class="badge bg-info" title="Self Nominated"><i class="bi bi-hand-index"></i></span>');
    }

    // Multi-category badge
    const otherNominations = assignment.other_nominations || [];
    if (otherNominations.length > 0) {
      const otherAwardsList = otherNominations
        .map((award) => utils.escapeHtml(utils.formatAwardName(award)))
        .join(', ');
      badges.push(
        `<span class="badge" style="background-color: #e7d5ff; color: #7c3aed;" title="Also in: ${otherAwardsList}" data-bs-toggle="tooltip"><i class="bi bi-clipboard2-check"></i> +${otherNominations.length}</span>`
      );
    }

    // Contact info
    const contactParts = [];
    if (org.email)
      contactParts.push(
        `<a href="mailto:${utils.escapeHtml(org.email)}" class="text-decoration-none">${utils.escapeHtml(org.email)}</a>`
      );
    if (org.contact_phone)
      contactParts.push(
        `<a href="tel:${utils.escapeHtml(org.contact_phone)}" class="text-decoration-none"><i class="bi bi-telephone"></i></a>`
      );
    const contactInfo = contactParts.length > 0 ? contactParts.join(' ') : '<span class="text-muted">No contact</span>';

    return `
      <tr>
        <td>
          <div class="d-flex align-items-center">
            ${
              org.logo_url
                ? `<img src="${org.logo_url}" alt="${utils.escapeHtml(org.company_name)}"
                style="width: 24px; height: 24px; object-fit: contain; margin-right: 8px;">`
                : `<div style="width: 24px; height: 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; border-radius: 4px; display: flex; align-items: center; justify-content: center;
                font-weight: 600; font-size: 0.75rem; margin-right: 8px;">${org.company_name.charAt(0)}</div>`
            }
            <a href="#"
               class="text-decoration-none fw-semibold text-primary"
               data-action="orgsModule.openCompanyProfile" data-args='${JSON.stringify([org.id, org.company_name]).replace(/'/g, '&#39;')}'
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
              data-action="assignmentsModule.changeStatus" data-args='${JSON.stringify([assignment.id, 'shortlisted'])}'
              title="Mark as Shortlisted">
              <i class="bi bi-star"></i>
            </button>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-success btn-sm dropdown-toggle"
                data-bs-toggle="dropdown" title="Set Winner Position">
                <i class="bi bi-trophy"></i>
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li><a class="dropdown-item" href="#" data-action="assignmentsModule.setWinnerPosition" data-args='${JSON.stringify([assignment.id, 1])}'><i class="bi bi-star-fill me-2" style="color: #ffd700;"></i>1st Place (Gold)</a></li>
                <li><a class="dropdown-item" href="#" data-action="assignmentsModule.setWinnerPosition" data-args='${JSON.stringify([assignment.id, 2])}'><i class="bi bi-star-fill me-2" style="color: #c0c0c0;"></i>2nd Place (Silver)</a></li>
                <li><a class="dropdown-item" href="#" data-action="assignmentsModule.setWinnerPosition" data-args='${JSON.stringify([assignment.id, 3])}'><i class="bi bi-star-fill me-2" style="color: #cd7f32;"></i>3rd Place (Bronze)</a></li>
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item" href="#" data-action="assignmentsModule.changeStatus" data-args='${JSON.stringify([assignment.id, 'winner'])}'><i class="bi bi-trophy me-2 text-success"></i>Winner (no position)</a></li>
              </ul>
            </div>
            <button class="btn btn-outline-secondary btn-sm"
              data-action="orgsModule.openCompanyProfile" data-args='${JSON.stringify([org.id, org.company_name]).replace(/'/g, '&#39;')}'
              title="View Profile">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-outline-danger btn-sm"
              data-action="assignmentsModule.removeAssignment" data-id="${assignment.id}"
              title="Remove">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  },

  /**
   * Render an available company card for the add-company list.
   * @param {Object} org - Organisation record with id, company_name, email, logo_url
   * @returns {string} HTML card markup
   */
  renderAvailableCompany(org) {
    return `
      <div class="card mb-2 available-company-card" data-company-name="${utils.escapeHtml(org.company_name).toLowerCase()}">
        <div class="card-body p-3">
          <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center flex-grow-1">
              ${
                org.logo_url
                  ? `<img src="${org.logo_url}" alt="${utils.escapeHtml(org.company_name)}"
                  style="width: 32px; height: 32px; object-fit: contain; margin-right: 10px;">`
                  : `<div class="company-initial-avatar-sm me-2">${org.company_name.charAt(0)}</div>`
              }
              <div>
                <div class="fw-semibold">${utils.escapeHtml(org.company_name)}</div>
                <small class="text-muted">${utils.escapeHtml(org.email || 'No email')}</small>
              </div>
            </div>
            <button
              class="btn btn-sm btn-primary"
              data-action="assignmentsModule.assignCompany" data-args='${JSON.stringify([org.id, org.company_name]).replace(/'/g, '&#39;')}'>
              <i class="bi bi-plus-lg"></i> Add
            </button>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Filter available companies by the search box value.
   * @returns {void}
   */
  filterAvailableCompanies() {
    const search = document.getElementById('assignmentSearchBox').value.toLowerCase();
    const cards = document.querySelectorAll('.available-company-card');

    cards.forEach((card) => {
      const companyName = (card.getAttribute('data-company-name') || '').toLowerCase();
      if (companyName.includes(search)) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  },

  /**
   * Filter assigned companies by nomination type.
   * @param {string} filterType - One of 'all', 'self_nomination', 'previous_winner', 'new'
   * @returns {void}
   */
  filterAssignments(filterType) {
    this.currentFilter = filterType;

    // Update button states
    document.querySelectorAll('[id^="filter-"]').forEach((btn) => {
      btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`filter-${filterType}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Filter assignments
    let filtered = this.allAssignments;

    switch (filterType) {
      case 'self_nomination':
        filtered = this.allAssignments.filter((a) => a.nomination_source === 'self_nomination');
        break;
      case 'previous_winner':
        filtered = this.allAssignments.filter((a) => a.is_previous_winner === true);
        break;
      case 'new':
        filtered = this.allAssignments.filter((a) => !a.is_previous_winner);
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
      listContainer.innerHTML = filtered.map((a) => this.renderAssignedCompany(a)).join('');
      countEl.textContent = filtered.length;
    }
  },

  /**
   * Sort assignments by the specified column, toggling direction on repeated clicks.
   * @param {string} column - Column name ('company', 'votes', 'position')
   * @returns {void}
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

    switch (this.currentFilter) {
      case 'self_nomination':
        filtered = this.allAssignments.filter((a) => a.nomination_source === 'self_nomination');
        break;
      case 'previous_winner':
        filtered = this.allAssignments.filter((a) => a.is_previous_winner === true);
        break;
      case 'new':
        filtered = this.allAssignments.filter((a) => !a.is_previous_winner);
        break;
      case 'all':
      default:
        filtered = this.allAssignments;
        break;
    }

    // Sort the filtered assignments
    filtered.sort((a, b) => {
      let aVal, bVal;

      switch (column) {
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
    listContainer.innerHTML = filtered.map((a) => this.renderAssignedCompany(a)).join('');
  },

  /**
   * Assign a company to the current award.
   * @param {string} orgId - Organisation ID
   * @param {string} companyName - Company display name
   * @returns {Promise<void>}
   */
  async assignCompany(orgId, companyName) {
    try {
      utils.showLoading();

      // Check if this assignment already exists (prevent duplicates)
      const { data: existingCheck } = await apiClient.select('award_assignments', {
        select: 'id',
        filters: { award_id: this.currentAwardId, organisation_id: orgId },
        pageSize: 1,
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
        assigned_by: STATE.currentUser?.email,
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
   * Remove an assignment after user confirmation.
   * @param {string} assignmentId - Assignment record ID
   * @returns {Promise<void>}
   */
  async removeAssignment(assignmentId) {
    // Find the assignment to show context in confirmation
    const assignment = (this.allAssignments || []).find((a) => a.id === assignmentId);
    const companyName = assignment?.organisations?.company_name || assignment?.company_name || 'this company';
    if (
      !(await utils.confirmDialog({
        title: 'Remove Assignment',
        message: `Remove <strong>${utils.escapeHtml(companyName)}</strong> from the award?`,
        confirmText: 'Remove',
        danger: true,
      }))
    ) {
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
   * Change the status of an assignment (nominated, shortlisted, winner, rejected).
   * @param {string} assignmentId - Assignment record ID
   * @param {string} newStatus - New status value
   * @returns {Promise<void>}
   */
  async changeStatus(assignmentId, newStatus) {
    try {
      utils.showLoading();

      const updates = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      // If marking as winner, add announcement date AND set actual_winner flag
      if (newStatus === 'winner') {
        updates.announcement_date = new Date().toISOString().split('T')[0];
        updates.actual_winner = true;
      }

      // If unmarking as winner, remove actual_winner flag
      if (newStatus !== 'winner') {
        updates.actual_winner = false;
      }

      await apiClient.update('award_assignments', assignmentId, updates);

      const statusLabels = {
        nominated: 'Nominated',
        shortlisted: 'Shortlisted',
        winner: 'Winner',
        rejected: 'Rejected',
      };

      // Audit trail for status changes
      const assignment = this._cachedAssignments?.find((a) => a.id === assignmentId);
      const companyName = assignment?.organisations?.company_name || '';
      if (typeof awardsModule !== 'undefined' && awardsModule._logAwardAudit) {
        awardsModule._logAwardAudit(
          this.currentAwardId,
          newStatus === 'winner' ? 'winner_set' : 'status_change',
          this.currentAwardName || '',
          `${companyName} → ${statusLabels[newStatus]}`
        );
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
   * Return the HTML badge for an assignment status.
   * @param {string} status - Assignment status
   * @returns {string} HTML badge markup
   */
  getStatusBadge(status) {
    const badges = {
      nominated: '<span class="badge bg-secondary"><i class="bi bi-file-text me-1"></i>Nominated</span>',
      shortlisted: '<span class="badge bg-warning text-dark"><i class="bi bi-star me-1"></i>Shortlisted</span>',
      winner: '<span class="badge bg-success"><i class="bi bi-trophy-fill me-1"></i>Winner</span>',
      rejected: '<span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>Rejected</span>',
    };

    return badges[status] || badges['nominated'];
  },

  /**
   * Return the HTML badge for a winner position (1st/2nd/3rd).
   * @param {Object} assignment - Assignment record
   * @returns {string} HTML badge markup or empty string
   */
  getWinnerPositionBadge(assignment) {
    if (!assignment.winner_position) {
      return '';
    }

    const positions = {
      1: '<span class="badge" style="background-color: #ffd700; color: #000;"><i class="bi bi-star-fill me-1"></i>#1 Recommended</span>',
      2: '<span class="badge" style="background-color: #c0c0c0; color: #000;"><i class="bi bi-star-fill me-1"></i>#2 Recommended</span>',
      3: '<span class="badge" style="background-color: #cd7f32; color: #fff;"><i class="bi bi-star-fill me-1"></i>#3 Recommended</span>',
    };

    return positions[assignment.winner_position] || '';
  },

  /**
   * Set a winner position (1st, 2nd, 3rd) on an assignment.
   * @param {string} assignmentId - Assignment record ID
   * @param {number} position - Winner position (1, 2, or 3)
   * @returns {Promise<void>}
   */
  async setWinnerPosition(assignmentId, position) {
    try {
      utils.showLoading();

      const positionLabels = { 1: '1st Place (Gold)', 2: '2nd Place (Silver)', 3: '3rd Place (Bronze)' };

      await apiClient.update('award_assignments', assignmentId, {
        status: 'winner',
        winner_position: position,
        actual_winner: true,
        announcement_date: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      });

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
   * Open email-nominees modal for the current award.
   * @returns {void}
   */
  emailAllAssigned() {
    if (!this.currentAwardId) {
      utils.showToast('No award selected', 'warning');
      return;
    }

    const assignments = this._cachedAssignments || [];
    if (assignments.length === 0) {
      utils.showToast('No nominees to email', 'warning');
      return;
    }

    // Collect all email addresses from assigned organisations
    const emails = assignments.map((a) => a.organisations?.email).filter(Boolean);

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
          <button class="btn btn-outline-secondary active" data-action="assignmentsModule._filterEmailList" data-id="all">All (${assignments.length})</button>
          <button class="btn btn-outline-warning" data-action="assignmentsModule._filterEmailList" data-id="shortlisted">Shortlisted (${assignments.filter((a) => a.status === 'shortlisted').length})</button>
          <button class="btn btn-outline-success" data-action="assignmentsModule._filterEmailList" data-id="winner">Winners (${assignments.filter((a) => a.status === 'winner').length})</button>
          <button class="btn btn-outline-primary" data-action="assignmentsModule._filterEmailList" data-id="nominated">Nominated (${assignments.filter((a) => a.status === 'nominated').length})</button>
        </div>
      </div>
      <div id="emailListPreview">
        <textarea class="form-control form-control-sm" rows="4" id="nomineeEmailList" readonly>${uniqueEmails.join('; ')}</textarea>
      </div>
      <div class="mt-3 d-flex gap-2">
        <button class="btn btn-primary btn-sm" data-action="assignmentsModule._copyEmails">
          <i class="bi bi-clipboard me-1"></i>Copy All Emails
        </button>
        <button class="btn btn-success btn-sm" data-action="assignmentsModule._openEmailClient">
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

  /** @type {Array} Cached assignments for email feature */
  _cachedAssignments: [],

  /**
   * Copy the nominee email list to clipboard.
   * @returns {void}
   */
  _copyEmails() {
    const text = document.getElementById('nomineeEmailList')?.value;
    if (text) {
      navigator.clipboard.writeText(text);
      utils.showToast('Emails copied to clipboard!', 'success');
    }
  },

  /**
   * Open the default email client with nominees as BCC recipients.
   * @returns {void}
   */
  _openEmailClient() {
    const text = document.getElementById('nomineeEmailList')?.value;
    if (text) {
      window.open('mailto:?bcc=' + encodeURIComponent(text.replace(/;\s*/g, ',')));
    }
  },

  /**
   * Filter the email list by assignment status.
   * @param {string} status - Status to filter by, or 'all'
   * @returns {void}
   */
  _filterEmailList(status) {
    // Update button states
    const btn = event?.target?.closest('[data-action]');
    if (btn) {
      btn
        .closest('.btn-group')
        ?.querySelectorAll('.btn')
        .forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    }

    const assignments = this._cachedAssignments || [];
    const filtered = status === 'all' ? assignments : assignments.filter((a) => a.status === status);
    const emails = [...new Set(filtered.map((a) => a.organisations?.email).filter(Boolean))];
    const textarea = document.getElementById('nomineeEmailList');
    if (textarea) textarea.value = emails.join('; ');
  },

  /**
   * Open the batch decision email modal showing counts of nominees per status
   * that will receive emails when the admin clicks Send.
   */
  async openBatchEmailModal() {
    const assignments = this._cachedAssignments || [];
    const awardName = this.currentAwardName || 'this award';

    const shortlisted = assignments.filter((a) => a.status === 'shortlisted' && a.organisations?.email);
    const winners = assignments.filter((a) => a.status === 'winner' && a.organisations?.email);
    const rejected = assignments.filter((a) => a.status === 'rejected' && a.organisations?.email);

    const totalRecipients = shortlisted.length + winners.length + rejected.length;

    if (totalRecipients === 0) {
      utils.showToast(
        'No nominees with a decision status (shortlisted, winner or rejected) to email. Change statuses first, then send.',
        'warning'
      );
      return;
    }

    document.getElementById('batchEmailModal')?.remove();

    const modalHtml = `
      <div class="modal fade" id="batchEmailModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title"><i class="bi bi-envelope-check me-2"></i>Send Decision Emails</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p class="text-muted mb-3">Send notification emails to all nominees whose status has been decided for <strong>${utils.escapeHtml(awardName)}</strong>.</p>

              <div class="list-group mb-3">
                ${
                  shortlisted.length > 0
                    ? `<label class="list-group-item d-flex align-items-center">
                    <input class="form-check-input me-2" type="checkbox" id="batchShortlisted" checked>
                    <span class="badge bg-warning text-dark me-2">Shortlisted</span>
                    <span>${shortlisted.length} nominee${shortlisted.length !== 1 ? 's' : ''}</span>
                  </label>`
                    : ''
                }
                ${
                  winners.length > 0
                    ? `<label class="list-group-item d-flex align-items-center">
                    <input class="form-check-input me-2" type="checkbox" id="batchWinners" checked>
                    <span class="badge bg-success me-2">Winners</span>
                    <span>${winners.length} nominee${winners.length !== 1 ? 's' : ''}</span>
                  </label>`
                    : ''
                }
                ${
                  rejected.length > 0
                    ? `<label class="list-group-item d-flex align-items-center">
                    <input class="form-check-input me-2" type="checkbox" id="batchRejected" checked>
                    <span class="badge bg-danger me-2">Rejected</span>
                    <span>${rejected.length} nominee${rejected.length !== 1 ? 's' : ''}</span>
                  </label>`
                    : ''
                }
              </div>

              <div class="alert alert-info mb-0">
                <i class="bi bi-info-circle me-2"></i>
                <strong>${totalRecipients}</strong> email${totalRecipients !== 1 ? 's' : ''} will be sent using the configured email templates. Nominees with status "Nominated" will not receive an email.
              </div>

              <div id="batchEmailProgress" class="mt-3" style="display:none;">
                <div class="progress">
                  <div class="progress-bar progress-bar-striped progress-bar-animated" id="batchEmailProgressBar" role="progressbar" style="width: 0%">0%</div>
                </div>
                <small class="text-muted mt-1 d-block" id="batchEmailStatus">Sending...</small>
              </div>
            </div>
            <div class="modal-footer" id="batchEmailFooter">
              <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button class="btn btn-primary" id="batchEmailSendBtn" data-action="assignmentsModule._executeBatchEmails">
                <i class="bi bi-send me-1"></i>Send Decision Emails
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    new bootstrap.Modal(document.getElementById('batchEmailModal')).show();
  },

  /**
   * Execute the batch email send from the modal, respecting checkbox selections.
   */
  async _executeBatchEmails() {
    const assignments = this._cachedAssignments || [];
    const awardName = this.currentAwardName || '';

    // Determine which statuses to include based on checkboxes
    const includeShortlisted = document.getElementById('batchShortlisted')?.checked ?? false;
    const includeWinners = document.getElementById('batchWinners')?.checked ?? false;
    const includeRejected = document.getElementById('batchRejected')?.checked ?? false;

    const recipients = [];
    if (includeShortlisted) {
      recipients.push(
        ...assignments
          .filter((a) => a.status === 'shortlisted' && a.organisations?.email)
          .map((a) => ({ ...a, _emailType: 'shortlisted' }))
      );
    }
    if (includeWinners) {
      recipients.push(
        ...assignments
          .filter((a) => a.status === 'winner' && a.organisations?.email)
          .map((a) => ({ ...a, _emailType: 'winner' }))
      );
    }
    if (includeRejected) {
      recipients.push(
        ...assignments
          .filter((a) => a.status === 'rejected' && a.organisations?.email)
          .map((a) => ({ ...a, _emailType: 'rejected' }))
      );
    }

    if (recipients.length === 0) {
      utils.showToast('No recipients selected', 'warning');
      return;
    }

    // Disable send button and show progress
    const sendBtn = document.getElementById('batchEmailSendBtn');
    if (sendBtn) sendBtn.disabled = true;
    const progressDiv = document.getElementById('batchEmailProgress');
    const progressBar = document.getElementById('batchEmailProgressBar');
    const statusText = document.getElementById('batchEmailStatus');
    if (progressDiv) progressDiv.style.display = 'block';

    let sent = 0;
    let failed = 0;
    const total = recipients.length;

    const token = await apiClient._getToken();

    for (const recipient of recipients) {
      const org = recipient.organisations;
      const emailType = recipient._emailType;

      try {
        let templateKey, variables;

        if (emailType === 'rejected') {
          templateKey = 'REJECTION';
          variables = {
            CONTACT_NAME: org.company_name,
            COMPANY_NAME: org.company_name,
            AWARD_NAME: awardName,
          };
        } else if (emailType === 'shortlisted') {
          templateKey = 'SHORTLIST_NOTIFICATION';
          variables = {
            CONTACT_NAME: org.company_name,
            COMPANY_NAME: org.company_name,
            AWARD_NAME: awardName,
          };
        } else if (emailType === 'winner') {
          templateKey = 'WINNER_ANNOUNCEMENT';
          variables = {
            CONTACT_NAME: org.company_name,
            COMPANY_NAME: org.company_name,
            AWARD_NAME: awardName,
            WINNER_POSITION: recipient.winner_position || '',
          };
        }

        const resp = await fetch('/api/email-automation?action=send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ templateKey, toEmail: org.email, variables }),
        });
        if (!resp.ok) throw new Error(`Email failed: ${resp.status}`);

        sent++;
      } catch (_) {
        failed++;
      }

      // Update progress
      const pct = Math.round(((sent + failed) / total) * 100);
      if (progressBar) {
        progressBar.style.width = `${pct}%`;
        progressBar.textContent = `${pct}%`;
      }
      if (statusText) statusText.textContent = `Sent ${sent}/${total}${failed > 0 ? ` (${failed} failed)` : ''}...`;
    }

    // Done
    if (statusText) statusText.textContent = `Complete: ${sent} sent, ${failed} failed`;
    if (progressBar) {
      progressBar.classList.remove('progress-bar-animated');
      progressBar.classList.add(failed > 0 ? 'bg-warning' : 'bg-success');
    }

    // Replace footer with done button
    const footer = document.getElementById('batchEmailFooter');
    if (footer) {
      footer.innerHTML = `<button class="btn btn-primary" data-bs-dismiss="modal">Done</button>`;
    }

    utils.showToast(
      `Decision emails sent: ${sent} delivered${failed > 0 ? `, ${failed} failed` : ''}`,
      sent > 0 ? 'success' : 'error'
    );
  },

  /**
   * Bulk assign multiple companies to an award at once.
   * @param {string} awardId - Award record ID
   * @param {Array<string>} orgIds - Array of organisation IDs to assign
   * @returns {Promise<void>}
   */
  async bulkAssignCompanies(awardId, orgIds) {
    try {
      utils.showLoading();

      const assignments = orgIds.map((orgId) => ({
        award_id: awardId,
        organisation_id: orgId,
        status: 'nominated',
        assigned_by: STATE.currentUser?.email,
      }));

      await apiClient.insert('award_assignments', assignments);

      utils.showToast(`${orgIds.length} companies assigned successfully!`, 'success');
    } catch (error) {
      console.error('Error bulk assigning:', error);
      utils.showToast('Failed to bulk assign: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Filter the bulk-add company list by search input.
   * @returns {void}
   */
  filterBulkAdd() {
    const searchVal = (document.getElementById('bulkAddSearchBox')?.value || '').toLowerCase();
    const listEl = document.getElementById('bulkAddCompanyList');
    if (!listEl) return;

    const items = listEl.querySelectorAll('.bulk-add-item');
    items.forEach((item) => {
      const name = (item.dataset.name || '').toLowerCase();
      item.style.display = name.includes(searchVal) ? '' : 'none';
    });
  },

  /**
   * Add all selected companies from the bulk-add modal.
   * @returns {Promise<void>}
   */
  async addSelectedCompanies() {
    const checkboxes = document.querySelectorAll('.bulk-add-check:checked');
    if (checkboxes.length === 0) {
      utils.showToast('No companies selected', 'warning');
      return;
    }

    const orgIds = [...checkboxes].map((cb) => cb.value);

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
   * Update the selected-count display in the bulk-add UI.
   * @returns {void}
   */
  updateSelectedCount() {
    const count = document.querySelectorAll('.bulk-add-check:checked').length;
    const el = document.getElementById('assignSelectedCount');
    if (el) el.textContent = String(count);
  },
};

// Export to window
ModuleRegistry.register('assignmentsModule', assignmentsModule);

export { assignmentsModule };
