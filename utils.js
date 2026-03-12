/* ==================================================== */
/* UTILITY FUNCTIONS */
/* ==================================================== */

const utils = {
  /**
   * Safely copy text to clipboard with fallback and error handling
   */
  copyToClipboard(text, successMsg = 'Copied to clipboard!') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          utils.showToast(successMsg, 'success');
        })
        .catch(() => {
          // Fallback for clipboard permission denied
          utils._fallbackCopy(text, successMsg);
        });
    } else {
      utils._fallbackCopy(text, successMsg);
    }
  },
  _fallbackCopy(text, successMsg) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      utils.showToast(successMsg, 'success');
    } catch (e) {
      utils.showToast('Failed to copy to clipboard', 'error');
    }
  },

  /**
   * Generic slider label updater for range inputs.
   * Reads the slider's current value and writes it to the target label element.
   * HTML usage: data-on-input="utils.updateSliderLabel" data-id="labelElementId" data-args='{"suffix":"%"}'
   * @param {Event} event - The input event from the range slider.
   */
  updateSliderLabel(event) {
    const input = event?.target || event;
    const labelId = input?.getAttribute?.('data-id');
    if (!labelId) return;
    const label = document.getElementById(labelId);
    if (!label) return;
    let args = {};
    try {
      args = JSON.parse(input.getAttribute('data-args') || '{}');
    } catch (_) {
      /* ignore */
    }
    label.textContent = `${input.value}${args.suffix || ''}`;
  },

  /**
   * Show a toast notification
   * @param {string} message - The message to display
   * @param {string} type - Type of notification: 'success', 'error', 'warning', 'info'
   * @param {string} title - Optional title (defaults based on type)
   */
  showToast(message, type = 'info', title = null) {
    const toastEl = document.getElementById('notificationToast');
    if (!toastEl) return;
    const toastIcon = document.getElementById('toastIcon');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');

    // Set icon and styling based on type
    const config = {
      success: {
        icon: 'bi-check-circle-fill',
        title: title || 'Success',
        class: 'bg-success',
      },
      error: {
        icon: 'bi-exclamation-circle-fill',
        title: title || 'Error',
        class: 'bg-danger',
      },
      warning: {
        icon: 'bi-exclamation-triangle-fill',
        title: title || 'Warning',
        class: 'bg-warning',
      },
      info: {
        icon: 'bi-info-circle-fill',
        title: title || 'Info',
        class: 'bg-info',
      },
    };

    const settings = config[type] || config.info;

    // Reset classes
    toastEl.className = 'toast';
    if (toastIcon) toastIcon.className = `bi ${settings.icon} me-2`;

    // Add type-specific class
    if (type === 'success' || type === 'error' || type === 'warning') {
      toastEl.classList.add(settings.class, 'text-white');
    }

    // Set content
    if (toastTitle) toastTitle.textContent = settings.title;
    if (toastMessage) toastMessage.innerHTML = message;

    // Show toast
    const toast = new bootstrap.Toast(toastEl, {
      autohide: true,
      delay: 4000,
    });
    toast.show();
  },

  /**
   * Show loading bar
   */
  showLoading() {
    this._loadingShowTime = Date.now();
    document.getElementById('loadingBar').classList.remove('d-none');
  },

  /**
   * Hide loading bar (with minimum 300ms display to prevent flicker)
   */
  hideLoading() {
    const elapsed = Date.now() - (this._loadingShowTime || 0);
    const minTime = 300;
    if (elapsed < minTime) {
      setTimeout(() => {
        document.getElementById('loadingBar').classList.add('d-none');
      }, minTime - elapsed);
    } else {
      document.getElementById('loadingBar').classList.add('d-none');
    }
  },

  /**
   * Format date to readable string
   * @param {string} dateString - ISO date string
   * @returns {string} Formatted date
   */
  formatDate(dateString) {
    if (!dateString) return '-';
    const date = this.safeDate ? this.safeDate(dateString) : new Date(dateString);
    if (!date || isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  },

  /**
   * Format date to relative time (e.g., "2 hours ago", "3 days ago")
   * @param {string} dateString - ISO date string
   * @returns {string} Relative time string
   */
  formatRelativeTime(dateString) {
    if (!dateString) return '-';

    const date = this.safeDate ? this.safeDate(dateString) : new Date(dateString);
    if (!date || isNaN(date.getTime())) return '-';
    const now = new Date();
    const diffInSeconds = Math.floor((Number(now) - Number(date)) / 1000);

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
      Draft: 'secondary',
      Pending: 'warning',
      Approved: 'success',
      Published: 'primary',
      Active: 'success',
      Archived: 'dark',
      Rejected: 'danger',
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
    return div.innerHTML.replace(/"/g, '&quot;');
  },

  toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
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
   * @param {Object} [options] - Dialog options
   * @param {string} [options.title] - Dialog title
   * @param {string} [options.message] - Dialog message
   * @param {string} [options.confirmText] - Text for confirm button
   * @param {boolean} [options.danger] - Whether to use danger styling
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
      dlg.addEventListener(
        'shown.bs.modal',
        () => {
          dlg.style.zIndex = '10100';
          const backdrops = document.querySelectorAll('.modal-backdrop');
          if (backdrops.length > 0) {
            backdrops[backdrops.length - 1].style.zIndex = '10099';
          }
        },
        { once: true }
      );
      dlg.addEventListener(
        'hidden.bs.modal',
        () => {
          dlg.style.zIndex = '';
        },
        { once: true }
      );

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
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
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
    return [...new Set(array.map((item) => item[key]).filter(Boolean))].sort();
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
        ...data.map((row) =>
          headers
            .map((header) => {
              const value = row[header] || '';
              // Escape commas and quotes
              return `"${String(value).replace(/"/g, '""')}"`;
            })
            .join(',')
        ),
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
    if (!tbody) return;
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
    if (!tbody) return;
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
  /**
   * Fetch distinct years from the award_years table and populate a <select> dropdown.
   * Caches the result so multiple modules share one DB call.
   * @param {string} selectId - ID of the <select> element to populate
   * @param {Object} [options]
   * @param {string} [options.placeholder='All Years'] - text for the empty-value option
   * @param {boolean} [options.selectCurrent=false] - auto-select the current year
   */
  async populateYearFilterFromDB(selectId, options = {}) {
    const { placeholder = 'All Years', selectCurrent = false } = options;
    const select = document.getElementById(selectId);
    if (!select) return;

    try {
      // Cache across all callers
      if (!this._cachedDbYears) {
        const { data } = await apiClient.select('awards', {
          select: 'year',
          pageSize: 1000,
        });
        const years = [...new Set((data || []).map((a) => a.year).filter(Boolean))].sort((a, b) => b - a);
        // Only cache non-empty results; don't overwrite existing options with nothing
        if (years.length === 0) return;
        this._cachedDbYears = years;
      }

      const current = select.value;
      select.innerHTML =
        `<option value="">${this.escapeHtml(placeholder)}</option>` +
        this._cachedDbYears.map((y) => `<option value="${y}">${y}</option>`).join('');

      if (current) {
        select.value = current;
      } else if (selectCurrent) {
        const thisYear = new Date().getFullYear();
        if (this._cachedDbYears.includes(thisYear)) select.value = thisYear;
      }
    } catch (e) {
      console.warn('Could not load years from DB:', e.message);
    }
  },

  populateFilter(data, key, selectId, placeholder = 'All') {
    const select = document.getElementById(selectId);
    if (!select) return;
    const uniqueValues = this.getUniqueValues(data, key);

    select.innerHTML = `<option value="">${placeholder}</option>`;
    uniqueValues.forEach((value) => {
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
   * @param {Function} [options._onAdd] - Called when the add shortcut is triggered
   */
  initTableKeyboardNav({ tableBodyId, searchBoxId, onEnter, _onAdd: /** @type {Function} */ _onAdd }) {
    let selectedIdx = -1;

    const getRows = () => document.getElementById(tableBodyId)?.querySelectorAll('tr') || [];

    const highlightRow = (idx) => {
      const rows = getRows();
      rows.forEach((r) => r.classList.remove('table-active'));
      if (idx >= 0 && idx < rows.length) {
        rows[idx].classList.add('table-active');
        rows[idx].scrollIntoView({ block: 'nearest' });
      }
    };

    document.addEventListener('keydown', (e) => {
      // Skip if typing in an input/textarea/select
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') {
          e.target.blur();
          selectedIdx = -1;
          highlightRow(-1);
        }
        return;
      }
      // Skip if modal is open
      if (document.querySelector('.modal.show')) return;
      // Check if this table's tab is active
      const tbody = document.getElementById(tableBodyId);
      if (!tbody || (tbody.closest('.tab-pane') && !tbody.closest('.tab-pane.active'))) return;

      const rows = getRows();
      switch (e.key) {
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
      } catch (e) {
        console.warn('Failed to auto-save form draft to localStorage:', e.message);
      }
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
    try {
      localStorage.removeItem('draft_' + formKey);
    } catch (e) {
      console.warn('Failed to clear form draft from localStorage:', e.message);
    }
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
    } catch (e) {
      console.warn('Failed to parse form draft from localStorage:', e.message);
    }
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
      if (restoreBtn)
        restoreBtn.addEventListener('click', () => {
          onRestore(draft.data);
          banner.remove();
          utils.clearFormDraft(formKey);
        });
      if (discardBtn)
        discardBtn.addEventListener('click', () => {
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
      const filtered = trash.filter((r) => r._deletedAt > cutoff).slice(-50);
      localStorage.setItem('trash_' + table, JSON.stringify(filtered));
    } catch (e) {
      console.warn('Failed to save soft-delete trash to localStorage:', e.message);
    }
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
      return trash.filter((r) => r._deletedAt > cutoff);
    } catch (e) {
      return [];
    }
  },

  /**
   * Restore a trashed record back into the database
   * @param {string} table - Table name
   * @param {object} record - The trashed record
   * @param {object} _supabaseClient - Supabase client instance
   * @returns {Promise<boolean>} Whether the restore succeeded
   */
  async restoreFromTrash(table, record, _supabaseClient) {
    try {
      // Remove internal fields
      const { _deletedAt, _assignmentCounts, _winnerName, _runnerUpName, _actualRegion, _countyName, ...data } = record;
      await apiClient.insert(table, data);

      // Remove from trash
      const trash = this.getTrash(table);
      const updated = trash.filter((r) => r.id !== record.id);
      localStorage.setItem('trash_' + table, JSON.stringify(updated));
      return true;
    } catch (e) {
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
      const updated = trash.filter((r) => r.id !== recordId);
      localStorage.setItem('trash_' + table, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to clear trash item from localStorage:', e.message);
    }
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
      switch (table) {
        case 'awards':
          awardsModule?.loadAwards();
          break;
        case 'invoices':
          paymentsModule?.loadAllData();
          break;
        case 'winners':
          winnersModule?.loadWinners();
          break;
        case 'events':
          eventsModule?.loadEvents();
          break;
        case 'organisations':
          orgsModule?.loadOrganisations();
          break;
      }
    } else {
      this.showToast('Restore failed', 'error');
    }
  },

  /* ==================================================== */
  /* PENDING QUEUE REPLAY (offline fallback sync)         */
  /* ==================================================== */

  /**
   * Replay pending localStorage items back to Supabase on app load.
   * Call this after authentication is confirmed and STATE.client is available.
   */
  async replayPendingQueues() {
    if (!STATE?.client) return;
    const queues = [
      { key: 'bta_communications_pending', table: 'communications' },
      { key: 'bta_deals_pending', table: 'deals' },
      { key: 'bta_meeting_notes_pending', table: 'meeting_notes' },
      { key: 'bta_email_templates_pending', table: 'email_templates' },
      { key: 'bta_email_lists_pending', table: 'email_lists' },
      { key: 'bta_sponsors_pending', table: 'sponsors' },
      { key: 'bta_media_videos_pending', table: 'media_videos' },
      { key: 'bta_banners_pending', table: 'banners' },
    ];

    for (const { key, table } of queues) {
      try {
        const stored = JSON.parse(localStorage.getItem(key) || '[]');
        if (stored.length === 0) continue;

        let synced = 0;
        const remaining = [];
        for (let i = 0; i < stored.length; i++) {
          try {
            await apiClient.insert(table, [stored[i]]);
            synced++;
          } catch (insertErr) {
            // Don't retry items that failed due to permission or server errors
            if (
              insertErr.message &&
              (insertErr.message.includes('Forbidden') ||
                insertErr.message.includes('cannot') ||
                insertErr.message.includes('permission'))
            ) {
              console.warn(`Skipping pending ${table} items: insufficient permissions`);
              remaining.push(...stored.slice(i));
              break;
            }
            // Drop items that cause server errors (500) — they are likely stale/corrupt
            if (insertErr.message && insertErr.message.includes('Internal Server Error')) {
              console.warn(`Dropping stale pending ${table} item (server error)`);
              continue;
            }
            remaining.push(stored[i]);
          }
        }
        if (synced > 0) {
          console.warn(`Synced ${synced} pending ${table} items to database`);
        }
        if (remaining.length > 0) {
          localStorage.setItem(key, JSON.stringify(remaining));
        } else {
          localStorage.removeItem(key);
        }
      } catch (e) {
        console.warn(`Failed to replay pending queue ${key}:`, e);
      }
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
      el.innerHTML =
        '<i class="bi bi-check-circle text-success me-1"></i><small class="text-muted">' + age + 'm ago</small>';
    } else if (age < 15) {
      el.innerHTML =
        '<i class="bi bi-exclamation-circle text-warning me-1"></i><small class="text-warning">' +
        age +
        'm ago</small>';
    } else {
      el.innerHTML =
        '<i class="bi bi-exclamation-triangle text-danger me-1"></i><small class="text-danger">' +
        age +
        'm ago - <a href="#" data-action="utils.noop" data-prevent-default="true" class="text-danger">stale</a></small>';
    }
  },

  startFreshnessTimer() {
    if (this._freshnessTimerId) clearInterval(this._freshnessTimerId);
    this._freshnessTimerId = setInterval(() => {
      Object.keys(this._dataTimestamps).forEach((key) => this._updateFreshnessIndicator(key));
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
      recent = recent.filter((r) => !(r.type === type && r.id === id));
      // Add to front
      recent.unshift({ type, id, name, timestamp: Date.now() });
      // Cap at 15
      recent = recent.slice(0, 15);
      localStorage.setItem('recentlyViewed', JSON.stringify(recent));
      this.renderRecentlyViewed();
    } catch (e) {
      console.warn('Failed to save recently viewed to localStorage:', e.message);
    }
  },

  /**
   * Get recently viewed records from localStorage
   * @returns {Array} Array of recently viewed record objects
   */
  getRecentlyViewed() {
    try {
      return JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
    } catch (e) {
      return [];
    }
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
    const icons = {
      award: 'bi-trophy',
      organisation: 'bi-building',
      entry: 'bi-file-earmark-text',
      winner: 'bi-award',
      invoice: 'bi-receipt',
      event: 'bi-calendar-event',
    };
    el.innerHTML = recent
      .map((r) => {
        const icon = icons[r.type] || 'bi-clock-history';
        const ago = this._timeAgo(r.timestamp);
        return `<li><a class="dropdown-item small" href="#" data-action="utils.openRecentItem" data-prevent-default="true" data-args='${JSON.stringify([r.type, r.id, utils.escapeHtml(r.name)]).replace(/'/g, '&#39;')}'>
        <i class="bi ${icon} me-2 text-muted"></i>${utils.escapeHtml(r.name)}
        <span class="text-muted float-end" style="font-size:0.7rem">${ago}</span>
      </a></li>`;
      })
      .join('');
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
    switch (type) {
      case 'organisation':
        orgsModule.openCompanyProfile(id, name);
        break;
      case 'award':
        document.getElementById('awards-tab')?.click();
        break;
      case 'invoice':
        paymentsModule.viewInvoice(id);
        break;
      case 'entry':
        document.getElementById('entries-tab')?.click();
        break;
      case 'event':
        document.getElementById('events-tab')?.click();
        break;
      case 'winner':
        document.getElementById('winners-tab')?.click();
        break;
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
      div.addEventListener('click', (e) => {
        if (e.target === div) utils.closeCommandPalette();
      });

      // Input handler
      document.getElementById('commandPaletteInput').addEventListener('input', (e) => {
        utils._searchCommandPalette(e.target.value.trim());
      });

      // Keyboard nav
      document.getElementById('commandPaletteInput').addEventListener('keydown', (e) => {
        const items = document.querySelectorAll('#commandPaletteResults .cp-item');
        const active = document.querySelector('#commandPaletteResults .cp-item.active');
        let idx = Array.from(items).indexOf(active);
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          idx = Math.min(idx + 1, items.length - 1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          idx = Math.max(idx - 1, 0);
        } else if (e.key === 'Enter' && active) {
          e.preventDefault();
          active.click();
          return;
        } else if (e.key === 'Escape') {
          utils.closeCommandPalette();
          return;
        } else return;
        items.forEach((i) => i.classList.remove('active'));
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
      { label: 'Settings', icon: 'bi-gear', tab: 'settings' },
    ];
    const resultsEl = document.getElementById('commandPaletteResults');
    resultsEl.innerHTML = tabs
      .map(
        (t) => `
      <div class="cp-item" data-action="utils._commandPaletteAction" data-args='["tab", "${t.tab}"]'>
        <span class="cp-icon"><i class="bi ${t.icon}"></i></span>
        <span class="cp-label">Go to ${t.label}</span>
        <span class="cp-hint">Tab</span>
      </div>`
      )
      .join('');
  },

  _searchCommandPalette(query) {
    if (!query) {
      this._showCommandPaletteDefaults();
      return;
    }
    const q = query.toLowerCase();
    const results = [];

    // Search tabs
    const tabMap = {
      dashboard: 'bi-speedometer2',
      awards: 'bi-trophy',
      organisations: 'bi-building',
      winners: 'bi-star',
      entries: 'bi-file-earmark-text',
      events: 'bi-calendar-event',
      payments: 'bi-credit-card',
      crm: 'bi-people',
      settings: 'bi-gear',
    };
    Object.keys(tabMap).forEach((tab) => {
      if (tab.includes(q))
        results.push({
          type: 'tab',
          label: `Go to ${tab.charAt(0).toUpperCase() + tab.slice(1)}`,
          icon: tabMap[tab],
          id: tab,
        });
    });

    // Search awards
    if (window.STATE?.allAwards) {
      STATE.allAwards
        .filter((a) => (a.award_name || '').toLowerCase().includes(q))
        .slice(0, 5)
        .forEach((a) => {
          results.push({ type: 'award', label: a.award_name, icon: 'bi-trophy', id: a.id, hint: 'Award' });
        });
    }

    // Search organisations
    if (window.STATE?.allOrganisations) {
      STATE.allOrganisations
        .filter((o) => (o.company_name || '').toLowerCase().includes(q))
        .slice(0, 5)
        .forEach((o) => {
          results.push({ type: 'org', label: o.company_name, icon: 'bi-building', id: o.id, hint: 'Organisation' });
        });
    }

    // Search winners
    if (window.STATE?.allWinners) {
      STATE.allWinners
        .filter((w) => (w.winner_name || '').toLowerCase().includes(q))
        .slice(0, 5)
        .forEach((w) => {
          results.push({ type: 'winner', label: w.winner_name, icon: 'bi-star', id: w.id, hint: 'Winner' });
        });
    }

    // Search events
    if (window.STATE?.allEvents) {
      STATE.allEvents
        .filter((e) => (e.event_name || '').toLowerCase().includes(q))
        .slice(0, 5)
        .forEach((e) => {
          results.push({ type: 'event', label: e.event_name, icon: 'bi-calendar-event', id: e.id, hint: 'Event' });
        });
    }

    const resultsEl = document.getElementById('commandPaletteResults');
    if (results.length === 0) {
      resultsEl.innerHTML = '<div class="p-3 text-center text-muted">No results found</div>';
      return;
    }
    resultsEl.innerHTML = results
      .slice(0, 20)
      .map(
        (r, i) => `
      <div class="cp-item ${i === 0 ? 'active' : ''}" data-action="utils._commandPaletteAction" data-args='["${r.type}", "${r.id}"]'>
        <span class="cp-icon"><i class="bi ${r.icon}"></i></span>
        <span class="cp-label">${utils.escapeHtml(r.label)}</span>
        ${r.hint ? `<span class="cp-hint">${r.hint}</span>` : ''}
      </div>`
      )
      .join('');
  },

  _commandPaletteAction(type, id) {
    this.closeCommandPalette();
    if (type === 'tab') {
      const tabBtn = document.querySelector(`[data-bs-target="#${id}"]`) || document.querySelector(`[href="#${id}"]`);
      if (tabBtn) tabBtn.click();
    } else if (type === 'org' && window.orgsModule) {
      const tabBtn = document.querySelector('[data-bs-target="#organisations"]');
      if (tabBtn) tabBtn.click();
      setTimeout(() => {
        if (orgsModule.openCompanyProfile) orgsModule.openCompanyProfile(id, '');
      }, 300);
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
   * @param {string} message - Toast message
   * @param {string} type - Toast type
   * @param {Array<{label: string, class?: string, action: string, id?: string}>} actions - Action buttons using data-action delegation
   */
  showToastWithAction(message, type, actions) {
    const actionHtml = actions
      ? actions
          .map(
            (a) =>
              `<button class="btn btn-sm btn-${this.escapeHtml(a.class || 'light')} ms-2" data-action="${this.escapeHtml(a.action)}"${a.id ? ` data-id="${this.escapeHtml(a.id)}"` : ''}>${this.escapeHtml(a.label)}</button>`
          )
          .join('')
      : '';
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
        await new Promise((r) => setTimeout(r, delay));
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
      setTimeout(() => {
        bar.style.display = 'none';
      }, 1500);
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

    window.addEventListener(
      'scroll',
      () => {
        btn.classList.toggle('show', window.scrollY > 300);
      },
      { passive: true }
    );
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
    inputs.forEach((inp, i) => {
      snapshot[i] = inp.value;
    });
    modal._formSnapshot = snapshot;
    modal._formDirty = false;

    const onChange = () => {
      const current = {};
      inputs.forEach((inp, i) => {
        current[i] = inp.value;
      });
      modal._formDirty = JSON.stringify(current) !== JSON.stringify(snapshot);
    };
    inputs.forEach((inp) => inp.addEventListener('input', onChange));

    // Warn on close
    const _modalInstance = bootstrap.Modal.getInstance(modal) || new bootstrap.Modal(modal);
    modal.addEventListener('hide.bs.modal', (e) => {
      if (modal._formDirty && !modal._formSaved) {
        e.preventDefault();
        utils
          .confirmDialog({
            title: 'Unsaved Changes',
            message: 'You have unsaved changes. Discard them?',
            confirmText: 'Discard',
            danger: true,
          })
          .then((confirmed) => {
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
    if (modal) {
      modal._formSaved = true;
      modal._formDirty = false;
    }
  },

  /* ==================================================== */
  /* PER-RECORD COMMENTS/NOTES (MEDIUM-12)                */
  /* ==================================================== */

  /**
   * Per-record notes/comments system (MEDIUM-12)
   */
  async loadRecordNotes(tableName, recordId) {
    try {
      const result = await apiClient.select('record_notes', {
        filters: { table_name: { eq: tableName }, record_id: { eq: recordId } },
        sort: { column: 'created_at', ascending: false },
      });
      return result.data || [];
    } catch (e) {
      // Table may not exist - return empty gracefully
      console.warn('record_notes table not available:', e.message);
      return [];
    }
  },

  async addRecordNote(tableName, recordId, noteText) {
    try {
      await apiClient.insert('record_notes', {
        table_name: tableName,
        record_id: recordId,
        note: noteText,
        created_by: STATE.currentUser?.email || 'unknown',
        created_at: new Date().toISOString(),
      });
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

    this.loadRecordNotes(tableName, recordId).then((notes) => {
      container.innerHTML = `
        <div class="mb-2">
          <div class="input-group input-group-sm">
            <input type="text" class="form-control" id="noteInput_${containerId}" placeholder="Add a note...">
            <button class="btn btn-outline-primary" data-action="utils._submitNote" data-args='["${containerId}", "${tableName}", "${recordId}"]'><i class="bi bi-plus"></i></button>
          </div>
        </div>
        <div class="notes-list" style="max-height:200px;overflow-y:auto;">
          ${
            notes.length === 0
              ? '<p class="text-muted small">No notes yet</p>'
              : notes
                  .map(
                    (n) => `
              <div class="small border-bottom py-1">
                <div>${utils.escapeHtml(n.note)}</div>
                <div class="text-muted" style="font-size:0.7rem;">${n.created_by} &middot; ${utils.formatRelativeTime(n.created_at)}</div>
              </div>`
                  )
                  .join('')
          }
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
      last_modified_by: STATE.currentUser?.email || 'unknown',
      last_modified_at: new Date().toISOString(),
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
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch (e) {
      /* private browsing */
    }

    let html = '<div class="p-3"><h6>Show/Hide Columns</h6>';
    columns.forEach((col, i) => {
      const visible = saved[col.key] !== false;
      html += `<div class="form-check"><input class="form-check-input" type="checkbox" id="colVis_${i}" ${visible ? 'checked' : ''} data-on-change="utils._handleColVisChange" data-table-id="${tableId}" data-col-key="${col.key}"><label class="form-check-label" for="colVis_${i}">${col.label}</label></div>`;
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
    dialog.innerHTML =
      html +
      '<div class="p-2 border-top"><button class="btn btn-sm btn-secondary w-100" data-action="utils.closeColVisDialog">Close</button></div>';
    dialog.style.display = 'block';
  },

  _handleColVisChange(_value, event) {
    const el = event.target;
    const tableId = el.getAttribute('data-table-id');
    const colKey = el.getAttribute('data-col-key');
    this._toggleColumn(tableId, colKey, el.checked);
  },

  _toggleColumn(tableId, colKey, visible) {
    const storageKey = `colVis_${tableId}`;
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch (e) {
      /* private browsing */
    }
    saved[colKey] = visible;
    try {
      localStorage.setItem(storageKey, JSON.stringify(saved));
    } catch (e) {
      /* private browsing */
    }

    // Toggle column visibility via CSS class
    const table = document.getElementById(tableId) || document.querySelector(`#${tableId}`);
    if (!table) return;
    const colIndex = Array.from(table.querySelectorAll('thead th')).findIndex((th) => th.dataset.colKey === colKey);
    if (colIndex === -1) return;
    table.querySelectorAll(`tr`).forEach((row) => {
      const cells = row.querySelectorAll('th, td');
      if (cells[colIndex]) cells[colIndex].style.display = visible ? '' : 'none';
    });
  },

  applyColumnVisibility(tableId) {
    const storageKey = `colVis_${tableId}`;
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch (e) {
      /* private browsing */
    }
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
    el.innerHTML =
      shown < total
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
      const cells = Array.from(
        { length: colspan },
        () =>
          `<td><div class="skeleton-line" style="height:14px;background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);background-size:200% 100%;animation:skeleton-shimmer 1.5s infinite;border-radius:4px;width:${60 + Math.random() * 40}%"></div></td>`
      ).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    tbody.innerHTML = skeletonRows;
    // Inject shimmer animation if not already present
    if (!document.getElementById('skeletonStyle')) {
      const style = document.createElement('style');
      style.id = 'skeletonStyle';
      style.textContent =
        '@keyframes skeleton-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}';
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
      actionAction = '',
      actionId = '',
      isFiltered = false,
    } = options;
    const tbody = document.getElementById(tableBodyId);
    if (!tbody) return;
    const filterHint = isFiltered
      ? '<p class="text-muted small mb-2">Try adjusting your filters or search terms</p>'
      : '';
    const actionBtn =
      actionLabel && actionAction
        ? `<button class="btn btn-sm btn-primary mt-2" data-action="${this.escapeHtml(actionAction)}"${actionId ? ` data-id="${this.escapeHtml(actionId)}"` : ''}><i class="bi bi-plus-circle me-1"></i>${this.escapeHtml(actionLabel)}</button>`
        : '';
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
      .map((item) => {
        const maxScore = Math.max(...keys.map((key) => this.fuzzyMatch(String(item[key] || ''), query)));
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
      const headerLabels = headers.map((h) => h.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));

      let html =
        '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table>';
      html +=
        '<tr>' +
        headerLabels
          .map(
            (h) => `<th style="font-weight:bold;background:#4472C4;color:white;padding:8px">${this.escapeHtml(h)}</th>`
          )
          .join('') +
        '</tr>';
      data.forEach((row) => {
        html +=
          '<tr>' +
          headers
            .map((header) => {
              let value = row[header] || '';
              if (formatDates && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
                value = this.formatDate(value);
              }
              return `<td style="padding:4px;border:1px solid #ddd">${this.escapeHtml(String(value))}</td>`;
            })
            .join('') +
          '</tr>';
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
      const headerLabels = headers.map((h) => h.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));

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
          <thead><tr>${headerLabels.map((h) => `<th>${this.escapeHtml(h)}</th>`).join('')}</tr></thead>
          <tbody>${data
            .map(
              (row) =>
                '<tr>' +
                headers
                  .map((header) => {
                    let value = row[header] || '';
                    if (formatDates && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
                      value = this.formatDate(value);
                    }
                    return `<td>${this.escapeHtml(String(value))}</td>`;
                  })
                  .join('') +
                '</tr>'
            )
            .join('')}</tbody>
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
    document.getElementById('loadingBar').classList.remove('d-none');
  },

  /**
   * Hide loading bar with minimum 300ms display to prevent flicker
   */
  async hideLoadingWithMinTime() {
    const elapsed = Date.now() - this._loadingShowTime;
    const minTime = 300;
    if (elapsed < minTime) {
      await new Promise((r) => setTimeout(r, minTime - elapsed));
    }
    document.getElementById('loadingBar').classList.add('d-none');
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
    headers.forEach((th) => {
      const field = th.dataset.sortField;
      // Remove old indicators
      th.querySelectorAll('.sort-indicator').forEach((el) => el.remove());
      // Add indicator
      const indicator = document.createElement('span');
      indicator.className = 'sort-indicator ms-1';
      if (field === currentField) {
        indicator.innerHTML =
          currentDir === 'asc' ? '<i class="bi bi-caret-up-fill"></i>' : '<i class="bi bi-caret-down-fill"></i>';
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
        const newDir = field === currentField && currentDir === 'asc' ? 'desc' : 'asc';
        onSort(field, newDir);
      });
    });
  },

  /**
   * Persist sort state to localStorage
   */
  saveSortState(moduleKey, field, direction) {
    try {
      localStorage.setItem(`sort_${moduleKey}`, JSON.stringify({ field, direction }));
    } catch (e) {
      /* non-critical */
    }
  },

  /**
   * Load persisted sort state
   */
  loadSortState(moduleKey) {
    try {
      return JSON.parse(localStorage.getItem(`sort_${moduleKey}`));
    } catch (e) {
      return null;
    }
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
    try {
      return JSON.parse(localStorage.getItem(`savedViews_${moduleKey}`) || '[]');
    } catch (e) {
      return [];
    }
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
    el.innerHTML =
      '<option value="">Load saved view...</option>' +
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
  canUndo(moduleKey) {
    return (this._undoStacks[moduleKey]?.length || 0) > 0;
  },
  canRedo(moduleKey) {
    return (this._redoStacks[moduleKey]?.length || 0) > 0;
  },

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
      return {
        message: 'Network connection lost. Please check your internet and try again.',
        type: 'error',
        isNetwork: true,
        canRetry: true,
      };
    }
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return {
        message: 'Request timed out. The server may be busy — please try again.',
        type: 'warning',
        isNetwork: true,
        canRetry: true,
      };
    }
    if (msg.includes('cors') || msg.includes('cross-origin')) {
      return {
        message: 'Connection blocked by security policy. Please contact support.',
        type: 'error',
        isNetwork: true,
        canRetry: false,
      };
    }
    if (msg.includes('401') || msg.includes('unauthorized')) {
      // Auto-logout on session expiry (guard against multiple rapid 401s)
      if (typeof authModule !== 'undefined' && STATE.currentUser && !STATE._loggingOut) {
        STATE._loggingOut = true;
        setTimeout(() => authModule.handleLogout(true), 500);
      }
      return { message: 'Session expired. Logging you out...', type: 'warning', isNetwork: false, canRetry: false };
    }
    if (msg.includes('403') || msg.includes('forbidden')) {
      return {
        message: 'You do not have permission for this action.',
        type: 'error',
        isNetwork: false,
        canRetry: false,
      };
    }
    if (msg.includes('404') || msg.includes('not found')) {
      return { message: 'The requested resource was not found.', type: 'warning', isNetwork: false, canRetry: false };
    }
    return {
      message: error.message || 'An unexpected error occurred.',
      type: 'error',
      isNetwork: false,
      canRetry: false,
    };
  },

  /**
   * Show error toast with optional retry button
   * @param {Error} error - The error
   * @param {string} context - What was being done (e.g., "loading awards")
   * @param {Function} retryFn - Optional retry function
   */
  /** @type {Function|null} Stored retry callback for the most recent error toast */
  _lastRetryFn: null,

  /** Execute the stored retry function (called via data-action delegation) */
  executeRetry() {
    if (this._lastRetryFn) this._lastRetryFn();
  },

  showErrorWithRetry(error, context, retryFn) {
    const classified = this.classifyError(error);
    let retryHtml = '';
    if (classified.canRetry && retryFn) {
      this._lastRetryFn = retryFn;
      retryHtml = ' <button class="btn btn-sm btn-light ms-2" data-action="utils.executeRetry">Retry</button>';
    }
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
   * @returns {Promise<Object>} { succeeded: [], failed: [] }
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
      this.showToast(
        `${label}: ${succeeded.length} succeeded, ${failed.length} failed. Check console for details.`,
        'warning'
      );
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
    overlay.style.cssText =
      'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:white;border-radius:12px;padding:24px;max-width:600px;width:90%;max-height:80vh;overflow-y:auto;">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="mb-0"><i class="bi bi-keyboard me-2"></i>Keyboard Shortcuts</h5>
          <button class="btn btn-sm btn-outline-secondary" data-action="utils.closeShortcutHelp"><i class="bi bi-x-lg"></i></button>
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
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
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
    input.addEventListener('input', /** @type {EventListener} */ (debouncedHandler));
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
    cancelBtns.forEach((btn) => (btn.disabled = true));
    try {
      return await asyncFn();
    } finally {
      if (closeBtn) closeBtn.disabled = false;
      cancelBtns.forEach((btn) => (btn.disabled = false));
    }
  },

  /**
   * Create a guard that prevents concurrent execution of an async function.
   * Returns a wrapped function that no-ops if the previous call is still running.
   */
  asyncGuard(fn) {
    let running = false;
    return async function (...args) {
      if (running) return;
      running = true;
      try {
        return await fn.apply(this, args);
      } finally {
        running = false;
      }
    };
  },

  /**
   * Safely parse a date string, returning null for invalid/missing values.
   */
  safeDate(val) {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
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
    const inputs = form.querySelectorAll(
      'input[required], select[required], textarea[required], input[pattern], input[type="email"], input[type="url"]'
    );
    inputs.forEach((input) => {
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
  },

  /** No-op handler for elements that only need event modifiers (e.g. data-prevent-default) */
  noop() {},

  /** Close the column visibility dialog */
  closeColVisDialog() {
    const el = document.getElementById('colVisDialog');
    if (el) el.style.display = 'none';
  },

  /** Close the keyboard shortcut help overlay */
  closeShortcutHelp() {
    const el = document.getElementById('shortcutHelpOverlay');
    if (el) el.remove();
  },
};

// ============================================
// PAGINATION UI RENDERER
// Reusable Bootstrap pagination controls for server-side paginated tables
// ============================================

/**
 * Render pagination controls into a container element.
 * @param {string} containerId - DOM element ID for the pagination container
 * @param {Object} pagination - { page, totalPages, count, pageSize }
 * @param {string} goToPageFn - Global function path to call, e.g. "awardsModule._goToPage"
 */
utils.renderServerPagination = function (containerId, pagination, goToPageFn) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const { page, totalPages, count, pageSize } = pagination;
  if (!totalPages || totalPages <= 1) {
    el.innerHTML = count ? `<div class="text-center text-muted small mt-2">Showing all ${count} records</div>` : '';
    return;
  }

  let html =
    '<nav aria-label="Table pagination"><ul class="pagination pagination-sm justify-content-center mt-3 mb-1">';

  // Previous button
  html += `<li class="page-item ${page <= 1 ? 'disabled' : ''}">
    <a class="page-link" href="#" data-action="${goToPageFn}" data-id="${page - 1}" data-prevent-default="true" aria-label="Previous">&laquo;</a></li>`;

  // Page numbers with ellipsis
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
      html += `<li class="page-item ${i === page ? 'active' : ''}">
        <a class="page-link" href="#" data-action="${goToPageFn}" data-id="${i}" data-prevent-default="true">${i}</a></li>`;
    } else if (i === page - 3 || i === page + 3) {
      html += '<li class="page-item disabled"><span class="page-link">&hellip;</span></li>';
    }
  }

  // Next button
  html += `<li class="page-item ${page >= totalPages ? 'disabled' : ''}">
    <a class="page-link" href="#" data-action="${goToPageFn}" data-id="${page + 1}" data-prevent-default="true" aria-label="Next">&raquo;</a></li>`;

  html += '</ul></nav>';

  // Summary text
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);
  html += `<div class="text-center text-muted small">Showing ${from}\u2013${to} of ${count} records (page ${page}/${totalPages})</div>`;

  el.innerHTML = html;
};

// ============================================
// SERVER-SIDE PAGINATION & FILTERING HELPER
// Replaces "load everything then filter in JS" pattern
// ============================================

/**
 * Reusable server-side query builder for Supabase.
 * Builds queries with server-side filtering, sorting, and pagination
 * so only the required page of data is transferred.
 *
 * Usage:
 *   const result = await utils.serverQuery({
 *     table: 'entries',
 *     select: '*, organisations(company_name)',
 *     filters: { status: 'submitted', year: 2026 },
 *     search: { term: 'acme', columns: ['company_name', 'entry_title'] },
 *     sort: { column: 'submission_date', ascending: false },
 *     page: 1,
 *     pageSize: 50
 *   });
 *   // Returns: { data: [...], count: 123, page: 1, pageSize: 50, totalPages: 3 }
 */
const serverQuery = {
  /**
   * Execute a paginated, filtered, sorted query against Supabase.
   * @param {Object} options
   * @param {string} options.table - Supabase table name
   * @param {string} [options.select='*'] - Select clause
   * @param {Object} [options.filters={}] - Key-value equality filters (null values skipped)
   * @param {Object} [options.search] - { term: string, columns: string[] } for ilike search
   * @param {Object} [options.sort] - { column: string, ascending: boolean }
   * @param {number} [options.page=1] - Page number (1-based)
   * @param {number} [options.pageSize=50] - Items per page
   * @param {Array}  [options.customFilters] - Array of { method, args } for advanced filters
   * @returns {Promise<{data: Array, count: number, page: number, pageSize: number, totalPages: number}>}
   */
  async execute(options) {
    const {
      table,
      select = '*',
      filters = {},
      search = null,
      sort = null,
      page = 1,
      pageSize = 50,
      customFilters = [],
    } = options;

    // Convert customFilters to data-proxy filter format
    const mergedFilters = { ...filters };
    for (const cf of customFilters) {
      if (cf.method && cf.args) {
        const [column, value] = cf.args;
        // Map Supabase method names to data-proxy operator format
        mergedFilters[`${column}@${cf.method}`] = value;
      }
    }

    return apiClient.select(table, {
      select,
      filters: mergedFilters,
      search,
      sort,
      page,
      pageSize,
    });
  },

  /**
   * Load ALL records using server-side pagination (for modules that need full datasets).
   * Routes through apiClient for RBAC and tenant isolation.
   * @param {Object} options - Same as execute but without page/pageSize
   * @param {number} [batchSize=1000] - Records per batch
   * @returns {Promise<Array>} All matching records
   */
  async loadAll(options, batchSize = 1000) {
    const { table, select = '*', filters = {}, sort = null, customFilters = [] } = options;

    // Convert customFilters to data-proxy filter format
    const mergedFilters = { ...filters };
    for (const cf of customFilters) {
      if (cf.method && cf.args) {
        const [column, value] = cf.args;
        mergedFilters[`${column}@${cf.method}`] = value;
      }
    }

    return apiClient.selectAll(table, {
      select,
      filters: mergedFilters,
      sort,
      batchSize,
    });
  },
};

// ============================================
// EVENT DELEGATION SYSTEM
// Replaces inline onclick= handlers with data-action attributes
// Usage: <button data-action="moduleName.methodName" data-id="123">Click</button>
// ============================================

/**
 * Centralized event delegation system.
 * Listens for clicks on elements with [data-action] attributes
 * and routes them to the appropriate module method.
 *
 * Supports:
 *   data-action="moduleName.methodName"  - calls moduleName.methodName(element, event)
 *   data-id="..."                        - passed as first arg if present
 *   data-args='{"key":"value"}'          - JSON-parsed and spread as args
 *   data-prevent-default="true"          - calls event.preventDefault()
 *   data-stop-propagation="true"         - calls event.stopPropagation()
 */
const actionRegistry = {
  _handlers: {},

  /**
   * Register a named action handler
   * @param {string} name - Action name (e.g. "awards.create")
   * @param {Function} handler - Handler function(element, event, ...args)
   */
  register(name, handler) {
    this._handlers[name] = handler;
  },

  /**
   * Resolve a dotted action name to a callable function.
   * Walks window globals for "moduleName.methodName" patterns.
   */
  _resolve(actionName) {
    // Check explicit registry first
    if (this._handlers[actionName]) return this._handlers[actionName];

    // Try dotted path on window (e.g. "awardsModule.openCreateModal")
    const parts = actionName.split('.');
    /** @type {any} */
    let obj = window;
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]];
      if (!obj) return null;
    }
    const method = obj[parts[parts.length - 1]];
    return typeof method === 'function' ? method.bind(obj) : null;
  },

  /**
   * Initialize the global click delegation listener.
   * Call once after DOM is ready.
   */
  init() {
    document.addEventListener('click', (event) => {
      if (!event.target || !event.target.closest) return;
      const el = event.target.closest('[data-action]');
      if (!el) return;

      const actionName = el.getAttribute('data-action');
      if (!actionName) return;

      // Always prevent default on anchor elements used as action buttons
      // (avoids CSP violations from javascript: hrefs and # navigation)
      if (el.tagName === 'A' || el.getAttribute('data-prevent-default') === 'true') {
        event.preventDefault();
      }
      if (el.getAttribute('data-stop-propagation') === 'true') {
        event.stopPropagation();
      }

      const handler = this._resolve(actionName);
      if (!handler) {
        console.warn(`[actionRegistry] No handler found for action: ${actionName}`);
        return;
      }

      // Build arguments
      const id = el.getAttribute('data-id');
      const argsJson = el.getAttribute('data-args');
      let extraArgs = [];
      if (argsJson) {
        try {
          const parsed = JSON.parse(argsJson);
          extraArgs = Array.isArray(parsed) ? parsed : [parsed];
        } catch (_e) {
          console.warn(`[actionRegistry] Invalid JSON in data-args for action "${actionName}":`, argsJson);
          extraArgs = [];
        }
      }

      if (id !== null && id !== undefined) {
        handler(id, ...extraArgs, event);
      } else if (extraArgs.length > 0) {
        handler(...extraArgs, event);
      } else {
        handler(event);
      }
    });

    // Also handle keyboard activation (Enter/Space) for non-button elements
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (!event.target || !event.target.closest) return;
      const el = event.target.closest('[data-action]');
      if (!el) return;
      if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'INPUT') return; // browser handles these
      event.preventDefault();
      el.click();
    });

    // Handle change events (select, checkbox, radio, file inputs)
    document.addEventListener('change', (event) => {
      if (!event.target || !event.target.closest) return;
      const el = event.target.closest('[data-on-change]');
      if (!el) return;
      const actionName = el.getAttribute('data-on-change');
      if (!actionName) return;
      const handler = this._resolve(actionName);
      if (!handler) return;
      const id = el.getAttribute('data-id');
      const argsJson = el.getAttribute('data-args');
      let extraArgs = [];
      if (argsJson) {
        try {
          const parsed = JSON.parse(argsJson);
          extraArgs = Array.isArray(parsed) ? parsed : [parsed];
        } catch (_e) {
          extraArgs = [];
        }
      }
      if (id) {
        handler(id, ...extraArgs, el.value, event);
      } else if (extraArgs.length > 0) {
        handler(...extraArgs, el.value, event);
      } else {
        handler(el.value, event);
      }
    });

    // Handle input events (text fields, ranges, etc.)
    document.addEventListener('input', (event) => {
      if (!event.target || !event.target.closest) return;
      const el = event.target.closest('[data-on-input]');
      if (!el) return;
      const actionName = el.getAttribute('data-on-input');
      if (!actionName) return;
      const handler = this._resolve(actionName);
      if (!handler) return;
      handler(el.value, event);
    });

    // Handle submit events (forms)
    document.addEventListener('submit', (event) => {
      if (!event.target || !event.target.closest) return;
      const form = event.target.closest('[data-on-submit]');
      if (!form) return;
      event.preventDefault();
      const actionName = form.getAttribute('data-on-submit');
      if (!actionName) return;
      const handler = this._resolve(actionName);
      if (!handler) return;
      handler(event);
    });

    // Handle dblclick events (inline edit, etc.)
    document.addEventListener('dblclick', (event) => {
      if (!event.target || !event.target.closest) return;
      const el = event.target.closest('[data-on-dblclick]');
      if (!el) return;
      const actionName = el.getAttribute('data-on-dblclick');
      if (!actionName) return;
      const handler = this._resolve(actionName);
      if (!handler) return;
      const id = el.getAttribute('data-id');
      const argsJson = el.getAttribute('data-args');
      let extraArgs = [];
      if (argsJson) {
        try {
          const parsed = JSON.parse(argsJson);
          extraArgs = Array.isArray(parsed) ? parsed : [parsed];
        } catch (_e) {
          extraArgs = [];
        }
      }
      if (id !== null && id !== undefined) {
        handler(id, ...extraArgs, el, event);
      } else if (extraArgs.length > 0) {
        handler(...extraArgs, el, event);
      } else {
        handler(el, event);
      }
    });

    // Handle Enter key on input fields (data-on-keyenter)
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      if (!event.target || !event.target.closest) return;
      const el = event.target.closest('[data-on-keyenter]');
      if (!el) return;
      event.preventDefault();
      const actionName = el.getAttribute('data-on-keyenter');
      if (!actionName) return;
      const handler = this._resolve(actionName);
      if (!handler) return;
      const id = el.getAttribute('data-id');
      const argsJson = el.getAttribute('data-args');
      let extraArgs = [];
      if (argsJson) {
        try {
          const parsed = JSON.parse(argsJson);
          extraArgs = Array.isArray(parsed) ? parsed : [parsed];
        } catch (_e) {
          extraArgs = [];
        }
      }
      if (id !== null && id !== undefined) {
        handler(id, ...extraArgs, event);
      } else if (extraArgs.length > 0) {
        handler(...extraArgs, event);
      } else {
        handler(event);
      }
    });

    // Handle Escape key on input fields (data-on-keyescape)
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!event.target || !event.target.closest) return;
      const el = event.target.closest('[data-on-keyescape]');
      if (!el) return;
      const actionName = el.getAttribute('data-on-keyescape');
      if (!actionName) return;
      const handler = this._resolve(actionName);
      if (!handler) return;
      const id = el.getAttribute('data-id');
      const argsJson = el.getAttribute('data-args');
      let extraArgs = [];
      if (argsJson) {
        try {
          const parsed = JSON.parse(argsJson);
          extraArgs = Array.isArray(parsed) ? parsed : [parsed];
        } catch (_e) {
          extraArgs = [];
        }
      }
      if (id !== null && id !== undefined) {
        handler(id, ...extraArgs, el, event);
      } else if (extraArgs.length > 0) {
        handler(...extraArgs, el, event);
      } else {
        handler(el, event);
      }
    });

    // Handle change events for checkboxes (passes el.checked instead of el.value)
    document.addEventListener('change', (event) => {
      if (!event.target || !event.target.closest) return;
      const el = event.target.closest('[data-on-check]');
      if (!el) return;
      const actionName = el.getAttribute('data-on-check');
      if (!actionName) return;
      const handler = this._resolve(actionName);
      if (!handler) return;
      const id = el.getAttribute('data-id');
      if (id) {
        handler(id, el.checked, event);
      } else {
        handler(el.checked, event);
      }
    });

    // Handle change events for file inputs (passes the element itself)
    document.addEventListener('change', (event) => {
      if (!event.target || !event.target.closest) return;
      const el = event.target.closest('[data-on-file-change]');
      if (!el) return;
      const actionName = el.getAttribute('data-on-file-change');
      if (!actionName) return;
      const handler = this._resolve(actionName);
      if (!handler) return;
      const id = el.getAttribute('data-id');
      if (id) {
        handler(id, el, event);
      } else {
        handler(el, event);
      }
    });

    // Handle mouseover events (data-on-mouseover)
    document.addEventListener('mouseover', (event) => {
      if (!event.target || !event.target.closest) return;
      const el = event.target.closest('[data-on-mouseover]');
      if (!el) return;
      const actionName = el.getAttribute('data-on-mouseover');
      if (!actionName) return;
      const handler = this._resolve(actionName);
      if (!handler) return;
      handler(el, event);
    });

    // Handle mouseout events (data-on-mouseout)
    document.addEventListener('mouseout', (event) => {
      if (!event.target || !event.target.closest) return;
      const el = event.target.closest('[data-on-mouseout]');
      if (!el) return;
      const actionName = el.getAttribute('data-on-mouseout');
      if (!actionName) return;
      const handler = this._resolve(actionName);
      if (!handler) return;
      handler(el, event);
    });

    // Handle blur events (data-on-blur)
    document.addEventListener('focusout', (event) => {
      if (!event.target || !event.target.closest) return;
      const el = event.target.closest('[data-on-blur]');
      if (!el) return;
      const actionName = el.getAttribute('data-on-blur');
      if (!actionName) return;
      const handler = this._resolve(actionName);
      if (!handler) return;
      const id = el.getAttribute('data-id');
      if (id) {
        handler(el, id, event);
      } else {
        handler(el, event);
      }
    });

    // Handle mousedown events (data-on-mousedown)
    document.addEventListener('mousedown', (event) => {
      if (!event.target || !event.target.closest) return;
      const el = event.target.closest('[data-on-mousedown]');
      if (!el) return;
      const actionName = el.getAttribute('data-on-mousedown');
      if (!actionName) return;
      const handler = this._resolve(actionName);
      if (!handler) return;
      const id = el.getAttribute('data-id');
      if (id) {
        handler(id, el, event);
      } else {
        handler(el, event);
      }
    });

    // Handle mouseenter events (data-on-mouseenter)
    document.addEventListener(
      'mouseenter',
      (event) => {
        if (!event.target || !event.target.closest) return;
        const el = event.target.closest('[data-on-mouseenter]');
        if (!el) return;
        const actionName = el.getAttribute('data-on-mouseenter');
        if (!actionName) return;
        const handler = this._resolve(actionName);
        if (!handler) return;
        const id = el.getAttribute('data-id');
        if (id) {
          handler(el, id, event);
        } else {
          handler(el, event);
        }
      },
      true
    );

    // Handle mouseleave events (data-on-mouseleave)
    document.addEventListener(
      'mouseleave',
      (event) => {
        if (!event.target || !event.target.closest) return;
        const el = event.target.closest('[data-on-mouseleave]');
        if (!el) return;
        const actionName = el.getAttribute('data-on-mouseleave');
        if (!actionName) return;
        const handler = this._resolve(actionName);
        if (!handler) return;
        handler(el, event);
      },
      true
    );
  },
};

// ============================================
// HELPER ACTIONS for data-action delegation
// ============================================

/**
 * Utility actions exposed on window.utils for data-action handlers.
 * These replace complex inline onclick/onchange handlers.
 */
Object.assign(utils, {
  /** Toggle all collapse sections in an accordion */
  toggleAccordion(accordionId) {
    document.querySelectorAll(`#${accordionId} .collapse`).forEach((c) => {
      new bootstrap.Collapse(c, { toggle: true });
    });
  },

  /** Navigate to a section and close a modal */
  navigateAndCloseModal(sectionId) {
    const args = JSON.parse(sectionId);
    if (args.section && typeof dashboardModule !== 'undefined') {
      dashboardModule.navigateToSection(args.section);
    }
    if (args.modal) {
      const modalEl = document.getElementById(args.modal);
      if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
    }
  },

  /** Remove the closest .toast ancestor of the clicked element */
  removeClosestToast(_id, event) {
    const el = event?.target?.closest?.('[data-action]') || event?.target;
    const toast = el?.closest('.toast');
    if (toast) toast.remove();
  },

  /** Remove the parent element of the clicked element */
  removeParentElement(_id, event) {
    const el = event?.target?.closest?.('[data-action]') || event?.target;
    if (el?.parentElement) el.parentElement.remove();
  },

  /** Copy the value of an input element by its ID to clipboard */
  copyInputValueById(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
      navigator.clipboard.writeText(input.value);
      utils.showToast('Copied!', 'success');
    }
  },

  /** Filter elements by text content (used for search inputs) */
  filterElementsByText(value, event) {
    const el = event?.target?.closest?.('[data-on-input]') || event?.target;
    const argsJson = el?.getAttribute('data-args');
    let selector = '.audit-entry';
    if (argsJson) {
      try {
        const parsed = JSON.parse(argsJson);
        selector = Array.isArray(parsed) ? parsed[0] : parsed;
      } catch (_e) {
        /* use default */
      }
    }
    const lowerVal = (value || '').toLowerCase();
    document.querySelectorAll(selector).forEach((item) => {
      item.style.display = item.textContent.toLowerCase().includes(lowerVal) ? '' : 'none';
    });
  },

  /** Set a style transform on an element (replaces onmouseover/onmouseout inline handlers) */
  setTransform(el, _event) {
    if (el) {
      const transform = el.getAttribute('data-transform') || '';
      el.style.transform = transform;
    }
  },

  /** Reset a style transform on an element */
  resetTransform(el, _event) {
    if (el) {
      el.style.transform = '';
    }
  },
});

// ============================================
// API CLIENT — routes critical operations through /api/data-proxy
// instead of making direct Supabase calls from the browser.
// This keeps the Supabase service key server-side and enforces
// server-side validation, rate limiting, and audit logging.
// ============================================

const apiClient = {
  /**
   * Get the current user's JWT for authenticating against API endpoints.
   * @returns {Promise<string|null>}
   */
  async _getToken() {
    if (!STATE.client) return null;
    const { data } = await STATE.client.auth.getSession();
    return data?.session?.access_token || null;
  },

  /**
   * Call the /api/data-proxy endpoint.
   * @param {Object} body - Request payload (table, operation, filters, etc.)
   * @returns {Promise<Object>} Parsed JSON response
   */
  /** Request timeout in milliseconds */
  TIMEOUT_MS: 30000,

  /** Maximum retry attempts for transient failures */
  MAX_RETRIES: 2,

  async _call(body, attempt = 0) {
    const token = await this._getToken();
    if (!token) throw new Error('Not authenticated');

    let res;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      res = await fetch('/api/data-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch (err) {
      // Retry on network/timeout errors (not on abort from user)
      if (attempt < this.MAX_RETRIES && (err.name === 'AbortError' || err.name === 'TypeError')) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s
        await new Promise((r) => setTimeout(r, delay));
        return this._call(body, attempt + 1);
      }
      throw new Error(err.name === 'AbortError' ? 'Request timed out' : `Network error: ${err.message}`);
    }

    // Parse response safely — server may return non-JSON on 500s
    let json;
    try {
      json = await res.json();
    } catch (_parseErr) {
      throw new Error(`API error ${res.status}: invalid response`);
    }

    // Retry on 429 (rate-limited) or 5xx server errors
    if ((res.status === 429 || res.status >= 500) && attempt < this.MAX_RETRIES) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((r) => setTimeout(r, delay));
      return this._call(body, attempt + 1);
    }

    if (!res.ok) {
      const errorMsg = json.message || json.error || (json.details && json.details[0]) || `API error ${res.status}`;
      throw new Error(errorMsg);
    }
    return json;
  },

  /**
   * Get the current tenant ID for server-side tenant isolation.
   * @returns {string|undefined}
   */
  _getTenantId() {
    if (typeof tenantModule !== 'undefined' && tenantModule.getTenantId) {
      return tenantModule.getTenantId();
    }
    return undefined;
  },

  /**
   * Select records via the server-side proxy.
   * @param {string} table
   * @param {Object} [options]
   * @returns {Promise<{data: Array, count: number, page: number, pageSize: number, totalPages: number}>}
   */
  async select(table, options = {}) {
    return this._call({
      table,
      operation: 'select',
      select: options.select || '*',
      filters: options.filters || {},
      search: options.search || undefined,
      or: options.or || undefined,
      sort: options.sort || undefined,
      page: options.page || 1,
      pageSize: options.pageSize || 50,
      tenantId: this._getTenantId(),
    });
  },

  /**
   * Count records via the server-side proxy.
   * @param {string} table
   * @param {Object} [filters]
   * @returns {Promise<{count: number}>}
   */
  async count(table, filters = {}, options = {}) {
    return this._call({
      table,
      operation: 'count',
      filters,
      or: options.or || undefined,
      tenantId: this._getTenantId(),
    });
  },

  /**
   * Insert records via the server-side proxy.
   * @param {string} table
   * @param {Object|Array} data
   * @returns {Promise<{data: Array}>}
   */
  async insert(table, data) {
    return this._call({ table, operation: 'insert', data, tenantId: this._getTenantId() });
  },

  /**
   * Update a record via the server-side proxy.
   * @param {string} table
   * @param {string} id - Record ID
   * @param {Object} data - Fields to update
   * @returns {Promise<{data: Array}>}
   */
  async update(table, id, data) {
    return this._call({ table, operation: 'update', id, data, tenantId: this._getTenantId() });
  },

  /**
   * Update records matching filters via the server-side proxy.
   * @param {string} table
   * @param {Object} filters - Filter criteria to match rows
   * @param {Object} data - Fields to update
   * @returns {Promise<{data: Array}>}
   */
  async updateByFilters(table, filters, data) {
    return this._call({ table, operation: 'update', filters, data, tenantId: this._getTenantId() });
  },

  /**
   * Delete a record via the server-side proxy.
   * @param {string} table
   * @param {string} id - Record ID
   * @returns {Promise<{data: Array}>}
   */
  async delete(table, id) {
    return this._call({ table, operation: 'delete', id, tenantId: this._getTenantId() });
  },

  /**
   * Delete records matching filters via the server-side proxy.
   * @param {string} table
   * @param {Object} filters - Filter criteria to match rows
   * @returns {Promise<{data: Array}>}
   */
  async deleteByFilters(table, filters) {
    return this._call({ table, operation: 'delete', filters, tenantId: this._getTenantId() });
  },

  /**
   * Upsert (insert or update on conflict) records via the server-side proxy.
   * @param {string} table
   * @param {Object|Array} data - Record(s) to upsert
   * @param {Object} [options]
   * @param {string} [options.onConflict] - Conflict target column(s), e.g. 'entry_id,judge_email'
   * @returns {Promise<{data: Array}>}
   */
  async upsert(table, data, options = {}) {
    return this._call({
      table,
      operation: 'upsert',
      data,
      onConflict: options.onConflict || undefined,
      tenantId: this._getTenantId(),
    });
  },

  /**
   * Call an RPC function via the server-side proxy.
   * @param {string} rpcName - The RPC function name
   * @param {Object} [rpcParams={}] - Parameters to pass to the RPC function
   * @returns {Promise<{data: *}>}
   */
  async rpc(rpcName, rpcParams = {}) {
    return this._call({ operation: 'rpc', rpcName, rpcParams });
  },

  /**
   * Upload a file to Supabase Storage via the server-side proxy.
   * @param {string} bucket - Storage bucket name
   * @param {string} path - File path within the bucket
   * @param {File|Blob} file - The file to upload
   * @param {Object} [options={}]
   * @param {string} [options.contentType] - MIME type override
   * @returns {Promise<{publicUrl: string, path: string}>}
   */
  async upload(bucket, path, file, options = {}) {
    // Convert file to base64 for transmission via JSON
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    return this._call({
      operation: 'storage_upload',
      bucket,
      path,
      fileBase64: base64,
      contentType: options.contentType || file.type || 'application/octet-stream',
    });
  },

  /**
   * Get a public URL for a storage object via the server-side proxy.
   * @param {string} bucket - Storage bucket name
   * @param {string} path - File path within the bucket
   * @returns {Promise<{publicUrl: string}>}
   */
  async getPublicUrl(bucket, path) {
    return this._call({ operation: 'storage_url', bucket, path });
  },

  /**
   * Delete files from storage via the server-side proxy.
   * @param {string} bucket - Storage bucket name
   * @param {string[]} paths - Array of file paths to delete
   * @returns {Promise<{deleted: number}>}
   */
  async storageDelete(bucket, paths) {
    return this._call({ operation: 'storage_delete', bucket, paths });
  },

  /**
   * Load all records from a table in batches via the proxy.
   * Uses server-side pagination to fetch everything without loading it all at once.
   * @param {string} table
   * @param {Object} [options]
   * @param {string} [options.select] - Column selection
   * @param {Object} [options.filters] - Filter criteria
   * @param {Object} [options.sort] - Sort config { column, ascending }
   * @param {number} [options.batchSize] - Records per batch (default 1000)
   * @returns {Promise<Array>} All matching records
   */
  async selectAll(table, options = {}) {
    const batchSize = options.batchSize || 1000;
    const allData = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const result = await this.select(table, {
        select: options.select || '*',
        filters: options.filters || {},
        sort: options.sort,
        page,
        pageSize: batchSize,
      });
      allData.push(...(result.data || []));
      totalPages = result.totalPages || 1;
      page++;
    }
    return allData;
  },
};

// Export to window for global access
ModuleRegistry.register('utils', utils);
ModuleRegistry.register('serverQuery', serverQuery);
ModuleRegistry.register('actionRegistry', actionRegistry);
ModuleRegistry.register('apiClient', apiClient);

export { utils, apiClient, serverQuery, actionRegistry };
