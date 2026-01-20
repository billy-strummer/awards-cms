/* ==================================================== */
/* ORGANISATIONS MODULE - ENHANCED VERSION */
/* ==================================================== */

const orgsModule = {
  
  // ============================================
  // NEW: State management for bulk operations
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
      utils.showTableLoading('orgsTableBody', 8); // Updated to 8 columns (added checkbox)
      
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
          console.log(`Loaded page ${page}: ${data.length} organisations (total so far: ${allData.length})`);
          
          // Stop if we got less than pageSize records (last page)
          if (data.length < pageSize) {
            hasMore = false;
          }
        }
      }
      
      STATE.allOrganisations = allData;
      STATE.filteredOrganisations = STATE.allOrganisations;
      
      // NEW: Calculate and display dashboard stats
      await this.calculateDashboardStats();
      
      // Populate filter dropdowns
      this.populateFilters();
      this.renderOrganisations();
      
      console.log(`✅ Loaded ${STATE.allOrganisations.length} organisations across ${page} pages`);
      
    } catch (error) {
      console.error('Error loading organisations:', error);
      console.error('Error details:', error.details, error.hint, error.message);
      utils.showToast('Failed to load organisations: ' + error.message, 'error');
      utils.showEmptyState('orgsTableBody', 8, 'Failed to load organisations', 'bi-exclamation-triangle');
    } finally {
      utils.hideLoading();
    }
  },

  // ============================================
  // NEW: Calculate dashboard statistics
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
      
      // Find top region
      const regionCounts = {};
      STATE.allOrganisations.forEach(org => {
        if (org.region) {
          regionCounts[org.region] = (regionCounts[org.region] || 0) + 1;
        }
      });
      
      const topRegionEntry = Object.entries(regionCounts)
        .sort((a, b) => b[1] - a[1])[0];
      const topRegion = topRegionEntry ? topRegionEntry[0] : '-';
      const topRegionCount = topRegionEntry ? topRegionEntry[1] : 0;
      
      // Update dashboard UI
      const totalEl = document.getElementById('orgsTotalCount');
      const activeEl = document.getElementById('orgsActiveNominees');
      const topSectorEl = document.getElementById('orgsTopSector');
      const topSectorCountEl = document.getElementById('orgsTopSectorCount');
      const topRegionEl = document.getElementById('orgsTopRegion');
      const topRegionCountEl = document.getElementById('orgsTopRegionCount');
      
      if (totalEl) totalEl.textContent = totalCount;
      if (activeEl) activeEl.textContent = activeNominees;
      if (topSectorEl) topSectorEl.textContent = topSector;
      if (topSectorCountEl) topSectorCountEl.textContent = topSectorCount;
      if (topRegionEl) topRegionEl.textContent = topRegion;
      if (topRegionCountEl) topRegionCountEl.textContent = topRegionCount;
      
      // Calculate growth (placeholder - you can implement proper tracking)
      const growthEl = document.getElementById('orgsGrowth');
      if (growthEl) growthEl.textContent = '+12%'; // TODO: Calculate real growth from historical data
      
    } catch (error) {
      console.error('Error calculating dashboard stats:', error);
    }
  },

  /**
   * Populate filter dropdowns with unique values
   * ENHANCED: Sorts values alphabetically
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
    
    // Populate region filter
    const regions = [...new Set(STATE.allOrganisations
      .map(o => o.region)
      .filter(r => r)
    )].sort();
    
    const regionSelect = document.getElementById('orgsRegionFilter');
    if (regionSelect) {
      regionSelect.innerHTML = '<option value="">All</option>' +
        regions.map(r => `<option value="${r}">${utils.escapeHtml(r)}</option>`).join('');
    }
  },

  /**
   * Filter organisations based on sector, region, and search
   * ENHANCED: Better search across multiple fields
   */
  filterOrganisations() {
    const sector = document.getElementById('orgsSectorFilter')?.value || '';
    const region = document.getElementById('orgsRegionFilter')?.value || '';
    const search = document.getElementById('orgsSearchBox')?.value.toLowerCase().trim() || '';

    STATE.filteredOrganisations = STATE.allOrganisations.filter(org => {
      // Sector filter
      if (sector && org.sector !== sector) return false;
      
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
   * ENHANCED: Includes checkboxes, better styling, and quick actions
   */
  renderOrganisations() {
    const tbody = document.getElementById('orgsTableBody');
    const count = document.getElementById('orgsCount');

    if (count) count.textContent = STATE.filteredOrganisations.length;

    if (STATE.filteredOrganisations.length === 0) {
      utils.showEmptyState('orgsTableBody', 8, 'No organisations found');
      return;
    }

    tbody.innerHTML = STATE.filteredOrganisations.map(org => {
      const isSelected = this.selectedOrgs.has(org.id);
      
      return `
        <tr class="fade-in ${isSelected ? 'table-active' : ''}">
          <td>
            <input type="checkbox" class="form-check-input" 
                   ${isSelected ? 'checked' : ''}
                   onchange="orgsModule.toggleOrgSelection('${org.id}')">
          </td>
          <td>
            <div class="d-flex align-items-center">
              ${org.logo_url ? 
                `<img src="${org.logo_url}" alt="${utils.escapeHtml(org.company_name)}" class="me-2" style="width: 50px; height: 34px; object-fit: contain; border: 1px solid #dee2e6; border-radius: 4px;">` :
                `<div class="me-2 d-flex align-items-center justify-content-center" style="width: 50px; height: 34px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px;"><i class="bi bi-building text-muted" style="font-size: 0.9rem;"></i></div>`
              }
              <a class="company-link fw-semibold text-primary text-decoration-none" 
                 style="cursor: pointer;"
                 onclick="orgsModule.openCompanyProfile('${org.id}', '${utils.escapeHtml(org.company_name || '').replace(/'/g, "\\'")}')">
                ${utils.escapeHtml(org.company_name || 'N/A')}
              </a>
            </div>
          </td>
          <td>
            <span class="badge bg-info-subtle text-info">
              <i class="bi bi-briefcase me-1"></i>${utils.escapeHtml(org.sector || '-')}
            </span>
          </td>
          <td>
            <div>${utils.escapeHtml(org.contact_name || '-')}</div>
            ${org.contact_phone ? `<small class="text-muted"><i class="bi bi-telephone me-1"></i>${utils.escapeHtml(org.contact_phone)}</small>` : ''}
          </td>
          <td>
            ${org.email ? 
              `<a href="mailto:${org.email}" class="text-decoration-none">
                <i class="bi bi-envelope me-1"></i>${utils.escapeHtml(org.email)}
              </a>` : '-'
            }
          </td>
          <td>
            ${org.website ? 
              `<a href="${org.website.startsWith('http') || org.website.startsWith('https') ? org.website : 'https://' + org.website}" 
                  target="_blank" rel="noopener noreferrer" class="text-decoration-none">
                <i class="bi bi-globe me-1"></i>${utils.truncate(org.website, 30)}
                <i class="bi bi-box-arrow-up-right ms-1 small"></i>
              </a>` : '-'
            }
          </td>
          <td>
            <span class="badge bg-success-subtle text-success">
              <i class="bi bi-geo-alt me-1"></i>${utils.escapeHtml(org.region || '-')}
            </span>
          </td>
          <td class="text-center">
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-primary" 
                      onclick="orgsModule.openCompanyProfile('${org.id}', '${utils.escapeHtml(org.company_name || '').replace(/'/g, "\\'")}')"
                      title="View Profile">
                <i class="bi bi-eye"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // ============================================
  // NEW: Bulk selection functionality
  // ============================================
  
  /**
   * Toggle selection of a single organisation
   */
  toggleOrgSelection(orgId) {
    if (this.selectedOrgs.has(orgId)) {
      this.selectedOrgs.delete(orgId);
    } else {
      this.selectedOrgs.add(orgId);
    }
    this.updateBulkActionsBar();
    this.renderOrganisations();
  },

  /**
   * Toggle select all organisations
   */
  toggleSelectAll() {
    const checkbox = document.getElementById('selectAllOrgs');
    
    if (checkbox && checkbox.checked) {
      // Select all filtered organisations
      STATE.filteredOrganisations.forEach(org => {
        this.selectedOrgs.add(org.id);
      });
    } else {
      // Deselect all
      this.selectedOrgs.clear();
    }
    
    this.updateBulkActionsBar();
    this.renderOrganisations();
  },

  /**
   * Update bulk actions bar visibility and count
   */
  updateBulkActionsBar() {
    const bulkBar = document.getElementById('bulkActionsBar');
    const countEl = document.getElementById('selectedCount');
    
    if (bulkBar && countEl) {
      if (this.selectedOrgs.size > 0) {
        bulkBar.style.display = 'block';
        countEl.textContent = this.selectedOrgs.size;
      } else {
        bulkBar.style.display = 'none';
      }
    }
  },

  /**
   * Clear all selections
   */
  clearSelection() {
    this.selectedOrgs.clear();
    const selectAllCheckbox = document.getElementById('selectAllOrgs');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    this.updateBulkActionsBar();
    this.renderOrganisations();
  },

  // ============================================
  // NEW: Export functionality
  // ============================================
  
  /**
   * Export filtered organisations to CSV
   */
  exportToCSV() {
    const orgsToExport = STATE.filteredOrganisations;
    
    if (orgsToExport.length === 0) {
      utils.showToast('No organisations to export', 'warning');
      return;
    }

    // CSV headers
    const headers = [
      'Company Name',
      'Sector',
      'Contact Name',
      'Email',
      'Phone',
      'Website',
      'Region',
      'Address',
      'Catchment Area'
    ];

    // CSV rows
    const rows = orgsToExport.map(org => [
      org.company_name || '',
      org.sector || '',
      org.contact_name || '',
      org.email || '',
      org.contact_phone || '',
      org.website || '',
      org.region || '',
      org.address || '',
      org.catchment_area || ''
    ]);

    // Convert to CSV format
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `organisations-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    utils.showToast(`Exported ${orgsToExport.length} organisations`, 'success');
  },

  // ============================================
  // NEW: Sorting functionality
  // ============================================
  
  /**
   * Sort organisations by field
   */
  sortBy(field) {
    // Toggle direction if clicking same field
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }

    STATE.filteredOrganisations.sort((a, b) => {
      let aVal, bVal;
      
      switch (field) {
        case 'company':
          aVal = (a.company_name || '').toLowerCase();
          bVal = (b.company_name || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (this.sortDirection === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    this.renderOrganisations();
  },

  // ============================================
  // NEW: Bulk action methods
  // ============================================
  
  bulkEmail() {
    const selectedOrgs = Array.from(this.selectedOrgs);
    utils.showToast(`Email feature for ${selectedOrgs.length} organisations - Coming soon!`, 'info');
    // TODO: Implement bulk email functionality
  },

  bulkAssignAward() {
    const selectedOrgs = Array.from(this.selectedOrgs);
    utils.showToast(`Bulk award assignment for ${selectedOrgs.length} organisations - Coming soon!`, 'info');
    // TODO: Implement bulk award assignment
  },

  async bulkDelete() {
    const selectedOrgs = Array.from(this.selectedOrgs);
    
    if (!confirm(`Are you sure you want to delete ${selectedOrgs.length} organisations? This cannot be undone.`)) {
      return;
    }

    try {
      utils.showLoading();
      
      const { error } = await STATE.client
        .from('organisations')
        .delete()
        .in('id', selectedOrgs);
      
      if (error) throw error;
      
      utils.showToast(`Deleted ${selectedOrgs.length} organisations`, 'success');
      this.clearSelection();
      await this.loadOrganisations();
      
    } catch (error) {
      console.error('Error deleting organisations:', error);
      utils.showToast('Error deleting organisations: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  addCompany() {
    utils.showToast('Add company feature - Coming soon!', 'info');
    // TODO: Implement add company modal
  },

  // ============================================
  // ALL YOUR EXISTING FUNCTIONS BELOW (UNCHANGED)
  // ============================================

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
    const modalElement = document.getElementById('companyProfileModal');
    const backdrop = document.querySelector('.modal-backdrop');
    
    setTimeout(() => {
      modalElement.style.zIndex = '1060';
      const backdrops = document.querySelectorAll('.modal-backdrop');
      if (backdrops.length > 0) {
        backdrops[backdrops.length - 1].style.zIndex = '1059';
      }
    }, 10);

    try {
      // Fetch organisation details
      const { data: org, error: orgError } = await STATE.client
        .from('organisations')
        .select('*')
        .eq('id', orgId)
        .single();

      if (orgError) throw orgError;

      // Fetch related awards through award_assignments
      const { data: assignments, error: awardsError } = await STATE.client
        .from('award_assignments')
        .select(`
          status,
          awards!award_assignments_award_id_fkey(*)
        `)
        .eq('organisation_id', orgId);

      if (awardsError) throw awardsError;

      // Extract and sort awards
      const awards = (assignments || [])
        .filter(a => a.awards)
        .map(a => ({
          ...a.awards,
          status: a.status,
          package_type: 'bronze',
          enhanced_profile: false
        }))
        .sort((a, b) => (b.year || 0) - (a.year || 0));

      // Fetch invoices
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

      // Render profile content
      contentDiv.innerHTML = `
        <div class="row">
          <!-- Company Logo -->
          <div class="col-md-4 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-image me-2"></i>Company Logo</h6>
            <div class="card">
              <div class="card-body text-center">
                ${org.logo_url ? 
                  `<img src="${org.logo_url}" alt="${utils.escapeHtml(org.company_name)}" class="mb-3" style="width: 250px; height: 170px; object-fit: contain; border: 1px solid #dee2e6; border-radius: 4px; background: #f8f9fa;">` :
                  `<div class="text-muted mb-3" style="width: 250px; height: 170px; display: flex; align-items: center; justify-content: center; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px;"><i class="bi bi-image" style="font-size: 3rem;"></i></div>`
                }
                <input type="file" id="logoUploadInput" class="form-control form-control-sm mb-2" accept="image/*" onchange="orgsModule.validateAndUploadLogo('${org.id}', this)">
                <button type="button" class="btn btn-sm btn-outline-primary w-100 mb-2" onclick="orgsModule.openLogoGalleryModal('${org.id}')">
                  <i class="bi bi-images me-1"></i>Choose from Media Gallery
                </button>
                ${org.website ? `
                  <button type="button" class="btn btn-sm btn-outline-success w-100 mb-2" onclick="orgsModule.fetchLogoFromWebsite('${org.id}')">
                    <i class="bi bi-globe me-1"></i>Fetch from Website
                  </button>
                ` : ''}
                <small class="text-muted">Required: 250x170 px</small>
              </div>
            </div>
          </div>

          <!-- Contact Information -->
          <div class="col-md-4 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-person me-2"></i>Contact Information</h6>
            <div class="card">
              <div class="card-body">
                <div class="mb-2">
                  <strong>Contact Name:</strong>
                  <span class="view-mode" id="viewContactName">${utils.escapeHtml(org.contact_name || 'N/A')}</span>
                  <input type="text" class="form-control form-control-sm edit-mode" id="editContactName" value="${utils.escapeHtml(org.contact_name || '')}" style="display: none;">
                </div>
                <div class="mb-2">
                  <strong>Email:</strong>
                  <span class="view-mode" id="viewEmail">
                    ${org.email ? `<a href="mailto:${org.email}">${utils.escapeHtml(org.email)}</a>` : 'N/A'}
                  </span>
                  <input type="email" class="form-control form-control-sm edit-mode" id="editEmail" value="${utils.escapeHtml(org.email || '')}" style="display: none;">
                </div>
                <div class="mb-2">
                  <strong>Phone:</strong>
                  <span class="view-mode" id="viewPhone">${utils.escapeHtml(org.contact_phone || 'N/A')}</span>
                  <input type="text" class="form-control form-control-sm edit-mode" id="editPhone" value="${utils.escapeHtml(org.contact_phone || '')}" style="display: none;">
                </div>
                <div class="mb-0">
                  <strong>Website:</strong>
                  <span class="view-mode" id="viewWebsite">
                    ${org.website ? 
                      `<a href="${org.website.startsWith('http') || org.website.startsWith('https') ? org.website : 'https://' + org.website}" target="_blank" rel="noopener noreferrer">
                        ${utils.escapeHtml(org.website)} <i class="bi bi-box-arrow-up-right small"></i>
                      </a>` : 'N/A'
                    }
                  </span>
                  <input type="url" class="form-control form-control-sm edit-mode" id="editWebsite" value="${utils.escapeHtml(org.website || '')}" style="display: none;" placeholder="e.g., https://example.com">
                </div>
              </div>
            </div>
          </div>

          <!-- Location -->
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
                  <textarea class="form-control form-control-sm edit-mode" id="editAddress" rows="3" style="display: none;">${utils.escapeHtml(org.address || '')}</textarea>
                </div>
                <div class="mb-0">
                  <strong>Catchment Area:</strong>
                  <span class="view-mode" id="viewCatchmentArea">${utils.escapeHtml(org.catchment_area || 'N/A')}</span>
                  <textarea class="form-control form-control-sm edit-mode" id="editCatchmentArea" rows="3" style="display: none;" placeholder="e.g., London, Southeast England, National">${utils.escapeHtml(org.catchment_area || '')}</textarea>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Invoices Summary -->
        ${invoicesSummary.count > 0 ? `
          <div class="mt-4">
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
                    <button type="button" class="btn btn-primary" onclick="orgsModule.viewOrganisationInvoices('${org.id}', '${utils.escapeHtml(org.company_name).replace(/'/g, "\\'")}')">
                      <i class="bi bi-file-earmark-text me-2"></i>View All Invoices
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Award History -->
        <div class="mt-4">
          <h6 class="text-muted mb-3"><i class="bi bi-trophy me-2"></i>Award History (${awards.length})</h6>
          ${awards.length === 0 ? 
            `<div class="alert alert-info">No awards found for this organisation.</div>` :
            `<div class="table-responsive">
              <table class="table table-sm table-hover">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Category</th>
                    <th>Sector</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${awards.map(award => `
                    <tr>
                      <td><span class="badge bg-primary-subtle text-primary">${award.year}</span></td>
                      <td>
                        <a href="javascript:void(0);" class="text-decoration-none fw-semibold text-primary" 
                           onclick="assignmentsModule.openAssignmentsModal('${award.id}', '${utils.escapeHtml(award.award_name || 'Award').replace(/'/g, "\\'")}')">
                          ${utils.escapeHtml(award.award_name)}
                        </a>
                      </td>
                      <td><span class="badge bg-info-subtle text-info">${utils.escapeHtml(award.sector)}</span></td>
                      <td>${utils.getStatusBadge(award.status)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>`
          }
        </div>
      `;

      // Store current org data for editing
      this.currentEditingOrg = org;
      this.originalOrgData = { ...org };

      // Show edit button
      editBtn.style.display = 'inline-block';

      // Setup edit button event listeners
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
          const fileName = `logos/${orgId}_${timestamp}.${fileExt}`;

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
   * Open logo gallery modal to select from media gallery
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
      const imageMedia = (allMedia || [])
        .filter(m => m.file_url && m.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i));

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
              <div class="card h-100 logo-option" style="cursor: pointer;" onclick="orgsModule.setLogoFromGallery('${orgId}', '${media.file_url}', '${media.id}')">
                <img src="${media.file_url}" class="card-img-top" alt="${utils.escapeHtml(media.title || 'Logo')}" style="height: 170px; object-fit: contain; background: #f8f9fa;">
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
   */
  async fetchLogoFromWebsite(orgId) {
    try {
      utils.showLoading();

      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (!org || !org.website) {
        utils.showToast('Please add a website URL first', 'warning');
        return;
      }

      // Clean up the website URL to get the domain
      let domain = org.website.replace(/https?:\/\//, '').replace(/www\./, '').split('/')[0];

      // Try Clearbit first (best quality), then fallback to Google favicon
      const logoUrl = `https://logo.clearbit.com/${domain}`;

      // Update the organisation's logo_url
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
   * Enable edit mode for organisation profile
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
      this.currentEditingOrg = {
        ...this.currentEditingOrg,
        ...updatedData
      };
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
   */
  async cancelEditMode(orgId, companyName) {
    // Reopen the profile in view mode (this will restore original data)
    await this.openCompanyProfile(orgId, companyName);
  },

  /**
   * View all invoices for an organisation
   */
  async viewOrganisationInvoices(orgId, companyName) {
    try {
      utils.showLoading();

      // Load invoices with line items
      const { data: invoices, error } = await STATE.client
        .from('invoices')
        .select('*, invoice_line_items(*)')
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
                      ${['bronze', 'silver', 'gold'].includes(invoice.package_type) ? `<br>${this.getPackageBadge(invoice.package_type)}` : ''}
                    </td>
                    <td>
                      <small class="text-muted">
                        ${invoice.invoice_line_items && invoice.invoice_line_items.length > 0 ? 
                          invoice.invoice_line_items.map(item => `${item.quantity}x ${utils.escapeHtml(item.item_name)}`).join('<br>') : 
                          invoice.description || 'N/A'
                        }
                      </small>
                    </td>
                    <td class="text-end"><strong>£${parseFloat(invoice.total_amount || 0).toFixed(2)}</strong></td>
                    <td class="text-end text-success">£${parseFloat(invoice.paid_amount || 0).toFixed(2)}</td>
                    <td class="text-end ${parseFloat(invoice.balance_due || 0) > 0 ? 'text-danger' : 'text-muted'}">£${parseFloat(invoice.balance_due || 0).toFixed(2)}</td>
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
      'entry_fee': 'Entry Fee',
      'package': 'Package',
      'sponsorship': 'Sponsorship',
      'tickets': 'Tickets',
      'other': 'Other'
    };
    return types[type] || type;
  },

  /**
   * Get invoice status badge
   */
  getInvoiceStatusBadge(status, paymentStatus) {
    const badges = {
      'draft': '<span class="badge bg-secondary">Draft</span>',
      'sent': '<span class="badge bg-info">Sent</span>',
      'viewed': '<span class="badge bg-primary">Viewed</span>',
      'paid': '<span class="badge bg-success">Paid</span>',
      'overdue': '<span class="badge bg-danger">Overdue</span>',
      'cancelled': '<span class="badge bg-dark">Cancelled</span>'
    };
    return badges[status] || badges[paymentStatus] || '<span class="badge bg-secondary">Unknown</span>';
  },

  /**
   * Get package badge
   */
  getPackageBadge(packageType) {
    const badges = {
      'bronze': '<span class="badge" style="background: #cd7f32; color: white;">Bronze</span>',
      'silver': '<span class="badge" style="background: #c0c0c0; color: black;">Silver</span>',
      'gold': '<span class="badge" style="background: #ffd700; color: black;">Gold</span>'
    };
    return badges[packageType] || '';
  }

};

// Export to window for global access
window.orgsModule = orgsModule;
