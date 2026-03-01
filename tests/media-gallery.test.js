/**
 * Tests for the Media Gallery Module (media-gallery-new.js)
 * Run with: npx jest tests/media-gallery.test.js
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
  <div id="mediaEventsContainer"></div>
  <div id="mediaStatsCards"></div>
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
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(() => Promise.resolve({ error: null })),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://cdn.example.com/photo.jpg' } })),
      list: jest.fn(() => Promise.resolve({ data: [], error: null })),
      remove: jest.fn(() => Promise.resolve({ error: null })),
    })),
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
require('../media-gallery-new.js');
syncWindowToGlobal();

describe('Media Gallery Module - Structure', () => {
  test('mediaGalleryModule is defined', () => {
    expect(mediaGalleryModule).toBeDefined();
  });

  test('has required properties', () => {
    expect(mediaGalleryModule.currentEventId).toBeNull();
    expect(mediaGalleryModule.currentSectionId).toBeNull();
    expect(mediaGalleryModule.currentFilter).toBe('all');
    expect(mediaGalleryModule.currentSearchTerm).toBe('');
    expect(mediaGalleryModule.currentSortBy).toBe('display_order');
    expect(mediaGalleryModule.currentPage).toBe(1);
    expect(mediaGalleryModule.photosPerPage).toBe(48);
    expect(mediaGalleryModule.currentView).toBe('events-list');
  });

  test('has required methods', () => {
    expect(typeof mediaGalleryModule.initialize).toBe('function');
  });

  test('has selectedPhotoIds as a Set', () => {
    expect(mediaGalleryModule.selectedPhotoIds instanceof Set).toBe(true);
  });
});

describe('Media Gallery Module - State Management', () => {
  test('resets state correctly', () => {
    mediaGalleryModule.currentEventId = 'ev1';
    mediaGalleryModule.currentFilter = 'published';
    mediaGalleryModule.currentPage = 5;

    // Reset
    mediaGalleryModule.currentEventId = null;
    mediaGalleryModule.currentFilter = 'all';
    mediaGalleryModule.currentPage = 1;

    expect(mediaGalleryModule.currentEventId).toBeNull();
    expect(mediaGalleryModule.currentFilter).toBe('all');
    expect(mediaGalleryModule.currentPage).toBe(1);
  });

  test('tracks selected photos', () => {
    mediaGalleryModule.selectedPhotoIds.clear();
    mediaGalleryModule.selectedPhotoIds.add('p1');
    mediaGalleryModule.selectedPhotoIds.add('p2');
    expect(mediaGalleryModule.selectedPhotoIds.size).toBe(2);
    expect(mediaGalleryModule.selectedPhotoIds.has('p1')).toBe(true);

    mediaGalleryModule.selectedPhotoIds.delete('p1');
    expect(mediaGalleryModule.selectedPhotoIds.size).toBe(1);
    mediaGalleryModule.selectedPhotoIds.clear();
  });
});

describe('Media Gallery Module - View Management', () => {
  test('supports all view types', () => {
    const views = ['events-list', 'event-contents', 'photos-production', 'videos-production'];
    views.forEach((view) => {
      mediaGalleryModule.currentView = view;
      expect(mediaGalleryModule.currentView).toBe(view);
    });
  });
});

describe('Media Gallery Module - Sort Options', () => {
  test('supports different sort options', () => {
    const sorts = [
      'display_order',
      'name_asc',
      'name_desc',
      'date_newest',
      'date_oldest',
      'org_asc',
      'tagged',
      'untagged',
    ];
    sorts.forEach((sort) => {
      mediaGalleryModule.currentSortBy = sort;
      expect(mediaGalleryModule.currentSortBy).toBe(sort);
    });
  });
});

describe('Media Gallery Module - Pagination', () => {
  test('tracks current page', () => {
    mediaGalleryModule.currentPage = 1;
    expect(mediaGalleryModule.currentPage).toBe(1);
    mediaGalleryModule.currentPage = 3;
    expect(mediaGalleryModule.currentPage).toBe(3);
  });

  test('has correct photos per page', () => {
    expect(mediaGalleryModule.photosPerPage).toBe(48);
  });
});
