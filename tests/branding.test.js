/**
 * Tests for the Branding Module (branding.js)
 * Run with: npx jest tests/branding.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(
  `<!DOCTYPE html><html><head></head><body>
  <div id="loadingBar" style="display:none;"></div>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
  <div id="connectionStatus"><span class="status-icon"></span><span class="status-text"></span></div>
  <div id="loginPage"></div><div id="dashboardPage"></div><div id="splashScreen"></div>
  <div id="userEmail"></div><div id="loginEmail"></div><div id="loginPassword"></div>
  <div id="loginError" class="d-none"></div><div id="loginBtn"></div>
  <table><tbody id="awardsTableBody"></tbody></table>
  <table><tbody id="orgsTableBody"></tbody></table>
  <table><tbody id="winnersTableBody"></tbody></table>
  <table><tbody id="eventsTableBody"></tbody></table>
  <table><tbody id="entriesTableBody"></tbody></table>
  <span id="awardsCount"></span><span id="eventsCount"></span><span id="winnersCount"></span>
  <img id="navbarLogo" src="">
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.FileReader = dom.window.FileReader;

global.bootstrap = {
  Toast: class {
    show() {}
    hide() {}
  },
  Modal: class {
    show() {}
    hide() {}
    static getInstance() {
      return { hide() {} };
    }
  },
  Tooltip: class {},
};

const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  upsert: jest.fn(() => Promise.resolve({ error: null })),
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  range: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn((cb) => cb({ data: [], error: null })),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(() => Promise.resolve({ error: null })),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://cdn.example.com/logo.png' } })),
    })),
  },
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
  },
  channel: jest.fn(() => ({
    on: jest.fn(function () {
      return this;
    }),
    subscribe: jest.fn(function () {
      return this;
    }),
  })),
};
global.supabase = { createClient: () => mockSupabase };
global.window.supabase = global.supabase;

require('../config.js');
global.STATE = global.window.STATE;
global.SUPABASE_CONFIG = global.window.SUPABASE_CONFIG;
global.STATUS = global.window.STATUS;
global.MEDIA_TYPES = global.window.MEDIA_TYPES;
global.INACTIVITY_TIMEOUT = global.window.INACTIVITY_TIMEOUT;
global.YEARS = global.window.YEARS;
global.SECTORS = global.window.SECTORS;
global.REGIONS = global.window.REGIONS;
global.STATE.client = mockSupabase;

function syncWindowToGlobal() {
  for (const key of Object.keys(global.window)) {
    if (!(key in global) && typeof global.window[key] !== 'undefined') global[key] = global.window[key];
  }
}

require('../utils.js');
syncWindowToGlobal();
require('../branding.js');
syncWindowToGlobal();

// Replace the real apiClient with jest mocks after modules are loaded
global.apiClient = {
  ...global.apiClient,
  select: jest.fn(() => Promise.resolve({ data: [], error: null })),
  upsert: jest.fn(() => Promise.resolve({ data: null, error: null })),
  upload: jest.fn(() => Promise.resolve({ publicUrl: 'https://cdn.example.com/logo.png' })),
};
// Also update window so branding.js sees the mock via the global scope
global.window.apiClient = global.apiClient;

describe('Branding Module - Structure', () => {
  test('brandingModule is defined', () => {
    expect(brandingModule).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof brandingModule.getPresets).toBe('function');
    expect(typeof brandingModule.loadBranding).toBe('function');
    expect(typeof brandingModule.saveBranding).toBe('function');
    expect(typeof brandingModule.applyBranding).toBe('function');
    expect(typeof brandingModule.uploadLogo).toBe('function');
    expect(typeof brandingModule.renderPreview).toBe('function');
    expect(typeof brandingModule.getEmailStyles).toBe('function');
    expect(typeof brandingModule.getPublicPageConfig).toBe('function');
  });
});

describe('Branding Module - getPresets', () => {
  test('returns array of presets', () => {
    const presets = brandingModule.getPresets();
    expect(Array.isArray(presets)).toBe(true);
    expect(presets.length).toBeGreaterThan(0);
    expect(presets[0]).toHaveProperty('id');
    expect(presets[0]).toHaveProperty('name');
    expect(presets[0]).toHaveProperty('primary_color');
  });

  test('presets include BTA Official', () => {
    const presets = brandingModule.getPresets();
    const bta = presets.find((p) => p.id === 'bta-official');
    expect(bta).toBeDefined();
    expect(bta.primary_color).toBe('#000000');
  });
});

describe('Branding Module - applyBranding', () => {
  test('sets CSS variables on document root', () => {
    brandingModule.applyBranding({
      primary_color: '#ff0000',
      secondary_color: '#00ff00',
      accent_color: '#0000ff',
      font_family: 'Arial, sans-serif',
    });
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--brand-primary')).toBe('#ff0000');
    expect(root.style.getPropertyValue('--brand-secondary')).toBe('#00ff00');
    expect(root.style.getPropertyValue('--brand-accent')).toBe('#0000ff');
    expect(root.style.getPropertyValue('--brand-font')).toBe('Arial, sans-serif');
  });

  test('sets document title from company_name', () => {
    brandingModule.applyBranding({ company_name: 'Test Awards' });
    expect(document.title).toBe('Test Awards');
  });

  test('does nothing when config is empty', () => {
    expect(() => brandingModule.applyBranding({})).not.toThrow();
    expect(() => brandingModule.applyBranding(null)).not.toThrow();
  });

  test('sets navbar logo when logo_url provided', () => {
    brandingModule.applyBranding({ logo_url: 'https://cdn.example.com/logo.png' });
    const navLogo = document.getElementById('navbarLogo');
    expect(navLogo.src).toBe('https://cdn.example.com/logo.png');
  });
});

describe('Branding Module - renderPreview', () => {
  test('returns HTML string with branding colors', () => {
    const html = brandingModule.renderPreview({
      primary_color: '#111111',
      secondary_color: '#222222',
      accent_color: '#333333',
      company_name: 'Preview Co',
      tagline: 'Testing tagline',
    });
    expect(html).toContain('Preview Co');
    expect(html).toContain('Testing tagline');
    expect(html).toContain('#111111');
    expect(html).toContain('#333333');
  });
});

describe('Branding Module - getEmailStyles', () => {
  test('returns css, header, and footer', () => {
    const styles = brandingModule.getEmailStyles('t1', {
      primary_color: '#000',
      accent_color: '#D4AF37',
      company_name: 'BTA',
    });
    expect(styles).toHaveProperty('css');
    expect(styles).toHaveProperty('header');
    expect(styles).toHaveProperty('footer');
    expect(styles.footer).toContain('BTA');
  });
});

describe('Branding Module - getPublicPageConfig', () => {
  test('returns config with defaults', () => {
    const config = brandingModule.getPublicPageConfig('t1', {});
    expect(config.company_name).toBe('British Trade Awards');
    expect(config.primary_color).toBe('#000000');
    expect(config.accent_color).toBe('#D4AF37');
  });

  test('overrides defaults with provided config', () => {
    const config = brandingModule.getPublicPageConfig('t1', { company_name: 'Custom Awards' });
    expect(config.company_name).toBe('Custom Awards');
  });
});

describe('Branding Module - loadBranding', () => {
  beforeEach(() => {
    global.apiClient.select.mockClear();
  });

  test('calls apiClient.select with correct params', async () => {
    global.apiClient.select.mockResolvedValue({ data: [{ primary_color: '#ff0000' }], error: null });
    const result = await brandingModule.loadBranding('t1');
    expect(global.apiClient.select).toHaveBeenCalledWith('tenant_branding', {
      select: '*',
      filters: { tenant_id: { operator: 'eq', value: 't1' } },
      pageSize: 1,
    });
    expect(result.primary_color).toBe('#ff0000');
  });

  test('returns empty object when no data', async () => {
    global.apiClient.select.mockResolvedValue({ data: [], error: null });
    const result = await brandingModule.loadBranding('t1');
    expect(result).toEqual({});
  });

  test('returns empty object when data is null', async () => {
    global.apiClient.select.mockResolvedValue({ data: null, error: null });
    const result = await brandingModule.loadBranding('t1');
    expect(result).toEqual({});
  });
});

describe('Branding Module - saveBranding', () => {
  beforeEach(() => {
    global.apiClient.upsert.mockClear();
  });

  test('calls apiClient.upsert and returns true on success', async () => {
    global.apiClient.upsert.mockResolvedValue({ data: null, error: null });
    const result = await brandingModule.saveBranding('t1', { primary_color: '#ff0000' });
    expect(global.apiClient.upsert).toHaveBeenCalledWith(
      'tenant_branding',
      expect.objectContaining({ tenant_id: 't1', primary_color: '#ff0000' })
    );
    expect(result).toBe(true);
  });

  test('returns false on error', async () => {
    global.apiClient.upsert.mockRejectedValue(new Error('DB error'));
    const result = await brandingModule.saveBranding('t1', {});
    expect(result).toBe(false);
  });
});

describe('Branding Module - uploadLogo', () => {
  test('rejects file too large', async () => {
    const file = { name: 'big.png', size: 10 * 1024 * 1024, type: 'image/png' };
    const result = await brandingModule.uploadLogo('t1', file);
    expect(result).toBeNull();
  });

  test('rejects invalid file type', async () => {
    const file = { name: 'script.exe', size: 100, type: 'application/x-msdownload' };
    const result = await brandingModule.uploadLogo('t1', file);
    expect(result).toBeNull();
  });
});
