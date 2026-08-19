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
const { sendEntryConfirmation, sendNominationConfirmation } = require('./email-automation');
const { sendEmail } = require('./resend-email');
const { wrapEmail } = require('./_lib/email-header');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Load an active email template from the DB by type. Returns null if not found.
async function loadDbEmailTemplate(templateType) {
  try {
    const { data } = await supabase
      .from('email_templates')
      .select('subject, body')
      .eq('template_type', templateType)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .limit(1)
      .single();
    return data || null;
  } catch {
    return null;
  }
}

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
// Rate limiting (DB-backed, cross-instance safe)
// ────────────────────────────────────────────

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hour

/**
 * Check whether an email has exceeded the entry submission rate limit.
 * Uses the database so the limit is enforced across all serverless instances.
 * Returns true if the request is allowed, false if it should be blocked.
 */
async function checkEmailRateLimit(email) {
  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from('entries')
    .select('id', { count: 'exact', head: true })
    .eq('contact_email', email.toLowerCase())
    .gte('submission_date', oneHourAgo);
  if (error) {
    console.warn('[entry-proxy] Rate limit check failed (non-fatal):', error.message);
    return true; // Allow on error to avoid blocking legitimate submissions
  }
  return (count || 0) < RATE_LIMIT_MAX;
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

/**
 * Insert an entry payload with protection against the read-then-write race
 * condition in generateEntryNumber(). If two concurrent submissions read the
 * same MAX(entry_number) and generate the same value, the second INSERT will
 * hit the UNIQUE constraint on entry_number. We catch that violation and retry
 * with a freshly generated number (up to MAX_RETRIES attempts).
 *
 * @param {object} payload - The entry record to insert
 * @returns {Promise<{data: object, error: object|null}>}
 */
async function insertEntryWithRetry(payload) {
  const MAX_RETRIES = 3;
  let attempt = 0;
  let entryPayload = { ...payload };

  while (attempt < MAX_RETRIES) {
    // eslint-disable-next-line no-await-in-loop
    const result = await supabase.from('entries').insert(entryPayload).select().single();

    if (!result.error) return result;

    // PostgreSQL unique-violation code is '23505'; Supabase surfaces it in
    // error.code. Only retry on that specific error.
    const isDuplicate =
      result.error.code === '23505' || (result.error.message && result.error.message.includes('entry_number'));

    if (!isDuplicate || attempt >= MAX_RETRIES - 1) {
      return result; // non-retryable error, or we've exhausted retries
    }

    // Back off with random jitter before the next attempt
    const backoffMs = 50 + Math.floor(Math.random() * 100) * (attempt + 1);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, backoffMs));

    // Re-generate entry number for the next attempt
    // eslint-disable-next-line no-await-in-loop
    entryPayload = { ...entryPayload, entry_number: await generateEntryNumber() };
    attempt++;
  }

  // Should not reach here, but satisfy static analysis
  return await supabase.from('entries').insert(entryPayload).select().single();
}

// ────────────────────────────────────────────
// Public winner portal lookup (token-authenticated, no Supabase JWT needed)
// ────────────────────────────────────────────

async function handleGetWinner(req, res) {
  const { token, id } = req.body || {};

  if (!token || typeof token !== 'string' || token.length < 8) {
    return res.status(400).json({ error: 'Invalid access token' });
  }

  let query = supabase
    .from('winners')
    .select(
      'id, status, winner_position, year, ' +
        'award_years:award_years!winners_award_id_fkey(award_name, award_category, sector, county), ' +
        'organisations(company_name, logo_url)'
    )
    .eq('access_token', token);

  if (id) {
    const parsedId = parseInt(id, 10);
    if (!isNaN(parsedId) && parsedId > 0) query = query.eq('id', parsedId);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    console.error('[entry-proxy] get_winner error:', error.message);
    return res.status(500).json({ error: 'Failed to load winner data' });
  }

  if (!data) {
    return res.status(404).json({ error: 'Winner not found' });
  }

  // Strip the access_token before returning — it's an internal auth secret
  const { access_token: _stripped, ...safeData } = data;
  return res.status(200).json({ success: true, data: safeData });
}

