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
const { sendEmail, wrapEmailTemplate } = require('./resend-email');

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
      case 'submit_nomination':
        return await handleSubmitNomination(req, res);
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

// ────────────────────────────────────────────
// Send nomination confirmation email (non-blocking)
// ────────────────────────────────────────────

async function sendNominationConfirmationEmail(
  nominatorEmail,
  nominatorName,
  nomineeName,
  awardCategory,
  entryNumber,
  region
) {
  try {
    const esc = (s) =>
      String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const subject = `Nomination Received - ${entryNumber} | British Trade Awards`;

    const bodyHtml =
      '<div style="padding:32px;color:#333;line-height:1.6;font-size:15px;font-family:Arial,Helvetica,sans-serif;">' +
      '<h2 style="color:#1a1a1a;margin-top:0;font-family:Georgia,\'Times New Roman\',serif;">Nomination Confirmation</h2>' +
      '<p>Dear ' +
      esc(nominatorName) +
      ',</p>' +
      '<p>Thank you for submitting your nomination for the British Trade Awards. We are pleased to confirm that your nomination has been received and is now being processed.</p>' +
      // Details box with gold left border
      '<div style="background:#fffdf5;border-left:4px solid #D4AF37;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0;">' +
      '<h3 style="margin:0 0 12px;color:#1a1a1a;font-size:16px;font-family:Georgia,\'Times New Roman\',serif;">Nomination Details</h3>' +
      '<table style="width:100%;font-size:14px;border-collapse:collapse;">' +
      '<tr><td style="padding:4px 8px;color:#6c757d;width:120px;">Reference:</td><td style="padding:4px 8px;font-weight:600;">' +
      esc(entryNumber) +
      '</td></tr>' +
      '<tr><td style="padding:4px 8px;color:#6c757d;">Nominee:</td><td style="padding:4px 8px;">' +
      esc(nomineeName) +
      '</td></tr>' +
      '<tr><td style="padding:4px 8px;color:#6c757d;">Category:</td><td style="padding:4px 8px;">' +
      esc(awardCategory) +
      '</td></tr>' +
      (region
        ? '<tr><td style="padding:4px 8px;color:#6c757d;">Region:</td><td style="padding:4px 8px;">' +
          esc(region) +
          '</td></tr>'
        : '') +
      '</table></div>' +
      // What happens next
      '<h3 style="color:#1a1a1a;font-size:16px;font-family:Georgia,\'Times New Roman\',serif;">What Happens Next</h3>' +
      '<ol style="padding-left:20px;">' +
      '<li style="margin-bottom:8px;">Our team will review your nomination to ensure all details are complete.</li>' +
      '<li style="margin-bottom:8px;">Shortlisted nominations will be assessed by our independent judging panel.</li>' +
      '<li style="margin-bottom:8px;">Winners will be announced at the awards ceremony.</li>' +
      '</ol>' +
      '<p>Please keep your nomination reference number <strong>' +
      esc(entryNumber) +
      '</strong> safe for future correspondence.</p>' +
      '<p style="margin-top:24px;">Kind regards,<br><strong>The British Trade Awards Team</strong></p>' +
      '</div>';

    const html = wrapEmailTemplate(subject, bodyHtml, '', {}, 'Nomination Confirmation');

    await sendEmail({
      to: nominatorEmail,
      subject,
      html,
      tags: [{ name: 'template', value: 'nomination_confirmation' }],
    });
  } catch (err) {
    console.error('Nomination confirmation email failed:', err);
    // Non-blocking — don't fail the submission
  }
}

// Handle nomination submission
// ────────────────────────────────────────────

async function handleSubmitNomination(req, res) {
  const {
    awardCategory,
    region,
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

  const isNewBusiness = awardCategory === 'New Business of the Year';

  // Validate required fields
  if (!awardCategory || typeof awardCategory !== 'string') {
    return res.status(400).json({ error: 'Award category is required' });
  }
  if (!nominatorEmail || !isValidEmail(nominatorEmail)) {
    return res.status(400).json({ error: 'Valid email address is required' });
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
    region: sanitizeString(region || '', 100),
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
        region: safe.region,
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
    region: safe.region,
    is_self_nomination: false,
  };

  const { data: entry, error: entryError } = await supabase.from('entries').insert(entryPayload).select().single();

  if (entryError) {
    // Fallback: try base columns only
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

    const { data: baseEntry, error: baseError } = await supabase
      .from('entries')
      .insert(fallbackPayload)
      .select()
      .single();

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
          region: safe.region,
          is_self_nomination: false,
        })
        .eq('id', baseEntry.id);
    } catch (_e) {
      /* non-blocking */
    }

    // Send confirmation email (non-blocking)
    const fallbackNominee = isNewBusiness ? safe.businessName : safe.nomineeName;
    sendNominationConfirmationEmail(
      safe.nominatorEmail,
      safe.nominatorName,
      fallbackNominee,
      safe.awardCategory,
      baseEntry.entry_number,
      safe.region
    );

    return res.status(200).json({
      success: true,
      entry: { id: baseEntry.id, entry_number: baseEntry.entry_number },
    });
  }

  // Send confirmation email (non-blocking)
  const nomineDisplay = isNewBusiness ? safe.businessName : safe.nomineeName;
  sendNominationConfirmationEmail(
    safe.nominatorEmail,
    safe.nominatorName,
    nomineDisplay,
    safe.awardCategory,
    entry.entry_number,
    safe.region
  );

  return res.status(200).json({
    success: true,
    entry: { id: entry.id, entry_number: entry.entry_number },
  });
}
