/**
 * Edge Middleware — gates the public-facing marketing site behind a shared
 * password while the site is in pre-launch "Coming Soon" mode.
 *
 * Scope: only gates explicit public .html pages (home.html, vote.html, etc).
 * The admin CMS (index.html and all extensionless SPA routes), /api/*, and
 * the legal pages (privacy/terms/cookie policy) are never gated.
 *
 * Fails open: if SITE_ACCESS_PASSWORD / SITE_ACCESS_SECRET aren't set in
 * Vercel, no gating happens at all — the site behaves exactly as before.
 */

export const config = {
  matcher: ['/((?!api/).*)'],
};

const COOKIE_NAME = 'bta_site_access';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const ENTER_PATH = '/__enter-site';

const EXEMPT_HTML_FILES = new Set([
  '/index.html',
  '/coming-soon.html',
  '/privacy-policy.html',
  '/terms-and-conditions.html',
  '/cookie-policy.html',
]);

function needsGating(pathname) {
  if (!pathname.endsWith('.html')) return false;
  return !EXEMPT_HTML_FILES.has(pathname);
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function makeToken(secret) {
  const issuedAt = Date.now().toString();
  const signature = await sign(issuedAt, secret);
  return `${issuedAt}.${signature}`;
}

async function isValidToken(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [issuedAt, signature] = token.split('.');
  if (!issuedAt || !signature) return false;
  const expected = await sign(issuedAt, secret);
  return expected === signature;
}

export default async function middleware(request) {
  const password = process.env.SITE_ACCESS_PASSWORD;
  const secret = process.env.SITE_ACCESS_SECRET;

  // Not configured yet — don't gate anything.
  if (!password || !secret) return;

  const url = new URL(request.url);

  // Handle the gate page's password submission
  if (request.method === 'POST' && url.pathname === ENTER_PATH) {
    const form = await request.formData();
    const submitted = form.get('password');

    if (submitted === password) {
      const token = await makeToken(secret);
      // Response.redirect() returns a Response with immutable headers, so the
      // Set-Cookie header has to be supplied up front via a plain Response
      // rather than appended afterwards.
      return new Response(null, {
        status: 303,
        headers: {
          Location: new URL('/home.html', request.url).toString(),
          'Set-Cookie': `${COOKIE_NAME}=${token}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
        },
      });
    }

    return Response.redirect(new URL('/coming-soon.html?error=1', request.url), 303);
  }

  if (!needsGating(url.pathname)) return;

  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const token = match ? match[1] : null;

  if (token && (await isValidToken(token, secret))) return;

  return Response.redirect(new URL('/coming-soon.html', request.url), 307);
}
