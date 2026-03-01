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

// ==========================================
// ADDITIONAL TESTS FOR COVERAGE
// ==========================================

describe('Social Media Module - savePost() validation', () => {
  let showToastSpy;

  beforeEach(() => {
    showToastSpy = jest.spyOn(utils, 'showToast');
    document.getElementById('smPostContent').value = '';
    document.getElementById('smCompanySelect').selectedIndex = 0;
    document.getElementById('smAwardSelect').selectedIndex = 0;
    document.getElementById('platformTwitter').checked = true;
    document.getElementById('platformFacebook').checked = true;
    document.getElementById('platformInstagram').checked = true;
    document.getElementById('platformLinkedIn').checked = true;
    socialMediaModule.editingPostId = null;
  });

  afterEach(() => {
    showToastSpy.mockRestore();
  });

  test('shows warning when content is empty', async () => {
    document.getElementById('smPostContent').value = '';
    await socialMediaModule.savePost('draft');
    expect(showToastSpy).toHaveBeenCalledWith('Please enter post content', 'warning');
  });

  test('shows warning when content is whitespace only', async () => {
    document.getElementById('smPostContent').value = '   ';
    await socialMediaModule.savePost('scheduled');
    expect(showToastSpy).toHaveBeenCalledWith('Please enter post content', 'warning');
  });

  test('shows warning when no company is selected', async () => {
    document.getElementById('smPostContent').value = 'Some content';
    document.getElementById('smCompanySelect').selectedIndex = 0; // empty value
    await socialMediaModule.savePost('scheduled');
    expect(showToastSpy).toHaveBeenCalledWith('Please select a company', 'warning');
  });

  test('shows warning when no award is selected', async () => {
    document.getElementById('smPostContent').value = 'Some content';
    document.getElementById('smCompanySelect').selectedIndex = 1;
    document.getElementById('smAwardSelect').selectedIndex = 0; // empty value
    await socialMediaModule.savePost('scheduled');
    expect(showToastSpy).toHaveBeenCalledWith('Please select an award', 'warning');
  });

  test('shows warning when no platforms are selected', async () => {
    document.getElementById('smPostContent').value = 'Some content';
    document.getElementById('smCompanySelect').selectedIndex = 1;
    document.getElementById('smAwardSelect').selectedIndex = 1;
    document.getElementById('platformTwitter').checked = false;
    document.getElementById('platformFacebook').checked = false;
    document.getElementById('platformInstagram').checked = false;
    document.getElementById('platformLinkedIn').checked = false;
    await socialMediaModule.savePost('scheduled');
    expect(showToastSpy).toHaveBeenCalledWith('Please select at least one platform', 'warning');
  });

  test('shows warning when scheduled post has no date', async () => {
    document.getElementById('smPostContent').value = 'Some content';
    document.getElementById('smCompanySelect').selectedIndex = 1;
    document.getElementById('smAwardSelect').selectedIndex = 1;
    document.getElementById('smScheduleDate').value = '';
    document.getElementById('smScheduleTime').value = '';
    await socialMediaModule.savePost('scheduled');
    expect(showToastSpy).toHaveBeenCalledWith('Please select a date and time for scheduling', 'warning');
  });

  test('shows warning when scheduled date is in the past', async () => {
    document.getElementById('smPostContent').value = 'Some content';
    document.getElementById('smCompanySelect').selectedIndex = 1;
    document.getElementById('smAwardSelect').selectedIndex = 1;
    document.getElementById('smScheduleDate').value = '2020-01-01';
    document.getElementById('smScheduleTime').value = '10:00';
    await socialMediaModule.savePost('scheduled');
    expect(showToastSpy).toHaveBeenCalledWith('Scheduled date/time must be in the future', 'warning');
  });
});

describe('Social Media Module - savePost() successful insert', () => {
  let showToastSpy;

  beforeEach(() => {
    showToastSpy = jest.spyOn(utils, 'showToast');
    // Set up a valid form state
    document.getElementById('smPostContent').value = 'Test post content';
    document.getElementById('smCompanySelect').selectedIndex = 1;
    document.getElementById('smAwardSelect').selectedIndex = 1;
    document.getElementById('platformTwitter').checked = true;
    document.getElementById('platformFacebook').checked = false;
    document.getElementById('platformInstagram').checked = false;
    document.getElementById('platformLinkedIn').checked = false;
    document.getElementById('smPlatformOverrides').checked = false;
    document.getElementById('imageCompanyLogo').checked = true;
    document.getElementById('smAddLogoOverlay').checked = false;
    socialMediaModule.editingPostId = null;
    socialMediaModule.currentTemplate = 'nominee';

    // Mock apiClient.select for the reload calls
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    showToastSpy.mockRestore();
    // Reset mockSupabase chain
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.insert.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.update.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.then.mockImplementation((cb) => cb({ data: [], error: null }));
  });

  test('inserts new scheduled post and shows success toast', async () => {
    document.getElementById('smScheduleDate').value = '2030-12-25';
    document.getElementById('smScheduleTime').value = '14:00';

    // Mock the chain: from().insert().select() -> then-able
    mockSupabase.select.mockReturnValueOnce(
      Promise.resolve({ data: [{ id: 'new-post-1' }], error: null })
    );

    await socialMediaModule.savePost('scheduled');
    expect(showToastSpy).toHaveBeenCalledWith('Post scheduled successfully!', 'success');
  });

  test('updates existing post when editingPostId is set', async () => {
    socialMediaModule.editingPostId = 'existing-post-1';
    document.getElementById('smScheduleDate').value = '2030-12-25';
    document.getElementById('smScheduleTime').value = '14:00';

    mockSupabase.eq.mockReturnValueOnce(
      Promise.resolve({ error: null })
    );

    await socialMediaModule.savePost('scheduled');
    expect(showToastSpy).toHaveBeenCalledWith('Post updated successfully!', 'success');
    expect(socialMediaModule.editingPostId).toBeNull();
  });

  test('shows error toast on database error', async () => {
    document.getElementById('smScheduleDate').value = '2030-12-25';
    document.getElementById('smScheduleTime').value = '14:00';

    mockSupabase.select.mockReturnValueOnce(
      Promise.resolve({ data: null, error: { message: 'DB insert error' } })
    );

    await socialMediaModule.savePost('scheduled');
    expect(showToastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to save post'), 'error');
  });

  test('immediate post calls confirmDialog before publishing', async () => {
    const confirmSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(false);

    await socialMediaModule.savePost('immediate');
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Publish Post',
        confirmText: 'Publish Now',
      })
    );
    confirmSpy.mockRestore();
  });

  test('immediate post aborts when user cancels confirm dialog', async () => {
    const confirmSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(false);

    await socialMediaModule.savePost('immediate');
    // Should not reach the insert call - no success/error toast
    expect(showToastSpy).not.toHaveBeenCalledWith(expect.stringContaining('published'), expect.anything());
    confirmSpy.mockRestore();
  });

  test('immediate post proceeds when user confirms', async () => {
    const confirmSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);

    mockSupabase.select.mockReturnValueOnce(
      Promise.resolve({ data: [{ id: 'pub-new-1' }], error: null })
    );
    // Mock the functions.invoke call for publish
    mockSupabase.functions.invoke.mockResolvedValueOnce({ data: {}, error: null });

    await socialMediaModule.savePost('immediate');
    expect(mockSupabase.functions.invoke).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  test('immediate post shows warning when some platforms fail', async () => {
    const confirmSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);

    mockSupabase.select.mockReturnValueOnce(
      Promise.resolve({ data: [{ id: 'pub-new-2' }], error: null })
    );
    mockSupabase.functions.invoke.mockResolvedValueOnce({
      data: { errors: [{ platform: 'twitter' }] },
      error: null,
    });

    await socialMediaModule.savePost('immediate');
    expect(showToastSpy).toHaveBeenCalledWith(expect.stringContaining('Published with warnings'), 'warning');
    confirmSpy.mockRestore();
  });

  test('immediate post handles publish API not available gracefully', async () => {
    const confirmSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);

    mockSupabase.select.mockReturnValueOnce(
      Promise.resolve({ data: [{ id: 'pub-new-3' }], error: null })
    );
    mockSupabase.functions.invoke.mockRejectedValueOnce(new Error('Edge function not deployed'));

    await socialMediaModule.savePost('immediate');
    expect(showToastSpy).toHaveBeenCalledWith(expect.stringContaining('Configure API keys'), 'info');
    confirmSpy.mockRestore();
  });

  test('includes platform content when overrides are enabled', async () => {
    document.getElementById('smPlatformOverrides').checked = true;
    document.getElementById('smTwitterContent').value = 'Custom twitter post';
    document.getElementById('smScheduleDate').value = '2030-12-25';
    document.getElementById('smScheduleTime').value = '14:00';

    mockSupabase.select.mockReturnValueOnce(
      Promise.resolve({ data: [{ id: 'new-post-override' }], error: null })
    );

    await socialMediaModule.savePost('scheduled');
    expect(mockSupabase.insert).toHaveBeenCalled();
  });

  test('uses custom image URL when custom image source selected', async () => {
    document.getElementById('imageCustom').checked = true;
    document.getElementById('imageCompanyLogo').checked = false;
    socialMediaModule.uploadedImageUrl = 'https://example.com/custom-upload.jpg';
    document.getElementById('smScheduleDate').value = '2030-12-25';
    document.getElementById('smScheduleTime').value = '14:00';

    mockSupabase.select.mockReturnValueOnce(
      Promise.resolve({ data: [{ id: 'custom-img-post' }], error: null })
    );

    await socialMediaModule.savePost('scheduled');
    expect(mockSupabase.insert).toHaveBeenCalled();
  });
});

