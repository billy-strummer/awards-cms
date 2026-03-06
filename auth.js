/**
 * @module authModule
 * @description Handles Supabase authentication — login, logout, session management,
 * inactivity timeouts, and periodic connection health checks.
 * Auth operations MUST remain client-side (Supabase auth requires direct JWT handling).
 */

/* ==================================================== */
/* AUTHENTICATION MODULE */
/* ==================================================== */

const authModule = {
  /**
   * Initialize Supabase client
   * Should only be called after DOM is ready
   */
  initSupabase() {
    try {
      // Check if supabase library is loaded
      if (typeof supabase === 'undefined') {
        throw new Error('Supabase library not loaded. Check your internet connection and script tags.');
      }

      // Create Supabase client using v2 syntax
      STATE.client = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

      this.updateConnectionStatus(true);
    } catch (error) {
      console.error('❌ Failed to initialize Supabase:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
      });
      utils.showToast('Failed to connect to database: ' + error.message, 'error');
      // Show login page so user isn't stuck on blank/splash screen
      this.showLogin();
    }
  },

  /**
   * Test Supabase connection
   * @returns {Promise<void>}
   */
  async testConnection() {
    try {
      // Try a simple query to test connectivity
      const { error } = await apiClient.count('awards');

      if (error) {
        console.warn('⚠️ Connection test warning:', error.message);
        // Don't show toast for this - it might just be empty table
      }
    } catch (error) {
      // "Not authenticated" can happen when the session is still hydrating
      // after page load — this is not a real connectivity problem.
      if (error.message.includes('Not authenticated')) {
        console.warn('⚠️ Connection test skipped: session still hydrating');
        return;
      }
      console.error('❌ Connection test failed:', error);
      if (error.message.includes('Failed to fetch')) {
        utils.showToast('Cannot reach Supabase servers. Check your network connection and firewall settings.', 'error');
      }
    }
  },

  /**
   * Update connection status indicator
   * @param {boolean} connected - Connection status
   */
  updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connectionStatus');
    const icon = statusEl.querySelector('.status-icon');
    const text = statusEl.querySelector('.status-text');

    if (connected) {
      statusEl.className = 'connection-status connected';
      icon.className = 'bi bi-wifi status-icon';
      text.textContent = 'Connected';
    } else {
      statusEl.className = 'connection-status disconnected';
      icon.className = 'bi bi-wifi-off status-icon';
      text.textContent = 'Disconnected';
    }
  },

  /**
   * Check for existing session on page load
   * @returns {Promise<void>}
   */
  async checkSession() {
    try {
      // Supabase v2 syntax for getting session
      const {
        data: { session },
        error,
      } = await STATE.client.auth.getSession();

      if (error) throw error;

      if (session) {
        STATE.currentUser = session.user;
        // Load RBAC permissions on session restore
        if (typeof rbacModule !== 'undefined') {
          await rbacModule.loadUserRole(session.user.email);
        }
        this.showDashboard();
        this.startInactivityTimer();
        utils.showToast('Welcome back!', 'success');
      } else {
        this.showLogin();
      }

      // Listen for auth state changes (token refresh, sign out, etc.)
      STATE.client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          STATE.currentUser = null;
          this.clearInactivityTimer();
          this.showLogin();
        } else if (event === 'TOKEN_REFRESHED' && session) {
          STATE.currentUser = session.user;
          // Reload RBAC on token refresh
          if (typeof rbacModule !== 'undefined') {
            rbacModule.loadUserRole(session.user.email);
          }
        }
      });
    } catch (error) {
      console.error('Session check error:', error);
      this.showLogin();
    }
  },

  /**
   * Handle user login
   * @returns {Promise<void>}
   */
  async handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');

    // Validate inputs
    if (!email || !password) {
      errorDiv.textContent = 'Please enter both email and password';
      errorDiv.classList.remove('d-none');
      return;
    }

    if (!utils.isValidEmail(email)) {
      errorDiv.textContent = 'Please enter a valid email address';
      errorDiv.classList.remove('d-none');
      return;
    }

    // Show loading state
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Signing in...';
    errorDiv.classList.add('d-none');

    try {
      // Supabase v2 syntax for sign in
      const { data, error } = await STATE.client.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) throw error;

      STATE.currentUser = data.user;
      // Load RBAC permissions before showing dashboard
      if (typeof rbacModule !== 'undefined') {
        await rbacModule.loadUserRole(data.user.email);
      }
      this.showDashboard();
      utils.showToast('Login successful!', 'success');
      this.startInactivityTimer();
    } catch (error) {
      console.error('Login error:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });

      // Provide specific error messages based on error type
      let errorMessage = 'Login failed. Please check your credentials.';

      if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to server. Please check your internet connection and try again.';
      } else if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please try again.';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Please confirm your email address before logging in.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      errorDiv.textContent = errorMessage;
      errorDiv.classList.remove('d-none');
      utils.showToast('Login failed', 'error');
    } finally {
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>Sign In';
    }
  },

  /**
   * Handle user logout
   * @param {boolean} force - Skip confirmation dialog (used by inactivity timer)
   * @returns {Promise<void>}
   */
  async handleLogout(force = false) {
    if (
      !force &&
      !(await utils.confirmDialog({
        title: 'Logout',
        message: 'Are you sure you want to logout?',
        confirmText: 'Logout',
        danger: false,
      }))
    ) {
      return;
    }

    try {
      utils.showLoading();

      // Supabase v2 syntax for sign out
      const { error } = await STATE.client.auth.signOut();

      if (error) throw error;

      STATE.currentUser = null;
      this.clearInactivityTimer();
      this.stopHealthCheck();

      // Clear cached data arrays to prevent data leakage after logout
      STATE.allAwards = [];
      STATE.filteredAwards = [];
      STATE.allOrganisations = [];
      STATE.filteredOrganisations = [];
      STATE.allWinners = [];
      STATE.filteredWinners = [];
      STATE.allEvents = [];
      if (typeof entriesModule !== 'undefined') {
        entriesModule.allEntries = [];
        entriesModule.filteredEntries = [];
      }

      // Clean up background timers to prevent memory leaks
      if (typeof notificationsModule !== 'undefined' && notificationsModule._pollInterval) {
        clearInterval(notificationsModule._pollInterval);
        notificationsModule._pollInterval = null;
      }
      if (utils._freshnessTimerId) {
        clearInterval(utils._freshnessTimerId);
        utils._freshnessTimerId = null;
      }
      if (typeof emailBuilder !== 'undefined' && emailBuilder.autosaveTimer) {
        clearInterval(emailBuilder.autosaveTimer);
        emailBuilder.autosaveTimer = null;
      }

      // Clean up realtime channels to prevent resource leaks
      if (STATE.client) {
        if (window._cmsRealtimeChannel) {
          STATE.client.removeChannel(window._cmsRealtimeChannel);
          window._cmsRealtimeChannel = null;
        }
        if (window._presenceChannel) {
          STATE.client.removeChannel(window._presenceChannel);
          window._presenceChannel = null;
        }
        if (typeof notificationsModule !== 'undefined' && notificationsModule._realtimeChannel) {
          STATE.client.removeChannel(notificationsModule._realtimeChannel);
          notificationsModule._realtimeChannel = null;
        }
        if (typeof orgsModule !== 'undefined' && orgsModule._realtimeChannel) {
          STATE.client.removeChannel(orgsModule._realtimeChannel);
          orgsModule._realtimeChannel = null;
        }
      }

      this.showLogin();
      utils.showToast('Logged out successfully', 'success');

      // Clear form
      document.getElementById('loginEmail').value = '';
      document.getElementById('loginPassword').value = '';
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if signOut fails (e.g. network error)
      STATE.currentUser = null;
      this.clearInactivityTimer();
      this.stopHealthCheck();
      this.showLogin();
      utils.showToast('Logged out (session may still be active on server)', 'warning');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Hide the splash screen
   */
  hideSplash() {
    const splash = document.getElementById('splashScreen');
    if (splash) {
      splash.style.display = 'none';
    }
  },

  /**
   * Show login page
   */
  showLogin() {
    this.hideSplash();
    document.getElementById('loginPage').classList.remove('d-none');
    document.getElementById('dashboardPage').classList.add('d-none');
    document.getElementById('loginEmail').focus();
  },

  /**
   * Show dashboard page
   * @returns {Promise<void>}
   */
  async showDashboard() {
    this.hideSplash();
    document.getElementById('loginPage').classList.add('d-none');
    document.getElementById('dashboardPage').classList.remove('d-none');

    // Set user email in navbar
    if (STATE.currentUser) {
      document.getElementById('userEmail').textContent = STATE.currentUser.email;
    }

    // Load initial data
    dashboardModule.loadAllData();

    // Apply saved branding immediately
    if (typeof brandingModule !== 'undefined') {
      try {
        const tenantId = typeof multiTenancyModule !== 'undefined' ? multiTenancyModule.getTenantId() : 'default';
        const config = await brandingModule.loadBranding(tenantId);
        brandingModule.applyBranding(config);
      } catch (e) {
        console.warn('Branding not applied:', e.message);
      }
    }

    // Replay any pending localStorage items that were saved during DB failures
    await utils.replayPendingQueues();

    // Start periodic connection health check
    this.startHealthCheck();
  },

  /**
   * Periodic Supabase connection health check.
   * Detects dropped connections during long sessions and updates the status indicator.
   */
  _healthCheckInterval: null,
  _consecutiveFailures: 0,

  startHealthCheck() {
    this.stopHealthCheck();
    this._consecutiveFailures = 0;
    this._healthCheckInterval = setInterval(() => this._runHealthCheck(), 60000);
    // Also check when tab becomes visible after being hidden
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  },

  stopHealthCheck() {
    if (this._healthCheckInterval) {
      clearInterval(this._healthCheckInterval);
      this._healthCheckInterval = null;
    }
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
  },

  _onVisibilityChange: function () {
    if (!document.hidden && STATE.currentUser) {
      authModule._runHealthCheck();
    }
  },

  async _runHealthCheck() {
    if (!STATE.currentUser || !STATE.client) return;
    try {
      // Health check — lightweight count query through apiClient
      await apiClient.count('cms_config');
      if (this._consecutiveFailures > 0) {
        this._consecutiveFailures = 0;
        this.updateConnectionStatus(true);
        utils.showToast('Connection restored', 'success');
        await utils.replayPendingQueues();
      }
    } catch (e) {
      this._consecutiveFailures++;
      if (this._consecutiveFailures >= 2) {
        this.updateConnectionStatus(false);
        if (this._consecutiveFailures === 2) {
          utils.showToast(
            'Connection to database lost. Changes will be saved locally until connection is restored.',
            'warning'
          );
        }
      }
    }
  },

  /**
   * Start inactivity timer
   */
  startInactivityTimer() {
    this.clearInactivityTimer();

    STATE.inactivityTimer = setTimeout(() => {
      utils.showToast('You have been logged out due to inactivity', 'warning');
      this.handleLogout(true);
    }, INACTIVITY_TIMEOUT);
  },

  /**
   * Reset inactivity timer
   */
  resetInactivityTimer() {
    if (STATE.currentUser) {
      this.startInactivityTimer();
    }
  },

  /**
   * Clear inactivity timer
   */
  clearInactivityTimer() {
    if (STATE.inactivityTimer) {
      clearTimeout(STATE.inactivityTimer);
      STATE.inactivityTimer = null;
    }
  },
};

// Export to window for global access
ModuleRegistry.register('authModule', authModule);

export { authModule };
