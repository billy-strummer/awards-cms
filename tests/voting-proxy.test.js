/**
 * Tests for the voting-proxy API endpoint
 * Run with: npx jest tests/voting-proxy.test.js
 */

// Mock @supabase/supabase-js before requiring the handler
const _mockSelect = jest.fn();
const _mockInsert = jest.fn();
const _mockEq = jest.fn();
const _mockGte = jest.fn();
const _mockNeq = jest.fn();
const _mockIn = jest.fn();
const _mockOrder = jest.fn();
const _mockLimit = jest.fn();
const _mockSingle = jest.fn();

function chainable(resolveWith = { data: [], error: null, count: 0 }) {
  const obj = {
    select: jest.fn(() => obj),
    insert: jest.fn(() => obj),
    eq: jest.fn(() => obj),
    neq: jest.fn(() => obj),
    gte: jest.fn(() => obj),
    in: jest.fn(() => obj),
    order: jest.fn(() => obj),
    limit: jest.fn(() => obj),
    single: jest.fn(() => Promise.resolve(resolveWith)),
    maybeSingle: jest.fn(() => Promise.resolve(resolveWith)),
    then: (resolve) => resolve(resolveWith),
  };
  return obj;
}

let currentChain;
const mockFrom = jest.fn(() => {
  currentChain = chainable();
  return currentChain;
});

jest.mock(
  '@supabase/supabase-js',
  () => ({
    createClient: jest.fn(() => ({
      from: mockFrom,
    })),
  }),
  { virtual: true }
);

// Set env vars
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

const handler = require('../api/voting-proxy');

// ==========================================
// HELPERS
// ==========================================

const VALID_UUID = '12345678-1234-1234-1234-123456789abc';

function createReq({ method = 'POST', body = {}, headers = {} } = {}) {
  return {
    method,
    body,
    headers: {
      origin: 'http://localhost',
      ...headers,
    },
  };
}

function createRes() {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
    end() {
      return res;
    },
    setHeader(key, value) {
      res.headers[key] = value;
    },
  };
  return res;
}

// ==========================================
// TESTS
// ==========================================

