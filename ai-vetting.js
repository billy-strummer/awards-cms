/* ==================================================== */
/* AI VETTING MODULE */
/* ==================================================== */

const aiVettingModule = {
  currentFilter: 'all',
  allResults: [],
  isVetting: false,

  /**
   * Open AI Vetting Modal
   * @returns {Promise<void>}
   */
  async openVettingModal() {
    const modal = new bootstrap.Modal(document.getElementById('aiVettingModal'));
    modal.show();

    // API key is now server-side - no client-side config needed
    document.getElementById('vettingConfigAlert').style.display = 'none';

    // Load existing results
    await this.loadVettingResults();
    await this.updateDashboardCard();
  },

  /**
   * Load vetting results from database
   * @returns {Promise<void>}
   */
  async loadVettingResults() {
    try {
      // Get latest vetting results
      const { data: results, error } = await STATE.client
        .from('ai_vetting_results')
        .select('*')
        .order('vetting_date', { ascending: false });

      if (error) throw error;

      this.allResults = results || [];
      this.renderResults();
      this.updateSummaryCards();

      // Get last run info
      const { data: lastRun } = await STATE.client
        .from('ai_vetting_runs')
        .select('*')
        .order('start_time', { ascending: false })
        .limit(1)
        .single();

      if (lastRun) {
        const lastRunTime = new Date(lastRun.start_time).toLocaleString();
        document.getElementById('vettingModalLastRun').textContent = lastRunTime;
      }

    } catch (error) {
      console.error('Error loading vetting results:', error);
      utils.showErrorWithRetry(error, 'loading vetting results', () => this.loadVettingResults());
    }
  },

  /**
   * Update summary cards
   */
  updateSummaryCards() {
    const verified = this.allResults.filter(r => r.status === 'verified' && !r.dismissed).length;
    const flagged = this.allResults.filter(r => r.status === 'flagged' && !r.dismissed).length;
    const total = this.allResults.length;

    document.getElementById('vettingVerifiedCount').textContent = verified;
    document.getElementById('vettingModalFlaggedCount').textContent = flagged;
    document.getElementById('vettingTotalCount').textContent = total;

    // Update filter badges
    document.getElementById('filterAllCount').textContent = total;
    document.getElementById('filterFlaggedCount').textContent = flagged;
    document.getElementById('filterVerifiedCount').textContent = verified;
  },

  /**
   * Filter results
   * @param {string} filter - Filter type ('all', 'flagged', 'verified')
   */
  filterResults(filter) {
    this.currentFilter = filter;

    // Update button states
    document.querySelectorAll('.btn-group button').forEach(btn => {
      btn.classList.remove('active');
    });
    event.target.closest('button').classList.add('active');

    this.renderResults();
  },

  /**
   * Render results table
   */
  renderResults() {
    const tbody = document.getElementById('vettingResultsTableBody');

    // Filter results based on current filter
    let filtered = this.allResults;
    if (this.currentFilter === 'flagged') {
      filtered = this.allResults.filter(r => r.status === 'flagged' && !r.dismissed);
    } else if (this.currentFilter === 'verified') {
      filtered = this.allResults.filter(r => r.status === 'verified' && !r.dismissed);
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-5">
            <div class="text-muted">
              <i class="bi bi-inbox display-4 d-block mb-3 opacity-25"></i>
              <p class="mb-0">No ${this.currentFilter} results found.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(result => {
      const statusBadge = result.status === 'flagged'
        ? '<span class="badge bg-danger">Flagged</span>'
        : '<span class="badge bg-success">Verified</span>';

      const operationalBadge = result.is_operational
        ? '<span class="badge bg-success"><i class="bi bi-check-circle"></i></span>'
        : '<span class="badge bg-danger"><i class="bi bi-x-circle"></i></span>';

      const categoryBadge = result.category_match
        ? '<span class="badge bg-success"><i class="bi bi-check-circle"></i></span>'
        : '<span class="badge bg-warning"><i class="bi bi-exclamation-circle"></i></span>';

      const reputationStars = '⭐'.repeat(result.reputation_score || 0);

      return `
        <tr>
          <td>
            <div class="fw-semibold">${utils.escapeHtml(result.company_name)}</div>
            <small class="text-muted">${new Date(result.vetting_date).toLocaleDateString()}</small>
          </td>
          <td>${utils.escapeHtml(result.sector || 'N/A')}</td>
          <td class="text-center">${statusBadge}</td>
          <td class="text-center">${operationalBadge}</td>
          <td class="text-center">${categoryBadge}</td>
          <td class="text-center" title="Reputation: ${result.reputation_score}/10">${reputationStars}</td>
          <td>
            <div class="small">
              ${result.ai_recommendation ? `
                <div class="mb-1"><strong>Recommendation:</strong> ${utils.escapeHtml(result.ai_recommendation)}</div>
              ` : ''}
              ${result.recent_news ? `
                <div class="mb-1"><strong>News:</strong> ${utils.escapeHtml(result.recent_news.substring(0, 100))}...</div>
              ` : ''}
              ${result.ownership_changes ? `
                <div><strong>Changes:</strong> ${utils.escapeHtml(result.ownership_changes.substring(0, 100))}...</div>
              ` : ''}
            </div>
          </td>
          <td class="text-center">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" onclick="aiVettingModule.viewDetails('${result.id}')" title="View full details">
                <i class="bi bi-eye"></i>
              </button>
              ${result.status === 'flagged' ? `
                <button class="btn btn-outline-success" onclick="aiVettingModule.dismissFlag('${result.id}')" title="Dismiss flag">
                  <i class="bi bi-check"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  /**
   * Run AI vetting for all companies
   * @returns {Promise<void>}
   */
  async runVetting() {
    if (this.isVetting) {
      utils.showToast('Vetting is already in progress', 'warning');
      return;
    }

    this.isVetting = true;
    document.getElementById('runVettingBtn').disabled = true;
    document.getElementById('vettingProgressSection').style.display = 'block';

    try {
      // Create vetting run record
      const { data: vettingRun, error: runError } = await STATE.client
        .from('ai_vetting_runs')
        .insert({
          total_companies: STATE.allOrganisations.length,
          status: 'running'
        })
        .select()
        .single();

      if (runError) throw runError;

      let vettedCount = 0;
      let flaggedCount = 0;
      const total = STATE.allOrganisations.length;

      // Vet each company
      for (const org of STATE.allOrganisations) {
        // Update progress
        vettedCount++;
        const progress = Math.round((vettedCount / total) * 100);
        document.getElementById('vettingProgressBar').style.width = `${progress}%`;
        document.getElementById('vettingProgressBar').textContent = `${progress}%`;
        document.getElementById('vettingProgressCount').textContent = `${vettedCount} / ${total}`;
        document.getElementById('vettingProgressText').textContent = 'Vetting companies...';
        document.getElementById('vettingCurrentCompany').textContent = `Currently vetting: ${org.company_name}`;

        // Vet company via server-side proxy
        const result = await this.vetSingleCompany(org);

        if (result.status === 'flagged') {
          flaggedCount++;
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Update vetting run record
      await STATE.client
        .from('ai_vetting_runs')
        .update({
          end_time: new Date().toISOString(),
          companies_vetted: vettedCount,
          companies_flagged: flaggedCount,
          status: 'completed'
        })
        .eq('id', vettingRun.id);

      // Reload results
      await this.loadVettingResults();
      await this.updateDashboardCard();

      utils.showToast(`Vetting complete! ${flaggedCount} companies flagged.`, 'success');

    } catch (error) {
      console.error('Error running vetting:', error);
      utils.showToast('Failed to complete vetting: ' + error.message, 'error');
    } finally {
      this.isVetting = false;
      document.getElementById('runVettingBtn').disabled = false;
      document.getElementById('vettingProgressSection').style.display = 'none';
    }
  },

  /**
   * Vet a single company using Claude API
   * @param {Object} org - Organisation object with company_name, website, sector, region
   * @returns {Promise<Object>} Vetting result with status
   */
  async vetSingleCompany(org) {
    try {
      // Call server-side proxy (keeps API key on server)
      const { data: aiResult, error: fnError } = await STATE.client.functions.invoke('vet-company', {
        body: {
          companyName: org.company_name,
          website: org.website || '',
          sector: org.sector || '',
          county: org.region || ''
        }
      });

      if (fnError) throw fnError;

      // Determine status
      const status = (!aiResult.is_operational || !aiResult.category_match || aiResult.reputation_score < 5)
        ? 'flagged'
        : 'verified';

      // Save to database
      const { data: result, error } = await STATE.client
        .from('ai_vetting_results')
        .insert({
          organisation_id: org.id,
          company_name: org.company_name,
          sector: org.sector,
          is_operational: aiResult.is_operational,
          category_match: aiResult.category_match,
          reputation_score: aiResult.reputation_score,
          recent_news: aiResult.recent_news,
          ownership_changes: aiResult.ownership_changes,
          ai_recommendation: aiResult.recommendation,
          confidence_score: aiResult.confidence_score,
          status: status,
          raw_response: aiResult
        })
        .select()
        .single();

      if (error) throw error;

      return result;

    } catch (error) {
      console.error(`Error vetting ${org.company_name}:`, error);

      // Save error result
      await STATE.client
        .from('ai_vetting_results')
        .insert({
          organisation_id: org.id,
          company_name: org.company_name,
          sector: org.sector,
          status: 'needs_review',
          ai_recommendation: `Error during vetting: ${error.message}`
        });

      return { status: 'needs_review' };
    }
  },

  /**
   * View full details of a vetting result
   * @param {string} resultId - The ID of the vetting result to view
   * @returns {Promise<void>}
   */
  async viewDetails(resultId) {
    const result = this.allResults.find(r => r.id === resultId);
    if (!result) return;

    const detailsHtml = `
      <div class="modal-body">
        <h5>${utils.escapeHtml(result.company_name)}</h5>
        <p class="text-muted">${utils.escapeHtml(result.sector || 'N/A')}</p>
        <hr>

        <div class="mb-3">
          <strong>Vetted:</strong> ${new Date(result.vetting_date).toLocaleString()}
        </div>

        <div class="mb-3">
          <strong>Operational:</strong> ${result.is_operational ? '✅ Yes' : '❌ No'}
        </div>

        <div class="mb-3">
          <strong>Category Match:</strong> ${result.category_match ? '✅ Yes' : '⚠️ No'}
        </div>

        <div class="mb-3">
          <strong>Reputation Score:</strong> ${result.reputation_score}/10
        </div>

        <div class="mb-3">
          <strong>Confidence:</strong> ${(result.confidence_score * 100).toFixed(0)}%
        </div>

        ${result.recent_news ? `
          <div class="mb-3">
            <strong>Recent News:</strong>
            <p>${utils.escapeHtml(result.recent_news)}</p>
          </div>
        ` : ''}

        ${result.ownership_changes ? `
          <div class="mb-3">
            <strong>Ownership Changes:</strong>
            <p>${utils.escapeHtml(result.ownership_changes)}</p>
          </div>
        ` : ''}

        <div class="mb-3">
          <strong>AI Recommendation:</strong>
          <p>${utils.escapeHtml(result.ai_recommendation)}</p>
        </div>
      </div>
    `;

    // Show in a new modal (simple alert for now)
    const detailModal = document.createElement('div');
    detailModal.innerHTML = detailsHtml;

    utils.showToast('View details feature - full details loaded', 'info');
  },

  /**
   * Dismiss a flag
   * @param {string} resultId - The ID of the flagged vetting result to dismiss
   * @returns {Promise<void>}
   */
  async dismissFlag(resultId) {
    if (!await utils.confirmDialog({ title: 'Dismiss Flag', message: 'Are you sure you want to dismiss this flag?', confirmText: 'Dismiss', danger: false })) return;

    try {
      const { error } = await STATE.client
        .from('ai_vetting_results')
        .update({
          dismissed: true,
          dismissed_at: new Date().toISOString(),
          status: 'verified'
        })
        .eq('id', resultId);

      if (error) throw error;

      await this.loadVettingResults();
      await this.updateDashboardCard();
      utils.showToast('Flag dismissed', 'success');

    } catch (error) {
      console.error('Error dismissing flag:', error);
      utils.showToast('Failed to dismiss flag', 'error');
    }
  },

  /**
   * Export results to CSV
   */
  exportResults() {
    if (this.allResults.length === 0) {
      utils.showToast('No results to export', 'warning');
      return;
    }

    const headers = ['Company Name', 'Sector', 'Status', 'Operational', 'Category Match', 'Reputation', 'Recent News', 'Ownership Changes', 'Recommendation', 'Vetted Date'];

    const rows = this.allResults.map(r => [
      r.company_name,
      r.sector || '',
      r.status,
      r.is_operational ? 'Yes' : 'No',
      r.category_match ? 'Yes' : 'No',
      r.reputation_score || '',
      r.recent_news || '',
      r.ownership_changes || '',
      r.ai_recommendation || '',
      new Date(r.vetting_date).toLocaleDateString()
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ai-vetting-results-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    utils.showToast('Results exported successfully', 'success');
  },

  /**
   * Update dashboard card with latest stats
   * @returns {Promise<void>}
   */
  async updateDashboardCard() {
    try {
      const { data: results } = await STATE.client
        .from('ai_vetting_results')
        .select('status, dismissed, vetting_date')
        .order('vetting_date', { ascending: false });

      const flagged = results?.filter(r => r.status === 'flagged' && !r.dismissed).length || 0;
      document.getElementById('vettingFlaggedCount').textContent = flagged;

      // Update last run time
      if (results && results.length > 0) {
        const lastRun = new Date(results[0].vetting_date);
        const timeAgo = this.getTimeAgo(lastRun);
        document.getElementById('vettingLastRun').textContent = timeAgo;
      }

    } catch (error) {
      console.error('Error updating dashboard card:', error);
    }
  },

  /**
   * Get time ago string
   * @param {Date} date - The date to calculate relative time from
   * @returns {string} Human-readable relative time (e.g. "2 hours ago")
   */
  getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
      }
    }

    return 'Just now';
  }
};

// Export to window
ModuleRegistry.register('aiVettingModule', aiVettingModule);

export { aiVettingModule };
