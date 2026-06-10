/* ==================================================== */
/* SPONSOR PORTAL - Self-Service Sponsor Management     */
/* selectAll() is intentional for sponsors (small data-  */
/* set, typically <50 records) — pagination not needed.  */
/* ==================================================== */

const sponsorPortalModule = {
  TIERS: {
    Gold: {
      badge: 'warning',
      benefits: [
        'Logo on all event materials',
        'Premium website placement',
        'VIP table (10 seats)',
        'Social media features',
        'Post-event analytics report',
      ],
    },
    Silver: {
      badge: 'secondary',
      benefits: ['Logo on event materials', 'Website placement', 'Standard table (8 seats)', 'Social media mention'],
    },
    Bronze: { badge: 'danger', benefits: ['Logo in programme', 'Website listing', '4 complimentary tickets'] },
  },

  /* 1. SPONSOR DASHBOARD */
  async renderSponsorDashboard(sponsorId) {
    const el = document.getElementById('sponsorDashboard');
    if (!el) return;
    try {
      const [sponsorResult, stats, contractsResult] = await Promise.all([
        apiClient.select('sponsors', { select: '*', filters: { id: { eq: sponsorId } }, pageSize: 1 }),
        this.getImpressionStats(sponsorId),
        apiClient.select('sponsor_contracts', {
          select: '*',
          filters: { sponsor_id: { eq: sponsorId } },
          sort: { column: 'start_date', ascending: false },
          pageSize: 1,
        }),
      ]);
      const s = sponsorResult.data?.[0];
      if (!s) throw new Error('Sponsor not found');
      const contracts = contractsResult.data || [];
      const tier = this.TIERS[s.tier] || this.TIERS.Bronze;
      const c = contracts?.[0] || null;
      const roi = await this.calculateROI(sponsorId);
      el.innerHTML = `
        <div class="row g-3 mb-4">
          <div class="col-md-4"><div class="card h-100"><div class="card-body text-center">
            ${s.logo_url ? `<img src="${utils.escapeHtml(s.logo_url)}" alt="Logo" class="mb-3" style="max-height:80px;max-width:160px;object-fit:contain;">` : '<i class="bi bi-building display-4 text-muted d-block mb-3"></i>'}
            <h5 class="mb-1">${utils.escapeHtml(s.name)}</h5>
            <span class="badge bg-${tier.badge} mb-2">${utils.escapeHtml(s.tier)} Sponsor</span>
            <p class="small text-muted mb-0">${utils.escapeHtml(s.description || '')}</p>
          </div></div></div>
          <div class="col-md-4"><div class="card h-100"><div class="card-body">
            <h6 class="card-title text-muted">Contract Details</h6>
            ${c ? `<dl class="mb-0 small"><dt>Status</dt><dd>${utils.getStatusBadge(c.status)}</dd><dt>Period</dt><dd>${utils.formatDate(c.start_date)} &ndash; ${utils.formatDate(c.end_date)}</dd><dt>Value</dt><dd>&pound;${Number(c.amount || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</dd></dl>` : '<p class="text-muted small mb-0">No active contract.</p>'}
          </div></div></div>
          <div class="col-md-4"><div class="card h-100"><div class="card-body">
            <h6 class="card-title text-muted">Impression Stats</h6>
            <div class="d-flex flex-column gap-2">
              <div class="d-flex justify-content-between"><span class="small">Total Impressions</span><strong>${(stats.total || 0).toLocaleString()}</strong></div>
              <div class="d-flex justify-content-between"><span class="small">This Month</span><strong>${(stats.thisMonth || 0).toLocaleString()}</strong></div>
              <div class="d-flex justify-content-between"><span class="small">Cost / Impression</span><strong>${roi.costPerImpression}</strong></div>
              <div class="d-flex justify-content-between"><span class="small">Est. Clicks</span><strong>${roi.estimatedClicks.toLocaleString()}</strong></div>
            </div>
          </div></div></div>
        </div>
        <div class="card mb-3"><div class="card-body">
          <h6 class="card-title">Tier Benefits</h6>
          <ul class="list-unstyled mb-0">${tier.benefits.map((b) => `<li><i class="bi bi-check-circle-fill text-success me-2"></i>${utils.escapeHtml(b)}</li>`).join('')}</ul>
        </div></div>
        <div class="card"><div class="card-body">
          <h6 class="card-title">Upload Logo / Banner</h6>
          <div class="input-group">
            <input type="file" class="form-control" id="sponsorAssetFile" accept="image/*,.pdf">
            <button class="btn btn-primary" data-action="sponsorPortalModule.uploadSponsorAssetFromInput" data-id="${utils.escapeHtml(sponsorId)}">
              <i class="bi bi-cloud-upload me-1"></i>Upload
            </button>
          </div>
        </div></div>`;
    } catch (err) {
      console.error('renderSponsorDashboard:', err);
      utils.showToast('Failed to load sponsor dashboard', 'error');
    }
  },

  /* 2. ASSET UPLOAD */
  uploadSponsorAssetFromInput(sponsorId) {
    const file = document.getElementById('sponsorAssetFile')?.files[0];
    this.uploadSponsorAsset(sponsorId, file);
  },

  async uploadSponsorAsset(sponsorId, file) {
    if (!file) {
      utils.showToast('Please select a file first', 'warning');
      return null;
    }
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      utils.showToast('File too large. Maximum size is 10MB.', 'error');
      return null;
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      utils.showToast('Invalid file type. Please upload an image or PDF.', 'error');
      return null;
    }
    try {
      const path = `${sponsorId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const uploadResult = await apiClient.upload('sponsor-assets', path, file, { contentType: file.type });
      await apiClient.update('sponsors', sponsorId, { logo_url: uploadResult.publicUrl });
      utils.showToast('Asset uploaded successfully', 'success');
      return uploadResult.publicUrl;
    } catch (err) {
      console.error('uploadSponsorAsset:', err);
      utils.showToast('Upload failed: ' + err.message, 'error');
      return null;
    }
  },

  /* 3. IMPRESSION TRACKING */
  async trackImpression(sponsorId, page) {
    try {
      await apiClient.insert('sponsor_impressions', {
        sponsor_id: sponsorId,
        page: page || location.pathname,
        tracked_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('trackImpression:', err);
    }
  },

  async getImpressionStats(sponsorId) {
    try {
      /* selectAll: justified — scoped to single sponsor */
      const rows = await apiClient.selectAll('sponsor_impressions', {
        select: 'tracked_at, page',
        filters: { sponsor_id: { eq: sponsorId } },
      });
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const byPage = {};
      rows.forEach((r) => {
        byPage[r.page] = (byPage[r.page] || 0) + 1;
      });
      return { total: rows.length, thisMonth: rows.filter((r) => r.tracked_at >= monthStart).length, byPage };
    } catch (err) {
      console.error('getImpressionStats:', err);
      return { total: 0, thisMonth: 0, byPage: {} };
    }
  },

  /* 4. TIER MANAGEMENT (Admin) */
  async renderTierManagement() {
    const el = document.getElementById('tierManagement');
    if (!el) return;
    try {
      /* selectAll: justified — small reference table (sponsors, typically <50 records) */
      const sponsors = await apiClient.selectAll('sponsors', {
        select: 'id, name, tier, is_active, display_order',
        sort: { column: 'display_order', ascending: true },
      });
      const grouped = { Gold: [], Silver: [], Bronze: [] };
      (sponsors || []).forEach((s) => {
        if (grouped[s.tier]) grouped[s.tier].push(s);
      });
      el.innerHTML = Object.entries(this.TIERS)
        .map(
          ([key, tier]) => `
        <div class="card mb-3">
          <div class="card-header d-flex justify-content-between align-items-center">
            <span><span class="badge bg-${tier.badge} me-2">${key}</span><strong>${key} Tier</strong></span>
            <span class="badge bg-light text-dark">${grouped[key].length} sponsor${grouped[key].length !== 1 ? 's' : ''}</span>
          </div>
          <div class="card-body">
            <p class="small text-muted mb-2">${tier.benefits.join(' &bull; ')}</p>
            ${
              grouped[key].length === 0
                ? '<p class="text-muted small mb-0">No sponsors in this tier.</p>'
                : `
            <table class="table table-sm mb-0"><thead><tr><th>Name</th><th>Active</th><th>Order</th><th></th></tr></thead><tbody>
              ${grouped[key]
                .map(
                  (s) => `<tr>
                <td>${utils.escapeHtml(s.name)}</td>
                <td><span class="badge bg-${s.is_active ? 'success' : 'secondary'}">${s.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>${s.display_order}</td>
                <td><button class="btn btn-sm btn-outline-secondary" data-action="sponsorPortalModule.changeTier" data-args='${JSON.stringify([s.id, key])}'>Change Tier</button></td>
              </tr>`
                )
                .join('')}
            </tbody></table>`
            }
          </div>
        </div>`
        )
        .join('');
    } catch (err) {
      console.error('renderTierManagement:', err);
      utils.showToast('Failed to load tier management', 'error');
    }
  },

  async changeTier(sponsorId, currentTier) {
    const others = Object.keys(this.TIERS).filter((t) => t !== currentTier);
    const newTier = prompt(`Change tier from ${currentTier} to: (${others.join(' / ')})`);
    if (!newTier || !this.TIERS[newTier]) {
      utils.showToast('Invalid tier selected', 'warning');
      return;
    }
    try {
      await apiClient.update('sponsors', sponsorId, { tier: newTier });
      utils.showToast(`Tier updated to ${newTier}`, 'success');
      this.renderTierManagement();
    } catch (err) {
      utils.showToast('Failed to update tier: ' + err.message, 'error');
    }
  },

  /* 5. SPONSOR CONTRACTS */
  async renderContracts() {
    const el = document.getElementById('sponsorContracts');
    if (!el) return;
    try {
      /* selectAll: justified — small reference table (sponsor contracts) */
      const rows = await apiClient.selectAll('sponsor_contracts', {
        select: '*, sponsors(name, tier)',
        sort: { column: 'start_date', ascending: false },
      });
      el.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h6 class="mb-0">Sponsor Contracts</h6>
          <button class="btn btn-primary btn-sm" data-action="sponsorPortalModule.openContractModal"><i class="bi bi-plus-lg me-1"></i>New Contract</button>
        </div>
        ${
          rows.length === 0
            ? '<p class="text-muted">No contracts found.</p>'
            : `
        <div class="table-responsive"><table class="table table-hover align-middle">
          <thead class="table-light"><tr><th>Sponsor</th><th>Period</th><th>Amount</th><th>Status</th><th>Benefits</th><th></th></tr></thead>
          <tbody>${rows
            .map(
              (c) => `<tr>
            <td><strong>${utils.escapeHtml(c.sponsors?.name || '—')}</strong><small class="d-block text-muted">${utils.escapeHtml(c.sponsors?.tier || '')}</small></td>
            <td class="small">${utils.formatDate(c.start_date)}<br>${utils.formatDate(c.end_date)}</td>
            <td>&pound;${Number(c.amount || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
            <td>${utils.getStatusBadge(c.status)}</td>
            <td class="small">${utils.escapeHtml(c.benefits || '—')}</td>
            <td>
              <button class="btn btn-sm btn-outline-primary me-1" data-action="sponsorPortalModule.editContract" data-id="${c.id}"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-danger" data-action="sponsorPortalModule.deleteContract" data-id="${c.id}"><i class="bi bi-trash"></i></button>
            </td>
          </tr>`
            )
            .join('')}</tbody>
        </table></div>`
        }
        <div class="modal fade" id="contractModal" tabindex="-1">
          <div class="modal-dialog"><div class="modal-content">
            <div class="modal-header"><h5 class="modal-title" id="contractModalTitle">Contract</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
            <div class="modal-body" id="contractModalBody"></div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button class="btn btn-primary" data-action="sponsorPortalModule.saveContract">Save Contract</button>
            </div>
          </div></div>
        </div>`;
    } catch (err) {
      console.error('renderContracts:', err);
      utils.showToast('Failed to load contracts', 'error');
    }
  },

  async editContract(contractId) {
    try {
      /* selectAll: justified — scoped to single contract by ID */
      const contracts = await apiClient.selectAll('sponsor_contracts', { filters: { id: { eq: contractId } } });
      this.openContractModal(contracts?.[0] || null);
    } catch (err) {
      console.error('Failed to load contract:', err);
      utils.showToast('Failed to load contract details', 'danger');
    }
  },

  async openContractModal(contract = null) {
    try {
      /* selectAll: justified — small reference table (active sponsors for dropdown) */
      const sponsors = await apiClient.selectAll('sponsors', {
        select: 'id, name',
        filters: { is_active: { eq: true } },
        sort: { column: 'name', ascending: true },
      });
      const opts = sponsors
        .map(
          (s) =>
            `<option value="${s.id}"${contract?.sponsor_id === s.id ? ' selected' : ''}>${utils.escapeHtml(s.name)}</option>`
        )
        .join('');
      document.getElementById('contractModalTitle').textContent = contract ? 'Edit Contract' : 'New Contract';
      document.getElementById('contractModalBody').innerHTML = `
      <input type="hidden" id="contractId" value="${contract?.id || ''}">
      <div class="mb-3"><label class="form-label">Sponsor</label><select class="form-select" id="contractSponsor"><option value="">Select sponsor...</option>${opts}</select></div>
      <div class="row g-2 mb-3">
        <div class="col"><label class="form-label">Start Date</label><input type="date" class="form-control" id="contractStart" value="${contract?.start_date?.slice(0, 10) || ''}"></div>
        <div class="col"><label class="form-label">End Date</label><input type="date" class="form-control" id="contractEnd" value="${contract?.end_date?.slice(0, 10) || ''}"></div>
      </div>
      <div class="mb-3"><label class="form-label">Amount (&pound;)</label><input type="number" class="form-control" id="contractAmount" value="${contract?.amount || ''}" min="0" step="0.01"></div>
      <div class="mb-3"><label class="form-label">Status</label>
        <select class="form-select" id="contractStatus">${['Active', 'Pending', 'Completed', 'Cancelled'].map((s) => `<option${contract?.status === s ? ' selected' : ''}>${s}</option>`).join('')}</select></div>
      <div class="mb-3"><label class="form-label">Benefits</label><textarea class="form-control" id="contractBenefits" rows="3">${utils.escapeHtml(contract?.benefits || '')}</textarea></div>`;
      new bootstrap.Modal(document.getElementById('contractModal')).show();
    } catch (err) {
      console.error('Failed to open contract modal:', err);
      utils.showToast('Failed to load contract form', 'danger');
    }
  },

  async saveContract() {
    const id = document.getElementById('contractId').value;
    const payload = {
      sponsor_id: document.getElementById('contractSponsor').value,
      start_date: document.getElementById('contractStart').value,
      end_date: document.getElementById('contractEnd').value,
      amount: parseFloat(document.getElementById('contractAmount').value) || 0,
      status: document.getElementById('contractStatus').value,
      benefits: document.getElementById('contractBenefits').value,
    };
    try {
      if (id) {
        await apiClient.update('sponsor_contracts', id, payload);
      } else {
        await apiClient.insert('sponsor_contracts', payload);
      }
    } catch (err) {
      console.warn('DB save for contract failed, using localStorage:', err);
      const key = 'bta_sponsor_contracts';
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      payload.id = id || crypto.randomUUID();
      const idx = stored.findIndex((c) => c.id === payload.id);
      if (idx >= 0) stored[idx] = payload;
      else stored.push(payload);
      localStorage.setItem(key, JSON.stringify(stored));
    }
    bootstrap.Modal.getInstance(document.getElementById('contractModal'))?.hide();
    utils.showToast(id ? 'Contract updated' : 'Contract created', 'success');
    this.renderContracts();
  },

  async deleteContract(id) {
    if (
      !(await utils.confirmDialog({
        title: 'Delete Contract',
        message: 'Delete this contract? This cannot be undone.',
        confirmText: 'Delete',
        danger: true,
      }))
    )
      return;
    try {
      await apiClient.delete('sponsor_contracts', id);
      utils.showToast('Contract deleted', 'success');
      this.renderContracts();
    } catch (err) {
      utils.showToast('Failed to delete contract: ' + err.message, 'error');
    }
  },

  /* 6. PUBLIC SPONSOR WIDGET */
  async renderSponsorWidget(containerId, tier = null) {
    const el = document.getElementById(containerId);
    if (!el) return;
    try {
      const filters = { is_active: { eq: true } };
      if (tier) filters.tier = { eq: tier };
      /* selectAll: justified — small reference table (active sponsors for public widget) */
      const sponsors = await apiClient.selectAll('sponsors', {
        select: 'id, name, logo_url, website, tier',
        filters,
        sort: { column: 'display_order', ascending: true },
      });
      if (!sponsors.length) {
        el.innerHTML = '';
        return;
      }
      el.innerHTML = `
        <div class="sponsor-widget">
          <h6 class="text-center text-muted mb-3">${tier ? utils.escapeHtml(tier) + ' Sponsors' : 'Our Sponsors'}</h6>
          <div class="d-flex flex-wrap justify-content-center align-items-center gap-4">
            ${sponsors
              .map(
                (s) => `
              <a href="${s.website ? utils.escapeHtml(s.website) : '#'}" target="_blank" rel="noopener" title="${utils.escapeHtml(s.name)}"
                 data-action="sponsorPortalModule.trackImpression" data-id="${s.id}" data-source="widget:${containerId}">
                ${
                  s.logo_url
                    ? `<img src="${utils.escapeHtml(s.logo_url)}" alt="${utils.escapeHtml(s.name)}" style="max-height:60px;max-width:140px;object-fit:contain;" loading="lazy">`
                    : `<span class="badge bg-secondary fs-6">${utils.escapeHtml(s.name)}</span>`
                }
              </a>`
              )
              .join('')}
          </div>
        </div>`;
      sponsors.forEach((s) => this.trackImpression(s.id, `widget:${containerId}`));
    } catch (err) {
      console.error('renderSponsorWidget:', err);
    }
  },

  /* 7. ROI CALCULATOR */
  async calculateROI(sponsorId) {
    try {
      const [stats, contractsResult] = await Promise.all([
        this.getImpressionStats(sponsorId),
        apiClient.select('sponsor_contracts', {
          select: 'amount',
          filters: { sponsor_id: { eq: sponsorId }, status: { eq: 'Active' } },
          pageSize: 1,
        }),
      ]);
      const totalAmount = parseFloat(contractsResult.data?.[0]?.amount || 0);
      const totalImpressions = stats.total || 0;
      const estimatedClicks = Math.round(totalImpressions * 0.025);
      const costPerImpression = totalImpressions > 0 ? `\u00a3${(totalAmount / totalImpressions).toFixed(4)}` : 'N/A';
      const costPerClick = estimatedClicks > 0 ? `\u00a3${(totalAmount / estimatedClicks).toFixed(2)}` : 'N/A';
      return { totalImpressions, estimatedClicks, costPerImpression, costPerClick, totalSpend: totalAmount, stats };
    } catch (err) {
      console.error('calculateROI:', err);
      return {
        totalImpressions: 0,
        estimatedClicks: 0,
        costPerImpression: 'N/A',
        costPerClick: 'N/A',
        totalSpend: 0,
        stats: {},
      };
    }
  },
  /* 8. SPONSORSHIP ENQUIRIES */

  _enquiryStatusBadge(status) {
    const map = { new: 'primary', contacted: 'warning', converted: 'success', rejected: 'secondary' };
    const colour = map[status] || 'secondary';
    const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'New';
    return `<span class="badge bg-${colour}">${utils.escapeHtml(label)}</span>`;
  },

  async renderEnquiries() {
    const el = document.getElementById('sponsorEnquiriesView');
    if (!el) return;
    el.innerHTML =
      '<div class="text-center py-5"><div class="spinner-border text-secondary" role="status"><span class="visually-hidden">Loading…</span></div></div>';
    try {
      /* selectAll: justified — sponsor enquiries are a small admin dataset */
      const rows = await apiClient.selectAll('sponsor_enquiries', {
        select: '*',
        sort: { column: 'created_at', ascending: false },
      });

      const newCount = (rows || []).filter((r) => r.status === 'new').length;
      const badge = document.getElementById('enquiriesNewBadge');
      if (badge) {
        badge.textContent = newCount;
        badge.hidden = newCount === 0;
      }

      if (!rows || rows.length === 0) {
        el.innerHTML = `
          <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h4 class="mb-1"><i class="bi bi-envelope-check me-2"></i>Sponsorship Enquiries</h4>
              <p class="text-muted mb-0 small">Submitted via the "Become a Sponsor" page</p>
            </div>
          </div>
          <div class="text-center py-5 text-muted">
            <i class="bi bi-inbox display-4 d-block mb-3 opacity-25"></i>
            <p class="mb-1 fw-semibold">No sponsorship enquiries yet.</p>
            <p class="small mb-0">Enquiries submitted via <code>become-a-sponsor.html</code> will appear here.</p>
          </div>`;
        return;
      }

      el.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
          <div>
            <h4 class="mb-1"><i class="bi bi-envelope-check me-2"></i>Sponsorship Enquiries</h4>
            <p class="text-muted mb-0 small">Submitted via the "Become a Sponsor" page &mdash; ${rows.length} total, ${newCount} new</p>
          </div>
          <div class="d-flex gap-2 align-items-center">
            <select class="form-select form-select-sm" id="enquiryStatusFilter" style="width:auto;" aria-label="Filter by status">
              <option value="">All statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="converted">Converted</option>
              <option value="rejected">Rejected</option>
            </select>
            <button class="btn btn-outline-secondary btn-sm" data-action="sponsorPortalModule.renderEnquiries">
              <i class="bi bi-arrow-clockwise me-1"></i>Refresh
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table table-hover align-middle" id="enquiriesTable">
            <thead class="table-light">
              <tr>
                <th style="white-space:nowrap;">Date</th>
                <th>Company</th>
                <th>Contact</th>
                <th>Package</th>
                <th>Status</th>
                <th style="width:110px;"></th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (r) => `
              <tr data-status="${utils.escapeHtml(r.status || 'new')}">
                <td class="small text-muted" style="white-space:nowrap;">${utils.formatDate(r.created_at)}</td>
                <td>
                  <strong>${utils.escapeHtml(r.company)}</strong>
                  ${r.role ? `<small class="d-block text-muted">${utils.escapeHtml(r.role)}</small>` : ''}
                </td>
                <td>
                  ${utils.escapeHtml(r.name)}
                  <small class="d-block"><a href="mailto:${utils.escapeHtml(r.email)}">${utils.escapeHtml(r.email)}</a></small>
                  ${r.phone ? `<small class="d-block text-muted">${utils.escapeHtml(r.phone)}</small>` : ''}
                </td>
                <td><span class="badge bg-dark text-wrap" style="max-width:140px;white-space:normal;">${utils.escapeHtml(r.package)}</span></td>
                <td>${this._enquiryStatusBadge(r.status)}</td>
                <td>
                  <button class="btn btn-sm btn-outline-primary me-1"
                    data-action="sponsorPortalModule.viewEnquiry"
                    data-id="${utils.escapeHtml(r.id)}"
                    title="View / edit">
                    <i class="bi bi-eye"></i>
                  </button>
                  <div class="d-inline-block">
                    <div class="dropdown">
                      <button class="btn btn-sm btn-outline-secondary dropdown-toggle"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                        title="Change status">
                        <i class="bi bi-pencil"></i>
                      </button>
                      <ul class="dropdown-menu dropdown-menu-end">
                        ${['new', 'contacted', 'converted', 'rejected']
                          .map(
                            (s) => `<li>
                          <button class="dropdown-item${r.status === s ? ' active' : ''}"
                            data-action="sponsorPortalModule.updateEnquiryStatus"
                            data-args='${JSON.stringify([r.id, s])}'>
                            ${this._enquiryStatusBadge(s)} ${s.charAt(0).toUpperCase() + s.slice(1)}
                          </button></li>`
                          )
                          .join('')}
                      </ul>
                    </div>
                  </div>
                </td>
              </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;

      const filterEl = document.getElementById('enquiryStatusFilter');
      if (filterEl) {
        filterEl.addEventListener('change', function () {
          const val = this.value;
          document.querySelectorAll('#enquiriesTable tbody tr').forEach((row) => {
            row.style.display = !val || row.dataset.status === val ? '' : 'none';
          });
        });
      }
    } catch (err) {
      console.error('renderEnquiries:', err);
      el.innerHTML = `<div class="alert alert-danger">Failed to load enquiries: ${utils.escapeHtml(err.message)}</div>`;
    }
  },

  async viewEnquiry(id) {
    try {
      const rows = await apiClient.selectAll('sponsor_enquiries', {
        select: '*',
        filters: { id: { eq: id } },
      });
      const r = rows?.[0];
      if (!r) {
        utils.showToast('Enquiry not found', 'error');
        return;
      }
      const statusMap = { new: 'primary', contacted: 'warning', converted: 'success', rejected: 'secondary' };
      const modalBody = document.getElementById('enquiryDetailModalBody');
      if (!modalBody) return;
      modalBody.innerHTML = `
        <div class="row g-3">
          <div class="col-md-6">
            <div class="card h-100">
              <div class="card-body">
                <h6 class="card-title text-muted small text-uppercase mb-3">Contact Details</h6>
                <dl class="row g-1 mb-0 small">
                  <dt class="col-sm-4 fw-semibold">Name</dt><dd class="col-sm-8">${utils.escapeHtml(r.name)}</dd>
                  <dt class="col-sm-4 fw-semibold">Company</dt><dd class="col-sm-8"><strong>${utils.escapeHtml(r.company)}</strong></dd>
                  ${r.role ? `<dt class="col-sm-4 fw-semibold">Role</dt><dd class="col-sm-8">${utils.escapeHtml(r.role)}</dd>` : ''}
                  <dt class="col-sm-4 fw-semibold">Email</dt><dd class="col-sm-8"><a href="mailto:${utils.escapeHtml(r.email)}">${utils.escapeHtml(r.email)}</a></dd>
                  ${r.phone ? `<dt class="col-sm-4 fw-semibold">Phone</dt><dd class="col-sm-8">${utils.escapeHtml(r.phone)}</dd>` : ''}
                  <dt class="col-sm-4 fw-semibold">Package</dt><dd class="col-sm-8"><span class="badge bg-dark">${utils.escapeHtml(r.package)}</span></dd>
                  <dt class="col-sm-4 fw-semibold">Date</dt><dd class="col-sm-8">${utils.formatDate(r.created_at)}</dd>
                  <dt class="col-sm-4 fw-semibold">Status</dt><dd class="col-sm-8">${this._enquiryStatusBadge(r.status)}</dd>
                </dl>
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="card h-100">
              <div class="card-body">
                <h6 class="card-title text-muted small text-uppercase mb-2">Message</h6>
                <p class="small mb-0">${r.message ? utils.escapeHtml(r.message).replace(/\n/g, '<br>') : '<em class="text-muted">No message provided.</em>'}</p>
              </div>
            </div>
          </div>
          <div class="col-12">
            <div class="card">
              <div class="card-body">
                <h6 class="card-title text-muted small text-uppercase mb-2">Internal Notes</h6>
                <textarea class="form-control form-control-sm mb-3" id="enquiryNotesField" rows="3"
                  placeholder="Add notes for your team…">${utils.escapeHtml(r.notes || '')}</textarea>
                <div class="d-flex flex-wrap gap-2 align-items-center">
                  <button class="btn btn-sm btn-primary"
                    data-action="sponsorPortalModule.saveEnquiryNotes"
                    data-id="${utils.escapeHtml(r.id)}">
                    <i class="bi bi-floppy me-1"></i>Save Notes
                  </button>
                  <span class="text-muted small">Update status:</span>
                  ${['new', 'contacted', 'converted', 'rejected']
                    .map(
                      (
                        s
                      ) => `<button class="btn btn-sm btn-outline-${statusMap[s] || 'secondary'}${r.status === s ? ' active' : ''}"
                      data-action="sponsorPortalModule.updateEnquiryStatus"
                      data-args='${JSON.stringify([r.id, s])}'>
                      ${s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>`
                    )
                    .join('')}
                </div>
              </div>
            </div>
          </div>
        </div>`;
      new bootstrap.Modal(document.getElementById('enquiryDetailModal')).show();
    } catch (err) {
      console.error('viewEnquiry:', err);
      utils.showToast('Failed to load enquiry: ' + err.message, 'error');
    }
  },

  async updateEnquiryStatus(id, status) {
    try {
      await apiClient.update('sponsor_enquiries', id, { status });
      utils.showToast(`Status updated to "${status}"`, 'success');
      bootstrap.Modal.getInstance(document.getElementById('enquiryDetailModal'))?.hide();
      this.renderEnquiries();
    } catch (err) {
      utils.showToast('Failed to update status: ' + err.message, 'error');
    }
  },

  async saveEnquiryNotes(id) {
    const notes = document.getElementById('enquiryNotesField')?.value ?? '';
    try {
      await apiClient.update('sponsor_enquiries', id, { notes });
      utils.showToast('Notes saved', 'success');
    } catch (err) {
      utils.showToast('Failed to save notes: ' + err.message, 'error');
    }
  },
};
ModuleRegistry.register('sponsorPortalModule', sponsorPortalModule);

export { sponsorPortalModule };
