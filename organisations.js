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
        console.log(`📦 Loaded page ${page}: ${data.length} organisations (total so far: ${allData.length})`);
        
        if (data.length < pageSize) {
          hasMore = false;
        }
      }
    }  // ← ADD THIS CLOSING BRACE FOR THE WHILE LOOP
    
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
    const orgAwardMap = {};
    assignments?.forEach(a => {
      if (!orgAwardMap[a.organisation_id]) {
        orgAwardMap[a.organisation_id] = a.award_id;
      }
    });
    
    const awardMap = {};
    awards?.forEach(a => {
      awardMap[a.id] = a;
    });
    
    // Attach award data to organisations
    allData = allData.map(org => {
      const awardId = orgAwardMap[org.id];
      const award = awardMap[awardId];
      const county = award?.county || null;
      const region = county ? countyToRegion[county] : null;
      
      return {
        ...org,
        county: county,
        region: region,
        sector: award?.sector || null,
        year: award?.year || null
      };
    });
    
    STATE.allOrganisations = allData;
    STATE.filteredOrganisations = STATE.allOrganisations;
    
    // NEW: Calculate and display dashboard stats
    await this.calculateDashboardStats();
    
    // Populate filter dropdowns
    this.populateFilters();
    this.renderOrganisations();
    
    console.log(`✅ Loaded ${STATE.allOrganisations.length} organisations (across ${page} pages)`);
    
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
  
  // Populate county filter - WITH DEBUGGING
  console.log('🔍 Checking counties in database...');
  console.log('📊 Sample org:', STATE.allOrganisations[0]); // Show first organisation
  
  const counties = [...new Set(STATE.allOrganisations
    .map(o => o.county)
    .filter(c => c)
  )].sort();
  
  console.log('🗺️ Found counties:', counties);
  console.log('📝 Number of counties:', counties.length);
  
  const countySelect = document.getElementById('orgsCountyFilter');
  console.log('🎯 County dropdown element:', countySelect);
  
  if (countySelect) {
    countySelect.innerHTML = '<option value="">All</option>' +
      counties.map(c => `<option value="${c}">${utils.escapeHtml(c)}</option>`).join('');
    console.log('✅ County dropdown populated with', counties.length, 'options');
  } else {
    console.warn('⚠️ orgsCountyFilter element not found in HTML');
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
  const search = document.getElementById('orgsSearchBox')?.value.toLowerCase().trim() || '';

  STATE.filteredOrganisations = STATE.allOrganisations.filter(org => {
    // Year filter (filters organisations based on award year - optional)
    // Skip for now unless you have year data on organisations
    
    // Sector filter
    if (sector && org.sector !== sector) return false;
    
    // County filter (NEW)
    if (county && org.county !== county) return false;
    
    // Region filter
    if (region && org.region !== region) return false;
    
    // Search filter - searches across multiple fields
    if (search) {
      const companyName = org.company_name?.toLowerCase() || '';
      const contact = org.contact_name?.toLowerCase() || '';
      const email = org.email?.toLowerCase() || '';
      const website = org.website?.toLowerCase() || '';
      
      if (!companyName.includes(search) && 
          !contact.includes(search) && 
          !email.includes(search) &&
          !website.includes(search)) {
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
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center py-5">
          <i class="bi bi-inbox display-4 text-muted opacity-25"></i>
          <p class="text-muted mt-3 mb-0">No organisations found</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = STATE.filteredOrganisations.map(org => {
    const isSelected = this.selectedOrgs.has(org.id);
    const awardsCount = org.awards_count || 0; // You'll need to add this to your query
    
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
               onclick="orgsModule.openCompanyProfile('${org.id}', '${utils.escapeHtml(org.company_name || '').replace(/'/g, "\\'")}')">
              ${utils.escapeHtml(org.company_name || 'N/A')}
            </a>
          </div>
        </td>
        <td>
          <span class="badge bg-info-subtle text-info small">
            ${utils.escapeHtml(org.sector || '-')}
          </span>
        </td>
        <td>
          <span class="badge bg-primary-subtle text-primary small">
            ${utils.escapeHtml(org.county || '-')}
          </span>
        </td>
        <td class="small">${utils.escapeHtml(org.contact_name || '-')}</td>
        <td class="small">
          ${org.email ? 
            `<a href="mailto:${org.email}" class="text-decoration-none">
              ${utils.truncate(org.email, 25)}
            </a>` : '-'
          }
        </td>
        <td class="small">
          ${org.website ? 
            `<a href="${org.website.startsWith('http') ? org.website : 'https://' + org.website}" 
                target="_blank" class="text-decoration-none">
              ${utils.truncate(org.website.replace(/https?:\/\/(www\.)?/, ''), 20)}
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
          ${awardsCount > 0 ? 
            `<span class="badge bg-warning text-dark">${awardsCount}</span>` : 
            `<span class="text-muted">-</span>`
          }
        </td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-primary" 
                  onclick="orgsModule.openCompanyProfile('${org.id}', '${utils.escapeHtml(org.company_name || '').replace(/'/g, "\\'")}')"
                  title="View Profile">
            <i class="bi bi-eye"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
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
        .select(`
          *,
          events!media_gallery_event_id_fkey (*)
        `)
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
          awards (award_name, year)
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
                              <strong>${utils.escapeHtml(entry.awards ? utils.formatAwardName(entry.awards) : 'N/A')}</strong>
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
   * @param {string} websiteUrl - Company website URL
   * @param {string} companyName - Company name
   */
  async fetchLogoFromWebsite(orgId, websiteUrl, companyName) {
    try {
      utils.showLoading();

      // Clean up the website URL to get the domain
      let domain = websiteUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

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
        catchment_area: document.getElementById('editCatchmentArea').value.trim()
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
   * Extract and set company logo from website
   */
  async fetchLogoFromWebsite(orgId) {
    try {
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (!org || !org.website) {
        utils.showToast('Please add a website URL first', 'warning');
        return;
      }

      utils.showLoading('Fetching logo...');

      // Clean up website URL
      let websiteUrl = org.website.trim();
      if (!websiteUrl.startsWith('http')) {
        websiteUrl = 'https://' + websiteUrl;
      }

      // Extract domain
      const domain = new URL(websiteUrl).hostname;

      // Try Clearbit first (best quality), then fallback to Google favicon
      const logoUrl = `https://logo.clearbit.com/${domain}`;

      // Update database
      const { error } = await STATE.client
        .from('organisations')
        .update({ logo_url: logoUrl })
        .eq('id', orgId);

      if (error) throw error;

      // Update local state
      const orgIndex = STATE.allOrganisations.findIndex(o => o.id === orgId);
      if (orgIndex !== -1) {
        STATE.allOrganisations[orgIndex].logo_url = logoUrl;
      }

      const filteredIndex = STATE.filteredOrganisations.findIndex(o => o.id === orgId);
      if (filteredIndex !== -1) {
        STATE.filteredOrganisations[filteredIndex].logo_url = logoUrl;
      }

      utils.showToast('Logo fetched successfully!', 'success');

      // Refresh the profile view
      await this.openCompanyProfile(orgId, org.company_name);

    } catch (error) {
      console.error('Error fetching logo:', error);
      utils.showToast('Error fetching logo: ' + error.message, 'error');
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
  }
};

// Export to window for global access
window.orgsModule = orgsModule;