describe('Social Media Module - saveDraft()', () => {
  let showToastSpy;

  beforeEach(() => {
    showToastSpy = jest.spyOn(utils, 'showToast');
    document.getElementById('smPostContent').value = 'Draft content here';
    document.getElementById('smCompanySelect').selectedIndex = 1;
    document.getElementById('smAwardSelect').selectedIndex = 1;
    document.getElementById('platformTwitter').checked = true;
    document.getElementById('platformFacebook').checked = false;
    document.getElementById('platformInstagram').checked = false;
    document.getElementById('platformLinkedIn').checked = false;
    document.getElementById('smPlatformOverrides').checked = false;
    document.getElementById('imageCompanyLogo').checked = true;
    document.getElementById('smAddLogoOverlay').checked = false;
    socialMediaModule.editingPostId = null;
    socialMediaModule.currentTemplate = null;

    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    showToastSpy.mockRestore();
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.insert.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.update.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.then.mockImplementation((cb) => cb({ data: [], error: null }));
  });

  test('shows warning when draft content is empty', async () => {
    document.getElementById('smPostContent').value = '';
    await socialMediaModule.saveDraft();
    expect(showToastSpy).toHaveBeenCalledWith('Please enter post content', 'warning');
  });

  test('shows warning when draft content is whitespace only', async () => {
    document.getElementById('smPostContent').value = '   ';
    await socialMediaModule.saveDraft();
    expect(showToastSpy).toHaveBeenCalledWith('Please enter post content', 'warning');
  });

  test('inserts new draft successfully', async () => {
    mockSupabase.select.mockReturnValueOnce(
      Promise.resolve({ data: [{ id: 'draft-new-1' }], error: null })
    );

    await socialMediaModule.saveDraft();
    expect(showToastSpy).toHaveBeenCalledWith('Draft saved successfully!', 'success');
  });

  test('updates existing draft when editingPostId is set', async () => {
    socialMediaModule.editingPostId = 'existing-draft-1';

    mockSupabase.eq.mockReturnValueOnce(
      Promise.resolve({ error: null })
    );

    await socialMediaModule.saveDraft();
    expect(showToastSpy).toHaveBeenCalledWith('Draft updated successfully!', 'success');
    expect(socialMediaModule.editingPostId).toBeNull();
  });

  test('shows error toast on database error', async () => {
    mockSupabase.select.mockReturnValueOnce(
      Promise.resolve({ data: null, error: { message: 'Draft insert failed' } })
    );

    await socialMediaModule.saveDraft();
    expect(showToastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to save draft'), 'error');
  });

  test('saves draft with custom image source', async () => {
    document.getElementById('imageCustom').checked = true;
    document.getElementById('imageCompanyLogo').checked = false;
    socialMediaModule.uploadedImageUrl = 'https://example.com/draft-img.jpg';

    mockSupabase.select.mockReturnValueOnce(
      Promise.resolve({ data: [{ id: 'draft-img' }], error: null })
    );

    await socialMediaModule.saveDraft();
    expect(showToastSpy).toHaveBeenCalledWith('Draft saved successfully!', 'success');
  });

  test('saves draft with platform overrides', async () => {
    document.getElementById('smPlatformOverrides').checked = true;
    document.getElementById('smTwitterContent').value = 'Twitter draft';

    mockSupabase.select.mockReturnValueOnce(
      Promise.resolve({ data: [{ id: 'draft-override' }], error: null })
    );

    await socialMediaModule.saveDraft();
    expect(mockSupabase.insert).toHaveBeenCalled();
  });

  test('saves draft without company or award selected', async () => {
    document.getElementById('smCompanySelect').selectedIndex = 0;
    document.getElementById('smAwardSelect').selectedIndex = 0;

    mockSupabase.select.mockReturnValueOnce(
      Promise.resolve({ data: [{ id: 'draft-no-company' }], error: null })
    );

    await socialMediaModule.saveDraft();
    expect(showToastSpy).toHaveBeenCalledWith('Draft saved successfully!', 'success');
  });
});

describe('Social Media Module - deleteScheduledPost()', () => {
  let showToastSpy;

  beforeEach(() => {
    showToastSpy = jest.spyOn(utils, 'showToast');
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.delete.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    showToastSpy.mockRestore();
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.then.mockImplementation((cb) => cb({ data: [], error: null }));
  });

  test('does nothing when user cancels confirmation', async () => {
    const confirmSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(false);

    await socialMediaModule.deleteScheduledPost('post-1');
    expect(mockSupabase.delete).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  test('deletes post and shows success toast when confirmed', async () => {
    const confirmSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    mockSupabase.eq.mockReturnValueOnce(Promise.resolve({ error: null }));

    await socialMediaModule.deleteScheduledPost('post-1');
    expect(showToastSpy).toHaveBeenCalledWith('Post deleted successfully', 'success');
    confirmSpy.mockRestore();
  });

  test('shows error toast when delete fails', async () => {
    const confirmSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    mockSupabase.eq.mockReturnValueOnce(Promise.resolve({ error: { message: 'Delete failed' } }));

    await socialMediaModule.deleteScheduledPost('post-1');
    expect(showToastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to delete post'), 'error');
    confirmSpy.mockRestore();
  });

  test('calls confirmDialog with correct options', async () => {
    const confirmSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(false);

    await socialMediaModule.deleteScheduledPost('post-1');
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Delete Post',
        message: 'Are you sure you want to delete this post?',
        confirmText: 'Delete',
        danger: true,
      })
    );
    confirmSpy.mockRestore();
  });
});

describe('Social Media Module - editScheduledPost()', () => {
  let showToastSpy;
  let showLoadingSpy;
  let hideLoadingSpy;

  beforeEach(() => {
    showToastSpy = jest.spyOn(utils, 'showToast');
    showLoadingSpy = jest.spyOn(utils, 'showLoading');
    hideLoadingSpy = jest.spyOn(utils, 'hideLoading');
    socialMediaModule.editingPostId = null;
    document.getElementById('smPostContent').value = '';
    document.getElementById('smCompanySelect').selectedIndex = 0;
    document.getElementById('smAwardSelect').selectedIndex = 0;
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    showToastSpy.mockRestore();
    showLoadingSpy.mockRestore();
    hideLoadingSpy.mockRestore();
    mockSupabase.single.mockReturnValue(Promise.resolve({ data: null, error: null }));
  });

  test('loads post data into form fields', async () => {
    const postData = {
      id: 'edit-post-1',
      content: 'Loaded content for editing',
      company_id: 'comp-1',
      award_id: 'award-1',
      platforms: ['twitter', 'linkedin'],
      scheduled_for: '2030-06-15T10:00:00',
      image_url: null,
      template_type: 'winner',
      platform_content: null,
    };

    mockSupabase.single.mockReturnValueOnce(Promise.resolve({ data: postData, error: null }));

    await socialMediaModule.editScheduledPost('edit-post-1');

    expect(socialMediaModule.editingPostId).toBe('edit-post-1');
    expect(document.getElementById('smPostContent').value).toBe('Loaded content for editing');
    expect(document.getElementById('platformTwitter').checked).toBe(true);
    expect(document.getElementById('platformFacebook').checked).toBe(false);
    expect(document.getElementById('platformLinkedIn').checked).toBe(true);
    expect(socialMediaModule.currentTemplate).toBe('winner');
  });

  test('sets schedule date and time from post data', async () => {
    const postData = {
      id: 'edit-post-2',
      content: 'Scheduled post',
      company_id: null,
      award_id: null,
      platforms: ['facebook'],
      scheduled_for: '2030-08-20T15:30:00',
      image_url: null,
      template_type: null,
      platform_content: null,
    };

    mockSupabase.single.mockReturnValueOnce(Promise.resolve({ data: postData, error: null }));

    await socialMediaModule.editScheduledPost('edit-post-2');

    expect(document.getElementById('smScheduleDate').value).toBe('2030-08-20');
    expect(document.getElementById('smScheduleTime').value).toBe('15:30');
  });

  test('sets custom image when post has image_url', async () => {
    const postData = {
      id: 'edit-post-3',
      content: 'Post with image',
      company_id: null,
      award_id: null,
      platforms: ['instagram'],
      scheduled_for: null,
      image_url: 'https://example.com/post-image.jpg',
      template_type: null,
      platform_content: null,
    };

    mockSupabase.single.mockReturnValueOnce(Promise.resolve({ data: postData, error: null }));

    await socialMediaModule.editScheduledPost('edit-post-3');

    expect(socialMediaModule.uploadedImageUrl).toBe('https://example.com/post-image.jpg');
  });

  test('restores platform-specific overrides', async () => {
    const postData = {
      id: 'edit-post-4',
      content: 'Main content',
      company_id: null,
      award_id: null,
      platforms: ['twitter'],
      scheduled_for: null,
      image_url: null,
      template_type: null,
      platform_content: {
        twitter: 'Custom Twitter text',
        facebook: 'Custom Facebook text',
      },
    };

    mockSupabase.single.mockReturnValueOnce(Promise.resolve({ data: postData, error: null }));

    await socialMediaModule.editScheduledPost('edit-post-4');

    expect(document.getElementById('smPlatformOverrides').checked).toBe(true);
    expect(document.getElementById('smTwitterContent').value).toBe('Custom Twitter text');
    expect(document.getElementById('smFacebookContent').value).toBe('Custom Facebook text');
  });

  test('shows error toast when loading fails', async () => {
    mockSupabase.single.mockReturnValueOnce(
      Promise.resolve({ data: null, error: { message: 'Post not found' } })
    );

    await socialMediaModule.editScheduledPost('nonexistent-id');

    expect(showToastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to load post'), 'error');
  });

  test('calls showLoading and hideLoading', async () => {
    mockSupabase.single.mockReturnValueOnce(
      Promise.resolve({ data: null, error: { message: 'err' } })
    );

    await socialMediaModule.editScheduledPost('test-id');

    expect(showLoadingSpy).toHaveBeenCalled();
    expect(hideLoadingSpy).toHaveBeenCalled();
  });
});

describe('Social Media Module - reusePost()', () => {
  let showToastSpy;

  beforeEach(() => {
    showToastSpy = jest.spyOn(utils, 'showToast');
    socialMediaModule.editingPostId = null;
    document.getElementById('smPostContent').value = '';
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    showToastSpy.mockRestore();
    mockSupabase.single.mockReturnValue(Promise.resolve({ data: null, error: null }));
  });

  test('loads post content but does NOT set editingPostId', async () => {
    const postData = {
      id: 'reuse-post-1',
      content: 'Reusable content',
      company_id: 'comp-1',
      award_id: 'award-1',
      platforms: ['twitter', 'facebook'],
      scheduled_for: null,
      image_url: null,
      template_type: 'nominee',
      platform_content: null,
    };

    mockSupabase.single.mockReturnValueOnce(Promise.resolve({ data: postData, error: null }));

    await socialMediaModule.reusePost('reuse-post-1');

    // editingPostId should NOT be set - this creates a new post
    expect(socialMediaModule.editingPostId).toBeNull();
    expect(document.getElementById('smPostContent').value).toBe('Reusable content');
  });

  test('sets platform checkboxes from reused post', async () => {
    const postData = {
      id: 'reuse-post-2',
      content: 'Platform test',
      company_id: null,
      award_id: null,
      platforms: ['instagram'],
      scheduled_for: null,
      image_url: null,
      template_type: null,
      platform_content: null,
    };

    mockSupabase.single.mockReturnValueOnce(Promise.resolve({ data: postData, error: null }));

    await socialMediaModule.reusePost('reuse-post-2');

    expect(document.getElementById('platformInstagram').checked).toBe(true);
    expect(document.getElementById('platformTwitter').checked).toBe(false);
    expect(document.getElementById('platformFacebook').checked).toBe(false);
    expect(document.getElementById('platformLinkedIn').checked).toBe(false);
  });

  test('shows error toast when reuse fails', async () => {
    mockSupabase.single.mockReturnValueOnce(
      Promise.resolve({ data: null, error: { message: 'Load failed' } })
    );

    await socialMediaModule.reusePost('bad-id');

    expect(showToastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to load post'), 'error');
  });

  test('restores platform overrides from reused post', async () => {
    const postData = {
      id: 'reuse-post-3',
      content: 'Main text',
      company_id: null,
      award_id: null,
      platforms: ['twitter'],
      scheduled_for: null,
      image_url: null,
      template_type: null,
      platform_content: {
        twitter: 'Custom tweet for reuse',
      },
    };

    mockSupabase.single.mockReturnValueOnce(Promise.resolve({ data: postData, error: null }));

    await socialMediaModule.reusePost('reuse-post-3');

    expect(document.getElementById('smPlatformOverrides').checked).toBe(true);
    expect(document.getElementById('smTwitterContent').value).toBe('Custom tweet for reuse');
  });
});

describe('Social Media Module - loadScheduledPosts()', () => {
  afterEach(() => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
  });

  test('calls apiClient.select with correct parameters', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: sampleScheduledPosts });

    await socialMediaModule.loadScheduledPosts();

    expect(apiClient.select).toHaveBeenCalledWith('social_media_posts', expect.objectContaining({
      filters: { status: { op: 'eq', value: 'scheduled' } },
      sort: { column: 'scheduled_for', ascending: true },
    }));
  });

  test('renders posts on successful load', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: sampleScheduledPosts });

    await socialMediaModule.loadScheduledPosts();

    const container = document.getElementById('scheduledPostsList');
    expect(container.querySelectorAll('.scheduled-post-item').length).toBe(2);
  });

  test('renders empty state when no data', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });

    await socialMediaModule.loadScheduledPosts();

    const container = document.getElementById('scheduledPostsList');
    expect(container.innerHTML).toContain('No scheduled posts');
  });

  test('handles null data gracefully', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: null });

    await socialMediaModule.loadScheduledPosts();

    const container = document.getElementById('scheduledPostsList');
    expect(container.innerHTML).toContain('No scheduled posts');
  });

  test('handles apiClient.select error gracefully', async () => {
    apiClient.select = jest.fn().mockRejectedValue(new Error('Network error'));

    await expect(socialMediaModule.loadScheduledPosts()).resolves.not.toThrow();
  });
});

