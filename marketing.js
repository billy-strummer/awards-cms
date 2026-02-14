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
  openAddBannerModal() {
    utils.showToast('Banner creation coming soon! Database tables are ready.', 'info');
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
  openAddSponsorModal() {
    utils.showToast('Sponsor creation coming soon! Database tables are ready.', 'info');
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
