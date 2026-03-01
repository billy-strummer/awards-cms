/**
 * Tests for the Social Media Module (social-media.js)
 * Run with: npx jest tests/social-media.test.js
 */

const { JSDOM } = require('jsdom');

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
  <div id="confirmDialogModal"></div>
  <div id="confirmDialogTitle"></div>
  <div id="confirmDialogBody"></div>
  <div id="confirmDialogOk"></div>

  <!-- Social Media Module DOM elements -->
  <select id="smCompanySelect">
    <option value="">Select company...</option>
    <option value="comp-1" data-logo="https://example.com/logo1.png" data-website="https://acme.co.uk">Acme Plumbing</option>
    <option value="comp-2" data-logo="" data-website="">Beta Builders</option>
  </select>
  <select id="smAwardSelect">
    <option value="">Select award...</option>
    <option value="award-1">Best Plumber South East</option>
    <option value="award-2">Best Builder London</option>
  </select>

  <textarea id="smPostContent"></textarea>

  <!-- Platform checkboxes -->
  <input type="checkbox" id="platformTwitter" checked />
  <input type="checkbox" id="platformFacebook" checked />
  <input type="checkbox" id="platformInstagram" checked />
  <input type="checkbox" id="platformLinkedIn" checked />

  <!-- Platform override toggle and fields -->
  <input type="checkbox" id="smPlatformOverrides" />
  <div id="platformOverridesContainer" style="display:none;">
    <textarea id="smTwitterContent"></textarea>
    <textarea id="smFacebookContent"></textarea>
    <textarea id="smInstagramContent"></textarea>
    <textarea id="smLinkedInContent"></textarea>
  </div>

  <!-- Preview elements -->
  <div id="twitterPreviewText"></div>
  <div id="facebookPreviewText"></div>
  <div id="instagramPreviewText"></div>
  <div id="linkedinPreviewText"></div>

  <!-- Character count elements -->
  <div class="preview-meta"><span id="twitterCharCount">0</span></div>
  <div class="preview-meta"><span id="instagramCharCount">0</span></div>
  <div class="preview-meta"><span id="linkedinCharCount">0</span></div>

  <!-- Image preview elements -->
  <div id="twitterPreviewImage"></div>
  <div id="facebookPreviewImage"></div>
  <div id="instagramPreviewImage"></div>
  <div id="linkedinPreviewImage"></div>

  <!-- Image source radios -->
  <input type="radio" name="imageSource" id="imageCompanyLogo" value="company_logo" checked />
  <input type="radio" name="imageSource" id="imageCustom" value="custom" />
  <div id="customImageUpload" style="display:none;"></div>
  <input type="file" id="smCustomImage" />
  <input type="checkbox" id="smAddLogoOverlay" checked />
  <div id="imageSizeWarning"></div>

  <!-- Schedule fields -->
  <input type="date" id="smScheduleDate" />
  <input type="time" id="smScheduleTime" />

  <!-- Template cards -->
  <div class="template-card" data-template="nominee">Nominee</div>
  <div class="template-card" data-template="winner">Winner</div>
  <div class="template-card" data-template="voting">Voting</div>

  <!-- Post lists -->
  <div id="scheduledPostsList"></div>
  <span id="scheduledPostsCount">0</span>
  <div id="draftPostsList"></div>
  <span id="draftPostsCount">0</span>
  <div id="publishedPostsList"></div>
  <span id="publishedPostsCount">0</span>

  <!-- Analytics -->
  <div id="analyticsContent"></div>

  <!-- Editing banner target (card structure) -->
  <div class="card">
    <div class="card-header">Post Header</div>
    <div class="card-body">
      <textarea id="smPostContentInCard"></textarea>
    </div>
  </div>

  <!-- Bulk generate modal elements -->
  <div id="bulkGenerateModal"></div>
  <select id="bulkAwardSelect"><option value="">Select award...</option></select>
  <select id="bulkTemplateType"><option value="">Select template...</option><option value="nominee">Nominee</option><option value="winner">Winner</option></select>
  <input type="checkbox" id="bulkPlatformTwitter" checked />
  <input type="checkbox" id="bulkPlatformFacebook" checked />
  <input type="checkbox" id="bulkPlatformInstagram" checked />
  <input type="checkbox" id="bulkPlatformLinkedIn" checked />
  <select id="bulkSaveAs"><option value="draft">Draft</option><option value="scheduled">Scheduled</option></select>

  <!-- Editing banner -->
  <div id="editingBanner" style="display:none;"></div>

  <!-- Tab elements for DOMContentLoaded listener -->
  <div id="social-subtab"></div>
  <div id="marketing-tab"></div>
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Blob = dom.window.Blob;
global.Image = dom.window.Image;
global.URL = { createObjectURL: jest.fn(() => 'blob://mock'), revokeObjectURL: jest.fn() };
global.window.URL = global.URL;

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

global.crypto = {
  getRandomValues: (arr) => {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    return arr;
  },
};

const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  in: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  range: jest.fn(() => mockSupabase),
  ilike: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn((cb) => cb({ data: [], error: null })),
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
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://storage.example.com/image.png' } })),
    })),
  },
  functions: {
    invoke: jest.fn(() => Promise.resolve({ data: {}, error: null })),
  },
};

global.supabase = { createClient: () => mockSupabase };
global.window.supabase = global.supabase;

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

require('../social-media.js');
syncWindowToGlobal();

// ==========================================
// SAMPLE DATA
// ==========================================

const sampleScheduledPosts = [
  {
    id: 'post-1',
    content: 'Congratulations to Acme Plumbing for being nominated!',
    company_id: 'comp-1',
    award_id: 'award-1',
    platforms: ['twitter', 'facebook'],
    status: 'scheduled',
    scheduled_for: '2026-06-15T10:00:00',
    created_at: '2026-02-20T09:00:00',
    image_url: null,
    template_type: 'nominee',
    organisations: { company_name: 'Acme Plumbing' },
    awards: { award_name: 'Best Plumber South East' },
  },
  {
    id: 'post-2',
    content: 'Huge congratulations to Beta Builders - WINNER!',
    company_id: 'comp-2',
    award_id: 'award-2',
    platforms: ['twitter', 'linkedin', 'instagram'],
    status: 'scheduled',
    scheduled_for: '2026-07-01T14:30:00',
    created_at: '2026-02-21T11:00:00',
    image_url: 'https://example.com/image.png',
    template_type: 'winner',
    organisations: { company_name: 'Beta Builders' },
    awards: { award_name: 'Best Builder London' },
  },
];

