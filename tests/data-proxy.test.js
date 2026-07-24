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
    limit: jest.fn(),
    maybeSingle: jest.fn(),
    single: jest.fn(),
    then: (resolve) => resolve(resolveWith),
  };
  // Make all methods chainable by default
  Object.keys(obj).forEach((key) => {
    if (typeof obj[key] === 'function' && key !== 'then' && key !== 'maybeSingle' && key !== 'single') {
      obj[key] = jest.fn(() => obj);
    }
  });
  // maybeSingle/single resolve with the data directly (single resolves
  // { data: <first row or the object itself>, error } the same shape
  // callers already destructure as `{ data, error }`).
  obj.maybeSingle = jest.fn(() => Promise.resolve(resolveWith));
  obj.single = jest.fn(() => Promise.resolve(resolveWith));
  obj.then = (resolve) => resolve(resolveWith);
  return obj;
}

let currentChain;
const mockFrom = jest.fn((table) => {
  // Return admin role when querying user_roles for RBAC
  if (table === 'user_roles') {
    currentChain = chainable({ data: { role: 'admin' }, error: null, count: 1 });
  } else {
    currentChain = chainable();
  }
  return currentChain;
});

const mockGetUser = jest.fn();

jest.mock(
  '@supabase/supabase-js',
  () => ({
    createClient: jest.fn(() => ({
      from: mockFrom,
      auth: { getUser: mockGetUser },
    })),
  }),
  { virtual: true }
);

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
      ...headers,
    },
    params: {},
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

