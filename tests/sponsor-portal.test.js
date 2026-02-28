/**
 * Tests for the Sponsor Portal Module (sponsor-portal.js)
 * Run with: npx jest tests/sponsor-portal.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(`<!DOCTYPE html><html><body>
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
</body></html>`, { url: 'http://localhost' });

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;

global.bootstrap = {
  Toast: class { show() {} hide() {} },
  Modal: class { show() {} hide() {} static getInstance() { return { hide() {} }; } },
  Tooltip: class {}
};

const mockSupabase = {
  from: jest.fn(() => mockSupabase), select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase), update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase), eq: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase), range: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn(cb => cb({ data: [], error: null })),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(() => Promise.resolve({ error: null })),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://cdn.example.com/asset.png' } }))
    }))
  },
  auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })), signOut: jest.fn(() => Promise.resolve({ error: null })) },
  channel: jest.fn(() => ({ on: jest.fn(function() { return this; }), subscribe: jest.fn(function() { return this; }) }))
};
global.supabase = { createClient: () => mockSupabase };
global.window.supabase = global.supabase;

require('../config.js');
global.STATE = global.window.STATE; global.SUPABASE_CONFIG = global.window.SUPABASE_CONFIG;
global.STATUS = global.window.STATUS; global.MEDIA_TYPES = global.window.MEDIA_TYPES;
global.INACTIVITY_TIMEOUT = global.window.INACTIVITY_TIMEOUT; global.YEARS = global.window.YEARS;
global.SECTORS = global.window.SECTORS; global.REGIONS = global.window.REGIONS;
global.STATE.client = mockSupabase;

function syncWindowToGlobal() { for (const key of Object.keys(global.window)) { if (!(key in global) && typeof global.window[key] !== 'undefined') global[key] = global.window[key]; } }

require('../utils.js'); syncWindowToGlobal();
require('../sponsor-portal.js'); syncWindowToGlobal();

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
    Object.values(sponsorPortalModule.TIERS).forEach(tier => {
      expect(Array.isArray(tier.benefits)).toBe(true);
      expect(tier.benefits.length).toBeGreaterThan(0);
      tier.benefits.forEach(b => expect(typeof b).toBe('string'));
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
      { tracked_at: now.toISOString(), page: '/sponsors' }
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
});