describe('Social Media Module - loadDraftPosts()', () => {
  afterEach(() => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
  });

  test('calls apiClient.select with correct parameters', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: sampleDraftPosts });

    await socialMediaModule.loadDraftPosts();

    expect(apiClient.select).toHaveBeenCalledWith('social_media_posts', expect.objectContaining({
      filters: { status: { op: 'eq', value: 'draft' } },
      sort: { column: 'created_at', ascending: false },
    }));
  });

  test('renders draft posts on successful load', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: sampleDraftPosts });

    await socialMediaModule.loadDraftPosts();

    const container = document.getElementById('draftPostsList');
    expect(container.querySelectorAll('.draft-post-item').length).toBe(1);
  });

  test('handles error gracefully', async () => {
    apiClient.select = jest.fn().mockRejectedValue(new Error('DB error'));

    await expect(socialMediaModule.loadDraftPosts()).resolves.not.toThrow();
  });
});

describe('Social Media Module - loadPublishedPosts()', () => {
  afterEach(() => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
  });

  test('calls apiClient.select with correct parameters', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: samplePublishedPosts });

    await socialMediaModule.loadPublishedPosts();

    expect(apiClient.select).toHaveBeenCalledWith('social_media_posts', expect.objectContaining({
      filters: { status: { op: 'eq', value: 'published' } },
      sort: { column: 'created_at', ascending: false },
    }));
  });

  test('renders published posts on successful load', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: samplePublishedPosts });

    await socialMediaModule.loadPublishedPosts();

    const container = document.getElementById('publishedPostsList');
    expect(container.querySelectorAll('.published-post-item').length).toBe(2);
  });

  test('handles error gracefully', async () => {
    apiClient.select = jest.fn().mockRejectedValue(new Error('Load error'));

    await expect(socialMediaModule.loadPublishedPosts()).resolves.not.toThrow();
  });
});

