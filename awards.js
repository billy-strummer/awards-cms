/* ==================================================== */
/* AWARDS MODULE */
/* ==================================================== */

const awardsModule = {
  selectedAwards: new Set(),
  currentSort: { column: 'award_name', direction: 'asc' },

  /**
   * Load all awards from database
   */
  async loadAwards() {
    try {
      utils.showLoading();
      utils.showTableLoading('awardsTableBody', 10);

      let allData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await STATE.client
          .from('awards')
          .select('*')
          .range(from, to);

        if (error) throw error;

        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allData = allData.concat(data);
          page++;

          if (data.length < pageSize) {
            hasMore = false;
          }
        }
      }

      // Batch lookup regions for all counties in one query
      const uniqueCounties = [...new Set(allData.map(a => a.county).filter(Boolean))];
      const countyRegionMap = {};
      if (uniqueCounties.length > 0) {
        const { data: countyData } = await STATE.client
          .from('counties')
          .select('Name, regions(name)')
          .in('Name', uniqueCounties);

        (countyData || []).forEach(c => {
          countyRegionMap[c.Name] = c.regions?.name || null;
        });
      }

      STATE.allAwards = allData.map(award => ({
        ...award,
        _actualRegion: award.county ? (countyRegionMap[award.county] || null) : null,
        _countyName: award.county
      }));

      await this.loadAssignmentCounts();

      // Save current filter state before repopulating dropdowns
      const savedFilters = {
        year: document.getElementById('awardsYearFilterSelect')?.value || '',
        status: document.getElementById('awardsStatusFilterSelect')?.value || '',
        sector: document.getElementById('awardsSectorFilterSelect')?.value || '',
        region: document.getElementById('awardsRegionFilterSelect')?.value || '',
        county: document.getElementById('awardsCountyFilterSelect')?.value || '',
        search: document.getElementById('awardsSearchBox')?.value || ''
      };

      STATE.filteredAwards = STATE.allAwards;

      this.populateFilters();

      // Restore filter state after repopulating
      document.getElementById('awardsYearFilterSelect').value = savedFilters.year;
      document.getElementById('awardsStatusFilterSelect').value = savedFilters.status;
      document.getElementById('awardsSectorFilterSelect').value = savedFilters.sector;
      if (savedFilters.region) {
        document.getElementById('awardsRegionFilterSelect').value = savedFilters.region;
        this.updateCountyFilterByRegion();
      }
      document.getElementById('awardsCountyFilterSelect').value = savedFilters.county;
      document.getElementById('awardsSearchBox').value = savedFilters.search;

      this.updateStats();
      this.filterAwards();

    } catch (error) {
      console.error('Error loading awards:', error);
      utils.showToast('Failed to load awards: ' + error.message, 'error');
      utils.showEmptyState('awardsTableBody', 10, 'Failed to load awards', 'bi-exclamation-triangle');
    } finally {
      utils.hideLoading();
    }
  },
  /**
   * Load assignment counts for all awards
   */
  async loadAssignmentCounts() {
    try {
      let data, error;
      ({ data, error } = await STATE.client
        .from('award_assignments')
        .select('award_id, status, winner_position, organisations(company_name)'));

      // FK relationship missing - retry without joins
      if (error && (error.message?.includes('relationship') || error.message?.includes('schema cache'))) {
        console.warn('award_assignments FK relationships not found, loading without joins');
        ({ data, error } = await STATE.client
          .from('award_assignments')
          .select('award_id, status, winner_position'));
      }

      if (error) throw error;

      // Count assignments per award and track winners
      const counts = {};
      const winners = {};
      (data || []).forEach(assignment => {
        if (!counts[assignment.award_id]) {
          counts[assignment.award_id] = {
            total: 0,
            nominated: 0,
            shortlisted: 0,
            winner: 0
          };
        }
        counts[assignment.award_id].total++;
        counts[assignment.award_id][assignment.status] =
          (counts[assignment.award_id][assignment.status] || 0) + 1;

        // Track winner and runner-up names
        if (assignment.status === 'winner') {
          if (!winners[assignment.award_id]) winners[assignment.award_id] = {};
          const pos = assignment.winner_position || 1;
          winners[assignment.award_id][pos] = assignment.organisations?.company_name || 'Winner';
        }
      });

      // Add counts and winner info to awards
      STATE.allAwards.forEach(award => {
        award._assignmentCounts = counts[award.id] || {
          total: 0,
          nominated: 0,
          shortlisted: 0,
          winner: 0
        };
        const awardWinners = winners[award.id];
        if (awardWinners) {
          award._winnerName = awardWinners[1] || Object.values(awardWinners)[0] || null;
          award._runnerUpName = awardWinners[2] || null;
        }
      });

    } catch (error) {
      console.error('Error loading assignment counts:', error);
    }
  },

  /**
   * Populate year filter with all years found in data
   */
  populateYearFilter() {
    const yearSelect = document.getElementById('awardsYearFilterSelect');

    if (yearSelect) {
      const uniqueYears = [...new Set(STATE.allAwards
        .map(a => {
          if (typeof a.year === 'string' && a.year.includes('-')) {
            return parseInt(a.year.split('-')[0]);
          }
          return parseInt(a.year);
        })
        .filter(y => y && !isNaN(y))
      )].sort((a, b) => b - a);

      yearSelect.innerHTML = '<option value="">All Years</option>' +
        uniqueYears.map(year =>
          `<option value="${year}">${year}</option>`
        ).join('');
    }
  },

  /**
   * Populate filter dropdowns with unique values
   */
  populateFilters() {
    // Populate year filter (2026+)
    this.populateYearFilter();
    
    // Populate sector filter
    utils.populateFilter(
      STATE.allAwards,
      'sector',
      'awardsSectorFilterSelect',
      'All Sectors'
    );
    
    // Populate county filter
    utils.populateFilter(
      STATE.allAwards,
      'county',
      'awardsCountyFilterSelect',
      'All Counties'
    );
    
    // Populate actual region filter
    const uniqueRegions = [...new Set(STATE.allAwards
      .map(a => a._actualRegion)
      .filter(r => r))];

    const regionSelect = document.getElementById('awardsRegionFilterSelect');
    if (regionSelect) {
      regionSelect.innerHTML = '<option value="">All Regions</option>' +
        uniqueRegions.sort().map(region =>
          `<option value="${region}">${region}</option>`
        ).join('');
    }
  },

  /**
   * Update county dropdown based on selected region
   */
  updateCountyFilterByRegion() {
    const selectedRegion = document.getElementById('awardsRegionFilterSelect')?.value || '';
    const countySelect = document.getElementById('awardsCountyFilterSelect');

    if (!countySelect) return;

    if (!selectedRegion) {
      const allCounties = [...new Set(STATE.allAwards
        .map(a => a.county)
        .filter(c => c)
      )].sort();

      countySelect.innerHTML = '<option value="">All Counties</option>' +
        allCounties.map(c => `<option value="${c}">${utils.escapeHtml(c)}</option>`).join('');
    } else {
      const countiesInRegion = [...new Set(STATE.allAwards
        .filter(a => a._actualRegion === selectedRegion)
        .map(a => a.county)
        .filter(c => c)
      )].sort();

      countySelect.innerHTML = '<option value="">All Counties</option>' +
        countiesInRegion.map(c => `<option value="${c}">${utils.escapeHtml(c)}</option>`).join('');
    }

    countySelect.value = '';
  },

  /**
   * Set status filter and trigger filtering
   */
  filterByStatus(status) {
    const statusSelect = document.getElementById('awardsStatusFilterSelect');
    if (statusSelect) {
      statusSelect.value = status;
    }
    this.filterAwards();
  },

  /**
   * Sort awards by column
   */
  sortBy(column) {
    // Toggle direction if same column clicked again
    if (this.currentSort.column === column) {
      this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.currentSort.column = column;
      this.currentSort.direction = 'asc';
    }

    this.applySorting();
    this.renderAwards();
  },

  /**
   * Apply current sort to filteredAwards
   */
  applySorting() {
    const { column, direction } = this.currentSort;
    const dir = direction === 'asc' ? 1 : -1;

    STATE.filteredAwards.sort((a, b) => {
      let valA, valB;

      switch (column) {
        case 'year':
          valA = parseInt(a.year) || 0;
          valB = parseInt(b.year) || 0;
          return (valA - valB) * dir;
        case 'award_name':
          valA = utils.formatAwardName(a).toLowerCase();
          valB = utils.formatAwardName(b).toLowerCase();
          break;
        case 'county':
          valA = (a.county || '').toLowerCase();
          valB = (b.county || '').toLowerCase();
          break;
        case 'sector':
          valA = (a.sector || '').toLowerCase();
          valB = (b.sector || '').toLowerCase();
          break;
        case 'status':
          valA = (a.status || '').toLowerCase();
          valB = (b.status || '').toLowerCase();
          break;
        case 'nominees':
          valA = a._assignmentCounts?.total || 0;
          valB = b._assignmentCounts?.total || 0;
          return (valA - valB) * dir;
        case 'winner':
          valA = (a._winnerName || '').toLowerCase();
          valB = (b._winnerName || '').toLowerCase();
          break;
        default:
          valA = (a[column] || '').toString().toLowerCase();
          valB = (b[column] || '').toString().toLowerCase();
      }

      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return 0;
    });
  },

  /**
   * Filter awards based on current filter values
   */
  filterAwards() {
    const year = document.getElementById('awardsYearFilterSelect').value;
    const status = document.getElementById('awardsStatusFilterSelect').value;
    const sector = document.getElementById('awardsSectorFilterSelect').value;
    const county = document.getElementById('awardsCountyFilterSelect').value;
    const region = document.getElementById('awardsRegionFilterSelect').value;
    const search = document.getElementById('awardsSearchBox').value.toLowerCase().trim();

    STATE.filteredAwards = STATE.allAwards.filter(award => {
      // Year filter - handle both date strings and year numbers
      if (year) {
        let awardYear;
        if (typeof award.year === 'string' && award.year.includes('-')) {
          awardYear = award.year.split('-')[0];
        } else {
          awardYear = award.year;
        }
        if (String(awardYear) !== String(year)) return false;
      }

      // Status filter
      if (status && award.status?.toLowerCase() !== status.toLowerCase()) return false;

      // Sector filter
      if (sector && award.sector !== sector) return false;

      // County filter
      if (county && award.county !== county) return false;

      // Region filter (actual region like "South West")
      if (region && award._actualRegion !== region) return false;

      // Search filter (award name, county, sector, status, winner, description)
      if (search) {
        const searchFields = [
          utils.formatAwardName(award),
          award.county || '',
          award.sector || '',
          award.status || '',
          award._winnerName || '',
          award.description || ''
        ].join(' ').toLowerCase();

        if (!searchFields.includes(search)) {
          return false;
        }
      }

      return true;
    });

    this.applySorting();
    this.renderAwards();
  },

  /**
   * Render awards table
   */
  /**
   * Get the current phase of an award based on dates
   */
  getAwardPhase(award) {
    const now = new Date();
    const dates = {
      entryOpen: award.entry_open_date ? new Date(award.entry_open_date) : null,
      entryClose: award.entry_close_date ? new Date(award.entry_close_date) : null,
      judgingOpen: award.judging_open_date ? new Date(award.judging_open_date) : null,
      judgingClose: award.judging_close_date ? new Date(award.judging_close_date) : null,
      votingOpen: award.voting_open_date ? new Date(award.voting_open_date) : null,
      votingClose: award.voting_close_date ? new Date(award.voting_close_date) : null,
      winnersAnnouncement: award.winners_announcement_date ? new Date(award.winners_announcement_date) : null
    };

    if (dates.winnersAnnouncement && now >= dates.winnersAnnouncement) {
      return { label: 'Complete', color: 'success', icon: 'check-circle' };
    }
    if (dates.votingOpen && dates.votingClose && now >= dates.votingOpen && now <= dates.votingClose) {
      return { label: 'Voting', color: 'info', icon: 'hand-thumbs-up' };
    }
    if (dates.judgingOpen && dates.judgingClose && now >= dates.judgingOpen && now <= dates.judgingClose) {
      return { label: 'Judging', color: 'warning', icon: 'clipboard-check' };
    }
    if (dates.entryOpen && dates.entryClose && now >= dates.entryOpen && now <= dates.entryClose) {
      return { label: 'Entries Open', color: 'primary', icon: 'pencil-square' };
    }
    if (dates.entryOpen && now < dates.entryOpen) {
      return { label: 'Upcoming', color: 'secondary', icon: 'clock' };
    }
    if (dates.entryClose && now > dates.entryClose && (!dates.judgingOpen || now < dates.judgingOpen)) {
      return { label: 'Entries Closed', color: 'dark', icon: 'lock' };
    }
    return { label: '-', color: 'light', icon: '' };
  },

  renderAwards() {
    const tbody = document.getElementById('awardsTableBody');
    const count = document.getElementById('awardsCount');

    count.textContent = STATE.filteredAwards.length;

    if (STATE.filteredAwards.length === 0) {
      utils.showEmptyState('awardsTableBody', 10, 'No awards found matching your filters');
      return;
    }

    tbody.innerHTML = STATE.filteredAwards.map(award => {
      const counts = award._assignmentCounts || { total: 0, nominated: 0, shortlisted: 0, winner: 0 };
      const countBadgeClass = counts.total === 0 ? 'zero' :
                             counts.total < 5 ? 'low' :
                             counts.total < 15 ? 'medium' : 'high';

      const fullName = utils.formatAwardName(award);

      // Simplified winner display
      let winnerHtml = '<span class="text-muted small">-</span>';
      if (award._winnerName) {
        const prevTitle = award.prev_year_winner ? `\nPrev: ${award.prev_year_winner}` : '';
        winnerHtml = `
          <span class="small fw-semibold" title="${utils.escapeHtml(award._winnerName)}${award._runnerUpName ? '\n2nd: ' + utils.escapeHtml(award._runnerUpName) : ''}${prevTitle}">
            <i class="bi bi-trophy-fill text-success me-1"></i>${utils.escapeHtml(award._winnerName)}
          </span>`;
      } else if (counts.shortlisted > 0) {
        winnerHtml = `<span class="badge bg-warning text-dark small">${counts.shortlisted} shortlisted</span>`;
      } else if (award.prev_year_winner) {
        winnerHtml = `<span class="small text-muted" title="Previous: ${utils.escapeHtml(award.prev_year_winner)}"><i class="bi bi-clock-history me-1"></i>Prev: ${utils.escapeHtml(award.prev_year_winner)}</span>`;
      }

      // Phase badge
      const phase = this.getAwardPhase(award);
      const phaseHtml = phase.label === '-' ? '<span class="text-muted small">-</span>' :
        `<span class="badge bg-${phase.color}-subtle text-${phase.color}" style="font-size: 0.7rem;">${phase.icon ? '<i class="bi bi-' + phase.icon + ' me-1"></i>' : ''}${phase.label}</span>`;

      return `
        <tr class="fade-in">
          <td><input type="checkbox" class="form-check-input award-select-cb" value="${award.id}" onchange="awardsModule.toggleSelection('${award.id}', this.checked)" ${this.selectedAwards.has(award.id) ? 'checked' : ''}></td>
          <td class="text-center"><span class="badge bg-light text-dark">${award.year || '-'}</span></td>
          <td>
            <a href="javascript:void(0);"
               class="text-decoration-none fw-semibold text-primary"
               onclick="assignmentsModule.openAssignmentsModal('${award.id}', '${utils.escapeHtml(fullName).replace(/'/g, "\\'")}')">
              ${utils.escapeHtml(fullName)}
            </a>
          </td>
          <td><span class="small">${utils.escapeHtml(award.county || '-')}</span></td>
          <td>
            <span class="badge bg-info-subtle text-info" style="font-size: 0.7rem;">
              ${utils.escapeHtml(award.sector || '-')}
            </span>
          </td>
          <td>${utils.getStatusBadge(award.status || 'Draft')}</td>
          <td class="text-center">
            <div class="assignment-count-badge ${countBadgeClass}"
              style="cursor: pointer;"
              onclick="assignmentsModule.openAssignmentsModal('${award.id}', '${utils.escapeHtml(fullName).replace(/'/g, "\\'")}')"
              title="${counts.nominated} nominated, ${counts.shortlisted} shortlisted, ${counts.winner} winner">
              <i class="bi bi-people-fill"></i>
              <span>${counts.total}</span>
            </div>
          </td>
          <td class="text-center">${phaseHtml}</td>
          <td>${winnerHtml}</td>
          <td class="text-center">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" data-bs-display="static" aria-expanded="false">
                <i class="bi bi-three-dots-vertical"></i>
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li>
                  <a class="dropdown-item" href="javascript:void(0);" onclick="assignmentsModule.openAssignmentsModal('${award.id}', '${utils.escapeHtml(fullName).replace(/'/g, "\\'")}')">
                    <i class="bi bi-people text-primary me-2"></i>Manage Nominees
                  </a>
                </li>
                <li>
                  <a class="dropdown-item" href="javascript:void(0);" onclick="awardsModule.openEditModal('${award.id}')">
                    <i class="bi bi-pencil text-warning me-2"></i>Edit Award
                  </a>
                </li>
                <li>
                  <a class="dropdown-item" href="javascript:void(0);" onclick="awardsModule.viewDetails('${award.id}')">
                    <i class="bi bi-eye text-info me-2"></i>View Details
                  </a>
                </li>
                <li>
                  <a class="dropdown-item" href="javascript:void(0);" onclick="awardsModule.showVisualTimeline('${award.id}')">
                    <i class="bi bi-calendar-range text-success me-2"></i>Timeline
                  </a>
                </li>
                <li>
                  <a class="dropdown-item" href="javascript:void(0);" onclick="awardsModule.cloneAward('${award.id}')">
                    <i class="bi bi-copy text-purple me-2" style="color:#6f42c1;"></i>Clone to Year
                  </a>
                </li>
                <li>
                  <a class="dropdown-item" href="javascript:void(0);" onclick="awardsModule.showAwardAuditLog('${award.id}', '${utils.escapeHtml(fullName).replace(/'/g, "\\'")}')">
                    <i class="bi bi-journal-text text-secondary me-2"></i>Audit Log
                  </a>
                </li>
                <li><hr class="dropdown-divider"></li>
                <li>
                  <a class="dropdown-item text-danger" href="javascript:void(0);" onclick="awardsModule.deleteAward('${award.id}')">
                    <i class="bi bi-trash me-2"></i>Delete
                  </a>
                </li>
              </ul>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this.updateSortIndicators();
  },

  /**
   * View award details
   * @param {string} awardId - Award ID
   */
  async viewDetails(awardId) {
    const award = STATE.allAwards.find(a => a.id === awardId);
    if (!award) return;

    try {
      utils.showLoading();

      // Load nominees/assignments for this award
      const { data: assignments, error: assignError } = await STATE.client
        .from('award_assignments')
        .select(`
          *,
          organisations (id, company_name)
        `)
        .eq('award_id', awardId)
        .order('created_at', { ascending: false });

      if (assignError) throw assignError;

      // Load entries with voting enabled for this award
      const { data: votingEntries, error: entriesError } = await STATE.client
        .from('entries')
        .select(`
          *,
          organisations (id, company_name)
        `)
        .eq('award_id', awardId)
        .eq('allow_public_voting', true)
        .order('vote_count', { ascending: false });

      if (entriesError) throw entriesError;

      // Create and show modal
      let modal = bootstrap.Modal.getInstance(document.getElementById('awardDetailsModal'));
      if (!modal) {
        modal = new bootstrap.Modal(document.getElementById('awardDetailsModal'));
      }

      const modalTitle = document.getElementById('awardDetailsModalTitle');
      const modalBody = document.getElementById('awardDetailsModalBody');

      modalTitle.innerHTML = `<i class="bi bi-trophy me-2"></i>${utils.escapeHtml(award.award_name)}`;

      modalBody.innerHTML = `
        <!-- Award Information -->
        <div class="row mb-4">
          <div class="col-md-6">
            <h6 class="text-muted mb-3"><i class="bi bi-info-circle me-2"></i>Award Details</h6>
            <table class="table table-sm">
              <tr>
                <th width="40%">Award Name:</th>
                <td>${utils.escapeHtml(utils.formatAwardName(award))}</td>
              </tr>
              <tr>
                <th>Category:</th>
                <td>${utils.escapeHtml(award.award_name)}</td>
              </tr>
              <tr>
                <th>County/City:</th>
                <td>${utils.escapeHtml(award.county || 'N/A')}</td>
              </tr>
              <tr>
                <th>Year:</th>
                <td>${award.year || 'N/A'}</td>
              </tr>
              <tr>
                <th>Sector:</th>
                <td><span class="badge bg-info-subtle text-info">${utils.escapeHtml(award.sector || 'N/A')}</span></td>
              </tr>
              <tr>
                <th>Status:</th>
                <td>${utils.getStatusBadge(award.status)}</td>
              </tr>
              <tr>
                <th>Nominees:</th>
                <td><strong>${assignments?.length || 0}</strong></td>
              </tr>
            </table>
          </div>
          <div class="col-md-6">
            <h6 class="text-muted mb-3"><i class="bi bi-calendar me-2"></i>Key Dates</h6>
            <table class="table table-sm">
              <tr>
                <th width="40%">Entry Opens:</th>
                <td>${award.entry_open_date ? new Date(award.entry_open_date).toLocaleDateString('en-GB') : 'N/A'}</td>
              </tr>
              <tr>
                <th>Entry Closes:</th>
                <td>${award.entry_close_date ? new Date(award.entry_close_date).toLocaleDateString('en-GB') : 'N/A'}</td>
              </tr>
              <tr>
                <th>Nominees Announced:</th>
                <td>${award.nominees_announcement_date ? new Date(award.nominees_announcement_date).toLocaleDateString('en-GB') : 'N/A'}</td>
              </tr>
              <tr>
                <th>Judging Opens:</th>
                <td>${award.judging_open_date ? new Date(award.judging_open_date).toLocaleDateString('en-GB') : 'N/A'}</td>
              </tr>
              <tr>
                <th>Judging Closes:</th>
                <td>${award.judging_close_date ? new Date(award.judging_close_date).toLocaleDateString('en-GB') : 'N/A'}</td>
              </tr>
              <tr>
                <th>Voting Opens:</th>
                <td>${award.voting_open_date ? new Date(award.voting_open_date).toLocaleDateString('en-GB') : 'N/A'}</td>
              </tr>
              <tr>
                <th>Voting Closes:</th>
                <td>${award.voting_close_date ? new Date(award.voting_close_date).toLocaleDateString('en-GB') : 'N/A'}</td>
              </tr>
              <tr>
                <th>Winners Announced:</th>
                <td>${award.winners_announcement_date ? new Date(award.winners_announcement_date).toLocaleDateString('en-GB') : 'N/A'}</td>
              </tr>
            </table>
          </div>
        </div>

        ${award.description ? `
          <div class="mb-4">
            <h6 class="text-muted mb-2"><i class="bi bi-file-text me-2"></i>Description</h6>
            <p class="text-muted">${utils.escapeHtml(award.description)}</p>
          </div>
        ` : ''}

        ${award.prev_year_winner ? `
          <div class="mb-4">
            <h6 class="text-muted mb-3"><i class="bi bi-clock-history me-2"></i>Previous Year's Results</h6>
            <div class="d-flex flex-wrap gap-2">
              <span class="badge bg-warning text-dark px-3 py-2">
                <i class="bi bi-trophy-fill me-1"></i>1st: ${utils.escapeHtml(award.prev_year_winner)}
              </span>
              ${award.prev_year_2nd ? `<span class="badge bg-secondary px-3 py-2">
                <i class="bi bi-award me-1"></i>2nd: ${utils.escapeHtml(award.prev_year_2nd)}
              </span>` : ''}
              ${award.prev_year_3rd ? `<span class="badge bg-dark px-3 py-2">
                <i class="bi bi-award me-1"></i>3rd: ${utils.escapeHtml(award.prev_year_3rd)}
              </span>` : ''}
            </div>
          </div>
        ` : ''}

        <!-- Nominees Tab -->
        <div class="mb-4">
          <h6 class="text-muted mb-3"><i class="bi bi-people me-2"></i>Nominees (${assignments?.length || 0})</h6>
          ${assignments && assignments.length > 0 ? `
            <div class="table-responsive">
              <table class="table table-sm table-hover">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${assignments.map(assign => `
                    <tr>
                      <td>
                        <a href="javascript:void(0);"
                           class="text-decoration-none fw-semibold text-primary"
                           onclick="orgsModule.openCompanyProfile('${assign.organisations?.id}', '${utils.escapeHtml(assign.organisations?.company_name || '').replace(/'/g, "\\'")}')"
                           title="View company profile">
                          ${utils.escapeHtml(assign.organisations?.company_name || 'N/A')}
                        </a>
                      </td>
                      <td>${assignmentsModule.getStatusBadge(assign.status)}</td>
                      <td>${assign.score ? `<strong>${assign.score}</strong>` : '-'}</td>
                      <td>
                        <button class="btn btn-sm btn-outline-primary"
                          onclick="assignmentsModule.openAssignmentsModal('${award.id}', '${utils.escapeHtml(award.award_name).replace(/'/g, "\\'")}')">
                          <i class="bi bi-pencil"></i> Manage
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : '<div class="alert alert-info">No nominees assigned yet</div>'}
        </div>

        <!-- Public Voting Links -->
        ${votingEntries && votingEntries.length > 0 ? `
          <div class="mb-4">
            <h6 class="text-muted mb-3"><i class="bi bi-link-45deg me-2"></i>Public Voting Links (${votingEntries.length})</h6>
            <div class="alert alert-success">
              <i class="bi bi-check-circle me-2"></i>
              <strong>${votingEntries.length}</strong> ${votingEntries.length === 1 ? 'nominee has' : 'nominees have'} public voting enabled
            </div>
            <div class="table-responsive">
              <table class="table table-sm table-hover">
                <thead>
                  <tr>
                    <th>Entry #</th>
                    <th>Company</th>
                    <th>Entry Title</th>
                    <th>Votes</th>
                    <th>Voting Link</th>
                  </tr>
                </thead>
                <tbody>
                  ${votingEntries.map(entry => {
                    const votingUrl = `${window.location.origin}/vote.html?entry=${entry.entry_number}`;
                    return `
                      <tr>
                        <td><span class="badge bg-primary">${utils.escapeHtml(entry.entry_number)}</span></td>
                        <td>
                          <a href="javascript:void(0);"
                             class="text-decoration-none text-primary"
                             onclick="orgsModule.openCompanyProfile('${entry.organisations?.id}', '${utils.escapeHtml(entry.organisations?.company_name || '').replace(/'/g, "\\'")}')"
                             title="View company profile">
                            ${utils.escapeHtml(entry.organisations?.company_name || 'N/A')}
                          </a>
                        </td>
                        <td>${utils.escapeHtml(entry.entry_title || 'N/A')}</td>
                        <td>
                          <span class="badge bg-success-subtle text-success">
                            <i class="bi bi-hand-thumbs-up me-1"></i>${entry.vote_count || 0}
                          </span>
                        </td>
                        <td>
                          <div class="input-group input-group-sm">
                            <input type="text" class="form-control" value="${votingUrl}" readonly>
                            <button class="btn btn-outline-primary" type="button"
                              onclick="navigator.clipboard.writeText('${votingUrl}'); utils.showToast('Link copied!', 'success');">
                              <i class="bi bi-clipboard"></i>
                            </button>
                            <a href="${votingUrl}" target="_blank" class="btn btn-outline-success">
                              <i class="bi bi-box-arrow-up-right"></i>
                            </a>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
      `;

      modal.show();

    } catch (error) {
      console.error('Error loading award details:', error);
      utils.showToast('Error loading award details: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Update stats summary bar
   */
  updateStats() {
    const awards = STATE.allAwards;
    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };

    el('statsTotalAwards', awards.length);
    el('statsActiveAwards', awards.filter(a => a.status?.toLowerCase() === 'active').length);
    el('statsWithNominees', awards.filter(a => (a._assignmentCounts?.total || 0) > 0).length);
    el('statsWithWinners', awards.filter(a => (a._assignmentCounts?.winner || 0) > 0).length);
    el('statsCounties', [...new Set(awards.map(a => a.county).filter(Boolean))].length);
    el('statsSectors', [...new Set(awards.map(a => a.sector).filter(Boolean))].length);
  },

  /**
   * Populate season dropdown in award form
   */
  populateSeasonDropdown() {
    const select = document.getElementById('awardFormSeason');
    if (!select) return;

    const seasons = settingsModule?.allSeasons || [];
    select.innerHTML = '<option value="">Custom dates...</option>' +
      seasons.map(s => {
        const label = `${s.name} (${s.year})`;
        return `<option value="${s.id}" ${s.is_default ? 'data-default="true"' : ''}>${utils.escapeHtml(label)}</option>`;
      }).join('');
  },

  /**
   * Apply season dates when season dropdown changes
   */
  applySeasonDates() {
    const seasonId = document.getElementById('awardFormSeason').value;
    if (!seasonId) return;

    const seasons = settingsModule?.allSeasons || [];
    const season = seasons.find(s => s.id === seasonId);
    if (!season) return;

    document.getElementById('awardFormEntryOpen').value = season.entry_open_date || '';
    document.getElementById('awardFormEntryClose').value = season.entry_close_date || '';
    document.getElementById('awardFormNomineesAnnouncement').value = season.nominees_announcement_date || '';
    document.getElementById('awardFormJudgingOpen').value = season.judging_open_date || '';
    document.getElementById('awardFormJudgingClose').value = season.judging_close_date || '';
    document.getElementById('awardFormVotingOpen').value = season.voting_open_date || '';
    document.getElementById('awardFormVotingClose').value = season.voting_close_date || '';
    document.getElementById('awardFormWinnersAnnouncement').value = season.winners_announcement_date || '';
    document.getElementById('awardFormYear').value = season.year;
  },

  /**
   * Open create award modal
   */
  openCreateModal() {
    document.getElementById('awardFormId').value = '';
    document.getElementById('awardFormName').value = '';
    document.getElementById('awardFormYear').value = new Date().getFullYear();
    document.getElementById('awardFormStatus').value = 'Active';
    document.getElementById('awardFormEntryOpen').value = '';
    document.getElementById('awardFormEntryClose').value = '';
    document.getElementById('awardFormNomineesAnnouncement').value = '';
    document.getElementById('awardFormJudgingOpen').value = '';
    document.getElementById('awardFormJudgingClose').value = '';
    document.getElementById('awardFormVotingOpen').value = '';
    document.getElementById('awardFormVotingClose').value = '';
    document.getElementById('awardFormWinnersAnnouncement').value = '';
    document.getElementById('awardFormDescription').value = '';
    document.getElementById('awardFormPrevWinner').value = '';
    document.getElementById('awardFormPrev2nd').value = '';
    document.getElementById('awardFormPrev3rd').value = '';
    document.getElementById('awardFormModalTitle').innerHTML = '<i class="bi bi-plus-lg me-2"></i>Add Award';

    // Populate county dropdown from REGIONS
    const countySelect = document.getElementById('awardFormCounty');
    countySelect.innerHTML = '<option value="">Select County/City...</option>' +
      REGIONS.sort().map(r => `<option value="${r}">${r}</option>`).join('');

    // Populate sector dropdown
    const sectorSelect = document.getElementById('awardFormSector');
    sectorSelect.innerHTML = '<option value="">Select Sector...</option>' +
      SECTORS.map(s => `<option value="${s}">${s}</option>`).join('');

    // Populate season dropdown
    this.populateSeasonDropdown();

    const modal = new bootstrap.Modal(document.getElementById('awardFormModal'));
    modal.show();
  },

  /**
   * Open edit award modal
   */
  openEditModal(awardId) {
    const award = STATE.allAwards.find(a => a.id === awardId);
    if (!award) return;

    document.getElementById('awardFormId').value = award.id;
    document.getElementById('awardFormName').value = award.award_name || '';
    document.getElementById('awardFormYear').value = award.year || new Date().getFullYear();
    document.getElementById('awardFormStatus').value = award.status || 'Active';
    document.getElementById('awardFormEntryOpen').value = award.entry_open_date || '';
    document.getElementById('awardFormEntryClose').value = award.entry_close_date || '';
    document.getElementById('awardFormNomineesAnnouncement').value = award.nominees_announcement_date || '';
    document.getElementById('awardFormJudgingOpen').value = award.judging_open_date || '';
    document.getElementById('awardFormJudgingClose').value = award.judging_close_date || '';
    document.getElementById('awardFormVotingOpen').value = award.voting_open_date || '';
    document.getElementById('awardFormVotingClose').value = award.voting_close_date || '';
    document.getElementById('awardFormWinnersAnnouncement').value = award.winners_announcement_date || '';
    document.getElementById('awardFormDescription').value = award.description || '';
    document.getElementById('awardFormPrevWinner').value = award.prev_year_winner || '';
    document.getElementById('awardFormPrev2nd').value = award.prev_year_2nd || '';
    document.getElementById('awardFormPrev3rd').value = award.prev_year_3rd || '';
    document.getElementById('awardFormModalTitle').innerHTML = '<i class="bi bi-pencil me-2"></i>Edit Award';

    // Populate county dropdown
    const countySelect = document.getElementById('awardFormCounty');
    countySelect.innerHTML = '<option value="">Select County/City...</option>' +
      REGIONS.sort().map(r => `<option value="${r}" ${r === award.county ? 'selected' : ''}>${r}</option>`).join('');

    // Populate sector dropdown
    const sectorSelect = document.getElementById('awardFormSector');
    sectorSelect.innerHTML = '<option value="">Select Sector...</option>' +
      SECTORS.map(s => `<option value="${s}" ${s === award.sector ? 'selected' : ''}>${s}</option>`).join('');

    // Populate season dropdown
    this.populateSeasonDropdown();

    const modal = new bootstrap.Modal(document.getElementById('awardFormModal'));
    modal.show();
  },

  /**
   * Validate that dates are in chronological order
   * Returns error message string or null if valid
   */
  validateDates(dates) {
    const ordered = [
      { key: 'entry_open_date', label: 'Entry Opens' },
      { key: 'entry_close_date', label: 'Entry Closes' },
      { key: 'nominees_announcement_date', label: 'Nominees Announced' },
      { key: 'judging_open_date', label: 'Judging Opens' },
      { key: 'judging_close_date', label: 'Judging Closes' },
      { key: 'voting_open_date', label: 'Voting Opens' },
      { key: 'voting_close_date', label: 'Voting Closes' },
      { key: 'winners_announcement_date', label: 'Winners Announced' }
    ];

    // Only validate dates that are actually set
    const setDates = ordered.filter(d => dates[d.key]);

    for (let i = 0; i < setDates.length - 1; i++) {
      const current = setDates[i];
      const next = setDates[i + 1];
      if (dates[current.key] > dates[next.key]) {
        return `"${current.label}" (${dates[current.key]}) must be before "${next.label}" (${dates[next.key]})`;
      }
    }
    return null;
  },

  /**
   * Save award (create or update)
   */
  async saveAward() {
    const form = document.getElementById('awardForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const id = document.getElementById('awardFormId').value;
    const awardData = {
      award_name: document.getElementById('awardFormName').value.trim(),
      county: document.getElementById('awardFormCounty').value,
      sector: document.getElementById('awardFormSector').value,
      year: document.getElementById('awardFormYear').value,
      status: document.getElementById('awardFormStatus').value,
      entry_open_date: document.getElementById('awardFormEntryOpen').value || null,
      entry_close_date: document.getElementById('awardFormEntryClose').value || null,
      nominees_announcement_date: document.getElementById('awardFormNomineesAnnouncement').value || null,
      judging_open_date: document.getElementById('awardFormJudgingOpen').value || null,
      judging_close_date: document.getElementById('awardFormJudgingClose').value || null,
      voting_open_date: document.getElementById('awardFormVotingOpen').value || null,
      voting_close_date: document.getElementById('awardFormVotingClose').value || null,
      winners_announcement_date: document.getElementById('awardFormWinnersAnnouncement').value || null,
      description: document.getElementById('awardFormDescription').value.trim() || null,
      prev_year_winner: document.getElementById('awardFormPrevWinner').value.trim() || null,
      prev_year_2nd: document.getElementById('awardFormPrev2nd').value.trim() || null,
      prev_year_3rd: document.getElementById('awardFormPrev3rd').value.trim() || null
    };

    // Validate date order
    const dateError = this.validateDates(awardData);
    if (dateError) {
      utils.showToast('Date order error: ' + dateError, 'error');
      return;
    }

    try {
      utils.showLoading();

      // Duplicate prevention: check for same award_name + county + year
      {
        let query = STATE.client
          .from('awards')
          .select('id')
          .eq('award_name', awardData.award_name)
          .eq('county', awardData.county)
          .eq('year', awardData.year);
        if (id) query = query.neq('id', id);

        const { data: existing } = await query.limit(1);

        if (existing && existing.length > 0) {
          utils.hideLoading();
          utils.showToast(`An award "${awardData.award_name}" already exists for ${awardData.county} in ${awardData.year}`, 'error');
          return;
        }
      }

      let error;
      if (id) {
        // Update existing
        ({ error } = await STATE.client
          .from('awards')
          .update(awardData)
          .eq('id', id));
      } else {
        // Create new
        ({ error } = await STATE.client
          .from('awards')
          .insert(awardData));
      }

      if (error) throw error;

      // Close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('awardFormModal'));
      if (modal) modal.hide();

      // Audit trail
      this._logAwardAudit(id || 'new', id ? 'updated' : 'created', awardData.award_name,
        id ? `Award updated: ${awardData.award_name} (${awardData.county}, ${awardData.year})` :
        `Award created: ${awardData.award_name} (${awardData.county}, ${awardData.year})`);

      utils.showToast(id ? 'Award updated successfully!' : 'Award created successfully!', 'success');
      await this.loadAwards();

    } catch (error) {
      console.error('Error saving award:', error);
      utils.showToast('Failed to save award: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Toggle single award selection
   */
  toggleSelection(awardId, checked) {
    if (checked) {
      this.selectedAwards.add(awardId);
    } else {
      this.selectedAwards.delete(awardId);
    }
    this.updateBulkToolbar();
  },

  /**
   * Toggle select all visible awards
   */
  toggleSelectAll(checked) {
    if (checked) {
      STATE.filteredAwards.forEach(a => this.selectedAwards.add(a.id));
    } else {
      this.selectedAwards.clear();
    }
    // Update all checkboxes
    document.querySelectorAll('.award-select-cb').forEach(cb => {
      cb.checked = checked;
    });
    this.updateBulkToolbar();
  },

  /**
   * Clear all selections
   */
  clearSelection() {
    this.selectedAwards.clear();
    document.querySelectorAll('.award-select-cb').forEach(cb => { cb.checked = false; });
    const selectAll = document.getElementById('awardsSelectAll');
    if (selectAll) selectAll.checked = false;
    this.updateBulkToolbar();
  },

  /**
   * Show/hide bulk actions toolbar
   */
  updateBulkToolbar() {
    const toolbar = document.getElementById('awardsBulkActions');
    const countEl = document.getElementById('awardsBulkCount');
    const count = this.selectedAwards.size;

    if (toolbar) {
      toolbar.style.display = count > 0 ? 'flex' : 'none';
      toolbar.style.setProperty('display', count > 0 ? 'flex' : 'none', 'important');
    }
    if (countEl) countEl.textContent = count;
    if (count > 0) this.populateBulkSeasonDropdown();
  },

  /**
   * Bulk set status for selected awards
   */
  async bulkSetStatus(newStatus) {
    const count = this.selectedAwards.size;
    if (count === 0) return;

    if (!confirm(`Set ${count} awards to "${newStatus}"?`)) return;

    try {
      utils.showLoading();

      const ids = [...this.selectedAwards];
      const { error } = await STATE.client
        .from('awards')
        .update({ status: newStatus })
        .in('id', ids);

      if (error) throw error;

      utils.showToast(`${count} awards set to ${newStatus}`, 'success');
      this.selectedAwards.clear();
      await this.loadAwards();

    } catch (error) {
      console.error('Error bulk updating status:', error);
      utils.showToast('Failed to update awards: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Bulk delete selected awards
   */
  async bulkDelete() {
    const count = this.selectedAwards.size;
    if (count === 0) return;

    if (!confirm(`Delete ${count} awards? This cannot be undone.`)) return;
    if (!confirm(`Are you absolutely sure? This will permanently delete ${count} awards and their assignments.`)) return;

    try {
      utils.showLoading();

      const ids = [...this.selectedAwards];

      // Delete assignments first
      const { error: assignError } = await STATE.client
        .from('award_assignments')
        .delete()
        .in('award_id', ids);

      if (assignError) throw assignError;

      // Then delete awards
      const { error } = await STATE.client
        .from('awards')
        .delete()
        .in('id', ids);

      if (error) throw error;

      utils.showToast(`${count} awards deleted`, 'success');
      this.selectedAwards.clear();
      await this.loadAwards();

    } catch (error) {
      console.error('Error bulk deleting:', error);
      utils.showToast('Failed to delete awards: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Export filtered awards to CSV
   */
  exportAwards() {
    const awards = STATE.filteredAwards;
    if (awards.length === 0) {
      utils.showToast('No awards to export', 'warning');
      return;
    }

    const headers = ['Award Name', 'Category', 'County/City', 'Region', 'Sector', 'Year', 'Status', 'Nominees', 'Winner', 'Prev Year Winner'];
    const rows = awards.map(a => {
      const counts = a._assignmentCounts || { total: 0 };
      return [
        utils.formatAwardName(a),
        a.award_name || '',
        a.county || '',
        a._actualRegion || '',
        a.sector || '',
        a.year || '',
        a.status || '',
        counts.total,
        a._winnerName || '',
        a.prev_year_winner || ''
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `awards-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    utils.showToast(`Exported ${awards.length} awards`, 'success');
  },

  /**
   * Delete a single award
   */
  async deleteAward(awardId) {
    if (!utils.confirm('Are you sure you want to delete this award? This action cannot be undone.')) {
      return;
    }
    
    try {
      utils.showLoading();
      
      const award = STATE.allAwards.find(a => a.id === awardId);
      const { error } = await STATE.client
        .from('awards')
        .delete()
        .eq('id', awardId);

      if (error) throw error;

      this._logAwardAudit(awardId, 'deleted', award?.award_name || '', `Award deleted: ${award?.award_name || 'Unknown'}`);

      await this.loadAwards();
      utils.showToast('Award deleted successfully', 'success');
      
    } catch (error) {
      console.error('Error deleting award:', error);
      utils.showToast('Failed to delete award: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Roll over awards from one year to the next as Draft
   */
  async rolloverToNextYear() {
    // Determine source year from current filter or most common year
    const years = [...new Set((STATE.allAwards || []).map(a => a.year))].sort((a, b) => b - a);

    if (years.length === 0) {
      utils.showToast('No awards to roll over', 'warning');
      return;
    }

    const sourceYear = parseInt(years[0]);
    const targetYear = sourceYear + 1;

    // Get awards for the source year
    const sourceAwards = STATE.allAwards.filter(a => String(a.year) === String(sourceYear));

    if (sourceAwards.length === 0) {
      utils.showToast(`No awards found for ${sourceYear}`, 'warning');
      return;
    }

    // Check if target year already has awards
    const existingTarget = STATE.allAwards.filter(a => String(a.year) === String(targetYear));

    let message = `Roll over ${sourceAwards.length} awards from ${sourceYear} to ${targetYear}?\n\n`;
    message += `All copied awards will be set to "Draft" status, ready for vetting.\n`;
    message += `Dates will be cleared so you can set new season dates.`;

    if (existingTarget.length > 0) {
      message += `\n\n⚠️ ${targetYear} already has ${existingTarget.length} awards. Only NEW award names (not already in ${targetYear}) will be copied.`;
    }

    if (!confirm(message)) return;

    try {
      utils.showLoading();

      // Get existing award name+county combos for target year to avoid duplicates
      const existingKeys = new Set(existingTarget.map(a => `${a.award_name}|||${a.county}`));

      // Filter out awards that already exist in the target year (same name + county)
      const awardsToRoll = sourceAwards.filter(a => !existingKeys.has(`${a.award_name}|||${a.county}`));

      if (awardsToRoll.length === 0) {
        utils.showToast(`All ${sourceYear} awards already exist in ${targetYear}`, 'info');
        return;
      }

      // Fetch previous year's winners from award_assignments
      const sourceAwardIds = awardsToRoll.map(a => a.id);
      const { data: winnerData } = await STATE.client
        .from('award_assignments')
        .select('award_id, winner_position, organisations(company_name)')
        .in('award_id', sourceAwardIds)
        .eq('status', 'winner');

      // Build a lookup: award_id -> { 1: 'Company A', 2: 'Company B', 3: 'Company C' }
      const winnersMap = {};
      (winnerData || []).forEach(w => {
        if (!winnersMap[w.award_id]) winnersMap[w.award_id] = {};
        const pos = w.winner_position || 1;
        winnersMap[w.award_id][pos] = w.organisations?.company_name || 'Unknown';
      });

      // Build new award records — copy structure, clear dates, set Draft, tag prev year results
      const newAwards = awardsToRoll.map(a => {
        const prevWinners = winnersMap[a.id] || {};
        return {
          award_name: a.award_name,
          county: a.county,
          sector: a.sector,
          year: targetYear,
          status: 'Draft',
          description: a.description,
          prev_year_winner: prevWinners[1] || null,
          prev_year_2nd: prevWinners[2] || null,
          prev_year_3rd: prevWinners[3] || null,
          entry_open_date: null,
          entry_close_date: null,
          nominees_announcement_date: null,
          judging_open_date: null,
          judging_close_date: null,
          voting_open_date: null,
          voting_close_date: null,
          winners_announcement_date: null
        };
      });

      const { error } = await STATE.client
        .from('awards')
        .insert(newAwards);

      if (error) throw error;

      const withWinners = newAwards.filter(a => a.prev_year_winner).length;
      let msg = `${newAwards.length} awards rolled over to ${targetYear} as Draft!`;
      if (withWinners > 0) msg += ` (${withWinners} with previous year results)`;
      utils.showToast(msg, 'success');
      await this.loadAwards();

    } catch (error) {
      console.error('Error rolling over awards:', error);
      utils.showToast('Failed to roll over awards: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Reset all filters to default
   */
  resetFilters() {
    document.getElementById('awardsYearFilterSelect').value = '';
    document.getElementById('awardsStatusFilterSelect').value = '';
    document.getElementById('awardsSectorFilterSelect').value = '';
    document.getElementById('awardsRegionFilterSelect').value = '';
    document.getElementById('awardsCountyFilterSelect').value = '';
    document.getElementById('awardsSearchBox').value = '';
    this.updateCountyFilterByRegion();
    this.filterAwards();
  },

  /**
   * Update sort direction indicators in column headers
   */
  updateSortIndicators() {
    document.querySelectorAll('[data-sort-icon]').forEach(icon => {
      icon.className = 'bi bi-arrow-down-up text-muted ms-1 small';
    });
    const activeIcon = document.querySelector(`[data-sort-icon="${this.currentSort.column}"]`);
    if (activeIcon) {
      const iconClass = this.currentSort.direction === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down';
      activeIcon.className = `bi ${iconClass} text-primary ms-1 small`;
    }
  },

  /**
   * Populate the bulk season dropdown with available seasons
   */
  populateBulkSeasonDropdown() {
    const dropdown = document.getElementById('bulkSeasonDropdown');
    if (!dropdown) return;

    const seasons = (typeof settingsModule !== 'undefined' && settingsModule?.allSeasons) || [];
    if (seasons.length === 0) {
      dropdown.innerHTML = '<li><span class="dropdown-item text-muted">No seasons configured</span></li>';
      return;
    }

    dropdown.innerHTML = seasons.map(s =>
      `<li><a class="dropdown-item" href="javascript:void(0);" onclick="awardsModule.bulkApplySeasonDates('${s.id}')">
        <i class="bi bi-calendar-event me-2"></i>${utils.escapeHtml(s.name)} (${s.year})
      </a></li>`
    ).join('');
  },

  /**
   * Bulk apply season dates to all selected awards
   */
  async bulkApplySeasonDates(seasonId) {
    const count = this.selectedAwards.size;
    if (count === 0) return;

    const seasons = (typeof settingsModule !== 'undefined' && settingsModule?.allSeasons) || [];
    const season = seasons.find(s => s.id === seasonId);
    if (!season) return;

    if (!confirm(`Apply "${season.name} (${season.year})" dates to ${count} selected awards?`)) return;

    try {
      utils.showLoading();

      const ids = [...this.selectedAwards];
      const dateUpdate = {
        entry_open_date: season.entry_open_date || null,
        entry_close_date: season.entry_close_date || null,
        nominees_announcement_date: season.nominees_announcement_date || null,
        judging_open_date: season.judging_open_date || null,
        judging_close_date: season.judging_close_date || null,
        voting_open_date: season.voting_open_date || null,
        voting_close_date: season.voting_close_date || null,
        winners_announcement_date: season.winners_announcement_date || null
      };

      const { error } = await STATE.client
        .from('awards')
        .update(dateUpdate)
        .in('id', ids);

      if (error) throw error;

      utils.showToast(`Season dates applied to ${count} awards`, 'success');
      this.selectedAwards.clear();
      await this.loadAwards();

    } catch (error) {
      console.error('Error applying season dates:', error);
      utils.showToast('Failed to apply season dates: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  // ============================================
  // FEATURE 1: AWARD DATA QUALITY DASHBOARD
  // ============================================
  showDataQualityDashboard() {
    const awards = STATE.allAwards;
    const active = awards.filter(a => (a.status || 'Draft').toLowerCase() !== 'archived');

    // Calculate quality metrics
    const missingDates = active.filter(a => !a.entry_open_date || !a.entry_close_date || !a.winners_announcement_date);
    const noNominees = active.filter(a => (a._assignmentCounts?.total || 0) === 0);
    const noWinner = active.filter(a => {
      const phase = this.getAwardPhase(a);
      return phase.label === 'Complete' && (a._assignmentCounts?.winner || 0) === 0;
    });
    const missingJudgingDates = active.filter(a => !a.judging_open_date || !a.judging_close_date);
    const missingVotingDates = active.filter(a => !a.voting_open_date || !a.voting_close_date);
    const draftOnly = active.filter(a => (a.status || 'Draft') === 'Draft');
    const noPrevWinner = active.filter(a => a.year > 2024 && !a.prev_year_winner);
    const noDescription = active.filter(a => !a.description);

    // Overall score
    const totalChecks = active.length * 6; // 6 quality dimensions
    const issues = missingDates.length + noNominees.length + noWinner.length +
      missingJudgingDates.length + missingVotingDates.length + noDescription.length;
    const qualityScore = totalChecks > 0 ? Math.round(((totalChecks - issues) / totalChecks) * 100) : 100;
    const scoreColor = qualityScore >= 80 ? 'success' : qualityScore >= 50 ? 'warning' : 'danger';

    const renderList = (items, limit = 10) => {
      if (items.length === 0) return '<span class="text-success small"><i class="bi bi-check-circle me-1"></i>All clear</span>';
      return `<div style="max-height: 150px; overflow-y: auto;">
        ${items.slice(0, limit).map(a => `<div class="small py-1 border-bottom">
          <a href="javascript:void(0);" class="text-primary text-decoration-none" onclick="awardsModule.openEditModal('${a.id}')">${utils.escapeHtml(utils.formatAwardName(a))}</a>
          <span class="text-muted ms-1">(${a.year})</span>
        </div>`).join('')}
        ${items.length > limit ? `<div class="small text-muted mt-1">+${items.length - limit} more</div>` : ''}
      </div>`;
    };

    const html = `
      <div class="text-center mb-4">
        <div class="d-inline-block position-relative" style="width: 120px; height: 120px;">
          <svg viewBox="0 0 36 36" style="width: 120px; height: 120px; transform: rotate(-90deg);">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e9ecef" stroke-width="3"/>
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--bs-${scoreColor})" stroke-width="3"
              stroke-dasharray="${qualityScore} ${100 - qualityScore}" stroke-linecap="round"/>
          </svg>
          <div class="position-absolute top-50 start-50 translate-middle">
            <div class="fw-bold fs-4 text-${scoreColor}">${qualityScore}%</div>
            <div class="text-muted" style="font-size: 0.6rem;">Quality Score</div>
          </div>
        </div>
      </div>

      <div class="row g-3">
        <div class="col-md-6">
          <div class="card border-${missingDates.length > 0 ? 'danger' : 'success'}">
            <div class="card-body p-3">
              <h6 class="card-title small fw-bold"><i class="bi bi-calendar-x text-danger me-2"></i>Missing Key Dates <span class="badge bg-danger">${missingDates.length}</span></h6>
              <p class="text-muted small mb-2">Awards without entry open, entry close, or winners announcement dates</p>
              ${renderList(missingDates)}
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card border-${noNominees.length > 0 ? 'warning' : 'success'}">
            <div class="card-body p-3">
              <h6 class="card-title small fw-bold"><i class="bi bi-people text-warning me-2"></i>No Nominees <span class="badge bg-warning text-dark">${noNominees.length}</span></h6>
              <p class="text-muted small mb-2">Active awards with zero nominees assigned</p>
              ${renderList(noNominees)}
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card border-${noWinner.length > 0 ? 'danger' : 'success'}">
            <div class="card-body p-3">
              <h6 class="card-title small fw-bold"><i class="bi bi-trophy text-danger me-2"></i>Complete But No Winner <span class="badge bg-danger">${noWinner.length}</span></h6>
              <p class="text-muted small mb-2">Awards past announcement date with no winner selected</p>
              ${renderList(noWinner)}
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card border-${missingVotingDates.length > 0 ? 'info' : 'success'}">
            <div class="card-body p-3">
              <h6 class="card-title small fw-bold"><i class="bi bi-hand-thumbs-up text-info me-2"></i>Missing Voting Dates <span class="badge bg-info">${missingVotingDates.length}</span></h6>
              <p class="text-muted small mb-2">Awards without voting open/close dates</p>
              ${renderList(missingVotingDates)}
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card border-${draftOnly.length > 0 ? 'secondary' : 'success'}">
            <div class="card-body p-3">
              <h6 class="card-title small fw-bold"><i class="bi bi-file-earmark text-secondary me-2"></i>Still in Draft <span class="badge bg-secondary">${draftOnly.length}</span></h6>
              <p class="text-muted small mb-2">Awards not yet activated</p>
              ${renderList(draftOnly)}
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card border-${noDescription.length > 0 ? 'secondary' : 'success'}">
            <div class="card-body p-3">
              <h6 class="card-title small fw-bold"><i class="bi bi-text-paragraph text-secondary me-2"></i>No Description <span class="badge bg-secondary">${noDescription.length}</span></h6>
              <p class="text-muted small mb-2">Awards missing a description</p>
              ${renderList(noDescription)}
            </div>
          </div>
        </div>
      </div>

      <div class="mt-3 pt-3 border-top">
        <div class="row text-center">
          <div class="col"><div class="fw-bold text-primary fs-5">${active.length}</div><div class="text-muted small">Active Awards</div></div>
          <div class="col"><div class="fw-bold text-danger fs-5">${issues}</div><div class="text-muted small">Total Issues</div></div>
          <div class="col"><div class="fw-bold text-success fs-5">${active.length - noNominees.length}</div><div class="text-muted small">With Nominees</div></div>
          <div class="col"><div class="fw-bold text-warning fs-5">${noPrevWinner.length}</div><div class="text-muted small">No Prev Winner</div></div>
        </div>
      </div>
    `;

    this._showDynamicModal('Award Data Quality Dashboard', html, 'bi-shield-check', 'modal-lg');
  },

  // ============================================
  // FEATURE 2: AWARD AUDIT TRAIL
  // ============================================
  async _logAwardAudit(awardId, action, awardName, details) {
    try {
      await STATE.client.from('org_audit_log').insert([{
        org_id: awardId,
        company_name: awardName,
        action: 'award_' + action,
        details: details
      }]);
    } catch (e) { /* silent - audit is non-critical */ }
  },

  async getAwardAuditLog(awardId) {
    try {
      const { data, error } = await STATE.client.from('org_audit_log')
        .select('*')
        .eq('org_id', awardId)
        .ilike('action', 'award_%')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    } catch (e) { return []; }
  },

  async showAwardAuditLog(awardId, awardName) {
    const log = await this.getAwardAuditLog(awardId);

    let html;
    if (log.length === 0) {
      html = '<div class="alert alert-info"><i class="bi bi-info-circle me-2"></i>No audit history recorded yet for this award.</div>';
    } else {
      html = `<div class="list-group list-group-flush" style="max-height: 400px; overflow-y: auto;">
        ${log.map(entry => {
          const date = new Date(entry.created_at);
          const icons = {
            'award_created': 'bi-plus-circle text-success',
            'award_updated': 'bi-pencil text-primary',
            'award_status_change': 'bi-arrow-repeat text-info',
            'award_deleted': 'bi-trash text-danger',
            'award_cloned': 'bi-copy text-purple',
            'award_nominee_added': 'bi-person-plus text-success',
            'award_nominee_removed': 'bi-person-dash text-danger',
            'award_winner_set': 'bi-trophy text-warning'
          };
          const icon = icons[entry.action] || 'bi-clock-history text-muted';
          const timeAgo = this._timeAgo(date);
          return `<div class="list-group-item px-0 py-2 border-0">
            <div class="d-flex align-items-start">
              <i class="bi ${icon} me-2 mt-1"></i>
              <div class="flex-grow-1">
                <div class="small fw-semibold">${utils.escapeHtml(entry.details || entry.action)}</div>
                <div class="text-muted" style="font-size: 0.7rem;">${timeAgo} &middot; ${date.toLocaleDateString('en-GB')} ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>`;
    }

    this._showDynamicModal(`Audit Log: ${awardName || 'Award'}`, html, 'bi-journal-text');
  },

  _timeAgo(date) {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
    return date.toLocaleDateString('en-GB');
  },

  // ============================================
  // FEATURE 3: CLONE / TEMPLATE AWARDS
  // ============================================
  async cloneAward(awardId) {
    const award = STATE.allAwards.find(a => a.id === awardId);
    if (!award) { utils.showToast('Award not found', 'error'); return; }

    const targetYear = parseInt(prompt(`Clone "${utils.formatAwardName(award)}" to which year?`, new Date().getFullYear()));
    if (!targetYear || isNaN(targetYear)) return;

    try {
      utils.showLoading();

      // Check for duplicate
      const { data: existing } = await STATE.client.from('awards')
        .select('id').eq('award_name', award.award_name)
        .eq('county', award.county).eq('year', targetYear).limit(1);

      if (existing && existing.length > 0) {
        utils.hideLoading();
        utils.showToast(`"${award.award_name}" already exists for ${award.county} in ${targetYear}`, 'error');
        return;
      }

      const cloneData = {
        award_name: award.award_name,
        county: award.county,
        sector: award.sector,
        year: targetYear,
        status: 'Draft',
        description: award.description,
        // Carry previous year winner info
        prev_year_winner: award._winnerName || award.prev_year_winner || null,
        prev_year_2nd: award._runnerUpName || award.prev_year_2nd || null,
        prev_year_3rd: award.prev_year_3rd || null,
        // Clear dates (will be set from season)
        entry_open_date: null, entry_close_date: null,
        nominees_announcement_date: null, judging_open_date: null,
        judging_close_date: null, voting_open_date: null,
        voting_close_date: null, winners_announcement_date: null
      };

      const { error } = await STATE.client.from('awards').insert([cloneData]);
      if (error) throw error;

      this._logAwardAudit(awardId, 'cloned', award.award_name, `Cloned to year ${targetYear}`);
      utils.showToast(`Award cloned to ${targetYear} as Draft`, 'success');
      await this.loadAwards();
    } catch (error) {
      console.error('Error cloning award:', error);
      utils.showToast('Error: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  async bulkCloneSelected() {
    const count = this.selectedAwards.size;
    if (count === 0) { utils.showToast('No awards selected', 'warning'); return; }

    const targetYear = parseInt(prompt(`Clone ${count} selected awards to which year?`, new Date().getFullYear()));
    if (!targetYear || isNaN(targetYear)) return;

    if (!confirm(`Clone ${count} awards to ${targetYear}? Existing duplicates will be skipped.`)) return;

    try {
      utils.showLoading();
      let cloned = 0, skipped = 0;

      for (const awardId of this.selectedAwards) {
        const award = STATE.allAwards.find(a => a.id === awardId);
        if (!award) continue;

        const { data: existing } = await STATE.client.from('awards')
          .select('id').eq('award_name', award.award_name)
          .eq('county', award.county).eq('year', targetYear).limit(1);

        if (existing && existing.length > 0) { skipped++; continue; }

        const { error } = await STATE.client.from('awards').insert([{
          award_name: award.award_name, county: award.county, sector: award.sector,
          year: targetYear, status: 'Draft', description: award.description,
          prev_year_winner: award._winnerName || award.prev_year_winner || null,
          prev_year_2nd: award._runnerUpName || award.prev_year_2nd || null,
          prev_year_3rd: award.prev_year_3rd || null
        }]);
        if (!error) cloned++;
      }

      this.selectedAwards.clear();
      utils.showToast(`Cloned ${cloned} awards to ${targetYear}${skipped > 0 ? ` (${skipped} skipped as duplicates)` : ''}`, 'success');
      await this.loadAwards();
    } catch (error) {
      utils.showToast('Error: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  // ============================================
  // FEATURE 5: VISUAL TIMELINE FOR AWARD DATES
  // ============================================
  showVisualTimeline(awardId) {
    const award = awardId ? STATE.allAwards.find(a => a.id === awardId) : null;
    const awards = award ? [award] : STATE.filteredAwards.filter(a => (a.status || 'Draft').toLowerCase() !== 'archived').slice(0, 30);

    const dateFields = [
      { key: 'entry_open_date', label: 'Entries Open', color: '#0d6efd', icon: 'bi-pencil-square' },
      { key: 'entry_close_date', label: 'Entries Close', color: '#6610f2', icon: 'bi-lock' },
      { key: 'nominees_announcement_date', label: 'Nominees', color: '#6f42c1', icon: 'bi-megaphone' },
      { key: 'judging_open_date', label: 'Judging Open', color: '#ffc107', icon: 'bi-clipboard-check' },
      { key: 'judging_close_date', label: 'Judging Close', color: '#fd7e14', icon: 'bi-clipboard-x' },
      { key: 'voting_open_date', label: 'Voting Open', color: '#0dcaf0', icon: 'bi-hand-thumbs-up' },
      { key: 'voting_close_date', label: 'Voting Close', color: '#20c997', icon: 'bi-stopwatch' },
      { key: 'winners_announcement_date', label: 'Winners', color: '#198754', icon: 'bi-trophy' }
    ];

    // Single award timeline
    if (award) {
      const now = new Date();
      const allDates = dateFields.filter(df => award[df.key]).map(df => ({
        ...df, date: new Date(award[df.key]), raw: award[df.key]
      })).sort((a, b) => a.date - b.date);

      const html = `
        <div class="mb-3">
          <h6 class="fw-bold">${utils.escapeHtml(utils.formatAwardName(award))} <span class="badge bg-light text-dark">${award.year}</span></h6>
        </div>
        ${allDates.length === 0 ? '<div class="alert alert-warning"><i class="bi bi-exclamation-triangle me-2"></i>No dates set for this award</div>' :
          `<div class="position-relative" style="padding-left: 30px;">
            <div class="position-absolute" style="left: 14px; top: 0; bottom: 0; width: 2px; background: #e9ecef;"></div>
            ${allDates.map(d => {
              const isPast = now > d.date;
              const isToday = d.date.toDateString() === now.toDateString();
              const daysFromNow = Math.ceil((d.date - now) / 86400000);
              const daysLabel = isToday ? 'Today' : isPast ? `${Math.abs(daysFromNow)}d ago` : `In ${daysFromNow}d`;
              return `<div class="d-flex align-items-center mb-3">
                <div class="position-absolute" style="left: 6px; width: 18px; height: 18px; border-radius: 50%; background: ${isPast ? d.color : '#fff'}; border: 3px solid ${d.color}; z-index: 1;"></div>
                <div class="flex-grow-1 ms-3">
                  <div class="card ${isToday ? 'border-primary shadow-sm' : isPast ? 'bg-light' : ''}">
                    <div class="card-body p-2">
                      <div class="d-flex justify-content-between align-items-center">
                        <div>
                          <i class="bi ${d.icon} me-1" style="color: ${d.color};"></i>
                          <span class="small fw-semibold">${d.label}</span>
                        </div>
                        <div class="text-end">
                          <span class="small fw-bold">${d.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          <span class="badge ${isPast ? 'bg-success-subtle text-success' : isToday ? 'bg-primary' : 'bg-light text-dark'} ms-1" style="font-size: 0.6rem;">${daysLabel}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>`;
            }).join('')}
          </div>`}
      `;

      this._showDynamicModal('Award Timeline', html, 'bi-calendar-range');
      return;
    }

    // Multi-award overview
    const html = `
      <div class="mb-3">
        <div class="d-flex gap-2 flex-wrap mb-3">
          ${dateFields.map(df => `<span class="badge" style="background: ${df.color}; font-size: 0.65rem;"><i class="bi ${df.icon} me-1"></i>${df.label}</span>`).join('')}
        </div>
      </div>
      <div style="max-height: 500px; overflow-y: auto;">
        <table class="table table-sm table-hover">
          <thead class="table-light"><tr>
            <th style="width: 25%;">Award</th>
            ${dateFields.map(df => `<th class="text-center" style="width: 9.375%; font-size: 0.65rem;" title="${df.label}"><i class="bi ${df.icon}" style="color: ${df.color};"></i></th>`).join('')}
          </tr></thead>
          <tbody>
            ${awards.map(a => `<tr>
              <td class="small fw-semibold text-truncate" style="max-width: 200px;" title="${utils.escapeHtml(utils.formatAwardName(a))}">${utils.escapeHtml(a.award_name || 'N/A')}<br><span class="text-muted" style="font-size:0.6rem;">${utils.escapeHtml(a.county || '-')}</span></td>
              ${dateFields.map(df => {
                const d = a[df.key];
                const now = new Date();
                const isPast = d && new Date(d) < now;
                return `<td class="text-center small ${isPast ? 'text-muted' : ''}" title="${df.label}: ${d || 'Not set'}">
                  ${d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '<span class="text-danger">-</span>'}
                </td>`;
              }).join('')}
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;

    this._showDynamicModal('Awards Timeline Overview', html, 'bi-calendar-range', 'modal-xl');
  },

  // ============================================
  // FEATURE 6: AWARD DUPLICATE DETECTION
  // ============================================
  showDuplicateDetection() {
    const dupeMap = new Map();

    STATE.allAwards.forEach(award => {
      const key = `${(award.award_name || '').toLowerCase().trim()}|${(award.county || '').toLowerCase().trim()}|${award.year}`;
      if (!dupeMap.has(key)) dupeMap.set(key, []);
      dupeMap.get(key).push(award);
    });

    const exactDupes = Array.from(dupeMap.values()).filter(g => g.length > 1);

    // Fuzzy name matching (same county+year, similar names)
    const fuzzyDupes = [];
    const checked = new Set();
    const awards = STATE.allAwards;

    for (let i = 0; i < awards.length; i++) {
      for (let j = i + 1; j < awards.length; j++) {
        const a = awards[i], b = awards[j];
        if (a.year !== b.year) continue;
        if ((a.county || '').toLowerCase() !== (b.county || '').toLowerCase()) continue;
        const key = `${a.id}|${b.id}`;
        if (checked.has(key)) continue;

        const nameA = (a.award_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const nameB = (b.award_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (nameA === nameB) continue; // Already caught by exact

        const similar = nameA.includes(nameB) || nameB.includes(nameA) ||
          (nameA.length < 30 && nameB.length < 30 && this._levenshtein(nameA, nameB) <= 3);

        if (similar) {
          checked.add(key);
          fuzzyDupes.push([a, b]);
        }
      }
    }

    if (exactDupes.length === 0 && fuzzyDupes.length === 0) {
      utils.showToast('No duplicates found!', 'success');
      return;
    }

    let html = '';
    if (exactDupes.length > 0) {
      html += `<div class="alert alert-danger mb-3"><i class="bi bi-exclamation-triangle me-2"></i>${exactDupes.length} exact duplicate group(s) found</div>`;
      exactDupes.forEach((group, idx) => {
        html += `<div class="card mb-2"><div class="card-body py-2">
          <h6 class="mb-2 small fw-bold">Exact Group ${idx + 1}: "${utils.escapeHtml(group[0].award_name)}" - ${group[0].county} (${group[0].year})</h6>
          <div class="table-responsive"><table class="table table-sm mb-0">
            <thead><tr><th>Name</th><th>County</th><th>Year</th><th>Status</th><th>Nominees</th><th>Action</th></tr></thead>
            <tbody>${group.map(a => `<tr>
              <td class="small">${utils.escapeHtml(a.award_name)}</td>
              <td class="small">${utils.escapeHtml(a.county || '-')}</td>
              <td>${a.year}</td>
              <td>${utils.getStatusBadge(a.status || 'Draft')}</td>
              <td class="text-center">${a._assignmentCounts?.total || 0}</td>
              <td><button class="btn btn-sm btn-outline-danger" onclick="awardsModule.deleteAward('${a.id}')"><i class="bi bi-trash"></i></button></td>
            </tr>`).join('')}</tbody>
          </table></div>
        </div></div>`;
      });
    }

    if (fuzzyDupes.length > 0) {
      html += `<div class="alert alert-warning mt-3 mb-3"><i class="bi bi-exclamation-circle me-2"></i>${fuzzyDupes.length} similar name pair(s) found</div>`;
      fuzzyDupes.slice(0, 20).forEach(([a, b]) => {
        html += `<div class="card mb-2"><div class="card-body py-2">
          <div class="d-flex justify-content-between align-items-center">
            <div class="small">
              <strong>${utils.escapeHtml(a.award_name)}</strong> vs <strong>${utils.escapeHtml(b.award_name)}</strong>
              <span class="text-muted ms-1">(${a.county}, ${a.year})</span>
            </div>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" onclick="awardsModule.openEditModal('${a.id}')" title="Edit first"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-outline-danger" onclick="awardsModule.deleteAward('${b.id}')" title="Delete second"><i class="bi bi-trash"></i></button>
            </div>
          </div>
        </div></div>`;
      });
    }

    this._showDynamicModal('Award Duplicate Detection', html, 'bi-files', 'modal-lg');
  },

  _levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  },

  // ============================================
  // SHARED DYNAMIC MODAL HELPER
  // ============================================
  _showDynamicModal(title, bodyHtml, icon, sizeClass) {
    document.getElementById('dynamicAwardModal')?.remove();
    const modalHtml = `<div class="modal fade" id="dynamicAwardModal" tabindex="-1">
      <div class="modal-dialog ${sizeClass || ''}"><div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title"><i class="bi ${icon || 'bi-info-circle'} me-2"></i>${title}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">${bodyHtml}</div>
        <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Close</button></div>
      </div></div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    new bootstrap.Modal(document.getElementById('dynamicAwardModal')).show();
  }
};

// Export to window for global access
window.awardsModule = awardsModule;