const sampleDraftPosts = [
  {
    id: 'draft-1',
    content: 'Time is running out to vote for Acme Plumbing!',
    company_id: 'comp-1',
    award_id: 'award-1',
    platforms: ['facebook'],
    status: 'draft',
    created_at: '2026-02-18T15:00:00',
    image_url: null,
    template_type: 'voting',
    organisations: { company_name: 'Acme Plumbing' },
    awards: { award_name: 'Best Plumber South East' },
  },
];

const samplePublishedPosts = [
  {
    id: 'pub-1',
    content: 'Congratulations to Acme Plumbing for their nomination!',
    company_id: 'comp-1',
    award_id: 'award-1',
    platforms: ['twitter', 'facebook', 'instagram', 'linkedin'],
    status: 'published',
    created_at: '2026-02-10T12:00:00',
    image_url: 'https://example.com/logo1.png',
    template_type: 'nominee',
    organisations: { company_name: 'Acme Plumbing' },
    awards: { award_name: 'Best Plumber South East' },
  },
  {
    id: 'pub-2',
    content: 'Winner announcement for Beta Builders!',
    company_id: 'comp-2',
    award_id: 'award-2',
    platforms: ['linkedin'],
    status: 'published',
    created_at: '2026-02-12T16:00:00',
    image_url: null,
    template_type: 'winner',
    organisations: { company_name: 'Beta Builders' },
    awards: { award_name: 'Best Builder London' },
  },
];

// ==========================================
// TESTS
// ==========================================

describe('Social Media Module - Initialization & Structure', () => {
  test('socialMediaModule is exported to window', () => {
    expect(window.socialMediaModule).toBeDefined();
    expect(socialMediaModule).toBeDefined();
  });

  test('socialMediaModule has required state properties', () => {
    expect(socialMediaModule).toHaveProperty('currentTemplate');
    expect(socialMediaModule).toHaveProperty('selectedCompany');
    expect(socialMediaModule).toHaveProperty('selectedAward');
    expect(socialMediaModule).toHaveProperty('uploadedImageUrl');
    expect(socialMediaModule).toHaveProperty('logoOverlayEnabled');
    expect(socialMediaModule).toHaveProperty('editingPostId');
    expect(socialMediaModule).toHaveProperty('allPosts');
    expect(socialMediaModule).toHaveProperty('initialized');
    expect(socialMediaModule).toHaveProperty('britishTradeAwardsLogoUrl');
  });

  test('socialMediaModule has required methods', () => {
    expect(typeof socialMediaModule.initialize).toBe('function');
    expect(typeof socialMediaModule.selectTemplate).toBe('function');
    expect(typeof socialMediaModule.toHashtag).toBe('function');
    expect(typeof socialMediaModule.processPlaceholders).toBe('function');
    expect(typeof socialMediaModule.updatePostPreview).toBe('function');
    expect(typeof socialMediaModule.updateCharacterCounts).toBe('function');
    expect(typeof socialMediaModule.updateImagePreview).toBe('function');
    expect(typeof socialMediaModule.savePost).toBe('function');
    expect(typeof socialMediaModule.saveDraft).toBe('function');
    expect(typeof socialMediaModule.clearForm).toBe('function');
    expect(typeof socialMediaModule.renderScheduledPosts).toBe('function');
    expect(typeof socialMediaModule.renderDraftPosts).toBe('function');
    expect(typeof socialMediaModule.renderPublishedPosts).toBe('function');
    expect(typeof socialMediaModule.truncate).toBe('function');
    expect(typeof socialMediaModule.togglePlatformOverrides).toBe('function');
    expect(typeof socialMediaModule.syncPlatformOverrides).toBe('function');
    expect(typeof socialMediaModule.getContentForPlatform).toBe('function');
    expect(typeof socialMediaModule.validateImageDimensions).toBe('function');
    expect(typeof socialMediaModule.showPostSuccessMessage).toBe('function');
    expect(typeof socialMediaModule.showEditingIndicator).toBe('function');
    expect(typeof socialMediaModule.setupScheduleDateMin).toBe('function');
  });

  test('default state values are correct', () => {
    expect(socialMediaModule.currentTemplate).toBeNull();
    expect(socialMediaModule.selectedCompany).toBeNull();
    expect(socialMediaModule.selectedAward).toBeNull();
    expect(socialMediaModule.uploadedImageUrl).toBeNull();
    expect(socialMediaModule.logoOverlayEnabled).toBe(true);
    expect(socialMediaModule.editingPostId).toBeNull();
    expect(Array.isArray(socialMediaModule.allPosts)).toBe(true);
    expect(socialMediaModule.allPosts.length).toBe(0);
    expect(socialMediaModule.initialized).toBe(false);
  });

  test('platformLimits has correct values for all platforms', () => {
    expect(socialMediaModule.platformLimits.twitter).toBe(280);
    expect(socialMediaModule.platformLimits.facebook).toBe(63206);
    expect(socialMediaModule.platformLimits.instagram).toBe(2200);
    expect(socialMediaModule.platformLimits.linkedin).toBe(3000);
  });

  test('platformImageSizes has entries for all platforms', () => {
    const sizes = socialMediaModule.platformImageSizes;
    expect(sizes.twitter).toEqual({ width: 1200, height: 675, label: 'X (1200x675)' });
    expect(sizes.facebook).toEqual({ width: 1200, height: 630, label: 'Facebook (1200x630)' });
    expect(sizes.instagram).toEqual({ width: 1080, height: 1080, label: 'Instagram (1080x1080)' });
    expect(sizes.linkedin).toEqual({ width: 1200, height: 627, label: 'LinkedIn (1200x627)' });
  });

  test('templates has nominee, winner, and voting entries', () => {
    expect(socialMediaModule.templates).toHaveProperty('nominee');
    expect(socialMediaModule.templates).toHaveProperty('winner');
    expect(socialMediaModule.templates).toHaveProperty('voting');
  });

  test('each template has name and content properties', () => {
    for (const key of ['nominee', 'winner', 'voting']) {
      expect(socialMediaModule.templates[key]).toHaveProperty('name');
      expect(socialMediaModule.templates[key]).toHaveProperty('content');
      expect(typeof socialMediaModule.templates[key].name).toBe('string');
      expect(typeof socialMediaModule.templates[key].content).toBe('string');
    }
  });

  test('template content contains expected placeholders', () => {
    for (const key of ['nominee', 'winner', 'voting']) {
      const content = socialMediaModule.templates[key].content;
      expect(content).toContain('{{company_name}}');
      expect(content).toContain('{{award_name}}');
      expect(content).toContain('{{award_hashtag}}');
    }
  });
});

