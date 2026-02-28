/**
 * Tests for the Email Builder Module (email-builder.js)
 * Run with: npx jest tests/email-builder.test.js
 */

const { JSDOM } = require('jsdom');

// ---------------------------------------------------------------------------
// JSDOM Setup — include every element the email-builder module references
// ---------------------------------------------------------------------------

const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>
  <!-- Toast / notifications -->
  <div id="loadingBar" style="display:none;"></div>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
  <div id="connectionStatus"><span class="status-icon"></span><span class="status-text"></span></div>

  <!-- Login stubs (required by config.js / utils.js) -->
  <div id="loginPage"></div>
  <div id="dashboardPage"></div>
  <div id="splashScreen"></div>
  <div id="userEmail"></div>
  <div id="loginEmail"></div>
  <div id="loginPassword"></div>
  <div id="loginError" class="d-none"></div>
  <div id="loginBtn"></div>

  <!-- Confirm dialog (used by utils.confirmDialog) -->
  <div id="confirmDialogModal"></div>
  <div id="confirmDialogTitle"></div>
  <div id="confirmDialogBody"></div>
  <div id="confirmDialogOk"></div>

  <!-- Email Builder canvas & palette -->
  <div id="emailCanvas"></div>
  <div id="blockPaletteSection" style="display:none;"></div>
  <div id="htmlToolkitSection" style="display:none;"></div>
  <div id="email-builder-content"></div>

  <!-- Campaign settings inputs -->
  <input id="builderCampaignName" value="" />
  <input id="builderSubject" value="" />
  <input id="builderPreheader" value="" />
  <input id="builderFromName" value="" />
  <input id="builderFromEmail" value="" />
  <input id="builderReplyTo" value="" />
  <select id="builderEmailList"><option value="">Choose...</option></select>
  <span id="builderListCount"></span>
  <select id="builderOrgSelect"><option value="">Choose organisation...</option></select>

  <!-- Schedule controls -->
  <input id="builderScheduleDate" type="date" value="" />
  <input id="builderScheduleTime" type="time" value="" />
  <input type="radio" id="sendModeNow" name="sendMode" checked />
  <input type="radio" id="sendModeScheduled" name="sendMode" />
  <div id="scheduleOptions" style="display:none;"></div>
  <div id="schedulePreview"></div>
  <button id="btnSendCampaign"></button>
  <button id="btnScheduleCampaign" style="display:none;"></button>

  <!-- A/B testing -->
  <input type="checkbox" id="abTestToggle" />
  <div id="abTestSection" style="display:none;"></div>
  <input id="abVariantB" value="" />
  <input id="abSplitPercent" value="50" />
  <button id="btnABCampaign" style="display:none;"></button>

  <!-- Preview -->
  <iframe id="emailPreviewFrame"></iframe>
  <div id="emailPreviewModal"></div>

  <!-- Campaign log -->
  <tbody id="campaignLogBody"></tbody>
  <select id="campaignLogFilter"><option value="all">All</option></select>
  <div id="campaignLogPagination"></div>

  <!-- Content library stubs -->
  <div id="contentLibraryPanel"></div>
  <div id="companyContentItems"></div>
  <select id="promotionCompanySelect"><option value="">Choose...</option></select>
