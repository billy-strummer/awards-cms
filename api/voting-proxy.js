/**
 * Public Voting Proxy API
 *
 * Lightweight server-side proxy for public voting operations.
 * This endpoint does NOT require authentication — it is designed
 * for the public voting pages (public-voting.html, nominee-voting.html).
 *
 * All database access goes through SUPABASE_SERVICE_KEY so the
 * anon key is never exposed to the browser for voting operations.
 *
 * Environment Variables Required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_KEY
 *
 * Deploy as: Vercel serverless function at /api/voting-proxy
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// 60-second in-memory cache for the public entry list (survives container reuse)
const _entriesCache = { data: null, ts: 0 };
const ENTRIES_CACHE_TTL_MS = 60000;

/** Rate-limit: max votes per email per hour */
const RATE_LIMIT_MAX = 10;
/** Rate-limit: max votes per IP per hour (more lenient — IPs can be shared) */
const RATE_LIMIT_IP_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hour

// ────────────────────────────────────────────
// CORS helpers
// ────────────────────────────────────────────

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ────────────────────────────────────────────
// Input validation helpers
// ────────────────────────────────────────────

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUUID(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function isValidEntryNumber(num) {
  // Entry numbers are typically short alphanumeric strings
  return typeof num === 'string' && /^[A-Za-z0-9_-]{1,50}$/.test(num);
}

// ────────────────────────────────────────────
// Action handlers
// ────────────────────────────────────────────

/**
 * load_awards — return active awards (id, award_name) ordered by name
 */
async function loadAwards() {
  const { data, error } = await supabase
    .from('awards')
    .select('id, award_name')
    .eq('is_active', true)
    .order('award_name');

  if (error) throw error;
  return { awards: data };
}

/**
 * load_entries — return public entries with org & award data, max 500.
 * Accepts optional filter params: sector, category (award_category), city (county_city), country (selected_country).
 * Unfiltered results are cached for 60 seconds; filtered requests always hit the database.
 */
async function loadEntries(params, res) {
  const { sector, category, city, country } = params || {};
  const hasFilters = !!(sector || category || city || country);

  // Only use in-memory cache for the full unfiltered list
  const useCache = process.env.NODE_ENV !== 'test' && !hasFilters;
  if (useCache && _entriesCache.data && Date.now() - _entriesCache.ts < ENTRIES_CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
    return { entries: _entriesCache.data };
  }

  let query = supabase
    .from('entries')
    .select(
      `
      id, entry_number, entry_title, entry_description, public_votes, status,
      sector, award_category, county_city, selected_country,
      organisations(company_name, logo_url, website),
      awards:award_years(award_name, award_category)
    `
    )
    .eq('is_public', true)
    .eq('allow_public_voting', true)
    .in('status', ['shortlisted', 'submitted'])
    .neq('is_deleted', true)
    .order('public_votes', { ascending: false })
    .limit(500);

  // Apply optional filters (truncated to prevent abnormally long values)
  if (sector) query = query.eq('sector', String(sector).substring(0, 100));
  if (category) query = query.eq('award_category', String(category).substring(0, 100));
  if (city) query = query.eq('county_city', String(city).substring(0, 100));
  if (country) query = query.eq('selected_country', String(country).substring(0, 50));

  const { data, error } = await query;

  if (error) throw error;
  if (useCache) {
    _entriesCache.data = data || [];
    _entriesCache.ts = Date.now();
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
  }
  return { entries: data || [] };
}

/**
 * check_votes — given voter_email, return entry_ids the user has voted for
 */
async function checkVotes({ voter_email }) {
  if (!isValidEmail(voter_email)) {
    return { error: 'Invalid email address', status: 400 };
  }

  const { data, error } = await supabase.from('public_votes').select('entry_id').eq('voter_email', voter_email);

  if (error) throw error;
  return { entry_ids: (data || []).map((v) => v.entry_id) };
}

/**
 * check_rate_limit — return count of votes in the last hour for an email/IP.
 * voter_ip is injected server-side in the main handler; any client-supplied
 * value is overwritten so the IP cannot be spoofed.
 */
async function checkRateLimit({ voter_email, voter_ip }) {
  if (!isValidEmail(voter_email)) {
    return { error: 'Invalid email address', status: 400 };
  }

  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

  const { count, error } = await supabase
    .from('public_votes')
    .select('id', { count: 'exact', head: true })
    .eq('voter_email', voter_email)
    .gte('voted_at', oneHourAgo);

  if (error) throw error;
  return { count: count || 0, limit: RATE_LIMIT_MAX, voter_ip };
}

/**
 * check_existing_vote — check if a specific entry+email vote already exists
 */
async function checkExistingVote({ entry_id, voter_email }) {
  if (!isValidUUID(entry_id)) {
    return { error: 'Invalid entry_id', status: 400 };
  }
  if (!isValidEmail(voter_email)) {
    return { error: 'Invalid email address', status: 400 };
  }

  const { data, error } = await supabase
    .from('public_votes')
    .select('id')
    .eq('entry_id', entry_id)
    .eq('voter_email', voter_email)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  return { exists: !!data };
}

/**
 * submit_vote — insert a vote record after server-side rate-limit check
 */
async function submitVote({ entry_id, voter_email, voter_name, voter_ip, verification_token }) {
  if (!isValidUUID(entry_id)) {
    return { error: 'Invalid entry_id', status: 400 };
  }
  if (!isValidEmail(voter_email)) {
    return { error: 'Invalid email address', status: 400 };
  }
  if (typeof voter_name !== 'string') voter_name = '';
  if (typeof voter_ip !== 'string') voter_ip = 'unknown';
  if (typeof verification_token !== 'string' || verification_token.length === 0) {
    return { error: 'Missing verification_token', status: 400 };
  }

  // Server-side rate limit enforcement
  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count, error: rlError } = await supabase
    .from('public_votes')
    .select('id', { count: 'exact', head: true })
    .eq('voter_email', voter_email)
    .gte('voted_at', oneHourAgo);

  if (rlError) throw rlError;
  if ((count || 0) >= RATE_LIMIT_MAX) {
    return { error: 'Rate limit exceeded. Please try again later.', status: 429 };
  }

  // IP-based rate limit (parallel check — more lenient since IPs can be shared)
  // Use the rightmost IP in x-forwarded-for (added by Vercel's CDN — cannot be spoofed by the client)
  const normalizedIp = (voter_ip || 'unknown').split(',').pop().trim();
  if (normalizedIp && normalizedIp !== 'unknown') {
    const { count: ipCount, error: ipRlError } = await supabase
      .from('public_votes')
      .select('id', { count: 'exact', head: true })
      .eq('voter_ip', normalizedIp)
      .gte('voted_at', oneHourAgo);

    if (ipRlError) {
      console.warn('[voting-proxy] IP rate-limit check failed (non-fatal):', ipRlError.message);
    } else if ((ipCount || 0) >= RATE_LIMIT_IP_MAX) {
      return { error: 'Too many votes from this network. Please try again later.', status: 429 };
    }
  }

  // Check for duplicate vote
  const { data: existing, error: dupError } = await supabase
    .from('public_votes')
    .select('id')
    .eq('entry_id', entry_id)
    .eq('voter_email', voter_email)
    .single();

  if (dupError && dupError.code !== 'PGRST116') throw dupError;
  if (existing) {
    return { error: 'You have already voted for this entry.', status: 409 };
  }

  // Insert the vote
  const { error: insertError } = await supabase.from('public_votes').insert([
    {
      entry_id,
      voter_email,
      voter_name,
      voter_ip,
      vote_value: 1,
      email_verified: false,
      verification_token,
      verification_sent_at: new Date().toISOString(),
    },
  ]);

  if (insertError) {
    // Handle unique constraint violation gracefully
    if (insertError.code === '23505') {
      return { error: 'You have already voted for this entry.', status: 409 };
    }
    throw insertError;
  }

  return { success: true };
}

