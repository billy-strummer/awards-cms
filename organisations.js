/* ==================================================== */
/* ORGANISATIONS MODULE */
/* ==================================================== */

const orgsModule = {
  /**
   * Load all organisations from database
   */
  async loadOrganisations() {
    try {
      utils.showLoading();
      utils.showTableLoading('orgsTableBody', 6);
      
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
          
          // Stop if we got less than pageSize records (last page)
          if (data.length < pageSize) {
            hasMore = false;
          }
        }
      }
      
      STATE.allOrganisations = allData;
      STATE.filteredOrganisations = STATE.allOrganisations;
      
      this.renderOrganisations();
      
      console.log(`✅ Loaded ${STATE.allOrganisations.length} organisations (across ${page} pages)`);
      
    } catch (error) {
      console.error('Error loading organisations:', error);
      console.error('Error details:', error.details, error.hint, error.message);
      utils.showToast('Failed to load organisations: ' + error.message, 'error');
      utils.showEmptyState('orgsTableBody', 6, 'Failed to load organisations', 'bi-exclamation-triangle');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Filter organisations based on search
   */
  filterOrganisations() {
    const search = document.getElementById('orgSearchBox').value.toLowerCase().trim();
    
    if (!search) {
      STATE.filteredOrganisations = STATE.allOrganisations;
    } else {
      STATE.filteredOrganisations = STATE.allOrganisations.filter(org => {
        const companyName = org.company_name?.toLowerCase() || '';
        const contact = org.contact_name?.toLowerCase() || '';
        const email = org.email?.toLowerCase() || '';
        
        return companyName.includes(search) || 
               contact.includes(search) || 
               email.includes(search);
      });
    }
    
    this.renderOrganisations();
  },

  /**
   * Render organisations table
   */
  renderOrganisations() {
    const tbody = document.getElementById('orgsTableBody');
    const count = document.getElementById('orgsCount');
    
    count.textContent = STATE.filteredOrganisations.length;
    
    if (STATE.filteredOrganisations.length === 0) {
      utils.showEmptyState('orgsTableBody', 6, 'No organisations found');
      return;
    }
    
    tbody.innerHTML = STATE.filteredOrganisations.map(org => {
      return `
        <tr class="fade-in">
          <td>
            <a 
              class="company-link" 
              onclick="orgsModule.openCompanyProfile('${org.id}', '${utils.escapeHtml(org.company_name || '').replace(/'/g, "\\'")}')">
              <i class="bi bi-building me-2"></i>${utils.escapeHtml(org.company_name || 'N/A')}
            </a>
          </td>
          <td>
            <div>${utils.escapeHtml(org.contact_name || '-')}</div>
            ${org.contact_phone ? `<small class="text-muted"><i class="bi bi-telephone me-1"></i>${utils.escapeHtml(org.contact_phone)}</small>` : ''}
          </td>
          <td>
            ${org.email ? `<a href="mailto:${org.email}" class="text-decoration-none"><i class="bi bi-envelope me-1"></i>${utils.escapeHtml(org.email)}</a>` : '-'}
          </td>
          <td>
            ${org.website ? 
              `<a href="${org.website}" target="_blank" rel="noopener noreferrer" class="text-decoration-none">
                <i class="bi bi-globe me-1"></i>${utils.truncate(org.website, 30)}
                <i class="bi bi-box-arrow-up-right ms-1 small"></i>
              </a>` : '-'}
          </td>
          <td>
            <span class="badge bg-success-subtle text-success">
              <i class="bi bi-geo-alt me-1"></i>${utils.escapeHtml(org.region || '-')}
            </span>
          </td>
          <td class="text-center">
            <div class="btn-group btn-group-sm" role="group">
              <button 
                class="btn btn-outline-primary btn-icon" 
                onclick="orgsModule.openCompanyProfile('${org.id}', '${utils.escapeHtml(org.company_name || '').replace(/'/g, "\\'")}')">
                <i class="bi bi-eye"></i>
              </button>
            </div>
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
    
    titleEl.innerHTML = `<i class="bi bi-building me-2"></i>${utils.escapeHtml(companyName)}`;
    contentDiv.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
    `;
    
    modal.show();
    
    try {
      // Fetch organisation details with related awards
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
          award:award_id (
            award_name,
            award_category,
            sector,
            region,
            year
          )
        `)
        .eq('organisation_id', orgId);

      if (awardsError) throw awardsError;

      // Extract and sort awards, using assignment status instead of award status
      const awards = (assignments || [])
        .filter(a => a.award)
        .map(a => ({
          ...a.award,
          status: a.status // Use assignment status (nominated/shortlisted/winner)
        }))
        .sort((a, b) => (b.year || 0) - (a.year || 0));
      
      // Render profile
      contentDiv.innerHTML = `
        <div class="row">
          <div class="col-md-6 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-person me-2"></i>Contact Information</h6>
            <div class="card">
              <div class="card-body">
                <p class="mb-2"><strong>Contact Name:</strong> ${utils.escapeHtml(org.contact_name || 'N/A')}</p>
                <p class="mb-2"><strong>Email:</strong> 
                  ${org.email ? `<a href="mailto:${org.email}">${utils.escapeHtml(org.email)}</a>` : 'N/A'}
                </p>
                <p class="mb-2"><strong>Phone:</strong> ${utils.escapeHtml(org.contact_phone || 'N/A')}</p>
                <p class="mb-0"><strong>Website:</strong> 
                  ${org.website ? 
                    `<a href="${org.website}" target="_blank" rel="noopener noreferrer">
                      ${utils.escapeHtml(org.website)} <i class="bi bi-box-arrow-up-right small"></i>
                    </a>` : 'N/A'}
                </p>
              </div>
            </div>
          </div>
          
          <div class="col-md-6 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-geo-alt me-2"></i>Location</h6>
            <div class="card">
              <div class="card-body">
                <p class="mb-2"><strong>Region:</strong> 
                  <span class="badge bg-success-subtle text-success">${utils.escapeHtml(org.region || 'N/A')}</span>
                </p>
                <p class="mb-0"><strong>Address:</strong> ${utils.escapeHtml(org.address || 'N/A')}</p>
              </div>
            </div>
          </div>
        </div>
        
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
                  </tr>
                </thead>
                <tbody>
                  ${awards.map(award => `
                    <tr>
                      <td><span class="badge bg-primary-subtle text-primary">${award.year}</span></td>
                      <td>${utils.escapeHtml(award.award_category)}</td>
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
      
    } catch (error) {
      console.error('Error loading company profile:', error);
      contentDiv.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>
          Failed to load company profile: ${error.message}
        </div>
      `;
    }
  }
};

// Export to window for global access
window.orgsModule = orgsModule;