</body></html>`, { url: 'http://localhost' });

// ---------------------------------------------------------------------------
// Global bindings (mirrors awards.test.js pattern)
// ---------------------------------------------------------------------------

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.DOMParser = dom.window.DOMParser;
global.Event = dom.window.Event;
global.Blob = dom.window.Blob;
global.URL = { createObjectURL: jest.fn(() => 'blob://mock'), revokeObjectURL: jest.fn() };
global.window.URL = global.URL;

global.bootstrap = {
  Toast: class { show() {} hide() {} },
  Modal: class {
    show() {} hide() {}
    static getInstance() { return { hide() {} }; }
  },
  Tooltip: class {}
};

global.crypto = {
  getRandomValues: (arr) => {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    return arr;
  }
};

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------

const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  in: jest.fn(() => mockSupabase),
  not: jest.fn(() => mockSupabase),
  or: jest.fn(() => mockSupabase),
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
  })),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(() => Promise.resolve({ error: null })),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://example.com/img.jpg' } }))
    }))
  }
};

global.supabase = { createClient: () => mockSupabase };
global.window.supabase = global.supabase;

// ---------------------------------------------------------------------------
// Load config -> utils -> email-builder
// ---------------------------------------------------------------------------

require('../config.js');

function syncWindowToGlobal() {
  for (const key of Object.keys(global.window)) {
    if (!(key in global) && typeof global.window[key] !== 'undefined') {
      global[key] = global.window[key];
    }
  }
}

global.STATE = global.window.STATE;
global.SUPABASE_CONFIG = global.window.SUPABASE_CONFIG;
global.STATUS = global.window.STATUS;
global.MEDIA_TYPES = global.window.MEDIA_TYPES;
global.INACTIVITY_TIMEOUT = global.window.INACTIVITY_TIMEOUT;
global.YEARS = global.window.YEARS;
global.SECTORS = global.window.SECTORS;
global.REGIONS = global.window.REGIONS;
global.STATE.client = mockSupabase;

require('../utils.js');
syncWindowToGlobal();

require('../email-builder.js');
syncWindowToGlobal();

// ==========================================
// HELPERS
// ==========================================

/** Reset the builder to a clean state between tests */
function resetBuilder() {
  emailBuilder.blocks = [];
  emailBuilder.undoStack = [];
  emailBuilder.redoStack = [];
  emailBuilder.hasUnsavedChanges = false;
  emailBuilder.currentOrg = null;
  emailBuilder.selectedCompany = null;
  emailBuilder.promotionMode = 'nominee';
  emailBuilder.abTestEnabled = false;
  emailBuilder.abVariantB = '';
  emailBuilder.viewMode = 'desktop';
  emailBuilder.previewDeviceMode = 'desktop';
  emailBuilder._blockIdCounter = 0;
  emailBuilder._reorderDragId = null;
  emailBuilder.campaignLogPage = 0;
  emailBuilder.campaignLogSearch = '';
  emailBuilder.campaignLogTotal = 0;
  emailBuilder.contentLibraryVisible = false;
  emailBuilder.canvas = document.getElementById('emailCanvas');
  emailBuilder.canvas.innerHTML = '';
  emailBuilder.canvas.style.maxWidth = '';
  emailBuilder.canvas.style.margin = '';

  // Reset form inputs
  document.getElementById('builderCampaignName').value = '';
  document.getElementById('builderSubject').value = '';
  document.getElementById('builderPreheader').value = '';
  document.getElementById('builderFromName').value = '';
  document.getElementById('builderFromEmail').value = '';
  document.getElementById('builderReplyTo').value = '';
}

// ==========================================
// TESTS
// ==========================================

describe('Email Builder Module - Initialization & Structure', () => {
  test('emailBuilder is exported to window', () => {
    expect(window.emailBuilder).toBeDefined();
    expect(emailBuilder).toBeDefined();
  });

  test('emailBuilder has required state properties', () => {
    expect(emailBuilder).toHaveProperty('canvas');
    expect(emailBuilder).toHaveProperty('blocks');
    expect(emailBuilder).toHaveProperty('currentOrg');
    expect(emailBuilder).toHaveProperty('viewMode');
    expect(emailBuilder).toHaveProperty('initialized');
    expect(emailBuilder).toHaveProperty('promotionMode');
    expect(emailBuilder).toHaveProperty('undoStack');
    expect(emailBuilder).toHaveProperty('redoStack');
    expect(emailBuilder).toHaveProperty('maxUndoSteps');
    expect(emailBuilder).toHaveProperty('hasUnsavedChanges');
    expect(emailBuilder).toHaveProperty('abTestEnabled');
    expect(emailBuilder).toHaveProperty('abVariantB');
    expect(emailBuilder).toHaveProperty('_blockIdCounter');
    expect(emailBuilder).toHaveProperty('_reorderDragId');
    expect(emailBuilder).toHaveProperty('campaignLogPage');
    expect(emailBuilder).toHaveProperty('campaignLogPageSize');
    expect(emailBuilder).toHaveProperty('campaignLogTotal');
    expect(emailBuilder).toHaveProperty('campaignLogSearch');
  });

  test('emailBuilder has required methods', () => {
    expect(typeof emailBuilder.init).toBe('function');
    expect(typeof emailBuilder.addBlock).toBe('function');
    expect(typeof emailBuilder.deleteBlock).toBe('function');
    expect(typeof emailBuilder.moveBlockUp).toBe('function');
    expect(typeof emailBuilder.moveBlockDown).toBe('function');
    expect(typeof emailBuilder.duplicateBlock).toBe('function');
    expect(typeof emailBuilder.getBlockHTML).toBe('function');
    expect(typeof emailBuilder.generateFullHTML).toBe('function');
    expect(typeof emailBuilder.exportHTML).toBe('function');
    expect(typeof emailBuilder.updatePreview).toBe('function');
    expect(typeof emailBuilder.saveUndoState).toBe('function');
    expect(typeof emailBuilder.undo).toBe('function');
    expect(typeof emailBuilder.redo).toBe('function');
    expect(typeof emailBuilder.setViewMode).toBe('function');
    expect(typeof emailBuilder.checkSpamScore).toBe('function');
    expect(typeof emailBuilder.getStatusBadge).toBe('function');
    expect(typeof emailBuilder.getRecipientStatusBadge).toBe('function');
    expect(typeof emailBuilder.generateBadge).toBe('function');
    expect(typeof emailBuilder.updateSubjectCounter).toBe('function');
    expect(typeof emailBuilder.markUnsavedChanges).toBe('function');
    expect(typeof emailBuilder.showEmptyState).toBe('function');
    expect(typeof emailBuilder.getResponsiveEmailCSS).toBe('function');
    expect(typeof emailBuilder.updateCountdown).toBe('function');
    expect(typeof emailBuilder.setBlockBackground).toBe('function');
    expect(typeof emailBuilder.updateButtonFromControls).toBe('function');
    expect(typeof emailBuilder.wrapHtmlSelection).toBe('function');
    expect(typeof emailBuilder.searchCampaigns).toBe('function');
    expect(typeof emailBuilder.toggleScheduler).toBe('function');
    expect(typeof emailBuilder.toggleABTest).toBe('function');
    expect(typeof emailBuilder.setPromotionMode).toBe('function');
    expect(typeof emailBuilder._syncBlocksFromDOM).toBe('function');
  });

  test('default state values are correct', () => {
    expect(emailBuilder.viewMode).toBe('desktop');
    expect(emailBuilder.promotionMode).toBe('nominee');
    expect(emailBuilder.maxUndoSteps).toBe(30);
    expect(emailBuilder.campaignLogPageSize).toBe(20);
  });

  test('htmlSnippets object is populated', () => {
    expect(emailBuilder.htmlSnippets).toBeDefined();
    expect(typeof emailBuilder.htmlSnippets).toBe('object');
    expect(emailBuilder.htmlSnippets['table-row']).toContain('<table');
    expect(emailBuilder.htmlSnippets['two-column']).toContain('Left column');
    expect(emailBuilder.htmlSnippets['three-column']).toContain('Column 1');
    expect(emailBuilder.htmlSnippets['spacer-sm']).toContain('height: 10px');
    expect(emailBuilder.htmlSnippets['spacer-md']).toContain('height: 20px');
    expect(emailBuilder.htmlSnippets['spacer-lg']).toContain('height: 40px');
    expect(emailBuilder.htmlSnippets['divider']).toContain('border-top');
    expect(emailBuilder.htmlSnippets['heading']).toContain('<h2');
    expect(emailBuilder.htmlSnippets['paragraph']).toContain('<p');
    expect(emailBuilder.htmlSnippets['button']).toContain('Button Text');
    expect(emailBuilder.htmlSnippets['preheader']).toContain('display: none');
    expect(emailBuilder.htmlSnippets['link']).toContain('<a');
    expect(emailBuilder.htmlSnippets['bold-text']).toContain('<strong');
  });
});

describe('Email Builder Module - Block Templates (getBlockHTML)', () => {
  beforeEach(() => {
    resetBuilder();
  });

  test('getBlockHTML returns text block for unknown type', () => {
    const html = emailBuilder.getBlockHTML('nonexistent-type', 'test-id');
    expect(html).toContain('contenteditable="true"');
    expect(html).toContain('Dear {{contact_name}}');
  });

  test('getBlockHTML returns header block', () => {
    const html = emailBuilder.getBlockHTML('header', 'test-id');
    expect(html).toContain('alt="Logo"');
    expect(html).toContain('max-width: 250px');
  });

  test('getBlockHTML returns hero block', () => {
    const html = emailBuilder.getBlockHTML('hero', 'test-id');
    expect(html).toContain('alt="Hero"');
    expect(html).toContain('Congratulations');
  });

  test('getBlockHTML returns text block', () => {
    const html = emailBuilder.getBlockHTML('text', 'test-id');
    expect(html).toContain('Dear {{contact_name}}');
    expect(html).toContain('contenteditable="true"');
  });

  test('getBlockHTML returns divider block', () => {
    const html = emailBuilder.getBlockHTML('divider', 'test-id');
    expect(html).toContain('height: 1px');
    expect(html).toContain('background-color: #dee2e6');
  });

  test('getBlockHTML returns social-links block', () => {
    const html = emailBuilder.getBlockHTML('social-links', 'test-id');
    expect(html).toContain('Follow us on social media');
    expect(html).toContain('facebook.com');
    expect(html).toContain('x.com');
    expect(html).toContain('linkedin.com');
    expect(html).toContain('instagram.com');
  });

  test('getBlockHTML returns footer block with unsubscribe', () => {
    const html = emailBuilder.getBlockHTML('footer', 'test-id');
    expect(html).toContain('{{unsubscribe_url}}');
    expect(html).toContain('Unsubscribe');
    expect(html).toContain('View in Browser');
    expect(html).toContain(String(new Date().getFullYear()));
  });

  test('getBlockHTML returns button block with controls', () => {
    const html = emailBuilder.getBlockHTML('button', 'test-id');
    expect(html).toContain('email-button-controls');
    expect(html).toContain('View Your Profile');
    expect(html).toContain('{{website}}');
    expect(html).toContain('data-btn-text=');
  });

  test('getBlockHTML returns image block with upload control', () => {
    const html = emailBuilder.getBlockHTML('image', 'test-id');
    expect(html).toContain('email-image-controls');
    expect(html).toContain('data-img-id=');
    expect(html).toContain('data-img-target=');
    expect(html).toContain('Upload');
  });

  test('getBlockHTML returns richtext block with toolbar', () => {
    const html = emailBuilder.getBlockHTML('richtext', 'block-rt-1');
    expect(html).toContain('email-richtext-toolbar');
    expect(html).toContain('email-richtext-content');
    expect(html).toContain('contenteditable="true"');
    expect(html).toContain('data-block="block-rt-1"');
    expect(html).toContain('Start typing your content here...');
  });

  test('getBlockHTML returns html-code block with textarea', () => {
    const html = emailBuilder.getBlockHTML('html-code', 'block-hc-1');
    expect(html).toContain('email-html-code-editor');
    expect(html).toContain('email-html-code-header');
    expect(html).toContain('data-block="block-hc-1"');
    expect(html).toContain('Preview');
  });

  test('getBlockHTML returns video block with controls', () => {
    const html = emailBuilder.getBlockHTML('video', 'test-id');
    expect(html).toContain('email-video-controls');
    expect(html).toContain('YouTube or Vimeo');
    expect(html).toContain('data-video-id=');
  });

  test('getBlockHTML returns countdown block with date input', () => {
    const html = emailBuilder.getBlockHTML('countdown', 'test-id');
    expect(html).toContain('email-countdown-controls');
    expect(html).toContain('type="date"');
    expect(html).toContain('Event starts in');
    expect(html).toContain('Days');
    expect(html).toContain('Hours');
    expect(html).toContain('Mins');
    expect(html).toContain('Secs');
  });

  test('company-profile block shows warning when no org selected', () => {
    emailBuilder.currentOrg = null;
    const html = emailBuilder.getBlockHTML('company-profile', 'test-id');
    expect(html).toContain('Select an organisation first');
  });

  test('company-profile block shows org data when org is selected', () => {
    emailBuilder.currentOrg = {
      company_name: 'Test Corp',
      logo_url: 'https://example.com/logo.png',
      website: 'https://testcorp.com',
      region: 'South East'
    };
    const html = emailBuilder.getBlockHTML('company-profile', 'test-id');
    expect(html).toContain('Test Corp');
    expect(html).toContain('https://example.com/logo.png');
    expect(html).toContain('https://testcorp.com');
    expect(html).toContain('South East');
  });

  test('award-list block shows placeholder when no org/awards', () => {
    emailBuilder.currentOrg = null;
    const html = emailBuilder.getBlockHTML('award-list', 'test-id');
    expect(html).toContain('Select an organisation to view award history');
  });

  test('award-list block renders awards when org has awards', () => {
    emailBuilder.currentOrg = {
      company_name: 'Test Corp',
      awards: [
        { year: 2025, award_category: 'Best Plumber', sector: 'MEP' },
        { year: 2024, award_category: 'Best Builder', sector: null }
      ]
    };
    const html = emailBuilder.getBlockHTML('award-list', 'test-id');
    expect(html).toContain('2025');
    expect(html).toContain('Best Plumber');
    expect(html).toContain('MEP');
    expect(html).toContain('2024');
    expect(html).toContain('Best Builder');
    expect(html).toContain('Award History');
  });

  test('header block uses org logo when available', () => {
    emailBuilder.currentOrg = { logo_url: 'https://cdn.example.com/my-logo.png' };
    const html = emailBuilder.getBlockHTML('header', 'test-id');
    expect(html).toContain('https://cdn.example.com/my-logo.png');
  });

  test('hero block uses org company_name when available', () => {
    emailBuilder.currentOrg = { company_name: 'Acme Plumbing' };
    const html = emailBuilder.getBlockHTML('hero', 'test-id');
    expect(html).toContain('Acme Plumbing');
  });

  test('hero block uses template variable when no org', () => {
    emailBuilder.currentOrg = null;
    const html = emailBuilder.getBlockHTML('hero', 'test-id');
    expect(html).toContain('Congratulations {{company_name}}!');
  });
});

describe('Email Builder Module - addBlock()', () => {
  beforeEach(() => {
    resetBuilder();
  });

  test('addBlock adds a block to the canvas', () => {
    emailBuilder.addBlock('text');
    expect(emailBuilder.blocks.length).toBe(1);
    expect(emailBuilder.blocks[0].type).toBe('text');
    const wrappers = emailBuilder.canvas.querySelectorAll('.email-block-wrapper');
    expect(wrappers.length).toBe(1);
  });

  test('addBlock clears empty state on first block', () => {
    emailBuilder.canvas.innerHTML = '<div class="text-center">Empty state</div>';
    emailBuilder.addBlock('header');
    expect(emailBuilder.canvas.querySelector('.text-center')).toBeNull();
    expect(emailBuilder.blocks.length).toBe(1);
  });

  test('addBlock generates unique block IDs', () => {
    emailBuilder.addBlock('text');
    emailBuilder.addBlock('text');
    emailBuilder.addBlock('text');
    const ids = emailBuilder.blocks.map(b => b.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(3);
  });

  test('addBlock increments _blockIdCounter', () => {
    const before = emailBuilder._blockIdCounter;
    emailBuilder.addBlock('text');
    expect(emailBuilder._blockIdCounter).toBeGreaterThan(before);
  });

  test('addBlock attaches block controls', () => {
    emailBuilder.addBlock('text');
    const controls = emailBuilder.canvas.querySelector('.email-block-controls');
    expect(controls).not.toBeNull();
    expect(controls.querySelector('.block-drag-handle')).not.toBeNull();
  });

  test('addBlock marks unsaved changes', () => {
    emailBuilder.hasUnsavedChanges = false;
    emailBuilder.addBlock('divider');
    expect(emailBuilder.hasUnsavedChanges).toBe(true);
  });

  test('addBlock saves undo state', () => {
    expect(emailBuilder.undoStack.length).toBe(0);
    emailBuilder.addBlock('text');
    expect(emailBuilder.undoStack.length).toBe(1);
  });

  test('multiple blocks are appended in order', () => {
    emailBuilder.addBlock('header');
    emailBuilder.addBlock('text');
    emailBuilder.addBlock('footer');
    expect(emailBuilder.blocks.length).toBe(3);
    expect(emailBuilder.blocks[0].type).toBe('header');
    expect(emailBuilder.blocks[1].type).toBe('text');
    expect(emailBuilder.blocks[2].type).toBe('footer');
  });
});

describe('Email Builder Module - deleteBlock()', () => {
  beforeEach(() => {
    resetBuilder();
  });

  test('deleteBlock removes the block from canvas and blocks array', () => {
    emailBuilder.addBlock('text');
    const blockId = emailBuilder.blocks[0].id;
    emailBuilder.deleteBlock(blockId);
    expect(emailBuilder.blocks.length).toBe(0);
    expect(emailBuilder.canvas.querySelector(`[data-block-id="${blockId}"]`)).toBeNull();
  });

  test('deleteBlock shows empty state when last block is removed', () => {
    emailBuilder.addBlock('text');
    const blockId = emailBuilder.blocks[0].id;
    emailBuilder.deleteBlock(blockId);
    expect(emailBuilder.canvas.innerHTML).toContain('Drag blocks');
  });

  test('deleteBlock does nothing for non-existent block ID', () => {
    emailBuilder.addBlock('text');
    emailBuilder.deleteBlock('non-existent-id');
    expect(emailBuilder.blocks.length).toBe(1);
  });

  test('deleteBlock saves undo state', () => {
    emailBuilder.addBlock('text');
    const stackBefore = emailBuilder.undoStack.length;
    emailBuilder.deleteBlock(emailBuilder.blocks[0].id);
    expect(emailBuilder.undoStack.length).toBe(stackBefore + 1);
  });
});

describe('Email Builder Module - moveBlockUp() / moveBlockDown()', () => {
  beforeEach(() => {
    resetBuilder();
    emailBuilder.addBlock('header');
    emailBuilder.addBlock('text');
    emailBuilder.addBlock('footer');
  });

  test('moveBlockDown swaps block with next sibling', () => {
    const headerId = emailBuilder.blocks[0].id;
    emailBuilder.moveBlockDown(headerId);
    // After syncing from DOM, the header should be at index 1
    expect(emailBuilder.blocks[0].type).toBe('text');
    expect(emailBuilder.blocks[1].type).toBe('header');
    expect(emailBuilder.blocks[2].type).toBe('footer');
  });

  test('moveBlockUp swaps block with previous sibling', () => {
    const footerId = emailBuilder.blocks[2].id;
    emailBuilder.moveBlockUp(footerId);
    expect(emailBuilder.blocks[0].type).toBe('header');
    expect(emailBuilder.blocks[1].type).toBe('footer');
    expect(emailBuilder.blocks[2].type).toBe('text');
  });

  test('moveBlockUp on first block does nothing', () => {
    const firstId = emailBuilder.blocks[0].id;
    emailBuilder.moveBlockUp(firstId);
    expect(emailBuilder.blocks[0].type).toBe('header');
  });

  test('moveBlockDown on last block does nothing', () => {
    const lastId = emailBuilder.blocks[2].id;
    emailBuilder.moveBlockDown(lastId);
    expect(emailBuilder.blocks[2].type).toBe('footer');
  });
});

describe('Email Builder Module - duplicateBlock()', () => {
  beforeEach(() => {
    resetBuilder();
  });

  test('duplicateBlock creates a copy with a new ID', () => {
    emailBuilder.addBlock('text');
    const originalId = emailBuilder.blocks[0].id;
    emailBuilder.duplicateBlock(originalId);
    expect(emailBuilder.blocks.length).toBe(2);
    expect(emailBuilder.blocks[1].id).not.toBe(originalId);
    expect(emailBuilder.blocks[1].type).toBe('text');
  });

  test('duplicateBlock inserts after the original', () => {
    emailBuilder.addBlock('header');
    emailBuilder.addBlock('text');
    emailBuilder.addBlock('footer');
    const textId = emailBuilder.blocks[1].id;
    emailBuilder.duplicateBlock(textId);
    // The cloned block should appear at index 2 in the DOM order
    const wrappers = emailBuilder.canvas.querySelectorAll('.email-block-wrapper');
    expect(wrappers.length).toBe(4);
  });

  test('duplicateBlock does nothing for non-existent ID', () => {
    emailBuilder.addBlock('text');
    emailBuilder.duplicateBlock('fake-id');
    expect(emailBuilder.blocks.length).toBe(1);
  });
});

describe('Email Builder Module - Undo / Redo', () => {
  beforeEach(() => {
    resetBuilder();
  });

  test('undo restores previous canvas state', () => {
    emailBuilder.addBlock('header');
    emailBuilder.addBlock('text');
    // undoStack should have 2 entries (one per addBlock)
    expect(emailBuilder.undoStack.length).toBe(2);

    emailBuilder.undo();
    // After undo, we should be back to one block
    expect(emailBuilder.blocks.length).toBe(1);
    expect(emailBuilder.blocks[0].type).toBe('header');
  });

  test('redo restores undone state', () => {
    emailBuilder.addBlock('header');
    emailBuilder.addBlock('text');
    emailBuilder.undo();
    expect(emailBuilder.blocks.length).toBe(1);

    emailBuilder.redo();
    expect(emailBuilder.blocks.length).toBe(2);
  });

  test('undo when stack is empty does nothing', () => {
    expect(emailBuilder.undoStack.length).toBe(0);
    emailBuilder.undo();
    expect(emailBuilder.blocks.length).toBe(0);
  });

  test('redo when stack is empty does nothing', () => {
    expect(emailBuilder.redoStack.length).toBe(0);
    emailBuilder.redo();
    expect(emailBuilder.blocks.length).toBe(0);
  });

  test('new action clears redo stack', () => {
    emailBuilder.addBlock('header');
    emailBuilder.addBlock('text');
    emailBuilder.undo();
    expect(emailBuilder.redoStack.length).toBe(1);

    emailBuilder.addBlock('divider');
    expect(emailBuilder.redoStack.length).toBe(0);
  });

  test('undo stack respects maxUndoSteps', () => {
    emailBuilder.maxUndoSteps = 3;
    emailBuilder.addBlock('header');
    emailBuilder.addBlock('text');
    emailBuilder.addBlock('divider');
    emailBuilder.addBlock('footer');
    // The first entry should have been shifted out
    expect(emailBuilder.undoStack.length).toBe(3);
    emailBuilder.maxUndoSteps = 30; // restore
  });
});

describe('Email Builder Module - generateFullHTML()', () => {
  beforeEach(() => {
    resetBuilder();
  });

  test('generates valid HTML document', () => {
    emailBuilder.addBlock('text');
    const html = emailBuilder.generateFullHTML();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    expect(html).toContain('<head>');
    expect(html).toContain('<body');
  });

  test('includes responsive CSS', () => {
    emailBuilder.addBlock('text');
    const html = emailBuilder.generateFullHTML();
    expect(html).toContain('@media only screen and (max-width: 480px)');
    expect(html).toContain('.mob-pad');
    expect(html).toContain('.mob-stack');
  });

  test('includes MSO conditionals', () => {
    emailBuilder.addBlock('text');
    const html = emailBuilder.generateFullHTML();
    expect(html).toContain('<!--[if mso]>');
    expect(html).toContain('o:OfficeDocumentSettings');
  });

  test('includes preheader when set', () => {
    document.getElementById('builderPreheader').value = 'This is my preheader text';
    emailBuilder.addBlock('text');
    const html = emailBuilder.generateFullHTML();
    expect(html).toContain('This is my preheader text');
    expect(html).toContain('display:none');
  });

  test('excludes preheader div when empty', () => {
    document.getElementById('builderPreheader').value = '';
    emailBuilder.addBlock('text');
    const html = emailBuilder.generateFullHTML();
    // The preheader wrapper uses display:none - should NOT be present
    expect(html).not.toContain('display:none;font-size:1px');
  });

  test('uses campaign name as title', () => {
    document.getElementById('builderCampaignName').value = 'My Campaign';
    emailBuilder.addBlock('text');
    const html = emailBuilder.generateFullHTML();
    expect(html).toContain('<title>My Campaign</title>');
  });

  test('defaults title to Email Campaign when no name', () => {
    document.getElementById('builderCampaignName').value = '';
    emailBuilder.addBlock('text');
    const html = emailBuilder.generateFullHTML();
    expect(html).toContain('<title>Email Campaign</title>');
  });

  test('strips editor controls from output', () => {
    emailBuilder.addBlock('text');
    const html = emailBuilder.generateFullHTML();
    expect(html).not.toContain('email-block-controls');
  });

  test('strips contenteditable from standard blocks', () => {
    emailBuilder.addBlock('text');
    const html = emailBuilder.generateFullHTML();
    // The generated HTML should not have contenteditable in the output
    expect(html).not.toContain('contenteditable');
  });

  test('wraps rich text content in table', () => {
    emailBuilder.addBlock('richtext');
    const html = emailBuilder.generateFullHTML();
    // Rich text content should be wrapped in a table for email compatibility
    expect(html).toContain('Start typing your content here...');
  });

  test('uses textarea value for html-code block', () => {
    emailBuilder.addBlock('html-code');
    // Find and update the textarea
    const textarea = emailBuilder.canvas.querySelector('.email-html-code-editor');
    textarea.value = '<p>Custom HTML block content</p>';

    const html = emailBuilder.generateFullHTML();
    expect(html).toContain('<p>Custom HTML block content</p>');
  });
});

describe('Email Builder Module - getResponsiveEmailCSS()', () => {
  test('returns style tag with media query', () => {
    const css = emailBuilder.getResponsiveEmailCSS();
    expect(css).toContain('<style type="text/css">');
    expect(css).toContain('</style>');
    expect(css).toContain('@media only screen and (max-width: 480px)');
  });

  test('includes mobile-specific classes', () => {
    const css = emailBuilder.getResponsiveEmailCSS();
    expect(css).toContain('.mob-stack');
    expect(css).toContain('.mob-full-img');
    expect(css).toContain('.mob-pad');
    expect(css).toContain('.mob-text-lg');
    expect(css).toContain('.mob-text-md');
    expect(css).toContain('.mob-text-sm');
    expect(css).toContain('.mob-btn-full');
    expect(css).toContain('.mob-hero-heading');
    expect(css).toContain('.mob-hide');
    expect(css).toContain('.mob-show');
    expect(css).toContain('.mob-profile-img');
    expect(css).toContain('.mob-profile-text');
  });
});

describe('Email Builder Module - setViewMode()', () => {
  beforeEach(() => {
    resetBuilder();
  });

  test('setViewMode("mobile") constrains canvas width', () => {
    emailBuilder.setViewMode('mobile', null);
    expect(emailBuilder.viewMode).toBe('mobile');
    expect(emailBuilder.canvas.style.maxWidth).toBe('375px');
    expect(emailBuilder.canvas.style.margin).toMatch(/0(px)? auto/);
  });

  test('setViewMode("desktop") resets canvas width', () => {
    emailBuilder.setViewMode('mobile', null);
    emailBuilder.setViewMode('desktop', null);
    expect(emailBuilder.viewMode).toBe('desktop');
    expect(emailBuilder.canvas.style.maxWidth).toBe('600px');
  });
});

describe('Email Builder Module - showEmptyState()', () => {
  beforeEach(() => {
    resetBuilder();
  });

  test('showEmptyState renders empty state message', () => {
    emailBuilder.showEmptyState();
    expect(emailBuilder.canvas.innerHTML).toContain('Drag blocks from the left panel');
    expect(emailBuilder.canvas.querySelector('.text-center')).not.toBeNull();
  });
});

describe('Email Builder Module - getStatusBadge()', () => {
  test('returns correct badge for Sent', () => {
    const badge = emailBuilder.getStatusBadge('Sent');
    expect(badge).toContain('bg-success');
    expect(badge).toContain('Sent');
  });

  test('returns correct badge for Scheduled', () => {
    const badge = emailBuilder.getStatusBadge('Scheduled');
    expect(badge).toContain('bg-primary');
    expect(badge).toContain('Scheduled');
  });

  test('returns correct badge for Draft', () => {
    const badge = emailBuilder.getStatusBadge('Draft');
    expect(badge).toContain('bg-secondary');
    expect(badge).toContain('Draft');
  });

  test('returns correct badge for Failed', () => {
    const badge = emailBuilder.getStatusBadge('Failed');
    expect(badge).toContain('bg-danger');
    expect(badge).toContain('Failed');
  });

  test('returns correct badge for Cancelled', () => {
    const badge = emailBuilder.getStatusBadge('Cancelled');
    expect(badge).toContain('bg-danger');
    expect(badge).toContain('Cancelled');
  });

  test('returns correct badge for Sending', () => {
    const badge = emailBuilder.getStatusBadge('Sending');
    expect(badge).toContain('bg-warning');
    expect(badge).toContain('Sending');
  });

  test('returns escaped fallback for unknown status', () => {
    const badge = emailBuilder.getStatusBadge('CustomStatus');
    expect(badge).toContain('bg-secondary');
    expect(badge).toContain('CustomStatus');
  });

  test('handles null/undefined status', () => {
    const badge = emailBuilder.getStatusBadge(null);
    expect(badge).toContain('Unknown');
  });
});

describe('Email Builder Module - getRecipientStatusBadge()', () => {
  test('returns correct badge for delivered', () => {
    expect(emailBuilder.getRecipientStatusBadge('delivered')).toContain('bg-success');
  });

  test('returns correct badge for bounced', () => {
    expect(emailBuilder.getRecipientStatusBadge('bounced')).toContain('bg-danger');
  });

  test('returns correct badge for opened', () => {
    expect(emailBuilder.getRecipientStatusBadge('opened')).toContain('bg-primary');
  });

  test('returns correct badge for clicked', () => {
    expect(emailBuilder.getRecipientStatusBadge('clicked')).toContain('bg-warning');
  });

  test('returns fallback for unknown status', () => {
    const badge = emailBuilder.getRecipientStatusBadge('something-else');
    expect(badge).toContain('bg-secondary');
    expect(badge).toContain('something-else');
  });
});

describe('Email Builder Module - generateBadge()', () => {
  test('generates winner badge', () => {
    const badge = emailBuilder.generateBadge('winner');
    expect(badge).toContain('WINNER');
    expect(badge).toContain('#FFD700');
    expect(badge).toContain(String(new Date().getFullYear()));
    expect(badge).toContain('British Trade Awards');
  });

  test('generates nominee badge', () => {
    const badge = emailBuilder.generateBadge('nominee');
    expect(badge).toContain('NOMINEE');
    expect(badge).toContain('#C0C0C0');
    expect(badge).toContain(String(new Date().getFullYear()));
    expect(badge).toContain('British Trade Awards');
  });
});

describe('Email Builder Module - updateSubjectCounter()', () => {
  beforeEach(() => {
    resetBuilder();
    // Ensure the counter element exists (setupSubjectLineCounter creates it)
    let counter = document.getElementById('subjectCharCounter');
    if (!counter) {
      counter = document.createElement('div');
      counter.id = 'subjectCharCounter';
      document.getElementById('builderSubject').parentElement.appendChild(counter);
    }
  });

  test('shows 0 characters for empty subject', () => {
    document.getElementById('builderSubject').value = '';
    emailBuilder.updateSubjectCounter();
    const counter = document.getElementById('subjectCharCounter');
    expect(counter.textContent).toContain('0 characters');
  });

  test('shows Good length for mobile for short subjects (1-41 chars)', () => {
    document.getElementById('builderSubject').value = 'Short subject';
    emailBuilder.updateSubjectCounter();
    const counter = document.getElementById('subjectCharCounter');
    expect(counter.textContent).toContain('Good length for mobile');
    // JSDOM normalises hex to rgb, so check for either format
    expect(counter.style.color).toMatch(/#198754|rgb\(25, 135, 84\)/);
  });

  test('shows Good length for medium subjects (42-60 chars)', () => {
    document.getElementById('builderSubject').value = 'A medium length subject line that is just right!';
    emailBuilder.updateSubjectCounter();
    const counter = document.getElementById('subjectCharCounter');
    expect(counter.textContent).toContain('Good length');
    expect(counter.style.color).toMatch(/#0d6efd|rgb\(13, 110, 253\)/);
  });

  test('shows truncation warning for long subjects (61-80 chars)', () => {
    // Exactly 70 characters to land in the 61-80 range
    document.getElementById('builderSubject').value = 'A somewhat longer subject line that will probably be truncated mobile!';
    emailBuilder.updateSubjectCounter();
    const counter = document.getElementById('subjectCharCounter');
    expect(counter.textContent).toContain('May be truncated on mobile');
    expect(counter.style.color).toMatch(/#fd7e14|rgb\(253, 126, 20\)/);
  });

  test('shows too long warning for very long subjects (>80 chars)', () => {
    document.getElementById('builderSubject').value = 'A'.repeat(81);
    emailBuilder.updateSubjectCounter();
    const counter = document.getElementById('subjectCharCounter');
    expect(counter.textContent).toContain('Too long, will be truncated');
    expect(counter.style.color).toMatch(/#dc3545|rgb\(220, 53, 69\)/);
  });
});

describe('Email Builder Module - markUnsavedChanges()', () => {
  test('sets hasUnsavedChanges to true', () => {
    emailBuilder.hasUnsavedChanges = false;
    emailBuilder.markUnsavedChanges();
    expect(emailBuilder.hasUnsavedChanges).toBe(true);
  });
});

describe('Email Builder Module - _syncBlocksFromDOM()', () => {
  beforeEach(() => {
    resetBuilder();
  });

  test('syncs blocks array to match DOM order', () => {
    emailBuilder.addBlock('header');
    emailBuilder.addBlock('text');
    emailBuilder.addBlock('footer');

    // Manually rearrange DOM
    const wrappers = emailBuilder.canvas.querySelectorAll('.email-block-wrapper');
    emailBuilder.canvas.appendChild(wrappers[0]); // Move header to end

    emailBuilder._syncBlocksFromDOM();
    expect(emailBuilder.blocks[0].type).toBe('text');
    expect(emailBuilder.blocks[1].type).toBe('footer');
    expect(emailBuilder.blocks[2].type).toBe('header');
  });
});

describe('Email Builder Module - setBlockBackground()', () => {
  beforeEach(() => {
    resetBuilder();
  });

  test('sets background colour on the block table and td', () => {
    emailBuilder.addBlock('text');
    const blockId = emailBuilder.blocks[0].id;
    emailBuilder.setBlockBackground(blockId, '#ff0000');

    const wrapper = document.querySelector(`[data-block-id="${blockId}"]`);
    const table = wrapper.querySelector('table[role="presentation"]');
    expect(table.style.backgroundColor).toMatch(/#ff0000|rgb\(255, 0, 0\)/);
    const td = table.querySelector('td');
    expect(td.style.backgroundColor).toMatch(/#ff0000|rgb\(255, 0, 0\)/);
  });

  test('does nothing for non-existent block', () => {
    // Should not throw
    emailBuilder.setBlockBackground('fake-id', '#ff0000');
  });
});

describe('Email Builder Module - saveUndoState()', () => {
  beforeEach(() => {
    resetBuilder();
  });

  test('pushes current state onto undo stack', () => {
    emailBuilder.canvas.innerHTML = '<div>State A</div>';
    emailBuilder.blocks = [{ id: 'a', type: 'text' }];
    emailBuilder.saveUndoState();

    expect(emailBuilder.undoStack.length).toBe(1);
    expect(emailBuilder.undoStack[0].canvasHTML).toBe('<div>State A</div>');
    expect(emailBuilder.undoStack[0].blocks).toEqual([{ id: 'a', type: 'text' }]);
  });

  test('clears redo stack on new action', () => {
    emailBuilder.redoStack = [{ canvasHTML: '', blocks: [] }];
    emailBuilder.saveUndoState();
    expect(emailBuilder.redoStack.length).toBe(0);
  });

  test('shifts oldest entry when exceeding maxUndoSteps', () => {
    emailBuilder.maxUndoSteps = 2;
    emailBuilder.saveUndoState();
    emailBuilder.saveUndoState();
    emailBuilder.saveUndoState();
    expect(emailBuilder.undoStack.length).toBe(2);
    emailBuilder.maxUndoSteps = 30;
  });
});

describe('Email Builder Module - toggleScheduler()', () => {
  beforeEach(() => {
    resetBuilder();
    document.getElementById('scheduleOptions').style.display = 'none';
    document.getElementById('btnSendCampaign').style.display = '';
    document.getElementById('btnScheduleCampaign').style.display = 'none';
  });

  test('shows schedule options when scheduled mode is checked', () => {
    document.getElementById('sendModeScheduled').checked = true;
    emailBuilder.toggleScheduler();
    expect(document.getElementById('scheduleOptions').style.display).toBe('block');
    expect(document.getElementById('btnSendCampaign').style.display).toBe('none');
    expect(document.getElementById('btnScheduleCampaign').style.display).toBe('');
  });

  test('hides schedule options when send now mode is selected', () => {
    document.getElementById('sendModeScheduled').checked = false;
    emailBuilder.toggleScheduler();
    expect(document.getElementById('scheduleOptions').style.display).toBe('none');
    expect(document.getElementById('btnSendCampaign').style.display).toBe('');
    expect(document.getElementById('btnScheduleCampaign').style.display).toBe('none');
  });
});

describe('Email Builder Module - toggleABTest()', () => {
  beforeEach(() => {
    resetBuilder();
    document.getElementById('abTestToggle').checked = false;
    document.getElementById('abTestSection').style.display = 'none';
    document.getElementById('btnABCampaign').style.display = 'none';
  });

  test('shows A/B test section when toggle is checked', () => {
    document.getElementById('abTestToggle').checked = true;
    emailBuilder.toggleABTest();
    expect(emailBuilder.abTestEnabled).toBe(true);
    expect(document.getElementById('abTestSection').style.display).toBe('block');
    expect(document.getElementById('btnABCampaign').style.display).toBe('');
  });

  test('hides A/B test section when toggle is unchecked', () => {
    document.getElementById('abTestToggle').checked = false;
    emailBuilder.toggleABTest();
    expect(emailBuilder.abTestEnabled).toBe(false);
    expect(document.getElementById('abTestSection').style.display).toBe('none');
    expect(document.getElementById('btnABCampaign').style.display).toBe('none');
  });
});

describe('Email Builder Module - updateSchedulePreview()', () => {
  beforeEach(() => {
    resetBuilder();
    document.getElementById('schedulePreview').innerHTML = '';
  });

  test('shows formatted date/time when both are set', () => {
    document.getElementById('builderScheduleDate').value = '2026-03-15';
    document.getElementById('builderScheduleTime').value = '14:30';
    emailBuilder.updateSchedulePreview();
    const preview = document.getElementById('schedulePreview');
    expect(preview.innerHTML).toContain('Will send:');
  });

  test('shows nothing when date or time is missing', () => {
    document.getElementById('builderScheduleDate').value = '';
    document.getElementById('builderScheduleTime').value = '';
    emailBuilder.updateSchedulePreview();
    const preview = document.getElementById('schedulePreview');
    expect(preview.textContent).toBe('');
  });
});

describe('Email Builder Module - searchCampaigns()', () => {
  test('sets campaignLogSearch and resets page to 0', () => {
    emailBuilder.campaignLogPage = 5;
    emailBuilder.campaignLogSearch = '';
    emailBuilder.searchCampaigns('test query');
    expect(emailBuilder.campaignLogSearch).toBe('test query');
    expect(emailBuilder.campaignLogPage).toBe(0);
  });
});

describe('Email Builder Module - renderCampaignPagination()', () => {
  beforeEach(() => {
    resetBuilder();
  });

  test('shows simple count when only one page', () => {
    emailBuilder.campaignLogTotal = 5;
    emailBuilder.campaignLogPageSize = 20;
    emailBuilder.renderCampaignPagination();
    const container = document.getElementById('campaignLogPagination');
    expect(container.innerHTML).toContain('5 campaigns');
  });

  test('uses singular form for 1 campaign', () => {
    emailBuilder.campaignLogTotal = 1;
    emailBuilder.campaignLogPageSize = 20;
    emailBuilder.renderCampaignPagination();
    const container = document.getElementById('campaignLogPagination');
    expect(container.innerHTML).toContain('1 campaign');
    expect(container.innerHTML).not.toContain('1 campaigns');
  });

  test('renders pagination buttons when multiple pages exist', () => {
    emailBuilder.campaignLogTotal = 50;
    emailBuilder.campaignLogPageSize = 20;
    emailBuilder.campaignLogPage = 0;
    emailBuilder.renderCampaignPagination();
    const container = document.getElementById('campaignLogPagination');
    expect(container.innerHTML).toContain('1-20 of 50');
    expect(container.innerHTML).toContain('1 / 3');
  });
});

describe('Email Builder Module - setPromotionMode()', () => {
  beforeEach(() => {
    resetBuilder();
  });

  test('switches to winner mode', () => {
    emailBuilder.setPromotionMode('winner');
    expect(emailBuilder.promotionMode).toBe('winner');
  });

  test('switches to nominee mode', () => {
    emailBuilder.promotionMode = 'winner';
    emailBuilder.setPromotionMode('nominee');
    expect(emailBuilder.promotionMode).toBe('nominee');
  });
});

describe('Email Builder Module - autosaveToLocalStorage() / recoverAutosave()', () => {
  beforeEach(() => {
    resetBuilder();
    localStorage.removeItem('emailBuilder_autosave');
  });

  test('saves state to localStorage', () => {
    document.getElementById('builderCampaignName').value = 'Test Campaign';
    document.getElementById('builderSubject').value = 'Test Subject';
    emailBuilder.canvas.innerHTML = '<div>Test content</div>';
    emailBuilder.blocks = [{ id: 'b1', type: 'text' }];

    emailBuilder.autosaveToLocalStorage();

    const saved = JSON.parse(localStorage.getItem('emailBuilder_autosave'));
    expect(saved).not.toBeNull();
    expect(saved.campaignName).toBe('Test Campaign');
    expect(saved.subject).toBe('Test Subject');
    expect(saved.canvasHTML).toBe('<div>Test content</div>');
    expect(saved.blocks).toEqual([{ id: 'b1', type: 'text' }]);
    expect(saved.timestamp).toBeDefined();
  });

  test('recoverAutosave restores saved state', () => {
    const state = {
      timestamp: Date.now(),
      campaignName: 'Recovered Campaign',
      subject: 'Recovered Subject',
      preheader: 'Recovered Preheader',
      canvasHTML: '<div class="recovered">content</div>',
      blocks: [{ id: 'r1', type: 'header' }]
    };
    localStorage.setItem('emailBuilder_autosave', JSON.stringify(state));

    emailBuilder.recoverAutosave();

    expect(document.getElementById('builderCampaignName').value).toBe('Recovered Campaign');
    expect(document.getElementById('builderSubject').value).toBe('Recovered Subject');
    expect(document.getElementById('builderPreheader').value).toBe('Recovered Preheader');
    expect(emailBuilder.blocks).toEqual([{ id: 'r1', type: 'header' }]);
    expect(localStorage.getItem('emailBuilder_autosave')).toBeNull();
  });
});

describe('Email Builder Module - Edge Cases', () => {
  beforeEach(() => {
    resetBuilder();
  });

  test('addBlock then deleteBlock leaves canvas empty with empty state', () => {
    emailBuilder.addBlock('text');
    emailBuilder.deleteBlock(emailBuilder.blocks[0].id);
    expect(emailBuilder.blocks.length).toBe(0);
    expect(emailBuilder.canvas.innerHTML).toContain('Drag blocks');
  });

  test('generateFullHTML with no blocks produces valid HTML', () => {
    const html = emailBuilder.generateFullHTML();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
    // No block content but the wrapper tables should still exist
    expect(html).toContain('email-container');
  });

  test('company-profile with org that has no website or region', () => {
    emailBuilder.currentOrg = {
      company_name: 'Minimal Corp',
      logo_url: null,
      website: null,
      region: null
    };
    const html = emailBuilder.getBlockHTML('company-profile', 'test-id');
    expect(html).toContain('Minimal Corp');
    // Should have a grey placeholder instead of an img
    expect(html).toContain('background: #dee2e6');
    // Should not contain website link or region
    expect(html).not.toContain('<a href=');
  });

  test('award-list with empty awards array shows placeholder', () => {
    emailBuilder.currentOrg = { company_name: 'Test', awards: [] };
    const html = emailBuilder.getBlockHTML('award-list', 'test-id');
    expect(html).toContain('Select an organisation to view award history');
  });

  test('getBlockHTML handles all known block types without errors', () => {
    const types = [
      'header', 'hero', 'text', 'company-profile', 'award-list',
      'button', 'image', 'video', 'countdown', 'divider',
      'social-links', 'richtext', 'html-code', 'footer'
    ];
    types.forEach(type => {
      expect(() => emailBuilder.getBlockHTML(type, `test-${type}`)).not.toThrow();
    });
  });

  test('rapid addBlock calls produce unique IDs', () => {
    for (let i = 0; i < 20; i++) {
      emailBuilder.addBlock('text');
    }
    const ids = emailBuilder.blocks.map(b => b.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(20);
  });

  test('multiple undo/redo cycles maintain consistency', () => {
    emailBuilder.addBlock('header');
    emailBuilder.addBlock('text');
    emailBuilder.addBlock('footer');
    expect(emailBuilder.blocks.length).toBe(3);

    emailBuilder.undo();
    emailBuilder.undo();
    expect(emailBuilder.blocks.length).toBe(1);

    emailBuilder.redo();
    expect(emailBuilder.blocks.length).toBe(2);

    emailBuilder.redo();
    expect(emailBuilder.blocks.length).toBe(3);
  });

  test('XSS in company name is escaped in company-profile block', () => {
    emailBuilder.currentOrg = {
      company_name: '<script>alert("xss")</script>',
      logo_url: null,
      website: null,
      region: null
    };
    const html = emailBuilder.getBlockHTML('company-profile', 'test-id');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
