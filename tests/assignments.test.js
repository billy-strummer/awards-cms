/**
 * Tests for the Assignments Module (assignments.js)
 * Run with: npx jest tests/assignments.test.js
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
  <div id="assignmentsModal"></div>
  <div id="assignmentsModalTitle"></div>
  <div id="assignmentsContent"></div>
  <div id="assignedCompaniesList"></div>
  <span id="assignedCount">0</span>
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
require('../assignments.js');
syncWindowToGlobal();

const sampleAssignments = [
  {
    id: 'a1',
    organisation_id: 'org1',
    award_id: 'aw1',
    organisations: { id: 'org1', company_name: 'Alpha Corp', email: 'a@a.com' },
    status: 'nominated',
    vote_count: 5,
  },
  {
    id: 'a2',
    organisation_id: 'org2',
    award_id: 'aw1',
    organisations: { id: 'org2', company_name: 'Beta Ltd', email: 'b@b.com' },
    status: 'self_nomination',
    vote_count: 10,
  },
  {
    id: 'a3',
    organisation_id: 'org3',
    award_id: 'aw1',
    organisations: { id: 'org3', company_name: 'Gamma Inc', email: 'g@g.com' },
    status: 'previous_winner',
    vote_count: 3,
  },
];

describe('Assignments Module - Structure', () => {
  test('assignmentsModule is defined', () => {
    expect(assignmentsModule).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof assignmentsModule.getAwardAssignments).toBe('function');
    expect(typeof assignmentsModule.openAssignmentsModal).toBe('function');
    expect(typeof assignmentsModule.refreshAssignments).toBe('function');
  });

  test('has default state', () => {
    expect(assignmentsModule.currentAwardId).toBeNull();
    expect(assignmentsModule.currentAwardName).toBeNull();
    expect(assignmentsModule.currentSortColumn).toBe('company');
    expect(assignmentsModule.currentSortDirection).toBe('asc');
  });
});

describe('Assignments Module - getAwardAssignments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns sorted assignments by company name', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValueOnce(sampleAssignments).mockResolvedValueOnce([]);

    const result = await assignmentsModule.getAwardAssignments('aw1');
    expect(result.length).toBe(3);
    expect(result[0].organisations.company_name).toBe('Alpha Corp');
    expect(result[1].organisations.company_name).toBe('Beta Ltd');
    expect(result[2].organisations.company_name).toBe('Gamma Inc');
  });

  test('returns empty array on error', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('Network error'));
    const result = await assignmentsModule.getAwardAssignments('aw1');
    expect(result).toEqual([]);
  });
});

describe('Assignments Module - sortAssignments', () => {
  test('sortAssignments changes sort column', () => {
    assignmentsModule.allAssignments = sampleAssignments;
    assignmentsModule.currentSortColumn = 'company';
    assignmentsModule.currentSortDirection = 'asc';

    // Calling sortAssignments should toggle direction or change column
    if (typeof assignmentsModule.sortAssignments === 'function') {
      assignmentsModule.sortAssignments('votes');
      expect(assignmentsModule.currentSortColumn).toBe('votes');
    }
  });
});

describe('Assignments Module - filterAssignments', () => {
  test('filterAssignments changes the current filter', () => {
    assignmentsModule.allAssignments = sampleAssignments;
    if (typeof assignmentsModule.filterAssignments === 'function') {
      assignmentsModule.filterAssignments('self_nomination');
      expect(assignmentsModule.currentFilter).toBe('self_nomination');
    }
  });
});

describe('Assignments Module - renderAssignedCompany', () => {
  test('renders a table row for an assignment', () => {
    if (typeof assignmentsModule.renderAssignedCompany === 'function') {
      const html = assignmentsModule.renderAssignedCompany(sampleAssignments[0]);
      expect(html).toContain('Alpha Corp');
    }
  });
});

// ==========================================================================
// NEW TESTS — coverage boost for assignments.js
// ==========================================================================

describe('Assignments Module - getStatusBadge()', () => {
  test('returns nominated badge', () => {
    const badge = assignmentsModule.getStatusBadge('nominated');
    expect(badge).toContain('Nominated');
    expect(badge).toContain('bg-secondary');
  });

  test('returns shortlisted badge', () => {
    const badge = assignmentsModule.getStatusBadge('shortlisted');
    expect(badge).toContain('Shortlisted');
    expect(badge).toContain('bg-warning');
  });

  test('returns winner badge', () => {
    const badge = assignmentsModule.getStatusBadge('winner');
    expect(badge).toContain('Winner');
    expect(badge).toContain('bg-success');
  });

  test('returns rejected badge', () => {
    const badge = assignmentsModule.getStatusBadge('rejected');
    expect(badge).toContain('Rejected');
    expect(badge).toContain('bg-danger');
  });

  test('defaults to nominated for unknown status', () => {
    const badge = assignmentsModule.getStatusBadge('unknown');
    expect(badge).toContain('Nominated');
  });
});

describe('Assignments Module - getWinnerPositionBadge()', () => {
  test('returns empty string when no winner_position', () => {
    const badge = assignmentsModule.getWinnerPositionBadge({ winner_position: null });
    expect(badge).toBe('');
  });

  test('returns gold badge for position 1', () => {
    const badge = assignmentsModule.getWinnerPositionBadge({ winner_position: 1 });
    expect(badge).toContain('#ffd700');
    expect(badge).toContain('#1 Recommended');
  });

  test('returns silver badge for position 2', () => {
    const badge = assignmentsModule.getWinnerPositionBadge({ winner_position: 2 });
    expect(badge).toContain('#c0c0c0');
    expect(badge).toContain('#2 Recommended');
  });

  test('returns bronze badge for position 3', () => {
    const badge = assignmentsModule.getWinnerPositionBadge({ winner_position: 3 });
    expect(badge).toContain('#cd7f32');
    expect(badge).toContain('#3 Recommended');
  });

  test('returns empty string for position 4 or higher', () => {
    const badge = assignmentsModule.getWinnerPositionBadge({ winner_position: 4 });
    expect(badge).toBe('');
  });
});

describe('Assignments Module - renderAvailableCompany()', () => {
  test('renders company card with name', () => {
    const html = assignmentsModule.renderAvailableCompany({
      id: 'org1',
      company_name: 'Test Corp',
      email: 'test@test.com',
      logo_url: null,
    });
    expect(html).toContain('Test Corp');
    expect(html).toContain('test@test.com');
    expect(html).toContain('assignmentsModule.assignCompany');
  });

  test('renders company card with logo', () => {
    const html = assignmentsModule.renderAvailableCompany({
      id: 'org1',
      company_name: 'Logo Corp',
      email: null,
      logo_url: 'https://cdn.example.com/logo.png',
    });
    expect(html).toContain('logo.png');
    expect(html).toContain('No email');
  });
});

describe('Assignments Module - renderAssignedCompany comprehensive', () => {
  test('renders company with logo_url', () => {
    const assignment = {
      id: 'a1',
      organisations: {
        id: 'org1',
        company_name: 'Logo Corp',
        email: 'l@l.com',
        contact_phone: '123',
        logo_url: 'https://cdn.example.com/logo.png',
      },
      status: 'nominated',
      public_vote_count: 10,
    };
    const html = assignmentsModule.renderAssignedCompany(assignment);
    expect(html).toContain('logo.png');
    expect(html).toContain('Logo Corp');
    expect(html).toContain('10');
  });

  test('renders initial avatar when no logo', () => {
    const assignment = {
      id: 'a2',
      organisations: { id: 'org2', company_name: 'NoLogo', email: null, logo_url: null },
      status: 'shortlisted',
      public_vote_count: 0,
    };
    const html = assignmentsModule.renderAssignedCompany(assignment);
    expect(html).toContain('N'); // first letter of NoLogo
    expect(html).toContain('No contact');
  });

  test('renders previous winner badge', () => {
    const assignment = {
      id: 'a3',
      organisations: { id: 'org3', company_name: 'WinCo', email: 'w@w.com', logo_url: null },
      status: 'nominated',
      is_previous_winner: true,
      public_vote_count: 5,
    };
    const html = assignmentsModule.renderAssignedCompany(assignment);
    expect(html).toContain('Previous Winner');
  });

  test('renders self-nomination badge', () => {
    const assignment = {
      id: 'a4',
      organisations: { id: 'org4', company_name: 'SelfNom', email: 's@s.com', logo_url: null },
      status: 'nominated',
      nomination_source: 'self_nomination',
      public_vote_count: 0,
    };
    const html = assignmentsModule.renderAssignedCompany(assignment);
    expect(html).toContain('Self Nominated');
  });

  test('renders other nominations badge', () => {
    const assignment = {
      id: 'a5',
      organisations: { id: 'org5', company_name: 'MultiCat', email: 'm@m.com', logo_url: null },
      status: 'nominated',
      other_nominations: [{ award_name: 'Best Builder', year: 2026 }],
      public_vote_count: 3,
    };
    const html = assignmentsModule.renderAssignedCompany(assignment);
    expect(html).toContain('+1');
  });
});

describe('Assignments Module - filterAssignments comprehensive', () => {
  beforeEach(() => {
    assignmentsModule.allAssignments = [
      {
        id: 'a1',
        organisations: { id: 'org1', company_name: 'Alpha', email: 'a@a.com', logo_url: null },
        status: 'nominated',
        nomination_source: 'admin',
        is_previous_winner: false,
        public_vote_count: 5,
      },
      {
        id: 'a2',
        organisations: { id: 'org2', company_name: 'Beta', email: 'b@b.com', logo_url: null },
        status: 'nominated',
        nomination_source: 'self_nomination',
        is_previous_winner: false,
        public_vote_count: 10,
      },
      {
        id: 'a3',
        organisations: { id: 'org3', company_name: 'Gamma', email: 'g@g.com', logo_url: null },
        status: 'winner',
        nomination_source: 'admin',
        is_previous_winner: true,
        public_vote_count: 3,
      },
    ];
  });

  test('filters by self_nomination', () => {
    assignmentsModule.filterAssignments('self_nomination');
    expect(assignmentsModule.currentFilter).toBe('self_nomination');
    const countEl = document.getElementById('assignedCount');
    expect(countEl.textContent).toBe('1');
  });

  test('filters by previous_winner', () => {
    assignmentsModule.filterAssignments('previous_winner');
    expect(assignmentsModule.currentFilter).toBe('previous_winner');
    const countEl = document.getElementById('assignedCount');
    expect(countEl.textContent).toBe('1');
  });

  test('filters by new (non-previous winners)', () => {
    assignmentsModule.filterAssignments('new');
    expect(assignmentsModule.currentFilter).toBe('new');
    const countEl = document.getElementById('assignedCount');
    expect(countEl.textContent).toBe('2');
  });

  test('shows all with "all" filter', () => {
    assignmentsModule.filterAssignments('all');
    const countEl = document.getElementById('assignedCount');
    expect(countEl.textContent).toBe('3');
  });
});

describe('Assignments Module - sortAssignments comprehensive', () => {
  beforeEach(() => {
    assignmentsModule.allAssignments = [
      {
        id: 'a1',
        organisations: { id: 'org1', company_name: 'Zebra', email: 'z@z.com', logo_url: null },
        status: 'nominated',
        public_vote_count: 5,
      },
      {
        id: 'a2',
        organisations: { id: 'org2', company_name: 'Alpha', email: 'a@a.com', logo_url: null },
        status: 'nominated',
        public_vote_count: 15,
      },
      {
        id: 'a3',
        organisations: { id: 'org3', company_name: 'Middle', email: 'm@m.com', logo_url: null },
        status: 'nominated',
        public_vote_count: 10,
      },
    ];
    assignmentsModule.currentFilter = 'all';
    assignmentsModule.currentSortColumn = 'company';
    assignmentsModule.currentSortDirection = 'asc';
  });

  test('sorts by company ascending', () => {
    assignmentsModule.sortAssignments('company');
    // Clicking same column toggles direction (was asc, now desc)
    expect(assignmentsModule.currentSortDirection).toBe('desc');
  });

  test('sorts by votes ascending', () => {
    assignmentsModule.sortAssignments('votes');
    expect(assignmentsModule.currentSortColumn).toBe('votes');
    expect(assignmentsModule.currentSortDirection).toBe('asc');
  });

  test('toggle direction on double click', () => {
    assignmentsModule.sortAssignments('votes');
    expect(assignmentsModule.currentSortDirection).toBe('asc');
    assignmentsModule.sortAssignments('votes');
    expect(assignmentsModule.currentSortDirection).toBe('desc');
  });
});

describe('Assignments Module - assignCompany()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assignmentsModule.currentAwardId = 'aw1';
    assignmentsModule.refreshAssignments = jest.fn().mockResolvedValue();
  });

  test('shows warning if already assigned', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [{ id: 'existing' }] });
    const toastSpy = jest.spyOn(utils, 'showToast');
    await assignmentsModule.assignCompany('org1', 'Test Corp');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('already assigned'), 'warning');
    toastSpy.mockRestore();
  });

  test('assigns company successfully', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    apiClient.insert = jest.fn().mockResolvedValue({});
    const toastSpy = jest.spyOn(utils, 'showToast');
    await assignmentsModule.assignCompany('org1', 'Test Corp');
    expect(apiClient.insert).toHaveBeenCalledWith(
      'award_assignments',
      expect.objectContaining({
        award_id: 'aw1',
        organisation_id: 'org1',
        status: 'nominated',
      })
    );
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('assigned successfully'), 'success');
    toastSpy.mockRestore();
  });

  test('handles assign error', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    apiClient.insert = jest.fn().mockRejectedValue(new Error('Insert failed'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await assignmentsModule.assignCompany('org1', 'Test Corp');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to assign'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Assignments Module - removeAssignment()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assignmentsModule.currentAssignments = sampleAssignments;
    assignmentsModule.refreshAssignments = jest.fn().mockResolvedValue();
  });

  test('aborts when user cancels', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(false);
    apiClient.delete = jest.fn();
    await assignmentsModule.removeAssignment('a1');
    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  test('deletes assignment on confirmation', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.delete = jest.fn().mockResolvedValue({});
    await assignmentsModule.removeAssignment('a1');
    expect(apiClient.delete).toHaveBeenCalledWith('award_assignments', 'a1');
  });
});

describe('Assignments Module - changeStatus()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assignmentsModule.refreshAssignments = jest.fn().mockResolvedValue();
    assignmentsModule.currentAwardId = 'aw1';
    assignmentsModule.currentAwardName = 'Best Plumber';
  });

  test('updates status to shortlisted', async () => {
    apiClient.update = jest.fn().mockResolvedValue({});
    await assignmentsModule.changeStatus('a1', 'shortlisted');
    expect(apiClient.update).toHaveBeenCalledWith(
      'award_assignments',
      'a1',
      expect.objectContaining({
        status: 'shortlisted',
        actual_winner: false,
      })
    );
  });

  test('updates status to winner with announcement_date', async () => {
    apiClient.update = jest.fn().mockResolvedValue({});
    await assignmentsModule.changeStatus('a1', 'winner');
    expect(apiClient.update).toHaveBeenCalledWith(
      'award_assignments',
      'a1',
      expect.objectContaining({
        status: 'winner',
        actual_winner: true,
        announcement_date: expect.any(String),
      })
    );
  });

  test('handles error', async () => {
    apiClient.update = jest.fn().mockRejectedValue(new Error('Update failed'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await assignmentsModule.changeStatus('a1', 'winner');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to change status'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Assignments Module - setWinnerPosition()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assignmentsModule.refreshAssignments = jest.fn().mockResolvedValue();
  });

  test('sets position 1 (gold)', async () => {
    apiClient.update = jest.fn().mockResolvedValue({});
    await assignmentsModule.setWinnerPosition('a1', 1);
    expect(apiClient.update).toHaveBeenCalledWith(
      'award_assignments',
      'a1',
      expect.objectContaining({
        winner_position: 1,
        status: 'winner',
        actual_winner: true,
      })
    );
  });

  test('handles error', async () => {
    apiClient.update = jest.fn().mockRejectedValue(new Error('Fail'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await assignmentsModule.setWinnerPosition('a1', 2);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to set winner position'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Assignments Module - emailAllAssigned()', () => {
  test('warns when no award selected', () => {
    assignmentsModule.currentAwardId = null;
    const toastSpy = jest.spyOn(utils, 'showToast');
    assignmentsModule.emailAllAssigned();
    expect(toastSpy).toHaveBeenCalledWith('No award selected', 'warning');
    toastSpy.mockRestore();
  });

  test('warns when no nominees', () => {
    assignmentsModule.currentAwardId = 'aw1';
    assignmentsModule._cachedAssignments = [];
    const toastSpy = jest.spyOn(utils, 'showToast');
    assignmentsModule.emailAllAssigned();
    expect(toastSpy).toHaveBeenCalledWith('No nominees to email', 'warning');
    toastSpy.mockRestore();
  });

  test('warns when no emails found', () => {
    assignmentsModule.currentAwardId = 'aw1';
    assignmentsModule._cachedAssignments = [
      { id: 'a1', organisations: { id: 'org1', company_name: 'NoEmail', email: null } },
    ];
    const toastSpy = jest.spyOn(utils, 'showToast');
    assignmentsModule.emailAllAssigned();
    expect(toastSpy).toHaveBeenCalledWith('No email addresses found for nominees', 'warning');
    toastSpy.mockRestore();
  });
});

describe('Assignments Module - bulkAssignCompanies()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('inserts multiple assignments', async () => {
    apiClient.insert = jest.fn().mockResolvedValue({});
    await assignmentsModule.bulkAssignCompanies('aw1', ['org1', 'org2', 'org3']);
    expect(apiClient.insert).toHaveBeenCalledWith(
      'award_assignments',
      expect.arrayContaining([expect.objectContaining({ award_id: 'aw1', organisation_id: 'org1' })])
    );
  });

  test('handles error', async () => {
    apiClient.insert = jest.fn().mockRejectedValue(new Error('Bulk fail'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await assignmentsModule.bulkAssignCompanies('aw1', ['org1']);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to bulk assign'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Assignments Module - filterAvailableCompanies()', () => {
  beforeEach(() => {
    if (!document.getElementById('assignmentSearchBox')) {
      const input = document.createElement('input');
      input.id = 'assignmentSearchBox';
      document.body.appendChild(input);
    }
    const container = document.getElementById('availableCompaniesList') || document.createElement('div');
    container.id = 'availableCompaniesList';
    container.innerHTML = `
      <div class="available-company-card" data-company-name="alpha corp">Alpha</div>
      <div class="available-company-card" data-company-name="beta ltd">Beta</div>
    `;
    document.body.appendChild(container);
  });

  test('filters cards by search query', () => {
    document.getElementById('assignmentSearchBox').value = 'alpha';
    assignmentsModule.filterAvailableCompanies();
    const cards = document.querySelectorAll('.available-company-card');
    expect(cards[0].style.display).toBe('block');
    expect(cards[1].style.display).toBe('none');
  });

  test('shows all when search is empty', () => {
    document.getElementById('assignmentSearchBox').value = '';
    assignmentsModule.filterAvailableCompanies();
    const cards = document.querySelectorAll('.available-company-card');
    expect(cards[0].style.display).toBe('block');
    expect(cards[1].style.display).toBe('block');
  });
});

describe('Assignments Module - updateSelectedCount()', () => {
  test('does not throw when element not found', () => {
    expect(() => assignmentsModule.updateSelectedCount()).not.toThrow();
  });
});

// ==========================================================================
// ADDITIONAL TESTS — 100 % statement coverage for assignments.js
// ==========================================================================

describe('getAwardAssignments - other_nominations mapping (lines 43-44)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('enriches assignments with other_nominations when orgIds present', async () => {
    const assignments = [
      { id: 'a1', organisation_id: 'org1', organisations: { id: 'org1', company_name: 'A' } },
      { id: 'a2', organisation_id: 'org2', organisations: { id: 'org2', company_name: 'B' } },
    ];
    const otherAssignments = [
      { organisation_id: 'org1', award_id: 'aw2', awards: { award_name: 'Other Award', year: 2026 } },
      { organisation_id: 'org1', award_id: 'aw3', awards: { award_name: 'Third Award', year: 2026 } },
    ];
    apiClient.selectAll = jest.fn().mockResolvedValueOnce(assignments).mockResolvedValueOnce(otherAssignments);

    const result = await assignmentsModule.getAwardAssignments('aw1');
    expect(result[0].other_nominations).toHaveLength(2);
    expect(result[0].other_nominations[0]).toEqual({ award_name: 'Other Award', year: 2026 });
    expect(result[1].other_nominations).toHaveLength(0);
  });
});

describe('openAssignmentsModal (lines 71-107)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    assignmentsModule.refreshAssignments = jest.fn().mockResolvedValue();
  });

  afterEach(() => jest.useRealTimers());

  test('sets currentAwardId/Name, shows modal, and calls refreshAssignments', async () => {
    await assignmentsModule.openAssignmentsModal('aw1', 'Best Plumber');
    expect(assignmentsModule.currentAwardId).toBe('aw1');
    expect(assignmentsModule.currentAwardName).toBe('Best Plumber');
    expect(document.getElementById('assignmentsModalTitle').innerHTML).toContain('Best Plumber');
    expect(assignmentsModule.refreshAssignments).toHaveBeenCalled();
  });

  test('adjusts z-index when multiple backdrops exist', async () => {
    // Create a second backdrop to simulate stacked modals
    const bd1 = document.createElement('div');
    bd1.className = 'modal-backdrop';
    document.body.appendChild(bd1);
    const bd2 = document.createElement('div');
    bd2.className = 'modal-backdrop';
    document.body.appendChild(bd2);

    await assignmentsModule.openAssignmentsModal('aw1', 'Test Award');
    jest.advanceTimersByTime(200);

    const modalEl = document.getElementById('assignmentsModal');
    expect(modalEl.style.zIndex).toBe('1061');

    bd1.remove();
    bd2.remove();
  });
});

const _realRefreshAssignments = assignmentsModule.refreshAssignments;
const _realGetAwardAssignments = assignmentsModule.getAwardAssignments;

describe('refreshAssignments (lines 113-265)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assignmentsModule.refreshAssignments = _realRefreshAssignments;
    assignmentsModule.currentAwardId = 'aw1';
    jest.useFakeTimers();
  });

  afterEach(() => jest.useRealTimers());

  test('renders assignments and available orgs', async () => {
    const assignments = [
      {
        id: 'a1',
        organisation_id: 'org1',
        organisations: { id: 'org1', company_name: 'Alpha Corp', email: 'a@a.com', logo_url: null },
        status: 'nominated',
        public_vote_count: 5,
      },
    ];
    const allOrgs = [
      { id: 'org1', company_name: 'Alpha Corp', email: 'a@a.com', logo_url: null },
      { id: 'org2', company_name: 'Beta Ltd', email: 'b@b.com', logo_url: null },
    ];
    assignmentsModule.getAwardAssignments = jest.fn().mockResolvedValue(assignments);
    apiClient.selectAll = jest.fn().mockResolvedValue(allOrgs);

    // Need to restore refreshAssignments to the real implementation
    const origRefresh =
      Object.getPrototypeOf(assignmentsModule).refreshAssignments ||
      assignmentsModule.constructor.prototype?.refreshAssignments;
    // Just call it directly since we mocked getAwardAssignments
    const contentEl = document.getElementById('assignmentsContent');
    await assignmentsModule.refreshAssignments();

    expect(contentEl.innerHTML).toContain('Alpha Corp');
    expect(contentEl.innerHTML).toContain('Beta Ltd');
    expect(assignmentsModule.allAssignments).toHaveLength(1);
    expect(assignmentsModule.availableOrgs).toHaveLength(1); // org2 only
  });

  test('filters out assignments with missing organisations and warns', async () => {
    const assignments = [
      {
        id: 'a1',
        organisation_id: 'org1',
        organisations: { id: 'org1', company_name: 'Valid', email: 'v@v.com' },
        status: 'nominated',
        public_vote_count: 0,
      },
      { id: 'a2', organisation_id: 'org2', organisations: null, status: 'nominated', public_vote_count: 0 },
    ];
    assignmentsModule.getAwardAssignments = jest.fn().mockResolvedValue(assignments);
    apiClient.selectAll = jest.fn().mockResolvedValue([]);

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await assignmentsModule.refreshAssignments();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Found assignment with missing organisation'),
      expect.anything()
    );
    expect(warnSpy).toHaveBeenCalledWith('Filtered out', 1, 'assignments with missing organisations');
    warnSpy.mockRestore();
  });

  test('renders empty state when no assignments', async () => {
    assignmentsModule.getAwardAssignments = jest.fn().mockResolvedValue([]);
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    await assignmentsModule.refreshAssignments();
    const contentEl = document.getElementById('assignmentsContent');
    expect(contentEl.innerHTML).toContain('No companies assigned yet');
  });

  test('renders all-assigned alert when no available orgs', async () => {
    const assignments = [
      {
        id: 'a1',
        organisation_id: 'org1',
        organisations: { id: 'org1', company_name: 'Only', email: 'o@o.com' },
        status: 'nominated',
        public_vote_count: 0,
      },
    ];
    const allOrgs = [{ id: 'org1', company_name: 'Only', email: 'o@o.com', logo_url: null }];
    assignmentsModule.getAwardAssignments = jest.fn().mockResolvedValue(assignments);
    apiClient.selectAll = jest.fn().mockResolvedValue(allOrgs);
    await assignmentsModule.refreshAssignments();
    const contentEl = document.getElementById('assignmentsContent');
    expect(contentEl.innerHTML).toContain('All companies have been assigned');
  });

  test('shows error alert when refreshAssignments throws', async () => {
    assignmentsModule.getAwardAssignments = jest.fn().mockRejectedValue(new Error('Fetch fail'));
    await assignmentsModule.refreshAssignments();
    const contentEl = document.getElementById('assignmentsContent');
    expect(contentEl.innerHTML).toContain('Failed to load assignments');
    expect(contentEl.innerHTML).toContain('Fetch fail');
  });
});

describe('filterAssignments - button active state toggle (line 449)', () => {
  beforeEach(() => {
    // Set up filter buttons in DOM
    const container = document.getElementById('assignmentsContent');
    container.innerHTML = `
      <button id="filter-all" class="btn active"></button>
      <button id="filter-self_nomination" class="btn"></button>
      <button id="filter-previous_winner" class="btn"></button>
      <button id="filter-new" class="btn"></button>
    `;
    assignmentsModule.allAssignments = [
      {
        id: 'a1',
        organisations: { id: 'org1', company_name: 'A', email: 'a@a.com', logo_url: null },
        status: 'nominated',
        nomination_source: 'admin',
        is_previous_winner: false,
        public_vote_count: 0,
      },
    ];
  });

  test('removes active from all filter buttons and adds to selected', () => {
    assignmentsModule.filterAssignments('new');
    const allBtn = document.getElementById('filter-all');
    const newBtn = document.getElementById('filter-new');
    expect(allBtn.classList.contains('active')).toBe(false);
    expect(newBtn.classList.contains('active')).toBe(true);
  });
});

describe('sortAssignments - filter + sort combos (lines 507-539)', () => {
  beforeEach(() => {
    assignmentsModule.allAssignments = [
      {
        id: 'a1',
        organisations: { id: 'org1', company_name: 'Alpha', email: 'a@a.com', logo_url: null },
        status: 'nominated',
        nomination_source: 'self_nomination',
        is_previous_winner: false,
        public_vote_count: 5,
        winner_position: 1,
      },
      {
        id: 'a2',
        organisations: { id: 'org2', company_name: 'Beta', email: 'b@b.com', logo_url: null },
        status: 'nominated',
        nomination_source: 'admin',
        is_previous_winner: true,
        public_vote_count: 10,
        winner_position: 2,
      },
      {
        id: 'a3',
        organisations: { id: 'org3', company_name: 'Gamma', email: 'g@g.com', logo_url: null },
        status: 'nominated',
        nomination_source: 'admin',
        is_previous_winner: false,
        public_vote_count: 3,
        winner_position: null,
      },
    ];
    assignmentsModule.currentSortColumn = 'company';
    assignmentsModule.currentSortDirection = 'asc';
  });

  test('sorts with self_nomination filter active', () => {
    assignmentsModule.currentFilter = 'self_nomination';
    assignmentsModule.sortAssignments('votes');
    expect(assignmentsModule.currentSortColumn).toBe('votes');
  });

  test('sorts with previous_winner filter active', () => {
    assignmentsModule.currentFilter = 'previous_winner';
    assignmentsModule.sortAssignments('votes');
    expect(assignmentsModule.currentSortColumn).toBe('votes');
  });

  test('sorts with new filter active', () => {
    assignmentsModule.currentFilter = 'new';
    assignmentsModule.sortAssignments('votes');
    expect(assignmentsModule.currentSortColumn).toBe('votes');
  });

  test('sorts by position column', () => {
    assignmentsModule.currentFilter = 'all';
    assignmentsModule.sortAssignments('position');
    expect(assignmentsModule.currentSortColumn).toBe('position');
    expect(assignmentsModule.currentSortDirection).toBe('asc');
  });

  test('sort by default/unknown column returns 0 compare', () => {
    assignmentsModule.currentFilter = 'all';
    assignmentsModule.sortAssignments('unknown_col');
    expect(assignmentsModule.currentSortColumn).toBe('unknown_col');
  });
});

describe('assignCompany - awardsModule.loadAwards call (line 586)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assignmentsModule.currentAwardId = 'aw1';
    assignmentsModule.refreshAssignments = jest.fn().mockResolvedValue();
  });

  test('calls awardsModule.loadAwards when available', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    apiClient.insert = jest.fn().mockResolvedValue({});
    global.awardsModule = { loadAwards: jest.fn().mockResolvedValue() };
    await assignmentsModule.assignCompany('org1', 'Test Corp');
    expect(global.awardsModule.loadAwards).toHaveBeenCalled();
    delete global.awardsModule;
  });
});

describe('removeAssignment - awardsModule.loadAwards and error handling (lines 626-630)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assignmentsModule.currentAssignments = sampleAssignments;
    assignmentsModule.refreshAssignments = jest.fn().mockResolvedValue();
  });

  test('calls awardsModule.loadAwards after successful removal', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.delete = jest.fn().mockResolvedValue({});
    global.awardsModule = { loadAwards: jest.fn().mockResolvedValue() };
    await assignmentsModule.removeAssignment('a1');
    expect(global.awardsModule.loadAwards).toHaveBeenCalled();
    delete global.awardsModule;
  });

  test('shows error toast when delete fails', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.delete = jest.fn().mockRejectedValue(new Error('Delete fail'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await assignmentsModule.removeAssignment('a1');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to remove assignment'), 'error');
    toastSpy.mockRestore();
  });
});

describe('changeStatus - awardsModule._logAwardAudit (line 675)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assignmentsModule.refreshAssignments = jest.fn().mockResolvedValue();
    assignmentsModule.currentAwardId = 'aw1';
    assignmentsModule.currentAwardName = 'Best Plumber';
    assignmentsModule._cachedAssignments = [{ id: 'a1', organisations: { company_name: 'TestCo' } }];
  });

  test('calls awardsModule._logAwardAudit on status change', async () => {
    apiClient.update = jest.fn().mockResolvedValue({});
    global.awardsModule = { _logAwardAudit: jest.fn() };
    await assignmentsModule.changeStatus('a1', 'shortlisted');
    expect(global.awardsModule._logAwardAudit).toHaveBeenCalledWith(
      'aw1',
      'status_change',
      'Best Plumber',
      expect.stringContaining('TestCo')
    );
    delete global.awardsModule;
  });

  test('calls awardsModule._logAwardAudit with winner_set for winner status', async () => {
    apiClient.update = jest.fn().mockResolvedValue({});
    global.awardsModule = { _logAwardAudit: jest.fn() };
    await assignmentsModule.changeStatus('a1', 'winner');
    expect(global.awardsModule._logAwardAudit).toHaveBeenCalledWith(
      'aw1',
      'winner_set',
      'Best Plumber',
      expect.stringContaining('TestCo')
    );
    delete global.awardsModule;
  });
});

describe('emailAllAssigned - full modal rendering (lines 782-877)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assignmentsModule.currentAwardId = 'aw1';
    assignmentsModule.currentAwardName = 'Best Plumber';
    assignmentsModule._cachedAssignments = [
      { id: 'a1', organisations: { id: 'org1', company_name: 'TestCo', email: 'test@test.com' }, status: 'nominated' },
      {
        id: 'a2',
        organisations: { id: 'org2', company_name: 'Other', email: 'other@other.com' },
        status: 'shortlisted',
      },
    ];
  });

  afterEach(() => {
    const modal = document.getElementById('dynamicAssignModal');
    if (modal) modal.remove();
  });

  test('renders email modal with unique emails and status filters', () => {
    assignmentsModule.emailAllAssigned();
    const modal = document.getElementById('dynamicAssignModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('test@test.com');
    expect(modal.innerHTML).toContain('other@other.com');
    expect(modal.innerHTML).toContain('Email Nominees');
    expect(modal.innerHTML).toContain('Shortlisted');
    expect(modal.innerHTML).toContain('Winners');
    expect(modal.innerHTML).toContain('Nominated');
  });

  test('removes existing modal before creating new one', () => {
    assignmentsModule.emailAllAssigned();
    assignmentsModule.emailAllAssigned();
    const modals = document.querySelectorAll('#dynamicAssignModal');
    expect(modals.length).toBe(1);
  });

  test('deduplicates emails', () => {
    assignmentsModule._cachedAssignments = [
      { id: 'a1', organisations: { id: 'org1', company_name: 'A', email: 'same@test.com' }, status: 'nominated' },
      { id: 'a2', organisations: { id: 'org2', company_name: 'B', email: 'same@test.com' }, status: 'nominated' },
    ];
    assignmentsModule.emailAllAssigned();
    const textarea = document.getElementById('nomineeEmailList');
    expect(textarea.value).toBe('same@test.com');
  });
});

describe('_copyEmails (lines 838-843)', () => {
  beforeEach(() => {
    // Create the nomineeEmailList element
    let el = document.getElementById('nomineeEmailList');
    if (!el) {
      el = document.createElement('textarea');
      el.id = 'nomineeEmailList';
      document.body.appendChild(el);
    }
    el.value = 'a@a.com; b@b.com';
    // Mock clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: jest.fn().mockResolvedValue() },
      writable: true,
      configurable: true,
    });
  });

  test('copies email list to clipboard', () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    assignmentsModule._copyEmails();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('a@a.com; b@b.com');
    expect(toastSpy).toHaveBeenCalledWith('Emails copied to clipboard!', 'success');
    toastSpy.mockRestore();
  });

  test('does nothing when textarea not found', () => {
    document.getElementById('nomineeEmailList').remove();
    expect(() => assignmentsModule._copyEmails()).not.toThrow();
  });
});

describe('_openEmailClient (lines 850-854)', () => {
  beforeEach(() => {
    let el = document.getElementById('nomineeEmailList');
    if (!el) {
      el = document.createElement('textarea');
      el.id = 'nomineeEmailList';
      document.body.appendChild(el);
    }
    el.value = 'a@a.com; b@b.com';
    global.window.open = jest.fn();
  });

  test('opens mailto link with BCC', () => {
    assignmentsModule._openEmailClient();
    expect(window.open).toHaveBeenCalledWith(expect.stringContaining('mailto:?bcc='));
  });

  test('does nothing when textarea not found', () => {
    document.getElementById('nomineeEmailList').remove();
    expect(() => assignmentsModule._openEmailClient()).not.toThrow();
  });
});

describe('_filterEmailList (lines 862-878)', () => {
  beforeEach(() => {
    let el = document.getElementById('nomineeEmailList');
    if (!el) {
      el = document.createElement('textarea');
      el.id = 'nomineeEmailList';
      document.body.appendChild(el);
    }
    assignmentsModule._cachedAssignments = [
      { id: 'a1', organisations: { email: 'nom@test.com' }, status: 'nominated' },
      { id: 'a2', organisations: { email: 'short@test.com' }, status: 'shortlisted' },
      { id: 'a3', organisations: { email: 'win@test.com' }, status: 'winner' },
    ];
    global.event = undefined;
  });

  afterEach(() => {
    delete global.event;
  });

  test('filters by status and updates textarea', () => {
    assignmentsModule._filterEmailList('winner');
    const textarea = document.getElementById('nomineeEmailList');
    expect(textarea.value).toBe('win@test.com');
  });

  test('shows all when status is "all"', () => {
    assignmentsModule._filterEmailList('all');
    const textarea = document.getElementById('nomineeEmailList');
    expect(textarea.value).toContain('nom@test.com');
    expect(textarea.value).toContain('short@test.com');
    expect(textarea.value).toContain('win@test.com');
  });

  test('handles button active state toggle', () => {
    // Create fake button group to test btn.closest logic
    const btnGroup = document.createElement('div');
    btnGroup.className = 'btn-group';
    const btn1 = document.createElement('button');
    btn1.className = 'btn active';
    btn1.setAttribute('data-action', 'test');
    const btn2 = document.createElement('button');
    btn2.className = 'btn';
    btn2.setAttribute('data-action', 'test');
    btnGroup.appendChild(btn1);
    btnGroup.appendChild(btn2);
    document.body.appendChild(btnGroup);

    // Simulate the event object
    global.event = { target: btn2 };
    assignmentsModule._filterEmailList('nominated');
    expect(btn1.classList.contains('active')).toBe(false);
    delete global.event;
    btnGroup.remove();
  });
});

describe('filterBulkAdd (lines 913-922)', () => {
  beforeEach(() => {
    let searchBox = document.getElementById('bulkAddSearchBox');
    if (!searchBox) {
      searchBox = document.createElement('input');
      searchBox.id = 'bulkAddSearchBox';
      document.body.appendChild(searchBox);
    }
    let list = document.getElementById('bulkAddCompanyList');
    if (!list) {
      list = document.createElement('div');
      list.id = 'bulkAddCompanyList';
      document.body.appendChild(list);
    }
    list.innerHTML = `
      <div class="bulk-add-item" data-name="alpha corp">Alpha</div>
      <div class="bulk-add-item" data-name="beta ltd">Beta</div>
    `;
  });

  test('filters items by search value', () => {
    document.getElementById('bulkAddSearchBox').value = 'alpha';
    assignmentsModule.filterBulkAdd();
    const items = document.querySelectorAll('.bulk-add-item');
    expect(items[0].style.display).toBe('');
    expect(items[1].style.display).toBe('none');
  });

  test('shows all items when search is empty', () => {
    document.getElementById('bulkAddSearchBox').value = '';
    assignmentsModule.filterBulkAdd();
    const items = document.querySelectorAll('.bulk-add-item');
    expect(items[0].style.display).toBe('');
    expect(items[1].style.display).toBe('');
  });

  test('returns early when list element not found', () => {
    document.getElementById('bulkAddCompanyList').remove();
    expect(() => assignmentsModule.filterBulkAdd()).not.toThrow();
  });
});

// ==========================================================================
// COVERAGE BOOST — tooltip setTimeout, sortAssignments early-return,
// updateSelectedCount with element, and branch fallbacks
// ==========================================================================

describe('refreshAssignments - tooltip setTimeout callback (lines 248-254)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assignmentsModule.refreshAssignments = _realRefreshAssignments;
    assignmentsModule.currentAwardId = 'aw1';
    jest.useFakeTimers();
  });

  afterEach(() => jest.useRealTimers());

  test('initialises tooltips inside setTimeout callback', async () => {
    const assignments = [
      {
        id: 'a1',
        organisation_id: 'org1',
        organisations: { id: 'org1', company_name: 'Alpha Corp', email: 'a@a.com', logo_url: null },
        status: 'nominated',
        public_vote_count: 5,
      },
    ];
    const allOrgs = [
      { id: 'org1', company_name: 'Alpha Corp', email: 'a@a.com', logo_url: null },
      { id: 'org2', company_name: 'Beta Ltd', email: 'b@b.com', logo_url: null },
    ];
    assignmentsModule.getAwardAssignments = jest.fn().mockResolvedValue(assignments);
    apiClient.selectAll = jest.fn().mockResolvedValue(allOrgs);

    await assignmentsModule.refreshAssignments();

    // Inject an element with data-bs-toggle="tooltip" so the setTimeout body can run
    const contentEl = document.getElementById('assignmentsContent');
    const tooltipEl = document.createElement('span');
    tooltipEl.setAttribute('data-bs-toggle', 'tooltip');
    contentEl.appendChild(tooltipEl);

    // Provide getInstance that returns an object with dispose()
    const disposeSpy = jest.fn();
    bootstrap.Tooltip.getInstance = jest.fn().mockReturnValue({ dispose: disposeSpy });

    jest.advanceTimersByTime(200);

    expect(bootstrap.Tooltip.getInstance).toHaveBeenCalledWith(tooltipEl);
    expect(disposeSpy).toHaveBeenCalled();
  });

  test('handles tooltip element with no existing instance', async () => {
    assignmentsModule.getAwardAssignments = jest.fn().mockResolvedValue([]);
    apiClient.selectAll = jest.fn().mockResolvedValue([]);

    await assignmentsModule.refreshAssignments();

    // Inject tooltip trigger with no existing instance
    const contentEl = document.getElementById('assignmentsContent');
    const tooltipEl = document.createElement('span');
    tooltipEl.setAttribute('data-bs-toggle', 'tooltip');
    contentEl.appendChild(tooltipEl);

    bootstrap.Tooltip.getInstance = jest.fn().mockReturnValue(null);

    jest.advanceTimersByTime(200);

    expect(bootstrap.Tooltip.getInstance).toHaveBeenCalled();
  });
});

describe('sortAssignments - early return when no listContainer (line 500)', () => {
  test('returns early when assignedCompaniesList is missing', () => {
    // Remove the element from DOM
    const existing = document.getElementById('assignedCompaniesList');
    if (existing) existing.remove();

    assignmentsModule.allAssignments = sampleAssignments;
    assignmentsModule.currentFilter = 'all';
    assignmentsModule.currentSortColumn = 'company';
    assignmentsModule.currentSortDirection = 'asc';

    expect(() => assignmentsModule.sortAssignments('votes')).not.toThrow();

    // Restore element
    const newEl = document.createElement('tbody');
    newEl.id = 'assignedCompaniesList';
    document.body.appendChild(newEl);
  });
});

describe('sortAssignments - toggle from desc to asc (line 491 else branch)', () => {
  beforeEach(() => {
    assignmentsModule.allAssignments = [
      {
        id: 'a1',
        organisations: { id: 'org1', company_name: 'Alpha', email: 'a@a.com', logo_url: null },
        status: 'nominated',
        public_vote_count: 5,
      },
    ];
    assignmentsModule.currentFilter = 'all';
  });

  test('toggles from desc back to asc on same column', () => {
    assignmentsModule.currentSortColumn = 'company';
    assignmentsModule.currentSortDirection = 'desc';
    assignmentsModule.sortAssignments('company');
    expect(assignmentsModule.currentSortDirection).toBe('asc');
  });
});

describe('updateSelectedCount - element present (line 966)', () => {
  test('updates count when element exists and checkboxes are checked', () => {
    // Create the count element
    let countEl = document.getElementById('assignSelectedCount');
    if (!countEl) {
      countEl = document.createElement('span');
      countEl.id = 'assignSelectedCount';
      document.body.appendChild(countEl);
    }
    countEl.textContent = '0';

    // Create checked checkboxes
    const cb1 = document.createElement('input');
    cb1.type = 'checkbox';
    cb1.className = 'bulk-add-check';
    cb1.checked = true;
    document.body.appendChild(cb1);

    const cb2 = document.createElement('input');
    cb2.type = 'checkbox';
    cb2.className = 'bulk-add-check';
    cb2.checked = true;
    document.body.appendChild(cb2);

    assignmentsModule.updateSelectedCount();
    expect(countEl.textContent).toBe('2');

    cb1.remove();
    cb2.remove();
    countEl.remove();
  });
});

describe('getAwardAssignments - null/falsy fallback branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assignmentsModule.getAwardAssignments = _realGetAwardAssignments;
  });

  test('handles null otherAssignments (line 42 || fallback)', async () => {
    const assignments = [{ id: 'a1', organisation_id: 'org1', organisations: { id: 'org1', company_name: 'A' } }];
    apiClient.selectAll = jest.fn().mockResolvedValueOnce(assignments).mockResolvedValueOnce(null); // otherAssignments is null

    const result = await assignmentsModule.getAwardAssignments('aw1');
    expect(result[0].other_nominations).toEqual([]);
  });

  test('handles null data from first selectAll (line 50 || fallback)', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValueOnce(null); // data is null — no orgIds, skip second call

    const result = await assignmentsModule.getAwardAssignments('aw1');
    expect(result).toEqual([]);
  });

  test('handles assignments with missing company_name (lines 51-52 || fallbacks)', async () => {
    const assignments = [
      { id: 'a1', organisation_id: 'org1', organisations: { id: 'org1', company_name: null } },
      { id: 'a2', organisation_id: 'org2', organisations: { id: 'org2' } },
    ];
    // Both org IDs are truthy, so a second selectAll call happens
    apiClient.selectAll = jest.fn().mockResolvedValueOnce(assignments).mockResolvedValueOnce([]);

    const result = await assignmentsModule.getAwardAssignments('aw1');
    // Should not throw; both sort to empty string
    expect(result).toHaveLength(2);
  });

  test('handles empty orgIds (no second selectAll call)', async () => {
    const assignments = [{ id: 'a1', organisation_id: null, organisations: { id: 'org1', company_name: 'A' } }];
    apiClient.selectAll = jest.fn().mockResolvedValueOnce(assignments);

    const result = await assignmentsModule.getAwardAssignments('aw1');
    // selectAll called only once since orgIds is empty after filter(Boolean)
    expect(apiClient.selectAll).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
  });
});

describe('refreshAssignments - null allOrgs fallback (line 146)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assignmentsModule.refreshAssignments = _realRefreshAssignments;
    assignmentsModule.currentAwardId = 'aw1';
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  test('handles null allOrgs response', async () => {
    assignmentsModule.getAwardAssignments = jest.fn().mockResolvedValue([]);
    apiClient.selectAll = jest.fn().mockResolvedValue(null);

    await assignmentsModule.refreshAssignments();
    expect(assignmentsModule.availableOrgs).toEqual([]);
  });
});

describe('removeAssignment - company_name fallbacks (lines 603-604)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assignmentsModule.refreshAssignments = jest.fn().mockResolvedValue();
  });

  test('uses company_name from assignment when organisations missing', async () => {
    assignmentsModule.currentAssignments = [{ id: 'a1', company_name: 'Fallback Name' }];
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.delete = jest.fn().mockResolvedValue({});

    await assignmentsModule.removeAssignment('a1');
    expect(utils.confirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Fallback Name'),
      })
    );
  });

  test('uses "this company" when no name available', async () => {
    assignmentsModule.currentAssignments = [{ id: 'a1' }];
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.delete = jest.fn().mockResolvedValue({});

    await assignmentsModule.removeAssignment('a1');
    expect(utils.confirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('this company'),
      })
    );
  });

  test('uses "this company" when assignment not found in currentAssignments', async () => {
    assignmentsModule.currentAssignments = [];
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.delete = jest.fn().mockResolvedValue({});

    await assignmentsModule.removeAssignment('nonexistent');
    expect(utils.confirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('this company'),
      })
    );
  });
});

describe('changeStatus - branch fallbacks (lines 673, 678)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assignmentsModule.refreshAssignments = jest.fn().mockResolvedValue();
    assignmentsModule.currentAwardId = 'aw1';
  });

  test('uses empty string when currentAwardName is null (line 678 fallback)', async () => {
    apiClient.update = jest.fn().mockResolvedValue({});
    assignmentsModule.currentAwardName = null;
    assignmentsModule._cachedAssignments = [{ id: 'a1', organisations: { company_name: 'TestCo' } }];
    global.awardsModule = { _logAwardAudit: jest.fn() };

    await assignmentsModule.changeStatus('a1', 'shortlisted');
    expect(global.awardsModule._logAwardAudit).toHaveBeenCalledWith('aw1', 'status_change', '', expect.any(String));
    delete global.awardsModule;
  });

  test('uses empty companyName when assignment not in cache (line 673 fallback)', async () => {
    apiClient.update = jest.fn().mockResolvedValue({});
    assignmentsModule.currentAwardName = 'Award';
    assignmentsModule._cachedAssignments = [];
    global.awardsModule = { _logAwardAudit: jest.fn() };

    await assignmentsModule.changeStatus('nonexistent', 'shortlisted');
    expect(global.awardsModule._logAwardAudit).toHaveBeenCalledWith('aw1', 'status_change', 'Award', ' → Shortlisted');
    delete global.awardsModule;
  });
});

describe('emailAllAssigned - fallback branches (lines 768, 783)', () => {
  afterEach(() => {
    const modal = document.getElementById('dynamicAssignModal');
    if (modal) modal.remove();
  });

  test('uses empty array when _cachedAssignments is null (line 768 fallback)', () => {
    assignmentsModule.currentAwardId = 'aw1';
    assignmentsModule._cachedAssignments = null;
    const toastSpy = jest.spyOn(utils, 'showToast');
    assignmentsModule.emailAllAssigned();
    expect(toastSpy).toHaveBeenCalledWith('No nominees to email', 'warning');
    toastSpy.mockRestore();
  });

  test('uses "Award" when currentAwardName is null (line 783 fallback)', () => {
    assignmentsModule.currentAwardId = 'aw1';
    assignmentsModule.currentAwardName = null;
    assignmentsModule._cachedAssignments = [
      { id: 'a1', organisations: { id: 'org1', company_name: 'Co', email: 'c@c.com' }, status: 'nominated' },
    ];
    assignmentsModule.emailAllAssigned();
    const modal = document.getElementById('dynamicAssignModal');
    expect(modal.innerHTML).toContain('Award');
  });
});

describe('_filterEmailList - fallback branches (line 873)', () => {
  beforeEach(() => {
    let el = document.getElementById('nomineeEmailList');
    if (!el) {
      el = document.createElement('textarea');
      el.id = 'nomineeEmailList';
      document.body.appendChild(el);
    }
  });

  test('uses empty array when _cachedAssignments is null (line 873 fallback)', () => {
    assignmentsModule._cachedAssignments = null;
    global.event = undefined;
    assignmentsModule._filterEmailList('all');
    const textarea = document.getElementById('nomineeEmailList');
    expect(textarea.value).toBe('');
  });
});

describe('filterBulkAdd - fallback when searchBox is missing (line 919)', () => {
  test('uses empty string when bulkAddSearchBox is missing', () => {
    const existing = document.getElementById('bulkAddSearchBox');
    if (existing) existing.remove();

    let list = document.getElementById('bulkAddCompanyList');
    if (!list) {
      list = document.createElement('div');
      list.id = 'bulkAddCompanyList';
      document.body.appendChild(list);
    }
    list.innerHTML = '<div class="bulk-add-item" data-name="alpha">Alpha</div>';

    expect(() => assignmentsModule.filterBulkAdd()).not.toThrow();

    // All items should be visible since empty string matches everything
    const items = list.querySelectorAll('.bulk-add-item');
    expect(items[0].style.display).toBe('');
  });
});

describe('filterAvailableCompanies - card without data-company-name (line 430 fallback)', () => {
  beforeEach(() => {
    let input = document.getElementById('assignmentSearchBox');
    if (!input) {
      input = document.createElement('input');
      input.id = 'assignmentSearchBox';
      document.body.appendChild(input);
    }
    let container = document.getElementById('availableCompaniesList');
    if (!container) {
      container = document.createElement('div');
      container.id = 'availableCompaniesList';
      document.body.appendChild(container);
    }
    container.innerHTML = '<div class="available-company-card">No Attr</div>';
  });

  test('handles card with missing data-company-name attribute', () => {
    document.getElementById('assignmentSearchBox').value = 'test';
    assignmentsModule.filterAvailableCompanies();
    const card = document.querySelector('.available-company-card');
    expect(card.style.display).toBe('none');
  });
});

describe('sortAssignments - sort comparisons with null values (lines 527-528, 536)', () => {
  beforeEach(() => {
    assignmentsModule.currentFilter = 'all';
    assignmentsModule.currentSortColumn = 'votes'; // different from target to avoid toggle
    assignmentsModule.currentSortDirection = 'asc';
  });

  test('sorts by company with null organisation names', () => {
    assignmentsModule.allAssignments = [
      {
        id: 'a1',
        organisations: { id: 'org1', company_name: '', email: 'a@a.com', logo_url: null },
        status: 'nominated',
        public_vote_count: 5,
      },
      {
        id: 'a2',
        organisations: { id: 'org2', company_name: 'Beta', email: 'b@b.com', logo_url: null },
        status: 'nominated',
        public_vote_count: 10,
      },
    ];
    assignmentsModule.sortAssignments('company');
    expect(assignmentsModule.currentSortColumn).toBe('company');
  });

  test('sorts by votes with null public_vote_count', () => {
    assignmentsModule.allAssignments = [
      {
        id: 'a1',
        organisations: { id: 'org1', company_name: 'A', email: 'a@a.com', logo_url: null },
        status: 'nominated',
        public_vote_count: null,
      },
      {
        id: 'a2',
        organisations: { id: 'org2', company_name: 'B', email: 'b@b.com', logo_url: null },
        status: 'nominated',
        public_vote_count: 10,
      },
    ];
    assignmentsModule.currentSortColumn = 'company';
    assignmentsModule.sortAssignments('votes');
    expect(assignmentsModule.currentSortColumn).toBe('votes');
  });

  test('sorts by position with null winner_position', () => {
    assignmentsModule.allAssignments = [
      {
        id: 'a1',
        organisations: { id: 'org1', company_name: 'A', email: 'a@a.com', logo_url: null },
        status: 'nominated',
        winner_position: null,
      },
      {
        id: 'a2',
        organisations: { id: 'org2', company_name: 'B', email: 'b@b.com', logo_url: null },
        status: 'nominated',
        winner_position: 2,
      },
    ];
    assignmentsModule.currentSortColumn = 'company';
    assignmentsModule.sortAssignments('position');
    expect(assignmentsModule.currentSortColumn).toBe('position');
  });
});

describe('renderAssignedCompany - contact_phone branch (line 313-316)', () => {
  test('renders phone link when contact_phone is present', () => {
    const assignment = {
      id: 'a1',
      organisations: { id: 'org1', company_name: 'PhoneCo', email: null, contact_phone: '555-1234', logo_url: null },
      status: 'nominated',
      public_vote_count: 0,
    };
    const html = assignmentsModule.renderAssignedCompany(assignment);
    expect(html).toContain('tel:');
    expect(html).toContain('555-1234');
  });
});

describe('assignCompany - null existingCheck fallback (line 567)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assignmentsModule.currentAwardId = 'aw1';
    assignmentsModule.refreshAssignments = jest.fn().mockResolvedValue();
  });

  test('handles null data from select (existingCheck?.[ 0] is null)', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: null });
    apiClient.insert = jest.fn().mockResolvedValue({});

    await assignmentsModule.assignCompany('org1', 'Test Corp');
    expect(apiClient.insert).toHaveBeenCalled();
  });
});

describe('addSelectedCompanies (lines 928-956)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assignmentsModule.currentAwardId = 'aw1';
    assignmentsModule.bulkAssignCompanies = jest.fn().mockResolvedValue();
    assignmentsModule.refreshAssignments = jest.fn().mockResolvedValue();
  });

  test('warns when no checkboxes selected', async () => {
    // Clear any existing checkboxes
    document.querySelectorAll('.bulk-add-check').forEach((el) => el.remove());
    const toastSpy = jest.spyOn(utils, 'showToast');
    await assignmentsModule.addSelectedCompanies();
    expect(toastSpy).toHaveBeenCalledWith('No companies selected', 'warning');
    toastSpy.mockRestore();
  });

  test('bulk assigns selected companies and closes modal', async () => {
    // Create checked checkboxes
    const cb1 = document.createElement('input');
    cb1.type = 'checkbox';
    cb1.className = 'bulk-add-check';
    cb1.checked = true;
    cb1.value = 'org1';
    document.body.appendChild(cb1);

    const cb2 = document.createElement('input');
    cb2.type = 'checkbox';
    cb2.className = 'bulk-add-check';
    cb2.checked = true;
    cb2.value = 'org2';
    document.body.appendChild(cb2);

    // Create mock modal element
    const addModal = document.createElement('div');
    addModal.id = 'addCompanyModal';
    document.body.appendChild(addModal);

    await assignmentsModule.addSelectedCompanies();

    expect(assignmentsModule.bulkAssignCompanies).toHaveBeenCalledWith('aw1', ['org1', 'org2']);
    expect(assignmentsModule.refreshAssignments).toHaveBeenCalled();

    cb1.remove();
    cb2.remove();
    addModal.remove();
  });

  test('handles error during addSelectedCompanies', async () => {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'bulk-add-check';
    cb.checked = true;
    cb.value = 'org1';
    document.body.appendChild(cb);

    assignmentsModule.bulkAssignCompanies = jest.fn().mockRejectedValue(new Error('Bulk fail'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await assignmentsModule.addSelectedCompanies();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Error adding companies'), 'error');
    toastSpy.mockRestore();
    cb.remove();
  });
});
