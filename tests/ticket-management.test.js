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
    utils.protectModalDuringSave = jest.fn(async (_modalId, _fn) => {
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
    const _originalHref = window.location.href;

    await ticketModule.createTicketCheckout('ev1');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/stripe-payment?action=event-checkout',
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

/* ============================================================== */
/* ADDITIONAL TESTS — Covering remaining uncovered lines/branches */
/* ============================================================== */

describe('Ticket Module - initTicketPurchase input event handler (lines 199-203)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('recalculates total when ticket quantity input fires input event', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [{ id: 'ev1', event_name: 'Gala Night', event_date: '2026-06-15', venue: 'Grand Hall' }],
    });
    apiClient.selectAll = jest.fn().mockResolvedValue(sampleTicketTypes);
    await ticketModule.initTicketPurchase('ev1');

    const el = document.getElementById('ticketPurchaseContainer');
    const qtyInputs = el.querySelectorAll('.ticket-qty');
    expect(qtyInputs.length).toBeGreaterThan(0);

    // Set a quantity and fire the input event
    qtyInputs[0].value = '3';
    qtyInputs[0].dispatchEvent(new dom.window.Event('input'));

    const totalEl = document.getElementById('ticketTotal');
    expect(totalEl).toBeTruthy();
    // The first ticket type has early_bird_price=79 with future deadline so price=79
    // 3 * 79 = 237
    expect(totalEl.textContent).toContain('237.00');
  });

  test('handles zero and empty quantity inputs correctly', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [{ id: 'ev1', event_name: 'Gala Night', event_date: '2026-06-15', venue: 'Grand Hall' }],
    });
    apiClient.selectAll = jest.fn().mockResolvedValue(sampleTicketTypes);
    await ticketModule.initTicketPurchase('ev1');

    const el = document.getElementById('ticketPurchaseContainer');
    const qtyInputs = el.querySelectorAll('.ticket-qty');

    // Set all to 0
    qtyInputs.forEach((inp) => (inp.value = '0'));
    qtyInputs[0].dispatchEvent(new dom.window.Event('input'));

    const totalEl = document.getElementById('ticketTotal');
    expect(totalEl.textContent).toContain('0.00');
  });
});

describe('Ticket Module - createTicketCheckout with stripeFrontend (lines 249-250)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const el = document.getElementById('ticketPurchaseContainer');
    el.innerHTML = `
      <input type="number" class="ticket-qty" value="2" data-type-id="tt1" data-price="99" data-name="Standard">
    `;
  });

  test('uses stripeFrontend.stripe.redirectToCheckout when sessionId is returned', async () => {
    const redirectMock = jest.fn().mockResolvedValue({ error: null });
    const sfObj = { stripe: { redirectToCheckout: redirectMock } };
    global.window.stripeFrontend = sfObj;
    global.stripeFrontend = sfObj;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionId: 'sess_123', url: 'https://checkout.stripe.com/session' }),
    });

    await ticketModule.createTicketCheckout('ev1');
    expect(redirectMock).toHaveBeenCalledWith({ sessionId: 'sess_123' });
    delete global.window.stripeFrontend;
    delete global.stripeFrontend;
  });

  test('throws when stripeFrontend.stripe.redirectToCheckout returns error', async () => {
    const redirectMock = jest.fn().mockResolvedValue({ error: { message: 'Redirect failed' } });
    const sfObj = { stripe: { redirectToCheckout: redirectMock } };
    global.window.stripeFrontend = sfObj;
    global.stripeFrontend = sfObj;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionId: 'sess_123' }),
    });
    const toastSpy = jest.spyOn(utils, 'showToast');

    await ticketModule.createTicketCheckout('ev1');
    expect(redirectMock).toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Checkout error'), 'error');
    toastSpy.mockRestore();
    delete global.window.stripeFrontend;
    delete global.stripeFrontend;
  });

  test('falls back to window.location.href when no stripeFrontend and url is returned', async () => {
    delete global.window.stripeFrontend;
    delete global.stripeFrontend;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: 'https://checkout.stripe.com/session' }),
    });

    // No stripeFrontend means else-if url branch
    await ticketModule.createTicketCheckout('ev1');
    expect(global.fetch).toHaveBeenCalled();
  });
});

