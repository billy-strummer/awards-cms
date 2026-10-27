/**
 * Regression test (BTA-039) for the admin-role gate on the non-cron
 * actions of the api/judge-automation.js HTTP handler.
 *
 * The handler's own long-standing comment states "Every other action
 * requires an authenticated admin user", but until now only authentication
 * (verifyAuth) was enforced, not role — any authenticated viewer/judge
 * account could call 'assign-judges', 'generate-shortlist',
 * 'generate-all-shortlists' or 'stats' directly. This test enforces what
 * the comment already promised.
 *
 * Kept separate from tests/judge-automation.test.js, which only exercises
 * the handler's cron-tick branch (bypassing verifyAuth entirely) and tests
 * the other actions' underlying *Endpoint functions directly, never the
 * full handler with a mocked user identity.
 */
let mockRole = 'admin';
const mockUser = { id: 'u1', email: 'user@example.com' };

jest.mock('resend', () => ({ Resend: jest.fn(() => ({ emails: { send: jest.fn() } })) }), { virtual: true });

jest.mock(
  '@supabase/supabase-js',
  () => ({
    createClient: jest.fn(() => ({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: null, error: null })) })),
        })),
      })),
      auth: { getUser: jest.fn(async () => ({ data: { user: mockUser }, error: null })) },
    })),
  }),
  { virtual: true }
);

jest.mock('../api/_lib/auth', () => {
  const real = jest.requireActual('../api/_lib/auth');
  return {
    ...real,
    getUserRole: jest.fn(async () => mockRole),
  };
});

process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

const handler = require('../api/judge-automation');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('judge-automation handler - admin role gate (non-cron actions)', () => {
  beforeEach(() => {
    mockRole = 'admin';
  });

  test.each(['assign-judges', 'generate-shortlist', 'generate-all-shortlists', 'stats'])(
    'rejects "%s" for an authenticated viewer with 403',
    async (action) => {
      mockRole = 'viewer';
      const req = { method: 'POST', headers: { authorization: 'Bearer token' }, query: {}, body: { action } };
      const res = mockRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    }
  );

  test('rejects "assign-judges" for an authenticated judge-role user with 403', async () => {
    mockRole = 'judge';
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      query: {},
      body: { action: 'assign-judges' },
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('does not 403 an admin-role user — the gate passes', async () => {
    mockRole = 'admin';
    const req = { method: 'POST', headers: { authorization: 'Bearer token' }, query: {}, body: { action: 'stats' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  // cron-tick's own CRON_SECRET-based authentication (bypassing verifyAuth
  // and this role gate entirely) is already thoroughly covered by
  // tests/judge-automation.test.js's "handler — cron-tick authentication"
  // suite; not duplicated here to avoid requiring the real
  // api/_lib/automation-scheduler module (and its RESEND_API_KEY env
  // dependency) in this file.
});
