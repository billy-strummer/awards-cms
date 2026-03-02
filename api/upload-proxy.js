/**
 * Upload Documents Proxy API
 *
 * Server-side proxy for the public document upload page.
 * Handles entry lookups, organisation/award enrichment, file metadata
 * listing, and entry_files inserts — without exposing Supabase
 * credentials to the browser.
 *
 * Environment Variables Required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_KEY
 *
 * Deploy as: Vercel serverless function at /api/upload-proxy
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ────────────────────────────────────────────
// CORS helpers
// ────────────────────────────────────────────

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ────────────────────────────────────────────
// Validation helpers
// ────────────────────────────────────────────

function sanitizeString(str, maxLength = 500) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
}

// ────────────────────────────────────────────
// Rate limiting (in-memory, per-IP)
// ────────────────────────────────────────────

const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

// ────────────────────────────────────────────
// Main handler
// ────────────────────────────────────────────

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const { action } = req.method === 'GET' ? req.query : req.body || {};

  try {
    switch (action) {
      case 'get_entry':
        return await handleGetEntry(req, res);
      case 'get_existing_files':
        return await handleGetExistingFiles(req, res);
      case 'save_file_metadata':
        return await handleSaveFileMetadata(req, res);
      case 'get_upload_token':
        return await handleGetUploadToken(req, res);
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('Upload proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ────────────────────────────────────────────
// Action handlers
// ────────────────────────────────────────────

/**
 * Fetch entry details with optional organisation and award enrichment.
 * Accepts: GET ?action=get_entry&entry_number=BTA-2025-0001
 */
async function handleGetEntry(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const entryNumber = sanitizeString(req.query.entry_number, 50);
  if (!entryNumber) {
    return res.status(400).json({ error: 'entry_number is required' });
  }

  const { data: entry, error } = await supabase.from('entries').select('*').eq('entry_number', entryNumber).single();

  if (error || !entry) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  // Enrich with organisation name
  let companyName = 'N/A';
  if (entry.organisation_id) {
    const { data: org } = await supabase
      .from('organisations')
      .select('company_name')
      .eq('id', entry.organisation_id)
      .single();
    if (org) companyName = org.company_name;
  }

  // Enrich with award name
  let awardName = 'N/A';
  if (entry.award_id) {
    const { data: award } = await supabase.from('award_years').select('award_name').eq('id', entry.award_id).single();
    if (award) awardName = award.award_name;
  }

  return res.status(200).json({
    entry: {
      id: entry.id,
      entry_number: entry.entry_number,
      contact_name: entry.contact_name || 'N/A',
      contact_email: entry.contact_email || '',
      company_name: companyName,
      award_name: awardName,
    },
  });
}

/**
 * Fetch existing uploaded files for an entry.
 * Accepts: GET ?action=get_existing_files&entry_id=<uuid>
 */
async function handleGetExistingFiles(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const entryId = sanitizeString(req.query.entry_id, 100);
  if (!entryId) {
    return res.status(400).json({ error: 'entry_id is required' });
  }

  const { data: files, error } = await supabase
    .from('entry_files')
    .select('file_name, file_size, upload_date')
    .eq('entry_id', entryId)
    .order('upload_date', { ascending: false });

  if (error) {
    return res.status(500).json({ error: 'Failed to load files' });
  }

  return res.status(200).json({ files: files || [] });
}

/**
 * Save file metadata after a successful Storage upload.
 * Accepts: POST { action: 'save_file_metadata', ... }
 */
async function handleSaveFileMetadata(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { entry_id, file_name, file_url, file_type, file_size, mime_type, uploaded_by } = req.body;

  if (!entry_id || !file_name || !file_url) {
    return res.status(400).json({ error: 'entry_id, file_name, and file_url are required' });
  }

  // Verify the entry exists
  const { data: entry } = await supabase.from('entries').select('id').eq('id', entry_id).single();
  if (!entry) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  const { error } = await supabase.from('entry_files').insert([
    {
      entry_id: sanitizeString(entry_id, 100),
      file_name: sanitizeString(file_name, 500),
      file_url: sanitizeString(file_url, 2000),
      file_type: sanitizeString(file_type || 'other', 50),
      file_size: typeof file_size === 'number' ? file_size : 0,
      mime_type: sanitizeString(mime_type || '', 100),
      uploaded_by: sanitizeString(uploaded_by || '', 200),
      is_public: false,
    },
  ]);

  if (error) {
    console.error('Failed to save file metadata:', error);
    return res.status(500).json({ error: 'Failed to save file metadata' });
  }

  return res.status(200).json({ success: true });
}

/**
 * Get a short-lived signed upload URL for Supabase Storage.
 * This avoids exposing the anon key for storage writes.
 * Accepts: POST { action: 'get_upload_token', entry_number, file_name }
 */
async function handleGetUploadToken(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const entryNumber = sanitizeString(req.body.entry_number, 50);
  const fileName = sanitizeString(req.body.file_name, 500);

  if (!entryNumber || !fileName) {
    return res.status(400).json({ error: 'entry_number and file_name are required' });
  }

  // Verify the entry exists
  const { data: entry } = await supabase.from('entries').select('id').eq('entry_number', entryNumber).single();

  if (!entry) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  const timestamp = Date.now();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.{2,}/g, '.');
  const storagePath = `${entryNumber}/${timestamp}-${safeName}`;

  const { data, error } = await supabase.storage.from('entry-files').createSignedUploadUrl(storagePath);

  if (error) {
    console.error('Failed to create upload URL:', error);
    return res.status(500).json({ error: 'Failed to create upload URL' });
  }

  // Get the public URL for the file once uploaded
  const { data: urlData } = supabase.storage.from('entry-files').getPublicUrl(storagePath);

  return res.status(200).json({
    signedUrl: data.signedUrl,
    token: data.token,
    path: storagePath,
    publicUrl: urlData.publicUrl,
  });
}
