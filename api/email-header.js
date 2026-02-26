/* ==================================================== */
/* SHARED EMAIL HEADER & WRAPPER                        */
/* Single source of truth for the branded email layout. */
/* All email-sending paths import from this module.     */
/*                                                      */
/* Header/footer HTML is loaded from the email_templates */
/* table (template_type = 'email_header'/'email_footer') */
/* and branding placeholders are replaced at send time   */
/* with values from the tenant_branding table.           */
/* If no DB templates exist, hardcoded fallbacks are used.*/
/* ==================================================== */

const escHtml = (s) =>
  String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Resolve branding fields with sensible defaults.
 * Accepts a row from tenant_branding (or a partial object).
 */
function resolveBranding(branding = {}) {
  return {
    brandName:      branding.company_name    || process.env.FROM_NAME || 'British Trade Awards',
    primaryColor:   branding.primary_color   || '#000000',
    secondaryColor: branding.secondary_color || '#1a1a1a',
    accentColor:    branding.accent_color    || '#D4AF37',
    logoUrl:        branding.logo_url        || process.env.BTA_LOGO_URL || '',
    contactEmail:   branding.email_from      || branding.email_reply_to || process.env.FROM_EMAIL || '',
    websiteUrl:     branding.custom_domain   || '',
  };
}

/**
 * Replace branding placeholders in a template string.
 * Placeholders: {BRAND_NAME}, {PRIMARY_COLOR}, {SECONDARY_COLOR},
 *   {ACCENT_COLOR}, {LOGO_URL}, {CONTACT_EMAIL}, {WEBSITE_URL}
 */
function replaceBrandingPlaceholders(html, branding = {}, { subtitle = '' } = {}) {
  const b = resolveBranding(branding);
  return html
    .replace(/\{BRAND_NAME\}/g,      escHtml(b.brandName))
    .replace(/\{PRIMARY_COLOR\}/g,    b.primaryColor)
    .replace(/\{SECONDARY_COLOR\}/g,  b.secondaryColor)
    .replace(/\{ACCENT_COLOR\}/g,     b.accentColor)
    .replace(/\{LOGO_URL\}/g,         escHtml(b.logoUrl))
    .replace(/\{CONTACT_EMAIL\}/g,    escHtml(b.contactEmail))
    .replace(/\{WEBSITE_URL\}/g,      escHtml(b.websiteUrl))
    .replace(/\{HEADER_SUBTITLE\}/g,  escHtml(subtitle || 'Self-Nomination Entry Confirmation'));
}

/* ---- DB-backed header/footer loading (cached) ---- */

let _templateCache = null;
let _templateCacheTime = 0;
const TEMPLATE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load the active email_header and email_footer templates from the DB.
 * Returns { header: string|null, footer: string|null }.
 * Requires a Supabase client instance.
 */
async function loadHeaderFooterTemplates(supabaseClient) {
  const now = Date.now();
  if (_templateCache && (now - _templateCacheTime) < TEMPLATE_CACHE_TTL) {
    return _templateCache;
  }
  try {
    const { data } = await supabaseClient
      .from('email_templates')
      .select('template_type, body')
      .in('template_type', ['email_header', 'email_footer'])
      .eq('is_active', true)
      .order('is_default', { ascending: false });

    const header = data?.find(t => t.template_type === 'email_header')?.body || null;
    const footer = data?.find(t => t.template_type === 'email_footer')?.body || null;

    _templateCache = { header, footer };
    _templateCacheTime = now;
    return _templateCache;
  } catch (e) {
    console.error('Failed to load header/footer templates:', e);
    return _templateCache || { header: null, footer: null };
  }
}

/* ---- Hardcoded fallbacks (used when no DB template exists) ---- */

/**
 * Build the email header HTML block (fallback).
 * Logo present  → side-by-side (logo left, brand name + subtitle right)
 * No logo       → centred brand name + subtitle
 */