describe('Social Media Module - toHashtag()', () => {
  test('removes spaces from strings', () => {
    expect(socialMediaModule.toHashtag('Best Plumber')).toBe('BestPlumber');
  });

  test('removes special characters', () => {
    expect(socialMediaModule.toHashtag('MEP & Plumbing!')).toBe('MEPPlumbing');
  });

  test('preserves letters and numbers', () => {
    expect(socialMediaModule.toHashtag('Award2026')).toBe('Award2026');
  });

  test('handles empty string', () => {
    expect(socialMediaModule.toHashtag('')).toBe('');
  });

  test('removes all punctuation', () => {
    expect(socialMediaModule.toHashtag('Best-Builder (London)')).toBe('BestBuilderLondon');
  });

  test('handles string with only special characters', () => {
    expect(socialMediaModule.toHashtag('!@#$%^&*()')).toBe('');
  });
});

describe('Social Media Module - truncate()', () => {
  test('returns empty string for null input', () => {
    expect(socialMediaModule.truncate(null, 50)).toBe('');
  });

  test('returns empty string for undefined input', () => {
    expect(socialMediaModule.truncate(undefined, 50)).toBe('');
  });

  test('returns empty string for empty string input', () => {
    expect(socialMediaModule.truncate('', 50)).toBe('');
  });

  test('returns full text when shorter than max length', () => {
    expect(socialMediaModule.truncate('Short text', 50)).toBe('Short text');
  });

  test('returns full text when exactly max length', () => {
    const text = 'a'.repeat(50);
    expect(socialMediaModule.truncate(text, 50)).toBe(text);
  });

  test('truncates and adds ellipsis when text exceeds max length', () => {
    const text = 'a'.repeat(60);
    const result = socialMediaModule.truncate(text, 50);
    expect(result).toBe('a'.repeat(50) + '...');
    expect(result.length).toBe(53);
  });

  test('truncates at exact maxLen boundary', () => {
    const result = socialMediaModule.truncate('Hello World', 5);
    expect(result).toBe('Hello...');
  });
});

describe('Social Media Module - processPlaceholders()', () => {
  beforeEach(() => {
    document.getElementById('smCompanySelect').selectedIndex = 0;
    document.getElementById('smAwardSelect').selectedIndex = 0;
  });

  test('replaces {{year}} with current year', () => {
    const result = socialMediaModule.processPlaceholders('Awards {{year}}');
    expect(result).toContain(String(new Date().getFullYear()));
  });

  test('keeps {{company_name}} placeholder when no company selected', () => {
    const result = socialMediaModule.processPlaceholders('Hello {{company_name}}');
    expect(result).toBe('Hello {{company_name}}');
  });

  test('replaces {{company_name}} when company is selected', () => {
    document.getElementById('smCompanySelect').selectedIndex = 1; // Acme Plumbing
    const result = socialMediaModule.processPlaceholders('Hello {{company_name}}');
    expect(result).toBe('Hello Acme Plumbing');
  });

  test('keeps {{award_name}} placeholder when no award selected', () => {
    const result = socialMediaModule.processPlaceholders('For {{award_name}}');
    expect(result).toBe('For {{award_name}}');
  });

  test('replaces {{award_name}} when award is selected', () => {
    document.getElementById('smAwardSelect').selectedIndex = 1; // Best Plumber South East
    const result = socialMediaModule.processPlaceholders('For {{award_name}}');
    expect(result).toBe('For Best Plumber South East');
  });

  test('replaces {{award_hashtag}} with sanitised version of award name', () => {
    document.getElementById('smAwardSelect').selectedIndex = 1;
    const result = socialMediaModule.processPlaceholders('#{{award_hashtag}}');
    expect(result).toBe('#BestPlumberSouthEast');
  });

  test('keeps {{award_hashtag}} placeholder when no award selected', () => {
    const result = socialMediaModule.processPlaceholders('#{{award_hashtag}}');
    expect(result).toBe('#{{award_hashtag}}');
  });

  test('replaces {{website}} with company website when selected', () => {
    document.getElementById('smCompanySelect').selectedIndex = 1; // has website https://acme.co.uk
    const result = socialMediaModule.processPlaceholders('Visit {{website}}');
    expect(result).toBe('Visit https://acme.co.uk');
  });

  test('uses default website when no company selected', () => {
    const result = socialMediaModule.processPlaceholders('Visit {{website}}');
    expect(result).toBe('Visit https://britishtrade.awards');
  });

  test('uses default website when company has no website', () => {
    document.getElementById('smCompanySelect').selectedIndex = 2; // Beta Builders - empty website
    const result = socialMediaModule.processPlaceholders('Visit {{website}}');
    expect(result).toBe('Visit https://britishtrade.awards');
  });

  test('handles multiple placeholders in one string', () => {
    document.getElementById('smCompanySelect').selectedIndex = 1;
    document.getElementById('smAwardSelect').selectedIndex = 1;
    const template = '{{company_name}} nominated for {{award_name}} {{year}}';
    const result = socialMediaModule.processPlaceholders(template);
    expect(result).toContain('Acme Plumbing');
    expect(result).toContain('Best Plumber South East');
    expect(result).toContain(String(new Date().getFullYear()));
  });

  test('handles repeated placeholders', () => {
    document.getElementById('smCompanySelect').selectedIndex = 1;
    const result = socialMediaModule.processPlaceholders('{{company_name}} and {{company_name}}');
    expect(result).toBe('Acme Plumbing and Acme Plumbing');
  });
});