// ────────────────────────────────────────────
// Sponsor enquiry
// ────────────────────────────────────────────

async function handleSponsorEnquiry(req, res) {
  const { name, company, role, email, phone, package: pkg, message } = req.body || {};

  if (!name || !company || !email || !pkg) {
    return res.status(400).json({ error: 'Missing required fields: name, company, email, package' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const safeName = sanitizeString(name, 100);
  const safeCompany = sanitizeString(company, 200);
  const safeRole = sanitizeString(role || '', 100);
  const safePhone = sanitizeString(phone || '', 30);
  const safePkg = sanitizeString(pkg, 60);
  const safeMsg = sanitizeString(message || '', 2000);
  const safeEmail = sanitizeString(email, 254);

  // 1. Persist to database (primary record — survives email failures)
  const { error: dbError } = await supabase.from('sponsor_enquiries').insert({
    name: safeName,
    company: safeCompany,
    role: safeRole || null,
    email: safeEmail,
    phone: safePhone || null,
    package: safePkg,
    message: safeMsg || null,
  });

  if (dbError) {
    console.error('[entry-proxy] sponsor_enquiries insert failed:', dbError.message);
    // Non-fatal: still attempt email so the enquiry is not silently lost
  }

  // 2. Send notification email to the team
  const toEmail = process.env.FROM_EMAIL || 'sponsorship@britishtradeawards.com';
  const subject = `Sponsorship Enquiry — ${safePkg} — ${safeCompany}`;
  const html = `
    <h2 style="color:#C9A227;font-family:Georgia,serif;">New Sponsorship Enquiry</h2>
    <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px;">
      <tr><td style="padding:8px 16px 8px 0;color:#666;white-space:nowrap;"><strong>Name</strong></td><td style="padding:8px 0;">${safeName}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px 16px 8px 0;color:#666;"><strong>Company</strong></td><td style="padding:8px 0;">${safeCompany}</td></tr>
      <tr><td style="padding:8px 16px 8px 0;color:#666;"><strong>Role</strong></td><td style="padding:8px 0;">${safeRole || '—'}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px 16px 8px 0;color:#666;"><strong>Email</strong></td><td style="padding:8px 0;"><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
      <tr><td style="padding:8px 16px 8px 0;color:#666;"><strong>Phone</strong></td><td style="padding:8px 0;">${safePhone || '—'}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px 16px 8px 0;color:#666;"><strong>Package Interest</strong></td><td style="padding:8px 0;font-weight:bold;color:#C9A227;">${safePkg}</td></tr>
      ${safeMsg ? `<tr><td style="padding:8px 16px 8px 0;color:#666;vertical-align:top;"><strong>Message</strong></td><td style="padding:8px 0;">${safeMsg.replace(/\n/g, '<br>')}</td></tr>` : ''}
    </table>
    <p style="margin-top:24px;font-size:12px;color:#999;">Submitted via become-a-sponsor.html — also logged in CMS under Organisations → Sponsorship Enquiries.</p>
    <p style="font-size:12px;color:#999;">Reply directly to <a href="mailto:${safeEmail}">${safeEmail}</a></p>
  `;

  const emailResult = await sendEmail({ to: toEmail, subject, html, replyTo: safeEmail });

  // Return success if either the DB record was saved OR the email was sent
  if (dbError && !emailResult.success) {
    return res.status(500).json({ error: 'Failed to save enquiry. Please try again.' });
  }

  // 3. Send branded confirmation to the enquirer (non-blocking — never fail the request)
  // Try DB template first (editable from CMS Email Templates tab — full HTML body).
  // Falls back to the rich hardcoded HTML body if no DB record exists.
  const dbTpl = await loadDbEmailTemplate('sponsor_enquiry_confirmation').catch(() => null);
  let confirmSubject;
  let confirmHtml;

  if (dbTpl) {
    // DB body is treated as raw HTML — the template is admin-authored, so it is trusted.
    // Only the user-supplied values are HTML-escaped before substitution.
    const escH = (s) =>
      String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    confirmSubject = dbTpl.subject
      .replace(/\{NAME\}/gi, safeName)
      .replace(/\{COMPANY\}/gi, safeCompany)
      .replace(/\{PACKAGE\}/gi, safePkg);

    // {ROLE_ROW} and {MESSAGE_ROW} expand to full HTML table rows (or empty string),
    // so absent fields leave no empty rows in the email.
    const roleRow = safeRole
      ? `<tr style="background:#1a1a1a;"><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.07);"><span style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.35);display:block;margin-bottom:4px;">Your Role</span><span style="font-family:Arial,sans-serif;font-size:15px;color:#ffffff;">${escH(safeRole)}</span></td></tr>`
      : '';
    const msgRow = safeMsg
      ? `<tr style="background:#161616;"><td style="padding:14px 20px;"><span style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.35);display:block;margin-bottom:4px;">Your Message</span><span style="font-family:Arial,sans-serif;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.65;">${escH(safeMsg).replace(/\n/g, '<br>')}</span></td></tr>`
      : '';

    const bodyHtml = dbTpl.body
      .replace(/\{NAME\}/gi, escH(safeName))
      .replace(/\{COMPANY\}/gi, escH(safeCompany))
      .replace(/\{PACKAGE\}/gi, escH(safePkg))
      .replace(/\{ROLE_ROW\}/gi, roleRow)
      .replace(/\{MESSAGE_ROW\}/gi, msgRow);

    confirmHtml = wrapEmail(
      bodyHtml,
      { primary_color: '#0a0a0a', secondary_color: '#111111', accent_color: '#C9A227' },
      {
        subject: confirmSubject,
        subtitle: 'Sponsorship Enquiry Received',
        preheader: `Hi ${safeName}, we've received your enquiry and will be in touch within 2 business days.`,
      }
    );
  } else {
    confirmSubject = `Sponsorship enquiry received — British Trade Awards 2026`;
    const confirmBody = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111111;">

  <!-- Greeting -->
  <tr>
    <td style="padding:40px 40px 24px;">
      <p style="font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#ffffff;margin:0 0 16px;line-height:1.25;">Hi ${safeName},</p>
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.8;margin:0;">
        Thank you for your interest in sponsoring the <strong style="color:#ffffff;">British Trade Awards 2026</strong>.
        We&rsquo;ve received your enquiry and a member of our partnerships team will be in touch
        within <strong style="color:#C9A227;">2 business days</strong>.
      </p>
    </td>
  </tr>

  <!-- Gold rule -->
  <tr>
    <td style="padding:0 40px 28px;">
      <table width="60" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="height:3px;background:#C9A227;border-radius:2px;"></td></tr>
      </table>
    </td>
  </tr>

  <!-- Enquiry summary card -->
  <tr>
    <td style="padding:0 40px 36px;">
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#C9A227;margin:0 0 14px;">Your Enquiry</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(201,162,39,0.3);border-radius:10px;overflow:hidden;">
        <tr style="background:#1a1a1a;">
          <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.07);">
            <span style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.35);display:block;margin-bottom:4px;">Package</span>
            <span style="font-family:Georgia,'Times New Roman',serif;font-size:17px;color:#C9A227;font-weight:700;">${safePkg}</span>
          </td>
        </tr>
        <tr style="background:#161616;">
          <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.07);">
            <span style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.35);display:block;margin-bottom:4px;">Company</span>
            <span style="font-family:Arial,sans-serif;font-size:15px;color:#ffffff;">${safeCompany}</span>
          </td>
        </tr>
        ${
          safeRole
            ? `<tr style="background:#1a1a1a;">
          <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.07);">
            <span style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.35);display:block;margin-bottom:4px;">Your Role</span>
            <span style="font-family:Arial,sans-serif;font-size:15px;color:#ffffff;">${safeRole}</span>
          </td>
        </tr>`
            : ''
        }
        ${
          safeMsg
            ? `<tr style="background:#161616;">
          <td style="padding:14px 20px;">
            <span style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.35);display:block;margin-bottom:4px;">Your Message</span>
            <span style="font-family:Arial,sans-serif;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.65;">${safeMsg.replace(/\n/g, '<br>')}</span>
          </td>
        </tr>`
            : ''
        }
      </table>
    </td>
  </tr>

  <!-- What happens next -->
  <tr>
    <td style="padding:0 40px 36px;">
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#C9A227;margin:0 0 20px;">What Happens Next</p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
        <tr>
          <td width="40" valign="top">
            <table cellpadding="0" cellspacing="0" border="0"><tr><td style="width:28px;height:28px;border-radius:50%;background:#C9A227;text-align:center;font-family:Georgia,serif;font-size:13px;font-weight:700;color:#000;line-height:28px;">1</td></tr></table>
          </td>
          <td valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;padding-top:4px;">
            Our partnerships team reviews your enquiry and prepares the relevant package details.
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
        <tr>
          <td width="40" valign="top">
            <table cellpadding="0" cellspacing="0" border="0"><tr><td style="width:28px;height:28px;border-radius:50%;background:#C9A227;text-align:center;font-family:Georgia,serif;font-size:13px;font-weight:700;color:#000;line-height:28px;">2</td></tr></table>
          </td>
          <td valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;padding-top:4px;">
            We&rsquo;ll contact you within <strong style="color:#ffffff;">2 business days</strong> to discuss your goals and answer any questions.
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="40" valign="top">
            <table cellpadding="0" cellspacing="0" border="0"><tr><td style="width:28px;height:28px;border-radius:50%;background:#C9A227;text-align:center;font-family:Georgia,serif;font-size:13px;font-weight:700;color:#000;line-height:28px;">3</td></tr></table>
          </td>
          <td valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;padding-top:4px;">
            We&rsquo;ll send a bespoke proposal tailored to your brand and marketing objectives.
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Divider -->
  <tr>
    <td style="padding:0 40px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="height:1px;background:rgba(255,255,255,0.08);"></td></tr>
      </table>
    </td>
  </tr>

  <!-- Sign-off -->
  <tr>
    <td style="padding:24px 40px 32px;">
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:rgba(255,255,255,0.4);margin:0 0 6px;">
        Questions? Simply reply to this email.
      </p>
      <p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#ffffff;margin:0;">
        The British Trade Awards Partnerships Team
      </p>
    </td>
  </tr>

  <!-- Legal note -->
  <tr>
    <td style="padding:16px 40px 28px;border-top:1px solid rgba(201,162,39,0.12);">
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:rgba(255,255,255,0.2);margin:0;line-height:1.7;">
        You&rsquo;re receiving this because you submitted a sponsorship enquiry at
        <a href="https://britishtradeawards.com/become-a-sponsor.html" style="color:rgba(201,162,39,0.4);text-decoration:none;">britishtradeawards.com</a>.
        If this wasn&rsquo;t you, you can safely ignore this message.
      </p>
    </td>
  </tr>

</table>`;

    confirmHtml = wrapEmail(
      confirmBody,
      {
        primary_color: '#0a0a0a',
        secondary_color: '#111111',
        accent_color: '#C9A227',
      },
      {
        subject: confirmSubject,
        subtitle: 'Sponsorship Enquiry Received',
        preheader: `Hi ${safeName}, we've received your enquiry and will be in touch within 2 business days.`,
      }
    );
  }

  sendEmail({ to: safeEmail, subject: confirmSubject, html: confirmHtml }).catch((err) => {
    console.error('[entry-proxy] Sponsor confirmation email failed (non-fatal):', err.message);
  });

  return res.status(200).json({ success: true });
}

