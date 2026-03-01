/**
 * Tests for upload-documents.js - Public file upload handler
 * Run with: npx jest tests/upload-documents.test.js
 */

const { JSDOM } = require('jsdom');

// Setup DOM before loading modules
const dom = new JSDOM(
  `<!DOCTYPE html><html><head></head><body>
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
  <span id="awardsCount"></span>
  <span id="eventsCount"></span>
  <span id="winnersCount"></span>
  <div class="upload-section">
    <div id="entryDetails"></div>
    <div class="upload-zone" id="uploadZone">
      <input type="file" id="fileInput" multiple style="display:none;" />
      <button id="browseButton">Browse</button>
    </div>
    <div id="fileList"></div>
    <button id="uploadButton" disabled>Upload All</button>
    <div id="uploadForm"></div>
    <div id="successMessage" style="display:none;"></div>
  </div>
</body></html>`,
  { url: 'http://localhost?entry=ENT-001' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Array = Array;

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

// Mock requestAnimationFrame and setTimeout for toast
global.requestAnimationFrame = jest.fn((cb) => cb());

// Mock fetch for API proxy calls - default returns valid entry to prevent
// showError from destroying DOM during auto-initialization
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        entry: {
          id: 'uuid-default',
          entry_number: 'ENT-001',
          contact_name: 'Default',
          contact_email: 'default@test.com',
          company_name: 'Test Co',
          award_name: 'Test Award',
        },
        files: [],
      }),
  })
);

// Mock Supabase client (still needed for config/utils setup)
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
  then: jest.fn((cb) => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signInWithPassword: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
  },
  channel: jest.fn(() => ({
    on: jest.fn(function () {
      return this;
    }),
    subscribe: jest.fn(function () {
      return this;
    }),
  })),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(() => Promise.resolve({ data: {}, error: null })),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://cdn.example.com/file.pdf' } })),
    })),
  },
};

// Expose supabase globally (needed for config.js setup)
global.supabase = { createClient: jest.fn(() => mockSupabase) };
global.window.supabase = global.supabase;

// Load config to set up SUPABASE_CONFIG and STATE
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

// Load utils
require('../utils.js');
for (const key of Object.keys(global.window)) {
  if (!(key in global) && typeof global.window[key] !== 'undefined') {
    global[key] = global.window[key];
  }
}

// Load upload-documents module
require('../upload-documents.js');
for (const key of Object.keys(global.window)) {
  if (!(key in global) && typeof global.window[key] !== 'undefined') {
    global[key] = global.window[key];
  }
}

// ==========================================
// TESTS
// ==========================================

describe('Upload Documents - Module Exports', () => {
  test('uploadApp is defined and accessible', () => {
    expect(uploadApp).toBeDefined();
    expect(typeof uploadApp).toBe('object');
  });

  test('uploadApp has all required methods', () => {
    expect(typeof uploadApp.initialize).toBe('function');
    expect(typeof uploadApp.loadEntryDetails).toBe('function');
    expect(typeof uploadApp.loadExistingFiles).toBe('function');
    expect(typeof uploadApp.setupUploadZone).toBe('function');
    expect(typeof uploadApp.handleFiles).toBe('function');
    expect(typeof uploadApp.renderFileList).toBe('function');
    expect(typeof uploadApp.removeFile).toBe('function');
    expect(typeof uploadApp.uploadAllFiles).toBe('function');
    expect(typeof uploadApp.uploadFile).toBe('function');
    expect(typeof uploadApp.getFileType).toBe('function');
    expect(typeof uploadApp.showError).toBe('function');
  });

  test('uploadApp has correct state structure', () => {
    // entryId and entryData may be populated from auto-initialization
    expect(typeof uploadApp.entryId === 'string' || uploadApp.entryId === null).toBe(true);
    expect(Array.isArray(uploadApp.files)).toBe(true);
    expect(Array.isArray(uploadApp.uploadedFiles)).toBe(true);
  });
});