function buildEmailHeader(branding = {}, { subtitle = 'Self-Nomination Entry Confirmation' } = {}) {
  const b = resolveBranding(branding);
  const safeSubtitle = escHtml(subtitle);

  const headerContent = b.logoUrl
    ? `<table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>`
      + `<td style="vertical-align:middle;padding-right:25px;">`
      + `<img src="${escHtml(b.logoUrl)}" alt="${escHtml(b.brandName)}" style="height:80px;width:auto;display:block;">`
      + `</td>`
      + `<td style="vertical-align:middle;">`
      + `<h1 style="color:${b.accentColor};margin:0;font-size:22px;font-family:Georgia,'Times New Roman',serif;letter-spacing:3px;text-transform:uppercase;line-height:1.3;">${escHtml(b.brandName)}</h1>`
      + `<p style="color:${b.accentColor};margin:5px 0 0;font-size:12px;font-family:Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;opacity:0.9;font-weight:300;">${safeSubtitle}</p>`
      + `</td>`
      + `</tr></table>`
    : `<h1 style="color:${b.accentColor};margin:0;font-size:24px;font-family:Georgia,'Times New Roman',serif;letter-spacing:3px;text-transform:uppercase;">${escHtml(b.brandName)}</h1>`
      + `<p style="color:${b.accentColor};margin:8px 0 0;font-size:13px;letter-spacing:2px;text-transform:uppercase;opacity:0.9;">${safeSubtitle}</p>`;

  return `<div style="background:linear-gradient(135deg,${b.primaryColor} 0%,${b.secondaryColor} 100%);padding:28px 32px;text-align:center;border-bottom:3px solid ${b.accentColor};">
    ${headerContent}
  </div>`;
}

/**
 * Build the email footer HTML block (fallback).
 */
function buildEmailFooter(branding = {}) {
  const b = resolveBranding(branding);

  const footerLinks = [
    b.websiteUrl   ? `<a href="https://${escHtml(b.websiteUrl)}" style="color:${b.accentColor};text-decoration:none;">${escHtml(b.websiteUrl)}</a>` : '',
    b.contactEmail ? `<a href="mailto:${escHtml(b.contactEmail)}" style="color:${b.accentColor};text-decoration:none;">${escHtml(b.contactEmail)}</a>` : ''
  ].filter(Boolean).join(' &nbsp;|&nbsp; ');

  return `<div style="background:${b.secondaryColor};padding:24px 32px;text-align:center;font-size:12px;color:#999;">
    <p style="margin:0;">${escHtml(b.brandName)}${footerLinks ? ' | ' + footerLinks : ''}</p>
  </div>`;
}

/**
 * Wrap arbitrary body HTML in a complete branded email document.
 *
 * Options:
 *   subject    – email subject (used in <title>)
 *   preheader  – hidden preheader text
 *   headerHtml – raw header template from DB (branding placeholders will be replaced)
 *   footerHtml – raw footer template from DB (branding placeholders will be replaced)
 *
 * If headerHtml/footerHtml are not supplied, the hardcoded fallbacks are used.
 */
function wrapEmail(bodyContent, branding = {}, { subject = '', preheader = '', headerHtml = null, footerHtml = null, subtitle = '' } = {}) {
  const resolvedHeader = headerHtml
    ? replaceBrandingPlaceholders(headerHtml, branding, { subtitle })
    : buildEmailHeader(branding, { subtitle: subtitle || 'Self-Nomination Entry Confirmation' });
  const resolvedFooter = footerHtml
    ? replaceBrandingPlaceholders(footerHtml, branding)
    : buildEmailFooter(branding);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  ${subject ? `<title>${escHtml(subject)}</title>` : ''}
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f7;">
    <tr>
      <td align="center" style="padding:30px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr><td>${resolvedHeader}</td></tr>
          <tr><td style="padding:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#333333;">${bodyContent}</td></tr>
          <tr><td>${resolvedFooter}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = {
  escHtml,
  resolveBranding,
  replaceBrandingPlaceholders,
  loadHeaderFooterTemplates,
  buildEmailHeader,
  buildEmailFooter,
  wrapEmail,
};