// ────────────────────────────────────────────
// Main handler
// ────────────────────────────────────────────

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.body || {};

  try {
    switch (action) {
      case 'submit_entry':
        return await handleSubmitEntry(req, res);
      case 'submit_nomination':
        return await handleSubmitNomination(req, res);
      case 'get_public_data':
        return await handleGetPublicData(req, res);
      case 'data_export':
        return await handleDataExport(req, res);
      case 'sponsor_enquiry':
        return await handleSponsorEnquiry(req, res);
      case 'get_winner':
        return await handleGetWinner(req, res);
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('Entry proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GDPR Article 20 — Data portability self-service export.
 * Returns all data held for a given email + entry number without requiring admin login.
 * Rate-limited by the email lookup being the only auth (entry number acts as a token).
 */
async function handleDataExport(req, res) {
  const { email, entry_number: entryNumber } = req.body || {};
  if (!email || !entryNumber) {
    return res.status(400).json({ error: 'email and entry_number are required' });
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const { data: entry, error } = await supabase
    .from('entries')
    .select(
      'id, entry_number, entry_title, sector, county_city, contact_name, contact_email, contact_phone, entry_description, why_should_win, payment_status, status, consent_given, consent_timestamp, created_at'
    )
    .eq('contact_email', email.toLowerCase().trim())
    .eq('entry_number', entryNumber.trim())
    .maybeSingle();

  if (error) {
    console.error('[entry-proxy] data_export query error:', error.message);
    return res.status(500).json({ error: 'Export failed' });
  }

  if (!entry) {
    // Return generic message to avoid email enumeration
    return res.status(404).json({ error: 'No entry found matching these details' });
  }

  // Remove fields that could expose internal identifiers
  const exportData = {
    entry_number: entry.entry_number,
    entry_title: entry.entry_title,
    sector: entry.sector,
    county_city: entry.county_city,
    contact_name: entry.contact_name,
    contact_email: entry.contact_email,
    contact_phone: entry.contact_phone,
    entry_description: entry.entry_description,
    why_should_win: entry.why_should_win,
    payment_status: entry.payment_status,
    status: entry.status,
    consent_given: entry.consent_given,
    consent_timestamp: entry.consent_timestamp,
    submitted_at: entry.created_at,
    data_controller: 'British Trade Awards',
    export_generated_at: new Date().toISOString(),
    your_rights: 'You may request erasure by emailing privacy@britishtradeawards.com',
  };

  return res.status(200).json({ export: exportData });
}

async function handleGetPublicData(_req, res) {
  const [sectorsResult, catsResult, configResult] = await Promise.all([
    supabase.from('custom_sectors').select('id, name').eq('is_active', true).order('name'),
    supabase.from('custom_categories').select('id, name, sector_name').eq('is_active', true).order('name'),
    supabase.from('cms_config').select('key, value').in('key', ['sponsors_visible']),
  ]);
  const config = {};
  for (const row of configResult.data || []) config[row.key] = row.value;
  return res.status(200).json({
    custom_sectors: sectorsResult.data || [],
    custom_categories: catsResult.data || [],
    sponsors_visible: config['sponsors_visible'] === 'true',
  });
}

async function handleSubmitEntry(req, res) {
  // Honeypot: bots fill the 'website' field; humans leave it blank
  if (req.body?.website) {
    return res.status(200).json({ success: true, entry: { entry_number: 'BOT-0000' } });
  }

  const {
    companyName,
    county_city,
    region, // backward compat alias for county_city
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
  const countyCity = county_city || region; // prefer new field name, fall back to old

  // Validate required fields
  if (!companyName || typeof companyName !== 'string' || companyName.trim().length < 2) {
    return res.status(400).json({ error: 'Company name is required (min 2 characters)' });
  }
  if (!contactEmail || !isValidEmail(contactEmail)) {
    return res.status(400).json({ error: 'Valid email address is required' });
  }

  // DB-backed rate limit: enforced across all serverless instances
  const allowed = await checkEmailRateLimit(contactEmail);
  if (!allowed) {
    return res.status(429).json({ error: 'Too many submissions from this email. Please try again later.' });
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
    countyCity: sanitizeString(countyCity, 100),
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
        county_city: safe.countyCity,
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
  let awardEntryFee = 0;
  const { data: matchingAwards } = await supabase
    .from('awards')
    .select('id, entry_fee')
    .eq('award_name', safe.awardCategory)
    .eq('sector', safe.sector)
    .eq('county', safe.countyCity)
    .eq('status', 'Active')
    .order('year', { ascending: false })
    .limit(1);

  if (matchingAwards && matchingAwards.length > 0) {
    awardId = matchingAwards[0].id;
    awardEntryFee = Number(matchingAwards[0].entry_fee) || 0;
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
  const submittedAt = new Date().toISOString();
  const submitterIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;
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
    submission_date: submittedAt,
    allow_public_voting: false,
    why_should_win: safe.whyShouldWin,
    supporting_information: supportingInformation,
    contact_phone: safe.contactPhone,
    contact_position: safe.contactPosition,
    year: currentYear,
    award_category: safe.awardCategory,
    sector: safe.sector,
    county_city: safe.countyCity,
    is_self_nomination: true,
    // GDPR Article 7: record when and how consent was given
    consent_given: true,
    consent_timestamp: submittedAt,
    consent_ip_address: submitterIp,
    lawful_basis: 'legitimate_interest',
  };

  // Use retry wrapper to handle concurrent-submission race conditions on entry_number
  const { data: entry, error: entryError } = await insertEntryWithRetry(entryPayload);

  if (entryError) {
    // Fallback: try base columns only (re-use the already-generated entryNumber)
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

    const { data: baseEntry, error: baseError } = await insertEntryWithRetry(fallbackPayload);

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
          county_city: safe.countyCity,
          is_self_nomination: true,
        })
        .eq('id', baseEntry.id);
    } catch (_e) {
      console.error('[entry-proxy] Non-blocking metadata update failed:', _e.message);
    }

    // Send confirmation email (non-blocking)
    sendEntryConfirmation(baseEntry.id).catch(() => {});

    return res.status(200).json({
      success: true,
      entry: { id: baseEntry.id, entry_number: baseEntry.entry_number },
      entry_fee: awardEntryFee,
    });
  }

  // Send confirmation email (non-blocking)
  sendEntryConfirmation(entry.id).catch(() => {});

  return res.status(200).json({
    success: true,
    entry: { id: entry.id, entry_number: entry.entry_number },
    entry_fee: awardEntryFee,
  });
}

// Handle nomination submission
// ────────────────────────────────────────────

async function handleSubmitNomination(req, res) {
  // Honeypot: bots fill the 'website' field; humans leave it blank
  if (req.body?.website) {
    return res.status(200).json({ success: true, nomination: { entry_number: 'BOT-0000' } });
  }

  const {
    awardCategory,
    county_city: nomCountyCity,
    region: nomRegion, // backward compat alias
    nominationReason,
    supportingInfo,
    nominatorName,
    nominatorCompany,
    nominatorRelationship,
    nominatorEmail,
    nominatorPhone,
    // Person nomination fields
    nomineeName,
    nomineeRole,
    nomineeCompany,
    nomineeYearsInTrade,
    // Business nomination fields (New Business of the Year)
    businessName,
    businessOwner,
    businessDescription,
    businessWebsite,
    businessYearsTrading,
    businessEmployees,
  } = req.body;
  const nomCountyCityValue = nomCountyCity || nomRegion; // prefer new field name

  const isNewBusiness = awardCategory === 'New Business of the Year';

  // Validate required fields
  if (!awardCategory || typeof awardCategory !== 'string') {
    return res.status(400).json({ error: 'Award category is required' });
  }
  if (!nominatorEmail || !isValidEmail(nominatorEmail)) {
    return res.status(400).json({ error: 'Valid email address is required' });
  }

  // DB-backed rate limit (shared limit across entries + nominations for the same email)
  const allowed = await checkEmailRateLimit(nominatorEmail);
  if (!allowed) {
    return res.status(429).json({ error: 'Too many submissions from this email. Please try again later.' });
  }

  if (!nominatorName || typeof nominatorName !== 'string' || nominatorName.trim().length < 2) {
    return res.status(400).json({ error: 'Your name is required' });
  }
  if (!nominationReason || typeof nominationReason !== 'string' || nominationReason.trim().length < 10) {
    return res.status(400).json({ error: 'Nomination reason is required (min 10 characters)' });
  }

  if (isNewBusiness) {
    if (!businessName || typeof businessName !== 'string' || businessName.trim().length < 2) {
      return res.status(400).json({ error: 'Business name is required (min 2 characters)' });
    }
    if (!businessOwner || typeof businessOwner !== 'string' || businessOwner.trim().length < 2) {
      return res.status(400).json({ error: 'Business owner name is required' });
    }
  } else {
    if (!nomineeName || typeof nomineeName !== 'string' || nomineeName.trim().length < 2) {
      return res.status(400).json({ error: 'Nominee name is required (min 2 characters)' });
    }
    if (!nomineeCompany || typeof nomineeCompany !== 'string' || nomineeCompany.trim().length < 2) {
      return res.status(400).json({ error: 'Nominee company is required' });
    }
  }

  // Sanitize inputs
  const safe = {
    awardCategory: sanitizeString(awardCategory, 200),
    countyCity: sanitizeString(nomCountyCityValue || '', 100),
    nominationReason: sanitizeString(nominationReason, 5000),
    supportingInfo: sanitizeString(supportingInfo || '', 5000) || null,
    nominatorName: sanitizeString(nominatorName, 200),
    nominatorCompany: sanitizeString(nominatorCompany || '', 200) || null,
    nominatorRelationship: sanitizeString(nominatorRelationship || '', 100) || null,
    nominatorEmail: sanitizeString(nominatorEmail, 200),
    nominatorPhone: sanitizeString(nominatorPhone || '', 50) || null,
    nomineeName: sanitizeString(nomineeName || '', 200),
    nomineeRole: sanitizeString(nomineeRole || '', 200) || null,
    nomineeCompany: sanitizeString(nomineeCompany || '', 200),
    nomineeYearsInTrade: sanitizeString(nomineeYearsInTrade || '', 50) || null,
    businessName: sanitizeString(businessName || '', 200),
    businessOwner: sanitizeString(businessOwner || '', 200),
    businessDescription: sanitizeString(businessDescription || '', 1000) || null,
    businessWebsite: sanitizeString(businessWebsite || '', 500) || null,
    businessYearsTrading: sanitizeString(businessYearsTrading || '', 50) || null,
    businessEmployees: sanitizeString(businessEmployees || '', 50) || null,
  };

  // Determine the "company name" and "contact name" for the entry record
  const companyName = isNewBusiness ? safe.businessName : safe.nomineeCompany;
  const nomineePerson = isNewBusiness ? safe.businessOwner : safe.nomineeName;

  // 1. Find or create organisation for the nominee's company
  let organisationId = null;
  const { data: existingOrgs } = await supabase
    .from('organisations')
    .select('id')
    .ilike('company_name', companyName)
    .limit(1);

  if (existingOrgs && existingOrgs.length > 0) {
    organisationId = existingOrgs[0].id;
  } else {
    const { data: newOrg, error: orgError } = await supabase
      .from('organisations')
      .insert({
        company_name: companyName,
        county_city: safe.countyCity,
        contact_name: nomineePerson,
        website: isNewBusiness ? safe.businessWebsite : null,
        status: 'active',
      })
      .select()
      .single();

    if (orgError) {
      console.error('Organisation creation failed:', orgError);
      return res.status(500).json({ error: 'Could not save nomination details. Please try again.' });
    }
    organisationId = newOrg.id;
  }

  // 2. Generate entry number
  const entryNumber = await generateEntryNumber();

  // 3. Build supporting information block
  const supportParts = [];
  if (isNewBusiness) {
    if (safe.businessDescription) supportParts.push('Business Description: ' + safe.businessDescription);
    if (safe.businessYearsTrading) supportParts.push('Years Trading: ' + safe.businessYearsTrading);
    if (safe.businessEmployees) supportParts.push('Employees: ' + safe.businessEmployees);
    if (safe.businessWebsite) supportParts.push('Website: ' + safe.businessWebsite);
  } else {
    if (safe.nomineeRole) supportParts.push('Role: ' + safe.nomineeRole);
    if (safe.nomineeYearsInTrade) supportParts.push('Years in Trade: ' + safe.nomineeYearsInTrade);
  }
  supportParts.push(
    'Nominator: ' + safe.nominatorName + (safe.nominatorCompany ? ' (' + safe.nominatorCompany + ')' : '')
  );
  if (safe.nominatorRelationship) supportParts.push('Relationship: ' + safe.nominatorRelationship);
  if (safe.supportingInfo) supportParts.push('Supporting Info: ' + safe.supportingInfo);
  const supportingInformation = supportParts.join('\n\n') || null;

  // 4. Create entry
  const currentYear = new Date().getFullYear();
  const entryTitle = isNewBusiness
    ? safe.businessName + ' - ' + safe.awardCategory
    : safe.nomineeName + ' - ' + safe.awardCategory;

  const entryPayload = {
    entry_number: entryNumber,
    organisation_id: organisationId,
    entry_title: entryTitle,
    entry_description: safe.nominationReason,
    contact_name: safe.nominatorName,
    contact_email: safe.nominatorEmail,
    status: 'submitted',
    payment_status: 'pending',
    submission_date: new Date().toISOString(),
    allow_public_voting: false,
    why_should_win: safe.nominationReason,
    supporting_information: supportingInformation,
    contact_phone: safe.nominatorPhone,
    year: currentYear,
    award_category: safe.awardCategory,
    county_city: safe.countyCity,
    is_self_nomination: false,
  };

  // Use retry wrapper to handle concurrent-submission race conditions on entry_number
  const { data: entry, error: entryError } = await insertEntryWithRetry(entryPayload);

  if (entryError) {
    // Fallback: try base columns only (re-use the already-generated entryNumber)
    const fallbackPayload = {
      entry_number: entryNumber,
      organisation_id: organisationId,
      entry_title: entryTitle,
      entry_description: [
        safe.nominationReason,
        supportingInformation ? '\n\nSupporting information:\n' + supportingInformation : '',
      ].join(''),
      contact_name: safe.nominatorName,
      contact_email: safe.nominatorEmail,
      status: 'submitted',
      payment_status: 'pending',
      submission_date: new Date().toISOString(),
      allow_public_voting: false,
    };

    const { data: baseEntry, error: baseError } = await insertEntryWithRetry(fallbackPayload);

    if (baseError) {
      console.error('Nomination entry creation failed:', baseError);
      return res.status(500).json({ error: 'Could not save your nomination. Please try again.' });
    }

    // Try setting extended fields (non-blocking)
    try {
      await supabase
        .from('entries')
        .update({
          why_should_win: safe.nominationReason,
          supporting_information: supportingInformation,
          contact_phone: safe.nominatorPhone,
          year: currentYear,
          award_category: safe.awardCategory,
          county_city: safe.countyCity,
          is_self_nomination: false,
        })
        .eq('id', baseEntry.id);
    } catch (_e) {
      console.error('[entry-proxy] Non-blocking metadata update failed:', _e.message);
    }

    // Send confirmation email (non-blocking)
    const fallbackNominee = isNewBusiness ? safe.businessName : safe.nomineeName;
    sendNominationConfirmation(safe.nominatorEmail, {
      contact_name: safe.nominatorName,
      nominee_name: fallbackNominee,
      award_name: safe.awardCategory,
      entry_number: baseEntry.entry_number,
      county_city: safe.countyCity || '',
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      entry: { id: baseEntry.id, entry_number: baseEntry.entry_number },
    });
  }

  // Send confirmation email (non-blocking)
  const nomineDisplay = isNewBusiness ? safe.businessName : safe.nomineeName;
  sendNominationConfirmation(safe.nominatorEmail, {
    contact_name: safe.nominatorName,
    nominee_name: nomineDisplay,
    award_name: safe.awardCategory,
    entry_number: entry.entry_number,
    county_city: safe.countyCity || '',
  }).catch(() => {});

  return res.status(200).json({
    success: true,
    entry: { id: entry.id, entry_number: entry.entry_number },
  });
}