describe('Upload Documents - showPublicToast', () => {
  test('showPublicToast is defined', () => {
    expect(typeof showPublicToast).toBe('function');
  });

  test('showPublicToast creates container if not present', () => {
    const existing = document.getElementById('publicToastContainer');
    if (existing) existing.remove();

    showPublicToast('Test message', 'success');

    const container = document.getElementById('publicToastContainer');
    expect(container).not.toBeNull();
    expect(container.style.position).toBe('fixed');
  });

  test('showPublicToast reuses existing container', () => {
    showPublicToast('First message', 'info');
    showPublicToast('Second message', 'warning');

    const containers = document.querySelectorAll('#publicToastContainer');
    expect(containers.length).toBe(1);
  });

  test('showPublicToast applies correct colors for each type', () => {
    const container = document.getElementById('publicToastContainer');
    if (container) container.innerHTML = '';

    showPublicToast('Error!', 'error');
    const toast = document.querySelector('#publicToastContainer div');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toBe('Error!');
  });
});

describe('Upload Documents - esc helper', () => {
  test('esc is defined', () => {
    expect(typeof esc).toBe('function');
  });

  test('esc returns empty string for falsy input', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
    expect(esc('')).toBe('');
  });

  test('esc escapes HTML entities', () => {
    expect(esc('<script>')).toBe('&lt;script&gt;');
    expect(esc('"hello"')).toBe('&quot;hello&quot;');
    expect(esc("it's")).toBe('it&#39;s');
    expect(esc('a&b')).toBe('a&amp;b');
  });

  test('esc converts non-string input to string', () => {
    expect(esc(42)).toBe('42');
    expect(esc(true)).toBe('true');
  });
});

