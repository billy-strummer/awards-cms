/* ==================================================== */
/* ORGANISATIONS MODULE - ENHANCED VERSION */
/* ==================================================== */

const orgsModule = {
  
  // ============================================
  // State management for bulk operations
  // ============================================
  selectedOrgs: new Set(),
  sortField: null,
  sortDirection: 'asc',
  currentEditingOrg: null,
  originalOrgData: null,
  currentOrgIdForLogo: null,
  currentOrgIdForImages: null,

  /**
 * Load all organisations from database
 * ENHANCED: Now calculates dashboard stats
 */
async loadOrganisations() {
  try {
    utils.showLoading();
    utils.showTableLoading('orgsTableBody', 10);
    
    // Load all organisations using proper Supabase v2 pagination
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error } = await STATE.client
        .from('organisations')
        .select('*', { count: 'exact' })
        .range(from, to)
        .order('company_name', { ascending: true });
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allData = allData.concat(data);
        page++;
        // Page loaded
        
        if (data.length < pageSize) {
          hasMore = false;
        }
      }
    }
    
    // Load award assignments to get county/region/sector for each org
    const { data: assignments } = await STATE.client
      .from('award_assignments')
      .select('organisation_id, award_id');
    
    // Load awards with county
    const { data: awards } = await STATE.client
      .from('awards')
      .select('id, county, sector, year');
    
    // Load counties table to map county → region
    const { data: counties } = await STATE.client
      .from('counties')
      .select('Name, regions(name)');
    
    // Create county → region lookup
    const countyToRegion = {};
    counties?.forEach(c => {
      if (c.Name && c.regions?.name) {
        countyToRegion[c.Name] = c.regions.name;
      }
    });
    
    // Create lookup maps
    const orgAwardMap = {};      // org_id → first award_id (for county/region)
    const orgAwardsCount = {};   // org_id → total assignments count
    assignments?.forEach(a => {
      if (!orgAwardMap[a.organisation_id]) {
        orgAwardMap[a.organisation_id] = a.award_id;
      }
      orgAwardsCount[a.organisation_id] = (orgAwardsCount[a.organisation_id] || 0) + 1;
    });

    const awardMap = {};
    awards?.forEach(a => {
      awardMap[a.id] = a;
    });

    // Attach award data to organisations
    // Priority: award-derived county > org's catchment_area (set by CSV import)
    allData = allData.map(org => {
      const awardId = orgAwardMap[org.id];
      const award = awardMap[awardId];
      const awardCounty = award?.county || null;
      const county = awardCounty || org.catchment_area || null;
      const region = county ? (countyToRegion[county] || org.region) : (org.region || null);

      return {
        ...org,
        county: county,
        region: region,
        sector: award?.sector || org.sector || null,
        year: award?.year || null,
        awards_count: orgAwardsCount[org.id] || 0
      };
    });
    
    STATE.allOrganisations = allData;
    STATE.filteredOrganisations = STATE.allOrganisations;

    // NEW: Calculate and display dashboard stats
    await this.calculateDashboardStats();

    // Save current filter state in-memory before repopulating dropdowns
    const savedFilters = {
      year: document.getElementById('orgsYearFilter')?.value || '',
      sector: document.getElementById('orgsSectorFilter')?.value || '',
      region: document.getElementById('orgsRegionFilter')?.value || '',
      county: document.getElementById('orgsCountyFilter')?.value || '',
      status: document.getElementById('orgsStatusFilter')?.value || '',
      search: document.getElementById('orgsSearchBox')?.value || ''
    };

    // Populate filter dropdowns (resets selections)
    this.populateFilters();

    // Restore filter state: prefer in-memory values, fall back to localStorage
    const lsFilters = (() => { try { return JSON.parse(localStorage.getItem('orgsFilters') || '{}'); } catch (e) { return {}; } })();
    document.getElementById('orgsYearFilter').value = savedFilters.year || lsFilters.year || '';
    document.getElementById('orgsSectorFilter').value = savedFilters.sector || lsFilters.sector || '';
    if (savedFilters.region || lsFilters.region) {
      document.getElementById('orgsRegionFilter').value = savedFilters.region || lsFilters.region || '';
      this.updateCountyFilterByRegion();
    }
    document.getElementById('orgsCountyFilter').value = savedFilters.county || lsFilters.county || '';
    document.getElementById('orgsStatusFilter').value = savedFilters.status || lsFilters.status || '';
    document.getElementById('orgsSearchBox').value = savedFilters.search || lsFilters.search || '';

    this.filterOrganisations();
    this.populateSectorSuggestions();
    
  } catch (error) {
    console.error('Error loading organisations:', error);
    console.error('Error details:', error.details, error.hint, error.message);
    utils.showToast('Failed to load organisations: ' + error.message, 'error');
    utils.showEmptyState('orgsTableBody', 10, 'Failed to load organisations', 'bi-exclamation-triangle');
  } finally {
    utils.hideLoading();
  }
},
      
  // ============================================
  // Calculate dashboard statistics
  // ============================================
  async calculateDashboardStats() {
    try {
      const totalCount = STATE.allOrganisations.length;
      
      // Count unique organisations with award assignments
      const { data: assignments } = await STATE.client
        .from('award_assignments')
        .select('organisation_id');
      
      const uniqueOrgIds = new Set(assignments?.map(a => a.organisation_id) || []);
      const activeNominees = uniqueOrgIds.size;
      
      // Find top sector
      const sectorCounts = {};
      STATE.allOrganisations.forEach(org => {
        if (org.sector) {
          sectorCounts[org.sector] = (sectorCounts[org.sector] || 0) + 1;
        }
      });
      
      const topSectorEntry = Object.entries(sectorCounts)
        .sort((a, b) => b[1] - a[1])[0];
      const topSector = topSectorEntry ? topSectorEntry[0] : '-';
      const topSectorCount = topSectorEntry ? topSectorEntry[1] : 0;
      
      // Update dashboard UI
      const totalEl = document.getElementById('orgsTotalCount');
      const activeEl = document.getElementById('orgsWithAwards');
      const topSectorEl = document.getElementById('orgsTopSector');
      const lastUpdatedEl = document.getElementById('orgsLastUpdated');
      
      if (totalEl) totalEl.textContent = totalCount;
      if (activeEl) activeEl.textContent = activeNominees;
      if (topSectorEl) topSectorEl.textContent = topSector;
      if (lastUpdatedEl) lastUpdatedEl.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      
    } catch (error) {
      console.error('Error calculating dashboard stats:', error);
    }
  },

/**
 * Populate filter dropdowns with unique values
 */
populateFilters() {
  // Populate sector filter
  const sectors = [...new Set(STATE.allOrganisations
    .map(o => o.sector)
    .filter(s => s)
  )].sort();
  
  const sectorSelect = document.getElementById('orgsSectorFilter');
  if (sectorSelect) {
    sectorSelect.innerHTML = '<option value="">All</option>' +
      sectors.map(s => `<option value="${s}">${utils.escapeHtml(s)}</option>`).join('');
  }
  
  // Populate county filter
  const counties = [...new Set(STATE.allOrganisations
    .map(o => o.county)
    .filter(c => c)
  )].sort();

  const countySelect = document.getElementById('orgsCountyFilter');
  if (countySelect) {
    countySelect.innerHTML = '<option value="">All</option>' +
      counties.map(c => `<option value="${c}">${utils.escapeHtml(c)}</option>`).join('');
  }
  
  // Populate region filter
  const regions = [...new Set(STATE.allOrganisations
    .map(o => o.region)
    .filter(r => r)
  )].sort();
  
  const regionSelect = document.getElementById('orgsRegionFilter');
  if (regionSelect) {
    regionSelect.innerHTML = '<option value="">All Regions</option>' +
      regions.map(r => `<option value="${r}">${utils.escapeHtml(r)}</option>`).join('');
  }
},

/**
 * Restore saved filter values from localStorage
 */
restoreFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem('orgsFilters') || '{}');
    if (saved.year) {
      const el = document.getElementById('orgsYearFilter');
      if (el) el.value = saved.year;
    }
    if (saved.sector) {
      const el = document.getElementById('orgsSectorFilter');
      if (el) el.value = saved.sector;
    }
    if (saved.region) {
      const el = document.getElementById('orgsRegionFilter');
      if (el) el.value = saved.region;
      this.updateCountyFilterByRegion();
    }
    if (saved.county) {
      const el = document.getElementById('orgsCountyFilter');
      if (el) el.value = saved.county;
    }
    if (saved.status) {
      const el = document.getElementById('orgsStatusFilter');
      if (el) el.value = saved.status;
    }
    if (saved.search) {
      const el = document.getElementById('orgsSearchBox');
      if (el) el.value = saved.search;
    }
  } catch (e) { /* ignore */ }
},

/**
 * Update county dropdown based on selected region
 */