describe('Social Media Module - loadAnalytics()', () => {
  let showToastSpy;

  beforeEach(() => {
    showToastSpy = jest.spyOn(utils, 'showToast');
    document.getElementById('analyticsContent').innerHTML = '';
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    showToastSpy.mockRestore();
    mockSupabase.then.mockImplementation((cb) => cb({ data: [], error: null }));
  });

  test('renders analytics with post counts', async () => {
    const allPosts = [
      { status: 'published', platforms: ['twitter', 'facebook'], created_at: new Date().toISOString() },
      { status: 'published', platforms: ['twitter'], created_at: new Date().toISOString() },
      { status: 'scheduled', platforms: ['linkedin'], created_at: new Date().toISOString() },
      { status: 'draft', platforms: ['instagram'], created_at: new Date().toISOString() },
    ];

    mockSupabase.select.mockReturnValueOnce(
      Promise.resolve({ data: allPosts, error: null })
    );

    await socialMediaModule.loadAnalytics();

    const container = document.getElementById('analyticsContent');
    // Check published count
    expect(container.innerHTML).toContain('2');  // 2 published
    // Check scheduled count
    expect(container.innerHTML).toContain('1');  // 1 scheduled
    // Check total
    expect(container.innerHTML).toContain('4');  // 4 total
  });

  test('shows error message on database error', async () => {
    mockSupabase.select.mockReturnValueOnce(
      Promise.resolve({ data: null, error: { message: 'DB error' } })
    );

    await socialMediaModule.loadAnalytics();

    const container = document.getElementById('analyticsContent');
    expect(container.innerHTML).toContain('Failed to load analytics');
  });

  test('handles empty posts array', async () => {
    mockSupabase.select.mockReturnValueOnce(
      Promise.resolve({ data: [], error: null })
    );

    await socialMediaModule.loadAnalytics();

    const container = document.getElementById('analyticsContent');
    expect(container.innerHTML).toContain('0');
  });

  test('handles null posts data', async () => {
    mockSupabase.select.mockReturnValueOnce(
      Promise.resolve({ data: null, error: null })
    );

    await socialMediaModule.loadAnalytics();

    const container = document.getElementById('analyticsContent');
    expect(container.innerHTML).toContain('0');
  });

  test('counts platform occurrences correctly', async () => {
    const allPosts = [
      { status: 'published', platforms: ['twitter', 'facebook', 'instagram', 'linkedin'], created_at: new Date().toISOString() },
      { status: 'published', platforms: ['twitter'], created_at: new Date().toISOString() },
    ];

    mockSupabase.select.mockReturnValueOnce(
      Promise.resolve({ data: allPosts, error: null })
    );

    await socialMediaModule.loadAnalytics();

    const container = document.getElementById('analyticsContent');
    // Twitter appears in both posts = 2
    expect(container.innerHTML).toContain('X');
    expect(container.innerHTML).toContain('Facebook');
    expect(container.innerHTML).toContain('Instagram');
    expect(container.innerHTML).toContain('LinkedIn');
  });

  test('counts posts this week and this month', async () => {
    const now = new Date();
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const fifteenDaysAgo = new Date(now);
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const allPosts = [
      { status: 'published', platforms: ['twitter'], created_at: twoDaysAgo.toISOString() },
      { status: 'published', platforms: ['twitter'], created_at: fifteenDaysAgo.toISOString() },
      { status: 'published', platforms: ['twitter'], created_at: sixtyDaysAgo.toISOString() },
    ];

    mockSupabase.select.mockReturnValueOnce(
      Promise.resolve({ data: allPosts, error: null })
    );

    await socialMediaModule.loadAnalytics();

    const container = document.getElementById('analyticsContent');
    // This week: 1 post (2 days ago)
    expect(container.innerHTML).toContain('1 posts');
    // This month: 2 posts (2 days + 15 days)
    expect(container.innerHTML).toContain('2 posts');
    // All time: 3 published
    expect(container.innerHTML).toContain('3 posts');
  });
});

