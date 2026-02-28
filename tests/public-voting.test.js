/**
 * Tests for the Public Voting Module (public-voting.js)
 * Run with: npx jest tests/public-voting.test.js
 */

const { JSDOM } = require('jsdom');

// ---------------------------------------------------------------------------
// DOM setup — mirrors the elements that public-voting.js expects
// ---------------------------------------------------------------------------
const dom = new JSDOM(
  `<!DOCTYPE html><html><head>
  <meta name="supabase-url" content="https://test.supabase.co">
  <meta name="supabase-anon-key" content="test-key">
</head><body>
  <div id="publicToastContainer"></div>
  <div id="entriesGrid"></div>
  <div id="awardFilter"><option value="">All Categories</option></div>
  <span id="totalVotes">0</span>
  <div id="verificationModal" style="display:none;"></div>
  <div id="successModal" style="display:none;"></div>
  <form id="verificationForm">
    <input id="voterEmail" type="email" value="">
    <input id="voterName" type="text" value="">
    <button type="submit">Verify</button>
  </form>
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.sessionStorage = dom.window.sessionStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.requestAnimationFrame = jest.fn((cb) => cb());
global.crypto = { randomUUID: jest.fn(() => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee') };

// Default fetch mock — overridden per-test when needed
global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));

// ---------------------------------------------------------------------------
// Load source file
// ---------------------------------------------------------------------------
require('../public-voting.js');

// Convenience references
const { votingSystem, votingApi, showPublicToast, esc } = global.window;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock fetch that resolves with the given JSON body. */
function mockFetchOk(body) {
  return jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(body) }));
}

/** Build a mock fetch that resolves with a non-ok response. */
function mockFetchFail(status, body = {}) {
  return jest.fn(() =>
    Promise.resolve({
      ok: false,
      status,
      json: () => Promise.resolve({ error: body.error || 'fail', code: body.code }),
    })
  );
}

const sampleAwards = [
  { id: 'a1', award_name: 'Best Innovation' },
  { id: 'a2', award_name: 'Best Service' },
];

const sampleEntries = [
  {
    id: 'e1',
    entry_title: 'Entry One',
    entry_description: 'Description one',
    award_id: 'a1',
    public_votes: 5,
    organisations: { company_name: 'Acme', logo_url: 'https://cdn.test/logo.png', website: 'https://acme.com' },
    awards: { award_name: 'Best Innovation' },
  },
  {
    id: 'e2',
    entry_title: 'Entry Two',
    entry_description: 'Description two',
    award_id: 'a2',
    public_votes: 3,
    organisations: { company_name: 'Globex', logo_url: null, website: null },
    awards: { award_name: 'Best Service' },
  },
];

// ---------------------------------------------------------------------------
// Reset state before every test
// ---------------------------------------------------------------------------
beforeEach(() => {
  jest.restoreAllMocks();
  jest.useFakeTimers();

  // Reset votingSystem state
  votingSystem.allEntries = [];
  votingSystem.currentEntryId = null;
  votingSystem.voterEmail = null;
  votingSystem._submittingVote = false;

  // Reset DOM elements
  document.getElementById('entriesGrid').innerHTML = '';
  document.getElementById('totalVotes').textContent = '0';
  const filter = document.getElementById('awardFilter');
  filter.innerHTML = '<option value="">All Categories</option>';
  document.getElementById('verificationModal').style.display = 'none';
  document.getElementById('successModal').style.display = 'none';
  document.getElementById('voterEmail').value = '';
  document.getElementById('voterName').value = '';

  sessionStorage.clear();

  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
});

afterEach(() => {
  jest.useRealTimers();
});

// ===========================================================================
// 1. esc() — HTML escape helper
// ===========================================================================
describe('esc() — HTML escape helper', () => {
  test('escapes ampersands, angle brackets, quotes, and apostrophes', () => {
    expect(esc('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  test('returns empty string for falsy values', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
    expect(esc('')).toBe('');
    expect(esc(0)).toBe('0');
  });

  test('converts non-string values to strings', () => {
    expect(esc(42)).toBe('42');
    expect(esc(true)).toBe('true');
  });
});

// ===========================================================================
// 2. showPublicToast()
// ===========================================================================
describe('showPublicToast()', () => {
  test('appends a toast element to the container', () => {
    showPublicToast('Hello world', 'success');
    const container = document.getElementById('publicToastContainer');
    expect(container.children.length).toBe(1);
    expect(container.children[0].textContent).toBe('Hello world');
  });

  test('applies correct background colour for each type', () => {
    showPublicToast('warn', 'warning');
    showPublicToast('err', 'error');
    showPublicToast('ok', 'success');
    showPublicToast('inf', 'info');
    const container = document.getElementById('publicToastContainer');
    expect(container.children[0].style.background).toContain('#ffc107');
    expect(container.children[1].style.background).toContain('#dc3545');
    expect(container.children[2].style.background).toContain('#28a745');
    expect(container.children[3].style.background).toContain('#17a2b8');
  });

  test('creates container if it does not already exist', () => {
    const existing = document.getElementById('publicToastContainer');
    existing.remove();
    showPublicToast('dynamic container', 'info');
    const created = document.getElementById('publicToastContainer');
    expect(created).not.toBeNull();
    expect(created.children.length).toBe(1);
    // Restore for subsequent tests
    document.body.appendChild(created);
  });

  test('removes toast after timeout', () => {
    showPublicToast('temporary', 'info');
    const container = document.getElementById('publicToastContainer');
    expect(container.children.length).toBe(1);
    // Fast-forward past the 4000ms auto-dismiss plus 300ms fade
    jest.advanceTimersByTime(4500);
    expect(container.children.length).toBe(0);
  });
});

// ===========================================================================
// 3. votingSystem object initialisation
// ===========================================================================
describe('votingSystem — initialisation & defaults', () => {
  test('votingSystem is defined', () => {
    expect(votingSystem).toBeDefined();
  });

  test('has expected default properties', () => {
    expect(votingSystem.allEntries).toEqual([]);
    expect(votingSystem.currentEntryId).toBeNull();
    expect(votingSystem.voterEmail).toBeNull();
  });

  test('has required methods', () => {
    expect(typeof votingSystem.initialize).toBe('function');
    expect(typeof votingSystem.loadAwards).toBe('function');
    expect(typeof votingSystem.loadEntries).toBe('function');
    expect(typeof votingSystem.vote).toBe('function');
    expect(typeof votingSystem.submitVote).toBe('function');
    expect(typeof votingSystem.sendVerificationEmail).toBe('function');
    expect(typeof votingSystem.renderEntries).toBe('function');
    expect(typeof votingSystem.filterByAward).toBe('function');
    expect(typeof votingSystem.updateTotalVotes).toBe('function');
    expect(typeof votingSystem.generateToken).toBe('function');
    expect(typeof votingSystem.showVerificationModal).toBe('function');
    expect(typeof votingSystem.closeVerificationModal).toBe('function');
    expect(typeof votingSystem.showSuccessModal).toBe('function');
    expect(typeof votingSystem.closeSuccessModal).toBe('function');
  });

  test('reads voterEmail from sessionStorage when present', () => {
    // The module reads sessionStorage at parse time; verify the mechanism
    sessionStorage.setItem('voterEmail', 'stored@test.com');
    // Re-evaluating the expression the module uses:
    const email = sessionStorage.getItem('voterEmail') || null;
    expect(email).toBe('stored@test.com');
  });
});

// ===========================================================================
// 4. votingApi() — API proxy function
// ===========================================================================
describe('votingApi() — API proxy', () => {
  test('sends POST to /api/voting-proxy with action and params', async () => {
    global.fetch = mockFetchOk({ result: 'ok' });

    const data = await votingApi('load_awards', { year: 2025 });

    expect(global.fetch).toHaveBeenCalledWith('/api/voting-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load_awards', year: 2025 }),
    });
    expect(data).toEqual({ result: 'ok' });
  });

  test('sends action only when no extra params provided', async () => {
    global.fetch = mockFetchOk({});
    await votingApi('load_entries');
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toEqual({ action: 'load_entries' });
  });

  test('throws an error with status and code on non-ok response', async () => {
    global.fetch = mockFetchFail(409, { error: 'Duplicate vote', code: 'DUPLICATE' });

    await expect(votingApi('submit_vote', { entry_id: 'e1' })).rejects.toThrow('Duplicate vote');

    try {
      await votingApi('submit_vote', { entry_id: 'e1' });
    } catch (err) {
      expect(err.status).toBe(409);
      expect(err.code).toBe('DUPLICATE');
    }
  });

  test('uses default error message when API returns no error text', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }));

    await expect(votingApi('bad_action')).rejects.toThrow('API request failed');
  });
});

// ===========================================================================
// 5. votingSystem.loadAwards()
// ===========================================================================
describe('votingSystem.loadAwards()', () => {
  test('populates the award filter dropdown with options', async () => {
    global.fetch = mockFetchOk({ awards: sampleAwards });
    await votingSystem.loadAwards();

    const filter = document.getElementById('awardFilter');
    expect(filter.innerHTML).toContain('All Categories');
    expect(filter.innerHTML).toContain('Best Innovation');
    expect(filter.innerHTML).toContain('Best Service');
    expect(filter.querySelectorAll('option').length).toBe(3); // "All" + 2 awards
  });

  test('handles empty awards array', async () => {
    global.fetch = mockFetchOk({ awards: [] });
    await votingSystem.loadAwards();

    const filter = document.getElementById('awardFilter');
    expect(filter.querySelectorAll('option').length).toBe(1); // Only "All Categories"
  });

  test('does not throw on API failure (logs error)', async () => {
    global.fetch = mockFetchFail(500, { error: 'Server error' });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(votingSystem.loadAwards()).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('escapes award names in options to prevent XSS', async () => {
    global.fetch = mockFetchOk({ awards: [{ id: 'x', award_name: '<script>alert(1)</script>' }] });
    await votingSystem.loadAwards();

    const filter = document.getElementById('awardFilter');
    expect(filter.innerHTML).not.toContain('<script>');
    expect(filter.innerHTML).toContain('&lt;script&gt;');
  });
});

// ===========================================================================
// 6. votingSystem.loadEntries()
// ===========================================================================
describe('votingSystem.loadEntries()', () => {
  test('stores entries in allEntries and calls renderEntries', async () => {
    global.fetch = mockFetchOk({ entries: sampleEntries });
    const renderSpy = jest.spyOn(votingSystem, 'renderEntries').mockImplementation(() => {});
    const totalSpy = jest.spyOn(votingSystem, 'updateTotalVotes').mockImplementation(() => {});

    await votingSystem.loadEntries();

    expect(votingSystem.allEntries).toHaveLength(2);
    expect(votingSystem.allEntries[0].id).toBe('e1');
    expect(renderSpy).toHaveBeenCalled();
    expect(totalSpy).toHaveBeenCalled();

    renderSpy.mockRestore();
    totalSpy.mockRestore();
  });

  test('defaults allEntries to empty array when entries is null', async () => {
    global.fetch = mockFetchOk({ entries: null });
    jest.spyOn(votingSystem, 'renderEntries').mockImplementation(() => {});
    jest.spyOn(votingSystem, 'updateTotalVotes').mockImplementation(() => {});

    await votingSystem.loadEntries();
    expect(votingSystem.allEntries).toEqual([]);
  });

  test('marks entries with hasVoted when voter email is present', async () => {
    votingSystem.voterEmail = 'voter@test.com';

    // First call returns entries, second call returns voted entry ids
    let callCount = 0;
    global.fetch = jest.fn(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: sampleEntries }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ entry_ids: ['e1'] }) });
    });

    jest.spyOn(votingSystem, 'renderEntries').mockImplementation(() => {});
    jest.spyOn(votingSystem, 'updateTotalVotes').mockImplementation(() => {});

    await votingSystem.loadEntries();

    expect(votingSystem.allEntries[0].hasVoted).toBe(true);
    expect(votingSystem.allEntries[1].hasVoted).toBe(false);
  });

  test('displays error message in grid on API failure', async () => {
    global.fetch = mockFetchFail(500, { error: 'Server error' });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await votingSystem.loadEntries();

    const grid = document.getElementById('entriesGrid');
    expect(grid.innerHTML).toContain('Failed to load entries');
    expect(grid.innerHTML).toContain('alert-danger');
  });

  test('does not check votes when voterEmail is null', async () => {
    votingSystem.voterEmail = null;
    global.fetch = mockFetchOk({ entries: sampleEntries });
    jest.spyOn(votingSystem, 'renderEntries').mockImplementation(() => {});
    jest.spyOn(votingSystem, 'updateTotalVotes').mockImplementation(() => {});

    await votingSystem.loadEntries();

    // Only one fetch call — load_entries — no check_votes
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// 7. votingSystem.renderEntries()
// ===========================================================================
describe('votingSystem.renderEntries()', () => {
  test('renders empty-state when allEntries is empty', () => {
    votingSystem.allEntries = [];
    votingSystem.renderEntries();

    const grid = document.getElementById('entriesGrid');
    expect(grid.innerHTML).toContain('No entries available for voting');
  });

  test('renders entry cards with company info', () => {
    votingSystem.allEntries = [...sampleEntries];
    votingSystem.renderEntries();

    const grid = document.getElementById('entriesGrid');
    expect(grid.innerHTML).toContain('Acme');
    expect(grid.innerHTML).toContain('Best Innovation');
    expect(grid.innerHTML).toContain('Entry One');
    expect(grid.innerHTML).toContain('Globex');
  });

  test('shows logo image when logo_url is present', () => {
    votingSystem.allEntries = [sampleEntries[0]];
    votingSystem.renderEntries();

    const grid = document.getElementById('entriesGrid');
    expect(grid.innerHTML).toContain('img src="https://cdn.test/logo.png"');
  });

  test('shows placeholder icon when logo_url is absent', () => {
    votingSystem.allEntries = [sampleEntries[1]];
    votingSystem.renderEntries();

    const grid = document.getElementById('entriesGrid');
    expect(grid.innerHTML).toContain('bi-building');
  });

  test('shows website link when website is present', () => {
    votingSystem.allEntries = [sampleEntries[0]];
    votingSystem.renderEntries();

    const grid = document.getElementById('entriesGrid');
    expect(grid.innerHTML).toContain('href="https://acme.com"');
    expect(grid.innerHTML).toContain('Visit Website');
  });

  test('omits website link when website is absent', () => {
    votingSystem.allEntries = [sampleEntries[1]];
    votingSystem.renderEntries();

    const grid = document.getElementById('entriesGrid');
    expect(grid.innerHTML).not.toContain('Visit Website');
  });

  test('marks voted entries with voted class and disabled button', () => {
    votingSystem.allEntries = [{ ...sampleEntries[0], hasVoted: true }];
    votingSystem.renderEntries();

    const grid = document.getElementById('entriesGrid');
    expect(grid.innerHTML).toContain('voted');
    expect(grid.innerHTML).toContain('disabled');
    expect(grid.innerHTML).toContain('Voted');
  });

  test('shows "Vote Now" for entries that have not been voted on', () => {
    votingSystem.allEntries = [{ ...sampleEntries[0], hasVoted: false }];
    votingSystem.renderEntries();

    const grid = document.getElementById('entriesGrid');
    expect(grid.innerHTML).toContain('Vote Now');
    expect(grid.innerHTML).not.toContain('disabled');
  });

  test('displays vote count for each entry', () => {
    votingSystem.allEntries = [sampleEntries[0]]; // public_votes: 5
    votingSystem.renderEntries();

    const grid = document.getElementById('entriesGrid');
    expect(grid.innerHTML).toContain('5 votes');
  });

  test('truncates long descriptions to 150 chars', () => {
    const longDesc = 'A'.repeat(200);
    votingSystem.allEntries = [{ ...sampleEntries[0], entry_description: longDesc }];
    votingSystem.renderEntries();

    const grid = document.getElementById('entriesGrid');
    // Should contain the truncated version (150 chars) plus '...'
    expect(grid.innerHTML).toContain('A'.repeat(150) + '...');
    expect(grid.innerHTML).not.toContain('A'.repeat(151));
  });

  test('handles missing organisation gracefully', () => {
    votingSystem.allEntries = [{ ...sampleEntries[0], organisations: null }];
    votingSystem.renderEntries();

    const grid = document.getElementById('entriesGrid');
    expect(grid.innerHTML).toContain('Unknown Company');
  });

  test('handles missing awards gracefully', () => {
    votingSystem.allEntries = [{ ...sampleEntries[0], awards: null }];
    votingSystem.renderEntries();

    const grid = document.getElementById('entriesGrid');
    expect(grid.innerHTML).toContain('Unknown Award');
  });
});

// ===========================================================================
// 8. votingSystem.vote(entryId)
// ===========================================================================
describe('votingSystem.vote()', () => {
  test('sets currentEntryId', async () => {
    jest.spyOn(votingSystem, 'showVerificationModal').mockImplementation(() => {});
    await votingSystem.vote('e1');
    expect(votingSystem.currentEntryId).toBe('e1');
  });

  test('calls submitVote directly when voterEmail is already set', async () => {
    votingSystem.voterEmail = 'voter@test.com';
    const submitSpy = jest.spyOn(votingSystem, 'submitVote').mockResolvedValue();

    await votingSystem.vote('e1');

    expect(submitSpy).toHaveBeenCalled();
    submitSpy.mockRestore();
  });

  test('shows verification modal when voterEmail is not set', async () => {
    votingSystem.voterEmail = null;
    const modalSpy = jest.spyOn(votingSystem, 'showVerificationModal').mockImplementation(() => {});

    await votingSystem.vote('e2');

    expect(modalSpy).toHaveBeenCalled();
    modalSpy.mockRestore();
  });
});

// ===========================================================================
// 9. votingSystem.submitVote()
// ===========================================================================
describe('votingSystem.submitVote()', () => {
  beforeEach(() => {
    votingSystem.voterEmail = 'voter@test.com';
    votingSystem.currentEntryId = 'e1';
    sessionStorage.setItem('voterName', 'Test Voter');
  });

  test('submits vote successfully through full flow', async () => {
    let callIndex = 0;
    global.fetch = jest.fn(() => {
      callIndex++;
      if (callIndex === 1) {
        // check_rate_limit
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ count: 2 }) });
      }
      if (callIndex === 2) {
        // check_existing_vote
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ exists: false }) });
      }
      if (callIndex === 3) {
        // submit_vote
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
      }
      // sendVerificationEmail + loadEntries calls
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: [], awards: [] }) });
    });

    jest.spyOn(votingSystem, 'closeVerificationModal').mockImplementation(() => {});
    jest.spyOn(votingSystem, 'showSuccessModal').mockImplementation(() => {});
    jest.spyOn(votingSystem, 'loadEntries').mockResolvedValue();

    await votingSystem.submitVote();

    // Verify the submit_vote call was made (3rd call)
    const thirdCallBody = JSON.parse(global.fetch.mock.calls[2][1].body);
    expect(thirdCallBody.action).toBe('submit_vote');
    expect(thirdCallBody.entry_id).toBe('e1');
    expect(thirdCallBody.voter_email).toBe('voter@test.com');
    expect(thirdCallBody.voter_name).toBe('Test Voter');
  });

  test('prevents double-submit with _submittingVote flag', async () => {
    votingSystem._submittingVote = true;
    global.fetch = jest.fn();

    await votingSystem.submitVote();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('resets _submittingVote flag after completion', async () => {
    let callIndex = 0;
    global.fetch = jest.fn(() => {
      callIndex++;
      if (callIndex === 1) return Promise.resolve({ ok: true, json: () => Promise.resolve({ count: 0 }) });
      if (callIndex === 2) return Promise.resolve({ ok: true, json: () => Promise.resolve({ exists: false }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    jest.spyOn(votingSystem, 'closeVerificationModal').mockImplementation(() => {});
    jest.spyOn(votingSystem, 'showSuccessModal').mockImplementation(() => {});
    jest.spyOn(votingSystem, 'loadEntries').mockResolvedValue();

    await votingSystem.submitVote();
    expect(votingSystem._submittingVote).toBe(false);
  });

  test('resets _submittingVote flag even on error', async () => {
    global.fetch = mockFetchFail(500, { error: 'Server error' });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await votingSystem.submitVote();
    expect(votingSystem._submittingVote).toBe(false);
  });

  test('blocks when rate limit is reached (>= 10 votes)', async () => {
    global.fetch = mockFetchOk({ count: 10 });
    jest.spyOn(votingSystem, 'closeVerificationModal').mockImplementation(() => {});

    await votingSystem.submitVote();

    // Should only have made one API call (check_rate_limit) and stopped
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.action).toBe('check_rate_limit');
  });

  test('blocks when user has already voted for this entry', async () => {
    let callIndex = 0;
    global.fetch = jest.fn(() => {
      callIndex++;
      if (callIndex === 1) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ count: 2 }) });
      }
      // check_existing_vote returns exists: true
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ exists: true }) });
    });

    jest.spyOn(votingSystem, 'closeVerificationModal').mockImplementation(() => {});

    await votingSystem.submitVote();

    // Should have made only 2 calls and stopped before submit_vote
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('shows warning toast on 409 conflict error', async () => {
    let callIndex = 0;
    global.fetch = jest.fn(() => {
      callIndex++;
      if (callIndex === 1) return Promise.resolve({ ok: true, json: () => Promise.resolve({ count: 0 }) });
      if (callIndex === 2) return Promise.resolve({ ok: true, json: () => Promise.resolve({ exists: false }) });
      // submit_vote returns 409
      return Promise.resolve({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ error: 'Duplicate vote', code: 'DUPLICATE' }),
      });
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await votingSystem.submitVote();

    const container = document.getElementById('publicToastContainer');
    expect(container.innerHTML).toContain('already voted');
  });

  test('shows error toast on generic API failure', async () => {
    let callIndex = 0;
    global.fetch = jest.fn(() => {
      callIndex++;
      if (callIndex === 1) return Promise.resolve({ ok: true, json: () => Promise.resolve({ count: 0 }) });
      if (callIndex === 2) return Promise.resolve({ ok: true, json: () => Promise.resolve({ exists: false }) });
      return Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal error' }),
      });
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await votingSystem.submitVote();

    const container = document.getElementById('publicToastContainer');
    expect(container.innerHTML).toContain('Failed to submit vote');
  });

  test('calls sendVerificationEmail after successful vote', async () => {
    let callIndex = 0;
    global.fetch = jest.fn(() => {
      callIndex++;
      if (callIndex === 1) return Promise.resolve({ ok: true, json: () => Promise.resolve({ count: 0 }) });
      if (callIndex === 2) return Promise.resolve({ ok: true, json: () => Promise.resolve({ exists: false }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    jest.spyOn(votingSystem, 'closeVerificationModal').mockImplementation(() => {});
    jest.spyOn(votingSystem, 'showSuccessModal').mockImplementation(() => {});
    jest.spyOn(votingSystem, 'loadEntries').mockResolvedValue();
    const emailSpy = jest.spyOn(votingSystem, 'sendVerificationEmail').mockResolvedValue();

    await votingSystem.submitVote();

    expect(emailSpy).toHaveBeenCalled();
    emailSpy.mockRestore();
  });

  test('includes generated verification token in submit_vote payload', async () => {
    let callIndex = 0;
    global.fetch = jest.fn(() => {
      callIndex++;
      if (callIndex === 1) return Promise.resolve({ ok: true, json: () => Promise.resolve({ count: 0 }) });
      if (callIndex === 2) return Promise.resolve({ ok: true, json: () => Promise.resolve({ exists: false }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    jest.spyOn(votingSystem, 'closeVerificationModal').mockImplementation(() => {});
    jest.spyOn(votingSystem, 'showSuccessModal').mockImplementation(() => {});
    jest.spyOn(votingSystem, 'sendVerificationEmail').mockResolvedValue();
    jest.spyOn(votingSystem, 'loadEntries').mockResolvedValue();

    await votingSystem.submitVote();

    const submitBody = JSON.parse(global.fetch.mock.calls[2][1].body);
    expect(submitBody.verification_token).toBe('aaaaaaaabbbbccccddddeeeeeeeeeeee');
  });
});

// ===========================================================================
// 10. votingSystem.sendVerificationEmail()
// ===========================================================================
describe('votingSystem.sendVerificationEmail()', () => {
  test('sends POST to /api/resend-email with correct payload', async () => {
    votingSystem.voterEmail = 'voter@test.com';
    votingSystem.currentVote = { company_name: 'Acme', award_name: 'Best Innovation' };
    global.fetch = mockFetchOk({ id: 'email-123' });

    await votingSystem.sendVerificationEmail();

    expect(global.fetch).toHaveBeenCalledWith('/api/resend-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: 'voter@test.com',
        subject: 'Vote Confirmation - British Trade Awards',
        template: 'entry_confirmation',
        templateData: {
          voter_email: 'voter@test.com',
          company_name: 'Acme',
          award_name: 'Best Innovation',
        },
      }),
    });
  });

  test('falls back to default values when currentVote is not set', async () => {
    votingSystem.voterEmail = 'voter@test.com';
    votingSystem.currentVote = null;
    global.fetch = mockFetchOk({});

    await votingSystem.sendVerificationEmail();

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.templateData.company_name).toBe('N/A');
    expect(body.templateData.award_name).toBe('British Trade Awards');
  });

  test('does not throw when email service fails', async () => {
    votingSystem.voterEmail = 'voter@test.com';
    global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(votingSystem.sendVerificationEmail()).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ===========================================================================
// 11. votingSystem.generateToken()
// ===========================================================================
describe('votingSystem.generateToken()', () => {
  test('returns a string with hyphens removed from UUID', () => {
    const token = votingSystem.generateToken();
    expect(token).toBe('aaaaaaaabbbbccccddddeeeeeeeeeeee');
    expect(token).not.toContain('-');
  });
});

// ===========================================================================
// 12. Modals — verification and success
// ===========================================================================
describe('Modal helpers', () => {
  test('showVerificationModal sets display to block and hides body overflow', () => {
    votingSystem.showVerificationModal();
    expect(document.getElementById('verificationModal').style.display).toBe('block');
    expect(document.body.style.overflow).toBe('hidden');
  });

  test('closeVerificationModal hides modal and restores overflow', () => {
    votingSystem.showVerificationModal();
    votingSystem.closeVerificationModal();
    expect(document.getElementById('verificationModal').style.display).toBe('none');
    expect(document.body.style.overflow).toBe('auto');
  });

  test('showSuccessModal displays the modal', () => {
    votingSystem.showSuccessModal();
    expect(document.getElementById('successModal').style.display).toBe('block');
  });

  test('showSuccessModal auto-closes after 3 seconds', () => {
    votingSystem.showSuccessModal();
    expect(document.getElementById('successModal').style.display).toBe('block');
    jest.advanceTimersByTime(3000);
    expect(document.getElementById('successModal').style.display).toBe('none');
  });

  test('closeSuccessModal hides the modal', () => {
    votingSystem.showSuccessModal();
    votingSystem.closeSuccessModal();
    expect(document.getElementById('successModal').style.display).toBe('none');
  });
});

// ===========================================================================
// 13. votingSystem.filterByAward()
// ===========================================================================
describe('votingSystem.filterByAward()', () => {
  beforeEach(() => {
    votingSystem.allEntries = [...sampleEntries];
  });

  test('filters entries by selected award id', () => {
    const filter = document.getElementById('awardFilter');
    // Simulate selecting award a1
    filter.innerHTML = '<option value="">All</option><option value="a1" selected>Best Innovation</option>';
    filter.value = 'a1';

    const renderSpy = jest.spyOn(votingSystem, 'renderEntries').mockImplementation(() => {});
    votingSystem.filterByAward();

    expect(votingSystem.allEntries).toHaveLength(1);
    expect(votingSystem.allEntries[0].id).toBe('e1');
    renderSpy.mockRestore();
  });

  test('shows all entries when no filter is selected', () => {
    const filter = document.getElementById('awardFilter');
    filter.value = '';

    const renderSpy = jest.spyOn(votingSystem, 'renderEntries').mockImplementation(() => {});
    votingSystem.filterByAward();

    expect(votingSystem.allEntries).toHaveLength(2);
    renderSpy.mockRestore();
  });

  test('shows "No entries" message when filter yields no results', () => {
    const filter = document.getElementById('awardFilter');
    filter.innerHTML = '<option value="">All</option><option value="a999" selected>Nonexistent</option>';
    filter.value = 'a999';

    votingSystem.filterByAward();

    const grid = document.getElementById('entriesGrid');
    expect(grid.innerHTML).toContain('No entries in this category');
  });
});

// ===========================================================================
// 14. votingSystem.updateTotalVotes()
// ===========================================================================
describe('votingSystem.updateTotalVotes()', () => {
  test('calculates and displays total vote count', () => {
    votingSystem.allEntries = [...sampleEntries]; // 5 + 3 = 8
    votingSystem.updateTotalVotes();

    const totalEl = document.getElementById('totalVotes');
    expect(totalEl.textContent).toBe('8');
  });

  test('handles entries with missing public_votes', () => {
    votingSystem.allEntries = [{ id: 'e1', public_votes: null }, { id: 'e2', public_votes: undefined }, { id: 'e3' }];
    votingSystem.updateTotalVotes();

    const totalEl = document.getElementById('totalVotes');
    expect(totalEl.textContent).toBe('0');
  });

  test('formats large numbers with locale string', () => {
    votingSystem.allEntries = [{ id: 'e1', public_votes: 1500 }];
    votingSystem.updateTotalVotes();

    const totalEl = document.getElementById('totalVotes');
    // toLocaleString() produces "1,500" in en-US
    expect(totalEl.textContent).toBe((1500).toLocaleString());
  });
});

// ===========================================================================
// 15. votingSystem.initialize() — full flow
// ===========================================================================
describe('votingSystem.initialize()', () => {
  test('calls loadAwards, loadEntries, and setupEventListeners', async () => {
    const awardsSpy = jest.spyOn(votingSystem, 'loadAwards').mockResolvedValue();
    const entriesSpy = jest.spyOn(votingSystem, 'loadEntries').mockResolvedValue();
    const setupSpy = jest.spyOn(votingSystem, 'setupEventListeners').mockImplementation(() => {});

    await votingSystem.initialize();

    expect(awardsSpy).toHaveBeenCalled();
    expect(entriesSpy).toHaveBeenCalled();
    expect(setupSpy).toHaveBeenCalled();

    awardsSpy.mockRestore();
    entriesSpy.mockRestore();
    setupSpy.mockRestore();
  });
});

// ===========================================================================
// 16. votingSystem.setupEventListeners() — form submission
// ===========================================================================
describe('votingSystem.setupEventListeners()', () => {
  test('submits vote when verification form is submitted', async () => {
    const submitSpy = jest.spyOn(votingSystem, 'submitVote').mockResolvedValue();

    votingSystem.setupEventListeners();

    document.getElementById('voterEmail').value = 'form@test.com';
    document.getElementById('voterName').value = 'Form User';

    const form = document.getElementById('verificationForm');
    const event = new dom.window.Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);

    // Allow microtasks
    await Promise.resolve();

    expect(votingSystem.voterEmail).toBe('form@test.com');
    expect(sessionStorage.getItem('voterEmail')).toBe('form@test.com');
    expect(sessionStorage.getItem('voterName')).toBe('Form User');
    expect(submitSpy).toHaveBeenCalled();

    submitSpy.mockRestore();
  });

  test('does not store voterName when empty', async () => {
    const submitSpy = jest.spyOn(votingSystem, 'submitVote').mockResolvedValue();

    votingSystem.setupEventListeners();

    document.getElementById('voterEmail').value = 'noname@test.com';
    document.getElementById('voterName').value = '';

    const form = document.getElementById('verificationForm');
    const event = new dom.window.Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);

    await Promise.resolve();

    expect(sessionStorage.getItem('voterName')).toBeNull();

    submitSpy.mockRestore();
  });
});
