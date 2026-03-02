/**
 * Tests for the Calendar Module (calendar.js)
 * Run with: npx jest tests/calendar.test.js
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
  <div id="calendarContainer"></div>
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Blob = dom.window.Blob;
global.URL = { createObjectURL: jest.fn(() => 'blob:test'), revokeObjectURL: jest.fn() };

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
require('../calendar.js');
syncWindowToGlobal();

describe('Calendar Module - Structure', () => {
  test('calendarModule is defined', () => {
    expect(calendarModule).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof calendarModule.renderCalendar).toBe('function');
    expect(typeof calendarModule._navigate).toBe('function');
    expect(typeof calendarModule._showDayPanel).toBe('function');
    expect(typeof calendarModule._toICSDate).toBe('function');
    expect(typeof calendarModule._buildVEvent).toBe('function');
    expect(typeof calendarModule.exportICS).toBe('function');
    expect(typeof calendarModule.exportEventICS).toBe('function');
    expect(typeof calendarModule.exportAllEventsICS).toBe('function');
    expect(typeof calendarModule.exportDeadlinesICS).toBe('function');
  });

  test('has default state', () => {
    expect(typeof calendarModule._currentMonth).toBe('number');
    expect(typeof calendarModule._currentYear).toBe('number');
  });
});

describe('Calendar Module - _navigate', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('increments month by 1', () => {
    calendarModule._currentMonth = 5;
    calendarModule._currentYear = 2026;
    jest.spyOn(calendarModule, 'renderCalendar').mockImplementation(() => {});
    calendarModule._navigate(1, 'calendarContainer');
    expect(calendarModule._currentMonth).toBe(6);
    expect(calendarModule._currentYear).toBe(2026);
  });

  test('wraps to next year on December increment', () => {
    calendarModule._currentMonth = 11;
    calendarModule._currentYear = 2026;
    jest.spyOn(calendarModule, 'renderCalendar').mockImplementation(() => {});
    calendarModule._navigate(1, 'calendarContainer');
    expect(calendarModule._currentMonth).toBe(0);
    expect(calendarModule._currentYear).toBe(2027);
  });

  test('wraps to previous year on January decrement', () => {
    calendarModule._currentMonth = 0;
    calendarModule._currentYear = 2026;
    jest.spyOn(calendarModule, 'renderCalendar').mockImplementation(() => {});
    calendarModule._navigate(-1, 'calendarContainer');
    expect(calendarModule._currentMonth).toBe(11);
    expect(calendarModule._currentYear).toBe(2025);
  });
});

describe('Calendar Module - _toICSDate', () => {
  test('converts a date string to ICS format', () => {
    const result = calendarModule._toICSDate('2026-03-15');
    expect(result).toMatch(/^\d{8}T\d{6}Z$/);
  });

  test('returns empty string for null input', () => {
    expect(calendarModule._toICSDate(null)).toBe('');
    expect(calendarModule._toICSDate('')).toBe('');
  });
});

describe('Calendar Module - _buildVEvent', () => {
  test('builds a valid ICS VEVENT block', () => {
    const item = {
      type: 'ceremony',
      label: 'Annual Awards',
      detail: 'The Grand Hall',
      ref: { id: 'ev-1', event_date: '2026-06-15', venue: 'The Grand Hall' },
    };
    const vevent = calendarModule._buildVEvent(item);
    expect(vevent).toContain('BEGIN:VEVENT');
    expect(vevent).toContain('END:VEVENT');
    expect(vevent).toContain('SUMMARY:Annual Awards');
    expect(vevent).toContain('LOCATION:The Grand Hall');
  });
});

describe('Calendar Module - exportICS', () => {
  test('shows warning when no items', () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    calendarModule.exportICS([]);
    expect(toastSpy).toHaveBeenCalledWith('No items to export', 'warning');
    toastSpy.mockRestore();
  });

  test('shows warning for null items', () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    calendarModule.exportICS(null);
    expect(toastSpy).toHaveBeenCalledWith('No items to export', 'warning');
    toastSpy.mockRestore();
  });
});

describe('Calendar Module - _showDayPanel', () => {
  test('shows no items message for empty day', () => {
    const panel = document.createElement('div');
    panel.id = 'cal-day-panel-calendarContainer';
    document.body.appendChild(panel);
    calendarModule._dayItems = {};
    calendarModule._showDayPanel('2026-03-01', 'calendarContainer');
    expect(panel.innerHTML).toContain('No items for this day');
  });

  test('renders items for a day with events', () => {
    let panel = document.getElementById('cal-day-panel-calendarContainer');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'cal-day-panel-calendarContainer';
      document.body.appendChild(panel);
    }
    calendarModule._dayItems = {
      '2026-06-15': [
        {
          type: 'ceremony',
          color: 'primary',
          label: 'Awards Night',
          detail: 'Grand Hall',
          ref: { id: 'ev1', event_date: '2026-06-15' },
        },
        {
          type: 'followup',
          color: 'success',
          label: 'Follow up Joe',
          detail: 'Pending',
          ref: { id: 'fu1', follow_up_date: '2026-06-15' },
        },
      ],
    };
    calendarModule._showDayPanel('2026-06-15', 'calendarContainer');
    expect(panel.style.display).toBe('block');
    expect(panel.innerHTML).toContain('Awards Night');
    expect(panel.innerHTML).toContain('Follow up Joe');
    expect(panel.innerHTML).toContain('Grand Hall');
    expect(panel.innerHTML).toContain('Export');
  });

  test('returns early if panel not found', () => {
    calendarModule._dayItems = {};
    // Should not throw
    expect(() => calendarModule._showDayPanel('2026-01-01', 'nonExistentId')).not.toThrow();
  });
});

describe('Calendar Module - _fetchAllItems', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetches and categorizes all item types', async () => {
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'ev1', event_name: 'Gala', event_date: '2026-06-15', venue: 'Hall' }])
      .mockResolvedValueOnce([
        { id: 'se1', name: 'Season 2026', entry_close_date: '2026-06-10', judging_close_date: '2026-06-20' },
      ])
      .mockResolvedValueOnce([
        { id: 'fu1', organisation_id: 'org1', follow_up_date: '2026-06-12', note: 'Call back', completed: false },
      ])
      .mockResolvedValueOnce([
        {
          id: 'inv1',
          invoice_number: 'INV-001',
          due_date: '2026-06-18',
          total_amount: 500,
          organisations: { company_name: 'Acme' },
        },
      ]);

    const items = await calendarModule._fetchAllItems(5, 2026); // June 2026 (0-indexed month=5)
    expect(items['2026-06-15']).toBeDefined();
    expect(items['2026-06-15'][0].type).toBe('ceremony');
    expect(items['2026-06-10']).toBeDefined();
    expect(items['2026-06-10'][0].type).toBe('entry_deadline');
    expect(items['2026-06-20']).toBeDefined();
    expect(items['2026-06-20'][0].type).toBe('judging_deadline');
    expect(items['2026-06-12']).toBeDefined();
    expect(items['2026-06-12'][0].type).toBe('followup');
    expect(items['2026-06-18']).toBeDefined();
    expect(items['2026-06-18'][0].type).toBe('payment');
  });

  test('handles invoice FK error with relationship message and retries', async () => {
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('Could not find relationship'))
      .mockResolvedValueOnce([{ id: 'inv1', invoice_number: 'INV-002', due_date: '2026-06-05', total_amount: 200 }]);

    const items = await calendarModule._fetchAllItems(5, 2026);
    expect(items['2026-06-05']).toBeDefined();
    expect(items['2026-06-05'][0].type).toBe('payment');
  });

  test('handles invoice FK error with schema cache message and retries', async () => {
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('schema cache lookup failed'))
      .mockResolvedValueOnce([]);

    const items = await calendarModule._fetchAllItems(5, 2026);
    expect(items).toBeDefined();
  });

  test('rethrows non-relationship invoice errors', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const toastSpy = jest.spyOn(utils, 'showToast');
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('Some other DB error'));

    const _items = await calendarModule._fetchAllItems(5, 2026);
    expect(toastSpy).toHaveBeenCalledWith('Failed to load calendar data', 'warning');
    consoleSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('handles null data arrays gracefully', async () => {
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const items = await calendarModule._fetchAllItems(5, 2026);
    expect(items).toEqual({});
  });

  test('handles complete fetch failure', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const toastSpy = jest.spyOn(utils, 'showToast');
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('Network down'));

    const _items = await calendarModule._fetchAllItems(0, 2026);
    expect(toastSpy).toHaveBeenCalledWith('Failed to load calendar data', 'warning');
    consoleSpy.mockRestore();
    toastSpy.mockRestore();
  });
});

describe('Calendar Module - renderCalendar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Remove existing cal-styles
    const existing = document.getElementById('cal-styles');
    if (existing) existing.remove();
  });

  test('renders calendar grid into container', async () => {
    // _fetchAllItems makes 4 selectAll calls (events, seasons, follow-ups, invoices)
    const origFetch = calendarModule._fetchAllItems;
    calendarModule._fetchAllItems = jest.fn().mockResolvedValue({});
    const container = document.getElementById('calendarContainer');
    await calendarModule.renderCalendar('calendarContainer', 2, 2026); // March 2026
    expect(container.innerHTML).toContain('March 2026');
    expect(container.innerHTML).toContain('Su');
    expect(container.innerHTML).toContain('Ceremony');
    expect(container.innerHTML).toContain('Entry Deadline');
    expect(container.innerHTML).toContain('Payment Due');
    calendarModule._fetchAllItems = origFetch;
  });

  test('returns early if container not found', async () => {
    const result = await calendarModule.renderCalendar('nonExistentContainer');
    expect(result).toBeUndefined();
  });

  test('uses current month/year when not specified', async () => {
    const origFetch = calendarModule._fetchAllItems;
    calendarModule._fetchAllItems = jest.fn().mockResolvedValue({});
    calendarModule._currentMonth = 0;
    calendarModule._currentYear = 2026;
    await calendarModule.renderCalendar('calendarContainer');
    const container = document.getElementById('calendarContainer');
    expect(container.innerHTML).toContain('January 2026');
    calendarModule._fetchAllItems = origFetch;
  });

  test('renders with day items highlighted', async () => {
    const origFetch = calendarModule._fetchAllItems;
    calendarModule._fetchAllItems = jest.fn().mockResolvedValue({
      '2026-06-15': [{ type: 'ceremony', color: 'primary', label: 'Gala', detail: '', ref: {} }],
    });
    const container = document.getElementById('calendarContainer');
    await calendarModule.renderCalendar('calendarContainer', 5, 2026);
    expect(container.innerHTML).toContain('June 2026');
    expect(container.innerHTML).toContain('cal-has-items');
    expect(container.innerHTML).toContain('bg-primary');
    calendarModule._fetchAllItems = origFetch;
  });
});

describe('Calendar Module - exportICS with items', () => {
  test('creates ICS file and triggers download', () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    const items = [
      {
        type: 'ceremony',
        color: 'primary',
        label: 'Gala Night',
        detail: 'Big Venue',
        ref: { id: 'e1', event_date: '2026-06-15', venue: 'Big Venue' },
      },
    ];
    calendarModule.exportICS(items);
    expect(toastSpy).toHaveBeenCalledWith('Calendar file downloaded', 'success');
    toastSpy.mockRestore();
  });

  test('looks up date string in _dayItems', () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    calendarModule._dayItems = {
      '2026-06-15': [
        {
          type: 'ceremony',
          color: 'primary',
          label: 'Awards',
          detail: '',
          ref: { id: 'e1', event_date: '2026-06-15' },
        },
      ],
    };
    calendarModule.exportICS('2026-06-15');
    expect(toastSpy).toHaveBeenCalledWith('Calendar file downloaded', 'success');
    toastSpy.mockRestore();
  });

  test('shows warning for date string with no items', () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    calendarModule._dayItems = {};
    calendarModule.exportICS('2026-06-15');
    expect(toastSpy).toHaveBeenCalledWith('No items to export', 'warning');
    toastSpy.mockRestore();
  });
});

describe('Calendar Module - _toICSDate with endTime', () => {
  test('uses 17:00 for end time', () => {
    const result = calendarModule._toICSDate('2026-06-15', true);
    expect(result).toContain('T170000Z');
  });

  test('uses 09:00 for start time', () => {
    const result = calendarModule._toICSDate('2026-06-15', false);
    expect(result).toContain('T090000Z');
  });

  test('handles full datetime string', () => {
    const result = calendarModule._toICSDate('2026-06-15T14:30:00Z');
    expect(result).toMatch(/^\d{8}T\d{6}Z$/);
  });
});

describe('Calendar Module - _buildVEvent edge cases', () => {
  test('builds event without venue', () => {
    const item = {
      type: 'entry_deadline',
      label: 'Entry Due',
      detail: '',
      ref: { id: 's1', entry_close_date: '2026-06-10' },
    };
    const vevent = calendarModule._buildVEvent(item);
    expect(vevent).toContain('SUMMARY:Entry Due');
    expect(vevent).not.toContain('LOCATION');
  });

  test('builds event without detail', () => {
    const item = { type: 'followup', label: 'Follow-up', detail: '', ref: { id: 'f1', follow_up_date: '2026-06-12' } };
    const vevent = calendarModule._buildVEvent(item);
    expect(vevent).toContain('BEGIN:VEVENT');
    expect(vevent).not.toContain('DESCRIPTION');
  });

  test('builds event with multiline detail', () => {
    const item = {
      type: 'ceremony',
      label: 'Awards',
      detail: 'Line1\nLine2',
      ref: { id: 'e1', event_date: '2026-06-15', venue: 'Hall' },
    };
    const vevent = calendarModule._buildVEvent(item);
    expect(vevent).toContain('DESCRIPTION:Line1\\nLine2');
  });

  test('generates uid with Date.now when ref has no id', () => {
    const item = { type: 'payment', label: 'Invoice due', detail: '', ref: {} };
    const vevent = calendarModule._buildVEvent(item);
    expect(vevent).toContain('UID:');
    expect(vevent).toContain('@bta-cms');
  });
});

describe('Calendar Module - exportEventICS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('exports single event as ICS', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [{ id: 'ev1', event_name: 'Awards Night', event_date: '2026-06-15', venue: 'Grand Hall' }],
    });
    const exportSpy = jest.spyOn(calendarModule, 'exportICS');
    await calendarModule.exportEventICS('ev1');
    expect(exportSpy).toHaveBeenCalledWith([expect.objectContaining({ type: 'ceremony', label: 'Awards Night' })]);
    exportSpy.mockRestore();
  });

  test('shows error when event not found', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    const toastSpy = jest.spyOn(utils, 'showToast');
    await calendarModule.exportEventICS('missing-id');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to export event'), 'error');
    toastSpy.mockRestore();
  });

  test('shows error on API failure', async () => {
    apiClient.select = jest.fn().mockRejectedValue(new Error('DB error'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await calendarModule.exportEventICS('ev1');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to export event'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Calendar Module - exportAllEventsICS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('exports all future events', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([
      { id: 'e1', event_name: 'Gala', event_date: '2027-01-15', venue: 'Hall' },
      { id: 'e2', event_name: 'Awards', event_date: '2027-03-20', venue: '' },
    ]);
    const exportSpy = jest.spyOn(calendarModule, 'exportICS');
    await calendarModule.exportAllEventsICS();
    expect(exportSpy).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ label: 'Gala' }), expect.objectContaining({ label: 'Awards' })])
    );
    exportSpy.mockRestore();
  });

  test('handles API error gracefully', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('fail'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await calendarModule.exportAllEventsICS();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to export events'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Calendar Module - exportDeadlinesICS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('exports entry and judging deadlines', async () => {
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValue([
        { id: 's1', name: 'Season 2027', entry_close_date: '2027-06-01', judging_close_date: '2027-07-01' },
      ]);
    const exportSpy = jest.spyOn(calendarModule, 'exportICS');
    await calendarModule.exportDeadlinesICS();
    expect(exportSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ type: 'entry_deadline' }),
        expect.objectContaining({ type: 'judging_deadline' }),
      ])
    );
    exportSpy.mockRestore();
  });

  test('handles error gracefully', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('DB err'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await calendarModule.exportDeadlinesICS();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to export deadlines'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Calendar Module - exportMyCalendarICS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('exports combined calendar with all item types', async () => {
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'e1', event_name: 'Gala', event_date: '2027-06-15', venue: 'Hall' }])
      .mockResolvedValueOnce([
        { id: 's1', name: 'Season', entry_close_date: '2027-05-01', judging_close_date: '2027-06-01' },
      ])
      .mockResolvedValueOnce([{ id: 'f1', note: 'Call', follow_up_date: '2027-06-10', completed: false }])
      .mockResolvedValueOnce([
        { id: 'i1', invoice_number: 'INV-1', due_date: '2027-06-20', organisations: { company_name: 'Acme' } },
      ]);

    const exportSpy = jest.spyOn(calendarModule, 'exportICS');
    await calendarModule.exportMyCalendarICS();
    expect(exportSpy).toHaveBeenCalled();
    const args = exportSpy.mock.calls[0][0];
    expect(args.length).toBeGreaterThanOrEqual(4);
    exportSpy.mockRestore();
  });

  test('retries invoice fetch on FK error', async () => {
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('FK error'))
      .mockResolvedValueOnce([]);

    const exportSpy = jest.spyOn(calendarModule, 'exportICS');
    await calendarModule.exportMyCalendarICS();
    expect(exportSpy).toHaveBeenCalled();
    exportSpy.mockRestore();
  });

  test('handles overall error', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('fail'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await calendarModule.exportMyCalendarICS();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to export calendar'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Calendar Module - renderUpcomingWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const container = document.createElement('div');
    container.id = 'upcomingWidget';
    document.body.appendChild(container);
  });

  afterEach(() => {
    const el = document.getElementById('upcomingWidget');
    if (el) el.remove();
  });

  test('renders upcoming items', async () => {
    apiClient.select = jest
      .fn()
      .mockResolvedValueOnce({ data: [{ id: 'e1', event_name: 'Gala', event_date: '2027-06-15' }] })
      .mockResolvedValueOnce({ data: [{ id: 'f1', note: 'Call back', follow_up_date: '2027-06-10' }] });
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValueOnce([
        { id: 's1', name: 'Season 2027', entry_close_date: '2027-06-01', judging_close_date: '2027-07-01' },
      ]);
    // Second call for invoice select
    apiClient.select.mockResolvedValueOnce({ data: [{ id: 'i1', invoice_number: 'INV-1', due_date: '2027-06-20' }] });

    await calendarModule.renderUpcomingWidget('upcomingWidget');
    const container = document.getElementById('upcomingWidget');
    expect(container.innerHTML).toContain('Gala');
  });

  test('shows empty message when no upcoming items', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    apiClient.selectAll = jest.fn().mockResolvedValue([]);

    await calendarModule.renderUpcomingWidget('upcomingWidget');
    const container = document.getElementById('upcomingWidget');
    expect(container.innerHTML).toContain('No upcoming items');
  });

  test('returns early when container not found', async () => {
    const result = await calendarModule.renderUpcomingWidget('noSuchId');
    expect(result).toBeUndefined();
  });

  test('handles fetch error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    apiClient.select = jest.fn().mockRejectedValue(new Error('fail'));
    await calendarModule.renderUpcomingWidget('upcomingWidget');
    const container = document.getElementById('upcomingWidget');
    expect(container.innerHTML).toContain('Failed to load upcoming items');
    consoleSpy.mockRestore();
  });

  test('re-throws non-relationship invoice errors', async () => {
    apiClient.select = jest
      .fn()
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockRejectedValueOnce(new Error('network timeout'));
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await calendarModule.renderUpcomingWidget('upcomingWidget');
    const container = document.getElementById('upcomingWidget');
    expect(container.innerHTML).toContain('Failed to load upcoming items');
    consoleSpy.mockRestore();
  });

  test('retries invoice without FK join on relationship error', async () => {
    apiClient.select = jest
      .fn()
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockRejectedValueOnce(new Error('Could not find relationship'))
      .mockResolvedValueOnce({ data: [] });
    apiClient.selectAll = jest.fn().mockResolvedValue([]);

    await calendarModule.renderUpcomingWidget('upcomingWidget');
    const container = document.getElementById('upcomingWidget');
    expect(container.innerHTML).toContain('No upcoming items');
  });
});

describe('Calendar Module - generateCalendarFeedUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.currentUser = { id: 'u1', email: 'admin@test.com' };
  });

  test('generates feed URL on success', async () => {
    global.crypto = { randomUUID: () => 'test-uuid-123' };
    apiClient.insert = jest.fn().mockResolvedValue({ data: { token: 'test-uuid-123' } });
    const toastSpy = jest.spyOn(utils, 'showToast');
    const url = await calendarModule.generateCalendarFeedUrl();
    expect(url).toContain('token=test-uuid-123');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Calendar feed URL generated'), 'success');
    toastSpy.mockRestore();
  });

  test('returns fallback URL on error', async () => {
    apiClient.insert = jest.fn().mockRejectedValue(new Error('table not found'));
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    const toastSpy = jest.spyOn(utils, 'showToast');
    const url = await calendarModule.generateCalendarFeedUrl();
    expect(url).toContain('calendar.js?feed=1');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Feed URL unavailable'), 'warning');
    consoleSpy.mockRestore();
    toastSpy.mockRestore();
  });
});