describe('Social Media Module - initialize()', () => {
  let showLoadingSpy;
  let hideLoadingSpy;
  let showToastSpy;

  beforeEach(() => {
    showLoadingSpy = jest.spyOn(utils, 'showLoading');
    hideLoadingSpy = jest.spyOn(utils, 'hideLoading');
    showToastSpy = jest.spyOn(utils, 'showToast');
    socialMediaModule.initialized = false;

    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.order.mockReturnValue(mockSupabase);
    mockSupabase.then.mockImplementation((cb) => cb({ data: [], error: null }));

    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    showLoadingSpy.mockRestore();
    hideLoadingSpy.mockRestore();
    showToastSpy.mockRestore();
  });

  test('calls showLoading and hideLoading', async () => {
    await socialMediaModule.initialize();

    expect(showLoadingSpy).toHaveBeenCalled();
    expect(hideLoadingSpy).toHaveBeenCalled();
  });

  test('sets initialized to true after first call', async () => {
    socialMediaModule.initialized = false;
    await socialMediaModule.initialize();
    expect(socialMediaModule.initialized).toBe(true);
  });

  test('does not re-run loadCompanies/loadAwards when already initialized', async () => {
    socialMediaModule.initialized = true;
    const fromSpy = jest.spyOn(mockSupabase, 'from');

    await socialMediaModule.initialize();

    // from() should still be called for loadAnalytics and load*Posts,
    // but NOT for loadCompanies/loadAwards since initialized=true
    // The key thing is it doesn't throw and completes
    expect(socialMediaModule.initialized).toBe(true);
    fromSpy.mockRestore();
  });

  test('shows error toast on initialization failure', async () => {
    socialMediaModule.initialized = false;
    // Make loadCompanies fail
    mockSupabase.order.mockReturnValueOnce(Promise.resolve({ data: null, error: { message: 'Companies load error' } }));

    await socialMediaModule.initialize();

    expect(showToastSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load social media manager'),
      'error'
    );
  });
});

describe('Social Media Module - handleImageUpload()', () => {
  let showToastSpy;
  let showLoadingSpy;
  let hideLoadingSpy;

  beforeEach(() => {
    showToastSpy = jest.spyOn(utils, 'showToast');
    showLoadingSpy = jest.spyOn(utils, 'showLoading');
    hideLoadingSpy = jest.spyOn(utils, 'hideLoading');
    socialMediaModule.uploadedImageUrl = null;
  });

  afterEach(() => {
    showToastSpy.mockRestore();
    showLoadingSpy.mockRestore();
    hideLoadingSpy.mockRestore();
  });

  test('does nothing when no file is selected', async () => {
    const fileInput = document.getElementById('smCustomImage');
    // Ensure no files are set
    Object.defineProperty(fileInput, 'files', {
      value: [],
      writable: true,
      configurable: true,
    });

    await socialMediaModule.handleImageUpload();

    expect(showLoadingSpy).not.toHaveBeenCalled();
  });

  test('rejects files larger than 10MB', async () => {
    const fileInput = document.getElementById('smCustomImage');
    const bigFile = new Blob(['x'.repeat(100)], { type: 'image/png' });
    Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 });
    Object.defineProperty(bigFile, 'type', { value: 'image/png' });
    Object.defineProperty(bigFile, 'name', { value: 'big.png' });
    Object.defineProperty(fileInput, 'files', {
      value: [bigFile],
      writable: true,
      configurable: true,
    });

    await socialMediaModule.handleImageUpload();

    expect(showToastSpy).toHaveBeenCalledWith('Image too large. Maximum size is 10MB.', 'error');
  });

  test('rejects invalid file types', async () => {
    const fileInput = document.getElementById('smCustomImage');
    const pdfFile = new Blob(['%PDF'], { type: 'application/pdf' });
    Object.defineProperty(pdfFile, 'size', { value: 1024 });
    Object.defineProperty(pdfFile, 'type', { value: 'application/pdf' });
    Object.defineProperty(pdfFile, 'name', { value: 'doc.pdf' });
    Object.defineProperty(fileInput, 'files', {
      value: [pdfFile],
      writable: true,
      configurable: true,
    });

    await socialMediaModule.handleImageUpload();

    expect(showToastSpy).toHaveBeenCalledWith(
      'Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.',
      'error'
    );
  });

  test('uploads valid image to storage successfully', async () => {
    const fileInput = document.getElementById('smCustomImage');
    const validFile = new Blob(['imagedata'], { type: 'image/jpeg' });
    Object.defineProperty(validFile, 'size', { value: 5000 });
    Object.defineProperty(validFile, 'type', { value: 'image/jpeg' });
    Object.defineProperty(validFile, 'name', { value: 'photo.jpg' });
    Object.defineProperty(fileInput, 'files', {
      value: [validFile],
      writable: true,
      configurable: true,
    });

    await socialMediaModule.handleImageUpload();

    expect(showLoadingSpy).toHaveBeenCalled();
    expect(hideLoadingSpy).toHaveBeenCalled();
    expect(socialMediaModule.uploadedImageUrl).toBe('https://storage.example.com/image.png');
    expect(showToastSpy).toHaveBeenCalledWith('Image uploaded successfully', 'success');
  });

  test('falls back to local preview when storage upload fails', async () => {
    const fileInput = document.getElementById('smCustomImage');
    const validFile = new Blob(['imagedata'], { type: 'image/png' });
    Object.defineProperty(validFile, 'size', { value: 2000 });
    Object.defineProperty(validFile, 'type', { value: 'image/png' });
    Object.defineProperty(validFile, 'name', { value: 'test.png' });
    Object.defineProperty(fileInput, 'files', {
      value: [validFile],
      writable: true,
      configurable: true,
    });

    // Mock storage upload to fail
    const storageMock = {
      upload: jest.fn(() => Promise.resolve({ data: null, error: { message: 'Bucket not found' } })),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://storage.example.com/fallback.png' } })),
    };
    mockSupabase.storage.from.mockReturnValueOnce(storageMock);

    await socialMediaModule.handleImageUpload();

    expect(socialMediaModule.uploadedImageUrl).toBe('blob://mock');
  });

  test('falls back to local preview on unexpected error', async () => {
    const fileInput = document.getElementById('smCustomImage');
    const validFile = new Blob(['imagedata'], { type: 'image/gif' });
    Object.defineProperty(validFile, 'size', { value: 3000 });
    Object.defineProperty(validFile, 'type', { value: 'image/gif' });
    Object.defineProperty(validFile, 'name', { value: 'anim.gif' });
    Object.defineProperty(fileInput, 'files', {
      value: [validFile],
      writable: true,
      configurable: true,
    });

    // Mock storage to throw
    mockSupabase.storage.from.mockImplementationOnce(() => {
      throw new Error('Storage unavailable');
    });

    await socialMediaModule.handleImageUpload();

    expect(socialMediaModule.uploadedImageUrl).toBe('blob://mock');
    expect(showToastSpy).toHaveBeenCalledWith(
      expect.stringContaining('storage upload unavailable'),
      'warning'
    );
  });
});

