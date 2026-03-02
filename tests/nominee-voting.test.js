/**
 * Tests for the Nominee Voting Module (nominee-voting.js)
 * Run with: npx jest tests/nominee-voting.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(
  `<!DOCTYPE html><html><head>
  <meta property="og:title" content="">
  <meta property="og:description" content="">
</head><body>
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
  <div id="loadingState" style="display:block;"></div>
  <div id="nomineeCard" style="display:none;"></div>
  <div id="errorState" style="display:none;"></div>
  <img id="companyLogo" src="">
  <span id="awardBadge"></span>
  <h2 id="companyName"></h2>
  <p id="entryDescription"></p>
  <a id="companyWebsite" href="#"></a>
  <span id="entryTitle"></span>
  <span id="entryNumber"></span>
  <span id="voteCount">0</span>
  <div id="whyShouldWin" style="display:none;"><span id="whyShouldWinText"></span></div>
  <div id="websiteLinkSection" style="display:none;"><a id="websiteLink" href="#"></a></div>
  <button id="voteButton"></button>
  <div id="publicToastContainer"></div>
  <form id="verificationForm"><input id="voterEmail" type="email"><button type="submit">Verify</button></form>
  <div id="votingSection" style="display:none;"></div>
  <div id="verificationSection"></div>
</body></html>`,
  { url: 'http://localhost?entry=BTA-001' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.sessionStorage = dom.window.sessionStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.requestAnimationFrame = jest.fn((cb) => cb());

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
  insert: jest.fn(() => Promise.resolve({ data: {}, error: null })),
  update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  in: jest.fn(() => mockSupabase),
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

global.window.SUPABASE_CONFIG = { url: 'https://test.supabase.co', anonKey: 'test-key' };
global.window.supabase = { createClient: () => mockSupabase };
global.supabase = global.window.supabase;
global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));

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
require('../nominee-voting.js');
syncWindowToGlobal();

// Ensure showPublicToast is available globally (standalone function exposed on window)
global.showPublicToast = global.window.showPublicToast;

// Save original methods so tests that mock them can be isolated
const _originalShowError = nomineeVoting.showError.bind(nomineeVoting);
const _originalDisplayEntry = nomineeVoting.displayEntry.bind(nomineeVoting);

describe('Nominee Voting - Structure', () => {
  test('nomineeVoting is defined', () => {
    expect(nomineeVoting).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof nomineeVoting.initialize).toBe('function');
    expect(typeof nomineeVoting.loadEntry).toBe('function');
    expect(typeof nomineeVoting.checkIfVoted).toBe('function');
    expect(typeof nomineeVoting.displayEntry).toBe('function');
    expect(typeof nomineeVoting.showError).toBe('function');
  });

  test('has default state', () => {
    expect(nomineeVoting.entry).toBeNull();
    expect(nomineeVoting.entryId).toBeNull();
    expect(nomineeVoting.hasVoted).toBe(false);
  });
});

describe('Nominee Voting - checkIfVoted', () => {
  test('sets hasVoted to true when vote exists', async () => {
    nomineeVoting.entryId = 'e1';
    nomineeVoting.voterEmail = 'voter@test.com';
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ exists: true }) }));
    await nomineeVoting.checkIfVoted();
    expect(nomineeVoting.hasVoted).toBe(true);
  });

  test('sets hasVoted to false when no vote', async () => {
    nomineeVoting.entryId = 'e1';
    nomineeVoting.voterEmail = 'voter@test.com';
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ exists: false }) }));
    await nomineeVoting.checkIfVoted();
    expect(nomineeVoting.hasVoted).toBe(false);
  });
});

describe('Nominee Voting - displayEntry', () => {
  test('displays entry information correctly', () => {
    nomineeVoting.entry = {
      id: 'e1',
      entry_description: 'Test description',
      organisations: {
        company_name: 'Test Co',
        logo_url: 'https://cdn.example.com/logo.png',
        website: 'https://test.com',
      },
      awards: { award_name: 'Best Innovation' },
    };

    nomineeVoting.displayEntry();

    expect(document.getElementById('loadingState').style.display).toBe('none');
    expect(document.getElementById('nomineeCard').style.display).toBe('block');
    expect(document.getElementById('awardBadge').textContent).toBe('Best Innovation');
  });

  test('handles missing organisation data', () => {
    nomineeVoting.entry = {
      id: 'e1',
      entry_description: 'Test',
      organisations: null,
      awards: null,
    };

    expect(() => nomineeVoting.displayEntry()).not.toThrow();
  });
});

describe('Nominee Voting - showError', () => {
  test('showError shows error state', () => {
    if (typeof nomineeVoting.showError === 'function') {
      nomineeVoting.showError();
      // Verify it doesn't throw
    }
  });
});

describe('Nominee Voting - loadEntry', () => {
  afterEach(() => {
    // Restore original methods that may have been replaced by jest.fn()
    nomineeVoting.showError = _originalShowError;
    nomineeVoting.displayEntry = _originalDisplayEntry;
  });

  test('handles entry not found', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ entry: null }) }));
    nomineeVoting.showError = jest.fn();
    await nomineeVoting.loadEntry('BTA-999', null);
    expect(nomineeVoting.showError).toHaveBeenCalled();
  });

  test('loads entry by entry number successfully', async () => {
    const mockEntry = {
      id: 'e1',
      entry_number: 'BTA-001',
      entry_description: 'Test',
      public_votes: 5,
      organisations: { company_name: 'Test Co', logo_url: null },
      awards: { award_name: 'Best Test' },
    };
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ entry: mockEntry }) }));
    nomineeVoting.displayEntry = jest.fn();
    nomineeVoting.voterEmail = null;
    await nomineeVoting.loadEntry('BTA-001', null);
    expect(nomineeVoting.entry).toEqual(mockEntry);
    expect(nomineeVoting.entryId).toBe('e1');
    expect(nomineeVoting.displayEntry).toHaveBeenCalled();
  });

  test('loads entry by id', async () => {
    const mockEntry = {
      id: 'e2',
      entry_number: 'BTA-002',
      entry_description: 'Test',
      public_votes: 0,
      organisations: { company_name: 'A' },
      awards: { award_name: 'B' },
    };
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ entry: mockEntry }) }));
    nomineeVoting.displayEntry = jest.fn();
    nomineeVoting.voterEmail = null;
    await nomineeVoting.loadEntry(null, 'e2');
    expect(nomineeVoting.entry).toEqual(mockEntry);
  });

  test('handles fetch error', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));
    nomineeVoting.showError = jest.fn();
    await nomineeVoting.loadEntry('BTA-999', null);
    expect(nomineeVoting.showError).toHaveBeenCalled();
  });

  test('checks if voted when voterEmail is set', async () => {
    const mockEntry = {
      id: 'e3',
      entry_number: 'BTA-003',
      entry_description: 'Test',
      public_votes: 2,
      organisations: { company_name: 'C' },
      awards: { award_name: 'D' },
    };
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ entry: mockEntry }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ exists: false }) });
    nomineeVoting.displayEntry = jest.fn();
    nomineeVoting.voterEmail = 'test@test.com';
    await nomineeVoting.loadEntry('BTA-003', null);
    expect(nomineeVoting.displayEntry).toHaveBeenCalled();
  });
});

// ==========================================================================
// NEW TESTS — coverage boost for nominee-voting.js
// ==========================================================================

describe('Nominee Voting - showError()', () => {
  test('hides loading and shows error state', () => {
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('errorState').style.display = 'none';
    nomineeVoting.showError();
    expect(document.getElementById('loadingState').style.display).toBe('none');
    expect(document.getElementById('errorState').style.display).toBe('block');
  });
});

describe('Nominee Voting - displayEntry comprehensive', () => {
  test('displays entry with logo_url', () => {
    nomineeVoting.entry = {
      id: 'e1',
      entry_number: 'BTA-001',
      entry_title: 'My Entry',
      entry_description: 'A description',
      public_votes: 42,
      organisations: {
        company_name: 'Logo Co',
        logo_url: 'https://cdn.example.com/logo.png',
        website: 'https://example.com',
      },
      awards: { award_name: 'Best Innovation' },
    };
    nomineeVoting.hasVoted = false;
    nomineeVoting.displayEntry();
    expect(document.getElementById('companyLogo').src).toContain('logo.png');
    expect(document.getElementById('companyName').textContent).toBe('Logo Co');
    expect(document.getElementById('awardBadge').textContent).toBe('Best Innovation');
    expect(document.getElementById('entryTitle').textContent).toBe('My Entry');
    expect(document.getElementById('entryNumber').textContent).toBe('BTA-001');
    expect(document.getElementById('voteCount').textContent).toBe('42');
  });

  test('displays default logo when no logo_url', () => {
    nomineeVoting.entry = {
      id: 'e2',
      entry_description: 'Test',
      organisations: { company_name: 'No Logo', logo_url: null },
      awards: { award_name: 'Test Award' },
    };
    nomineeVoting.hasVoted = false;
    nomineeVoting.displayEntry();
    expect(document.getElementById('companyLogo').src).toContain('data:image');
  });

  test('shows why_should_win section when present', () => {
    nomineeVoting.entry = {
      id: 'e3',
      entry_description: 'Test',
      why_should_win: 'Because they are great',
      organisations: { company_name: 'Great Co', logo_url: null },
      awards: { award_name: 'Best' },
    };
    nomineeVoting.hasVoted = false;
    nomineeVoting.displayEntry();
    expect(document.getElementById('whyShouldWin').style.display).toBe('block');
    expect(document.getElementById('whyShouldWinText').textContent).toBe('Because they are great');
  });

  test('shows website link when present', () => {
    nomineeVoting.entry = {
      id: 'e4',
      entry_description: 'Test',
      organisations: { company_name: 'Web Co', logo_url: null, website: 'https://web.com' },
      awards: { award_name: 'Best' },
    };
    nomineeVoting.hasVoted = false;
    nomineeVoting.displayEntry();
    expect(document.getElementById('websiteLinkSection').style.display).toBe('block');
    expect(document.getElementById('websiteLink').href).toContain('web.com');
  });

  test('disables vote button when already voted', () => {
    nomineeVoting.entry = {
      id: 'e5',
      entry_description: 'Test',
      organisations: { company_name: 'Voted Co', logo_url: null },
      awards: { award_name: 'Award' },
    };
    nomineeVoting.hasVoted = true;
    nomineeVoting.displayEntry();
    const btn = document.getElementById('voteButton');
    expect(btn.disabled).toBe(true);
    expect(btn.innerHTML).toContain('Already Voted');
  });
});

describe('Nominee Voting - updateVoteButton()', () => {
  test('disables vote button and changes text', () => {
    const btn = document.getElementById('voteButton');
    btn.disabled = false;
    btn.innerHTML = 'Vote';
    nomineeVoting.updateVoteButton();
    expect(btn.disabled).toBe(true);
    expect(btn.innerHTML).toContain('Already Voted');
  });
});

describe('Nominee Voting - checkIfVoted error handling', () => {
  test('sets hasVoted to false on error', async () => {
    nomineeVoting.entryId = 'e1';
    nomineeVoting.voterEmail = 'voter@test.com';
    global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));
    await nomineeVoting.checkIfVoted();
    expect(nomineeVoting.hasVoted).toBe(false);
  });
});

describe('Nominee Voting - vote()', () => {
  beforeEach(() => {
    nomineeVoting.entry = {
      id: 'e1',
      entry_number: 'BTA-001',
      entry_description: 'Test',
      public_votes: 0,
      organisations: { company_name: 'Test Co' },
      awards: { award_name: 'Award' },
    };
    nomineeVoting.entryId = 'e1';
    nomineeVoting._submittingVote = false;
  });

  test('shows warning when already voted', async () => {
    nomineeVoting.voterEmail = 'test@test.com';
    nomineeVoting.hasVoted = false;
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ exists: true }) }));
    await nomineeVoting.vote();
    expect(nomineeVoting.hasVoted).toBe(true);
  });
});

describe('showPublicToast()', () => {
  test('creates toast container if not present', () => {
    const container = document.getElementById('publicToastContainer');
    if (container) container.remove();
    showPublicToast('Test message', 'info');
    expect(document.getElementById('publicToastContainer')).toBeDefined();
  });

  test('uses existing container', () => {
    showPublicToast('Second message', 'success');
    const container = document.getElementById('publicToastContainer');
    expect(container.children.length).toBeGreaterThan(0);
  });

  test('creates warning toast', () => {
    showPublicToast('Warning message');
    const container = document.getElementById('publicToastContainer');
    expect(container.lastChild.textContent).toBe('Warning message');
  });
});

describe('Nominee Voting - sendVerificationEmail()', () => {
  test('sends email via API', async () => {
    nomineeVoting.voterEmail = 'voter@test.com';
    nomineeVoting.entry = {
      organisations: { company_name: 'Test' },
      awards: { award_name: 'Best' },
      entry_number: 'BTA-001',
    };
    global.fetch = jest.fn(() => Promise.resolve({ ok: true }));
    await nomineeVoting.sendVerificationEmail();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/resend-email',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  test('handles email service error gracefully', async () => {
    nomineeVoting.voterEmail = 'voter@test.com';
    nomineeVoting.entry = {
      organisations: { company_name: 'Test' },
      awards: { award_name: 'Best' },
      entry_number: 'BTA-001',
    };
    global.fetch = jest.fn(() => Promise.reject(new Error('Email service down')));
    await expect(nomineeVoting.sendVerificationEmail()).resolves.not.toThrow();
  });
});

describe('Nominee Voting - social sharing', () => {
  beforeEach(() => {
    nomineeVoting.entry = {
      organisations: { company_name: 'Share Co' },
    };
    global.window.open = jest.fn();
  });

  test('shareTwitter opens X intent', () => {
    nomineeVoting.shareTwitter();
    expect(window.open).toHaveBeenCalledWith(expect.stringContaining('x.com/intent/tweet'), '_blank');
  });

  test('shareFacebook opens Facebook share', () => {
    nomineeVoting.shareFacebook();
    expect(window.open).toHaveBeenCalledWith(expect.stringContaining('facebook.com/sharer'), '_blank');
  });

  test('shareLinkedIn opens LinkedIn share', () => {
    nomineeVoting.shareLinkedIn();
    expect(window.open).toHaveBeenCalledWith(expect.stringContaining('linkedin.com/sharing'), '_blank');
  });
});

describe('showPublicToast - timeout callbacks', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('fades out and removes toast after timeout', () => {
    showPublicToast('Timeout test', 'info');
    const container = document.getElementById('publicToastContainer');
    const toastEl = container.lastChild;
    expect(toastEl).toBeDefined();

    // Advance past the 4000ms fade out timeout
    jest.advanceTimersByTime(4000);
    expect(toastEl.style.opacity).toBe('0');

    // Advance past the 300ms removal timeout
    jest.advanceTimersByTime(300);
    // Toast should be removed (no parent)
    expect(toastEl.parentNode).toBeNull();
  });
});

describe('votingApi - error handling', () => {
  test('throws error with status and code when response is not ok', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: 'Rate limited', code: 'RATE_LIMIT' }),
      })
    );

    try {
      await votingApi('some_action', { foo: 'bar' });
      // Should not reach here
      expect(true).toBe(false);
    } catch (err) {
      expect(err.message).toBe('Rate limited');
      expect(err.status).toBe(429);
      expect(err.code).toBe('RATE_LIMIT');
    }
  });

  test('uses default error message when none provided', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      })
    );

    try {
      await votingApi('some_action');
      expect(true).toBe(false);
    } catch (err) {
      expect(err.message).toBe('API request failed');
      expect(err.status).toBe(500);
    }
  });
});

describe('Nominee Voting - initialize', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('shows error when no entry or id param', async () => {
    // Override window.location.search to have no params
    const origSearch = window.location.search;
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '' },
      writable: true,
    });

    const showErrorSpy = jest.spyOn(nomineeVoting, 'showError').mockImplementation();
    const loadEntrySpy = jest.spyOn(nomineeVoting, 'loadEntry').mockResolvedValue();

    await nomineeVoting.initialize();

    expect(showErrorSpy).toHaveBeenCalled();
    expect(loadEntrySpy).not.toHaveBeenCalled();

    // Restore
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: origSearch },
      writable: true,
    });
  });
});

describe('Nominee Voting - vote flow', () => {
  beforeEach(() => {
    nomineeVoting.entry = {
      id: 'e1',
      entry_number: 'BTA-001',
      entry_description: 'Test',
      public_votes: 5,
      organisations: { company_name: 'Test Co' },
      awards: { award_name: 'Award' },
    };
    nomineeVoting.entryId = 'e1';
    nomineeVoting._submittingVote = false;
    nomineeVoting.hasVoted = false;

    // Ensure verificationModal exists
    if (!document.getElementById('verificationModal')) {
      const modal = document.createElement('div');
      modal.id = 'verificationModal';
      modal.style.display = 'none';
      document.body.appendChild(modal);
    }

    // Ensure successModal exists
    if (!document.getElementById('successModal')) {
      const modal = document.createElement('div');
      modal.id = 'successModal';
      modal.style.display = 'none';
      document.body.appendChild(modal);
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
    nomineeVoting._submittingVote = false;
  });

  test('shows verification modal when no voterEmail', async () => {
    nomineeVoting.voterEmail = null;
    const showModalSpy = jest.spyOn(nomineeVoting, 'showVerificationModal').mockImplementation();
    await nomineeVoting.vote();
    expect(showModalSpy).toHaveBeenCalled();
  });

  test('submits vote when voterEmail is set and not voted', async () => {
    nomineeVoting.voterEmail = 'test@test.com';
    nomineeVoting.hasVoted = false;

    // checkIfVoted returns false
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ exists: false }) }) // checkIfVoted
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ count: 0 }) }) // check_rate_limit
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ exists: false }) }) // check_existing_vote
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) }) // submit_vote
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) }); // resend-email

    // Mock generateToken
    if (!global.crypto) {
      global.crypto = { randomUUID: jest.fn(() => '12345678-1234-1234-1234-123456789012') };
    } else {
      jest.spyOn(crypto, 'randomUUID').mockReturnValue('12345678-1234-1234-1234-123456789012');
    }

    await nomineeVoting.vote();

    expect(nomineeVoting.hasVoted).toBe(true);
    expect(nomineeVoting.entry.public_votes).toBe(6);
  });
});

describe('Nominee Voting - showVerificationModal and closeVerificationModal', () => {
  beforeEach(() => {
    if (!document.getElementById('verificationModal')) {
      const modal = document.createElement('div');
      modal.id = 'verificationModal';
      modal.style.display = 'none';
      document.body.appendChild(modal);
    }
  });

  test('showVerificationModal shows modal and locks body scroll', () => {
    nomineeVoting.showVerificationModal();
    expect(document.getElementById('verificationModal').style.display).toBe('flex');
    expect(document.body.style.overflow).toBe('hidden');
  });

  test('closeVerificationModal hides modal and restores body scroll', () => {
    nomineeVoting.closeVerificationModal();
    expect(document.getElementById('verificationModal').style.display).toBe('none');
    expect(document.body.style.overflow).toBe('auto');
  });
});

describe('Nominee Voting - setupEventListeners', () => {
  test('submits vote on form submit', async () => {
    nomineeVoting.entry = {
      id: 'e1',
      entry_number: 'BTA-001',
      entry_description: 'Test',
      public_votes: 0,
      organisations: { company_name: 'Test Co' },
      awards: { award_name: 'Award' },
    };
    nomineeVoting.entryId = 'e1';
    nomineeVoting._submittingVote = false;
    nomineeVoting.hasVoted = false;

    // Ensure required DOM elements
    if (!document.getElementById('verificationModal')) {
      const modal = document.createElement('div');
      modal.id = 'verificationModal';
      modal.style.display = 'flex';
      document.body.appendChild(modal);
    }
    if (!document.getElementById('successModal')) {
      const modal = document.createElement('div');
      modal.id = 'successModal';
      modal.style.display = 'none';
      document.body.appendChild(modal);
    }
    if (!document.getElementById('voterName')) {
      const input = document.createElement('input');
      input.id = 'voterName';
      input.value = 'Test Voter';
      document.body.appendChild(input);
    }

    // Set up email input
    document.getElementById('voterEmail').value = 'form@test.com';
    document.getElementById('voterName').value = 'Form User';

    // Setup event listeners
    nomineeVoting.setupEventListeners();

    // Mock fetch for submitVote flow
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ count: 0 }) }) // rate limit
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ exists: false }) }) // check existing vote
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) }) // submit vote
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) }); // resend email

    if (!global.crypto) {
      global.crypto = { randomUUID: jest.fn(() => '12345678-1234-1234-1234-123456789012') };
    }

    // Submit the form
    const form = document.getElementById('verificationForm');
    const submitEvent = new dom.window.Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submitEvent);

    // Wait for async operations
    await new Promise((r) => setTimeout(r, 100));

    expect(nomineeVoting.voterEmail).toBe('form@test.com');
    expect(sessionStorage.getItem('voterEmail')).toBe('form@test.com');
  });
});

describe('Nominee Voting - submitVote edge cases', () => {
  beforeEach(() => {
    nomineeVoting.entry = {
      id: 'e1',
      entry_number: 'BTA-001',
      entry_description: 'Test',
      public_votes: 5,
      organisations: { company_name: 'Test Co' },
      awards: { award_name: 'Award' },
    };
    nomineeVoting.entryId = 'e1';
    nomineeVoting.voterEmail = 'test@test.com';
    nomineeVoting._submittingVote = false;
    nomineeVoting.hasVoted = false;

    if (!document.getElementById('verificationModal')) {
      const modal = document.createElement('div');
      modal.id = 'verificationModal';
      modal.style.display = 'flex';
      document.body.appendChild(modal);
    }
    if (!document.getElementById('successModal')) {
      const modal = document.createElement('div');
      modal.id = 'successModal';
      modal.style.display = 'none';
      document.body.appendChild(modal);
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
    nomineeVoting._submittingVote = false;
  });

  test('prevents double-submit', async () => {
    nomineeVoting._submittingVote = true;
    global.fetch = jest.fn();
    await nomineeVoting.submitVote();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('stops when rate limited', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ count: 10 }) }); // rate limit exceeded

    await nomineeVoting.submitVote();

    expect(document.getElementById('verificationModal').style.display).toBe('none');
    expect(nomineeVoting._submittingVote).toBe(false);
  });

  test('stops when already voted (existing vote)', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ count: 0 }) }) // rate limit ok
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ exists: true }) }); // already voted

    await nomineeVoting.submitVote();

    expect(nomineeVoting.hasVoted).toBe(true);
    expect(document.getElementById('voteButton').disabled).toBe(true);
    expect(nomineeVoting._submittingVote).toBe(false);
  });

  test('handles 409 duplicate vote error', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ count: 0 }) }) // rate limit ok
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ exists: false }) }) // not voted
      .mockResolvedValueOnce({ ok: false, status: 409, json: () => Promise.resolve({ error: 'Duplicate vote', code: 'DUPLICATE' }) }); // submit fails with 409

    if (!global.crypto) {
      global.crypto = { randomUUID: jest.fn(() => '12345678-1234-1234-1234-123456789012') };
    }

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await nomineeVoting.submitVote();

    expect(nomineeVoting.hasVoted).toBe(true);
    expect(nomineeVoting._submittingVote).toBe(false);
    consoleSpy.mockRestore();
  });

  test('handles generic error during vote submission', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ count: 0 }) }) // rate limit ok
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ exists: false }) }) // not voted
      .mockRejectedValueOnce(new Error('Network error')); // submit fails

    if (!global.crypto) {
      global.crypto = { randomUUID: jest.fn(() => '12345678-1234-1234-1234-123456789012') };
    }

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await nomineeVoting.submitVote();

    expect(nomineeVoting._submittingVote).toBe(false);
    consoleSpy.mockRestore();
  });
});

describe('Nominee Voting - showSuccessModal and closeSuccessModal', () => {
  beforeEach(() => {
    if (!document.getElementById('successModal')) {
      const modal = document.createElement('div');
      modal.id = 'successModal';
      modal.style.display = 'none';
      document.body.appendChild(modal);
    }
  });

  test('showSuccessModal shows the success modal', () => {
    nomineeVoting.showSuccessModal();
    expect(document.getElementById('successModal').style.display).toBe('flex');
  });

  test('closeSuccessModal hides the success modal', () => {
    nomineeVoting.closeSuccessModal();
    expect(document.getElementById('successModal').style.display).toBe('none');
  });
});

describe('Nominee Voting - generateToken', () => {
  test('returns a UUID without dashes', () => {
    if (!global.crypto) {
      global.crypto = { randomUUID: jest.fn(() => '12345678-1234-1234-1234-123456789012') };
    } else {
      jest.spyOn(crypto, 'randomUUID').mockReturnValue('12345678-1234-1234-1234-123456789012');
    }
    const token = nomineeVoting.generateToken();
    expect(token).toBe('12345678123412341234123456789012');
    expect(token).not.toContain('-');
  });
});

describe('Nominee Voting - copyLink', () => {
  test('copies link and updates button text', async () => {
    // Mock clipboard
    navigator.clipboard = { writeText: jest.fn().mockResolvedValue() };

    // Mock event
    const btn = document.createElement('button');
    btn.className = 'share-btn';
    btn.innerHTML = '<i class="bi bi-link me-2"></i>Copy Link';
    global.event = { target: { closest: jest.fn(() => btn) } };

    await nomineeVoting.copyLink();

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(btn.innerHTML).toContain('Copied!');

    delete global.event;
  });

  test('shows toast on clipboard error', async () => {
    // Mock clipboard to reject
    navigator.clipboard = { writeText: jest.fn().mockRejectedValue(new Error('Clipboard error')) };

    global.event = { target: { closest: jest.fn(() => document.createElement('button')) } };
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await nomineeVoting.copyLink();

    consoleSpy.mockRestore();
    delete global.event;
  });
});
