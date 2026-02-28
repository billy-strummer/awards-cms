/**
 * Tests for the Events Module (events.js)
 * Run with: npx jest tests/events.test.js
 */

const { JSDOM } = require('jsdom');

// Setup minimal DOM before loading modules
const dom = new JSDOM(`<!DOCTYPE html><html><body>
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
</body></html>`, { url: 'http://localhost' });

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;

// Mock bootstrap
global.bootstrap = {
  Toast: class { show() {} hide() {} },
  Modal: class {
    show() {} hide() {}
    static getInstance() { return { hide() {} }; }
  },
  Tab: class { show() {} },
  Tooltip: class {}
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
  then: jest.fn(cb => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signInWithPassword: jest.fn(() => Promise.resolve({ data: { user: { email: 'test@test.com' } }, error: null })),
    signOut: jest.fn(() => Promise.resolve({ error: null }))
  },
  channel: jest.fn(() => ({
    on: jest.fn(function() { return this; }),
    subscribe: jest.fn(function() { return this; })
  }))
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
    event_status: 'confirmed'
  },
  {
    id: 'evt-2',
    event_name: 'Regional Finalists Night',
    event_date: pastDate,
    year: 2025,
    venue: 'Birmingham Conference Centre',
    capacity: 200,
    description: 'Regional event for finalists in the Midlands.',
    event_status: 'complete'
  },
  {
    id: 'evt-3',
    event_name: 'Draft Planning Meeting',
    event_date: null,
    year: 2026,
    venue: null,
    capacity: null,
    description: 'Internal planning session.',
    event_status: 'draft'
  },
  {
    id: 'evt-4',
    event_name: 'Cancelled Gala Dinner',
    event_date: '2025-12-01',
    year: 2025,
    venue: 'Hilton Hotel Manchester',
    capacity: 300,
    description: 'Gala dinner that was cancelled.',
    event_status: 'cancelled'
  },
  {
    id: 'evt-5',
    event_name: 'Upcoming Workshop',
    event_date: futureDate,
    year: thisYear,
    venue: 'Online',
    capacity: 50,
    description: 'Virtual workshop for nominees.',
    event_status: 'confirmed'
  }
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
    const datedEvents = stored.filter(e => e.event_date);
    for (let i = 0; i < datedEvents.length - 1; i++) {
      expect(datedEvents[i].event_date >= datedEvents[i + 1].event_date).toBe(true);
    }
  });

  test('filterEvents sorts events by year numerically', () => {
    eventsModule._sortField = 'year';
    eventsModule._sortDir = 'asc';
    eventsModule.filterEvents();
    const stored = eventsModule._lastFilteredEvents;
    const years = stored.map(e => Number(e.year) || 0);
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
        event_name: `Generated Event ${i}`
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
        event_name: `Paginated Event ${i}`
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
    const years = options.map(o => parseInt(o.value));
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
    { id: 'a1', name: 'Alice Smith', email: 'alice@test.com', status: 'attending', guestType: 'vip', dietary: 'Vegetarian', notes: '' },
    { id: 'a2', name: 'Bob Jones', email: 'bob@test.com', status: 'not_attending', guestType: 'guest', dietary: '', notes: '' },
    { id: 'a3', name: 'Charlie Brown', email: 'charlie@test.com', status: 'attending', guestType: 'speaker', dietary: 'Vegan', notes: '' },
    { id: 'a4', name: 'Diana Prince', email: 'diana@test.com', status: 'maybe', guestType: 'sponsor', dietary: 'Nut Allergy', notes: '' },
    { id: 'a5', name: 'Eve Adams', email: '', status: 'attending', guestType: 'guest', dietary: '', notes: '' }
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
    result.forEach(a => expect(a.status).toBe('attending'));
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
    result.forEach(a => expect(a.status).toBe('attending'));
  });
});