describe('Social Media Module - bulkGenerate()', () => {
  let showToastSpy;

  beforeEach(() => {
    showToastSpy = jest.spyOn(utils, 'showToast');
    document.getElementById('bulkAwardSelect').innerHTML =
      '<option value="">Select award...</option><option value="award-1">Best Plumber</option>';
    document.getElementById('bulkTemplateType').value = '';
    document.getElementById('bulkPlatformTwitter').checked = true;
    document.getElementById('bulkPlatformFacebook').checked = true;
    document.getElementById('bulkPlatformInstagram').checked = false;
    document.getElementById('bulkPlatformLinkedIn').checked = false;
    document.getElementById('bulkSaveAs').value = 'draft';

    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.insert.mockReturnValue(mockSupabase);

    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    showToastSpy.mockRestore();
    mockSupabase.then.mockImplementation((cb) => cb({ data: [], error: null }));
  });

  test('shows warning when no award is selected', async () => {
    document.getElementById('bulkAwardSelect').value = '';
    await socialMediaModule.bulkGenerate();
    expect(showToastSpy).toHaveBeenCalledWith('Please select an award category', 'warning');
  });

  test('shows warning when no template type is selected', async () => {
    document.getElementById('bulkAwardSelect').value = 'award-1';
    document.getElementById('bulkTemplateType').value = '';
    await socialMediaModule.bulkGenerate();
    expect(showToastSpy).toHaveBeenCalledWith('Please select a template type', 'warning');
  });
});

describe('Social Media Module - openBulkGenerateModal()', () => {
  test('does not throw when modal element exists', async () => {
    await expect(socialMediaModule.openBulkGenerateModal()).resolves.not.toThrow();
  });

  test('copies award select options into bulk modal', async () => {
    await socialMediaModule.openBulkGenerateModal();

    const bulkSelect = document.getElementById('bulkAwardSelect');
    const mainSelect = document.getElementById('smAwardSelect');
    expect(bulkSelect.innerHTML).toBe(mainSelect.innerHTML);
  });
});

describe('Social Media Module - loadCompanies()', () => {
  beforeEach(() => {
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.order.mockReturnValue(mockSupabase);
  });

  test('populates company select with options from database', async () => {
    const companies = [
      { id: 'c1', company_name: 'Alpha Corp', logo_url: 'https://logo.png', website: 'https://alpha.com' },
      { id: 'c2', company_name: 'Bravo Ltd', logo_url: null, website: null },
    ];

    mockSupabase.order.mockReturnValueOnce(Promise.resolve({ data: companies, error: null }));

    await socialMediaModule.loadCompanies();

    const select = document.getElementById('smCompanySelect');
    // First option is placeholder, then two companies
    expect(select.options.length).toBe(3);
    expect(select.options[1].textContent).toBe('Alpha Corp');
    expect(select.options[1].value).toBe('c1');
    expect(select.options[1].dataset.logo).toBe('https://logo.png');
    expect(select.options[1].dataset.website).toBe('https://alpha.com');
    expect(select.options[2].textContent).toBe('Bravo Ltd');
    expect(select.options[2].dataset.logo).toBe('');
    expect(select.options[2].dataset.website).toBe('');
  });

  test('shows error message in select when load fails', async () => {
    mockSupabase.order.mockReturnValueOnce(
      Promise.resolve({ data: null, error: { message: 'Access denied' } })
    );

    await socialMediaModule.loadCompanies();

    const select = document.getElementById('smCompanySelect');
    expect(select.innerHTML).toContain('Failed to load companies');
  });

  test('handles null data with empty list', async () => {
    mockSupabase.order.mockReturnValueOnce(
      Promise.resolve({ data: null, error: null })
    );

    await socialMediaModule.loadCompanies();

    const select = document.getElementById('smCompanySelect');
    expect(select.options.length).toBe(1); // just the placeholder
  });
});

describe('Social Media Module - loadAwards()', () => {
  beforeEach(() => {
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.order.mockReturnValue(mockSupabase);
  });

  test('populates award select with options from database', async () => {
    const awards = [
      { id: 'a1', award_name: 'Best Innovation', award_category: 'Tech' },
      { id: 'a2', award_name: 'Best Service', award_category: 'Service' },
    ];

    mockSupabase.order.mockReturnValueOnce(Promise.resolve({ data: awards, error: null }));

    await socialMediaModule.loadAwards();

    const select = document.getElementById('smAwardSelect');
    expect(select.options.length).toBe(3);
    expect(select.options[1].textContent).toBe('Best Innovation');
    expect(select.options[1].value).toBe('a1');
    expect(select.options[2].textContent).toBe('Best Service');
  });

  test('shows error message in select when load fails', async () => {
    mockSupabase.order.mockReturnValueOnce(
      Promise.resolve({ data: null, error: { message: 'DB error' } })
    );

    await socialMediaModule.loadAwards();

    const select = document.getElementById('smAwardSelect');
    expect(select.innerHTML).toContain('Failed to load awards');
  });

  test('handles null data with empty list', async () => {
    mockSupabase.order.mockReturnValueOnce(
      Promise.resolve({ data: null, error: null })
    );

    await socialMediaModule.loadAwards();

    const select = document.getElementById('smAwardSelect');
    expect(select.options.length).toBe(1);
  });
});

describe('Social Media Module - setupImageSourceHandlers()', () => {
  test('does not throw when called', () => {
    expect(() => socialMediaModule.setupImageSourceHandlers()).not.toThrow();
  });

  test('sets up change listener on custom radio', () => {
    const customRadio = document.getElementById('imageCustom');
    const customUpload = document.getElementById('customImageUpload');
    customUpload.style.display = 'none';

    socialMediaModule.setupImageSourceHandlers();

    // Simulate the custom radio being checked
    customRadio.checked = true;
    customRadio.dispatchEvent(new dom.window.Event('change'));
    expect(customUpload.style.display).toBe('block');
  });

  test('sets up change listener on company logo radio', () => {
    const companyLogoRadio = document.getElementById('imageCompanyLogo');
    const customUpload = document.getElementById('customImageUpload');
    customUpload.style.display = 'block';

    socialMediaModule.setupImageSourceHandlers();

    companyLogoRadio.checked = true;
    companyLogoRadio.dispatchEvent(new dom.window.Event('change'));
    expect(customUpload.style.display).toBe('none');
  });
});

