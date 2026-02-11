/* ==================================================== */
/* AWARDS MODULE */
/* ==================================================== */

const awardsModule = {
 /**
 * Load all awards from database
 */
async loadAwards() {
  try {
    utils.showLoading();
    utils.showTableLoading('awardsTableBody', 6); // 6 columns

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
    utils.showEmptyState('awardsTableBody', 6, 'Failed to load awards', 'bi-exclamation-triangle');
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
      utils.showEmptyState('awardsTableBody', 6, 'No awards found matching your filters');
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

      return `
        <tr class="fade-in">
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
            <h6 class="text-muted mb-3"><i class="bi bi-calendar me-2"></i>Important Dates</h6>
            <table class="table table-sm">
              <tr>
                <th width="40%">Entry Open:</th>
                <td>${award.entry_open_date ? new Date(award.entry_open_date).toLocaleDateString('en-GB') : 'N/A'}</td>
              </tr>
              <tr>
                <th>Entry Close:</th>
                <td>${award.entry_close_date ? new Date(award.entry_close_date).toLocaleDateString('en-GB') : 'N/A'}</td>
              </tr>
              <tr>
                <th>Judging Date:</th>
                <td>${award.judging_date ? new Date(award.judging_date).toLocaleDateString('en-GB') : 'N/A'}</td>
              </tr>
              <tr>
                <th>Announcement:</th>
                <td>${award.announcement_date ? new Date(award.announcement_date).toLocaleDateString('en-GB') : 'N/A'}</td>
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
   * Open create award modal
   */
  openCreateModal() {
    document.getElementById('awardFormId').value = '';
    document.getElementById('awardFormName').value = '';
    document.getElementById('awardFormYear').value = new Date().getFullYear();
    document.getElementById('awardFormStatus').value = 'Active';
    document.getElementById('awardFormEntryOpen').value = '';
    document.getElementById('awardFormEntryClose').value = '';
    document.getElementById('awardFormJudging').value = '';
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
    document.getElementById('awardFormJudging').value = award.judging_date || '';
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

    const modal = new bootstrap.Modal(document.getElementById('awardFormModal'));
    modal.show();
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
      judging_date: document.getElementById('awardFormJudging').value || null,
      description: document.getElementById('awardFormDescription').value.trim() || null
    };

    try {
      utils.showLoading();

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
  }
};

// Export to window for global access
window.awardsModule = awardsModule;