describe('Ticket Module - generateETicket with QR code (lines 308-316)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('generates QR code when window.QRCode is available', async () => {
    // Replace setTimeout with an immediate version to avoid timer issues
    const origSetTimeout = global.setTimeout;
    global.setTimeout = (fn, _delay) => {
      fn();
      return 0;
    };

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

    const saveMock = jest.fn();
    const addImageMock = jest.fn();
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
        addImage(...args) {
          addImageMock(...args);
        }
        save(...args) {
          saveMock(...args);
        }
      },
    };

    // Mock QRCode constructor
    global.window.QRCode = function (_canvas, _opts) {};
    global.window.QRCode.CorrectLevel = { M: 1 };

    // Mock canvas.toDataURL since JSDOM doesn't support it
    const origCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreateElement(tag);
      if (tag === 'canvas') {
        el.toDataURL = jest.fn().mockReturnValue('data:image/png;base64,fake');
      }
      return el;
    });

    await ticketModule.generateETicket('g1');

    expect(addImageMock).toHaveBeenCalledWith('data:image/png;base64,fake', 'PNG', 100, 50, 38, 38);
    expect(saveMock).toHaveBeenCalledWith('bta-ticket-g1.pdf');

    document.createElement.mockRestore();
    delete global.window.QRCode;
    delete global.window.jspdf;
    global.setTimeout = origSetTimeout;
  });
});

describe('Ticket Module - generateETicket without optional fields (branch coverage)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('handles guest with no table_number, no dietary, no seat, no events fields', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'g2',
          guest_name: null,
          guest_type: null,
          table_number: null,
          seat_number: null,
          dietary_requirements: null,
          events: null,
        },
      ],
    });

    const textCalls = [];
    global.window.jspdf = {
      jsPDF: class {
        constructor() {}
        setFillColor() {}
        rect() {}
        setTextColor() {}
        setFontSize() {}
        setFont() {}
        text(...args) {
          textCalls.push(args);
        }
        setDrawColor() {}
        line() {}
        addImage() {}
        save() {}
      },
    };

    // No QRCode to skip that branch
    delete global.window.QRCode;

    const toastSpy = jest.spyOn(utils, 'showToast');
    await ticketModule.generateETicket('g2');
    expect(toastSpy).toHaveBeenCalledWith('E-ticket downloaded.', 'success');

    // Verify fallback values were used
    const eventNameCall = textCalls.find((c) => c[0] === 'Event');
    expect(eventNameCall).toBeTruthy();
    const venueCall = textCalls.find((c) => c[0] === 'Venue: TBC');
    expect(venueCall).toBeTruthy();
    const guestNameCall = textCalls.find((c) => c[0] === '-');
    expect(guestNameCall).toBeTruthy();
    const guestTypeCall = textCalls.find((c) => c[0] === 'Type: Guest');
    expect(guestTypeCall).toBeTruthy();

    toastSpy.mockRestore();
    delete global.window.jspdf;
  });
});

describe('Ticket Module - saveTicketType localStorage update existing entry (line 117-118)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.getElementById('ttId').value = 'existing-id';
    document.getElementById('ttName').value = 'Updated Ticket';
    document.getElementById('ttPrice').value = '150';
    document.getElementById('ttQty').value = '25';
    document.getElementById('ttDesc').value = 'Updated desc';
    document.getElementById('ttEbPrice').value = '';
    document.getElementById('ttEbDl').value = '';
    document.getElementById('ttTable').checked = true;
  });

  afterEach(() => {
    localStorage.removeItem('bta_ticket_types_ev1');
    jest.restoreAllMocks();
  });

  test('updates existing entry in localStorage when DB save fails', async () => {
    // Pre-populate localStorage with an entry that has the same ID
    const existing = [{ id: 'existing-id', name: 'Old Ticket', price: 100, quantity: 10 }];
    localStorage.setItem('bta_ticket_types_ev1', JSON.stringify(existing));

    utils.protectModalDuringSave = jest.fn(async (_modalId, _fn) => {
      throw new Error('DB err');
    });
    const toastSpy = jest.spyOn(utils, 'showToast');

    await ticketModule.saveTicketType('ev1');

    const stored = JSON.parse(localStorage.getItem('bta_ticket_types_ev1') || '[]');
    expect(stored.length).toBe(1);
    expect(stored[0].name).toBe('Updated Ticket');
    expect(stored[0].price).toBe(150);
    expect(stored[0].id).toBe('existing-id');
    expect(toastSpy).toHaveBeenCalledWith('Ticket type saved locally', 'success');
    toastSpy.mockRestore();
  });
});

