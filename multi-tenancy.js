/* ==================================================== */
/* MULTI-TENANCY MODULE                                  */
/* Tenant isolation, tenant switching, tenant-scoped     */
/* queries for running multiple award programmes          */
/* ==================================================== */

const tenantModule = {
  _currentTenant: null,
  _tenants: [],

  /**
   * Initialize multi-tenancy
   */
  async init() {
    await this.loadTenants();
    this.restoreLastTenant();
    this.renderTenantSwitcher();
    console.log(`Multi-tenancy initialized (tenant: ${this._currentTenant?.name || 'default'})`);
  },

  /**
   * Load available tenants for the current user
   */
  async loadTenants() {
    try {
      const { data, error } = await STATE.client
        .from('tenants')
        .select('id, name, slug, logo_url, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      this._tenants = data || [];

      // If no tenants table exists yet, create a default tenant
      if (this._tenants.length === 0) {
        this._tenants = [{
          id: 'default',
          name: 'British Trade Awards',
          slug: 'bta',
          logo_url: null,
          is_active: true
        }];
      }
    } catch (e) {
      // Table may not exist yet - use default
      this._tenants = [{
        id: 'default',
        name: 'British Trade Awards',
        slug: 'bta',
        logo_url: null,
        is_active: true
      }];
    }
  },

  /**
   * Get the current tenant
   */
  getCurrentTenant() {
    return this._currentTenant;
  },

  /**
   * Get the current tenant ID
   */
  getTenantId() {
    return this._currentTenant?.id || 'default';
  },

  /**
   * Restore the last selected tenant from localStorage
   */
  restoreLastTenant() {
    const savedId = localStorage.getItem('bta_current_tenant');
    if (savedId) {
      const tenant = this._tenants.find(t => t.id === savedId);
      if (tenant) {
        this._currentTenant = tenant;
        return;
      }
    }
    // Default to first tenant
    this._currentTenant = this._tenants[0] || null;
  },

  /**
   * Switch to a different tenant
   */
  async switchTenant(tenantId) {
    const tenant = this._tenants.find(t => t.id === tenantId);
    if (!tenant) {
      utils.showToast('Tenant not found', 'error');
      return;
    }

    this._currentTenant = tenant;
    localStorage.setItem('bta_current_tenant', tenantId);

    // Update UI
    this.renderTenantSwitcher();
    document.getElementById('tenantBrandName')?.textContent
      && (document.getElementById('tenantBrandName').textContent = tenant.name);

    // Reload data for new tenant context
    utils.showToast(`Switched to ${tenant.name}`, 'info');

    if (typeof loadAllData === 'function') {
      await loadAllData();
    }
  },

  /**
   * Render tenant switcher in the navbar
   */
  renderTenantSwitcher() {
    let switcher = document.getElementById('tenantSwitcher');

    // Only show switcher if multiple tenants exist
    if (this._tenants.length <= 1) {
      if (switcher) switcher.style.display = 'none';
      return;
    }

    if (!switcher) {
      // Create switcher in navbar
      const navbar = document.querySelector('.navbar-nav') || document.querySelector('.navbar');
      if (!navbar) return;

      switcher = document.createElement('div');
      switcher.id = 'tenantSwitcher';
      switcher.className = 'dropdown ms-2';
      navbar.prepend(switcher);
    }

    switcher.style.display = '';
    switcher.innerHTML = `
      <button class="btn btn-sm btn-outline-light dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-label="Switch tenant">
        <i class="bi bi-building me-1"></i>${utils.escapeHtml(this._currentTenant?.name || 'Select Programme')}
      </button>
      <ul class="dropdown-menu">
        ${this._tenants.map(t => `
          <li>
            <a class="dropdown-item ${t.id === this._currentTenant?.id ? 'active' : ''}" href="#"
               onclick="event.preventDefault(); tenantModule.switchTenant('${t.id}')">
              ${t.logo_url ? `<img src="${utils.escapeHtml(t.logo_url)}" alt="" style="width:20px;height:20px;object-fit:contain" class="me-2">` : '<i class="bi bi-trophy me-2"></i>'}
              ${utils.escapeHtml(t.name)}
            </a>
          </li>
        `).join('')}
        <li><hr class="dropdown-divider"></li>
        <li><a class="dropdown-item text-muted" href="#" onclick="event.preventDefault(); tenantModule.openManageTenants()"><i class="bi bi-gear me-2"></i>Manage Programmes</a></li>
      </ul>
    `;
  },

  /**
   * Add tenant_id filter to a Supabase query builder
   * Use this to scope all data queries to the current tenant
   */
  scopeQuery(queryBuilder) {
    const tenantId = this.getTenantId();
    if (tenantId && tenantId !== 'default') {
      return queryBuilder.eq('tenant_id', tenantId);
    }
    return queryBuilder;
  },

  /**
   * Add tenant_id to a data object before insert
   */
  addTenantId(data) {
    const tenantId = this.getTenantId();
    if (tenantId && tenantId !== 'default') {
      if (Array.isArray(data)) {
        return data.map(d => ({ ...d, tenant_id: tenantId }));
      }
      return { ...data, tenant_id: tenantId };
    }
    return data;
  },

  /**
   * Open tenant management panel
   */
  openManageTenants() {
    if (!rbacModule || !rbacModule.guard('settings')) {
      utils.showToast('Admin permissions required', 'error');
      return;
    }

    const modal = document.getElementById('manageTenantModal');
    if (modal) {
      this.renderTenantManagement();
      new bootstrap.Modal(modal).show();
    } else {
      this._createTenantModal();
    }
  },

  _createTenantModal() {
    const modalHtml = `
      <div class="modal fade" id="manageTenantModal" tabindex="-1" aria-labelledby="manageTenantLabel" aria-modal="true">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="manageTenantLabel"><i class="bi bi-building me-2"></i>Manage Award Programmes</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" id="tenantManagementBody"></div>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    this.renderTenantManagement();
    new bootstrap.Modal(document.getElementById('manageTenantModal')).show();
  },

  renderTenantManagement() {
    const body = document.getElementById('tenantManagementBody');
    if (!body) return;

    body.innerHTML = `
      <div class="mb-3">
        <button class="btn btn-primary btn-sm" onclick="tenantModule.addTenant()">
          <i class="bi bi-plus-circle me-1"></i>Add Programme
        </button>
      </div>
      <table class="table table-sm">
        <thead>
          <tr><th>Name</th><th>Slug</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${this._tenants.map(t => `
            <tr>
              <td>${utils.escapeHtml(t.name)}</td>
              <td><code>${utils.escapeHtml(t.slug)}</code></td>
              <td><span class="badge bg-${t.is_active ? 'success' : 'secondary'}">${t.is_active ? 'Active' : 'Inactive'}</span></td>
              <td>
                ${t.id !== 'default' ? `
                  <button class="btn btn-sm btn-outline-primary" onclick="tenantModule.editTenant('${t.id}')" aria-label="Edit"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-sm btn-outline-danger" onclick="tenantModule.deleteTenant('${t.id}')" aria-label="Delete"><i class="bi bi-trash"></i></button>
                ` : '<small class="text-muted">Default</small>'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  async addTenant() {
    const name = prompt('Programme name:');
    if (!name) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    try {
      const { error } = await STATE.client.from('tenants').insert({
        name, slug, is_active: true
      });
      if (error) throw error;
      await this.loadTenants();
      this.renderTenantManagement();
      this.renderTenantSwitcher();
      utils.showToast(`Programme "${name}" created`, 'success');
    } catch (e) {
      utils.showToast('Failed to create programme: ' + e.message, 'error');
    }
  },

  async editTenant(tenantId) {
    const tenant = this._tenants.find(t => t.id === tenantId);
    if (!tenant) return;
    const name = prompt('Programme name:', tenant.name);
    if (!name || name === tenant.name) return;

    try {
      const { error } = await STATE.client.from('tenants').update({ name }).eq('id', tenantId);
      if (error) throw error;
      await this.loadTenants();
      this.renderTenantManagement();
      this.renderTenantSwitcher();
      utils.showToast('Programme updated', 'success');
    } catch (e) {
      utils.showToast('Failed to update: ' + e.message, 'error');
    }
  },

  async deleteTenant(tenantId) {
    if (!await utils.confirmDialog({ title: 'Delete Programme', message: 'Delete this programme? Data associated with it will become orphaned.', confirmText: 'Delete', danger: true })) return;
    try {
      const { error } = await STATE.client.from('tenants').update({ is_active: false }).eq('id', tenantId);
      if (error) throw error;
      if (this._currentTenant?.id === tenantId) {
        await this.switchTenant(this._tenants[0].id);
      }
      await this.loadTenants();
      this.renderTenantManagement();
      this.renderTenantSwitcher();
      utils.showToast('Programme deactivated', 'success');
    } catch (e) {
      utils.showToast('Failed to delete: ' + e.message, 'error');
    }
  }
};

window.tenantModule = tenantModule;
