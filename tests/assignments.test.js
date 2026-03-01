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
