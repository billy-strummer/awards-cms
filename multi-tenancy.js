/* ==================================================== */
/* MULTI-TENANCY MODULE                                  */
/* Tenant isolation, tenant switching, tenant-scoped     */
/* queries for running multiple award programmes          */
/* ==================================================== */

const tenantModule = {
  _currentTenant: null,
  _tenants: [],

  /**
   * Initialize multi-tenancy - loads tenants, restores last selection and renders switcher.
   * @returns {Promise<void>}
   */
  async init() {
    await this.loadTenants();
    this.restoreLastTenant();
    this.renderTenantSwitcher();
    console.warn(`Multi-tenancy initialized (tenant: ${this._currentTenant?.name || 'default'})`);
  },

  /**
   * Load available tenants for the current user from the database.
   * Falls back to a default tenant if the tenants table does not exist.
   * @returns {Promise<void>}
   */
  async loadTenants() {
    try {
      const result = await apiClient.select('tenants', {
        select: 'id, name, slug, logo_url, is_active',
        filters: { is_active: true },
        sort: { column: 'name', ascending: true },
      });
      this._tenants = result.data || [];

      // If no tenants table exists yet, create a default tenant
      if (this._tenants.length === 0) {
        this._tenants = [
          {
            id: 'default',
            name: 'British Trade Awards',
            slug: 'bta',
            logo_url: null,
            is_active: true,
          },
        ];
      }
    } catch (e) {
      // Table may not exist yet - use default
      this._tenants = [
        {
          id: 'default',
          name: 'British Trade Awards',
          slug: 'bta',
          logo_url: null,
          is_active: true,
        },
      ];
    }
  },

  /**
   * Get the current tenant object.
   * @returns {Object|null} The current tenant
   */
  getCurrentTenant() {
    return this._currentTenant;
  },

  /**
   * Get the current tenant ID.
   * @returns {string} The current tenant ID or 'default'
   */
  getTenantId() {
    return this._currentTenant?.id || 'default';
  },

  /**
   * Restore the last selected tenant from localStorage.
   * Falls back to the first available tenant.
   */
  restoreLastTenant() {
    const savedId = localStorage.getItem('bta_current_tenant');
    if (savedId) {
      const tenant = this._tenants.find((t) => t.id === savedId);
      if (tenant) {
        this._currentTenant = tenant;
        return;
      }
    }
    // Default to first tenant
    this._currentTenant = this._tenants[0] || null;
  },

  /**
   * Switch to a different tenant by ID and reload the page.
   * @param {string} tenantId - The tenant ID to switch to
   * @returns {Promise<void>}
   */
  async switchTenant(tenantId) {
    const tenant = this._tenants.find((t) => t.id === tenantId);
    if (!tenant) {
      utils.showToast('Tenant not found', 'error');
      return;
    }

    this._currentTenant = tenant;
    localStorage.setItem('bta_current_tenant', tenantId);

    // Update UI
    this.renderTenantSwitcher();
    document.getElementById('tenantBrandName')?.textContent &&
      (document.getElementById('tenantBrandName').textContent = tenant.name);

    // Reload data for new tenant context
    utils.showToast(`Switched to ${tenant.name}`, 'info');

    window.location.reload();
  },

  /**
   * Render tenant switcher dropdown in the navbar.
   * Only visible when multiple tenants exist.
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
        ${this._tenants
          .map(
            (t) => `
          <li>
            <a class="dropdown-item ${t.id === this._currentTenant?.id ? 'active' : ''}" href="#"
               data-action="tenantModule.switchTenant" data-id="${t.id}">
              ${t.logo_url ? `<img src="${utils.escapeHtml(t.logo_url)}" alt="" style="width:20px;height:20px;object-fit:contain" class="me-2">` : '<i class="bi bi-trophy me-2"></i>'}
              ${utils.escapeHtml(t.name)}
            </a>
          </li>
        `
          )
          .join('')}
        <li><hr class="dropdown-divider"></li>
        <li><a class="dropdown-item text-muted" href="#" data-action="tenantModule.openManageTenants"><i class="bi bi-gear me-2"></i>Manage Programmes</a></li>
      </ul>
    `;
  },

  /**
   * Add tenant_id filter to a Supabase query builder.
   * Use this to scope all data queries to the current tenant.
   * @param {Object} queryBuilder - A Supabase query builder instance
   * @returns {Object} The query builder with the tenant filter applied
   */
  scopeQuery(queryBuilder) {
    const tenantId = this.getTenantId();
    if (tenantId && tenantId !== 'default') {
      return queryBuilder.eq('tenant_id', tenantId);
    }
    return queryBuilder;
  },

  /**
   * Add tenant_id to a data object before insert.
   * Handles both single objects and arrays.
   * @param {Object|Array<Object>} data - The data to augment with tenant_id
   * @returns {Object|Array<Object>} Data with tenant_id added
   */
  addTenantId(data) {
    const tenantId = this.getTenantId();
    if (tenantId && tenantId !== 'default') {
      if (Array.isArray(data)) {
        return data.map((d) => ({ ...d, tenant_id: tenantId }));
      }
      return { ...data, tenant_id: tenantId };
    }
    return data;
  },

  /**
   * Open tenant management panel (admin only).
   * Guards access with RBAC settings permission.
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

  /**
   * Create and show the tenant management modal.
   * @private
   */
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

  /**
   * Render the tenant management table inside the modal body.
   */
  renderTenantManagement() {
    const body = document.getElementById('tenantManagementBody');
    if (!body) return;

    body.innerHTML = `
      <div class="mb-3">
        <button class="btn btn-primary btn-sm" data-action="tenantModule.addTenant">
          <i class="bi bi-plus-circle me-1"></i>Add Programme
        </button>
      </div>
      <table class="table table-sm">
        <thead>
          <tr><th>Name</th><th>Slug</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${this._tenants
            .map(
              (t) => `
            <tr>
              <td>${utils.escapeHtml(t.name)}</td>
              <td><code>${utils.escapeHtml(t.slug)}</code></td>
              <td><span class="badge bg-${t.is_active ? 'success' : 'secondary'}">${t.is_active ? 'Active' : 'Inactive'}</span></td>
              <td>
                ${
                  t.id !== 'default'
                    ? `
                  <button class="btn btn-sm btn-outline-primary" data-action="tenantModule.editTenant" data-id="${t.id}" aria-label="Edit"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-sm btn-outline-danger" data-action="tenantModule.deleteTenant" data-id="${t.id}" aria-label="Delete"><i class="bi bi-trash"></i></button>
                `
                    : '<small class="text-muted">Default</small>'
                }
              </td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;
  },

  /**
   * Prompt the user for a new programme name and create the tenant.
   * @returns {Promise<void>}
   */
  async addTenant() {
    const name = prompt('Programme name:');
    if (!name) return;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    try {
      await apiClient.insert('tenants', { name, slug, is_active: true });
      await this.loadTenants();
      this.renderTenantManagement();
      this.renderTenantSwitcher();
      utils.showToast(`Programme "${name}" created`, 'success');
    } catch (e) {
      utils.showToast('Failed to create programme: ' + e.message, 'error');
    }
  },

  /**
   * Prompt the user to rename an existing tenant.
   * @param {string} tenantId - The tenant ID to edit
   * @returns {Promise<void>}
   */
  async editTenant(tenantId) {
    const tenant = this._tenants.find((t) => t.id === tenantId);
    if (!tenant) return;
    const name = prompt('Programme name:', tenant.name);
    if (!name || name === tenant.name) return;

    try {
      await apiClient.update('tenants', tenantId, { name });
      await this.loadTenants();
      this.renderTenantManagement();
      this.renderTenantSwitcher();
      utils.showToast('Programme updated', 'success');
    } catch (e) {
      utils.showToast('Failed to update: ' + e.message, 'error');
    }
  },

  /**
   * Deactivate a tenant after user confirmation.
   * @param {string} tenantId - The tenant ID to deactivate
   * @returns {Promise<void>}
   */
  async deleteTenant(tenantId) {
    if (
      !(await utils.confirmDialog({
        title: 'Delete Programme',
        message: 'Delete this programme? Data associated with it will become orphaned.',
        confirmText: 'Delete',
        danger: true,
      }))
    )
      return;
    try {
      await apiClient.update('tenants', tenantId, { is_active: false });
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
  },
};

ModuleRegistry.register('tenantModule', tenantModule);

export { tenantModule };
