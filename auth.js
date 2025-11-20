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
      STATE.client = supabase.createClient(
        SUPABASE_CONFIG.url,
        SUPABASE_CONFIG.anonKey
      );

      this.updateConnectionStatus(true);

      // Test connection immediately
      this.testConnection();

    } catch (error) {
      utils.showToast('Failed to connect to database: ' + error.message, 'error');
      this.updateConnectionStatus(false);
    }
  },

  /**
   * Test Supabase connection
   */
  async testConnection() {
    try {
      // Try a simple query to test connectivity
      const { error } = await STATE.client
        .from('awards')
        .select('count', { count: 'exact', head: true });

      // Don't show toast for errors - it might just be empty table or permissions
    } catch (error) {
      if (error.message.includes('Failed to fetch')) {
        utils.showToast(
          'Cannot reach Supabase servers. Check your network connection and firewall settings.',
          'error'
        );
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
   */
  async checkSession() {
    try {
      // Supabase v2 syntax for getting session
      const { data: { session }, error } = await STATE.client.auth.getSession();

      if (error) throw error;

      if (session) {
        STATE.currentUser = session.user;
        this.showDashboard();
        utils.showToast('Welcome back!', 'success');
      } else {
        this.showLogin();
      }
    } catch (error) {
      this.showLogin();
    }
  },

  /**
   * Handle user login
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
        password: password
      });
      
      if (error) throw error;
      
      STATE.currentUser = data.user;
      this.showDashboard();
      utils.showToast('Login successful!', 'success');
      this.startInactivityTimer();
      
    } catch (error) {
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
   */
  async handleLogout() {
    if (!utils.confirm('Are you sure you want to logout?')) {
      return;
    }
    
    try {
      utils.showLoading();
      
      // Supabase v2 syntax for sign out
      const { error } = await STATE.client.auth.signOut();
      
      if (error) throw error;
      
      STATE.currentUser = null;
      this.clearInactivityTimer();
      this.showLogin();
      utils.showToast('Logged out successfully', 'success');
      
      // Clear form
      document.getElementById('loginEmail').value = '';
      document.getElementById('loginPassword').value = '';
      
    } catch (error) {
      utils.showToast('Logout failed: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Show login page
   */
  showLogin() {
    document.getElementById('loginPage').style.display = 'block';
    document.getElementById('dashboardPage').style.display = 'none';
    document.getElementById('loginEmail').focus();
  },

  /**
   * Show dashboard page
   */
  showDashboard() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('dashboardPage').style.display = 'block';
    
    // Set user email in navbar
    if (STATE.currentUser) {
      document.getElementById('userEmail').textContent = STATE.currentUser.email;
    }
    
    // Load initial data
    dashboardModule.loadAllData();
  },

  /**
   * Start inactivity timer
   */
  startInactivityTimer() {
    this.clearInactivityTimer();
    
    STATE.inactivityTimer = setTimeout(() => {
      utils.showToast('You have been logged out due to inactivity', 'warning');
      this.handleLogout();
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
  }
};

// Export to window for global access
window.authModule = authModule;