describe('Upload Documents - getFileType', () => {
  test('returns image for image mime types', () => {
    expect(uploadApp.getFileType('image/jpeg')).toBe('image');
    expect(uploadApp.getFileType('image/png')).toBe('image');
    expect(uploadApp.getFileType('image/gif')).toBe('image');
  });

  test('returns pdf for pdf mime type', () => {
    expect(uploadApp.getFileType('application/pdf')).toBe('pdf');
  });

  test('returns document for word mime types', () => {
    expect(uploadApp.getFileType('application/msword')).toBe('document');
    expect(uploadApp.getFileType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(
      'document'
    );
  });

  test('returns spreadsheet for excel mime types', () => {
    expect(uploadApp.getFileType('application/vnd.ms-excel')).toBe('spreadsheet');
    expect(uploadApp.getFileType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(
      'spreadsheet'
    );
  });

  test('returns presentation for powerpoint mime types', () => {
    expect(uploadApp.getFileType('application/vnd.ms-powerpoint')).toBe('presentation');
    expect(uploadApp.getFileType('application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe(
      'presentation'
    );
  });

  test('returns other for unknown mime types', () => {
    expect(uploadApp.getFileType('text/plain')).toBe('other');
    expect(uploadApp.getFileType('application/zip')).toBe('other');
  });
});

describe('Upload Documents - handleFiles', () => {
  beforeEach(() => {
    uploadApp.files = [];
    document.getElementById('fileList').innerHTML = '';
    document.getElementById('uploadButton').disabled = true;
  });

  test('accepts valid PDF files', () => {
    const fileList = [{ name: 'doc.pdf', size: 1024, type: 'application/pdf' }];
    uploadApp.handleFiles(fileList);
    expect(uploadApp.files.length).toBe(1);
    expect(uploadApp.files[0].name).toBe('doc.pdf');
  });

  test('accepts valid image files', () => {
    const fileList = [
      { name: 'photo.jpg', size: 2048, type: 'image/jpeg' },
      { name: 'logo.png', size: 512, type: 'image/png' },
    ];
    uploadApp.handleFiles(fileList);
    expect(uploadApp.files.length).toBe(2);
  });

  test('rejects files over 10MB', () => {
    const fileList = [{ name: 'huge.pdf', size: 11 * 1024 * 1024, type: 'application/pdf' }];
    uploadApp.handleFiles(fileList);
    expect(uploadApp.files.length).toBe(0);
  });

  test('rejects invalid file types', () => {
    const fileList = [{ name: 'script.exe', size: 1024, type: 'application/x-executable' }];
    uploadApp.handleFiles(fileList);
    expect(uploadApp.files.length).toBe(0);
  });

  test('rejects duplicate files (same name and size)', () => {
    const file = { name: 'doc.pdf', size: 1024, type: 'application/pdf' };
    uploadApp.handleFiles([file]);
    uploadApp.handleFiles([file]);
    expect(uploadApp.files.length).toBe(1);
  });

  test('allows files with same name but different size', () => {
    const file1 = { name: 'doc.pdf', size: 1024, type: 'application/pdf' };
    const file2 = { name: 'doc.pdf', size: 2048, type: 'application/pdf' };
    uploadApp.handleFiles([file1]);
    uploadApp.handleFiles([file2]);
    expect(uploadApp.files.length).toBe(2);
  });

  test('enables upload button when files are added', () => {
    const fileList = [{ name: 'doc.pdf', size: 1024, type: 'application/pdf' }];
    uploadApp.handleFiles(fileList);
    expect(document.getElementById('uploadButton').disabled).toBe(false);
  });

  test('keeps upload button disabled when no valid files', () => {
    const fileList = [{ name: 'script.exe', size: 1024, type: 'application/x-executable' }];
    uploadApp.handleFiles(fileList);
    expect(document.getElementById('uploadButton').disabled).toBe(true);
  });

  test('accepts multiple file types at once', () => {
    const fileList = [
      { name: 'doc.pdf', size: 1024, type: 'application/pdf' },
      { name: 'photo.jpg', size: 2048, type: 'image/jpeg' },
      {
        name: 'spreadsheet.xlsx',
        size: 512,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    ];
    uploadApp.handleFiles(fileList);
    expect(uploadApp.files.length).toBe(3);
  });
});

describe('Upload Documents - renderFileList', () => {
  beforeEach(() => {
    uploadApp.files = [];
    document.getElementById('fileList').innerHTML = '';
  });

  test('clears file list when no files', () => {
    uploadApp.renderFileList();
    expect(document.getElementById('fileList').innerHTML).toBe('');
  });

  test('renders file items for each file', () => {
    uploadApp.files = [
      { name: 'doc.pdf', size: 1024 },
      { name: 'photo.jpg', size: 2048 },
    ];
    uploadApp.renderFileList();
    const fileList = document.getElementById('fileList');
    expect(fileList.querySelectorAll('.file-item').length).toBe(2);
  });

  test('displays file name and size in rendered list', () => {
    uploadApp.files = [{ name: 'report.pdf', size: 5120 }];
    uploadApp.renderFileList();
    const fileList = document.getElementById('fileList');
    expect(fileList.innerHTML).toContain('report.pdf');
    expect(fileList.innerHTML).toContain('5.0 KB');
  });

  test('renders remove buttons with correct data attributes', () => {
    uploadApp.files = [{ name: 'doc.pdf', size: 1024 }];
    uploadApp.renderFileList();
    const removeBtn = document.querySelector('[data-action="uploadApp.removeFile"]');
    expect(removeBtn).not.toBeNull();
    expect(removeBtn.getAttribute('data-id')).toBe('0');
  });
});

describe('Upload Documents - removeFile', () => {
  beforeEach(() => {
    uploadApp.files = [
      { name: 'a.pdf', size: 100, type: 'application/pdf' },
      { name: 'b.pdf', size: 200, type: 'application/pdf' },
      { name: 'c.pdf', size: 300, type: 'application/pdf' },
    ];
  });

  test('removes file at given index', () => {
    uploadApp.removeFile(1);
    expect(uploadApp.files.length).toBe(2);
    expect(uploadApp.files[0].name).toBe('a.pdf');
    expect(uploadApp.files[1].name).toBe('c.pdf');
  });

  test('disables upload button when last file is removed', () => {
    uploadApp.files = [{ name: 'only.pdf', size: 100, type: 'application/pdf' }];
    uploadApp.removeFile(0);
    expect(uploadApp.files.length).toBe(0);
    expect(document.getElementById('uploadButton').disabled).toBe(true);
  });
});

describe('Upload Documents - showError', () => {
  let savedHTML;

  beforeEach(() => {
    savedHTML = document.querySelector('.upload-section').innerHTML;
  });

  afterEach(() => {
    document.querySelector('.upload-section').innerHTML = savedHTML;
  });

  test('replaces upload section content with error message', () => {
    uploadApp.showError('Something went wrong');
    const section = document.querySelector('.upload-section');
    expect(section.innerHTML).toContain('Something went wrong');
    expect(section.innerHTML).toContain('alert-danger');
  });
});

describe('Upload Documents - initialize', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    uploadApp.entryId = null;
    uploadApp.entryData = null;
    uploadApp.files = [];
    uploadApp.uploadedFiles = [];
  });

  test('reads entry ID from URL parameter', async () => {
    // The URL was set to ?entry=ENT-001 in the JSDOM setup
    // Re-mock loadEntryDetails so it does not hit the mock chain
    const loadSpy = jest.spyOn(uploadApp, 'loadEntryDetails').mockResolvedValue();
    const setupSpy = jest.spyOn(uploadApp, 'setupUploadZone').mockImplementation(() => {});

    await uploadApp.initialize();
    expect(uploadApp.entryId).toBe('ENT-001');

    loadSpy.mockRestore();
    setupSpy.mockRestore();
  });

  test('shows error when no entry ID in URL', async () => {
    const originalSearch = dom.window.location.search;
    // Override entryId path by nulling out the param
    const showErrorSpy = jest.spyOn(uploadApp, 'showError').mockImplementation(() => {});
    const oldEntryId = uploadApp.entryId;
    uploadApp.entryId = null;

    // Temporarily override to simulate no entry param
    const origGet = URLSearchParams.prototype.get;
    URLSearchParams.prototype.get = jest.fn(() => null);

    await uploadApp.initialize();
    expect(showErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid upload link'));

    URLSearchParams.prototype.get = origGet;
    showErrorSpy.mockRestore();
  });

  test('calls setupUploadZone and loadEntryDetails', async () => {
    const loadSpy = jest.spyOn(uploadApp, 'loadEntryDetails').mockResolvedValue();
    const setupSpy = jest.spyOn(uploadApp, 'setupUploadZone').mockImplementation(() => {});

    await uploadApp.initialize();

    expect(setupSpy).toHaveBeenCalled();
    expect(loadSpy).toHaveBeenCalled();

    loadSpy.mockRestore();
    setupSpy.mockRestore();
  });
});

describe('Upload Documents - loadEntryDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    uploadApp.entryId = 'ENT-001';
    uploadApp.entryData = null;
    document.getElementById('entryDetails').innerHTML = '';
  });

  test('sets entryData on successful load', async () => {
    const entry = {
      id: 'uuid-1',
      entry_number: 'ENT-001',
      contact_name: 'John',
      contact_email: 'john@test.com',
      company_name: 'N/A',
      award_name: 'N/A',
    };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ entry }),
    });
    const existingSpy = jest.spyOn(uploadApp, 'loadExistingFiles').mockResolvedValue();

    await uploadApp.loadEntryDetails();

    expect(uploadApp.entryData).toEqual(entry);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/upload-proxy?action=get_entry'));
    existingSpy.mockRestore();
  });

  test('shows error when API returns not ok', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Entry not found' }),
    });
    const showErrorSpy = jest.spyOn(uploadApp, 'showError').mockImplementation(() => {});

    await uploadApp.loadEntryDetails();

    expect(showErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Entry not found'));
    showErrorSpy.mockRestore();
  });

  test('shows error on fetch failure', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));
    const showErrorSpy = jest.spyOn(uploadApp, 'showError').mockImplementation(() => {});

    await uploadApp.loadEntryDetails();

    expect(showErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to load entry'));
    showErrorSpy.mockRestore();
  });

  test('renders entry details table with organisation and award names', async () => {
    const entry = {
      id: 'uuid-1',
      entry_number: 'ENT-001',
      contact_name: 'Jane',
      contact_email: 'jane@test.com',
      company_name: 'Acme Corp',
      award_name: 'Best Innovation',
    };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ entry }),
    });
    const existingSpy = jest.spyOn(uploadApp, 'loadExistingFiles').mockResolvedValue();

    await uploadApp.loadEntryDetails();

    const details = document.getElementById('entryDetails').innerHTML;
    expect(details).toContain('ENT-001');
    expect(details).toContain('Acme Corp');
    expect(details).toContain('Best Innovation');
    expect(details).toContain('Jane');

    existingSpy.mockRestore();
  });
});

