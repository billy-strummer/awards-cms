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
      console.warn('✅ Marketing data loaded');
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
          Failed to load banners: ${utils.escapeHtml(error.message)}
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
          <img src="${utils.escapeHtml(banner.image_url)}" class="card-img-top" alt="${utils.escapeHtml(banner.title)}"
            style="height: 200px; object-fit: cover; cursor: pointer;"
            onclick="marketingModule.viewBannerFull('${utils.escapeHtml(banner.image_url).replace(/'/g, "\\'")}', '${utils.escapeHtml(banner.title).replace(/'/g, "\\'")}')">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h6 class="card-title mb-0">${utils.escapeHtml(banner.title)}</h6>
              ${statusBadge}
            </div>
            <p class="card-text small text-muted mb-2">
              <span class="badge bg-primary-subtle text-primary">${utils.escapeHtml(banner.position)}</span>
              ${banner.width && banner.height ? `<span class="ms-2">${banner.width}x${banner.height}px</span>` : ''}
            </p>
            ${banner.link_url ? `
              <p class="card-text small mb-2">
                <i class="bi bi-link-45deg"></i>
                <a href="${utils.escapeHtml(banner.link_url)}" target="_blank" class="text-truncate d-inline-block" style="max-width: 200px;">
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
                  <input type="url" class="form-control" id="bannerImageUrl" required value="${isEdit ? utils.escapeHtml(existingBanner.image_url || '') : ''}" placeholder="https://example.com/banner.jpg">
                </div>
                <div class="mb-3">
                  <label class="form-label">Link URL</label>
                  <input type="url" class="form-control" id="bannerLinkUrl" value="${isEdit ? utils.escapeHtml(existingBanner.link_url || '') : ''}" placeholder="https://example.com/landing-page">
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
    utils.initInlineValidation(document.getElementById('bannerForm'));
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
      await utils.protectModalDuringSave('bannerFormModal', async () => {
        let error;
        if (bannerId) {
          bannerData.updated_at = new Date().toISOString();
          ({ error } = await STATE.client.from('banners').update(bannerData).eq('id', bannerId));
        } else {
          ({ error } = await STATE.client.from('banners').insert([bannerData]));
        }

        if (error) throw error;

        bootstrap.Modal.getInstance(document.getElementById('bannerFormModal'))?.hide();
        await this.loadBanners();
      });
      utils.showToast(bannerId ? 'Banner updated successfully' : 'Banner created successfully', 'success');
    } catch (error) {
      console.warn('DB save for banner failed, using localStorage:', error);
      const key = 'bta_banners_pending';
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      bannerData.id = bannerId || crypto.randomUUID();
      const idx = stored.findIndex(b => b.id === bannerData.id);
      if (idx >= 0) stored[idx] = bannerData; else stored.push(bannerData);
      localStorage.setItem(key, JSON.stringify(stored));
      bootstrap.Modal.getInstance(document.getElementById('bannerFormModal'))?.hide();
      utils.showToast('Banner saved locally', 'success');
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
    if (!await utils.confirmDialog({ title: 'Delete Banner', message: 'Are you sure you want to delete this banner?', confirmText: 'Delete', danger: true })) return;

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
          Failed to load sponsors: ${utils.escapeHtml(error.message)}
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
              `<img src="${utils.escapeHtml(sponsor.logo_url)}" alt="${utils.escapeHtml(sponsor.company_name)}"
                class="mb-3" style="max-width: 100%; height: 100px; object-fit: contain;">` :
              `<div class="mb-3" style="height: 100px; display: flex; align-items: center; justify-content: center; background: #f8f9fa; border-radius: 4px;">
                <i class="bi bi-building" style="font-size: 3rem; color: #dee2e6;"></i>
              </div>`
            }
            <h6 class="card-title">${utils.escapeHtml(sponsor.company_name)}</h6>
            <span class="badge bg-${this.getTierColor(sponsor.tier)} mb-2">${utils.escapeHtml(sponsor.tier)}</span>
            ${!isActive ? '<span class="badge bg-secondary mb-2">Inactive</span>' : ''}
            ${sponsor.website ?
              `<p class="card-text small mb-2">
                <a href="${utils.escapeHtml(sponsor.website)}" target="_blank" class="text-decoration-none">
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
                    <input type="text" class="form-control" id="sponsorContactName" value="${isEdit ? utils.escapeHtml(existingSponsor.contact_name || '') : ''}" placeholder="Primary contact">
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Email</label>
                    <input type="email" class="form-control" id="sponsorEmail" value="${isEdit ? utils.escapeHtml(existingSponsor.email || '') : ''}" placeholder="contact@company.com">
                  </div>
                </div>
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Phone</label>
                    <input type="text" class="form-control" id="sponsorPhone" value="${isEdit ? utils.escapeHtml(existingSponsor.phone || '') : ''}" placeholder="Phone number">
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Website</label>
                    <input type="url" class="form-control" id="sponsorWebsite" value="${isEdit ? utils.escapeHtml(existingSponsor.website || '') : ''}" placeholder="https://company.com">
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Logo URL</label>
                  <input type="url" class="form-control" id="sponsorLogoUrl" value="${isEdit ? utils.escapeHtml(existingSponsor.logo_url || '') : ''}" placeholder="https://company.com/logo.png">
                </div>
                <div class="mb-3">
                  <label class="form-label">Description</label>
                  <textarea class="form-control" id="sponsorDescription" rows="2">${isEdit ? utils.escapeHtml(existingSponsor.description || '') : ''}</textarea>
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
    utils.initInlineValidation(document.getElementById('sponsorForm'));
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
      await utils.protectModalDuringSave('sponsorFormModal', async () => {
        let error;
        if (sponsorId) {
          sponsorData.updated_at = new Date().toISOString();
          ({ error } = await STATE.client.from('sponsors').update(sponsorData).eq('id', sponsorId));
        } else {
          ({ error } = await STATE.client.from('sponsors').insert([sponsorData]));
        }

        if (error) throw error;

        bootstrap.Modal.getInstance(document.getElementById('sponsorFormModal'))?.hide();
        await this.loadSponsors();
      });
      utils.showToast(sponsorId ? 'Sponsor updated successfully' : 'Sponsor created successfully', 'success');
    } catch (error) {
      console.warn('DB save for sponsor failed, using localStorage:', error);
      const key = 'bta_sponsors_pending';
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      sponsorData.id = sponsorId || crypto.randomUUID();
      const idx = stored.findIndex(s => s.id === sponsorData.id);
      if (idx >= 0) stored[idx] = sponsorData; else stored.push(sponsorData);
      localStorage.setItem(key, JSON.stringify(stored));
      bootstrap.Modal.getInstance(document.getElementById('sponsorFormModal'))?.hide();
      utils.showToast('Sponsor saved locally', 'success');
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

  async deleteSponsor(sponsorId) {
    if (!await utils.confirmDialog({ title: 'Delete Sponsor', message: 'Are you sure you want to delete this sponsor?', confirmText: 'Delete', danger: true })) return;
    try {
      const { error } = await STATE.client.from('sponsors').delete().eq('id', sponsorId);
      if (error) throw error;
      utils.showToast('Sponsor deleted successfully', 'success');
      await this.loadSponsors();
    } catch (error) {
      console.error('Error deleting sponsor:', error);
      utils.showToast('Failed to delete sponsor: ' + error.message, 'error');
    }
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
      <img src="${utils.escapeHtml(imageUrl)}" alt="${utils.escapeHtml(title)}" class="img-fluid" style="max-height: 70vh;">
    `;
    modal.show();
  },

  /* ==================================================== */
  /* BRANDING OVERVIEW                                    */
  /* ==================================================== */

  async loadBrandingOverview() {
    const container = document.getElementById('brandingOverviewPanel');
    if (!container) return;

    try {
      const tenantId = (typeof multiTenancyModule !== 'undefined') ? multiTenancyModule.getTenantId() : 'default';
      const config = typeof brandingModule !== 'undefined' ? await brandingModule.loadBranding(tenantId) : {};

      const esc = v => utils.escapeHtml(v || '');
      const logoHtml = config.logo_url
        ? `<img src="${esc(config.logo_url)}" alt="Logo" style="max-height:80px;max-width:200px;object-fit:contain">`
        : '<span class="text-muted fst-italic">No logo set</span>';

      const colorSwatch = (label, color, defaultColor) => {
        const c = color || defaultColor;
        return `<div class="d-flex align-items-center gap-2 mb-2">
          <div style="width:32px;height:32px;border-radius:6px;background:${c};border:1px solid #dee2e6"></div>
          <div><small class="text-muted d-block">${label}</small><code>${c}</code></div>
        </div>`;
      };

      container.innerHTML = `
        <div class="row g-4">
          <div class="col-lg-5">
            <div class="card h-100">
              <div class="card-header"><h5 class="mb-0">Live Preview</h5></div>
              <div class="card-body d-flex align-items-center justify-content-center">
                ${typeof brandingModule !== 'undefined' ? brandingModule.renderPreview(config) : '<span class="text-muted">Branding module not loaded</span>'}
              </div>
            </div>
          </div>
          <div class="col-lg-7">
            <div class="row g-4">
              <div class="col-md-6">
                <div class="card h-100">
                  <div class="card-header"><h6 class="mb-0"><i class="bi bi-building me-2"></i>Identity</h6></div>
                  <div class="card-body">
                    <div class="mb-3">${logoHtml}</div>
                    <p class="mb-1"><strong>${esc(config.company_name) || '<span class="text-muted">Not set</span>'}</strong></p>
                    <p class="text-muted small mb-0">${esc(config.tagline) || '<span class="fst-italic">No tagline</span>'}</p>
                  </div>
                </div>
              </div>
              <div class="col-md-6">
                <div class="card h-100">
                  <div class="card-header"><h6 class="mb-0"><i class="bi bi-palette me-2"></i>Colours</h6></div>
                  <div class="card-body">
                    ${colorSwatch('Primary', config.primary_color, '#000000')}
                    ${colorSwatch('Secondary', config.secondary_color, '#1a1a1a')}
                    ${colorSwatch('Accent', config.accent_color, '#D4AF37')}
                  </div>
                </div>
              </div>
              <div class="col-md-6">
                <div class="card h-100">
                  <div class="card-header"><h6 class="mb-0"><i class="bi bi-envelope me-2"></i>Email Settings</h6></div>
                  <div class="card-body">
                    <p class="mb-1"><small class="text-muted">From:</small> ${esc(config.email_from) || '<span class="text-muted fst-italic">Not set</span>'}</p>
                    <p class="mb-0"><small class="text-muted">Reply-To:</small> ${esc(config.email_reply_to) || '<span class="text-muted fst-italic">Not set</span>'}</p>
                  </div>
                </div>
              </div>
              <div class="col-md-6">
                <div class="card h-100">
                  <div class="card-header"><h6 class="mb-0"><i class="bi bi-fonts me-2"></i>Typography</h6></div>
                  <div class="card-body">
                    <p class="mb-0" style="font-family:${config.font_family || 'inherit'}">${esc(config.font_family) || "'Montserrat', sans-serif"}</p>
                    <small class="text-muted">Sample: The quick brown fox jumps over the lazy dog</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="alert alert-info mt-4 mb-0">
          <i class="bi bi-info-circle me-2"></i>
          <strong>How branding is used:</strong> These settings are automatically applied to email templates, campaign headers/footers, certificates, public pages, and event materials. Edit them in <a href="#" onclick="document.getElementById('settings-tab').click(); return false;">Settings</a> to update across the entire CMS.
        </div>
      `;
    } catch (e) {
      console.error('Failed to load branding overview:', e);
      container.innerHTML = `<div class="alert alert-warning"><i class="bi bi-exclamation-triangle me-2"></i>Failed to load branding: ${utils.escapeHtml(e.message)}</div>`;
    }
  },

  /* ==================================================== */
  /* EMAIL PLACEHOLDER DEFAULTS                           */
  /* ==================================================== */

  _placeholderDefaults: null,

  async loadPlaceholderDefaults() {
    const container = document.getElementById('placeholdersPanel');
    if (!container) return;

    let defaults = {};
    try {
      if (STATE.client) {
        const { data } = await STATE.client.from('user_preferences').select('value').eq('key', 'emailPlaceholderDefaults').limit(1);
        if (data?.[0]) defaults = JSON.parse(data[0].value);
      }
    } catch (e) {
      console.warn('Failed to load placeholder defaults from DB:', e.message);
      try { defaults = JSON.parse(localStorage.getItem('emailPlaceholderDefaults') || '{}'); } catch (_) {}
    }

    let branding = {};
    try {
      const tenantId = (typeof multiTenancyModule !== 'undefined') ? multiTenancyModule.getTenantId() : 'default';
      if (typeof brandingModule !== 'undefined') branding = await brandingModule.loadBranding(tenantId);
    } catch (_) {}

    this._placeholderDefaults = defaults;
    const esc = v => utils.escapeHtml(v || '');

    const placeholders = [
      { key: 'UPLOAD_LINK', label: 'Upload Link', desc: 'URL where entrants upload supporting documents.', default: defaults.UPLOAD_LINK || 'https://yourdomain.com/upload-documents.html', type: 'global' },
      { key: 'DEADLINE_DATE', label: 'Deadline Date', desc: 'Entry submission deadline.', default: defaults.DEADLINE_DATE || '31st December 2025', type: 'global' },
      { key: 'ANNOUNCEMENT_DATE', label: 'Announcement Date', desc: 'Winners announcement date.', default: defaults.ANNOUNCEMENT_DATE || '15th February 2026', type: 'global' },
      { key: 'CONTACT_EMAIL', label: 'Contact Email', desc: 'Awards contact email address. Linked to branding email settings.', default: defaults.CONTACT_EMAIL || branding.email_reply_to || branding.email_from || 'awards@britishtrade.org', type: 'global' },
      { key: 'ENTRY_NUMBER', label: 'Entry Number', desc: 'Unique entry reference (e.g. BTA-2025-0001). Replaced per-entry when sending.', default: defaults.ENTRY_NUMBER || 'BTA-2025-0001', type: 'sample' },
      { key: 'CONTACT_NAME', label: 'Contact Name', desc: 'Entrant contact name. Replaced per-entry when sending.', default: defaults.CONTACT_NAME || 'John Smith', type: 'sample' },
      { key: 'COMPANY_NAME', label: 'Company Name', desc: 'Entrant company name. Replaced per-entry when sending.', default: defaults.COMPANY_NAME || 'Acme Corporation Ltd', type: 'sample' },
      { key: 'AWARD_NAME', label: 'Award Name', desc: 'Award category name. Replaced per-entry when sending.', default: defaults.AWARD_NAME || 'Export Excellence Award', type: 'sample' },
      { key: 'SECTOR', label: 'Sector', desc: 'Business sector. Replaced per-entry when sending.', default: defaults.SECTOR || 'Manufacturing', type: 'sample' },
      { key: 'REGION', label: 'Region', desc: 'Geographic region. Replaced per-entry when sending.', default: defaults.REGION || 'Greater London', type: 'sample' }
    ];

    const globalPlaceholders = placeholders.filter(p => p.type === 'global');
    const samplePlaceholders = placeholders.filter(p => p.type === 'sample');

    container.innerHTML = `
      <form id="placeholderDefaultsForm">
        <div class="row g-4">
          <div class="col-lg-6">
            <div class="card">
              <div class="card-header bg-primary text-white">
                <h6 class="mb-0"><i class="bi bi-globe me-2"></i>Global Defaults</h6>
              </div>
              <div class="card-body">
                <p class="text-muted small mb-3">These values are used as-is in all emails unless overridden per-entry.</p>
                ${globalPlaceholders.map(p => `
                  <div class="mb-3">
                    <label class="form-label">${p.label} <code class="ms-1">{${p.key}}</code></label>
                    <input type="text" class="form-control" id="ph_${p.key}" value="${esc(p.default)}" placeholder="${p.label}">
                    <small class="form-text text-muted">${p.desc}</small>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
          <div class="col-lg-6">
            <div class="card">
              <div class="card-header bg-secondary text-white">
                <h6 class="mb-0"><i class="bi bi-pencil-square me-2"></i>Preview Sample Data</h6>
              </div>
              <div class="card-body">
                <p class="text-muted small mb-3">Sample values used when previewing or test-sending templates. Real values come from entry data.</p>
                ${samplePlaceholders.map(p => `
                  <div class="mb-3">
                    <label class="form-label">${p.label} <code class="ms-1">{${p.key}}</code></label>
                    <input type="text" class="form-control" id="ph_${p.key}" value="${esc(p.default)}" placeholder="${p.label}">
                    <small class="form-text text-muted">${p.desc}</small>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
        <div class="d-flex gap-2 mt-4">
          <button type="submit" class="btn btn-primary"><i class="bi bi-save me-2"></i>Save Placeholder Defaults</button>
          <button type="button" class="btn btn-outline-secondary" onclick="marketingModule.resetPlaceholderDefaults()"><i class="bi bi-arrow-counterclockwise me-2"></i>Reset to Defaults</button>
        </div>
      </form>
      <div class="card mt-4">
        <div class="card-header"><h6 class="mb-0"><i class="bi bi-code-square me-2"></i>Quick Reference</h6></div>
        <div class="card-body">
          <p class="text-muted small mb-2">Copy and paste these placeholders into your email templates:</p>
          <div class="d-flex flex-wrap gap-2">
            ${placeholders.map(p => `<span class="badge bg-light text-dark border" style="cursor:pointer" onclick="navigator.clipboard.writeText('{${p.key}}'); utils.showToast('Copied {${p.key}}', 'success')">{${p.key}}</span>`).join('')}
          </div>
        </div>
      </div>
    `;

    document.getElementById('placeholderDefaultsForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await marketingModule.savePlaceholderDefaults();
    });
  },

  async savePlaceholderDefaults() {
    const keys = ['ENTRY_NUMBER', 'CONTACT_NAME', 'COMPANY_NAME', 'AWARD_NAME', 'SECTOR', 'REGION', 'UPLOAD_LINK', 'DEADLINE_DATE', 'ANNOUNCEMENT_DATE', 'CONTACT_EMAIL'];
    const defaults = {};
    keys.forEach(k => {
      const el = document.getElementById('ph_' + k);
      if (el && el.value.trim()) defaults[k] = el.value.trim();
    });
    try {
      if (STATE.client) {
        await STATE.client.from('user_preferences').upsert({ key: 'emailPlaceholderDefaults', value: JSON.stringify(defaults), updated_at: new Date().toISOString() }, { onConflict: 'key' });
      }
    } catch (e) { console.warn('Failed to save placeholder defaults to DB:', e.message); }
    localStorage.setItem('emailPlaceholderDefaults', JSON.stringify(defaults));
    this._placeholderDefaults = defaults;
    utils.showToast('Placeholder defaults saved', 'success');
  },

  resetPlaceholderDefaults() {
    const dv = { ENTRY_NUMBER: 'BTA-2025-0001', CONTACT_NAME: 'John Smith', COMPANY_NAME: 'Acme Corporation Ltd', AWARD_NAME: 'Export Excellence Award', SECTOR: 'Manufacturing', REGION: 'Greater London', UPLOAD_LINK: 'https://yourdomain.com/upload-documents.html', DEADLINE_DATE: '31st December 2025', ANNOUNCEMENT_DATE: '15th February 2026', CONTACT_EMAIL: 'awards@britishtrade.org' };
    Object.entries(dv).forEach(([k, v]) => { const el = document.getElementById('ph_' + k); if (el) el.value = v; });
    utils.showToast('Defaults reset. Click Save to persist.', 'info');
  },

  // ============================================
  // EMAIL SEQUENCES (moved from Organisations)
  // ============================================
  _emailSequences: [],

  async _loadEmailSequences() {
    try {
      if (typeof STATE !== 'undefined' && STATE.client) {
        const { data } = await STATE.client.from('user_preferences').select('value').eq('key', 'orgEmailSequences').limit(1);
        if (data?.[0]) { this._emailSequences = JSON.parse(data[0].value); return; }
      }
    } catch (e) { console.warn('Failed to load email sequences from database:', e.message); }
    try { this._emailSequences = JSON.parse(localStorage.getItem('orgEmailSequences') || '[]'); } catch (e) { console.warn('Failed to parse email sequences from localStorage:', e.message); this._emailSequences = []; }
  },

  async _saveEmailSequences() {
    try {
      if (typeof STATE !== 'undefined' && STATE.client) {
        await STATE.client.from('user_preferences').upsert({ key: 'orgEmailSequences', value: JSON.stringify(this._emailSequences), updated_at: new Date().toISOString() }, { onConflict: 'key' });
      }
    } catch (e) { console.warn('Failed to save email sequences to database:', e.message); }
    localStorage.setItem('orgEmailSequences', JSON.stringify(this._emailSequences));
  },

  async loadEmailSequences() {
    const container = document.getElementById('emailSequencesGrid');
    if (!container) return;
    await this._loadEmailSequences();
    const sequences = this._emailSequences;
    if (sequences.length === 0) {
      container.innerHTML = `<div class="text-center py-5 text-muted">
        <i class="bi bi-envelope-slash display-4 d-block mb-2 opacity-25"></i>
        No sequences configured yet
      </div>`;
      return;
    }
    container.innerHTML = sequences.map((seq, i) => `
      <div class="card mb-2">
        <div class="card-body py-2">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <strong>${utils.escapeHtml(seq.name)}</strong>
              <span class="badge bg-${seq.active ? 'success' : 'secondary'} ms-2">${seq.active ? 'Active' : 'Paused'}</span>
              <div class="text-muted small">Trigger: ${utils.escapeHtml(seq.trigger)} &middot; ${seq.steps.length} step(s) &middot; ${seq.enrolled || 0} enrolled</div>
            </div>
            <div>
              <button class="btn btn-sm btn-outline-${seq.active ? 'warning' : 'success'}" onclick="marketingModule.toggleSequence(${i})">${seq.active ? 'Pause' : 'Activate'}</button>
              <button class="btn btn-sm btn-outline-danger ms-1" onclick="marketingModule.deleteSequence(${i})"><i class="bi bi-trash"></i></button>
            </div>
          </div>
        </div>
      </div>`).join('');
  },

  showCreateSequence() {
    const existingModal = document.getElementById('createSequenceModal');
    if (existingModal) existingModal.remove();

    const modalHtml = `<div class="modal fade" id="createSequenceModal" tabindex="-1">
      <div class="modal-dialog modal-lg"><div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title"><i class="bi bi-envelope-plus me-2"></i>Create Email Sequence</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="mb-3"><label class="form-label fw-semibold">Sequence Name</label>
            <input type="text" class="form-control" id="seqName" placeholder="e.g. Welcome Onboarding"></div>
          <div class="mb-3"><label class="form-label fw-semibold">Trigger</label>
            <select class="form-select" id="seqTrigger">
              <option value="status_prospect">Status &rarr; Prospect</option><option value="status_entrant">Status &rarr; Entrant</option>
              <option value="status_nominee">Status &rarr; Nominee</option><option value="status_winner">Status &rarr; Winner</option>
              <option value="status_sponsor">Status &rarr; Sponsor</option><option value="manual">Manual Only</option>
            </select></div>
          <h6 class="fw-semibold">Steps</h6>
          <div id="seqStepsContainer"><div class="card mb-2 p-2"><div class="row g-2">
            <div class="col-3"><label class="form-label small">Delay (days)</label><input type="number" class="form-control form-control-sm seq-delay" value="0" min="0"></div>
            <div class="col-4"><label class="form-label small">Subject</label><input type="text" class="form-control form-control-sm seq-subject" placeholder="Subject..."></div>
            <div class="col-5"><label class="form-label small">Body</label><textarea class="form-control form-control-sm seq-body" rows="2" placeholder="Use {{company_name}}, {{contact_name}}..."></textarea></div>
          </div></div></div>
          <button class="btn btn-sm btn-outline-secondary mb-3" onclick="marketingModule._addSequenceStep()"><i class="bi bi-plus me-1"></i>Add Step</button>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button class="btn btn-primary" onclick="marketingModule._saveSequence()"><i class="bi bi-check-circle me-2"></i>Save Sequence</button>
        </div>
      </div></div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    new bootstrap.Modal(document.getElementById('createSequenceModal')).show();
  },

  _addSequenceStep() {
    const c = document.getElementById('seqStepsContainer'); if (!c) return;
    const s = document.createElement('div'); s.className = 'card mb-2 p-2';
    s.innerHTML = `<div class="row g-2"><div class="col-3"><label class="form-label small">Delay (days)</label><input type="number" class="form-control form-control-sm seq-delay" value="3" min="0"></div>
      <div class="col-4"><label class="form-label small">Subject</label><input type="text" class="form-control form-control-sm seq-subject" placeholder="Subject..."></div>
      <div class="col-5"><label class="form-label small">Body</label><textarea class="form-control form-control-sm seq-body" rows="2" placeholder="Use {{company_name}}..."></textarea></div></div>`;
    c.appendChild(s);
  },

  async _saveSequence() {
    const name = document.getElementById('seqName')?.value?.trim();
    const trigger = document.getElementById('seqTrigger')?.value;
    if (!name) { utils.showToast('Enter a sequence name', 'warning'); return; }
    const steps = [];
    document.querySelectorAll('.seq-delay').forEach((d, i) => {
      steps.push({ delay: parseInt(d.value) || 0, subject: document.querySelectorAll('.seq-subject')[i]?.value || '', body: document.querySelectorAll('.seq-body')[i]?.value || '' });
    });
    if (steps.length === 0 || !steps[0].subject) { utils.showToast('Add at least one step with a subject', 'warning'); return; }
    this._emailSequences.push({ name, trigger, steps, active: true, enrolled: 0, created: new Date().toISOString() });
    await this._saveEmailSequences();
    utils.showToast('Sequence created', 'success');
    bootstrap.Modal.getInstance(document.getElementById('createSequenceModal'))?.hide();
    this.loadEmailSequences();
  },

  async toggleSequence(i) {
    if (this._emailSequences[i]) {
      this._emailSequences[i].active = !this._emailSequences[i].active;
      await this._saveEmailSequences();
      this.loadEmailSequences();
    }
  },

  async deleteSequence(i) {
    if (!await utils.confirmDialog({ title: 'Delete Sequence', message: 'Delete this email sequence?', confirmText: 'Delete', danger: true })) return;
    this._emailSequences.splice(i, 1);
    await this._saveEmailSequences();
    this.loadEmailSequences();
  }
};

// Export to window for global access
ModuleRegistry.register('marketingModule', marketingModule);
