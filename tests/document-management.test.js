/**
 * Tests for the Document Management Module (document-management.js)
 * Run with: npx jest tests/document-management.test.js
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
  <div id="documentLibraryContainer"></div>
  <div id="docsPagination"></div>
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

const mockStorageBucket = {
  upload: jest.fn(() => Promise.resolve({ data: {}, error: null })),
  getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://cdn.example.com/doc.pdf' } })),
};

const mockChain = {
  from: jest.fn(() => mockChain),
  select: jest.fn(() => mockChain),
  insert: jest.fn(() => Promise.resolve({ data: {}, error: null })),
  update: jest.fn(() => mockChain),
  delete: jest.fn(() => mockChain),
  eq: jest.fn(() => mockChain),
  in: jest.fn(() => mockChain),
  gte: jest.fn(() => mockChain),
  lte: jest.fn(() => mockChain),
  order: jest.fn(() => mockChain),
  range: jest.fn(() => mockChain),
  limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
  single: jest.fn(() => Promise.resolve({ data: { category: 'other' }, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn((cb) => cb({ data: [], error: null })),
  storage: {
    from: jest.fn(() => mockStorageBucket),
  },
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
global.STATE.currentUser = { email: 'user@test.com' };

function syncWindowToGlobal() {
  for (const key of Object.keys(global.window)) {
    if (!(key in global) && typeof global.window[key] !== 'undefined') global[key] = global.window[key];
  }
}

require('../utils.js');
syncWindowToGlobal();
require('../document-management.js');
syncWindowToGlobal();

describe('Document Module - Structure', () => {
  test('documentModule is defined', () => {
    expect(documentModule).toBeDefined();
  });

  test('has required properties', () => {
    expect(documentModule.BUCKET).toBe('documents');
    expect(Array.isArray(documentModule.CATEGORIES)).toBe(true);
    expect(Array.isArray(documentModule.STATUSES)).toBe(true);
    expect(documentModule.CATEGORIES).toContain('press_pack');
    expect(documentModule.CATEGORIES).toContain('certificate');
    expect(documentModule.CATEGORIES).toContain('contract');
    expect(documentModule.STATUSES).toContain('draft');
    expect(documentModule.STATUSES).toContain('approved');
  });

  test('has required methods', () => {
    expect(typeof documentModule._client).toBe('function');
    expect(typeof documentModule._user).toBe('function');
    expect(typeof documentModule._ext).toBe('function');
    expect(typeof documentModule._storagePath).toBe('function');
    expect(typeof documentModule._uploadToStorage).toBe('function');
    expect(typeof documentModule.renderDocumentLibrary).toBe('function');
    expect(typeof documentModule.uploadDocument).toBe('function');
    expect(typeof documentModule.deleteDocument).toBe('function');
    expect(typeof documentModule.updateDocument).toBe('function');
    expect(typeof documentModule.uploadVersion).toBe('function');
    expect(typeof documentModule.getVersionHistory).toBe('function');
    expect(typeof documentModule.revertToVersion).toBe('function');
    expect(typeof documentModule.setExpiry).toBe('function');
    expect(typeof documentModule.getExpiringDocuments).toBe('function');
    expect(typeof documentModule.submitForApproval).toBe('function');
    expect(typeof documentModule.approveDocument).toBe('function');
    expect(typeof documentModule.rejectDocument).toBe('function');
    expect(typeof documentModule.bulkUpload).toBe('function');
  });
});

describe('Document Module - Helper Functions', () => {
  test('_client returns STATE.client', () => {
    expect(documentModule._client()).toBe(mockChain);
  });

  test('_user returns STATE.currentUser', () => {
    STATE.currentUser = { email: 'test@test.com' };
    expect(documentModule._user()).toEqual({ email: 'test@test.com' });
  });

  test('_user returns empty object when no currentUser', () => {
    STATE.currentUser = null;
    expect(documentModule._user()).toEqual({});
    STATE.currentUser = { email: 'user@test.com' };
  });

  test('_ext extracts file extension', () => {
    expect(documentModule._ext({ name: 'document.pdf' })).toBe('pdf');
    expect(documentModule._ext({ name: 'image.PNG' })).toBe('png');
    expect(documentModule._ext({ name: 'archive.tar.gz' })).toBe('gz');
  });

  test('_storagePath generates timestamped path', () => {
    const path = documentModule._storagePath('press_pack', 'my document.pdf');
    expect(path).toContain('press_pack/');
    expect(path).toContain('my_document.pdf');
    expect(path).toMatch(/press_pack\/\d+-my_document\.pdf/);
  });

  test('_storagePath replaces spaces with underscores', () => {
    const path = documentModule._storagePath('other', 'a b c.txt');
    expect(path).toContain('a_b_c.txt');
  });
});

describe('Document Module - Categories', () => {
  test('includes all expected categories', () => {
    const expected = [
      'press_pack',
      'certificate',
      'contract',
      'invoice',
      'logo',
      'photo',
      'legal',
      'compliance',
      'other',
    ];
    expected.forEach((cat) => {
      expect(documentModule.CATEGORIES).toContain(cat);
    });
  });

  test('has 9 categories', () => {
    expect(documentModule.CATEGORIES.length).toBe(9);
  });
});

describe('Document Module - Statuses', () => {
  test('includes all expected statuses', () => {
    const expected = ['draft', 'pending_approval', 'approved', 'rejected', 'expired'];
    expected.forEach((s) => {
      expect(documentModule.STATUSES).toContain(s);
    });
  });

  test('has 5 statuses', () => {
    expect(documentModule.STATUSES.length).toBe(5);
  });
});

describe('Document Module - _buildServerFilters', () => {
  test('returns empty filters when no filter elements', () => {
    const filters = documentModule._buildServerFilters();
    expect(filters).toEqual({});
  });
});

describe('Document Module - _uploadToStorage', () => {
  test('uploads file and returns path/url/size', async () => {
    const mockFile = { name: 'test.pdf', size: 12345, type: 'application/pdf' };
    mockStorageBucket.upload.mockResolvedValue({ data: {}, error: null });
    mockStorageBucket.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/test.pdf' } });

    const result = await documentModule._uploadToStorage(mockFile, 'contract');
    expect(result.url).toBe('https://cdn.example.com/test.pdf');
    expect(result.size).toBe(12345);
    expect(result.path).toContain('contract/');
  });

  test('throws when upload fails', async () => {
    const mockFile = { name: 'test.pdf', size: 100, type: 'application/pdf' };
    mockStorageBucket.upload.mockResolvedValue({ data: null, error: new Error('Upload failed') });

    await expect(documentModule._uploadToStorage(mockFile, 'other')).rejects.toThrow('Upload failed');
  });
});

describe('Document Module - uploadDocument', () => {
  test('uploads document and creates record', async () => {
    const mockFile = { name: 'contract.pdf', size: 5000, type: 'application/pdf' };
    mockStorageBucket.upload.mockResolvedValue({ data: {}, error: null });
    mockStorageBucket.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/contract.pdf' } });
    apiClient.insert = jest.fn().mockResolvedValue({ data: { id: 'doc-1' } });
    STATE.currentUser = { email: 'user@test.com' };

    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    const _result = await documentModule.uploadDocument(mockFile, { category: 'contract', title: 'My Contract' });
    expect(apiClient.insert).toHaveBeenCalledWith(
      'documents',
      expect.objectContaining({
        title: 'My Contract',
        category: 'contract',
        file_name: 'contract.pdf',
        status: 'draft',
        uploaded_by: 'user@test.com',
      })
    );
    expect(toastSpy).toHaveBeenCalledWith('Document uploaded', 'success');
    toastSpy.mockRestore();
  });

  test('defaults to "other" category', async () => {
    const mockFile = { name: 'file.txt', size: 100, type: 'text/plain' };
    mockStorageBucket.upload.mockResolvedValue({ data: {}, error: null });
    mockStorageBucket.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/file.txt' } });
    apiClient.insert = jest.fn().mockResolvedValue({ data: { id: 'doc-2' } });
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await documentModule.uploadDocument(mockFile, {});
    expect(apiClient.insert).toHaveBeenCalledWith(
      'documents',
      expect.objectContaining({
        category: 'other',
      })
    );
    utils.showToast.mockRestore();
  });
});

describe('Document Module - updateDocument', () => {
  test('updates document metadata', async () => {
    apiClient.update = jest.fn().mockResolvedValue({ data: { id: 'doc-1' } });
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    const _result = await documentModule.updateDocument('doc-1', { title: 'Updated Title' });
    expect(apiClient.update).toHaveBeenCalledWith(
      'documents',
      'doc-1',
      expect.objectContaining({
        title: 'Updated Title',
        updated_at: expect.any(String),
      })
    );
    expect(toastSpy).toHaveBeenCalledWith('Document updated', 'success');
    toastSpy.mockRestore();
  });
});

describe('Document Module - deleteDocument', () => {
  test('does not delete when user cancels', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(false);
    apiClient.delete = jest.fn();
    await documentModule.deleteDocument('doc-1');
    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  test('deletes document when user confirms', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.delete = jest.fn().mockResolvedValue({});
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await documentModule.deleteDocument('doc-1');
    expect(apiClient.delete).toHaveBeenCalledWith('documents', 'doc-1');
    expect(toastSpy).toHaveBeenCalledWith('Document deleted', 'success');
    toastSpy.mockRestore();
  });

  test('falls back to localStorage when db delete fails', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.delete = jest.fn().mockRejectedValue(new Error('DB error'));
    localStorage.setItem('bta_documents', JSON.stringify([{ id: 'doc-1' }, { id: 'doc-2' }]));
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await documentModule.deleteDocument('doc-1');
    const stored = JSON.parse(localStorage.getItem('bta_documents'));
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe('doc-2');
    consoleSpy.mockRestore();
    toastSpy.mockRestore();
    localStorage.removeItem('bta_documents');
  });
});

describe('Document Module - submitForApproval', () => {
  test('updates status to pending_approval', async () => {
    apiClient.update = jest.fn().mockResolvedValue({ data: { id: 'doc-1', status: 'pending_approval' } });
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    const _result = await documentModule.submitForApproval('doc-1');
    expect(apiClient.update).toHaveBeenCalledWith(
      'documents',
      'doc-1',
      expect.objectContaining({
        status: 'pending_approval',
      })
    );
    expect(toastSpy).toHaveBeenCalledWith('Submitted for approval', 'info');
    toastSpy.mockRestore();
  });
});

describe('Document Module - approveDocument', () => {
  test('updates status to approved', async () => {
    STATE.currentUser = { email: 'admin@test.com' };
    apiClient.update = jest.fn().mockResolvedValue({ data: { id: 'doc-1', status: 'approved' } });
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await documentModule.approveDocument('doc-1');
    expect(apiClient.update).toHaveBeenCalledWith(
      'documents',
      'doc-1',
      expect.objectContaining({
        status: 'approved',
        approved_by: 'admin@test.com',
      })
    );
    expect(toastSpy).toHaveBeenCalledWith('Document approved', 'success');
    toastSpy.mockRestore();
  });
});

describe('Document Module - rejectDocument', () => {
  test('updates status to rejected', async () => {
    apiClient.update = jest.fn().mockResolvedValue({ data: { id: 'doc-1', status: 'rejected' } });
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await documentModule.rejectDocument('doc-1');
    expect(apiClient.update).toHaveBeenCalledWith(
      'documents',
      'doc-1',
      expect.objectContaining({
        status: 'rejected',
      })
    );
    expect(toastSpy).toHaveBeenCalledWith('Document rejected', 'warning');
    toastSpy.mockRestore();
  });

  test('updates rejection reason if provided', async () => {
    apiClient.update = jest.fn().mockResolvedValue({ data: { id: 'doc-1' } });
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await documentModule.rejectDocument('doc-1', 'Not compliant');
    // Called twice: once for status, once for reason
    expect(apiClient.update).toHaveBeenCalledTimes(2);
    toastSpy.mockRestore();
  });
});

describe('Document Module - setExpiry', () => {
  test('delegates to updateDocument', async () => {
    apiClient.update = jest.fn().mockResolvedValue({ data: { id: 'doc-1' } });
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await documentModule.setExpiry('doc-1', '2026-12-31');
    expect(apiClient.update).toHaveBeenCalledWith(
      'documents',
      'doc-1',
      expect.objectContaining({
        expiry_date: '2026-12-31',
      })
    );
    toastSpy.mockRestore();
  });
});

describe('Document Module - getExpiringDocuments', () => {
  test('fetches documents expiring within default 30 days', async () => {
    mockChain.from.mockReturnValue(mockChain);
    mockChain.select.mockReturnValue(mockChain);
    mockChain.gte.mockReturnValue(mockChain);
    mockChain.lte.mockReturnValue(mockChain);
    mockChain.order.mockReturnValue(mockChain);
    mockChain.limit.mockResolvedValue({ data: [{ id: 'doc-1', expiry_date: '2026-03-15' }], error: null });

    const result = await documentModule.getExpiringDocuments();
    expect(result).toEqual([{ id: 'doc-1', expiry_date: '2026-03-15' }]);
  });

  test('accepts custom days parameter', async () => {
    mockChain.from.mockReturnValue(mockChain);
    mockChain.select.mockReturnValue(mockChain);
    mockChain.gte.mockReturnValue(mockChain);
    mockChain.lte.mockReturnValue(mockChain);
    mockChain.order.mockReturnValue(mockChain);
    mockChain.limit.mockResolvedValue({ data: [], error: null });

    const result = await documentModule.getExpiringDocuments(7);
    expect(result).toEqual([]);
  });

  test('throws when query fails', async () => {
    mockChain.from.mockReturnValue(mockChain);
    mockChain.select.mockReturnValue(mockChain);
    mockChain.gte.mockReturnValue(mockChain);
    mockChain.lte.mockReturnValue(mockChain);
    mockChain.order.mockReturnValue(mockChain);
    mockChain.limit.mockResolvedValue({ data: null, error: new Error('Query failed') });

    await expect(documentModule.getExpiringDocuments()).rejects.toThrow('Query failed');
  });
});

describe('Document Module - getVersionHistory', () => {
  test('returns version history array', async () => {
    mockChain.from.mockReturnValue(mockChain);
    mockChain.select.mockReturnValue(mockChain);
    mockChain.eq.mockReturnValue(mockChain);
    mockChain.order.mockReturnValue(mockChain);
    mockChain.limit.mockResolvedValue({
      data: [
        { id: 'v1', version_number: 2 },
        { id: 'v2', version_number: 1 },
      ],
      error: null,
    });

    const result = await documentModule.getVersionHistory('doc-1');
    expect(result.length).toBe(2);
    expect(result[0].version_number).toBe(2);
  });

  test('throws when query fails', async () => {
    mockChain.from.mockReturnValue(mockChain);
    mockChain.select.mockReturnValue(mockChain);
    mockChain.eq.mockReturnValue(mockChain);
    mockChain.order.mockReturnValue(mockChain);
    mockChain.limit.mockResolvedValue({ data: null, error: new Error('Query failed') });

    await expect(documentModule.getVersionHistory('doc-1')).rejects.toThrow('Query failed');
  });

  test('returns empty array when no versions', async () => {
    mockChain.from.mockReturnValue(mockChain);
    mockChain.select.mockReturnValue(mockChain);
    mockChain.eq.mockReturnValue(mockChain);
    mockChain.order.mockReturnValue(mockChain);
    mockChain.limit.mockResolvedValue({ data: null, error: null });

    const result = await documentModule.getVersionHistory('doc-1');
    expect(result).toEqual([]);
  });
});

describe('Document Module - revertToVersion', () => {
  test('reverts document to a previous version', async () => {
    mockChain.from.mockReturnValue(mockChain);
    mockChain.select.mockReturnValue(mockChain);
    mockChain.eq.mockReturnValue(mockChain);
    mockChain.single.mockResolvedValue({
      data: { id: 'v1', file_url: 'https://cdn.example.com/old.pdf', file_size: 1000, version_number: 1 },
      error: null,
    });
    apiClient.update = jest.fn().mockResolvedValue({ data: {} });
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    const result = await documentModule.revertToVersion('doc-1', 'v1');
    expect(result.version_number).toBe(1);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Reverted to version 1'), 'success');
    toastSpy.mockRestore();
  });

  test('throws when version not found', async () => {
    mockChain.from.mockReturnValue(mockChain);
    mockChain.select.mockReturnValue(mockChain);
    mockChain.eq.mockReturnValue(mockChain);
    mockChain.single.mockResolvedValue({ data: null, error: new Error('Not found') });
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await expect(documentModule.revertToVersion('doc-1', 'v-bad')).rejects.toThrow('Not found');
    expect(toastSpy).toHaveBeenCalledWith('Version not found', 'error');
    toastSpy.mockRestore();
  });
});

describe('Document Module - bulkUpload', () => {
  test('uploads multiple files and returns results', async () => {
    const files = [
      { name: 'a.pdf', size: 100, type: 'application/pdf' },
      { name: 'b.pdf', size: 200, type: 'application/pdf' },
    ];
    mockStorageBucket.upload.mockResolvedValue({ data: {}, error: null });
    mockStorageBucket.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/file.pdf' } });
    apiClient.insert = jest.fn().mockResolvedValue({ data: { id: 'doc-new' } });
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    const result = await documentModule.bulkUpload(files, 'contract');
    expect(result.success.length).toBe(2);
    expect(result.failed.length).toBe(0);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('2/2 uploaded'), 'success');
    toastSpy.mockRestore();
  });

  test('handles partial failures', async () => {
    const files = [
      { name: 'a.pdf', size: 100, type: 'application/pdf' },
      { name: 'b.pdf', size: 200, type: 'application/pdf' },
    ];
    let callCount = 0;
    mockStorageBucket.upload.mockImplementation(() => {
      callCount++;
      if (callCount === 2) return Promise.resolve({ data: null, error: new Error('Upload failed') });
      return Promise.resolve({ data: {}, error: null });
    });
    mockStorageBucket.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/file.pdf' } });
    apiClient.insert = jest.fn().mockResolvedValue({ data: { id: 'doc-new' } });
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    const result = await documentModule.bulkUpload(files, 'other');
    expect(result.success.length).toBe(1);
    expect(result.failed.length).toBe(1);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('1 failed'), 'warning');
    toastSpy.mockRestore();
    callCount = 0;
  });
});

describe('Document Module - _docRow', () => {
  test('renders a document row with correct status badge', () => {
    const doc = {
      id: 'doc-1',
      title: 'Contract',
      file_name: 'contract.pdf',
      file_url: 'https://cdn.example.com/contract.pdf',
      file_type: 'application/pdf',
      category: 'contract',
      linked_entity_type: 'organisation',
      linked_entity_id: 'org-1',
      uploaded_by: 'admin@test.com',
      created_at: '2025-06-01',
      status: 'approved',
      _source: 'documents',
    };
    const html = documentModule._docRow(doc);
    expect(html).toContain('doc-1');
    expect(html).toContain('Contract');
    expect(html).toContain('bg-success');
    expect(html).toContain('approved');
  });

  test('renders row for draft status', () => {
    const doc = {
      id: 'doc-2',
      title: 'Draft Doc',
      file_url: '#',
      status: 'draft',
      _source: 'documents',
      created_at: null,
    };
    const html = documentModule._docRow(doc);
    expect(html).toContain('bg-secondary');
    expect(html).toContain('draft');
  });

  test('hides action buttons for non-documents source', () => {
    const doc = { id: 'doc-3', title: 'Other', file_url: '#', status: 'approved', _source: 'other', created_at: null };
    const html = documentModule._docRow(doc);
    expect(html).not.toContain('btn-doc-approve');
    expect(html).not.toContain('btn-doc-delete');
  });
});

describe('Document Module - renderDocumentLibrary', () => {
  test('renders library structure into container', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [{ id: 'doc-1', title: 'Test', file_url: '#', status: 'draft', created_at: '2025-01-01' }],
      page: 1,
      totalPages: 1,
      count: 1,
      pageSize: 50,
    });
    await documentModule.renderDocumentLibrary();
    const el = document.getElementById('documentLibraryContainer');
    expect(el.innerHTML).toContain('docLibraryTable');
    expect(el.innerHTML).toContain('docSearch');
    expect(el.innerHTML).toContain('docCategoryFilter');
    expect(el.innerHTML).toContain('docStatusFilter');
  });

  test('returns early when container not found', async () => {
    const el = document.getElementById('documentLibraryContainer');
    el.id = 'hidden';
    apiClient.select = jest.fn();
    await documentModule.renderDocumentLibrary();
    expect(apiClient.select).not.toHaveBeenCalled();
    el.id = 'documentLibraryContainer';
  });

  test('shows error when fetch fails', async () => {
    apiClient.select = jest.fn().mockRejectedValue(new Error('Fetch error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await documentModule.renderDocumentLibrary();
    const el = document.getElementById('documentLibraryContainer');
    expect(el.innerHTML).toContain('Error loading documents');
    consoleSpy.mockRestore();
  });
});

describe('Document Module - _renderDocTable', () => {
  test('renders empty message when no docs', () => {
    // Set up the library table manually
    const container = document.getElementById('documentLibraryContainer');
    container.innerHTML = `
      <table id="docLibraryTable"><tbody></tbody></table>
      <div id="docsPagination"></div>
    `;
    documentModule._allDocuments = [];
    documentModule._renderDocTable();
    const tbody = document.querySelector('#docLibraryTable tbody');
    expect(tbody.innerHTML).toContain('No documents found');
  });

  test('renders document rows', () => {
    const container = document.getElementById('documentLibraryContainer');
    container.innerHTML = `
      <table id="docLibraryTable"><tbody></tbody></table>
      <div id="docsPagination"></div>
    `;
    documentModule._allDocuments = [
      { id: 'doc-1', title: 'Doc 1', file_url: '#', status: 'draft', _source: 'documents', created_at: '2025-01-01' },
    ];
    documentModule._renderDocTable();
    const tbody = document.querySelector('#docLibraryTable tbody');
    expect(tbody.innerHTML).toContain('Doc 1');
  });
});

describe('Document Module - _goToPage', () => {
  test('does not fetch when page is current page', async () => {
    documentModule._pagination = { page: 1, totalPages: 3, count: 100, pageSize: 50 };
    apiClient.select = jest.fn();
    await documentModule._goToPage(1);
    expect(apiClient.select).not.toHaveBeenCalled();
  });

  test('clamps page to valid range', async () => {
    documentModule._pagination = { page: 1, totalPages: 3, count: 100, pageSize: 50 };
    apiClient.select = jest.fn().mockResolvedValue({
      data: [],
      page: 3,
      totalPages: 3,
      count: 100,
      pageSize: 50,
    });
    // Set up minimal DOM
    const container = document.getElementById('documentLibraryContainer');
    container.innerHTML = `<table id="docLibraryTable"><tbody></tbody></table><div id="docsPagination"></div>`;
    await documentModule._goToPage(99);
    // Should clamp to totalPages (3)
    expect(apiClient.select).toHaveBeenCalled();
  });
});

describe('Document Module - pagination state', () => {
  test('has correct default pagination state', () => {
    expect(documentModule._serverPagination).toBe(true);
    expect(documentModule._pagination).toHaveProperty('page');
    expect(documentModule._pagination).toHaveProperty('totalPages');
    expect(documentModule._pagination).toHaveProperty('count');
    expect(documentModule._pagination).toHaveProperty('pageSize');
  });
});

describe('Document Module - _goToPage error handling', () => {
  test('logs error and shows toast when _fetchPage fails', async () => {
    documentModule._pagination = { page: 1, totalPages: 3, count: 100, pageSize: 50 };
    apiClient.select = jest.fn().mockRejectedValue(new Error('Network error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    const container = document.getElementById('documentLibraryContainer');
    container.innerHTML = `<table id="docLibraryTable"><tbody></tbody></table><div id="docsPagination"></div>`;

    await documentModule._goToPage(2);
    expect(consoleSpy).toHaveBeenCalledWith('Error navigating document page:', expect.any(Error));
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Error loading page'), 'error');
    consoleSpy.mockRestore();
    toastSpy.mockRestore();
  });
});

describe('Document Module - _attachLibraryListeners refetch callback', () => {
  test('triggers refetch on search input event', async () => {
    // Set up the full library DOM with filter elements
    const container = document.getElementById('documentLibraryContainer');
    container.innerHTML = `
      <input type="text" id="docSearch" class="form-control">
      <select id="docCategoryFilter"><option value="">All</option></select>
      <select id="docStatusFilter"><option value="">All</option></select>
      <table id="docLibraryTable"><tbody></tbody></table>
      <div id="docsPagination"></div>
    `;

    apiClient.select = jest.fn().mockResolvedValue({
      data: [],
      page: 1,
      totalPages: 1,
      count: 0,
      pageSize: 50,
    });

    documentModule._pagination = { page: 2, totalPages: 3, count: 100, pageSize: 50 };
    documentModule._attachLibraryListeners();

    // Trigger input event on search to invoke the debounced refetch
    const searchEl = document.getElementById('docSearch');
    searchEl.value = 'test';
    searchEl.dispatchEvent(new dom.window.Event('input'));

    // Wait for debounce (300ms) + async fetch
    await new Promise((r) => setTimeout(r, 400));

    // Verify refetch was called (page reset to 1)
    expect(documentModule._pagination.page).toBe(1);
  });
});

describe('Document Module - uploadVersion', () => {
  test('uploads a new version and increments version number', async () => {
    // Mock the client chain for doc category query
    mockChain.from.mockReturnValue(mockChain);
    mockChain.select.mockReturnValue(mockChain);
    mockChain.eq.mockReturnValue(mockChain);
    mockChain.single.mockResolvedValue({ data: { category: 'contract' }, error: null });
    mockChain.order.mockReturnValue(mockChain);
    mockChain.limit.mockResolvedValue({ data: [{ version_number: 2 }], error: null });

    // Mock storage upload
    mockStorageBucket.upload.mockResolvedValue({ data: {}, error: null });
    mockStorageBucket.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/v3.pdf' } });

    // Mock apiClient.insert for version record
    apiClient.insert = jest.fn().mockResolvedValue({ data: { id: 'ver-3', version_number: 3 } });
    // Mock apiClient.update for document update
    apiClient.update = jest.fn().mockResolvedValue({ data: { id: 'doc-1' } });

    STATE.currentUser = { email: 'user@test.com' };
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    const file = { name: 'updated.pdf', size: 9999, type: 'application/pdf' };
    const result = await documentModule.uploadVersion('doc-1', file, 'Bug fixes');

    expect(apiClient.insert).toHaveBeenCalledWith(
      'document_versions',
      expect.objectContaining({
        document_id: 'doc-1',
        version_number: 3,
        uploaded_by: 'user@test.com',
        notes: 'Bug fixes',
      })
    );
    expect(toastSpy).toHaveBeenCalledWith('Version 3 uploaded', 'success');
    toastSpy.mockRestore();
  });

  test('defaults to version 1 when no previous versions exist', async () => {
    mockChain.from.mockReturnValue(mockChain);
    mockChain.select.mockReturnValue(mockChain);
    mockChain.eq.mockReturnValue(mockChain);
    mockChain.single.mockResolvedValue({ data: { category: 'other' }, error: null });
    mockChain.order.mockReturnValue(mockChain);
    mockChain.limit.mockResolvedValue({ data: [], error: null });

    mockStorageBucket.upload.mockResolvedValue({ data: {}, error: null });
    mockStorageBucket.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/v1.pdf' } });

    apiClient.insert = jest.fn().mockResolvedValue({ data: { id: 'ver-1', version_number: 1 } });
    apiClient.update = jest.fn().mockResolvedValue({ data: { id: 'doc-1' } });

    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    const file = { name: 'first.pdf', size: 100, type: 'application/pdf' };
    await documentModule.uploadVersion('doc-1', file);

    expect(apiClient.insert).toHaveBeenCalledWith(
      'document_versions',
      expect.objectContaining({
        version_number: 1,
        notes: '',
      })
    );
    expect(toastSpy).toHaveBeenCalledWith('Version 1 uploaded', 'success');
    toastSpy.mockRestore();
  });
});

describe('Document Module - approveDocument with DOM row', () => {
  test('updates badge in the DOM when row exists', async () => {
    // Set up table with a row for the document
    const container = document.getElementById('documentLibraryContainer');
    container.innerHTML = `
      <table id="docLibraryTable">
        <tbody>
          <tr data-id="doc-approve-1" data-status="pending_approval">
            <td>Doc Name</td>
            <td><span class="badge bg-warning">pending approval</span></td>
          </tr>
        </tbody>
      </table>
    `;

    STATE.currentUser = { email: 'admin@test.com' };
    apiClient.update = jest.fn().mockResolvedValue({ data: { id: 'doc-approve-1', status: 'approved' } });
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await documentModule.approveDocument('doc-approve-1');

    const row = document.querySelector('#docLibraryTable tr[data-id="doc-approve-1"]');
    expect(row.dataset.status).toBe('approved');
    expect(row.querySelector('.badge').className).toBe('badge bg-success');
    expect(row.querySelector('.badge').textContent).toBe('approved');
    toastSpy.mockRestore();
  });
});

describe('Document Module - buildPressPack', () => {
  test('builds press pack modal and returns documents', async () => {
    // Mock 3 parallel queries for photos, certs, profiles
    const photoData = [
      {
        id: 'p1',
        title: 'Photo 1',
        file_url: 'https://cdn.example.com/photo1.jpg',
        file_type: 'image/jpeg',
        file_name: 'photo1.jpg',
      },
    ];
    const certData = [
      {
        id: 'c1',
        title: 'Certificate 1',
        file_url: 'https://cdn.example.com/cert1.pdf',
        file_type: 'application/pdf',
        file_name: 'cert1.pdf',
      },
    ];
    const profileData = [
      {
        id: 'pp1',
        title: 'Profile 1',
        file_url: 'https://cdn.example.com/profile1.pdf',
        file_type: 'application/pdf',
        file_name: 'profile1.pdf',
      },
    ];

    // The mockChain.then is used for the final resolved promise in the chain
    // We need to mock the full chain for each of the 3 parallel queries
    let callCount = 0;
    mockChain.from.mockReturnValue(mockChain);
    mockChain.select.mockReturnValue(mockChain);
    mockChain.eq.mockReturnValue(mockChain);
    mockChain.in.mockReturnValue(mockChain);
    mockChain.then.mockImplementation((cb) => {
      callCount++;
      if (callCount === 1) return Promise.resolve(cb({ data: photoData, error: null }));
      if (callCount === 2) return Promise.resolve(cb({ data: certData, error: null }));
      return Promise.resolve(cb({ data: profileData, error: null }));
    });

    const result = await documentModule.buildPressPack('winner-123');

    expect(result.winnerId).toBe('winner-123');
    expect(result.documents.length).toBe(3);
    expect(result.documents[0]._section).toBe('Media');
    expect(result.documents[1]._section).toBe('Certificates');
    expect(result.documents[2]._section).toBe('Press Pack');

    // Check that modal was added to DOM
    const modal = document.getElementById('pressPackModal');
    expect(modal).toBeTruthy();
    expect(modal.innerHTML).toContain('Press Pack');
    expect(modal.innerHTML).toContain('winner-123');
    expect(modal.innerHTML).toContain('3 document(s)');

    // Clean up
    modal.remove();
    callCount = 0;
    mockChain.then.mockImplementation((cb) => cb({ data: [], error: null }));
  });

  test('shows empty message when no approved documents', async () => {
    mockChain.from.mockReturnValue(mockChain);
    mockChain.select.mockReturnValue(mockChain);
    mockChain.eq.mockReturnValue(mockChain);
    mockChain.in.mockReturnValue(mockChain);
    mockChain.then.mockImplementation((cb) => Promise.resolve(cb({ data: [], error: null })));

    const result = await documentModule.buildPressPack('winner-empty');

    expect(result.winnerId).toBe('winner-empty');
    expect(result.documents.length).toBe(0);

    const modal = document.getElementById('pressPackModal');
    expect(modal).toBeTruthy();
    expect(modal.innerHTML).toContain('No approved documents found');
    expect(modal.innerHTML).toContain('0 document(s)');

    modal.remove();
  });

  test('removes existing modal before creating new one', async () => {
    // Create a pre-existing modal
    const existingModal = document.createElement('div');
    existingModal.id = 'pressPackModal';
    existingModal.innerHTML = 'old modal';
    document.body.appendChild(existingModal);

    mockChain.from.mockReturnValue(mockChain);
    mockChain.select.mockReturnValue(mockChain);
    mockChain.eq.mockReturnValue(mockChain);
    mockChain.in.mockReturnValue(mockChain);
    mockChain.then.mockImplementation((cb) => Promise.resolve(cb({ data: [], error: null })));

    await documentModule.buildPressPack('winner-replace');

    const modals = document.querySelectorAll('#pressPackModal');
    expect(modals.length).toBe(1);
    expect(modals[0].innerHTML).not.toContain('old modal');

    modals[0].remove();
  });
});