updateCountyFilterByRegion() {
  const selectedRegion = document.getElementById('orgsRegionFilter')?.value || '';
  const countySelect = document.getElementById('orgsCountyFilter');
  
  if (!countySelect) return;
  
  if (!selectedRegion) {
    // No region selected - show all counties
    const allCounties = [...new Set(STATE.allOrganisations
      .map(o => o.county)
      .filter(c => c)
    )].sort();
    
    countySelect.innerHTML = '<option value="">All Counties</option>' +
      allCounties.map(c => `<option value="${c}">${utils.escapeHtml(c)}</option>`).join('');
  } else {
    // Region selected - show only counties in that region
    const countiesInRegion = [...new Set(STATE.allOrganisations
      .filter(o => o.region === selectedRegion)
      .map(o => o.county)
      .filter(c => c)
    )].sort();
    
    countySelect.innerHTML = '<option value="">All Counties</option>' +
      countiesInRegion.map(c => `<option value="${c}">${utils.escapeHtml(c)}</option>`).join('');
  }
  
  // Reset county selection
  countySelect.value = '';
},

  /**
   * Filter organisations based on sector, region, and search
   */
  filterOrganisations() {
  const year = document.getElementById('orgsYearFilter')?.value || '';
  const sector = document.getElementById('orgsSectorFilter')?.value || '';
  const county = document.getElementById('orgsCountyFilter')?.value || '';
  const region = document.getElementById('orgsRegionFilter')?.value || '';
  const status = document.getElementById('orgsStatusFilter')?.value || '';
  const search = document.getElementById('orgsSearchBox')?.value.toLowerCase().trim() || '';

  // Save filters to localStorage
  try {
    localStorage.setItem('orgsFilters', JSON.stringify({ year, sector, county, region, status, search }));
  } catch (e) { /* ignore */ }

  // Hide archived by default unless status filter is 'archived' or 'all'
  const showArchived = status === 'archived' || status === 'all';

  STATE.filteredOrganisations = STATE.allOrganisations.filter(org => {
    const orgStatus = org.status || 'prospect';

    // Hide archived unless explicitly filtering for them
    if (!showArchived && orgStatus === 'archived') return false;

    // Year filter
    if (year && String(org.year || '') !== String(year)) return false;

    // Status filter (skip if 'all')
    if (status && status !== 'all' && orgStatus !== status) return false;

    // Sector filter
    if (sector && org.sector !== sector) return false;

    // County filter
    if (county && org.county !== county) return false;

    // Region filter
    if (region && org.region !== region) return false;

    // Search filter - searches ALL fields including county, sector, status
    if (search) {
      const searchFields = [
        org.company_name, org.contact_name, org.email, org.website,
        org.notes, org.county, org.sector, org.region,
        org.catchment_area, org.address, orgStatus
      ].map(f => (f || '').toLowerCase());

      if (!searchFields.some(f => f.includes(search))) {
        return false;
      }
    }

    return true;
  });

  this.renderOrganisations();
},

  /**
   * Render organisations table
   */
  renderOrganisations() {
  const tbody = document.getElementById('orgsTableBody');
  const count = document.getElementById('orgsCount');
  const showing = document.getElementById('orgsShowing');
  const total = document.getElementById('orgsTotal');
  const lastRefresh = document.getElementById('orgsLastRefresh');

  if (count) count.textContent = STATE.filteredOrganisations.length;
  if (showing) showing.textContent = STATE.filteredOrganisations.length;
  if (total) total.textContent = STATE.allOrganisations.length;
  if (lastRefresh) lastRefresh.textContent = new Date().toLocaleTimeString('en-GB');

  if (STATE.filteredOrganisations.length === 0) {
    // Build active filters summary
    const activeFilters = [];
    const year = document.getElementById('orgsYearFilter')?.value;
    const sector = document.getElementById('orgsSectorFilter')?.value;
    const region = document.getElementById('orgsRegionFilter')?.value;
    const county = document.getElementById('orgsCountyFilter')?.value;
    const status = document.getElementById('orgsStatusFilter')?.value;
    const search = document.getElementById('orgsSearchBox')?.value;
    if (year) activeFilters.push(`Year: <strong>${utils.escapeHtml(year)}</strong>`);
    if (sector) activeFilters.push(`Sector: <strong>${utils.escapeHtml(sector)}</strong>`);
    if (region) activeFilters.push(`Region: <strong>${utils.escapeHtml(region)}</strong>`);
    if (county) activeFilters.push(`County: <strong>${utils.escapeHtml(county)}</strong>`);
    if (status) activeFilters.push(`Status: <strong>${utils.escapeHtml(status)}</strong>`);
    if (search) activeFilters.push(`Search: <strong>"${utils.escapeHtml(search)}"</strong>`);

    const filterSummary = activeFilters.length > 0
      ? `<p class="text-muted small mt-2 mb-2">Active filters: ${activeFilters.join(' &middot; ')}</p>
         <button class="btn btn-sm btn-outline-primary" onclick="orgsModule.resetFilters()">
           <i class="bi bi-x-circle me-1"></i>Clear all filters
         </button>`
      : '';

    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="text-center py-5">
          <i class="bi bi-inbox display-4 text-muted opacity-25"></i>
          <p class="text-muted mt-3 mb-0">No organisations found</p>
          ${filterSummary}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = STATE.filteredOrganisations.map(org => {
    const isSelected = this.selectedOrgs.has(org.id);
    const awardsCount = org.awards_count || 0;
    const escapedName = utils.escapeHtml(org.company_name || '').replace(/'/g, "\\'");

    return `
      <tr class="fade-in ${isSelected ? 'table-active' : ''}">
        <td class="text-center">
          <input type="checkbox" class="form-check-input"
                 ${isSelected ? 'checked' : ''}
                 onchange="orgsModule.toggleOrgSelection('${org.id}')">
        </td>
        <td>
          <div class="d-flex align-items-center">
            ${org.logo_url ?
              `<img src="${org.logo_url}" alt="${utils.escapeHtml(org.company_name)}"
                   class="me-2 rounded" style="width: 40px; height: 28px; object-fit: contain; border: 1px solid #e0e0e0;">` :
              `<div class="me-2 d-flex align-items-center justify-content-center rounded"
                   style="width: 40px; height: 28px; background: #f5f5f5; border: 1px solid #e0e0e0;">
                <i class="bi bi-building text-muted" style="font-size: 0.8rem;"></i>
              </div>`
            }
            <a class="text-primary text-decoration-none fw-semibold"
               style="cursor: pointer;"
               onclick="orgsModule.openCompanyProfile('${org.id}', '${escapedName}')">
              ${utils.escapeHtml(org.company_name || 'N/A')}
            </a>
          </div>
        </td>
        <td style="cursor: pointer;" ondblclick="orgsModule.startInlineEdit('${org.id}', 'sector', '${utils.escapeHtml(org.sector || '').replace(/'/g, "\\'")}', this)" title="Double-click to edit">
          <span class="badge bg-info-subtle text-info small">
            ${utils.escapeHtml(org.sector || '-')}
          </span>
        </td>
        <td>
          <span class="badge bg-primary-subtle text-primary small">
            ${utils.escapeHtml(org.county || '-')}
          </span>
        </td>
        <td class="small" style="cursor: pointer;" ondblclick="orgsModule.startInlineEdit('${org.id}', 'contact', '${utils.escapeHtml(org.contact_name || '').replace(/'/g, "\\'")}', this)" title="Double-click to edit">
          ${utils.escapeHtml(org.contact_name ? (org.contact_name.length > 18 ? org.contact_name.substring(0, 18) + '...' : org.contact_name) : '-')}
        </td>
        <td class="small" style="cursor: pointer;" ondblclick="orgsModule.startInlineEdit('${org.id}', 'email', '${utils.escapeHtml(org.email || '').replace(/'/g, "\\'")}', this)" title="Double-click to edit">
          ${org.email ?
            `<a href="mailto:${org.email}" class="text-decoration-none" title="${utils.escapeHtml(org.email)}">
              ${org.email.length > 25 ? utils.escapeHtml(org.email.substring(0, 25)) + '...' : utils.escapeHtml(org.email)}
            </a>` : '-'
          }
        </td>
        <td class="small">
          ${org.website ?
            `<a href="${org.website.startsWith('http') ? org.website : 'https://' + org.website}"
                target="_blank" class="text-decoration-none" title="${utils.escapeHtml(org.website)}">
              ${(() => { const clean = org.website.replace(/https?:\/\/(www\.)?/, ''); return clean.length > 20 ? utils.escapeHtml(clean.substring(0, 20)) + '...' : utils.escapeHtml(clean); })()}
              <i class="bi bi-box-arrow-up-right ms-1" style="font-size: 0.7rem;"></i>
            </a>` : '-'
          }
        </td>
        <td>
          <span class="badge bg-success-subtle text-success small">
            ${utils.escapeHtml(org.region || '-')}
          </span>
        </td>
        <td class="text-center">
          <select class="form-select form-select-sm border-0 p-0 text-center"
                  style="font-size: 0.75rem; background-position: right 0.25rem center; padding-right: 1.2rem !important; cursor: pointer;"
                  onchange="orgsModule.quickUpdateStatus('${org.id}', this.value)"
                  title="Click to change status">
            ${this._getStatusOptions(org.status || 'prospect').map(s =>
              `<option value="${s.value}" ${(org.status || 'prospect') === s.value ? 'selected' : ''}>${s.label}</option>`
            ).join('')}
          </select>
        </td>
        <td class="text-center">
          ${awardsCount > 0 ?
            `<span class="badge bg-warning text-dark">${awardsCount}</span>` :
            `<span class="text-muted">-</span>`
          }
        </td>
        <td class="text-center">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-sm btn-outline-secondary"
                    onclick="orgsModule.openCompanyProfile('${org.id}', '${escapedName}')"
                    title="View Profile">
              <i class="bi bi-eye"></i>
            </button>
            ${(org.status || 'prospect') === 'archived'
              ? `<button class="btn btn-sm btn-outline-success"
                      onclick="orgsModule.restoreOrganisation('${org.id}', '${escapedName}')"
                      title="Restore"><i class="bi bi-arrow-counterclockwise"></i></button>`
              : `<button class="btn btn-sm btn-outline-danger"
                      onclick="orgsModule.deleteOrganisation('${org.id}', '${escapedName}')"
                      title="Archive"><i class="bi bi-archive"></i></button>`
            }
          </div>
        </td>
      </tr>
    `;
  }).join('');

    this.updateSortIndicators();
},
  /**
   * Open company profile modal
   * @param {string} orgId - Organisation ID
   * @param {string} companyName - Company name for display
   */

  async openCompanyProfile(orgId, companyName) {
    const modal = new bootstrap.Modal(document.getElementById('companyProfileModal'));
    const contentDiv = document.getElementById('companyProfileContent');
    const titleEl = document.getElementById('companyProfileModalLabel');
    const editBtn = document.getElementById('editOrgBtn');
    const saveBtn = document.getElementById('saveOrgBtn');
    const cancelBtn = document.getElementById('cancelEditOrgBtn');

    // Reset edit mode
    editBtn.style.display = 'none';
    saveBtn.style.display = 'none';
    cancelBtn.style.display = 'none';

    titleEl.innerHTML = `<i class="bi bi-building me-2"></i>${utils.escapeHtml(companyName)}`;
    contentDiv.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
    `;

    modal.show();

    // Increase z-index when opened from another modal (e.g., assignments modal)
    // This ensures the company profile modal appears on top
    const modalElement = document.getElementById('companyProfileModal');
    const backdrop = document.querySelector('.modal-backdrop');

    // Set higher z-index for modal and backdrop to appear above other modals
    setTimeout(() => {
      modalElement.style.zIndex = '1060';
      // Find the most recent backdrop (the one for this modal)
      const backdrops = document.querySelectorAll('.modal-backdrop');
      if (backdrops.length > 0) {
        backdrops[backdrops.length - 1].style.zIndex = '1059';
      }
    }, 10);

    try {
      // Fetch organisation details with related awards
      const { data: org, error: orgError } = await STATE.client
        .from('organisations')
        .select('*')
        .eq('id', orgId)
        .single();
      
      if (orgError) throw orgError;
      
      // Fetch related awards through award_assignments using explicit FK
      const { data: assignments, error: awardsError } = await STATE.client
        .from('award_assignments')
        .select(`
          status,
          awards!award_assignments_award_id_fkey (*)
        `)
        .eq('organisation_id', orgId);

      if (awardsError) throw awardsError;

      // Extract and sort awards, using assignment status instead of award status
      const awards = (assignments || [])
        .filter(a => a.awards)
        .map(a => ({
          ...a.awards,
          status: a.status, // Use assignment status (nominated/shortlisted/winner)
          package_type: 'bronze', // Default package type
          enhanced_profile: false // Default enhanced profile
        }))
        .sort((a, b) => (b.year || 0) - (a.year || 0));

      // Fetch media gallery items tagged to this organisation
      const { data: taggedMedia, error: mediaError } = await STATE.client
        .from('media_gallery')
        .select('*')
        .eq('organisation_id', orgId)
        .order('created_at', { ascending: false });

      if (mediaError) console.error('Error loading tagged media:', mediaError);

      // Fetch company images for marketing
      const { data: companyImages, error: imagesError } = await STATE.client
        .from('organisation_images')
        .select('*')
        .eq('organisation_id', orgId)
        .order('display_order', { ascending: true });

      if (imagesError) console.error('Error loading company images:', imagesError);

      // Fetch invoices for this organisation
      const { data: invoices, error: invoicesError } = await STATE.client
        .from('invoices')
        .select('*')
        .eq('organisation_id', orgId)
        .order('created_at', { ascending: false });

      if (invoicesError) console.error('Error loading invoices:', invoicesError);

      const invoicesSummary = {
        count: (invoices || []).length,
        totalAmount: (invoices || []).reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0),
        paidAmount: (invoices || []).reduce((sum, inv) => sum + parseFloat(inv.paid_amount || 0), 0),
        balanceDue: (invoices || []).reduce((sum, inv) => sum + parseFloat(inv.balance_due || 0), 0)
      };

      // Fetch entries with public voting enabled for this organisation
      const { data: votingEntries, error: entriesError } = await STATE.client
        .from('entries')
        .select(`
          *,
          award_years (award_name, year)
        `)
        .eq('organisation_id', orgId)
        .eq('allow_public_voting', true)
        .order('created_at', { ascending: false });

      if (entriesError) console.error('Error loading voting entries:', entriesError);

      // Render profile
      contentDiv.innerHTML = `
        <div class="row">
          <div class="col-md-4 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-image me-2"></i>Company Logo</h6>
            <div class="card">
              <div class="card-body text-center">
                ${org.logo_url ?
                  `<img src="${org.logo_url}" alt="${utils.escapeHtml(org.company_name)}"
                    class="mb-3" style="width: 250px; height: 170px; object-fit: contain; border: 1px solid #dee2e6; border-radius: 4px; background: #f8f9fa;">` :
                  `<div class="text-muted mb-3" style="width: 250px; height: 170px; display: flex; align-items: center; justify-content: center; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px;">
                    <i class="bi bi-image" style="font-size: 3rem;"></i>
                  </div>`
                }
                <input type="file" id="logoUploadInput" class="form-control form-control-sm mb-2"
                  accept="image/*" onchange="orgsModule.validateAndUploadLogo('${org.id}', this)">
                <button type="button" class="btn btn-sm btn-outline-primary w-100 mb-2"
                  onclick="orgsModule.openLogoGalleryModal('${org.id}')">
                  <i class="bi bi-images me-1"></i>Choose from Media Gallery
                </button>
                ${org.website ?
                  `<button type="button" class="btn btn-sm btn-outline-success w-100 mb-2"
                    onclick="orgsModule.fetchLogoFromWebsite('${org.id}')">
                    <i class="bi bi-globe me-1"></i>Fetch from Website
                  </button>` : ''
                }
                <small class="text-muted">Required: 250x170 px</small>
              </div>
            </div>
          </div>

          <div class="col-md-4 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-person me-2"></i>Contact Information</h6>
            <div class="card">
              <div class="card-body">
                <div class="mb-2">
                  <strong>Contact Name:</strong>
                  <span class="view-mode" id="viewContactName">${utils.escapeHtml(org.contact_name || 'N/A')}</span>
                  <input type="text" class="form-control form-control-sm edit-mode" id="editContactName"
                    value="${utils.escapeHtml(org.contact_name || '')}" style="display: none;">
                </div>
                <div class="mb-2">
                  <strong>Email:</strong>
                  <span class="view-mode" id="viewEmail">
                    ${org.email ? `<a href="mailto:${org.email}">${utils.escapeHtml(org.email)}</a>` : 'N/A'}
                  </span>
                  <input type="email" class="form-control form-control-sm edit-mode" id="editEmail"
                    value="${utils.escapeHtml(org.email || '')}" style="display: none;">
                </div>
                <div class="mb-2">
                  <strong>Phone:</strong>
                  <span class="view-mode" id="viewPhone">${utils.escapeHtml(org.contact_phone || 'N/A')}</span>
                  <input type="text" class="form-control form-control-sm edit-mode" id="editPhone"
                    value="${utils.escapeHtml(org.contact_phone || '')}" style="display: none;">
                </div>
                <div class="mb-0">
                  <strong>Website:</strong>
                  <span class="view-mode" id="viewWebsite">
                    ${org.website ?
                      `<a href="${org.website.startsWith('http://') || org.website.startsWith('https://') ? org.website : 'https://' + org.website}" target="_blank" rel="noopener noreferrer">
                        ${utils.escapeHtml(org.website)} <i class="bi bi-box-arrow-up-right small"></i>
                      </a>` : 'N/A'}
                  </span>
                  <input type="url" class="form-control form-control-sm edit-mode" id="editWebsite"
                    value="${utils.escapeHtml(org.website || '')}" style="display: none;" placeholder="e.g., https://example.com">
                </div>
              </div>
            </div>
          </div>

          <div class="col-md-4 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-geo-alt me-2"></i>Location</h6>
            <div class="card">
              <div class="card-body">
                <div class="mb-2">
                  <strong>Region:</strong>
                  <span class="view-mode" id="viewRegion">
                    <span class="badge bg-success-subtle text-success">${utils.escapeHtml(org.region || 'N/A')}</span>
                  </span>
                  <select class="form-select form-select-sm edit-mode" id="editRegion" style="display: none;">
                    <option value="">Select Region</option>
                    ${REGIONS.map(r => `<option value="${r}" ${org.region === r ? 'selected' : ''}>${r}</option>`).join('')}
                  </select>
                </div>
                <div class="mb-2">
                  <strong>Address:</strong>
                  <span class="view-mode" id="viewAddress">${utils.escapeHtml(org.address || 'N/A')}</span>
                  <textarea class="form-control form-control-sm edit-mode" id="editAddress"
                    rows="3" style="display: none;">${utils.escapeHtml(org.address || '')}</textarea>
                </div>
                <div class="mb-0">
                  <strong>Catchment Area:</strong>
                  <span class="view-mode" id="viewCatchmentArea">${utils.escapeHtml(org.catchment_area || 'N/A')}</span>
                  <textarea class="form-control form-control-sm edit-mode" id="editCatchmentArea"
                    rows="3" style="display: none;" placeholder="e.g., London, Southeast England, National">${utils.escapeHtml(org.catchment_area || '')}</textarea>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Status & Notes Row -->
        <div class="row mt-3">
          <div class="col-md-6 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-flag me-2"></i>Company Status</h6>
            <div class="card">
              <div class="card-body">
                <div class="d-flex flex-wrap gap-1">
                  ${['prospect','entrant','nominee','shortlisted','winner','sponsor','past_winner'].map(s => `
                    <button class="btn btn-sm ${org.status === s ? 'btn-primary' : 'btn-outline-secondary'}"
                      onclick="orgsModule.updateOrgStatus('${org.id}', '${s}')">
                      ${s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-6 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-journal-text me-2"></i>Internal Notes</h6>
            <div class="card">
              <div class="card-body">
                <textarea class="form-control mb-2" id="editOrgNotes" rows="3"
                  placeholder="Add internal notes about this company...">${utils.escapeHtml(org.notes || '')}</textarea>
                <button class="btn btn-sm btn-primary" onclick="orgsModule.saveOrgNotes('${org.id}')">
                  <i class="bi bi-save me-1"></i>Save Notes
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Company Details Section -->
        <div class="row mt-3">
          <div class="col-md-6 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-info-circle me-2"></i>Company Details</h6>
            <div class="card">
              <div class="card-body">
                <div class="mb-2">
                  <strong>Description:</strong>
                  <span class="view-mode" id="viewDescription">${utils.escapeHtml(org.description || 'N/A')}</span>
                  <textarea class="form-control form-control-sm edit-mode" id="editDescription" rows="3" style="display: none;">${utils.escapeHtml(org.description || '')}</textarea>
                </div>
                <div class="mb-2">
                  <strong>Achievements:</strong>
                  <span class="view-mode" id="viewAchievements">${utils.escapeHtml(org.achievements || 'N/A')}</span>
                  <textarea class="form-control form-control-sm edit-mode" id="editAchievements" rows="3" style="display: none;">${utils.escapeHtml(org.achievements || '')}</textarea>
                </div>
                <div class="row">
                  <div class="col-6 mb-2">
                    <strong>Company Size:</strong>
                    <span class="view-mode" id="viewCompanySize">${utils.escapeHtml(org.company_size || 'N/A')}</span>
                    <select class="form-select form-select-sm edit-mode" id="editCompanySize" style="display: none;">
                      <option value="">Select</option>
                      ${['1-10','11-50','51-200','201-500','500+'].map(s => `<option value="${s}" ${org.company_size === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                  </div>
                  <div class="col-6 mb-2">
                    <strong>Employees:</strong>
                    <span class="view-mode" id="viewEmployeeCount">${org.employee_count || 'N/A'}</span>
                    <input type="number" class="form-control form-control-sm edit-mode" id="editEmployeeCount" value="${org.employee_count || ''}" style="display: none;" min="0">
                  </div>
                </div>
                <div class="row">
                  <div class="col-6 mb-2">
                    <strong>Year Founded:</strong>
                    <span class="view-mode" id="viewYearFounded">${org.year_founded || 'N/A'}</span>
                    <input type="number" class="form-control form-control-sm edit-mode" id="editYearFounded" value="${org.year_founded || ''}" style="display: none;" min="1800" max="2026">
                  </div>
                  <div class="col-6 mb-2">
                    <strong>Tier:</strong>
                    <span class="view-mode" id="viewTier">
                      ${org.tier ? `<span class="badge bg-warning-subtle text-warning">${utils.escapeHtml(org.tier)}</span>` : 'N/A'}
                    </span>
                    <select class="form-select form-select-sm edit-mode" id="editTier" style="display: none;">
                      <option value="">None</option>
                      ${['Bronze','Silver','Gold','Platinum'].map(t => `<option value="${t}" ${org.tier === t ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                  </div>
                </div>
                <div class="mb-0">
                  <strong>Annual Revenue:</strong>
                  <span class="view-mode" id="viewAnnualRevenue">${org.annual_revenue ? '£' + Number(org.annual_revenue).toLocaleString() : 'N/A'}</span>
                  <input type="number" class="form-control form-control-sm edit-mode" id="editAnnualRevenue" value="${org.annual_revenue || ''}" style="display: none;" min="0" step="1000" placeholder="e.g. 500000">
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-6 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-share me-2"></i>Social Media & Tags</h6>
            <div class="card">
              <div class="card-body">
                <div class="mb-2">
                  <strong><i class="bi bi-linkedin text-primary me-1"></i>LinkedIn:</strong>
                  <span class="view-mode" id="viewLinkedin">
                    ${org.linkedin_url ? `<a href="${utils.escapeHtml(org.linkedin_url)}" target="_blank" class="text-decoration-none">${utils.escapeHtml(org.linkedin_url.replace(/https?:\/\/(www\.)?linkedin\.com\//, ''))}</a>` : 'N/A'}
                  </span>
                  <input type="url" class="form-control form-control-sm edit-mode" id="editLinkedin" value="${utils.escapeHtml(org.linkedin_url || '')}" style="display: none;" placeholder="https://linkedin.com/company/...">
                </div>
                <div class="mb-2">
                  <strong><i class="bi bi-twitter-x me-1"></i>X/Twitter:</strong>
                  <span class="view-mode" id="viewTwitter">
                    ${org.twitter_url ? `<a href="${utils.escapeHtml(org.twitter_url)}" target="_blank" class="text-decoration-none">${utils.escapeHtml(org.twitter_url.replace(/https?:\/\/(www\.)?(twitter|x)\.com\//, '@'))}</a>` : 'N/A'}
                  </span>
                  <input type="url" class="form-control form-control-sm edit-mode" id="editTwitter" value="${utils.escapeHtml(org.twitter_url || '')}" style="display: none;" placeholder="https://x.com/...">
                </div>
                <div class="mb-2">
                  <strong><i class="bi bi-facebook text-primary me-1"></i>Facebook:</strong>
                  <span class="view-mode" id="viewFacebook">
                    ${org.facebook_url ? `<a href="${utils.escapeHtml(org.facebook_url)}" target="_blank" class="text-decoration-none">${utils.escapeHtml(org.facebook_url.replace(/https?:\/\/(www\.)?facebook\.com\//, ''))}</a>` : 'N/A'}
                  </span>
                  <input type="url" class="form-control form-control-sm edit-mode" id="editFacebook" value="${utils.escapeHtml(org.facebook_url || '')}" style="display: none;" placeholder="https://facebook.com/...">
                </div>
                <div class="mb-2">
                  <strong><i class="bi bi-instagram text-danger me-1"></i>Instagram:</strong>
                  <span class="view-mode" id="viewInstagram">
                    ${org.instagram_url ? `<a href="${utils.escapeHtml(org.instagram_url)}" target="_blank" class="text-decoration-none">${utils.escapeHtml(org.instagram_url.replace(/https?:\/\/(www\.)?instagram\.com\//, '@'))}</a>` : 'N/A'}
                  </span>
                  <input type="url" class="form-control form-control-sm edit-mode" id="editInstagram" value="${utils.escapeHtml(org.instagram_url || '')}" style="display: none;" placeholder="https://instagram.com/...">
                </div>
                <hr class="my-2">
                <div class="mb-0">
                  <strong><i class="bi bi-tags me-1"></i>Tags:</strong>
                  <div id="orgTagsContainer">
                    ${(org.tags && org.tags.length > 0)
                      ? org.tags.map(t => `<span class="badge bg-secondary me-1 mb-1">${utils.escapeHtml(t)} <a href="javascript:void(0);" class="text-white ms-1" onclick="orgsModule.removeTag('${org.id}', '${utils.escapeHtml(t).replace(/'/g, "\\'")}')"><i class="bi bi-x-circle-fill"></i></a></span>`).join('')
                      : '<span class="text-muted small">No tags</span>'
                    }
                  </div>
                  <div class="input-group input-group-sm mt-2">
                    <input type="text" class="form-control" id="newTagInput" placeholder="Add tag..." onkeydown="if(event.key==='Enter'){event.preventDefault();orgsModule.addTag('${org.id}');}">
                    <button class="btn btn-outline-primary" onclick="orgsModule.addTag('${org.id}')"><i class="bi bi-plus"></i></button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        ${invoicesSummary.count > 0 ?
          `<div class="mt-4">
            <h6 class="text-muted mb-3"><i class="bi bi-receipt me-2"></i>Billing & Invoices</h6>
            <div class="card">
              <div class="card-body">
                <div class="row align-items-center">
                  <div class="col-md-8">
                    <div class="row text-center">
                      <div class="col-3">
                        <div class="text-muted small">Total Invoices</div>
                        <div class="fw-bold fs-5">${invoicesSummary.count}</div>
                      </div>
                      <div class="col-3">
                        <div class="text-muted small">Total Amount</div>
                        <div class="fw-bold fs-5">£${invoicesSummary.totalAmount.toFixed(2)}</div>
                      </div>
                      <div class="col-3">
                        <div class="text-muted small">Paid</div>
                        <div class="fw-bold fs-5 text-success">£${invoicesSummary.paidAmount.toFixed(2)}</div>
                      </div>
                      <div class="col-3">
                        <div class="text-muted small">Balance Due</div>
                        <div class="fw-bold fs-5 ${invoicesSummary.balanceDue > 0 ? 'text-danger' : 'text-muted'}">£${invoicesSummary.balanceDue.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                  <div class="col-md-4 text-end">
                    <button type="button" class="btn btn-primary"
                      onclick="orgsModule.viewOrganisationInvoices('${org.id}', '${utils.escapeHtml(org.company_name).replace(/'/g, "\\'")}')">
                      <i class="bi bi-file-earmark-text me-2"></i>View All Invoices
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>` : ''
        }

        <div class="mt-4">
          <h6 class="text-muted mb-3"><i class="bi bi-trophy me-2"></i>Award History (${awards.length})</h6>
          ${awards.length === 0 ?
            '<div class="alert alert-info">No awards found for this organisation.</div>' :
            `<div class="table-responsive">
              <table class="table table-sm table-hover">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Category</th>
                    <th>Sector</th>
                    <th>Status</th>
                    <th>Package</th>
                    <th class="text-center">Enhanced</th>
                  </tr>
                </thead>
                <tbody>
                  ${awards.map(award => `
                    <tr>
                      <td><span class="badge bg-primary-subtle text-primary">${award.year}</span></td>
                      <td>
                        <a href="javascript:void(0);"
                           class="text-decoration-none fw-semibold text-primary"
                           onclick="assignmentsModule.openAssignmentsModal('${award.id}', '${utils.escapeHtml(utils.formatAwardName(award)).replace(/'/g, "\\'")}')">
                          ${utils.escapeHtml(utils.formatAwardName(award))}
                        </a>
                      </td>
                      <td><span class="badge bg-info-subtle text-info">${utils.escapeHtml(award.sector)}</span></td>
                      <td>${utils.getStatusBadge(award.status)}</td>
                      <td>
                        ${['bronze', 'silver', 'gold'].includes(award.package_type) ?
                          `<a href="javascript:void(0);"
                              onclick="orgsModule.openCompanyProfile('${org.id}', '${utils.escapeHtml(org.company_name).replace(/'/g, "\\'")}')">
                              ${orgsModule.getPackageBadge(award.package_type)}
                           </a>` :
                          '<span class="text-muted">-</span>'
                        }
                      </td>
                      <td class="text-center">
                        ${award.enhanced_profile ?
                          '<i class="bi bi-star-fill text-warning" title="Enhanced Profile" style="font-size: 1.2rem;"></i>' :
                          '<i class="bi bi-star text-muted" title="Standard Profile" style="font-size: 1.2rem; opacity: 0.3;"></i>'
                        }
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>`
          }
        </div>

        ${votingEntries && votingEntries.length > 0 ?
          `<div class="mt-4">
            <h6 class="text-muted mb-3"><i class="bi bi-link-45deg me-2"></i>Public Voting Links (${votingEntries.length})</h6>
            <div class="card">
              <div class="card-body">
                <div class="alert alert-info mb-3">
                  <i class="bi bi-info-circle me-2"></i>
                  Share these voting links with the company so they can gather public votes
                </div>
                <div class="table-responsive">
                  <table class="table table-sm table-hover">
                    <thead>
                      <tr>
                        <th>Entry #</th>
                        <th>Award</th>
                        <th>Entry Title</th>
                        <th>Votes</th>
                        <th>Voting Link</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${votingEntries.map(entry => {
                        const votingUrl = `${window.location.origin}/vote.html?entry=${entry.entry_number}`;
                        return `
                          <tr>
                            <td><span class="badge bg-primary">${utils.escapeHtml(entry.entry_number)}</span></td>
                            <td>
                              <strong>${utils.escapeHtml(entry.award_years ? utils.formatAwardName(entry.award_years) : 'N/A')}</strong>
                            </td>
                            <td>${utils.escapeHtml(entry.entry_title || 'N/A')}</td>
                            <td>
                              <span class="badge bg-success-subtle text-success">
                                <i class="bi bi-hand-thumbs-up me-1"></i>${entry.vote_count || 0} votes
                              </span>
                            </td>
                            <td>
                              <div class="input-group input-group-sm" style="max-width: 400px;">
                                <input type="text" class="form-control" value="${votingUrl}" readonly id="votingUrl_${entry.id}">
                                <button class="btn btn-outline-primary" type="button"
                                  onclick="navigator.clipboard.writeText('${votingUrl}'); utils.showToast('Voting link copied!', 'success');">
                                  <i class="bi bi-clipboard"></i>
                                </button>
                              </div>
                            </td>
                            <td>
                              <a href="${votingUrl}" target="_blank" class="btn btn-sm btn-outline-success" title="Open voting page">
                                <i class="bi bi-box-arrow-up-right"></i>
                              </a>
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>` : ''
        }

        <!-- Enhanced Winner Profile Section -->
        <div class="mt-4">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="text-muted mb-0"><i class="bi bi-star-fill me-2"></i>Enhanced Winner Profile</h6>
            <div class="btn-group btn-group-sm" role="group">
              <button type="button"
                class="btn ${org.winner_profile_status === 'published' ? 'btn-success' : 'btn-outline-success'}"
                onclick="orgsModule.setWinnerProfileStatus('${org.id}', 'published')">
                <i class="bi bi-check-circle me-1"></i>Published
              </button>
              <button type="button"
                class="btn ${org.winner_profile_status === 'draft' || !org.winner_profile_status ? 'btn-secondary' : 'btn-outline-secondary'}"
                onclick="orgsModule.setWinnerProfileStatus('${org.id}', 'draft')">
                <i class="bi bi-file-earmark me-1"></i>Draft
              </button>
            </div>
          </div>

          <div class="card">
            <div class="card-body">
              <form id="winnerProfileForm">
                <div class="mb-3">
                  <label class="form-label fw-semibold">Introduction</label>
                  <textarea
                    id="winnerIntro"
                    class="form-control"
                    rows="6"
                    placeholder="Enter winner introduction and achievements...">${utils.escapeHtml(org.winner_intro || '')}</textarea>
                  <small class="text-muted">Rich text displayed on Award page and winner modal</small>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label fw-semibold">YouTube Video ID</label>
                    <input
                      type="text"
                      id="winnerVideoId"
                      class="form-control"
                      placeholder="e.g., dQw4w9WgXcQ"
                      value="${utils.escapeHtml(org.winner_video_id || '')}">
                    <small class="text-muted">Extract from: youtube.com/watch?v=<strong>VIDEO_ID</strong></small>
                  </div>

                  <div class="col-md-6 mb-3">
                    <label class="form-label fw-semibold">Vote for Us Page URL</label>
                    <input
                      type="url"
                      id="winnerVoteUrl"
                      class="form-control"
                      placeholder="https://example.com/vote-for-us"
                      value="${utils.escapeHtml(org.winner_vote_url || '')}">
                    <small class="text-muted">Public voting page link</small>
                  </div>
                </div>

                <div class="d-flex gap-2">
                  <button type="button" class="btn btn-primary" onclick="orgsModule.saveWinnerProfile('${org.id}')">
                    <i class="bi bi-save me-2"></i>Save Profile
                  </button>
                  <button type="button" class="btn btn-secondary" onclick="orgsModule.cancelWinnerProfile('${org.id}', '${utils.escapeHtml(org.company_name || '').replace(/'/g, "\\'")}')">
                    <i class="bi bi-x-circle me-2"></i>Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <!-- Company Images Section (for Marketing) -->
        <div class="mt-4">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="text-muted mb-0"><i class="bi bi-images me-2"></i>Company Images for Marketing (${(companyImages || []).length})</h6>
            <button type="button" class="btn btn-sm btn-primary" onclick="orgsModule.openUploadImagesModal('${org.id}')">
              <i class="bi bi-cloud-upload me-1"></i>Upload Images
            </button>
          </div>
          ${!companyImages || companyImages.length === 0 ?
            '<div class="alert alert-info"><i class="bi bi-info-circle me-2"></i>No marketing images uploaded yet. Click "Upload Images" to add photos for email campaigns.</div>' :
            `<div class="row g-3">
              ${companyImages.map(img => `
                <div class="col-md-3">
                  <div class="card h-100">
                    <img src="${img.file_url}" class="card-img-top" alt="${utils.escapeHtml(img.title || 'Company Image')}"
                      style="height: 180px; object-fit: cover; cursor: pointer;"
                      onclick="orgsModule.viewImageFull('${img.file_url}', '${utils.escapeHtml(img.title || 'Company Image')}')">
                    <div class="card-body p-2">
                      <p class="card-text small mb-1 fw-semibold">${utils.escapeHtml(img.title || 'Untitled')}</p>
                      ${img.caption ? `<p class="card-text small text-muted mb-2">${utils.escapeHtml(img.caption)}</p>` : ''}
                      <button class="btn btn-sm btn-outline-danger w-100"
                        onclick="orgsModule.deleteCompanyImage('${img.id}', '${org.id}')">
                        <i class="bi bi-trash me-1"></i>Delete
                      </button>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>`
          }
        </div>

        <!-- Tagged Media Gallery Section -->
        <div class="mt-4">
          <h6 class="text-muted mb-3"><i class="bi bi-images me-2"></i>Tagged Media Gallery (${(taggedMedia || []).length})</h6>
          ${!taggedMedia || taggedMedia.length === 0 ?
            '<div class="alert alert-info">No media tagged to this organisation yet. Upload photos/videos in the Media Gallery tab and tag them to this company.</div>' :
            `<div class="row g-3">
              ${taggedMedia.map(media => {
                const isImage = media.file_type?.startsWith('image/');
                const isYouTube = media.file_type === 'video/youtube';
                const eventName = media.events?.event_name || 'Unknown Event';
                const eventYear = media.events?.year || media.events?.event_date?.substring(0, 4) || '';

                return `
                  <div class="col-md-3">
                    <div class="card h-100">
                      ${isImage ?
                        `<img src="${media.file_url}" class="card-img-top" alt="${utils.escapeHtml(media.title || 'Media')}" style="height: 150px; object-fit: cover;">` :
                        isYouTube ?
                        `<div class="card-img-top" style="height: 150px; position: relative;">
                          <img src="https://img.youtube.com/vi/${media.file_url}/mqdefault.jpg"
                            alt="${utils.escapeHtml(media.title || 'YouTube Video')}"
                            style="width: 100%; height: 100%; object-fit: cover;">
                          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
                            <i class="bi bi-youtube text-danger" style="font-size: 2.5rem; filter: drop-shadow(0 0 10px rgba(0,0,0,0.5));"></i>
                          </div>
                        </div>` :
                        `<div class="card-img-top d-flex align-items-center justify-content-center bg-dark" style="height: 150px;">
                          <i class="bi bi-play-circle text-white" style="font-size: 3rem;"></i>
                        </div>`
                      }
                      <div class="card-body p-2">
                        <p class="card-text small mb-1 fw-semibold">${utils.escapeHtml(media.title || 'Untitled')}</p>
                        <p class="card-text small text-muted mb-0">
                          <i class="bi bi-calendar-event me-1"></i>${utils.escapeHtml(eventName)}${eventYear ? ` (${eventYear})` : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>`
          }
        </div>
      `;

      // Store current org data for editing
      this.currentEditingOrg = org;
      this.originalOrgData = { ...org };

      // Show edit button
      editBtn.style.display = 'inline-block';

      // Setup edit button event listener
      editBtn.onclick = () => this.enableEditMode(orgId);
      saveBtn.onclick = () => this.saveOrgChanges(orgId);
      cancelBtn.onclick = () => this.cancelEditMode(orgId, companyName);

    } catch (error) {
      console.error('Error loading company profile:', error);
      contentDiv.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>
          Failed to load company profile: ${error.message}
        </div>
      `;
    }
  },

  /**
   * Validate and upload company logo
   * @param {string} orgId - Organisation ID
   * @param {HTMLInputElement} inputElement - File input element
   */
  async validateAndUploadLogo(orgId, inputElement) {
    const file = inputElement.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      utils.showToast('Please select an image file', 'error');
      inputElement.value = '';
      return;
    }

    // Create an image to check dimensions
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = async () => {
        // Validate dimensions (exactly 250x170 px)
        if (img.width !== 250 || img.height !== 170) {
          utils.showToast(`Image must be exactly 250x170 px. Your image is ${img.width}x${img.height} px`, 'error');
          inputElement.value = '';
          return;
        }

        // Dimensions are correct, proceed with upload
        try {
          utils.showLoading();

          // Generate unique filename
          const timestamp = Date.now();
          const fileExt = file.name.split('.').pop();
          const fileName = `logos/${orgId}/${timestamp}.${fileExt}`;

          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await STATE.client.storage
            .from('organisation-logos')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: urlData } = STATE.client.storage
            .from('organisation-logos')
            .getPublicUrl(fileName);

          // Update organisation record with logo URL
          const { error: updateError } = await STATE.client
            .from('organisations')
            .update({ logo_url: urlData.publicUrl })
            .eq('id', orgId);

          if (updateError) throw updateError;

          utils.showToast('Logo uploaded successfully!', 'success');

          // Reload the profile to show new logo
          const org = STATE.allOrganisations.find(o => o.id === orgId);
          if (org) {
            await this.openCompanyProfile(orgId, org.company_name);
          }

        } catch (error) {
          console.error('Error uploading logo:', error);
          utils.showToast('Error uploading logo: ' + error.message, 'error');
          inputElement.value = '';
        } finally {
          utils.hideLoading();
        }
      };

      img.onerror = () => {
        utils.showToast('Failed to load image', 'error');
        inputElement.value = '';
      };

      img.src = e.target.result;
    };

    reader.onerror = () => {
      utils.showToast('Failed to read file', 'error');
      inputElement.value = '';
    };

    reader.readAsDataURL(file);
  },

  /**
   * Set winner profile status
   * @param {string} orgId - Organisation ID
   * @param {string} status - 'published' or 'draft'
   */
  async setWinnerProfileStatus(orgId, status) {
    try {
      utils.showLoading();

      const { error } = await STATE.client
        .from('organisations')
        .update({ winner_profile_status: status })
        .eq('id', orgId);

      if (error) throw error;

      utils.showToast(`Winner profile ${status === 'published' ? 'published' : 'saved as draft'}!`, 'success');

      // Reload the profile to show updated status
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) {
        await this.openCompanyProfile(orgId, org.company_name);
      }

    } catch (error) {
      console.error('Error updating status:', error);
      utils.showToast('Error updating status: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Save winner profile
   * @param {string} orgId - Organisation ID
   */
  async saveWinnerProfile(orgId) {
    const intro = document.getElementById('winnerIntro').value.trim();
    const videoId = document.getElementById('winnerVideoId').value.trim();
    const voteUrl = document.getElementById('winnerVoteUrl').value.trim();

    try {
      utils.showLoading();

      const { error } = await STATE.client
        .from('organisations')
        .update({
          winner_intro: intro || null,
          winner_video_id: videoId || null,
          winner_vote_url: voteUrl || null
        })
        .eq('id', orgId);

      if (error) throw error;

      utils.showToast('Winner profile saved successfully!', 'success');

      // Reload the profile
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) {
        await this.openCompanyProfile(orgId, org.company_name);
      }

    } catch (error) {
      console.error('Error saving winner profile:', error);
      utils.showToast('Error saving winner profile: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Cancel winner profile editing
   * @param {string} orgId - Organisation ID
   * @param {string} companyName - Company name
   */
  async cancelWinnerProfile(orgId, companyName) {
    if (utils.confirm('Discard changes to winner profile?')) {
      await this.openCompanyProfile(orgId, companyName);
    }
  },

  /**
   * Open logo gallery modal to select from media gallery
   * @param {string} orgId - Organisation ID
   */
  async openLogoGalleryModal(orgId) {
    this.currentOrgIdForLogo = orgId;

    const modal = new bootstrap.Modal(document.getElementById('selectLogoModal'));
    modal.show();

    const contentDiv = document.getElementById('logoGalleryContent');
    contentDiv.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
    `;

    try {
      // Fetch all media from media gallery
      const { data: allMedia, error } = await STATE.client
        .from('media_gallery')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter images only (no videos) and check dimensions
      const imageMedia = (allMedia || []).filter(m =>
        m.file_url && m.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
      );

      if (imageMedia.length === 0) {
        contentDiv.innerHTML = `
          <div class="alert alert-warning">
            <i class="bi bi-exclamation-triangle me-2"></i>
            No images found in Media Gallery. Upload some images first.
          </div>
        `;
        return;
      }

      // Check dimensions of each image
      const validLogos = [];
      let checkedCount = 0;

      for (const media of imageMedia) {
        // Load image to check dimensions
        const img = new Image();
        img.crossOrigin = 'anonymous';

        await new Promise((resolve) => {
          img.onload = () => {
            if (img.width === 250 && img.height === 170) {
              validLogos.push(media);
            }
            checkedCount++;
            resolve();
          };
          img.onerror = () => {
            checkedCount++;
            resolve();
          };
          img.src = media.file_url;
        });
      }

      // Display valid logos
      if (validLogos.length === 0) {
        contentDiv.innerHTML = `
          <div class="alert alert-warning">
            <i class="bi bi-exclamation-triangle me-2"></i>
            No images with 250x170 px dimensions found. Please upload images with the correct size to Media Gallery.
          </div>
        `;
        return;
      }

      contentDiv.innerHTML = `
        <div class="row g-3">
          ${validLogos.map(media => `
            <div class="col-md-3">
              <div class="card h-100 logo-option" style="cursor: pointer;"
                   onclick="orgsModule.setLogoFromGallery('${orgId}', '${media.file_url}', '${media.id}')">
                <img src="${media.file_url}" class="card-img-top"
                     alt="${utils.escapeHtml(media.title || 'Logo')}"
                     style="height: 170px; object-fit: contain; background: #f8f9fa;">
                <div class="card-body p-2">
                  <p class="card-text small mb-0 text-center">${utils.escapeHtml(media.title || 'Untitled')}</p>
                  <p class="card-text small text-muted text-center mb-0">250 x 170 px</p>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      // Add hover effect
      const style = document.createElement('style');
      style.textContent = `
        .logo-option:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
          transition: all 0.2s;
        }
      `;
      document.head.appendChild(style);

    } catch (error) {
      console.error('Error loading media gallery:', error);
      contentDiv.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>
          Error loading media gallery: ${error.message}
        </div>
      `;
    }
  },

  /**
   * Set logo from media gallery
   * @param {string} orgId - Organisation ID
   * @param {string} fileUrl - URL of the selected image
   * @param {string} mediaId - Media ID
   */
  async setLogoFromGallery(orgId, fileUrl, mediaId) {
    try {
      utils.showLoading();

      // Update organisation record with logo URL
      const { error } = await STATE.client
        .from('organisations')
        .update({ logo_url: fileUrl })
        .eq('id', orgId);

      if (error) throw error;

      utils.showToast('Logo updated successfully!', 'success');

      // Close the modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('selectLogoModal'));
      if (modal) modal.hide();

      // Reload the profile to show new logo
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) {
        org.logo_url = fileUrl; // Update in state
        await this.openCompanyProfile(orgId, org.company_name);
        await this.loadOrganisations(); // Refresh table
      }

    } catch (error) {
      console.error('Error setting logo:', error);
      utils.showToast('Error setting logo: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Fetch company logo from their website URL
   * @param {string} orgId - Organisation ID
   * @param {string} [websiteUrl] - Company website URL (optional, looked up from state)
   * @param {string} [companyName] - Company name (optional)
   */
  async fetchLogoFromWebsite(orgId, websiteUrl, companyName) {
    try {
      // If no websiteUrl provided, look it up from state
      if (!websiteUrl) {
        const org = STATE.allOrganisations.find(o => o.id === orgId);
        if (!org || !org.website) {
          utils.showToast('Please add a website URL first', 'warning');
          return;
        }
        websiteUrl = org.website;
        companyName = org.company_name;
      }

      utils.showLoading('Fetching logo...');

      // Clean up the website URL to get the domain
      let cleanUrl = websiteUrl.trim();
      if (!cleanUrl.startsWith('http')) cleanUrl = 'https://' + cleanUrl;
      let domain = new URL(cleanUrl).hostname.replace(/^www\./, '');

      // Try multiple logo services in order
      const logoServices = [
        // Clearbit Logo API (best quality, but may not have all companies)
        `https://logo.clearbit.com/${domain}`,
        // Google's favicon service (good fallback)
        `https://www.google.com/s2/favicons?sz=128&domain=${domain}`,
        // DuckDuckGo icon service
        `https://icons.duckduckgo.com/ip3/${domain}.ico`
      ];

      let logoUrl = null;

      // Try each service until we find one that works
      for (const serviceUrl of logoServices) {
        try {
          const response = await fetch(serviceUrl, { method: 'HEAD' });
          if (response.ok) {
            logoUrl = serviceUrl;
            break;
          }
        } catch (e) {
          // Try next service
          continue;
        }
      }

      if (!logoUrl) {
        // If all services fail, try the first one anyway (Clearbit)
        logoUrl = logoServices[0];
      }

      // Update the organisation's logo_url
      const { error } = await STATE.client
        .from('organisations')
        .update({ logo_url: logoUrl })
        .eq('id', orgId);

      if (error) throw error;

      utils.showToast('Logo fetched successfully from website!', 'success');

      // Reload the profile to show new logo
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) {
        org.logo_url = logoUrl; // Update in state
        await this.openCompanyProfile(orgId, org.company_name);
        await this.loadOrganisations(); // Refresh table
      }

    } catch (error) {
      console.error('Error fetching logo from website:', error);
      utils.showToast('Could not fetch logo from website. Try uploading manually.', 'warning');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Open upload company images modal
   * @param {string} orgId - Organisation ID
   */
  openUploadImagesModal(orgId) {
    this.currentOrgIdForImages = orgId;

    // Reset form
    document.getElementById('companyImagesUploadFile').value = '';
    document.getElementById('companyImagesTitle').value = '';
    document.getElementById('companyImagesCaption').value = '';

    const modal = new bootstrap.Modal(document.getElementById('uploadCompanyImagesModal'));
    modal.show();
  },

  /**
   * Upload company images for marketing
   */
  async uploadCompanyImages() {
    const fileInput = document.getElementById('companyImagesUploadFile');
    const title = document.getElementById('companyImagesTitle').value.trim();
    const caption = document.getElementById('companyImagesCaption').value.trim();
    const uploadBtn = document.getElementById('uploadCompanyImagesBtn');

    if (!fileInput.files || fileInput.files.length === 0) {
      utils.showToast('Please select at least one image', 'warning');
      return;
    }

    const files = Array.from(fileInput.files);

    // Validate file types (images only)
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const invalidFiles = files.filter(f => !validTypes.includes(f.type));

    if (invalidFiles.length > 0) {
      utils.showToast(`${invalidFiles.length} file(s) are not valid images and will be skipped`, 'warning');
    }

    const validFiles = files.filter(f => validTypes.includes(f.type));
    if (validFiles.length === 0) {
      utils.showToast('No valid images to upload', 'error');
      return;
    }

    try {
      uploadBtn.disabled = true;
      utils.showLoading();

      let successCount = 0;
      let errorCount = 0;

      for (const file of validFiles) {
        try {
          // Generate unique filename
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(7);
          const fileName = `company-images/${this.currentOrgIdForImages}/${timestamp}_${randomSuffix}_${file.name}`;

          // Upload file to Supabase Storage
          const { data: uploadData, error: uploadError } = await STATE.client.storage
            .from('media-gallery')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: urlData } = STATE.client.storage
            .from('media-gallery')
            .getPublicUrl(fileName);

          // Insert record into organisation_images table
          const { error: dbError } = await STATE.client
            .from('organisation_images')
            .insert([{
              organisation_id: this.currentOrgIdForImages,
              file_url: urlData.publicUrl,
              title: title || file.name,
              caption: caption || null,
              display_order: successCount
            }]);

          if (dbError) throw dbError;

          successCount++;

        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          errorCount++;
        }
      }

      // Close modal
      bootstrap.Modal.getInstance(document.getElementById('uploadCompanyImagesModal')).hide();

      if (errorCount === 0) {
        utils.showToast(`${successCount} image(s) uploaded successfully!`, 'success');
      } else {
        utils.showToast(`${successCount} succeeded, ${errorCount} failed. Check console for details.`, 'warning');
      }

      // Reload the profile to show new images
      const org = STATE.allOrganisations.find(o => o.id === this.currentOrgIdForImages);
      if (org) {
        await this.openCompanyProfile(this.currentOrgIdForImages, org.company_name);
      }

    } catch (error) {
      console.error('Error uploading company images:', error);
      utils.showToast('Error uploading images: ' + error.message, 'error');
    } finally {
      uploadBtn.disabled = false;
      utils.hideLoading();
    }
  },

  /**
   * Delete company image
   * @param {string} imageId - Image ID
   * @param {string} orgId - Organisation ID
   */
  async deleteCompanyImage(imageId, orgId) {
    if (!confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
      return;
    }

    try {
      utils.showLoading();

      // Get image details to delete from storage
      const { data: image, error: fetchError } = await STATE.client
        .from('organisation_images')
        .select('file_url')
        .eq('id', imageId)
        .single();

      if (fetchError) throw fetchError;

      // Delete from database
      const { error: deleteError } = await STATE.client
        .from('organisation_images')
        .delete()
        .eq('id', imageId);

      if (deleteError) throw deleteError;

      // Extract file path from URL and delete from storage
      if (image && image.file_url) {
        const urlParts = image.file_url.split('/storage/v1/object/public/media-gallery/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          await STATE.client.storage
            .from('media-gallery')
            .remove([filePath]);
        }
      }

      utils.showToast('Image deleted successfully!', 'success');

      // Reload the profile
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) {
        await this.openCompanyProfile(orgId, org.company_name);
      }

    } catch (error) {
      console.error('Error deleting image:', error);
      utils.showToast('Error deleting image: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * View image in full screen
   * @param {string} imageUrl - Image URL
   * @param {string} title - Image title
   */
  viewImageFull(imageUrl, title) {
    const modal = new bootstrap.Modal(document.getElementById('viewImageFullModal'));
    document.getElementById('viewImageFullTitle').textContent = title;
    document.getElementById('viewImageFullContent').innerHTML = `
      <img src="${imageUrl}" alt="${utils.escapeHtml(title)}" class="img-fluid" style="max-height: 70vh;">
    `;
    modal.show();
  },

  /**
   * Enable edit mode for organisation profile
   * @param {string} orgId - Organisation ID
   */
  enableEditMode(orgId) {
    // Hide view elements and show edit elements
    document.querySelectorAll('.view-mode').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.edit-mode').forEach(el => el.style.display = 'block');

    // Toggle buttons
    document.getElementById('editOrgBtn').style.display = 'none';
    document.getElementById('saveOrgBtn').style.display = 'inline-block';
    document.getElementById('cancelEditOrgBtn').style.display = 'inline-block';
  },

  /**
   * Save organisation changes
   * @param {string} orgId - Organisation ID
   */
  async saveOrgChanges(orgId) {
    try {
      utils.showLoading();

      // Collect updated data from form fields
      const updatedData = {
        contact_name: document.getElementById('editContactName').value.trim(),
        email: document.getElementById('editEmail').value.trim(),
        contact_phone: document.getElementById('editPhone').value.trim(),
        website: document.getElementById('editWebsite').value.trim(),
        region: document.getElementById('editRegion').value,
        address: document.getElementById('editAddress').value.trim(),
        catchment_area: document.getElementById('editCatchmentArea').value.trim(),
        // Extended fields
        description: document.getElementById('editDescription')?.value.trim() || null,
        achievements: document.getElementById('editAchievements')?.value.trim() || null,
        company_size: document.getElementById('editCompanySize')?.value || null,
        employee_count: document.getElementById('editEmployeeCount')?.value ? parseInt(document.getElementById('editEmployeeCount').value) : null,
        year_founded: document.getElementById('editYearFounded')?.value ? parseInt(document.getElementById('editYearFounded').value) : null,
        annual_revenue: document.getElementById('editAnnualRevenue')?.value ? parseFloat(document.getElementById('editAnnualRevenue').value) : null,
        tier: document.getElementById('editTier')?.value || null,
        linkedin_url: document.getElementById('editLinkedin')?.value.trim() || null,
        twitter_url: document.getElementById('editTwitter')?.value.trim() || null,
        facebook_url: document.getElementById('editFacebook')?.value.trim() || null,
        instagram_url: document.getElementById('editInstagram')?.value.trim() || null
      };

      // Update in database
      const { error } = await STATE.client
        .from('organisations')
        .update(updatedData)
        .eq('id', orgId);

      if (error) throw error;

      // Update local state
      const orgIndex = STATE.allOrganisations.findIndex(o => o.id === orgId);
      if (orgIndex !== -1) {
        STATE.allOrganisations[orgIndex] = {
          ...STATE.allOrganisations[orgIndex],
          ...updatedData
        };
      }

      // Update filtered organisations
      const filteredIndex = STATE.filteredOrganisations.findIndex(o => o.id === orgId);
      if (filteredIndex !== -1) {
        STATE.filteredOrganisations[filteredIndex] = {
          ...STATE.filteredOrganisations[filteredIndex],
          ...updatedData
        };
      }

      // Update current editing org
      this.currentEditingOrg = { ...this.currentEditingOrg, ...updatedData };
      this.originalOrgData = { ...this.currentEditingOrg };

      utils.showToast('Organisation updated successfully', 'success');

      // Refresh the profile view
      await this.openCompanyProfile(orgId, this.currentEditingOrg.company_name);

      // Refresh the organisations table
      this.renderOrganisations();

    } catch (error) {
      console.error('Error saving organisation changes:', error);
      utils.showToast('Failed to save changes: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Cancel edit mode and revert to view mode
   * @param {string} orgId - Organisation ID
   * @param {string} companyName - Company name
   */
  async cancelEditMode(orgId, companyName) {
    // Reopen the profile in view mode (this will restore original data)
    await this.openCompanyProfile(orgId, companyName);
  },

  /**
   * Navigate to award from company profile
   * Closes the company profile modal and switches to the Awards tab
   * @param {string} awardId - Award ID
   * @param {string} awardName - Award name
   */
  navigateToAward(awardId, awardName) {
    // Close the company profile modal
    const modalElement = document.getElementById('companyProfileModal');
    const modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) {
      modal.hide();
    }

    // Wait for modal to close, then switch to Awards tab and open assignments
    setTimeout(() => {
      // Switch to Awards tab
      const awardsTab = document.getElementById('awards-tab');
      if (awardsTab) {
        awardsTab.click();
      }

      // Wait a bit for tab to switch, then open assignments modal
      setTimeout(() => {
        if (typeof assignmentsModule !== 'undefined') {
          assignmentsModule.openAssignmentsModal(awardId, awardName);
        }
      }, 300);
    }, 300);
  },

  /**
   * View all invoices for an organisation
   * @param {string} orgId - Organisation ID
   * @param {string} companyName - Company name
   */
  async viewOrganisationInvoices(orgId, companyName) {
    try {
      utils.showLoading();

      // Load invoices with line items
      const { data: invoices, error } = await STATE.client
        .from('invoices')
        .select(`
          *,
          invoice_line_items (*)
        `)
        .eq('organisation_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Create and show modal
      let modal = bootstrap.Modal.getInstance(document.getElementById('organisationInvoicesModal'));
      if (!modal) {
        modal = new bootstrap.Modal(document.getElementById('organisationInvoicesModal'));
      }

      const modalTitle = document.getElementById('organisationInvoicesModalTitle');
      const modalBody = document.getElementById('organisationInvoicesModalBody');

      modalTitle.innerHTML = `<i class="bi bi-receipt me-2"></i>Invoices for ${utils.escapeHtml(companyName)}`;

      if (!invoices || invoices.length === 0) {
        modalBody.innerHTML = `
          <div class="alert alert-info">
            <i class="bi bi-info-circle me-2"></i>No invoices found for this organisation.
          </div>
        `;
      } else {
        modalBody.innerHTML = `
          <div class="table-responsive">
            <table class="table table-hover">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Items</th>
                  <th class="text-end">Total</th>
                  <th class="text-end">Paid</th>
                  <th class="text-end">Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${invoices.map(invoice => `
                  <tr>
                    <td><strong>${utils.escapeHtml(invoice.invoice_number)}</strong></td>
                    <td>${invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('en-GB') : 'N/A'}</td>
                    <td>
                      <span class="badge bg-info-subtle text-info">
                        ${this.formatInvoiceType(invoice.invoice_type)}
                      </span>
                      ${invoice.package_type && ['bronze', 'silver', 'gold'].includes(invoice.package_type) ?
                        `<br>${this.getPackageBadge(invoice.package_type)}` : ''
                      }
                    </td>
                    <td>
                      <small class="text-muted">
                        ${invoice.invoice_line_items && invoice.invoice_line_items.length > 0 ?
                          invoice.invoice_line_items.map(item =>
                            `${item.quantity}x ${utils.escapeHtml(item.item_name)}`
                          ).join('<br>') :
                          invoice.description || 'N/A'
                        }
                      </small>
                    </td>
                    <td class="text-end"><strong>£${parseFloat(invoice.total_amount || 0).toFixed(2)}</strong></td>
                    <td class="text-end text-success">£${parseFloat(invoice.paid_amount || 0).toFixed(2)}</td>
                    <td class="text-end ${parseFloat(invoice.balance_due || 0) > 0 ? 'text-danger' : 'text-muted'}">
                      £${parseFloat(invoice.balance_due || 0).toFixed(2)}
                    </td>
                    <td>${this.getInvoiceStatusBadge(invoice.status, invoice.payment_status)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      modal.show();

    } catch (error) {
      console.error('Error loading invoices:', error);
      utils.showToast('Error loading invoices: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Format invoice type for display
   */
  formatInvoiceType(type) {
    const types = {
      entry_fee: 'Entry Fee',
      package: 'Package',
      sponsorship: 'Sponsorship',
      tickets: 'Tickets',
      other: 'Other'
    };
    return types[type] || type;
  },

  /**
   * Get invoice status badge
   */
  getInvoiceStatusBadge(status, paymentStatus) {
    const badges = {
      draft: '<span class="badge bg-secondary">Draft</span>',
      sent: '<span class="badge bg-info">Sent</span>',
      viewed: '<span class="badge bg-primary">Viewed</span>',
      paid: '<span class="badge bg-success">Paid</span>',
      partially_paid: '<span class="badge bg-warning">Partially Paid</span>',
      overdue: '<span class="badge bg-danger">Overdue</span>',
      cancelled: '<span class="badge bg-dark">Cancelled</span>',
      refunded: '<span class="badge bg-secondary">Refunded</span>'
    };
    return badges[status] || badges[paymentStatus] || '<span class="badge bg-secondary">Unknown</span>';
  },

  /**
   * Get package badge HTML
   * @param {string} packageType - Package type (bronze/silver/gold/non-attendee)
   * @returns {string} HTML badge
   */
  getPackageBadge(packageType) {
    const packages = {
      'gold': '<span class="badge" style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: #000;"><i class="bi bi-award-fill me-1"></i>Gold</span>',
      'silver': '<span class="badge" style="background: linear-gradient(135deg, #C0C0C0 0%, #808080 100%); color: #000;"><i class="bi bi-award-fill me-1"></i>Silver</span>',
      'bronze': '<span class="badge" style="background: linear-gradient(135deg, #CD7F32 0%, #8B4513 100%); color: #fff;"><i class="bi bi-award-fill me-1"></i>Bronze</span>',
      'non-attendee': '<span class="badge bg-secondary"><i class="bi bi-x-circle me-1"></i>Non-Attendee</span>'
    };
    return packages[packageType] || packages['bronze'];
  },

  // ============================================
  // STATUS BADGE
  // ============================================
  getStatusBadge(status) {
    const badges = {
      'prospect': '<span class="badge bg-secondary">Prospect</span>',
      'entrant': '<span class="badge bg-info">Entrant</span>',
      'nominee': '<span class="badge bg-primary">Nominee</span>',
      'shortlisted': '<span class="badge bg-warning text-dark">Shortlisted</span>',
      'winner': '<span class="badge bg-success">Winner</span>',
      'sponsor': '<span class="badge bg-danger">Sponsor</span>',
      'past_winner': '<span class="badge bg-dark">Past Winner</span>'
    };
    return badges[status] || badges['prospect'];
  },

  // ============================================
  // SAVE NEW COMPANY
  // ============================================
  async saveNewCompany() {
    const form = document.getElementById('addCompanyForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const companyName = document.getElementById('newCompanyName').value.trim();
    const email = document.getElementById('newCompanyEmail').value.trim();
    let website = document.getElementById('newCompanyWebsite').value.trim() || null;

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      utils.showToast('Please enter a valid email address', 'error');
      return;
    }

    // Auto-prefix website URL
    if (website && !website.startsWith('http://') && !website.startsWith('https://')) {
      website = 'https://' + website;
    }

    // Check for duplicate company name
    const duplicate = STATE.allOrganisations.find(
      o => o.company_name?.toLowerCase() === companyName.toLowerCase()
    );
    if (duplicate) {
      if (!confirm(`A company named "${duplicate.company_name}" already exists. Add anyway?`)) {
        return;
      }
    }

    const selectedCounty = document.getElementById('newCompanyCounty')?.value || '';

    const companyData = {
      company_name: companyName,
      sector: document.getElementById('newCompanySector').value,
      contact_name: document.getElementById('newContactName').value.trim() || null,
      contact_phone: document.getElementById('newContactPhone').value.trim() || null,
      email: email || null,
      website: website,
      region: document.getElementById('newCompanyRegion').value,
      address: document.getElementById('newCompanyAddress').value.trim() || null,
      catchment_area: selectedCounty || document.getElementById('newCompanyCatchment').value.trim() || null,
      status: 'prospect'
    };

    try {
      utils.showLoading();

      const { error } = await STATE.client
        .from('organisations')
        .insert([companyData]);

      if (error) throw error;

      utils.showToast('Company added successfully!', 'success');
      bootstrap.Modal.getInstance(document.getElementById('addNewOrgModal')).hide();
      form.reset();
      await this.loadOrganisations();

    } catch (error) {
      console.error('Error saving new company:', error);
      utils.showToast('Error saving company: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  // ============================================
  // SELECT ALL / TOGGLE SELECTION
  // ============================================
  toggleSelectAll() {
    const checkbox = document.getElementById('selectAllOrgs');
    if (checkbox.checked) {
      STATE.filteredOrganisations.forEach(org => this.selectedOrgs.add(org.id));
    } else {
      this.selectedOrgs.clear();
    }
    this.renderOrganisations();
    this.updateBulkActionsBar();
  },

  toggleOrgSelection(orgId) {
    if (this.selectedOrgs.has(orgId)) {
      this.selectedOrgs.delete(orgId);
    } else {
      this.selectedOrgs.add(orgId);
    }
    // Update select all checkbox
    const selectAll = document.getElementById('selectAllOrgs');
    if (selectAll) {
      selectAll.checked = this.selectedOrgs.size === STATE.filteredOrganisations.length;
    }
    this.updateBulkActionsBar();
  },

  updateBulkActionsBar() {
    const bar = document.getElementById('bulkActionsBar');
    const countEl = document.getElementById('selectedCount');
    if (bar && countEl) {
      countEl.textContent = this.selectedOrgs.size;
      bar.style.display = this.selectedOrgs.size > 0 ? 'block' : 'none';
    }
  },

  clearSelection() {
    this.selectedOrgs.clear();
    const selectAll = document.getElementById('selectAllOrgs');
    if (selectAll) selectAll.checked = false;
    this.renderOrganisations();
    this.updateBulkActionsBar();
  },

  // ============================================
  // SORTING
  // ============================================
  sortBy(field) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }

    const dir = this.sortDirection === 'asc' ? 1 : -1;

    STATE.filteredOrganisations.sort((a, b) => {
      let valA, valB;
      switch (field) {
        case 'company':
          valA = (a.company_name || '').toLowerCase();
          valB = (b.company_name || '').toLowerCase();
          break;
        case 'sector':
          valA = (a.sector || '').toLowerCase();
          valB = (b.sector || '').toLowerCase();
          break;
        case 'county':
          valA = (a.county || '').toLowerCase();
          valB = (b.county || '').toLowerCase();
          break;
        case 'contact':
          valA = (a.contact_name || '').toLowerCase();
          valB = (b.contact_name || '').toLowerCase();
          break;
        case 'email':
          valA = (a.email || '').toLowerCase();
          valB = (b.email || '').toLowerCase();
          break;
        case 'region':
          valA = (a.region || '').toLowerCase();
          valB = (b.region || '').toLowerCase();
          break;
        case 'status':
          valA = (a.status || 'prospect').toLowerCase();
          valB = (b.status || 'prospect').toLowerCase();
          break;
        case 'awards':
          valA = a.awards_count || 0;
          valB = b.awards_count || 0;
          break;
        default:
          valA = (a.company_name || '').toLowerCase();
          valB = (b.company_name || '').toLowerCase();
      }
      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return 0;
    });

    this.renderOrganisations();
  },

  /**
   * Update sort direction indicators in column headers
   */
  updateSortIndicators() {
    document.querySelectorAll('#organisations [data-sort-icon]').forEach(icon => {
      icon.className = 'bi bi-arrow-down-up text-muted ms-1 small';
    });
    if (this.sortField) {
      const activeIcon = document.querySelector(`#organisations [data-sort-icon="${this.sortField}"]`);
      if (activeIcon) {
        const iconClass = this.sortDirection === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down';
        activeIcon.className = `bi ${iconClass} text-primary ms-1 small`;
      }
    }
  },

  /**
   * Populate sector suggestions datalist for add/edit forms
   */
  populateSectorSuggestions() {
    const datalist = document.getElementById('sectorSuggestions');
    if (!datalist) return;
    const existingSectors = [...new Set(STATE.allOrganisations.map(o => o.sector).filter(Boolean))];
    const allSectors = [...new Set([...SECTORS, ...existingSectors])].sort();
    datalist.innerHTML = allSectors.map(s => `<option value="${utils.escapeHtml(s)}">`).join('');
  },

  /**
   * Reset all filters to default
   */
  resetFilters() {
    document.getElementById('orgsSearchBox').value = '';
    document.getElementById('orgsYearFilter').value = '';
    document.getElementById('orgsSectorFilter').value = '';
    document.getElementById('orgsRegionFilter').value = '';
    document.getElementById('orgsCountyFilter').value = '';
    document.getElementById('orgsStatusFilter').value = '';
    this.updateCountyFilterByRegion();
    try { localStorage.removeItem('orgsFilters'); } catch (e) { /* ignore */ }
    this.filterOrganisations();
  },

  // ============================================
  // EXPORT CSV
  // ============================================
  exportToCSV() {
    const data = STATE.filteredOrganisations;
    if (data.length === 0) {
      utils.showToast('No organisations to export', 'warning');
      return;
    }

    const csv = [
      'Company Name,Sector,County,Region,Contact Name,Email,Phone,Website,Status,Awards Count,Address,Catchment Area',
      ...data.map(org =>
        [
          `"${(org.company_name || '').replace(/"/g, '""')}"`,
          `"${(org.sector || '').replace(/"/g, '""')}"`,
          `"${(org.county || '').replace(/"/g, '""')}"`,
          `"${(org.region || '').replace(/"/g, '""')}"`,
          `"${(org.contact_name || '').replace(/"/g, '""')}"`,
          `"${(org.email || '').replace(/"/g, '""')}"`,
          `"${(org.contact_phone || '').replace(/"/g, '""')}"`,
          `"${(org.website || '').replace(/"/g, '""')}"`,
          `"${(org.status || 'prospect').replace(/"/g, '""')}"`,
          `"${org.awards_count || 0}"`,
          `"${(org.address || '').replace(/"/g, '""')}"`,
          `"${(org.catchment_area || '').replace(/"/g, '""')}"`
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `organisations-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    utils.showToast(`Exported ${data.length} organisations`, 'success');
  },

  // ============================================
  // BULK EMAIL
  // ============================================
  bulkEmail() {
    if (this.selectedOrgs.size === 0) {
      utils.showToast('No organisations selected', 'warning');
      return;
    }

    const selectedData = STATE.allOrganisations.filter(org => this.selectedOrgs.has(org.id));
    const emails = selectedData
      .map(org => org.email)
      .filter(e => e)
      .join(',');

    if (emails) {
      window.location.href = `mailto:${emails}`;
      utils.showToast(`Opening email for ${selectedData.length} companies`, 'success');
    } else {
      utils.showToast('No email addresses found for selected companies', 'warning');
    }
  },

  // ============================================
  // BULK EXPORT
  // ============================================
  bulkExport() {
    if (this.selectedOrgs.size === 0) {
      utils.showToast('No organisations selected', 'warning');
      return;
    }

    const originalFiltered = STATE.filteredOrganisations;
    STATE.filteredOrganisations = STATE.allOrganisations.filter(org => this.selectedOrgs.has(org.id));
    this.exportToCSV();
    STATE.filteredOrganisations = originalFiltered;
  },

  // ============================================
  // SAVE NOTES
  // ============================================
  async saveOrgNotes(orgId) {
    const notes = document.getElementById('editOrgNotes')?.value?.trim() || '';
    try {
      const { error } = await STATE.client
        .from('organisations')
        .update({ notes: notes || null })
        .eq('id', orgId);

      if (error) throw error;

      // Update local state
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) org.notes = notes;

      utils.showToast('Notes saved', 'success');
    } catch (error) {
      console.error('Error saving notes:', error);
      utils.showToast('Error saving notes: ' + error.message, 'error');
    }
  },

  // ============================================
  // UPDATE COMPANY STATUS
  // ============================================
  // ============================================
  // QUICK INLINE STATUS UPDATE
  // ============================================
  async quickUpdateStatus(orgId, newStatus) {
    try {
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      const oldStatus = org?.status || 'prospect';

      const { error } = await STATE.client
        .from('organisations')
        .update({ status: newStatus })
        .eq('id', orgId);

      if (error) throw error;

      // Update local state
      if (org) org.status = newStatus;
      const filteredOrg = STATE.filteredOrganisations.find(o => o.id === orgId);
      if (filteredOrg) filteredOrg.status = newStatus;

      // Audit trail
      this._logAudit(orgId, 'status_change', org?.company_name || '', `Status: ${oldStatus} → ${newStatus}`);

      utils.showToast(`Status updated to ${newStatus.replace('_', ' ')}`, 'success');
    } catch (error) {
      console.error('Error updating status:', error);
      utils.showToast('Error updating status: ' + error.message, 'error');
    }
  },

  // ============================================
  // ARCHIVE ORGANISATION (Soft Delete)
  // ============================================
  async deleteOrganisation(orgId, companyName) {
    if (!confirm(`Archive "${companyName}"? This will hide it from the main list but keep all data intact. You can restore it later from the "Show Archived" filter.`)) {
      return;
    }

    try {
      utils.showLoading();

      const { error } = await STATE.client
        .from('organisations')
        .update({ status: 'archived' })
        .eq('id', orgId);

      if (error) throw error;

      // Log the action
      this._logAudit(orgId, 'archived', companyName, 'Organisation archived');

      utils.showToast(`"${companyName}" archived successfully`, 'success');

      // Update local state
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) org.status = 'archived';

      this.selectedOrgs.delete(orgId);
      this.filterOrganisations();
      this.updateBulkActionsBar();

    } catch (error) {
      console.error('Error archiving organisation:', error);
      utils.showToast('Error archiving: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  async restoreOrganisation(orgId, companyName) {
    try {
      const { error } = await STATE.client
        .from('organisations')
        .update({ status: 'prospect' })
        .eq('id', orgId);

      if (error) throw error;

      this._logAudit(orgId, 'restored', companyName, 'Organisation restored from archive');

      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) org.status = 'prospect';

      utils.showToast(`"${companyName}" restored`, 'success');
      this.filterOrganisations();
    } catch (error) {
      console.error('Error restoring:', error);
      utils.showToast('Error restoring: ' + error.message, 'error');
    }
  },

  async permanentDelete(orgId, companyName) {
    if (!confirm(`PERMANENTLY delete "${companyName}" and all associated data? This CANNOT be undone.`)) return;
    if (!confirm(`Final confirmation: Delete "${companyName}" forever?`)) return;

    try {
      utils.showLoading();

      await STATE.client.from('award_assignments').delete().eq('organisation_id', orgId);
      const { error } = await STATE.client.from('organisations').delete().eq('id', orgId);
      if (error) throw error;

      STATE.allOrganisations = STATE.allOrganisations.filter(o => o.id !== orgId);
      STATE.filteredOrganisations = STATE.filteredOrganisations.filter(o => o.id !== orgId);
      this.selectedOrgs.delete(orgId);

      utils.showToast(`"${companyName}" permanently deleted`, 'success');
      this.renderOrganisations();
      this.updateBulkActionsBar();
    } catch (error) {
      console.error('Error deleting:', error);
      utils.showToast('Error: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  // ============================================
  // BULK ARCHIVE
  // ============================================
  async bulkDelete() {
    if (this.selectedOrgs.size === 0) {
      utils.showToast('No organisations selected', 'warning');
      return;
    }

    const count = this.selectedOrgs.size;
    if (!confirm(`Archive ${count} organisation(s)? They will be hidden from the main list but can be restored later.`)) {
      return;
    }

    try {
      utils.showLoading();
      const orgIds = Array.from(this.selectedOrgs);

      const { error } = await STATE.client
        .from('organisations')
        .update({ status: 'archived' })
        .in('id', orgIds);

      if (error) throw error;

      // Update local state
      orgIds.forEach(id => {
        const org = STATE.allOrganisations.find(o => o.id === id);
        if (org) org.status = 'archived';
      });
      this.selectedOrgs.clear();

      utils.showToast(`${count} organisation(s) archived`, 'success');
      this.filterOrganisations();
      this.updateBulkActionsBar();

    } catch (error) {
      console.error('Error bulk archiving:', error);
      utils.showToast('Error archiving: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  // ============================================
  // BULK STATUS CHANGE
  // ============================================
  async bulkStatusChange(newStatus) {
    if (this.selectedOrgs.size === 0) {
      utils.showToast('No organisations selected', 'warning');
      return;
    }

    const count = this.selectedOrgs.size;
    if (!confirm(`Change status of ${count} organisation(s) to "${newStatus.replace('_', ' ')}"?`)) return;

    try {
      utils.showLoading();
      const orgIds = Array.from(this.selectedOrgs);

      const { error } = await STATE.client
        .from('organisations')
        .update({ status: newStatus })
        .in('id', orgIds);

      if (error) throw error;

      orgIds.forEach(id => {
        const org = STATE.allOrganisations.find(o => o.id === id);
        if (org) org.status = newStatus;
        const fOrg = STATE.filteredOrganisations.find(o => o.id === id);
        if (fOrg) fOrg.status = newStatus;
      });

      utils.showToast(`${count} org(s) updated to ${newStatus.replace('_', ' ')}`, 'success');
      this.renderOrganisations();
    } catch (error) {
      console.error('Error bulk status change:', error);
      utils.showToast('Error: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  async updateOrgStatus(orgId, newStatus) {
    try {
      const { error } = await STATE.client
        .from('organisations')
        .update({ status: newStatus })
        .eq('id', orgId);

      if (error) throw error;

      // Update local state
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) org.status = newStatus;

      const filteredOrg = STATE.filteredOrganisations.find(o => o.id === orgId);
      if (filteredOrg) filteredOrg.status = newStatus;

      utils.showToast(`Status updated to ${newStatus}`, 'success');

      // Refresh the profile
      if (org) {
        await this.openCompanyProfile(orgId, org.company_name);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      utils.showToast('Error updating status: ' + error.message, 'error');
    }
  },

  // ============================================
  // STATUS WORKFLOW ENFORCEMENT
  // ============================================
  _statusFlow: {
    'prospect':    { next: ['entrant', 'sponsor'], label: 'Prospect' },
    'entrant':     { next: ['nominee', 'prospect'], label: 'Entrant' },
    'nominee':     { next: ['shortlisted', 'entrant'], label: 'Nominee' },
    'shortlisted': { next: ['winner', 'nominee'], label: 'Shortlisted' },
    'winner':      { next: ['past_winner'], label: 'Winner' },
    'past_winner': { next: ['entrant', 'prospect'], label: 'Past Winner' },
    'sponsor':     { next: ['prospect'], label: 'Sponsor' },
    'archived':    { next: ['prospect'], label: 'Archived' }
  },

  _getStatusOptions(currentStatus) {
    const flow = this._statusFlow[currentStatus];
    if (!flow) return [{ value: currentStatus, label: currentStatus }];

    // Show current + valid next statuses
    const options = [{ value: currentStatus, label: flow.label + ' (current)' }];
    (flow.next || []).forEach(s => {
      const f = this._statusFlow[s];
      if (f) options.push({ value: s, label: f.label });
    });
    return options;
  },

  // ============================================
  // AUDIT TRAIL (Supabase-backed, localStorage fallback)
  // ============================================
  async _logAudit(orgId, action, companyName, details) {
    try {
      await STATE.client
        .from('org_audit_log')
        .insert([{ org_id: orgId, company_name: companyName, action, details }]);
    } catch (e) {
      // Fallback to localStorage if table doesn't exist yet
      try {
        const key = 'orgAuditLog';
        const log = JSON.parse(localStorage.getItem(key) || '[]');
        log.unshift({ orgId, companyName, action, details, timestamp: new Date().toISOString() });
        if (log.length > 500) log.length = 500;
        localStorage.setItem(key, JSON.stringify(log));
      } catch (e2) { /* ignore */ }
    }
  },

  async getAuditLog(orgId) {
    try {
      let query = STATE.client
        .from('org_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (orgId) query = query.eq('org_id', orgId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(e => ({ ...e, timestamp: e.created_at }));
    } catch (e) {
      // Fallback to localStorage
      try {
        const log = JSON.parse(localStorage.getItem('orgAuditLog') || '[]');
        if (orgId) return log.filter(e => e.orgId === orgId);
        return log;
      } catch (e2) { return []; }
    }
  },

  async renderAuditLog(orgId) {
    const log = await this.getAuditLog(orgId);
    if (log.length === 0) return '<p class="text-muted small">No activity recorded yet</p>';

    return `<div class="list-group list-group-flush" style="max-height: 300px; overflow-y: auto;">
      ${log.slice(0, 50).map(entry => {
        const date = new Date(entry.timestamp || entry.created_at);
        const timeAgo = this._timeAgo(date);
        const icons = {
          'status_change': 'bi-arrow-repeat text-primary',
          'archived': 'bi-archive text-warning',
          'restored': 'bi-arrow-counterclockwise text-success',
          'created': 'bi-plus-circle text-success',
          'email_sent': 'bi-envelope text-info',
          'note_added': 'bi-sticky text-secondary',
          'csv_import': 'bi-file-earmark-arrow-up text-primary'
        };
        const icon = icons[entry.action] || 'bi-clock-history text-muted';
        return `<div class="list-group-item px-0 py-2 border-0">
          <div class="d-flex align-items-start">
            <i class="bi ${icon} me-2 mt-1"></i>
            <div>
              <div class="small fw-semibold">${utils.escapeHtml(entry.details || entry.action)}</div>
              <div class="text-muted" style="font-size: 0.7rem;">${timeAgo} &middot; ${date.toLocaleDateString('en-GB')} ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
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
  // DUPLICATE DETECTION
  // ============================================
  _normaliseForMatch(str) {
    return (str || '').toLowerCase()
      .replace(/\b(ltd|limited|plc|inc|llp|llc|&|and|the|co|company)\b/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  },

  findDuplicates(companyName) {
    const normalised = this._normaliseForMatch(companyName);
    if (!normalised || normalised.length < 3) return [];

    return STATE.allOrganisations.filter(org => {
      const orgNorm = this._normaliseForMatch(org.company_name);
      if (!orgNorm) return false;

      // Exact normalised match
      if (orgNorm === normalised) return true;

      // One contains the other
      if (orgNorm.includes(normalised) || normalised.includes(orgNorm)) return true;

      // Levenshtein distance for short names
      if (normalised.length < 15 && orgNorm.length < 15) {
        return this._levenshtein(orgNorm, normalised) <= 2;
      }

      return false;
    });
  },

  _levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i-1] === b[j-1]
          ? dp[i-1][j-1]
          : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
      }
    }
    return dp[m][n];
  },

  showDuplicateCheck() {
    const dupeMap = new Map();

    STATE.allOrganisations.forEach(org => {
      const norm = this._normaliseForMatch(org.company_name);
      if (!norm) return;
      if (!dupeMap.has(norm)) dupeMap.set(norm, []);
      dupeMap.get(norm).push(org);
    });

    const duplicateGroups = Array.from(dupeMap.values()).filter(group => group.length > 1);

    if (duplicateGroups.length === 0) {
      utils.showToast('No duplicates found!', 'success');
      return;
    }

    let html = `<div class="alert alert-warning"><i class="bi bi-exclamation-triangle me-2"></i>Found ${duplicateGroups.length} potential duplicate group(s)</div>`;

    duplicateGroups.forEach((group, idx) => {
      html += `<div class="card mb-2"><div class="card-body py-2">
        <h6 class="mb-2">Group ${idx + 1}: "${utils.escapeHtml(group[0].company_name)}"</h6>
        <div class="table-responsive"><table class="table table-sm mb-0">
          <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Awards</th><th>Action</th></tr></thead>
          <tbody>
          ${group.map(org => `<tr>
            <td class="small">${utils.escapeHtml(org.company_name)}</td>
            <td class="small">${utils.escapeHtml(org.email || '-')}</td>
            <td><span class="badge bg-secondary">${org.status || 'prospect'}</span></td>
            <td class="text-center">${org.awards_count || 0}</td>
            <td><button class="btn btn-sm btn-outline-danger" onclick="orgsModule.deleteOrganisation('${org.id}', '${utils.escapeHtml(org.company_name).replace(/'/g, "\\'")}')">Archive</button></td>
          </tr>`).join('')}
          </tbody>
        </table></div>
      </div></div>`;
    });

    // Show in a modal
    const modalHtml = `<div class="modal fade" id="duplicateCheckModal" tabindex="-1">
      <div class="modal-dialog modal-lg"><div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title"><i class="bi bi-files me-2"></i>Duplicate Detection</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body" style="max-height: 500px; overflow-y: auto;">${html}</div>
        <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Close</button></div>
      </div></div>
    </div>`;

    // Remove existing and create new
    document.getElementById('duplicateCheckModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    new bootstrap.Modal(document.getElementById('duplicateCheckModal')).show();
  },

  // ============================================
  // EMAIL TEMPLATES
  // ============================================
  _emailTemplates: [
    {
      id: 'shortlist_notify',
      name: 'Shortlist Notification',
      subject: 'Congratulations - You have been shortlisted!',
      body: `Dear {contact_name},\n\nWe are delighted to inform you that {company_name} has been shortlisted for the British Trade Awards.\n\nThe awards ceremony will take place shortly, and we will be in touch with further details.\n\nKind regards,\nBritish Trade Awards Team`
    },
    {
      id: 'winner_notify',
      name: 'Winner Announcement',
      subject: 'You are a Winner - British Trade Awards!',
      body: `Dear {contact_name},\n\nCongratulations! We are thrilled to announce that {company_name} has won at the British Trade Awards!\n\nPlease find attached your winner's pack with logos, press release template, and trophy collection details.\n\nKind regards,\nBritish Trade Awards Team`
    },
    {
      id: 'entry_invite',
      name: 'Entry Invitation',
      subject: 'British Trade Awards - Invitation to Enter',
      body: `Dear {contact_name},\n\nWe would like to invite {company_name} to enter the British Trade Awards this year.\n\nEntries are now open and close on [DATE]. You can enter online at [URL].\n\nKind regards,\nBritish Trade Awards Team`
    },
    {
      id: 'feedback_request',
      name: 'Feedback Request',
      subject: 'British Trade Awards - We value your feedback',
      body: `Dear {contact_name},\n\nThank you for participating in the British Trade Awards. We would love to hear your feedback to help us improve.\n\nPlease take a moment to complete our short survey: [SURVEY_URL]\n\nKind regards,\nBritish Trade Awards Team`
    },
    {
      id: 'sponsor_inquiry',
      name: 'Sponsorship Inquiry',
      subject: 'Sponsorship Opportunities - British Trade Awards',
      body: `Dear {contact_name},\n\nWe are reaching out to {company_name} regarding sponsorship opportunities for the upcoming British Trade Awards.\n\nWe have several packages available, including category sponsorship and headline sponsorship.\n\nWould you be available for a brief call to discuss?\n\nKind regards,\nBritish Trade Awards Team`
    }
  ],

  openEmailTemplate(orgId) {
    const org = STATE.allOrganisations.find(o => o.id === orgId) || {};
    const templates = this._emailTemplates;

    let html = `<div class="list-group">
      ${templates.map(t => {
        const subject = t.subject.replace(/{company_name}/g, org.company_name || '').replace(/{contact_name}/g, org.contact_name || 'Sir/Madam');
        const body = t.body.replace(/{company_name}/g, org.company_name || '').replace(/{contact_name}/g, org.contact_name || 'Sir/Madam');
        return `<a href="mailto:${org.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}"
                   class="list-group-item list-group-item-action"
                   onclick="orgsModule._logComms('${orgId}', '${t.id}', '${utils.escapeHtml(org.company_name || '').replace(/'/g, "\\'")}')">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <h6 class="mb-1">${t.name}</h6>
              <small class="text-muted">${t.subject}</small>
            </div>
            <i class="bi bi-envelope text-primary"></i>
          </div>
        </a>`;
      }).join('')}
    </div>`;

    document.getElementById('duplicateCheckModal')?.remove();
    const modalHtml = `<div class="modal fade" id="duplicateCheckModal" tabindex="-1">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title"><i class="bi bi-envelope me-2"></i>Email ${utils.escapeHtml(org.company_name || '')}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">${html}</div>
        <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Close</button></div>
      </div></div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    new bootstrap.Modal(document.getElementById('duplicateCheckModal')).show();
  },

  // ============================================
  // COMMUNICATION HISTORY (Supabase-backed)
  // ============================================
  async _logComms(orgId, templateId, companyName) {
    try {
      const template = this._emailTemplates.find(t => t.id === templateId);
      await STATE.client
        .from('org_comms_log')
        .insert([{
          org_id: orgId,
          company_name: companyName,
          template_id: templateId,
          template_name: template?.name || templateId
        }]);

      this._logAudit(orgId, 'email_sent', companyName, `Email sent: ${template?.name || templateId}`);
    } catch (e) {
      // Fallback to localStorage
      try {
        const key = 'orgCommsLog';
        const log = JSON.parse(localStorage.getItem(key) || '[]');
        const template = this._emailTemplates.find(t => t.id === templateId);
        log.unshift({ orgId, companyName, templateId, templateName: template?.name || templateId, timestamp: new Date().toISOString() });
        if (log.length > 1000) log.length = 1000;
        localStorage.setItem(key, JSON.stringify(log));
      } catch (e2) { /* ignore */ }
    }
  },

  async getCommsHistory(orgId) {
    try {
      let query = STATE.client
        .from('org_comms_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (orgId) query = query.eq('org_id', orgId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(e => ({ ...e, timestamp: e.created_at, templateName: e.template_name }));
    } catch (e) {
      // Fallback to localStorage
      try {
        const log = JSON.parse(localStorage.getItem('orgCommsLog') || '[]');
        if (orgId) return log.filter(e => e.orgId === orgId);
        return log;
      } catch (e2) { return []; }
    }
  },

  async renderCommsHistory(orgId) {
    const history = await this.getCommsHistory(orgId);
    if (history.length === 0) return '<p class="text-muted small">No communications recorded yet</p>';

    return `<div class="list-group list-group-flush" style="max-height: 250px; overflow-y: auto;">
      ${history.map(entry => {
        const date = new Date(entry.timestamp);
        return `<div class="list-group-item px-0 py-2 border-0">
          <div class="d-flex align-items-center">
            <i class="bi bi-envelope-check text-success me-2"></i>
            <div>
              <div class="small fw-semibold">${utils.escapeHtml(entry.templateName)}</div>
              <div class="text-muted" style="font-size: 0.7rem;">${date.toLocaleDateString('en-GB')} ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  },

  // ============================================
  // TAG MANAGEMENT
  // ============================================
  async addTag(orgId) {
    const input = document.getElementById('newTagInput');
    const tag = (input?.value || '').trim();
    if (!tag) return;

    try {
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      const currentTags = org?.tags || [];

      if (currentTags.includes(tag)) {
        utils.showToast('Tag already exists', 'warning');
        return;
      }

      const newTags = [...currentTags, tag];
      const { error } = await STATE.client
        .from('organisations')
        .update({ tags: newTags })
        .eq('id', orgId);

      if (error) throw error;

      if (org) org.tags = newTags;
      input.value = '';
      utils.showToast(`Tag "${tag}" added`, 'success');
      await this.openCompanyProfile(orgId, org.company_name);
    } catch (error) {
      console.error('Error adding tag:', error);
      utils.showToast('Error adding tag: ' + error.message, 'error');
    }
  },

  async removeTag(orgId, tag) {
    try {
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      const newTags = (org?.tags || []).filter(t => t !== tag);

      const { error } = await STATE.client
        .from('organisations')
        .update({ tags: newTags })
        .eq('id', orgId);

      if (error) throw error;

      if (org) org.tags = newTags;
      utils.showToast(`Tag "${tag}" removed`, 'success');
      await this.openCompanyProfile(orgId, org.company_name);
    } catch (error) {
      console.error('Error removing tag:', error);
      utils.showToast('Error removing tag: ' + error.message, 'error');
    }
  },

  // ============================================
  // INLINE QUICK-EDIT (table cells)
  // ============================================
  startInlineEdit(orgId, field, currentValue, element) {
    // Prevent opening multiple editors at once
    if (document.querySelector('.inline-edit-active')) return;

    const td = element.closest('td');
    const originalHtml = td.innerHTML;
    td.classList.add('inline-edit-active');

    const inputType = field === 'email' ? 'email' : 'text';
    const escaped = utils.escapeHtml(currentValue || '');
    const listAttr = field === 'sector' ? ' list="sectorSuggestions"' : '';

    td.innerHTML = `
      <div class="input-group input-group-sm">
        <input type="${inputType}" class="form-control form-control-sm" id="inlineEdit_${field}"
               value="${escaped}" autofocus${listAttr} autocomplete="off"
               onkeydown="if(event.key==='Enter')orgsModule.saveInlineEdit('${orgId}','${field}');if(event.key==='Escape')orgsModule.cancelInlineEdit(this,'${orgId}');"
               style="font-size: 0.8rem;">
        <button class="btn btn-success btn-sm" onclick="orgsModule.saveInlineEdit('${orgId}','${field}')"><i class="bi bi-check"></i></button>
        <button class="btn btn-outline-secondary btn-sm" onclick="orgsModule.cancelInlineEdit(this,'${orgId}')"><i class="bi bi-x"></i></button>
      </div>
    `;

    // Store original HTML for cancel
    td.dataset.originalHtml = originalHtml;
    td.querySelector('input').focus();
  },

  async saveInlineEdit(orgId, field) {
    const input = document.getElementById(`inlineEdit_${field}`);
    if (!input) return;

    const newValue = input.value.trim();

    // Map display field to DB field
    const fieldMap = { 'contact': 'contact_name', 'email': 'email', 'sector': 'sector' };
    const dbField = fieldMap[field] || field;

    try {
      const { error } = await STATE.client
        .from('organisations')
        .update({ [dbField]: newValue || null })
        .eq('id', orgId);

      if (error) throw error;

      // Update local state
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) org[dbField] = newValue || null;
      const fOrg = STATE.filteredOrganisations.find(o => o.id === orgId);
      if (fOrg) fOrg[dbField] = newValue || null;

      this.renderOrganisations();
      utils.showToast(`${field} updated`, 'success');
    } catch (error) {
      console.error('Error saving inline edit:', error);
      utils.showToast('Error: ' + error.message, 'error');
    }
  },

  cancelInlineEdit(element, orgId) {
    const td = element.closest('td');
    if (td) {
      td.classList.remove('inline-edit-active');
      // Re-render to restore original state
      this.renderOrganisations();
    }
  },

  // ============================================
  // BULK FIELD UPDATES
  // ============================================
  async bulkUpdateField(field, value) {
    if (this.selectedOrgs.size === 0) {
      utils.showToast('No organisations selected', 'warning');
      return;
    }

    const count = this.selectedOrgs.size;
    const displayValue = value || '(empty)';
    if (!confirm(`Set ${field} to "${displayValue}" for ${count} organisation(s)?`)) return;

    try {
      utils.showLoading();
      const orgIds = Array.from(this.selectedOrgs);

      const { error } = await STATE.client
        .from('organisations')
        .update({ [field]: value || null })
        .in('id', orgIds);

      if (error) throw error;

      orgIds.forEach(id => {
        const org = STATE.allOrganisations.find(o => o.id === id);
        if (org) org[field] = value || null;
        const fOrg = STATE.filteredOrganisations.find(o => o.id === id);
        if (fOrg) fOrg[field] = value || null;
      });

      utils.showToast(`${count} org(s) updated: ${field} = ${displayValue}`, 'success');
      this.renderOrganisations();
    } catch (error) {
      console.error('Error bulk updating field:', error);
      utils.showToast('Error: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  showBulkFieldModal(field) {
    let options = '';
    if (field === 'sector') {
      // Combine global SECTORS with any existing custom sectors
      const existingSectors = [...new Set(STATE.allOrganisations.map(o => o.sector).filter(Boolean))];
      const allSectors = [...new Set([...SECTORS, ...existingSectors])].sort();
      options = allSectors.map(s => `<option value="${s}">${utils.escapeHtml(s)}</option>`).join('');
    } else if (field === 'region') {
      options = REGIONS.map(r => `<option value="${r}">${utils.escapeHtml(r)}</option>`).join('');
    } else if (field === 'tier') {
      options = ['Bronze','Silver','Gold','Platinum'].map(t => `<option value="${t}">${t}</option>`).join('');
    }

    const modalHtml = `
      <div class="modal fade" id="bulkFieldModal" tabindex="-1">
        <div class="modal-dialog modal-sm">
          <div class="modal-content">
            <div class="modal-header">
              <h6 class="modal-title">Bulk Set ${field.charAt(0).toUpperCase() + field.slice(1)}</h6>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p class="small text-muted mb-2">Apply to <strong>${this.selectedOrgs.size}</strong> selected organisations</p>
              <select class="form-select" id="bulkFieldValue">
                <option value="">-- Select --</option>
                ${options}
              </select>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
              <button class="btn btn-primary btn-sm" onclick="
                const val = document.getElementById('bulkFieldValue').value;
                if (!val) { utils.showToast('Please select a value', 'warning'); return; }
                bootstrap.Modal.getInstance(document.getElementById('bulkFieldModal')).hide();
                orgsModule.bulkUpdateField('${field}', val);
              ">Apply</button>
            </div>
          </div>
        </div>
      </div>`;

    document.getElementById('bulkFieldModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    new bootstrap.Modal(document.getElementById('bulkFieldModal')).show();
  },

  // ============================================
  // BULK AUTO-FETCH LOGOS
  // ============================================
  async bulkFetchLogos() {
    const selected = Array.from(this.selectedOrgs);
    const orgs = STATE.allOrganisations.filter(o => selected.includes(o.id) && o.website && !o.logo_url);

    if (orgs.length === 0) {
      utils.showToast('No selected organisations with websites and missing logos', 'warning');
      return;
    }

    if (!confirm(`Fetch logos for ${orgs.length} organisations with websites but no logo?`)) return;

    utils.showLoading(`Fetching logos: 0/${orgs.length}`);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < orgs.length; i++) {
      const org = orgs[i];
      try {
        let cleanUrl = org.website.trim();
        if (!cleanUrl.startsWith('http')) cleanUrl = 'https://' + cleanUrl;
        const domain = new URL(cleanUrl).hostname.replace(/^www\./, '');

        const logoServices = [
          `https://logo.clearbit.com/${domain}`,
          `https://www.google.com/s2/favicons?sz=128&domain=${domain}`,
          `https://icons.duckduckgo.com/ip3/${domain}.ico`
        ];

        let logoUrl = null;
        for (const serviceUrl of logoServices) {
          try {
            const response = await fetch(serviceUrl, { method: 'HEAD' });
            if (response.ok) { logoUrl = serviceUrl; break; }
          } catch (e) { continue; }
        }

        if (logoUrl) {
          await STATE.client
            .from('organisations')
            .update({ logo_url: logoUrl })
            .eq('id', org.id);
          org.logo_url = logoUrl;
          successCount++;
        } else {
          failCount++;
        }
      } catch (e) {
        failCount++;
      }

      utils.showLoading(`Fetching logos: ${i + 1}/${orgs.length}`);
    }

    utils.hideLoading();
    utils.showToast(`Logos fetched: ${successCount} success, ${failCount} failed`, successCount > 0 ? 'success' : 'warning');
    this.renderOrganisations();
  },

  // ============================================
  // CSV IMPORT
  // ============================================
  _csvData: null,
  _csvHeaders: null,
  _csvColumnMap: {},

  // Known DB column mappings from common CSV header names
  _columnAliases: {
    'company_name': 'company_name', 'company name': 'company_name', 'companyname': 'company_name',
    'name': 'company_name', 'business name': 'company_name', 'organisation': 'company_name',
    'sector': 'sector', 'industry': 'sector', 'category': 'sector',
    'county': 'county', 'county/city': 'county', 'location': 'county', 'city': 'county',
    'region': 'region', 'area': 'region',
    'contact_name': 'contact_name', 'contact name': 'contact_name', 'contact': 'contact_name',
    'email': 'email', 'email address': 'email', 'e-mail': 'email',
    'phone': 'contact_phone', 'contact_phone': 'contact_phone', 'telephone': 'contact_phone', 'tel': 'contact_phone',
    'website': 'website', 'url': 'website', 'web': 'website', 'site': 'website',
    'address': 'address', 'postal address': 'address',
    'catchment_area': 'catchment_area', 'catchment area': 'catchment_area', 'catchment': 'catchment_area'
  },

  _dbFields: ['company_name', 'sector', 'region', 'contact_name', 'email', 'contact_phone', 'website', 'address', 'catchment_area'],

  _getSelectedCounty() {
    const val = document.getElementById('csvCountySelect')?.value || '';
    if (!val) {
      utils.showToast('Please select a County/City first', 'error');
      document.getElementById('csvCountySelect')?.focus();
      return null;
    }
    return val;
  },

  parseCSVFile(input) {
    const file = input.files[0];
    if (!file) return;

    if (!this._getSelectedCounty()) {
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      this._processCSVText(text);
    };
    reader.readAsText(file);
  },

  parseCSVText() {
    if (!this._getSelectedCounty()) return;

    const text = document.getElementById('csvPasteArea').value.trim();
    if (!text) {
      utils.showToast('Please paste CSV data first', 'warning');
      return;
    }
    this._processCSVText(text);
  },

  _processCSVText(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) {
      utils.showToast('CSV must have at least a header row and one data row', 'error');
      return;
    }

    // Parse header
    this._csvHeaders = this._parseCSVLine(lines[0]);

    // Parse data rows
    this._csvData = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this._parseCSVLine(lines[i]);
      if (values.some(v => v.trim())) {
        this._csvData.push(values);
      }
    }

    if (this._csvData.length === 0) {
      utils.showToast('No data rows found in CSV', 'error');
      return;
    }

    // Auto-map columns
    this._csvColumnMap = {};
    this._csvHeaders.forEach((header, idx) => {
      const normalised = header.toLowerCase().trim();
      if (this._columnAliases[normalised]) {
        this._csvColumnMap[idx] = this._columnAliases[normalised];
      }
    });

    // Show step 2: column mapping
    this._showColumnMapping();
  },

  _parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    result.push(current.trim());
    return result;
  },

  _showColumnMapping() {
    document.getElementById('csvStep1').style.display = 'none';
    document.getElementById('csvStep2').style.display = 'block';

    const selectedCounty = this._getSelectedCounty();

    const container = document.getElementById('csvColumnMapping');
    container.innerHTML = `
      <div class="col-12 mb-2">
        <div class="alert alert-success py-2 mb-2">
          <i class="bi bi-geo-alt-fill me-1"></i>
          Importing for: <strong>${utils.escapeHtml(selectedCounty)}</strong>
          <small class="text-muted ms-2">(all imported orgs will be tagged to this county)</small>
        </div>
      </div>
    ` + this._csvHeaders.map((header, idx) => {
      const mapped = this._csvColumnMap[idx] || '';
      return `
        <div class="col-md-4 mb-2">
          <label class="form-label small fw-semibold mb-1">
            CSV: "${utils.escapeHtml(header)}"
            <span class="text-muted">(sample: ${utils.escapeHtml(this._csvData[0]?.[idx] || '')})</span>
          </label>
          <select class="form-select form-select-sm" onchange="orgsModule._updateColumnMap(${idx}, this.value)">
            <option value="">-- Skip --</option>
            ${this._dbFields.map(f => `<option value="${f}" ${mapped === f ? 'selected' : ''}>${f.replace(/_/g, ' ')}</option>`).join('')}
          </select>
        </div>
      `;
    }).join('');

    // Add apply mapping button
    container.innerHTML += `
      <div class="col-12 mt-2">
        <button class="btn btn-primary" onclick="orgsModule._applyMapping()">
          <i class="bi bi-eye me-1"></i>Preview Import
        </button>
      </div>
    `;
  },

  _updateColumnMap(idx, value) {
    if (value) {
      this._csvColumnMap[idx] = value;
    } else {
      delete this._csvColumnMap[idx];
    }
  },

  _applyMapping() {
    // Check company_name is mapped
    const hasCompanyName = Object.values(this._csvColumnMap).includes('company_name');
    if (!hasCompanyName) {
      utils.showToast('You must map at least the "Company Name" column', 'error');
      return;
    }

    // Build preview
    const existingNames = new Set(
      STATE.allOrganisations.map(o => (o.company_name || '').toLowerCase())
    );

    let newCount = 0;
    let dupCount = 0;

    const previewRows = this._csvData.map(row => {
      const record = {};
      Object.entries(this._csvColumnMap).forEach(([idx, field]) => {
        record[field] = row[parseInt(idx)] || '';
      });

      const isDuplicate = existingNames.has((record.company_name || '').toLowerCase());
      if (isDuplicate) dupCount++; else newCount++;

      return { record, isDuplicate };
    });

    // Show step 3
    document.getElementById('csvStep2').style.display = 'none';
    document.getElementById('csvStep3').style.display = 'block';

    const mappedFields = [...new Set(Object.values(this._csvColumnMap))];

    document.getElementById('csvPreviewCount').textContent = previewRows.length;
    document.getElementById('csvNewCount').textContent = `${newCount} new`;
    document.getElementById('csvDuplicateCount').textContent = `${dupCount} duplicates`;

    document.getElementById('csvPreviewHeader').innerHTML =
      '<th>#</th>' +
      mappedFields.map(f => `<th>${f.replace(/_/g, ' ')}</th>`).join('') +
      '<th>Status</th>';

    document.getElementById('csvPreviewBody').innerHTML = previewRows.map((item, i) => `
      <tr class="${item.isDuplicate ? 'table-warning' : ''}">
        <td class="small">${i + 1}</td>
        ${mappedFields.map(f => `<td class="small">${utils.escapeHtml(item.record[f] || '-')}</td>`).join('')}
        <td>
          ${item.isDuplicate
            ? '<span class="badge bg-warning text-dark">Duplicate</span>'
            : '<span class="badge bg-success">New</span>'
          }
        </td>
      </tr>
    `).join('');

    // Enable import button
    const importBtn = document.getElementById('csvImportBtn');
    importBtn.disabled = false;
    document.getElementById('csvImportBtnCount').textContent = newCount > 0 ? `${newCount}` : `${previewRows.length}`;

    // Store preview for import
    this._csvPreviewRows = previewRows;
  },

  async executeCSVImport() {
    if (!this._csvPreviewRows || this._csvPreviewRows.length === 0) {
      utils.showToast('No data to import', 'warning');
      return;
    }

    // Only import non-duplicates by default, or ask
    const newRows = this._csvPreviewRows.filter(r => !r.isDuplicate);
    const dupRows = this._csvPreviewRows.filter(r => r.isDuplicate);

    let rowsToImport = newRows;
    if (dupRows.length > 0 && newRows.length > 0) {
      if (confirm(`${dupRows.length} duplicate(s) found. Import only the ${newRows.length} new companies? (Cancel to import ALL including duplicates)`)) {
        rowsToImport = newRows;
      } else {
        rowsToImport = this._csvPreviewRows;
      }
    } else if (newRows.length === 0) {
      if (!confirm(`All ${dupRows.length} companies already exist. Import them anyway as duplicates?`)) {
        return;
      }
      rowsToImport = this._csvPreviewRows;
    }

    try {
      utils.showLoading();
      const importBtn = document.getElementById('csvImportBtn');
      importBtn.disabled = true;
      importBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Importing...';

      const selectedCounty = this._getSelectedCounty();
      if (!selectedCounty) return;

      // Build records - tag each org with the selected county
      const records = rowsToImport.map(item => {
        const rec = { status: 'prospect', catchment_area: selectedCounty };
        this._dbFields.forEach(field => {
          if (item.record[field]) {
            let val = item.record[field].trim();
            // Auto-prefix website
            if (field === 'website' && val && !val.startsWith('http://') && !val.startsWith('https://')) {
              val = 'https://' + val;
            }
            rec[field] = val || null;
          }
        });
        // Don't overwrite catchment_area if CSV had one mapped
        if (!rec.catchment_area) rec.catchment_area = selectedCounty;
        return rec;
      });

      // Insert in batches of 50
      let successCount = 0;
      let errorCount = 0;
      const batchSize = 50;

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { error } = await STATE.client
          .from('organisations')
          .insert(batch);

        if (error) {
          console.error('Batch import error:', error);
          errorCount += batch.length;
        } else {
          successCount += batch.length;
        }
      }

      // Track imported counties in localStorage for dashboard
      try {
        const imported = JSON.parse(localStorage.getItem('csvImportedCounties') || '{}');
        imported[selectedCounty] = {
          count: (imported[selectedCounty]?.count || 0) + successCount,
          lastImport: new Date().toISOString()
        };
        localStorage.setItem('csvImportedCounties', JSON.stringify(imported));
      } catch (e) { /* ignore */ }

      // Close modal
      bootstrap.Modal.getInstance(document.getElementById('csvImportModal')).hide();

      if (errorCount === 0) {
        utils.showToast(`Successfully imported ${successCount} organisations for ${selectedCounty}!`, 'success');
      } else {
        utils.showToast(`${successCount} imported, ${errorCount} failed. Check console for details.`, 'warning');
      }

      // Reset and reload
      this.resetCSVImport();
      await this.loadOrganisations();

      // Update dashboard county coverage
      if (typeof dashboardModule !== 'undefined' && dashboardModule.updateCountyCoverage) {
        dashboardModule.updateCountyCoverage();
      }

    } catch (error) {
      console.error('CSV import error:', error);
      utils.showToast('Import failed: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
      const importBtn = document.getElementById('csvImportBtn');
      if (importBtn) {
        importBtn.disabled = false;
        importBtn.innerHTML = '<i class="bi bi-cloud-upload me-1"></i>Import Organisations';
      }
    }
  },

  resetCSVImport() {
    this._csvData = null;
    this._csvHeaders = null;
    this._csvColumnMap = {};
    this._csvPreviewRows = null;

    document.getElementById('csvStep1').style.display = 'block';
    document.getElementById('csvStep2').style.display = 'none';
    document.getElementById('csvStep3').style.display = 'none';
    document.getElementById('csvFileInput').value = '';
    document.getElementById('csvPasteArea').value = '';
    document.getElementById('csvImportBtn').disabled = true;
  }
};

// Export to window for global access
window.orgsModule = orgsModule;