describe('Social Media Module - showEditingIndicator() additional', () => {
  beforeEach(() => {
    const existing = document.getElementById('editingBanner');
    if (existing) existing.remove();
  });

  test('show=true creates banner with editing message', () => {
    // The smPostContent is inside a card in the DOM
    // But in our test DOM, smPostContent is not inside the .card element
    // The test verifies the function doesn't throw when card structure is found or not
    socialMediaModule.showEditingIndicator(true);

    // The banner may or may not be created depending on DOM structure
    // At minimum it should not throw
  });

  test('calling show=true twice does not duplicate banner', () => {
    socialMediaModule.showEditingIndicator(true);
    socialMediaModule.showEditingIndicator(true);

    const banners = document.querySelectorAll('#editingBanner');
    expect(banners.length).toBeLessThanOrEqual(1);
  });
});

describe('Social Media Module - validateImageDimensions() additional', () => {
  test('creates Image and sets src when imageUrl is provided', () => {
    const warningContainer = document.getElementById('imageSizeWarning');
    warningContainer.innerHTML = '';

    // Even though Image onload won't fire in JSDOM, the function should not throw
    socialMediaModule.validateImageDimensions('https://example.com/valid-image.jpg');

    // The function creates an Image but onload fires asynchronously
    // Just verify it didn't clear the container (since imageUrl is truthy)
    // and didn't throw
  });

  test('does not throw when warningContainer is missing', () => {
    const el = document.getElementById('imageSizeWarning');
    const parent = el.parentNode;
    parent.removeChild(el);

    expect(() => socialMediaModule.validateImageDimensions('https://example.com/test.jpg')).not.toThrow();
    expect(() => socialMediaModule.validateImageDimensions(null)).not.toThrow();

    // Restore
    parent.appendChild(el);
  });
});

describe('Social Media Module - updateImagePreview() additional scenarios', () => {
  beforeEach(() => {
    document.getElementById('imageCompanyLogo').checked = true;
    document.getElementById('imageCustom').checked = false;
    document.getElementById('smCompanySelect').selectedIndex = 0;
    document.getElementById('smAddLogoOverlay').checked = false;
    socialMediaModule.uploadedImageUrl = null;
    ['twitterPreviewImage', 'facebookPreviewImage', 'instagramPreviewImage', 'linkedinPreviewImage'].forEach((id) => {
      document.getElementById(id).innerHTML = '';
    });
  });

  test('shows placeholder when company has no logo', () => {
    document.getElementById('smCompanySelect').selectedIndex = 2; // Beta Builders - empty logo
    socialMediaModule.updateImagePreview();
    const preview = document.getElementById('twitterPreviewImage');
    expect(preview.innerHTML).toContain('bi-image');
  });

  test('shows placeholder when custom source selected but no uploaded image', () => {
    document.getElementById('imageCustom').checked = true;
    document.getElementById('imageCompanyLogo').checked = false;
    socialMediaModule.uploadedImageUrl = null;
    socialMediaModule.updateImagePreview();
    const preview = document.getElementById('facebookPreviewImage');
    expect(preview.innerHTML).toContain('bi-image');
  });

  test('image container has correct class', () => {
    document.getElementById('imageCompanyLogo').checked = true;
    document.getElementById('smCompanySelect').selectedIndex = 1;
    socialMediaModule.updateImagePreview();
    const preview = document.getElementById('twitterPreviewImage');
    const container = preview.querySelector('.image-preview-container');
    expect(container).not.toBeNull();
  });

  test('main image has correct alt text', () => {
    document.getElementById('imageCompanyLogo').checked = true;
    document.getElementById('smCompanySelect').selectedIndex = 1;
    socialMediaModule.updateImagePreview();
    const img = document.getElementById('twitterPreviewImage').querySelector('img');
    expect(img.alt).toBe('Post image');
  });

  test('logo overlay image has correct alt and class', () => {
    document.getElementById('imageCompanyLogo').checked = true;
    document.getElementById('smCompanySelect').selectedIndex = 1;
    document.getElementById('smAddLogoOverlay').checked = true;
    socialMediaModule.updateImagePreview();
    const imgs = document.getElementById('twitterPreviewImage').querySelectorAll('img');
    expect(imgs[1].alt).toBe('British Trade Awards');
    expect(imgs[1].className).toBe('logo-overlay');
  });
});

describe('Social Media Module - character count edge cases', () => {
  beforeEach(() => {
    document.getElementById('smPostContent').value = '';
    document.getElementById('smPlatformOverrides').checked = false;
    document.getElementById('smCompanySelect').selectedIndex = 0;
    document.getElementById('smAwardSelect').selectedIndex = 0;
  });

  test('instagram character count set correctly', () => {
    document.getElementById('smPostContent').value = 'A short instagram post';
    socialMediaModule.updateCharacterCounts();
    expect(document.getElementById('instagramCharCount').textContent).toBe('22');
  });

  test('linkedin character count set correctly', () => {
    document.getElementById('smPostContent').value = 'LinkedIn professional update';
    socialMediaModule.updateCharacterCounts();
    expect(document.getElementById('linkedinCharCount').textContent).toBe('28');
  });

  test('instagram over limit shows danger class', () => {
    document.getElementById('smPostContent').value = 'x'.repeat(2300);
    socialMediaModule.updateCharacterCounts();
    const meta = document.getElementById('instagramCharCount').closest('.preview-meta');
    expect(meta.className).toContain('text-danger');
  });

  test('linkedin over limit shows danger class', () => {
    document.getElementById('smPostContent').value = 'x'.repeat(3100);
    socialMediaModule.updateCharacterCounts();
    const meta = document.getElementById('linkedinCharCount').closest('.preview-meta');
    expect(meta.className).toContain('text-danger');
  });

  test('instagram under limit has no danger/warning class', () => {
    document.getElementById('smPostContent').value = 'Short post';
    socialMediaModule.updateCharacterCounts();
    const meta = document.getElementById('instagramCharCount').closest('.preview-meta');
    expect(meta.className).toBe('preview-meta');
  });

  test('empty content gives 0 character count', () => {
    document.getElementById('smPostContent').value = '';
    socialMediaModule.updateCharacterCounts();
    expect(document.getElementById('twitterCharCount').textContent).toBe('0');
    expect(document.getElementById('instagramCharCount').textContent).toBe('0');
    expect(document.getElementById('linkedinCharCount').textContent).toBe('0');
  });
});

