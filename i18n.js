/* ==================================================== */
/* INTERNATIONALISATION (i18n) MODULE                    */
/* Lightweight translation framework for the CMS UI      */
/* ==================================================== */

const i18n = {
  _currentLocale: 'en',
  _translations: {},
  _fallbackLocale: 'en',

  /**
   * Built-in English translations (default)
   */
  _builtinEn: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.awards': 'Awards',
    'nav.organisations': 'Organisations',
    'nav.entries': 'Entries',
    'nav.winners': 'Winners',
    'nav.events': 'Events',
    'nav.media': 'Media Gallery',
    'nav.social': 'Social Media',
    'nav.judging': 'Judging',
    'nav.settings': 'Settings',

    // Common actions
    'action.save': 'Save',
    'action.cancel': 'Cancel',
    'action.delete': 'Delete',
    'action.edit': 'Edit',
    'action.add': 'Add',
    'action.search': 'Search',
    'action.filter': 'Filter',
    'action.export': 'Export',
    'action.import': 'Import',
    'action.refresh': 'Refresh',
    'action.close': 'Close',
    'action.confirm': 'Confirm',
    'action.back': 'Back',
    'action.next': 'Next',
    'action.submit': 'Submit',
    'action.download': 'Download',
    'action.upload': 'Upload',
    'action.view': 'View',
    'action.copy': 'Copy',
    'action.print': 'Print',

    // Common labels
    'label.name': 'Name',
    'label.email': 'Email',
    'label.phone': 'Phone',
    'label.status': 'Status',
    'label.date': 'Date',
    'label.type': 'Type',
    'label.category': 'Category',
    'label.description': 'Description',
    'label.notes': 'Notes',
    'label.actions': 'Actions',
    'label.total': 'Total',
    'label.created': 'Created',
    'label.updated': 'Updated',
    'label.loading': 'Loading...',
    'label.noResults': 'No results found',
    'label.showing': 'Showing',
    'label.of': 'of',

    // Status labels
    'status.active': 'Active',
    'status.inactive': 'Inactive',
    'status.pending': 'Pending',
    'status.approved': 'Approved',
    'status.rejected': 'Rejected',
    'status.draft': 'Draft',
    'status.published': 'Published',
    'status.archived': 'Archived',
    'status.complete': 'Complete',

    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.totalAwards': 'Total Awards',
    'dashboard.totalOrganisations': 'Total Organisations',
    'dashboard.totalEntries': 'Total Entries',
    'dashboard.totalWinners': 'Total Winners',
    'dashboard.recentActivity': 'Recent Activity',

    // Awards
    'awards.title': 'Awards Management',
    'awards.addNew': 'Add New Award',
    'awards.awardName': 'Award Name',
    'awards.season': 'Season',
    'awards.votingOpen': 'Voting Open',
    'awards.votingClosed': 'Voting Closed',

    // Organisations
    'orgs.title': 'Organisations',
    'orgs.companyName': 'Company Name',
    'orgs.contactPerson': 'Contact Person',
    'orgs.website': 'Website',

    // Events
    'events.title': 'Events',
    'events.eventName': 'Event Name',
    'events.venue': 'Venue',
    'events.eventDate': 'Event Date',
    'events.capacity': 'Capacity',
    'events.attendees': 'Attendees',

    // Messages
    'msg.saved': 'Saved successfully',
    'msg.deleted': 'Deleted successfully',
    'msg.error': 'An error occurred',
    'msg.confirmDelete': 'Are you sure you want to delete this?',
    'msg.noData': 'No data available',
    'msg.unauthorized': 'You do not have permission for this action',

    // Date/time
    'time.justNow': 'Just now',
    'time.minutesAgo': '{n} minutes ago',
    'time.hoursAgo': '{n} hours ago',
    'time.daysAgo': '{n} days ago',
    'time.today': 'Today',
    'time.yesterday': 'Yesterday'
  },

  /**
   * Initialize i18n module
   */
  init() {
    this._translations.en = this._builtinEn;

    // Load saved locale preference
    const savedLocale = localStorage.getItem('bta_locale') || navigator.language?.split('-')[0] || 'en';
    this.setLocale(savedLocale);

    // i18n initialized
  },

  /**
   * Get current locale
   * @returns {string} Current locale code (e.g. 'en')
   */
  getLocale() {
    return this._currentLocale;
  },

  /**
   * Set the active locale
   * @param {string} locale - Locale code to set (e.g. 'en', 'fr')
   */
  setLocale(locale) {
    if (!this._translations[locale]) {
      console.warn(`i18n: Locale "${locale}" not loaded, falling back to "${this._fallbackLocale}"`);
      locale = this._fallbackLocale;
    }
    this._currentLocale = locale;
    localStorage.setItem('bta_locale', locale);
    document.documentElement.lang = locale;
  },

  /**
   * Register translations for a locale
   */
  addLocale(locale, translations) {
    this._translations[locale] = { ...this._translations[locale], ...translations };
  },

  /**
   * Load locale from a JSON file
   */
  async loadLocale(locale, url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load locale: ${res.status}`);
      const translations = await res.json();
      this.addLocale(locale, translations);
      return true;
    } catch (e) {
      console.error(`i18n: Failed to load locale "${locale}":`, e);
      await utils.showErrorWithRetry(`Failed to load locale "${locale}"`, async () => {
        await this.loadLocale(locale, url);
      });
      return false;
    }
  },

  /**
   * Translate a key with optional interpolation
   * @param {string} key - Translation key (e.g., 'nav.dashboard')
   * @param {Object} params - Interpolation params (e.g., { n: 5 })
   * @returns {string} Translated string
   */
  t(key, params = {}) {
    const locale = this._currentLocale;
    let text = this._translations[locale]?.[key]
      || this._translations[this._fallbackLocale]?.[key]
      || key;

    // Interpolate {param} placeholders
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }

    return text;
  },

  /**
   * Get list of available locales
   */
  getAvailableLocales() {
    return Object.keys(this._translations);
  },

  /**
   * Apply translations to all elements with data-i18n attribute
   * Call this after rendering HTML to translate static text
   */
  translatePage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translated = this.t(key);
      if (translated !== key) {
        if (el.tagName === 'INPUT' && el.type !== 'submit') {
          el.placeholder = translated;
        } else {
          el.textContent = translated;
        }
      }
    });

    // Translate aria-labels
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      const translated = this.t(key);
      if (translated !== key) {
        el.setAttribute('aria-label', translated);
      }
    });

    // Translate titles
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const translated = this.t(key);
      if (translated !== key) {
        el.setAttribute('title', translated);
      }
    });
  },

  /**
   * Format a number for the current locale
   */
  formatNumber(num) {
    return new Intl.NumberFormat(this._currentLocale).format(num);
  },

  /**
   * Format currency for the current locale
   */
  formatCurrency(amount, currency = 'GBP') {
    return new Intl.NumberFormat(this._currentLocale, {
      style: 'currency',
      currency
    }).format(amount);
  },

  /**
   * Format a date for the current locale
   */
  formatDate(date, options = {}) {
    const d = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat(this._currentLocale, {
      year: 'numeric', month: 'short', day: 'numeric',
      ...options
    }).format(d);
  }
};

ModuleRegistry.register('i18n', i18n);

export { i18n };
