/* ==================================================== */
/* MAIN APPLICATION INITIALIZATION */
/* ==================================================== */

// Wait for DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Initializing British Trade Awards Admin...');
  
  // ==========================================
  // STEP 1: Initialize Supabase
  // ==========================================
  authModule.initSupabase();
  
  // ==========================================
  // STEP 2: Set up event listeners
  // ==========================================
  
  // --- Login Form ---
  const loginForm = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  
  // Login button click
  loginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    authModule.handleLogin();
  });
  
  // Login form submit
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    authModule.handleLogin();
  });
  
  // Enter key on password field
  loginPassword.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      authModule.handleLogin();
    }
  });
  
  // Enter key on email field (focus password)
  loginEmail.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      loginPassword.focus();
    }
  });
  
  // --- Logout ---
  document.getElementById('logoutBtn').addEventListener('click', () => {
    authModule.handleLogout();
  });
  
  // --- Dark Mode Toggle ---
  document.getElementById('darkModeToggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const icon = document.querySelector('#darkModeToggle i');
    icon.classList.toggle('bi-moon');
    icon.classList.toggle('bi-sun');
    
    // Save preference
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark);
    
    utils.showToast(
      isDark ? 'Dark mode enabled' : 'Light mode enabled',
      'info'
    );
  });
  
  // Restore dark mode preference
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
    const icon = document.querySelector('#darkModeToggle i');
    icon.classList.remove('bi-moon');
    icon.classList.add('bi-sun');
  }

  // --- Quick Actions Button ---
  const quickActionsBtn = document.getElementById('quickActionsBtn');
  const quickActionsMenu = document.getElementById('quickActionsMenu');

  if (quickActionsBtn && quickActionsMenu) {
    quickActionsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = quickActionsMenu.style.display === 'block';
      quickActionsMenu.style.display = isVisible ? 'none' : 'block';
      quickActionsBtn.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!quickActionsBtn.contains(e.target) && !quickActionsMenu.contains(e.target)) {
        quickActionsMenu.style.display = 'none';
        quickActionsBtn.classList.remove('active');
      }
    });
  }

  // --- Awards Filters ---
  // Create debounced version of filter function
  const debouncedAwardsFilter = utils.debounce(() => {
    awardsModule.filterAwards();
  }, 300);
  
  document.getElementById('awardsYearFilterSelect').addEventListener('change', () => {
    awardsModule.filterAwards();
  });
  
  document.getElementById('awardsSectorFilterSelect').addEventListener('change', () => {
    awardsModule.filterAwards();
  });
  
  document.getElementById('awardsRegionFilterSelect').addEventListener('change', () => {
    awardsModule.filterAwards();
  });
  
  document.getElementById('awardsSearchBox').addEventListener('input', () => {
    debouncedAwardsFilter();
  });
  
  // --- Organisation Filters ---
  const debouncedOrgFilter = utils.debounce(() => {
    orgsModule.filterOrganisations();
  }, 300);
  
  document.getElementById('orgSearchBox').addEventListener('input', () => {
    debouncedOrgFilter();
  });
  
  // --- Winners Filters ---
  const debouncedWinnerFilter = utils.debounce(() => {
    winnersModule.filterWinners();
  }, 300);
  
  document.getElementById('winnerYearFilterSelect').addEventListener('change', () => {
    winnersModule.filterWinners();
  });
  
  document.getElementById('winnerAwardFilterSelect').addEventListener('change', () => {
    winnersModule.filterWinners();
  });
  
  document.getElementById('winnerSearchBox').addEventListener('input', () => {
    debouncedWinnerFilter();
  });
  
  // --- Tab Navigation ---
  // Load winners data when Winners tab is clicked (lazy loading)
  document.getElementById('winners-tab').addEventListener('click', () => {
    if (STATE.allWinners.length === 0) {
      winnersModule.loadWinners();
    }
  });

  // Load media gallery data when Media Gallery tab is clicked (lazy loading)
  document.getElementById('media-gallery-tab').addEventListener('click', () => {
    if (STATE.allEvents.length === 0) {
      mediaGalleryModule.initialize();
    }
  });

  // Load events data when Events tab is clicked (lazy loading)
  document.getElementById('events-tab').addEventListener('click', () => {
    if (STATE.allEvents.length === 0) {
      eventsModule.loadEvents();
    }
  });

  // Refresh stats when Dashboard tab is clicked
  document.getElementById('dashboard-tab').addEventListener('click', () => {
    dashboardModule.updateStats();
  });

  // Initialize settings when Settings tab is clicked
  document.getElementById('settings-tab').addEventListener('click', () => {
    settingsModule.init();
  });

  // --- Media Upload ---
  document.getElementById('uploadMediaBtn').addEventListener('click', () => {
    winnersModule.handleUploadMedia();
  });
  
  // File input change - show file name
  document.getElementById('mediaFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const fileSize = utils.formatFileSize(file.size);
      utils.showToast(`Selected: ${file.name} (${fileSize})`, 'info');
    }
  });
  
  // --- Export Buttons (Reports Tab) ---
  // Note: We'll add these buttons to the HTML if they don't exist
  const setupExportButtons = () => {
    const exportSection = document.querySelector('#reports .content-card .d-flex');
    if (exportSection) {
      const buttons = exportSection.querySelectorAll('button');
      buttons[0]?.addEventListener('click', () => dashboardModule.exportAwardsCSV());
      buttons[1]?.addEventListener('click', () => dashboardModule.exportOrganisationsCSV());
      buttons[2]?.addEventListener('click', () => dashboardModule.exportWinnersCSV());
    }
  };
  
  // Setup export buttons after a short delay to ensure DOM is ready
  setTimeout(setupExportButtons, 100);
  
  // ==========================================
  // STEP 3: User Activity Monitoring
  // ==========================================
  // Reset inactivity timer on any user activity
  const activityEvents = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
  
  activityEvents.forEach(event => {
    document.addEventListener(event, () => {
      if (STATE.currentUser) {
        authModule.resetInactivityTimer();
      }
    }, { passive: true });
  });
  
  // ==========================================
  // STEP 4: Connection Monitoring
  // ==========================================
  // Monitor online/offline status
  window.addEventListener('online', () => {
    authModule.updateConnectionStatus(true);
    utils.showToast('Connection restored', 'success');
  });
  
  window.addEventListener('offline', () => {
    authModule.updateConnectionStatus(false);
    utils.showToast('Connection lost', 'warning');
  });
  
  // ==========================================
  // STEP 5: Keyboard Shortcuts
  // ==========================================
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K to focus search (if on appropriate tab)
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      
      const activeTab = document.querySelector('.nav-link.active');
      if (activeTab) {
        const tabId = activeTab.id;
        
        if (tabId === 'awards-tab') {
          document.getElementById('awardsSearchBox').focus();
        } else if (tabId === 'organisations-tab') {
          document.getElementById('orgSearchBox').focus();
        } else if (tabId === 'winners-tab') {
          document.getElementById('winnerSearchBox').focus();
        }
      }
    }
    
    // Escape key to close modals
    if (e.key === 'Escape') {
      const openModals = document.querySelectorAll('.modal.show');
      openModals.forEach(modal => {
        const bsModal = bootstrap.Modal.getInstance(modal);
        if (bsModal) {
          bsModal.hide();
        }
      });
    }
  });
  
  // ==========================================
  // STEP 6: Form Validation
  // ==========================================
  // Add Bootstrap validation styling to all forms
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      if (!form.checkValidity()) {
        e.preventDefault();
        e.stopPropagation();
      }
      form.classList.add('was-validated');
    });
  });
  
  // ==========================================
  // STEP 7: Error Handling
  // ==========================================
  // Global error handler
  window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    utils.showToast('An unexpected error occurred', 'error');
  });
  
  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    utils.showToast('An unexpected error occurred', 'error');
  });
  
  // ==========================================
  // STEP 8: Check for existing session
  // ==========================================
  authModule.checkSession();
  
  // ==========================================
  // STEP 9: Page Visibility API
  // ==========================================
  // Pause/resume activity tracking when tab is hidden/visible
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log('👁️ Page hidden - pausing activity tracking');
    } else {
      console.log('👁️ Page visible - resuming activity tracking');
      if (STATE.currentUser) {
        authModule.resetInactivityTimer();
      }
    }
  });
  
  // ==========================================
  // STEP 10: Performance Monitoring
  // ==========================================
  // Log page load performance
  window.addEventListener('load', () => {
    const perfData = performance.timing;
    const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
    console.log(`📊 Page loaded in ${pageLoadTime}ms`);
  });
  
  // ==========================================
  // STEP 11: Marketing Tab Event Listener
  // ==========================================
  // Load marketing data when marketing tab is clicked
  const marketingTab = document.getElementById('marketing-tab');
  if (marketingTab) {
    marketingTab.addEventListener('shown.bs.tab', () => {
      console.log('📢 Marketing tab opened');
      if (typeof marketingModule !== 'undefined') {
        marketingModule.loadAllData();
      }
    });
  }

  // Initialize Email Builder when sub-tab is opened
  const emailBuilderSubTab = document.getElementById('email-builder-subtab');
  if (emailBuilderSubTab) {
    emailBuilderSubTab.addEventListener('shown.bs.tab', () => {
      console.log('✉️ Email Builder opened');
      if (typeof emailBuilder !== 'undefined' && !emailBuilder.initialized) {
        emailBuilder.init();
      }
    });
  }

  // ==========================================
  // STEP 12: Tooltips Initialization
  // ==========================================
  // Initialize Bootstrap tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

  // ==========================================
  // INITIALIZATION COMPLETE
  // ==========================================
  console.log('✅ Application initialized successfully');
});

// ==========================================
// BEFORE UNLOAD WARNING
// ==========================================
// Warn user if they try to close the page with unsaved changes
// (You can customize this logic based on your needs)
window.addEventListener('beforeunload', (e) => {
  // Only show warning if user is logged in
  if (STATE.currentUser) {
    // Uncomment if you want to warn on close
    // e.preventDefault();
    // e.returnValue = '';
  }
});

// ==========================================
// SERVICE WORKER (Optional - for PWA support)
// ==========================================
// Uncomment to register a service worker for offline support
/*
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('✅ Service Worker registered:', registration);
      })
      .catch(error => {
        console.log('❌ Service Worker registration failed:', error);
      });
  });
}
*/

console.log('📱 British Trade Awards Admin - Version 2.0');
