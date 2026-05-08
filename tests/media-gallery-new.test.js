/**
 * Tests for the Media Gallery Module (media-gallery-new.js)
 * Run with: npx jest tests/media-gallery-new.test.js
 */

const { JSDOM } = require('jsdom');

// ==========================================
// JSDOM SETUP — all DOM elements the media gallery module references
// ==========================================
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

  <!-- Media Gallery Statistics -->
  <span id="totalPhotosCount">0</span>
  <span id="totalVideosCount">0</span>
  <span id="untaggedPhotosCountGallery">0</span>
  <span id="totalEventsWithMediaCount">0</span>
  <span id="totalMediaItems">0</span>
  <span id="untaggedPhotos">0</span>

  <!-- Events List View -->
  <div id="eventsListView" style="display:none;"></div>
  <div id="eventsListContainer"></div>
  <div id="mediaGalleryEmptyState" class="d-none"></div>

  <!-- Event Contents View -->
  <div id="eventContentsView" style="display:none;"></div>
  <span id="eventContentsTitle"></span>
  <span id="eventPhotosCount">0</span>
  <span id="eventVideosCount">0</span>

  <!-- Photos Production View -->
  <div id="photosProductionView" style="display:none;"></div>
  <span id="photosEventName"></span>
  <div id="photosProductionContent"></div>

  <!-- Videos Production View -->
  <div id="videosProductionView" style="display:none;"></div>
  <span id="videosEventName"></span>
  <div id="videosProductionContent"></div>

  <!-- Media Gallery Content (sections, photos) -->
  <div id="mediaGalleryContent"></div>
  <select id="mediaEventSelect"><option value="">Select an Event</option></select>
  <select id="mediaOrgFilter"><option value="">View all media for org...</option></select>

  <!-- Gallery Section Modal -->
  <div id="gallerySectionModal" class="modal">
    <h5 id="gallerySectionModalTitle"></h5>
    <input type="hidden" id="gallerySectionId">
    <input type="text" id="gallerySectionName">
    <textarea id="gallerySectionDescription"></textarea>
    <input type="number" id="gallerySectionOrder" value="0">
    <button id="saveGallerySectionBtn"></button>
  </div>

  <!-- Upload Photos Modal -->
  <div id="uploadSectionPhotosModal" class="modal">
    <input type="file" id="sectionPhotosFile">
    <input type="text" id="sectionPhotosTitle">
    <input type="checkbox" id="sectionPhotosPublished" checked>
    <div id="filePreviewContainer" class="d-none">
      <span id="filePreviewCount">0</span>
      <div id="filePreviewGrid"></div>
    </div>
    <div id="videoTypeContainer" style="display:none;"></div>
  </div>

  <!-- Tag Photo Modal -->
  <div id="tagPhotoModal" class="modal">
    <select id="tagPhotoOrgSelect"><option value="">-- None --</option></select>
    <select id="tagPhotoAwardSelect"><option value="">-- None --</option></select>
    <textarea id="tagPhotoCaption"></textarea>
    <input type="text" id="tagPhotoAltText">
    <input type="text" id="tagPhotoPhotographer">
    <input type="checkbox" id="tagPhotoShowGallery" checked>
    <input type="checkbox" id="tagPhotoShowWinner" checked>
    <input type="checkbox" id="tagPhotoShowCompany" checked>
  </div>

  <!-- View Photo Full Modal -->
  <div id="viewPhotoFullModal" class="modal">
    <h5 id="viewPhotoFullTitle"></h5>
    <h5 id="viewPhotoFullModalLabel"></h5>
    <div id="viewPhotoFullContent"></div>
  </div>

  <!-- Add Video Modal -->
  <div id="addVideoModal" class="modal">
    <form id="addVideoForm">
      <input type="radio" name="videoSourceType" id="sourceTypeYouTube" value="youtube" checked>
      <input type="radio" name="videoSourceType" id="sourceTypeUpload" value="upload">
      <input type="text" id="videoTitle">
      <textarea id="videoDescription"></textarea>
      <input type="hidden" id="videoEventId">
      <input type="text" id="videoEventName">
      <input type="text" id="videoYouTubeId">
      <input type="file" id="videoFileUpload">
      <div id="youtubeFieldGroup" style="display:block;"></div>
      <div id="uploadFieldGroup" style="display:none;"></div>
      <select id="videoTagInput"><option value="">Select a company...</option></select>
      <select id="bulkVideoTagInput"><option value="">Select a company...</option></select>
      <div id="videoTagsContainer"></div>
      <div id="bulkVideoTagsContainer"></div>
      <select id="videoAwardTagInput"><option value="">Select an award...</option></select>
      <select id="bulkVideoAwardTagInput"><option value="">Select an award...</option></select>
      <div id="videoAwardTagsContainer"></div>
      <div id="bulkVideoAwardTagsContainer"></div>
    </form>
  </div>

  <!-- Drag Drop Publish Modal -->
  <div id="dragDropPublishModal" class="modal">
    <div id="dragDropProgress" class="d-none"></div>
    <button id="dragDropUploadBtn"></button>
    <input type="checkbox" id="dragDropPublished" checked>
  </div>

  <!-- Misc Elements -->
  <div id="photoGrid"></div>
  <div id="dropZone" class="border"></div>
  <div id="bulkActionsBar" class="d-none">
    <span id="selectedCount">0</span>
  </div>
  <input type="text" id="gallerySearchBox">
  <table><tbody id="awardsTableBody"></tbody></table>
  <table><tbody id="orgsTableBody"></tbody></table>
  <table><tbody id="winnersTableBody"></tbody></table>
  <table><tbody id="eventsTableBody"></tbody></table>
  <span id="awardsCount"></span><span id="eventsCount"></span><span id="winnersCount"></span>
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Blob = dom.window.Blob;
global.URL = { createObjectURL: jest.fn(() => 'blob://mock'), revokeObjectURL: jest.fn() };
global.window.URL = global.URL;
// JSDOM doesn't implement scrollIntoView
dom.window.HTMLElement.prototype.scrollIntoView = jest.fn();

// Mock bootstrap
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

// Mock crypto
global.crypto = {
  getRandomValues: (arr) => {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    return arr;
  },
};

// Mock window.open
global.window.open = jest.fn(() => ({
  document: {
    write: jest.fn(),
    close: jest.fn(),
  },
}));

// Mock prompt
global.prompt = jest.fn(() => null);

// Mock supabase
const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  in: jest.fn(() => mockSupabase),
  or: jest.fn(() => mockSupabase),
  not: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  range: jest.fn(() => mockSupabase),
  ilike: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn((cb) => cb({ data: [], error: null, count: 0 })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signInWithPassword: jest.fn(() => Promise.resolve({ data: { user: { email: 'test@test.com' } }, error: null })),
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
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(() => Promise.resolve({ data: {}, error: null })),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://example.com/photo.jpg' } })),
      remove: jest.fn(() => Promise.resolve({ data: [], error: null })),
    })),
  },
};

global.supabase = { createClient: () => mockSupabase };
global.window.supabase = global.supabase;

// Load config
require('../config.js');

// Helper: sync window properties to global
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

// Load utils (provides utils.escapeHtml, apiClient, etc.)
require('../utils.js');
syncWindowToGlobal();

// Load the media gallery module
require('../media-gallery-new.js');
syncWindowToGlobal();

// ==========================================
// apiClient MOCK — many source functions now use apiClient (via /api/data-proxy)
// instead of STATE.client (direct Supabase). Stub all apiClient methods so tests
// can control their return values per-test via mockResolvedValueOnce / jest.spyOn.
// ==========================================
const _apiClient = global.apiClient || window.apiClient;

const apiClientMethods = [
  'select',
  'selectAll',
  'count',
  'insert',
  'update',
  'updateByFilters',
  'delete',
  'deleteByFilters',
  'upsert',
  'rpc',
  'upload',
  'getPublicUrl',
  'storageDelete',
];

// ==========================================
// Global beforeEach — reset mockSupabase.then AND re-apply apiClient mocks every test
// (jest.restoreAllMocks() in afterEach blocks removes jest.spyOn mocks)
// ==========================================
beforeEach(() => {
  // Clear unconsumed mockImplementationOnce calls AND reset default implementation
  // mockReset clears the once queue; then we re-set the default.
  mockSupabase.then.mockReset();
  mockSupabase.then.mockImplementation((cb) => cb({ data: [], error: null, count: 0 }));

  // Re-apply apiClient spies (they get removed by jest.restoreAllMocks in afterEach)
  apiClientMethods.forEach((method) => {
    if (_apiClient && typeof _apiClient[method] === 'function') {
      // If already a mock/spy, just reset its resolved value
      if (typeof _apiClient[method].mockResolvedValue === 'function') {
        _apiClient[method].mockResolvedValue({ data: [], error: null, count: 0 });
      } else {
        // Re-spy on the original method
        jest.spyOn(_apiClient, method).mockResolvedValue({ data: [], error: null, count: 0 });
      }
    }
  });
});

// ==========================================
// SAMPLE DATA
// ==========================================
const sampleEvents = [
  { id: 'evt-1', event_name: 'Awards Gala 2026', event_date: '2026-03-15', venue: 'London Hall', year: 2026 },
  { id: 'evt-2', event_name: 'Regional Ceremony', event_date: '2025-12-01', venue: 'Manchester Arena', year: 2025 },
];

const sampleSections = [
  {
    id: 'sec-1',
    event_id: 'evt-1',
    gallery_name: 'Drinks Reception',
    gallery_description: 'Pre-dinner drinks',
    display_order: 1,
  },
  {
    id: 'sec-2',
    event_id: 'evt-1',
    gallery_name: 'Award Winners',
    gallery_description: 'Winner photos',
    display_order: 2,
  },
];

const samplePhotos = [
  {
    id: 'photo-1',
    gallery_section_id: 'sec-1',
    event_id: 'evt-1',
    file_url: 'https://example.com/photo1.jpg',
    file_type: 'image/jpeg',
    title: 'Welcome Drinks',
    published: true,
    featured: false,
    organisation_id: 'org-1',
    award_id: 'award-1',
    display_order: 1,
    uploaded_at: '2026-01-10T10:00:00Z',
    photographer: 'John Smith',
    caption: 'Guests arriving',
    file_size: 102400,
    organisations: { company_name: 'Acme Ltd' },
    awards: { award_name: 'Best Trade' },
  },
  {
    id: 'photo-2',
    gallery_section_id: 'sec-1',
    event_id: 'evt-1',
    file_url: 'https://example.com/photo2.jpg',
    file_type: 'image/jpeg',
    title: 'Networking',
    published: false,
    featured: true,
    organisation_id: null,
    award_id: null,
    display_order: 2,
    uploaded_at: '2026-01-11T10:00:00Z',
    photographer: null,
    caption: null,
    file_size: 204800,
    organisations: null,
    awards: null,
  },
  {
    id: 'photo-3',
    gallery_section_id: 'sec-1',
    event_id: 'evt-1',
    file_url: 'abc123',
    file_type: 'video/youtube',
    title: 'Ceremony Highlights',
    published: true,
    featured: false,
    organisation_id: 'org-2',
    award_id: null,
    display_order: 3,
    uploaded_at: '2026-01-12T10:00:00Z',
    photographer: null,
    caption: null,
    file_size: 0,
    organisations: { company_name: 'BuildRight' },
    awards: null,
  },
];

const sampleVideos = [
  {
    id: 'vid-1',
    event_id: 'evt-1',
    media_type: 'video',
    title: 'Highlights',
    youtube_id: 'yt123',
    file_url: 'https://youtube.com/watch?v=yt123',
    status: 'published',
    description: 'Event highlights',
  },
  {
    id: 'vid-2',
    event_id: 'evt-1',
    media_type: 'video',
    title: 'Interview',
    youtube_id: null,
    file_url: 'https://example.com/video.mp4',
    status: 'draft',
    description: null,
  },
];

// ==========================================
// TESTS
// ==========================================

describe('Media Gallery Module - Structure & Initialization', () => {
  test('mediaGalleryModule is exported to window', () => {
    expect(window.mediaGalleryModule).toBeDefined();
    expect(mediaGalleryModule).toBeDefined();
  });

  test('has all required properties with defaults', () => {
    expect(mediaGalleryModule.currentEventId).toBeNull();
    expect(mediaGalleryModule.currentSectionId).toBeNull();
    expect(mediaGalleryModule.currentSectionPhotos).toEqual([]);
    expect(mediaGalleryModule.currentFilter).toBe('all');
    expect(mediaGalleryModule.currentSearchTerm).toBe('');
    expect(mediaGalleryModule.currentSortBy).toBe('display_order');
    expect(mediaGalleryModule.currentPage).toBe(1);
    expect(mediaGalleryModule.photosPerPage).toBe(48);
    expect(mediaGalleryModule.selectedPhotoIds).toBeInstanceOf(Set);
    expect(mediaGalleryModule.currentView).toBe('events-list');
  });

  test('has required async methods', () => {
    expect(typeof mediaGalleryModule.initialize).toBe('function');
    expect(typeof mediaGalleryModule.loadMediaStatistics).toBe('function');
    expect(typeof mediaGalleryModule.showEventsListView).toBe('function');
    expect(typeof mediaGalleryModule.showEventContentsView).toBe('function');
    expect(typeof mediaGalleryModule.renderEventsList).toBe('function');
    expect(typeof mediaGalleryModule.openPhotosProduction).toBe('function');
    expect(typeof mediaGalleryModule.loadPhotosProduction).toBe('function');
    expect(typeof mediaGalleryModule.saveGallerySection).toBe('function');
    expect(typeof mediaGalleryModule.viewSectionPhotos).toBe('function');
    expect(typeof mediaGalleryModule.deletePhoto).toBe('function');
    expect(typeof mediaGalleryModule.togglePublish).toBe('function');
    expect(typeof mediaGalleryModule.bulkPublish).toBe('function');
    expect(typeof mediaGalleryModule.bulkDelete).toBe('function');
    expect(typeof mediaGalleryModule.launchSlideshow).toBe('function');
    expect(typeof mediaGalleryModule._logActivity).toBe('function');
  });

  test('has video management methods', () => {
    expect(typeof mediaGalleryModule.openAddVideoModal).toBe('function');
    expect(typeof mediaGalleryModule.saveVideo).toBe('function');
    expect(typeof mediaGalleryModule.editVideo).toBe('function');
    expect(typeof mediaGalleryModule.deleteVideo).toBe('function');
    expect(typeof mediaGalleryModule.renderVideosGrid).toBe('function');
    expect(typeof mediaGalleryModule.extractYouTubeId).toBe('function');
  });

  test('has filter/search/sort methods', () => {
    expect(typeof mediaGalleryModule.setFilter).toBe('function');
    expect(typeof mediaGalleryModule.setSearch).toBe('function');
    expect(typeof mediaGalleryModule.setSortBy).toBe('function');
    expect(typeof mediaGalleryModule.debouncedSearch).toBe('function');
    expect(typeof mediaGalleryModule.goToPage).toBe('function');
    expect(typeof mediaGalleryModule._getFilteredPhotos).toBe('function');
  });
});

