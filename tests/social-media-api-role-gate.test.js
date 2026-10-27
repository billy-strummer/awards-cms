/**
 * Regression test (BTA-039) for the role gate on the api/social-media-api.js
 * HTTP handler.
 *
 * Before this fix, 'publish' (post one scheduled item to a live platform)
 * and 'process-scheduled' (post every due scheduled item) only required an
 * authenticated user, with no role check — any authenticated viewer/judge
 * account could trigger a real external post directly via this endpoint.
 * rbac.js already scopes the 'marketing' module (which includes social
 * media scheduling) to the 'marketing' role and above, so the server-side
 * gate mirrors that existing, documented role-to-feature mapping rather
 * than inventing a new one.
 *
 * Kept separate from tests/social-media-api.test.js, which tests the
 * exported post* functions directly and does not exercise the HTTP
 * handler or mock a Supabase Auth-capable client.
 */
let mockRole = 'marketing';
const mockUser = { id: 'u1', email: 'user@example.com' };

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

const handler = require('../api/social-media-api');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('social-media-api handler - role gate', () => {
  beforeEach(() => {
    mockRole = 'marketing';
  });

  test('rejects "publish" for an authenticated viewer with 403', async () => {
    mockRole = 'viewer';
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: { action: 'publish', postId: '11111111-1111-1111-1111-111111111111' },
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('rejects "publish" for an authenticated judge with 403', async () => {
    mockRole = 'judge';
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: { action: 'publish', postId: '11111111-1111-1111-1111-111111111111' },
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('rejects "process-scheduled" (bulk posting) for a viewer with 403', async () => {
    mockRole = 'viewer';
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: { action: 'process-scheduled' },
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('does not 403 a "marketing"-role user — the gate passes', async () => {
    mockRole = 'marketing';
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: { action: 'publish', postId: '11111111-1111-1111-1111-111111111111' },
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  test('does not 403 an "admin"-role user — the gate passes', async () => {
    mockRole = 'admin';
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: { action: 'process-scheduled' },
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  test('still rejects a request with no Authorization header at all (401, unaffected by the new gate)', async () => {
    const req = { method: 'POST', headers: {}, body: { action: 'publish' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