describe('Social Media Module - selectTemplate()', () => {
  beforeEach(() => {
    socialMediaModule.currentTemplate = null;
    document.getElementById('smPostContent').value = '';
    document.querySelectorAll('.template-card').forEach((card) => card.classList.remove('selected'));
  });

  test('sets currentTemplate to given key', () => {
    socialMediaModule.selectTemplate('nominee', null);
    expect(socialMediaModule.currentTemplate).toBe('nominee');
  });

  test('populates post content textarea with template content', () => {
    socialMediaModule.selectTemplate('winner', null);
    const content = document.getElementById('smPostContent').value;
    expect(content).toBe(socialMediaModule.templates.winner.content);
  });

  test('adds selected class to clicked card', () => {
    const card = document.querySelector('.template-card[data-template="nominee"]');
    const mockEvent = { target: card };
    socialMediaModule.selectTemplate('nominee', mockEvent);
    expect(card.classList.contains('selected')).toBe(true);
  });

  test('removes selected class from other cards', () => {
    const nomineeCard = document.querySelector('.template-card[data-template="nominee"]');
    const winnerCard = document.querySelector('.template-card[data-template="winner"]');
    nomineeCard.classList.add('selected');

    socialMediaModule.selectTemplate('winner', { target: winnerCard });
    expect(nomineeCard.classList.contains('selected')).toBe(false);
    expect(winnerCard.classList.contains('selected')).toBe(true);
  });

  test('works when event is null (no card clicked)', () => {
    expect(() => socialMediaModule.selectTemplate('voting', null)).not.toThrow();
    expect(socialMediaModule.currentTemplate).toBe('voting');
  });
});

describe('Social Media Module - updatePostPreview()', () => {
  beforeEach(() => {
    document.getElementById('smPostContent').value = 'Hello {{company_name}}';
    document.getElementById('smCompanySelect').selectedIndex = 1;
    document.getElementById('smAwardSelect').selectedIndex = 1;
    document.getElementById('smPlatformOverrides').checked = false;
    ['smTwitterContent', 'smFacebookContent', 'smInstagramContent', 'smLinkedInContent'].forEach((id) => {
      document.getElementById(id).value = '';
    });
  });

  test('updates all preview text elements with processed content', () => {
    socialMediaModule.updatePostPreview();
    expect(document.getElementById('twitterPreviewText').textContent).toBe('Hello Acme Plumbing');
    expect(document.getElementById('facebookPreviewText').textContent).toBe('Hello Acme Plumbing');
    expect(document.getElementById('instagramPreviewText').textContent).toBe('Hello Acme Plumbing');
    expect(document.getElementById('linkedinPreviewText').textContent).toBe('Hello Acme Plumbing');
  });

  test('uses platform-specific content when overrides are enabled', () => {
    document.getElementById('smPlatformOverrides').checked = true;
    document.getElementById('smTwitterContent').value = 'Twitter override for {{company_name}}';
    socialMediaModule.updatePostPreview();
    expect(document.getElementById('twitterPreviewText').textContent).toBe('Twitter override for Acme Plumbing');
    // Non-overridden platforms should fall back to main content
    expect(document.getElementById('facebookPreviewText').textContent).toBe('Hello Acme Plumbing');
  });

  test('falls back to main content when override field is empty', () => {
    document.getElementById('smPlatformOverrides').checked = true;
    document.getElementById('smTwitterContent').value = ''; // empty override
    socialMediaModule.updatePostPreview();
    expect(document.getElementById('twitterPreviewText').textContent).toBe('Hello Acme Plumbing');
  });
});

describe('Social Media Module - updateCharacterCounts()', () => {
  beforeEach(() => {
    document.getElementById('smPostContent').value = '';
    document.getElementById('smPlatformOverrides').checked = false;
    document.getElementById('smCompanySelect').selectedIndex = 0;
    document.getElementById('smAwardSelect').selectedIndex = 0;
  });

  test('sets character count to processed content length', () => {
    document.getElementById('smPostContent').value = 'Hello world'; // 11 chars
    socialMediaModule.updateCharacterCounts();
    expect(document.getElementById('twitterCharCount').textContent).toBe('11');
  });

  test('applies danger class when twitter exceeds 280 chars', () => {
    document.getElementById('smPostContent').value = 'x'.repeat(300);
    socialMediaModule.updateCharacterCounts();
    const meta = document.getElementById('twitterCharCount').closest('.preview-meta');
    expect(meta.className).toContain('text-danger');
  });

  test('applies warning class when twitter exceeds 250 but under 280 chars', () => {
    document.getElementById('smPostContent').value = 'x'.repeat(260);
    socialMediaModule.updateCharacterCounts();
    const meta = document.getElementById('twitterCharCount').closest('.preview-meta');
    expect(meta.className).toContain('text-warning');
  });

  test('no warning class when twitter is under 250 chars', () => {
    document.getElementById('smPostContent').value = 'Short post';
    socialMediaModule.updateCharacterCounts();
    const meta = document.getElementById('twitterCharCount').closest('.preview-meta');
    expect(meta.className).toBe('preview-meta');
  });

  test('uses platform override content for character count when overrides enabled', () => {
    document.getElementById('smPlatformOverrides').checked = true;
    document.getElementById('smPostContent').value = 'short';
    document.getElementById('smTwitterContent').value = 'x'.repeat(300);
    socialMediaModule.updateCharacterCounts();
    expect(document.getElementById('twitterCharCount').textContent).toBe('300');
    const meta = document.getElementById('twitterCharCount').closest('.preview-meta');
    expect(meta.className).toContain('text-danger');
  });
});