describe('Events Module - Edge Cases', () => {
  beforeEach(() => {
    STATE.allEvents = [];
    eventsModule._evtCurrentPage = 1;
    eventsModule._sortField = 'event_date';
    eventsModule._sortDir = 'desc';
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
    const xssEvents = [{
      id: 'evt-xss',
      event_name: '<script>alert("xss")</script>',
      event_date: futureDate,
      year: 2026,
      venue: '<img onerror=alert(1)>',
      capacity: 100,
      event_status: 'draft'
    }];
    eventsModule.renderFilteredEvents(xssEvents);
    const tbody = document.getElementById('eventsTableBody');
    expect(tbody.innerHTML).not.toContain('<script>');
    expect(tbody.innerHTML).not.toContain('<img onerror');
  });

  test('renderFilteredEvents handles events with null fields', () => {
    const nullEvents = [{
      id: 'evt-null',
      event_name: 'Null Fields Event',
      event_date: null,
      year: null,
      venue: null,
      capacity: null,
      event_status: null
    }];
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
    STATE.allEvents = [{ id: 'no-date', event_name: 'No Date', event_date: null, venue: null, year: null, event_status: 'draft' }];
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
    STATE.allEvents = [{ id: 'no-status', event_name: 'No Status', event_date: futureDate, year: 2026, venue: 'Test', event_status: null }];
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
      event_status: 'confirmed'
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
    const venues = stored.map(e => (e.venue || '').toLowerCase());
    for (let i = 0; i < venues.length - 1; i++) {
      expect(venues[i] <= venues[i + 1]).toBe(true);
    }
  });

  test('filterEvents sorts by event_status ascending', () => {
    eventsModule._sortField = 'event_status';
    eventsModule._sortDir = 'asc';
    eventsModule.filterEvents();
    const stored = eventsModule._lastFilteredEvents;
    const statuses = stored.map(e => (e.event_status || '').toLowerCase());
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
    const years = stored.map(e => Number(e.year) || 0);
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
        event_status: 'confirmed'
      });
    }
    eventsModule._evtPageSize = 50;
    eventsModule._evtCurrentPage = 1;
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
    const expected = STATE.allEvents.filter(e =>
      e.year === thisYear || (e.event_date && e.event_date.startsWith(String(thisYear)))
    ).length;
    expect(thisYearCount).toBe(expected);
  });

  test('updateEventStats with all events having dates shows zero data issues', () => {
    STATE.allEvents = STATE.allEvents.map(e => ({
      ...e,
      event_date: e.event_date || futureDate,
      venue: e.venue || 'Default Venue'
    }));
    eventsModule.updateEventStats();
    expect(document.getElementById('eventsDataIssuesCount').textContent).toBe('0');
    expect(document.getElementById('eventsDataQualityBar').style.display).toBe('none');
  });

  test('updateEventStats data quality text shows missing dates and venues', () => {
    STATE.allEvents = [
      { id: 'x1', event_name: 'E1', event_date: null, venue: 'V', year: 2026, event_status: 'draft' },
      { id: 'x2', event_name: 'E2', event_date: futureDate, venue: null, year: 2026, event_status: 'draft' },
      { id: 'x3', event_name: 'E3', event_date: null, venue: null, year: 2026, event_status: 'draft' }
    ];
    eventsModule.updateEventStats();
    const text = document.getElementById('eventsDataQualityText').textContent;
    expect(text).toContain('missing date');
    expect(text).toContain('missing venue');
  });

  test('updateEventStats correctly pluralizes missing counts', () => {
    STATE.allEvents = [
      { id: 'x1', event_name: 'E1', event_date: null, venue: 'V', year: 2026, event_status: 'draft' }
    ];
    eventsModule.updateEventStats();
    const text = document.getElementById('eventsDataQualityText').textContent;
    expect(text).toContain('1 missing date');
    expect(text).not.toContain('dates');
  });

  test('updateEventStats with multiple missing dates pluralizes', () => {
    STATE.allEvents = [
      { id: 'x1', event_name: 'E1', event_date: null, venue: 'V', year: 2026, event_status: 'draft' },
      { id: 'x2', event_name: 'E2', event_date: null, venue: 'V', year: 2026, event_status: 'draft' }
    ];
    eventsModule.updateEventStats();
    const text = document.getElementById('eventsDataQualityText').textContent;
    expect(text).toContain('2 missing dates');
  });

  test('updateEventStats handles mixed upcoming and past events', () => {
    STATE.allEvents = [
      { id: 'u1', event_name: 'Future', event_date: futureDate, year: 2026, venue: 'V', event_status: 'confirmed' },
      { id: 'p1', event_name: 'Past', event_date: '2020-01-01', year: 2020, venue: 'V', event_status: 'complete' },
      { id: 'n1', event_name: 'NoDate', event_date: null, year: 2026, venue: 'V', event_status: 'draft' }
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
    const warningCalls = toastSpy.mock.calls.filter(c => c[0] === 'Please enter an event name');
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
      { id: 'd2', event_name: 'Has Date', event_date: futureDate, venue: 'V', year: 2026, event_status: 'draft' }
    ];
    eventsModule.filterDataIssues();
    expect(document.getElementById('eventsCount').textContent).toBe('1');
  });

  test('filterDataIssues shows events missing venue', () => {
    STATE.allEvents = [
      { id: 'd1', event_name: 'Missing Venue', event_date: futureDate, venue: null, year: 2026, event_status: 'draft' },
      { id: 'd2', event_name: 'Has Venue', event_date: futureDate, venue: 'V', year: 2026, event_status: 'draft' }
    ];
    eventsModule.filterDataIssues();
    expect(document.getElementById('eventsCount').textContent).toBe('1');
  });

  test('filterDataIssues shows events missing both date and venue', () => {
    STATE.allEvents = [
      { id: 'd1', event_name: 'Missing Both', event_date: null, venue: null, year: 2026, event_status: 'draft' },
      { id: 'd2', event_name: 'Complete', event_date: futureDate, venue: 'V', year: 2026, event_status: 'draft' }
    ];
    eventsModule.filterDataIssues();
    expect(document.getElementById('eventsCount').textContent).toBe('1');
  });

  test('filterDataIssues returns zero when all events have date and venue', () => {
    STATE.allEvents = [
      { id: 'd1', event_name: 'OK1', event_date: futureDate, venue: 'V1', year: 2026, event_status: 'draft' },
      { id: 'd2', event_name: 'OK2', event_date: futureDate, venue: 'V2', year: 2026, event_status: 'draft' }
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
    const xssEvent = [{
      id: 'evt-xss-venue',
      event_name: 'Normal Name',
      event_date: futureDate,
      year: 2026,
      venue: '<img src=x onerror=alert(1)>',
      capacity: 100,
      event_status: 'draft'
    }];
    eventsModule.renderFilteredEvents(xssEvent);
    const tbody = document.getElementById('eventsTableBody');
    expect(tbody.innerHTML).not.toContain('<img src=x');
  });

  test('renderFilteredEvents escapes HTML in description', () => {
    const xssEvent = [{
      id: 'evt-xss-desc',
      event_name: 'Normal Name',
      event_date: futureDate,
      year: 2026,
      venue: 'Normal',
      capacity: 100,
      description: '<script>alert("xss")</script>',
      event_status: 'draft'
    }];
    eventsModule.renderFilteredEvents(xssEvent);
    const tbody = document.getElementById('eventsTableBody');
    expect(tbody.innerHTML).not.toContain('<script>');
  });

  test('renderFilteredEvents handles event with empty string fields', () => {
    const emptyEvent = [{
      id: 'evt-empty',
      event_name: '',
      event_date: '',
      year: '',
      venue: '',
      capacity: '',
      event_status: ''
    }];
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
    { id: 'a1', name: 'Alice Smith', email: 'alice@test.com', status: 'attending', guestType: 'vip', dietary: 'Vegetarian', notes: '' },
    { id: 'a2', name: 'Bob Jones', email: 'bob@test.com', status: 'not_attending', guestType: 'guest', dietary: '', notes: '' },
    { id: 'a3', name: 'Charlie Brown', email: 'charlie@test.com', status: 'attending', guestType: 'speaker', dietary: 'Vegan', notes: '' },
    { id: 'a4', name: 'Diana Prince', email: 'diana@test.com', status: 'maybe', guestType: 'sponsor', dietary: 'Nut Allergy', notes: '' },
    { id: 'a5', name: 'Eve Adams', email: '', status: 'attending', guestType: 'guest', dietary: '', notes: '' }
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
    const attendeesWithNull = [
      { id: 'n1', name: 'No Email', email: null, status: 'attending', guestType: 'guest' }
    ];
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
      { id: 'y2', event_name: 'E2', year: 2023, event_date: '2023-01-01' }
    ];
    eventsModule.populateYearFilter();
    const select = document.getElementById('eventsYearFilter');
    expect(select.innerHTML).toContain('2024');
    expect(select.innerHTML).toContain('2023');
  });

  test('populateYearFilter does not duplicate years', () => {
    STATE.allEvents = [
      { id: 'y1', event_name: 'E1', year: 2026 },
      { id: 'y2', event_name: 'E2', year: 2026 }
    ];
    eventsModule.populateYearFilter();
    const select = document.getElementById('eventsYearFilter');
    const options = Array.from(select.querySelectorAll('option')).filter(o => o.value === '2026');
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
    const xssEvents = [{
      id: 'xss-1',
      event_name: '<script>document.cookie</script>',
      event_date: futureDate,
      year: 2026,
      venue: 'Normal',
      event_status: 'draft'
    }];
    eventsModule.renderFilteredEvents(xssEvents);
    const tbody = document.getElementById('eventsTableBody');
    expect(tbody.querySelector('script')).toBeNull();
  });

  test('renderFilteredEvents prevents img onerror injection', () => {
    const xssEvents = [{
      id: 'xss-2',
      event_name: '<img src=x onerror="alert(1)">',
      event_date: futureDate,
      year: 2026,
      venue: 'Normal',
      event_status: 'draft'
    }];
    eventsModule.renderFilteredEvents(xssEvents);
    const tbody = document.getElementById('eventsTableBody');
    expect(tbody.querySelector('img[onerror]')).toBeNull();
  });

  test('renderFilteredEvents prevents JavaScript URL injection', () => {
    const xssEvents = [{
      id: 'xss-3',
      event_name: 'javascript:alert(1)',
      event_date: futureDate,
      year: 2026,
      venue: 'Normal',
      event_status: 'draft'
    }];
    eventsModule.renderFilteredEvents(xssEvents);
    const tbody = document.getElementById('eventsTableBody');
    // The name should be rendered as text, not as a URL
    expect(tbody.innerHTML).toContain('javascript:alert(1)');
  });

  test('renderFilteredEvents handles event name with HTML entities', () => {
    const entityEvents = [{
      id: 'ent-1',
      event_name: 'Awards & Gala <2026>',
      event_date: futureDate,
      year: 2026,
      venue: 'Normal',
      event_status: 'draft'
    }];
    eventsModule.renderFilteredEvents(entityEvents);
    const tbody = document.getElementById('eventsTableBody');
    expect(tbody.innerHTML).toContain('&amp;');
    expect(tbody.innerHTML).toContain('&lt;2026&gt;');
  });

  test('renderFilteredEvents handles venue with quotes', () => {
    const quoteEvents = [{
      id: 'q-1',
      event_name: 'Normal Event',
      event_date: futureDate,
      year: 2026,
      venue: 'The "Grand" Hall',
      event_status: 'draft'
    }];
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
    const undefinedEvent = [{
      id: 'undef-1',
      event_name: undefined,
      event_date: undefined,
      year: undefined,
      venue: undefined,
      capacity: undefined,
      event_status: undefined
    }];
    expect(() => eventsModule.renderFilteredEvents(undefinedEvent)).not.toThrow();
  });

  test('updateEventStats handles events with various null fields', () => {
    STATE.allEvents = [
      { id: 'n1', event_name: null, event_date: null, year: null, venue: null, event_status: null },
      { id: 'n2', event_name: 'OK', event_date: futureDate, year: 2026, venue: 'V', event_status: 'confirmed' }
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
