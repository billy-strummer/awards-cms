/* ==================================================== */
/* RBAC MODULE - Role-Based Access Control               */
/* ==================================================== */

const rbacModule = {
  currentRole: null,
  permissions: {},

  // Role definitions with module-level permissions
  ROLES: {
    super_admin: {
      label: 'Super Admin',
      modules: ['dashboard', 'awards', 'organisations', 'winners', 'entries', 'events', 'media-gallery', 'marketing', 'payments', 'crm', 'settings', 'reports', 'bitcoin'],
      actions: ['create', 'read', 'update', 'delete', 'export', 'import', 'manage_users', 'manage_roles', 'gdpr', 'backup']
    },
    admin: {
      label: 'Admin',
      modules: ['dashboard', 'awards', 'organisations', 'winners', 'entries', 'events', 'media-gallery', 'marketing', 'payments', 'crm', 'settings', 'reports', 'bitcoin'],
      actions: ['create', 'read', 'update', 'delete', 'export', 'import', 'backup']
    },
    editor: {
      label: 'Editor',
      modules: ['dashboard', 'awards', 'organisations', 'winners', 'entries', 'events', 'media-gallery', 'marketing', 'reports'],
      actions: ['create', 'read', 'update', 'export']
    },
    viewer: {
      label: 'Viewer',
      modules: ['dashboard', 'awards', 'organisations', 'winners', 'entries', 'events', 'media-gallery', 'reports'],
      actions: ['read', 'export']
    },
    judge: {
      label: 'Judge',
      modules: ['dashboard'],
      actions: ['read']
    },
    marketing: {
      label: 'Marketing',
      modules: ['dashboard', 'marketing', 'media-gallery', 'reports'],
      actions: ['create', 'read', 'update', 'export']
    },
    finance: {
      label: 'Finance',
      modules: ['dashboard', 'payments', 'reports'],
      actions: ['create', 'read', 'update', 'export']
    }
  },

  /**
   * Load user role from database after login
   * @param {string} userEmail - The email address of the user
   * @returns {Promise<void>}
   */
  async loadUserRole(userEmail) {
    try {
      const { data, error } = await STATE.client
        .from('user_roles')
        .select('role, email')
        .eq('email', userEmail)
        .limit(1);

      const row = data?.[0];
      if (error || !row) {
        // Default to viewer (most restrictive) when no role found for safety
        this.currentRole = 'viewer';
        if (!error) console.warn('No role found for user, defaulting to viewer');
      } else {
        this.currentRole = (row.role || 'viewer').toLowerCase();
      }

      this.permissions = this.ROLES[this.currentRole] || this.ROLES.viewer;
      this.applyPermissions();
      // Role loaded successfully

    } catch (e) {
      console.error('RBAC: Error loading role:', e);
      this.currentRole = 'viewer';
      this.permissions = this.ROLES.viewer;
      this.applyPermissions();
    }
  },

  /**
   * Check if user has access to a module
   * @param {string} moduleName - Module identifier
   * @returns {boolean} Whether access is allowed
   */
  canAccess(moduleName) {
    if (!this.permissions.modules) return false;
    return this.permissions.modules.includes(moduleName);
  },

  /**
   * Check if user can perform an action
   * @param {string} action - Action identifier
   * @returns {boolean} Whether the action is permitted
   */
  canPerform(action) {
    if (!this.permissions.actions) return false;
    return this.permissions.actions.includes(action);
  },

  /**
   * Apply permissions to UI - hide/show tabs and buttons
   */
  applyPermissions() {
    // Tab mapping: tab ID -> module name
    const tabMap = {
      'dashboard-tab': 'dashboard',
      'awards-tab': 'awards',
      'organisations-tab': 'organisations',
      'winners-tab': 'winners',
      'entries-tab': 'entries',
      'events-tab': 'events',
      'media-gallery-tab': 'media-gallery',
      'marketing-tab': 'marketing',
      'payments-tab': 'payments',
      'crm-tab': 'crm',
      'settings-tab': 'settings',
      'reports-tab': 'reports',
      'bitcoin-tab': 'bitcoin'
    };

    // Show/hide tabs based on module access
    Object.entries(tabMap).forEach(([tabId, moduleName]) => {
      const tab = document.getElementById(tabId);
      if (tab) {
        const li = tab.closest('li') || tab.parentElement;
        if (li) {
          li.style.display = this.canAccess(moduleName) ? '' : 'none';
        }
      }
    });

    // Show/hide action buttons based on permissions
    document.querySelectorAll('[data-rbac-action]').forEach(el => {
      const action = el.getAttribute('data-rbac-action');
      el.style.display = this.canPerform(action) ? '' : 'none';
    });

    // Disable delete buttons for non-delete users
    if (!this.canPerform('delete')) {
      document.querySelectorAll('.btn-outline-danger[onclick*="delete"], .btn-danger[onclick*="delete"]').forEach(btn => {
        btn.disabled = true;
        btn.title = 'You do not have permission to delete';
      });
    }

    // Hide settings danger zone for non-admins
    if (!this.canPerform('manage_users')) {
      const dangerZone = document.getElementById('settingsDangerZone');
      if (dangerZone) dangerZone.style.display = 'none';
    }

    // Show role badge in navbar
    this.showRoleBadge();
  },

  /**
   * Show role badge next to user email
   */
  showRoleBadge() {
    const roleLabel = this.permissions.label || this.currentRole;
    const existingBadge = document.getElementById('userRoleBadge');
    if (existingBadge) existingBadge.remove();

    const userEmail = document.getElementById('userEmail');
    if (userEmail) {
      const badge = document.createElement('span');
      badge.id = 'userRoleBadge';
      badge.className = 'badge bg-warning text-dark ms-2';
      badge.textContent = roleLabel;
      userEmail.parentElement.appendChild(badge);
    }
  },

  /**
   * Guard function - use before destructive operations
   * @param {string} action - Action identifier to check
   * @param {string} [moduleName] - Optional module to check access for
   * @returns {boolean} Whether the operation is allowed
   */
  guard(action, moduleName) {
    if (moduleName && !this.canAccess(moduleName)) {
      utils.showToast('Access denied: You do not have permission to access this module', 'error');
      return false;
    }
    if (action && !this.canPerform(action)) {
      utils.showToast(`Access denied: You do not have permission to ${action}`, 'error');
      return false;
    }
    return true;
  },

  /**
   * Validate that at least one admin remains before changing a role.
   * Call this before any role demotion to prevent admin lockout.
   * @param {string} excludeEmail - Email to exclude from the admin count check
   * @returns {Promise<boolean>} Whether at least one admin would remain
   */
  async ensureAdminExists(excludeEmail) {
    try {
      const { count, error } = await STATE.client
        .from('user_roles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'super_admin')
        .neq('email', excludeEmail);
      if (error) throw error;
      if (count === 0) {
        utils.showToast('Cannot remove the last admin. At least one admin must remain.', 'error');
        return false;
      }
      return true;
    } catch (e) {
      console.error('RBAC: Error checking admin count:', e);
      return false;
    }
  }
};

ModuleRegistry.register('rbacModule', rbacModule);

export { rbacModule };