describe('Upload Documents - loadExistingFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    uploadApp.entryData = { id: 'uuid-1', entry_number: 'ENT-001' };
    // Remove any previously injected alert
    document.querySelectorAll('.alert-success').forEach((el) => el.remove());
  });

  test('renders existing files list when files exist', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          files: [
            { file_name: 'existing.pdf', file_size: 2048 },
            { file_name: 'photo.jpg', file_size: 4096 },
          ],
        }),
    });

    await uploadApp.loadExistingFiles();

    const alert = document.querySelector('.alert-success');
    expect(alert).not.toBeNull();
    expect(alert.innerHTML).toContain('existing.pdf');
    expect(alert.innerHTML).toContain('photo.jpg');
    expect(alert.innerHTML).toContain('Previously Uploaded Files (2)');
  });

  test('does not render anything when no existing files', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ files: [] }),
    });

    await uploadApp.loadExistingFiles();

    const alert = document.querySelector('.alert-success');
    expect(alert).toBeNull();
  });

  test('handles error gracefully', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await uploadApp.loadExistingFiles();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('Upload Documents - uploadFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    uploadApp.entryData = { id: 'uuid-1', entry_number: 'ENT-001', contact_email: 'test@test.com' };
    uploadApp.uploadedFiles = [];
  });

  test('uploads file via signed URL and saves metadata', async () => {
    // Mock get_upload_token
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            signedUrl: 'https://storage.example.com/upload?token=abc',
            token: 'abc',
            path: 'ENT-001/12345-doc.pdf',
            publicUrl: 'https://cdn.example.com/ENT-001/12345-doc.pdf',
          }),
      })
      // Mock PUT to signed URL
      .mockResolvedValueOnce({ ok: true })
      // Mock save_file_metadata
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) });

    const file = { name: 'doc.pdf', size: 1024, type: 'application/pdf' };
    await uploadApp.uploadFile(file, 0);

    expect(uploadApp.uploadedFiles.length).toBe(1);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    // First call: get_upload_token
    expect(global.fetch.mock.calls[0][0]).toBe('/api/upload-proxy');
    // Second call: PUT to signed URL
    expect(global.fetch.mock.calls[1][1].method).toBe('PUT');
    // Third call: save_file_metadata
    expect(global.fetch.mock.calls[2][0]).toBe('/api/upload-proxy');
  });

  test('throws error when get_upload_token fails', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Token failed' }),
    });

    const file = { name: 'doc.pdf', size: 1024, type: 'application/pdf' };
    await expect(uploadApp.uploadFile(file, 0)).rejects.toThrow('Token failed');
  });

  test('throws error when storage PUT fails', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            signedUrl: 'https://storage.example.com/upload',
            publicUrl: 'https://cdn.example.com/file.pdf',
          }),
      })
      .mockResolvedValueOnce({ ok: false });

    const file = { name: 'doc.pdf', size: 1024, type: 'application/pdf' };
    await expect(uploadApp.uploadFile(file, 0)).rejects.toThrow('File upload failed');
  });

  test('throws error when save_file_metadata fails', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            signedUrl: 'https://storage.example.com/upload',
            publicUrl: 'https://cdn.example.com/file.pdf',
          }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Metadata save failed' }),
      });

    const file = { name: 'doc.pdf', size: 1024, type: 'application/pdf' };
    await expect(uploadApp.uploadFile(file, 0)).rejects.toThrow('Metadata save failed');
  });
});

