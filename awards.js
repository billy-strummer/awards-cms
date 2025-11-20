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
      utils.showTableLoading('awardsTableBody', 8); // 8 columns now (added assignments column)
      
      // Load all awards using proper Supabase v2 pagination
      let allData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        
        const { data, error } = await STATE.client
          .from('awards')
          .select('*', { count: 'exact' })
          .range(from, to);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allData = allData.concat(data);
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
      this.renderAwards();

    } catch (error) {
      utils.showToast('Failed to load awards: ' + error.message, 'error');
      utils.showEmptyState('awardsTableBody', 8, 'Failed to load awards', 'bi-exclamation-triangle');
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
        .select('award_id, status');
      
      if (error) throw error;
      
      // Count assignments per award
      const counts = {};
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
      });
      
      // Add counts to awards
      STATE.allAwards.forEach(award => {
        award._assignmentCounts = counts[award.id] || {
          total: 0,
          nominated: 0,
          shortlisted: 0,
          winner: 0
        };
      });

    } catch (error) {
      // Don't fail if counts can't be loaded
    }
  },

  /**
   * Populate filter dropdowns with unique values
   */
  populateFilters() {
    // Populate sector filter
    utils.populateFilter(
      STATE.allAwards,
      'sector',
      'awardsSectorFilterSelect',
      'All Sectors'
    );
    
    // Populate region filter
    utils.populateFilter(
      STATE.allAwards,
      'region',
      'awardsRegionFilterSelect',
      'All Regions'
    );
  },

  /**
   * Filter awards based on current filter values
   */
  filterAwards() {
    const year = document.getElementById('awardsYearFilterSelect').value;
    const sector = document.getElementById('awardsSectorFilterSelect').value;
    const region = document.getElementById('awardsRegionFilterSelect').value;
    const search = document.getElementById('awardsSearchBox').value.toLowerCase().trim();
    
    STATE.filteredAwards = STATE.allAwards.filter(award => {
      // Year filter
      if (year && award.year !== year) return false;
      
      // Sector filter
      if (sector && award.sector !== sector) return false;
      
      // Region filter
      if (region && award.region !== region) return false;
      
      // Search filter (searches in winner name and award name/category)
      if (search) {
        const winnerName = award.winner?.toLowerCase() || '';
        const awardName = award.award_name?.toLowerCase() || '';
        const awardCategory = award.award_category?.toLowerCase() || '';
        
        if (!winnerName.includes(search) && !awardName.includes(search) && !awardCategory.includes(search)) {
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
      utils.showEmptyState('awardsTableBody', 8, 'No awards found matching your filters');
      return;
    }
    
    tbody.innerHTML = STATE.filteredAwards.map(award => {
      const counts = award._assignmentCounts || { total: 0, nominated: 0, shortlisted: 0, winner: 0 };
      const countBadgeClass = counts.total === 0 ? 'zero' : 
                             counts.total < 5 ? 'low' : 
                             counts.total < 15 ? 'medium' : 'high';
      
      return `
        <tr class="fade-in">
          <td>
            <div class="fw-semibold">${utils.escapeHtml(award.winner || 'N/A')}</div>
            ${award.email ? `<small class="text-muted">${utils.escapeHtml(award.email)}</small>` : ''}
          </td>
          <td>
            <span class="badge bg-primary-subtle text-primary">${award.year || '-'}</span>
          </td>
          <td>
            <strong>${utils.escapeHtml(award.award_name || award.award_category || '-')}</strong>
          </td>
          <td>
            <span class="badge bg-info-subtle text-info">
              <i class="bi bi-briefcase me-1"></i>${utils.escapeHtml(award.sector || '-')}
            </span>
          </td>
          <td>
            <span class="badge bg-success-subtle text-success">
              <i class="bi bi-geo-alt me-1"></i>${utils.escapeHtml(award.region || '-')}
            </span>
          </td>
          <td>${utils.getStatusBadge(award.status || 'Draft')}</td>
          <td class="text-center">
            <div class="assignment-count-badge ${countBadgeClass}" 
              title="${counts.nominated} nominated, ${counts.shortlisted} shortlisted, ${counts.winner} winner">
              <i class="bi bi-people-fill"></i>
              <span>${counts.total}</span>
            </div>
            ${counts.winner > 0 ? '<div class="mt-1"><span class="badge bg-success"><i class="bi bi-trophy-fill me-1"></i>Has Winner</span></div>' : ''}
          </td>
          <td class="text-center">
            <button 
              class="btn btn-sm btn-primary manage-nominees-btn mb-1" 
              onclick="assignmentsModule.openAssignmentsModal('${award.id}', '${utils.escapeHtml(award.award_name || award.award_category || 'Award').replace(/'/g, "\\'")}')">
              <i class="bi bi-people"></i> Manage
            </button>
            <div class="btn-group btn-group-sm" role="group">
              <button 
                class="btn btn-outline-primary btn-icon" 
                onclick="awardsModule.viewDetails('${award.id}')"
                title="View Details"
                aria-label="View award details">
                <i class="bi bi-eye"></i>
              </button>
              <button 
                class="btn btn-outline-success btn-icon" 
                onclick="awardsModule.approve('${award.id}')"
                title="Approve"
                aria-label="Approve award">
                <i class="bi bi-check-lg"></i>
              </button>
              <button 
                class="btn btn-outline-danger btn-icon" 
                onclick="awardsModule.deleteAward('${award.id}')"
                title="Delete"
                aria-label="Delete award">
                <i class="bi bi-trash"></i>
              </button>
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
  viewDetails(awardId) {
    const award = STATE.allAwards.find(a => a.id === awardId);
    if (!award) return;

    utils.showToast('View details feature coming soon!', 'info');
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
      
      // Supabase v2 syntax for update
      const { error } = await STATE.client
        .from('awards')
        .update({ status: STATUS.APPROVED })
        .eq('id', awardId);
      
      if (error) throw error;
      
      await this.loadAwards();
      utils.showToast('Award approved successfully!', 'success');

    } catch (error) {
      utils.showToast('Failed to approve award: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Delete an award
   * @param {string} awardId - Award ID
   */
  async deleteAward(awardId) {
    if (!utils.confirm('Are you sure you want to delete this award? This action cannot be undone.')) {
      return;
    }
    
    try {
      utils.showLoading();
      
      // Supabase v2 syntax for delete
      const { error } = await STATE.client
        .from('awards')
        .delete()
        .eq('id', awardId);
      
      if (error) throw error;
      
      await this.loadAwards();
      utils.showToast('Award deleted successfully', 'success');

    } catch (error) {
      utils.showToast('Failed to delete award: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  }
};

// Export to window for global access
window.awardsModule = awardsModule;
