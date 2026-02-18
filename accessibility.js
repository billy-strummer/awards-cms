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
    this.enhanceTables();
    this.enhanceModals();
    this.setupKeyboardNav();
    this.setupLiveRegion();
    console.log('Accessibility module initialized');
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
    document.querySelectorAll('button:not([aria-label])').forEach(btn => {
      if (btn.textContent.trim() === '' || btn.children.length === 1) {
        const icon = btn.querySelector('i.bi');
        if (icon) {
          const label = this._inferLabelFromIcon(icon.className);
          if (label) btn.setAttribute('aria-label', label);
        }
      }
    });

    // Add aria-label to all onclick delete buttons
    document.querySelectorAll('button[onclick*="delete"]:not([aria-label])').forEach(btn => {
      btn.setAttribute('aria-label', 'Delete');
    });

    // Add role="button" to anchors acting as buttons
    document.querySelectorAll('a[onclick]:not([role])').forEach(a => {
      a.setAttribute('role', 'button');
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
      'bi-arrow-clockwise': 'Refresh'
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
    document.querySelectorAll('table').forEach(table => {
      if (!table.getAttribute('role')) {
        table.setAttribute('role', 'grid');
      }

      // Add scope to header cells
      table.querySelectorAll('thead th').forEach(th => {
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
    document.querySelectorAll('.modal').forEach(modal => {
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
    document.querySelectorAll('.nav-tabs').forEach(tabList => {
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
   */
  announce(message) {
    const region = document.getElementById('a11y-live-region');
    if (region) {
      region.textContent = '';
      // Brief delay so screen readers pick up the change
      setTimeout(() => { region.textContent = message; }, 100);
    }
  },

  /**
   * Re-run enhancements after dynamic content loads
   * Call this after rendering new HTML (e.g., after table re-render)
   */
  refresh() {
    this.enhanceButtons();
    this.enhanceTables();
    this.enhanceModals();
  }
};

window.a11yModule = a11yModule;