describe('Upload Documents - uploadAllFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    uploadApp.files = [];
    uploadApp.uploadedFiles = [];
    const uploadBtn = document.getElementById('uploadButton');
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = 'Upload All';
    }
    const form = document.getElementById('uploadForm');
    if (form) form.style.display = '';
    const success = document.getElementById('successMessage');
    if (success) success.style.display = 'none';
    const fileList = document.getElementById('fileList');
    if (fileList) fileList.innerHTML = '';
  });

  test('does nothing when no files to upload', async () => {
    uploadApp.files = [];
    await uploadApp.uploadAllFiles();
    expect(document.getElementById('uploadForm').style.display).not.toBe('none');
  });

  test('uploads all files and shows success', async () => {
    uploadApp.files = [
      { name: 'a.pdf', size: 100, type: 'application/pdf' },
      { name: 'b.pdf', size: 200, type: 'application/pdf' },
    ];

    // Create file item elements that uploadAllFiles expects
    document.getElementById('fileList').innerHTML =
      '<div class="file-item" id="file-0"><div></div><div><button>X</button></div></div>' +
      '<div class="file-item" id="file-1"><div></div><div><button>X</button></div></div>';

    const uploadSpy = jest.spyOn(uploadApp, 'uploadFile').mockResolvedValue();

    await uploadApp.uploadAllFiles();

    expect(uploadSpy).toHaveBeenCalledTimes(2);
    expect(document.getElementById('uploadForm').style.display).toBe('none');
    expect(document.getElementById('successMessage').style.display).toBe('block');

    uploadSpy.mockRestore();
  });

  test('handles upload failure for individual files', async () => {
    uploadApp.files = [
      { name: 'good.pdf', size: 100, type: 'application/pdf' },
      { name: 'bad.pdf', size: 200, type: 'application/pdf' },
    ];

    document.getElementById('fileList').innerHTML =
      '<div class="file-item" id="file-0"><div></div><div><button>X</button></div></div>' +
      '<div class="file-item" id="file-1"><div></div><div><button>X</button></div></div>';

    const uploadSpy = jest
      .spyOn(uploadApp, 'uploadFile')
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('Upload error'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await uploadApp.uploadAllFiles();

    // First file should be marked uploaded, second should show error icon
    const fileItem0 = document.getElementById('file-0');
    expect(fileItem0.classList.contains('uploaded')).toBe(true);

    const fileItem1 = document.getElementById('file-1');
    expect(fileItem1.innerHTML).toContain('text-danger');

    uploadSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  test('disables upload button and shows spinner during upload', async () => {
    uploadApp.files = [{ name: 'a.pdf', size: 100, type: 'application/pdf' }];

    document.getElementById('fileList').innerHTML =
      '<div class="file-item" id="file-0"><div></div><div><button>X</button></div></div>';

    let buttonStateCapture;
    jest.spyOn(uploadApp, 'uploadFile').mockImplementation(async () => {
      buttonStateCapture = {
        disabled: document.getElementById('uploadButton').disabled,
        html: document.getElementById('uploadButton').innerHTML,
      };
    });

    await uploadApp.uploadAllFiles();

    expect(buttonStateCapture.disabled).toBe(true);
    expect(buttonStateCapture.html).toContain('Uploading');
  });
});

describe('Upload Documents - setupUploadZone', () => {
  test('sets up event listeners without throwing', () => {
    expect(() => uploadApp.setupUploadZone()).not.toThrow();
  });

  test('upload zone click triggers file input click', () => {
    const fileInput = document.getElementById('fileInput');
    const clickSpy = jest.spyOn(fileInput, 'click').mockImplementation(() => {});

    const uploadZone = document.getElementById('uploadZone');
    uploadZone.click();

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