describe('Data Proxy API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: auth succeeds
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'admin@test.com' } },
      error: null,
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
    expect(res.body.details).toContain('"data" is required for insert/upsert operations');
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
      body: { table: 'awards', operation: 'select', page: 1, pageSize: 25 },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(mockFrom).toHaveBeenCalledWith('awards');
  });

  test('accepts valid count request', async () => {
    const req = createReq({
      body: { table: 'entries', operation: 'count', filters: { status: 'submitted' } },
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
        data: { award_name: 'Best Plumber', county: 'Kent', year: 2026 },
      },
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
        data: { award_name: 'Updated Name' },
      },
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
        data: { status: 'submitted' },
      },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  // --- Delete Tests ---

  test('accepts valid delete with id', async () => {
    const req = createReq({
      body: { table: 'awards', operation: 'delete', id: 'abc-123' },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  // --- Security Tests ---

  test('immutable tables reject mutations', async () => {
    const req = createReq({
      body: { table: 'counties', operation: 'insert', data: { name: 'Hack' } },
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

  // --- Edge Cases ---

  test('rejects empty body', async () => {
    const req = createReq({ body: null });
    req.body = null;
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('JSON object');
  });

  test('rejects negative page number', async () => {
    const req = createReq({
      body: { table: 'awards', operation: 'select', page: -1 },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.details[0]).toContain('page');
  });

  test('rejects zero pageSize', async () => {
    const req = createReq({
      body: { table: 'awards', operation: 'select', pageSize: 0 },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('rejects select string exceeding max length', async () => {
    const req = createReq({
      body: { table: 'awards', operation: 'select', select: 'x'.repeat(501) },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.details[0]).toContain('select');
  });

  test('rejects sort without column', async () => {
    const req = createReq({
      body: { table: 'awards', operation: 'select', sort: { ascending: true } },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.details[0]).toContain('sort');
  });

  test('rejects filters as non-object', async () => {
    const req = createReq({
      body: { table: 'awards', operation: 'select', filters: 'bad' },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.details[0]).toContain('filters');
  });

  test('all allowed tables can be selected', async () => {
    const allowed = [
      'awards',
      'organisations',
      'entries',
      'winners',
      'events',
      'invoices',
      'payments',
      'award_assignments',
      'contacts',
      'activity_log',
      'email_templates',
      'user_preferences',
      'counties',
      'regions',
      'award_years',
    ];

    for (const table of allowed) {
      const req = createReq({ body: { table, operation: 'select' } });
      const res = createRes();
      await handler(req, res);
      expect(res.statusCode).toBe(200);
    }
  });

  test('read-only tables reject insert', async () => {
    for (const table of ['counties', 'award_years']) {
      const req = createReq({
        body: { table, operation: 'insert', data: { name: 'test' } },
      });
      const res = createRes();
      await handler(req, res);
      expect(res.statusCode).toBe(400);
    }
  });

  test('read-only tables reject delete', async () => {
    for (const table of ['counties', 'award_years']) {
      const req = createReq({
        body: { table, operation: 'delete', id: 'abc' },
      });
      const res = createRes();
      await handler(req, res);
      expect(res.statusCode).toBe(400);
    }
  });

  test('multiple validation errors are returned together', async () => {
    const req = createReq({
      body: { table: 'secret', operation: 'drop', pageSize: -5 },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.details.length).toBeGreaterThan(1);
  });

  test('valid sort with ascending=false is accepted', async () => {
    const req = createReq({
      body: {
        table: 'awards',
        operation: 'select',
        sort: { column: 'created_at', ascending: false },
      },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  test('insert with array data is accepted', async () => {
    const req = createReq({
      body: {
        table: 'awards',
        operation: 'insert',
        data: [{ award_name: 'A' }, { award_name: 'B' }],
      },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  test('delete with filters (no id) is accepted', async () => {
    const req = createReq({
      body: {
        table: 'awards',
        operation: 'delete',
        filters: { status: 'draft' },
      },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  // --- award_area_import: organisation matching regression tests ---
  // These prove the fix for the ILIKE-wildcard and cross-area-collision
  // findings: organisation lookups must be escaped and scoped to the
  // resolved area, via the shared api/_lib/organisation-matching helper.
  describe('award_area_import operation', () => {
    function importReq(overrides = {}) {
      return createReq({
        body: {
          operation: 'award_area_import',
          mode: 'validate',
          areaId: 'area-1',
          rows: [{ company_name: 'Acme Ltd', category: 'Roofing Company' }],
          ...overrides,
        },
      });
    }

    test('rejects an invalid mode', async () => {
      const req = importReq({ mode: 'bogus' });
      const res = createRes();
      await handler(req, res);
      expect(res.statusCode).toBe(500);
    });

    test('rejects a missing areaId', async () => {
      const req = importReq({ areaId: undefined });
      const res = createRes();
      await handler(req, res);
      expect(res.statusCode).toBe(500);
    });

    test('rejects empty rows', async () => {
      const req = importReq({ rows: [] });
      const res = createRes();
      await handler(req, res);
      expect(res.statusCode).toBe(500);
    });

    test('rejects more than 2000 rows', async () => {
      const req = importReq({ rows: Array.from({ length: 2001 }, () => ({ company_name: 'X', category: 'Y' })) });
      const res = createRes();
      await handler(req, res);
      expect(res.statusCode).toBe(500);
    });

    test('requires editor role or above', async () => {
      mockFrom.mockImplementationOnce((table) => {
        if (table === 'user_roles') return chainable({ data: { role: 'viewer' }, error: null, count: 1 });
        return chainable();
      });
      const req = importReq();
      const res = createRes();
      await handler(req, res);
      expect(res.statusCode).toBe(403);
    });

    test('organisation lookup escapes wildcard characters and scopes by area_id', async () => {
      // The shared chainable() helper above discards eq/ilike call args (it
      // overwrites them with fresh local jest.fn()s per chain), so this test
      // uses its own minimal, call-recording mock instead -- table-aware so
      // the import runs its full validate->import path for one row and
      // reaches the organisation lookup.
      const recordedCalls = [];
      function recordingChain(resolveWith) {
        const chain = {};
        [
          'select',
          'insert',
          'update',
          'delete',
          'order',
          'range',
          'in',
          'or',
          'neq',
          'gt',
          'gte',
          'lt',
          'lte',
          'like',
        ].forEach((m) => {
          chain[m] = (...args) => {
            recordedCalls.push([m, ...args]);
            return chain;
          };
        });
        chain.eq = (...args) => {
          recordedCalls.push(['eq', ...args]);
          return chain;
        };
        chain.ilike = (...args) => {
          recordedCalls.push(['ilike', ...args]);
          return chain;
        };
        chain.limit = (...args) => {
          recordedCalls.push(['limit', ...args]);
          return chain;
        };
        chain.maybeSingle = () => Promise.resolve(resolveWith);
        chain.single = () => Promise.resolve(resolveWith);
        chain.then = (resolve) => resolve(resolveWith);
        return chain;
      }

      const originalMockFromImpl = mockFrom.getMockImplementation();
      mockFrom.mockImplementation((table) => {
        if (table === 'user_roles') return recordingChain({ data: { role: 'admin' }, error: null, count: 1 });
        if (table === 'areas') {
          return recordingChain({
            data: { id: 'area-1', display_name: 'Somerset', country: 'England', area_type: 'county' },
            error: null,
          });
        }
        if (table === 'organisations') return recordingChain({ data: [], error: null });
        if (table === 'award_years') return recordingChain({ data: { id: 'award-1' }, error: null });
        if (table === 'entries') return recordingChain({ data: [], error: null });
        return recordingChain({ data: [], error: null });
      });

      try {
        const req = importReq({
          mode: 'import',
          rows: [{ company_name: '100% Group Roofing Ltd', category: 'Roofing Company' }],
        });
        const res = createRes();
        await handler(req, res);
        expect(res.statusCode).toBe(200);

        // The organisation lookup (via findMatchingOrganisation) must have
        // escaped the wildcard before it reached ILIKE...
        const ilikeCompanyNameCalls = recordedCalls.filter(([m, col]) => m === 'ilike' && col === 'company_name');
        expect(ilikeCompanyNameCalls.length).toBeGreaterThan(0);
        ilikeCompanyNameCalls.forEach(([, , pattern]) => {
          expect(pattern).toBe('100\\% Group Roofing Ltd');
        });

        // ...and must have been scoped to the resolved area.
        const areaIdEqCalls = recordedCalls.filter(([m, col]) => m === 'eq' && col === 'area_id');
        expect(areaIdEqCalls.some(([, , val]) => val === 'area-1')).toBe(true);
      } finally {
        mockFrom.mockImplementation(originalMockFromImpl);
      }
    });
  });
});
