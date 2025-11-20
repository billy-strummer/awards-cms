/* ==================================================== */
/* DASHBOARD MODULE */
/* ==================================================== */

const dashboardModule = {
  /**
   * Load all data for dashboard
   */
  async loadAllData() {
    try {
      utils.showLoading();
      
      // Load awards and organisations in parallel
      await Promise.all([
        awardsModule.loadAwards(),
        orgsModule.loadOrganisations()
      ]);
      
      // Update dashboard stats
      this.updateStats();
      
      console.log('✅ Dashboard data loaded');
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      utils.showToast('Failed to load dashboard data', 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Update dashboard statistics
   */
  updateStats() {
    // Count statistics
    const totalAwards = STATE.allAwards.length;
    const pendingAwards = STATE.allAwards.filter(a => a.status === STATUS.DRAFT || a.status === STATUS.PENDING).length;
    const totalOrgs = STATE.allOrganisations.length;
    const totalWinners = STATE.allWinners.length;
    
    // Update stat cards
    document.getElementById('totalAwards').textContent = totalAwards;
    document.getElementById('pendingAwards').textContent = pendingAwards;
    document.getElementById('totalOrgs').textContent = totalOrgs;
    document.getElementById('totalWinners').textContent = totalWinners;
    
    // Update reports tab stats
    document.getElementById('reportsTotal').textContent = totalAwards;
    document.getElementById('reportsTotalOrgs').textContent = totalOrgs;
    document.getElementById('reportsTotalWinners').textContent = totalWinners;
    
    // Update top companies table
    this.updateTopCompanies();
  },

  /**
   * Update top companies table
   */
  updateTopCompanies() {
    const tbody = document.getElementById('topCompaniesTableBody');
    
    if (STATE.allOrganisations.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4 text-muted">
            <i class="bi bi-inbox display-4 d-block mb-2 opacity-25"></i>
            No organisations found
          </td>
        </tr>
      `;
      return;
    }
    
    // Get top 5 companies (or all if less than 5)
    const topCompanies = STATE.allOrganisations.slice(0, 5);
    
    tbody.innerHTML = topCompanies.map((org, idx) => `
      <tr class="fade-in">
        <td>
          <div class="d-flex align-items-center">
            <div class="badge bg-primary rounded-circle me-2" style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
              ${idx + 1}
            </div>
          </div>
        </td>
        <td>
          <a 
            class="company-link" 
            onclick="orgsModule.openCompanyProfile('${org.id}', '${utils.escapeHtml(org.company_name || '').replace(/'/g, "\\'")}')">
            <i class="bi bi-building me-2"></i>${utils.escapeHtml(org.company_name || 'N/A')}
          </a>
        </td>
        <td>
          ${org.email ? `<a href="mailto:${org.email}" class="text-decoration-none"><i class="bi bi-envelope me-1"></i>${utils.escapeHtml(org.email)}</a>` : '-'}
        </td>
        <td>
          ${org.website ? 
            `<a href="${org.website}" target="_blank" rel="noopener noreferrer" class="text-decoration-none">
              <i class="bi bi-globe me-1"></i>${utils.truncate(org.website, 25)}
              <i class="bi bi-box-arrow-up-right ms-1 small"></i>
            </a>` : '-'}
        </td>
        <td>
          <span class="badge bg-success-subtle text-success">
            <i class="bi bi-geo-alt me-1"></i>${utils.escapeHtml(org.region || '-')}
          </span>
        </td>
      </tr>
    `).join('');
  },

  /**
   * Export awards data to CSV
   */
  exportAwardsCSV() {
    if (STATE.allAwards.length === 0) {
      utils.showToast('No awards data to export', 'warning');
      return;
    }
    
    const exportData = STATE.allAwards.map(award => ({
      'Company Name': award.organisations?.company_name || 'N/A',
      'Year': award.year || '',
      'Award Category': award.award_category || '',
      'Sector': award.sector || '',
      'Region': award.region || '',
      'Status': award.status || '',
      'Created At': utils.formatDate(award.created_at)
    }));
    
    const filename = `awards_export_${new Date().toISOString().split('T')[0]}.csv`;
    utils.exportToCSV(exportData, filename);
  },

  /**
   * Export organisations data to CSV
   */
  exportOrganisationsCSV() {
    if (STATE.allOrganisations.length === 0) {
      utils.showToast('No organisations data to export', 'warning');
      return;
    }
    
    const exportData = STATE.allOrganisations.map(org => ({
      'Company Name': org.company_name || '',
      'Contact Name': org.contact_name || '',
      'Contact Phone': org.contact_phone || '',
      'Email': org.email || '',
      'Website': org.website || '',
      'Region': org.region || '',
      'Address': org.address || '',
      'Created At': utils.formatDate(org.created_at)
    }));
    
    const filename = `organisations_export_${new Date().toISOString().split('T')[0]}.csv`;
    utils.exportToCSV(exportData, filename);
  },

  /**
   * Export winners data to CSV
   */
  exportWinnersCSV() {
    if (STATE.allWinners.length === 0) {
      utils.showToast('No winners data to export', 'warning');
      return;
    }
    
    const exportData = STATE.allWinners.map(winner => ({
      'Winner Name': winner.winner_name || '',
      'Award Category': winner.awards?.award_category || '',
      'Year': winner.awards?.year || '',
      'Photos': winner.winner_media?.filter(m => m.media_type === MEDIA_TYPES.PHOTO).length || 0,
      'Videos': winner.winner_media?.filter(m => m.media_type === MEDIA_TYPES.VIDEO).length || 0,
      'Created At': utils.formatDate(winner.created_at)
    }));
    
    const filename = `winners_export_${new Date().toISOString().split('T')[0]}.csv`;
    utils.exportToCSV(exportData, filename);
  }
};

// Export to window for global access
window.dashboardModule = dashboardModule;