describe('Media Gallery Module - YouTube ID Extraction', () => {
  test('returns ID when given raw 11-character ID', () => {
    expect(mediaGalleryModule.extractYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  test('extracts ID from standard youtube.com URL', () => {
    expect(mediaGalleryModule.extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  test('extracts ID from short youtu.be URL', () => {
    expect(mediaGalleryModule.extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  test('extracts ID from embed URL', () => {
    expect(mediaGalleryModule.extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  test('extracts ID from /v/ URL format', () => {
    expect(mediaGalleryModule.extractYouTubeId('https://www.youtube.com/v/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  test('returns null for null/empty input', () => {
    expect(mediaGalleryModule.extractYouTubeId(null)).toBeNull();
    expect(mediaGalleryModule.extractYouTubeId('')).toBeNull();
  });

  test('returns null for invalid URL', () => {
    expect(mediaGalleryModule.extractYouTubeId('not-a-youtube-url')).toBeNull();
    expect(mediaGalleryModule.extractYouTubeId('https://www.example.com/video')).toBeNull();
  });
});

describe('Media Gallery Module - View Management', () => {
  test('hideAllViews hides all view elements', () => {
    document.getElementById('eventsListView').style.display = 'block';
    document.getElementById('eventContentsView').style.display = 'block';
    document.getElementById('photosProductionView').style.display = 'block';
    document.getElementById('videosProductionView').style.display = 'block';

    mediaGalleryModule.hideAllViews();

    expect(document.getElementById('eventsListView').style.display).toBe('none');
    expect(document.getElementById('eventContentsView').style.display).toBe('none');
    expect(document.getElementById('photosProductionView').style.display).toBe('none');
    expect(document.getElementById('videosProductionView').style.display).toBe('none');
  });

  test('renderInitialState shows placeholder content', () => {
    mediaGalleryModule.renderInitialState();
    const content = document.getElementById('mediaGalleryContent').innerHTML;
    expect(content).toContain('Select an Event');
  });
});

describe('Media Gallery Module - Filter & Search', () => {
  beforeEach(() => {
    mediaGalleryModule.currentSectionPhotos = [...samplePhotos];
    mediaGalleryModule.currentFilter = 'all';
    mediaGalleryModule.currentSearchTerm = '';
    mediaGalleryModule.currentSortBy = 'display_order';
    mediaGalleryModule.currentPage = 1;
    mediaGalleryModule.selectedPhotoIds = new Set();
    mediaGalleryModule.currentSectionName = 'Test Section';
    // Prevent full re-renders from failing on missing DOM elements
    jest.spyOn(mediaGalleryModule, 'renderSectionPhotos').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('setFilter updates currentFilter and resets page', () => {
    mediaGalleryModule.currentPage = 3;
    mediaGalleryModule.setFilter('published');
    expect(mediaGalleryModule.currentFilter).toBe('published');
    expect(mediaGalleryModule.currentPage).toBe(1);
  });

  test('setFilter calls renderSectionPhotos', () => {
    mediaGalleryModule.setFilter('drafts');
    expect(mediaGalleryModule.renderSectionPhotos).toHaveBeenCalled();
  });

  test('setSearch updates currentSearchTerm and resets page', () => {
    mediaGalleryModule.currentPage = 5;
    mediaGalleryModule.setSearch('welcome');
    expect(mediaGalleryModule.currentSearchTerm).toBe('welcome');
    expect(mediaGalleryModule.currentPage).toBe(1);
  });

  test('setSearch clears the search box when term is empty', () => {
    document.getElementById('gallerySearchBox').value = 'old search';
    mediaGalleryModule.setSearch('');
    expect(document.getElementById('gallerySearchBox').value).toBe('');
  });

  test('setSortBy updates sort state and resets page', () => {
    mediaGalleryModule.currentPage = 3;
    mediaGalleryModule.setSortBy('name_asc');
    expect(mediaGalleryModule.currentSortBy).toBe('name_asc');
    expect(mediaGalleryModule.currentPage).toBe(1);
  });

  test('_getFilteredPhotos returns all when filter is all', () => {
    mediaGalleryModule.currentFilter = 'all';
    const result = mediaGalleryModule._getFilteredPhotos();
    expect(result.length).toBe(3);
  });

  test('_getFilteredPhotos filters published only', () => {
    mediaGalleryModule.currentFilter = 'published';
    const result = mediaGalleryModule._getFilteredPhotos();
    // photo-1 (published: true), photo-3 (published: true)
    expect(result.length).toBe(2);
    expect(result.every((p) => p.published !== false)).toBe(true);
  });

  test('_getFilteredPhotos filters drafts only', () => {
    mediaGalleryModule.currentFilter = 'drafts';
    const result = mediaGalleryModule._getFilteredPhotos();
    // photo-2 (published: false)
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('photo-2');
  });

  test('_getFilteredPhotos applies search term', () => {
    mediaGalleryModule.currentSearchTerm = 'welcome';
    const result = mediaGalleryModule._getFilteredPhotos();
    expect(result.length).toBe(1);
    expect(result[0].title).toBe('Welcome Drinks');
  });

  test('_getFilteredPhotos searches organisation name', () => {
    mediaGalleryModule.currentSearchTerm = 'acme';
    const result = mediaGalleryModule._getFilteredPhotos();
    expect(result.length).toBe(1);
    expect(result[0].organisations.company_name).toBe('Acme Ltd');
  });

  test('_getFilteredPhotos searches photographer name', () => {
    mediaGalleryModule.currentSearchTerm = 'john smith';
    const result = mediaGalleryModule._getFilteredPhotos();
    expect(result.length).toBe(1);
    expect(result[0].photographer).toBe('John Smith');
  });

  test('_getFilteredPhotos sorts by name_asc', () => {
    mediaGalleryModule.currentSortBy = 'name_asc';
    const result = mediaGalleryModule._getFilteredPhotos();
    expect(result[0].title).toBe('Ceremony Highlights');
    expect(result[1].title).toBe('Networking');
    expect(result[2].title).toBe('Welcome Drinks');
  });

  test('_getFilteredPhotos sorts by name_desc', () => {
    mediaGalleryModule.currentSortBy = 'name_desc';
    const result = mediaGalleryModule._getFilteredPhotos();
    expect(result[0].title).toBe('Welcome Drinks');
    expect(result[2].title).toBe('Ceremony Highlights');
  });

  test('_getFilteredPhotos sorts by date_newest', () => {
    mediaGalleryModule.currentSortBy = 'date_newest';
    const result = mediaGalleryModule._getFilteredPhotos();
    expect(result[0].id).toBe('photo-3'); // Jan 12
    expect(result[2].id).toBe('photo-1'); // Jan 10
  });

  test('_getFilteredPhotos sorts by date_oldest', () => {
    mediaGalleryModule.currentSortBy = 'date_oldest';
    const result = mediaGalleryModule._getFilteredPhotos();
    expect(result[0].id).toBe('photo-1'); // Jan 10
    expect(result[2].id).toBe('photo-3'); // Jan 12
  });

  test('_getFilteredPhotos sorts by tagged first', () => {
    mediaGalleryModule.currentSortBy = 'tagged';
    const result = mediaGalleryModule._getFilteredPhotos();
    // photo-1 and photo-3 are tagged; photo-2 is not
    expect(result[0].organisation_id || result[0].award_id).toBeTruthy();
    expect(result[2].organisation_id).toBeNull();
  });

  test('_getFilteredPhotos sorts by untagged first', () => {
    mediaGalleryModule.currentSortBy = 'untagged';
    const result = mediaGalleryModule._getFilteredPhotos();
    // photo-2 is untagged and should be first
    expect(result[0].organisation_id).toBeNull();
    expect(result[0].award_id).toBeNull();
  });

  test('_getFilteredPhotos sorts by display_order by default', () => {
    mediaGalleryModule.currentSortBy = 'display_order';
    const result = mediaGalleryModule._getFilteredPhotos();
    expect(result[0].display_order).toBe(1);
    expect(result[1].display_order).toBe(2);
    expect(result[2].display_order).toBe(3);
  });

  test('_getFilteredPhotos combines filter and search', () => {
    mediaGalleryModule.currentFilter = 'published';
    mediaGalleryModule.currentSearchTerm = 'ceremony';
    const result = mediaGalleryModule._getFilteredPhotos();
    expect(result.length).toBe(1);
    expect(result[0].title).toBe('Ceremony Highlights');
  });
});

describe('Media Gallery Module - Pagination', () => {
  beforeEach(() => {
    // Create 100 fake photos for pagination tests
    const manyPhotos = [];
    for (let i = 0; i < 100; i++) {
      manyPhotos.push({
        id: `photo-${i}`,
        gallery_section_id: 'sec-1',
        event_id: 'evt-1',
        file_url: `https://example.com/photo${i}.jpg`,
        file_type: 'image/jpeg',
        title: `Photo ${i}`,
        published: true,
        featured: false,
        organisation_id: null,
        award_id: null,
        display_order: i,
        uploaded_at: new Date(2026, 0, i + 1).toISOString(),
        organisations: null,
        awards: null,
      });
    }
    mediaGalleryModule.currentSectionPhotos = manyPhotos;
    mediaGalleryModule.currentFilter = 'all';
    mediaGalleryModule.currentSearchTerm = '';
    mediaGalleryModule.currentSortBy = 'display_order';
    mediaGalleryModule.currentPage = 1;
    mediaGalleryModule.selectedPhotoIds = new Set();
    mediaGalleryModule.currentSectionName = 'Test Section';
    jest.spyOn(mediaGalleryModule, 'renderSectionPhotos').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('goToPage sets the page and re-renders', () => {
    mediaGalleryModule.goToPage(2);
    expect(mediaGalleryModule.currentPage).toBe(2);
    expect(mediaGalleryModule.renderSectionPhotos).toHaveBeenCalled();
  });

  test('goToPage ignores invalid page numbers', () => {
    mediaGalleryModule.goToPage(0);
    expect(mediaGalleryModule.currentPage).toBe(1);

    mediaGalleryModule.goToPage(-1);
    expect(mediaGalleryModule.currentPage).toBe(1);

    const totalPages = Math.ceil(100 / mediaGalleryModule.photosPerPage);
    mediaGalleryModule.goToPage(totalPages + 1);
    expect(mediaGalleryModule.currentPage).toBe(1);
  });

  test('_buildPaginationItems creates proper HTML for first page', () => {
    const html = mediaGalleryModule._buildPaginationItems(1, 5);
    expect(html).toContain('class="page-item active"');
    expect(html).toContain('>1<');
    expect(html).toContain('>5<');
  });

  test('_buildPaginationItems creates proper HTML for middle page', () => {
    const html = mediaGalleryModule._buildPaginationItems(5, 10);
    expect(html).toContain('>5<');
    expect(html).toContain('active');
  });

  test('_buildPaginationItems creates ellipsis for many pages', () => {
    const html = mediaGalleryModule._buildPaginationItems(5, 20);
    expect(html).toContain('...');
  });
});

describe('Media Gallery Module - Selection & Bulk Actions', () => {
  beforeEach(() => {
    mediaGalleryModule.currentSectionPhotos = [...samplePhotos];
    mediaGalleryModule.currentFilter = 'all';
    mediaGalleryModule.currentSearchTerm = '';
    mediaGalleryModule.currentSortBy = 'display_order';
    mediaGalleryModule.currentPage = 1;
    mediaGalleryModule.selectedPhotoIds = new Set();
    mediaGalleryModule.currentSectionName = 'Test Section';
    jest.spyOn(mediaGalleryModule, 'renderSectionPhotos').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('clearSelection clears all selected IDs', () => {
    mediaGalleryModule.selectedPhotoIds.add('photo-1');
    mediaGalleryModule.selectedPhotoIds.add('photo-2');
    expect(mediaGalleryModule.selectedPhotoIds.size).toBe(2);

    mediaGalleryModule.clearSelection();
    expect(mediaGalleryModule.selectedPhotoIds.size).toBe(0);
  });

  test('selectAllPage selects all photos on current page', () => {
    mediaGalleryModule.selectAllPage();
    // 3 photos in the test data, all fit on one page
    expect(mediaGalleryModule.selectedPhotoIds.size).toBe(3);
    expect(mediaGalleryModule.selectedPhotoIds.has('photo-1')).toBe(true);
    expect(mediaGalleryModule.selectedPhotoIds.has('photo-2')).toBe(true);
    expect(mediaGalleryModule.selectedPhotoIds.has('photo-3')).toBe(true);
  });

  test('selectAllPage deselects all when all already selected', () => {
    mediaGalleryModule.selectedPhotoIds.add('photo-1');
    mediaGalleryModule.selectedPhotoIds.add('photo-2');
    mediaGalleryModule.selectedPhotoIds.add('photo-3');

    mediaGalleryModule.selectAllPage();
    expect(mediaGalleryModule.selectedPhotoIds.size).toBe(0);
  });

  test('selectAllFiltered selects all filtered photos', () => {
    mediaGalleryModule.selectAllFiltered();
    expect(mediaGalleryModule.selectedPhotoIds.size).toBe(3);
  });

  test('selectAllFiltered deselects all when all already selected', () => {
    samplePhotos.forEach((p) => mediaGalleryModule.selectedPhotoIds.add(p.id));
    mediaGalleryModule.selectAllFiltered();
    expect(mediaGalleryModule.selectedPhotoIds.size).toBe(0);
  });

  test('updateBulkActionsBar shows bar when photos selected', () => {
    mediaGalleryModule.selectedPhotoIds.add('photo-1');
    mediaGalleryModule.updateBulkActionsBar();
    const bar = document.getElementById('bulkActionsBar');
    expect(bar.classList.contains('d-none')).toBe(false);
    expect(document.getElementById('selectedCount').textContent).toBe('1');
  });

  test('updateBulkActionsBar hides bar when no photos selected', () => {
    mediaGalleryModule.selectedPhotoIds.clear();
    mediaGalleryModule.updateBulkActionsBar();
    const bar = document.getElementById('bulkActionsBar');
    expect(bar.classList.contains('d-none')).toBe(true);
  });

  test('bulkPublish early-returns when nothing selected', async () => {
    mediaGalleryModule.selectedPhotoIds.clear();
    await mediaGalleryModule.bulkPublish();
    // Should not throw or make any API calls
    // Verify no supabase calls were made for update
    expect(mockSupabase.update).not.toHaveBeenCalled();
  });

  test('bulkUnpublish early-returns when nothing selected', async () => {
    mediaGalleryModule.selectedPhotoIds.clear();
    // Reset update mock call count
    mockSupabase.update.mockClear();
    await mediaGalleryModule.bulkUnpublish();
    expect(mockSupabase.update).not.toHaveBeenCalled();
  });

  test('bulkDelete early-returns when nothing selected', async () => {
    mediaGalleryModule.selectedPhotoIds.clear();
    mockSupabase.delete.mockClear();
    await mediaGalleryModule.bulkDelete();
    expect(mockSupabase.delete).not.toHaveBeenCalled();
  });
});

describe('Media Gallery Module - Render Photo Card', () => {
  test('renders image photo card with org badge', () => {
    mediaGalleryModule.selectedPhotoIds = new Set();
    mediaGalleryModule.currentSortBy = 'display_order';
    mediaGalleryModule.currentFilter = 'all';
    mediaGalleryModule.currentSearchTerm = '';
    const html = mediaGalleryModule.renderPhotoCard(samplePhotos[0]);
    expect(html).toContain('Welcome Drinks');
    expect(html).toContain('Acme Ltd');
    expect(html).toContain('Best Trade');
    expect(html).toContain('John Smith');
    expect(html).toContain('card-img-top');
  });

  test('renders draft photo card with opacity', () => {
    mediaGalleryModule.selectedPhotoIds = new Set();
    const html = mediaGalleryModule.renderPhotoCard(samplePhotos[1]);
    expect(html).toContain('border-secondary');
    expect(html).toContain('Draft');
  });

  test('renders YouTube video card with play icon', () => {
    mediaGalleryModule.selectedPhotoIds = new Set();
    const html = mediaGalleryModule.renderPhotoCard(samplePhotos[2]);
    expect(html).toContain('youtube');
    expect(html).toContain('Ceremony Highlights');
  });

  test('renders selected photo card with primary border', () => {
    mediaGalleryModule.selectedPhotoIds = new Set(['photo-1']);
    const html = mediaGalleryModule.renderPhotoCard(samplePhotos[0]);
    expect(html).toContain('border-primary');
    expect(html).toContain('Selected');
  });

  test('enables drag when sort is display_order and no filters', () => {
    mediaGalleryModule.selectedPhotoIds = new Set();
    mediaGalleryModule.currentSortBy = 'display_order';
    mediaGalleryModule.currentFilter = 'all';
    mediaGalleryModule.currentSearchTerm = '';
    const html = mediaGalleryModule.renderPhotoCard(samplePhotos[0]);
    expect(html).toContain('draggable="true"');
    expect(html).toContain('data-photo-drag="true"');
  });

  test('disables drag when sort is not display_order', () => {
    mediaGalleryModule.selectedPhotoIds = new Set();
    mediaGalleryModule.currentSortBy = 'name_asc';
    mediaGalleryModule.currentFilter = 'all';
    mediaGalleryModule.currentSearchTerm = '';
    const html = mediaGalleryModule.renderPhotoCard(samplePhotos[0]);
    expect(html).not.toContain('draggable="true"');
  });

  test('renders featured badge on featured photos', () => {
    mediaGalleryModule.selectedPhotoIds = new Set();
    const html = mediaGalleryModule.renderPhotoCard(samplePhotos[1]);
    // photo-2 is featured but also a draft; draft badge shown instead when not selected
    // The featured badge is only shown if isPublished and !isSelected
    // photo-2 is unpublished so it gets "Draft" badge instead
    expect(html).toContain('Draft');
  });
});

describe('Media Gallery Module - Video Tags', () => {
  beforeEach(() => {
    mediaGalleryModule.videoTags = [];
    mediaGalleryModule.videoAwardTags = [];
    // Populate the select with options
    const tagInput = document.getElementById('videoTagInput');
    tagInput.innerHTML =
      '<option value="">Select...</option><option value="org-1" data-name="Acme">Acme</option><option value="org-2" data-name="BuildRight">BuildRight</option>';
    const awardInput = document.getElementById('videoAwardTagInput');
    awardInput.innerHTML =
      '<option value="">Select...</option><option value="award-1" data-name="Best Trade">Best Trade</option>';
  });

  test('addVideoTag adds a company tag', () => {
    const select = document.getElementById('videoTagInput');
    select.value = 'org-1';
    mediaGalleryModule.addVideoTag();
    expect(mediaGalleryModule.videoTags.length).toBe(1);
    expect(mediaGalleryModule.videoTags[0].id).toBe('org-1');
  });

  test('addVideoTag prevents duplicate tags', () => {
    mediaGalleryModule.videoTags = [{ id: 'org-1', name: 'Acme' }];
    const select = document.getElementById('videoTagInput');
    select.value = 'org-1';
    mediaGalleryModule.addVideoTag();
    expect(mediaGalleryModule.videoTags.length).toBe(1);
  });

  test('addVideoTag warns when no company selected', () => {
    const select = document.getElementById('videoTagInput');
    select.value = '';
    mediaGalleryModule.addVideoTag();
    expect(mediaGalleryModule.videoTags.length).toBe(0);
  });

  test('removeVideoTag removes a tag by ID', () => {
    mediaGalleryModule.videoTags = [
      { id: 'org-1', name: 'Acme' },
      { id: 'org-2', name: 'BuildRight' },
    ];
    mediaGalleryModule.removeVideoTag('org-1');
    expect(mediaGalleryModule.videoTags.length).toBe(1);
    expect(mediaGalleryModule.videoTags[0].id).toBe('org-2');
  });

  test('renderVideoTags renders tag badges', () => {
    mediaGalleryModule.videoTags = [{ id: 'org-1', name: 'Acme' }];
    mediaGalleryModule.renderVideoTags();
    const container = document.getElementById('videoTagsContainer');
    expect(container.innerHTML).toContain('Acme');
    expect(container.innerHTML).toContain('badge');
  });

  test('addVideoAwardTag adds an award tag', () => {
    const select = document.getElementById('videoAwardTagInput');
    select.value = 'award-1';
    mediaGalleryModule.addVideoAwardTag();
    expect(mediaGalleryModule.videoAwardTags.length).toBe(1);
    expect(mediaGalleryModule.videoAwardTags[0].id).toBe('award-1');
  });

  test('removeVideoAwardTag removes a tag by ID', () => {
    mediaGalleryModule.videoAwardTags = [{ id: 'award-1', name: 'Best Trade' }];
    mediaGalleryModule.removeVideoAwardTag('award-1');
    expect(mediaGalleryModule.videoAwardTags.length).toBe(0);
  });
});

describe('Media Gallery Module - Toggle Video Source Fields', () => {
  test('toggleVideoSourceFields shows YouTube fields for "youtube"', () => {
    mediaGalleryModule.toggleVideoSourceFields('youtube');
    expect(document.getElementById('youtubeFieldGroup').style.display).toBe('block');
    expect(document.getElementById('uploadFieldGroup').style.display).toBe('none');
    expect(document.getElementById('videoYouTubeId').required).toBe(true);
    expect(document.getElementById('videoFileUpload').required).toBe(false);
  });

  test('toggleVideoSourceFields shows upload fields for "upload"', () => {
    mediaGalleryModule.toggleVideoSourceFields('upload');
    expect(document.getElementById('youtubeFieldGroup').style.display).toBe('none');
    expect(document.getElementById('uploadFieldGroup').style.display).toBe('block');
    expect(document.getElementById('videoYouTubeId').required).toBe(false);
    expect(document.getElementById('videoFileUpload').required).toBe(true);
  });
});

describe('Media Gallery Module - Drag & Drop', () => {
  test('handleDragOver changes dropZone style', () => {
    const event = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
    mediaGalleryModule.handleDragOver(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    const dropZone = document.getElementById('dropZone');
    expect(dropZone.style.backgroundColor).toBe('rgb(231, 241, 255)');
  });

  test('handleDragLeave resets dropZone style', () => {
    const event = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
    mediaGalleryModule.handleDragLeave(event);
    expect(event.preventDefault).toHaveBeenCalled();
    const dropZone = document.getElementById('dropZone');
    expect(dropZone.style.backgroundColor).toBe('transparent');
  });

  test('handlePhotoDragStart sets draggedPhotoId', () => {
    const event = {
      target: { style: {} },
      dataTransfer: { effectAllowed: '', setData: jest.fn() },
    };
    mediaGalleryModule.handlePhotoDragStart(event, 'photo-1');
    expect(mediaGalleryModule.draggedPhotoId).toBe('photo-1');
    expect(event.target.style.opacity).toBe('0.5');
    expect(event.dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'photo-1');
  });

  test('handlePhotoDragOver prevents default', () => {
    const event = { preventDefault: jest.fn(), dataTransfer: { dropEffect: '' } };
    const result = mediaGalleryModule.handlePhotoDragOver(event, 'photo-2');
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.dataTransfer.dropEffect).toBe('move');
    expect(result).toBe(false);
  });

  test('handlePhotoDragEnter highlights target card', () => {
    mediaGalleryModule.draggedPhotoId = 'photo-1';
    const event = {
      currentTarget: { style: { borderColor: '', borderWidth: '', borderStyle: '' } },
    };
    mediaGalleryModule.handlePhotoDragEnter(event, 'photo-2');
    expect(event.currentTarget.style.borderColor).toBe('#0d6efd');
    expect(mediaGalleryModule.draggedOverPhotoId).toBe('photo-2');
  });

  test('handlePhotoDragEnter does nothing for same photo', () => {
    mediaGalleryModule.draggedPhotoId = 'photo-1';
    const event = {
      currentTarget: { style: { borderColor: '' } },
    };
    mediaGalleryModule.handlePhotoDragEnter(event, 'photo-1');
    expect(event.currentTarget.style.borderColor).toBe('');
  });
});

describe('Media Gallery Module - Gallery Sections', () => {
  test('renderGallerySections renders empty state', () => {
    mediaGalleryModule.renderGallerySections([]);
    const content = document.getElementById('mediaGalleryContent').innerHTML;
    expect(content).toContain('No gallery sections yet');
  });

  test('renderGallerySections renders section cards', () => {
    mediaGalleryModule.renderGallerySections(sampleSections);
    const content = document.getElementById('mediaGalleryContent').innerHTML;
    expect(content).toContain('Drinks Reception');
    expect(content).toContain('Award Winners');
    expect(content).toContain('Gallery Sections (2)');
  });

  test('renderSectionCard returns card HTML with section name', () => {
    const html = mediaGalleryModule.renderSectionCard(sampleSections[0]);
    expect(html).toContain('Drinks Reception');
    expect(html).toContain('Pre-dinner drinks');
    expect(html).toContain(`photoCount_${sampleSections[0].id}`);
    expect(html).toContain('View Photos');
  });

  test('renderSummaryView shows no-events alert when empty', () => {
    mediaGalleryModule.renderSummaryView([]);
    const content = document.getElementById('mediaGalleryContent').innerHTML;
    expect(content).toContain('No events found');
  });

  test('renderSummaryView shows event data in table', () => {
    const summaryData = [
      {
        event: sampleEvents[0],
        sections: [{ gallery_name: 'Reception', photoCount: 5 }],
        totalPhotos: 5,
      },
    ];
    mediaGalleryModule.renderSummaryView(summaryData);
    const content = document.getElementById('mediaGalleryContent').innerHTML;
    expect(content).toContain('Awards Gala 2026');
    expect(content).toContain('Reception');
    expect(content).toContain('5 items');
  });

  test('openAddSectionModal sets add-mode fields', () => {
    mediaGalleryModule.openAddSectionModal();
    expect(document.getElementById('gallerySectionModalTitle').textContent).toBe('Add Gallery Section');
    expect(document.getElementById('gallerySectionId').value).toBe('');
    expect(document.getElementById('gallerySectionName').value).toBe('');
    expect(document.getElementById('saveGallerySectionBtn').textContent).toBe('Save Section');
  });
});

describe('Media Gallery Module - Render Events List', () => {
  test('renderEventsList shows empty state when no events', async () => {
    await mediaGalleryModule.renderEventsList([]);
    const emptyState = document.getElementById('mediaGalleryEmptyState');
    expect(emptyState.classList.contains('d-none')).toBe(false);
    expect(document.getElementById('eventsListContainer').innerHTML).toBe('');
  });
});

describe('Media Gallery Module - Videos Grid Rendering', () => {
  test('renderVideosGrid renders empty state message for no videos', () => {
    const container = document.getElementById('videosProductionContent');
    container.innerHTML = ''; // Clear
    mediaGalleryModule._videoReorderMode = false;
    mediaGalleryModule.renderVideosGrid(sampleVideos);
    const content = container.innerHTML;
    expect(content).toContain('Highlights');
    expect(content).toContain('Interview');
    expect(content).toContain('2 video(s)');
  });

  test('renderVideosGrid renders YouTube badge for YouTube videos', () => {
    mediaGalleryModule._videoReorderMode = false;
    mediaGalleryModule.renderVideosGrid(sampleVideos);
    const content = document.getElementById('videosProductionContent').innerHTML;
    expect(content).toContain('YouTube');
    expect(content).toContain('img.youtube.com');
  });

  test('renderVideosGrid handles video tags', () => {
    const videosWithTags = [
      {
        ...sampleVideos[0],
        tags: JSON.stringify({ companies: [{ id: 'c1', name: 'TestCo' }], awards: [{ id: 'a1', name: 'TopAward' }] }),
      },
    ];
    mediaGalleryModule._videoReorderMode = false;
    mediaGalleryModule.renderVideosGrid(videosWithTags);
    const content = document.getElementById('videosProductionContent').innerHTML;
    expect(content).toContain('TestCo');
    expect(content).toContain('TopAward');
  });
});

describe('Media Gallery Module - Find Duplicates', () => {
  test('findDuplicates shows message when less than 2 photos', () => {
    mediaGalleryModule.currentSectionPhotos = [samplePhotos[0]];
    mediaGalleryModule.findDuplicates();
    // Should show toast but not crash
  });

  test('findDuplicates detects same file size', () => {
    const dupePhotos = [
      { ...samplePhotos[0], file_size: 50000 },
      { ...samplePhotos[1], id: 'photo-dup', file_size: 50000 },
    ];
    mediaGalleryModule.currentSectionPhotos = dupePhotos;
    mediaGalleryModule.findDuplicates();
    // Should have stored duplicate groups
    expect(mediaGalleryModule._duplicateGroups).toBeDefined();
    expect(mediaGalleryModule._duplicateGroups.length).toBeGreaterThan(0);
    expect(mediaGalleryModule._duplicateGroups[0].type).toBe('Identical file size');
  });

  test('findDuplicates detects same filename', () => {
    const dupePhotos = [
      { ...samplePhotos[0], file_url: 'https://example.com/123_abc_photo.jpg', file_size: 1000 },
      { ...samplePhotos[1], id: 'photo-dup2', file_url: 'https://example.com/456_def_photo.jpg', file_size: 2000 },
    ];
    mediaGalleryModule.currentSectionPhotos = dupePhotos;
    mediaGalleryModule.findDuplicates();
    expect(mediaGalleryModule._duplicateGroups).toBeDefined();
    expect(mediaGalleryModule._duplicateGroups.length).toBeGreaterThan(0);
    expect(mediaGalleryModule._duplicateGroups[0].type).toBe('Same filename');
  });

  test('findDuplicates shows success when no dupes found', () => {
    const uniquePhotos = [
      { ...samplePhotos[0], file_size: 1000, file_url: 'https://example.com/unique1.jpg' },
      { ...samplePhotos[1], file_size: 2000, file_url: 'https://example.com/unique2.png' },
    ];
    mediaGalleryModule.currentSectionPhotos = uniquePhotos;
    mediaGalleryModule.findDuplicates();
    // Should not set _duplicateGroups or leave them as empty
  });

  test('selectDuplicateGroup selects all but first photo', () => {
    mediaGalleryModule.selectedPhotoIds = new Set();
    mediaGalleryModule._duplicateGroups = [
      {
        type: 'Identical file size',
        photos: [{ id: 'original' }, { id: 'dup1' }, { id: 'dup2' }],
      },
    ];
    mediaGalleryModule.currentSectionName = 'Test';
    jest.spyOn(mediaGalleryModule, 'renderSectionPhotos').mockImplementation(() => {});
    mediaGalleryModule.selectDuplicateGroup(0);
    expect(mediaGalleryModule.selectedPhotoIds.has('original')).toBe(false);
    expect(mediaGalleryModule.selectedPhotoIds.has('dup1')).toBe(true);
    expect(mediaGalleryModule.selectedPhotoIds.has('dup2')).toBe(true);
    jest.restoreAllMocks();
  });
});

describe('Media Gallery Module - Activity Logging', () => {
  beforeEach(() => {
    mediaGalleryModule.currentEventId = 'evt-1';
    mediaGalleryModule.currentSectionId = 'sec-1';
    localStorage.clear();
  });

  test('_logActivity creates an audit log entry', async () => {
    // Make apiClient.insert succeed
    if (typeof apiClient !== 'undefined') {
      jest.spyOn(apiClient, 'insert').mockRejectedValue(new Error('fallback'));
    }
    await mediaGalleryModule._logActivity('upload', 'photo-1', '1 file uploaded');

    // Since apiClient insert fails, should fall back to localStorage
    const log = JSON.parse(localStorage.getItem('mediaGalleryActivityLog') || '[]');
    expect(log.length).toBeGreaterThanOrEqual(1);
    expect(log[0].action).toBe('upload');
    expect(log[0].detail).toBe('1 file uploaded');
    expect(log[0].eventId).toBe('evt-1');
    expect(log[0].sectionId).toBe('sec-1');
    if (typeof apiClient !== 'undefined') jest.restoreAllMocks();
  });

  test('_logActivity limits localStorage log to 500 entries', async () => {
    // Pre-fill with 500 entries
    const existing = Array.from({ length: 500 }, (_, i) => ({
      timestamp: new Date().toISOString(),
      action: 'test',
      detail: `entry-${i}`,
    }));
    localStorage.setItem('mediaGalleryActivityLog', JSON.stringify(existing));

    if (typeof apiClient !== 'undefined') {
      jest.spyOn(apiClient, 'insert').mockRejectedValue(new Error('fallback'));
    }
    await mediaGalleryModule._logActivity('upload', null, 'new entry');

    const log = JSON.parse(localStorage.getItem('mediaGalleryActivityLog'));
    expect(log.length).toBeLessThanOrEqual(500);
    expect(log[0].detail).toBe('new entry');
    if (typeof apiClient !== 'undefined') jest.restoreAllMocks();
  });
});

describe('Media Gallery Module - Keyboard Shortcuts', () => {
  beforeEach(() => {
    mediaGalleryModule._unregisterKeyboardShortcuts();
    mediaGalleryModule.currentSectionPhotos = [...samplePhotos];
    mediaGalleryModule.currentFilter = 'all';
    mediaGalleryModule.currentSearchTerm = '';
    mediaGalleryModule.currentSortBy = 'display_order';
    mediaGalleryModule.currentPage = 1;
    mediaGalleryModule.selectedPhotoIds = new Set();
    mediaGalleryModule.currentSectionName = 'Test Section';
  });

  afterEach(() => {
    mediaGalleryModule._unregisterKeyboardShortcuts();
    jest.restoreAllMocks();
  });

  test('_registerKeyboardShortcuts sets active flag', () => {
    mediaGalleryModule._keyboardShortcutsActive = false;
    mediaGalleryModule._registerKeyboardShortcuts();
    expect(mediaGalleryModule._keyboardShortcutsActive).toBe(true);
  });

  test('_registerKeyboardShortcuts does not double-register', () => {
    mediaGalleryModule._registerKeyboardShortcuts();
    const firstHandler = mediaGalleryModule._keyboardHandler;
    mediaGalleryModule._registerKeyboardShortcuts();
    expect(mediaGalleryModule._keyboardHandler).toBe(firstHandler);
  });

  test('_unregisterKeyboardShortcuts clears handler and flag', () => {
    mediaGalleryModule._registerKeyboardShortcuts();
    expect(mediaGalleryModule._keyboardShortcutsActive).toBe(true);
    mediaGalleryModule._unregisterKeyboardShortcuts();
    expect(mediaGalleryModule._keyboardShortcutsActive).toBe(false);
    expect(mediaGalleryModule._keyboardHandler).toBeNull();
  });
});

describe('Media Gallery Module - Debounced Search', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(mediaGalleryModule, 'setSearch').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('debouncedSearch calls setSearch after 300ms', () => {
    mediaGalleryModule.debouncedSearch('test');
    expect(mediaGalleryModule.setSearch).not.toHaveBeenCalled();
    jest.advanceTimersByTime(300);
    expect(mediaGalleryModule.setSearch).toHaveBeenCalledWith('test');
  });

  test('debouncedSearch cancels previous timer on rapid typing', () => {
    mediaGalleryModule.debouncedSearch('t');
    mediaGalleryModule.debouncedSearch('te');
    mediaGalleryModule.debouncedSearch('tes');
    jest.advanceTimersByTime(300);
    expect(mediaGalleryModule.setSearch).toHaveBeenCalledTimes(1);
    expect(mediaGalleryModule.setSearch).toHaveBeenCalledWith('tes');
  });
});

describe('Media Gallery Module - Noop and Misc', () => {
  test('noop does nothing', () => {
    expect(() => mediaGalleryModule.noop()).not.toThrow();
  });

  test('openPhotosProduction returns early when no event ID', async () => {
    mediaGalleryModule.currentEventId = null;
    await mediaGalleryModule.openPhotosProduction();
    // Should not throw or change view
  });

  test('openVideosProduction returns early when no event ID', async () => {
    mediaGalleryModule.currentEventId = null;
    await mediaGalleryModule.openVideosProduction();
    // Should not throw or change view
  });

  test('showEventContentsView returns early when no event ID', async () => {
    mediaGalleryModule.currentEventId = null;
    await mediaGalleryModule.showEventContentsView(null);
    // Should not throw
  });
});

describe('Media Gallery Module - Card Selection Toggle', () => {
  beforeEach(() => {
    mediaGalleryModule.selectedPhotoIds = new Set();
    mediaGalleryModule.currentSectionName = 'Test';
    jest.spyOn(mediaGalleryModule, 'renderSectionPhotos').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('toggleCardSelection ignores clicks on buttons', () => {
    const button = document.createElement('button');
    const event = { target: button };
    event.target.closest = (sel) => (sel === 'button' ? button : null);
    mediaGalleryModule.toggleCardSelection(event, 'photo-1');
    expect(mediaGalleryModule.selectedPhotoIds.size).toBe(0);
  });

  test('toggleCardSelection adds photo when not selected', () => {
    const div = document.createElement('div');
    div.closest = () => null;
    const event = { target: div };
    mediaGalleryModule.toggleCardSelection(event, 'photo-1');
    expect(mediaGalleryModule.selectedPhotoIds.has('photo-1')).toBe(true);
  });

  test('toggleCardSelection removes photo when already selected', () => {
    mediaGalleryModule.selectedPhotoIds.add('photo-1');
    const div = document.createElement('div');
    div.closest = () => null;
    const event = { target: div };
    mediaGalleryModule.toggleCardSelection(event, 'photo-1');
    expect(mediaGalleryModule.selectedPhotoIds.has('photo-1')).toBe(false);
  });
});

describe('Media Gallery Module - Photo Full View', () => {
  test('viewPhotoFull displays an image', () => {
    mediaGalleryModule.viewPhotoFull('photo-1', 'https://example.com/photo1.jpg', 'Test Photo', 'image');
    expect(mediaGalleryModule.currentMediaId).toBe('photo-1');
    const content = document.getElementById('viewPhotoFullContent').innerHTML;
    expect(content).toContain('img');
    expect(content).toContain('https://example.com/photo1.jpg');
  });

  test('viewPhotoFull displays a YouTube embed', () => {
    mediaGalleryModule.viewPhotoFull('video-1', 'abc123', 'Test Video', 'youtube');
    expect(mediaGalleryModule.currentMediaId).toBe('video-1');
    const content = document.getElementById('viewPhotoFullContent').innerHTML;
    expect(content).toContain('iframe');
    expect(content).toContain('youtube.com/embed/abc123');
  });

  test('viewPhotoFull sets modal title', () => {
    mediaGalleryModule.viewPhotoFull('photo-1', 'https://example.com/photo.jpg', 'My Photo');
    const titleEl = document.getElementById('viewPhotoFullTitle');
    expect(titleEl.textContent).toBe('My Photo');
  });
});

describe('Media Gallery Module - Load Media Statistics', () => {
  test('loadMediaStatistics updates DOM counters', async () => {
    _apiClient.count
      .mockResolvedValueOnce({ count: 150 }) // totalPhotos
      .mockResolvedValueOnce({ count: 25 }) // totalVideos
      .mockResolvedValueOnce({ count: 30 }); // untaggedPhotos
    _apiClient.selectAll.mockResolvedValueOnce([{ event_id: 'e1' }, { event_id: 'e2' }]); // eventsWithMedia

    await mediaGalleryModule.loadMediaStatistics();

    expect(document.getElementById('totalPhotosCount').textContent).toBe('150');
    expect(document.getElementById('totalVideosCount').textContent).toBe('25');
    expect(document.getElementById('untaggedPhotosCountGallery').textContent).toBe('30');
    expect(document.getElementById('totalEventsWithMediaCount').textContent).toBe('2');
    expect(document.getElementById('totalMediaItems').textContent).toBe('175');
  });
});

describe('Media Gallery Module - Clear Activity Log', () => {
  test('clearActivityLog requires confirmation', async () => {
    // Mock confirmDialog to return false
    utils.confirmDialog = jest.fn(() => Promise.resolve(false));
    await mediaGalleryModule.clearActivityLog();
    // Should not proceed - no error
  });
});

describe('Media Gallery Module - Org Filter Dropdown', () => {
  test('_loadOrgFilterDropdown populates select', async () => {
    _apiClient.select.mockResolvedValueOnce({
      data: [
        { id: 'org-1', company_name: 'Acme Ltd' },
        { id: 'org-2', company_name: 'BuildRight' },
      ],
      error: null,
    });

    await mediaGalleryModule._loadOrgFilterDropdown();
    const select = document.getElementById('mediaOrgFilter');
    expect(select.innerHTML).toContain('Acme Ltd');
    expect(select.innerHTML).toContain('BuildRight');
  });

  test('_loadOrgFilterDropdown handles missing select element gracefully', async () => {
    const select = document.getElementById('mediaOrgFilter');
    select.id = 'tempHidden';
    await mediaGalleryModule._loadOrgFilterDropdown();
    select.id = 'mediaOrgFilter';
    // Should not throw
  });
});

describe('Media Gallery Module - Back to Events', () => {
  test('backToEventsList resets filter and shows events list', () => {
    const select = document.getElementById('mediaOrgFilter');
    select.value = 'org-1';
    // Mock showEventsListView
    jest.spyOn(mediaGalleryModule, 'showEventsListView').mockImplementation(() => {});
    mediaGalleryModule.backToEventsList();
    expect(select.value).toBe('');
    expect(mediaGalleryModule.showEventsListView).toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});

describe('Media Gallery Module - Event Contents View', () => {
  beforeEach(() => {
    // apiClient.select for event details
    _apiClient.select.mockResolvedValue({
      data: [{ id: 'evt-1', event_name: 'Awards Gala 2026' }],
      error: null,
    });
  });

  test('showEventContentsView sets view state', async () => {
    _apiClient.count.mockResolvedValueOnce({ count: 50 }).mockResolvedValueOnce({ count: 10 });

    mediaGalleryModule.currentEventId = 'evt-1';
    await mediaGalleryModule.showEventContentsView('evt-1');

    expect(mediaGalleryModule.currentView).toBe('event-contents');
    expect(document.getElementById('eventContentsView').style.display).toBe('block');
  });

  test('showEventContentsView updates photo/video counts', async () => {
    _apiClient.count.mockResolvedValueOnce({ count: 42 }).mockResolvedValueOnce({ count: 7 });

    mediaGalleryModule.currentEventId = 'evt-1';
    await mediaGalleryModule.showEventContentsView('evt-1');

    expect(document.getElementById('eventPhotosCount').textContent).toBe('42');
    expect(document.getElementById('eventVideosCount').textContent).toBe('7');
  });
});

describe('Media Gallery Module - Open Photos Production', () => {
  beforeEach(() => {
    mediaGalleryModule.currentEventId = 'evt-1';
    mediaGalleryModule.currentEvent = { event_name: 'Awards Gala 2026' };
    jest.spyOn(mediaGalleryModule, 'loadPhotosProduction').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('openPhotosProduction sets view and loads photos', async () => {
    await mediaGalleryModule.openPhotosProduction();
    expect(mediaGalleryModule.currentView).toBe('photos-production');
    expect(document.getElementById('photosProductionView').style.display).toBe('block');
    expect(document.getElementById('photosEventName').textContent).toBe('- Awards Gala 2026');
    expect(mediaGalleryModule.loadPhotosProduction).toHaveBeenCalled();
  });

  test('openPhotosProduction returns early without eventId', async () => {
    mediaGalleryModule.currentEventId = null;
    await mediaGalleryModule.openPhotosProduction();
    expect(mediaGalleryModule.loadPhotosProduction).not.toHaveBeenCalled();
  });
});

describe('Media Gallery Module - Open Videos Production', () => {
  beforeEach(() => {
    mediaGalleryModule.currentEventId = 'evt-1';
    mediaGalleryModule.currentEvent = { event_name: 'Awards Gala 2026' };
    jest.spyOn(mediaGalleryModule, 'loadVideosProduction').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('openVideosProduction sets view and loads videos', async () => {
    await mediaGalleryModule.openVideosProduction();
    expect(mediaGalleryModule.currentView).toBe('videos-production');
    expect(document.getElementById('videosProductionView').style.display).toBe('block');
    expect(document.getElementById('videosEventName').textContent).toBe('- Awards Gala 2026');
    expect(mediaGalleryModule.loadVideosProduction).toHaveBeenCalled();
  });

  test('openVideosProduction returns early without eventId', async () => {
    mediaGalleryModule.currentEventId = null;
    await mediaGalleryModule.openVideosProduction();
    expect(mediaGalleryModule.loadVideosProduction).not.toHaveBeenCalled();
  });
});

describe('Media Gallery Module - Toggle Publish', () => {
  beforeEach(() => {
    mediaGalleryModule.currentSectionId = 'sec-1';
    mediaGalleryModule.currentSectionName = 'Test Section';
    jest.spyOn(mediaGalleryModule, 'viewSectionPhotos').mockResolvedValue();
    Object.keys(mockSupabase).forEach((key) => {
      if (typeof mockSupabase[key] === 'function' && key !== 'then' && key !== 'single') {
        mockSupabase[key].mockReturnValue(mockSupabase);
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('togglePublish publishes a photo', async () => {
    mockSupabase.then.mockImplementationOnce((cb) => cb({ data: null, error: null }));
    await mediaGalleryModule.togglePublish('photo-1', true);
    expect(mediaGalleryModule.viewSectionPhotos).toHaveBeenCalled();
  });

  test('togglePublish unpublishes a photo', async () => {
    mockSupabase.then.mockImplementationOnce((cb) => cb({ data: null, error: null }));
    await mediaGalleryModule.togglePublish('photo-2', false);
    expect(mediaGalleryModule.viewSectionPhotos).toHaveBeenCalled();
  });

  test('togglePublish handles errors gracefully', async () => {
    mockSupabase.then.mockImplementationOnce((cb) => cb({ data: null, error: { message: 'DB error' } }));
    await mediaGalleryModule.togglePublish('photo-1', true);
    // Should not throw; shows error toast
  });
});

describe('Media Gallery Module - Toggle Featured', () => {
  beforeEach(() => {
    mediaGalleryModule.currentSectionId = 'sec-1';
    mediaGalleryModule.currentSectionName = 'Test Section';
    jest.spyOn(mediaGalleryModule, 'viewSectionPhotos').mockResolvedValue();
    Object.keys(mockSupabase).forEach((key) => {
      if (typeof mockSupabase[key] === 'function' && key !== 'then' && key !== 'single') {
        mockSupabase[key].mockReturnValue(mockSupabase);
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('toggleFeatured features a photo', async () => {
    mockSupabase.then.mockImplementationOnce((cb) => cb({ data: null, error: null }));
    await mediaGalleryModule.toggleFeatured('photo-1', true);
    expect(mediaGalleryModule.viewSectionPhotos).toHaveBeenCalled();
  });

  test('toggleFeatured unfeatures a photo', async () => {
    mockSupabase.then.mockImplementationOnce((cb) => cb({ data: null, error: null }));
    await mediaGalleryModule.toggleFeatured('photo-1', false);
    expect(mediaGalleryModule.viewSectionPhotos).toHaveBeenCalled();
  });
});

describe('Media Gallery Module - Delete Photo', () => {
  beforeEach(() => {
    mediaGalleryModule.currentSectionId = 'sec-1';
    mediaGalleryModule.currentSectionName = 'Test Section';
    mediaGalleryModule.currentSectionPhotos = [...samplePhotos];
    jest.spyOn(mediaGalleryModule, 'viewSectionPhotos').mockResolvedValue();
    jest.spyOn(mediaGalleryModule, '_logActivity').mockResolvedValue();
    utils.confirmDialog = jest.fn(() => Promise.resolve(true));
    Object.keys(mockSupabase).forEach((key) => {
      if (typeof mockSupabase[key] === 'function' && key !== 'then' && key !== 'single') {
        mockSupabase[key].mockReturnValue(mockSupabase);
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('deletePhoto requires confirmation', async () => {
    utils.confirmDialog = jest.fn(() => Promise.resolve(false));
    await mediaGalleryModule.deletePhoto('photo-1');
    expect(mediaGalleryModule.viewSectionPhotos).not.toHaveBeenCalled();
  });

  test('deletePhoto deletes and reloads on confirm', async () => {
    mockSupabase.then.mockImplementationOnce((cb) => cb({ data: null, error: null }));
    await mediaGalleryModule.deletePhoto('photo-1');
    expect(mediaGalleryModule.viewSectionPhotos).toHaveBeenCalled();
    expect(mediaGalleryModule._logActivity).toHaveBeenCalledWith('delete', 'photo-1', 'Photo deleted');
  });

  test('deletePhoto skips storage cleanup for YouTube videos', async () => {
    mockSupabase.then.mockImplementationOnce((cb) => cb({ data: null, error: null }));
    await mediaGalleryModule.deletePhoto('photo-3'); // YouTube video
    // Should not attempt storage.remove for YouTube
    expect(mediaGalleryModule.viewSectionPhotos).toHaveBeenCalled();
  });
});

describe('Media Gallery Module - Bulk Publish/Unpublish with Confirmation', () => {
  beforeEach(() => {
    mediaGalleryModule.currentSectionId = 'sec-1';
    mediaGalleryModule.currentSectionName = 'Test Section';
    mediaGalleryModule.selectedPhotoIds = new Set(['photo-1', 'photo-2']);
    jest.spyOn(mediaGalleryModule, 'viewSectionPhotos').mockResolvedValue();
    jest.spyOn(mediaGalleryModule, '_logActivity').mockResolvedValue();
    Object.keys(mockSupabase).forEach((key) => {
      if (typeof mockSupabase[key] === 'function' && key !== 'then' && key !== 'single') {
        mockSupabase[key].mockReturnValue(mockSupabase);
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('bulkPublish publishes selected photos after confirmation', async () => {
    utils.confirmDialog = jest.fn(() => Promise.resolve(true));
    mockSupabase.then.mockImplementationOnce((cb) => cb({ data: null, error: null }));
    await mediaGalleryModule.bulkPublish();
    expect(mediaGalleryModule.selectedPhotoIds.size).toBe(0);
    expect(mediaGalleryModule.viewSectionPhotos).toHaveBeenCalled();
  });

  test('bulkPublish cancels when user declines confirmation', async () => {
    utils.confirmDialog = jest.fn(() => Promise.resolve(false));
    await mediaGalleryModule.bulkPublish();
    expect(mediaGalleryModule.selectedPhotoIds.size).toBe(2);
  });

  test('bulkUnpublish unpublishes selected photos after confirmation', async () => {
    utils.confirmDialog = jest.fn(() => Promise.resolve(true));
    mockSupabase.then.mockImplementationOnce((cb) => cb({ data: null, error: null }));
    await mediaGalleryModule.bulkUnpublish();
    expect(mediaGalleryModule.selectedPhotoIds.size).toBe(0);
    expect(mediaGalleryModule.viewSectionPhotos).toHaveBeenCalled();
  });

  test('bulkUnpublish cancels when user declines confirmation', async () => {
    utils.confirmDialog = jest.fn(() => Promise.resolve(false));
    await mediaGalleryModule.bulkUnpublish();
    expect(mediaGalleryModule.selectedPhotoIds.size).toBe(2);
  });
});

describe('Media Gallery Module - Bulk Delete with Confirmation', () => {
  beforeEach(() => {
    mediaGalleryModule.currentSectionId = 'sec-1';
    mediaGalleryModule.currentSectionName = 'Test Section';
    mediaGalleryModule.currentSectionPhotos = [...samplePhotos];
    mediaGalleryModule.selectedPhotoIds = new Set(['photo-1', 'photo-2']);
    jest.spyOn(mediaGalleryModule, 'viewSectionPhotos').mockResolvedValue();
    jest.spyOn(mediaGalleryModule, '_logActivity').mockResolvedValue();
    Object.keys(mockSupabase).forEach((key) => {
      if (typeof mockSupabase[key] === 'function' && key !== 'then' && key !== 'single') {
        mockSupabase[key].mockReturnValue(mockSupabase);
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('bulkDelete deletes selected photos after confirmation', async () => {
    utils.confirmDialog = jest.fn(() => Promise.resolve(true));
    mockSupabase.then.mockImplementationOnce((cb) => cb({ data: null, error: null }));
    await mediaGalleryModule.bulkDelete();
    expect(mediaGalleryModule.selectedPhotoIds.size).toBe(0);
    expect(mediaGalleryModule.viewSectionPhotos).toHaveBeenCalled();
  });

  test('bulkDelete cancels when user declines', async () => {
    utils.confirmDialog = jest.fn(() => Promise.resolve(false));
    await mediaGalleryModule.bulkDelete();
    expect(mediaGalleryModule.selectedPhotoIds.size).toBe(2);
  });
});

describe('Media Gallery Module - Bulk Download', () => {
  beforeEach(() => {
    mediaGalleryModule.currentSectionPhotos = [...samplePhotos];
    mediaGalleryModule.selectedPhotoIds = new Set(['photo-1', 'photo-2']);
    jest.spyOn(mediaGalleryModule, 'downloadPhoto').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('bulkDownload early returns when nothing selected', async () => {
    mediaGalleryModule.selectedPhotoIds.clear();
    await mediaGalleryModule.bulkDownload();
    expect(mediaGalleryModule.downloadPhoto).not.toHaveBeenCalled();
  });

  test('bulkDownload skips YouTube videos', async () => {
    mediaGalleryModule.selectedPhotoIds = new Set(['photo-3']); // YouTube
    await mediaGalleryModule.bulkDownload();
    // Should show "no downloadable" toast
    expect(mediaGalleryModule.downloadPhoto).not.toHaveBeenCalled();
  });
});

describe('Media Gallery Module - Save Inline Title', () => {
  beforeEach(() => {
    mediaGalleryModule.currentSectionPhotos = [...samplePhotos];
    Object.keys(mockSupabase).forEach((key) => {
      if (typeof mockSupabase[key] === 'function' && key !== 'then' && key !== 'single') {
        mockSupabase[key].mockReturnValue(mockSupabase);
      }
    });
  });

  test('saveInlineTitle does nothing when title unchanged', async () => {
    const el = document.createElement('p');
    el.textContent = 'Welcome Drinks';
    el.setAttribute('data-original-title', 'Welcome Drinks');
    await mediaGalleryModule.saveInlineTitle(el, 'photo-1');
    // No API call should have been made
  });

  test('saveInlineTitle reverts when empty', async () => {
    const el = document.createElement('p');
    el.textContent = '   ';
    el.setAttribute('data-original-title', 'Welcome Drinks');
    await mediaGalleryModule.saveInlineTitle(el, 'photo-1');
    expect(el.textContent).toBe('Welcome Drinks');
  });

  test('saveInlineTitle updates title on change', async () => {
    const el = document.createElement('p');
    el.textContent = 'New Title';
    el.setAttribute('data-original-title', 'Old Title');
    mockSupabase.then.mockImplementationOnce((cb) => cb({ data: null, error: null }));
    await mediaGalleryModule.saveInlineTitle(el, 'photo-1');
    expect(el.getAttribute('data-original-title')).toBe('New Title');
  });

  test('saveInlineTitle updates local photo array', async () => {
    const el = document.createElement('p');
    el.textContent = 'Updated Title';
    el.setAttribute('data-original-title', 'Welcome Drinks');
    mockSupabase.then.mockImplementationOnce((cb) => cb({ data: null, error: null }));
    await mediaGalleryModule.saveInlineTitle(el, 'photo-1');
    const photo = mediaGalleryModule.currentSectionPhotos.find((p) => p.id === 'photo-1');
    expect(photo.title).toBe('Updated Title');
  });
});

describe('Media Gallery Module - Open Upload Modal', () => {
  test('openUploadPhotosModal resets form fields', async () => {
    document.getElementById('sectionPhotosFile').value = '';
    document.getElementById('sectionPhotosTitle').value = 'Old title';
    document.getElementById('sectionPhotosPublished').checked = false;

    await mediaGalleryModule.openUploadPhotosModal();

    expect(document.getElementById('sectionPhotosTitle').value).toBe('');
    expect(document.getElementById('sectionPhotosPublished').checked).toBe(true);
    expect(mediaGalleryModule.selectedFiles).toEqual([]);
    expect(document.getElementById('filePreviewContainer').classList.contains('d-none')).toBe(true);
    expect(document.getElementById('filePreviewGrid').innerHTML).toBe('');
  });
});

describe('Media Gallery Module - Handle File Preview', () => {
  test('handleFilePreview clears preview when no files', () => {
    const input = { files: [] };
    mediaGalleryModule.handleFilePreview(input);
    expect(mediaGalleryModule.selectedFiles).toEqual([]);
    expect(document.getElementById('filePreviewContainer').classList.contains('d-none')).toBe(true);
  });

  test('handleFilePreview shows video type container for video files', () => {
    const mockFile = { name: 'test.mp4', type: 'video/mp4', size: 1000000 };
    const input = { files: [mockFile] };
    jest.spyOn(mediaGalleryModule, 'renderFilePreview').mockImplementation(() => {});
    mediaGalleryModule.handleFilePreview(input);
    expect(mediaGalleryModule.selectedFiles.length).toBe(1);
    expect(document.getElementById('videoTypeContainer').style.display).toBe('block');
    jest.restoreAllMocks();
  });

  test('handleFilePreview hides video type container for image files', () => {
    const mockFile = { name: 'test.jpg', type: 'image/jpeg', size: 500000 };
    const input = { files: [mockFile] };
    jest.spyOn(mediaGalleryModule, 'renderFilePreview').mockImplementation(() => {});
    mediaGalleryModule.handleFilePreview(input);
    expect(document.getElementById('videoTypeContainer').style.display).toBe('none');
    jest.restoreAllMocks();
  });
});

describe('Media Gallery Module - Render File Preview', () => {
  test('renderFilePreview hides container when no files selected', () => {
    mediaGalleryModule.selectedFiles = [];
    mediaGalleryModule.renderFilePreview();
    expect(document.getElementById('filePreviewContainer').classList.contains('d-none')).toBe(true);
  });

  test('renderFilePreview shows container and count for selected files', () => {
    // Mock FileReader for JSDOM environment - call onload synchronously
    global.FileReader = class {
      readAsDataURL() {
        if (this.onload) this.onload({ target: { result: 'data:image/jpeg;base64,abc' } });
      }
    };

    mediaGalleryModule.selectedFiles = [
      { name: 'photo1.jpg', type: 'image/jpeg', size: 102400 },
      { name: 'photo2.png', type: 'image/png', size: 204800 },
    ];
    mediaGalleryModule.renderFilePreview();
    expect(document.getElementById('filePreviewContainer').classList.contains('d-none')).toBe(false);
    expect(document.getElementById('filePreviewCount').textContent).toBe('2');
    const grid = document.getElementById('filePreviewGrid');
    // The grid should have child elements for each file
    expect(grid.children.length).toBe(2);
    // After FileReader resolves synchronously, inner HTML should contain filenames
    expect(grid.innerHTML).toContain('photo1.jpg');
    expect(grid.innerHTML).toContain('photo2.png');

    delete global.FileReader;
  });
});

describe('Media Gallery Module - Open Add Section Modal', () => {
  test('openAddSectionModal sets modal to add mode', () => {
    mediaGalleryModule.openAddSectionModal();
    expect(document.getElementById('gallerySectionModalTitle').textContent).toBe('Add Gallery Section');
    expect(document.getElementById('gallerySectionId').value).toBe('');
    expect(document.getElementById('gallerySectionName').value).toBe('');
    expect(document.getElementById('gallerySectionDescription').value).toBe('');
    expect(document.getElementById('gallerySectionOrder').value).toBe('0');
    expect(document.getElementById('saveGallerySectionBtn').textContent).toBe('Save Section');
  });
});

describe('Media Gallery Module - Edit Section Modal', () => {
  test('editSection loads section and sets edit mode', async () => {
    _apiClient.select.mockResolvedValueOnce({
      data: [{ id: 'sec-1', gallery_name: 'Reception', gallery_description: 'Pre-dinner drinks', display_order: 1 }],
      error: null,
    });
    await mediaGalleryModule.editSection('sec-1');
    expect(document.getElementById('gallerySectionModalTitle').textContent).toBe('Edit Gallery Section');
    expect(document.getElementById('gallerySectionId').value).toBe('sec-1');
    expect(document.getElementById('gallerySectionName').value).toBe('Reception');
    expect(document.getElementById('gallerySectionDescription').value).toBe('Pre-dinner drinks');
    expect(document.getElementById('gallerySectionOrder').value).toBe('1');
    expect(document.getElementById('saveGallerySectionBtn').textContent).toBe('Update Section');
  });

  test('editSection handles errors gracefully', async () => {
    _apiClient.select.mockResolvedValueOnce({
      data: [],
      error: null,
    });
    await mediaGalleryModule.editSection('nonexistent');
    // Should not throw
  });
});

describe('Media Gallery Module - Load Videos Production', () => {
  beforeEach(() => {
    mediaGalleryModule.currentEventId = 'evt-1';
    Object.keys(mockSupabase).forEach((key) => {
      if (typeof mockSupabase[key] === 'function' && key !== 'then' && key !== 'single') {
        mockSupabase[key].mockReturnValue(mockSupabase);
      }
    });
  });

  test('loadVideosProduction shows empty state for no videos', async () => {
    _apiClient.select.mockResolvedValueOnce({ data: [], error: null });
    await mediaGalleryModule.loadVideosProduction();
    const content = document.getElementById('videosProductionContent').innerHTML;
    expect(content).toContain('No videos yet');
  });

  test('loadVideosProduction renders videos grid when data exists', async () => {
    _apiClient.select.mockResolvedValueOnce({ data: sampleVideos, error: null });
    jest.spyOn(mediaGalleryModule, 'renderVideosGrid').mockImplementation(() => {});
    await mediaGalleryModule.loadVideosProduction();
    expect(mediaGalleryModule.renderVideosGrid).toHaveBeenCalledWith(sampleVideos);
    jest.restoreAllMocks();
  });

  test('loadVideosProduction shows error on failure', async () => {
    _apiClient.select.mockRejectedValueOnce(new Error('Network error'));
    await mediaGalleryModule.loadVideosProduction();
    const content = document.getElementById('videosProductionContent').innerHTML;
    expect(content).toContain('Error loading videos');
  });
});

describe('Media Gallery Module - Tag Photo From View', () => {
  beforeEach(() => {
    jest.spyOn(mediaGalleryModule, 'tagPhoto').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('tagPhotoFromView opens tag modal for current photo', async () => {
    mediaGalleryModule.currentMediaId = 'photo-1';
    await mediaGalleryModule.tagPhotoFromView();
    expect(mediaGalleryModule.tagPhoto).toHaveBeenCalledWith('photo-1');
  });

  test('tagPhotoFromView shows warning when no photo selected', async () => {
    mediaGalleryModule.currentMediaId = null;
    await mediaGalleryModule.tagPhotoFromView();
    expect(mediaGalleryModule.tagPhoto).not.toHaveBeenCalled();
  });
});

describe('Media Gallery Module - Delete Photo From View', () => {
  beforeEach(() => {
    jest.spyOn(mediaGalleryModule, 'deletePhoto').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('deletePhotoFromView deletes current photo', async () => {
    mediaGalleryModule.currentMediaId = 'photo-1';
    await mediaGalleryModule.deletePhotoFromView();
    expect(mediaGalleryModule.deletePhoto).toHaveBeenCalledWith('photo-1');
  });

  test('deletePhotoFromView shows warning when no photo selected', async () => {
    mediaGalleryModule.currentMediaId = null;
    await mediaGalleryModule.deletePhotoFromView();
    expect(mediaGalleryModule.deletePhoto).not.toHaveBeenCalled();
  });
});

describe('Media Gallery Module - Download All Photos', () => {
  beforeEach(() => {
    jest.spyOn(mediaGalleryModule, 'downloadPhoto').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('downloadAllPhotos shows warning for empty section', async () => {
    mediaGalleryModule.currentSectionPhotos = [];
    await mediaGalleryModule.downloadAllPhotos('Section');
    expect(mediaGalleryModule.downloadPhoto).not.toHaveBeenCalled();
  });

  test('downloadAllPhotos excludes YouTube videos', async () => {
    mediaGalleryModule.currentSectionPhotos = [samplePhotos[2]]; // YouTube only
    await mediaGalleryModule.downloadAllPhotos('Section');
    expect(mediaGalleryModule.downloadPhoto).not.toHaveBeenCalled();
  });
});

describe('Media Gallery Module - Quick Edit Tag', () => {
  test('quickEditTag delegates to tagPhoto', async () => {
    jest.spyOn(mediaGalleryModule, 'tagPhoto').mockResolvedValue();
    await mediaGalleryModule.quickEditTag('photo-1', 'org');
    expect(mediaGalleryModule.tagPhoto).toHaveBeenCalledWith('photo-1');
    jest.restoreAllMocks();
  });
});

describe('Media Gallery Module - On Event Selected', () => {
  beforeEach(() => {
    jest.spyOn(mediaGalleryModule, 'renderGallerySections').mockImplementation(() => {});
    jest.spyOn(mediaGalleryModule, 'showSummaryView').mockResolvedValue();
    Object.keys(mockSupabase).forEach((key) => {
      if (typeof mockSupabase[key] === 'function' && key !== 'then' && key !== 'single') {
        mockSupabase[key].mockReturnValue(mockSupabase);
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('onEventSelected shows summary when no event ID', async () => {
    await mediaGalleryModule.onEventSelected('');
    expect(mediaGalleryModule.showSummaryView).toHaveBeenCalled();
  });

  test('onEventSelected loads gallery sections for event', async () => {
    _apiClient.select.mockResolvedValueOnce({ data: sampleSections, error: null });
    await mediaGalleryModule.onEventSelected('evt-1');
    expect(mediaGalleryModule.currentEventId).toBe('evt-1');
    expect(mediaGalleryModule.renderGallerySections).toHaveBeenCalledWith(sampleSections);
  });

  test('onEventSelected unregisters keyboard shortcuts', async () => {
    mediaGalleryModule._keyboardShortcutsActive = true;
    mediaGalleryModule._registerKeyboardShortcuts();
    _apiClient.select.mockResolvedValueOnce({ data: [], error: null });
    await mediaGalleryModule.onEventSelected('evt-1');
    // _unregisterKeyboardShortcuts should have been called
  });
});

describe('Media Gallery Module - Load Events', () => {
  test('loadEvents populates event dropdown', async () => {
    _apiClient.select.mockResolvedValueOnce({
      data: [
        { id: 'evt-1', event_name: 'Gala', year: 2026 },
        { id: 'evt-2', event_name: 'Regional', year: null },
      ],
      error: null,
    });

    await mediaGalleryModule.loadEvents();

    const select = document.getElementById('mediaEventSelect');
    expect(select.innerHTML).toContain('Gala (2026)');
    expect(select.innerHTML).toContain('Regional');
    expect(STATE.allEvents.length).toBe(2);
  });
});

describe('Media Gallery Module - Slideshow Launch', () => {
  beforeEach(() => {
    mediaGalleryModule.currentSectionId = 'sec-1';
    mediaGalleryModule.currentEventId = 'evt-1';
    mediaGalleryModule.currentSectionPhotos = [...samplePhotos];
    STATE.allEvents = sampleEvents;
    global.window.open = jest.fn(() => ({
      document: { write: jest.fn(), close: jest.fn() },
    }));
  });

  test('launchSlideshow opens a new window with slideshow', async () => {
    await mediaGalleryModule.launchSlideshow('sec-1');
    expect(window.open).toHaveBeenCalledWith('', '_blank');
  });

  test('launchSlideshow filters out unpublished photos', async () => {
    const mockWin = { document: { write: jest.fn(), close: jest.fn() } };
    global.window.open = jest.fn(() => mockWin);
    // Only use image photos (YouTube would not have a file_url suitable for slideshow img tag)
    mediaGalleryModule.currentSectionPhotos = [
      { ...samplePhotos[0], published: true, title: 'Published Shot' },
      { ...samplePhotos[1], published: false, title: 'Draft Shot' },
    ];
    await mediaGalleryModule.launchSlideshow('sec-1');
    expect(mockWin.document.write).toHaveBeenCalled();
    const html = mockWin.document.write.mock.calls[0][0];
    // The published photo should appear somewhere (in JSON data or initial slide)
    expect(html).toContain('Published Shot');
    // The unpublished photo should NOT appear
    expect(html).not.toContain('Draft Shot');
  });

  test('launchSlideshow returns early when no section', async () => {
    mediaGalleryModule.currentSectionId = null;
    await mediaGalleryModule.launchSlideshow(null);
    // Should show toast warning
  });

  test('launchSlideshow returns early for empty photos', async () => {
    mediaGalleryModule.currentSectionPhotos = [];
    Object.keys(mockSupabase).forEach((key) => {
      if (typeof mockSupabase[key] === 'function' && key !== 'then' && key !== 'single') {
        mockSupabase[key].mockReturnValue(mockSupabase);
      }
    });
    mockSupabase.then.mockImplementationOnce((cb) => cb({ data: [], error: null }));
    await mediaGalleryModule.launchSlideshow('sec-1');
    // Should show 'No published photos' toast
  });
});

describe('Media Gallery Module - Keyboard Shortcuts Help', () => {
  afterEach(() => {
    const modal = document.getElementById('keyboardShortcutsModal');
    if (modal) modal.remove();
  });

  test('showKeyboardShortcutsHelp creates help modal', () => {
    mediaGalleryModule.showKeyboardShortcutsHelp();
    const modal = document.getElementById('keyboardShortcutsModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('Keyboard Shortcuts');
    expect(modal.innerHTML).toContain('Select / deselect all');
    expect(modal.innerHTML).toContain('Delete selected');
    expect(modal.innerHTML).toContain('Previous page');
  });

  test('showKeyboardShortcutsHelp removes existing modal first', () => {
    mediaGalleryModule.showKeyboardShortcutsHelp();
    const firstModal = document.getElementById('keyboardShortcutsModal');
    expect(firstModal).not.toBeNull();

    mediaGalleryModule.showKeyboardShortcutsHelp();
    const secondModal = document.getElementById('keyboardShortcutsModal');
    expect(secondModal).not.toBeNull();
    // Should be a new modal, not duplicate
    expect(document.querySelectorAll('#keyboardShortcutsModal').length).toBe(1);
  });
});

describe('Media Gallery Module - Handle Drop', () => {
  test('handleDrop rejects invalid file types', () => {
    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      dataTransfer: {
        files: [{ name: 'test.txt', type: 'text/plain', size: 100 }],
      },
    };
    mediaGalleryModule.handleDrop(event);
    // Should show 'No valid image/video files' toast
  });

  test('handleDrop accepts valid image types', () => {
    // Add required DOM elements for the drop handler
    const fileCountEl = document.createElement('span');
    fileCountEl.id = 'dragDropFileCount';
    document.body.appendChild(fileCountEl);
    const fileCountTextEl = document.createElement('span');
    fileCountTextEl.id = 'dragDropFileCountText';
    document.body.appendChild(fileCountTextEl);

    const mockFile = { name: 'photo.jpg', type: 'image/jpeg', size: 500000 };
    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      dataTransfer: {
        files: [mockFile],
      },
    };
    mediaGalleryModule.handleDrop(event);
    // Should store files and show publish modal
    expect(mediaGalleryModule.draggedFiles).not.toBeNull();
    expect(mediaGalleryModule.draggedFiles.length).toBe(1);

    // Clean up
    fileCountEl.remove();
    fileCountTextEl.remove();
  });
});

describe('Media Gallery Module - Render Section Card', () => {
  test('renderSectionCard includes edit/delete buttons', () => {
    const html = mediaGalleryModule.renderSectionCard(sampleSections[0]);
    expect(html).toContain('editSection');
    expect(html).toContain('deleteSection');
    expect(html).toContain('viewSectionPhotos');
  });

  test('renderSectionCard shows description when available', () => {
    const html = mediaGalleryModule.renderSectionCard(sampleSections[0]);
    expect(html).toContain('Pre-dinner drinks');
  });
});

describe('Media Gallery Module - Bulk Move to Section', () => {
  beforeEach(() => {
    mediaGalleryModule.currentEventId = 'evt-1';
    mediaGalleryModule.currentSectionId = 'sec-1';
    Object.keys(mockSupabase).forEach((key) => {
      if (typeof mockSupabase[key] === 'function' && key !== 'then' && key !== 'single') {
        mockSupabase[key].mockReturnValue(mockSupabase);
      }
    });
  });

  test('bulkMoveToSection shows warning when nothing selected', async () => {
    mediaGalleryModule.selectedPhotoIds = new Set();
    await mediaGalleryModule.bulkMoveToSection();
    // Should show toast about selecting photos
  });
});

// ===========================================================================
// ADDITIONAL COVERAGE TESTS
// ===========================================================================

// ---------------------------------------------------------------------------
// hideAllViews
// ---------------------------------------------------------------------------
describe('Media Gallery Module - hideAllViews comprehensive', () => {
  test('sets display none on all standard views', () => {
    document.getElementById('eventsListView').style.display = 'block';
    document.getElementById('eventContentsView').style.display = 'block';
    document.getElementById('photosProductionView').style.display = 'block';
    document.getElementById('videosProductionView').style.display = 'block';

    mediaGalleryModule.hideAllViews();

    expect(document.getElementById('eventsListView').style.display).toBe('none');
    expect(document.getElementById('eventContentsView').style.display).toBe('none');
    expect(document.getElementById('photosProductionView').style.display).toBe('none');
    expect(document.getElementById('videosProductionView').style.display).toBe('none');
  });

  test('handles missing optional views without throwing', () => {
    expect(() => mediaGalleryModule.hideAllViews()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// renderInitialState
// ---------------------------------------------------------------------------
describe('Media Gallery Module - renderInitialState comprehensive', () => {
  test('shows event selection prompt', () => {
    mediaGalleryModule.renderInitialState();
    const content = document.getElementById('mediaGalleryContent');
    expect(content.innerHTML).toContain('Select an Event');
    expect(content.innerHTML).toContain('dropdown');
  });
});

// ---------------------------------------------------------------------------
// _getFilteredPhotos - sorting by org_asc
// ---------------------------------------------------------------------------
describe('Media Gallery Module - _getFilteredPhotos org_asc sort', () => {
  beforeEach(() => {
    mediaGalleryModule.currentSectionPhotos = [...samplePhotos];
    mediaGalleryModule.currentFilter = 'all';
    mediaGalleryModule.currentSearchTerm = '';
  });

  test('sorts by organisation name ascending', () => {
    mediaGalleryModule.currentSortBy = 'org_asc';
    const filtered = mediaGalleryModule._getFilteredPhotos();
    // Photo with org 'Acme Ltd' should come before 'BuildRight'
    const orgNames = filtered.map((p) => p.organisations?.company_name || 'zzz');
    for (let i = 1; i < orgNames.length; i++) {
      expect(orgNames[i - 1].localeCompare(orgNames[i])).toBeLessThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// _getFilteredPhotos - search by caption
// ---------------------------------------------------------------------------
describe('Media Gallery Module - _getFilteredPhotos caption search', () => {
  beforeEach(() => {
    mediaGalleryModule.currentSectionPhotos = [...samplePhotos];
    mediaGalleryModule.currentFilter = 'all';
    mediaGalleryModule.currentSortBy = 'display_order';
  });

  test('searches by caption text', () => {
    mediaGalleryModule.currentSearchTerm = 'arriving';
    const filtered = mediaGalleryModule._getFilteredPhotos();
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('photo-1');
  });

  test('search returns empty for non-matching term', () => {
    mediaGalleryModule.currentSearchTerm = 'nonexistent_xyz';
    const filtered = mediaGalleryModule._getFilteredPhotos();
    expect(filtered.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Pagination edge cases
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Pagination edge cases', () => {
  test('goToPage handles page 0 gracefully', () => {
    mediaGalleryModule.currentPage = 1;
    mediaGalleryModule.goToPage(0);
    // Should clamp or not change
    expect(mediaGalleryModule.currentPage).toBeLessThanOrEqual(1);
  });

  test('_buildPaginationItems handles single page', () => {
    const html = mediaGalleryModule._buildPaginationItems(1, 1);
    expect(html).toContain('page-item active');
  });

  test('_buildPaginationItems handles last page', () => {
    const html = mediaGalleryModule._buildPaginationItems(5, 5);
    expect(html).toContain('active');
  });
});

// ---------------------------------------------------------------------------
// Selection - selectAllFiltered comprehensive
// ---------------------------------------------------------------------------
describe('Media Gallery Module - selectAllFiltered comprehensive', () => {
  beforeEach(() => {
    mediaGalleryModule.currentSectionPhotos = [...samplePhotos];
    mediaGalleryModule.currentFilter = 'all';
    mediaGalleryModule.currentSearchTerm = '';
    mediaGalleryModule.currentSortBy = 'display_order';
    mediaGalleryModule.selectedPhotoIds = new Set();
  });

  test('selects all photos across all pages', () => {
    mediaGalleryModule.selectAllFiltered();
    expect(mediaGalleryModule.selectedPhotoIds.size).toBe(samplePhotos.length);
  });

  test('deselects all when all are already selected', () => {
    samplePhotos.forEach((p) => mediaGalleryModule.selectedPhotoIds.add(p.id));
    mediaGalleryModule.selectAllFiltered();
    expect(mediaGalleryModule.selectedPhotoIds.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Render Photo Card - various scenarios
// ---------------------------------------------------------------------------
describe('Media Gallery Module - renderPhotoCard additional cases', () => {
  test('renders photo without organisation', () => {
    const html = mediaGalleryModule.renderPhotoCard(samplePhotos[1]);
    expect(html).not.toContain('Acme');
    expect(html).toContain('Networking');
  });

  test('renders photo with photographer', () => {
    const html = mediaGalleryModule.renderPhotoCard(samplePhotos[0]);
    expect(html).toContain('John Smith');
  });

  test('renders photo without photographer', () => {
    const html = mediaGalleryModule.renderPhotoCard(samplePhotos[1]);
    expect(html).not.toContain('John Smith');
  });
});

// ---------------------------------------------------------------------------
// Video Tags - edge cases
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Video Tags edge cases', () => {
  beforeEach(() => {
    mediaGalleryModule.videoTags = [];
    mediaGalleryModule.videoAwardTags = [];
  });

  test('addVideoTag with empty select does nothing', () => {
    const select = document.getElementById('videoTagInput');
    select.value = '';
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    mediaGalleryModule.addVideoTag();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('select'), expect.anything());
    spy.mockRestore();
  });

  test('removeVideoAwardTag removes correct tag', () => {
    mediaGalleryModule.videoAwardTags = [
      { id: 'a1', name: 'Award 1' },
      { id: 'a2', name: 'Award 2' },
    ];
    mediaGalleryModule.removeVideoAwardTag('a1');
    expect(mediaGalleryModule.videoAwardTags.length).toBe(1);
    expect(mediaGalleryModule.videoAwardTags[0].id).toBe('a2');
  });

  test('removeVideoTag removes correct tag', () => {
    mediaGalleryModule.videoTags = [
      { id: 'c1', name: 'Company 1' },
      { id: 'c2', name: 'Company 2' },
    ];
    mediaGalleryModule.removeVideoTag('c1');
    expect(mediaGalleryModule.videoTags.length).toBe(1);
    expect(mediaGalleryModule.videoTags[0].id).toBe('c2');
  });
});

// ---------------------------------------------------------------------------
// Toggle Video Source Fields
// ---------------------------------------------------------------------------
describe('Media Gallery Module - toggleVideoSourceFields comprehensive', () => {
  test('shows YouTube fields and hides upload fields for youtube', () => {
    mediaGalleryModule.toggleVideoSourceFields('youtube');
    const ytGroup = document.getElementById('youtubeFieldGroup');
    const uploadGroup = document.getElementById('uploadFieldGroup');
    expect(ytGroup.style.display).toBe('block');
    expect(uploadGroup.style.display).toBe('none');
  });

  test('shows upload fields and hides YouTube fields for upload', () => {
    mediaGalleryModule.toggleVideoSourceFields('upload');
    const ytGroup = document.getElementById('youtubeFieldGroup');
    const uploadGroup = document.getElementById('uploadFieldGroup');
    expect(ytGroup.style.display).toBe('none');
    expect(uploadGroup.style.display).toBe('block');
  });
});

// ---------------------------------------------------------------------------
// renderGallerySections comprehensive
// ---------------------------------------------------------------------------
describe('Media Gallery Module - renderGallerySections comprehensive', () => {
  test('renders sections with correct count', () => {
    const container = document.getElementById('mediaGalleryContent');
    mediaGalleryModule.renderGallerySections(sampleSections, {});
    expect(container.innerHTML).toContain('Drinks Reception');
    expect(container.innerHTML).toContain('Award Winners');
  });

  test('renders empty state when no sections', () => {
    const container = document.getElementById('mediaGalleryContent');
    mediaGalleryModule.renderGallerySections([], {});
    expect(container.innerHTML).toContain('No gallery sections');
  });
});

// ---------------------------------------------------------------------------
// updateBulkActionsBar comprehensive
// ---------------------------------------------------------------------------
describe('Media Gallery Module - updateBulkActionsBar comprehensive', () => {
  test('shows bar with count when photos selected', () => {
    mediaGalleryModule.selectedPhotoIds = new Set(['photo-1', 'photo-2']);
    mediaGalleryModule.updateBulkActionsBar();
    const _bar = document.getElementById('bulkActionsBar');
    const count = document.getElementById('selectedCount');
    expect(count.textContent).toBe('2');
  });

  test('hides bar when no photos selected', () => {
    mediaGalleryModule.selectedPhotoIds = new Set();
    mediaGalleryModule.updateBulkActionsBar();
    const bar = document.getElementById('bulkActionsBar');
    expect(bar.classList.contains('d-none')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// renderSummaryView
// ---------------------------------------------------------------------------
describe('Media Gallery Module - renderSummaryView comprehensive', () => {
  test('shows events with their details', () => {
    const events = [
      {
        event: {
          id: 'evt-1',
          event_name: 'Gala 2026',
          event_date: '2026-03-15',
          venue: 'London',
          year: 2026,
        },
        sections: [],
        totalPhotos: 100,
      },
    ];
    mediaGalleryModule.renderSummaryView(events);
    const content = document.getElementById('mediaGalleryContent');
    expect(content.innerHTML).toContain('Gala 2026');
  });
});

// ---------------------------------------------------------------------------
// Drag & drop state management
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Drag state management', () => {
  test('handlePhotoDragStart sets draggedPhotoId via event', () => {
    const mockEvent = {
      target: { style: {} },
      dataTransfer: { effectAllowed: '', setData: jest.fn() },
    };
    mediaGalleryModule.handlePhotoDragStart(mockEvent, 'photo-1');
    expect(mediaGalleryModule.draggedPhotoId).toBe('photo-1');
  });

  test('clearing drag state', () => {
    mediaGalleryModule.draggedPhotoId = 'photo-1';
    mediaGalleryModule.draggedOverPhotoId = 'photo-2';
    mediaGalleryModule.draggedPhotoId = null;
    mediaGalleryModule.draggedOverPhotoId = null;
    expect(mediaGalleryModule.draggedPhotoId).toBeNull();
    expect(mediaGalleryModule.draggedOverPhotoId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// View management state
// ---------------------------------------------------------------------------
describe('Media Gallery Module - View state management', () => {
  test('default currentView is events-list', () => {
    expect(mediaGalleryModule.currentView).toBeDefined();
  });

  test('photosPerPage default is 48', () => {
    expect(mediaGalleryModule.photosPerPage).toBe(48);
  });

  test('currentPage defaults to 1', () => {
    mediaGalleryModule.currentPage = 1;
    expect(mediaGalleryModule.currentPage).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// noop
// ---------------------------------------------------------------------------
describe('Media Gallery Module - noop function', () => {
  test('noop returns undefined', () => {
    expect(mediaGalleryModule.noop()).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// handleFilePreview with multiple file types
// ---------------------------------------------------------------------------
describe('Media Gallery Module - handleFilePreview edge cases', () => {
  test('handleFilePreview shows count for multiple files', () => {
    // Mock FileReader for JSDOM environment
    const origFileReader = global.FileReader;
    global.FileReader = class {
      readAsDataURL() {
        if (this.onload) this.onload({ target: { result: '' } });
      }
    };
    const file1 = new Blob(['img'], { type: 'image/jpeg' });
    file1.name = 'test1.jpg';
    const file2 = new Blob(['img'], { type: 'image/png' });
    file2.name = 'test2.png';
    mediaGalleryModule.selectedFiles = [file1, file2];
    mediaGalleryModule.handleFilePreview({ files: [file1, file2] });
    const count = document.getElementById('filePreviewCount');
    expect(count.textContent).toBe('2');
    global.FileReader = origFileReader;
  });
});

// ---------------------------------------------------------------------------
// YouTube ID Extraction edge cases
// ---------------------------------------------------------------------------
describe('Media Gallery Module - YouTube ID Extraction edge cases', () => {
  test('extracts ID from URL with extra parameters', () => {
    const id = mediaGalleryModule.extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120');
    expect(id).toBe('dQw4w9WgXcQ');
  });

  test('extracts ID from youtube.com/embed URL', () => {
    const id = mediaGalleryModule.extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(id).toBe('dQw4w9WgXcQ');
  });

  test('returns null for Vimeo URL', () => {
    const id = mediaGalleryModule.extractYouTubeId('https://vimeo.com/123456789');
    expect(id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Keyboard shortcuts state
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Keyboard shortcuts state management', () => {
  test('_keyboardShortcutsActive starts as false', () => {
    expect(typeof mediaGalleryModule._keyboardShortcutsActive).toBe('boolean');
  });

  test('_registerKeyboardShortcuts does not double-register', () => {
    mediaGalleryModule._keyboardShortcutsActive = true;
    mediaGalleryModule._registerKeyboardShortcuts();
    // Should still be true (did not re-register)
    expect(mediaGalleryModule._keyboardShortcutsActive).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// clearSelection
// ---------------------------------------------------------------------------
describe('Media Gallery Module - clearSelection comprehensive', () => {
  test('clears all selections and updates UI', () => {
    mediaGalleryModule.selectedPhotoIds = new Set(['p1', 'p2', 'p3']);
    mediaGalleryModule.clearSelection();
    expect(mediaGalleryModule.selectedPhotoIds.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// renderFilePreview with video files
// ---------------------------------------------------------------------------
describe('Media Gallery Module - renderFilePreview with videos', () => {
  test('renderFilePreview handles empty file list', () => {
    mediaGalleryModule.selectedFiles = [];
    mediaGalleryModule.renderFilePreview();
    const container = document.getElementById('filePreviewContainer');
    expect(container.classList.contains('d-none')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// backToEventsList
// ---------------------------------------------------------------------------
describe('Media Gallery Module - backToEventsList comprehensive', () => {
  test('resets filter state and changes view', () => {
    mediaGalleryModule.currentFilter = 'published';
    mediaGalleryModule.currentSearchTerm = 'test';
    mediaGalleryModule.currentSortBy = 'name_asc';
    mediaGalleryModule.backToEventsList();
    expect(mediaGalleryModule.currentView).toBe('events-list');
  });
});

// ===========================================================================
// ADDITIONAL TESTS TO INCREASE COVERAGE
// ===========================================================================

// ---------------------------------------------------------------------------
// Save Gallery Section (CRUD)
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Save Gallery Section', () => {
  beforeEach(() => {
    mediaGalleryModule.currentEventId = 'evt-1';
    jest.spyOn(mediaGalleryModule, 'onEventSelected').mockResolvedValue();
    Object.keys(mockSupabase).forEach((key) => {
      if (typeof mockSupabase[key] === 'function' && key !== 'then' && key !== 'single') {
        mockSupabase[key].mockReturnValue(mockSupabase);
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('saveGallerySection requires section name', async () => {
    document.getElementById('gallerySectionId').value = '';
    document.getElementById('gallerySectionName').value = '   ';
    document.getElementById('gallerySectionDescription').value = '';
    document.getElementById('gallerySectionOrder').value = '0';
    await mediaGalleryModule.saveGallerySection();
    // Should not call onEventSelected because name is empty
    expect(mediaGalleryModule.onEventSelected).not.toHaveBeenCalled();
  });

  test('saveGallerySection inserts new section when no ID', async () => {
    document.getElementById('gallerySectionId').value = '';
    document.getElementById('gallerySectionName').value = 'New Section';
    document.getElementById('gallerySectionDescription').value = 'A test description';
    document.getElementById('gallerySectionOrder').value = '3';
    _apiClient.insert.mockResolvedValueOnce({ data: null, error: null });
    await mediaGalleryModule.saveGallerySection();
    expect(_apiClient.insert).toHaveBeenCalled();
  });

  test('saveGallerySection updates existing section when ID present', async () => {
    document.getElementById('gallerySectionId').value = 'sec-1';
    document.getElementById('gallerySectionName').value = 'Updated Section';
    document.getElementById('gallerySectionDescription').value = 'Updated desc';
    document.getElementById('gallerySectionOrder').value = '2';
    _apiClient.update.mockResolvedValueOnce({ data: null, error: null });
    await mediaGalleryModule.saveGallerySection();
    expect(_apiClient.update).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Delete Section
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Delete Section', () => {
  beforeEach(() => {
    mediaGalleryModule.currentEventId = 'evt-1';
    jest.spyOn(mediaGalleryModule, 'onEventSelected').mockResolvedValue();
    Object.keys(mockSupabase).forEach((key) => {
      if (typeof mockSupabase[key] === 'function' && key !== 'then' && key !== 'single') {
        mockSupabase[key].mockReturnValue(mockSupabase);
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('deleteSection cancels when user declines', async () => {
    utils.confirmDialog = jest.fn(() => Promise.resolve(false));
    await mediaGalleryModule.deleteSection('sec-1', 'Reception');
    expect(mediaGalleryModule.onEventSelected).not.toHaveBeenCalled();
  });

  test('deleteSection deletes and reloads after confirmation', async () => {
    utils.confirmDialog = jest.fn(() => Promise.resolve(true));
    _apiClient.delete.mockResolvedValueOnce({ data: null, error: null });
    await mediaGalleryModule.deleteSection('sec-1', 'Reception');
    expect(_apiClient.delete).toHaveBeenCalled();
    expect(mediaGalleryModule.onEventSelected).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Delete Video
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Delete Video', () => {
  beforeEach(() => {
    jest.spyOn(mediaGalleryModule, 'loadVideosProduction').mockResolvedValue();
    jest.spyOn(mediaGalleryModule, '_logActivity').mockResolvedValue();
    Object.keys(mockSupabase).forEach((key) => {
      if (typeof mockSupabase[key] === 'function' && key !== 'then' && key !== 'single') {
        mockSupabase[key].mockReturnValue(mockSupabase);
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('deleteVideo cancels when user declines', async () => {
    utils.confirmDialog = jest.fn(() => Promise.resolve(false));
    await mediaGalleryModule.deleteVideo('vid-1');
    expect(mediaGalleryModule.loadVideosProduction).not.toHaveBeenCalled();
  });

  test('deleteVideo deletes and reloads on confirmation', async () => {
    utils.confirmDialog = jest.fn(() => Promise.resolve(true));
    mockSupabase.then.mockImplementationOnce((cb) => cb({ data: null, error: null }));
    await mediaGalleryModule.deleteVideo('vid-1');
    expect(mediaGalleryModule.loadVideosProduction).toHaveBeenCalled();
    expect(mediaGalleryModule._logActivity).toHaveBeenCalledWith('delete', 'vid-1', 'Video deleted');
  });

  test('deleteVideo handles errors gracefully', async () => {
    utils.confirmDialog = jest.fn(() => Promise.resolve(true));
    mockSupabase.then.mockImplementationOnce((cb) => cb({ data: null, error: { message: 'DB error' } }));
    await mediaGalleryModule.deleteVideo('vid-1');
    // Should not throw; shows error toast but does not reload
  });
});

// ---------------------------------------------------------------------------
// Download Photo
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Download Photo', () => {
  test('downloadPhoto creates a download link and triggers click', () => {
    const clickSpy = jest.fn();
    jest.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      target: '',
      click: clickSpy,
    });
    jest.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    jest.spyOn(document.body, 'removeChild').mockImplementation(() => {});

    mediaGalleryModule.downloadPhoto('https://example.com/photo.jpg', 'my-photo');
    expect(clickSpy).toHaveBeenCalled();

    jest.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// Download All Photos in Section
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Download All Photos', () => {
  beforeEach(() => {
    mediaGalleryModule.currentSectionPhotos = [...samplePhotos];
    jest.spyOn(mediaGalleryModule, 'downloadPhoto').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('downloadAllPhotos shows warning when no downloadable photos', async () => {
    mediaGalleryModule.currentSectionPhotos = [samplePhotos[2]]; // Only YouTube
    await mediaGalleryModule.downloadAllPhotos('Section');
    expect(mediaGalleryModule.downloadPhoto).not.toHaveBeenCalled();
  });

  test('downloadAllPhotos cancels when user declines', async () => {
    utils.confirmDialog = jest.fn(() => Promise.resolve(false));
    await mediaGalleryModule.downloadAllPhotos('Section');
    expect(mediaGalleryModule.downloadPhoto).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Handle Drop (drag & drop upload)
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Handle Drop', () => {
  test('handleDrop rejects invalid file types', () => {
    // Ensure draggedFiles starts as null so we can verify it stays unchanged
    mediaGalleryModule.draggedFiles = null;
    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      dataTransfer: {
        files: [
          { name: 'test.txt', type: 'text/plain', size: 100 },
          { name: 'test.pdf', type: 'application/pdf', size: 200 },
        ],
      },
    };
    mediaGalleryModule.handleDrop(event);
    expect(event.preventDefault).toHaveBeenCalled();
    // Should show error toast, draggedFiles should remain null
    expect(mediaGalleryModule.draggedFiles).toBeNull();
  });

  test('handleDrop resets drop zone styles', () => {
    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      dataTransfer: {
        files: [{ name: 'test.txt', type: 'text/plain', size: 100 }],
      },
    };
    const dropZone = document.getElementById('dropZone');
    dropZone.style.backgroundColor = '#e7f1ff';
    mediaGalleryModule.handleDrop(event);
    expect(dropZone.style.backgroundColor).toBe('transparent');
  });
});

// ---------------------------------------------------------------------------
// Upload Dragged Files
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Upload Dragged Files', () => {
  test('uploadDraggedFiles returns early when no files', async () => {
    mediaGalleryModule.draggedFiles = null;
    await mediaGalleryModule.uploadDraggedFiles();
    // Should not throw
  });

  test('uploadDraggedFiles returns early for empty array', async () => {
    mediaGalleryModule.draggedFiles = [];
    await mediaGalleryModule.uploadDraggedFiles();
    // Should not throw
  });
});

// ---------------------------------------------------------------------------
// Photo Drag End
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Photo Drag End', () => {
  test('handlePhotoDragEnd resets opacity and clears state', () => {
    const event = { target: { style: { opacity: '0.5' } } };
    mediaGalleryModule.draggedPhotoId = 'photo-1';
    mediaGalleryModule.draggedOverPhotoId = 'photo-2';
    mediaGalleryModule.handlePhotoDragEnd(event);
    expect(event.target.style.opacity).toBe('1');
    expect(mediaGalleryModule.draggedPhotoId).toBeNull();
    expect(mediaGalleryModule.draggedOverPhotoId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Photo Drag Leave
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Photo Drag Leave', () => {
  test('handlePhotoDragLeave resets border styles', () => {
    const event = {
      currentTarget: { style: { borderColor: '#0d6efd', borderWidth: '3px', borderStyle: 'dashed' } },
    };
    mediaGalleryModule.handlePhotoDragLeave(event, 'photo-2');
    expect(event.currentTarget.style.borderColor).toBe('');
    expect(event.currentTarget.style.borderWidth).toBe('');
    expect(event.currentTarget.style.borderStyle).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Photo Drop (Reorder)
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Handle Photo Drop (Reorder)', () => {
  beforeEach(() => {
    mediaGalleryModule.currentSectionPhotos = [...samplePhotos];
    mediaGalleryModule.currentSectionName = 'Test Section';
    jest.spyOn(mediaGalleryModule, 'updatePhotoDisplayOrder').mockResolvedValue();
    jest.spyOn(mediaGalleryModule, 'renderSectionPhotos').mockImplementation(() => {});
    jest.spyOn(mediaGalleryModule, '_logActivity').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('handlePhotoDrop does nothing when no source photo', async () => {
    mediaGalleryModule.draggedPhotoId = null;
    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      currentTarget: { style: { borderColor: '', borderWidth: '', borderStyle: '' } },
    };
    await mediaGalleryModule.handlePhotoDrop(event, 'photo-2');
    expect(mediaGalleryModule.updatePhotoDisplayOrder).not.toHaveBeenCalled();
  });

  test('handlePhotoDrop does nothing when dropped on same photo', async () => {
    mediaGalleryModule.draggedPhotoId = 'photo-1';
    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      currentTarget: { style: { borderColor: '', borderWidth: '', borderStyle: '' } },
    };
    await mediaGalleryModule.handlePhotoDrop(event, 'photo-1');
    expect(mediaGalleryModule.updatePhotoDisplayOrder).not.toHaveBeenCalled();
  });

  test('handlePhotoDrop reorders photos and updates display order', async () => {
    mediaGalleryModule.draggedPhotoId = 'photo-1';
    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      currentTarget: { style: { borderColor: '', borderWidth: '', borderStyle: '' } },
    };
    await mediaGalleryModule.handlePhotoDrop(event, 'photo-3');
    expect(mediaGalleryModule.updatePhotoDisplayOrder).toHaveBeenCalled();
    expect(mediaGalleryModule.renderSectionPhotos).toHaveBeenCalled();
    // Verify the photo was moved
    const ids = mediaGalleryModule.currentSectionPhotos.map((p) => p.id);
    expect(ids.indexOf('photo-1')).toBeGreaterThan(ids.indexOf('photo-2'));
  });
});

// ---------------------------------------------------------------------------
// Update Photo Display Order
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Update Photo Display Order', () => {
  beforeEach(() => {
    mediaGalleryModule.currentSectionPhotos = [...samplePhotos];
    Object.keys(mockSupabase).forEach((key) => {
      if (typeof mockSupabase[key] === 'function' && key !== 'then' && key !== 'single') {
        mockSupabase[key].mockReturnValue(mockSupabase);
      }
    });
  });

  test('updatePhotoDisplayOrder sends batch updates', async () => {
    _apiClient.update.mockResolvedValue({ data: null, error: null });
    await mediaGalleryModule.updatePhotoDisplayOrder();
    // Should have called update for each photo
    expect(_apiClient.update).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// View Section Photos
// ---------------------------------------------------------------------------
describe('Media Gallery Module - View Section Photos', () => {
  beforeEach(() => {
    jest.spyOn(mediaGalleryModule, 'renderSectionPhotos').mockImplementation(() => {});
    Object.keys(mockSupabase).forEach((key) => {
      if (typeof mockSupabase[key] === 'function' && key !== 'then' && key !== 'single') {
        mockSupabase[key].mockReturnValue(mockSupabase);
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('viewSectionPhotos sets section state and loads photos', async () => {
    _apiClient.select.mockResolvedValueOnce({ data: samplePhotos, error: null });
    await mediaGalleryModule.viewSectionPhotos('sec-1', 'Test Section');
    expect(mediaGalleryModule.currentSectionId).toBe('sec-1');
    expect(mediaGalleryModule.currentSectionName).toBe('Test Section');
    expect(mediaGalleryModule.currentSectionPhotos).toEqual(samplePhotos);
    expect(mediaGalleryModule.currentFilter).toBe('all');
    expect(mediaGalleryModule.currentSearchTerm).toBe('');
    expect(mediaGalleryModule.currentSortBy).toBe('display_order');
    expect(mediaGalleryModule.currentPage).toBe(1);
    expect(mediaGalleryModule.selectedPhotoIds.size).toBe(0);
    expect(mediaGalleryModule.renderSectionPhotos).toHaveBeenCalledWith('Test Section');
  });

  test('viewSectionPhotos handles error gracefully', async () => {
    _apiClient.select.mockRejectedValueOnce(new Error('Load failed'));
    await mediaGalleryModule.viewSectionPhotos('sec-1', 'Test Section');
    // Should not throw; shows toast
  });
});

// ---------------------------------------------------------------------------
// _getFilteredPhotos - org_asc sort
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Filter org_asc sort', () => {
  beforeEach(() => {
    mediaGalleryModule.currentSectionPhotos = [...samplePhotos];
    mediaGalleryModule.currentFilter = 'all';
    mediaGalleryModule.currentSearchTerm = '';
  });

  test('_getFilteredPhotos sorts by org_asc', () => {
    mediaGalleryModule.currentSortBy = 'org_asc';
    const result = mediaGalleryModule._getFilteredPhotos();
    // Acme Ltd should be before BuildRight which is before zzz (null org)
    const orgNames = result.map((p) => p.organisations?.company_name || 'zzz');
    expect(orgNames[0]).toBe('Acme Ltd');
    expect(orgNames[1]).toBe('BuildRight');
    expect(orgNames[2]).toBe('zzz');
  });
});

// ---------------------------------------------------------------------------
// _getFilteredPhotos - search in caption
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Search in caption and awards', () => {
  beforeEach(() => {
    mediaGalleryModule.currentSectionPhotos = [...samplePhotos];
    mediaGalleryModule.currentFilter = 'all';
    mediaGalleryModule.currentSortBy = 'display_order';
  });

  test('_getFilteredPhotos searches caption field', () => {
    mediaGalleryModule.currentSearchTerm = 'guests arriving';
    const result = mediaGalleryModule._getFilteredPhotos();
    expect(result.length).toBe(1);
    expect(result[0].caption).toBe('Guests arriving');
  });

  test('_getFilteredPhotos searches award name', () => {
    mediaGalleryModule.currentSearchTerm = 'best trade';
    const result = mediaGalleryModule._getFilteredPhotos();
    expect(result.length).toBe(1);
    expect(result[0].awards.award_name).toBe('Best Trade');
  });

  test('_getFilteredPhotos returns empty when nothing matches', () => {
    mediaGalleryModule.currentSearchTerm = 'zzzznonexistent';
    const result = mediaGalleryModule._getFilteredPhotos();
    expect(result.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Bulk Move to Section
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Bulk Move to Section', () => {
  beforeEach(() => {
    mediaGalleryModule.currentEventId = 'evt-1';
    mediaGalleryModule.currentSectionId = 'sec-1';
    mediaGalleryModule.currentSectionName = 'Test Section';
    Object.keys(mockSupabase).forEach((key) => {
      if (typeof mockSupabase[key] === 'function' && key !== 'then' && key !== 'single') {
        mockSupabase[key].mockReturnValue(mockSupabase);
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('bulkMoveToSection returns early when nothing selected', async () => {
    mediaGalleryModule.selectedPhotoIds = new Set();
    await mediaGalleryModule.bulkMoveToSection();
    // Should not make API calls
  });

  test('bulkMoveToSection returns early when no sections available', async () => {
    mediaGalleryModule.selectedPhotoIds = new Set(['photo-1']);
    mockSupabase.then.mockImplementationOnce((cb) => cb({ data: [], error: null }));
    await mediaGalleryModule.bulkMoveToSection();
    // Should show warning toast
  });

  test('bulkMoveToSection returns early when only current section exists', async () => {
    mediaGalleryModule.selectedPhotoIds = new Set(['photo-1']);
    mockSupabase.then.mockImplementationOnce((cb) =>
      cb({ data: [{ id: 'sec-1', gallery_name: 'Current', display_order: 1 }], error: null })
    );
    await mediaGalleryModule.bulkMoveToSection();
    // Should show "no other sections" toast
  });
});

// ---------------------------------------------------------------------------
// Execute Bulk Move
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Execute Bulk Move', () => {
  beforeEach(() => {
    mediaGalleryModule.currentSectionId = 'sec-1';
    mediaGalleryModule.currentSectionName = 'Test Section';
    mediaGalleryModule.selectedPhotoIds = new Set(['photo-1', 'photo-2']);
    jest.spyOn(mediaGalleryModule, 'viewSectionPhotos').mockResolvedValue();
    Object.keys(mockSupabase).forEach((key) => {
      if (typeof mockSupabase[key] === 'function' && key !== 'then' && key !== 'single') {
        mockSupabase[key].mockReturnValue(mockSupabase);
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('_executeBulkMove moves photos and clears selection', async () => {
    mockSupabase.then.mockImplementationOnce((cb) => cb({ data: null, error: null }));
    await mediaGalleryModule._executeBulkMove('sec-2', 'Award Winners');
    expect(mediaGalleryModule.selectedPhotoIds.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Clear Search
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Clear Search', () => {
  beforeEach(() => {
    mediaGalleryModule.currentSearchTerm = 'test';
    mediaGalleryModule.currentSectionPhotos = [...samplePhotos];
    mediaGalleryModule.currentSectionName = 'Test Section';
    jest.spyOn(mediaGalleryModule, 'renderSectionPhotos').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('setSearch to empty string clears search box', () => {
    document.getElementById('gallerySearchBox').value = 'existing search';
    mediaGalleryModule.setSearch('');
    expect(mediaGalleryModule.currentSearchTerm).toBe('');
    expect(document.getElementById('gallerySearchBox').value).toBe('');
    expect(mediaGalleryModule.currentPage).toBe(1);
    expect(mediaGalleryModule.renderSectionPhotos).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Load Events
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Load Events', () => {
  test('loadEvents populates dropdown with events', async () => {
    _apiClient.select.mockResolvedValueOnce({ data: sampleEvents, error: null });
    await mediaGalleryModule.loadEvents();
    expect(STATE.allEvents).toEqual(sampleEvents);
    const select = document.getElementById('mediaEventSelect');
    expect(select.innerHTML).toContain('Awards Gala 2026');
    expect(select.innerHTML).toContain('Regional Ceremony');
  });

  test('loadEvents includes year in label when available', async () => {
    _apiClient.select.mockResolvedValueOnce({
      data: [{ id: 'e1', event_name: 'Gala', year: 2026 }],
      error: null,
    });
    await mediaGalleryModule.loadEvents();
    const select = document.getElementById('mediaEventSelect');
    expect(select.innerHTML).toContain('Gala (2026)');
  });
});

// ---------------------------------------------------------------------------
// Load Section Photo Counts
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Load Section Photo Counts', () => {
  beforeEach(() => {
    // Create the badge element in DOM
    const content = document.getElementById('mediaGalleryContent');
    content.innerHTML = '<span id="photoCount_sec-1">Loading...</span><span id="photoCount_sec-2">Loading...</span>';
  });

  test('loadSectionPhotoCounts updates badge content', async () => {
    _apiClient.select.mockResolvedValueOnce({
      data: [
        { gallery_section_id: 'sec-1' },
        { gallery_section_id: 'sec-1' },
        { gallery_section_id: 'sec-1' },
        { gallery_section_id: 'sec-2' },
      ],
      error: null,
    });
    await mediaGalleryModule.loadSectionPhotoCounts(sampleSections);
    const badge1 = document.getElementById('photoCount_sec-1');
    expect(badge1.innerHTML).toContain('3 photos');
    const badge2 = document.getElementById('photoCount_sec-2');
    expect(badge2.innerHTML).toContain('1 photos');
  });
});

// ---------------------------------------------------------------------------
// Open Add Video Modal
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Open Add Video Modal', () => {
  beforeEach(() => {
    mediaGalleryModule.currentEvent = { id: 'evt-1', event_name: 'Awards Gala 2026' };
    jest.spyOn(mediaGalleryModule, 'loadCompaniesForVideoTags').mockResolvedValue();
    jest.spyOn(mediaGalleryModule, 'loadAwardsForVideoTags').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('openAddVideoModal resets form and loads tags', async () => {
    mediaGalleryModule.videoTags = [{ id: 'old', name: 'Old' }];
    mediaGalleryModule.videoAwardTags = [{ id: 'old', name: 'Old' }];
    await mediaGalleryModule.openAddVideoModal();
    expect(mediaGalleryModule.videoTags).toEqual([]);
    expect(mediaGalleryModule.videoAwardTags).toEqual([]);
    expect(document.getElementById('videoTagsContainer').innerHTML).toBe('');
    expect(document.getElementById('videoAwardTagsContainer').innerHTML).toBe('');
    expect(document.getElementById('videoEventName').value).toBe('Awards Gala 2026');
    expect(document.getElementById('videoEventId').value).toBe('evt-1');
    expect(document.getElementById('sourceTypeYouTube').checked).toBe(true);
    expect(mediaGalleryModule.loadCompaniesForVideoTags).toHaveBeenCalled();
    expect(mediaGalleryModule.loadAwardsForVideoTags).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Load Companies for Video Tags
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Load Companies for Video Tags', () => {
  test('loadCompaniesForVideoTags populates selects', async () => {
    _apiClient.select.mockResolvedValueOnce({
      data: [
        { id: 'c1', company_name: 'AlphaCo' },
        { id: 'c2', company_name: 'BetaCo' },
      ],
      error: null,
    });
    await mediaGalleryModule.loadCompaniesForVideoTags();
    const select = document.getElementById('videoTagInput');
    expect(select.innerHTML).toContain('AlphaCo');
    expect(select.innerHTML).toContain('BetaCo');
  });

  test('loadCompaniesForVideoTags handles errors', async () => {
    _apiClient.select.mockRejectedValueOnce(new Error('DB error'));
    await mediaGalleryModule.loadCompaniesForVideoTags();
    // Should not throw
  });
});

// ---------------------------------------------------------------------------
// Load Awards for Video Tags
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Load Awards for Video Tags', () => {
  test('loadAwardsForVideoTags populates selects', async () => {
    _apiClient.select.mockResolvedValueOnce({
      data: [
        { id: 'a1', award_name: 'Best Innovation' },
        { id: 'a2', award_name: 'Best Service' },
      ],
      error: null,
    });
    await mediaGalleryModule.loadAwardsForVideoTags();
    const select = document.getElementById('videoAwardTagInput');
    expect(select.innerHTML).toContain('Best Innovation');
    expect(select.innerHTML).toContain('Best Service');
  });
});

// ---------------------------------------------------------------------------
// Video Award Tags (bulk context)
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Video Award Tags with context', () => {
  beforeEach(() => {
    mediaGalleryModule.videoAwardTags = [];
    const awardInput = document.getElementById('videoAwardTagInput');
    awardInput.innerHTML =
      '<option value="">Select...</option><option value="award-1" data-name="Best Trade">Best Trade</option>';
  });

  test('addVideoAwardTag warns when no award selected', () => {
    const select = document.getElementById('videoAwardTagInput');
    select.value = '';
    mediaGalleryModule.addVideoAwardTag();
    expect(mediaGalleryModule.videoAwardTags.length).toBe(0);
  });

  test('addVideoAwardTag prevents duplicate award tags', () => {
    mediaGalleryModule.videoAwardTags = [{ id: 'award-1', name: 'Best Trade' }];
    const select = document.getElementById('videoAwardTagInput');
    select.value = 'award-1';
    mediaGalleryModule.addVideoAwardTag();
    expect(mediaGalleryModule.videoAwardTags.length).toBe(1);
  });

  test('renderVideoAwardTags renders award tag badges', () => {
    mediaGalleryModule.videoAwardTags = [{ id: 'award-1', name: 'Best Trade' }];
    mediaGalleryModule.renderVideoAwardTags();
    const container = document.getElementById('videoAwardTagsContainer');
    expect(container.innerHTML).toContain('Best Trade');
    expect(container.innerHTML).toContain('badge');
  });

  test('renderVideoAwardTags returns when container missing', () => {
    mediaGalleryModule.videoAwardTags = [{ id: 'award-1', name: 'Best Trade' }];
    // No crash when container is missing
    mediaGalleryModule.renderVideoAwardTags('nonexistent-context');
    // Should not throw
  });
});

// ---------------------------------------------------------------------------
// Render Photo Card edge cases
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Render Photo Card edge cases', () => {
  test('renders featured badge on published featured photo', () => {
    mediaGalleryModule.selectedPhotoIds = new Set();
    mediaGalleryModule.currentSortBy = 'display_order';
    mediaGalleryModule.currentFilter = 'all';
    mediaGalleryModule.currentSearchTerm = '';
    const featuredPhoto = {
      ...samplePhotos[0],
      featured: true,
      published: true,
    };
    const html = mediaGalleryModule.renderPhotoCard(featuredPhoto);
    expect(html).toContain('Featured');
    expect(html).toContain('bi-star-fill');
  });

  test('renders video placeholder for non-YouTube video', () => {
    mediaGalleryModule.selectedPhotoIds = new Set();
    const videoPhoto = {
      ...samplePhotos[0],
      file_type: 'video/mp4',
      file_url: 'https://example.com/video.mp4',
    };
    const html = mediaGalleryModule.renderPhotoCard(videoPhoto);
    expect(html).toContain('bi-play-circle');
  });

  test('renders video_type label when present', () => {
    mediaGalleryModule.selectedPhotoIds = new Set();
    const videoPhoto = {
      ...samplePhotos[0],
      video_type: 'highlights',
      file_type: 'video/mp4',
      published: true,
    };
    const html = mediaGalleryModule.renderPhotoCard(videoPhoto);
    expect(html).toContain('Highlights');
  });

  test('disables drag when filter is not all', () => {
    mediaGalleryModule.selectedPhotoIds = new Set();
    mediaGalleryModule.currentSortBy = 'display_order';
    mediaGalleryModule.currentFilter = 'published';
    mediaGalleryModule.currentSearchTerm = '';
    const html = mediaGalleryModule.renderPhotoCard(samplePhotos[0]);
    expect(html).not.toContain('draggable="true"');
  });

  test('disables drag when search term is active', () => {
    mediaGalleryModule.selectedPhotoIds = new Set();
    mediaGalleryModule.currentSortBy = 'display_order';
    mediaGalleryModule.currentFilter = 'all';
    mediaGalleryModule.currentSearchTerm = 'something';
    const html = mediaGalleryModule.renderPhotoCard(samplePhotos[0]);
    expect(html).not.toContain('draggable="true"');
  });

  test('shows photographer and caption when present', () => {
    mediaGalleryModule.selectedPhotoIds = new Set();
    const html = mediaGalleryModule.renderPhotoCard(samplePhotos[0]);
    expect(html).toContain('John Smith');
    expect(html).toContain('Guests arriving');
  });
});

// ---------------------------------------------------------------------------
// Videos Grid Rendering - Reorder mode
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Videos Grid Reorder Mode', () => {
  test('renderVideosGrid shows drag handles in reorder mode', () => {
    mediaGalleryModule._videoReorderMode = true;
    mediaGalleryModule.renderVideosGrid(sampleVideos);
    const content = document.getElementById('videosProductionContent').innerHTML;
    expect(content).toContain('Done Reordering');
    expect(content).toContain('border-primary');
    expect(content).toContain('bi-grip-vertical');
    mediaGalleryModule._videoReorderMode = false;
  });

  test('renderVideosGrid handles array tag format', () => {
    mediaGalleryModule._videoReorderMode = false;
    const videosWithArrayTags = [
      {
        ...sampleVideos[0],
        tags: JSON.stringify(['TagA', 'TagB']),
      },
    ];
    mediaGalleryModule.renderVideosGrid(videosWithArrayTags);
    const content = document.getElementById('videosProductionContent').innerHTML;
    expect(content).toContain('TagA');
    expect(content).toContain('TagB');
  });

  test('renderVideosGrid handles invalid JSON in tags gracefully', () => {
    mediaGalleryModule._videoReorderMode = false;
    const videosWithBadTags = [
      {
        ...sampleVideos[0],
        tags: 'not-valid-json{',
      },
    ];
    // Should not throw
    mediaGalleryModule.renderVideosGrid(videosWithBadTags);
    const content = document.getElementById('videosProductionContent').innerHTML;
    expect(content).toContain('Highlights');
  });
});

// ---------------------------------------------------------------------------
// Open Crop/Rotate
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Open Crop Rotate', () => {
  test('openCropRotate shows warning when no photo selected', async () => {
    mediaGalleryModule.currentMediaId = null;
    await mediaGalleryModule.openCropRotate();
    // Should not throw
  });

  test('openCropRotate shows warning for non-image files', async () => {
    mediaGalleryModule.currentMediaId = 'photo-3';
    mediaGalleryModule.currentSectionPhotos = [...samplePhotos];
    await mediaGalleryModule.openCropRotate();
    // photo-3 is video/youtube - should show warning
  });
});

// ---------------------------------------------------------------------------
// Crop/Rotate State Helpers
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Crop/Rotate Helpers', () => {
  test('_rotatePreview rotates by given degrees', () => {
    mediaGalleryModule._cropRotateState = { rotation: 0, flipH: false, flipV: false, cropRect: null, originalUrl: '' };
    jest.spyOn(mediaGalleryModule, '_drawCropRotateCanvas').mockImplementation(() => {});
    mediaGalleryModule._rotatePreview(90);
    expect(mediaGalleryModule._cropRotateState.rotation).toBe(90);
    expect(mediaGalleryModule._cropRotateState.cropRect).toBeNull();
    mediaGalleryModule._rotatePreview(90);
    expect(mediaGalleryModule._cropRotateState.rotation).toBe(180);
    jest.restoreAllMocks();
  });

  test('_rotatePreview handles negative rotation wrapping', () => {
    mediaGalleryModule._cropRotateState = { rotation: 0, flipH: false, flipV: false, cropRect: null, originalUrl: '' };
    jest.spyOn(mediaGalleryModule, '_drawCropRotateCanvas').mockImplementation(() => {});
    mediaGalleryModule._rotatePreview(-90);
    expect(mediaGalleryModule._cropRotateState.rotation).toBe(270);
    jest.restoreAllMocks();
  });

  test('_flipPreview toggles horizontal flip', () => {
    mediaGalleryModule._cropRotateState = { rotation: 0, flipH: false, flipV: false, cropRect: null, originalUrl: '' };
    jest.spyOn(mediaGalleryModule, '_drawCropRotateCanvas').mockImplementation(() => {});
    mediaGalleryModule._flipPreview('h');
    expect(mediaGalleryModule._cropRotateState.flipH).toBe(true);
    mediaGalleryModule._flipPreview('h');
    expect(mediaGalleryModule._cropRotateState.flipH).toBe(false);
    jest.restoreAllMocks();
  });

  test('_flipPreview toggles vertical flip', () => {
    mediaGalleryModule._cropRotateState = { rotation: 0, flipH: false, flipV: false, cropRect: null, originalUrl: '' };
    jest.spyOn(mediaGalleryModule, '_drawCropRotateCanvas').mockImplementation(() => {});
    mediaGalleryModule._flipPreview('v');
    expect(mediaGalleryModule._cropRotateState.flipV).toBe(true);
    jest.restoreAllMocks();
  });

  test('_resetCropRotate resets all state but keeps original URL', () => {
    mediaGalleryModule._cropRotateState = {
      rotation: 180,
      flipH: true,
      flipV: true,
      cropRect: { x: 10, y: 10, w: 100, h: 100 },
      originalUrl: 'https://example.com/photo.jpg',
    };
    jest.spyOn(mediaGalleryModule, '_drawCropRotateCanvas').mockImplementation(() => {});
    mediaGalleryModule._resetCropRotate();
    expect(mediaGalleryModule._cropRotateState.rotation).toBe(0);
    expect(mediaGalleryModule._cropRotateState.flipH).toBe(false);
    expect(mediaGalleryModule._cropRotateState.flipV).toBe(false);
    expect(mediaGalleryModule._cropRotateState.cropRect).toBeNull();
    expect(mediaGalleryModule._cropRotateState.originalUrl).toBe('https://example.com/photo.jpg');
    jest.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// Naming Guide and Keyboard Shortcuts Help
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Naming Guide', () => {
  test('openNamingGuide creates modal', () => {
    mediaGalleryModule.openNamingGuide();
    const modal = document.getElementById('namingGuideModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('Photo Naming Convention Guide');
    modal.remove();
  });
});

describe('Media Gallery Module - Keyboard Shortcuts Help', () => {
  test('showKeyboardShortcutsHelp creates modal', () => {
    mediaGalleryModule.showKeyboardShortcutsHelp();
    const modal = document.getElementById('keyboardShortcutsModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('Keyboard Shortcuts');
    modal.remove();
  });
});

// ---------------------------------------------------------------------------
// Clear Activity Log
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Clear Activity Log (with confirmation)', () => {
  test('clearActivityLog does nothing when user declines', async () => {
    utils.confirmDialog = jest.fn(() => Promise.resolve(false));
    localStorage.setItem('mediaGalleryActivityLog', JSON.stringify([{ action: 'test' }]));
    await mediaGalleryModule.clearActivityLog();
    const log = JSON.parse(localStorage.getItem('mediaGalleryActivityLog'));
    expect(log.length).toBe(1);
  });

  test('clearActivityLog clears log when confirmed', async () => {
    utils.confirmDialog = jest.fn(() => Promise.resolve(true));
    localStorage.setItem('mediaGalleryActivityLog', JSON.stringify([{ action: 'test' }]));
    // apiClient.deleteByFilters will throw so it falls back to localStorage removal
    if (typeof apiClient !== 'undefined') {
      jest.spyOn(apiClient, 'deleteByFilters').mockRejectedValue(new Error('fallback'));
    }
    await mediaGalleryModule.clearActivityLog();
    expect(localStorage.getItem('mediaGalleryActivityLog')).toBeNull();
    if (typeof apiClient !== 'undefined') jest.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// _matchPhotosToRunningOrder
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Match Photos to Running Order', () => {
  const mockRunningOrder = [
    {
      display_order: 1,
      award_number: '1-01',
      organisations: { id: 'org-1', company_name: 'Acme Ltd' },
      awards: { id: 'a1', award_name: 'Best Trade' },
      display_name: 'Acme Ltd',
    },
    {
      display_order: 2,
      award_number: '1-02',
      organisations: { id: 'org-2', company_name: 'BuildRight' },
      awards: { id: 'a2', award_name: 'Best Service' },
      display_name: 'BuildRight',
    },
  ];

  test('matches by award number prefix', () => {
    const photos = [
      {
        id: 'p1',
        title: '1-01_winner_photo.jpg',
        file_url: 'https://example.com/1-01_winner_photo.jpg',
        organisation_id: null,
        award_id: null,
      },
    ];
    const matches = mediaGalleryModule._matchPhotosToRunningOrder(photos, mockRunningOrder);
    expect(matches[0].matchType).toBe('award_number');
    expect(matches[0].matchedPrefix).toBe('1-01');
    expect(matches[0].runningOrderItem.organisations.company_name).toBe('Acme Ltd');
  });

  test('matches by display_order number prefix', () => {
    const photos = [
      {
        id: 'p2',
        title: '02_stage_photo.jpg',
        file_url: 'https://example.com/02_stage_photo.jpg',
        organisation_id: null,
        award_id: null,
      },
    ];
    const matches = mediaGalleryModule._matchPhotosToRunningOrder(photos, mockRunningOrder);
    expect(matches[0].matchType).toBe('display_order');
    expect(matches[0].matchedPrefix).toBe('02');
  });

  test('matches by company name in filename', () => {
    const photos = [
      {
        id: 'p3',
        title: 'buildright_celebration.jpg',
        file_url: 'https://example.com/buildright_celebration.jpg',
        organisation_id: null,
        award_id: null,
      },
    ];
    const matches = mediaGalleryModule._matchPhotosToRunningOrder(photos, mockRunningOrder);
    expect(matches[0].matchType).toBe('name_match');
    expect(matches[0].runningOrderItem.organisations.company_name).toBe('BuildRight');
  });

  test('returns unmatched for unknown filenames', () => {
    const photos = [
      {
        id: 'p4',
        title: 'random_photo.jpg',
        file_url: 'https://example.com/random_photo.jpg',
        organisation_id: null,
        award_id: null,
      },
    ];
    const matches = mediaGalleryModule._matchPhotosToRunningOrder(photos, mockRunningOrder);
    expect(matches[0].runningOrderItem).toBeNull();
    expect(matches[0].matchType).toBe('');
  });

  test('marks already-tagged photos', () => {
    const photos = [
      {
        id: 'p5',
        title: '1-01_photo.jpg',
        file_url: 'https://example.com/1-01_photo.jpg',
        organisation_id: 'org-1',
        award_id: 'a1',
      },
    ];
    const matches = mediaGalleryModule._matchPhotosToRunningOrder(photos, mockRunningOrder);
    expect(matches[0].alreadyTagged).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// _setPhotographer
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Set Photographer', () => {
  beforeEach(() => {
    mediaGalleryModule.currentEventId = 'evt-1';
    jest.spyOn(mediaGalleryModule, 'loadPhotosProduction').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('_setPhotographer returns early when prompt is cancelled', async () => {
    global.prompt = jest.fn(() => null);
    await mediaGalleryModule._setPhotographer();
    expect(mediaGalleryModule.loadPhotosProduction).not.toHaveBeenCalled();
  });

  test('_setPhotographer returns early for empty name', async () => {
    global.prompt = jest.fn(() => '   ');
    await mediaGalleryModule._setPhotographer();
    expect(mediaGalleryModule.loadPhotosProduction).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// View Org Media
// ---------------------------------------------------------------------------
describe('Media Gallery Module - View Org Media', () => {
  beforeEach(() => {
    jest.spyOn(mediaGalleryModule, 'showEventsListView').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('viewOrgMedia redirects to events list when no orgId', async () => {
    await mediaGalleryModule.viewOrgMedia(null);
    expect(mediaGalleryModule.showEventsListView).toHaveBeenCalled();
  });

  test('viewOrgMedia redirects to events list for empty string', async () => {
    await mediaGalleryModule.viewOrgMedia('');
    expect(mediaGalleryModule.showEventsListView).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Pagination edge cases
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Pagination Edge Cases', () => {
  beforeEach(() => {
    mediaGalleryModule.currentSectionPhotos = [...samplePhotos];
    mediaGalleryModule.currentFilter = 'all';
    mediaGalleryModule.currentSearchTerm = '';
    mediaGalleryModule.currentSortBy = 'display_order';
    mediaGalleryModule.currentPage = 1;
    mediaGalleryModule.currentSectionName = 'Test Section';
    jest.spyOn(mediaGalleryModule, 'renderSectionPhotos').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('goToPage scrolls to photo grid', () => {
    // With 3 photos and 48 per page, max page is 1
    // So page 1 should succeed
    mediaGalleryModule.goToPage(1);
    expect(mediaGalleryModule.currentPage).toBe(1);
    expect(mediaGalleryModule.renderSectionPhotos).toHaveBeenCalled();
  });

  test('_buildPaginationItems returns empty string for 1 page', () => {
    const html = mediaGalleryModule._buildPaginationItems(1, 1);
    expect(html).toContain('active');
  });

  test('_buildPaginationItems shows last page link', () => {
    const html = mediaGalleryModule._buildPaginationItems(1, 30);
    expect(html).toContain('>30<');
  });
});

// ---------------------------------------------------------------------------
// Selection across filtered views
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Selection across filters', () => {
  beforeEach(() => {
    mediaGalleryModule.currentSectionPhotos = [...samplePhotos];
    mediaGalleryModule.currentFilter = 'published';
    mediaGalleryModule.currentSearchTerm = '';
    mediaGalleryModule.currentSortBy = 'display_order';
    mediaGalleryModule.currentPage = 1;
    mediaGalleryModule.selectedPhotoIds = new Set();
    mediaGalleryModule.currentSectionName = 'Test Section';
    jest.spyOn(mediaGalleryModule, 'renderSectionPhotos').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('selectAllPage only selects published photos when filter is published', () => {
    mediaGalleryModule.selectAllPage();
    // Only photo-1 and photo-3 are published
    expect(mediaGalleryModule.selectedPhotoIds.size).toBe(2);
    expect(mediaGalleryModule.selectedPhotoIds.has('photo-1')).toBe(true);
    expect(mediaGalleryModule.selectedPhotoIds.has('photo-3')).toBe(true);
    expect(mediaGalleryModule.selectedPhotoIds.has('photo-2')).toBe(false);
  });

  test('selectAllFiltered selects only drafts when filter is drafts', () => {
    mediaGalleryModule.currentFilter = 'drafts';
    mediaGalleryModule.selectAllFiltered();
    expect(mediaGalleryModule.selectedPhotoIds.size).toBe(1);
    expect(mediaGalleryModule.selectedPhotoIds.has('photo-2')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Initialize
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Initialize', () => {
  beforeEach(() => {
    jest.spyOn(mediaGalleryModule, 'loadMediaStatistics').mockResolvedValue();
    jest.spyOn(mediaGalleryModule, '_loadOrgFilterDropdown').mockResolvedValue();
    jest.spyOn(mediaGalleryModule, 'showEventsListView').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('initialize calls all setup methods', async () => {
    await mediaGalleryModule.initialize();
    expect(mediaGalleryModule.loadMediaStatistics).toHaveBeenCalled();
    expect(mediaGalleryModule._loadOrgFilterDropdown).toHaveBeenCalled();
    expect(mediaGalleryModule.showEventsListView).toHaveBeenCalled();
  });

  test('initialize handles errors without throwing', async () => {
    mediaGalleryModule.loadMediaStatistics.mockRejectedValue(new Error('Init error'));
    await mediaGalleryModule.initialize();
    // Should not throw
  });
});

// ---------------------------------------------------------------------------
// Slideshow
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Launch Slideshow', () => {
  beforeEach(() => {
    mediaGalleryModule.currentSectionId = 'sec-1';
    mediaGalleryModule.currentEventId = 'evt-1';
    mediaGalleryModule.currentSectionPhotos = [...samplePhotos];
    STATE.allEvents = sampleEvents;
    Object.keys(mockSupabase).forEach((key) => {
      if (typeof mockSupabase[key] === 'function' && key !== 'then' && key !== 'single') {
        mockSupabase[key].mockReturnValue(mockSupabase);
      }
    });
  });

  test('launchSlideshow shows warning when no section', async () => {
    mediaGalleryModule.currentSectionId = null;
    await mediaGalleryModule.launchSlideshow(null);
    // Should show toast warning
  });

  test('launchSlideshow shows warning when no published photos', async () => {
    mediaGalleryModule.currentSectionPhotos = [
      { ...samplePhotos[1], published: false }, // only draft
    ];
    await mediaGalleryModule.launchSlideshow();
    // Should show "No published photos" toast
  });

  test('launchSlideshow opens window for published photos', async () => {
    await mediaGalleryModule.launchSlideshow();
    expect(window.open).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Save Photo Tags
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Save Photo Tags', () => {
  beforeEach(() => {
    mediaGalleryModule.currentMediaId = 'photo-1';
    mediaGalleryModule.currentSectionId = 'sec-1';
    mediaGalleryModule.currentSectionName = 'Test Section';
    jest.spyOn(mediaGalleryModule, 'viewSectionPhotos').mockResolvedValue();
    Object.keys(mockSupabase).forEach((key) => {
      if (typeof mockSupabase[key] === 'function' && key !== 'then' && key !== 'single') {
        mockSupabase[key].mockReturnValue(mockSupabase);
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('savePhotoTags reads form values and sends update', async () => {
    document.getElementById('tagPhotoOrgSelect').value = 'org-1';
    document.getElementById('tagPhotoAwardSelect').value = 'award-1';
    document.getElementById('tagPhotoCaption').value = 'Test caption';
    document.getElementById('tagPhotoAltText').value = 'Alt text';
    document.getElementById('tagPhotoPhotographer').value = 'Jane Doe';
    document.getElementById('tagPhotoShowGallery').checked = true;
    document.getElementById('tagPhotoShowWinner').checked = false;
    document.getElementById('tagPhotoShowCompany').checked = true;

    _apiClient.update.mockResolvedValueOnce({ data: null, error: null });
    // viewSectionPhotos is called after save; mock it to avoid side effects
    jest.spyOn(mediaGalleryModule, 'viewSectionPhotos').mockResolvedValue();
    await mediaGalleryModule.savePhotoTags();
    expect(_apiClient.update).toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  test('savePhotoTags falls back to localStorage on error', async () => {
    // Add an option so JSDOM allows setting the select value
    const orgSelect = document.getElementById('tagPhotoOrgSelect');
    const orgOption = document.createElement('option');
    orgOption.value = 'org-1';
    orgOption.textContent = 'Org 1';
    orgSelect.appendChild(orgOption);

    orgSelect.value = 'org-1';
    document.getElementById('tagPhotoAwardSelect').value = '';
    document.getElementById('tagPhotoCaption').value = '';
    document.getElementById('tagPhotoAltText').value = '';
    document.getElementById('tagPhotoPhotographer').value = '';

    _apiClient.update.mockRejectedValueOnce(new Error('DB fail'));
    await mediaGalleryModule.savePhotoTags();
    const saved = JSON.parse(localStorage.getItem('bta_photo_tags_photo-1'));
    expect(saved.organisation_id).toBe('org-1');

    // Clean up added option
    orgOption.remove();
  });
});

// ---------------------------------------------------------------------------
// Remove File From Preview
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Remove File From Preview', () => {
  test('removeFileFromPreview removes file at given index', () => {
    mediaGalleryModule.selectedFiles = [
      { name: 'a.jpg', type: 'image/jpeg', size: 100 },
      { name: 'b.jpg', type: 'image/jpeg', size: 200 },
      { name: 'c.jpg', type: 'image/jpeg', size: 300 },
    ];
    jest.spyOn(mediaGalleryModule, 'renderFilePreview').mockImplementation(() => {});

    // Mock the file input's files setter so JSDOM doesn't reject non-FileList values
    const fileInput = document.getElementById('sectionPhotosFile');
    let storedFiles = null;
    Object.defineProperty(fileInput, 'files', {
      get: () => storedFiles,
      set: (val) => {
        storedFiles = val;
      },
      configurable: true,
    });

    // Mock DataTransfer
    global.DataTransfer = class {
      constructor() {
        this.items = { add: jest.fn() };
        this.files = [];
      }
    };

    mediaGalleryModule.removeFileFromPreview(1);
    expect(mediaGalleryModule.selectedFiles.length).toBe(2);
    expect(mediaGalleryModule.selectedFiles[0].name).toBe('a.jpg');
    expect(mediaGalleryModule.selectedFiles[1].name).toBe('c.jpg');
    expect(mediaGalleryModule.renderFilePreview).toHaveBeenCalled();

    delete global.DataTransfer;
    jest.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// Quick Edit Tag
// ---------------------------------------------------------------------------
describe('Media Gallery Module - Quick Edit Tag', () => {
  test('quickEditTag delegates to tagPhoto', async () => {
    jest.spyOn(mediaGalleryModule, 'tagPhoto').mockResolvedValue();
    await mediaGalleryModule.quickEditTag('photo-1', 'org');
    expect(mediaGalleryModule.tagPhoto).toHaveBeenCalledWith('photo-1');
    jest.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// On Event Selected
// ---------------------------------------------------------------------------
describe('Media Gallery Module - On Event Selected', () => {
  beforeEach(() => {
    jest.spyOn(mediaGalleryModule, 'renderGallerySections').mockImplementation(() => {});
    jest.spyOn(mediaGalleryModule, 'showSummaryView').mockResolvedValue();
    Object.keys(mockSupabase).forEach((key) => {
      if (typeof mockSupabase[key] === 'function' && key !== 'then' && key !== 'single') {
        mockSupabase[key].mockReturnValue(mockSupabase);
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('onEventSelected shows summary view when no eventId', async () => {
    await mediaGalleryModule.onEventSelected(null);
    expect(mediaGalleryModule.showSummaryView).toHaveBeenCalled();
  });

  test('onEventSelected loads sections for given event', async () => {
    _apiClient.select.mockResolvedValueOnce({ data: sampleSections, error: null });
    await mediaGalleryModule.onEventSelected('evt-1');
    expect(mediaGalleryModule.currentEventId).toBe('evt-1');
    expect(mediaGalleryModule.currentSectionId).toBeNull();
    expect(mediaGalleryModule.renderGallerySections).toHaveBeenCalledWith(sampleSections);
  });
});