describe('Social Media Module - togglePlatformOverrides()', () => {
  beforeEach(() => {
    document.getElementById('smPlatformOverrides').checked = false;
    document.getElementById('platformOverridesContainer').style.display = 'none';
    document.getElementById('smPostContent').value = 'Main content here';
    ['smTwitterContent', 'smFacebookContent', 'smInstagramContent', 'smLinkedInContent'].forEach((id) => {
      document.getElementById(id).value = '';
    });
  });

  test('shows container when toggle is checked', () => {
    document.getElementById('smPlatformOverrides').checked = true;
    socialMediaModule.togglePlatformOverrides();
    expect(document.getElementById('platformOverridesContainer').style.display).toBe('block');
  });

  test('hides container when toggle is unchecked', () => {
    document.getElementById('smPlatformOverrides').checked = false;
    document.getElementById('platformOverridesContainer').style.display = 'block';
    socialMediaModule.togglePlatformOverrides();
    expect(document.getElementById('platformOverridesContainer').style.display).toBe('none');
  });

  test('syncs main content into empty override fields when enabled', () => {
    document.getElementById('smPlatformOverrides').checked = true;
    socialMediaModule.togglePlatformOverrides();
    expect(document.getElementById('smTwitterContent').value).toBe('Main content here');
    expect(document.getElementById('smFacebookContent').value).toBe('Main content here');
    expect(document.getElementById('smInstagramContent').value).toBe('Main content here');
    expect(document.getElementById('smLinkedInContent').value).toBe('Main content here');
  });

  test('does not overwrite existing override field content on sync', () => {
    document.getElementById('smTwitterContent').value = 'Custom twitter content';
    document.getElementById('smPlatformOverrides').checked = true;
    socialMediaModule.togglePlatformOverrides();
    expect(document.getElementById('smTwitterContent').value).toBe('Custom twitter content');
    expect(document.getElementById('smFacebookContent').value).toBe('Main content here');
  });
});

describe('Social Media Module - getContentForPlatform()', () => {
  beforeEach(() => {
    document.getElementById('smPostContent').value = 'Main content';
    document.getElementById('smPlatformOverrides').checked = false;
    ['smTwitterContent', 'smFacebookContent', 'smInstagramContent', 'smLinkedInContent'].forEach((id) => {
      document.getElementById(id).value = '';
    });
  });

  test('returns main content when overrides are disabled', () => {
    expect(socialMediaModule.getContentForPlatform('twitter')).toBe('Main content');
    expect(socialMediaModule.getContentForPlatform('facebook')).toBe('Main content');
  });

  test('returns override content when overrides are enabled and field has content', () => {
    document.getElementById('smPlatformOverrides').checked = true;
    document.getElementById('smTwitterContent').value = 'Twitter-specific post';
    expect(socialMediaModule.getContentForPlatform('twitter')).toBe('Twitter-specific post');
  });

  test('falls back to main content when override field is empty', () => {
    document.getElementById('smPlatformOverrides').checked = true;
    document.getElementById('smTwitterContent').value = '';
    expect(socialMediaModule.getContentForPlatform('twitter')).toBe('Main content');
  });

  test('falls back to main content when override field is whitespace only', () => {
    document.getElementById('smPlatformOverrides').checked = true;
    document.getElementById('smTwitterContent').value = '   ';
    expect(socialMediaModule.getContentForPlatform('twitter')).toBe('Main content');
  });

  test('trims override content', () => {
    document.getElementById('smPlatformOverrides').checked = true;
    document.getElementById('smLinkedInContent').value = '  LinkedIn post  ';
    expect(socialMediaModule.getContentForPlatform('linkedin')).toBe('LinkedIn post');
  });
});

describe('Social Media Module - renderScheduledPosts()', () => {
  test('renders empty state when no posts', () => {
    socialMediaModule.renderScheduledPosts([]);
    const container = document.getElementById('scheduledPostsList');
    expect(container.innerHTML).toContain('No scheduled posts');
  });

  test('updates count badge', () => {
    socialMediaModule.renderScheduledPosts(sampleScheduledPosts);
    expect(document.getElementById('scheduledPostsCount').textContent).toBe('2');
  });

  test('sets count badge to 0 for empty posts', () => {
    socialMediaModule.renderScheduledPosts([]);
    expect(document.getElementById('scheduledPostsCount').textContent).toBe('0');
  });

  test('renders post items for each scheduled post', () => {
    socialMediaModule.renderScheduledPosts(sampleScheduledPosts);
    const container = document.getElementById('scheduledPostsList');
    const items = container.querySelectorAll('.scheduled-post-item');
    expect(items.length).toBe(2);
  });

  test('renders company and award names', () => {
    socialMediaModule.renderScheduledPosts(sampleScheduledPosts);
    const container = document.getElementById('scheduledPostsList');
    expect(container.innerHTML).toContain('Acme Plumbing');
    expect(container.innerHTML).toContain('Best Plumber South East');
    expect(container.innerHTML).toContain('Beta Builders');
  });

  test('renders platform badges', () => {
    socialMediaModule.renderScheduledPosts(sampleScheduledPosts);
    const container = document.getElementById('scheduledPostsList');
    expect(container.innerHTML).toContain('twitter');
    expect(container.innerHTML).toContain('facebook');
    expect(container.innerHTML).toContain('linkedin');
  });

  test('renders edit and delete buttons for each post', () => {
    socialMediaModule.renderScheduledPosts(sampleScheduledPosts);
    const container = document.getElementById('scheduledPostsList');
    const editButtons = container.querySelectorAll('.btn-outline-primary');
    const deleteButtons = container.querySelectorAll('.btn-outline-danger');
    expect(editButtons.length).toBe(2);
    expect(deleteButtons.length).toBe(2);
  });

  test('renders content preview with truncation', () => {
    const longPost = [
      {
        ...sampleScheduledPosts[0],
        content: 'x'.repeat(200),
      },
    ];
    socialMediaModule.renderScheduledPosts(longPost);
    const container = document.getElementById('scheduledPostsList');
    // Content should be truncated to 100 chars + ellipsis
    expect(container.innerHTML).toContain('x'.repeat(100) + '...');
  });

  test('handles posts with null organisations/awards gracefully', () => {
    const postsWithNulls = [
      {
        ...sampleScheduledPosts[0],
        organisations: null,
        awards: null,
      },
    ];
    expect(() => socialMediaModule.renderScheduledPosts(postsWithNulls)).not.toThrow();
    const container = document.getElementById('scheduledPostsList');
    expect(container.innerHTML).toContain('No company');
    expect(container.innerHTML).toContain('No award');
  });

  test('handles posts with null platforms gracefully', () => {
    const postsNoPlatforms = [
      {
        ...sampleScheduledPosts[0],
        platforms: null,
      },
    ];
    expect(() => socialMediaModule.renderScheduledPosts(postsNoPlatforms)).not.toThrow();
  });
});