describe('Ticket Module - renderTicketTypes with null types (branch coverage)', () => {
  test('handles null response from selectAll', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue(null);
    await ticketModule.renderTicketTypes('ev1');
    const el = document.getElementById('ticketTypesContainer');
    expect(el.innerHTML).toContain('No ticket types defined');
  });
});

describe('Ticket Module - initTicketPurchase with null types and empty rows (branch coverage)', () => {
  test('handles null types response', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [{ id: 'ev1', event_name: 'Gala', event_date: '2026-06-15', venue: null }],
    });
    apiClient.selectAll = jest.fn().mockResolvedValue(null);
    await ticketModule.initTicketPurchase('ev1');
    const el = document.getElementById('ticketPurchaseContainer');
    expect(el.innerHTML).toContain('No tickets available');
  });

  test('handles event with null venue', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [{ id: 'ev1', event_name: 'Gala', event_date: '2026-06-15', venue: null }],
    });
    apiClient.selectAll = jest.fn().mockResolvedValue(sampleTicketTypes);
    await ticketModule.initTicketPurchase('ev1');
    const el = document.getElementById('ticketPurchaseContainer');
    expect(el.innerHTML).toContain('Gala');
  });
});

describe('Ticket Module - _openTTModal branch coverage for null fields', () => {
  test('opens modal for editing ticket with null optional fields', () => {
    const tt = JSON.stringify({
      id: 'tt-null',
      name: 'Basic',
      price: 50,
      quantity: 10,
      description: null,
      early_bird_price: null,
      early_bird_deadline: null,
      includes_table: false,
    });
    ticketModule._openTTModal('ev1', tt);
    expect(document.getElementById('ttModalTitle').textContent).toBe('Edit Ticket Type');
    expect(document.getElementById('ttDesc').value).toBe('');
    expect(document.getElementById('ttEbPrice').value).toBe('');
    expect(document.getElementById('ttEbDl').value).toBe('');
    expect(document.getElementById('ttTable').checked).toBe(false);
  });
});

describe('Ticket Module - renderTicketTypes with types missing description (branch coverage)', () => {
  test('handles ticket type with null description', async () => {
    const types = [
      {
        id: 'tt-nodesc',
        name: 'No Desc',
        price: 50,
        quantity: 10,
        description: null,
        event_id: 'ev1',
        includes_table: false,
        early_bird_price: null,
        early_bird_deadline: null,
      },
    ];
    apiClient.selectAll = jest.fn().mockResolvedValue(types);
    await ticketModule.renderTicketTypes('ev1');
    const el = document.getElementById('ticketTypesContainer');
    expect(el.innerHTML).toContain('No Desc');
  });
});

describe('Ticket Module - renderTicketDashboard branch coverage', () => {
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

  test('renders dashboard with early bird pricing active', async () => {
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'tt1',
          name: 'Standard',
          price: 99,
          quantity: 100,
          includes_table: true,
          early_bird_price: 79,
          early_bird_deadline: '2027-01-01',
        },
      ])
      .mockResolvedValueOnce([{ rsvp_status: 'confirmed' }, { rsvp_status: 'pending' }]);

    await ticketModule.renderTicketDashboard('ev1');
    const el = document.getElementById('ticketDashboardContainer');
    expect(el.innerHTML).toContain('Capacity');
    expect(el.innerHTML).toContain('Yes');
  });

  test('renders dashboard with null types and guests', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await ticketModule.renderTicketDashboard('ev1');
    const el = document.getElementById('ticketDashboardContainer');
    expect(el.innerHTML).toContain('No ticket types defined');
    expect(el.innerHTML).toContain('0');
  });
});

