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
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY
);

// ────────────────────────────────────────────
// CORS helpers
// ────────────────────────────────────────────

const ALLOWED_ORIGIN = process.env.APP_URL || 'https://admin.britishtradeawards.com';

// Allowed file extensions for upload (document and image types only)
const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'csv',
  'txt',
  'rtf',
  'odt',
  'ods',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',
  'tiff',
  'bmp',
  'mp4',
  'mov',
  'avi',
  'webm',
  'mp3',
  'wav',
  'zip',
  'ppt',
  'pptx',
]);

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

// ────────────────────────────────────────────
// MIME type validation (extension vs declared MIME)
// Magic-byte validation is delegated to Supabase Storage server-side policies.
// ────────────────────────────────────────────

/**
 * Extensions where client-declared MIME cannot be reliably validated by extension alone.
 */
const SKIP_MAGIC_CHECK_EXTENSIONS = new Set(['csv', 'txt', 'rtf', 'svg', 'odt', 'ods', 'doc']);

/**
 * Map from extension to the set of MIME types that are considered valid for it.
 * Used for cross-validating the client-declared mime_type against the extension.
 */
const EXT_TO_VALID_MIMES = {
  pdf: new Set(['application/pdf']),
  jpg: new Set(['image/jpeg']),
  jpeg: new Set(['image/jpeg']),
  png: new Set(['image/png']),
  gif: new Set(['image/gif']),
  webp: new Set(['image/webp']),
  bmp: new Set(['image/bmp']),
  tiff: new Set(['image/tiff']),
  mp4: new Set(['video/mp4']),
  mov: new Set(['video/quicktime']),
  avi: new Set(['video/x-msvideo', 'video/avi']),
  webm: new Set(['video/webm']),
  mp3: new Set(['audio/mpeg', 'audio/mp3']),
  wav: new Set(['audio/wav', 'audio/wave', 'audio/x-wav']),
  zip: new Set(['application/zip', 'application/x-zip-compressed']),
  docx: new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip']),
  xlsx: new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip']),
  pptx: new Set(['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip']),
  ppt: new Set(['application/vnd.ms-powerpoint']),
  xls: new Set(['application/vnd.ms-excel']),
};

/**
 * Validate that the client-declared MIME type is consistent with the file extension.
 * For extensions in SKIP_MAGIC_CHECK_EXTENSIONS, the check is skipped.
 *
 * @param {string} ext       - Lower-case file extension (without dot).
 * @param {string} mimeType  - MIME type declared by the client.
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateMimeVsExtension(ext, mimeType) {
  if (SKIP_MAGIC_CHECK_EXTENSIONS.has(ext)) {
    return { valid: true };
  }
  if (!mimeType) {
    // No declared MIME type — skip validation (legacy clients)
    return { valid: true };
  }
  const validMimes = EXT_TO_VALID_MIMES[ext];
  if (!validMimes) {
    // Extension not in our mapping — skip validation
    return { valid: true };
  }
  const normalised = mimeType.toLowerCase().split(';')[0].trim();
  if (!validMimes.has(normalised)) {
    return { valid: false, reason: `Declared MIME type "${normalised}" does not match extension ".${ext}"` };
  }
  return { valid: true };
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

// ────────────────────────────────────────────
// Authentication
// ────────────────────────────────────────────

async function verifyAuth(req, res) {
  const authHeader = req.headers?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  const token = authHeader.replace('Bearer ', '');
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

  const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const ip = rawIp.split(',').pop().trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const { action } = req.method === 'GET' ? req.query : req.body || {};

  // Public document upload actions — authenticated by entry_number (known only to the entrant).
  // These are called from upload-documents.html which is a public page.
  const publicActions = ['get_entry', 'get_existing_files', 'save_file_metadata', 'get_upload_token'];

  if (!publicActions.includes(action)) {
    // Non-public actions require authentication
    const user = await verifyAuth(req, res);
    if (!user) return;
  }

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

  // Validate file extension against allowlist
  const metaExt = file_name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTENSIONS.has(metaExt)) {
    return res.status(400).json({ error: `File type ".${metaExt}" is not allowed.` });
  }

  // Validate declared MIME type is consistent with the file extension
  if (mime_type) {
    const mimeCheck = validateMimeVsExtension(metaExt, mime_type);
    if (!mimeCheck.valid) {
      return res.status(415).json({ error: mimeCheck.reason });
    }
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

  const fileSize = req.body.file_size;

  if (!entryNumber || !fileName) {
    return res.status(400).json({ error: 'entry_number and file_name are required' });
  }

  // Validate file extension against allowlist
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return res
      .status(400)
      .json({ error: `File type ".${ext}" is not allowed. Permitted types: documents and images only.` });
  }

  // Validate declared MIME type is consistent with the file extension (if provided)
  const declaredMime = typeof req.body.mime_type === 'string' ? req.body.mime_type : null;
  if (declaredMime) {
    const mimeCheck = validateMimeVsExtension(ext, declaredMime);
    if (!mimeCheck.valid) {
      return res.status(415).json({ error: mimeCheck.reason });
    }
  }

  // Enforce max file size (client-supplied; also enforced by Supabase Storage policy)
  if (typeof fileSize === 'number' && fileSize > MAX_FILE_SIZE_BYTES) {
    return res.status(400).json({ error: `File exceeds the 25 MB maximum size limit.` });
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