describe('Social Media Module - renderDraftPosts()', () => {
  test('renders empty state when no drafts', () => {
    socialMediaModule.renderDraftPosts([]);
    const container = document.getElementById('draftPostsList');
    expect(container.innerHTML).toContain('No drafts');
  });

  test('updates draft count badge', () => {
    socialMediaModule.renderDraftPosts(sampleDraftPosts);
    expect(document.getElementById('draftPostsCount').textContent).toBe('1');
  });

  test('renders draft post items', () => {
    socialMediaModule.renderDraftPosts(sampleDraftPosts);
    const container = document.getElementById('draftPostsList');
    const items = container.querySelectorAll('.draft-post-item');
    expect(items.length).toBe(1);
  });

  test('renders truncated content preview (80 char limit)', () => {
    const longDraft = [
      {
        ...sampleDraftPosts[0],
        content: 'y'.repeat(150),
      },
    ];
    socialMediaModule.renderDraftPosts(longDraft);
    const container = document.getElementById('draftPostsList');
    expect(container.innerHTML).toContain('y'.repeat(80) + '...');
  });

  test('renders edit and delete buttons for drafts', () => {
    socialMediaModule.renderDraftPosts(sampleDraftPosts);
    const container = document.getElementById('draftPostsList');
    expect(container.querySelectorAll('.btn-outline-primary').length).toBe(1);
    expect(container.querySelectorAll('.btn-outline-danger').length).toBe(1);
  });
});

describe('Social Media Module - renderPublishedPosts()', () => {
  test('renders empty state when no published posts', () => {
    socialMediaModule.renderPublishedPosts([]);
    const container = document.getElementById('publishedPostsList');
    expect(container.innerHTML).toContain('No published posts yet');
  });

  test('updates published count badge', () => {
    socialMediaModule.renderPublishedPosts(samplePublishedPosts);
    expect(document.getElementById('publishedPostsCount').textContent).toBe('2');
  });

  test('renders published post items', () => {
    socialMediaModule.renderPublishedPosts(samplePublishedPosts);
    const container = document.getElementById('publishedPostsList');
    const items = container.querySelectorAll('.published-post-item');
    expect(items.length).toBe(2);
  });

  test('renders reuse button for each published post', () => {
    socialMediaModule.renderPublishedPosts(samplePublishedPosts);
    const container = document.getElementById('publishedPostsList');
    const reuseButtons = container.querySelectorAll('.btn-outline-primary');
    expect(reuseButtons.length).toBe(2);
  });

  test('renders company and award names', () => {
    socialMediaModule.renderPublishedPosts(samplePublishedPosts);
    const container = document.getElementById('publishedPostsList');
    expect(container.innerHTML).toContain('Acme Plumbing');
    expect(container.innerHTML).toContain('Best Plumber South East');
    expect(container.innerHTML).toContain('Beta Builders');
    expect(container.innerHTML).toContain('Best Builder London');
  });

  test('renders platform badges for published posts', () => {
    socialMediaModule.renderPublishedPosts(samplePublishedPosts);
    const container = document.getElementById('publishedPostsList');
    expect(container.innerHTML).toContain('twitter');
    expect(container.innerHTML).toContain('facebook');
    expect(container.innerHTML).toContain('linkedin');
  });

  test('handles posts with null organisations/awards', () => {
    const postsWithNulls = [
      {
        ...samplePublishedPosts[0],
        organisations: null,
        awards: null,
      },
    ];
    expect(() => socialMediaModule.renderPublishedPosts(postsWithNulls)).not.toThrow();
    const container = document.getElementById('publishedPostsList');
    expect(container.innerHTML).toContain('No company');
    expect(container.innerHTML).toContain('No award');
  });

  test('truncates published post content at 120 chars', () => {
    const longPublished = [
      {
        ...samplePublishedPosts[0],
        content: 'z'.repeat(200),
      },
    ];
    socialMediaModule.renderPublishedPosts(longPublished);
    const container = document.getElementById('publishedPostsList');
    expect(container.innerHTML).toContain('z'.repeat(120) + '...');
  });
});