describe('Ticket Module - renderGuestPreferences branch coverage', () => {
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

  test('renders with null dietary and null notes', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [{ id: 'g1', guest_name: 'Bob', dietary_requirements: null, notes: null }],
    });
    await ticketModule.renderGuestPreferences('g1');
    const el = document.getElementById('guestPreferencesContainer');
    expect(el.innerHTML).toContain('Bob');
    // None should be selected by default when dietary is null
    expect(el.innerHTML).toContain('selected');
  });
});

describe('Ticket Module - processWaitlist branch coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('handles null types, waitlist, and guests', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const toastSpy = jest.spyOn(utils, 'showToast');

    await ticketModule.processWaitlist('ev1');
    expect(toastSpy).toHaveBeenCalledWith('No available spots.', 'info');
    toastSpy.mockRestore();
  });
});

describe('Ticket Module - createTicketCheckout with no sessionId and no url', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const el = document.getElementById('ticketPurchaseContainer');
    el.innerHTML = `
      <input type="number" class="ticket-qty" value="1" data-type-id="tt1" data-price="99" data-name="Standard">
    `;
  });

  test('does nothing when response has no sessionId and no url', async () => {
    delete global.window.stripeFrontend;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    // Should not throw
    await ticketModule.createTicketCheckout('ev1');
    expect(global.fetch).toHaveBeenCalled();
  });

  test('handles response with error message when checkout fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });
    const toastSpy = jest.spyOn(utils, 'showToast');
    await ticketModule.createTicketCheckout('ev1');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Checkout error'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Ticket Module - initTicketPurchase early bird price in purchase UI', () => {
  test('uses regular price when early bird deadline is in the past', async () => {
    const pastDeadlineTypes = [
      {
        id: 'tt-past',
        name: 'Past EB',
        price: 100,
        quantity: 50,
        description: null,
        event_id: 'ev1',
        includes_table: true,
        early_bird_price: 80,
        early_bird_deadline: '2020-01-01',
      },
    ];
    apiClient.select = jest.fn().mockResolvedValue({
      data: [{ id: 'ev1', event_name: 'Gala', event_date: '2026-06-15', venue: 'Hall' }],
    });
    apiClient.selectAll = jest.fn().mockResolvedValue(pastDeadlineTypes);
    await ticketModule.initTicketPurchase('ev1');
    const el = document.getElementById('ticketPurchaseContainer');
    // Should show 100.00 not 80.00
    expect(el.innerHTML).toContain('100.00');
    expect(el.innerHTML).toContain('Table');
  });
});

describe('Ticket Module - renderTicketTypes early bird with past deadline', () => {
  test('does not show EB badge when early bird deadline is in the past', async () => {
    const pastEBTypes = [
      {
        id: 'tt-pasteb',
        name: 'Past Deadline Type',
        price: 100,
        quantity: 50,
        description: 'desc',
        event_id: 'ev1',
        includes_table: false,
        early_bird_price: 80,
        early_bird_deadline: '2020-01-01',
      },
    ];
    apiClient.selectAll = jest.fn().mockResolvedValue(pastEBTypes);
    await ticketModule.renderTicketTypes('ev1');
    const el = document.getElementById('ticketTypesContainer');
    expect(el.innerHTML).toContain('Past Deadline Type');
    // The EB badge contains "badge bg-warning" - should not appear for past deadlines
    expect(el.innerHTML).not.toContain('badge bg-warning');
    expect(el.innerHTML).not.toContain('80.00');
  });
});

