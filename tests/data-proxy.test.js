/**
 * Tests for the data-proxy API endpoint
 * Run with: npx jest tests/data-proxy.test.js
 */

// Mock @supabase/supabase-js before requiring the handler
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockNeq = jest.fn();
const mockGt = jest.fn();
const mockGte = jest.fn();
const mockLt = jest.fn();
const mockLte = jest.fn();
const mockLike = jest.fn();
const mockIlike = jest.fn();
const mockIn = jest.fn();
const mockOr = jest.fn();
const mockOrder = jest.fn();
const mockRange = jest.fn();

// Build chainable mock
function chainable(resolveWith = { data: [], error: null, count: 0 }) {
  const obj = {
    select: mockSelect.mockReturnThis(),
    insert: mockInsert.mockReturnThis(),
    update: mockUpdate.mockReturnThis(),
    delete: mockDelete.mockReturnThis(),
    eq: mockEq.mockReturnThis(),
    neq: mockNeq.mockReturnThis(),
    gt: mockGt.mockReturnThis(),
    gte: mockGte.mockReturnThis(),
    lt: mockLt.mockReturnThis(),
    lte: mockLte.mockReturnThis(),
    like: mockLike.mockReturnThis(),
    ilike: mockIlike.mockReturnThis(),
    in: mockIn.mockReturnThis(),
    or: mockOr.mockReturnThis(),
    order: mockOrder.mockReturnThis(),
    range: mockRange.mockReturnThis(),
    then: (resolve) => resolve(resolveWith)
  };
  // Make all methods chainable by default
  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === 'function' && key !== 'then') {
      obj[key] = jest.fn(() => obj);
    }
  });
  obj.then = (resolve) => resolve(resolveWith);
  return obj;
}

let currentChain;
const mockFrom = jest.fn((table) => {
  currentChain = chainable();
  return currentChain;
});

const mockGetUser = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockFrom,
    auth: { getUser: mockGetUser }
  }))
}), { virtual: true });

// Set required env vars
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';

const handler = require('../api/data-proxy');

// ==========================================
// HELPERS
// ==========================================

function createReq({ method = 'POST', body = {}, headers = {} } = {}) {
  return {
    method,
    body,
    headers: {
      authorization: 'Bearer valid-token',
      origin: 'http://localhost',
      ...headers
    },
    params: {}
  };
}

function createRes() {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; },
    end() { return res; },
    setHeader(key, value) { res.headers[key] = value; }
  };
  return res;
}

// ==========================================
// TESTS
// ==========================================

describe('Data Proxy API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: auth succeeds
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'admin@test.com' } },
      error: null
    });
  });

  // --- Auth Tests ---

  test('rejects requests without auth header', async () => {
    const req = createReq({ headers: { authorization: undefined } });
    delete req.headers.authorization;
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('Authentication required');
  });

  test('rejects invalid tokens', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });
    const req = createReq();
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  // --- Method Tests ---

  test('rejects non-POST methods', async () => {
    const req = createReq({ method: 'GET' });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  test('handles OPTIONS for CORS preflight', async () => {
    const req = createReq({ method: 'OPTIONS' });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  // --- Validation Tests ---

  test('rejects missing table', async () => {
    const req = createReq({ body: { operation: 'select' } });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.details).toContain('Missing or invalid "table" parameter');
  });

  test('rejects disallowed table', async () => {
    const req = createReq({ body: { table: 'users_private', operation: 'select' } });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.details[0]).toContain('not allowed');
  });

  test('rejects invalid operation', async () => {
    const req = createReq({ body: { table: 'awards', operation: 'drop' } });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('rejects insert without data', async () => {
    const req = createReq({ body: { table: 'awards', operation: 'insert' } });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.details).toContain('"data" is required for insert operations');
  });

  test('rejects delete without id or filters', async () => {
    const req = createReq({ body: { table: 'awards', operation: 'delete' } });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('rejects update without id or filters', async () => {
    const req = createReq({ body: { table: 'awards', operation: 'update', data: { name: 'x' } } });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('rejects oversized pageSize', async () => {
    const req = createReq({ body: { table: 'awards', operation: 'select', pageSize: 99999 } });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.details[0]).toContain('pageSize');
  });

  // --- Select Tests ---

  test('accepts valid select request', async () => {
    const req = createReq({
      body: { table: 'awards', operation: 'select', page: 1, pageSize: 25 }
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(mockFrom).toHaveBeenCalledWith('awards');
  });

  test('accepts valid count request', async () => {
    const req = createReq({
      body: { table: 'entries', operation: 'count', filters: { status: 'submitted' } }
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  // --- Insert Tests ---

  test('accepts valid insert request', async () => {
    const req = createReq({
      body: {
        table: 'awards',
        operation: 'insert',
        data: { award_name: 'Best Plumber', county: 'Kent', year: 2026 }
      }
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(mockFrom).toHaveBeenCalledWith('awards');
  });

  // --- Update Tests ---

  test('accepts valid update with id', async () => {
    const req = createReq({
      body: {
        table: 'awards',
        operation: 'update',
        id: 'abc-123',
        data: { award_name: 'Updated Name' }
      }
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  test('accepts valid update with filters', async () => {
    const req = createReq({
      body: {
        table: 'entries',
        operation: 'update',
        filters: { status: 'draft' },
        data: { status: 'submitted' }
      }
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  // --- Delete Tests ---

  test('accepts valid delete with id', async () => {
    const req = createReq({
      body: { table: 'awards', operation: 'delete', id: 'abc-123' }
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  // --- Security Tests ---

  test('immutable tables reject mutations', async () => {
    const req = createReq({
      body: { table: 'counties', operation: 'insert', data: { name: 'Hack' } }
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.details[0]).toContain('does not allow insert');
  });

  test('sets CORS headers', async () => {
    const req = createReq({ body: { table: 'awards', operation: 'select' } });
    const res = createRes();
    await handler(req, res);
    expect(res.headers['Access-Control-Allow-Origin']).toBeDefined();
    expect(res.headers['Access-Control-Allow-Methods']).toContain('POST');
  });
});