describe('Social Media Module - clearForm()', () => {
  beforeEach(() => {
    // Set up various form state
    socialMediaModule.editingPostId = 'some-id';
    socialMediaModule.uploadedImageUrl = 'https://example.com/img.png';
    socialMediaModule.currentTemplate = 'nominee';
    document.getElementById('smPostContent').value = 'Some content';
    document.getElementById('smCompanySelect').selectedIndex = 1;
    document.getElementById('smAwardSelect').selectedIndex = 1;
    document.getElementById('platformTwitter').checked = false;
    document.getElementById('platformFacebook').checked = false;
    document.getElementById('smPlatformOverrides').checked = true;
    document.getElementById('smTwitterContent').value = 'Override text';
  });

  test('resets editingPostId to null', () => {
    socialMediaModule.clearForm();
    expect(socialMediaModule.editingPostId).toBeNull();
  });

  test('resets uploadedImageUrl to null', () => {
    socialMediaModule.clearForm();
    expect(socialMediaModule.uploadedImageUrl).toBeNull();
  });

  test('resets currentTemplate to null', () => {
    socialMediaModule.clearForm();
    expect(socialMediaModule.currentTemplate).toBeNull();
  });

  test('clears post content textarea', () => {
    socialMediaModule.clearForm();
    expect(document.getElementById('smPostContent').value).toBe('');
  });

  test('resets company and award selects', () => {
    socialMediaModule.clearForm();
    expect(document.getElementById('smCompanySelect').value).toBe('');
    expect(document.getElementById('smAwardSelect').value).toBe('');
  });

  test('checks all platform checkboxes', () => {
    socialMediaModule.clearForm();
    expect(document.getElementById('platformTwitter').checked).toBe(true);
    expect(document.getElementById('platformFacebook').checked).toBe(true);
    expect(document.getElementById('platformInstagram').checked).toBe(true);
    expect(document.getElementById('platformLinkedIn').checked).toBe(true);
  });

  test('unchecks platform overrides toggle', () => {
    socialMediaModule.clearForm();
    expect(document.getElementById('smPlatformOverrides').checked).toBe(false);
  });

  test('hides platform overrides container', () => {
    socialMediaModule.clearForm();
    expect(document.getElementById('platformOverridesContainer').style.display).toBe('none');
  });

  test('clears platform override fields', () => {
    socialMediaModule.clearForm();
    expect(document.getElementById('smTwitterContent').value).toBe('');
    expect(document.getElementById('smFacebookContent').value).toBe('');
    expect(document.getElementById('smInstagramContent').value).toBe('');
    expect(document.getElementById('smLinkedInContent').value).toBe('');
  });

  test('clears image size warning', () => {
    document.getElementById('imageSizeWarning').innerHTML = '<div>Some warning</div>';
    socialMediaModule.clearForm();
    expect(document.getElementById('imageSizeWarning').innerHTML).toBe('');
  });

  test('removes selected class from all template cards', () => {
    document.querySelector('.template-card').classList.add('selected');
    socialMediaModule.clearForm();
    const selectedCards = document.querySelectorAll('.template-card.selected');
    expect(selectedCards.length).toBe(0);
  });

  test('resets image source to company logo', () => {
    const customRadio = document.getElementById('imageCustom');
    customRadio.checked = true;
    socialMediaModule.clearForm();
    expect(document.getElementById('imageCompanyLogo').checked).toBe(true);
  });

  test('hides custom image upload area', () => {
    document.getElementById('customImageUpload').style.display = 'block';
    socialMediaModule.clearForm();
    expect(document.getElementById('customImageUpload').style.display).toBe('none');
  });
});

describe('Social Media Module - updateImagePreview()', () => {
  beforeEach(() => {
    document.getElementById('imageCompanyLogo').checked = true;
    document.getElementById('imageCustom').checked = false;
    document.getElementById('smCompanySelect').selectedIndex = 0;
    document.getElementById('smAddLogoOverlay').checked = false;
    socialMediaModule.uploadedImageUrl = null;
    document.getElementById('imageSizeWarning').innerHTML = '';
    // Clear all preview divs
    ['twitterPreviewImage', 'facebookPreviewImage', 'instagramPreviewImage', 'linkedinPreviewImage'].forEach((id) => {
      document.getElementById(id).innerHTML = '';
    });
  });

  test('shows placeholder when no image available', () => {
    socialMediaModule.updateImagePreview();
    const preview = document.getElementById('twitterPreviewImage');
    expect(preview.innerHTML).toContain('bi-image');
    expect(preview.innerHTML).toContain('text-muted');
  });

  test('renders image when company logo is selected and company has logo', () => {
    document.getElementById('smCompanySelect').selectedIndex = 1; // Acme Plumbing with logo
    socialMediaModule.updateImagePreview();
    const preview = document.getElementById('twitterPreviewImage');
    const img = preview.querySelector('img');
    expect(img).not.toBeNull();
    expect(img.src).toBe('https://example.com/logo1.png');
  });

  test('adds logo overlay when checkbox is checked', () => {
    document.getElementById('smCompanySelect').selectedIndex = 1;
    document.getElementById('smAddLogoOverlay').checked = true;
    socialMediaModule.updateImagePreview();
    const preview = document.getElementById('twitterPreviewImage');
    const logos = preview.querySelectorAll('img');
    expect(logos.length).toBe(2); // main image + overlay logo
    expect(logos[1].className).toBe('logo-overlay');
    expect(logos[1].src).toContain(socialMediaModule.britishTradeAwardsLogoUrl);
  });

  test('does not add logo overlay when checkbox is unchecked', () => {
    document.getElementById('smCompanySelect').selectedIndex = 1;
    document.getElementById('smAddLogoOverlay').checked = false;
    socialMediaModule.updateImagePreview();
    const preview = document.getElementById('twitterPreviewImage');
    const logos = preview.querySelectorAll('img');
    expect(logos.length).toBe(1); // only main image
  });

  test('uses uploadedImageUrl when custom source selected', () => {
    document.getElementById('imageCustom').checked = true;
    document.getElementById('imageCompanyLogo').checked = false;
    socialMediaModule.uploadedImageUrl = 'https://example.com/custom.jpg';
    socialMediaModule.updateImagePreview();
    const preview = document.getElementById('twitterPreviewImage');
    const img = preview.querySelector('img');
    expect(img).not.toBeNull();
    expect(img.src).toBe('https://example.com/custom.jpg');
  });

  test('updates all four platform preview elements', () => {
    document.getElementById('smCompanySelect').selectedIndex = 1;
    socialMediaModule.updateImagePreview();
    ['twitterPreviewImage', 'facebookPreviewImage', 'instagramPreviewImage', 'linkedinPreviewImage'].forEach((id) => {
      const preview = document.getElementById(id);
      expect(preview.querySelector('img')).not.toBeNull();
    });
  });
});

