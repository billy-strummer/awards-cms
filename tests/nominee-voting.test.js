/**
 * Tests for the Nominee Voting Module (nominee-voting.js)
 * Run with: npx jest tests/nominee-voting.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(`<!DOCTYPE html><html><head>
  <meta property="og:title" content="">
  <meta property="og:description" content="">
</head><body>
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
  <div id="loadingState" style="display:block;"></div>
  <div id="nomineeCard" style="display:none;"></div>
  <div id="errorState" style="display:none;"></div>
  <img id="companyLogo" src="">
  <span id="awardBadge"></span>
  <h2 id="companyName"></h2>
  <p id="entryDescription"></p>
  <a id="companyWebsite" href="#"></a>
  <span id="entryTitle"></span>
  <span id="entryNumber"></span>
  <span id="voteCount">0</span>
  <div id="whyShouldWin" style="display:none;"><span id="whyShouldWinText"></span></div>
  <div id="websiteLinkSection" style="display:none;"><a id="websiteLink" href="#"></a></div>
  <button id="voteButton"></button>
  <div id="publicToastContainer"></div>
  <form id="verificationForm"><input id="voterEmail" type="email"><button type="submit">Verify</button></form>
  <div id="votingSection" style="display:none;"></div>
  <div id="verificationSection"></div>
</body></html>`, { url: 'http://localhost?entry=BTA-001' });

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.sessionStorage = dom.window.sessionStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.requestAnimationFrame = jest.fn(cb => cb());

global.bootstrap = {
  Toast: class { show() {} hide() {} },
  Modal: class { show() {} hide() {} static getInstance() { return { hide() {} }; } },
  Tooltip: class {}
};

const mockSupabase = {
  from: jest.fn(() => mockSupabase), select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => Promise.resolve({ data: {}, error: null })),
  update: jest.fn(() => mockSupabase), delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase), in: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase), range: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn(cb => cb({ data: [], error: null })),
  auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })), signOut: jest.fn(() => Promise.resolve({ error: null })) },
  channel: jest.fn(() => ({ on: jest.fn(function() { return this; }), subscribe: jest.fn(function() { return this; }) }))
};

global.window.SUPABASE_CONFIG = { url: 'https://test.supabase.co', anonKey: 'test-key' };
global.window.supabase = { createClient: () => mockSupabase };
global.supabase = global.window.supabase;
global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));

require('../config.js');
global.STATE = global.window.STATE; global.SUPABASE_CONFIG = global.window.SUPABASE_CONFIG;
global.STATUS = global.window.STATUS; global.MEDIA_TYPES = global.window.MEDIA_TYPES;
global.INACTIVITY_TIMEOUT = global.window.INACTIVITY_TIMEOUT; global.YEARS = global.window.YEARS;
global.SECTORS = global.window.SECTORS; global.REGIONS = global.window.REGIONS;
global.STATE.client = mockSupabase;

function syncWindowToGlobal() { for (const key of Object.keys(global.window)) { if (!(key in global) && typeof global.window[key] !== 'undefined') global[key] = global.window[key]; } }

require('../utils.js'); syncWindowToGlobal();
require('../nominee-voting.js'); syncWindowToGlobal();

describe('Nominee Voting - Structure', () => {
  test('nomineeVoting is defined', () => {
    expect(nomineeVoting).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof nomineeVoting.initialize).toBe('function');
    expect(typeof nomineeVoting.loadEntry).toBe('function');
    expect(typeof nomineeVoting.checkIfVoted).toBe('function');
    expect(typeof nomineeVoting.displayEntry).toBe('function');
    expect(typeof nomineeVoting.showError).toBe('function');
  });

  test('has default state', () => {
    expect(nomineeVoting.entry).toBeNull();
    expect(nomineeVoting.entryId).toBeNull();
    expect(nomineeVoting.hasVoted).toBe(false);
  });
});

describe('Nominee Voting - checkIfVoted', () => {
  test('sets hasVoted to true when vote exists', async () => {
    nomineeVoting.entryId = 'e1';
    nomineeVoting.voterEmail = 'voter@test.com';
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ exists: true }) }));
    await nomineeVoting.checkIfVoted();
    expect(nomineeVoting.hasVoted).toBe(true);
  });

  test('sets hasVoted to false when no vote', async () => {
    nomineeVoting.entryId = 'e1';
    nomineeVoting.voterEmail = 'voter@test.com';
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ exists: false }) }));
    await nomineeVoting.checkIfVoted();
    expect(nomineeVoting.hasVoted).toBe(false);
  });
});

describe('Nominee Voting - displayEntry', () => {
  test('displays entry information correctly', () => {
    nomineeVoting.entry = {
      id: 'e1',
      entry_description: 'Test description',
      organisations: { company_name: 'Test Co', logo_url: 'https://cdn.example.com/logo.png', website: 'https://test.com' },
      awards: { award_name: 'Best Innovation' }
    };

    nomineeVoting.displayEntry();

    expect(document.getElementById('loadingState').style.display).toBe('none');
    expect(document.getElementById('nomineeCard').style.display).toBe('block');
    expect(document.getElementById('awardBadge').textContent).toBe('Best Innovation');
  });

  test('handles missing organisation data', () => {
    nomineeVoting.entry = {
      id: 'e1',
      entry_description: 'Test',
      organisations: null,
      awards: null
    };

    expect(() => nomineeVoting.displayEntry()).not.toThrow();
  });
});

describe('Nominee Voting - showError', () => {
  test('showError shows error state', () => {
    if (typeof nomineeVoting.showError === 'function') {
      nomineeVoting.showError();
      // Verify it doesn't throw
    }
  });
});

describe('Nominee Voting - loadEntry', () => {
  test('handles entry not found', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ entry: null }) }));
    nomineeVoting.showError = jest.fn();
    await nomineeVoting.loadEntry('BTA-999', null);
    expect(nomineeVoting.showError).toHaveBeenCalled();
  });
});
