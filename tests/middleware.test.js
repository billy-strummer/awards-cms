/**
 * Tests for middleware.js (the Vercel Edge Middleware "Coming Soon" gate).
 * middleware.js uses ESM export syntax required by Vercel's Edge Middleware
 * convention, which isn't handled by the shared jest-esm-transform.js (that
 * transform only strips the `export { x };` trailer pattern used by the
 * frontend browser modules). Rather than touching a transform shared by
 * every other test suite, this file loads the source directly via `vm` with
 * a local, test-only export rewrite.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadMiddleware() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'middleware.js'), 'utf8');
  const rewritten = source
    .replace('export const config', 'const config')
    .replace('export default async function middleware', 'async function middleware');

  const moduleObj = { exports: {} };
  const context = {
    module: moduleObj,
    exports: moduleObj.exports,
    require,
    process,
    crypto,
    Response,
    Request,
    URL,
    console,
    TextEncoder,
  };
  vm.createContext(context);
  vm.runInContext(`${rewritten}\nmodule.exports = { middleware, config };`, context, { filename: 'middleware.js' });
  return context.module.exports;
}

describe('middleware (Coming Soon gate)', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.SITE_ACCESS_PASSWORD;
    delete process.env.SITE_ACCESS_SECRET;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test('fails open (no gating) when env vars are unset', async () => {
    const { middleware } = loadMiddleware();
    const req = new Request('https://example.com/home.html');
    const res = await middleware(req);
    expect(res).toBeUndefined();
  });

  test('fails open when only one of the two env vars is set', async () => {
    process.env.SITE_ACCESS_PASSWORD = 'secret123';
    const { middleware } = loadMiddleware();
    const req = new Request('https://example.com/home.html');
    const res = await middleware(req);
    expect(res).toBeUndefined();
  });

  describe('with gating configured', () => {
    beforeEach(() => {
      process.env.SITE_ACCESS_PASSWORD = 'secret123';
      process.env.SITE_ACCESS_SECRET = 'test-signing-secret';
    });

    test('redirects a gated public page with no cookie to coming-soon.html', async () => {
      const { middleware } = loadMiddleware();
      const req = new Request('https://example.com/home.html');
      const res = await middleware(req);
      expect(res).toBeInstanceOf(Response);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('https://example.com/coming-soon.html');
    });

    test('does not gate the admin SPA (index.html)', async () => {
      const { middleware } = loadMiddleware();
      const req = new Request('https://example.com/index.html');
      const res = await middleware(req);
      expect(res).toBeUndefined();
    });

    test('does not gate extensionless admin SPA routes', async () => {
      const { middleware } = loadMiddleware();
      const req = new Request('https://example.com/dashboard');
      const res = await middleware(req);
      expect(res).toBeUndefined();
    });

    test('does not gate the coming-soon page itself', async () => {
      const { middleware } = loadMiddleware();
      const req = new Request('https://example.com/coming-soon.html');
      const res = await middleware(req);
      expect(res).toBeUndefined();
    });

    test.each(['/privacy-policy.html', '/terms-and-conditions.html', '/cookie-policy.html'])(
      'does not gate legal page %s',
      async (pagePath) => {
        const { middleware } = loadMiddleware();
        const req = new Request(`https://example.com${pagePath}`);
        const res = await middleware(req);
        expect(res).toBeUndefined();
      }
    );

    test('does not gate /api/* routes', async () => {
      const { middleware } = loadMiddleware();
      const req = new Request('https://example.com/api/voting-proxy', { method: 'POST' });
      const res = await middleware(req);
      expect(res).toBeUndefined();
    });

    test('correct password sets a signed cookie and redirects to home.html', async () => {
      const { middleware } = loadMiddleware();
      const body = new URLSearchParams({ password: 'secret123' });
      const req = new Request('https://example.com/__enter-site', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const res = await middleware(req);
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toBe('https://example.com/home.html');
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toMatch(/^bta_site_access=/);
      expect(setCookie).toMatch(/HttpOnly/);
      expect(setCookie).toMatch(/Secure/);
    });

    test('wrong password redirects back to coming-soon.html with an error flag', async () => {
      const { middleware } = loadMiddleware();
      const body = new URLSearchParams({ password: 'wrong-password' });
      const req = new Request('https://example.com/__enter-site', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const res = await middleware(req);
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toBe('https://example.com/coming-soon.html?error=1');
      expect(res.headers.get('set-cookie')).toBeNull();
    });

    test('a valid signed cookie lets a gated page through', async () => {
      const { middleware } = loadMiddleware();

      // Get a real token via the login flow
      const loginReq = new Request('https://example.com/__enter-site', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ password: 'secret123' }).toString(),
      });
      const loginRes = await middleware(loginReq);
      const cookie = loginRes.headers.get('set-cookie').split(';')[0]; // "bta_site_access=<token>"

      const req = new Request('https://example.com/vote.html', {
        headers: { cookie },
      });
      const res = await middleware(req);
      expect(res).toBeUndefined();
    });

    test('a tampered cookie is rejected and still redirects to coming-soon.html', async () => {
      const { middleware } = loadMiddleware();
      const req = new Request('https://example.com/vote.html', {
        headers: { cookie: 'bta_site_access=1234567890.deadbeef' },
      });
      const res = await middleware(req);
      expect(res).toBeInstanceOf(Response);
      expect(res.headers.get('location')).toBe('https://example.com/coming-soon.html');
    });
  });
});
