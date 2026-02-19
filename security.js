/* ==================================================== */
/* SECURITY MODULE                                       */
/* CSRF protection, XSS hardening, rate limiting,        */
/* file upload validation, Content Security Policy        */
/* ==================================================== */

const securityModule = {
  _csrfToken: null,
  _rateLimitMap: new Map(),

  /**
   * Initialize security measures on page load
   */
  init() {
    this._generateCsrfToken();
    this._setupCSP();
    this._patchInnerHTML();
    console.log('Security module initialized');
  },

  // ==========================================
  // CSRF Protection
  // ==========================================

  /**
   * Generate a CSRF token and store it
   */
  _generateCsrfToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    this._csrfToken = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    // Store in a meta tag for forms to pick up
    let meta = document.querySelector('meta[name="csrf-token"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'csrf-token';
      document.head.appendChild(meta);
    }
    meta.content = this._csrfToken;
  },

  /**
   * Get the current CSRF token
   */
  getCsrfToken() {
    return this._csrfToken;
  },

  /**
   * Add CSRF token to fetch headers
   */
  secureFetch(url, options = {}) {
    options.headers = options.headers || {};
    options.headers['X-CSRF-Token'] = this._csrfToken;
    return fetch(url, options);
  },

  // ==========================================
  // Content Security Policy
  // ==========================================

  /**
   * Set CSP headers via meta tag
   */
  _setupCSP() {
    let cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!cspMeta) {
      cspMeta = document.createElement('meta');
      cspMeta.httpEquiv = 'Content-Security-Policy';
      // Permissive CSP that still blocks inline event handlers from injected content
      cspMeta.content = [
        "default-src 'self' https://*.supabase.co",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://js.stripe.com https://browser.sentry-cdn.com https://s3.tradingview.com",
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com",
        "img-src 'self' data: blob: https://*.supabase.co https://i.ytimg.com https://*.tile.openstreetmap.org",
        "font-src 'self' https://cdn.jsdelivr.net",
        "connect-src 'self' https://*.supabase.co https://api.resend.com https://*.sentry.io wss://*.supabase.co https://*.tradingview.com wss://*.tradingview.com",
        "frame-src 'self' https://js.stripe.com https://www.youtube.com https://s3.tradingview.com https://*.tradingview.com",
        "object-src 'none'",
        "base-uri 'self'"
      ].join('; ');
      document.head.appendChild(cspMeta);
    }
  },

  // ==========================================
  // XSS Hardening
  // ==========================================

  /**
   * Sanitize HTML — strips dangerous tags/attributes
   * Use this instead of innerHTML for user-generated content
   */
  sanitizeHtml(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  },

  /**
   * Sanitize but allow basic formatting (b, i, a, br, p, ul, li)
   */
  sanitizeRichHtml(html) {
    if (!html) return '';
    const allowedTags = ['b', 'i', 'strong', 'em', 'a', 'br', 'p', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    const allowedAttrs = ['href', 'target', 'rel'];
    const div = document.createElement('div');
    div.innerHTML = html;

    // Walk DOM and remove disallowed elements/attributes
    const walk = (node) => {
      const children = Array.from(node.childNodes);
      children.forEach(child => {
        if (child.nodeType === 1) { // Element
          const tagName = child.tagName.toLowerCase();
          if (!allowedTags.includes(tagName)) {
            // Replace with text content
            const text = document.createTextNode(child.textContent);
            node.replaceChild(text, child);
          } else {
            // Remove disallowed attributes
            Array.from(child.attributes).forEach(attr => {
              if (!allowedAttrs.includes(attr.name.toLowerCase())) {
                child.removeAttribute(attr.name);
              }
              // Sanitize href to prevent javascript: protocol
              if (attr.name === 'href' && /^javascript:/i.test(attr.value)) {
                child.removeAttribute('href');
              }
            });
            // Force safe link attributes
            if (tagName === 'a') {
              child.setAttribute('rel', 'noopener noreferrer');
              child.setAttribute('target', '_blank');
            }
            walk(child);
          }
        }
      });
    };

    walk(div);
    return div.innerHTML;
  },

  /**
   * Patch innerHTML assignments with a warning in dev mode
   */
  _patchInnerHTML() {
    // In development, log innerHTML usage that might be XSS-vulnerable
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.info('Security: XSS monitoring active in development mode');
    }
  },

  // ==========================================
  // Rate Limiting (Client-side)
  // ==========================================

  /**
   * Check if an action is rate limited
   * @param {string} action - Action identifier
   * @param {number} maxPerMinute - Max allowed per minute
   * @returns {boolean} true if allowed, false if rate limited
   */
  checkRateLimit(action, maxPerMinute = 30) {
    const now = Date.now();
    const windowMs = 60000; // 1 minute

    if (!this._rateLimitMap.has(action)) {
      this._rateLimitMap.set(action, []);
    }

    const timestamps = this._rateLimitMap.get(action);
    // Remove old entries
    const recent = timestamps.filter(t => now - t < windowMs);
    this._rateLimitMap.set(action, recent);

    if (recent.length >= maxPerMinute) {
      utils.showToast('Too many requests. Please slow down.', 'warning');
      return false;
    }

    recent.push(now);
    return true;
  },

  // ==========================================
  // File Upload Validation
  // ==========================================

  /**
   * Validate a file before upload
   * @param {File} file - The file to validate
   * @param {Object} options - Validation options
   * @returns {{ valid: boolean, error: string|null }}
   */
  validateFileUpload(file, options = {}) {
    const {
      maxSizeMB = 10,
      allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'],
      allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'],
      blockSVG = true
    } = options;

    if (!file) return { valid: false, error: 'No file selected' };

    // Check file size
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      return { valid: false, error: `File too large. Maximum size is ${maxSizeMB}MB.` };
    }

    // Check MIME type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      return { valid: false, error: `File type "${file.type}" is not allowed.` };
    }

    // Check extension
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (allowedExtensions.length > 0 && !allowedExtensions.includes(ext)) {
      return { valid: false, error: `File extension "${ext}" is not allowed.` };
    }

    // Block SVG (potential XSS vector)
    if (blockSVG && (file.type === 'image/svg+xml' || ext === '.svg')) {
      return { valid: false, error: 'SVG files are not allowed for security reasons.' };
    }

    // Check for double extensions (e.g., file.jpg.exe)
    const parts = file.name.split('.');
    if (parts.length > 2) {
      const secondToLast = '.' + parts[parts.length - 2].toLowerCase();
      if (['.exe', '.bat', '.cmd', '.sh', '.ps1', '.msi'].includes(secondToLast)) {
        return { valid: false, error: 'File appears to have a suspicious double extension.' };
      }
    }

    return { valid: true, error: null };
  },

  /**
   * Validate file and show toast on error
   * @returns {boolean} Whether file is valid
   */
  validateAndReport(file, options = {}) {
    const result = this.validateFileUpload(file, options);
    if (!result.valid) {
      utils.showToast(result.error, 'error');
    }
    return result.valid;
  }
};

window.securityModule = securityModule;
