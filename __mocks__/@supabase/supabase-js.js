/**
 * Manual mock for @supabase/supabase-js
 * Used by API endpoint tests when the real package isn't installed
 * (Supabase is loaded via CDN in the browser, only used as require() in Vercel functions)
 */

const mockSingle = jest.fn(() => Promise.resolve({ data: null, error: null }));
const mockOrder = jest.fn(() => Promise.resolve({ data: [], error: null }));
const mockLimit = jest.fn(() => ({ single: mockSingle }));
const mockRange = jest.fn(() => ({ data: [], error: null }));
const mockEq = jest.fn(() => ({
  single: mockSingle,
  order: mockOrder,
  limit: mockLimit,
  range: mockRange,
  eq: mockEq,
}));
const mockNeq = jest.fn(() => ({ eq: mockEq, order: mockOrder }));
const mockGte = jest.fn(() => ({ eq: mockEq, order: mockOrder }));
const mockIn = jest.fn(() => ({ eq: mockEq }));
const mockSelect = jest.fn(() => ({
  eq: mockEq,
  neq: mockNeq,
  gte: mockGte,
  in: mockIn,
  order: mockOrder,
  range: mockRange,
  limit: mockLimit,
  single: mockSingle,
}));
const mockInsert = jest.fn(() => Promise.resolve({ data: [{}], error: null }));
const mockUpdate = jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ data: [{}], error: null })) }));
const mockDelete = jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ data: null, error: null })) }));
const mockUpsert = jest.fn(() => Promise.resolve({ data: [{}], error: null }));
const mockRpc = jest.fn(() => Promise.resolve({ data: null, error: null }));

const mockFrom = jest.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  upsert: mockUpsert,
  eq: mockEq,
}));

const mockCreateSignedUploadUrl = jest.fn(() =>
  Promise.resolve({ data: { signedUrl: 'https://mock.url', token: 'mock-token' }, error: null })
);
const mockGetPublicUrl = jest.fn(() => ({ data: { publicUrl: 'https://mock-public.url' } }));
const mockUpload = jest.fn(() => Promise.resolve({ data: { path: 'mock/path' }, error: null }));

const mockStorageFrom = jest.fn(() => ({
  createSignedUploadUrl: mockCreateSignedUploadUrl,
  getPublicUrl: mockGetPublicUrl,
  upload: mockUpload,
}));

const mockAuth = {
  getUser: jest.fn(() =>
    Promise.resolve({ data: { user: { id: 'mock-user-id', email: 'test@example.com' } }, error: null })
  ),
  getSession: jest.fn(() => Promise.resolve({ data: { session: { access_token: 'mock-token' } }, error: null })),
  admin: {
    listUsers: jest.fn(() => Promise.resolve({ data: { users: [] }, error: null })),
  },
};

const createClient = jest.fn(() => ({
  from: mockFrom,
  storage: { from: mockStorageFrom },
  auth: mockAuth,
  rpc: mockRpc,
}));

module.exports = {
  createClient,
  // Expose mocks for test configuration
  __mocks__: {
    mockFrom,
    mockSelect,
    mockInsert,
    mockUpdate,
    mockDelete,
    mockUpsert,
    mockEq,
    mockSingle,
    mockOrder,
    mockRange,
    mockLimit,
    mockRpc,
    mockStorageFrom,
    mockCreateSignedUploadUrl,
    mockGetPublicUrl,
    mockUpload,
    mockAuth,
  },
};
