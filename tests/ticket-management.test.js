/**
 * Tests for the Ticket Management Module (ticket-management.js)
 * Run with: npx jest tests/ticket-management.test.js
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
  <div id="ticketTypesContainer"></div>
  <div id="ticketPurchaseContainer"></div>
  <div id="ttModal" class="modal fade"><div class="modal-dialog"><div class="modal-content">
    <div class="modal-header"><h5 id="ttModalTitle">Ticket Type</h5></div>
    <div class="modal-body">
      <input type="hidden" id="ttId">
      <input id="ttName" value="">
      <input id="ttPrice" value="" type="number">
      <input id="ttQty" value="" type="number">
      <textarea id="ttDesc"></textarea>
      <input id="ttEbPrice" value="" type="number">
      <input id="ttEbDl" value="" type="date">
      <input type="checkbox" id="ttTable">
    </div>
  </div></div></div>
</body></html>`, { url: 'http://localhost' });

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.crypto = { randomUUID: () => 'uuid-' + Math.random().toString(36).substring(7) };

global.bootstrap = {
  Toast: class { show() {} hide() {} },
  Modal: class {
    constructor() {} show() {} hide() {}
    static getInstance() { return { hide() {} }; }
  },
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
  auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })), signOut: jest.fn(() => Promise.resolve({ error: null })) },
  channel: jest.fn(() => ({ on: jest.fn(function() { return this; }), subscribe: jest.fn(function() { return this; }) }))
};
global.supabase = { createClient: () => mockSupabase };
global.window.supabase = global.supabase;
global.fetch = jest.fn();

require('../config.js');
global.STATE = global.window.STATE; global.SUPABASE_CONFIG = global.window.SUPABASE_CONFIG;
global.STATUS = global.window.STATUS; global.MEDIA_TYPES = global.window.MEDIA_TYPES;
global.INACTIVITY_TIMEOUT = global.window.INACTIVITY_TIMEOUT; global.YEARS = global.window.YEARS;
global.SECTORS = global.window.SECTORS; global.REGIONS = global.window.REGIONS;
global.STATE.client = mockSupabase;

function syncWindowToGlobal() { for (const key of Object.keys(global.window)) { if (!(key in global) && typeof global.window[key] !== 'undefined') global[key] = global.window[key]; } }

require('../utils.js'); syncWindowToGlobal();
require('../ticket-management.js'); syncWindowToGlobal();

const sampleTicketTypes = [
  { id: 'tt1', name: 'Standard', price: 99.00, quantity: 100, description: 'Standard entry', event_id: 'ev1', includes_table: false, early_bird_price: 79.00, early_bird_deadline: '2027-01-01' },
  { id: 'tt2', name: 'VIP', price: 199.00, quantity: 50, description: 'VIP with table', event_id: 'ev1', includes_table: true, early_bird_price: null, early_bird_deadline: null },
  { id: 'tt3', name: 'Student', price: 49.00, quantity: 200, description: 'Student discount', event_id: 'ev1', includes_table: false, early_bird_price: null, early_bird_deadline: null }
];

describe('Ticket Module - Structure', () => {
  test('ticketModule is defined', () => {
    expect(ticketModule).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof ticketModule.renderTicketTypes).toBe('function');
    expect(typeof ticketModule._ttModalHTML).toBe('function');
    expect(typeof ticketModule._openTTModal).toBe('function');
    expect(typeof ticketModule.saveTicketType).toBe('function');
    expect(typeof ticketModule.deleteTicketType).toBe('function');
    expect(typeof ticketModule.initTicketPurchase).toBe('function');
    expect(typeof ticketModule.createTicketCheckout).toBe('function');
    expect(typeof ticketModule.generateETicket).toBe('function');
  });
});

describe('Ticket Module - renderTicketTypes', () => {
  test('renders ticket types list', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue(sampleTicketTypes);
    await ticketModule.renderTicketTypes('ev1');
    const el = document.getElementById('ticketTypesContainer');
    expect(el.innerHTML).toContain('Ticket Types');
    expect(el.innerHTML).toContain('Standard');
    expect(el.innerHTML).toContain('VIP');
    expect(el.innerHTML).toContain('Student');
  });

  test('shows empty message when no types', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    await ticketModule.renderTicketTypes('ev1');
    const el = document.getElementById('ticketTypesContainer');
    expect(el.innerHTML).toContain('No ticket types defined');
  });

  test('displays early bird badge', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue(sampleTicketTypes);
    await ticketModule.renderTicketTypes('ev1');
    const el = document.getElementById('ticketTypesContainer');
    expect(el.innerHTML).toContain('EB');
    expect(el.innerHTML).toContain('79.00');
  });

  test('displays includes table badge', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue(sampleTicketTypes);
    await ticketModule.renderTicketTypes('ev1');
    const el = document.getElementById('ticketTypesContainer');
    expect(el.innerHTML).toContain('Includes Table');
  });
});

describe('Ticket Module - _openTTModal', () => {
  test('opens modal for new ticket type', () => {
    ticketModule._openTTModal('ev1');
    expect(document.getElementById('ttModalTitle').textContent).toBe('Add Ticket Type');
    expect(document.getElementById('ttId').value).toBe('');
    expect(document.getElementById('ttName').value).toBe('');
  });

  test('opens modal for editing existing ticket type', () => {
    const tt = JSON.stringify(sampleTicketTypes[0]);
    ticketModule._openTTModal('ev1', tt);
    expect(document.getElementById('ttModalTitle').textContent).toBe('Edit Ticket Type');
    expect(document.getElementById('ttName').value).toBe('Standard');
    expect(document.getElementById('ttPrice').value).toBe('99');
  });
});

describe('Ticket Module - saveTicketType validation', () => {
  test('warns when name is empty', async () => {
    document.getElementById('ttId').value = '';
    document.getElementById('ttName').value = '';
    document.getElementById('ttPrice').value = '50';
    document.getElementById('ttQty').value = '10';

    const toastSpy = jest.spyOn(utils, 'showToast');
    await ticketModule.saveTicketType('ev1');
    expect(toastSpy).toHaveBeenCalledWith('Name, price and quantity are required.', 'warning');
    toastSpy.mockRestore();
  });

  test('warns when price is invalid', async () => {
    document.getElementById('ttName').value = 'Test';
    document.getElementById('ttPrice').value = 'abc';
    document.getElementById('ttQty').value = '10';

    const toastSpy = jest.spyOn(utils, 'showToast');
    await ticketModule.saveTicketType('ev1');
    expect(toastSpy).toHaveBeenCalledWith('Name, price and quantity are required.', 'warning');
    toastSpy.mockRestore();
  });
});

describe('Ticket Module - _ttModalHTML', () => {
  test('generates modal HTML with event ID', () => {
    const html = ticketModule._ttModalHTML('ev1');
    expect(html).toContain('modal');
    expect(html).toContain('Ticket Type');
    expect(html).toContain('ev1');
  });
});

describe('Ticket Module - deleteTicketType', () => {
  test('confirms before deleting', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(false);
    apiClient.delete = jest.fn();
    await ticketModule.deleteTicketType('tt1', 'ev1');
    expect(apiClient.delete).not.toHaveBeenCalled();
  });
});
