/**
 * Tests for api/_lib/test-data-fixtures.js (BTA-098).
 *
 * This is the server-side module that now performs every database
 * operation test-data-manager.js used to perform directly from the
 * browser. These tests exercise the real module against a mocked
 * Supabase-shaped client (no live database), asserting that:
 *   - every write/delete is scoped to the reserved test-data markers
 *     (TEST_MODE_, TEST-ENT-, TEST-INV-, TEST-PAY-, or a fixed UUID)
 *   - cleanup can never reach an arbitrary table/filter
 *   - the email-fixture steps delegate to the injected emailFixtures
 *     dependency rather than writing to email_lists/email_list_subscribers
 *     directly
 */

const { createTestDataFixtures, PREFIXES } = require('../api/_lib/test-data-fixtures');

function chainable(resolveWith = { data: [], error: null, count: 0 }) {
  const obj = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'like', 'in', 'order', 'limit'];
  methods.forEach((m) => {
    obj[m] = jest.fn(() => obj);
  });
  obj.upsert = jest.fn(() => obj);
  obj.single = jest.fn(() => Promise.resolve(resolveWith));
  obj.then = (resolve) => resolve(resolveWith);
  return obj;
}

describe('test-data-fixtures module', () => {
  let calls;
  let mockDb;
  let emailFixtures;

  function makeDb(perTable = {}) {
    return {
      from: jest.fn((table) => {
        calls.push(table);
        const resolveWith = perTable[table] || { data: [], error: null, count: 0 };
        return chainable(resolveWith);
      }),
    };
  }

  beforeEach(() => {
    calls = [];
    mockDb = makeDb();
    emailFixtures = {
      generate: jest.fn().mockResolvedValue({ success: true, errors: [] }),
      clear: jest.fn().mockResolvedValue({ success: true, errors: [] }),
    };
  });

  describe('uid()', () => {
    test('zero-pads to 12 digits and prepends the prefix', () => {
      const fixtures = createTestDataFixtures(mockDb, { emailFixtures });
      expect(fixtures.uid(PREFIXES.ORG_PREFIX, 1)).toBe('20000000-0000-0000-0000-000000000001');
      expect(fixtures.uid(PREFIXES.ORG_PREFIX, 42)).toBe('20000000-0000-0000-0000-000000000042');
    });
  });

  describe('generateTestData()', () => {
    test('returns success and never writes without a TEST_MODE_/TEST- marker or the fixed EVENT_ID', async () => {
      const fixtures = createTestDataFixtures(mockDb, { emailFixtures });
      const result = await fixtures.generateTestData();

      expect(result.success).toBe(true);

      // Every `.from(table).upsert(data)`/`.insert(data)` call's first
      // argument must carry a reserved marker somewhere in its
      // identifying fields, or use one of the fixed UUID prefixes.
      // 'counties' is deliberately excluded: seedCounties() only ever
      // inserts it when completely empty, as permanent shared reference
      // data (real UK county/region names) that removeTestData() never
      // deletes — it was never "test data" in the TEST_MODE_ sense,
      // ported unchanged from the original browser implementation.
      const upsertCalls = mockDb.from.mock.results
        .map((r, i) => ({ table: mockDb.from.mock.calls[i][0], chain: r.value }))
        .filter(
          (c) =>
            c.table !== 'counties' && (c.chain.upsert.mock.calls.length > 0 || c.chain.insert.mock.calls.length > 0)
        );

      expect(upsertCalls.length).toBeGreaterThan(10);

      const fixedPrefixes = Object.values(PREFIXES);

      function recordLooksLikeTestData(row) {
        const text = JSON.stringify(row);
        return (
          text.includes('TEST_MODE_') ||
          text.includes('TEST-ENT-') ||
          text.includes('TEST-INV-') ||
          text.includes('TEST-PAY-') ||
          text.includes(PREFIXES.EVENT_ID) ||
          Object.values(row).some((v) => typeof v === 'string' && fixedPrefixes.some((p) => v.startsWith(p)))
        );
      }

      upsertCalls.forEach((c) => {
        const writeCall = c.chain.upsert.mock.calls[0] || c.chain.insert.mock.calls[0];
        const data = writeCall[0];
        const rows = Array.isArray(data) ? data : [data];
        rows.forEach((row) => {
          expect(recordLooksLikeTestData(row)).toBe(true);
        });
      });
    });

    test('preflight failure aborts immediately and reports an error, writing nothing', async () => {
      mockDb = makeDb({ events: { data: null, error: { message: 'relation "events" does not exist' } } });
      const fixtures = createTestDataFixtures(mockDb, { emailFixtures });
      const result = await fixtures.generateTestData();

      expect(result.success).toBe(false);
      expect(result.errors[0]).toMatch(/preflight/);
      // Only the preflight SELECT itself touched the database.
      expect(calls).toEqual(['events']);
    });

    test('delegates email list fixture generation to the injected emailFixtures dependency, never writing email_lists/email_list_subscribers directly', async () => {
      const fixtures = createTestDataFixtures(mockDb, { emailFixtures });
      await fixtures.generateTestData();

      expect(emailFixtures.generate).toHaveBeenCalledTimes(1);
      expect(calls).not.toContain('email_lists');
      expect(calls).not.toContain('email_list_subscribers');
    });

    test('reports partial success with the table name included when a write fails', async () => {
      mockDb = makeDb({
        organisations: { data: null, error: { message: 'permission denied for relation organisations' } },
      });
      const fixtures = createTestDataFixtures(mockDb, { emailFixtures });
      const result = await fixtures.generateTestData();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('organisations');
    });
  });

  describe('removeTestData()', () => {
    test('scopes every delete to a TEST_MODE_/TEST- marker, the fixed EVENT_ID, or an ID looked up from one of those scoped selects', async () => {
      const fixtures = createTestDataFixtures(mockDb, { emailFixtures });
      const result = await fixtures.removeTestData();

      expect(result.success).toBe(true);
      expect(calls.length).toBeGreaterThan(10);

      // Collect every .like()/.eq() filter value actually passed to a
      // chain whose table call was a delete.
      const likeValues = [];
      mockDb.from.mock.results.forEach((r) => {
        r.value.like.mock.calls.forEach((c) => likeValues.push(c[1]));
      });
      const uniqueLikeValues = Array.from(new Set(likeValues));
      uniqueLikeValues.forEach((v) => {
        expect(v === undefined || /TEST_MODE_|TEST-ENT-|TEST-INV-|TEST-PAY-|%TEST_MODE_%/.test(v)).toBe(true);
      });

      const eqEventIdCalls = [];
      mockDb.from.mock.results.forEach((r) => {
        r.value.eq.mock.calls.forEach((c) => {
          if (c[0] === 'event_id' || c[0] === 'id') eqEventIdCalls.push(c[1]);
        });
      });
      // Every direct event_id/id .eq() filter used for cleanup must be the
      // one fixed test event ID — never an arbitrary/real event ID.
      eqEventIdCalls
        .filter((v) => typeof v === 'string' && v.length === 36 && !v.includes('-00000000000'))
        .forEach((v) => {
          expect(v).toBe(PREFIXES.EVENT_ID);
        });
    });

    test('delegates email list fixture cleanup to the injected emailFixtures dependency', async () => {
      const fixtures = createTestDataFixtures(mockDb, { emailFixtures });
      await fixtures.removeTestData();

      expect(emailFixtures.clear).toHaveBeenCalledTimes(1);
      expect(calls).not.toContain('email_lists');
      expect(calls).not.toContain('email_list_subscribers');
    });

    test('returns a safe, generic error on failure without throwing', async () => {
      mockDb.from = jest.fn(() => {
        throw new Error('internal connection string: postgres://user:pass@host/db');
      });
      const fixtures = createTestDataFixtures(mockDb, { emailFixtures });
      const result = await fixtures.removeTestData();

      expect(result.success).toBe(false);
      expect(result.error).not.toMatch(/postgres:\/\//);
    });
  });

  describe('getStatus()', () => {
    test('returns raw counts only, with no HTML or display text', async () => {
      mockDb = makeDb({
        organisations: { data: [], error: null, count: 5 },
        entries: { data: [], error: null, count: 3 },
      });
      const fixtures = createTestDataFixtures(mockDb, { emailFixtures });
      const status = await fixtures.getStatus();

      expect(status).toEqual(
        expect.objectContaining({
          organisations: 5,
          entries: 3,
        })
      );
      expect(JSON.stringify(status)).not.toMatch(/<[a-z]/i);
    });
  });

  describe('generateMockOrder() / removeMockOrders()', () => {
    // generateMockOrder() calls .from('organisations') twice in sequence —
    // first an existence-check .select().single() (no existing mock org),
    // then, since none exists, an .insert().select().single() that must
    // return the newly-created row — so 'organisations' needs a
    // call-order-aware mock, not a single fixed per-table response.
    function makeMockOrderDb() {
      let orgCallCount = 0;
      return {
        from: jest.fn((table) => {
          calls.push(table);
          if (table === 'organisations') {
            orgCallCount++;
            return chainable(
              orgCallCount === 1 ? { data: null, error: null } : { data: { id: 'org-new' }, error: null }
            );
          }
          if (table === 'invoices') return chainable({ data: { id: 'inv-1' }, error: null });
          return chainable();
        }),
      };
    }

    test('generateMockOrder creates an invoice number with the TEST-INV- marker', async () => {
      mockDb = makeMockOrderDb();
      const fixtures = createTestDataFixtures(mockDb, { emailFixtures });
      const result = await fixtures.generateMockOrder();

      expect(result.success).toBe(true);
      expect(result.invoiceNumber).toMatch(/^TEST-INV-\d+$/);
    });

    test('generateMockOrder reuses the fixed TEST_MODE_ mock company name rather than creating an arbitrarily named organisation', async () => {
      mockDb = makeMockOrderDb();
      const fixtures = createTestDataFixtures(mockDb, { emailFixtures });
      await fixtures.generateMockOrder();

      const orgInsertCall = mockDb.from.mock.results.find(
        (r, i) => mockDb.from.mock.calls[i][0] === 'organisations' && r.value.insert.mock.calls.length > 0
      );
      expect(orgInsertCall.value.insert.mock.calls[0][0].company_name).toBe('TEST_MODE_Mock Company Ltd');
    });

    test('removeMockOrders only deletes invoices matching TEST-INV- and the organisation named TEST_MODE_Mock Company Ltd', async () => {
      const fixtures = createTestDataFixtures(mockDb, { emailFixtures });
      const result = await fixtures.removeMockOrders();

      expect(result.success).toBe(true);
      const invoiceDeleteChain = mockDb.from.mock.results.find(
        (r, i) => mockDb.from.mock.calls[i][0] === 'invoices' && r.value.delete.mock.calls.length > 0
      );
      expect(
        invoiceDeleteChain.value.like.mock.calls.some((c) => c[0] === 'invoice_number' && c[1] === 'TEST-INV-%')
      ).toBe(true);

      const orgDeleteChain = mockDb.from.mock.results.find(
        (r, i) => mockDb.from.mock.calls[i][0] === 'organisations' && r.value.delete.mock.calls.length > 0
      );
      expect(
        orgDeleteChain.value.eq.mock.calls.some((c) => c[0] === 'company_name' && c[1] === 'TEST_MODE_Mock Company Ltd')
      ).toBe(true);
    });

    test('removeMockOrders returns a safe error on failure without throwing', async () => {
      mockDb.from = jest.fn(() => {
        throw new Error('internal secret detail');
      });
      const fixtures = createTestDataFixtures(mockDb, { emailFixtures });
      const result = await fixtures.removeMockOrders();
      expect(result.success).toBe(false);
    });
  });

  describe('no emailFixtures dependency injected', () => {
    test('falls back to a safe no-op rather than throwing', async () => {
      const fixtures = createTestDataFixtures(mockDb);
      const result = await fixtures.generateTestData();
      expect(result.success).toBe(true);
    });
  });
});
