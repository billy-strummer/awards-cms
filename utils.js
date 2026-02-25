/* ==================================================== */
/* UTILITY FUNCTIONS */
/* ==================================================== */

const utils = {
  /**
   * Show a toast notification
   * @param {string} message - The message to display
   * @param {string} type - Type of notification: 'success', 'error', 'warning', 'info'
   * @param {string} title - Optional title (defaults based on type)
   */
  showToast(message, type = 'info', title = null) {
    const toastEl = document.getElementById('notificationToast');
    const toastIcon = document.getElementById('toastIcon');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    
    // Set icon and styling based on type
    const config = {
      success: {
        icon: 'bi-check-circle-fill',
        title: title || 'Success',
        class: 'bg-success'
      },
      error: {
        icon: 'bi-exclamation-circle-fill',
        title: title || 'Error',
        class: 'bg-danger'
      },
      warning: {
        icon: 'bi-exclamation-triangle-fill',
        title: title || 'Warning',
        class: 'bg-warning'
      },
      info: {
        icon: 'bi-info-circle-fill',
        title: title || 'Info',
        class: 'bg-info'
      }
    };
    
    const settings = config[type] || config.info;
    
    // Reset classes
    toastEl.className = 'toast';
    toastIcon.className = `bi ${settings.icon} me-2`;
    
    // Add type-specific class
    if (type === 'success' || type === 'error' || type === 'warning') {
      toastEl.classList.add(settings.class, 'text-white');
    }
    
    // Set content
    toastTitle.textContent = settings.title;
    toastMessage.innerHTML = message;
    
    // Show toast
    const toast = new bootstrap.Toast(toastEl, {
      autohide: true,
      delay: 4000
    });
    toast.show();
  },

  /**
   * Show loading bar
   */
  showLoading() {
    this._loadingShowTime = Date.now();
    document.getElementById('loadingBar').style.display = 'block';
  },

  /**
   * Hide loading bar (with minimum 300ms display to prevent flicker)
   */
  hideLoading() {
    const elapsed = Date.now() - (this._loadingShowTime || 0);
    const minTime = 300;
    if (elapsed < minTime) {
      setTimeout(() => { document.getElementById('loadingBar').style.display = 'none'; }, minTime - elapsed);
    } else {
      document.getElementById('loadingBar').style.display = 'none';
    }
  },

  /**
   * Format date to readable string
   * @param {string} dateString - ISO date string
   * @returns {string} Formatted date
   */
  formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  },

  /**
   * Format date to relative time (e.g., "2 hours ago", "3 days ago")
   * @param {string} dateString - ISO date string
   * @returns {string} Relative time string
   */
  formatRelativeTime(dateString) {
    if (!dateString) return '-';

    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
      return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
    }

    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
  },

  /**
   * Get status badge HTML
   * @param {string} status - Status value
   * @returns {string} HTML string for badge
   */
  getStatusBadge(status) {
    const statusMap = {
      'Draft': 'secondary',
      'Pending': 'warning',
      'Approved': 'success',
      'Published': 'primary',
      'Active': 'success',
      'Archived': 'dark',
      'Rejected': 'danger'
    };
    const badgeClass = statusMap[status] || 'secondary';
    return `<span class="badge bg-${badgeClass}">${status}</span>`;
  },

  /**
   * Truncate text to specified length
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   */
  truncate(text, maxLength = 50) {
    if (!text) return '-';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  },

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Debounce function calls
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} Debounced function
   */
  debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Show confirmation dialog (legacy wrapper - use confirmDialog for new code)
   * @param {string} message - Confirmation message
   * @returns {boolean} User's choice
   */
  confirm(message) {
    return window.confirm(message);
  },

  /**
   * Show styled Bootstrap confirmation dialog
   * @param {Object} options - Dialog options
   * @param {string} options.title - Dialog title
   * @param {string} options.message - Dialog message
   * @param {string} options.confirmText - Text for confirm button
   * @param {boolean} options.danger - Whether to use danger styling
   * @returns {Promise<boolean>} User's choice
   */
  confirmDialog({ title = 'Confirm', message = 'Are you sure?', confirmText = 'Delete', danger = true } = {}) {
    return new Promise((resolve) => {
      const dlg = document.getElementById('confirmDialogModal');
      document.getElementById('confirmDialogTitle').textContent = title;
      document.getElementById('confirmDialogBody').innerHTML = message;
      const okBtn = document.getElementById('confirmDialogOk');
      okBtn.textContent = confirmText;
      okBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';

      const modal = new bootstrap.Modal(dlg);

      const onConfirm = () => {
        cleanup();
        modal.hide();
        resolve(true);
      };
      const onDismiss = () => {
        cleanup();
        resolve(false);
      };
      const cleanup = () => {
        okBtn.removeEventListener('click', onConfirm);
        dlg.removeEventListener('hidden.bs.modal', onDismiss);
      };

      // Elevate confirm dialog + its backdrop above any already-open modals
      dlg.addEventListener('shown.bs.modal', () => {
        dlg.style.zIndex = '10100';
        const backdrops = document.querySelectorAll('.modal-backdrop');
        if (backdrops.length > 0) {
          backdrops[backdrops.length - 1].style.zIndex = '10099';
        }
      }, { once: true });
      dlg.addEventListener('hidden.bs.modal', () => {
        dlg.style.zIndex = '';
      }, { once: true });

      okBtn.addEventListener('click', onConfirm);
      dlg.addEventListener('hidden.bs.modal', onDismiss);
      modal.show();
    });
  },

  /**
   * Format file size
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  },

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} Whether email is valid
   */
  isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },

  /**
   * Get unique values from array of objects
   * @param {Array} array - Array of objects
   * @param {string} key - Key to extract values from
   * @returns {Array} Array of unique values
   */
  getUniqueValues(array, key) {
    return [...new Set(array.map(item => item[key]).filter(Boolean))].sort();
  },

  /**
   * Export table data to CSV
   * @param {Array} data - Array of objects to export
   * @param {string} filename - Name of the file
   */
  exportToCSV(data, filename) {
    if (!data || data.length === 0) {
      this.showToast('No data to export', 'warning');
      return;
    }

    try {
      // Get headers
      const headers = Object.keys(data[0]);

      // Create CSV content
      const csvContent = [
        headers.join(','), // Header row
        ...data.map(row =>
          headers.map(header => {
            const value = row[header] || '';
            // Escape commas and quotes
            return `"${String(value).replace(/"/g, '""')}"`;
          }).join(',')
        )
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      this.showToast(`Exported ${data.length} records`, 'success');
    } catch (err) {
      console.error('CSV export failed:', err);
      this.showToast('Export failed: ' + err.message, 'error');
    }
  },

  /**
   * Show empty state message in table
   * @param {string} tableBodyId - ID of table body element
   * @param {number} colspan - Number of columns
   * @param {string} message - Message to display
   * @param {string} icon - Bootstrap icon class
   */
  showEmptyState(tableBodyId, colspan, message = 'No data found', icon = 'bi-inbox') {
    const tbody = document.getElementById(tableBodyId);
    tbody.innerHTML = `
      <tr>
        <td colspan="${colspan}" class="text-center py-5">
          <div class="empty-state">
            <i class="bi ${icon}"></i>
            <p>${message}</p>
          </div>
        </td>
      </tr>
    `;
  },

  /**
   * Show loading state in table
   * @param {string} tableBodyId - ID of table body element
   * @param {number} colspan - Number of columns
   */
  showTableLoading(tableBodyId, colspan) {
    const tbody = document.getElementById(tableBodyId);
    tbody.innerHTML = `
      <tr>
        <td colspan="${colspan}" class="text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="text-muted mt-2 mb-0">Loading data...</p>
        </td>
      </tr>
    `;
  },

  /**
   * Populate filter dropdown with unique values
   * @param {Array} data - Data array
   * @param {string} key - Key to extract values from
   * @param {string} selectId - ID of select element
   * @param {string} placeholder - Placeholder text
   */
  populateFilter(data, key, selectId, placeholder = 'All') {
    const select = document.getElementById(selectId);
    const uniqueValues = this.getUniqueValues(data, key);
    
    select.innerHTML = `<option value="">${placeholder}</option>`;
    uniqueValues.forEach(value => {
      select.innerHTML += `<option value="${this.escapeHtml(value)}">${this.escapeHtml(value)}</option>`;
    });
  },

  /**
   * Reusable keyboard navigation for tables.
   * Adds arrow-key row highlighting, Enter to act on a row, and / to focus search.
   * @param {Object} options
   * @param {string} options.tableBodyId - ID of the <tbody> element
   * @param {string} options.searchBoxId - ID of the search input element
   * @param {Function} [options.onEnter] - Called with (row, index) when Enter is pressed on a highlighted row
   * @param {Function} [options.onAdd] - Called when the add shortcut is triggered
   */
  initTableKeyboardNav({ tableBodyId, searchBoxId, onEnter, onAdd }) {
    let selectedIdx = -1;

    const getRows = () => document.getElementById(tableBodyId)?.querySelectorAll('tr') || [];

    const highlightRow = (idx) => {
      const rows = getRows();
      rows.forEach(r => r.classList.remove('table-active'));
      if (idx >= 0 && idx < rows.length) {
        rows[idx].classList.add('table-active');
        rows[idx].scrollIntoView({ block: 'nearest' });
      }
    };

    document.addEventListener('keydown', (e) => {
      // Skip if typing in an input/textarea/select
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') { e.target.blur(); selectedIdx = -1; highlightRow(-1); }
        return;
      }
      // Skip if modal is open
      if (document.querySelector('.modal.show')) return;
      // Check if this table's tab is active
      const tbody = document.getElementById(tableBodyId);
      if (!tbody || tbody.closest('.tab-pane') && !tbody.closest('.tab-pane.active')) return;

      const rows = getRows();
      switch(e.key) {
        case 'ArrowDown':
          e.preventDefault();
          selectedIdx = Math.min(selectedIdx + 1, rows.length - 1);
          highlightRow(selectedIdx);
          break;
        case 'ArrowUp':
          e.preventDefault();
          selectedIdx = Math.max(selectedIdx - 1, 0);
          highlightRow(selectedIdx);
          break;
        case 'Enter':
          if (selectedIdx >= 0 && onEnter) {
            e.preventDefault();
            onEnter(rows[selectedIdx], selectedIdx);
          }
          break;
        case '/':
          e.preventDefault();
          const searchEl = document.getElementById(searchBoxId);
          if (searchEl) searchEl.focus();
          break;
      }
    });
  },

  /* ==================================================== */
  /* FORM AUTO-SAVE                                       */
  /* ==================================================== */

  _autoSaveTimers: {},

  /**
   * Start periodic auto-save for a form
   * @param {string} formKey - Unique key for the form
   * @param {Function} getFormData - Function returning form data object
   * @param {number} intervalMs - Save interval in milliseconds (default 15s)
   */
  startFormAutoSave(formKey, getFormData, intervalMs = 15000) {
    // Clear any existing timer for this form
    this.stopFormAutoSave(formKey);

    this._autoSaveTimers[formKey] = setInterval(() => {
      try {
        const data = getFormData();
        if (data) {
          localStorage.setItem('draft_' + formKey, JSON.stringify({ data, savedAt: Date.now() }));
        }
      } catch(e) { console.warn('Failed to auto-save form draft to localStorage:', e.message); }
    }, intervalMs);
  },

  /**
   * Stop auto-save for a form
   * @param {string} formKey - Unique key for the form
   */
  stopFormAutoSave(formKey) {
    if (this._autoSaveTimers[formKey]) {
      clearInterval(this._autoSaveTimers[formKey]);
      delete this._autoSaveTimers[formKey];
    }
  },

  /**
   * Clear a saved draft and stop auto-saving
   * @param {string} formKey - Unique key for the form
   */
  clearFormDraft(formKey) {
    this.stopFormAutoSave(formKey);
    try { localStorage.removeItem('draft_' + formKey); } catch(e) { console.warn('Failed to clear form draft from localStorage:', e.message); }
  },

  /**
   * Retrieve a saved draft if it exists and is less than 24 hours old
   * @param {string} formKey - Unique key for the form
   * @returns {object|null} Saved draft with data and savedAt, or null
   */
  getFormDraft(formKey) {
    try {
      const saved = JSON.parse(localStorage.getItem('draft_' + formKey));
      if (saved && saved.data) {
        // Only return drafts less than 24 hours old
        if (Date.now() - saved.savedAt < 24 * 60 * 60 * 1000) {
          return saved;
        }
        localStorage.removeItem('draft_' + formKey);
      }
    } catch(e) { console.warn('Failed to parse form draft from localStorage:', e.message); }
    return null;
  },

  /**
   * Show a banner offering to restore a saved draft
   * @param {string} formKey - Unique key for the form
   * @param {Function} onRestore - Callback receiving the draft data
   * @returns {HTMLElement|false} Banner element, or false if no draft
   */
  showDraftRecoveryBanner(formKey, onRestore) {
    const draft = this.getFormDraft(formKey);
    if (!draft) return false;

    const age = this._timeAgo(draft.savedAt);
    const banner = document.createElement('div');
    banner.className = 'alert alert-info alert-dismissible fade show mb-3';
    banner.id = 'draftRecoveryBanner_' + formKey;
    banner.innerHTML = `
      <i class="bi bi-clock-history me-2"></i>
      <strong>Unsaved draft found</strong> (saved ${age} ago)
      <button type="button" class="btn btn-sm btn-info ms-2" id="restoreDraftBtn_${formKey}">Restore Draft</button>
      <button type="button" class="btn btn-sm btn-outline-secondary ms-1" id="discardDraftBtn_${formKey}">Discard</button>
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    setTimeout(() => {
      const restoreBtn = document.getElementById('restoreDraftBtn_' + formKey);
      const discardBtn = document.getElementById('discardDraftBtn_' + formKey);
      if (restoreBtn) restoreBtn.addEventListener('click', () => {
        onRestore(draft.data);
        banner.remove();
        utils.clearFormDraft(formKey);
      });
      if (discardBtn) discardBtn.addEventListener('click', () => {
        banner.remove();
        utils.clearFormDraft(formKey);
      });
    }, 100);

    return banner;
  },

  /* ==================================================== */
  /* SOFT-DELETE / TRASH                                   */
  /* ==================================================== */

  /**
   * Save a record to client-side trash before deleting
   * @param {string} table - Table name
   * @param {object} record - The full record object
   */
  softDelete(table, record) {
    try {
      const trash = JSON.parse(localStorage.getItem('trash_' + table) || '[]');
      trash.push({ ...record, _deletedAt: Date.now() });
      // Keep only last 50 items per table, and only items less than 30 days old
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const filtered = trash.filter(r => r._deletedAt > cutoff).slice(-50);
      localStorage.setItem('trash_' + table, JSON.stringify(filtered));
    } catch(e) { console.warn('Failed to save soft-delete trash to localStorage:', e.message); }
  },

  /**
   * Retrieve all trashed records for a table (less than 30 days old)
   * @param {string} table - Table name
   * @returns {Array} Array of trashed records
   */
  getTrash(table) {
    try {
      const trash = JSON.parse(localStorage.getItem('trash_' + table) || '[]');
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      return trash.filter(r => r._deletedAt > cutoff);
    } catch(e) { return []; }
  },

  /**
   * Restore a trashed record back into the database
   * @param {string} table - Table name
   * @param {object} record - The trashed record
   * @param {object} supabaseClient - Supabase client instance
   * @returns {Promise<boolean>} Whether the restore succeeded
   */
  async restoreFromTrash(table, record, supabaseClient) {
    try {
      // Remove internal fields
      const { _deletedAt, _assignmentCounts, _winnerName, _runnerUpName, _actualRegion, _countyName, ...data } = record;
      const { error } = await supabaseClient.from(table).insert(data);
      if (error) throw error;

      // Remove from trash
      const trash = this.getTrash(table);
      const updated = trash.filter(r => r.id !== record.id);
      localStorage.setItem('trash_' + table, JSON.stringify(updated));
      return true;
    } catch(e) {
      console.error('Restore failed:', e);
      return false;
    }
  },

  /**
   * Remove a single item from the trash
   * @param {string} table - Table name
   * @param {string} recordId - Record ID to remove
   */
  clearTrashItem(table, recordId) {
    try {
      const trash = this.getTrash(table);
      const updated = trash.filter(r => r.id !== recordId);
      localStorage.setItem('trash_' + table, JSON.stringify(updated));
    } catch(e) { console.warn('Failed to clear trash item from localStorage:', e.message); }
  },

  /**
   * Undo the last delete by restoring the most recent trashed record
   * @param {string} table - Table name
   */
  async undoLastDelete(table) {
    const trash = this.getTrash(table);
    if (trash.length === 0) return;
    const last = trash[trash.length - 1];
    const success = await this.restoreFromTrash(table, last, STATE.client);
    if (success) {
      this.showToast('Restored successfully', 'success');
      // Reload the relevant module
      switch(table) {
        case 'awards': awardsModule?.loadAwards(); break;
        case 'invoices': paymentsModule?.loadAllData(); break;
        case 'winners': winnersModule?.loadWinners(); break;
        case 'events': eventsModule?.loadEvents(); break;
        case 'organisations': orgsModule?.loadOrganisations(); break;
      }
    } else {
      this.showToast('Restore failed', 'error');
    }
  },

  /**
   * Format full award display name
   * e.g. "Berkshire's Best Loft Conversion Company 2026"
   * @param {object} award - Award object with award_name, county, year
   * @returns {string} Formatted award name
   */
  formatAwardName(award) {
    if (!award) return '-';
    const category = award.award_name || award.award_category || 'Award';
    const county = award.county || '';
    const year = award.year || '';

    if (county) {
      const prefix = `${county}'s Best`;
      // Avoid double prefix if award_name already contains it
      if (category.toLowerCase().startsWith(prefix.toLowerCase())) {
        return `${category} ${year}`.trim();
      }
      return `${prefix} ${category} ${year}`.trim();
    }
    return `${category} ${year}`.trim();
  },

  /* ==================================================== */
  /* DATA FRESHNESS TRACKING                              */
  /* ==================================================== */

  _dataTimestamps: {},

  trackDataLoad(key) {
    this._dataTimestamps[key] = Date.now();
    this._updateFreshnessIndicator(key);
  },

  getDataAge(key) {
    const ts = this._dataTimestamps[key];
    if (!ts) return Infinity;
    return Math.floor((Date.now() - ts) / 60000); // minutes
  },

  isDataStale(key, thresholdMinutes = 5) {
    return this.getDataAge(key) > thresholdMinutes;
  },

  _updateFreshnessIndicator(key) {
    const el = document.getElementById(key + 'Freshness');
    if (!el) return;
    const age = this.getDataAge(key);
    if (age < 1) {
      el.innerHTML = '<i class="bi bi-check-circle text-success me-1"></i><small class="text-muted">Just now</small>';
    } else if (age < 5) {
      el.innerHTML = '<i class="bi bi-check-circle text-success me-1"></i><small class="text-muted">' + age + 'm ago</small>';
    } else if (age < 15) {
      el.innerHTML = '<i class="bi bi-exclamation-circle text-warning me-1"></i><small class="text-warning">' + age + 'm ago</small>';
    } else {
      el.innerHTML = '<i class="bi bi-exclamation-triangle text-danger me-1"></i><small class="text-danger">' + age + 'm ago - <a href="#" onclick="event.preventDefault();" class="text-danger">stale</a></small>';
    }
  },

  startFreshnessTimer() {
    setInterval(() => {
      Object.keys(this._dataTimestamps).forEach(key => this._updateFreshnessIndicator(key));
    }, 60000); // Update every minute
  },

  /* ==================================================== */
  /* RECENTLY VIEWED RECORDS */
  /* ==================================================== */

  /**
   * Track a recently viewed record in localStorage
   * @param {string} type - Record type (organisation, award, invoice, entry, event, winner)
   * @param {string} id - Record ID
   * @param {string} name - Display name for the record
   */
  trackRecentlyViewed(type, id, name) {
    try {
      let recent = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
      // Remove duplicate if exists
      recent = recent.filter(r => !(r.type === type && r.id === id));
      // Add to front
      recent.unshift({ type, id, name, timestamp: Date.now() });
      // Cap at 15
      recent = recent.slice(0, 15);
      localStorage.setItem('recentlyViewed', JSON.stringify(recent));
      this.renderRecentlyViewed();
    } catch(e) { console.warn('Failed to save recently viewed to localStorage:', e.message); }
  },

  /**
   * Get recently viewed records from localStorage
   * @returns {Array} Array of recently viewed record objects
   */
  getRecentlyViewed() {
    try { return JSON.parse(localStorage.getItem('recentlyViewed') || '[]'); } catch(e) { return []; }
  },

  /**
   * Render the recently viewed dropdown list
   */
  renderRecentlyViewed() {
    const el = document.getElementById('recentlyViewedList');
    if (!el) return;
    const recent = this.getRecentlyViewed();
    if (recent.length === 0) {
      el.innerHTML = '<li><span class="dropdown-item text-muted small">No recent items</span></li>';
      return;
    }
    const icons = { award: 'bi-trophy', organisation: 'bi-building', entry: 'bi-file-earmark-text', winner: 'bi-award', invoice: 'bi-receipt', event: 'bi-calendar-event' };
    el.innerHTML = recent.map(r => {
      const icon = icons[r.type] || 'bi-clock-history';
      const ago = this._timeAgo(r.timestamp);
      return `<li><a class="dropdown-item small" href="#" onclick="event.preventDefault(); utils.openRecentItem('${r.type}', '${r.id}', '${utils.escapeHtml(r.name).replace(/'/g, "\\'")}')">
        <i class="bi ${icon} me-2 text-muted"></i>${utils.escapeHtml(r.name)}
        <span class="text-muted float-end" style="font-size:0.7rem">${ago}</span>
      </a></li>`;
    }).join('');
  },

  /**
   * Format a timestamp as a relative time ago string
   * @param {number} ts - Timestamp in milliseconds
   * @returns {string} Relative time string (e.g. "5m", "2h", "1d")
   */
  _timeAgo(ts) {
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return mins + 'm';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h';
    return Math.floor(hrs / 24) + 'd';
  },

  /**
   * Open a recently viewed item by navigating to the appropriate tab/modal
   * @param {string} type - Record type
   * @param {string} id - Record ID
   * @param {string} name - Display name
   */
  openRecentItem(type, id, name) {
    switch(type) {
      case 'organisation': orgsModule.openCompanyProfile(id, name); break;
      case 'award': document.getElementById('awards-tab')?.click(); break;
      case 'invoice': paymentsModule.viewInvoice(id); break;
      case 'entry': document.getElementById('entries-tab')?.click(); break;
      case 'event': document.getElementById('events-tab')?.click(); break;
      case 'winner': document.getElementById('winners-tab')?.click(); break;
    }
  },

  /* ==================================================== */
  /* COMMAND PALETTE                                       */
  /* ==================================================== */

  /**
   * Global command palette (Ctrl+K)
   */
  _commandPaletteOpen: false,

  initCommandPalette() {
    // Create the palette HTML if not present
    if (!document.getElementById('commandPalette')) {
      const div = document.createElement('div');
      div.id = 'commandPalette';
      div.innerHTML = `
        <div id="commandPaletteBox">
          <input type="text" id="commandPaletteInput" placeholder="Search across all modules... (Ctrl+K)" autocomplete="off">
          <div id="commandPaletteResults"></div>
        </div>`;
      document.body.appendChild(div);

      // Close on backdrop click
      div.addEventListener('click', (e) => { if (e.target === div) utils.closeCommandPalette(); });

      // Input handler
      document.getElementById('commandPaletteInput').addEventListener('input', (e) => {
        utils._searchCommandPalette(e.target.value.trim());
      });

      // Keyboard nav
      document.getElementById('commandPaletteInput').addEventListener('keydown', (e) => {
        const items = document.querySelectorAll('#commandPaletteResults .cp-item');
        const active = document.querySelector('#commandPaletteResults .cp-item.active');
        let idx = Array.from(items).indexOf(active);
        if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(idx + 1, items.length - 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(idx - 1, 0); }
        else if (e.key === 'Enter' && active) { e.preventDefault(); active.click(); return; }
        else if (e.key === 'Escape') { utils.closeCommandPalette(); return; }
        else return;
        items.forEach(i => i.classList.remove('active'));
        if (items[idx]) items[idx].classList.add('active');
      });
    }

    // Global Ctrl+K binding
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        utils.toggleCommandPalette();
      }
    });
  },

  toggleCommandPalette() {
    if (this._commandPaletteOpen) this.closeCommandPalette();
    else this.openCommandPalette();
  },

  openCommandPalette() {
    const el = document.getElementById('commandPalette');
    if (!el) return;
    el.classList.add('show');
    this._commandPaletteOpen = true;
    const input = document.getElementById('commandPaletteInput');
    input.value = '';
    document.getElementById('commandPaletteResults').innerHTML = '';
    setTimeout(() => input.focus(), 50);
    this._showCommandPaletteDefaults();
  },

  closeCommandPalette() {
    const el = document.getElementById('commandPalette');
    if (el) el.classList.remove('show');
    this._commandPaletteOpen = false;
  },

  _showCommandPaletteDefaults() {
    const tabs = [
      { label: 'Dashboard', icon: 'bi-speedometer2', tab: 'dashboard' },
      { label: 'Awards', icon: 'bi-trophy', tab: 'awards' },
      { label: 'Organisations', icon: 'bi-building', tab: 'organisations' },
      { label: 'Winners', icon: 'bi-star', tab: 'winners' },
      { label: 'Entries', icon: 'bi-file-earmark-text', tab: 'entries' },
      { label: 'Events', icon: 'bi-calendar-event', tab: 'events' },
      { label: 'Payments', icon: 'bi-credit-card', tab: 'payments' },
      { label: 'CRM', icon: 'bi-people', tab: 'crm' },
      { label: 'Settings', icon: 'bi-gear', tab: 'settings' }
    ];
    const resultsEl = document.getElementById('commandPaletteResults');
    resultsEl.innerHTML = tabs.map(t => `
      <div class="cp-item" onclick="utils._commandPaletteAction('tab', '${t.tab}')">
        <span class="cp-icon"><i class="bi ${t.icon}"></i></span>
        <span class="cp-label">Go to ${t.label}</span>
        <span class="cp-hint">Tab</span>
      </div>`).join('');
  },

  _searchCommandPalette(query) {
    if (!query) { this._showCommandPaletteDefaults(); return; }
    const q = query.toLowerCase();
    const results = [];

    // Search tabs
    const tabMap = {
      dashboard: 'bi-speedometer2', awards: 'bi-trophy', organisations: 'bi-building',
      winners: 'bi-star', entries: 'bi-file-earmark-text', events: 'bi-calendar-event',
      payments: 'bi-credit-card', crm: 'bi-people', settings: 'bi-gear'
    };
    Object.keys(tabMap).forEach(tab => {
      if (tab.includes(q)) results.push({ type: 'tab', label: `Go to ${tab.charAt(0).toUpperCase() + tab.slice(1)}`, icon: tabMap[tab], id: tab });
    });

    // Search awards
    if (window.STATE?.allAwards) {
      STATE.allAwards.filter(a => (a.award_name || '').toLowerCase().includes(q)).slice(0, 5).forEach(a => {
        results.push({ type: 'award', label: a.award_name, icon: 'bi-trophy', id: a.id, hint: 'Award' });
      });
    }

    // Search organisations
    if (window.STATE?.allOrganisations) {
      STATE.allOrganisations.filter(o => (o.company_name || '').toLowerCase().includes(q)).slice(0, 5).forEach(o => {
        results.push({ type: 'org', label: o.company_name, icon: 'bi-building', id: o.id, hint: 'Organisation' });
      });
    }

    // Search winners
    if (window.STATE?.allWinners) {
      STATE.allWinners.filter(w => (w.winner_name || '').toLowerCase().includes(q)).slice(0, 5).forEach(w => {
        results.push({ type: 'winner', label: w.winner_name, icon: 'bi-star', id: w.id, hint: 'Winner' });
      });
    }

    // Search events
    if (window.STATE?.allEvents) {
      STATE.allEvents.filter(e => (e.event_name || '').toLowerCase().includes(q)).slice(0, 5).forEach(e => {
        results.push({ type: 'event', label: e.event_name, icon: 'bi-calendar-event', id: e.id, hint: 'Event' });
      });
    }

    const resultsEl = document.getElementById('commandPaletteResults');
    if (results.length === 0) {
      resultsEl.innerHTML = '<div class="p-3 text-center text-muted">No results found</div>';
      return;
    }
    resultsEl.innerHTML = results.slice(0, 20).map((r, i) => `
      <div class="cp-item ${i === 0 ? 'active' : ''}" onclick="utils._commandPaletteAction('${r.type}', '${r.id}')">
        <span class="cp-icon"><i class="bi ${r.icon}"></i></span>
        <span class="cp-label">${utils.escapeHtml(r.label)}</span>
        ${r.hint ? `<span class="cp-hint">${r.hint}</span>` : ''}
      </div>`).join('');
  },

  _commandPaletteAction(type, id) {
    this.closeCommandPalette();
    if (type === 'tab') {
      const tabBtn = document.querySelector(`[data-bs-target="#${id}"]`) || document.querySelector(`[href="#${id}"]`);
      if (tabBtn) tabBtn.click();
    } else if (type === 'org' && window.orgsModule) {
      const tabBtn = document.querySelector('[data-bs-target="#organisations"]');
      if (tabBtn) tabBtn.click();
      setTimeout(() => { if (orgsModule.openCompanyProfile) orgsModule.openCompanyProfile(id, ''); }, 300);
    } else if (type === 'award') {
      const tabBtn = document.querySelector('[data-bs-target="#awards"]');
      if (tabBtn) tabBtn.click();
    } else if (type === 'event') {
      const tabBtn = document.querySelector('[data-bs-target="#events"]');
      if (tabBtn) tabBtn.click();
    } else if (type === 'winner') {
      const tabBtn = document.querySelector('[data-bs-target="#winners"]');
      if (tabBtn) tabBtn.click();
    }
  },

  /* ==================================================== */
  /* TOAST WITH ACTION BUTTONS                             */
  /* ==================================================== */

  /**
   * Show toast with optional action buttons
   */
  showToastWithAction(message, type, actions) {
    const actionHtml = actions ? actions.map(a =>
      `<button class="btn btn-sm btn-${this.escapeHtml(a.class || 'light')} ms-2" onclick="${this.escapeHtml(a.onclick)}">${this.escapeHtml(a.label)}</button>`
    ).join('') : '';
    this.showToast(message + actionHtml, type);
  },

  /* ==================================================== */
  /* API RETRY MECHANISM                                   */
  /* ==================================================== */

  /**
   * Retry an async operation with exponential backoff
   */
  async withRetry(fn, maxRetries = 3, baseDelay = 1000) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt === maxRetries) throw err;
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms:`, err.message);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  },

  /* ==================================================== */
  /* BULK OPERATION PROGRESS                               */
  /* ==================================================== */

  /**
   * Show progress for bulk operations
   */
  showBulkProgress(current, total, label) {
    let bar = document.getElementById('bulkProgressBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'bulkProgressBar';
      bar.className = 'position-fixed bottom-0 start-50 translate-middle-x mb-3 bg-white shadow rounded p-3';
      bar.style.zIndex = '9999';
      bar.style.minWidth = '300px';
      document.body.appendChild(bar);
    }
    const pct = Math.round((current / total) * 100);
    bar.innerHTML = `
      <div class="d-flex justify-content-between small mb-1"><span>${label || 'Processing'}</span><span>${current} of ${total}</span></div>
      <div class="progress" style="height:6px;"><div class="progress-bar" style="width:${pct}%"></div></div>`;
    bar.style.display = 'block';
    if (current >= total) {
      setTimeout(() => { bar.style.display = 'none'; }, 1500);
    }
  },

  /* ==================================================== */
  /* SCROLL TO TOP                                         */
  /* ==================================================== */

  /**
   * Initialize scroll-to-top button
   */
  initScrollToTop() {
    if (document.getElementById('scrollToTopBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'scrollToTopBtn';
    btn.innerHTML = '<i class="bi bi-arrow-up"></i>';
    btn.setAttribute('aria-label', 'Scroll to top');
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    document.body.appendChild(btn);

    window.addEventListener('scroll', () => {
      btn.classList.toggle('show', window.scrollY > 300);
    }, { passive: true });
  },

  /* ==================================================== */
  /* SEARCH HIGHLIGHT HELPER                               */
  /* ==================================================== */

  /**
   * Highlight search matches in text
   */
  highlightSearch(text, query) {
    if (!query || !text) return utils.escapeHtml(text || '');
    const escaped = utils.escapeHtml(text);
    const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped.replace(new RegExp(`(${q})`, 'gi'), '<mark class="search-highlight">$1</mark>');
  },

  /* ==================================================== */
  /* UNSAVED CHANGES TRACKER                               */
  /* ==================================================== */

  /**
   * Track form dirty state and warn on close
   */
  _dirtyForms: new Set(),

  trackFormChanges(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const inputs = modal.querySelectorAll('input, textarea, select');
    const snapshot = {};
    inputs.forEach((inp, i) => { snapshot[i] = inp.value; });
    modal._formSnapshot = snapshot;
    modal._formDirty = false;

    const onChange = () => {
      const current = {};
      inputs.forEach((inp, i) => { current[i] = inp.value; });
      modal._formDirty = JSON.stringify(current) !== JSON.stringify(snapshot);
    };
    inputs.forEach(inp => inp.addEventListener('input', onChange));

    // Warn on close
    const modalInstance = bootstrap.Modal.getInstance(modal) || new bootstrap.Modal(modal);
    modal.addEventListener('hide.bs.modal', (e) => {
      if (modal._formDirty && !modal._formSaved) {
        e.preventDefault();
        utils.confirmDialog({ title: 'Unsaved Changes', message: 'You have unsaved changes. Discard them?', confirmText: 'Discard', danger: true }).then(confirmed => {
          if (confirmed) {
            modal._formDirty = false;
            modal._formSaved = false;
            bootstrap.Modal.getInstance(modal)?.hide();
          }
        });
        return;
      }
      modal._formDirty = false;
      modal._formSaved = false;
    });
  },

  markFormSaved(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) { modal._formSaved = true; modal._formDirty = false; }
  },

  /* ==================================================== */
  /* PER-RECORD COMMENTS/NOTES (MEDIUM-12)                */
  /* ==================================================== */

  /**
   * Per-record notes/comments system (MEDIUM-12)
   */
  async loadRecordNotes(tableName, recordId) {
    try {
      const { data, error } = await STATE.client
        .from('record_notes')
        .select('*')
        .eq('table_name', tableName)
        .eq('record_id', recordId)
        .order('created_at', { ascending: false });
      if (error) {
        // Table may not exist - return empty gracefully
        console.warn('record_notes table not available:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      return [];
    }
  },

  async addRecordNote(tableName, recordId, noteText) {
    try {
      const { error } = await STATE.client
        .from('record_notes')
        .insert([{
          table_name: tableName,
          record_id: recordId,
          note: noteText,
          created_by: STATE.user?.email || 'unknown',
          created_at: new Date().toISOString()
        }]);
      if (error) throw error;
      utils.showToast('Note added', 'success');
      return true;
    } catch (e) {
      utils.showToast('Could not save note: ' + e.message, 'warning');
      return false;
    }
  },

  renderNotesPanel(containerId, tableName, recordId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `<div class="text-center py-2"><div class="spinner-border spinner-border-sm"></div></div>`;

    this.loadRecordNotes(tableName, recordId).then(notes => {
      container.innerHTML = `
        <div class="mb-2">
          <div class="input-group input-group-sm">
            <input type="text" class="form-control" id="noteInput_${containerId}" placeholder="Add a note...">
            <button class="btn btn-outline-primary" onclick="utils._submitNote('${containerId}', '${tableName}', '${recordId}')"><i class="bi bi-plus"></i></button>
          </div>
        </div>
        <div class="notes-list" style="max-height:200px;overflow-y:auto;">
          ${notes.length === 0 ? '<p class="text-muted small">No notes yet</p>' :
            notes.map(n => `
              <div class="small border-bottom py-1">
                <div>${utils.escapeHtml(n.note)}</div>
                <div class="text-muted" style="font-size:0.7rem;">${n.created_by} &middot; ${utils.formatRelativeTime(n.created_at)}</div>
              </div>`).join('')}
        </div>`;
    });
  },

  async _submitNote(containerId, tableName, recordId) {
    const input = document.getElementById('noteInput_' + containerId);
    if (!input || !input.value.trim()) return;
    await this.addRecordNote(tableName, recordId, input.value.trim());
    this.renderNotesPanel(containerId, tableName, recordId);
  },

  /* ==================================================== */
  /* USER ATTRIBUTION / LAST MODIFIED BY (MEDIUM-13)      */
  /* ==================================================== */

  /**
   * Track last modified by for records (MEDIUM-13)
   */
  getModifiedByData() {
    return {
      last_modified_by: STATE.user?.email || 'unknown',
      last_modified_at: new Date().toISOString()
    };
  },

  /* ==================================================== */
  /* COLUMN VISIBILITY TOGGLES (MEDIUM-1)                 */
  /* ==================================================== */

  /**
   * Column visibility toggle system (MEDIUM-1)
   */
  showColumnVisibilityDialog(tableId, columns) {
    const storageKey = `colVis_${tableId}`;
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');

    let html = '<div class="p-3"><h6>Show/Hide Columns</h6>';
    columns.forEach((col, i) => {
      const visible = saved[col.key] !== false;
      html += `<div class="form-check"><input class="form-check-input" type="checkbox" id="colVis_${i}" ${visible ? 'checked' : ''} onchange="utils._toggleColumn('${tableId}', '${col.key}', this.checked)"><label class="form-check-label" for="colVis_${i}">${col.label}</label></div>`;
    });
    html += '</div>';

    // Show in a popover or small modal
    let dialog = document.getElementById('colVisDialog');
    if (!dialog) {
      dialog = document.createElement('div');
      dialog.id = 'colVisDialog';
      dialog.className = 'position-fixed bg-white shadow rounded border p-0';
      dialog.style.cssText = 'z-index:9998;top:50%;left:50%;transform:translate(-50%,-50%);max-width:300px;';
      document.body.appendChild(dialog);
    }
    dialog.innerHTML = html + '<div class="p-2 border-top"><button class="btn btn-sm btn-secondary w-100" onclick="document.getElementById(\'colVisDialog\').style.display=\'none\'">Close</button></div>';
    dialog.style.display = 'block';
  },

  _toggleColumn(tableId, colKey, visible) {
    const storageKey = `colVis_${tableId}`;
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    saved[colKey] = visible;
    localStorage.setItem(storageKey, JSON.stringify(saved));

    // Toggle column visibility via CSS class
    const table = document.getElementById(tableId) || document.querySelector(`#${tableId}`);
    if (!table) return;
    const colIndex = Array.from(table.querySelectorAll('thead th')).findIndex(th => th.dataset.colKey === colKey);
    if (colIndex === -1) return;
    table.querySelectorAll(`tr`).forEach(row => {
      const cells = row.querySelectorAll('th, td');
      if (cells[colIndex]) cells[colIndex].style.display = visible ? '' : 'none';
    });
  },

  applyColumnVisibility(tableId) {
    const storageKey = `colVis_${tableId}`;
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    Object.entries(saved).forEach(([colKey, visible]) => {
      if (!visible) this._toggleColumn(tableId, colKey, false);
    });
  },

  /* ==================================================== */
  /* ROW COUNT SUMMARY (LOW-1)                            */
  /* ==================================================== */

  /**
   * Render a consistent row count summary (LOW-1)
   */
  renderRowCount(containerId, shown, total, label) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = shown < total
      ? `<span class="text-muted small">Showing ${shown} of ${total} ${label || 'records'}</span>`
      : `<span class="text-muted small">${total} ${label || 'records'}</span>`;
  },

  /* ==================================================== */
  /* SKELETON LOADERS (UX-6)                              */
  /* ==================================================== */

  /**
   * Show skeleton loading rows in a table body
   * @param {string} tableBodyId - ID of table body element
   * @param {number} colspan - Number of columns
   * @param {number} rows - Number of skeleton rows to show
   */
  showSkeletonLoading(tableBodyId, colspan, rows = 5) {
    const tbody = document.getElementById(tableBodyId);
    if (!tbody) return;
    const skeletonRows = Array.from({ length: rows }, () => {
      const cells = Array.from({ length: colspan }, () =>
        `<td><div class="skeleton-line" style="height:14px;background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);background-size:200% 100%;animation:skeleton-shimmer 1.5s infinite;border-radius:4px;width:${60 + Math.random() * 40}%"></div></td>`
      ).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    tbody.innerHTML = skeletonRows;
    // Inject shimmer animation if not already present
    if (!document.getElementById('skeletonStyle')) {
      const style = document.createElement('style');
      style.id = 'skeletonStyle';
      style.textContent = '@keyframes skeleton-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}';
      document.head.appendChild(style);
    }
  },

  /* ==================================================== */
  /* ENHANCED EMPTY STATES (UX-7)                         */
  /* ==================================================== */

  /**
   * Show enhanced empty state with icon, message, description and optional CTA
   * @param {string} tableBodyId - ID of table body element
   * @param {number} colspan - Number of columns
   * @param {Object} options - Empty state options
   */
  showEnhancedEmptyState(tableBodyId, colspan, options = {}) {
    const {
      icon = 'bi-inbox',
      message = 'No data found',
      description = '',
      actionLabel = '',
      actionOnclick = '',
      isFiltered = false
    } = options;
    const tbody = document.getElementById(tableBodyId);
    if (!tbody) return;
    const filterHint = isFiltered ? '<p class="text-muted small mb-2">Try adjusting your filters or search terms</p>' : '';
    const actionBtn = actionLabel ? `<button class="btn btn-sm btn-primary mt-2" onclick="${this.escapeHtml(actionOnclick)}"><i class="bi bi-plus-circle me-1"></i>${this.escapeHtml(actionLabel)}</button>` : '';
    tbody.innerHTML = `
      <tr>
        <td colspan="${colspan}" class="text-center py-5">
          <div class="empty-state">
            <i class="bi ${icon} display-4 d-block mb-2 opacity-25"></i>
            <p class="fw-semibold mb-1">${message}</p>
            ${description ? `<p class="text-muted small mb-1">${description}</p>` : ''}
            ${filterHint}
            ${actionBtn}
          </div>
        </td>
      </tr>
    `;
  },

  /* ==================================================== */
  /* FUZZY SEARCH (UX-14)                                 */
  /* ==================================================== */

  /**
   * Fuzzy match a query against a string
   * Returns a score (0 = no match, higher = better match)
   * @param {string} text - Text to search in
   * @param {string} query - Query to search for
   * @returns {number} Match score (0 = no match)
   */
  fuzzyMatch(text, query) {
    if (!text || !query) return 0;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Exact substring match gets highest score
    if (lowerText.includes(lowerQuery)) return 100;

    // Fuzzy character-by-character match
    let score = 0;
    let queryIdx = 0;
    let lastMatchIdx = -1;
    for (let i = 0; i < lowerText.length && queryIdx < lowerQuery.length; i++) {
      if (lowerText[i] === lowerQuery[queryIdx]) {
        score += 10;
        // Bonus for consecutive matches
        if (lastMatchIdx === i - 1) score += 5;
        // Bonus for match at word boundary
        if (i === 0 || lowerText[i - 1] === ' ' || lowerText[i - 1] === '-') score += 3;
        lastMatchIdx = i;
        queryIdx++;
      }
    }
    // All query characters must be found
    if (queryIdx < lowerQuery.length) return 0;
    // Penalize long strings (prefer shorter, more relevant matches)
    score -= Math.max(0, (lowerText.length - lowerQuery.length) * 0.5);
    return Math.max(1, score);
  },

  /**
   * Filter and sort an array using fuzzy matching
   * @param {Array} items - Array of objects
   * @param {string} query - Search query
   * @param {string[]} keys - Object keys to search in
   * @returns {Array} Filtered and sorted items
   */
  fuzzyFilter(items, query, keys) {
    if (!query || !query.trim()) return items;
    return items
      .map(item => {
        const maxScore = Math.max(...keys.map(key => this.fuzzyMatch(String(item[key] || ''), query)));
        return { item, score: maxScore };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  },

  /* ==================================================== */
  /* EXCEL/PDF EXPORT (UX-15)                             */
  /* ==================================================== */

  /**
   * Export data to Excel-compatible format (TSV with .xls extension)
   * @param {Array} data - Array of objects to export
   * @param {string} filename - Name of the file (without extension)
   * @param {Object} options - Export options
   */
  exportToExcel(data, filename, options = {}) {
    if (!data || data.length === 0) {
      this.showToast('No data to export', 'warning');
      return;
    }

    try {
      const { columns, formatDates = true } = options;
      const headers = columns || Object.keys(data[0]);
      const headerLabels = headers.map(h => h.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));

      let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table>';
      html += '<tr>' + headerLabels.map(h => `<th style="font-weight:bold;background:#4472C4;color:white;padding:8px">${this.escapeHtml(h)}</th>`).join('') + '</tr>';
      data.forEach(row => {
        html += '<tr>' + headers.map(header => {
          let value = row[header] || '';
          if (formatDates && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
            value = this.formatDate(value);
          }
          return `<td style="padding:4px;border:1px solid #ddd">${this.escapeHtml(String(value))}</td>`;
        }).join('') + '</tr>';
      });
      html += '</table></body></html>';

      const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}.xls`;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      this.showToast(`Exported ${data.length} records to Excel`, 'success');
    } catch (err) {
      console.error('Excel export failed:', err);
      this.showToast('Export failed: ' + err.message, 'error');
    }
  },

  /**
   * Export data to a printable PDF-style HTML page
   * @param {Array} data - Array of objects to export
   * @param {string} title - Report title
   * @param {Object} options - Export options
   */
  exportToPrintablePDF(data, title, options = {}) {
    if (!data || data.length === 0) {
      this.showToast('No data to export', 'warning');
      return;
    }

    try {
      const { columns, formatDates = true } = options;
      const headers = columns || Object.keys(data[0]);
      const headerLabels = headers.map(h => h.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        this.showToast('Pop-up blocked. Please allow pop-ups for PDF export.', 'error');
        return;
      }
      printWindow.document.write(`<!DOCTYPE html><html><head><title>${this.escapeHtml(title)}</title>
        <style>
          body{font-family:Arial,sans-serif;margin:20px;color:#333}
          h1{font-size:18px;margin-bottom:4px}
          .meta{color:#666;font-size:12px;margin-bottom:16px}
          table{width:100%;border-collapse:collapse;font-size:12px}
          th{background:#f8f9fa;font-weight:bold;text-align:left;padding:8px;border:1px solid #dee2e6}
          td{padding:6px 8px;border:1px solid #dee2e6}
          tr:nth-child(even){background:#f8f9fa}
          .footer{margin-top:20px;font-size:10px;color:#999;text-align:center}
          @media print{body{margin:0}.footer{position:fixed;bottom:10px;width:100%}}
        </style>
      </head><body>
        <h1>${this.escapeHtml(title)}</h1>
        <div class="meta">Generated: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} | ${data.length} records</div>
        <table>
          <thead><tr>${headerLabels.map(h => `<th>${this.escapeHtml(h)}</th>`).join('')}</tr></thead>
          <tbody>${data.map(row => '<tr>' + headers.map(header => {
            let value = row[header] || '';
            if (formatDates && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
              value = this.formatDate(value);
            }
            return `<td>${this.escapeHtml(String(value))}</td>`;
          }).join('') + '</tr>').join('')}</tbody>
        </table>
        <div class="footer">Awards CMS Report</div>
      </body></html>`);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    } catch (err) {
      console.error('PDF export failed:', err);
      this.showToast('Export failed: ' + err.message, 'error');
    }
  },

  /* ==================================================== */
  /* LOADING MINIMUM DISPLAY TIME (UX-17)                 */
  /* ==================================================== */

  _loadingShowTime: 0,

  /**
   * Show loading bar with minimum display time tracking
   */
  showLoadingWithMinTime() {
    this._loadingShowTime = Date.now();
    document.getElementById('loadingBar').style.display = 'block';
  },

  /**
   * Hide loading bar with minimum 300ms display to prevent flicker
   */
  async hideLoadingWithMinTime() {
    const elapsed = Date.now() - this._loadingShowTime;
    const minTime = 300;
    if (elapsed < minTime) {
      await new Promise(r => setTimeout(r, minTime - elapsed));
    }
    document.getElementById('loadingBar').style.display = 'none';
  },

  /* ==================================================== */
  /* SORT INDICATORS (UX-9)                               */
  /* ==================================================== */

  /**
   * Add sort indicator arrows to table headers
   * @param {string} tableId - Table element ID
   * @param {string} currentField - Currently sorted field
   * @param {string} currentDir - Current sort direction ('asc' or 'desc')
   * @param {Function} onSort - Callback(field, direction) when header is clicked
   */
  initSortableHeaders(tableId, currentField, currentDir, onSort) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const headers = table.querySelectorAll('thead th[data-sort-field]');
    headers.forEach(th => {
      const field = th.dataset.sortField;
      // Remove old indicators
      th.querySelectorAll('.sort-indicator').forEach(el => el.remove());
      // Add indicator
      const indicator = document.createElement('span');
      indicator.className = 'sort-indicator ms-1';
      if (field === currentField) {
        indicator.innerHTML = currentDir === 'asc' ? '<i class="bi bi-caret-up-fill"></i>' : '<i class="bi bi-caret-down-fill"></i>';
        th.classList.add('text-primary');
      } else {
        indicator.innerHTML = '<i class="bi bi-caret-up opacity-25"></i>';
        th.classList.remove('text-primary');
      }
      th.appendChild(indicator);
      th.style.cursor = 'pointer';
      th.style.userSelect = 'none';

      // Click handler (remove old, add new)
      const newTh = th.cloneNode(true);
      th.parentNode.replaceChild(newTh, th);
      newTh.addEventListener('click', () => {
        const newDir = (field === currentField && currentDir === 'asc') ? 'desc' : 'asc';
        onSort(field, newDir);
      });
    });
  },

  /**
   * Persist sort state to localStorage
   */
  saveSortState(moduleKey, field, direction) {
    try { localStorage.setItem(`sort_${moduleKey}`, JSON.stringify({ field, direction })); } catch (e) { /* non-critical */ }
  },

  /**
   * Load persisted sort state
   */
  loadSortState(moduleKey) {
    try { return JSON.parse(localStorage.getItem(`sort_${moduleKey}`)); } catch (e) { return null; }
  },

  /* ==================================================== */
  /* SAVED FILTERS (UX-13)                                */
  /* ==================================================== */

  /**
   * Save a named filter view
   * @param {string} moduleKey - Module identifier
   * @param {string} name - View name
   * @param {Object} filters - Filter state object
   */
  saveFilterView(moduleKey, name, filters) {
    try {
      const key = `savedViews_${moduleKey}`;
      const views = JSON.parse(localStorage.getItem(key) || '[]');
      views.push({ name, filters, created: Date.now() });
      localStorage.setItem(key, JSON.stringify(views));
      this.showToast(`View "${name}" saved`, 'success');
    } catch (e) {
      this.showToast('Failed to save view', 'warning');
    }
  },

  /**
   * Get all saved filter views for a module
   */
  getSavedFilterViews(moduleKey) {
    try { return JSON.parse(localStorage.getItem(`savedViews_${moduleKey}`) || '[]'); } catch (e) { return []; }
  },

  /**
   * Delete a saved filter view
   */
  deleteSavedFilterView(moduleKey, index) {
    try {
      const key = `savedViews_${moduleKey}`;
      const views = JSON.parse(localStorage.getItem(key) || '[]');
      const name = views[index]?.name;
      views.splice(index, 1);
      localStorage.setItem(key, JSON.stringify(views));
      this.showToast(`Deleted view "${name}"`, 'info');
    } catch (e) {
      this.showToast('Failed to delete view', 'warning');
    }
  },

  /**
   * Render saved views dropdown
   * @param {string} containerId - Container element ID
   * @param {string} moduleKey - Module identifier
   * @param {Function} onLoad - Callback(filters) when a view is loaded
   */
  renderSavedViewsDropdown(containerId, moduleKey, onLoad) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const views = this.getSavedFilterViews(moduleKey);
    if (views.length === 0) {
      el.innerHTML = '<option value="">No saved views</option>';
      return;
    }
    el.innerHTML = '<option value="">Load saved view...</option>' +
      views.map((v, i) => `<option value="${i}">${this.escapeHtml(v.name)}</option>`).join('');
    el.onchange = () => {
      const idx = parseInt(el.value);
      if (!isNaN(idx) && views[idx]) {
        onLoad(views[idx].filters);
        this.showToast(`Loaded view: ${views[idx].name}`, 'success');
      }
    };
  },

  /* ==================================================== */
  /* ENHANCED UNDO/REDO SYSTEM (UX-16)                    */
  /* ==================================================== */

  _undoStacks: {},
  _redoStacks: {},

  /**
   * Push a change to the undo stack for a module
   * @param {string} moduleKey - Module identifier
   * @param {Object} change - Change descriptor {type, description, data, undoFn, redoFn}
   */
  pushUndo(moduleKey, change) {
    if (!this._undoStacks[moduleKey]) this._undoStacks[moduleKey] = [];
    this._undoStacks[moduleKey].push({ ...change, timestamp: Date.now() });
    // Limit stack size
    if (this._undoStacks[moduleKey].length > 30) this._undoStacks[moduleKey].shift();
    // Clear redo stack on new action
    this._redoStacks[moduleKey] = [];
  },

  /**
   * Undo the last change for a module
   */
  async undo(moduleKey) {
    const stack = this._undoStacks[moduleKey];
    if (!stack || stack.length === 0) {
      this.showToast('Nothing to undo', 'info');
      return;
    }
    const change = stack.pop();
    try {
      await change.undoFn();
      if (!this._redoStacks[moduleKey]) this._redoStacks[moduleKey] = [];
      this._redoStacks[moduleKey].push(change);
      this.showToast(`Undo: ${change.description}`, 'success');
    } catch (e) {
      this.showToast('Undo failed: ' + e.message, 'error');
      stack.push(change); // Put it back
    }
  },

  /**
   * Redo the last undone change for a module
   */
  async redo(moduleKey) {
    const stack = this._redoStacks[moduleKey];
    if (!stack || stack.length === 0) {
      this.showToast('Nothing to redo', 'info');
      return;
    }
    const change = stack.pop();
    try {
      await change.redoFn();
      this._undoStacks[moduleKey].push(change);
      this.showToast(`Redo: ${change.description}`, 'success');
    } catch (e) {
      this.showToast('Redo failed: ' + e.message, 'error');
      stack.push(change);
    }
  },

  /**
   * Check if undo/redo is available
   */
  canUndo(moduleKey) { return (this._undoStacks[moduleKey]?.length || 0) > 0; },
  canRedo(moduleKey) { return (this._redoStacks[moduleKey]?.length || 0) > 0; },

  /* ==================================================== */
  /* NETWORK ERROR HANDLING (UX-5)                        */
  /* ==================================================== */

  /**
   * Classify and format a user-friendly error message
   * @param {Error} error - The error object
   * @returns {Object} { message, type, isNetwork, canRetry }
   */
  classifyError(error) {
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network request failed')) {
      return { message: 'Network connection lost. Please check your internet and try again.', type: 'error', isNetwork: true, canRetry: true };
    }
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return { message: 'Request timed out. The server may be busy — please try again.', type: 'warning', isNetwork: true, canRetry: true };
    }
    if (msg.includes('cors') || msg.includes('cross-origin')) {
      return { message: 'Connection blocked by security policy. Please contact support.', type: 'error', isNetwork: true, canRetry: false };
    }
    if (msg.includes('401') || msg.includes('unauthorized')) {
      return { message: 'Session expired. Please log in again.', type: 'warning', isNetwork: false, canRetry: false };
    }
    if (msg.includes('403') || msg.includes('forbidden')) {
      return { message: 'You do not have permission for this action.', type: 'error', isNetwork: false, canRetry: false };
    }
    if (msg.includes('404') || msg.includes('not found')) {
      return { message: 'The requested resource was not found.', type: 'warning', isNetwork: false, canRetry: false };
    }
    return { message: error.message || 'An unexpected error occurred.', type: 'error', isNetwork: false, canRetry: false };
  },

  /**
   * Show error toast with optional retry button
   * @param {Error} error - The error
   * @param {string} context - What was being done (e.g., "loading awards")
   * @param {Function} retryFn - Optional retry function
   */
  showErrorWithRetry(error, context, retryFn) {
    const classified = this.classifyError(error);
    const retryHtml = (classified.canRetry && retryFn)
      ? ` <button class="btn btn-sm btn-light ms-2" onclick="(${retryFn.toString()})()">Retry</button>`
      : '';
    this.showToast(`Failed ${context}: ${classified.message}${retryHtml}`, classified.type);
  },

  /* ==================================================== */
  /* BATCH OPERATION WITH PARTIAL FAILURE (UX-8)          */
  /* ==================================================== */

  /**
   * Run a batch operation with progress tracking and partial failure handling
   * @param {Array} items - Items to process
   * @param {Function} processFn - Async function(item, index) to process each item
   * @param {string} label - Operation label for progress display
   * @returns {Object} { succeeded: [], failed: [] }
   */
  async runBatchOperation(items, processFn, label = 'Processing') {
    const succeeded = [];
    const failed = [];
    for (let i = 0; i < items.length; i++) {
      this.showBulkProgress(i + 1, items.length, label);
      try {
        await processFn(items[i], i);
        succeeded.push(items[i]);
      } catch (e) {
        failed.push({ item: items[i], error: e.message });
      }
    }
    // Report results
    if (failed.length === 0) {
      this.showToast(`${label}: All ${succeeded.length} items processed successfully`, 'success');
    } else if (succeeded.length === 0) {
      this.showToast(`${label}: All ${failed.length} items failed`, 'error');
    } else {
      this.showToast(`${label}: ${succeeded.length} succeeded, ${failed.length} failed. Check console for details.`, 'warning');
      console.warn(`${label} - Failed items:`, failed);
    }
    return { succeeded, failed };
  },

  /* ==================================================== */
  /* KEYBOARD SHORTCUT HELP OVERLAY (UX-19)               */
  /* ==================================================== */

  /**
   * Show keyboard shortcuts help overlay (triggered by ?)
   */
  initKeyboardShortcutHelp() {
    document.addEventListener('keydown', (e) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        e.preventDefault();
        this.toggleShortcutHelp();
      }
    });
  },

  toggleShortcutHelp() {
    let overlay = document.getElementById('shortcutHelpOverlay');
    if (overlay) {
      overlay.remove();
      return;
    }
    overlay = document.createElement('div');
    overlay.id = 'shortcutHelpOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:white;border-radius:12px;padding:24px;max-width:600px;width:90%;max-height:80vh;overflow-y:auto;">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="mb-0"><i class="bi bi-keyboard me-2"></i>Keyboard Shortcuts</h5>
          <button class="btn btn-sm btn-outline-secondary" onclick="document.getElementById('shortcutHelpOverlay').remove()"><i class="bi bi-x-lg"></i></button>
        </div>
        <table class="table table-sm mb-0">
          <tbody>
            <tr><td><kbd>Ctrl</kbd> + <kbd>K</kbd></td><td>Open command palette</td></tr>
            <tr><td><kbd>/</kbd></td><td>Focus search box</td></tr>
            <tr><td><kbd>?</kbd></td><td>Show this help</td></tr>
            <tr><td><kbd>&uarr;</kbd> <kbd>&darr;</kbd></td><td>Navigate table rows</td></tr>
            <tr><td><kbd>Enter</kbd></td><td>Open selected row</td></tr>
            <tr><td><kbd>Escape</kbd></td><td>Close modal / deselect</td></tr>
            <tr><td><kbd>Ctrl</kbd> + <kbd>Z</kbd></td><td>Undo last action</td></tr>
            <tr><td><kbd>Ctrl</kbd> + <kbd>Y</kbd></td><td>Redo last action</td></tr>
          </tbody>
        </table>
        <p class="text-muted small mt-3 mb-0 text-center">Press <kbd>?</kbd> or <kbd>Escape</kbd> to close</p>
      </div>
    `;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') {
        document.getElementById('shortcutHelpOverlay')?.remove();
        document.removeEventListener('keydown', handler);
      }
    });
    document.body.appendChild(overlay);
  },

  /* ==================================================== */
  /* DEBOUNCED SEARCH INPUTS (UX-18)                      */
  /* ==================================================== */

  /**
   * Attach a debounced input handler to a search box
   * @param {string} inputId - Input element ID
   * @param {Function} handler - Search handler function
   * @param {number} delay - Debounce delay in ms
   */
  initDebouncedSearch(inputId, handler, delay = 300) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const debouncedHandler = this.debounce(handler, delay);
    input.addEventListener('input', debouncedHandler);
    return debouncedHandler;
  },

  /**
   * Protect a modal from being closed during an async operation
   * @param {string} modalId - Modal element ID
   * @param {Function} asyncFn - Async operation to run
   */
  async protectModalDuringSave(modalId, asyncFn) {
    const modal = document.getElementById(modalId);
    if (!modal) return asyncFn();
    const closeBtn = modal.querySelector('.btn-close');
    const cancelBtns = modal.querySelectorAll('[data-bs-dismiss="modal"]');
    // Disable close buttons
    if (closeBtn) closeBtn.disabled = true;
    cancelBtns.forEach(btn => btn.disabled = true);
    try {
      return await asyncFn();
    } finally {
      if (closeBtn) closeBtn.disabled = false;
      cancelBtns.forEach(btn => btn.disabled = false);
    }
  },

  /* ==================================================== */
  /* INLINE FORM VALIDATION (UX-3)                        */
  /* ==================================================== */

  /**
   * Initialize inline validation for a form
   * Shows real-time validation feedback as user types
   * @param {string} formId - Form element ID or container ID
   */
  initInlineValidation(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    const inputs = form.querySelectorAll('input[required], select[required], textarea[required], input[pattern], input[type="email"], input[type="url"]');
    inputs.forEach(input => {
      input.addEventListener('blur', () => this._validateField(input));
      input.addEventListener('input', () => {
        if (input.classList.contains('is-invalid')) {
          this._validateField(input);
        }
      });
    });
  },

  _validateField(input) {
    const value = input.value.trim();
    let isValid = true;
    let message = '';

    if (input.required && !value) {
      isValid = false;
      message = 'This field is required';
    } else if (input.type === 'email' && value && !this.isValidEmail(value)) {
      isValid = false;
      message = 'Please enter a valid email address';
    } else if (input.type === 'url' && value && !/^https?:\/\/.+/.test(value)) {
      isValid = false;
      message = 'Please enter a valid URL (starting with http:// or https://)';
    } else if (input.pattern && value && !new RegExp(input.pattern).test(value)) {
      isValid = false;
      message = input.title || 'Please match the required format';
    } else if (input.minLength > 0 && value.length < input.minLength) {
      isValid = false;
      message = `Minimum ${input.minLength} characters required`;
    }

    if (isValid) {
      input.classList.remove('is-invalid');
      input.classList.add('is-valid');
      const feedback = input.parentElement?.querySelector('.invalid-feedback');
      if (feedback) feedback.remove();
    } else {
      input.classList.remove('is-valid');
      input.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
      let feedback = input.parentElement?.querySelector('.invalid-feedback');
      if (!feedback) {
        feedback = document.createElement('div');
        feedback.className = 'invalid-feedback';
        feedback.setAttribute('role', 'alert');
        feedback.setAttribute('aria-live', 'polite');
        input.parentElement?.appendChild(feedback);
      }
      feedback.textContent = message;
    }
    return isValid;
  }
};

// Export to window for global access
window.utils = utils;
