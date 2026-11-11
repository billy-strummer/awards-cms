/**
 * Regression tests (BTA-060) for api/data-proxy.js's user-management
 * operation group (user_list, user_invite, user_set_role, user_set_status,
 * user_reset_password).
 *
 * Found during the BTA-055-059 admin-CMS workflow review: this is the only
 * path to create/manage CMS users, already correctly gated to super_admin
 * in the handler, but had zero test coverage of any kind. Kept in its own
 * isolated file (rather than added to tests/data-proxy.test.js) so its
 * mocked Supabase client can provide auth.admin methods and
 * auth.resetPasswordForEmail without disturbing that file's existing,
 * carefully-scoped mock setup - the same pattern already used for
 * tests/resend-email-campaign-auth.test.js, tests/social-media-api-role-gate.test.js, etc.
 */

function chainable(resolveWith = { data: null, error: null }) {
  const obj = {
    select: jest.fn(() => obj),
    insert: jest.fn(() => obj),
    upsert: jest.fn(() => Promise.resolve(resolveWith)),
    update: jest.fn(() => obj),
    eq: jest.fn(() => obj),
    limit: jest.fn(() => obj),
    single: jest.fn(() => Promise.resolve(resolveWith)),
    maybeSingle: jest.fn(() => Promise.resolve(resolveWith)),
    then: (resolve) => resolve(resolveWith),
  };
  return obj;
}

const mockListUsers = jest.fn();
const mockInviteUserByEmail = jest.fn();
const mockGetUserById = jest.fn();
const mockUpdateUserById = jest.fn();
const mockResetPasswordForEmail = jest.fn();
const mockFrom = jest.fn(() => chainable({ data: null, error: null }));

jest.mock(
  '@supabase/supabase-js',
  () => ({
    createClient: jest.fn(() => ({
      from: mockFrom,
      auth: {
        getUser: jest.fn(),
        admin: {
          listUsers: mockListUsers,
          inviteUserByEmail: mockInviteUserByEmail,
          getUserById: mockGetUserById,
          updateUserById: mockUpdateUserById,
        },
        resetPasswordForEmail: mockResetPasswordForEmail,
      },
    })),
  }),
  { virtual: true }
);

let mockRole = 'super_admin';
const mockUser = { id: 'u1', email: 'admin@example.com' };

jest.mock('../api/_lib/auth', () => {
  const real = jest.requireActual('../api/_lib/auth');
  return {
    ...real,
    verifyAuth: jest.fn(async () => mockUser),
    getUserRole: jest.fn(async () => mockRole),
  };
});

process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';

const handler = require('../api/data-proxy');

function createReq(body) {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer token', origin: 'http://localhost' },
    body,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.setHeader = jest.fn();
  res.end = jest.fn(() => res);
  return res;
}

describe('data-proxy user-management operations (BTA-060)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRole = 'super_admin';
    mockFrom.mockImplementation(() => chainable({ data: null, error: null }));
  });

  describe('role gate', () => {
    test.each(['user_list', 'user_invite', 'user_set_role', 'user_set_status', 'user_reset_password'])(
      'rejects %s for an authenticated admin (below super_admin) with 403',
      async (operation) => {
        mockRole = 'admin';
        const res = mockRes();
        await handler(createReq({ operation, email: 'x@example.com', role: 'viewer' }), res);
        expect(res.status).toHaveBeenCalledWith(403);
      }
    );

    test('does not 403 a super_admin on user_list', async () => {
      mockListUsers.mockResolvedValue({ data: { users: [] }, error: null });
      const res = mockRes();
      await handler(createReq({ operation: 'user_list' }), res);
      expect(res.status).not.toHaveBeenCalledWith(403);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('user_invite', () => {
    test('invites a new user and assigns the requested role', async () => {
      mockInviteUserByEmail.mockResolvedValue({ data: { user: { id: 'new-user-1' } }, error: null });
      const res = mockRes();
      await handler(createReq({ operation: 'user_invite', email: 'new@example.com', role: 'editor' }), res);
      expect(mockInviteUserByEmail).toHaveBeenCalledWith('new@example.com');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ invited: true, userId: 'new-user-1' });
    });

    test('rejects an invalid role with a 500 (sanitised) error, not the raw invalid-role message', async () => {
      const res = mockRes();
      await handler(createReq({ operation: 'user_invite', email: 'new@example.com', role: 'overlord' }), res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
      expect(mockInviteUserByEmail).not.toHaveBeenCalled();
    });
  });

  describe('user_set_role', () => {
    test('updates an existing user to a new role', async () => {
      const res = mockRes();
      await handler(createReq({ operation: 'user_set_role', email: 'someone@example.com', role: 'editor' }), res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ updated: true });
    });

    test('blocks a super_admin from demoting their own account', async () => {
      const res = mockRes();
      await handler(createReq({ operation: 'user_set_role', email: mockUser.email, role: 'editor' }), res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    test('allows a super_admin to re-affirm their own super_admin role', async () => {
      const res = mockRes();
      await handler(createReq({ operation: 'user_set_role', email: mockUser.email, role: 'super_admin' }), res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('user_set_status', () => {
    test('disables another user', async () => {
      mockGetUserById.mockResolvedValue({ data: { user: { email: 'other@example.com' } }, error: null });
      mockUpdateUserById.mockResolvedValue({ data: {}, error: null });
      const res = mockRes();
      await handler(createReq({ operation: 'user_set_status', userId: 'other-id', disable: true }), res);
      expect(mockUpdateUserById).toHaveBeenCalledWith('other-id', { ban_duration: '876000h' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ updated: true, disabled: true });
    });

    test('reactivates another user', async () => {
      mockGetUserById.mockResolvedValue({ data: { user: { email: 'other@example.com' } }, error: null });
      mockUpdateUserById.mockResolvedValue({ data: {}, error: null });
      const res = mockRes();
      await handler(createReq({ operation: 'user_set_status', userId: 'other-id', disable: false }), res);
      expect(mockUpdateUserById).toHaveBeenCalledWith('other-id', { ban_duration: 'none' });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('blocks a super_admin from disabling their own account', async () => {
      mockGetUserById.mockResolvedValue({ data: { user: { email: mockUser.email } }, error: null });
      const res = mockRes();
      await handler(createReq({ operation: 'user_set_status', userId: 'u1', disable: true }), res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(mockUpdateUserById).not.toHaveBeenCalled();
    });
  });

  describe('user_reset_password', () => {
    test('sends a password reset email', async () => {
      mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
      const res = mockRes();
      await handler(createReq({ operation: 'user_reset_password', email: 'someone@example.com' }), res);
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('someone@example.com');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ sent: true });
    });

    test('rejects an invalid email with a sanitised 500', async () => {
      const res = mockRes();
      await handler(createReq({ operation: 'user_reset_password', email: 'not-an-email' }), res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
    });
  });
});
