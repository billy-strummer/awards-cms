/**
 * Shared Supabase client singleton.
 * Ensures at most one client per Vercel container, reducing PgBouncer connection usage.
 * All API handlers should use getSupabaseClient() instead of createClient() directly.
 */

const { createClient } = require('@supabase/supabase-js');

let _client = null;

/**
 * Returns the shared Supabase service-role client, creating it on first call.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function getSupabaseClient() {
  if (!_client) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
    }
    _client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
      global: {
        fetch: (url, options = {}) =>
          fetch(url, {
            ...options,
            signal: options.signal ?? AbortSignal.timeout(15000),
          }),
      },
    });
  }
  return _client;
}

module.exports = { getSupabaseClient };