describe('Ticket Module - additional branch coverage for || fallbacks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('ticket total handles invalid/missing price and value in qty inputs (line 201 fallbacks)', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [{ id: 'ev1', event_name: 'Gala', event_date: '2026-06-15', venue: 'Hall' }],
    });
    // Provide a ticket type with no early_bird to get data-price from t.price
    apiClient.selectAll = jest.fn().mockResolvedValue([
      {
        id: 'tt-x',
        name: 'Test',
        price: 50,
        quantity: 10,
        description: '',
        event_id: 'ev1',
        includes_table: false,
        early_bird_price: null,
        early_bird_deadline: null,
      },
    ]);
    await ticketModule.initTicketPurchase('ev1');

    const el = document.getElementById('ticketPurchaseContainer');
    const qtyInputs = el.querySelectorAll('.ticket-qty');
    expect(qtyInputs.length).toBe(1);

    // Set invalid values to trigger || 0 fallbacks
    qtyInputs[0].dataset.price = 'invalid';
    qtyInputs[0].value = 'abc';
    qtyInputs[0].dispatchEvent(new dom.window.Event('input'));

    const totalEl = document.getElementById('ticketTotal');
    expect(totalEl.textContent).toContain('0.00');
  });

  test('generateETicket with guest having table_number but no seat_number (line 302)', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'g3',
          guest_name: 'Alice',
          guest_type: 'Standard',
          table_number: 'T10',
          seat_number: null,
          dietary_requirements: null,
          events: { event_name: 'Gala', event_date: '2026-06-15', venue: 'Hall' },
        },
      ],
    });
    const textCalls = [];
    global.window.jspdf = {
      jsPDF: class {
        constructor() {}
        setFillColor() {}
        rect() {}
        setTextColor() {}
        setFontSize() {}
        setFont() {}
        text(...args) {
          textCalls.push(args);
        }
        setDrawColor() {}
        line() {}
        addImage() {}
        save() {}
      },
    };
    delete global.window.QRCode;

    await ticketModule.generateETicket('g3');
    const tableCall = textCalls.find((c) => typeof c[0] === 'string' && c[0].includes('Table: T10'));
    expect(tableCall).toBeTruthy();
    expect(tableCall[0]).toContain('Seat: -');
    delete global.window.jspdf;
  });

  test('renderTicketDashboard with ticket type having null quantity (line 407)', async () => {
    let el = document.getElementById('ticketDashboardContainer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ticketDashboardContainer';
      document.body.appendChild(el);
    }
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'tt1',
          name: 'Nullqty',
          price: 99,
          quantity: null,
          includes_table: false,
          early_bird_price: null,
          early_bird_deadline: null,
        },
      ])
      .mockResolvedValueOnce([{ rsvp_status: 'confirmed' }]);

    await ticketModule.renderTicketDashboard('ev1');
    el = document.getElementById('ticketDashboardContainer');
    expect(el.innerHTML).toContain('Capacity');
    el.remove();
  });

  test('renderTicketDashboard with ticket type having null/NaN price (line 412)', async () => {
    let el = document.getElementById('ticketDashboardContainer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ticketDashboardContainer';
      document.body.appendChild(el);
    }
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'tt1',
          name: 'BadPrice',
          price: null,
          quantity: 10,
          includes_table: false,
          early_bird_price: null,
          early_bird_deadline: null,
        },
      ])
      .mockResolvedValueOnce([{ rsvp_status: 'confirmed' }]);

    await ticketModule.renderTicketDashboard('ev1');
    el = document.getElementById('ticketDashboardContainer');
    expect(el.innerHTML).toContain('Estimated Revenue');
    el.remove();
  });

  test('processWaitlist with ticket type having null quantity (line 499)', async () => {
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValueOnce([{ quantity: null }])
      .mockResolvedValueOnce([{ id: 'w1' }])
      .mockResolvedValueOnce([]);
    const toastSpy = jest.spyOn(utils, 'showToast');

    await ticketModule.processWaitlist('ev1');
    // capacity = 0, available = 0
    expect(toastSpy).toHaveBeenCalledWith('No available spots.', 'info');
    toastSpy.mockRestore();
  });

  test('processWaitlist with null waitlist and available spots (line 505 || fallback)', async () => {
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValueOnce([{ quantity: 100 }]) // types: capacity = 100
      .mockResolvedValueOnce(null) // waitlist: null triggers || []
      .mockResolvedValueOnce([]); // guests: 0, so available = 100
    const toastSpy = jest.spyOn(utils, 'showToast');

    await ticketModule.processWaitlist('ev1');
    // available = 100, waitlist is null so (null || []).length === 0 => "Waitlist is empty."
    expect(toastSpy).toHaveBeenCalledWith('Waitlist is empty.', 'info');
    toastSpy.mockRestore();
  });
});
