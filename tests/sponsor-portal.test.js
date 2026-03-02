/**
 * Tests for the Sponsor Portal Module (sponsor-portal.js)
 * Run with: npx jest tests/sponsor-portal.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(
  `<!DOCTYPE html><html><body>
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
  <div id="sponsorDashboard"></div>
  <div id="tierManagement"></div>
  <div id="sponsorContracts"></div>
  <input type="file" id="sponsorAssetFile" accept="image/*,.pdf">
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;

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
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  range: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn((cb) => cb({ data: [], error: null })),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(() => Promise.resolve({ error: null })),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://cdn.example.com/asset.png' } })),
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
require('../sponsor-portal.js');
syncWindowToGlobal();

describe('Sponsor Portal - Structure', () => {
  test('sponsorPortalModule is defined', () => {
    expect(sponsorPortalModule).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof sponsorPortalModule.renderSponsorDashboard).toBe('function');
    expect(typeof sponsorPortalModule.uploadSponsorAsset).toBe('function');
    expect(typeof sponsorPortalModule.trackImpression).toBe('function');
    expect(typeof sponsorPortalModule.getImpressionStats).toBe('function');
    expect(typeof sponsorPortalModule.renderTierManagement).toBe('function');
    expect(typeof sponsorPortalModule.changeTier).toBe('function');
    expect(typeof sponsorPortalModule.renderContracts).toBe('function');
    expect(typeof sponsorPortalModule.calculateROI).toBe('function');
  });

  test('has TIERS definition', () => {
    expect(sponsorPortalModule.TIERS).toBeDefined();
    expect(sponsorPortalModule.TIERS.Gold).toBeDefined();
    expect(sponsorPortalModule.TIERS.Silver).toBeDefined();
    expect(sponsorPortalModule.TIERS.Bronze).toBeDefined();
  });
});

describe('Sponsor Portal - TIERS', () => {
  test('Gold tier has correct badge', () => {
    expect(sponsorPortalModule.TIERS.Gold.badge).toBe('warning');
    expect(sponsorPortalModule.TIERS.Gold.benefits.length).toBeGreaterThan(0);
  });

  test('Silver tier has correct badge', () => {
    expect(sponsorPortalModule.TIERS.Silver.badge).toBe('secondary');
    expect(sponsorPortalModule.TIERS.Silver.benefits.length).toBeGreaterThan(0);
  });

  test('Bronze tier has correct badge', () => {
    expect(sponsorPortalModule.TIERS.Bronze.badge).toBe('danger');
    expect(sponsorPortalModule.TIERS.Bronze.benefits.length).toBeGreaterThan(0);
  });

  test('tiers have expected benefits structure', () => {
    Object.values(sponsorPortalModule.TIERS).forEach((tier) => {
      expect(Array.isArray(tier.benefits)).toBe(true);
      expect(tier.benefits.length).toBeGreaterThan(0);
      tier.benefits.forEach((b) => expect(typeof b).toBe('string'));
    });
  });
});

describe('Sponsor Portal - uploadSponsorAsset', () => {
  test('warns when no file provided', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    const result = await sponsorPortalModule.uploadSponsorAsset('s1', null);
    expect(result).toBeNull();
    expect(toastSpy).toHaveBeenCalledWith('Please select a file first', 'warning');
    toastSpy.mockRestore();
  });

  test('rejects file too large (>10MB)', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    const file = { name: 'huge.png', size: 11 * 1024 * 1024, type: 'image/png' };
    const result = await sponsorPortalModule.uploadSponsorAsset('s1', file);
    expect(result).toBeNull();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('10MB'), 'error');
    toastSpy.mockRestore();
  });

  test('rejects invalid file type', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    const file = { name: 'malware.exe', size: 1000, type: 'application/x-msdownload' };
    const result = await sponsorPortalModule.uploadSponsorAsset('s1', file);
    expect(result).toBeNull();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid file type'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Sponsor Portal - getImpressionStats', () => {
  test('returns stats with empty data', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    const stats = await sponsorPortalModule.getImpressionStats('s1');
    expect(stats.total).toBe(0);
    expect(stats.thisMonth).toBe(0);
    expect(stats.byPage).toEqual({});
  });

  test('counts impressions correctly', async () => {
    const now = new Date();
    apiClient.selectAll = jest.fn().mockResolvedValue([
      { tracked_at: now.toISOString(), page: '/home' },
      { tracked_at: now.toISOString(), page: '/home' },
      { tracked_at: now.toISOString(), page: '/sponsors' },
    ]);
    const stats = await sponsorPortalModule.getImpressionStats('s1');
    expect(stats.total).toBe(3);
    expect(stats.byPage['/home']).toBe(2);
    expect(stats.byPage['/sponsors']).toBe(1);
  });

  test('returns defaults on error', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('DB error'));
    const stats = await sponsorPortalModule.getImpressionStats('s1');
    expect(stats.total).toBe(0);
    expect(stats.thisMonth).toBe(0);
  });
});

describe('Sponsor Portal - trackImpression', () => {
  test('logs impression without throwing', async () => {
    apiClient.insert = jest.fn().mockResolvedValue({});
    await expect(sponsorPortalModule.trackImpression('s1', '/home')).resolves.not.toThrow();
  });

  test('handles error silently', async () => {
    apiClient.insert = jest.fn().mockRejectedValue(new Error('fail'));
    await expect(sponsorPortalModule.trackImpression('s1', '/home')).resolves.not.toThrow();
  });

  test('uses location.pathname when page not provided', async () => {
    apiClient.insert = jest.fn().mockResolvedValue({});
    await sponsorPortalModule.trackImpression('s1');
    expect(apiClient.insert).toHaveBeenCalledWith(
      'sponsor_impressions',
      expect.objectContaining({
        sponsor_id: 's1',
      })
    );
  });
});

describe('Sponsor Portal - renderSponsorDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders dashboard with sponsor data', async () => {
    apiClient.select = jest
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            id: 's1',
            name: 'Gold Corp',
            tier: 'Gold',
            logo_url: 'https://logo.com/img.png',
            description: 'Leading sponsor',
          },
        ],
      })
      .mockResolvedValueOnce({
        data: [{ id: 'c1', status: 'Active', start_date: '2026-01-01', end_date: '2026-12-31', amount: 5000 }],
      })
      .mockResolvedValueOnce({
        data: [{ amount: 5000 }],
      });
    apiClient.selectAll = jest.fn().mockResolvedValue([
      { tracked_at: new Date().toISOString(), page: '/home' },
      { tracked_at: new Date().toISOString(), page: '/home' },
    ]);

    await sponsorPortalModule.renderSponsorDashboard('s1');
    const el = document.getElementById('sponsorDashboard');
    expect(el.innerHTML).toContain('Gold Corp');
    expect(el.innerHTML).toContain('Gold Sponsor');
    expect(el.innerHTML).toContain('Contract Details');
    expect(el.innerHTML).toContain('Impression Stats');
    expect(el.innerHTML).toContain('Tier Benefits');
    expect(el.innerHTML).toContain('Upload Logo');
  });

  test('renders dashboard without logo', async () => {
    apiClient.select = jest
      .fn()
      .mockResolvedValueOnce({
        data: [{ id: 's1', name: 'Bronze Corp', tier: 'Bronze', logo_url: null, description: '' }],
      })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] });
    apiClient.selectAll = jest.fn().mockResolvedValue([]);

    await sponsorPortalModule.renderSponsorDashboard('s1');
    const el = document.getElementById('sponsorDashboard');
    expect(el.innerHTML).toContain('Bronze Corp');
    expect(el.innerHTML).toContain('bi-building');
    expect(el.innerHTML).toContain('No active contract');
  });

  test('shows error when sponsor not found', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    const toastSpy = jest.spyOn(utils, 'showToast');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    await sponsorPortalModule.renderSponsorDashboard('missing');
    expect(toastSpy).toHaveBeenCalledWith('Failed to load sponsor dashboard', 'error');
    toastSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  test('returns early when container not found', async () => {
    const el = document.getElementById('sponsorDashboard');
    el.id = 'hidden';
    const result = await sponsorPortalModule.renderSponsorDashboard('s1');
    expect(result).toBeUndefined();
    el.id = 'sponsorDashboard';
  });

  test('uses fallback tier when unknown tier', async () => {
    apiClient.select = jest
      .fn()
      .mockResolvedValueOnce({
        data: [{ id: 's1', name: 'Unknown Corp', tier: 'Diamond', logo_url: null, description: '' }],
      })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] });
    apiClient.selectAll = jest.fn().mockResolvedValue([]);

    await sponsorPortalModule.renderSponsorDashboard('s1');
    const el = document.getElementById('sponsorDashboard');
    // Should use Bronze as fallback tier
    expect(el.innerHTML).toContain('Diamond Sponsor');
  });
});

describe('Sponsor Portal - uploadSponsorAsset success', () => {
  test('uploads valid file', async () => {
    const file = { name: 'logo.png', size: 500000, type: 'image/png' };
    STATE.client.storage = {
      from: jest.fn(() => ({
        upload: jest.fn(() => Promise.resolve({ error: null })),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://cdn.example.com/uploaded.png' } })),
      })),
    };
    apiClient.update = jest.fn().mockResolvedValue({});
    const toastSpy = jest.spyOn(utils, 'showToast');

    const result = await sponsorPortalModule.uploadSponsorAsset('s1', file);
    expect(result).toBe('https://cdn.example.com/uploaded.png');
    expect(toastSpy).toHaveBeenCalledWith('Asset uploaded successfully', 'success');
    toastSpy.mockRestore();
  });

  test('handles upload storage error', async () => {
    const file = { name: 'logo.png', size: 500000, type: 'image/png' };
    STATE.client.storage = {
      from: jest.fn(() => ({
        upload: jest.fn(() => Promise.resolve({ error: new Error('Storage full') })),
        getPublicUrl: jest.fn(),
      })),
    };
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const toastSpy = jest.spyOn(utils, 'showToast');

    const result = await sponsorPortalModule.uploadSponsorAsset('s1', file);
    expect(result).toBeNull();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Upload failed'), 'error');
    consoleSpy.mockRestore();
    toastSpy.mockRestore();
  });
});

describe('Sponsor Portal - uploadSponsorAssetFromInput', () => {
  test('calls uploadSponsorAsset with file from input', () => {
    sponsorPortalModule.uploadSponsorAsset = jest.fn();
    // Mock file input
    const input = document.getElementById('sponsorAssetFile');
    Object.defineProperty(input, 'files', {
      value: [{ name: 'test.png', size: 100, type: 'image/png' }],
      writable: true,
    });
    sponsorPortalModule.uploadSponsorAssetFromInput('s1');
    expect(sponsorPortalModule.uploadSponsorAsset).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({
        name: 'test.png',
      })
    );
  });
});

describe('Sponsor Portal - renderTierManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders tier management with grouped sponsors', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([
      { id: 's1', name: 'Gold Corp', tier: 'Gold', is_active: true, display_order: 1 },
      { id: 's2', name: 'Silver Corp', tier: 'Silver', is_active: false, display_order: 2 },
      { id: 's3', name: 'Bronze Corp', tier: 'Bronze', is_active: true, display_order: 3 },
    ]);
    await sponsorPortalModule.renderTierManagement();
    const el = document.getElementById('tierManagement');
    expect(el.innerHTML).toContain('Gold Tier');
    expect(el.innerHTML).toContain('Silver Tier');
    expect(el.innerHTML).toContain('Bronze Tier');
    expect(el.innerHTML).toContain('Gold Corp');
    expect(el.innerHTML).toContain('Silver Corp');
    expect(el.innerHTML).toContain('Bronze Corp');
    expect(el.innerHTML).toContain('Active');
    expect(el.innerHTML).toContain('Inactive');
  });

  test('shows empty tier message', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    await sponsorPortalModule.renderTierManagement();
    const el = document.getElementById('tierManagement');
    expect(el.innerHTML).toContain('No sponsors in this tier');
  });

  test('handles error', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('fail'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const toastSpy = jest.spyOn(utils, 'showToast');
    await sponsorPortalModule.renderTierManagement();
    expect(toastSpy).toHaveBeenCalledWith('Failed to load tier management', 'error');
    consoleSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('returns early when container not found', async () => {
    const el = document.getElementById('tierManagement');
    el.id = 'hidden';
    const result = await sponsorPortalModule.renderTierManagement();
    expect(result).toBeUndefined();
    el.id = 'tierManagement';
  });
});

describe('Sponsor Portal - changeTier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('warns on invalid tier', async () => {
    global.prompt = jest.fn().mockReturnValue('Diamond');
    const toastSpy = jest.spyOn(utils, 'showToast');
    await sponsorPortalModule.changeTier('s1', 'Gold');
    expect(toastSpy).toHaveBeenCalledWith('Invalid tier selected', 'warning');
    toastSpy.mockRestore();
  });

  test('warns on null prompt', async () => {
    global.prompt = jest.fn().mockReturnValue(null);
    const toastSpy = jest.spyOn(utils, 'showToast');
    await sponsorPortalModule.changeTier('s1', 'Gold');
    expect(toastSpy).toHaveBeenCalledWith('Invalid tier selected', 'warning');
    toastSpy.mockRestore();
  });

  test('updates tier successfully', async () => {
    global.prompt = jest.fn().mockReturnValue('Silver');
    apiClient.update = jest.fn().mockResolvedValue({});
    sponsorPortalModule.renderTierManagement = jest.fn();
    const toastSpy = jest.spyOn(utils, 'showToast');

    await sponsorPortalModule.changeTier('s1', 'Gold');
    expect(apiClient.update).toHaveBeenCalledWith('sponsors', 's1', { tier: 'Silver' });
    expect(toastSpy).toHaveBeenCalledWith('Tier updated to Silver', 'success');
    toastSpy.mockRestore();
  });

  test('handles update error', async () => {
    global.prompt = jest.fn().mockReturnValue('Bronze');
    apiClient.update = jest.fn().mockRejectedValue(new Error('Update failed'));
    const toastSpy = jest.spyOn(utils, 'showToast');

    await sponsorPortalModule.changeTier('s1', 'Gold');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to update tier'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Sponsor Portal - renderContracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders contracts table', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([
      {
        id: 'c1',
        sponsor_id: 's1',
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        amount: 5000,
        status: 'Active',
        benefits: 'Logo placement',
        sponsors: { name: 'Gold Corp', tier: 'Gold' },
      },
    ]);
    await sponsorPortalModule.renderContracts();
    const el = document.getElementById('sponsorContracts');
    expect(el.innerHTML).toContain('Sponsor Contracts');
    expect(el.innerHTML).toContain('Gold Corp');
    expect(el.innerHTML).toContain('Logo placement');
    expect(el.innerHTML).toContain('New Contract');
  });

  test('shows empty state', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    await sponsorPortalModule.renderContracts();
    const el = document.getElementById('sponsorContracts');
    expect(el.innerHTML).toContain('No contracts found');
  });

  test('handles error', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('fail'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const toastSpy = jest.spyOn(utils, 'showToast');
    await sponsorPortalModule.renderContracts();
    expect(toastSpy).toHaveBeenCalledWith('Failed to load contracts', 'error');
    consoleSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('returns early when container not found', async () => {
    const el = document.getElementById('sponsorContracts');
    el.id = 'hidden';
    const result = await sponsorPortalModule.renderContracts();
    expect(result).toBeUndefined();
    el.id = 'sponsorContracts';
  });
});

describe('Sponsor Portal - saveContract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up contract form elements
    const fields = [
      { id: 'contractId', tag: 'input', type: 'hidden', val: '' },
      { id: 'contractSponsor', tag: 'select', val: 's1', options: ['s1', 's2'] },
      { id: 'contractStart', tag: 'input', type: 'date', val: '2026-01-01' },
      { id: 'contractEnd', tag: 'input', type: 'date', val: '2026-12-31' },
      { id: 'contractAmount', tag: 'input', type: 'number', val: '5000' },
      { id: 'contractStatus', tag: 'select', val: 'Active', options: ['Active', 'Expired', 'Pending'] },
      { id: 'contractBenefits', tag: 'textarea', val: 'Logo' },
      { id: 'contractModal', tag: 'div' },
      { id: 'contractModalTitle', tag: 'h5' },
      { id: 'contractModalBody', tag: 'div' },
    ];
    for (const f of fields) {
      let el = document.getElementById(f.id);
      if (!el) {
        el = document.createElement(f.tag || 'input');
        el.id = f.id;
        document.body.appendChild(el);
      }
      if (f.options) {
        el.innerHTML = f.options.map((o) => `<option value="${o}">${o}</option>`).join('');
      }
      if (f.val !== undefined) el.value = f.val;
    }
  });

  test('inserts new contract', async () => {
    apiClient.insert = jest.fn().mockResolvedValue({});
    sponsorPortalModule.renderContracts = jest.fn();
    const toastSpy = jest.spyOn(utils, 'showToast');

    await sponsorPortalModule.saveContract();
    expect(apiClient.insert).toHaveBeenCalledWith(
      'sponsor_contracts',
      expect.objectContaining({
        sponsor_id: 's1',
        amount: 5000,
        status: 'Active',
      })
    );
    expect(toastSpy).toHaveBeenCalledWith('Contract created', 'success');
    toastSpy.mockRestore();
  });

  test('updates existing contract', async () => {
    document.getElementById('contractId').value = 'c-existing';
    apiClient.update = jest.fn().mockResolvedValue({});
    sponsorPortalModule.renderContracts = jest.fn();
    const toastSpy = jest.spyOn(utils, 'showToast');

    await sponsorPortalModule.saveContract();
    expect(apiClient.update).toHaveBeenCalledWith('sponsor_contracts', 'c-existing', expect.any(Object));
    expect(toastSpy).toHaveBeenCalledWith('Contract updated', 'success');
    toastSpy.mockRestore();
  });

  test('falls back to localStorage on DB error', async () => {
    global.crypto = { randomUUID: () => 'test-uuid' };
    apiClient.insert = jest.fn().mockRejectedValue(new Error('DB error'));
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    sponsorPortalModule.renderContracts = jest.fn();

    await sponsorPortalModule.saveContract();
    const stored = JSON.parse(localStorage.getItem('bta_sponsor_contracts') || '[]');
    expect(stored.length).toBeGreaterThan(0);
    consoleSpy.mockRestore();
    localStorage.removeItem('bta_sponsor_contracts');
  });
});

describe('Sponsor Portal - deleteContract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does nothing when user cancels', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(false);
    apiClient.delete = jest.fn();
    await sponsorPortalModule.deleteContract('c1');
    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  test('deletes contract on confirm', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.delete = jest.fn().mockResolvedValue({});
    sponsorPortalModule.renderContracts = jest.fn();
    const toastSpy = jest.spyOn(utils, 'showToast');

    await sponsorPortalModule.deleteContract('c1');
    expect(apiClient.delete).toHaveBeenCalledWith('sponsor_contracts', 'c1');
    expect(toastSpy).toHaveBeenCalledWith('Contract deleted', 'success');
    toastSpy.mockRestore();
  });

  test('handles delete error', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.delete = jest.fn().mockRejectedValue(new Error('FK violation'));
    const toastSpy = jest.spyOn(utils, 'showToast');

    await sponsorPortalModule.deleteContract('c1');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to delete contract'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Sponsor Portal - renderSponsorWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    let el = document.getElementById('sponsorWidget');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sponsorWidget';
      document.body.appendChild(el);
    }
  });

  afterEach(() => {
    const el = document.getElementById('sponsorWidget');
    if (el) el.remove();
  });

  test('renders sponsor logos', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([
      { id: 's1', name: 'Gold Corp', logo_url: 'https://logo.com/gold.png', website: 'https://gold.com', tier: 'Gold' },
      { id: 's2', name: 'Silver Corp', logo_url: null, website: null, tier: 'Silver' },
    ]);
    apiClient.insert = jest.fn().mockResolvedValue({});

    await sponsorPortalModule.renderSponsorWidget('sponsorWidget');
    const el = document.getElementById('sponsorWidget');
    expect(el.innerHTML).toContain('Our Sponsors');
    expect(el.innerHTML).toContain('Gold Corp');
    expect(el.innerHTML).toContain('Silver Corp');
    expect(el.innerHTML).toContain('img');
    expect(el.innerHTML).toContain('badge');
  });

  test('renders with tier filter', async () => {
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValue([{ id: 's1', name: 'Gold Corp', logo_url: null, website: null, tier: 'Gold' }]);
    apiClient.insert = jest.fn().mockResolvedValue({});

    await sponsorPortalModule.renderSponsorWidget('sponsorWidget', 'Gold');
    const el = document.getElementById('sponsorWidget');
    expect(el.innerHTML).toContain('Gold Sponsors');
  });

  test('renders empty when no sponsors', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    await sponsorPortalModule.renderSponsorWidget('sponsorWidget');
    const el = document.getElementById('sponsorWidget');
    expect(el.innerHTML).toBe('');
  });

  test('returns early when container not found', async () => {
    const result = await sponsorPortalModule.renderSponsorWidget('nonExistent');
    expect(result).toBeUndefined();
  });

  test('handles error silently', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('fail'));
    await sponsorPortalModule.renderSponsorWidget('sponsorWidget');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('Sponsor Portal - calculateROI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('calculates ROI with impressions and contract', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([
      { tracked_at: new Date().toISOString(), page: '/home' },
      { tracked_at: new Date().toISOString(), page: '/about' },
      { tracked_at: new Date().toISOString(), page: '/home' },
      { tracked_at: new Date().toISOString(), page: '/about' },
    ]);
    apiClient.select = jest.fn().mockResolvedValue({
      data: [{ amount: 10000 }],
    });

    const roi = await sponsorPortalModule.calculateROI('s1');
    expect(roi.totalImpressions).toBe(4);
    expect(roi.estimatedClicks).toBe(Math.round(4 * 0.025));
    expect(roi.totalSpend).toBe(10000);
    expect(roi.costPerImpression).toContain('\u00a3');
  });

  test('returns N/A when no impressions', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    apiClient.select = jest.fn().mockResolvedValue({ data: [{ amount: 5000 }] });

    const roi = await sponsorPortalModule.calculateROI('s1');
    expect(roi.totalImpressions).toBe(0);
    expect(roi.costPerImpression).toBe('N/A');
    expect(roi.costPerClick).toBe('N/A');
  });

  test('returns defaults on error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('fail'));
    const roi = await sponsorPortalModule.calculateROI('s1');
    expect(roi.totalImpressions).toBe(0);
    expect(roi.costPerImpression).toBe('N/A');
    consoleSpy.mockRestore();
  });

  test('returns fallback object when apiClient.select rejects', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    apiClient.select = jest.fn().mockRejectedValue(new Error('DB connection lost'));

    const roi = await sponsorPortalModule.calculateROI('s1');

    expect(consoleSpy).toHaveBeenCalledWith('calculateROI:', expect.any(Error));
    expect(roi).toEqual({
      totalImpressions: 0,
      estimatedClicks: 0,
      costPerImpression: 'N/A',
      costPerClick: 'N/A',
      totalSpend: 0,
      stats: {},
    });
    consoleSpy.mockRestore();
  });

  test('handles no active contract', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([{ tracked_at: new Date().toISOString(), page: '/home' }]);
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });

    const roi = await sponsorPortalModule.calculateROI('s1');
    expect(roi.totalSpend).toBe(0);
  });
});

describe('Sponsor Portal - openContractModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const fields = [
      { id: 'contractModalTitle', tag: 'h5' },
      { id: 'contractModalBody', tag: 'div' },
      { id: 'contractModal', tag: 'div' },
    ];
    for (const f of fields) {
      let el = document.getElementById(f.id);
      if (!el) {
        el = document.createElement(f.tag);
        el.id = f.id;
        document.body.appendChild(el);
      }
    }
  });

  test('renders new contract modal', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([
      { id: 's1', name: 'Gold Corp' },
      { id: 's2', name: 'Silver Corp' },
    ]);

    await sponsorPortalModule.openContractModal();
    expect(document.getElementById('contractModalTitle').textContent).toBe('New Contract');
    expect(document.getElementById('contractModalBody').innerHTML).toContain('Gold Corp');
    expect(document.getElementById('contractModalBody').innerHTML).toContain('Silver Corp');
  });

  test('renders edit contract modal with pre-filled data', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([{ id: 's1', name: 'Test Corp' }]);
    const contract = {
      id: 'c1',
      sponsor_id: 's1',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      amount: 5000,
      status: 'Active',
      benefits: 'Logo',
    };
    await sponsorPortalModule.openContractModal(contract);
    expect(document.getElementById('contractModalTitle').textContent).toBe('Edit Contract');
    expect(document.getElementById('contractModalBody').innerHTML).toContain('5000');
    expect(document.getElementById('contractModalBody').innerHTML).toContain('Logo');
  });
});

describe('Sponsor Portal - editContract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const fields = [
      { id: 'contractModalTitle', tag: 'h5' },
      { id: 'contractModalBody', tag: 'div' },
      { id: 'contractModal', tag: 'div' },
    ];
    for (const f of fields) {
      let el = document.getElementById(f.id);
      if (!el) {
        el = document.createElement(f.tag);
        el.id = f.id;
        document.body.appendChild(el);
      }
    }
  });

  test('loads contract and opens modal', async () => {
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'c1', sponsor_id: 's1', amount: 5000, status: 'Active' }])
      .mockResolvedValueOnce([{ id: 's1', name: 'Test Corp' }]);

    await sponsorPortalModule.editContract('c1');
    expect(document.getElementById('contractModalTitle').textContent).toBe('Edit Contract');
  });

  test('opens empty modal when contract not found', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    await sponsorPortalModule.editContract('missing');
    expect(document.getElementById('contractModalTitle').textContent).toBe('New Contract');
  });
});