/**
 * load_entry — load a single entry by entry_number or entry_id
 */
async function loadEntry({ entry_number, entry_id }) {
  let query = supabase
    .from('entries')
    .select(
      `
      *,
      organisations(company_name, logo_url, website),
      awards:award_years(award_name, award_category)
    `
    )
    .eq('is_public', true)
    .eq('allow_public_voting', true)
    .in('status', ['shortlisted', 'submitted']);

  if (entry_number) {
    if (!isValidEntryNumber(entry_number)) {
      return { error: 'Invalid entry_number', status: 400 };
    }
    query = query.eq('entry_number', entry_number);
  } else if (entry_id) {
    if (!isValidUUID(entry_id)) {
      return { error: 'Invalid entry_id', status: 400 };
    }
    query = query.eq('id', entry_id);
  } else {
    return { error: 'Must provide entry_number or entry_id', status: 400 };
  }

  const { data, error } = await query.single();

  if (error) {
    if (error.code === 'PGRST116') {
      return { error: 'Entry not found', status: 404 };
    }
    throw error;
  }

  return { entry: data };
}

/**
 * send_vote_confirmation — send a confirmation email after voting (no auth required).
 * Rate-limited: only sends if the voter has a vote in the last 5 minutes.
 */
async function sendVoteConfirmation({ voter_email, company_name, award_name, entry_number }) {
  if (!isValidEmail(voter_email)) {
    return { error: 'Invalid email address', status: 400 };
  }

  // Security: only send if there's a recent vote from this email (prevents abuse)
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count, error: checkErr } = await supabase
    .from('public_votes')
    .select('id', { count: 'exact', head: true })
    .eq('voter_email', voter_email)
    .gte('voted_at', fiveMinAgo);

  if (checkErr) throw checkErr;
  if (!count || count === 0) {
    return { error: 'No recent vote found for this email', status: 400 };
  }

  // Send via Resend if configured
  if (!process.env.RESEND_API_KEY) {
    return { success: true, skipped: true, reason: 'RESEND_API_KEY not configured' };
  }

  try {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.FROM_EMAIL || 'awards@britishtradeawards.com';
    const fromName = process.env.FROM_NAME || 'British Trade Awards';

    await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [voter_email],
      subject: 'Vote Confirmation - British Trade Awards',
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#1a237e">Thank You for Voting!</h2>
        <p>Your vote has been recorded for <strong>${(company_name || 'the nominee').replace(/</g, '&lt;')}</strong>${award_name ? ` in the <strong>${award_name.replace(/</g, '&lt;')}</strong> category` : ''}.</p>
        ${entry_number ? `<p>Entry reference: ${entry_number.replace(/</g, '&lt;')}</p>` : ''}
        <p>Thank you for participating in the British Trade Awards!</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
        <p style="color:#666;font-size:12px">British Trade Awards</p>
      </div>`,
    });

    return { success: true };
  } catch (e) {
    console.error('Vote confirmation email failed:', e.message);
    return { success: true, email_error: e.message }; // Don't fail the vote flow
  }
}

/**
 * load_public_sectors — return CMS-managed sectors and categories for the home page.
 * Falls back to an empty result if the custom_sectors / custom_categories tables are
 * not yet populated; the front-end falls back to the static data in home-data.js.
 */
async function loadPublicSectors() {
  const [sectorsResult, catsResult] = await Promise.all([
    supabase.from('custom_sectors').select('id, name').eq('is_active', true).order('name'),
    supabase.from('custom_categories').select('id, name, sector_name').eq('is_active', true).order('name'),
  ]);

  const sectors = sectorsResult.data || [];
  const rawCats = catsResult.data || [];

  // Group categories by sector_name (matches what settings.js writes)
  const categories = {};
  rawCats.forEach(function (cat) {
    if (!cat.sector_name) return;
    if (!categories[cat.sector_name]) categories[cat.sector_name] = [];
    categories[cat.sector_name].push(cat.name);
  });

  return { sectors, categories };
}

async function loadWinners() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('winners')
    .select('*, award_years(award_name, award_category, year), organisations(company_name, logo_url)')
    .eq('is_published', true)
    .or(`embargo_until.is.null,embargo_until.lte.${now}`);

  if (error) throw error;
  const winners = data || [];

  // Pre-group by category for the public winners page
  const grouped = {};
  winners.forEach((w) => {
    const cat = w.award_years?.award_category || w.award_years?.award_name || w.award_name || 'Uncategorised';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({
      id: w.id,
      placement: w.placement,
      company_name: w.organisations?.company_name || w.company_name || '',
      logo_url: w.organisations?.logo_url || null,
      award_name: w.award_years?.award_name || w.award_name || '',
      award_category: cat,
      year: w.award_years?.year || null,
    });
  });

  return { winners, grouped };
}

// ────────────────────────────────────────────
// Action dispatch map
// ────────────────────────────────────────────

const ACTIONS = {
  load_awards: loadAwards,
  load_entries: loadEntries,
  load_public_sectors: loadPublicSectors,
  check_votes: checkVotes,
  check_rate_limit: checkRateLimit,
  check_existing_vote: checkExistingVote,
  submit_vote: submitVote,
  load_entry: loadEntry,
  send_vote_confirmation: sendVoteConfirmation,
  load_winners: loadWinners,
};

// ────────────────────────────────────────────
// Main handler
// ────────────────────────────────────────────

module.exports = async function handler(req, res) {
  setCors(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { action, ...params } = body || {};

    if (!action || !ACTIONS[action]) {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    // Always derive voter_ip from server-side headers — never trust the client body.
    // This prevents IP spoofing for rate-limit checks and vote records.
    const realIp =
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';

    if (action === 'submit_vote' || action === 'check_rate_limit') {
      params.voter_ip = realIp;
    }

    const result = await ACTIONS[action](params, res);

    // If the handler returned a status code (validation / rate-limit error)
    if (result && result.status) {
      const { status, ...rest } = result;
      return res.status(status).json(rest);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('[voting-proxy] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
