/* ==================================================== */
/* MARKETING & ADVERTISING MODULE */
/* ==================================================== */

const marketingModule = {
  currentBanners: [],
  currentSponsors: [],

  /* ==================================================== */
  /* INITIALIZATION */
  /* ==================================================== */

  /**
   * Load all marketing data when tab is opened
   */
  async loadAllData() {
    try {
      utils.showLoading();
      await Promise.all([
        this.loadBanners(),
        this.loadSponsors()
      ]);
      console.log('✅ Marketing data loaded');
    } catch (error) {
      console.error('Error loading marketing data:', error);
      utils.showToast('Failed to load marketing data', 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /* ==================================================== */
  /* BANNERS MANAGEMENT */
  /* ==================================================== */

  /**
   * Load all banners
   */
  async loadBanners() {
    try {
      const { data, error } = await STATE.client
        .from('banners')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;

      this.currentBanners = data || [];
      this.renderBanners();
    } catch (error) {
      console.error('Error loading banners:', error);
      document.getElementById('bannersGrid').innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>
          Failed to load banners: ${error.message}
        </div>
      `;
    }
  },

  /**
   * Render banners grid
   */
  renderBanners() {
    const container = document.getElementById('bannersGrid');

    if (this.currentBanners.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          No banners found. Click "Add Banner" to create your first advertising banner.
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="row g-4">
        ${this.currentBanners.map(banner => this.renderBannerCard(banner)).join('')}
      </div>
    `;
  },

  /**
   * Render single banner card
   */
  renderBannerCard(banner) {
    const isActive = banner.is_active &&
      (!banner.end_date || new Date(banner.end_date) >= new Date());

    const statusBadge = isActive ?
      '<span class="badge bg-success">Active</span>' :
      '<span class="badge bg-secondary">Inactive</span>';

    return `
      <div class="col-md-6 col-lg-4">
        <div class="card h-100">
          <img src="${banner.image_url}" class="card-img-top" alt="${utils.escapeHtml(banner.title)}"
            style="height: 200px; object-fit: cover; cursor: pointer;"
            onclick="marketingModule.viewBannerFull('${banner.image_url}', '${utils.escapeHtml(banner.title)}')">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h6 class="card-title mb-0">${utils.escapeHtml(banner.title)}</h6>
              ${statusBadge}
            </div>
            <p class="card-text small text-muted mb-2">
              <span class="badge bg-primary-subtle text-primary">${banner.position}</span>
              ${banner.width && banner.height ? `<span class="ms-2">${banner.width}x${banner.height}px</span>` : ''}
            </p>
            ${banner.link_url ? `
              <p class="card-text small mb-2">
                <i class="bi bi-link-45deg"></i>
                <a href="${banner.link_url}" target="_blank" class="text-truncate d-inline-block" style="max-width: 200px;">
                  ${utils.escapeHtml(banner.link_url)}
                </a>
              </p>
            ` : ''}
            <div class="d-flex justify-content-between align-items-center small text-muted mb-3">
              <span><i class="bi bi-eye"></i> ${banner.impressions || 0}</span>
              <span><i class="bi bi-cursor"></i> ${banner.clicks || 0}</span>
              ${banner.start_date ? `<span><i class="bi bi-calendar"></i> ${utils.formatDate(banner.start_date)}</span>` : ''}
            </div>
            <div class="btn-group w-100" role="group">
              <button class="btn btn-sm btn-outline-primary" onclick="marketingModule.editBanner('${banner.id}')">
                <i class="bi bi-pencil"></i> Edit
              </button>
              <button class="btn btn-sm ${isActive ? 'btn-outline-warning' : 'btn-outline-success'}"
                onclick="marketingModule.toggleBannerActive('${banner.id}', ${!isActive})">
                <i class="bi bi-${isActive ? 'pause' : 'play'}"></i> ${isActive ? 'Pause' : 'Activate'}
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="marketingModule.deleteBanner('${banner.id}')">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Open add banner modal
   */
  openAddBannerModal(existingBanner = null) {
    const isEdit = !!existingBanner;
    const title = isEdit ? 'Edit Banner' : 'Add New Banner';
    const btnText = isEdit ? 'Save Changes' : 'Create Banner';

    const modalHtml = `
      <div class="modal fade" id="bannerFormModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title"><i class="bi bi-image me-2"></i>${title}</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="bannerForm">
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Title <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" id="bannerTitle" required value="${isEdit ? utils.escapeHtml(existingBanner.title) : ''}" placeholder="Banner title">
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Position</label>
                    <select class="form-select" id="bannerPosition">
                      <option value="header" ${isEdit && existingBanner.position === 'header' ? 'selected' : ''}>Header</option>
                      <option value="sidebar" ${isEdit && existingBanner.position === 'sidebar' ? 'selected' : ''}>Sidebar</option>
                      <option value="footer" ${isEdit && existingBanner.position === 'footer' ? 'selected' : ''}>Footer</option>
                      <option value="inline" ${isEdit && existingBanner.position === 'inline' ? 'selected' : ''}>Inline</option>
                      <option value="popup" ${isEdit && existingBanner.position === 'popup' ? 'selected' : ''}>Popup</option>
                    </select>
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Image URL <span class="text-danger">*</span></label>
                  <input type="url" class="form-control" id="bannerImageUrl" required value="${isEdit ? (existingBanner.image_url || '') : ''}" placeholder="https://example.com/banner.jpg">
                </div>
                <div class="mb-3">
                  <label class="form-label">Link URL</label>
                  <input type="url" class="form-control" id="bannerLinkUrl" value="${isEdit ? (existingBanner.link_url || '') : ''}" placeholder="https://example.com/landing-page">
                </div>
                <div class="row">
                  <div class="col-md-3 mb-3">
                    <label class="form-label">Width (px)</label>
                    <input type="number" class="form-control" id="bannerWidth" min="0" value="${isEdit ? (existingBanner.width || '') : ''}">
                  </div>
                  <div class="col-md-3 mb-3">
                    <label class="form-label">Height (px)</label>
                    <input type="number" class="form-control" id="bannerHeight" min="0" value="${isEdit ? (existingBanner.height || '') : ''}">
                  </div>
                  <div class="col-md-3 mb-3">
                    <label class="form-label">Start Date</label>
                    <input type="date" class="form-control" id="bannerStartDate" value="${isEdit && existingBanner.start_date ? existingBanner.start_date.split('T')[0] : ''}">
                  </div>
                  <div class="col-md-3 mb-3">
                    <label class="form-label">End Date</label>
                    <input type="date" class="form-control" id="bannerEndDate" value="${isEdit && existingBanner.end_date ? existingBanner.end_date.split('T')[0] : ''}">
                  </div>
                </div>
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Display Order</label>
                    <input type="number" class="form-control" id="bannerDisplayOrder" min="0" value="${isEdit ? (existingBanner.display_order || 0) : this.currentBanners.length + 1}">
                  </div>
                  <div class="col-md-6 mb-3">
                    <div class="form-check mt-4">
                      <input class="form-check-input" type="checkbox" id="bannerIsActive" ${isEdit ? (existingBanner.is_active ? 'checked' : '') : 'checked'}>
                      <label class="form-check-label" for="bannerIsActive">Active</label>
                    </div>
                  </div>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" onclick="marketingModule.saveBanner(${isEdit ? `'${existingBanner.id}'` : 'null'})">
                <i class="bi bi-save me-2"></i>${btnText}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const existingModal = document.getElementById('bannerFormModal');
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('bannerFormModal'));
    modal.show();
    document.getElementById('bannerFormModal').addEventListener('hidden.bs.modal', function() { this.remove(); });
  },

  async saveBanner(bannerId) {
    const form = document.getElementById('bannerForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const bannerData = {
      title: document.getElementById('bannerTitle').value,
      position: document.getElementById('bannerPosition').value,
      image_url: document.getElementById('bannerImageUrl').value,
      link_url: document.getElementById('bannerLinkUrl').value || null,
      width: parseInt(document.getElementById('bannerWidth').value) || null,
      height: parseInt(document.getElementById('bannerHeight').value) || null,
      start_date: document.getElementById('bannerStartDate').value || null,
      end_date: document.getElementById('bannerEndDate').value || null,
      display_order: parseInt(document.getElementById('bannerDisplayOrder').value) || 0,
      is_active: document.getElementById('bannerIsActive').checked
    };

    try {
      let error;
      if (bannerId) {
        bannerData.updated_at = new Date().toISOString();
        ({ error } = await STATE.client.from('banners').update(bannerData).eq('id', bannerId));
      } else {
        ({ error } = await STATE.client.from('banners').insert([bannerData]));
      }

      if (error) throw error;

      utils.showToast(bannerId ? 'Banner updated successfully' : 'Banner created successfully', 'success');
      bootstrap.Modal.getInstance(document.getElementById('bannerFormModal')).hide();
      await this.loadBanners();
    } catch (error) {
      console.error('Error saving banner:', error);
      utils.showToast('Failed to save banner: ' + error.message, 'error');
    }
  },

  editBanner(bannerId) {
    const banner = this.currentBanners.find(b => b.id === bannerId);
    if (!banner) {
      utils.showToast('Banner not found', 'error');
      return;
    }
    this.openAddBannerModal(banner);
  },

  /**
   * Toggle banner active status
   */
  async toggleBannerActive(bannerId, isActive) {
    try {
      const { error } = await STATE.client
        .from('banners')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', bannerId);

      if (error) throw error;

      utils.showToast(`Banner ${isActive ? 'activated' : 'paused'}`, 'success');
      await this.loadBanners();
    } catch (error) {
      console.error('Error toggling banner:', error);
      utils.showToast('Failed to update banner: ' + error.message, 'error');
    }
  },

  /**
   * Delete banner
   */
  async deleteBanner(bannerId) {
    if (!confirm('Are you sure you want to delete this banner?')) return;

    try {
      const { error } = await STATE.client
        .from('banners')
        .delete()
        .eq('id', bannerId);

      if (error) throw error;

      utils.showToast('Banner deleted successfully', 'success');
      await this.loadBanners();
    } catch (error) {
      console.error('Error deleting banner:', error);
      utils.showToast('Failed to delete banner: ' + error.message, 'error');
    }
  },

  /* ==================================================== */
  /* SPONSORS MANAGEMENT */
  /* ==================================================== */

  /**
   * Load all sponsors
   */
  async loadSponsors() {
    try {
      const { data, error } = await STATE.client
        .from('sponsors')
        .select('*')
        .order('tier', { ascending: true })
        .order('display_order', { ascending: true, nullsFirst: false });

      if (error) throw error;

      this.currentSponsors = data || [];
      this.renderSponsors();
    } catch (error) {
      console.error('Error loading sponsors:', error);
      document.getElementById('sponsorsGrid').innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>
          Failed to load sponsors: ${error.message}
        </div>
      `;
    }
  },

  /**
   * Render sponsors grid
   */
  renderSponsors() {
    const container = document.getElementById('sponsorsGrid');

    if (this.currentSponsors.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          No sponsors found. Click "Add Sponsor" to register your first sponsor or partner.
        </div>
      `;
      return;
    }

    // Group sponsors by tier
    const tierOrder = ['Platinum', 'Gold', 'Silver', 'Bronze', 'Partner'];
    const sponsorsByTier = {};

    tierOrder.forEach(tier => {
      sponsorsByTier[tier] = this.currentSponsors.filter(s => s.tier === tier);
    });

    container.innerHTML = tierOrder.map(tier => {
      const sponsors = sponsorsByTier[tier];
      if (sponsors.length === 0) return '';

      return `
        <div class="mb-5">
          <h5 class="mb-3">
            <span class="badge bg-${this.getTierColor(tier)} me-2">${tier}</span>
            (${sponsors.length})
          </h5>
          <div class="row g-4">
            ${sponsors.map(sponsor => this.renderSponsorCard(sponsor)).join('')}
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Get tier badge color
   */
  getTierColor(tier) {
    const colors = {
      'Platinum': 'secondary',
      'Gold': 'warning',
      'Silver': 'light text-dark',
      'Bronze': 'warning',
      'Partner': 'primary'
    };
    return colors[tier] || 'secondary';
  },

  /**
   * Render single sponsor card
   */
  renderSponsorCard(sponsor) {
    const isActive = sponsor.is_active &&
      (!sponsor.end_date || new Date(sponsor.end_date) >= new Date());

    return `
      <div class="col-md-6 col-lg-3">
        <div class="card h-100">
          <div class="card-body text-center">
            ${sponsor.logo_url ?
              `<img src="${sponsor.logo_url}" alt="${utils.escapeHtml(sponsor.company_name)}"
                class="mb-3" style="max-width: 100%; height: 100px; object-fit: contain;">` :
              `<div class="mb-3" style="height: 100px; display: flex; align-items: center; justify-content: center; background: #f8f9fa; border-radius: 4px;">
                <i class="bi bi-building" style="font-size: 3rem; color: #dee2e6;"></i>
              </div>`
            }
            <h6 class="card-title">${utils.escapeHtml(sponsor.company_name)}</h6>
            <span class="badge bg-${this.getTierColor(sponsor.tier)} mb-2">${sponsor.tier}</span>
            ${!isActive ? '<span class="badge bg-secondary mb-2">Inactive</span>' : ''}
            ${sponsor.website ?
              `<p class="card-text small mb-2">
                <a href="${sponsor.website}" target="_blank" class="text-decoration-none">
                  <i class="bi bi-globe"></i> Visit Website
                </a>
              </p>` : ''}
            ${sponsor.contact_name ?
              `<p class="card-text small text-muted mb-0">${utils.escapeHtml(sponsor.contact_name)}</p>` : ''}
            ${sponsor.email ?
              `<p class="card-text small text-muted mb-2">${utils.escapeHtml(sponsor.email)}</p>` : ''}
          </div>
          <div class="card-footer bg-transparent">
            <div class="btn-group w-100" role="group">
              <button class="btn btn-sm btn-outline-primary" onclick="marketingModule.editSponsor('${sponsor.id}')">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="marketingModule.deleteSponsor('${sponsor.id}')">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Open add sponsor modal
   */
  openAddSponsorModal(existingSponsor = null) {
    const isEdit = !!existingSponsor;
    const title = isEdit ? 'Edit Sponsor' : 'Add New Sponsor';
    const btnText = isEdit ? 'Save Changes' : 'Create Sponsor';

    const modalHtml = `
      <div class="modal fade" id="sponsorFormModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-warning text-dark">
              <h5 class="modal-title"><i class="bi bi-award me-2"></i>${title}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="sponsorForm">
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Company Name <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" id="sponsorCompanyName" required value="${isEdit ? utils.escapeHtml(existingSponsor.company_name) : ''}" placeholder="Sponsor company name">
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Tier <span class="text-danger">*</span></label>
                    <select class="form-select" id="sponsorTier" required>
                      <option value="Platinum" ${isEdit && existingSponsor.tier === 'Platinum' ? 'selected' : ''}>Platinum</option>
                      <option value="Gold" ${isEdit && existingSponsor.tier === 'Gold' ? 'selected' : ''}>Gold</option>
                      <option value="Silver" ${isEdit && existingSponsor.tier === 'Silver' ? 'selected' : ''}>Silver</option>
                      <option value="Bronze" ${isEdit && existingSponsor.tier === 'Bronze' ? 'selected' : ''}>Bronze</option>
                      <option value="Partner" ${isEdit && existingSponsor.tier === 'Partner' ? 'selected' : ''}>Partner</option>
                    </select>
                  </div>
                </div>
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Contact Name</label>
                    <input type="text" class="form-control" id="sponsorContactName" value="${isEdit ? (existingSponsor.contact_name || '') : ''}" placeholder="Primary contact">
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Email</label>
                    <input type="email" class="form-control" id="sponsorEmail" value="${isEdit ? (existingSponsor.email || '') : ''}" placeholder="contact@company.com">
                  </div>
                </div>
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Phone</label>
                    <input type="text" class="form-control" id="sponsorPhone" value="${isEdit ? (existingSponsor.phone || '') : ''}" placeholder="Phone number">
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Website</label>
                    <input type="url" class="form-control" id="sponsorWebsite" value="${isEdit ? (existingSponsor.website || '') : ''}" placeholder="https://company.com">
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Logo URL</label>
                  <input type="url" class="form-control" id="sponsorLogoUrl" value="${isEdit ? (existingSponsor.logo_url || '') : ''}" placeholder="https://company.com/logo.png">
                </div>
                <div class="mb-3">
                  <label class="form-label">Description</label>
                  <textarea class="form-control" id="sponsorDescription" rows="2">${isEdit ? (existingSponsor.description || '') : ''}</textarea>
                </div>
                <div class="row">
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Sponsorship Amount (£)</label>
                    <input type="number" class="form-control" id="sponsorAmount" min="0" step="0.01" value="${isEdit ? (existingSponsor.sponsorship_amount || '') : ''}">
                  </div>
                  <div class="col-md-4 mb-3">
                    <label class="form-label">Display Order</label>
                    <input type="number" class="form-control" id="sponsorDisplayOrder" min="0" value="${isEdit ? (existingSponsor.display_order || 0) : this.currentSponsors.length + 1}">
                  </div>
                  <div class="col-md-4 mb-3">
                    <div class="form-check mt-4">
                      <input class="form-check-input" type="checkbox" id="sponsorIsActive" ${isEdit ? (existingSponsor.is_active ? 'checked' : '') : 'checked'}>
                      <label class="form-check-label" for="sponsorIsActive">Active</label>
                    </div>
                  </div>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-warning" onclick="marketingModule.saveSponsor(${isEdit ? `'${existingSponsor.id}'` : 'null'})">
                <i class="bi bi-save me-2"></i>${btnText}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const existingModal = document.getElementById('sponsorFormModal');
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('sponsorFormModal'));
    modal.show();
    document.getElementById('sponsorFormModal').addEventListener('hidden.bs.modal', function() { this.remove(); });
  },

  async saveSponsor(sponsorId) {
    const form = document.getElementById('sponsorForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const sponsorData = {
      company_name: document.getElementById('sponsorCompanyName').value,
      tier: document.getElementById('sponsorTier').value,
      contact_name: document.getElementById('sponsorContactName').value || null,
      email: document.getElementById('sponsorEmail').value || null,
      phone: document.getElementById('sponsorPhone').value || null,
      website: document.getElementById('sponsorWebsite').value || null,
      logo_url: document.getElementById('sponsorLogoUrl').value || null,
      description: document.getElementById('sponsorDescription').value || null,
      sponsorship_amount: parseFloat(document.getElementById('sponsorAmount').value) || null,
      display_order: parseInt(document.getElementById('sponsorDisplayOrder').value) || 0,
      is_active: document.getElementById('sponsorIsActive').checked
    };

    try {
      let error;
      if (sponsorId) {
        sponsorData.updated_at = new Date().toISOString();
        ({ error } = await STATE.client.from('sponsors').update(sponsorData).eq('id', sponsorId));
      } else {
        ({ error } = await STATE.client.from('sponsors').insert([sponsorData]));
      }

      if (error) throw error;

      utils.showToast(sponsorId ? 'Sponsor updated successfully' : 'Sponsor created successfully', 'success');
      bootstrap.Modal.getInstance(document.getElementById('sponsorFormModal')).hide();
      await this.loadSponsors();
    } catch (error) {
      console.error('Error saving sponsor:', error);
      utils.showToast('Failed to save sponsor: ' + error.message, 'error');
    }
  },

  editSponsor(sponsorId) {
    const sponsor = this.currentSponsors.find(s => s.id === sponsorId);
    if (!sponsor) {
      utils.showToast('Sponsor not found', 'error');
      return;
    }
    this.openAddSponsorModal(sponsor);
  },

  /* ==================================================== */
  /* ==================================================== */
  /* UTILITY FUNCTIONS */
  /* ==================================================== */

  /**
   * View banner full screen
   */
  viewBannerFull(imageUrl, title) {
    const modal = new bootstrap.Modal(document.getElementById('viewImageFullModal'));
    document.getElementById('viewImageFullTitle').textContent = title;
    document.getElementById('viewImageFullContent').innerHTML = `
      <img src="${imageUrl}" alt="${utils.escapeHtml(title)}" class="img-fluid" style="max-height: 70vh;">
    `;
    modal.show();
  }
};

// Export to window for global access
window.marketingModule = marketingModule;
