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
    utils.showTableLoading('awardsTableBody', 7); // 7 columns

    // Load all awards - county column stores the county/city name
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
        // Map the actual region by looking up county in counties table
        const dataWithRegions = await Promise.all(data.map(async (award) => {
          let actualRegion = null;
          
          // Look up the region for this county
if (award.county) {
  const { data: countyData } = await STATE.client
    .from('counties')
    .select('Name, region_id, regions(name)')
    .ilike('Name', award.county)
    .single();
  
  if (countyData?.regions?.name) {
    actualRegion = countyData.regions.name;
  }
}

return {
  ...award,
  _actualRegion: actualRegion,
  _countyName: award.county
};
        }));
        
        allData = allData.concat(dataWithRegions);
        page++;
        
        // Stop if we got less than pageSize records (last page)
        if (data.length < pageSize) {
          hasMore = false;
        }
      }
    }
    
    STATE.allAwards = allData;
    
    // Load assignment counts for each award
    await this.loadAssignmentCounts();
    
    STATE.filteredAwards = STATE.allAwards;
    
    // Populate filter dropdowns
    this.populateFilters();
    this.updateStats();
    this.renderAwards();
    
    console.log(`✅ Loaded ${STATE.allAwards.length} awards`);
    
  } catch (error) {
    console.error('Error loading awards:', error);
    console.error('Error details:', error.details, error.hint, error.message);
    utils.showToast('Failed to load awards: ' + error.message, 'error');
    utils.showEmptyState('awardsTableBody', 7, 'Failed to load awards', 'bi-exclamation-triangle');
  } finally {
    utils.hideLoading();
  }
},
  /**
   * Load assignment counts for all awards
   */
  async loadAssignmentCounts() {
    try {
      const { data, error } = await STATE.client
        .from('award_assignments')
        .select('award_id, status, winner_position, organisations(company_name)');

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
   * Populate year filter with only 2026+
   */
  populateYearFilter() {
    const currentYear = new Date().getFullYear();
    const yearSelect = document.getElementById('awardsYearFilterSelect');
    
    if (yearSelect) {
      // Get unique years from awards that are >= 2026
      const uniqueYears = [...new Set(STATE.allAwards
        .map(a => {
          // Handle both string dates like "2026-01-01" and year numbers
          if (typeof a.year === 'string' && a.year.includes('-')) {
            return parseInt(a.year.split('-')[0]);
          }
          return parseInt(a.year);
        })
        .filter(y => y && y >= currentYear)
      )].sort((a, b) => b - a); // Sort descending (newest first)
      
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
},  // ← populateFilters ends here

/**
 * Update county dropdown based on selected region
 */
updateCountyFilterByRegion() {
  const selectedRegion = document.getElementById('awardsRegionFilterSelect')?.value || '';
  const countySelect = document.getElementById('awardsCountyFilterSelect');
  
  if (!countySelect) return;
  
  if (!selectedRegion) {
    // No region selected - show all counties
    const allCounties = [...new Set(STATE.allAwards
      .map(a => a.county)
      .filter(c => c)
    )].sort();
    
    countySelect.innerHTML = '<option value="">All Counties</option>' +
      allCounties.map(c => `<option value="${c}">${utils.escapeHtml(c)}</option>`).join('');
  } else {
    // Region selected - show only counties in that region
    const countiesInRegion = [...new Set(STATE.allAwards
      .filter(a => a._actualRegion === selectedRegion)
      .map(a => a.county)
      .filter(c => c)
    )].sort();
    
    countySelect.innerHTML = '<option value="">All Counties</option>' +
      countiesInRegion.map(c => `<option value="${c}">${utils.escapeHtml(c)}</option>`).join('');
  }
  
  // Reset county selection
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
        case 'award_name':
          valA = utils.formatAwardName(a).toLowerCase();
          valB = utils.formatAwardName(b).toLowerCase();
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
        if (awardYear != year) return false;
      }

      // Status filter
      if (status && award.status?.toLowerCase() !== status.toLowerCase()) return false;

      // Sector filter
      if (sector && award.sector !== sector) return false;

      // County filter
      if (county && award.county !== county) return false;

      // Region filter (actual region like "South West")
      if (region && award._actualRegion !== region) return false;

      // Search filter (searches full award name, category, county, and winner)
      if (search) {
        const fullName = utils.formatAwardName(award).toLowerCase();
        const winnerName = award.winner?.toLowerCase() || '';

        if (!fullName.includes(search) && !winnerName.includes(search)) {
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
  renderAwards() {
    const tbody = document.getElementById('awardsTableBody');
    const count = document.getElementById('awardsCount');

    count.textContent = STATE.filteredAwards.length;

    if (STATE.filteredAwards.length === 0) {
      utils.showEmptyState('awardsTableBody', 7, 'No awards found matching your filters');
      return;
    }

    tbody.innerHTML = STATE.filteredAwards.map(award => {
      const counts = award._assignmentCounts || { total: 0, nominated: 0, shortlisted: 0, winner: 0 };
      const countBadgeClass = counts.total === 0 ? 'zero' :
                             counts.total < 5 ? 'low' :
                             counts.total < 15 ? 'medium' : 'high';

      const fullName = utils.formatAwardName(award);

      // Winner display
      let winnerHtml = '<span class="text-muted small">-</span>';
      if (award._winnerName) {
        winnerHtml = `
          <div class="d-flex align-items-center gap-1">
            <span class="badge bg-success"><i class="bi bi-trophy-fill me-1"></i>Winner</span>
            <span class="small fw-semibold">${utils.escapeHtml(award._winnerName)}</span>
          </div>`;
        if (award._runnerUpName) {
          winnerHtml += `<div class="small text-muted mt-1"><i class="bi bi-award me-1"></i>${utils.escapeHtml(award._runnerUpName)}</div>`;
        }
      } else if (counts.shortlisted > 0) {
        winnerHtml = `<span class="badge bg-warning text-dark small"><i class="bi bi-star me-1"></i>${counts.shortlisted} shortlisted</span>`;
      }

      // Previous year defending champion
      if (award.prev_year_winner) {
        winnerHtml += `<div class="small text-muted mt-1" title="Previous year: 1st ${utils.escapeHtml(award.prev_year_winner)}${award.prev_year_2nd ? ', 2nd ' + utils.escapeHtml(award.prev_year_2nd) : ''}${award.prev_year_3rd ? ', 3rd ' + utils.escapeHtml(award.prev_year_3rd) : ''}"><i class="bi bi-clock-history me-1"></i>Prev: ${utils.escapeHtml(award.prev_year_winner)}</div>`;
      }

      return `
        <tr class="fade-in">
          <td><input type="checkbox" class="form-check-input award-select-cb" value="${award.id}" onchange="awardsModule.toggleSelection('${award.id}', this.checked)" ${this.selectedAwards.has(award.id) ? 'checked' : ''}></td>
          <td>
            <a href="javascript:void(0);"
               class="text-decoration-none fw-semibold text-primary"
               onclick="assignmentsModule.openAssignmentsModal('${award.id}', '${utils.escapeHtml(fullName).replace(/'/g, "\\'")}')">
              ${utils.escapeHtml(fullName)}
            </a>
          </td>
          <td>
            <span class="badge bg-info-subtle text-info">
              <i class="bi bi-briefcase me-1"></i>${utils.escapeHtml(award.sector || '-')}
            </span>
          </td>
          <td>${utils.getStatusBadge(award.status || 'Draft')}</td>
          <td class="text-center">
            <div class="assignment-count-badge ${countBadgeClass}"
              style="cursor: pointer;"
              onclick="assignmentsModule.openAssignmentsModal('${award.id}', '${utils.escapeHtml(fullName).replace(/'/g, "\\'")}')"
              title="Click to view: ${counts.nominated} nominated, ${counts.shortlisted} shortlisted, ${counts.winner} winner">
              <i class="bi bi-people-fill"></i>
              <span>${counts.total}</span>
            </div>
          </td>
          <td>${winnerHtml}</td>
          <td class="text-center">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-primary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                <i class="bi bi-gear"></i>
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
                <li><hr class="dropdown-divider"></li>
                <li>
                  <a class="dropdown-item text-danger" href="javascript:void(0);" onclick="if(confirm('Are you sure you want to delete this award?')) awardsModule.deleteAward('${award.id}')">
                    <i class="bi bi-trash me-2"></i>Delete
                  </a>
                </li>
              </ul>
            </div>
          </td>
        </tr>
      `;
    }).join('');
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
   * Approve an award
   * @param {string} awardId - Award ID
   */
  async approve(awardId) {
    if (!utils.confirm('Are you sure you want to approve this award?')) {
      return;
    }
    
    try {
      utils.showLoading();
      
      const { error } = await STATE.client
        .from('awards')
        .update({ status: STATUS.APPROVED })
        .eq('id', awardId);
      
      if (error) throw error;
      
      await this.loadAwards();
      utils.showToast('Award approved successfully!', 'success');
      
    } catch (error) {
      console.error('Error approving award:', error);
      utils.showToast('Failed to approve award: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Delete an award
   * @param {string} awardId - Award ID
   */
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
      description: document.getElementById('awardFormDescription').value.trim() || null
    };

    // Validate date order
    const dateError = this.validateDates(awardData);
    if (dateError) {
      utils.showToast('Date order error: ' + dateError, 'error');
      return;
    }

    try {
      utils.showLoading();

      // Duplicate prevention: check for same award_name + county + year (on create only)
      if (!id) {
        const { data: existing } = await STATE.client
          .from('awards')
          .select('id')
          .eq('award_name', awardData.award_name)
          .eq('county', awardData.county)
          .eq('year', awardData.year)
          .limit(1);

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
   * Export filtered awards to CSV
   */
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

  exportAwards() {
    const awards = STATE.filteredAwards;
    if (awards.length === 0) {
      utils.showToast('No awards to export', 'warning');
      return;
    }

    const headers = ['Award Name', 'Category', 'County/City', 'Sector', 'Year', 'Status', 'Nominees', 'Winner'];
    const rows = awards.map(a => {
      const counts = a._assignmentCounts || { total: 0 };
      return [
        utils.formatAwardName(a),
        a.award_name || '',
        a.county || '',
        a.sector || '',
        a.year || '',
        a.status || '',
        counts.total,
        a._winnerName || ''
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

  async deleteAward(awardId) {
    if (!utils.confirm('Are you sure you want to delete this award? This action cannot be undone.')) {
      return;
    }
    
    try {
      utils.showLoading();
      
      const { error } = await STATE.client
        .from('awards')
        .delete()
        .eq('id', awardId);
      
      if (error) throw error;
      
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
   * Roll over awards from one year to the next as Inactive
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
    message += `All copied awards will be set to "Inactive" status, ready for vetting.\n`;
    message += `Dates will be cleared so you can set new season dates.`;

    if (existingTarget.length > 0) {
      message += `\n\n⚠️ ${targetYear} already has ${existingTarget.length} awards. Only NEW award names (not already in ${targetYear}) will be copied.`;
    }

    if (!confirm(message)) return;

    try {
      utils.showLoading();

      // Get existing award names for target year to avoid duplicates
      const existingNames = new Set(existingTarget.map(a => a.award_name));

      // Filter out awards that already exist in the target year
      const awardsToRoll = sourceAwards.filter(a => !existingNames.has(a.award_name));

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

      // Build new award records — copy structure, clear dates, set Inactive, tag prev year results
      const newAwards = awardsToRoll.map(a => {
        const prevWinners = winnersMap[a.id] || {};
        return {
          award_name: a.award_name,
          county: a.county,
          sector: a.sector,
          year: targetYear,
          status: 'Inactive',
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
      let msg = `${newAwards.length} awards rolled over to ${targetYear} as Inactive!`;
      if (withWinners > 0) msg += ` (${withWinners} with previous year results)`;
      utils.showToast(msg, 'success');
      await this.loadAwards();

    } catch (error) {
      console.error('Error rolling over awards:', error);
      utils.showToast('Failed to roll over awards: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  }
};

// Export to window for global access
window.awardsModule = awardsModule;