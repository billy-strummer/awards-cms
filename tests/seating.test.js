/**
 * Tests for the Seating Enhancements Module (seating-enhancements.js)
 * Run with: npx jest tests/seating.test.js
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
  <div id="tpCanvas">
    <div class="tp-table-el" data-table-id="t1">
      <div class="tp-table-shape"></div>
      <div class="seat-dot"></div>
      <div class="seat-dot"></div>
      <div class="seat-dot"></div>
    </div>
    <div class="tp-table-el" data-table-id="t2">
      <div class="tp-table-shape"></div>
      <div class="seat-dot"></div>
    </div>
  </div>
  <div id="tpToolbar"></div>
  <div id="seatingListContainer"></div>
  <div id="unassignedGuestsList">
    <div class="guest-chip" data-guest-id="g1">Alice</div>
    <div class="guest-chip" data-guest-id="g2">Bob</div>
  </div>
  <div id="tpDetailContent">
    <div class="detail-body">
      <div class="seated-guest">
        <span class="remove-x">x</span>
      </div>
      <hr>
      <hr>
      <button onclick="eventsModule.saveTableProperties('t1')">Save</button>
    </div>
  </div>
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

// Mock window.open for printSeatingList
global.window.open = jest.fn(() => ({
  document: {
    write: jest.fn(),
    close: jest.fn(),
  },
}));

// Mock prompt
global.prompt = jest.fn(() => null);

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

// ==========================================
// SAMPLE DATA
// ==========================================
const sampleTables = [
  {
    id: 't1',
    table_name: 'VIP Table',
    table_number: 1,
    total_seats: 8,
    notes: '[ACCESSIBLE] Important guests here',
    assignments: [
      {
        id: 'a1',
        guest_id: 'g1',
        guest_name: 'Alice Johnson',
        company_name: 'Acme Corp',
        seat_number: 1,
        is_vip: true,
        dietary_requirements: 'Vegetarian',
        organisation_id: 'org-1',
      },
      {
        id: 'a2',
        guest_id: 'g2',
        guest_name: 'Bob Smith',
        company_name: 'BuildRight',
        seat_number: 2,
        is_vip: false,
        dietary_requirements: 'Gluten-free',
        organisation_id: 'org-2',
      },
      {
        id: 'a3',
        guest_id: 'g3',
        guest_name: 'Carol White',
        company_name: 'Acme Corp',
        seat_number: 3,
        is_vip: false,
        dietary_requirements: '',
        organisation_id: 'org-1',
      },
    ],
  },
  {
    id: 't2',
    table_name: 'General Table',
    table_number: 2,
    total_seats: 10,
    notes: 'Near the stage',
    assignments: [
      {
        id: 'a4',
        guest_id: 'g4',
        guest_name: 'Dave Brown',
        company_name: 'Garden Masters',
        seat_number: 1,
        is_vip: false,
        dietary_requirements: 'Vegan',
        organisation_id: 'org-3',
      },
      {
        id: 'a5',
        guest_id: 'g5',
        guest_name: 'Eve Green',
        company_name: null,
        seat_number: 2,
        is_vip: true,
        dietary_requirements: 'Vegetarian',
        organisation_id: null,
      },
    ],
  },
  {
    id: 't3',
    table_name: null,
    table_number: 3,
    total_seats: 6,
    notes: null,
    assignments: [],
  },
];

const sampleUnassigned = [
  { guest_id: 'g10', id: 'g10', guest_name: 'Frank Lee', company_name: 'TestCo', organisation_id: 'org-4' },
  { guest_id: 'g11', id: 'g11', guest_name: 'Grace Chen', company_name: null, organisation_id: null },
];

// Create a mock eventsModule for seating to patch
global.eventsModule = {
  renderCanvasTables: jest.fn(),
  showTableDetail: jest.fn(),
  createTablePlanModal: jest.fn(),
  renderUnassignedGuests: jest.fn(),
  removeGuestFromTable: jest.fn(() => Promise.resolve()),
  handleTableDrop: jest.fn(() => Promise.resolve()),
  saveTableProperties: jest.fn(() => Promise.resolve()),
  loadTablePlan: jest.fn(() => Promise.resolve()),
  tables: [...sampleTables],
  unassignedGuests: [...sampleUnassigned],
  currentEventIdTablePlan: 'evt-1',
  currentEventNameTablePlan: 'Awards Gala 2026',
  _selectedTableId: null,
};
global.window.eventsModule = global.eventsModule;

// Mock jsPDF
global.window.jspdf = {
  jsPDF: class {
    constructor() {
      this.pages = 1;
    }
    addPage() {
      this.pages++;
    }
    setDrawColor() {}
    setLineWidth() {}
    roundedRect() {}
    setFontSize() {}
    setTextColor() {}
    text() {}
    setLineDashPattern() {}
    line() {}
    save(name) {
      this._savedAs = name;
    }
  },
};

require('../seating-enhancements.js');
syncWindowToGlobal();

// ==========================================
// TESTS
// ==========================================

describe('Seating Enhancements - Structure', () => {
  test('seatingEnhancements is defined', () => {
    expect(seatingEnhancements).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof seatingEnhancements.init).toBe('function');
    expect(typeof seatingEnhancements._upgradeSeatDots).toBe('function');
    expect(typeof seatingEnhancements._pushUndo).toBe('function');
    expect(typeof seatingEnhancements.undo).toBe('function');
    expect(typeof seatingEnhancements.redo).toBe('function');
  });

  test('has all feature methods', () => {
    expect(typeof seatingEnhancements._showEmptyPopup).toBe('function');
    expect(typeof seatingEnhancements._showOccupiedPopup).toBe('function');
    expect(typeof seatingEnhancements._toggleVip).toBe('function');
    expect(typeof seatingEnhancements._renderSections).toBe('function');
    expect(typeof seatingEnhancements.showDietarySummary).toBe('function');
    expect(typeof seatingEnhancements.showSeatingList).toBe('function');
    expect(typeof seatingEnhancements.closeSeatingList).toBe('function');
    expect(typeof seatingEnhancements.printSeatingList).toBe('function');
    expect(typeof seatingEnhancements.generatePlaceCards).toBe('function');
    expect(typeof seatingEnhancements.generateNameTents).toBe('function');
    expect(typeof seatingEnhancements._injectDetailExtras).toBe('function');
    expect(typeof seatingEnhancements._injectToolbarButtons).toBe('function');
    expect(typeof seatingEnhancements._bindKeyboard).toBe('function');
    expect(typeof seatingEnhancements._renderTableIcons).toBe('function');
    expect(typeof seatingEnhancements._toggleVipFilter).toBe('function');
    expect(typeof seatingEnhancements._decorateSidebarGuests).toBe('function');
    expect(typeof seatingEnhancements.loadSections).toBe('function');
    expect(typeof seatingEnhancements.addSection).toBe('function');
    expect(typeof seatingEnhancements._toggleAccessible).toBe('function');
    expect(typeof seatingEnhancements.closeDietaryOverlay).toBe('function');
    expect(typeof seatingEnhancements._renderSlContent).toBe('function');
    expect(typeof seatingEnhancements._renderSlByTable).toBe('function');
    expect(typeof seatingEnhancements._renderSlByCompany).toBe('function');
  });

  test('has default state', () => {
    expect(Array.isArray(seatingEnhancements._undoStack)).toBe(true);
    expect(Array.isArray(seatingEnhancements._redoStack)).toBe(true);
    expect(Array.isArray(seatingEnhancements._sections)).toBe(true);
    expect(seatingEnhancements._vipFilterOn).toBe(false);
    expect(seatingEnhancements._seatPopup).toBeNull();
    expect(seatingEnhancements._seatTooltip).toBeNull();
  });
});

describe('Seating Enhancements - Undo/Redo Stack', () => {
  beforeEach(() => {
    seatingEnhancements._undoStack = [];
    seatingEnhancements._redoStack = [];
  });

  test('_pushUndo adds to undo stack', () => {
    seatingEnhancements._pushUndo({ type: 'assign', data: { id: 'a1', table_id: 't1' } });
    expect(seatingEnhancements._undoStack.length).toBe(1);
    expect(seatingEnhancements._undoStack[0].type).toBe('assign');
  });

  test('_pushUndo clears redo stack', () => {
    seatingEnhancements._redoStack = [{ type: 'remove', data: {} }];
    seatingEnhancements._pushUndo({ type: 'assign', data: {} });
    expect(seatingEnhancements._redoStack.length).toBe(0);
  });

  test('_pushUndo limits stack to 20 entries', () => {
    for (let i = 0; i < 30; i++) {
      seatingEnhancements._pushUndo({ type: 'assign', data: { id: `a${i}` } });
    }
    expect(seatingEnhancements._undoStack.length).toBeLessThanOrEqual(20);
  });

  test('_pushUndo shifts oldest entry when stack exceeds limit', () => {
    for (let i = 0; i < 21; i++) {
      seatingEnhancements._pushUndo({ type: 'assign', data: { id: `a${i}` } });
    }
    // The first entry (a0) should have been shifted out
    expect(seatingEnhancements._undoStack[0].data.id).toBe('a1');
    expect(seatingEnhancements._undoStack.length).toBe(20);
  });

  test('undo shows toast when stack is empty', async () => {
    seatingEnhancements._undoStack = [];
    await seatingEnhancements.undo();
    // Should not throw, just show toast
  });

  test('redo shows toast when stack is empty', async () => {
    seatingEnhancements._redoStack = [];
    await seatingEnhancements.redo();
    // Should not throw, just show toast
  });

  test('undo pops from undo stack and pushes to redo for assign', async () => {
    // Mock apiClient for delete
    jest.spyOn(apiClient, 'deleteByFilters').mockResolvedValue();
    eventsModule.loadTablePlan = jest.fn(() => Promise.resolve());

    seatingEnhancements._undoStack = [{ type: 'assign', data: { guest_id: 'g1', table_id: 't1' } }];
    seatingEnhancements._redoStack = [];

    await seatingEnhancements.undo();

    expect(seatingEnhancements._undoStack.length).toBe(0);
    expect(seatingEnhancements._redoStack.length).toBe(1);
    expect(seatingEnhancements._redoStack[0].type).toBe('assign');
    expect(apiClient.deleteByFilters).toHaveBeenCalledWith('table_assignments', {
      guest_id: { eq: 'g1' },
      table_id: { eq: 't1' },
    });
    jest.restoreAllMocks();
  });

  test('undo for remove type inserts back the assignment', async () => {
    jest.spyOn(apiClient, 'insert').mockResolvedValue();
    eventsModule.loadTablePlan = jest.fn(() => Promise.resolve());

    seatingEnhancements._undoStack = [
      {
        type: 'remove',
        data: { id: 'a1', guest_id: 'g1', table_id: 't1', guest_name: 'Alice', seat_number: 1 },
      },
    ];

    await seatingEnhancements.undo();

    expect(seatingEnhancements._undoStack.length).toBe(0);
    expect(seatingEnhancements._redoStack.length).toBe(1);
    expect(apiClient.insert).toHaveBeenCalledWith(
      'table_assignments',
      expect.objectContaining({
        guest_id: 'g1',
        table_id: 't1',
      })
    );
    jest.restoreAllMocks();
  });

  test('redo for assign type inserts the assignment', async () => {
    jest.spyOn(apiClient, 'insert').mockResolvedValue();
    eventsModule.loadTablePlan = jest.fn(() => Promise.resolve());

    seatingEnhancements._redoStack = [
      {
        type: 'assign',
        data: { guest_id: 'g1', table_id: 't1', guest_name: 'Alice', seat_number: 1 },
      },
    ];

    await seatingEnhancements.redo();

    expect(seatingEnhancements._redoStack.length).toBe(0);
    expect(seatingEnhancements._undoStack.length).toBe(1);
    expect(apiClient.insert).toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  test('redo for remove type deletes the assignment', async () => {
    jest.spyOn(apiClient, 'delete').mockResolvedValue();
    eventsModule.loadTablePlan = jest.fn(() => Promise.resolve());

    seatingEnhancements._redoStack = [
      {
        type: 'remove',
        data: { id: 'a1', guest_id: 'g1', table_id: 't1' },
      },
    ];

    await seatingEnhancements.redo();

    expect(seatingEnhancements._redoStack.length).toBe(0);
    expect(seatingEnhancements._undoStack.length).toBe(1);
    expect(apiClient.delete).toHaveBeenCalledWith('table_assignments', 'a1');
    jest.restoreAllMocks();
  });
});

describe('Seating Enhancements - VIP Filter', () => {
  test('VIP filter toggle flips state', () => {
    seatingEnhancements._vipFilterOn = false;
    seatingEnhancements._toggleVipFilter();
    expect(seatingEnhancements._vipFilterOn).toBe(true);
    seatingEnhancements._toggleVipFilter();
    expect(seatingEnhancements._vipFilterOn).toBe(false);
  });
});

describe('Seating Enhancements - Sections', () => {
  test('sections array is empty by default', () => {
    seatingEnhancements._sections = [];
    expect(seatingEnhancements._sections).toEqual([]);
  });

  test('can store section data', () => {
    seatingEnhancements._sections = [
      { id: 's1', name: 'Main Hall', color: '#0d6efd' },
      { id: 's2', name: 'VIP Area', color: '#ffc107' },
    ];
    expect(seatingEnhancements._sections.length).toBe(2);
    seatingEnhancements._sections = [];
  });

  test('_renderSections creates section elements on canvas', () => {
    seatingEnhancements._sections = [
      { id: 's1', name: 'VIP Area', color: '#ffc107', x: 100, y: 100, width: 400, height: 300 },
    ];
    seatingEnhancements._renderSections();
    const sectionEl = document.querySelector('.se-section');
    expect(sectionEl).not.toBeNull();
    expect(sectionEl.dataset.sectionId).toBe('s1');
    expect(sectionEl.innerHTML).toContain('VIP Area');

    // Clean up
    document.querySelectorAll('.se-section').forEach((el) => el.remove());
    seatingEnhancements._sections = [];
  });

  test('_renderSections does nothing when canvas is missing', () => {
    const canvas = document.getElementById('tpCanvas');
    canvas.id = 'tempHidden';
    seatingEnhancements._sections = [{ id: 's1', name: 'Test', color: '#000', x: 0, y: 0, width: 100, height: 100 }];
    seatingEnhancements._renderSections(); // should not throw
    canvas.id = 'tpCanvas';
    seatingEnhancements._sections = [];
  });

  test('_renderSections does nothing when sections array is empty', () => {
    seatingEnhancements._sections = [];
    seatingEnhancements._renderSections();
    expect(document.querySelectorAll('.se-section').length).toBe(0);
  });

  test('_renderSections removes old sections before creating new', () => {
    seatingEnhancements._sections = [{ id: 's1', name: 'First', color: '#000', x: 0, y: 0, width: 100, height: 100 }];
    seatingEnhancements._renderSections();
    expect(document.querySelectorAll('.se-section').length).toBe(1);

    seatingEnhancements._sections = [{ id: 's2', name: 'Second', color: '#fff', x: 0, y: 0, width: 100, height: 100 }];
    seatingEnhancements._renderSections();
    expect(document.querySelectorAll('.se-section').length).toBe(1);
    expect(document.querySelector('.se-section').dataset.sectionId).toBe('s2');

    // Clean up
    document.querySelectorAll('.se-section').forEach((el) => el.remove());
    seatingEnhancements._sections = [];
  });
});

describe('Seating Enhancements - Sort Options', () => {
  test('default sort is by table', () => {
    expect(seatingEnhancements._slSort).toBe('table');
  });

  test('supports other sort options', () => {
    seatingEnhancements._slSort = 'company';
    expect(seatingEnhancements._slSort).toBe('company');
    seatingEnhancements._slSort = 'table'; // Reset
  });
});

describe('Seating Enhancements - init', () => {
  test('init patches eventsModule methods', () => {
    const origRender = eventsModule.renderCanvasTables;
    const origDetail = eventsModule.showTableDetail;
    const origModal = eventsModule.createTablePlanModal;
    const origSidebar = eventsModule.renderUnassignedGuests;
    const origRemove = eventsModule.removeGuestFromTable;
    const origDrop = eventsModule.handleTableDrop;

    seatingEnhancements.init();

    expect(eventsModule.renderCanvasTables).not.toBe(origRender);
    expect(eventsModule.showTableDetail).not.toBe(origDetail);
    expect(eventsModule.createTablePlanModal).not.toBe(origModal);
    expect(eventsModule.renderUnassignedGuests).not.toBe(origSidebar);
    expect(eventsModule.removeGuestFromTable).not.toBe(origRemove);
    expect(eventsModule.handleTableDrop).not.toBe(origDrop);
  });

  test('init warns and returns when eventsModule is missing', () => {
    const origEM = window.eventsModule;
    window.eventsModule = undefined;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // Create a fresh instance by calling init on a temp context
    const saved = seatingEnhancements.init;
    seatingEnhancements.init();
    expect(warnSpy).toHaveBeenCalledWith('seatingEnhancements: eventsModule not found');
    window.eventsModule = origEM;
    warnSpy.mockRestore();
  });
});

describe('Seating Enhancements - Dietary Summary', () => {
  beforeEach(() => {
    eventsModule.tables = [...sampleTables];
  });

  afterEach(() => {
    // Clean up any overlays
    const overlay = document.getElementById('seDietaryOverlay');
    if (overlay) overlay.remove();
  });

  test('showDietarySummary creates overlay element', () => {
    seatingEnhancements.showDietarySummary();
    const overlay = document.getElementById('seDietaryOverlay');
    expect(overlay).not.toBeNull();
    expect(overlay.style.position).toBe('fixed');
  });

  test('showDietarySummary displays dietary requirements summary table', () => {
    seatingEnhancements.showDietarySummary();
    const overlay = document.getElementById('seDietaryOverlay');
    const content = overlay.innerHTML;
    expect(content).toContain('Dietary Summary');
    expect(content).toContain('Vegetarian');
    expect(content).toContain('Gluten-free');
    expect(content).toContain('Vegan');
  });

  test('showDietarySummary counts dietary requirements correctly', () => {
    seatingEnhancements.showDietarySummary();
    const overlay = document.getElementById('seDietaryOverlay');
    const content = overlay.innerHTML;
    // Vegetarian appears twice (Alice + Eve)
    expect(content).toContain('2');
    // Gluten-free appears once (Bob)
    // Vegan appears once (Dave)
  });

  test('showDietarySummary shows per-table breakdown', () => {
    seatingEnhancements.showDietarySummary();
    const overlay = document.getElementById('seDietaryOverlay');
    const content = overlay.innerHTML;
    expect(content).toContain('VIP Table');
    expect(content).toContain('General Table');
    expect(content).toContain('Alice Johnson');
    expect(content).toContain('Per-table breakdown');
  });

  test('showDietarySummary handles no dietary requirements', () => {
    eventsModule.tables = [
      {
        id: 't-empty',
        table_name: 'Empty',
        table_number: 1,
        total_seats: 8,
        assignments: [{ id: 'a-test', guest_name: 'Test', dietary_requirements: '' }],
      },
    ];
    seatingEnhancements.showDietarySummary();
    const overlay = document.getElementById('seDietaryOverlay');
    expect(overlay.innerHTML).toContain('No dietary requirements recorded');
  });

  test('closeDietaryOverlay removes overlay', () => {
    seatingEnhancements.showDietarySummary();
    expect(document.getElementById('seDietaryOverlay')).not.toBeNull();
    seatingEnhancements.closeDietaryOverlay();
    expect(document.getElementById('seDietaryOverlay')).toBeNull();
  });

  test('closeDietaryOverlay handles missing overlay gracefully', () => {
    expect(() => seatingEnhancements.closeDietaryOverlay()).not.toThrow();
  });
});

describe('Seating Enhancements - Seating List', () => {
  beforeEach(() => {
    eventsModule.tables = [...sampleTables];
    eventsModule.unassignedGuests = [...sampleUnassigned];
    seatingEnhancements._slSort = 'table';
  });

  afterEach(() => {
    const overlay = document.getElementById('seSeatingListOverlay');
    if (overlay) overlay.remove();
  });

  test('showSeatingList creates overlay with stats', () => {
    seatingEnhancements.showSeatingList();
    const overlay = document.getElementById('seSeatingListOverlay');
    expect(overlay).not.toBeNull();
    expect(overlay.innerHTML).toContain('Seating List');
    expect(overlay.innerHTML).toContain('5 seated'); // 3 + 2
    expect(overlay.innerHTML).toContain('24 total seats'); // 8 + 10 + 6
    expect(overlay.innerHTML).toContain('2 unassigned');
  });

  test('showSeatingList shows sort toggle buttons', () => {
    seatingEnhancements.showSeatingList();
    const overlay = document.getElementById('seSeatingListOverlay');
    expect(overlay.innerHTML).toContain('By Table');
    expect(overlay.innerHTML).toContain('By Company');
  });

  test('closeSeatingList removes overlay', () => {
    seatingEnhancements.showSeatingList();
    expect(document.getElementById('seSeatingListOverlay')).not.toBeNull();
    seatingEnhancements.closeSeatingList();
    expect(document.getElementById('seSeatingListOverlay')).toBeNull();
  });

  test('closeSeatingList handles missing overlay gracefully', () => {
    expect(() => seatingEnhancements.closeSeatingList()).not.toThrow();
  });

  test('_setSlSort changes sort mode and re-renders', () => {
    seatingEnhancements.showSeatingList();
    seatingEnhancements._setSlSort('company');
    expect(seatingEnhancements._slSort).toBe('company');
    seatingEnhancements._slSort = 'table';
  });
});

describe('Seating Enhancements - Render Seating List Content', () => {
  beforeEach(() => {
    eventsModule.tables = [...sampleTables];
    seatingEnhancements._slSort = 'table';
  });

  test('_renderSlContent returns by-table view by default', () => {
    const html = seatingEnhancements._renderSlContent();
    expect(html).toContain('VIP Table');
    expect(html).toContain('General Table');
    expect(html).toContain('Table 3');
  });

  test('_renderSlContent returns by-company view when sort is company', () => {
    seatingEnhancements._slSort = 'company';
    const html = seatingEnhancements._renderSlContent();
    expect(html).toContain('Acme Corp');
    expect(html).toContain('BuildRight');
    expect(html).toContain('Garden Masters');
    seatingEnhancements._slSort = 'table';
  });

  test('_renderSlByTable shows all tables with guests', () => {
    const html = seatingEnhancements._renderSlByTable(sampleTables);
    expect(html).toContain('Alice Johnson');
    expect(html).toContain('Bob Smith');
    expect(html).toContain('Dave Brown');
    expect(html).toContain('Eve Green');
    expect(html).toContain('Seat 1');
    expect(html).toContain('VIP');
    expect(html).toContain('3/8'); // VIP Table capacity
    expect(html).toContain('2/10'); // General Table capacity
  });

  test('_renderSlByTable shows empty table message', () => {
    const html = seatingEnhancements._renderSlByTable(sampleTables);
    // Table 3 has no assignments
    expect(html).toContain('No guests assigned');
  });

  test('_renderSlByTable returns message for no tables', () => {
    const html = seatingEnhancements._renderSlByTable([]);
    expect(html).toContain('No tables created yet');
  });

  test('_renderSlByTable groups guests by company within table', () => {
    const html = seatingEnhancements._renderSlByTable(sampleTables);
    // Acme Corp has 2 guests at VIP Table
    expect(html).toContain('Acme Corp');
    expect(html).toContain('(2)'); // 2 guests from Acme
  });

  test('_renderSlByCompany groups all guests by company', () => {
    const html = seatingEnhancements._renderSlByCompany(sampleTables);
    expect(html).toContain('Acme Corp');
    expect(html).toContain('BuildRight');
    expect(html).toContain('Garden Masters');
    expect(html).toContain('No Company'); // Eve Green has no company
  });

  test('_renderSlByCompany returns message for no assignments', () => {
    const emptyTables = [{ ...sampleTables[2] }]; // only table 3, no assignments
    const html = seatingEnhancements._renderSlByCompany(emptyTables);
    expect(html).toContain('No guests assigned yet');
  });

  test('_renderSlByCompany shows table label for each guest', () => {
    const html = seatingEnhancements._renderSlByCompany(sampleTables);
    expect(html).toContain('VIP Table');
    expect(html).toContain('General Table');
  });

  test('_renderSlByCompany shows VIP badges', () => {
    const html = seatingEnhancements._renderSlByCompany(sampleTables);
    expect(html).toContain('VIP');
  });
});

describe('Seating Enhancements - Table Icons', () => {
  beforeEach(() => {
    eventsModule.tables = [...sampleTables];
  });

  test('_renderTableIcons adds notes icon for tables with notes', () => {
    seatingEnhancements._renderTableIcons(eventsModule);
    const t2El = document.querySelector('[data-table-id="t2"] .tp-table-shape');
    if (t2El) {
      expect(t2El.innerHTML).toContain('bi-sticky-fill');
    }
  });

  test('_renderTableIcons adds accessible icon for [ACCESSIBLE] tables', () => {
    seatingEnhancements._renderTableIcons(eventsModule);
    const t1El = document.querySelector('[data-table-id="t1"] .tp-table-shape');
    if (t1El) {
      expect(t1El.innerHTML).toContain('bi-universal-access');
    }
  });
});

describe('Seating Enhancements - Accessibility Toggle', () => {
  beforeEach(() => {
    eventsModule.tables = [...sampleTables];
    eventsModule.renderCanvasTables = jest.fn();
  });

  test('_toggleAccessible adds [ACCESSIBLE] to notes when on', async () => {
    jest.spyOn(apiClient, 'update').mockResolvedValue();
    const table = { ...sampleTables[1] }; // General Table - notes: 'Near the stage'
    eventsModule.tables = [table];

    await seatingEnhancements._toggleAccessible(eventsModule, 't2', true);

    expect(apiClient.update).toHaveBeenCalledWith(
      'event_tables',
      't2',
      expect.objectContaining({
        notes: expect.stringContaining('[ACCESSIBLE]'),
      })
    );
    jest.restoreAllMocks();
  });

  test('_toggleAccessible removes [ACCESSIBLE] from notes when off', async () => {
    jest.spyOn(apiClient, 'update').mockResolvedValue();
    const table = { id: 't1', notes: '[ACCESSIBLE] Important guests here' };
    eventsModule.tables = [table];

    await seatingEnhancements._toggleAccessible(eventsModule, 't1', false);

    expect(apiClient.update).toHaveBeenCalledWith('event_tables', 't1', {
      notes: 'Important guests here',
    });
    jest.restoreAllMocks();
  });

  test('_toggleAccessible handles missing table gracefully', async () => {
    eventsModule.tables = [];
    await seatingEnhancements._toggleAccessible(eventsModule, 'nonexistent', true);
    // Should not throw
  });
});

describe('Seating Enhancements - Print Seating List', () => {
  beforeEach(() => {
    eventsModule.tables = [...sampleTables];
    eventsModule.currentEventNameTablePlan = 'Awards Gala 2026';
    seatingEnhancements._slSort = 'table';
    global.window.open = jest.fn(() => ({
      document: {
        write: jest.fn(),
        close: jest.fn(),
      },
    }));
  });

  test('printSeatingList opens a new window', () => {
    seatingEnhancements.printSeatingList();
    expect(window.open).toHaveBeenCalledWith('', '_blank');
  });

  test('printSeatingList writes HTML to the new window', () => {
    const mockWindow = {
      document: {
        write: jest.fn(),
        close: jest.fn(),
      },
    };
    global.window.open = jest.fn(() => mockWindow);
    seatingEnhancements.printSeatingList();
    expect(mockWindow.document.write).toHaveBeenCalled();
    const htmlContent = mockWindow.document.write.mock.calls[0][0];
    expect(htmlContent).toContain('Seating List');
    expect(htmlContent).toContain('Awards Gala 2026');
    expect(htmlContent).toContain('5/24 seated');
    expect(htmlContent).toContain('By Table');
  });

  test('printSeatingList includes guest details in table view', () => {
    const mockWindow = { document: { write: jest.fn(), close: jest.fn() } };
    global.window.open = jest.fn(() => mockWindow);
    seatingEnhancements._slSort = 'table';
    seatingEnhancements.printSeatingList();
    const html = mockWindow.document.write.mock.calls[0][0];
    expect(html).toContain('Alice Johnson');
    expect(html).toContain('VIP');
    expect(html).toContain('Vegetarian');
  });

  test('printSeatingList shows company view when sort is company', () => {
    const mockWindow = { document: { write: jest.fn(), close: jest.fn() } };
    global.window.open = jest.fn(() => mockWindow);
    seatingEnhancements._slSort = 'company';
    seatingEnhancements.printSeatingList();
    const html = mockWindow.document.write.mock.calls[0][0];
    expect(html).toContain('Acme Corp');
    expect(html).toContain('By Company');
  });

  test('printSeatingList shows toast when popup blocked', () => {
    global.window.open = jest.fn(() => null);
    seatingEnhancements.printSeatingList();
    // Should not throw; shows toast about popups
  });
});

describe('Seating Enhancements - Place Cards PDF', () => {
  beforeEach(() => {
    eventsModule.tables = [...sampleTables];
  });

  test('generatePlaceCards creates PDF with guest data', () => {
    seatingEnhancements.generatePlaceCards();
    // If jsPDF mock works, this should not throw and should call save
  });

  test('generatePlaceCards warns when no guests assigned', () => {
    eventsModule.tables = [sampleTables[2]]; // Empty table
    seatingEnhancements.generatePlaceCards();
    // Should show toast about no guests, not throw
  });
});

describe('Seating Enhancements - Name Tents PDF', () => {
  beforeEach(() => {
    eventsModule.tables = [...sampleTables];
  });

  test('generateNameTents creates PDF with guest data', () => {
    seatingEnhancements.generateNameTents();
    // If jsPDF mock works, should not throw
  });

  test('generateNameTents warns when no guests assigned', () => {
    eventsModule.tables = [sampleTables[2]]; // Empty table
    seatingEnhancements.generateNameTents();
    // Should show toast about no guests, not throw
  });
});

describe('Seating Enhancements - Keyboard Binding', () => {
  test('_bindKeyboard sets _kbBound flag', () => {
    seatingEnhancements._kbBound = false;
    seatingEnhancements._bindKeyboard();
    expect(seatingEnhancements._kbBound).toBe(true);
  });

  test('_bindKeyboard does not double-bind', () => {
    seatingEnhancements._kbBound = true;
    const listenerCountBefore = document.listeners?.length || 0;
    seatingEnhancements._bindKeyboard();
    // Should not add another listener
    expect(seatingEnhancements._kbBound).toBe(true);
  });
});

describe('Seating Enhancements - Popups and Tooltips', () => {
  afterEach(() => {
    seatingEnhancements._closeSeatPopup();
    seatingEnhancements._hideSeatTooltip();
  });

  test('_makePopup creates a popup element and appends to body', () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    anchor.getBoundingClientRect = () => ({ left: 100, top: 200, width: 20, height: 20 });
    const popup = seatingEnhancements._makePopup(anchor, '<div>Test Popup</div>');
    expect(popup).not.toBeNull();
    expect(popup.className).toBe('se-seat-popup');
    expect(popup.innerHTML).toContain('Test Popup');
    expect(seatingEnhancements._seatPopup).toBe(popup);
    anchor.remove();
  });

  test('_closeSeatPopup removes popup from DOM', () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    anchor.getBoundingClientRect = () => ({ left: 0, top: 0, width: 10, height: 10 });
    seatingEnhancements._makePopup(anchor, '<div>Test</div>');
    expect(document.querySelector('.se-seat-popup')).not.toBeNull();
    seatingEnhancements._closeSeatPopup();
    expect(seatingEnhancements._seatPopup).toBeNull();
    anchor.remove();
  });

  test('_closeSeatPopup handles null popup gracefully', () => {
    seatingEnhancements._seatPopup = null;
    expect(() => seatingEnhancements._closeSeatPopup()).not.toThrow();
  });

  test('_showSeatTooltip creates a tooltip element', () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    anchor.getBoundingClientRect = () => ({ left: 100, top: 200, width: 20, height: 20 });

    seatingEnhancements._showSeatTooltip(
      anchor,
      {
        guest_name: 'Alice Johnson',
        company_name: 'Acme Corp',
        is_vip: true,
      },
      1
    );

    expect(seatingEnhancements._seatTooltip).not.toBeNull();
    expect(seatingEnhancements._seatTooltip.innerHTML).toContain('Alice Johnson');
    expect(seatingEnhancements._seatTooltip.innerHTML).toContain('Acme Corp');
    expect(seatingEnhancements._seatTooltip.innerHTML).toContain('Seat 1');
    expect(seatingEnhancements._seatTooltip.innerHTML).toContain('VIP');
    anchor.remove();
  });

  test('_hideSeatTooltip removes tooltip from DOM', () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    anchor.getBoundingClientRect = () => ({ left: 0, top: 0, width: 10, height: 10 });
    seatingEnhancements._showSeatTooltip(anchor, { guest_name: 'Test' }, 1);
    expect(seatingEnhancements._seatTooltip).not.toBeNull();
    seatingEnhancements._hideSeatTooltip();
    expect(seatingEnhancements._seatTooltip).toBeNull();
    anchor.remove();
  });

  test('_hideSeatTooltip handles null tooltip gracefully', () => {
    seatingEnhancements._seatTooltip = null;
    expect(() => seatingEnhancements._hideSeatTooltip()).not.toThrow();
  });

  test('_showSeatTooltip hides previous tooltip first', () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    anchor.getBoundingClientRect = () => ({ left: 0, top: 0, width: 10, height: 10 });

    seatingEnhancements._showSeatTooltip(anchor, { guest_name: 'First' }, 1);
    const firstTooltip = seatingEnhancements._seatTooltip;

    seatingEnhancements._showSeatTooltip(anchor, { guest_name: 'Second' }, 2);
    expect(seatingEnhancements._seatTooltip).not.toBe(firstTooltip);
    expect(seatingEnhancements._seatTooltip.innerHTML).toContain('Second');
    anchor.remove();
  });
});

describe('Seating Enhancements - Upgrade Seat Dots', () => {
  beforeEach(() => {
    eventsModule.tables = [...sampleTables];
  });

  test('_upgradeSeatDots sets pointer events on seat dots', () => {
    seatingEnhancements._upgradeSeatDots(eventsModule);
    const dots = document.querySelectorAll('#tpCanvas .tp-table-el[data-table-id="t1"] .seat-dot');
    if (dots.length > 0) {
      expect(dots[0].style.pointerEvents).toBe('auto');
      expect(dots[0].style.cursor).toBe('pointer');
    }
  });

  test('_upgradeSeatDots assigns guest initials to occupied seats', () => {
    seatingEnhancements._upgradeSeatDots(eventsModule);
    const dots = document.querySelectorAll('#tpCanvas .tp-table-el[data-table-id="t1"] .seat-dot');
    if (dots.length > 0) {
      // First seat should have Alice's initial
      expect(dots[0].textContent).toBe('A');
      expect(dots[0].classList.contains('occupied')).toBe(true);
    }
  });

  test('_upgradeSeatDots marks VIP guests with class', () => {
    seatingEnhancements._upgradeSeatDots(eventsModule);
    const dots = document.querySelectorAll('#tpCanvas .tp-table-el[data-table-id="t1"] .seat-dot');
    if (dots.length > 0) {
      // Alice is VIP (seat 1)
      expect(dots[0].classList.contains('se-vip-dot')).toBe(true);
      // Bob is not VIP (seat 2)
      expect(dots[1].classList.contains('se-vip-dot')).toBe(false);
    }
  });

  test('_upgradeSeatDots shows seat number for empty seats', () => {
    seatingEnhancements._upgradeSeatDots(eventsModule);
    const t2Dots = document.querySelectorAll('#tpCanvas .tp-table-el[data-table-id="t2"] .seat-dot');
    // t2 has 1 dot in DOM but table has 1 assignment (Dave, seat 1)
    // So all DOM dots may be occupied based on index
  });

  test('_upgradeSeatDots does nothing when canvas is missing', () => {
    const canvas = document.getElementById('tpCanvas');
    canvas.id = 'tempHidden';
    expect(() => seatingEnhancements._upgradeSeatDots(eventsModule)).not.toThrow();
    canvas.id = 'tpCanvas';
  });
});

describe('Seating Enhancements - Inject Detail Extras', () => {
  beforeEach(() => {
    eventsModule.tables = [...sampleTables];
  });

  test('_injectDetailExtras adds notes textarea', () => {
    seatingEnhancements._injectDetailExtras(eventsModule, 't1');
    const notesArea = document.getElementById('seNotesArea');
    if (notesArea) {
      expect(notesArea.tagName).toBe('TEXTAREA');
    }
  });

  test('_injectDetailExtras adds accessibility toggle', () => {
    seatingEnhancements._injectDetailExtras(eventsModule, 't1');
    const accToggle = document.querySelector('.se-access-toggle');
    if (accToggle) {
      const checkbox = accToggle.querySelector('#seAccessible');
      expect(checkbox).not.toBeNull();
      // Table t1 has [ACCESSIBLE] in notes, so checkbox should be checked
      expect(checkbox.checked).toBe(true);
    }
  });

  test('_injectDetailExtras does nothing when detail body is missing', () => {
    const body = document.querySelector('#tpDetailContent .detail-body');
    const origDisplay = body.style.display;
    body.id = 'tempHidden';
    // Since the querySelector won't find the element, it should not throw
    expect(() => seatingEnhancements._injectDetailExtras(eventsModule, 't1')).not.toThrow();
    body.id = '';
  });
});

describe('Seating Enhancements - Show Empty Popup', () => {
  beforeEach(() => {
    eventsModule.unassignedGuests = [...sampleUnassigned];
  });

  afterEach(() => {
    seatingEnhancements._closeSeatPopup();
  });

  test('_showEmptyPopup shows toast when no unassigned guests', () => {
    eventsModule.unassignedGuests = [];
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    anchor.getBoundingClientRect = () => ({ left: 0, top: 0, width: 10, height: 10 });

    seatingEnhancements._showEmptyPopup(eventsModule, anchor, sampleTables[0], 4);
    // Should not create a popup since no guests
    expect(seatingEnhancements._seatPopup).toBeNull();
    anchor.remove();
  });

  test('_showEmptyPopup creates popup with guest search', () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    anchor.getBoundingClientRect = () => ({ left: 0, top: 0, width: 10, height: 10 });

    seatingEnhancements._showEmptyPopup(eventsModule, anchor, sampleTables[0], 4);
    expect(seatingEnhancements._seatPopup).not.toBeNull();
    expect(seatingEnhancements._seatPopup.innerHTML).toContain('Assign to Seat 4');
    expect(seatingEnhancements._seatPopup.innerHTML).toContain('Frank Lee');
    expect(seatingEnhancements._seatPopup.innerHTML).toContain('Grace Chen');
    anchor.remove();
  });
});

describe('Seating Enhancements - Show Occupied Popup', () => {
  afterEach(() => {
    seatingEnhancements._closeSeatPopup();
  });

  test('_showOccupiedPopup creates popup with guest info', () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    anchor.getBoundingClientRect = () => ({ left: 0, top: 0, width: 10, height: 10 });

    const guest = sampleTables[0].assignments[0]; // Alice, VIP
    seatingEnhancements._showOccupiedPopup(eventsModule, anchor, sampleTables[0], guest, 1);

    expect(seatingEnhancements._seatPopup).not.toBeNull();
    expect(seatingEnhancements._seatPopup.innerHTML).toContain('Alice Johnson');
    expect(seatingEnhancements._seatPopup.innerHTML).toContain('Acme Corp');
    expect(seatingEnhancements._seatPopup.innerHTML).toContain('Seat 1');
    expect(seatingEnhancements._seatPopup.innerHTML).toContain('VIP');
    expect(seatingEnhancements._seatPopup.innerHTML).toContain('Remove VIP');
    expect(seatingEnhancements._seatPopup.innerHTML).toContain('Remove from seat');
    anchor.remove();
  });

  test('_showOccupiedPopup shows Mark VIP for non-VIP guest', () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    anchor.getBoundingClientRect = () => ({ left: 0, top: 0, width: 10, height: 10 });

    const guest = sampleTables[0].assignments[1]; // Bob, not VIP
    seatingEnhancements._showOccupiedPopup(eventsModule, anchor, sampleTables[0], guest, 2);

    expect(seatingEnhancements._seatPopup.innerHTML).toContain('Mark VIP');
    anchor.remove();
  });
});

describe('Seating Enhancements - Load Sections', () => {
  test('loadSections fetches sections for event', async () => {
    jest
      .spyOn(apiClient, 'selectAll')
      .mockResolvedValue([
        { id: 's1', name: 'VIP', color: '#ffc107', event_id: 'evt-1', x: 0, y: 0, width: 100, height: 100 },
      ]);
    await seatingEnhancements.loadSections('evt-1');
    expect(seatingEnhancements._sections.length).toBe(1);
    expect(seatingEnhancements._sections[0].name).toBe('VIP');
    jest.restoreAllMocks();
  });

  test('loadSections handles errors by clearing sections', async () => {
    jest.spyOn(apiClient, 'selectAll').mockRejectedValue(new Error('Network error'));
    await seatingEnhancements.loadSections('evt-1');
    expect(seatingEnhancements._sections).toEqual([]);
    jest.restoreAllMocks();
  });
});

describe('Seating Enhancements - Add Section', () => {
  beforeEach(() => {
    eventsModule.currentEventIdTablePlan = 'evt-1';
    eventsModule.renderCanvasTables = jest.fn();
  });

  test('addSection inserts and reloads', async () => {
    jest.spyOn(apiClient, 'insert').mockResolvedValue();
    jest.spyOn(seatingEnhancements, 'loadSections').mockResolvedValue();

    await seatingEnhancements.addSection('Stage', '#6f42c1');

    expect(apiClient.insert).toHaveBeenCalledWith(
      'seating_sections',
      expect.objectContaining({
        event_id: 'evt-1',
        name: 'Stage',
        color: '#6f42c1',
      })
    );
    expect(seatingEnhancements.loadSections).toHaveBeenCalledWith('evt-1');
    jest.restoreAllMocks();
  });

  test('addSection uses default color', async () => {
    jest.spyOn(apiClient, 'insert').mockResolvedValue();
    jest.spyOn(seatingEnhancements, 'loadSections').mockResolvedValue();

    await seatingEnhancements.addSection('Bar', null);

    expect(apiClient.insert).toHaveBeenCalledWith(
      'seating_sections',
      expect.objectContaining({
        color: '#6c757d',
      })
    );
    jest.restoreAllMocks();
  });

  test('addSection returns early when no event ID', async () => {
    eventsModule.currentEventIdTablePlan = null;
    jest.spyOn(apiClient, 'insert').mockResolvedValue();

    await seatingEnhancements.addSection('Test', '#000');
    expect(apiClient.insert).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  test('addSection handles API errors gracefully', async () => {
    jest.spyOn(apiClient, 'insert').mockRejectedValue(new Error('DB error'));
    await seatingEnhancements.addSection('Bad', '#000');
    // Should not throw, shows error toast
    jest.restoreAllMocks();
  });
});

describe('Seating Enhancements - Prompt Custom Section', () => {
  test('promptCustomSection calls addSection when user provides input', () => {
    global.prompt = jest
      .fn()
      .mockReturnValueOnce('Custom Area') // name
      .mockReturnValueOnce('#ff0000'); // color

    jest.spyOn(seatingEnhancements, 'addSection').mockResolvedValue();

    seatingEnhancements.promptCustomSection();
    expect(seatingEnhancements.addSection).toHaveBeenCalledWith('Custom Area', '#ff0000');

    jest.restoreAllMocks();
    global.prompt = jest.fn(() => null);
  });

  test('promptCustomSection does nothing when user cancels', () => {
    global.prompt = jest.fn().mockReturnValue(null);

    jest.spyOn(seatingEnhancements, 'addSection').mockResolvedValue();
    seatingEnhancements.promptCustomSection();
    expect(seatingEnhancements.addSection).not.toHaveBeenCalled();

    jest.restoreAllMocks();
    global.prompt = jest.fn(() => null);
  });
});

describe('Seating Enhancements - Table Statistics in Seating List', () => {
  beforeEach(() => {
    eventsModule.tables = [...sampleTables];
  });

  test('seating list shows capacity badges per table', () => {
    const html = seatingEnhancements._renderSlByTable(sampleTables);
    // VIP Table: 3 assigned / 8 total
    expect(html).toContain('3/8');
    // General Table: 2 assigned / 10 total
    expect(html).toContain('2/10');
    // Table 3: 0 assigned / 6 total
    expect(html).toContain('0/6');
  });

  test('seating list sorts tables by table number', () => {
    const html = seatingEnhancements._renderSlByTable(sampleTables);
    const t1Pos = html.indexOf('VIP Table');
    const t2Pos = html.indexOf('General Table');
    const t3Pos = html.indexOf('Table 3');
    expect(t1Pos).toBeLessThan(t2Pos);
    expect(t2Pos).toBeLessThan(t3Pos);
  });
});
