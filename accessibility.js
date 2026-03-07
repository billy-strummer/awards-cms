/* ==================================================== */
/* ACCESSIBILITY MODULE                                  */
/* ARIA labels, keyboard navigation, screen reader       */
/* support, skip links, focus management                 */
/* ==================================================== */

const a11yModule = {
  /**
   * Initialize accessibility enhancements
   */
  init() {
    this.addSkipLink();
    this.enhanceButtons();
    this.enhanceClickableElements();
    this.enhanceTables();
    this.enhanceModals();
    this.setupKeyboardNav();
    this.setupLiveRegion();
    this.setupFocusManagement();
    // Accessibility module initialized
  },

  /**
   * Add skip-to-content link for keyboard users
   */
  addSkipLink() {
    if (document.getElementById('a11y-skip-link')) return;
    const skip = document.createElement('a');
    skip.id = 'a11y-skip-link';
    skip.href = '#dashboardPage';
    skip.textContent = 'Skip to main content';
    skip.className = 'visually-hidden-focusable position-fixed top-0 start-0 p-2 bg-primary text-white';
    skip.style.zIndex = '9999';
    document.body.prepend(skip);
  },

  /**
   * Add ARIA labels to icon-only buttons that are missing them
   */
  enhanceButtons() {
    // Find all buttons with only an icon child and no aria-label
    document.querySelectorAll('button:not([aria-label])').forEach((btn) => {
      if (btn.textContent.trim() === '' || btn.children.length === 1) {
        const icon = btn.querySelector('i.bi');
        if (icon) {
          const label = this._inferLabelFromIcon(icon.className);
          if (label) btn.setAttribute('aria-label', label);
        }
      }
    });

    // Add aria-label to all onclick delete buttons
    document.querySelectorAll('button[onclick*="delete"]:not([aria-label])').forEach((btn) => {
      btn.setAttribute('aria-label', 'Delete');
    });

    // Add role="button" to anchors acting as buttons
    document.querySelectorAll('a[onclick]:not([role])').forEach((a) => {
      a.setAttribute('role', 'button');
    });
  },

  /**
   * Make non-button clickable elements (divs/spans with onclick) keyboard-accessible
   */
  enhanceClickableElements() {
    document.querySelectorAll('div[onclick]:not([role]), span[onclick]:not([role])').forEach((el) => {
      el.setAttribute('role', 'button');
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      if (!el._a11yKeyHandler) {
        el._a11yKeyHandler = true;
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            el.click();
          }
        });
      }
    });
  },

  /**
   * Infer an aria-label from a Bootstrap icon class
   */
  _inferLabelFromIcon(className) {
    const map = {
      'bi-pencil': 'Edit',
      'bi-trash': 'Delete',
      'bi-eye': 'View',
      'bi-download': 'Download',
      'bi-upload': 'Upload',
      'bi-plus': 'Add',
      'bi-plus-circle': 'Add',
      'bi-x': 'Close',
      'bi-x-circle': 'Close',
      'bi-check': 'Confirm',
      'bi-check-circle': 'Confirm',
      'bi-arrow-left': 'Back',
      'bi-arrow-right': 'Next',
      'bi-search': 'Search',
      'bi-filter': 'Filter',
      'bi-gear': 'Settings',
      'bi-three-dots': 'More options',
      'bi-envelope': 'Email',
      'bi-telephone': 'Call',
      'bi-copy': 'Copy',
      'bi-clipboard': 'Copy to clipboard',
      'bi-printer': 'Print',
      'bi-save': 'Save',
      'bi-refresh': 'Refresh',
      'bi-arrow-clockwise': 'Refresh',
    };

    for (const [iconClass, label] of Object.entries(map)) {
      if (className.includes(iconClass)) return label;
    }
    return null;
  },

  /**
   * Enhance data tables with proper ARIA roles
   */
  enhanceTables() {
    document.querySelectorAll('table').forEach((table) => {
      if (!table.getAttribute('role')) {
        table.setAttribute('role', 'grid');
      }

      // Add scope to header cells
      table.querySelectorAll('thead th').forEach((th) => {
        if (!th.getAttribute('scope')) {
          th.setAttribute('scope', 'col');
        }
      });
    });
  },

  /**
   * Enhance modals with proper ARIA attributes
   */
  enhanceModals() {
    document.querySelectorAll('.modal').forEach((modal) => {
      if (!modal.getAttribute('aria-labelledby')) {
        const title = modal.querySelector('.modal-title');
        if (title) {
          const titleId = title.id || `modal-title-${Math.random().toString(36).slice(2, 8)}`;
          title.id = titleId;
          modal.setAttribute('aria-labelledby', titleId);
        }
      }
      if (!modal.getAttribute('aria-modal')) {
        modal.setAttribute('aria-modal', 'true');
      }
    });
  },

  /**
   * Setup keyboard navigation for tab panels and data tables
   */
  setupKeyboardNav() {
    // Arrow key navigation for nav tabs
    document.querySelectorAll('.nav-tabs').forEach((tabList) => {
      tabList.setAttribute('role', 'tablist');
      const tabs = Array.from(tabList.querySelectorAll('.nav-link'));

      tabs.forEach((tab, index) => {
        tab.setAttribute('role', 'tab');
        tab.addEventListener('keydown', (e) => {
          let newIndex;
          if (e.key === 'ArrowRight') {
            newIndex = (index + 1) % tabs.length;
          } else if (e.key === 'ArrowLeft') {
            newIndex = (index - 1 + tabs.length) % tabs.length;
          } else if (e.key === 'Home') {
            newIndex = 0;
          } else if (e.key === 'End') {
            newIndex = tabs.length - 1;
          }

          if (newIndex !== undefined) {
            e.preventDefault();
            tabs[newIndex].focus();
            tabs[newIndex].click();
          }
        });
      });
    });
  },

  /**
   * Create an ARIA live region for dynamic status announcements
   */
  setupLiveRegion() {
    if (document.getElementById('a11y-live-region')) return;
    const region = document.createElement('div');
    region.id = 'a11y-live-region';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    region.className = 'visually-hidden';
    document.body.appendChild(region);
  },

  /**
   * Announce a message to screen readers
   * @param {string} message - The message to announce
   */
  announce(message) {
    const region = document.getElementById('a11y-live-region');
    if (region) {
      region.textContent = '';
      // Brief delay so screen readers pick up the change
      setTimeout(() => {
        region.textContent = message;
      }, 100);
    }
  },

  /**
   * Re-run enhancements after dynamic content loads
   * Call this after rendering new HTML (e.g., after table re-render)
   */
  refresh() {
    this.enhanceButtons();
    this.enhanceClickableElements();
    this.enhanceTables();
    this.enhanceModals();
    this.setupFocusManagement();
  },

  /**
   * Setup focus management - return focus to trigger element after modal close
   */
  setupFocusManagement() {
    if (this._focusMgmtInit) return;
    this._focusMgmtInit = true;

    // Track which element opened each modal
    document.addEventListener('show.bs.modal', (e) => {
      e.target._a11yTrigger = document.activeElement;
    });

    // Blur focused element inside modal before aria-hidden is applied
    // (prevents "Blocked aria-hidden on a focused element" browser warning)
    document.addEventListener('hide.bs.modal', (e) => {
      if (e.target.contains(document.activeElement)) {
        document.activeElement.blur();
      }
    });

    document.addEventListener('hidden.bs.modal', (e) => {
      const trigger = e.target._a11yTrigger;
      if (trigger && document.body.contains(trigger)) {
        setTimeout(() => trigger.focus(), 50);
      }
      e.target._a11yTrigger = null;
    });
  },

  /**
   * Announce dynamic content changes to screen readers (HIGH-8)
   * Call this after table renders, filter changes, CRUD operations, etc.
   * @param {string} action - Type of action (e.g. 'load', 'filter', 'create', 'update', 'delete')
   * @param {number} count - Number of records
   * @param {string} moduleName - Name of the module (e.g. 'Awards', 'Organisations')
   */
  announceTableUpdate(action, count, moduleName) {
    const messages = {
      load: `${moduleName}: ${count} records loaded`,
      filter: `${moduleName}: ${count} records match current filters`,
      create: `${moduleName}: Record created successfully. ${count} total records`,
      update: `${moduleName}: Record updated successfully`,
      delete: `${moduleName}: Record deleted. ${count} records remaining`,
      page: `${moduleName}: Showing page of ${count} records`,
      sort: `${moduleName}: Table sorted. ${count} records`,
      bulk: `${moduleName}: Bulk operation completed on ${count} records`,
    };
    this.announce(messages[action] || `${moduleName}: ${count} records`);
  },

  /**
   * Announce navigation changes
   * @param {string} tabName - The name of the tab navigated to
   */
  announceNavigation(tabName) {
    this.announce(`Navigated to ${tabName}`);
  },
};

ModuleRegistry.register('a11yModule', a11yModule);

export { a11yModule };
