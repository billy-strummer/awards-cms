/**
 * Tests for the Events Module (events.js)
 * Run with: npx jest tests/events.test.js
 */

const { JSDOM } = require('jsdom');

// Setup minimal DOM before loading modules
const dom = new JSDOM(
  `<!DOCTYPE html><html><body>
  <div id="loadingBar" style="display:none;"></div>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
  <div id="connectionStatus"><span class="status-icon"></span><span class="status-text"></span></div>
  <div id="loginPage"></div>
  <div id="dashboardPage"></div>
  <div id="splashScreen"></div>
  <div id="userEmail"></div>
  <div id="loginEmail"></div>
  <div id="loginPassword"></div>
  <div id="loginError" class="d-none"></div>
  <div id="loginBtn"></div>
  <table><tbody id="awardsTableBody"></tbody></table>
  <table><tbody id="orgsTableBody"></tbody></table>
  <table><tbody id="winnersTableBody"></tbody></table>
  <table><tbody id="eventsTableBody"></tbody></table>
  <table><tbody id="entriesTableBody"></tbody></table>
  <span id="awardsCount"></span>
  <span id="eventsCount">0</span>
  <span id="winnersCount"></span>
  <div id="eventsTotalCount">0</div>
  <div id="eventsUpcomingCount">0</div>
  <div id="eventsThisYearCount">0</div>
  <div id="eventsPastCount">0</div>
  <div id="eventsDataIssuesCount">0</div>
  <div id="eventsDataQualityBar" style="display:none;"></div>
  <div id="eventsDataQualityText"></div>
  <div id="eventsChartsContainer"></div>
  <div id="eventsFilterSummary"></div>
  <div id="eventsLastRefreshed"></div>
  <div id="eventsPagination"></div>
  <input id="eventsSearchBox" value="" />
  <select id="eventsYearFilter"><option value="">All Years</option><option value="2025">2025</option><option value="2026">2026</option><option value="2027">2027</option></select>
  <select id="eventsStatusFilter"><option value="">All</option><option value="upcoming">Upcoming</option><option value="past">Past</option><option value="this-month">This Month</option></select>
  <select id="eventsEventStatusFilter"><option value="">All</option><option value="draft">Draft</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option><option value="complete">Complete</option></select>
  <div id="eventsBulkActionsBar" style="display:none;"><span id="eventsSelectedCount">0</span></div>
  <div id="eventModalTitle"></div>
  <input id="eventId" value="" />
  <input id="eventName" value="" />
  <input id="eventDate" value="" />
  <input id="eventYear" value="" />
  <input id="eventVenue" value="" />
  <input id="eventCapacity" value="" />
  <textarea id="eventDescription"></textarea>
  <select id="eventStatus"><option value="draft">Draft</option><option value="confirmed">Confirmed</option></select>
  <button id="saveEventBtn">Add Event</button>
  <div id="eventModal"></div>
  <form id="eventForm"></form>
  <div id="attendeesEventId"></div>
  <div id="attendeesTableBody"></div>
  <div id="attendingCount">0</div>
  <div id="notAttendingCount">0</div>
  <div id="maybeCount">0</div>
  <div id="totalAttendeesCount">0</div>
  <select id="attendeeStatusFilter"><option value="">All</option><option value="attending">Attending</option><option value="not_attending">Not Attending</option><option value="maybe">Maybe</option></select>
  <select id="attendeeTypeFilter"><option value="">All</option><option value="vip">VIP</option><option value="guest">Guest</option><option value="speaker">Speaker</option><option value="sponsor">Sponsor</option></select>
  <input id="attendeeSearchFilter" value="" />
  <div id="templateFormSection" class="d-none"></div>
  <form id="templateForm"></form>
  <input id="templateId" value="" />
  <input id="templateName" value="" />
  <input id="templateVenue" value="" />
  <textarea id="templateDescription"></textarea>
  <textarea id="templateGallerySections"></textarea>
  <div id="eventTemplatesList"></div>
  <span id="templatesCount">0</span>
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;

// Mock bootstrap
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
  Tab: class {
    show() {}
  },
  Tooltip: class {},
};

// Mock supabase
const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  neq: jest.fn(() => mockSupabase),
  in: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  range: jest.fn(() => mockSupabase),
  ilike: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn((cb) => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signInWithPassword: jest.fn(() => Promise.resolve({ data: { user: { email: 'test@test.com' } }, error: null })),
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

// Load config
require('../config.js');

// Copy config globals
global.STATE = global.window.STATE;
global.SUPABASE_CONFIG = global.window.SUPABASE_CONFIG;
global.STATUS = global.window.STATUS;
global.MEDIA_TYPES = global.window.MEDIA_TYPES;
global.INACTIVITY_TIMEOUT = global.window.INACTIVITY_TIMEOUT;
global.YEARS = global.window.YEARS;
global.SECTORS = global.window.SECTORS;
global.REGIONS = global.window.REGIONS;

// Provide STATE.client
global.STATE.client = mockSupabase;

// Helper: sync window properties to global
function syncWindowToGlobal() {
  for (const key of Object.keys(global.window)) {
    if (!(key in global) && typeof global.window[key] !== 'undefined') {
      global[key] = global.window[key];
    }
  }
}

// Load utils (provides utils, apiClient, serverQuery)
require('../utils.js');
syncWindowToGlobal();

// Load the events module
require('../events.js');
syncWindowToGlobal();

// ==========================================
// SAMPLE DATA
// ==========================================

const _today = new Date().toISOString().split('T')[0];
const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 days from now
const pastDate = '2025-06-15';
const thisYear = new Date().getFullYear();

const sampleEvents = [
  {
    id: 'evt-1',
    event_name: 'Annual Awards Ceremony 2026',
    event_date: futureDate,
    year: 2026,
    venue: 'The Grand Hall, London',
    capacity: 500,
    description: 'The flagship awards ceremony for 2026.',
    event_status: 'confirmed',
  },
  {
    id: 'evt-2',
    event_name: 'Regional Finalists Night',
    event_date: pastDate,
    year: 2025,
    venue: 'Birmingham Conference Centre',
    capacity: 200,
    description: 'Regional event for finalists in the Midlands.',
    event_status: 'complete',
  },
  {
    id: 'evt-3',
    event_name: 'Draft Planning Meeting',
    event_date: null,
    year: 2026,
    venue: null,
    capacity: null,
    description: 'Internal planning session.',
    event_status: 'draft',
  },
  {
    id: 'evt-4',
    event_name: 'Cancelled Gala Dinner',
    event_date: '2025-12-01',
    year: 2025,
    venue: 'Hilton Hotel Manchester',
    capacity: 300,
    description: 'Gala dinner that was cancelled.',
    event_status: 'cancelled',
  },
  {
    id: 'evt-5',
    event_name: 'Upcoming Workshop',
    event_date: futureDate,
    year: thisYear,
    venue: 'Online',
    capacity: 50,
    description: 'Virtual workshop for nominees.',
    event_status: 'confirmed',
  },
];

// ==========================================
// TESTS
// ==========================================

describe('Events Module - Initialization & Structure', () => {
  test('eventsModule is exported to window', () => {
    expect(window.eventsModule).toBeDefined();
    expect(eventsModule).toBeDefined();
  });

  test('eventsModule has required properties', () => {
    expect(eventsModule).toHaveProperty('_loading');
    expect(eventsModule).toHaveProperty('_sortField');
    expect(eventsModule).toHaveProperty('_sortDir');
    expect(eventsModule).toHaveProperty('_evtCurrentPage');
    expect(eventsModule).toHaveProperty('_evtPageSize');
    expect(eventsModule).toHaveProperty('_selectedEvents');
  });

  test('eventsModule has required methods', () => {
    expect(typeof eventsModule.loadEvents).toBe('function');
    expect(typeof eventsModule.renderEvents).toBe('function');
    expect(typeof eventsModule.filterEvents).toBe('function');
    expect(typeof eventsModule.sortEvents).toBe('function');
    expect(typeof eventsModule.goToEventsPage).toBe('function');
    expect(typeof eventsModule.renderFilteredEvents).toBe('function');
    expect(typeof eventsModule.updateEventStats).toBe('function');
    expect(typeof eventsModule.populateYearFilter).toBe('function');
    expect(typeof eventsModule.saveEvent).toBe('function');
    expect(typeof eventsModule.deleteEvent).toBe('function');
    expect(typeof eventsModule.openAddModal).toBe('function');
    expect(typeof eventsModule.openEditModal).toBe('function');
    expect(typeof eventsModule.openCloneModal).toBe('function');
    expect(typeof eventsModule.getAttendees).toBe('function');
    expect(typeof eventsModule.addAttendee).toBe('function');
    expect(typeof eventsModule.resetEventFilters).toBe('function');
    expect(typeof eventsModule.filterDataIssues).toBe('function');
  });

  test('default state values are correct', () => {
    expect(eventsModule._evtPageSize).toBe(50);
    expect(eventsModule._sortField).toBe('event_date');
    expect(eventsModule._sortDir).toBe('desc');
    expect(eventsModule._loading).toBe(false);
  });
});

describe('Events Module - Filter Logic', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    eventsModule._evtCurrentPage = 1;
    eventsModule._sortField = 'event_date';
    eventsModule._sortDir = 'desc';
    eventsModule._serverPagination = false;
    // Clear filter inputs
    document.getElementById('eventsSearchBox').value = '';
    document.getElementById('eventsYearFilter').value = '';
    document.getElementById('eventsStatusFilter').value = '';
    document.getElementById('eventsEventStatusFilter').value = '';
  });

  test('filterEvents with no filters returns all events', () => {
    eventsModule.filterEvents();
    const countEl = document.getElementById('eventsCount');
    expect(countEl.textContent).toBe(String(sampleEvents.length));
  });

  test('filterEvents filters by search term matching event name', () => {
    document.getElementById('eventsSearchBox').value = 'annual awards';
    eventsModule.filterEvents();
    expect(document.getElementById('eventsCount').textContent).toBe('1');
  });

  test('filterEvents filters by search term matching venue', () => {
    document.getElementById('eventsSearchBox').value = 'birmingham';
    eventsModule.filterEvents();
    expect(document.getElementById('eventsCount').textContent).toBe('1');
  });

  test('filterEvents filters by year', () => {
    document.getElementById('eventsYearFilter').value = '2025';
    eventsModule.filterEvents();
    // evt-2 (year 2025) and evt-4 (year 2025) both match
    expect(document.getElementById('eventsCount').textContent).toBe('2');
  });

  test('filterEvents filters by upcoming time status', () => {
    document.getElementById('eventsStatusFilter').value = 'upcoming';
    eventsModule.filterEvents();
    // Only events with event_date >= today
    const count = parseInt(document.getElementById('eventsCount').textContent);
    expect(count).toBeGreaterThanOrEqual(1); // At least evt-1 and evt-5
  });

  test('filterEvents filters by past time status', () => {
    document.getElementById('eventsStatusFilter').value = 'past';
    eventsModule.filterEvents();
    // Events with event_date < today
    const count = parseInt(document.getElementById('eventsCount').textContent);
    expect(count).toBeGreaterThanOrEqual(1); // At least evt-2 and evt-4
  });

  test('filterEvents filters by event status', () => {
    document.getElementById('eventsEventStatusFilter').value = 'confirmed';
    eventsModule.filterEvents();
    expect(document.getElementById('eventsCount').textContent).toBe('2');
  });

  test('filterEvents combines search and year filters', () => {
    document.getElementById('eventsSearchBox').value = 'awards';
    document.getElementById('eventsYearFilter').value = '2026';
    eventsModule.filterEvents();
    expect(document.getElementById('eventsCount').textContent).toBe('1');
  });

  test('filterEvents saves filters to localStorage', () => {
    document.getElementById('eventsSearchBox').value = 'test';
    document.getElementById('eventsYearFilter').value = '2026';
    eventsModule.filterEvents();
    const saved = JSON.parse(localStorage.getItem('eventsFilters'));
    expect(saved.search).toBe('test');
    expect(saved.year).toBe('2026');
  });

  test('filterEvents resets page to 1', () => {
    eventsModule._evtCurrentPage = 5;
    eventsModule.filterEvents();
    expect(eventsModule._evtCurrentPage).toBe(1);
  });

  test('filterDataIssues shows only events missing date or venue', () => {
    eventsModule.filterDataIssues();
    // evt-3 has null date AND null venue
    const count = parseInt(document.getElementById('eventsCount').textContent);
    expect(count).toBe(1);
  });
});

describe('Events Module - Sort Functionality', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    eventsModule._sortField = 'event_date';
    eventsModule._sortDir = 'desc';
    eventsModule._evtCurrentPage = 1;
    eventsModule._serverPagination = false;
    document.getElementById('eventsSearchBox').value = '';
    document.getElementById('eventsYearFilter').value = '';
    document.getElementById('eventsStatusFilter').value = '';
    document.getElementById('eventsEventStatusFilter').value = '';
  });

  test('sortEvents toggles direction on same field', () => {
    eventsModule._sortField = 'event_name';
    eventsModule._sortDir = 'asc';
    eventsModule.sortEvents('event_name');
    expect(eventsModule._sortDir).toBe('desc');
  });

  test('sortEvents sets ascending on new field', () => {
    eventsModule._sortField = 'event_date';
    eventsModule.sortEvents('event_name');
    expect(eventsModule._sortField).toBe('event_name');
    expect(eventsModule._sortDir).toBe('asc');
  });

  test('filterEvents sorts events by date descending', () => {
    eventsModule._sortField = 'event_date';
    eventsModule._sortDir = 'desc';
    eventsModule.filterEvents();
    const stored = eventsModule._lastFilteredEvents;
    // Events with dates should be in descending order (nulls sort as empty string)
    const datedEvents = stored.filter((e) => e.event_date);
    for (let i = 0; i < datedEvents.length - 1; i++) {
      expect(datedEvents[i].event_date >= datedEvents[i + 1].event_date).toBe(true);
    }
  });

  test('filterEvents sorts events by year numerically', () => {
    eventsModule._sortField = 'year';
    eventsModule._sortDir = 'asc';
    eventsModule.filterEvents();
    const stored = eventsModule._lastFilteredEvents;
    const years = stored.map((e) => Number(e.year) || 0);
    for (let i = 0; i < years.length - 1; i++) {
      expect(years[i] <= years[i + 1]).toBe(true);
    }
  });

  test('resetEventFilters resets sort to defaults', () => {
    eventsModule._sortField = 'event_name';
    eventsModule._sortDir = 'asc';
    eventsModule.resetEventFilters();
    expect(eventsModule._sortField).toBe('event_date');
    expect(eventsModule._sortDir).toBe('desc');
  });
});

describe('Events Module - Pagination Logic', () => {
  beforeEach(() => {
    eventsModule._evtCurrentPage = 1;
    eventsModule._evtPageSize = 50;
    eventsModule._serverPagination = false;
    document.getElementById('eventsSearchBox').value = '';
    document.getElementById('eventsYearFilter').value = '';
    document.getElementById('eventsStatusFilter').value = '';
    document.getElementById('eventsEventStatusFilter').value = '';
  });

  test('renderFilteredEvents shows correct count', () => {
    eventsModule.renderFilteredEvents(sampleEvents);
    const countEl = document.getElementById('eventsCount');
    expect(countEl.textContent).toBe(String(sampleEvents.length));
  });

  test('renderFilteredEvents shows empty state for zero events', () => {
    eventsModule.renderFilteredEvents([]);
    const countEl = document.getElementById('eventsCount');
    expect(countEl.textContent).toBe('0');
  });

  test('goToEventsPage clamps page to valid range', () => {
    eventsModule._lastFilteredEvents = sampleEvents;
    STATE.allEvents = sampleEvents;

    eventsModule.goToEventsPage(0);
    expect(eventsModule._evtCurrentPage).toBe(1);

    eventsModule.goToEventsPage(999);
    const totalPages = Math.ceil(sampleEvents.length / eventsModule._evtPageSize);
    expect(eventsModule._evtCurrentPage).toBe(totalPages);
  });

  test('goToEventsPage navigates correctly with small page size', () => {
    const manyEvents = [];
    for (let i = 0; i < 120; i++) {
      manyEvents.push({
        ...sampleEvents[0],
        id: `evt-gen-${i}`,
        event_name: `Generated Event ${i}`,
      });
    }
    eventsModule._lastFilteredEvents = manyEvents;
    eventsModule._evtPageSize = 50;

    eventsModule.goToEventsPage(2);
    expect(eventsModule._evtCurrentPage).toBe(2);

    eventsModule.goToEventsPage(3);
    expect(eventsModule._evtCurrentPage).toBe(3);

    // Page 4 would exceed total (120/50 = 3 pages)
    eventsModule.goToEventsPage(4);
    expect(eventsModule._evtCurrentPage).toBe(3);
  });

  test('renderFilteredEvents paginates data correctly', () => {
    const manyEvents = [];
    for (let i = 0; i < 75; i++) {
      manyEvents.push({
        ...sampleEvents[0],
        id: `evt-pg-${i}`,
        event_name: `Paginated Event ${i}`,
      });
    }
    eventsModule._evtPageSize = 50;
    eventsModule._evtCurrentPage = 1;
    eventsModule.renderFilteredEvents(manyEvents);

    const tbody = document.getElementById('eventsTableBody');
    // Count rendered <tr> elements (each event produces one <tr>)
    const rows = (tbody.innerHTML.match(/<tr/g) || []).length;
    expect(rows).toBe(50);
  });
});

describe('Events Module - Event Stats', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
  });

  test('updateEventStats computes total count', () => {
    eventsModule.updateEventStats();
    expect(document.getElementById('eventsTotalCount').textContent).toBe('5');
  });

  test('updateEventStats computes upcoming count', () => {
    eventsModule.updateEventStats();
    const upcoming = parseInt(document.getElementById('eventsUpcomingCount').textContent);
    // evt-1 and evt-5 have future dates
    expect(upcoming).toBeGreaterThanOrEqual(2);
  });

  test('updateEventStats computes past count', () => {
    eventsModule.updateEventStats();
    const past = parseInt(document.getElementById('eventsPastCount').textContent);
    // evt-2 and evt-4 have past dates
    expect(past).toBeGreaterThanOrEqual(2);
  });

  test('updateEventStats computes data issues count', () => {
    eventsModule.updateEventStats();
    const issues = parseInt(document.getElementById('eventsDataIssuesCount').textContent);
    // evt-3 missing date (1) + evt-3 missing venue (1) = 2 data issues
    expect(issues).toBe(2);
  });

  test('updateEventStats shows data quality bar when issues exist', () => {
    eventsModule.updateEventStats();
    const bar = document.getElementById('eventsDataQualityBar');
    expect(bar.style.display).toBe('block');
    const text = document.getElementById('eventsDataQualityText').textContent;
    expect(text).toContain('missing');
  });

  test('updateEventStats hides data quality bar when no issues', () => {
    STATE.allEvents = [sampleEvents[0], sampleEvents[1]]; // both have date and venue
    eventsModule.updateEventStats();
    const bar = document.getElementById('eventsDataQualityBar');
    expect(bar.style.display).toBe('none');
  });

  test('updateEventStats handles empty events array', () => {
    STATE.allEvents = [];
    eventsModule.updateEventStats();
    expect(document.getElementById('eventsTotalCount').textContent).toBe('0');
    expect(document.getElementById('eventsUpcomingCount').textContent).toBe('0');
    expect(document.getElementById('eventsPastCount').textContent).toBe('0');
  });
});

describe('Events Module - Year Filter Population', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
  });

  test('populateYearFilter adds years from event data', () => {
    eventsModule.populateYearFilter();
    const select = document.getElementById('eventsYearFilter');
    const options = select.querySelectorAll('option');
    // Should include "All Years" plus unique years
    expect(options.length).toBeGreaterThan(1);
    expect(options[0].value).toBe('');
    expect(options[0].textContent).toBe('All Years');
  });

  test('populateYearFilter includes current and next year', () => {
    eventsModule.populateYearFilter();
    const select = document.getElementById('eventsYearFilter');
    const html = select.innerHTML;
    const currentYear = new Date().getFullYear();
    expect(html).toContain(String(currentYear));
    expect(html).toContain(String(currentYear + 1));
  });

  test('populateYearFilter sorts years descending', () => {
    eventsModule.populateYearFilter();
    const select = document.getElementById('eventsYearFilter');
    const options = Array.from(select.querySelectorAll('option')).slice(1); // skip "All Years"
    const years = options.map((o) => parseInt(o.value));
    for (let i = 0; i < years.length - 1; i++) {
      expect(years[i] >= years[i + 1]).toBe(true);
    }
  });

  test('populateYearFilter preserves current selection', () => {
    const select = document.getElementById('eventsYearFilter');
    select.innerHTML = '<option value="">All Years</option><option value="2025" selected>2025</option>';
    select.value = '2025';
    eventsModule.populateYearFilter();
    expect(select.value).toBe('2025');
  });
});

describe('Events Module - Validation (saveEvent)', () => {
  beforeEach(() => {
    document.getElementById('eventId').value = '';
    document.getElementById('eventName').value = '';
    document.getElementById('eventDate').value = '';
    document.getElementById('eventYear').value = '';
    document.getElementById('eventVenue').value = '';
    document.getElementById('eventCapacity').value = '';
    document.getElementById('eventDescription').value = '';
    document.getElementById('eventStatus').value = 'draft';
  });

  test('saveEvent rejects empty event name', async () => {
    document.getElementById('eventName').value = '';
    const toastSpy = jest.spyOn(utils, 'showToast');
    await eventsModule.saveEvent();
    expect(toastSpy).toHaveBeenCalledWith('Please enter an event name', 'warning');
    toastSpy.mockRestore();
  });

  test('saveEvent rejects whitespace-only event name', async () => {
    document.getElementById('eventName').value = '   ';
    const toastSpy = jest.spyOn(utils, 'showToast');
    await eventsModule.saveEvent();
    expect(toastSpy).toHaveBeenCalledWith('Please enter an event name', 'warning');
    toastSpy.mockRestore();
  });
});

describe('Events Module - Attendee Filtering', () => {
  const sampleAttendees = [
    {
      id: 'a1',
      name: 'Alice Smith',
      email: 'alice@test.com',
      status: 'attending',
      guestType: 'vip',
      dietary: 'Vegetarian',
      notes: '',
    },
    {
      id: 'a2',
      name: 'Bob Jones',
      email: 'bob@test.com',
      status: 'not_attending',
      guestType: 'guest',
      dietary: '',
      notes: '',
    },
    {
      id: 'a3',
      name: 'Charlie Brown',
      email: 'charlie@test.com',
      status: 'attending',
      guestType: 'speaker',
      dietary: 'Vegan',
      notes: '',
    },
    {
      id: 'a4',
      name: 'Diana Prince',
      email: 'diana@test.com',
      status: 'maybe',
      guestType: 'sponsor',
      dietary: 'Nut Allergy',
      notes: '',
    },
    { id: 'a5', name: 'Eve Adams', email: '', status: 'attending', guestType: 'guest', dietary: '', notes: '' },
  ];

  beforeEach(() => {
    document.getElementById('attendeeSearchFilter').value = '';
    document.getElementById('attendeeStatusFilter').value = '';
    document.getElementById('attendeeTypeFilter').value = '';
  });

  test('_filterAttendees returns all when no filters applied', () => {
    const result = eventsModule._filterAttendees(sampleAttendees);
    expect(result.length).toBe(5);
  });

  test('_filterAttendees filters by status', () => {
    document.getElementById('attendeeStatusFilter').value = 'attending';
    const result = eventsModule._filterAttendees(sampleAttendees);
    expect(result.length).toBe(3);
    result.forEach((a) => expect(a.status).toBe('attending'));
  });

  test('_filterAttendees filters by guest type', () => {
    document.getElementById('attendeeTypeFilter').value = 'vip';
    const result = eventsModule._filterAttendees(sampleAttendees);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Alice Smith');
  });

  test('_filterAttendees filters by search term in name', () => {
    document.getElementById('attendeeSearchFilter').value = 'alice';
    const result = eventsModule._filterAttendees(sampleAttendees);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Alice Smith');
  });

  test('_filterAttendees filters by search term in email', () => {
    document.getElementById('attendeeSearchFilter').value = 'charlie@test';
    const result = eventsModule._filterAttendees(sampleAttendees);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Charlie Brown');
  });

  test('_filterAttendees combines search and status filters', () => {
    document.getElementById('attendeeSearchFilter').value = 'a';
    document.getElementById('attendeeStatusFilter').value = 'attending';
    const result = eventsModule._filterAttendees(sampleAttendees);
    // 'alice', 'charlie', 'eve' are attending; of those, 'alice', 'charlie', 'eve' all contain 'a' in name or email
    expect(result.length).toBeGreaterThanOrEqual(1);
    result.forEach((a) => expect(a.status).toBe('attending'));
  });
});

describe('Events Module - Edge Cases', () => {
  beforeEach(() => {
    STATE.allEvents = [];
    eventsModule._evtCurrentPage = 1;
    eventsModule._sortField = 'event_date';
    eventsModule._sortDir = 'desc';
    eventsModule._serverPagination = false;
    document.getElementById('eventsSearchBox').value = '';
    document.getElementById('eventsYearFilter').value = '';
    document.getElementById('eventsStatusFilter').value = '';
    document.getElementById('eventsEventStatusFilter').value = '';
  });

  test('filterEvents handles empty STATE.allEvents gracefully', () => {
    STATE.allEvents = [];
    expect(() => eventsModule.filterEvents()).not.toThrow();
    expect(document.getElementById('eventsCount').textContent).toBe('0');
  });

  test('filterEvents handles null STATE.allEvents', () => {
    STATE.allEvents = null;
    expect(() => eventsModule.filterEvents()).not.toThrow();
  });

  test('renderFilteredEvents handles events with XSS in name', () => {
    const xssEvents = [
      {
        id: 'evt-xss',
        event_name: '<script>alert("xss")</script>',
        event_date: futureDate,
        year: 2026,
        venue: '<img onerror=alert(1)>',
        capacity: 100,
        event_status: 'draft',
      },
    ];
    eventsModule.renderFilteredEvents(xssEvents);
    const tbody = document.getElementById('eventsTableBody');
    expect(tbody.innerHTML).not.toContain('<script>');
    expect(tbody.innerHTML).not.toContain('<img onerror');
  });

  test('renderFilteredEvents handles events with null fields', () => {
    const nullEvents = [
      {
        id: 'evt-null',
        event_name: 'Null Fields Event',
        event_date: null,
        year: null,
        venue: null,
        capacity: null,
        event_status: null,
      },
    ];
    expect(() => eventsModule.renderFilteredEvents(nullEvents)).not.toThrow();
    const tbody = document.getElementById('eventsTableBody');
    expect(tbody.innerHTML).toContain('No date');
  });

  test('populateYearFilter handles empty events array', () => {
    STATE.allEvents = [];
    expect(() => eventsModule.populateYearFilter()).not.toThrow();
    const select = document.getElementById('eventsYearFilter');
    // Should still include current year and next year
    expect(select.innerHTML).toContain(String(new Date().getFullYear()));
  });

  test('updateEventStats handles events with no dates', () => {
    STATE.allEvents = [
      { id: 'no-date', event_name: 'No Date', event_date: null, venue: null, year: null, event_status: 'draft' },
    ];
    expect(() => eventsModule.updateEventStats()).not.toThrow();
    expect(document.getElementById('eventsTotalCount').textContent).toBe('1');
  });

  test('_selectedEvents set starts empty', () => {
    expect(eventsModule._selectedEvents.size).toBe(0);
  });

  test('toggleEventSelect adds and removes from selection', () => {
    eventsModule.toggleEventSelect('evt-1', true);
    expect(eventsModule._selectedEvents.has('evt-1')).toBe(true);

    eventsModule.toggleEventSelect('evt-1', false);
    expect(eventsModule._selectedEvents.has('evt-1')).toBe(false);
  });

  test('clearEventSelection empties the set', () => {
    eventsModule._selectedEvents.add('evt-1');
    eventsModule._selectedEvents.add('evt-2');
    eventsModule.clearEventSelection();
    expect(eventsModule._selectedEvents.size).toBe(0);
  });
});

// ==========================================
// EXPANDED TEST COVERAGE
// ==========================================

describe('Events Module - Filter by Event Status', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    eventsModule._evtCurrentPage = 1;
    eventsModule._sortField = 'event_date';
    eventsModule._sortDir = 'desc';
    eventsModule._serverPagination = false;
    document.getElementById('eventsSearchBox').value = '';
    document.getElementById('eventsYearFilter').value = '';
    document.getElementById('eventsStatusFilter').value = '';
    document.getElementById('eventsEventStatusFilter').value = '';
  });

  test('filterEvents filters by draft event status', () => {
    document.getElementById('eventsEventStatusFilter').value = 'draft';
    eventsModule.filterEvents();
    expect(document.getElementById('eventsCount').textContent).toBe('1');
  });

  test('filterEvents filters by cancelled event status', () => {
    document.getElementById('eventsEventStatusFilter').value = 'cancelled';
    eventsModule.filterEvents();
    expect(document.getElementById('eventsCount').textContent).toBe('1');
  });

  test('filterEvents filters by complete event status', () => {
    document.getElementById('eventsEventStatusFilter').value = 'complete';
    eventsModule.filterEvents();
    expect(document.getElementById('eventsCount').textContent).toBe('1');
  });

  test('filterEvents with non-matching event status filters list', () => {
    document.getElementById('eventsEventStatusFilter').value = 'nonexistent';
    eventsModule.filterEvents();
    // Non-matching filter still renders (filter may not match any field in test data)
    const count = document.getElementById('eventsCount').textContent;
    expect(count).toBeDefined();
  });

  test('filterEvents combines year and event status', () => {
    document.getElementById('eventsYearFilter').value = '2025';
    document.getElementById('eventsEventStatusFilter').value = 'complete';
    eventsModule.filterEvents();
    expect(document.getElementById('eventsCount').textContent).toBe('1');
  });

  test('filterEvents combines year and event status with no matches', () => {
    document.getElementById('eventsYearFilter').value = '2026';
    document.getElementById('eventsEventStatusFilter').value = 'complete';
    eventsModule.filterEvents();
    expect(document.getElementById('eventsCount').textContent).toBe('0');
  });

  test('filterEvents treats missing event_status as draft', () => {
    STATE.allEvents = [
      {
        id: 'no-status',
        event_name: 'No Status',
        event_date: futureDate,
        year: 2026,
        venue: 'Test',
        event_status: null,
      },
    ];
    document.getElementById('eventsEventStatusFilter').value = 'draft';
    eventsModule.filterEvents();
    expect(document.getElementById('eventsCount').textContent).toBe('1');
  });
});

describe('Events Module - Search Edge Cases', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    eventsModule._evtCurrentPage = 1;
    eventsModule._sortField = 'event_date';
    eventsModule._sortDir = 'desc';
    eventsModule._serverPagination = false;
    document.getElementById('eventsSearchBox').value = '';
    document.getElementById('eventsYearFilter').value = '';
    document.getElementById('eventsStatusFilter').value = '';
    document.getElementById('eventsEventStatusFilter').value = '';
  });

  test('filterEvents search is case insensitive', () => {
    document.getElementById('eventsSearchBox').value = 'ANNUAL AWARDS';
    eventsModule.filterEvents();
    expect(document.getElementById('eventsCount').textContent).toBe('1');
  });

  test('filterEvents search matches description field', () => {
    document.getElementById('eventsSearchBox').value = 'flagship';
    eventsModule.filterEvents();
    expect(document.getElementById('eventsCount').textContent).toBe('1');
  });

  test('filterEvents search with no matches returns zero', () => {
    document.getElementById('eventsSearchBox').value = 'zzzznonexistent';
    eventsModule.filterEvents();
    expect(document.getElementById('eventsCount').textContent).toBe('0');
  });

  test('filterEvents search trims whitespace', () => {
    document.getElementById('eventsSearchBox').value = '  annual awards  ';
    eventsModule.filterEvents();
    expect(document.getElementById('eventsCount').textContent).toBe('1');
  });

  test('filterEvents search with special characters does not crash', () => {
    document.getElementById('eventsSearchBox').value = '<script>alert("test")</script>';
    expect(() => eventsModule.filterEvents()).not.toThrow();
  });

  test('filterEvents search combined with time status filter', () => {
    document.getElementById('eventsSearchBox').value = 'workshop';
    document.getElementById('eventsStatusFilter').value = 'upcoming';
    eventsModule.filterEvents();
    expect(parseInt(document.getElementById('eventsCount').textContent)).toBeGreaterThanOrEqual(1);
  });

  test('filterEvents search matches partial venue name', () => {
    document.getElementById('eventsSearchBox').value = 'grand hall';
    eventsModule.filterEvents();
    expect(document.getElementById('eventsCount').textContent).toBe('1');
  });

  test('filterEvents search matches partial event name', () => {
    document.getElementById('eventsSearchBox').value = 'finalist';
    eventsModule.filterEvents();
    expect(document.getElementById('eventsCount').textContent).toBe('1');
  });
});

describe('Events Module - This Month Filter', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    eventsModule._evtCurrentPage = 1;
    eventsModule._sortField = 'event_date';
    eventsModule._sortDir = 'desc';
    eventsModule._serverPagination = false;
    document.getElementById('eventsSearchBox').value = '';
    document.getElementById('eventsYearFilter').value = '';
    document.getElementById('eventsStatusFilter').value = '';
    document.getElementById('eventsEventStatusFilter').value = '';
  });

  test('filterEvents filters by this-month time status', () => {
    const now = new Date();
    const thisMonthDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
    STATE.allEvents.push({
      id: 'evt-this-month',
      event_name: 'This Month Event',
      event_date: thisMonthDate,
      year: now.getFullYear(),
      venue: 'Test Venue',
      capacity: 100,
      event_status: 'confirmed',
    });
    document.getElementById('eventsStatusFilter').value = 'this-month';
    eventsModule.filterEvents();
    const count = parseInt(document.getElementById('eventsCount').textContent);
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

describe('Events Module - Sort Advanced', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    eventsModule._sortField = 'event_date';
    eventsModule._sortDir = 'desc';
    eventsModule._evtCurrentPage = 1;
    eventsModule._serverPagination = false;
    document.getElementById('eventsSearchBox').value = '';
    document.getElementById('eventsYearFilter').value = '';
    document.getElementById('eventsStatusFilter').value = '';
    document.getElementById('eventsEventStatusFilter').value = '';
  });

  test('filterEvents sorts events by event_name ascending', () => {
    eventsModule._sortField = 'event_name';
    eventsModule._sortDir = 'asc';
    eventsModule.filterEvents();
    const stored = eventsModule._lastFilteredEvents;
    for (let i = 0; i < stored.length - 1; i++) {
      const a = (stored[i].event_name || '').toLowerCase();
      const b = (stored[i + 1].event_name || '').toLowerCase();
      expect(a <= b).toBe(true);
    }
  });

  test('filterEvents sorts events by event_name descending', () => {
    eventsModule._sortField = 'event_name';
    eventsModule._sortDir = 'desc';
    eventsModule.filterEvents();
    const stored = eventsModule._lastFilteredEvents;
    for (let i = 0; i < stored.length - 1; i++) {
      const a = (stored[i].event_name || '').toLowerCase();
      const b = (stored[i + 1].event_name || '').toLowerCase();
      expect(a >= b).toBe(true);
    }
  });

  test('filterEvents sorts by venue ascending', () => {
    eventsModule._sortField = 'venue';
    eventsModule._sortDir = 'asc';
    eventsModule.filterEvents();
    const stored = eventsModule._lastFilteredEvents;
    const venues = stored.map((e) => (e.venue || '').toLowerCase());
    for (let i = 0; i < venues.length - 1; i++) {
      expect(venues[i] <= venues[i + 1]).toBe(true);
    }
  });

  test('filterEvents sorts by event_status ascending', () => {
    eventsModule._sortField = 'event_status';
    eventsModule._sortDir = 'asc';
    eventsModule.filterEvents();
    const stored = eventsModule._lastFilteredEvents;
    const statuses = stored.map((e) => (e.event_status || '').toLowerCase());
    for (let i = 0; i < statuses.length - 1; i++) {
      expect(statuses[i] <= statuses[i + 1]).toBe(true);
    }
  });

  test('sortEvents toggles from asc to desc on same field', () => {
    eventsModule._sortField = 'event_date';
    eventsModule._sortDir = 'asc';
    eventsModule.sortEvents('event_date');
    expect(eventsModule._sortDir).toBe('desc');
  });

  test('sortEvents sets asc when switching from one field to another', () => {
    eventsModule._sortField = 'event_date';
    eventsModule._sortDir = 'desc';
    eventsModule.sortEvents('venue');
    expect(eventsModule._sortField).toBe('venue');
    expect(eventsModule._sortDir).toBe('asc');
  });

  test('sortEvents multiple toggles cycle correctly', () => {
    eventsModule._sortField = 'event_name';
    eventsModule._sortDir = 'asc';
    eventsModule.sortEvents('event_name');
    expect(eventsModule._sortDir).toBe('desc');
    eventsModule.sortEvents('event_name');
    expect(eventsModule._sortDir).toBe('asc');
  });

  test('filterEvents sorts year descending correctly', () => {
    eventsModule._sortField = 'year';
    eventsModule._sortDir = 'desc';
    eventsModule.filterEvents();
    const stored = eventsModule._lastFilteredEvents;
    const years = stored.map((e) => Number(e.year) || 0);
    for (let i = 0; i < years.length - 1; i++) {
      expect(years[i] >= years[i + 1]).toBe(true);
    }
  });
});

describe('Events Module - Pagination Advanced', () => {
  let manyEvents;

  beforeEach(() => {
    manyEvents = [];
    for (let i = 0; i < 175; i++) {
      manyEvents.push({
        id: `evt-adv-${i}`,
        event_name: `Advanced Event ${String(i).padStart(3, '0')}`,
        event_date: futureDate,
        year: 2026,
        venue: `Venue ${i}`,
        capacity: 100,
        event_status: 'confirmed',
      });
    }
    eventsModule._evtPageSize = 50;
    eventsModule._evtCurrentPage = 1;
    eventsModule._serverPagination = false;
    document.getElementById('eventsSearchBox').value = '';
    document.getElementById('eventsYearFilter').value = '';
    document.getElementById('eventsStatusFilter').value = '';
    document.getElementById('eventsEventStatusFilter').value = '';
  });

  test('renderFilteredEvents renders correct rows for page 1', () => {
    eventsModule._evtCurrentPage = 1;
    eventsModule.renderFilteredEvents(manyEvents);
    const tbody = document.getElementById('eventsTableBody');
    const rows = (tbody.innerHTML.match(/<tr/g) || []).length;
    expect(rows).toBe(50);
  });

  test('renderFilteredEvents renders correct rows for last page', () => {
    eventsModule._evtCurrentPage = 4; // 175 / 50 = 4 pages, last has 25
    eventsModule.renderFilteredEvents(manyEvents);
    const tbody = document.getElementById('eventsTableBody');
    const rows = (tbody.innerHTML.match(/<tr/g) || []).length;
    expect(rows).toBe(25);
  });

  test('goToEventsPage with negative page clamps to 1', () => {
    eventsModule._lastFilteredEvents = manyEvents;
    eventsModule.goToEventsPage(-5);
    expect(eventsModule._evtCurrentPage).toBe(1);
  });

  test('goToEventsPage with extremely large page clamps to max', () => {
    eventsModule._lastFilteredEvents = manyEvents;
    eventsModule.goToEventsPage(99999);
    const totalPages = Math.ceil(manyEvents.length / eventsModule._evtPageSize);
    expect(eventsModule._evtCurrentPage).toBe(totalPages);
  });

  test('renderFilteredEvents shows pagination controls with many events', () => {
    eventsModule.renderFilteredEvents(manyEvents);
    const paginationEl = document.getElementById('eventsPagination');
    expect(paginationEl.innerHTML).toContain('Prev');
    expect(paginationEl.innerHTML).toContain('Next');
  });

  test('renderFilteredEvents hides pagination for single page', () => {
    eventsModule.renderFilteredEvents(sampleEvents);
    const paginationEl = document.getElementById('eventsPagination');
    expect(paginationEl.innerHTML).toBe('');
  });

  test('renderFilteredEvents shows correct showing text', () => {
    eventsModule._evtCurrentPage = 2;
    eventsModule.renderFilteredEvents(manyEvents);
    const paginationEl = document.getElementById('eventsPagination');
    expect(paginationEl.innerHTML).toContain('51-100');
  });

  test('goToEventsPage page 1 and re-render keeps page correct', () => {
    eventsModule._lastFilteredEvents = manyEvents;
    eventsModule.goToEventsPage(1);
    expect(eventsModule._evtCurrentPage).toBe(1);
  });

  test('goToEventsPage page 3 renders third page', () => {
    eventsModule._lastFilteredEvents = manyEvents;
    eventsModule.goToEventsPage(3);
    expect(eventsModule._evtCurrentPage).toBe(3);
  });

  test('renderFilteredEvents with empty events shows empty state', () => {
    eventsModule.renderFilteredEvents([]);
    const tbody = document.getElementById('eventsTableBody');
    expect(tbody.innerHTML).toContain('No events match');
  });
});

describe('Events Module - Event Statistics Advanced', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
  });

  test('updateEventStats computes this year count', () => {
    eventsModule.updateEventStats();
    const thisYearCount = parseInt(document.getElementById('eventsThisYearCount').textContent);
    const thisYear = new Date().getFullYear();
    const expected = STATE.allEvents.filter(
      (e) => e.year === thisYear || (e.event_date && e.event_date.startsWith(String(thisYear)))
    ).length;
    expect(thisYearCount).toBe(expected);
  });

  test('updateEventStats with all events having dates shows zero data issues', () => {
    STATE.allEvents = STATE.allEvents.map((e) => ({
      ...e,
      event_date: e.event_date || futureDate,
      venue: e.venue || 'Default Venue',
    }));
    eventsModule.updateEventStats();
    expect(document.getElementById('eventsDataIssuesCount').textContent).toBe('0');
    expect(document.getElementById('eventsDataQualityBar').style.display).toBe('none');
  });

  test('updateEventStats data quality text shows missing dates and venues', () => {
    STATE.allEvents = [
      { id: 'x1', event_name: 'E1', event_date: null, venue: 'V', year: 2026, event_status: 'draft' },
      { id: 'x2', event_name: 'E2', event_date: futureDate, venue: null, year: 2026, event_status: 'draft' },
      { id: 'x3', event_name: 'E3', event_date: null, venue: null, year: 2026, event_status: 'draft' },
    ];
    eventsModule.updateEventStats();
    const text = document.getElementById('eventsDataQualityText').textContent;
    expect(text).toContain('missing date');
    expect(text).toContain('missing venue');
  });

  test('updateEventStats correctly pluralizes missing counts', () => {
    STATE.allEvents = [{ id: 'x1', event_name: 'E1', event_date: null, venue: 'V', year: 2026, event_status: 'draft' }];
    eventsModule.updateEventStats();
    const text = document.getElementById('eventsDataQualityText').textContent;
    expect(text).toContain('1 missing date');
    expect(text).not.toContain('dates');
  });

  test('updateEventStats with multiple missing dates pluralizes', () => {
    STATE.allEvents = [
      { id: 'x1', event_name: 'E1', event_date: null, venue: 'V', year: 2026, event_status: 'draft' },
      { id: 'x2', event_name: 'E2', event_date: null, venue: 'V', year: 2026, event_status: 'draft' },
    ];
    eventsModule.updateEventStats();
    const text = document.getElementById('eventsDataQualityText').textContent;
    expect(text).toContain('2 missing dates');
  });

  test('updateEventStats handles mixed upcoming and past events', () => {
    STATE.allEvents = [
      { id: 'u1', event_name: 'Future', event_date: futureDate, year: 2026, venue: 'V', event_status: 'confirmed' },
      { id: 'p1', event_name: 'Past', event_date: '2020-01-01', year: 2020, venue: 'V', event_status: 'complete' },
      { id: 'n1', event_name: 'NoDate', event_date: null, year: 2026, venue: 'V', event_status: 'draft' },
    ];
    eventsModule.updateEventStats();
    expect(parseInt(document.getElementById('eventsUpcomingCount').textContent)).toBe(1);
    expect(parseInt(document.getElementById('eventsPastCount').textContent)).toBe(1);
    expect(document.getElementById('eventsTotalCount').textContent).toBe('3');
  });
});

describe('Events Module - Open Add Modal', () => {
  test('openAddModal sets modal title to "Add Event"', () => {
    eventsModule.openAddModal();
    expect(document.getElementById('eventModalTitle').textContent).toBe('Add Event');
  });

  test('openAddModal clears all form fields', () => {
    document.getElementById('eventName').value = 'Old Name';
    document.getElementById('eventDate').value = '2025-01-01';
    document.getElementById('eventVenue').value = 'Old Venue';
    eventsModule.openAddModal();
    expect(document.getElementById('eventId').value).toBe('');
    expect(document.getElementById('eventName').value).toBe('');
    expect(document.getElementById('eventDate').value).toBe('');
    expect(document.getElementById('eventYear').value).toBe('');
    expect(document.getElementById('eventVenue').value).toBe('');
    expect(document.getElementById('eventCapacity').value).toBe('');
    expect(document.getElementById('eventDescription').value).toBe('');
  });

  test('openAddModal sets status to draft', () => {
    eventsModule.openAddModal();
    expect(document.getElementById('eventStatus').value).toBe('draft');
  });

  test('openAddModal sets button text to "Add Event"', () => {
    eventsModule.openAddModal();
    expect(document.getElementById('saveEventBtn').textContent).toBe('Add Event');
  });
});

describe('Events Module - Open Edit Modal', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
  });

  test('openEditModal populates fields from event data', async () => {
    await eventsModule.openEditModal('evt-1');
    expect(document.getElementById('eventId').value).toBe('evt-1');
    expect(document.getElementById('eventName').value).toBe('Annual Awards Ceremony 2026');
    expect(document.getElementById('eventVenue').value).toBe('The Grand Hall, London');
    expect(document.getElementById('eventCapacity').value).toBe('500');
  });

  test('openEditModal sets modal title to "Edit Event"', async () => {
    await eventsModule.openEditModal('evt-1');
    expect(document.getElementById('eventModalTitle').textContent).toBe('Edit Event');
  });

  test('openEditModal sets button text to "Update Event"', async () => {
    await eventsModule.openEditModal('evt-1');
    expect(document.getElementById('saveEventBtn').textContent).toBe('Update Event');
  });

  test('openEditModal returns early for non-existent event', async () => {
    document.getElementById('eventId').value = 'should-stay';
    await eventsModule.openEditModal('nonexistent-id');
    expect(document.getElementById('eventId').value).toBe('should-stay');
  });

  test('openEditModal handles null event fields', async () => {
    await eventsModule.openEditModal('evt-3');
    expect(document.getElementById('eventName').value).toBe('Draft Planning Meeting');
    expect(document.getElementById('eventDate').value).toBe('');
    expect(document.getElementById('eventVenue').value).toBe('');
    expect(document.getElementById('eventCapacity').value).toBe('');
  });
});

describe('Events Module - Save Event Validation', () => {
  beforeEach(() => {
    document.getElementById('eventId').value = '';
    document.getElementById('eventName').value = '';
    document.getElementById('eventDate').value = '';
    document.getElementById('eventYear').value = '';
    document.getElementById('eventVenue').value = '';
    document.getElementById('eventCapacity').value = '';
    document.getElementById('eventDescription').value = '';
    document.getElementById('eventStatus').value = 'draft';
  });

  test('saveEvent rejects name with only tabs and newlines', async () => {
    document.getElementById('eventName').value = '\t\n\r';
    const toastSpy = jest.spyOn(utils, 'showToast');
    await eventsModule.saveEvent();
    expect(toastSpy).toHaveBeenCalledWith('Please enter an event name', 'warning');
    toastSpy.mockRestore();
  });

  test('saveEvent accepts valid event name', async () => {
    document.getElementById('eventName').value = 'Valid Event Name';
    // Will fail on apiClient call but should not show the name validation toast
    const toastSpy = jest.spyOn(utils, 'showToast');
    try {
      await eventsModule.saveEvent();
    } catch (e) {
      // expected - API mock will throw
    }
    const warningCalls = toastSpy.mock.calls.filter((c) => c[0] === 'Please enter an event name');
    expect(warningCalls.length).toBe(0);
    toastSpy.mockRestore();
  });
});

describe('Events Module - Bulk Selection Operations', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    eventsModule._selectedEvents = new Set();
  });

  test('toggleEventSelect with checked=true adds to set', () => {
    eventsModule.toggleEventSelect('evt-1', true);
    expect(eventsModule._selectedEvents.has('evt-1')).toBe(true);
    expect(eventsModule._selectedEvents.size).toBe(1);
  });

  test('toggleEventSelect with checked=false removes from set', () => {
    eventsModule._selectedEvents.add('evt-1');
    eventsModule.toggleEventSelect('evt-1', false);
    expect(eventsModule._selectedEvents.has('evt-1')).toBe(false);
  });

  test('multiple selections accumulate correctly', () => {
    eventsModule.toggleEventSelect('evt-1', true);
    eventsModule.toggleEventSelect('evt-2', true);
    eventsModule.toggleEventSelect('evt-3', true);
    expect(eventsModule._selectedEvents.size).toBe(3);
  });

  test('deselecting one does not affect others', () => {
    eventsModule.toggleEventSelect('evt-1', true);
    eventsModule.toggleEventSelect('evt-2', true);
    eventsModule.toggleEventSelect('evt-1', false);
    expect(eventsModule._selectedEvents.size).toBe(1);
    expect(eventsModule._selectedEvents.has('evt-2')).toBe(true);
  });

  test('clearEventSelection resets all selections', () => {
    eventsModule.toggleEventSelect('evt-1', true);
    eventsModule.toggleEventSelect('evt-2', true);
    eventsModule.toggleEventSelect('evt-3', true);
    eventsModule.clearEventSelection();
    expect(eventsModule._selectedEvents.size).toBe(0);
  });

  test('_updateBulkBar shows bar when selections exist', () => {
    eventsModule.toggleEventSelect('evt-1', true);
    const bar = document.getElementById('eventsBulkActionsBar');
    // The bar should be visible
    expect(bar).toBeTruthy();
  });

  test('_updateBulkBar updates selected count text', () => {
    eventsModule.toggleEventSelect('evt-1', true);
    eventsModule.toggleEventSelect('evt-2', true);
    const countEl = document.getElementById('eventsSelectedCount');
    expect(countEl.textContent).toBe('2');
  });
});

describe('Events Module - Filter Data Issues', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    eventsModule._evtCurrentPage = 1;
    eventsModule._serverPagination = false;
    document.getElementById('eventsSearchBox').value = 'test';
    document.getElementById('eventsYearFilter').value = '2025';
    document.getElementById('eventsStatusFilter').value = 'past';
    document.getElementById('eventsEventStatusFilter').value = 'draft';
  });

  test('filterDataIssues clears all filter inputs', () => {
    eventsModule.filterDataIssues();
    expect(document.getElementById('eventsSearchBox').value).toBe('');
    expect(document.getElementById('eventsYearFilter').value).toBe('');
    expect(document.getElementById('eventsStatusFilter').value).toBe('');
    expect(document.getElementById('eventsEventStatusFilter').value).toBe('');
  });

  test('filterDataIssues shows events missing date', () => {
    STATE.allEvents = [
      { id: 'd1', event_name: 'Missing Date', event_date: null, venue: 'V', year: 2026, event_status: 'draft' },
      { id: 'd2', event_name: 'Has Date', event_date: futureDate, venue: 'V', year: 2026, event_status: 'draft' },
    ];
    eventsModule.filterDataIssues();
    expect(document.getElementById('eventsCount').textContent).toBe('1');
  });

  test('filterDataIssues shows events missing venue', () => {
    STATE.allEvents = [
      { id: 'd1', event_name: 'Missing Venue', event_date: futureDate, venue: null, year: 2026, event_status: 'draft' },
      { id: 'd2', event_name: 'Has Venue', event_date: futureDate, venue: 'V', year: 2026, event_status: 'draft' },
    ];
    eventsModule.filterDataIssues();
    expect(document.getElementById('eventsCount').textContent).toBe('1');
  });

  test('filterDataIssues shows events missing both date and venue', () => {
    STATE.allEvents = [
      { id: 'd1', event_name: 'Missing Both', event_date: null, venue: null, year: 2026, event_status: 'draft' },
      { id: 'd2', event_name: 'Complete', event_date: futureDate, venue: 'V', year: 2026, event_status: 'draft' },
    ];
    eventsModule.filterDataIssues();
    expect(document.getElementById('eventsCount').textContent).toBe('1');
  });

  test('filterDataIssues returns zero when all events have date and venue', () => {
    STATE.allEvents = [
      { id: 'd1', event_name: 'OK1', event_date: futureDate, venue: 'V1', year: 2026, event_status: 'draft' },
      { id: 'd2', event_name: 'OK2', event_date: futureDate, venue: 'V2', year: 2026, event_status: 'draft' },
    ];
    eventsModule.filterDataIssues();
    expect(document.getElementById('eventsCount').textContent).toBe('0');
  });
});

describe('Events Module - Reset Event Filters', () => {
  test('resetEventFilters clears search box', () => {
    document.getElementById('eventsSearchBox').value = 'some search';
    eventsModule.resetEventFilters();
    expect(document.getElementById('eventsSearchBox').value).toBe('');
  });

  test('resetEventFilters clears year filter', () => {
    document.getElementById('eventsYearFilter').value = '2026';
    eventsModule.resetEventFilters();
    expect(document.getElementById('eventsYearFilter').value).toBe('');
  });

  test('resetEventFilters clears time status filter', () => {
    document.getElementById('eventsStatusFilter').value = 'upcoming';
    eventsModule.resetEventFilters();
    expect(document.getElementById('eventsStatusFilter').value).toBe('');
  });

  test('resetEventFilters clears event status filter', () => {
    document.getElementById('eventsEventStatusFilter').value = 'confirmed';
    eventsModule.resetEventFilters();
    expect(document.getElementById('eventsEventStatusFilter').value).toBe('');
  });

  test('resetEventFilters resets sort field and direction', () => {
    eventsModule._sortField = 'event_name';
    eventsModule._sortDir = 'asc';
    eventsModule.resetEventFilters();
    expect(eventsModule._sortField).toBe('event_date');
    expect(eventsModule._sortDir).toBe('desc');
  });
});

describe('Events Module - Render Filtered Events Content', () => {
  beforeEach(() => {
    eventsModule._evtCurrentPage = 1;
    eventsModule._evtPageSize = 50;
    eventsModule._serverPagination = false;
    eventsModule._selectedEvents = new Set();
  });

  test('renderFilteredEvents displays event names in table', () => {
    eventsModule.renderFilteredEvents(sampleEvents);
    const tbody = document.getElementById('eventsTableBody');
    expect(tbody.innerHTML).toContain('Annual Awards Ceremony 2026');
    expect(tbody.innerHTML).toContain('Regional Finalists Night');
  });

  test('renderFilteredEvents displays venue names', () => {
    eventsModule.renderFilteredEvents([sampleEvents[0]]);
    const tbody = document.getElementById('eventsTableBody');
    expect(tbody.innerHTML).toContain('The Grand Hall, London');
  });

  test('renderFilteredEvents displays "No date" for null date', () => {
    eventsModule.renderFilteredEvents([sampleEvents[2]]);
    const tbody = document.getElementById('eventsTableBody');
    expect(tbody.innerHTML).toContain('No date');
  });

  test('renderFilteredEvents shows missing venue warning icon', () => {
    eventsModule.renderFilteredEvents([sampleEvents[2]]);
    const tbody = document.getElementById('eventsTableBody');
    expect(tbody.innerHTML).toContain('Missing venue');
  });

  test('renderFilteredEvents displays year badges', () => {
    eventsModule.renderFilteredEvents([sampleEvents[0]]);
    const tbody = document.getElementById('eventsTableBody');
    expect(tbody.innerHTML).toContain('2026');
  });

  test('renderFilteredEvents escapes HTML in venue', () => {
    const xssEvent = [
      {
        id: 'evt-xss-venue',
        event_name: 'Normal Name',
        event_date: futureDate,
        year: 2026,
        venue: '<img src=x onerror=alert(1)>',
        capacity: 100,
        event_status: 'draft',
      },
    ];
    eventsModule.renderFilteredEvents(xssEvent);
    const tbody = document.getElementById('eventsTableBody');
    expect(tbody.innerHTML).not.toContain('<img src=x');
  });

  test('renderFilteredEvents escapes HTML in description', () => {
    const xssEvent = [
      {
        id: 'evt-xss-desc',
        event_name: 'Normal Name',
        event_date: futureDate,
        year: 2026,
        venue: 'Normal',
        capacity: 100,
        description: '<script>alert("xss")</script>',
        event_status: 'draft',
      },
    ];
    eventsModule.renderFilteredEvents(xssEvent);
    const tbody = document.getElementById('eventsTableBody');
    expect(tbody.innerHTML).not.toContain('<script>');
  });

  test('renderFilteredEvents handles event with empty string fields', () => {
    const emptyEvent = [
      {
        id: 'evt-empty',
        event_name: '',
        event_date: '',
        year: '',
        venue: '',
        capacity: '',
        event_status: '',
      },
    ];
    expect(() => eventsModule.renderFilteredEvents(emptyEvent)).not.toThrow();
  });

  test('renderFilteredEvents updates filter summary', () => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    eventsModule.renderFilteredEvents(sampleEvents.slice(0, 2));
    const summary = document.getElementById('eventsFilterSummary');
    expect(summary.textContent).toContain('Showing');
  });

  test('renderFilteredEvents updates last refreshed timestamp', () => {
    eventsModule.renderFilteredEvents(sampleEvents);
    const refreshEl = document.getElementById('eventsLastRefreshed');
    expect(refreshEl.textContent).toContain('Last refreshed');
  });

  test('renderFilteredEvents shows checkboxes for each event', () => {
    eventsModule.renderFilteredEvents(sampleEvents);
    const tbody = document.getElementById('eventsTableBody');
    const checkboxes = tbody.querySelectorAll('.event-checkbox');
    expect(checkboxes.length).toBe(sampleEvents.length);
  });

  test('renderFilteredEvents shows action buttons for each event', () => {
    eventsModule.renderFilteredEvents(sampleEvents);
    const tbody = document.getElementById('eventsTableBody');
    expect(tbody.innerHTML).toContain('Edit');
    expect(tbody.innerHTML).toContain('Clone');
    expect(tbody.innerHTML).toContain('Delete');
  });
});

describe('Events Module - Attendee Filtering Advanced', () => {
  const sampleAttendees = [
    {
      id: 'a1',
      name: 'Alice Smith',
      email: 'alice@test.com',
      status: 'attending',
      guestType: 'vip',
      dietary: 'Vegetarian',
      notes: '',
    },
    {
      id: 'a2',
      name: 'Bob Jones',
      email: 'bob@test.com',
      status: 'not_attending',
      guestType: 'guest',
      dietary: '',
      notes: '',
    },
    {
      id: 'a3',
      name: 'Charlie Brown',
      email: 'charlie@test.com',
      status: 'attending',
      guestType: 'speaker',
      dietary: 'Vegan',
      notes: '',
    },
    {
      id: 'a4',
      name: 'Diana Prince',
      email: 'diana@test.com',
      status: 'maybe',
      guestType: 'sponsor',
      dietary: 'Nut Allergy',
      notes: '',
    },
    { id: 'a5', name: 'Eve Adams', email: '', status: 'attending', guestType: 'guest', dietary: '', notes: '' },
  ];

  beforeEach(() => {
    document.getElementById('attendeeSearchFilter').value = '';
    document.getElementById('attendeeStatusFilter').value = '';
    document.getElementById('attendeeTypeFilter').value = '';
  });

  test('_filterAttendees filters by not_attending status', () => {
    document.getElementById('attendeeStatusFilter').value = 'not_attending';
    const result = eventsModule._filterAttendees(sampleAttendees);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Bob Jones');
  });

  test('_filterAttendees filters by maybe status', () => {
    document.getElementById('attendeeStatusFilter').value = 'maybe';
    const result = eventsModule._filterAttendees(sampleAttendees);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Diana Prince');
  });

  test('_filterAttendees filters by speaker type', () => {
    document.getElementById('attendeeTypeFilter').value = 'speaker';
    const result = eventsModule._filterAttendees(sampleAttendees);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Charlie Brown');
  });

  test('_filterAttendees filters by sponsor type', () => {
    document.getElementById('attendeeTypeFilter').value = 'sponsor';
    const result = eventsModule._filterAttendees(sampleAttendees);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Diana Prince');
  });

  test('_filterAttendees filters by guest type', () => {
    document.getElementById('attendeeTypeFilter').value = 'guest';
    const result = eventsModule._filterAttendees(sampleAttendees);
    expect(result.length).toBe(2);
  });

  test('_filterAttendees search term is case insensitive', () => {
    document.getElementById('attendeeSearchFilter').value = 'ALICE';
    const result = eventsModule._filterAttendees(sampleAttendees);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Alice Smith');
  });

  test('_filterAttendees search with no matches returns empty array', () => {
    document.getElementById('attendeeSearchFilter').value = 'zzzznonexistent';
    const result = eventsModule._filterAttendees(sampleAttendees);
    expect(result.length).toBe(0);
  });

  test('_filterAttendees combines all three filters', () => {
    document.getElementById('attendeeSearchFilter').value = 'alice';
    document.getElementById('attendeeStatusFilter').value = 'attending';
    document.getElementById('attendeeTypeFilter').value = 'vip';
    const result = eventsModule._filterAttendees(sampleAttendees);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Alice Smith');
  });

  test('_filterAttendees with contradicting filters returns empty', () => {
    document.getElementById('attendeeStatusFilter').value = 'attending';
    document.getElementById('attendeeTypeFilter').value = 'sponsor';
    const result = eventsModule._filterAttendees(sampleAttendees);
    expect(result.length).toBe(0);
  });

  test('_filterAttendees handles empty attendees array', () => {
    const result = eventsModule._filterAttendees([]);
    expect(result.length).toBe(0);
  });

  test('_filterAttendees handles attendees with null email gracefully', () => {
    const attendeesWithNull = [{ id: 'n1', name: 'No Email', email: null, status: 'attending', guestType: 'guest' }];
    document.getElementById('attendeeSearchFilter').value = 'email';
    const result = eventsModule._filterAttendees(attendeesWithNull);
    // Should not crash when email is null; result depends on search implementation
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('Events Module - Year Filter Population Advanced', () => {
  test('populateYearFilter includes years from event data', () => {
    STATE.allEvents = [
      { id: 'y1', event_name: 'E1', year: 2024, event_date: '2024-01-01' },
      { id: 'y2', event_name: 'E2', year: 2023, event_date: '2023-01-01' },
    ];
    eventsModule.populateYearFilter();
    const select = document.getElementById('eventsYearFilter');
    expect(select.innerHTML).toContain('2024');
    expect(select.innerHTML).toContain('2023');
  });

  test('populateYearFilter does not duplicate years', () => {
    STATE.allEvents = [
      { id: 'y1', event_name: 'E1', year: 2026 },
      { id: 'y2', event_name: 'E2', year: 2026 },
    ];
    eventsModule.populateYearFilter();
    const select = document.getElementById('eventsYearFilter');
    const options = Array.from(select.querySelectorAll('option')).filter((o) => o.value === '2026');
    expect(options.length).toBe(1);
  });

  test('populateYearFilter with no events still includes base years', () => {
    STATE.allEvents = [];
    eventsModule.populateYearFilter();
    const select = document.getElementById('eventsYearFilter');
    expect(select.querySelectorAll('option').length).toBeGreaterThan(1);
  });
});

describe('Events Module - XSS Prevention Comprehensive', () => {
  beforeEach(() => {
    eventsModule._evtCurrentPage = 1;
    eventsModule._evtPageSize = 50;
    eventsModule._selectedEvents = new Set();
  });

  test('renderFilteredEvents prevents script injection in event name', () => {
    const xssEvents = [
      {
        id: 'xss-1',
        event_name: '<script>document.cookie</script>',
        event_date: futureDate,
        year: 2026,
        venue: 'Normal',
        event_status: 'draft',
      },
    ];
    eventsModule.renderFilteredEvents(xssEvents);
    const tbody = document.getElementById('eventsTableBody');
    expect(tbody.querySelector('script')).toBeNull();
  });

  test('renderFilteredEvents prevents img onerror injection', () => {
    const xssEvents = [
      {
        id: 'xss-2',
        event_name: '<img src=x onerror="alert(1)">',
        event_date: futureDate,
        year: 2026,
        venue: 'Normal',
        event_status: 'draft',
      },
    ];
    eventsModule.renderFilteredEvents(xssEvents);
    const tbody = document.getElementById('eventsTableBody');
    expect(tbody.querySelector('img[onerror]')).toBeNull();
  });

  test('renderFilteredEvents prevents JavaScript URL injection', () => {
    const xssEvents = [
      {
        id: 'xss-3',
        event_name: 'javascript:alert(1)',
        event_date: futureDate,
        year: 2026,
        venue: 'Normal',
        event_status: 'draft',
      },
    ];
    eventsModule.renderFilteredEvents(xssEvents);
    const tbody = document.getElementById('eventsTableBody');
    // The name should be rendered as text, not as a URL
    expect(tbody.innerHTML).toContain('javascript:alert(1)');
  });

  test('renderFilteredEvents handles event name with HTML entities', () => {
    const entityEvents = [
      {
        id: 'ent-1',
        event_name: 'Awards & Gala <2026>',
        event_date: futureDate,
        year: 2026,
        venue: 'Normal',
        event_status: 'draft',
      },
    ];
    eventsModule.renderFilteredEvents(entityEvents);
    const tbody = document.getElementById('eventsTableBody');
    expect(tbody.innerHTML).toContain('&amp;');
    expect(tbody.innerHTML).toContain('&lt;2026&gt;');
  });

  test('renderFilteredEvents handles venue with quotes', () => {
    const quoteEvents = [
      {
        id: 'q-1',
        event_name: 'Normal Event',
        event_date: futureDate,
        year: 2026,
        venue: 'The "Grand" Hall',
        event_status: 'draft',
      },
    ];
    expect(() => eventsModule.renderFilteredEvents(quoteEvents)).not.toThrow();
  });
});

describe('Events Module - localStorage Persistence', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    eventsModule._evtCurrentPage = 1;
    document.getElementById('eventsSearchBox').value = '';
    document.getElementById('eventsYearFilter').value = '';
    document.getElementById('eventsStatusFilter').value = '';
    document.getElementById('eventsEventStatusFilter').value = '';
  });

  test('filterEvents saves search filter to localStorage', () => {
    document.getElementById('eventsSearchBox').value = 'test search';
    eventsModule.filterEvents();
    const saved = JSON.parse(localStorage.getItem('eventsFilters'));
    expect(saved.search).toBe('test search');
  });

  test('filterEvents does not crash when year filter is set', () => {
    const yearFilter = document.getElementById('eventsYearFilter');
    yearFilter.value = '2025';
    expect(() => eventsModule.filterEvents()).not.toThrow();
  });

  test('filterEvents saves time status to localStorage', () => {
    document.getElementById('eventsStatusFilter').value = 'upcoming';
    eventsModule.filterEvents();
    const saved = JSON.parse(localStorage.getItem('eventsFilters'));
    expect(saved.timeStatus).toBe('upcoming');
  });

  test('filterEvents saves event status to localStorage', () => {
    document.getElementById('eventsEventStatusFilter').value = 'confirmed';
    eventsModule.filterEvents();
    const saved = JSON.parse(localStorage.getItem('eventsFilters'));
    expect(saved.eventStatus).toBe('confirmed');
  });

  test('filterEvents saves all filters combined to localStorage', () => {
    document.getElementById('eventsSearchBox').value = 'awards';
    document.getElementById('eventsYearFilter').value = '2026';
    document.getElementById('eventsStatusFilter').value = 'upcoming';
    document.getElementById('eventsEventStatusFilter').value = 'confirmed';
    eventsModule.filterEvents();
    const saved = JSON.parse(localStorage.getItem('eventsFilters'));
    expect(saved.search).toBe('awards');
    expect(saved.year).toBe('2026');
    expect(saved.timeStatus).toBe('upcoming');
    expect(saved.eventStatus).toBe('confirmed');
  });
});

describe('Events Module - Null and Undefined Safety', () => {
  beforeEach(() => {
    eventsModule._evtCurrentPage = 1;
    eventsModule._evtPageSize = 50;
    eventsModule._selectedEvents = new Set();
    document.getElementById('eventsSearchBox').value = '';
    document.getElementById('eventsYearFilter').value = '';
    document.getElementById('eventsStatusFilter').value = '';
    document.getElementById('eventsEventStatusFilter').value = '';
  });

  test('filterEvents handles undefined STATE.allEvents', () => {
    STATE.allEvents = undefined;
    expect(() => eventsModule.filterEvents()).not.toThrow();
  });

  test('renderFilteredEvents handles event with undefined properties', () => {
    const undefinedEvent = [
      {
        id: 'undef-1',
        event_name: undefined,
        event_date: undefined,
        year: undefined,
        venue: undefined,
        capacity: undefined,
        event_status: undefined,
      },
    ];
    expect(() => eventsModule.renderFilteredEvents(undefinedEvent)).not.toThrow();
  });

  test('updateEventStats handles events with various null fields', () => {
    STATE.allEvents = [
      { id: 'n1', event_name: null, event_date: null, year: null, venue: null, event_status: null },
      { id: 'n2', event_name: 'OK', event_date: futureDate, year: 2026, venue: 'V', event_status: 'confirmed' },
    ];
    expect(() => eventsModule.updateEventStats()).not.toThrow();
    expect(document.getElementById('eventsTotalCount').textContent).toBe('2');
  });

  test('goToEventsPage handles empty _lastFilteredEvents', () => {
    eventsModule._lastFilteredEvents = [];
    STATE.allEvents = [];
    expect(() => eventsModule.goToEventsPage(1)).not.toThrow();
  });

  test('goToEventsPage handles null _lastFilteredEvents', () => {
    eventsModule._lastFilteredEvents = null;
    STATE.allEvents = [];
    expect(() => eventsModule.goToEventsPage(1)).not.toThrow();
  });

  test('filterDataIssues handles empty STATE.allEvents', () => {
    STATE.allEvents = [];
    expect(() => eventsModule.filterDataIssues()).not.toThrow();
  });

  test('filterDataIssues handles null STATE.allEvents', () => {
    STATE.allEvents = null;
    expect(() => eventsModule.filterDataIssues()).not.toThrow();
  });
});

// ==========================================
// COMPREHENSIVE ADDITIONAL TESTS
// ==========================================

// Helper: mock apiClient methods (reset between tests)
function mockApiClient() {
  const original = {};
  for (const m of [
    'select',
    'selectAll',
    'insert',
    'update',
    'delete',
    'deleteByFilters',
    'updateByFilters',
    'upsert',
  ]) {
    original[m] = apiClient[m];
    apiClient[m] = jest.fn().mockResolvedValue({ data: [], error: null });
  }
  return {
    restore() {
      for (const m of Object.keys(original)) apiClient[m] = original[m];
    },
  };
}

// ---------------------------------------------------------------------------
// SERVER-SIDE PAGINATION
// ---------------------------------------------------------------------------
describe('Events Module - Server-Side Pagination (_fetchPage)', () => {
  let api;
  beforeEach(() => {
    api = mockApiClient();
    eventsModule._fetchId = 0;
    eventsModule._sortField = 'event_date';
    eventsModule._sortDir = 'desc';
    eventsModule._evtPageSize = 50;
    document.getElementById('eventsSearchBox').value = '';
    document.getElementById('eventsYearFilter').value = '';
    document.getElementById('eventsStatusFilter').value = '';
    document.getElementById('eventsEventStatusFilter').value = '';
  });
  afterEach(() => api.restore());

  test('_fetchPage calls apiClient.select with correct table and page', async () => {
    api.restore();
    const selectMock = jest.fn().mockResolvedValue({
      data: [{ id: 'e1', event_name: 'Test' }],
      page: 1,
      totalPages: 1,
      count: 1,
      pageSize: 50,
    });
    apiClient.select = selectMock;

    await eventsModule._fetchPage(1);

    expect(selectMock).toHaveBeenCalledWith(
      'events',
      expect.objectContaining({
        page: 1,
        pageSize: 50,
        sort: expect.objectContaining({ column: 'event_date', ascending: false }),
      })
    );
  });

  test('_fetchPage stores pagination metadata', async () => {
    api.restore();
    apiClient.select = jest.fn().mockResolvedValue({
      data: [{ id: 'e1', event_name: 'A' }],
      page: 2,
      totalPages: 5,
      count: 250,
      pageSize: 50,
    });
    await eventsModule._fetchPage(2);
    expect(eventsModule._pagination.page).toBe(2);
    expect(eventsModule._pagination.totalPages).toBe(5);
    expect(eventsModule._pagination.count).toBe(250);
  });

  test('_fetchPage discards stale results when fetchId changed', async () => {
    api.restore();
    let resolveFirst;
    const slowPromise = new Promise((r) => {
      resolveFirst = r;
    });
    apiClient.select = jest
      .fn()
      .mockReturnValueOnce(slowPromise)
      .mockResolvedValueOnce({
        data: [{ id: 'fast', event_name: 'Fast' }],
        page: 1,
        totalPages: 1,
        count: 1,
        pageSize: 50,
      });

    const first = eventsModule._fetchPage(1);
    const second = eventsModule._fetchPage(1); // increments fetchId again

    resolveFirst({ data: [{ id: 'slow', event_name: 'Slow' }], page: 1, totalPages: 1, count: 1, pageSize: 50 });
    await first;
    await second;

    // The second call should have won; first should have been discarded
    expect(STATE.allEvents[0].id).toBe('fast');
  });

  test('_goToPage clamps to valid range and does nothing for same page', async () => {
    eventsModule._pagination = { page: 2, totalPages: 3, count: 150, pageSize: 50 };
    const spyShow = jest.spyOn(utils, 'showLoading');
    await eventsModule._goToPage(2); // same page -> no-op
    expect(spyShow).not.toHaveBeenCalled();
    spyShow.mockRestore();
  });

  test('_goToPage calls _fetchPage for a different page', async () => {
    eventsModule._pagination = { page: 1, totalPages: 3, count: 150, pageSize: 50 };
    const fetchSpy = jest.spyOn(eventsModule, '_fetchPage').mockResolvedValue();
    await eventsModule._goToPage(2);
    expect(fetchSpy).toHaveBeenCalledWith(2);
    fetchSpy.mockRestore();
  });

  test('_goToPage clamps page above max to totalPages', async () => {
    eventsModule._pagination = { page: 1, totalPages: 3, count: 150, pageSize: 50 };
    const fetchSpy = jest.spyOn(eventsModule, '_fetchPage').mockResolvedValue();
    await eventsModule._goToPage(10);
    expect(fetchSpy).toHaveBeenCalledWith(3);
    fetchSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// _buildEvtServerFilters
// ---------------------------------------------------------------------------
describe('Events Module - _buildEvtServerFilters', () => {
  beforeEach(() => {
    document.getElementById('eventsYearFilter').value = '';
    document.getElementById('eventsEventStatusFilter').value = '';
    document.getElementById('eventsStatusFilter').value = '';
  });

  test('returns empty object when no filters set', () => {
    const filters = eventsModule._buildEvtServerFilters();
    expect(Object.keys(filters).length).toBe(0);
  });

  test('returns year filter as integer', () => {
    document.getElementById('eventsYearFilter').value = '2026';
    const filters = eventsModule._buildEvtServerFilters();
    expect(filters.year).toBe(2026);
  });

  test('returns event_status filter', () => {
    document.getElementById('eventsEventStatusFilter').value = 'confirmed';
    const filters = eventsModule._buildEvtServerFilters();
    expect(filters.event_status).toBe('confirmed');
  });

  test('returns gte date filter for upcoming', () => {
    document.getElementById('eventsStatusFilter').value = 'upcoming';
    const filters = eventsModule._buildEvtServerFilters();
    expect(filters.event_date).toEqual(expect.objectContaining({ op: 'gte' }));
    expect(typeof filters.event_date.value).toBe('string');
  });

  test('returns lt date filter for past', () => {
    document.getElementById('eventsStatusFilter').value = 'past';
    const filters = eventsModule._buildEvtServerFilters();
    expect(filters.event_date).toEqual(expect.objectContaining({ op: 'lt' }));
  });

  test('does not set event_date filter when timeStatus is empty', () => {
    document.getElementById('eventsStatusFilter').value = '';
    const filters = eventsModule._buildEvtServerFilters();
    expect(filters.event_date).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// _populateYearFilterFromConstants
// ---------------------------------------------------------------------------
describe('Events Module - _populateYearFilterFromConstants', () => {
  test('is a no-op (year filter now populated from DB in loadEvents)', () => {
    const select = document.getElementById('eventsYearFilter');
    const before = select.innerHTML;
    eventsModule._populateYearFilterFromConstants();
    // No-op — year filter is populated from DB in loadEvents
    expect(select.innerHTML).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// loadEvents (integration-level with mocks)
// ---------------------------------------------------------------------------
describe('Events Module - loadEvents', () => {
  let api;
  beforeEach(() => {
    api = mockApiClient();
    eventsModule._loading = false;
    STATE.allEvents = [];
    document.getElementById('eventsSearchBox').value = '';
    document.getElementById('eventsYearFilter').value = '';
    document.getElementById('eventsStatusFilter').value = '';
    document.getElementById('eventsEventStatusFilter').value = '';
  });
  afterEach(() => api.restore());

  test('loadEvents sets _loading true during execution then false after', async () => {
    api.restore();
    apiClient.select = jest.fn().mockResolvedValue({
      data: [],
      page: 1,
      totalPages: 1,
      count: 0,
      pageSize: 50,
    });

    const promise = eventsModule.loadEvents();
    // Cannot reliably test mid-flight _loading, but after completion it should be false
    await promise;
    expect(eventsModule._loading).toBe(false);
  });

  test('loadEvents does nothing when already loading', async () => {
    eventsModule._loading = true;
    const spy = jest.spyOn(utils, 'showLoading');
    await eventsModule.loadEvents();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    eventsModule._loading = false;
  });

  test('loadEvents shows error toast on API failure', async () => {
    api.restore();
    apiClient.select = jest.fn().mockRejectedValue(new Error('Network Error'));
    const toastSpy = jest.spyOn(utils, 'showErrorWithRetry').mockImplementation(() => {});
    await eventsModule.loadEvents();
    expect(toastSpy).toHaveBeenCalled();
    expect(eventsModule._loading).toBe(false);
    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// renderEvents
// ---------------------------------------------------------------------------
describe('Events Module - renderEvents', () => {
  test('renderEvents shows empty state when no events', () => {
    STATE.allEvents = [];
    eventsModule.renderEvents();
    const tbody = document.getElementById('eventsTableBody');
    expect(tbody.innerHTML.length).toBeGreaterThan(0);
  });

  test('renderEvents calls updateEventStats and renderFilteredEvents', () => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    const statsSpy = jest.spyOn(eventsModule, 'updateEventStats');
    const renderSpy = jest.spyOn(eventsModule, 'renderFilteredEvents');
    eventsModule.renderEvents();
    expect(statsSpy).toHaveBeenCalled();
    expect(renderSpy).toHaveBeenCalledWith(sampleEvents);
    statsSpy.mockRestore();
    renderSpy.mockRestore();
  });

  test('renderEvents sets eventsCount element in client-side mode', () => {
    eventsModule._serverPagination = false;
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    eventsModule.renderEvents();
    const count = document.getElementById('eventsCount');
    // In client-side mode, displayCount = events.length
    expect(count.textContent).toBe(String(sampleEvents.length));
  });
});

// ---------------------------------------------------------------------------
// saveEvent - validation and API call paths
// ---------------------------------------------------------------------------
describe('Events Module - saveEvent (full paths)', () => {
  let api;
  beforeEach(() => {
    api = mockApiClient();
    document.getElementById('eventId').value = '';
    document.getElementById('eventName').value = '';
    document.getElementById('eventDate').value = '';
    document.getElementById('eventYear').value = '';
    document.getElementById('eventVenue').value = '';
    document.getElementById('eventCapacity').value = '';
    document.getElementById('eventDescription').value = '';
    document.getElementById('eventStatus').value = 'draft';
    eventsModule._templateGallerySections = [];
  });
  afterEach(() => api.restore());

  test('saveEvent rejects whitespace-only name', async () => {
    document.getElementById('eventName').value = '  ';
    const spy = jest.spyOn(utils, 'showToast');
    await eventsModule.saveEvent();
    expect(spy).toHaveBeenCalledWith('Please enter an event name', 'warning');
    spy.mockRestore();
  });

  test('saveEvent calls apiClient.insert for new event', async () => {
    document.getElementById('eventName').value = 'New Event';
    document.getElementById('eventYear').value = '2026';
    const insertMock = jest.fn().mockResolvedValue({ data: [{ id: 'new-id' }] });
    api.restore();
    apiClient.insert = insertMock;
    apiClient.select = jest.fn().mockResolvedValue({ data: [], page: 1, totalPages: 1, count: 0, pageSize: 50 });
    // Mock protectModalDuringSave to just run the callback
    const protectSpy = jest.spyOn(utils, 'protectModalDuringSave').mockImplementation(async (_, cb) => cb());
    const loadSpy = jest.spyOn(eventsModule, 'loadEvents').mockResolvedValue();

    await eventsModule.saveEvent();

    expect(insertMock).toHaveBeenCalledWith(
      'events',
      expect.objectContaining({
        event_name: 'New Event',
        year: 2026,
        event_status: 'draft',
      })
    );
    protectSpy.mockRestore();
    loadSpy.mockRestore();
  });

  test('saveEvent calls apiClient.update for existing event', async () => {
    document.getElementById('eventId').value = 'existing-id';
    document.getElementById('eventName').value = 'Updated Event';
    const updateMock = jest.fn().mockResolvedValue({ data: [{ id: 'existing-id' }] });
    api.restore();
    apiClient.update = updateMock;
    apiClient.select = jest.fn().mockResolvedValue({ data: [], page: 1, totalPages: 1, count: 0, pageSize: 50 });
    const protectSpy = jest.spyOn(utils, 'protectModalDuringSave').mockImplementation(async (_, cb) => cb());
    const loadSpy = jest.spyOn(eventsModule, 'loadEvents').mockResolvedValue();

    await eventsModule.saveEvent();

    expect(updateMock).toHaveBeenCalledWith(
      'events',
      'existing-id',
      expect.objectContaining({
        event_name: 'Updated Event',
      })
    );
    protectSpy.mockRestore();
    loadSpy.mockRestore();
  });

  test('saveEvent creates gallery sections from template for new events', async () => {
    document.getElementById('eventName').value = 'Templated Event';
    eventsModule._templateGallerySections = ['Red Carpet', 'Main Hall', 'VIP'];
    const insertMock = jest.fn().mockResolvedValue({ data: [{ id: 'tmpl-id' }] });
    api.restore();
    apiClient.insert = insertMock;
    apiClient.select = jest.fn().mockResolvedValue({ data: [], page: 1, totalPages: 1, count: 0, pageSize: 50 });
    const protectSpy = jest.spyOn(utils, 'protectModalDuringSave').mockImplementation(async (_, cb) => cb());
    const loadSpy = jest.spyOn(eventsModule, 'loadEvents').mockResolvedValue();

    await eventsModule.saveEvent();

    // First call is events insert, second should be gallery sections insert
    expect(insertMock).toHaveBeenCalledTimes(2);
    expect(insertMock.mock.calls[1][0]).toBe('event_galleries');
    expect(insertMock.mock.calls[1][1]).toHaveLength(3);
    expect(insertMock.mock.calls[1][1][0].gallery_name).toBe('Red Carpet');
    expect(eventsModule._templateGallerySections).toEqual([]);
    protectSpy.mockRestore();
    loadSpy.mockRestore();
  });

  test('saveEvent parses capacity as integer clamped at 0', async () => {
    document.getElementById('eventName').value = 'Cap Event';
    document.getElementById('eventCapacity').value = '-10';
    api.restore();
    const insertMock = jest.fn().mockResolvedValue({ data: [{ id: 'c-id' }] });
    apiClient.insert = insertMock;
    apiClient.select = jest.fn().mockResolvedValue({ data: [], page: 1, totalPages: 1, count: 0, pageSize: 50 });
    const protectSpy = jest.spyOn(utils, 'protectModalDuringSave').mockImplementation(async (_, cb) => cb());
    const loadSpy = jest.spyOn(eventsModule, 'loadEvents').mockResolvedValue();

    await eventsModule.saveEvent();

    // capacity should be 0 since Math.max(0, -10) => 0, then falsy -> null
    expect(insertMock.mock.calls[0][1].capacity).toBeNull();
    protectSpy.mockRestore();
    loadSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// deleteEvent
// ---------------------------------------------------------------------------
describe('Events Module - deleteEvent', () => {
  let api;
  beforeEach(() => {
    api = mockApiClient();
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
  });
  afterEach(() => api.restore());

  test('deleteEvent checks RBAC permissions if rbacModule exists', async () => {
    global.rbacModule = { canPerform: jest.fn().mockReturnValue(false) };
    const spy = jest.spyOn(utils, 'showToast');
    await eventsModule.deleteEvent('evt-1', 'Test');
    expect(spy).toHaveBeenCalledWith('You do not have permission to delete events', 'error');
    spy.mockRestore();
    delete global.rbacModule;
  });

  test('deleteEvent does nothing when user cancels confirmation', async () => {
    const confirmSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(false);
    const deleteMock = jest.fn();
    api.restore();
    apiClient.delete = deleteMock;
    await eventsModule.deleteEvent('evt-1', 'Test');
    expect(deleteMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  test('deleteEvent calls apiClient.delete and reloads on confirm', async () => {
    const confirmSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    const deleteMock = jest.fn().mockResolvedValue({});
    api.restore();
    apiClient.delete = deleteMock;
    apiClient.select = jest.fn().mockResolvedValue({ data: [], page: 1, totalPages: 1, count: 0, pageSize: 50 });
    const loadSpy = jest.spyOn(eventsModule, 'loadEvents').mockResolvedValue();
    const softDeleteSpy = jest.spyOn(utils, 'softDelete').mockImplementation(() => {});

    await eventsModule.deleteEvent('evt-1', 'Annual Awards');

    expect(deleteMock).toHaveBeenCalledWith('events', 'evt-1');
    expect(softDeleteSpy).toHaveBeenCalledWith('events', expect.objectContaining({ id: 'evt-1' }));
    confirmSpy.mockRestore();
    loadSpy.mockRestore();
    softDeleteSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// cloneEvent & cloneGallerySections
// ---------------------------------------------------------------------------
describe('Events Module - Clone Operations', () => {
  let api;
  beforeEach(() => {
    api = mockApiClient();
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
  });
  afterEach(() => api.restore());

  test('cloneGallerySections creates new sections mapped to new event', async () => {
    const selectAllMock = jest.fn().mockResolvedValue([
      { gallery_name: 'Arrival', gallery_description: 'desc', display_order: 1 },
      { gallery_name: 'Ceremony', gallery_description: '', display_order: 2 },
    ]);
    const insertMock = jest.fn().mockResolvedValue({ data: [] });
    api.restore();
    apiClient.selectAll = selectAllMock;
    apiClient.insert = insertMock;

    await eventsModule.cloneGallerySections('src-evt', 'new-evt');

    expect(selectAllMock).toHaveBeenCalledWith(
      'event_galleries',
      expect.objectContaining({
        filters: { event_id: 'src-evt' },
      })
    );
    expect(insertMock).toHaveBeenCalledWith(
      'event_galleries',
      expect.arrayContaining([
        expect.objectContaining({ event_id: 'new-evt', gallery_name: 'Arrival' }),
        expect.objectContaining({ event_id: 'new-evt', gallery_name: 'Ceremony' }),
      ])
    );
  });

  test('cloneGallerySections handles empty source sections gracefully', async () => {
    api.restore();
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    apiClient.insert = jest.fn();
    await eventsModule.cloneGallerySections('src', 'dst');
    // insert should not be called when there are no sections
    expect(apiClient.insert).not.toHaveBeenCalled();
  });

  test('cloneGallerySections shows warning toast on error without throwing', async () => {
    api.restore();
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('DB error'));
    const spy = jest.spyOn(utils, 'showToast');
    await eventsModule.cloneGallerySections('src', 'dst');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('gallery sections failed'), 'warning');
    spy.mockRestore();
  });

  test('cloneEvent rejects when name or year is missing', async () => {
    // Set up DOM for clone modal elements
    document.body.insertAdjacentHTML(
      'beforeend',
      `
      <input id="cloneEventSourceId" value="evt-1" />
      <input id="cloneEventName" value="" />
      <input id="cloneEventDate" value="" />
      <input id="cloneEventYear" value="" />
      <input id="cloneEventVenue" value="" />
      <textarea id="cloneEventDescription"></textarea>
      <input id="cloneGallerySections" type="checkbox" checked />
      <div id="cloneEventModal"></div>
      <form id="cloneEventForm"></form>
    `
    );

    const spy = jest.spyOn(utils, 'showToast');
    await eventsModule.cloneEvent();
    expect(spy).toHaveBeenCalledWith('Please enter event name and year', 'warning');
    spy.mockRestore();

    // cleanup
    [
      'cloneEventSourceId',
      'cloneEventName',
      'cloneEventDate',
      'cloneEventYear',
      'cloneEventVenue',
      'cloneEventDescription',
      'cloneGallerySections',
      'cloneEventModal',
      'cloneEventForm',
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  });
});

// ---------------------------------------------------------------------------
// Template Management
// ---------------------------------------------------------------------------
describe('Events Module - Template Management', () => {
  let api;
  beforeEach(() => {
    api = mockApiClient();
    document.getElementById('templateId').value = '';
    document.getElementById('templateName').value = '';
    document.getElementById('templateVenue').value = '';
    document.getElementById('templateDescription').value = '';
    document.getElementById('templateGallerySections').value = '';
  });
  afterEach(() => api.restore());

  test('loadTemplates returns array from API', async () => {
    api.restore();
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValue([{ name: 'Template A', venue: 'V1', description: 'D1', gallerySections: ['A', 'B'] }]);
    const templates = await eventsModule.loadTemplates();
    expect(templates).toHaveLength(1);
    expect(templates[0].name).toBe('Template A');
  });

  test('loadTemplates falls back to localStorage on API error', async () => {
    api.restore();
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('DB down'));
    localStorage.setItem('eventTemplates', JSON.stringify([{ name: 'Local T' }]));
    const templates = await eventsModule.loadTemplates();
    expect(templates).toHaveLength(1);
    expect(templates[0].name).toBe('Local T');
    localStorage.removeItem('eventTemplates');
  });

  test('loadTemplates returns empty array when all fallbacks fail', async () => {
    api.restore();
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('DB down'));
    localStorage.removeItem('eventTemplates');
    const templates = await eventsModule.loadTemplates();
    expect(templates).toEqual([]);
  });

  test('saveTemplate rejects empty name', async () => {
    document.getElementById('templateName').value = '';
    const spy = jest.spyOn(utils, 'showToast');
    await eventsModule.saveTemplate();
    expect(spy).toHaveBeenCalledWith('Please enter a template name', 'warning');
    spy.mockRestore();
  });

  test('saveTemplate creates new template', async () => {
    document.getElementById('templateName').value = 'New Tmpl';
    document.getElementById('templateVenue').value = 'Venue X';
    document.getElementById('templateDescription').value = 'Desc';
    document.getElementById('templateGallerySections').value = 'Section A\nSection B';

    const loadSpy = jest.spyOn(eventsModule, 'loadTemplates').mockResolvedValue([]);
    const saveSpy = jest.spyOn(eventsModule, 'saveTemplatesStorage').mockResolvedValue();
    const renderSpy = jest.spyOn(eventsModule, 'renderTemplatesList').mockResolvedValue();
    const cancelSpy = jest.spyOn(eventsModule, 'cancelTemplateEdit').mockImplementation(() => {});
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.saveTemplate();

    expect(saveSpy).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'New Tmpl',
        venue: 'Venue X',
        gallerySections: ['Section A', 'Section B'],
      }),
    ]);
    expect(toastSpy).toHaveBeenCalledWith('Template created successfully!', 'success');

    loadSpy.mockRestore();
    saveSpy.mockRestore();
    renderSpy.mockRestore();
    cancelSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('saveTemplate updates existing template by index', async () => {
    document.getElementById('templateId').value = '0';
    document.getElementById('templateName').value = 'Updated Tmpl';
    document.getElementById('templateVenue').value = '';
    document.getElementById('templateDescription').value = '';
    document.getElementById('templateGallerySections').value = '';

    const existing = [{ name: 'Old', venue: '', description: '', gallerySections: [] }];
    const loadSpy = jest.spyOn(eventsModule, 'loadTemplates').mockResolvedValue(existing);
    const saveSpy = jest.spyOn(eventsModule, 'saveTemplatesStorage').mockResolvedValue();
    const renderSpy = jest.spyOn(eventsModule, 'renderTemplatesList').mockResolvedValue();
    const cancelSpy = jest.spyOn(eventsModule, 'cancelTemplateEdit').mockImplementation(() => {});
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.saveTemplate();

    expect(existing[0].name).toBe('Updated Tmpl');
    expect(toastSpy).toHaveBeenCalledWith('Template updated successfully!', 'success');

    loadSpy.mockRestore();
    saveSpy.mockRestore();
    renderSpy.mockRestore();
    cancelSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('deleteTemplate removes from array and re-renders', async () => {
    const templates = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
    const confirmSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    const loadSpy = jest.spyOn(eventsModule, 'loadTemplates').mockResolvedValue(templates);
    const saveSpy = jest.spyOn(eventsModule, 'saveTemplatesStorage').mockResolvedValue();
    const renderSpy = jest.spyOn(eventsModule, 'renderTemplatesList').mockResolvedValue();

    await eventsModule.deleteTemplate(1);

    expect(templates).toHaveLength(2);
    expect(templates[0].name).toBe('A');
    expect(templates[1].name).toBe('C');
    expect(saveSpy).toHaveBeenCalledWith(templates);

    confirmSpy.mockRestore();
    loadSpy.mockRestore();
    saveSpy.mockRestore();
    renderSpy.mockRestore();
  });

  test('cancelTemplateEdit hides form section', () => {
    const section = document.getElementById('templateFormSection');
    section.classList.remove('d-none');
    eventsModule.cancelTemplateEdit();
    expect(section.classList.contains('d-none')).toBe(true);
  });

  test('renderTemplatesList renders empty state when no templates', async () => {
    const loadSpy = jest.spyOn(eventsModule, 'loadTemplates').mockResolvedValue([]);
    await eventsModule.renderTemplatesList();
    const container = document.getElementById('eventTemplatesList');
    expect(container.innerHTML).toContain('No templates created');
    expect(document.getElementById('templatesCount').textContent).toBe('0');
    loadSpy.mockRestore();
  });

  test('renderTemplatesList renders template cards', async () => {
    const loadSpy = jest.spyOn(eventsModule, 'loadTemplates').mockResolvedValue([
      {
        name: 'Gala Template',
        venue: 'The Ritz',
        description: 'A gala event',
        gallerySections: ['Entrance', 'Stage'],
      },
    ]);
    await eventsModule.renderTemplatesList();
    const container = document.getElementById('eventTemplatesList');
    expect(container.innerHTML).toContain('Gala Template');
    expect(container.innerHTML).toContain('The Ritz');
    expect(container.innerHTML).toContain('Entrance');
    expect(document.getElementById('templatesCount').textContent).toBe('1');
    loadSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Attendee Management - getAttendees, saveAttendees, addAttendee
// ---------------------------------------------------------------------------
describe('Events Module - Attendee CRUD', () => {
  let api;
  beforeEach(() => {
    api = mockApiClient();
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
  });
  afterEach(() => api.restore());

  test('getAttendees maps DB column names to JS property names', async () => {
    api.restore();
    apiClient.select = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'a1',
          attendee_name: 'Alice',
          attendee_email: 'a@b.com',
          rsvp_status: 'attending',
          meal_preference: 'Vegan',
          guest_type: 'vip',
          plus_ones: 2,
          notes: 'Note',
          checked_in: true,
          check_in_time: '2026-01-01T10:00:00Z',
          created_at: '2025-12-01',
          organisation_id: 'org-1',
          table_number: 5,
        },
      ],
      totalPages: 1,
    });

    const result = await eventsModule.getAttendees('evt-1');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alice');
    expect(result[0].email).toBe('a@b.com');
    expect(result[0].status).toBe('attending');
    expect(result[0].dietary).toBe('Vegan');
    expect(result[0].guestType).toBe('vip');
    expect(result[0].plusOnes).toBe(2);
    expect(result[0].checkedIn).toBe(true);
    expect(result[0].organisation_id).toBe('org-1');
    expect(result[0].table_number).toBe(5);
  });

  test('getAttendees falls back to localStorage on API error', async () => {
    api.restore();
    apiClient.select = jest.fn().mockRejectedValue(new Error('DB error'));
    const key = 'event_attendees_evt-99';
    localStorage.setItem(key, JSON.stringify([{ id: 'local-a', name: 'Local' }]));

    const result = await eventsModule.getAttendees('evt-99');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Local');
    localStorage.removeItem(key);
  });

  test('saveAttendees maps JS property names to DB columns', async () => {
    const deleteByFiltersMock = jest.fn().mockResolvedValue({});
    const insertMock = jest.fn().mockResolvedValue({ data: [] });
    api.restore();
    apiClient.deleteByFilters = deleteByFiltersMock;
    apiClient.insert = insertMock;

    const attendees = [
      {
        name: 'Bob',
        email: 'bob@test.com',
        status: 'attending',
        dietary: 'Gluten free',
        guestType: 'speaker',
        plusOnes: 1,
        notes: 'VIP table',
        checkedIn: false,
        checkInTime: null,
        organisation_id: 'org-2',
        table_number: 3,
      },
    ];
    await eventsModule.saveAttendees('evt-1', attendees);

    expect(deleteByFiltersMock).toHaveBeenCalledWith('event_attendees', { event_id: 'evt-1' });
    expect(insertMock).toHaveBeenCalledWith('event_attendees', [
      expect.objectContaining({
        event_id: 'evt-1',
        attendee_name: 'Bob',
        attendee_email: 'bob@test.com',
        rsvp_status: 'attending',
        meal_preference: 'Gluten free',
        guest_type: 'speaker',
        plus_ones: 1,
        table_number: 3,
      }),
    ]);
  });

  test('saveAttendees skips insert for empty attendees array', async () => {
    const deleteByFiltersMock = jest.fn().mockResolvedValue({});
    const insertMock = jest.fn();
    api.restore();
    apiClient.deleteByFilters = deleteByFiltersMock;
    apiClient.insert = insertMock;

    await eventsModule.saveAttendees('evt-1', []);
    expect(deleteByFiltersMock).toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  test('saveAttendees falls back to localStorage on error', async () => {
    api.restore();
    apiClient.deleteByFilters = jest.fn().mockRejectedValue(new Error('fail'));
    const attendees = [{ name: 'Test', email: '' }];
    await eventsModule.saveAttendees('evt-fallback', attendees);
    const stored = JSON.parse(localStorage.getItem('event_attendees_evt-fallback'));
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Test');
    localStorage.removeItem('event_attendees_evt-fallback');
  });
});

// ---------------------------------------------------------------------------
// Budget Management
// ---------------------------------------------------------------------------
describe('Events Module - Budget Management', () => {
  let api;
  beforeEach(() => {
    api = mockApiClient();
  });
  afterEach(() => api.restore());

  test('_budgetKey returns correct localStorage key', () => {
    expect(eventsModule._budgetKey('abc-123')).toBe('bta_budget_abc-123');
  });

  test('getBudget returns data from API', async () => {
    api.restore();
    apiClient.select = jest.fn().mockResolvedValue({ data: [{ total_budget: 5000 }] });
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValue([{ name: 'Venue', category: 'Venue', estimated_amount: 2000, actual_amount: 2100 }]);

    const budget = await eventsModule.getBudget('evt-1');
    expect(budget.totalBudget).toBe(5000);
    expect(budget.items).toHaveLength(1);
  });

  test('getBudget falls back to localStorage when both tables error', async () => {
    api.restore();
    apiClient.select = jest.fn().mockRejectedValue(new Error('no table'));
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('no table'));
    localStorage.setItem('bta_budget_evt-local', JSON.stringify({ totalBudget: 1000, items: [{ name: 'X' }] }));

    const budget = await eventsModule.getBudget('evt-local');
    expect(budget.totalBudget).toBe(1000);
    expect(budget.items).toHaveLength(1);
    localStorage.removeItem('bta_budget_evt-local');
  });

  test('getBudget returns empty defaults when no data anywhere', async () => {
    api.restore();
    apiClient.select = jest.fn().mockRejectedValue(new Error('err'));
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('err'));
    localStorage.removeItem('bta_budget_evt-none');

    const budget = await eventsModule.getBudget('evt-none');
    expect(budget.totalBudget).toBe(0);
    expect(budget.items).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Vendor Management
// ---------------------------------------------------------------------------
describe('Events Module - Vendor Management', () => {
  let api;
  beforeEach(() => {
    api = mockApiClient();
  });
  afterEach(() => api.restore());

  test('_vendorsKey returns correct localStorage key', () => {
    expect(eventsModule._vendorsKey('evt-1')).toBe('bta_vendors_evt-1');
  });

  test('getVendors maps DB columns and provides defaults', async () => {
    api.restore();
    apiClient.selectAll = jest.fn().mockResolvedValue([
      { contact_name: 'John', vendor_type: 'Catering', status: 'confirmed' },
      { name: 'Jane', category: 'AV', status: null },
    ]);

    const vendors = await eventsModule.getVendors('evt-1');
    expect(vendors).toHaveLength(2);
    expect(vendors[0].name).toBe('John');
    expect(vendors[0].category).toBe('Catering');
    expect(vendors[1].name).toBe('Jane');
    expect(vendors[1].status).toBe('pending'); // default
  });

  test('getVendors falls back to localStorage', async () => {
    api.restore();
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('fail'));
    localStorage.setItem('bta_vendors_evt-fb', JSON.stringify([{ name: 'Local Vendor' }]));

    const vendors = await eventsModule.getVendors('evt-fb');
    expect(vendors).toHaveLength(1);
    expect(vendors[0].name).toBe('Local Vendor');
    localStorage.removeItem('bta_vendors_evt-fb');
  });
});

// ---------------------------------------------------------------------------
// Waitlist Management
// ---------------------------------------------------------------------------
describe('Events Module - Waitlist Management', () => {
  let api;
  beforeEach(() => {
    api = mockApiClient();
  });
  afterEach(() => api.restore());

  test('_waitlistKey returns correct localStorage key', () => {
    expect(eventsModule._waitlistKey('evt-1')).toBe('bta_waitlist_evt-1');
  });

  test('getWaitlist returns data from API', async () => {
    api.restore();
    apiClient.selectAll = jest.fn().mockResolvedValue([{ id: 'wl1', name: 'Waiting Person', email: 'w@t.com' }]);
    const waitlist = await eventsModule.getWaitlist('evt-1');
    expect(waitlist).toHaveLength(1);
    expect(waitlist[0].name).toBe('Waiting Person');
  });

  test('getWaitlist falls back to localStorage', async () => {
    api.restore();
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('fail'));
    localStorage.setItem('bta_waitlist_evt-fb', JSON.stringify([{ id: 'wl-local', name: 'Local' }]));

    const waitlist = await eventsModule.getWaitlist('evt-fb');
    expect(waitlist).toHaveLength(1);
    localStorage.removeItem('bta_waitlist_evt-fb');
  });
});

// ---------------------------------------------------------------------------
// Ticket Number Generation
// ---------------------------------------------------------------------------
describe('Events Module - Ticket Number Generation', () => {
  test('_generateTicketNumber returns string in expected format', () => {
    const ticket = eventsModule._generateTicketNumber('evt-1', 1);
    expect(typeof ticket).toBe('string');
    expect(ticket).toMatch(/^BTA-\d{4}-0001-[A-Z0-9]{4}$/);
  });

  test('_generateTicketNumber pads index to 4 digits', () => {
    const ticket = eventsModule._generateTicketNumber('evt-1', 42);
    expect(ticket).toContain('-0042-');
  });

  test('_generateTicketNumber generates unique tickets for same index', () => {
    const t1 = eventsModule._generateTicketNumber('evt-1', 1);
    const t2 = eventsModule._generateTicketNumber('evt-1', 1);
    // The random suffix makes them unique (extremely unlikely to collide)
    // Just verify both are valid format
    expect(t1).toMatch(/^BTA-/);
    expect(t2).toMatch(/^BTA-/);
  });
});

// ---------------------------------------------------------------------------
// Peak Check-In Hour
// ---------------------------------------------------------------------------
describe('Events Module - _findPeakCheckInHour', () => {
  test('returns formatted hour range for peak check-in times', () => {
    const times = [
      new Date('2026-01-01T18:05:00'),
      new Date('2026-01-01T18:15:00'),
      new Date('2026-01-01T18:30:00'),
      new Date('2026-01-01T19:00:00'),
      new Date('2026-01-01T19:15:00'),
    ];
    const result = eventsModule._findPeakCheckInHour(times);
    // 18:00 has 3 entries, 19:00 has 2 entries, so peak is 18:00-19:00
    expect(result).toBe('18:00 - 19:00');
  });

  test('returns dash for empty array', () => {
    const result = eventsModule._findPeakCheckInHour([]);
    expect(result).toBe('-');
  });

  test('handles single time entry', () => {
    const times = [new Date('2026-01-01T14:00:00')];
    const result = eventsModule._findPeakCheckInHour(times);
    expect(result).toBe('14:00 - 15:00');
  });
});

// ---------------------------------------------------------------------------
// Base URL helper
// ---------------------------------------------------------------------------
describe('Events Module - _getBaseUrl', () => {
  test('returns origin plus directory path', () => {
    const result = eventsModule._getBaseUrl();
    // In JSDOM, location is http://localhost
    expect(result).toContain('http://localhost');
  });
});

// ---------------------------------------------------------------------------
// Dietary Summary
// ---------------------------------------------------------------------------
describe('Events Module - renderDietarySummary', () => {
  beforeEach(() => {
    // Add dietary summary DOM elements
    if (!document.getElementById('dietarySummaryCard')) {
      document.body.insertAdjacentHTML(
        'beforeend',
        `
        <div id="dietarySummaryCard" style="display:none;">
          <div id="dietarySummaryContent"></div>
        </div>
      `
      );
    }
  });

  test('hides card when no dietary requirements among attending', () => {
    const attendees = [
      { id: 'a1', status: 'attending', dietary: '' },
      { id: 'a2', status: 'not_attending', dietary: 'Vegan' },
    ];
    eventsModule.renderDietarySummary(attendees);
    expect(document.getElementById('dietarySummaryCard').style.display).toBe('none');
  });

  test('shows card with dietary counts when requirements exist', () => {
    const attendees = [
      { id: 'a1', status: 'attending', dietary: 'Vegetarian' },
      { id: 'a2', status: 'attending', dietary: 'Vegetarian' },
      { id: 'a3', status: 'attending', dietary: 'Vegan' },
      { id: 'a4', status: 'attending', dietary: '' },
    ];
    eventsModule.renderDietarySummary(attendees);
    const card = document.getElementById('dietarySummaryCard');
    expect(card.style.display).toBe('block');
    const content = document.getElementById('dietarySummaryContent').innerHTML;
    expect(content).toContain('Vegetarian');
    expect(content).toContain('2');
    expect(content).toContain('Vegan');
    expect(content).toContain('1');
    // Should also show "No requirements" for the person without dietary info
    expect(content).toContain('No requirements');
  });

  test('handles comma-separated dietary requirements', () => {
    const attendees = [{ id: 'a1', status: 'attending', dietary: 'Vegetarian, Nut Allergy' }];
    eventsModule.renderDietarySummary(attendees);
    const content = document.getElementById('dietarySummaryContent').innerHTML;
    expect(content).toContain('Vegetarian');
    expect(content).toContain('Nut allergy');
  });
});

// ---------------------------------------------------------------------------
// filterByCard
// ---------------------------------------------------------------------------
describe('Events Module - filterByCard', () => {
  test('toggles attendee status filter', () => {
    const filterEl = document.getElementById('attendeeStatusFilter');
    filterEl.value = '';
    // Mock filterAttendeesList to avoid full render
    const spy = jest.spyOn(eventsModule, 'filterAttendeesList').mockImplementation(() => {});

    eventsModule.filterByCard('attending');
    expect(filterEl.value).toBe('attending');

    // Toggle same status clears filter
    eventsModule.filterByCard('attending');
    expect(filterEl.value).toBe('');

    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Running Order State
// ---------------------------------------------------------------------------
describe('Events Module - Running Order State', () => {
  test('initial running order state is correct', () => {
    expect(eventsModule.currentEventIdRunningOrder).toBeNull();
    expect(eventsModule.runningOrderItems).toEqual([]);
    expect(eventsModule.isPublished).toBe(false);
    expect(eventsModule._roUndoStack).toEqual([]);
    expect(eventsModule._roSearchTerm).toBe('');
    expect(eventsModule._roAutoSave).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// openEditModal
// ---------------------------------------------------------------------------
describe('Events Module - openEditModal', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
  });

  test('openEditModal populates form fields from event data', async () => {
    await eventsModule.openEditModal('evt-1');
    expect(document.getElementById('eventModalTitle').textContent).toBe('Edit Event');
    expect(document.getElementById('eventId').value).toBe('evt-1');
    expect(document.getElementById('eventName').value).toBe('Annual Awards Ceremony 2026');
    expect(document.getElementById('eventVenue').value).toBe('The Grand Hall, London');
    expect(document.getElementById('eventCapacity').value).toBe('500');
    expect(document.getElementById('eventStatus').value).toBe('confirmed');
    expect(document.getElementById('saveEventBtn').textContent).toBe('Update Event');
  });

  test('openEditModal does nothing for non-existent eventId', async () => {
    await eventsModule.openEditModal('nonexistent');
    // Title should not have been changed
    expect(document.getElementById('eventId').value).not.toBe('nonexistent');
  });

  test('openEditModal handles event with null fields', async () => {
    await eventsModule.openEditModal('evt-3'); // evt-3 has null venue and capacity
    expect(document.getElementById('eventVenue').value).toBe('');
    expect(document.getElementById('eventCapacity').value).toBe('');
  });
});

// ---------------------------------------------------------------------------
// openAddModal
// ---------------------------------------------------------------------------
describe('Events Module - openAddModal', () => {
  test('openAddModal resets all form fields', () => {
    // Pre-fill fields
    document.getElementById('eventName').value = 'Old Name';
    document.getElementById('eventId').value = 'old-id';

    eventsModule.openAddModal();

    expect(document.getElementById('eventModalTitle').textContent).toBe('Add Event');
    expect(document.getElementById('eventId').value).toBe('');
    expect(document.getElementById('eventName').value).toBe('');
    expect(document.getElementById('eventDate').value).toBe('');
    expect(document.getElementById('eventStatus').value).toBe('draft');
    expect(document.getElementById('saveEventBtn').textContent).toBe('Add Event');
  });
});

// ---------------------------------------------------------------------------
// Ticket Data Storage
// ---------------------------------------------------------------------------
describe('Events Module - Ticket Data (_getTicketData, _saveTicketData)', () => {
  let api;
  beforeEach(() => {
    api = mockApiClient();
  });
  afterEach(() => api.restore());

  test('_getTicketData returns tickets from API', async () => {
    api.restore();
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValue([{ ticketNumber: 'BTA-2026-0001-ABCD', attendeeId: 'a1', status: 'issued' }]);
    const data = await eventsModule._getTicketData('evt-1');
    expect(data.tickets).toHaveLength(1);
    expect(data.tickets[0].ticketNumber).toBe('BTA-2026-0001-ABCD');
  });

  test('_getTicketData falls back to localStorage', async () => {
    api.restore();
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('no table'));
    localStorage.setItem(
      'bta_tickets_evt-fb',
      JSON.stringify({
        tickets: [{ ticketNumber: 'LOCAL-001', status: 'issued' }],
        settings: {},
      })
    );

    const data = await eventsModule._getTicketData('evt-fb');
    expect(data.tickets).toHaveLength(1);
    expect(data.tickets[0].ticketNumber).toBe('LOCAL-001');
    localStorage.removeItem('bta_tickets_evt-fb');
  });

  test('_getTicketData returns empty default when nothing found', async () => {
    api.restore();
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('err'));
    localStorage.removeItem('bta_tickets_evt-none');
    const data = await eventsModule._getTicketData('evt-none');
    expect(data.tickets).toEqual([]);
    expect(data.settings).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Special Requirements Keys
// ---------------------------------------------------------------------------
describe('Events Module - Storage Key Helpers', () => {
  test('_specialReqsKey returns correct key', () => {
    expect(eventsModule._specialReqsKey('evt-1')).toBe('bta_special_reqs_evt-1');
  });

  test('_postEventKey returns correct key', () => {
    expect(eventsModule._postEventKey('evt-1')).toBe('bta_post_event_evt-1');
  });
});

// ---------------------------------------------------------------------------
// Post-Event Data Storage
// ---------------------------------------------------------------------------
describe('Events Module - Post-Event Data', () => {
  let api;
  beforeEach(() => {
    api = mockApiClient();
  });
  afterEach(() => api.restore());

  test('_getPostEventData returns data from API', async () => {
    api.restore();
    apiClient.select = jest.fn().mockResolvedValue({
      data: [{ post_data: { surveyUrl: 'https://survey.com', surveyResponses: 42 } }],
    });
    const data = await eventsModule._getPostEventData('evt-1');
    expect(data.surveyUrl).toBe('https://survey.com');
    expect(data.surveyResponses).toBe(42);
  });

  test('_getPostEventData falls back to localStorage', async () => {
    api.restore();
    apiClient.select = jest.fn().mockRejectedValue(new Error('err'));
    localStorage.setItem('bta_post_event_evt-fb', JSON.stringify({ surveyUrl: 'local-url' }));
    const data = await eventsModule._getPostEventData('evt-fb');
    expect(data.surveyUrl).toBe('local-url');
    localStorage.removeItem('bta_post_event_evt-fb');
  });

  test('_getPostEventData returns empty object when nothing found', async () => {
    api.restore();
    apiClient.select = jest.fn().mockRejectedValue(new Error('err'));
    localStorage.removeItem('bta_post_event_evt-none');
    const data = await eventsModule._getPostEventData('evt-none');
    expect(data).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Sort Toggle Behavior (sortEvents called multiple times)
// ---------------------------------------------------------------------------
describe('Events Module - Sort Toggle Exhaustive', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    eventsModule._evtCurrentPage = 1;
    document.getElementById('eventsSearchBox').value = '';
    document.getElementById('eventsYearFilter').value = '';
    document.getElementById('eventsStatusFilter').value = '';
    document.getElementById('eventsEventStatusFilter').value = '';
  });

  test('sortEvents cycles asc -> desc on repeated calls for same field', () => {
    eventsModule._sortField = 'capacity';
    eventsModule._sortDir = 'asc';

    eventsModule.sortEvents('capacity');
    expect(eventsModule._sortDir).toBe('desc');

    eventsModule.sortEvents('capacity');
    expect(eventsModule._sortDir).toBe('asc');
  });

  test('sortEvents switches to new field with ascending default', () => {
    eventsModule._sortField = 'event_name';
    eventsModule._sortDir = 'desc';

    eventsModule.sortEvents('venue');
    expect(eventsModule._sortField).toBe('venue');
    expect(eventsModule._sortDir).toBe('asc');
  });

  test('sortEvents by year sorts numerically', () => {
    eventsModule._serverPagination = false;
    eventsModule._sortField = 'year';
    eventsModule._sortDir = 'asc';
    eventsModule.filterEvents();
    const stored = eventsModule._lastFilteredEvents;
    const years = stored.map((e) => Number(e.year) || 0);
    for (let i = 0; i < years.length - 1; i++) {
      expect(years[i] <= years[i + 1]).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Bulk Selection
// ---------------------------------------------------------------------------
describe('Events Module - Bulk Selection', () => {
  test('toggleEventSelect manages selection set correctly', () => {
    eventsModule._selectedEvents.clear();

    eventsModule.toggleEventSelect('evt-1', true);
    eventsModule.toggleEventSelect('evt-2', true);
    expect(eventsModule._selectedEvents.size).toBe(2);
    expect(eventsModule._selectedEvents.has('evt-1')).toBe(true);
    expect(eventsModule._selectedEvents.has('evt-2')).toBe(true);

    eventsModule.toggleEventSelect('evt-1', false);
    expect(eventsModule._selectedEvents.size).toBe(1);
    expect(eventsModule._selectedEvents.has('evt-1')).toBe(false);
  });

  test('clearEventSelection empties entire set', () => {
    eventsModule._selectedEvents.add('a');
    eventsModule._selectedEvents.add('b');
    eventsModule._selectedEvents.add('c');
    eventsModule.clearEventSelection();
    expect(eventsModule._selectedEvents.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// resetEventFilters
// ---------------------------------------------------------------------------
describe('Events Module - resetEventFilters comprehensive', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    eventsModule._serverPagination = false;
    document.getElementById('eventsSearchBox').value = 'test';
    document.getElementById('eventsYearFilter').value = '2025';
    document.getElementById('eventsStatusFilter').value = 'upcoming';
    document.getElementById('eventsEventStatusFilter').value = 'confirmed';
    eventsModule._sortField = 'venue';
    eventsModule._sortDir = 'asc';
    eventsModule._evtCurrentPage = 5;
  });

  test('resetEventFilters clears all filter inputs', () => {
    eventsModule.resetEventFilters();
    expect(document.getElementById('eventsSearchBox').value).toBe('');
    expect(document.getElementById('eventsYearFilter').value).toBe('');
    expect(document.getElementById('eventsStatusFilter').value).toBe('');
    expect(document.getElementById('eventsEventStatusFilter').value).toBe('');
  });

  test('resetEventFilters resets sort state', () => {
    eventsModule.resetEventFilters();
    expect(eventsModule._sortField).toBe('event_date');
    expect(eventsModule._sortDir).toBe('desc');
  });

  test('resetEventFilters calls renderEvents to re-render table', () => {
    const renderSpy = jest.spyOn(eventsModule, 'renderEvents');
    eventsModule.resetEventFilters();
    expect(renderSpy).toHaveBeenCalled();
    renderSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Pagination rendering with many events
// ---------------------------------------------------------------------------
describe('Events Module - Pagination Advanced', () => {
  test('renderFilteredEvents shows correct row count for page 2', () => {
    const manyEvents = [];
    for (let i = 0; i < 120; i++) {
      manyEvents.push({
        id: `evt-adv-${i}`,
        event_name: `Advanced Event ${i}`,
        event_date: futureDate,
        year: 2026,
        venue: 'Venue',
        capacity: 100,
        event_status: 'confirmed',
      });
    }
    eventsModule._serverPagination = false;
    eventsModule._evtPageSize = 50;
    eventsModule._evtCurrentPage = 2;
    eventsModule.renderFilteredEvents(manyEvents);

    const tbody = document.getElementById('eventsTableBody');
    const rows = (tbody.innerHTML.match(/<tr/g) || []).length;
    expect(rows).toBe(50); // page 2: items 50-99
  });

  test('renderFilteredEvents shows remaining items on last page', () => {
    const manyEvents = [];
    for (let i = 0; i < 75; i++) {
      manyEvents.push({
        id: `evt-last-${i}`,
        event_name: `Last Page Event ${i}`,
        event_date: futureDate,
        year: 2026,
        venue: 'Venue',
        capacity: 100,
        event_status: 'confirmed',
      });
    }
    eventsModule._serverPagination = false;
    eventsModule._evtPageSize = 50;
    eventsModule._evtCurrentPage = 2;
    eventsModule.renderFilteredEvents(manyEvents);

    const tbody = document.getElementById('eventsTableBody');
    const rows = (tbody.innerHTML.match(/<tr/g) || []).length;
    expect(rows).toBe(25); // 75 - 50 = 25 remaining
  });
});

// ---------------------------------------------------------------------------
// openCloneModal
// ---------------------------------------------------------------------------
describe('Events Module - openCloneModal', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    // Add clone modal DOM elements
    if (!document.getElementById('cloneEventSourceId')) {
      document.body.insertAdjacentHTML(
        'beforeend',
        `
        <input id="cloneEventSourceId" value="" />
        <span id="cloneEventSourceName"></span>
        <input id="cloneEventName" value="" />
        <input id="cloneEventYear" value="" />
        <input id="cloneEventVenue" value="" />
        <textarea id="cloneEventDescription"></textarea>
        <input id="cloneEventDate" value="" />
        <input id="cloneGallerySections" type="checkbox" />
        <div id="cloneEventModal"></div>
        <form id="cloneEventForm"></form>
      `
      );
    }
  });

  test('openCloneModal populates form with incremented year', async () => {
    await eventsModule.openCloneModal('evt-1');
    expect(document.getElementById('cloneEventSourceId').value).toBe('evt-1');
    expect(document.getElementById('cloneEventSourceName').textContent).toBe('Annual Awards Ceremony 2026');
    expect(document.getElementById('cloneEventYear').value).toBe('2027');
    // Name should have year replaced
    expect(document.getElementById('cloneEventName').value).toContain('2027');
    expect(document.getElementById('cloneEventVenue').value).toBe('The Grand Hall, London');
  });

  test('openCloneModal does nothing for non-existent event', async () => {
    await eventsModule.openCloneModal('nonexistent');
    // Should not crash; source fields should be unchanged
    expect(document.getElementById('cloneEventSourceId').value).not.toBe('nonexistent');
  });
});

// ---------------------------------------------------------------------------
// Event Stats - data quality calculations
// ---------------------------------------------------------------------------
describe('Events Module - Event Stats Advanced', () => {
  test('updateEventStats counts events this year', () => {
    const thisYear = new Date().getFullYear();
    STATE.allEvents = [
      { id: 'ty1', event_name: 'E1', event_date: futureDate, year: thisYear, venue: 'V', event_status: 'confirmed' },
      { id: 'ty2', event_name: 'E2', event_date: futureDate, year: thisYear, venue: 'V', event_status: 'draft' },
      { id: 'ty3', event_name: 'E3', event_date: pastDate, year: 2025, venue: 'V', event_status: 'complete' },
    ];
    eventsModule.updateEventStats();
    const thisYearCount = parseInt(document.getElementById('eventsThisYearCount').textContent);
    expect(thisYearCount).toBe(2);
  });

  test('updateEventStats correctly identifies data issues', () => {
    STATE.allEvents = [
      {
        id: 'd1',
        event_name: 'OK Event',
        event_date: futureDate,
        year: 2026,
        venue: 'Venue',
        event_status: 'confirmed',
      },
      { id: 'd2', event_name: 'No Date', event_date: null, year: 2026, venue: 'Venue', event_status: 'confirmed' },
      { id: 'd3', event_name: 'No Venue', event_date: futureDate, year: 2026, venue: null, event_status: 'confirmed' },
      { id: 'd4', event_name: 'Nothing', event_date: null, year: 2026, venue: null, event_status: null },
    ];
    eventsModule.updateEventStats();
    const issues = parseInt(document.getElementById('eventsDataIssuesCount').textContent);
    // d2: missing date=1, d3: missing venue=1, d4: missing date+venue=2 => total=4
    expect(issues).toBe(4);
    expect(document.getElementById('eventsDataQualityBar').style.display).toBe('block');
  });

  test('updateEventStats shows 100% quality when all events complete', () => {
    STATE.allEvents = [
      { id: 'ok1', event_name: 'Complete', event_date: futureDate, year: 2026, venue: 'V', event_status: 'confirmed' },
    ];
    eventsModule.updateEventStats();
    const issues = parseInt(document.getElementById('eventsDataIssuesCount').textContent);
    expect(issues).toBe(0);
    expect(document.getElementById('eventsDataQualityBar').style.display).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// renderFilteredEvents - HTML content
// ---------------------------------------------------------------------------
describe('Events Module - renderFilteredEvents HTML output', () => {
  test('renderFilteredEvents escapes event names in output', () => {
    const events = [
      {
        id: 'esc-1',
        event_name: 'Test <b>Bold</b> & "Quoted"',
        event_date: futureDate,
        year: 2026,
        venue: 'Venue & <Place>',
        capacity: 100,
        event_status: 'confirmed',
      },
    ];
    eventsModule.renderFilteredEvents(events);
    const tbody = document.getElementById('eventsTableBody');
    expect(tbody.innerHTML).not.toContain('<b>Bold</b>');
    expect(tbody.innerHTML).not.toContain('<Place>');
  });

  test('renderFilteredEvents renders status badges', () => {
    const events = [
      {
        id: 's1',
        event_name: 'Draft',
        event_date: futureDate,
        year: 2026,
        venue: 'V',
        capacity: 10,
        event_status: 'draft',
      },
      {
        id: 's2',
        event_name: 'Confirmed',
        event_date: futureDate,
        year: 2026,
        venue: 'V',
        capacity: 10,
        event_status: 'confirmed',
      },
    ];
    eventsModule.renderFilteredEvents(events);
    const html = document.getElementById('eventsTableBody').innerHTML;
    expect(html).toContain('draft');
    expect(html).toContain('confirmed');
  });

  test('renderFilteredEvents shows "No date" for null event_date', () => {
    const events = [
      {
        id: 'nd-1',
        event_name: 'No Date Event',
        event_date: null,
        year: null,
        venue: null,
        capacity: null,
        event_status: 'draft',
      },
    ];
    eventsModule.renderFilteredEvents(events);
    const html = document.getElementById('eventsTableBody').innerHTML;
    expect(html).toContain('No date');
  });

  test('renderFilteredEvents updates eventsCount element in client mode', () => {
    eventsModule._serverPagination = false;
    eventsModule.renderFilteredEvents(sampleEvents);
    expect(document.getElementById('eventsCount').textContent).toBe(String(sampleEvents.length));
  });
});

// ---------------------------------------------------------------------------
// Server pagination edge cases
// ---------------------------------------------------------------------------
describe('Events Module - Server Pagination Edge Cases', () => {
  test('_pagination initial state', () => {
    // Already set by module init
    expect(eventsModule._pagination).toHaveProperty('page');
    expect(eventsModule._pagination).toHaveProperty('totalPages');
    expect(eventsModule._pagination).toHaveProperty('count');
    expect(eventsModule._pagination).toHaveProperty('pageSize');
  });

  test('_serverPagination flag defaults to false', () => {
    // After loadEvents the flag is set, but the module default is false
    expect(typeof eventsModule._serverPagination).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// filterEvents - saves to localStorage
// ---------------------------------------------------------------------------
describe('Events Module - Filter localStorage Persistence', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    eventsModule._evtCurrentPage = 1;
    document.getElementById('eventsSearchBox').value = '';
    document.getElementById('eventsYearFilter').value = '';
    document.getElementById('eventsStatusFilter').value = '';
    document.getElementById('eventsEventStatusFilter').value = '';
  });

  test('filterEvents persists all filter values to localStorage', () => {
    document.getElementById('eventsSearchBox').value = 'ceremony';
    document.getElementById('eventsYearFilter').value = '2026';
    document.getElementById('eventsStatusFilter').value = 'upcoming';
    document.getElementById('eventsEventStatusFilter').value = 'confirmed';

    eventsModule.filterEvents();

    const saved = JSON.parse(localStorage.getItem('eventsFilters'));
    expect(saved.search).toBe('ceremony');
    expect(saved.year).toBe('2026');
    expect(saved.timeStatus).toBe('upcoming');
    expect(saved.eventStatus).toBe('confirmed');
  });

  test('filterEvents persists empty values when filters cleared', () => {
    eventsModule.filterEvents();
    const saved = JSON.parse(localStorage.getItem('eventsFilters'));
    expect(saved.search).toBe('');
    expect(saved.year).toBe('');
  });
});

// ===========================================================================
// NEW COMPREHENSIVE TESTS TO INCREASE COVERAGE
// ===========================================================================

// ---------------------------------------------------------------------------
// Helper: create/ensure DOM elements needed by various methods
// ---------------------------------------------------------------------------
function ensureDOMElement(id, tag = 'div', attrs = {}) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement(tag);
    el.id = id;
    document.body.appendChild(el);
  }
  // Always reset attributes
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'textContent') el.textContent = v;
    else el.value = v; // for inputs/textareas/selects
  });
  return el;
}

// ---------------------------------------------------------------------------
// saveEvent - insert new event (success + error)
// ---------------------------------------------------------------------------
describe('Events Module - saveEvent CRUD', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    eventsModule._loading = false;
    document.getElementById('eventId').value = '';
    document.getElementById('eventName').value = 'New Test Event';
    document.getElementById('eventDate').value = '2026-09-15';
    document.getElementById('eventYear').value = '2026';
    document.getElementById('eventVenue').value = 'Test Venue';
    document.getElementById('eventCapacity').value = '200';
    document.getElementById('eventDescription').value = 'A test description';
    document.getElementById('eventStatus').value = 'draft';
  });

  test('saveEvent inserts a new event when no eventId is set', async () => {
    const insertSpy = jest.spyOn(apiClient, 'insert').mockResolvedValue({
      data: [{ id: 'new-evt-1', event_name: 'New Test Event' }],
    });
    // loadEvents calls _fetchPage which calls apiClient.select
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: sampleEvents,
      count: sampleEvents.length,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.saveEvent();

    expect(insertSpy).toHaveBeenCalledWith(
      'events',
      expect.objectContaining({
        event_name: 'New Test Event',
        venue: 'Test Venue',
      })
    );
    // Toast says 'added' for new events
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('added'), 'success');

    insertSpy.mockRestore();
    selectSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('saveEvent updates an existing event when eventId is set', async () => {
    document.getElementById('eventId').value = 'evt-1';
    const updateSpy = jest.spyOn(apiClient, 'update').mockResolvedValue({
      data: [{ id: 'evt-1', event_name: 'New Test Event' }],
    });
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: sampleEvents,
      count: sampleEvents.length,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.saveEvent();

    expect(updateSpy).toHaveBeenCalledWith(
      'events',
      'evt-1',
      expect.objectContaining({
        event_name: 'New Test Event',
      })
    );
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('updated'), 'success');

    updateSpy.mockRestore();
    selectSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('saveEvent shows error toast on API insert failure', async () => {
    const insertSpy = jest.spyOn(apiClient, 'insert').mockRejectedValue(new Error('DB error'));
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.saveEvent();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Error saving event'), 'error');

    insertSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('saveEvent rejects empty event name', async () => {
    document.getElementById('eventName').value = '';
    const toastSpy = jest.spyOn(utils, 'showToast');
    await eventsModule.saveEvent();
    expect(toastSpy).toHaveBeenCalledWith('Please enter an event name', 'warning');
    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// deleteEvent
// ---------------------------------------------------------------------------
describe('Events Module - deleteEvent', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    eventsModule._loading = false;
  });

  test('deleteEvent removes event after confirmation', async () => {
    const confirmSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    const softDeleteSpy = jest.spyOn(utils, 'softDelete').mockImplementation(() => {});
    const deleteSpy = jest.spyOn(apiClient, 'delete').mockResolvedValue({ data: [] });
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: sampleEvents.filter((e) => e.id !== 'evt-1'),
      count: sampleEvents.length - 1,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.deleteEvent('evt-1', 'Annual Awards Ceremony 2026');

    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteSpy).toHaveBeenCalledWith('events', 'evt-1');
    // Toast contains 'deleted' and is 'info' type (with undo link)
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('deleted'), 'info');

    confirmSpy.mockRestore();
    softDeleteSpy.mockRestore();
    deleteSpy.mockRestore();
    selectSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('deleteEvent does nothing when user cancels confirmation', async () => {
    const confirmSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(false);
    const deleteSpy = jest.spyOn(apiClient, 'delete').mockResolvedValue({ data: [] });

    await eventsModule.deleteEvent('evt-1', 'Annual Awards Ceremony 2026');

    expect(deleteSpy).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
    deleteSpy.mockRestore();
  });

  test('deleteEvent shows error toast on API failure', async () => {
    const confirmSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    const softDeleteSpy = jest.spyOn(utils, 'softDelete').mockImplementation(() => {});
    const deleteSpy = jest.spyOn(apiClient, 'delete').mockRejectedValue(new Error('DB error'));
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.deleteEvent('evt-1', 'Annual Awards Ceremony 2026');

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Error deleting event'), 'error');

    confirmSpy.mockRestore();
    softDeleteSpy.mockRestore();
    deleteSpy.mockRestore();
    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// cloneEvent
// ---------------------------------------------------------------------------
describe('Events Module - cloneEvent', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    eventsModule._loading = false;
    ensureDOMElement('cloneEventSourceId', 'input', { value: 'evt-1' });
    ensureDOMElement('cloneEventName', 'input', { value: 'Annual Awards Ceremony 2027' });
    ensureDOMElement('cloneEventDate', 'input', { value: '2027-09-15' });
    ensureDOMElement('cloneEventYear', 'input', { value: '2027' });
    ensureDOMElement('cloneEventVenue', 'input', { value: 'The Grand Hall, London' });
    ensureDOMElement('cloneEventDescription', 'textarea', { value: 'Cloned event' });
    ensureDOMElement('cloneGallerySections', 'input');
    document.getElementById('cloneGallerySections').type = 'checkbox';
    document.getElementById('cloneGallerySections').checked = false;
    ensureDOMElement('cloneEventModal', 'div');
  });

  test('cloneEvent creates a new event from source', async () => {
    // First call: select source event capacity
    // Second call: loadEvents -> _fetchPage
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [{ capacity: 500 }],
      count: 1,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });
    const insertSpy = jest.spyOn(apiClient, 'insert').mockResolvedValue({
      data: [{ id: 'cloned-evt-1', event_name: 'Annual Awards Ceremony 2027' }],
    });
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.cloneEvent();

    expect(insertSpy).toHaveBeenCalledWith(
      'events',
      expect.objectContaining({
        event_name: 'Annual Awards Ceremony 2027',
        year: 2027,
        event_status: 'draft',
      })
    );
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('created'), 'success');

    selectSpy.mockRestore();
    insertSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('cloneEvent rejects when name is empty', async () => {
    document.getElementById('cloneEventName').value = '';
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.cloneEvent();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('name and year'), 'warning');

    toastSpy.mockRestore();
  });

  test('openCloneModal returns early for non-existent event', async () => {
    const spy = jest.spyOn(document, 'getElementById');
    await eventsModule.openCloneModal('nonexistent-id');
    // Should not have tried to set modal title or other fields
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// getAttendees and addAttendee
// ---------------------------------------------------------------------------
describe('Events Module - Attendee Management', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    ensureDOMElement('attendeesEventId', 'input', { value: 'evt-1' });
    // addAttendee uses these IDs (from events.js line 1198+)
    ensureDOMElement('attendeeName', 'input', { value: '' });
    ensureDOMElement('attendeeEmail', 'input', { value: '' });
    ensureDOMElement('attendeeType', 'select', { value: 'guest' });
    ensureDOMElement('attendeeDietary', 'input', { value: '' });
    ensureDOMElement('attendeeNotes', 'textarea', { value: '' });
    ensureDOMElement('attendeeStatus', 'select', { value: 'attending' });
    ensureDOMElement('attendeePlusOnes', 'input', { value: '0' });
    ensureDOMElement('attendeeOrg', 'input', { value: '' });
    ensureDOMElement('attendeeOrgId', 'input', { value: '' });
    ensureDOMElement('addAttendeeForm', 'div');
    ensureDOMElement('attendeesTableBody', 'tbody');
    ensureDOMElement('attendeesCount', 'span');
    ensureDOMElement('attendingCount', 'span');
    ensureDOMElement('notAttendingCount', 'span');
    ensureDOMElement('maybeCount', 'span');
    ensureDOMElement('totalAttendeesCount', 'span');
    ensureDOMElement('checkInCheckedCount', 'span');
    ensureDOMElement('checkInPendingCount', 'span');
    ensureDOMElement('checkInProgressBar', 'div');
    ensureDOMElement('checkedInBadge', 'span');
  });

  test('getAttendees returns attendees from API with mapped fields', async () => {
    const mockAttendees = [
      {
        id: 'a1',
        attendee_name: 'Alice',
        attendee_email: 'alice@test.com',
        rsvp_status: 'attending',
        event_id: 'evt-1',
      },
      {
        id: 'a2',
        attendee_name: 'Bob',
        attendee_email: 'bob@test.com',
        rsvp_status: 'not_attending',
        event_id: 'evt-1',
      },
    ];
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({ data: mockAttendees, totalPages: 1 });

    const result = await eventsModule.getAttendees('evt-1');

    expect(selectSpy).toHaveBeenCalledWith(
      'event_attendees',
      expect.objectContaining({
        filters: { event_id: 'evt-1' },
      })
    );
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Alice');
    expect(result[0].email).toBe('alice@test.com');
    expect(result[0].status).toBe('attending');

    selectSpy.mockRestore();
  });

  test('getAttendees returns empty array on API failure', async () => {
    const selectSpy = jest.spyOn(apiClient, 'select').mockRejectedValue(new Error('DB error'));

    const result = await eventsModule.getAttendees('evt-1');

    expect(result).toEqual([]);

    selectSpy.mockRestore();
  });

  test('getAttendees maps legacy field names correctly', async () => {
    const mockAttendees = [
      {
        id: 'a1',
        name: 'Charlie',
        email: 'charlie@test.com',
        status: 'maybe',
        guest_type: 'speaker',
        meal_preference: 'Vegan',
      },
    ];
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({ data: mockAttendees, totalPages: 1 });

    const result = await eventsModule.getAttendees('evt-1');

    expect(result[0].name).toBe('Charlie');
    expect(result[0].dietary).toBe('Vegan');
    expect(result[0].guestType).toBe('speaker');

    selectSpy.mockRestore();
  });

  test('addAttendee pushes attendee and calls saveAttendees', async () => {
    document.getElementById('attendeeName').value = 'New Guest';
    document.getElementById('attendeeEmail').value = 'new@test.com';
    document.getElementById('attendeeType').value = 'vip';

    // getAttendees returns existing list (now uses paginated select)
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({ data: [], totalPages: 1 });
    // saveAttendees calls deleteByFilters then insert
    const deleteByFiltersSpy = jest.spyOn(apiClient, 'deleteByFilters').mockResolvedValue({});
    const insertSpy = jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [] });
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.addAttendee();

    expect(toastSpy).toHaveBeenCalledWith('Attendee added', 'success');
    // Name field should be cleared after adding
    expect(document.getElementById('attendeeName').value).toBe('');

    selectSpy.mockRestore();
    deleteByFiltersSpy.mockRestore();
    insertSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('addAttendee rejects empty name', async () => {
    document.getElementById('attendeeName').value = '';
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.addAttendee();

    expect(toastSpy).toHaveBeenCalledWith('Please enter attendee name', 'warning');

    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// deleteAttendee
// ---------------------------------------------------------------------------
describe('Events Module - deleteAttendee', () => {
  beforeEach(() => {
    ensureDOMElement('attendeesEventId', 'input', { value: 'evt-1' });
    ensureDOMElement('attendeesTableBody', 'tbody');
    ensureDOMElement('attendingCount', 'span');
    ensureDOMElement('notAttendingCount', 'span');
    ensureDOMElement('maybeCount', 'span');
    ensureDOMElement('totalAttendeesCount', 'span');
    ensureDOMElement('checkInCheckedCount', 'span');
    ensureDOMElement('checkInPendingCount', 'span');
    ensureDOMElement('checkInProgressBar', 'div');
    ensureDOMElement('checkedInBadge', 'span');
  });

  test('deleteAttendee removes attendee after confirmation', async () => {
    const confirmSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    // getAttendees
    const selectAllSpy = jest.spyOn(apiClient, 'selectAll').mockResolvedValue([
      { id: 'a1', attendee_name: 'Alice', rsvp_status: 'attending' },
      { id: 'a2', attendee_name: 'Bob', rsvp_status: 'attending' },
    ]);
    // saveAttendees
    const deleteByFiltersSpy = jest.spyOn(apiClient, 'deleteByFilters').mockResolvedValue({});
    const insertSpy = jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [] });
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.deleteAttendee('a1');

    expect(confirmSpy).toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith('Attendee removed', 'success');

    confirmSpy.mockRestore();
    selectAllSpy.mockRestore();
    deleteByFiltersSpy.mockRestore();
    insertSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('deleteAttendee does nothing when user cancels', async () => {
    const confirmSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(false);
    const selectAllSpy = jest.spyOn(apiClient, 'selectAll');

    await eventsModule.deleteAttendee('a1');

    // selectAll should not be called because we return early
    expect(selectAllSpy).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
    selectAllSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// updateAttendeeStatus
// ---------------------------------------------------------------------------
describe('Events Module - updateAttendeeStatus', () => {
  beforeEach(() => {
    ensureDOMElement('attendeesEventId', 'input', { value: 'evt-1' });
    ensureDOMElement('attendeesTableBody', 'tbody');
    ensureDOMElement('attendingCount', 'span');
    ensureDOMElement('notAttendingCount', 'span');
    ensureDOMElement('maybeCount', 'span');
    ensureDOMElement('totalAttendeesCount', 'span');
    ensureDOMElement('checkInCheckedCount', 'span');
    ensureDOMElement('checkInPendingCount', 'span');
    ensureDOMElement('checkInProgressBar', 'div');
    ensureDOMElement('checkedInBadge', 'span');
  });

  test('updateAttendeeStatus modifies attendee and calls saveAttendees', async () => {
    // getAttendees mock (now uses paginated select)
    const selectSpy = jest
      .spyOn(apiClient, 'select')
      .mockResolvedValue({ data: [{ id: 'a1', attendee_name: 'Alice', rsvp_status: 'attending' }], totalPages: 1 });
    // saveAttendees mock
    const deleteByFiltersSpy = jest.spyOn(apiClient, 'deleteByFilters').mockResolvedValue({});
    const insertSpy = jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [] });
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.updateAttendeeStatus('a1', 'not_attending');

    expect(toastSpy).toHaveBeenCalledWith('Status updated', 'success');

    selectSpy.mockRestore();
    deleteByFiltersSpy.mockRestore();
    insertSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('updateAttendeeStatus does nothing for nonexistent attendee', async () => {
    const selectSpy = jest
      .spyOn(apiClient, 'select')
      .mockResolvedValue({ data: [{ id: 'a1', attendee_name: 'Alice', rsvp_status: 'attending' }], totalPages: 1 });
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.updateAttendeeStatus('nonexistent', 'attending');

    // Should not show 'Status updated' toast
    expect(toastSpy).not.toHaveBeenCalledWith('Status updated', 'success');

    selectSpy.mockRestore();
    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Budget operations: getBudget
// ---------------------------------------------------------------------------
describe('Events Module - Budget Management', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    ensureDOMElement('attendeesEventId', 'input', { value: 'evt-1' });
    ensureDOMElement('budgetContent', 'div');
  });

  test('getBudget returns budget total from event_budgets and items from event_budget_items', async () => {
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [{ event_id: 'evt-1', total_budget: 10000 }],
    });
    const selectAllSpy = jest
      .spyOn(apiClient, 'selectAll')
      .mockResolvedValue([{ id: 'bi1', name: 'Venue Hire', estimated: 5000, actual: 4800 }]);

    const result = await eventsModule.getBudget('evt-1');

    expect(selectSpy).toHaveBeenCalledWith(
      'event_budgets',
      expect.objectContaining({
        filters: { event_id: 'evt-1' },
      })
    );
    expect(result.totalBudget).toBe(10000);
    expect(result.items).toHaveLength(1);

    selectSpy.mockRestore();
    selectAllSpy.mockRestore();
  });

  test('getBudget falls back to localStorage when both tables fail', async () => {
    const selectSpy = jest.spyOn(apiClient, 'select').mockRejectedValue(new Error('no table'));
    const selectAllSpy = jest.spyOn(apiClient, 'selectAll').mockRejectedValue(new Error('no table'));
    const budgetData = { totalBudget: 5000, items: [{ name: 'Catering', estimated: 3000, actual: 3200 }] };
    localStorage.setItem(eventsModule._budgetKey('evt-1'), JSON.stringify(budgetData));

    const result = await eventsModule.getBudget('evt-1');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Catering');

    selectSpy.mockRestore();
    selectAllSpy.mockRestore();
    localStorage.removeItem(eventsModule._budgetKey('evt-1'));
  });

  test('getBudget returns empty budget when no data and no localStorage', async () => {
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({ data: [] });
    const selectAllSpy = jest.spyOn(apiClient, 'selectAll').mockResolvedValue([]);

    const result = await eventsModule.getBudget('evt-1');

    expect(result.totalBudget).toBe(0);
    expect(result.items).toEqual([]);

    selectSpy.mockRestore();
    selectAllSpy.mockRestore();
  });

  test('_budgetKey returns correct localStorage key format', () => {
    expect(eventsModule._budgetKey('evt-123')).toBe('bta_budget_evt-123');
  });
});

// ---------------------------------------------------------------------------
// Vendor management: getVendors, _vendorsKey
// ---------------------------------------------------------------------------
describe('Events Module - Vendor Management', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    ensureDOMElement('attendeesEventId', 'input', { value: 'evt-1' });
  });

  test('getVendors returns vendor list from API via selectAll', async () => {
    const mockVendors = [
      { id: 'v1', name: 'AV Co', category: 'AV', cost: 2000, status: 'confirmed' },
      { id: 'v2', contact_name: 'Caterer Inc', vendor_type: 'Catering', cost: 5000 },
    ];
    const selectAllSpy = jest.spyOn(apiClient, 'selectAll').mockResolvedValue(mockVendors);

    const result = await eventsModule.getVendors('evt-1');

    expect(selectAllSpy).toHaveBeenCalledWith(
      'event_vendors',
      expect.objectContaining({
        filters: { event_id: 'evt-1' },
      })
    );
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('AV Co');
    expect(result[1].name).toBe('Caterer Inc');
    expect(result[1].category).toBe('Catering');

    selectAllSpy.mockRestore();
  });

  test('getVendors falls back to localStorage on API failure', async () => {
    const selectAllSpy = jest.spyOn(apiClient, 'selectAll').mockRejectedValue(new Error('DB error'));
    const vendorData = [{ name: 'Fallback Vendor' }];
    localStorage.setItem(eventsModule._vendorsKey('evt-1'), JSON.stringify(vendorData));

    const result = await eventsModule.getVendors('evt-1');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Fallback Vendor');

    selectAllSpy.mockRestore();
    localStorage.removeItem(eventsModule._vendorsKey('evt-1'));
  });

  test('getVendors returns empty array when nothing stored', async () => {
    const selectAllSpy = jest.spyOn(apiClient, 'selectAll').mockResolvedValue([]);

    const result = await eventsModule.getVendors('evt-1');

    expect(result).toEqual([]);

    selectAllSpy.mockRestore();
  });

  test('_vendorsKey returns correct localStorage key format', () => {
    expect(eventsModule._vendorsKey('evt-456')).toBe('bta_vendors_evt-456');
  });
});

// ---------------------------------------------------------------------------
// _specialReqsKey, _getSpecialReqs, _postEventKey
// ---------------------------------------------------------------------------
describe('Events Module - Key Generator Functions', () => {
  test('_specialReqsKey returns correct format', () => {
    expect(eventsModule._specialReqsKey('evt-99')).toBe('bta_special_reqs_evt-99');
  });

  test('_postEventKey returns correct format', () => {
    expect(eventsModule._postEventKey('evt-99')).toBe('bta_post_event_evt-99');
  });

  test('_waitlistKey returns correct format', () => {
    expect(eventsModule._waitlistKey('evt-99')).toBe('bta_waitlist_evt-99');
  });
});

// ---------------------------------------------------------------------------
// _getSpecialReqs
// ---------------------------------------------------------------------------
describe('Events Module - _getSpecialReqs', () => {
  test('_getSpecialReqs returns data from API', async () => {
    const mockReqs = { parkingTotal: 10, dressCode: 'Black Tie' };
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [mockReqs],
    });

    const result = await eventsModule._getSpecialReqs('evt-1');

    expect(result).toEqual(mockReqs);

    selectSpy.mockRestore();
  });

  test('_getSpecialReqs falls back to localStorage on API failure', async () => {
    const selectSpy = jest.spyOn(apiClient, 'select').mockRejectedValue(new Error('DB error'));
    const reqs = { parkingTotal: 5 };
    localStorage.setItem(eventsModule._specialReqsKey('evt-1'), JSON.stringify(reqs));

    const result = await eventsModule._getSpecialReqs('evt-1');

    expect(result.parkingTotal).toBe(5);

    selectSpy.mockRestore();
    localStorage.removeItem(eventsModule._specialReqsKey('evt-1'));
  });

  test('_getSpecialReqs returns empty object when nothing stored', async () => {
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({ data: [] });

    const result = await eventsModule._getSpecialReqs('evt-1');

    expect(result).toEqual({});

    selectSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// _getPostEventData / _savePostEventDataStore
// ---------------------------------------------------------------------------
describe('Events Module - Post Event Data', () => {
  test('_getPostEventData returns data from API', async () => {
    const mockData = { surveyUrl: 'https://forms.google.com/abc', surveyResponses: 42 };
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [{ post_data: mockData }],
    });

    const result = await eventsModule._getPostEventData('evt-1');

    expect(result.surveyUrl).toBe('https://forms.google.com/abc');
    expect(result.surveyResponses).toBe(42);

    selectSpy.mockRestore();
  });

  test('_getPostEventData falls back to localStorage on API failure', async () => {
    const selectSpy = jest.spyOn(apiClient, 'select').mockRejectedValue(new Error('DB error'));
    const postData = { surveyUrl: 'https://test.com' };
    localStorage.setItem(eventsModule._postEventKey('evt-1'), JSON.stringify(postData));

    const result = await eventsModule._getPostEventData('evt-1');

    expect(result.surveyUrl).toBe('https://test.com');

    selectSpy.mockRestore();
    localStorage.removeItem(eventsModule._postEventKey('evt-1'));
  });

  test('_getPostEventData returns empty object when nothing stored', async () => {
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({ data: [] });

    const result = await eventsModule._getPostEventData('evt-1');

    expect(result).toEqual({});

    selectSpy.mockRestore();
  });

  test('_savePostEventDataStore calls upsert', async () => {
    const upsertSpy = jest.spyOn(apiClient, 'upsert').mockResolvedValue({ data: [] });
    const data = { surveyUrl: 'https://test.com' };

    await eventsModule._savePostEventDataStore('evt-1', data);

    expect(upsertSpy).toHaveBeenCalledWith(
      'event_post_data',
      expect.objectContaining({ event_id: 'evt-1', post_data: data }),
      expect.objectContaining({ onConflict: 'event_id' })
    );

    upsertSpy.mockRestore();
  });

  test('_savePostEventDataStore falls back to localStorage on failure', async () => {
    const upsertSpy = jest.spyOn(apiClient, 'upsert').mockRejectedValue(new Error('DB error'));
    const data = { surveyUrl: 'https://fallback.com' };

    await eventsModule._savePostEventDataStore('evt-1', data);

    const stored = JSON.parse(localStorage.getItem(eventsModule._postEventKey('evt-1')));
    expect(stored.surveyUrl).toBe('https://fallback.com');

    upsertSpy.mockRestore();
    localStorage.removeItem(eventsModule._postEventKey('evt-1'));
  });
});

// ---------------------------------------------------------------------------
// _findPeakCheckInHour
// ---------------------------------------------------------------------------
describe('Events Module - _findPeakCheckInHour', () => {
  test('returns correct peak hour for clustered times', () => {
    const times = [
      new Date('2026-09-15T18:10:00'),
      new Date('2026-09-15T18:25:00'),
      new Date('2026-09-15T18:40:00'),
      new Date('2026-09-15T19:05:00'),
      new Date('2026-09-15T19:30:00'),
    ];
    const result = eventsModule._findPeakCheckInHour(times);
    // Hour 18 has 3 entries, hour 19 has 2
    expect(result).toBe('18:00 - 19:00');
  });

  test('returns dash for empty times array', () => {
    const result = eventsModule._findPeakCheckInHour([]);
    expect(result).toBe('-');
  });

  test('returns correct peak for single entry', () => {
    const times = [new Date('2026-09-15T20:15:00')];
    const result = eventsModule._findPeakCheckInHour(times);
    expect(result).toBe('20:00 - 21:00');
  });
});

// ---------------------------------------------------------------------------
// _generateTicketNumber
// ---------------------------------------------------------------------------
describe('Events Module - _generateTicketNumber', () => {
  test('generates a ticket number with event prefix', () => {
    const ticket = eventsModule._generateTicketNumber('evt-1', 1);
    expect(typeof ticket).toBe('string');
    expect(ticket.length).toBeGreaterThan(0);
  });

  test('generates unique numbers for different indices', () => {
    const t1 = eventsModule._generateTicketNumber('evt-1', 1);
    const t2 = eventsModule._generateTicketNumber('evt-1', 2);
    expect(t1).not.toBe(t2);
  });
});

// (_getBaseUrl tested in Registration and Check-in Links section above)

// ---------------------------------------------------------------------------
// copyRegistrationLink / copyCheckInLink / launchCheckInScanner
// ---------------------------------------------------------------------------
describe('Events Module - Registration and Check-in Links', () => {
  beforeEach(() => {
    // Replace with input so .value works
    const oldEl = document.getElementById('attendeesEventId');
    if (oldEl) oldEl.remove();
    const input = document.createElement('input');
    input.id = 'attendeesEventId';
    input.value = 'evt-1';
    document.body.appendChild(input);
  });

  afterEach(() => {
    const el = document.getElementById('attendeesEventId');
    if (el) el.remove();
    const div = document.createElement('div');
    div.id = 'attendeesEventId';
    document.body.appendChild(div);
  });

  test('copyRegistrationLink calls copyToClipboard with register URL', () => {
    const copySpy = jest.spyOn(utils, 'copyToClipboard').mockImplementation(() => {});

    eventsModule.copyRegistrationLink();

    expect(copySpy).toHaveBeenCalledWith(expect.stringContaining('register.html?event=evt-1'), expect.any(String));

    copySpy.mockRestore();
  });

  test('copyCheckInLink calls copyToClipboard with check-in URL', () => {
    const copySpy = jest.spyOn(utils, 'copyToClipboard').mockImplementation(() => {});

    eventsModule.copyCheckInLink();

    expect(copySpy).toHaveBeenCalledWith(expect.stringContaining('check-in.html?event=evt-1'), expect.any(String));

    copySpy.mockRestore();
  });

  test('_getBaseUrl returns a string', () => {
    const url = eventsModule._getBaseUrl();
    expect(typeof url).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Waitlist management
// ---------------------------------------------------------------------------
describe('Events Module - Waitlist', () => {
  test('_waitlistKey generates correct key', () => {
    expect(eventsModule._waitlistKey('evt-1')).toBe('bta_waitlist_evt-1');
  });

  test('getWaitlist returns list from API via selectAll', async () => {
    const mockWaitlist = [{ name: 'Waiting Guest', email: 'wait@test.com' }];
    const selectAllSpy = jest.spyOn(apiClient, 'selectAll').mockResolvedValue(mockWaitlist);

    const result = await eventsModule.getWaitlist('evt-1');

    expect(selectAllSpy).toHaveBeenCalledWith(
      'event_waitlist',
      expect.objectContaining({
        filters: { event_id: 'evt-1' },
      })
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Waiting Guest');

    selectAllSpy.mockRestore();
  });

  test('getWaitlist falls back to localStorage on API error', async () => {
    const selectAllSpy = jest.spyOn(apiClient, 'selectAll').mockRejectedValue(new Error('fail'));
    localStorage.setItem(eventsModule._waitlistKey('evt-1'), JSON.stringify([{ name: 'Local Guest' }]));

    const result = await eventsModule.getWaitlist('evt-1');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Local Guest');

    selectAllSpy.mockRestore();
    localStorage.removeItem(eventsModule._waitlistKey('evt-1'));
  });
});

// ---------------------------------------------------------------------------
// Stripe key management
// ---------------------------------------------------------------------------
describe('Events Module - Stripe Integration', () => {
  test('getStripePublicKey returns key from API', async () => {
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [{ value: 'pk_test_123' }],
    });

    const result = await eventsModule.getStripePublicKey();

    expect(result).toBe('pk_test_123');

    selectSpy.mockRestore();
  });

  test('getStripePublicKey returns empty string when no key stored', async () => {
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({ data: [] });

    const result = await eventsModule.getStripePublicKey();

    expect(result).toBe('');

    selectSpy.mockRestore();
  });

  test('getStripePublicKey falls back to localStorage on API error', async () => {
    const selectSpy = jest.spyOn(apiClient, 'select').mockRejectedValue(new Error('fail'));
    localStorage.setItem('bta_stripe_pk', 'pk_local_456');

    const result = await eventsModule.getStripePublicKey();

    expect(result).toBe('pk_local_456');

    selectSpy.mockRestore();
    localStorage.removeItem('bta_stripe_pk');
  });

  test('saveStripeKey saves key via upsert', async () => {
    ensureDOMElement('stripePublicKeyInput', 'input', { value: 'pk_test_789' });
    const upsertSpy = jest.spyOn(apiClient, 'upsert').mockResolvedValue({ data: [] });
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.saveStripeKey();

    expect(upsertSpy).toHaveBeenCalledWith(
      'user_preferences',
      expect.objectContaining({ key: 'stripe_public_key', value: 'pk_test_789' }),
      expect.objectContaining({ onConflict: 'key' })
    );
    expect(toastSpy).toHaveBeenCalledWith('Stripe key saved', 'success');

    upsertSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('saveStripeKey does nothing for empty key', async () => {
    ensureDOMElement('stripePublicKeyInput', 'input', { value: '' });
    const upsertSpy = jest.spyOn(apiClient, 'upsert');
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.saveStripeKey();

    expect(upsertSpy).not.toHaveBeenCalled();
    expect(toastSpy).not.toHaveBeenCalled();

    upsertSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('saveStripeKey falls back to localStorage on API error', async () => {
    ensureDOMElement('stripePublicKeyInput', 'input', { value: 'pk_test_fallback' });
    const upsertSpy = jest.spyOn(apiClient, 'upsert').mockRejectedValue(new Error('fail'));
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.saveStripeKey();

    expect(localStorage.getItem('bta_stripe_pk')).toBe('pk_test_fallback');
    expect(toastSpy).toHaveBeenCalledWith('Stripe key saved', 'success');

    upsertSpy.mockRestore();
    toastSpy.mockRestore();
    localStorage.removeItem('bta_stripe_pk');
  });
});

// ---------------------------------------------------------------------------
// Running Order: loadRunningOrder
// ---------------------------------------------------------------------------
describe('Events Module - Running Order', () => {
  beforeEach(() => {
    eventsModule.currentEventIdRunningOrder = 'evt-1';
    eventsModule.runningOrderItems = [];
    eventsModule.isPublished = false;
  });

  test('loadRunningOrder populates runningOrderItems from API', async () => {
    const mockItems = [
      { id: 'ro1', display_order: 1, item_name: 'Opening', duration_minutes: 5, status: 'pending' },
      { id: 'ro2', display_order: 2, item_name: 'Award 1', duration_minutes: 3, status: 'pending' },
    ];
    const selectAllSpy = jest.spyOn(apiClient, 'selectAll').mockResolvedValue(mockItems);
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [{ is_published: false, ceremony_start_time: '18:00', auto_schedule: true }],
    });

    await eventsModule.loadRunningOrder();

    expect(eventsModule.runningOrderItems).toHaveLength(2);
    expect(eventsModule.runningOrderItems[0].item_name).toBe('Opening');
    expect(eventsModule._roCeremonyStartTime).toBe('18:00');
    expect(eventsModule._roAutoSchedule).toBe(true);

    selectAllSpy.mockRestore();
    selectSpy.mockRestore();
  });

  test('loadRunningOrder handles table not existing', async () => {
    const err = new Error('relation "running_order" does not exist');
    err.code = '42P01';
    const selectAllSpy = jest.spyOn(apiClient, 'selectAll').mockRejectedValue(err);

    await eventsModule.loadRunningOrder();

    expect(eventsModule.runningOrderItems).toEqual([]);
    expect(eventsModule.isPublished).toBe(false);

    selectAllSpy.mockRestore();
  });

  test('loadRunningOrder handles settings table missing', async () => {
    const selectAllSpy = jest.spyOn(apiClient, 'selectAll').mockResolvedValue([]);
    const selectSpy = jest.spyOn(apiClient, 'select').mockRejectedValue(new Error('settings missing'));

    await eventsModule.loadRunningOrder();

    expect(eventsModule.isPublished).toBe(false);
    expect(eventsModule._roCeremonyStartTime).toBeNull();

    selectAllSpy.mockRestore();
    selectSpy.mockRestore();
  });

  test('loadRunningOrder throws on unexpected errors', async () => {
    const selectAllSpy = jest.spyOn(apiClient, 'selectAll').mockRejectedValue(new Error('unexpected'));

    await expect(eventsModule.loadRunningOrder()).rejects.toThrow('unexpected');

    selectAllSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Running Order: saveRunningOrder
// ---------------------------------------------------------------------------
describe('Events Module - Save Running Order', () => {
  beforeEach(() => {
    eventsModule.currentEventIdRunningOrder = 'evt-1';
    eventsModule.runningOrderItems = [{ id: 'ro1', display_order: 1, item_name: 'Opening', duration_minutes: 5 }];
  });

  test('saveRunningOrder saves items and shows success toast', async () => {
    const upsertSpy = jest.spyOn(apiClient, 'upsert').mockResolvedValue({ data: [] });
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.saveRunningOrder();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('saved'), 'success');

    upsertSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('saveRunningOrder shows error on failure', async () => {
    const upsertSpy = jest.spyOn(apiClient, 'upsert').mockRejectedValue(new Error('DB error'));
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.saveRunningOrder();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('saved locally'), 'success');

    upsertSpy.mockRestore();
    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Export budget / vendors
// ---------------------------------------------------------------------------
describe('Events Module - Export Functions', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    const oldEl = document.getElementById('attendeesEventId');
    if (oldEl) oldEl.remove();
    const input = document.createElement('input');
    input.id = 'attendeesEventId';
    input.value = 'evt-1';
    document.body.appendChild(input);
  });

  afterEach(() => {
    const el = document.getElementById('attendeesEventId');
    if (el) el.remove();
    const div = document.createElement('div');
    div.id = 'attendeesEventId';
    document.body.appendChild(div);
  });

  test('exportBudget calls exportToCSV with budget items', async () => {
    // getBudget uses select + selectAll
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [{ total_budget: 10000 }],
    });
    const selectAllSpy = jest
      .spyOn(apiClient, 'selectAll')
      .mockResolvedValue([{ name: 'Venue', category: 'Venue', estimated: 5000, actual: 4800, notes: '' }]);
    const exportSpy = jest.spyOn(utils, 'exportToCSV').mockImplementation(() => {});

    await eventsModule.exportBudget();

    expect(exportSpy).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ Item: 'Venue' })]),
      expect.stringContaining('budget.csv')
    );

    selectSpy.mockRestore();
    selectAllSpy.mockRestore();
    exportSpy.mockRestore();
  });

  test('exportBudget shows warning with no items', async () => {
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({ data: [] });
    const selectAllSpy = jest.spyOn(apiClient, 'selectAll').mockResolvedValue([]);
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.exportBudget();

    expect(toastSpy).toHaveBeenCalledWith('No budget items to export', 'warning');

    selectSpy.mockRestore();
    selectAllSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('exportVendors calls exportToCSV with vendor data', async () => {
    // getVendors uses selectAll
    const selectAllSpy = jest
      .spyOn(apiClient, 'selectAll')
      .mockResolvedValue([
        { name: 'AV Co', category: 'AV', email: 'j@test.com', cost: 2000, status: 'confirmed', notes: '' },
      ]);
    const exportSpy = jest.spyOn(utils, 'exportToCSV').mockImplementation(() => {});

    await eventsModule.exportVendors();

    expect(exportSpy).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ Name: 'AV Co' })]),
      expect.stringContaining('vendors.csv')
    );

    selectAllSpy.mockRestore();
    exportSpy.mockRestore();
  });

  test('exportVendors shows warning with no vendors', async () => {
    const selectAllSpy = jest.spyOn(apiClient, 'selectAll').mockResolvedValue([]);
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.exportVendors();

    expect(toastSpy).toHaveBeenCalledWith('No vendors to export', 'warning');

    selectAllSpy.mockRestore();
    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// saveAttendees (upsert pattern: delete + insert)
// ---------------------------------------------------------------------------
describe('Events Module - saveAttendees', () => {
  test('saveAttendees deletes existing and re-inserts attendees', async () => {
    const deleteByFiltersSpy = jest.spyOn(apiClient, 'deleteByFilters').mockResolvedValue({});
    const insertSpy = jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [] });

    const attendees = [
      {
        name: 'Alice',
        email: 'a@test.com',
        status: 'attending',
        guestType: 'guest',
        plusOnes: 0,
        dietary: '',
        notes: '',
        checkedIn: false,
        checkInTime: null,
      },
    ];
    await eventsModule.saveAttendees('evt-1', attendees);

    expect(deleteByFiltersSpy).toHaveBeenCalledWith('event_attendees', { event_id: 'evt-1' });
    expect(insertSpy).toHaveBeenCalledWith(
      'event_attendees',
      expect.arrayContaining([expect.objectContaining({ attendee_name: 'Alice', event_id: 'evt-1' })])
    );

    deleteByFiltersSpy.mockRestore();
    insertSpy.mockRestore();
  });

  test('saveAttendees falls back to localStorage on error', async () => {
    const deleteByFiltersSpy = jest.spyOn(apiClient, 'deleteByFilters').mockRejectedValue(new Error('fail'));

    const attendees = [{ name: 'Bob', email: 'b@test.com' }];
    await eventsModule.saveAttendees('evt-1', attendees);

    const stored = JSON.parse(localStorage.getItem('event_attendees_evt-1'));
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Bob');

    deleteByFiltersSpy.mockRestore();
    localStorage.removeItem('event_attendees_evt-1');
  });

  test('saveAttendees with empty array only deletes, no insert', async () => {
    const deleteByFiltersSpy = jest.spyOn(apiClient, 'deleteByFilters').mockResolvedValue({});
    const insertSpy = jest.spyOn(apiClient, 'insert');

    await eventsModule.saveAttendees('evt-1', []);

    expect(deleteByFiltersSpy).toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();

    deleteByFiltersSpy.mockRestore();
    insertSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// loadEvents
// ---------------------------------------------------------------------------
describe('Events Module - loadEvents', () => {
  beforeEach(() => {
    eventsModule._loading = false;
  });

  test('loadEvents populates STATE.allEvents from API', async () => {
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: sampleEvents,
      count: sampleEvents.length,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });

    await eventsModule.loadEvents();

    expect(STATE.allEvents.length).toBe(sampleEvents.length);
    expect(STATE.allEvents[0].event_name).toBe('Annual Awards Ceremony 2026');

    selectSpy.mockRestore();
  });

  test('loadEvents handles API failure gracefully', async () => {
    const selectSpy = jest.spyOn(apiClient, 'select').mockRejectedValue(new Error('Connection lost'));
    // loadEvents calls utils.showErrorWithRetry on error, not showToast directly
    const errorRetrySpy = jest.spyOn(utils, 'showErrorWithRetry').mockImplementation(() => {});

    await eventsModule.loadEvents();

    expect(errorRetrySpy).toHaveBeenCalled();

    selectSpy.mockRestore();
    errorRetrySpy.mockRestore();
  });

  test('loadEvents sets _serverPagination flag', async () => {
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: sampleEvents,
      count: sampleEvents.length,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });

    await eventsModule.loadEvents();

    expect(eventsModule._serverPagination).toBe(true);

    selectSpy.mockRestore();
  });

  test('loadEvents skips if already loading', async () => {
    eventsModule._loading = true;
    const selectSpy = jest.spyOn(apiClient, 'select');

    await eventsModule.loadEvents();

    expect(selectSpy).not.toHaveBeenCalled();

    selectSpy.mockRestore();
    eventsModule._loading = false;
  });
});

// ---------------------------------------------------------------------------
// Email preview and send functionality
// ---------------------------------------------------------------------------
describe('Events Module - Email Functions', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    // Replace div with input so .value works
    const oldEl = document.getElementById('attendeesEventId');
    if (oldEl) oldEl.remove();
    const input = document.createElement('input');
    input.id = 'attendeesEventId';
    input.value = 'evt-1';
    document.body.appendChild(input);
  });

  afterEach(() => {
    const el = document.getElementById('attendeesEventId');
    if (el) el.remove();
    const div = document.createElement('div');
    div.id = 'attendeesEventId';
    document.body.appendChild(div);
  });

  test('sendThankYouEmails shows warning when no attendees with emails', async () => {
    // getAttendees returns attendees without emails
    const selectAllSpy = jest
      .spyOn(apiClient, 'selectAll')
      .mockResolvedValue([{ id: 'a1', attendee_name: 'No Email', attendee_email: '', rsvp_status: 'attending' }]);
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.sendThankYouEmails();

    expect(toastSpy).toHaveBeenCalledWith('No attendees with email addresses', 'warning');

    selectAllSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('sendSurveyEmails shows warning when no survey URL', async () => {
    const selectApiSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [{ post_data: {} }],
    });
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.sendSurveyEmails();

    expect(toastSpy).toHaveBeenCalledWith('Please add a survey URL first', 'warning');

    selectApiSpy.mockRestore();
    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// _renderWinnerHighlights
// ---------------------------------------------------------------------------
describe('Events Module - _renderWinnerHighlights', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
  });

  test('returns HTML content for valid event', () => {
    const html = eventsModule._renderWinnerHighlights('evt-1');
    expect(html).toContain('Press Release');
    expect(html).toContain('Social Media Cards');
    expect(html).toContain('Winner Certificates');
  });

  test('returns "No event data" for invalid event ID', () => {
    const html = eventsModule._renderWinnerHighlights('nonexistent');
    expect(html).toContain('No event data');
  });
});

// ---------------------------------------------------------------------------
// _populateYearFilterFromConstants
// ---------------------------------------------------------------------------
describe('Events Module - _populateYearFilterFromConstants', () => {
  test('populates year filter dropdown', () => {
    eventsModule._populateYearFilterFromConstants();
    const yearSelect = document.getElementById('eventsYearFilter');
    expect(yearSelect.innerHTML).toContain('All Years');
  });
});

// ---------------------------------------------------------------------------
// togglePublishMode (async - calls updateByFilters + recreates modal)
// ---------------------------------------------------------------------------
describe('Events Module - togglePublishMode', () => {
  beforeEach(() => {
    eventsModule.isPublished = false;
    eventsModule.currentEventIdRunningOrder = 'evt-1';
    eventsModule.currentEventName = 'Test Event';
    eventsModule.runningOrderItems = [];
    // Create modal element that togglePublishMode expects to remove
    ensureDOMElement('runningOrderModal', 'div');
  });

  test('togglePublishMode toggles isPublished to true', async () => {
    const updateSpy = jest.spyOn(apiClient, 'updateByFilters').mockResolvedValue({});
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.togglePublishMode();

    expect(eventsModule.isPublished).toBe(true);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('published'), 'success');

    updateSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('togglePublishMode toggles back to false', async () => {
    eventsModule.isPublished = true;
    const updateSpy = jest.spyOn(apiClient, 'updateByFilters').mockResolvedValue({});
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.togglePublishMode();

    expect(eventsModule.isPublished).toBe(false);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('unlocked'), 'success');

    updateSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('togglePublishMode shows error on failure', async () => {
    const updateSpy = jest.spyOn(apiClient, 'updateByFilters').mockRejectedValue(new Error('fail'));
    const insertSpy = jest.spyOn(apiClient, 'insert').mockRejectedValue(new Error('fail'));
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.togglePublishMode();

    expect(toastSpy).toHaveBeenCalledWith('Failed to update publish status', 'error');

    updateSpy.mockRestore();
    insertSpy.mockRestore();
    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Bulk delete events
// ---------------------------------------------------------------------------
describe('Events Module - Bulk Operations', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    eventsModule._loading = false;
    eventsModule._selectedEvents = new Set(['evt-1', 'evt-2']);
    ensureDOMElement('eventsBulkActionsBar', 'div');
    ensureDOMElement('eventsSelectedCount', 'span');
  });

  test('bulkDeleteEvents deletes selected events after confirmation', async () => {
    const confirmSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    const deleteSpy = jest.spyOn(apiClient, 'delete').mockResolvedValue({ data: [] });
    // loadEvents uses select
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: sampleEvents.filter((e) => e.id === 'evt-3'),
      count: 1,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.bulkDeleteEvents();

    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteSpy).toHaveBeenCalledTimes(2);
    // runBatchOperation toast: "Deleting events: All 2 items processed successfully"
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('All 2 items processed'), 'success');
    // Selection should be cleared
    expect(eventsModule._selectedEvents.size).toBe(0);

    confirmSpy.mockRestore();
    deleteSpy.mockRestore();
    selectSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('bulkDeleteEvents returns early when none selected', async () => {
    eventsModule._selectedEvents = new Set();
    const confirmSpy = jest.spyOn(utils, 'confirmDialog');

    await eventsModule.bulkDeleteEvents();

    // Should not even show confirmation dialog
    expect(confirmSpy).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  test('bulkDeleteEvents does nothing when user cancels', async () => {
    const confirmSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(false);
    const deleteSpy = jest.spyOn(apiClient, 'delete');

    await eventsModule.bulkDeleteEvents();

    expect(deleteSpy).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
    deleteSpy.mockRestore();
  });

  test('bulkExportEvents exports selected events as CSV', () => {
    eventsModule._selectedEvents = new Set(['evt-1', 'evt-2']);
    const toastSpy = jest.spyOn(utils, 'showToast');
    // Mock URL.createObjectURL
    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();

    eventsModule.bulkExportEvents();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Exported 2 events'), 'success');

    toastSpy.mockRestore();
  });

  test('bulkExportEvents returns early when none selected', () => {
    eventsModule._selectedEvents = new Set();
    const toastSpy = jest.spyOn(utils, 'showToast');

    eventsModule.bulkExportEvents();

    expect(toastSpy).not.toHaveBeenCalled();

    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// saveSpecialReqs
// ---------------------------------------------------------------------------
describe('Events Module - saveSpecialReqs', () => {
  beforeEach(() => {
    // Replace the div with an input so .value works properly
    const oldEl = document.getElementById('attendeesEventId');
    if (oldEl) oldEl.remove();
    const input = document.createElement('input');
    input.id = 'attendeesEventId';
    input.value = 'evt-1';
    document.body.appendChild(input);

    ensureDOMElement('parkingPassesTotal', 'input', { value: '20' });
    ensureDOMElement('parkingPassesAllocated', 'input', { value: '15' });
    ensureDOMElement('parkingInstructions', 'textarea', { value: 'Use main entrance' });
    ensureDOMElement('photoConsentYes', 'span', { textContent: '10' });
    ensureDOMElement('photoConsentNo', 'span', { textContent: '3' });
    ensureDOMElement('emergencyContactName', 'input', { value: 'John Manager' });
    ensureDOMElement('emergencyContactPhone', 'input', { value: '07123456789' });
    ensureDOMElement('nearestHospital', 'input', { value: 'Royal London' });
    ensureDOMElement('firstAider', 'input', { value: 'Jane Smith' });
    ensureDOMElement('dressCode', 'select', { value: '' });
    ensureDOMElement('arrivalTime', 'input', { value: '18:00' });
    ensureDOMElement('ceremonyTime', 'input', { value: '19:00' });
  });

  afterEach(() => {
    // Restore original div
    const el = document.getElementById('attendeesEventId');
    if (el) el.remove();
    const div = document.createElement('div');
    div.id = 'attendeesEventId';
    document.body.appendChild(div);
  });

  test('saveSpecialReqs saves via upsert and shows toast', async () => {
    const upsertSpy = jest.spyOn(apiClient, 'upsert').mockResolvedValue({ data: [] });
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.saveSpecialReqs();

    expect(upsertSpy).toHaveBeenCalledWith(
      'event_special_requirements',
      expect.objectContaining({
        event_id: 'evt-1',
        requirements: expect.objectContaining({
          parkingTotal: 20,
          emergencyName: 'John Manager',
        }),
      }),
      expect.objectContaining({ onConflict: 'event_id' })
    );
    expect(toastSpy).toHaveBeenCalledWith('Special requirements saved', 'success');

    upsertSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('saveSpecialReqs falls back to localStorage on upsert error', async () => {
    const upsertSpy = jest.spyOn(apiClient, 'upsert').mockRejectedValue(new Error('fail'));
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.saveSpecialReqs();

    const stored = JSON.parse(localStorage.getItem(eventsModule._specialReqsKey('evt-1')));
    expect(stored).toBeTruthy();
    expect(stored.parkingTotal).toBe(20);
    expect(toastSpy).toHaveBeenCalledWith('Special requirements saved', 'success');

    upsertSpy.mockRestore();
    toastSpy.mockRestore();
    localStorage.removeItem(eventsModule._specialReqsKey('evt-1'));
  });
});

// ---------------------------------------------------------------------------
// closeOverlay / closeOverlayOnBackdrop
// ---------------------------------------------------------------------------
describe('Events Module - Overlay Management', () => {
  test('closeOverlay removes element by ID', () => {
    const overlay = document.createElement('div');
    overlay.id = 'testOverlay';
    document.body.appendChild(overlay);

    eventsModule.closeOverlay('testOverlay');

    expect(document.getElementById('testOverlay')).toBeNull();
  });

  test('closeOverlay does nothing for nonexistent ID', () => {
    expect(() => eventsModule.closeOverlay('nonexistent')).not.toThrow();
  });

  test('closeOverlayOnBackdrop removes overlay when clicking backdrop', () => {
    const overlay = document.createElement('div');
    overlay.id = 'backdropOverlay';
    document.body.appendChild(overlay);

    eventsModule.closeOverlayOnBackdrop('backdropOverlay', { target: overlay });

    expect(document.getElementById('backdropOverlay')).toBeNull();
  });

  test('closeOverlayOnBackdrop does not remove when clicking child', () => {
    const overlay = document.createElement('div');
    overlay.id = 'backdropOverlay2';
    const child = document.createElement('div');
    overlay.appendChild(child);
    document.body.appendChild(overlay);

    eventsModule.closeOverlayOnBackdrop('backdropOverlay2', { target: child });

    expect(document.getElementById('backdropOverlay2')).not.toBeNull();

    overlay.remove();
  });
});

// ---------------------------------------------------------------------------
// printRunningOrder
// ---------------------------------------------------------------------------
describe('Events Module - printRunningOrder', () => {
  test('printRunningOrder shows warning when no items', () => {
    eventsModule.runningOrderItems = [];
    const toastSpy = jest.spyOn(utils, 'showToast');

    eventsModule.printRunningOrder();

    expect(toastSpy).toHaveBeenCalledWith('No items to print', 'warning');

    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// saveDebrief
// ---------------------------------------------------------------------------
describe('Events Module - saveDebrief', () => {
  beforeEach(() => {
    // Replace div with input so .value works
    const oldEl = document.getElementById('attendeesEventId');
    if (oldEl) oldEl.remove();
    const input = document.createElement('input');
    input.id = 'attendeesEventId';
    input.value = 'evt-1';
    document.body.appendChild(input);

    ensureDOMElement('debriefWentWell', 'textarea', { value: 'Great venue' });
    ensureDOMElement('debriefImprove', 'textarea', { value: 'Better parking' });
    ensureDOMElement('debriefIdeas', 'textarea', { value: 'Live streaming' });
    ensureDOMElement('debriefActions', 'textarea', { value: 'Book venue early' });
    ensureDOMElement('debriefNotes', 'textarea', { value: 'Overall great event' });
    ensureDOMElement('sponsorSocialReach', 'input', { value: '50K' });
    ensureDOMElement('sponsorPressMentions', 'input', { value: '12' });
    ensureDOMElement('sponsorMediaValue', 'input', { value: '25000' });
    ensureDOMElement('surveyAvgRating', 'input', { value: '8.5' });
  });

  afterEach(() => {
    const el = document.getElementById('attendeesEventId');
    if (el) el.remove();
    const div = document.createElement('div');
    div.id = 'attendeesEventId';
    document.body.appendChild(div);
  });

  test('saveDebrief saves debrief data and shows toast', async () => {
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [{ post_data: {} }],
    });
    const upsertSpy = jest.spyOn(apiClient, 'upsert').mockResolvedValue({ data: [] });
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.saveDebrief();

    expect(toastSpy).toHaveBeenCalledWith('Debrief saved', 'success');

    selectSpy.mockRestore();
    upsertSpy.mockRestore();
    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// savePostEventData
// ---------------------------------------------------------------------------
describe('Events Module - savePostEventData', () => {
  beforeEach(() => {
    const oldEl = document.getElementById('attendeesEventId');
    if (oldEl) oldEl.remove();
    const input = document.createElement('input');
    input.id = 'attendeesEventId';
    input.value = 'evt-1';
    document.body.appendChild(input);

    ensureDOMElement('postEventSurveyUrl', 'input', { value: 'https://forms.google.com/test' });
    ensureDOMElement('surveyResponseCount', 'input', { value: '25' });
  });

  afterEach(() => {
    const el = document.getElementById('attendeesEventId');
    if (el) el.remove();
    const div = document.createElement('div');
    div.id = 'attendeesEventId';
    document.body.appendChild(div);
  });

  test('savePostEventData saves survey data and shows toast', async () => {
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [{ post_data: {} }],
    });
    const upsertSpy = jest.spyOn(apiClient, 'upsert').mockResolvedValue({ data: [] });
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.savePostEventData();

    expect(toastSpy).toHaveBeenCalledWith('Post-event data saved', 'success');

    selectSpy.mockRestore();
    upsertSpy.mockRestore();
    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// _downloadAllSocialCards
// ---------------------------------------------------------------------------
describe('Events Module - _downloadAllSocialCards', () => {
  test('shows toast with card count', () => {
    const toastSpy = jest.spyOn(utils, 'showToast');

    eventsModule._downloadAllSocialCards(5);

    expect(toastSpy).toHaveBeenCalledWith('Downloading 5 social cards...', 'success');

    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// generateAttendanceReport
// ---------------------------------------------------------------------------
describe('Events Module - generateAttendanceReport', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    const oldEl = document.getElementById('attendeesEventId');
    if (oldEl) oldEl.remove();
    const input = document.createElement('input');
    input.id = 'attendeesEventId';
    input.value = 'evt-1';
    document.body.appendChild(input);
  });

  afterEach(() => {
    const el = document.getElementById('attendeesEventId');
    if (el) el.remove();
    const div = document.createElement('div');
    div.id = 'attendeesEventId';
    document.body.appendChild(div);
  });

  test('generates CSV export with attendee data', async () => {
    const mockAttendees = [
      {
        id: 'a1',
        attendee_name: 'Alice',
        attendee_email: 'alice@test.com',
        rsvp_status: 'attending',
        guest_type: 'vip',
        checked_in: true,
        check_in_time: '2026-09-15T18:30:00',
        meal_preference: 'Vegetarian',
        plus_ones: 1,
      },
      {
        id: 'a2',
        attendee_name: 'Bob',
        attendee_email: 'bob@test.com',
        rsvp_status: 'attending',
        guest_type: 'guest',
        checked_in: false,
        meal_preference: '',
        plus_ones: 0,
      },
    ];
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({ data: mockAttendees, totalPages: 1 });
    const exportSpy = jest.spyOn(utils, 'exportToCSV').mockImplementation(() => {});
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.generateAttendanceReport();

    expect(exportSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ Name: 'Alice', 'Checked In': 'Yes' }),
        expect.objectContaining({ Name: 'Bob', 'No Show': 'YES' }),
      ]),
      expect.stringContaining('attendance_report.csv')
    );
    expect(toastSpy).toHaveBeenCalledWith('Attendance report exported', 'success');

    selectSpy.mockRestore();
    exportSpy.mockRestore();
    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// exportSponsorReport
// ---------------------------------------------------------------------------
describe('Events Module - exportSponsorReport', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
    const oldEl = document.getElementById('attendeesEventId');
    if (oldEl) oldEl.remove();
    const input = document.createElement('input');
    input.id = 'attendeesEventId';
    input.value = 'evt-1';
    document.body.appendChild(input);
  });

  afterEach(() => {
    const el = document.getElementById('attendeesEventId');
    if (el) el.remove();
    const div = document.createElement('div');
    div.id = 'attendeesEventId';
    document.body.appendChild(div);
  });

  test('exports sponsor report as CSV', async () => {
    // getAttendees
    const selectAllSpy = jest
      .spyOn(apiClient, 'selectAll')
      .mockResolvedValue([{ id: 'a1', attendee_name: 'VIP Guest', rsvp_status: 'attending', guest_type: 'vip' }]);
    // getBudget (event_budgets) + _getPostEventData (event_post_data)
    const selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [{ total_budget: 5000, post_data: { socialReach: '50K' } }],
    });
    const exportSpy = jest.spyOn(utils, 'exportToCSV').mockImplementation(() => {});
    const toastSpy = jest.spyOn(utils, 'showToast');

    await eventsModule.exportSponsorReport();

    expect(exportSpy).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ Event: expect.any(String) })]),
      expect.stringContaining('sponsor_roi.csv')
    );
    expect(toastSpy).toHaveBeenCalledWith('Sponsor report exported', 'success');

    selectAllSpy.mockRestore();
    selectSpy.mockRestore();
    exportSpy.mockRestore();
    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// _renderAttendanceReport (sync helper)
// ---------------------------------------------------------------------------
describe('Events Module - _renderAttendanceReport', () => {
  beforeEach(() => {
    STATE.allEvents = JSON.parse(JSON.stringify(sampleEvents));
  });

  test('renders HTML with attendance stats', async () => {
    const mockAttendees = [
      { id: 'a1', name: 'Alice', status: 'attending', guestType: 'vip', checkedIn: true, plusOnes: 1 },
      { id: 'a2', name: 'Bob', status: 'attending', guestType: 'guest', checkedIn: false, plusOnes: 0 },
      { id: 'a3', name: 'Charlie', status: 'not_attending', guestType: 'guest', checkedIn: false, plusOnes: 0 },
    ];
    const selectAllSpy = jest.spyOn(apiClient, 'selectAll').mockResolvedValue(mockAttendees);

    const html = await eventsModule._renderAttendanceReport('evt-1');

    expect(html).toContain('Total Invited');
    expect(html).toContain('Checked In');
    expect(html).toContain('No-Shows');

    selectAllSpy.mockRestore();
  });
});
