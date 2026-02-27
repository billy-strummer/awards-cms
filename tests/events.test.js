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

const today = new Date().toISOString().split('T')[0];
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