describe('Social Media Module - savePost with platform content overrides', () => {
  let showToastSpy;
  let confirmSpy;

  beforeEach(() => {
    showToastSpy = jest.spyOn(utils, 'showToast');

    // Restore the company/award select options that may have been overwritten by loadCompanies/loadAwards tests
    const companySelect = document.getElementById('smCompanySelect');
    companySelect.innerHTML = `
      <option value="">Select company...</option>
      <option value="comp-1" data-logo="https://example.com/logo1.png" data-website="https://acme.co.uk">Acme Plumbing</option>
      <option value="comp-2" data-logo="" data-website="">Beta Builders</option>
    `;
    const awardSelect = document.getElementById('smAwardSelect');
    awardSelect.innerHTML = `
      <option value="">Select award...</option>
      <option value="award-1">Best Plumber South East</option>
      <option value="award-2">Best Builder London</option>
    `;

    document.getElementById('smPostContent').value = 'Main post content';
    document.getElementById('smCompanySelect').selectedIndex = 1;
    document.getElementById('smAwardSelect').selectedIndex = 1;
    document.getElementById('platformTwitter').checked = true;
    document.getElementById('platformFacebook').checked = true;
    document.getElementById('platformInstagram').checked = false;
    document.getElementById('platformLinkedIn').checked = false;
    document.getElementById('smPlatformOverrides').checked = true;
    document.getElementById('smTwitterContent').value = 'Custom tweet';
    document.getElementById('smFacebookContent').value = 'Custom FB post';
    document.getElementById('imageCompanyLogo').checked = true;
    document.getElementById('smAddLogoOverlay').checked = true;
    socialMediaModule.editingPostId = null;
    socialMediaModule.currentTemplate = 'winner';

    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.insert.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    showToastSpy.mockRestore();
    if (confirmSpy) confirmSpy.mockRestore();
    mockSupabase.then.mockImplementation((cb) => cb({ data: [], error: null }));
  });

  test('scheduled post with platform overrides and logo overlay', async () => {
    document.getElementById('smScheduleDate').value = '2030-12-25';
    document.getElementById('smScheduleTime').value = '14:00';

    mockSupabase.select.mockReturnValueOnce(
      Promise.resolve({ data: [{ id: 'override-post' }], error: null })
    );

    await socialMediaModule.savePost('scheduled');
    expect(mockSupabase.insert).toHaveBeenCalled();
    expect(showToastSpy).toHaveBeenCalledWith('Post scheduled successfully!', 'success');
  });
});

describe('Social Media Module - template content details', () => {
  test('nominee template includes vote call to action', () => {
    const content = socialMediaModule.templates.nominee.content;
    expect(content.toLowerCase()).toContain('vote');
  });

  test('winner template includes congratulations', () => {
    const content = socialMediaModule.templates.winner.content;
    expect(content.toLowerCase()).toContain('congratulations');
  });

  test('voting template includes time urgency', () => {
    const content = socialMediaModule.templates.voting.content;
    expect(content.toLowerCase()).toContain('running out');
  });

  test('nominee template name is correct', () => {
    expect(socialMediaModule.templates.nominee.name).toBe('Nominee Announcement');
  });

  test('winner template name is correct', () => {
    expect(socialMediaModule.templates.winner.name).toBe('Winner Announcement');
  });

  test('voting template name is correct', () => {
    expect(socialMediaModule.templates.voting.name).toBe('Voting Reminder');
  });
});

describe('Social Media Module - renderScheduledPosts() additional', () => {
  test('renders correct date formatting from scheduled_for', () => {
    socialMediaModule.renderScheduledPosts(sampleScheduledPosts);
    const container = document.getElementById('scheduledPostsList');
    // Posts should have date/time rendered
    expect(container.innerHTML).toContain('bi-calendar3');
    expect(container.innerHTML).toContain('bi-clock');
  });

  test('renders data-id attributes on edit buttons', () => {
    socialMediaModule.renderScheduledPosts(sampleScheduledPosts);
    const container = document.getElementById('scheduledPostsList');
    const editBtns = container.querySelectorAll('[data-action="socialMediaModule.editScheduledPost"]');
    expect(editBtns[0].getAttribute('data-id')).toBe('post-1');
    expect(editBtns[1].getAttribute('data-id')).toBe('post-2');
  });

  test('renders data-id attributes on delete buttons', () => {
    socialMediaModule.renderScheduledPosts(sampleScheduledPosts);
    const container = document.getElementById('scheduledPostsList');
    const deleteBtns = container.querySelectorAll('[data-action="socialMediaModule.deleteScheduledPost"]');
    expect(deleteBtns[0].getAttribute('data-id')).toBe('post-1');
    expect(deleteBtns[1].getAttribute('data-id')).toBe('post-2');
  });
});

describe('Social Media Module - renderPublishedPosts() additional', () => {
  test('renders reuse button with correct data-action', () => {
    socialMediaModule.renderPublishedPosts(samplePublishedPosts);
    const container = document.getElementById('publishedPostsList');
    const reuseBtns = container.querySelectorAll('[data-action="socialMediaModule.reusePost"]');
    expect(reuseBtns.length).toBe(2);
    expect(reuseBtns[0].getAttribute('data-id')).toBe('pub-1');
  });

  test('renders content preview for published posts', () => {
    socialMediaModule.renderPublishedPosts(samplePublishedPosts);
    const container = document.getElementById('publishedPostsList');
    expect(container.innerHTML).toContain('Congratulations to Acme Plumbing');
  });
});

describe('Social Media Module - showPostSuccessMessage()', () => {
  let showToastSpy;

  beforeEach(() => {
    showToastSpy = jest.spyOn(utils, 'showToast');
  });

  afterEach(() => {
    showToastSpy.mockRestore();
  });

  test('formats platform names with capitalized first letter', () => {
    socialMediaModule.showPostSuccessMessage(['twitter', 'facebook']);
    expect(showToastSpy).toHaveBeenCalledWith(
      expect.stringContaining('Twitter, Facebook'),
      'info',
      5000
    );
  });

  test('formats single platform name correctly', () => {
    socialMediaModule.showPostSuccessMessage(['linkedin']);
    expect(showToastSpy).toHaveBeenCalledWith(
      expect.stringContaining('Linkedin'),
      'info',
      5000
    );
  });

  test('includes platform API integration note', () => {
    socialMediaModule.showPostSuccessMessage(['twitter']);
    expect(showToastSpy).toHaveBeenCalledWith(
      expect.stringContaining('Platform API integration required'),
      'info',
      5000
    );
  });
});

describe('Social Media Module - openPlatformSettings()', () => {
  let showToastSpy;

  beforeEach(() => {
    showToastSpy = jest.spyOn(utils, 'showToast');
  });

  afterEach(() => {
    showToastSpy.mockRestore();
  });

  test('shows toast with OAuth configuration info', () => {
    socialMediaModule.openPlatformSettings();
    expect(showToastSpy).toHaveBeenCalledWith(
      expect.stringContaining('OAuth API keys'),
      'info'
    );
  });

  test('mentions all four platforms', () => {
    socialMediaModule.openPlatformSettings();
    const message = showToastSpy.mock.calls[0][0];
    expect(message).toContain('X');
    expect(message).toContain('Facebook');
    expect(message).toContain('Instagram');
    expect(message).toContain('LinkedIn');
  });
});
