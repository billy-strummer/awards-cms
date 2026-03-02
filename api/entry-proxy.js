/**
 * Entry Submission Proxy API
 *
 * Server-side proxy for public entry submission.
 * Handles organisation lookup/creation, award matching, and entry creation
 * without exposing Supabase credentials to the browser.
 *
 * Environment Variables Required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_KEY
 *
 * Deploy as: Vercel serverless function at /api/entry-proxy
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ────────────────────────────────────────────
// CORS helpers
// ────────────────────────────────────────────

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ────────────────────────────────────────────
// Validation helpers
// ────────────────────────────────────────────

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitizeString(str, maxLength = 1000) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
}

// ────────────────────────────────────────────
// Rate limiting (in-memory, per-IP)
// ────────────────────────────────────────────

const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hour

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
// Generate entry number
// ────────────────────────────────────────────

async function generateEntryNumber() {
  const year = new Date().getFullYear();
  const prefix = `BTA-${year}-`;
  const { data, error } = await supabase
    .from('entries')
    .select('entry_number')
    .ilike('entry_number', `${prefix}%`)
    .order('entry_number', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return `${prefix}0001`;
  }
  const lastNum = parseInt(data[0].entry_number.replace(prefix, ''), 10) || 0;
  return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
}

// ────────────────────────────────────────────
// Main handler
// ────────────────────────────────────────────

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many submissions. Please try again later.' });
  }

  const { action } = req.body || {};

  try {
    switch (action) {
      case 'submit_entry':
        return await handleSubmitEntry(req, res);
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('Entry proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

async function handleSubmitEntry(req, res) {
  const {
    companyName,
    region,
    sector,
    contactEmail,
    contactName,
    contactPhone,
    companyWebsite,
    awardCategory,
    entryDescription,
    whyShouldWin,
    supportingInfo,
    tradeBodies,
    accreditations,
    employeeCount,
    contactPosition,
  } = req.body;

  // Validate required fields
  if (!companyName || typeof companyName !== 'string' || companyName.trim().length < 2) {
    return res.status(400).json({ error: 'Company name is required (min 2 characters)' });
  }
  if (!contactEmail || !isValidEmail(contactEmail)) {
    return res.status(400).json({ error: 'Valid email address is required' });
  }
  if (!contactName || typeof contactName !== 'string' || contactName.trim().length < 2) {
    return res.status(400).json({ error: 'Contact name is required' });
  }
  if (!entryDescription || typeof entryDescription !== 'string' || entryDescription.trim().length < 10) {
    return res.status(400).json({ error: 'Entry description is required (min 10 characters)' });
  }

  // Sanitize inputs
  const safe = {
    companyName: sanitizeString(companyName, 200),
    region: sanitizeString(region, 100),
    sector: sanitizeString(sector, 200),
    contactEmail: sanitizeString(contactEmail, 200),
    contactName: sanitizeString(contactName, 200),
    contactPhone: sanitizeString(contactPhone || '', 50) || null,
    companyWebsite: sanitizeString(companyWebsite || '', 500) || null,
    awardCategory: sanitizeString(awardCategory || '', 200),
    entryDescription: sanitizeString(entryDescription, 5000),
    whyShouldWin: sanitizeString(whyShouldWin || '', 5000) || null,
    supportingInfo: sanitizeString(supportingInfo || '', 5000) || null,
    tradeBodies: sanitizeString(tradeBodies || '', 1000) || null,
    accreditations: sanitizeString(accreditations || '', 1000) || null,
    employeeCount: sanitizeString(employeeCount || '', 50) || null,
    contactPosition: sanitizeString(contactPosition || '', 200) || null,
  };

  // 1. Find or create organisation
  let organisationId = null;
  const { data: existingOrgs } = await supabase
    .from('organisations')
    .select('id')
    .ilike('company_name', safe.companyName)
    .limit(1);

  if (existingOrgs && existingOrgs.length > 0) {
    organisationId = existingOrgs[0].id;
  } else {
    const { data: newOrg, error: orgError } = await supabase
      .from('organisations')
      .insert({
        company_name: safe.companyName,
        region: safe.region,
        sector: safe.sector,
        email: safe.contactEmail,
        contact_name: safe.contactName,
        contact_phone: safe.contactPhone,
        website: safe.companyWebsite,
        status: 'active',
      })
      .select()
      .single();

    if (orgError) {
      console.error('Organisation creation failed:', orgError);
      return res.status(500).json({ error: 'Could not save company details. Please try again.' });
    }
    organisationId = newOrg.id;
  }

  // 2. Find matching award
  let awardId = null;
  const { data: matchingAwards } = await supabase
    .from('awards')
    .select('id')
    .eq('award_name', safe.awardCategory)
    .eq('sector', safe.sector)
    .eq('county', safe.region)
    .eq('status', 'Active')
    .order('year', { ascending: false })
    .limit(1);

  if (matchingAwards && matchingAwards.length > 0) {
    awardId = matchingAwards[0].id;
  }

  // 3. Generate entry number
  const entryNumber = await generateEntryNumber();

  // 4. Build supporting info
  const supportParts = [];
  if (safe.supportingInfo) supportParts.push(safe.supportingInfo);
  if (safe.tradeBodies) supportParts.push('Trade Bodies: ' + safe.tradeBodies);
  if (safe.accreditations) supportParts.push('Accreditations: ' + safe.accreditations);
  if (safe.companyWebsite) supportParts.push('Website: ' + safe.companyWebsite);
  if (safe.employeeCount) supportParts.push('Employees: ' + safe.employeeCount);
  const supportingInformation = supportParts.join('\n\n') || null;

  // 5. Create entry
  const currentYear = new Date().getFullYear();
  const entryPayload = {
    entry_number: entryNumber,
    organisation_id: organisationId,
    award_id: awardId,
    entry_title: `${safe.companyName} - ${safe.awardCategory}`,
    entry_description: safe.entryDescription,
    contact_name: safe.contactName,
    contact_email: safe.contactEmail,
    status: 'submitted',
    payment_status: 'pending',
    submission_date: new Date().toISOString(),
    allow_public_voting: false,
    why_should_win: safe.whyShouldWin,
    supporting_information: supportingInformation,
    contact_phone: safe.contactPhone,
    contact_position: safe.contactPosition,
    year: currentYear,
    award_category: safe.awardCategory,
    sector: safe.sector,
    region: safe.region,
    is_self_nomination: true,
  };

  const { data: entry, error: entryError } = await supabase.from('entries').insert(entryPayload).select().single();

  if (entryError) {
    // Fallback: try base columns only
    const fallbackPayload = {
      entry_number: entryNumber,
      organisation_id: organisationId,
      award_id: awardId,
      entry_title: `${safe.companyName} - ${safe.awardCategory}`,
      entry_description: [
        safe.entryDescription,
        safe.whyShouldWin ? '\n\nWhy we should win:\n' + safe.whyShouldWin : '',
        supportingInformation ? '\n\nSupporting information:\n' + supportingInformation : '',
      ].join(''),
      contact_name: safe.contactName,
      contact_email: safe.contactEmail,
      status: 'submitted',
      payment_status: 'pending',
      submission_date: new Date().toISOString(),
      allow_public_voting: false,
    };

    const { data: baseEntry, error: baseError } = await supabase
      .from('entries')
      .insert(fallbackPayload)
      .select()
      .single();

    if (baseError) {
      console.error('Entry creation failed:', baseError);
      return res.status(500).json({ error: 'Could not save your entry. Please try again.' });
    }

    // Try setting extended fields (non-blocking)
    try {
      await supabase
        .from('entries')
        .update({
          why_should_win: safe.whyShouldWin,
          supporting_information: supportingInformation,
          contact_phone: safe.contactPhone,
          contact_position: safe.contactPosition,
          year: currentYear,
          award_category: safe.awardCategory,
          sector: safe.sector,
          region: safe.region,
          is_self_nomination: true,
        })
        .eq('id', baseEntry.id);
    } catch (_e) {
      /* non-blocking */
    }

    // Try sending confirmation email
    try {
      await supabase.rpc('send_entry_confirmation_email', { p_entry_id: baseEntry.id });
    } catch (_e) {
      /* non-blocking */
    }

    return res.status(200).json({
      success: true,
      entry: { id: baseEntry.id, entry_number: baseEntry.entry_number },
    });
  }

  // Try sending confirmation email
  try {
    await supabase.rpc('send_entry_confirmation_email', { p_entry_id: entry.id });
  } catch (_e) {
    /* non-blocking */
  }

  return res.status(200).json({
    success: true,
    entry: { id: entry.id, entry_number: entry.entry_number },
  });
}
