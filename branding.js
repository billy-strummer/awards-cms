/* ==================================================== */
/* BRANDING MODULE — White-label engine for tenant CMS  */
/* ==================================================== */

const brandingModule = {
  /* ---- Presets ---- */

  /**
   * Return the list of built-in branding presets.
   * @returns {Array<{id: string, name: string, primary_color: string, secondary_color: string, accent_color: string, font_family: string}>}
   */
  getPresets() {
    return [
      {
        id: 'bta-official',
        name: 'BTA Official',
        primary_color: '#000000',
        secondary_color: '#1a1a1a',
        accent_color: '#D4AF37',
        font_family: "'Montserrat', sans-serif",
      },
      {
        id: 'classic-blue',
        name: 'Classic Blue',
        primary_color: '#0d3b6e',
        secondary_color: '#1a6bb5',
        accent_color: '#e8a020',
        font_family: 'Georgia, serif',
      },
      {
        id: 'modern-dark',
        name: 'Modern Dark',
        primary_color: '#1a1a2e',
        secondary_color: '#16213e',
        accent_color: '#e94560',
        font_family: "'Segoe UI', sans-serif",
      },
      {
        id: 'elegant-gold',
        name: 'Elegant Gold',
        primary_color: '#2c2c2c',
        secondary_color: '#4a4a4a',
        accent_color: '#c9a84c',
        font_family: "'Palatino Linotype', serif",
      },
      {
        id: 'fresh-green',
        name: 'Fresh Green',
        primary_color: '#1b5e20',
        secondary_color: '#2e7d32',
        accent_color: '#ff8f00',
        font_family: "'Helvetica Neue', sans-serif",
      },
    ];
  },

  /* ---- Load / Save ---- */

  /**
   * Load branding configuration for the given tenant.
   * @param {string} tenantId - The tenant identifier
   * @returns {Promise<Object>} Branding configuration object
   */
  async loadBranding(tenantId) {
    const { data, error } = await STATE.client
      .from('tenant_branding')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw error;
    return data || {};
  },

  /**
   * Persist branding configuration for the given tenant via apiClient.
   * @param {string} tenantId - The tenant identifier
   * @param {Object} config - Branding configuration fields
   * @returns {Promise<boolean>} True on success
   */
  async saveBranding(tenantId, config) {
    try {
      await apiClient.upsert('tenant_branding', {
        tenant_id: tenantId,
        logo_url: config.logo_url || null,
        favicon_url: config.favicon_url || null,
        primary_color: config.primary_color || '#000000',
        secondary_color: config.secondary_color || '#1a1a1a',
        accent_color: config.accent_color || '#D4AF37',
        company_name: config.company_name || '',
        tagline: config.tagline || '',
        email_from: config.email_from || '',
        email_reply_to: config.email_reply_to || '',
        font_family: config.font_family || "'Montserrat', sans-serif",
        updated_at: new Date().toISOString(),
      });
      utils.showToast('Branding saved.', 'success');
      return true;
    } catch (e) {
      console.error('saveBranding:', e);
      utils.showToast('Failed to save branding: ' + e.message, 'error');
      return false;
    }
  },

  /* ---- Apply to DOM ---- */

  /**
   * Apply branding configuration to the current page DOM (CSS variables, title, favicon, logo).
   * @param {Object} config - Branding configuration
   * @returns {void}
   */
  /**
   * Check whether a URL looks like a valid image source (data URI, blob, or
   * path/URL ending with a known image extension).
   * @param {string} url
   * @returns {boolean}
   */
  _isImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    if (url.startsWith('data:image/') || url.startsWith('blob:')) return true;
    try {
      const { pathname } = new URL(url, window.location.origin);
      return /\.(png|jpe?g|gif|webp|svg|ico|avif|bmp)$/i.test(pathname);
    } catch {
      return false;
    }
  },

  applyBranding(config) {
    if (!config || !Object.keys(config).length) return;
    const root = document.documentElement;
    if (config.primary_color) root.style.setProperty('--brand-primary', config.primary_color);
    if (config.secondary_color) root.style.setProperty('--brand-secondary', config.secondary_color);
    if (config.accent_color) root.style.setProperty('--brand-accent', config.accent_color);
    if (config.font_family) root.style.setProperty('--brand-font', config.font_family);
    if (config.company_name) document.title = config.company_name;
    if (config.favicon_url && this._isImageUrl(config.favicon_url)) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = config.favicon_url;
    }
    if (config.logo_url && this._isImageUrl(config.logo_url)) {
      const navLogo = document.getElementById('navbarLogo') || document.querySelector('.navbar-brand img');
      if (navLogo) navLogo.src = config.logo_url;
    }
  },

  /* ---- Logo Upload ---- */

  /**
   * Upload a logo file to storage for the given tenant.
   * Falls back to data-URL conversion if the storage bucket does not exist.
   * @param {string} tenantId - The tenant identifier
   * @param {File} file - The logo image file
   * @returns {Promise<string|null>} Public URL of the uploaded logo, or null on failure
   */
  async uploadLogo(tenantId, file) {
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      utils.showToast('Logo file too large. Maximum size is 5MB.', 'error');
      return null;
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      utils.showToast('Invalid file type. Please upload an image file.', 'error');
      return null;
    }
    try {
      const ext = file.name
        .split('.')
        .pop()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      const path = `${tenantId}/logo-${Date.now()}.${ext}`;
      const uploadResult = await apiClient.upload('brand-assets', path, file, { contentType: file.type });
      utils.showToast('Logo uploaded.', 'success');
      return uploadResult.publicUrl;
    } catch (e) {
      console.error('uploadLogo:', e);
      // Fallback: convert to data URL if storage bucket doesn't exist
      if (
        e.message &&
        (e.message.includes('Bucket not found') ||
          e.message.includes('bucket') ||
          e.message.includes('not found') ||
          e.statusCode === '404')
      ) {
        try {
          const dataUrl = await this._fileToDataUrl(file);
          utils.showToast('Logo set (run migration 038 to enable cloud storage).', 'warning');
          return dataUrl;
        } catch (fallbackErr) {
          console.error('Data URL fallback failed:', fallbackErr);
        }
      }
      utils.showToast('Logo upload failed: ' + e.message, 'error');
      return null;
    }
  },

  /**
   * Convert a File object to a base-64 data URL.
   * @param {File} file - The file to convert
   * @returns {Promise<string>} Data URL string
   */
  _fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /* ---- Email Template Theming ---- */
  /*
   * Header/footer markup mirrors api/email-header.js (the single source
   * of truth for Node back-end paths).  This browser-side copy exists
   * only because we cannot require() a Node module in the browser.
   * If you change the header design, update api/email-header.js FIRST,
   * then mirror the change here.
   */

  /**
   * Build the inner HTML for a branded email header.
   * @param {string} logoUrl - URL to the logo image (empty string for text-only)
   * @param {string} brandName - Company / brand display name
   * @param {string} accentColor - CSS colour for headings and subtitle
   * @param {string} [subtitle] - Optional subtitle text
   * @returns {string} HTML markup
   */
  _buildEmailHeaderContent(logoUrl, brandName, accentColor, subtitle) {
    const sub = subtitle || 'Self-Nomination Entry Confirmation';
    return logoUrl
      ? `<table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>` +
          `<td style="vertical-align:middle;padding-right:25px;"><img src="${logoUrl}" alt="${brandName}" style="height:100px;width:auto;display:block;"></td>` +
          `<td style="vertical-align:middle;"><h1 style="color:${accentColor};margin:0;font-size:28px;font-family:Georgia,'Times New Roman',serif;font-weight:900;letter-spacing:3px;text-transform:uppercase;line-height:1.3;text-shadow:0 2px 8px rgba(0,0,0,0.5);">${brandName}</h1>` +
          `<p style="color:${accentColor};margin:5px 0 0;font-size:14px;font-family:Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;opacity:0.95;font-weight:300;">${sub}</p></td>` +
          `</tr></table>`
      : `<h1 style="color:${accentColor};margin:0;font-size:28px;font-family:Georgia,'Times New Roman',serif;font-weight:900;letter-spacing:3px;text-transform:uppercase;text-shadow:0 2px 8px rgba(0,0,0,0.5);">${brandName}</h1>` +
          `<p style="color:${accentColor};margin:5px 0 0;font-size:14px;font-family:Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;opacity:0.95;font-weight:300;">${sub}</p>`;
  },

  /**
   * Generate CSS, header HTML, and footer HTML for branded emails.
   * @param {string} tenantId - The tenant identifier
   * @param {Object} [config={}] - Branding configuration
   * @param {Object} [options={}] - Extra options (e.g. subtitle)
   * @returns {{css: string, header: string, footer: string}}
   */
  getEmailStyles(tenantId, config = {}, { subtitle } = {}) {
    const p = config.primary_color || '#000000';
    const s = config.secondary_color || '#1a1a1a';
    const a = config.accent_color || '#D4AF37';
    const c = this._esc(config.company_name || 'British Trade Awards');
    const _r = this._esc(config.email_reply_to || config.email_from || '');
    const logoUrl = this._esc(config.logo_url || '');
    const headerContent = this._buildEmailHeaderContent(config.logo_url ? logoUrl : '', c, a, subtitle);
    return {
      css: `.email-header{background:linear-gradient(135deg,${p} 0%,${s} 100%);padding:35px 40px;text-align:center;border-bottom:3px solid ${a}}.email-header img{height:100px;width:auto}.email-btn{background:${a};color:#fff;padding:12px 28px;border-radius:4px;text-decoration:none;font-weight:bold;display:inline-block}.email-footer{background:${s};padding:16px 32px;font-size:12px;color:${a};text-align:center}`,
      header: `<div class="email-header">${headerContent}</div>`,
      footer: `<div class="email-footer"><p style="margin:0;">&copy; ${c} | <a href="https://${this._esc(config.custom_domain || 'britishtradeawards.com')}" style="color:${a};text-decoration:none;">${this._esc(config.custom_domain || 'britishtradeawards.com')}</a></p></div>`,
    };
  },

  /* ---- Public Page Config ---- */

  /**
   * Build a public-page configuration object from branding settings.
   * @param {string} tenantId - The tenant identifier
   * @param {Object} [config={}] - Branding configuration
   * @returns {Object} Public page config with CSS variable string
   */
  getPublicPageConfig(tenantId, config = {}) {
    const d = (k, fb) => config[k] || fb;
    return {
      tenantId,
      company_name: d('company_name', 'British Trade Awards'),
      tagline: d('tagline', ''),
      logo_url: d('logo_url', ''),
      favicon_url: d('favicon_url', ''),
      primary_color: d('primary_color', '#000000'),
      secondary_color: d('secondary_color', '#1a1a1a'),
      accent_color: d('accent_color', '#D4AF37'),
      font_family: d('font_family', "'Montserrat', sans-serif"),
      custom_domain: d('custom_domain', ''),
      cssVars: `--brand-primary:${d('primary_color', '#000000')};--brand-secondary:${d('secondary_color', '#1a1a1a')};--brand-accent:${d('accent_color', '#D4AF37')};--brand-font:${d('font_family', "'Montserrat', sans-serif")}`,
    };
  },

  /* ---- Live Preview ---- */

  /**
   * HTML-escape a string for safe insertion into markup.
   * @param {string} str - The raw string
   * @returns {string} Escaped string
   */
  _esc(str) {
    return utils && utils.escapeHtml
      ? utils.escapeHtml(str)
      : String(str).replace(
          /[&<>"']/g,
          (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
        );
  },

  /**
   * Render a brand-preview card showing navbar, content area and footer.
   * @param {Object} config - Branding configuration
   * @returns {string} HTML markup for the preview card
   */
  renderPreview(config) {
    const p = config.primary_color || '#000000';
    const s = config.secondary_color || '#1a1a1a';
    const a = config.accent_color || '#D4AF37';
    const f = config.font_family || 'inherit';
    const c = this._esc(config.company_name || 'British Trade Awards');
    const t = this._esc(config.tagline || 'Recognising Excellence in British Trade');
    const logoUrl = this._esc(config.logo_url || '');
    const logoHtml = config.logo_url
      ? `<img src="${logoUrl}" alt="logo" style="height:36px;object-fit:contain">`
      : `<div style="width:36px;height:36px;background:rgba(255,255,255,.2);border-radius:4px"></div>`;
    return `<div class="branding-preview-card border rounded overflow-hidden shadow-sm" style="font-family:${f};max-width:360px">
      <div style="background:${p};padding:16px 20px;display:flex;align-items:center;gap:12px">${logoHtml}<div><div style="color:#fff;font-weight:700;font-size:15px">${c}</div><div style="color:rgba(255,255,255,.7);font-size:12px">${t}</div></div></div>
      <div style="background:${s};padding:8px 20px"><span style="color:#fff;font-size:12px;opacity:.9">Navigation bar</span></div>
      <div style="padding:16px 20px;background:#fff"><p style="margin:0 0 12px;font-size:13px;color:#333">Preview of branded content area.</p><button style="background:${a};color:#fff;border:none;padding:8px 18px;border-radius:4px;font-size:13px;cursor:default">Call to Action</button></div>
      <div style="background:#f8f8f8;padding:8px 20px;font-size:11px;color:#888;text-align:center">&copy; ${new Date().getFullYear()} ${c}</div>
    </div>`;
  },

  /* ---- Email Preview (for branding settings page) ---- */

  /**
   * Render a miniature email preview card for the branding settings page.
   * @param {Object} config - Branding configuration
   * @returns {string} HTML markup for the email preview
   */
  renderEmailPreview(config) {
    const p = config.primary_color || '#000000';
    const s = config.secondary_color || '#1a1a1a';
    const a = config.accent_color || '#D4AF37';
    const c = this._esc(config.company_name || 'British Trade Awards');
    const logoUrl = this._esc(config.logo_url || '');
    const r = this._esc(config.email_reply_to || config.email_from || '');
    const headerContent = this._buildEmailHeaderContent(config.logo_url ? logoUrl : '', c, a);
    return `<div style="max-width:360px;border-radius:16px;overflow:hidden;border:2px solid ${a};box-shadow:0 20px 60px rgba(212,175,55,0.3);font-family:Arial,Helvetica,sans-serif;">
      <div style="background:linear-gradient(135deg,${p} 0%,${s} 100%);padding:24px 20px;text-align:center;border-bottom:3px solid ${a};">
        ${headerContent}
      </div>
      <div style="padding:20px 24px;font-size:13px;color:#333;line-height:1.5;">
        <p style="margin:0 0 8px;font-weight:600;color:#1a1a1a;">Entry Confirmation</p>
        <p style="margin:0 0 6px;">Dear Applicant,</p>
        <p style="margin:0;color:#666;">Thank you for entering the ${c}. Your entry has been received...</p>
      </div>
      <div style="background:${s};padding:12px 24px;text-align:center;font-size:11px;color:#999;">
        <p style="margin:0;">${c}${r ? ' | <a href="#" style="color:' + a + ';text-decoration:none;">' + r + '</a>' : ''}</p>
      </div>
    </div>`;
  },

  /* ---- Settings Form ---- */

  /**
   * Render the full branding settings form and previews into the DOM.
   * @param {string} tenantId - The tenant identifier
   * @returns {Promise<void>}
   */
  async renderBrandSettings(tenantId) {
    const container = document.getElementById('brandingSettingsContainer');
    if (!container) {
      console.warn('brandingSettingsContainer not found');
      return;
    }

    let cur;
    try {
      cur = await this.loadBranding(tenantId);
    } catch (e) {
      console.error('renderBrandSettings failed:', e);
      container.innerHTML = `<div class="alert alert-warning"><i class="bi bi-exclamation-triangle me-2"></i><strong>Branding:</strong> Could not load branding settings. The <code>tenant_branding</code> table may not exist yet. Check your Supabase migrations.</div>`;
      return;
    }
    const presets = this.getPresets();
    const fontOptions = [
      ["'Montserrat', sans-serif", 'Montserrat'],
      ["'Cinzel', serif", 'Cinzel'],
      ['inherit', 'System Default'],
      ["'Segoe UI', sans-serif", 'Segoe UI'],
      ['Georgia, serif', 'Georgia'],
      ["'Palatino Linotype', serif", 'Palatino'],
      ["'Helvetica Neue', sans-serif", 'Helvetica Neue'],
      ["'Arial', sans-serif", 'Arial'],
    ]
      .map(
        ([v, l]) =>
          `<option value="${v}" ${(cur.font_family || "'Montserrat', sans-serif") === v ? 'selected' : ''}>${l}</option>`
      )
      .join('');

    const presetItems = presets
      .map(
        (p) =>
          `<li><a class="dropdown-item branding-preset-btn" href="#" data-preset='${JSON.stringify(p)}'>${p.name}</a></li>`
      )
      .join('');

    const esc = (v) => this._esc(v);
    const field = (label, id, type, value, placeholder = '') =>
      `<div class="mb-3"><label class="form-label">${label}</label><input type="${type}" class="form-control${type === 'color' ? ' form-control-color' : ''}" id="${id}" value="${esc(value)}"${placeholder ? ` placeholder="${placeholder}"` : ''} ${type === 'color' ? 'style="width:100%"' : ''}></div>`;

    container.innerHTML = `<div class="row g-4">
      <div class="col-lg-7"><div class="card"><div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="mb-0">Brand Settings</h5>
        <div class="btn-group btn-group-sm"><button class="btn btn-outline-secondary btn-sm dropdown-toggle" data-bs-toggle="dropdown" data-bs-display="static"><i class="bi bi-palette me-1"></i>Load Preset</button>
        <ul class="dropdown-menu dropdown-menu-end">${presetItems}</ul></div></div>
        <div class="card-body"><form id="brandingForm" novalidate>
          <h6 class="text-muted fw-semibold mb-3">Identity</h6>
          ${field('Company Name', 'bf_company_name', 'text', cur.company_name || '')}
          ${field('Tagline', 'bf_tagline', 'text', cur.tagline || '')}
          <h6 class="text-muted fw-semibold mt-3 mb-3">Assets</h6>
          <div class="mb-3"><label class="form-label">Logo URL</label>
            <div class="input-group"><input type="url" class="form-control" id="bf_logo_url" value="${esc(cur.logo_url || '')}" placeholder="https://...">
            <label class="btn btn-outline-secondary mb-0" for="bf_logo_file">Upload</label>
            <input type="file" id="bf_logo_file" class="d-none" accept="image/*"></div></div>
          ${field('Favicon URL', 'bf_favicon_url', 'url', cur.favicon_url || '', 'https://...')}
          <h6 class="text-muted fw-semibold mt-3 mb-3">Colours</h6>
          <div class="row g-3 mb-3">
            <div class="col-4"><label class="form-label">Primary</label><input type="color" class="form-control form-control-color w-100" id="bf_primary_color" value="${cur.primary_color || '#000000'}"></div>
            <div class="col-4"><label class="form-label">Secondary</label><input type="color" class="form-control form-control-color w-100" id="bf_secondary_color" value="${cur.secondary_color || '#1a1a1a'}"></div>
            <div class="col-4"><label class="form-label">Accent</label><input type="color" class="form-control form-control-color w-100" id="bf_accent_color" value="${cur.accent_color || '#D4AF37'}"></div>
          </div>
          <h6 class="text-muted fw-semibold mt-3 mb-3">Typography</h6>
          <div class="mb-3"><label class="form-label">Font Family</label><select class="form-select" id="bf_font_family">${fontOptions}</select></div>
          <h6 class="text-muted fw-semibold mt-3 mb-3">Email</h6>
          ${field('From Address', 'bf_email_from', 'email', cur.email_from || '')}
          ${field('Reply-To Address', 'bf_email_reply_to', 'email', cur.email_reply_to || '')}
          <h6 class="text-muted fw-semibold mt-3 mb-3">Domain</h6>
          <div class="mb-3"><label class="form-label">Custom Domain <span class="badge bg-secondary">Display only</span></label>
            <input type="text" class="form-control" id="bf_custom_domain" value="${esc(cur.custom_domain || '')}" readonly>
            <div class="form-text">Configure via DNS settings. Contact support to change.</div></div>
          <div class="d-flex gap-2 mt-4">
            <button type="submit" class="btn btn-primary">Save Branding</button>
            <button type="button" class="btn btn-outline-secondary" id="bf_preview_btn">Apply Preview</button>
          </div>
        </form></div></div></div>
      <div class="col-lg-5">
        <div class="card"><div class="card-header"><h5 class="mb-0">Live Preview</h5></div>
          <div class="card-body" id="bf_preview_panel">${this.renderPreview(cur)}</div>
        </div>
        <div class="card mt-3"><div class="card-header"><h5 class="mb-0">Email Preview</h5></div>
          <div class="card-body" id="bf_email_preview_panel">${this.renderEmailPreview(cur)}</div>
        </div>
      </div>
    </div>`;

    this._bindFormEvents(container, tenantId);
  },

  /* ---- Internal helpers ---- */

  /**
   * Collect all branding form field values into a config object.
   * @returns {Object} Branding configuration gathered from the form
   */
  _collect() {
    const v = (id) => (document.getElementById(id) || {}).value || '';
    return {
      company_name: v('bf_company_name'),
      tagline: v('bf_tagline'),
      logo_url: v('bf_logo_url'),
      favicon_url: v('bf_favicon_url'),
      primary_color: v('bf_primary_color'),
      secondary_color: v('bf_secondary_color'),
      accent_color: v('bf_accent_color'),
      font_family: v('bf_font_family'),
      email_from: v('bf_email_from'),
      email_reply_to: v('bf_email_reply_to'),
    };
  },

  /**
   * Re-render both preview panels using the current form values.
   * @returns {void}
   */
  _refreshPreview() {
    const config = this._collect();
    const panel = document.getElementById('bf_preview_panel');
    if (panel) panel.innerHTML = this.renderPreview(config);
    const emailPanel = document.getElementById('bf_email_preview_panel');
    if (emailPanel) emailPanel.innerHTML = this.renderEmailPreview(config);
  },

  /**
   * Wire up event listeners for the branding settings form.
   * @param {HTMLElement} container - The container element holding the form
   * @param {string} tenantId - The tenant identifier
   * @returns {void}
   */
  _bindFormEvents(container, tenantId) {
    [
      'bf_primary_color',
      'bf_secondary_color',
      'bf_accent_color',
      'bf_font_family',
      'bf_company_name',
      'bf_tagline',
      'bf_logo_url',
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this._refreshPreview());
    });

    const previewBtn = document.getElementById('bf_preview_btn');
    if (previewBtn)
      previewBtn.addEventListener('click', () => {
        this.applyBranding(this._collect());
        this._refreshPreview();
      });

    const fileInput = document.getElementById('bf_logo_file');
    if (fileInput)
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const url = await this.uploadLogo(tenantId, file);
        if (url) {
          document.getElementById('bf_logo_url').value = url;
          this._refreshPreview();
        }
      });

    container.querySelectorAll('.branding-preset-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const preset = JSON.parse(btn.dataset.preset);
        ['primary_color', 'secondary_color', 'accent_color', 'font_family'].forEach((k) => {
          const el = document.getElementById('bf_' + k);
          if (el) el.value = preset[k];
        });
        this._refreshPreview();
      });
    });

    const form = document.getElementById('brandingForm');
    if (form)
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const config = this._collect();
        const ok = await this.saveBranding(tenantId, config);
        if (ok) this.applyBranding(config);
      });
  },
};
ModuleRegistry.register('brandingModule', brandingModule);

export { brandingModule };
