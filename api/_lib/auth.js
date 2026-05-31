/**
 * Shared authentication utilities for API handlers.
 * Extracted from data-proxy.js, certificates-qr.js, stripe-payment.js et al.
 * to avoid copy-paste divergence across the 6+ files that used identical code.
 */

const { createClient } = require('@supabase/supabase-js');

const ROLE_HIERARCHY = ['viewer', 'judge', 'marketing', 'finance', 'editor', 'admin', 'super_admin'];

/**
 * Check if a role meets the minimum required role level.
 * @param {string} userRole - The user's current role.
 * @param {string} requiredRole - The minimum role required.
 * @returns {boolean}
 */
function hasMinimumRole(userRole, requiredRole) {
  const userLevel = ROLE_HIERARCHY.indexOf((userRole || '').toLowerCase());
  const requiredLevel = ROLE_HIERARCHY.indexOf(requiredRole);
  if (userLevel === -1 || requiredLevel === -1) return false;
  return userLevel >= requiredLevel;
}

/**
 * Fetch a user's role from the user_roles table.
 * Accepts an optional pre-created service Supabase client; creates one from env vars if omitted.
 * @param {string} userEmail - The user's email address.
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabaseClient] - Optional service-role client.
 * @returns {Promise<string>} The user's role string (defaults to 'viewer').
 */
async function getUserRole(userEmail, supabaseClient) {
  const client = supabaseClient || createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  try {
    const { data } = await client.from('user_roles').select('role').eq('email', userEmail).limit(1).maybeSingle();
    return (data?.role || 'viewer').toLowerCase();
  } catch (_err) {
    return 'viewer';
  }
}

/**
 * Verify the caller's Supabase JWT.
 * Returns the authenticated user or sends 401 and returns null.
 * @param {Object} req - Express/Vercel request object.
 * @param {Object} res - Express/Vercel response object.
 * @returns {Promise<Object|null>} The authenticated user object, or null if authentication fails.
 */
async function verifyAuth(req, res) {
  const authHeader = req.headers?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  const token = authHeader.replace('Bearer ', '');
  const supabaseAuth = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY
  );
  try {
    const {
      data: { user },
      error,
    } = await supabaseAuth.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return null;
    }
    return user;
  } catch (_err) {
    res.status(401).json({ error: 'Token verification failed' });
    return null;
  }
}

module.exports = { ROLE_HIERARCHY, hasMinimumRole, getUserRole, verifyAuth };
