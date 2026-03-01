/**
 * Tests for the Ticket Management Module (ticket-management.js)
 * Run with: npx jest tests/ticket-management.test.js
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
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.crypto = { randomUUID: () => 'uuid-' + Math.random().toString(36).substring(7) };

global.bootstrap = {
  Toast: class {
    show() {}
    hide() {}
  },
  Modal: class {
    constructor() {}
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
global.fetch = jest.fn();

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
require('../ticket-management.js');
syncWindowToGlobal();

const sampleTicketTypes = [
  {
    id: 'tt1',
    name: 'Standard',
    price: 99.0,
    quantity: 100,
    description: 'Standard entry',
    event_id: 'ev1',
    includes_table: false,
    early_bird_price: 79.0,
    early_bird_deadline: '2027-01-01',
  },
  {
    id: 'tt2',
    name: 'VIP',
    price: 199.0,
    quantity: 50,
    description: 'VIP with table',
    event_id: 'ev1',
    includes_table: true,
    early_bird_price: null,
    early_bird_deadline: null,
  },
  {
    id: 'tt3',
    name: 'Student',
    price: 49.0,
    quantity: 200,
    description: 'Student discount',
    event_id: 'ev1',
    includes_table: false,
    early_bird_price: null,
    early_bird_deadline: null,
  },
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
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('confirms before deleting', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(false);
    apiClient.delete = jest.fn();
    await ticketModule.deleteTicketType('tt1', 'ev1');
    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  test('deletes ticket type on confirm', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.delete = jest.fn().mockResolvedValue({});
    jest.spyOn(ticketModule, 'renderTicketTypes').mockImplementation(() => {});
    const toastSpy = jest.spyOn(utils, 'showToast');

    await ticketModule.deleteTicketType('tt1', 'ev1');
    expect(apiClient.delete).toHaveBeenCalledWith('event_ticket_types', 'tt1');
    expect(toastSpy).toHaveBeenCalledWith('Deleted.', 'success');
    expect(ticketModule.renderTicketTypes).toHaveBeenCalledWith('ev1');
    toastSpy.mockRestore();
  });

  test('shows error on delete failure', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.delete = jest.fn().mockRejectedValue(new Error('Cannot delete'));
    const toastSpy = jest.spyOn(utils, 'showToast');

    await ticketModule.deleteTicketType('tt1', 'ev1');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Delete failed'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Ticket Module - saveTicketType success', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.getElementById('ttId').value = '';
    document.getElementById('ttName').value = 'Test Ticket';
    document.getElementById('ttPrice').value = '100';
    document.getElementById('ttQty').value = '50';
    document.getElementById('ttDesc').value = 'A ticket';
    document.getElementById('ttEbPrice').value = '';
    document.getElementById('ttEbDl').value = '';
    document.getElementById('ttTable').checked = false;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('inserts new ticket type', async () => {
    apiClient.insert = jest.fn().mockResolvedValue({});
    utils.protectModalDuringSave = jest.fn(async (modalId, fn) => await fn());
    jest.spyOn(ticketModule, 'renderTicketTypes').mockImplementation(() => {});
    const toastSpy = jest.spyOn(utils, 'showToast');

    await ticketModule.saveTicketType('ev1');
    expect(apiClient.insert).toHaveBeenCalledWith(
      'event_ticket_types',
      expect.objectContaining({
        name: 'Test Ticket',
        price: 100,
        quantity: 50,
        event_id: 'ev1',
      })
    );
    expect(toastSpy).toHaveBeenCalledWith('Ticket type saved.', 'success');
    toastSpy.mockRestore();
  });

  test('updates existing ticket type', async () => {
    document.getElementById('ttId').value = 'tt-existing';
    apiClient.update = jest.fn().mockResolvedValue({});
    utils.protectModalDuringSave = jest.fn(async (modalId, fn) => await fn());
    jest.spyOn(ticketModule, 'renderTicketTypes').mockImplementation(() => {});

    await ticketModule.saveTicketType('ev1');
    expect(apiClient.update).toHaveBeenCalledWith('event_ticket_types', 'tt-existing', expect.any(Object));
  });

  test('falls back to localStorage on DB error', async () => {
    utils.protectModalDuringSave = jest.fn(async (modalId, fn) => {
      throw new Error('DB err');
    });
    const toastSpy = jest.spyOn(utils, 'showToast');

    await ticketModule.saveTicketType('ev1');
    const stored = JSON.parse(localStorage.getItem('bta_ticket_types_ev1') || '[]');
    expect(stored.length).toBeGreaterThan(0);
    expect(toastSpy).toHaveBeenCalledWith('Ticket type saved locally', 'success');
    toastSpy.mockRestore();
    localStorage.removeItem('bta_ticket_types_ev1');
  });
});

describe('Ticket Module - renderTicketTypes error', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure the container exists
    const el = document.getElementById('ticketTypesContainer');
    if (!el) {
      const d = document.createElement('div');
      d.id = 'ticketTypesContainer';
      document.body.appendChild(d);
    }
  });

  test('handles API failure gracefully', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('DB error'));
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    // Should not throw - just show error toast or handle gracefully
    await expect(ticketModule.renderTicketTypes('ev1')).resolves.not.toThrow();
    toastSpy.mockRestore();
  });

  test('returns early when container not found', async () => {
    const el = document.getElementById('ticketTypesContainer');
    el.id = 'hidden';
    const result = await ticketModule.renderTicketTypes('ev1');
    expect(result).toBeUndefined();
    el.id = 'ticketTypesContainer';
  });
});

describe('Ticket Module - initTicketPurchase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders ticket purchase UI', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [{ id: 'ev1', event_name: 'Gala Night', event_date: '2026-06-15', venue: 'Grand Hall' }],
    });
    apiClient.selectAll = jest.fn().mockResolvedValue(sampleTicketTypes);
    await ticketModule.initTicketPurchase('ev1');
    const el = document.getElementById('ticketPurchaseContainer');
    expect(el.innerHTML).toContain('Gala Night');
    expect(el.innerHTML).toContain('Standard');
    expect(el.innerHTML).toContain('Proceed to Payment');
  });

  test('shows error when event not found', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    const toastSpy = jest.spyOn(utils, 'showToast');
    await ticketModule.initTicketPurchase('ev-missing');
    expect(toastSpy).toHaveBeenCalledWith('Event not found.', 'error');
    toastSpy.mockRestore();
  });

  test('returns early when container not found', async () => {
    const el = document.getElementById('ticketPurchaseContainer');
    el.id = 'hidden';
    const result = await ticketModule.initTicketPurchase('ev1');
    expect(result).toBeUndefined();
    el.id = 'ticketPurchaseContainer';
  });

  test('handles API error', async () => {
    apiClient.select = jest.fn().mockRejectedValue(new Error('fail'));
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('fail'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await ticketModule.initTicketPurchase('ev1');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to load purchase UI'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Ticket Module - createTicketCheckout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up purchase container with qty inputs
    const el = document.getElementById('ticketPurchaseContainer');
    el.innerHTML = `
      <input type="number" class="ticket-qty" value="2" data-type-id="tt1" data-price="99" data-name="Standard">
      <input type="number" class="ticket-qty" value="0" data-type-id="tt2" data-price="199" data-name="VIP">
    `;
  });

  test('warns when no tickets selected', async () => {
    const el = document.getElementById('ticketPurchaseContainer');
    el.querySelectorAll('.ticket-qty').forEach((i) => (i.value = '0'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await ticketModule.createTicketCheckout('ev1');
    expect(toastSpy).toHaveBeenCalledWith('Select at least one ticket.', 'warning');
    toastSpy.mockRestore();
  });

  test('redirects to checkout URL', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: 'https://checkout.stripe.com/session' }),
    });
    // Save and mock location
    const originalHref = window.location.href;

    await ticketModule.createTicketCheckout('ev1');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/stripe-payment.js',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  test('handles checkout failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Card declined' }),
    });
    const toastSpy = jest.spyOn(utils, 'showToast');
    await ticketModule.createTicketCheckout('ev1');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Checkout error'), 'error');
    toastSpy.mockRestore();
  });

  test('handles network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await ticketModule.createTicketCheckout('ev1');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Checkout error'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Ticket Module - generateETicket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('generates e-ticket PDF', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'g1',
          guest_name: 'John Doe',
          guest_type: 'VIP',
          table_number: 'T5',
          seat_number: '3',
          dietary_requirements: 'Vegetarian',
          events: { event_name: 'Gala Night', event_date: '2026-06-15', venue: 'Grand Hall' },
        },
      ],
    });
    global.window.jspdf = {
      jsPDF: class {
        constructor() {}
        setFillColor() {}
        rect() {}
        setTextColor() {}
        setFontSize() {}
        setFont() {}
        text() {}
        setDrawColor() {}
        line() {}
        addImage() {}
        save() {}
      },
    };
    const toastSpy = jest.spyOn(utils, 'showToast');
    await ticketModule.generateETicket('g1');
    expect(toastSpy).toHaveBeenCalledWith('E-ticket downloaded.', 'success');
    toastSpy.mockRestore();
    delete global.window.jspdf;
  });

  test('shows error when ticket not found', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    const toastSpy = jest.spyOn(utils, 'showToast');
    await ticketModule.generateETicket('missing');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to generate e-ticket'), 'error');
    toastSpy.mockRestore();
  });

  test('handles API error', async () => {
    apiClient.select = jest.fn().mockRejectedValue(new Error('DB error'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await ticketModule.generateETicket('g1');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to generate e-ticket'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Ticket Module - renderGuestPreferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    let el = document.getElementById('guestPreferencesContainer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'guestPreferencesContainer';
      document.body.appendChild(el);
    }
  });

  afterEach(() => {
    const el = document.getElementById('guestPreferencesContainer');
    if (el) el.remove();
  });

  test('renders guest preferences form', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [{ id: 'g1', guest_name: 'Jane Smith', dietary_requirements: 'Vegan', notes: 'Wheelchair access' }],
    });
    await ticketModule.renderGuestPreferences('g1');
    const el = document.getElementById('guestPreferencesContainer');
    expect(el.innerHTML).toContain('Jane Smith');
    expect(el.innerHTML).toContain('Wheelchair access');
  });

  test('shows error when guest not found', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    const toastSpy = jest.spyOn(utils, 'showToast');
    await ticketModule.renderGuestPreferences('missing');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to load preferences'), 'error');
    toastSpy.mockRestore();
  });

  test('returns early when container not found', async () => {
    const el = document.getElementById('guestPreferencesContainer');
    el.remove();
    const result = await ticketModule.renderGuestPreferences('g1');
    expect(result).toBeUndefined();
  });
});

describe('Ticket Module - saveGuestPreferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    let gpDietary = document.getElementById('gpDietary');
    if (!gpDietary) {
      gpDietary = document.createElement('select');
      gpDietary.id = 'gpDietary';
      document.body.appendChild(gpDietary);
    }
    gpDietary.innerHTML = '<option value="Vegan">Vegan</option><option value="None">None</option>';
    gpDietary.value = 'Vegan';

    let gpNotes = document.getElementById('gpNotes');
    if (!gpNotes) {
      gpNotes = document.createElement('textarea');
      gpNotes.id = 'gpNotes';
      document.body.appendChild(gpNotes);
    }
    gpNotes.value = 'Wheelchair access needed';
  });

  test('saves preferences successfully', async () => {
    apiClient.update = jest.fn().mockResolvedValue({});
    const toastSpy = jest.spyOn(utils, 'showToast');
    await ticketModule.saveGuestPreferences('g1');
    expect(apiClient.update).toHaveBeenCalledWith(
      'event_guests',
      'g1',
      expect.objectContaining({
        dietary_requirements: 'Vegan',
        notes: 'Wheelchair access needed',
      })
    );
    expect(toastSpy).toHaveBeenCalledWith('Preferences saved.', 'success');
    toastSpy.mockRestore();
  });

  test('sets dietary to null when None selected', async () => {
    document.getElementById('gpDietary').value = 'None';
    apiClient.update = jest.fn().mockResolvedValue({});
    await ticketModule.saveGuestPreferences('g1');
    expect(apiClient.update).toHaveBeenCalledWith(
      'event_guests',
      'g1',
      expect.objectContaining({
        dietary_requirements: null,
      })
    );
  });

  test('shows error on failure', async () => {
    apiClient.update = jest.fn().mockRejectedValue(new Error('Save failed'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await ticketModule.saveGuestPreferences('g1');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Save failed'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Ticket Module - renderTicketDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    let el = document.getElementById('ticketDashboardContainer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ticketDashboardContainer';
      document.body.appendChild(el);
    }
  });

  afterEach(() => {
    const el = document.getElementById('ticketDashboardContainer');
    if (el) el.remove();
  });

  test('renders dashboard with stats', async () => {
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'tt1',
          name: 'Standard',
          price: 99,
          quantity: 100,
          includes_table: false,
          early_bird_price: null,
          early_bird_deadline: null,
        },
      ])
      .mockResolvedValueOnce([{ rsvp_status: 'confirmed' }, { rsvp_status: 'pending' }, { rsvp_status: 'cancelled' }]);

    await ticketModule.renderTicketDashboard('ev1');
    const el = document.getElementById('ticketDashboardContainer');
    expect(el.innerHTML).toContain('Capacity');
    expect(el.innerHTML).toContain('Sold');
    expect(el.innerHTML).toContain('Standard');
  });

  test('returns early when container not found', async () => {
    document.getElementById('ticketDashboardContainer').remove();
    const result = await ticketModule.renderTicketDashboard('ev1');
    expect(result).toBeUndefined();
  });

  test('handles API error', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('fail'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await ticketModule.renderTicketDashboard('ev1');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Dashboard load failed'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Ticket Module - addToWaitlist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('adds to waitlist successfully', async () => {
    apiClient.insert = jest.fn().mockResolvedValue({});
    const toastSpy = jest.spyOn(utils, 'showToast');
    const result = await ticketModule.addToWaitlist('ev1', 'john@test.com', 'John');
    expect(result).toBe(true);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('John added to waitlist'), 'success');
    toastSpy.mockRestore();
  });

  test('warns when name is missing', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    const result = await ticketModule.addToWaitlist('ev1', 'john@test.com', '');
    expect(result).toBe(false);
    expect(toastSpy).toHaveBeenCalledWith('Name and email are required.', 'warning');
    toastSpy.mockRestore();
  });

  test('warns when email is invalid', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    const result = await ticketModule.addToWaitlist('ev1', 'not-an-email', 'John');
    expect(result).toBe(false);
    expect(toastSpy).toHaveBeenCalledWith('Invalid email address.', 'warning');
    toastSpy.mockRestore();
  });

  test('handles API error', async () => {
    apiClient.insert = jest.fn().mockRejectedValue(new Error('DB error'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    const result = await ticketModule.addToWaitlist('ev1', 'john@test.com', 'John');
    expect(result).toBe(false);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Waitlist error'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Ticket Module - processWaitlist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('notifies waitlist entrants', async () => {
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValueOnce([{ quantity: 100 }])
      .mockResolvedValueOnce([
        { id: 'w1', name: 'Person 1', email: 'p1@test.com', created_at: '2026-01-01' },
        { id: 'w2', name: 'Person 2', email: 'p2@test.com', created_at: '2026-01-02' },
      ])
      .mockResolvedValueOnce([{ id: 'g1' }, { id: 'g2' }]); // 2 existing guests, 98 spots
    apiClient.update = jest.fn().mockResolvedValue({});
    const toastSpy = jest.spyOn(utils, 'showToast');

    await ticketModule.processWaitlist('ev1');
    expect(apiClient.update).toHaveBeenCalledTimes(2);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('2 waitlist entrant(s) notified'), 'success');
    toastSpy.mockRestore();
  });

  test('shows info when no spots available', async () => {
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValueOnce([{ quantity: 2 }])
      .mockResolvedValueOnce([{ id: 'w1' }])
      .mockResolvedValueOnce([{ id: 'g1' }, { id: 'g2' }]); // capacity = guests = 2
    const toastSpy = jest.spyOn(utils, 'showToast');

    await ticketModule.processWaitlist('ev1');
    expect(toastSpy).toHaveBeenCalledWith('No available spots.', 'info');
    toastSpy.mockRestore();
  });

  test('shows info when waitlist is empty', async () => {
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValueOnce([{ quantity: 100 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const toastSpy = jest.spyOn(utils, 'showToast');

    await ticketModule.processWaitlist('ev1');
    expect(toastSpy).toHaveBeenCalledWith('Waitlist is empty.', 'info');
    toastSpy.mockRestore();
  });

  test('handles API error', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('fail'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await ticketModule.processWaitlist('ev1');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Waitlist processing error'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Ticket Module - processRefund', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('cancels when user declines', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(false);
    apiClient.select = jest.fn();
    await ticketModule.processRefund('g1');
    expect(apiClient.select).not.toHaveBeenCalled();
  });

  test('processes refund successfully', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.select = jest.fn().mockResolvedValue({
      data: [{ id: 'g1', guest_name: 'John', guest_email: 'john@test.com' }],
    });
    apiClient.update = jest.fn().mockResolvedValue({});
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    const toastSpy = jest.spyOn(utils, 'showToast');

    await ticketModule.processRefund('g1');
    expect(apiClient.update).toHaveBeenCalledWith(
      'event_guests',
      'g1',
      expect.objectContaining({
        rsvp_status: 'cancelled',
      })
    );
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Refund processed for John'), 'success');
    toastSpy.mockRestore();
  });

  test('handles stripe refund failure gracefully', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.select = jest.fn().mockResolvedValue({
      data: [{ id: 'g1', guest_name: 'John', guest_email: 'john@test.com' }],
    });
    apiClient.update = jest.fn().mockResolvedValue({});
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'No charge found' }),
    });
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    const toastSpy = jest.spyOn(utils, 'showToast');

    await ticketModule.processRefund('g1');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('manual processing'), 'warning');
    consoleSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('shows error when ticket not found', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    const toastSpy = jest.spyOn(utils, 'showToast');

    await ticketModule.processRefund('missing');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Refund error'), 'error');
    toastSpy.mockRestore();
  });
});
