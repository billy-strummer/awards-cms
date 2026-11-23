/**
 * Tests for api/_lib/organisation-matching.js — the single shared
 * organisation-matching helper used by executeAwardAreaImport,
 * handleSubmitEntry, and handleSubmitNomination.
 * Run with: npx jest tests/organisation-matching.test.js
 */

const { findMatchingOrganisation, escapeLikePattern } = require('../api/_lib/organisation-matching');

function mockSupabase(resolveWith) {
  const calls = [];
  const chain = {
    from: jest.fn((table) => {
      calls.push(['from', table]);
      return chain;
    }),
    select: jest.fn((cols) => {
      calls.push(['select', cols]);
      return chain;
    }),
    ilike: jest.fn((col, pattern) => {
      calls.push(['ilike', col, pattern]);
      return chain;
    }),
    eq: jest.fn((col, val) => {
      calls.push(['eq', col, val]);
      return chain;
    }),
    limit: jest.fn((n) => {
      calls.push(['limit', n]);
      return Promise.resolve(resolveWith);
    }),
  };
  return { chain, calls };
}

describe('escapeLikePattern', () => {
  test('escapes % so it is not treated as a wildcard', () => {
    expect(escapeLikePattern('100% Group Roofing Ltd')).toBe('100\\% Group Roofing Ltd');
  });

  test('escapes _ so it is not treated as a single-char wildcard', () => {
    expect(escapeLikePattern('AB_Services Ltd')).toBe('AB\\_Services Ltd');
  });

  test('escapes a literal backslash first, before % and _', () => {
    expect(escapeLikePattern('A\\B%C_D')).toBe('A\\\\B\\%C\\_D');
  });

  test('leaves ordinary text unchanged', () => {
    expect(escapeLikePattern('Ordinary Roofing Ltd')).toBe('Ordinary Roofing Ltd');
  });
});

describe('findMatchingOrganisation', () => {
  test('returns null immediately without querying when areaId is null', async () => {
    const { chain, calls } = mockSupabase({ data: [{ id: 'should-not-be-used' }], error: null });
    const result = await findMatchingOrganisation(chain, 'Acme Ltd', null);
    expect(result).toBeNull();
    expect(calls.length).toBe(0);
  });

  test('returns null immediately without querying when areaId is undefined', async () => {
    const { chain, calls } = mockSupabase({ data: [], error: null });
    const result = await findMatchingOrganisation(chain, 'Acme Ltd', undefined);
    expect(result).toBeNull();
    expect(calls.length).toBe(0);
  });

  test('returns null when companyName is empty', async () => {
    const { chain, calls } = mockSupabase({ data: [], error: null });
    const result = await findMatchingOrganisation(chain, '', 'area-1');
    expect(result).toBeNull();
    expect(calls.length).toBe(0);
  });

  test('queries organisations scoped by area_id with an escaped pattern', async () => {
    const { chain, calls } = mockSupabase({ data: [{ id: 'org-42' }], error: null });
    const result = await findMatchingOrganisation(chain, '100% Group Roofing Ltd', 'area-somerset');
    expect(result).toBe('org-42');
    expect(calls).toEqual([
      ['from', 'organisations'],
      ['select', 'id'],
      ['ilike', 'company_name', '100\\% Group Roofing Ltd'],
      ['eq', 'area_id', 'area-somerset'],
      ['limit', 1],
    ]);
  });

  test('returns null when no row matches', async () => {
    const { chain } = mockSupabase({ data: [], error: null });
    const result = await findMatchingOrganisation(chain, 'Nobody Ltd', 'area-1');
    expect(result).toBeNull();
  });

  test('throws when the underlying query errors', async () => {
    const { chain } = mockSupabase({ data: null, error: new Error('db down') });
    await expect(findMatchingOrganisation(chain, 'Acme Ltd', 'area-1')).rejects.toThrow('db down');
  });

  test('never issues an update/insert call -- lookup only', async () => {
    const { chain } = mockSupabase({ data: [{ id: 'org-1' }], error: null });
    await findMatchingOrganisation(chain, 'Acme Ltd', 'area-1');
    expect(chain.update).toBeUndefined();
    expect(chain.insert).toBeUndefined();
  });
});
