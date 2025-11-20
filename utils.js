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
    toastMessage.textContent = message;
    
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
    document.getElementById('loadingBar').style.display = 'block';
  },

  /**
   * Hide loading bar
   */
  hideLoading() {
    document.getElementById('loadingBar').style.display = 'none';
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
   * Show confirmation dialog
   * @param {string} message - Confirmation message
   * @returns {boolean} User's choice
   */
  confirm(message) {
    return window.confirm(message);
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
    
    this.showToast(`Exported ${data.length} records`, 'success');
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
  }
};

// Export to window for global access
window.utils = utils;
