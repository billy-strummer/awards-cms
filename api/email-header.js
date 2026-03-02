/**
 * @module email-header
 * Shared Email Header and Wrapper.
 * Single source of truth for the branded email layout.
 * All email-sending paths import from this module.
 *
 * Every outbound email MUST be wrapped with wrapEmail() so that the
 * branded header and footer are included. This applies to:
 *   - Templated emails (resend-email.js)
 *   - Automated workflows (email-automation.js)
 *   - Notification queue processing
 *   - Any future email-sending paths
 *
 * For Supabase Edge Functions (Deno), use the mirror
 * module: supabase/functions/_shared/email-wrapper.ts
 *
 * Header/footer are built from tenant_branding values.
 * The subtitle text changes per email type (e.g.
 * "Self-Nomination Entry Confirmation").
 */

/**
 * Escape a string for safe inclusion in HTML.
 * @param {string} s - The string to escape.
 * @returns {string} The HTML-escaped string.
 */
const escHtml = (s) =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Resolve branding fields with sensible defaults.
 * Accepts a row from tenant_branding (or a partial object).
 * @param {Object} [branding={}] - Partial branding configuration from tenant_branding table.
 * @returns {{brandName: string, primaryColor: string, secondaryColor: string, accentColor: string, logoUrl: string, contactEmail: string, websiteUrl: string}} Resolved branding with defaults.
 */
function resolveBranding(branding = {}) {
  return {
    brandName: branding.company_name || process.env.FROM_NAME || 'British Trade Awards',
    primaryColor: branding.primary_color || '#000000',
    secondaryColor: branding.secondary_color || '#1a1a1a',
    accentColor: branding.accent_color || '#D4AF37',
    logoUrl: branding.logo_url || process.env.BTA_LOGO_URL || '',
    contactEmail: branding.email_from || branding.email_reply_to || process.env.FROM_EMAIL || '',
    websiteUrl: branding.custom_domain || '',
  };
}

/**
 * Build the email header HTML block.
 * Exact replica of the website header in submit-entry.html.
 * Logo present  -> side-by-side (logo left, brand name + subtitle right)
 * No logo       -> centred brand name + subtitle
 * @param {Object} [branding={}] - Tenant branding configuration.
 * @param {Object} [options] - Header options.
 * @param {string} [options.subtitle='Self-Nomination Entry Confirmation'] - Subtitle text below the brand name.
 * @returns {string} HTML string for the email header block.
 */
function buildEmailHeader(branding = {}, { subtitle = 'Self-Nomination Entry Confirmation' } = {}) {
  const b = resolveBranding(branding);
  const safeSubtitle = escHtml(subtitle);

  const headerContent = b.logoUrl
    ? `<table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>` +
      `<td style="vertical-align:middle;padding-right:25px;">` +
      `<img src="${escHtml(b.logoUrl)}" alt="${escHtml(b.brandName)}" style="height:100px;width:auto;display:block;">` +
      `</td>` +
      `<td style="vertical-align:middle;">` +
      `<h1 style="color:${b.accentColor};margin:0;font-size:28px;font-family:Georgia,'Times New Roman',serif;font-weight:900;letter-spacing:3px;text-transform:uppercase;line-height:1.3;text-shadow:0 2px 8px rgba(0,0,0,0.5);">${escHtml(b.brandName)}</h1>` +
      `<p style="color:${b.accentColor};margin:5px 0 0;font-size:14px;font-family:Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;opacity:0.95;font-weight:300;">${safeSubtitle}</p>` +
      `</td>` +
      `</tr></table>`
    : `<h1 style="color:${b.accentColor};margin:0;font-size:28px;font-family:Georgia,'Times New Roman',serif;font-weight:900;letter-spacing:3px;text-transform:uppercase;text-shadow:0 2px 8px rgba(0,0,0,0.5);">${escHtml(b.brandName)}</h1>` +
      `<p style="color:${b.accentColor};margin:5px 0 0;font-size:14px;font-family:Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;opacity:0.95;font-weight:300;">${safeSubtitle}</p>`;

  return `<div style="background:linear-gradient(135deg,${b.primaryColor} 0%,${b.secondaryColor} 100%);padding:35px 40px;text-align:center;border-bottom:3px solid ${b.accentColor};">
    ${headerContent}
  </div>`;
}

/**
 * Build the email footer HTML block.
 * @param {Object} [branding={}] - Tenant branding configuration.
 * @returns {string} HTML string for the email footer block.
 */
function buildEmailFooter(branding = {}) {
  const b = resolveBranding(branding);

  const domain = b.websiteUrl || 'britishtradeawards.com';

  return `<div style="background:${b.secondaryColor};padding:24px 32px;text-align:center;font-size:12px;color:${b.accentColor};">
    <p style="margin:0;">&copy; ${escHtml(b.brandName)} | <a href="https://${escHtml(domain)}" style="color:${b.accentColor};text-decoration:none;">${escHtml(domain)}</a></p>
  </div>`;
}

/**
 * Wrap arbitrary body HTML in a complete branded email document.
 * @param {string} bodyContent - The HTML body content to wrap.
 * @param {Object} [branding={}] - Tenant branding configuration.
 * @param {Object} [options] - Wrapping options.
 * @param {string} [options.subject=''] - Email subject (used in the HTML title tag).
 * @param {string} [options.preheader=''] - Hidden preheader text for email clients.
 * @param {string} [options.subtitle=''] - Text shown below the brand name in the header.
 * @returns {string} Complete HTML email document with branded header and footer.
 */
function wrapEmail(bodyContent, branding = {}, { subject = '', preheader = '', subtitle = '' } = {}) {
  const b = resolveBranding(branding);
  const resolvedHeader = buildEmailHeader(branding, { subtitle: subtitle || 'Self-Nomination Entry Confirmation' });
  const resolvedFooter = buildEmailFooter(branding);

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
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;border:2px solid ${b.accentColor};box-shadow:0 20px 60px rgba(212,175,55,0.3);">
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
  buildEmailHeader,
  buildEmailFooter,
  wrapEmail,
};