describe('Voting Proxy API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- CORS & Method Tests ---

  test('handles OPTIONS preflight with 204', async () => {
    const req = createReq({ method: 'OPTIONS' });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(204);
  });

  test('sets CORS headers', async () => {
    const req = createReq({ body: { action: 'load_awards' } });
    const res = createRes();
    await handler(req, res);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(res.headers['Access-Control-Allow-Methods']).toContain('POST');
  });

  test('rejects non-POST methods', async () => {
    const req = createReq({ method: 'GET' });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res.body.error).toContain('Method not allowed');
  });

  test('rejects PUT method', async () => {
    const req = createReq({ method: 'PUT' });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  // --- Action Dispatch Tests ---

  test('rejects unknown action', async () => {
    const req = createReq({ body: { action: 'hack_database' } });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Unknown action');
  });

  test('rejects missing action', async () => {
    const req = createReq({ body: {} });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Unknown action');
  });

  test('rejects null body', async () => {
    const req = createReq({ body: null });
    req.body = null;
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  // --- load_awards ---

  test('load_awards returns awards from supabase', async () => {
    const mockAwards = [{ id: '1', award_name: 'Best Plumber' }];
    mockFrom.mockReturnValueOnce(chainable({ data: mockAwards, error: null }));

    const req = createReq({ body: { action: 'load_awards' } });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.awards).toEqual(mockAwards);
    expect(mockFrom).toHaveBeenCalledWith('awards');
  });

  test('load_awards returns 500 on database error', async () => {
    const chain = chainable({ data: null, error: null });
    chain.then = () => {
      throw new Error('DB error');
    };
    mockFrom.mockReturnValueOnce(chain);

    const req = createReq({ body: { action: 'load_awards' } });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toContain('Internal server error');
  });

  // --- load_entries ---

  test('load_entries returns entries', async () => {
    const mockEntries = [{ id: '1', entry_title: 'Test' }];
    mockFrom.mockReturnValueOnce(chainable({ data: mockEntries, error: null }));

    const req = createReq({ body: { action: 'load_entries' } });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.entries).toEqual(mockEntries);
    expect(mockFrom).toHaveBeenCalledWith('entries');
  });

  test('load_entries returns empty array when data is null', async () => {
    mockFrom.mockReturnValueOnce(chainable({ data: null, error: null }));

    const req = createReq({ body: { action: 'load_entries' } });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.entries).toEqual([]);
  });

  // --- check_votes ---

  test('check_votes returns entry_ids for valid email', async () => {
    const mockVotes = [{ entry_id: 'e1' }, { entry_id: 'e2' }];
    mockFrom.mockReturnValueOnce(chainable({ data: mockVotes, error: null }));

    const req = createReq({ body: { action: 'check_votes', voter_email: 'user@test.com' } });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.entry_ids).toEqual(['e1', 'e2']);
  });

  test('check_votes rejects invalid email', async () => {
    const req = createReq({ body: { action: 'check_votes', voter_email: 'not-an-email' } });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Invalid email');
  });

  test('check_votes rejects missing email', async () => {
    const req = createReq({ body: { action: 'check_votes' } });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  // --- check_rate_limit ---

  test('check_rate_limit returns count and limit', async () => {
    mockFrom.mockReturnValueOnce(chainable({ data: null, error: null, count: 3 }));

    const req = createReq({ body: { action: 'check_rate_limit', voter_email: 'user@test.com' } });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('count');
    expect(res.body).toHaveProperty('limit', 10);
  });

  test('check_rate_limit rejects invalid email', async () => {
    const req = createReq({ body: { action: 'check_rate_limit', voter_email: '' } });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Invalid email');
  });

  // --- check_existing_vote ---

  test('check_existing_vote returns exists: true when vote found', async () => {
    mockFrom.mockReturnValueOnce(chainable({ data: { id: 'vote-1' }, error: null }));

    const req = createReq({
      body: { action: 'check_existing_vote', entry_id: VALID_UUID, voter_email: 'user@test.com' },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.exists).toBe(true);
  });

  test('check_existing_vote returns exists: false when no vote', async () => {
    mockFrom.mockReturnValueOnce(chainable({ data: null, error: { code: 'PGRST116' } }));

    const req = createReq({
      body: { action: 'check_existing_vote', entry_id: VALID_UUID, voter_email: 'user@test.com' },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.exists).toBe(false);
  });

  test('check_existing_vote rejects invalid entry_id', async () => {
    const req = createReq({
      body: { action: 'check_existing_vote', entry_id: 'bad-id', voter_email: 'user@test.com' },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Invalid entry_id');
  });

  test('check_existing_vote rejects invalid email', async () => {
    const req = createReq({
      body: { action: 'check_existing_vote', entry_id: VALID_UUID, voter_email: 'bad' },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Invalid email');
  });

  // --- submit_vote ---

  test('submit_vote succeeds with valid params', async () => {
    // Rate limit check
    mockFrom.mockReturnValueOnce(chainable({ data: null, error: null, count: 0 }));
    // Duplicate check (no existing vote)
    mockFrom.mockReturnValueOnce(chainable({ data: null, error: { code: 'PGRST116' } }));
    // Insert vote
    mockFrom.mockReturnValueOnce(chainable({ data: null, error: null }));

    const req = createReq({
      body: {
        action: 'submit_vote',
        entry_id: VALID_UUID,
        voter_email: 'user@test.com',
        voter_name: 'Test User',
        voter_ip: '1.2.3.4',
        verification_token: 'tok-123',
      },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('submit_vote rejects invalid entry_id', async () => {
    const req = createReq({
      body: {
        action: 'submit_vote',
        entry_id: 'bad',
        voter_email: 'user@test.com',
        verification_token: 'tok',
      },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Invalid entry_id');
  });

  test('submit_vote rejects invalid email', async () => {
    const req = createReq({
      body: {
        action: 'submit_vote',
        entry_id: VALID_UUID,
        voter_email: 'no',
        verification_token: 'tok',
      },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Invalid email');
  });

  test('submit_vote rejects missing verification_token', async () => {
    const req = createReq({
      body: {
        action: 'submit_vote',
        entry_id: VALID_UUID,
        voter_email: 'user@test.com',
      },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('verification_token');
  });

  test('submit_vote rejects empty verification_token string', async () => {
    const req = createReq({
      body: {
        action: 'submit_vote',
        entry_id: VALID_UUID,
        voter_email: 'user@test.com',
        verification_token: '',
      },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('verification_token');
  });

  test('submit_vote returns 429 when rate limited', async () => {
    // Rate limit check returns count >= 10
    mockFrom.mockReturnValueOnce(chainable({ data: null, error: null, count: 10 }));

    const req = createReq({
      body: {
        action: 'submit_vote',
        entry_id: VALID_UUID,
        voter_email: 'user@test.com',
        verification_token: 'tok',
      },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
    expect(res.body.error).toContain('Rate limit');
  });

  test('submit_vote returns 409 when duplicate vote exists', async () => {
    // Rate limit check OK
    mockFrom.mockReturnValueOnce(chainable({ data: null, error: null, count: 0 }));
    // Duplicate check returns existing vote
    mockFrom.mockReturnValueOnce(chainable({ data: { id: 'existing-vote' }, error: null }));

    const req = createReq({
      body: {
        action: 'submit_vote',
        entry_id: VALID_UUID,
        voter_email: 'user@test.com',
        verification_token: 'tok',
      },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toContain('already voted');
  });

  test('submit_vote handles unique constraint violation as 409', async () => {
    // Rate limit check OK
    mockFrom.mockReturnValueOnce(chainable({ data: null, error: null, count: 0 }));
    // Duplicate check returns no rows
    mockFrom.mockReturnValueOnce(chainable({ data: null, error: { code: 'PGRST116' } }));
    // Insert returns unique constraint error
    mockFrom.mockReturnValueOnce(chainable({ data: null, error: { code: '23505', message: 'unique violation' } }));

    const req = createReq({
      body: {
        action: 'submit_vote',
        entry_id: VALID_UUID,
        voter_email: 'user@test.com',
        verification_token: 'tok',
      },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toContain('already voted');
  });

  // --- load_entry ---

  test('load_entry by entry_number succeeds', async () => {
    const mockEntry = { id: '1', entry_title: 'Test Entry' };
    mockFrom.mockReturnValueOnce(chainable({ data: mockEntry, error: null }));

    const req = createReq({
      body: { action: 'load_entry', entry_number: 'BTA-2025-0001' },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.entry).toEqual(mockEntry);
  });

  test('load_entry by entry_id succeeds', async () => {
    const mockEntry = { id: VALID_UUID, entry_title: 'Test' };
    mockFrom.mockReturnValueOnce(chainable({ data: mockEntry, error: null }));

    const req = createReq({
      body: { action: 'load_entry', entry_id: VALID_UUID },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.entry).toEqual(mockEntry);
  });

  test('load_entry returns 404 when not found', async () => {
    mockFrom.mockReturnValueOnce(chainable({ data: null, error: { code: 'PGRST116' } }));

    const req = createReq({
      body: { action: 'load_entry', entry_id: VALID_UUID },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toContain('Entry not found');
  });

  test('load_entry rejects invalid entry_number', async () => {
    const req = createReq({
      body: { action: 'load_entry', entry_number: 'DROP TABLE entries;' },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Invalid entry_number');
  });

  test('load_entry rejects invalid entry_id', async () => {
    const req = createReq({
      body: { action: 'load_entry', entry_id: 'not-a-uuid' },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Invalid entry_id');
  });

  test('load_entry rejects request with neither entry_number nor entry_id', async () => {
    const req = createReq({
      body: { action: 'load_entry' },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Must provide');
  });

  test('submit_vote returns 500 on non-duplicate insert error', async () => {
    // Rate limit check OK
    mockFrom.mockReturnValueOnce(chainable({ data: null, error: null, count: 0 }));
    // Duplicate check returns no rows
    mockFrom.mockReturnValueOnce(chainable({ data: null, error: { code: 'PGRST116' } }));
    // Insert returns a non-unique constraint error
    mockFrom.mockReturnValueOnce(chainable({ data: null, error: { code: '42P01', message: 'relation does not exist' } }));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const req = createReq({
      body: {
        action: 'submit_vote',
        entry_id: VALID_UUID,
        voter_email: 'user@test.com',
        verification_token: 'tok',
      },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Internal server error');
    consoleSpy.mockRestore();
  });

  test('load_entry returns 500 on non-PGRST116 db error', async () => {
    mockFrom.mockReturnValueOnce(chainable({ data: null, error: { code: '42P01', message: 'relation missing' } }));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const req = createReq({
      body: { action: 'load_entry', entry_id: VALID_UUID },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Internal server error');
    consoleSpy.mockRestore();
  });

  // --- String body parsing ---

  test('handles JSON string body', async () => {
    const mockAwards = [{ id: '1', award_name: 'Test' }];
    mockFrom.mockReturnValueOnce(chainable({ data: mockAwards, error: null }));

    const req = createReq({ body: JSON.stringify({ action: 'load_awards' }) });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.awards).toEqual(mockAwards);
  });
});