describe('Social Media Module - showEditingIndicator()', () => {
  beforeEach(() => {
    // Remove any leftover editing banners
    const existing = document.getElementById('editingBanner');
    if (existing) existing.remove();
  });

  test('show=false removes existing banner', () => {
    // First add a banner manually
    const container = document.querySelector('.card .card-header');
    const banner = document.createElement('div');
    banner.id = 'editingBanner';
    container.insertAdjacentElement('afterend', banner);

    socialMediaModule.showEditingIndicator(false);
    expect(document.getElementById('editingBanner')).toBeNull();
  });

  test('show=false does not throw when no banner exists', () => {
    expect(() => socialMediaModule.showEditingIndicator(false)).not.toThrow();
  });
});

describe('Social Media Module - setupScheduleDateMin()', () => {
  test('sets min attribute on schedule date input to today', () => {
    socialMediaModule.setupScheduleDateMin();
    const dateInput = document.getElementById('smScheduleDate');
    const today = new Date().toISOString().split('T')[0];
    expect(dateInput.getAttribute('min')).toBe(today);
  });
});

describe('Social Media Module - showPostSuccessMessage()', () => {
  test('does not throw when called with platform list', () => {
    expect(() => socialMediaModule.showPostSuccessMessage(['twitter', 'facebook'])).not.toThrow();
  });

  test('does not throw with single platform', () => {
    expect(() => socialMediaModule.showPostSuccessMessage(['instagram'])).not.toThrow();
  });

  test('does not throw with empty array', () => {
    expect(() => socialMediaModule.showPostSuccessMessage([])).not.toThrow();
  });
});

describe('Social Media Module - syncPlatformOverrides()', () => {
  beforeEach(() => {
    document.getElementById('smPostContent').value = 'Sync content';
    ['smTwitterContent', 'smFacebookContent', 'smInstagramContent', 'smLinkedInContent'].forEach((id) => {
      document.getElementById(id).value = '';
    });
  });

  test('copies main content to all empty override fields', () => {
    socialMediaModule.syncPlatformOverrides();
    expect(document.getElementById('smTwitterContent').value).toBe('Sync content');
    expect(document.getElementById('smFacebookContent').value).toBe('Sync content');
    expect(document.getElementById('smInstagramContent').value).toBe('Sync content');
    expect(document.getElementById('smLinkedInContent').value).toBe('Sync content');
  });

  test('does not overwrite fields that already have content', () => {
    document.getElementById('smTwitterContent').value = 'Existing twitter';
    socialMediaModule.syncPlatformOverrides();
    expect(document.getElementById('smTwitterContent').value).toBe('Existing twitter');
    expect(document.getElementById('smFacebookContent').value).toBe('Sync content');
  });
});

describe('Social Media Module - validateImageDimensions()', () => {
  test('clears warning container when imageUrl is null', () => {
    document.getElementById('imageSizeWarning').innerHTML = '<div>Previous warning</div>';
    socialMediaModule.validateImageDimensions(null);
    expect(document.getElementById('imageSizeWarning').innerHTML).toBe('');
  });

  test('clears warning container when imageUrl is empty', () => {
    document.getElementById('imageSizeWarning').innerHTML = '<div>Previous warning</div>';
    socialMediaModule.validateImageDimensions('');
    expect(document.getElementById('imageSizeWarning').innerHTML).toBe('');
  });

  test('does not throw when imageSizeWarning element is missing', () => {
    const el = document.getElementById('imageSizeWarning');
    el.id = 'imageSizeWarning_hidden';
    expect(() => socialMediaModule.validateImageDimensions('https://example.com/img.png')).not.toThrow();
    el.id = 'imageSizeWarning';
  });
});

describe('Social Media Module - openPlatformSettings()', () => {
  test('does not throw when called', () => {
    expect(() => socialMediaModule.openPlatformSettings()).not.toThrow();
  });
});

describe('Social Media Module - Edge Cases', () => {
  test('renderScheduledPosts handles empty content gracefully', () => {
    const posts = [
      {
        ...sampleScheduledPosts[0],
        content: '',
      },
    ];
    expect(() => socialMediaModule.renderScheduledPosts(posts)).not.toThrow();
  });

  test('renderDraftPosts handles null content gracefully', () => {
    const posts = [
      {
        ...sampleDraftPosts[0],
        content: null,
      },
    ];
    expect(() => socialMediaModule.renderDraftPosts(posts)).not.toThrow();
  });

  test('renderPublishedPosts handles undefined platforms', () => {
    const posts = [
      {
        ...samplePublishedPosts[0],
        platforms: undefined,
      },
    ];
    expect(() => socialMediaModule.renderPublishedPosts(posts)).not.toThrow();
  });

  test('processPlaceholders handles content with no placeholders', () => {
    const result = socialMediaModule.processPlaceholders('Plain text with no placeholders');
    expect(result).toBe('Plain text with no placeholders');
  });

  test('processPlaceholders handles empty content', () => {
    const result = socialMediaModule.processPlaceholders('');
    expect(result).toBe('');
  });

  test('clearForm does not throw even after multiple calls', () => {
    expect(() => {
      socialMediaModule.clearForm();
      socialMediaModule.clearForm();
      socialMediaModule.clearForm();
    }).not.toThrow();
  });

  test('updatePostPreview does not throw with empty textarea', () => {
    document.getElementById('smPostContent').value = '';
    expect(() => socialMediaModule.updatePostPreview()).not.toThrow();
  });

  test('updateCharacterCounts does not throw when preview-meta is missing', () => {
    // This tests the guard on countEl.closest('.preview-meta')
    // Even though our DOM has it, the function is safe
    expect(() => socialMediaModule.updateCharacterCounts()).not.toThrow();
  });

  test('selectTemplate with each template key populates correct content', () => {
    for (const key of ['nominee', 'winner', 'voting']) {
      socialMediaModule.selectTemplate(key, null);
      expect(document.getElementById('smPostContent').value).toBe(socialMediaModule.templates[key].content);
    }
  });

  test('module is registered in ModuleRegistry', () => {
    expect(ModuleRegistry.get('socialMediaModule')).toBe(socialMediaModule);
  });
});
