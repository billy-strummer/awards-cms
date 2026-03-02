/**
 * Tests for the GDPR Module (gdpr.js)
 * Run with: npx jest tests/gdpr.test.js
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
  <div id="gdprPanel"></div>
  <tbody id="gdprRequestsTable"></tbody>
  <select id="gdprRequestType"><option value="export">Data Export</option><option value="delete">Right to Erasure</option><option value="anonymize">Anonymise</option></select>
  <select id="gdprEntityType"><option value="organisation">Organisation</option><option value="contact">Contact</option></select>
  <input id="gdprRequesterEmail" value="requester@example.com">
  <input id="gdprEntitySearch" value="">
  <div id="gdprSearchResults"></div>
  <input type="checkbox" id="retentionAuditLogs">
  <input type="checkbox" id="retentionEmailLogs">
  <input type="checkbox" id="retentionVotingData">
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

const mockChain = {
  from: jest.fn(() => mockChain),
  select: jest.fn(() => mockChain),
  insert: jest.fn(() => Promise.resolve({ data: {}, error: null })),
  update: jest.fn(() => mockChain),
  delete: jest.fn(() => mockChain),
  eq: jest.fn(() => mockChain),
  lt: jest.fn(() => mockChain),
  order: jest.fn(() => mockChain),
  range: jest.fn(() => mockChain),
  limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
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
  functions: { invoke: jest.fn(() => Promise.resolve({ data: {}, error: null })) },
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(() => Promise.resolve({ error: null })),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: '' } })),
    })),
  },
};
global.supabase = { createClient: () => mockChain };
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
global.STATE.client = mockChain;
global.STATE.currentUser = { email: 'admin@test.com' };

function syncWindowToGlobal() {
  for (const key of Object.keys(global.window)) {
    if (!(key in global) && typeof global.window[key] !== 'undefined') global[key] = global.window[key];
  }
}

require('../utils.js');
syncWindowToGlobal();
require('../gdpr.js');
syncWindowToGlobal();

describe('GDPR Module - Structure', () => {
  test('gdprModule is defined', () => {
    expect(gdprModule).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof gdprModule.init).toBe('function');
    expect(typeof gdprModule.renderGdprPanel).toBe('function');
    expect(typeof gdprModule.searchEntity).toBe('function');
    expect(typeof gdprModule.selectEntity).toBe('function');
    expect(typeof gdprModule.submitRequest).toBe('function');
    expect(typeof gdprModule.loadPendingRequests).toBe('function');
    expect(typeof gdprModule.processRequest).toBe('function');
    expect(typeof gdprModule.rejectRequest).toBe('function');
    expect(typeof gdprModule.runRetentionCleanup).toBe('function');
    expect(typeof gdprModule._escapeLike).toBe('function');
  });
});

describe('GDPR Module - _escapeLike', () => {
  test('escapes % wildcard', () => {
    expect(gdprModule._escapeLike('100%')).toBe('100\\%');
  });

  test('escapes _ wildcard', () => {
    expect(gdprModule._escapeLike('user_name')).toBe('user\\_name');
  });

  test('escapes backslash', () => {
    expect(gdprModule._escapeLike('path\\file')).toBe('path\\\\file');
  });

  test('leaves normal text unchanged', () => {
    expect(gdprModule._escapeLike('John Smith')).toBe('John Smith');
  });

  test('escapes multiple special characters', () => {
    expect(gdprModule._escapeLike('50% off_sale')).toBe('50\\% off\\_sale');
  });
});

describe('GDPR Module - selectEntity', () => {
  test('sets the selected entity ID', () => {
    gdprModule.selectEntity('entity-123');
    expect(gdprModule._selectedEntityId).toBe('entity-123');
  });
});

describe('GDPR Module - renderGdprPanel', () => {
  test('renders panel in gdprPanel container', () => {
    gdprModule.renderGdprPanel();
    const panel = document.getElementById('gdprPanel');
    expect(panel.innerHTML).toContain('GDPR Data Requests');
    expect(panel.innerHTML).toContain('Data Retention Policy');
    expect(panel.innerHTML).toContain('Pending Requests');
  });
});

describe('GDPR Module - searchEntity', () => {
  test('shows message when search term too short', async () => {
    document.getElementById('gdprEntitySearch').value = 'a';
    await gdprModule.searchEntity();
    expect(document.getElementById('gdprSearchResults').innerHTML).toContain('Enter at least 2 characters');
  });
});

describe('GDPR Module - submitRequest', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('warns when no entity selected', async () => {
    gdprModule._selectedEntityId = null;
    document.getElementById('gdprRequesterEmail').value = 'valid@example.com';
    const toastSpy = jest.spyOn(utils, 'showToast');
    await gdprModule.submitRequest();
    expect(toastSpy).toHaveBeenCalledWith('Please search for and select an entity first', 'warning');
    toastSpy.mockRestore();
  });

  test('warns when email is invalid', async () => {
    document.getElementById('gdprRequesterEmail').value = 'not-an-email';
    const toastSpy = jest.spyOn(utils, 'showToast');
    await gdprModule.submitRequest();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('valid requester email'), 'warning');
    toastSpy.mockRestore();
  });

  test('submits request successfully and resets form', async () => {
    gdprModule._selectedEntityId = 'entity-456';
    document.getElementById('gdprRequesterEmail').value = 'valid@example.com';
    document.getElementById('gdprRequestType').value = 'export';
    document.getElementById('gdprEntityType').value = 'organisation';
    document.getElementById('gdprEntitySearch').value = 'Test';

    apiClient.insert = jest.fn().mockResolvedValue({});
    jest.spyOn(gdprModule, 'loadPendingRequests').mockImplementation(() => {});
    const toastSpy = jest.spyOn(utils, 'showToast');

    await gdprModule.submitRequest();
    expect(apiClient.insert).toHaveBeenCalledWith(
      'gdpr_requests',
      expect.objectContaining({
        request_type: 'export',
        entity_type: 'organisation',
        entity_id: 'entity-456',
        requester_email: 'valid@example.com',
        status: 'pending',
      })
    );
    expect(toastSpy).toHaveBeenCalledWith('GDPR request submitted', 'success');
    expect(gdprModule._selectedEntityId).toBeNull();
    expect(document.getElementById('gdprEntitySearch').value).toBe('');
    toastSpy.mockRestore();
  });

  test('shows error on submit failure', async () => {
    gdprModule._selectedEntityId = 'entity-789';
    document.getElementById('gdprRequesterEmail').value = 'valid@example.com';
    apiClient.insert = jest.fn().mockRejectedValue(new Error('Insert failed'));
    const toastSpy = jest.spyOn(utils, 'showToast');

    await gdprModule.submitRequest();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to submit request'), 'error');
    toastSpy.mockRestore();
  });

  test('blocks non-admin when rbacModule is defined', async () => {
    global.rbacModule = { canAccess: jest.fn().mockReturnValue(false) };
    const toastSpy = jest.spyOn(utils, 'showToast');
    await gdprModule.submitRequest();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('admin permissions'), 'error');
    toastSpy.mockRestore();
    delete global.rbacModule;
  });
});

describe('GDPR Module - searchEntity', () => {
  test('searches organisations successfully', async () => {
    document.getElementById('gdprEntitySearch').value = 'Acme Corp';
    document.getElementById('gdprEntityType').value = 'organisation';
    apiClient.select = jest.fn().mockResolvedValue({
      data: [{ id: 'org1', company_name: 'Acme Corp', email: 'info@acme.com' }],
    });

    await gdprModule.searchEntity();
    const results = document.getElementById('gdprSearchResults');
    expect(results.innerHTML).toContain('Acme Corp');
    expect(gdprModule._selectedEntityId).toBeNull();
  });

  test('searches contacts successfully', async () => {
    document.getElementById('gdprEntitySearch').value = 'John';
    document.getElementById('gdprEntityType').value = 'contact';
    apiClient.select = jest.fn().mockResolvedValue({
      data: [{ id: 'c1', first_name: 'John', last_name: 'Doe', email: 'john@test.com' }],
    });

    await gdprModule.searchEntity();
    const results = document.getElementById('gdprSearchResults');
    expect(results.innerHTML).toContain('John Doe');
  });

  test('shows no results message', async () => {
    document.getElementById('gdprEntitySearch').value = 'NonExistent';
    document.getElementById('gdprEntityType').value = 'organisation';
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });

    await gdprModule.searchEntity();
    const results = document.getElementById('gdprSearchResults');
    expect(results.innerHTML).toContain('No results found');
  });

  test('shows error on search failure', async () => {
    document.getElementById('gdprEntitySearch').value = 'Test Search';
    document.getElementById('gdprEntityType').value = 'organisation';
    apiClient.select = jest.fn().mockRejectedValue(new Error('DB err'));

    await gdprModule.searchEntity();
    const results = document.getElementById('gdprSearchResults');
    expect(results.innerHTML).toContain('Search failed');
  });

  test('shows message for empty search term', async () => {
    document.getElementById('gdprEntitySearch').value = '';
    await gdprModule.searchEntity();
    expect(document.getElementById('gdprSearchResults').innerHTML).toContain('Enter at least 2 characters');
  });
});

describe('GDPR Module - loadPendingRequests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure required DOM elements exist
    if (!document.getElementById('gdprRequestsTable')) {
      const t = document.createElement('table');
      const tb = document.createElement('tbody');
      tb.id = 'gdprRequestsTable';
      t.appendChild(tb);
      document.body.appendChild(t);
    }
    if (!document.getElementById('gdprPaginationControls')) {
      const p = document.createElement('div');
      p.id = 'gdprPaginationControls';
      document.body.appendChild(p);
    }
  });

  test('loads and renders pending requests', async () => {
    const mockData = [
      {
        id: 'r1',
        created_at: '2026-01-15',
        request_type: 'export',
        entity_type: 'organisation',
        entity_id: 'org-123456',
        requester_email: 'user@test.com',
        status: 'pending',
      },
    ];
    jest.spyOn(gdprModule, '_fetchPage').mockResolvedValue(mockData);

    await gdprModule.loadPendingRequests();
    const tbody = document.getElementById('gdprRequestsTable');
    expect(tbody).not.toBeNull();
    expect(tbody.innerHTML).toContain('user@test.com');
    expect(tbody.innerHTML).toContain('pending');
    gdprModule._fetchPage.mockRestore();
  });

  test('shows empty state on no data', async () => {
    jest.spyOn(gdprModule, '_fetchPage').mockResolvedValue([]);

    await gdprModule.loadPendingRequests();
    const tbody = document.getElementById('gdprRequestsTable');
    expect(tbody.innerHTML).toContain('No GDPR requests');
    gdprModule._fetchPage.mockRestore();
  });

  test('shows error state on fetch failure', async () => {
    jest.spyOn(gdprModule, '_fetchPage').mockRejectedValue(new Error('DB error'));
    await gdprModule.loadPendingRequests();
    const tbody = document.getElementById('gdprRequestsTable');
    expect(tbody.innerHTML).toContain('Failed to load requests');
    gdprModule._fetchPage.mockRestore();
  });
});

describe('GDPR Module - _renderRequests', () => {
  test('returns early if tbody not found', () => {
    const originalTbody = document.getElementById('gdprRequestsTable');
    originalTbody.id = 'hidden';
    expect(() => gdprModule._renderRequests()).not.toThrow();
    originalTbody.id = 'gdprRequestsTable';
  });
});

describe('GDPR Module - _renderPaginationControls', () => {
  beforeEach(() => {
    let pag = document.getElementById('gdprPaginationControls');
    if (!pag) {
      pag = document.createElement('div');
      pag.id = 'gdprPaginationControls';
      document.body.appendChild(pag);
    }
  });

  test('renders count when single page', () => {
    gdprModule._pagination = { page: 1, totalPages: 1, count: 3, pageSize: 50 };
    gdprModule._renderPaginationControls();
    const container = document.getElementById('gdprPaginationControls');
    expect(container.innerHTML).toContain('3 request(s)');
  });

  test('renders full pagination for multiple pages', () => {
    gdprModule._pagination = { page: 2, totalPages: 5, count: 230, pageSize: 50 };
    gdprModule._renderPaginationControls();
    const container = document.getElementById('gdprPaginationControls');
    expect(container.innerHTML).toContain('Page 2 of 5');
    expect(container.innerHTML).toContain('230 request(s)');
    expect(container.innerHTML).toContain('First');
    expect(container.innerHTML).toContain('Next');
  });

  test('renders empty when count is 0 and single page', () => {
    gdprModule._pagination = { page: 1, totalPages: 1, count: 0, pageSize: 50 };
    gdprModule._renderPaginationControls();
    const container = document.getElementById('gdprPaginationControls');
    expect(container.innerHTML).toBe('');
  });
});

describe('GDPR Module - processRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('does nothing when user cancels', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(false);
    apiClient.update = jest.fn();
    await gdprModule.processRequest('r1', 'export', 'entity-1');
    expect(apiClient.update).not.toHaveBeenCalled();
  });

  test('processes export request', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.update = jest.fn().mockResolvedValue({});
    const exportSpy = jest.spyOn(gdprModule, '_exportEntityData').mockResolvedValue();
    const _loadSpy = jest.spyOn(gdprModule, 'loadPendingRequests').mockResolvedValue();
    const toastSpy = jest.spyOn(utils, 'showToast');

    await gdprModule.processRequest('r1', 'export', 'entity-1');
    expect(exportSpy).toHaveBeenCalledWith('entity-1');
    expect(apiClient.update).toHaveBeenCalledWith(
      'gdpr_requests',
      'r1',
      expect.objectContaining({ status: 'completed' })
    );
    expect(toastSpy).toHaveBeenCalledWith('GDPR request processed', 'success');
  });

  test('processes delete request', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.update = jest.fn().mockResolvedValue({});
    const delSpy = jest.spyOn(gdprModule, '_deleteEntityData').mockResolvedValue();
    jest.spyOn(gdprModule, 'loadPendingRequests').mockResolvedValue();

    await gdprModule.processRequest('r1', 'delete', 'entity-1');
    expect(delSpy).toHaveBeenCalledWith('entity-1');
  });

  test('processes anonymize request via RPC', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.update = jest.fn().mockResolvedValue({});
    STATE.client.rpc = jest.fn().mockResolvedValue({ data: null, error: null });
    jest.spyOn(gdprModule, 'loadPendingRequests').mockResolvedValue();

    await gdprModule.processRequest('r1', 'anonymize', 'entity-1');
    expect(STATE.client.rpc).toHaveBeenCalledWith('anonymize_organisation', { p_org_id: 'entity-1' });
  });

  test('shows error on process failure', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.update = jest.fn().mockRejectedValue(new Error('Update failed'));
    const toastSpy = jest.spyOn(utils, 'showToast');

    await gdprModule.processRequest('r1', 'export', 'entity-1');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to process'), 'error');
  });
});

describe('GDPR Module - _exportEntityData', () => {
  test('exports entity data as JSON', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [{ id: 'org1', company_name: 'Test Co' }] });
    apiClient.selectAll = jest.fn().mockResolvedValue([]);

    // Mock createElement for download link
    const clickSpy = jest.fn();
    const originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') el.click = clickSpy;
      return el;
    });

    await gdprModule._exportEntityData('org1');
    expect(apiClient.select).toHaveBeenCalledWith('organisations', expect.any(Object));
    expect(clickSpy).toHaveBeenCalled();
    document.createElement.mockRestore();
  });

  test('shows error on export failure', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    apiClient.select = jest.fn().mockRejectedValue(new Error('DB error'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await gdprModule._exportEntityData('org1');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Data export failed'), 'error');
    consoleSpy.mockRestore();
    toastSpy.mockRestore();
  });
});

describe('GDPR Module - _deleteEntityData', () => {
  test('deletes data from all related tables', async () => {
    apiClient.deleteByFilters = jest.fn().mockResolvedValue({});
    await gdprModule._deleteEntityData('org1');
    expect(apiClient.deleteByFilters).toHaveBeenCalledTimes(5);
    expect(apiClient.deleteByFilters).toHaveBeenCalledWith('organisation_contacts', { organisation_id: 'org1' });
    expect(apiClient.deleteByFilters).toHaveBeenCalledWith('organisations', { id: 'org1' });
  });

  test('throws on failure and aborts', async () => {
    apiClient.deleteByFilters = jest.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('FK violation'));

    await expect(gdprModule._deleteEntityData('org1')).rejects.toThrow('Failed to delete from award_assignments');
  });
});

describe('GDPR Module - rejectRequest', () => {
  test('does nothing when user cancels', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(false);
    apiClient.update = jest.fn();
    await gdprModule.rejectRequest('r1');
    expect(apiClient.update).not.toHaveBeenCalled();
  });

  test('rejects request successfully', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.update = jest.fn().mockResolvedValue({});
    const loadSpy = jest.spyOn(gdprModule, 'loadPendingRequests').mockResolvedValue();
    const toastSpy = jest.spyOn(utils, 'showToast');

    await gdprModule.rejectRequest('r1');
    expect(apiClient.update).toHaveBeenCalledWith(
      'gdpr_requests',
      'r1',
      expect.objectContaining({ status: 'rejected' })
    );
    expect(toastSpy).toHaveBeenCalledWith('Request rejected', 'info');
    toastSpy.mockRestore();
    loadSpy.mockRestore();
  });
});

describe('GDPR Module - runRetentionCleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does nothing when user cancels', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(false);
    apiClient.deleteByFilters = jest.fn();
    await gdprModule.runRetentionCleanup();
    expect(apiClient.deleteByFilters).not.toHaveBeenCalled();
  });

  test('deletes audit logs when checked', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    document.getElementById('retentionAuditLogs').checked = true;
    document.getElementById('retentionEmailLogs').checked = false;
    apiClient.deleteByFilters = jest.fn().mockResolvedValue({ data: [1, 2, 3] });
    const toastSpy = jest.spyOn(utils, 'showToast');

    await gdprModule.runRetentionCleanup();
    expect(apiClient.deleteByFilters).toHaveBeenCalledWith('cms_audit_logs', expect.any(Object));
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('3 records removed'), 'success');
    toastSpy.mockRestore();
  });

  test('deletes email logs when checked', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    document.getElementById('retentionAuditLogs').checked = false;
    document.getElementById('retentionEmailLogs').checked = true;
    apiClient.deleteByFilters = jest.fn().mockResolvedValue({ data: [1, 2] });
    const toastSpy = jest.spyOn(utils, 'showToast');

    await gdprModule.runRetentionCleanup();
    expect(apiClient.deleteByFilters).toHaveBeenCalledWith('notification_queue', expect.any(Object));
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('2 records removed'), 'success');
    toastSpy.mockRestore();
  });

  test('handles cleanup error', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    document.getElementById('retentionAuditLogs').checked = true;
    apiClient.deleteByFilters = jest.fn().mockRejectedValue(new Error('Delete failed'));
    const toastSpy = jest.spyOn(utils, 'showToast');

    await gdprModule.runRetentionCleanup();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Cleanup failed'), 'error');
    toastSpy.mockRestore();
  });

  test('shows 0 records when neither option checked', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    document.getElementById('retentionAuditLogs').checked = false;
    document.getElementById('retentionEmailLogs').checked = false;
    const toastSpy = jest.spyOn(utils, 'showToast');

    await gdprModule.runRetentionCleanup();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('0 records removed'), 'success');
    toastSpy.mockRestore();
  });
});

describe('GDPR Module - _fetchPage and _goToPage', () => {
  test('fetches a specific page', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [{ id: 'r1' }],
      count: 10,
      totalPages: 2,
    });

    const data = await gdprModule._fetchPage(2);
    expect(data).toEqual([{ id: 'r1' }]);
    expect(gdprModule._pagination.page).toBe(2);
  });

  test('_goToPage fetches and renders', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [],
      count: 0,
      totalPages: 1,
    });
    gdprModule._renderRequests = jest.fn();

    gdprModule._goToPage(1);
    // Wait for promise
    await new Promise((r) => setTimeout(r, 50));
    expect(gdprModule._renderRequests).toHaveBeenCalled();
  });
});

describe('GDPR Module - _buildServerFilters', () => {
  test('returns empty filter object', () => {
    const filters = gdprModule._buildServerFilters();
    expect(filters).toEqual({});
  });
});

describe('GDPR Module - init', () => {
  test('calls renderGdprPanel and loadPendingRequests', () => {
    const renderSpy = jest.spyOn(gdprModule, 'renderGdprPanel').mockImplementation(() => {});
    const loadSpy = jest.spyOn(gdprModule, 'loadPendingRequests').mockImplementation(() => {});

    gdprModule.init();

    expect(renderSpy).toHaveBeenCalled();
    expect(loadSpy).toHaveBeenCalled();

    renderSpy.mockRestore();
    loadSpy.mockRestore();
  });
});

describe('GDPR Module - renderGdprPanel click delegation', () => {
  test('click on searchEntity action triggers searchEntity', async () => {
    // First render the panel
    gdprModule.renderGdprPanel();
    const container = document.getElementById('gdprPanel');

    const searchSpy = jest.spyOn(gdprModule, 'searchEntity').mockImplementation(() => {});
    const submitSpy = jest.spyOn(gdprModule, 'submitRequest').mockImplementation(() => {});
    const cleanupSpy = jest.spyOn(gdprModule, 'runRetentionCleanup').mockImplementation(() => {});

    // Click search button
    const searchBtn = container.querySelector('[data-action="gdprModule.searchEntity"]');
    expect(searchBtn).not.toBeNull();
    searchBtn.click();
    expect(searchSpy).toHaveBeenCalled();

    // Click submit button
    const submitBtn = container.querySelector('[data-action="gdprModule.submitRequest"]');
    expect(submitBtn).not.toBeNull();
    submitBtn.click();
    expect(submitSpy).toHaveBeenCalled();

    // Click cleanup button
    const cleanupBtn = container.querySelector('[data-action="gdprModule.runRetentionCleanup"]');
    expect(cleanupBtn).not.toBeNull();
    cleanupBtn.click();
    expect(cleanupSpy).toHaveBeenCalled();

    searchSpy.mockRestore();
    submitSpy.mockRestore();
    cleanupSpy.mockRestore();
  });

  test('click on element without data-action does nothing', () => {
    gdprModule.renderGdprPanel();
    const container = document.getElementById('gdprPanel');

    // Click on something without data-action
    const label = container.querySelector('.form-label');
    expect(label).not.toBeNull();
    expect(() => label.click()).not.toThrow();
  });
});

describe('GDPR Module - searchEntity entity selection click handler', () => {
  test('clicking entity selection button calls selectEntity', async () => {
    document.getElementById('gdprEntitySearch').value = 'Acme Corp';
    document.getElementById('gdprEntityType').value = 'organisation';
    apiClient.select = jest.fn().mockResolvedValue({
      data: [{ id: 'org1', company_name: 'Acme Corp', email: 'info@acme.com' }],
    });

    await gdprModule.searchEntity();
    const results = document.getElementById('gdprSearchResults');
    const selectSpy = jest.spyOn(gdprModule, 'selectEntity');

    const entityBtn = results.querySelector('[data-action="gdprModule.selectEntity"]');
    expect(entityBtn).not.toBeNull();
    entityBtn.click();

    expect(selectSpy).toHaveBeenCalledWith('org1');
    selectSpy.mockRestore();
  });
});

describe('GDPR Module - selectEntity DOM manipulation', () => {
  test('highlights selected button and removes outline-secondary', () => {
    const resultsDiv = document.getElementById('gdprSearchResults');
    resultsDiv.innerHTML = `
      <button class="btn btn-sm btn-outline-secondary" data-action="gdprModule.selectEntity" data-id="e1">Entity 1</button>
      <button class="btn btn-sm btn-outline-secondary" data-action="gdprModule.selectEntity" data-id="e2">Entity 2</button>
    `;

    gdprModule.selectEntity('e1');
    const btn1 = resultsDiv.querySelector('[data-id="e1"]');
    expect(btn1.classList.contains('btn-primary')).toBe(true);
    expect(btn1.classList.contains('btn-outline-secondary')).toBe(false);
    expect(gdprModule._selectedEntityId).toBe('e1');
  });
});

describe('GDPR Module - _renderRequests action click handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Remove ALL existing gdprRequestsTable and gdprPaginationControls elements
    // so there is exactly one of each after renderGdprPanel
    document.querySelectorAll('#gdprRequestsTable').forEach((el) => el.remove());
    document.querySelectorAll('#gdprPaginationControls').forEach((el) => el.remove());
    // Clear gdprPanel and re-render to get fresh, unique IDs
    const panel = document.getElementById('gdprPanel');
    if (panel) panel.innerHTML = '';
    gdprModule.renderGdprPanel();
  });

  test('clicking process button calls processRequest', () => {
    gdprModule._requestsData = [
      {
        id: 'r1',
        created_at: '2026-01-15',
        request_type: 'export',
        entity_type: 'organisation',
        entity_id: 'org-123456',
        requester_email: 'user@test.com',
        status: 'pending',
      },
    ];
    gdprModule._pagination = { page: 1, totalPages: 1, count: 1, pageSize: 50 };

    const processSpy = jest.spyOn(gdprModule, 'processRequest').mockImplementation(() => {});
    gdprModule._renderRequests();

    const tbody = document.getElementById('gdprRequestsTable');
    const processBtn = tbody.querySelector('[data-action="gdprModule.processRequest"]');
    expect(processBtn).not.toBeNull();
    processBtn.click();

    expect(processSpy).toHaveBeenCalledWith('r1', 'export', 'org-123456');
    processSpy.mockRestore();
  });

  test('clicking reject button calls rejectRequest', () => {
    gdprModule._requestsData = [
      {
        id: 'r2',
        created_at: '2026-01-15',
        request_type: 'delete',
        entity_type: 'contact',
        entity_id: 'c-123456',
        requester_email: 'user@test.com',
        status: 'pending',
      },
    ];
    gdprModule._pagination = { page: 1, totalPages: 1, count: 1, pageSize: 50 };

    const rejectSpy = jest.spyOn(gdprModule, 'rejectRequest').mockImplementation(() => {});
    gdprModule._renderRequests();

    const tbody = document.getElementById('gdprRequestsTable');
    const rejectBtn = tbody.querySelector('[data-action="gdprModule.rejectRequest"]');
    expect(rejectBtn).not.toBeNull();
    rejectBtn.click();

    expect(rejectSpy).toHaveBeenCalledWith('r2');
    rejectSpy.mockRestore();
  });

  test('clicking element without data-action in tbody does nothing', () => {
    gdprModule._requestsData = [
      {
        id: 'r3',
        created_at: '2026-01-15',
        request_type: 'export',
        entity_type: 'organisation',
        entity_id: 'org-999999',
        requester_email: 'user@test.com',
        status: 'pending',
      },
    ];
    gdprModule._pagination = { page: 1, totalPages: 1, count: 1, pageSize: 50 };
    gdprModule._renderRequests();

    const tbody = document.getElementById('gdprRequestsTable');
    const td = tbody.querySelector('td');
    expect(td).not.toBeNull();
    expect(() => td.click()).not.toThrow();
  });
});

describe('GDPR Module - _renderPaginationControls click handler', () => {
  beforeEach(() => {
    let pag = document.getElementById('gdprPaginationControls');
    if (!pag) {
      pag = document.createElement('div');
      pag.id = 'gdprPaginationControls';
      document.body.appendChild(pag);
    }
  });

  test('clicking pagination button calls _goToPage', () => {
    gdprModule._pagination = { page: 1, totalPages: 3, count: 120, pageSize: 50 };
    gdprModule._renderPaginationControls();

    const goToPageSpy = jest.spyOn(gdprModule, '_goToPage').mockImplementation(() => {});
    const container = document.getElementById('gdprPaginationControls');
    const nextBtn = container.querySelector('[data-page="2"]');
    expect(nextBtn).not.toBeNull();
    nextBtn.click();

    expect(goToPageSpy).toHaveBeenCalledWith(2);
    goToPageSpy.mockRestore();
  });

  test('clicking disabled pagination button does not call _goToPage', () => {
    gdprModule._pagination = { page: 1, totalPages: 3, count: 120, pageSize: 50 };
    gdprModule._renderPaginationControls();

    const goToPageSpy = jest.spyOn(gdprModule, '_goToPage').mockImplementation(() => {});
    const container = document.getElementById('gdprPaginationControls');
    // "Prev" should be disabled on page 1
    const prevBtn = container.querySelector('[data-page="0"]');
    expect(prevBtn).not.toBeNull();
    // disabled buttons should not trigger _goToPage
    prevBtn.click();

    expect(goToPageSpy).not.toHaveBeenCalled();
    goToPageSpy.mockRestore();
  });
});
