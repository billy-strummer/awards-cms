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
    upsert: jest.fn(() => obj),
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

  // --- Tenant isolation tests (BTA-047) ---
  // No mechanism anywhere independently verifies a user belongs to a given
  // tenant, so a client-supplied tenantId other than 'default' must be
  // rejected outright rather than honoured for scoping.

  test('rejects a select request with a non-default tenantId', async () => {
    const req = createReq({
      body: { table: 'awards', operation: 'select', tenantId: '11111111-1111-1111-1111-111111111111' },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.stringContaining('"tenantId" other than "default" is not currently supported')])
    );
  });

  test('rejects an insert request with a non-default tenantId (cross-tenant write attempt)', async () => {
    const req = createReq({
      body: {
        table: 'awards',
        operation: 'insert',
        data: { award_name: 'Best Plumber', county: 'Kent', year: 2026 },
        tenantId: '22222222-2222-2222-2222-222222222222',
      },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('accepts a request with tenantId explicitly set to "default"', async () => {
    const req = createReq({
      body: { table: 'awards', operation: 'select', tenantId: 'default' },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  test('accepts a request with no tenantId at all (unchanged behaviour)', async () => {
    const req = createReq({
      body: { table: 'awards', operation: 'select' },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  test('rejects an award_area_import request with a non-default tenantId', async () => {
    const req = createReq({
      body: {
        operation: 'award_area_import',
        mode: 'validate',
        areaId: 'area-1',
        rows: [{}],
        tenantId: '33333333-3333-3333-3333-333333333333',
      },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.stringContaining('"tenantId" other than "default" is not currently supported')])
    );
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

  // --- test_data_fixture operation: BTA-027 ---
  // Dedicated, super_admin-only, environment-guarded operation that
  // replaces test-data-manager.js's former direct browser-side writes to
  // email_lists/email_list_subscribers. Every table name, row ID, and
  // filter the real implementation uses is a fixed server-side constant —
  // the client supplies only `action`. These tests assert exact call
  // arguments (table + .in()/.delete()/.upsert()/.insert() args), not
  // merely that a mock was called.
  describe('test_data_fixture operation', () => {
    const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
    const ORIGINAL_SUPABASE_URL = process.env.SUPABASE_URL;
    const TEST_PROJECT_URL = 'https://htcsewpztvxafksdzuhp.supabase.co';
    const FIXTURE_LIST_IDS = [
      'B1000000-0000-0000-0000-000000000001',
      'B1000000-0000-0000-0000-000000000002',
      'B1000000-0000-0000-0000-000000000003',
    ];

    function fixtureReq(overrides = {}) {
      return createReq({
        body: { operation: 'test_data_fixture', action: 'generate_email_fixtures', ...overrides },
      });
    }

    function mockRole(role) {
      mockFrom.mockImplementationOnce((table) => {
        if (table === 'user_roles') return chainable({ data: { role }, error: null, count: 1 });
        return chainable();
      });
    }

    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      process.env.SUPABASE_URL = TEST_PROJECT_URL;
    });

    afterEach(() => {
      process.env.NODE_ENV = ORIGINAL_NODE_ENV;
      process.env.SUPABASE_URL = ORIGINAL_SUPABASE_URL;
    });

    // --- Authentication ---
    test('missing token -> 401', async () => {
      const req = createReq({
        body: { operation: 'test_data_fixture', action: 'generate_email_fixtures' },
        headers: { authorization: '' },
      });
      const res = createRes();
      await handler(req, res);
      expect(res.statusCode).toBe(401);
    });

    test('invalid/expired token -> 401', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('bad token') });
      const req = fixtureReq();
      const res = createRes();
      await handler(req, res);
      expect(res.statusCode).toBe(401);
    });

    // --- Role enforcement ---
    test.each(['viewer', 'judge', 'editor', 'marketing', 'admin'])(
      'role "%s" -> 403 (requires super_admin)',
      async (role) => {
        mockRole(role);
        const req = fixtureReq();
        const res = createRes();
        await handler(req, res);
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toMatch(/super_admin/);
      }
    );

    test('role lookup failure defaults to viewer -> 403', async () => {
      mockFrom.mockImplementationOnce((table) => {
        if (table === 'user_roles') throw new Error('db down');
        return chainable();
      });
      const req = fixtureReq();
      const res = createRes();
      await handler(req, res);
      expect(res.statusCode).toBe(403);
    });

    // --- Environment guard ---
    test('NODE_ENV=production -> 403 regardless of role, including super_admin', async () => {
      mockRole('super_admin');
      process.env.NODE_ENV = 'production';
      const req = fixtureReq();
      const res = createRes();
      await handler(req, res);
      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/environment/i);
    });

    test('non-production + verified test SUPABASE_URL + super_admin -> operation proceeds (200)', async () => {
      mockRole('super_admin');
      const req = fixtureReq({ action: 'clear_email_fixtures' });
      const res = createRes();
      await handler(req, res);
      expect(res.statusCode).toBe(200);
    });

    test('missing SUPABASE_URL -> 403', async () => {
      mockRole('super_admin');
      delete process.env.SUPABASE_URL;
      const req = fixtureReq();
      const res = createRes();
      await handler(req, res);
      expect(res.statusCode).toBe(403);
    });

    test('unrecognised SUPABASE_URL (a different project) -> 403', async () => {
      mockRole('super_admin');
      process.env.SUPABASE_URL = 'https://qdzyknercdqwhwijbcxf.supabase.co';
      const req = fixtureReq();
      const res = createRes();
      await handler(req, res);
      expect(res.statusCode).toBe(403);
    });

    test('contradictory configuration (non-production NODE_ENV, unrecognised URL) -> 403', async () => {
      mockRole('super_admin');
      process.env.NODE_ENV = 'development';
      process.env.SUPABASE_URL = 'https://qdzyknercdqwhwijbcxf.supabase.co';
      const req = fixtureReq();
      const res = createRes();
      await handler(req, res);
      expect(res.statusCode).toBe(403);
    });

    test('client-supplied environment fields/headers cannot override the guard', async () => {
      mockRole('super_admin');
      process.env.NODE_ENV = 'production';
      const req = createReq({
        body: {
          operation: 'test_data_fixture',
          action: 'generate_email_fixtures',
          NODE_ENV: 'development',
          nodeEnv: 'test',
          environment: 'test',
          supabaseUrl: TEST_PROJECT_URL,
        },
        headers: { 'x-environment': 'test', 'x-node-env': 'development' },
      });
      const res = createRes();
      await handler(req, res);
      // Still refused: the guard never reads body fields or headers.
      expect(res.statusCode).toBe(403);
    });

    // --- Operation / fixture-only restrictions ---
    test('unknown action -> 400, rejected before any fixture-table database call', async () => {
      mockRole('super_admin');
      const req = fixtureReq({ action: 'delete_everything' });
      const res = createRes();
      await handler(req, res);
      expect(res.statusCode).toBe(400);
      // Only the role lookup itself touches the database for an
      // unrecognised action — no email_lists/email_list_subscribers call.
      const tablesTouched = mockFrom.mock.calls.map((c) => c[0]);
      expect(tablesTouched).toEqual(['user_roles']);
    });

    test('arbitrary client-supplied table/id/filters cannot influence the operation', async () => {
      mockRole('super_admin');
      const req = fixtureReq({
        action: 'clear_email_fixtures',
        table: 'organisations',
        id: 'some-real-row-id',
        filters: { status: { eq: 'active' } },
        list_id: 'not-a-real-fixture-id',
      });
      const res = createRes();
      await handler(req, res);
      expect(res.statusCode).toBe(200);
      // The only tables ever reached were the two fixture tables — never
      // 'organisations' or any other client-named value.
      const tablesTouched = mockFrom.mock.calls.map((c) => c[0]).filter((t) => t !== 'user_roles');
      expect(tablesTouched).toEqual(['email_list_subscribers', 'email_lists']);
    });

    test('generate_email_fixtures upserts exactly the 3 fixed list IDs and inserts subscribers scoped to them', async () => {
      mockRole('super_admin');
      const req = fixtureReq({ action: 'generate_email_fixtures' });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const calls = mockFrom.mock.calls.map((c, i) => ({ table: c[0], chain: mockFrom.mock.results[i].value }));
      const subscriberCalls = calls.filter((c) => c.table === 'email_list_subscribers');
      expect(subscriberCalls.length).toBe(2); // clear, then insert

      expect(subscriberCalls[0].chain.delete).toHaveBeenCalled();
      expect(subscriberCalls[0].chain.in).toHaveBeenCalledWith('list_id', FIXTURE_LIST_IDS);

      expect(subscriberCalls[1].chain.insert).toHaveBeenCalled();
      const insertedRows = subscriberCalls[1].chain.insert.mock.calls[0][0];
      expect(insertedRows.every((r) => FIXTURE_LIST_IDS.includes(r.list_id))).toBe(true);

      const listCall = calls.find((c) => c.table === 'email_lists');
      expect(listCall.chain.upsert).toHaveBeenCalled();
      const upsertedLists = listCall.chain.upsert.mock.calls[0][0];
      expect(upsertedLists.map((l) => l.id)).toEqual(FIXTURE_LIST_IDS);
    });

    test('clear_email_fixtures deletes subscribers then lists, scoped to exactly the 3 fixed IDs, touching no other table', async () => {
      mockRole('super_admin');
      const req = fixtureReq({ action: 'clear_email_fixtures' });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const calls = mockFrom.mock.calls.map((c, i) => ({ table: c[0], chain: mockFrom.mock.results[i].value }));
      const nonRoleCalls = calls.filter((c) => c.table !== 'user_roles');
      expect(nonRoleCalls.map((c) => c.table)).toEqual(['email_list_subscribers', 'email_lists']);

      expect(nonRoleCalls[0].chain.delete).toHaveBeenCalled();
      expect(nonRoleCalls[0].chain.in).toHaveBeenCalledWith('list_id', FIXTURE_LIST_IDS);
      expect(nonRoleCalls[1].chain.delete).toHaveBeenCalled();
      expect(nonRoleCalls[1].chain.in).toHaveBeenCalledWith('id', FIXTURE_LIST_IDS);
    });

    test('partial failure is reported accurately without exposing the raw database error', async () => {
      mockRole('super_admin');
      // Fail only the first fixture-table call (the pre-clear delete of
      // subscribers); the remaining steps use the default (successful) mock.
      mockFrom.mockImplementationOnce(() =>
        chainable({ data: null, error: { message: 'permission denied for relation email_list_subscribers' } })
      );
      const req = fixtureReq({ action: 'generate_email_fixtures' });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toContain('clear fixture subscribers');
      // The raw Postgres error text must never reach the client.
      expect(JSON.stringify(res.body)).not.toMatch(/permission denied/);
    });

    test('unexpected exception falls back to the generic 500 without leaking detail', async () => {
      mockRole('super_admin');
      mockFrom.mockImplementationOnce(() => {
        throw new Error('unexpected internal failure with sensitive stack detail');
      });
      const req = fixtureReq({ action: 'generate_email_fixtures' });
      const res = createRes();
      await handler(req, res);
      expect(res.statusCode).toBe(500);
      expect(JSON.stringify(res.body)).not.toMatch(/sensitive stack detail/);
    });
  });
});
